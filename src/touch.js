// Touch controls (Mobile & Touch PRD, "Touch control scheme"). Pointer Events with one pointer per control,
// drawn on the overlay canvas in CSS pixels. TouchInput.sample() fills the same fields as Input.sample();
// main.js ORs the two, so the simulation and its replays only ever see ordinary input.
import { emptyInput, dirIndex, weaponName } from './sim/game.js';
import { iconHD } from './render/sprites.js';

const SIZE = { s: 0.85, m: 1, l: 1.2 };
const HIT = 1.2;                  // hitboxes are 20% larger than the art
const DEAD = 0.25;                // joystick dead zone (fraction of its radius); the sim's movement is digital past it
const LONG = 0.4;                 // seconds for a long-press (weapon radial)
const SWIPE = 34;                 // px along the context button for prev / next
const ASSIST = 20 * Math.PI / 180;
const NUM = 'Silkscreen, "Courier New", monospace', LBL = 'Nunito, "Trebuchet MS", sans-serif';
// what each control is, for the touch legend and the How to play diagram
export const TOUCH_ACTIONS = {
  stick: 'Move: drag anywhere on the left', attack: 'Attack: hold; tap fast to break free', shove: 'Shove (and the mask dash)',
  interact: 'Interact: the context button. Hold to buy or repair; swipe or arrows for options', throw: 'Throw what is in your pocket',
  trick: 'Trick; double-tap for your keepsake', dog: 'Biscuit: tap to send, hold to make him stay', chip: 'Weapon: tap to switch, hold for every slot; tap the ammo to reload',
  lock: 'Lock facing (holding Attack does this too)', map: 'Hold for the town map', pause: 'Pause',
};

// OR two samples together: held flags and latched presses alike; the slot and wheel come from whichever set one
export function mergeInput(a, b) {
  if (!b) return a;
  const o = { ...a };
  for (const k in b) { const v = b[k]; if (typeof v === 'boolean') o[k] = !!(a[k] || v); else if (v) o[k] = v; }
  return o;
}

export class TouchInput {
  constructor(stage, canvas, settings, layout, hooks) {
    this.stage = stage; this.cv = canvas; this.c = canvas.getContext('2d'); this.settings = settings; this.layout = layout; this.hooks = hooks;
    this.ptrs = new Map(); this.held = new Set(); this.latched = new Set(); this.slot = 0;
    this.stick = null; this.stickAng = null; this.lastAng = null; this.lock = false; this.assistCD = 0;
    this.ctl = []; this.byId = {}; this.radial = null; this.time = 0; this.pulse = new Map();
    this.safe = document.createElement('div');
    this.safe.style.cssText = 'position:fixed;inset:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(this.safe);
    const on = (t, f) => stage.addEventListener(t, f, { passive: false });
    on('pointerdown', (e) => this.down(e)); on('pointermove', (e) => this.move(e));
    on('pointerup', (e) => this.up(e)); on('pointercancel', (e) => this.up(e, true));
    window.addEventListener('blur', () => this.reset());
  }
  get visible() { return this.layout.touch; }
  live() { return this.layout.touch && this.hooks.playing(); }
  reset() { this.ptrs.clear(); this.held.clear(); this.latched.clear(); this.stick = null; this.stickAng = null; this.radial = null; }
  get U() { return SIZE[this.settings.touchSize] || 1; }

