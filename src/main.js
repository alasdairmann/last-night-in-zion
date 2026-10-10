// Boot, fixed-timestep loop (60 Hz, max 5 catch-up ticks), scene switching (PRD §27.2).
import { T } from './tuning.js';
import { Game } from './sim/game.js';
import { Input, labels, bindLabels } from './input.js';
import { Renderer } from './render/renderer.js';
import { Hud } from './render/hud.js';
import { AudioEngine } from './audio/audio.js';
import { UI } from './ui/menus.js';
import { store } from './store.js';
import { FIND_TYPES } from './data.js';
import { snapshot, restore } from './sim/save.js';
import { RunLog } from './runlog.js';
import { layout } from './layout.js';
import { TouchInput, mergeInput } from './touch.js';

const runlog = new RunLog();

store.load();
const S = store.settings;
document.body.classList.toggle('cb', S.colourBlind);
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

const screen = document.getElementById('screen');
const renderer = new Renderer(screen, S);
const hud = new Hud(S, store);
const audio = new AudioEngine(S);
const input = new Input(S);
layout.init(S);
bindLabels(S.keys); labels.touch = layout.touch;
let scale = renderer.resize(layout.mode);
hud.mode = layout.mode; hud.touchUI = layout.touch;
renderer.reduceFx = layout.mode === 'mobile' && S.mobileFx !== 'full';
const rotateEl = document.getElementById('rotate');
layout.on(({ changed }) => {
  labels.touch = layout.touch; hud.touchUI = layout.touch; hud.mode = layout.mode;
  scale = renderer.resize(layout.mode);
  renderer.reduceFx = layout.mode === 'mobile' && S.mobileFx !== 'full';
  if (changed && ui.open) ui.render();
  // portrait on a phone: a rotate screen, and the run pauses underneath
  rotateEl.hidden = !layout.portrait;
  if (layout.portrait && scene === 'play' && deathT < 0) pause();
});
rotateEl.hidden = !layout.portrait;
// touch controls and (in Mobile) the HUD live on an overlay canvas at device pixel ratio
const overlay = document.getElementById('overlay'), octx = overlay.getContext('2d');
const touch = new TouchInput(document.getElementById('stage'), overlay, S, layout, {
  playing: () => scene === 'play' && deathT < 0 && !ui.open && !layout.portrait,
  game: () => game, pause: () => pause(), cam: () => renderer.cam,
  minimap: () => layout.mode === 'mobile',
  tap: (x, y, onCtl) => (layout.mode === 'mobile' ? hud.mobileTap(x, y, onCtl || (touch.joy && touch.joy.zone(x))) : null),
  interactTap: () => { if (layout.mode === 'mobile') hud.promptCard = !hud.promptCard; },
});
hud.onPause = () => pause();
hud.ctxRect = () => touch.byId.interact;
hud.tutPoint = (key) => touch.byId[{ shift: 'lock', repair: 'interact', buy: 'interact', shove: 'shove', throw: 'throw', trick: 'trick', dog: 'dog', swap: 'chip', map: 'minimap' }[key]];
// the game canvas rect only changes on resize; read it then, not every frame
let canvasRect = null;
const mobileView = () => { const sv = touch.view(); if (!canvasRect || canvasRect.W !== sv.W || canvasRect.H !== sv.H || canvasRect.s !== scale) { const r = screen.getBoundingClientRect(); canvasRect = { W: sv.W, H: sv.H, s: scale, x: r.left, y: r.top, w: r.width, h: r.height }; } return { ...sv, dpr: window.devicePixelRatio || 1, rect: canvasRect, cam: renderer.cam }; };
const mapShown = () => (input.held('map') || touch.holding('map') || (layout.mode === 'mobile' && (hud.mapOpen || hud.mapHold))) && scene === 'play';
function drawOverlay(dt) {
  if (!(layout.touch || layout.mode === 'mobile')) { if (overlay.width) { overlay.width = 0; overlay.height = 0; } return; }
  const dpr = window.devicePixelRatio || 1, w = Math.round(window.innerWidth * dpr), h = Math.round(window.innerHeight * dpr);
  if (overlay.width !== w || overlay.height !== h) { overlay.width = w; overlay.height = h; }
  octx.setTransform(1, 0, 0, 1, 0, 0); octx.clearRect(0, 0, w, h); octx.setTransform(dpr, 0, 0, dpr, 0, 0);
  touch.update(scene === 'play' ? game : null, dt);
  hud.touchUI = layout.touch;
  const mob = layout.mode === 'mobile' && game && deathT < 0 && (scene === 'play' || scene === 'pause');
  const v = mob ? mobileView() : null;
  if (mob) hud.drawMobile(game, octx, v);
  if (scene === 'play' && deathT < 0 && game) touch.draw(octx, game);
  if (mob) { octx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0); hud.drawMobileOver(game, octx, v, { showMap: mapShown() }); }
}
// iOS only lets Web Audio start inside a touch handler
const unlockAudio = () => { audio.init(); if (scene === 'menu' && ui.open && !audio.musicOn) audio.startMusic(); };
window.addEventListener('touchend', unlockAudio, { passive: true });
window.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') unlockAudio(); });

