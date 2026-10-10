// Roofs and visual footprints (ART-PRD-3 S1.1 default, S1.2, S1.3). Collision is unchanged: every building is still
// its BLD rectangle. Shape comes from drawing: corners cut into walled yards, a playground or a chancel step, lower
// lean-to and conservatory wings with a shadow edge, and one roof type per building with its own tint, wear and
// 2-4 pieces of roof furniture. Light from the upper left: north slopes darker, ridge highlight, eaves shadow.
import { RNG } from '../rng.js';
import { RAMP, shade } from './palette.js';

const TS = 16;
// type, material, tint, furniture, wear (moss 0-3, sag, soot), cut: corner, size in tiles, what fills it
export const ROOF_STYLE = {
  HARDWARE: { type: 'gable', mat: 'slate', col: '#4a5568', furn: ['chimR', 'aerial', 'missing'], wear: { moss: 1 }, cut: { at: 'tr', w: 3, h: 2, kind: 'yard' } },
  'NEWS & BAKERY': { type: 'gable', mat: 'tile', col: '#9a4a32', furn: ['chimL', 'chimM', 'dish'], wear: { moss: 2, sag: 1, soot: 1 }, cut: { at: 'tl', w: 4, h: 2, kind: 'leanto' } },
  CAFE: { type: 'flat', col: '#3a3a40', furn: ['puddle', 'plants', 'vent', 'skylight'], wear: { moss: 0 } },
  BUTCHER: { type: 'mansard', mat: 'slate', col: '#54495e', furn: ['chimR', 'dormers', 'gutterPlant'], wear: { moss: 1 } },
  'FIRE STATION': { type: 'barrel', col: '#6a7468', furn: ['hatch', 'tarp'], wear: { moss: 1 }, cut: { at: 'tr', w: 3, h: 3, kind: 'yard' } },
  "ST MARY'S": { type: 'nave', mat: 'slate', col: '#3e4858', furn: ['nest', 'missing'], wear: { moss: 3, sag: 1 }, cut: { at: 'chancel', w: 3, h: 1, kind: 'grass' } },
  'ZION PRIMARY': { type: 'flat', col: '#4a4d52', furn: ['skylights', 'puddle'], wear: { moss: 1 }, cut: { at: 'tl', w: 4, h: 3, kind: 'playground' } }, // v1.4 B3: no roof hatch (it led nowhere); the mast ladder is the way up
  'SITE OFFICE': { type: 'corr', col: '#9aa3a8', furn: ['tarp', 'aerial'], wear: { moss: 0 } },
  STORES: { type: 'corr', col: '#7a8a96', furn: ['vent', 'missing'], wear: { moss: 0 } },
  GARAGE: { type: 'sawtooth', col: '#8c949a', furn: ['vent', 'dish'], wear: { moss: 0 } },
  'THE RED LION': { type: 'cross', mat: 'slate', col: '#4a5a52', furn: ['chimL', 'chimR', 'aerial'], wear: { moss: 2, soot: 1 } },
  '': { type: 'hipped', mat: 'tile', col: '#7a4a3a', furn: ['chimM', 'aerial', 'gutterPlant'], wear: { moss: 2 }, cut: { at: 'tl', w: 2, h: 2, kind: 'conservatory' } },
  'POST OFFICE': { type: 'gable', mat: 'tile', col: '#7e3a32', furn: ['chimL', 'chimR', 'tarp'], wear: { moss: 1, soot: 1 }, cut: { at: 'tr', w: 3, h: 2, kind: 'yard' } },
  PHARMACY: { type: 'flat', col: '#48463e', furn: ['plants', 'vent', 'puddle', 'dish'], wear: { moss: 1 }, cut: { at: 'tl', w: 3, h: 2, kind: 'leanto' } },
  'HUNT & TACKLE': { type: 'hipped', mat: 'slate', col: '#4e5a4a', furn: ['chimL', 'tarp', 'nest'], wear: { moss: 2, sag: 1 }, cut: { at: 'tr', w: 3, h: 2, kind: 'leanto' } },
};

