// Biscuit the dog (ENHANCEMENT-PRD §10). Z: tap = attack what you face / come back, hold 1 s = stay here.
import { T } from '../tuning.js';
import { nextStep } from '../nav.js';

const DT = T.dt;
const hyp = Math.hypot;
const SPECIAL = { brute: 1, looter: 1, screamer: 1, butcher: 1, raider: 1, dog: 1 };

export const CompanionMixin = {
  initCompanion() { this.biscuit = null; this.dogHoldT = -1; this.dogGone = false; },
  adoptBiscuit(sp) {
    const B = T.biscuit;
    this.biscuit = { kind: 'biscuit', x: sp.px, y: sp.py + 8, ox: sp.px, oy: sp.py + 8, hp: B.hp, maxHp: B.hp, mode: 'follow', target: null, biteCD: 0, bites: 0,
      down: false, downHits: 0, stay: null, fx: 1, fy: 0, dead: false, boostUntil: 0, barkT: 0, noiseT: 0, moving: false, animT: 0, r: 4 };
    this.emit('banner', { key: 'survivor.join.biscuit', text: 'BISCUIT JOINS YOU', sub: 'Z: send him at what you face. Hold Z: stay. He trips, pins and barks', help: true });
    this.emit('biscuitJoin', {});
  },
  biscuitMaxHp() { return T.biscuit.hp + T.biscuit.hpGrowth * Math.floor(this.round / 5); },

  updateCompanion(inp) {
    const b = this.biscuit, p = this.p;
    // Z: tap or hold (§4)
    if (inp.dog) { if (this.dogHoldT < 0) this.dogHoldT = 0; else this.dogHoldT += DT; if (this.dogHoldT >= 1 && !this.dogHeld) { this.dogHeld = true; if (b && !b.dead && !b.down) { b.mode = 'stay'; b.stay = { x: b.x, y: b.y }; b.target = null; this.emit('biscuitCmd', { mode: 'stay' }); } } }
    else if (this.dogHoldT >= 0) { if (!this.dogHeld && b && !b.dead && !b.down) this.biscuitTap(); this.dogHoldT = -1; this.dogHeld = false; }
    if (!b || b.dead) return;
    b.ox = b.x; b.oy = b.y; b.moving = false; b.animT += DT;
    const mx = this.biscuitMaxHp(); if (mx > b.maxHp) { b.hp += mx - b.maxHp; b.maxHp = mx; }
    if (b.flash > 0) b.flash--;
    if (this.state === 'break' && b.hp < b.maxHp && !b.down) b.hp = Math.min(b.maxHp, b.hp + T.heal.biscuitBreak * DT); // v1.2 B12: he heals over the break
    if (b.down) return;
    b.biteCD -= DT; b.barkT -= DT; b.noiseT -= DT;
    // bark at specials, even in the dark (§10.3)
    if (b.barkT <= 0) {
      for (const e of this.enemies) if (!e.dead && SPECIAL[e.type] && hyp(e.x - b.x, e.y - b.y) < T.biscuit.barkRange) { e.outlineT = 2; b.barkT = 4; b.pointAt = { x: e.x, y: e.y, t: 1 }; this.emit('woof', { x: b.x, y: b.y }); break; }
    }
    if (b.pointAt) { b.pointAt.t -= DT; if (b.pointAt.t <= 0) b.pointAt = null; }
    // choose what to bite
    if (b.target && (b.target.dead || b.target.gone)) { b.target = null; if (b.mode === 'attack') b.mode = 'follow'; }
    // v1.4 G: below 30% he stops picking fights and stays behind you; below 15% he runs home to the Red Lion
    const k = b.hp / b.maxHp, B = T.biscuit;
    if (b.mode === 'retreat' && (k >= B.recover || !this.openZones.has(5))) { b.mode = 'follow'; this.emit('biscuitCmd', { mode: 'follow' }); }
    if (k < B.flee && b.mode !== 'retreat' && this.openZones.has(5)) { b.mode = 'retreat'; b.target = null; this.bark(null, true, 'Go home, Biscuit! Go on!'); }
    if (b.mode === 'retreat') { const hn = this.pubDoorFixed && !this.pubShut ? 'pub_in' : 'pub_door', h = this.map.spots[hn]; if (hyp(h.px - b.x, h.py - b.y) > 6) this.dogMove(b, h.px, h.py, T.biscuit.speed, this.lureField({ id: 'B' + hn, x: h.px, y: h.py })); return; }
    const wary = k < B.wary;
    if (wary) b.target = null;
    this.biscuitBark(b);
    let tgt = wary ? null : b.target;
    if (!tgt && !wary) {
      const cx = b.mode === 'stay' ? b.stay.x : p.x, cy = b.mode === 'stay' ? b.stay.y : p.y;
      const rad = b.mode === 'stay' ? T.biscuit.stayGuard : T.biscuit.guardDist;
      let bd = rad;
      for (const e of this.enemies) { if (e.dead || e.state !== 'inside' || e.ally > 0) continue; const d = hyp(e.x - cx, e.y - cy); if (d < bd) { bd = d; tgt = e; } }
    }
    if (tgt) {
      const d = hyp(tgt.x - b.x, tgt.y - b.y);
      b.fx = (tgt.x - b.x) / (d || 1); b.fy = (tgt.y - b.y) / (d || 1);
      if (d < tgt.r + 7) { if (b.biteCD <= 0) this.biscuitBite(tgt); }
      else this.dogMove(b, tgt.x, tgt.y, T.biscuit.speed, null);
      if (b.noiseT <= 0) { b.noiseT = 3; this.emitNoise('medium', b.x, b.y); this.emit('woof', { x: b.x, y: b.y }); }
      return;
    }
    if (b.mode === 'stay') { if (hyp(b.stay.x - b.x, b.stay.y - b.y) > 3) this.dogMove(b, b.stay.x, b.stay.y, T.biscuit.speed * 0.6, null); return; }
    const tx = p.x - p.fx * T.biscuit.followDist, ty = p.y - p.fy * T.biscuit.followDist;
    const d = hyp(tx - b.x, ty - b.y);
    if (d > 4) this.dogMove(b, tx, ty, d > 60 ? T.biscuit.speed : Math.min(T.biscuit.speed, 40 + d * 2), d > 30 ? this.field : null);
  },
  dogMove(b, tx, ty, speed, field) {
    let mx = tx - b.x, my = ty - b.y; const d = hyp(mx, my);
    if (d > 18) { const st = nextStep(this.W, this.H, this.walk, field || this.field, Math.floor(b.x / 16), Math.floor(b.y / 16)); if (st && (field || !this.lineClear(b.x, b.y, tx, ty))) { mx = st.x - b.x; my = st.y - b.y; } }
    const md = hyp(mx, my); if (md < 0.3) return;
    b.fx = mx / md; b.fy = my / md; b.moving = true;
    this.moveCircle(b, b.fx * Math.min(speed * DT, md), b.fy * Math.min(speed * DT, md), b.r);
  },
  // v1.4 G: a bark on a short cooldown knocks back and staggers whatever is crowding him or you
  biscuitBark(b) {
    const B = T.biscuit, p = this.p;
    b.barkCD = (b.barkCD || 0) - DT; if (b.barkCD > 0) return;
    if (!this.enemies.some((e) => !e.dead && e.state === 'inside' && e.ally <= 0 && (hyp(e.x - b.x, e.y - b.y) < B.barkTrigger || hyp(e.x - p.x, e.y - p.y) < B.barkTrigger))) return;
    b.barkCD = B.barkEvery;
    for (const e of this.enemies) if (!e.dead && e.state === 'inside' && e.ally <= 0 && hyp(e.x - b.x, e.y - b.y) < B.barkR) { if (e.type !== 'brute' && e.type !== 'butcher') this.knock(e, B.barkKnock, b.x, b.y); e.stagger = Math.max(e.stagger, B.barkStagger); e.atk = 0; }
    this.emit('woof', { x: b.x, y: b.y }); this.emit('biscuitBark', { x: b.x, y: b.y, r: B.barkR });
  },
  biscuitTap() {
    const b = this.biscuit, p = this.p;
    if (b.hp < b.maxHp * T.biscuit.wary) { this.emit('whimper', { x: b.x, y: b.y }); return; } // too hurt to go
    if (b.mode !== 'follow') { b.mode = 'follow'; b.target = null; this.emit('biscuitCmd', { mode: 'follow' }); return; }
    let best = null, bd = T.biscuit.attackRange;
    for (const e of this.enemies) {
      if (e.dead || e.ally > 0 || e.state !== 'inside') continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = hyp(dx, dy);
      if (d > bd || (d > 8 && (dx * p.fx + dy * p.fy) / d < 0.6)) continue;
      bd = d; best = e;
    }
    if (best) { b.mode = 'attack'; b.target = best; this.emit('biscuitCmd', { mode: 'attack' }); this.emit('woof', { x: b.x, y: b.y }); }
    else this.emit('woof', { x: b.x, y: b.y });
  },
  biscuitBite(e) {
    const b = this.biscuit, B = T.biscuit;
    b.biteCD = B.biteEvery; b.bites++;
    const dmg = B.bite * (this.round <= b.boostUntil ? 2 : 1);
    const pin = b.bites % B.pinEvery === 0;
    this.damageEnemy(e, dmg, { kind: 'dog', x: b.x, y: b.y, noHitScrap: true, biscuit: true, pinned: pin || e.pinnedT > 0 });
    if (!e.dead) {
      e.stagger = Math.max(e.stagger, pin ? B.pinTime : B.stagger); e.atk = 0;
      if (pin) { e.pinnedT = B.pinTime; this.emit('pinned', { x: e.x, y: e.y }); }
      // trip: a walker's legs go and it's a crawler from now on
      if (e.type === 'walker' && this.rng.next() < B.tripChance) { e.type = 'crawler'; e.speed = T.types.crawler.speed; this.emit('crawled', { x: e.x, y: e.y }); }
    }
    this.emit('bite', { x: e.x, y: e.y });
  },
  hurtBiscuit(dmg) {
    const b = this.biscuit; if (!b || b.dead) return;
    b.flash = 2;
    // downed: fire/burn ticks don't count, a grace period, then real hits only count once a second, so there is time to reach him (feedback)
    if (b.down) { if (dmg < 5 || this.t - b.downAt < T.biscuit.downGrace || this.t - (b.lastDownHit ?? -9) < 1) return; b.lastDownHit = this.t; b.downHits++; if (b.downHits >= T.biscuit.downedHits) this.biscuitDies(); return; }
    b.hp -= dmg;
    this.emit('whimper', { x: b.x, y: b.y });
    if (b.hp < b.maxHp * T.biscuit.wary && b.hp > 0 && !b.lowWarned) { b.lowWarned = true; this.bark(null, true, 'Biscuit\'s hurt. He\'ll stay behind me.'); }
    if (b.hp <= 0) { b.hp = 0; b.down = true; b.downHits = 0; b.downAt = this.t; b.target = null; this.emit('banner', { text: 'BISCUIT IS DOWN', sub: `He can take ${T.biscuit.downedHits} more hits. Get to him!`, danger: true }); }
  },
  // 0 when Biscuit has just gone down, 1 when the next counted hit kills him (drives the pulsing warning)
  biscuitDanger() {
    const b = this.biscuit; if (!b || b.dead || !b.down) return 0;
    const B = T.biscuit, grace = Math.min(1, (this.t - b.downAt) / B.downGrace);
    return Math.min(1, (grace + b.downHits) / B.downedHits);
  },
  biscuitDies() {
    const b = this.biscuit; b.dead = true;
    const p = this.p; p.busyT = 1; p.stunT = 1;
    this.emit('biscuitDied', { x: b.x, y: b.y });
    this.bark(null, true, 'Good boy. You were a good boy.');
  },
  companionInteractables(out) {
    const b = this.biscuit; if (!b || b.dead || !b.down) return;
    out.push({ id: 'biscuit', x: b.x, y: b.y, range: 20, describe: () => ({ label: 'Get Biscuit up', cost: 0, holdTime: T.biscuit.reviveHold, action: () => { b.down = false; b.lowWarned = false; b.hp = b.maxHp * 0.5; b.mode = 'follow'; this.emit('biscuitUp', { x: b.x, y: b.y }); }, sub: 'He\'s whimpering' }) });
  },
};
