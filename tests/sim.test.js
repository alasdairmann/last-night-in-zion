// Automated acceptance tests (PRD §31, the (A) items). Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, emptyInput } from '../src/sim/game.js';
import { T } from '../src/tuning.js';
import { bfs, INF } from '../src/nav.js';
import { ERRAND } from '../src/data/errands.js';

const fresh = (seed = 1) => new Game({ seed, hitStop: false });
const inp = (o = {}) => ({ ...emptyInput(), ...o });
const run = (g, n, o = {}) => { for (let i = 0; i < n; i++) g.step(inp(o)); };
function place(g, type, x, y, extra = {}) {
  const e = g.makeEnemy(type); Object.assign(e, { x, y, ox: x, oy: y, state: 'inside', hp: 1e6, maxHp: 1e6, groanT: 99 }, extra);
  g.enemies.push(e); return e;
}
// Freeze round flow so tests control the world
function quiet(g) { g.state = 'active'; g.round = 1; g.toSpawn = 0; g.pending = []; g.endRound = () => {}; }

// ---------- Controls ----------
test('W+D moves at the same speed as W alone (±1%)', () => {
  const open = (g) => { g.p.x = 40 * 16 + 8; g.p.y = 32 * 16 + 8; };
  const a = fresh(); quiet(a); open(a); const sa = { x: a.p.x, y: a.p.y };
  run(a, 30, { up: true }); const da = Math.hypot(a.p.x - sa.x, a.p.y - sa.y);
  const b = fresh(); quiet(b); open(b);
  run(b, 6, { up: true, right: true }); const sb = { x: b.p.x, y: b.p.y };
  run(b, 30, { up: true, right: true }); const db = Math.hypot(b.p.x - sb.x, b.p.y - sb.y);
  assert.ok(Math.abs(da - db) / da < 0.01, `${da} vs ${db}`);
});
test('With Shift held, facing does not change while moving', () => {
  const g = fresh(); quiet(g); const f0 = g.p.face;
  run(g, 30, { shift: true, left: true }); run(g, 30, { shift: true, down: true, right: true });
  assert.equal(g.p.face, f0);
});
test('A 50 ms tap of A turns Cain west and moves him at most 1 px', () => {
  const g = fresh(); quiet(g); const x0 = g.p.x, y0 = g.p.y;
  run(g, 3, { left: true }); run(g, 5);
  assert.equal(g.p.face, 4);
  assert.ok(Math.hypot(g.p.x - x0, g.p.y - y0) <= 1);
});

// ---------- Combat ----------
function swingAt(g, n) {
  g.p.slots[0] = g.makeWeapon('bat'); g.p.cur = 0; g.p.face = 2; g.p.fx = 0; g.p.fy = 1;
  const es = [];
  for (let i = 0; i < n; i++) { const a = (i - (n - 1) / 2) * 0.25; es.push(place(g, 'walker', g.p.x + Math.sin(a) * 13, g.p.y + Math.cos(a) * 13)); }
  g.step(inp({ attack: true })); run(g, 40);
  return es.filter((e) => e.hp < e.maxHp).length;
}
test('A bat swing at 3 walkers in its arc hits all 3; at 4 it hits 3 (cleave)', () => {
  let g = fresh(); quiet(g); assert.equal(swingAt(g, 3), 3);
  g = fresh(); quiet(g); assert.equal(swingAt(g, 4), 3);
});
test('A walker hit during stagger takes 1.5x and pays 160 Scrap on a kill', () => {
  const g = fresh(); quiet(g); g.p.face = 2; g.p.fx = 0; g.p.fy = 1;
  const e = place(g, 'walker', g.p.x, g.p.y + 12, { hp: 89, maxHp: 89, stagger: 5 });
  const s0 = g.scrap;
  g.step(inp({ attack: true })); run(g, 30);
  assert.ok(e.dead, 'hammer crit (90) kills an 89 HP walker');
  assert.equal(g.scrap - s0, 160);
  const h = fresh(); quiet(h); h.p.face = 2; h.p.fx = 0; h.p.fy = 1;
  const f = place(h, 'walker', h.p.x, h.p.y + 12, { hp: 89, maxHp: 89 });
  h.step(inp({ attack: true })); run(h, 30);
  assert.ok(!f.dead && Math.abs(f.hp - 29) < 1e-6, 'non-critical hit does 60');
});
test('A rifle bullet passes through 4 enemies with 25% fall-off each', () => {
  const g = fresh(); quiet(g); g.rng.next = () => 0.99; // no headshots
  g.p.slots[1] = g.makeWeapon('rifle'); g.p.cur = 1; g.p.face = 0; g.p.fx = 1; g.p.fy = 0; g.p.y = 32 * 16 + 8; g.p.x = 36 * 16;
  const es = [0, 1, 2, 3, 4].map((i) => place(g, 'walker', g.p.x + 30 + i * 14, g.p.y));
  g.step(inp({ attack: true }));
  const dmg = es.map((e) => e.maxHp - e.hp);
  assert.deepEqual(dmg.map((d) => Math.round(d * 10) / 10), [450, 337.5, 253.1, 189.8, 0]);
});
test('Durability drops by 1 per hitting swing only', () => {
  const g = fresh(); quiet(g); g.p.slots[0] = g.makeWeapon('bat'); g.p.face = 2; g.p.fx = 0; g.p.fy = 1;
  g.step(inp({ attack: true })); run(g, 40);
  assert.equal(g.p.slots[0].dur, 150);
  place(g, 'walker', g.p.x, g.p.y + 12);
  g.step(inp({ attack: true })); run(g, 40);
  assert.equal(g.p.slots[0].dur, 149);
});

// ---------- Economy ----------
test('Round 1 start: 500 Scrap. A melee kill: +130. A gun kill: +50', () => {
  const g = fresh(); assert.equal(g.scrap, 500);
  quiet(g);
  const a = place(g, 'walker', 0, 0); let s = g.scrap; g.kill(a, { kind: 'melee' }); assert.equal(g.scrap - s, 130);
  const b = place(g, 'walker', 0, 0); s = g.scrap; g.kill(b, { kind: 'gun' }); assert.equal(g.scrap - s, 50);
});
test('Plank Scrap stops at 500 per round', () => {
  const g = fresh(); quiet(g);
  const b = g.barricades[0]; g.p.x = b.inside.x; g.p.y = b.inside.y; g.p.face = 6;
  const s0 = g.scrap;
  for (let i = 0; i < 80; i++) { b.planks = 0; g.step(inp({ interact: true })); for (let k = 0; k < 30; k++) g.step(inp({ interact: true })); }
  assert.equal(g.scrap - s0, 500);
});
test('Buying with insufficient Scrap does nothing and plays the fail sound', () => {
  const g = fresh(); quiet(g); g.scrap = 100;
  const r = g.map.racks.find((x) => x.item === 'bat'); g.p.x = r.px; g.p.y = r.py + 16; g.p.face = 6; g.p.fx = 0; g.p.fy = -1;
  g.events.length = 0;
  run(g, 60, { interact: true });
  assert.equal(g.scrap, 100); assert.equal(g.p.slots[0].id, 'hammer');
  assert.ok(g.events.some((e) => e.type === 'fail'));
});
test("Trader's crate price rises 50 per pull and caps at 1,450", () => {
  const g = fresh(); g.crateMoveAt = 999;
  const prices = [];
  for (let i = 0; i < 14; i++) { prices.push(g.cratePrice()); g.useCrate(g.crates[0]); g.crates[0].state = 'idle'; }
  assert.deepEqual(prices.slice(0, 4), [950, 1000, 1050, 1100]);
  assert.equal(Math.max(...prices), 1450); assert.equal(prices[13], 1450);
});

