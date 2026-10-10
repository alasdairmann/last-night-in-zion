// Places of interest on the town map (feedback: hover tooltips on the HUD map, and a map in the Enochpedia).
// One list feeds both, so the two can never disagree. Everything is built from the live game and data tables.
import { T } from '../tuning.js';
import { COMFORTS, TRAP_INFO, MELEE, GUNS, THROWS, itemValue } from '../data.js';
import { itemName } from '../sim/game.js';
import { FLOOR, WALL, BLD, DOOR, BAR, PROP, SOFT, G, STREETS } from '../map/town.js';

const n = (v) => Number(v).toLocaleString('en-GB');
const first = (s) => s.split('. ')[0].replace(/\.$/, '');

// { icon, x, y (world px), title, body, size (icon scale; 0 = no icon, tile colour carries it) }
// all = true lists every spot whether or not it is unlocked yet (the Enochpedia map)
export function mapPOIs(g, all = false) {
  const m = g.map, out = [];
  const add = (icon, x, y, title, body, size = 1) => out.push({ icon, x, y, title, body, size });
  for (const s of m.comfortSpots) { const c = COMFORTS[s.id]; add(s.id, s.px, s.py, `${c.name} (${n(c.cost)})`, c.desc); }
  add('power', m.generator.px, m.generator.py, 'Generator', 'Start it: lights, comforts, traps');
  add('hammer', g.workshop.px, g.workshop.py, 'Workshop', 'Upgrades the weapon you hold');
  for (const c of g.crates) if (all || c.active) add('closed', c.px, c.py, 'Trader\'s crate', all ? 'She moves between four spots' : `Random weapon, ${n(g.cratePrice())} Scrap`);
  add('pub', m.pub.door.x, m.pub.door.y - 30, 'The Red Lion', !g.pubDoorFixed ? 'The door is broken. Fix it to get in' : g.pubShut ? 'Safe house. Door BOLTED' : 'Safe house. Hold F at the door to bolt it');
  for (const b of g.benches()) if (all || g.openZones.has(b.zone)) add('bench', b.spot.px, b.spot.py, b.name, b.does);
  if (all || g.openZones.has(5)) add('k_penny', m.spots.jukebox.px, m.spots.jukebox.py, 'Jukebox', 'Keepsakes, one a wave');
  add('board', m.spots.noticeboard.px, m.spots.noticeboard.py, 'Noticeboard', 'Errands, trials, bounties');
  if (g.hatches) for (const h of g.hatches) if (all || g.openZones.has(h.zone)) add('hatch', h.x, h.y, `Cellar hatch: ${h.name}`, h.fixed ? 'Hold F to drop into the cellars; arrows pick the exit' : 'Broken. Fix it to link it to the cellars', 0.6);
  if (g.switchboardSpot && (all || g.switchboardOn())) { const sb = g.switchboardSpot(); add('switch', sb.x, sb.y, 'Switchboard', 'Arm wired traps and fire the bell, light and alarm', 0.6); }
  add('case', m.vault[0].px, m.vault[0].py, 'Town safe', `Bank Scrap, ${T.bank.interest * 100}% a wave`);
  add('ammo', m.ammoCrate.px, m.ammoCrate.py, 'Ammo crate', '+50% reserves, once a wave');
  add('mule', m.secondWind.px, m.secondWind.py, 'Second Wind', 'Get back up once');
  if (all || g.escape.unlocked) add('engine', m.engine.px, m.engine.py, 'Fire engine', 'Your way out of Zion');
  for (const r of m.racks) {
    const v = itemValue(r.item), kind = r.item.startsWith('t:') ? 'Throwable' : MELEE[r.item] ? 'Melee' : GUNS[r.item] ? 'Gun' : 'Weapon';
    add(r.item.replace('t:', ''), r.px, r.py, itemName(r.item), `${kind}, ${n(v)} Scrap`, 0.5);
  }
  for (const t of m.traps) add('bomb', t.px, t.py, `${t.name} (${n(t.cost)})`, first(TRAP_INFO[t.kind]), 0.5);
  // v1.4 H1: ladders up to the roofs, and the Red Lion stash
  for (const [k, t, b] of [['church_ladder', 'Church tower ladder', 'Up to the bell tower and the beacon'], ['fire_ladder', 'Fire station ladder', 'Up to the beacon'], ['school_mast', 'School roof ladder', 'Up to the radio mast']]) { const s = m.spots[k]; if (all || g.openZones.has(s.zone)) add('ladder', s.px, s.py, t, b, 0.6); }
  if (all || (g.stash && g.stash.length)) add('stash', m.spots.pub_bar.px, m.spots.pub_bar.py, 'The stash', g.stash && g.stash.length ? `${g.stash.length} gun${g.stash.length === 1 ? '' : 's'} waiting behind the bar` : 'Guns with no free slot wait here', 0.6);
  for (const d of g.doors) if (all || !d.open) add(null, d.x, d.y, d.name, `${n(d.cost)} Scrap to clear`, 0);
  for (const b of g.barricades) add(null, b.x, b.y, 'Barricade', 'Walkers break in here. Repair for Scrap', 0);
  return out;
}

