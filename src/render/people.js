// Characters other than Cain (ART-PRD D2, D3): the dead with their aged outfits, the specials, the big two,
// crawlers, dogs, Biscuit, survivors, looters, raiders and corpses. Everything is drawn flat-but-ramped here;
// sprites.js caches the result, adds the selective outline and makes the flash / night variants.
import { RAMP, SKINS_DEAD, shade, ramp3 } from './palette.js';
import { OUTFITS } from '../data.js';

const SOCKET = '#22261c', GAP = '#2a1612', BRUISE = RAMP.skin.deadBruise, OLD = RAMP.blood.old, FRESH = RAMP.blood.fresh;
const hash = (n) => { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); return (n ^ (n >>> 16)) >>> 0; };
export const LIVING = new Set(['survivor', 'raider', 'looter']);
const OUTFIT_KINDS = new Set(['walker', 'bloater', 'tangled', 'crawler']);

// opts: { role, sick, hurt, captain } for living people
export function drawHuman(ctx, kind, pal, view, frame, pose, outfit = 0, opts = {}) {
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const living = LIVING.has(kind), dead = !living;
  const side = view === 2, back = view >= 3, front = view <= 1;
  const runner = kind === 'runner', screamer = kind === 'screamer', hazmat = kind === 'hazmat', armoured = kind === 'armoured', looter = kind === 'looter';
  const oname = OUTFIT_KINDS.has(kind) ? OUTFITS[outfit % OUTFITS.length].name : null;
  // VA-1 look seed (0..3) for the outfit dead: skin within the dead ramp, hair, tears and one injury. Silhouette unchanged.
  const look = oname && opts.look ? opts.look : 0, lh = hash(outfit * 131 + look * 977 + 5);
  const injury = look ? ['ear', 'arm', 'jaw', 'shoe'][(look + (lh >>> 5)) % 4] : null, hairStyle = look ? look % 4 : 0;
  const skinBase = opts.sick ? mix(pal.skin, '#9cc06a', 0.35) : look ? shade(SKINS_DEAD[(outfit + look) % SKINS_DEAD.length], [0, -0.16, 0.12, -0.07][look]) : pal.skin;
  const sk = ramp3(skinBase, 0.18, -0.3), sh = ramp3(pal.shirt, 0.16, -0.28), pa = ramp3(pal.pants, 0.15, -0.32);
  // Speed tier posture (D2): 0 slow = deeply hunched, head sunk, arms dangling, short dragging steps;
  // 1 = the standard shamble; 2 fast = upright, leaning in, arms reaching high, a long stride.
  const gait = opts.gait ?? 1, shambler = dead && !runner && !screamer && pose !== 'attack' && pose !== 'stagger';
  const hunch = shambler ? [2, 1, 0][gait] : (dead && !runner && pose !== 'attack') || looter ? 1 : 0;
  const lean = (runner || (shambler && gait === 2)) && pose !== 'stagger' ? (side ? 2 : view === 1 || view === 3 ? 1 : 0) : 0;
  const step = (frame % 2 === 1 ? (frame === 1 ? 1 : -1) : 0) * (shambler && gait === 2 ? 2 : 1);
  const bobY = dead && !runner ? (frame === 1 || (gait === 0 && frame === 3) ? 1 : 0) : 0; // the shamble: a head dip out of phase with the feet
  const reach = shambler ? [1, 0, -1][gait] : 0; // arms: dangling low, level, or reaching up
  const h = hash(outfit * 31 + kind.length * 7 + look * 7919);

  // ---- legs ----
  const wellies = oname === 'farmer';
  const leg = (x, near, lift, bare) => {
    const c = near ? pa : [pa[1], pa[2], shade(pa[2], -0.2)];
    R(x, 18, 2, 4 - lift, c[1]); R(x, 18, 1, 4 - lift, c[0]); R(x, 21 - lift, 2, 1, c[2]); // dirty hem
    const by = 22 - lift;
    if (bare) { R(x, by, 2, 2, sk[1]); R(x, by + 1, 2, 1, sk[2]); R(x + 1, by, 1, 1, BRUISE); }
    else if (wellies) { R(x, 20 - lift, 2, 4, '#2f4a2a'); R(x, 20 - lift, 1, 3, '#46663a'); }
    else { R(x, by, 2, 2, pal.boots); R(x, by, 1, 1, shade(pal.boots, 0.3)); }
    if (armoured && !back) { R(x, 19 - lift, 2, 3, '#4a4d52'); R(x, 19 - lift, 2, 1, '#6f787d'); } // shin guards
  };
  const bareR = runner || injury === 'shoe'; // one bare foot
  if (side || view === 1 || view === 3) {
    const a = 6 - step + (lean ? 1 : 0), b = 8 + step + (lean ? 1 : 0);
    leg(b, false, 0, false); leg(a, true, 0, bareR);
  } else {
    const la = !dead && step > 0 ? 1 : 0, lb = !dead && step < 0 ? 1 : 0; // the dead drag the leading foot
    leg(5, true, la, false); leg(9, false, lb, bareR);
  }
  if (opts.captain && !side) { R(4, 18, 8, 3, sh[2]); R(4, 18, 1, 3, sh[1]); R(7, 18, 2, 3, pa[2]); } // long coat skirts

  // ---- torso ----
  const tx = side ? 5 + (lean ? 1 : 0) : 4, tw = side ? 6 : 8;
  const chestFill = screamer && pose === 'attack' ? 1 : 0;
  R(tx - chestFill, 11, tw + chestFill * 2, 7, sh[1]);
  R(tx - chestFill, 11, 1, 7, sh[0]); R(tx, 11, tw, 1, sh[0]);
  R(tx + tw - 2, 12, 2, 6, sh[2]); R(tx, 17, tw, 1, shade(pal.shirt, -0.42)); // dirt along the hem
  if (front) R(tx + 3, 11, 2, 1, sk[2]); // neck shadow in the collar
  if (living || looter) { R(tx, 16, tw, 1, shade(pal.pants, -0.4)); if (!back) R(tx + (tw >> 1), 16, 1, 1, '#c9a24a'); }
  if (oname) outfitDetail(R, oname, pal, sh, sk, tx, tw, view, kind);
  if (runner) { // torn running vest
    R(tx, 11, tw, 1, sk[1]); if (front) { R(tx + 2, 13, 4, 1, '#e8e0c0'); R(tx + 2, 13, 1, 1, sh[0]); }
    for (let i = 0; i < tw; i += 2) R(tx + i, 17, 1, 1, sk[1]);
  }
  if (armoured) {
    if (!back) { R(tx, 12, tw, 5, '#3a3530'); R(tx, 12, tw, 1, '#5a544a'); R(tx + 1, 13, tw - 2, 1, '#d9c23a'); R(tx + 2, 15, 3, 1, '#c8c0a8'); R(tx + tw - 1, 12, 1, 5, '#2a2622'); }
    else { R(tx + 2, 13, tw - 4, 3, sk[2]); R(tx + 2, 13, 1, 3, BRUISE); R(tx + 1, 11, 1, 6, '#2a2622'); R(tx + tw - 2, 11, 1, 6, '#2a2622'); R(tx, 14, tw, 1, '#d9c23a'); } // straps and an exposed back
  }
  if (hazmat) { R(tx, 15, tw, 1, '#c0c4c8'); R(tx + 1, 12, 1, 3, shade(pal.shirt, 0.25)); }
  if (screamer) { R(tx + 2, 11, tw - 4, 1, '#a8302a'); }

  // aged clothes: tears showing skin, an old blood stain
  if (dead && !hazmat && !armoured) {
    const n = 2 + (h % 3), cells = [[tx + 1, 13], [tx + tw - 2, 15], [tx + 2, 16], [6, 20], [10, 19], [tx + 4, 12], [5, 19], [tx + 1, 15]];
    for (let i = 0; i < n; i++) { const [x, y] = cells[(h >>> (i * 3)) % cells.length]; R(x, y, 1, 1, y >= 19 ? BRUISE : sk[1]); }
    if (!back) { R(tx + 1 + (h % 3), 13 + ((h >>> 4) % 2), 2, 1, OLD); R(tx + 2 + (h % 3), 14 + ((h >>> 4) % 2), 1, 1, OLD); }
  }

  // ---- arms ----
  const bareArms = runner || kind === 'butcher';
  const sl = bareArms ? sk : sh;
  const hand = hazmat ? ['#3a3a3e', '#2a2a2e', '#1d1d20'] : opts.role === 'mechanic' ? ['#5a4a3a', '#3a3530', '#2a2622'] : sk;
  const armV = (x, y, len, light, extra) => {
    R(x, y, 2, len - 2, sl[1]); R(light ? x : x + 1, y, 1, len - 2, light ? sl[0] : sl[2]);
    R(x, y + len - 2, 2, 2, hand[1]); R(light ? x + 1 : x, y + len - 1, 1, 1, hand[2]);
    if (hazmat) R(x, y + len - 3, 2, 1, '#c0c4c8'); // tape at the wrists
    if (dead && extra) R(x, y + 2, 1, 1, BRUISE); // elbow bruise
  };
  if (pose === 'attack') {
    if (side) { R(10 + lean, 8, 2, 4, sl[1]); R(10 + lean, 8, 1, 4, sl[0]); R(11 + lean, 7, 2, 2, hand[1]); }
    else { armV(tx - 1, 6, 6, true, true); armV(tx + tw - 1, 6, 6, false, true); }
  } else if (dead && !screamer) {
    const lower = 1; // one arm always a pixel lower
    if (side && gait === 0 && shambler) { R(8 + hunch, 12 + hunch, 2, 4, sl[1]); R(8 + hunch, 12 + hunch, 1, 4, sl[0]); R(9 + hunch, 16 + hunch, 2, 2, hand[1]); R(10 + hunch, 17 + hunch, 1, 1, hand[2]); R(8 + hunch, 14 + hunch, 1, 1, BRUISE); } // arm hangs, swinging dead
    else if (side) { const ay = 12 + Math.min(hunch, 1) + reach, len = gait === 2 && shambler ? 6 : 5; R(9 + Math.min(hunch, 1) + lean, ay, len, 2, sl[1]); R(9 + Math.min(hunch, 1) + lean, ay, len, 1, sl[0]); R(9 + len + lean, ay, 2, 2, hand[1]); R(10 + len + lean, ay + 1, 1, 1, hand[2]); R(11 + lean, ay + 1, 1, 1, BRUISE); }
    else if (front) { armV(tx, 12 + reach, 5 + Math.max(0, reach), true, true); armV(tx + tw - 2, 12 + lower + reach, 5 + Math.max(0, reach), false, true); }
    else { armV(tx - 1, 12 + reach, 6, true, true); armV(tx + tw - 1, 12 + lower + reach, 6, false, true); }
  } else {
    if (side) { R(7 + step + lean, 12, 2, 5, sl[1]); R(7 + step + lean, 12, 1, 5, sl[0]); R(7 + step + lean, 17, 2, 1, hand[1]); }
    else { armV(tx - 1, 12 + (step > 0 ? 1 : 0), 6, true); armV(tx + tw - 1, 12 + (step < 0 ? 1 : 0), 6, false); }
  }
  if (kind === 'tangled') { // barbed wire wound round torso and arms, cutting in
    for (let i = 0; i < 7; i++) { const x = tx - 1 + ((i * 5) % (tw + 2)), y = 11 + i; R(x, y, 2, 1, '#c0c4c8'); if (i % 2) R(x + 1, y - 1, 1, 1, '#e8e4d8'); if (i % 3 === 0) R(x, y + 1, 1, 1, FRESH); }
    R(4, 18, 1, 3, '#c0c4c8'); R(11, 19, 1, 2, '#c0c4c8'); R(11, 21, 1, 1, FRESH);
  }
  if (kind === 'raider' && !(side && back)) { const ax = side ? 7 : back ? tx - 1 : tx + tw - 1; R(ax, 13, 2, 1, '#b5503b'); R(ax + (back ? 0 : 1), 14, 1, 1, '#8a3a2a'); } // the gang's red rag
  if (looter) { // bulging holdall over the shoulder, a coin spilling
    if (back) { R(tx + 1, 12, tw - 2, 5, '#3a4a5a'); R(tx + 1, 12, tw - 2, 1, '#4e6070'); R(tx + 3, 14, 2, 1, '#2a3440'); }
    else { const bx = side ? tx - 2 : tx + tw - 1; R(bx, 14, 4, 4, '#3a4a5a'); R(bx, 14, 4, 1, '#4e6070'); R(bx + 1, 18, 1, 1, '#e2b53c'); R(tx, 11, tw, 1, '#2a3440'); }
  }
  const vk = kind === 'survivor' ? hash(outfit * 7 + 3) % 6 : -1; // VA-10: 0 plain, 1 glasses, 2 beard, 3 cap, 4 glasses and beard, 5 stocky
  if (vk === 5 && !side) { R(tx - 1, 13, 1, 4, sh[1]); R(tx + tw, 13, 1, 4, sh[2]); R(tx, 16, tw, 1, sh[2]); } else if (vk === 5) R(tx + tw, 13, 1, 4, sh[2]); // a broader build
  if (living && opts.role) roleDetail(R, opts.role, tx, tw, view, sh);
  if (injury === 'arm' && pose !== 'attack' && !screamer) { // a bite out of the forearm
    if (side) { const ay = 12 + Math.min(hunch, 1) + reach; R(10 + Math.min(hunch, 1) + lean, ay, 2, 1, FRESH); R(11 + Math.min(hunch, 1) + lean, ay + 1, 1, 1, OLD); }
    else { const ax = front ? tx : tx - 1; R(ax, 15 + reach, 1, 2, FRESH); R(ax + 1, 16 + reach, 1, 1, OLD); }
  }
  if (opts.sick) { R(tx - 1, 11, tw + 2, 3, '#8a6a5a'); R(tx - 1, 11, tw + 2, 1, '#a8846e'); for (let i = 0; i < tw + 2; i += 3) R(tx - 1 + i, 12, 1, 2, '#5a4a6a'); } // a blanket round the shoulders

  // ---- head ----
  const hx = (side ? 6 : 5) + (side ? hunch : 0) + lean;
  const tilt = screamer && pose === 'attack' ? -1 : 0;
  const hy = 4 + (view === 0 ? hunch : gait === 0 && shambler ? 1 : 0) + (pose === 'stagger' ? -1 : 0) + bobY + (screamer ? -1 : 0) + tilt;
  R(hx, hy, 6, 7, sk[1]); R(hx, hy, 1, 6, sk[0]); R(hx + 5, hy + 1, 1, 6, sk[2]); R(hx, hy + 6, 6, 1, sk[2]);
  if (screamer) { R(hx + 2, hy + 7, 2, 2, sk[1]); R(hx + 2, hy + 7, 2, 1, '#c03a2a'); R(hx + 3, hy + 8, 1, 1, '#e03a2a'); } // long neck, red throat
  const hair = pal.hair, eyes = [];
  if (hazmat) {
    R(hx - 1, hy - 1, 8, 8, sh[1]); R(hx - 1, hy - 1, 8, 1, sh[0]); R(hx + 6, hy, 1, 7, sh[2]);
    if (!back) { const vx = side ? hx + 3 : hx; R(vx, hy + 1, side ? 3 : 6, 3, '#2a4a2a'); R(vx + 1, hy + 2, 2, 1, '#6cbf4a'); R(vx + (side ? 2 : 4), hy + 1, 1, 2, '#c8d8c0'); R(side ? hx + 4 : hx + 1, hy + 4, side ? 3 : 4, 3, '#1d1d20'); R(side ? hx + 5 : hx + 2, hy + 5, 1, 1, '#4a4d52'); }
    eyes.push(...(view === 0 ? [[hx + 1, hy + 2], [hx + 4, hy + 2]] : view === 1 ? [[hx + 3, hy + 2]] : view === 2 ? [[hx + 5, hy + 2]] : []));
    return eyes;
  }
  if (armoured) {
    R(hx - 1, hy - 1, 8, 5, '#2f2f33'); R(hx, hy - 1, 3, 1, '#4a4d52');
    if (!back) { R(hx, hy + 2, 6, 2, '#5a6a78'); R(hx, hy + 2, 6, 1, '#8a9aa8'); R(hx + 3, hy + 2, 1, 2, '#c8d4dc'); R(hx + 4, hy + 3, 1, 1, '#2f2f33'); } // cracked visor
    else R(hx - 1, hy - 1, 8, 7, '#2f2f33');
  } else if (looter) {
    R(hx - 1, hy - 1, 8, 8, '#2b2b2e'); R(hx - 1, hy - 1, 8, 1, '#3e3e44');
    if (!back) R(side ? hx + 3 : hx, hy + 3, side ? 3 : 6, 1, sk[1]); // eye slit
  } else if (opts.captain) {
    R(hx - 1, hy - 1, 8, 3, '#2f2a22'); R(hx - 1, hy - 1, 8, 1, '#4a4238'); if (!back) R(side ? hx + 3 : hx - 1, hy + 2, side ? 4 : 8, 1, '#1d1a14'); if (back) R(hx, hy + 2, 6, 3, hair);
  } else {
    const style = living ? outfit % 4 : 0;
    if (dead && hairStyle === 1) { R(hx + 1, hy, 4, 1, sk[0]); R(hx + 3, hy + 1, 1, 1, BRUISE); } // bald, a scalp wound
    else if (dead && hairStyle === 2) { R(hx, hy, 6, 2, hair); R(hx, hy + 2, 1, 4, hair); if (!side) R(hx + 5, hy + 2, 1, 4, shade(hair, -0.2)); } // long, lank
    else if (dead && hairStyle === 3) { R(hx, hy, 6, 2, shade(hair, 0.15)); R(hx + 1, hy, 1, 1, OLD); R(hx + 4, hy + 1, 1, 1, shade(hair, -0.35)); R(hx + 2, hy + 2, 1, 1, shade(hair, 0.15)); } // matted
    else if (style === 2) { R(hx, hy, 6, 1, hair); } // cropped
    else { R(hx, hy, 6, 2, hair); R(hx + 1, hy, 2, 1, shade(hair, 0.3)); }
    if (style === 1 || style === 3) { R(hx - (side ? 0 : 1), hy + 1, 1, 5, hair); if (!side) R(hx + 6, hy + 1, 1, 5, shade(hair, -0.2)); }
    if (back) R(hx, hy, 6, 5, hair), R(hx + 1, hy + 1, 1, 2, shade(hair, 0.25));
    if (oname === 'hunter') { R(hx - 1, hy - 1, 8, 3, '#d9822b'); R(hx - 1, hy - 1, 8, 1, '#f0a050'); if (!back) R(side ? hx + 3 : hx, hy + 2, side ? 4 : 6, 1, '#a8602a'); }
    if (oname === 'firefighter') { R(hx - 1, hy - 1, 8, 3, '#2f2f33'); R(hx - 1, hy + 1, 8, 1, '#d9c23a'); }
    if (oname === 'hoodie' && (back || outfit % 2 === 0)) { R(hx - 1, hy - 1, 8, 3, sh[1]); R(hx - 1, hy - 1, 1, 7, sh[1]); R(hx + 6, hy - 1, 1, 7, sh[2]); R(hx, hy - 1, 4, 1, sh[0]); if (back) R(hx, hy, 6, 6, sh[1]); }
    if (vk === 3) { const cc = ['#2f4060', '#a8302a', '#3a3530'][outfit % 3]; R(hx - 1, hy - 1, 8, 3, cc); R(hx - 1, hy - 1, 8, 1, shade(cc, 0.3)); if (!back) R(side ? hx + 4 : hx, hy + 2, side ? 4 : 6, 1, shade(cc, -0.3)); } // a cap, brim forward
    if (opts.hurt) { R(hx, hy + 1, 6, 1, '#e8e0cc'); R(hx + 4, hy + 1, 1, 1, '#c86a5a'); }
  }
  // face
  if (!back && !looter) {
    const eyesAt = view === 0 ? [[hx + 1, hy + 3], [hx + 4, hy + 3]] : view === 1 ? [[hx + 3, hy + 3], [hx + 5, hy + 3]] : [[hx + 5, hy + 3]];
    for (const [x, y] of eyesAt) {
      if (dead) { R(x, y, 1, 1, SOCKET); R(x, y - 1, 1, 1, sk[2]); } // sunken: the pupil only shows at night
      else { R(x, y - 1, 1, 1, sk[2]); R(x, y, 1, 1, '#2b1d16'); }
      eyes.push([x, y]);
    }
    if (!side) { R(hx + 2, hy + 4, 1, 1, sk[2]); }
    const mx = side ? hx + 4 : view === 1 ? hx + 3 : hx + 2;
    if (dead) { R(mx, hy + 5, 2, screamer ? 3 : 1, GAP); if (screamer) R(mx, hy + 7, 2, 1, '#7a2a22'); }
    else if (kind === 'raider') { R(hx, hy + 4, 6, 3, '#b5503b'); R(hx, hy + 4, 6, 1, '#d06a50'); } // scarf over the face
    else R(mx, hy + 5, 2, 1, sk[2]);
    if (vk === 2 || vk === 4) { R(side ? hx + 2 : hx, hy + 5, side ? 4 : 6, 2, pal.hair); R(mx, hy + 5, 2, 1, sk[2]); } // a beard
    if (vk === 1 || vk === 4) for (const [x, y] of eyesAt) { R(x - 1, y - 1, 3, 1, '#2b2a2e'); R(x, y, 1, 1, '#2b1d16'); if (!side) R(hx + 3, hy + 2, 1, 1, '#2b2a2e'); } // glasses
    if (kind === 'bloater') { R(mx, hy + 6, 1, 1, '#b8c43a'); R(mx, hy + 7, 1, 1, '#d8e05a'); }
    if (injury === 'jaw') { R(mx - (side ? 0 : 1), hy + 5, side ? 2 : 4, 2, GAP); R(mx, hy + 6, 1, 1, FRESH); } // lower jaw gone
    if (injury === 'ear') { const ex = side ? hx + 1 : view === 1 ? hx : hx + 5; R(ex, hy + 3, 1, 2, OLD); R(ex, hy + 3, 1, 1, FRESH); }
  } else if (looter && !back) eyes.push(...(view === 0 ? [[hx + 1, hy + 3], [hx + 4, hy + 3]] : view === 1 ? [[hx + 3, hy + 3]] : [[hx + 5, hy + 3]]));
  return eyes;
}