// ---------- Rounds ----------
test('count(1..30) matches the formula; hp(10) = 1,045', () => {
  for (let r = 1; r <= 30; r++) assert.equal(T.round.count(r), Math.min(160, Math.round(6 + 2.5 * (r - 1) + 0.09 * r * r)));
  assert.deepEqual([1, 5, 10, 15, 20].map(T.round.count), [6, 18, 38, 61, 90]);
  assert.equal(T.walker.hp(10), 1045); assert.equal(T.walker.hp(1), 150); assert.equal(T.walker.hp(9), 950);
});
test('Alive enemies never exceed the active cap (plus 4 at noise 80+)', () => {
  const g = fresh(3); g.god = true;
  for (let i = 0; i < 60 * 240; i++) {
    if (i % 600 === 0) g.noise = 100;
    g.step(inp());
    const cap = T.round.activeCap(g.round) + 4;
    assert.ok(g.countAlive() <= cap, `alive ${g.countAlive()} > ${cap} at round ${g.round}`);
    if (i % 900 === 0) g.debugKillAll();
  }
});
test('Non-dog spawns always come from outside a barricade', () => {
  const g = fresh(4); g.god = true; const seen = new Set();
  for (let i = 0; i < 60 * 120; i++) {
    g.step(inp());
    for (const e of g.enemies) if (!seen.has(e.id)) { seen.add(e.id); if (e.type !== 'dog') assert.ok(e.state === 'outside', `${e.type} spawned ${e.state}`); }
  }
  assert.ok(seen.size > 5);
});
test('A round always ends: a lone non-crawler walker idle for 20 s speeds up', () => {
  const g = fresh(); g.god = true; g.state = 'active'; g.round = 3; g.toSpawn = 0; g.pending = [];
  const e = place(g, 'walker', 40 * 16, 24 * 16, { hp: 100, maxHp: 100, stagger: 999 });
  run(g, 60 * 21);
  assert.ok(e.sped && e.speed >= T.types.runner.speed);
  const c = fresh(); c.god = true; c.state = 'active'; c.round = 3; c.toSpawn = 0; c.pending = [];
  const cr = place(c, 'crawler', 40 * 16, 24 * 16, { stagger: 999 }); run(c, 60 * 21);
  assert.ok(!cr.sped, 'a crawler never speeds up');
});

// ---------- Finds ----------
test('1,000 seeded rounds: never more than 4 finds; 50+ kills never ends with 0 finds', () => {
  const g = fresh(7);
  for (let r = 0; r < 1000; r++) {
    g.state = 'break'; g.startRound(1 + (r % 14)); g.finds = [];
    const kills = 10 + Math.floor(g.rng.next() * 110);
    for (let k = 0; k < kills; k++) { const e = place(g, 'walker', 100, 100); g.kill(e, { kind: 'melee' }); }
    assert.ok(g.roundFinds <= 4, `round ${r}: ${g.roundFinds}`);
    if (kills >= 50) assert.ok(g.roundFinds >= 1);
    g.enemies = [];
  }
});
test('Ammo Bag never appears twice in a row', () => {
  const g = fresh(11); let last = null;
  for (let i = 0; i < 20000; i++) { const f = g.drawFind(); g.lastFind = f; assert.ok(!(f === 'ammo' && last === 'ammo')); last = f; }
});
test('Dynamite kills all enemies and pays 400 flat', () => {
  const g = fresh(); quiet(g);
  for (let i = 0; i < 12; i++) place(g, 'walker', 300 + i * 10, 300, { hp: 500, maxHp: 500 });
  const s0 = g.scrap;
  g.applyFind({ type: 'dynamite', x: g.p.x, y: g.p.y });
  run(g, 70);
  assert.equal(g.enemies.length, 0);
  assert.equal(g.scrap - s0, 400);
});

// ---------- Comforts and downing ----------
test('Buying a 5th comfort without the cap upgrade is refused', () => {
  const g = fresh(); quiet(g); g.power = true; g.scrap = 1e6;
  g.p.comforts = ['stew', 'coffee', 'steady', 'shoes'];
  const spot = g.map.comfortSpots.find((s) => s.id === 'eagle');
  g.p.x = spot.px; g.p.y = spot.py + 16; g.p.face = 6; g.p.fx = 0; g.p.fy = -1;
  run(g, 90, { interact: true });
  assert.equal(g.p.comforts.length, 4); assert.ok(!g.p.comforts.includes('eagle'));
  assert.equal(g.prompt.label, 'Comfort limit reached');
});
test('Downed with Bandages: back up after 6 s, comforts kept (v1.2) and uses -1', () => {
  const g = fresh(); quiet(g);
  g.buyComfort('bandages'); g.buyComfort('stew'); g.p.busyT = 0;
  g.hurtPlayer(9999);
  assert.ok(g.p.downed && !g.p.dead);
  run(g, 60 * 6 + 2);
  assert.ok(!g.p.downed && !g.p.dead);
  assert.deepEqual(g.p.comforts, ['bandages', 'stew']);
  assert.equal(g.p.bandages, 2); assert.equal(g.p.hp, g.p.maxHp);
});
test('Downed without Bandages or Second Wind: game over', () => {
  const g = fresh(); quiet(g); g.hurtPlayer(9999); assert.ok(g.p.dead);
});

// ---------- Map ----------
test('Every zone is reachable from zone 1 with all doors open', () => {
  const g = fresh(); g.debugOpenAll();
  const f = new Uint16Array(g.W * g.H); bfs(g.W, g.H, g.walk, Math.floor(g.p.x / 16), Math.floor(g.p.y / 16), f, new Int32Array(g.W * g.H));
  for (const z of Object.values(g.map.zones)) {
    let ok = false;
    for (let y = z.y0; y <= z.y1 && !ok; y++) for (let x = z.x0; x <= z.x1; x++) if (f[y * g.W + x] !== INF) { ok = true; break; }
    assert.ok(ok, `zone ${z.id} unreachable`);
  }
});
test('Every zone has at least two routes out once fully opened', () => {
  const g = fresh();
  for (const id of Object.keys(g.map.zones)) assert.ok(g.doors.filter((d) => d.a === +id || d.b === +id).length >= 2, `zone ${id}`);
  // every interior floor tile of an open town reaches the player
  g.debugOpenAll();
  const f = new Uint16Array(g.W * g.H); bfs(g.W, g.H, g.walk, Math.floor(g.p.x / 16), Math.floor(g.p.y / 16), f, new Int32Array(g.W * g.H));
  let stranded = 0;
  for (let i = 0; i < f.length; i++) if (g.walk[i] && f[i] === INF) stranded++;
  assert.equal(stranded, 0);
});
test('Every barricade opens onto a walkable tile in its zone', () => {
  const g = fresh();
  for (const b of g.barricades) assert.ok(g.walk[b.inside.ty * g.W + b.inside.tx] && b.zone > 0, `barricade ${b.id}`);
  assert.equal(g.barricades.length, 28); assert.equal(g.barricades.filter((b) => b.zone === 1).length, 6);
});

// ---------- Noise ----------
test('10 revolver shots in 5 s raise the meter to >= 30; melee never raises it', () => {
  const g = fresh(); quiet(g); g.p.slots[1] = g.makeWeapon('revolver', 6, 36); g.p.cur = 1;
  for (let i = 0; i < 10; i++) { g.p.slots[1].mag = 6; g.p.fireCD = 0; g.step(inp({ attack: true })); run(g, 29); }
  assert.ok(g.noise >= 30, `noise ${g.noise}`);
  const h = fresh(); quiet(h);
  for (let i = 0; i < 10; i++) { h.step(inp({ attack: true })); run(h, 30); }
  assert.equal(h.noise, 0);
});
test('Noise never changes round.count', () => {
  const g = fresh(); g.noise = 100; g.nextDogRound = 99; g.state = 'break'; g.startRound(5);
  assert.equal(g.toSpawn, T.round.count(5));
});

