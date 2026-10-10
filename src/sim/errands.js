// Errands (ENHANCEMENT-PRD §5, §6): one generic engine runs every errand in data/errands.js.
// Step types: fetch, carry, use, hold, clear, escort, hunt, activate, cars, watch, bounty.
import { T } from '../tuning.js';
import { ERRANDS, ERRAND } from '../data/errands.js';
import { ITEMS, RADIO, KEEPSAKES } from '../data.js';
import { cap } from './core11.js';

const DT = T.dt;
const hyp = Math.hypot;

export const ErrandMixin = {
  initErrands() {
    this.errands = [];
    this.offerRadio = null;
    this.board = []; this.boardRound = -99;
    this.triggers = [];                 // world-trigger "?" markers
    this.errandLast = {};               // id -> round last offered or finished (no repeats within 8 rounds)
    this.errandDoneIds = {};            // id -> times completed this run
    this.errandsCompleted = 0;
    this.radioSilence = false;
    this.drainNest = false; this.drainSealed = false; this.beaconsLit = false; this.sluiceOpen = false; this.searchlightFixed = false;
    this.mastRepaired = false; this.traderDeal = false; this.masterPool = false; this.traderAnnoyedUntil = -1; this.freePull = 0;
    this.fuseBlown = false; this.herdReduce = 1; this.dropCrate = null; this.crateUses = 0; this.worldTriggerRound = -1;
    this.prevInteract = false;
    this.wired = {};                    // v1.2 B21: trap id -> wired to the Red Lion switchboard
  },
  // v1.2 B21: Wire the Town has one step per trap in an open zone
  wireSteps(def) {
    const todo = this.traps.filter((t) => !this.wired[t.id] && this.openZones.has(t.zone));
    return [def.steps[0], ...todo.map((t, i) => ({ type: 'use', at: 'trap_' + t.id, seconds: T.wire.hold, carrying: 'drum', label: `Wire the ${t.name.toLowerCase()}`, text: `Wire the ${t.name.toLowerCase()} (${i + 1}/${todo.length})`, done: [{ effect: 'wire', trap: t.id }] }))];
  },

  // ---------- helpers ----------
  spot(name) {
    if (name === 'crate') { const c = this.crates[this.crateIdx]; return { px: c.px + 12, py: c.py + 8, zone: c.zone }; }
    if (name === 'deadDrop') { const c = this.crates[this.crateIdx]; return c.zone === 1 && this.openZones.has(6) ? this.map.spots.church_porch : this.map.spots.phonebox; }
    if (name === 'dogShed') return this.map.spots[this.openZones.has(9) ? 'shed' : 'school_shed'];
    if (name.startsWith('trap_')) return this.wireSpot(+name.slice(5));
    return this.map.spots[name];
  },
  // v1.4 E8: where you stand to wire a trap: a floor tile at least 2 tiles from its switch, so wiring and arming never fight over F
  wireSpot(id) {
    const t = this.traps[id]; if (!t) return null;
    this.wireSpots ||= {};
    if (!this.wireSpots[id]) {
      let best = null, bd = Infinity;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 2) continue;
        const x = t.sx + dx, y = t.sy + dy; if (this.solid(x, y) || this.map.zoneId[y * this.W + x] !== t.zone) continue;
        const d = dx * dx + (dy - 2) * (dy - 2); if (d < bd) { bd = d; best = { px: x * 16 + 8, py: y * 16 + 8, zone: t.zone }; }
      }
      this.wireSpots[id] = best || { px: t.px, py: t.py + 40, zone: t.zone };
    }
    return this.wireSpots[id];
  },
  mainErrand() { return this.errands.find((e) => !e.def.parallel) || null; },
  errandActive(id) { return this.errands.find((e) => e.id === id) || null; },
  reqOk(def) {
    const o = def.offer || {};
    if (o.minRound && this.round < o.minRound) return false;
    if (o.once && this.errandLast[def.id] !== undefined) return false;
    for (const r of o.requires || []) {
      if (r.startsWith('zone:') && !this.openZones.has(+r.slice(5))) return false;
      if (r === 'power' && !this.power) return false;
      if (r === 'everPowered' && !this.everPowered) return false;
      if (r === 'safeRoom' && this.survivors.filter((s) => !s.dead).length >= T.survivors.max) return false;
    }
    if (def.id === 'lostDog' && (this.biscuit || !(this.openZones.has(9) || this.openZones.has(7)))) return false;
    if (def.id === 'trader' && this.crates[this.crateIdx].zone === 1 && !this.openZones.has(1)) return false;
    if (def.build === 'wireSteps' && !this.traps.some((t) => !this.wired[t.id] && this.openZones.has(t.zone))) return false;
    return true;
  },
  eligible(source) {
    return ERRANDS.filter((d) => d.offer.source === source && !this.errandActive(d.id) && this.reqOk(d)
      && (this.errandLast[d.id] === undefined || this.round - this.errandLast[d.id] >= T.errands.noRepeatRounds));
  },
  pickWeighted(list) {
    if (!list.length) return null;
    return this.rng.weighted(list.map((d) => [d, this.errandDoneIds[d.id] ? 1 : 3]));
  },

  // ---------- offering (§5.2) ----------
  errandsRoundStart(r) {
    if (this.attract) return;
    // radio: every 3rd round, plus Light the Beacons the round before a herd
    if (this.offerRadio && r > this.offerRadio.round + 1) this.offerRadio = null;
    const herdNext = (r + 1) % T.specials.herdEvery === 0;
    if (herdNext) { const b = ERRAND.beacons; if (!this.errandActive('beacons') && this.reqOk(b)) this.offerViaRadio(b); }
    else if (r % T.errands.radioEvery === 0 && r > 0) {
      if (this.radioSilence) { this.radioSilence = false; this.radio(RADIO.silence); }
      else { const d = this.pickWeighted(this.eligible('radio').filter((x) => !x.offer.beforeHerd)); if (d) this.offerViaRadio(d); }
    }
    // noticeboard: two errands, refreshed every 4 rounds
    if (r - this.boardRound >= T.errands.boardRefresh) {
      this.boardRound = r;
      const pool = this.eligible('board'); this.board = [];
      while (this.board.length < T.errands.boardSlots && pool.length) { const d = this.pickWeighted(pool); pool.splice(pool.indexOf(d), 1); this.board.push(d.id); this.errandLast[d.id] = r; for (const fx of d.onOffer || []) this.errandEffect(fx); }
      if (this.board.length) this.emit('boardPosted', {});
    }
    // world triggers
    this.triggers = this.triggers.filter((t) => r <= t.until);
    if (r >= T.errands.worldFrom) {
      for (const d of this.eligible('world')) {
        if (d.id === 'trader' || this.triggers.some((t) => t.id === d.id)) continue;
        const chance = d.id === 'lostDog' ? 0.4 : 0.35;
        if (this.rng.next() < chance) {
          this.triggers.push({ id: d.id, at: d.offer.at, until: r + (d.timeRounds || 3), sound: 0 });
          this.errandLast[d.id] = r; this.worldTriggerRound = r;
          break;
        }
      }
    }
    this.checkFuelRun();
  },
  // v1.4 E1: radio jobs accept themselves (no key). They fail only if the first step isn't done within 2 waves.
  // With an errand already running, the offer waits in the journal instead.
  offerViaRadio(def) {
    this.errandLast[def.id] = this.round;
    this.radio(def.brief);
    if (!def.parallel && this.mainErrand()) { this.offerRadio = { id: def.id, t: 0, round: this.round }; this.emit('offer', { id: def.id, name: def.name, brief: def.brief }); return; }
    this.offerRadio = null;
    const er = this.acceptErrand(def.id, true);
    if (er && er.step === 0) er.idleFailEnd = this.round + T.errands.firstStepWaves - 1;
  },
  checkFuelRun() {
    const want = this.everPowered && !this.fuseBlown && (this.power ? this.fuel <= 2 : this.fuel <= 0);
    if (want && !this.errandActive('fuel')) { this.startErrand(ERRAND.fuel); this.radio(RADIO.fuel); }
  },
  blowFuse(why = 'trap') {
    if (!this.power || this.fuseBlown || this.attract) return;
    this.fuseBlown = true; this.power = false;
    this.emit('powerOut', { fuse: true });
    this.emit('banner', { text: 'THE FUSE HAS BLOWN', sub: 'Find a spare and fit it at the fire station', danger: true });
    this.radio(RADIO.fuse);
    if (!this.errandActive('fuse')) this.startErrand(ERRAND.fuse);
  },
  maybeBlowFuse() { if (this.power && this.rng.next() < T.fuse.blowChance * (this.hasRole('mechanic') ? 0.5 : 1)) this.blowFuse(); },
  traderTrigger() {
    this.crateUses++;
    if (this.crateUses === 3 && !this.errandActive('trader') && this.reqOk(ERRAND.trader)) {
      this.triggers.push({ id: 'trader', at: 'crate', until: this.round + 2, sound: 0 });
      this.emit('banner', { text: 'THE TRADER HAS A JOB FOR YOU', sub: 'Talk to her at the crate' });
    }
  },
  acceptErrand(id, auto = false) {
    const def = ERRAND[id];
    if (!def.parallel && this.mainErrand()) { this.emit('banner', { text: 'ONE ERRAND AT A TIME', sub: 'Finish or abandon yours first (T)', danger: true }); this.emit('fail'); return false; }
    if (this.offerRadio && this.offerRadio.id === id) this.offerRadio = null;
    this.board = this.board.filter((b) => b !== id);
    this.triggers = this.triggers.filter((t) => t.id !== id);
    const er = this.startErrand(def);
    this.emit('errandAccept', { id, name: def.name, auto, failEnd: er.failEnd ?? (auto && er.step === 0 ? this.round + T.errands.firstStepWaves - 1 : null) });
    return er;
  },
  startErrand(def) {
    if (def.build) def = { ...def, steps: this[def.build](def) };
    const er = { uid: this.idSeq++, id: def.id, def, step: -1, s: null, round: this.round, t0: this.t };
    if (def.timeRounds) er.failEnd = this.round + def.timeRounds; // v1.4 E2: errands fail at the end of a wave, never on a clock
    if (def.id === 'trader') er.ticking = this.rng.next() < 0.25;
    this.errands.push(er);
    this.errandLast[def.id] = this.round;
    this.nextStep(er);
    return er;
  },
  abandonErrand(id) {
    const er = this.errandActive(id); if (!er || er.def.parallel) return;
    this.cleanupErrand(er);
    this.errands = this.errands.filter((e) => e !== er);
    this.emit('banner', { text: 'ERRAND ABANDONED', sub: er.def.name });
  },
  cleanupErrand(er) {
    for (const wi of this.worldItems) if (wi.errand === er.uid) wi.done = true;
    if (this.p.carry && this.p.carry.errand === er.uid) this.p.carry = null;
    for (const e of this.enemies) if (e.tag === er.uid) e.tag = null;
    if (er.escort) this.escortLost(er.escort);
    this.spawnFocus = null; this.noAttack = false;
    if (er.id === 'supplyDrop') this.dropCrate = null;
  },

  // ---------- steps ----------
  curStep(er) { return er.def.steps[er.step]; },
  nextStep(er) {
    er.step++;
    if (er.step >= er.def.steps.length) { this.completeErrand(er); return; }
    const st = this.curStep(er); er.s = { t: 0, out: 0, retries: 0, lit: {}, cars: 0 };
    switch (st.type) {
      case 'fetch': {
        if (this.pocket[st.item]) break;
        if (!st.spots) break; // dropped by a hunt step
        const opts = st.spots.map((n) => [n, this.spot(n)]).filter(([, s]) => s && this.openZones.has(s.zone));
        const [, sp] = opts.length ? this.rng.pick(opts) : [null, this.spot(st.spots[0])];
        const item = er.ticking && st.item === 'parcel' ? 'bomb' : st.item;
        if (st.carry) this.addWorldItem({ item, x: sp.px, y: sp.py, kind: 'carry', heavy: !!st.heavy, hold: true, errand: er.uid, glow: true, ticking: item === 'bomb' ? 30 : undefined, shootable: item === 'bomb' });
        else this.addWorldItem({ item, x: sp.px, y: sp.py, kind: 'pickup', auto: true, errand: er.uid, glow: true });
        break;
      }
      case 'carry':
        if (this.pocket[st.item]) { delete this.pocket[st.item]; if (!this.isCarrying()) { this.p.carry = { item: st.item, hits: 0, errand: er.uid }; this.selectMeleeForCarry(); } else this.addWorldItem({ item: st.item, x: this.p.x, y: this.p.y, kind: 'carry', hold: true, errand: er.uid, glow: true }); }
        break;
      case 'clear': {
        const sp = this.spot(st.at);
        er.s.left = this.spawnAround(sp, st.n, er.uid);
        break;
      }
      case 'hunt': er.s.need = true; this.spawnMarked(st.mark, er.uid, st.drop); break;
      case 'bounty': {
        const kind = this.round >= T.butcher.from ? 'butcher' : this.round >= T.screamer.from ? (this.rng.next() < 0.5 ? 'screamers' : 'brute') : 'brute';
        er.s.kind = kind; er.s.kills = 0; er.s.killRound = this.round;
        if (kind !== 'screamers') this.pending.push({ t: 4, type: kind, counted: false, contract: er.uid, bar: this.pickBarricade() });
        this.emit('banner', { text: 'BOUNTY CONTRACT', sub: kind === 'screamers' ? 'Kill 3 Screamers in one wave' : kind === 'butcher' ? 'The Butcher. Big money for his apron.' : 'A Brute called Big Terry', danger: true });
        break;
      }
    }
    if (st.type !== 'hold') { this.spawnFocus = null; this.noAttack = false; }
    this.emit('errandStep', { id: er.id, step: er.step });
  },
  stepDone(er) {
    const st = this.curStep(er);
    for (const fx of st.done || []) this.errandEffect(fx, er);
    this.emit('stepDone', { id: er.id });
    this.nextStep(er);
  },
  completeErrand(er) {
    this.errands = this.errands.filter((e) => e !== er);
    if (this.p.carry && this.p.carry.errand === er.uid) this.p.carry = null; // the cable drum is used up
    this.spawnFocus = null; this.noAttack = false;
    for (const r of er.def.rewards) this.errandReward(r, er);
    if (er.def.rewards.length) this.addParts(T.parts.errand);
    this.errandLast[er.id] = this.round; this.errandDoneIds[er.id] = (this.errandDoneIds[er.id] || 0) + 1;
    if (!er.def.parallel) this.errandsCompleted++;
    if (er.def.rewards.length) this.emit('errandDone', { id: er.id, name: er.def.name });
    if (er.id === 'fuse') this.checkFuelRun();
  },
  failErrand(er, why) {
    if (!this.errands.includes(er)) return;
    this.cleanupErrand(er);
    this.errands = this.errands.filter((e) => e !== er);
    const f = er.def.failure || {};
    if (f.radio) this.radio(f.radio);
    if (f.silence) this.radioSilence = true;
    if (f.bark) this.bark(null, true, f.bark);
    if (f.sickDies) { const s = this.survivors.find((x) => x.sick > 0 && !x.dead); if (s) this.survivorDies(s, 'sick'); }
    if (f.effect) this.errandEffect({ effect: f.effect });
    if (er.id === 'lostDog') this.dogGone = true;
    this.emit('errandFail', { id: er.id, name: er.def.name, why });
  },
  // v1.4 E2: checked as each wave ends
  errandsRoundEnd() {
    for (const er of this.errands.slice()) {
      if (er.failEnd !== undefined && this.round >= er.failEnd) this.failErrand(er, 'time');
      else if (er.idleFailEnd !== undefined && er.step === 0 && this.round >= er.idleFailEnd) this.failErrand(er, 'idle');
    }
  },
  errandItemLost(item) {
    for (const er of this.errands.slice()) {
      const st = this.curStep(er); if (!st) continue;
      if (st.item === item || (item === 'bomb' && st.item === 'parcel')) {
        if (er.id === 'trader' || item === 'bomb') this.failErrand(er, 'lost');
        else { er.step--; this.nextStep(er); }
      }
    }
  },

  errandEffect(fx, er) {
    switch (fx.effect) {
      case 'mast': this.mastRepaired = true; break;
      case 'wire': this.wired[fx.trap] = true; this.emit('banner', { text: 'WIRED TO THE RED LION', sub: 'Work it from the switchboard behind the bar' }); break;
      case 'radio': this.radio(fx.text); break;
      case 'light': { const s = this.spot(fx.at); this.lights.push({ x: s.px, y: s.py, r: fx.r, t: fx.t }); this.fires.push({ x: s.px, y: s.py, r: 6, t: 4, dps: 0, flare: true }); break; }
      case 'drop': { const s = this.spot(fx.at); this.dropCrate = { x: s.px, y: s.py, t: 0 }; this.emit('supplyDrop', { x: s.px, y: s.py }); break; }
      case 'survivor': if (er) er.escort = this.spawnEscort(this.spot(fx.at), er.uid); break;
      case 'nest': if (!this.drainSealed) { this.drainNest = true; this.emit('banner', { text: 'THE DRAIN IS A NEST', sub: 'More of them crawl out of the square\'s storm drain', danger: true }); } break;
      case 'traderDeal': this.traderDeal = true; this.masterPool = true; this.emit('banner', { text: 'THE TRADER IS PLEASED', sub: 'Crate 25% cheaper; next pull is Fine or better' }); break;
      case 'traderAnnoyed': this.traderAnnoyedUntil = this.round + 3; this.emit('banner', { text: 'THE TRADER IS ANNOYED', sub: 'Crate +100 for 3 waves', danger: true }); break;
    }
  },
  errandReward(r, er) {
    const p = this.p;
    if (r.scrap) this.addScrap(r.scrap, p.x, p.y - 20, true, null, true);
    if (r.parts) this.addParts(r.parts);
    if (r.finds) { const s = this.spot(r.at); for (let i = 0; i < r.finds; i++) this.spawnFind(s.px + (i ? 14 : -14), s.py + 4, null, true, true); }
    if (r.cratePull) { this.freePull = this.round + 2; this.emit('banner', { text: 'A FREE CRATE PULL', sub: 'Claim it at the trader within 2 waves' }); }
    if (r.closeSpawn) { this.drainSealed = true; this.drainNest = false; }
    if (r.padding) { if (!p.padLayers) p.padLayers = 1; for (let i = 0; i < p.padLayers; i++) p.pad[i] = T.padding.pointsPerLayer; this.emit('padRepair', {}); }
    if (r.power) { this.fuseBlown = false; if (this.fuel > 0) { this.power = true; this.emit('power', {}); this.emit('banner', { text: 'POWER\'S BACK', sub: '+300 Scrap' }); } }
    if (r.keepsake) this.giveKeepsake(this.rng.pick(Object.keys(KEEPSAKES)));
    if (r.biscuit) this.adoptBiscuit(this.spot('dogShed'));
    if (r.bandage) { this.bandagesStock = Math.min(this.bandageCap(), this.bandagesStock + 1); if (this.hasComfort('bandages')) p.bandages = Math.min(this.bandageCap(), p.bandages + 1); }
    if (r.cure) { const s = this.survivors.find((x) => x.sick > 0 && !x.dead); if (s) { s.sick = 0; this.radio('Fever\'s broken. Thank you.', s.name); } }
    if (r.effect === 'beacons') { this.beaconsLit = true; this.herdReduce = 0.75; this.emit('banner', { text: 'THE BEACONS ARE LIT', sub: 'The herd will be a quarter smaller' }); }
    if (r.effect === 'sluice') { this.sluiceOpen = true; this.emit('banner', { text: 'THE UNDERPASS FLOODS', sub: 'The dead wade at 60% speed by the allotments' }); }
    if (r.effect === 'searchlight') { this.searchlightFixed = true; this.emit('banner', { text: 'THE SEARCHLIGHT RUNS ON BATTERIES', sub: 'No power needed. It marks specials on the field' }); }
    if (r.effect) this.errandEffect({ effect: r.effect });
  },

  // ---------- per tick ----------
  updateErrands(inp) {
    const p = this.p;
    this.prevInteract = inp.interact;
    for (const t of this.triggers) { t.sound -= DT; if (t.sound <= 0) { t.sound = 4; const s = this.spot(t.at); this.emit(t.id === 'lostDog' ? 'barking' : t.id === 'cellar' ? 'knocking' : 'triggerPing', { x: s.px, y: s.py }); } }
    if (this.dropCrate) this.dropCrate.t += DT;
    this.noAttack = false;
    for (const er of this.errands.slice()) {
      const st = this.curStep(er); if (!st) continue;
      switch (st.type) {
        case 'fetch': if (this.pocket[st.item] || (st.carry && this.carriedItem() === (er.ticking && st.item === 'parcel' ? 'bomb' : st.item))) this.stepDone(er); break;
        case 'watch': if (this.watchKey(st.key)) this.stepDone(er); break;
        case 'clear': if (!this.enemies.some((e) => !e.dead && e.tag === er.uid)) this.stepDone(er); break;
        case 'hunt':
          if (!this.enemies.some((e) => !e.dead && e.tag === er.uid)) {
            if (this.worldItems.some((w) => w.errand === er.uid && w.item === st.drop) || this.pocket[st.drop]) this.stepDone(er);
            else { er.step--; this.nextStep(er); } // it got away: another one turns up
          }
          break;
        case 'escort': {
          const n = er.escort; if (!n) break;
          if (n.dead) { this.failErrand(er, 'escort'); break; }
          const sp = this.spot(st.to);
          if (hyp(n.x - sp.px, n.y - sp.py) < 30) { this.admitSurvivor(n); er.escort = null; this.stepDone(er); }
          break;
        }
        case 'hold': {
          const sp = this.spot(st.at), inside = !p.dead && hyp(p.x - sp.px, p.y - sp.py) < (st.radius || T.holdArea.radius);
          this.spawnFocus = sp;
          if (inside) { const s0 = er.s.t; er.s.t += DT; er.s.out = 0; if (st.noAttack) this.noAttack = true; if (st.noFail && Math.floor(er.s.t) > Math.floor(s0)) this.emit('tock', { x: sp.px, y: sp.py, k: er.s.t / st.seconds }); }
          else if (st.noFail) { /* v1.2 B4: no deadline. Leaving the ring only pauses the nailing */ }
          else if (!p.downed) {
            er.s.out += DT;
            if (er.s.out > T.holdArea.leaveGrace) {
              if (er.s.retries < (st.retries || 0)) { er.s.retries++; er.s.t = 0; er.s.out = 0; this.radio('Plane\'s going round again. Get back on the field.'); }
              else { this.failErrand(er, 'left'); break; }
            }
          }
          if (er.s.t >= st.seconds) this.stepDone(er);
          break;
        }
        case 'activate': if (st.spots.every((n) => er.s.lit[n])) this.stepDone(er); break;
        case 'cars': if (er.s.cars >= st.n) this.stepDone(er); break;
        case 'bounty': if (er.s.done) this.stepDone(er); break;
      }
    }
  },
  // v1.2 B4: the ring drawn round a no-fail hold area (Seal the Drain)
  holdRings() {
    const out = [];
    for (const er of this.errands) {
      const st = this.curStep(er); if (!st || st.type !== 'hold' || !st.noFail) continue;
      const sp = this.spot(st.at), r = st.radius || T.holdArea.radius;
      out.push({ x: sp.px, y: sp.py, r, k: Math.min(1, er.s.t / st.seconds), inside: !this.p.dead && hyp(this.p.x - sp.px, this.p.y - sp.py) < r });
    }
    return out;
  },
  watchKey(k) {
    if (k === 'haveJerry') return this.p.jerry;
    if (k === 'fuelFull') return this.power && this.fuel >= this.fuelRounds();
    return false;
  },
  // hooks from kill()
  errandKill(e, src) {
    for (const er of this.errands) {
      const st = this.curStep(er); if (!st) continue;
      if (st.type === 'bounty') {
        if (er.s.kind === 'screamers' && e.type === 'screamer') { if (er.s.killRound !== this.round) { er.s.killRound = this.round; er.s.kills = 0; } if (++er.s.kills >= 3) er.s.done = true; }
        else if (e.contract === er.uid) er.s.done = true;
      }
    }
    if (e.dropItem) this.addWorldItem({ item: e.dropItem, x: e.x, y: e.y, kind: 'pickup', auto: true, errand: e.tag, glow: true });
  },

  // ---------- spawning for errands ----------
  spawnAround(sp, n, tag) {
    let made = 0;
    for (let k = 0; k < 60 && made < n && this.enemies.length < 90; k++) {
      const a = this.rng.next() * Math.PI * 2, d = this.rng.range(14, 44);
      const x = sp.px + Math.cos(a) * d, y = sp.py + Math.sin(a) * d;
      if (this.solid(Math.floor(x / 16), Math.floor(y / 16))) continue;
      const e = this.makeEnemy('walker'); e.x = e.ox = x; e.y = e.oy = y; e.state = 'inside'; e.extra = true; e.tag = tag; e.noticed = true;
      this.enemies.push(e); made++;
      this.emit('climbIn', { x, y });
    }
    return made;
  },
  spawnMarked(mark, tag, drop) {
    const b = this.pickBarricade();
    const e = this.spawnAtBarricade(mark === 'chief' ? 'armoured' : 'walker', b);
    e.mark = mark; e.tag = tag; e.dropItem = drop; e.extra = true;
    if (mark === 'whitecoat') { e.outfit = 9; e.hp *= 1.5; e.maxHp = e.hp; }
    return e;
  },

  // ---------- interactables ----------
  errandInteractables(out) {
    const p = this.p;
    // noticeboard (§5.2, §15): board errands, trial, bounty
    const nb = this.map.spots.noticeboard;
    out.push({ id: 'board', x: nb.px, y: nb.py - 10, menu: true, describe: () => this.boardOptions() });
    for (const t of this.triggers) {
      const s = this.spot(t.at), def = ERRAND[t.id];
      out.push({ id: 'trig:' + t.id, x: s.px, y: s.py, describe: () => (this.mainErrand() ? { label: `${def.name}: finish your errand first`, cost: 0, disabled: true } : { label: `Investigate: ${def.name}`, cost: 0, holdTime: 0.4, action: () => this.acceptErrand(t.id), sub: def.brief }) });
    }
    for (const er of this.errands) {
      const st = this.curStep(er); if (!st) continue;
      if (st.type === 'use') {
        const s = this.spot(st.at);
        out.push({ id: `use:${er.uid}:${er.step}`, x: s.px, y: s.py, range: 26, cancelOnHit: true, describe: () => {
          if (st.needs && !this.pocket[st.needs]) return { label: `${st.label}: needs the ${ITEMS[st.needs]}`, cost: 0, disabled: true };
          if (st.carrying && this.carriedItem() !== st.carrying) return { label: `${st.label}: bring the ${ITEMS[st.carrying]}`, cost: 0, disabled: true };
          return { label: st.label, cost: 0, holdTime: st.seconds, action: () => { if (st.needs) delete this.pocket[st.needs]; this.stepDone(er); }, sub: er.def.name };
        } });
      } else if (st.type === 'carry') {
        const s = this.spot(st.to);
        if (this.carriedItem() === st.item || this.carriedItem() === 'bomb') out.push({ id: `deliver:${er.uid}`, x: s.px, y: s.py, range: 30, describe: () => ({ label: `Deliver the ${ITEMS[this.carriedItem()]}`, cost: 0, holdTime: 0.4, action: () => { this.p.carry = null; this.stepDone(er); }, sub: er.def.name }) });
      } else if (st.type === 'activate') {
        for (const n of st.spots) {
          if (er.s.lit[n]) continue; const s = this.spot(n);
          out.push({ id: `act:${n}`, x: s.px, y: s.py, range: 26, cancelOnHit: true, describe: () => ({ label: st.label, cost: 0, holdTime: st.seconds, action: () => { er.s.lit[n] = true; this.emit('beaconLit', { x: s.px, y: s.py, id: n }); this.lights.push({ x: s.px, y: s.py - 30, r: 64, t: 9999 }); }, sub: `${Object.keys(er.s.lit).length}/${st.spots.length} lit` }) });
        }
      } else if (st.type === 'cars') {
        for (const c of this.cars) {
          if (c.battery) continue;
          out.push({ id: `car:${c.id}`, x: c.x, y: c.y, range: 24, cancelOnHit: true, describe: () => ({ label: 'Pull the battery', cost: 0, holdTime: st.seconds, action: () => { c.battery = true; er.s.cars++; this.triggerCar(c); this.emit('pickupItem', { item: 'battery', x: c.x, y: c.y }); }, sub: `${er.s.cars}/${st.n}: sets the alarm off` }) });
        }
      }
    }
  },
  boardOptions() {
    const opts = [];
    for (const id of this.board) {
      const d = ERRAND[id];
      opts.push(this.mainErrand() ? { label: `${d.name}: you have an errand`, cost: 0, disabled: true, sub: d.brief } : { label: `Take the job: ${d.name}`, cost: 0, holdTime: 0.6, action: () => this.acceptErrand(id), sub: d.brief });
    }
    if (this.trial) opts.push({ label: `Trial: ${this.trialText()}`, cost: 0, disabled: true, sub: `${Math.floor(this.trial.n)}/${this.trial.target} (x2 for a better prize)` });
    if (!opts.length) opts.push({ label: 'Noticeboard: nothing new', cost: 0, disabled: true, sub: 'New jobs every 4 waves' });
    return opts;
  },

  // ---------- tracking (§5.7) ----------
  stepText(er) {
    const st = this.curStep(er); if (!st) return '';
    const p = this.p;
    if ((st.type === 'carry' || (st.type === 'fetch' && st.carry)) && !this.isCarrying() && this.worldItems.some((w) => w.errand === er.uid && w.kind === 'carry' && w.t > 0.5 && st.type === 'carry')) return `Pick up the ${ITEMS[st.item]} again`;
    if (er.id === 'fuel' && st.key === 'haveJerry' && this.worldItems.some((w) => w.item === 'jerry')) return 'Pick up your jerry can';
    if (st.type === 'hold') return st.noFail ? `${st.text}: ${Math.floor(100 * Math.min(1, er.s.t / st.seconds))}%` : `${st.text}: ${Math.ceil(Math.max(0, st.seconds - er.s.t))}s`;
    if (st.type === 'clear') return `${st.text} (${this.enemies.filter((e) => !e.dead && e.tag === er.uid).length} left)`;
    if (st.type === 'cars') return `${st.text} (${er.s.cars}/${st.n})`;
    if (st.type === 'activate') return `${st.text} (${Object.keys(er.s.lit).length}/${st.spots.length})`;
    if (st.type === 'bounty') return er.s.kind === 'screamers' ? `Kill 3 Screamers in one wave (${er.s.killRound === this.round ? er.s.kills : 0}/3)` : er.s.kind === 'butcher' ? 'Kill the Butcher' : 'Kill Big Terry, the Brute';
    return st.text;
  },
  errandTracker() {
    const rows = [];
    for (const er of this.errands) {
      let timer = null;
      const end = er.failEnd ?? (er.step === 0 ? er.idleFailEnd : undefined);
      if (end !== undefined) timer = `Fails end of wave ${end}`;
      if (this.p.carry && this.p.carry.ticking !== undefined && this.p.carry.errand === er.uid) timer = this.p.carry.ticking;
      const o = er === (this.mainErrand() || this.errands[0]) ? this.errandObjective() : null, st = o && this.streetAt(o.x, o.y); // v1.4 E3
      rows.push({ name: er.def.name, text: this.stepText(er) + (st ? `, on ${st.title}` : ''), timer, parallel: !!er.def.parallel, street: st ? st.name : null });
    }
    return rows;
  },
  errandObjective() {
    const p = this.p;
    const er = this.mainErrand() || this.errands[0]; if (!er) return null;
    const st = this.curStep(er); if (!st) return null;
    const item = this.worldItems.find((w) => w.errand === er.uid && !w.done);
    if (item && (st.type === 'fetch' || st.type === 'carry' || st.type === 'hunt')) return { x: item.x, y: item.y };
    if (er.id === 'fuel') { if (!p.jerry) { const j = this.worldItems.find((w) => w.item === 'jerry'); return j ? { x: j.x, y: j.y } : { x: this.map.jerry.px, y: this.map.jerry.py }; } return { x: this.map.generator.px, y: this.map.generator.py }; }
    switch (st.type) {
      case 'use': case 'hold': { const s = this.spot(st.at); return { x: s.px, y: s.py }; }
      case 'carry': { const s = this.spot(st.to); return { x: s.px, y: s.py }; }
      case 'clear': case 'hunt': { const e = this.enemies.find((o) => !o.dead && o.tag === er.uid); return e ? { x: e.x, y: e.y } : null; }
      case 'escort': { if (st.to === 'pub_in' && !this.pubDoorFixed) { const d = this.map.pub.door; return { x: d.x, y: d.y }; } const s = this.spot(st.to); return er.escort && hyp(er.escort.x - p.x, er.escort.y - p.y) > 60 ? { x: er.escort.x, y: er.escort.y } : { x: s.px, y: s.py }; }
      case 'activate': { const n = st.spots.find((k) => !er.s.lit[k]); if (n) { const s = this.spot(n); return { x: s.px, y: s.py }; } return null; }
      case 'cars': { const c = this.cars.filter((o) => !o.battery).sort((a, b) => hyp(a.x - p.x, a.y - p.y) - hyp(b.x - p.x, b.y - p.y))[0]; return c ? { x: c.x, y: c.y } : null; }
      case 'bounty': { const e = this.enemies.find((o) => !o.dead && o.contract === er.uid); return e ? { x: e.x, y: e.y } : null; }
    }
    return null;
  },
  // the whole picture, for the errand log (T)
  errandLog() {
    return {
      active: this.errands.map((er) => { const end = er.failEnd ?? (er.step === 0 ? er.idleFailEnd : undefined); return { id: er.id, name: er.def.name, step: this.stepText(er) + (end !== undefined ? ` (fails end of wave ${end})` : ''), parallel: !!er.def.parallel, steps: er.def.steps.length, at: er.step }; }),
      radio: this.offerRadio && !this.errandActive(this.offerRadio.id) ? [{ id: this.offerRadio.id, name: ERRAND[this.offerRadio.id].name, brief: ERRAND[this.offerRadio.id].brief }] : [],
      board: this.board.map((id) => ({ id, name: ERRAND[id].name, brief: ERRAND[id].brief })),
      triggers: this.triggers.map((t) => ({ id: t.id, name: ERRAND[t.id].name, brief: ERRAND[t.id].brief })),
      fuel: this.everPowered ? (this.fuseBlown ? 'Fuse blown' : `${this.fuel} wave${this.fuel === 1 ? '' : 's'} of diesel`) : 'Generator not started',
    };
  },
};

export { cap };
