// v1.1 gear (ENHANCEMENT-PRD §11 Padding, §12 Tricks, §13 Condition, §14 Keepsakes). Mixed into Game.prototype.
import { T } from '../tuning.js';
import { COMFORTS, CONDITIONS, GUN_MODS, MELEE_MODS, KEEPSAKES, TRICKS, PADDING, GUNS, MELEE } from '../data.js';

const DT = T.dt;
const hyp = Math.hypot;

export const GearMixin = {
  initGear() {
    const p = this.p;
    p.padLayers = 0; p.pad = [0, 0, 0];
    this.trick = { id: null, charge: 0, up: false };
    this.smokes = []; this.flags = [];
    this.timedV = { mist: 0, polaroid: 0, soldier: 0 };
    this.xPending = 0;
    const ids = this.rng.shuffle(Object.keys(KEEPSAKES).slice());
    this.keepsake = { pool: ids.slice(0, T.keepsakes.poolSize), buys: 0, resetRound: 1, boughtRound: -1, held: null };
    this.luckyPenny = false; this.ringArmed = false; this.watchUntil = 0; this.ticketUntil = 0; this.lighter = 0; this.crossword = false;
    this.soldierShotT = 0; this.polaroidAcc = 0;
  },
  setTrick(id) { this.trick = { id, charge: 0, up: false }; },
  trickNeed() { return this.trick.id ? T.tricks.charge[this.trick.id] : 1; },
  trickReady() { return !!this.trick.id && this.trick.charge >= this.trickNeed(); },
  addTrickCharge(k) {
    if (!this.trick.id) return;
    const was = this.trickReady();
    this.trick.charge = Math.min(this.trickNeed(), this.trick.charge + k);
    if (!was && this.trickReady()) this.emit('trickReady', {});
  },

  updateGear(inp) {
    const p = this.p;
    // X: trick, or a quick double tap for a held keepsake (§14.2)
    if (inp.trick && !p.dead) {
      if (this.keepsake.held && !p.downed) {
        if (this.xPending > 0) { this.xPending = 0; this.useKeepsake(); }
        else this.xPending = T.keepsakes.doubleTap;
      } else this.tryTrick();
    }
    if (this.xPending > 0) { this.xPending -= DT; if (this.xPending <= 0) { this.xPending = 0; this.tryTrick(); } }
    for (const k of Object.keys(this.timedV)) if (this.timedV[k] > 0) { this.timedV[k] = Math.max(0, this.timedV[k] - DT); if (!this.timedV[k]) this.emit('findEnd', { type: k }); }
    for (const s of this.smokes) s.t -= DT;
    if (this.smokes.some((s) => s.t <= 0)) this.smokes = this.smokes.filter((s) => s.t > 0);
    for (const f of this.flags) {
      f.t -= DT;
      if (f.up && !p.dead && hyp(p.x - f.x, p.y - f.y) < T.tricks.stand.radius) p.hp = Math.min(p.maxHp, p.hp + 5 * DT);
    }
    if (this.flags.some((f) => f.t <= 0)) this.flags = this.flags.filter((f) => f.t > 0);
    // Toy Soldier: a rifleman on the rooftops (§14.3)
    if (this.timedV.soldier > 0) {
      this.soldierShotT -= DT;
      if (this.soldierShotT <= 0) {
        this.soldierShotT = 1;
        let best = null, bd = 260;
        for (const e of this.enemies) { if (e.dead || e.ally > 0 || e.state !== 'inside') continue; const d = hyp(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; } }
        if (best) {
          const sx = p.x - 60, sy = p.y - 120;
          this.emit('soldierShot', { x1: sx, y1: sy, x2: best.x, y2: best.y - 8 });
          this.damageEnemy(best, 300, { kind: 'gun', x: sx, y: sy, noHitScrap: true, head: true });
        }
      }
    }
  },
  inSmoke(x, y) { for (const s of this.smokes) if (hyp(x - s.x, y - s.y) < s.r) return true; return false; },
  standReduce() {
    const p = this.p;
    for (const f of this.flags) if (hyp(p.x - f.x, p.y - f.y) < T.tricks.stand.radius) return f.up ? 0.75 : T.tricks.stand.reduce;
    return 0;
  },
  nearFlag() { const p = this.p; return this.flags.some((f) => hyp(p.x - f.x, p.y - f.y) < T.tricks.stand.radius); },

  tryTrick() {
    const p = this.p;
    if (!this.trick.id || p.dead || p.downed) return;
    if (!this.trickReady()) { this.emit('fail'); return; }
    this.trick.charge = 0;
    const id = this.trick.id, up = this.trick.up, TT = T.tricks;
    switch (id) {
      case 'flare': {
        for (const e of this.enemies) if (!e.dead && e.type !== 'raider' && hyp(e.x - p.x, e.y - p.y) < TT.flare.radius) {
          e.blindT = TT.flare.blind; e.atk = 0; e.lure = null;
          if (up && !e.burn) { e.burn = { t: T.fire.burnTime, dps: T.fire.dps }; this.emit('ignite', { x: e.x, y: e.y }); }
        }
        this.lights.push({ x: p.x, y: p.y, r: TT.flare.radius, t: TT.flare.light });
        break;
      }
      case 'mist': this.timedV.mist = up ? 12 : TT.mist.time; break;
      case 'smoke': this.smokes.push({ x: p.x, y: p.y, r: TT.smoke.radius * (up ? 2 : 1), t: up ? 10 : TT.smoke.time, max: up ? 10 : TT.smoke.time }); for (const e of this.enemies) if (!e.dead && hyp(e.x - p.x, e.y - p.y) < 60) e.noticed = false; break;
      case 'whistle': {
        const x = p.x + p.fx * TT.whistle.dist, y = p.y + p.fy * TT.whistle.dist;
        const l = this.addLure(x, y, TT.whistle.radius, up ? 9 : TT.whistle.time, 'whistle'); l.stagger = up;
        for (const e of this.enemies) if (!e.dead && e.state === 'inside' && e.type !== 'dog' && hyp(e.x - x, e.y - y) <= l.r) { e.lure = l; e.noticed = false; }
        break;
      }
      case 'stand': this.flags.push({ x: p.x, y: p.y, t: TT.stand.time, up }); break;
    }
    this.emit('trick', { id, x: p.x, y: p.y, fx: p.fx, fy: p.fy });
  },

  // ---------- Padding (§11) ----------
  buyPadding() {
    const p = this.p;
    p.padLayers = Math.min(T.padding.layers, p.padLayers + 1);
    for (let i = 0; i < p.padLayers; i++) p.pad[i] = T.padding.pointsPerLayer;
    p.busyT = T.comforts.drinkTime * 0.6;
    this.emit('padding', { layers: p.padLayers });
    this.emit('banner', { text: PADDING[p.padLayers - 1].name.toUpperCase(), sub: `Padding layer ${p.padLayers}` });
  },
  patchPadding(points = T.padding.partRepair) {
    const p = this.p; let best = -1, lo = Infinity;
    for (let i = 0; i < p.padLayers; i++) if (p.pad[i] < lo) { lo = p.pad[i]; best = i; }
    if (best < 0) return;
    p.pad[best] = Math.min(T.padding.pointsPerLayer, p.pad[best] + points);
    this.emit('padRepair', {});
  },
  repairPaddingLayer() { const p = this.p; for (let i = 0; i < p.padLayers; i++) if (p.pad[i] < T.padding.pointsPerLayer) { p.pad[i] = T.padding.pointsPerLayer; this.emit('padRepair', {}); return; } },
  // returns the damage that reaches health: each layer soaks 75% of what it handles until empty, then the next (§11.2)
  absorbPadding(dmg) {
    const p = this.p, A = T.padding.absorb; let left = dmg, toHealth = 0, hit = false;
    for (let i = p.padLayers - 1; i >= 0 && left > 0; i--) {
      if (p.pad[i] <= 0) continue;
      const handled = Math.min(left, p.pad[i] / A);
      p.pad[i] -= handled * A; toHealth += handled * (1 - A); left -= handled; hit = true;
      if (p.pad[i] <= 1e-6) { p.pad[i] = 0; this.emit('padBreak', { x: p.x, y: p.y }); }
    }
    if (hit) this.emit('padHit', {});
    return toHealth + left;
  },

  // ---------- Condition (§13) ----------
  condMult(w) { return 1 + T.condition.damage[w.cond ?? 1]; },
  rollCondition(pool = null) {
    if (pool === 'master') return this.rng.next() < 0.5 ? 3 : 4;
    const odds = T.condition.crateOdds.map((o, i) => [i, o]);
    return this.rng.weighted(odds);
  },
  rollMods(w) {
    const want = (w.cond ?? 1) >= 4 ? 2 : (w.cond ?? 1) >= 3 ? 1 : 0;
    const pool = Object.keys(w.kind === 'melee' ? MELEE_MODS : GUN_MODS).filter((m) => !w.mods.includes(m));
    while (w.mods.length < want && pool.length) w.mods.push(pool.splice(Math.floor(this.rng.next() * pool.length), 1)[0]);
  },
  hasMod(w, m) { return !!(w && w.mods && w.mods.includes(m)); },
  improveCondition(w) {
    w.cond = Math.min(4, (w.cond ?? 1) + 1);
    this.rollMods(w);
    if (w.kind === 'melee' && Number.isFinite(w.dur)) w.dur = this.maxDur(w);
    this.emit('condUp', { cond: w.cond });
    this.emit('banner', { text: `${CONDITIONS[w.cond].name.toUpperCase()} ${this.weaponLabel(w).toUpperCase()}`, sub: w.mods.length ? w.mods.map((m) => (GUN_MODS[m] || MELEE_MODS[m]).name).join(' + ') : `${Math.round(T.condition.damage[w.cond] * 100)}% damage` });
  },
  modNames(w) { return (w.mods || []).map((m) => (GUN_MODS[m] || MELEE_MODS[m]).name); },

  // ---------- Keepsakes (§14) ----------
  keepsakePrice() {
    const k = this.keepsake;
    if (this.round - k.resetRound >= T.keepsakes.resetEvery) { k.resetRound = this.round; k.buys = 0; }
    return T.keepsakes.costs[Math.min(k.buys, T.keepsakes.costs.length - 1)];
  },
  gearInteractables(out) {
    if (!this.safeHouse && !this.openZones.has(5)) return;
    const s = this.map.spots.jukebox;
    out.push({ id: 'jukebox', x: s.px, y: s.py - 10, describe: () => {
      if (!this.power && !this.infinite) return { label: 'Jukebox: needs power', cost: 0, disabled: true };
      if (this.keepsake.boughtRound === this.round && !this.infinite) return { label: 'Jukebox: one keepsake a wave', cost: 0, disabled: true };
      return { label: 'Jukebox: a keepsake', cost: this.keepsakePrice(), holdTime: T.hold.comfort, action: () => this.buyKeepsake(), sub: 'Plays a song; something drops out of the change slot' };
    } });
  },
  buyKeepsake() {
    const k = this.keepsake; k.buys++; k.boughtRound = this.round;
    const id = this.rng.pick(k.pool);
    this.emit('jukebox', { id });
    this.giveKeepsake(id);
  },
  giveKeepsake(id) {
    const def = KEEPSAKES[id];
    if (def.held) { this.keepsake.held = id; this.emit('banner', { text: def.name.toUpperCase(), sub: 'Kept: double-tap X to use it', help: true }); return; }
    this.emit('banner', { text: def.name.toUpperCase(), sub: def.desc, help: true });
    this.applyKeepsake(id);
  },
  useKeepsake() {
    const id = this.keepsake.held; if (!id) return;
    this.keepsake.held = null;
    this.emit('banner', { text: KEEPSAKES[id].name.toUpperCase(), sub: KEEPSAKES[id].desc });
    this.applyKeepsake(id);
  },
  applyKeepsake(id) {
    const p = this.p;
    switch (id) {
      case 'penny': this.luckyPenny = true; break;
      case 'ring': this.ringArmed = true; break;
      case 'watch': this.watchUntil = this.round + 2; break;
      case 'keys': this.teleportSafe(); break;
      case 'rosary': this.spawnFind(p.x + p.fx * 14, p.y + p.fy * 14, 'adrenaline', true, true); break;
      case 'polaroid': this.timedV.polaroid = 60; this.polaroidAcc = 0; break;
      case 'soldier': this.timedV.soldier = 30; this.soldierShotT = 0.5; break;
      case 'harmonica': for (const e of this.enemies) if (!e.dead && hyp(e.x - p.x, e.y - p.y) < 200) { e.swayT = 5; e.atk = 0; } break;
      case 'lighter': this.lighter = 10; break;
      case 'crossword': this.crossword = true; break;
      case 'photo': {
        const opts = Object.keys(COMFORTS).filter((c) => !this.hasComfort(c));
        if (opts.length && this.comfortCount() < this.comfortCap()) this.buyComfort(this.rng.pick(opts));
        else this.addScrap(1000, p.x, p.y - 20, true, null, true);
        break;
      }
      case 'dogtag': this.capBonus++; break;
      case 'ticket': this.ticketUntil = this.round + 2; break;
      case 'tin': if (this.biscuit && !this.biscuit.dead) { const b = this.biscuit; b.hp = b.maxHp; b.down = false; b.boostUntil = this.round + 1; } else this.addParts(5); break;
    }
    this.emit('keepsake', { id });
  },
  teleportSafe() {
    const p = this.p;
    for (let k = 0; k < 200; k++) {
      const tx = this.rng.int(3, this.W - 4), ty = this.rng.int(3, this.H - 4);
      if (this.solid(tx, ty) || !this.openZones.has(this.map.zoneId[ty * this.W + tx])) continue;
      const x = tx * 16 + 8, y = ty * 16 + 8;
      if (this.field[ty * this.W + tx] === 65535) continue;
      if (this.enemies.some((e) => !e.dead && hyp(e.x - x, e.y - y) < 120)) continue;
      this.emit('smoke', { x: p.x, y: p.y });
      p.x = p.ox = x; p.y = p.oy = y; p.invuln = 1;
      this.emit('teleport', { x, y });
      return;
    }
  },
  polaroidScrap(amt) {
    if (this.timedV.polaroid <= 0) return;
    const w = this.p.slots[this.p.cur]; if (!w || w.kind !== 'gun' || w.id === 'blowtorch') return;
    this.polaroidAcc += amt;
    while (this.polaroidAcc >= 10) { this.polaroidAcc -= 10; const st = this.gunStats(w); if (w.mag < st.mag) w.mag++; else w.reserve = Math.min(st.reserve, w.reserve + 1); }
  },
};

export { TRICKS, PADDING, GUNS, MELEE };
