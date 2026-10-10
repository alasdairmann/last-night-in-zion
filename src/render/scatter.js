// The rest of the repetition audit, baked (ART-PRD-3 S4: VA-2 lawns, VA-4 trees, VA-6 street furniture, VA-9 roads).
// Decor only: nothing here touches collision, and nothing is drawn on or next to a tile the player acts on.
import { FLOOR, WALL, G } from '../map/town.js';
import { RNG } from '../rng.js';
import { shade } from './palette.js';

const TS = 16;

// VA-6: lamps are straight, leaning or smashed (the smashed one flickers in the lighting pass)
export const lampKind = (i) => (i % 6 === 3 ? 'smashed' : i % 5 === 1 ? 'lean' : 'straight');
export function lamp(R, l, i) {
  const k = lampKind(i), lean = k === 'lean' ? 1 : 0;
  R(l.x - 2, l.y + 1, 4, 2, 'rgba(0,0,0,0.3)'); R(l.x - 2, l.y - 4, 4, 2, '#3a3a3e');
  for (let j = 0; j < 24; j++) { const ox = lean ? Math.floor((24 - j) / 8) : 0; R(l.x - 1 + ox, l.y - 22 + j, 2, 1, '#3a3a3e'); R(l.x - 1 + ox, l.y - 22 + j, 1, 1, '#4a4d52'); }
  const hx = l.x + lean * 3;
  R(hx - 3, l.y - 24, 6, 3, '#4a4d52'); R(hx - 3, l.y - 24, 6, 1, '#6f787d');
  if (k === 'smashed') { R(hx - 2, l.y - 21, 1, 1, '#c8bf9a'); R(hx + 1, l.y - 21, 1, 1, '#8a857a'); for (let n = 0; n < 5; n++) R(l.x - 6 + n * 3, l.y + 3 + (n % 2), 1, 1, n % 2 ? '#c8d4dc' : '#8aa2b8'); } // glass on the pavement
  else R(hx - 2, l.y - 21, 4, 1, '#c8bf9a');
}

// VA-4: four species, a lean, the shadow to the lower right
export function tree(ctx, x, y, rng, species) {
  const R = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); };
  const sp = species || ['oak', 'oak', 'conifer', 'birch', 'dead'][rng.int(0, 4)];
  const s = rng.int(10, 16), lean = rng.int(-1, 1);
  R(x + 3, y + s - 1, s, 4, 'rgba(20,16,12,0.25)'); // shadow, lower right
  if (sp === 'conifer') {
    R(x + s / 2 - 1, y + s, 2, 4, '#4a3020');
    for (let j = 0; j < s + 2; j++) { const w = Math.max(1, Math.round((j / (s + 2)) * s)), ox = x + ((s - w) >> 1) + Math.round(lean * (1 - j / s)); R(ox, y - 2 + j, w, 1, j % 3 === 2 ? '#14361a' : '#1d4a24'); if (w > 3) R(ox, y - 2 + j, 1, 1, '#2f6a34'); }
    return;
  }
  const trunk = sp === 'birch' ? ['#d8d4c8', '#3a3530'] : sp === 'dead' ? ['#6a5a48', '#4a3e30'] : ['#5a3e2a', '#7a5a3e'];
  R(x + s / 2 - 1, y + s - 4, 3, 8, trunk[0]); R(x + s / 2 - 1 + (sp === 'birch' ? 1 : 0), y + s - 2, 1, 2, trunk[1]);
  if (sp === 'dead') { // bare branches
    const cx = x + s / 2;
    for (const [dx, dy, l] of [[-1, -2, 5], [1, -3, 6], [-1, -6, 3], [1, -7, 4]]) for (let i = 0; i < l; i++) R(cx + dx * i + lean, y + s - 4 + dy - (i >> 1), 1, 1, i % 2 ? '#4a3e30' : '#6a5a48');
    R(cx + lean, y + 1, 1, s - 4, '#5a4a38');
    return;
  }
  const leaf = sp === 'birch' ? ['#4a7a2a', '#6a9a3a', '#8ab84a', '#a8d060'] : ['#1f4a1e', '#2f6f2c', '#46963a', '#6cbf4a'];
  const lx = x + lean;
  R(lx, y + 2, s, s - 4, leaf[0]); R(lx + 2, y, s - 4, s, leaf[0]);
  R(lx + 1, y + 2, s - 2, s - 5, leaf[1]); R(lx + 3, y + 1, s - 6, s - 3, leaf[1]);
  R(lx + 2, y + 2, s / 2, s / 2 - 1, leaf[2]); R(lx + 3, y + 2, 3, 2, leaf[3]);
  if (sp === 'birch') for (let i = 0; i < 5; i++) R(lx + rng.int(1, s - 2), y + rng.int(1, s - 3), 1, 1, leaf[3]);
  else for (let i = 0; i < 4; i++) R(lx + rng.int(2, s - 3), y + rng.int(3, s - 4), 1, 1, i % 2 ? leaf[0] : '#5aa040');
  // HD: half-pixel leaf clusters, placed by position so the 1x layout (rng) is unchanged
  for (let i = 0; i < 14; i++) { const k = (x * 31 + y * 17 + i * 53) % 97, a = lx + 1 + (k % (s - 2)), b = y + 1 + ((k * 7) % (s - 3)); R(a + 0.5, b, 0.5, 0.5, i % 3 ? leaf[3] : leaf[2]); R(a, b + 0.5, 0.5, 0.5, leaf[0]); }
}

