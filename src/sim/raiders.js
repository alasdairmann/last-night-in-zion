// Raider rounds (ENHANCEMENT-PRD §17.4): living enemies with guns. Visible, dodgeable bullets; cover blocks them.
import { T } from '../tuning.js';
import { RADIO } from '../data.js';
import { FLOOR } from '../map/town.js';
import { nextStep } from '../nav.js';

const DT = T.dt;
const hyp = Math.hypot;
export const RAIDER = {
  gunman: { hp: 300, speed: 55, dmg: 15, every: 1.2, range: 230 },
  brawler: { hp: 450, speed: 95, dmg: 30, every: 0.9, range: 12 },
  shotgunner: { hp: 400, speed: 35, dmg: 8, pellets: 6, every: 1.6, range: 90 },
  captain: { hp: 1200, speed: 45, dmg: 40, every: 2.0, range: 300, laser: 0.8 },
};

export const RaiderMixin = {
  initRaiders() { this.heist = null; this.raidRound = false; this.raidRoundCount = 0; this.raidersToSpawn = 0; this.raidT = 0; this.ebullets = []; this.lastSpecial = 'dogs'; this.raidDrops = []; this.raidLive = false; this.raidTotal = 0; },

  startRaidRound(r) {
    this.raidRound = true; this.raidRoundCount++;
    this.raidersToSpawn = Math.min(T.raiders.cap, T.raiders.base + T.raiders.growth * (this.raidRoundCount - 1));
    this.raidTotal = this.raidersToSpawn; this.raidLive = true; // v1.2 B2/B25: the HUD counter
    this.raidT = T.raiders.megaphone;
    const opts = Object.keys(this.map.spots).filter((k) => k.startsWith('raid_') && this.openZones.has(+k.slice(5))).map((k) => this.map.spots[k]);
    opts.sort((a, b) => (+(b.id === 'raid_3' || b.id === 'raid_8')) - (+(a.id === 'raid_3' || a.id === 'raid_8')));
    this.raidDrops = opts.slice(0, 2);
    if (this.raidDrops.length < 2) this.raidDrops.push(this.raidDrops[0] || this.map.spots.raid_1);
    this.emit('raidWarn', {});
    this.emit('banner', { text: 'ENGINES ON THE BYPASS', sub: `"${RADIO.raiders}"`, danger: true });
    this.radio(RADIO.raiders, 'Megaphone');
    this.radio('Raiders on the bypass. Kill their Captain and the rest will run.');
    this.survivorComment('raiders');
  },
  spawnRaiders(n, captain = true, squad = null) {
    const roles = [];
    if (captain) roles.push('captain');
    while (roles.length < n) { const x = this.rng.next(); roles.push(x < 0.5 ? 'gunman' : x < 0.75 ? 'brawler' : 'shotgunner'); }
    if (squad && this.enemies.length > 80) return;
    roles.forEach((role, i) => {
      const d = this.raidDrops[i % this.raidDrops.length] || this.map.spots.raid_1;
      const e = this.makeEnemy('raider'); e.role = role; e.hp = e.maxHp = RAIDER[role].hp; e.speed = RAIDER[role].speed;
      e.x = e.ox = d.px + this.rng.range(-12, 12); e.y = e.oy = d.py + this.rng.range(-12, 12); e.state = 'inside';
      e.fireCD = this.rng.range(0.5, 2); e.coverT = 0; e.drop = d; e.noticed = true; e.groanT = 999; e.squad = squad;
      if (squad) e.extra = true;
      this.enemies.push(e);
    });
    this.emit('raidersArrive', { x: this.raidDrops[0]?.px, y: this.raidDrops[0]?.py });
  },
  // v1.2 B2: "RAIDERS 6/9" on the HUD while a raid is on
  raidStatus() {
    if (!this.raidLive) return null;
    const alive = this.enemies.filter((e) => !e.dead && !e.gone && e.type === 'raider' && !e.squad).length;
    return { left: alive + (this.raidersToSpawn || 0), total: this.raidTotal };
  },
  updateRaiders() {
    if (this.raidRound && this.raidersToSpawn > 0) {
      this.raidT -= DT;
      if (this.raidT <= 0) { this.spawnRaiders(this.raidersToSpawn, true); this.raidersToSpawn = 0; }
    }
    if (this.raidLive && !this.raidersToSpawn && this.raidStatus().left === 0) {
      this.raidLive = false;
      this.emit('banner', { text: 'THE RAIDERS ARE GONE', sub: 'The bypass is quiet again' });
      this.radio('Engines heading off. That\'s the raid over.');
    }
    // bullets
    const p = this.p;
    for (const b of this.ebullets) {
      for (let k = 0; k < 3 && !b.done; k++) {
        b.x += b.vx * DT / 3; b.y += b.vy * DT / 3; b.t -= DT / 3;
        if (b.t <= 0 || this.tileAt(b.x, b.y) !== FLOOR) { b.done = true; this.emit('impact', { x: b.x, y: b.y, wall: true }); break; }
        if (!p.dead && hyp(b.x - p.x, b.y - p.y - 0) < p.r + 3) { b.done = true; this.hurtPlayer(b.dmg, { raider: true, x: b.x, y: b.y }); break; }
        for (const f of this.friendlies()) if (!f.dead && hyp(b.x - f.x, b.y - f.y) < 6) { b.done = true; this.hurtFriendly(f, b.dmg); break; }
      }
    }
    if (this.ebullets.some((b) => b.done)) this.ebullets = this.ebullets.filter((b) => !b.done);
  },
  raiderShoot(e, ang, dmg, n = 1, spread = 0) {
    for (let i = 0; i < n; i++) {
      const a = ang + (n > 1 ? (this.rng.next() - 0.5) * spread : (this.rng.next() - 0.5) * 0.06);
      this.ebullets.push({ x: e.x + Math.cos(a) * 6, y: e.y - 6 + Math.sin(a) * 6, vx: Math.cos(a) * T.raiders.bulletSpeed, vy: Math.sin(a) * T.raiders.bulletSpeed, dmg, t: 1.6 });
    }
    this.emit('raiderShot', { x: e.x, y: e.y, role: e.role });
    this.addLure(e.x, e.y, T.noise.radius.loud * this.noiseMult(), T.noise.attractTime, 'noise');
  },
  raiderAI(e) {
    const p = this.p, R = RAIDER[e.role];
    e.fireCD -= DT; e.moving = false;
    if (e.fleeing) {
      e.fleeT = (e.fleeT || 0) + DT;
      const tx = e.drop.px, ty = e.drop.py;
      if (hyp(tx - e.x, ty - e.y) < 10 || e.fleeT > 6) { e.gone = true; this.emit('smoke', { x: e.x, y: e.y }); this.raiderEscaped(e); return; }
      this.raiderMove(e, tx, ty, e.speed * 1.4); return;
    }
    const dx = p.x - e.x, dy = p.y - e.y, d = hyp(dx, dy), ang = Math.atan2(dy - 0, dx);
    const sees = !p.dead && d < R.range + 40 && this.lineClear(e.x, e.y - 4, p.x, p.y - 4);
    // v1.4 E5: raiders who heard the booster go for the mast. Close enough to see Cain, they fight him instead
    if (e.squad === 'signal') {
      if (!sees) {
        const sp = this.map.spots.school_mast;
        e.laser = null;
        if (hyp(sp.px - e.x, sp.py - e.y) < T.booster.reach) { e.sabotage = true; e.fx = (sp.px - e.x) / (hyp(sp.px - e.x, sp.py - e.y) || 1); this.sabotageBooster(e); return; }
        e.sabotage = false; this.raiderMove(e, sp.px, sp.py, e.speed); return;
      }
      e.sabotage = false;
    } else {
      // the safe house: if Cain is bolted in, break in to get at him
      if (this.pubShut && this.inPub(p.x, p.y) && this.raiderBreach(e)) return;
      // v1.4 E4: far from Cain, they go to loot the Red Lion, and stay until they're full and the wave is over
      if (e.role !== 'captain' && this.pubLootOn() && (e.pubBound || (this.safeHouse && d > T.pubTheft.farDist)) && this.raiderLoot(e, sees, d)) return;
    }
    e.laser = null;
    switch (e.role) {
      case 'brawler':
        if (e.atk > 0) { e.atk -= DT; if (e.atk <= 0) { e.atkCD = R.every; if (d < e.r + p.r + R.range) this.hurtPlayer(R.dmg, e); } return; }
        if (e.atkCD > 0) e.atkCD -= DT;
        if (d < e.r + p.r + 8 && e.atkCD <= 0) { e.atk = 0.4; this.emit('windup', { x: e.x, y: e.y, type: 'raider' }); return; }
        this.raiderMove(e, p.x, p.y, e.speed); break;
      case 'shotgunner':
        if (sees && d < R.range && e.fireCD <= 0) { e.fireCD = R.every; e.fx = dx / d; e.fy = dy / d; this.raiderShoot(e, ang, R.dmg, R.pellets, 0.5); return; }
        if (d > 40) this.raiderMove(e, p.x, p.y, e.speed); break;
      case 'captain': {
        if (e.aimT > 0) {
          e.aimT -= DT; e.laser = { x2: p.x, y2: p.y - 6 }; e.fx = dx / d; e.fy = dy / d;
          if (e.aimT <= 0) { e.fireCD = R.every; this.raiderShoot(e, Math.atan2(p.y - 6 - (e.y - 6), p.x - e.x), R.dmg); }
          return;
        }
        if (sees && d < R.range && e.fireCD <= 0) { e.aimT = R.laser; this.emit('laser', { x: e.x, y: e.y }); return; }
        if (d < 170) { const ax = e.x - dx / d * 30, ay = e.y - dy / d * 30; this.raiderMove(e, ax, ay, e.speed, true); }
        else if (d > 250 || !sees) this.raiderMove(e, p.x, p.y, e.speed);
        break;
      }
      default: { // gunman: cover to cover, peek and shoot
        e.coverT -= DT;
        if (!e.cover || e.coverT <= 0) { e.cover = this.pickCover(e); e.coverT = this.rng.range(6, 8); }
        const c = e.cover;
        if (c && hyp(c.x - e.x, c.y - e.y) > 6) { this.raiderMove(e, c.x, c.y, e.speed); if (!sees || e.fireCD > 0) return; }
        if (sees && d < R.range && e.fireCD <= 0) { e.fireCD = R.every; e.fx = dx / d; e.fy = dy / d; this.raiderShoot(e, Math.atan2(p.y - 6 - (e.y - 6), p.x - e.x), R.dmg); }
      }
    }
  },
  // ---------- v1.4 E4: the Red Lion heist. Slow, visible, and every Part comes back when the raider dies ----------
  pubLootOn() { return !(this.signal && this.signal.holding); },
  playerNearPub() { const d = this.map.pub.door; return this.inPub(this.p.x, this.p.y) || hyp(this.p.x - d.x, this.p.y - d.y) < T.pubTheft.stayNear; },
  raiderLoot(e, sees, d) {
    const P = T.pubTheft, door = this.map.pub.door;
    if (!e.pubBound) {
      e.pubBound = true; e.loot = e.loot || { parts: 0, scrap: 0, n: 0 }; e.lootT = 0;
      if (!this.heist) this.heist = { parts: 0, scrap: 0 };
      this.card({ key: 'raid.pub', prio: 'critical', text: 'RAIDERS HEADING FOR THE RED LION', sub: 'Get back there before they clean it out', pin: { x: door.x, y: door.y } });
    }
    const inside = e.inPub || this.inPub(e.x, e.y);
    if (!inside) {
      if (this.raiderBreach(e, true)) return true;
      this.raiderMove(e, door.x, door.y, e.speed); return true;
    }
    e.inPub = true;
    if (sees && d < RAIDER[e.role].range) return false; // Cain is here: stand and fight
    const L = e.loot;
    if (L.n >= P.cap) {
      // full: they only leave once the wave is over and Cain isn't on his way
      if (this.state !== 'active' && !this.playerNearPub()) { e.fleeing = true; e.fleeT = 0; }
      return true;
    }
    const bar = this.map.spots.pub_bar;
    if (hyp(bar.px - e.x, bar.py - e.y) > 14) this.raiderMove(e, bar.px + (e.id % 3 - 1) * 12, bar.py + 4, e.speed * 0.6, true);
    const slow = this.homeSurvivors().some((s) => this.inPub(s.x, s.y)) ? P.survivorSlow : 1;
    e.lootT += DT / slow;
    if (e.lootT >= P.every) {
      e.lootT = 0;
      if (this.parts >= P.parts) { this.parts -= P.parts; L.parts += P.parts; this.heist.parts += P.parts; }
      else if (this.scrap >= P.scrap) { this.scrap -= P.scrap; L.scrap += P.scrap; this.heist.scrap += P.scrap; }
      else return true;
      L.n++;
      this.emit('raiderSteal', { x: e.x, y: e.y });
      this.card({ key: 'raid.pub', prio: 'critical', text: 'RAIDERS IN THE RED LION', sub: `−${this.heist.parts} Parts, −${this.heist.scrap} Scrap. Kill them to get it back`, pin: { x: door.x, y: door.y } });
    }
    return true;
  },
  // killing a raider returns everything it took, always (Captains and leavers too)
  raiderReturnLoot(e) {
    const L = e.loot; if (!L || (!L.parts && !L.scrap)) return;
    if (L.parts) this.addParts(L.parts, e.x, e.y);
    if (L.scrap) this.addScrap(L.scrap, e.x, e.y - 14, true, null, true);
    if (this.heist) { this.heist.parts = Math.max(0, this.heist.parts - L.parts); this.heist.scrap = Math.max(0, this.heist.scrap - L.scrap); }
    this.card({ key: 'raid.back.' + e.id, prio: 'info', text: 'GOT IT BACK', sub: `${L.parts ? `+${L.parts} Parts ` : ''}${L.scrap ? `+${L.scrap} Scrap` : ''}`.trim() });
    e.loot = null; this.checkHeistOver();
  },
  raiderEscaped(e) {
    if (e.squad === 'signal') return;
    const L = e.loot;
    if (L && (L.parts || L.scrap)) { this.card({ key: 'raid.gone.' + e.id, prio: 'info', text: 'A RAIDER GOT AWAY', sub: `With ${L.parts} Parts and ${L.scrap} Scrap` }); if (this.heist) { this.heist.parts = Math.max(0, this.heist.parts - L.parts); this.heist.scrap = Math.max(0, this.heist.scrap - L.scrap); } }
    this.checkHeistOver();
  },
  checkHeistOver() {
    if (this.enemies.some((o) => !o.dead && !o.gone && o.type === 'raider' && o.pubBound && !o.fleeing)) return;
    this.heist = null; this.resolveCard('raid.pub');
  },
  pickCover(e) {
    const p = this.p; let best = null, bs = -Infinity;
    for (const c of this.map.cover) {
      if (!this.openZones.has(c.zone)) continue;
      const dp = hyp(c.x - p.x, c.y - p.y); if (dp < 70 || dp > 170) continue;
      const de = hyp(c.x - e.x, c.y - e.y); if (de > 220) continue;
      const s = -de * 0.5 - Math.abs(dp - 120) + this.rng.next() * 40;
      if (s > bs) { bs = s; best = c; }
    }
    return best;
  },
  raiderMove(e, tx, ty, speed, direct = false) {
    let mx = tx - e.x, my = ty - e.y;
    if (!direct && hyp(mx, my) > 18) {
      const f = this.lureField({ id: 'R' + Math.floor(tx / 16) + ',' + Math.floor(ty / 16), x: tx, y: ty });
      const s = nextStep(this.W, this.H, this.walk, f, Math.floor(e.x / 16), Math.floor(e.y / 16));
      if (s) { mx = s.x - e.x; my = s.y - e.y; }
    }
    const md = hyp(mx, my); if (md < 0.5) return;
    e.fx = mx / md; e.fy = my / md; e.moving = true;
    this.moveCircle(e, e.fx * Math.min(md, speed * DT), e.fy * Math.min(md, speed * DT), e.r);
  },
  raiderKilled(e) {
    const p = this.p;
    if (e.squad === 'signal') this.signalRaiderKilled();
    this.raiderReturnLoot(e);
    if (e.pubBound) this.checkHeistOver();
    const w = p.slots[p.cur];
    if (w && w.kind === 'gun' && w.id !== 'blowtorch') { const st = this.gunStats(w); w.reserve = Math.min(st.reserve, w.reserve + Math.ceil(st.reserve * T.raiders.ammoRefill)); }
    if (e.role === 'captain') {
      const guns = ['rifle', 'ar', 'shotgun', 'smg', 'pistol'];
      this.addWorldItem({ item: 'weapon', kind: 'weapon', weapon: this.rng.pick(guns), cond: 3, x: e.x, y: e.y });
      for (const o of this.enemies) if (!o.dead && o.type === 'raider' && o.squad === e.squad) { o.fleeing = true; o.fleeT = 0; }
      this.emit('banner', { text: 'THE CAPTAIN IS DOWN', sub: 'The rest of them are running', danger: false });
    }
  },
};
