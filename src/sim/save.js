// Save / load a run (v1.1 feedback). The simulation is plain data, so a snapshot is a graph walk that keeps
// shared references (an enemy's barricade, the weapon on the workshop bench), Sets, Maps, typed arrays and Infinity.
// The static map and lazily-built caches are rebuilt rather than stored.
import { Game } from './game.js';
import { RNG } from '../rng.js';

const SKIP = new Set(['map', 'events', 'lureFields', 'prompt', 'field', 'queue', 'walk', 'opts']);
const TYPED = { Uint8Array, Uint16Array, Int32Array, Int8Array, Float32Array };

export function snapshot(g, meta = {}) {
  const ids = new Map(); let next = 1;
  const enc = (v, depth) => {
    if (v === null || v === undefined) return v === undefined ? { $u: 1 } : null;
    const t = typeof v;
    if (t === 'number') return Number.isFinite(v) ? v : { $n: String(v) };
    if (t === 'string' || t === 'boolean') return v;
    if (t === 'function') return { $u: 1 };
    if (ids.has(v)) return { $r: ids.get(v) };
    const id = next++; ids.set(v, id);
    for (const [k, C] of Object.entries(TYPED)) if (v instanceof C) return { $i: id, $ta: k, d: Array.from(v) };
    if (v instanceof Set) return { $i: id, $s: [...v].map((x) => enc(x, depth + 1)) };
    if (v instanceof Map) return { $i: id, $m: [...v].map(([a, b]) => [enc(a, depth + 1), enc(b, depth + 1)]) };
    if (Array.isArray(v)) return { $i: id, $a: v.map((x) => enc(x, depth + 1)) };
    const o = { $i: id, $o: {} };
    if (v instanceof RNG) o.$c = 'RNG';
    for (const k of Object.keys(v)) { if (depth === 0 && SKIP.has(k)) continue; o.$o[k] = enc(v[k], depth + 1); }
    return o;
  };
  return JSON.stringify({ v: 1, meta, seed: g.seed, data: enc(g, 0) });
}

export function restore(json, opts = {}) {
  const s = JSON.parse(json);
  const g = new Game({ seed: s.seed, ...opts });
  const objs = new Map(); const fix = [];
  const dec = (v) => {
    if (v === null || typeof v !== 'object') return v;
    if (v.$u) return undefined;
    if (v.$n) return Number(v.$n);
    if (v.$r !== undefined) { if (objs.has(v.$r)) return objs.get(v.$r); const box = { ref: v.$r }; fix.push(box); return box; }
    if (v.$ta) { const a = new TYPED[v.$ta](v.d); objs.set(v.$i, a); return a; }
    if (v.$s) { const set = new Set(); objs.set(v.$i, set); for (const x of v.$s) set.add(dec(x)); return set; }
    if (v.$m) { const m = new Map(); objs.set(v.$i, m); for (const [a, b] of v.$m) m.set(dec(a), dec(b)); return m; }
    if (v.$a) { const a = []; objs.set(v.$i, a); for (const x of v.$a) a.push(dec(x)); return a; }
    const o = v.$c === 'RNG' ? new RNG(1) : {}; objs.set(v.$i, o);
    for (const [k, x] of Object.entries(v.$o)) o[k] = dec(x);
    return o;
  };
  const root = dec(s.data);
  // forward references (rare): patch any placeholder boxes
  const patch = (o, seen = new Set()) => {
    if (!o || typeof o !== 'object' || seen.has(o)) return; seen.add(o);
    if (o instanceof Set || ArrayBuffer.isView(o)) return;
    for (const k of Object.keys(o)) { const x = o[k]; if (x && typeof x === 'object' && x.ref !== undefined && Object.keys(x).length === 1 && fix.includes(x)) o[k] = objs.get(x.ref); else patch(x, seen); }
  };
  if (fix.length) patch(root);
  for (const [k, v] of Object.entries(root)) g[k] = v;
  // v1.4 C1: saves from before soft props had them as hard
  for (let i = 0; i < g.tiles.length; i++) if (g.map.tiles[i] === 7 && g.tiles[i] === 4) g.tiles[i] = 7;
  g.wrecks ||= [];
  g.refreshWalk(); g.fieldTile = -1; g.events = [];
  return { game: g, meta: s.meta };
}