let game = null, scene = 'menu', acc = 0, last = performance.now();
let escapeT = -1, deathT = -1, runStart = 0, runTime = 0, inputLog = [], attractPan = 0;
const debug = { overlay: false, f2: false };

const ui = new UI(document.getElementById('ui'), store, {
  layout,
  play: () => startRun(),
  resume: () => resume(),
  quit: () => toMenu(),
  menu: () => toMenu(),
  volumes: () => audio.applyVolumes(),
  applySettings: () => { if (game) game.opts.hitStop = S.hitStop; },
  fullscreen: () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); },
  sound: (k) => { if (k === 'tick') audio.play('tick'); else audio.play('repair'); },
  save: () => saveRun(),
  cont: () => continueRun(),
  retry: () => continueRun(store.loadAuto()),
  game: () => game,
  log: (act) => { if (act && game) act(game); },
  notes: () => hud.notes,
  pinned: () => hud.pin,
  pin: (n) => { const k = n.text.indexOf(': '); hud.pin = hud.pin && hud.pin.x === n.pin.x && hud.pin.y === n.pin.y ? null : { x: n.pin.x, y: n.pin.y, title: (k > 0 ? n.text.slice(0, k) : n.text).slice(0, 24) }; },
  pickedTrick: (id) => { game.setTrick(id); store.rec.lastTrick = id; store.save(); resume(); },
});

function newAttract() {
  game = new Game({ seed: 99, attract: true, hitStop: false });
  for (const d of game.doors) game.openDoor(d);
  game.events.length = 0;
  renderer.setGame(game);
  attractPan = 0;
}
function toMenu() {
  scene = 'menu'; deathT = -1; escapeT = -1;
  newAttract();
  hud.reset();
  audio.stopEngine(); audio.duck(false);
  ui.mainMenu();
}
function startRun() {
  audio.init(); audio.startMusic(); audio.stopEngine(); audio.duck(false);
  const seed = params.has('seed') ? Number(params.get('seed')) : (Math.random() * 1e9) >>> 0;
  game = new Game({ seed, hitStop: S.hitStop, infiniteScrap: !!S.godMode });
  renderer.setGame(game); hud.reset();
  scene = 'play'; deathT = -1; acc = 0; runStart = performance.now(); inputLog = [];
  store.runs++; store.save(); store.clearRun(); store.clearAuto();
  runlog.start(game, { kind: 'new', settings: { ...S, keys: undefined } });
  // §12.2: pick a Trick before wave 1 (the last choice is remembered)
  scene = 'pause'; ui.pickTrick(store.rec.lastTrick);
}
function saveRun() {
  if (!game || game.attract || game.p.dead) return false;
  const ok = store.saveRun(snapshot(game, { round: game.round, time: (performance.now() - runStart) / 1000, date: Date.now() }));
  hud.pushBanner({ text: ok ? 'GAME SAVED' : 'COULD NOT SAVE', sub: ok ? `Wave ${game.round}` : 'Storage is full or blocked' }, game);
  return ok;
}
function autosave() {
  if (!game || game.attract || game.p.dead) return;
  store.saveAuto(snapshot(game, { round: game.round, time: (performance.now() - runStart) / 1000, date: Date.now(), auto: true }));
}
function continueRun(raw = store.loadLatest()) {
  if (!raw) return;
  audio.init(); audio.startMusic(); audio.stopEngine(); audio.duck(false);
  try {
    const { game: g, meta } = restore(raw, { hitStop: S.hitStop });
    game = g; game.setGod(S.godMode); renderer.setGame(game); hud.reset();
    if (game.power) audio.play('power');
    runlog.start(game, { kind: 'continue', round: game.round });
    scene = 'play'; deathT = -1; acc = 0; runStart = performance.now() - (meta.time || 0) * 1000; inputLog = [];
    ui.hide();
  } catch (e) { console.error(e); store.clearRun(); store.clearAuto(); toMenu(); }
}
function openLog() { if (scene !== 'play' || deathT >= 0) return; scene = 'pause'; audio.duck(true); audio.setMood('pause'); ui.errandLog(game); }
function pause() { if (scene !== 'play') return; runlog.note({ e: 'pause' }); runlog.flush(); scene = 'pause'; audio.duck(true); audio.setMood('pause'); ui.noteFocus = 0; ui.pause(); }
function resume() { if (game) game.setGod(S.godMode); scene = 'play'; audio.duck(false); audio.setMood(null); ui.hide(); last = performance.now(); input.down.clear(); touch.reset(); }

