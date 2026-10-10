// Named colour ramps for the art pass (ART-PRD D0, D11 step 1). Every material is [light, base, shadow].
// No pure black (darkest #14100d) and no pure white (lightest #f2ead6).
// Colours still inline in mapart.js / renderer.js move here as each phase redraws that asset.

export const INK = { darkest: '#14100d', outline: '#2b1d16', lightest: '#f2ead6' };

export const RAMP = {
  skin: {
    cain: ['#d9a47a', '#b5845e', '#8e6446'],
    dead: ['#9cc06a', '#79b04c', '#4f7a34'],
    deadBruise: '#5a6a70',
    runner: ['#d8a888', '#c4906e', '#a8705a'],
    living: ['#d9a47a', '#b07a52', '#e8c09a', '#8a5a3a'], // four survivor/raider tones (bases)
  },
  hair: { cain: ['#b0b2aa', '#8c8f86', '#6a6d66'] },
  beard: { cain: ['#b8b8ae', '#8f8f86', '#6a6a62'] },
  jacket: {
    canvas: ['#a8915a', '#8a7548', '#6a5836'],
    leather: ['#7a5a3e', '#5a3e2a', '#3a2a1e'],
    slate: ['#5e6878', '#4a5260', '#353b46'],
  },
  shirt: { work: ['#6a9ad0', '#4d7fb8', '#3a6290'] },
  bandana: ['#d06a50', '#b5503b', '#8a3a2a'],
  trousers: { canvas: ['#5c5c4a', '#4a4a3a', '#36362a'] },
  boot: { leather: ['#7a5a3e', '#5a3e2a', '#3e2a1c'] },
  felt: ['#a8a398', '#8a857a', '#6a665c'],
  strap: ['#4a443c', '#3a3530', '#2a2622'],
  lens: ['#f2ead6', '#d9d2b8', '#a8a088'],
  radio: ['#3e3e3e', '#2b2b2b', '#1c1c1c'],
  led: { amber: '#e8a030', green: '#6cbf4a', red: '#e03a2a' },
  belt: ['#3e382e', '#2f2a22', '#201c16'],
  brass: ['#e2c060', '#c9a24a', '#8f7030'],
  pouch: ['#6e5c3e', '#5a4a30', '#3e3220'],
  gunmetal: ['#4a4d52', '#2f2f33', '#1d1d20'],
  blood: { fresh: '#a3241c', freshHi: '#d23a2a', old: '#4a1612' },
  brick: ['#b5604a', '#9b4a36', '#7d3a2a'],
  mortar: '#5a4a40',
  tarmac: ['#4a4d50', '#3a3d40', '#33363a'],
  grass: ['#6cbf4a', '#46963a', '#2f6f2c'],
  dirt: ['#6e5a42', '#5a4632', '#463624'],
  fire: { core: '#f0b030', edge: '#e05a20', tip: '#8a2a10' },
  electric: '#9ad0ff',
  gasBloater: '#b8c43a',
  hazmat: ['#e8d860', '#d9c23a', '#a8961e'],
};

// Zone divider materials (ART-PRD-3 S2), [light, base, shadow].
export const DIV = {
  stone: ['#a8a090', '#8a8272', '#6a6458'],
  coping: ['#c8c0ac', '#a8a090', '#7a7466'],
  rail: ['#5a9a6a', '#2f6a3e', '#1f4a2a'],
  hoard: ['#4a6a5a', '#3a5a4a', '#2a4236'],
  stock: ['#c8b888', '#b0a070', '#8a7a52'],
  boards: ['#b08a5a', '#8f6a3e', '#6b4a2e'],
  breeze: ['#a8a8a0', '#8c8c86', '#6e6e68'],
  trellis: ['#c8a878', '#a8865a', '#7a5e3e'],
};

// Legacy flat palettes, moved here unchanged from sprites.js and mapart.js (phase 0: no visual change).
export const SKINS_DEAD = ['#79b04c', '#6fa84a', '#86a85a', '#74a060'];

// Ground tile colours: [base, blob A, blob B, accent], keyed by town.js G names.
export const GROUND = {
  GRASS: ['#4f8a34', '#5a983c', '#46803a', '#6a9e44'],
  ROAD: ['#3f4246', '#45484c', '#393c40', '#4a4d50'],
  PAVE: ['#8a8578', '#938e80', '#7f7a6e', '#77736a'],
  GRAVEL: ['#8f8676', '#9a917f', '#7f776a', '#a39a88'],
  TARMAC: ['#45484c', '#4b4e52', '#3f4246', '#505357'],
  FIELD: ['#5ea03a', '#66a842', '#579a36', '#6cb946'],
  YARD: ['#9a7444', '#a8804e', '#8c6a3e', '#b08a58'],
  GRAVE: ['#4a7e30', '#538a36', '#43742c', '#5a9040'],
  SOIL: ['#6b4a2e', '#755234', '#5f4228', '#4e962f'],
  WOODS: ['#2f5a22', '#3f7d27', '#2a5020', '#355f26'],
  FARM: ['#7a6a3a', '#867644', '#6e5e34', '#5d8a3a'],
  RIVER: ['#2f5a7a', '#356486', '#2a5070', '#4a7a98'],
  BYPASS: ['#3a3c40', '#404246', '#34363a', '#c8bf9a'],
};

// Lighten (amt > 0) or darken (amt < 0) a #rrggbb colour.
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  return '#' + ((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1);
}
// 3-step ramp from one base colour: [light, base, shadow].
export const ramp3 = (c, up = 0.2, down = -0.3) => [shade(c, up), c, shade(c, down)];
