// v1.2 (PRD-v1.2.md §B): the Red Lion as a real safehouse (a door Cain can bolt; windows the dead and Raiders
// must tear through, slowly) and nine cellar hatches that link the town's cellars, one per zone.
import { T } from '../tuning.js';
import { FLOOR, PROP, BAR } from '../map/town.js';

const DT = T.dt;
const hyp = Math.hypot;
// one hatch per zone; [zone, tileX, tileY, name]. Snapped to the nearest floor tile of that zone at start.
const HATCHES = [
  [5, 6, 49, 'THE RED LION CELLAR'], [1, 47, 35, 'TOWN SQUARE'], [2, 44, 57, 'POST OFFICE'], [3, 16, 33, 'FIRE STATION'],
  [4, 70, 32, 'GARAGE'], [6, 14, 16, 'ST MARY\'S'], [7, 50, 16, 'SCHOOL FIELD'], [8, 76, 14, 'BUILDERS\' YARD'], [9, 80, 56, 'HUNT & TACKLE'],
];

export const SafehouseMixin = {
  initSafehouse() {
    this.pubShut = false; this.hatchCD = 0; this.pubWasSealed = false;
    this.pubDoorFixed = false; this.cellar = null; this.cellarStage = 0; // the Red Lion's door starts broken and jammed shut
    const m = this.map, W = this.W;
    this.hatches = HATCHES.map(([zone, x, y, name], id) => {
      let best = null, bd = Infinity;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const tx = x + dx, ty = y + dy, i = ty * W + tx;
        if (m.tiles[i] !== FLOOR || m.zoneId[i] !== zone) continue;
        if (zone === 5 && !this.inPub(tx * 16 + 8, ty * 16 + 8) && id === 0) continue;
        const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [tx, ty]; }
      }
      const [tx, ty] = best || [x, y];
      return { id, zone, name, tx, ty, x: tx * 16 + 8, y: ty * 16 + 8, fixed: false };
    });
    this.tiles[this.pubDoorIdx()] = PROP; this.refreshWalk();
  },
  // v1.2 B24: zones within n door-hops of the Red Lion's zone
  zoneHops(a, b) {
    if (a === b) return 0;
    const seen = new Map([[a, 0]]), q = [a];
    while (q.length) { const z = q.shift(), d = seen.get(z); for (const o of this.doors) { const n = o.a === z ? o.b : o.b === z ? o.a : null; if (n == null || seen.has(n)) continue; if (n === b) return d + 1; seen.set(n, d + 1); q.push(n); } }
    return 99;
  },
  pubRaidAllowed() { return this.pubLootOn() && (this.pubShut || this.zoneHops(this.zoneAt(this.p.x, this.p.y), 5) <= T.pubRaid.hops); }, // v1.4 E5: never during the booster defence
  pubDoorIdx() { const d = this.map.pub.door; return Math.floor(d.y / 16) * this.W + Math.floor(d.x / 16); },
  setPubShut(shut, quiet = false) {
    this.pubShut = shut;
    if (shut) this.safeHouse = true; // its windows become barricades you keep up
    this.tiles[this.pubDoorIdx()] = shut || !this.pubDoorFixed ? PROP : FLOOR;
    this.refreshWalk();
    const d = this.map.pub.door;
    this.emit(shut ? 'pubShut' : 'pubOpen', { x: d.x, y: d.y });
    if (shut && !quiet) {
      const boarded = this.safeBars.every((b) => b.planks > 0);
      this.emit('banner', { text: 'THE RED LION IS BOLTED', sub: boarded ? 'Nothing gets in without tearing a window down' : 'Board the windows too, or they will climb in' });
    }
  },
  // sealed: door bolted. Windows still have to be torn down (slowly) before anything gets in.
  pubSealed() { return this.pubShut; },
  pubBreached() { return this.safeBars.some((b) => b.planks <= 0); },
  playerInSealedPub() { return this.pubShut && this.inPub(this.p.x, this.p.y); },
  // walkers chasing Cain into a sealed pub go for the windows instead of milling at the walls
  besieging(e) { return this.playerInSealedPub() && !e.inPub && !this.inPub(e.x, e.y) && e.state === 'inside'; },
  // Raiders: break in through a window if the pub is sealed and they want in. Returns true while busy.
  raiderBreach(e, force = false) {
    if ((!this.pubShut && !force) || e.inPub || this.inPub(e.x, e.y)) return false;
    const w = this.safeBars.slice().sort((a, b) => a.planks - b.planks || hyp(a.spawn.x - e.x, a.spawn.y - e.y) - hyp(b.spawn.x - e.x, b.spawn.y - e.y))[0];
    if (!w) return false;
    if (hyp(w.spawn.x - e.x, w.spawn.y - e.y) > 10) { this.raiderMove(e, w.spawn.x, w.spawn.y, e.speed); return true; }
    e.fx = w.ix; e.fy = w.iy;
    if (w.planks > 0) {
      e.breachT = (e.breachT || 0) + DT;
      if (e.breachT >= T.pubSafe.raiderTear) { e.breachT = 0; w.planks--; w.lastTear = this.t; this.emit('plankTear', { x: w.x, y: w.y, id: w.id, ix: w.ix, iy: w.iy }); if (w.planks === 0) this.emit('banner', { text: 'RAIDERS ARE BREAKING INTO THE RED LION', sub: 'A window is down', danger: true }); }
      return true;
    }
    e.x = e.ox = w.inside.x; e.y = e.oy = w.inside.y; e.inPub = true; this.emit('climbIn', { x: e.x, y: e.y });
    return true;
  },
  // the dead close by (inside the fences): the door and the hatches won't work with them on you
  zedsNear(x, y, r) { return this.enemies.some((e) => !e.dead && e.state === 'inside' && hyp(e.x - x, e.y - y) < r); },
  fixPubDoor() {
    this.pubDoorFixed = true; this.tiles[this.pubDoorIdx()] = FLOOR; this.refreshWalk();
    const d = this.map.pub.door; this.emit('pubOpen', { x: d.x, y: d.y });
    this.emit('banner', { text: 'THE RED LION DOOR IS FIXED', sub: 'Go in and fix the cellar hatch' });
  },
  fixHatch(h) {
    h.fixed = true; this.emit('hatch', { x: h.x, y: h.y });
    if (h.zone === 5) this.emit('banner', { text: 'THE RED LION CELLAR IS OPEN', sub: `Now fix the hatch in ${this.firstHatch()?.name || 'another open zone'}` });
    else this.emit('banner', { text: `CELLAR HATCH FIXED: ${h.name}`, sub: 'Drop through any fixed hatch to travel the cellars' });
  },
  hatchUsable(h) { return h.fixed && this.openZones.has(h.zone) && (h.zone !== 5 || this.pubDoorFixed); },
  // the first zone you opened (other than the pub's) with a hatch still to fix: the second task in the chain
  firstHatch() { for (const z of this.openZones) { if (z === 5) continue; const h = this.hatches.find((o) => o.zone === z && !o.fixed); if (h) return h; } return null; },
  // the cellar-door task chain: fix the Red Lion door, its cellar hatch, then the first open zone's hatch
  cellarTask() {
    const d = this.map.pub.door, pubH = this.hatches[0];
    if (!this.openZones.has(5)) return null;
    if (!this.pubDoorFixed) return { stage: 1, x: d.x, y: d.y, text: 'Fix the Red Lion door' };
    if (!pubH.fixed) return { stage: 2, x: pubH.x, y: pubH.y, text: 'Fix the Red Lion cellar hatch' };
    if (this.hatches.some((h) => h.fixed && h.zone !== 5)) return null;
    const h = this.firstHatch(); return h ? { stage: 3, x: h.x, y: h.y, text: `Fix the cellar hatch: ${h.name}` } : null;
  },
  // ---------- the cellar network (v1.4 B4): Left / Right pick an exit or "Stay" (the camera goes to look), F goes, Esc stays. Up/Down do nothing ----------
  enterCellar(from) {
    const dests = this.hatches.filter((o) => o !== from && this.hatchUsable(o));
    if (!dests.length) return;
    this.cellar = { from, dests: dests.map((o) => o.id), idx: 0, edge: { left: true, right: true, interact: true, attack: true } };
    this.p.walking = false; this.prompt = null;
    this.emit('smoke', { x: this.p.x, y: this.p.y }); this.emit('hatch', { x: from.x, y: from.y });
  },
  cellarDest() { const c = this.cellar; return c && c.idx < c.dests.length ? this.hatches[c.dests[c.idx]] : null; }, // idx === dests.length is "Stay"
  exitCellar() { const c = this.cellar; if (!c) return; this.cellar = null; this.hatchCD = T.hatch.cooldown; this.holdPrev = true; this.emit('hatch', { x: c.from.x, y: c.from.y }); },
  updateCellar(inp) {
    const c = this.cellar, p = this.p;
    p.invuln = Math.max(p.invuln, 0.2); this.prompt = null; this.hold.key = null;
    const tap = (k) => { const on = !!inp[k], fresh = on && !c.edge[k]; c.edge[k] = on; return fresh; };
    const n = c.dests.length + 1;
    if (tap('left') || inp.prev) { c.idx = (c.idx - 1 + n) % n; this.emit('choice', {}); }
    if (tap('right') || inp.next) { c.idx = (c.idx + 1) % n; this.emit('choice', {}); }
    const go = tap('interact') | tap('attack');
    if (p.downed || p.dead || (go && c.idx === c.dests.length)) { this.exitCellar(); return; }
    if (go) {
      const to = this.cellarDest();
      if (!this.hatchUsable(to)) { this.emit('fail'); return; }
      if (this.zedsNear(to.x, to.y, T.hatch.clearR)) { this.emit('fail'); this.emit('banner', { text: 'SOMETHING IS MOVING UP THERE', sub: 'Pick another hatch, or wait', danger: true }); return; }
      this.cellar = null; this.holdPrev = true; this.useHatch(c.from, to);
    }
  },
  updateSafehouse() {
    if (this.hatchCD > 0) this.hatchCD -= DT;
    this.updateBrokenWindows();
    const task = this.cellarTask(), st = task ? task.stage : 0;
    if (st && st !== this.cellarStage) this.emit('banner', { prio: 'objective', key: 'task.cellar' + st, text: 'NEW TASK', sub: task.text, pin: { x: task.x, y: task.y } });
    this.cellarStage = st;
    const p = this.p;
    // resting: bolted in, every window boarded, nothing inside with you
    const sealed = this.playerInSealedPub() && !this.pubBreached() && !this.enemies.some((e) => !e.dead && this.inPub(e.x, e.y));
    if (sealed && !this.pubWasSealed) this.emit('banner', { text: 'SAFE, FOR NOW', sub: 'You heal fast in here. Hold the windows' });
    this.pubWasSealed = sealed;
    if (sealed && !p.downed && !p.dead && p.hp < p.maxHp && this.t - p.lastDmg >= T.pubSafe.regenDelay) p.hp = Math.min(p.maxHp, p.hp + T.player.regenRate * (T.pubSafe.regenMult - 1) * DT);
  },
  // v1.4 C4: a Red Lion window torn down to nothing is rubble you can walk through, until it's boarded again
  updateBrokenWindows() {
    let changed = false;
    for (const b of this.safeBars) {
      const i = b.ty * this.W + b.tx, want = b.planks <= 0 ? FLOOR : BAR;
      if (this.tiles[i] === want) continue;
      if (want === BAR && [this.p, ...this.enemies.filter((e) => !e.dead), ...this.friendlies()].some((o) => Math.abs(o.x - (b.tx * 16 + 8)) < 8 + (o.r || 4) && Math.abs(o.y - (b.ty * 16 + 8)) < 8 + (o.r || 4))) continue; // wait until the gap is clear
      this.tiles[i] = want; changed = true;
    }
    if (changed) this.refreshWalk();
  },
  safehouseInteractables(out) {
    const p = this.p, d = this.map.pub.door;
    if (this.openZones.has(5)) {
      out.push({ id: 'pubdoor', x: d.x, y: d.y, range: 26, describe: () => {
        if (!this.pubDoorFixed) return { label: 'Fix the Red Lion door', cost: T.pubSafe.fix, holdTime: T.pubSafe.fixHold, action: () => this.fixPubDoor(), sub: 'Opens the pub, and the cellar under it' };
        // v1.5 R4: no proximity block. Bolt it in their faces
        if (this.pubShut) return { label: 'Unbolt the Red Lion door', cost: 0, holdTime: T.pubSafe.hold, action: () => { this.setPubShut(false); this.boltRearmed = false; }, sub: 'Opens the way in and out' };
        const blocked = [p, ...this.enemies.filter((e) => !e.dead), ...this.friendlies()].some((o) => hyp(o.x - d.x, o.y - d.y) < 12);
        if (blocked) return { label: 'Bolt the door: something is in the way', cost: 0, disabled: true };
        return { label: 'Bolt the Red Lion door', cost: 0, holdTime: T.pubSafe.hold, action: () => { this.setPubShut(true); this.boltRearmed = false; }, sub: 'Raiders and the dead must tear a window down to get in' };
      } });
    }
    // v1.4 F3: the stash behind the bar
    if (this.openZones.has(5) && this.pubDoorFixed && (this.stash.length || this.survivors.some((s) => s.weapon || s.melee))) {
      const b = this.map.spots.pub_bar;
      out.push({ id: 'stash', x: b.px, y: b.py, range: 20, describe: () => ({ label: 'The armoury (pub inventory)', cost: 0, holdTime: 0.3, action: () => this.emit('stash', {}), sub: `${this.stash.length} weapon${this.stash.length === 1 ? '' : 's'} stored. Swap with what you carry` }) });
    }
    if (this.switchboardOn() && this.openZones.has(5)) {
      const sb = this.switchboardSpot();
      out.push({ id: 'switchboard', x: sb.x, y: sb.y, range: 20, describe: () => ({ label: 'The switchboard', cost: 0, holdTime: 0.3, action: () => this.emit('switchboard', {}), sub: 'Arm wired traps; fire the bell, light, alarm' }) });
    }
    for (const h of this.hatches) {
      if (!this.openZones.has(h.zone) || (h.zone === 5 && !this.pubDoorFixed)) continue;
      out.push({ id: 'hatch' + h.id, x: h.x, y: h.y, range: T.hatch.range, describe: () => {
        if (!h.fixed) {
          if (h.zone !== 5 && !this.hatches[0].fixed) return { label: 'Broken hatch: fix the Red Lion\'s first', cost: 0, disabled: true };
          return { label: `Fix the cellar hatch: ${h.name}`, cost: h.zone === 5 ? T.hatch.fixPub : T.hatch.fix, holdTime: T.hatch.fixHold, action: () => this.fixHatch(h), sub: h.zone === 5 ? 'The hub of the old cellars' : 'Links it to the cellars' };
        }
        if (!this.hatches.some((o) => o !== h && this.hatchUsable(o))) return { label: 'Cellar hatch: fix another hatch to use it', cost: 0, disabled: true };
        if (this.hatchCD > 0) return { label: 'Cellar hatch: catching your breath', cost: 0, disabled: true };
        if (p.jerry || (p.carry && p.carry.heavy)) return { label: 'Cellar hatch: hands too full for the ladder', cost: 0, disabled: true };
        if (this.zedsNear(h.x, h.y, T.hatch.clearR)) return { label: 'Cellar hatch: too many of the dead nearby', cost: 0, disabled: true };
        return { label: 'Cellar', cost: 0, holdTime: T.hatch.hold, action: () => this.enterCellar(h), sub: 'Left / Right pick where you come out. F goes. Esc stays' };
      } });
    }
  },
  // ---------- v1.2 B21: the switchboard behind the bar ----------
  switchboardSpot() { return { x: 13 * 16 + 8, y: 49 * 16 + 8 }; },
  switchboardOn() { return Object.keys(this.wired || {}).length > 0; },
  alarmCar() { return this.cars.find((c) => c.rearm) || null; },
  // what the switchboard shows: wired traps (armed / off), the bell and searchlight, the car park alarm
  switchboardRows() {
    const rows = this.traps.map((t) => ({ id: 't' + t.id, name: t.name, kind: t.kind, x: t.px, y: t.py, wired: !!this.wired[t.id], armable: this.armable(t), armed: !!t.armed,
      status: !this.power ? 'no power' : t.activeT > 0 ? 'firing' : t.cd > 0 ? `cooling ${Math.ceil(t.cd)}s` : t.armed ? 'armed' : this.armable(t) ? 'off' : 'ready', cost: t.cost }));
    const c = this.alarmCar();
    if (c) rows.push({ id: 'car', name: 'Car alarm (pub car park)', kind: 'car', x: c.x, y: c.y, wired: true, armable: false, armed: !c.used, status: c.used ? 'used this wave' : 'ready', cost: 0 });
    return rows;
  },
  switchToggle(id) {
    const t = this.traps[+id.slice(1)]; if (!t || !this.wired[t.id] || !this.armable(t)) return false;
    this.armTrap(t, !t.armed); return true;
  },
  // fire the bell, the searchlight or the alarm from the pub. Same price as at the switch
  switchFire(id) {
    if (id === 'car') { const c = this.alarmCar(); if (!c || c.used) return false; this.triggerCar(c); return true; }
    const t = this.traps[+id.slice(1)];
    if (!t || !this.wired[t.id] || this.armable(t) || t.activeT > 0 || t.cd > 0) return false;
    if (!this.power && !(t.kind === 'searchlight' && this.searchlightFixed)) return false;
    if (!this.canAfford(t.cost)) { this.emit('fail'); return false; }
    this.spend(t.cost); this.activateTrap(t); return true;
  },
  useHatch(from, to) {
    const p = this.p;
    this.emit('smoke', { x: p.x, y: p.y }); this.emit('hatch', { x: from.x, y: from.y });
    p.x = p.ox = to.x; p.y = p.oy = to.y + 2; p.invuln = Math.max(p.invuln, T.hatch.invuln);
    this.hatchCD = T.hatch.cooldown;
    this.fieldTile = -1;
    this.emit('teleport', { x: p.x, y: p.y, hatch: to.id });
  },
};