// Tiles near anything the player acts on stay clear of scatter.
function busySet(map) {
  const W = map.W, busy = new Uint8Array(W * map.H), mark = (x, y, r = 1) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const xx = x + i, yy = y + j; if (xx >= 0 && yy >= 0 && xx < W && yy < map.H) busy[yy * W + xx] = 1; } };
  for (const o of [...map.racks, ...map.comfortSpots, map.secondWind, map.workshop, map.generator, map.ammoCrate, ...map.vault, map.jerry, ...map.crateSpots, ...map.braziers, ...map.barrels]) mark(o.x, o.y);
  for (const s of Object.values(map.spots)) mark(s.x, s.y);
  for (const b of map.barricades) { mark(b.tx, b.ty); mark(b.inside.tx, b.inside.ty); }
  for (const d of map.doors) for (const [x, y] of d.tiles) mark(x, y, 2);
  for (const t of map.traps) { mark(t.sx, t.sy); for (let y = t.area[1]; y <= t.area[3]; y++) for (let x = t.area[0]; x <= t.area[2]; x++) mark(x, y, 0); }
  for (const l of map.lamps) mark(Math.floor(l.x / TS), Math.floor(l.y / TS), 0);
  for (const d of map.decor) mark(Math.floor(d.x / TS), Math.floor(d.y / TS));
  for (const p of map.props) for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) mark(x, y);
  return busy;
}

