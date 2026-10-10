// What changes wave to wave (ENHANCEMENT-PRD §15 trials, §16 weather, §18 town events).
import { T } from '../tuning.js';
import { FLOOR, WALL, PROP, SOFT } from '../map/town.js';
import { bfs, INF } from '../nav.js';
import { TRIALS, WEATHER, ZONE_NAMES, GUNS, MELEE, THROWS, FIND_TYPES } from '../data.js';

const DT = T.dt;
const hyp = Math.hypot;
const BUILD_FIRE = ['HARDWARE', 'FIRE STATION', 'ST MARY\'S', 'ZION PRIMARY', 'POST OFFICE', 'PHARMACY', 'HUNT & TACKLE', 'GARAGE', 'SITE OFFICE'];

export const NightsMixin = {
  initNights() {
    this.trial = null; this.lastTrial = null;
    this.weather = 'clear'; this.weatherRun = 0; this.thunderT = 0; this.stormFuseT = -1;
    this.event = null; this.quietUsed = false; this.burning = []; this.eventRoll = -1; this.flood = null; this.wrecks = [];
  },

  // ---------- weather (§16) ----------
  rollWeather(r) {
    if (r < T.weather.fromRound || this.dogRound || this.raidRound) { this.weather = 'clear'; this.weatherRun = 0; return; }
    let w = this.rng.weighted(T.weather.odds.map(([k, o]) => [k, o]));
    if (w === this.weather && w !== 'clear' && this.weatherRun >= T.weather.maxRun) w = 'clear';
    if (w === 'fog' && this.herd) w = 'rain';
    this.weatherRun = w === this.weather ? this.weatherRun + 1 : 1;
    this.weather = w;
    this.fog = w === 'fog';
    this.thunderT = this.rng.range(...T.weather.thunderEvery);
    this.stormFuseT = w === 'storm' && this.rng.next() < T.weather.stormFuse ? this.rng.range(10, 60) : -1;
    if (w !== 'clear') this.emit('banner', { text: WEATHER[w].name.toUpperCase(), sub: WEATHER[w].desc, weather: w, danger: w === 'storm' || w === 'fog' });
    this.emit('weather', { w });
  },
  noiseMult() { const w = this.weather; return w === 'rain' || w === 'storm' ? T.weather.rainNoise : w === 'still' ? T.weather.stillNoise : 1; },

  // ---------- trials (§15) ----------
  postTrial(r) {
    if (r < T.trials.fromRound || (r - T.trials.fromRound) % T.trials.every !== 0 || this.attract) return;
    const p = this.p;
    const opts = Object.keys(TRIALS).filter((k) => k !== this.lastTrial && (k !== 'biscuit' || (this.biscuit && !this.biscuit.dead)) && (k !== 'weapon' || this.trialWeapon()));
    const id = this.rng.pick(opts);
    const t = { id, n: 0, target: TRIALS[id].target(r), until: r + T.trials.every - 1, tier: 0 };
    if (id === 'weapon') t.w = this.trialWeapon();
    if (id === 'zone') t.z = this.rng.pick([...this.openZones]);
    this.trial = t; this.lastTrial = id;
    this.emit('banner', { text: 'A NEW TRIAL ON THE NOTICEBOARD', sub: this.trialText() });
  },
  // v1.4 D5: only a weapon you own (held or in the Red Lion stash), from the class you've used least this run
  trialWeapon() {
    const owned = [...this.p.slots, ...(this.stash || [])].filter((w) => w && w.id !== 'blowtorch' && w.id !== 'hammer');
    if (!owned.length) return null;
    const melee = this.stats.meleeKills || 0, gun = this.stats.gunKills || 0;
    const want = melee <= gun ? 'melee' : 'gun', pool = owned.filter((w) => w.kind === want);
    return this.rng.pick(pool.length ? pool : owned).id;
  },
  trialText() {
    const t = this.trial; if (!t) return '';
    return TRIALS[t.id].name.replace('{n}', t.target).replace('{w}', t.w ? (GUNS[t.w] || MELEE[t.w]).name : '').replace('{z}', ZONE_NAMES[t.z] || '');
  },
  // hover/click text for the HUD trial row: progress, deadline, and what it has paid out so far
  trialInfo() {
    const t = this.trial; if (!t) return null;
    const left = t.until - this.round + 1, n = Math.floor(t.n);
    const body = t.tier >= 2 ? `Mastered: ${n} done.` : t.tier === 1 ? `Complete! ${n}/${t.target * 2} to master it.` : `${n}/${t.target} done. ${t.target * 2} masters it.`;
    const won = (t.won || []).length ? `Won: ${t.won.join(', ')}.` : 'Prize: Scrap, Parts, a pocket refill or padding. Master it for a keepsake, a find, 5 Parts or a better weapon.';
    return { body: `${body} ${left > 0 ? `${left} wave${left > 1 ? 's' : ''} left (ends after wave ${t.until}).` : 'Ended.'}`, extra: won };
  },
  trialKill(e, src) {
    const t = this.trial; if (!t || this.round > t.until) return;
    let ok = false;
    switch (t.id) {
      case 'melee': ok = src.kind === 'melee'; break;
      case 'crit': ok = !!src.crit; break;
      case 'weapon': ok = src.w && src.w.id === t.w; break;
      case 'zone': ok = this.zoneAt(e.x, e.y) === t.z; break;
      case 'untouched': ok = true; break;
      case 'boom': ok = src.fireCredit ?? this.fireKill(e, src); break; // v1.2 B7: burned or blasted in the last 10 s
      case 'quiet': ok = this.noise < 20; break;
      case 'biscuit': ok = !!src.pinned || e.pinnedT > 0; break;
    }
    if (ok) this.trialAdd(1);
  },
  trialAdd(n) {
    const t = this.trial; if (!t || this.round > t.until) return;
    t.n += n;
    if (t.tier === 0 && t.n >= t.target) { t.tier = 1; this.trialReward(1); }
    if (t.tier === 1 && t.n >= t.target * 2) { t.tier = 2; this.trialReward(2); }
  },
  trialHurt() { if (this.trial && this.trial.id === 'untouched' && this.trial.tier < 2) this.trial.n = this.trial.tier ? this.trial.target : 0; },
  trialReward(tier) {
    const p = this.p, r = this.rng.int(0, 3);
    let sub = '';
    if (tier === 1) {
      if (r === 0) { this.addScrap(500, p.x, p.y - 20, true, null, true); sub = '+500 Scrap'; }
      else if (r === 1) { this.addParts(2); sub = '+2 Parts'; }
      else if (r === 2) { p.throwable.count = THROWS[p.throwable.id].max; sub = 'Pocket refilled'; }
      else { if (p.padLayers) { this.repairPaddingLayer(); sub = 'Padding layer repaired'; } else { this.addParts(2); sub = '+2 Parts'; } }
    } else {
      if (r === 0) { this.giveKeepsake(this.rng.pick(this.keepsake.pool)); sub = 'A keepsake'; }
      else if (r === 1) { this.spawnFind(p.x + p.fx * 16, p.y + p.fy * 16, this.rng.pick(FIND_TYPES), true, true); sub = 'A find at your feet'; }
      else if (r === 2) { this.addParts(5); sub = '+5 Parts'; }
      else { const w = this.curWeapon(); if (w && (w.cond ?? 1) < 4 && !p.lastChance) { this.improveCondition(w); sub = 'Free condition upgrade'; } else { this.addParts(5); sub = '+5 Parts'; } }
    }
    if (this.trial) (this.trial.won ||= []).push(sub);
    this.emit('trialDone', { tier });
    this.emit('banner', { text: tier === 1 ? 'TRIAL COMPLETE' : 'TRIAL MASTERED', sub });
  },

  // ---------- town events (§18) ----------
  nightsRoundStart(r) {
    this.postTrial(r);
    for (const b of this.burning) b.rounds--;
    this.burning = this.burning.filter((b) => b.rounds > 0);
    this.eventRoll = -1;
    if (r >= T.events.from && !this.dogRound && !this.raidRound && this.worldTriggerRound !== r && !this.attract && this.rng.next() < T.events.chancePerRound) this.eventRoll = this.t + this.rng.range(10, 40);
  },
  startEvent() {
    const kinds = ['heli', 'alarms', 'roof', 'truck', 'fire'];
    if (!this.quietUsed) kinds.push('quiet');
    if (this.doors.some((d) => !d.open && (this.openZones.has(d.a) || this.openZones.has(d.b)))) kinds.push('bus');
    const k = this.rng.pick(kinds);
    const zones = [...this.openZones];
    switch (k) {
      case 'heli': {
        const z = this.rng.pick(zones), s = this.map.spots['heli_' + z];
        this.event = { kind: 'heli', x: s.px, y: s.py, t: 0, burn: 60, phase: 'incoming' };
        this.emit('banner', { text: 'A HELICOPTER IS COMING DOWN', sub: 'It\'ll pull every walker in town. Wait for the fire to die', danger: true });
        this.emit('heliIncoming', { x: s.px, y: s.py });
        break;
      }
      case 'bus': {
        const d = this.rng.pick(this.doors.filter((o) => !o.open && (this.openZones.has(o.a) || this.openZones.has(o.b))));
        this.openDoor(d); this.widenBreach(d); const bus = this.placeBus(d);
        this.emit('busCrash', { x: bus ? bus.px : d.x, y: bus ? bus.py : d.y });
        this.emit('shake', { amt: 3, t: 0.5 });
        this.emit('banner', { text: 'A BUS CAME THROUGH THE FENCE', sub: `${d.name} is gone. A free shortcut`, danger: false });
        break;
      }
      case 'alarms': {
        this.event = { kind: 'alarms', t: 0, next: 0, left: 4 };
        this.emit('banner', { text: 'CAR ALARMS', sub: 'Something set them off. They pull walkers away', danger: false });
        break;
      }
      case 'roof': {
        const opts = ['roof_hardware', 'roof_news', 'roof_post'].map((n) => this.map.spots[n]).filter((s) => this.openZones.has(s.zone));
        if (!opts.length) return;
        const s = this.rng.pick(opts);
        this.event = { kind: 'roof', x: s.px, y: s.py, t: 0, hold: 0, life: 90 };
        this.emit('banner', { text: 'SOMEONE IS WAVING FROM A ROOF', sub: 'Stand under the window for 20 s while they climb down' });
        this.emit('heyThere', { x: s.px, y: s.py });
        break;
      }
      case 'truck': {
        const s = this.map.spots.truck_drop;
        if (!this.openZones.has(s.zone)) return;
        this.event = { kind: 'truck', x: s.px, y: s.py, t: 0, left: 3, life: 240 };
        for (let i = 0; i < 3; i++) this.addWorldItem({ item: 'supplies', x: s.px + 6, y: s.py - 14 + i * 14, kind: 'carry', heavy: true, hold: true, event: true, glow: true, life: 240 });
        this.emit('banner', { text: 'A SUPPLY TRUCK ON THE BYPASS', sub: 'Carry the crates to the Red Lion: 2 Parts + 300 each' });
        break;
      }
      case 'quiet': {
        this.quietUsed = true;
        this.event = { kind: 'quiet', t: 0, life: 20 };
        this.emit('quiet', {});
        break;
      }
      case 'fire': {
        const opts = this.map.buildings.filter((b) => BUILD_FIRE.includes(b.name) && this.openZones.has(b.zone) && !this.burning.some((x) => x.name === b.name));
        if (!opts.length) return;
        const b = this.rng.pick(opts);
        this.burning.push({ name: b.name, x0: b.x * 16 - 8, y0: b.y * 16 - 8, x1: (b.x + b.w) * 16 + 8, y1: (b.y + b.h) * 16 + 24, rounds: 3, px: (b.x + b.w / 2) * 16, py: (b.y + b.h / 2) * 16 });
        this.emit('banner', { text: `${b.name} IS ON FIRE`, sub: 'Nothing on it can be used for 3 waves', danger: true });
        break;
      }
    }
  },
  // v1.4 C3: the bus leaves a breach 1.5x a doorway (one more fence tile each side, where it opens floor to floor)
  widenBreach(d) {
    const W = this.W, t = d.tiles, a = t[0], b = t[t.length - 1];
    const ext = d.vertical ? [[a[0], a[1] - 1], [b[0], b[1] + 1]] : [[a[0] - 1, a[1]], [b[0] + 1, b[1]]];
    for (const [x, y] of ext) {
      if (this.tiles[y * W + x] !== WALL) continue;
      const [n1, n2] = d.vertical ? [[x - 1, y], [x + 1, y]] : [[x, y - 1], [x, y + 1]];
      if (this.tiles[n1[1] * W + n1[0]] !== FLOOR || this.tiles[n2[1] * W + n2[0]] !== FLOOR) continue;
      this.tiles[y * W + x] = FLOOR; (d.breach ||= []).push([x, y]);
    }
    this.refreshWalk();
  },
  // ...and the bus itself is a hard prop parked beside the breach, never across it, never cutting anything off
  placeBus(d) {
    const W = this.W, H = this.H, BW = T.bus.w, BH = T.bus.h, open = [...d.tiles, ...(d.breach || [])];
    const xs = open.map((o) => o[0]), ys = open.map((o) => o[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const cands = d.vertical
      ? [[x0 + 1, y0 - BH - 1], [x0 + 1, y1 + 2], [x0 - BW, y0 - BH - 1], [x0 - BW, y1 + 2]]
      : [[x1 + 2, y0 + 1], [x0 - BW - 1, y0 + 1], [x1 + 2, y0 - BH], [x0 - BW - 1, y0 - BH]];
    const reach = () => { const f = new Uint16Array(W * H); bfs(W, H, this.walk, d.tiles[1][0], d.tiles[1][1], f, this.queue); let n = 0; for (let i = 0; i < f.length; i++) if (f[i] !== INF) n++; return n; };
    const spotTiles = new Set(Object.values(this.map.spots).map((o) => o.y * W + o.x));
    const before = reach();
    for (const [cx, cy] of cands) {
      const cells = []; let ok = true;
      for (let y = cy; y < cy + BH && ok; y++) for (let x = cx; x < cx + BW; x++) { const i = y * W + x; if (x < 2 || y < 2 || x > W - 3 || y > H - 3 || this.tiles[i] !== FLOOR || spotTiles.has(i)) { ok = false; break; } cells.push(i); }
      if (!ok) continue;
      for (const i of cells) this.tiles[i] = PROP; this.refreshWalk();
      if (reach() === before - cells.length) { const w = { kind: 'bus', tx: cx, ty: cy, w: BW, h: BH, px: (cx + BW / 2) * 16, py: (cy + BH) * 16 - 8, breach: d.breach || [] }; this.wrecks.push(w); return w; }
      for (const i of cells) this.tiles[i] = FLOOR; this.refreshWalk();
    }
    return null;
  },
  desc_case(wi) { return { label: 'Force the locked case', cost: 0, holdTime: 2, action: () => { wi.done = true; const guns = ['smg', 'ar', 'rifle', 'shotgun', 'dbarrel', 'crossbow']; this.addWorldItem({ item: 'weapon', kind: 'weapon', weapon: this.rng.pick(guns), cond: this.rng.next() < 0.5 ? 3 : 4, x: wi.x, y: wi.y + 6 }); this.addParts(3, wi.x, wi.y); this.event = null; }, sub: 'Fine or Masterwork gun + 3 Parts' }; },
  buildingBurning(x, y) { for (const b of this.burning) if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) return true; return false; },

  updateNights() {
    const p = this.p;
    // storm: lightning and thunder
    if (this.weather === 'storm' && this.state === 'active') {
      this.thunderT -= DT;
      if (this.thunderT <= 0) {
        this.thunderT = this.rng.range(...T.weather.thunderEvery);
        const z = this.map.zones[this.rng.pick([...this.openZones])];
        const x = z.cx + this.rng.range(-120, 120), y = z.cy + this.rng.range(-80, 80);
        this.lightningT = 0.3;
        this.emit('lightning', { x, y });
        this.addLure(x, y, T.noise.radius.vloud * 0.6, 4, 'thunder');
      }
      if (this.stormFuseT > 0) { this.stormFuseT -= DT; if (this.stormFuseT <= 0) this.blowFuse('storm'); }
    }
    if (this.lightningT > 0) this.lightningT -= DT;
    if (this.eventRoll > 0 && this.t >= this.eventRoll && this.state === 'active') { this.eventRoll = -1; this.startEvent(); }
    const ev = this.event; if (!ev) return;
    ev.t += DT;
    switch (ev.kind) {
      case 'heli':
        if (ev.phase === 'incoming' && ev.t > 3) {
          ev.phase = 'burning'; ev.t = 0;
          this.explode(ev.x, ev.y, 400, 40, 'trap');
          this.fires.push({ x: ev.x, y: ev.y, r: 22, t: ev.burn, dps: T.fire.dps, heli: true });
          ev.lure = this.addLure(ev.x, ev.y, 9999, ev.burn, 'heli');
          for (const e of this.enemies) if (!e.dead && e.state === 'inside' && e.type !== 'dog' && e.type !== 'raider') e.lure = ev.lure;
        } else if (ev.phase === 'burning' && ev.t >= ev.burn) {
          ev.phase = 'case';
          this.addWorldItem({ item: 'case', label: 'locked case', x: ev.x + 14, y: ev.y + 6, kind: 'case', glow: true, life: 180, holdTime: 2, desc: 'case' });

        }
        break;
      case 'alarms':
        ev.next -= DT;
        if (ev.next <= 0 && ev.left > 0) {
          ev.next = 6; ev.left--;
          const c = this.cars.filter((o) => !o.used)[0];
          if (c) this.triggerCar(c);
          else { const z = this.map.zones[this.rng.pick([...this.openZones])]; const x = z.cx, y = z.cy; this.addLure(x, y, T.noise.radius.loud, 10, 'car'); this.emit('carAlarm', { x, y }); }
        }
        if (ev.left <= 0 && ev.next <= 0) this.event = null;
        break;
      case 'roof': {
        if (hyp(p.x - ev.x, p.y - ev.y) < 26 && !p.dead) { ev.hold += DT; this.spawnFocus = { px: ev.x, py: ev.y }; }
        if (ev.hold >= 20) { this.rescueDirect(ev.x, ev.y); this.event = null; this.spawnFocus = null; }
        else if (ev.t > ev.life) { this.event = null; this.emit('banner', { text: 'THE ROOF IS EMPTY NOW', sub: '', danger: true }); }
        break;
      }
      case 'truck': {
        if (this.p.carry && this.p.carry.item === 'supplies' && hyp(p.x - this.map.pub.door.x, p.y - this.map.pub.door.y) < 30) {
          this.p.carry = null; ev.left--;
          this.addParts(2); this.addScrap(300, p.x, p.y - 20, true, null, true);
          this.emit('stepDone', {});
          if (ev.left <= 0) this.event = null;
        }
        if (ev.t > ev.life) this.event = null;
        break;
      }
      case 'quiet':
        if (ev.t >= ev.life) {
          this.event = null;
          for (let i = 0; i < 10; i++) { const b = this.pickBarricade(); const e = this.spawnAtBarricade(this.rollType(), b); e.extra = false; }
          this.emit('banner', { text: 'HERE THEY COME', sub: '', danger: true });
          this.emit('quietEnd', {});
        }
        break;
    }
  },
  nightsInteractables() {},
  eventTarget() { const ev = this.event; if (!ev) return null; if (ev.kind === 'roof' || ev.kind === 'heli' || ev.kind === 'truck') return { x: ev.x, y: ev.y }; return null; },
};

export { WEATHER };
