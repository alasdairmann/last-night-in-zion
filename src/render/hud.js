// HUD (PRD §25): Enoch plaques (near-black outline, olive body, light top lip, dark bottom lip, hard drop shadow),
// Silkscreen numerals, Nunito labels. Drawn in logical 480x270 units at the integer scale so it stays pixel-perfect.
import { T } from '../tuning.js';
import { iconHD } from './sprites.js';
import { COMFORTS, FINDS, GUNS, MELEE, THROWS, COMFORT_INFO, EFFECTS, CONDITIONS, TRICKS, KEEPSAKES, PADDING, WEATHER, ITEMS, ROLES, ZONE_NAMES } from '../data.js';
import { weaponName } from '../sim/game.js';
import { FLOOR, WALL, BLD, DOOR, BAR, PROP } from '../map/town.js';
import { mapPOIs, paintTownMap, paintStreetNames } from '../ui/poi.js';
import { keyLabel, touchCopy } from '../input.js';
import { glyph as glyphBlock } from '../touch.js';

const VW = T.view.w, VH = T.view.h;
// v1.4 A3: what each timed buff does, one line each (hover the icon)
const BUFF_INFO = {
  adrenaline: ['Adrenaline', 'Every hit kills a walker outright; specials take x4.'], double: ['Double Scrap', 'Every kill and hit pays double.'],
  sale: ['Trader\'s sale', 'Her crate costs almost nothing, at every crate spot.'], guts: ['Walker guts', 'Walkers that haven\'t noticed you ignore you.'],
  chainsaw: ['The Chainsaw', 'Cleaves everything, ignores armour, scales with the wave.'], diamond: ['Bait (rotten)', 'Every walker wants you.'],
  t_mist: ['Red Mist', 'Your swings hit harder and kills heal you.'], k_polaroid: ['Polaroid', 'Gun Scrap refills your magazine.'], k_soldier: ['Toy Soldier', 'A rifleman on the rooftops shoots the nearest walker every second.'],
};
const NUM = 'Silkscreen, "Courier New", monospace';
const LBL = 'Nunito, "Trebuchet MS", sans-serif';

export class Hud {
  constructor(settings, store) {
    this.settings = settings; this.store = store;
    this.popups = []; this.barks = []; this.cards = []; this.cardSeen = new Map(); this.cardRects = []; this.marks = new Map();
    this.roundAnim = 0; this.roundBlink = 0; this.lastRound = 0;
    this.tut = null; this.tutQueue = []; this.mapCache = null; this.mapKey = '';
    this.time = 0; this.fps = 60; this.tickMs = 0;
    this.radio = null; this.radioQ = []; this.tape = null; this.hovers = []; this.mouse = null; this.swapInfo = null;
    this.notes = [];
  }
  get C() {
    const cb = this.settings.colourBlind;
    return { amber: cb ? '#3ad0d0' : '#f0b030', gold: '#e2b53c', red: cb ? '#d040d0' : '#e03a2a', green: '#6cbf4a', khaki: '#b8ae8a', cream: '#f0ead8', dark: '#1d1410' };
  }
  reset() { this.notes = []; this.popups = []; this.barks = []; this.cards = []; this.cardSeen = new Map(); this.pinned = null; this.pin = null; this.marks.clear(); this.roundAnim = 0; this.tut = null; this.tutQueue = []; this.mapKey = ''; this.radio = null; this.radioQ = []; this.tape = null; }

  consume(g, ev) {
    switch (ev.type) {
      case 'scrap': {
        if (!this.settings.popups) break;
        const ex = ev.src != null && this.popups.find((p) => p.src === ev.src && p.t < 0.3);
        if (ex) { ex.amt += ev.amt; ex.t = 0; ex.big = ex.big || ev.big; }
        else this.popups.push({ x: ev.x, y: ev.y, amt: ev.amt, big: ev.big, src: ev.src, t: 0 });
        break;
      }
      case 'bark': this.barks = [{ text: ev.text, t: 0 }]; break;
      case 'banner': this.pushBanner({ ...ev }, g); break;
      case 'card': this.pushCard({ ...ev }, g); break;
      case 'cardResolve': this.resolveCard(ev.key); break;
      case 'roundStart': this.roundAnim = 1.2; this.lastRound = ev.round; if (ev.round === 1) this.queueTut('shift', 4); if (ev.round === 2) this.queueTut('swap', 2); if (ev.dog) this.pushBanner({ text: 'DOG WAVE', sub: 'They come from the dark. No barricades will stop them.', danger: true, t: 0, life: 2.6 }); break;
      case 'roundEnd': this.roundBlink = 2; break;
      case 'plankTear': this.marks.set('b' + ev.id, { x: ev.x, y: ev.y, t: 2, kind: 'plank' }); break;
      case 'bruteSpawn': case 'bruteWarn': this.marks.set('brute', { x: ev.x, y: ev.y, t: 8, kind: 'helmet' }); break;
      case 'fail': break;
      case 'doorOpen': case 'power': this.mapKey = ''; break;
      case 'crateMoved': this.pushCard({ key: 'trader.moved', text: 'THE TRADER HAS MOVED ON', sub: 'Look for her lantern', pin: { x: ev.x, y: ev.y } }, g); break;
      case 'workshopLost': this.pushCard({ text: 'LEFT ON THE BENCH', sub: `${ev.name} is gone`, danger: true }, g); break;
      case 'down': this.pushCard({ key: 'down', text: 'DOWN', sub: ev.mode === 'bandages' ? 'Bandages: getting back up...' : 'Second Wind: getting back up...', danger: true }, g); break;
      case 'looter': this.queueTut('looter', 4); break;
      case 'radio': this.note(g, `${ev.who}: ${ev.text}`, 'radio'); this.radioQ.push({ who: ev.who, text: ev.text }); if (this.radioQ.length > 4) this.radioQ.shift(); break;
      case 'tape': this.tape = { title: ev.title, text: ev.text, t: 0 }; break;
      case 'offer': this.pushCard({ key: 'offer.' + ev.id, prio: 'objective', text: `HILLTOP: ${ev.name.toUpperCase()}`, sub: ev.brief }, g); break;
      case 'errandAccept': this.pushCard({ key: 'errand.' + ev.id, prio: 'objective', text: 'NEW ERRAND', sub: ev.name + (ev.failEnd ? `. Fails end of wave ${ev.failEnd}` : '') }, g); break;
      case 'errandDone': this.pushCard({ key: 'errand.done.' + ev.id, prio: 'objective', text: 'ERRAND COMPLETE', sub: ev.name }, g); break;
      case 'errandFail': this.pushCard({ key: 'errand.fail.' + ev.id, text: 'ERRAND FAILED', sub: ev.name, danger: true }, g); break;
      case 'trickReady': this.queueTut('trick'); break;
      case 'swap': this.swapInfo = { t: 0 }; break;
      case 'equip': this.swapInfo = { t: 0 }; break;
      case 'lookout': this.marks.set('look' + ev.x + ev.y, { x: ev.x, y: ev.y, t: 5, kind: 'helmet' }); break;
    }
  }
  // v1.4 A1: every banner is a card in one feed on the right edge. Critical: red edge, stays until resolved or
  // dismissed (click it), plays a sting. Objective: 8 s, kept in Notes. Info: 4 s. Same key within 5 s: dropped.
  pushBanner(b, g) {
    const prio = b.prio || (b.help ? 'objective' : 'info');
    return this.pushCard({ ...b, prio }, g);
  }
  pushCard(c, g) {
    if (this.touchUI) c = { ...c, text: touchCopy(c.text), sub: touchCopy(c.sub) };
    const C = T.cards, key = c.key || `${c.text}|${c.sub || ''}`, now = this.time;
    const live = this.cards.find((o) => o.key === key && !o.gone);
    if (live && (live.prio === 'critical' || c.update)) { Object.assign(live, { text: c.text, sub: c.sub, pin: c.pin || live.pin, code: c.code }); live.flash = 0.4; this.note(g, c.sub ? `${c.text}: ${c.sub}` : c.text, live.prio === 'critical' ? 'danger' : c.prio, { pin: live.pin, code: c.code }); return; }
    // v1.5 P2: repeats of a low-priority message fold into the live card (x2, x3) instead of stacking
    const same = (c.prio || 'info') === 'info' && this.cards.find((o) => o.prio === 'info' && o.text === c.text && !o.gone && o.t < o.life - 0.3);
    if (same) { same.n = (same.n || 1) + 1; same.sub = c.sub || same.sub; same.t = Math.min(same.t, 0.15); same.flash = 0.3; return; }
    if (now - (this.cardSeen.get(key) ?? -99) < C.dedupe) return;
    this.cardSeen.set(key, now);
    const card = { key, text: c.text, sub: c.sub || '', prio: c.prio || 'info', danger: !!c.danger || c.prio === 'critical', pin: c.pin || null, code: c.code || null, find: c.find, t: 0, life: c.prio === 'critical' ? C.critical : c.prio === 'objective' ? C.objective : C.info + (c.danger ? 2 : 0) };
    this.cards.unshift(card);
    if (card.prio === 'critical') this.sting = true;
    this.note(g, card.sub ? `${card.text}: ${card.sub}` : card.text, card.prio === 'critical' || card.danger ? 'danger' : card.prio === 'objective' ? 'objective' : 'banner', { pin: card.pin, code: card.code });
  }
  resolveCard(key) { for (const c of this.cards) if (c.key === key && c.t < c.life - 0.3) c.t = c.life - 0.3; }
  dismissCard(c) { c.t = Math.max(c.t, c.life - 0.3); if (c.prio === 'critical') this.cardSeen.set(c.key, this.time); }
  note(g, text, kind = 'banner', extra = {}) {
    if (this.touchUI) text = touchCopy(text);
    if (!text || (g && g.attract)) return;
    const wave = g ? g.round : this.lastRound;
    const last = this.notes[0]; if (last && last.text === text && last.wave === wave) return;
    this.notes.unshift({ text, wave, kind, ...extra }); if (this.notes.length > T.notes.max) this.notes.pop();
  }
  queueTut(key, delay = 0) {
    if (!this.settings.tutorial || this.store.tut[key] || this.tutQueue.some((q) => q.key === key) || (this.tut && this.tut.key === key)) return;
    this.tutQueue.push({ key, delay });
  }
  tutText(key) {
    if (this.touchUI) return {
      shift: 'Hold Attack, or tap the lock, to keep facing while you move', repair: 'Hold the context button to board the barricade: free, and it pays Scrap',
      shove: 'Tap the open hand to shove them back', buy: 'Hold the context button to buy with Scrap', swap: 'Tap the weapon chip to switch; hold it for every slot',
      throw: 'Tap the brick to throw it', map: this.mode === 'mobile' ? 'Hold the minimap for the town map' : 'Hold the map button for the town map',
      trick: 'Trick ready! Tap the Trick button', dog: 'Tap the dog button to send Biscuit; hold it to make him stay',
      looter: 'The Looter runs between town caches. Hit him once and he drops half his haul; kill him for the rest', carry: 'Carrying: no guns. Throw drops it',
    }[key];
    const k = this.settings.keys;
    return {
      shift: `Hold ${keyLabel(k.lock)} to keep facing while you move`,
      repair: `Hold ${keyLabel(k.interact)} to board the barricade: free, and it pays Scrap`,
      shove: `Press ${keyLabel(k.shove)} to shove them back`,
      buy: `Press and hold ${keyLabel(k.interact)} to buy with Scrap`,
      swap: '1-4 to switch weapons',
      throw: `Press ${keyLabel(k.throw)} to throw a brick`,
      map: `Hold ${keyLabel(k.map)} for the town map`,
      trick: `Trick ready! Press ${keyLabel(k.trick)}`,
      dog: `${keyLabel(k.dog)}: send Biscuit at what you face. Hold to make him stay`,
      looter: 'The Looter runs between town caches. Hit him once and he drops half his haul; kill him for the rest',
      carry: `Carrying: no guns. ${keyLabel(k.throw)} drops it`,
    }[key];
  }
  update(g, dt) {
    this.time += dt;
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter((p) => p.t < 0.6);
    for (const b of this.barks) b.t += dt;
    this.barks = this.barks.filter((b) => b.t < 1.6);
    for (const c of this.cards) { c.t += dt; if (c.flash > 0) c.flash -= dt; }
    this.cards = this.cards.filter((c) => c.t < c.life);
    // the Red Lion under attack is a critical card for as long as it lasts
    if (g.safeAlertT > 0 && !this.cards.some((c) => c.key === 'pub.attack')) this.pushCard({ key: 'pub.attack', prio: 'critical', text: 'THE RED LION IS UNDER ATTACK', sub: 'The dead are in with the survivors', pin: { x: g.map.pub.door.x, y: g.map.pub.door.y } }, g);
    if (!(g.safeAlertT > 0)) this.resolveCard('pub.attack');
    for (const [k, m] of this.marks) { m.t -= dt; if (m.t <= 0) this.marks.delete(k); }
    if (this.roundAnim > 0) this.roundAnim -= dt;
    if (this.roundBlink > 0) this.roundBlink -= dt;
    // tutorial triggers
    if (g.prompt?.kind === 'barricade') this.queueTut('repair');
    if (g.prompt && g.prompt.cost > 0 && !g.prompt.disabled) this.queueTut('buy');
    if (g.round >= 1 && g.enemies.some((e) => e.state === 'inside' && Math.hypot(e.x - g.p.x, e.y - g.p.y) < 22)) this.queueTut('shove');
    if (g.round >= 3) this.queueTut('map', 3);
    if (g.isCarrying && g.isCarrying()) this.queueTut('carry');
    this.dogPh = (this.dogPh || 0) + dt * (1.2 + 7 * (g.biscuitDanger ? g.biscuitDanger() : 0));
    if (this.swapInfo) { this.swapInfo.t += dt; if (this.swapInfo.t > 2.5) this.swapInfo = null; }
    if (this.tape) { this.tape.t += dt; if (this.tape.t > 6 + this.tape.text.length / 30) this.tape = null; }
    if (this.radio) { this.radio.t += dt; if (this.radio.t > 2.5 + this.radio.text.length / 28) this.radio = null; }
    if (!this.radio && this.radioQ.length) this.radio = { ...this.radioQ.shift(), t: 0 };
    if (this.tut) { this.tut.t += dt; if (this.tut.t > 4.5) { this.store.tut[this.tut.key] = true; this.store.save(); this.tut = null; } }
    else if (this.tutQueue.length) { const q = this.tutQueue[0]; q.delay -= dt; if (q.delay <= 0) { this.tutQueue.shift(); if (!this.store.tut[q.key]) { this.tut = { key: q.key, t: 0 }; this.note(g, `Tip: ${this.tutText(q.key)}`, 'tip'); } } }
  }