// VA-2, ground level: long grass, molehills, toys, garden plots, washing lines, desire paths from doors to the road.
export function drawLawns(ctx, map) {
  const R = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); };
  const rng = new RNG(7171), W = map.W, busy = busySet(map);
  const I = (x, y) => y * W + x, open = (x, y) => x > 1 && y > 1 && x < W - 2 && y < map.H - 2 && map.tiles[I(x, y)] === FLOOR && map.ground[I(x, y)] === G.GRASS && !busy[I(x, y)];
  // desire paths: from each building's door straight down to the first hard ground, worn into the grass
  for (const b of map.buildings) {
    if (b.kind === 'pub') continue;
    const dx = b.x + b.w - 2, y0 = b.y + b.h;
    for (let y = y0, k = 0; y < map.H - 2 && k < 12; y++, k++) {
      const g = map.ground[I(dx, y)]; if (g !== G.GRASS) { if (k) break; continue; }
      if (map.tiles[I(dx, y)] !== FLOOR) break;
      for (let j = 0; j < TS; j += 2) { const wob = Math.round(Math.sin((y * TS + j) / 9) * 2); R(dx * TS + 3 + wob, y * TS + j, 6, 2, 'rgba(120,104,64,0.45)'); R(dx * TS + 5 + wob, y * TS + j, 2, 1, 'rgba(90,74,50,0.5)'); }
    }
  }
  for (let y = 2; y < map.H - 2; y++) for (let x = 2; x < W - 2; x++) {
    if (!open(x, y)) continue;
    const px = x * TS, py = y * TS, r = rng.next();
    if (r < 0.16) { R(px + 1, py + 3, 14, 11, 'rgba(40,80,30,0.35)'); for (let i = 0; i < 8; i++) { const tx = px + rng.int(0, 12), ty = py + rng.int(4, 14); R(tx, ty - 4, 1, 5, '#3e7a2c'); R(tx + 1, ty - 5, 1, 5, '#6aa848'); R(tx + 2, ty - 3, 1, 3, '#2f6f2c'); } if (rng.next() < 0.3) R(px + rng.int(2, 12), py + rng.int(2, 8), 2, 2, ['#d8d0b0', '#c87a9a', '#e2c03a'][rng.int(0, 2)]); } // long grass, seed heads
    else if (r < 0.18) { R(px + 2, py + 4, 12, 9, '#2f5a22'); R(px + 3, py + 3, 9, 4, '#3e7a2c'); R(px + 4, py + 4, 3, 2, '#5aa040'); R(px + 2, py + 12, 12, 2, 'rgba(20,16,12,0.25)'); } // a bramble patch
    else if (r < 0.2) { R(px + 5, py + 7, 6, 3, '#5a4632'); R(px + 6, py + 6, 4, 1, '#6e5a42'); R(px + 7, py + 8, 1, 1, '#463624'); } // molehill
    else if (r < 0.208) { const c = ['#d84a3a', '#4d7fb8', '#e2b53c'][rng.int(0, 2)]; R(px + 6, py + 6, 4, 4, c); R(px + 6, py + 6, 2, 1, shade(c, 0.4)); R(px + 9, py + 9, 2, 1, 'rgba(0,0,0,0.3)'); } // a ball, faded
    else if (r < 0.213) { R(px + 4, py + 6, 6, 5, '#e2b53c'); R(px + 4, py + 6, 6, 1, '#f4d070'); R(px + 10, py + 7, 3, 1, '#b5503b'); } // a bucket and spade
  }
  // one garden plot and one washing line per zone with homes
  const homes = { 3: [3, 33], 5: [4, 58], 9: [66, 53], 7: [34, 13], 6: [4, 15], 4: [66, 24] };
  for (const [z, [gx, gy]] of Object.entries(homes)) {
    let x = gx, y = gy; while (!(open(x, y) && open(x + 2, y) && open(x, y + 1) && open(x + 2, y + 1)) && x < gx + 8) x++;
    if (x >= gx + 8) continue;
    const px = x * TS, py = y * TS;
    if (+z % 2) { R(px, py, 40, 24, '#5a3e24'); R(px, py, 40, 1, '#7a5434'); for (let j = 3; j < 24; j += 5) { R(px + 1, py + j, 38, 1, '#463020'); for (let i = 2; i < 38; i += 5) { R(px + i, py + j - 2, 2, 2, '#5d8a3a'); R(px + i, py + j - 3, 1, 1, '#7aaa4a'); } } R(px - 1, py - 1, 1, 26, '#8f6a3e'); R(px + 40, py - 1, 1, 26, '#8f6a3e'); } // a garden plot gone to seed
    else { R(px + 2, py - 12, 2, 22, '#8a857a'); R(px + 38, py - 12, 2, 22, '#8a857a'); R(px + 3, py - 10, 36, 1, '#c8c4b8'); const cols = ['#e8dfc6', '#4d7fb8', '#d84a3a', '#e8dfc6', '#5d8a4a']; for (let i = 0; i < 5; i++) { R(px + 6 + i * 7, py - 9, 5, 6 + (i % 2) * 2, cols[i]); R(px + 6 + i * 7, py - 9, 5, 1, shade(cols[i], 0.25)); } R(px + 3, py + 9, 36, 2, 'rgba(0,0,0,0.15)'); } // a washing line, left out
  }
}

