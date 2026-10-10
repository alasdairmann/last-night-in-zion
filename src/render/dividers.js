// Zone dividers (ART-PRD-3 S2). Collision is unchanged: every divider tile is still WALL in town.js. Only the
// drawing varies: each of the 12 segments between junctions gets its own boundary type chosen from the zones on
// either side, posts or piers every few tiles, one feature every 6-8 tiles (at least one silence and one tonight
// detail per segment), something at each junction, and decor overlapping the line. Doors are drawn elsewhere.
import { WALL, DOOR } from '../map/town.js';
import { RNG } from '../rng.js';
import { RAMP, DIV, shade } from './palette.js';
import { pixelText } from './sprites.js';

const TS = 16, CHALK = '#d8d4c8';
const COLS = [[2, 31], [33, 63], [65, 93]], ROWS = [[2, 20], [22, 42], [44, 61]];
// [horizontal y=21 | y=43][column] and [vertical x=32 | x=64][row]
const H_TYPES = [['stone', 'railings', 'hoarding'], ['collapse', 'shopbacks', 'boards']];
const V_TYPES = [['hedge', 'lowrail', 'beergarden'], ['chainlink', 'breeze', 'allotment']];

export function drawDividers(ctx, map, T) {
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const rng = new RNG(2121); // its own stream, so the rest of the bake keeps its randomness
  const segs = [];
  for (let h = 0; h < 2; h++) for (let c = 0; c < 3; c++) segs.push({ horiz: true, at: h ? 43 : 21, from: COLS[c][0], to: COLS[c][1], type: H_TYPES[h][c], k: segs.length });
  for (let v = 0; v < 2; v++) for (let r = 0; r < 3; r++) segs.push({ horiz: false, at: v ? 64 : 32, from: ROWS[r][0], to: ROWS[r][1], type: V_TYPES[v][r], k: segs.length });
  const isDoor = (x, y) => T(x, y) === DOOR;
  for (const s of segs) {
    const n = s.to - s.from + 1;
    s.cells = [];
    for (let i = 0; i < n; i++) {
      const x = s.horiz ? s.from + i : s.at, y = s.horiz ? s.at : s.from + i;
      if (T(x, y) !== WALL) continue;
      const nearDoor = s.horiz ? isDoor(x - 1, y) || isDoor(x + 1, y) : isDoor(x, y - 1) || isDoor(x, y + 1);
      s.cells.push({ x, y, i, n, nearDoor });
    }
    for (const c of s.cells) (s.horiz ? HDRAW : VDRAW)[s.type](R, c.x * TS, c.y * TS, c, rng, ctx);
  }
  junctions(R, rng);
  for (const s of segs) features(R, s, rng, ctx);
}

const hash = (a, b) => { let n = Math.imul(a * 374761393 + b * 668265263, 1274126177); n ^= n >>> 15; return n >>> 0; };
const capped = (R, px, py, c0, c1, c2) => { R(px, py - 6, TS, 2, c0); R(px, py - 4, TS, 1, c1); R(px, py - 3, TS, 1, c2); };

