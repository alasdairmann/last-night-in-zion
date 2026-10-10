// Audio (PRD §24): procedural Web Audio SFX with stereo panning by distance (max 400px),
// voice limits per group, and a three-layer music theme (dark / lit / pressure) crossfaded in 300ms.
const MAX_DIST = 400;
const MOODS = ['calm', 'boss', 'dogs', 'raiders', 'stand', 'pause', 'song'];

export class AudioEngine {
  constructor(settings) {
    this.settings = settings; this.ctx = null; this.listener = { x: 0, y: 0 };
    this.voices = {}; this.total = 0; this.lastScrap = 0; this.groupLast = {};
    this.musicOn = false; this.step = 0; this.nextNote = 0; this.layers = null;
    this.heartT = 0; this.stepT = 0; this.carLoops = [];
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain(); this.sfx.connect(this.master);
    this.music = this.ctx.createGain();
    this.musicFilter = this.ctx.createBiquadFilter(); this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 20000;
    this.music.connect(this.musicFilter); this.musicFilter.connect(this.master);
    const len = this.ctx.sampleRate * 2; this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.layers = {};
    // v1.1 moods: each has its own bus; all share A minor, 84 bpm and the same 4-bar root line, so they blend
    this.moods = {};
    for (const m of MOODS) { const g = this.ctx.createGain(); g.gain.value = m === 'calm' ? 1 : 0; g.connect(this.music); this.moods[m] = g; }
    for (const k of ['dark', 'lit', 'pressure', 'hold']) { const g = this.ctx.createGain(); g.gain.value = k === 'dark' ? 1 : 0; g.connect(k === 'hold' ? this.music : this.moods.calm); this.layers[k] = g; }
    this.mood = 'calm'; this.wantMood = 'calm'; this.forcedMood = null; this.pendingMood = null; this.rainGain = null;
    this.applyVolumes();
    this.engine = null;
    setInterval(() => this.schedule(), 25);
  }
  applyVolumes() {
    if (!this.ctx) return;
    this.sfx.gain.value = this.settings.sfxVol;
    this.music.gain.value = this.settings.musicVol * 0.55 * (this.ducked ? 0.35 : 1);
  }
  duck(on) { this.ducked = on; this.applyVolumes(); }
  setListener(x, y) { this.listener.x = x; this.listener.y = y; }

