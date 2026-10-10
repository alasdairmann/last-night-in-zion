// v1.2 run logging (PRD-v1.2.md §A). Every run streams JSON lines to the dev server (POST /log), which writes
// logs/<run>.jsonl. Notable events are kept whole; chatty ones (shots, hits, scrap pops) are counted per night.
// A snapshot of the whole state is taken every few seconds and a summary at the end of each night.
// Line kinds: start, ev, snap, night, end. Read them with scripts/runlog-report.js.
const CHATTY = new Set(['windup', 'impact', 'shot', 'hit', 'swing', 'groan', 'shake', 'smoke', 'tick', 'click', 'shell', 'squeak',
  'meleeHit', 'plankTear', 'plankRepair', 'raiderShot', 'soldierShot', 'padHit', 'noise', 'scrap', 'ammo', 'reload', 'reloaded',
  'swap', 'kill', 'hurt', 'bark', 'climbIn', 'woof', 'thorns', 'snare', 'flame', 'zap', 'laser', 'bite', 'friendHit', 'survivorSwing',
  'carAlarmTick', 'purchase', 'throw', 'brickHit', 'brickLand', 'pipeLand', 'hiss', 'whimper', 'stepDone', 'equip']);
const SNAP_EVERY = 5;   // seconds of game time
const FLUSH_EVERY = 4;  // seconds of real time