  // ---------- geometry ----------
  view() {
    const cs = getComputedStyle(this.safe), n = (k) => parseFloat(cs[k]) || 0;
    return { W: window.innerWidth, H: window.innerHeight, L: n('paddingLeft'), R: n('paddingRight'), T: n('paddingTop'), B: n('paddingBottom') };
  }
  // Rebuilt every frame from the game: four controls always, the rest only while usable (at most six on the right).
  build(g) {
    const v = this.v = this.view(), U = this.U, mir = !!this.settings.leftHanded, X = (x) => (mir ? v.W - x : x);
    const list = [], p = g.p, w = g.curWeapon();
    const ax = v.W - v.R - 80 * U, ay = v.H - v.B - 76 * U;
    list.push({ id: 'attack', x: X(ax), y: ay, r: 38 * U, icon: p.chainsawT > 0 ? 'chainsaw' : w ? w.id : null, label: w ? '' : 'HIT' });
    const arc = [{ id: 'shove', label: 'SHOVE', glyph: 'shove' }];
    if (p.throwable && p.throwable.count > 0) arc.push({ id: 'throw', icon: p.throwable.id, n: p.throwable.count });
    if (g.trick && g.trick.id) arc.push({ id: 'trick', icon: 't_' + g.trick.id, ready: g.trickReady(), charge: g.trick.charge / g.trickNeed(), keep: g.keepsake && g.keepsake.held });
    if (g.biscuit && !g.biscuit.dead) arc.push({ id: 'dog', icon: 'biscuit', down: g.biscuit.down });
    const RA = 98 * U, ang = [180, 212, 244, 272];
    arc.forEach((b, i) => { const a = ang[i] * Math.PI / 180; Object.assign(b, { x: X(ax + Math.cos(a) * RA), y: ay + Math.sin(a) * RA, r: 24 * U }); list.push(b); });
    // the context button: the prompt's own label, with prev / next arrows for a multi-option prompt
    if (g.prompt && !p.dead) {
      const pr = g.prompt, label = pr.label.length > 22 ? pr.label.slice(0, 21) + '…' : pr.label;
      this.c.font = `900 ${Math.round(15 * U)}px ${LBL}`;
      const pw = Math.max(110 * U, this.c.measureText(label).width + 30 * U), ph = 46 * U;
      const cx = X(ax - 64 * U), cy = ay - RA - 64 * U;
      list.push({ id: 'interact', rect: true, x: cx, y: cy, w: pw, h: ph, label, disabled: !!pr.disabled, afford: pr.afford, progress: pr.progress });
      if (pr.menuN > 1 || pr.choices) {
        list.push({ id: 'prev', x: cx - pw / 2 - 28 * U, y: cy, r: 22 * U, glyph: 'left' });
        list.push({ id: 'next', x: cx + pw / 2 + 28 * U, y: cy, r: 22 * U, glyph: 'right' });
      }
    }
    if (g.cellar) {
      const cx = X(ax - 64 * U), cy = ay - RA - 64 * U, pw = 150 * U;
      list.push({ id: 'interact', rect: true, x: cx, y: cy, w: pw, h: 46 * U, label: g.cellar.idx === g.cellar.dests.length ? 'Stay here' : 'Climb out' });
      list.push({ id: 'prev', x: cx - pw / 2 - 28 * U, y: cy, r: 22 * U, glyph: 'left' }, { id: 'next', x: cx + pw / 2 + 28 * U, y: cy, r: 22 * U, glyph: 'right' });
    }
    // weapon chip: tap to cycle, tap the ammo to reload, long-press for the radial
    { const cw = 140 * U, ch = 48 * U, cx = X(ax - RA - 24 * U - 14 * U - cw / 2), cy = v.H - v.B - 32 * U;
      const gun = w && w.kind === 'gun';
      list.push({ id: 'chip', rect: true, x: cx, y: cy, w: cw, h: ch, w0: w, gun, empty: gun && w.mag === 0, chainsaw: p.chainsawT > 0, mir }); }
    list.push({ id: 'lock', x: X(v.L + 34 * U), y: v.H - v.B - 34 * U, r: 22 * U, glyph: 'lock', on: this.lock });
    if (!this.hooks.minimap?.()) list.push({ id: 'pause', x: X(v.W - v.R - 34 * U), y: v.T + 30 * U, r: 22 * U, glyph: 'pause' });
    if (!this.hooks.minimap?.()) list.push({ id: 'map', x: X(v.W - v.R - 88 * U), y: v.T + 30 * U, r: 22 * U, glyph: 'map' });
    this.ctl = list; this.byId = Object.fromEntries(list.map((b) => [b.id, b]));
    this.joy = { x: X(v.L + 130 * U), y: v.H - v.B - 104 * U, R: 58 * U, zone: (x) => (mir ? x > v.W * 0.6 : x < v.W * 0.4) };
  }
  hit(x, y) {
    let best = null, bd = Infinity;
    for (const b of this.ctl) {
      if (b.rect) { if (Math.abs(x - b.x) <= b.w / 2 * HIT && Math.abs(y - b.y) <= b.h / 2 * HIT) return b; continue; }
      const d = Math.hypot(x - b.x, y - b.y); if (d <= b.r * HIT && d < bd) { bd = d; best = b; }
    }
    return best;
  }

