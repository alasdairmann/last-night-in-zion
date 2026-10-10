// Bakes the static town into one canvas (PRD §23.4, ART-PRD D4-D7): ground tiles, walls and fences, roofs and
// front faces, props and decor. Daytime colours; the wave lighting is applied by the lighting pass.
// Zion's year of silence shows everywhere (felt, rags, tied bells, chalk SHH); tonight's damage sits on top.
import { FLOOR, WALL, BLD, OUT, PROP, DOOR, BAR, G } from '../map/town.js';
import { RNG } from '../rng.js';
import { GROUND as GROUND_PAL, RAMP } from './palette.js';
import { drawDividers } from './dividers.js';
import { drawRoof } from './roofs.js';
import { drawLawns, drawBlockTrees, drawRoadWear, lamp, tree as treeOf } from './scatter.js';
import { MARGIN, drawApron, drawBorder, drawSetPieces } from './beyond.js';
import { makeCanvas, pixelText, pixelTextWidth, shade, icon, iconWhite } from './sprites.js';
import { MELEE, GUNS, THROWS, COMFORTS } from '../data.js';

const TS = 16;
const GROUND = Object.fromEntries(Object.entries(GROUND_PAL).map(([k, v]) => [G[k], v]));
GROUND[G.FLOORBOARD] = ['#7a5434', '#6b4a2e', '#5a3e26', '#8a6040'];
const CHALK = '#d8d4c8';

// v1.4 H2: where each building's front door is drawn (static-map pixels, before the apron offset), for the door audit
export function doorRects(map) {
  return map.buildings.filter((b) => !['garage', 'fire', 'cabin'].includes(b.kind)).map((b) => {
    const px = b.x * TS, py = b.y * TS, w = b.w * TS, h = b.h * TS, fy = py + h - TS - 6;
    return { name: b.name || `${b.kind} at ${b.x},${b.y}`, face: { x: px, y: fy - 12, w, h: TS + 30 }, door: { x: px + w - TS * 2 - 3, y: fy + 3, w: 14, h: 22 } };
  });
}
export const MAP_HD = 2; // the static map is baked at 2x so ground and buildings can carry half-pixel detail
export function buildStatic(map) {
  const W = map.W, H = map.H;
  // S3: the canvas carries a MARGIN-tile apron on every side; c.ox / c.oy is where map pixel (0, 0) sits
  const c = makeCanvas((W + 2 * MARGIN) * TS * MAP_HD, (H + 2 * MARGIN) * TS * MAP_HD); const ctx = c.getContext('2d');
  c.ox = c.oy = MARGIN * TS; ctx.scale(MAP_HD, MAP_HD); ctx.translate(c.ox, c.oy);
  drawApron(ctx, map);
  const rng = new RNG(1234);
  const R = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  const tiles = map.tiles, ground = map.ground;
  const T = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? OUT : tiles[y * W + x];
  const Gd = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? -1 : ground[y * W + x];
  const isRoad = (g) => g === G.ROAD || g === G.TARMAC || g === G.BYPASS;

  // ---- ground (D4) ----
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { groundTile(ctx, Gd(x, y), x, y, rng, Gd, isRoad); groundHD(ctx, Gd(x, y), x, y, isRoad); }
  // road markings: faded, with gaps where worn
  for (let x = 2; x < 94; x += 2) if (rng.next() > 0.12) { const wx = x * TS + 2, wy = 32 * TS + 7; R(wx, wy, 10, 2, '#c8bf9a'); R(wx + rng.int(1, 8), wy, 2, 1, '#8a8676'); R(wx + rng.int(1, 8), wy + 1, 1, 1, '#6e6c66'); }
  for (let y = 2; y < 62; y += 2) if ((y < 31 || y > 33) && rng.next() > 0.12) { const wx = 48 * TS + 7, wy = y * TS + 2; R(wx, wy, 2, 10, '#c8b860'); R(wx, wy + rng.int(1, 8), 1, 2, '#8a8460'); }
  for (let x = 16; x < 31; x += 3) { R(x * TS, 47 * TS, 1, 2 * TS, '#c8bf9a'); R(x * TS, 53 * TS, 1, 2 * TS, '#c8bf9a'); R(x * TS, 47 * TS + rng.int(4, 24), 1, 3, '#55585c'); }
  for (let i = 0; i < 4; i++) { R(45 * TS + i * 6, 34 * TS + 4, 3, 10, '#d8d0b0'); R(45 * TS + i * 6 + 1, 34 * TS + 6 + rng.int(0, 5), 1, 2, '#9a9688'); }

  drawRoadWear(ctx, map); drawLawns(ctx, map); // VA-9, VA-2
  // trees in the woods ring + river banks
  for (let x = 0; x < W; x += 1) if (rng.next() < 0.7) tree(ctx, x * TS + rng.int(0, 8), rng.int(-6, 8), rng);
  for (let y = 4; y < 60; y += 3) if (rng.next() < 0.5) tree(ctx, rng.int(-4, 4), y * TS, rng);

  // ---- walls and fences (D5) ----
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = T(x, y); const px = x * TS, py = y * TS;
    if (t === WALL || t === DOOR || t === BAR) {
      const outer = x === 1 || x === 94 || y === 1 || y === 62;
      if (t === DOOR) continue; // drawn per door
      if (outer) drawBorder(ctx, x, y, t === BAR, rng);
    }
  }
  drawSetPieces(ctx, map); // S3.2: set pieces breaking the border, buried corners
  drawDividers(ctx, map, T); // S2: the inner walls, one boundary type per segment
  // ---- buildings (D6) ----
  for (const b of map.buildings) building(ctx, b, rng);
  drawBlockTrees(ctx, map); // VA-2 / VA-4
  // the Red Lion's inner rooms (safe house), cut away so you can see inside
  { const b = map.pub, x0 = b.x0, y0 = b.y0 - 6, w = b.x1 - b.x0, h = b.y1 - b.y0 + 6;
    R(x0 - 2, y0 - 2, w + 4, h + 2, '#2b1d16');
    for (let yy = y0; yy < y0 + h; yy += 4) {
      R(x0, yy, w, 4, (yy / 4) % 2 ? '#7a5434' : '#6b4a2e'); R(x0, yy, w, 1, '#8a6040'); R(x0, yy + 3, w, 1, '#4a3020');
      for (let xx = x0 + ((yy / 4) % 3) * 9; xx < x0 + w; xx += 27) { R(xx, yy, 1, 4, '#4a3020'); R(xx + 7, yy + 1, 1, 1, '#4a3020'); }
    }
    // VA-8: years of feet. A worn, paler track from the door to the bar, the odd replaced board, a spill, a rug by the stove.
    { const dr = map.pub.door, bx = x0 + 5 * TS, by = y0 + 34;
      for (let t = 0; t <= 1; t += 1 / 40) { const px = Math.round(dr.x + (bx - dr.x) * t), py = Math.round(dr.y - 6 + (by - dr.y + 6) * t);
        if (py > y0 + 6 && py < y0 + h) for (let k = -5; k <= 5; k += 2) if ((px + k * 7 + py) % 5) R(px + k, py, 2, 1, Math.abs(k) < 3 ? '#9a7450' : '#8a6444'); } }
    for (let i = 0; i < 5; i++) { const rx = x0 + 12 + ((i * 53) % Math.max(1, w - 30)), ry = y0 + 8 + 4 * ((i * 7 + 3) % Math.max(1, (h - 12) / 4 | 0)); R(rx, ry, 14, 4, '#a07a4a'); R(rx, ry, 14, 1, '#b8905a'); R(rx, ry + 3, 14, 1, '#6a4a2a'); R(rx + 1, ry + 1, 1, 1, '#4a3020'); R(rx + 12, ry + 1, 1, 1, '#4a3020'); } // replaced boards, still pale, nail heads
    { const sx = x0 + 4 * TS + 18, sy = y0 + 40; R(sx, sy, 7, 2, '#4a3020'); R(sx + 2, sy - 1, 4, 4, '#4a3020'); R(sx + 8, sy + 1, 2, 1, '#4a3020'); R(sx + 3, sy, 1, 1, '#5e3e26'); } // an old spill below the bar
    { const rx = x0 + 3, ry = y0 + 20; R(rx, ry, 20, 11, '#6a2a22'); R(rx + 1, ry + 1, 18, 9, '#8a3a2a'); R(rx + 3, ry + 3, 14, 5, '#a8603a'); R(rx + 5, ry + 4, 10, 3, '#6a2a22'); R(rx + 9, ry + 5, 2, 1, '#e2b53c'); for (let i = 0; i < 20; i += 2) { R(rx + i, ry - 1, 1, 1, '#c8bf9a'); R(rx + i, ry + 11, 1, 1, '#c8bf9a'); } R(rx + 14, ry + 7, 3, 2, '#3a1a14'); } // the hearth rug, a scorch where a coal jumped
    for (let i = 0; i < 6; i++) { const fx = x0 + 10 + i * 22, fy = y0 + 34 + (i % 2) * 8; if (fx < x0 + w - 8) feltPad(R, fx, fy); } // felt along the routes
    R(x0, y0, w, 6, '#9b4a36'); R(x0, y0 + 5, w, 1, '#5a2a20'); for (let xx = x0; xx < x0 + w; xx += 5) R(xx, y0 + 1 + (xx % 2), 4, 1, '#b5604a');
    R(x0 + 4 * TS, y0 + 26, 3 * TS, 7, '#5a3e2a'); R(x0 + 4 * TS, y0 + 26, 3 * TS, 2, '#8f6a3e'); R(x0 + 4 * TS, y0 + 32, 3 * TS, 1, '#3a2a1e'); // the bar
    for (let i = 0; i < 4; i++) { R(x0 + 4 * TS + 6 + i * 10, y0 + 22, 3, 4, ['#e2b53c', '#5d8a4a', '#b5503b', '#e8dfc6'][i]); R(x0 + 4 * TS + 7 + i * 10, y0 + 20, 1, 2, '#3a3530'); } // pumps
    for (let i = 0; i < 4; i++) { const sx = x0 + 4 * TS + 4 + i * 12; R(sx, y0 + 35, 4, 2, '#8a857a'); R(sx, y0 + 35, 4, 1, '#a8a398'); R(sx + 1, y0 + 37, 1, 3, '#3a2a1e'); } // stools wrapped in felt
    R(x0 + 6, y0 + 10, 12, 8, '#3a3a3e'); R(x0 + 7, y0 + 11, 10, 3, '#d9822b'); R(x0 + 7, y0 + 11, 10, 1, '#f0b030'); // stove
    { const j = map.spots.jukebox; R(j.px - 6, j.py - 22, 12, 16, '#5a3e2a'); R(j.px - 6, j.py - 22, 12, 2, '#8f6a3e'); R(j.px - 5, j.py - 21, 10, 6, '#e2b53c'); R(j.px - 4, j.py - 20, 8, 1, '#f4d070'); R(j.px - 4, j.py - 14, 8, 5, '#b5503b'); for (let i = 0; i < 4; i++) R(j.px - 4 + i * 2, j.py - 13, 1, 3, '#7a2a22'); pixelText(ctx, 'JUKE', j.px - 7, j.py - 28, '#e2b53c'); }
    { const d = map.spots.dartboard; R(d.px - 4, d.py - 26, 8, 8, '#2b1d16'); R(d.px - 3, d.py - 25, 6, 6, '#b5503b'); R(d.px - 2, d.py - 24, 4, 4, '#e8dfc6'); R(d.px - 1, d.py - 23, 2, 2, '#5d8a4a'); }
    const dr = map.pub.door; R(dr.x - 8, dr.y - 8, 16, 16, '#6b4a2e'); R(dr.x - 8, dr.y + 6, 16, 2, '#4a3020');
  }
  { const f = map.spots.fuseboard; R(f.px - 5, f.py - 26, 10, 12, '#4a4d52'); R(f.px - 5, f.py - 26, 10, 1, '#6f787d'); R(f.px - 4, f.py - 25, 8, 3, '#e2b53c'); for (let i = 0; i < 4; i++) R(f.px - 4 + i * 2, f.py - 20, 1, 3, '#2f2f33'); pixelText(ctx, 'FUSE', f.px - 7, f.py - 32, '#c8bf9a'); }
  { const f = map.spots.bench_fire; R(f.px - 7, f.py - 28, 14, 14, '#6f787d'); R(f.px - 7, f.py - 28, 14, 2, '#9aa3a8'); R(f.px - 1, f.py - 26, 1, 12, '#3a3a3e'); for (const dx of [-4, 3]) { R(f.px + dx, f.py - 24, 2, 1, '#3a3a3e'); R(f.px + dx, f.py - 22, 2, 1, '#3a3a3e'); } R(f.px - 6, f.py - 18, 3, 3, '#e2c060'); pixelText(ctx, 'LOCKERS', f.px - 13, f.py - 34, '#c8bf9a'); }
  { const f = map.spots.bench_garage; workbench(R, f.px - 8, f.py - 22, 16); }
  { const f = map.spots.sluice; R(f.px + 2, f.py - 14, 6, 22, '#4a4d52'); R(f.px + 2, f.py - 14, 1, 22, '#6f787d'); R(f.px, f.py - 8, 10, 3, '#6f787d'); R(f.px + 3, f.py - 16, 4, 2, '#b5503b'); R(f.px + 4, f.py - 4, 2, 2, '#8a5a32'); }
  { const f = map.spots.school_mast; mast(R, f.px - 30, f.py - 14); ladder(R, f.px, f.py); paintedArrow(R, f.px, f.py + 10); } // v1.4 B3: the way up, from the walk-on side; v1.6: the mast stands on the roof, not in the lane
  for (const n of ['church_ladder', 'fire_ladder']) ladder(R, map.spots[n].px, map.spots[n].py); // v1.4 B3: light rails so you can see them
  for (const b of map.beacons) { R(b.px - 5, b.py - 2, 10, 6, '#3a3a3e'); R(b.px - 5, b.py - 2, 10, 1, '#5a5a5e'); R(b.px - 4, b.py - 4, 8, 3, '#5a3e2a'); R(b.px - 3, b.py - 5, 2, 2, '#8f6a3e'); R(b.px + 1, b.py - 5, 2, 1, '#6b4a2e'); }
  { const f = map.spots.bbq; R(f.px - 6, f.py - 8, 12, 6, '#2f2f33'); R(f.px - 6, f.py - 8, 12, 1, '#4a4d52'); for (let i = 0; i < 5; i++) R(f.px - 5 + i * 2, f.py - 7, 1, 1, '#6f787d'); R(f.px - 5, f.py - 2, 1, 8, '#2f2f33'); R(f.px + 4, f.py - 2, 1, 8, '#2f2f33'); R(f.px + 7, f.py - 6, 4, 9, '#4d7fb8'); R(f.px + 7, f.py - 6, 1, 9, '#6a9ad0'); R(f.px + 8, f.py - 8, 2, 2, '#3a3a3e'); }
  // ---- props (D7) ----
  let carN = 0;
  for (const p of map.props) if (p.kind !== 'fireengine') prop(ctx, p, rng, p.kind === 'car' ? carN++ : 0); // v1.5 L1: the live engine sprite is the only fire engine
  for (const s of map.crateSpots) { const px = s.x * TS, py = s.y * TS; R(px + 1, py + 10, 14, 5, '#8f6a3e'); R(px + 1, py + 10, 14, 1, '#c49a62'); R(px + 1, py + 14, 14, 1, '#5a3e2a'); R(px + 3, py + 12, 2, 2, '#5a3e2a'); R(px + 11, py + 12, 2, 2, '#5a3e2a'); R(px + 7, py + 11, 1, 3, '#6b4a2e'); }
  for (const t of map.traps) trapProp(ctx, t, rng);
  // racks and comfort signs on facades
  for (const r of map.racks) rack(ctx, r);
  for (const s of map.comfortSpots) comfortSign(ctx, s.x * TS, s.y * TS, s.id);
  comfortSign(ctx, map.secondWind.x * TS, map.secondWind.y * TS, 'secondWind');
  { const w = map.workshop, px = w.x * TS, py = w.y * TS;
    R(px - 16, py + 2, 48, 13, '#2a2a2e'); R(px - 16, py + 2, 48, 2, '#6f787d'); for (let i = 0; i < 48; i += 4) R(px - 16 + i, py + 4, 1, 11, '#3a3a3e');
    for (let i = 0; i < 6; i++) { R(px - 14 + i * 3, py + 5, 1, 2 + (i % 3), '#9aa3a8'); } // tools on the pegboard
    workbench(R, px - 4, py + 8, 24); R(px, py + 5, 3, 3, '#9aa3a8'); R(px + 10, py + 6, 5, 2, '#b5503b'); R(px + 17, py + 4, 4, 4, '#4a4d52'); R(px + 18, py + 5, 2, 1, '#e2b53c'); // vice
    pixelText(ctx, 'WORKSHOP', px - 7, py - 6, '#e2b53c'); }
  { const a = map.ammoCrate, px = a.x * TS, py = a.y * TS; R(px + 2, py + 6, 12, 9, '#5d6b3a'); R(px + 2, py + 6, 12, 2, '#7a8a4a'); R(px + 2, py + 14, 12, 1, '#3e4a26'); R(px + 2, py + 9, 1, 5, '#4a5a2e'); R(px + 13, py + 9, 1, 5, '#4a5a2e'); R(px + 7, py + 7, 2, 1, '#c9a24a'); pixelText(ctx, 'AMMO', px + 1, py + 9, '#e8dfc6'); }
  for (const vt of map.vault) { const px = vt.x * TS, py = vt.y * TS; R(px + 1, py - 2, 14, 15, '#2b1d16'); R(px + 2, py - 1, 12, 13, vt.mode === 'deposit' ? '#6f787d' : '#5d6670'); R(px + 2, py - 1, 12, 2, '#9aa3a8'); R(px + 2, py - 1, 1, 13, '#8a949a'); R(px + 6, py + 3, 4, 4, '#3a3a3e'); R(px + 7, py + 4, 2, 2, '#c9a24a'); R(px + 11, py + 2, 1, 2, '#c0c4c8'); R(px + 11, py + 7, 1, 2, '#c0c4c8'); R(px + 3, py + 10, 2, 1, '#8a5a32'); }
  pixelText(ctx, 'SAFE', map.vault[0].x * TS + 8, map.vault[0].y * TS - 8, '#c8bf9a');
  { const j = map.jerry, px = j.x * TS, py = j.y * TS; for (const dx of [1, 8]) jerryCan(R, px + dx, py + 1); pixelText(ctx, 'DIESEL', px - 3, py - 6, '#e2b53c'); }
  // decor
  for (const d of map.decor) decor(ctx, d, rng);
  map.lamps.forEach((l, i) => lamp(R, l, i)); // VA-6: straight, leaning or smashed
  return c;
}