// ---------------- horizontal segments: a south face, drawn in the tile plus up to 10 px above ----------------
const HDRAW = {
  // Churchyard / fire station: rubble stone with a coping, lychgate piers either side of the church gate
  stone(R, px, py, c, rng) {
    const S = DIV.stone;
    R(px, py - 2, TS, TS + 2, S[2]);
    for (let r = 0; r < 4; r++) for (let bx = (r % 2) * -3; bx < TS; bx += 5 + ((c.i + r) % 3)) {
      const w = Math.min(4 + ((bx + r) & 1), TS - Math.max(0, bx)), x0 = px + Math.max(0, bx);
      if (w > 0) { R(x0, py - 1 + r * 4, w, 3, S[(r + c.i + (bx & 3)) % 2]); R(x0, py - 1 + r * 4, w, 1, S[0]); }
    }
    R(px, py - 6, TS, 4, DIV.coping[1]); R(px, py - 6, TS, 1, DIV.coping[0]); R(px, py - 3, TS, 1, DIV.coping[2]);
    if (rng.next() < 0.35) { R(px + rng.int(0, 10), py - 6, 5, 1, '#5a8a3a'); R(px + rng.int(0, 12), py + 12, 4, 2, '#4e7a30'); }
    if (c.nearDoor) { // lychgate pier: taller, a little slate cap
      R(px + 3, py - 12, 10, TS + 12, S[1]); R(px + 3, py - 12, 2, TS + 12, S[0]); R(px + 11, py - 12, 2, TS + 12, S[2]);
      R(px + 1, py - 15, 14, 3, '#4a5560'); R(px + 1, py - 15, 14, 1, '#6a7888'); R(px + 6, py - 18, 4, 3, '#4a5560');
    }
  },
  // School / square: green railings on a brick plinth, mesh cable-tied on behind
  railings(R, px, py, c) {
    const G = DIV.rail;
    R(px, py + 9, TS, 7, RAMP.brick[1]); R(px, py + 9, TS, 1, RAMP.brick[0]); R(px, py + 15, TS, 1, RAMP.brick[2]);
    for (let j = 0; j < 16; j += 2) for (let i = (j >> 1) % 2; i < TS; i += 3) R(px + i, py - 6 + j, 1, 1, 'rgba(176,184,188,0.55)'); // mesh
    R(px, py - 4, TS, 1, G[1]); R(px, py + 6, TS, 1, G[1]); R(px, py - 3, TS, 1, G[2]);
    for (let i = 1; i < TS; i += 3) { R(px + i, py - 8, 1, 17, G[1]); R(px + i, py - 9, 1, 1, G[0]); R(px + i, py - 7, 1, 1, G[0]); }
    if (c.i % 4 === 0) { R(px, py - 10, 2, 20, G[2]); R(px, py - 11, 2, 1, G[0]); } // standards
  },
  // Builders' yard / garage: painted hoarding, Heras panels where it ran out
  hoarding(R, px, py, c) {
    if (c.i % 7 >= 5) { // Heras: mesh panel on rubber feet, the yard visible through it
      R(px, py - 8, 1, 22, '#9aa3a8'); R(px + 15, py - 8, 1, 22, '#9aa3a8'); R(px, py - 8, TS, 1, '#c0c4c8'); R(px, py + 12, TS, 1, '#9aa3a8');
      for (let j = 0; j < 20; j += 3) for (let i = 2; i < 15; i += 3) R(px + i, py - 6 + j, 1, 1, '#8c949a');
      R(px - 2, py + 13, 5, 3, '#2f2f33'); R(px + 13, py + 13, 5, 3, '#2f2f33'); R(px - 1, py + 13, 3, 1, '#4a4d52');
      return;
    }
    const H = DIV.hoard;
    R(px, py - 8, TS, 24, H[1]); R(px, py - 8, TS, 1, H[0]); R(px, py + 15, TS, 1, H[2]);
    R(px + (c.i % 2 ? 8 : 0), py - 8, 1, 24, H[2]); // board joints every 8 px, staggered
    for (let k = 0; k < 3; k++) R(px + ((c.i * 5 + k * 7) % 14), py - 4 + k * 7, 2, 1, shade(H[1], 0.12)); // scuffs
    R(px, py + 12, TS, 4, '#5a4a3a'); // mud splash
  },
  // Fire station / Red Lion: the old brick, buttressed, with a collapsed run still blocking as rubble
  collapse(R, px, py, c, rng) {
    const B = RAMP.brick, M = RAMP.mortar, gone = c.i >= 8 && c.i <= 10;
    if (gone) { // a heap of brick, lower than the wall, and the broken ends
      R(px, py + 2, TS, 14, '#4a3a30');
      for (let k = 0; k < 14; k++) { const x = px + rng.int(0, 13), y = py + rng.int(-2, 12); R(x, y, 3, 2, B[k % 3]); R(x, y, 3, 1, B[0]); }
      R(px + rng.int(2, 10), py + 6, 4, 1, '#c8bf9a'); // a snapped plank across it
      return;
    }
    capped(R, px, py, B[0], '#d8907a', B[2]); R(px, py - 3, TS, 4, B[1]);
    R(px, py + 1, TS, TS - 1, M);
    for (let r = 0; r < 7; r++) { const yy = py + 2 + r * 2; for (let i = (r % 2) * 2 - 2; i < TS; i += 5) { const bx = Math.max(px, px + i), bw = Math.min(4, px + i + 4 - bx, px + TS - bx); if (bw > 0) R(bx, yy, bw, 1, B[(rng.int(0, 5) + r) % 3]); } }
    if (c.i === 7 || c.i === 11) { R(px + (c.i === 7 ? 10 : 0), py - 6, 6, 8, '#4a3a30'); } // broken end
    if (c.i % 4 === 1) { R(px + 4, py - 2, 8, 18, B[2]); R(px + 4, py - 2, 8, 2, B[0]); R(px + 4, py + 4, 8, 1, '#5a2a20'); R(px + 3, py + 14, 10, 2, B[2]); } // buttress
  },
  // Square / post office: the backs of shops. Tall yellow stock brick, drainpipes
  shopbacks(R, px, py, c, rng) {
    const Y = DIV.stock;
    R(px, py - 10, TS, 26, Y[2]);
    for (let r = 0; r < 12; r++) { const yy = py - 9 + r * 2; for (let i = (r % 2) * 2 - 2; i < TS; i += 5) { const bx = Math.max(px, px + i), bw = Math.min(4, px + i + 4 - bx, px + TS - bx); if (bw > 0) R(bx, yy, bw, 1, Y[(rng.int(0, 3) + r) % 2]); } }
    R(px, py - 11, TS, 2, '#8a857a'); R(px, py - 11, TS, 1, '#a8a398');
    if (c.i % 6 === 2) { R(px + 6, py - 11, 2, 27, '#3a3d40'); R(px + 6, py - 11, 1, 27, '#55585c'); R(px + 5, py + 13, 4, 3, '#3a3d40'); } // drainpipe
    R(px, py + 13, TS, 3, '#3a3a2e'); // damp at the foot
  },
  // Forecourt / Hunt & Tackle: close-boarded garden fence on concrete posts, gravel board
  boards(R, px, py, c) {
    const F = DIV.boards, h = 6 + ((c.i * 3) % 3); // boards at slightly different heights
    R(px, py - h, TS, TS + h - 3, F[1]);
    for (let i = 0; i < TS; i += 3) { R(px + i, py - h + ((i * 7 + c.i) % 3 === 0 ? 1 : 0), 1, TS + h - 3, F[2]); R(px + i + 1, py - h, 1, 1, F[0]); }
    R(px, py + 2, TS, 1, F[2]); R(px, py + 12, TS, 4, '#8a857a'); R(px, py + 12, TS, 1, '#a8a398');
    if (c.i % 2 === 0) { R(px, py - 9, 3, 25, '#a8a398'); R(px, py - 9, 1, 25, '#c8c4b8'); R(px, py - 9, 3, 1, '#c8c4b8'); }
  },
};

