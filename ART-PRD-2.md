# Last Night in Zion: art PRD 2 (follow-ups and variety pass)

| | |
|---|---|
| **Version** | Art 1.1 |
| **Date** | 2026-10-10 |
| **Builds on** | `ART-PRD.md` (Art 1.0, phases 0-9 done) |
| **Status** | DN and GP implemented; FL decided against; VA proposed |

Four items: damage numbers (DN), walker gait and posture (GP), interior floors (FL), and an audit of visual repetition with proposals (VA). The simulation (`src/sim/`) must still not change.

---

## DN. Damage numbers

### Reference: Vampire Survivors
Not much has been written about how Vampire Survivors draws its numbers. What can be confirmed, plus what anyone sees playing it:
- **One toggle.** Damage Numbers is a single Gameplay on/off option. There's no size or style setting ([wiki: Options](https://vampire.survivors.wiki/w/Options)).
- **Pixel type.** Numbers use the same crisp bitmap font as the rest of the UI ([font notes](https://madegooddesigns.com/vampire-survivors-font/)).
- **Small, white, short-lived.** Each number is small, white and outlined. It appears on the enemy, drifts up a few pixels and fades in about half a second. It never grows or bounces, and it carries no extra colour coding.
- **Slight jitter.** The shown value is reportedly jittered by about ±5 so stacked hits don't print identical numbers ([Steam thread](https://steamcommunity.com/app/1794680/discussions/0/3194745319522730122)).
- **Why players keep them on or off.** Players keep them on for the feeling of doing damage and turn them off when the screen gets busy ([Steam thread](https://steamcommunity.com/app/1794680/discussions/0/3470612993483101082/)). The Castle Survivor developer cut clutter by making numbers smaller, more muted and faster to fade ([devlog](https://indieben.itch.io/castle-survivor/devlog/661003/improved-some-animations-and-visual-effects)).

**What makes it satisfying but out of the way:** each number is small, appears exactly where the hit landed, and is gone before the next swing. Volume does the work, not size. You never read a single number; you feel the stream.

### Spec (implemented)
| Rule | Value |
|---|---|
| **Source** | The renderer reads hp drops per enemy each frame (`Renderer.trackDamage`), so the sim is untouched. A kill adds the enemy's last remaining hp, so the killing blow shows. |
| **Merging** | All damage to one enemy within 0.12 s becomes one number. This covers cleaves, shotgun pellets and fire ticks, so it stays one number per enemy per swing, not a column. |
| **Look** | The 3x5 pixel font at 1x (native), with a 1 px `#1d1410` outline on 4 sides. Normal hits are muted cream `#c8c0ac`. The killing blow is bright `#f2ead6`. Crits and headshots are gold `#f0b030` (the `hit` event's `crit`/`head`, matched by position). No size changes. |
| **Motion** | Spawns at head height (+6 px for the Brute and Butcher) with ±4 px x jitter. Pops 1 px on the first frame, rises 10 px with a cubic ease-out over the first 60%, drifts ±3 px sideways, fades over the last 30%. Total life 0.5 s. |
| **Readability** | Drawn after the lighting pass, so numbers stay readable at night. |
| **Clutter limits** | At most 40 numbers live (the oldest drop). Numbers over Cain's body go to 40% alpha. Values under 1 are never shown. Enemies only: no numbers for Cain, survivors or Biscuit. |
| **Option** | `settings.damageNumbers` (default on), with a new "Damage numbers" toggle next to "Scrap pop-ups". |
| **Scrap pops** | Small spinning bolts burst from the kill alongside the existing HUD "+N" pop-up. |

**Not copied:** the ±5 jitter. Merging already stops identical stacks, and exact values help when comparing weapons at the workshop.

---

## GP. Walker gait and posture (implemented)
Walkers spawn at three speeds (`tuning.js` `types.speeds` = 30 / 45 / 60). The tier is now visible in the sprite, so the player can read a threat from posture alone.

| Tier | Speed | Posture |
|---|---|---|
| 0 slow | < 38 | Deep hunch, with the head sunk 1-2 px into the shoulders and pushed forward in side view. Arms dangle: in side view the arm hangs straight down and swings; from the front the hands hang 1 px lower. Short, dragging steps, and the head dips on both step frames (a heavier lurch). |
| 1 standard | 38-53 | The 1.0 shamble: a 1 px hunch, arms level and reaching, one arm a pixel lower. |
| 2 fast | ≥ 53 | Upright and leaning in (2 px in side view, 1 px in diagonals). Arms reach 1 px higher and 1 px longer. A 2 px stride. |

- **Applies to:** walkers, tangled, and bloaters (always tier 0 at speed 25). Runners keep their own sprint pose. Screamers and the big types are unchanged.
- **How it's wired:** the renderer picks the tier from `e.speed` and passes it as a kind suffix (`walker:g0`), so each tier is its own cached sprite. That's 3x the walker cache, still well under a megabyte.
- **Check it:** `sprites.html?k=walker:g0@3,walker:g1@3,walker:g2@3`.

---

## FL. Interior floors (decided: not implementing)
- **Where floors appear:** the only walkable interior is the Red Lion (37 `FLOORBOARD` tiles). The cut-away room draws its own boards over them. No other building has a walkable inside, so lino, tiles or concrete would only appear in places the player never stands.
- **Is it repetitive?** Mildly. The boards alternate in regular stripes with butt joints every 27 px. The fix is variety within one material, not new materials (see VA-8).
- **When to revisit:** if a level adds walkable shop interiors (the butcher's, the pharmacy, the garage), add the floor types then, together with that content.

---

## VA. Repetition audit
**Rule.** Anything the player acts on (racks, comfort signs, doors, barricades, traps, crates, finds, pickups) stays consistent so it's recognisable. Everything else should vary.

Ranked by how often the player sees it:

| # | What repeats | Why it matters | Proposal | Cost |
|---|---|---|---|---|
| VA-1 | **Walkers in the same outfit are identical.** Skin tone, hair, tears and the blood stain are all seeded by outfit, so all hi-vis walkers are clones. | 30-150 on screen at once, so clones are the most visible repetition in the game. | Add a per-enemy look seed (`e.id % 4`) to the sprite key, so 12 outfits x 4 = 48 looks. The seed varies skin within the dead ramp, hair colour and length (bald, long, matted), tear and stain positions, and one injury (a missing ear, a bitten forearm, a jaw hanging lower, a missing shoe). Silhouettes stay unchanged, so type recognition holds. | Small. Renderer only; cache x4. |
| VA-2 | **Lawns.** 57% of tiles are grass, and blocks are open green rectangles. | The town reads as a grid of empty lawns between buildings. | Per block, scatter (seeded): long-grass clumps, molehills, a garden plot, a fallen bin, a washing line with clothes, abandoned toys, a dead fox, a tyre swing in a tree. Add worn desire paths from each door to the road, and 1-3 trees inside blocks, not only in the woods ring. Keep collision-free decor away from walk lines. | Medium. `mapart.js` decor pass. |
| VA-3 | **Brick walls.** Every block is ringed by the same capped brick wall. | Long identical runs on every screen. | Give each block edge its own boundary: brick, stone, iron railings, a hedge, a picket fence, a low wall with railings. Inside a run, add a collapsed section (rubble, gap filled with pallets), a gate, posters or a missing-person flyer, ivy runs. Keep the collision footprint. | Medium. |
| VA-4 | **Trees.** One blob shape in two sizes. | The woods ring is a wall of the same circle. | Add 4 species: oak blob, conifer (stacked triangles), silver birch (white trunk, sparse), dead tree (bare branches). Vary trunk lean, and add shadow on the lower right. | Small. |
| VA-5 | **Roofs and facades.** Four slate roofs share `#4a5560`, and windows sit every 3 tiles. | Buildings blur together from above, which is the main view. | Tint each slate roof slightly (blue-grey, green-grey, brown-grey). Add aerials, a satellite dish, a tarp patch, a skylight, a dormer. Vary the window rhythm per building (paired, single, bay window). | Small-medium. |
| VA-6 | **Street furniture.** All lamps and bins are identical. | Lamps line every road. | 3 lamp variants: straight, leaning, head smashed (it still gives light, flickers more). Bins: knocked over, lid open with a bag. | Small. |
| VA-7 | **Corpses.** One lying pose per type. | A wave's end shows dozens of the same pose. | 3 poses (face down with an arm out, on the back with knees up, curled), chosen by the corpse seed, plus a mirror. | Small. |
| VA-8 | **Pub floor.** Regular stripes. | Players spend every between-wave break here. | Within boards: a worn darker path from door to bar, a rug in front of the fire, a spilt-pint stain, the odd replaced lighter board, felt pads only along the route. | Small. |
| VA-9 | **Roads.** One tarmac treatment everywhere. | The cross of main roads is always on screen. | Patch repairs (darker rectangles), an oil stain under each parked car, skid marks near the wrecked-car door, leaf litter in gutters near the woods, a manhole cover per junction. | Small. |
| VA-10 | **Survivors.** One body, four skins and hairs. | Fewer on screen, but they're people you meet. | Add body build (slim or broad, 1 px), glasses, a beard, a cap, and the outfit from a living palette. Keep the role prop as the readable thing. | Small. |
| VA-11 | **Night lighting.** Every lamp pool is the same circle. | Night is the whole game. | Vary pool radius by lamp type, and add a warm/cool tint per source (sodium lamps orange, the fire station's work lights white) once the light map supports colour. | Medium; touches the lighting pass. |

**Keep consistent on purpose:**
- Interactive items: racks and their price plates, comfort signboards, door price plates, barricade planks, trap switch LEDs, the trader's crate, finds and their glow, the ammo crate, the safe.
- Enemy type silhouettes and signature colours.
- Cain.

**Suggested order:**
1. VA-1, VA-7 and VA-8: cheap, renderer-only, and they cover what's on screen most.
2. VA-2 and VA-3: the biggest change to how the town reads.
3. VA-4 to VA-6, VA-9 and VA-10 as a polish batch.
4. VA-11 with any future lighting work.

## Sources
- [Vampire Survivors wiki: Options](https://vampire.survivors.wiki/w/Options)
- [What font does Vampire Survivors use?](https://madegooddesigns.com/vampire-survivors-font/)
- [Steam: Vampire Survivors discussion on damage values](https://steamcommunity.com/app/1794680/discussions/0/3194745319522730122)
- [Steam: Damage numbers on/off](https://steamcommunity.com/app/1794680/discussions/0/3470612993483101082/)
- [Castle Survivor devlog: improved animations and visual effects](https://indieben.itch.io/castle-survivor/devlog/661003/improved-some-animations-and-visual-effects)