  // ---------- primitives ----------
  plaque(c, x, y, w, h, opt = {}) {
    const s = this.s, o = 3 / s;
    const body = opt.body || (opt.danger ? '#6a2a22' : '#5d5a32');
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(x - o + 4 / s, y - o + 4 / s, w + 2 * o, h + 2 * o);
    c.fillStyle = '#1d1410'; c.fillRect(x - o, y - o, w + 2 * o, h + 2 * o);
    c.fillStyle = body; c.fillRect(x, y, w, h);
    c.fillStyle = opt.lip || shadeHex(body, 0.25); c.fillRect(x, y, w, 2 / s);
    c.fillStyle = shadeHex(body, -0.35); c.fillRect(x, y + h - 3 / s, w, 3 / s);
  }
  inset(c, x, y, w, h) { c.fillStyle = '#211b14'; c.fillRect(x, y, w, h); c.fillStyle = '#120e0a'; c.fillRect(x, y, w, 1 / this.s); }
  text(c, str, x, y, { size = 8, font = LBL, weight = '900', color = '#f0ead8', align = 'left', shadow = true, base = 'top' } = {}) {
    if (this.minText && size < this.minText) size = this.minText; // Mobile: no HUD text under 10 CSS px
    c.font = `${weight} ${size}px ${font}`; c.textAlign = align; c.textBaseline = base;
    if (shadow) { c.fillStyle = '#1d1410'; c.fillText(str, x + 1 / this.s * 1.5, y + 1 / this.s * 1.5); }
    c.fillStyle = color; c.fillText(str, x, y);
  }
  measure(c, str, size, font = LBL, weight = '900') { if (this.minText && size < this.minText) size = this.minText; c.font = `${weight} ${size}px ${font}`; return c.measureText(str).width; }
  icon(c, key, x, y, scale = 1) { const im = iconHD(key); c.imageSmoothingEnabled = false; c.drawImage(im, x, y, 14 * scale, 14 * scale); }

  // ---------- draw ----------
  // Desktop and Tablet draw on the game canvas at the integer scale; Mobile draws on the overlay (drawMobile).
  draw(g, c, s, cam, opts = {}) { return this.drawDesktop(g, c, s, cam, opts); }
  drawDesktop(g, c, s, cam, opts = {}) {
    this.s = s; const C = this.C, p = g.p;
    this.hovers = [];
    c.save(); c.setTransform(s, 0, 0, s, 0, 0); c.imageSmoothingEnabled = false;
    const W2S = (x, y) => [x - cam.rx, y - cam.ry];

    if (opts.attract) { c.restore(); return; }
    // low health vignette (stepped pixel border, §21.1)
    const low = !p.dead && p.hp <= p.maxHp * T.player.lowHealth;
    if (low || p.downed) {
      const pulse = (Math.sin(this.time * 6) + 1) / 2;
      for (let i = 0; i < 3; i++) { c.fillStyle = `rgba(110,10,10,${(0.35 - i * 0.1) * (0.6 + 0.4 * pulse)})`; const t = 4 + i * 6; c.fillRect(0, 0, VW, t); c.fillRect(0, VH - t, VW, t); c.fillRect(0, 0, t, VH); c.fillRect(VW - t, 0, t, VH); }
    }
    if (g.timedV && g.timedV.mist > 0) { const a = 0.18 + (Math.sin(this.time * 10) + 1) * 0.06; c.fillStyle = `rgba(200,20,20,${a})`; for (let i = 0; i < 2; i++) { const t = 6 + i * 6; c.fillRect(0, 0, VW, t); c.fillRect(0, VH - t, VW, t); c.fillRect(0, 0, t, VH); c.fillRect(VW - t, 0, t, VH); } }
    if (g.timed.adrenaline > 0) { const a = (Math.sin(this.time * 8) + 1) * 0.12; c.fillStyle = `rgba(224,58,42,${a})`; c.fillRect(0, 0, VW, 3); c.fillRect(0, VH - 3, VW, 3); c.fillRect(0, 0, 3, VH); c.fillRect(VW - 3, 0, 3, VH); }

    // in-world: pop-ups, prompt, barks
    for (const pu of this.popups) {
      const [x, y] = W2S(pu.x, pu.y - 12 * (pu.t / 0.6));
      c.globalAlpha = 1 - Math.max(0, (pu.t - 0.35) / 0.25);
      this.text(c, `+${pu.amt}`, x, y, { font: NUM, weight: '400', size: pu.big ? 9 : 7, color: pu.big ? '#fff2c0' : C.amber, align: 'center' });
      c.globalAlpha = 1;
    }
    if (g.prompt && !p.dead) this.drawPrompt(c, g, W2S);
    if (g.cellar) this.drawCellar(c, g);
    if (this.barks.length && !p.dead) {
      const b = this.barks[0]; const [x, y] = W2S(p.x, p.y - 36);
      const w = this.measure(c, b.text, 7) + 8;
      this.plaque(c, Math.round(x - w / 2), y - 6, w, 11, { body: '#4a4830' });
      this.text(c, b.text, x, y - 5, { size: 7, align: 'center', color: C.cream });
    }
    this.drawOffscreen(c, g, cam);
    this.drawObjective(c, g, cam);
    // v1.4 F5: hover a survivor to see what they're holding
    for (const sv of g.survivors || []) if (!sv.dead && sv.state === 'home') { const [x, y] = W2S(sv.x, sv.y); if (x > 0 && x < VW && y > 0 && y < VH) this.hovers.push({ x: x - 7, y: y - 24, w: 14, h: 24, title: sv.name, body: `${ROLES[sv.role].name}. ${Math.ceil(sv.hp)}/${sv.maxHp} HP.`, extra: sv.weapon ? `Armed with your ${weaponName(sv.weapon)}` : 'No gun: give them one through the stash' }); }

    // round counter (top-left)
    {
      const blink = this.roundBlink > 0 && Math.floor(this.roundBlink * 4) % 2;
      this.plaque(c, 6, 6, 44, 30);
      this.text(c, 'WAVE', 28, 8, { size: 6, align: 'center', color: C.khaki });
      if (!blink) this.text(c, g.round ? String(g.round) : '-', 28, 15, { font: NUM, weight: '400', size: 14, align: 'center', color: g.dogRound || g.raidRound ? C.red : C.amber });
      if (g.weather && g.weather !== 'clear') { this.plaque(c, 52, 6, 16, 16); this.icon(c, 'w_' + g.weather, 54, 8); this.hovers.push({ x: 52, y: 6, w: 16, h: 16, title: WEATHER[g.weather].name, body: WEATHER[g.weather].desc }); }
      let y = 42;
      const rem = g.state === 'active' ? g.remaining() : 99;
      if (rem <= T.lastEnemy.outlineAt && rem > 0) { this.plaque(c, 6, y, 44, 11, { danger: true }); this.text(c, `${rem} LEFT`, 28, y + 1, { font: NUM, weight: '400', size: 7, align: 'center', color: C.cream }); y += 15; }
      if (g.state === 'laststand') { const E = g.escape; const left = Math.max(0, Math.ceil(E.standLen - E.standT)); this.plaque(c, 6, y, 60, 11, { danger: true }); this.text(c, E.stage === 'drive' ? 'DRIVE!' : `HOLD ${left}s`, 36, y + 1, { font: NUM, weight: '400', size: 7, align: 'center', color: C.cream }); }
      else if (g.state !== 'active' && !p.dead) { this.plaque(c, 6, y, 44, 11); this.text(c, `NEXT ${Math.ceil(g.breakT)}`, 28, y + 1, { font: NUM, weight: '400', size: 7, align: 'center', color: C.khaki }); }
    }
    // active finds (top-right)
    {
      const rows = [];
      for (const k of ['adrenaline', 'double', 'sale', 'guts']) if (g.timed[k] > 0) rows.push([k, g.timed[k]]);
      if (p.chainsawT > 0) rows.push(['chainsaw', p.chainsawT]);
      if (g.timed.bait > 0) rows.push(['diamond', g.timed.bait]);
      if (g.timedV) for (const k of ['mist', 'polaroid', 'soldier']) if (g.timedV[k] > 0) rows.push([k === 'mist' ? 't_mist' : 'k_' + k, g.timedV[k]]);
      rows.forEach(([k, t], i) => {
        const y = 6 + i * 20, x = VW - 56;
        if (t < 5 && Math.floor(this.time * 6) % 2) return;
        this.plaque(c, x, y, 50, 16, k === 'diamond' ? { danger: true } : {});
        this.icon(c, k, x + 1, y + 1);
        const info = BUFF_INFO[k]; if (info) this.hovers.push({ x, y, w: 50, h: 16, title: info[0], body: info[1], extra: `${Math.ceil(t)} s left` }); // v1.4 A3
        this.text(c, `0:${String(Math.ceil(t)).padStart(2, '0')}`, x + 46, y + 4, { font: NUM, weight: '400', size: 7, align: 'right', color: C.amber });
      });
      this.drawTracker(c, g, this.drawCards(c, g, 6 + rows.length * 20));
    }
    this.drawBottomLeft(c, g);
    this.drawCritical(c, g);
    this.drawWeapons(c, g);

    // centre: round start, banners, downed timer, tutorial
    if (this.roundAnim > 0 && g.round) {
      const k = Math.min(1, (1.2 - this.roundAnim) / 0.15), a = Math.min(1, this.roundAnim / 0.3);
      c.globalAlpha = a;
      this.text(c, String(g.round), VW / 2, 70 - 6 * (1 - k), { font: NUM, weight: '400', size: 36, align: 'center', color: g.dogRound ? C.red : C.amber });
      this.text(c, 'WAVE', VW / 2, 58, { size: 9, align: 'center', color: C.khaki });
      c.globalAlpha = 1;
    }
    if (p.downed) this.text(c, `GETTING UP ${Math.ceil(p.downT)}`, VW / 2, VH / 2 + 30, { font: NUM, weight: '400', size: 10, align: 'center', color: C.red });
    if (p.grabbed) { const k = Math.floor(this.time * 8) % 2; this.text(c, `MASH ${keyLabel(this.settings.keys.attack)}! ${p.grabbed.mash}/8`, VW / 2, VH / 2 + 26, { font: NUM, weight: '400', size: k ? 11 : 10, align: 'center', color: C.red }); }
    const raid = g.raidStatus ? g.raidStatus() : null;
    // v1.4 E5: the pinned objective bar while the booster is up
    const bs = g.boosterStatus ? g.boosterStatus() : null;
    if (bs) {
      const txt = `Booster ${Math.ceil(bs.hp * 100)}% · Raiders ${bs.killed}/${bs.total} · Group ${Math.max(1, bs.group)}/${bs.groups}`, w = this.measure(c, txt, 6) + 14, x = Math.round(Math.min(VW / 2, VW - 160 - w / 2) - w / 2), y = 6;
      const hit = bs.hp < 1 && Math.floor(this.time * 4) % 2 && g.signalRaiders().some((e) => e.sabotage);
      this.plaque(c, x, y, w, 18, { danger: !!hit, body: hit ? undefined : '#2e3a50' });
      this.text(c, txt, x + w / 2, y + 2, { size: 6, align: 'center', color: C.cream });
      c.fillStyle = '#211b14'; c.fillRect(x + 4, y + 12, w - 8, 3); c.fillStyle = bs.hp > 0.5 ? C.green : bs.hp > 0.25 ? C.amber : C.red; c.fillRect(x + 4, y + 12, Math.round((w - 8) * bs.hp), 3);
    }
    if (raid) { const txt = `RAIDERS ${raid.left}/${raid.total} · kill the Captain and they run`, w = this.measure(c, txt, 6) + 14, cx = Math.min(VW / 2, VW - 160 - w / 2); this.plaque(c, Math.round(cx - w / 2), bs ? 28 : 6, w, 13, { danger: true }); this.text(c, txt, cx, (bs ? 28 : 6) + 3, { size: 6, align: 'center', color: C.cream }); }
    this.drawRadio(c, g);
    if (this.tut && !p.dead) {
      const txt = this.tutText(this.tut.key); const w = this.measure(c, txt, 8) + 16;
      const a = Math.min(1, this.tut.t / 0.15, (4.5 - this.tut.t) / 0.3);
      c.globalAlpha = Math.max(0, a);
      this.plaque(c, Math.round(VW / 2 - w / 2), VH - 62, w, 15, { body: '#3e5a2e' });
      this.text(c, txt, VW / 2, VH - 59, { size: 8, align: 'center', color: C.cream });
      c.globalAlpha = 1;
    }
    if (opts.showMap) { this.drawMap(c, g); this.drawTooltip(c); }
    else this.drawTooltip(c);
    if (opts.debug) this.drawDebug(c, g, opts.debug);
    c.restore();
  }

