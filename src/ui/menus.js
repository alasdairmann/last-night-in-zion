// DOM menus with Enoch's plaque tokens (PRD §26). Fully keyboard navigable (W/S or arrows, Enter/Space, Esc).
import { ACTION_NAMES, keyLabel, touchCopy } from '../input.js';
import { TOUCH_ACTIONS } from '../touch.js';
import { ZONE_NAMES, TRICKS, TAPES, WEATHER, ITEMS, ITEM_USES, THROWS, GUNS, CONDITIONS } from '../data.js';
import { weaponName } from '../sim/game.js';
import { pediaTabs, mapHtml, wirePedia } from './enochpedia.js';
import { T } from '../tuning.js';
import { mountTitleArt } from './titleart.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export class UI {
  constructor(root, store, hooks) {
    this.root = root; this.store = store; this.hooks = hooks;
    this.stack = []; this.sel = 0; this.capture = null;
  }
  get open() { return this.stack.length > 0; }
  get top() { return this.stack[this.stack.length - 1]; }
  show(screen) { this.stack = [screen]; this.sel = screen.initial || 0; this.render(); }
  push(screen) { this.stack.push(screen); this.sel = 0; this.render(); }
  pop() { this.stack.pop(); this.sel = 0; if (!this.stack.length) this.hide(); else this.render(); }
  hide() { this.stack = []; this.root.innerHTML = ''; this.root.classList.remove('on'); }

  items() { return (this.top.items || []).filter((i) => !i.hidden); }
  render() {
    const s = this.top; if (!s) return;
    this.root.classList.add('on');
    this.root.className = 'ui on ' + (s.cls || '');
    const items = this.items(), touch = !!this.hooks.layout?.touch;
    if (this.sel >= items.length) this.sel = Math.max(0, items.length - 1);
    const rows = items.map((it, i) => {
      const cur = i === this.sel ? ' sel' : '';
      let val = '';
      if (it.type === 'slider') { const v = it.get(); val = `<span class="bar">${'<i></i>'.repeat(Math.round(v * 10))}${'<b></b>'.repeat(10 - Math.round(v * 10))}</span>`; }
      else if ((it.type === 'toggle' || it.type === 'select') && touch && it.options.length <= 4) val = `<span class="seg">${it.options.map((o) => `<b data-o="${esc(o)}" class="${o === it.get() ? 'on' : ''}">${esc(o === 'auto' && it.show ? it.show() : o)}</b>`).join('')}</span>`;
      else if (it.type === 'toggle' || it.type === 'select') val = `<span class="val">${esc(it.show ? it.show() : it.get())}</span>`;
      else if (it.type === 'key') val = `<span class="key${this.capture === it ? ' wait' : ''}">${this.capture === it ? 'PRESS A KEY' : esc(keyLabel(it.get()))}</span>`;
      return `<li class="item ${it.type || 'button'}${cur}${it.primary ? ' primary' : ''}${it.danger ? ' danger' : ''}" data-i="${i}"><span class="lbl">${esc(it.label)}</span>${val}</li>`;
    }).join('');
    let html = typeof s.html === 'function' ? s.html() : s.html || '';
    // v1.4 A2: below 900 px the pause screen is tabs (Menu / Notes / Map) instead of side-by-side panels
    const small = s.side && window.innerWidth < 900;
    if (small) {
      s.smallTab = s.smallTab || 0;
      const bar = `<div class="tabs">${['Menu', 'Notes', 'Map'].map((t, i) => `<span class="tab${i === s.smallTab ? ' on' : ''}" data-st="${i}">${t}</span>`).join('')}</div>`;
      if (s.smallTab === 1) html = bar + `<div class="tray inline">${this.notesHtml()}</div>`;
      else if (s.smallTab === 2) html = bar + `<div class="tabbody">${mapHtml()}</div>`;
      else html = bar + html;
    }
    if (s.tabs) {
      const tabs = typeof s.tabs === 'function' ? s.tabs() : s.tabs;
      s.tab = Math.max(0, Math.min(tabs.length - 1, s.tab || 0));
      html = `<div class="tabs">${tabs.map((t, i) => `<span class="tab${i === s.tab ? ' on' : ''}" data-t="${i}">${esc(t.name)}</span>`).join('')}</div><div class="tabbody">${tabs[s.tab].html}</div>`;
    }
    const side = typeof s.side === 'function' ? s.side() : s.side;
    if (touch) html = touchCopy(html);
    // touch: a back arrow replaces Esc
    const back = this.hooks.layout?.touch && (this.stack.length > 1 || (s.onBack && !s.noBack)) ? '<button class="back" aria-label="Back">&#9664;</button>' : '';
    this.root.innerHTML = `<div class="plaque ${s.wide ? 'wide' : ''} ${s.tabs ? 'tabbed' : ''}">${back}${s.title ? `<h1>${s.title}</h1>` : ''}${html}${rows && !(small && s.smallTab) ? `<ul class="menu">${rows}</ul>` : ''}${s.foot ? `<div class="foot">${s.foot}</div>` : ''}</div>${side && !small ? `<aside class="tray">${side}</aside>` : ''}`;
    this.root.querySelectorAll('[data-st]').forEach((el) => el.addEventListener('click', () => { s.smallTab = +el.dataset.st; this.render(); }));
    this.wireNotes();
    this.root.querySelectorAll('.tab').forEach((el) => el.addEventListener('click', () => { s.tab = +el.dataset.t; this.render(); }));
    if (s.after) s.after(this.root);
    this.root.querySelector('.plaque > .back')?.addEventListener('click', () => this.back());
    this.root.querySelectorAll('.item').forEach((el) => {
      el.addEventListener('mouseenter', () => { this.sel = +el.dataset.i; this.highlight(); });
      el.addEventListener('click', (e) => {
        this.sel = +el.dataset.i;
        // touch: tap a slider where you want it
        const it = this.items()[this.sel], bar = el.querySelector('.bar');
        const seg = e.target.closest && e.target.closest('.seg b');
        if (seg && it) { it.set(seg.dataset.o); this.store.save(); this.render(); return; }
        if (it && it.type === 'slider' && bar && this.hooks.layout?.touch) { const r = bar.getBoundingClientRect(); it.set(Math.max(0, Math.min(1, Math.round((e.clientX - r.left) / r.width * 10) / 10))); this.store.save(); this.render(); return; }
        this.activate(0);
      });
    });
  }
  highlight() { this.root.querySelectorAll('.item').forEach((el, i) => el.classList.toggle('sel', i === this.sel)); }

  // returns true if the key was handled
  key(e) {
    if (!this.open) return false;
    if (this.capture) {
      e.preventDefault();
      if (e.code !== 'Escape') { this.capture.set(e.code); this.store.save(); }
      this.capture = null; this.render(); return true;
    }
    // typing in a text box (the Zionpedia search): only Escape leaves it
    if (e.target && e.target.tagName === 'INPUT') { if (e.code === 'Escape') { e.target.blur(); e.preventDefault(); } return true; }
    const items = this.items();
    const c = e.code;
    if (e.repeat && (c === 'Enter' || c === 'Space' || c === 'KeyF')) { e.preventDefault(); return true; }
    if (this.top.tabs) {
      const body = this.root.querySelector('.tabbody');
      if (c === 'KeyQ' || c === 'ArrowLeft' || c === 'KeyA') { this.top.tab = (this.top.tab || 0) - 1; if (this.top.tab < 0) this.top.tab = (typeof this.top.tabs === 'function' ? this.top.tabs() : this.top.tabs).length - 1; this.render(); this.hooks.sound?.('tick'); e.preventDefault(); return true; }
      if (c === 'KeyE' || c === 'ArrowRight' || c === 'KeyD' || c === 'Tab') { const n = (typeof this.top.tabs === 'function' ? this.top.tabs() : this.top.tabs).length; this.top.tab = ((this.top.tab || 0) + 1) % n; this.render(); this.hooks.sound?.('tick'); e.preventDefault(); return true; }
      if (body && (c === 'KeyS' || c === 'ArrowDown') && !this.top.items?.some((i) => i.type)) { if (!this.top.listNav) { body.scrollTop += 60; e.preventDefault(); return true; } }
      if (body && (c === 'KeyW' || c === 'ArrowUp') && !this.top.listNav) { body.scrollTop -= 60; e.preventDefault(); return true; }
    }
    if (this.top.noteKeys && (c === 'ArrowLeft' || c === 'ArrowRight' || c === 'KeyA' || c === 'KeyD')) { this.moveNote(c === 'ArrowLeft' || c === 'KeyA' ? -1 : 1); e.preventDefault(); return true; }
    if (this.top.noteKeys && c === 'KeyM') { this.pinNote(); e.preventDefault(); return true; }
    if (c === 'ArrowDown' || c === 'KeyS') { this.sel = (this.sel + 1) % Math.max(1, items.length); this.highlight(); this.hooks.sound?.('tick'); }
    else if (c === 'ArrowUp' || c === 'KeyW') { this.sel = (this.sel - 1 + items.length) % Math.max(1, items.length); this.highlight(); this.hooks.sound?.('tick'); }
    else if (c === 'ArrowLeft' || c === 'KeyA') this.activate(-1);
    else if (c === 'ArrowRight' || c === 'KeyD') this.activate(1);
    else if (c === 'Enter' || c === 'Space' || c === 'KeyF') this.activate(0);
    else if (c === 'Escape' || c === 'KeyP' || c === 'Backspace') this.back();
    else if (this.top.onKey) this.top.onKey(e);
    else return true;
    e.preventDefault();
    return true;
  }
  back() { if (this.top.onBack) this.top.onBack(); else if (this.stack.length > 1) this.pop(); }
  activate(dir) {
    const it = this.items()[this.sel]; if (!it) return;
    if (it.type === 'slider') { if (dir) { it.set(Math.max(0, Math.min(1, Math.round((it.get() + dir * 0.1) * 10) / 10))); this.store.save(); this.render(); } return; }
    if (it.type === 'toggle' || it.type === 'select') {
      const opts = it.options; const i = opts.indexOf(it.get());
      it.set(opts[(i + (dir || 1) + opts.length) % opts.length]); this.store.save(); this.render(); return;
    }
    if (it.type === 'key') { if (!dir) { this.capture = it; this.render(); } return; }
    if (!dir && it.action) { this.hooks.sound?.('select'); it.action(); }
  }

  // ---------- screens ----------
  mainMenu() {
    const best = this.store.best, self = this;
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) && !navigator.standalone;
    const hint = () => (this.hooks.layout?.touch ? `<p class="tapstart">Tap Play to start${ios ? '. For fullscreen: Share, then Add to Home Screen' : ''}</p>` : '');
    let save = null; try { const raw = this.store.loadLatest(); if (raw) save = { meta: JSON.parse(raw).meta || { round: '?' } }; } catch { save = null; }
    this.show({
      cls: 'title', after: (r) => mountTitleArt(r.querySelector('.tbanner')),
      html: () => `<h1 class="sr">Last Night in Zion</h1><canvas class="tbanner"></canvas>${hint()}${best ? `<p class="best">Personal best: wave <b>${best}</b>${this.store.rec.escapes ? ` &middot; Escapes: <b>${this.store.rec.escapes}</b> (earliest wave ${this.store.rec.bestEscapeRound})` : ''}${this.store.rec.signalComplete ? ' &middot; <b title="The Signal answered">&#128251;</b>' : ''}${this.store.rec.bestScore ? ` &middot; Best score: <b>${this.store.rec.bestScore.toLocaleString('en-GB')}</b>` : ''}</p>` : ''}`,
      items: [
        ...(save ? [{ label: `Continue (wave ${save.meta.round})`, primary: true, action: () => this.hooks.cont() }] : []),
        { label: save ? 'New run' : 'Play', primary: !save, action: () => this.hooks.play() },
        { label: 'Zionpedia', action: () => this.pedia() },
        { label: 'How to play', action: () => this.howTo() },
        { label: 'Settings', action: () => this.settings() },
        { label: 'Credits', action: () => this.credits() },
        { label: 'Fullscreen', action: () => this.hooks.fullscreen(), get hidden() { return !self.hooks.layout?.touch || !document.documentElement.requestFullscreen || !!document.fullscreenElement; } },
      ],
      foot: 'W / S to choose &middot; ENTER to select',
      onBack: () => {}, noBack: true,
    });
  }
  howTo() {
    if (this.hooks.layout?.touch) {
      return this.push({ wide: true, title: 'How to play', html: `${this.touchDiagram()}<ol class="rules"><li>Kill the dead for <b>Scrap</b>. Melee kills pay the most.</li><li>Spend Scrap at racks, doors and the crate: hold the context button.</li><li>Repair barricades between fights.</li><li>Find the <b>generator</b> in the fire station.</li><li>Guns are loud. Melee is quiet.</li></ol>`, items: [{ label: 'Back', action: () => this.pop() }] });
    }
    const k = this.store.settings.keys, L = keyLabel;
    const keys = [
      ['\u2190 \u2191 \u2193 \u2192', 'Move (you face the way you move)'],
      [L(k.attack), 'Swing or fire in the direction you face'],
      [`${L(k.lock)} (hold)`, 'Lock facing: back away while attacking'],
      [`${L(k.interact)} (hold)`, 'Buy, repair, open, start the generator'],
      ['1-4', 'Switch weapon'],
      [`${L(k.prev)} / ${L(k.next)}`, 'Flip options at benches and boards'],
      [L(k.reload), 'Reload'], [L(k.throw), 'Throw a brick (or whatever is in your pocket)'],
      [L(k.shove), 'Shove: push them back, set up critical hits'],
      [`${L(k.map)} (hold)`, 'Town map'], [`${L(k.pause)} / P`, 'Pause'],
    ];
    this.push({
      wide: true, title: 'How to play',
      html: `<div class="cols"><table class="keys">${keys.map(([a, b]) => `<tr><td><kbd>${esc(a)}</kbd></td><td>${esc(b)}</td></tr>`).join('')}</table>
      <ol class="rules"><li>Kill the dead for <b>Scrap</b>. Melee kills pay the most.</li><li>Spend Scrap at racks, doors and the crate (hold <kbd>${L(k.interact)}</kbd>).</li><li>Repair barricades between fights.</li><li>Find the <b>generator</b> in the fire station.</li><li>Guns are loud. Melee is quiet.</li></ol></div>`,
      items: [{ label: 'Back', action: () => this.pop() }],
    });
  }
  credits() {
    this.push({
      title: 'Credits',
      html: '<p>Last Night in Zion, a prequel to <i>Project Enoch</i>.</p><p>Systems in the spirit of round-based zombie survival; Boxhead-style controls; the world of Project Enoch.</p><p>Procedural placeholder art and synthesised audio. Fonts: Nunito, Silkscreen.</p>',
      items: [{ label: 'Back', action: () => this.pop() }],
    });
  }
  settings() {
    const S = this.store.settings, self = this;
    const items = [
      { label: 'Music volume', type: 'slider', get: () => S.musicVol, set: (v) => { S.musicVol = v; this.hooks.volumes(); } },
      { label: 'SFX volume', type: 'slider', get: () => S.sfxVol, set: (v) => { S.sfxVol = v; this.hooks.volumes(); } },
      { label: 'Screen shake', type: 'select', options: ['full', 'reduced', 'off'], get: () => S.shake, set: (v) => (S.shake = v) },
      { label: 'Flashing effects', type: 'select', options: ['full', 'reduced'], get: () => S.flashing, set: (v) => (S.flashing = v) },
      { label: 'Hit stop', type: 'toggle', options: ['on', 'off'], get: () => (S.hitStop ? 'on' : 'off'), set: (v) => { S.hitStop = v === 'on'; this.hooks.applySettings(); } },
      { label: 'Scrap pop-ups', type: 'toggle', options: ['on', 'off'], get: () => (S.popups ? 'on' : 'off'), set: (v) => (S.popups = v === 'on') },
      { label: 'Damage numbers', type: 'toggle', options: ['on', 'off'], get: () => (S.damageNumbers !== false ? 'on' : 'off'), set: (v) => (S.damageNumbers = v === 'on') },
      { label: 'Pop-ups and damage numbers', type: 'select', options: ['reduced', 'full'], get: () => S.mobileFx, set: (v) => { S.mobileFx = v; this.hooks.layout.update(true); }, get hidden() { return self.hooks.layout.mode !== 'mobile'; } },
      { label: 'Tutorial prompts', type: 'toggle', options: ['on', 'off'], get: () => (S.tutorial ? 'on' : 'off'), set: (v) => { S.tutorial = v === 'on'; if (S.tutorial) this.store.tut = {}; } },
      { label: 'God mode (unlimited everything)', type: 'toggle', options: ['off', 'on'], get: () => (S.godMode ? 'on' : 'off'), set: (v) => { S.godMode = v === 'on'; } },
      { label: 'Colour-blind assist', type: 'toggle', options: ['off', 'on'], get: () => (S.colourBlind ? 'on' : 'off'), set: (v) => { S.colourBlind = v === 'on'; document.body.classList.toggle('cb', S.colourBlind); } },
      { label: 'Layout', type: 'select', options: ['auto', 'desktop', 'tablet', 'mobile'], get: () => S.layout, show: () => this.hooks.layout.label(), set: (v) => { S.layout = v; this.hooks.layout.update(); } },
      { label: 'Touch controls', type: 'select', options: ['auto', 'always', 'off'], get: () => S.touch, set: (v) => { S.touch = v; this.hooks.layout.update(); } },
      { label: 'Control size', type: 'select', options: ['s', 'm', 'l'], get: () => S.touchSize, set: (v) => { S.touchSize = v; }, get hidden() { return !self.hooks.layout.touch; } },
      { label: 'Control opacity', type: 'slider', get: () => S.touchOpacity, set: (v) => { S.touchOpacity = Math.max(0.2, v); }, get hidden() { return !self.hooks.layout.touch; } },
      { label: 'Left-handed', type: 'toggle', options: ['off', 'on'], get: () => (S.leftHanded ? 'on' : 'off'), set: (v) => { S.leftHanded = v === 'on'; }, get hidden() { return !self.hooks.layout.touch; } },
      { label: 'Vibration', type: 'toggle', options: ['on', 'off'], get: () => (S.vibrate ? 'on' : 'off'), set: (v) => { S.vibrate = v === 'on'; }, get hidden() { return !self.hooks.layout.touch || !navigator.vibrate; } },
      { label: 'Fullscreen', action: () => this.hooks.fullscreen() },
      { label: 'Controls', action: () => (this.hooks.layout.touch ? this.touchLegend() : this.controls()) },
      { label: 'Back', action: () => this.pop() },
    ];
    this.push({ title: 'Settings', items });
  }
  // touch: a read-only legend instead of key rebinding
  touchLegend() {
    this.push({ title: 'Touch controls', html: `<table class="stats legend">${Object.values(TOUCH_ACTIONS).map((t) => { const k = t.indexOf(': '); return `<tr><td>${esc(k > 0 ? t.slice(0, k) : t)}</td><td>${esc(k > 0 ? t.slice(k + 2) : '')}</td></tr>`; }).join('')}</table><p>Size, opacity, left-handed and vibration are in Settings.</p>`, items: [{ label: 'Back', action: () => this.pop() }] });
  }
  // the touch How to play: a labelled diagram of the controls
  touchDiagram() {
    const mob = this.hooks.layout?.mode === 'mobile', L = !!this.store.settings.leftHanded, X = (x) => (L ? 100 - x : x);
    const spots = [['stick', 16, 72, 'Move'], ['lock', 4, 90, 'Lock'], ['attack', 90, 80, 'Attack'], ['shove', 77, 80, 'Shove'], ['throw', 78, 66, 'Throw'], ['trick', 83, 56, 'Trick'], ['dog', 90, 52, 'Biscuit'], ['interact', 75, 40, 'Context'], ['chip', 62, 90, 'Weapon'], ['pause', 96, 9, 'Pause'], ['map', mob ? 82 : 89, 9, mob ? 'Minimap' : 'Map']];
    if (mob) spots.push(['satchel', 89, 9, 'Satchel']);
    return `<div class="tdiag">${mob ? '<div class="tbar">health · wave · objective · buffs</div>' : ''}${spots.map(([id, x, y, n], i) => `<span class="dot ${id}" style="left:${X(x)}%;top:${y}%">${i + 1}</span>`).join('')}</div>
      <ol class="tlegend">${spots.map(([id, , , n]) => `<li><b>${n}</b> ${esc((TOUCH_ACTIONS[id] || (id === 'satchel' ? 'Satchel: comforts, bandages and status' : '')).replace(/^[^:]*: ?/, ''))}</li>`).join('')}</ol>`;
  }
  controls() {
    const K = this.store.settings.keys;
    const items = Object.keys(ACTION_NAMES).map((a) => ({ label: ACTION_NAMES[a], type: 'key', get: () => K[a], set: (c) => (K[a] = c) }));
    items.push({ label: 'Reset to defaults', action: () => { this.store.resetKeys(); this.pop(); this.controls(); } });
    items.push({ label: 'Back', action: () => this.pop() });
    this.push({ title: 'Controls', items, cls: 'compact', foot: 'ENTER then press a key to rebind. Arrow keys move.' });
  }
  pause(saved = null) {
    const g = this.hooks.game();
    const note = saved === null ? '' : saved ? `<p class="saved">&#10004; Game saved &middot; wave ${g.round}</p>` : '<p class="saved fail">Could not save: storage is full or blocked</p>';
    this.show({
      title: 'Paused', initial: saved === null ? 0 : 1,
      side: () => this.notesHtml(), noteKeys: true,
      html: (g ? `<p class="sub">Wave ${g.round} &middot; ${WEATHER[g.weather]?.name || 'Clear'}${g.trick.id ? ` &middot; Trick: ${TRICKS[g.trick.id].name}` : ''}</p>` : '') + note,
      items: [
        { label: 'Resume', primary: true, action: () => this.hooks.resume() },
        { label: saved ? 'Saved \u2714' : 'Save game', action: () => this.pause(!!this.hooks.save()) },
        { label: 'Journal', action: () => this.errandLog(g, true) },
        { label: 'Zionpedia', action: () => this.pedia() },
        { label: 'How to play', action: () => this.howTo() },
        { label: 'Settings', action: () => this.settings() },
        { label: 'Quit to menu', danger: true, action: () => this.confirmQuit() },
      ],
      onBack: () => this.hooks.resume(),
    });
  }
  confirmQuit() {
    this.push({ title: 'Quit this run?', cls: 'confirm', html: '<p>Anything since your last save is lost. Save first from the pause menu if you want to come back.</p>', items: [{ label: 'Keep fighting', primary: true, action: () => this.pop() }, { label: 'Quit to menu', danger: true, action: () => this.hooks.quit() }] });
  }
  pedia() {
    const keys = this.store.settings.keys;
    const scr = { wide: true, cls: 'pediaui', title: 'Zionpedia', tabs: () => pediaTabs(keys), tab: 0, items: [{ label: 'Back', action: () => this.pop() }],
      after: (root) => wirePedia(root, scr, () => this.render(), keys), onKey: (e) => { if (e.code === 'Slash') scr.focusSearch?.(); },
      foot: 'Click a card for details &middot; / search &middot; Q / E or &larr; &rarr; change tab &middot; W / S scroll &middot; ESC back' };
    this.push(scr);
  }
  pickTrick(last) {
    const ids = Object.keys(TRICKS);
    const items = ids.map((id) => ({ label: `${TRICKS[id].name}  (${T.tricks.charge[id]} kills)`, primary: id === last, action: () => this.hooks.pickedTrick(id) }));
    if (this.hooks.layout?.mode === 'mobile') {
      const scr = { title: 'Choose your Trick', cls: 'tricks', noBack: true, onBack: () => {},
        html: `<div class="tcar">${ids.map((id) => `<div class="tcard" data-id="${id}"><b style="color:${TRICKS[id].color}">${TRICKS[id].name}</b><span class="tk">${T.tricks.charge[id]} kills to charge</span><p>${esc(TRICKS[id].desc)}</p><button class="pick" data-id="${id}">Take ${esc(TRICKS[id].name)}</button></div>`).join('')}</div><div class="tdots">${ids.map((id) => `<i class="${id === last ? 'on' : ''}"></i>`).join('')}</div>`,
        items: [],
        after: (root) => {
          const car = root.querySelector('.tcar'), dots = [...root.querySelectorAll('.tdots i')];
          const i0 = Math.max(0, ids.indexOf(last)); requestAnimationFrame?.(() => { car.scrollLeft = i0 * car.clientWidth; });
          car.addEventListener('scroll', () => { const i = Math.round(car.scrollLeft / Math.max(1, car.clientWidth)); dots.forEach((d, j) => d.classList.toggle('on', j === i)); }, { passive: true });
          root.querySelectorAll('.pick').forEach((b) => b.addEventListener('click', () => this.hooks.pickedTrick(b.dataset.id)));
        } };
      return this.show(scr);
    }
    this.show({ title: 'Choose your Trick', cls: 'tricks', initial: Math.max(0, ids.indexOf(last)),
      html: `<p>An improvised trick on <kbd>X</kbd>, charged by kills. It's yours for the whole run.</p><div class="trickdesc">${ids.map((id) => `<p><b style="color:${TRICKS[id].color}">${TRICKS[id].name}</b>: ${esc(TRICKS[id].desc)}</p>`).join('')}</div>`,
      items, foot: 'W / S choose &middot; ENTER / F confirm (your last pick is remembered)', onBack: () => {}, noBack: true });
  }
  // v1.4 A2: Notes as a phone notification list. Newest on top; the focused card is open (full text, codes, a map
  // pin button); the rest are one line. Left / Right or the wheel move the focus; M pins it.
  notesHtml(limit = 200) {
    const notes = (this.hooks.notes?.() || []).slice(0, limit), f = Math.min(this.noteFocus || 0, Math.max(0, notes.length - 1)), pin = this.hooks.pinned?.();
    const ic = { danger: '!', objective: '★', radio: '≋', tip: '?', banner: '·' };
    const lo = Math.max(0, Math.min(f - 2, notes.length - 5)), hi = Math.min(notes.length, lo + 5);
    const row = (n, i) => {
      const k = n.text.indexOf(': '), title = k > 0 ? n.text.slice(0, k) : n.text, body = k > 0 ? n.text.slice(k + 2) : '';
      if (i !== f) return `<li class="note ${n.kind} d${Math.min(2, Math.abs(i - f))}" data-n="${i}"><span class="ic">${ic[n.kind] || '·'}</span><span class="tt">${esc(title)}</span><span class="n">W${n.wave}</span></li>`;
      const on = pin && n.pin && pin.x === n.pin.x && pin.y === n.pin.y;
      return `<li class="note open ${n.kind}" data-n="${i}"><div class="nh"><span class="ic">${ic[n.kind] || '·'}</span><b>${esc(title)}</b><span class="n">Wave ${n.wave}</span></div>${body ? `<p>${esc(body)}</p>` : ''}${n.code ? `<span class="code">${esc(n.code)}</span>` : ''}${n.pin ? `<button class="pinbtn" data-pin="${i}">${on ? 'Unpin from the map' : 'Pin on the map (M)'}</button>` : ''}</li>`;
    };
    return `<h3>Notes</h3>${notes.length ? `${lo > 0 ? `<p class="more">&uarr; ${lo} newer</p>` : ''}<ol class="notes cards">${notes.slice(lo, hi).map((n, j) => row(n, lo + j)).join('')}</ol>${hi < notes.length ? `<p class="more">&darr; ${notes.length - hi} older</p>` : ''}<p class="hint">${f + 1} / ${notes.length} &middot; &larr; &rarr; or wheel &middot; M pin</p>` : '<p>Nothing yet.</p>'}`;
  }
  wireNotes() {
    const list = this.root.querySelector('.notes.cards'); if (!list) return;
    list.querySelectorAll('li').forEach((el) => el.addEventListener('click', () => { this.noteFocus = +el.dataset.n; this.render(); }));
    list.querySelectorAll('.pinbtn').forEach((el) => el.addEventListener('click', (e) => { e.stopPropagation(); this.noteFocus = +el.dataset.pin; this.pinNote(); }));
    const tray = list.closest('.tray') || list.parentElement;
    tray.addEventListener('wheel', (e) => { e.preventDefault(); this.moveNote(Math.sign(e.deltaY)); }, { passive: false });
    const open = list.querySelector('li.open'); if (open) open.scrollIntoView({ block: 'nearest' });
  }
  moveNote(d) { const n = (this.hooks.notes?.() || []).length; if (!n) return; this.noteFocus = Math.max(0, Math.min(n - 1, (this.noteFocus || 0) + d)); this.hooks.sound?.('tick'); this.render(); }
  pinNote() { const n = (this.hooks.notes?.() || [])[this.noteFocus || 0]; if (n && n.pin) { this.hooks.pin?.(n); this.render(); } }
  // v1.2 B21: the Red Lion switchboard. A minimal top-down map and a toggle or fire button per device
  switchboard(g) {
    const rows = g.switchboardRows(), W = g.W * 16, H = g.H * 16;
    const zones = Object.values(g.map.zones).map((z) => `<rect x="${z.x0 * 16}" y="${z.y0 * 16}" width="${(z.x1 - z.x0 + 1) * 16}" height="${(z.y1 - z.y0 + 1) * 16}" fill="none" stroke="${g.openZones.has(z.id) ? '#6a8a50' : '#333'}" stroke-width="8"/>`).join('');
    const col = (r) => (!r.wired ? '#555' : r.status === 'firing' ? '#f0b030' : r.armed || r.status === 'ready' ? '#6cbf4a' : '#e03a2a');
    const dots = rows.map((r) => `<circle cx="${r.x}" cy="${r.y}" r="22" fill="${col(r)}"/><text x="${r.x + 30}" y="${r.y + 10}" fill="#f0ead8" font-size="40">${esc(r.name)}</text>`).join('');
    const items = [];
    for (const r of rows) {
      if (!r.wired) { items.push({ label: `${r.name}: not wired`, action: () => {} }); continue; }
      if (r.armable) items.push({ label: `${r.name}: ${r.armed ? 'ARMED' : 'OFF'} (${r.status})`, action: () => { g.switchToggle(r.id); this.switchboard(g); } });
      else items.push({ label: `Fire: ${r.name}${r.cost ? ` (${r.cost.toLocaleString('en-GB')})` : ''} - ${r.status}`, primary: r.status === 'ready', action: () => { g.switchFire(r.id); this.switchboard(g); } });
    }
    items.push({ label: 'Back to the wave', action: () => this.hooks.resume() });
    const sel = this.top && this.top.switchboard ? this.sel : 0;
    this.show({ wide: true, title: 'Switchboard', switchboard: true, html: `<svg class="switchmap" viewBox="0 0 ${W} ${H}">${zones}${dots}</svg>`, items, foot: 'Armed traps fire when 4+ of the dead are in them. ESC back', onBack: () => this.hooks.resume() });
    this.sel = sel; this.highlight();
  }
  // v1.4 F3: the Red Lion stash. Take a stored gun (it swaps with the one in its slot) or store one you carry
  stash(g) {
    const p = g.p, nm = (w) => `${CONDITIONS[w.cond ?? 1].name} ${weaponName(w)}`, items = [];
    g.stash.forEach((w, i) => { const melee = w.kind === 'melee', s = melee ? null : g.gunSlotFor(w.id), cls = melee ? 0 : g.gunClass(w.id) === 'primary' ? 1 : 2; items.push({ label: `Take ${nm(w)}${s === null && p.slots[cls] ? ` (swaps with your ${weaponName(p.slots[cls])})` : ''}`, primary: true, action: () => { g.stashTake(i); this.stash(g); } }); });
    [1, 2, 3].forEach((i) => { const w = p.slots[i]; if (w) items.push({ label: `Store ${nm(w)}`, action: () => { g.stashStore(i); this.stash(g); } }); });
    items.push({ label: 'Back to the wave', action: () => this.hooks.resume() });
    const armed = g.survivors.filter((s) => !s.dead && (s.weapon || s.melee));
    const html = `<p>The Red Lion's armoury. Weapons you had no slot for wait here. At each break your survivors take the best ones you aren't using: guns to shoot from the windows, blades and clubs to hold them.</p>${armed.length ? `<p>${armed.map((s) => `<b>${esc(s.name)}</b> has your ${esc(weaponName(s.weapon || s.melee))}`).join(' &middot; ')}</p>` : ''}`;
    const sel = this.top && this.top.stashScreen ? this.sel : 0;
    this.show({ title: 'The armoury', stashScreen: true, html, items, foot: 'W / S choose &middot; ENTER take or store &middot; ESC back', onBack: () => this.hooks.resume() });
    this.sel = Math.min(sel, items.length - 1); this.highlight();
  }
  // fromPause: opened from the pause menu, so Back / ESC return there instead of to the wave
  errandLog(g, fromPause = false) {
    if (!g) return;
    const reopen = () => { if (fromPause) this.stack.pop(); this.errandLog(g, fromPause); };
    const back = () => (fromPause ? this.pop() : this.hooks.resume());
    const L = g.errandLog();
    const row = (a, b = '') => `<tr><td>${a}</td><td>${b}</td></tr>`;
    const items = [];
    for (const a of L.active) if (!a.parallel) items.push({ label: `Abandon: ${a.name}`, danger: true, action: () => { g.abandonErrand(a.id); reopen(); } });
    for (const o of [...L.radio, ...L.board]) items.push({ label: `Accept: ${o.name}`, primary: true, action: () => { if (g.acceptErrand(o.id)) this.hooks.resume(); else reopen(); } });
    items.push({ label: fromPause ? 'Back' : 'Back to the wave', action: back });
    const pocket = Object.entries(g.pocket).filter(([, n]) => n > 0);
    const carried = g.carriedItem();
    const itemsHtml = `<table class="stats">${pocket.map(([k, n]) => row(`<b>${esc(ITEMS[k] || k)}</b>${n > 1 ? ` x${n}` : ''}`, '') + `<tr><td colspan="2">${esc(ITEM_USES[k] || 'Part of an errand.')}</td></tr>`).join('')}
      ${carried ? row(`<b>In your hands: ${esc(ITEMS[carried] || carried)}</b>`, '') + `<tr><td colspan="2">${esc(ITEM_USES[carried] || 'Carry it where the green arrow points. G drops it.')}</td></tr>` : ''}
      ${row('Pocket (throw)', `${esc(THROWS[g.p.throwable.id].name)} x${g.p.throwable.count}`)}${row('Parts', g.parts)}</table>${pocket.length || carried ? '' : '<p>Nothing in your pockets but Parts and something to throw.</p>'}`;
    const howHtml = `<h3>Healing</h3><p>You heal on your own a few seconds after the last hit. Hot Stew raises your max health. Bolt yourself into the Red Lion with every window boarded and you heal twice as fast.</p>
      <h3>Comforts vs Second Wind</h3><p>Comforts are permanent and take a slot. <b>Second Wind</b> (Hunt &amp; Tackle) gets you back up once and takes no slot. Going down never costs you a comfort.</p>
      <h3>Survivors</h3><p>Hurt survivors heal ${T.survivors.healPerRound} HP a wave (${T.heal.medicPerRound} with a Medic). Use a Bandages charge on one to heal ${T.heal.bandage} at once. Behind a bolted door they fight at double strength.</p>
      <h3>Biscuit</h3><p>Tap Z to send him, hold to make him stay. If he goes down, hold F by him. He heals between waves; the dog tin keepsake heals him fully.</p>
      <h3>The safehouse</h3><p>The Red Lion's door starts broken: fix it to get in. Then hold F at it to bolt it, even with the dead at the door. Nothing comes through a bolted door; the dead and Raiders must tear a window down, three times slower. Fit oak or steel shutters to its windows, from inside or out. With survivors home they bolt it behind you and let you back in. The stash is behind the bar.</p>
      <h3>Cellar hatches</h3><p>One per zone, all broken at first. Fix the Red Lion's door, then the hatch in its cellar, then the hatches out in town. Hold F at a fixed hatch to drop in; Left / Right move between the other fixed hatches and "Stay" (the camera goes to look), F climbs out, Esc stays where you are. Hatches and the pub door won't work with the dead close by.</p>
      <h3>Traps and the switchboard</h3><p>Arm a trap and it fires itself when ${T.traps.armN}+ of the dead (or a special) are in it; you pay each firing. Wire the Town connects traps to a switchboard in the pub.</p>`;
    const notesHtml = this.notesHtml();
    const tabs = [
      { name: 'Errands', html: `<table class="stats">${L.active.length ? L.active.map((a) => row(`<b>${esc(a.name)}</b>`, esc(a.step))).join('') : row('No errand', 'Radio, noticeboard or a ? in town')}${row('Generator', esc(L.fuel))}</table>
        ${L.radio.length || L.board.length || L.triggers.length ? `<h3>On offer</h3><table class="stats">${[...L.radio.map((o) => row(`Radio: ${esc(o.name)}`, esc(o.brief))), ...L.board.map((o) => row(`Board: ${esc(o.name)}`, esc(o.brief))), ...L.triggers.map((o) => row(`? ${esc(o.name)}`, esc(o.brief)))].join('')}</table>` : ''}
        ${g.trial ? `<h3>Trial</h3><table class="stats">${row(esc(g.trialText()), `${Math.floor(g.trial.n)} / ${g.trial.target}${g.trial.tier ? ' (done!)' : ''}`)}</table>` : ''}` },
      { name: 'Items', html: itemsHtml },
      { name: 'Notes', html: notesHtml },
      { name: 'How to', html: howHtml },
      { name: 'Escape', html: g.escapeLog() ? `<table class="stats">${g.escapeLog().map((e) => row(`${e.done ? '&#10004;' : '&#9744;'} ${esc(e.text)}`)).join('')}</table>` : `<p>Nothing yet. Keep the lights on and survive to wave ${T.escape.unlockRound}.</p>` },
      { name: 'The Signal', html: g.signal.step === 0 ? '<p>Only static on the radio, for now.</p>' : `<table class="stats">${g.signalLog().map((s) => row(`${s.done ? '&#10004;' : '?'} ${esc(s.text === '?' ? 'Next step' : s.text)}`, esc(s.hint))).join('')}</table>` },
      { name: 'Ellie\'s Bears', html: g.bearsLog() ? `<table class="stats">${g.bearsLog().map((e) => row(`${e.done ? '&#10004;' : '&#9744;'} ${esc(e.text)}`)).join('')}</table>${g.bears.step >= 5 ? '<p>The secret: Ellie hid her bears as a trail for her mum. Ruth Marsh followed it to you.</p>' : ''}` : '<p>There\'s a teddy bear by the war memorial with a name tag on it.</p>' },
      { name: 'Tapes', html: g.tapes.length ? g.tapes.map((i) => `<h3>${esc(TAPES[i].title)}</h3><p>${esc(TAPES[i].text)}</p>`).join('') : '<p>No tapes found. They glint in odd corners of town.</p>' },
      { name: 'Survivors', html: g.survivors.filter((s) => !s.dead).length || g.biscuit ? `<table class="stats">${g.survivors.filter((s) => !s.dead).map((s) => row(`${esc(s.name)}, ${s.age}`, `${s.role}${s.sick ? ' (sick)' : ''} ${Math.ceil(s.hp)}/${s.maxHp}`)).join('')}${g.biscuit ? row('Biscuit', g.biscuit.dead ? 'gone' : g.biscuit.down ? 'down!' : `${Math.ceil(g.biscuit.hp)}/${g.biscuit.maxHp}`) : ''}</table>` : '<p>Nobody yet.</p>' },
    ];
    const scr = { wide: true, title: 'Journal', tabs, tab: 0, listNav: true, items, foot: `Q / E change tab &middot; W / S choose &middot; ENTER accept or abandon &middot; ${fromPause ? 'ESC back' : 'T / ESC close'}`, onBack: back, onKey: (e) => { if (e.code === 'KeyT') this.hooks.resume(); } };
    if (fromPause) this.push(scr); else this.show(scr);
  }
  // v1.4 I: the score, line by line, then the multiplier and the total
  scoreHtml(sc, best) {
    const n = (v) => Number(v).toLocaleString('en-GB');
    return `<h3>Score</h3><table class="stats score">${sc.lines.map((l) => `<tr><td>${esc(l.label)}</td><td>${n(l.n)}${l.each !== 1 ? ` &times; ${n(l.each)}` : ''}</td><td>${n(l.pts)}</td></tr>`).join('')}<tr><td>${esc(sc.why)}</td><td>&times; ${sc.mult}</td><td></td></tr><tr class="total"><td><b>Total</b></td><td></td><td><b>${n(sc.total)}</b></td></tr></table>${best ? '<p class="newbest">New best score!</p>' : ''}`;
  }
  escaped(g, runTime, score = null, bestScore = false) {
    const s = g.stats, mins = Math.floor(runTime / 60), secs = Math.floor(runTime % 60);
    const row = (a, b) => `<tr><td>${a}</td><td>${b}</td></tr>`;
    this.show({ cls: 'over escaped', wide: true, title: 'Cain made it out of Zion.',
      html: `<p class="sub">Somewhere past the hills, he would try to start again. That is <i>Project Enoch</i>.</p><p class="sub">Escaped on wave ${g.round}, in ${mins}:${String(secs).padStart(2, '0')}.</p><table class="stats">${row('Kills', s.kills)}${row('Scrap earned', s.earned.toLocaleString('en-GB'))}${row('Errands done', g.errandsCompleted)}${row('Survivors', g.survivors.filter((x) => !x.dead).length)}${row('Biscuit', g.biscuit ? (g.biscuit.dead ? 'lost' : 'came too') : '-')}${row('Escapes', this.store.rec.escapes)}</table>${score ? this.scoreHtml(score, bestScore) : ''}`,
      items: [{ label: 'Play again', primary: true, action: () => this.hooks.play() }, { label: 'Main menu', action: () => this.hooks.menu() }], onBack: () => this.hooks.menu() });
  }
  gameOver(g, newBest, runTime, score = null, bestScore = false) {
    const s = g.stats, r = g.round;
    const pct = s.kills ? Math.round((s.meleeKills / s.kills) * 100) : 0;
    const most = Object.entries(s.weaponKills).sort((a, b) => b[1] - a[1])[0];
    const mins = Math.floor(runTime / 60), secs = Math.floor(runTime % 60);
    const zone = ZONE_NAMES[s.deathZone] || 'the dark';
    const verbs = ['swinging', 'holding', 'clutching', 'still gripping'];
    const epitaph = `Cain was last seen ${verbs[r % verbs.length]} ${/^[aeiou]/i.test(s.deathWeapon) ? 'an' : 'a'} ${s.deathWeapon.toLowerCase().replace(/^a /, '')} in ${zone}.`;
    const row = (a, b) => `<tr><td>${a}</td><td>${b}</td></tr>`;
    let auto = null; try { const raw = this.store.loadAuto(); if (raw) auto = JSON.parse(raw).meta; } catch { auto = null; }
    this.show({
      cls: 'over', wide: true,
      title: `You fell on wave ${r}.`,
      html: `${g.godUsed ? '<p class="godflag">God mode was on: this run doesn\'t count for records.</p>' : ''}<p class="sub">You held Zion for ${Math.max(0, r - 1)} wave${r - 1 === 1 ? '' : 's'}.${newBest ? ' <b class="newbest">New best!</b>' : ''}</p>
      <p class="epitaph">${esc(epitaph)}</p>
      <table class="stats">${row('Kills', s.kills)}${row('Melee kills', `${pct}%`)}${row('Headshots / criticals', `${s.heads} / ${s.crits}`)}${row('Scrap earned', s.earned.toLocaleString('en-GB'))}${row('Scrap spent', s.spent.toLocaleString('en-GB'))}${row('Doors opened', s.doors)}${row('Most-used weapon', most ? esc(most[0]) : '-')}${row('Run time', `${mins}:${String(secs).padStart(2, '0')}`)}${row('Times downed', s.downs)}${row('Best streak', s.bestStreak)}</table>${score ? this.scoreHtml(score, bestScore) : ''}`,
      items: [
        ...(auto ? [{ label: `Retry wave ${auto.round}`, primary: true, action: () => this.hooks.retry() }] : []),
        { label: 'Play again', primary: !auto, action: () => this.hooks.play() },
        { label: 'Main menu', action: () => this.hooks.menu() },
      ],
      foot: `SPACE / ENTER ${auto ? 'retry the wave' : 'play again'} &middot; ESC main menu`,
      onBack: () => this.hooks.menu(),
    });
  }
}