function outfitDetail(R, name, pal, sh, sk, tx, tw, view, kind) {
  const front = view <= 1, back = view >= 3, side = view === 2;
  switch (name) {
    case 'hi-vis': R(tx, 13, tw, 1, '#e8e0c0'); R(tx, 15, tw, 1, '#e8e0c0'); if (front) { R(tx + 2, 11, 1, 2, '#e8e0c0'); R(tx + tw - 3, 11, 1, 2, '#e8e0c0'); } break;
    case 'scrubs': if (front) { R(tx + 3, 11, 2, 2, sk[1]); R(tx + 3, 13, 1, 2, '#4d7fb8'); R(tx + 3, 15, 2, 2, '#e8dfc6'); R(tx + 3, 15, 2, 1, '#b5503b'); } break;
    case 'postman': { for (let i = 0; i < 6; i++) R(tx + Math.round(i * (tw - 1) / 5), 11 + i, 1, 1, '#5a3e2a'); if (!back) { R(tx + tw - 2, 15, 3, 3, '#7a5a3a'); R(tx + tw - 2, 15, 3, 1, '#8f6a3e'); } R(tx + 1, 12, 1, 1, '#c9a24a'); break; }
    case 'hunter': R(tx, 14, tw, 1, shade(pal.shirt, -0.35)); if (front) R(tx + 1, 13, 2, 1, '#8f6a3e'); break;
    case 'tabard': R(tx, 11, 1, 6, pal.trim); R(tx + tw - 1, 11, 1, 6, pal.trim); if (front) R(tx + 5, 12, 2, 1, '#f2ead6'); break;
    case 'hoodie': if (front) { R(tx + 3, 12, 1, 2, pal.trim); R(tx + 4, 12, 1, 3, pal.trim); R(tx + 1, 15, tw - 2, 1, sh[2]); } break;
    case 'suit': if (front) { R(tx + 3, 11, 2, 3, '#d8d4c8'); R(tx + 4, 12, 1, 1, '#8a2a22'); R(tx + 3, 13, 1, 2, '#8a2a22'); R(tx + 2, 11, 1, 3, sh[2]); R(tx + 5, 11, 1, 3, sh[2]); } break;
    case 'school': if (front) { R(tx + 3, 11, 2, 1, '#e8e4d8'); R(tx + 3, 12, 1, 4, pal.trim); R(tx + 1, 12, 1, 1, '#c9a24a'); } break;
    case 'firefighter': R(tx, 14, tw, 1, '#d9c23a'); R(tx, 16, tw, 1, '#c8c0a8'); break;
    case 'chef': if (!back) { R(tx + 1, 13, tw - 2, 5, '#f2ead6'); R(tx + 1, 13, tw - 2, 1, '#c8c0b0'); R(tx + 2, 15, 2, 1, OLD); } else R(tx + 2, 15, tw - 4, 1, '#f2ead6'); break;
    case 'farmer': if (front) { R(tx + 1, 11, 1, 4, pal.trim); R(tx + tw - 2, 11, 1, 4, pal.trim); R(tx + 1, 15, tw - 2, 3, pal.trim); } break;
    case 'barmaid': if (!back) { R(tx + 1, 16, tw - 2, 2, '#e8dfc6'); R(tx + 1, 16, tw - 2, 1, '#c8bf9a'); } break;
  }
}