  // ---------- pointers ----------
  down(e) {
    if (!this.live() || (e.target && e.target.closest && e.target.closest('.plaque, .tray, .rotate'))) return;
    const g = this.hooks.game(); if (!g) return;
    if (!this.ctl.length) this.build(g);
    const x = e.clientX, y = e.clientY;
    const b0 = this.hit(x, y);
    const hud = this.hooks.tap?.(x, y, !!b0); // HUD taps (top bar, satchel, cards, tooltips); world tooltips yield to controls
    if (hud) { this.ptrs.set(e.pointerId, { id: e.pointerId, ctl: 'hud', hud, x0: x, y0: y, x, y, t0: this.time, moved: 0 }); e.preventDefault(); return; }
    const b = b0;
    const ptr = { id: e.pointerId, ctl: b ? b.id : null, x0: x, y0: y, x, y, t0: this.time, moved: 0 };
    if (b) this.press(b, ptr);
    else if (this.joy && this.joy.zone(x)) { ptr.ctl = 'stick'; this.stick = { id: e.pointerId, ox: x, oy: y, x, y }; }
    else return; // let the HUD's tap tooltips have it
    this.ptrs.set(e.pointerId, ptr);
    try { this.stage.setPointerCapture(e.pointerId); } catch { /* synthetic pointers */ }
    e.preventDefault();
  }
  press(b, ptr) {
    const id = b.id;
    this.haptic(8);
    if (id === 'attack') { this.held.add('attack'); this.latched.add('attack'); }
    else if (id === 'shove' || id === 'throw' || id === 'trick' || id === 'prev' || id === 'next') this.latched.add(id);
    else if (id === 'dog' || id === 'map') this.held.add(id);
    else if (id === 'interact') { if (!b.disabled) this.held.add('interact'); }
    else if (id === 'lock') this.lock = !this.lock;
    else if (id === 'chip') ptr.chipSide = (b.mir ? b.x - ptr.x0 : ptr.x0 - b.x) > b.w * 0.08 && b.gun ? 'ammo' : 'icon';
    this.pulse.set(id, 0.12);
  }
  move(e) {
    const ptr = this.ptrs.get(e.pointerId); if (!ptr) return;
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.moved = Math.max(ptr.moved, Math.hypot(ptr.x - ptr.x0, ptr.y - ptr.y0));
    if (ptr.ctl === 'hud') { ptr.hud.move?.(ptr.x, ptr.y); e.preventDefault(); return; }
    if (ptr.ctl === 'stick' && this.stick) { this.stick.x = ptr.x; this.stick.y = ptr.y; }
    if (ptr.ctl === 'interact') { // swipe along the context button for prev / next; a swipe never buys
      const dx = ptr.x - ptr.x0;
      if (Math.abs(dx) > SWIPE * this.U) { this.latched.add(dx > 0 ? 'next' : 'prev'); ptr.x0 = ptr.x; ptr.swiped = true; this.held.delete('interact'); }
    }
    if (this.radial && this.radial.ptr === e.pointerId) this.radial.sel = this.radialPick(ptr.x, ptr.y);
    e.preventDefault();
  }
  up(e, cancel = false) {
    const ptr = this.ptrs.get(e.pointerId); if (!ptr) return;
    this.ptrs.delete(e.pointerId);
    const id = ptr.ctl;
    if (id === 'hud') { ptr.hud.up?.(); e.preventDefault(); return; }
    if (id === 'interact' && !cancel && !ptr.swiped && this.time - ptr.t0 < 0.25) this.hooks.interactTap?.();
    if (id === 'stick') this.stick = null;
    if (id === 'attack' || id === 'dog' || id === 'map' || id === 'interact') this.held.delete(id);
    if (id === 'chip' && !cancel) {
      if (this.radial && this.radial.ptr === e.pointerId) { const s = this.radial.sel; if (s != null) this.slot = s + 1; this.radial = null; }
      else if (ptr.moved < 24) { if (ptr.chipSide === 'ammo') this.latched.add('reload'); else this.cycle(); }
    }
    if (id === 'pause' && !cancel) this.hooks.pause();
    if (this.radial && this.radial.ptr === e.pointerId) this.radial = null;
    e.preventDefault();
  }
  cycle() {
    const g = this.hooks.game(); if (!g) return;
    const p = g.p, n = p.slots.length;
    for (let k = 1; k <= n; k++) { const i = (p.cur + k) % n; if (p.slots[i]) { this.slot = i + 1; return; } }
  }
  radialSlots(g) {
    const b = this.byId.chip; if (!b) return [];
    const p = g.p, n = g.hasComfort('mule') ? 4 : 3, U = this.U, out = [];
    for (let i = 0; i < n; i++) { const a = (-150 + i * (120 / Math.max(1, n - 1))) * Math.PI / 180; out.push({ i, x: b.x + Math.cos(a) * 92 * U, y: b.y - 20 * U + Math.sin(a) * 92 * U, r: 26 * U, w: p.slots[i] }); }
    return out;
  }
  radialPick(x, y) { let best = null, bd = Infinity; for (const s of this.radial.slots) { const d = Math.hypot(x - s.x, y - s.y); if (s.w && d < bd && d < s.r * 2) { bd = d; best = s.i; } } return best; }

