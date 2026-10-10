// Headless balance sim (PRD §29): a scripted bot fights, backs off, shoves, repairs and buys in a fixed order.
// Usage: node scripts/simulate-rounds.js [seeds=40] [maxMinutes=30]
import { Game, emptyInput, DIRS } from '../src/sim/game.js';

const SEEDS = Number(process.argv[2] || 40), MAX_MIN = Number(process.argv[3] || 30);
const BUY_ORDER = ['bat', 'door:1:3', 'generator', 'stew', 'shotgun', 'coffee'];

function dirToward(dx, dy) { return Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) & 7; }
function press(inp, d) { const [x, y] = DIRS[d]; inp.right = x > 0.1; inp.left = x < -0.1; inp.down = y > 0.1; inp.up = y < -0.1; }

function bot(g, mem) {
  const p = g.p, inp = emptyInput();
  const threats = [];
  for (const e of g.enemies) {
    if (e.dead || e.state === 'outside' || e.state === 'climb') continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < 90) threats.push([e, d]);
  }
  threats.sort((a, b) => a[1] - b[1]);
  const gun = [2, 1, 3].find((i) => p.slots[i] && p.slots[i].mag + p.slots[i].reserve > 0); // v1.4 F4: the revolver starts in the Secondary slot
  if (p.cur !== 0 && p.slots[0] && !(gun !== undefined && threats.length >= 5)) inp.slot = 1;
  if (threats.length) {
    const [e, d] = threats[0];
    const want = dirToward(e.x - p.x, e.y - p.y);
    const close = threats.filter((t) => t[1] < 30).length;
    // best escape direction: walkable and far from everything
    let bestDir = (want + 4) & 7, bestScore = -1e9;
    for (let k = 0; k < 8; k++) {
      const [dx, dy] = DIRS[k]; const nx = p.x + dx * 14, ny = p.y + dy * 14;
      if (g.solid(Math.floor(nx / 16), Math.floor(ny / 16))) continue;
      let sc = 0; for (const [o] of threats) sc += Math.min(60, Math.hypot(o.x - nx, o.y - ny));
      if (sc > bestScore) { bestScore = sc; bestDir = k; }
    }
    if (p.face !== want && d < 40) { press(inp, want); if (d < 12) { inp.shift = false; press(inp, bestDir); } }
    else if (close >= 2 || d < 10 || (e.atk > 0 && d < 20)) { inp.shift = true; press(inp, bestDir); }
    else if (d > 20) press(inp, want);
    const barrel = g.barrels.some((b) => b.alive && Math.hypot(b.px - p.x, b.py - p.y) < 30); // swings set barrels off
    inp.attack = d < 24 && p.face === want && g.tick % 10 < 5 && !barrel; // v1.4 D1: tap to swing (holding charges and holds a power attack)
    if (barrel && d < 24) inp.shove = true;
    inp.shove = (close >= 3 || g.p.surround >= 2) && p.shoveCD <= 0;
    if (threats.length >= 5 && gun !== undefined && d > 30) { inp.slot = gun + 1; inp.attack = p.face === want && g.tick % 10 < 5; }
    return inp;
  }
  const goal = errand(g, mem);
  if (goal) {
    const d = Math.hypot(goal.x - p.x, goal.y - p.y);
    if (d > 6) press(inp, dirToward(goal.x - p.x, goal.y - p.y));
    else { press(inp, dirToward(goal.fx - p.x, goal.fy - p.y)); inp.interact = !(g.hold.done || (g.holdPrev && g.hold.key === null)); } // a hold needs a fresh press: let go when one finishes or is blocked
  }
  return inp;
}
function nextTile(g, goal) { return { x: goal.x, y: goal.y }; }
function errand(g, mem) {
  const p = g.p;
  const b = g.barricades.filter((b) => g.openZones.has(b.zone) && b.planks < 6 && g.plankScrap < 500).sort((a, c) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(c.x - p.x, c.y - p.y))[0];
  if (b && Math.hypot(b.x - p.x, b.y - p.y) < 160) return { x: b.inside.x, y: b.inside.y, fx: b.x, fy: b.y };
  const next = BUY_ORDER[mem.buy];
  if (next === 'bat' && g.scrap >= 700) { const r = g.map.racks.find((r) => r.item === 'bat'); if (g.p.slots[0].id === 'bat') mem.buy++; else return { x: r.px, y: r.py + 16, fx: r.px, fy: r.py }; }
  if (next === 'door:1:3' && g.scrap >= 1200) { const d = g.doors.find((d) => d.a === 1 && d.b === 3); if (d.open) mem.buy++; else return { x: d.x + 16, y: d.y, fx: d.x, fy: d.y }; }
  if (next === 'generator') { if (g.power) mem.buy++; else if (g.doors.find((d) => d.a === 1 && d.b === 3).open) { const gn = g.map.generator; return { x: gn.px, y: gn.py + 16, fx: gn.px, fy: gn.py }; } }
  if (next === 'stew' && g.scrap >= 2700) { const s = g.map.comfortSpots.find((s) => s.id === 'stew'); if (g.hasComfort('stew') || !g.openZones.has(s.zone)) mem.buy++; else return { x: s.px, y: s.py + 16, fx: s.px, fy: s.py }; }
  return { x: 48 * 16, y: 35 * 16, fx: 48 * 16, fy: 30 * 16 };
}

export { bot };
const results = [];
if (process.env.WHY) {
  const g = new Game({ seed: 3, hitStop: false }); const mem = { buy: 0 }; const orig = g.hurtPlayer.bind(g);
  g.hurtPlayer = (d, src = {}) => { const r = orig(d, src); if (r && !src.dot) console.log(`t=${g.t.toFixed(1)} r${g.round} dmg ${d} from ${src.type || '?'}/${src.state || '?'} hp ${Math.round(g.p.hp)} near ${g.enemies.filter((e) => Math.hypot(e.x - g.p.x, e.y - g.p.y) < 30).length}`); return r; };
  while (!g.p.dead && g.t < 600) { g.step(bot(g, mem)); g.events.length = 0; }
  process.exit(0);
}
for (let seed = 1; seed <= SEEDS; seed++) {
  const g = new Game({ seed, hitStop: false }); const mem = { buy: 0 };
  const roundStart = {}; let ticks = 0;
  while (!g.p.dead && ticks < MAX_MIN * 3600) {
    const r = g.round; g.step(bot(g, mem)); ticks++;
    if (g.round !== r) roundStart[g.round] = ticks / 60;
    g.events.length = 0;
  }
  results.push({ seed, round: g.round, minutes: ticks / 3600, kills: g.stats.kills, melee: g.stats.kills ? g.stats.meleeKills / g.stats.kills : 0, earned: g.stats.earned, perRound: roundStart });
}
const rounds = results.map((r) => r.round).sort((a, b) => a - b);
const med = rounds[Math.floor(rounds.length / 2)];
const pct = (n) => Math.round((results.filter((r) => r.round >= n).length / results.length) * 100);
console.log(`seeds ${SEEDS}  median round ${med}  min ${rounds[0]}  max ${rounds[rounds.length - 1]}`);
console.log(`reached r5: ${pct(5)}%  r10: ${pct(10)}%  median run ${results.map((r) => r.minutes).sort((a, b) => a - b)[Math.floor(results.length / 2)].toFixed(1)} min`);
console.log(`median Scrap earned ${results.map((r) => r.earned).sort((a, b) => a - b)[Math.floor(results.length / 2)]}  melee share ${(results.reduce((a, r) => a + r.melee, 0) / results.length * 100).toFixed(0)}%`);