// ---------------- vertical segments: a run seen from above, narrower than the tile, posts every few tiles ----------------
const vShadow = (R, px, py, x, w) => R(px + x + w, py, 2, TS, 'rgba(20,16,12,0.28)');
const VDRAW = {
  // Church / school: a hedge with a gap plugged by pallets
  hedge(R, px, py, c, rng) {
    if (c.i >= 6 && c.i <= 7) { // the gap, plugged
      vShadow(R, px, py, 3, 10); R(px + 3, py, 10, TS, '#3a2e24');
      for (let j = 0; j < TS; j += 4) { R(px + 3, py + j, 10, 3, '#c49a62'); R(px + 3, py + j, 10, 1, '#d8b07a'); }
      R(px + 7, py, 2, TS, '#8f6a3e'); return;
    }
    const bump = (k) => (hash(c.y, k) % 3);
    vShadow(R, px, py, 1, 14);
    R(px + 1 + bump(1), py, 14 - bump(1) - bump(2), TS, '#2f6f2c');
    R(px + 2 + bump(1), py, 4, TS, '#46963a'); R(px + 3 + bump(3), py + bump(4) * 4, 3, 3, '#6cbf4a');
    for (let k = 0; k < 4; k++) R(px + 2 + rng.int(0, 10), py + rng.int(0, 14), 2, 1, k % 2 ? '#1f4a1e' : '#5aa040');
    if (c.i === 0) { R(px + 1, py - 4, 14, 4, '#2f6f2c'); R(px + 2, py - 4, 6, 2, '#46963a'); }
  },
  // Playing field / builders' yard: chain-link, a concrete post every 32 px, one section torn
  chainlink(R, px, py, c) {
    const torn = c.i === 12 || c.i === 13;
    R(px + 7, py, 2, TS, 'rgba(20,24,28,0.25)');
    for (let j = 0; j < TS; j += 2) for (let i = 5 + ((j >> 1) % 2); i < 11; i += 2) if (!torn || (j + i) % 5) R(px + i, py + j, 1, 1, '#9aa3a8');
    if (torn) { R(px + 10, py + 2, 4, 6, '#9aa3a8'); R(px + 11, py + 3, 2, 4, 'rgba(20,24,28,0.5)'); R(px + 12, py + 8, 3, 1, '#c0c4c8'); } // peeled back, still blocking
    if (c.i % 2 === 0) { R(px + 5, py + 1, 6, 6, '#8a857a'); R(px + 5, py + 1, 6, 1, '#b8b2a4'); R(px + 10, py + 1, 1, 6, '#6a665c'); R(px + 11, py + 2, 2, 5, 'rgba(20,16,12,0.28)'); } // concrete post
  },
  // Fire station / square: a low brick wall with black railings set in its top
  lowrail(R, px, py, c) {
    const B = RAMP.brick;
    vShadow(R, px, py, 4, 8); R(px + 4, py, 8, TS, B[1]); R(px + 4, py, 2, TS, B[0]); R(px + 10, py, 2, TS, B[2]);
    for (let j = 0; j < TS; j += 4) R(px + 4, py + j, 8, 1, RAMP.mortar);
    for (let j = 1; j < TS; j += 3) { R(px + 7, py + j, 2, 2, '#1d1d20'); R(px + 7, py + j, 1, 1, '#4a4d52'); }
    if (c.i % 5 === 0) { R(px + 3, py + 1, 10, 4, B[2]); R(px + 3, py + 1, 10, 1, B[0]); } // pier
  },
  // Square / garage: breeze block, tagged, with a mural on one run
  breeze(R, px, py, c) {
    const D = DIV.breeze;
    vShadow(R, px, py, 2, 12); R(px + 2, py, 12, TS, D[1]); R(px + 2, py, 2, TS, D[0]); R(px + 12, py, 2, TS, D[2]);
    R(px + 2, py + ((c.i % 2) ? 7 : 15), 12, 1, D[2]); R(px + 8, py + ((c.i % 2) ? 0 : 8), 1, 7, D[2]);
    if (c.i >= 4 && c.i <= 7) { // the mural: hills, a sun, ZION
      const k = c.i - 4;
      R(px + 3, py, 10, TS, '#4d7fb8'); if (k === 0) { R(px + 6, py + 6, 5, 5, '#e2b53c'); R(px + 7, py + 7, 3, 3, '#f4d070'); }
      R(px + 3, py + 8 + (k % 2) * 2, 10, 8 - (k % 2) * 2, '#5d8a4a'); R(px + 3, py + 8 + (k % 2) * 2, 10, 1, '#7ab05a');
      if (k === 2) { R(px + 5, py + 2, 1, 5, '#f2ead6'); R(px + 7, py + 2, 1, 5, '#f2ead6'); R(px + 5, py + 2, 3, 1, '#f2ead6'); }
    } else if (c.i % 5 === 1) { R(px + 4, py + 3, 7, 2, '#b5503b'); R(px + 5, py + 5, 1, 3, '#b5503b'); R(px + 8, py + 6, 3, 1, '#d9c23a'); } // a tag
    else if (c.i % 5 === 3) { R(px + 4, py + 9, 6, 1, '#6a9ad0'); R(px + 9, py + 7, 1, 4, '#6a9ad0'); }
  },
  // Pub car park / post office: beer-garden trellis fence, festoon hooks, the bulbs dead
  beergarden(R, px, py, c) {
    const F = DIV.trellis;
    vShadow(R, px, py, 5, 6); R(px + 5, py, 6, TS, F[1]); R(px + 5, py, 1, TS, F[0]); R(px + 10, py, 1, TS, F[2]);
    for (let j = 0; j < TS; j += 4) { R(px + 5, py + j, 6, 1, F[2]); R(px + 6 + ((j >> 2) % 2) * 2, py + j + 2, 1, 1, F[0]); }
    if (c.i % 3 === 0) { R(px + 4, py, 8, 3, F[2]); R(px + 4, py, 8, 1, F[0]); R(px + 12, py + 1, 2, 1, '#2f2f33'); } // post and hook
    for (let j = 0; j < TS; j += 4) { const sag = Math.round(Math.sin(((c.i * TS + j) / 48) * Math.PI) * 2); R(px + 13 + sag, py + j, 1, 1, '#2b1d16'); if (j % 8 === 0) R(px + 13 + sag, py + j + 1, 1, 2, '#c8c0a8'); } // the cable and dead bulbs
  },
  // Pharmacy / allotments: whatever came to hand. Pallets, old doors, corrugated sheet
  allotment(R, px, py, c) {
    const k = hash(c.i, 7) % 3;
    vShadow(R, px, py, 3, 9);
    if (k === 0) { R(px + 3, py, 9, TS, '#3a2e24'); for (let j = 0; j < TS; j += 4) { R(px + 3, py + j, 9, 3, '#c49a62'); R(px + 3, py + j, 9, 1, '#d8b07a'); } }
    else if (k === 1) { const col = ['#4d7fb8', '#7a3a35', '#2f5a3a'][c.i % 3]; R(px + 3, py, 9, TS, col); R(px + 3, py, 1, TS, shade(col, 0.2)); R(px + 5, py + 2, 5, 5, shade(col, -0.2)); R(px + 5, py + 9, 5, 5, shade(col, -0.2)); R(px + 10, py + 8, 1, 1, '#e2c060'); }
    else { R(px + 3, py, 9, TS, '#8c949a'); for (let j = 0; j < TS; j += 2) R(px + 3, py + j, 9, 1, '#6f787d'); R(px + 4 + (c.i % 5), py + 4, 3, 5, '#a8552e'); }
  },
};

