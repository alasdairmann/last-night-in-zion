// The map edge and beyond (ART-PRD-3 S3.1, S3.2). Collision is unchanged: the outer ring at x = 1 / 94, y = 1 / 62
// stays WALL / BAR in town.js. buildStatic bakes a MARGIN-tile apron round the town (woods north, river east,
// farmland south, the bypass west), darker and desaturated with distance, and draws the border in a different
// material on each side, broken by set pieces, with the corners buried. Hilltop is to the north-east: its mast
// stands on the far side of the apron there; the glow and the blinking light are drawn live by the renderer.
import { RNG } from '../rng.js';
import { RAMP, shade } from './palette.js';
import { pixelText } from './sprites.js';

export const MARGIN = 4; // tiles of apron on every side; the camera may see 3.5 of them
const TS = 16;
export const HILLTOP = { x: 96 * TS + 40, y: -46 }; // the mast on the horizon, map pixels (north-east)
// distant lights for the lighting pass: hazards on the bypass, a fire on a far farm, a police light
export const FAR_LIGHTS = [
  { x: -30, y: 21 * TS, kind: 'hazard' }, { x: -44, y: 44 * TS, kind: 'police' },
  { x: 74 * TS, y: 64 * TS + 46, kind: 'fire' }, { x: 96 * TS + 30, y: 50 * TS, kind: 'hazard' },
];

