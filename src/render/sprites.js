// Procedural pixel sprites (PRD §23.3, §23.8). 16x24 characters, 1px warm near-black outline (#2b1d16),
// light from the upper left. Five directions are drawn (S, SE, E, NE, N) and mirrored for the rest.
// Everything is cached by key, so final PNG art can later replace a key one-for-one.
import { OUTFITS } from '../data.js';
import { INK, RAMP, SKINS_DEAD, shade } from './palette.js';
import { ICONS } from './icons.js';
import { ICONS_HD, hdKit } from './icons_hd.js';
import { DETAIL } from './detail_hd.js';
import { drawHuman, drawBloater, drawBig, drawCrawler, drawDog, drawBiscuit, drawCorpse } from './people.js';
export { shade };

export const OUTLINE = INK.outline;
const cache = new Map();

export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

// Shading pass: light rim where the pixel above is empty, shadow where the pixel below/right is empty
// (light from the upper left), so flat rectangles read as rounded forms.
function shaded(src) {
  const w = src.width, h = src.height, x = src.getContext('2d');
  const img = x.getImageData(0, 0, w, h), d = img.data, a = (i, j) => (i < 0 || j < 0 || i >= w || j >= h ? 0 : d[(j * w + i) * 4 + 3]);
  const src2 = new Uint8ClampedArray(d);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = (j * w + i) * 4; if (!src2[k + 3]) continue;
    let f = 0;
    if (!a(i, j - 1) || !a(i - 1, j)) f = 0.16;
    else if (!a(i, j + 1) || !a(i + 1, j)) f = -0.18;
    if (!f) continue;
    for (let c = 0; c < 3; c++) d[k + c] = f > 0 ? src2[k + c] + (255 - src2[k + c]) * f : src2[k + c] * (1 + f);
  }
  x.putImageData(img, 0, 0);
  return src;
}
// Selective outline: each outline pixel is a very dark version of the colour it borders, not one flat brown,
// with the bottom edge kept darkest so sprites sit on the ground.
function outlined(src, color = OUTLINE) {
  const w = src.width + 2, h = src.height + 2;
  if (color === OUTLINE && typeof src.getContext === 'function') {
    const out = makeCanvas(w, h), o = out.getContext('2d');
    o.drawImage(src, 1, 1);
    const img = o.getImageData(0, 0, w, h), d = img.data, base = new Uint8ClampedArray(d);
    const ol = [0x2b, 0x1d, 0x16];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const k = (j * w + i) * 4; if (base[k + 3]) continue;
      let n = -1, below = false;
      for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) { const ii = i + dx, jj = j + dy; if (ii < 0 || jj < 0 || ii >= w || jj >= h) continue; const kk = (jj * w + ii) * 4; if (base[kk + 3]) { n = kk; if (dy === -1) below = true; } }
      if (n < 0) continue;
      const mix = below ? 0.12 : 0.28;
      for (let c = 0; c < 3; c++) d[k + c] = ol[c] * (1 - mix) + base[n + c] * mix * 0.6;
      d[k + 3] = 255;
    }
    o.putImageData(img, 0, 0);
    return out;
  }
  const sil = makeCanvas(w, h); const s = sil.getContext('2d');
  s.drawImage(src, 1, 1); s.globalCompositeOperation = 'source-in'; s.fillStyle = color; s.fillRect(0, 0, w, h);
  const out = makeCanvas(w, h); const o = out.getContext('2d');
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) o.drawImage(sil, dx, dy);
  o.drawImage(src, 1, 1);
  return out;
}
function tinted(src, color) {
  const c = makeCanvas(src.width, src.height); const x = c.getContext('2d');
  x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height); x.globalCompositeOperation = 'source-over';
  if (src._hd) c._hd = tinted(src._hd, color);
  return c;
}
// HD world sprites: a canvas may carry _hd, a 2x copy the world view draws at the same logical size.
export const hdOf = (spr) => spr._hd || spr;
// Renders a lo-res drawer twice: at 1x, and on a 2x-scaled context followed by an optional half-pixel detail pass.
// The 2x copy gets a 2 HD px outline, so its silhouette matches the 1x sprite exactly.
function withHD(w, h, draw, detail) {
  const raw = makeCanvas(w, h), eyes = draw(raw.getContext('2d'));
  const r2 = makeCanvas(w * 2, h * 2), x2 = r2.getContext('2d');
  x2.scale(2, 2); draw(x2); x2.setTransform(1, 0, 0, 1, 0, 0);
  if (detail) detail(hdPen(x2), eyes);
  return { raw, eyes, r2 };
}
// Pen for detail passes, in HD pixels.
function hdPen(ctx) {
  const P = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); };
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const at = (x, y) => { const d = ctx.getImageData(x, y, 1, 1).data; return d[3] ? `#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}` : null; };
  return { P, R, at, ctx };
}
const finishHD = (c, r2) => { c._hd = outlined(outlined(r2)); return c; };

