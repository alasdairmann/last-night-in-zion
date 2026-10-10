# Last Night in Zion

**▶ Play it in your browser: https://alasdairmann.github.io/last-night-in-zion/**

No download or install. It runs in desktop and mobile browsers. Play with the keyboard, or by touch on a phone or tablet held in landscape (add it to your home screen for fullscreen).

## Premise

For a year Cain and his partner lived in Zion in total silence, because the dead hunt by sound. Tonight his partner shot themself. The shot woke the town, and every noise since has brought more of the dead in from the fields and woods.

This is Cain's last night in Zion, a small English-American town about a year after the outbreak. It's a prequel to *Project Enoch*.

## Genre

Single-player, top-down, round-based horde survival in chunky pixel art. It plays like Call of Duty Zombies with a *Walking Dead* tone: grounded, improvised and quiet. Gunfire is loud and ammo is rare, so melee weapons do most of the work.

## Goal

Survive as many rounds as you can. Each round brings more of the dead. Kill them for **Scrap**, then spend it to:

- buy weapons and ammo
- repair barricades
- open doors into more of the town
- start the generator
- buy comforts and workshop upgrades

The rounds never end. Your score is how long you last.

## Running it locally

Vanilla JavaScript ES modules, HTML5 canvas and Web Audio. No dependencies and no build step.

```
npm start        # http://localhost:4174
npm test         # simulation acceptance tests (PRD §31)
npm run sim      # headless balance bot over many seeds (PRD §29)
node scripts/runlog-report.js   # summarise the newest run log in logs/ (PRD-v1.2 §A1)
```

Add `?debug` to the URL for the developer keys: `` ` `` overlay, F2 spawns/zones, F5 god mode, F6 +10,000 Scrap,
F7 kill all, F8 skip to a round, F9 spawn an enemy, F10 spawn a find, F11 open every door and start the generator,
F12 download the seed and input log. `?seed=N` fixes the run seed. `?layout=desktop|tablet|mobile` forces a layout and `?touch=1` forces the touch controls on.

`node scripts/shots.js` screenshots fixed game states with headless Chrome and diffs Desktop against `tests/baseline/` (`--update` retakes them; `--layout mobile` or `--layout tablet` shoots those layouts).

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
