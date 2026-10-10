// In-hand weapons (ART-PRD D8): each weapon is a pixel profile laid along the swing or aim line, so it stays
// crisp at any angle. A profile is a list of [along, across, colour] cells (along: 0 = the hand, across: + is the
// upper edge). Tier tint: I brighter metal, II an effect-colour glint on the edge, III a gold edge.
import { shade } from './palette.js';

const WOOD = ['#c49a62', '#8f6a3e', '#5a3e2a'], STEEL = ['#e8e4d8', '#c0c4c8', '#9aa3a8', '#6f787d', '#4a4d52'], BLACK = ['#4a4d52', '#2f2f33', '#1d1d20'];
const line = (cells, a0, a1, b, c) => { for (let a = a0; a <= a1; a++) cells.push([a, b, c]); };

function melee(id, L) {
  const c = [];
  switch (id) {
    case 'hammer': line(c, 0, L - 2, 0, WOOD[1]); line(c, 0, 1, 0, '#3a3a3e'); line(c, 0, L - 2, 1, WOOD[0]);
      for (let b = -2; b <= 2; b++) c.push([L - 1, b, STEEL[2]], [L, b, b === 2 ? STEEL[0] : STEEL[3]]); c.push([L - 2, -2, STEEL[3]], [L + 1, -2, STEEL[3]], [L, -3, STEEL[4]]); c.push(['edge', L, 2]); break; // claw split
    case 'bat': line(c, 0, 2, 0, '#3a3a3e'); line(c, 3, L, 0, WOOD[1]); line(c, 4, L, 1, WOOD[0]); line(c, 5, L, -1, WOOD[2]);
      c.push([L - 1, 2, '#e8e4d8'], [L - 3, -2, '#e8e4d8'], [L + 1, 0, '#e8e4d8']); break; // nails through the end
    case 'machete': line(c, 0, 2, 0, '#2b2b2e'); c.push([3, 1, STEEL[3]], [3, -1, STEEL[3]]); line(c, 3, L, 0, STEEL[2]); line(c, 4, L - 1, 1, STEEL[3]); line(c, 3, L, -1, STEEL[0]); c.push(['edge', L, -1]); break;
    case 'axe': line(c, 0, L, 0, '#d9c23a'); line(c, 0, L, 1, '#e8d860'); for (let a = L - 2; a <= L; a++) { c.push([a, -1, '#b5302a'], [a, -2, '#b5302a'], [a, -3, '#d84a3a']); } line(c, L - 2, L, -4, STEEL[0]); c.push([L - 1, 2, STEEL[3]], [L - 1, 3, STEEL[2]]); c.push(['edge', L - 1, -4]); break; // red head, spike
    case 'spear': line(c, 0, L - 4, 0, WOOD[1]); line(c, 0, L - 4, 1, WOOD[0]); line(c, L - 5, L - 3, -1, '#c8c0b0'); line(c, L - 5, L - 3, 1, '#c8c0b0'); line(c, L - 3, L, 0, STEEL[1]); line(c, L - 3, L - 1, 1, STEEL[0]); c.push(['edge', L, 0]); break; // broom handle, knife taped on
    case 'sledge': line(c, 0, L - 2, 0, '#c8a46a'); line(c, 0, L - 2, 1, '#dcc08a'); for (let a = L - 2; a <= L; a++) for (let b = -3; b <= 3; b++) c.push([a, b, b === 3 ? STEEL[2] : a === L ? STEEL[4] : STEEL[3]]); c.push(['edge', L, 3]); break;
    case 'cricket': for (let a = 0; a <= 3; a++) c.push([a, 0, a % 2 ? '#3a3a3e' : '#b5302a']); line(c, 4, L, 0, '#e8dfc6'); line(c, 4, L, 1, '#f2ead6'); line(c, 4, L, 2, '#c8bf9a'); line(c, 5, L, -1, '#c8bf9a'); break;
    case 'golf': for (let a = 0; a <= 2; a++) c.push([a, 0, a % 2 ? '#2f4a7a' : '#b5302a'], [a, 1, a % 2 ? '#b5302a' : '#2f4a7a']); line(c, 3, L, 0, STEEL[1]); c.push([L, 1, STEEL[2]], [L, 2, STEEL[2]], [L + 1, 1, STEEL[3]], [L + 1, 2, STEEL[3]]); break; // tartan grip
    case 'cleaver': line(c, 0, 2, 0, WOOD[2]); for (let a = 3; a <= L; a++) for (let b = -1; b <= 2; b++) c.push([a, b, b === -1 ? STEEL[0] : STEEL[2]]); c.push([L - 1, 1, '#2b1d16'], [4, 2, '#4a1612'], [5, 1, '#4a1612']); c.push(['edge', L, -1]); break;
    default: line(c, 0, L, 0, '#9aa3a8');
  }
  return c;
}
function gun(id) {
  const c = [];
  switch (id) {
    case 'revolver': c.push([0, -1, WOOD[1]], [0, -2, WOOD[2]], [1, -1, WOOD[1]]); for (let a = 1; a <= 3; a++) for (let b = -1; b <= 1; b++) c.push([a, b, b === 1 ? STEEL[2] : STEEL[4]]); line(c, 3, 7, 0, STEEL[3]); line(c, 4, 7, 1, STEEL[2]); return { c, len: 7 };
    case 'pistol': c.push([0, -1, BLACK[1]], [0, -2, BLACK[2]], [1, -1, BLACK[1]]); line(c, 0, 6, 0, BLACK[1]); line(c, 0, 6, 1, BLACK[0]); return { c, len: 6 };
    case 'shotgun': line(c, -3, 0, 0, WOOD[1]); line(c, -3, -1, -1, WOOD[2]); line(c, 0, 10, 1, STEEL[4]); line(c, 0, 9, 0, BLACK[1]); line(c, 4, 6, 0, WOOD[0]); line(c, 4, 6, -1, WOOD[1]); return { c, len: 10 };
    case 'dbarrel': line(c, -3, 1, 0, WOOD[1]); line(c, -3, 0, -1, WOOD[2]); line(c, 1, 10, 0, STEEL[3]); line(c, 1, 10, 1, STEEL[2]); c.push([1, -1, WOOD[0]]); return { c, len: 10 };
    case 'rifle': line(c, -3, 7, 0, WOOD[2]); line(c, -3, 6, -1, WOOD[1]); line(c, 7, 12, 0, BLACK[1]); line(c, 2, 6, 2, BLACK[1]); c.push([6, 2, '#8aa2b8'], [2, 2, '#8aa2b8'], [4, 1, BLACK[0]]); return { c, len: 12 }; // bolt rifle with a scope
    case 'crossbow': line(c, -1, 7, 0, WOOD[1]); line(c, -1, 7, -1, WOOD[2]); for (let b = -4; b <= 4; b++) c.push([6 - Math.abs(b) / 3 | 0, b, STEEL[3]]); c.push([4, 4, '#e8dfc6'], [3, 3, '#e8dfc6'], [3, -3, '#e8dfc6'], [4, -4, '#e8dfc6'], [2, 1, '#e8dfc6'], [2, -1, '#e8dfc6'], [2, 2, '#e8dfc6'], [2, -2, '#e8dfc6']); line(c, 2, 8, 1, STEEL[1]); return { c, len: 8 };
    case 'bow': for (let b = -5; b <= 5; b++) { const a = 2 - Math.round((b * b) / 10) + (Math.abs(b) === 5 ? 1 : 0); c.push([a, b, b % 2 ? WOOD[2] : WOOD[1]]); } line(c, -1, -1, 0, '#e8dfc6'); for (let b = -4; b <= 4; b++) c.push([-1 + Math.round(Math.abs(b) / 3), b, '#e8dfc6']); return { c, len: 3 };
    case 'smg': line(c, 0, 6, 0, BLACK[1]); line(c, 0, 5, 1, BLACK[0]); c.push([2, -1, BLACK[2]], [2, -2, BLACK[2]], [2, -3, BLACK[1]], [0, -1, BLACK[2]]); line(c, 6, 8, 0, STEEL[4]); return { c, len: 8 };
    case 'ar': line(c, -2, 8, 0, '#4a5a3a'); line(c, -2, 6, 1, '#5d6b4a'); c.push([3, -1, BLACK[1]], [3, -2, BLACK[1]], [4, -3, BLACK[1]], [4, -2, BLACK[2]], [0, -1, BLACK[2]]); line(c, 8, 11, 0, BLACK[1]); return { c, len: 11 }; // curved magazine
    case 'flare': c.push([0, -1, '#b5503b'], [0, -2, '#8a3a2a']); for (let a = 0; a <= 5; a++) for (let b = 0; b <= 1; b++) c.push([a, b, b ? '#f0a050' : '#d9822b']); c.push([5, 0, '#2b1d16']); return { c, len: 5 };
    case 'nailgun': line(c, 0, 5, 0, '#e2b53c'); line(c, 0, 5, 1, '#f4d070'); line(c, 1, 3, -1, '#4d7fb8'); c.push([0, -2, BLACK[1]], [-1, -3, BLACK[1]], [-2, -3, BLACK[1]], [6, 0, STEEL[2]]); return { c, len: 6 }; // hose trailing
    case 'blowtorch': for (let a = -2; a <= 1; a++) for (let b = -1; b <= 1; b++) c.push([a, b, b === 1 ? '#d06a50' : '#b5503b']); line(c, 2, 6, 0, STEEL[3]); c.push([7, 0, '#c9a24a'], [1, 2, BLACK[1]]); return { c, len: 7 };
    default: line(c, 0, 7, 0, BLACK[1]); return { c, len: 7 };
  }
}
export function chainsawCells(frame) {
  const c = [];
  for (let a = 0; a <= 4; a++) for (let b = -1; b <= 1; b++) c.push([a, b, b === 1 ? '#f0a050' : '#d9822b']);
  c.push([1, 2, BLACK[1]], [2, 2, BLACK[1]]);
  line(c, 5, 15, 0, STEEL[2]); for (let a = 5 + (frame % 2); a <= 15; a += 2) { c.push([a, 1, '#e8e4d8'], [a, -1, STEEL[4]]); } // the chain runs
  return c;
}

