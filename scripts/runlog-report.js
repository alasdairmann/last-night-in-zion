// Summarise a run log written by the dev server: `node scripts/runlog-report.js [logs/<run>.jsonl]` (default: newest).
// Prints one row per night plus the notable events, so odd nights (spawn floods, sudden deaths) stand out.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

let file = process.argv[2];
if (!file) {
  const dir = 'logs';
  const all = readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => join(dir, f)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (!all.length) { console.log('No logs yet. Play a run with `npm start`.'); process.exit(0); }
  file = all[0];
}
const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
console.log(file, `${lines.length} lines`);
const top = (o, n = 3) => Object.entries(o || {}).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k}:${Math.round(v)}`).join(' ');
console.log('night | kills  maxAlive summoned | gun/melee/trap | dmgTaken (by)              | scrap in/spent | killed by');
for (const n of lines.filter((l) => l.k === 'night')) {
  const kills = Object.values(n.kills).reduce((a, b) => a + b, 0);
  console.log(`${String(n.round).padStart(5)} | ${String(kills).padStart(5)} ${String(n.maxAlive).padStart(8)} ${String(n.summoned).padStart(8)} | ${n.gunKills}/${n.meleeKills}/${n.trapKills} | ${String(Math.round(n.dmgTaken)).padStart(5)} (${top(n.hurtBy)}) | ${n.scrapIn}/${n.spent} | ${top(n.killBy)}`);
}
const notable = new Set(['down', 'revive', 'death', 'banner', 'errandAccept', 'errandDone', 'errandFail', 'survivorDied', 'raidWarn', 'bruteSpawn', 'looter', 'comfort', 'doorOpen', 'pubShut', 'pubOpen', 'hatch', 'bigHit']);
console.log('\nevents:');
for (const l of lines) if (l.k === 'ev' && notable.has(l.e)) console.log(`  r${l.r} t${l.t}  ${l.e} ${l.text || l.name || l.id || l.by || ''} ${l.sub || ''}`.trimEnd());
const end = lines.find((l) => l.k === 'end'); if (end) console.log('\nend:', end.how, 'night', end.round);