// Junctions: never a plain crossing.
function junctions(R, rng) {
  const at = (x, y) => [x * TS, y * TS];
  { const [px, py] = at(32, 21); // stone gate pier with a ball finial
    R(px + 1, py - 10, 14, TS + 10, DIV.stone[1]); R(px + 1, py - 10, 3, TS + 10, DIV.stone[0]); R(px + 12, py - 10, 3, TS + 10, DIV.stone[2]);
    R(px, py - 12, TS, 3, DIV.coping[1]); R(px, py - 12, TS, 1, DIV.coping[0]); R(px + 5, py - 17, 6, 5, DIV.coping[1]); R(px + 6, py - 17, 2, 2, DIV.coping[0]); }
  { const [px, py] = at(64, 21); // concrete post with a site lamp, its cable trailing
    R(px + 4, py - 8, 8, TS + 8, '#8a857a'); R(px + 4, py - 8, 2, TS + 8, '#b8b2a4'); R(px + 10, py - 8, 2, TS + 8, '#6a665c');
    R(px + 7, py - 22, 2, 14, '#3a3d40'); R(px + 4, py - 24, 8, 3, '#d9c23a'); R(px + 5, py - 22, 6, 1, '#8a7a2a'); R(px + 12, py - 4, 1, 12, '#2b1d16'); }
  { const [px, py] = at(32, 43); // brick pier and a pillar box nobody empties
    R(px + 1, py - 8, 14, TS + 8, RAMP.brick[1]); R(px + 1, py - 8, 3, TS + 8, RAMP.brick[0]); R(px + 12, py - 8, 3, TS + 8, RAMP.brick[2]);
    R(px, py - 10, TS, 3, '#a8a398'); R(px, py - 10, TS, 1, '#c8c4b8');
    R(px + 4, py + 4, 8, 12, '#a8302a'); R(px + 4, py + 3, 8, 2, '#c8483a'); R(px + 5, py + 7, 6, 1, '#2b1d16'); R(px + 10, py + 4, 2, 12, '#7a2a22'); R(px + 6, py + 10, 4, 2, '#e2c060'); }
  { const [px, py] = at(64, 43); // a telegraph pole, the wires down
    R(px + 2, py - 4, 12, TS + 4, '#6a665c'); R(px + 2, py - 4, 12, 1, '#8a857a');
    R(px + 6, py - 26, 4, 30, '#5a3e2a'); R(px + 6, py - 26, 1, 30, '#7a5a3e'); R(px + 2, py - 24, 12, 2, '#5a3e2a'); R(px + 3, py - 25, 1, 1, '#c0c4c8'); R(px + 12, py - 25, 1, 1, '#c0c4c8');
    for (let i = 0; i < 10; i++) R(px + 13 + i, py - 24 + i * 2, 1, 1, '#2b1d16'); }
  void rng;
}