// ---------- Determinism ----------
test('The same seed + input log produces the same final state hash', () => {
  const script = (i) => inp({ up: i % 240 < 60, left: i % 240 >= 60 && i % 240 < 120, down: i % 240 >= 120 && i % 240 < 180, right: i % 240 >= 180, attack: i % 20 < 10, shove: i % 97 === 0, interact: i % 400 > 300 });
  const hashes = [0, 1].map(() => { const g = fresh(42); for (let i = 0; i < 60 * 90; i++) g.step(script(i)); return g.hash(); });
  assert.equal(hashes[0], hashes[1]);
});

// ---------- Depth systems ----------
test('Generator fuel lasts 8 rounds, then the power fails; a jerry can restarts it', () => {
  const g = fresh(); g.nextDogRound = 999; g.nextBrute = 999;
  g.startGenerator();
  for (let r = 2; r <= 9; r++) { g.state = 'break'; g.startRound(r); }
  assert.equal(g.power, false); assert.equal(g.fuel, 0);
  g.p.jerry = true; g.refuel();
  assert.equal(g.power, true); assert.equal(g.fuel, 8); assert.equal(g.p.jerry, false);
});
test("The trader's loan is repaid from the next 1,500 Scrap earned", () => {
  const g = fresh(); g.debt = 1500; const s0 = g.scrap;
  for (let i = 0; i < 12; i++) g.addScrap(130, 0, 0);
  assert.equal(g.debt, 0); assert.equal(g.scrap - s0, 12 * 130 - 1500);
});
test('The town safe earns 5% interest per round', () => {
  const g = fresh(); g.bank = 2000; g.nextDogRound = 999; g.state = 'break'; g.startRound(2);
  assert.equal(g.bank, 2100);
});

// ---------- Feedback pass ----------
test('A hold only starts on a fresh press: finishing a repair never rolls into reinforcing or buying', () => {
  const g = fresh(); quiet(g); g.power = true; g.scrap = 5000;
  const b = g.barricades[0]; b.planks = T.barricade.planks - 1; g.p.x = b.inside.x; g.p.y = b.inside.y; g.p.face = 6;
  run(g, 120, { interact: true }); // one continuous hold
  assert.equal(b.planks, T.barricade.planks); assert.equal(b.reinforce || 0, 0); assert.ok(g.scrap >= 5000);
  run(g, 1, {}); run(g, 80 + Math.ceil(T.prompt.reveal * 60), { interact: true }); // let go, press again (v1.4 B1: a moment to read the price)
  assert.equal(b.reinforce, 1); assert.ok(g.scrap <= 5000 - T.reinforce.bars.scrap + 20);
});
test('Walking up to a purchase with the key already held does not buy it', () => {
  const g = fresh(); quiet(g); g.scrap = 5000;
  const r = g.map.racks.find((x) => x.item === 'shotgun');
  g.p.x = r.px - 80; g.p.y = r.py + 16; run(g, 2, { interact: true });
  g.p.x = r.px; g.p.y = r.py + 16; g.p.fx = 0; g.p.fy = -1; run(g, 60, { interact: true });
  assert.equal(g.scrap, 5000);
  run(g, 1, {}); run(g, 60, { interact: true });
  assert.ok(g.scrap < 5000);
});
test('The last walker is flagged only once it is alone', () => {
  const g = fresh(); quiet(g);
  const a = place(g, 'walker', 100, 100); const b = place(g, 'walker', 200, 200);
  assert.equal(g.lastEnemy(), null); b.dead = true; assert.equal(g.lastEnemy(), a);
});
test('Trap kills are tallied per trap', () => {
  const g = fresh(); quiet(g); g.power = true;
  const t = g.traps.find((x) => x.kind === 'fence'); g.scrap = 5000; g.activateTrap(t);
  const e = place(g, 'walker', t.px, t.py, { hp: 10, maxHp: 10 }); e.x = (t.rect[0] + t.rect[2]) / 2; e.y = (t.rect[1] + t.rect[3]) / 2;
  g.step(inp()); assert.equal(t.kills, 1); assert.ok(t.earned > 0);
});

// ---------- v1.2 ----------
test('v1.2: Second Wind keeps comforts', () => {
  const g = fresh(); quiet(g);
  g.buyComfort('stew'); g.buyComfort('shoes'); g.p.secondWind = true; g.p.busyT = 0;
  g.hurtPlayer(9999);
  assert.ok(g.p.downed);
  assert.deepEqual(g.p.comforts, ['stew', 'shoes']);
});
test('v1.2: Screamer summons are capped per night', () => {
  const g = fresh(); quiet(g); g.round = 12;
  for (const z of [1, 2, 3, 4, 5, 6, 7, 8, 9]) g.openZones.add(z);
  const s = g.debugSpawn('screamer'); s.state = 'inside'; s.x = g.p.x + 120; s.y = g.p.y;
  for (let i = 0; i < 40; i++) { s.screamT = 0.001; s.hp = 1e9; g.screamerAI(s); }
  assert.ok(g.screamSummoned <= 12, `summoned ${g.screamSummoned}`);
});
test('v1.2: nine cellar hatches on floor tiles, and they move you', () => {
  const g = fresh(); quiet(g);
  assert.equal(g.hatches.length, 9);
  for (const h of g.hatches) assert.ok(!g.solid(h.tx, h.ty), h.name);
  assert.equal(new Set(g.hatches.map((h) => h.zone)).size, 9);
  assert.ok(g.inPub(g.hatches[0].x, g.hatches[0].y));
  g.openZones.add(5); g.useHatch(g.hatches[1], g.hatches[0]);
  assert.ok(g.inPub(g.p.x, g.p.y));
});
test('cellar chain: broken door, then the pub hatch, then the first open zone', () => {
  const g = fresh(); quiet(g); g.openZones.add(5);
  assert.equal(g.walk[g.pubDoorIdx()], 0);
  assert.equal(g.cellarTask().stage, 1);
  g.fixPubDoor(); assert.equal(g.walk[g.pubDoorIdx()], 1); assert.equal(g.cellarTask().stage, 2);
  assert.ok(!g.hatchUsable(g.hatches[0]));
  g.fixHatch(g.hatches[0]); const t3 = g.cellarTask(); assert.equal(t3.stage, 3);
  const h1 = g.hatches.find((h) => h.zone === 1); assert.equal(t3.x, h1.x);
  g.fixHatch(h1); assert.equal(g.cellarTask(), null);
  g.p.x = h1.x; g.p.y = h1.y; g.enterCellar(h1); assert.ok(g.cellar); assert.equal(g.cellarDest(), g.hatches[0]);
  const inp = emptyInput(); g.updateCellar(inp); inp.interact = true; g.updateCellar(inp);
  assert.equal(g.cellar, null); assert.ok(g.inPub(g.p.x, g.p.y));
});
test('cellar hatches refuse with the dead nearby', () => {
  const g = fresh(); quiet(g); g.openZones.add(5); g.fixPubDoor(); g.fixHatch(g.hatches[0]);
  const h1 = g.hatches.find((h) => h.zone === 1); g.fixHatch(h1);
  const z = g.debugSpawn('walker'); z.state = 'inside'; z.x = h1.x + 20; z.y = h1.y;
  assert.ok(g.zedsNear(h1.x, h1.y, T.hatch.clearR));
});
test('v1.2: a bolted Red Lion door blocks the way in', () => {
  const g = fresh(); quiet(g); g.openZones.add(5); g.fixPubDoor();
  const i = g.pubDoorIdx();
  assert.equal(g.walk[i], 1);
  g.setPubShut(true); assert.equal(g.walk[i], 0); assert.ok(g.safeHouse);
  g.setPubShut(false); assert.equal(g.walk[i], 1);
});
test('v1.2: a tier-3 gun out-damages a tier-3 melee weapon per hit', () => {
  const g = fresh();
  const ar = g.makeWeapon('ar', 30, 210); ar.tier = 3; const bat = g.makeWeapon('bat'); bat.tier = 3;
  assert.ok(g.gunStats(ar).dmg * g.gunStats(ar).pen > g.meleeStats(bat).dmg);
});
test('v1.2: Red Lion shutters are stronger than town reinforcement and resist Brutes', () => {
  assert.ok(T.pubReinforce.oak.tear > T.reinforce.sheet.tear && T.pubReinforce.oak.scrap > T.reinforce.bars.scrap);
  const g = fresh(); quiet(g); g.power = true; g.safeHouse = true; g.scrap = 5000;
  const w = g.safeBars[0]; w.reinforce = 1;
  const br = g.debugSpawn('brute'); br.state = 'outside'; br.bar = w; br.off = 0; br.x = w.outer.x; br.y = w.outer.y; br.tearT = 0;
  g.enemyOutside(br);
  assert.equal(w.planks, T.barricade.planks);
});
test('v1.2: finishing an errand pays Parts', () => {
  assert.ok(T.parts.errand >= 2);
});

