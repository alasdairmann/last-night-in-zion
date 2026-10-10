// Layout mode and touch switch (Mobile & Touch PRD, "Mode detection and the force setting").
// mode is 'desktop' | 'tablet' | 'mobile': from the screen size unless Settings (or ?layout=) forces one.
// touch is a separate switch: on after the first touch, off again on a key press or a real mouse move,
// unless Settings says Always / Off (or ?touch=1 forces it on). body gets .mobile / .tablet / .touch.
import { T } from './tuning.js';

const VW = T.view.w, VH = T.view.h;
const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const URL_LAYOUT = ['auto', 'desktop', 'tablet', 'mobile'].includes(params.get('layout')) ? params.get('layout') : null;
const URL_TOUCH = params.get('touch') === '1' ? 'always' : params.get('touch') === '0' ? 'off' : null;

// The automatic rule. Exported for tests.
export function autoMode(w, h, coarse) {
  const scale = Math.floor(Math.min(w / VW, h / VH));
  if (scale < 2 || Math.min(w, h) < 500) return 'mobile';
  return coarse ? 'tablet' : 'desktop';
}

export const layout = {
  mode: 'desktop', auto: 'desktop', touch: false, used: false, portrait: false, settings: null, listeners: [],
  init(settings) {
    this.settings = settings;
    const coarseQ = window.matchMedia ? window.matchMedia('(pointer: coarse)') : null;
    this.coarse = () => !!(coarseQ && coarseQ.matches);
    window.addEventListener('resize', () => this.update());
    window.addEventListener('orientationchange', () => setTimeout(() => this.update(), 50));
    // input follows the last device used
    window.addEventListener('touchstart', () => { if (!this.used) { this.used = true; this.update(); } }, { capture: true, passive: true });
    window.addEventListener('keydown', () => { if (this.used) { this.used = false; this.update(); } }, true);
    window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && this.used && (Math.abs(e.movementX) + Math.abs(e.movementY) > 0)) { this.used = false; this.update(); } }, true);
    this.update(true);
    return this;
  },
  get pref() { return URL_LAYOUT || this.settings.layout || 'auto'; },
  get touchPref() { return URL_TOUCH || this.settings.touch || 'auto'; },
  // what the Layout row shows: "auto (mobile)" when auto-detect picked
  label() { return this.pref === 'auto' ? `auto (${this.auto})` : this.pref; },
  update(force = false) {
    const w = window.innerWidth, h = window.innerHeight;
    const auto = autoMode(w, h, this.coarse());
    const mode = this.pref === 'auto' ? auto : this.pref;
    const tp = this.touchPref, touch = tp === 'always' ? true : tp === 'off' ? false : this.used;
    const portrait = h > w && (this.coarse() || touch);
    const changed = force || mode !== this.mode || touch !== this.touch || portrait !== this.portrait || auto !== this.auto;
    this.auto = auto; this.mode = mode; this.touch = touch; this.portrait = portrait;
    const b = document.body.classList;
    b.toggle('mobile', mode === 'mobile'); b.toggle('tablet', mode === 'tablet'); b.toggle('touch', touch); b.toggle('portrait', portrait);
    for (const fn of this.listeners) fn({ resized: true, changed });
  },
  on(fn) { this.listeners.push(fn); },
};