// One feature every 6-8 tiles; the first is always a silence detail, the second a tonight detail.
const H_FEATS = ['flyer', 'ivy', 'bin', 'bike', 'shrub', 'flyer', 'ivy'], V_FEATS = ['ivy', 'bin', 'bike', 'shrub'];
function features(R, s, rng, ctx) {
  const cells = s.cells.filter((c) => !c.nearDoor);
  let k = 0;
  for (let j = 2 + (s.k % 3); j < cells.length; j += 6 + ((s.k + k) % 3), k++) {
    const c = cells[j], px = c.x * TS, py = c.y * TS;
    const kind = k === 0 ? (s.k % 2 ? 'tally' : 'shh') : k === 1 ? 'patch' : (s.horiz ? H_FEATS : V_FEATS)[(s.k + k) % (s.horiz ? H_FEATS.length : V_FEATS.length)];
    (s.horiz ? hFeature : vFeature)(R, kind, px, py, s, c, rng, ctx);
  }
  if (s.type === 'railings') { const c = cells[4]; if (c) { const px = c.x * TS, py = c.y * TS; R(px - 4, py - 4, 26, 9, '#2f5a3a'); R(px - 3, py - 3, 24, 7, '#e8dfc6'); pixelText(ctx, 'SCHOOL', px - 2, py - 2, '#2f5a3a'); }
    for (const j of [8, 15, 22]) { const c2 = cells[j]; if (c2) { const px = c2.x * TS, py = c2.y * TS; R(px + 3, py - 3, 9, 7, '#f2ead6'); R(px + 4, py - 2, 3, 3, ['#e2b53c', '#b5503b', '#6a9ad0'][j % 3]); R(px + 8, py + 1, 3, 2, '#5d8a4a'); R(px + 4, py - 4, 1, 1, '#c8b88a'); R(px + 10, py - 4, 1, 1, '#c8b88a'); } } } // children's paintings tied on
  if (s.type === 'hoarding') { const c = cells[2]; if (c) { const px = c.x * TS, py = c.y * TS; R(px, py - 7, 30, 18, '#c8c0a8'); R(px, py - 7, 30, 3, '#8a3a2a'); pixelText(ctx, 'ZION', px + 2, py - 2, '#5a544a'); pixelText(ctx, 'HOMES', px + 2, py + 4, '#7a7468'); R(px + 23, py - 2, 5, 11, '#a8a088'); R(px + 23, py + 5, 5, 4, '#8a9a6a'); } } // the faded developer's board
  if (s.type === 'shopbacks') {
    const fan = cells[5], door = cells[11];
    if (fan) { const px = fan.x * TS, py = fan.y * TS; R(px + 3, py - 6, 10, 10, '#6f787d'); R(px + 4, py - 5, 8, 8, '#3a3d40'); R(px + 7, py - 5, 2, 8, '#8c949a'); R(px + 4, py - 2, 8, 2, '#8c949a'); R(px + 3, py + 4, 10, 2, 'rgba(30,26,22,0.5)'); }
    if (door) { const px = door.x * TS, py = door.y * TS; R(px + 2, py - 6, 12, 22, '#9b4a36'); for (let r = 0; r < 11; r++) R(px + 2 + (r % 2) * 2, py - 5 + r * 2, 12 - (r % 2) * 2, 1, '#7d3a2a'); R(px + 1, py - 8, 14, 2, '#8a857a'); } // a back door bricked up in red
  }
  if (s.type === 'boards') for (const j of [4, 17]) { const c = cells[j]; if (c) { const px = c.x * TS, py = c.y * TS; R(px - 6, py - 16, 28, 8, '#55504a'); R(px - 6, py - 16, 28, 2, '#6f6a62'); R(px - 7, py - 9, 30, 1, '#3a3530'); } } // shed roofs behind
  if (s.type === 'allotment') for (const j of [3, 9, 14]) { const c = cells[j]; if (c) { const px = c.x * TS + 15, py = c.y * TS; for (const dx of [0, 4, 8]) { R(px + dx, py - 6, 1, 20, '#8f6a3e'); R(px + dx + 1, py - 2 + dx / 2, 2, 2, '#5d8a4a'); } R(px, py - 6, 9, 1, '#6b4a2e'); } } // bean poles
}