  // ---------- per frame ----------
  update(g, dt) {
    this.time += dt;
    for (const [k, t] of this.pulse) { if (t - dt <= 0) this.pulse.delete(k); else this.pulse.set(k, t - dt); }
    if (!this.live() || !g) { if (this.ptrs.size) this.reset(); this.ctl = []; return; }
    this.build(g);
    // long-press the weapon chip: the radial
    for (const ptr of this.ptrs.values()) if (ptr.ctl === 'chip' && !this.radial && this.time - ptr.t0 >= LONG && ptr.moved < 24) { this.radial = { ptr: ptr.id, slots: this.radialSlots(g), sel: null }; this.haptic(15); }
    if (this.radial) this.radial.slots = this.radialSlots(g);
  }
  // One tick of input. Gun aim assist (touch only, PRD decision 2026-10-11): the sim faces eight ways, so the
  // assist works on the stick's analog angle. If a visible foe is within ~20° of where the player is aiming, a
  // one-tick turn puts Cain's facing on the foe's eighth (the sim's own 5° bend does the rest).
  sample(g) {
    const inp = emptyInput();
    if (!this.live() || !g) { this.latched.clear(); this.slot = 0; return inp; }
    const p = g.p;
    let mv = null;
    if (this.stick && this.joy) {
      const dx = this.stick.x - this.stick.ox, dy = this.stick.y - this.stick.oy;
      if (Math.hypot(dx, dy) > DEAD * this.joy.R) { mv = Math.atan2(dy, dx); this.lastAng = mv; }
    }
    this.stickAng = mv;
    inp.attack = this.held.has('attack') || this.latched.has('attack');
    inp.shift = this.lock || this.held.has('attack');
    inp.interact = this.held.has('interact');
    inp.map = this.held.has('map'); inp.dog = this.held.has('dog');
    for (const k of ['prev', 'next', 'reload', 'throw', 'shove', 'trick']) inp[k] = this.latched.has(k);
    inp.slot = this.slot;
    let dir = mv === null ? -1 : dirIndex(Math.cos(mv), Math.sin(mv));
    if (this.assistCD > 0) this.assistCD--;
    const w = g.curWeapon();
    if (inp.attack && !this.lock && w && w.kind === 'gun' && !p.dead && !p.downed && this.assistCD <= 0) {
      const ref = mv ?? this.lastAng ?? Math.atan2(p.fy, p.fx), foe = this.assistTarget(g, ref);
      if (foe) { const fd = dirIndex(foe.x - p.x, foe.y - p.y); if (fd !== p.face) { dir = fd; inp.shift = false; this.assistCD = 6; } }
    }
    if (dir >= 0) { const a = dir * Math.PI / 4, cx = Math.round(Math.cos(a)), cy = Math.round(Math.sin(a)); inp.right = cx > 0; inp.left = cx < 0; inp.down = cy > 0; inp.up = cy < 0; }
    this.latched.clear(); this.slot = 0;
    return inp;
  }
  assistTarget(g, ref) {
    const p = g.p, cam = this.hooks.cam?.(), VW = 480, VH = 270;
    let best = null, bd = Infinity;
    for (const e of g.enemies) {
      if (e.dead || e.ally > 0 || e.state !== 'inside') continue;
      if (cam && (e.x < cam.rx || e.x > cam.rx + VW || e.y < cam.ry || e.y > cam.ry + VH)) continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy); if (d < 6 || d > 300 || d >= bd) continue;
      let da = Math.atan2(dy, dx) - ref; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      if (Math.abs(da) > ASSIST || !g.lineClear(p.x, p.y - 4, e.x, e.y - 4)) continue;
      bd = d; best = e;
    }
    return best;
  }
  holding(id) { return this.held.has(id); }
  haptic(ms) { if (this.settings.vibrate && navigator.vibrate && this.layout.touch) try { navigator.vibrate(ms); } catch { /* not allowed */ } }

  // ---------- drawing (CSS px; the caller has set the dpr transform) ----------
  draw(c, g) {
    if (!this.live() || !g || !this.ctl.length) return;
    const base = this.settings.touchOpacity ?? 0.5, U = this.U;
    const pressed = (id) => this.pulse.has(id) || this.held.has(id) || (id === 'lock' && this.lock) || [...this.ptrs.values()].some((p) => p.ctl === id);
    // joystick: ghost ring at rest, base and knob while held
    { const j = this.joy, s = this.stick;
      const bx = s ? s.ox : j.x, by = s ? s.oy : j.y;
      c.globalAlpha = s ? Math.min(1, base + 0.3) : base * 0.6;
      ring(c, bx, by, j.R, 'rgba(18,14,10,0.35)', '#b8ae8a', 2);
      if (s) { let dx = s.x - s.ox, dy = s.y - s.oy; const d = Math.hypot(dx, dy); if (d > j.R) { dx *= j.R / d; dy *= j.R / d; } ring(c, bx + dx, by + dy, 24 * U, 'rgba(240,234,216,0.55)', '#f0ead8', 2); }
      c.globalAlpha = 1; }
    for (const b of this.ctl) {
      c.globalAlpha = pressed(b.id) ? 0.9 : base;
      if (b.id === 'chip') { this.drawChip(c, b, g); continue; }
      if (b.rect) { this.drawPill(c, b); continue; }
      const on = pressed(b.id);
      ring(c, b.x, b.y, b.r, on ? 'rgba(122,116,64,0.95)' : 'rgba(29,20,16,0.82)', b.ready ? '#f0d070' : b.down ? '#e03a2a' : '#7d7a4e', b.id === 'attack' ? 4 : 3);
      if (b.icon) icon(c, b.icon, b.x, b.y, b.id === 'attack' ? b.r * 1.15 : b.r * 1.15);
      if (b.glyph) glyph(c, b.glyph, b.x, b.y, b.r * 0.62, b.on ? '#f0b030' : '#f0ead8');
      if (b.label && !b.glyph) txt(c, b.label, b.x, b.y, Math.round(12 * U), '#f0ead8', NUM, 'middle');
      if (b.id === 'shove') { const p = g.p; c.fillStyle = '#211b14'; c.fillRect(b.x - b.r * 0.7, b.y + b.r * 0.55, b.r * 1.4, 4); c.fillStyle = p.stam >= 1 ? '#6cbf4a' : '#b8ae8a'; c.fillRect(b.x - b.r * 0.7, b.y + b.r * 0.55, b.r * 1.4 * Math.min(1, p.stam), 4); }
      if (b.n != null) badge(c, String(b.n), b.x + b.r * 0.7, b.y + b.r * 0.7, U);
      if (b.id === 'trick' && !b.ready) { c.strokeStyle = '#f0b030'; c.lineWidth = 3; c.beginPath(); c.arc(b.x, b.y, b.r - 1.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, b.charge)); c.stroke(); }
      if (b.id === 'trick' && b.keep) { c.fillStyle = '#9a80d0'; c.beginPath(); c.arc(b.x - b.r * 0.72, b.y - b.r * 0.72, 5 * U, 0, Math.PI * 2); c.fill(); }
    }
    c.globalAlpha = 1;
    if (this.radial) for (const s of this.radial.slots) {
      c.globalAlpha = s.w ? 0.95 : 0.4;
      ring(c, s.x, s.y, s.r, s.i === this.radial.sel ? 'rgba(122,116,64,0.98)' : 'rgba(29,20,16,0.92)', s.i === g.p.cur ? '#f0d070' : '#7d7a4e', 3);
      if (s.w) icon(c, s.w.id, s.x, s.y, s.r * 1.2);
      txt(c, ['MELEE', 'PRI', 'SEC', 'MULE'][s.i], s.x, s.y + s.r + 10 * U, Math.round(10 * U), '#b8ae8a', NUM, 'middle');
    }
    c.globalAlpha = 1;
  }
  drawPill(c, b) {
    const U = this.U, x0 = b.x - b.w / 2, y0 = b.y - b.h / 2;
    c.fillStyle = 'rgba(29,20,16,0.88)'; c.fillRect(x0 - 3, y0 - 3, b.w + 6, b.h + 6);
    c.fillStyle = b.disabled ? '#3a3a30' : '#5d5a32'; c.fillRect(x0, y0, b.w, b.h);
    c.fillStyle = b.disabled ? '#4a4a40' : '#7d7a4e'; c.fillRect(x0, y0, b.w, 3);
    if (b.progress > 0) { c.fillStyle = '#f0b030'; c.fillRect(x0, y0 + b.h - 5, b.w * Math.min(1, b.progress), 5); }
    txt(c, b.label, b.x, b.y, Math.round(15 * U), b.disabled ? '#b8ae8a' : b.afford === false ? '#ff8a70' : '#f0b030', LBL, 'middle', '900');
  }
  drawChip(c, b, g) {
    const U = this.U, w = b.w0, p = g.p, x0 = b.x - b.w / 2, y0 = b.y - b.h / 2;
    c.fillStyle = 'rgba(29,20,16,0.88)'; c.fillRect(x0 - 3, y0 - 3, b.w + 6, b.h + 6);
    c.fillStyle = '#5d5a32'; c.fillRect(x0, y0, b.w, b.h); c.fillStyle = '#7d7a4e'; c.fillRect(x0, y0, b.w, 3);
    const ix = b.mir ? x0 + b.w - b.h / 2 : x0 + b.h / 2, tx = b.mir ? x0 + 8 * U : x0 + b.h + 4 * U;
    if (b.chainsaw) { icon(c, 'chainsaw', ix, b.y, b.h * 0.9); txt(c, `${Math.ceil(p.chainsawT)}s`, tx, b.y, Math.round(16 * U), '#f0ead8', NUM, 'middle', '400', 'left'); return; }
    if (!w) { txt(c, 'FISTS', tx, b.y, Math.round(12 * U), '#b8ae8a', NUM, 'middle', '400', 'left'); return; }
    icon(c, w.id, ix, b.y, b.h * 0.9);
    if (b.gun) {
      const flash = b.empty && Math.floor(this.time * 4) % 2;
      if (w.id === 'blowtorch') txt(c, `${Math.round(100 * w.mag / Math.max(1, w.mag + 1))}%`, tx, b.y, Math.round(14 * U), '#f0b030', NUM, 'middle', '400', 'left');
      else { txt(c, String(w.mag), tx, b.y - 2 * U, Math.round(19 * U), flash ? '#ffffff' : w.mag ? '#f0b030' : '#e03a2a', NUM, 'middle', '400', 'left');
        c.font = `400 ${Math.round(19 * U)}px ${NUM}`; const mw = c.measureText(String(w.mag)).width;
        txt(c, `/${w.reserve}`, tx + mw + 3 * U, b.y + 2 * U, Math.round(11 * U), '#b8ae8a', NUM, 'middle', '400', 'left'); }
      if (p.reloadT > 0) txt(c, 'RELOADING', b.x, y0 - 9 * U, Math.round(10 * U), '#b8ae8a', NUM, 'middle');
      else if (b.empty) txt(c, 'TAP TO RELOAD', b.x, y0 - 9 * U, Math.round(10 * U), '#ff8a70', NUM, 'middle');
    } else txt(c, weaponName(w).toUpperCase().slice(0, 12), tx, b.y, Math.round(11 * U), '#f0ead8', NUM, 'middle', '400', 'left');
  }
}

