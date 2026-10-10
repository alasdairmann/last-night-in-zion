// Half-pixel detail passes for world sprites. sprites.js draws each character with its lo-res drawer on a
// 2x canvas, then calls DETAIL[kind](pen, eyes, info) to repaint parts with finer maps: faces, hair and
// beard, clothing seams. Coordinates are HD pixels (lo-res x 2).
// pen: P(x, y, c) pixel, R(x, y, w, h, c) rect, ctx the 2x context.
const EXTRA = { o: '#e8e0d0', '*': '#fff4c8', M: '#4a2a22' }; // eye whites, torch glow, mouth

// Paints a character map over the sprite, but only where the pixel underneath is one of `under` (the colours
// the map is redrawing), so arms, hands and carried items drawn in front are left alone.
function paint(pen, ox, oy, rows, pal, under) {
  const w = rows[0].length, h = rows.length, img = pen.ctx.getImageData(ox, oy, w, h), d = img.data;
  const hex = (i) => '#' + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ch = rows[j][i], col = EXTRA[ch] || pal[ch]; if (!col) continue;
    const k = (j * w + i) * 4; if (!d[k + 3] || !under.has(hex(k))) continue;
    pen.P(ox + i, oy + j, col);
  }
}
const set = (pal, letters) => new Set([...letters].map((c) => (pal[c] || '').toLowerCase()).filter(Boolean));

// ---- Cain: 12x16 heads and 16x14 (12x14 side) torsos per view: S, SE, E, NE, N ----
const CAIN_HEAD_HD = [
  ['...hHHHhh...', '..hHHhHhhh..', '.khHhhhHhhk.', '.khhhhhhhhk.', 'khhhh**hhhhk', 'TTTTl**lTTTT', 'kSSSSllSSssk', 'sSSSSSSSSssd',
    'sSkkSSSSkksd', 'sSoeSSdSoesd', 'sSSSSddSSssd', 'sbBBbmmbBBbd', 'bBbbMMMMbbBm', 'bBBbBbbBbBbm', '.bBbBbBbbbm.', '..bbbmbbbm..'],
  ['...hHHHhh...', '..hHHhHhhh..', '.khHhhhHhhk.', '.khhhhhhhhhk', 'khhhhhh**hhh', 'khTTTTl**lTT', 'khhSSSSllSSS', 'khsSSSSSSSSs',
    'khsSSkkSSSkk', 'khsSSoeSSSoe', 'khssSSSSSdSs', 'khsbBBbbmmBb', '.hbBbbbMMMBm', '.kbBbBbbBbbm', '..bbBbBbbbm.', '...bbmbbbm..'],
  ['...hHHHhh...', '..hHHhHhhhk.', '.hHhhhHhhhhk', '.kHhhhhhhhhk', 'kkhhhhhhh**h', 'khTTTTTTl**l', 'kkhhSSSSSSSS', 'kkhhsSSSSSSS',
    'kkhhsSSSkkSS', 'kkhhssSSoeSS', 'kkhhsssSSSdS', 'kkhhssbBBbmm', '.khhbbBBbMMb', '.khbBbBbBbbm', '..hbbBbBbbm.', '...bbbmbbm..'],
  ['...hHHHhh...', '..hHHhHhhh..', '.kHhHHhHhhh.', '.khHhhHhhhhh', 'kkhhHhhhHhhh', 'kkTTTTTTTTTT', 'kkhHHhHhhhSS', 'kkhhHhhhhhSs',
    'kkhhhHhhhhSs', 'kkhhhhhhhhss', 'kkkhhhhhhbbd', 'kkkkhhhhbbbd', '.kkkkhhhhbb.', '..kkkkhhb...', '....ssdd....', '....ssdd....'],
  ['...hHHHhh...', '..hHHhHhhh..', '.kHhHHhHhhk.', '.khHhhHhhhk.', 'khhHhhhHhhhk', 'TTTTTTTTTTTT', 'khHhHHhHhhhk', 'khhHhhHhhhhk',
    'khhhHhhHhhhk', 'shhhhhhhhhhs', 'sShhhhhhhhsd', 'kkhhhhhhhhkk', 'kkkhhhhhhkkk', '.bbkkhhkkbb.', '..bbkkkkbb..', '....ssdd....'],
];
const CAIN_TORSO_HD = [
  ['JJjjWWWWWWWWjjnn', 'JJjjjWwWWwWjjjnn', 'JJnnnnjjnjxXXXnn', 'JJjjGjjjnjXeeXnn', 'JJjjjjjjnjXXXXnn', 'JJjjjjjjnjXeeXnn', 'JJjjJjjjnjXXXXnn',
    'JJjjJjjjnjjjjjnn', 'JJjjjjjjnjjjjjnn', 'JJjjjjjjnjjjjjnn', 'ZZZZZZGGZZZZZZZZ', 'ZZZZZZGGZZZZZZZZ', 'UUPPPPUUUUUUUUuu', 'UUPpPpUUUUUUUUuu'],
  ['JJjjjjWWWWWWjjnn', 'JJjjjjjWwWWWjjnn', 'JJJJnnnnjjjjxXXX', 'JJJJjjGjjjjjXeeX', 'JJJJjjjjjjjjXXXX', 'JJJJjjjjjjjjXeeX', 'JJJJjjJjjjjjXXXX',
    'JJJJjjJjjjjjXXXX', 'JJJJjjjjjjjjjjnn', 'JJJJjjjjjjjjjjnn', 'ZZZZZZZZGGZZZZZZ', 'ZZZZZZZZGGZZZZZZ', 'UUUUPPPPUUUUUUuu', 'UUUUPpPpUUUUUUuu'],
  ['jjJJjjjjWWWW', 'jjJJjjjjWwWW', 'jjJJjjjjxXXX', 'jjJJjjjjXeeX', 'jjJJjjjjXXXX', 'jjJJjjjjXeeX', 'jjjjjjjjjjnn',
    'jjjjnjjjjjnn', 'jjjjnjjjjjnn', 'jjjjjjjjjjnn', 'ZZPPZZZZGGZZ', 'ZZPPZZZZGGZZ', 'UUPPPPUUUUuu', 'UUPpPpUUUUuu'],
  ['JJJJJJjjjjjjjjnn', 'JJJJjjjjjjjjjjnn', 'JJjjjjjnjjjjjjnn', 'JJjjjjjnjjjjjjnn', 'JJjjjjjnjjjjjjnn', 'JJjjjjjnjjjjjjnn', 'JJjjjjjnjjjjjjnn',
    'JJjjjjjnjjjjjjnn', 'JJjjjjjnjjjjjjnn', 'JJjjjjjjjjjjjjnn', 'ZZZZZZZZZZZZZZZZ', 'ZZZZZZZZZZZZZZZZ', 'UUUUUUUUUUPPPPuu', 'UUUUUUUUUUPpPpuu'],
  ['jjJJJJjjjjJJJJnn', 'JJjjjjjjjjjjjjnn', 'JJjjjjjnjjjjjjnn', 'JJjjjjjnjjjjjjnn', 'JJjjjjjnjjjjjjnn', 'JJjjjjjnjjjjjjnn', 'JJjjjjjnjjjjjjnn',
    'JJjjjjjnjjjjjjnn', 'JJjjjjjnjjjjjjnn', 'JJjjjjjjjjjjjjnn', 'ZZZZZZZZZZZZZZZZ', 'ZZZZZZZZZZZZZZZZ', 'UUUUUUUUPPPPUUuu', 'UUUUUUUUPpPpUUuu'],
];

