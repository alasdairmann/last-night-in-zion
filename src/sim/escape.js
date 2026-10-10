// Escape: the fire engine (ENHANCEMENT-PRD §7). Steps 1-4 in any order, fit, call it in, hold for the last stand, drive.
import { T } from '../tuning.js';
import { RADIO } from '../data.js';
import { nextStep } from '../nav.js';

const DT = T.dt;
const hyp = Math.hypot;
const CHIEF_ZONES = [3, 5, 6];

export const EscapeMixin = {
  initEscape() {
    this.escape = { unlocked: false, stage: 'locked', battery: false, tyre: false, diesel: 0, keys: false, fitted: { battery: false, tyre: false, fuel: false },
      chiefOut: false, standT: 0, standLen: T.escape.lastStand, bruteSent: false, driveT: 0, ex: this.map.engine.px, ey: this.map.engine.py, spawnT: 0, toSpawn: 0, started: 0 };
  },
  escapeRoundStart(r) {
    const E = this.escape;
    if (!E.unlocked && r >= T.escape.unlockRound && this.everPowered && !this.attract) {
      E.unlocked = true; E.stage = 'parts';
      this.radio(RADIO.escape);
      this.emit('banner', { prio: 'objective', key: 'escape.unlock', pin: { x: this.map.spots.engine.px, y: this.map.spots.engine.py }, text: 'THE FIRE ENGINE', sub: 'Battery, tyre, diesel, keys. Get it running and you can leave Zion' });
      this.emit('escapeUnlocked', {});
    }
    if (E.unlocked && !E.keys && !E.chiefOut && E.stage === 'parts') this.spawnChief();
  },
  spawnChief() {
    const E = this.escape;
    const bars = this.barricades.filter((b) => CHIEF_ZONES.includes(b.zone) && this.openZones.has(b.zone));
    const b = bars.length ? this.rng.pick(bars) : this.pickBarricade();
    const e = this.spawnAtBarricade('armoured', b);
    e.mark = 'chief'; e.extra = true; e.hp *= T.escape.chiefHp; e.maxHp = e.hp; e.armour *= 2; e.armourMax = e.armour; e.outfit = 8;
    E.chiefOut = true;
    this.emit('banner', { text: 'THE FIRE CHIEF IS OUT THERE', sub: 'White helmet. He has the engine keys', danger: true });
  },
  chiefAI(e) {
    const p = this.p;
    if (e.noticed || hyp(p.x - e.x, p.y - e.y) < 90) return false;
    if (!e.wander || hyp(e.wander.x - e.x, e.wander.y - e.y) < 10 || (e.wanderT = (e.wanderT || 0) + DT) > 20) {
      e.wanderT = 0;
      const zs = CHIEF_ZONES.filter((z) => this.openZones.has(z)); const z = this.map.zones[zs.length ? this.rng.pick(zs) : 1];
      for (let k = 0; k < 20; k++) { const tx = this.rng.int(z.x0 + 1, z.x1 - 1), ty = this.rng.int(z.y0 + 1, z.y1 - 1); if (!this.solid(tx, ty)) { e.wander = { x: tx * 16 + 8, y: ty * 16 + 8 }; break; } }
    }
    if (!e.wander) return false;
    const f = this.lureField({ id: 'C' + Math.floor(e.wander.x / 16) + ',' + Math.floor(e.wander.y / 16), x: e.wander.x, y: e.wander.y });
    const s = nextStep(this.W, this.H, this.walk, f, Math.floor(e.x / 16), Math.floor(e.y / 16));
    let mx = e.wander.x - e.x, my = e.wander.y - e.y; if (s) { mx = s.x - e.x; my = s.y - e.y; }
    const md = hyp(mx, my); if (md < 0.3) return true;
    e.fx = mx / md; e.fy = my / md; e.moving = true;
    this.moveCircle(e, e.fx * Math.min(md, e.speed * 0.6 * DT), e.fy * Math.min(md, e.speed * 0.6 * DT), e.r);
    return true;
  },
  escapeKill(e) {
    if (e.mark !== 'chief') return;
    const E = this.escape; E.chiefOut = false;
    this.addWorldItem({ item: 'keys', x: e.x, y: e.y, kind: 'pickup', auto: true, glow: true, on: 'keys' });
  },
  take_keys() { this.escape.keys = true; this.emit('banner', { prio: 'objective', key: 'escape.keys', text: 'THE ENGINE KEYS', sub: 'On a fire brigade fob' }); this.escapeCheck();
  },
  escapeCheck() {
    const E = this.escape;
    if (E.stage === 'parts' && E.battery && E.tyre && E.diesel >= 2 && E.keys) { E.stage = 'fit'; this.emit('banner', { prio: 'objective', key: 'escape.fit', pin: { x: this.map.spots.engine.px, y: this.map.spots.engine.py }, text: 'EVERYTHING IS AT THE ENGINE', sub: 'Fit it all. They will hear you' }); }
  },
  fitBurst() {
    const bars = this.barricades.filter((b) => this.openZones.has(b.zone)).sort((a, b) => hyp(a.x - this.escape.ex, a.y - this.escape.ey) - hyp(b.x - this.escape.ex, b.y - this.escape.ey));
    for (let i = 0; i < T.escape.fitBurst; i++) this.spawnAtBarricade(this.rollBasic(), bars[i % Math.min(3, bars.length)]);
    this.emit('engineCough', { x: this.escape.ex, y: this.escape.ey });
  },
  updateEscape() {
    const E = this.escape, p = this.p;
    if (E.stage === 'parts' && E.chiefOut && !this.enemies.some((e) => !e.dead && e.mark === 'chief') && !this.worldItems.some((w) => w.item === 'keys')) E.chiefOut = false;
    if (E.stage === 'stand') {
      if (this.zoneAt(p.x, p.y) === 3 && !p.dead) E.standT += DT;
      if (!E.bruteSent && E.standT >= Math.min(T.escape.bruteAt, E.standLen / 2)) { E.bruteSent = true; this.pending.push({ t: 1, type: 'brute', counted: true, bar: this.pickBarricade(true) }); this.emit('bruteWarn', { x: p.x, y: p.y }); }
      if (E.standT >= E.standLen) { E.stage = 'drive'; this.emit('engineStart', { x: E.ex, y: E.ey }); this.emit('banner', { prio: 'critical', key: 'escape.drive', pin: { x: this.map.spots.engine_cab.px, y: this.map.spots.engine_cab.py }, text: 'THE ENGINE IS RUNNING', sub: 'Get in the cab!' }); }
    }
    if (E.stage === 'gone') {
      E.driveT += DT;
      const k = Math.min(1, E.driveT / T.escape.driveTime);
      const pts = [[this.map.engine.px, this.map.engine.py], [this.map.engine.px, 32 * 16 + 8], [-60, 32 * 16 + 8]];
      const seg = k < 0.2 ? 0 : 1, kk = seg === 0 ? k / 0.2 : (k - 0.2) / 0.8;
      const a = pts[seg], b = pts[seg + 1];
      E.ex = a[0] + (b[0] - a[0]) * kk; E.ey = a[1] + (b[1] - a[1]) * kk;
      p.ox = p.x; p.oy = p.y; p.x = E.ex; p.y = E.ey;
      for (const e of this.enemies) if (!e.dead && hyp(e.x - E.ex, e.y - E.ey) < 26) { this.knock(e, 30, E.ex, E.ey); e.stagger = 1; this.damageEnemy(e, 200, { kind: 'explosion', x: E.ex, y: E.ey, noScrap: true }); }
      if (k >= 1 && !E.done) { E.done = true; this.state = 'escaped'; this.emit('escaped', { round: this.round }); }
    }
  },
  escapeInteractables(out) {
    const E = this.escape, sp = this.map.spots, p = this.p;
    if (!E.unlocked || E.stage === 'gone') return;
    const eng = sp.engine;
    if (E.stage === 'parts') {
      if (!E.battery && this.openZones.has(4)) out.push({ id: 'esc:battery', x: sp.towtruck.px, y: sp.towtruck.py, cancelOnHit: true, describe: () => ({ label: 'Take the tow truck\'s battery', cost: 0, holdTime: 2, action: () => { E.battery = true; this.emit('pickupItem', { item: 'battery' }); this.escapeCheck(); }, sub: 'Escape: battery' }) });
      if (!E.tyre && !this.isCarrying() && this.openZones.has(4)) out.push({ id: 'esc:tyre', x: sp.tyres.px, y: sp.tyres.py, describe: () => ({ label: 'Take a tyre', cost: 0, holdTime: 0.5, action: () => { p.carry = { item: 'tyre', heavy: true, hits: 0 }; this.selectMeleeForCarry(); }, sub: 'Heavy: 70% speed, no guns' }) });
      if (this.carriedItem() === 'tyre') out.push({ id: 'esc:tyreIn', x: eng.px, y: eng.py, range: 30, describe: () => ({ label: 'Leave the tyre by the engine', cost: 0, holdTime: 0.4, action: () => { p.carry = null; E.tyre = true; this.escapeCheck(); }, sub: 'Escape: tyre' }) });
      if (p.jerry && E.diesel < 2) out.push({ id: 'esc:diesel', x: eng.px, y: eng.py, range: 30, describe: () => ({ label: `Pour diesel into the engine (${E.diesel + 1}/2)`, cost: 0, holdTime: 1, action: () => { p.jerry = false; E.diesel++; this.escapeCheck(); }, sub: 'Escape: diesel' }) });
    }
    if (E.stage === 'fit') {
      const next = ['battery', 'tyre', 'fuel'].find((k) => !E.fitted[k]);
      if (next) out.push({ id: 'esc:fit', x: eng.px, y: eng.py, range: 30, cancelOnHit: true, describe: () => ({ label: { battery: 'Fit the battery', tyre: 'Fit the tyre', fuel: 'Prime the fuel line' }[next], cost: 0, holdTime: T.escape.fitHold, action: () => { E.fitted[next] = true; this.fitBurst(); }, sub: 'It will make a racket' }) });
      else out.push({ id: 'esc:call', x: eng.px, y: eng.py, range: 30, describe: () => ({ label: 'Call it in on the engine radio', cost: 0, holdTime: 1, action: () => this.startLastStand(), sub: 'There\'s no going back after this' }) });
    }
    if (E.stage === 'drive') out.push({ id: 'esc:drive', x: sp.engine_cab.px, y: sp.engine_cab.py, range: 30, describe: () => ({ label: 'DRIVE', cost: 0, holdTime: 1, action: () => { this.resolveCard('escape.drive'); E.stage = 'gone'; E.driveT = 0; p.invuln = 99; p.inEngine = true; this.emit('drive', {}); }, sub: 'Get out of Zion' }) });
  },
  startLastStand() {
    const E = this.escape;
    E.stage = 'stand'; E.standT = 0; E.standLen = this.signal.done ? T.escape.lastStandSignal : T.escape.lastStand; E.started = this.t;
    this.state = 'laststand'; this.toSpawn = 0; this.dogsToSpawn = 0;
    E.toSpawn = Math.round(Math.max(1, this.round) * T.escape.herdMult); E.spawnT = 0;
    this.radio(E.standLen === 45 ? 'Forty-five seconds. Hold on.' : RADIO.callIn);
    this.emit('banner', { prio: 'objective', key: 'escape.stand', text: 'THE LAST STAND', sub: `Hold the fire station for ${E.standLen} s`, danger: true });
    this.emit('lastStand', {});
  },
  // spawning while the round counter is stopped (§7.3 step 7)
  updateLastStand() {
    const E = this.escape;
    if (E.stage !== 'stand' && E.stage !== 'drive') return;
    E.spawnT -= DT;
    const cap = T.round.activeCap(this.round) + 8;
    if (E.spawnT <= 0 && this.countAlive() < cap) {
      E.spawnT = T.round.spawnInterval(this.round) / T.escape.spawnRateMult;
      const open = this.barricades.filter((b) => this.openZones.has(b.zone));
      this.spawnAtBarricade(this.rollType(), this.rng.pick(open));
      if (E.toSpawn > 0) E.toSpawn--;
    }
    for (const q of this.pending) { q.t -= DT; if (q.t <= 0) { q.done = true; this.spawnPending(q); } }
    if (this.pending.some((q) => q.done)) this.pending = this.pending.filter((q) => !q.done);
  },
  escapeObjective() {
    const E = this.escape, sp = this.map.spots;
    if (!E.unlocked) return null;
    const at = (s) => ({ x: s.px, y: s.py });
    if (E.stage === 'parts') {
      if (this.carriedItem() === 'tyre' || (this.p.jerry && E.diesel < 2)) return at(sp.engine);
      return null;
    }
    if (E.stage === 'fit' || E.stage === 'stand') return at(sp.engine);
    if (E.stage === 'drive') return at(sp.engine_cab);
    return null;
  },
  escapeLog() {
    const E = this.escape;
    if (!E.unlocked) return null;
    return [
      { text: 'Battery from the tow truck (garage)', done: E.battery },
      { text: 'A tyre from the stack (garage), carried', done: E.tyre },
      { text: `Diesel: two jerry cans poured in (${E.diesel}/2)`, done: E.diesel >= 2 },
      { text: 'Keys from the Fire Chief (white helmet)', done: E.keys },
      { text: 'Fit everything at the engine', done: ['stand', 'drive', 'gone'].includes(E.stage) },
      { text: 'Call it in, then hold the fire station', done: E.stage === 'drive' || E.stage === 'gone' },
      { text: 'Drive', done: E.stage === 'gone' },
    ];
  },
};
