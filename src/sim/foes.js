// New walkers and special rounds (ENHANCEMENT-PRD §17.1-17.3, §17.5): Screamer, Hazmat, Tangled, Burning,
// the Butcher, dog-pack leaders, and the herd that walks through town.
import { T } from '../tuning.js';
import { nextStep } from '../nav.js';

const DT = T.dt;
const hyp = Math.hypot;

export const FoesMixin = {
  initFoes() { this.nextButcher = T.butcher.from; this.butcherCount = 0; this.packT = 4; this.packGo = 0; this.screamBoost = false; },

  screamerAI(e) {
    const p = this.p, S = T.screamer;
    if (e.screamT > 0) {
      e.screamT -= DT;
      if (e.screamT <= 0) {
        e.screamCD = S.every;
        const bars = this.barricades.filter((b) => this.openZones.has(b.zone)).sort((a, b) => hyp(a.x - e.x, a.y - e.y) - hyp(b.x - e.x, b.y - e.y));
        const aliveCap = T.round.activeCap(this.round) + S.aliveOver, alive = () => this.enemies.reduce((n, o) => n + (o.dead ? 0 : 1), 0);
        for (let i = 0; i < S.extra && (this.screamSummoned || 0) < S.budget && alive() < aliveCap && bars.length; i++) { const x = this.spawnAtBarricade(this.rollBasic(), bars[i % Math.min(3, bars.length)]); x.extra = true; x.summoned = true; this.screamSummoned = (this.screamSummoned || 0) + 1; }
        this.emit('scream', { x: e.x, y: e.y, big: true });
      }
      return true;
    }
    e.screamCD = (e.screamCD ?? S.every * 0.5) - DT;
    const d = hyp(p.x - e.x, p.y - e.y);
    if (e.screamCD <= 0 && d < 300 && !p.dead) { e.screamT = S.windup; this.emit('screamWind', { x: e.x, y: e.y }); return true; }
    if (d < S.keepMin) { // back off, keep the walkers between it and Cain
      const ax = e.x - (p.x - e.x) / d * 20, ay = e.y - (p.y - e.y) / d * 20;
      const bx = e.x, by = e.y; this.moveCircle(e, (ax - e.x) / 20 * e.speed * DT, (ay - e.y) / 20 * e.speed * DT, e.r);
      e.fx = (e.x - p.x) / d; e.fy = (e.y - p.y) / d; e.moving = hyp(e.x - bx, e.y - by) > 0.05;
      return true;
    }
    if (d < S.keepMax) { e.fx = (p.x - e.x) / d; e.fy = (p.y - e.y) / d; return true; }
    return false; // approach normally
  },
  butcherAI(e) {
    const p = this.p, B = T.butcher;
    if (e.grabWarn > 0) {
      e.grabWarn -= DT;
      if (e.grabWarn <= 0) {
        e.grabCD = 3;
        if (hyp(p.x - e.x, p.y - e.y) < B.grabRange + e.r + 4 && !p.downed && !p.dead && p.invuln <= 0) {
          p.grabbed = { e, t: B.hold, mash: 0 };
          this.hurtPlayer(B.dmg, e);
          this.emit('grab', { x: p.x, y: p.y });
        }
      }
      return true;
    }
    if (p.grabbed && p.grabbed.e === e) { e.moving = false; return true; }
    e.grabCD = (e.grabCD || 0) - DT;
    const d = hyp(p.x - e.x, p.y - e.y);
    if (d < B.grabRange + e.r && e.grabCD <= 0 && !p.downed) { e.grabWarn = B.windup; e.fx = (p.x - e.x) / d; e.fy = (p.y - e.y) / d; this.emit('grabWarn', { x: e.x, y: e.y }); return true; }
    return false;
  },
  updateGrab(inp) {
    const p = this.p, g = p.grabbed; if (!g) return;
    if (g.e.dead || p.downed || p.dead) { p.grabbed = null; return; }
    g.t -= DT;
    if (inp.attack && !p.prevAttackGrab) g.mash++;
    p.prevAttackGrab = inp.attack;
    if (g.mash >= T.butcher.mash || g.t <= 0) {
      if (g.mash >= T.butcher.mash) { g.e.stagger = 1.2; this.emit('banner', { text: 'BROKE FREE', sub: '' }); }
      p.grabbed = null; p.iframes = 0.6;
    }
  },
  // dog-pack leaders (§17.5): circle together, then lunge together
  dogPackAI(e) {
    const p = this.p;
    if (e.leader || this.packGo > 0) return false;
    const leader = this.enemies.find((o) => !o.dead && o.leader);
    if (!leader) return false;
    if (e.tgtBiscuit) return false;
    const a = this.t * 1.2 + e.id * 1.7, tx = p.x + Math.cos(a) * 46, ty = p.y + Math.sin(a) * 46;
    let mx = tx - e.x, my = ty - e.y;
    if (hyp(mx, my) > 40) { const s = nextStep(this.W, this.H, this.walk, this.field, Math.floor(e.x / 16), Math.floor(e.y / 16)); if (s) { mx = s.x - e.x; my = s.y - e.y; } }
    const md = hyp(mx, my); if (md < 1) return true;
    e.fx = mx / md; e.fy = my / md; e.moving = true;
    this.moveCircle(e, e.fx * Math.min(md, e.speed * 0.8 * DT), e.fy * Math.min(md, e.speed * 0.8 * DT), e.r);
    return true;
  },
  updateFoes() {
    if (this.packGo > 0) this.packGo -= DT;
    if (this.dogRound && this.enemies.some((o) => !o.dead && o.leader)) {
      this.packT -= DT;
      if (this.packT <= 0) { this.packT = 4; this.packGo = 1.5; this.emit('packHowl', {}); }
    }
    const p = this.p;
    if (p.burnT > 0) { p.burnT -= DT; if (!this.hasComfort('gasmask')) this.hurtPlayer(T.fire.dps * 0.5 * DT, { dot: true }); }
  },
  // the herd walks through town (§17.3)
  herdGoalFor(side) {
    const opp = { NORTH: 'SOUTH', SOUTH: 'NORTH', EAST: 'WEST', WEST: 'EAST' }[side];
    let bars = this.barricades.filter((b) => this.openZones.has(b.zone) && this.barricadeSide(b) === opp);
    if (!bars.length) bars = this.barricades.filter((b) => this.openZones.has(b.zone));
    const b = this.rng.pick(bars);
    return { x: b.inside.x, y: b.inside.y };
  },
  herdAI(e) {
    const p = this.p;
    if (e.noticed || (e.lure && e.lure.t > 0) || p.dead) { e.herdGoal = null; return false; }
    const d = hyp(p.x - e.x, p.y - e.y);
    if (d < T.specials.herdAggro && !this.inSmoke(p.x, p.y)) { e.herdGoal = null; e.noticed = true; return false; }
    const g = e.herdGoal;
    if (hyp(g.x - e.x, g.y - e.y) < 18) { e.gone = true; this.herdPassed = (this.herdPassed || 0) + 1; return true; }
    const f = this.lureField({ id: 'H' + Math.floor(g.x / 16) + ',' + Math.floor(g.y / 16), x: g.x, y: g.y });
    const s = nextStep(this.W, this.H, this.walk, f, Math.floor(e.x / 16), Math.floor(e.y / 16));
    let mx = g.x - e.x, my = g.y - e.y; if (s) { mx = s.x - e.x; my = s.y - e.y; }
    const md = hyp(mx, my); if (md < 0.3) return true;
    e.fx = mx / md; e.fy = my / md; e.moving = true;
    const sp = this.enemySpeed(e);
    this.moveCircle(e, e.fx * Math.min(md, sp * DT), e.fy * Math.min(md, sp * DT), e.r);
    return true;
  },
  butcherKilled(e) {
    this.addWorldItem({ item: 'weapon', kind: 'weapon', weapon: 'cleaver', cond: 2, x: e.x + 8, y: e.y });
    this.emit('banner', { text: 'THE BUTCHER IS DOWN', sub: 'He dropped his cleaver' });
  },
};