// Draws the roof over (x, y, w, h) (the building minus its front face row, plus 6 px above), then the cut.
export function drawRoof(ctx, b, x, y, w, h) {
  const R = (a, c, ww, hh, col) => { ctx.fillStyle = col; ctx.fillRect(a, c, ww, hh); };
  const st = ROOF_STYLE[b.name] || { type: 'gable', mat: 'slate', col: b.roof, furn: [], wear: {} };
  const rng = new RNG(b.x * 131 + b.y * 17 + 7);
  const wear = st.wear || {};
  // the shadow the building casts to the lower right, so it sits on the ground
  R(x + w, y + 4, 3, h + 16, 'rgba(20,16,12,0.22)');
  ({ gable: pitched, hipped: pitched, nave: pitched, cross, flat, mansard, barrel, sawtooth, corr })[st.type](R, x, y, w, h, st, rng, wear);
  if (wear.moss) for (let k = 0; k < (w * h) / [9999, 1400, 800, 500][wear.moss]; k++) { const mx = x + rng.int(4, w - 12), my = y + rng.int(4, Math.max(5, h - 10)); R(mx, my, rng.int(3, 7), 2, '#5a7a3a'); R(mx + 1, my, 2, 1, '#7a9a4a'); }
  if (st.cut) cutCorner(R, b, x, y, w, h, st, rng);
  furniture(R, x, y, w, h, st, rng, wear);
}

const courses = (R, x, y, w, h, mat, base, rng, rowOff = 0) => {
  const lo = shade(base, -0.16), lo2 = shade(base, -0.08), hi = shade(base, 0.12);
  R(x, y, w, h, base);
  if (mat === 'slate') for (let j = 0; j < h; j += 4) { R(x, y + j + 3, w, 1, lo); for (let i = ((j >> 2) + rowOff) % 2 ? 0 : 3; i < w; i += 6) { R(x + i, y + j, 1, 3, lo2); if (rng.next() < 0.06) R(x + i + 1, y + j, 3, 1, hi); else if (rng.next() < 0.05) R(x + i + 1, y + j + 1, 4, 2, lo2); } }
  else for (let j = 0; j < h; j += 3) { R(x, y + j + 2, w, 1, lo); for (let i = ((j / 3 | 0) + rowOff) % 2 ? 0 : 2; i < w; i += 4) R(x + i + 1, y + j, 2, 1, hi); }
};

