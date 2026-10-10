# Enoch Nights

Single-player, top-down, round-based horde survival, played on the keyboard. Built from `PRD.md`.
Vanilla JavaScript ES modules, HTML5 canvas, Web Audio. No dependencies and no build step.

```
npm start        # http://localhost:4174
npm test         # simulation acceptance tests (PRD §31)
npm run sim      # headless balance bot over many seeds (PRD §29)
node scripts/runlog-report.js   # summarise the newest run log in logs/ (PRD-v1.2 §A1)
```

Add `?debug` to the URL for the developer keys: `` ` `` overlay, F2 spawns/zones, F5 god mode, F6 +10,000 Scrap,
F7 kill all, F8 skip to a round, F9 spawn an enemy, F10 spawn a find, F11 open every door and start the generator,
F12 download the seed and input log. `?seed=N` fixes the run seed.

## Layout
| Path | What |
|---|---|
| `src/tuning.js` | Every gameplay number (§28) |
| `src/data.js` | Weapons, comforts, finds, crate weights, upgrade names, barks |
| `src/map/town.js` | The town: 9 zones, 12 doors, 28 barricades, racks, comforts, traps, props |
| `src/sim/game.js` | Pure, deterministic simulation. Emits events, never touches the DOM |
| `src/nav.js` | Flow-field pathfinding |
| `src/render/` | Static town art, procedural sprites, renderer and lighting, HUD |
| `src/audio/audio.js` | Synthesised SFX and the three-layer music |
| `src/ui/menus.js` | Menus, settings, key remapping, game over |
