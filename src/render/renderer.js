// World renderer (PRD §23): integer-scaled 480x270 logical canvas, look-ahead camera, y-sorted entities,
// pixel effects and a half-resolution light map with three hard bands (dark / dim / lit).
import { T } from '../tuning.js';
import { buildStatic, MAP_HD } from './mapart.js';
import { FAR_LIGHTS, HILLTOP } from './beyond.js';
import { lampKind } from './scatter.js';
import { charSprite, corpseSprite, viewForDir, icon, hdOf, makeCanvas, shade, pixelText, pixelTextWidth } from './sprites.js';
import { RAMP } from './palette.js';
import { drawProfile, meleeCells, gunCells, chainsawCells } from './weapons.js';
const cellCache = new Map();
const cellsFor = (k, f) => { let c = cellCache.get(k); if (!c) { c = f(); cellCache.set(k, c); } return c; };
const BLOOD = RAMP.blood;
import { dirIndex } from '../sim/game.js';
import { MELEE, GUNS, OUTFITS, EFFECTS, CONDITIONS, CRATE_WEIGHTS, itemValue, valueTint } from '../data.js';
import { palFor } from './sprites.js';

const VW = T.view.w, VH = T.view.h, TS = T.tile;
const LW = VW / 2, LH = VH / 2;
const HD = 2; // the view canvas holds 2 device pixels per logical pixel so HD art can draw half-pixels
const lerp = (a, b, t) => a + (b - a) * t;