  // the cellar network picker: where you'd come out, and how to move between the exits
  drawCellar(c, g) {
    const C = this.C, to = g.cellarDest(), n = g.cellar.dests.length + 1, i = g.cellar.idx + 1, F = keyLabel(this.settings.keys.interact);
    const busy = to && g.zedsNear(to.x, to.y, T.hatch.clearR), w = 190, x = VW / 2 - w / 2, y = VH - 58;
    this.plaque(c, x, y, w, 30, { body: '#3a2a1e' });
    this.text(c, `THE CELLARS  ${i}/${n}`, VW / 2, y + 3, { size: 6, align: 'center', color: C.khaki });
    this.text(c, `\u2190  ${to ? to.name : 'STAY HERE'}  \u2192`, VW / 2, y + 11, { size: 8, align: 'center', color: busy ? C.red : C.cream });
    const hint = busy ? 'The dead are up there' : to ? `${F}: climb out here   ESC: stay` : `${F} or ESC: climb back up where you came in`;
    this.text(c, this.touchUI ? touchCopy(hint) : hint, VW / 2, y + 21, { size: 5, align: 'center', color: busy ? C.red : C.khaki });
  }
  drawPrompt(c, g, W2S) {
    const pr = g.prompt, C = this.C;
    const [x, y0] = W2S(pr.x, pr.y);
    const y = y0 - (pr.kind === 'barricade' ? 26 : 30);
    const key = keyLabel(this.settings.keys.interact);
    // v1.4 B1: one short line ("F  Cellar") until F is pressed; costs and descriptions only then
    if (!pr.open && !pr.choices) {
      const lw = this.measure(c, pr.label, 7), w = lw + (pr.disabled ? 10 : 20), bx = Math.round(Math.max(4, Math.min(VW - w - 4, x - w / 2)));
      this.plaque(c, bx, y + 8, w, 13, { body: pr.disabled ? '#3a3a30' : undefined });
      if (!pr.disabled) { this.inset(c, bx + 2, y + 10, 10, 9); this.text(c, key, bx + 7, y + 11, { font: NUM, weight: '400', size: 6, align: 'center', color: C.cream, shadow: false }); }
      this.text(c, pr.label, pr.disabled ? bx + w / 2 : bx + 15, y + 11, { size: 7, color: pr.disabled ? C.khaki : C.amber, align: pr.disabled ? 'center' : 'left' });
      if (pr.menuN > 1) this.text(c, `${keyLabel(this.settings.keys.prev)} ◀  ${pr.menuIdx + 1}/${pr.menuN}  ▶ ${keyLabel(this.settings.keys.next)}`, bx + w / 2, y, { font: NUM, weight: '400', size: 5, align: 'center', color: C.amber });
      return;
    }
    const cost = (pr.cost ? ` - ${pr.cost.toLocaleString('en-GB')}` : '') + (pr.partsCost ? ` - ${pr.partsCost} PARTS` : '');
    const label = pr.label + cost;
    const lw = this.measure(c, label, 7);
    const subw = pr.sub ? this.measure(c, pr.sub, 6) : 0;
    const w = Math.max(lw + 20, subw + 8), h = pr.sub ? 21 : 13;
    const bx = Math.round(Math.max(4, Math.min(VW - w - 4, x - w / 2)));
    this.plaque(c, bx, y, w, h);
    if (!pr.disabled) { this.inset(c, bx + 2, y + 2, 10, 9); this.text(c, key, bx + 7, y + 3, { font: NUM, weight: '400', size: 6, align: 'center', color: C.cream, shadow: false }); }
    const col = pr.disabled ? C.khaki : pr.afford ? C.amber : C.red;
    this.text(c, label, bx + (pr.disabled ? w / 2 : 15), y + 3, { size: 7, color: col, align: pr.disabled ? 'center' : 'left' });
    if (pr.sub) this.text(c, pr.sub, bx + w / 2, y + 12, { size: 6, color: pr.warn ? C.amber : C.khaki, align: 'center' });
    if (pr.menuN > 1) {
      const kq = keyLabel(this.settings.keys.prev), ke = keyLabel(this.settings.keys.next);
      this.text(c, `${kq} ◀  ${pr.menuIdx + 1}/${pr.menuN}  ▶ ${ke}`, bx + w / 2, y - 8, { font: NUM, weight: '400', size: 5, align: 'center', color: C.amber });
    }
    if (pr.choices) {
      // workshop effect choice: two cards, the chosen one lit in its colour (v1.1 feedback)
      const cw = 58, gap = 6, x0 = Math.round(bx + w / 2 - cw - gap / 2), cy = y + h + 6;
      pr.choices.forEach((id, i) => {
        const E = EFFECTS[id], sel = i === pr.choice, cx = x0 + i * (cw + gap);
        const pulse = sel ? (Math.sin(this.time * 6) + 1) / 2 : 0;
        c.fillStyle = '#1d1410'; c.fillRect(cx - 2, cy - 2, cw + 4, 26);
        c.fillStyle = sel ? E.color : '#2a2620'; c.fillRect(cx - 1, cy - 1, cw + 2, 24);
        c.fillStyle = sel ? shadeHex(E.color, -0.55) : '#211b14'; c.fillRect(cx + 1, cy + 1, cw - 2, 20);
        if (sel) { c.globalAlpha = 0.3 + 0.3 * pulse; c.fillStyle = E.color; c.fillRect(cx + 1, cy + 1, cw - 2, 20); c.globalAlpha = 1; }
        this.text(c, E.name.toUpperCase(), cx + cw / 2, cy + 3, { size: 8, align: 'center', color: sel ? '#ffffff' : E.color });
        this.text(c, E.desc, cx + cw / 2, cy + 13, { size: 5, align: 'center', color: sel ? C.cream : C.khaki });
        this.text(c, i === 0 ? keyLabel(this.settings.keys.prev) : keyLabel(this.settings.keys.next), cx + (i === 0 ? -6 : cw + 6), cy + 7, { font: NUM, weight: '400', size: 6, align: 'center', color: sel ? E.color : C.khaki });
      });
    }
    if (pr.progress > 0 && !pr.disabled) {
      const segs = 8, filled = Math.floor(pr.progress * segs + 0.0001);
      for (let i = 0; i < segs; i++) { c.fillStyle = i < filled ? C.amber : '#211b14'; c.fillRect(bx + 3 + i * ((w - 6) / segs), y + h + 2, (w - 6) / segs - 1, 2); }
    }
  }
  drawBottomLeft(c, g) {
    const C = this.C, p = g.p;
    // comforts row (hover for what each does, §v1.1 feedback)
    const cap = Math.min(g.comfortSlotMax() + 1, g.comfortCap()); let x = 6; const y = this.mode === 'tablet' ? 74 : VH - 86; // Tablet: off the thumb corner
    const held = p.comforts.filter((id) => id !== 'bandages'); // v1.4 F6: Bandages have their own slot
    for (let i = 0; i < Math.max(cap, held.length); i++) {
      const id = held[i];
      const ripe = id && g.ripe(id);
      this.plaque(c, x, y, 16, 16, ripe ? { lip: '#f0d070', body: '#6a6236' } : {});
      if (id) {
        this.icon(c, id, x + 1, y + 1);
        if (ripe && Math.floor(this.time * 2 + i) % 6 === 0) { c.fillStyle = '#fff2b0'; c.fillRect(x + 12, y + 2, 2, 2); }
        const left = Math.max(0, T.comforts.ripenRounds - (p.comfortRounds[id] || 0));
        this.hovers.push({ x, y, w: 16, h: 16, title: COMFORTS[id].name + (ripe ? ' (ripe)' : ''), body: COMFORT_INFO[id].does, extra: (ripe ? COMFORT_INFO[id].ripe : `Ripens in ${left} wave${left === 1 ? '' : 's'}: ${COMFORT_INFO[id].ripe.replace('Ripened: ', '')}`) + ` Hold ${keyLabel(this.settings.keys.interact)} at its machine to pour it away.`, ripe });
      } else this.inset(c, x + 3, y + 3, 10, 10);
      x += 20;
    }
    if (g.hasComfort('bandages')) { x += 4; this.plaque(c, x, y, 16, 16, { body: '#5a4a40' }); this.icon(c, 'bandages', x + 1, y + 1); this.text(c, String(p.bandages), x + 15, y + 9, { font: NUM, weight: '400', size: 6, align: 'right', color: p.bandages ? C.cream : C.red }); this.hovers.push({ x, y, w: 16, h: 16, title: `Bandages (${p.bandages}/${g.bandageCap()})`, body: COMFORT_INFO.bandages.does, extra: 'A consumable: it doesn\'t use a comfort slot.' }); x += 20; }
    if (p.secondWind) { this.plaque(c, x, y, 16, 16, { body: '#3e5a2e' }); this.icon(c, 'secondWind', x + 1, y + 1); this.hovers.push({ x, y, w: 16, h: 16, title: 'Second Wind', body: 'When you go down, you get back up once.' }); }
    // padding + health (§11.3)
    const hy = VH - 62;
    if (p.padLayers) {
      for (let i = 0; i < p.padLayers; i++) {
        const bx = 6 + i * 26, k = p.pad[i] / T.padding.pointsPerLayer;
        c.fillStyle = '#1d1410'; c.fillRect(bx, hy - 1, 24, 6);
        for (let j = 0; j < 4; j++) { c.fillStyle = k > j / 4 + 0.01 ? (i === 2 ? '#9aa3b8' : i === 1 ? '#a8784e' : '#c8bf9a') : '#211b14'; c.fillRect(bx + 1 + j * 6, hy, 5, 4); }
      }
      this.hovers.push({ x: 6, y: hy - 2, w: 80, h: 8, title: 'Padding', body: `${p.padLayers} layer${p.padLayers > 1 ? 's' : ''}: ${PADDING.slice(0, p.padLayers).map((d) => d.name).join(', ')}. Soaks 75% of hits. Patch with Parts at a bench.` });
    }
    { const by = hy + 7, w = 104, k = Math.max(0, p.hp / p.maxHp);
      c.fillStyle = '#1d1410'; c.fillRect(6, by - 1, w + 2, 6); c.fillStyle = '#3a1410'; c.fillRect(7, by, w, 4);
      c.fillStyle = k <= T.player.lowHealth ? C.red : '#c8503a'; c.fillRect(7, by, Math.round(w * k), 4); c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(7, by, Math.round(w * k), 1);
      this.hovers.push({ x: 6, y: by - 1, w: w + 2, h: 6, title: 'Health', body: `${Math.ceil(p.hp)} / ${p.maxHp}. Regenerates after a few seconds without being hit.` }); }
    // scrap
    const sy = VH - 41;
    const str = g.infinite ? '∞' : g.scrap.toLocaleString('en-GB');
    const w = Math.max(70, this.measure(c, str, 11, NUM, '400') + 26);
    this.plaque(c, 6, sy, w, 18);
    this.icon(c, 'scrap', 8, sy + 2);
    this.text(c, str, 24, sy + 3, { font: NUM, weight: '400', size: 11, color: C.amber });
    if (g.streak.mult > 0) {
      const sx = 6 + w + 8;
      this.plaque(c, sx, sy + 2, 30, 14);
      this.text(c, `x${(1 + g.streak.mult).toFixed(1)}`, sx + 15, sy + 4, { font: NUM, weight: '400', size: 7, align: 'center', color: C.amber });
      const k = Math.max(0, 1 - (g.t - g.streak.last) / T.streak.window); c.fillStyle = C.amber; c.fillRect(sx + 2, sy + 13, 26 * k, 1);
    } else if (g.timed.double > 0) this.text(c, 'x2', 6 + w + 6, sy + 4, { font: NUM, weight: '400', size: 9, color: C.gold });
    if (g.debt > 0) this.text(c, `DEBT ${g.debt.toLocaleString('en-GB')}`, 6 + w + 44, sy + 5, { font: NUM, weight: '400', size: 6, color: C.red });
    else if (g.bank > 0) this.text(c, `SAFE ${g.bank.toLocaleString('en-GB')}`, 6 + w + 44, sy + 5, { font: NUM, weight: '400', size: 6, color: C.khaki });
    // noise meter + power
    const ny = VH - 18;
    this.plaque(c, 6, ny, 60, 12);
    this.text(c, 'NOISE', 9, ny + 2, { size: 6, color: C.khaki });
    const segs = 6, filled = Math.ceil(g.noise / (100 / segs) - 0.001);
    for (let i = 0; i < segs; i++) {
      let col = '#211b14';
      if (i < filled) col = g.noise >= T.noise.t2 ? (Math.floor(this.time * 8) % 2 ? C.red : '#7a2a22') : g.noise >= T.noise.t1 ? C.amber : C.khaki;
      c.fillStyle = col; c.fillRect(34 + i * 5, ny + 3, 4, 6);
    }
    this.hovers.push({ x: 6, y: ny, w: 60, h: 12, title: 'Noise', body: 'Guns and explosions raise it. Loud towns spawn the dead faster and in bigger numbers. Melee is silent.' });
    this.plaque(c, 70, ny, 16, 12, g.power ? { body: '#5d5a32' } : { body: g.fuseBlown ? '#6a2a22' : '#3a3a30' });
    c.globalAlpha = g.power ? 1 : 0.35; this.icon(c, 'power', 72, ny - 1); c.globalAlpha = 1;
    let bx = 90;
    if (g.everPowered) {
      this.plaque(c, 90, ny, 36, 12);
      const n = g.fuelRounds();
      for (let i = 0; i < n; i++) { c.fillStyle = i < g.fuel ? (g.fuel <= 2 ? C.red : C.amber) : '#211b14'; c.fillRect(93 + i * 3, ny + 3, 2, 6); }
      this.hovers.push({ x: 70, y: ny, w: 56, h: 12, title: 'Generator', body: g.fuseBlown ? 'The fuse has blown. Fit a spare at the fire station.' : `${g.fuel} waves of diesel left.` });
      bx = 130;
    }
    // Parts
    if (g.parts > 0 || g.everPowered) {
      this.plaque(c, bx, ny, 30, 12); this.icon(c, 'part', bx - 1, ny - 1);
      this.text(c, String(g.parts), bx + 27, ny + 2, { font: NUM, weight: '400', size: 7, align: 'right', color: C.cream });
      this.hovers.push({ x: bx, y: ny, w: 30, h: 12, title: 'Parts', body: 'Crafting material. Spend at benches: padding, weapon condition, builds. Earned from errands, trials, Brutes and Looters.' });
      bx += 34;
    }
    // Trick (§12): charge ring of 8 steps
    if (g.trick.id) {
      const ready = g.trickReady(), k = g.trick.charge / g.trickNeed();
      this.plaque(c, bx, ny - 6, 18, 18, ready ? { lip: '#f0d070', body: '#7a7440' } : {});
      for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i * Math.PI / 4; c.fillStyle = i < Math.floor(k * 8 + 1e-6) ? (ready ? (Math.floor(this.time * 4) % 2 ? '#fff2b0' : C.amber) : C.amber) : '#211b14'; c.fillRect(Math.round(bx + 9 + Math.cos(a) * 8) - 1, Math.round(ny + 3 + Math.sin(a) * 8) - 1, 2, 2); }
      this.icon(c, 't_' + g.trick.id, bx + 2, ny - 4);
      this.text(c, keyLabel(this.settings.keys.trick), bx + 17, ny + 6, { font: NUM, weight: '400', size: 5, align: 'right', color: C.cream });
      this.hovers.push({ x: bx, y: ny - 6, w: 18, h: 18, title: TRICKS[g.trick.id].name + (g.trick.up ? ' (upgraded)' : ''), body: TRICKS[g.trick.id].desc, extra: ready ? 'Ready!' : `${Math.floor(g.trick.charge)}/${g.trickNeed()} kills to charge` });
      bx += 22;
    }
    if (g.keepsake.held) {
      this.plaque(c, bx, ny - 6, 18, 18, { body: '#4a4060' }); this.icon(c, 'k_' + g.keepsake.held, bx + 2, ny - 4);
      this.hovers.push({ x: bx, y: ny - 6, w: 18, h: 18, title: KEEPSAKES[g.keepsake.held].name, body: KEEPSAKES[g.keepsake.held].desc, extra: `Double tap ${keyLabel(this.settings.keys.trick)} to use` });
      bx += 22;
    }
    // Biscuit
    const b = g.biscuit;
    if (b && !b.dead) {
      const flash = b.down && Math.floor(this.dogPh * 2) % 2;
      this.plaque(c, bx, ny - 6, 46, 18, b.down ? { danger: true } : {});
      if (!flash) this.icon(c, 'biscuit', bx + 1, ny - 4);
      const k = b.hp / b.maxHp; c.fillStyle = '#211b14'; c.fillRect(bx + 16, ny + 2, 27, 4); c.fillStyle = b.down ? C.red : C.green; c.fillRect(bx + 16, ny + 2, Math.round(27 * k), 4);
      this.text(c, b.mode === 'stay' ? 'STAY' : b.mode === 'attack' ? 'GET' : '', bx + 16, ny - 5, { size: 5, color: C.khaki });
      this.hovers.push({ x: bx, y: ny - 6, w: 46, h: 18, title: 'Biscuit', body: `${Math.ceil(b.hp)}/${b.maxHp} HP. ${keyLabel(this.settings.keys.dog)}: send him at what you face; hold to make him stay.`, extra: b.down ? 'Down! Hold F by him.' : `Mode: ${b.mode}` });
    }
  }
  // the feed: newest on top, 3 at most, the rest folded into a "+N" chip
  drawCards(c, g, y0) {
    const C = this.C, w = 150, x = VW - w - 6, M = T.cards.max; let y = y0;
    this.cardRects = [];
    // v1.5 P2: critical cards leave the feed for the centre banner (drawCritical)
    const rest = this.cards.filter((o) => o.prio !== 'critical'), show = rest.slice(0, M), more = rest.length - show.length;
    for (const cd of show) {
      const a = Math.max(0, Math.min(1, cd.t / 0.15, (cd.life - cd.t) / 0.3)), slide = Math.round((1 - Math.min(1, cd.t / 0.15)) * 20);
      const sub = cd.sub ? this.wrap(c, cd.sub, w - 12 - (cd.code ? 30 : 0), 6) : [], h = 12 + sub.length * 8 + (cd.code ? 2 : 0);
      c.globalAlpha = a;
      const body = cd.prio === 'critical' ? '#5a2620' : cd.prio === 'objective' ? '#3e5a2e' : cd.danger ? '#5a3a2a' : '#4a4830';
      this.plaque(c, x + slide, y, w, h, { body });
      if (cd.prio === 'critical') { c.fillStyle = Math.floor(this.time * 3) % 2 || cd.t > 3 ? C.red : '#ff8a70'; c.fillRect(x + slide, y, 3, h); }
      else if (cd.prio === 'objective') { c.fillStyle = '#a8e070'; c.fillRect(x + slide, y, 2, h); }
      if (cd.flash > 0) { c.fillStyle = `rgba(255,255,255,${cd.flash})`; c.fillRect(x + slide, y, w, h); }
      if (cd.find) this.icon(c, cd.find, x + slide + w - 18, y + 1);
      this.text(c, cd.n > 1 ? `${cd.text} x${cd.n}` : cd.text, x + slide + 6, y + 2, { size: 7, color: cd.prio === 'critical' || cd.danger ? C.cream : cd.prio === 'objective' ? '#c8f0a0' : C.amber });
      sub.forEach((l, i) => this.text(c, l, x + slide + 6, y + 11 + i * 8, { size: 6, color: C.khaki }));
      if (cd.code) { const cw = this.measure(c, cd.code, 7, NUM, '400') + 6, cx = x + slide + w - cw - 4; c.fillStyle = '#120e0a'; c.fillRect(cx, y + 10, cw, 10); c.fillStyle = C.amber; c.fillRect(cx, y + 10, cw, 1); this.text(c, cd.code, cx + 3, y + 11, { font: NUM, weight: '400', size: 7, color: '#fff2b0', shadow: false }); }
      if (cd.prio === 'critical') this.text(c, 'x', x + slide + w - 6, y + 1, { size: 6, color: C.khaki, align: 'right' });
      c.globalAlpha = 1;
      this.cardRects.push({ x, y, w, h, card: cd });
      y += h + 3;
    }
    if (more > 0) { this.plaque(c, x + w - 26, y, 26, 10); this.text(c, `+${more}`, x + w - 13, y + 1, { font: NUM, weight: '400', size: 6, align: 'center', color: C.khaki }); y += 14; }
    return y + 2;
  }
  // v1.5 P2: the newest critical card as a centre banner under the wave number; click it (or resolve it) to clear
  drawCritical(c, g) {
    const C = this.C, cd = this.cards.find((o) => o.prio === 'critical'); if (!cd) return;
    const others = this.cards.filter((o) => o.prio === 'critical').length - 1;
    const w = 220, mid = Math.round((58 + VW - 162) / 2), x = mid - w / 2, y = 22, sub = cd.sub ? this.wrap(c, cd.sub, w - 16, 6) : [], h = 14 + sub.length * 8;
    const a = Math.max(0, Math.min(1, cd.t / 0.15, (cd.life - cd.t) / 0.3)), pop = Math.round((1 - Math.min(1, cd.t / 0.2)) * 6);
    c.globalAlpha = a;
    this.plaque(c, x - pop, y - pop, w + pop * 2, h + pop * 2, { body: '#5a2620' });
    c.fillStyle = Math.floor(this.time * 3) % 2 || cd.t > 3 ? C.red : '#ff8a70'; c.fillRect(x - pop, y - pop, 3, h + pop * 2); c.fillRect(x + w + pop - 3, y - pop, 3, h + pop * 2);
    if (cd.flash > 0) { c.fillStyle = `rgba(255,255,255,${cd.flash})`; c.fillRect(x, y, w, h); }
    this.text(c, cd.n > 1 ? `${cd.text} x${cd.n}` : cd.text, mid, y + 3, { size: 8, align: 'center', color: C.cream });
    sub.forEach((l, i) => this.text(c, l, mid, y + 13 + i * 8, { size: 6, align: 'center', color: C.khaki }));
    this.text(c, others > 0 ? `+${others}  x` : 'x', x + w - 6, y + 1, { size: 6, color: C.khaki, align: 'right' });
    c.globalAlpha = 1;
    this.cardRects.push({ x, y, w, h, card: cd });
  }
  drawTracker(c, g, y0) {
    const C = this.C; let y = y0;
    const rows = g.errandTracker();
    for (const r of rows) {
      const w = 150, x = VW - w - 6;
      const lines = this.wrap(c, r.text, w - 8, 6), str = typeof r.timer === 'string', h = 15 + lines.length * 8 + (str ? 8 : 0);
      this.plaque(c, x, y, w, h, { body: r.parallel ? '#4a4830' : '#3e5a2e' });
      this.text(c, r.parallel ? r.name.toUpperCase() : `ERRAND: ${r.name.toUpperCase()}`, x + 4, y + 2, { size: 6, color: r.parallel ? C.amber : '#a8e070' });
      lines.forEach((l, i) => this.text(c, l, x + 4, y + 11 + i * 8, { size: 6, color: C.cream }));
      if (str) this.text(c, r.timer, x + 4, y + 11 + lines.length * 8, { size: 6, color: r.timer.endsWith(` ${g.round}`) ? C.red : C.amber }); // v1.4 E2
      else if (r.timer !== null && r.timer !== undefined) this.text(c, `${Math.ceil(r.timer)}s`, x + w - 4, y + 2, { font: NUM, weight: '400', size: 6, align: 'right', color: r.timer < 10 ? C.red : C.amber });
      y += h + 4;
    }
    const t = g.trial;
    if (t && g.round <= t.until) {
      const w = 150, x = VW - w - 6;
      const txt = g.trialText(), tl = this.wrap(c, txt, w - 30, 6), th = 10 + tl.length * 8;
      this.plaque(c, x, y, w, th);
      this.text(c, 'TRIAL', x + 4, y + 2, { size: 5, color: C.khaki });
      tl.forEach((l, i) => this.text(c, l, x + 26, y + 1 + i * 8, { size: 6, color: C.cream }));
      y += th - 18;
      const k = Math.min(1, t.n / (t.target * 2)), segs = 10;
      for (let i = 0; i < segs; i++) { c.fillStyle = i < Math.floor(k * segs + 1e-6) ? (i < segs / 2 ? C.amber : C.gold) : '#211b14'; c.fillRect(x + 4 + i * 11, y + 11, 10, 3); }
      this.text(c, `${Math.floor(t.n)}/${t.target}`, x + w - 4, y + 9, { font: NUM, weight: '400', size: 5, align: 'right', color: t.tier ? C.green : C.khaki });
      const tr = g.trialInfo ? g.trialInfo() : null;
      this.hovers.push({ x, y, w, h: 18, id: 'trial', title: `Trial: ${txt}`, body: tr ? tr.body : `${Math.floor(t.n)} of ${t.target} by the end of wave ${t.until}.`, extra: tr ? tr.extra : '' });
      y += 22;
    }
  }
  drawRadio(c, g) {
    const C = this.C;
    if (this.tape) {
      const tp = this.tape, n = Math.floor(tp.t * 30), txt = tp.text.slice(0, n), w = 300, x = VW / 2 - w / 2, y = 60;
      const lines = this.wrap(c, txt, w - 12, 7);
      this.plaque(c, x, y, w, 16 + lines.length * 9, { body: '#3a3a30' });
      this.text(c, `TAPE: ${tp.title.toUpperCase()}`, x + 6, y + 3, { size: 6, color: C.amber });
      lines.forEach((l, i) => this.text(c, l, x + 6, y + 12 + i * 9, { size: 7, color: C.cream }));
    }
    const r = this.radio; if (!r) return;
    const n = Math.floor(r.t * 28), txt = r.text.slice(0, n), w = 240, x = VW / 2 - w / 2, y = VH - 92;
    const lines = this.wrap(c, txt || ' ', w - 34, 7);
    const sig = r.who === 'Signal';
    this.plaque(c, x, y, w, 12 + lines.length * 9, { body: sig ? '#2e3a50' : '#3a3a30' });
    this.icon(c, 'radio', x + 3, y + 2);
    this.text(c, r.who.toUpperCase(), x + 18, y + 2, { size: 5, color: sig ? '#9ad0ff' : C.amber });
    lines.forEach((l, i) => this.text(c, l, x + 18, y + 8 + i * 9, { size: 7, color: C.cream }));
  }
  wrap(c, txt, w, size) {
    const words = txt.split(' '), out = []; let line = '';
    for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (this.measure(c, t, size) > w && line) { out.push(line); line = wd; } else line = t; }
    if (line) out.push(line);
    return out;
  }
  // a proper arrow (shaft + head), pointing along angle a, tip at (x, y)
  pointer(c, x, y, a, col, len, alpha) {
    const cs = Math.cos(a), sn = Math.sin(a), P = (f, s) => [x + cs * f - sn * s, y + sn * f + cs * s];
    const pts = [P(0, 0), P(-5, -4), P(-5, -1.5), P(-len, -1.5), P(-len, 1.5), P(-5, 1.5), P(-5, 4)];
    const path = () => { c.beginPath(); c.moveTo(...pts[0]); for (const q of pts.slice(1)) c.lineTo(...q); c.closePath(); };
    c.globalAlpha *= alpha; c.lineJoin = 'round'; c.lineWidth = 2; c.strokeStyle = '#1d1410'; path(); c.stroke(); c.fillStyle = col; path(); c.fill(); c.globalAlpha /= alpha;
  }
  drawObjective(c, g, cam) {
    // the only green arrow (§5.7): points at the current errand objective
    const o = g.errandObjective ? g.errandObjective() : null; // errands only: the main quests are for the player to work out
    const t = this.time;
    const shape = (x, y, a, col, len, alpha) => this.pointer(c, x, y, a, col, len, alpha);
    const px = g.p.x - cam.rx, py = g.p.y - cam.ry - 6, R = 30;
    const arrow = (wx, wy, col, label) => {
      const x = wx - cam.rx, y = wy - cam.ry - 10, dx = x - px, dy = y - py, d = Math.hypot(dx, dy);
      const bob = Math.sin(t * 5) * 1.5;
      if (d < R + 24 && x > 8 && x < VW - 8 && y > 8 && y < VH - 8) { // close and on screen: a small arrow over the spot
        shape(x, y - 4 + bob, Math.PI / 2, col, 10, 0.9);
        if (label) this.text(c, label, x, y - 22 + bob, { size: 6, align: 'center', color: col });
        return;
      }
      // otherwise it orbits the player on a ring, pointing the way; faint, so it never fights the HUD
      const a = Math.atan2(dy, dx), ax = px + Math.cos(a) * (R + bob), ay = py + Math.sin(a) * (R + bob);
      shape(ax, ay, a, col, 9, 0.75);
      if (label) this.text(c, label, ax - Math.cos(a) * 14, ay - Math.sin(a) * 14 - 3, { size: 6, align: 'center', color: col });
    };
    if (o) arrow(o.x, o.y, '#6cbf4a');
    // v1.5 P2: every critical card points the way (the Looter's follows him)
    for (const cd of this.cards) if (cd.prio === 'critical' && cd.t < cd.life - 0.3) {
      const lo = cd.key === 'looter' && g.enemies.find((e) => !e.dead && e.type === 'looter'), at = lo || cd.pin;
      if (at) arrow(at.x, at.y, '#e03a2a', '!');
    }
    if (this.pin) arrow(this.pin.x, this.pin.y, '#e2b53c', 'PIN'); // v1.4 A2/A4: a note you pinned
    for (const tr of g.triggers || []) { const sp = g.spot(tr.at); if (sp && (!tr.quiet || g.inPub(g.p.x, g.p.y))) arrow(sp.px, sp.py, '#e2b53c', '?'); } // v1.5 W1: the spool only points when you're in the pub
    const ev = g.eventTarget && g.eventTarget(); if (ev && !o) arrow(ev.x, ev.y, '#e2b53c');
    // the last straggler: a red triangle at the screen edge pointing the way, once it's the only one left and off screen
    const last = g.lastEnemy && g.lastEnemy();
    if (last) {
      const x = last.x - cam.rx, y = last.y - cam.ry;
      if (x < 6 || x > VW - 6 || y < 6 || y > VH - 6) {
        const cx = VW / 2, cy = VH / 2, dx = x - cx, dy = y - cy, a = Math.atan2(dy, dx);
        const k = Math.min((VW / 2 - (this.edgeX || 14)) / Math.abs(dx || 1e-3), (VH / 2 - (this.edgeY || 14)) / Math.abs(dy || 1e-3));
        const ax = cx + dx * k, ay = cy + dy * k, pulse = 0.65 + 0.35 * Math.sin(t * 6), cs = Math.cos(a), sn = Math.sin(a);
        const tri = (r, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(ax + cs * r, ay + sn * r); c.lineTo(ax - cs * r * 0.7 - sn * r * 0.8, ay - sn * r * 0.7 + cs * r * 0.8); c.lineTo(ax - cs * r * 0.7 + sn * r * 0.8, ay - sn * r * 0.7 - cs * r * 0.8); c.closePath(); c.fill(); };
        c.globalAlpha = pulse; tri(8, '#1d1410'); tri(6, this.C.red); c.globalAlpha = 1;
      }
    }
    if (g.safeAlertT > 0) arrow(g.map.pub.door.x, g.map.pub.door.y, this.C.red);
    if (g.biscuit && g.biscuit.down && !g.biscuit.dead) { const pu = (Math.sin(this.dogPh * Math.PI * 2) + 1) / 2; c.globalAlpha = 0.4 + 0.6 * pu; arrow(g.biscuit.x, g.biscuit.y, pu > 0.5 ? '#ff6a50' : this.C.red); c.globalAlpha = 1;
      // screen-edge red tint in time with the beat, stronger as he fades
      const k = g.biscuitDanger(); c.fillStyle = `rgba(200,30,20,${(0.08 + 0.22 * k) * pu})`; c.fillRect(0, 0, VW, 2); c.fillRect(0, VH - 2, VW, 2); c.fillRect(0, 0, 2, VH); c.fillRect(VW - 2, 0, 2, VH); }
  }
  // click a HUD element: its tooltip stays up for a few seconds and fades, even after the mouse leaves
  click(x, y) {
    const cr = this.cardRects.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h); if (cr) { this.dismissCard(cr.card); return; }
    const pad = (r) => (this.mode === 'tablet' ? Math.max(0, (44 / this.s - Math.min(r.w, r.h)) / 2) : 0);
    const h = this.hovers.find((r) => { const e = pad(r); return x >= r.x - e && x <= r.x + r.w + e && y >= r.y - e && y <= r.y + r.h + e; });
    this.pinned = h ? { key: h.id || h.title, at: { x, y }, t: 0 } : null;
  }
  drawTooltip(c) {
    const m = this.mouse;
    let h = m && this.hovers.find((r) => m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h), alpha = 1, at = m;
    const pin = this.pinned;
    if (pin) {
      pin.t = this.time - (pin.start ??= this.time);
      if (pin.t > 4.5) this.pinned = null;
      else if (!h || (h.id || h.title) === pin.key) { const ph = this.hovers.find((r) => (r.id || r.title) === pin.key); if (ph) { if (!h) { h = ph; at = pin.at; alpha = Math.min(1, (4.5 - pin.t) / 1); } } }
    }
    if (!h || !at) return;
    c.globalAlpha = alpha; this.drawTip(c, h, at); c.globalAlpha = 1;
  }
  drawTip(c, h, m) {
    if (this.touchUI) h = { ...h, body: touchCopy(h.body), extra: touchCopy(h.extra) };
    const C = this.C, w = 170;
    const body = this.wrap(c, h.body, w - 10, 6), extra = h.extra ? this.wrap(c, h.extra, w - 10, 6) : [];
    const ht = 14 + body.length * 8 + (extra.length ? 3 + extra.length * 8 : 0);
    let x = Math.min(VW - w - 4, m.x + 8), y = m.y - ht - 6; if (y < 4) y = m.y + 12;
    this.plaque(c, x, y, w, ht, { body: '#2a2820' });
    this.text(c, h.title, x + 5, y + 3, { size: 7, color: h.ripe ? '#f0d070' : C.amber });
    body.forEach((l, i) => this.text(c, l, x + 5, y + 13 + i * 8, { size: 6, color: C.cream }));
    extra.forEach((l, i) => this.text(c, l, x + 5, y + 16 + body.length * 8 + i * 8, { size: 6, color: h.ripe ? '#f0d070' : C.khaki }));
  }
  drawWeapons(c, g) {
    const C = this.C, p = g.p;
    const w = g.curWeapon();
    const bx = VW - 118, by = VH - 36, bw = 112, bh = 30;
    // other slots
    let sx = VW - 6;
    const th = p.throwable;
    // Tablet: the slot strip and pocket move to bottom-centre, off the right thumb
    const tab = this.mode === 'tablet', h0 = this.hovers.length, nG = g.hasComfort('mule') ? 3 : 2, tdx = tab ? Math.round(VW / 2 - (VW - 6 - (30 + 20 * (nG + 1)) / 2)) : 0, tdy = tab ? VH - 4 - by : 0;
    if (tab) { c.save(); c.translate(tdx, tdy); }
    sx -= 30; this.plaque(c, sx, by - 22, 30, 16); this.icon(c, th.id, sx + 1, by - 21); this.text(c, String(th.count), sx + 26, by - 18, { font: NUM, weight: '400', size: 8, align: 'right', color: th.count ? C.amber : C.khaki });
    this.text(c, `POCKET ${keyLabel(this.settings.keys.throw)}`, sx + 15, by - 31, { size: 5, align: 'center', color: C.khaki });
    this.hovers.push({ x: sx, y: by - 22, w: 30, h: 16, title: 'Pocket', body: `Throwables, thrown with ${keyLabel(this.settings.keys.throw)}. Buying a throwable replaces what is in your pocket.` });
    const nGun = g.hasComfort('mule') ? 3 : 2;
    { const gx1 = sx - 4, gx0 = sx - 20 * nGun; const lb = ['MELEE', 'PRI', 'SEC', 'MULE']; for (let i = 0; i <= nGun; i++) this.text(c, lb[i], sx - 20 * (nGun - i + 1) + 8, by - 31, { size: 5, align: 'center', color: C.khaki });
      this.hovers.push({ x: gx0 - 20, y: by - 32, w: gx1 - gx0 + 20, h: 26, title: 'Weapon slots', body: 'Slot 1 melee. Slot 2 Primary (rifles, shotguns, crossbow, bow). Slot 3 Secondary (pistols, SMGs). Pack Mule adds slot 4 for either. A gun with no free slot goes to the Red Lion stash; it never replaces what you hold.' }); }
    for (let i = nGun; i >= 0; i--) {
      sx -= 20;
      const sw = p.slots[i];
      this.plaque(c, sx, by - 22, 16, 16, i === p.cur ? { body: '#7a7440', lip: '#f0d070' } : {});
      if (sw) { c.globalAlpha = sw.kind === 'gun' && sw.mag + sw.reserve === 0 ? 0.35 : 1; this.icon(c, sw.id, sx + 1, by - 21); c.globalAlpha = 1; }
      else this.inset(c, sx + 3, by - 19, 10, 10);
      this.text(c, String(i + 1), sx + 1, by - 23, { font: NUM, weight: '400', size: 5, color: C.khaki });
    }
    if (tab) { c.restore(); for (let i = h0; i < this.hovers.length; i++) this.hovers[i] = { ...this.hovers[i], x: this.hovers[i].x + tdx, y: this.hovers[i].y + tdy }; }
    this.plaque(c, bx, by, bw, bh);
    if (p.chainsawT > 0) {
      this.icon(c, 'chainsaw', bx + 2, by + 2, 2);
      this.text(c, 'THE CHAINSAW', bx + 32, by + 4, { size: 8, color: C.amber });
      this.text(c, `${Math.ceil(p.chainsawT)}s`, bx + 32, by + 15, { font: NUM, weight: '400', size: 9, color: C.cream });
    } else if (w) {
      const empty = w.kind === 'gun' && w.mag + w.reserve === 0;
      c.globalAlpha = empty ? 0.4 : 1; this.icon(c, w.id, bx + 2, by + 1, 2); c.globalAlpha = 1;
      const cond = CONDITIONS[w.cond ?? 1];
      this.text(c, weaponName(w), bx + 32, by + 3, { size: 7, color: w.tier ? C.gold : (w.cond ?? 1) === 1 ? C.cream : cond.color });
      c.fillStyle = '#1d1410'; c.fillRect(bx + 2, by + bh - 6, 5, 5); c.fillStyle = cond.color; c.fillRect(bx + 3, by + bh - 5, 3, 3);
      this.hovers.push({ x: bx, y: by, w: bw, h: bh, title: `${cond.name} ${weaponName(w)}`, body: w.kind === 'gun' ? `${GUNS[w.id].name}. ${Math.round(T.condition.damage[w.cond ?? 1] * 100)}% damage from condition.` : `${MELEE[w.id].name} (${MELEE[w.id].feel}). ${Math.round(T.condition.damage[w.cond ?? 1] * 100)}% damage from condition.`, extra: [w.effect ? `Effect: ${EFFECTS[w.effect].name}` : '', ...(g.modNames(w))].filter(Boolean).join(' · ') || 'No mods (Fine and Masterwork weapons roll mods)' });
      if (this.swapInfo && (w.mods?.length || (w.cond ?? 1) !== 1)) { const txt = [cond.name, ...g.modNames(w)].join(' · '); this.text(c, txt, bx + bw, by - 40, { size: 6, align: 'right', color: cond.color }); }
      if (w.kind === 'gun') {
        const col = w.mag === 0 ? C.red : C.amber;
        if (w.id === 'blowtorch') { const k = w.mag / T.blowtorch.fuel; c.fillStyle = '#211b14'; c.fillRect(bx + 32, by + 16, 60, 5); c.fillStyle = C.amber; c.fillRect(bx + 32, by + 16, Math.round(60 * k), 5); this.text(c, 'FUEL', bx + 95, by + 15, { size: 5, color: C.khaki }); }
        else this.text(c, `${w.mag}`, bx + 32, by + 13, { font: NUM, weight: '400', size: 10, color: col });
        if (w.id !== 'blowtorch') this.text(c, `/ ${w.reserve}`, bx + 32 + this.measure(c, `${w.mag}`, 10, NUM, '400') + 3, by + 15, { font: NUM, weight: '400', size: 7, color: C.khaki });
        if (p.reloadT > 0) { this.text(c, 'RELOADING', bx + bw - 4, by + 15, { size: 6, color: C.khaki, align: 'right' }); }
        if (p.jamT > 0) this.text(c, 'JAMMED', bx + bw - 4, by + 15, { size: 6, color: C.red, align: 'right' });
        if (g.isCarrying()) this.text(c, 'HANDS FULL', bx + bw - 4, by + 15, { size: 6, color: C.red, align: 'right' });
      } else {
        const max = MELEE[w.id].dur;
        if (!Number.isFinite(w.dur) || !Number.isFinite(max)) this.text(c, w.tier ? 'UNBREAKABLE' : 'NEVER BREAKS', bx + 32, by + 15, { size: 6, color: C.khaki });
        else {
          const k = w.dur / max, segs = 5, f = Math.ceil(k * segs);
          const warn = k <= 0.25 && Math.floor(this.time * 4) % 2;
          for (let i = 0; i < segs; i++) { c.fillStyle = i < f ? (warn ? C.red : k <= 0.25 ? C.amber : C.cream) : '#211b14'; c.fillRect(bx + 32 + i * 9, by + 16, 8, 5); }
        }
      }
      if (w.effect) this.text(c, w.effect.toUpperCase(), bx + bw - 4, by + 3, { size: 5, color: C.gold, align: 'right' });
    } else this.text(c, 'EMPTY HANDS', bx + 32, by + 9, { size: 7, color: C.khaki });
    // shove cooldown bar
    // v1.3 C5: stamina, shared by shove and the power attack
    const k = p.stam;
    c.fillStyle = '#211b14'; c.fillRect(bx, by + bh + 2, bw, 2);
    c.fillStyle = p.charge >= 0 ? C.gold : k >= T.shove.stamina ? C.green : C.khaki; c.fillRect(bx, by + bh + 2, bw * Math.min(1, k), 2);
  }
  drawOffscreen(c, g, cam) {
    const C = this.C;
    // off-screen threats orbit the player on an outer ring (the errand arrow uses the inner one): icon plus a pointing arrow
    const px = g.p.x - cam.rx, py = g.p.y - cam.ry - 6, R = 46;
    const arrow = (wx, wy, col, key) => {
      const x = wx - cam.rx, y = wy - cam.ry - 8;
      if (x > 6 && x < VW - 6 && y > 6 && y < VH - 6) return;
      const a = Math.atan2(y - py, x - px), cs = Math.cos(a), sn = Math.sin(a);
      const ix = Math.round(px + cs * R), iy = Math.round(py + sn * R);
      c.globalAlpha = 0.85;
      if (key) this.icon(c, key, ix - 7, iy - 7); else { c.fillStyle = '#1d1410'; c.fillRect(ix - 3, iy - 3, 6, 6); c.fillStyle = col; c.fillRect(ix - 2, iy - 2, 4, 4); }
      c.globalAlpha = 1;
      this.pointer(c, ix + cs * 16, iy + sn * 16, a, col, 7, 0.85);
    };
    for (const m of this.marks.values()) arrow(m.x, m.y, m.kind === 'helmet' ? C.red : C.amber, m.kind);
    for (const e of g.enemies) if (e.type === 'brute') arrow(e.x, e.y, C.red, 'helmet');
    for (const e of g.enemies) if (e.type === 'looter' && !e.dead && !e.gone && (e.spotted || !g.looterHidden)) arrow(e.x, e.y, C.gold, 'wallet');
    for (const e of g.enemies) if (e.type === 'raider' && !e.dead && !e.gone && (e.squad === 'signal' || e.pubBound)) arrow(e.x, e.y, C.red, null); // v1.4 E4/E5
    for (const f of g.finds) arrow(f.x, f.y, f.rotten ? '#8cc83c' : C.amber, 'diamond');
  }
  drawMap(c, g) {
    const k = 3, W = g.W, H = g.H, mw = W * k, mh = H * k, ox = Math.round((VW - mw) / 2), oy = Math.round((VH - mh) / 2);
    const key = [...g.openZones].join(',') + (g.power ? 'p' : '') + (g.wrecks || []).length + g.safeBars.map((b) => (b.planks > 0 ? 1 : 0)).join('');
    if (key !== this.mapKey) {
      this.mapKey = key;
      const cv = document.createElement('canvas'); cv.width = mw; cv.height = mh; const m = cv.getContext('2d');
      paintTownMap(m, g, k); // v1.4 H1
      this.mapCache = cv;
    }
    this.plaque(c, ox - 6, oy - 16, mw + 12, mh + 22);
    this.text(c, 'ZION', ox, oy - 13, { size: 8, color: this.C.amber });
    this.text(c, g.power ? `POWER ON  FUEL ${g.fuel}` : g.everPowered ? 'OUT OF FUEL: JERRY CANS AT THE GARAGE' : 'GENERATOR: FIRE STATION', ox + mw, oy - 12, { size: 6, color: this.C.khaki, align: 'right' });
    c.drawImage(this.mapCache, ox, oy);
    { const o = g.errandObjective(), st = o && g.streetAt(o.x, o.y); paintStreetNames(c, ox, oy, k, 5, st ? st.name : null, (Math.sin(this.time * 5) + 1) / 2); } // v1.4 H1/E3
    const P = (x, y) => [ox + x / 16 * k, oy + y / 16 * k];
    for (const d of g.doors) if (!d.open) { const [x, y] = P(d.x, d.y); this.text(c, String(d.cost), x, y - 3, { font: NUM, weight: '400', size: 5, align: 'center', color: this.C.cream }); }
    // places of interest: icons on the map, and a tooltip for each (feedback)
    this.hovers = [];
    const pois = mapPOIs(g);
    for (const q of pois) {
      const [x, y] = P(q.x, q.y), sz = q.size ? Math.round(14 * q.size) : 6;
      if (q.size) this.icon(c, q.icon, x - sz / 2, y - sz / 2, q.size);
      this.hovers.push({ x: x - sz / 2, y: y - sz / 2, w: sz, h: sz, title: q.title, body: q.body });
    }
    // the trader: a pulsing lantern ring so she is easy to find (feedback)
    for (const cr of g.crates) if (cr.active) {
      const [x, y] = P(cr.px, cr.py), r = 8 + Math.round((Math.sin(this.time * 5) + 1) * 1.5);
      c.strokeStyle = this.C.gold; c.lineWidth = 1; c.strokeRect(x - r + 0.5, y - r + 0.5, r * 2 - 1, r * 2 - 1);
      const sale = g.timed.sale > 0, lbl = sale ? 'SALE!' : g.freePull >= g.round ? 'FREE PULL' : 'TRADER';
      this.text(c, lbl, x, y - r - 8, { size: 6, align: 'center', color: sale ? '#fff2b0' : this.C.gold });
    }
    // comfort machines a looter shut: greyed, waves left on top
    for (const s of g.map.comfortSpots) { const n = g.comfortLocks[s.id]; if (n > 0) { const [x, y] = P(s.px, s.py); c.fillStyle = 'rgba(20,16,12,0.7)'; c.fillRect(x - 7, y - 7, 14, 14); this.text(c, String(n), x, y - 5, { font: NUM, weight: '400', size: 8, align: 'center', color: this.C.red }); this.hovers.push({ x: x - 7, y: y - 7, w: 14, h: 14, title: `${COMFORTS[s.id].name}: looted`, body: `Out of action for ${n} more wave${n > 1 ? 's' : ''}.` }); } }
    for (const e of g.enemies) if (e.type === 'looter' && !e.dead && !e.gone) {
      if (e.spotted && e.route) { let [lx, ly] = P(e.x, e.y); c.fillStyle = this.C.gold; for (const w of e.route) { const [nx, ny] = P(w.x, w.y), d = Math.hypot(nx - lx, ny - ly); for (let i = 0; i < d; i += 3) c.fillRect(Math.round(lx + (nx - lx) * i / d), Math.round(ly + (ny - ly) * i / d), 1, 1); if (w.cache) c.fillRect(nx - 1, ny - 1, 3, 3); lx = nx; ly = ny; } } // v1.4 E6: his route, once he's spotted
      const [x, y] = P(e.x, e.y); c.fillStyle = Math.floor(this.time * 6) % 2 ? this.C.gold : '#fff'; c.fillRect(x - 2, y - 2, 4, 4); this.icon(c, 'wallet', x - 7, y - 16);
    }
    this.hovers.sort((p1, p2) => p2.w * p2.h - p1.w * p1.h).reverse();
    this.text(c, 'HOVER FOR DETAILS', ox, oy + mh + 3, { size: 5, color: this.C.khaki });
    for (const w of g.worldItems) if (w.kind === 'tape' || w.kind === 'bear') { const [x, y] = P(w.x, w.y); c.fillStyle = '#c8bf9a'; c.fillRect(x - 1, y - 1, 2, 2); }
    const o = g.errandObjective(); if (o) { const [x, y] = P(o.x, o.y); c.fillStyle = Math.floor(this.time * 4) % 2 ? '#6cbf4a' : '#2e5a1e'; c.fillRect(x - 3, y - 3, 6, 6); }
    if (this.pin) { const [x, y] = P(this.pin.x, this.pin.y); c.fillStyle = '#1d1410'; c.fillRect(x - 3, y - 9, 7, 7); c.fillStyle = Math.floor(this.time * 4) % 2 ? this.C.gold : '#fff2b0'; c.fillRect(x - 2, y - 8, 5, 5); c.fillRect(x, y - 3, 1, 3); this.text(c, this.pin.title || 'PIN', x, y - 17, { size: 5, align: 'center', color: this.C.gold }); }
    for (const tr of g.triggers) { const sp = g.spot(tr.at); const [x, y] = P(sp.px, sp.py); this.text(c, '?', x, y - 4, { size: 8, align: 'center', color: this.C.amber }); }
    if (g.biscuit && !g.biscuit.dead) { const [x, y] = P(g.biscuit.x, g.biscuit.y); c.fillStyle = '#c49a62'; c.fillRect(x - 1, y - 1, 3, 3); }
    if (g.escape.unlocked) { const E = g.escape; const parts = [['battery', E.battery], ['tyre', E.tyre], ['jerry', E.diesel >= 2], ['keys', E.keys]]; parts.forEach(([k, d], i) => { const x = ox + i * 16, y = oy + mh + 1; c.globalAlpha = d ? 1 : 0.35; this.icon(c, k, x, y - 14); c.globalAlpha = 1; if (d) this.text(c, '✔', x + 12, y - 8, { size: 6, color: this.C.green }); }); }
    // v1.2 B10: names on the map
    for (const z of Object.values(g.map.zones)) { if (!z.cx) continue; const [x, y] = P(z.cx, z.cy); this.text(c, (ZONE_NAMES[z.id] || '').replace(/^the /, '').toUpperCase(), x, y + 10, { size: 5, align: 'center', color: g.openZones.has(z.id) ? '#c8d8a8' : '#6a7460' }); }
    for (const b of g.map.buildings) if (b.name) { const [x, y] = P((b.x + b.w / 2) * 16, (b.y + b.h / 2) * 16); this.text(c, b.name, x, y - 3, { size: ['pub', 'church', 'school', 'fire', 'garage'].includes(b.kind) ? 5 : 4, align: 'center', color: this.C.cream }); }
    if (g.heist) { const d = g.map.pub.door, [x, y] = P(d.x, d.y - 40), t = `RAIDERS INSIDE: −${g.heist.parts} PARTS −${g.heist.scrap} SCRAP`, w = this.measure(c, t, 5) + 8, cx = Math.max(ox + w / 2 + 2, x); this.plaque(c, cx - w / 2, y - 14, w, 9, { danger: true }); this.text(c, t, cx, y - 13, { size: 5, align: 'center', color: this.C.cream }); } // v1.4 E4
    { const d = g.map.pub.door, [x, y] = P(d.x, d.y); c.fillStyle = g.pubShut ? this.C.red : this.C.green; c.fillRect(x - 2, y - 1, 4, 3); this.text(c, g.pubShut ? 'BOLTED' : 'UNBOLTED', x, y + 3, { size: 4, align: 'center', color: g.pubShut ? this.C.red : this.C.green }); }
    for (const r of g.roofMarks ? g.roofMarks() : []) { const [x, y] = P(r.x, r.y); c.fillStyle = Math.floor(this.time * 4) % 2 ? this.C.gold : '#fff2b0'; c.fillRect(x - 2, y - 6, 4, 4); c.fillRect(x - 1, y - 2, 2, 2); }
    const [px, py] = P(g.p.x, g.p.y);
    c.fillStyle = Math.floor(this.time * 4) % 2 ? '#ffffff' : this.C.amber; c.fillRect(px - 2, py - 2, 4, 4);
    this.plaque(c, px + 5, py - 6, 34, 10); this.text(c, 'YOU ARE HERE', px + 22, py - 4, { size: 4, align: 'center', color: this.C.amber });
  }
  // ================= Mobile HUD (Mobile & Touch PRD, "HUD decluttering") =================
  // Drawn on the overlay canvas in CSS px (v: viewport, safe insets, the game canvas rect, camera, dpr). Three tiers:
  // always on (top bar, ammo on the weapon chip), when it matters (one toast, the critical card, the objective line,
  // one buff chip), on demand behind a tap (satchel sheet, buff list, tracker, map, tap-and-hold tooltips).
  // mt holds this frame's tap targets for mobileTap().
  drawMobile(g, c, v, opts = {}) {
    const C = this.C, p = g.p, k = v.rect.w / VW;
    this.mt = []; this.hovers = []; this.mv = v;
    const world = () => { c.setTransform(v.dpr * k, 0, 0, v.dpr * k, v.dpr * v.rect.x, v.dpr * v.rect.y); this.s = k; this.minText = 10 / k; };
    const css = () => { c.setTransform(v.dpr, 0, 0, v.dpr, 0, 0); this.s = 1; this.minText = 10; };
    // ---- the world layer: vignettes, pop-ups, Cain's speech bubble, pointers
    world(); c.save(); c.beginPath(); c.rect(0, 0, VW, VH); c.clip();
    this.edgeX = 14; this.edgeY = 30;
    this.mobileVignette(c, g);
    const reduced = this.settings.mobileFx !== 'full';
    for (const pu of this.popups) {
      if (reduced && !pu.big) continue; // Mobile default: big pops only
      const x = pu.x - v.cam.rx, y = pu.y - 12 * (pu.t / 0.6) - v.cam.ry;
      c.globalAlpha = 1 - Math.max(0, (pu.t - 0.35) / 0.25);
      this.text(c, `+${pu.amt}`, x, y, { font: NUM, weight: '400', size: 9, color: '#fff2c0', align: 'center' });
      c.globalAlpha = 1;
    }
    if (this.barks.length && !p.dead && this.barks[0].t < 1.1) { // a speech bubble above Cain, shorter than on Desktop
      const b = this.barks[0], x = p.x - v.cam.rx, y = p.y - 38 - v.cam.ry, w = this.measure(c, b.text, 7) + 10, h = this.minText + 6;
      this.plaque(c, Math.round(x - w / 2), y - h / 2, w, h, { body: '#4a4830' });
      c.fillStyle = '#4a4830'; c.fillRect(x - 2, y + h / 2, 4, 3);
      this.text(c, b.text, x, y - h / 2 + 3, { size: 7, align: 'center', color: C.cream });
    }
    this.drawOffscreen(c, g, v.cam);
    this.drawObjective(c, g, v.cam);
    for (const sv of g.survivors || []) if (!sv.dead && sv.state === 'home') {
      const x = sv.x - v.cam.rx, y = sv.y - v.cam.ry;
      if (x > 0 && x < VW && y > 0 && y < VH) this.mt.push({ x: v.rect.x + (x - 9) * k, y: v.rect.y + (y - 26) * k, w: 18 * k, h: 28 * k, world: true, tip: { title: sv.name, body: `${ROLES[sv.role].name}. ${Math.ceil(sv.hp)}/${sv.maxHp} HP.`, extra: sv.weapon ? `Armed with your ${weaponName(sv.weapon)}` : 'No gun: give them one through the stash' } });
    }
    c.restore();
    css();
    // ---- centre: round number, downed / grabbed
    const cx = v.rect.x + v.rect.w / 2, cy = v.rect.y + v.rect.h / 2;
    if (this.roundAnim > 0 && g.round) {
      const a = Math.min(1, this.roundAnim / 0.3); c.globalAlpha = a;
      this.text(c, 'WAVE', cx, cy - 92, { size: 14, align: 'center', color: C.khaki });
      this.text(c, String(g.round), cx, cy - 76, { font: NUM, weight: '400', size: 48, align: 'center', color: g.dogRound ? C.red : C.amber });
      c.globalAlpha = 1;
    }
    if (p.downed) this.text(c, `GETTING UP ${Math.ceil(p.downT)}`, cx, cy + 46, { font: NUM, weight: '400', size: 16, align: 'center', color: C.red });
    if (p.grabbed) { const f = Math.floor(this.time * 8) % 2; this.text(c, `MASH ${this.touchUI ? 'ATTACK' : keyLabel(this.settings.keys.attack)}! ${p.grabbed.mash}/8`, cx, cy + 40, { font: NUM, weight: '400', size: f ? 17 : 16, align: 'center', color: C.red }); }
    if (g.cellar) this.mobileCellar(c, g, v);
    this.mobileTopBar(c, g, v);
    this.mobileTransients(c, g, v);
  }
  // drawn after the touch controls: sheets, the expanded prompt card, the map and tooltips sit above them
  drawMobileOver(g, c, v, opts = {}) {
    const C = this.C;
    c.setTransform(v.dpr, 0, 0, v.dpr, 0, 0); this.s = 1; this.minText = 10;
    if (this.promptCard && g.prompt && !g.p.dead) this.mobilePromptCard(c, g, v); else this.promptCard = false;
    if (opts.showMap) this.mobileMap(c, g, v);
    if (this.sheet === 'satchel') this.mobileSatchel(c, g, v);
    // tap-and-hold tooltips: shown while held, then for 2.5 s
    const tp = this.tipHold || (this.tipPin && this.time < this.tipPin.until ? this.tipPin : null);
    if (tp) { c.globalAlpha = this.tipHold ? 1 : Math.min(1, (this.tipPin.until - this.time) / 0.5); this.mobileTip(c, tp.tip, tp.x, tp.y, v); c.globalAlpha = 1; }
    this.s = undefined; this.minText = 0; this.edgeX = 0; this.edgeY = 0;
    void C;
  }
  mobileVignette(c, g) {
    const p = g.p;
    if ((!p.dead && p.hp <= p.maxHp * T.player.lowHealth) || p.downed) { const pulse = (Math.sin(this.time * 6) + 1) / 2; for (let i = 0; i < 3; i++) { c.fillStyle = `rgba(110,10,10,${(0.35 - i * 0.1) * (0.6 + 0.4 * pulse)})`; const t = 4 + i * 6; c.fillRect(0, 0, VW, t); c.fillRect(0, VH - t, VW, t); c.fillRect(0, 0, t, VH); c.fillRect(VW - t, 0, t, VH); } }
    if (g.timedV && g.timedV.mist > 0) { c.fillStyle = `rgba(200,20,20,${0.18 + (Math.sin(this.time * 10) + 1) * 0.06})`; for (let i = 0; i < 2; i++) { const t = 6 + i * 6; c.fillRect(0, 0, VW, t); c.fillRect(0, VH - t, VW, t); c.fillRect(0, 0, t, VH); c.fillRect(VW - t, 0, t, VH); } }
    if (g.timed.adrenaline > 0) { c.fillStyle = `rgba(224,58,42,${(Math.sin(this.time * 8) + 1) * 0.12})`; c.fillRect(0, 0, VW, 3); c.fillRect(0, VH - 3, VW, 3); c.fillRect(0, 0, 3, VH); c.fillRect(VW - 3, 0, 3, VH); }
  }
  buffRows(g) {
    const p = g.p, rows = [];
    for (const k of ['adrenaline', 'double', 'sale', 'guts']) if (g.timed[k] > 0) rows.push([k, g.timed[k]]);
    if (p.chainsawT > 0) rows.push(['chainsaw', p.chainsawT]);
    if (g.timed.bait > 0) rows.push(['diamond', g.timed.bait]);
    if (g.timedV) for (const k of ['mist', 'polaroid', 'soldier']) if (g.timedV[k] > 0) rows.push([k === 'mist' ? 't_mist' : 'k_' + k, g.timedV[k]]);
    return rows.sort((a, b) => a[1] - b[1]);
  }
  // the one-line objective: the booster or raid while they last, else the first errand, else the trial
  objectiveLine(g) {
    const bs = g.boosterStatus ? g.boosterStatus() : null, raid = g.raidStatus ? g.raidStatus() : null, out = [];
    if (bs) out.push({ text: `Booster ${Math.ceil(bs.hp * 100)}% · Raiders ${bs.killed}/${bs.total}`, bar: bs.hp, col: '#2e3a50', danger: bs.hp < 0.25 });
    if (raid) out.push({ text: `RAIDERS ${raid.left}/${raid.total}: kill the Captain`, col: '#6a2a22' });
    for (const r of g.errandTracker()) out.push({ text: `${r.parallel ? r.name : r.name}: ${r.text}`, timer: typeof r.timer === 'string' ? r.timer : r.timer != null ? `${Math.ceil(r.timer)}s` : '', col: r.parallel ? '#4a4830' : '#3e5a2e' });
    const t = g.trial; if (t && g.round <= t.until) out.push({ text: `Trial: ${g.trialText()}`, timer: `${Math.floor(t.n)}/${t.target}`, col: '#4a4830' });
    return out;
  }
  mobileTopBar(c, g, v) {
    const C = this.C, p = g.p, y = v.T + 6, h = 42, R = v.W - v.R - 8;
    let x = v.L + 8;
    // health with Scrap under it
    { const w = 156; this.plaque(c, x, y, w, h);
      if (p.padLayers) for (let i = 0; i < p.padLayers; i++) { const kk = p.pad[i] / T.padding.pointsPerLayer; c.fillStyle = '#1d1410'; c.fillRect(x + 6 + i * 30, y + 3, 28, 4); c.fillStyle = i === 2 ? '#9aa3b8' : i === 1 ? '#a8784e' : '#c8bf9a'; c.fillRect(x + 7 + i * 30, y + 4, 26 * kk, 2); }
      const kh = Math.max(0, p.hp / p.maxHp), by = y + (p.padLayers ? 9 : 6);
      c.fillStyle = '#1d1410'; c.fillRect(x + 5, by - 1, w - 10, 11); c.fillStyle = '#3a1410'; c.fillRect(x + 6, by, w - 12, 9);
      c.fillStyle = kh <= T.player.lowHealth ? C.red : '#c8503a'; c.fillRect(x + 6, by, Math.round((w - 12) * kh), 9); c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(x + 6, by, Math.round((w - 12) * kh), 2);
      this.icon(c, 'scrap', x + 5, y + 22);
      const str = g.infinite ? '∞' : g.scrap.toLocaleString('en-GB');
      this.text(c, str, x + 22, y + 23, { font: NUM, weight: '400', size: 13, color: C.amber });
      if (g.streak.mult > 0) this.text(c, `x${(1 + g.streak.mult).toFixed(1)}`, x + w - 6, y + 24, { font: NUM, weight: '400', size: 11, color: C.amber, align: 'right' });
      else if (g.timed.double > 0) this.text(c, 'x2', x + w - 6, y + 24, { font: NUM, weight: '400', size: 11, color: C.gold, align: 'right' });
      else if (g.debt > 0) this.text(c, 'DEBT', x + w - 6, y + 24, { font: NUM, weight: '400', size: 10, color: C.red, align: 'right' });
      this.mt.push({ x, y, w, h, tip: { title: `Health ${Math.ceil(p.hp)}/${p.maxHp}`, body: `Regenerates after a few seconds without being hit. Scrap: ${g.scrap.toLocaleString('en-GB')}${g.bank > 0 ? `, ${g.bank.toLocaleString('en-GB')} safe` : ''}${g.debt > 0 ? `, ${g.debt.toLocaleString('en-GB')} in debt` : ''}.`, extra: p.padLayers ? `Padding: ${PADDING.slice(0, p.padLayers).map((d) => d.name).join(', ')}` : '' } });
      x += w + 6; }
    // bandages, only while hurt (they get you back up when you go down)
    if (g.hasComfort('bandages') && p.hp < p.maxHp && !p.downed) {
      this.plaque(c, x, y, 44, h, { body: '#5a4a40' }); this.icon(c, 'bandages', x + 3, y + 4, 1.5);
      this.text(c, String(p.bandages), x + 40, y + 26, { font: NUM, weight: '400', size: 12, align: 'right', color: p.bandages ? C.cream : C.red });
      this.mt.push({ x, y, w: 44, h, tip: { title: `Bandages (${p.bandages}/${g.bandageCap()})`, body: 'When you go down, a Bandage gets you back up. Hold the context button by a hurt survivor to bandage them.' } });
      x += 50;
    }
    // wave with NEXT / LEFT
    { const w = 82, blink = this.roundBlink > 0 && Math.floor(this.roundBlink * 4) % 2;
      this.plaque(c, x, y, w, h, g.state === 'laststand' ? { danger: true } : {});
      this.text(c, 'WAVE', x + 6, y + 4, { size: 11, color: C.khaki });
      if (!blink) this.text(c, g.round ? String(g.round) : '-', x + w - 6, y + 2, { font: NUM, weight: '400', size: 16, align: 'right', color: g.dogRound || g.raidRound ? C.red : C.amber });
      const rem = g.state === 'active' ? g.remaining() : 99;
      let sub = '', col = C.khaki;
      if (g.state === 'laststand') { const E = g.escape; sub = E.stage === 'drive' ? 'DRIVE!' : `HOLD ${Math.max(0, Math.ceil(E.standLen - E.standT))}s`; col = C.cream; }
      else if (rem <= T.lastEnemy.outlineAt && rem > 0) { sub = `${rem} LEFT`; col = C.red; }
      else if (g.state !== 'active' && !p.dead) sub = `NEXT ${Math.ceil(g.breakT)}`;
      if (sub) this.text(c, sub, x + 6, y + 24, { font: NUM, weight: '400', size: 11, color: col });
      if (g.weather && g.weather !== 'clear') this.icon(c, 'w_' + g.weather, x + w - 18, y + 24, 1);
      this.mt.push({ x, y, w, h, tip: g.weather && g.weather !== 'clear' ? { title: WEATHER[g.weather].name, body: WEATHER[g.weather].desc } : { title: `Wave ${g.round || 0}`, body: g.state === 'active' ? `${g.remaining()} of the dead still to come or still standing.` : 'A break between waves: repair, buy, and get ready.' } });
      x += w + 6; }
    // right end: pause, satchel, minimap
    let rx = R - 44;
    this.plaque(c, rx, y, 44, h); glyphBlock(c, 'pause', rx + 22, y + h / 2, 18, C.cream);
    this.mt.push({ x: rx, y, w: 44, h, id: 'pause' });
    rx -= 50;
    { const ripe = g.p.comforts.some((id) => id !== 'bandages' && g.ripe(id));
      this.plaque(c, rx, y, 44, h, this.sheet === 'satchel' ? { body: '#7a7440' } : {}); glyphBlock(c, 'satchel', rx + 22, y + h / 2, 18, C.cream);
      if (ripe) { c.fillStyle = '#1d1410'; c.fillRect(rx + 31, y + 3, 10, 10); c.fillStyle = Math.floor(this.time * 2) % 2 ? '#fff2b0' : '#f0d070'; c.fillRect(rx + 32, y + 4, 8, 8); }
      this.mt.push({ x: rx, y, w: 44, h, id: 'satchel' }); }
    rx -= 72;
    { const mw = 66, mh = h; this.plaque(c, rx, y, mw, mh, { body: '#211b14' });
      const cv = this.townCache(g); if (cv) { const s = Math.min((mw - 6) / cv.width, (mh - 6) / cv.height), w = cv.width * s, hh = cv.height * s, ox = rx + (mw - w) / 2, oy = y + (mh - hh) / 2; c.imageSmoothingEnabled = true; c.drawImage(cv, ox, oy, w, hh); c.imageSmoothingEnabled = false;
        const P = (wx, wy) => [ox + wx / (g.W * 16) * w, oy + wy / (g.H * 16) * hh];
        const o = g.errandObjective && g.errandObjective(); if (o) { const [qx, qy] = P(o.x, o.y); c.fillStyle = '#6cbf4a'; c.fillRect(qx - 2, qy - 2, 4, 4); }
        const [px, py] = P(p.x, p.y); c.fillStyle = Math.floor(this.time * 4) % 2 ? '#ffffff' : C.amber; c.fillRect(px - 2, py - 2, 4, 4); }
      this.mt.push({ x: rx, y, w: mw, h: mh, id: 'minimap' }); }
    // one buff chip: the soonest to run out, "+N" for the rest; tap for the list
    const buffs = this.buffRows(g);
    if (buffs.length && rx - 84 >= x) { // narrow screens: the chip gives way rather than overlap
      const w = 78; rx -= w + 6;
      const [kk, t] = buffs[0], flash = t < 5 && Math.floor(this.time * 6) % 2;
      this.plaque(c, rx, y, w, h, kk === 'diamond' ? { danger: true } : {});
      if (!flash) this.icon(c, kk, rx + 4, y + 6, 1.43);
      this.text(c, `${Math.ceil(t)}s`, rx + w - 6, y + 4, { font: NUM, weight: '400', size: 13, align: 'right', color: C.amber });
      if (buffs.length > 1) this.text(c, `+${buffs.length - 1}`, rx + w - 6, y + 24, { font: NUM, weight: '400', size: 11, align: 'right', color: C.khaki });
      this.mt.push({ x: rx, y, w, h, id: 'buffs' });
      if (this.buffOpen > this.time) {
        let ly = y + h + 8;
        for (const [bk, bt] of buffs) {
          const info = BUFF_INFO[bk] || [bk, ''], bw = 230, bx = Math.min(rx, v.W - v.R - 8 - bw), lines = this.wrap(c, info[1], bw - 46, 11), bh = 22 + lines.length * 14;
          this.plaque(c, bx, ly, bw, bh, { body: '#2a2820' }); this.icon(c, bk, bx + 5, ly + 5, 1.43);
          this.text(c, info[0], bx + 32, ly + 4, { size: 12, color: C.amber }); this.text(c, `${Math.ceil(bt)}s`, bx + bw - 6, ly + 4, { font: NUM, weight: '400', size: 11, align: 'right', color: C.cream });
          lines.forEach((l, i) => this.text(c, l, bx + 32, ly + 20 + i * 14, { size: 11, color: C.cream }));
          ly += bh + 4;
        }
      }
    }
    // the objective: whatever space is left, one line; tap to expand the whole tracker
    const objs = this.objectiveLine(g), ow = rx - 6 - x;
    if (objs.length && ow > 80) {
      const o = objs[0];
      this.plaque(c, x, y, ow, h, { body: o.col, danger: o.danger });
      const tw = o.timer ? this.measure(c, o.timer, 11, NUM, '400') + 8 : 0;
      this.text(c, this.ellipsis(c, o.text, ow - 14 - tw - (objs.length > 1 ? 24 : 0), 12), x + 7, y + (o.bar != null ? 6 : 13), { size: 12, color: C.cream });
      if (o.timer) this.text(c, o.timer, x + ow - 7 - (objs.length > 1 ? 24 : 0), y + 14, { font: NUM, weight: '400', size: 11, align: 'right', color: C.amber });
      if (objs.length > 1) this.text(c, `+${objs.length - 1}`, x + ow - 6, y + 14, { font: NUM, weight: '400', size: 11, align: 'right', color: C.khaki });
      if (o.bar != null) { c.fillStyle = '#211b14'; c.fillRect(x + 7, y + 26, ow - 14, 6); c.fillStyle = o.bar > 0.5 ? C.green : o.bar > 0.25 ? C.amber : C.red; c.fillRect(x + 7, y + 26, (ow - 14) * o.bar, 6); }
      this.mt.push({ x, y, w: ow, h, id: 'tracker' });
      if (this.trackerOpen > this.time) {
        let ly = y + h + 8;
        const bw = Math.min(ow, 360);
        for (const r of objs) { const lines = this.wrap(c, r.text, bw - 16, 12), bh = 10 + lines.length * 15; this.plaque(c, x, ly, bw, bh, { body: r.col }); lines.forEach((l, i) => this.text(c, l, x + 8, ly + 5 + i * 15, { size: 12, color: C.cream })); if (r.timer) this.text(c, r.timer, x + bw - 8, ly + 5, { font: NUM, weight: '400', size: 11, align: 'right', color: C.amber }); ly += bh + 4; }
      }
    }
    this.topBarBottom = y + h;
  }
  ellipsis(c, s, w, size) { if (this.measure(c, s, size) <= w) return s; let t = s; while (t.length > 1 && this.measure(c, t + '…', size) > w) t = t.slice(0, -1); return t + '…'; }
  townCache(g) {
    const kk = 3, key = [...g.openZones].join(',') + (g.power ? 'p' : '') + (g.wrecks || []).length + g.safeBars.map((b) => (b.planks > 0 ? 1 : 0)).join('');
    if (key !== this.mapKey || !this.mapCache) { this.mapKey = key; const cv = document.createElement('canvas'); cv.width = g.W * kk; cv.height = g.H * kk; paintTownMap(cv.getContext('2d'), g, kk); this.mapCache = cv; }
    return this.mapCache;
  }
  // At most three transient messages, in priority order: critical, then objective, then a toast (then the tutorial,
  // a tape). One toast at a time, 3 s, swipe up to dismiss; everything else is already in the notes tray.
  mobileTransients(c, g, v) {
    const C = this.C, msgs = [];
    const crit = this.cards.find((o) => o.prio === 'critical');
    if (crit) msgs.push(['critical', crit]);
    const obj = this.cards.find((o) => o.prio === 'objective' && o.t < Math.min(o.life, 4));
    if (obj) msgs.push(['toast', obj]);
    const info = this.cards.find((o) => o.prio === 'info' && o.t < 3);
    if (info) msgs.push(['toast', info]);
    if (this.tut && !g.p.dead) msgs.push(['tut', this.tut]);
    if (this.tape) msgs.push(['tape', this.tape]);
    const show = msgs.slice(0, 3);
    let ty = (this.topBarBottom || v.T + 48) + 8;
    const mid = v.rect.x + v.rect.w / 2, tw = Math.min(380, v.W - v.L - v.R - 260);
    let toasts = 0;
    for (const [kind, m] of show) {
      if (kind === 'critical') {
        const w = Math.min(420, v.W - v.L - v.R - 40), sub = m.sub ? this.wrap(c, m.sub, w - 70, 12) : [], h = Math.max(52, 24 + sub.length * 15), x = mid - w / 2, y = v.rect.y + v.rect.h * 0.3;
        const a = Math.max(0, Math.min(1, m.t / 0.15, (m.life - m.t) / 0.3)); c.globalAlpha = a;
        this.plaque(c, x, y, w, h, { body: '#5a2620' });
        c.fillStyle = Math.floor(this.time * 3) % 2 || m.t > 3 ? C.red : '#ff8a70'; c.fillRect(x, y, 4, h);
        this.text(c, m.n > 1 ? `${m.text} x${m.n}` : m.text, x + 12, y + 6, { size: 14, color: C.cream });
        sub.forEach((l, i) => this.text(c, l, x + 12, y + 25 + i * 15, { size: 12, color: C.khaki }));
        const bx = x + w - 48, by = y + (h - 44) / 2; c.fillStyle = '#1d1410'; c.fillRect(bx, by, 44, 44); c.fillStyle = '#3a1a16'; c.fillRect(bx + 2, by + 2, 40, 40); glyphBlock(c, 'close', bx + 22, by + 22, 16, C.cream);
        c.globalAlpha = 1;
        this.mt.push({ x: bx, y: by, w: 44, h: 44, id: 'dismiss', card: m });
        continue;
      }
      if (kind === 'toast') {
        if (toasts++) continue; // one toast at a time
        const lines = m.sub ? this.wrap(c, m.sub, tw - 16, 11).slice(0, 2) : [], h = 22 + lines.length * 14, x = mid - tw / 2, y = ty;
        const a = Math.max(0, Math.min(1, m.t / 0.15, ((m.prio === 'objective' ? 4 : 3) - m.t) / 0.3)), drag = this.toastDrag && this.toastDrag.card === m ? Math.min(0, this.toastDrag.dy) : 0;
        c.globalAlpha = a * (1 + drag / 60);
        this.plaque(c, x, y + drag, tw, h, { body: m.prio === 'objective' ? '#3e5a2e' : m.danger ? '#5a3a2a' : '#4a4830' });
        this.text(c, this.ellipsis(c, m.n > 1 ? `${m.text} x${m.n}` : m.text, tw - 16, 13), x + 8, y + drag + 4, { size: 13, color: m.prio === 'objective' ? '#c8f0a0' : m.danger ? C.cream : C.amber });
        lines.forEach((l, i) => this.text(c, l, x + 8, y + drag + 21 + i * 14, { size: 11, color: C.khaki }));
        c.globalAlpha = 1;
        this.mt.push({ x, y, w: tw, h, id: 'toast', card: m });
        ty += h + 6;
        continue;
      }
      if (kind === 'tut') {
        const txt = this.tutText(m.key), w = Math.min(this.measure(c, txt, 13) + 24, v.W - 300), y = v.rect.y + v.rect.h * 0.62, a = Math.max(0, Math.min(1, m.t / 0.15, (4.5 - m.t) / 0.3));
        c.globalAlpha = a; this.plaque(c, mid - w / 2, y, w, 26, { body: '#3e5a2e' }); this.text(c, this.ellipsis(c, txt, w - 16, 13), mid, y + 5, { size: 13, align: 'center', color: C.cream });
        const at = this.tutPoint?.(m.key); if (at) { const ax = at.x, ay = at.y - at.r - 6, dir = ax > mid ? 1 : -1; c.strokeStyle = '#a8e070'; c.lineWidth = 3; c.beginPath(); c.moveTo(mid + dir * w / 2, y + 13); c.lineTo(ax, ay); c.stroke(); c.fillStyle = '#a8e070'; c.beginPath(); c.arc(ax, ay, 5, 0, Math.PI * 2); c.fill(); }
        c.globalAlpha = 1; continue;
      }
      if (kind === 'tape') {
        const n = Math.floor(m.t * 30), w = Math.min(420, v.W - 300), lines = this.wrap(c, m.text.slice(0, n), w - 16, 12).slice(-4), x = mid - w / 2, y = ty;
        this.plaque(c, x, y, w, 24 + lines.length * 15, { body: '#3a3a30' });
        this.text(c, `TAPE: ${m.title.toUpperCase()}`, x + 8, y + 4, { size: 11, color: C.amber });
        lines.forEach((l, i) => this.text(c, l, x + 8, y + 20 + i * 15, { size: 12, color: C.cream }));
        ty += 30 + lines.length * 15;
      }
    }
  }
  mobileCellar(c, g, v) {
    const C = this.C, to = g.cellarDest(), n = g.cellar.dests.length + 1, i = g.cellar.idx + 1;
    const busy = to && g.zedsNear(to.x, to.y, T.hatch.clearR), w = 300, x = v.rect.x + v.rect.w / 2 - w / 2, y = v.rect.y + v.rect.h * 0.62;
    this.plaque(c, x, y, w, 52, { body: '#3a2a1e' });
    this.text(c, `THE CELLARS  ${i}/${n}`, x + w / 2, y + 4, { size: 11, align: 'center', color: C.khaki });
    this.text(c, to ? to.name : 'STAY HERE', x + w / 2, y + 18, { size: 14, align: 'center', color: busy ? C.red : C.cream });
    this.text(c, busy ? 'The dead are up there' : this.touchUI ? 'Arrows choose; the button climbs out' : `${keyLabel(this.settings.keys.interact)}: climb out   ESC: stay`, x + w / 2, y + 36, { size: 10, align: 'center', color: busy ? C.red : C.khaki });
  }
  // the context button's card: label, cost, description, options; the button itself confirms (hold)
  mobilePromptCard(c, g, v) {
    const C = this.C, pr = g.prompt, b = this.ctxRect?.(); if (!b) return;
    const cost = (pr.cost ? ` · ${pr.cost.toLocaleString('en-GB')} Scrap` : '') + (pr.partsCost ? ` · ${pr.partsCost} Parts` : '');
    const w = 300, body = pr.sub ? this.wrap(c, pr.sub, w - 16, 12) : [], h = 30 + body.length * 15 + (pr.menuN > 1 ? 18 : 0) + 18;
    const x = Math.max(v.L + 8, Math.min(v.W - v.R - w - 8, b.x - w / 2)), y = Math.max((this.topBarBottom || 0) + 6, b.y - b.h / 2 - h - 34);
    this.plaque(c, x, y, w, h, { body: '#2a2820' });
    this.text(c, this.ellipsis(c, pr.label + cost, w - 16, 13), x + 8, y + 6, { size: 13, color: pr.disabled ? C.khaki : pr.afford ? C.amber : C.red });
    body.forEach((l, i) => this.text(c, l, x + 8, y + 26 + i * 15, { size: 12, color: pr.warn ? C.amber : C.cream }));
    let ly = y + 26 + body.length * 15;
    if (pr.menuN > 1) { this.text(c, `Option ${pr.menuIdx + 1} of ${pr.menuN}: use the arrows or swipe`, x + 8, ly, { size: 11, color: C.khaki }); ly += 18; }
    if (pr.choices) pr.choices.forEach((id, i) => { const E = EFFECTS[id]; this.text(c, `${i === pr.choice ? '▶ ' : '   '}${E.name}: ${E.desc}`, x + 8, ly + i * 15 - (pr.menuN > 1 ? 0 : 0), { size: 11, color: i === pr.choice ? E.color : C.khaki }); });
    this.text(c, pr.disabled ? '' : 'Hold the button to confirm', x + w - 8, y + h - 16, { size: 10, align: 'right', color: '#a8e070' });
  }
  mobileSatchel(c, g, v) {
    const C = this.C, p = g.p, w = Math.min(460, v.W - v.L - v.R - 40), x = (v.W - w) / 2, y = (this.topBarBottom || v.T + 48) + 8, maxH = v.H - v.B - y - 8;
    this.mt.push({ x: 0, y: 0, w: v.W, h: v.H, id: 'sheetBg' });
    const rows = [];
    const held = p.comforts.filter((id) => id !== 'bandages');
    for (const id of held) { const ripe = g.ripe(id), left = Math.max(0, T.comforts.ripenRounds - (p.comfortRounds[id] || 0)); rows.push({ icon: id, title: COMFORTS[id].name + (ripe ? ' (ripe)' : ''), body: COMFORT_INFO[id].does, extra: ripe ? COMFORT_INFO[id].ripe : `Ripens in ${left} wave${left === 1 ? '' : 's'}`, ripe }); }
    const free = Math.max(0, Math.min(g.comfortSlotMax() + 1, g.comfortCap()) - held.length);
    if (free) rows.push({ title: `${free} empty comfort slot${free > 1 ? 's' : ''}`, body: 'Comforts are bought at their machines around town.' });
    if (g.hasComfort('bandages')) rows.push({ icon: 'bandages', title: `Bandages ${p.bandages}/${g.bandageCap()}`, body: COMFORT_INFO.bandages.does });
    if (p.secondWind) rows.push({ icon: 'secondWind', title: 'Second Wind', body: 'When you go down, you get back up once.' });
    rows.push({ icon: 'power', title: g.power ? `Generator: ${g.fuel} waves of diesel` : g.fuseBlown ? 'Generator: the fuse has blown' : 'Generator: off', body: `Noise ${Math.round(g.noise)}%: guns and explosions bring more of the dead. Parts: ${g.parts}.` });
    if (g.keepsake.held) rows.push({ icon: 'k_' + g.keepsake.held, title: KEEPSAKES[g.keepsake.held].name, body: KEEPSAKES[g.keepsake.held].desc, extra: 'Double-tap the Trick button to use it' });
    const lay = rows.map((r) => { const b = this.wrap(c, r.body, w - 60, 11), e = r.extra ? this.wrap(c, r.extra, w - 60, 11) : []; return { r, b, e, h: Math.max(44, 22 + (b.length + e.length) * 14) }; });
    const h = Math.min(maxH, 40 + lay.reduce((s, l) => s + l.h + 4, 0));
    this.plaque(c, x, y, w, h, { body: '#2a2820' });
    this.text(c, 'SATCHEL', x + 10, y + 8, { size: 14, color: C.amber });
    this.mt.push({ x, y, w, h, id: 'sheet' });
    const bx = x + w - 48; glyphBlock(c, 'close', bx + 22, y + 22, 16, C.cream); this.mt.push({ x: bx, y, w: 48, h: 44, id: 'sheetClose' });
    c.save(); c.beginPath(); c.rect(x, y + 36, w, h - 40); c.clip();
    let ly = y + 40;
    for (const l of lay) {
      if (l.r.ripe) { c.fillStyle = 'rgba(240,208,112,0.12)'; c.fillRect(x + 4, ly, w - 8, l.h); }
      if (l.r.icon) this.icon(c, l.r.icon, x + 10, ly + 6, 2);
      this.text(c, l.r.title, x + 50, ly + 4, { size: 13, color: l.r.ripe ? '#f0d070' : C.amber });
      l.b.forEach((t, i) => this.text(c, t, x + 50, ly + 21 + i * 14, { size: 11, color: C.cream }));
      l.e.forEach((t, i) => this.text(c, t, x + 50, ly + 21 + (l.b.length + i) * 14, { size: 11, color: l.r.ripe ? '#f0d070' : C.khaki }));
      ly += l.h + 4;
    }
    c.restore();
  }
  mobileMap(c, g, v) {
    // the Desktop map, scaled up to fill the screen; tap and hold a place for its tooltip
    const mw = g.W * 3 + 12, mh = g.H * 3 + 22, s = Math.min((v.W - v.L - v.R - 16) / mw, (v.H - v.T - v.B - 16) / mh);
    c.fillStyle = 'rgba(8,10,18,0.7)'; c.fillRect(0, 0, v.W, v.H);
    const ox = v.W / 2 - VW / 2 * s, oy = v.H / 2 - VH / 2 * s;
    c.setTransform(v.dpr * s, 0, 0, v.dpr * s, v.dpr * ox, v.dpr * oy); this.s = s; this.minText = 10 / s;
    const keep = this.hovers; this.drawMap(c, g); const spots = this.hovers; this.hovers = keep;
    c.setTransform(v.dpr, 0, 0, v.dpr, 0, 0); this.s = 1; this.minText = 10;
    this.mt.push({ x: 0, y: 0, w: v.W, h: v.H, id: 'mapBg' });
    for (const hv of spots) this.mt.push({ x: ox + hv.x * s - 4, y: oy + hv.y * s - 4, w: hv.w * s + 8, h: hv.h * s + 8, tip: hv });
    if (this.mapOpen) { const bx = v.W - v.R - 56, by = v.T + 8; this.plaque(c, bx, by, 44, 44); glyphBlock(c, 'close', bx + 22, by + 22, 16, this.C.cream); this.mt.push({ x: bx, y: by, w: 44, h: 44, id: 'mapClose' }); }
  }
  mobileTip(c, h, mx, my, v) {
    h = { ...h, body: touchCopy(h.body), extra: touchCopy(h.extra) };
    const C = this.C, w = 250, body = this.wrap(c, h.body || '', w - 16, 12), extra = h.extra ? this.wrap(c, h.extra, w - 16, 11) : [];
    const ht = 26 + body.length * 15 + (extra.length ? 4 + extra.length * 14 : 0);
    const x = Math.max(v.L + 6, Math.min(v.W - v.R - w - 6, mx - w / 2)); let y = my - ht - 28; if (y < v.T + 6) y = my + 28;
    this.plaque(c, x, y, w, ht, { body: '#2a2820' });
    this.text(c, h.title, x + 8, y + 5, { size: 13, color: h.ripe ? '#f0d070' : C.amber });
    body.forEach((l, i) => this.text(c, l, x + 8, y + 23 + i * 15, { size: 12, color: C.cream }));
    extra.forEach((l, i) => this.text(c, l, x + 8, y + 27 + body.length * 15 + i * 14, { size: 11, color: h.ripe ? '#f0d070' : C.khaki }));
  }
  // A pointer went down on the overlay. Returns a handle (the touch layer calls its up / move) if the HUD takes it.
  mobileTap(x, y, inJoy) {
    const hit = (t) => x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h;
    const list = this.mt || [];
    for (let i = list.length - 1; i >= 0; i--) {
      const t = list[i]; if (!hit(t) || (t.world && inJoy)) continue;
      const t0 = this.time, y0 = y;
      if (t.tip) { this.tipHold = { tip: t.tip, x, y }; this.tipPin = null; return { up: () => { this.tipPin = { tip: t.tip, x, y, until: this.time + 2.5 }; this.tipHold = null; } }; }
      if (t.id === 'minimap') { this.mapHold = true; return { up: () => { this.mapHold = false; if (this.time - t0 < 0.35) this.mapOpen = !this.mapOpen; } }; }
      if (t.id === 'toast') { this.toastDrag = { card: t.card, dy: 0 }; return { move: (mx, my) => { this.toastDrag.dy = my - y0; }, up: () => { if (this.toastDrag && this.toastDrag.dy < -20) this.dismissCard(t.card); this.toastDrag = null; } }; }
      const act = {
        pause: () => this.onPause?.(), satchel: () => { this.sheet = this.sheet === 'satchel' ? null : 'satchel'; }, buffs: () => { this.buffOpen = this.buffOpen > this.time ? 0 : this.time + 3; },
        tracker: () => { this.trackerOpen = this.trackerOpen > this.time ? 0 : this.time + 3; }, dismiss: () => this.dismissCard(t.card),
        sheetClose: () => { this.sheet = null; }, sheetBg: () => { this.sheet = null; }, sheet: () => {}, mapClose: () => { this.mapOpen = false; }, mapBg: () => {},
      }[t.id];
      if (!act) continue;
      return { up: () => act() };
    }
    return null;
  }
  drawDebug(c, g, d) {
    const lines = [
      `FPS ${this.fps.toFixed(0)}  tick ${this.tickMs.toFixed(2)}ms`,
      `alive ${g.countAlive()}  cap ${T.round.activeCap(g.round) + (g.noise >= 80 ? 4 : 0)}  toSpawn ${g.toSpawn}  spawnT ${g.spawnT.toFixed(2)}`,
      `noise ${g.noise.toFixed(1)}  pressure ${g.director.pressure.toFixed(1)}  seed ${g.seed}`,
      `bag [${g.findBag.join(',')}]  finds ${g.roundFinds}/${T.finds.maxPerRound}  pity ${g.killsSinceFind}`,
      `god ${g.god ? 'ON' : 'off'}  dogRound ${g.nextDogRound}  brute ${g.nextBrute}`,
    ];
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(54, 4, 300, lines.length * 8 + 4);
    lines.forEach((l, i) => this.text(c, l, 57, 6 + i * 8, { font: NUM, weight: '400', size: 5, color: '#9ae09a', shadow: false }));
  }
}

function shadeHex(hex, amt) {
  const n = parseInt(hex.slice(1), 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  return '#' + ((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1);
}