// Gable / hipped / nave: per-row spans. The ridge runs east-west at 45% of the depth (the south slope shows more).
// Hipped: the end facets are the pixels nearer the side than the top or bottom edge.
function pitched(R, x, y, w, h, st, rng, wear) {
  const base = st.col, north = shade(base, st.type === 'nave' ? -0.3 : -0.2), south = base, west = shade(base, 0.12), east = shade(base, -0.34);
  const ry = Math.round(h * 0.45), hip = st.type === 'hipped';
  courses(R, x, y, w, ry, st.mat, north, rng); courses(R, x, y + ry, w, h - ry, st.mat, south, rng, 1);
  R(x, y, w, ry, 'rgba(10,14,24,0.18)');
  if (hip) for (let j = 0; j < h; j++) {
    const m = j < ry ? j : Math.round(((h - 1 - j) / (h - 1 - ry)) * ry);
    if (m <= 0) continue;
    const band = j % 3 === 2 ? -0.12 : 0; R(x, y + j, m, 1, shade(west, band)); R(x + w - m, y + j, m, 1, shade(east, band));
    if (j % 3 === 0) for (let i = 2 + (j % 6 ? 2 : 0); i < m - 1; i += 4) { R(x + i, y + j, 1, 2, shade(west, -0.1)); R(x + w - m + i, y + j, 1, 2, shade(east, -0.12)); }
    R(x + m, y + j, 1, 1, shade(base, -0.4)); R(x + w - m - 1, y + j, 1, 1, shade(base, -0.45)); // hip lines
  }
  const r0 = hip ? ry : 0, sag = wear.sag ? 1 : 0;
  for (let i = r0; i < w - r0; i++) { const dip = sag && i > w * 0.4 && i < w * 0.6 ? 1 : 0; R(x + i, y + ry - 1 + dip, 1, 2, shade(base, 0.3)); R(x + i, y + ry + 1 + dip, 1, 1, shade(base, -0.35)); }
  if (!hip) { R(x, y, 2, h, shade(base, 0.25)); R(x + w - 3, y, 3, h, east); R(x + w - 3, y + ry, 3, 1, shade(base, 0.2)); } // verges; the east gable end in shadow
  R(x, y + h - 3, w, 3, shade(base, -0.45)); // eaves shadow
}
// The Red Lion: main block plus a back wing whose ridge runs north-south; valleys as dark lines
function cross(R, x, y, w, h, st, rng, wear) {
  pitched(R, x, y, w, h, { ...st, type: 'gable' }, rng, wear);
  const wx = x + Math.round(w * 0.55), ww = Math.round(w * 0.3), half = ww >> 1;
  R(wx, y, half, h - 20, shade(st.col, 0.1)); R(wx + half, y, ww - half, h - 20, shade(st.col, -0.28));
  for (let j = 0; j < h - 20; j += 3) R(wx, y + j, ww, 1, shade(st.col, -0.22));
  R(wx + half - 1, y, 2, h - 22, shade(st.col, 0.3)); R(wx - 1, y + 14, 1, h - 36, '#22262a'); R(wx + ww, y + 14, 1, h - 36, '#22262a');
  R(wx - 1, y, ww + 2, 2, shade(st.col, 0.2));
}
function flat(R, x, y, w, h, st, rng) {
  const base = st.col, lo = shade(base, -0.2);
  R(x, y, w, h, base);
  for (let j = 4; j < h - 4; j += 2) for (let i = 4 + ((j >> 1) % 2) * 2; i < w - 4; i += 4) R(x + i, y + j, 1, 1, lo);
  for (let k = 0; k < (w * h) / 2200; k++) R(x + rng.int(6, w - 18), y + rng.int(6, Math.max(7, h - 14)), rng.int(8, 14), rng.int(3, 5), shade(base, 0.06)); // patched felt
  // parapet: lit on the north and west, shadowed south and east, a lip of coping
  R(x, y, w, 4, '#8a857a'); R(x, y, w, 1, '#b8b2a4'); R(x, y, 4, h, '#8a857a'); R(x, y, 1, h, '#b8b2a4');
  R(x + w - 4, y, 4, h, '#6a665c'); R(x, y + h - 4, w, 4, '#6a665c'); R(x + 4, y + 4, w - 8, 2, 'rgba(0,0,0,0.25)'); R(x + 4, y + 4, 2, h - 8, 'rgba(0,0,0,0.25)');
}
// One shop on the square: a steep lower slope all round and a flat top; dormers drawn as furniture
function mansard(R, x, y, w, h, st, rng) {
  const base = st.col, b = 9;
  R(x, y, w, h, shade(base, -0.1));
  for (let i = 0; i < w; i += 3) { R(x + i, y, 1, b, shade(base, -0.35)); R(x + i, y + h - b, 1, b, shade(base, -0.05)); }
  R(x, y, b, h, shade(base, 0.08)); R(x + w - b, y, b, h, shade(base, -0.3));
  courses(R, x + b, y + b, w - 2 * b, h - 2 * b, 'slate', shade(base, 0.1), rng);
  R(x + b, y + b, w - 2 * b, 1, shade(base, 0.35)); R(x + b, y + h - b - 1, w - 2 * b, 1, shade(base, -0.4)); // the kerb between the two pitches
  for (const [a, c] of [[0, 0], [w - b, 0], [0, h - b], [w - b, h - b]]) R(x + a + (a ? 0 : b - 1), y + c + (c ? 0 : b - 1), 1, 1, '#22262a');
  R(x, y + h - 3, w, 3, shade(base, -0.45));
}
// Fire station appliance bay: one curved barrel roof with ribs
function barrel(R, x, y, w, h, st) {
  const base = st.col;
  for (let j = 0; j < h; j++) { const t = j / h, k = t < 0.35 ? -0.25 + t : t < 0.55 ? 0.22 : 0.18 - (t - 0.55) * 1.1; R(x, y + j, w, 1, shade(base, k)); }
  for (let i = 0; i < w; i += 8) { R(x + i, y, 1, h, shade(base, -0.35)); R(x + i + 1, y + Math.round(h * 0.4), 1, Math.round(h * 0.15), shade(base, 0.35)); }
  R(x, y, w, 2, shade(base, 0.25)); R(x, y + h - 3, w, 3, shade(base, -0.5));
}
// Garage: north-light sawtooth bays, glazing then a long corrugated slope
function sawtooth(R, x, y, w, h, st, rng) {
  const base = st.col;
  for (let bx = 0; bx < w; bx += 34) {
    const bw = Math.min(34, w - bx);
    R(x + bx, y, bw, h, base); for (let i = 0; i < bw; i += 2) R(x + bx + i, y, 1, h, shade(base, -0.18));
    for (let i = 0; i < bw; i++) if (i > 7) R(x + bx + i, y, 1, h, `rgba(255,255,255,${(0.1 * (i - 7)) / bw})`);
    R(x + bx, y, 7, h, '#3e5468'); for (let j = 0; j < h; j += 6) R(x + bx, y + j, 7, 1, '#2a3440'); R(x + bx + 1, y, 1, h, '#6a8aa8'); R(x + bx + 7, y, 1, h, '#2a2f34');
    if (rng.next() < 0.5) { const gy = y + rng.int(4, h - 10); R(x + bx + 2, gy, 3, 4, '#141619'); R(x + bx + 3, gy + 1, 1, 1, '#c8d4dc'); } // a pane out
    R(x + bx + 9 + rng.int(0, 16), y + rng.int(0, h - 10), 2, rng.int(4, 8), '#a8552e');
  }
  R(x, y, w, 2, shade(base, 0.2)); R(x, y + h - 3, w, 3, shade(base, -0.45));
}
function corr(R, x, y, w, h, st, rng) {
  const base = st.col;
  R(x, y, w, h, base); for (let i = 0; i < w; i += 2) R(x + i, y, 1, h, shade(base, -0.2));
  for (let k = 0; k < w / 20; k++) R(x + rng.int(0, w - 3), y + rng.int(0, h - 8), 2, rng.int(4, 8), '#a8552e');
  R(x, y, w, 2, shade(base, 0.2)); R(x, y + h - 3, w, 3, shade(base, -0.4)); R(x, y + (h >> 1), w, 1, shade(base, -0.3)); // sheet lap
}