// ---------------- the apron (map coordinates; the caller has translated by the margin) ----------------
export function drawApron(ctx, map) {
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const rng = new RNG(6262), M = MARGIN * TS, W = map.W * TS, H = map.H * TS;
  // base ground per side, corners belong to the side they lean into
  R(-M, -M, W + 2 * M, M, '#24461a'); // woods floor
  R(W, 0, M, H, '#2f5a7a'); // river
  R(-M, H, W + 2 * M, M, '#6e5e34'); // fields
  R(-M, 0, M, H, '#3a3c40'); // bypass
  // ---- north: the woods in three depth layers, a deer fence, a footpath sign, a fallen trunk ----
  for (let layer = 0; layer < 3; layer++) {
    const y0 = -M + layer * 18, s = [8, 11, 14][layer], cols = [['#14240f', '#1a2e14'], ['#1d3818', '#264a1e'], ['#2a5020', '#3a6a2a']][layer];
    for (let x = -M - 10; x < W + M; x += s - 2 + rng.int(0, 4)) {
      const ty = y0 + rng.int(-4, 8);
      R(x, ty + 2, s, s - 3, cols[0]); R(x + 2, ty, s - 4, s, cols[0]); R(x + 2, ty + 1, s / 2, s / 2 - 1, cols[1]);
      if (layer === 2) R(x + 3, ty + 2, 2, 2, '#4a7a34');
    }
  }
  for (let x = -M; x < W + M; x += 8) { R(x, -14, 1, 10, '#6a5a42'); if ((x >> 3) % 4 === 0) R(x, -16, 1, 12, '#5a4a32'); } R(-M, -12, W + 2 * M, 1, 'rgba(160,164,150,0.5)'); R(-M, -8, W + 2 * M, 1, 'rgba(160,164,150,0.4)'); // deer fence
  { const sx = 40 * TS, sy = -30; R(sx, sy, 2, 18, '#5a3e2a'); R(sx - 8, sy, 20, 6, '#2f5a3a'); R(sx - 8, sy, 20, 1, '#46804e'); pixelText(ctx, 'PATH', sx - 6, sy + 1, '#e8dfc6'); R(sx + 12, sy + 1, 3, 4, '#2f5a3a'); }
  { const fx = 58 * TS, fy = -22; R(fx, fy, 70, 7, '#4a3a28'); R(fx, fy, 70, 2, '#6a5438'); for (let i = 6; i < 70; i += 9) R(fx + i, fy + 2, 1, 4, '#3a2a1e'); R(fx + 68, fy - 3, 10, 13, '#5a4632'); R(fx + 70, fy - 1, 6, 9, '#3a2a1e'); R(fx + 74, fy + 2, 1, 1, '#c8b88a'); } // a fallen trunk, ring end showing
  // ---- east: the river, the far bank, reeds, a blocked footbridge, a narrowboat, a drowned car ----
  for (let y = 0; y < H; y += 3) R(W, y, 34, 1, (y >> 1) % 3 ? '#356486' : '#2a5070');
  for (let y = 0; y < H; y += 7) R(W + 4 + ((y * 13) % 24), y, 4, 1, '#4a7a98');
  R(W + 34, -M, M - 34, H + 2 * M, '#3e5a2a'); R(W + 34, 0, 2, H, '#5a4a32'); // far bank
  for (let y = 0; y < H; y += 4) if (rng.next() < 0.6) { const rx = W + 30 + rng.int(0, 6); R(rx, y, 1, 5, '#6a8a3a'); R(rx + 2, y + 1, 1, 4, '#8aa04a'); R(rx + 1, y - 1, 1, 2, '#6a5a32'); } // reeds
  for (let y = 0; y < H; y += 20) { const tx = W + 40 + rng.int(0, 14), ty = y + rng.int(0, 10); R(tx, ty, 12, 10, '#1d3818'); R(tx + 2, ty - 2, 8, 6, '#264a1e'); }
  { const by = 14 * TS; R(W - 2, by, 38, 10, '#6a5a42'); R(W - 2, by, 38, 2, '#8a7a5a'); for (let i = 0; i < 38; i += 5) R(W - 2 + i, by - 3, 1, 3, '#5a4a32'); R(W + 14, by - 4, 10, 14, '#b5503b'); R(W + 15, by - 3, 8, 2, '#e8dfc6'); R(W + 8, by + 2, 4, 6, '#3a3d40'); } // the footbridge, a barrier across it
  { const nx = W + 10, ny = 26 * TS; R(nx, ny, 16, 72, '#1d1d20'); R(nx + 1, ny + 2, 14, 68, '#2f5a3a'); R(nx + 3, ny + 10, 10, 40, '#7a3a35'); R(nx + 3, ny + 10, 10, 2, '#9a4a42'); for (let i = 0; i < 4; i++) R(nx + 6, ny + 16 + i * 8, 4, 3, '#26333f'); R(nx + 5, ny + 56, 6, 6, '#c9a24a'); R(nx + 7, ny - 2, 2, 3, '#3a3a3e'); R(nx - 1, ny + 4, 1, 64, 'rgba(160,200,230,0.4)'); } // a narrowboat moored
  { const cx = W + 8, cy = 46 * TS; R(cx, cy, 18, 10, '#4a5a68'); R(cx + 2, cy + 2, 14, 5, '#7a8a96'); R(cx + 3, cy + 3, 5, 3, '#26333f'); R(cx - 2, cy + 10, 22, 1, 'rgba(160,200,230,0.5)'); } // a car roof, just under
  // ---- south: crop rows running off, bales, a tractor stopped mid-field, a farmhouse, a pylon line ----
  for (let y = H + 4; y < H + M; y += 4) { R(-M, y, W + 2 * M, 1, '#5a4c2a'); for (let x = -M + ((y >> 2) % 2) * 3; x < W + M; x += 6) R(x, y + 1, 2, 2, '#7a8a3a'); }
  for (let k = 0; k < 10; k++) { const bx = rng.int(0, W - 20), by = H + 22 + rng.int(0, 24); R(bx, by, 10, 8, '#c8a858'); R(bx, by, 10, 2, '#e2c070'); R(bx + 4, by, 1, 8, '#a8884a'); }
  { const tx = 28 * TS, ty = H + 26; R(tx, ty, 20, 12, '#a8302a'); R(tx, ty, 20, 2, '#c8483a'); R(tx + 12, ty - 6, 8, 8, '#2b2a2e'); R(tx + 13, ty - 5, 6, 4, '#4a5a68'); R(tx - 2, ty + 8, 8, 8, '#1d1d20'); R(tx + 16, ty + 10, 6, 6, '#1d1d20'); R(tx - 18, ty + 3, 18, 6, '#6a665c'); for (let i = 0; i < 18; i += 3) R(tx - 18 + i, ty + 3, 1, 6, '#4a4640'); } // tractor, a harrow behind
  { const fx = 66 * TS, fy = H + 18; R(fx, fy + 8, 40, 26, '#2a2622'); R(fx - 4, fy, 48, 10, '#1d1a18'); R(fx + 8, fy - 6, 6, 8, '#2a2622'); R(fx + 6, fy + 14, 6, 6, '#3a2a1e'); R(fx + 26, fy + 14, 6, 6, '#c86a2a'); } // the farmhouse, one window lit by its fire
  for (const px of [10 * TS, 52 * TS, 88 * TS]) { const py = H + 30; R(px, py - 26, 2, 30, '#55585c'); R(px - 8, py - 22, 18, 1, '#55585c'); R(px - 5, py - 14, 12, 1, '#55585c'); for (let i = 0; i < 6; i++) { R(px - i, py - 26 + i * 5, 1, 2, '#55585c'); R(px + 1 + i, py - 26 + i * 5, 1, 2, '#55585c'); } }
  for (let x = 10 * TS; x < 88 * TS; x += 4) { const t = ((x - 10 * TS) % (42 * TS)) / (42 * TS); R(x, H + 8 + Math.round(Math.sin(t * Math.PI) * 4), 2, 1, '#2b2a2e'); } // the line sags between pylons
  // ---- west: the bypass. Two carriageways, a crash barrier, cars nose to tail, an overturned lorry, a burnt bus ----
  R(-M, 0, 26, H, '#34363a'); R(-M + 28, 0, 6, H, '#4a6a3a'); R(-M + 34, 0, M - 34, H, '#3a3c40');
  for (let y = 0; y < H; y += 24) { R(-M + 12, y, 2, 12, '#c8bf9a'); R(-M + 47, y + 6, 2, 12, '#c8bf9a'); }
  for (let y = 0; y < H; y += 2) R(-M + 26, y, 2, 1, '#9aa3a8'); // the central barrier
  const cars = ['#b5503b', '#4d7fb8', '#e8dfc6', '#6f787d', '#2f5a3a', '#e2b53c', '#7a3a35'];
  for (let y = 4; y < H; y += 30 + rng.int(0, 6)) { if (y > 8 * TS && y < 13 * TS) continue; if (y > 38 * TS && y < 42 * TS) continue; const c = cars[rng.int(0, cars.length - 1)], x = -M + 4; R(x, y, 14, 24, '#1d1d20'); R(x + 1, y + 1, 12, 22, c); R(x + 2, y + 5, 10, 4, '#26333f'); R(x + 2, y + 16, 10, 3, '#26333f'); R(x + 1, y + 1, 12, 1, shade(c, 0.3)); if (rng.next() < 0.3) R(x + 3, y + 10, 8, 5, '#2b2a2e'); } // nose to tail, some burnt out
  { const lx = -M + 36, ly = 8 * TS; R(lx, ly, 26, 70, '#1d1d20'); R(lx + 1, ly + 1, 24, 50, '#8a857a'); for (let i = 0; i < 50; i += 6) R(lx + 1, ly + 1 + i, 24, 1, '#6a665c'); R(lx + 1, ly + 53, 24, 16, '#2f4060'); R(lx + 4, ly + 56, 18, 5, '#26333f'); for (const yy of [ly + 8, ly + 30, ly + 60]) { R(lx - 3, yy, 4, 7, '#1d1d20'); } R(lx + 6, ly + 20, 14, 2, '#e8dfc6'); } // the lorry on its side, wheels to the town
  { const bx = -M + 4, by = 38 * TS; R(bx, by, 22, 60, '#1d1a18'); R(bx + 1, by + 1, 20, 58, '#3a3530'); for (let i = 4; i < 56; i += 8) R(bx + 3, by + i, 16, 4, '#14100d'); R(bx + 6, by + 20, 6, 3, '#8a2a10'); } // the burnt-out bus
  { const sx = -M + 30, sy = 24 * TS; R(sx + 6, sy + 14, 2, 14, '#55585c'); R(sx, sy, 28, 15, '#e8dfc6'); R(sx + 1, sy + 1, 26, 13, '#2f5a9a'); pixelText(ctx, 'ZION', sx + 4, sy + 2, '#f2ead6'); pixelText(ctx, '1/2', sx + 7, sy + 8, '#f2ead6'); } // ZION 1/2
  // ---- the far north-east: Hilltop's mast on the horizon (the glow and light are live) ----
  { const hx = HILLTOP.x, hy = HILLTOP.y; R(hx - 30, hy + 10, 70, 8, '#14240f'); R(hx - 18, hy + 4, 46, 8, '#14240f'); R(hx, hy - 30, 2, 40, '#22262a'); for (let i = 0; i < 8; i++) { R(hx - 3 + (i >> 1), hy - 28 + i * 5, 2, 1, '#22262a'); R(hx + 3 - (i >> 1), hy - 28 + i * 5, 1, 1, '#22262a'); } R(hx - 10, hy - 4, 10, 1, '#22262a'); }
  // depth: everything beyond is darker and greyer, more so further out
  for (let k = 0; k < 3; k++) {
    const d = (MARGIN - k) * TS, a = [0.18, 0.12, 0.06][k], c = `rgba(28,30,38,${a})`;
    R(-M, -M, W + 2 * M, d, c); R(-M, H + M - d, W + 2 * M, d, c); R(-M, 0, d, H, c); R(W + M - d, 0, d, H, c);
  }
}