// keys that aren't simulation input
input.onKey((e) => {
  audio.init();
  if (ui.open) { if (scene === 'menu' && !audio.musicOn) audio.startMusic(); return ui.key(e); }
  if (scene === 'play' && game.cellar && e.code === 'Escape') { game.exitCellar(); e.preventDefault(); return true; } // v1.4 B4: Esc stays
  if (scene === 'play' && (e.code === S.keys.pause || e.code === 'KeyP' || e.code === 'Escape')) { pause(); e.preventDefault(); return true; }
  if (scene === 'play' && e.code === S.keys.log) { openLog(); e.preventDefault(); return true; }
  if (DEBUG && scene === 'play') return debugKey(e);
  return false;
});
window.addEventListener('pagehide', () => { if (game && scene !== 'menu') { runlog.note({ e: 'pagehide' }); runlog.flush(true); } });
window.addEventListener('blur', () => { if (scene === 'play' && deathT < 0) pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && scene === 'play' && deathT < 0) pause(); });

function debugKey(e) {
  const g = game;
  const map = {
    Backquote: () => (debug.overlay = !debug.overlay),
    F2: () => (debug.f2 = !debug.f2),
    F5: () => (g.god = !g.god),
    F6: () => { g.scrap += 10000; },
    F7: () => g.debugKillAll(),
    F8: () => { const r = Number(prompt('Skip to round:', String(g.round + 5))); if (r > 0) g.debugSkipTo(r); },
    F9: () => { const t = prompt('Spawn enemy type (walker, crawler, bloater, armoured, runner, dog, brute, looter):', 'brute'); if (t) g.debugSpawn(t.trim()); },
    F10: () => { const t = prompt(`Spawn find (${FIND_TYPES.join(', ')}):`, 'ammo'); if (t) g.spawnFind(g.p.x + g.p.fx * 20, g.p.y + g.p.fy * 20, t.trim(), true); },
    F11: () => g.debugOpenAll(),
    F3: () => { const id = prompt('Start errand (fuel, fuse, supplyDrop, cellar, medicine, beacons, sealDrain, trader, sluice, searchlight, bounty, lostDog):', 'cellar'); if (id) g.acceptErrand(id.trim()); },
    F4: () => { g.adoptBiscuit(g.map.spots.pub_in); g.rescueDirect(0, 0); },
    F1: () => { g.trick.charge = 99; g.parts += 10; },
    F12: () => { const blob = new Blob([JSON.stringify({ seed: g.seed, inputs: inputLog })], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `enoch-waves-${g.seed}.json`; a.click(); },
  };
  if (map[e.code]) { e.preventDefault(); map[e.code](); input.down.clear(); return true; }
  return false;
}

function pumpEvents() {
  for (const ev of game.events) {
    if (scene !== 'menu') runlog.event(game, ev);
    renderer.consume(game, ev); hud.consume(game, ev); audio.consume(game, ev);
    if (hud.sting) { hud.sting = false; if (scene !== 'menu') audio.play('sting'); } // v1.4 A1: a critical card
    if (ev.type === 'death' && scene === 'play') runlog.end(game, 'death', { weapon: game.stats.deathWeapon, zone: game.zoneAt(game.p.x, game.p.y) });
    if (ev.type === 'escaped' && scene === 'play') runlog.end(game, 'escaped');
    if (ev.type === 'death' && scene === 'play') { deathT = 0; runTime = (performance.now() - runStart) / 1000; audio.stopMusic(); audio.stopEngine(); store.clearRun(); }
    if (ev.type === 'escaped' && scene === 'play') { escapeT = 0; runTime = (performance.now() - runStart) / 1000; store.clearRun(); store.clearAuto(); }
    if (ev.type === 'roundStart' && scene === 'play') autosave();
    if (ev.type === 'switchboard' && scene === 'play') { scene = 'pause'; audio.duck(true); ui.switchboard(game); }
    if (ev.type === 'stash' && scene === 'play') { scene = 'pause'; audio.duck(true); ui.stash(game); }
    if (ev.type === 'signalComplete') { store.rec.signalComplete = true; store.save(); }
    if (ev.type === 'tape' && !store.rec.tapesFound.includes(ev.i)) { store.rec.tapesFound.push(ev.i); store.save(); }
  }
  game.events.length = 0;
}

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (scene === 'play' || scene === 'menu') {
    let speed = 1;
    if (deathT >= 0) { deathT += dt; speed = deathT < 1.5 ? 0.3 : 0; }
    acc += dt * speed;
    let ticks = 0; const t0 = performance.now();
    while (acc >= T.dt && ticks < 5) {
      const inp = scene === 'play' && deathT < 0 ? mergeInput(input.sample(), touch.sample(game)) : (input.sample(), touch.sample(null), null);
      if (scene === 'play') { if (inp) inputLog.push(packInput(inp)); game.step(inp || idleInput); }
      else game.step(idleInput);
      pumpEvents();
      acc -= T.dt; ticks++;
    }
    if (ticks === 5) acc = 0;
    if (ticks) hud.tickMs = (performance.now() - t0) / ticks;
    if (scene === 'play' && game) runlog.tick(game, hud.fps);
    if (deathT >= 1.5 && scene === 'play') gameOver();
    if (escapeT >= 0 && scene === 'play') { escapeT += dt; if (escapeT > 2.5) escaped(); }
  }
  const alpha = Math.min(1, acc / T.dt);
  if (game) {
    if (scene === 'menu') {
      attractPan += dt;
      renderer.cam.x = 600 + Math.sin(attractPan * 0.05) * 500; renderer.cam.y = 380 + Math.sin(attractPan * 0.037) * 300;
      renderer.update(game, dt, false);
      renderer.hideTorch = true;
      renderer.draw(game, alpha, { hidePlayer: true });
      renderer.hideTorch = false;
    } else {
      renderer.update(game, scene === 'pause' ? 0 : dt, true);
      hud.update(game, scene === 'pause' ? 0 : dt);
      audio.update(game, dt);
      const zoom = deathT >= 0 ? 1 + 0.5 * Math.min(1, deathT / 1.5) : 1;
      renderer.draw(game, alpha, { zoom: zoom > 1 ? (deathT > 0.7 ? 1.5 : zoom) : 1, desaturate: deathT >= 0 ? Math.min(1, deathT / 1.5) : 0 });
      hud.fps = hud.fps * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
      const showMap = mapShown();
      if (deathT < 0 && layout.mode !== 'mobile') hud.draw(game, renderer.sctx, scale, renderer.cam, { showMap, debug: DEBUG && debug.overlay ? debug : null });
      if (DEBUG && debug.f2) drawDebugGeometry();
    }
  }
  drawOverlay(dt);
  if (!frame.once) requestAnimationFrame(frame);
}
const idleInput = { up: false, down: false, left: false, right: false, attack: false, shift: false, interact: false, map: false, prev: false, next: false, wheel: 0, slot: 0, reload: false, throw: false, shove: false, trick: false, dog: false };
function packInput(i) { return (i.up | i.down << 1 | i.left << 2 | i.right << 3 | i.attack << 4 | i.shift << 5 | i.interact << 6 | i.prev << 7 | i.next << 8 | i.reload << 9 | i.throw << 10 | i.shove << 11 | i.trick << 12 | i.dog << 13) + i.slot * 16384 + (i.wheel > 0 ? 1 : i.wheel < 0 ? 2 : 0) * 16384 * 5; }
// mouse hover over the HUD (comfort tooltips)
screen.addEventListener('mousemove', (e) => { const r = screen.getBoundingClientRect(); hud.mouse = { x: (e.clientX - r.left) / r.width * T.view.w, y: (e.clientY - r.top) / r.height * T.view.h }; });
screen.addEventListener('mouseleave', () => { hud.mouse = null; });
screen.addEventListener('mousedown', (e) => { const r = screen.getBoundingClientRect(); hud.click((e.clientX - r.left) / r.width * T.view.w, (e.clientY - r.top) / r.height * T.view.h); });