// ---------- v1.2 Part B acceptance checks ----------
test('B1: an outside walker at a barricade with planks does no damage', () => {
  const g = fresh(); quiet(g);
  const b = g.barricades[0]; b.planks = 1;
  g.p.x = b.inside.x; g.p.y = b.inside.y;
  const e = g.spawnAtBarricade('walker', b); e.x = b.outer.x; e.y = b.outer.y; e.tearT = -999;
  const hp = g.p.hp; run(g, 300);
  assert.equal(g.p.hp, hp);
  assert.equal(g.hurtPlayer(30, e), false);
});
test('B7: a walker burned, then killed by melee, counts for the fire objective', () => {
  const g = fresh(); quiet(g); g.round = 4;
  g.trial = { id: 'boom', n: 0, target: 99, until: 9, tier: 0 };
  g.p.face = 2; g.p.fx = 0; g.p.fy = 1;
  const e = place(g, 'walker', g.p.x, g.p.y + 12, { hp: 50, maxHp: 50 });
  g.damageEnemy(e, 1, { kind: 'fire', x: e.x, y: e.y, silent: true });
  run(g, 60); g.p.slots[0] = g.makeWeapon('bat'); g.p.cur = 0;
  g.step(inp({ attack: true })); run(g, 40);
  assert.ok(e.dead); assert.equal(g.trial.n, 1);
});
test('B4: Seal the Drain has no deadline and leaving the ring pauses it', () => {
  const g = fresh(); quiet(g); g.openZones.add(8);
  const def = ERRAND.sealDrain; const er = g.startErrand({ ...def, steps: [def.steps[3]] });
  const sp = g.spot('drain'); g.p.x = sp.px; g.p.y = sp.py;
  run(g, 120); const t1 = er.s.t; assert.ok(t1 > 1.9);
  g.p.x = sp.px + 300; run(g, 60 * 40);
  assert.ok(g.errands.includes(er), 'not failed'); assert.equal(er.s.t, t1);
});
test('B5: Q/E never change the weapon slot', () => {
  const g = fresh(); quiet(g); const c0 = g.p.cur;
  for (let i = 0; i < 10; i++) { g.step(inp({ next: true })); g.step(inp({ prev: true })); g.step(inp({ next: true })); run(g, 30); }
  assert.equal(g.p.cur, c0);
  g.step(inp({ wheel: 1 })); assert.notEqual(g.p.cur, c0);
});
test('v1.5 I2: a found melee weapon goes to the stash, never replacing yours; swap it at the bar', () => {
  const g = fresh(); quiet(g);
  g.p.slots[0] = g.makeWeapon('bat'); g.p.slots[0].tier = 3; g.p.cur = 0;
  const wi = g.addWorldItem({ item: 'weapon', kind: 'weapon', weapon: 'machete', cond: 1, x: g.p.x, y: g.p.y + 6 });
  assert.match(g.describeWorldItem(wi).sub, /send to pub inventory/i);
  g.p.face = 2; g.p.fx = 0; g.p.fy = 1;
  run(g, 80, { interact: true });
  assert.equal(g.p.slots[0].id, 'bat');
  const i = g.stash.findIndex((w) => w.id === 'machete'); assert.ok(i >= 0);
  g.stashTake(i); assert.equal(g.p.slots[0].id, 'machete'); assert.ok(g.stash.some((w) => w.id === 'bat'));
});
test('v1.5 R6: bolting from outside with a survivor inside stays bolted', () => {
  const g = fresh(); quiet(g); g.openZones.add(5); g.pubDoorFixed = true;
  const d = g.map.pub.door;
  const s = g.survivors[0] || (g.survivors.push({ kind: 'survivor', state: 'home', name: 'Test', hp: 100, maxHp: 100, x: 0, y: 0, r: 4 }), g.survivors[0]);
  s.state = 'home'; s.dead = false; s.x = g.map.spots.pub_bar.px; s.y = g.map.spots.pub_bar.py; s.home = { x: s.x, y: s.y };
  assert.ok(g.inPub(s.x, s.y));
  g.p.x = d.x; g.p.y = d.y + 20; assert.ok(!g.inPub(g.p.x, g.p.y));
  g.boltRearmed = true; g.setPubShut(false, true);
  const it = []; g.safehouseInteractables(it); it.find((o) => o.id === 'pubdoor').describe().action();
  assert.ok(g.pubShut);
  run(g, 120); assert.ok(g.pubShut, 'still bolted while you stand there');
});
test('v1.5 T1/T2: every trial posted can be mastered from the minimum spawns in its window', async () => {
  const { trialTarget, trialSupply, trialMasterable } = await import('../src/sim/nights.js');
  const { TRIALS } = await import('../src/data.js');
  for (let r = T.trials.fromRound; r < 40; r += T.trials.every) {
    const until = r + T.trials.every - 1;
    for (const id of Object.keys(TRIALS)) {
      if (TRIALS[id].fixed) continue;
      assert.ok(trialMasterable(id, r, until), `${id} at wave ${r}`);
      assert.ok(trialTarget(id, r, until) * 2 <= trialSupply(r, until) * 0.6, `${id} at wave ${r}: master within 60% of the dead`);
    }
  }
});
test('v1.5 C1: comfort slots never outnumber the comforts that need one', () => {
  const g = fresh(); g.signal.done = true; g.capBonus = 3; g.p.comforts.push('mule');
  assert.ok(g.comfortCap() <= g.comfortSlotMax());
});
test('v1.5 L1: the town art has no fire engine baked in (the live one is the only one)', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../src/render/mapart.js', import.meta.url), 'utf8');
  assert.match(src, /p\.kind !== 'fireengine'/);
});
test('v1.5 Z2: a walker passes Biscuit by and goes for you; his barking draws nothing', () => {
  const g = fresh(); quiet(g); g.adoptBiscuit({ px: 0, py: 0 }); const bis = g.biscuit; bis.target = null;
  g.p.x = 40 * 16 + 8; g.p.y = 32 * 16 + 8; bis.x = g.p.x + 70; bis.y = g.p.y + 20;
  const e = place(g, 'walker', g.p.x + 80, g.p.y); g.enemyInside(e);
  assert.ok(e.fx < 0, 'heads for you, not the dog 20 px away');
  const n0 = g.lures.length; bis.mode = 'attack'; bis.target = e; bis.noiseT = 0; run(g, 2);
  assert.equal(g.lures.length, n0, 'no noise lure from his bark');
});
test('v1.5 R2: survivors at home stab the dead tearing at a Red Lion window', () => {
  const g = fresh(); quiet(g); g.debugOpenAll(); g.rescueDirect(0, 0); g.safeHouse = true;
  g.p.x = 80 * 16; g.p.y = 32 * 16;
  const w = g.safeBars[0]; const e = place(g, 'walker', w.spawn.x, w.spawn.y, { state: 'outside', bar: w, off: 0, hp: 300, maxHp: 300 });
  run(g, 600); assert.ok(e.dead || e.hp < 300, 'the survivor fought back');
});
test('v1.5 R4: you can bolt the Red Lion with the dead at the door', () => {
  const g = fresh(); quiet(g); g.openZones.add(5); g.pubDoorFixed = true;
  const d = g.map.pub.door; g.p.x = d.x; g.p.y = d.y + 20; place(g, 'walker', d.x + 30, d.y + 30);
  const it = []; g.safehouseInteractables(it); const o = it.find((x) => x.id === 'pubdoor').describe();
  assert.ok(!o.disabled); assert.match(o.label, /Bolt/);
});
test('v1.5 P1: major events wait their turn: never more than 2 start in any 15 s', () => {
  const g = fresh(); quiet(g); g.roundT0 = g.t; g.majorN = 0; const at = [];
  for (let i = 0; i < 5; i++) g.queueMajor(() => at.push(g.t));
  run(g, 60 * 90);
  assert.equal(at.length, 5);
  for (const t of at) assert.ok(at.filter((u) => u >= t && u < t + 15).length <= 2, at.join(','));
  assert.ok(at[0] >= T.pacing.slots[0], 'nothing in the first seconds of the wave');
});
test('v1.5 W1: a spool of wire in the Red Lion starts Wire the Town', () => {
  const g = fresh(); quiet(g); g.debugOpenAll(); g.pubDoorFixed = true; g.round = 6; g.errandsRoundStart(6);
  const t = g.triggers.find((o) => o.id === 'wire'); assert.ok(t && t.at === 'pub_spool');
  const sp = g.map.spots.pub_spool; assert.ok(g.inPub(sp.px, sp.py), 'inside the pub');
  const it = g.interactables().find((o) => o.id === 'trig:wire'); assert.match(it.describe().label, /Spool of wire/);
});
test('v1.5 E1: lighting the beacons pays more than the smaller herd costs', () => {
  const g = fresh(); quiet(g); g.round = 9; const s0 = g.scrap;
  g.errandReward({ effect: 'beacons' }, { def: ERRAND.beacons });
  const turned = Math.round(T.round.count(10) * T.specials.herdMult * 0.25);
  assert.ok(g.scrap - s0 >= turned * T.scrap.killMelee * 1.5, `${g.scrap - s0} for ${turned} turned away`);
});
test('v1.5 R8: Biscuit gets into a bolted Red Lion through the dog flap', () => {
  const g = fresh(); quiet(g); g.debugOpenAll(); g.pubDoorFixed = true; g.adoptBiscuit({ px: 0, py: 0 }); g.setPubShut(true, true);
  const b = g.biscuit, d = g.map.pub.door, home = g.map.spots.pub_bar; b.x = d.x; b.y = d.y + 40;
  for (let i = 0; i < 60 * 20 && !g.inPub(b.x, b.y); i++) g.dogMove(b, home.px, home.py, T.biscuit.speed, null);
  assert.ok(g.inPub(b.x, b.y), 'in'); assert.ok(g.pubShut, 'still bolted');
});
test('v1.5 B1: the town safe pays out 1,000 a go while you hold, all of it with Shift', () => {
  const g = fresh(); quiet(g); g.bank = 5000; const v = g.map.vault.find((o) => o.mode === 'withdraw');
  g.p.x = v.px; g.p.y = v.py + 12; g.p.fx = 0; g.p.fy = -1; const s0 = g.scrap;
  run(g, Math.ceil(T.bank.repeat * 60) + 2, { interact: true });
  assert.equal(g.bank, 4000); assert.equal(g.scrap - s0, 900);
  run(g, Math.ceil(T.bank.repeat * 60) * 2 + 4, { interact: true }); assert.equal(g.bank, 2000, 'kept going');
  run(g, 2); run(g, 60, { interact: true, shift: true }); assert.equal(g.bank, 0, 'shift takes the lot');
});
test('v1.5 L3/L4: in the last stand survivors take the engine roof, Biscuit joins when hurt, all board, one engine drives off', () => {
  const g = fresh(); quiet(g); g.debugOpenAll(); g.god = true; g.adoptBiscuit(g.map.spots.pub_bar); g.rescueDirect(0, 0); g.rescueDirect(0, 0);
  const E = g.escape; E.unlocked = true; E.stage = 'fit'; g.p.x = E.ex; g.p.y = E.ey + 30; g.startLastStand();
  assert.ok(g.survivors.every((s) => s.state === 'truck'));
  run(g, 60 * 40);
  assert.ok(g.survivors.every((s) => s.roof), 'on the roof');
  assert.ok(!g.friendlies().some((f) => f.kind === 'survivor'), 'out of reach up there');
  g.biscuit.hp = 10; run(g, 60 * 20); assert.ok(g.biscuit.onTruck, 'Biscuit jumped up');
  E.stage = 'drive'; g.escapeInteractables([]); const out = []; g.escapeInteractables(out); out.find((o) => o.id === 'esc:drive').describe().action();
  run(g, 60 * (T.escape.driveTime + T.escape.finalHold + 1));
  assert.equal(g.state, 'escaped');
  for (const r of g.truckRiders()) assert.ok(Math.abs(r.x - E.ex) < 40, 'rode along');
});
test('v1.5: Ellie\'s Bears runs bear, bear, bear, the peg next wave, the jukebox, and Ruth joins', () => {
  const g = fresh(); quiet(g); g.debugOpenAll(); g.round = 4;
  const bears = g.worldItems.filter((w) => w.kind === 'bear'); assert.equal(bears.length, 3);
  g.describeWorldItem(bears[0]).action(); assert.equal(g.bears.step, 1); assert.ok(g.objective(), 'arrow to the next bear');
  g.describeWorldItem(bears[1]).action(); g.describeWorldItem(bears[2]).action(); assert.equal(g.bears.step, 3);
  let it = g.interactables(); assert.ok(!it.some((o) => o.id === 'use:bears:peg'), 'not until next wave');
  g.round = 5; it = g.interactables(); it.find((o) => o.id === 'use:bears:peg').describe().action(); assert.equal(g.bears.step, 4);
  const n0 = g.survivors.length; g.interactables().find((o) => o.id === 'use:bears:juke').describe().action();
  assert.equal(g.bears.step, 5); assert.equal(g.survivors.length, n0 + 1); assert.equal(g.survivors.at(-1).name, 'Ruth Marsh');
  assert.equal(g.bearsLog().length, 5); assert.ok(g.bearsLog().every((s) => s.done));
});
test('B14: a trap kill pays more than a melee kill', () => {
  assert.ok(T.scrap.killTrap > T.scrap.killMelee);
  const g = fresh(); quiet(g); const e = place(g, 'walker', 100, 100, { hp: 1, maxHp: 1 });
  const s0 = g.scrap; g.kill(e, { kind: 'trap', trapId: 0 }); assert.equal(g.scrap - s0, T.scrap.killTrap);
});
test('B22: an armed trap with fewer than N enemies in its area does not fire', () => {
  const g = fresh(); quiet(g); g.power = true; g.scrap = 5000;
  const t = g.traps.find((x) => x.kind === 'fence'); g.armTrap(t, true);
  const mid = () => [(t.rect[0] + t.rect[2]) / 2, (t.rect[1] + t.rect[3]) / 2];
  for (let i = 0; i < T.traps.armN - 1; i++) { const [x, y] = mid(); place(g, 'walker', x + i * 3, y); }
  g.step(inp()); assert.equal(t.activeT, 0);
  const [x, y] = mid(); place(g, 'walker', x - 6, y); g.step(inp());
  assert.ok(t.activeT > 0); assert.equal(g.scrap, 5000 - t.cost + g.stats.earned);
});
test('B3: walkers ignore a downed Biscuit while the player stands nearby', () => {
  const g = fresh(); quiet(g); g.adoptBiscuit({ px: g.p.x + 20, py: g.p.y });
  const b = g.biscuit; b.down = true; b.downAt = -99;
  const e = place(g, 'walker', g.p.x + 20, g.p.y + 10);
  run(g, 120); assert.equal(b.downHits, 0); void e;
});