const LIVE = new Set(['survivor', 'raider', 'looter']);
const MILK = '#c8ccb0', SOCKET = '#22261c', TEETH = '#d8cfa8', GAP = '#2a1612';
const darker = (c, k) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(c.slice(i, i + 2), 16) * (1 - k)).toString(16).padStart(2, '0')).join('');

// Faces for drawHuman: eyes come back from the drawer in lo-res pixels (front: 2 eyes, SE: 2, E: 1).
function humanFace(pen, eyes, { kind, view, opts }) {
  if (!eyes.length || ['hazmat', 'armoured', 'looter'].includes(kind) || view >= 3) return;
  const living = LIVE.has(kind), side = view === 2;
  const [ex0, ey] = eyes[0], hy = ey - 3, hx = view === 0 ? ex0 - 1 : view === 1 ? ex0 - 3 : ex0 - 5;
  const skin = pen.at(hx * 2 + 4, (hy + 4) * 2 + 1) || pen.at(hx * 2 + 2, (hy + 2) * 2);
  if (!skin) return;
  const dark = darker(skin, 0.28);
  for (const [lx, ly] of eyes) {
    const x = lx * 2, y = ly * 2, glasses = pen.at(x - 2, y - 2) === '#2b2a2e';
    if (glasses) { pen.P(x + (side ? 1 : 0), y + 1, '#e8e0d0'); continue; }
    if (living) { pen.R(x, y, 2, 1, dark); pen.P(x, y + 1, side ? skin : '#e8e0d0'); pen.P(x + 1, y + 1, '#1a1210'); }
    else { pen.R(x, y, 2, 2, SOCKET); pen.P(x + (view === 0 ? 0 : 1), y + 1, MILK); pen.P(x, y + 2, dark); pen.P(x + 1, y + 2, dark); }
  }
  const mx = side ? hx + 4 : view === 1 ? hx + 3 : hx + 2, my = (hy + 5) * 2;
  if (!living && pen.at(mx * 2, my) === GAP) { // a slack mouth with a few teeth
    pen.P(mx * 2, my, TEETH); pen.P(mx * 2 + 2, my, TEETH); if (!side) pen.P(mx * 2 + 3, my + 1, TEETH);
    pen.P(mx * 2 + 1, my - 1, dark); pen.P(mx * 2 + 2, my - 1, dark);
  } else if (living && kind !== 'raider') { pen.R(mx * 2, my, 4, 1, dark); pen.P(mx * 2 + 1, my + 1, darker(skin, 0.12)); }
  if (!side && !opts?.hurt) { pen.P(hx * 2 + 4, (hy + 4) * 2 + 1, skin); } // nose: one pixel instead of a block
  if (!living) { pen.P(hx * 2 + (side ? 6 : 1), (hy + 4) * 2, dark); pen.P(hx * 2 + 10, (hy + 4) * 2 + 1, dark); } // hollow cheeks
}