// VA-2 / VA-4, standing: 1-3 trees inside each block, planted against a wall or the fence, a tyre swing on one.
export function drawBlockTrees(ctx, map) {
  const rng = new RNG(8282), W = map.W, busy = busySet(map), I = (x, y) => y * W + x;
  const R = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); };
  let swing = false;
  for (const z of Object.values(map.zones)) {
    const want = 3 + (z.id % 3);
    let n = 0;
    for (let tries = 0; tries < 200 && n < want; tries++) {
      const x = rng.int(z.x0, z.x1), y = rng.int(z.y0, z.y1);
      if (map.tiles[I(x, y)] !== FLOOR || busy[I(x, y)] || map.ground[I(x, y)] === G.ROAD || map.ground[I(x, y)] === G.TARMAC || map.ground[I(x, y)] === G.PAVE) continue;
      let wall = false; for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0]]) if (map.tiles[I(x + dx, y + dy)] === WALL) wall = true;
      if (!wall) continue;
      const sp = ['oak', 'birch', 'conifer', 'dead', 'oak'][(z.id + n) % 5];
      tree(ctx, x * TS + rng.int(-2, 2), y * TS - 10, rng, sp);
      if (!swing && sp === 'oak' && (z.id === 3 || z.id === 6 || z.id === 9)) { swing = true; R(x * TS + 4, y * TS - 2, 1, 10, '#c8b88a'); R(x * TS + 1, y * TS + 8, 7, 5, '#1d1d20'); R(x * TS + 3, y * TS + 9, 3, 3, '#3a3d40'); } // a tyre swing
      n++;
    }
  }
}

// VA-9: road wear on top of the tarmac: patch repairs, manholes, skid marks, leaves along the gutters.
export function drawRoadWear(ctx, map) {
  const R = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); };
  const rng = new RNG(9393), W = map.W, I = (x, y) => y * W + x;
  const road = (x, y) => { const g = map.ground[I(x, y)]; return g === G.ROAD || g === G.TARMAC; };
  for (let y = 2; y < map.H - 2; y++) for (let x = 2; x < W - 2; x++) {
    if (!road(x, y) || map.tiles[I(x, y)] !== FLOOR) continue;
    const px = x * TS, py = y * TS, r = rng.next();
    if (r < 0.05) { const w = rng.int(8, 20), h = rng.int(6, 12); R(px, py + 2, w, h, '#33363a'); R(px, py + 2, w, 1, '#2a2d30'); R(px + w - 1, py + 2, 1, h, '#2a2d30'); } // a patch repair, darker and newer
    else if (r < 0.065) { R(px + 4, py + 4, 8, 8, '#2a2d30'); R(px + 5, py + 5, 6, 6, '#4a4d50'); for (let i = 0; i < 3; i++) R(px + 6, py + 6 + i * 2, 4, 1, '#3a3d40'); } // a manhole
    else if (r < 0.08) { const sx = px + rng.int(0, 6); for (let i = 0; i < 14; i++) { R(sx + i, py + 5 + Math.round(i * 0.3), 1, 1, '#24272a'); R(sx + i, py + 9 + Math.round(i * 0.3), 1, 1, '#24272a'); } } // skid marks
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) if (map.ground[I(x + dx, y + dy)] === G.PAVE && rng.next() < 0.35) { const gx = dx ? (dx < 0 ? px : px + 13) : px + rng.int(0, 12), gy = dy ? (dy < 0 ? py : py + 13) : py + rng.int(0, 12); R(gx, gy, 3, 2, ['#8a5a2a', '#a8742e', '#6b4a2e'][rng.int(0, 2)]); R(gx + 1, gy, 1, 1, '#c8903a'); } // leaves in the gutter
  }
}