// ---------- v1.3 ----------
test('C5: holding attack charges a power attack that hits and knocks back walkers all round', () => {
  const g = fresh(); quiet(g); g.p.face = 6; g.p.fx = 0; g.p.fy = -1;
  const behind = place(g, 'walker', g.p.x, g.p.y + 14, { hp: 5000, maxHp: 5000 });
  const d0 = Math.hypot(behind.x - g.p.x, behind.y - g.p.y);
  run(g, 60, { attack: true });
  assert.ok(g.p.charge > 0, 'charging'); assert.ok(g.p.stam < 1, 'stamina drained');
  g.step(inp()); run(g, 10);
  assert.ok(behind.hp < behind.maxHp, 'the walker behind was hit');
  assert.ok(Math.hypot(behind.x - g.p.x, behind.y - g.p.y) > d0 + 15, 'and knocked back');
});
test('C5: shove spends stamina and needs enough of it', () => {
  const g = fresh(); quiet(g);
  g.step(inp({ shove: true })); assert.ok(Math.abs(g.p.stam - (1 - T.shove.stamina)) < 0.01);
  g.step(inp()); g.step(inp({ shove: true })); assert.ok(g.p.stam < T.shove.stamina, 'second shove refused');
});
test('C4: patching padding costs Scrap, not Parts', () => {
  const g = fresh(); quiet(g); g.p.padLayers = 1; g.p.pad[0] = 10; g.parts = 0; g.scrap = 1000;
  const b = g.benches().find((x) => x.padding);
  const opt = g.benchOptions(b).find((o) => o.label === 'Patch padding');
  assert.equal(opt.cost, T.padding.scrapRepair); assert.ok(!opt.partsCost);
});
test('v1.3: a snapshot taken at roundStart restores to that night', async () => {
  const { snapshot, restore } = await import('../src/sim/save.js');
  const g = fresh(); let snap = null;
  for (let i = 0; i < 60 * 120 && !snap; i++) { g.step(inp()); if (g.events.some((e) => e.type === 'roundStart')) snap = snapshot(g, { round: g.round }); g.events.length = 0; }
  assert.ok(snap, 'a night started');
  const { game: h, meta } = restore(snap, { hitStop: false });
  assert.equal(h.round, meta.round); run(h, 60); assert.ok(!h.p.dead);
});