// Paints single HD pixels only where the sprite already has one of `under`: texture inside the old shape, never past it.
function fleck(pen, pts, col, under) { for (const [x, y] of pts) if (under.has(pen.at(x, y))) pen.P(x, y, col); }

export const DETAIL = {
  dog: (pen, eyes, { pose, leader }) => {
    const fur = leader ? ['#5a4c3e', '#4a3e32', '#2b231c'] : ['#7e6c58', '#6b5a48', '#4a3e32'], s = leader ? 2 : 0, lunge = pose === 'attack' ? 4 : 0;
    const body = new Set([fur[1], fur[0]]);
    const strokes = []; for (let x = 7; x < 26 + lunge; x += 3) { strokes.push([x, 10 + s + (x % 2)], [x + 1, 12 + s], [x - 1, 14 + s - (x % 2)]); }
    fleck(pen, strokes, fur[2], body); // matted fur
    fleck(pen, [[8, 9 + s], [13, 9 + s], [18, 9 + s], [23, 9 + s]], fur[0], body); // light along the spine
    const [ex, ey] = eyes[0]; pen.P(ex * 2, ey * 2, '#ff8a6a'); pen.P(ex * 2 + 1, ey * 2 + 1, '#8a1a12'); // a wet red eye
    const hx = (12 + (lunge >> 1) + (leader ? 1 : 0)) * 2; pen.P(hx + 9 + (lunge ? 2 : 0), 8 + s, '#1a1410'); // nose
    if (lunge) { pen.P(hx + 8, 12 + s, '#e8e4d8'); pen.P(hx + 10, 12 + s, '#e8e4d8'); } // teeth
  },
  biscuit: (pen, eyes, { pose }) => {
    if (pose === 'down') return;
    const W = new Set(['#dcc08a', '#c8a46a']);
    const pts = []; for (let x = 5; x < 20; x += 2) pts.push([x, 9 + (x % 4 === 1 ? 1 : 0)], [x + 1, 12]);
    fleck(pen, pts, '#a8844e', W); fleck(pen, [[6, 6], [10, 6], [14, 7]], '#e8d4a8', W); // wiry coat
    const [ex, ey] = eyes[0]; pen.P(ex * 2, ey * 2, '#f2ead6'); // eye glint
  },
  human: (pen, eyes, info) => humanFace(pen, eyes, info),
  bloater: (pen, eyes, info) => humanFace(pen, eyes, { ...info, kind: 'bloater' }),
  cain: (pen, eyes, { pad, view, pose, pal, tx }) => {
    const crouch = pose === 'charge' ? 1 : 0;
    const hx = view === 2 ? 6 : 5, hy = 3 + (pose === 'stagger' ? -1 : 0) + crouch;
    if (pad < 3) paint(pen, tx * 2 + (view === 2 ? 0 : 0), (11 + crouch) * 2, CAIN_TORSO_HD[view], pal, set(pal, 'JjnWwXxZGPpU'));
    paint(pen, hx * 2, hy * 2, CAIN_HEAD_HD[view], pal, set(pal, 'HhkSsdBbmTLle'));
  },
};
