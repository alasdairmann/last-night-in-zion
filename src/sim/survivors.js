// Survivors and the Red Lion safe house (ENHANCEMENT-PRD §9), plus the escort NPC used by errands (§5.3 Escort).
import { T } from '../tuning.js';
import { ROLES, SURVIVOR_NAMES, SURVIVOR_LINES, OUTFITS, GUNS } from '../data.js';
import { nextStep } from '../nav.js';

const DT = T.dt;
const hyp = Math.hypot;
const HOMES = [[6, 48], [8, 46], [11, 48], [13, 46]];

export const SurvivorMixin = {
  initSurvivors() {
    this.survivors = [];
    this.safeHouse = false;
    this.safeBars = this.map.safeBars.map((b) => ({ ...b, planks: T.barricade.planks, lastTear: -99 }));
    this.safeAlertT = 0;
    this.rising = [];
    this.namesUsed = new Set();
    this.stash = []; this.pubWasIn = false; this.boltRearmed = true;
  },
  newSurvivor(x, y) {
    const have = new Set(this.survivors.filter((s) => !s.dead).map((s) => s.role));
    const roles = Object.keys(ROLES).filter((r) => !have.has(r));
    const role = this.rng.pick(roles.length ? roles : Object.keys(ROLES));
    const names = SURVIVOR_NAMES.filter((n) => !this.namesUsed.has(n));
    const name = this.rng.pick(names.length ? names : SURVIVOR_NAMES); this.namesUsed.add(name);
    const fighter = role === 'fighter';
    const hp = fighter ? T.survivors.fighterHp : T.survivors.hp;
    return { id: this.idSeq++, name, role, age: this.rng.int(19, 78), hp, maxHp: hp, x, y, ox: x, oy: y, fx: 0, fy: 1, state: 'escort', dead: false, sick: 0,
      outfit: this.rng.int(0, OUTFITS.length - 1), atkCD: 0, line: this.rng.int(0, SURVIVOR_LINES.length - 1), cower: false, moving: false, animT: 0, kind: 'survivor' };
  },
  spawnEscort(sp, tag) {
    const n = this.newSurvivor(sp.px, sp.py);
    n.tag = tag; n.hp = n.maxHp = Math.max(n.maxHp, T.escort.hp);
    this.survivors.push(n);
    this.emit('survivorFound', { x: sp.px, y: sp.py, name: n.name });
    this.bark(null, true, 'It\'s alright. Stay behind me.');
    return n;
  },
  escortLost(n) { if (!n.dead && n.state === 'escort') { n.dead = true; n.gone = true; } },
  admitSurvivor(n) {
    const homes = this.survivors.filter((s) => !s.dead && s.state === 'home').length;
    n.state = 'home'; n.hp = Math.min(n.maxHp, n.hp); if (n.role !== 'fighter') n.maxHp = T.survivors.hp; n.hp = Math.min(n.hp, n.maxHp);
    const h = HOMES[homes % HOMES.length]; n.home = { x: h[0] * 16 + 8, y: h[1] * 16 + 8 }; n.x = n.ox = n.home.x; n.y = n.oy = n.home.y;
    if (!this.safeHouse) { this.safeHouse = true; this.emit('banner', { text: 'THE RED LION IS A SAFE HOUSE NOW', sub: 'Keep its windows boarded. Survivors help while they live' }); }
    this.emit('banner', { key: 'survivor.join.' + n.name, prio: 'objective', text: `${n.name.toUpperCase()} JOINS YOU`, sub: `${ROLES[n.role].name}: ${ROLES[n.role].desc}` });
    if (n.role === 'medic') { this.bandagesStock = Math.min(this.bandageCap() + 1, this.bandagesStock + 1); if (this.hasComfort('bandages')) this.p.bandages = Math.min(this.bandageCap() + 1, this.p.bandages + 1); }
    this.emit('survivorJoin', { name: n.name, role: n.role });
  },
  // a survivor who reaches the pub on their own (roof rescue event)
  rescueDirect(x, y) {
    if (this.survivors.filter((s) => !s.dead).length >= T.survivors.max) { this.addScrap(500, x, y, true, null, true); return; }
    const n = this.newSurvivor(x, y); this.survivors.push(n); this.admitSurvivor(n);
  },
  hasRole(role) { return this.survivors.some((s) => s.role === role && !s.dead && !s.sick && s.state === 'home'); },
  homeSurvivors() { return this.survivors.filter((s) => !s.dead && s.state === 'home'); },
  boltedIn(s) { return s.kind === 'survivor' && s.state === 'home' && this.pubShut && this.inPub(s.x, s.y); },
  inPub(x, y) { const b = this.map.pub; return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1; },

  survivorsRoundStart(r) {
    const p = this.p;
    for (const s of this.homeSurvivors()) {
      if (s.hp < s.maxHp) s.hp = Math.min(s.maxHp, s.hp + (this.hasRole('medic') ? T.heal.medicPerRound : T.survivors.healPerRound)); // v1.2 B12
      if (s.sick > 0) {
        if (this.hasRole('medic') && s.role !== 'medic') { s.sick = 0; this.radio('Medic says the fever\'s down.', s.name); continue; }
        s.sick++;
        if (s.sick > T.survivors.sickDeathRounds) { this.survivorDies(s, 'sick'); continue; }
      } else if (r >= T.survivors.sickFromRound && !this.hasRole('medic') && this.rng.next() < T.survivors.sickChance) {
        s.sick = 1;
        this.radio('I don\'t feel right. Burning up. Pharmacy might have something.', s.name);
        if (!this.errandActive('medicine') && !this.triggers.some((t) => t.id === 'medicine')) this.triggers.push({ id: 'medicine', at: 'pub_bar', until: r + 2, sound: 0 });
      }
    }
    if (this.hasRole('scavenger')) { const b = this.map.spots.pub_bar; this.dropPart(b.px - 6, b.py); this.addWorldItem({ item: 'scrap', x: b.px + 6, y: b.py, kind: 'scrap', auto: true, n: this.rng.int(1, 3) * 100 }); }
    if (this.hasRole('cook') && hyp(p.x - this.map.pub.door.x, p.y - this.map.pub.door.y) < 64) this.repairPaddingLayer();
  },
  survivorDies(s, why) {
    if (s.dead) return;
    s.dead = true; s.hp = 0;
    this.emit('survivorDied', { x: s.x, y: s.y, name: s.name, why });
    if (why === 'sick') { this.radio(`${s.name} didn't wake up.`, 'Hilltop'); return; }
    if (s.state === 'home' && this.inPub(s.x, s.y)) this.rising.push({ t: T.survivors.riseDelay, x: s.x, y: s.y, outfit: s.outfit, name: s.name });
    else this.bark(null, true, `${s.name}... no.`);
  },
  hurtFriendly(f, dmg, src) {
    if (f.kind === 'biscuit') return this.hurtBiscuit(dmg, src);
    if (f.dead) return;
    if (this.boltedIn(f)) dmg /= T.pubRaid.survivorMult; // v1.2 B24: tougher behind a bolted door
    f.hp -= dmg; f.flash = 2;
    this.emit('friendHit', { x: f.x, y: f.y });
    if (f.state === 'home') this.safeAlertT = 4;
    if (f.hp <= 0) this.survivorDies(f, 'bitten');
  },
  // friendlies the dead will go for
  friendlies() {
    const out = [];
    for (const s of this.survivors) if (!s.dead) out.push(s);
    if (this.biscuit && !this.biscuit.dead) out.push(this.biscuit);
    return out;
  },

  updateSurvivors() {
    const p = this.p;
    if (this.safeAlertT > 0) this.safeAlertT -= DT;
    for (const r of this.rising) {
      r.t -= DT;
      if (r.t <= 0) {
        r.done = true;
        const e = this.makeEnemy('walker'); e.x = e.ox = r.x; e.y = e.oy = r.y; e.state = 'inside'; e.outfit = r.outfit; e.inPub = true; e.extra = true; e.risen = r.name; e.noticed = true;
        this.enemies.push(e);
        this.emit('turned', { x: r.x, y: r.y }); this.emit('survivorTurned', { name: r.name });
        this.bark(null, true, `Oh, ${r.name}. I'm sorry.`);
      }
    }
    if (this.rising.some((r) => r.done)) this.rising = this.rising.filter((r) => !r.done);
    const pubThreat = this.enemies.some((e) => !e.dead && e.state === 'inside' && this.inPub(e.x, e.y));
    for (const s of this.survivors) {
      s.ox = s.x; s.oy = s.y; s.moving = false; s.animT += DT;
      if (s.flash > 0) s.flash--;
      if (s.dead) continue;
      if (s.state === 'escort') this.escortAI(s);
      else if (s.weapon && this.survivorShoot(s)) { /* v1.4 F1/F5: shooting from inside */ }
      else if (pubThreat) this.survivorFight(s);
      else if (s.home && hyp(s.x - s.home.x, s.y - s.home.y) > 2) this.npcStep(s, s.home.x, s.home.y, 40, null);
    }
    for (const s of this.survivors) if (s.dead && s.weapon) { this.stash.push(s.weapon); s.weapon = null; } // their gun goes back in the stash
    if (this.survivors.some((s) => s.dead && (s.gone || s.state !== 'escort'))) this.survivors = this.survivors.filter((s) => !s.dead);
    this.autoBolt();
  },
  escortAI(s) {
    const p = this.p;
    let near = 0; for (const e of this.enemies) if (!e.dead && e.state === 'inside' && e.ally <= 0 && hyp(e.x - s.x, e.y - s.y) < T.escort.cowerRadius) near++;
    s.cower = near >= T.escort.cowerCount;
    if (s.cower) return;
    const tx = p.x - p.fx * T.escort.followDist, ty = p.y - p.fy * T.escort.followDist;
    if (hyp(tx - s.x, ty - s.y) < 6) return;
    this.npcStep(s, tx, ty, T.escort.speed, this.field);
  },
  survivorFight(s) {
    s.atkCD -= DT;
    let best = null, bd = 22;
    for (const e of this.enemies) { if (e.dead || e.state !== 'inside' || e.ally > 0) continue; const d = hyp(e.x - s.x, e.y - s.y); if (d < bd) { bd = d; best = e; } }
    if (best) {
      s.fx = (best.x - s.x) / (bd || 1); s.fy = (best.y - s.y) / (bd || 1);
      if (s.atkCD <= 0) {
        s.atkCD = T.survivors.attackEvery;
        const dmg = (s.role === 'fighter' ? T.survivors.fighterDmg * 2 : T.survivors.dmg) * (this.boltedIn(s) ? T.pubRaid.survivorMult : 1);
        this.damageEnemy(best, dmg, { kind: 'survivor', x: s.x, y: s.y, noHitScrap: true, noScrap: true });
        this.emit('survivorSwing', { x: s.x, y: s.y });
      }
    }
  },
  // ---------- v1.4 F1: survivors bolt the door behind you, and open it when you come back ----------
  autoBolt() {
    const p = this.p, d = this.map.pub.door, A = T.autoBolt, inPub = this.inPub(p.x, p.y), dd = hyp(p.x - d.x, p.y - d.y);
    const home = this.homeSurvivors().some((s) => this.inPub(s.x, s.y));
    if (!home || !this.pubDoorFixed || p.dead) { this.pubWasIn = inPub; return; }
    if (dd > A.rearm) this.boltRearmed = true;
    if (!this.pubShut && this.pubWasIn && !inPub && dd > A.leave && !this.zedsNear(d.x, d.y, 12) && ![p, ...this.friendlies()].some((o) => hyp(o.x - d.x, o.y - d.y) < 12)) {
      this.setPubShut(true, true); this.boltRearmed = false;
      this.card({ key: 'pub.autobolt', text: 'THEY BOLTED THE DOOR BEHIND YOU', sub: 'Come back and they\'ll let you in' });
    } else if (this.pubShut && !inPub && this.boltRearmed && dd < A.approach && !this.zedsNear(d.x, d.y, A.clearR)) {
      this.setPubShut(false, true); this.card({ key: 'pub.autoopen', text: 'THEY LET YOU IN' });
    }
    if (inPub) this.pubWasIn = true; else if (dd > A.leave) this.pubWasIn = false;
  },
  // ---------- v1.4 F5: at each break survivors take the best guns from the stash and shoot from inside ----------
  survivorsArm() {
    const home = this.homeSurvivors().filter((s) => !s.sick);
    for (const s of home) if (s.weapon) { this.stash.push(s.weapon); s.weapon = null; }
    const score = (w) => GUNS[w.id].dmg * GUNS[w.id].pellets * GUNS[w.id].rpm * this.condMult(w) * (1 + (w.tier || 0));
    const guns = this.stash.filter((w) => w.kind === 'gun' && w.id !== 'blowtorch').sort((a, b) => score(b) - score(a));
    for (const s of home) { const w = guns.shift(); if (!w) break; this.stash.splice(this.stash.indexOf(w), 1); s.weapon = w; }
  },
  // a clear shot from the pub: windows and the door don't block it
  pubShotClear(x0, y0, x1, y1) {
    const d = hyp(x1 - x0, y1 - y0), n = Math.ceil(d / 6);
    for (let i = 1; i < n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n, t = this.tileAt(x, y); if (t !== 0 && t !== 6 && !(t === 4 && this.inPub(x, y + 8))) return false; }
    return true;
  },
  survivorShoot(s) {
    const G = T.survivorGuns; s.atkCD -= DT;
    let best = null, bd = G.range;
    for (const e of this.enemies) { if (e.dead || e.ally > 0 || e.state === 'climb') continue; const d = hyp(e.x - s.x, e.y - s.y); if (d < bd && this.pubShotClear(s.x, s.y - 6, e.x, e.y - 6)) { bd = d; best = e; } }
    if (!best) return false;
    s.fx = (best.x - s.x) / (bd || 1); s.fy = (best.y - s.y) / (bd || 1);
    if (s.atkCD <= 0) {
      const st = this.gunStats(s.weapon), def = GUNS[s.weapon.id];
      s.atkCD = Math.max(G.minEvery, 60 / st.rpm * G.slowMult);
      this.damageEnemy(best, st.dmg * def.pellets * G.dmgMult * (this.boltedIn(s) ? T.pubRaid.survivorMult : 1), { kind: 'survivor', x: s.x, y: s.y, noHitScrap: true, noScrap: true });
      this.emit('survivorShot', { x1: s.x, y1: s.y - 8, x2: best.x, y2: best.y - 8, id: s.weapon.id });
    }
    return true;
  },
  npcStep(n, tx, ty, speed, field) {
    let mx = tx - n.x, my = ty - n.y; const d = hyp(mx, my);
    if (field && d > 20) { const st = nextStep(this.W, this.H, this.walk, field, Math.floor(n.x / 16), Math.floor(n.y / 16)); if (st) { mx = st.x - n.x; my = st.y - n.y; } }
    const md = hyp(mx, my); if (md < 0.5) return;
    n.fx = mx / md; n.fy = my / md; n.moving = true;
    this.moveCircle(n, n.fx * Math.min(speed * DT, md), n.fy * Math.min(speed * DT, md), 4);
  },

  survivorInteractables(out) {
    for (const s of this.homeSurvivors()) {
      out.push({ id: 'talk:' + s.id, x: s.x, y: s.y, range: 18, describe: () => {
        const talk = { label: `Talk to ${s.name}`, cost: 0, holdTime: 0.15, action: () => { s.line = (s.line + 1) % SURVIVOR_LINES.length; this.bark(null, true, `${s.name}: ${SURVIVOR_LINES[s.line]}`); }, sub: `${ROLES[s.role].name}${s.sick ? ' (sick)' : ''}, ${s.age}${s.weapon ? `. Has your ${this.weaponLabel(s.weapon)}` : ''}` };
        if (s.hp >= s.maxHp) return talk;
        // v1.2 B12: say how to heal them
        const heal = this.hasComfort('bandages') && this.p.bandages > 0
          ? { label: `Bandage ${s.name} (+${T.heal.bandage} HP)`, cost: 0, holdTime: 0.8, action: () => { this.p.bandages--; this.bandagesStock = this.p.bandages; s.hp = Math.min(s.maxHp, s.hp + T.heal.bandage); this.emit('padRepair', {}); }, sub: `Uses one of your Bandages (${this.p.bandages} left)` }
          : { label: `${s.name} is hurt: ${Math.ceil(s.hp)}/${s.maxHp}`, cost: 0, disabled: true, sub: `Heals ${this.hasRole('medic') ? T.heal.medicPerRound : T.survivors.healPerRound} HP a wave${this.hasRole('medic') ? ' (Medic)' : ', faster with a Medic'}. Bandages heal ${T.heal.bandage}` };
        return [heal, { ...talk, sub: `${talk.sub}. Hurt: ${Math.ceil(s.hp)}/${s.maxHp}` }];
      } });
    }
  },
  // big moments the survivors comment on over the radio (§9.5)
  survivorComment(kind) {
    const s = this.homeSurvivors()[0]; if (!s || this.rng.next() < 0.5) return;
    const lines = { power: 'Lights! I can see the lights from here!', brute: 'Big one coming. Be careful out there.', raiders: 'Engines. That\'s not the dead.', herd: 'There are so many of them...' };
    if (lines[kind]) this.radio(lines[kind], s.name);
  },
};

export { HOMES };