// Draws the profile from (x, y) along angle ang. tier tints, effColor for tier II glint.
export function drawProfile(v, x, y, ang, cells, tier = 0, effColor = null) {
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = dy, ny = -dx; // across: + is "up" relative to the line
  const at = (a, b) => [Math.round(x + dx * a + nx * b), Math.round(y + dy * a + ny * b)];
  const pts = [];
  let edge = null;
  for (const cell of cells) { if (cell[0] === 'edge') { edge = cell; continue; } pts.push([...at(cell[0], cell[1]), cell[2]]); }
  v.fillStyle = '#2b1d16';
  for (const [px, py] of pts) v.fillRect(px - 1, py - 1, 3, 3); // outline
  for (const [px, py, c] of pts) { v.fillStyle = tier >= 1 && isMetal(c) ? shade(c, 0.15) : c; v.fillRect(px, py, 1, 1); }
  if (edge && tier >= 2) { const [ex, ey] = at(edge[1], edge[2]); v.fillStyle = tier >= 3 ? '#f0b030' : effColor || '#f2ead6'; v.fillRect(ex, ey, 1, 1); const [ex2, ey2] = at(edge[1] - 1, edge[2]); v.fillRect(ex2, ey2, 1, 1); }
  else if (tier >= 3) { const [ex, ey] = at(cells.length ? cells[cells.length - 1][0] : 0, 0); v.fillStyle = '#f0b030'; v.fillRect(ex, ey, 1, 1); }
}
const isMetal = (c) => STEEL.includes(c) || BLACK.includes(c);
export const meleeCells = melee;
export const gunCells = gun;