// ---- tiny 3x5 pixel font for signs, chalk prices and labels baked into the map ----
const GLYPHS = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001110',
  '&': '010101010101011', "'": '010010000000000', '.': '000000000000010', '-': '000000111000000', '!': '010010010000010', ',': '000000000010100', '/': '001001010100100',
};
export function pixelText(ctx, text, x, y, color, scale = 1) {
  ctx.fillStyle = color;
  let cx = Math.round(x);
  for (const ch of text.toUpperCase()) {
    const g = GLYPHS[ch];
    if (g) for (let i = 0; i < 15; i++) if (g[i] === '1') ctx.fillRect(cx + (i % 3) * scale, Math.round(y) + Math.floor(i / 3) * scale, scale, scale);
    cx += 4 * scale;
  }
}
export const pixelTextWidth = (text, scale = 1) => text.length * 4 * scale - scale;

// ---------------- characters ----------------
const CAIN = { skin: '#d9a47a', skinD: '#b5845e', hair: '#8c8f86', shirt: '#a8915a', shirtD: '#8a7548', trim: '#4d7fb8', pants: '#4a4a3a', boots: '#5a3e2a', beard: '#b8b8ae', band: '#b5503b', eye: '#2b1d16' };
const SKINS = SKINS_DEAD;
// VA-10: the living wear colour the dead have lost
const LIVING_SHIRTS = ['#b5503b', '#4d7fb8', '#5d8a4a', '#d9a03a', '#7a5a8a', '#c8bf9a', '#3a7a7a', '#a8603a'];

export function palFor(kind, outfit = 0) {
  if (kind === 'cain') return CAIN;
  const o = OUTFITS[outfit % OUTFITS.length];
  const dull = (c) => c; // outfits are pre-dulled in data
  const base = { skin: SKINS[outfit % SKINS.length], skinD: '#5b8a3a', hair: '#3a3530', shirt: dull(o.shirt), shirtD: shade(o.shirt, -0.25), trim: o.trim, pants: o.pants, boots: o.boots || '#2f2a26', eye: '#e03a2a' };
  if (kind === 'runner') { base.skin = '#c4906e'; base.skinD = '#a8705a'; }
  if (kind === 'looter') Object.assign(base, { skin: '#d9a47a', skinD: '#b5845e', shirt: '#3a4a3a', shirtD: '#2a382a', trim: '#5a3e2a', pants: '#33363d', eye: '#2b1d16' });
  if (kind === 'brute') Object.assign(base, { shirt: '#2a3040', shirtD: '#1c2230', trim: '#4a5560', pants: '#23283a', boots: '#15171d' });
  if (kind === 'armoured') Object.assign(base, { shirt: '#3a3530', shirtD: '#2a2622', trim: '#d9c23a' });
  if (kind === 'screamer') Object.assign(base, { skin: '#9ab070', shirt: '#4a4a52', shirtD: '#33333a' });
  if (kind === 'hazmat') Object.assign(base, { shirt: '#d9c23a', shirtD: '#a8961e', trim: '#3a3a3e', pants: '#c8b030', boots: '#2f2f33' });
  if (kind === 'tangled') Object.assign(base, { trim: '#c0c4c8' });
  if (kind === 'butcher') Object.assign(base, { shirt: '#e8e0d0', shirtD: '#b8a898', trim: '#8a2a22', pants: '#3a3a3e', boots: '#1d1d22' });
  if (kind === 'survivor') Object.assign(base, { shirt: LIVING_SHIRTS[outfit % 8], shirtD: shade(LIVING_SHIRTS[outfit % 8], -0.25), pants: ['#3e5a80', '#4a4a3a', '#33363d', '#5a4632', '#2f3a4a'][outfit % 5] }, { skin: ['#d9a47a', '#b07a52', '#e8c09a', '#8a5a3a'][outfit % 4], skinD: '#a8745a', hair: ['#3a2a1e', '#8c8f86', '#c49a62', '#1d1410'][outfit % 4], eye: '#2b1d16' });
  if (kind === 'raider') Object.assign(base, { skin: ['#d9a47a', '#b07a52', '#e8c09a'][outfit % 3], skinD: '#a8745a', shirt: ['#5a3e2a', '#4a3a30', '#3e5a80'][outfit % 3], shirtD: '#221a14', trim: '#b5503b', pants: ['#3e5a80', '#33363d', '#4a3a2a'][outfit % 3], hair: '#2b1d16', eye: '#2b1d16' });
  if (kind === 'cain1') Object.assign(base, CAIN, { trim: '#e8dfc6' });
  if (kind === 'cain2') Object.assign(base, CAIN, { shirt: '#5a3e2a', shirtD: '#3a2a1e', trim: '#2b1d16' });
  if (kind === 'cain3') Object.assign(base, CAIN, { shirt: '#4a5260', shirtD: '#353b46', trim: '#2b1d16' });
  return base;
}