// ---------------- D4 ground ----------------
function groundTile(ctx, g, x, y, rng, Gd, isRoad) {
  const R = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); };
  const pal = GROUND[g] || GROUND[G.GRASS];
  const px = x * TS, py = y * TS, ri = (a, b) => rng.int(a, b);
  if (isRoad(g)) {
    const T = RAMP.tarmac;
    R(px, py, TS, TS, g === G.BYPASS ? '#36383c' : T[1]);
    ctx.fillStyle = T[2]; for (let j = 0; j < TS; j += 2) for (let i = (j >> 1) % 2 ? 0 : 2; i < TS; i += 4) ctx.fillRect(px + i, py + j, 1, 1); // 25% dither
    for (let k = 0; k < 7; k++) R(px + ri(0, 15), py + ri(0, 15), 1, 1, T[0]); // aggregate flecks
    if (rng.next() < 0.25) crack(R, px + ri(2, 12), py + ri(1, 6), rng, '#26292c');
    if (rng.next() < 0.015) { const hx = px + ri(2, 8), hy = py + ri(3, 10); R(hx, hy, 6, 3, '#202326'); R(hx + 1, hy - 1, 4, 5, '#202326'); R(hx + 1, hy, 4, 2, '#2a3a48'); R(hx + 1, hy, 2, 1, '#5a7a98'); } // pothole with water
    if (rng.next() < 0.18) { const wx = px + ri(2, 11), wy = py + ri(2, 11); R(wx, wy, 1, 2, '#3e6a2a'); R(wx + 1, wy - 1, 1, 2, '#4e962f'); } // weeds in cracks
    for (const [dx, dy] of [[0, -1], [0, 1]]) { const n = Gd(x + dx, y + dy); if (n === G.PAVE && dy === 1 && x % 3 === 0) { R(px + 5, py + 13, 6, 3, '#26292c'); for (let i = 0; i < 3; i++) R(px + 6 + i * 2, py + 13, 1, 3, '#4a4d50'); } } // drain grates at the kerb
    return;
  }
  R(px, py, TS, TS, pal[0]);
  switch (g) {
    case G.PAVE: { // 8x8 slabs, joints, weeds in 1 of 6 joints, kerbs against the road
      for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) { const t = rng.next(); R(px + sx * 8, py + sy * 8, 8, 8, t < 0.3 ? pal[1] : t < 0.5 ? pal[2] : pal[0]); R(px + sx * 8, py + sy * 8, 8, 1, shade(pal[0], 0.08)); }
      R(px, py + 7, TS, 1, '#6b6a62'); R(px + 7, py, 1, TS, '#6b6a62'); R(px, py + 15, TS, 1, '#6b6a62'); R(px + 15, py, 1, TS, '#6b6a62');
      if (rng.next() < 1 / 6) { const wx = px + (rng.next() < 0.5 ? 7 : ri(1, 13)), wy = py + 7; R(wx, wy - 1, 1, 2, '#46963a'); R(wx + 1, wy, 1, 1, '#6cbf4a'); }
      if (rng.next() < 0.1) { R(px + ri(1, 12), py + ri(1, 12), 3, 1, '#7a766a'); } // a cracked slab
      if (isRoad(Gd(x, y + 1))) { R(px, py + 13, TS, 3, '#5f5e56'); R(px, py + 13, TS, 1, '#a8a498'); for (let i = 0; i < TS; i += 8) R(px + i, py + 13, 1, 3, '#4a4a44'); }
      if (isRoad(Gd(x, y - 1))) { R(px, py, TS, 3, '#5f5e56'); R(px, py, TS, 1, '#a8a498'); }
      break;
    }
    case G.GRASS: case G.GRAVE: case G.WOODS: case G.FIELD: { // a year uncut: tufts, not flat fill
      const gr = g === G.WOODS ? ['#2a5a22', '#2f6f2c', '#46863a'] : [RAMP.grass[2], RAMP.grass[1], RAMP.grass[0]];
      const n = g === G.FIELD ? 12 : 9;
      for (let k = 0; k < n; k++) { const tx = px + ri(0, 14), ty = py + ri(2, 15); R(tx, ty, 2, 1, gr[0]); R(tx, ty - 1, 1, 1, gr[1]); R(tx + 1, ty - 2, 1, 2, gr[1]); if (rng.next() < 0.5) R(tx + 1, ty - 3, 1, 1, gr[2]); }
      for (let k = 0; k < 3; k++) R(px + ri(0, 13), py + ri(0, 13), 2 + ri(0, 1), 2, pal[1 + ri(0, 1)]);
      if (g !== G.WOODS && rng.next() < 0.25) R(px + ri(1, 14), py + ri(1, 14), 1, 1, '#e2c03a'); // dandelion
      if (g !== G.WOODS && rng.next() < 0.2) { const cx = px + ri(1, 13), cy = py + ri(1, 13); R(cx, cy, 2, 1, '#e8e8d8'); R(cx, cy + 1, 1, 1, '#c8d8c0'); } // clover
      if (g === G.WOODS && rng.next() < 0.4) R(px + ri(1, 13), py + ri(1, 13), 2, 1, ['#8a5a2a', '#a8742e', '#6b4a2e'][ri(0, 2)]); // leaves
      if (g === G.FIELD) R(px, py, TS, TS, (Math.floor(x / 2) % 2) ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)');
      if (g === G.GRASS && rng.next() < 0.08) { R(px + 3, py + 4, 10, 8, 'rgba(110,100,60,0.35)'); R(px + 5, py + 6, 2, 1, '#5a4a32'); R(px + 9, py + 9, 2, 1, '#5a4a32'); } // trampled where the dead walk
      break;
    }
    case G.YARD: case G.SOIL: case G.FARM: { // dirt and mud: footprints, ruts, puddles
      const D = RAMP.dirt;
      for (let k = 0; k < 6; k++) R(px + ri(0, 13), py + ri(0, 13), 2 + ri(0, 1), 2, pal[1 + ri(0, 1)]);
      for (let k = 0; k < 4; k++) R(px + ri(0, 15), py + ri(0, 15), 1, 1, D[0]);
      if (g === G.SOIL && x % 2 === 0) { R(px, py + 4, TS, 2, '#5a3e24'); R(px, py + 4, TS, 1, '#7a5434'); }
      if (g === G.FARM) { R(px, py + 2, TS, 2, '#5d8a3a'); R(px, py + 9, TS, 2, '#5d8a3a'); R(px, py + 6, TS, 1, D[2]); R(px, py + 13, TS, 1, D[2]); }
      if (g === G.YARD && rng.next() < 0.3) { const ry = py + ri(2, 8); R(px, ry, TS, 1, D[2]); R(px, ry + 5, TS, 1, D[2]); } // tyre ruts
      if (rng.next() < 0.2) { const fx = px + ri(2, 10), fy = py + ri(2, 10); R(fx, fy, 2, 1, D[2]); R(fx + 3, fy + 3, 2, 1, D[2]); } // footprints
      if (rng.next() < 0.06) { const wx = px + ri(2, 8), wy = py + ri(3, 10); R(wx, wy, 6, 3, '#3a4a50'); R(wx + 1, wy, 2, 1, '#6a8298'); } // puddle
      break;
    }
    case G.GRAVEL: {
      for (let k = 0; k < 18; k++) R(px + ri(0, 15), py + ri(0, 15), 1, 1, pal[1 + ri(0, 2)]);
      for (let k = 0; k < 3; k++) R(px + ri(0, 14), py + ri(0, 14), 2, 1, shade(pal[0], -0.25));
      if (rng.next() < 0.07) rubble(R, px + ri(2, 8), py + ri(4, 10), rng);
      break;
    }
    case G.FLOORBOARD: { // boards with seams, knots and felt pads nailed along the routes
      for (let j = 0; j < TS; j += 4) { R(px, py + j, TS, 4, j % 8 ? pal[1] : pal[0]); R(px, py + j + 3, TS, 1, pal[2]); R(px + ((j * 5 + x * 3) % 16), py + j, 1, 3, pal[2]); if (rng.next() < 0.2) R(px + ri(1, 14), py + j + 1, 1, 1, '#4a3020'); }
      if ((x + y * 3) % 5 === 0) feltPad((a, b, w, h, c) => R(a, b, w, h, c), px + 4, py + 5);
      break;
    }
    case G.RIVER: {
      for (let k = 0; k < 3; k++) R(px + ri(0, 13), py + ri(0, 13), 3, 1, pal[1 + ri(0, 1)]);
      if (rng.next() < 0.5) R(px + ri(1, 10), py + ri(2, 12), 4, 1, '#5a8aa8');
      if (rng.next() < 0.3) R(px + ri(1, 12), py + ri(2, 12), 1, 1, '#9ac0d8');
      break;
    }
    default: for (let k = 0; k < 6; k++) R(px + ri(0, 13), py + ri(0, 13), 2 + ri(0, 1), 2, pal[1 + ri(0, 1)]);
  }
}
// Half-pixel ground detail (h = 0.5 map px = 1 HD px), seeded per tile so the 1x layout above is untouched.
function groundHD(ctx, g, x, y, isRoad) {
  const r = new RNG((x * 73856093) ^ (y * 19349663) ^ 0x5bd1e995), h = 0.5;
  const H = (a, b, c, w = h, ht = h) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, ht); };
  const px = x * TS, py = y * TS, rx = () => px + r.int(0, 31) * h, ry = () => py + r.int(0, 31) * h;
  if (isRoad(g)) { // fine aggregate: light and dark grit
    for (let k = 0; k < 14; k++) H(rx(), ry(), k % 3 ? '#4a4e52' : '#5e6266');
    for (let k = 0; k < 8; k++) H(rx(), ry(), '#2a2d30');
    return;
  }
  switch (g) {
    case G.GRASS: case G.GRAVE: case G.FIELD: case G.WOODS: { // thin blades between the tufts, a few lit tips
      const gr = g === G.WOODS ? ['#24501e', '#3a7a30', '#5a9a46'] : [RAMP.grass[2], RAMP.grass[1], RAMP.grass[0]];
      for (let k = 0; k < 16; k++) { const a = rx(), b = ry(); H(a, b, gr[0], h, 1); H(a + (k % 2 ? h : -h), b - h, gr[1]); if (k % 4 === 0) H(a, b - 1, gr[2]); }
      break;
    }
    case G.PAVE: // slab bevels and chips
      for (const [sx, sy] of [[0, 0], [8, 0], [0, 8], [8, 8]]) { H(px + sx, py + sy + 0.5, '#b8b4a8', 7, h); H(px + sx + 0.5, py + sy + 6.5, '#7e7a70', 6.5, h); }
      for (let k = 0; k < 4; k++) H(rx(), ry(), '#8a867a');
      break;
    case G.YARD: case G.SOIL: case G.FARM: case G.GRAVEL: { // pebbles with a lit top and a shadow under
      const D = RAMP.dirt, n = g === G.GRAVEL ? 10 : 5;
      for (let k = 0; k < n; k++) { const a = rx(), b = ry(); H(a, b, D[0], 1, h); H(a, b + h, D[2], 1, h); }
      break;
    }
    case G.FLOORBOARD: for (let j = 0; j < TS; j += 4) { H(px, py + j + 1.5, 'rgba(60,40,24,0.35)', TS, h); H(px + r.int(0, 12), py + j + 0.5, 'rgba(255,240,210,0.12)', 3, h); } break;
    case G.RIVER: for (let k = 0; k < 4; k++) H(rx(), ry(), '#b8d8ea', 1.5, h); break;
  }
}
function crack(R, x, y, rng, c) {
  let cx = x, cy = y;
  for (let i = 0; i < 8; i++) { R(cx, cy, 1, 1, c); cy += 1; cx += rng.int(-1, 1); if (i === 3) { let bx = cx, by = cy; for (let j = 0; j < 3; j++) { bx += 1; by += rng.int(0, 1); R(bx, by, 1, 1, c); } } }
}
function rubble(R, x, y, rng) {
  const B = RAMP.brick;
  for (let i = 0; i < 6; i++) R(x + rng.int(0, 6), y + rng.int(-2, 2), 3, 2, B[rng.int(0, 2)]);
  R(x, y + 2, 9, 2, '#b8b0a0'); R(x + 3, y + 1, 4, 1, '#c8c0b0'); // plaster dust
  R(x + 6, y - 4, 1, 4, '#8a5a32'); R(x + 7, y - 5, 1, 1, '#8a5a32'); // rebar
}
function feltPad(R, x, y) { R(x, y, 6, 4, '#8a857a'); R(x, y, 6, 1, '#a8a398'); R(x, y + 3, 6, 1, '#6a665c'); R(x, y, 1, 1, '#c0c4c8'); R(x + 5, y, 1, 1, '#c0c4c8'); R(x, y + 3, 1, 1, '#c0c4c8'); R(x + 5, y + 3, 1, 1, '#c0c4c8'); }