function hFeature(R, kind, px, py, s, c, rng, ctx) {
  const fy = py + 3; // on the face, below any cap
  if (kind === 'shh') pixelText(ctx, 'SHH', px + 2, fy + 1, CHALK);
  else if (kind === 'tally') { for (let i = 0; i < 4; i++) R(px + 3 + i * 2, fy, 1, 6, CHALK); R(px + 2, fy + 3, 9, 1, CHALK); }
  else if (kind === 'flyer') { R(px + 4, fy - 1, 8, 10, '#e8e4d8'); R(px + 5, fy, 6, 4, '#8a857a'); R(px + 6, fy + 1, 4, 2, '#c8a888'); R(px + 5, fy + 6, 6, 1, '#2b1d16'); R(px + 5, fy + 8, 4, 1, '#5a544a'); R(px + 11, fy + 7, 1, 2, '#c8c4b8'); } // MISSING, a photo
  else if (kind === 'patch') { // tonight: a fresh breach nailed over with new boards, a smear
    R(px + 1, fy - 1, 14, 11, '#2b1d16');
    for (let j = 0; j < 3; j++) { R(px, fy + j * 4 - 1, TS, 3, '#d8b07a'); R(px, fy + j * 4 - 1, TS, 1, '#e8c890'); R(px + 2, fy + j * 4, 1, 1, '#5a544a'); R(px + 13, fy + j * 4, 1, 1, '#5a544a'); }
    R(px + 9, fy + 2, 2, 4, RAMP.blood.fresh); R(px + 10, fy + 6, 1, 2, RAMP.blood.old);
  } else if (kind === 'ivy') { for (let k = 0; k < 9; k++) { const x = px + rng.int(0, 14), y = py - 6 + rng.int(0, 18); R(x, y, 2, 2, k % 3 ? '#2f6f2c' : '#46963a'); } R(px + 6, py - 6, 1, 20, '#3a5a2a'); }
  else if (kind === 'bin') { R(px + 3, py + 6, 10, 12, '#2f5a3a'); R(px + 2, py + 5, 12, 2, '#3e7048'); R(px + 3, py + 8, 1, 9, '#46804e'); R(px + 4, py + 18, 2, 2, '#1d1d20'); R(px + 10, py + 18, 2, 2, '#1d1d20'); }
  else if (kind === 'bike') { // chained to it, the front wheel gone soft
    for (const wx of [px, px + 10]) { R(wx + 1, py + 9, 4, 1, '#2b1d16'); R(wx + 1, py + 14, 4, 1, '#2b1d16'); R(wx, py + 10, 1, 4, '#2b1d16'); R(wx + 5, py + 10, 1, 4, '#2b1d16'); R(wx + 2, py + 11, 2, 2, '#8a857a'); }
    R(px + 3, py + 8, 9, 1, '#b5503b'); R(px + 6, py + 8, 1, 4, '#b5503b'); R(px + 3, py + 8, 1, 4, '#b5503b'); R(px + 11, py + 6, 1, 3, '#c0c4c8'); R(px + 10, py + 5, 3, 1, '#2b1d16'); R(px + 5, py + 6, 3, 1, '#2b1d16'); R(px + 7, py + 9, 6, 1, '#c8c4b8');
  }
  else if (kind === 'shrub') { R(px - 2, py + 4, 18, 14, '#2f6f2c'); R(px, py + 2, 12, 6, '#46963a'); R(px + 2, py + 3, 4, 2, '#6cbf4a'); R(px - 2, py + 16, 18, 2, '#1f4a1e'); }
  void s; void c;
}
function vFeature(R, kind, px, py, s, c, rng, ctx) {
  const ex = px + 13; // things lean on the east side
  if (kind === 'shh') { R(px + 3, py + 3, 10, 7, 'rgba(20,16,12,0.25)'); pixelText(ctx, 'SHH', px + 3, py + 4, CHALK); }
  else if (kind === 'tally') { for (let i = 0; i < 4; i++) R(px + 5, py + 2 + i * 3, 6, 1, CHALK); R(px + 7, py + 1, 1, 12, CHALK); }
  else if (kind === 'patch') { for (let j = 0; j < 4; j++) { R(px + 2, py + j * 4, 12, 3, '#d8b07a'); R(px + 2, py + j * 4, 12, 1, '#e8c890'); } R(px + 6, py + 5, 2, 3, RAMP.blood.fresh); }
  else if (kind === 'ivy') { for (let k = 0; k < 8; k++) R(px + 3 + rng.int(0, 9), py + rng.int(0, 14), 2, 2, k % 3 ? '#2f6f2c' : '#46963a'); }
  else if (kind === 'bin') { R(ex, py + 2, 9, 11, '#2f5a3a'); R(ex, py + 1, 9, 2, '#3e7048'); R(ex + 1, py + 3, 1, 9, '#46804e'); }
  else if (kind === 'bike') { R(ex + 1, py, 2, 14, '#2b1d16'); R(ex, py + 4, 4, 1, '#b5503b'); R(ex + 1, py + 7, 2, 1, '#c0c4c8'); R(ex - 1, py + 1, 4, 1, '#2b1d16'); }
  else if (kind === 'shrub') { R(ex - 4, py - 2, 12, 18, '#2f6f2c'); R(ex - 3, py, 6, 6, '#46963a'); R(ex - 2, py + 1, 2, 2, '#6cbf4a'); }
  void s; void c;
}