function roleDetail(R, role, tx, tw, view, sh) {
  const front = view <= 1, back = view >= 3, side = view === 2;
  switch (role) {
    case 'medic': { const ax = side ? 7 : back ? tx - 1 : tx + tw - 1; R(ax, 13, 2, 2, '#f2ead6'); R(ax + (back ? 1 : 0), 13, 1, 2, '#c0302a'); break; } // white armband, red cross
    case 'mechanic': if (back) { R(tx + tw - 3, 16, 1, 3, '#9aa3a8'); R(tx + tw - 4, 16, 3, 1, '#c0c4c8'); } else if (side) R(tx, 16, 1, 3, '#9aa3a8'); break; // spanner in the back pocket
    case 'cook': if (!back) { R(tx + 1, 13, tw - 2, 5, '#f2ead6'); R(tx + 1, 13, tw - 2, 1, '#c8c0b0'); R(side ? 9 : tx + tw, 15, 1, 4, '#9aa3a8'); R(side ? 9 : tx + tw, 19, 2, 1, '#c0c4c8'); } break; // apron, ladle
    case 'lookout': if (!back) { R(tx + 2, 11, 1, 2, '#3a3530'); R(tx + 5, 11, 1, 2, '#3a3530'); R(tx + 2, 13, 2, 2, '#2f2f33'); R(tx + 4, 13, 2, 2, '#2f2f33'); R(tx + 2, 13, 1, 1, '#6a8298'); } break; // binoculars round the neck
    case 'scavenger': if (back) { R(tx + 1, 11, tw - 2, 6, '#5d6b3a'); R(tx + 1, 11, tw - 2, 1, '#7a8a4a'); R(tx + 2, 14, tw - 4, 1, '#3e4a26'); } else if (side) { R(tx - 2, 11, 3, 6, '#5d6b3a'); } else { R(tx + 1, 11, 1, 5, '#3e4a26'); R(tx + tw - 2, 11, 1, 5, '#3e4a26'); } break; // backpack
    case 'fighter': for (let i = 0; i < 7; i++) R(tx + tw - 2 - (back ? 0 : i), 4 + i + (back ? 0 : 0), 1, 1, i < 2 ? '#3a3530' : '#c49a62'); break; // bat over the shoulder
  }
}

