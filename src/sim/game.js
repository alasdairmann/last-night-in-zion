// Pure simulation (PRD §27.3). No DOM, canvas or audio. Deterministic given a seed and an input log.
// Emits events into `this.events` that rendering, audio and UI consume.
import { T } from '../tuning.js';
import { RNG } from '../rng.js';
import { MELEE, GUNS, THROWS, COMFORTS, FINDS, FIND_TYPES, EFFECTS, UPG_NAMES, CRATE_WEIGHTS, BARKS, CONDITIONS, TRAP_INFO } from '../data.js';
import { buildMap, FLOOR, BAR, PROP, SOFT, WALL, STREETS, W as MW, H as MH } from '../map/town.js';
import { bfs, nextStep, INF } from '../nav.js';
import { CoreMixin } from './core11.js';
import { ErrandMixin } from './errands.js';
import { SurvivorMixin } from './survivors.js';
import { CompanionMixin } from './companion.js';
import { GearMixin } from './gear.js';
import { NightsMixin } from './nights.js';
import { RaiderMixin } from './raiders.js';
import { FoesMixin } from './foes.js';
import { QuestMixin } from './quest.js';
import { EscapeMixin } from './escape.js';
import { SafehouseMixin } from './safehouse.js';

const DT = T.dt;
const TS = T.tile;
export const DIRS = [[1, 0], [Math.SQRT1_2, Math.SQRT1_2], [0, 1], [-Math.SQRT1_2, Math.SQRT1_2], [-1, 0], [-Math.SQRT1_2, -Math.SQRT1_2], [0, -1], [Math.SQRT1_2, -Math.SQRT1_2]];
export const dirIndex = (x, y) => Math.round(Math.atan2(y, x) / (Math.PI / 4)) & 7;
const hyp = Math.hypot;
// piecewise-linear lookup in a [[x, y], ...] table (v1.4 D2)
export function curve(pts, x) { if (x <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); } return pts[pts.length - 1][1]; }
const SPECIAL = { dog: 1, brute: 1, looter: 1, butcher: 1, screamer: 1, raider: 1 };
const BIG = { brute: 1, butcher: 1 };
// v1.4 F4: Primary (rifles, shotguns, the heavy stuff) and Secondary (pistols, SMGs) gun slots
export const PRIMARY = new Set(['rifle', 'ar', 'shotgun', 'dbarrel', 'crossbow', 'bow', 'blowtorch', 'nailgun']);
const LOOTER_CACHES = ['hardware_a', 'hardware_b', 'garage_a', 'garage_b', 'pharmacy_back', 'school_care', 'yard_a', 'yard_c', 'shed', 'church_porch', 'phonebox', 'staffroom', 'fire_locker']; // v1.4 E6

export function emptyInput() {
  return { up: false, down: false, left: false, right: false, attack: false, shift: false, interact: false, map: false,
    prev: false, next: false, wheel: 0, slot: 0, reload: false, throw: false, shove: false, trick: false, dog: false };
}

export function weaponName(w) {
  if (!w) return '';
  const base = (MELEE[w.id] || GUNS[w.id]).name;
  return w.tier > 0 ? UPG_NAMES[w.id][w.tier - 1] : base;
}
export function itemName(id) {
  if (id === 'closed') return 'CLOSED';
  if (id.startsWith('t:')) { const t = THROWS[id.slice(2)]; return `${t.name} x${t.max}`; }
  return (MELEE[id] || GUNS[id]).name;
}

export class Game {
  constructor(opts = {}) {
    this.seed = opts.seed ?? 1;
    this.opts = { hitStop: true, attract: false, ...opts };
    this.attract = this.opts.attract;
    this.rng = new RNG(this.seed);
    this.map = buildMap();
    this.W = MW; this.H = MH;
    this.tiles = this.map.tiles.slice();
    this.walk = new Uint8Array(MW * MH);
    this.field = new Uint16Array(MW * MH);
    this.queue = new Int32Array(MW * MH);
    this.refreshWalk();
    this.fieldTile = -1; this.fieldAge = 99;
    this.lureFields = new Map();
    this.events = [];
    this.t = 0; this.tick = 0; this.hitstop = 0;
    this.scrap = T.scrap.start;
    this.round = 0; this.state = 'pre'; this.breakT = T.round.firstDelay;
    this.openZones = new Set([1]);
    this.doors = this.map.doors.map((d) => ({ ...d }));
    this.barricades = this.map.barricades.map((b) => ({ ...b, planks: T.barricade.planks, lastTear: -99 }));
    this.crates = this.map.crateSpots.map((s, i) => ({ ...s, idx: i, active: i === 0, state: 'idle', t: 0, item: null, price: 0, beam: 0 }));
    this.crateIdx = 0; this.cratePulls = 0; this.pullsThisStop = 0; this.crateMoveAt = this.rng.int(...T.crate.movePulls); this.nailPity = 0;
    this.workshop = { ...this.map.workshop, state: 'idle', t: 0, w: null, slot: 0, options: null, choice: 0 };
    this.power = false; this.fuel = 0; this.everPowered = false;
    this.bank = 0; this.debt = 0; this.bountyPending = false; this.freeComfortGiven = false;
    this.traps = this.map.traps.map((t, i) => ({ ...t, id: i, activeT: 0, cd: 0, hitSet: null, beam: 0 }));
    this.barrels = this.map.barrels.map((b, i) => ({ ...b, id: i, alive: true, fuse: -1 }));
    this.cars = this.map.props.filter((p) => p.kind === 'car' && p.alarm).map((p, i) => ({ id: i, x: (p.x + 1) * TS, y: p.y * TS + 8, tx: p.x, ty: p.y, w: p.w, used: false, t: 0 }));
    { const park = this.cars.filter((c) => this.map.zoneId[c.ty * MW + c.tx] === 5).sort((a, b) => b.ty - a.ty || a.tx - b.tx)[0]; if (park) park.rearm = true; } // v1.2 B23
    this.comfortLocks = {};
    this.bandagesStock = T.comforts.bandagesUses;
    this.secondWindBuys = 0;
    this.ammoCrateUsed = false;
    this.enemies = []; this.projectiles = []; this.thrown = []; this.bombs = []; this.fires = []; this.gas = [];
    this.lures = []; this.finds = []; this.bolts = []; this.pending = []; this.timers = [];
    this.timed = { adrenaline: 0, double: 0, sale: 0, guts: 0, bait: 0 };
    this.findBag = []; this.lastFind = null; this.roundFinds = 0; this.killsSinceFind = 0; this.rushLeft = 0;
    this.noise = 0; this.noiseIdle = 0;
    this.streak = { count: 0, last: -99, mult: 0 };
    this.plankScrap = 0;
    this.toSpawn = 0; this.spawnT = 0; this.roundKills = 0;
    this.dogRound = false; this.dogRoundCount = 0; this.nextDogRound = this.rng.int(...T.dog.first); this.dogsToSpawn = 0; this.dogSpawnT = 0;
    this.nextBrute = T.brute.first; this.bruteCount = 0; this.firstBruteKilled = false;
    this.lastLooterRound = -99;
    this.fog = false; this.lastFog = false; this.herd = null;
    this.director = { high: 0, low: 0, delayLeft: 0, pressure: 0 };
    this.recentDmg = [];
    this.lastBarkT = -99; this.lastBark = {};
    this.stats = { kills: 0, meleeKills: 0, heads: 0, crits: 0, earned: 0, spent: 0, doors: 0, downs: 0, weaponKills: {}, bestStreak: 0, deathZone: 1, deathWeapon: '' };
    this.god = !!this.attract; this.idSeq = 1;
    this.infinite = !!this.opts.infiniteScrap; // v1.2 B20: God mode setting (unlimited Scrap)
    this.p = this.makePlayer();
    this.prompt = null;
    this.hold = { key: null, t: 0, failed: false, done: false }; this.holdPrev = false;
    this.anyDied = false;
    this.initV11();
  }