// ---------- v1.4 ----------
test('E5: the booster defence is a fixed 18 raiders, never more than 8 alive, and killing them all answers the Signal', () => {
  const g = fresh(); quiet(g); g.debugOpenAll();
  g.signal.step = 6; g.signal.built = true; g.startBooster();
  let spawned = new Set(), maxAlive = 0;
  for (let i = 0; i < 60 * 400 && !g.signal.done; i++) {
    g.step(inp());
    const live = g.signalRaiders(); maxAlive = Math.max(maxAlive, live.length);
    for (const e of live) spawned.add(e.id);
    if (i % 90 === 0) for (const e of live) { e.hp = 1; g.damageEnemy(e, 10, { kind: 'trap', x: e.x, y: e.y, noScrap: true }); }
  }
  assert.ok(g.signal.done, 'signal answered');
  assert.equal(spawned.size, 18);
  assert.ok(maxAlive <= T.booster.maxAlive, `max alive ${maxAlive}`);
});
test('E5: a raider at the mast wrecks the booster; it has to be rebuilt', () => {
  const g = fresh(); quiet(g); g.debugOpenAll();
  g.signal.step = 6; g.signal.built = true; g.startBooster(); g.signal.def.nextT = 999;
  const sp = g.map.spots.school_mast; g.p.x = 20 * 16; g.p.y = 50 * 16; // far away
  g.raidDrops = [sp]; g.spawnRaiders(1, false, 'signal');
  run(g, 60 * 25);
  assert.equal(g.signal.holding, false); assert.equal(g.signal.built, false); assert.equal(g.signal.done, false);
});
test('E5: signal raiders ignore the Red Lion', () => {
  const g = fresh(); quiet(g); g.debugOpenAll(); g.safeHouse = true; g.parts = 10;
  g.signal.step = 6; g.signal.built = true; g.startBooster(); g.signal.def.nextT = 999;
  g.raidDrops = [g.map.spots.raid_5]; g.spawnRaiders(3, false, 'signal'); g.spawnRaiders(1, false); // even a normal raider waits
  run(g, 60 * 20);
  assert.equal(g.parts, 10);
  assert.ok(!g.enemies.some((e) => e.pubBound));
});
test('E4: raiders in the Red Lion steal slowly, cap at 5 items each, and a kill returns it all', () => {
  const g = fresh(); quiet(g); g.debugOpenAll(); g.safeHouse = true; g.parts = 10;
  g.p.x = 80 * 16; g.p.y = 12 * 16;
  const bar = g.map.spots.pub_bar; g.raidDrops = [bar];
  g.spawnRaiders(1, false); const e = g.enemies.find((o) => o.type === 'raider');
  e.x = e.ox = bar.px; e.y = e.oy = bar.py; e.hp = 1e6;
  run(g, 60 * 7); assert.equal(g.parts, 10, 'nothing taken in the first 8 s');
  run(g, 60 * 2); assert.equal(g.parts, 9, 'one Part after 8 s');
  run(g, 60 * 60); assert.equal(g.parts, 5, 'capped at 5 items');
  assert.ok(g.enemies.includes(e) && !e.fleeing, 'it stays while the wave is on');
  e.hp = 1; g.damageEnemy(e, 10, { kind: 'gun', x: e.x, y: e.y });
  assert.equal(g.parts, 10, 'all 5 Parts back');
});
test('E4: no raider in the pub, nothing taken', () => {
  const g = fresh(); quiet(g); g.debugOpenAll(); g.safeHouse = true; g.parts = 10;
  run(g, 60 * 30); assert.equal(g.parts, 10);
});
test('C1: Cain walks through a bin but a bullet stops on it; a car still blocks him', async () => {
  const { SOFT, PROP } = await import('../src/map/town.js');
  const g = fresh(); quiet(g);
  const bin = g.map.props.find((p) => p.kind === 'bin'), i = bin.y * g.W + bin.x;
  assert.equal(g.tiles[i], SOFT);
  g.p.x = bin.x * 16 + 8; g.p.y = (bin.y - 1) * 16 + 8; g.p.face = 2;
  run(g, 40, { down: true });
  assert.ok(g.p.y > bin.y * 16 + 8, 'walked over the bin');
  const w = g.rayWall(bin.x * 16 + 8, (bin.y - 2) * 16 + 8, 0, 1, 80);
  assert.ok(w.d < 40, 'the bullet stopped on it');
  const car = g.map.props.find((p) => p.kind === 'car'); assert.equal(g.tiles[car.y * g.W + car.x], PROP);
});
test('C3: the bus wreck is solid, sits beside a wider breach, and the route stays open', () => {
  const g = fresh(); quiet(g);
  const d = g.doors.find((o) => o.a === 1 && o.b === 3);
  g.openDoor(d); g.widenBreach(d); const bus = g.placeBus(d);
  assert.ok(bus, 'placed'); assert.ok(g.solid(bus.tx, bus.ty) && g.solid(bus.tx + 4, bus.ty + 1));
  assert.ok((d.breach || []).length >= 1, 'breach wider than a doorway');
  const f = new Uint16Array(g.W * g.H); bfs(g.W, g.H, g.walk, d.tiles[1][0], d.tiles[1][1], f, g.queue);
  const za = g.map.zones[1], zb = g.map.zones[3];
  assert.notEqual(f[Math.floor(za.cy / 16) * g.W + Math.floor(za.cx / 16) + 2], INF);
  assert.notEqual(f[Math.floor(zb.cy / 16) * g.W + Math.floor(zb.cx / 16)], INF);
});
test('C4: a torn-down Red Lion window can be walked through until it is boarded again', () => {
  const g = fresh(); quiet(g); g.safeHouse = true;
  const b = g.safeBars[0]; b.planks = 0; run(g, 2);
  assert.ok(!g.solid(b.tx, b.ty));
  b.planks = 1; g.p.x = 40 * 16; run(g, 2);
  assert.ok(g.solid(b.tx, b.ty));
});
test('C2: a walker wedged on a prop gets itself free', () => {
  const g = fresh(); quiet(g);
  const car = g.map.props.find((p) => p.kind === 'car' && !p.alarm && p.y > 40);
  g.p.x = (car.x + 1) * 16; g.p.y = (car.y + 3) * 16; // Cain on the far side of a car
  const e = place(g, 'walker', (car.x + 1) * 16, (car.y - 1) * 16 + 10, { hp: 200, maxHp: 200, speed: 40 });
  e.noticed = true; run(g, 60 * 8);
  assert.ok(Math.hypot(e.x - g.p.x, e.y - g.p.y) < 30, `still stuck at ${e.x},${e.y}`);
});
test('D1: a full charge holds until release; only running out of stamina fires it', () => {
  const g = fresh(); quiet(g);
  run(g, 90, { attack: true });
  assert.ok(g.p.chargeReady && g.p.charge >= 0, 'holding at full');
  run(g, 60, { attack: true }); assert.ok(g.p.charge >= 0, 'still holding a second later');
  run(g, 60 * 10, { attack: true }); assert.equal(g.p.charge, -1, 'stamina ran out and it fired');
});
test('D2: power damage scales 0.4x / 0.7x / 1.5x with charge and hits everything round Cain', () => {
  const hit = (c) => {
    const g = fresh(); quiet(g); g.p.slots[0] = g.makeWeapon('bat'); g.p.cur = 0;
    const es = []; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; es.push(place(g, 'walker', g.p.x + Math.cos(a) * 12, g.p.y + Math.sin(a) * 12)); }
    g.p.charge = c * T.power.chargeTime; g.powerAttack(g.p.slots[0]);
    return { n: es.filter((e) => e.hp < e.maxHp).length, dmg: es[0].maxHp - es[0].hp, base: g.meleeStats(g.p.slots[0]).dmg };
  };
  for (const [c, m] of [[0.2, 0.4], [0.5, 0.7], [1, 1.5]]) { const r = hit(c); assert.equal(r.n, 6); assert.ok(Math.abs(r.dmg - r.base * m) < 0.01, `c=${c}: ${r.dmg} vs ${r.base * m}`); }
});
test('D3: a pipe bomb pulls the dead in for 4 s (Brutes ignore it), even in rain, then explodes', () => {
  const g = fresh(); quiet(g); g.weather = 'rain';
  const w = place(g, 'walker', g.p.x + 300, g.p.y, { hp: 100, maxHp: 100 }); const b = place(g, 'brute', g.p.x - 300, g.p.y);
  g.p.throwable = { id: 'pipe', count: 1 }; g.p.face = 0; g.p.fx = 1; g.p.fy = 0;
  g.step(inp({ throw: true })); run(g, 40);
  assert.equal(w.lure && w.lure.kind, 'pipe'); assert.ok(!(b.lure && b.lure.kind === 'pipe'));
  assert.ok(g.bombs.length === 1);
  run(g, 60 * 4.2); assert.equal(g.bombs.length, 0, 'it went off');
});
test('D4: a walker blasted once, then killed by melee much later, still counts as an explosive kill', () => {
  const g = fresh(); quiet(g); g.round = 4;
  g.trial = { id: 'boom', n: 0, target: 99, until: 9, tier: 0 };
  g.p.face = 2; g.p.fx = 0; g.p.fy = 1;
  const e = place(g, 'walker', g.p.x, g.p.y + 12, { hp: 50, maxHp: 50 });
  g.damageEnemy(e, 1, { kind: 'explosion', x: e.x, y: e.y });
  g.t += 30; g.p.slots[0] = g.makeWeapon('bat'); g.p.cur = 0; // 30 s later
  g.step(inp({ attack: true })); run(g, 40);
  assert.ok(e.dead); assert.equal(g.trial.n, 1);
});
test('D6: a gun shot bends onto a raider 9° off the aim, but not one behind cover', () => {
  const g = fresh(); quiet(g); g.p.x = 40 * 16; g.p.y = 32 * 16; g.p.face = 0; g.p.fx = 1; g.p.fy = 0;
  const a = 9 * Math.PI / 180, r = place(g, 'raider', g.p.x + Math.cos(a) * 100, g.p.y + Math.sin(a) * 100); r.role = 'gunman';
  const ang = g.aimAngle(300); assert.ok(Math.abs(ang - Math.atan2(r.y - g.p.y, r.x - g.p.x)) < 0.6 * a, 'bent most of the way');
  const z = fresh(); quiet(z); z.p.x = 40 * 16; z.p.y = 32 * 16; z.p.fx = 1; z.p.fy = 0;
  place(z, 'walker', z.p.x + Math.cos(a) * 100, z.p.y + Math.sin(a) * 100);
  assert.equal(z.aimAngle(300), 0, 'zombies only get 5°');
});
test('D7: a raider pays 3x a walker kill', () => {
  const g = fresh(); quiet(g); const s0 = g.scrap;
  const r = place(g, 'raider', g.p.x + 40, g.p.y, { hp: 1, maxHp: 1 }); r.role = 'gunman';
  g.damageEnemy(r, 5, { kind: 'trap', x: r.x, y: r.y, noTrapScrap: true });
  assert.equal(g.scrap - s0, T.scrap.killThrow * 0 + T.scrap.killMelee * 3);
});
test('E1: a radio errand accepts itself and fails at the end of the next wave if its first step is untouched', () => {
  const g = fresh(); quiet(g); g.debugOpenAll(); g.round = 6;
  g.offerViaRadio(ERRAND.supplyDrop);
  const er = g.errandActive('supplyDrop'); assert.ok(er, 'accepted with no key');
  g.endRound = Object.getPrototypeOf(g).endRound; g.endRound(); assert.ok(g.errandActive('supplyDrop'), 'still on after wave 6');
  g.round = 7; g.state = 'active'; g.endRound(); assert.equal(g.errandActive('supplyDrop'), null, 'failed at the end of wave 7');
});
test('E2: Light the Beacons set on wave 7 fails at the end of wave 8, not on a clock', () => {
  const g = fresh(); quiet(g); g.debugOpenAll(); g.round = 7;
  g.acceptErrand('beacons'); run(g, 60 * 200);
  assert.ok(g.errandActive('beacons'), 'no seconds timer');
  g.endRound = Object.getPrototypeOf(g).endRound;
  g.endRound(); assert.ok(g.errandActive('beacons'));
  g.round = 8; g.endRound(); assert.equal(g.errandActive('beacons'), null);
});
test('E6: the Looter never takes from Cain, drops half when first hurt, and pays his haul on death', () => {
  const g = fresh(); quiet(g); g.debugOpenAll();
  const e = g.spawnAtBarricade('looter', g.pickBarricade(true));
  const s0 = g.scrap; run(g, 60 * 5); assert.equal(g.scrap, s0, 'nothing stolen');
  assert.ok(e.route && e.route.length >= 2);
  const haul = e.haul; g.damageEnemy(e, 1, { kind: 'gun', x: e.x, y: e.y, noHitScrap: true });
  assert.equal(e.haul, haul - Math.round(haul / 20) * 10);
  assert.ok(g.worldItems.some((w) => w.kind === 'scrap'));
  const s1 = g.scrap, left = e.haul; g.damageEnemy(e, 1e6, { kind: 'gun', x: e.x, y: e.y, noHitScrap: true });
  assert.equal(g.scrap - s1, T.scrap.killMelee * T.rewards.looterMult + left);
});
test('E7: kill the whole herd and get the bonus', () => {
  const g = fresh(); quiet(g); g.herdTotal = 2; g.herdKills = 0;
  const a = place(g, 'walker', g.p.x + 100, g.p.y, { hp: 1, maxHp: 1, herd: true }), b = place(g, 'walker', g.p.x + 120, g.p.y, { hp: 1, maxHp: 1, herd: true });
  for (const e of [a, b]) g.damageEnemy(e, 5, { kind: 'trap', x: e.x, y: e.y, noTrapScrap: true });
  const s0 = g.scrap; g.herdRoundEnd(); assert.equal(g.scrap - s0, T.specials.herdBonus);
});
test('E8: the wire stand point is at least 2 tiles from every trap switch, and arming is off while wiring', () => {
  const g = fresh(); quiet(g); g.debugOpenAll();
  for (const t of g.traps) { const s = g.wireSpot(t.id); assert.ok(Math.max(Math.abs(s.px - t.px), Math.abs(s.py - t.py)) >= 32, t.name); }
  g.acceptErrand('wire'); g.p.carry = { item: 'drum', hits: 0 };
  const info = g.describe({ kind: 'trap', obj: g.traps[0] }); assert.ok(info.disabled);
});
test('F3/F4: a gun with no free slot goes to the Red Lion stash; it never replaces what you hold', () => {
  const g = fresh(); quiet(g);
  assert.equal(g.p.slots[2].id, 'revolver'); assert.equal(g.p.slots[1], null);
  g.giveItem('shotgun'); assert.equal(g.p.slots[1].id, 'shotgun', 'Primary');
  g.giveItem('rifle'); assert.equal(g.p.slots[1].id, 'shotgun', 'still the shotgun'); assert.equal(g.stash[0].id, 'rifle');
  g.giveItem('pistol'); assert.equal(g.p.slots[2].id, 'revolver'); assert.equal(g.stash[1].id, 'pistol');
  g.stashTake(0); assert.equal(g.p.slots[1].id, 'rifle'); assert.ok(g.stash.some((w) => w.id === 'shotgun'), 'swapped');
});
test('F7: Pack Mule adds a slot, +50% ammo and a comfort slot', () => {
  const g = fresh(); quiet(g); const cap0 = g.comfortCap(), r0 = g.gunStats(g.p.slots[2]).reserve;
  g.buyComfort('mule');
  assert.equal(g.comfortCap(), cap0 + 1); assert.equal(g.gunStats(g.p.slots[2]).reserve, Math.round(r0 * 1.5));
  g.giveItem('shotgun'); g.giveItem('rifle'); assert.equal(g.p.slots[3].id, 'rifle'); assert.equal((g.stash || []).length, 0);
});
test('F6: Bandages never use a comfort slot', () => {
  const g = fresh(); quiet(g); g.buyComfort('bandages'); assert.equal(g.comfortCount(), 0);
});
test('F2: reinforcing a Red Lion window works from outside and costs 40% less', () => {
  const g = fresh(); quiet(g); g.power = true; g.safeHouse = true;
  const b = g.safeBars[0]; g.p.x = b.spawn.x; g.p.y = b.spawn.y; g.p.face = 0; g.p.fx = 1; g.p.fy = 0;
  const c = g.candidates().find((o) => o.kind === 'reinforce' && o.obj === b); assert.ok(c, 'offered outside');
  assert.equal(g.describe(c).cost, 750);
});
test('F1/F5: survivors bolt the door behind Cain, let him back in, and take a stash gun at the break', () => {
  const g = fresh(); quiet(g); g.debugOpenAll(); g.rescueDirect(0, 0);
  const d = g.map.pub.door, s = g.survivors[0];
  g.p.x = d.x; g.p.y = d.y - 20; run(g, 2); // inside
  g.p.x = d.x; g.p.y = d.y + 40; run(g, 2); assert.equal(g.pubShut, true, 'bolted behind him');
  g.p.y = d.y + 80; run(g, 2); g.p.y = d.y + 20; run(g, 2); assert.equal(g.pubShut, false, 'let back in');
  g.stash = [g.makeWeapon('revolver'), g.makeWeapon('shotgun')]; g.survivorsArm();
  assert.equal(s.weapon.id, 'shotgun', 'the best gun by damage per second');
});
test('B2: a quest object beats a barricade repair for F', () => {
  const g = fresh(); quiet(g);
  const b = g.barricades[0]; b.planks = 3; g.p.x = b.inside.x; g.p.y = b.inside.y; g.p.face = 6; g.p.fx = 0; g.p.fy = -1;
  g.addWorldItem({ item: 'weapon', kind: 'weapon', weapon: 'machete', cond: 1, x: g.p.x, y: g.p.y - 6 });
  g.triggers.push({ id: 'cellar', at: 'phonebox', until: 99, sound: 9 }); g.map.spots.phonebox = { px: g.p.x + 2, py: g.p.y - 8, zone: 1 };
  const c = g.candidates(); assert.equal(c[0].kind, 'x'); assert.ok(String(c[0].obj.id).startsWith('trig:'));
});
test('B4: in the cellars Left/Right include "Stay"; F on Stay climbs back out where you came in', () => {
  const g = fresh(); quiet(g); g.debugOpenAll();
  const h = g.hatches[0]; g.enterCellar(h); assert.ok(g.cellar);
  const n = g.cellar.dests.length; g.step(inp()); // keys are latched on the way in
  for (let i = 0; i < n; i++) { g.step(inp({ right: true })); g.step(inp()); }
  assert.equal(g.cellarDest(), null, 'Stay is selected');
  g.step(inp({ interact: true })); assert.equal(g.cellar, null);
});
test('G: Biscuit barely hurts, can trip a walker, and runs home below 15% HP', () => {
  const g = fresh(); quiet(g); g.debugOpenAll(); g.adoptBiscuit(g.map.spots.pub_in);
  const b = g.biscuit; b.x = g.p.x + 20; b.y = g.p.y;
  let tripped = false;
  for (let i = 0; i < 40 && !tripped; i++) { const e = place(g, 'walker', b.x + 5, b.y, { hp: 500, maxHp: 500 }); g.biscuitBite(e); assert.ok(e.maxHp - e.hp <= 10, 'near zero damage'); tripped = e.type === 'crawler'; g.enemies = []; }
  assert.ok(tripped, 'a trip in 40 bites');
  b.hp = b.maxHp * 0.1; run(g, 2); assert.equal(b.mode, 'retreat');
});
test('I: the end-of-run score adds up and the escape multiplier applies', () => {
  const g = fresh(); quiet(g); g.round = 10; g.stats.earned = 12345; g.errandDoneIds = { fuel: 2, cellar: 1 };
  const d = g.runScore('death');
  assert.equal(d.total, 12345 + 3 * 250 + 9 * 100);
  g.signal.done = true; const e = g.runScore('escaped');
  assert.equal(e.mult, 2.0); assert.equal(e.total, Math.round((12345 + 750 + 2 * 2000 + 10 * 100) * 2));
});