// Bloater, 18x24: a walker with the belly pushing the shirt up, veins, a gas-yellow drip. Pulses in idle.
export function drawBloater(ctx, pal, view, frame, pose, outfit, gait = 1) {
  ctx.save(); ctx.translate(1, 0);
  const eyes = drawHuman(ctx, 'bloater', pal, view, frame, pose, outfit, { gait });
  ctx.restore();
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const pulse = frame % 2 === 0 ? 1 : 0, side = view === 2, back = view >= 3;
  const g = ['#b8cc78', '#94b058', '#6a8a3a'];
  // a round swollen belly: widths per row, centred (front) or pushed forward (side)
  const rows = [8, 10, 12, 12, 12, 10, 8].map((w) => w + (w >= 12 ? pulse * 2 : 0));
  rows.forEach((w, i) => {
    const y = 12 + i, x = side ? 8 : 9 - (w >> 1);
    if (y <= 13) { R(x, y, w, 1, i === 0 ? shade(pal.shirt, 0.12) : pal.shirt); return; } // shirt rides up over the top of it
    R(x, y, w, 1, g[1]); R(x, y, 1, 1, g[0]); R(x + w - 2, y, 2, 1, g[2]);
  });
  R(side ? 9 : 5, 14, 3, 1, g[0]); R(side ? 9 : 6, 15, 1, 1, g[0]); // highlight upper left
  R(side ? 8 : 4, 13, side ? 9 : 10, 1, shade(pal.shirt, -0.3)); // ragged shirt hem
  if (!back) { R(side ? 11 : 7, 16, 3, 1, '#5a6a70'); R(side ? 13 : 9, 15, 1, 2, '#5a6a70'); R(side ? 14 : 11, 17, 2, 1, '#5a6a70'); R(side ? 12 : 9, 16, 1, 1, '#4a5a2a'); } // veins, navel
  return eyes.map(([x, y]) => [x + 1, y]);
}