// ---------------- the border: one material per side, set pieces, buried corners ----------------
// Called per outer ring tile instead of the old fence(); bar = the tile is a spawn barricade (framed, not filled).
export function drawBorder(ctx, x, y, bar, rng) {
  const R = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); };
  const px = x * TS, py = y * TS;
  if (y === 1) return north(R, px, py, x, bar, rng);
  if (y === 62) return south(R, px, py, x, bar, rng);
  if (x === 94) return east(R, px, py, y, bar, rng);
  return west(R, px, py, y, bar, rng);
}
const frameH = (R, px, py, c0, c1) => { R(px - 1, py - 6, 3, TS + 6, c0); R(px + 14, py - 6, 3, TS + 6, c0); R(px - 1, py - 6, 3, 1, c1); R(px + 14, py - 6, 3, 1, c1); };
const frameV = (R, px, py, c0, c1) => { R(px + 1, py - 2, 14, 3, c0); R(px + 1, py + 15, 14, 3, c0); R(px + 1, py - 2, 14, 1, c1); };

// North: overgrown hedge with gaps plugged by doors and pallets, a dry-stone stretch by the church
function north(R, px, py, x, bar, rng) {
  if (bar) { frameH(R, px, py, '#2f6f2c', '#46963a'); R(px - 3, py - 8, 22, 3, '#2f6f2c'); return; } // a window cut through the hedge
  if (x >= 3 && x <= 16) { // dry-stone wall: rounded stones, no mortar, a coping of edge-set stones
    R(px, py - 2, TS, TS + 2, '#5a564e');
    for (let r = 0; r < 4; r++) for (let i = (r % 2) * 3 - 3; i < TS; i += 5) { const c = ['#8a8578', '#9a958a', '#7a766a'][(x + i + r) % 3]; R(px + Math.max(0, i), py - 1 + r * 4, Math.min(4, TS - Math.max(0, i)), 3, c); R(px + Math.max(0, i), py - 1 + r * 4, 2, 1, shade(c, 0.15)); }
    for (let i = 0; i < TS; i += 3) R(px + i, py - 6, 2, 5, (x + i) % 2 ? '#8a8578' : '#6a665c');
    if (x % 5 === 2) { R(px + 3, py + 2, 5, 3, '#4e7a30'); R(px + 10, py + 9, 4, 2, '#4e7a30'); }
    return;
  }
  const k = x % 13;
  if (k === 5 || k === 6) { // a gap plugged with a door, then a pallet
    if (k === 5) { R(px + 1, py - 6, 14, TS + 4, '#4d7fb8'); R(px + 1, py - 6, 14, 1, '#6a9ad0'); R(px + 3, py - 3, 10, 6, '#3a6290'); R(px + 3, py + 6, 10, 6, '#3a6290'); R(px + 12, py + 4, 2, 2, '#e2c060'); }
    else { R(px, py - 6, TS, TS + 4, '#3a2e24'); for (let j = -6; j < TS - 2; j += 4) { R(px, py + j, TS, 3, '#c49a62'); R(px, py + j, TS, 1, '#d8b07a'); } }
    R(px, py - 8, 3, TS + 6, '#2f6f2c'); R(px + 13, py - 8, 3, TS + 6, '#2f6f2c'); return;
  }
  const bump = (i) => ((x * 7 + i * 3) % 4);
  R(px, py - 4, TS, TS + 4, '#2f6f2c');
  for (let i = 0; i < TS; i += 4) { R(px + i, py - 6 - bump(i), 4, 3 + bump(i), '#2f6f2c'); R(px + i + 1, py - 6 - bump(i), 2, 1, '#46963a'); }
  R(px, py - 3, TS, 3, '#46963a'); R(px + rng.int(1, 10), py - 2, 4, 2, '#6cbf4a'); R(px, py + TS - 3, TS, 3, '#1f4a1e');
  for (let i = 0; i < 5; i++) R(px + rng.int(0, 14), py + rng.int(-2, 10), 2, 1, i % 2 ? '#1f4a1e' : '#5aa040');
  if (k === 10) for (let i = 0; i < 4; i++) R(px + rng.int(0, 13), py + rng.int(0, 10), 2, 2, '#d8d0b0'); // bindweed flowers
}
// East: the river bank. Embankment and sandbags, a riverside chain-link with lifebuoy posts
function east(R, px, py, y, bar, rng) {
  if (bar) { frameV(R, px, py, '#a89a70', '#c8b88a'); for (const yy of [py - 6, py + 17]) { R(px + 2, yy, 6, 4, '#a89a70'); R(px + 9, yy, 6, 4, '#a89a70'); } return; } // sandbags round the gap
  const k = y % 11;
  R(px, py, TS, TS, '#5a4a32'); R(px, py, 3, TS, '#6e5a42'); // the embankment top
  if (k < 5) { for (let j = 0; j < TS; j += 4) for (let i = (j >> 2) % 2 ? 1 : 4; i < 14; i += 6) { R(px + i, py + j, 6, 4, '#a89a70'); R(px + i, py + j, 6, 1, '#c8b88a'); R(px + i + 5, py + j + 1, 1, 3, '#7a6e50'); } } // sandbags
  else { R(px + 7, py, 2, TS, 'rgba(20,24,28,0.25)'); for (let j = 0; j < TS; j += 2) for (let i = 5 + ((j >> 1) % 2); i < 11; i += 2) R(px + i, py + j, 1, 1, '#9aa3a8'); R(px + 7, py, 1, TS, '#6f787d'); }
  if (y % 9 === 4) { R(px + 6, py + 2, 4, 12, '#5a5e64'); R(px + 3, py + 3, 10, 10, '#d84a3a'); R(px + 5, py + 5, 6, 6, '#5a4a32'); R(px + 3, py + 6, 2, 3, '#f2ead6'); R(px + 11, py + 6, 2, 3, '#f2ead6'); } // a lifebuoy on its post
  R(px + TS - 2, py, 2, TS, 'rgba(20,16,12,0.3)');
  void rng;
}
// South: a farm gate, post-and-rail, then the car barricade where the south road leaves town
function south(R, px, py, x, bar, rng) {
  if (bar) { frameH(R, px, py, '#8f6a3e', '#c49a62'); return; }
  if (x >= 45 && x <= 51) { // cars across the road out, nose to tail, one on its roof
    const c = ['#4d7fb8', '#b5503b', '#e8dfc6', '#6f787d', '#2f5a3a', '#e2b53c', '#7a3a35'][x - 45];
    R(px - 1, py - 4, 18, 18, '#1d1d20'); R(px, py - 3, TS, 14, c); R(px, py - 3, TS, 1, shade(c, 0.3)); R(px + 2, py, 12, 4, x === 48 ? '#2b2a2e' : '#26333f'); R(px + 1, py + 11, 3, 3, '#1d1d20'); R(px + 12, py + 11, 3, 3, '#1d1d20');
    if (x === 48) { R(px + 3, py + 5, 10, 2, '#8a2a10'); R(px, py - 7, TS, 3, '#1d1d20'); } // the one they burnt
    return;
  }
  if (x % 12 === 3 || x % 12 === 4) { // a five-bar farm gate, chained
    for (let j = 0; j < 5; j++) R(px, py - 4 + j * 3, TS, 1, '#c8c0a8'); R(px + (x % 12 === 3 ? 0 : 15), py - 6, 1, 18, '#a8a088');
    for (let i = 0; i < 6; i++) R(px + i * 3, py - 4 + Math.min(12, i * 2.4), 2, 1, '#c8c0a8');
    if (x % 12 === 4) { R(px, py + 1, 3, 3, '#6f787d'); R(px + 1, py + 2, 1, 1, '#2f2f33'); }
    R(px, py + 12, TS, 2, 'rgba(20,16,12,0.3)'); return;
  }
  // post and rail, the rails at slightly different sags
  R(px + 1, py - 8, 3, 22, '#6b4a2e'); R(px + 1, py - 8, 1, 22, '#8f6a3e');
  const s = (x % 3) - 1; R(px, py - 4, TS, 2, '#8f6a3e'); R(px, py + 2 + s, TS, 2, '#8f6a3e'); R(px, py + 8, TS, 2, '#7a5a3a'); R(px, py - 4, TS, 1, '#a8804e');
  if (rng.next() < 0.3) R(px + rng.int(4, 12), py + 10, 3, 4, '#7a8a3a'); // nettles
  R(px, py + 12, TS, 2, 'rgba(20,16,12,0.25)');
}
// West: crash barrier plus a wall of stacked cars, a lorry trailer across the slip road
function west(R, px, py, y, bar, rng) {
  if (bar) { frameV(R, px, py, '#9aa3a8', '#c0c4c8'); R(px - 2, py - 8, 8, 6, '#b5503b'); R(px - 2, py + 18, 8, 6, '#4d7fb8'); return; } // the gap between two car bonnets
  if (y >= 30 && y <= 34) { // the trailer across the slip road
    R(px - 4, py, 22, TS, '#8a857a'); R(px - 4, py, 22, 1, '#a8a398'); if (y === 30) R(px - 4, py, 22, 3, '#6a665c'); if (y === 34) R(px - 4, py + 13, 22, 3, '#4a4640');
    R(px + 4, py + 4, 8, 8, y === 32 ? '#2f4060' : '#8a857a'); R(px + 15, py + 2, 2, 12, '#55585c');
    if (y === 31 || y === 33) { R(px - 6, py + 4, 4, 8, '#1d1d20'); }
    return;
  }
  const k = y % 10;
  if (k >= 6) { // stacked cars, two high, crushed
    const c = ['#b5503b', '#4d7fb8', '#e8dfc6', '#6f787d'][y % 4];
    R(px, py - 8, TS, 24, '#1d1d20'); R(px + 1, py + 2, 14, 13, c); R(px + 1, py + 2, 14, 1, shade(c, 0.3)); R(px + 3, py + 5, 10, 4, '#26333f');
    const c2 = ['#e2b53c', '#2f5a3a', '#7a3a35', '#9aa3a8'][y % 4]; R(px + 2, py - 7, 13, 9, c2); R(px + 2, py - 7, 13, 1, shade(c2, 0.3)); R(px + 4, py - 5, 8, 3, '#2b2a2e');
    return;
  }
  // the crash barrier: a galvanised W-beam on posts, the verge behind it
  R(px, py, TS, TS, '#46623a'); R(px + 6, py, 4, TS, '#7a7e80'); R(px + 6, py, 1, TS, '#b0b8bc'); R(px + 9, py, 1, TS, '#55585c'); R(px + 7, py + 3, 2, 2, '#55585c'); R(px + 7, py + 11, 2, 2, '#55585c');
  if (y % 2 === 0) { R(px + 10, py + 5, 3, 3, '#3a3a3e'); } if (k === 2) { R(px + 5, py + 4, 6, 6, '#c86a2a'); R(px + 6, py + 5, 4, 1, '#e8dfc6'); } // a reflector, a dent
  void rng;
}

