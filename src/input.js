// Keyboard input (PRD §5). Uses KeyboardEvent.code so layouts don't break defaults.
// Sampled once per simulation tick; edge presses are latched until sampled.
import { emptyInput } from './sim/game.js';

export const DEFAULT_KEYS = {
  up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', // arrows only: WASD no longer moves
  attack: 'Space', lock: 'ShiftLeft', prev: 'KeyQ', next: 'KeyE', reload: 'KeyR',
  interact: 'KeyF', throw: 'KeyG', shove: 'KeyC', map: 'Tab', pause: 'Escape', trick: 'KeyX', dog: 'KeyZ', log: 'KeyT',
};
export const ACTION_NAMES = {
  attack: 'Attack', lock: 'Lock facing / strafe',
  prev: 'Previous option', next: 'Next option', reload: 'Reload', interact: 'Interact (hold)', throw: 'Throw', shove: 'Shove', map: 'Town map (hold)', pause: 'Pause',
  trick: 'Trick (double-tap: keepsake)', dog: 'Biscuit (tap / hold)', log: 'Journal',
};
const ARROWS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

// While touch is active there are no key names anywhere (Mobile & Touch PRD, global rules): keyLabel() returns the
// glyph of the touch control for that action, and touchCopy() rewrites key names in other text.
export const labels = { touch: false };
const GLYPH = { attack: '✊', interact: '☝', shove: '✋', throw: '➶', trick: '★', dog: '🐕', map: '▦', lock: '🔒', reload: '↻', prev: '◀', next: '▶', pause: '❚❚', log: '❚❚', up: '↑', down: '↓', left: '←', right: '→' };
let keysRef = null;
export function bindLabels(keys) { keysRef = keys; }
export function touchCopy(s) {
  if (!labels.touch || !s) return s;
  return String(s)
    .replace(/<kbd>X<\/kbd>/g, 'the Trick button ★').replace(/\b([Hh]old|[Pp]ress and hold|[Pp]ress) F\b/g, (m, a) => `${a} the context button`)
    .replace(/\b([Tt]ap) Z\b/g, '$1 the dog button').replace(/\bHold Z\b/g, 'Hold the dog button').replace(/\bZ: /g, 'Dog button: ')
    .replace(/\bG drops it/g, 'Throw drops it').replace(/\btap X\b/g, 'tap the Trick button').replace(/\bLeft \/ Right\b/g, 'The arrows')
    .replace(/\b1-4 switch weapons/g, 'the weapon chip switches weapons').replace(/\b1-4\b/g, 'the weapon chip').replace(/\b(Esc|ESC)\b/g, 'Back')
    .replace(/\bHover anything\b/g, 'Tap and hold anything').replace(/\bHOVER FOR DETAILS\b/g, 'TAP AND HOLD FOR DETAILS').replace(/\bthe map key\b/g, 'the minimap');
}

export function keyLabel(code) {
  if (!code) return '?';
  if (labels.touch) { const a = keysRef && Object.keys(keysRef).find((k) => keysRef[k] === code); return (a && GLYPH[a]) || (code === 'Escape' ? '❚❚' : '•'); }
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return ({ Space: 'SPACE', ShiftLeft: 'SHIFT', ShiftRight: 'SHIFT', Tab: 'TAB', Escape: 'ESC', ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', ControlLeft: 'CTRL', Enter: 'ENTER' })[code] || code;
}

export class Input {
  constructor(settings) {
    this.settings = settings;
    this.down = new Set();
    this.latched = new Set();
    this.listeners = [];
    this.enabled = true;
    window.addEventListener('keydown', (e) => this.onDown(e));
    window.addEventListener('keyup', (e) => { this.down.delete(e.code); });
    window.addEventListener('blur', () => { this.down.clear(); this.latched.clear(); });
  }
  get keys() { return this.settings.keys; }
  onKey(fn) { this.listeners.push(fn); }
  onDown(e) {
    const k = this.keys;
    const gameKeys = [k.attack, k.map, 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'];
    if (gameKeys.includes(e.code) && !(e.target && e.target.tagName === 'INPUT')) e.preventDefault();
    for (const fn of this.listeners) if (fn(e) === true) return;
    if (!e.repeat) this.latched.add(e.code);
    this.down.add(e.code);
  }
  held(action) {
    const k = this.keys[action];
    if (this.down.has(k)) return true;
    if (action === 'lock' && (this.down.has('ShiftLeft') || this.down.has('ShiftRight')) && (k === 'ShiftLeft' || k === 'ShiftRight')) return true;
    if (ARROWS[action] && this.down.has(ARROWS[action])) return true;
    return false;
  }
  pressed(action) { const k = this.keys[action]; return this.latched.has(k) || (action === 'lock' && this.latched.has('ShiftRight')); }
  // Build one tick of input for the simulation
  sample() {
    const inp = emptyInput();
    if (!this.enabled) { this.latched.clear(); return inp; }
    inp.up = this.held('up'); inp.down = this.held('down'); inp.left = this.held('left'); inp.right = this.held('right');
    inp.attack = this.held('attack') || this.latched.has(this.keys.attack);
    inp.shift = this.held('lock');
    inp.interact = this.held('interact');
    inp.map = this.held('map');
    inp.prev = this.pressed('prev'); inp.next = this.pressed('next');
    inp.reload = this.pressed('reload'); inp.throw = this.pressed('throw'); inp.shove = this.pressed('shove');
    inp.trick = this.pressed('trick'); inp.dog = this.held('dog');
    for (let i = 1; i <= 4; i++) if (this.latched.has('Digit' + i)) inp.slot = i;
    this.latched.clear();
    return inp;
  }
}