// view: 0=S 1=SE 2=E 3=NE 4=N
const VIEW_OF_DIR = [2, 1, 0, 1, 2, 3, 4, 3]; // dir index (E=0..NE=7) -> view
const FLIP_OF_DIR = [false, false, false, true, true, true, false, false];
export function viewForDir(d) { return { view: VIEW_OF_DIR[d], flip: FLIP_OF_DIR[d] }; }

// ---- Cain (ART-PRD D1): hand-placed pixel maps per view, 3-step ramps, no auto shading pass ----
const CP = (() => {
  const r = RAMP;
  return {
    H: r.hair.cain[0], h: r.hair.cain[1], k: r.hair.cain[2],
    S: r.skin.cain[0], s: r.skin.cain[1], d: r.skin.cain[2],
    B: r.beard.cain[0], b: r.beard.cain[1], m: r.beard.cain[2],
    e: INK.outline, T: r.strap[1], L: r.lens[1], l: r.lens[2],
    R: r.bandana[1], q: r.bandana[0], Q: r.bandana[2],
    J: r.jacket.canvas[0], j: r.jacket.canvas[1], n: r.jacket.canvas[2],
    W: r.shirt.work[1], w: r.shirt.work[2],
    X: r.radio[1], x: r.led.amber, Z: r.belt[1], G: r.brass[1], P: r.pouch[1], p: r.pouch[2],
    U: r.trousers.canvas[1], u: r.trousers.canvas[2], V: r.trousers.canvas[0],
    O: r.boot.leather[1], o: r.boot.leather[2], F: r.felt[0], f: r.felt[1],
    g: r.gunmetal[1], c: r.gunmetal[0],
  };
})();
// Costume variants recolour the jacket ramp; bandana, beard, boots and torch stay on all of them.
const CAIN_COSTUME = { 1: RAMP.jacket.canvas, 2: RAMP.jacket.leather, 3: RAMP.jacket.slate };
function blit(ctx, ox, oy, rows, pal) {
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) {
    const ch = rows[j][i]; if (ch === '.' || ch === ' ') continue;
    const col = pal[ch]; if (!col) continue;
    ctx.fillStyle = col; ctx.fillRect(ox + i, oy + j, 1, 1);
  }
}
// Heads are 6 wide, rows 3..10 (8 rows incl. hair top). Origin x given per view.
const CAIN_HEAD = [
  ['.hHhh.', 'kHhhhk', 'TTLLTT', 'SSlLSs', 'seSsed', 'sbmmbd', 'bBBBbm', '.bbbb.'], // S
  ['.hHhh.', 'kHhhhk', 'kTTLLT', 'hSSlLS', 'hsSeSe', 'hsbmmb', '.bBBbm', '..bbb.'], // SE
  ['.hHhh.', 'hHhhhk', 'kTTTLL', 'khSSlL', 'khsSeS', 'khssbm', '.hbBBb', '..bbb.'], // E
  ['.hHhh.', 'kHhHhh', 'kTTTTT', 'khHhhS', 'khhhhs', 'kkhhbd', '.kkhb.', '..sd..'], // NE
  ['.hHhh.', 'kHhHhk', 'TTTTTT', 'khHhhk', 'shhhhs', 'kkhhkk', '.bkkb.', '..sd..'], // N
];
// Torsos rows 11..17. Front: radio on his left chest, pouch on his right hip; back: seam, pouch flips.
const CAIN_TORSO = [
  { x: 4, rows: ['JjWWWWjn', 'JnnjjxXn', 'JjjjjXXn', 'JjJjjXXn', 'Jjjjjjjn', 'ZZZGZZZZ', 'UPPUUUUu'] },
  { x: 4, rows: ['JjjWWWjn', 'JJnnjjxX', 'JJjjjjXX', 'JJjJjjXX', 'JJjjjjjn', 'ZZZZGZZZ', 'UUPPUUUu'] },
  { x: 5, rows: ['jJjjWW', 'jJjjxX', 'jJjjXX', 'jjjjjn', 'jjjjjn', 'ZPZZGZ', 'UPPUUu'] },
  { x: 4, rows: ['JJJjjjjn', 'Jjjjjjjn', 'Jjjnjjjn', 'Jjjnjjjn', 'Jjjjjjjn', 'ZZZZZZZZ', 'UUUUUPPu'] },
  { x: 4, rows: ['jJJjjJJn', 'Jjjjjjjn', 'Jjjnjjjn', 'Jjjnjjjn', 'Jjjnjjjn', 'ZZZZZZZZ', 'UUUUPPUu'] },
];
function cainPal(pad) {
  const pal = { ...CP };
  if (pad >= 2) { const c = CAIN_COSTUME[pad]; pal.J = c[0]; pal.j = c[1]; pal.n = c[2]; }
  if (pad >= 3) { pal.W = '#6a7280'; pal.w = '#4a5260'; } // plate collar
  return pal;
}
function drawCain(ctx, pad, view, frame, pose) {
  const pal = cainPal(pad);
  const R = (x, y, w, h, c) => { ctx.fillStyle = pal[c] || c; ctx.fillRect(x, y, w, h); };
  const side = view === 2, back = view >= 3, front = view <= 1;
  const step = frame % 2 === 1 ? (frame === 1 ? 1 : -1) : 0;
  const hy = 3 + (pose === 'stagger' ? -1 : 0) + (pose === 'walk' && step === 0 && frame === 2 ? 0 : 0);
  // legs: trousers with a lighter knee patch, leather boot, grey felt bound over the toes
  const leg = (x, lift, near, toeDir) => {
    R(x, 18, 2, 4 - lift, near ? 'U' : 'u'); R(x + (near ? 0 : 1), 19, 1, 1, 'V');
    R(x, 22 - lift, 2, 1, 'O'); R(x, 23 - lift, 2, 1, 'f'); R(x + (toeDir > 0 ? 1 : 0), 23 - lift, 1, 1, 'F');
    if (toeDir) R(toeDir > 0 ? x + 2 : x - 1, 23 - lift, 1, 1, 'f');
  };
  // 'stride' (walking the way he faces): the swinging leg's knee comes up 2 px
  const stride = pose === 'stride', kneeUp = (x, near) => { R(x, 17, 2, 1, near ? 'U' : 'u'); R(x + (near ? 0 : 1), 17, 1, 1, 'V'); };
  if (side || view === 1 || view === 3) {
    const s2 = stride ? step * 2 : step, a = 6 - s2, b = 8 + s2, dir = view === 3 ? 0 : 1;
    leg(b, stride && step > 0 ? 2 : 0, false, dir); leg(a, stride && step < 0 ? 2 : 0, true, dir);
    if (stride && step) kneeUp(step > 0 ? b : a, step < 0);
  } else if (stride) {
    leg(5, step > 0 ? 2 : 0, true, 0); leg(9, step < 0 ? 2 : 0, false, 0);
    if (step) kneeUp(step > 0 ? 5 : 9, step > 0);
  } else { leg(5, step > 0 ? 1 : 0, true, 0); leg(9, step < 0 ? 1 : 0, false, 0); }
  // charging a power attack: a crouch, everything above the knees drops a pixel
  const crouch = pose === 'charge' ? 1 : 0;
  ctx.save(); ctx.translate(0, crouch);
  // torso
  const t = CAIN_TORSO[view]; blit(ctx, t.x, 11, t.rows, pal);
  if (pad >= 3) { R(t.x + 1, 12, t.rows[0].length - 2, 3, '#4a5260'); R(t.x + 1, 12, t.rows[0].length - 2, 1, '#6a7280'); if (front) R(t.x + t.rows[0].length - 3, 12, 2, 3, 'X'), R(t.x + t.rows[0].length - 3, 12, 1, 1, 'x'); }
  // arms: jacket sleeve pushed up (2 rows of sleeve over forearm skin), bandana on his left upper arm
  const sleeve = pad === 1 ? ['#d8d0b0', '#c8bf9a'] : [pal.J, pal.n];
  const arm = (x, y, len, band, lightSide) => {
    R(x, y, 2, 3, sleeve[1]); R(lightSide ? x : x + 1, y, 1, 3, sleeve[0]);
    if (band) { R(x, y + 1, 2, 1, 'R'); R(x, y + 1, 1, 1, 'q'); R(x + (lightSide ? 1 : 0), y + 2, 1, 1, 'Q'); }
    R(x, y + 3, 2, len - 3, 's'); R(lightSide ? x : x + 1, y + 3, 1, len - 3, 'S'); R(x, y + len, 2, 1, 'd');
  };
  if (pose === 'carry') { // arms forward, the item rides over the torso
    if (side) { R(5, 12, 1, 2, 'R'); R(8, 13, 5, 2, sleeve[1]); R(8, 13, 5, 1, sleeve[0]); R(12, 13, 2, 2, 's'); }
    else { const w = t.rows[0].length; arm(t.x - 1, 12, 3, back, true); arm(t.x + w - 1, 12, 3, front, false); R(t.x, 15, w, 1, 's'); R(t.x, 15, 2, 1, 'S'); }
  } else if (pose === 'charge') { // the weapon arm pulled back over the shoulder
    if (side) { R(5, 12, 1, 2, 'R'); arm(4, 7, 4, false, true); }
    else { arm(t.x - 1, 7, 4, back, true); arm(t.x + t.rows[0].length - 1, 12, 5, front, false); }
  } else if (pose === 'attack') {
    if (side) { arm(10, 7, 4, false, true); R(5, 12, 1, 2, 'Q'); }
    else { arm(t.x - 1, 6, 5, back, true); arm(t.x + 7, 6, 5, front, false); }
  } else if (side) {
    // far arm shows only the bandana knot at the back of the shoulder; near arm swings
    R(5, 12, 1, 2, 'R'); R(5, 13, 1, 1, 'Q');
    arm(7 + step, 12, 5, false, true);
  } else {
    const L = t.x - 1, Rx = t.x + t.rows[0].length - 1;
    arm(L, 12 + (step > 0 ? 1 : 0), 5, back, true);
    arm(Rx, 12 + (step < 0 ? 1 : 0), 5, front, false);
  }
  // head
  const hx = side ? 6 : 5;
  blit(ctx, hx, hy, CAIN_HEAD[view], pal);
  ctx.restore();
  const eyes = view === 0 ? [[hx + 1, hy + 4 + crouch], [hx + 4, hy + 4 + crouch]] : view === 1 ? [[hx + 3, hy + 4 + crouch], [hx + 5, hy + 4 + crouch]] : view === 2 ? [[hx + 4, hy + 4 + crouch]] : [];
  return eyes;
}
// Downed crawl, 16x12 facing east: pistol held forward, felt boots trailing, bandana on the reaching arm.
const CAIN_CRAWL = [
  ['..........hhhh..', '.........kHHhhk.', '.........TTTTLL.', '...JJjjjjkhsSlL.', '..UJjjjjjkhsSeS.', 'OUUjjjjjnnhbmmb.', 'FUUnjjjnRRqsbbcg', 'fuuuZZZZQRsSs.gg', '..........ss....'],
  ['..........hhhh..', '.........kHHhhk.', '.........TTTTLL.', '...JJjjjjkhsSlL.', '.OUJjjjjjkhsSeS.', 'FUUjjjjjnnhbmmb.', 'fUUnjjjnRRqss...', '.uuuZZZZQRsSscg.', '............gg..'],
];
function drawCainDown(ctx, frame) {
  blit(ctx, 0, 2, CAIN_CRAWL[frame % 2], CP);
  if (frame % 4 === 3) { ctx.fillStyle = CP.d; ctx.fillRect(9, 10, 1, 1); } // knee scrape on the drag frame
  return [[13, 6]];
}

