// Touch input merging (Mobile & Touch PRD, technical requirements): touch only ever produces ordinary input,
// so a run driven by merged keyboard + touch input replays exactly from its input log.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, emptyInput } from '../src/sim/game.js';
import { mergeInput } from '../src/touch.js';

const inp = (o = {}) => ({ ...emptyInput(), ...o });

test('mergeInput ORs held flags and latched presses, and takes a slot from either side', () => {
  const m = mergeInput(inp({ up: true, attack: false }), inp({ attack: true, shove: true, slot: 3 }));
  assert.equal(m.up, true); assert.equal(m.attack, true); assert.equal(m.shove, true); assert.equal(m.slot, 3);
  assert.deepEqual(mergeInput(inp(), inp()), inp());
  assert.deepEqual(Object.keys(mergeInput(inp(), inp())).sort(), Object.keys(emptyInput()).sort());
});

test('a run on merged keyboard + touch input replays identically', () => {
  const script = [];
  for (let i = 0; i < 1800; i++) {
    const kb = inp({ up: i % 200 < 60, attack: i % 50 < 4 });
    const tc = inp({ right: i % 300 > 150, shift: i % 120 < 30, shove: i % 97 === 0, slot: i % 400 === 0 ? 2 : 0, interact: i % 500 > 450 });
    script.push(mergeInput(kb, tc));
  }
  const run = () => { const g = new Game({ seed: 4242, hitStop: false }); g.debugSkipTo?.(2); for (const s of script) g.step({ ...s }); return JSON.stringify({ x: g.p.x, y: g.p.y, hp: g.p.hp, scrap: g.scrap, kills: g.stats.kills, round: g.round, enemies: g.enemies.length, t: g.t }); };
  assert.equal(run(), run());
});