function tree(ctx, x, y, rng) { treeOf(ctx, x, y, rng); } // VA-4: species, lean and shadow live in scatter.js

// ---------------- D5 walls and fences ----------------
// ---------------- D6 buildings ----------------
const BLD_STYLE = { // roof material, shopfront colour, sign colours
  HARDWARE: { roof: 'slate', front: '#2f5a3a', sign: ['#2f5a3a', '#e8dfc6'] },
  'NEWS & BAKERY': { roof: 'tile', front: '#7a3a35', sign: ['#2a2622', '#e8dfc6'] },
  CAFE: { roof: 'felt', front: '#4d6a8a', sign: ['#e8dfc6', '#4d6a8a'] },
  BUTCHER: { roof: 'slate', front: '#a8302a', sign: ['#a8302a', '#f2ead6'] },
  'FIRE STATION': { roof: 'flat', sign: ['#a8302a', '#f2ead6'] },
  "ST MARY'S": { roof: 'slate', sign: ['#3a3530', '#c8bf9a'] },
  'ZION PRIMARY': { roof: 'flat', sign: ['#2f4060', '#e8dfc6'] },
  'SITE OFFICE': { roof: 'corr' }, STORES: { roof: 'corr' },
  GARAGE: { roof: 'corr', sign: ['#2a2622', '#e2b53c'] },
  'THE RED LION': { roof: 'slate', sign: ['#2a2622', '#e2b53c'] },
  'POST OFFICE': { roof: 'tile', front: '#a8302a', sign: ['#a8302a', '#e2b53c'] },
  PHARMACY: { roof: 'flat', front: '#2f6a4a', sign: ['#2f6a4a', '#e8dfc6'] },
  'HUNT & TACKLE': { roof: 'tile', front: '#4a3a2a', sign: ['#2f4a2a', '#e8dfc6'] },
};
function building(ctx, b, rng) {
  const R = (a, c, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(a, c, w, h); };
  const px = b.x * TS, py = b.y * TS, w = b.w * TS, h = b.h * TS;
  const faceH = TS + 6, roofH = h - TS;
  const st = BLD_STYLE[b.name] || { roof: b.wall === 'tin' ? 'corr' : 'slate' };
  drawRoof(ctx, b, px, py - 6, w, roofH + 6); // S1: roof type, tint, furniture and the cut corners (roofs.js)
  // towers
  if (b.kind === 'church') { // square bell tower with louvres, the bell rope tied up
    const tx = px + w - 40, ty = py - 30;
    R(tx, ty, 24, 40, '#8a8578'); R(tx, ty, 24, 3, '#a8a294'); R(tx + 21, ty + 3, 3, 37, '#6a665c');
    for (let j = 0; j < 40; j += 5) for (let i = (j / 5) % 2 ? 0 : 6; i < 24; i += 12) R(tx + i, ty + j, 1, 5, '#6a665c');
    R(tx + 6, ty + 8, 12, 14, '#2b2a2e'); for (let j = 0; j < 14; j += 3) R(tx + 6, ty + 9 + j, 12, 1, '#5a564e'); // louvres
    R(tx + 11, ty + 14, 2, 8, '#c8b88a'); R(tx + 10, ty + 18, 4, 1, '#a89a70'); // rope tied up
    R(tx + 10, ty - 10, 4, 10, '#6f787d'); R(tx + 8, ty - 6, 8, 2, '#6f787d'); // cross
  }
  if (b.kind === 'fire') { R(px + 8, py - 18, 22, 14, '#9b4a36'); R(px + 8, py - 18, 22, 2, '#b5604a'); R(px + 26, py - 16, 4, 12, '#7d3a2a'); R(px + 12, py - 14, 6, 6, '#2b2a2e'); R(px + 14, py - 12, 2, 2, '#c9a24a'); R(px + 14, py - 10, 2, 2, '#c8b88a'); } // hose tower, bell with its clapper tied
  // front face (south)
  const fy = py + h - TS - 6;
  wallFace(ctx, R, b.wall, px, fy, w, faceH, rng);
  R(px, fy - 1, w, 1, '#3a3a3e'); const gx = px + rng.int(8, Math.max(9, w - 20)); R(gx, fy - 1, 8, 1, 'rgba(0,0,0,0)'); R(gx + 2, fy, 1, 4, '#3a3a3e'); // gutter, a broken run hanging
  if (st.front) { R(px + 6, fy + 3, w - 12, faceH - 5, st.front); R(px + 6, fy + 3, w - 12, 1, shade(st.front, 0.25)); R(px + 6, fy + faceH - 3, w - 12, 1, shade(st.front, -0.4)); } // shopfront
  // windows: frames, sills, glass with a sky glint; some boarded
  for (let i = 1; i < b.w - 1; i += 3) {
    const wx = px + i * TS + 3;
    if ((b.kind === 'garage' && i > 3 && i < 9) || b.kind === 'fire') continue;
    window_(R, wx, fy + 5, (i + b.x) % 2 === 0, rng);
  }
  if (b.kind === 'garage') { R(px + 4 * TS, fy + 3, 5 * TS, faceH - 3, '#3a3a3e'); for (let i = 0; i < faceH - 3; i += 3) { R(px + 4 * TS, fy + 3 + i, 5 * TS, 1, '#4a4d52'); R(px + 4 * TS, fy + 4 + i, 5 * TS, 1, '#5a5e64'); } R(px + 4 * TS + 2, fy + faceH - 3, 5 * TS - 4, 1, '#c9a24a'); }
  if (b.kind === 'fire') for (const dx of [2, 6, 10]) { R(px + dx * TS, fy + 2, 3 * TS - 4, faceH - 2, '#a8402f'); R(px + dx * TS, fy + 2, 3 * TS - 4, 2, '#c86048'); for (let i = 4; i < faceH; i += 4) R(px + dx * TS, fy + i, 3 * TS - 4, 1, '#7a2a22'); R(px + dx * TS + 4, fy + faceH - 3, 3 * TS - 12, 1, '#e8dfc6'); }
  if (b.kind === 'church') { const lx = px + (w >> 1) - 5; R(lx, fy + 3, 10, faceH - 3, '#2b2a2e'); R(lx + 2, fy + 1, 6, 2, '#2b2a2e'); R(lx + 4, fy, 2, 1, '#2b2a2e'); for (const [dx, dy, c] of [[2, 4, '#5a2a3a'], [6, 6, '#2a3a5a'], [4, 9, '#5a5a2a'], [2, 12, '#2a4a3a'], [7, 12, '#5a2a3a']]) R(lx + dx, fy + dy, 2, 2, c); R(lx + 5, fy + 3, 1, faceH - 4, '#3a3a3e'); } // lancet, dark stained glass
  if (b.kind === 'school') for (let i = 0; i < 4; i++) { const wx = px + 2 * TS + 4 + i * 3 * TS; R(wx + 2, fy + 7, 3, 3, ['#e2b53c', '#d84a3a', '#4d7fb8', '#6cbf4a'][i]); R(wx + 6, fy + 9, 2, 2, ['#4d7fb8', '#e2b53c', '#6cbf4a', '#d84a3a'][i]); } // children's paintings
  // a door on the face (not the big-bay buildings)
  if (!['garage', 'fire', 'cabin'].includes(b.kind)) door(R, px + w - TS * 2 - 2, fy + 4, b.kind);
  if (b.kind === 'cabin') { R(px + w - 22, fy + 4, 10, faceH - 4, '#5a6066'); R(px + w - 22, fy + 4, 10, 1, '#8a949a'); R(px + w - 24, fy + faceH - 1, 14, 2, '#6f787d'); R(px + w - 14, fy + 12, 1, 2, '#c0c4c8'); }
  // sign with faded lettering
  if (b.name) {
    const sc = st.sign || ['#2a2622', '#c8bf9a'];
    const tw = pixelTextWidth(b.name) + 6, sx = px + ((w - tw) >> 1), sy = fy - 9;
    R(sx - 1, sy - 1, tw + 2, 11, '#2b1d16'); R(sx, sy, tw, 9, sc[0]); R(sx, sy, tw, 1, shade(sc[0], 0.25)); R(sx, sy + 8, tw, 1, shade(sc[0], -0.35));
    pixelText(ctx, b.name, sx + 3, sy + 2, sc[1]);
    R(sx + 3 + rng.int(0, Math.max(0, tw - 10)), sy + 2, 3, 5, sc[0]); // a missing letter
    R(sx + rng.int(1, tw - 3), sy + 1, 2, 1, '#5a4a32'); // a stain
  }
  details(ctx, R, b, px, fy, w, faceH, rng);
}
function wallFace(ctx, R, kind, x, y, w, h, rng) {
  if (kind === 'brick') {
    const B = RAMP.brick; R(x, y, w, h, RAMP.mortar);
    for (let r = 0; r < h / 2; r++) { const yy = y + r * 2; for (let i = (r % 2) * 2 - 2; i < w; i += 5) { const bx = Math.max(x, x + i), bw = Math.min(4, x + i + 4 - bx, x + w - bx); if (bw > 0) { R(bx, yy, bw, 1, B[(rng.int(0, 5) + r) % 3]); R(bx, yy, bw, 0.5, 'rgba(255,230,200,0.14)'); R(bx + bw - 0.5, yy, 0.5, 1, 'rgba(0,0,0,0.18)'); } } } // HD: each brick lit on top, shadowed at its end
  } else if (kind === 'stone') { // big irregular blocks, dark mortar
    R(x, y, w, h, '#5a564e');
    for (let r = 0; r < h; r += 5) { let i = -rng.int(0, 6); while (i < w) { const bw = rng.int(6, 11), c = ['#8a8578', '#9a958a', '#7a766a'][rng.int(0, 2)]; const bx = Math.max(x, x + i), bww = Math.min(bw - 1, x + w - bx); if (bww > 0) { R(bx, y + r, bww, 4, c); R(bx, y + r, bww, 1, shade(c, 0.15)); } i += bw; } }
  } else if (kind === 'tin') { R(x, y, w, h, '#9aa3a8'); for (let i = 0; i < w; i += 3) { R(x + i, y, 1, h, '#6f787d'); R(x + i + 1, y, 0.5, h, '#c0c8cc'); } R(x, y + h - 4, w, 4, '#8a949a'); }
  else { R(x, y, w, h, '#8f6a3e'); for (let j = 0; j < h; j += 3) { R(x, y + j, w, 1, '#6a4a2e'); R(x, y + j + 1, w, 1, '#a8804e'); R(x, y + j + 1, w, 0.5, '#bc9460'); for (let i = (j * 7) % 11; i < w; i += 11) R(x + i, y + j + 2, 3, 0.5, '#7e5a36'); } } // timber cladding, HD grain
  R(x, y, w, 2, 'rgba(255,240,220,0.12)'); R(x, y + h - 2, w, 2, 'rgba(0,0,0,0.3)');
  for (let k = 0; k < w / 40; k++) { const sx = x + rng.int(2, w - 4); R(sx, y + 2, 1, rng.int(5, 12), 'rgba(40,30,20,0.25)'); } // stains running down
  if (rng.next() < 0.5) { let cx = x + rng.int(10, w - 10), cy = y + 3; for (let i = 0; i < 6; i++) { R(cx, cy, 1, 1, 'rgba(30,20,15,0.5)'); cy++; cx += rng.int(-1, 1); } } // a crack
}
function window_(R, x, y, boarded, rng) {
  R(x - 1, y - 1, 12, 11, '#c8bf9a'); R(x, y, 10, 9, '#26333f'); R(x, y, 10, 1, '#4a5a68'); R(x + 1, y + 1, 2, 1, '#8aa2b8'); R(x + 1, y + 2, 1, 1, '#5a7088'); R(x + 5, y, 1, 9, '#c8bf9a');
  R(x - 2, y + 9, 14, 2, '#d8d0b8'); R(x - 2, y + 10, 14, 1, '#8a857a'); // sill
  if (boarded) { R(x - 1, y + 2, 12, 2, '#c49a62'); R(x - 1, y + 2, 12, 1, '#d8b07a'); R(x - 1, y + 6, 12, 2, '#b08a58'); R(x, y + 3, 1, 1, '#5a3e2a'); R(x + 9, y + 3, 1, 1, '#5a3e2a'); R(x, y + 7, 1, 1, '#5a3e2a'); R(x + 9, y + 7, 1, 1, '#5a3e2a'); }
  else if (rng.next() < 0.3) { R(x + 6, y + 3, 1, 1, '#c8d4dc'); R(x + 7, y + 4, 1, 2, '#c8d4dc'); R(x + 8, y + 2, 1, 1, '#c8d4dc'); } // cracked pane
  if (!boarded) for (const px of [x + 1, x + 6]) for (let i = 0; i < 3; i++) R(px + 1 + i * 0.5, y + 6 - i * 0.5, 0.5, 0.5, 'rgba(200,220,235,0.35)'); // HD: a faint diagonal reflection per pane
  R(x - 1, y - 1, 12, 0.5, '#e0d8b8'); R(x - 2, y + 9, 14, 0.5, '#ece4cc'); // HD: lit frame top and sill edge
}
function door(R, x, y, kind) { // wooden four-panel door, brass handle wrapped in cloth
  R(x - 1, y - 1, 14, 19, '#3a2a1e'); R(x, y, 12, 18, '#6b4a2e'); R(x, y, 12, 1, '#8f6a3e');
  for (const [dx, dy] of [[1, 2], [7, 2], [1, 10], [7, 10]]) { R(x + dx, y + dy, 4, 6, '#5a3e26'); R(x + dx, y + dy, 4, 1, '#7a5a3a'); R(x + dx, y + dy + 5.5, 4, 0.5, '#8f6a3e'); R(x + dx + 3.5, y + dy + 1, 0.5, 5, '#7a5a3a'); } // HD: panel bevels
  R(x + 9, y + 9, 3, 3, '#c8bf9a'); R(x + 9, y + 9, 3, 1, '#e8dfc6'); R(x + 10, y + 12, 1, 2, '#a89a70'); // rag round the handle
  R(x - 2, y + 18, 16, 2, '#8a8578'); R(x - 2, y + 18, 16, 1, '#a8a294'); // step
}
// one silence detail and one tonight detail per building (D6 table)
function details(ctx, R, b, px, fy, w, faceH, rng) {
  const by = fy + faceH; // pavement line in front of the face
  const glass = (x, y, n) => { for (let i = 0; i < n; i++) R(x + rng.int(0, 14), y + rng.int(0, 5), 1, 1, i % 3 ? '#c8d4dc' : '#8aa2b8'); };
  switch (b.name) {
    case 'HARDWARE': R(px + w - 36, by - 6, 4, 8, '#7a3a35'); R(px + w - 36, by - 6, 4, 1, '#a85a4a'); R(px + w - 35, by - 6, 1, 8, '#5a2a24'); // rolled carpet against the door
      R(px + 20, fy + 6, 10, 8, '#141619'); R(px + 22, fy + 8, 2, 3, '#c8d4dc'); glass(px + 16, by, 10); break; // smashed window, glass on the pavement
    case 'NEWS & BAKERY': { for (let i = 0; i < w - 20; i += 4) { R(px + 10 + i, fy + 2, 4, 3, i % 8 ? '#e8dfc6' : '#a8302a'); } R(px + w - 30, fy + 2, 20, 1, '#2b1d16'); for (let i = 0; i < 4; i++) R(px + w - 28 + i * 5, fy + 3 + i, 4, 1, i % 2 ? '#e8dfc6' : '#a8302a'); // striped awning, half torn down
      R(px + 18, fy + 10, 8, 5, '#f2ead6'); R(px + 19, fy + 11, 6, 1, '#5a3e2a'); R(px + 19, fy + 13, 4, 1, '#5a3e2a'); // "QUIET PLEASE" card
      for (let i = 0; i < 3; i++) R(px + 34 + i * 4, fy + 9, 3, 2, '#c49a62'); break; } // bread racks inside
    case 'CAFE': for (let i = 0; i < 3; i++) { const cx = px + 8 + i * 9; R(cx, by - 8, 6, 2, '#4a4d52'); R(cx, by - 6, 1, 5, '#4a4d52'); R(cx + 5, by - 6, 1, 5, '#4a4d52'); R(cx - 1, by - 1, 2, 2, '#d8d040'); R(cx + 5, by - 1, 2, 2, '#d8d040'); } // stacked chairs, tennis balls on the legs
      R(px + 4 * TS + 3, fy + 5, 10, 9, '#141619'); R(px + 4 * TS + 4, fy + 6, 2, 2, '#c8d4dc'); R(px + 4 * TS + 1, by + 1, 10, 3, '#8f6a3e'); R(px + 4 * TS + 1, by + 1, 10, 1, '#c49a62'); glass(px + 4 * TS - 2, by + 1, 12); break; // a table through the glass (v1.4 H2: on a window, not over the door)
    case 'BUTCHER': for (let i = 0; i < w - 12; i += 4) R(px + 6 + i, fy + 3 + ((i / 4) % 2) * 2, 2, 2, (i / 4) % 2 ? '#f2ead6' : '#a8302a'); // tiled front
      for (let i = 0; i < 3; i++) { R(px + 16 + i * 6, fy + 6, 1, 3, '#9aa3a8'); R(px + 15 + i * 6, fy + 9, 3, 2, '#c8bf9a'); } // hooks wrapped in rags
      for (let i = 0; i < 8; i++) R(px + w - 30 + rng.int(-1, 1), by + i * 2, 2, 2, RAMP.blood.old); break; // a dark trail out of the door
    case 'FIRE STATION': R(px + 2 * TS + 8, fy + 4, 12, 6, '#7a2a22'); R(px + 2 * TS + 10, fy + 5, 8, 2, '#5a1a14'); R(px + 2 * TS + 12, fy + 7, 3, 1, '#c86048'); break; // bay door dented outward
    case "ST MARY'S": for (let i = 0; i < 3; i++) { const gx = px + 10 + i * 18; R(gx, by + 6, 8, 4, '#6b4a2e'); R(gx + 1, by + 5, 6, 1, '#7a5434'); R(gx + 2, by + 6, 1, 1, '#4a3020'); } break; // graves disturbed: earth heaped
    case 'ZION PRIMARY': { const hx = px + 24; for (let i = 0; i < 4; i++) { R(hx + i * 6, by + 3, 5, 5, 'rgba(0,0,0,0)'); R(hx + i * 6, by + 3, 5, 1, CHALK); R(hx + i * 6, by + 3, 1, 5, CHALK); R(hx + i * 6 + 4, by + 3, 1, 5, CHALK); R(hx + i * 6, by + 7, 5, 1, CHALK); } pixelText(ctx, 'SHH', hx + 1, by + 10, CHALK); // chalk SHH hopscotch
      for (let i = 0; i < 5; i++) R(px + w - 50 + i * 5, fy + 15, 2, 1, '#9aa3a8'); R(px + w - 52, fy + 16, 26, 1, '#5a3e2a'); R(px + w - 44, by - 2, 4, 3, '#b5503b'); R(px + w - 36, by - 1, 4, 2, '#4d7fb8'); break; } // the coat peg row fallen, coats on the floor
    case 'GARAGE': for (let i = 0; i < 4; i++) { R(px + 10 + i * 5, by - 4 - (i % 2) * 3, 4, 3, '#2f2f33'); R(px + 11 + i * 5, by - 5 - (i % 2) * 3, 1, 1, '#e03a2a'); R(px + 13 + i * 5, by - 5 - (i % 2) * 3, 1, 1, '#c0c4c8'); } // a pile of batteries pulled from cars
      R(px + w - 60, by + 2, 18, 5, '#1a1c1e'); R(px + w - 58, by + 3, 6, 1, '#4a3a5a'); R(px + w - 50, by + 4, 4, 1, '#3a5a4a'); // oil spill
      R(px + w - 30, fy - 10, 14, 9, '#e8dfc6'); R(px + w - 30, fy - 10, 14, 1, '#b5503b'); pixelText(ctx, '1.79', px + w - 29, fy - 7, '#2b1d16'); break; // fuel price sign
    case 'THE RED LION': { const sx = px + 20, sy = fy - 4; R(sx - 3, sy - 2, 1, 4, '#3a3a3e'); R(sx - 3, sy - 2, 14, 1, '#3a3a3e'); R(sx, sy, 10, 12, '#2b1d16'); R(sx + 1, sy + 1, 8, 10, '#e8dfc6'); // hanging sign: a red lion rampant
        for (const [dx, dy, ww, hh] of [[3, 2, 3, 2], [2, 4, 4, 3], [5, 3, 2, 1], [2, 7, 1, 3], [5, 7, 1, 3], [6, 5, 2, 1], [1, 3, 1, 2]]) R(sx + 1 + dx - 1, sy + 1 + dy, ww, hh, '#b5302a');
        for (const hx of [px + 50, px + w - 40]) { R(hx, fy + 2, 1, 3, '#3a3a3e'); R(hx - 3, fy + 5, 7, 4, '#5a3e2a'); R(hx - 2, fy + 4, 5, 1, '#6a5a3a'); } // dead hanging baskets
        R(px + w - 28, by - 10, 8, 10, '#2b2a2e'); R(px + w - 28, by - 10, 8, 1, '#5a3e2a'); R(px + w - 27, by - 8, 5, 1, CHALK); R(px + w - 27, by - 6, 4, 1, CHALK); break; } // chalkboard
    case 'POST OFFICE': R(px + 8, by - 10, 6, 12, '#b5302a'); R(px + 8, by - 10, 6, 2, '#d84a3a'); R(px + 9, by - 6, 4, 1, '#2b1d16'); R(px + 9, by - 3, 4, 1, '#e2b53c'); // postbox
      for (let i = 0; i < 3; i++) R(px + 28, fy + 12 - i * 2, 7, 2, i % 2 ? '#e8dfc6' : '#c8bf9a'); // letters stacked, unsent
      R(px + w - 56, fy + 7, 7, 7, '#4a4d52'); R(px + w - 55, fy + 8, 5, 5, '#6f787d'); R(px + w - 53, fy + 10, 1, 1, '#f2ead6'); break; // the safe door glinting
    case 'PHARMACY': { const cx = px + 14, cy = fy - 14; R(cx, cy + 3, 9, 3, '#2f6a4a'); R(cx + 3, cy, 3, 9, '#2f6a4a'); R(cx + 1, cy + 4, 7, 1, '#4a9a6a'); R(cx + 4, cy + 1, 1, 7, '#4a9a6a'); // green cross (unlit)
        for (let i = 1; i < b.w - 1; i += 3) { R(px + i * TS + 3, fy + 5, 10, 9, '#a88a5a'); R(px + i * TS + 3, fy + 5, 10, 1, '#c4a46e'); R(px + i * TS + 5, fy + 9, 6, 1, '#8a6a3a'); } // cardboard over the windows
        break; }
    case 'HUNT & TACKLE': { const ax = px + w - TS * 2 + 1, ay = fy - 2; R(ax, ay, 2, 3, '#e8dfc6'); R(ax + 9, ay, 2, 3, '#e8dfc6'); R(ax - 1, ay - 2, 1, 2, '#e8dfc6'); R(ax + 11, ay - 2, 1, 2, '#e8dfc6'); R(ax + 2, ay + 2, 7, 2, '#8f6a3e'); // antlers over the door
        for (let i = 0; i < 4; i++) R(px + 12 + i * 3, fy + 4, 1, 12, i % 2 ? '#5a3e2a' : '#8f6a3e'); // rod display
        R(px + 30, fy + 8, 16, 1, '#5a3e2a'); R(px + 30, fy + 12, 16, 1, '#5a3e2a'); for (let i = 0; i < 2; i++) R(px + 32 + i * 8, fy + 6, 3, 2, '#c8bf9a'); // rack: rag-wrapped bolts, the rest empty
        break; }
    case 'SITE OFFICE': case 'STORES': R(px + 8, fy + 4, 6, 9, '#d9c23a'); R(px + 8, fy + 7, 6, 1, '#e8e0c0'); R(px + 10, fy + 3, 2, 1, '#3a3a3e'); // hi-vis on a nail
      if (b.name === 'STORES') { R(px + w - 22, fy + 4, 10, faceH - 4, '#2b2a2e'); R(px + w - 20, fy + 6, 5, faceH - 8, '#5a6066'); } // door kicked in
      break;
  }
}
function mast(R, x, y) { // lattice radio mast on the school roof, guy wires; the red light and booster are drawn live
  R(x + 2, y - 60, 1, 56, '#6f787d'); R(x + 7, y - 60, 1, 56, '#6f787d');
  for (let j = 0; j < 56; j += 6) { R(x + 2, y - 60 + j, 6, 1, '#8c8f86'); for (let i = 0; i < 6; i++) R(x + 2 + i, y - 60 + j + i, 1, 1, '#5a5e64'); }
  for (let i = 0; i < 14; i++) { R(x - 12 + i, y - 40 + Math.round(i * 2.6), 1, 1, '#4a4d52'); R(x + 21 - i, y - 40 + Math.round(i * 2.6), 1, 1, '#4a4d52'); } // guy wires
  R(x, y - 62, 10, 2, '#9aa3a8'); R(x + 4, y - 66, 2, 4, '#9aa3a8');
}
function ladder(R, x, y) { // leans against the east wall of the building one tile to the west, hooked over its eave
  const wall = Math.floor(x / TS) * TS, H = 34, at = (j) => Math.round(x - 4 + (wall - 3 - (x - 4)) * (j / H)); // rail x at height j
  for (let j = 0; j < H; j++) R(at(j) + 2, y - 6 - j, 8, 1, 'rgba(20,16,12,0.35)'); // its shadow on the wall
  for (let j = 0; j < H; j++) { const lx = at(j); R(lx, y - 6 - j, 2, 1, '#c8cfd0'); R(lx + 7, y - 6 - j, 2, 1, '#c8cfd0'); R(lx, y - 6 - j, 1, 1, '#e8e4d8'); R(lx + 7, y - 6 - j, 1, 1, '#e8e4d8'); }
  for (let j = 4; j < H; j += 4) { const lx = at(j); R(lx + 2, y - 6 - j, 5, 1, '#e8e4d8'); R(lx + 2, y - 5 - j, 5, 1, '#6f787d'); }
  const tx = at(H); R(tx - 1, y - 6 - H - 2, 3, 2, '#6f787d'); R(tx + 6, y - 6 - H - 2, 3, 2, '#6f787d'); // hooks over the eave
  R(x - 5, y - 6, 4, 2, '#4a4d52'); R(x + 2, y - 6, 4, 2, '#4a4d52'); // feet on the ground
}
function paintedArrow(R, x, y) { // a stencilled yellow arrow on the ground: up here
  for (let i = 0; i < 4; i++) R(x - i, y - 4 + i, 1 + i * 2, 1, '#d9c23a');
  R(x - 1, y, 3, 5, '#d9c23a'); R(x - 1, y + 5, 3, 1, '#a8902a');
}
function workbench(R, x, y, w) { R(x, y, w, 7, '#8f6a3e'); R(x, y, w, 1, '#c49a62'); R(x, y + 6, w, 1, '#5a3e2a'); R(x + 1, y + 7, 1, 4, '#5a3e2a'); R(x + w - 2, y + 7, 1, 4, '#5a3e2a'); R(x + 3, y - 3, 4, 3, '#9aa3a8'); R(x + 3, y - 3, 4, 1, '#c0c4c8'); R(x + w - 7, y - 2, 4, 2, '#b5503b'); R(x + 9, y + 2, 3, 1, '#4a3428'); }
function jerryCan(R, x, y) { R(x, y + 1, 7, 11, '#2b1d16'); R(x + 1, y + 2, 5, 9, '#b5503b'); R(x + 1, y + 2, 5, 1, '#d06a50'); R(x + 1, y + 2, 1, 9, '#c86048'); R(x + 2, y, 2, 2, '#2b1d16'); R(x + 1, y + 5, 5, 1, '#7a2a22'); R(x + 2, y + 6, 3, 3, '#a8402f'); R(x + 4, y + 1, 2, 1, '#6f787d'); }