function escaped() {
  scene = 'over'; escapeT = -1;
  const r = game.round; const R = store.rec;
  if (!game.godUsed) { R.escapes++; if (!R.bestEscapeRound || r < R.bestEscapeRound) R.bestEscapeRound = r;
  if (r > store.best) store.best = r; }
  const sc = game.runScore('escaped'), bs = !game.godUsed && sc.total > (R.bestScore || 0);
  if (bs) R.bestScore = sc.total;
  store.save();
  audio.setMood(null);
  ui.escaped(game, runTime, sc, bs);
}
function gameOver() {
  scene = 'over';
  const r = game.round, newBest = !game.godUsed && r > store.best;
  const sc = game.runScore('death'), bs = !game.godUsed && sc.total > (store.rec.bestScore || 0);
  if (bs) store.rec.bestScore = sc.total;
  if (newBest || bs) { if (newBest) store.best = r; store.save(); }
  ui.gameOver(game, newBest, runTime, sc, bs);
}

function drawDebugGeometry() {
  const c = renderer.sctx, s = scale, cam = renderer.cam;
  c.save(); c.setTransform(s, 0, 0, s, 0, 0);
  for (const b of game.barricades) { c.fillStyle = game.openZones.has(b.zone) ? '#4f4' : '#666'; c.fillRect(b.spawn.x - cam.rx - 2, b.spawn.y - cam.ry - 2, 4, 4); }
  c.strokeStyle = 'rgba(255,255,0,0.5)'; c.lineWidth = 1 / s;
  for (const z of Object.values(game.map.zones)) c.strokeRect(z.x0 * 16 - cam.rx, z.y0 * 16 - cam.ry, (z.x1 - z.x0 + 1) * 16, (z.y1 - z.y0 + 1) * 16);
  c.restore();
}

