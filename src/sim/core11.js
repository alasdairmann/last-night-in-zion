// v1.1 shared simulation pieces (ENHANCEMENT-PRD §5.3, §22): world items, carrying, radio lines, Parts,
// benches and the generic interactable list every v1.1 system plugs into. Mixed into Game.prototype.
import { T } from '../tuning.js';
import { ITEMS, MELEE, GUNS, CONDITIONS, PADDING, TRICKS, UPG_NAMES } from '../data.js';

const DT = T.dt;
const hyp = Math.hypot;

export const CoreMixin = {
  initV11() {
    this.parts = 0;
    this.pocket = {};                // small carried items: fuse, key, receiver, cards...
    this.worldItems = [];            // things lying in town: errand items, dropped carries, weapons, Parts, tapes, bears
    this.menuSel = {};               // Q/E selection per multi-option interactable
    this.lights = [];                // temporary light sources (flares, beacons, burning buildings)
    this.radioLog = [];
    this.spawnFocus = null;          // hold areas pull spawns toward them (§5.3)
    this.noAttack = false;
    this.capBonus = 0;
    this.v11 = { offerT: 0 };
    this.initErrands(); this.initSurvivors(); this.initCompanion(); this.initGear(); this.initNights();
    this.initRaiders(); this.initFoes(); this.initQuest(); this.initEscape(); this.initSafehouse();
  },

  updateV11(inp) {
    const p = this.p;
    for (const l of this.lights) l.t -= DT;
    if (this.lights.some((l) => l.t <= 0)) this.lights = this.lights.filter((l) => l.t > 0);
    this.updateWorldItems();
    if (this.attract) return;
    this.updateGear(inp);
    this.updateErrands(inp);
    this.updateSurvivors();
    this.updateCompanion(inp);
    this.updateNights();
    this.updateRaiders();
    this.updateFoes();
    this.updateQuest();
    this.updateEscape();
    this.updateSafehouse();
    if (p.carry && p.carry.ticking !== undefined) {
      p.carry.ticking -= DT;
      if (p.carry.ticking <= 0) { const it = p.carry.item; p.carry = null; this.explode(p.x, p.y, 300, 40, 'player'); this.errandItemLost(it); }
    }
  },

  // ---------- radio (§21.3: typed text with a blip per word) ----------
  radio(text, who = 'Hilltop') {
    if (this.attract) return;
    this.radioLog.push({ who, text, round: this.round });
    if (this.radioLog.length > 30) this.radioLog.shift();
    this.emit('radio', { who, text });
  },

  // ---------- v1.4 A1: notification cards (critical | objective | info). key dedupes and lets a sim system resolve it ----------
  card(o) { if (!this.attract) this.emit('card', { prio: 'info', ...o }); },
  resolveCard(key) { this.emit('cardResolve', { key }); },

  // ---------- Parts ----------
  addParts(n, x, y) {
    if (!n) return;
    this.parts = Math.min(T.parts.max, this.parts + n);
    this.emit('parts', { n, x: x ?? this.p.x, y: y ?? this.p.y });
  },
  dropPart(x, y, n = 1) { this.addWorldItem({ item: 'part', x, y, kind: 'part', auto: true, n }); },

  // ---------- world items ----------
  addWorldItem(o) {
    const wi = { id: 'w' + this.idSeq++, t: 0, ...o };
    this.worldItems.push(wi);
    this.emit('itemSpawn', { x: wi.x, y: wi.y, item: wi.item });
    return wi;
  },
  removeWorldItem(wi) { wi.done = true; },
  updateWorldItems() {
    const p = this.p;
    for (const wi of this.worldItems) {
      wi.t += DT;
      if (wi.life && wi.t >= wi.life) { wi.done = true; continue; }
      if (!wi.auto || p.dead || p.downed) continue;
      if (hyp(wi.x - p.x, wi.y - p.y) < T.finds.pickupRange + 2) this.takeWorldItem(wi);
    }
    if (this.worldItems.some((w) => w.done)) this.worldItems = this.worldItems.filter((w) => !w.done);
  },
  takeWorldItem(wi) {
    const p = this.p;
    if (wi.done) return;
    switch (wi.kind) {
      case 'part': wi.done = true; this.addParts(wi.n || 1, wi.x, wi.y); return;
      case 'scrap': wi.done = true; this.addScrap(wi.n, wi.x, wi.y - 10, true, null, true); return;
      case 'carry':
        if (this.isCarrying()) return;
        wi.done = true;
        if (wi.item === 'jerry') { p.jerry = true; this.selectMeleeForCarry(); }
        else { p.carry = { item: wi.item, heavy: !!wi.heavy, hits: 0, ticking: wi.ticking, errand: wi.errand }; this.selectMeleeForCarry(); if (wi.item === 'bomb') this.bark(null, true, 'That\'s not a parcel. G to throw it!'); }
        this.emit('pickupItem', { item: wi.item, x: wi.x, y: wi.y });
        return;
      case 'weapon':
        wi.done = true; this.giveItem(wi.weapon, wi.cond, true); this.emit('pickupItem', { item: wi.weapon, x: wi.x, y: wi.y }); return;
      default:
        wi.done = true;
        if (wi.on) this['take_' + wi.on](wi);
        else this.pocket[wi.item] = (this.pocket[wi.item] || 0) + 1;
        this.emit('pickupItem', { item: wi.item, x: wi.x, y: wi.y });
    }
  },

  // ---------- carrying (§5.3 Carry) ----------
  isCarrying() { return !!(this.p.jerry || this.p.carry); },
  carriedItem() { return this.p.jerry ? 'jerry' : this.p.carry ? this.p.carry.item : null; },
  selectMeleeForCarry() { const p = this.p; if (p.slots[p.cur] && p.slots[p.cur].kind === 'gun') this.selectSlot(0); p.reloadT = 0; },
  dropCarry(reason = 'drop') {
    const p = this.p; if (!this.isCarrying()) return;
    const x = p.x + p.fx * 6, y = p.y + p.fy * 6;
    if (p.jerry) { p.jerry = false; this.addWorldItem({ item: 'jerry', x, y, kind: 'carry', hold: true, shootable: true }); }
    else { const c = p.carry; p.carry = null; this.addWorldItem({ item: c.item, x, y, kind: 'carry', heavy: c.heavy, hold: true, ticking: c.ticking, errand: c.errand, shootable: c.item === 'bomb' }); }
    this.emit('dropItem', { x, y, reason });
    if (reason === 'hits') this.bark(null, true, 'Dropped it!');
  },
  carryHit() {
    const p = this.p; if (!this.isCarrying()) return;
    p.carryHits = (p.carryHits || 0) + 1;
    if (p.carryHits >= T.carry.dropAfterHits) { p.carryHits = 0; this.dropCarry('hits'); }
  },
  // shooting a dropped jerry can or ticking parcel sets it off (§6.1)
  shootItems(ox, oy, dx, dy, range) {
    for (const wi of this.worldItems) {
      if (!wi.shootable || wi.done) continue;
      const ex = wi.x - ox, ey = wi.y - oy, along = ex * dx + ey * dy;
      if (along < 0 || along > range) continue;
      if (Math.abs(ex * dy - ey * dx) > 5) continue;
      this.blowItem(wi);
    }
  },
  blowItem(wi) {
    if (wi.done) return;
    wi.done = true;
    this.explode(wi.x, wi.y, T.jerryBlast.dmg, T.jerryBlast.radius, 'player');
    this.fires.push({ x: wi.x, y: wi.y, r: 16, t: 4, dps: T.fire.dps, player: true });
    if (wi.errand) this.errandItemLost(wi.item);
  },

  // ---------- interactables ----------
  interactables() {
    const out = [];
    const p = this.p;
    for (const wi of this.worldItems) {
      if (wi.auto || wi.done) continue;
      out.push({ id: wi.id, x: wi.x, y: wi.y, describe: () => this.describeWorldItem(wi) });
    }
    this.benchInteractables(out);
    this.errandInteractables(out);
    this.survivorInteractables(out);
    this.companionInteractables(out);
    this.gearInteractables(out);
    this.questInteractables(out);
    this.escapeInteractables(out); this.bearsInteractables(out);
    this.nightsInteractables(out);
    this.safehouseInteractables(out);
    return out;
  },
  describeWorldItem(wi) {
    const p = this.p;
    const name = wi.label || ITEMS[wi.item] || wi.item;
    if (wi.kind === 'carry') {
      if (this.isCarrying()) return { label: `${cap(name)}: hands full`, cost: 0, disabled: true };
      return { label: `Pick up the ${name}`, cost: 0, holdTime: 0.3, action: () => this.takeWorldItem(wi), sub: wi.heavy ? 'Heavy: slow, no guns' : 'Carried: no guns. G drops it' };
    }
    if (wi.kind === 'weapon') {
      const def = MELEE[wi.weapon] || GUNS[wi.weapon];
      const c = CONDITIONS[wi.cond ?? 1];
      return { label: `Take ${c.name} ${def.name}`, cost: 0, holdTime: T.hold.take, action: () => this.takeWorldItem(wi), sub: this.replaceText(wi.weapon, true) };
    }
    if (wi.desc) return this['desc_' + wi.desc](wi);
    return { label: `Take the ${name}`, cost: wi.cost || 0, holdTime: wi.holdTime || 0.3, action: () => this.takeWorldItem(wi), sub: wi.sub || '' };
  },
  // which slot a weapon lands in, said plainly (v1.1 feedback: make slot replacement obvious)
  replaceText(id, found = false) {
    const p = this.p;
    if (found && MELEE[id] && p.slots[0]) return 'Melee slot full: send to pub inventory'; // v1.5 I2
    if (id.startsWith('t:')) { const cur = p.throwable; return `Pocket (G): replaces ${cur.count ? cur.id === 'brick' ? 'your bricks' : 'your ' + cur.id : 'nothing'}`; }
    if (MELEE[id]) return p.slots[0] ? `Melee slot 1: replaces ${this.weaponLabel(p.slots[0])}` : 'Melee slot 1';
    const s = this.gunSlotFor(id), cls = this.gunClass(id) === 'primary' ? 'Primary' : 'Secondary';
    return s === null ? `${cls} slot full: send to pub inventory` : `${s === 3 ? 'Pack Mule' : cls} slot ${s + 1} (empty)`;
  },
  // v1.2 B6: replacing an upgraded or better-condition weapon needs a 1 s hold and an amber warning
  swapHold(id, cond = 1) {
    if (id.startsWith('t:')) return null;
    const p = this.p, old = MELEE[id] ? p.slots[0] : null; // v1.4 F3: a gun never replaces what you hold
    if (!old || !((old.tier || 0) >= 1 || (old.cond ?? 1) > cond)) return null;
    return { holdTime: T.swapHold, sub: `Replaces your ${this.weaponLabel(old)}${old.tier ? ` (Tier ${old.tier})` : ` (${CONDITIONS[old.cond ?? 1].name})`}` };
  },
  weaponLabel(w) { const d = MELEE[w.id] || GUNS[w.id]; return w.tier > 0 ? UPG_NAMES[w.id][w.tier - 1] : d.name; },

  // ---------- benches (§11, §13, §12, §19, v1.0 §18) ----------
  benches() {
    const S = this.map.spots;
    // v1.2 B16: one bench per job. Garage: weapons and builds. Fire station: padding. Builders' yard: your Trick
    return [{ id: 'bench:yard', spot: S.bench_yard, zone: 8, tricks: true, name: 'Yard bench', does: 'Trick upgrades' }, { id: 'bench:fire', spot: S.bench_fire, zone: 3, padding: true, name: 'Fire station bench', does: 'Padding and patches (Parts)' }, { id: 'bench:garage', spot: S.bench_garage, zone: 4, weapons: true, name: 'Garage bench', does: 'Weapon condition and builds (Parts)' }];
  },
  benchInteractables(out) {
    for (const b of this.benches()) {
      if (!this.openZones.has(b.zone)) continue;
      out.push({ id: b.id, x: b.spot.px, y: b.spot.py - 8, menu: true, describe: () => this.benchOptions(b) });
    }
  },
  benchOptions(b) {
    const p = this.p, opts = [];
    const D = (label, sub = '') => ({ label, cost: 0, disabled: true, sub });
    // Padding (§11)
    if (b.padding) {
      const n = p.padLayers;
      if (n < T.padding.layers) {
        const locked = n === 1 && this.round < T.padding.unlockRound2 ? `Unlocks on wave ${T.padding.unlockRound2}` : n === 2 && !this.everPowered ? 'Needs the generator started once' : null;
        if (locked) opts.push(D(`${PADDING[n].name}: locked`, locked));
        else opts.push({ label: `Padding: ${PADDING[n].name}`, cost: T.padding.costs[n], holdTime: T.hold.comfort, action: () => this.buyPadding(), sub: `Layer ${n + 1}: soaks 75% of damage. Repairs all layers` });
      }
    }
    if (b.padding && p.padLayers > 0 && p.pad.some((v, i) => i < p.padLayers && v < T.padding.pointsPerLayer)) opts.push({ label: 'Patch padding', cost: T.padding.scrapRepair, holdTime: 0.5, action: () => this.patchPadding(), repeat: true, sub: `+${T.padding.partRepair} to the most worn layer. Hold to keep patching` }); // v1.5 H1
    // Condition (§13.2)
    const w = this.curWeapon();
    if (b.weapons && w && !p.lastChance && w.id !== 'blowtorch') {
      const c = w.cond ?? 1;
      if (c < 4) opts.push({ label: `Improve ${this.weaponLabel(w)} to ${CONDITIONS[c + 1].name}`, cost: 0, partsCost: T.condition.partCosts[c], holdTime: 0.8, action: () => this.improveCondition(w), sub: `${CONDITIONS[c].name} > ${CONDITIONS[c + 1].name}: ${Math.round(T.condition.damage[c + 1] * 100)}% damage` });
    }
    // Trick upgrade (§12.3)
    if (b.tricks && this.trick.id && !this.trick.up) {
      if (!this.power) opts.push(D(`Upgrade ${TRICKS[this.trick.id].name}: needs power`));
      else opts.push({ label: `Upgrade ${TRICKS[this.trick.id].name}`, cost: T.tricks.upgradeCost, holdTime: 1, action: () => { this.trick.up = true; this.emit('banner', { text: `${TRICKS[this.trick.id].name.toUpperCase()} UPGRADED`, sub: TRICKS[this.trick.id].up }); }, sub: TRICKS[this.trick.id].up });
    }
    if (b.weapons) this.questBenchOptions(opts);
    if (!opts.length) opts.push(D(b.name, b.does));
    return opts;
  },

  // ---------- objective (the green arrow, §5.7) ----------
  // v1.2 B13: roof ladders that an errand step needs right now (gold arrow, ground marker, minimap dot)
  roofMarks() {
    const L = ['church_ladder', 'fire_ladder', 'school_mast'], out = [];
    for (const er of this.errands) {
      const st = this.curStep(er); if (!st) continue;
      const names = st.type === 'use' ? [st.at] : st.type === 'activate' ? st.spots.filter((n) => !er.s.lit[n]) : [];
      for (const n of names) if (L.includes(n)) { const s = this.spot(n); if (s) out.push({ x: s.px, y: s.py, name: n }); }
    }
    return out;
  },
  // ---------- v1.4 I: the end-of-run score ----------
  runScore(outcome) {
    const S = T.score, st = this.stats;
    const tasks = Object.values(this.errandDoneIds || {}).reduce((a, b) => a + b, 0);
    const stories = [this.signal && this.signal.done && 'The Signal', outcome === 'escaped' && 'The fire engine', this.torch && this.torch.built && 'The Blowtorch'].filter(Boolean);
    const waves = outcome === 'escaped' ? this.round : Math.max(0, this.round - 1);
    const alive = this.survivors.filter((s) => !s.dead && s.state === 'home').length;
    const lines = [
      { label: 'Scrap earned', n: st.earned, each: S.scrap },
      { label: 'Tasks and errands completed', n: tasks, each: S.task },
      { label: `Storylines completed${stories.length ? ` (${stories.join(', ')})` : ''}`, n: stories.length, each: S.story },
      { label: 'Waves survived', n: waves, each: S.wave },
      { label: 'Survivors alive at the end', n: alive, each: S.survivor },
    ].map((l) => ({ ...l, pts: l.n * l.each }));
    const sub = lines.reduce((a, l) => a + l.pts, 0);
    const mult = outcome === 'escaped' ? (this.signal && this.signal.done ? S.signalEscape : S.engineEscape) : S.death;
    const why = outcome === 'escaped' ? (this.signal && this.signal.done ? 'Escaped, with the Signal answered' : 'Escaped in the fire engine') : 'Fell in Zion';
    return { lines, sub, mult, why, total: Math.round(sub * mult) };
  },
  objective() {
    const e = this.errandObjective(); if (e) return e;
    // v1.4 A4: no automatic pointer to the fire engine; pin it from Notes if you want one
    const h = this.cellarTask(); if (h) return h;
    return this.bearObjective(); // v1.5: Ellie's Bears
  },
};

export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
