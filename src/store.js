// Persists settings, personal best and tutorial flags in localStorage (PRD §26.5). No mid-run saves.
import { DEFAULT_KEYS } from './input.js';

const KEY = 'enochNights.v1';
const DEFAULTS = {
  musicVol: 0.7, sfxVol: 0.8, shake: 'full', flashing: 'full', hitStop: true, popups: true, damageNumbers: true,
  tutorial: true, colourBlind: false, godMode: false, keys: { ...DEFAULT_KEYS },
  // Mobile & Touch PRD
  layout: 'auto', touch: 'auto', touchSize: 'm', touchOpacity: 0.5, leftHanded: false, vibrate: true, mobileFx: 'reduced',
};

export const store = {
  settings: structuredClone(DEFAULTS), best: 0, tut: {}, runs: 0, rec: { escapes: 0, bestEscapeRound: 0, signalComplete: false, tapesFound: [], lastTrick: 'flare', bestScore: 0 },
  load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      this.settings = { ...structuredClone(DEFAULTS), ...(raw.settings || {}) };
      this.settings.keys = { ...DEFAULT_KEYS, ...((raw.settings || {}).keys || {}) };
      for (const a of ['up', 'down', 'left', 'right']) this.settings.keys[a] = DEFAULT_KEYS[a]; // movement is arrows only
      this.best = raw.best || 0; this.tut = raw.tut || {}; this.runs = raw.runs || 0; this.rec = { ...this.rec, ...(raw.rec || {}) };
    } catch { /* storage unavailable: defaults */ }
  },
  save() {
    try { localStorage.setItem(KEY, JSON.stringify({ settings: this.settings, best: this.best, tut: this.tut, runs: this.runs, rec: this.rec })); } catch { /* ignore */ }
  },
  // v1.1 save slot (feedback: a save button). One run, stored as a snapshot of the simulation.
  saveRun(data) { try { localStorage.setItem(KEY + '.run', data); return true; } catch { return false; } },
  loadRun() { try { return localStorage.getItem(KEY + '.run'); } catch { return null; } },
  // v1.3: an autosave at the start of every wave, kept through death so you can retry that wave
  saveAuto(data) { try { localStorage.setItem(KEY + '.auto', data); return true; } catch { return false; } },
  loadAuto() { try { return localStorage.getItem(KEY + '.auto'); } catch { return null; } },
  clearAuto() { try { localStorage.removeItem(KEY + '.auto'); } catch { /* ignore */ } },
  // the newer of the manual save and the autosave
  loadLatest() {
    const date = (raw) => { try { return JSON.parse(raw).meta.date || 0; } catch { return -1; } };
    const a = this.loadRun(), b = this.loadAuto();
    if (!a || !b) return a || b;
    return date(b) > date(a) ? b : a;
  },
  clearRun() { try { localStorage.removeItem(KEY + '.run'); } catch { /* ignore */ } },
  resetKeys() { this.settings.keys = { ...DEFAULT_KEYS }; this.save(); },
};