newAttract();
ui.mainMenu();
requestAnimationFrame(frame);
window.__enoch = {
  get game() { return game; }, runlog, renderer, hud, audio, store, startRun, resume, ui,
  layout, touchInput: touch,
  // scripted touch for playtests: synthetic pointers through the real handlers. Controls are in CSS px.
  touch: {
    on() { if (!layout.touch) { layout.used = true; layout.update(); } touch.update(game, 0); return touch.ctl.map(({ id, x, y, r, w, h }) => ({ id, x: Math.round(x), y: Math.round(y), r, w, h })); },
    ev(type, x, y, id = 1) { const el = document.elementFromPoint(x, y) || document.getElementById('stage'); el.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, pointerType: 'touch', isPrimary: id === 1, bubbles: true, cancelable: true })); },
    down(x, y, id = 1) { this.ev('pointerdown', x, y, id); }, move(x, y, id = 1) { this.ev('pointermove', x, y, id); }, up(x, y, id = 1) { this.ev('pointerup', x, y, id); },
    at(ctl) { this.on(); const b = touch.byId[ctl]; if (!b) throw new Error(`no ${ctl} control showing`); return b; },
    press(ctl, id = 2) { const b = this.at(ctl); this.down(b.x, b.y, id); }, release(ctl, id = 2) { const q = touch.ptrs.get(id); if (q) this.up(q.x, q.y, id); },
    tap(ctl, id = 2) { this.press(ctl, id); this.release(ctl, id); },
    // the stick: angle in degrees (0 = right, 90 = down), or null to let go
    stick(deg, id = 1) {
      this.on(); const j = touch.joy;
      if (deg === null) { if (touch.stick) this.up(touch.stick.x, touch.stick.y, id); return; }
      if (!touch.stick) this.down(j.x, j.y, id);
      const a = deg * Math.PI / 180; this.move(touch.stick.ox + Math.cos(a) * j.R, touch.stick.oy + Math.sin(a) * j.R, id);
    },
  },
  get scene() { return scene; }, redraw() { frame.once = true; frame(last); frame.once = false; }, pause, openLog, toMenu, gameOver: () => { runTime = 754; gameOver(); },
  // test hook: advance the simulation n ticks with a fixed input, then render one frame
  advance(n, inp = {}) {
    for (let i = 0; i < n; i++) { touch.update(game, T.dt); game.step(mergeInput({ ...idleInput, ...inp }, touch.sample(game))); pumpEvents(); renderer.update(game, T.dt, true); hud.update(game, T.dt); }
    renderer.draw(game, 1, {}); if (layout.mode !== 'mobile') hud.draw(game, renderer.sctx, scale, renderer.cam, { showMap: !!inp.map || touch.holding('map') }); drawOverlay(0);
    return { round: game.round, scrap: game.scrap, hp: Math.round(game.p.hp), alive: game.enemies.length, kills: game.stats.kills, dead: game.p.dead, prompt: game.prompt?.label };
  },
};