// The big two, 22x28: the Brute (riot cop) and the Butcher. Shield and cleaver are drawn by the renderer.
export function drawBig(ctx, kind, view, frame, pose) {
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const brute = kind === 'brute', side = view === 2, back = view >= 3, front = view <= 1;
  const step = frame % 2 === 1 ? (frame === 1 ? 1 : -1) : 0;
  const charge = pose === 'attack';
  const sk = ramp3('#79b04c', 0.18, -0.3);
  const coat = brute ? ['#3a4458', '#2a3040', '#1c2230'] : ['#f2ead6', '#d8d0c0', '#a89c8a'];
  const legs = brute ? ['#2e3448', '#23283a', '#161a26'] : ['#4a4a52', '#3a3a3e', '#26262a'];
  const boot = brute ? '#15171d' : '#1d1d22';
  const low = brute && charge ? 2 : 0; // shoulder lowered for the charge
  // legs
  const leg = (x, near) => { const c = near ? legs : [legs[1], legs[2], legs[2]]; R(x, 20, 4, 6, c[1]); R(x, 20, 1, 6, c[0]); R(x, 26, 4, 2, boot); R(x, 26, 2, 1, shade(boot, 0.4)); if (brute) { R(x, 22, 4, 2, '#4a5560'); R(x, 22, 4, 1, '#6f8aa0'); } };
  if (side) { leg(10 + step, false); leg(8 - step, true); } else { leg(6, true); leg(12, false); }
  // torso
  const tx = side ? 6 : 4, tw = side ? 10 : 14, ty = 11 + low;
  R(tx, ty, tw, 9 - low, coat[1]); R(tx, ty, 1, 9 - low, coat[0]); R(tx, ty, tw, 1, coat[0]); R(tx + tw - 3, ty + 1, 3, 8 - low, coat[2]);
  if (brute) {
    R(tx, 18, tw, 2, '#1d1d22'); R(tx + 2, 18, 2, 2, '#c0c4c8'); R(tx + tw - 4, 18, 2, 1, '#c0c4c8'); R(tx + tw - 3, 19, 1, 1, '#9aa3a8'); // belt, cuffs
    if (!back) { R(tx + 2, ty + 3, tw - 4, 1, '#4a5560'); R(tx + 3, ty + 3, 4, 1, '#c8c0a8'); } else { R(tx + 3, ty + 2, tw - 6, 2, '#c8c0a8'); }
    R(tx - 2, ty, 3, 3, '#4a5560'); R(tx + tw - 1, ty, 3, 3, '#3a4450'); R(tx - 2, ty, 3, 1, '#6f8aa0'); // shoulder pads
  } else {
    if (!back) { for (let i = 0; i < tw - 4; i += 2) R(tx + 2 + i, ty + 3, 1, 6 - low, '#4d6a9a'); R(tx + 2, ty + 3, tw - 4, 1, '#e8e4d8'); } // striped apron
    R(tx + 1, ty + 5, 3, 2, OLD); R(tx + tw - 5, ty + 2, 2, 3, OLD); R(tx + 4, ty + 7, 2, 1, '#6a1e18');
    R(tx + tw - 2, 18, 1, 3, '#9aa3a8'); R(tx + tw - 3, 21, 2, 1, '#c0c4c8'); // meat hook on the belt
  }
  // arms
  const armC = brute ? coat : [coat[0], coat[1], coat[2]];
  const hand = sk;
  const arm = (x, y, len, stain) => { R(x, y, 3, len, armC[1]); R(x, y, 1, len, armC[0]); if (stain) { R(x, y + len - 4, 3, 4, OLD); R(x + 1, y + len - 3, 1, 1, '#6a1e18'); } R(x, y + len, 3, 2, hand[1]); R(x + 2, y + len + 1, 1, 1, hand[2]); };
  if (!brute && charge) { arm(0, ty - 2, 5, true); arm(19, ty - 2, 5, true); R(1, ty - 4, 2, 2, hand[1]); R(19, ty - 4, 2, 2, hand[1]); } // grab: both arms wide
  else if (side) arm(9 + step, ty + 1, 6, !brute);
  else { arm(tx - 3, ty + 1, 6, !brute); arm(tx + tw, ty + 1 + (frame === 1 ? 1 : 0), 6, !brute); }
  // head
  const hx = side ? 9 + (low ? 2 : 0) : 7, hy = 3 + low;
  R(hx, hy, 8, 8, sk[1]); R(hx, hy, 1, 7, sk[0]); R(hx + 7, hy + 1, 1, 7, sk[2]); R(hx, hy + 7, 8, 1, sk[2]);
  const eyes = [];
  if (brute) {
    R(hx - 1, hy - 1, 10, 6, '#1c2230'); R(hx, hy - 1, 4, 1, '#4a5560');
    if (!back) { R(side ? hx + 4 : hx, hy + 2, side ? 5 : 8, 2, '#6f8aa0'); R(side ? hx + 5 : hx + 1, hy + 2, 2, 1, '#a8c0d0'); }
    else R(hx - 1, hy - 1, 10, 8, '#1c2230');
  } else {
    R(hx, hy, 8, 2, '#5a4a3a'); if (back) R(hx, hy, 8, 6, '#5a4a3a');
    R(hx - 1, hy - 1, 10, 2, '#f2ead6'); // white cap
  }
  if (!back) {
    const ex = side ? [[hx + 6, hy + 4]] : [[hx + 2, hy + 4], [hx + 5, hy + 4]];
    for (const [x, y] of ex) { R(x, y, 1, 1, SOCKET); eyes.push([x, y]); }
    R(side ? hx + 5 : hx + 3, hy + 6, 2, 1, GAP);
  }
  return eyes;
}