// variant: 'n' normal, 'w' hurt flash (#f2ead6), 's' night silhouette (dark + glowing eyes),
// 'l' Cain at low health (sweat and a blood smear on the cheek).
// kind may carry suffixes: 'survivor:<role>:<flags s=sick h=hurt>', 'raider:captain'.
export function charSprite(kind, outfit, view, frame, pose, variant = 'n') {
  const key = `${kind}|${outfit}|${view}|${frame}|${pose}|${variant}`;
  let c = cache.get(key);
  if (c) return c;
  if (variant !== 'n') {
    const base = charSprite(kind, outfit, view, frame, pose, 'n');
    if (variant === 'w') c = tinted(base, INK.lightest);
    else if (variant === 'l') {
      c = makeCanvas(base.width, base.height); const x = c.getContext('2d'); x.drawImage(base, 0, 0);
      const e = (base.eyes || [])[0];
      if (e) { x.fillStyle = RAMP.blood.fresh; x.fillRect(e[0] + 1, e[1] + 3, 1, 2); x.fillStyle = RAMP.blood.old; x.fillRect(e[0] + 1, e[1] + 5, 1, 1); x.fillStyle = '#e8e0d0'; x.fillRect(e[0] + 2, e[1], 1, 1); }
      if (e && base._hd) { // the same marks at 2x: a thinner trickle, a single bead of sweat
        const h = makeCanvas(base._hd.width, base._hd.height), y = h.getContext('2d'); y.drawImage(base._hd, 0, 0);
        const ex = (e[0] + 1) * 2, ey = (e[1] + 1) * 2;
        y.fillStyle = RAMP.blood.fresh; y.fillRect(ex + 1, ey + 4, 1, 4); y.fillStyle = RAMP.blood.old; y.fillRect(ex + 1, ey + 8, 1, 2); y.fillStyle = '#e8e0d0'; y.fillRect(ex + 3, ey - 1, 1, 2);
        c._hd = h;
      }
    } else {
      c = tinted(base, '#14121c');
      const x = c.getContext('2d'); x.globalCompositeOperation = 'source-over'; x.fillStyle = kind.startsWith('cain') || kind === 'looter' || kind.startsWith('survivor') || kind.startsWith('raider') ? '#c8cfd0' : '#ff4a32';
      for (const [ex, ey] of base.eyes || []) x.fillRect(ex + 1, ey + 1, 1, 1);
      if (c._hd) { const y = c._hd.getContext('2d'); y.fillStyle = x.fillStyle; for (const [ex, ey] of base.eyes || []) y.fillRect((ex + 1) * 2, (ey + 1) * 2, 2, 2); }
    }
    c.eyes = base.eyes;
    cache.set(key, c); return c;
  }
  const [base, role, flags = ''] = kind.split(':');
  const pal = palFor(base, outfit);
  const make = (w, h, draw, detail) => { const r = withHD(w, h, draw, detail); c = finishHD(outlined(r.raw), r.r2); c.eyes = r.eyes; cache.set(key, c); return c; };
  if (base === 'crawler') return make(16, 12, (x) => drawCrawler(x, pal, frame, outfit), DETAIL.crawler && ((p, e) => DETAIL.crawler(p, e, { pal, frame, outfit })));
  if (base === 'dog') { const L = outfit === 99; return make(L ? 20 : 18, L ? 13 : 12, (x) => drawDog(x, frame, pose, L), DETAIL.dog && ((p, e) => DETAIL.dog(p, e, { frame, pose, leader: L }))); }
  if (base === 'biscuit') return make(14, 10, (x) => drawBiscuit(x, frame, pose), DETAIL.biscuit && ((p, e) => DETAIL.biscuit(p, e, { frame, pose })));
  if (pose === 'down' && base.startsWith('cain')) return make(16, 12, (x) => drawCainDown(x, frame), DETAIL.cainDown && ((p, e) => DETAIL.cainDown(p, e, { frame })));
  if (/^cain\d?$/.test(base)) { const pad = base.length === 5 ? +base[4] : 0; return make(16, 24, (x) => drawCain(x, pad, view, frame, pose), (p, e) => DETAIL.cain(p, e, { pad, view, frame, pose, pal: cainPal(pad), tx: CAIN_TORSO[view].x, tw: CAIN_TORSO[view].rows[0].length })); }
  if (base === 'brute' || base === 'butcher') return make(22, 28, (x) => drawBig(x, base, view, frame, pose), DETAIL.big && ((p, e) => DETAIL.big(p, e, { kind: base, view, frame, pose })));
  if (base === 'bloater') return make(18, 24, (x) => drawBloater(x, pal, view, frame, pose, outfit, role && role[0] === 'g' ? +role[1] : 1), DETAIL.bloater && ((p, e) => DETAIL.bloater(p, e, { pal, view, frame, pose })));
  const opts = base === 'survivor' ? { role, sick: flags.includes('s'), hurt: flags.includes('h') } : base === 'raider' ? { captain: role === 'captain' } : role && role[0] === 'g' ? { gait: +role[1], look: flags[0] === 'l' ? +flags[1] : 0 } : {};
  return make(16, 24, (x) => drawHuman(x, base, pal, view, frame, pose, outfit, opts), DETAIL.human && ((p, e) => DETAIL.human(p, e, { kind: base, pal, view, frame, pose, outfit, opts })));
}