// ---- footprints: corners drawn as something other than roof ----
function cutCorner(R, b, x, y, w, h, st, rng) {
  const c = st.cut, cw = c.w * TS, ch = c.h * TS + 6;
  if (c.at === 'chancel') { // the chancel is narrower than the nave: grass above and below its end (west here; the tower is east)
    const cx = x;
    const top = 22, bot = 14;
    R(cx, y, cw, top, '#4a7e30'); R(cx, y + top, cw, 3, 'rgba(20,16,12,0.35)');
    for (let i = 0; i < 10; i++) R(cx + rng.int(0, cw - 3), y + rng.int(0, top - 3), 2, 1, i % 2 ? '#5a9040' : '#43742c');
    // Phase F: the north step is walkable ground now; the south one stays blocked under the facade, so it is roofed: a vestry lean-to
    { const vb = shade(st.col, 0.1); R(cx, y + h - bot, cw, bot, vb); for (let j = 0; j < bot; j += 2) R(cx, y + h - bot + j, cw, 1, shade(vb, -0.14)); R(cx, y + h - bot, cw, 2, shade(vb, 0.2)); R(cx, y + h - 3, cw, 3, shade(vb, -0.45)); }
    R(cx, y + top, 2, h - top - bot, shade(st.col, 0.2));
    R(cx + cw, y, 2, top, '#8a8578'); R(cx + cw, y + h - bot, 3, bot, shade(st.col, -0.4)); // the nave's end wall either side

    return;
  }
  const cx = c.at.endsWith('l') ? x : x + w - cw, cy = y, edgeX = c.at.endsWith('l') ? cx + cw : cx;
  if (c.kind === 'yard' || c.kind === 'playground') {
    const pg = c.kind === 'playground';
    R(cx, cy, cw, ch, pg ? '#45484c' : '#8a8578');
    if (pg) { for (let i = 0; i < 4; i++) { R(cx + 10 + i * 7, cy + 14, 6, 6, '#c8bf9a'); R(cx + 11 + i * 7, cy + 15, 4, 4, '#45484c'); } R(cx + cw - 22, cy + 10, 14, 14, '#c8bf9a'); R(cx + cw - 21, cy + 11, 12, 12, '#45484c'); R(cx + cw - 16, cy + 16, 2, 2, '#e2b53c'); R(cx + 8, cy + ch - 12, 3, 8, '#b5503b'); R(cx + 8, cy + ch - 13, 10, 2, '#4d7fb8'); R(cx + 17, cy + ch - 12, 1, 8, '#b5503b'); } // hopscotch, a ball, a climbing frame
    else { for (let j = 0; j < ch; j += 8) for (let i = (j / 8) % 2 ? 0 : 8; i < cw; i += 16) R(cx + i, cy + j, 1, 8, '#77736a'); for (let j = 0; j < ch; j += 8) R(cx, cy + j, cw, 1, '#77736a');
      const bx = cx + 6; R(bx, cy + 8, 9, 11, '#2f5a3a'); R(bx, cy + 7, 9, 2, '#3e7048'); R(bx + 11, cy + 8, 9, 11, '#3a3d40'); R(bx + 11, cy + 7, 9, 2, '#55585c'); // bins
      R(cx + cw - 18, cy + ch - 16, 12, 10, '#3a3530'); R(cx + cw - 18, cy + ch - 16, 12, 2, '#55504a'); R(cx + cw - 16, cy + ch - 14, 8, 1, '#22201c'); } // coal bunker
    // the yard's wall on the outer sides: a 4 px coping and a short face
    const W2 = (a, c2, ww, hh) => { R(a, c2, ww, hh, RAMP.brick[1]); R(a, c2, ww, 1, RAMP.brick[0]); };
    if (!pg) { W2(cx, cy, cw, 4); if (c.at.endsWith('l')) W2(cx, cy, 4, ch); else W2(cx + cw - 4, cy, 4, ch); R(cx, cy + 4, cw, 2, 'rgba(20,16,12,0.3)'); } // Phase F: the playground is open ground, so no wall round it
    // the building's flank shows into the yard: a lit wall face along the inner edge, the roof's shadow on the yard
    if (c.at.endsWith('r')) { R(edgeX - 3, cy, 3, ch, shade(st.col, -0.45)); R(edgeX, cy + 6, 4, ch - 6, 'rgba(20,16,12,0.3)'); }
    else { R(edgeX, cy, 2, ch, shade(st.col, 0.25)); }
    R(cx, cy + ch, cw, 3, 'rgba(20,16,12,0.3)');
    R(cx + (c.at.endsWith('l') ? 2 : cw - 8), cy + ch - 2, 6, 3, '#9aa3a8'); // a gate in the yard wall is implied, never used: a drain cover
    return;
  }
  // lower wings: a lean-to stepping down from the main roof, or a conservatory with a glass roof
  const glass = c.kind === 'conservatory';
  const base = glass ? '#9ab0b8' : shade(st.col, 0.08);
  R(cx, cy, cw, ch, base);
  if (glass) { for (let i = 0; i < cw; i += 6) R(cx + i, cy, 1, ch, '#e8e4d8'); R(cx, cy + (ch >> 1), cw, 1, '#e8e4d8'); R(cx + 3, cy + 3, 5, 2, '#d8e8f0'); R(cx + 14, cy + 10, 3, 2, '#d8e8f0'); R(cx + 7, cy + ch - 10, 8, 4, 'rgba(60,80,40,0.5)'); } // glazing bars, glints, a dead plant inside
  else { for (let j = 0; j < ch; j += 2) R(cx, cy + j, cw, 1, shade(base, -0.16)); for (let i = 0; i < cw; i += 8) R(cx + i, cy, 1, ch, shade(base, -0.28)); R(cx, cy, cw, 2, shade(base, 0.2)); } // a mono-pitch, falling north
  // the main roof's wall rises above the lower wing: a step, then its shadow on the wing (2-3 px)
  if (c.at.endsWith('l')) { R(edgeX - 1, cy, 2, ch, shade(st.col, 0.3)); R(cx, cy + ch - 3, cw, 3, shade(base, -0.45)); R(cx + cw - 4, cy, 3, ch, 'rgba(20,16,12,0.35)'); }
  else { R(edgeX - 3, cy, 3, ch, shade(st.col, -0.5)); R(cx, cy + ch - 3, cw, 3, shade(base, -0.45)); R(edgeX, cy, 3, ch, 'rgba(20,16,12,0.35)'); }
  R(cx, cy - 2, cw, 2, 'rgba(20,16,12,0.25)');
}