  // ---------- helpers ----------
  emit(type, data = {}) { data.type = type; this.events.push(data); }
  refreshWalk() { for (let i = 0; i < this.tiles.length; i++) this.walk[i] = this.tiles[i] === FLOOR || this.tiles[i] === SOFT ? 1 : 0; this.fieldAge = 99; this.lureFields?.clear(); }
  solid(tx, ty) { if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return true; const t = this.tiles[ty * MW + tx]; return t !== FLOOR && t !== SOFT; } // v1.4 C1: soft props never block movement
  tileAt(x, y) { const tx = Math.floor(x / TS), ty = Math.floor(y / TS); return (tx < 0 || ty < 0 || tx >= MW || ty >= MH) ? -1 : this.tiles[ty * MW + tx]; }
  // v1.4 E3: the named street a point is on (within a tile of it), or null
  streetAt(x, y) { const tx = Math.floor(x / TS), ty = Math.floor(y / TS); return STREETS.find((s) => tx >= s.x0 - 1 && tx <= s.x1 + 1 && ty >= s.y0 - 1 && ty <= s.y1 + 1) || null; }
  zoneAt(x, y) { const tx = Math.floor(x / TS), ty = Math.floor(y / TS); return this.map.zoneId[ty * MW + tx] ?? -1; }
  collideAxis(e, r, axis, d) {
    if (!d) return false;
    if (axis === 0) e.x += d; else e.y += d;
    const x0 = Math.floor((e.x - r) / TS), x1 = Math.floor((e.x + r - 0.001) / TS);
    const y0 = Math.floor((e.y - r) / TS), y1 = Math.floor((e.y + r - 0.001) / TS);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (this.solid(x, y)) {
        if (axis === 0) e.x = d > 0 ? x * TS - r : (x + 1) * TS + r;
        else e.y = d > 0 ? y * TS - r : (y + 1) * TS + r;
        return true;
      }
    }
    return false;
  }
  moveCircle(e, dx, dy, r) { const a = this.collideAxis(e, r, 0, dx); const b = this.collideAxis(e, r, 1, dy); return a || b; }
  // v1.4 C1: the player slides round corners. Blocked on one axis with no input on the other, ease past a corner that's within 6 px
  moveSlide(e, dx, dy, r) {
    const a = this.collideAxis(e, r, 0, dx), b = this.collideAxis(e, r, 1, dy);
    if (a && !dy) this.nudgeCorner(e, r, 0, Math.sign(dx), Math.abs(dx));
    else if (b && !dx) this.nudgeCorner(e, r, 1, Math.sign(dy), Math.abs(dy));
    return a || b;
  }
  overlapsSolid(x, y, r) {
    const x0 = Math.floor((x - r) / TS), x1 = Math.floor((x + r - 0.001) / TS), y0 = Math.floor((y - r) / TS), y1 = Math.floor((y + r - 0.001) / TS);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.solid(tx, ty)) return true;
    return false;
  }
  nudgeCorner(e, r, axis, dir, amt) {
    for (let k = 1; k <= T.player.cornerSlide; k++) for (const s of [1, -1]) {
      const x = e.x + (axis === 0 ? 0 : s * k), y = e.y + (axis === 1 ? 0 : s * k);
      if (this.overlapsSolid(x, y, r)) continue;
      if (this.overlapsSolid(x + (axis === 0 ? dir * 1.5 : 0), y + (axis === 1 ? dir * 1.5 : 0), r)) continue;
      // the way is clear k px to one side: step that way (never further than the move was)
      this.collideAxis(e, r, 1 - axis, s * Math.min(amt, k)); return;
    }
  }
  onHeavySoft(x, y) { return this.map.heavySoft.has(Math.floor(y / TS) * MW + Math.floor(x / TS)); }
  hasComfort(id) { return this.p.comforts.includes(id); }
  ripe(id) { return this.hasComfort(id) && (this.p.comfortRounds[id] || 0) >= T.comforts.ripenRounds; }
  comfortCap() { return Math.min(this.comfortSlotMax(), (this.signal && this.signal.done ? 9 : this.firstBruteKilled ? T.comforts.capRaised : T.comforts.cap) + (this.capBonus || 0) + (this.hasComfort && this.hasComfort('mule') ? T.mule.comfortSlots : 0)); }
  // v1.5 C1: never more slots than there are slot-taking comforts to fill them, less one, so slots stay scarce
  comfortSlotMax() { return Object.values(COMFORTS).filter((c) => !c.noPower).length - 1; }
  fuelRounds() { return this.hasRole && this.hasRole('mechanic') ? 10 : T.generator.fuelRounds; }
  bark(key, force = false, text = null) {
    if (this.attract) return;
    if (!force && this.t - this.lastBarkT < 8) return;
    let line = text;
    if (!line) {
      const lines = BARKS[key] || FINDS[key]?.barks; if (!lines) return;
      const opts = lines.length > 1 ? lines.filter((l) => l !== this.lastBark[key]) : lines;
      line = opts[Math.floor(this.rng.next() * opts.length)];
      this.lastBark[key] = line;
    }
    this.lastBarkT = this.t;
    this.emit('bark', { text: line });
  }

  makeWeapon(id, mag, reserve, cond = 1) {
    if (MELEE[id]) { const w = { id, kind: 'melee', tier: 0, dur: MELEE[id].dur, effect: null, cond, mods: [] }; this.rollMods?.(w); w.dur = this.maxDur(w); return w; }
    const g = GUNS[id];
    const w = { id, kind: 'gun', tier: 0, mag: mag ?? g.mag, reserve: reserve ?? g.reserve, effect: null, cond, mods: [] };
    if (this.rollMods) this.rollMods(w);
    return w;
  }
  makePlayer() {
    const s = this.map.start;
    return {
      x: s.x, y: s.y, ox: s.x, oy: s.y, r: T.player.radius, face: 6, fx: 0, fy: -1,
      hp: T.player.hp, maxHp: T.player.hp, lastDmg: -99, iframes: 0, invuln: 0, stunT: 0,
      slots: [this.makeWeapon('hammer'), null, this.makeWeapon('revolver', 6, 24), null], cur: 0, // v1.4 F4: 1 melee, 2 Primary, 3 Secondary, 4 Pack Mule
      swapT: 0, swing: null, buffered: false, fireCD: 0, reloadT: 0, drawT: 0, prevAttack: false,
      stam: 1, charge: -1, atkHeld: 0, shoveCD: 0, dashT: 0, dashHit: null, throwable: { id: 'brick', count: 2 }, throwCD: 0,
      comforts: [], comfortRounds: {}, bandages: 0, secondWind: false,
      downed: false, downT: 0, downMode: null, dead: false, busyT: 0, chainsawT: 0, chainsawNoise: 0,
      moveDelay: 0, moving: false, lockFace: -1, lastChance: null, surround: 0, repairing: false, plankStart: -99,
      animT: 0, lastAttackT: -99, muzzle: 0,
    };
  }
  curWeapon() { const p = this.p; if (p.downed && p.lastChance) return p.lastChance; return p.slots[p.cur]; }
  gunSlots() { return this.hasComfort('mule') ? [1, 2, 3] : [1, 2]; }
  gunClass(id) { return PRIMARY.has(id) ? 'primary' : 'secondary'; }
  // the slot a new gun goes in: its class slot if empty, then the Pack Mule slot. null: no room, it goes to the Red Lion stash
  gunSlotFor(id) {
    const p = this.p, s = this.gunClass(id) === 'primary' ? 1 : 2;
    if (!p.slots[s]) return s;
    if (this.hasComfort('mule') && !p.slots[3]) return 3;
    return null;
  }
  comfortCount() { return this.p.comforts.filter((c) => c !== 'bandages').length; } // v1.4 F6: Bandages don't take a comfort slot
  bandageCap() { return T.consumables.bandageStack + (this.hasComfort('mule') ? T.mule.bandageStack : 0); }

  meleeStats(w) {
    const d = MELEE[w.id];
    const s = { dmg: d.dmg, reach: d.reach, arc: d.arc, wind: d.wind, active: d.active, rec: d.rec, cleave: d.cleave, kb: d.kb, stagger: d.stagger, ignoresArmour: !!d.ignoresArmour, cls: d.cls };
    if (w.tier >= 1) { s.dmg *= 2; s.reach += 4; }
    if (w.tier >= 2) s.cleave += 1;
    if (w.tier >= 3) { s.dmg *= 1.5; s.stagger *= 1.5; }
    if (this.hasComfort('coffee')) s.rec *= 0.75;
    if (this.hasComfort('steady')) s.wind *= 0.8;
    if (this.hasComfort('eagle')) s.arc += 20;
    s.dmg *= this.condMult(w);
    if (this.hasMod(w, 'grip')) s.reach += 4;
    if (this.hasMod(w, 'heavy')) s.kb *= 1.5;
    if (this.hasMod(w, 'taped')) s.rec *= 0.8;
    if (this.timedV && this.timedV.mist > 0) { s.dmg *= T.tricks.mist.dmg; s.wind *= T.tricks.mist.speed; s.active *= T.tricks.mist.speed; s.rec *= T.tricks.mist.speed; }
    return s;
  }
  gunStats(w) {
    const d = GUNS[w.id];
    const s = { dmg: d.dmg, rpm: d.rpm, mag: d.mag, reserve: d.reserve, reload: d.reload, range: d.range, pen: d.pen, spread: d.spread, head: d.head };
    const GT = T.gunTier;
    if (w.tier >= 1) { s.dmg *= GT.dmg[0]; s.mag = Math.ceil(d.mag * 1.5); s.reserve = d.reserve * 2; }
    if (this.hasComfort('mule')) s.reserve = Math.round(s.reserve * T.mule.ammoMult); // v1.4 F7
    if (w.tier >= 2) { s.dmg *= GT.dmg[1]; s.pen += GT.pen[1]; }
    if (w.tier >= 3) { s.dmg *= GT.dmg[2]; s.pen += GT.pen[2]; }
    if (this.hasComfort('steady')) { s.rpm *= 1.33; s.dmg *= 2; }
    if (this.hasComfort('coffee')) s.reload *= 0.5;
    if (this.hasComfort('eagle')) { s.spread *= 0.5; s.head = Math.min(1, s.head * 2); }
    s.dmg *= this.condMult(w);
    if (this.hasMod(w, 'extmag')) s.mag = Math.ceil(s.mag * 1.5);
    if (this.hasMod(w, 'quick')) s.reload *= 0.7;
    if (this.hasMod(w, 'hollow')) s.pen += 1;
    if (this.hasMod(w, 'hair')) s.rpm *= 1.15;
    if (this.ticketUntil >= this.round && this.round > 0) s.head = 1;
    if (w.id === 'blowtorch') { s.mag = T.blowtorch.fuel; s.dmg = w.tier >= 1 ? T.blowtorch.dragonDps * Math.pow(1.5, w.tier - 1) : T.blowtorch.dps; s.range = w.tier >= 1 ? T.blowtorch.dragonCone : T.blowtorch.cone; }
    return s;
  }
  maxDur(w) {
    if (w.tier >= 1 || (w.cond ?? 1) >= 4 || !Number.isFinite(MELEE[w.id].dur)) return Infinity;
    return Math.round(MELEE[w.id].dur * (1 + T.condition.dur[w.cond ?? 1]));
  }

  // ---------- main step ----------
  step(inp) {
    if (this.hitstop > 0) { this.hitstop -= DT; return; }
    this.t += DT; this.tick++;
    if (this.state === 'escaped') { this.updateEscape(); return; }
    this.updateFlow();
    this.updateGrab(inp);
    if (this.cellar) this.updateCellar(inp);
    else { this.updatePlayer(inp); this.updateInteract(inp); }
    this.updateRound();
    this.updateEnemies();
    this.updateProjectiles();
    this.updateThrown();
    this.updateHazards();
    this.updateFinds();
    this.updateCrates();
    this.updateWorkshop();
    this.updateTraps();
    this.updateTimers();
    this.updateV11(inp);
  }

  updateFlow() {
    const p = this.p;
    const ti = Math.floor(p.y / TS) * MW + Math.floor(p.x / TS);
    this.fieldAge += DT;
    if (ti !== this.fieldTile || this.fieldAge >= 0.25) {
      bfs(MW, MH, this.walk, Math.floor(p.x / TS), Math.floor(p.y / TS), this.field, this.queue);
      this.fieldTile = ti; this.fieldAge = 0;
    }
  }
  lureField(l) {
    let f = this.lureFields.get(l.id);
    if (!f) { f = new Uint16Array(MW * MH); bfs(MW, MH, this.walk, Math.floor(l.x / TS), Math.floor(l.y / TS), f, this.queue); this.lureFields.set(l.id, f); }
    return f;
  }

  // ---------- player ----------
  playerSpeed(shift) {
    const p = this.p;
    if (p.downed) return T.downed.crawlSpeed;
    let s = T.player.speed * (this.hasComfort('shoes') ? 1.12 : 1);
    if (shift) s *= this.hasComfort('shoes') ? 0.9 : T.player.strafeMult;
    if (p.surround >= 2 && !this.ripe('shoes')) s *= T.player.surroundedSlow;
    if (p.busyT > 0) s *= T.player.busyMoveMult;
    if (p.charge >= 0) s *= T.power.moveMult;
    if (p.jerry) s *= T.generator.jerrySlow;
    else if (p.carry) s *= p.carry.heavy ? T.carry.heavyMult : T.carry.speedMult;
    if (p.chainsawT > 0) s *= 1.15;
    if (this.onHeavySoft(p.x, p.y)) s *= T.player.softSlow; // v1.4 C1: wading through a bin or a bench
    if (p.grabbed || p.inEngine) s = 0;
    return s;
  }

  updatePlayer(inp) {
    const p = this.p; p.ox = p.x; p.oy = p.y;
    if (p.dead) return;
    p.animT += DT;
    for (const k of ['iframes', 'invuln', 'shoveCD', 'swapT', 'fireCD', 'busyT', 'throwCD', 'stunT', 'muzzle']) if (p[k] > 0) p[k] = Math.max(0, p[k] - DT);
    if (p.downed) { p.downT -= DT; if (p.downT <= 0) this.revive(); }
    if (p.inEngine) return;
    const regenDelay = (this.hasComfort('bandages') ? T.player.regenDelayBandages : T.player.regenDelay) - (this.hasRole('medic') ? 1 : 0);
    if (!p.downed && p.hp < p.maxHp && this.t - p.lastDmg >= regenDelay) p.hp = Math.min(p.maxHp, p.hp + T.player.regenRate * DT);

    // facing and movement (§5.1)
    const mx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), my = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
    if (inp.shift) { if (p.lockFace < 0) p.lockFace = p.face; } else p.lockFace = -1;
    p.walking = false;
    if ((mx || my) && p.stunT <= 0) {
      const d = dirIndex(mx, my);
      if (!p.moving) { p.moving = true; p.moveDelay = (d !== p.face && p.lockFace < 0) ? T.player.turnTapMs / 1000 : 0; }
      if (p.lockFace < 0) p.face = d;
      if (p.moveDelay > 0) p.moveDelay -= DT;
      else if (p.dashT <= 0) {
        const sp = this.playerSpeed(inp.shift); const n = mx && my ? Math.SQRT1_2 : 1;
        this.moveSlide(p, mx * n * sp * DT, my * n * sp * DT, T.player.footR); p.walking = true;
        p.walkFwd = p.lockFace < 0 || p.face === d; // facing where he walks: a proper stride, not the strafe shuffle
      }
    } else p.moving = false;
    p.fx = DIRS[p.face][0]; p.fy = DIRS[p.face][1];

    if (p.dashT > 0) {
      p.dashT -= DT;
      this.moveCircle(p, p.fx * T.shove.dashSpeed * DT, p.fy * T.shove.dashSpeed * DT, T.player.footR);
      for (const e of this.enemies) {
        if (e.dead || e.state !== 'inside' || p.dashHit.has(e)) continue;
        if (hyp(e.x - p.x, e.y - p.y) < e.r + p.r + 4) { p.dashHit.add(e); this.shoveEnemy(e); }
      }
    }
    if (p.stunT > 0) return;

    // weapon selection
    if (!p.downed && !inp.consumedQE && !(this.prompt && this.prompt.kind === 'workshop' && this.workshop.state === 'ready' && this.workshop.options)) {
      if (inp.slot) this.selectSlot(inp.slot - 1);
      // v1.2 B5: Q/E only cycle interaction options. The wheel (or 1-4) switches weapons
      if (inp.wheel) {
        const order = [0, 1, 2, 3].filter((i) => p.slots[i]);
        if (order.length > 1) {
          let k = order.indexOf(p.cur); if (k < 0) k = 0;
          k = (k + (inp.wheel > 0 ? 1 : -1) + order.length) % order.length;
          this.selectSlot(order[k]);
        }
      }
    }
    this.updateWeapon(inp);

    // shove (§7.4)
    if (!(p.stam >= 0)) { p.stam = 1; p.charge = -1; p.atkHeld = 0; } // saves from before v1.3
    if (p.charge < 0) p.stam = Math.min(1, p.stam + T.stamina.regen * DT);
    if (inp.shove && p.stam >= T.shove.stamina && p.charge < 0 && !p.downed && !p.grabbed) {
      p.stam -= T.shove.stamina;
      if (this.hasComfort('gasmask')) { p.dashT = T.shove.dashTime; p.dashHit = new Set(); }
      else {
        const cosA = Math.cos((T.shove.arc / 2) * Math.PI / 180);
        for (const e of this.enemies) {
          if (e.dead || e.state === 'outside' || e.state === 'climb') continue;
          const dx = e.x - p.x, dy = e.y - p.y, d = hyp(dx, dy);
          if (d - e.r > T.shove.reach) continue;
          if (d > 3 && (dx * p.fx + dy * p.fy) / d < cosA) continue;
          this.shoveEnemy(e);
        }
      }
      this.emit('shove', { x: p.x, y: p.y, fx: p.fx, fy: p.fy, dash: this.hasComfort('gasmask') });
    }
    // throwables (§9.6). While carrying, G drops (or throws a ticking parcel)
    if (inp.throw && this.isCarrying() && !p.downed) {
      if (p.carry && p.carry.item === 'bomb') { const it = p.carry; p.carry = null; const save = p.throwable; p.throwable = { id: 'pipe', count: 1 }; this.throwItem(); p.throwable = save; this.errandItemLost('bomb'); }
      else this.dropCarry('drop');
    } else if (inp.throw && p.throwable.count > 0 && p.throwCD <= 0 && !p.downed && p.busyT <= 0 && !p.grabbed) this.throwItem();
  }

  shoveEnemy(e) {
    const p = this.p;
    if (e.type === 'brute') {
      if (e.chargeWarn > 0) { e.chargeWarn = 0; e.stagger = T.brute.shoveStun; this.emit('bruteStun', { x: e.x, y: e.y }); }
      return;
    }
    if (e.type === 'butcher') { if (e.grabWarn > 0) { e.grabWarn = 0; e.stagger = 1.0; e.grabCD = 2; this.emit('bruteStun', { x: e.x, y: e.y }); } return; }
    if (e.type === 'screamer' && e.screamT > 0) { e.screamT = 0; e.screamCD = T.screamer.every; }
    this.knock(e, T.shove.knockback, p.x, p.y);
    e.stagger = Math.max(e.stagger, T.shove.stagger); e.atk = 0;
  }

  selectSlot(i) {
    const p = this.p;
    if (i === p.cur || i < 0 || i > 3 || !p.slots[i]) return;
    p.cur = i; p.swing = null; p.charge = -1; p.reloadT = 0; p.drawT = 0;
    const melee = p.slots[i].kind === 'melee';
    p.swapT = (melee ? T.swap.melee : T.swap.gun) * (this.hasComfort('coffee') ? 0.5 : 1) * (this.ripe('mule') ? 0 : 1);
    this.emit('swap', { melee });
  }

  updateWeapon(inp) {
    const p = this.p;
    const pressed = inp.attack && !p.prevAttack, released = !inp.attack && p.prevAttack;
    p.prevAttack = inp.attack;
    p.atkHeld = inp.attack ? (pressed ? 0 : p.atkHeld + DT) : 0;
    if (p.chainsawT > 0) {
      p.chainsawT -= DT;
      if (inp.attack && !p.downed) this.chainsawTick();
      if (p.chainsawT <= 0) this.emit('chainsawEnd');
      return;
    }
    if (p.swing) { this.updateSwing(); if (pressed && p.swing && p.swing.t >= p.swing.wind + p.swing.active) p.buffered = true; return; }
    const w = this.curWeapon();
    if (!w || p.busyT > 0) return;
    const blocked = this.noAttack || p.grabbed || p.inEngine;
    if (w.kind === 'melee') {
      // v1.3 C5: tap swings; hold charges a power attack on stamina, release spins
      // v1.4 D1: it never fires by itself at full charge. It holds (with a tell) until you let go, or until stamina runs dry
      if (p.charge >= 0) {
        const P = T.power;
        if (p.downed || blocked) { p.charge = -1; p.chargeReady = false; return; }
        if (!inp.attack) { this.powerAttack(w); return; }
        if (!p.chargeReady) {
          const room = p.stam - P.reserve;
          if (p.charge < P.chargeTime && room > 0) { const dt = Math.min(DT, room / P.drain); p.charge = Math.min(P.chargeTime, p.charge + dt); p.stam -= P.drain * dt; }
          if (p.charge >= P.chargeTime - 1e-9 || p.stam <= P.reserve + 1e-9) { p.chargeReady = true; this.emit('chargeReady', { x: p.x, y: p.y }); }
        } else {
          p.stam = Math.max(0, p.stam - P.holdDrain * DT);
          if (p.stam <= 0) { this.powerAttack(w); p.needRelease = true; } // the only auto-release; the next charge needs a fresh press
        }
        return;
      }
      if (!inp.attack) p.needRelease = false;
      if (p.swapT > 0 || p.downed || blocked) return;
      if (inp.attack && !p.needRelease && p.atkHeld >= T.power.holdDelay && p.stam >= T.power.minStamina) { p.charge = 0; p.chargeReady = false; p.buffered = false; this.emit('chargeStart', { x: p.x, y: p.y }); return; }
      if (pressed || p.buffered) { p.buffered = false; this.startSwing(w); }
      return;
    }
    if (this.isCarrying() && !p.downed) { if (pressed) { this.emit('click'); this.bark(null, false, 'Hands full. Melee or shove.'); } return; }
    const def = GUNS[w.id], st = this.gunStats(w);
    if (def.fire === 'flame') { if (inp.attack && w.mag > 0 && p.swapT <= 0 && !blocked) this.flameTick(w, st); else if (p.flaming) { p.flaming = false; this.emit('flameEnd'); } if (pressed && w.mag <= 0) { this.emit('click'); this.bark(null, false, 'Out of diesel. Jerry cans at the garage.'); } return; }
    if (p.jamT > 0) { p.jamT -= DT; if (p.jamT <= 0) this.emit('unjam'); return; }
    if (blocked) return;
    if (p.reloadT > 0) {
      if (def.perShell && pressed && w.mag > 0) p.reloadT = 0; // interrupt shell reload to fire
      else {
        p.reloadT -= DT;
        if (p.reloadT <= 0) this.finishReload(w, st, def);
        return;
      }
    }
    if (inp.reload && w.mag < st.mag && w.reserve > 0) { this.startReload(w, st, def); return; }
    if (p.swapT > 0) return;
    // v1.1: an empty gun reloads itself (switching weapon cancels it, see selectSlot)
    if (w.mag <= 0 && w.reserve > 0 && p.fireCD <= 0) { this.startReload(w, st, def); return; }
    if (def.fire === 'draw') {
      if (inp.attack && w.mag > 0 && p.fireCD <= 0) { p.drawT = Math.min(def.drawTime, p.drawT + DT); }
      else if (released && p.drawT > 0) { this.fireGun(w, Math.max(0.25, p.drawT / def.drawTime)); p.drawT = 0; }
      else if (pressed && w.mag <= 0) this.emptyGun(w, st, def);
      return;
    }
    const want = def.fire === 'auto' ? inp.attack : pressed;
    if (want && p.fireCD <= 0) {
      if (w.mag > 0) this.fireGun(w, 1);
      else if (pressed || def.fire === 'auto') this.emptyGun(w, st, def, pressed);
    }
  }
  emptyGun(w, st, def, pressed = true) {
    if (w.reserve > 0) this.startReload(w, st, def);
    else if (pressed) { this.emit('click'); this.bark('outOfAmmo'); this.p.fireCD = 0.3; }
  }
  startReload(w, st, def) {
    const p = this.p; if (w.reserve <= 0 || w.mag >= st.mag) return;
    if (this.ripe('coffee') && w.mag === 0 && this.t - (p.lastInstaReload || -99) > 30) { p.lastInstaReload = this.t; p.reloadT = 0.01; }
    else p.reloadT = def.perShell ? st.reload : st.reload;
    this.emit('reload', { id: w.id });
  }
  finishReload(w, st, def) {
    if (def.perShell) {
      if (w.reserve > 0 && w.mag < st.mag) { w.mag++; if (!(this.watchUntil >= this.round)) w.reserve--; this.emit('shell'); }
      if (w.reserve > 0 && w.mag < st.mag) this.p.reloadT = st.reload;
    } else {
      const n = Math.min(st.mag - w.mag, w.reserve); w.mag += n; if (!(this.watchUntil >= this.round)) w.reserve -= n;
      this.emit('reloaded', { id: w.id });
    }
  }

  startSwing(w) {
    const p = this.p; const st = this.meleeStats(w);
    p.swing = { t: 0, wind: st.wind, active: st.active, rec: st.rec, st, hit: new Set(), hitCount: 0, any: false, w, props: new Set() };
    p.lastAttackT = this.t;
    this.emit('swing', { cls: st.cls, x: p.x, y: p.y, id: w.id, feel: MELEE[w.id].feel, tier: w.tier, effect: w.tier >= 2 ? w.effect : null, mist: this.timedV.mist > 0 });
  }
  powerAttack(w) {
    const p = this.p, P = T.power, k = Math.max(0, Math.min(1, p.charge / P.chargeTime)), st = this.meleeStats(w);
    p.charge = -1; p.chargeReady = false; p.swapT = P.recover; p.lastAttackT = this.t;
    // v1.4 D2: everything in reach; damage, knockback and score all scale with the charge
    const mult = curve(P.dmg, k), reach = st.reach + P.reachAdd, dmg = st.dmg * mult, kb = curve(P.kb, k);
    let n = 0, killed = false;
    for (const e of this.enemies) {
      if (e.dead || e.ally > 0 || e.state === 'outside' || e.state === 'climb') continue;
      if (hyp(e.x - p.x, e.y - p.y) - e.r > reach) continue;
      n++;
      const big = e.type === 'brute' || e.type === 'butcher', crit = e.stagger > 0;
      if (big) this.shoveEnemy(e);
      this.damageEnemy(e, dmg * (crit ? 1.5 : 1), { kind: 'melee', crit, x: p.x, y: p.y, w, ignoresArmour: st.ignoresArmour, effect: w.tier >= 2 ? w.effect : null, tier: w.tier, scoreMult: mult, power: true });
      if (e.dead) killed = true;
      else if (!big) { this.knock(e, kb, p.x, p.y); e.stagger = Math.max(e.stagger, P.stagger); e.atk = 0; }
    }
    if (n && Number.isFinite(w.dur)) {
      w.dur -= 1;
      if (w.dur <= 0 && p.slots[0] === w) { p.slots[0] = this.makeWeapon('hammer'); this.emit('weaponBreak'); this.bark(null, true, 'It snapped. Back to the hammer.'); }
    }
    if (n) { this.doHitStop(killed ? T.fx.hitStopKill : T.fx.hitStop); this.emit('shake', { amt: 2, t: 0.12 }); }
    this.emit('powerAttack', { x: p.x, y: p.y, r: reach, k, n, mult });
  }
  updateSwing() {
    const p = this.p, s = p.swing;
    s.t += DT;
    if (s.t >= s.wind && s.t <= s.wind + s.active + 1e-6) this.meleeHits(s);
    if (s.t >= s.wind + s.active + s.rec) {
      if (s.any && s.w.kind === 'melee' && Number.isFinite(s.w.dur)) {
        s.w.dur -= s.tangled ? T.tangled.durMult : 1;
        if (s.w.dur <= 0 && p.slots[0] === s.w) { p.slots[0] = this.makeWeapon('hammer'); this.emit('weaponBreak'); this.bark(null, true, 'It snapped. Back to the hammer.'); }
      }
      p.swing = null;
    }
  }
  inCone(x, y, r, reach, arc) {
    const p = this.p; const dx = x - p.x, dy = y - p.y, d = hyp(dx, dy);
    if (d - r > reach) return false;
    if (d < 4) return true;
    return (dx * p.fx + dy * p.fy) / d >= Math.cos((arc / 2) * Math.PI / 180);
  }
  meleeHits(s) {
    const p = this.p, st = s.st;
    const hits = [];
    for (const e of this.enemies) {
      if (e.dead || e.ally > 0 || s.hit.has(e)) continue;
      if (this.inCone(e.x, e.y, e.r, st.reach, st.arc)) hits.push([e, hyp(e.x - p.x, e.y - p.y)]);
    }
    hits.sort((a, b) => a[1] - b[1]);
    let killed = false, landed = false;
    for (const [e] of hits) {
      if (s.hitCount >= st.cleave) break;
      s.hit.add(e); s.hitCount++; s.any = true; landed = true;
      const crit = e.stagger > 0 || (this.hasMod(s.w, 'balanced') && e.pinnedT > 0);
      if (crit) this.stats.crits++;
      if (e.type === 'tangled') { s.tangled = true; this.hurtPlayer(T.tangled.thorns, { dot: true, thorns: true }); this.emit('thorns', { x: e.x, y: e.y }); }
      this.damageEnemy(e, st.dmg * (crit ? 1.5 : 1), { kind: 'melee', crit, x: p.x, y: p.y, w: s.w, ignoresArmour: st.ignoresArmour, effect: s.w.tier >= 2 ? s.w.effect : null, tier: s.w.tier, pinned: e.pinnedT > 0 });
      if (!e.dead && this.hasMod(s.w, 'barbed')) { e.bleed = Math.max(e.bleed || 0, 1); e.bleedT = Math.max(e.bleedT || 0, 3); }
      if (e.dead) { killed = true; if (this.timedV.mist > 0) p.hp = Math.min(p.maxHp, p.hp + (this.trick.up ? 20 : T.tricks.mist.heal)); }
      else {
        this.knock(e, st.kb, p.x, p.y);
        e.stagger = Math.max(e.stagger, st.stagger); e.atk = 0;
        if (crit && this.ripe('eagle')) for (const o of this.enemies) if (!o.dead && o !== e && hyp(o.x - e.x, o.y - e.y) < 20) o.stagger = Math.max(o.stagger, 0.4);
      }
    }
    // props in the arc: barrels, car alarms
    for (const b of this.barrels) if (b.alive && b.fuse < 0 && !s.props.has(b) && this.inCone(b.px, b.py, 6, st.reach, st.arc)) { s.props.add(b); this.igniteBarrel(b); }
    for (const c of this.cars) if (!c.used && !s.props.has(c) && this.inCone(c.x, c.y, 10, st.reach, st.arc)) { s.props.add(c); this.triggerCar(c); }
    if (landed) {
      this.doHitStop(killed ? T.fx.hitStopKill : T.fx.hitStop);
      this.emit('shake', { amt: killed && st.cls === 'heavy' ? 2 : 1, t: 0.08 });
      this.emit('meleeHit', { x: p.x + p.fx * 10, y: p.y + p.fy * 10, heavy: st.cls === 'heavy', kill: killed, id: s.w.id, feel: MELEE[s.w.id].feel, tier: s.w.tier, effect: s.w.tier >= 2 ? s.w.effect : null, fx: p.fx, fy: p.fy, n: s.hitCount });
    }
  }
  doHitStop(t) { if (this.opts.hitStop) this.hitstop = Math.max(this.hitstop, t); }
  knock(e, dist, fx, fy) {
    if (e.type === 'crawler' || BIG[e.type] || dist <= 0) return;
    let dx = e.x - fx, dy = e.y - fy; const d = hyp(dx, dy) || 1; dx /= d; dy /= d;
    const dur = 0.12; e.kb = { vx: dx * dist / dur, vy: dy * dist / dur, t: dur };
  }

  // v1.1: the chainsaw scales with the round (it was weaker than a bat late on), cleaves everything and ignores armour
  chainsawDps() { return Math.max(T.chainsaw.minDps, T.chainsaw.hpMult * T.walker.hp(Math.max(1, this.round))); }
  chainsawTick() {
    const p = this.p;
    p.lastAttackT = this.t;
    const dps = this.chainsawDps();
    for (const e of this.enemies) {
      if (e.dead || e.ally > 0) continue;
      if (this.inCone(e.x, e.y, e.r, T.chainsaw.reach, T.chainsaw.arc)) {
        this.damageEnemy(e, dps * DT, { kind: 'melee', x: p.x, y: p.y, noHitScrap: true, silent: (this.tick % 6) !== 0, chainsaw: true, ignoresArmour: true });
        if (!e.dead) { e.stagger = Math.max(e.stagger, 0.15); if (this.tick % 10 === 0) this.knock(e, 6, p.x, p.y); }
      }
    }
    p.chainsawNoise -= DT;
    if (p.chainsawNoise <= 0) { p.chainsawNoise = 1; this.emitNoise('medium', p.x, p.y); this.emit('chainsaw'); }
  }

  flameTick(w, st) {
    const p = this.p;
    p.flaming = true; p.lastAttackT = this.t;
    w.mag = Math.max(0, w.mag - DT);
    const cone = st.range, ang = Math.atan2(p.fy, p.fx);
    for (const e of this.enemies) {
      if (e.dead || e.ally > 0) continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = hyp(dx, dy);
      if (d - e.r > cone) continue;
      if (d > 4 && (dx * p.fx + dy * p.fy) / d < Math.cos(0.45)) continue;
      this.damageEnemy(e, st.dmg * DT, { kind: 'fire', x: p.x, y: p.y, silent: (this.tick % 8) !== 0, w, flame: true, ignoresArmour: true });
      if (!e.dead) e.burn = { t: T.blowtorch.burnTime, dps: T.blowtorch.burnDps, spread: w.tier >= 1 };
    }
    for (const b of this.barrels) if (b.alive && b.fuse < 0 && hyp(b.px - p.x, b.py - p.y) < cone) this.igniteBarrel(b);
    if (this.tick % 30 === 0) this.emitNoise('medium', p.x, p.y);
    if (this.tick % 6 === 0) this.emit('flame', { x: p.x, y: p.y, ang, r: cone, tier: w.tier });
  }
  aimAngle(range) {
    const p = this.p; let ang = Math.atan2(p.fy, p.fx);
    if (this.hasComfort('eagle')) {
      let best = null, bd = Infinity;
      for (const e of this.enemies) {
        if (e.dead || e.ally > 0) continue;
        const dx = e.x - p.x, dy = e.y - p.y, d = hyp(dx, dy); if (d > range || d < 1) continue;
        let da = Math.abs(Math.atan2(dy, dx) - ang); if (da > Math.PI) da = 2 * Math.PI - da;
        if (da < 10 * Math.PI / 180 && d < bd) { bd = d; best = Math.atan2(dy, dx); }
      }
      if (best !== null) ang = best;
    }
    // v1.4 D6: shots bend toward a raider within 12° (full snap inside 6°) with a clear line; zombies get a 5° cone. Cover still works
    const A = T.aimAssist, R = Math.PI / 180; let bend = 0, bs = Infinity;
    for (const e of this.enemies) {
      if (e.dead || e.ally > 0 || e.state !== 'inside') continue;
      const cfg = e.type === 'raider' ? A.raider : A.zombie;
      const dx = e.x - p.x, dy = e.y - p.y, d = hyp(dx, dy); if (d > range || d < 4) continue;
      let da = Math.atan2(dy, dx) - ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      const deg = Math.abs(da) / R; if (deg > cfg.cone) continue;
      if (!this.lineClear(p.x, p.y - 4, e.x, e.y - 4)) continue;
      const k = deg / cfg.cone; if (k >= bs) continue;
      bs = k; bend = da * (deg <= cfg.snap ? 1 : (cfg.cone - deg) / (cfg.cone - cfg.snap));
    }
    return ang + bend;
  }
  fireGun(w, ratio) {
    const p = this.p, def = GUNS[w.id], st = this.gunStats(w);
    w.mag--; p.fireCD = 60 / st.rpm; p.lastAttackT = this.t; p.muzzle = 0.05;
    if ((w.cond ?? 1) === 0 && this.rng.next() < T.condition.jamChance) { p.jamT = T.condition.jamClear; this.emit('jam'); }
    const ang = this.aimAngle(st.range);
    const ox = p.x + Math.cos(ang) * 7, oy = p.y + Math.sin(ang) * 7;
    const tracers = [];
    for (let k = 0; k < def.pellets; k++) {
      const a = ang + (this.rng.next() - 0.5) * st.spread * Math.PI / 180;
      if (def.projectile) {
        const sp = def.speed * (0.6 + 0.4 * ratio);
        this.projectiles.push({ kind: def.projectile, gun: w.id, x: ox, y: oy, ox, oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dist: 0, range: st.range * ratio, dmg: st.dmg * ratio, pen: st.pen, head: st.head, hit: new Set(), n: 0, w });
      } else tracers.push(this.hitscan(ox, oy, a, st.range, st.pen, st.dmg, st.head, w, def));
    }
    const LV = ['quiet', 'medium', 'loud', 'vloud'];
    const noise = this.hasMod(w, 'suppressor') ? LV[Math.max(0, LV.indexOf(def.noise) - 1)] : def.noise;
    this.emitNoise(noise, p.x, p.y);
    this.emit('shot', { id: w.id, x: ox, y: oy, ang, tracers, noise, tier: w.tier, effect: w.tier >= 2 ? w.effect : null, cond: w.cond ?? 1, suppressed: noise !== def.noise });
    if (w.mag === 0 && w.reserve === 0) this.bark('outOfAmmo');
  }
  rayWall(ox, oy, dx, dy, range) {
    for (let s = 2; s <= range; s += 3) {
      const t = this.tileAt(ox + dx * s, oy + dy * s);
      if (t !== FLOOR && t !== BAR) return { d: s, tx: Math.floor((ox + dx * s) / TS), ty: Math.floor((oy + dy * s) / TS) };
    }
    return { d: range, tx: -1, ty: -1 };
  }
  hitscan(ox, oy, a, range, pen, dmg, head, w, def) {
    const dx = Math.cos(a), dy = Math.sin(a);
    const wall = this.rayWall(ox, oy, dx, dy, range);
    const cands = [];
    for (const e of this.enemies) {
      if (e.dead || e.ally > 0) continue;
      const ex = e.x - ox, ey = e.y - oy; const along = ex * dx + ey * dy;
      if (along < -2 || along > wall.d) continue;
      if (Math.abs(ex * dy - ey * dx) > e.r + 1.5) continue;
      cands.push([e, along]);
    }
    cands.sort((x, y) => x[1] - y[1]);
    let n = 0, end = wall.d;
    for (const [e, along] of cands) {
      if (n >= pen) break;
      const fall = def.noFalloff ? 1 : Math.pow(0.75, n);
      const isHead = this.rng.next() < head;
      if (isHead) this.stats.heads++;
      this.damageEnemy(e, dmg * fall * (isHead ? 2 : 1), { kind: 'gun', head: isHead, x: ox, y: oy, w, effect: w.tier >= 2 ? w.effect : null, tier: w.tier });
      if (!e.dead) this.knock(e, 3, ox, oy);
      n++; end = along;
    }
    if (n < pen) { this.hitPropAt(wall.tx, wall.ty); end = wall.d; }
    this.shootItems(ox, oy, dx, dy, end);
    this.emit('impact', { x: ox + dx * end, y: oy + dy * end, wall: n < pen });
    return { x1: ox, y1: oy, x2: ox + dx * end, y2: oy + dy * end };
  }
  hitPropAt(tx, ty) {
    for (const b of this.barrels) if (b.alive && b.fuse < 0 && b.x === tx && b.y === ty) this.igniteBarrel(b);
    for (const c of this.cars) if (!c.used && ty === c.ty && tx >= c.tx && tx < c.tx + c.w) this.triggerCar(c);
  }

  throwItem() {
    const p = this.p; const id = p.throwable.id;
    p.throwable.count--; p.throwCD = 0.5; p.lastThrowT = this.t;
    const wall = this.rayWall(p.x, p.y, p.fx, p.fy, T.throwables.range);
    const dist = Math.max(8, wall.d < T.throwables.range ? wall.d - 6 : T.throwables.range);
    this.thrown.push({ id, sx: p.x, sy: p.y, x: p.x, y: p.y, ex: p.x + p.fx * dist, ey: p.y + p.fy * dist, t: 0, dur: T.throwables.flightTime * (0.4 + 0.6 * dist / T.throwables.range), wired: id === 'brick' && this.hasComfort('barbed') });
    this.emit('throw', { id });
  }

  // ---------- damage ----------
  damageEnemy(e, dmg, src) {
    if (e.dead) return;
    if (this.timed.adrenaline > 0 && src.kind !== 'trap' && src.kind !== 'bleed') {
      if (SPECIAL[e.type]) dmg *= T.finds.adrenalineSpecialMult; else dmg = Math.max(dmg, e.hp + 1);
    }
    const shielded = (e.type === 'armoured' && e.armour > 0) || (e.type === 'brute' && e.stagger <= 0);
    if (shielded && src.kind !== 'explosion' && !src.ignoresArmour && !(e.type === 'brute' && (src.kind === 'fire' || src.effect === 'burn'))) {
      const ix = src.x - e.x, iy = src.y - e.y; const il = hyp(ix, iy);
      if (il > 0.5 && (ix * e.fx + iy * e.fy) / il > 0.2) {
        if (e.type === 'armoured') { e.armour -= dmg; if (e.armour <= 0) this.emit('armourBreak', { x: e.x, y: e.y }); }
        dmg *= 1 - T.types.armoured.frontReduce;
        src.armoured = true;
      }
    }
    if (e.pinnedT > 0 && src.kind === 'gun') { dmg *= 1.5; src.crit = true; } // v1.4 G: Biscuit's pin makes your shots crit too (melee crits through the stagger)
    e.hp -= dmg;
    if (src.kind === 'melee' || src.kind === 'gun') e.noticed = true;
    if (src.kind === 'fire' || src.kind === 'explosion' || src.flame) e.markedFireExplosive = true; // v1.4 D4: once burned or blasted, its kill counts, whatever lands the blow
    if (!src.silent) { e.flash = 2; this.emit('hit', { x: e.x, y: e.y, fx: src.x, fy: src.y, crit: !!src.crit, head: !!src.head, armour: !!src.armoured, type: e.type }); }
    if (e.hp <= 0) { this.kill(e, src); return; }
    if (e.type === 'looter' && src.kind !== 'bleed') this.looterHurt(e);
    if ((src.kind === 'melee' || src.kind === 'gun') && !src.noHitScrap) this.addScrap(T.scrap.hit * (src.scoreMult ?? 1), e.x, e.y - 14, false, e.id);
    if (src.effect) this.applyEffect(e, src);
  }
  applyEffect(e, src) {
    const mult = src.tier >= 3 ? 1.5 : 1, r = this.rng.next();
    switch (src.effect) {
      case 'burn': if (r < 0.15 * mult) { e.burn = { t: T.fire.burnTime, dps: T.fire.dps, spread: true }; this.emit('ignite', { x: e.x, y: e.y }); } break;
      case 'shock': if (r < 0.15 * mult) {
        const near = this.enemies.filter((o) => !o.dead && o !== e && hyp(o.x - e.x, o.y - e.y) < 48).slice(0, 3);
        for (const o of near) { this.emit('arc', { x1: e.x, y1: e.y, x2: o.x, y2: o.y }); this.damageEnemy(o, (src.dmgBase || 100) * 0.5 * mult, { kind: 'gun', x: e.x, y: e.y, noHitScrap: true }); }
      } break;
      case 'chill': if (r < 0.2 * mult) { e.slowT = 3; e.slowAmt = 0.6; e.chilled = 3; } break;
      case 'rot': if (r < 0.05 * mult && !SPECIAL[e.type]) { e.ally = 10; this.emit('turned', { x: e.x, y: e.y }); } break;
      case 'bleed': e.bleed = Math.min(5, (e.bleed || 0) + 1); e.bleedT = 5; break;
    }
  }

  kill(e, src) {
    e.dead = true; this.anyDied = true;
    const p = this.p;
    let amt = 0, big = false;
    const trapKill = src.kind === 'trap' || src.trap;
    src.fireCredit = this.fireKill(e, src);
    if (trapKill && !src.noTrapScrap && !e.extra) amt = T.scrap.killTrap; // v1.2 B14: traps pay a bonus, not a discount
    else if (!src.noScrap) {
      if (e.type === 'dog') amt = T.scrap.dog;
      else if (src.biscuit) amt = T.biscuit.scrap;
      else if (e.type === 'brute') amt = T.scrap.brute;
      else if (e.type === 'butcher') amt = T.butcher.scrap;
      else if (e.type === 'raider') amt = e.role === 'captain' ? T.raiders.captainScrap : T.scrap.killMelee * T.rewards.raiderMult; // v1.4 D7
      else if (e.type === 'looter') amt = T.scrap.killMelee * T.rewards.looterMult + (e.stolen || 0);
      else if (src.kind === 'melee') { amt = src.crit ? T.scrap.killCrit : this.round >= T.scrap.meleeLateFrom ? T.scrap.killMeleeLate : T.scrap.killMelee; big = !!src.crit; } // v1.2 B18
      else if (src.kind === 'gun') { const base = T.gunTier.killScrap[Math.min(3, src.w?.tier || 0)]; amt = src.head ? base + T.scrap.killHead - T.scrap.killGun : base; big = !!src.head; }
      else amt = T.scrap.killThrow;
    }
    if (e.ally > 0) amt = 0;
    if (e.bounty) { amt += T.bounty.scrap; this.emit('banner', { text: 'BOUNTY CLAIMED', sub: `+${T.bounty.scrap} Scrap` }); }
    if (src.scoreMult !== undefined) amt *= src.scoreMult; // v1.4 D2: half-charged spins in a crowd don't farm Scrap
    if (amt) this.addScrap(amt, e.x, e.y - 14, big, e.id);
    if (trapKill && src.trapId != null && this.traps[src.trapId] && !e.extra) { const tt = this.traps[src.trapId]; tt.kills = (tt.kills || 0) + 1; tt.earned = (tt.earned || 0) + amt; }
    {
      this.stats.kills++; this.roundKills++;
      if (src.kind === 'melee') this.stats.meleeKills++;
      if (e.herd) this.herdKills = (this.herdKills || 0) + 1;
      if (src.kind === 'gun') this.stats.gunKills = (this.stats.gunKills || 0) + 1;
      const wn = src.chainsaw ? 'The Chainsaw' : src.biscuit ? 'Biscuit' : src.w ? weaponName(src.w) : trapKill ? 'Traps' : 'Explosives';
      this.stats.weaponKills[wn] = (this.stats.weaponKills[wn] || 0) + 1;
      // streak (§8.3)
      if (this.t - this.streak.last <= T.streak.window) this.streak.count++; else this.streak.count = 1;
      this.streak.last = this.t;
      this.streak.mult = Math.min(T.streak.max, Math.floor(this.streak.count / T.streak.stepKills) * T.streak.stepBonus);
      this.stats.bestStreak = Math.max(this.stats.bestStreak, this.streak.count);
    }
    const shatter = e.chilled > 0 && e.slowT > 0;
    this.emit('kill', { x: e.x, y: e.y, type: e.type, outfit: e.outfit, shatter, fx: src.x ?? p.x, fy: src.y ?? p.y, kind: src.kind, feel: src.w && MELEE[src.w.id] ? MELEE[src.w.id].feel : src.kind, role: e.role, leader: e.leader, enemy: e.type, w: src.w?.id, tier: src.w?.tier, extra: !!e.extra, summoned: !!e.summoned, trap: src.trapId, amt });
    if (e.ally <= 0) this.addTrickCharge(trapKill ? T.tricks.trapKillCharge : 1);
    this.trialKill(e, src);
    this.errandKill(e, src);
    this.questKill(e); this.escapeKill(e);
    if (e.type === 'bloater') { this.gas.push({ x: e.x, y: e.y, t: T.types.bloater.gasTime, r: T.types.bloater.gasRadius }); this.emit('burst', { x: e.x, y: e.y }); }
    if (e.type === 'hazmat') { this.gas.push({ x: e.x, y: e.y, t: T.hazmat.cloudTime, r: T.hazmat.cloudRadius, hazmat: true }); this.emit('burst', { x: e.x, y: e.y, hazmat: true }); }
    if (e.type === 'raider') { this.raiderKilled(e); return; }
    if (e.type === 'butcher') { this.butcherKilled(e); this.spawnFind(e.x, e.y, null, true); this.addParts(T.parts.brute, e.x, e.y); return; }
    if (e.type === 'looter') { this.dropPart(e.x, e.y, T.parts.looter); this.resolveCard('looter'); }
    if (e.type === 'brute') {
      this.dropPart(e.x + 10, e.y, T.parts.brute);
      this.spawnFind(e.x, e.y, null, true);
      if (!this.freeComfortGiven && this.comfortCount() < this.comfortCap() + (this.firstBruteKilled ? 0 : 1)) {
        const opts = Object.keys(COMFORTS).filter((id) => !this.hasComfort(id) && id !== 'bandages');
        if (opts.length) { this.freeComfortGiven = true; const id = this.rng.pick(opts); this.timers.push({ t: 0.5, kind: 'freeComfort', id }); }
      }
      if (!this.firstBruteKilled) { this.firstBruteKilled = true; this.emit('banner', { text: 'ZION IS GETTING USED TO YOU', sub: 'Comfort limit raised to 5' }); }
      return;
    }
    if (e.type === 'looter') return;
    if (src.noScrap || trapKill || src.nuke || e.extra) return;
    if (e.type === 'dog' && this.dogRound && this.dogsToSpawn <= 0 && !this.pending.some((q) => q.type === 'dog') && !this.enemies.some((o) => !o.dead && o.type === 'dog')) {
      this.spawnFind(e.x, e.y, 'ammo', true); this.dropPart(e.x + 12, e.y, T.parts.dogRound); return;
    }
    this.killsSinceFind++;
    if (this.roundFinds >= T.finds.maxPerRound) return;
    if (this.rng.next() < T.finds.chance || this.killsSinceFind >= T.finds.pityKills) this.spawnFind(e.x, e.y);
  }

  addScrap(n, x, y, big = false, src = null, raw = false) {
    const mult = raw ? 1 : (this.timed.double > 0 ? 2 : 1) * (1 + this.streak.mult) * (this.songActive && this.songActive() ? T.lore.songMult : 1);
    const amt = Math.round((n * mult) / 10) * 10;
    const repay = Math.min(this.debt, amt); this.debt -= repay;
    this.scrap += amt - repay; this.stats.earned += amt;
    if (this.timedV && !raw) this.polaroidScrap(amt);
    this.emit('scrap', { x, y, amt, big, src });
  }
  spend(n) { if (!this.infinite) this.scrap -= n; this.stats.spent += n; this.emit('purchase', { amt: n }); }
  canAfford(n) { return this.infinite || this.scrap >= n; }
  // v1.4 D4: a kill counts as fire/explosive if the enemy was ever burned or blasted (or this blow is fire/explosive)
  fireKill(e, src) { return src.kind === 'fire' || src.kind === 'explosion' || !!e.markedFireExplosive; }

  hurtPlayer(dmg, src = {}) {
    const p = this.p;
    if (p.dead || p.downed || this.god) return false;
    if (p.invuln > 0) return false;
    if (!src.dot && p.iframes > 0) return false;
    if (p.repairing && this.t - p.plankStart < T.barricade.grace && !src.dot) return false;
    if (p.inEngine) return false;
    if (src.state === 'outside' && src.bar && src.bar.planks >= 1) return false; // v1.2 B1: no hits across a barricade
    if (this.ripe('stew')) dmg *= 0.9;
    const stand = this.standReduce(); if (stand) dmg *= 1 - stand;
    if (p.padLayers && !src.dot) dmg = this.absorbPadding(dmg);
    p.hp -= dmg; p.lastDmg = this.t;
    if (!src.dot) {
      this.carryHit(); this.trialHurt();
      if (this.hold.key && this.hold.cancelOnHit) { this.hold.t = 0; this.emit('holdBroken'); }
      if (this.lighter > 0 && src.type && !src.dead && src.hp !== undefined) { this.lighter--; src.burn = { t: T.fire.burnTime, dps: T.fire.dps }; this.emit('ignite', { x: src.x, y: src.y }); }
      if (src.blaze && src.burn) p.burnT = T.burning.touch;
    }
    this.recentDmg.push([this.t, dmg]);
    if (!src.dot) {
      p.iframes = T.player.iframes;
      this.emit('hurt', { x: p.x, y: p.y, dmg, by: src.raider ? 'raider' : src.type ? (src.role || src.type) : src.kind || 'other', hp: Math.round(p.hp) });
      this.streak.count = 0; this.streak.mult = 0;
      if (this.hasComfort('barbed')) {
        for (const e of this.enemies) if (!e.dead && hyp(e.x - p.x, e.y - p.y) < 40) { e.slowT = 3; e.slowAmt = 0.8; e.snared = this.ripe('barbed'); }
        this.emit('snare', { x: p.x, y: p.y });
      }
      if (p.hp > 0 && p.hp <= p.maxHp * T.player.lowHealth) this.bark('lowHealth');
    }
    if (p.hp <= 0) this.goDown();
    return true;
  }

  goDown() {
    const p = this.p;
    p.grabbed = null;
    if (this.ringArmed) {
      this.ringArmed = false; p.hp = p.maxHp; p.invuln = T.downed.invuln;
      for (const e of this.enemies) if (!e.dead && e.state === 'inside' && hyp(e.x - p.x, e.y - p.y) < T.downed.shockRadius) this.shoveEnemy(e);
      this.emit('banner', { text: 'THE WEDDING RING', sub: 'Not yet. Not like this.' }); this.emit('revive', { x: p.x, y: p.y });
      return;
    }
    if (this.isCarrying()) this.dropCarry('down');
    for (let i = 0; i < p.padLayers; i++) p.pad[i] = 0;
    let mode = null;
    if (this.hasComfort('bandages') && p.bandages > 0) mode = 'bandages';
    else if (p.secondWind) mode = 'second';
    if (!mode) return this.die();
    this.stats.downs++;
    p.jerry = false;
    p.downed = true; p.downT = T.downed.time * (mode === 'bandages' && this.ripe('bandages') ? 0.5 : 1); p.downMode = mode; p.hp = 1; p.swing = null; p.reloadT = 0; p.chainsawT = 0;
    const loss = Math.round((this.scrap * T.downed.scrapLoss) / 10) * 10;
    this.scrap -= loss;
    if (mode === 'bandages') { p.bandages--; this.bandagesStock = p.bandages; }
    else p.secondWind = false;
    // v1.2: going down no longer costs comforts (feedback). Bandages that ran out are the only loss.
    if (mode === 'bandages' && p.bandages <= 0) { p.comforts = p.comforts.filter((c) => c !== 'bandages'); delete p.comfortRounds.bandages; }
    // downed: pistol only
    const ps = [1, 2, 3].find((i) => p.slots[i] && (p.slots[i].id === 'revolver' || p.slots[i].id === 'pistol'));
    if (ps !== undefined) { p.cur = ps; p.lastChance = null; } else p.lastChance = this.makeWeapon('revolver', 6, T.downed.lastChanceAmmo - 6);
    this.emit('down', { x: p.x, y: p.y, loss, mode });
  }
  revive() {
    const p = this.p;
    p.downed = false; p.hp = p.maxHp; p.invuln = T.downed.invuln; p.lastChance = null;
    if (!p.slots[p.cur]) p.cur = 0;
    for (const e of this.enemies) if (!e.dead && e.state === 'inside' && hyp(e.x - p.x, e.y - p.y) < T.downed.shockRadius) this.shoveEnemy(e);
    this.emit('revive', { x: p.x, y: p.y });
    this.bark('revive', true);
  }
  die() {
    const p = this.p;
    p.dead = true; p.hp = 0;
    this.stats.deathZone = this.zoneAt(p.x, p.y);
    this.stats.deathWeapon = p.chainsawT > 0 ? 'a chainsaw' : weaponName(this.curWeapon()) || 'his bare hands';
    this.emit('death', { x: p.x, y: p.y, round: this.round });
  }

  // ---------- interaction (§8.4) ----------
  // v1.4 B1/B2: the "would interact" target is the closest thing Cain faces and is in range; quest objects beat
  // pickups beat doors and ladders beat repairs. Everything near (faced or not) just glows.
  candidates() {
    const p = this.p, out = [], PR = T.prompt;
    this.glows = [];
    const add = (kind, obj, x, y, range = T.player.interactRange) => {
      const d = hyp(x - p.x, y - p.y); if (d > Math.max(range, PR.glowR)) return;
      this.glows.push({ x, y, kind });
      if (d > range) return;
      const dot = d > 0 ? ((x - p.x) * p.fx + (y - p.y) * p.fy) / d : 1;
      if (dot < PR.faceDot && d > PR.closeR) return;
      out.push({ kind, obj, x, y, tier: this.interactTier(kind, obj), score: d - dot * 6 });
    };
    for (const d of this.doors) if (!d.open) {
      let best = Infinity, bx = 0, by = 0;
      for (const [tx, ty] of d.tiles) { const x = tx * TS + 8, y = ty * TS + 8, dd = hyp(x - p.x, y - p.y); if (dd < best) { best = dd; bx = x; by = y; } }
      add('door', d, bx, by, T.player.doorRange);
    }
    const bars = this.safeHouse ? [...this.barricades, ...this.safeBars] : this.barricades;
    for (const b of bars) {
      const inside = ((p.x - b.x) * b.ix + (p.y - b.y) * b.iy) > 0;
      if ((inside || b.safe) && b.planks < T.barricade.planks) add('barricade', b, b.x, b.y); // v1.5 R3: the Red Lion's windows from outside too
      else if (this.power && b.planks >= T.barricade.planks && (b.reinforce || 0) < 2) add('reinforce', b, b.x, b.y); // v1.4 F2: from either side
    }
    this.map.racks.forEach((r, i) => { if (!this.buildingBurning(r.px, r.py)) add('rack', { ...r, id: i }, r.px, r.py); });
    this.map.comfortSpots.forEach((c, i) => { if (!this.buildingBurning(c.px, c.py)) add('comfort', { ...c, idx: i }, c.px, c.py); });
    for (const x of this.interactables()) add('x', x, x.x, x.y, x.range || T.player.interactRange);
    add('secondWind', this.map.secondWind, this.map.secondWind.px, this.map.secondWind.py);
    add('workshop', this.workshop, this.workshop.px, this.workshop.py, 24);
    if (!this.power || p.jerry || this.fuseBlown) add('generator', this.map.generator, this.map.generator.px, this.map.generator.py);
    this.map.vault.forEach((v, i) => add('vault', { ...v, id: i }, v.px, v.py));
    if (this.everPowered || this.escape.unlocked) add('jerry', this.map.jerry, this.map.jerry.px, this.map.jerry.py);
    add('ammoCrate', this.map.ammoCrate, this.map.ammoCrate.px, this.map.ammoCrate.py);
    for (const c of this.crates) if ((c.active || this.timed.sale > 0) && (c.state === 'idle' || c.state === 'ready')) add('crate', c, c.px, c.py);
    for (const t of this.traps) add('trap', t, t.px, t.py);
    out.sort((a, b) => a.tier - b.tier || a.score - b.score);
    return out;
  }
  interactTier(kind, o) {
    if (kind === 'barricade' || kind === 'reinforce') return 3;
    if (kind === 'door') return 2;
    if (kind !== 'x') return 1.5;
    const id = String(o.id);
    if (/^(sig|esc|use|deliver|act|car|trig|torch):/.test(id) || id === 'biscuit') return 0;
    if (/^w\d/.test(id)) return 1;
    if (id.startsWith('hatch') || id === 'pubdoor') return 2;
    return 1.5;
  }

  describe(c) {
    const p = this.p, o = c.obj;
    const R = (label, cost, holdTime, action, extra = {}) => ({ label, cost, holdTime, action, ...extra });
    const D = (label) => ({ label, cost: 0, disabled: true });
    switch (c.kind) {
      case 'door': return R(`Clear ${o.name}`, o.cost, T.hold.door, () => this.openDoor(o));
      case 'barricade': return R(o.safe ? 'Repair the barricade' : 'Repair', 0, this.nearFlag() ? 0.05 : T.hold.repair, null, { repair: true, sub: o.safe ? 'The Red Lion\'s window' : this.plankScrap < T.scrap.plankCapPerRound ? `Free, and pays +${T.scrap.plank} Scrap a plank` : 'Free. Planks pay no more Scrap this wave' });
      case 'reinforce': {
        const lvl = o.reinforce || 0;
        if (o.safe) { // v1.2: Red Lion shutters
          const PR = T.pubReinforce, k = lvl ? 'steel' : 'oak';
          return R(lvl ? 'Red Lion: steel shutter' : 'Red Lion: oak shutter', PR[k].scrap, 1.2, () => { o.reinforce = lvl + 1; this.emit('reinforce', { x: o.x, y: o.y, id: o.id }); }, { sub: lvl ? `${PR.steel.tear} s a plank, tearing hurts. Brutes can't smash it` : `${PR.oak.tear} s a plank instead of 1. Brutes can't smash it` });
        }
        const rf = T.reinforce, k = lvl ? 'sheet' : 'bars';
        return R(lvl ? 'Reinforce: sheet metal' : 'Reinforce: steel bars', rf[k].scrap, 1.0, () => { o.reinforce = lvl + 1; this.emit('reinforce', { x: o.x, y: o.y, id: o.id }); }, { sub: lvl ? `Walkers need ${rf.sheet.tear} s a plank, and tearing hurts them` : `Walkers need ${rf.bars.tear} s a plank instead of 1` });
      }
      case 'x': {
        const info = o.describe();
        if (Array.isArray(info)) { const n = info.length; const i = ((this.menuSel[o.id] || 0) % n + n) % n; return { ...info[i], menuIdx: i, menuN: n, menuLabels: info.map((m) => m.label) }; }
        return info ? { ...info, cancelOnHit: !!o.cancelOnHit } : null;
      }
      case 'generator':
        if (this.fuseBlown) return D('Fuse blown: fit a new one at the fire station');
        if (p.jerry) return R('Refuel the generator', 0, T.generator.refuelHold, () => this.refuel());
        if (this.everPowered && this.fuel <= 0) return D('Out of fuel: bring a jerry can');
        return R('Start the generator', 0, T.generator.startHold, () => this.startGenerator());
      case 'jerry': {
        if (p.jerry) return D('Carrying a jerry can');
        if (this.isCarrying()) return D('Jerry can: hands full');
        const engineNeeds = this.escape.stage === 'parts' && this.escape.diesel < 2;
        if (this.fuel >= this.fuelRounds() && !engineNeeds) return D('Jerry can (tank is full)');
        return R('Jerry can', T.generator.jerryCost, T.hold.buy, () => { p.jerry = true; this.selectMeleeForCarry(); this.emit('equip', { id: 'jerry' }); }, { sub: engineNeeds ? 'For the generator or the fire engine' : 'Carry it to the generator. G drops it' });
      }
      case 'vault': {
        const B = T.bank;
        if (o.mode === 'deposit') {
          if (this.scrap < B.unit) return D(`The town safe: ${this.bank.toLocaleString('en-GB')} held`);
          return R(`Deposit ${B.unit.toLocaleString('en-GB')}`, 0, T.hold.buy, () => { this.scrap -= B.unit; this.bank += B.unit; this.emit('purchase', { amt: 0 }); }, { sub: `Safe: ${this.bank.toLocaleString('en-GB')} (+5% a round)` });
        }
        if (this.bank <= 0) return D('The town safe is empty');
        // v1.5 B1: 1,000 a press, holding keeps going; Shift takes the lot
        const all = !!this.shiftHeld, take = all ? this.bank : Math.min(B.unit, this.bank), net = Math.floor(take * (1 - B.fee) / 10) * 10;
        return R(`Withdraw ${take.toLocaleString('en-GB')}${all ? ' (all)' : ''}`, 0, all ? T.hold.buy : B.repeat, () => { this.bank -= take; this.scrap += net; this.emit('scrap', { x: o.px, y: o.py - 10, amt: net, big: true }); }, { sub: `You get ${net.toLocaleString('en-GB')} after the 10% fee. ${this.bank.toLocaleString('en-GB')} held. Hold to keep going, Shift for all`, repeat: !all });
      }
      case 'rack': return this.describeRack(o);
      case 'comfort': {
        const def = COMFORTS[o.id];
        if (this.hasComfort(o.id)) return R(`Pour away ${def.name}`, 0, 1.2, () => this.dropComfort(o.id), { sub: 'Frees a comfort slot. No refund' });
        if (o.id === 'bandages' && this.bandagesStock <= 0) return D('Bandages: Out of stock');
        if (!def.noPower && !this.power) return D(`${def.name}: needs power`);
        if (this.comfortLocks[o.id] > 0) return D(`${def.name}: looted`);
        if (o.id !== 'bandages' && this.comfortCount() >= this.comfortCap()) return D('Comfort limit reached');
        const cost = o.id === 'stew' && this.hasRole('cook') ? Math.round(def.cost * 0.7 / 10) * 10 : def.cost;
        return R(def.name, cost, T.hold.comfort, () => this.buyComfort(o.id), { sub: def.desc });
      }
      case 'secondWind': {
        if (p.secondWind) return D('Second Wind (yours)');
        if (this.secondWindBuys >= T.prices.secondWind.length) return D('Second Wind: sold out');
        return R('Second Wind', T.prices.secondWind[this.secondWindBuys], T.hold.comfort, () => { p.secondWind = true; this.secondWindBuys++; p.busyT = T.comforts.drinkTime; this.emit('comfort', { id: 'secondWind' }); }, { sub: 'Get back up once. Not a comfort: uses no slot' });
      }
      case 'workshop': return this.describeWorkshop();
      case 'ammoCrate': {
        if (this.ammoCrateUsed) return D('Ammo crate: used this round');
        if (![1, 2, 3].some((i) => p.slots[i])) return D('Ammo crate: no guns');
        return R('Ammo crate (+50% reserves)', T.prices.ammoCrate, T.hold.buy, () => {
          this.ammoCrateUsed = true;
          for (const i of [1, 2, 3]) { const w = p.slots[i]; if (w) { const st = this.gunStats(w); w.reserve = Math.min(st.reserve, w.reserve + Math.ceil(st.reserve * 0.5)); } }
          this.emit('ammo');
        });
      }
      case 'crate': {
        if (o.state === 'ready') return R(`Take ${o.item === 'closed' ? 'CLOSED' : `${CONDITIONS[o.cond ?? 1].name} ${itemName(o.item)}`}`, 0, T.hold.take, () => this.takeCrate(o), { sub: o.item === 'closed' ? '' : this.replaceText(o.item, true) }); // v1.5 I2
        if (this.freePull >= this.round && !this.timed.sale) return R('Trader\'s crate: FREE PULL', 0, T.hold.crate, () => { this.freePull = 0; this.useCrate(o, true); }, { sub: 'From the supply drop' });
        const price = this.cratePrice();
        if (this.scrap < price && this.scrap < T.loan.threshold && this.debt <= 0)
          return R('Trader\'s loan +1,000', 0, T.hold.crate, () => { this.scrap += T.loan.amount; this.debt = T.loan.repay; this.emit('purchase', { amt: 0 }); this.emit('banner', { text: 'THE TRADER LENDS YOU 1,000', sub: 'She takes 1,500 back from what you earn' }); }, { sub: 'Repaid from your next 1,500 Scrap' });
        return R('Trader\'s crate', price, T.hold.crate, () => this.useCrate(o), { sub: this.timed.sale > 0 ? 'SALE!' : 'A random weapon' });
      }
      case 'trap': {
        if (this.carriedItem() === 'drum' && this.errandActive('wire')) return D(`${o.name}: wiring in progress`); // v1.4 E8
        if (!this.power && !(o.kind === 'searchlight' && this.searchlightFixed)) return D(`${o.name}: needs power`);
        if (o.activeT > 0) return D(`${o.name}: active`);
        // v1.2 B22: killing traps arm (free) and fire themselves when a crowd is in them; you pay each time one fires
        if (this.armable(o)) {
          if (o.armed) return R(`Disarm the ${o.name.toLowerCase()}`, 0, T.hold.trap, () => this.armTrap(o, false), { sub: o.cd > 0 ? `Armed. Cooling (${Math.ceil(o.cd)}s)` : `Armed: fires at ${T.traps.armN}+ of the dead (or 1 special)` });
          return R(`Arm the ${o.name.toLowerCase()}`, 0, T.hold.trap, () => this.armTrap(o, true), { sub: `${TRAP_INFO[o.kind]} Fires at ${T.traps.armN}+. ${o.cost.toLocaleString('en-GB')} a firing, kills pay ${T.scrap.killTrap}` });
        }
        if (o.cd > 0) return D(`${o.name}: cooling (${Math.ceil(o.cd)}s)`);
        return R(o.name, o.cost, T.hold.trap, () => this.activateTrap(o), { sub: TRAP_INFO[o.kind] });
      }
    }
    return null;
  }
  describeRack(r) {
    const p = this.p; const item = r.item;
    const D = (label) => ({ label, cost: 0, disabled: true });
    if (item.startsWith('t:')) {
      const id = item.slice(2), def = THROWS[id];
      if (def.power && !this.power) return D(`${def.name}: needs power`);
      if (p.throwable.id === id && p.throwable.count >= def.max) return D(`${def.name} (full)`);
      return { label: `${def.name} x${def.max}`, cost: def.cost, holdTime: T.hold.buy, action: () => { p.throwable = { id, count: def.max }; this.emit('equip', { id }); }, sub: this.replaceText(item) };
    }
    if (MELEE[item]) {
      const def = MELEE[item];
      if (def.power && !this.power) return D(`${def.name}: needs power`);
      const cur = p.slots[0];
      if (cur && cur.id === item) {
        if (cur.dur >= this.maxDur(cur)) return D(`${weaponName(cur)} (yours)`);
        return { label: `Repair ${weaponName(cur)}`, cost: Math.round(def.cost * T.prices.rackRebuyMult), holdTime: T.hold.buy, action: () => { cur.dur = this.maxDur(cur); this.emit('equip', { id: item }); } };
      }
      return { label: def.name, cost: def.cost, holdTime: T.hold.buy, action: () => this.giveItem(item), sub: this.replaceText(item) };
    }
    const def = GUNS[item];
    const slot = [1, 2, 3].find((i) => p.slots[i] && p.slots[i].id === item);
    if (slot !== undefined) {
      const w = p.slots[slot], st = this.gunStats(w);
      if (w.mag >= st.mag && w.reserve >= st.reserve) return D(`${weaponName(w)} ammo (full)`);
      const cost = w.tier >= 1 ? T.prices.upgradedAmmo : Math.round(def.ammoCost * (this.ripe('steady') ? 0.75 : 1) / 10) * 10;
      return { label: `${weaponName(w)} ammo`, cost, holdTime: T.hold.buy, action: () => { w.mag = st.mag; w.reserve = st.reserve; this.emit('ammo'); } };
    }
    return { label: def.name, cost: def.cost, holdTime: T.hold.buy, action: () => this.giveItem(item), sub: this.replaceText(item) };
  }
  // ---------- v1.4 F3: the Red Lion stash. Guns you have no room for wait there; swap them at the bar ----------
  stashWeapon(w) {
    (this.stash ||= []).push(w);
    this.emit('equip', { id: w.id, cond: w.cond, stash: true });
    this.card({ key: 'stash.' + w.id, prio: 'info', text: `${weaponName(w).toUpperCase()} SENT TO THE RED LION`, sub: 'No free slot. It\'s in the armoury behind the bar' });
  }
  stashTake(i) {
    const p = this.p, w = (this.stash || [])[i]; if (!w) return false;
    this.stash.splice(i, 1);
    if (w.kind === 'melee') { this.stash.push(p.slots[0]); p.slots[0] = w; p.cur = -1; this.selectSlot(0); this.emit('equip', { id: w.id, cond: w.cond }); return true; } // v1.5 I2
    let s = this.gunSlotFor(w.id);
    if (s === null) { s = this.gunClass(w.id) === 'primary' ? 1 : 2; this.stash.push(p.slots[s]); }
    p.slots[s] = w; if (p.cur === s) p.cur = -1; this.selectSlot(s);
    this.emit('equip', { id: w.id, cond: w.cond });
    return true;
  }
  stashStore(slot) {
    const p = this.p, w = p.slots[slot]; if (!w || w.kind !== 'gun' || slot === 0) return false;
    p.slots[slot] = null; (this.stash ||= []).push(w);
    if (p.cur === slot) { p.cur = -1; this.selectSlot(0); }
    this.emit('equip', { id: w.id });
    return true;
  }
  // found: a pickup or crate, not a purchase. v1.5 I2: a found melee weapon never replaces yours; it goes to the stash
  giveItem(id, cond = 1, found = false) {
    const p = this.p;
    if (id.startsWith('t:')) { const t = id.slice(2); p.throwable = { id: t, count: THROWS[t].max }; this.emit('equip', { id: t }); return; }
    if (MELEE[id] && found && p.slots[0]) { this.stashWeapon(this.makeWeapon(id, undefined, undefined, cond)); return; }
    if (MELEE[id]) { p.slots[0] = this.makeWeapon(id, undefined, undefined, cond); this.selectSlot(0); p.cur = 0; this.emit('equip', { id, cond }); return; }
    const w = this.makeWeapon(id, undefined, undefined, cond);
    const s = this.gunSlotFor(id);
    if (s === null) { this.stashWeapon(w); return; } // v1.4 F3: never replaces what you hold
    p.slots[s] = w;
    if (p.cur === s) p.cur = -1;
    this.selectSlot(s);
    this.emit('equip', { id, cond });
  }
  // feedback: a way to get rid of a comfort you no longer want (frees the slot, undoes its effect)
  dropComfort(id) {
    const p = this.p; if (!this.hasComfort(id)) return;
    p.comforts = p.comforts.filter((c) => c !== id); delete p.comfortRounds[id];
    if (id === 'stew') { p.maxHp = T.player.hp; p.hp = Math.min(p.hp, p.maxHp); }
    if (id === 'bandages') { this.bandagesStock = p.bandages; p.bandages = 0; }
    if (id === 'mule' && p.slots[3]) { if (p.cur === 3) this.selectSlot(0); this.stashWeapon(p.slots[3]); p.slots[3] = null; }
    this.emit('banner', { text: `${COMFORTS[id].name.toUpperCase()} POURED AWAY`, sub: 'A comfort slot is free' });
  }
  buyComfort(id) {
    const p = this.p;
    p.comforts.push(id); p.comfortRounds[id] = 0; p.busyT = T.comforts.drinkTime;
    if (id === 'stew') { p.maxHp = 250; p.hp = Math.min(250, p.hp + 150); }
    if (id === 'bandages') p.bandages = Math.min(this.bandageCap(), this.bandagesStock);
    this.emit('comfort', { id });
    this.bark('comfort');
  }
  openDoor(d) {
    d.open = true;
    for (const [tx, ty] of d.tiles) this.tiles[ty * MW + tx] = FLOOR;
    this.openZones.add(d.a); this.openZones.add(d.b);
    this.refreshWalk();
    this.stats.doors++;
    this.emit('doorOpen', { id: d.id, x: d.x, y: d.y, kind: d.kind });
    this.bark('door');
  }
  refuel() {
    const p = this.p; p.jerry = false;
    this.fuel = T.generator.fuelRounds;
    if (!this.power) this.startGenerator(); else this.emit('banner', { text: 'TANK FULL', sub: `${T.generator.fuelRounds} waves of diesel` });
  }
  startGenerator() {
    if (!this.everPowered || this.fuel <= 0) this.fuel = T.generator.fuelRounds;
    this.everPowered = true;
    this.power = true;
    this.emit('power', {});
    this.emit('banner', { text: 'THE LIGHTS ARE ON IN ZION', sub: 'Comforts, the workshop and traps are live' });
    this.bark('power', true);
  }

  updateInteract(inp) {
    const p = this.p;
    // feedback: a hold only starts on a fresh press. Finishing one task, or walking up with the key already down, never rolls into the next
    const pressed = !!inp.interact && !this.holdPrev; this.holdPrev = !!inp.interact; this.shiftHeld = !!inp.shift;
    this.prompt = null; p.repairing = false;
    if (p.dead || p.downed || this.attract) { this.hold.key = null; return; }
    const cands = this.candidates();
    let best = null, info = null;
    for (const c of cands) { const i = this.describe(c); if (i) { best = c; info = i; break; } }
    if (best && info) info = { ...info };
    if (!best) { this.hold.key = null; return; }
    // workshop effect choice (Q/E)
    if (best.kind === 'workshop' && this.workshop.state === 'ready' && this.workshop.options) {
      if (inp.prev || inp.next) { this.workshop.choice = inp.prev ? 0 : 1; inp.consumedQE = true; this.emit('choice', { i: this.workshop.choice }); }
    }
    // multi-option interactables (benches, the noticeboard, the radio code): Q/E cycles
    if (best.kind === 'x' && info.menuN > 1 && (inp.prev || inp.next)) {
      this.menuSel[best.obj.id] = (info.menuIdx + (inp.next ? 1 : -1) + info.menuN) % info.menuN; inp.consumedQE = true; this.emit('choice', {});
      info = this.describe(best);
    }
    if (best.kind === 'workshop' && info.cost && this.hasRole('mechanic')) info.cost = Math.round(info.cost * 0.8 / 10) * 10;
    const partsOk = !info.partsCost || this.parts >= info.partsCost;
    this.prompt = { ...info, x: best.x, y: best.y, kind: best.kind, progress: 0, open: !!inp.interact, afford: (!info.cost || this.canAfford(info.cost)) && partsOk, choices: best.kind === 'workshop' && this.workshop.state === 'ready' ? this.workshop.options : null, choice: this.workshop.choice };
    if (!inp.interact || info.disabled) { this.hold.key = null; this.hold.done = false; this.hold.failed = false; return; }
    const key = best.kind + ':' + (best.obj.id ?? best.obj.idx ?? 0) + (info.menuN ? ':' + info.menuIdx : '');
    if (this.hold.key !== key) {
      if (!pressed) { this.hold.key = null; return; }
      this.hold.key = key; this.hold.t = info.cost || info.partsCost ? -T.prompt.reveal : 0; this.hold.failed = false; this.hold.done = false; this.hold.cancelOnHit = !!info.cancelOnHit; // B1: a moment to read the price first
    }
    if (this.hold.done) return;
    if ((info.cost > 0 && !this.canAfford(info.cost)) || !partsOk) {
      if (!this.hold.failed) { this.hold.failed = true; this.emit('fail'); if (!partsOk) this.emit('banner', { text: `NEEDS ${info.partsCost} PARTS`, sub: `You have ${this.parts}`, danger: true }); }
      return;
    }
    if (info.repair) {
      const b = best.obj; p.repairing = true;
      const ht = this.nearFlag() ? 0.05 : T.hold.repair;
      if (this.hold.t === 0) p.plankStart = this.t;
      this.hold.t += DT;
      this.prompt.progress = this.hold.t / ht;
      if (this.hold.t >= ht) {
        this.hold.t = 0.0001; p.plankStart = this.t;
        if (b.planks < T.barricade.planks) {
          b.planks++;
          if (this.plankScrap < T.scrap.plankCapPerRound) { this.plankScrap += T.scrap.plank; this.addScrap(T.scrap.plank, b.x, b.y - 10, false, null, true); }
          this.emit('plankRepair', { x: b.x, y: b.y, id: b.id });
          this.trialAdd && this.trial && this.trial.id === 'planks' && this.trialAdd(1);
          // v1.1: nailing a plank in a walker's face knocks it back and pays a bonus
          for (const e of this.enemies) if (!e.dead && e.state === 'outside' && e.bar === b && hyp(e.x - b.x, e.y - b.y) < T.barricadeSlam.reach) {
            e.stagger = Math.max(e.stagger, T.barricadeSlam.stagger); e.tearT = 0; e.atk = 0; this.knock(e, 0, b.x, b.y);
            this.addScrap(T.barricadeSlam.scrap, e.x, e.y - 14, false, null, true); this.emit('slam', { x: b.x, y: b.y }); break;
          }
        }
      }
      return;
    }
    this.hold.t += DT;
    this.prompt.progress = Math.max(0, Math.min(1, this.hold.t / info.holdTime));
    if (this.hold.t >= info.holdTime) {
      this.hold.done = true;
      if (info.cost) this.spend(info.cost);
      if (info.partsCost) { this.parts -= info.partsCost; this.emit('purchase', { amt: 0 }); }
      info.action();
      if (info.repeat) { this.hold.done = false; this.hold.t = 0; } // v1.5 B1/H1: hold to keep going
    }
  }

  // ---------- trader's crate (§17) ----------
  cratePrice() {
    if (this.timed.sale > 0) return T.prices.crate.sale;
    let p = Math.min(T.prices.crate.max, T.prices.crate.base + T.prices.crate.step * this.cratePulls);
    if (this.traderDeal) p = Math.round(p * 0.75 / 10) * 10;
    if (this.traderAnnoyedUntil >= this.round) p += 100;
    return p;
  }
  carried(id) { return this.p.slots.some((w) => w && w.id === id); }
  rollCrate() {
    const entries = [];
    for (const [id, w] of CRATE_WEIGHTS) {
      if (this.carried(id)) continue;
      let wt = w;
      if (id === 'nailgun' && this.nailPity >= T.crate.nailPity) wt = w * Math.pow(2, this.nailPity - T.crate.nailPity + 1);
      entries.push([id, wt]);
    }
    const r = this.rng.weighted(entries);
    this.nailPity = r === 'nailgun' ? 0 : this.nailPity + 1;
    return r;
  }
  useCrate(c, free = false) {
    const sale = this.timed.sale > 0;
    c.price = free ? 0 : this.cratePrice();
    if (!sale && !free) { this.cratePulls++; this.pullsThisStop++; }
    const closed = !sale && !free && !this.luckyPenny && c.idx === this.crateIdx && this.pullsThisStop >= this.crateMoveAt;
    c.item = closed ? 'closed' : this.rollCrate();
    c.cond = this.rollCondition(this.masterPool ? 'master' : null);
    if (this.luckyPenny && !closed) { c.cond = Math.min(4, c.cond + 1); this.luckyPenny = false; }
    if (this.masterPool && !closed) this.masterPool = false;
    if (!free && !sale) this.traderTrigger();
    c.state = 'cycling'; c.t = T.crate.cycleTime;
    this.emit('crateOpen', { x: c.px, y: c.py });
  }
  takeCrate(c) {
    const item = c.item; c.state = 'idle'; c.item = null;
    this.giveItem(item, c.cond ?? 1, true);
    if (item === 'hammer') this.bark('crateHammer', true); else this.bark('crateGood');
  }
  updateCrates() {
    for (const c of this.crates) {
      if (c.beam > 0) c.beam -= DT;
      if (c.state === 'idle') continue;
      c.t -= DT;
      if (c.t > 0) continue;
      if (c.state === 'cycling') {
        if (c.item === 'closed') {
          this.scrap += c.price; this.stats.spent -= c.price;
          c.state = 'moving'; c.t = T.crate.moveTime;
          this.emit('crateClosed', { x: c.px, y: c.py }); this.bark('crateClosed', true);
        } else { c.state = 'ready'; c.t = T.crate.waitTime; this.emit('crateLand', { x: c.px, y: c.py, item: c.item }); }
      } else if (c.state === 'ready') { c.state = 'idle'; c.item = null; this.emit('crateExpire', { x: c.px, y: c.py }); }
      else if (c.state === 'moving') {
        c.state = 'idle'; c.active = false;
        const choices = this.crates.filter((o) => o.idx !== c.idx);
        const n = this.rng.pick(choices);
        n.active = true; n.beam = 10; this.crateIdx = n.idx;
        this.pullsThisStop = 0; this.crateMoveAt = this.rng.int(...T.crate.movePulls);
        this.emit('crateMoved', { x: n.px, y: n.py, zone: n.zone });
      }
    }
  }

  // ---------- workshop (§16) ----------
  describeWorkshop() {
    const ws = this.workshop, p = this.p;
    const D = (label) => ({ label, cost: 0, disabled: true });
    if (ws.state === 'working') return D('Workshop: working...');
    if (ws.state === 'ready') {
      const nm = UPG_NAMES[ws.w.id][ws.w.tier];
      const sub = ws.options ? `Q/E choose: ${ws.options.map((o, i) => (i === ws.choice ? `[${EFFECTS[o].name}]` : EFFECTS[o].name)).join(' / ')}` : 'Tier ' + (ws.w.tier + 1);
      return { label: `Take ${nm}`, cost: 0, holdTime: T.hold.take, action: () => this.takeWorkshop(), sub };
    }
    if (!this.power) return D('Workshop: needs power');
    const w = this.curWeapon();
    if (!w || p.lastChance) return D('Workshop: hold a weapon');
    if (w.tier >= T.workshop.maxTier) return D(`${weaponName(w)}: fully upgraded`);
    return { label: `Upgrade ${weaponName(w)}`, cost: T.prices.workshop[w.tier], holdTime: T.hold.workshop, action: () => this.startWorkshop(), sub: `Becomes ${UPG_NAMES[w.id][w.tier]}` };
  }
  startWorkshop() {
    const p = this.p, ws = this.workshop;
    ws.w = p.slots[p.cur]; ws.slot = p.cur; p.slots[p.cur] = null; p.swing = null; p.reloadT = 0;
    const other = [0, 1, 2, 3].find((i) => p.slots[i]);
    if (other !== undefined) { p.cur = other; }
    ws.state = 'working'; ws.t = T.workshop.workTime; ws.options = null; ws.choice = 0;
    this.emit('workshopStart', { x: ws.px, y: ws.py });
    this.maybeBlowFuse();
    this.bark('workshop');
  }
  takeWorkshop() {
    const p = this.p, ws = this.workshop, w = ws.w;
    w.tier++;
    if (w.tier === 2 && ws.options) w.effect = ws.options[ws.choice];
    if (w.kind === 'gun') { const st = this.gunStats(w); w.mag = st.mag; w.reserve = st.reserve; } else w.dur = Infinity;
    if (w.id === 'blowtorch') w.mag = T.blowtorch.fuel;
    let slot = ws.slot;
    if (p.slots[slot]) {
      if (w.kind === 'gun') { const free = this.gunSlotFor(w.id); if (free !== null) slot = free; else { this.stashWeapon(w); ws.state = 'idle'; ws.w = null; ws.options = null; return; } }
    }
    p.slots[slot] = w; p.cur = -1; this.selectSlot(slot);
    ws.state = 'idle'; ws.w = null; ws.options = null;
    this.emit('workshopTake', { name: weaponName(w) });
    this.emit('banner', { text: weaponName(w).toUpperCase(), sub: w.effect ? `Tier ${w.tier} - ${EFFECTS[w.effect].name}` : `Tier ${w.tier}` });
  }
  updateWorkshop() {
    const ws = this.workshop;
    if (ws.state === 'idle') return;
    ws.t -= DT;
    if (ws.state === 'working' && ws.t <= 0) {
      ws.state = 'ready'; ws.t = T.workshop.waitTime;
      if (ws.w.tier + 1 === 2) { const fx = this.rng.shuffle(Object.keys(EFFECTS).slice()); ws.options = [fx[0], fx[1]]; }
      this.emit('workshopDone', { x: ws.px, y: ws.py });
    } else if (ws.state === 'ready' && ws.t <= 0) {
      this.emit('workshopLost', { name: weaponName(ws.w) });
      ws.state = 'idle'; ws.w = null; ws.options = null;
      const p = this.p; if (!p.slots[0]) p.slots[0] = this.makeWeapon('hammer');
    }
  }

  // ---------- traps (§13) ----------
  armable(t) { return t.kind === 'fence' || t.kind === 'fireline' || t.kind === 'petrol'; }
  armTrap(t, on) { t.armed = on; this.emit('trapArm', { kind: t.kind, x: t.px, y: t.py, on }); }
  // v1.2 B22: an armed trap waits until it's worth it: N of the dead in its area, or one special
  trapReady(t) {
    let n = 0;
    for (const e of this.enemies) {
      if (e.dead || e.state !== 'inside' || e.ally > 0 || !this.inRect(e.x, e.y, t.rect)) continue;
      if (SPECIAL[e.type]) return true;
      if (++n >= T.traps.armN) return true;
    }
    return false;
  }
  activateTrap(t, auto = false) {
    t.activeT = t.active; t.hitSet = new Set(); t.auto = auto;
    if (t.kind !== 'searchlight' || !this.searchlightFixed) this.maybeBlowFuse();
    if (t.kind === 'bell') this.addLure((t.rect[0] + t.rect[2]) / 2, (t.rect[1] + t.rect[3]) / 2, 99999, t.active, 'bell');
    this.emit('trapOn', { kind: t.kind, x: t.px, y: t.py, auto });
  }
  inRect(x, y, r) { return x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]; }
  updateTraps() {
    const p = this.p;
    for (const t of this.traps) {
      if (t.cd > 0) t.cd = Math.max(0, t.cd - DT);
      if (t.armed && t.activeT <= 0 && t.cd <= 0 && this.power && this.trapReady(t)) {
        if (this.canAfford(t.cost)) { if (!this.infinite) this.scrap -= t.cost; this.stats.spent += t.cost; this.activateTrap(t, true); }
        else if (!t.brokeWarned) { t.brokeWarned = true; this.emit('banner', { text: `${t.name.toUpperCase()}: NOT ENOUGH SCRAP`, sub: `It needs ${t.cost.toLocaleString('en-GB')} to fire`, danger: true }); }
      }
      if (t.activeT <= 0) continue;
      t.activeT -= DT;
      if (t.kind === 'bell' && this.tick % 120 === 0) this.emit('bell', { x: t.px, y: t.py });
      if (t.kind !== 'bell') {
        for (const e of this.enemies) {
          if (e.dead || e.state !== 'inside' || !this.inRect(e.x, e.y, t.rect)) continue;
          const src = { kind: 'trap', x: e.x, y: e.y, silent: true, trapId: t.id };
          if (t.kind === 'fence') {
            if (SPECIAL[e.type]) { if (!t.hitSet.has(e)) { t.hitSet.add(e); this.damageEnemy(e, T.traps.fenceSpecialDmg, src); } }
            else { this.emit('zap', { x: e.x, y: e.y }); this.kill(e, src); }
          } else if (t.kind === 'fireline') e.burn = { t: T.fire.burnTime, dps: T.fire.dps * 1.5, trap: true };
          else if (t.kind === 'petrol') { this.damageEnemy(e, (80 + 10 * this.round) * DT, src); if (!e.dead) e.burn = { t: 2, dps: T.fire.dps, trap: true }; }
          else if (t.kind === 'searchlight') { e.slowT = Math.max(e.slowT, 0.1); e.slowAmt = 0.5; e.dazeT = T.searchlight.blindTime; e.lure = null; if (SPECIAL[e.type]) e.outlineT = 1.5; } // v1.2 B19: blinded, they wander
        }
        if (t.kind !== 'searchlight' && !p.dead && this.inRect(p.x, p.y, t.rect) && !this.hasComfort('gasmask')) this.hurtPlayer(T.traps.playerDps * DT, { dot: true });
      }
      if (t.activeT <= 0) {
        t.cd = t.cooldown; this.emit('trapOff', { kind: t.kind });
        if (t.kills) this.emit('banner', { text: `${t.name}: ${t.kills} kill${t.kills === 1 ? '' : 's'}, +${t.earned.toLocaleString('en-GB')} Scrap`, sub: t.auto ? 'It fired on its own' : '', note: true });
        t.kills = 0; t.earned = 0; t.brokeWarned = false;
      }
    }
  }

  // ---------- noise and lures (§22) ----------
  emitNoise(level, x, y, explosion = false) {
    const add = explosion ? T.noise.add.explosion : T.noise.add[level];
    if (add > 0) { this.noise = Math.min(100, this.noise + add); this.noiseIdle = 0; }
    const r = T.noise.radius[level] * (this.noiseMult ? this.noiseMult() : 1);
    this.emit('noise', { level, x, y, r });
    if (r > T.noise.radius.quiet) for (const e of this.enemies) if (e.herdGoal && !e.dead && hyp(e.x - x, e.y - y) <= r) { e.herdGoal = null; e.noticed = true; } // v1.4 E7: noise breaks the herd
    if (r > T.noise.radius.quiet && hyp(x - this.p.x, y - this.p.y) > 40) this.addLure(x, y, r, T.noise.attractTime, 'noise');
  }
  addLure(x, y, r, t, kind) { const l = { id: this.idSeq++, x, y, r, t, kind }; this.lures.push(l); return l; }

  // ---------- rounds (§20) ----------
  updateRound() {
    if (this.attract && this.round === 0) { this.startRound(3); return; }
    if (this.state === 'laststand') { this.updateLastStand(); return; }
    if (this.state === 'pre' || this.state === 'break') {
      this.breakT -= DT;
      if (this.breakT <= 0) this.startRound(this.round + 1);
      return;
    }
    const r = this.round;
    const alive = this.countAlive();
    const cap = T.round.activeCap(r) + (this.noise >= T.noise.t2 ? T.noise.t2Cap : 0);
    // director (§20.6)
    const p = this.p, d = this.director;
    while (this.recentDmg.length && this.t - this.recentDmg[0][0] > 10) this.recentDmg.shift();
    let near = 0; for (const e of this.enemies) if (!e.dead && e.state === 'inside' && hyp(e.x - p.x, e.y - p.y) < 80) near++;
    const dmg10 = this.recentDmg.reduce((a, b) => a + b[1], 0);
    d.pressure = near * 2 + dmg10 / 10 + (p.hp < p.maxHp * 0.4 ? 1 : 0);
    if (d.pressure > T.director.highPressure) { d.high += DT; if (d.high >= T.director.highTime) { d.delayLeft = T.director.delayCount; d.high = 0; } } else d.high = 0;
    let rushNow = false;
    if (d.pressure < T.director.lowPressure && this.toSpawn > 0) { d.low += DT; if (d.low >= T.director.lowTime) { d.low = 0; rushNow = true; } } else d.low = 0;

    const quiet = this.event && this.event.kind === 'quiet';
    if (this.raidRound || quiet) { /* no walkers during a Raider round or the quiet (§17.4, §18) */ }
    else if (this.dogRound) {
      this.dogSpawnT -= DT;
      if (this.dogsToSpawn > 0 && this.dogSpawnT <= 0 && alive + this.pending.length < cap) { this.queueDog(); this.dogSpawnT = Math.max(0.6, T.round.spawnInterval(r)); }
    } else if (this.toSpawn > 0) {
      this.spawnT -= DT;
      if ((this.spawnT <= 0 || rushNow) && alive < cap) {
        this.spawnOne(rushNow);
        let iv = T.round.spawnInterval(r) * (this.noise >= T.noise.t1 ? T.noise.t1Mult : 1);
        if (d.delayLeft > 0) { d.delayLeft--; iv += T.director.delay; }
        this.spawnT = iv;
      }
    }
    for (const q of this.pending) {
      q.t -= DT;
      if (q.t <= 0 && q.type === 'looter' && !this.majorReady()) { q.t = 1; continue; } // v1.5 P1: wait for a quiet moment
      if (q.t <= 0 && (alive < cap || q.type === 'looter')) { q.done = true; if (q.type === 'looter') this.majorMark(); this.spawnPending(q); }
    }
    this.pumpMajor();
    if (this.pending.some((q) => q.done)) this.pending = this.pending.filter((q) => !q.done);

    // last walker (§20.4)
    const remaining = this.remaining();
    if (remaining === 1 && this.toSpawn === 0) {
      const e = this.enemies.find((o) => !o.dead && o.type !== 'looter');
      if (e && e.type !== 'crawler') { e.lastT = (e.lastT || 0) + DT; if (e.lastT > T.lastEnemy.speedUpAfter && !e.sped) { e.sped = true; e.speed = Math.max(e.speed, T.types.runner.speed); this.emit('lastSpeedUp', { x: e.x, y: e.y }); } }
    }
    if (remaining === 0) this.endRound();
  }
  countAlive() { let n = 0; for (const e of this.enemies) if (!e.dead && e.type !== 'looter' && !(e.ally > 0) && !e.extra) n++; return n; }
  // the single straggler, once it is the only thing left (drives the HUD direction arrow)
  lastEnemy() {
    if (this.state !== 'active' || this.toSpawn || this.dogsToSpawn || this.raidersToSpawn || this.pending.some((q) => q.counted)) return null;
    const live = this.enemies.filter((e) => !e.dead && e.type !== 'looter' && !(e.ally > 0));
    return live.length === 1 && this.countAlive() === 1 ? live[0] : null;
  }
  remaining() {
    return this.toSpawn + this.dogsToSpawn + (this.raidersToSpawn || 0) + this.pending.filter((q) => q.counted).length + this.countAlive();
  }
  startRound(r) {
    const p = this.p;
    this.round = r; this.state = 'active'; this.roundKills = 0; this.roundFinds = 0; this.killsSinceFind = 0; this.plankScrap = 0;
    this.ammoCrateUsed = false; this.spawnT = 1.0;
    if (this.bank > 0) { const i = Math.floor(this.bank * T.bank.interest / 10) * 10; this.bank += i; }
    if ((this.power || this.fuseBlown) && r > 1 && this.fuel > 0) {
      this.fuel--;
      if (this.fuel <= 0) { this.power = false; this.emit('powerOut', {}); this.emit('banner', { text: 'THE GENERATOR HAS RUN DRY', sub: 'Jerry cans at the garage', danger: true }); }
      else if (this.fuel <= 2) this.emit('banner', { text: `FUEL LOW: ${this.fuel} WAVE${this.fuel > 1 ? 'S' : ''} LEFT`, sub: 'Jerry cans at the garage', danger: true });
    }
    this.bountyPending = r >= T.bounty.from && !this.attract && this.rng.next() < T.bounty.chance;
    if (this.bountyPending) this.emit('banner', { text: 'A NOTICE ON THE POST OFFICE BOARD', sub: `${T.bounty.scrap} Scrap for the one in the red raincoat` });
    for (const id of p.comforts) {
      p.comfortRounds[id] = (p.comfortRounds[id] || 0) + 1;
      if (p.comfortRounds[id] === T.comforts.ripenRounds) this.emit('banner', { text: `${COMFORTS[id].name.toUpperCase()} HAS RIPENED`, sub: 'A small bonus' });
    }
    this.screamSummoned = 0;
    this.pubRaidFrom = -1; // v1.2 B24
    for (const c of this.cars) if (c.rearm && c.used && !c.battery) { c.used = false; c.t = 0; } // v1.2 B23: the pub car park alarm re-arms each wave
    // v1.3: the premise, as the first wave starts
    if (r === 1 && !this.attract) this.radio('Cain? That shot... the whole city heard it. They\'re coming out of everything. I\'m sorry. I\'m so sorry.', 'Hilltop');
    if (r === 3 && !this.p.secondWind && !this.attract) this.radio('Hunt & Tackle sells Second Wind. Gets you back up once, and it doesn\'t take a comfort slot.', 'Hilltop');
    this.herd = r % T.specials.herdEvery === 0 ? this.rng.pick(['NORTH', 'SOUTH', 'EAST', 'WEST']) : null;
    this.fog = false; this.herdPassed = 0; this.herdTotal = 0; this.herdKills = 0;
    this.dogRound = false; this.raidRound = false; this.toSpawn = 0; this.dogsToSpawn = 0; this.raidersToSpawn = 0;
    if (r === this.nextDogRound && !this.attract && r >= T.raiders.from && this.lastSpecial === 'dogs') {
      // §17.4: from wave 14 Raider rounds alternate with dog rounds
      this.lastSpecial = 'raiders'; this.nextDogRound = r + this.rng.int(...T.dog.every); this.herd = null;
      this.startRaidRound(r);
    } else if (r === this.nextDogRound && !this.attract) {
      this.lastSpecial = 'dogs';
      this.dogRound = true; this.dogRoundCount++;
      this.dogsToSpawn = Math.min(T.dog.cap, T.dog.count + T.dog.step * (this.dogRoundCount - 1));
      this.nextDogRound = r + this.rng.int(...T.dog.every);
      this.dogSpawnT = 3; this.herd = null; this.fog = false; this.leaderSpawned = false;
      if (this.biscuit && !this.biscuit.dead) this.emit('woof', { x: this.biscuit.x, y: this.biscuit.y });
      this.bark('dogs', true);
    } else {
      this.toSpawn = Math.min(T.round.countCap, Math.round(T.round.count(r) * (this.herd ? T.specials.herdMult * this.herdReduce : 1)));
      if (this.herd) { this.herdReduce = 1; this.survivorComment('herd'); }
      if (r >= this.nextBrute && !this.attract) {
        const b = this.pickBarricade();
        // §17.2: from wave 13 the Butcher takes a Brute slot every 6-8 waves
        const butcher = r >= this.nextButcher;
        if (butcher) { this.nextButcher = r + this.rng.int(...T.butcher.every); }
        this.pending.push({ t: T.brute.warn, type: butcher ? 'butcher' : 'brute', counted: true, bar: b });
        this.nextBrute = r + this.rng.int(...T.brute.every);
        this.emit('bruteWarn', { x: b.x, y: b.y, butcher });
        if (butcher) this.emit('banner', { text: 'THE BUTCHER IS COMING', sub: 'Shove him when he winds up a grab. Mash attack if he gets you', danger: true });
        this.bark('brute', true); this.survivorComment('brute');
      }
      if (r >= T.dog.mixFrom) {
        const n = this.rng.int(1, 2);
        for (let i = 0; i < n; i++) { this.toSpawn--; this.pending.push({ t: this.rng.range(10, 40), type: 'dogMix', counted: true }); }
      }
      if (r >= T.looter.from && r - this.lastLooterRound >= T.looter.every && this.rng.next() < T.looter.chance) {
        this.lastLooterRound = r;
        this.pending.push({ t: this.rng.range(6, 20), type: 'looter', counted: false });
      }
    }
    this.roundT0 = this.t; this.majorN = 0;
    const bmax = THROWS.brick.max + (this.hasComfort('barbed') ? 1 : 0);
    if (p.throwable.id === 'brick') p.throwable.count = Math.min(bmax, p.throwable.count + 2);
    if (!this.attract) {
      this.rollWeather(r);
      this.errandsRoundStart(r); this.survivorsRoundStart(r); this.nightsRoundStart(r); this.questRoundStart(r); this.escapeRoundStart(r);
      this.partsRoundStart(r);
    }
    this.emit('roundStart', { round: r, dog: this.dogRound, fog: this.fog, herd: this.herd, raid: this.raidRound, weather: this.weather });
    if (this.herd) this.emit('banner', { key: 'herd', prio: 'objective', text: 'A HERD IS PASSING THROUGH', sub: `From the ${this.herd.toLowerCase()}. Engage them for a bonus, or stay out of sight` });
    if (this.fog) this.emit('banner', { text: 'FOG ROLLS IN', sub: 'Stay close to the light', danger: true });
  }
  // v1.4 E7: every one of the herd dead (none walked out) pays a bonus. Letting them pass is fine too
  herdRoundEnd() {
    if (!this.herdTotal) return;
    if (this.herdKills >= this.herdTotal && !this.herdPassed) { this.addScrap(T.specials.herdBonus, this.p.x, this.p.y - 20, true, null, true); this.card({ key: 'herd.bonus', prio: 'objective', text: 'THE WHOLE HERD', sub: `+${T.specials.herdBonus} Scrap` }); }
    else if (this.herdPassed) this.card({ key: 'herd.passed', text: 'THE HERD HAS PASSED', sub: `${this.herdPassed} walked on out of town` });
    this.herdTotal = 0;
  }
  partsRoundStart(r) {
    // a few Parts lie around town each wave (v1.0 §8.9)
    const have = this.worldItems.filter((w) => w.kind === 'part' && w.fixed).length;
    const spots = Object.keys(this.map.spots).filter((k) => k.startsWith('part_') && this.openZones.has(this.map.spots[k].zone) && !this.worldItems.some((w) => w.spotId === k));
    for (let i = have; i < T.parts.partSpots && spots.length; i++) { const k = spots.splice(Math.floor(this.rng.next() * spots.length), 1)[0]; const sp = this.map.spots[k]; if (this.rng.next() < 0.5) this.addWorldItem({ item: 'part', x: sp.px, y: sp.py, kind: 'part', auto: true, n: 1, fixed: true, spotId: k }); }
  }
  endRound() {
    this.state = 'break'; this.breakT = T.round.break;
    this.raidRound = false;
    for (const k of Object.keys(this.comfortLocks)) if (this.comfortLocks[k] > 0) this.comfortLocks[k]--;
    // v1.4 E6: the Looter runs his whole route even if the wave ends; he only leaves when he's done
    this.fog = false;
    if (!this.attract) { this.errandsRoundEnd(); this.herdRoundEnd(); this.survivorsArm(); }
    this.emit('roundEnd', { round: this.round });
  }
  barricadeSide(b) { if (b.ty <= 21) return 'NORTH'; if (b.ty >= 43) return 'SOUTH'; if (b.tx <= 32) return 'WEST'; return 'EAST'; }
  pickBarricade(nearest = false) {
    let act = this.barricades.filter((b) => this.openZones.has(b.zone));
    if (this.herd) { const h = act.filter((b) => this.barricadeSide(b) === this.herd); if (h.length) act = h; }
    const f = this.field, foc = this.spawnFocus;
    if (foc) act.sort((a, b) => hyp(a.x - foc.px, a.y - foc.py) - hyp(b.x - foc.px, b.y - foc.py));
    else act.sort((a, b) => f[a.inside.ty * MW + a.inside.tx] - f[b.inside.ty * MW + b.inside.tx]);
    if (nearest) return act[0];
    const n = act.length, k = Math.ceil(n / 3);
    const thirds = [act.slice(0, k), act.slice(k, 2 * k), act.slice(2 * k)];
    const wts = this.noise >= T.noise.t2 ? [T.noise.t2Bias, (1 - T.noise.t2Bias) * 0.75, (1 - T.noise.t2Bias) * 0.25] : [0.6, 0.3, 0.1];
    const opts = thirds.map((t, i) => [i, t.length ? wts[i] : 0]);
    const which = this.rng.weighted(opts);
    return this.rng.pick(thirds[which].length ? thirds[which] : act);
  }
  rollType() {
    const r = this.round;
    if (this.rushLeft > 0) { this.rushLeft--; return 'runner'; }
    const x = this.rng.next(); let acc = 0;
    const TT = T.types;
    if (r >= TT.runner.from) { acc += TT.runner.share + (TT.runner.shareMax - TT.runner.share) * Math.min(1, (r - TT.runner.from) / (TT.runner.shareMaxRound - TT.runner.from)); if (x < acc) return 'runner'; }
    if (r >= TT.crawler.from) { acc += TT.crawler.share; if (x < acc) return 'crawler'; }
    if (r >= TT.bloater.from) { acc += TT.bloater.share; if (x < acc) return 'bloater'; }
    if (r >= TT.armoured.from) { acc += TT.armoured.share; if (x < acc) return 'armoured'; }
    if (!this.attract) {
      if (r >= T.tangled.from) { acc += T.tangled.share; if (x < acc) return 'tangled'; }
      if (r >= T.hazmat.from) { acc += T.hazmat.share; if (x < acc) return 'hazmat'; }
      if (r >= T.screamer.from && this.enemies.filter((e) => !e.dead && e.type === 'screamer').length < T.screamer.max) { acc += T.screamer.share * (this.screamBoost ? 4 : 1); if (x < acc) return 'screamer'; }
    }
    return 'walker';
  }
  // ---------- v1.5 P1: one major event at a time, spread through the wave (looters, town events, radio errands) ----------
  majorReady() {
    const P = T.pacing, n = this.majorN || 0;
    return this.state === 'active' && this.t - (this.lastMajorT ?? -99) >= P.gap && this.t - (this.roundT0 || 0) >= P.slots[Math.min(n, P.slots.length - 1)];
  }
  majorMark() { this.lastMajorT = this.t; this.majorN = (this.majorN || 0) + 1; }
  queueMajor(fn) { (this.majorQ ||= []).push(fn); }
  pumpMajor() { if (this.majorQ && this.majorQ.length && this.majorReady()) { this.majorMark(); this.majorQ.shift()(); } }
  rollBasic() { const t = this.rollType(); return t === 'screamer' ? 'walker' : t; }
  spawnOne(nearest = false) {
    this.toSpawn--;
    const type = this.rollType();
    const useDrain = this.drainNest && !this.drainSealed && this.rng.next() < 1 / 3;
    const e = this.spawnAtBarricade(type, useDrain ? this.drainBar() : this.pickBarricade(nearest));
    if (this.bountyPending && type === 'walker') { this.bountyPending = false; e.bounty = true; }
    if (this.herd) { e.herdGoal = this.herdGoalFor(this.herd); e.herd = true; this.herdTotal = (this.herdTotal || 0) + 1; }
    else if (this.safeHouse && this.homeSurvivors().length && type !== 'dog' && this.pubRaidAllowed()) {
      // v1.2 B24: a 20 s warning before the Red Lion is hit, and only while it's bolted or you're within 2 zones
      const far = hyp(this.p.x - this.map.pub.door.x, this.p.y - this.map.pub.door.y) > T.survivors.raidFarDist;
      if (this.rng.next() < (far ? T.survivors.raidChanceFar : T.survivors.raidChance)) {
        if (this.pubRaidFrom < 0) { this.pubRaidFrom = this.t + T.pubRaid.warn; this.emit('banner', { text: 'THE RED LION WILL BE HIT', sub: `In ${T.pubRaid.warn} s. Get back or bolt the door`, danger: true }); this.radio('They\'re heading for the pub. You\'ve got twenty seconds.', this.homeSurvivors()[0].name); }
        else if (this.t >= this.pubRaidFrom && this.enemies.filter((o) => !o.dead && (o.raid || (o.bar && o.bar.safe && o.state === 'outside'))).length < T.aggro.pubMax) e.raid = true; /* v1.5 R1: 1-2 at the pub at most */
      }
    }
    this.maybeReceiverWalker(e);
  }
  drainBar() {
    if (!this.drainB) { const d = this.map.spots.drain; this.drainB = { id: 'drain', drain: true, tx: d.x, ty: d.y, ix: 0, iy: 1, x: d.px, y: d.py, zone: 1, planks: 0, inside: { x: d.px, y: d.py + 10, tx: d.x, ty: d.y }, spawn: { x: d.px, y: d.py }, outer: { x: d.px, y: d.py }, building: false }; }
    return this.drainB;
  }
  queueDog() {
    const pos = this.dogSpot();
    if (!pos) return;
    this.dogsToSpawn--;
    this.pending.push({ t: T.dog.warn, type: 'dog', counted: true, x: pos.x, y: pos.y });
    this.emit('dogWarn', { x: pos.x, y: pos.y });
  }
  dogSpot() {
    const p = this.p;
    for (let k = 0; k < 40; k++) {
      const a = this.rng.next() * Math.PI * 2, d = this.rng.range(T.dog.minDist, T.dog.maxDist);
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
      if (this.solid(tx, ty)) continue;
      const i = ty * MW + tx;
      if (this.field[i] === INF || !this.openZones.has(this.map.zoneId[i])) continue;
      return { x: tx * TS + 8, y: ty * TS + 8 };
    }
    return null;
  }
  spawnPending(q) {
    if (q.type === 'brute' || q.type === 'butcher') { if (q.type === 'brute') this.bruteCount++; const e = this.spawnAtBarricade(q.type, q.bar || this.pickBarricade()); if (q.contract) { e.contract = q.contract; e.bountyName = true; } }
    else if (q.type === 'dog') {
      const e = this.makeEnemy('dog'); e.x = e.ox = q.x; e.y = e.oy = q.y; e.state = 'inside';
      if (this.dogRoundCount >= T.dogLeader.fromRound && !this.leaderSpawned) { this.leaderSpawned = true; e.leader = true; e.hp *= T.dogLeader.hpMult; e.maxHp = e.hp; e.r = 6; }
      this.enemies.push(e); this.emit('dogSpawn', { x: q.x, y: q.y });
    }
    else if (q.type === 'dogMix') { const pos = this.dogSpot(); if (pos) { this.pending.push({ t: T.dog.warn, type: 'dog', counted: true, x: pos.x, y: pos.y }); this.emit('dogWarn', { x: pos.x, y: pos.y }); } else this.toSpawn++; }
    else if (q.type === 'looter') { this.spawnAtBarricade('looter', this.pickBarricade()); this.emit('looter', {}); }
  }
  makeEnemy(type) {
    const r = Math.max(1, this.round), rng = this.rng, base = T.walker.hp(r);
    let hp = base, speed, radius = T.walker.radius, damage = T.walker.damage, windup = T.walker.attackWindup, armour = 0;
    const tier = r <= 3 ? 0 : r <= 6 ? 1 : r < 12 ? (rng.next() < 0.5 ? 1 : 2) : (rng.next() < 0.8 ? 2 : 1);
    speed = T.walker.speeds[tier];
    switch (type) {
      case 'crawler': hp *= T.types.crawler.hpMult; speed = T.types.crawler.speed; break;
      case 'bloater': hp *= T.types.bloater.hpMult; speed = T.types.bloater.speed; break;
      case 'armoured': hp *= T.types.armoured.hpMult; armour = T.types.armoured.armour * base / T.walker.hp(1); break;
      case 'runner': hp *= T.types.runner.hpMult; speed = T.types.runner.speed; break;
      case 'dog': hp = T.dog.hp * Math.pow(T.dog.hpMult, Math.max(0, this.dogRoundCount - 1)); speed = T.dog.speed; damage = T.dog.damage; windup = T.dog.windup; break;
      case 'brute': hp = T.brute.hp + T.brute.hpStep * (this.bruteCount - 1); speed = T.brute.speed; radius = T.brute.radius; damage = T.brute.swipeDamage; windup = 0.6; break;
      case 'looter': hp = T.looter.hp; speed = T.looter.speed; damage = 0; windup = 0.3; break;
      case 'screamer': hp *= 0.7; speed = 40; break;
      case 'hazmat': hp *= 1.2; break;
      case 'tangled': hp *= 1.1; break;
      case 'butcher': this.butcherCount++; hp = T.butcher.hp + T.butcher.growth * (this.butcherCount - 1); speed = T.butcher.speed; radius = T.butcher.radius; damage = 40; windup = 0.6; break;
      case 'raider': hp = 300; speed = 55; damage = 30; windup = 0.4; break;
    }
    if (this.fog) speed *= T.specials.fogSlow;
    if (this.weather === 'still') speed *= T.weather.stillSlow;
    return {
      id: this.idSeq++, type, x: 0, y: 0, ox: 0, oy: 0, r: radius, hp, maxHp: hp, speed, damage, windup, armour, armourMax: armour,
      state: 'inside', stagger: 0, kb: null, atk: 0, atkCD: 0, fx: 0, fy: 1, outfit: rng.int(0, 11), groanT: rng.range(1, 8),
      burn: null, slowT: 0, slowAmt: 0, bleed: 0, bleedT: 0, ally: 0, flash: 0, tearT: 0, lastT: 0, off: rng.range(-5, 5),
      chargeCD: T.brute.chargeEvery, chargeWarn: 0, charging: 0, noticed: false, animT: rng.next() * 10, dead: false,
      steals: 0, stolen: 0, lifeT: 0, moving: false,
    };
  }
  spawnAtBarricade(type, b) {
    const e = this.makeEnemy(type);
    const tx = -b.iy, ty = b.ix;
    e.x = e.ox = b.spawn.x + tx * e.off; e.y = e.oy = b.spawn.y + ty * e.off;
    e.state = 'outside'; e.bar = b; e.fx = b.ix; e.fy = b.iy;
    this.enemies.push(e);
    if (type === 'runner') this.emit('scream', { x: e.x, y: e.y });
    if (type === 'brute' || type === 'butcher') this.emit('bruteSpawn', { x: e.x, y: e.y, type });
    if (SPECIAL[type] && type !== 'dog' && this.hasRole && this.hasRole('lookout')) { e.outlineT = 6; this.emit('lookout', { x: e.x, y: e.y, type }); }
    return e;
  }

  // ---------- enemies (§19) ----------
  updateEnemies() {
    const p = this.p;
    this.anyDied = false;
    for (const e of this.enemies) { if (e.dead) continue; e.ox = e.x; e.oy = e.y; this.updateEnemy(e); }
    // separation + soft body collision with Cain (§6.3)
    const list = this.enemies; const n = list.length;
    let touching = 0;
    for (let i = 0; i < n; i++) {
      const a = list[i]; if (a.dead || a.state !== 'inside') continue;
      for (let j = i + 1; j < n; j++) {
        const b = list[j]; if (b.dead || b.state !== 'inside') continue;
        const dx = b.x - a.x, dy = b.y - a.y; const rr = a.r + b.r - 1;
        if (Math.abs(dx) > rr || Math.abs(dy) > rr) continue;
        let d = hyp(dx, dy), nx = dx, ny = dy;
        if (d < 0.01) { const ang = (a.id * 2.399) % 6.283; nx = Math.cos(ang); ny = Math.sin(ang); d = 1; }
        if (d < rr) { const push = (rr - d) * 0.25; this.moveCircle(a, -nx / d * push, -ny / d * push, a.r); this.moveCircle(b, nx / d * push, ny / d * push, b.r); }
      }
      if (!p.dead && a.ally <= 0) {
        const dx = a.x - p.x, dy = a.y - p.y, d = hyp(dx, dy), rr = a.r + p.r;
        if (d < rr + 2) touching++;
        if (d < rr && d > 0.01) {
          const ov = rr - d;
          this.moveCircle(a, dx / d * ov * 0.7, dy / d * ov * 0.7, a.r);
          if (p.dashT <= 0) this.moveCircle(p, -dx / d * ov * 0.3, -dy / d * ov * 0.3, T.player.footR);
        }
      }
    }
    p.surround = touching;
    if (this.anyDied || this.enemies.some((e) => e.dead || e.gone)) this.enemies = this.enemies.filter((e) => !e.dead && !e.gone);
  }
  enemySpeed(e) {
    let s = e.speed;
    if (e.slowT > 0) s *= 1 - e.slowAmt;
    if (this.sluiceOpen && e.x > 70 * 16 && e.x < 82 * 16 && e.y > 56 * 16 && e.y < 62 * 16) s *= 0.6;
    return s;
  }
  updateEnemy(e) {
    if (e.flash > 0) e.flash--;
    e.animT += DT;
    if (e.outlineT > 0) e.outlineT -= DT;
    if (e.pinnedT > 0) e.pinnedT -= DT;
    if (e.dazeT > 0) e.dazeT -= DT;
    if (e.burn && !e.blazeRolled && !SPECIAL[e.type]) { e.blazeRolled = true; if (this.rng.next() < T.burning.chance) e.blaze = true; }
    if (e.slowT > 0) { e.slowT -= DT; if (e.snared && e.slowAmt >= 0.8) this.damageEnemy(e, 10 * DT, { kind: 'bleed', silent: true, x: e.x, y: e.y }); }
    if (e.chilled > 0) e.chilled -= DT;
    if (e.burn) {
      e.burn.t -= DT;
      this.damageEnemy(e, e.burn.dps * DT, { kind: 'fire', noScrap: e.burn.noScrap, trap: e.burn.trap, silent: true, x: e.x, y: e.y });
      if (this.weather === 'rain' || this.weather === 'storm') e.burn && (e.burn.t -= DT);
      if (e.dead) return;
      if (e.burn.spread) { e.burn.spread = false; for (const o of this.enemies) if (!o.dead && o !== e && !o.burn && hyp(o.x - e.x, o.y - e.y) < e.r + o.r + 2) o.burn = { t: T.fire.burnTime, dps: T.fire.dps }; }
      if (e.burn && e.burn.t <= 0) e.burn = null;
    }
    if (e.bleed > 0) {
      this.damageEnemy(e, 15 * e.bleed * DT, { kind: 'bleed', silent: true, x: e.x, y: e.y });
      if (e.dead) return;
      e.bleedT -= DT; if (e.bleedT <= 0) e.bleed = 0;
    }
    e.groanT -= DT;
    if (e.groanT <= 0) { e.groanT = this.rng.range(...T.walker.groan); if (e.type !== 'raider') this.emit('groan', { x: e.x, y: e.y, type: e.type }); }
    if (e.blindT > 0) { e.blindT -= DT; e.moving = false; const p = this.p, d = hyp(e.x - this.p.x, e.y - this.p.y) || 1; e.fx = (e.x - p.x) / d; e.fy = (e.y - p.y) / d; return; }
    if (e.swayT > 0) { e.swayT -= DT; e.moving = false; return; }
    if (e.kb) { if (e.state === 'inside') this.moveCircle(e, e.kb.vx * DT, e.kb.vy * DT, e.r); e.kb.t -= DT; if (e.kb.t <= 0) e.kb = null; }
    if (e.ally > 0) { this.allyAI(e); return; }
    if (e.stagger > 0) { e.stagger -= DT; e.moving = false; return; }
    e.moving = false;
    if (e.state === 'outside') this.enemyOutside(e);
    else if (e.state === 'climb') {
      e.climbT -= DT;
      const k = 1 - Math.max(0, e.climbT) / e.climbDur;
      e.x = e.climbFrom.x + (e.bar.inside.x - e.climbFrom.x) * k; e.y = e.climbFrom.y + (e.bar.inside.y - e.climbFrom.y) * k;
      if (e.climbT <= 0) { e.state = 'inside'; e.x = e.bar.inside.x; e.y = e.bar.inside.y; if (e.bar.safe) e.inPub = true; this.emit('climbIn', { x: e.x, y: e.y }); }
    } else if (e.type === 'looter') this.looterAI(e);
    else if (e.type === 'raider') this.raiderAI(e);
    else this.enemyInside(e);
    if (e.state === 'inside' && !e.dead && !e.gone) this.unstick(e);
    if (e.blaze && e.burn && e.state === 'inside') {
      const p = this.p;
      if (!p.dead && hyp(p.x - e.x, p.y - e.y) < e.r + p.r + 2 && !this.hasComfort('gasmask')) p.burnT = T.burning.touch;
      for (const f of this.friendlies()) if (hyp(f.x - e.x, f.y - e.y) < 9) this.hurtFriendly(f, 10 * DT);
    }
  }
  enemyOutside(e) {
    const b = e.bar, p = this.p;
    const tx = b.outer.x - b.iy * e.off, ty = b.outer.y + b.ix * e.off;
    const dx = tx - e.x, dy = ty - e.y, d = hyp(dx, dy);
    if (d > 1) { const s = Math.min(d, this.enemySpeed(e) * DT); e.x += dx / d * s; e.y += dy / d * s; e.fx = dx / d; e.fy = dy / d; e.moving = true; return; }
    e.fx = b.ix; e.fy = b.iy;
    if (BIG[e.type] && b.planks > 0 && !(b.safe && (this.pubShut || b.reinforce))) { b.planks = 0; b.lastTear = this.t; this.emit('barricadeSmash', { x: b.x, y: b.y, id: b.id }); this.emit('shake', { amt: 2, t: 0.3 }); }
    if (b.planks <= 0 || e.type === 'looter') {
      e.state = 'climb'; e.climbFrom = { x: e.x, y: e.y };
      e.climbDur = e.climbT = BIG[e.type] ? 0.3 : e.type === 'looter' ? 0.3 : e.bar.drain ? 1.0 : T.barricade.climbTime * (e.type === 'crawler' ? T.types.crawler.climbMult : 1);
      return;
    }
    // v1.2 B1: while a plank stands, a walker outside can't reach you through it (the old §11.1 swipe is gone)
    void p;
    e.tearT += DT * (e.blaze && e.burn ? 1 + 1 / T.burning.plankEvery : 1);
    const RF = b.safe ? { 2: T.pubReinforce.steel.tear, 1: T.pubReinforce.oak.tear } : { 2: T.reinforce.sheet.tear, 1: T.reinforce.bars.tear };
    const rf = (RF[b.reinforce] || T.barricade.tearTime) * (b.safe && this.pubShut ? T.pubSafe.tearMult : 1) * (b.safe && b.reinforce ? T.pubRaid.reinforceMult : 1);
    if (e.tearT >= rf) {
      e.tearT = 0;
      if (b.planks > 0) { b.planks--; b.lastTear = this.t; this.emit('plankTear', { x: b.x, y: b.y, id: b.id, ix: b.ix, iy: b.iy }); if (b.reinforce === 2) this.damageEnemy(e, b.safe ? T.pubReinforce.steel.dmg : T.reinforce.sheet.dmg, { kind: 'trap', silent: true, x: b.x, y: b.y, noTrapScrap: true }); }
    }
  }
  enemyInside(e) {
    const p = this.p;
    if (e.type === 'screamer' && this.screamerAI(e)) return;
    if (e.type === 'butcher' && this.butcherAI(e)) return;
    if (e.mark === 'chief' && this.chiefAI(e)) return;
    if (e.herdGoal && this.herdAI(e)) return;
    if (e.type === 'dog' && this.dogPackAI(e)) return;
    // v1.1 friendly targets: survivors and Biscuit (§9, §10)
    const dP = hyp(p.x - e.x, p.y - e.y);
    let fr = null;
    if (e.type !== 'looter') {
      let bd = e.inPub ? 200 : e.tgtBiscuit ? 400 : 28;
      let standing = null; // v1.2 B3: a downed Biscuit is a target only if nothing standing is within 160 px
      const busy = () => (standing ??= (!p.dead && !p.downed && dP < T.downedTarget) || this.friendlies().some((o) => !o.dead && !o.down && hyp(o.x - e.x, o.y - e.y) < T.downedTarget));
      for (const f of this.friendlies()) { if (f.dead || (f.down && busy()) || (f.kind === 'survivor' && f.state === 'home' && !e.inPub && !(this.inPub(e.x, e.y)))) continue; if (e.tgtBiscuit && f.kind !== 'biscuit') continue; const d = hyp(f.x - e.x, f.y - e.y); if (f.kind === 'biscuit' && !e.inPub && d > T.aggro.dogPath && f.target !== e) continue; /* v1.5 Z2: Biscuit only if he's in the way or biting */ if (d < bd && (d < dP || e.inPub || e.tgtBiscuit)) { bd = d; fr = f; } }
      if (e.inPub && dP < 40) fr = null;
    }
    if (fr) { this.attackFriendly(e, fr); return; }
    if (((e.raid && dP > 64) || this.besieging(e)) && !p.dead) {
      const w = this.safeBars.filter((b) => b.planks >= 0).sort((a, b) => hyp(a.outer.x - e.x, a.outer.y - e.y) - hyp(b.outer.x - e.x, b.outer.y - e.y))[0];
      if (w) {
        if (hyp(w.spawn.x - e.x, w.spawn.y - e.y) < 8) { e.state = 'outside'; e.bar = w; e.off = 0; e.raid = false; return; }
        const f = this.lureField({ id: 'W' + w.id, x: w.spawn.x, y: w.spawn.y });
        const st = nextStep(MW, MH, this.walk, f, Math.floor(e.x / TS), Math.floor(e.y / TS));
        let mx = w.spawn.x - e.x, my = w.spawn.y - e.y; if (st && hyp(mx, my) > 16) { mx = st.x - e.x; my = st.y - e.y; }
        const md = hyp(mx, my); if (md > 0.3) { e.fx = mx / md; e.fy = my / md; e.moving = true; this.moveCircle(e, e.fx * Math.min(md, this.enemySpeed(e) * DT), e.fy * Math.min(md, this.enemySpeed(e) * DT), e.r); }
        return;
      }
    }
    let tx = p.x, ty = p.y, field = this.field, chasing = !p.dead && !(e.dazeT > 0 && e.type !== 'dog') && !(this.smokes.length && this.inSmoke(p.x, p.y) && dP > 10 && e.type !== 'dog');
    if (!chasing && !p.dead && e.type !== 'dog') {
      if (!e.wander || hyp(e.wander.x - e.x, e.wander.y - e.y) < 4) { const a = this.rng.next() * Math.PI * 2; e.wander = { x: e.x + Math.cos(a) * 30, y: e.y + Math.sin(a) * 30 }; }
      tx = e.wander.x; ty = e.wander.y; field = null;
    }
    if (e.lure && (e.lure.t <= 0)) e.lure = null;
    if (e.lure && e.type !== 'dog') { tx = e.lure.x; ty = e.lure.y; field = this.lureField(e.lure); chasing = false; }
    else if (this.timed.guts > 0 && this.timed.bait <= 0 && !e.noticed && e.type !== 'dog') {
      chasing = false;
      if (!e.wander || hyp(e.wander.x - e.x, e.wander.y - e.y) < 4 || this.rng.next() < 0.005) {
        const a = this.rng.next() * Math.PI * 2; e.wander = { x: e.x + Math.cos(a) * 40, y: e.y + Math.sin(a) * 40 };
      }
      tx = e.wander.x; ty = e.wander.y; field = null;
    }
    if (e.type === 'brute' && chasing && this.bruteAI(e)) return;
    if (e.lure && e.lure.kind === 'whistle' && e.lure.stagger && hyp(e.lure.x - e.x, e.lure.y - e.y) < 12 && !e.whistled) { e.whistled = true; e.stagger = 1; }
    const dx = tx - e.x, dy = ty - e.y, d = hyp(dx, dy);
    const edge = d - e.r - p.r;
    if (chasing) {
      if (e.atk > 0) {
        e.atk -= DT; e.fx = dx / (d || 1); e.fy = dy / (d || 1);
        if (e.atk <= 0) { e.atkCD = T.walker.attackCooldown; if (edge <= T.walker.hitReach && this.hurtPlayer(e.damage, e)) e.lastT = 0; }
        return;
      }
      if (e.atkCD > 0) e.atkCD -= DT;
      if (edge <= T.walker.reach && e.atkCD <= 0 && !p.downed) { e.atk = e.windup; this.emit('windup', { x: e.x, y: e.y, type: e.type }); return; }
      if (edge <= 0.5) return;
    }
    let mx = dx, my = dy;
    if (field && (d > 18 || (e.stuck && e.stuck.t >= T.stuck.repath))) {
      const s = nextStep(MW, MH, this.walk, field, Math.floor(e.x / TS), Math.floor(e.y / TS));
      if (s) { mx = s.x - e.x; my = s.y - e.y; }
    }
    const md = hyp(mx, my);
    if (md < 0.01) return;
    let spd = this.enemySpeed(e) * (chasing ? 1 : (this.timed.guts > 0 && !e.lure ? 0.4 : 1));
    const step = Math.min(spd * DT, md + 2);
    e.fx = mx / md; e.fy = my / md; e.moving = true;
    this.moveCircle(e, e.fx * step, e.fy * step, e.r);
  }
  // v1.4 C2: the dead never stay stuck on a prop. < 4 px in 1.5 s while trying to move: follow the nav field;
  // after 3 s, push off the nearest hard tile; after 6 s out of sight, put it on the nearest nav node
  unstick(e) {
    const m = e.stuck || (e.stuck = { t: 0, x: e.x, y: e.y }), S = T.stuck;
    if (!e.moving || e.stagger > 0 || e.atk > 0) { m.t = 0; m.x = e.x; m.y = e.y; return; }
    if (hyp(e.x - m.x, e.y - m.y) >= S.dist) { m.t = 0; m.x = e.x; m.y = e.y; return; }
    m.t += DT;
    if (m.t >= S.nudge) {
      let nx = 0, ny = 0;
      const cx = Math.floor(e.x / TS), cy = Math.floor(e.y / TS);
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if ((ox || oy) && this.solid(cx + ox, cy + oy)) { const tx = (cx + ox) * TS + 8, ty = (cy + oy) * TS + 8, d = hyp(e.x - tx, e.y - ty) || 1; nx += (e.x - tx) / d; ny += (e.y - ty) / d; }
      const n = hyp(nx, ny);
      if (n > 0.01) this.moveCircle(e, nx / n * S.nudgeSpeed * DT + e.fy * S.nudgeSpeed * 0.5 * DT, ny / n * S.nudgeSpeed * DT - e.fx * S.nudgeSpeed * 0.5 * DT, e.r);
    }
    if (m.t >= S.teleport && hyp(e.x - this.p.x, e.y - this.p.y) > S.offscreen) {
      const tx0 = Math.floor(e.x / TS), ty0 = Math.floor(e.y / TS);
      let best = null, bd = Infinity;
      for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) { const tx = tx0 + ox, ty = ty0 + oy; if (this.solid(tx, ty) || this.field[ty * MW + tx] === INF) continue; const d = ox * ox + oy * oy + this.field[ty * MW + tx] * 0.01; if (d < bd) { bd = d; best = [tx, ty]; } }
      if (best) { e.x = e.ox = best[0] * TS + 8; e.y = e.oy = best[1] * TS + 8; }
      m.t = 0; m.x = e.x; m.y = e.y;
    }
  }
  attackFriendly(e, f) {
    const dx = f.x - e.x, dy = f.y - e.y, d = hyp(dx, dy);
    e.fx = dx / (d || 1); e.fy = dy / (d || 1);
    if (e.atk > 0) { e.atk -= DT; if (e.atk <= 0) { e.atkCD = T.walker.attackCooldown; if (d < e.r + 14) this.hurtFriendly(f, e.damage * 0.6, e); } return; }
    if (e.atkCD > 0) e.atkCD -= DT;
    if (d < e.r + 10) { if (e.atkCD <= 0) { e.atk = e.windup; this.emit('windup', { x: e.x, y: e.y, type: e.type }); } return; }
    let mx = dx, my = dy;
    if (d > 18) { const st = nextStep(MW, MH, this.walk, this.lureField({ id: 'F' + Math.floor(f.x / TS) + ',' + Math.floor(f.y / TS), x: f.x, y: f.y }), Math.floor(e.x / TS), Math.floor(e.y / TS)); if (st) { mx = st.x - e.x; my = st.y - e.y; } }
    const md = hyp(mx, my); if (md < 0.3) return;
    e.moving = true; this.moveCircle(e, mx / md * Math.min(md, this.enemySpeed(e) * DT), my / md * Math.min(md, this.enemySpeed(e) * DT), e.r);
  }
  bruteAI(e) {
    const p = this.p, B = T.brute;
    if (e.charging > 0) {
      e.charging -= DT;
      const bx = e.x, by = e.y;
      this.moveCircle(e, e.cvx * DT, e.cvy * DT, e.r);
      if (!e.chargeHit && hyp(e.x - p.x, e.y - p.y) < e.r + p.r + 3) {
        e.chargeHit = true;
        if (this.hurtPlayer(B.chargeDamage, e)) { p.stunT = this.hasComfort('gasmask') ? B.stunGasmask : B.stun; const d = hyp(e.cvx, e.cvy) || 1; this.moveCircle(p, e.cvx / d * 14, e.cvy / d * 14, p.r); this.emit('knockdown', { x: p.x, y: p.y }); }
      }
      if (hyp(e.x - bx, e.y - by) < 0.5) e.charging = 0; // hit a wall
      if (e.charging <= 0) e.chargeCD = B.chargeEvery;
      return true;
    }
    if (e.chargeWarn > 0) {
      e.chargeWarn -= DT;
      if (e.chargeWarn <= 0) { e.charging = B.chargeTime; e.chargeHit = false; this.emit('bruteCharge', { x: e.x, y: e.y }); this.emit('shake', { amt: 2, t: 0.3 }); }
      return true;
    }
    e.chargeCD -= DT;
    const dx = p.x - e.x, dy = p.y - e.y, d = hyp(dx, dy);
    if (e.chargeCD <= 0 && d < 150 && d > 28 && !p.downed && this.lineClear(e.x, e.y, p.x, p.y)) {
      e.chargeWarn = B.chargeWarn; e.cvx = dx / d * B.chargeSpeed; e.cvy = dy / d * B.chargeSpeed; e.fx = dx / d; e.fy = dy / d;
      this.emit('bruteWarnCharge', { x: e.x, y: e.y, dx: dx / d, dy: dy / d });
      return true;
    }
    return false;
  }
  lineClear(x0, y0, x1, y1) {
    const d = hyp(x1 - x0, y1 - y0); const n = Math.ceil(d / 6);
    for (let i = 1; i < n; i++) { const t = this.tileAt(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n); if (t !== FLOOR) return false; }
    return true;
  }
  allyAI(e) {
    e.ally -= DT;
    if (e.ally <= 0) { this.kill(e, { kind: 'trap', noScrap: true, x: e.x, y: e.y }); return; }
    let best = null, bd = Infinity;
    for (const o of this.enemies) if (!o.dead && o !== e && !(o.ally > 0)) { const d = hyp(o.x - e.x, o.y - e.y); if (d < bd) { bd = d; best = o; } }
    if (!best) return;
    if (bd < e.r + best.r + 4) { e.atkCD -= DT; if (e.atkCD <= 0) { e.atkCD = 0.6; this.damageEnemy(best, 100, { kind: 'gun', x: e.x, y: e.y, noHitScrap: true }); } return; }
    const dx = best.x - e.x, dy = best.y - e.y; e.fx = dx / bd; e.fy = dy / bd; e.moving = true;
    this.moveCircle(e, e.fx * e.speed * DT, e.fy * e.speed * DT, e.r);
  }
  // v1.4 E6: the Looter. Easy to spot (a "!", a map icon, an edge arrow), catchable, and he never takes from you:
  // he runs a route of town caches, stopping to grab at each, then leaves. Hurt him once and he drops half his haul.
  looterAI(e) {
    const p = this.p, L = T.looter;
    e.lifeT += DT;
    if (!e.route) this.planLooter(e);
    if (!e.announced && !p.dead) { e.announced = true; this.card({ key: 'looter', prio: 'critical', text: 'A LOOTER IS IN TOWN', sub: 'Follow the red arrow. He\'s robbing the caches', pin: { x: e.x, y: e.y } }); } // v1.5 P2: never missable
    if (!e.spotted && !p.dead && (hyp(p.x - e.x, p.y - e.y) < L.spotR)) {
      e.spotted = true;
      this.card({ key: 'looter', prio: 'critical', text: 'LOOTER SPOTTED', sub: 'He\'s carrying Scrap, catch him', pin: { x: e.x, y: e.y } });
    }
    let tx, ty;
    if (e.grabT > 0) { e.grabT -= DT; e.moving = false; if (e.grabT <= 0) { e.haul += L.cacheScrap; e.stolen = e.haul; this.emit('looterGrab', { x: e.x, y: e.y }); e.route.shift(); } return; }
    if (e.fleeing || !e.route.length) {
      if (!e.exit) { e.exit = this.barricades.filter((b) => this.openZones.has(b.zone)).sort((a, b) => hyp(a.x - e.x, a.y - e.y) - hyp(b.x - e.x, b.y - e.y))[0]; }
      tx = e.exit.inside.x; ty = e.exit.inside.y;
      if (hyp(tx - e.x, ty - e.y) < 6) { e.gone = true; this.emit('looterGone', { x: e.x, y: e.y }); this.resolveCard('looter'); this.card({ key: 'looter.gone', text: 'THE LOOTER GOT AWAY', sub: e.haul ? `With ${e.haul} Scrap you never had` : '' }); return; }
    } else {
      const w = e.route[0]; tx = w.x; ty = w.y;
      if (hyp(tx - e.x, ty - e.y) < 10) { if (w.cache) e.grabT = L.grab; else e.route.shift(); return; }
    }
    const field = this.lureField({ id: 'L' + Math.floor(tx / TS) + ',' + Math.floor(ty / TS), x: tx, y: ty });
    let mx = tx - e.x, my = ty - e.y;
    const s = nextStep(MW, MH, this.walk, field, Math.floor(e.x / TS), Math.floor(e.y / TS));
    if (s && hyp(mx, my) > 18) { mx = s.x - e.x; my = s.y - e.y; }
    const md = hyp(mx, my); if (md < 0.5) return;
    e.fx = mx / md; e.fy = my / md; e.moving = true;
    this.moveCircle(e, e.fx * Math.min(md, this.enemySpeed(e) * DT), e.fy * Math.min(md, this.enemySpeed(e) * DT), e.r);
  }
  planLooter(e) {
    const L = T.looter, p = this.p;
    const caches = LOOTER_CACHES.map((k) => this.map.spots[k]).filter((s2) => s2 && this.openZones.has(s2.zone));
    const n = this.rng.int(...L.caches), route = [];
    // the first one ever is scripted to run right past Cain, so you can't miss him
    if (!this.looterSeen) {
      this.looterSeen = true;
      const a = Math.atan2(e.y - p.y, e.x - p.x) + Math.PI / 2;
      for (const sgn of [1, -1]) { const x = p.x + Math.cos(a) * L.passBy * sgn, y = p.y + Math.sin(a) * L.passBy * sgn; if (!this.solid(Math.floor(x / TS), Math.floor(y / TS))) { route.push({ x, y }); break; } }
    }
    let at = route[0] || e;
    const pool = caches.slice();
    while (route.filter((r) => r.cache).length < n && pool.length) {
      pool.sort((a, b) => hyp(a.px - at.x, a.py - at.y) - hyp(b.px - at.x, b.py - at.y));
      const c = pool.splice(Math.min(pool.length - 1, this.rng.int(0, 1)), 1)[0];
      route.push({ x: c.px, y: c.py, cache: true }); at = { x: c.px, y: c.py };
    }
    e.route = route; e.haul = L.startHaul; e.stolen = e.haul; e.grabT = 0;
  }
  // hurt him once and he drops half of what he's carrying
  looterHurt(e) {
    if (e.droppedHalf || !e.haul) return;
    e.droppedHalf = true;
    const half = Math.round(e.haul / 20) * 10; e.haul -= half; e.stolen = e.haul;
    this.addWorldItem({ item: 'scrap', x: e.x, y: e.y, kind: 'scrap', auto: true, n: half });
    this.card({ key: 'looter.drop', text: 'HE DROPPED SOME', sub: `${half} Scrap on the ground. Kill him for the rest` });
  }

  // ---------- projectiles, throwables, hazards ----------
  updateProjectiles() {
    for (const pr of this.projectiles) {
      if (pr.done) continue;
      pr.ox = pr.x; pr.oy = pr.y;
      const steps = 3;
      for (let k = 0; k < steps && !pr.done; k++) {
        pr.x += pr.vx * DT / steps; pr.y += pr.vy * DT / steps; pr.dist += hyp(pr.vx, pr.vy) * DT / steps;
        const t = this.tileAt(pr.x, pr.y);
        if (t !== FLOOR && t !== BAR) { this.hitPropAt(Math.floor(pr.x / TS), Math.floor(pr.y / TS)); this.endProjectile(pr, true); break; }
        for (const e of this.enemies) {
          if (e.dead || e.ally > 0 || pr.hit.has(e)) continue;
          if (hyp(e.x - pr.x, e.y - pr.y) < e.r + 2) {
            pr.hit.add(e);
            const isHead = this.rng.next() < pr.head; if (isHead) this.stats.heads++;
            const fall = Math.pow(0.75, pr.n);
            this.damageEnemy(e, pr.dmg * fall * (isHead ? 2 : 1), { kind: 'gun', head: isHead, x: pr.x - pr.vx * 0.05, y: pr.y - pr.vy * 0.05, w: pr.w, effect: pr.w.tier >= 2 ? pr.w.effect : null, tier: pr.w.tier });
            if (pr.kind === 'flare') { if (!e.dead) e.burn = { t: 4 * (this.weather === 'rain' || this.weather === 'storm' ? 0.5 : 1), dps: 30 }; this.endProjectile(pr, false); break; }
            if (!e.dead) this.knock(e, 6, pr.x - pr.vx, pr.y - pr.vy);
            pr.n++;
            if (pr.n >= pr.pen) { this.endProjectile(pr, false); break; }
          }
        }
        if (pr.dist >= pr.range) this.endProjectile(pr, false);
      }
    }
    if (this.projectiles.some((p) => p.done)) this.projectiles = this.projectiles.filter((p) => !p.done);
    for (const b of this.bolts) {
      b.t -= DT;
      if (b.t > 0 && hyp(b.x - this.p.x, b.y - this.p.y) < 10) {
        const w = this.p.slots.find((s) => s && s.id === b.gun);
        if (w) { w.reserve = Math.min(this.gunStats(w).reserve, w.reserve + 1); b.t = 0; this.emit('boltPickup', {}); }
      }
    }
    if (this.bolts.some((b) => b.t <= 0)) this.bolts = this.bolts.filter((b) => b.t > 0);
  }
  endProjectile(pr, wall) {
    pr.done = true;
    if (pr.kind === 'bolt') { const bx = pr.x - (wall ? pr.vx * 0.01 : 0), by = pr.y - (wall ? pr.vy * 0.01 : 0); this.bolts.push({ x: bx, y: by, t: 30, gun: pr.gun, ang: Math.atan2(pr.vy, pr.vx) }); }
    if (pr.kind === 'flare') {
      const x = pr.x - (wall ? pr.vx * 0.02 : 0), y = pr.y - (wall ? pr.vy * 0.02 : 0);
      this.fires.push({ x, y, r: 20, t: 6, dps: 30, flare: true });
      this.addLure(x, y, 150, 6, 'flare');
      this.emit('flare', { x, y });
    }
  }
  updateThrown() {
    for (const o of this.thrown) {
      o.t += DT;
      const k = Math.min(1, o.t / o.dur);
      o.x = o.sx + (o.ex - o.sx) * k; o.y = o.sy + (o.ey - o.sy) * k; o.z = Math.sin(k * Math.PI) * 14;
      if (o.id === 'brick') {
        const hit = this.enemies.find((e) => !e.dead && e.ally <= 0 && hyp(e.x - o.x, e.y - o.y) < e.r + 4);
        if (hit) {
          this.damageEnemy(hit, 50, { kind: 'throw', x: o.sx, y: o.sy });
          if (!hit.dead) { hit.stagger = Math.max(hit.stagger, 0.8); hit.atk = 0; }
          if (o.wired) this.snareAt(o.x, o.y);
          this.emit('brickHit', { x: o.x, y: o.y }); o.done = true; continue;
        }
      }
      if (k >= 1) { o.done = true; this.landThrown(o); }
    }
    if (this.thrown.some((o) => o.done)) this.thrown = this.thrown.filter((o) => !o.done);
    for (const b of this.bombs) {
      b.t -= DT;
      if (b.kind === 'alarm' && this.tick % 30 === 0) this.emit('ring', { x: b.x, y: b.y });
      if (b.kind === 'pipe' && b.fuse) { b.beepT -= DT; if (b.beepT <= 0) { const k = Math.max(0, b.t / b.fuse); b.beepT = T.pipeBomb.beepFast + (T.pipeBomb.beepSlow - T.pipeBomb.beepFast) * k; this.emit('pipeBeep', { x: b.x, y: b.y }); } }
      if (b.t <= 0) { b.done = true; this.explode(b.x, b.y, b.dmg, 40, 'player'); }
    }
    if (this.bombs.some((b) => b.done)) this.bombs = this.bombs.filter((b) => !b.done);
  }
  snareAt(x, y) { for (const e of this.enemies) if (!e.dead && hyp(e.x - x, e.y - y) < 40) { e.slowT = 3; e.slowAmt = 0.8; } this.emit('snare', { x, y }); }
  landThrown(o) {
    switch (o.id) {
      case 'brick': if (o.wired) this.snareAt(o.x, o.y); this.emit('brickLand', { x: o.x, y: o.y }); break;
      case 'molotov': this.fires.push({ x: o.x, y: o.y, r: 16, t: 6, dps: T.fire.dps, player: true }); this.emitNoise('medium', o.x, o.y); this.emit('molotov', { x: o.x, y: o.y }); this.igniteNear(o.x, o.y, 20); break;
      case 'pipe': { // v1.4 D3: it beeps and flashes for 4 s, faster and faster, and every zombie for 1.5 screens comes to look
        const PB = T.pipeBomb, l = this.addLure(o.x, o.y, PB.lure, PB.fuse, 'pipe');
        this.bombs.push({ kind: 'pipe', x: o.x, y: o.y, t: PB.fuse, fuse: PB.fuse, dmg: 300, beepT: 0, lure: l });
        for (const e of this.enemies) if (!e.dead && e.state === 'inside' && e.type !== 'brute' && e.type !== 'dog' && e.type !== 'looter' && e.type !== 'raider' && hyp(e.x - o.x, e.y - o.y) <= PB.lure) e.lure = l;
        this.emit('pipeLand', { x: o.x, y: o.y }); break; }
      case 'alarm': this.bombs.push({ kind: 'alarm', x: o.x, y: o.y, t: 6, dmg: 250 }); this.addLure(o.x, o.y, 200, 6, 'alarm'); this.emitNoise('loud', o.x, o.y); break;
    }
  }
  igniteNear(x, y, r) { for (const b of this.barrels) if (b.alive && b.fuse < 0 && hyp(b.px - x, b.py - y) < r + 8) this.igniteBarrel(b); }
  igniteBarrel(b) { if (!b.alive || b.fuse >= 0) return; b.fuse = T.explosive.barrel.fuse; this.emit('hiss', { x: b.px, y: b.py }); }
  triggerCar(c) { if (c.used) return; c.used = true; c.t = 10; this.addLure(c.x, c.y, T.noise.radius.loud, 10, 'car'); this.noise = Math.min(100, this.noise + T.noise.add.loud); this.emit('carAlarm', { x: c.x, y: c.y }); }
  explode(x, y, dmg, radius, src) {
    const p = this.p;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = hyp(e.x - x, e.y - y);
      if (d > radius + e.r) continue;
      this.damageEnemy(e, dmg, { kind: 'explosion', x, y, noScrap: src === 'trap' });
      if (!e.dead) {
        this.knock(e, 16, x, y); e.stagger = Math.max(e.stagger, 0.5);
        if (e.type === 'walker' && this.rng.next() < T.explosive.crawlerChance) { e.type = 'crawler'; e.speed = T.types.crawler.speed; this.emit('crawled', { x: e.x, y: e.y }); }
      }
    }
    if (!p.dead && hyp(p.x - x, p.y - y) <= radius + p.r) {
      if (this.hasComfort('gasmask')) { if (this.ripe('gasmask')) p.hp = Math.min(p.maxHp, p.hp + 10); }
      else this.hurtPlayer(dmg * T.explosive.selfDamageMult, { explosion: true });
    }
    for (const b of this.barrels) if (b.alive && b.fuse < 0 && hyp(b.px - x, b.py - y) < radius + 8) { b.fuse = 0.15; }
    for (const c of this.cars) if (!c.used && hyp(c.x - x, c.y - y) < radius + 12) this.triggerCar(c);
    for (const f of this.friendlies()) if (hyp(f.x - x, f.y - y) < radius + 4) this.hurtFriendly(f, dmg * 0.3);
    for (const wi of this.worldItems) if (wi.shootable && !wi.done && hyp(wi.x - x, wi.y - y) < radius) this.timers.push({ t: 0.15, kind: 'blowItem', wi });
    this.emitNoise('vloud', x, y, true);
    this.emit('explosion', { x, y, r: radius });
    this.emit('shake', { amt: 3, t: 0.2 });
  }
  updateHazards() {
    const p = this.p;
    for (const b of this.barrels) {
      if (!b.alive || b.fuse < 0) continue;
      b.fuse -= DT;
      if (b.fuse <= 0) {
        b.alive = false; this.tiles[b.y * MW + b.x] = FLOOR; this.refreshWalk();
        this.explode(b.px, b.py, T.explosive.barrel.dmg, T.explosive.barrel.radius, 'player');
        this.fires.push({ x: b.px, y: b.py, r: 14, t: 4, dps: T.fire.dps, player: true });
      }
    }
    const wet = this.weather === 'rain' || this.weather === 'storm';
    for (const f of this.fires) {
      f.t -= DT * (wet ? 2 : 1);
      if (f.dps > 0 && this.biscuit && !this.biscuit.dead && hyp(this.biscuit.x - f.x, this.biscuit.y - f.y) < f.r) this.hurtFriendly(this.biscuit, f.dps * 0.5 * DT);
      for (const e of this.enemies) if (!e.dead && hyp(e.x - f.x, e.y - f.y) < f.r + e.r) { if (!e.burn) this.emit('ignite', { x: e.x, y: e.y }); e.burn = { t: T.fire.burnTime, dps: f.dps, noScrap: !!f.trap }; }
      if (!p.dead && hyp(p.x - f.x, p.y - f.y) < f.r + p.r && !this.hasComfort('gasmask')) this.hurtPlayer(f.dps * T.explosive.selfDamageMult * DT, { dot: true });
      if (!f.lit) { f.lit = true; this.igniteNear(f.x, f.y, f.r); }
    }
    if (this.fires.some((f) => f.t <= 0)) this.fires = this.fires.filter((f) => f.t > 0);
    for (const g of this.gas) {
      g.t -= DT;
      if (!p.dead && hyp(p.x - g.x, p.y - g.y) < g.r && !this.hasComfort('gasmask')) this.hurtPlayer((g.hazmat ? T.hazmat.cloudDps : T.types.bloater.gasDps) * DT, { dot: true });
      if (g.hazmat) {
        for (const e of this.enemies) if (!e.dead && hyp(e.x - g.x, e.y - g.y) < g.r) e.hp = Math.min(e.maxHp, e.hp + T.hazmat.healPs * DT);
        if (this.fires.some((f) => hyp(f.x - g.x, f.y - g.y) < g.r + f.r)) { g.t = 0; this.emit('smoke', { x: g.x, y: g.y }); }
      }
    }
    if (this.gas.some((g) => g.t <= 0)) this.gas = this.gas.filter((g) => g.t > 0);
    for (const c of this.cars) if (c.t > 0) { c.t -= DT; if (this.tick % 40 === 0) this.emit('carAlarmTick', { x: c.x, y: c.y }); }
    // lures
    for (const l of this.lures) {
      l.t -= DT;
      if (l.t <= 0) continue;
      for (const e of this.enemies) {
        if (e.dead || e.state !== 'inside' || e.type === 'dog' || e.type === 'looter') continue;
        if (this.timed.bait > 0) continue;
        if (l.kind === 'noise' && e.noticed && hyp(e.x - p.x, e.y - p.y) < 120) continue; // chasing Cain closely
        if (l.kind === 'pipe' && e.type === 'brute') continue; // Brutes ignore the pipe bomb
        if (hyp(e.x - l.x, e.y - l.y) <= l.r && (!e.lure || e.lure.t <= 0 || e.lure.kind === 'noise' || (l.kind === 'pipe' && e.lure.kind !== 'pipe'))) e.lure = l;
      }
    }
    if (this.lures.some((l) => l.t <= 0)) { for (const l of this.lures) if (l.t <= 0) this.lureFields.delete(l.id); this.lures = this.lures.filter((l) => l.t > 0); }
    // noise meter decay
    this.noiseIdle += DT;
    if (this.noiseIdle > T.noise.decayDelay) this.noise = Math.max(0, this.noise - T.noise.decay * DT);
    // streak timeout
    if (this.streak.count && this.t - this.streak.last > T.streak.window) { this.streak.count = 0; this.streak.mult = 0; }
  }

  // ---------- finds (§14) ----------
  drawFind() {
    if (!this.findBag.length) {
      this.findBag = this.rng.shuffle(FIND_TYPES.slice());
      if (this.lastFind === 'ammo' && this.findBag[this.findBag.length - 1] === 'ammo') { const j = this.rng.int(0, this.findBag.length - 2); [this.findBag[j], this.findBag[this.findBag.length - 1]] = [this.findBag[this.findBag.length - 1], this.findBag[j]]; }
    }
    return this.findBag.pop();
  }
  spawnFind(x, y, type = null, forced = false, bonus = false) {
    const t = type || this.drawFind();
    if (!type) this.lastFind = t;
    const rotten = !forced && this.round >= T.finds.rottenFrom && this.rng.next() < T.finds.rottenChance;
    this.finds.push({ id: this.idSeq++, type: t, x, y, t: this.crossword ? -T.finds.lifetime : 0, rotten });
    this.crossword = false;
    if (!bonus) { this.roundFinds++; this.killsSinceFind = 0; }
    this.emit('findSpawn', { x, y, type: t, rotten });
  }
  updateFinds() {
    const p = this.p;
    for (const k of ['adrenaline', 'double', 'sale', 'guts', 'bait']) if (this.timed[k] > 0) { this.timed[k] = Math.max(0, this.timed[k] - DT); if (this.timed[k] === 0) this.emit('findEnd', { type: k }); }
    for (const f of this.finds) {
      f.t += DT;
      if (f.t >= T.finds.lifetime) { f.done = true; this.emit('findExpire', { x: f.x, y: f.y }); continue; }
      if (!p.dead && hyp(f.x - p.x, f.y - p.y) < T.finds.pickupRange) { f.done = true; this.applyFind(f); }
    }
    if (this.finds.some((f) => f.done)) this.finds = this.finds.filter((f) => !f.done);
  }
  applyFind(f) {
    const p = this.p;
    if (f.rotten && this.rng.next() < 0.5) {
      const curse = this.rng.pick(['dry', 'rush', 'bait']);
      if (curse === 'dry') { const w = p.slots[p.cur]; if (w && w.kind === 'gun') w.reserve = 0; }
      if (curse === 'rush') this.rushLeft = T.finds.rushCount;
      if (curse === 'bait') { this.timed.bait = T.finds.baitTime; for (const e of this.enemies) e.lure = null; }
      const names = { dry: 'DRY: your reserve ammo is gone', rush: 'RUSH: the next ten are runners', bait: 'BAIT: every walker wants you' };
      this.emit('banner', { text: 'ROTTEN', sub: names[curse], danger: true });
      this.emit('findPickup', { type: f.type, x: f.x, y: f.y, curse });
      return;
    }
    const F = T.finds;
    switch (f.type) {
      case 'ammo':
        for (const w of [...p.slots, p.lastChance]) if (w) { if (w.id === 'blowtorch') w.mag = Math.min(T.blowtorch.fuel, w.mag + T.blowtorch.fuel * 0.25); else if (w.kind === 'gun') { const st = this.gunStats(w); w.mag = st.mag; w.reserve = st.reserve; } else w.dur = this.maxDur(w); }
        this.repairPaddingLayer();
        p.throwable.count = THROWS[p.throwable.id].max + (p.throwable.id === 'brick' && this.hasComfort('barbed') ? 1 : 0);
        break;
      case 'adrenaline': this.timed.adrenaline = F.timed; break;
      case 'double': this.timed.double = F.timed; break;
      case 'sale': this.timed.sale = F.timed; break;
      case 'guts': this.timed.guts = F.guts; for (const e of this.enemies) e.noticed = false; break;
      case 'wallet': this.addScrap(F.wallet, p.x, p.y - 20, true, null, true); break;
      case 'chainsaw': p.chainsawT = F.timed; p.swing = null; p.reloadT = 0; break;
      case 'toolbox':
        for (const b of this.barricades) b.planks = T.barricade.planks;
        this.addScrap(F.toolboxScrap, p.x, p.y - 20, true, null, true);
        this.emit('toolbox', {});
        break;
      case 'dynamite': this.timers.push({ t: F.dynamiteDelay, kind: 'dynamite' }); break;
    }
    this.emit('findPickup', { type: f.type, x: f.x, y: f.y });
    this.emit('banner', { text: FINDS[f.type].name, sub: '', find: f.type });
    this.bark(f.type, true);
  }
  updateTimers() {
    for (const t of this.timers) {
      t.t -= DT;
      if (t.t > 0) continue;
      t.done = true;
      if (t.kind === 'freeComfort') { if (this.comfortCount() < this.comfortCap() && !this.hasComfort(t.id)) { this.buyComfort(t.id); this.emit('banner', { text: `FREE: ${COMFORTS[t.id].name.toUpperCase()}`, sub: 'He was carrying something' }); } }
      if (t.kind === 'bellBanner') { this.emit('bell', { x: this.p.x, y: this.p.y, code: true }); this.emit('banner', { prio: 'objective', key: 'signal.bell', text: 'THE CHURCH BELL', sub: 'Answer in this order', code: t.code || t.text }); }
      if (t.kind === 'radioLine') this.radio(t.text, t.who);
      if (t.kind === 'blowItem') this.blowItem(t.wi);
      if (t.kind === 'dynamite') {
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (e.type === 'brute') this.damageEnemy(e, T.finds.dynamiteBrute, { kind: 'explosion', noScrap: true, nuke: true, x: e.x, y: e.y });
          else this.kill(e, { kind: 'explosion', noScrap: true, nuke: true, x: e.x, y: e.y });
        }
        this.addScrap(T.finds.dynamiteScrap, this.p.x, this.p.y - 20, true, null, true);
        this.emit('nuke', {});
      }
    }
    if (this.timers.some((t) => t.done)) this.timers = this.timers.filter((t) => !t.done);
  }

  // ---------- debug (§29) ----------
  debugKillAll() { this.toSpawn = 0; this.dogsToSpawn = 0; this.pending = this.pending.filter((q) => !q.counted); for (const e of this.enemies) if (!e.dead) this.kill(e, { kind: 'trap', noScrap: true }); }
  debugSkipTo(r) { this.debugKillAll(); this.round = Math.max(0, r - 1); this.state = 'break'; this.breakT = 0.5; }
  debugOpenAll() { for (const d of this.doors) if (!d.open) this.openDoor(d); if (!this.power) this.startGenerator(); if (!this.pubDoorFixed) this.fixPubDoor(); for (const h of this.hatches) h.fixed = true; }
  debugSpawn(type) { const e = this.spawnAtBarricade(type, this.pickBarricade(true)); if (type === 'brute') this.bruteCount++; return e; }

  hash() {
    let h = 2166136261;
    const mix = (v) => { h ^= Math.round(v * 100) | 0; h = Math.imul(h, 16777619) >>> 0; };
    mix(this.p.x); mix(this.p.y); mix(this.p.hp); mix(this.scrap); mix(this.round); mix(this.enemies.length); mix(this.stats.kills);
    for (const e of this.enemies) { mix(e.x); mix(e.y); mix(e.hp); }
    return h.toString(16);
  }
}

Object.assign(Game.prototype, CoreMixin, ErrandMixin, SurvivorMixin, CompanionMixin, GearMixin, NightsMixin, RaiderMixin, FoesMixin, QuestMixin, EscapeMixin, SafehouseMixin);