export class RunLog {
  constructor() { this.buf = []; this.run = null; this.enabled = location.protocol.startsWith('http') && /^(localhost|127\.0\.0\.1)$/.test(location.hostname); this.lastFlush = performance.now(); } // logs only when served by server.js locally
  start(game, meta = {}) {
    this.flush();
    const d = new Date();
    this.run = `${d.toISOString().slice(0, 19).replace(/[T:]/g, '-')}-s${game.seed}`;
    this.game = game; this.nextSnap = 0; this.night = this.blankNight(game.round);
    this.push({ k: 'start', seed: game.seed, ua: navigator.userAgent, ...meta });
  }
  blankNight(r) { return { round: r, counts: {}, kills: {}, killBy: {}, hurtBy: {}, dmgTaken: 0, scrapIn: 0, spent: 0, maxAlive: 0, summoned: 0, extras: 0, gunKills: 0, meleeKills: 0, trapKills: 0 }; }
  push(o) { if (!this.run) return; o.t = this.game ? +this.game.t.toFixed(2) : 0; o.r = this.game ? this.game.round : 0; this.buf.push(o); }
  event(game, ev) {
    if (!this.run || game !== this.game) return;
    const n = this.night;
    n.counts[ev.type] = (n.counts[ev.type] || 0) + 1;
    switch (ev.type) {
      case 'kill': {
        const et = ev.role ? `raider:${ev.role}` : ev.enemy;
        n.kills[et] = (n.kills[et] || 0) + 1;
        const by = ev.w ? `${ev.w}+${ev.tier || 0}` : ev.kind || 'other';
        n.killBy[by] = (n.killBy[by] || 0) + 1;
        if (ev.kind === 'gun') n.gunKills++; else if (ev.kind === 'melee') n.meleeKills++; else if (ev.kind === 'trap' || ev.trap != null) n.trapKills++;
        if (ev.summoned) n.summoned++; if (ev.extra) n.extras++;
        if (ev.enemy && ev.enemy !== 'walker' && ev.enemy !== 'crawler' && ev.enemy !== 'runner') this.push({ k: 'ev', e: 'kill', enemy: et, by, amt: ev.amt, x: ev.x | 0, y: ev.y | 0 });
        break;
      }
      case 'hurt': n.dmgTaken += ev.dmg || 0; n.hurtBy[ev.by || '?'] = (n.hurtBy[ev.by || '?'] || 0) + (ev.dmg || 0); if (ev.dmg >= 30) this.push({ k: 'ev', e: 'bigHit', dmg: Math.round(ev.dmg), by: ev.by, hp: ev.hp }); break;
      case 'scrap': n.scrapIn += ev.amt || 0; break;
      case 'purchase': n.spent += ev.amt || 0; break;
    }
    if (ev.type === 'roundEnd') this.endNight(game);
    if (ev.type === 'roundStart') this.night = this.blankNight(ev.round);
    if (CHATTY.has(ev.type)) return;
    const o = { k: 'ev', e: ev.type };
    for (const [key, v] of Object.entries(ev)) if (key !== 'type' && (typeof v !== 'object' || v === null)) o[key] = typeof v === 'number' ? Math.round(v * 10) / 10 : v;
    this.push(o);
  }
  endNight(g) {
    const n = this.night;
    this.push({ k: 'night', ...n, scrap: g.scrap, parts: g.parts, hp: Math.round(g.p.hp), comforts: [...g.p.comforts], weapons: this.weapons(g), stats: { ...g.stats, weaponKills: { ...g.stats.weaponKills } } });
  }
  weapons(g) { return g.p.slots.map((w) => w && `${w.id}+${w.tier || 0}${w.mag !== undefined ? ` ${w.mag}/${w.reserve}` : ''}`); }
  snapshot(g) {
    const p = g.p, alive = {};
    let total = 0;
    for (const e of g.enemies) if (!e.dead) { const k = e.type === 'raider' ? `raider:${e.role}` : e.type; alive[k] = (alive[k] || 0) + 1; total++; }
    this.night.maxAlive = Math.max(this.night.maxAlive, total);
    this.push({
      k: 'snap', state: g.state, alive, total, toSpawn: g.toSpawn, remaining: g.remaining ? g.remaining() : null,
      p: { x: p.x | 0, y: p.y | 0, zone: g.zoneAt(p.x, p.y), hp: Math.round(p.hp), maxHp: p.maxHp, downed: !!p.downed, pad: p.padLayers || 0, secondWind: !!p.secondWind, bandages: p.bandages, throwable: `${p.throwable.id}x${p.throwable.count}`, cur: p.cur },
      weapons: this.weapons(g), comforts: [...p.comforts], scrap: g.scrap, parts: g.parts, bank: g.bank, zones: [...g.openZones],
      power: g.power, fuel: g.fuel, weather: g.weather, noise: Math.round(g.noise), streak: g.streak.count,
      bars: g.barricades.filter((b) => g.openZones.has(b.zone)).map((b) => b.planks).join(''), pub: { shut: !!g.pubShut, windows: g.safeBars.map((b) => b.planks).join(''), safe: g.safeHouse },
      survivors: g.survivors.map((s) => `${s.name}:${s.state}:${Math.round(s.hp)}${s.sick ? ':sick' : ''}`), biscuit: g.biscuit ? `${Math.round(g.biscuit.hp)}${g.biscuit.down ? ':down' : ''}` : null,
      errands: (g.errands || []).map((e) => `${e.id}:${e.step}`), screamSummoned: g.screamSummoned || 0, fps: null,
    });
  }
  tick(g, fps) {
    if (!this.run || g !== this.game) return;
    if (g.t >= this.nextSnap) { this.nextSnap = g.t + SNAP_EVERY; this.snapshot(g); if (fps) this.buf[this.buf.length - 1].fps = Math.round(fps); }
    if (performance.now() - this.lastFlush > FLUSH_EVERY * 1000) this.flush();
  }
  note(o) { this.push({ k: 'ui', ...o }); }
  end(g, how, extra = {}) { if (!this.run) return; this.endNight(g); this.push({ k: 'end', how, round: g.round, stats: { ...g.stats }, ...extra }); this.flush(true); }
  flush(final = false) {
    this.lastFlush = performance.now();
    if (!this.buf.length || !this.enabled || !this.run) { this.buf.length = 0; return; }
    const body = this.buf.map((o) => JSON.stringify(o)).join('\n') + '\n';
    this.buf = [];
    const url = `/log?run=${encodeURIComponent(this.run)}`;
    try {
      if (final && navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }));
      else fetch(url, { method: 'POST', body, keepalive: body.length < 60000 }).catch(() => {});
    } catch { /* logging must never break the game */ }
  }
}