// Crawler, 16x12 facing east: legless torso dragging on its arms, vertebrae showing, 4-frame claw.
export function drawCrawler(ctx, pal, frame, outfit = 0) {
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const sk = ramp3(pal.skin, 0.18, -0.3), sh = ramp3(pal.shirt, 0.16, -0.28);
  const f = frame % 4;
  R(1, 7, 3, 3, shade(pal.pants, -0.1)); R(1, 7, 3, 1, pal.pants); R(0, 8, 1, 2, FRESH); R(0, 9, 2, 1, OLD); // ragged stump
  R(3, 6, 7, 4, sh[1]); R(3, 6, 7, 1, sh[0]); R(3, 9, 7, 1, sh[2]); R(4, 8, 6, 1, pal.trim);
  R(4, 6, 3, 1, sk[1]); for (const x of [4, 6, 8]) R(x, 5, 1, 1, '#d8d0b8'); // torn back, vertebrae
  R(6, 7, 1, 1, OLD);
  // head
  R(10, 5, 5, 5, sk[1]); R(10, 5, 5, 1, pal.hair); R(10, 6, 1, 3, sk[0]); R(14, 6, 1, 4, sk[2]);
  R(13, 7, 1, 1, SOCKET); R(13, 9, 2, 1, GAP);
  // arms: near arm reaches, plants, pulls, lifts; far arm opposite
  const reach = [[13, 10, 3], [12, 10, 2], [10, 10, 1], [12, 9, 2]][f], farR = [[10, 10, 1], [12, 9, 2], [13, 10, 3], [12, 10, 2]][f];
  R(9, farR[1], farR[2] + 2, 1, sh[2]); R(9 + farR[2] + 2, farR[1], 1, 1, sk[2]);
  R(9, reach[1], reach[2] + 2, 1, sh[1]); R(9 + reach[2] + 2, reach[1], 2, 1, sk[1]); R(9 + reach[2] + 2, reach[1] + 1, 1, 1, sk[2]);
  return [[13, 7]];
}