// ---------- tiny drawing kit ----------
function ring(c, x, y, r, fill, edge, lw) {
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = fill; c.fill();
  c.lineWidth = lw + 2; c.strokeStyle = '#1d1410'; c.stroke(); c.lineWidth = lw; c.strokeStyle = edge; c.stroke();
}
function icon(c, key, x, y, size) {
  let im; try { im = iconHD(key); } catch { return; } if (!im) return;
  const s = Math.max(14, Math.floor(size / 14) * 14 || size); c.imageSmoothingEnabled = false; c.drawImage(im, Math.round(x - s / 2), Math.round(y - s / 2), s, s);
}
export function txt(c, s, x, y, size, color, font = LBL, base = 'middle', weight = '900', align = 'center') {
  c.font = `${weight} ${Math.max(10, size)}px ${font}`; c.textAlign = align; c.textBaseline = base;
  c.fillStyle = '#1d1410'; c.fillText(s, x + 1.5, y + 1.5); c.fillStyle = color; c.fillText(s, x, y);
}
function badge(c, s, x, y, U) {
  c.font = `400 ${Math.round(11 * U)}px ${NUM}`; const w = c.measureText(s).width + 8;
  c.fillStyle = '#1d1410'; c.fillRect(x - w / 2 - 1, y - 9, w + 2, 18); c.fillStyle = '#211b14'; c.fillRect(x - w / 2, y - 8, w, 16);
  txt(c, s, x, y, Math.round(11 * U), '#f0b030', NUM, 'middle', '400');
}
// Pixel glyphs drawn as small blocks (no key names anywhere on touch): shove (open hand), lock, pause, map, arrows.
const GLYPHS = {
  shove: ['..x.x.x.', '..x.x.x.', 'x.x.x.x.', 'x.xxxxx.', 'xxxxxxx.', '.xxxxxx.', '..xxxx..', '..xxxx..'],
  lock: ['..xxxx..', '.x....x.', '.x....x.', 'xxxxxxxx', 'xxx..xxx', 'xxx..xxx', 'xxxxxxxx', 'xxxxxxxx'],
  pause: ['xx...xx.', 'xx...xx.', 'xx...xx.', 'xx...xx.', 'xx...xx.', 'xx...xx.', 'xx...xx.', 'xx...xx.'],
  map: ['x..xx..x', 'xxxxxxxx', 'x.x..x.x', 'x.x..x.x', 'x.x..x.x', 'x.x..x.x', 'xxxxxxxx', 'x..xx..x'],
  left: ['....x...', '...xx...', '..xxxxxx', '.xxxxxxx', '.xxxxxxx', '..xxxxxx', '...xx...', '....x...'],
  right: ['...x....', '...xx...', 'xxxxxx..', 'xxxxxxx.', 'xxxxxxx.', 'xxxxxx..', '...xx...', '...x....'],
  attack: ['.xxxxx..', 'xxxxxxx.', 'x.x.x.x.', 'xxxxxxxx', 'xxxxxxxx', '.xxxxxxx', '.xxxxxx.', '..xxxx..'],
  reload: ['..xxxx..', '.x....xx', 'x.....xx', 'x...xxxx', 'x.......', 'x.....x.', '.x...x..', '..xxx...'],
  satchel: ['..xxxx..', '.x....x.', 'xxxxxxxx', 'x......x', 'x..xx..x', 'x......x', 'x......x', 'xxxxxxxx'],
  close: ['xx....xx', 'xxx..xxx', '.xxxxxx.', '..xxxx..', '..xxxx..', '.xxxxxx.', 'xxx..xxx', 'xx....xx'],
  back: ['...x....', '..xx....', '.xxxxxxx', 'xxxxxxxx', 'xxxxxxxx', '.xxxxxxx', '..xx....', '...x....'],
  search: ['.xxxx...', 'x....x..', 'x....x..', 'x....x..', '.xxxx...', '....xx..', '.....xx.', '......xx'],
};
export function glyph(c, key, x, y, size, color) {
  const g = GLYPHS[key]; if (!g) return;
  const px = Math.max(1, Math.floor(size / 4)), w = 8 * px, x0 = Math.round(x - w / 2), y0 = Math.round(y - w / 2);
  for (let pass = 0; pass < 2; pass++) {
    c.fillStyle = pass ? color : '#1d1410';
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) if (g[j][i] === 'x') c.fillRect(x0 + i * px + (pass ? 0 : 1), y0 + j * px + (pass ? 0 : 1), px, px);
  }
}