// Corpse sprites (D2): 16x10 (dog 18x8). mode 'n' | 'char' | 'gas' | 'gore'.
export function corpseSprite(kind, outfit, mode = 'n', pose = 0) {
  const key = `corpse|${kind}|${outfit}|${mode}|${pose}`;
  let c = cache.get(key); if (c) return c;
  const base = kind === 'crawler' || kind === 'bloater' ? 'walker' : kind;
  const r = withHD(kind === 'dog' ? 18 : 16, kind === 'dog' ? 8 : 10, (x) => drawCorpse(x, kind, palFor(base, outfit), mode, pose), DETAIL.corpse && ((p) => DETAIL.corpse(p, null, { kind, mode, pose })));
  c = finishHD(outlined(r.raw), r.r2); cache.set(key, c); return c;
}

// ---------------- icons (12x12) ----------------
export function icon(key) {
  if (key && key.startsWith('t:')) key = key.slice(2);
  const ck = 'icon|' + key;
  let c = cache.get(ck);
  if (c) return c;
  const raw = makeCanvas(12, 12); const r = raw.getContext('2d');
  const f = ICONS[key] || ICONS.diamond;
  f((x, y, w, h, col) => { r.fillStyle = col; r.fillRect(x, y, w, h); });
  c = outlined(shaded(raw));
  cache.set(ck, c);
  return c;
}
export function iconWhite(key) {
  const ck = 'iconw|' + key; let c = cache.get(ck); if (c) return c;
  const raw = makeCanvas(12, 12); const r = raw.getContext('2d');
  (ICONS[key?.replace('t:', '')] || ICONS.diamond)((x, y, w, h) => { r.fillStyle = '#e8e4d8'; r.fillRect(x, y, w, h); });
  cache.set(ck, raw); return raw;
}
// 28x28 double-resolution icon for surfaces drawn at screen scale (HUD, Zionpedia): same footprint as icon() at 2x.
export function iconHD(key) {
  if (key && key.startsWith('t:')) key = key.slice(2);
  const ck = 'iconhd|' + key; let c = cache.get(ck); if (c) return c;
  c = makeCanvas(28, 28); const o = c.getContext('2d'); o.imageSmoothingEnabled = false;
  const f = ICONS_HD[key];
  if (f) { const raw = makeCanvas(24, 24); f(hdKit(raw.getContext('2d'))); o.drawImage(outlined(shaded(raw)), 1, 1); }
  else o.drawImage(icon(key), 0, 0, 28, 28);
  cache.set(ck, c); return c;
}
export const hasIcon = (k) => !!ICONS[k];