// Infected dog, 18x12 facing east (leader 20x13): mangy, ribs showing, patchy fur, a torn ear, red eyes.
export function drawDog(ctx, frame, pose, leader = false) {
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const fur = leader ? ['#5a4c3e', '#4a3e32', '#2b231c'] : ['#7e6c58', '#6b5a48', '#4a3e32'];
  const bald = '#a89088', s = leader ? 1 : 0;
  const lunge = pose === 'attack' ? 2 : 0;
  const f = frame % 4, off = [[0, 1], [1, 0], [0, -1], [-1, 0]][f];
  // tail
  R(0, 3 + s, 3, 1, fur[2]); R(0, 2 + s, 1, 1, fur[1]);
  // body
  R(3, 4 + s, 10 + s + lunge, 4, fur[1]); R(3, 4 + s, 10 + s + lunge, 1, fur[0]); R(4, 7 + s, 8 + s + lunge, 1, fur[2]);
  for (const x of [6, 8, 10]) R(x + (lunge >> 1), 5 + s, 1, 2, fur[2]); // ribs
  R(5, 5 + s, 2, 1, bald); R(11 + lunge, 6 + s, 2, 1, bald); // bald patches
  // head
  const hx = 12 + lunge + s;
  R(hx, 2 + s, 4, 4, fur[1]); R(hx, 2 + s, 4, 1, fur[0]); R(hx + 3, 4 + s, 2 + (lunge ? 1 : 0), 2, fur[2]); // snout
  R(hx + 1, 1 + s, 1, 1, fur[2]); R(hx + 2, s, 1, 1, fur[2]); // ear, torn: a notch
  R(hx + 2, 3 + s, 1, 1, '#e03a2a');
  if (lunge) { R(hx + 3, 6 + s, 3, 1, '#2a1612'); R(hx + 4, 5 + s, 1, 1, '#e8e4d8'); } // jaws open
  if (leader) { R(hx, 3 + s, 3, 1, '#c86048'); R(hx + 1, 2 + s, 1, 1, '#c86048'); R(hx - 1, 5 + s, 2, 1, '#b5503b'); R(hx - 1, 6 + s, 1, 2, '#c9a24a'); } // scar, collar, tag
  // legs (lunge: fully stretched)
  const ly = 8 + s, lh = 3 + s;
  if (lunge) { R(1, ly - 1, 2, 1, fur[2]); R(3, ly, 1, lh - 1, fur[1]); R(hx + 2, ly, 2, 1, fur[1]); R(hx + 4, ly - 1, 1, 2, fur[2]); }
  else { R(4 + off[0], ly, 1, lh, fur[2]); R(6 - off[0], ly, 1, lh, fur[1]); R(10 + off[1], ly, 1, lh, fur[2]); R(12 - off[1], ly, 1, lh, fur[1]); }
  return [[hx + 2, 3 + s]];
}

// Biscuit, 14x10 facing east: scruffy wire-haired terrier, wheaten with a darker saddle, red collar, brass tag.
export function drawBiscuit(ctx, frame, pose) {
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const W = ['#dcc08a', '#c8a46a', '#a8844e'], saddle = '#8a6a40', dark = '#5a4028';
  if (pose === 'down') { // on his side, legs out, eye shut
    R(1, 5, 10, 3, W[1]); R(1, 5, 10, 1, W[0]); R(3, 5, 5, 1, saddle); R(10, 4, 3, 3, W[1]); R(12, 5, 1, 1, '#2b1d16'); R(11, 4, 1, 1, dark);
    for (const x of [2, 4, 7, 9]) R(x, 8, 1, 2, W[2]); R(0, 6, 1, 1, W[2]); R(9, 6, 1, 2, '#c0302a'); R(9, 7, 1, 1, '#e2c060');
    return [[11, 5]];
  }
  const bite = pose === 'attack', pin = pose === 'pin', f = frame % 4, wag = frame % 2;
  // tail up, wagging
  R(0, 1 + wag, 1, 2, W[1]); R(1, 3, 1, 1, W[1]);
  // body
  R(2, 3, 8, 4, W[1]); R(2, 3, 8, 1, W[0]); R(3, 3, 5, 2, saddle); R(4, 3, 1, 1, shade(saddle, 0.2)); R(2, 6, 8, 1, W[2]);
  for (const x of [3, 6, 8]) R(x, 7 - 1, 1, 1, W[0]); // wiry belly fringe
  // head
  const hx = 9 + (bite ? 1 : 0), hy = pin ? 0 : 1;
  R(hx, hy + 1, 4, 4, W[1]); R(hx, hy + 1, 4, 1, W[0]); R(hx + 3, hy + 3, 2, 2, W[0]); R(hx + 4, hy + 3, 1, 1, '#2b1d16'); // muzzle, nose
  R(hx + 3, hy + 5, 2, 1, W[2]); // beard
  if (bite) { R(hx, hy + 1, 2, 1, dark); R(hx + 3, hy + 5, 2, 1, '#2a1612'); } // ears back, jaws open
  else { R(hx, hy, 1, 1, dark); R(hx + 2, hy, 1, 1, dark); } // ears up
  R(hx + 2, hy + 2, 1, 1, '#2b1d16'); R(hx + 1, hy + 2, 1, 1, W[0]);
  R(hx - 1, hy + 4, 2, 1, '#c0302a'); R(hx, hy + 5, 1, 1, '#e2c060'); // collar, tag
  // legs
  const off = [[0, 1], [1, 0], [0, -1], [-1, 0]][f];
  if (pin) { R(hx + 2, 4, 3, 1, W[1]); R(hx + 4, 4, 1, 1, W[2]); R(3, 7, 1, 3, W[2]); R(5, 7, 1, 3, W[1]); }
  else { R(3 + off[0], 7, 1, 3, W[2]); R(5 - off[0], 7, 1, 3, W[1]); R(8 + off[1], 7, 1, 3, W[2]); R(10 - off[1], 7, 1, 3, W[1]); }
  return [[hx + 2, hy + 2]];
}