// v1.4 H1: one painter for the town map (the held map and the Zionpedia map). Roads look like roads with their names
// along them; buildings are coloured by type; only hard props show (soft ones are left off); closed zones are dimmed.
const KIND_COL = { pub: '#9a4a36', church: '#7c7c90', school: '#9a8448', shop: '#6e5a80', house: '#6a5444', fire: '#a8382c', garage: '#5a6e78', post: '#8a6038', pharmacy: '#3a8070', cabin: '#8c8c80' };
export function paintTownMap(m, g, k, all = false) {
  const W = g.W, H = g.H, bk = new Map();
  for (const b of g.map.buildings) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) bk.set(y * W + x, b.kind);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, t = g.tiles[i], gr = g.map.ground[i], open = all || g.openZones.has(g.map.zoneId[i]);
    let col = '#0e120e';
    if (t === FLOOR || t === SOFT) col = gr === G.ROAD || gr === G.BYPASS ? (open ? '#5c5e62' : '#34363a') : gr === G.PAVE || gr === G.TARMAC ? (open ? '#76705e' : '#3e3c34') : gr === G.FLOORBOARD ? '#7a5434' : open ? '#4e6240' : '#26302a';
    else if (t === BLD) col = KIND_COL[bk.get(i)] || '#5a4640';
    else if (t === WALL) col = '#1a1612'; else if (t === PROP) col = '#2e2a24'; else if (t === BAR) col = '#c49a62'; else if (t === DOOR) col = '#f0b030';
    else if (gr === G.BYPASS) col = '#3a3c40';
    m.fillStyle = col; m.fillRect(x * k, y * k, k, k);
  }
  // the dashed centre line, so roads read as roads
  m.fillStyle = 'rgba(232,222,190,0.55)';
  for (const s of STREETS) {
    if (s.v) { const cx = ((s.x0 + s.x1 + 1) / 2) * k; for (let y = s.y0 * k; y < (s.y1 + 1) * k; y += k * 2) m.fillRect(Math.round(cx) - 0.5, y, 1, k); }
    else { const cy = ((s.y0 + s.y1 + 1) / 2) * k; for (let x = s.x0 * k; x < (s.x1 + 1) * k; x += k * 2) m.fillRect(x, Math.round(cy) - 0.5, k, 1); }
  }
}
// street names along each street, repeated along long ones; the highlighted street gets a pulse behind it
export function paintStreetNames(c, ox, oy, k, size, highlight = null, pulse = 0) {
  for (const s of STREETS) {
    const x0 = ox + s.x0 * k, y0 = oy + s.y0 * k, w = (s.x1 - s.x0 + 1) * k, h = (s.y1 - s.y0 + 1) * k;
    if (highlight === s.name) { c.fillStyle = `rgba(226,181,60,${0.25 + 0.25 * pulse})`; c.fillRect(x0 - 1, y0 - 1, w + 2, h + 2); }
    c.font = `900 ${size}px Nunito, "Trebuchet MS", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const len = s.v ? h : w, tw = c.measureText(s.name).width, reps = Math.max(1, Math.floor(len / (tw * 3.2)));
    for (let r = 0; r < reps; r++) {
      const f = (r + 0.5) / reps;
      c.save();
      if (s.v) { c.translate(x0 + w / 2, y0 + h * f); c.rotate(-Math.PI / 2); } else c.translate(x0 + w * f, y0 + h / 2);
      c.fillStyle = '#1d1410'; c.fillText(s.name, 0.6, 0.6); c.fillStyle = '#ece4cc'; c.fillText(s.name, 0, 0);
      c.restore();
    }
  }
}