// ---- roof furniture ----
function furniture(R, x, y, w, h, st, rng, wear) {
  const ry = st.type === 'flat' || st.type === 'barrel' || st.type === 'sawtooth' || st.type === 'corr' ? Math.round(h * 0.35) : Math.round(h * 0.45);
  const cutX = st.cut ? st.cut.at === 'chancel' ? [x, x + st.cut.w * TS] : (st.cut.at.endsWith('l') ? [x, x + st.cut.w * TS] : [x + w - st.cut.w * TS, x + w]) : [0, 0];
  const clearX = (cx, ww = 10) => (cx + ww < cutX[0] || cx > cutX[1] ? cx : cutX[0] > x + 20 ? cutX[0] - ww - 6 : cutX[1] + 6);
  const chim = (cx) => {
    cx = clearX(cx); const cy = y + ry - 14;
    R(cx, cy, 10, 14, '#9b4a36'); R(cx, cy, 10, 2, '#b5604a'); R(cx + 8, cy + 2, 2, 12, '#7d3a2a'); R(cx + 2, cy - 3, 2, 3, '#a8603a'); R(cx + 6, cy - 3, 2, 3, '#a8603a');
    R(cx + 10, cy + 6, 4, 9, 'rgba(20,16,12,0.3)');
    if (wear.soot) { R(cx - 4, cy + 14, 18, 4, 'rgba(30,26,22,0.35)'); R(cx, cy - 1, 10, 1, '#3a3530'); }
  };
  for (const f of st.furn || []) {
    if (f === 'chimL') chim(x + 12); else if (f === 'chimR') chim(x + w - 24); else if (f === 'chimM') chim(x + (w >> 1) - 5);
    else if (f === 'aerial') { const ax = clearX(x + w - 40, 12), ay = y + ry - 20; R(ax + 5, ay, 1, 18, '#55585c'); for (let i = 0; i < 4; i++) R(ax + 1 + i, ay + 3 + i * 3, 9 - i * 2, 1, '#8a8f94'); R(ax + 5, ay + 18, 4, 1, 'rgba(20,16,12,0.4)'); }
    else if (f === 'dish') { const dx = clearX(x + 30, 10), dy = y + ry + 6; R(dx, dy, 9, 9, '#c8c4b8'); R(dx + 1, dy + 1, 7, 7, '#a8a398'); R(dx + 4, dy + 4, 4, 1, '#55585c'); R(dx + 8, dy + 3, 2, 2, '#3a3d40'); R(dx + 2, dy + 9, 8, 2, 'rgba(20,16,12,0.3)'); }
    else if (f === 'missing') { const mx = clearX(x + Math.round(w * 0.3) + rng.int(0, 20), 14), my = y + ry + 6 + rng.int(0, 8); R(mx, my, 12, 7, '#5a3e2a'); for (let j = 0; j < 7; j += 3) R(mx, my + j, 12, 1, '#8f6a3e'); R(mx + 3, my, 1, 7, '#3a2a1e'); } // slates gone, battens showing
    else if (f === 'tarp') { const tx = clearX(x + Math.round(w * 0.55), 22), ty = y + ry + 4; R(tx, ty, 22, 14, '#2f5a8a'); R(tx, ty, 22, 2, '#4a7ab0'); R(tx + 4, ty + 6, 14, 1, '#24486e'); for (const [a, c] of [[-2, -2], [16, -2], [-2, 10], [16, 10]]) { R(tx + a, ty + c, 7, 6, '#1d1d20'); R(tx + a + 2, ty + c + 2, 3, 2, '#3a3d40'); } } // a tarp weighted with tyres
    else if (f === 'nest') { const nx = clearX(x + 16, 10), ny = y + ry - 6; R(nx, ny, 10, 5, '#6b4a2e'); R(nx + 1, ny, 8, 1, '#8f6a3e'); R(nx + 3, ny + 1, 4, 2, '#3a2a1e'); R(nx + 2, ny - 1, 1, 1, '#a8804e'); R(nx + 8, ny + 2, 2, 1, '#a8804e'); }
    else if (f === 'gutterPlant') { const gx = clearX(x + Math.round(w * 0.7), 8), gy = y + h - 6; R(gx, gy, 3, 4, '#6a5a32'); R(gx + 2, gy - 3, 2, 4, '#7a6a3a'); R(gx - 1, gy - 2, 2, 2, '#8a7a42'); } // a buddleia, dead in the gutter
    else if (f === 'vent') { const vx = clearX(x + 20 + rng.int(0, 30), 8), vy = y + ry; R(vx, vy, 8, 6, '#6f787d'); R(vx, vy, 8, 1, '#9aa3a8'); R(vx + 1, vy + 2, 6, 1, '#3a3a3e'); R(vx + 8, vy + 2, 2, 5, 'rgba(20,16,12,0.3)'); }
    else if (f === 'puddle') for (let k = 0; k < 2; k++) { const px = x + 10 + rng.int(0, w - 40), py = y + 10 + rng.int(0, Math.max(1, h - 30)); R(px, py, 14, 4, '#3a4a5a'); R(px + 2, py - 1, 9, 6, '#3a4a5a'); R(px + 3, py, 3, 1, '#6a8aa8'); }
    else if (f === 'plants') for (let k = 0; k < 3; k++) { const px = clearX(x + 8 + k * 12, 10), py = y + h - 16; R(px, py, 10, 5, '#8f6a3e'); R(px, py, 10, 1, '#a8804e'); R(px + 1, py - 3, 2, 3, '#6a7a3a'); R(px + 5, py - 4, 2, 4, '#5a6a32'); } // planters gone to seed
    else if (f === 'skylight') { const sx = clearX(x + w - 36, 14), sy = y + 12; R(sx, sy, 14, 10, '#8a857a'); R(sx + 1, sy + 1, 12, 8, '#3e5468'); R(sx + 2, sy + 2, 4, 1, '#8aa2b8'); }
    else if (f === 'skylights') for (let k = 0; k < 4; k++) { const sx = clearX(x + w - 30 - k * 22, 14), sy = y + 26; R(sx, sy, 14, 9, '#8a857a'); R(sx + 1, sy + 1, 12, 7, '#3e5468'); R(sx + 2, sy + 2, 4, 1, '#8aa2b8'); if (k === 2) { R(sx + 6, sy + 3, 3, 3, '#141619'); R(sx + 7, sy + 4, 1, 1, '#c8d4dc'); } }
    else if (f === 'hatch') { const hx = clearX(x + 14, 12), hy = y + h - 22; R(hx, hy, 12, 10, '#55585c'); R(hx, hy, 12, 1, '#8a8f94'); R(hx + 1, hy + 1, 10, 8, '#3a3d40'); for (let j = 0; j < 8; j += 2) R(hx + 3, hy + 2 + j, 6, 1, '#8a8f94'); } // a ladder hatch
    else if (f === 'dormers') for (let k = 0; k < 3; k++) { const dx = x + 18 + k * Math.round((w - 46) / 2), dy = y + h - 20; R(dx, dy, 12, 12, shade(st.col, 0.05)); R(dx, dy, 6, 5, shade(st.col, 0.2)); R(dx + 6, dy, 6, 5, shade(st.col, -0.25)); R(dx + 2, dy + 5, 8, 6, '#e8dfc6'); R(dx + 3, dy + 6, 6, 4, '#26333f'); R(dx + 4, dy + 6, 1, 1, '#8aa2b8'); R(dx + 12, dy + 2, 2, 10, 'rgba(20,16,12,0.3)'); }
  }
}
