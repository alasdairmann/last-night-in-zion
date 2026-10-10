// Secrets (ENHANCEMENT-PRD §8 The Signal, §19 the blowtorch, §20 tapes and the secret song).
import { T } from '../tuning.js';
import { RADIO, TAPES, COMFORTS } from '../data.js';

const DT = T.dt;
const hyp = Math.hypot;
const CARD_SPOTS = ['church_board', 'staffroom', 'dartboard'];
export const SIGNAL_HINTS = [
  'Listen to the radio from wave 5.',
  'Someone in a hunting jacket is carrying a receiver.',
  'It needs mains power. Somewhere with a bench and the generator on.',
  'Three frequency cards are pinned up around town: church, school, pub.',
  'It needs height. The church tower.',
  'Count the bells at the start of the next wave, then answer from the tower.',
  'Boost the signal: build a booster at the garage bench, switch it on at the school roof, then kill every raider who comes for it.',
  'Done.',
];

export const QuestMixin = {
  initQuest() {
    this.signal = { step: 0, receiverOut: false, cards: CARD_SPOTS.map(() => this.rng.int(10, 99)), found: [false, false, false], order: null, entered: [], sel: 0, built: false, holdT: 0, holding: false, waveT: 0, done: false, msgs: [] };
    this.torch = { key: false, burner: false, propane: false, pump: false, built: false };
    this.tapes = []; this.bears = { found: {}, n: 0 }; this.songRound = -1;
    if (!this.attract) {
      TAPES.forEach((tp, i) => { const s = this.map.spots['tape' + i]; this.addWorldItem({ item: 'tape', tape: i, x: s.px, y: s.py, kind: 'tape', auto: true, glint: true, on: 'tape' }); });
      for (const n of ['memorial', 'church_roof', 'lost_property']) { const s = this.map.spots[n]; this.addWorldItem({ item: 'bear', bear: n, x: s.px, y: s.py, kind: 'bear', glint: true, desc: 'bear' }); }
    }
    this.events.length = 0;
  },
  take_tape(wi) { this.findTape(wi.tape); },
  desc_bear(wi) { return { label: 'A teddy bear', cost: 0, holdTime: 1, action: () => { wi.done = true; this.squeezeBear(wi.bear); }, sub: 'Give it a squeeze' }; },
  take_receiver() { this.pocket.receiver = 1; this.signal.step = Math.max(this.signal.step, 2); this.emit('banner', { prio: 'objective', key: 'signal.receiver', text: 'A HAM RADIO RECEIVER', sub: 'Dead. It needs mains power' }); },
  take_card(wi) { const i = wi.card; this.signal.found[i] = true; this.emit('banner', { prio: 'objective', key: 'signal.card' + i, text: `FREQUENCY CARD ${['I', 'II', 'III'][i]}`, sub: 'It reads', code: String(this.signal.cards[i]) }); },
  findTape(i) {
    this.tapes.push(i);
    this.emit('tape', { i, title: TAPES[i].title, text: TAPES[i].text });
  },
  squeezeBear(n) {
    this.bears.found[n] = true; this.bears.n++;
    this.emit('squeak', {});
    if (this.bears.n < 3) this.emit('banner', { text: `A TEDDY BEAR (${this.bears.n}/3)`, sub: 'Squeeze all three and the jukebox plays: double Scrap for a wave', help: true });
    if (this.bears.n >= 3) {
      this.songRound = this.state === 'active' ? this.round : this.round + 1;
      this.emit('banner', { text: 'THE JUKEBOX STARTS PLAYING', sub: 'Every kill this wave pays double', help: true });
      this.emit('song', {});
    }
  },
  songActive() { return this.songRound === this.round && this.state === 'active'; },

  // ---------- The Signal ----------
  questRoundStart(r) {
    const S = this.signal;
    if (S.step === 0 && r >= T.signal.from && this.rng.next() < 1 / 3) { S.step = 1; this.radio(RADIO.signal[0], 'Signal'); this.emit('signalHeard', {}); }
    else if (S.step >= 1 && S.step < 7 && this.rng.next() < 0.3) this.radio(this.rng.pick(RADIO.signal), 'Signal');
    if (S.step === 1 && !S.receiverOut && r >= T.signal.receiverBy) this.spawnReceiver();
    if (S.step === 5 && !S.order) {
      S.order = this.rng.shuffle([0, 1, 2]); S.entered = [];
      this.emit('bellCode', { order: S.order });
      const words = S.order.map((k) => Array(k + 1).fill('DONG').join(' ')).join('  ...  ');
      this.timers.push({ t: 3, kind: 'bellBanner', text: words, code: S.order.map((k) => S.cards[k]).join(' ') });
    }
  },
  maybeReceiverWalker(e) {
    const S = this.signal;
    if (S.step === 1 && !S.receiverOut && e.type === 'walker' && this.round >= T.signal.from && this.rng.next() < T.signal.receiverChance) this.makeReceiverWalker(e);
  },
  spawnReceiver() { const e = this.spawnAtBarricade('walker', this.pickBarricade()); this.makeReceiverWalker(e); },
  makeReceiverWalker(e) { e.mark = 'receiver'; e.outfit = 3; e.dropItem = 'receiver'; e.glow = true; e.extra = true; this.signal.receiverOut = true; },
  questKill(e) {
    if (e.mark === 'receiver') {
      this.signal.receiverOut = false;
      this.addWorldItem({ item: 'receiver', x: e.x, y: e.y, kind: 'pickup', auto: true, glow: true, on: 'receiver' });
      e.dropItem = null;
    }
  },
  updateQuest() {
    const S = this.signal, p = this.p;
    if (S.step === 1 && S.receiverOut && !this.enemies.some((e) => !e.dead && e.mark === 'receiver') && !this.worldItems.some((w) => w.item === 'receiver')) S.receiverOut = false;
    if (S.step === 3 && S.found.every(Boolean)) { S.step = 4; this.emit('banner', { prio: 'objective', key: 'signal.cards', text: 'THREE FREQUENCIES', sub: 'It needs height: the church tower', code: S.cards.join(' ') }); }
    if (S.holding) this.updateBooster();
  },
  // ---------- v1.4 E5: Defend the booster. 18 raiders in 4 groups come for the mast; kill them all ----------
  startBooster() {
    const S = this.signal, B = T.booster;
    S.holding = true; S.def = { hp: B.hp, group: 0, killed: 0, total: B.groups.reduce((a, b) => a + b, 0), queue: 0, nextT: B.firstDelay, warnT: 0, groupLeft: 0 };
    this.spawnFocus = this.map.spots.school_mast;
    this.emit('banner', { text: 'DEFEND THE BOOSTER', sub: `Kill ${S.def.total} raiders. They're coming for the school roof`, danger: true, prio: 'objective', key: 'signal.defend' });
    this.radio('Someone else heard that. Engines on the hill road. Keep them off the booster.', 'Hilltop');
  },
  boosterStatus() {
    const S = this.signal; if (!S.holding || !S.def) return null;
    const d = S.def; return { hp: Math.max(0, d.hp) / T.booster.hp, killed: d.killed, total: d.total, group: d.group, groups: T.booster.groups.length };
  },
  signalRaiders() { return this.enemies.filter((e) => !e.dead && !e.gone && e.type === 'raider' && e.squad === 'signal'); },
  updateBooster() {
    const S = this.signal, d = S.def, B = T.booster, sp = this.map.spots.school_mast;
    this.spawnFocus = sp;
    const alive = this.signalRaiders().length;
    // the next group: 10 s after the last one is dead, or 45 s after it landed, whichever first
    if (d.group < B.groups.length) {
      d.nextT -= DT;
      if (alive === 0 && d.queue === 0 && d.nextT > B.afterDead && d.group > 0) d.nextT = B.afterDead;
      if (d.nextT <= 0) { d.queue += B.groups[d.group]; d.group++; d.nextT = B.afterTime; this.emit('raidWarn', {}); this.card({ key: 'signal.group', prio: 'objective', text: `RAIDERS: GROUP ${d.group}/${B.groups.length}`, sub: `${B.groups[d.group - 1]} more for the booster`, pin: { x: sp.px, y: sp.py } }); }
    }
    // never more than 8 alive at once: the rest wait their turn
    if (d.queue > 0 && alive < B.maxAlive) {
      const n = Math.min(d.queue, B.maxAlive - alive);
      const drops = Object.keys(this.map.spots).filter((k) => k.startsWith('raid_') && this.openZones.has(+k.slice(5))).map((k) => this.map.spots[k]).sort((a, b) => hyp(a.px - sp.px, a.py - sp.py) - hyp(b.px - sp.px, b.py - sp.py));
      this.raidDrops = drops.slice(0, 2).length ? drops.slice(0, 2) : [this.map.spots.raid_7];
      this.spawnRaiders(n, false, 'signal'); d.queue -= n;
    }
    if (d.warnT > 0) d.warnT -= DT;
    if (d.hp <= 0) this.boosterLost();
    else if (d.killed >= d.total) { this.emit('banner', { text: 'ASHWORTH HEARS YOU', sub: 'The booster held', prio: 'objective', key: 'signal.won' }); this.resolveCard('signal.sabotage'); this.signalComplete(); }
  },
  // a signal raider at the mast takes the booster apart: 5 HP a second each
  sabotageBooster(e) {
    const d = this.signal.def; if (!d) return;
    d.hp -= T.booster.dps * DT;
    if (d.warnT <= 0) { d.warnT = T.booster.warnEvery; const sp = this.map.spots.school_mast; this.card({ key: 'signal.sabotage', prio: 'critical', text: 'RAIDERS AT THE BOOSTER!', sub: `Booster ${Math.max(0, Math.ceil(d.hp))}%`, pin: { x: sp.px, y: sp.py } }); }
  },
  signalRaiderKilled() { const S = this.signal; if (S.holding && S.def) S.def.killed++; },
  boosterLost() {
    const S = this.signal;
    S.holding = false; S.built = false; S.def = null; this.spawnFocus = null;
    for (const e of this.signalRaiders()) { e.fleeing = true; e.fleeT = 0; }
    this.resolveCard('signal.sabotage');
    this.emit('banner', { text: 'THE BOOSTER IS WRECKED', sub: `Build another at the garage bench (${T.signal.boostParts} Parts)`, danger: true, prio: 'critical', key: 'signal.lost' });
    this.radio('We lost you. Whatever you had up there, it\'s gone.', 'Signal');
  },
  signalComplete() {
    const S = this.signal, p = this.p;
    S.holding = false; S.def = null; S.step = 7; S.done = true; this.spawnFocus = null;
    for (const id of p.comforts) p.comfortRounds[id] = Math.max(p.comfortRounds[id] || 0, T.comforts.ripenRounds);
    const lines = ['This is Cain. In Zion. Do you read?', 'Zion? ...Zion! We hear you. This is Ashworth. We have power, and a hospital, and room.', 'Hold on, Cain. We\'re coming over the hills when the snow clears.'];
    lines.forEach((l, i) => this.timers.push({ t: 1 + i * 6, kind: 'radioLine', text: l, who: i === 0 ? 'Cain' : 'Signal' }));
    this.emit('banner', { prio: 'objective', key: 'signal.done', text: 'THE SIGNAL IS ANSWERED', sub: 'Comforts ripen; no comfort limit; the last stand is shorter' });
    this.emit('signalComplete', {});
  },
  questInteractables(out) {
    const S = this.signal, sp = this.map.spots;
    if (S.step === 2) out.push({ id: 'sig:power', x: sp.workshop.px, y: sp.workshop.py, range: 26, cancelOnHit: true, describe: () => this.power ? { label: 'Wire the receiver into the mains', cost: 0, holdTime: 3, action: () => { S.step = 3; CARD_SPOTS.forEach((n, i) => { const s = sp[n]; this.addWorldItem({ item: 'card', x: s.px, y: s.py, kind: 'pickup', auto: true, glow: true, card: i, on: 'card' }); }); this.radio('...kssh... please, if anyone... towns... Zion...', 'Signal'); }, sub: 'The receiver crackles' } : { label: 'Receiver: needs power', cost: 0, disabled: true } });
    if (S.step === 4) { const s = sp.church_ladder; out.push({ id: 'sig:tower', x: s.px, y: s.py, range: 26, cancelOnHit: true, describe: () => ({ label: 'Climb the tower with the receiver', cost: 0, holdTime: T.signal.towerHold, action: () => { S.step = 5; this.emit('banner', { prio: 'objective', key: 'signal.tower', text: 'SHE CAN HEAR YOU', sub: '"Give me the code. Listen for the bell."' }); this.radio('...give me the code... in the order of the bell...', 'Signal'); }, sub: 'It needs height' }) }); }
    if (S.step === 5 && S.order) {
      const s = sp.church_ladder;
      out.push({ id: 'sig:code', x: s.px, y: s.py, range: 26, menu: true, describe: () => [0, 1, 2].map((i) => ({ label: `Send card ${['I', 'II', 'III'][i]}: ${S.cards[i]}`, cost: 0, holdTime: 0.3, action: () => this.enterCode(i), sub: `Entered: ${S.entered.map((k) => S.cards[k]).join(' ') || '-'}` })) });
    }
    if (S.step === 6 && S.built && !S.holding) { const s = sp.school_mast; out.push({ id: 'sig:boost', x: s.px, y: s.py, range: 26, describe: () => ({ label: 'Switch on the booster', cost: 0, holdTime: 1, action: () => this.startBooster(), sub: `Raiders will come for it: kill all ${T.booster.groups.reduce((a, b) => a + b, 0)}` }) }); }
    // blowtorch parts (§19.2)
    const tq = this.torch;
    if (!tq.key && this.openZones.has(9)) out.push({ id: 'torch:scarecrow', x: sp.scarecrow.px, y: sp.scarecrow.py, describe: () => ({ label: 'Search the scarecrow', cost: 0, holdTime: 1, action: () => { tq.key = true; this.emit('banner', { text: 'A SMALL KEY', sub: 'Stitched into its coat' }); }, sub: '' }) });
    if (tq.key && !tq.burner) out.push({ id: 'torch:shed', x: sp.shed.px, y: sp.shed.py, describe: () => ({ label: 'Unlock the allotment shed', cost: 0, holdTime: 1, action: () => { tq.burner = true; this.emit('banner', { text: 'A WEED BURNER', sub: 'Needs gas and a pump' }); }, sub: '' }) });
    if (!tq.propane && this.openZones.has(5)) out.push({ id: 'torch:bbq', x: sp.bbq.px, y: sp.bbq.py, describe: () => ({ label: 'Take the barbecue\'s propane tank', cost: 0, holdTime: 1, action: () => { tq.propane = true; this.emit('banner', { text: 'A PROPANE TANK', sub: '' }); }, sub: '' }) });
    if (!tq.pump && this.openZones.has(3)) out.push({ id: 'torch:pump', x: sp.engine.px - 20, y: sp.engine.py, cancelOnHit: true, describe: () => ({ label: 'Take the engine\'s spare pump', cost: 0, holdTime: 3, action: () => { tq.pump = true; this.emit('banner', { text: 'A FIRE PUMP', sub: '' }); }, sub: '' }) });
    // fill the blowtorch with diesel (500 a can)
    const bt = this.p.slots.find((w) => w && w.id === 'blowtorch');
    if (bt && bt.mag < T.blowtorch.fuel - 0.5 && this.everPowered) out.push({ id: 'torch:fill', x: this.map.jerry.px + 14, y: this.map.jerry.py, describe: () => ({ label: 'Fill the blowtorch', cost: T.generator.jerryCost, holdTime: 0.6, action: () => { bt.mag = T.blowtorch.fuel; this.emit('ammo'); }, sub: 'A jerry can of diesel' }) });
  },
  questBenchOptions(opts) {
    const S = this.signal, tq = this.torch;
    if (S.step === 6 && !S.built) {
      const need = T.signal.boostParts + (this.mastRepaired ? 0 : 2);
      opts.push({ label: 'Build the signal booster', cost: 0, partsCost: need, holdTime: 1.5, action: () => { S.built = true; this.mastRepaired = true; this.emit('banner', { prio: 'objective', key: 'signal.built', text: 'BOOSTER BUILT', sub: 'Switch it on at the school roof' }); }, sub: this.mastRepaired ? 'Wire it into the school mast' : 'Includes patching the school mast (+2 Parts)' });
    }
    if (tq.burner && tq.propane && tq.pump && !tq.built) opts.push({ label: 'Build the Blowtorch', cost: 0, partsCost: T.blowtorch.buildParts, holdTime: 2, action: () => { tq.built = true; this.giveItem('blowtorch', 2); this.emit('banner', { text: 'THE BLOWTORCH', sub: 'Fill it with diesel at the garage. The workshop makes it a Dragon' }); }, sub: 'Weed burner + propane + pump' });
  },
  enterCode(i) {
    const S = this.signal;
    S.entered.push(i);
    if (S.entered.length < 3) { this.emit('tick'); return; }
    if (S.entered.every((k, n) => k === S.order[n])) { S.step = 6; S.order = null; this.radio('Got you. Clear as day. Can you boost it? We need more than this.', 'Signal'); this.emit('banner', { prio: 'objective', key: 'signal.code', text: 'THE CODE IS RIGHT', sub: 'Build a booster at the garage bench' }); }
    else { S.order = null; S.entered = []; this.pending.push({ t: 2, type: 'brute', counted: false, bar: this.pickBarricade(true) }); this.emit('banner', { text: 'WRONG CODE', sub: 'Static. Something big heard that. Try again next wave', danger: true }); this.emit('bruteWarn', { x: this.p.x, y: this.p.y }); }
  },
  signalLog() {
    const S = this.signal;
    const steps = ['Hear the broadcast', 'Find the receiver', 'Power it', 'Find the three frequencies', 'Climb the church tower', 'Answer with the code', 'Boost the signal'];
    return steps.map((t, i) => ({ text: i < S.step ? t : i === S.step ? '?' : '', done: i < S.step, hint: i === S.step ? SIGNAL_HINTS[i] : '' })).filter((s) => s.text);
  },
};