// Set pieces and corners, drawn after the border tiles so they sit on top (still all on blocked or outside tiles).
export function drawSetPieces(ctx, map) {
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const W = map.W * TS, H = map.H * TS;
  const clump = (x, y, n, seed) => { const r = new RNG(seed); for (let i = 0; i < n; i++) { const tx = x + r.int(-20, 20), ty = y + r.int(-20, 20), s = r.int(12, 20); R(tx, ty + 2, s, s - 3, '#1f4a1e'); R(tx + 2, ty, s - 4, s, '#1f4a1e'); R(tx + 2, ty + 1, s - 6, s - 6, '#2f6f2c'); R(tx + 3, ty + 2, s / 2, s / 2 - 1, '#46963a'); R(tx + 4, ty + 2, 3, 2, '#6cbf4a'); } };
  // north: a tree down across the fence, root plate beyond; a scaffold tower at the builders' yard
  { const tx = 28 * TS, ty = 1 * TS - 4; R(tx - 20, ty - 26, 18, 22, '#5a4632'); R(tx - 18, ty - 24, 14, 18, '#3a2a1e'); for (let i = 0; i < 5; i++) R(tx - 20 + i * 4, ty - 4, 2, 4, '#5a4632'); R(tx - 6, ty - 8, 46, 6, '#4a3a28'); R(tx - 6, ty - 8, 46, 2, '#6a5438'); R(tx + 30, ty - 14, 26, 18, '#2f6f2c'); R(tx + 33, ty - 12, 12, 8, '#46963a'); }
  { const sx = 80 * TS, sy = 1 * TS - 30; for (const dx of [0, 22]) R(sx + dx, sy, 2, 36, '#9aa3a8'); for (let j = 0; j < 36; j += 9) R(sx, sy + j, 24, 2, '#9aa3a8'); R(sx + 2, sy + 9, 20, 3, '#c49a62'); R(sx + 2, sy + 27, 20, 3, '#c49a62'); R(sx + 1, sy, 22, 1, '#c0c4c8'); }
  // east: a shipping container end-on in the bank; a burnt-out van wedged into the gap
  { const cx = 94 * TS - 6, cy = 20 * TS; R(cx, cy, 30, 56, '#1d1d20'); R(cx + 1, cy + 1, 28, 54, '#2f6a8a'); for (let j = 3; j < 54; j += 4) R(cx + 1, cy + j, 28, 1, '#24546e'); R(cx + 1, cy + 1, 28, 1, '#4a8aa8'); R(cx + 3, cy + 4, 8, 3, '#e8dfc6'); }
  { const vx = 94 * TS - 2, vy = 44 * TS; R(vx, vy, 22, 36, '#14100d'); R(vx + 1, vy + 1, 20, 34, '#2b2622'); R(vx + 3, vy + 4, 16, 6, '#14100d'); R(vx + 4, vy + 14, 6, 3, '#8a2a10'); R(vx + 14, vy + 22, 4, 4, '#4a3a30'); }
  // south: the collapsed wall of a barn, a container
  { const bx = 76 * TS, by = 62 * TS - 10; R(bx, by, 70, 22, '#6a3a2a'); for (let i = 0; i < 70; i += 6) R(bx + i, by, 3, 4 + ((i * 7) % 9), '#14100d'); R(bx, by + 18, 70, 4, '#4a2a20'); for (let k = 0; k < 12; k++) R(bx + ((k * 23) % 66), by + 20 + (k % 3) * 3, 5, 3, ['#8a4a36', '#6a3a2a', '#9a958a'][k % 3]); R(bx + 20, by - 4, 30, 3, '#3a3530'); }
  { const cx = 18 * TS, cy = 62 * TS - 8; R(cx, cy, 58, 26, '#1d1d20'); R(cx + 1, cy + 1, 56, 24, '#a8402f'); for (let i = 3; i < 56; i += 4) R(cx + 1 + i, cy + 1, 1, 24, '#86321f'); R(cx + 1, cy + 1, 56, 1, '#c86048'); pixelText(ctx, 'MAERS', cx + 6, cy + 8, '#e8dfc6'); }
  // west: the bus nosed through the barrier near the north-west
  { const bx = 1 * TS - 14, by = 12 * TS; R(bx, by, 26, 60, '#1d1a18'); R(bx + 1, by + 1, 24, 58, '#2f5a3a'); for (let j = 6; j < 54; j += 8) R(bx + 4, by + j, 18, 5, '#14100d'); R(bx + 1, by + 1, 24, 2, '#46804e'); }
  // corners: never a right angle. Trees in three, a ruined cottage in the south-west
  // Phase F notch (town.js NOTCHES, tiles 2-4 x 2-3): the fence steps in round a collapsed cottage, trees behind it
  clump(0, 0, 5, 11);
  { const cx = 2 * TS, cy = 2 * TS - 8; R(cx - 2, cy, 50, 40, '#4a3e34'); R(cx, cy + 2, 46, 36, '#2f2620'); R(cx - 2, cy, 50, 3, '#9a958a'); R(cx - 2, cy, 3, 40, '#8a8578'); R(cx + 45, cy, 3, 26, '#6a665c');
    for (let i = 0; i < 10; i++) R(cx + 4 + ((i * 13) % 38), cy + 6 + ((i * 7) % 26), 6, 4, ['#8a8578', '#6a665c', '#5a3e2a', '#9b4a36'][i % 4]); // fallen stone and slates
    R(cx + 6, cy - 10, 10, 18, '#8a8578'); R(cx + 6, cy - 10, 10, 2, '#a8a398'); R(cx + 14, cy - 8, 2, 16, '#6a665c'); // the chimney still standing
    for (let i = 0; i < 4; i++) R(cx + 20 + i * 6, cy + 4, 2, 30 - i * 6, '#5a3e2a'); // roof timbers, charred
    R(cx + 30, cy + 22, 14, 12, '#2f6f2c'); R(cx + 32, cy + 23, 6, 4, '#46963a'); R(cx, cy + 40, 50, 3, 'rgba(20,16,12,0.35)'); } clump(94 * TS, 1 * TS, 7, 12); clump(94 * TS + 4, 62 * TS, 6, 13);
  { const cx = 1 * TS - 40, cy = 62 * TS - 30; R(cx, cy, 60, 50, '#5a4a40'); R(cx + 4, cy + 4, 52, 42, '#3a2e26'); R(cx, cy, 60, 4, '#8a857a'); R(cx, cy, 4, 50, '#8a857a'); for (let i = 0; i < 8; i++) R(cx + 8 + ((i * 17) % 44), cy + 10 + ((i * 11) % 30), 6, 4, ['#8a857a', '#6a665c', '#5a3e2a'][i % 3]); R(cx + 44, cy - 6, 10, 16, '#8a857a'); R(cx + 44, cy - 6, 10, 2, '#a8a398'); R(cx + 10, cy + 30, 14, 10, '#2f6f2c'); R(cx + 12, cy + 31, 6, 4, '#46963a'); } // walls to the sills, the chimney standing, a tree growing in the room
  void W; void H;
}
