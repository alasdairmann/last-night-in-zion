// Screenshot harness for layout regression checks (Mobile & Touch PRD, phase 1).
// Drives the game into fixed states through window.__enoch, with requestAnimationFrame stubbed out and
// Math.random seeded so every shot is repeatable, and captures them with headless Chrome over the DevTools
// Protocol. No dependencies: Node 22's global WebSocket talks to Chrome.
//
//   node scripts/shots.js --update                 retake the Desktop baselines in tests/baseline/
//   node scripts/shots.js                          shoot Desktop into tests/shots/desktop/ and diff against the baselines
//   node scripts/shots.js --layout mobile          844x390 Mobile shots into tests/shots/mobile/ (no diff)
//   node scripts/shots.js --layout tablet          1180x820 Tablet shots (touch) into tests/shots/tablet/
//   node scripts/shots.js --only wave5,pause       a subset
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, rm, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const UPDATE = flag('--update');
const LAYOUT = opt('--layout', 'desktop');
const ONLY = opt('--only', '') ? opt('--only').split(',') : null;
const SIZES = { desktop: [1440, 900, 1, false], mobile: [844, 390, 3, true], tablet: [1180, 820, 2, true] };
const [W, H, DPR, TOUCH] = SIZES[LAYOUT];
const PORT = 4300 + Math.floor(Math.random() * 500), CDP = PORT + 1000;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SEED = 7;

// ---------- the states (run inside the page) ----------
// Each is a function body evaluated in the page. `E` is window.__enoch.
const START = `E.runlog.enabled = false; E.store.settings.tutorial = false; E.store.tut = {}; E.startRun(); E.ui.hooks.pickedTrick('flare');`;
const STATES = {
  title: `E.toMenu(); E.advance0 && 0;`,
  wave5: `${START} const g = E.game; g.debugSkipTo(5); E.advance(240); g.p.hp = g.p.maxHp; E.advance(1);`,
  prompt: `${START} const g = E.game; g.state = 'break'; g.breakT = 25;
    for (const d of g.doors) { if (d.open) continue; g.p.x = d.x; g.p.y = d.y + 18; E.advance(2); if (g.prompt) break; g.p.y = d.y - 18; E.advance(2); if (g.prompt) break; }
    E.renderer.snapCamera(g); E.advance(30);`,
  buff: `${START} const g = E.game; g.timed.double = 20; g.timed.adrenaline = 12; E.advance(60);`,
  pause: `${START} E.advance(30); E.pause();`,
  zionpedia: `${START} E.advance(30); E.pause(); E.ui.pedia();`,
  settings: `E.toMenu(); E.ui.settings();`,
  howto: `E.toMenu(); E.ui.howTo();`,
  journal: `${START} E.advance(30); E.openLog();`,
  gameover: `${START} const g = E.game; g.debugSkipTo(3); E.advance(120); E.gameOver();`,
};

// ---------- plumbing ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, ms = 15000) { const t0 = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch { /* retry */ } if (Date.now() - t0 > ms) throw new Error('timeout'); await sleep(100); } }

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let id = 0; const pend = new Map(), events = [];
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { const { res, rej } = pend.get(d.id); pend.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); } else events.push(d); };
  const ready = new Promise((r) => (ws.onopen = r));
  return { ready, events, close: () => ws.close(), send: (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); }) };
}

async function main() {
  const server = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  const prof = await mkdtemp(join(tmpdir(), 'enoch-shots-'));
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP}`, `--user-data-dir=${prof}`, '--hide-scrollbars', '--mute-audio', '--no-first-run', '--force-color-profile=srgb', `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
  let failures = 0;
  try {
    await waitFor(async () => (await fetch(`http://localhost:${PORT}/index.html`)).ok);
    const targets = await waitFor(async () => (await fetch(`http://localhost:${CDP}/json`)).json());
    const page = targets.find((t) => t.type === 'page');
    const c = cdp(page.webSocketDebuggerUrl); await c.ready;
    await c.send('Page.enable'); await c.send('Runtime.enable');
    await c.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: TOUCH });
    if (TOUCH) await c.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    // frozen clock: no animation frames, seeded randomness, fixed time
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: `
      window.requestAnimationFrame = () => 0; window.setInterval = () => 0;
      (() => { let s = 12345; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
      (() => { let t = 1000; performance.now = () => (t += 0.001); Date.now = () => 1760140800000; })();
      try { localStorage.clear(); } catch {}
    ` });
    const outDir = UPDATE ? join(ROOT, 'tests/baseline') : join(ROOT, 'tests/shots', LAYOUT);
    await mkdir(outDir, { recursive: true });
    const q = LAYOUT === 'desktop' ? '' : `&layout=${LAYOUT}${TOUCH ? '&touch=1' : ''}`;
    for (const [name, body] of Object.entries(STATES)) {
      if (ONLY && !ONLY.includes(name)) continue;
      await c.send('Page.navigate', { url: `http://localhost:${PORT}/index.html?seed=${SEED}${q}` });
      await waitFor(async () => (await c.send('Runtime.evaluate', { expression: '(async () => { if (document.readyState !== "complete" || !window.__enoch) return false; await Promise.all(["900 16px Nunito", "800 16px Nunito", "16px Silkscreen"].map((f) => document.fonts.load(f))); return true; })()', awaitPromise: true, returnByValue: true })).result.value);
      await sleep(300);
      const r = await c.send('Runtime.evaluate', { expression: `(() => { const E = window.__enoch; ${body}; E.redraw ? E.redraw() : E.advance(1); return 'ok'; })()`, returnByValue: true });
      if (r.exceptionDetails) { console.log(`${name}: ERROR ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`); failures++; continue; }
      await c.send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => 1)', awaitPromise: true });
      await sleep(400);
      const shot = await c.send('Page.captureScreenshot', { format: 'png' });
      const file = join(outDir, `${name}.png`);
      await writeFile(file, Buffer.from(shot.data, 'base64'));
      if (UPDATE || LAYOUT !== 'desktop') { console.log(`${name}: saved ${file.replace(ROOT, '')}`); continue; }
      const base = join(ROOT, 'tests/baseline', `${name}.png`);
      if (!existsSync(base)) { console.log(`${name}: no baseline`); failures++; continue; }
      const b64 = (await readFile(base)).toString('base64');
      const diff = await c.send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
        const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
        const [a, b] = await Promise.all([load(${JSON.stringify(b64)}), load(${JSON.stringify(shot.data)})]);
        if (a.width !== b.width || a.height !== b.height) return { size: [a.width, a.height, b.width, b.height] };
        const px = (im) => { const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; const x = cv.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, im.width, im.height).data; };
        const da = px(a), db = px(b); let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
        for (let i = 0; i < da.length; i += 4) if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2]) { n++; const p = i / 4, x = p % a.width, y = (p / a.width) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
        return { n, box: n ? [x0, y0, x1, y1] : null };
      })()` });
      const d = diff.result.value;
      if (d.size) { console.log(`${name}: SIZE DIFFERS ${d.size}`); failures++; }
      else if (d.n) { console.log(`${name}: DIFFERS in ${d.n} px, box ${d.box}`); failures++; }
      else console.log(`${name}: identical`);
    }
    c.close();
  } finally {
    chrome.kill(); server.kill();
    await sleep(300); await rm(prof, { recursive: true, force: true }).catch(() => {});
  }
  if (failures) { console.log(`${failures} shot(s) differ or failed`); process.exitCode = 1; }
}
main().catch((e) => { console.error(e); process.exit(2); });