  // ---------- synth primitives ----------
  pos(opt) {
    if (opt.x === undefined) return { pan: 0, vol: 1 };
    const dx = opt.x - this.listener.x, dy = opt.y - this.listener.y, d = Math.hypot(dx, dy);
    return { pan: Math.max(-1, Math.min(1, dx / 240)), vol: Math.max(0, 1 - d / MAX_DIST) };
  }
  out(pan, dest) {
    const c = this.ctx;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; p.connect(dest || this.sfx); return p; }
    return dest || this.sfx;
  }
  tone(f, dur, { type = 'square', vol = 0.2, slide = null, at = 0, attack = 0.005, pan = 0, dest = null, vib = 0, lp = 0 } = {}) {
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (vib) { const l = c.createOscillator(); l.frequency.value = 6; const lg = c.createGain(); lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur); }
    if (lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; node.connect(fl); node = fl; }
    node.connect(g); g.connect(this.out(pan, dest));
    o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, { vol = 0.3, type = 'lowpass', f = 1000, q = 1, slide = null, at = 0, attack = 0.002, pan = 0, dest = null } = {}) {
    const c = this.ctx, t = c.currentTime + at;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (slide) fl.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(this.out(pan, dest));
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  voice(group, limit, dur) {
    const n = this.voices[group] || 0;
    if (n >= limit || this.total >= 32) return false;
    this.voices[group] = n + 1; this.total++;
    setTimeout(() => { this.voices[group]--; this.total--; }, dur * 1000);
    return true;
  }

  play(name, opt = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const P = this.pos(opt); if (P.vol <= 0.01) return;
    const v = (x) => x * P.vol, pan = P.pan;
    switch (name) {
      case 'swingLight': this.voice('swing', 3, 0.15) && this.noise(0.12, { vol: 0.18, type: 'bandpass', f: 1600, slide: 500, q: 2 }); break;
      case 'swingHeavy': this.voice('swing', 3, 0.2) && this.noise(0.22, { vol: 0.25, type: 'bandpass', f: 800, slide: 220, q: 2 }); break;
      // v1.1 weapon feel
      case 'swingBlade': if (!this.voice('swing', 3, 0.15)) break; this.noise(0.09, { vol: 0.2, type: 'bandpass', f: 3200, slide: 1400, q: 4 }); this.tone(2400, 0.06, { type: 'sine', vol: 0.03, slide: 1800 }); break;
      case 'swingBlunt': if (!this.voice('swing', 3, 0.2)) break; this.noise(opt.heavy ? 0.26 : 0.16, { vol: opt.heavy ? 0.3 : 0.22, type: 'bandpass', f: opt.heavy ? 520 : 900, slide: 180, q: 1.5 }); break;
      case 'swingStab': if (!this.voice('swing', 3, 0.12)) break; this.noise(0.07, { vol: 0.18, type: 'highpass', f: 1800, slide: 3000 }); break;
      case 'impactBlunt': if (!this.voice('hit', 8, 0.15)) break; this.tone(opt.heavy ? 70 : 95, 0.16, { type: 'sine', vol: v(opt.heavy ? 0.7 : 0.5), slide: 35, pan }); this.noise(0.1, { vol: v(0.35), f: 450, pan }); if (opt.heavy) this.noise(0.05, { vol: v(0.25), type: 'highpass', f: 1500, pan }); break;
      case 'impactBlade': if (!this.voice('hit', 8, 0.15)) break; this.noise(0.08, { vol: v(0.35), type: 'highpass', f: 2600, slide: 1200, pan }); this.tone(1700, 0.09, { type: 'triangle', vol: v(0.07), slide: 1300, pan }); this.noise(0.12, { vol: v(0.2), type: 'bandpass', f: 700, q: 3, at: 0.02, pan }); break;
      case 'impactChop': if (!this.voice('hit', 8, 0.15)) break; this.tone(210, 0.1, { type: 'triangle', vol: v(0.3), slide: 100, pan }); this.noise(0.09, { vol: v(0.35), f: 1300, pan }); break;
      case 'impactStab': if (!this.voice('hit', 8, 0.12)) break; this.noise(0.06, { vol: v(0.3), type: 'bandpass', f: 1200, q: 4, pan }); this.tone(320, 0.07, { type: 'sine', vol: v(0.2), slide: 140, pan }); break;
      case 'tierRing': this.tone(opt.tier >= 3 ? 1760 : 1320, 0.25, { type: 'sine', vol: v(0.05 + opt.tier * 0.02), pan }); this.tone(55, 0.18, { type: 'sine', vol: v(0.15 * opt.tier), slide: 35, pan }); break;
      case 'effect': { const e = opt.effect;
        if (e === 'burn') this.noise(0.25, { vol: v(0.15), type: 'bandpass', f: 600, slide: 1600, pan });
        else if (e === 'shock') this.noise(0.08, { vol: v(0.16), type: 'highpass', f: 5000, pan });
        else if (e === 'chill') [2600, 3300].forEach((f, i) => this.tone(f, 0.12, { type: 'sine', vol: v(0.05), at: i * 0.04, pan }));
        else if (e === 'rot') this.tone(140, 0.2, { type: 'sawtooth', vol: v(0.07), slide: 90, lp: 500, pan });
        else if (e === 'bleed') this.noise(0.1, { vol: v(0.12), type: 'bandpass', f: 400, q: 6, pan });
        break; }
      case 'hit': if (!this.voice('hit', 8, 0.1)) break; this.tone(120, 0.09, { type: 'sine', vol: v(0.45), slide: 50, pan }); this.noise(0.06, { vol: v(0.25), f: 900, pan }); break;
      case 'crit': this.noise(0.05, { vol: v(0.35), type: 'highpass', f: 2500, pan }); this.tone(180, 0.12, { type: 'square', vol: v(0.15), slide: 60, pan }); break;
      case 'armour': this.tone(900, 0.07, { type: 'triangle', vol: v(0.2), slide: 700, pan }); break;
      case 'gun': {
        const id = opt.id; if (!this.voice('gun', 6, 0.3)) break;
        if (opt.suppressed) { this.noise(0.06, { vol: 0.25, type: 'bandpass', f: 1400, q: 2 }); this.tone(160, 0.05, { type: 'sine', vol: 0.15, slide: 80 }); break; }
        if (opt.tier >= 1) this.tone(48, 0.22, { type: 'sine', vol: 0.18 + opt.tier * 0.08, slide: 28 });
        if (opt.effect) this.play('effect', { effect: opt.effect });
        if (id === 'shotgun') { this.noise(0.35, { vol: 0.7, f: 1800, slide: 200 }); this.tone(70, 0.25, { type: 'sine', vol: 0.5, slide: 30 }); this.noise(0.05, { vol: 0.15, type: 'highpass', f: 2000, at: 0.32 }); this.noise(0.05, { vol: 0.15, type: 'highpass', f: 1600, at: 0.42 }); }
        else if (id === 'dbarrel') { this.noise(0.5, { vol: 0.8, f: 1400, slide: 140 }); this.tone(55, 0.35, { type: 'sine', vol: 0.6, slide: 25 }); }
        else if (id === 'revolver') { this.noise(0.2, { vol: 0.6, f: 2000, slide: 250 }); this.tone(85, 0.18, { type: 'sine', vol: 0.5, slide: 38 }); this.noise(0.4, { vol: 0.1, f: 600, at: 0.08 }); }
        else if (id === 'pistol') { this.noise(0.1, { vol: 0.45, f: 3200, slide: 600 }); this.tone(120, 0.08, { type: 'sine', vol: 0.35, slide: 60 }); }
        else if (id === 'rifle') { this.noise(0.08, { vol: 0.5, type: 'highpass', f: 2000 }); this.noise(0.4, { vol: 0.5, f: 900, slide: 150 }); this.tone(60, 0.3, { type: 'sine', vol: 0.5, slide: 30 }); }
        else if (id === 'smg' || id === 'ar') { this.noise(0.08, { vol: 0.45, f: 2600, slide: 600 }); this.tone(100, 0.06, { type: 'sine', vol: 0.3, slide: 50 }); }
        else if (id === 'crossbow' || id === 'bow') { this.tone(320, 0.12, { type: 'triangle', vol: 0.25, slide: 160 }); this.noise(0.05, { vol: 0.15, type: 'highpass', f: 3000 }); }
        else if (id === 'nailgun') { this.tone(220, 0.05, { type: 'square', vol: 0.2, slide: 120 }); this.noise(0.04, { vol: 0.3, f: 3000 }); }
        else if (id === 'flare') { this.noise(0.5, { vol: 0.4, type: 'bandpass', f: 2000, slide: 400 }); }
        else if (id === 'blowtorch') { this.noise(0.25, { vol: 0.2, type: 'bandpass', f: 500, q: 0.7 }); }
        else { this.noise(0.16, { vol: 0.55, f: 2500, slide: 300 }); this.tone(90, 0.14, { type: 'sine', vol: 0.45, slide: 40 }); }
        break;
      }
      case 'click': this.tone(1400, 0.02, { vol: 0.12 }); break;
      case 'reload': this.tone(700, 0.03, { vol: 0.1 }); this.tone(500, 0.04, { vol: 0.1, at: 0.15 }); break;
      case 'shell': this.tone(600, 0.03, { vol: 0.08 }); break;
      case 'throw': this.noise(0.18, { vol: 0.15, type: 'bandpass', f: 900, slide: 400 }); break;
      case 'shove': this.tone(150, 0.12, { type: 'sawtooth', vol: 0.15, slide: 100, lp: 600 }); this.noise(0.08, { vol: 0.15, f: 600 }); break;
      case 'hurt': this.tone(240, 0.18, { type: 'sawtooth', vol: 0.22, slide: 110, lp: 1200 }); this.noise(0.1, { vol: 0.3, f: 600 }); break;
      case 'heart': this.tone(60, 0.12, { type: 'sine', vol: 0.5, slide: 40 }); this.tone(55, 0.12, { type: 'sine', vol: 0.35, slide: 40, at: 0.18 }); break;
      case 'groan': { if (!this.voice('groan', 6, 1)) break; const f = 70 + Math.random() * 50; this.tone(f, 0.7 + Math.random() * 0.4, { type: 'sawtooth', vol: v(0.09), slide: f * 0.8, attack: 0.15, vib: 4, lp: 500, pan }); break; }
      case 'snarl': this.voice('snarl', 4, 0.25) && this.noise(0.22, { vol: v(0.15), type: 'bandpass', f: 420, q: 3, pan }); break;
      case 'tear': if (!this.voice('tear', 4, 0.3)) break; for (let i = 0; i < 3; i++) this.noise(0.04, { vol: v(0.35), type: 'highpass', f: 1500 + i * 400, at: i * 0.05, pan }); this.tone(200, 0.08, { type: 'square', vol: v(0.08), slide: 90, pan }); break;
      case 'repair': this.tone(300, 0.05, { type: 'square', vol: 0.12, slide: 200 }); this.noise(0.04, { vol: 0.15, f: 1200, at: 0.03 }); break;
      case 'death': if (!this.voice('death', 4, 0.4)) break; this.tone(150, 0.3, { type: 'sawtooth', vol: v(0.1), slide: 50, lp: 700, pan }); this.noise(0.15, { vol: v(0.2), f: 500, pan }); break;
      case 'burst': this.noise(0.5, { vol: v(0.5), f: 500, slide: 120, pan }); this.tone(90, 0.3, { type: 'sine', vol: v(0.3), slide: 40, pan }); break;
      case 'scream': this.tone(620, 0.7, { type: 'sawtooth', vol: v(0.12), slide: 900, vib: 30, lp: 2000, pan }); break;
      case 'howl': this.tone(480, 1.3, { type: 'sine', vol: v(0.18) + 0.05, slide: 700, vib: 12, attack: 0.2 }); this.tone(460, 1.3, { type: 'sine', vol: v(0.12) + 0.03, slide: 640, vib: 10, attack: 0.25, at: 0.3 }); break;
      case 'bark': this.voice('bark', 3, 0.15) && this.tone(320, 0.08, { type: 'square', vol: v(0.15), slide: 200, lp: 1500, pan }); break;
      case 'siren': for (let i = 0; i < 4; i++) this.tone(620, 0.7, { type: 'sine', vol: 0.18, slide: 920, at: i * 0.75, attack: 0.1 }); break;
      case 'roar': this.tone(70, 0.6, { type: 'sawtooth', vol: v(0.3), slide: 50, vib: 6, lp: 600, pan }); this.noise(0.4, { vol: v(0.25), f: 400, pan }); break;
      case 'door': this.noise(0.5, { vol: 0.35, f: 400, slide: 150 }); this.tone(110, 0.4, { type: 'sawtooth', vol: 0.12, slide: 70, lp: 500 }); this.tone(800, 0.08, { type: 'triangle', vol: 0.1, at: 0.4 }); break;
      case 'pull': for (let i = 0; i < 3; i++) { this.noise(0.25, { vol: 0.3, f: 300 + i * 100, at: i * 0.45 }); this.tone(55 + i * 10, 0.2, { type: 'sawtooth', vol: 0.12, at: i * 0.45, lp: 400 }); } break;
      case 'power': this.startEngine(); for (let i = 0; i < 6; i++) this.tone(80, 0.06, { type: 'square', vol: 0.15, at: 0.3 + i * 0.3 }); break;
      case 'trap': this.tone(120, 0.6, { type: 'sawtooth', vol: 0.15, lp: 2000 }); this.noise(0.4, { vol: 0.15, type: 'highpass', f: 3000 }); break;
      case 'zap': this.voice('zap', 3, 0.1) && this.noise(0.08, { vol: v(0.2), type: 'highpass', f: 4000, pan }); break;
      case 'alarm': for (let i = 0; i < 2; i++) this.tone(i ? 700 : 950, 0.2, { type: 'square', vol: v(0.07), at: i * 0.22, pan }); break;
      case 'hiss': this.noise(0.9, { vol: v(0.25), type: 'highpass', f: 3000, pan }); break;
      case 'boom': this.noise(1.3, { vol: Math.max(0.3, v(0.9)), f: 1200, slide: 80, pan }); this.tone(60, 0.8, { type: 'sine', vol: Math.max(0.3, v(0.7)), slide: 25, pan }); break;
      case 'scrap': { const now = this.ctx.currentTime; if (now - this.lastScrap < 0.04) break; this.lastScrap = now; this.tone(500 + Math.min(900, (opt.amt || 10) * 4), 0.05, { vol: 0.06, type: 'square' }); break; }
      case 'buy': [1200, 1520, 1800].forEach((f, i) => this.tone(f, 0.18, { type: 'triangle', vol: 0.12, at: i * 0.03 })); this.noise(0.1, { vol: 0.15, type: 'highpass', f: 4000 }); break;
      case 'fail': this.tone(90, 0.18, { type: 'square', vol: 0.15, lp: 600 }); break;
      case 'chime': this.tone(880, 0.35, { type: 'sine', vol: v(0.15) + 0.03 }); this.tone(1320, 0.4, { type: 'sine', vol: v(0.12) + 0.02, at: 0.08 }); break;
      case 'pickup': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.15, { type: 'square', vol: 0.09, at: i * 0.06 })); break;
      case 'curse': [400, 300, 220].forEach((f, i) => this.tone(f, 0.2, { type: 'sawtooth', vol: 0.1, at: i * 0.12, lp: 900 })); break;
      case 'lid': this.noise(0.15, { vol: 0.25, f: 500 }); this.tone(150, 0.1, { type: 'square', vol: 0.1 }); break;
      case 'tick': this.tone(1500, 0.02, { vol: 0.06 }); break;
      case 'land': this.tone(660, 0.25, { type: 'triangle', vol: 0.15 }); this.tone(990, 0.3, { type: 'triangle', vol: 0.12, at: 0.08 }); break;
      case 'closed': [659, 587, 523, 440, 392].forEach((f, i) => this.tone(f, 0.22, { type: 'square', vol: 0.08, at: i * 0.18 })); break;
      case 'whoosh': this.noise(0.8, { vol: 0.2, type: 'bandpass', f: 400, slide: 2000 }); break;
      case 'jingle': { const seed = [...(opt.id || 'x')].reduce((a, ch) => a + ch.charCodeAt(0), 0); const sc = [0, 3, 5, 7, 10, 12]; for (let i = 0; i < 8; i++) this.tone(330 * Math.pow(2, sc[(seed * (i + 3)) % 6] / 12), 0.14, { type: 'square', vol: v(0.07), at: i * 0.13, pan }); break; }
      case 'drink': this.noise(0.6, { vol: 0.12, type: 'bandpass', f: 600, q: 4 }); this.tone(200, 0.3, { type: 'sine', vol: 0.08, at: 0.3, slide: 260 }); break;
      case 'grind': for (let i = 0; i < 8; i++) this.noise(0.35, { vol: v(0.12), type: 'bandpass', f: 2800 + Math.random() * 800, q: 3, at: i * 0.45, pan }); for (let i = 0; i < 5; i++) this.tone(900, 0.06, { type: 'triangle', vol: v(0.12), at: 0.3 + i * 0.7, pan }); break;
      case 'ding': this.tone(1320, 0.8, { type: 'sine', vol: 0.15 }); this.tone(1980, 0.6, { type: 'sine', vol: 0.06 }); break;
      case 'bell': this.bell(opt.n || 1); break;
      case 'sting': [440, 392, 349, 330, 262].forEach((f, i) => this.tone(f, 0.4, { type: 'triangle', vol: 0.12, at: i * 0.18 })); break;
      case 'bigSting': [440, 523, 659, 587, 523, 440, 330, 220].forEach((f, i) => this.tone(f, 0.45, { type: 'square', vol: 0.08, at: i * 0.2 })); break;
      case 'down': this.tone(300, 0.6, { type: 'sawtooth', vol: 0.2, slide: 80, lp: 900 }); break;
      case 'revive': [262, 330, 392, 523].forEach((f, i) => this.tone(f, 0.2, { type: 'triangle', vol: 0.15, at: i * 0.08 })); break;
      case 'gameover': this.tone(220, 3, { type: 'triangle', vol: 0.2, attack: 0.05 }); this.tone(110, 3, { type: 'sine', vol: 0.2 }); break;
      case 'step': this.noise(0.04, { vol: 0.05, f: 700 }); break;
      case 'brick': this.tone(140, 0.08, { type: 'square', vol: v(0.15), slide: 80, pan }); this.noise(0.06, { vol: v(0.2), f: 1500, pan }); break;
      case 'glass': this.noise(0.25, { vol: v(0.3), type: 'highpass', f: 3500, pan }); break;
      case 'chainsaw': this.tone(110, 0.9, { type: 'sawtooth', vol: 0.12, vib: 20, lp: 1800 }); break;
      case 'ring': this.tone(1800, 0.08, { type: 'square', vol: v(0.08), pan }); break;
      case 'blip': this.tone(opt.sig ? 660 + Math.random() * 80 : 1100 + Math.random() * 120, 0.03, { type: 'square', vol: 0.05, lp: opt.sig ? 1200 : 3000, at: opt.at || 0 }); if (opt.sig) this.noise(0.04, { vol: 0.03, type: 'bandpass', f: 2000, at: opt.at || 0 }); break;
      case 'squelch': this.noise(0.12, { vol: 0.12, type: 'bandpass', f: 1800, q: 2 }); this.tone(1400, 0.05, { vol: 0.05 }); break;
      case 'woof': if (!this.voice('woof', 2, 0.25)) break; this.tone(420, 0.07, { type: 'square', vol: v(0.14), slide: 260, lp: 1600, pan }); this.tone(380, 0.08, { type: 'square', vol: v(0.12), slide: 240, lp: 1600, at: 0.12, pan }); break;
      case 'whimper': this.tone(900, 0.4, { type: 'sine', vol: v(0.08), slide: 600, vib: 15, pan }); break;
      case 'yip': [700, 950].forEach((f, i) => this.tone(f, 0.08, { type: 'square', vol: 0.1, slide: f * 1.3, lp: 2000, at: i * 0.1 })); break;
      case 'bite': this.voice('bite', 3, 0.1) && this.noise(0.05, { vol: v(0.2), type: 'bandpass', f: 900, q: 3, pan }); break;
      case 'growl': this.tone(110, 0.5, { type: 'sawtooth', vol: v(0.08), vib: 18, lp: 500, pan }); break;
      case 'padHit': this.tone(110, 0.08, { type: 'sine', vol: 0.3, slide: 70 }); this.noise(0.06, { vol: 0.2, f: 300 }); break;
      case 'padBreak': this.noise(0.25, { vol: 0.35, type: 'bandpass', f: 1500, slide: 3000, q: 1 }); break;
      case 'tape': for (let i = 0; i < 4; i++) this.noise(0.08, { vol: 0.12, type: 'highpass', f: 2500, at: i * 0.1 }); break;
      case 'chimeReady': [880, 1320, 1760].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', vol: 0.09, at: i * 0.07 })); break;
      case 'trick': {
        const id = opt.id;
        if (id === 'flare') { this.noise(1.2, { vol: 0.3, type: 'bandpass', f: 2500, q: 0.8 }); this.tone(200, 0.3, { type: 'sawtooth', vol: 0.1, slide: 600, lp: 1500 }); }
        else if (id === 'mist') { this.tone(80, 0.6, { type: 'sawtooth', vol: 0.25, slide: 160, lp: 900 }); this.heart = 1; }
        else if (id === 'smoke') this.noise(1.4, { vol: 0.3, type: 'lowpass', f: 1200, slide: 300 });
        else if (id === 'whistle') { this.tone(2400, 0.5, { type: 'sine', vol: 0.18, slide: 2900, vib: 30 }); }
        else if (id === 'stand') { this.tone(196, 0.5, { type: 'triangle', vol: 0.15 }); this.tone(294, 0.6, { type: 'triangle', vol: 0.12, at: 0.15 }); this.noise(0.1, { vol: 0.2, f: 400 }); }
        break; }
      case 'thunder': { const d = Math.random(); this.noise(2 + d, { vol: 0.5, f: 300 + d * 200, slide: 60, attack: 0.05 + d * 0.3 }); this.tone(40, 1.5, { type: 'sine', vol: 0.3, slide: 25, attack: 0.1 }); break; }
      case 'screamBig': this.tone(700, 1.0, { type: 'sawtooth', vol: v(0.18) + 0.05, slide: 1300, vib: 40, lp: 3000, pan }); this.tone(520, 1.0, { type: 'square', vol: v(0.06), slide: 980, vib: 30, lp: 2000, pan }); break;
      case 'screamWind': this.tone(300, 1.0, { type: 'sawtooth', vol: v(0.1), slide: 700, lp: 1500, pan }); break;
      case 'hazmat': this.noise(0.8, { vol: v(0.4), f: 700, slide: 150, pan }); this.tone(60, 0.4, { type: 'sine', vol: v(0.2), pan }); break;
      case 'grab': this.tone(60, 0.5, { type: 'sawtooth', vol: 0.35, slide: 40, lp: 600 }); this.noise(0.3, { vol: 0.35, f: 500 }); break;
      case 'grabWarn': this.tone(90, 0.6, { type: 'sawtooth', vol: v(0.25), slide: 140, vib: 8, lp: 700, pan }); break;
      case 'raiderShot': { if (!this.voice('rshot', 4, 0.2)) break; const sg = opt.role === 'shotgunner', cap = opt.role === 'captain'; this.noise(sg ? 0.3 : cap ? 0.35 : 0.14, { vol: v(sg ? 0.5 : 0.4) + 0.05, f: cap ? 1200 : 2400, slide: 300, pan }); this.tone(cap ? 60 : 100, 0.12, { type: 'sine', vol: v(0.3), slide: 50, pan }); break; }
      case 'laser': this.tone(3000, 0.6, { type: 'sine', vol: 0.04 }); break;
      case 'engineRev': for (let i = 0; i < 3; i++) this.tone(60 + i * 20, 0.6, { type: 'sawtooth', vol: 0.12, slide: 140 + i * 30, lp: 700, at: i * 0.5 }); break;
      case 'engineCough': [0, 0.25, 0.5].forEach((a) => { this.noise(0.15, { vol: v(0.3) + 0.1, f: 400, at: a }); this.tone(50, 0.12, { type: 'sawtooth', vol: 0.15, lp: 400, at: a }); }); break;
      case 'engineStart': this.tone(40, 2.5, { type: 'sawtooth', vol: 0.25, slide: 90, lp: 600, attack: 0.3 }); for (let i = 0; i < 6; i++) this.tone(i % 2 ? 700 : 950, 0.4, { type: 'square', vol: 0.06, at: 1 + i * 0.4 }); break;
      case 'jukebox': [523, 659, 784, 659, 523, 440, 523].forEach((f, i) => this.tone(f, 0.18, { type: 'square', vol: 0.07, lp: 2000, at: i * 0.14 })); this.tone(1200, 0.05, { vol: 0.1, at: 1.1 }); this.noise(0.08, { vol: 0.1, f: 3000, at: 1.15 }); break;
      case 'coin': this.tone(1600, 0.08, { type: 'square', vol: 0.08 }); this.tone(2400, 0.15, { type: 'square', vol: 0.06, at: 0.06 }); break;
      case 'accept': [392, 523, 659].forEach((f, i) => this.tone(f, 0.15, { type: 'triangle', vol: 0.12, at: i * 0.07 })); break;
      case 'stepDone': [659, 784].forEach((f, i) => this.tone(f, 0.15, { type: 'triangle', vol: 0.1, at: i * 0.08 })); break;
      case 'fanfare': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone(f, i === 5 ? 0.5 : 0.14, { type: 'square', vol: 0.08, at: i * 0.11 })); break;
      case 'failSting': [392, 370, 349, 262].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.12, at: i * 0.15 })); break;
      case 'turned': [220, 233, 196].forEach((f, i) => this.tone(f, 0.6, { type: 'sawtooth', vol: 0.08, lp: 700, at: i * 0.25 })); break;
      case 'squeak': this.tone(1500, 0.12, { type: 'sine', vol: 0.12, slide: 2200 }); this.tone(1800, 0.1, { type: 'sine', vol: 0.1, slide: 1300, at: 0.12 }); break;
      case 'knock': for (let i = 0; i < 3; i++) this.tone(110, 0.07, { type: 'square', vol: v(0.25), lp: 500, at: i * 0.2, pan }); break;
      case 'jam': this.tone(300, 0.05, { type: 'square', vol: 0.12 }); this.noise(0.08, { vol: 0.15, type: 'highpass', f: 2500, at: 0.05 }); break;
      case 'reloaded': this.tone(opt.big ? 400 : 900, 0.04, { type: 'square', vol: 0.1 }); this.noise(0.03, { vol: 0.08, type: 'highpass', f: 3000, at: 0.03 }); break;
      case 'plane': this.tone(90, 4, { type: 'sawtooth', vol: 0.06, vib: 3, lp: 400, attack: 1.5 }); break;
      case 'heli': this.noise(3, { vol: 0.2, type: 'bandpass', f: 120, q: 5, attack: 1 }); break;
    }
  }
  playMoods(s, at) {
    const M = this.moods; if (!M) return;
    const bar = Math.floor(s / 16), b = s % 16, roots = [0, -4, 3, -5];
    const f = (semi, base = 220) => base * Math.pow(2, semi / 12);
    const on = (m) => m === this.mood || M[m].gain.value > 0.01;
    const LEAD = [[0, null, null, 3, null, null, 7, null, 5, null, null, 3, null, 2, null, null], [0, null, null, null, -2, null, 0, null, 3, null, 2, null, 0, null, null, null], [7, null, null, 10, null, null, 12, null, 10, null, 7, null, 5, null, null, null], [4, null, null, 2, null, null, -1, null, 2, null, null, null, -1, null, null, null]];
    if (on('boss')) { // heavy pulse and brass stabs
      if (b % 4 === 0) { this.tone(f(roots[bar], 55), 0.35, { type: 'sawtooth', vol: 0.16, lp: 300, dest: M.boss, at }); this.tone(60, 0.2, { type: 'sine', vol: 0.4, slide: 30, dest: M.boss, at }); }
      if (b === 0 || b === 6 || b === 10) for (const k of [0, 3, 6]) this.tone(f(roots[bar] + k, 110), 0.25, { type: 'square', vol: 0.035, lp: 1200, dest: M.boss, at });
      if (b === 14) this.noise(0.25, { vol: 0.12, f: 300, dest: M.boss, at });
    }
    if (on('dogs')) { // skittering hats, a tense minor-second pad, a howl
      this.noise(0.03, { vol: 0.05, type: 'highpass', f: 7000, dest: M.dogs, at });
      if (b === 0) { this.tone(f(roots[bar], 220), 2.7, { type: 'triangle', vol: 0.05, vib: 6, dest: M.dogs, at }); this.tone(f(roots[bar] + 1, 220), 2.7, { type: 'triangle', vol: 0.04, vib: 7, dest: M.dogs, at }); }
      if (b === 8 && bar % 2) this.tone(f(roots[bar] + 12, 440), 1.2, { type: 'sine', vol: 0.03, slide: f(roots[bar] + 7, 440), dest: M.dogs, at });
      if (b % 4 === 0) this.tone(f(roots[bar], 55), 0.15, { type: 'square', vol: 0.06, lp: 400, dest: M.dogs, at });
    }
    if (on('raiders')) { // a march: snare rolls, dorian brass
      if (b === 4 || b === 12) this.noise(0.12, { vol: 0.16, type: 'bandpass', f: 1800, q: 1, dest: M.raiders, at });
      if (b === 14 || b === 15) this.noise(0.06, { vol: 0.08, type: 'bandpass', f: 1800, dest: M.raiders, at });
      if ([0, 3, 8, 11].includes(b)) this.tone(f(roots[bar], 55), 0.2, { type: 'square', vol: 0.1, lp: 500, dest: M.raiders, at });
      const n = LEAD[bar][b]; if (n !== null) this.tone(f(n + (n === 5 ? 1 : 0), 220), 0.35, { type: 'sawtooth', vol: 0.03, lp: 1400, dest: M.raiders, at });
    }
    if (on('stand') || on('song')) { // the town theme, full band (fast for the last stand)
      for (const m of ['stand', 'song']) {
        if (!on(m)) continue;
        const fast = m === 'stand';
        if (b % (fast ? 4 : 8) === 0) this.tone(60, 0.15, { type: 'sine', vol: 0.4, slide: 30, dest: M[m], at });
        if (b === 4 || b === 12) this.noise(0.1, { vol: 0.14, f: 2200, dest: M[m], at });
        if (fast || b % 2 === 0) this.noise(0.025, { vol: 0.05, type: 'highpass', f: 7000, dest: M[m], at });
        if (b % 2 === 0) this.tone(f(roots[bar] + (b % 4 === 2 ? 12 : 0), 55), 0.15, { type: 'square', vol: 0.08, lp: 600, dest: M[m], at });
        const n = LEAD[bar][b]; if (n !== null) { this.tone(f(n), 0.45, { type: 'square', vol: 0.06, lp: 2400, dest: M[m], at }); this.tone(f(n, 440), 0.3, { type: 'sawtooth', vol: 0.02, lp: 2400, dest: M[m], at }); }
        if (b === 0) for (const k of [0, 3, 7]) this.tone(f(roots[bar] + k), 2.6, { type: 'sawtooth', vol: 0.025, attack: 0.3, lp: 1200, dest: M[m], at });
      }
    }
    if (on('pause')) { // a music box playing the root chord
      if (b % 2 === 0) { const arp = [0, 3, 7, 12, 7, 3, 0, 3]; this.tone(f(roots[bar] + arp[(b / 2) % 8], 880), 0.6, { type: 'triangle', vol: 0.05, dest: M.pause, at }); }
      if (b === 0) this.tone(f(roots[bar], 110), 2.6, { type: 'sine', vol: 0.08, attack: 0.4, dest: M.pause, at });
    }
  }
  bell(n) {
    for (let i = 0; i < n; i++) {
      const at = i * 1.1, long = n === 1;
      for (const [m, vol] of [[1, 0.2], [2, 0.08], [2.4, 0.06], [3, 0.04], [0.5, 0.1]]) this.tone(196 * m, long ? 3 : 1.6, { type: 'sine', vol, at, attack: 0.003 });
    }
  }
  startEngine() {
    if (this.engine || !this.ctx) return;
    const c = this.ctx, o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 42;
    const lfo = c.createOscillator(); lfo.frequency.value = 9; const lg = c.createGain(); lg.gain.value = 0.02; lfo.connect(lg);
    const g = c.createGain(); g.gain.value = 0; lg.connect(g.gain);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
    o.connect(f); f.connect(g); this.engineGain = g; g.connect(this.sfx); o.start(); lfo.start();
    this.engine = o;
  }
  setEngine(vol) { if (this.engineGain) this.engineGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.2); }
  stopEngine() { if (this.engine) { this.engine.stop(); this.engine = null; this.engineGain = null; } }

  // ---------- events ----------
  consume(g, ev) {
    if (!this.ctx) return;
    const at = { x: ev.x, y: ev.y };
    switch (ev.type) {
      case 'swing': this.play(ev.feel === 'blade' || ev.feel === 'chop' ? 'swingBlade' : ev.feel === 'stab' ? 'swingStab' : 'swingBlunt', { heavy: ev.cls === 'heavy' }); break;
      case 'meleeHit': this.play({ blunt: 'impactBlunt', blade: 'impactBlade', chop: 'impactChop', stab: 'impactStab' }[ev.feel] || 'hit', { ...at, heavy: ev.heavy }); if (ev.tier >= 1) this.play('tierRing', { ...at, tier: ev.tier }); if (ev.effect) this.play('effect', { ...at, effect: ev.effect }); break;
      case 'hit': if (ev.armour) this.play('armour', at); else if (!this.lastMeleeHit || this.ctx.currentTime - this.lastMeleeHit > 0.05) this.play('hit', at); if (ev.crit || ev.head) this.play('crit', at); break;
      case 'kill': this.play('death', at); break;
      case 'shot': this.play('gun', { id: ev.id, tier: ev.tier, effect: ev.effect, suppressed: ev.suppressed }); break;
      case 'reloaded': this.play('reloaded', { big: ev.id === 'shotgun' || ev.id === 'rifle' || ev.id === 'ar' }); break;
      case 'radio': { this.play('squelch'); const words = ev.text.split(' ').length; for (let i = 0; i < Math.min(40, words); i++) this.play('blip', { sig: ev.who === 'Signal', at: 0.15 + i * (1 / 5.5) }); break; }
      case 'woof': this.play('woof', at); break;
      case 'whimper': case 'biscuitDied': this.play('whimper', at); break;
      case 'biscuitUp': case 'biscuitJoin': this.play('yip'); break;
      case 'bite': this.play('bite', at); break;
      case 'padHit': this.play('padHit'); break;
      case 'padBreak': this.play('padBreak'); break;
      case 'padRepair': case 'padding': this.play('repair'); break;
      case 'pubShut': case 'pubOpen': case 'hatch': this.play('repair', at); this.play('hit', at); break;
      case 'trickReady': this.play('chimeReady'); break;
      case 'trick': this.play('trick', { id: ev.id }); break;
      case 'lightning': setTimeout(() => this.play('thunder'), 200 + Math.random() * 900); break;
      case 'scream': if (ev.big) this.play('screamBig', at); else this.play('scream', at); break;
      case 'screamWind': this.play('screamWind', at); break;
      case 'grab': this.play('grab'); break;
      case 'grabWarn': this.play('grabWarn', at); break;
      case 'raiderShot': this.play('raiderShot', { ...at, role: ev.role }); break;
      case 'laser': this.play('laser'); break;
      case 'raidWarn': this.play('engineRev'); break;
      case 'engineCough': this.play('engineCough', at); break;
      case 'engineStart': case 'drive': this.play('engineStart'); this.play('siren'); break;
      case 'jukebox': this.play('coin'); this.play('jukebox'); break;
      case 'keepsake': this.play('pickup'); break;
      case 'errandAccept': this.play('accept'); break;
      case 'stepDone': case 'pickupItem': case 'beaconLit': this.play('stepDone'); break;
      case 'errandDone': case 'trialDone': case 'escapeUnlocked': this.play('fanfare'); break;
      case 'errandFail': case 'survivorDied': this.play('failSting'); break;
      case 'survivorTurned': this.play('turned'); break;
      case 'squeak': this.play('squeak'); break;
      case 'tape': this.play('tape'); break;
      case 'knocking': this.play('knock', at); break;
      case 'barking': this.play('woof', at); break;
      case 'jam': this.play('jam'); break;
      case 'supplyDrop': this.play('plane'); break;
      case 'heliIncoming': this.play('heli'); setTimeout(() => this.play('boom'), 3000); break;
      case 'busCrash': this.play('boom'); this.play('glass'); break;
      case 'choice': this.play('tick'); break;
      case 'parts': this.play('pickup'); break;
      case 'slam': this.play('impactBlunt', { heavy: true }); break;
      case 'holdBroken': this.play('fail'); break;
      case 'chargeReady': this.play('ding'); break;
      case 'survivorShot': this.voice('rshot', 4, 0.15) && this.tone(180, 0.08, { type: 'square', vol: 0.08, slide: 90, lp: 1400 }); break;
      case 'pipeBeep': this.play('ring', at); break;
      case 'flame': this.play('gun', { id: 'blowtorch' }); break;
      case 'burst': if (ev.hazmat) this.play('hazmat', at); break;
      case 'click': this.play('click'); break;
      case 'reload': this.play('reload'); break;
      case 'shell': this.play('shell'); break;
      case 'throw': this.play('throw'); break;
      case 'brickHit': case 'brickLand': this.play('brick', at); break;
      case 'molotov': this.play('glass', at); break;
      case 'shove': this.play('shove'); break;
      case 'chargeStart': this.tone(220, 0.25, { type: 'triangle', vol: 0.08, slide: 440 }); break;
      case 'powerAttack': this.play('shove'); this.noise(0.22, { vol: 0.3, type: 'bandpass', f: 700, slide: 200 }); break;
      case 'hurt': this.play('hurt'); break;
      case 'groan': this.play(ev.type === 'dog' ? 'bark' : 'groan', at); break;
      case 'windup': this.play(ev.type === 'dog' ? 'bark' : 'snarl', at); break;
      case 'plankTear': this.play('tear', at); break;
      case 'barricadeSmash': this.play('tear', at); this.play('roar', at); break;
      case 'plankRepair': this.play('repair'); break;
      case 'burst': this.play('burst', at); break;
      case 'scream': this.play('scream', at); break;
      case 'dogWarn': this.play('howl', at); break;
      case 'bruteWarn': this.play('siren'); break;
      case 'bruteCharge': this.play('roar', at); break;
      case 'doorOpen': this.play('door'); break;
      case 'power': this.play('power'); break;
      case 'tock': this.play('repair'); break;
      case 'trapOn': if (ev.auto) this.play('zap', at); else this.play('trap'); if (ev.kind === 'bell') this.play('bell', { n: 3 }); break;
      case 'bell': this.play('bell', { n: 1 }); break;
      case 'zap': this.play('zap', at); break;
      case 'carAlarm': case 'carAlarmTick': this.play('alarm', at); break;
      case 'ring': this.play('ring', at); break;
      case 'hiss': this.play('hiss', at); break;
      case 'explosion': this.play('boom', at); break;
      case 'nuke': this.play('boom'); break;
      case 'scrap': this.play('scrap', { amt: ev.amt }); break;
      case 'purchase': this.play('buy'); break;
      case 'fail': this.play('fail'); break;
      case 'findSpawn': this.play('chime', at); break;
      case 'findPickup': this.play(ev.curse ? 'curse' : 'pickup'); break;
      case 'crateOpen': this.play('lid'); for (let i = 0; i < 10; i++) this.tone(1500, 0.02, { vol: 0.05, at: Math.pow(i / 10, 1.6) * 4 }); break;
      case 'crateLand': this.play('land'); break;
      case 'crateClosed': this.play('closed'); break;
      case 'crateMoved': this.play('whoosh'); break;
      case 'comfort': this.play('drink'); this.play('jingle', { id: ev.id }); break;
      case 'workshopStart': this.play('grind', at); break;
      case 'workshopDone': this.play('ding'); break;
      case 'roundStart': this.play('bell', { n: ev.round <= 5 ? ev.round : 1 }); if (ev.dog) this.play('howl'); break;
      case 'roundEnd': this.play(ev.round % 10 === 0 ? 'bigSting' : 'sting'); break;
      case 'down': this.play('down'); break;
      case 'revive': this.play('revive'); break;
      case 'death': this.play('gameover'); break;
      case 'chainsaw': this.play('chainsaw'); break;
      case 'equip': this.play('reload'); break;
      case 'ammo': this.play('reload'); break;
    }
  }
  // per-frame ambience: heartbeat, footsteps, comfort jingles, engine
  update(g, dt) {
    if (!this.ctx) return;
    const p = g.p;
    this.setListener(p.x, p.y);
    if (!p.dead && p.hp <= p.maxHp * 0.34) { this.heartT -= dt; if (this.heartT <= 0) { this.heartT = 0.9; this.play('heart'); } }
    const bk = g.biscuitDanger ? g.biscuitDanger() : 0;
    if (g.biscuit && g.biscuit.down && !g.biscuit.dead) { this.dogT = (this.dogT ?? 0) - dt; if (this.dogT <= 0) { this.dogT = 1.6 - 1.2 * bk; this.play('whimper', { x: g.biscuit.x, y: g.biscuit.y }); } } else this.dogT = 0;
    if (p.walking) { this.stepT -= dt; if (this.stepT <= 0) { this.stepT = 0.32; this.play('step'); } }
    this.jingleT = (this.jingleT || 0) - dt;
    if (this.jingleT <= 0) {
      this.jingleT = 60;
      for (const s of g.map.comfortSpots) if (Math.hypot(s.px - p.x, s.py - p.y) < 120 && Math.random() < 0.3) { this.play('jingle', { id: s.id, x: s.px, y: s.py }); break; }
    }
    if (this.engine) this.setEngine(Math.max(0, 1 - Math.hypot(g.map.generator.px - p.x, g.map.generator.py - p.y) / 300) * 0.25 + 0.02);
    // v1.1 music moods (boss, dogs, raiders, last stand, the secret song)
    if (this.moods) {
      let want = 'calm';
      if (g.state === 'laststand' || g.state === 'escaped') want = 'stand';
      else if (g.enemies.some((e) => !e.dead && (e.type === 'brute' || e.type === 'butcher'))) want = 'boss';
      else if (g.raidRound) want = 'raiders';
      else if (g.dogRound && g.state === 'active') want = 'dogs';
      else if (g.songActive && g.songActive()) want = 'song';
      this.wantMood = want;
      if (g.event && g.event.kind === 'quiet') this.music.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.3);
      else this.applyVolumes();
      const wet = g.weather === 'rain' || g.weather === 'storm';
      this.musicFilter.frequency.setTargetAtTime(wet ? 1100 : 20000, this.ctx.currentTime, 0.5);
      if (wet && !this.rainGain) { const c = this.ctx, src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500; const gn = c.createGain(); gn.gain.value = 0; src.connect(f); f.connect(gn); gn.connect(this.sfx); src.start(); this.rainGain = gn; this.rainSrc = src; }
      if (this.rainGain) this.rainGain.gain.setTargetAtTime(wet ? (g.weather === 'storm' ? 0.08 : 0.05) : 0, this.ctx.currentTime, 0.8);
      this.holding = g.errands && g.errands.some((er) => { const st = er.def.steps[er.step]; return st && st.type === 'hold'; }) || (g.signal && g.signal.holding);
      this.layers.hold.gain.setTargetAtTime(this.holding ? 1 : 0, this.ctx.currentTime, 0.3);
    }
    // music layers
    if (this.layers) {
      const near = g.enemies.filter((e) => Math.hypot(e.x - p.x, e.y - p.y) < 160).length;
      const pressure = near >= 15 || g.enemies.some((e) => e.type === 'brute') || g.noise >= 80;
      const t = this.ctx.currentTime;
      this.layers.lit.gain.setTargetAtTime(g.power ? 1 : 0, t, 0.1);
      this.layers.pressure.gain.setTargetAtTime(pressure && !p.dead ? 1 : 0, t, 0.1);
      this.layers.dark.gain.setTargetAtTime(p.dead ? 0 : 1, t, 0.1);
    }
  }
  startMusic() { if (!this.ctx) return; this.musicOn = true; this.nextNote = this.ctx.currentTime + 0.1; this.step = 0; }
  setMood(m) { this.forcedMood = m; }
  // crossfade at a bar line (or the next beat for the pause menu), holding the shared root as a bridge note
  moodSwitch(at) {
    const target = this.forcedMood || this.wantMood;
    if (!this.moods || target === this.mood) return;
    const t = this.ctx.currentTime + at, quick = target === 'pause' || this.mood === 'pause';
    const bar = Math.floor(this.step / 16) % 4, root = [0, -4, 3, -5][bar];
    this.moods[this.mood].gain.setTargetAtTime(0.0001, t, quick ? 0.15 : 0.6);
    this.moods[target].gain.setTargetAtTime(1, t, quick ? 0.1 : 0.35);
    const f = 220 * Math.pow(2, root / 12);
    this.tone(f, quick ? 1.2 : 2.6, { type: 'triangle', vol: 0.08, attack: 0.05, dest: this.music, at });
    this.tone(f / 2, quick ? 1.2 : 2.6, { type: 'sine', vol: 0.1, attack: 0.05, dest: this.music, at });
    this.mood = target;
  }
  stopMusic() { this.musicOn = false; }

  // GBA-style sequencer: A minor, 84 bpm, 16 steps per bar, 4 bars
  schedule() {
    if (!this.musicOn || !this.ctx || this.ctx.state !== 'running') return;
    const spb = 60 / 84 / 4;
    while (this.nextNote < this.ctx.currentTime + 0.12) {
      const at = this.nextNote - this.ctx.currentTime;
      const target = this.forcedMood || this.wantMood;
      if (target !== this.mood && (this.step % 16 === 0 || ((target === 'pause' || this.mood === 'pause') && this.step % 4 === 0))) this.moodSwitch(at);
      this.playStep(this.step, at); this.playMoods(this.step, at);
      this.nextNote += spb; this.step = (this.step + 1) % 64;
    }
  }
  playStep(s, at) {
    const bar = Math.floor(s / 16), b = s % 16;
    const roots = [0, -4, 3, -5];
    const LEAD = [
      [0, null, null, 3, null, null, 7, null, 5, null, null, 3, null, 2, null, null],
      [0, null, null, null, -2, null, 0, null, 3, null, 2, null, 0, null, null, null],
      [7, null, null, 10, null, null, 12, null, 10, null, 7, null, 5, null, null, null],
      [4, null, null, 2, null, null, -1, null, 2, null, null, null, -1, null, null, null],
    ];
    const f = (semi, base = 220) => base * Math.pow(2, semi / 12);
    const L = this.layers;
    // dark: drone + sparse lead
    if (b === 0) this.tone(f(roots[bar], 55), 2.7, { type: 'triangle', vol: 0.22, attack: 0.3, dest: L.dark, at });
    const n = LEAD[bar][b];
    if (n !== null) this.tone(f(n), 0.5, { type: 'square', vol: 0.05, attack: 0.01, dest: L.dark, lp: 2200, at });
    // lit: percussion and warm pad
    if (b === 0 || b === 8) this.tone(90, 0.15, { type: 'sine', vol: 0.35, slide: 40, dest: L.lit, at });
    if (b === 4 || b === 12) this.noise(0.12, { vol: 0.12, f: 1800, dest: L.lit, at });
    if (b === 0) for (const k of [0, 3, 7]) this.tone(f(roots[bar] + k + (k === 3 && bar === 3 ? 1 : 0), 220), 2.6, { type: 'sawtooth', vol: 0.025, attack: 0.4, lp: 900, dest: L.lit, at });
    // hold layer: urgent ticks while holding an area for an errand
    if (b % 2 === 0) this.tone(b % 4 === 0 ? 1200 : 900, 0.03, { type: 'square', vol: 0.05, dest: L.hold, at });
    if (b === 0 || b === 6 || b === 10) this.noise(0.08, { vol: 0.1, f: 900, dest: L.hold, at });
    // pressure: hats and pulsing bass
    if (b % 2 === 0) this.noise(0.04, { vol: 0.07, type: 'highpass', f: 6000, dest: L.pressure, at });
    if (b % 2 === 0) this.tone(f(roots[bar], 110), 0.12, { type: 'square', vol: 0.06, lp: 600, dest: L.pressure, at });
  }
}