export class Renderer {
  constructor(screen, settings) {
    this.screen = screen; this.sctx = screen.getContext('2d');
    this.settings = settings;
    this.view = makeCanvas(VW * HD, VH * HD); this.v = this.view.getContext('2d');
    this.light = makeCanvas(LW, LH); this.lctx = this.light.getContext('2d', { willReadFrequently: true });
    this.overlay = makeCanvas(LW, LH); this.octx = this.overlay.getContext('2d');
    this.overlayData = this.octx.createImageData(LW, LH);
    this.bands = new Uint8Array(LW * LH);
    this.scale = 2;
    this.cam = { x: 0, y: 0, rx: 0, ry: 0 };
    this.shakes = []; this.flash = 0;
    this.wrecks = []; this.scorches = [];
    this.particles = []; this.decals = []; this.corpses = []; this.tracers = []; this.explosions = []; this.arcs = [];
    this.staticMap = null; this.mapRef = null;
    this.time = 0;
    this.tearMarks = new Map();
    this.doorAnims = []; this.rain = []; this.slashes = []; this.rings = [];
    // render-only per-entity memory (never written onto sim objects)
    this.fxMem = new WeakMap(); this.dmgNums = []; this.tracked = new Map(); this.spins = []; this.hurtT = 0; this.radioT = 0; this.biscuitPinT = 0; this.lastHead = null; this.scorches = [];
  }
  // Damage numbers (ART-PRD-2.md, DN): read from hp changes so the sim stays untouched. Hits on one enemy
  // within a short window merge into one number; small, outlined, rise and fade fast; crits in gold.
  trackDamage(g, dt) {
    const live = new Set();
    for (const e of g.enemies) {
      live.add(e);
      let t = this.tracked.get(e);
      if (!t) { this.tracked.set(e, { hp: e.hp, acc: 0, win: 0, crit: false, x: e.x, y: e.y }); continue; }
      if (e.hp < t.hp) {
        t.acc += t.hp - e.hp; if (t.win <= 0) t.win = 0.12;
        const c = this.critAt; if (c && this.time - c.t < 0.05 && Math.abs(c.x - e.x) < 3 && Math.abs(c.y - e.y) < 3) t.crit = true;
      }
      t.hp = e.hp; t.x = e.x; t.y = e.y; t.big = e.type === 'brute' || e.type === 'butcher';
      if (t.win > 0) { t.win -= dt; if (t.win <= 0) this.flushDamage(t); }
    }
    for (const [e, t] of this.tracked) if (!live.has(e)) { if (t.hp > 0 && e.dead) t.acc += t.hp; this.flushDamage(t, !!e.dead); this.tracked.delete(e); } // killing blow
  }
  flushDamage(t, kill = false) {
    const amt = Math.round(t.acc); t.acc = 0; t.win = 0;
    if (amt >= 1 && this.settings.damageNumbers !== false) {
      this.dmgNums.push({ x: t.x + (Math.random() - 0.5) * 8, y: t.y - (t.big ? 30 : 24), amt, crit: t.crit, kill, t: 0, dx: (Math.random() - 0.5) * 6 });
      if (this.dmgNums.length > 40) this.dmgNums.shift();
    }
    t.crit = false;
  }
  drawDamageNumbers(v, ox, oy, p) {
    for (const n of this.dmgNums) {
      const k = n.t / 0.5; if (k >= 1) continue;
      const rise = 1 - Math.pow(1 - Math.min(1, k / 0.6), 3); // ease-out over the first 60%, then hold
      let x = Math.round(n.x + n.dx * rise - ox), y = Math.round(n.y - 10 * rise - oy);
      const txt = String(n.amt), w = pixelTextWidth(txt); x -= w >> 1;
      let a = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      if (Math.abs(n.x - p.x) < 10 && Math.abs(n.y + 10 - p.y) < 16) a *= 0.4; // never sits solid over Cain
      v.globalAlpha = a;
      const pop = n.t < 0.05 ? -1 : 0; // a one-frame pop on spawn
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) pixelText(v, txt, x + dx, y + dy + pop, '#1d1410');
      pixelText(v, txt, x, y + pop, n.crit ? '#f0b030' : n.kill ? '#f2ead6' : '#c8c0ac');
    }
    v.globalAlpha = 1;
  }
  // VA-1: the sim has no enemy ids, so each enemy gets a look seed (0..3) the first time it is drawn, round robin.
  lookOf(e) { const m = this.mem(e); if (m.look === undefined) m.look = (e.id ?? (this.lookSeq = (this.lookSeq || 0) + 1)) % 4; return m.look; }
  mem(o) { let m = this.fxMem.get(o); if (!m) { m = {}; this.fxMem.set(o, m); } return m; }
  resize() {
    const s = Math.max(1, Math.floor(Math.min(window.innerWidth / VW, window.innerHeight / VH)));
    this.scale = s;
    for (const c of [this.screen]) { c.width = VW * s; c.height = VH * s; c.style.width = VW * s + 'px'; c.style.height = VH * s + 'px'; }
    this.sctx.imageSmoothingEnabled = false;
    return s;
  }
  setGame(g, keepCam = false) {
    if (this.mapRef !== g.map.tiles.length || !this.staticMap) { this.staticMap = buildStatic(g.map); this.mapRef = g.map.tiles.length; }
    this.particles = []; this.decals = []; this.corpses = []; this.tracers = []; this.explosions = []; this.arcs = []; this.shakes = []; this.doorAnims = []; this.wrecks = []; this.scorches = []; this.spins = []; this.dmgNums = []; this.tracked = new Map();
    if (!keepCam) this.snapCamera(g);
  }
  snapCamera(g) { const p = g.p; this.cam.x = this.cam.rx = p.x - VW / 2; this.cam.y = this.cam.ry = p.y - VH / 2; this.clampCam(); }
  clampCam() {
    const A = 56; // S3.1: the camera may look 3.5 tiles past the map edge into the baked apron (the player clamp is unchanged)
    this.cam.x = Math.max(-A, Math.min(96 * TS - VW + A, this.cam.x));
    this.cam.y = Math.max(-A - 8, Math.min(64 * TS - VH + A, this.cam.y));
  }

  // ---------- event intake ----------
  consume(g, ev) {
    const R = Math.random;
    switch (ev.type) {
      case 'hit': {
        const dx = ev.x - ev.fx, dy = ev.y - ev.fy, d = Math.hypot(dx, dy) || 1;
        const n = 3 + Math.floor(R() * 4) + (ev.crit || ev.head ? 3 : 0);
        for (let i = 0; i < n; i++) this.blood(ev.x, ev.y, dx / d, dy / d, 40 + R() * 50);
        if (ev.armour) for (let i = 0; i < 3; i++) this.spark(ev.x, ev.y - 10);
        if (ev.head) this.lastHead = { x: ev.x, y: ev.y, t: this.time };
        if (ev.crit || ev.head) this.critAt = { x: ev.x, y: ev.y, t: this.time };
        break;
      }
      case 'kill': {
        if (ev.shatter) { for (let i = 0; i < 14; i++) this.particles.push({ x: ev.x, y: ev.y, z: 10, vx: (R() - 0.5) * 90, vy: (R() - 0.5) * 90, vz: 40 + R() * 40, t: 0, life: 0.8, c: R() < 0.5 ? '#bfe4f0' : '#8ac0d8', s: 2 }); break; }
        const dx = ev.x - ev.fx, dy = ev.y - ev.fy, d = Math.hypot(dx, dy) || 1;
        const type = ev.enemy || ev.type;
        const mode = ev.kind === 'explosion' ? 'gore' : ev.kind === 'fire' || ev.feel === 'fire' ? 'char' : type === 'bloater' || type === 'hazmat' ? 'gas' : 'n';
        if (mode !== 'char') for (let i = 0; i < 10; i++) this.blood(ev.x, ev.y, dx / d, dy / d, 50 + R() * 70);
        if (mode === 'gore') { // chunks and a radial scorch
          for (let i = 0; i < 8; i++) this.particles.push({ x: ev.x, y: ev.y, z: 8, vx: (R() - 0.5) * 140, vy: (R() - 0.5) * 140, vz: 50 + R() * 50, t: 0, life: 1.2, c: R() < 0.5 ? '#6a1e18' : '#79b04c', s: 2, blood: true });
          this.addScorch(ev.x, ev.y, 10);
        }
        if (ev.feel === 'blade' || ev.feel === 'chop' || ev.feel === 'blunt') this.splash(ev.x, ev.y, dx / d, dy / d, ev.feel === 'blunt' ? 6 : 10);
        const lh = this.lastHead; if (lh && this.time - lh.t < 0.05 && Math.hypot(lh.x - ev.x, lh.y - ev.y) < 4) this.splash(ev.x + dx / d * 6, ev.y - 6 + dy / d * 4, dx / d, dy / d, 8);
        const seed = ((Math.round(ev.x) * 73856093) ^ (Math.round(ev.y) * 19349663)) >>> 0; // VA-7: pose and mirror from where it fell
        this.corpses.push({ x: ev.x, y: ev.y, t: 0, type, outfit: ev.outfit, flip: (dx < 0) !== !!(seed & 8), pose: (seed >>> 4) % 3, mode, leader: ev.leader, role: ev.role });
        if (this.corpses.length > T.fx.corpseCap) this.corpses.shift();
        break;
      }
      case 'shot':
        for (const t of ev.tracers) this.tracers.push({ ...t, t: 0.05, tier: ev.tier, eff: ev.effect });
        this.muzzleBig = ev.id === 'shotgun' || ev.id === 'dbarrel' || ev.id === 'ar' || ev.id === 'rifle' ? 1 : 0;
        if (ev.id === 'shotgun' || ev.id === 'dbarrel' || ev.id === 'rifle') this.addShake(1, 0.06);
        this.particles.push({ x: g.p.x, y: g.p.y, z: 10, vx: (R() - 0.5) * 40, vy: (R() - 0.5) * 40, vz: 30, t: 0, life: 5, c: '#c9a24a', s: 1, casing: true });
        break;
      case 'impact': if (ev.wall) for (let i = 0; i < 2; i++) this.spark(ev.x, ev.y); break;
      case 'explosion': this.explosions.push({ x: ev.x, y: ev.y, r: ev.r, t: 0 }); this.addScorch(ev.x, ev.y, Math.min(24, ev.r * 0.5)); if (this.settings.flashing === 'full') this.flash = 0.2;
        for (let i = 0; i < 18; i++) this.particles.push({ x: ev.x, y: ev.y, z: 4, vx: (R() - 0.5) * 160, vy: (R() - 0.5) * 160, vz: 40 + R() * 60, t: 0, life: 0.7, c: R() < 0.5 ? '#e2b53c' : '#d9822b', s: 2 });
        for (let i = 0; i < 6; i++) this.smoke(ev.x + (R() - 0.5) * ev.r, ev.y + (R() - 0.5) * ev.r, 1.6);
        break;
      case 'nuke': if (this.settings.flashing === 'full') this.flash = 0.8; else this.flash = 0.25; break;
      case 'shake': this.addShake(ev.amt, ev.t); break;
      case 'scrap': if (ev.x !== undefined && this.settings.popups !== false) for (let i = 0; i < Math.min(3, 1 + Math.floor((ev.amt || 0) / 100)); i++) this.particles.push({ x: ev.x + (Math.random() - 0.5) * 6, y: ev.y, z: 12, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 10, vz: 50 + Math.random() * 20, t: 0, life: 0.6, c: '#c9a24a', s: 2, bolt: true }); break;
      case 'hurt': this.addShake(1, 0.15); this.hurtT = 2 / 30; break;
      case 'radio': if (ev.who === 'Hilltop') this.radioT = 2.5; break;
      case 'pinned': this.biscuitPinT = 1; break;
      case 'plankTear': {
        this.tearMarks.set(ev.id, g.t);
        for (let i = 0; i < 4; i++) this.particles.push({ x: ev.x, y: ev.y, z: 8, vx: ev.ix * (30 + R() * 50) + (R() - 0.5) * 30, vy: ev.iy * (30 + R() * 50) + (R() - 0.5) * 30, vz: 30, t: 0, life: 0.6, c: '#c49a62', s: 2 });
        break;
      }
      case 'barricadeSmash': this.tearMarks.set(ev.id, g.t); for (let i = 0; i < 12; i++) this.particles.push({ x: ev.x, y: ev.y, z: 8, vx: (R() - 0.5) * 120, vy: (R() - 0.5) * 120, vz: 40, t: 0, life: 0.8, c: '#c49a62', s: 2 }); break;
      case 'plankRepair': for (let i = 0; i < 3; i++) this.particles.push({ x: ev.x + (R() - 0.5) * 12, y: ev.y, z: 2, vx: 0, vy: 0, vz: 50, t: 0, life: 0.3, c: '#e8dfc6', s: 1 }); break;
      case 'doorOpen': this.doorAnims.push({ id: ev.id, t: 0 }); for (let i = 0; i < 16; i++) this.particles.push({ x: ev.x + (R() - 0.5) * 40, y: ev.y + (R() - 0.5) * 20, z: 6, vx: (R() - 0.5) * 80, vy: (R() - 0.5) * 80, vz: 40, t: 0, life: 0.7, c: R() < 0.5 ? '#8f6a3e' : '#6f787d', s: 2 }); for (let i = 0; i < 4; i++) this.smoke(ev.x + (R() - 0.5) * 30, ev.y, 1.2); break;
      case 'burst': for (let i = 0; i < 8; i++) this.smoke(ev.x + (R() - 0.5) * 30, ev.y + (R() - 0.5) * 30, 2, '#7a8a4a'); break;
      case 'smoke': case 'looterGone': for (let i = 0; i < 10; i++) this.smoke(ev.x + (R() - 0.5) * 24, ev.y + (R() - 0.5) * 24, 2, '#8c8f86'); break;
      case 'dogWarn': case 'dogSpawn': for (let i = 0; i < 6; i++) this.smoke(ev.x + (R() - 0.5) * 14, ev.y + (R() - 0.5) * 10, 1.2, '#9aa3b0'); break;
      case 'findExpire': for (let i = 0; i < 5; i++) this.smoke(ev.x + (R() - 0.5) * 8, ev.y, 0.8, '#c8bf9a'); break;
      case 'zap': for (let i = 0; i < 5; i++) this.spark(ev.x, ev.y - 8, '#9ad0ff'); break;
      case 'arc': this.arcs.push({ ...ev, t: 0.15 }); break;
      case 'meleeHit': {
        // v1.1 weapon feel: blunt thuds raise dust and a shock ring; blades draw a bright slash and spray more; stabs spark
        const fx = ev.fx || 0, fy = ev.fy || 1, eff = ev.effect ? EFFECTS[ev.effect].color : null;
        if (ev.feel === 'blunt') { this.rings.push({ x: ev.x, y: ev.y, t: 0, life: 0.18, r: ev.heavy ? 12 : 8, c: eff || '#e8dfc6' }); for (let i = 0; i < 5; i++) this.smoke(ev.x + (R() - 0.5) * 8, ev.y + 4, 0.4, '#a89a80'); if (ev.heavy) this.addShake(1, 0.06); }
        else if (ev.feel === 'blade' || ev.feel === 'chop') { this.slashes.push({ x: ev.x, y: ev.y - 8, a: Math.atan2(fy, fx) + Math.PI / 2 + (R() - 0.5) * 0.6, t: 0, life: 0.12, len: ev.feel === 'chop' ? 9 : 12, c: eff || '#ffffff' }); for (let i = 0; i < 4; i++) this.blood(ev.x, ev.y, fx, fy, 70 + R() * 60); }
        else if (ev.feel === 'stab') { for (let i = 0; i < 4; i++) this.spark(ev.x + fx * 4, ev.y - 8 + fy * 4, eff || '#f0ead8'); }
        for (let i = 0; i < (ev.heavy ? 4 : 2); i++) this.particles.push({ x: ev.x, y: ev.y, z: 10, vx: (R() - 0.5) * 60, vy: (R() - 0.5) * 60, vz: 20, t: 0, life: 0.15, c: eff || '#f0ead8', s: 1 });
        if (ev.tier >= 3) for (let i = 0; i < 3; i++) this.spark(ev.x, ev.y - 8, '#f0b030');
        break;
      }
      case 'flame': for (let i = 0; i < 6; i++) { const a = ev.ang + (R() - 0.5) * 0.8, sp = 60 + R() * 80; this.particles.push({ x: g.p.x + Math.cos(ev.ang) * 6, y: g.p.y + Math.sin(ev.ang) * 6, z: 8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 10, t: 0, life: ev.r / sp, c: ev.tier >= 1 ? (R() < 0.5 ? '#9ad0ff' : '#e2b53c') : (R() < 0.5 ? '#e2b53c' : '#d9822b'), s: 2, grav: 0, smoke: false, flame: true }); } break;
      case 'trick': if (ev.id === 'flare') this.flash = Math.max(this.flash, 0.25); if (ev.id === 'smoke') for (let i = 0; i < 16; i++) this.smoke(ev.x + (R() - 0.5) * 40, ev.y + (R() - 0.5) * 30, 2.5, '#b8bcc0'); this.rings.push({ x: ev.x, y: ev.y, t: 0, life: 0.4, r: 30, c: '#f0d070' }); break;
      case 'lightning': if (this.settings.flashing === 'full') this.flash = 0.5; else this.flash = 0.2; break;
      case 'bite': for (let i = 0; i < 3; i++) this.blood(ev.x, ev.y, 0, 0, 40); break;
      case 'padBreak': for (let i = 0; i < 8; i++) this.particles.push({ x: ev.x, y: ev.y, z: 10, vx: (R() - 0.5) * 80, vy: (R() - 0.5) * 80, vz: 30, t: 0, life: 0.5, c: '#c8bf9a', s: 1 }); break;
      case 'biscuitBark': this.rings.push({ x: ev.x, y: ev.y, t: 0, life: 0.3, r: ev.r, c: '#e8dfc6' }); break;
      case 'chargeReady': this.readyAt = this.time; this.rings.push({ x: ev.x, y: ev.y, t: 0, life: 0.2, r: 16, c: '#ffffff' }); break;
      case 'powerAttack': this.spins.push({ x: ev.x, y: ev.y, r: ev.r, t: 0 }); for (let i = 0; i < 8; i++) this.particles.push({ x: ev.x, y: ev.y, z: 4, vx: (R() - 0.5) * 120, vy: (R() - 0.5) * 90, vz: 30 + R() * 30, t: 0, life: 0.5, c: R() < 0.5 ? '#8f6a3e' : '#8c8f86', s: 1 }); this.rings.push({ x: ev.x, y: ev.y, t: 0, life: 0.25, r: ev.r, c: '#f0d070' }); for (let i = 0; i < 10; i++) this.smoke(ev.x + Math.cos(i * 0.63) * ev.r * 0.7, ev.y + 4 + Math.sin(i * 0.63) * ev.r * 0.5, 0.4, '#a89a80'); break;
      case 'slam': this.rings.push({ x: ev.x, y: ev.y, t: 0, life: 0.2, r: 12, c: '#e8dfc6' }); this.addShake(1, 0.05); break;
      case 'survivorShot': this.tracers.push({ x1: ev.x1, y1: ev.y1 + 8, x2: ev.x2, y2: ev.y2 + 8, t: 0.05, tier: 0 }); break;
      case 'soldierShot': this.tracers.push({ x1: ev.x1, y1: ev.y1 + 8, x2: ev.x2, y2: ev.y2 + 8, t: 0.08, tier: 3 }); break;
      case 'busCrash': // the wreck itself is sim state (g.wrecks); falls through to the smoke
      case 'heliIncoming': for (let i = 0; i < 20; i++) this.smoke(ev.x + (R() - 0.5) * 50, ev.y + (R() - 0.5) * 30, 2, '#6b6f75'); break;
      case 'teleport': for (let i = 0; i < 10; i++) this.smoke(ev.x + (R() - 0.5) * 24, ev.y + (R() - 0.5) * 24, 1, '#c8bf9a'); break;
      case 'screamWind': this.rings.push({ x: ev.x, y: ev.y - 14, t: 0, life: 1, r: 18, c: '#e03a2a' }); break;
      case 'engineStart': this.flash = Math.max(this.flash, 0.15); break;
      case 'exhaust': for (let i = 0; i < 2; i++) this.smoke(ev.x, ev.y, 1.2, i ? '#8c8f86' : '#4a4d52'); if (ev.k > 0.2) this.smoke(ev.x + (Math.random() - 0.5) * 20, ev.y + 4, 0.7, '#a89070'); break; // v1.5 L2: exhaust and road dust
      case 'workshopDone': case 'workshopStart': for (let i = 0; i < 8; i++) this.spark(ev.x, ev.y + 4); break;
      case 'crateMoved': case 'crateClosed': for (let i = 0; i < 8; i++) this.smoke(ev.x + (R() - 0.5) * 16, ev.y, 1.2, '#c8bf9a'); break;
      case 'roundStart': for (const d of this.decals) d.fading = true; for (const sc of this.scorches) sc.fade = true; break;
      case 'power': this.powerT = 0; break;
      case 'revive': for (let i = 0; i < 10; i++) this.smoke(ev.x + (R() - 0.5) * 40, ev.y + (R() - 0.5) * 40, 0.8, '#e8dfc6'); break;
    }
  }
  blood(x, y, dx, dy, sp) {
    const R = Math.random;
    this.particles.push({ x, y, z: 10 + R() * 6, vx: dx * sp + (R() - 0.5) * 40, vy: dy * sp + (R() - 0.5) * 40, vz: 20 + R() * 40, t: 0, life: 2, c: R() < 0.7 ? BLOOD.fresh : BLOOD.freshHi, s: R() < 0.3 ? 2 : 1, blood: true });
  }
  // a directional splash decal (melee kills, headshot spray): a cone of pixels thrown along the hit
  splash(x, y, dx, dy, len) {
    const R = Math.random;
    for (let i = 0; i < len + 4; i++) { const k = R() * len, sp = (R() - 0.5) * (1 + k * 0.6); this.addDecal(x + dx * k - dy * sp, y + dy * k + dx * sp, R() < 0.75 ? BLOOD.fresh : BLOOD.freshHi, R() < 0.25 ? 2 : 1); }
  }
  addScorch(x, y, r) { this.scorches.push({ x, y, r, a: 0.6, seed: Math.floor(Math.random() * 1e6) }); if (this.scorches.length > 40) this.scorches.shift(); }
  spark(x, y, c = '#f0d070') { const R = Math.random; this.particles.push({ x, y, z: 2, vx: (R() - 0.5) * 120, vy: (R() - 0.5) * 120, vz: 30 + R() * 30, t: 0, life: 0.25, c, s: 1 }); }
  smoke(x, y, life = 1.5, c = '#6b6f75') { const R = Math.random; this.particles.push({ x, y, z: 4, vx: (R() - 0.5) * 10, vy: (R() - 0.5) * 6, vz: 12, t: 0, life, c, s: 3, smoke: true, grav: 0 }); }
  addShake(amt, t) { const m = this.settings.shake === 'off' ? 0 : this.settings.shake === 'reduced' ? 0.5 : 1; if (m) this.shakes.push({ amt: Math.max(1, Math.round(amt * m)), t }); }

  // ---------- update ----------
  update(g, dt, follow = true) {
    this.dogPh = (this.dogPh || 0) + dt * (1.2 + 7 * (g.biscuitDanger ? g.biscuitDanger() : 0));
    this.time += dt;
    const p = g.p;
    if (follow) {
      const dest = g.cellarDest ? g.cellarDest() : null; // in the cellars the camera goes to look at the picked exit
      const tx = dest ? dest.x - VW / 2 : p.x + p.fx * T.camera.lookAhead - VW / 2, ty = dest ? dest.y - 8 - VH / 2 : p.y - 8 + p.fy * T.camera.lookAhead - VH / 2;
      const k = 1 - Math.pow(1 - (dest ? 0.12 : T.camera.lerp), dt * 60);
      this.cam.x += (tx - this.cam.x) * k; this.cam.y += (ty - this.cam.y) * k;
      this.clampCam();
    }
    for (const s of this.shakes) s.t -= dt;
    this.shakes = this.shakes.filter((s) => s.t > 0);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
    for (const pt of this.particles) {
      pt.t += dt;
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      if (pt.smoke) { pt.z += pt.vz * dt; continue; }
      pt.vz -= 220 * dt; pt.z += pt.vz * dt;
      if (pt.z <= 0) {
        pt.z = 0; pt.vx *= 0.3; pt.vy *= 0.3; pt.vz = 0;
        if (pt.blood) { this.addDecal(pt.x, pt.y, pt.c, pt.s); pt.t = pt.life; }
        if (pt.casing && !pt.bounced) { pt.bounced = true; pt.vz = 22; pt.vx *= 2; pt.vy *= 2; } // brass bounces once
      }
    }
    this.particles = this.particles.filter((pt) => pt.t < pt.life);
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
    for (const d of this.decals) if (d.fading) d.a -= dt / 8;
    this.decals = this.decals.filter((d) => d.a > 0);
    for (const c of this.corpses) c.t += dt;
    this.corpses = this.corpses.filter((c) => c.t < T.fx.corpseLife);
    for (const t of this.tracers) t.t -= dt;
    this.tracers = this.tracers.filter((t) => t.t > 0);
    for (const e of this.explosions) e.t += dt;
    this.explosions = this.explosions.filter((e) => e.t < 0.45);
    for (const a of this.arcs) a.t -= dt;
    this.arcs = this.arcs.filter((a) => a.t > 0);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter((r) => r.t < r.life);
    for (const r of this.slashes) r.t += dt;
    this.slashes = this.slashes.filter((r) => r.t < r.life);
    const wet = g.weather === 'rain' || g.weather === 'storm';
    if (wet && dt > 0) { const n = g.weather === 'storm' ? 14 : 8; for (let i = 0; i < n && this.rain.length < 300; i++) this.rain.push({ x: this.cam.x + Math.random() * (VW + 60) - 20, y: this.cam.y - 10 + Math.random() * VH * 0.9, t: 0, life: 0.25 + Math.random() * 0.2 }); }
    for (const r of this.rain) { r.t += dt; r.x -= 90 * dt; r.y += 260 * dt; }
    this.rain = this.rain.filter((r) => r.t < r.life);
    for (const d of this.doorAnims) d.t += dt;
    this.doorAnims = this.doorAnims.filter((d) => d.t < 0.6);
    if (this.powerT !== undefined) this.powerT += dt;
    this.trackDamage(g, dt);
    this.hurtT = Math.max(0, this.hurtT - dt); this.radioT = Math.max(0, this.radioT - dt); this.biscuitPinT = Math.max(0, this.biscuitPinT - dt);
    for (const s2 of this.spins) s2.t += dt;
    for (const n of this.dmgNums) n.t += dt;
    this.dmgNums = this.dmgNums.filter((n) => n.t < 0.5);
    this.spins = this.spins.filter((s2) => s2.t < 0.25);
    for (const sc of this.scorches) if (sc.fade) sc.a -= dt / 10;
    this.scorches = this.scorches.filter((sc) => sc.a > 0);
  }
  addDecal(x, y, c, s) {
    // group nearby pixels into decal clusters so the 200-decal cap is meaningful
    const last = this.decals[this.decals.length - 1];
    if (last && !last.fading && Math.abs(last.x - x) < 24 && Math.abs(last.y - y) < 24 && last.px.length < 40) { last.px.push([Math.round(x), Math.round(y), c, s]); return; }
    this.decals.push({ x, y, a: 1, born: this.time, px: [[Math.round(x), Math.round(y), c, s]] });
    if (this.decals.length > T.fx.decalCap) this.decals.shift();
  }

  // ---------- draw ----------
  draw(g, alpha, opts = {}) {
    const v = this.v, p = g.p;
    let sx = 0, sy = 0;
    for (const s of this.shakes) { sx += Math.round((Math.random() * 2 - 1) * s.amt); sy += Math.round((Math.random() * 2 - 1) * s.amt); }
    const cx = Math.round(this.cam.x), cy = Math.round(this.cam.y);
    this.cam.rx = cx - sx; this.cam.ry = cy - sy;
    v.setTransform(HD, 0, 0, HD, 0, 0); v.imageSmoothingEnabled = false;
    v.fillStyle = '#10140e'; v.fillRect(0, 0, VW, VH);
    { const M = MAP_HD; v.drawImage(this.staticMap, (cx - sx + (this.staticMap.ox || 0)) * M, (cy - sy + (this.staticMap.oy || 0)) * M, VW * M, VH * M, 0, 0, VW, VH); }
    v.save(); v.translate(-cx + sx, -cy + sy);
    const inView = (x, y, m = 40) => x > cx - m && x < cx + VW + m && y > cy - m && y < cy + VH + m;

    // ground layer
    if (g.weather === 'rain' || g.weather === 'storm') { v.fillStyle = 'rgba(160,190,220,0.12)'; for (let i = 0; i < 40; i++) { const sx2 = cx + ((i * 97 + Math.floor(this.time * 3) * 13) % VW), sy2 = cy + ((i * 61) % VH); v.fillRect(sx2, sy2, 3 + (i % 3), 1); } } // wet sheen
    for (const sc of this.scorches) if (inView(sc.x, sc.y)) this.drawScorch(v, sc);
    for (const d of this.decals) { if (!inView(d.x, d.y)) continue; v.globalAlpha = Math.max(0, Math.min(1, d.a)); const old = this.time - (d.born || 0) > 20; for (const [x, y, c, s] of d.px) { v.fillStyle = old && (c === BLOOD.fresh || c === BLOOD.freshHi) ? BLOOD.old : c; v.fillRect(x, y, s, s); } }
    v.globalAlpha = 1;
    for (const c of this.corpses) if (inView(c.x, c.y)) this.drawCorpse(v, c);
    this.drawTrapAreas(v, g);
    for (const w of g.wrecks || []) for (const [bx, by] of w.breach || []) if (inView(bx * TS, by * TS)) { v.fillStyle = '#4a4234'; v.fillRect(bx * TS, by * TS - 6, TS, TS + 6); v.fillStyle = '#5a5040'; v.fillRect(bx * TS + 2, by * TS - 4, TS - 4, TS + 2); this.drawRubble(v, bx * TS, by * TS - 4, bx * 7 + by); this.drawRubble(v, bx * TS, by * TS + 4, bx * 3 + by); } // C3: the fence is gone here
    this.drawMastLights(v, g);
    for (const f of g.fires) if (inView(f.x, f.y)) this.drawFire(v, f.x, f.y, f.r, f.t, f);
    for (const gs of g.gas) this.drawGas(v, gs);
    for (const b of g.bolts) { v.fillStyle = '#8f6a3e'; const dx = Math.cos(b.ang), dy = Math.sin(b.ang); for (let i = 0; i < 6; i++) v.fillRect(Math.round(b.x - dx * i), Math.round(b.y - dy * i), 1, 1); v.fillStyle = '#e8dfc6'; v.fillRect(Math.round(b.x - dx * 6), Math.round(b.y - dy * 6), 1, 1); }
    if (g.sluiceOpen) { v.fillStyle = 'rgba(60,110,150,0.45)'; v.fillRect(70 * TS, 56 * TS, 12 * TS, 6 * TS); for (let i = 0; i < 12; i++) { v.fillStyle = 'rgba(160,200,230,0.4)'; v.fillRect(70 * TS + ((i * 37 + Math.floor(this.time * 20)) % (12 * TS)), 56 * TS + (i * 23) % (6 * TS), 5, 1); } }
    { const d = g.map.spots.drain; if (!g.drainSealed) { v.fillStyle = '#1d1d22'; v.fillRect(d.px - 6, d.py - 4, 12, 8); v.fillStyle = '#4a4d52'; for (let i = 0; i < 4; i++) v.fillRect(d.px - 5 + i * 3, d.py - 4, 1, 8); if (g.drainNest) { v.fillStyle = 'rgba(122,150,70,0.4)'; v.fillRect(d.px - 8, d.py - 6, 16, 12); } } else { v.fillStyle = '#c49a62'; v.fillRect(d.px - 8, d.py - 6, 16, 12); v.fillStyle = '#8f6a3e'; for (let i = 0; i < 3; i++) v.fillRect(d.px - 8, d.py - 5 + i * 4, 16, 1); } }
    if (g.hatches) for (const h of g.hatches) if (inView(h.x, h.y)) this.drawHatch(v, g, h);
    // v1.2 B4: the nailing ring round the drain, with a progress arc
    if (g.holdRings) for (const r of g.holdRings()) {
      v.strokeStyle = r.inside ? 'rgba(240,176,48,0.8)' : 'rgba(240,176,48,0.4)'; v.lineWidth = 1 + (r.inside ? (Math.sin(this.time * 6) + 1) / 2 : 0);
      v.beginPath(); v.arc(r.x, r.y, r.r, 0, Math.PI * 2); v.stroke();
      v.strokeStyle = '#6cbf4a'; v.lineWidth = 3; v.beginPath(); v.arc(r.x, r.y, r.r, -Math.PI / 2, -Math.PI / 2 + r.k * Math.PI * 2); v.stroke(); v.lineWidth = 1;
    }
    // v1.2 B13: roof ladders an errand needs: a pulsing gold arrow and a ground marker
    if (g.roofMarks) for (const m of g.roofMarks()) if (inView(m.x, m.y)) {
      const bob = Math.round(Math.sin(this.time * 5) * 2);
      v.fillStyle = 'rgba(226,181,60,0.35)'; v.fillRect(m.x - 7, m.y - 2, 14, 5);
      v.fillStyle = Math.floor(this.time * 4) % 2 ? '#e2b53c' : '#fff2b0';
      v.fillRect(m.x - 1, m.y - 22 + bob, 2, 6); v.fillRect(m.x - 3, m.y - 16 + bob, 6, 2); v.fillRect(m.x - 2, m.y - 14 + bob, 4, 1);
    }
    // v1.4 B1: everything you could use nearby glows softly; the one you face (the prompt) glows brighter
    for (const gl of g.glows || []) {
      if (!inView(gl.x, gl.y)) continue;
      const on = g.prompt && Math.abs(g.prompt.x - gl.x) < 1 && Math.abs(g.prompt.y - gl.y) < 1, k = (Math.sin(this.time * 4 + gl.x * 0.1) + 1) / 2;
      this.pixelCircleOutline(v, gl.x, gl.y + 2, on ? 9 : 7, on ? '#fff2b0' : '#e2b53c', (on ? 0.55 : 0.2) + 0.25 * k);
      if (on && Math.floor(this.time * 3) % 2) { v.fillStyle = '#fff2b0'; v.fillRect(Math.round(gl.x) + 5, Math.round(gl.y) - 8, 1, 1); }
    }
    // v1.2 B22: armed, waiting traps fizz a little when you're near; B21 switchboard
    for (const t of g.traps) if (t.armed && t.activeT <= 0 && g.power && inView(t.px, t.py) && Math.hypot(t.px - g.p.x, t.py - g.p.y) < 140 && Math.random() < 0.15) {
      const [x0, y0, x1, y1] = t.rect; this.spark(x0 + Math.random() * (x1 - x0), y0 + Math.random() * (y1 - y0), t.kind === 'fence' ? '#9ad0ff' : '#c8bf9a');
    }
    if (g.switchboardOn && g.switchboardOn()) { const sb = g.switchboardSpot(); v.fillStyle = '#3a3530'; v.fillRect(sb.x - 5, sb.y - 12, 10, 8); v.fillStyle = Math.floor(this.time * 2) % 2 ? '#6cbf4a' : '#e2b53c'; v.fillRect(sb.x - 3, sb.y - 10, 2, 2); v.fillRect(sb.x + 1, sb.y - 10, 2, 2); }
    if (g.pubShut || g.pubDoorFixed === false) this.drawPubDoor(v, g);
    for (const c of g.cars) {
      if (!c.used && Math.floor(this.time * 1.5) % 2) { v.fillStyle = '#ff3a2a'; v.fillRect(c.x - 6, c.y - 10, 2, 1); } // armed alarm: dashboard LED
      if (c.t > 0 && Math.floor(this.time * 4) % 2) { v.fillStyle = '#f0a030'; for (const [dx, dy] of [[-16, -3], [14, -3], [-16, 4], [14, 4]]) v.fillRect(c.x + dx, c.y + dy, 2, 2); } // set off: hazards flashing
    }
    for (const b of (g.safeHouse ? g.safeBars : [])) if (inView(b.x, b.y)) this.drawBarricade(v, g, b);
    for (const b of g.barricades) if (inView(b.x, b.y)) this.drawBarricade(v, g, b);
    for (const d of g.doors) if (inView(d.x, d.y, 80)) this.drawDoor(v, d);
    // brute charge telegraph
    for (const e of g.enemies) if (e.type === 'brute' && e.chargeWarn > 0) {
      const n = Math.hypot(e.cvx, e.cvy) || 1; v.fillStyle = '#e03a2a';
      for (let i = 8; i < 160; i += 6) v.fillRect(Math.round(e.x + e.cvx / n * i) - 1, Math.round(e.y + e.cvy / n * i), 3, 2);
    }

    // comfort machines a looter shut: greyed out with the waves left on top (feedback)
    for (const cs of g.map.comfortSpots) {
      const n = g.comfortLocks[cs.id]; if (!(n > 0)) continue;
      const sx = cs.x * 16, sy = cs.y * 16; if (!inView(sx, sy)) continue;
      v.fillStyle = 'rgba(28,26,24,0.78)'; v.fillRect(sx - 1, sy - 6, 18, 20);
      const txt = String(n), w = pixelTextWidth(txt, 2);
      pixelText(v, txt, sx + 8 - w / 2 + 1, sy - 1, '#1d1410', 2); pixelText(v, txt, sx + 8 - w / 2, sy - 2, '#e03a2a', 2);
    }
    // y-sorted objects
    const list = [];
    for (const e of g.enemies) { const x = lerp(e.ox, e.x, alpha), y = lerp(e.oy, e.y, alpha); if (inView(x, y)) list.push([y, 0, e, x]); }
    if (!opts.hidePlayer) list.push([lerp(p.oy, p.y, alpha), 1, p, lerp(p.ox, p.x, alpha)]);
    for (const b of g.map.braziers) if (inView(b.px, b.py)) list.push([b.py + 6, 2, b]);
    for (const b of g.barrels) if (b.alive && inView(b.px, b.py)) list.push([b.py + 6, 3, b]);
    for (const c of g.crates) if ((c.active || g.timed.sale > 0) && inView(c.px, c.py)) list.push([c.py + 6, 4, c]);
    for (const f of g.finds) if (inView(f.x, f.y)) list.push([f.y, 5, f]);
    for (const o of g.thrown) list.push([o.y, 6, o]);
    for (const b of g.bombs) list.push([b.y, 7, b]);
    list.push([g.map.generator.py + 7, 8, g.map.generator]);
    list.push([g.workshop.py + 14, 9, g.workshop]);
    // v1.5 L4: riders on the engine's roof sort in front of it
    const onRoof = (o) => g.escape && ((o.state === 'truck' && o.roof) || o.onTruck), roofY = g.escape ? lerp(g.escape.oey ?? g.escape.ey, g.escape.ey, alpha) + 11 : 0;
    for (const s of g.survivors || []) if (!s.dead && inView(s.x, s.y)) { const y = lerp(s.oy, s.y, alpha); list.push([onRoof(s) ? roofY : y, 11, s, lerp(s.ox, s.x, alpha), y]); }
    if (g.biscuit && !g.biscuit.dead && inView(g.biscuit.x, g.biscuit.y)) { const b = g.biscuit, y = lerp(b.oy, b.y, alpha); list.push([onRoof(b) ? roofY + 0.5 : y, 12, b, lerp(b.ox, b.x, alpha), y]); }
    for (const w of g.worldItems || []) if (inView(w.x, w.y)) list.push([w.y, 13, w]);
    if (g.escape) { const E = g.escape, ex = lerp(E.oex ?? E.ex, E.ex, alpha), ey = lerp(E.oey ?? E.ey, E.ey, alpha); list.push([ey + 10, 14, E, ex, ey]); } // v1.5 L2: interpolated, so the drive is smooth at any frame rate
    if (g.dropCrate) list.push([g.dropCrate.y, 15, g.dropCrate]);
    for (const f of g.flags || []) list.push([f.y, 16, f]);
    for (const w of g.wrecks || []) if (inView(w.px, w.py, 60)) list.push([(w.ty + w.h) * TS, 17, w]);
    { const f = g.map.spots.pub_flap_out; if (inView(f.px, f.py)) list.push([f.py - 8, 19, f]); } // v1.5 R8: the dog flap, drawn over the pub's front wall
    for (const t of g.triggers || []) if (t.quiet) { const sp = g.spot(t.at); if (sp && inView(sp.px, sp.py)) list.push([sp.py + 4, 18, sp]); } // v1.5 W1: the spool of wire
    for (const t of g.traps) if (inView(t.px, t.py)) list.push([t.py + 7, 10, t]);
    list.sort((a, b) => a[0] - b[0]);
    const remaining = g.state === 'active' ? g.remaining() : 99;
    for (const it of list) {
      switch (it[1]) {
        case 0: this.drawEnemy(v, g, it[2], it[3], it[0], remaining); break;
        case 1: this.drawPlayer(v, g, it[3], it[0]); break;
        case 2: this.drawBrazier(v, it[2]); break;
        case 3: this.drawBarrel(v, it[2]); break;
        case 4: this.drawCrate(v, g, it[2]); break;
        case 5: this.drawFind(v, it[2]); break;
        case 6: { const o = it[2]; v.fillStyle = 'rgba(0,0,0,0.3)'; v.fillRect(Math.round(o.x) - 2, Math.round(o.y), 4, 2); v.drawImage(icon(o.id), Math.round(o.x) - 7, Math.round(o.y - o.z) - 10); break; }
        case 7: { const b = it[2]; const blink = Math.floor(this.time * (b.kind === 'pipe' && b.fuse ? 3 + 18 * (1 - b.t / b.fuse) : b.kind === 'pipe' ? 12 : 6)) % 2; if (b.kind === 'pipe' && blink) { v.globalAlpha = 0.35; this.pixelCircle(v, b.x, b.y - 4, 9, '#e03a2a'); v.globalAlpha = 1; } v.drawImage(icon(b.kind), Math.round(b.x) - 7 + (b.kind === 'alarm' && blink ? 1 : 0), Math.round(b.y) - 10); if (blink) { v.fillStyle = '#e03a2a'; v.fillRect(Math.round(b.x), Math.round(b.y) - 11, 2, 2); } break; }
        case 8: this.drawGenerator(v, g); break;
        case 9: this.drawWorkshop(v, g); break;
        case 10: this.drawTrapSwitch(v, g, it[2]); break;
        case 11: this.drawSurvivor(v, g, it[2], it[3], it[4] ?? it[0]); break;
        case 12: this.drawBiscuit(v, g, it[2], it[3], it[4] ?? it[0]); break;
        case 13: this.drawWorldItem(v, it[2]); break;
        case 14: this.drawEngine(v, g, it[2], it[3], it[4]); break;
        case 15: { const d = it[2], drop = Math.max(0, 1 - d.t / 2) * 120; v.fillStyle = 'rgba(0,0,0,0.3)'; v.fillRect(Math.round(d.x) - 7, Math.round(d.y), 14, 3); if (drop > 0) { v.fillStyle = '#e8dfc6'; v.fillRect(Math.round(d.x) - 10, Math.round(d.y - drop - 26), 20, 8); v.fillStyle = '#8c8f86'; v.fillRect(Math.round(d.x), Math.round(d.y - drop - 18), 1, 8); } v.drawImage(icon('supplies'), Math.round(d.x) - 7, Math.round(d.y - drop) - 12); break; }
        case 17: { const w = it[2]; this.drawBus(v, { x: w.px, y: w.py }); break; }
        case 19: { // a low dark gap in the Red Lion's wall with a rubber flap, just big enough for Biscuit
          const f = it[2], x = Math.round(f.px) - 5, y = Math.round(f.py) - 9;
          v.fillStyle = '#6b4a2e'; v.fillRect(x - 1, y - 1, 12, 1); v.fillStyle = '#120e0a'; v.fillRect(x, y, 10, 7);
          const sw = g.biscuit && Math.hypot(g.biscuit.x - f.px, g.biscuit.y - f.py) < 24 ? 1 : 0; v.fillStyle = '#2a2420'; v.fillRect(x + 1, y + sw, 8, 4); v.fillStyle = '#3a3430'; v.fillRect(x + 1, y + sw, 8, 1);
          break;
        }
        case 18: { // a cable spool on its side, with a pulsing amber glow so it reads as something to use
          const sp = it[2], x = Math.round(sp.px), y = Math.round(sp.py);
          v.globalAlpha = 0.3 + 0.15 * Math.sin(this.time * 4); this.pixelCircle(v, x, y, 9, '#e2b53c'); v.globalAlpha = 1;
          v.fillStyle = 'rgba(0,0,0,0.3)'; v.fillRect(x - 7, y + 4, 14, 3);
          v.fillStyle = '#6b4a2e'; v.fillRect(x - 7, y - 7, 3, 12); v.fillRect(x + 4, y - 7, 3, 12);
          v.fillStyle = '#b5502b'; v.fillRect(x - 4, y - 5, 8, 8); v.fillStyle = '#d9822b'; for (let i = 0; i < 4; i++) v.fillRect(x - 4, y - 4 + i * 2, 8, 1);
          v.fillStyle = '#8f6a3e'; v.fillRect(x - 7, y - 7, 3, 1); v.fillRect(x + 4, y - 7, 3, 1); v.fillStyle = '#c8b060'; v.fillRect(x + 4, y + 1, 5, 1);
          break;
        }
        case 16: { const f = it[2]; v.fillStyle = '#8f6a3e'; v.fillRect(Math.round(f.x), Math.round(f.y) - 20, 1, 20); v.fillStyle = Math.floor(this.time * 4) % 2 ? '#4d7fb8' : '#3d6a9a'; v.fillRect(Math.round(f.x) + 1, Math.round(f.y) - 20, 8, 5); this.pixelCircleOutline(v, f.x, f.y, 40, 'rgba(77,127,184,0.5)'); break; }
      }
    }
    // particles
    for (const pt of this.particles) {
      if (!inView(pt.x, pt.y)) continue;
      if (pt.bolt) { const f = Math.floor(pt.t * 16) % 2, X = Math.round(pt.x), Y = Math.round(pt.y - pt.z); v.fillStyle = '#2b1d16'; v.fillRect(X - 1, Y - 1, 4, 4); v.fillStyle = f ? '#e2c060' : '#9aa3a8'; v.fillRect(X, Y, f ? 2 : 1, f ? 1 : 2); v.fillStyle = '#c9a24a'; v.fillRect(X + (f ? 0 : 1), Y + (f ? 1 : 0), 1, 1); continue; }
      if (pt.ember) { v.globalAlpha = 1 - pt.t / pt.life; v.fillStyle = pt.c; v.fillRect(Math.round(pt.x), Math.round(pt.y - pt.z), 1, 1); v.globalAlpha = 1; continue; }
      if (pt.smoke) { const k = pt.t / pt.life; v.globalAlpha = 0.6 * (1 - k); const s = Math.round(pt.s + k * 6); v.fillStyle = pt.c; v.fillRect(Math.round(pt.x - s / 2), Math.round(pt.y - pt.z - s / 2), s, s); v.globalAlpha = 1; continue; }
      if (pt.casing) v.globalAlpha = Math.max(0, 1 - pt.t / pt.life);
      v.fillStyle = pt.c; v.fillRect(Math.round(pt.x), Math.round(pt.y - pt.z), pt.s, pt.s);
      v.globalAlpha = 1;
    }
    for (const tr of this.tracers) this.pixelLine(v, tr.x1, tr.y1 - 8, tr.x2, tr.y2 - 8, tr.eff && tr.tier >= 2 ? EFFECTS[tr.eff].color : tr.tier >= 3 ? '#f0b030' : '#f0e0a0', 1);
    for (const a of this.arcs) this.drawArc(v, a);
    for (const e of this.explosions) this.drawExplosion(v, e);
    for (const b of g.ebullets || []) { v.fillStyle = '#f0d070'; v.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 2, 1); v.fillStyle = 'rgba(240,208,112,0.5)'; v.fillRect(Math.round(b.x - b.vx * 0.012), Math.round(b.y - b.vy * 0.012), 1, 1); }
    for (const e of g.enemies) if (e.laser) this.pixelLine(v, e.x, e.y - 10, e.laser.x2, e.laser.y2, Math.floor(this.time * 20) % 2 ? '#ff3a2a' : '#c02a20', 2);
    for (const sm of g.smokes || []) { const k = Math.min(1, sm.t / 1.5); for (let i = 0; i < 14; i++) { const a = i * 2.4 + this.time * 0.3, d = (i % 5) / 5 * sm.r; v.fillStyle = `rgba(190,194,198,${0.55 * k})`; const r = 8 + (i % 3) * 3; v.fillRect(Math.round(sm.x + Math.cos(a) * d - r), Math.round(sm.y + Math.sin(a) * d * 0.7 - r - 6), r * 2, r * 2); } }
    if (g.p.charge >= 0) { const k = g.p.charge / T.power.chargeTime, ready = g.p.chargeReady, fl = ready && this.time - (this.readyAt || 0) < 0.15; this.pixelCircleOutline(v, g.p.x, g.p.y - 8, 8 + 14 * k, fl ? '#ffffff' : ready ? (Math.floor(this.time * 6) % 2 ? '#ffffff' : '#f0b030') : '#f0d070', 0.4 + 0.5 * k); } // v1.4 D1: white flash and a pulse once it's held
    for (const r of this.rings) { const k = r.t / r.life; this.pixelCircleOutline(v, r.x, r.y - 8, r.r * (0.4 + k), r.c, 1 - k); }
    for (const sl of this.slashes) { const k = 1 - sl.t / sl.life; v.globalAlpha = k; this.pixelLine(v, sl.x - Math.cos(sl.a) * sl.len / 2, sl.y - Math.sin(sl.a) * sl.len / 2, sl.x + Math.cos(sl.a) * sl.len / 2, sl.y + Math.sin(sl.a) * sl.len / 2, sl.c, 1); v.globalAlpha = 1; }
    for (const b of g.burning || []) for (let i = 0; i < 8; i++) this.flame(v, b.x0 + 12 + ((i * 53) % Math.max(1, b.x1 - b.x0 - 24)), b.y0 + 10 + ((i * 29) % 30), 4);
    if (g.event && g.event.kind === 'heli' && g.event.phase !== 'incoming') this.drawHeli(v, g.event);
    if (g.event && g.event.kind === 'roof') { const e = g.event, bob = Math.floor(this.time * 4) % 2; { const rs = charSprite('survivor', 3, 0, 0, bob ? 'attack' : 'walk'); v.drawImage(hdOf(rs), Math.round(e.x) - 8, Math.round(e.y) - 52, rs.width, rs.height); } this.pixelCircleOutline(v, e.x, e.y, 26, 'rgba(226,181,60,0.6)'); }
    for (const bc of g.map.beacons) if (g.beaconsLit) this.flame(v, bc.px, bc.py - 6, 5);
    // rain
    if (this.rain.length) { // 1x3 streaks at an angle; the last instant of each drop is a ripple
      for (const r of this.rain) {
        const X = Math.round(r.x), Y = Math.round(r.y);
        if (r.t > r.life - 0.05) { v.fillStyle = 'rgba(190,210,235,0.5)'; v.fillRect(X - 1, Y + 3, 3, 1); continue; }
        v.fillStyle = 'rgba(170,190,220,0.6)'; v.fillRect(X, Y, 1, 1); v.fillRect(X - 1, Y + 1, 1, 1); v.fillStyle = 'rgba(200,215,235,0.7)'; v.fillRect(X - 1, Y + 2, 1, 1);
      }
    }
    if (g.fog) { // drifting bands at 30% that hide distant sprites
      v.fillStyle = 'rgba(150,160,170,0.3)';
      for (let i = 0; i < 6; i++) { const by = Math.round(cy + ((i * 53 + this.time * 6) % (VH + 40)) - 20), bx = Math.round(cx + Math.sin(this.time * 0.2 + i) * 40 - 40); v.fillRect(bx, by, VW + 80, 6 + (i % 3) * 3); }
    }
    if (g.weather === 'still') { // dust motes drifting in the light cones
      v.fillStyle = 'rgba(240,230,200,0.7)';
      for (let i = 0; i < 18; i++) { const a = i * 2.4, rr = 8 + (i % 6) * 6; v.fillRect(Math.round(p.x + Math.cos(a + this.time * 0.3) * rr + p.fx * 20), Math.round(p.y - 10 + Math.sin(a * 1.3 + this.time * 0.2) * rr * 0.6 + p.fy * 14), 1, 1); }
    }
    v.restore();

    this.drawLighting(g, cx - sx, cy - sy);
    this.drawBeyond(v, g, cx - sx, cy - sy);
    this.drawDamageNumbers(v, cx - sx, cy - sy, p);
    if (g.lightningT > 0 && this.settings.flashing === 'full') { v.fillStyle = `rgba(220,230,255,${Math.min(0.5, g.lightningT * 2)})`; v.fillRect(0, 0, VW, VH); }
    if (this.flash > 0) { v.fillStyle = `rgba(255,250,235,${Math.min(0.8, this.flash)})`; v.fillRect(0, 0, VW, VH); }
    if (opts.desaturate) { v.globalCompositeOperation = 'saturation'; v.fillStyle = `rgba(128,128,128,${opts.desaturate})`; v.fillRect(0, 0, VW, VH); v.globalCompositeOperation = 'source-over'; }
    // present
    const sc = this.sctx; sc.imageSmoothingEnabled = false;
    if (opts.zoom && opts.zoom > 1) {
      const z = opts.zoom, px = (p.x - cx + sx), py = (p.y - cy + sy - 10);
      const w = VW / z, h = VH / z;
      sc.drawImage(this.view, Math.max(0, Math.min(VW - w, px - w / 2)) * HD, Math.max(0, Math.min(VH - h, py - h / 2)) * HD, w * HD, h * HD, 0, 0, this.screen.width, this.screen.height);
    } else sc.drawImage(this.view, 0, 0, this.screen.width, this.screen.height);
  }

  pixelLine(v, x1, y1, x2, y2, c, step = 1) {
    const d = Math.hypot(x2 - x1, y2 - y1); const n = Math.max(1, Math.floor(d / step));
    v.fillStyle = c;
    for (let i = 0; i <= n; i++) v.fillRect(Math.round(x1 + (x2 - x1) * i / n), Math.round(y1 + (y2 - y1) * i / n), 1, 1);
  }
  pixelCircle(v, x, y, r, c) {
    v.fillStyle = c; x = Math.round(x); y = Math.round(y); r = Math.round(r);
    for (let dy = -r; dy <= r; dy += 2) { const w = Math.round(Math.sqrt(r * r - dy * dy)); v.fillRect(x - w, y + dy, w * 2, 2); }
  }
  bandAt(x, y) {
    const lx = Math.floor((x - this.cam.rx) / 2), ly = Math.floor((y - this.cam.ry) / 2);
    if (lx < 0 || ly < 0 || lx >= LW || ly >= LH) return 0;
    return this.bands[ly * LW + lx];
  }

  drawCharacter(v, spr, x, y, flip) {
    const w = spr.width, h = spr.height, ox = Math.round(x), oy = Math.round(y);
    if (flip) { v.save(); v.translate(ox, 0); v.scale(-1, 1); v.drawImage(hdOf(spr), -Math.floor(w / 2), oy - h + 1, w, h); v.restore(); }
    else v.drawImage(hdOf(spr), ox - Math.floor(w / 2), oy - h + 1, w, h);
  }
  shadow(v, x, y, w = 10) { v.fillStyle = 'rgba(0,0,0,0.35)'; v.fillRect(Math.round(x - w / 2), Math.round(y) - 1, w, 2); v.fillRect(Math.round(x - w / 2) + 2, Math.round(y) + 1, w - 4, 1); }

  drawEnemy(v, g, e, x, y, remaining) {
    const band = this.bandAt(x, y - 8);
    const silhouette = band === 0 && e.type !== 'looter';
    const variant = e.flash > 0 ? 'w' : silhouette ? 's' : 'n';
    const moving = e.moving;
    const frame = moving ? [0, 1, 0, 3][Math.floor(e.animT * Math.max(4, e.speed / 8)) % 4] : (Math.floor(e.animT * 1.5) % 2 ? 0 : 2) === 2 ? 0 : 0;
    const pose = e.atk > 0 || e.chargeWarn > 0 ? 'attack' : e.stagger > 0 ? 'stagger' : 'walk';
    if (e.state === 'climb') y -= 2;
    this.shadow(v, x, y, e.type === 'brute' ? 14 : e.type === 'dog' ? 12 : 10);
    let spr, flip;
    if (e.type === 'crawler' || e.type === 'dog') {
      spr = charSprite(e.type, e.leader ? 99 : e.outfit, 0, moving ? Math.floor(e.animT * (e.type === 'dog' ? 14 : 5)) % 4 : 0, pose, variant); flip = e.fx < 0;
    } else {
      const { view, flip: f } = viewForDir(dirIndex(e.fx, e.fy)); flip = f;
      const sway = !moving && Math.floor(e.animT * 1.5) % 2 ? 1 : 0;
      const gaitOf = (sp) => (sp < 38 ? 0 : sp < 53 ? 1 : 2); // walker speed tiers 30 / 45 / 60 (tuning.js types.speeds)
      const kind = e.type === 'raider' && e.role === 'captain' ? 'raider:captain' : e.type === 'walker' || e.type === 'tangled' || e.type === 'bloater' ? `${e.type}:g${gaitOf(e.speed || 45)}${e.type === 'walker' ? ':l' + this.lookOf(e) : ''}` : e.type;
      spr = charSprite(kind, e.outfit, view, frame, pose, variant); x += sway;
    }
    const m = this.mem(e);
    if (e.type === 'crawler' && moving) { // smear trail: an old-blood mark every 8 px
      if (m.sx === undefined || Math.hypot(e.x - m.sx, e.y - m.sy) >= 8) { m.sx = e.x; m.sy = e.y; this.addDecal(e.x - 2, e.y, BLOOD.old, 2); this.addDecal(e.x + 1, e.y + 1, BLOOD.old, 1); }
    } else if (e.hp < e.maxHp * 0.5 && e.type !== 'looter' && e.type !== 'raider' && e.type !== 'hazmat') { // wounded: a drip every 0.5 s
      if (!(m.drip > this.time)) { if (m.drip !== undefined) this.addDecal(e.x + (Math.random() - 0.5) * 4, e.y, BLOOD.fresh, 1); m.drip = this.time + 0.5; }
    }
    if (remaining <= T.lastEnemy.outlineAt && e.type !== 'looter') {
      const a = this.amberOf(spr);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) this.drawCharacter(v, a, x + dx, y + dy, flip);
    }
    this.drawCharacter(v, spr, x, y, flip);
    if (e.burn && !silhouette) this.drawBurning(v, e, m, spr, x, y, flip);
    else m.burnAt = undefined;
    if (e.type === 'brute') { // full-height riot shield: scuffed, smeared, cracked, a POLICE strip
      const sx = Math.round(x + e.fx * 8), sy = Math.round(y - 13 + e.fy * 4);
      if (e.fy > -0.5) this.drawShield(v, sx, sy, silhouette);
      if (e.chargeWarn > 0 && Math.floor(this.time * 20) % 2) { v.fillStyle = '#ff3a2a'; v.fillRect(Math.round(x) - 3, Math.round(y) - 24, 6, 2); }
      const hp = Math.max(0, e.hp / e.maxHp); v.fillStyle = '#2b1d16'; v.fillRect(Math.round(x) - 11, Math.round(y) - 31, 22, 4); v.fillStyle = '#e03a2a'; v.fillRect(Math.round(x) - 10, Math.round(y) - 30, Math.round(20 * hp), 2);
    }
    if (e.type === 'armoured' && e.armour > 0 && !silhouette && e.fy >= 0) { v.fillStyle = '#4a4d52'; v.fillRect(Math.round(x) - 4, Math.round(y) - 13, 8, 5); v.fillStyle = '#6f787d'; v.fillRect(Math.round(x) - 4, Math.round(y) - 13, 8, 1); }
    if (e.slowT > 0 && e.slowAmt >= 0.6) { v.fillStyle = e.chilled > 0 ? '#bfe4f0' : '#c0c4c8'; v.fillRect(Math.round(x) - 5, Math.round(y) - 3, 10, 1); }
    if (e.ally > 0) { v.fillStyle = '#6cbf4a'; v.fillRect(Math.round(x) - 1, Math.round(y) - 28, 3, 3); }
    if (e.outlineT > 0 && Math.floor(this.time * 6) % 3) { const wsp = this.tintOf(spr, '#ffffff'); for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { v.globalAlpha = 0.8; this.drawCharacter(v, wsp, x + dx, y + dy, flip); } v.globalAlpha = 1; this.drawCharacter(v, spr, x, y, flip); }
    const X = Math.round(x), Y = Math.round(y);
    if (e.mark === 'chief') { v.fillStyle = '#f0ead8'; v.fillRect(X - 4, Y - 24, 9, 4); v.fillStyle = '#c8bf9a'; v.fillRect(X - 5, Y - 21, 11, 1); }
    if (e.mark === 'whitecoat') { v.fillStyle = '#f0ead8'; v.fillRect(X - 4, Y - 13, 9, 9); }
    if (e.glow || e.dropItem) { v.fillStyle = Math.floor(this.time * 3) % 2 ? '#6cbf4a' : '#a8e070'; v.fillRect(X, Y - 32, 2, 2); }
    if (e.contract) { v.fillStyle = '#e2b53c'; v.fillRect(X - 3, Y - 36, 7, 5); v.fillStyle = '#2b1d16'; v.fillRect(X - 1, Y - 35, 3, 3); }
    if (e.type === 'raider' && (e.squad === 'signal' || e.pubBound)) { const bob = Math.floor(this.time * 3) % 2; v.fillStyle = '#1d1410'; v.fillRect(X - 3, Y - 40 - bob, 7, 6); v.fillStyle = e.sabotage && Math.floor(this.time * 8) % 2 ? '#ffffff' : '#e03a2a'; v.fillRect(X - 2, Y - 39 - bob, 5, 3); v.fillRect(X - 1, Y - 36 - bob, 3, 1); } // v1.4: a red marker on raiders after the booster or the pub
    if (e.type === 'raider') { const a = Math.atan2(e.fy, e.fx); if (e.role === 'brawler') drawProfile(v, X + e.fx * 3, Y - 11, a + 0.5, cellsFor('m|bat|8', () => meleeCells('bat', 8))); else drawProfile(v, X + e.fx * 3, Y - 11, a, cellsFor('g|r' + e.role, () => gunCells(e.role === 'captain' ? 'rifle' : e.role === 'shotgunner' ? 'shotgun' : 'pistol')).c); if (e.role === 'captain') { v.fillStyle = '#e03a2a'; v.fillRect(X - 3, Y - 25, 7, 2); } const hp = Math.max(0, e.hp / e.maxHp); v.fillStyle = '#2b1d16'; v.fillRect(X - 7, Y - 29, 14, 3); v.fillStyle = '#e2b53c'; v.fillRect(X - 6, Y - 28, Math.round(12 * hp), 1); }
    if (e.type === 'butcher') { this.drawCleaver(v, X + (flip ? -9 : 5), Y - 23, silhouette); const hp = Math.max(0, e.hp / e.maxHp); v.fillStyle = '#2b1d16'; v.fillRect(X - 11, Y - 31, 22, 4); v.fillStyle = '#e03a2a'; v.fillRect(X - 10, Y - 30, Math.round(20 * hp), 2); if (e.grabWarn > 0 && Math.floor(this.time * 20) % 2) { v.fillStyle = '#ff3a2a'; v.fillRect(X - 3, Y - 36, 6, 3); } }
    if (e.type === 'looter') { const bob = Math.floor(this.time * 4) % 2; v.fillStyle = '#1d1410'; v.fillRect(X - 2, Y - 38 - bob, 5, 10); v.fillStyle = '#f0d030'; v.fillRect(X - 1, Y - 37 - bob, 3, 5); v.fillRect(X - 1, Y - 31 - bob, 3, 2); } // v1.4 E6: a yellow "!"
    if (e.screamT > 0) { v.fillStyle = Math.floor(this.time * 16) % 2 ? '#e03a2a' : '#ffffff'; v.fillRect(X - 1, Y - 30, 3, 4); }
    if (e.blindT > 0) { v.fillStyle = '#f0d070'; v.fillRect(X - 2 + (Math.floor(this.time * 6) % 3) * 2, Y - 28, 1, 1); }
    if (e.swayT > 0) { v.fillStyle = '#c8bf9a'; v.fillRect(X + 3, Y - 28 - (Math.floor(this.time * 3) % 3), 2, 2); }
    if (e.pinnedT > 0) { v.fillStyle = '#e2b53c'; v.fillRect(X - 4 + (Math.floor(this.time * 10) % 8), Y - 26, 1, 1); }
    if (e.leader) { v.fillStyle = '#c86048'; v.fillRect(X - 2, Y - 16, 4, 2); }
    if (e.bounty) { // red raincoat and a tag icon
      v.fillStyle = '#c0302a'; v.fillRect(Math.round(x) - 4, Math.round(y) - 13, 8, 6);
      const bob = Math.floor(this.time * 3) % 2; v.fillStyle = '#2b1d16'; v.fillRect(Math.round(x) - 3, Math.round(y) - 34 - bob, 7, 6); v.fillStyle = '#f0b030'; v.fillRect(Math.round(x) - 2, Math.round(y) - 33 - bob, 5, 4); v.fillStyle = '#2b1d16'; v.fillRect(Math.round(x), Math.round(y) - 32 - bob, 1, 2);
    }
  }
  amberOf(spr) {
    if (!spr._amber) { const c = makeCanvas(spr.width, spr.height); const x = c.getContext('2d'); x.drawImage(spr, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#8a6a20'; x.fillRect(0, 0, c.width, c.height); spr._amber = c; if (spr._hd) c._hd = this.amberOf(spr._hd); }
    return spr._amber;
  }

  drawPlayer(v, g, x, y) {
    const p = g.p;
    if (p.dead) {
      const spr = charSprite('cain', 0, 0, 0, 'down'); this.drawCharacter(v, spr, x, y + 2, p.fx < 0); return;
    }
    if (p.inEngine || g.cellar) return;
    if ((p.invuln > 0 || p.iframes > 0) && this.hurtT <= 0 && Math.floor(this.time * 20) % 2) return;
    this.shadow(v, x, y);
    if (p.downed) { const spr = charSprite('cain', 0, 0, Math.floor(p.animT * 4) % 4, 'down'); this.drawCharacter(v, spr, x, y + 2, p.fx < 0); this.drawWeapon(v, g, x, y + 6); return; }
    let { view, flip } = viewForDir(p.face);
    const spin = this.spins[0];
    if (spin) { const k = Math.min(3, Math.floor(spin.t / 0.0625)); view = [0, 2, 4, 2][k]; flip = k === 3; } // 4-frame spin
    const fwd = p.walking && p.walkFwd; // forward: quicker steps and lifted knees; strafing keeps the shuffle
    const frame = p.walking ? [0, 1, 0, 3][Math.floor(p.animT * (fwd ? 11 : 8)) % 4] : 0;
    const carrying = !!(p.jerry || p.carry);
    const pose = p.grabbed ? 'stagger' : p.charge >= 0 ? 'charge' : carrying ? 'carry' : fwd ? 'stride' : 'walk';
    const variant = this.hurtT > 0 ? 'w' : p.hp <= p.maxHp * T.player.lowHealth ? 'l' : 'n';
    const spr = charSprite(p.padLayers ? 'cain' + p.padLayers : 'cain', 0, view, frame, pose, variant);
    if (p.chargeReady && p.charge >= 0) x += Math.floor(this.time * 30) % 2 ? 1 : -1; // a small shake while the charge is held
    if (p.charge >= 0) { const m = this.mem(p); if (!(m.dust > this.time)) { m.dust = this.time + 0.2; this.smoke(x + (Math.random() - 0.5) * 8, y, 0.4, '#a89a80'); } }
    const behind = p.fy < -0.3 || p.charge >= 0;
    if (behind && !carrying) this.drawWeapon(v, g, x, y);
    this.drawCharacter(v, spr, x, y, flip);
    if (g.timed.guts > 0) { v.globalAlpha = 0.45; this.drawCharacter(v, this.tintOf(spr, '#3a5a1a'), x, y, flip); v.globalAlpha = 1; }
    // radio LED blinks while Hilltop is talking (front views carry the radio on the chest)
    if (this.radioT > 0 && view <= 2 && Math.floor(this.time * 6) % 2) {
      const [lx, ly] = [[10, 13], [11, 13], [10, 13]][view], w = spr.width, ox = Math.round(x), top = Math.round(y) - spr.height + 1;
      v.fillStyle = '#ffd060'; v.fillRect(flip ? ox + Math.floor(w / 2) - lx - 1 : ox - Math.floor(w / 2) + lx, top + ly, 1, 1);
    }
    if (!behind && !carrying) this.drawWeapon(v, g, x, y);
    if (p.jerry) { const jx = Math.round(x) - 3, jy = Math.round(y) - 15; v.fillStyle = '#2b1d16'; v.fillRect(jx - 1, jy - 1, 8, 9); v.fillStyle = '#b5503b'; v.fillRect(jx, jy, 6, 7); v.fillStyle = '#d06a50'; v.fillRect(jx, jy, 6, 1); v.fillStyle = '#7a2a22'; v.fillRect(jx, jy + 4, 6, 1); v.fillStyle = '#2b1d16'; v.fillRect(jx + 4, jy - 2, 2, 2); }
    else if (p.carry) { const bob = p.walking ? Math.floor(p.animT * 8) % 2 : 0; v.drawImage(icon(p.carry.item), Math.round(x) - 7, Math.round(y) - 23 - bob); if (p.carry.ticking !== undefined && Math.floor(this.time * 8) % 2) { v.fillStyle = '#e03a2a'; v.fillRect(Math.round(x) + 3, Math.round(y) - 24, 2, 2); } }
    if (spin) this.drawSpin(v, g, spin);
  }
  // power attack release: a full circular smear in the weapon's colour
  drawSpin(v, g, s) {
    const w = g.curWeapon(), col = w && w.kind === 'melee' ? (w.tier >= 2 && w.effect ? EFFECTS[w.effect].color : MELEE[w.id].color) : '#f0ead8';
    const k = s.t / 0.25, end = k * Math.PI * 2, r = Math.max(10, s.r * 0.6);
    v.globalAlpha = 1 - k * 0.6;
    for (let a = 0; a < end; a += 0.08) { const rr = r + ((a * 7) % 2); v.fillStyle = a > end - 0.8 ? '#f2ead6' : col; v.fillRect(Math.round(s.x + Math.cos(a) * rr), Math.round(s.y - 8 + Math.sin(a) * rr * 0.6), 2, 1); }
    v.globalAlpha = 1;
  }
  tintOf(spr, col) { const k = '_t' + col; if (!spr[k]) { const c = makeCanvas(spr.width, spr.height); const x = c.getContext('2d'); x.drawImage(spr, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); spr[k] = c; if (spr._hd) c._hd = this.tintOf(spr._hd, col); } return spr[k]; }

  drawWeapon(v, g, x, y) {
    const p = g.p; const w = g.curWeapon();
    const base = Math.atan2(p.fy, p.fx);
    const hx = x + p.fx * 3, hy = y - 11 + p.fy * 2;
    if (p.chainsawT > 0) {
      const j = Math.random() < 0.5 ? 1 : 0;
      drawProfile(v, hx, hy + j, base, cellsFor('cs' + (Math.floor(this.time * 30) % 2), () => chainsawCells(Math.floor(this.time * 30) % 2)));
      if (Math.random() < 0.3) this.smoke(hx - Math.cos(base) * 2, hy - 4, 0.6, '#6b6f75'); // exhaust
      return;
    }
    if (!w) return;
    if (w.kind === 'melee') {
      const d = MELEE[w.id]; let ang = p.charge >= 0 ? base + Math.PI * 0.85 : base + 0.5, len = d.len;
      const s = p.swing;
      if (s) {
        const half = (s.st.arc / 2) * Math.PI / 180;
        if (d.cls === 'thrust') { len = s.t < s.wind ? d.len - 4 : s.t < s.wind + s.active ? d.len + 6 : d.len; ang = base; }
        else if (s.t < s.wind) ang = base - half - 0.3;
        else if (s.t < s.wind + s.active) {
          const k = (s.t - s.wind) / s.active; ang = base - half + 2 * half * k;
          // swing smear
          const fx = w.tier >= 2 && w.effect ? EFFECTS[w.effect].color : d.feel === 'blade' || d.feel === 'chop' ? '#ffffff' : 'rgba(240,234,216,0.55)';
          v.fillStyle = fx; const thick = d.feel === 'blunt' ? 2 : 1;
          for (let a = base - half; a <= ang; a += 0.12) v.fillRect(Math.round(hx + Math.cos(a) * (len + 2)), Math.round(hy + Math.sin(a) * (len + 2)), thick, thick);
          if (g.timedV && g.timedV.mist > 0) { v.fillStyle = 'rgba(224,58,42,0.7)'; for (let a = base - half; a <= ang; a += 0.2) v.fillRect(Math.round(hx + Math.cos(a) * (len + 4)), Math.round(hy + Math.sin(a) * (len + 4)), 1, 1); }
        } else ang = base + half;
      }
      const L = Math.max(6, Math.min(14, len));
      drawProfile(v, hx, hy, ang, cellsFor(`m|${w.id}|${L}`, () => meleeCells(w.id, L)), w.tier, w.effect ? EFFECTS[w.effect].color : null);
      return;
    }
    const d = GUNS[w.id];
    const prof = cellsFor('g|' + w.id, () => gunCells(w.id)), len = prof.len;
    drawProfile(v, hx, hy, base, prof.c, w.tier, w.effect ? EFFECTS[w.effect].color : null);
    if (p.muzzle > 0) this.muzzleFlash(v, hx + Math.cos(base) * (len + 1), hy + Math.sin(base) * (len + 1), base, w);
    if (w.id === 'blowtorch' && p.flaming) { v.fillStyle = '#d9822b'; v.fillRect(Math.round(hx + Math.cos(base) * (len + 2)) - 1, Math.round(hy + Math.sin(base) * (len + 2)) - 1, 3, 3); }
    if (d.fire === 'draw' && p.drawT > 0) { v.fillStyle = '#e8dfc6'; const k = p.drawT / d.drawTime; v.fillRect(Math.round(hx - Math.cos(base) * 3 * k), Math.round(hy - Math.sin(base) * 3 * k), 1, 1); }
  }
  // D8 muzzle flashes, 3 frames per class: a small star (pistols), a wide cone (shotguns), a long flicker (automatics)
  muzzleFlash(v, x, y, ang, w) {
    const f = (this.flashF = ((this.flashF || 0) + 1) % 3), id = w.id;
    const cls = id === 'shotgun' || id === 'dbarrel' ? 'cone' : id === 'smg' || id === 'ar' ? 'long' : 'star';
    const core = w.tier >= 2 && w.effect ? EFFECTS[w.effect].color : '#fff2b0', edge = '#f0b030';
    const dx = Math.cos(ang), dy = Math.sin(ang), P = (a, b, c) => { v.fillStyle = c; v.fillRect(Math.round(x + dx * a - dy * b), Math.round(y + dy * a + dx * b), 1, 1); };
    if (cls === 'star') { for (let i = -1; i <= 1 + f % 2; i++) P(i + 1, 0, core); P(1, -1 - (f === 2 ? 1 : 0), edge); P(1, 1 + (f === 1 ? 1 : 0), edge); P(3 + f % 2, 0, edge); }
    else if (cls === 'cone') { for (let a = 0; a < 5 + f; a++) for (let b = -Math.floor(a / 2); b <= Math.floor(a / 2); b++) P(a, b, a < 2 || Math.abs(b) < 1 ? core : edge); }
    else { const L = 4 + f * 2; for (let a = 0; a < L; a++) P(a, a % 3 === 2 ? (f % 2 ? 1 : -1) : 0, a < 2 ? core : edge); P(1, 1, core); P(1, -1, core); }
  }
  weaponLine(v, x, y, ang, len, col, thick = 1) {
    v.fillStyle = '#2b1d16';
    for (let i = 0; i <= len; i++) v.fillRect(Math.round(x + Math.cos(ang) * i) - 1, Math.round(y + Math.sin(ang) * i) - 1, thick + 1, thick + 1);
    v.fillStyle = col;
    for (let i = 0; i <= len; i++) v.fillRect(Math.round(x + Math.cos(ang) * i) - (thick > 1 ? 1 : 0), Math.round(y + Math.sin(ang) * i) - (thick > 1 ? 1 : 0), thick, thick);
  }

  pixelCircleOutline(v, x, y, r, c, a = 1) {
    v.fillStyle = c; v.globalAlpha = Math.max(0, a);
    const n = Math.max(8, Math.round(r * 1.5));
    for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2; v.fillRect(Math.round(x + Math.cos(t) * r), Math.round(y + Math.sin(t) * r * 0.7), 1, 1); }
    v.globalAlpha = 1;
  }
  drawSurvivor(v, g, s, x, y) {
    if (s.flash > 0 && Math.floor(this.time * 20) % 2) return;
    this.shadow(v, x, y);
    const { view, flip } = viewForDir(dirIndex(s.fx, s.fy));
    const frame = s.moving ? [0, 1, 0, 3][Math.floor(s.animT * 8) % 4] : 0;
    const flags = (s.sick ? 's' : '') + (s.hp < s.maxHp ? 'h' : '');
    this.drawCharacter(v, charSprite(`survivor:${s.role || ''}:${flags}`, s.outfit, view, frame, s.cower ? 'stagger' : 'walk'), x, y, flip);
    if (s.weapon) drawProfile(v, x + s.fx * 3, y - 11 + s.fy * 2, Math.atan2(s.fy, s.fx), cellsFor('g|' + s.weapon.id, () => gunCells(s.weapon.id)).c); // v1.4 F5
    if (s.state === 'escort' || s.hp < s.maxHp) { const k = Math.max(0, s.hp / s.maxHp); v.fillStyle = '#2b1d16'; v.fillRect(Math.round(x) - 7, Math.round(y) - 28, 14, 3); v.fillStyle = s.state === 'escort' ? '#6cbf4a' : '#e2b53c'; v.fillRect(Math.round(x) - 6, Math.round(y) - 27, Math.round(12 * k), 1); }
    if (s.cower && Math.floor(this.time * 4) % 2) { v.fillStyle = '#ffffff'; v.fillRect(Math.round(x) - 1, Math.round(y) - 34, 2, 4); v.fillRect(Math.round(x) - 1, Math.round(y) - 29, 2, 1); }
  }
  drawBiscuit(v, g, b, x, y) {
    if (b.flash > 0 && Math.floor(this.time * 20) % 2) return;
    this.shadow(v, x, y, 12);
    const frame = b.moving ? Math.floor(b.animT * 14) % 4 : 0;
    const idle = !b.moving ? Math.floor(this.time * 4) % 2 : frame; // tail wag in idle
    const spr = charSprite('biscuit', 0, 0, b.down ? 0 : idle, b.down ? 'down' : this.biscuitPinT > 0 ? 'pin' : b.biteCD > 0.6 ? 'attack' : 'walk');
    if (b.down) {
      // pulsing red ring that beats faster as he gets closer to dying, plus pips for the hits he can still take
      const k = g.biscuitDanger(), pulse = (Math.sin(this.dogPh * Math.PI * 2) + 1) / 2, r = Math.round(12 + pulse * 4 + k * 3);
      v.globalAlpha = 0.35 + 0.5 * pulse; this.pixelCircleOutline(v, x, y - 3, r, '#e03a2a'); v.globalAlpha = 0.12 + 0.2 * pulse * k; v.fillStyle = '#e03a2a'; v.beginPath(); v.arc(Math.round(x), Math.round(y) - 3, r, 0, Math.PI * 2); v.fill(); v.globalAlpha = 1;
      const left = Math.max(0, T.biscuit.downedHits - b.downHits), px0 = Math.round(x) - left * 2;
      for (let i = 0; i < left; i++) { v.fillStyle = '#1d1410'; v.fillRect(px0 + i * 4 - 1, Math.round(y) + 9, 4, 4); v.fillStyle = left <= 2 && pulse > 0.5 ? '#ffffff' : '#e03a2a'; v.fillRect(px0 + i * 4, Math.round(y) + 10, 2, 2); }
      this.drawCharacter(v, spr, x, y + 1, b.fx < 0); if (Math.floor(this.time * 2) % 2) { v.fillStyle = '#c8cfd0'; v.fillRect(Math.round(x) + 5, Math.round(y) - 12, 2, 2); v.fillRect(Math.round(x) + 7, Math.round(y) - 14, 1, 1); } return; } // whimper puff
    this.drawCharacter(v, spr, x, y + 1, b.fx < 0);
    if (b.pointAt) { v.fillStyle = '#ffffff'; v.fillRect(Math.round(x) - 1, Math.round(y) - 18, 2, 4); v.fillRect(Math.round(x) - 1, Math.round(y) - 13, 2, 1); }
    if (b.mode === 'stay') { v.fillStyle = '#4d7fb8'; v.fillRect(Math.round(x) - 2, Math.round(y) - 15, 4, 2); }
  }
  drawWorldItem(v, w) {
    const bob = Math.round(Math.sin(this.time * 4 + w.x) * 1.5);
    const key = w.kind === 'weapon' ? w.weapon : w.item === 'flare' ? 'flare_item' : w.item;
    if (w.glint) { if (Math.floor(this.time * 2 + w.x) % 5 === 0) { v.fillStyle = '#ffffff'; v.fillRect(Math.round(w.x) + 2, Math.round(w.y) - 12, 1, 1); } v.globalAlpha = 0.85; v.drawImage(icon(key), Math.round(w.x) - 7, Math.round(w.y) - 10); v.globalAlpha = 1; return; }
    const glowC = w.kind === 'weapon' ? CONDITIONS[w.cond ?? 1].color : w.kind === 'part' ? '#c49a62' : w.errand || w.glow ? '#6cbf4a' : '#e2b53c';
    v.globalAlpha = 0.35; this.pixelCircle(v, w.x, w.y, 6 + (Math.floor(this.time * 3) % 2), glowC); v.globalAlpha = 1;
    v.drawImage(icon(key), Math.round(w.x) - 7, Math.round(w.y) - 14 + bob);
    if (w.ticking !== undefined && Math.floor(this.time * 8) % 2) { v.fillStyle = '#e03a2a'; v.fillRect(Math.round(w.x) + 3, Math.round(w.y) - 15, 2, 2); }
  }
  // D7 fire engine: a red cab-forward pump with a white roof stripe, ladder, rolled hose, chrome lockers and a blue
  // light bar. Missing parts show (battery bay open, a wheel on blocks, fuel cap off) and fill in as they're fitted.
  drawEngine(v, g, E, ex = E.ex, ey = E.ey) {
    const x = Math.round(ex) - 32, y = Math.round(ey) - 18, flip = (E.dir || 1) < 0;
    // v1.5 L2: facing the way it drives (mirrored about its centre)
    const R = (a, b, w, h, c) => { v.fillStyle = c; v.fillRect(flip ? x + 64 - a - w : x + a, y + b, w, h); };
    const going = E.stage === 'gone', ready = E.stage === 'drive' || going, fit = E.fitted || {};
    R(2, 30, 60, 4, 'rgba(0,0,0,0.35)');
    R(0, 6, 64, 24, '#2b1d16'); R(1, 7, 62, 22, '#b5302a'); R(1, 7, 62, 3, '#d84a3a'); R(1, 22, 62, 2, '#7a1a16');
    R(44, 6, 19, 3, '#f2ead6'); // white roof stripe on the cab
    R(46, 9, 15, 9, '#2a3440'); R(47, 10, 6, 3, '#5a7088'); R(54, 10, 1, 7, '#b5302a');
    R(4, 3, 38, 4, '#c0c4c8'); for (let i = 0; i < 38; i += 4) R(4 + i, 3, 1, 4, '#8c8f86'); // ladder
    for (let i = 0; i < 3; i++) { R(4 + i * 12, 11, 10, 9, '#9a2a20'); R(4 + i * 12, 11, 10, 1, '#e8e4d8'); R(5 + i * 12, 14, 8, 1, '#c8cfd0'); R(12 + i * 12, 16, 1, 2, '#e8e4d8'); } // chrome lockers
    R(38, 11, 6, 6, '#c8b060'); R(39, 12, 4, 4, '#a8903a'); R(40, 13, 2, 2, '#c8b060'); // rolled hose
    R(5, 13, 36, 1, '#e2b53c');
    for (let i = 0; i < 31; i++) R(1 + i * 2, 24, 2, 2, i % 2 ? '#e2b53c' : '#7a1a16'); // chequered stripe along the side
    R(45, 18, 1, 6, '#7a1a16'); R(52, 19, 2, 1, '#e8e4d8'); // cab door and handle
    R(62, 9, 2, 3, '#2b1d16'); R(60, 26, 4, 3, '#c0c4c8'); R(60, 26, 4, 1, '#e8e4d8'); R(62, 20, 2, 2, '#f2ead6'); // mirror, bumper, headlight
    // wheels under dark arches: the rear one on blocks until the tyre is fitted
    R(4, 24, 14, 3, '#1d1d22'); R(44, 24, 14, 3, '#1d1d22');
    R(5, 25, 12, 9, '#1d1d22'); R(8, 27, 6, 5, '#4a4d52'); R(9, 28, 4, 3, '#8c8f86'); R(10, 29, 2, 1, '#c8cfd0');
    if (fit.tyre || E.tyre || going) { R(45, 25, 12, 9, '#1d1d22'); R(48, 27, 6, 5, '#4a4d52'); R(49, 28, 4, 3, '#8c8f86'); R(50, 29, 2, 1, '#c8cfd0'); }
    else { R(46, 28, 4, 5, '#8f6a3e'); R(52, 28, 4, 5, '#8f6a3e'); R(46, 28, 4, 1, '#c49a62'); R(52, 28, 4, 1, '#c49a62'); R(47, 25, 8, 3, '#3a3a3e'); }
    if (!(fit.battery || going)) { R(28, 20, 8, 6, '#141619'); R(29, 21, 2, 1, '#e03a2a'); R(33, 21, 2, 1, '#2f2f33'); R(36, 19, 4, 2, '#9a2a20'); } // battery bay open, wires out
    else { R(28, 20, 8, 5, '#9a2a20'); R(29, 21, 6, 1, '#c8cfd0'); }
    if (!(fit.fuel || going)) { R(42, 21, 2, 2, '#141619'); R(43, 23, 1, 3, '#2f2f33'); R(42, 26, 2, 1, '#c0c4c8'); } // fuel cap off, hanging
    else R(42, 21, 2, 2, '#c0c4c8');
    // blue light bar: spins (3 frames) when it runs
    R(22, 1, 14, 3, '#2a3440');
    if (ready) { const f = Math.floor(this.time * 9) % 3; for (let i = 0; i < 3; i++) R(23 + i * 4, 1, 3, 2, i === f ? '#9ad0ff' : '#3d6ad0'); }
    else for (let i = 0; i < 3; i++) R(23 + i * 4, 1, 3, 2, '#2a4a8a');
    if (ready && Math.random() < 0.4) this.smoke(flip ? x + 62 : x + 2, y + 24, 0.8, '#4a4d52');
    if (going) { // wheels turning (a hub spoke steps round), and a headlight beam ahead of the cab
      const sp = Math.floor((E.driveT || 0) * 14) % 4, hub = [[0, 0], [2, 0], [2, 2], [0, 2]][sp];
      for (const wx of [9, 49]) R(wx + hub[0], 28 + hub[1], 2, 1, '#c8cfd0');
      v.globalAlpha = 0.18; v.fillStyle = '#fff2b0'; const hx = flip ? x - 40 : x + 64; v.fillRect(hx, y + 14, 40, 12); v.globalAlpha = 1;
      R(62, 15, 2, 3, '#fff2b0');
    }
  }
  drawBus(v, w) { // town event: a green double-decker through the fence, windows broken
    const x = Math.round(w.x) - 40, y = Math.round(w.y) - 30, R = (a, b, ww, hh, c) => { v.fillStyle = c; v.fillRect(x + a, y + b, ww, hh); };
    R(2, 38, 80, 4, 'rgba(0,0,0,0.4)'); R(0, 0, 80, 38, '#2b1d16'); R(1, 1, 78, 36, '#2f6a3a'); R(1, 1, 78, 2, '#4a8a54'); R(1, 18, 78, 2, '#e8dfc6');
    for (let row = 0; row < 2; row++) for (let i = 0; i < 9; i++) { const wx = 3 + i * 8, wy = 5 + row * 16; R(wx, wy, 6, 8, '#1a2028'); if ((i + row) % 3) { R(wx + 1, wy + 1, 2, 2, '#8aa2b8'); R(wx + 4, wy + 3, 1, 3, '#c8d4dc'); } }
    for (const wx of [8, 62]) { R(wx, 32, 10, 8, '#1d1d22'); R(wx + 3, 34, 4, 4, '#6f787d'); }
    R(70, 8, 8, 4, '#e2b53c'); R(4, 26, 2, 2, '#8a5a32'); R(60, 24, 4, 3, '#8a5a32');
  }
  drawRubble(v, x, y, seed) { // broken fence or shutter: bricks and splinters on the ground, walkable
    const R = (a, b, w, h, c) => { v.fillStyle = c; v.fillRect(x + a, y + b, w, h); };
    R(1, 9, 14, 5, 'rgba(0,0,0,0.25)');
    for (let i = 0; i < 6; i++) { const k = seed * 13 + i * 7, rx = (k * 5) % 12, ry = 4 + (k % 9); R(rx, ry, 3 + (k % 2), 2, ['#8a5a3a', '#6f6a62', '#a8804e', '#5a4a40'][k % 4]); R(rx, ry, 2, 1, '#c8bf9a'); }
  }
  drawHeli(v, e) { // crash: rotor bent, fire, scattered crates
    const R = (a, b, w, h, c) => { v.fillStyle = c; v.fillRect(Math.round(e.x + a), Math.round(e.y + b), w, h); };
    R(-20, 4, 40, 4, 'rgba(0,0,0,0.4)'); R(-18, -8, 36, 12, '#3a3e44'); R(-18, -8, 36, 2, '#5a5e64'); R(-12, -6, 10, 5, '#26333f'); R(-11, -6, 3, 1, '#8aa2b8');
    R(10, -4, 18, 3, '#2a2d32'); R(26, -8, 2, 6, '#2a2d32');
    R(-26, -12, 26, 2, '#6f787d'); R(0, -12, 2, 2, '#4a4d52'); for (let i = 0; i < 10; i++) R(2 + i * 2, -12 + i, 2, 1, '#6f787d'); // rotor bent
    for (const [cx, cy] of [[-30, 2], [24, 6], [-8, 10]]) { R(cx, cy, 7, 5, '#5d6b3a'); R(cx, cy, 7, 1, '#7a8a4a'); R(cx + 3, cy, 1, 5, '#3e4a26'); }
    this.flame(v, e.x + 4, e.y - 6, 4); this.flame(v, e.x - 10, e.y - 2, 3);
    if (Math.random() < 0.3) this.smoke(e.x + (Math.random() - 0.5) * 20, e.y - 10, 3, '#3a3a3e');
  }
  drawMastLights(v, g) { // radio mast: a red aircraft light; the booster box with a blinking green LED once built
    const f = g.map.spots.school_mast; if (!f) return;
    if (Math.floor(this.time * 1.5) % 2) { v.fillStyle = '#ff3a2a'; v.fillRect(f.px - 26, f.py - 82, 2, 2); }
    if (g.mastRepaired) { v.fillStyle = '#2b1d16'; v.fillRect(f.px + 9, f.py - 9, 8, 7); v.fillStyle = '#4a4d52'; v.fillRect(f.px + 10, f.py - 8, 6, 5); v.fillStyle = '#6f787d'; v.fillRect(f.px + 10, f.py - 8, 6, 1); if (Math.floor(this.time * 3) % 2) { v.fillStyle = '#6cbf4a'; v.fillRect(f.px + 14, f.py - 6, 1, 1); } }
  }
  // D2 death: 4 frames (knees buckle, fall, impact, settle), then the corpse over a pool that grows (3 sizes in 1 s),
  // darkens to old blood over 20 s and fades with the body.
  drawCorpse(v, c) {
    const a = c.t > T.fx.corpseLife - 2 ? (T.fx.corpseLife - c.t) / 2 : 1;
    v.globalAlpha = Math.max(0, a);
    const x = Math.round(c.x), y = Math.round(c.y), human = c.type !== 'dog' && c.type !== 'crawler';
    if (c.mode !== 'char') {
      const size = c.t < 0.33 ? 0 : c.t < 0.66 ? 1 : 2, r = c.mode === 'gore' ? 3 + size * 2 : [3, 5, 7][size];
      v.fillStyle = c.t < 6 ? BLOOD.fresh : c.t < 20 ? '#6a1a14' : BLOOD.old;
      v.fillRect(x - r, y - 1, r * 2, 3); v.fillRect(x - r + 2, y - 2, r * 2 - 4, 5);
      if (c.t < 6 && size === 2) { v.fillStyle = BLOOD.freshHi; v.fillRect(x - 3, y - 1, 2, 1); }
    } else { v.fillStyle = 'rgba(43,29,22,0.6)'; v.fillRect(x - 8, y - 2, 16, 4); }
    const frame = Math.floor(c.t / 0.09);
    if (human && c.mode !== 'gore' && frame < 3) {
      const kind = c.type === 'raider' && c.role === 'captain' ? 'raider:captain' : c.type;
      const spr = charSprite(kind, c.outfit, 2, 0, 'stagger');
      if (frame === 0) this.drawCharacter(v, spr, x, y + 2, c.flip); // knees buckle
      else { // fall, then impact
        v.save(); v.translate(x, y); v.rotate((c.flip ? -1 : 1) * (frame === 1 ? Math.PI / 4 : Math.PI / 2)); v.drawImage(hdOf(spr), -Math.floor(spr.width / 2), -spr.height + (frame === 2 ? 4 : 2), spr.width, spr.height); v.restore();
        if (frame === 2) { v.fillStyle = 'rgba(168,154,128,0.6)'; v.fillRect(x - 9, y + 1, 3, 1); v.fillRect(x + 7, y + 1, 3, 1); }
      }
    } else {
      const spr = corpseSprite(c.type === 'dog' ? 'dog' : c.type, c.leader ? 99 : c.outfit, c.mode || 'n', c.pose || 0);
      if (c.flip) { v.save(); v.translate(x, 0); v.scale(-1, 1); v.drawImage(hdOf(spr), -Math.floor(spr.width / 2), y - spr.height + 3, spr.width, spr.height); v.restore(); }
      else v.drawImage(hdOf(spr), x - Math.floor(spr.width / 2), y - spr.height + 3, spr.width, spr.height);
    }
    v.globalAlpha = 1;
  }
  drawScorch(v, sc) {
    v.globalAlpha = Math.max(0, sc.a); v.fillStyle = '#2b1d16';
    const r = sc.r;
    for (let dy = -r; dy <= r; dy += 2) { const w = Math.round(Math.sqrt(r * r - dy * dy)); for (let dx = -w; dx < w; dx += 2) if (((sc.seed >> ((dx + dy + 64) % 16)) & 1) || Math.abs(dx) + Math.abs(dy) < r * 0.7) v.fillRect(Math.round(sc.x + dx), Math.round(sc.y + dy * 0.6), 2, 2); }
    v.globalAlpha = 1;
  }
  // D2 burning: charred patches creep up from the feet over 3 s, flame tongues on shoulders and head, embers
  drawBurning(v, e, m, spr, x, y, flip) {
    if (m.burnAt === undefined) m.burnAt = this.time;
    const k = Math.min(1, (this.time - m.burnAt) / 3), h = spr.height, top = Math.round(y - h * k);
    v.save(); v.beginPath(); v.rect(x - 16, top, 32, h + 2); v.clip(); v.globalAlpha = 0.8; this.drawCharacter(v, this.tintOf(spr, '#2b1d16'), x, y, flip); v.restore(); v.globalAlpha = 1;
    const f = Math.floor(this.time * 10) % 3, X = Math.round(x), Y = Math.round(y) - h + 4;
    for (const [ox, oy, sz] of [[-4, 8, 2], [4, 9, 2], [0, 1, 3]]) this.tongue(v, X + ox, Y + oy, sz, (f + ox + 3) % 3);
    if (Math.random() < 0.2) this.particles.push({ x: e.x + (Math.random() - 0.5) * 8, y: e.y, z: 20, vx: (Math.random() - 0.5) * 10, vy: 0, vz: 25, t: 0, life: 0.8, c: '#f0b030', s: 1, smoke: true, grav: 0, ember: true });
  }
  tongue(v, x, y, s, f) { // a 3-frame flame tongue: core, edge, tip
    const F = RAMP.fire;
    v.fillStyle = F.edge; v.fillRect(x - 1, y - s - 1 + (f === 1 ? 1 : 0), 3, s + 1);
    v.fillStyle = F.core; v.fillRect(x, y - s + (f === 2 ? 1 : 0), 1, s);
    v.fillStyle = F.tip; v.fillRect(x + (f - 1), y - s - 2, 1, 1);
  }
  drawShield(v, sx, sy, sil) {
    const R = (a, b, w, h, c) => { v.fillStyle = c; v.fillRect(a, b, w, h); };
    R(sx - 5, sy - 9, 11, 19, '#2b1d16');
    if (sil) { R(sx - 4, sy - 8, 9, 17, '#14121c'); return; }
    R(sx - 4, sy - 8, 9, 17, '#7a8a96'); R(sx - 4, sy - 8, 9, 1, '#a8b8c4'); R(sx - 4, sy - 8, 1, 17, '#98a8b4'); R(sx + 3, sy - 7, 2, 16, '#5a6a76');
    R(sx - 3, sy - 2, 7, 2, '#2a3040'); R(sx - 2, sy - 2, 4, 1, '#e8e4d8'); // POLICE strip
    R(sx - 2, sy - 6, 1, 3, '#c8d4dc'); R(sx - 1, sy - 4, 1, 1, '#c8d4dc'); R(sx, sy - 3, 1, 1, '#c8d4dc'); // crack
    R(sx + 1, sy + 3, 2, 3, BLOOD.old); R(sx - 3, sy + 5, 1, 2, '#5a4a40'); // smear, scuff
  }
  drawCleaver(v, x, y, sil) {
    const R = (a, b, w, h, c) => { v.fillStyle = c; v.fillRect(a, b, w, h); };
    R(x - 1, y - 1, 7, 7, '#2b1d16');
    if (sil) { R(x, y, 5, 5, '#14121c'); return; }
    R(x, y, 5, 5, '#a8acb0'); R(x, y, 5, 1, '#e8e4d8'); R(x, y + 4, 5, 1, '#f2ead6'); R(x + 3, y + 1, 1, 1, '#2b1d16'); R(x, y + 2, 2, 2, BLOOD.old); // blade, hole, stain, bright edge
    R(x + 2, y + 5, 1, 4, '#5a3e2a');
  }
  // v1.2 cellar hatch: a square wooden trapdoor with an iron ring; brighter when its zone is open
  drawHatch(v, g, h) {
    const x = h.x - 7, y = h.y - 6, open = g.hatchUsable ? g.hatchUsable(h) : g.openZones.has(h.zone);
    const R = (a, b, w, hh, c) => { v.fillStyle = c; v.fillRect(a, b, w, hh); };
    R(x - 1, y - 1, 16, 14, 'rgba(0,0,0,0.45)');
    R(x, y, 14, 12, open ? '#7a5a3a' : '#4e3e2e');
    for (let i = 3; i < 14; i += 4) R(x + i, y, 1, 12, '#5a3e2a');
    R(x, y, 14, 1, '#9a7448'); R(x, y + 11, 14, 1, '#3e2c1e');
    R(x + 2, y + 2, 10, 1, '#3a3a3e'); R(x + 2, y + 9, 10, 1, '#3a3a3e');
    R(x + 5, y + 5, 4, 3, '#2a2a2e'); R(x + 6, y + 6, 2, 1, '#9aa3a8');
    if (!h.fixed) { R(x + 3, y + 1, 1, 4, '#1e1610'); R(x + 4, y + 4, 2, 1, '#1e1610'); R(x + 9, y + 6, 1, 5, '#1e1610'); R(x + 10, y + 3, 3, 1, '#2a1e14'); R(x + 1, y + 8, 3, 2, '#141619'); } // split boards, a hole
    const pick = g.cellarDest && g.cellarDest() === h;
    if (pick) { v.strokeStyle = Math.floor(this.time * 4) % 2 ? '#e2b53c' : '#fff2c0'; v.lineWidth = 1; v.strokeRect(x - 2.5, y - 2.5, 19, 17); }
    if (open && !g.cellar && Math.hypot(g.p.x - h.x, g.p.y - h.y) < 40 && Math.floor(this.time * 2) % 2) { v.strokeStyle = 'rgba(226,181,60,0.7)'; v.lineWidth = 1; v.strokeRect(x - 1.5, y - 1.5, 17, 15); }
  }
  drawPubDoor(v, g) { // the Red Lion bolted: oak boards, iron bands, light through the gaps
    const d = g.map.pub.door, x = d.x - 8, y = d.y - 8, R = (a, b, w, h, c) => { v.fillStyle = c; v.fillRect(a, b, w, h); };
    if (g.pubDoorFixed === false) { // broken: a door off one hinge, wedged in the frame, boards split
      R(x, y, 16, 16, '#1e1610'); R(x + 1, y + 1, 13, 15, '#4e3a28'); for (let i = 1; i < 14; i += 4) R(x + i, y + 1, 1, 15, '#3a2a1e');
      R(x + 1, y + 1, 13, 1, '#6a4e34'); R(x + 5, y + 4, 2, 7, '#141619'); R(x + 9, y + 9, 3, 2, '#141619'); R(x + 11, y + 6, 1, 3, '#141619');
      R(x + 1, y + 3, 2, 1, '#6a5a4a'); R(x + 14, y + 12, 2, 1, '#6a5a4a'); R(x + 2, y + 7, 12, 1, '#7a5a3a'); R(x + 2, y + 7, 12, 1, 'rgba(0,0,0,0.25)'); // hinge, cross board
      return;
    }
    R(x, y, 16, 16, '#3a2a1e');
    for (let i = 0; i < 16; i += 4) { R(x + i, y, 3, 16, '#5a3e2a'); R(x + i, y, 1, 16, '#7a5a3a'); }
    if (Math.floor(this.time * 2) % 3) for (let i = 3; i < 16; i += 4) R(x + i, y + 2, 1, 12, '#f0b030');
    R(x, y + 4, 16, 2, '#3a3a3e'); R(x, y + 11, 16, 2, '#3a3a3e'); for (const bx of [1, 14]) { R(x + bx, y + 4, 1, 1, '#9aa3a8'); R(x + bx, y + 11, 1, 1, '#9aa3a8'); }
    R(x + 11, y + 7, 3, 3, '#c8bf9a'); R(x + 12, y + 7, 1, 1, '#e8dfc6'); // bolt wrapped in cloth
  }
  // D5 barricades: each plank pale with grain and two nails when fresh; the more planks are gone, the more the rest
  // splinter, tilt and darken. Reinforcement: steel bars (rust at the welds) or a riveted, dented sheet.
  drawBarricade(v, g, b) {
    const x = b.tx * TS, y = b.ty * TS, horiz = b.iy !== 0;
    const R = (a, c, w, h, col) => { v.fillStyle = col; v.fillRect(Math.round(a), Math.round(c), w, h); };
    this.drawOpening(R, b, x, y, horiz);
    const lost = 6 - b.planks, wear = Math.min(1, lost / 5);
    for (let i = 0; i < b.planks; i++) {
      const k = (b.id * 7 + i * 3), tilt = lost > 0 ? ((k % 3) - 1) * Math.min(2, 1 + (lost >> 1)) : 0;
      const base = shade('#c49a62', -0.08 * (k % 3) - 0.3 * wear), lo = shade(base, -0.3), hi = shade(base, 0.2);
      const splinter = lost > 0 && (i === b.planks - 1 || (k % 4 === 0 && lost > 2));
      if (horiz) {
        const py = y - 3 + i * 3;
        R(x - 1, py - 1, 18, 4, '#2b1d16'); R(x, py, 8, 2, base); R(x + 8, py + (tilt > 0 ? 1 : tilt < 0 ? -1 : 0), 8, 2, base);
        R(x, py, 16, 1, hi); R(x + 3, py + 1, 4, 1, lo); R(x + 10, py + 1, 3, 1, lo); // grain
        R(x + 1, py, 1, 1, '#8c8f86'); R(x + 14, py, 1, 1, '#8c8f86'); // nail heads
        if (splinter) { R(x + 15, py - 1, 1, 1, base); R(x + 16, py + 1, 1, 1, base); R(x + 13, py + 2, 2, 1, lo); }
      } else {
        const px = x + 2 + i * 2;
        R(px - 1, y - 5, 3, 22, '#2b1d16'); R(px, y - 4, 1, 10, base); R(px, y + 6 + tilt, 1, 10, base);
        R(px, y - 4, 1, 1, '#8c8f86'); R(px, y + 13 + tilt, 1, 1, '#8c8f86'); R(px, y + 2, 1, 2, lo);
        if (splinter) { R(px - 1, y + 15, 1, 1, base); R(px + 1, y + 16, 1, 1, base); }
      }
    }
    // torn planks lying inside
    for (let i = b.planks; i < 6; i++) {
      const k = b.id * 13 + i * 7, ox = ((k % 17) - 8), oy = 10 + (k % 7);
      const lx = b.inside.x + b.iy * ox + b.ix * oy - 8 * Math.abs(b.ix), ly = b.inside.y + b.ix * ox + b.iy * (oy - 12);
      R(lx - 5, ly, 10, 2, shade('#c49a62', -0.35)); R(lx - 5, ly, 10, 1, '#a8804e'); R(lx + 5, ly - 1, 1, 1, '#a8804e'); R(lx - 3, ly, 1, 1, '#8c8f86');
    }
    if (b.reinforce && b.planks > 0) this.drawReinforce(v, b, x, y, horiz);
    if (b.safe && b.planks <= 0) this.drawRubble(v, x, y, b.id); // C4: walk through it until it's boarded again
    if (g.t - (b.lastTear ?? -99) < 0.15) { R(x + 6, y + 6, 4, 4, '#e8dfc6'); }
  }
  // an empty doorway, not a black hole: a timber frame, a threshold, and the room beyond in lamp-less gloom
  // (floorboards, a skirting, something knocked over). Bare nail-holes and chalk ticks on the jambs mark every
  // spot that takes boards, and while any plank is missing a slow amber glint on the nails says "board me".
  drawOpening(R, b, x, y, horiz) {
    const k = b.id * 31, bx = horiz ? x + 1 : x + 2, by = y - 4, bw = horiz ? 14 : 12, bh = horiz ? 18 : 20;
    R(bx - 2, by - 2, bw + 4, bh + 3, '#2b1d16'); // frame / lintel
    R(bx - 1, by - 1, bw + 2, 1, '#5a3e2a'); R(bx - 2, by - 2, bw + 4, 1, '#6b4a2e');
    R(bx, by, bw, bh, '#1e1814'); // the room, unlit
    for (let j = 4; j < bh; j += 3) { const d = Math.min(1, j / bh); R(bx, by + j, bw, 1, shade('#4a3424', -0.55 + 0.45 * d)); } // floorboards, lighter toward the door
    R(bx, by + 3, bw, 1, '#3a2a1e'); // skirting on the far wall
    R(bx + 1 + (k % 5), by, 3, 3, '#2a2420'); // a picture frame / cupboard in the dark
    if (k % 3 === 0) { R(bx + bw - 6, by + 8, 4, 2, '#3a2a1e'); R(bx + bw - 6, by + 10, 1, 2, '#2b1d16'); R(bx + bw - 3, by + 7, 1, 3, '#2b1d16'); } // a chair on its side
    else if (k % 3 === 1) R(bx + 2, by + bh - 6, 5, 3, '#3d342a'); // a dropped box
    R(bx, by + bh - 2, bw, 2, '#6a5a48'); R(bx, by + bh - 2, bw, 1, '#8a7a62'); // stone threshold, catching the outside light
    R(bx, by, 1, bh, '#140f0c'); R(bx + bw - 1, by, 1, bh, '#140f0c'); // shadow inside the jambs
    if (b.planks < 6) {
      const glow = 0.5 + 0.5 * Math.sin(this.time * 3 + b.id), nail = glow > 0.6 ? '#e2b53c' : '#8a6a32';
      for (let i = 0; i < 6; i++) if (i >= b.planks) {
        if (horiz) { const py = y - 3 + i * 3; R(bx - 2, py, 1, 1, nail); R(bx + bw + 1, py, 1, 1, nail); }
        else { const px = x + 2 + i * 2; R(px, by - 2, 1, 1, nail); R(px, by + bh, 1, 1, nail); }
      }
      R(bx - 2, by + 2, 1, 3, '#d8d4c8'); R(bx + bw + 1, by + 2, 1, 3, '#d8d4c8'); // chalk ticks on the jambs
    }
  }
  // reinforcement is visible; the Red Lion's shutters look heavier than the town's bars and sheets
  drawReinforce(v, b, x, y, horiz) {
    const R = (a, c, w, h, col) => { v.fillStyle = col; v.fillRect(a, c, w, h); };
    const bx = horiz ? x : x + 2, by = y - 4, bw = horiz ? 16 : 12, bh = horiz ? 18 : 20;
    if (b.safe) {
      const steel = b.reinforce >= 2;
      if (steel) { // steel shutter, painted green, padlocked
        R(bx - 1, by - 1, bw + 2, bh + 2, '#2a3a2a'); R(bx, by, bw, bh, '#3e5a3a'); for (let j = 0; j < bh; j += 3) R(bx, by + j, bw, 1, '#2f4a2e'); R(bx, by, bw, 1, '#5a7a54');
        R(bx + (bw >> 1) - 2, by + (bh >> 1) - 1, 4, 4, '#c9a24a'); R(bx + (bw >> 1) - 1, by + (bh >> 1) - 3, 2, 2, '#9aa3a8'); R(bx + (bw >> 1) - 1, by + (bh >> 1), 1, 1, '#2b1d16');
        R(bx + 2, by + 3, 2, 1, '#8a5a32');
      } else { // oak, dark, studded
        R(bx - 1, by - 1, bw + 2, bh + 2, '#2a1a10'); R(bx, by, bw, bh, '#4a3020'); for (let i = 0; i < bw; i += 4) R(bx + i, by, 1, bh, '#3a2416'); R(bx, by, bw, 1, '#6a4a30');
        for (let j = 2; j < bh; j += 5) for (let i = 1; i < bw; i += 5) R(bx + i, by + j, 1, 1, '#9aa3a8');
      }
      return;
    }
    if (b.reinforce >= 2) { // riveted sheet with dents
      R(bx, by + 3, bw, bh - 6, '#7a848a'); R(bx, by + 3, bw, 1, '#a8b0b4'); R(bx, by + bh - 4, bw, 1, '#5a6066');
      for (let i = 1; i < bw; i += 3) { R(bx + i, by + 4, 1, 1, '#c8cfd0'); R(bx + i, by + bh - 5, 1, 1, '#c8cfd0'); }
      R(bx + 4, by + 8, 3, 2, '#5a6066'); R(bx + 5, by + 8, 1, 1, '#9aa3a8'); R(bx + bw - 5, by + 11, 2, 2, '#5a6066');
    }
    for (let i = 2; i < (horiz ? bw : bh); i += 4) { // steel bars, rust at the welds
      if (horiz) { R(bx + i, by, 1, bh, '#9aa3a8'); R(bx + i, by + 1, 1, 1, '#a8552e'); R(bx + i, by + bh - 2, 1, 1, '#a8552e'); }
      else { R(bx, by + i, bw, 1, '#9aa3a8'); R(bx + 1, by + i, 1, 1, '#a8552e'); R(bx + bw - 2, by + i, 1, 1, '#a8552e'); }
    }
    if (horiz) { R(bx, by + 1, bw, 1, '#6f787d'); R(bx, by + bh - 2, bw, 1, '#6f787d'); }
  }
  drawDoor(v, d) {
    const anim = this.doorAnims.find((a) => a.id === d.id);
    if (d.open && !anim) return;
    const t0 = d.tiles[0], x = t0[0] * TS, y = t0[1] * TS;
    const w = d.vertical ? TS : 3 * TS, h = d.vertical ? 3 * TS : TS;
    if (anim) v.globalAlpha = 1 - anim.t / 0.6;
    const R = (a, b, ww, hh, c) => { v.fillStyle = c; v.fillRect(Math.round(a), Math.round(b), ww, hh); };
    const ox = anim ? Math.round(anim.t * 20) : 0;
    switch (d.kind) {
      case 'cars': { // wrecked cars, batteries pulled, bonnets up
        R(x - 2 + ox, y + 2, w + 4, 18, '#b5503b'); R(x - 2 + ox, y + 2, w + 4, 2, '#c86048'); R(x - 2 + ox, y + 18, w + 4, 2, '#7a3a2a'); R(x + 3 + ox, y + 6, w - 6, 5, '#2a3a48'); R(x + 4 + ox, y + 6, 3, 1, '#6a8298');
        R(x + 2 + ox, y + 22, w - 4, 20, '#4d8f8a'); R(x + 2 + ox, y + 22, w - 4, 1, '#6aaaa4'); R(x + 3 + ox, y + 25, w - 6, 6, '#2a3a48'); R(x + 5 + ox, y + 26, 2, 3, '#c8d4dc');
        R(x - 2, y + 36, w + 4, 10, '#e8dfc6'); R(x - 1, y + 38, w + 2, 4, '#2a3a48'); R(x + 2, y + 13, 3, 2, '#8a5a32'); R(x + w - 6, y + 30, 3, 3, '#8a5a32');
        for (const ty of [y + 16, y + 40]) { R(x - 3, ty, 3, 5, '#1c1c20'); R(x + w, ty, 3, 5, '#1c1c20'); }
        break; }
      case 'gate': case 'heras': {
        R(x, y - 4, w, h + 4, d.kind === 'gate' ? 'rgba(154,163,168,0.55)' : 'rgba(180,190,190,0.45)');
        v.fillStyle = '#8c949a'; for (let j = 0; j < h + 4; j += 2) for (let i = (j >> 1) % 2; i < w; i += 2) v.fillRect(x + i, y - 4 + j, 1, 1);
        R(x, y - 4, d.vertical ? 2 : w, d.vertical ? h + 4 : 2, '#6f787d'); R(x + (d.vertical ? w - 2 : 0), y + (d.vertical ? -4 : h - 2), d.vertical ? 2 : w, d.vertical ? h + 4 : 2, '#6f787d');
        if (d.kind === 'heras') for (let i = 0; i < Math.max(w, h); i += 24) R(x + (d.vertical ? 2 : i), y + (d.vertical ? i : h - 2), 8, 4, '#3a3a3e');
        else { for (let i = 0; i < 6; i++) R(x + w / 2 - 3 + i, y + h / 2 - 3 + (i % 2), 1, 1, '#c0c4c8'); R(x + w / 2 - 2, y + h / 2, 5, 5, '#c9a24a'); R(x + w / 2 - 1, y + h / 2 - 2, 3, 2, '#9aa3a8'); }
        break; }
      case 'skip': R(x - 2, y - 4, w + 4, h + 6, '#e2b53c'); R(x - 2, y - 4, w + 4, 3, '#f0cc60'); R(x - 2, y + h, w + 4, 2, '#a8801e'); R(x + 4, y + 2, w - 8, h - 6, '#c9a020'); R(x + 4, y + 4, w - 8, 3, '#5a3e2a'); for (let i = 6; i < w - 6; i += 10) R(x + i, y + 4, 4, 2, ['#9aa3a8', '#c49a62', '#2f2f33'][i % 3]); R(x + 2, y - 2, 2, h + 2, '#8a5a32'); break;
      case 'shutter': R(x, y - 6, w, h + 6, '#6f787d'); for (let i = 0; i < h + 6; i += 3) { R(x, y - 6 + i, w, 1, '#4a4d52'); R(x, y - 5 + i, w, 1, '#8a949a'); } R(x, y + h - 2, w, 2, '#3a3a3e'); R(x + 4, y + 2, 6, 3, '#4a4d52'); break;
      case 'hedge': R(x - 2, y - 6, w + 4, h + 6, '#2f6f2c'); R(x - 2, y - 6, w + 4, 3, '#46963a'); for (let i = 0; i < 8; i++) R(x + ((i * 13) % Math.max(4, w)), y - 4 + ((i * 7) % Math.max(4, h)), 2, 1, i % 2 ? '#1f4a1e' : '#6cbf4a'); R(x, y + h / 2 - 3, w, 6, '#5a3e2a'); R(x, y + h / 2 - 3, w, 2, '#8f6a3e'); R(x, y + h / 2 + 2, w, 1, '#3a2a1e'); break;
      case 'cabin': R(x - 2, y - 8, w + 4, h + 8, '#9aa3a8'); R(x - 2, y - 8, w + 4, 3, '#b8c0c4'); for (let i = 0; i < w + 4; i += 3) R(x - 2 + i, y - 5, 1, h + 5, '#8a949a'); R(x + 3, y + 8, w - 6, 8, '#2a3440'); R(x + 4, y + 8, 3, 1, '#6a8298'); break;
      case 'pallets': for (let i = 0; i < 5; i++) { const py = y - 6 + i * 4 + (d.vertical ? i * 6 : 0); R(x, py, w, 3, '#c49a62'); R(x, py, w, 1, '#d8b07a'); R(x, py + 2, w, 1, '#8f6a3e'); for (let k = 2; k < w; k += 12) R(x + k, py + 1, 1, 1, '#5a3e2a'); } break;
      default: { // boards / fence
        R(x, y - 6, w, h + 6, '#3a2e24');
        const n = d.vertical ? 8 : 6;
        for (let i = 0; i < n; i++) { const c = ['#c49a62', '#b08a58', '#8f6a3e'][i % 3]; if (d.vertical) { R(x + 1, y - 4 + i * 6, w - 2, 4, c); R(x + 1, y - 4 + i * 6, w - 2, 1, shade(c, 0.2)); R(x + 2, y - 3 + i * 6, 1, 1, '#8c8f86'); } else { R(x + i * 8 + 1, y - 6, 6, h + 6, c); R(x + i * 8 + 1, y - 6, 1, h + 6, shade(c, 0.2)); R(x + i * 8 + 3, y - 4, 1, 1, '#8c8f86'); R(x + i * 8 + 3, y + h - 3, 1, 1, '#8c8f86'); } }
        if (!d.vertical) pixelText(v, 'SHH', x + w / 2 - 5, y + 2, '#d8d4c8');
      }
    }
    if (!anim && d.cost) { // clear-to-open cost on an amber plate
      const t = String(d.cost), tw = pixelTextWidth(t), cx = Math.round(x + w / 2 - tw / 2), cy = Math.round(y + h / 2 - 3);
      R(cx - 3, cy - 2, tw + 6, 9, '#4a3410'); R(cx - 2, cy - 1, tw + 4, 7, '#c9902a'); R(cx - 2, cy - 1, tw + 4, 1, '#e8b850'); pixelText(v, t, cx, cy, '#2b1d16');
    }
    v.globalAlpha = 1;
  }
  drawBrazier(v, b) { // an oil drum with holes punched in it
    const x = b.px, y = b.py, R = (a, c, w, h, col) => { v.fillStyle = col; v.fillRect(a, c, w, h); };
    R(x - 5, y - 8, 10, 14, '#3e67a0'); R(x - 5, y - 8, 10, 2, '#5a80b8'); R(x - 5, y - 8, 1, 14, '#4e78b0'); R(x + 3, y - 6, 2, 12, '#2f4a7a'); R(x - 5, y - 3, 10, 1, '#2f4a7a'); R(x - 5, y + 2, 10, 1, '#2f4a7a');
    R(x - 3, y - 1, 2, 1, '#8a5a32'); R(x + 1, y + 4, 2, 1, '#8a5a32');
    const f = Math.floor(this.time * 8) % 2; R(x - 2, y, 1, 1, f ? '#f0b030' : '#e05a20'); R(x + 1, y - 5, 1, 1, f ? '#e05a20' : '#f0b030'); R(x + 2, y + 1, 1, 1, '#f0b030');
    this.flame(v, x, y - 9, 4);
  }
  flame(v, x, y, s) { // D10: 3-frame flame, core / edge / tip
    const f = Math.floor(this.time * 10 + x * 0.37) % 3, F = RAMP.fire;
    const R = (a, c, w, h, col) => { v.fillStyle = col; v.fillRect(Math.round(a), Math.round(c), w, h); };
    R(x - s, y - 2, s * 2, 3, F.edge); R(x - s + 1 + (f === 1 ? 1 : 0), y - 5, s * 2 - 2, 3, F.edge);
    R(x - s + 2, y - 3, Math.max(1, s * 2 - 4), 3, F.core); R(x - 1 + (f - 1), y - 7, 2, 2, F.core);
    R(x - 1 + (f - 1) + (f === 2 ? 1 : 0), y - 9, 1, 2, F.tip); R(x - s + (f === 0 ? 0 : 1), y - 4, 1, 1, F.tip);
  }
  drawFire(v, x, y, r, t, f) {
    const n = Math.round(r / 2), F = RAMP.fire;
    v.fillStyle = 'rgba(43,29,22,0.5)'; v.fillRect(Math.round(x - r), Math.round(y - r * 0.4), Math.round(r * 2), Math.round(r * 0.8)); // scorch underneath
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996 + this.time * 0.5, d = (i / n) * r * 0.9;
      this.flame(v, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, 2 + (i % 2));
    }
    if (Math.random() < 0.3) this.particles.push({ x: x + (Math.random() - 0.5) * r, y, z: 10, vx: (Math.random() - 0.5) * 8, vy: 0, vz: 30, t: 0, life: 1, c: F.core, s: 1, smoke: true, grav: 0, ember: true });
    if (r > 14) { // heat shimmer: a 1 px row offset above large fires
      const sy = Math.round(y - r * 0.6 - 10 - this.cam.ry), sx = Math.round(x - r - this.cam.rx), w = Math.round(r * 2);
      if (sy > 1 && sx > 0 && sx + w < VW && sy < VH - 2) { const o = Math.floor(this.time * 12) % 2 ? 1 : -1; v.save(); v.setTransform(1, 0, 0, 1, 0, 0); v.drawImage(this.view, sx * HD, sy * HD, w * HD, 2 * HD, (sx + o) * HD, sy * HD, w * HD, 2 * HD); v.restore(); }
    }
    if (f) { const m = this.mem(f); if (!m.scorched) { m.scorched = true; this.addScorch(x, y, Math.min(16, r)); } } // leaves a scorch behind
  }
  drawGas(v, gs) { // bloater gas yellow-green; hazmat bright green with a bubbling edge
    const r = gs.r, x0 = Math.round(gs.x), y0 = Math.round(gs.y), hz = !!gs.hazmat;
    v.fillStyle = hz ? 'rgba(108,191,74,0.42)' : 'rgba(184,196,58,0.4)';
    for (let dy = -r; dy <= r; dy += 2) { const w = Math.round(Math.sqrt(r * r - dy * dy)); for (let dx = -w; dx < w; dx += 2) if (((dx + dy) >> 1) % 2 === 0) v.fillRect(x0 + dx, y0 + dy - 6, 2, 2); }
    if (hz) { v.fillStyle = 'rgba(160,230,110,0.8)'; for (let i = 0; i < 10; i++) { const a = i * 0.63 + this.time * 0.8, k = (Math.sin(this.time * 6 + i * 2) + 1) / 2; v.fillRect(Math.round(x0 + Math.cos(a) * r), Math.round(y0 - 6 + Math.sin(a) * r), 1 + Math.round(k), 1 + Math.round(k)); } }
    else if (Math.random() < 0.1) this.smoke(x0 + (Math.random() - 0.5) * r, y0 - 4, 1.2, '#b8c43a');
  }
  drawBarrel(v, b) { // red, ribbed, a flammable diamond
    const x = b.px, y = b.py, R = (a, c, w, h, col) => { v.fillStyle = col; v.fillRect(a, c, w, h); };
    const hot = b.fuse >= 0 && Math.floor(this.time * 16) % 2;
    R(x - 5, y - 10, 10, 16, hot ? '#f0d070' : '#a8402f'); R(x - 5, y - 10, 10, 2, '#c86048'); R(x - 5, y - 10, 1, 16, '#c05a44'); R(x + 3, y - 8, 2, 14, '#7a2a22');
    R(x - 5, y - 4, 10, 1, '#7a2a22'); R(x - 5, y + 1, 10, 1, '#7a2a22'); R(x - 4, y - 10, 8, 1, '#5a1a14');
    R(x - 1, y - 8, 2, 1, '#e2b53c'); R(x - 2, y - 7, 4, 1, '#e2b53c'); R(x - 1, y - 6, 2, 1, '#e2b53c'); R(x, y - 7, 1, 1, '#2b1d16');
    R(x + 1, y + 3, 2, 2, '#8a5a32');
  }
  drawCrate(v, g, c) {
    const x = c.px, y = c.py, R = (a, b, w, h, col) => { v.fillStyle = col; v.fillRect(Math.round(a), Math.round(b), w, h); };
    let lift = 0;
    if (c.state === 'moving') { lift = (6 - c.t) * 6; v.globalAlpha = Math.max(0, c.t / 6); }
    // a wooden supply crate: plank slats, iron corners, rope handle, a stencilled ? on a cream label
    const cy = y - lift, open = c.state === 'cycling' || c.state === 'ready';
    R(x - 9, cy - 6, 18, 12, '#2b1d16'); R(x - 8, cy - 5, 16, 10, '#a87a48');
    for (const j of [-5, -2, 1]) { R(x - 8, cy + j, 16, 1, '#c49a62'); R(x - 8, cy + j + 2, 16, 1, '#7a5430'); }
    for (const [a, b] of [[-8, -5], [6, -5], [-8, 3], [6, 3]]) { R(x + a, cy + b, 2, 2, '#4a4d52'); R(x + a, cy + b, 1, 1, '#8c8f86'); }
    R(x - 3, cy - 3, 6, 5, '#e8dfc6'); R(x - 1, cy - 2, 2, 1, '#b5302a'); R(x, cy - 1, 1, 1, '#b5302a'); R(x, cy + 1, 1, 1, '#b5302a');
    R(x - 10, cy - 2, 1, 3, '#c8b07a'); R(x + 9, cy - 2, 1, 3, '#c8b07a'); // rope handles
    if (open) { R(x - 9, cy - 11, 18, 5, '#2b1d16'); R(x - 8, cy - 10, 16, 3, '#7a5430'); R(x - 8, cy - 10, 16, 1, '#c49a62'); R(x - 7, cy - 7, 14, 1, '#d8c070'); } // lid up, straw inside
    else { R(x - 6, cy - 10, 7, 4, '#3a3a3e'); R(x - 5, cy - 9, 2, 2, '#e2b53c'); R(x - 2, cy - 12, 1, 2, '#6f787d'); } // her radio on top
    // lantern
    R(x + 9, y - 6, 4, 6, '#2b1d16'); R(x + 10, y - 5, 2, 4, '#f0b030');
    v.globalAlpha = 1;
    // the spin shows each candidate with its worth in Scrap, so a jackpot is visibly on the wheel; the last half-second lands on the real item
    const show = (id, bob = 0, big = false) => {
      const ix = Math.round(x) - 7, iy = Math.round(y) - 26 - bob;
      v.drawImage(icon(id.replace('t:', '')), ix, iy);
      if (id === 'closed') return;
      const val = itemValue(id), txt = val ? String(val) : '?', col = valueTint(val), w = pixelTextWidth(txt);
      v.fillStyle = 'rgba(27,20,16,0.85)'; v.fillRect(Math.round(x - w / 2) - 2, iy - 8, w + 4, 7);
      pixelText(v, txt, Math.round(x - w / 2), iy - 7, col);
      if (big && val >= 1250) pixelText(v, '*', Math.round(x + w / 2) + 3, iy - 7, col);
    };
    if (c.state === 'cycling') {
      const pool = CRATE_WEIGHTS.map((e) => e[0]);
      if (c.t > 0.5) show(pool[Math.floor(Math.pow(Math.max(0, 4 - c.t), 1.6) * 3) * 7 % pool.length]);
      else show(c.item === 'closed' ? 'closed' : c.item, 0, true);
    } else if (c.state === 'ready') {
      show(c.item === 'closed' ? 'closed' : c.item, Math.floor(this.time * 3) % 2, true);
    }
    if (c.beam > 0) { v.globalAlpha = Math.min(1, c.beam / 3) * 0.5; R(x - 3, y - 400, 6, 390, '#f0d070'); R(x - 1, y - 400, 2, 390, '#fff2b0'); v.globalAlpha = 1; }
  }
  drawFind(v, f) {
    const blink = f.t > T.finds.blinkFast ? Math.floor(this.time * 12) % 2 : f.t > T.finds.blinkSlow ? Math.floor(this.time * 4) % 2 : 0;
    if (blink) return;
    const bob = Math.round(Math.sin(this.time * 4) * 2);
    const r = 7 + (Math.floor(this.time * 3) % 2) * 2;
    v.fillStyle = f.rotten ? 'rgba(140,200,60,0.35)' : 'rgba(240,176,48,0.35)';
    this.pixelCircle(v, f.x, f.y, r, v.fillStyle);
    v.drawImage(icon(f.type), Math.round(f.x) - 7, Math.round(f.y) - 14 + bob);
    if (f.rotten) { v.fillStyle = '#8cc83c'; v.fillRect(Math.round(f.x) + 4, Math.round(f.y) - 16 + bob, 3, 3); }
  }
  // D7 generator: a diesel genset on skids, hazard frame, exhaust with spark arrester, fuel gauge, 3 LEDs,
  // cables to the station. Running: vibrates, puffs smoke, LEDs green. Off: a cold blanket draped over it.
  drawGenerator(v, g) {
    const gen = g.map.generator, on = g.power;
    const j = on ? Math.floor(this.time * 30) % 2 : 0;
    const x = gen.px - 16 + j, y = gen.py - 16, R = (a, b, w, h, c) => { v.fillStyle = c; v.fillRect(a, b, w, h); };
    R(gen.px - 16, gen.py + 6, 32, 3, 'rgba(0,0,0,0.35)');
    R(x - 1, y + 19, 34, 3, '#3a3a3e'); R(x - 1, y + 19, 34, 1, '#5a5e64'); // skids
    for (let i = 0; i < 32; i += 4) R(x + i, y + 4, 2, 2, (i / 4) % 2 ? '#2b1d16' : '#e2b53c'); // hazard frame
    R(x, y + 4, 1, 16, '#e2b53c'); R(x + 31, y + 4, 1, 16, '#2b1d16');
    R(x + 1, y + 6, 30, 13, '#5d6b3a'); R(x + 1, y + 6, 30, 1, '#7a8a4a'); R(x + 27, y + 7, 4, 12, '#3e4a26');
    for (let i = 0; i < 10; i += 2) R(x + 3 + i, y + 8, 1, 8, '#3e4a26'); // grille
    R(x + 15, y + 8, 10, 7, '#2f2f33'); R(x + 15, y + 8, 10, 1, '#4a4d52'); // control panel
    for (let i = 0; i < 3; i++) R(x + 16 + i * 3, y + 10, 2, 2, on ? (i === 2 && Math.floor(this.time * 2) % 2 ? '#3a6a2a' : '#6cbf4a') : '#5a1a14');
    const fuel = g.fuelRounds ? Math.max(0, Math.min(1, g.fuel / g.fuelRounds())) : 0; // gauge, needle by fuel left
    R(x + 16, y + 13, 7, 1, '#e8dfc6'); R(x + 16 + Math.round(fuel * 6), y + 12, 1, 2, '#e03a2a');
    R(x + 26, y - 2, 3, 8, '#4a4d52'); R(x + 25, y - 4, 5, 2, '#3a3a3e'); R(x + 26, y - 4, 3, 1, '#6f787d'); // exhaust, spark arrester
    for (let i = 0; i < 10; i++) R(gen.px - 18 - i * 2, gen.py + 4 + ((i >> 1) % 2), 2, 1, '#1d1d20'); // cable snaking to the station
    if (on) { const m = this.mem(gen); if (!(m.puff > this.time)) { m.puff = this.time + 0.5; this.smoke(x + 27, y - 5, 1.2, '#4a4d52'); } }
    else { // the silence habit: a blanket over it
      R(x + 2, y + 2, 28, 9, '#6a5a6a'); R(x + 2, y + 2, 28, 1, '#8a7a8a'); for (let i = 0; i < 28; i += 6) R(x + 2 + i, y + 3, 2, 7, '#5a4a5a');
      R(x + 3, y + 11, 3, 4, '#6a5a6a'); R(x + 24, y + 11, 4, 5, '#6a5a6a'); R(x + 12, y + 11, 2, 2, '#5a4a5a');
    }
  }
  drawWorkshop(v, g) {
    const ws = g.workshop;
    if (ws.state === 'working' && Math.random() < 0.5) this.spark(ws.px + (Math.random() - 0.5) * 16, ws.py + 6);
    if (ws.state === 'ready' && ws.w) {
      const bob = Math.floor(this.time * 3) % 2;
      v.drawImage(icon(ws.w.id), ws.px - 7, ws.py - 10 - bob);
    }
    if (g.power) { v.fillStyle = '#6cbf4a'; v.fillRect(ws.px + 18, ws.py - 2, 2, 2); }
  }
  drawTrapSwitch(v, g, t) { // LED: amber armed, green flashing while firing, red cooling down, dark without power
    const firing = t.activeT > 0, col = !g.power ? '#2a2a2e' : firing ? (Math.floor(this.time * 8) % 2 ? '#6cbf4a' : '#3a6a2a') : t.cd > 0 ? '#e03a2a' : '#e2b53c';
    v.fillStyle = col; v.fillRect(t.px - 2, t.py - 5, 3, 2);
    v.fillStyle = '#c0302a'; v.fillRect(t.px + 4, firing ? t.py - 2 : t.py - 4, 1, 2); // the lever, thrown while firing
    if (g.power && !firing && t.cd <= 0) { v.fillStyle = 'rgba(226,181,60,0.35)'; v.fillRect(t.px - 3, t.py - 6, 5, 4); }
  }
  drawTrapAreas(v, g) {
    for (const t of g.traps) {
      if (t.activeT <= 0) continue;
      const [x0, y0, x1, y1] = t.rect;
      if (t.kind === 'fence') {
        v.fillStyle = 'rgba(160,200,255,0.25)'; v.fillRect(x0, y0, x1 - x0, y1 - y0);
        for (let i = 0; i < 6; i++) this.spark(x0 + Math.random() * (x1 - x0), y0 + Math.random() * (y1 - y0), '#9ad0ff');
      } else if (t.kind === 'fireline' || t.kind === 'petrol') {
        for (let x = x0 + 4; x < x1; x += 8) for (let y = y0 + 6; y < y1; y += 10) if (((x + y) >> 3) % 2 === 0 || t.kind === 'fireline') this.flame(v, x + ((y >> 3) % 2) * 3, y, 3);
      } else if (t.kind === 'searchlight') {
        const k = (Math.sin(this.time * 0.8) + 1) / 2;
        v.fillStyle = 'rgba(255,255,230,0.18)'; v.fillRect(Math.round(x0 + k * (x1 - x0 - 32)), y0, 32, y1 - y0);
      }
    }
  }
  // D10 explosion, 5 frames: white flash, orange ball, dark smoke, a debris ring (the scorch decal stays after)
  drawExplosion(v, e) {
    const f = Math.min(4, Math.floor(e.t / 0.09)), r = e.r;
    if (f === 0) { this.pixelCircle(v, e.x, e.y - 4, r * 0.5, '#f2ead6'); }
    else if (f === 1) { this.pixelCircle(v, e.x, e.y - 4, r * 0.75, '#e05a20'); this.pixelCircle(v, e.x, e.y - 5, r * 0.5, '#f0b030'); this.pixelCircle(v, e.x, e.y - 6, r * 0.25, '#fff2b0'); }
    else if (f === 2) { this.pixelCircle(v, e.x, e.y - 6, r * 0.8, '#4a4448'); this.pixelCircle(v, e.x, e.y - 7, r * 0.45, '#e05a20'); }
    else if (f === 3) { this.pixelCircle(v, e.x, e.y - 8, r * 0.7, '#3a3a3e'); this.pixelCircleOutline(v, e.x, e.y, r * 0.95, '#8f6a3e'); this.pixelCircleOutline(v, e.x, e.y, r * 0.85, '#6b6f75'); }
    else { v.globalAlpha = 0.5; this.pixelCircle(v, e.x, e.y - 10, r * 0.6, '#3a3a3e'); v.globalAlpha = 1; this.pixelCircleOutline(v, e.x, e.y, r * 1.1, '#5a4a40', 0.6); }
  }
  // D10 electricity: blue-white jagged arcs, 2 frames, sparks
  drawArc(v, a) {
    const f = Math.floor(this.time * 30) % 2, n = 6, x1 = a.x1, y1 = a.y1 - 10, x2 = a.x2, y2 = a.y2 - 10;
    let px = x1, py = y1;
    for (let i = 1; i <= n; i++) {
      const k = i / n, j = i === n ? 0 : ((((i * 7 + f * 3) % 5) - 2) * 2);
      const nx = x1 + (x2 - x1) * k - (y2 - y1) / (Math.hypot(x2 - x1, y2 - y1) || 1) * j, ny = y1 + (y2 - y1) * k + (x2 - x1) / (Math.hypot(x2 - x1, y2 - y1) || 1) * j;
      this.pixelLine(v, px, py, nx, ny, i % 2 ? '#9ad0ff' : '#f2ead6', 1); px = nx; py = ny;
    }
    if (Math.random() < 0.5) this.spark(x2, a.y2 - 8, '#9ad0ff');
  }
  // ---------- lighting (§23.6) ----------
  // S3.1, drawn over the darkness: the Hilltop warm sky and the mast's blinking light, the far lights' colour, and
  // during a wave the dead pacing outside each spawn barricade (render-only, culled, capped at 30).
  drawBeyond(v, g, cx, cy) {
    const R = (x, y, w, h, c) => { v.fillStyle = c; v.fillRect(Math.round(x - cx), Math.round(y - cy), w, h); };
    const inV = (x, y, m = 40) => x > cx - m && x < cx + VW + m && y > cy - m && y < cy + VH + m;
    if (inV(HILLTOP.x, HILLTOP.y, 160)) {
      const k = g.mastRepaired ? 0.2 : 0.11;
      v.save(); v.beginPath(); v.rect(0, 0, VW, VH); v.rect(TS - cx, TS - cy, 94 * TS, 62 * TS); v.clip('evenodd'); // only beyond the fence
      for (let i = 0; i < 4; i++) { const r = 96 - i * 20; v.fillStyle = `rgba(232,150,70,${k * (0.35 + i * 0.2)})`; v.beginPath(); v.ellipse(HILLTOP.x - cx, HILLTOP.y - 6 - cy, r, r * 0.4, 0, 0, 7); v.fill(); }
      v.restore();
      R(HILLTOP.x - 1, HILLTOP.y - 30, 4, 40, 'rgba(20,16,12,0.7)'); // the mast against the glow
      if (Math.floor(this.time * (g.mastRepaired ? 2 : 1)) % 2) { R(HILLTOP.x - 1, HILLTOP.y - 33, 3, 3, '#ff4a32'); R(HILLTOP.x, HILLTOP.y - 32, 1, 1, '#ffd0a0'); }
    }
    for (const f of FAR_LIGHTS) {
      if (!inV(f.x, f.y)) continue;
      const t = this.time;
      if (f.kind === 'hazard' && Math.floor(t * 1.5 + f.x) % 2) { R(f.x - 5, f.y, 2, 2, '#f0a030'); R(f.x + 4, f.y, 2, 2, '#f0a030'); }
      else if (f.kind === 'police') R(f.x, f.y, 3, 2, Math.floor(t * 3) % 2 ? '#4a7aff' : '#ff3a3a');
      else if (f.kind === 'fire') { for (let i = 0; i < 4; i++) R(f.x - 4 + i * 2, f.y - 2 - ((Math.floor(t * 8) + i) % 3), 2, 3, i % 2 ? '#f0b030' : '#e05a20'); }
    }
    if (g.state !== 'active') return; // between waves the apron is still and empty
    let n = 0;
    for (const b of g.barricades) {
      if (b.building || n >= 30) continue;
      for (let i = 0; i < 3 && n < 30; i++, n++) {
        const ph = this.time * 0.6 + b.id * 1.7 + i * 2.1, side = Math.sin(ph) * 14 + (i - 1) * 10, back = 26 + i * 10 + Math.sin(ph * 0.7) * 4;
        const x = b.x - b.ix * back + -b.iy * side, y = b.y - b.iy * back + b.ix * side;
        if (!inV(x, y, 24)) continue;
        const dx = Math.cos(ph) * -b.iy + b.ix, dy = Math.cos(ph) * b.ix + b.iy, spr = charSprite('walker:g0', (b.id + i) % 12, viewForDir(dirIndex(dx, dy)).view, Math.floor(this.time * 3 + i) % 4, 'walk', 's');
        v.globalAlpha = 0.85; v.drawImage(hdOf(spr), Math.round(x - cx - spr.width / 2), Math.round(y - cy - spr.height + 2), spr.width, spr.height); v.globalAlpha = 1;
      }
    }
  }
  drawLighting(g, cx, cy) {
    const l = this.lctx, fog = g.fog ? 0.5 : 1, p = g.p;
    l.globalCompositeOperation = 'source-over';
    l.fillStyle = '#000'; l.fillRect(0, 0, LW, LH);
    l.globalCompositeOperation = 'lighten';
    const circ = (x, y, r, lit = 0.6) => {
      const lx = (x - cx) / 2, ly = (y - cy) / 2, rr = r / 2;
      if (lx < -rr || ly < -rr || lx > LW + rr || ly > LH + rr) return;
      l.fillStyle = '#787878'; l.beginPath(); l.arc(lx, ly, rr, 0, 7); l.fill();
      if (lit > 0) { l.fillStyle = '#ffffff'; l.beginPath(); l.arc(lx, ly, rr * lit, 0, 7); l.fill(); }
    };
    const flick = () => (Math.floor(this.time * 8) % 2) * 2;
    // Cain's head torch: 14px circle + cone in the facing direction
    if (!p.dead && !this.hideTorch) {
      const tx = p.x, ty = p.y - 8;
      circ(tx, ty, 26 * fog, 0.55);
      const a = Math.atan2(p.fy, p.fx), spread = 0.5;
      const cone = (len, col) => { l.fillStyle = col; l.beginPath(); l.moveTo((tx - cx) / 2, (ty - cy) / 2); l.arc((tx - cx) / 2, (ty - cy) / 2, len / 2, a - spread, a + spread); l.closePath(); l.fill(); };
      cone(70 * fog, '#787878'); cone(46 * fog, '#ffffff');
    }
    if (p.muzzle > 0) circ(p.x, p.y - 8, 64, 0.6);
    for (const b of g.map.braziers) circ(b.px, b.py - 8, (48 + flick()) * fog, 0.55);
    for (const r of g.map.racks) circ(r.px, r.py + 4, 22 * fog, 0.4);
    for (const c of g.map.comfortSpots) circ(c.px, c.py + 4, (g.power || c.id === 'bandages' ? 30 : 18) * fog, 0.45);
    circ(g.map.secondWind.px, g.map.secondWind.py + 4, 26 * fog, 0.45);
    for (const c of g.crates) if (c.active || g.timed.sale > 0) { circ(c.px + 10, c.py - 4, 34 * fog, 0.5); if (c.beam > 0) for (let y = c.py - 380; y < c.py; y += 20) circ(c.px, y, 10, 1); }
    for (const f of g.fires) circ(f.x, f.y, (f.r * 2.5 + flick()) * fog, 0.6);
    for (const f of g.finds) circ(f.x, f.y - 6, 18, 0.6);
    for (const e of this.explosions) circ(e.x, e.y, e.r * 3, 0.7);
    for (const e of g.enemies) if (e.burn) circ(e.x, e.y - 8, 26, 0.5);
    for (const t of g.traps) if (t.activeT > 0 && t.kind !== 'bell') { const [x0, y0, x1, y1] = t.rect; circ((x0 + x1) / 2, (y0 + y1) / 2, Math.max(x1 - x0, y1 - y0) * 0.8, 0.6); }
    for (const c of g.cars) if (c.t > 0 && Math.floor(this.time * 4) % 2) circ(c.x, c.y, 34, 0.5);
    for (const lt of g.lights || []) circ(lt.x, lt.y, lt.r * fog, 0.6);
    if (g.beaconsLit) for (const bc of g.map.beacons) circ(bc.px, bc.py, 64 * fog, 0.6);
    for (const b of g.burning || []) circ(b.px, b.py, 90, 0.6);
    for (const w of g.worldItems || []) if (w.glow || w.kind === 'weapon') circ(w.x, w.y - 6, 14, 0.4);
    if (g.safeHouse) circ(g.map.pub.door.x, g.map.pub.door.y - 30, 70, 0.5);
    if (g.escape && (g.escape.stage === 'drive' || g.escape.stage === 'gone')) circ(g.escape.ex + 30, g.escape.ey, 60, 0.7);
    if (g.timedV && g.timedV.soldier > 0) circ(g.p.x - 60, g.p.y - 120, 20, 0.6);
    if (g.lightningT > 0) circ(g.p.x, g.p.y, 900, 1);
    // S3.1: lights out beyond the fence, and Hilltop's glow on the north-east horizon (stronger once the booster is up)
    for (const f of FAR_LIGHTS) { const on = f.kind === 'fire' ? 1 : Math.floor(this.time * (f.kind === 'police' ? 3 : 1.5) + f.x) % 2; if (on) circ(f.x, f.y, f.kind === 'fire' ? 40 + flick() : 24, f.kind === 'fire' ? 0.5 : 0.3); }
    if (g.power) {
      const k = this.powerT === undefined ? 99 : this.powerT; // lights flick on zone by zone
      const low = g.fuel !== undefined && g.fuel <= 1; // street lamps flicker when the generator is nearly dry
      for (const lm of g.map.lamps) { const z = g.zoneAt(lm.x, lm.y); if (low && (Math.floor(this.time * 9 + lm.x) % 7) === 0) continue; if (lampKind(g.map.lamps.indexOf(lm)) === 'smashed' && (Math.floor(this.time * 11 + lm.y) % 5) < 3) continue; /* VA-6: the smashed one flickers */ if (k > 0.25 * ((z * 3) % 9) * 0.25 + 0.1) circ(lm.x, lm.y - 4, 56 * fog, 0.5); }
      if (k > 0.5) for (const b of g.map.buildings) { const fy = (b.y + b.h - 1) * TS - 6 + 9; for (let i = 1; i < b.w - 1; i += 3) circ(b.x * TS + i * TS + 8, fy + 8, 16, 0.4); } // interior lights spill from the windows
      if (k > 0.3) for (let i = 0; i < 10; i++) circ(43 * TS + i * 18, 28 * TS + 4, 14, 0.8);
      circ(g.map.generator.px, g.map.generator.py, 30, 0.5);
      circ(g.workshop.px, g.workshop.py + 6, 40, 0.5);
      // searchlight sweeping the playing field
      if (k > 1 && !g.searchlightFixed) { const sx = 56 * TS + Math.sin(this.time * 0.6) * 5 * TS, sy = 11 * TS + Math.cos(this.time * 0.43) * 6 * TS; circ(sx, sy, 44, 0.7); }
    }
    if (g.searchlightFixed) { const sx = 56 * TS + Math.sin(this.time * 0.6) * 5 * TS, sy = 11 * TS + Math.cos(this.time * 0.43) * 6 * TS; circ(sx, sy, 44, 0.7); }
    const img = l.getImageData(0, 0, LW, LH).data;
    const out = this.overlayData.data, bands = this.bands;
    const dark = g.fog ? [58, 64, 78, 226] : [5, 8, 22, 200], dim = g.fog ? [64, 70, 84, 160] : [14, 20, 46, 142], lit = [255, 190, 110, 26];
    for (let i = 0, j = 0; i < LW * LH; i++, j += 4) {
      const val = img[j];
      const b = val >= 200 ? 2 : val >= 70 ? 1 : 0;
      bands[i] = b;
      const c = b === 2 ? lit : b === 1 ? dim : dark;
      out[j] = c[0]; out[j + 1] = c[1]; out[j + 2] = c[2]; out[j + 3] = c[3];
    }
    this.octx.putImageData(this.overlayData, 0, 0);
    this.v.imageSmoothingEnabled = false;
    this.v.drawImage(this.overlay, 0, 0, VW, VH);
  }
}