// ---------------- D7 props ----------------
const CAR_MODELS = ['hatch', 'estate', 'van', 'police', 'taxi', 'pickup'];
function prop(ctx, p, rng, carIdx) {
  const R = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); };
  const px = p.x * TS, py = p.y * TS, w = p.w * TS, h = p.h * TS;
  switch (p.kind) {
    case 'car': car(ctx, R, px, py, w, p, CAR_MODELS[carIdx % 6], rng); break;
    case 'fireengine': {
      R(px, py + h - 4, w, 4, 'rgba(0,0,0,0.38)');
      for (const wx of [px + 4, px + 16, px + w - 14]) { R(wx, py + h - 9, 9, 9, '#1c1c20'); R(wx + 2, py + h - 7, 5, 5, '#3a3a3e'); R(wx + 3, py + h - 6, 3, 3, '#9aa3a8'); R(wx + 4, py + h - 5, 1, 1, '#c8cfd0'); }
      R(px + 1, py + 4, w - 2, h - 10, '#b8352a'); R(px + 1, py + 4, w - 2, 2, '#d85a48'); R(px + 1, py + h - 9, w - 2, 3, '#7a2018');
      R(px + 1, py + 14, w - 2, 2, '#e8dfc6');
      for (let i = 0; i < 3; i++) { R(px + 4 + i * 12, py + 7, 10, 6, '#9a2a20'); R(px + 4 + i * 12, py + 7, 10, 1, '#c8cfd0'); R(px + 5 + i * 12, py + 9, 8, 1, '#c8cfd0'); R(px + 12 + i * 12, py + 10, 1, 2, '#e8e4d8'); } // chrome lockers
      R(px + w - 18, py - 4, 17, 14, '#c13a2e'); R(px + w - 18, py - 4, 17, 2, '#e06a56'); R(px + w - 18, py - 4, 17, 1, '#f2ead6'); R(px + w - 16, py - 1, 13, 6, '#26333f'); R(px + w - 15, py - 1, 4, 1, '#8aa2b8');
      R(px + w - 14, py - 6, 3, 2, '#3d6ad0'); R(px + w - 7, py - 6, 3, 2, '#3d6ad0');
      R(px + 2, py, w - 22, 2, '#c8cfd0'); R(px + 2, py + 3, w - 22, 1, '#9aa3a8'); for (let i = 4; i < w - 22; i += 5) R(px + i, py, 1, 4, '#c8cfd0');
      for (let i = 0; i < 3; i++) { R(px + 20 + i * 3, py + 4, 3, 3, '#c8b060'); R(px + 21 + i * 3, py + 5, 1, 1, '#8a7a30'); } // rolled hose
      R(px + w - 2, py + 6, 1, 8, '#9aa3a8');
      pixelText(ctx, 'FIRE', px + 4, py + 17, '#e8dfc6');
      break;
    }
    case 'memorial': R(px - 6, py - 2, 28, 22, '#a8a398'); R(px - 4, py, 24, 18, '#4a7a3a'); R(px - 6, py - 2, 28, 1, '#c8c4b8'); R(px - 6, py + 19, 28, 1, '#6a665c'); // v1.6: a kerbed traffic island, so it isn't standing in the road
      R(px + 2, py + 10, 12, 6, '#77736a'); R(px + 2, py + 10, 12, 1, '#8a857a'); R(px + 4, py - 14, 8, 26, '#9a958a'); R(px + 4, py - 14, 3, 26, '#aaa59a'); R(px + 11, py - 12, 1, 24, '#7a766a'); R(px + 6, py - 18, 4, 4, '#9a958a'); R(px + 5, py - 16, 6, 1, '#9a958a'); pixelText(ctx, '1918', px + 1, py + 1, '#5a564e'); R(px + 3, py + 11, 3, 2, '#b5503b'); R(px + 4, py + 11, 1, 1, '#2b1d16'); R(px + 9, py + 12, 2, 2, '#6a3a5a'); R(px + 5, py - 6, 2, 3, '#5a7a3a'); break;
    case 'phonebox': R(px + 2, py - 12, 12, 28, '#b5503b'); R(px + 2, py - 12, 12, 2, '#c86048'); R(px + 2, py - 12, 1, 28, '#d06a50'); R(px + 13, py - 10, 1, 26, '#8a3a2a'); R(px + 4, py - 9, 8, 2, '#e8dfc6');
      for (let j = 0; j < 4; j++) { R(px + 4, py - 6 + j * 4, 8, 3, '#2a3440'); R(px + 4, py - 6 + j * 4, 2, 1, '#6a8298'); } R(px + 3, py + 15, 10, 1, '#8a3a2a'); R(px + 7, py + 2, 2, 3, '#2b1d16'); break;
    case 'shelter': R(px, py - 8, w, 3, '#4a4d52'); R(px, py - 8, w, 1, '#6f787d'); R(px + 1, py - 5, 1, 20, '#4a4d52'); R(px + w - 2, py - 5, 1, 20, '#4a4d52'); R(px + 2, py - 5, w - 4, 12, 'rgba(160,190,200,0.35)'); R(px + 3, py - 4, 3, 1, 'rgba(230,240,245,0.5)'); R(px + w - 12, py - 2, 4, 5, '#c8d4dc'); R(px + 4, py + 7, w - 8, 3, '#8f6a3e'); R(px + 4, py + 7, w - 8, 1, '#c49a62'); R(px + 8, py - 3, 6, 4, '#e8dfc6'); break;
    case 'bin': if (p.id % 3 === 1) { R(px, py + 6, 16, 9, '#2f5a3a'); R(px, py + 6, 16, 1, '#3e6a4a'); R(px + 13, py + 5, 3, 11, '#3a6a46'); R(px + 1, py + 9, 12, 1, '#1f3a26'); R(px - 4, py + 12, 5, 3, '#25282c'); R(px - 6, py + 14, 3, 2, '#c8bf9a'); R(px + 2, py + 15, 12, 1, 'rgba(0,0,0,0.3)'); break; } // VA-6: knocked over, rubbish out
      if (p.id % 3 === 2) { R(px + 1, py - 9, 3, 8, '#3a6a46'); R(px + 1, py - 9, 1, 8, '#4e8a5a'); } // lid hanging open
      R(px + 3, py - 2, 10, 17, '#2f5a3a'); R(px + 3, py - 2, 1, 17, '#3e6a4a'); R(px + 12, py, 1, 15, '#1f3a26'); R(px + 2, py - 3, 12, 3, '#3a6a46'); R(px + 2, py - 3, 12, 1, '#4e8a5a'); R(px + 3, py + 13, 3, 3, '#2f2f33'); R(px + 5, py + 4, 6, 1, '#1f3a26'); R(px + 7, py - 5, 3, 2, '#e8dfc6'); break;
    case 'grave': R(px + 3, py - 4, 10, 18, '#8a8578'); R(px + 4, py - 6, 8, 2, '#8a8578'); R(px + 5, py - 7, 6, 1, '#8a8578'); R(px + 3, py - 4, 3, 18, '#9a958a'); R(px + 12, py - 4, 1, 18, '#6a665c'); R(px + 6, py, 4, 1, '#5a564e'); R(px + 6, py + 3, 4, 1, '#5a564e'); R(px + 7, py - 2, 2, 1, '#5a564e'); R(px + 2, py + 12, 12, 3, '#5a7a3a'); R(px + 4, py + 6, 2, 2, '#6a8a4a'); R(px + 10, py + 9, 1, 3, '#5a7a3a'); break;
    case 'digger': digger(R, px, py, w, h); break;
    case 'pallets': for (let i = 0; i < 4; i++) { R(px, py + 12 - i * 4, w, 3, '#c49a62'); R(px, py + 12 - i * 4, w, 1, '#d8b07a'); R(px, py + 14 - i * 4, w, 1, '#8f6a3e'); R(px + 2, py + 14 - i * 4, 2, 1, '#5a3e2a'); R(px + w - 4, py + 14 - i * 4, 2, 1, '#5a3e2a'); R(px + (w >> 1) - 1, py + 13 - i * 4, 2, 1, '#5a3e2a'); } break;
    case 'pump': R(px + 3, py - 8, 10, 22, '#e8dfc6'); R(px + 3, py - 8, 1, 22, '#f2ead6'); R(px + 12, py - 6, 1, 20, '#a8a294'); R(px + 3, py - 8, 10, 4, '#b5503b'); R(px + 3, py - 8, 10, 1, '#d06a50'); R(px + 5, py - 2, 6, 4, '#2a3440'); R(px + 6, py - 1, 4, 1, '#6cbf4a'); R(px + 12, py, 2, 8, '#2f2f33'); R(px + 13, py + 7, 2, 3, '#2f2f33'); R(px + 5, py + 4, 6, 2, '#c8bf9a'); break;
    case 'tyres': for (let i = 0; i < 3; i++) { R(px + 2, py + 10 - i * 4, 12, 4, '#2f2f33'); R(px + 2, py + 10 - i * 4, 12, 1, '#4a4d52'); R(px + 5, py + 11 - i * 4, 6, 2, '#1a1a1e'); for (let k = 3; k < 13; k += 3) R(px + k, py + 13 - i * 4, 1, 1, '#4a4d52'); } break;
    case 'policebox': R(px + 2, py - 12, w - 4, h + 10, '#2f4a7a'); R(px + 2, py - 12, w - 4, 3, '#3d5a90'); R(px + 2, py - 12, 1, h + 10, '#4a6aa0'); R(px + w - 3, py - 10, 1, h + 8, '#1f3a5a'); R(px + 6, py - 4, 8, 10, '#2a3440'); R(px + w - 14, py - 4, 8, 10, '#2a3440'); R(px + 7, py - 3, 2, 1, '#6a8298'); R(px + w - 13, py - 3, 2, 1, '#6a8298'); R(px + (w >> 1) - 1, py - 15, 2, 3, '#bfe4f0'); pixelText(ctx, 'POLICE', px + 4, py - 9, '#e8dfc6'); break;
    case 'shed': R(px, py - 8, w, h + 6, '#7a5a3a'); for (let i = 0; i < w; i += 4) { R(px + i, py - 8, 1, h + 6, '#5a3e2a'); R(px + i + 1, py - 8, 1, h + 6, '#8f6a3e'); } R(px - 2, py - 12, w + 4, 6, '#3a3e3a'); R(px - 2, py - 12, w + 4, 1, '#5a5e5a'); R(px + 18, py + 6, 8, 16, '#4a3428'); R(px + 24, py + 13, 1, 2, '#c8bf9a'); R(px + 4, py, 6, 5, '#26333f'); R(px + 4, py, 6, 1, '#c8bf9a'); break;
    case 'tunnel': R(px, py - 6, w, h + 4, 'rgba(200,207,208,0.55)'); for (let i = 0; i < w; i += 8) { R(px + i, py - 6, 2, h + 4, '#c8cfd0'); R(px + i + 1, py - 6, 1, h + 4, '#e8e8e8'); } R(px, py + h - 4, w, 2, '#9aa3a8'); R(px + 10, py + 2, 6, 3, 'rgba(90,120,60,0.6)'); break;
    case 'scarecrow': R(px + 7, py - 14, 2, 30, '#8f6a3e'); R(px + 7, py - 14, 1, 30, '#a8804e'); R(px + 1, py - 8, 14, 2, '#8f6a3e'); R(px + 4, py - 10, 8, 10, '#d9c23a'); R(px + 4, py - 6, 8, 1, '#e8e0c0'); R(px + 4, py - 3, 8, 1, '#e8e0c0'); R(px + 11, py - 10, 1, 10, '#a8961e'); R(px + 5, py - 18, 6, 6, '#c49a62'); R(px + 6, py - 16, 1, 1, '#2b1d16'); R(px + 9, py - 16, 1, 1, '#2b1d16'); R(px + 6, py - 14, 4, 1, '#5a3e2a'); R(px + 4, py - 20, 8, 3, '#5a3e2a'); R(px + 3, py - 18, 10, 1, '#5a3e2a'); R(px + 2, py - 8, 1, 3, '#d8c070'); R(px + 13, py - 8, 1, 3, '#d8c070'); break; // in a hi-vis jacket
    case 'goal': R(px + 6, py - 20, 2, 36, '#e8e4d8'); R(px + 6, py - 20, 1, 36, '#f2ead6'); R(px + 7, py - 20, 1, 36, '#b8b4a8'); R(px + 6, py - 20, 2, 2, '#f2ead6'); for (let j = 0; j < 30; j += 4) R(px + 8, py - 18 + j, 4, 1, 'rgba(232,228,216,0.35)'); break;
    case 'towtruck': {
      const Y = '#e2b53c';
      R(px, py + h - 4, w, 4, 'rgba(0,0,0,0.38)');
      for (const wx of [px + 4, px + w - 14]) { R(wx, py + h - 9, 9, 9, '#1c1c20'); R(wx + 2, py + h - 7, 5, 5, '#3a3a3e'); R(wx + 3, py + h - 6, 3, 3, '#9aa3a8'); }
      R(px, py + 4, w, h - 10, Y); R(px, py + 4, w, 2, '#f4d070'); R(px, py + h - 9, w, 3, '#a8801e');
      R(px + 2, py + 2, w - 20, 3, '#3a3a3e'); R(px + 2, py + 2, w - 20, 1, '#5a5e64');
      R(px + 3, py - 10, 3, 14, '#3a3a3e'); R(px + 3, py - 10, 22, 3, '#4a4d52'); R(px + 3, py - 10, 22, 1, '#6f787d'); for (let i = 6; i < 24; i += 4) R(px + i, py - 9, 1, 2, '#2f2f33'); // boom
      R(px + 23, py - 7, 1, 8, '#9aa3a8'); R(px + 21, py + 1, 5, 2, '#9aa3a8'); R(px + 21, py + 3, 1, 2, '#9aa3a8'); R(px + 25, py + 3, 1, 1, '#9aa3a8'); // cable + hook
      R(px + w - 17, py - 8, 16, 14, Y); R(px + w - 17, py - 8, 16, 2, '#f4d070'); R(px + w - 15, py - 5, 12, 6, '#26333f'); R(px + w - 14, py - 5, 3, 1, '#8aa2b8');
      R(px + w - 15, py - 10, 4, 2, '#e07a20'); R(px + w - 9, py - 10, 4, 2, '#e07a20'); R(px + w - 14, py - 10, 1, 1, '#f0b060');
      R(px + 6, py + 9, 22, 2, '#2f2f33'); for (let i = 0; i < 22; i += 4) R(px + 6 + i, py + 9, 2, 2, Y);
      R(px + w - 30, py + 5, 8, 4, '#4a4d52'); R(px + w - 30, py + 5, 8, 1, '#2b1d16'); // battery bay
      pixelText(ctx, 'TOW', px + 10, py + 12, '#2b1d16');
      break;
    }
    case 'bench': R(px - 4, py + 2, 24, 13, '#2a2a2e'); R(px - 4, py + 2, 24, 2, '#6f787d'); workbench(R, px - 2, py + 6, 20); pixelText(ctx, 'BENCH', px - 2, py - 6, '#e2b53c'); break;
    case 'noticeboard': R(px + 1, py - 10, 2, 24, '#5a3e2a'); R(px + 13, py - 10, 2, 24, '#5a3e2a'); R(px - 2, py - 14, 20, 16, '#3a2a1e'); R(px - 1, py - 13, 18, 14, '#8f6a3e'); R(px - 2, py - 16, 20, 2, '#4a3a2a');
      R(px + 1, py - 11, 6, 7, '#e8dfc6'); R(px + 2, py - 9, 4, 1, '#8a857a'); R(px + 2, py - 7, 3, 1, '#8a857a'); R(px + 9, py - 12, 6, 5, '#e8dfc6'); R(px + 8, py - 6, 7, 5, '#f0d070'); R(px + 3, py - 11, 1, 1, '#b5503b'); R(px + 11, py - 12, 1, 1, '#4d7fb8'); pixelText(ctx, 'SHH', px + 9, py - 5, '#2b1d16'); break;
  }
}
function car(ctx, R, px, py, w, p, model, rng) {
  const paint = model === 'police' ? '#e8e4d8' : model === 'taxi' ? '#2b2b2e' : p.paint;
  const c = paint, hi = shade(c, 0.3), lo = shade(c, -0.35), lo2 = shade(c, -0.55);
  R(px, py + 12, w, 4, 'rgba(0,0,0,0.38)'); R(px + (w >> 1) - 6 + (p.x % 3) * 3, py + 15, 9, 3, 'rgba(16,14,20,0.55)'); R(px + (w >> 1) - 3 + (p.x % 3) * 3, py + 16, 3, 1, 'rgba(90,70,110,0.5)'); // VA-9: oil under it
  for (const wx of [px + 3, px + w - 10]) { R(wx, py + 9, 7, 7, '#1c1c20'); R(wx + 1, py + 10, 5, 5, '#2f2f33'); R(wx + 2, py + 11, 3, 3, '#7a7f84'); R(wx + 3, py + 12, 1, 1, '#c8cfd0'); }
  const bodyTop = model === 'van' ? py - 2 : py + 3;
  R(px + 1, bodyTop, w - 2, py + 12 - bodyTop, c); R(px + 1, bodyTop, w - 2, 1, hi); R(px + 1, py + 10, w - 2, 2, lo);
  R(px + 2, py + 9, 9, 3, lo2); R(px + w - 11, py + 9, 9, 3, lo2);
  R(px, py + 5, 1, 6, '#6f787d'); R(px + w - 1, py + 5, 1, 6, '#6f787d');
  R(px + 1, py + 5, 2, 2, '#f0e6b0'); R(px + w - 3, py + 5, 2, 2, '#b5302a');
  R(px + 15, py + 4, 1, 6, lo); R(px + 13, py + 6, 2, 1, '#9aa3a8');
  if (model === 'van') { R(px + 20, py, 1, 10, lo); R(px + 4, py - 1, 8, 4, '#26333f'); R(px + 5, py - 1, 2, 1, '#8aa2b8'); R(px + 18, py + 2, 10, 1, lo2); }
  else if (model === 'pickup') { R(px + 3, py - 4, 13, 8, lo); R(px + 4, py - 3, 11, 5, '#26333f'); R(px + 5, py - 3, 3, 1, '#8aa2b8'); R(px + 17, py + 2, w - 19, 2, lo2); R(px + 18, py + 1, 3, 1, '#8f6a3e'); R(px + 23, py + 1, 2, 1, '#6f787d'); }
  else {
    const cab = model === 'estate' ? w - 10 : w - 14;
    R(px + 7, py - 4, cab, 8, lo); R(px + 8, py - 4, cab - 2, 1, hi);
    R(px + 8, py - 3, 7, 5, '#26333f'); R(px + 17, py - 3, cab - 11, 5, '#26333f'); R(px + 15, py - 3, 2, 5, lo2);
    R(px + 9, py - 3, 2, 1, '#8aa2b8'); R(px + 18, py - 3, 3, 1, '#6a8298');
  }
  if (model === 'police') { R(px + 1, py + 6, w - 2, 2, '#3d6ad0'); for (let i = 2; i < w - 2; i += 4) R(px + i, py + 6, 2, 2, '#e2b53c'); R(px + 12, py - 6, 3, 2, '#3d6ad0'); R(px + 16, py - 6, 3, 2, '#c0302a'); }
  if (model === 'taxi') { R(px + 13, py - 6, 6, 2, '#e2b53c'); R(px + 14, py - 6, 4, 1, '#f4d070'); R(px + 2, py + 6, w - 4, 1, '#e2b53c'); }
  if (rng.next() < 0.35) { R(px + 19, py - 2, 1, 3, '#c8d4dc'); R(px + 20, py - 1, 2, 1, '#c8d4dc'); }
  if (rng.next() < 0.4) { R(px + 16, py + 12, 7, 2, lo); R(px + 16, py + 12, 7, 1, hi); R(px + 16, py + 4, 1, 8, '#1c1c20'); } // a door left open
  R(px + w - 8, py + 3, 4, 1, '#2f2f33'); R(px + w - 7, py + 2, 2, 1, '#2f2f33'); // bonnet propped: battery pulled (silence)
  R(px + 3, py + 6, 2, 1, '#8a5a32'); R(px + w - 8, py + 4, 2, 2, '#8a5a32'); R(px + 22, py + 8, 1, 1, '#6a4a2a');
  R(px + 4, py + 12, 3, 2, '#4e962f'); R(px + 5, py + 11, 1, 1, '#6cbf4a');
}
function digger(R, px, py, w, h) {
  const Y = '#e2b53c', YH = '#f4d070', YL = '#a8801e', MUD = '#6b5a3a';
  R(px - 2, py + h - 4, w + 4, 5, 'rgba(0,0,0,0.38)');
  R(px, py + h - 10, w - 4, 9, '#232327'); R(px + 1, py + h - 9, w - 6, 1, '#4a4d52');
  for (let i = 2; i < w - 6; i += 3) R(px + i, py + h - 4, 2, 2, '#3a3a3e');
  for (const wx of [px + 3, px + w - 13]) { R(wx, py + h - 8, 6, 6, '#3a3a3e'); R(wx + 2, py + h - 6, 2, 2, '#6f787d'); }
  for (let i = 0; i < w - 6; i += 5) R(px + i, py + h - 3, 3, 2, MUD); // mud-caked tracks
  R(px + 2, py + 4, w - 10, h - 14, Y); R(px + 2, py + 4, w - 10, 2, YH); R(px + 2, py + h - 12, w - 10, 2, YL);
  R(px + 4, py + h - 13, 10, 2, MUD); R(px + 20, py + h - 12, 6, 1, MUD);
  R(px + 2, py + 8, 10, 8, '#c9a020'); R(px + 3, py + 9, 8, 1, '#2f2f33'); R(px + 3, py + 11, 8, 1, '#2f2f33'); R(px + 3, py + 13, 8, 1, '#2f2f33');
  R(px + 14, py - 8, 16, 16, YL); R(px + 15, py - 7, 14, 14, '#2a3440'); R(px + 21, py - 7, 1, 14, YL); R(px + 16, py - 6, 3, 1, '#8aa2b8'); R(px + 23, py - 6, 2, 1, '#6a8298');
  R(px + 24, py - 4, 1, 3, '#c8d4dc'); R(px + 25, py - 2, 2, 1, '#c8d4dc'); R(px + 23, py - 1, 1, 2, '#c8d4dc'); // cracked windscreen
  R(px + 14, py - 9, 16, 2, Y); R(px + 16, py + 1, 4, 3, '#4a3428');
  R(px + 8, py - 6, 2, 10, '#3a3a3e'); R(px + 8, py - 7, 2, 1, '#6f787d');
  R(px + 30, py - 2, 4, 4, '#3a3a3e');
  R(px + 32, py - 14, 5, 14, Y); R(px + 32, py - 14, 1, 14, YH); R(px + 36, py - 14, 1, 14, YL);
  R(px + 33, py - 16, 4, 3, '#3a3a3e'); R(px + 36, py - 15, 10, 4, Y); R(px + 36, py - 15, 10, 1, YH);
  R(px + 34, py - 10, 1, 9, '#9aa3a8');
  R(px + 44, py - 12, 6, 10, '#6f787d'); R(px + 44, py - 12, 6, 2, '#9aa3a8'); R(px + 44, py - 3, 6, 1, '#4a4d52'); R(px + 44, py - 6, 6, 3, MUD); // bucket resting, mud inside
  for (let i = 0; i < 3; i++) R(px + 44 + i * 2, py - 2, 1, 2, '#c8cfd0');
  R(px + 3, py + 17, 8, 2, '#2f2f33'); R(px + 4, py + 17, 2, 2, Y); R(px + 8, py + 17, 2, 2, Y);
}
// D7 traps: each has a grey switch box (lever + LED, drawn live) and a world prop
function trapProp(ctx, t, rng) {
  const R = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); };
  const px = t.sx * TS, py = t.sy * TS;
  R(px + 4, py + 2, 8, 12, '#4a4d52'); R(px + 4, py + 2, 8, 2, '#6f787d'); R(px + 4, py + 2, 1, 12, '#5e6268'); R(px + 6, py + 6, 4, 5, '#2f2f33'); R(px + 11, py + 7, 2, 1, '#9aa3a8'); R(px + 12, py + 4, 1, 4, '#c0302a'); // box, lever
  const [x0, y0, x1, y1] = t.area.map((v) => v * TS);
  switch (t.kind) {
    case 'fence': for (let x = x0; x <= x1 + 8; x += 16) { R(x, y0 - 6, 2, 10, '#5a3e2a'); R(x - 1, y0 - 5, 4, 2, '#e8dfc6'); R(x - 1, y0, 4, 2, '#e8dfc6'); } R(x0, y0 - 4, x1 - x0 + 8, 1, '#9aa3a8'); R(x0, y0 + 1, x1 - x0 + 8, 1, '#9aa3a8'); // insulators
      R(x0 + 4, y0 - 14, 9, 8, '#e2b53c'); R(x0 + 4, y0 - 14, 9, 1, '#f4d070'); R(x0 + 7, y0 - 12, 2, 3, '#2b1d16'); R(x0 + 8, y0 - 9, 1, 1, '#2b1d16'); break; // warning sign
    case 'petrol': for (let x = x0; x < x1 + 16; x += 4) { R(x, y1 + 12, 4, 2, '#4a4d52'); R(x, y1 + 12, 4, 1, '#6f787d'); if (x % 16 === 0) { R(x + 1, y1 + 10, 2, 2, '#2f2f33'); R(x + 1, y1 + 9, 1, 1, '#9aa3a8'); } } break; // pipes, nozzle row
    case 'fireline': for (let x = x0; x < x1 + 16; x += 4) { R(x, y0 + 6, 4, 2, '#3a3530'); R(x + 1, y0 + 6, 1, 1, '#5a4a3a'); } break;
    case 'searchlight': { const sx = x0 - 18, sy = y0 + 20; R(sx + 3, sy + 4, 1, 8, '#4a4d52'); R(sx - 1, sy + 11, 2, 2, '#4a4d52'); R(sx + 7, sy + 11, 2, 2, '#4a4d52'); R(sx + 1, sy + 8, 6, 1, '#4a4d52'); R(sx, sy - 2, 8, 7, '#3a3a3e'); R(sx, sy - 2, 8, 1, '#5a5e64'); R(sx + 6, sy - 1, 2, 5, '#d9d2b8'); break; } // drum lamp on a tripod
    case 'bell': break; // the church bell is part of St Mary's tower
  }
}
const RACK_NAME = (id) => id.startsWith('t:') ? THROWS[id.slice(2)].name : (MELEE[id] || GUNS[id]).name;
const RACK_COST = (id) => id.startsWith('t:') ? THROWS[id.slice(2)].cost : (MELEE[id] || GUNS[id]).cost;
function rack(ctx, r) {
  const R = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); };
  const px = r.x * TS, py = r.y * TS;
  R(px - 2, py - 4, 20, 18, '#3a2e24'); R(px - 1, py - 3, 18, 16, '#c49a62'); R(px - 1, py - 3, 18, 1, '#d8b07a');
  for (let i = 0; i < 18; i += 3) for (let j = 0; j < 16; j += 3) R(px - 1 + i + 1, py - 3 + j + 1, 1, 1, '#8f6a3e');
  ctx.drawImage(iconWhite(r.item), px + 2, py - 2); // chalk outline of what's on offer
  const cost = String(RACK_COST(r.item)), cw = pixelTextWidth(cost);
  R(px + 8 - cw / 2 - 2, py + 8, cw + 4, 7, '#6a4a10'); R(px + 8 - cw / 2 - 1, py + 9, cw + 2, 5, '#c9902a'); // amber price plate
  pixelText(ctx, cost, px + 8 - cw / 2, py + 9, '#2b1d16');
}
function comfortSign(ctx, px, py, id) {
  const R = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); };
  const col = id === 'secondWind' ? '#5d8a4a' : COMFORTS[id].color;
  R(px - 1, py - 6, 18, 20, '#2b1d16'); R(px, py - 5, 16, 18, col); R(px, py - 5, 16, 2, shade(col, 0.3)); R(px + 1, py - 3, 14, 14, shade(col, -0.35));
  R(px + 2, py - 8, 1, 3, '#8c8f86'); R(px + 13, py - 8, 1, 3, '#8c8f86'); // hanging chains
  ctx.drawImage(icon(id), px + 1, py - 4);
}
function decor(ctx, d, rng) {
  const R = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); };
  const x = Math.round(d.x), y = Math.round(d.y);
  switch (d.kind) {
    case 'banner': R(x - 34, y - 10, 68, 9, '#e8dfc6'); R(x - 34, y - 10, 68, 1, '#f2ead6'); R(x - 34, y - 2, 68, 1, '#a8a08a'); R(x + 20, y - 9, 6, 3, '#c8bf9a'); pixelText(ctx, 'SAVE OUR TOWN', x - 25, y - 8, '#b5503b'); R(x - 36, y - 12, 1, 14, '#5a3e2a'); R(x + 35, y - 12, 1, 14, '#5a3e2a'); break;
    case 'trolley': R(x - 5, y - 4, 10, 6, '#9aa3a8'); for (let i = 0; i < 10; i += 2) R(x - 5 + i, y - 4, 1, 6, '#6f787d'); R(x - 5, y - 4, 10, 1, '#c0c4c8'); R(x + 5, y - 6, 1, 3, '#c0302a'); R(x - 4, y + 2, 2, 2, '#2f2f33'); R(x + 3, y + 2, 2, 2, '#2f2f33'); R(x - 3, y - 3, 3, 2, '#e8dfc6'); break;
    case 'bicycle': R(x - 7, y, 5, 5, '#2f2f33'); R(x - 6, y + 1, 3, 3, '#6f787d'); R(x + 2, y, 5, 5, '#2f2f33'); R(x + 3, y + 1, 3, 3, '#6f787d'); R(x - 5, y + 2, 10, 1, '#b5503b'); R(x - 1, y - 2, 1, 4, '#b5503b'); R(x - 2, y - 3, 3, 1, '#2b1d16'); R(x + 4, y - 2, 1, 3, '#9aa3a8'); R(x + 3, y - 3, 3, 1, '#2f2f33'); break;
    case 'pram': R(x - 5, y - 6, 10, 7, '#4d7fb8'); R(x - 5, y - 6, 10, 1, '#6a9ad0'); R(x - 6, y - 7, 6, 4, '#3d6a9a'); R(x - 6, y - 7, 6, 1, '#5a80b8'); R(x + 4, y - 9, 1, 3, '#9aa3a8'); R(x + 4, y - 9, 3, 1, '#9aa3a8'); R(x - 4, y + 1, 3, 3, '#2f2f33'); R(x + 2, y + 1, 3, 3, '#2f2f33'); R(x - 3, y + 2, 1, 1, '#9aa3a8'); R(x + 3, y + 2, 1, 1, '#9aa3a8'); break;
    case 'binbags': R(x - 7, y - 3, 7, 6, '#1e2024'); R(x - 1, y - 4, 7, 7, '#25282c'); R(x - 5, y - 4, 2, 1, '#3a3e44'); R(x + 1, y - 5, 2, 1, '#3a3e44'); R(x + 2, y - 6, 1, 1, '#c8bf9a'); R(x - 4, y + 2, 2, 1, '#e8dfc6'); break;
    case 'sand': for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i; j++) { const sx = x - 10 + j * 7 + i * 3, sy = y + 1 - i * 3; R(sx, sy, 6, 4, '#c09a62'); R(sx, sy, 6, 1, '#d8b88a'); R(sx + 5, sy, 1, 4, '#a07a4a'); R(sx + 2, sy + 1, 1, 1, '#a07a4a'); } break; // sandbags
    case 'scaffold': for (let i = 0; i < 4; i++) { R(x - 24 + i * 16, y - 20, 2, 40, '#9aa3a8'); R(x - 24 + i * 16, y - 20, 1, 40, '#c0c4c8'); } R(x - 24, y - 10, 50, 2, '#9aa3a8'); R(x - 24, y + 4, 50, 3, '#c49a62'); R(x - 24, y + 4, 50, 1, '#d8b07a'); for (let i = 0; i < 4; i++) R(x - 25 + i * 16, y - 11, 4, 4, '#6f787d'); R(x - 20, y - 18, 20, 6, 'rgba(90,140,180,0.4)'); break;
    case 'bed': R(x - 12, y - 4, 24, 8, '#5a3e24'); for (let i = -10; i < 12; i += 4) { R(x + i, y - 3, 2, 3, '#5d8a3a'); R(x + i, y - 4, 1, 1, '#7aaa4a'); } R(x - 12, y - 4, 24, 1, '#8f6a3e'); R(x - 12, y + 3, 24, 1, '#3a2a1e'); break;
    case 'flowers': for (let i = 0; i < 6; i++) { R(x - 8 + i * 3, y - 2 + (i % 2), 2, 2, ['#e2b53c', '#d84a3a', '#e8dfc6'][i % 3]); R(x - 8 + i * 3, y + (i % 2), 1, 2, '#46963a'); } break;
    case 'bench': R(x - 10, y - 4, 20, 3, '#8f6a3e'); R(x - 10, y - 4, 20, 1, '#c49a62'); R(x - 10, y - 7, 20, 2, '#c49a62'); R(x - 10, y - 7, 20, 1, '#d8b07a'); R(x - 9, y - 1, 2, 4, '#3a3a3e'); R(x + 7, y - 1, 2, 4, '#3a3a3e'); R(x - 2, y - 6, 4, 1, '#c9a24a'); break;
    case 'bunting': {
      const cols = ['#b5503b', '#e2b53c', '#4d7fb8', '#5d8a4a']; // v1.6: strung across the street, Hardware gutter to Bakery gutter
      for (let i = 0; i < 16; i++) { const bx = 45 * TS + i * 7, by = 27 * TS - 4 + Math.round(Math.sin(i / 16 * Math.PI) * 6); R(bx, by, 7, 1, '#2b1d16'); R(bx + 2, by + 1, 3, 2, cols[i % 4]); R(bx + 3, by + 3, 1, 1, cols[i % 4]); R(bx + 2, by + 1, 1, 1, shade(cols[i % 4], 0.3)); }
      break;
    }
  }
}