// Corpse, 16x10 facing east (dog 18x8). mode: 'n' normal, 'char' burnt, 'gas' yellow residue, 'gore' pieces.
// pose (VA-7): 0 sprawled with one arm flung out, 1 curled on its side, 2 face down, spread-eagled.
export function drawCorpse(ctx, kind, pal, mode, pose = 0) {
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  if (mode === 'gore') {
    const bits = [[2, 5, 3, 2, pal.shirt], [7, 3, 2, 2, pal.skin], [10, 6, 3, 2, pal.pants], [5, 7, 2, 1, FRESH], [12, 2, 2, 2, pal.skin], [1, 2, 2, 1, OLD], [8, 7, 2, 1, '#6a1e18']];
    for (const b of bits) R(...b);
    return;
  }
  if (kind === 'dog') { R(1, 3, 12, 3, '#6b5a48'); R(1, 3, 12, 1, '#7e6c58'); R(12, 2, 4, 3, '#6b5a48'); R(14, 3, 1, 1, SOCKET); for (const x of [3, 5, 9, 11]) R(x, 6, 1, 2, '#4a3e32'); }
  else {
    const sk = ramp3(pal.skin, 0.15, -0.3), sh = ramp3(pal.shirt, 0.15, -0.3);
    const boots = pal.boots || '#2f2a26';
    if (pose === 1) { // curled: knees drawn up, arms round the head
      R(2, 2, 3, 2, pal.pants); R(2, 4, 4, 2, shade(pal.pants, -0.15)); R(1, 2, 1, 2, boots); R(1, 5, 2, 1, boots); R(5, 6, 2, 1, shade(pal.pants, -0.3)); // folded legs
      R(6, 3, 5, 4, sh[1]); R(6, 3, 5, 1, sh[0]); R(6, 6, 5, 1, sh[2]); R(8, 4, 1, 2, OLD); // torso
      R(11, 4, 4, 4, sk[1]); R(11, 4, 4, 1, pal.hair); R(14, 5, 1, 3, sk[2]); R(13, 6, 1, 1, SOCKET); // head
      R(10, 2, 4, 2, sh[1]); R(13, 2, 2, 1, sk[1]); R(10, 8, 3, 1, sh[2]); R(12, 8, 1, 1, sk[2]); // arms over the head
    } else if (pose === 2) { // face down, spread-eagled: no face, the back of the head, limbs splayed
      R(0, 1, 4, 2, pal.pants); R(0, 7, 4, 2, pal.pants); R(0, 1, 1, 2, boots); R(0, 7, 1, 2, boots); R(3, 3, 2, 4, shade(pal.pants, -0.2)); // legs apart
      R(5, 3, 6, 4, sh[1]); R(5, 3, 6, 1, sh[0]); R(5, 6, 6, 1, sh[2]); R(8, 3, 1, 4, sh[2]); R(6, 5, 2, 1, OLD); // back of the shirt
      R(11, 3, 4, 4, pal.hair); R(11, 3, 4, 1, shade(pal.hair, 0.25)); R(14, 4, 1, 3, sk[2]); // the back of the head
      R(10, 0, 2, 3, sh[1]); R(12, 0, 2, 1, sk[1]); R(10, 7, 2, 3, sh[2]); R(12, 9, 2, 1, sk[2]); // both arms flung forward
    } else {
      R(0, 4, 5, 2, pal.pants); R(0, 6, 4, 1, shade(pal.pants, -0.3)); R(0, 4, 1, 3, boots); // legs
      R(5, 3, 6, 4, sh[1]); R(5, 3, 6, 1, sh[0]); R(5, 6, 6, 1, sh[2]); R(7, 4, 2, 1, OLD); // torso
      R(11, 3, 4, 4, sk[1]); R(11, 3, 4, 1, pal.hair); R(14, 4, 1, 3, sk[2]); R(13, 5, 1, 1, SOCKET); // head
      R(8, 0, 2, 3, sh[1]); R(8, 0, 2, 1, sk[1]); // outflung arm
      R(6, 7, 2, 2, sh[2]); R(6, 9, 2, 1, sk[2]); // other arm
    }
  }
  if (mode === 'char') { ctx.globalCompositeOperation = 'source-atop'; R(0, 0, 16, 10, 'rgba(43,29,22,0.82)'); ctx.globalCompositeOperation = 'source-over'; R(4, 3, 1, 1, '#e05a20'); R(10, 5, 1, 1, '#8a2a10'); }
  if (mode === 'gas') { ctx.globalCompositeOperation = 'source-atop'; R(0, 0, 16, 10, 'rgba(184,196,58,0.4)'); ctx.globalCompositeOperation = 'source-over'; R(3, 8, 3, 1, '#b8c43a'); R(11, 1, 2, 1, '#d8e05a'); }
}

function mix(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = (s) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return '#' + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1);
}
