# Last Night in Zion: art PRD 3 (shape and variety)

| | |
|---|---|
| **Version** | Art 1.2 |
| **Date** | 2026-10-10 |
| **Project** | `/Users/alasdairmann/Desktop/Enoch Nights` (the game is *Last Night in Zion*) |
| **Builds on** | `ART-PRD.md` (Art 1.0, done), `ART-PRD-2.md` (damage numbers, gait, the repetition audit VA-1 to VA-11) |
| **Status** | Not started |

## 1. Goal
Zion currently reads as a grid. The map is a perfect rectangle, split into 9 rectangles by identical brick walls, and filled with rectangular buildings under similar roofs. This pass breaks that up **visually** while keeping gameplay (paths, collision, spawns, doors, barricades, zones) the same or nearly the same.

Four workstreams:
- **S1** building shapes and roofs
- **S2** zone dividers
- **S3** the map edge and what lies beyond it
- **S4** the rest of the repetition audit

**The rule from ART-PRD-2:** things the player acts on stay consistent and recognisable. That covers:
- racks, comfort signs, door price plates, barricade planks
- traps and their switches, the trader's crate, finds, the ammo crate, the safe
- enemy silhouettes and Cain

Everything else should vary.

## 2. How the game is built (read first)
| File | What matters for this pass |
|---|---|
| `src/map/town.js` | **Map size and grid.** `W = 96, H = 64` tiles of 16 px. `buildMap()` fills everything with `OUT`, then 9 zones (`COLS` [[2,31],[33,63],[65,93]], `ROWS` [[2,20],[22,42],[44,61]], zone ids in `ZGRID`). |
| | **Walls.** `setWall` lays the outer fence ring at x = 1 / 94 and y = 1 / 62, and the zone dividers at x = 32, x = 64, y = 21 and y = 43. |
| | **Buildings.** `BUILDINGS` are rectangles (`x, y, w, h`, `roof`, `wall`, `kind`, `name`) stamped as `BLD` tiles. The facade is the bottom row. The pub interior is carved out of the Red Lion. |
| | **Doors and barricades.** `DOORS` are cuttable openings in the dividers. `barricades` are the windows the dead climb through: many sit on the outer fence (for example [10,1], [1,16], [94,33], [24,62]) and some on building fronts. |
| | **Ground.** The ground outside the fence is already themed: woods to the north, river to the east, farm to the south, bypass to the west. |
| `src/render/mapart.js` | `buildStatic(map)` bakes the whole town into one canvas. Functions to know: `groundTile`, `fence` (outer ring: hedge on the north and church side, otherwise salvage segments), `brickWall` (every divider tile), `building` → `roof` / `wallFace` / `window_` / `door` / `details` (per-name silence and tonight details via `BLD_STYLE`), `prop`, `car`, `tree`, `decor`. |
| `src/render/renderer.js` | **Camera.** `clampCam()` limits the view to x 0..96·16−480 and y −8..64·16−270 (the view is 480x270). The static map is drawn 1:1 from `staticMap`. |
| | **Live drawing.** Dynamic objects (doors, barricades, generator, engine, lighting) are drawn here. |
| | **Lighting.** `drawLighting` builds a half-resolution light map and bands it. |
| `src/render/sprites.js`, `people.js` | Characters. Sprite keys are `kind[:suffix]` with outfit, view, frame, pose and variant. Gait tiers use the `walker:g0..2` suffix. |
| `src/render/palette.js` | Named ramps (`RAMP`), `shade`, `ramp3`. Put new colours here. |
| `sprites.html`, `mapview.html` | Dev pages. `mapview.html?s=2&x=520&y=340` shows the baked town without lighting; `sprites.html?k=walker:g0@3` shows characters. |

**Constraints**
- Vanilla JS, ES modules, canvas, no build step. `npm start` serves on 4174; `.claude/launch.json` is `enoch-nights` with `autoPort`.
- `npm test` (53 tests) must stay green.
- `src/sim/` must not change. Changes to `src/map/town.js` data are allowed **only where this PRD says so**, and must keep:
  - every door, barricade, rack, comfort spot, spawn and zone reachable as now
  - the same zone ids
- 60 fps with 150 enemies (currently about 1.2 ms per draw). The town is baked once; anything that animates goes in the renderer and is culled to the view.
- Integer scaling, no smoothing, the 3-step ramps and selective outline from ART-PRD D0.

---

## S1. Building shapes and roofs
**Problem:** all 15 buildings are axis-aligned rectangles with a single roof slab, and four slate roofs even share one colour.

### S1.1 Footprint approach
- **Default, visual-only:** collision stays the rectangle. Break the silhouette with drawn additions that sit on tiles that are already blocked, or on decor next to the building:
  - **Cut corners.** Draw one or two corners of the rectangle as a yard instead of roof: a walled back yard with bins, a coal bunker, a lean-to. The tiles stay `BLD`, but they read as "a wall you can't get past", so blocking still makes sense.
  - **Wings and annexes.** A lower wing roof stepping down from the main roof (a different height, shown by a 2-3 px shadow edge), a single-storey extension, a porch, a bay window on the facade, a conservatory (glass roof), a fire-escape stair on the side.
  - **Facade depth.** Recessed shop doorways, a projecting shopfront fascia, steps, a ramp.
- **Optional, with small collision changes:** a building may get a non-rectangular footprint via a `shape` mask in `BUILDINGS` (rows of `#` and `.`). `buildMap` then stamps only `#` as `BLD` and leaves `.` as `FLOOR` with the zone's ground. Use this only where:
  - the freed tiles don't open a new route past a barricade or door
  - nothing currently sits there
  - tests still pass and nav is checked with a run of `scripts/simulate-rounds.js`

  Candidates: the church (nave plus a narrower chancel and a porch), the school (an L with a playground in the crook), the garage (workshop plus a separate kiosk), the cabins (they can stay rectangular, since that's in character).

### S1.2 Roof types (replace the single `roof()` treatment)
Implement each as a function that draws into the footprint with its own light logic (upper-left key light, ridge highlight, eaves shadow on the lower edge):

| Type | Look | Use for |
|---|---|---|
| Gable | A ridge along the long axis, two slopes in different tones (the north slope darker), gable ends showing as triangles of wall | Hardware, News & Bakery, Post Office |
| Hipped | Ridge shorter than the building, four slopes, hip lines | The house, Hunt & Tackle |
| Cross-gable / L | Two gables meeting; the valley is a dark line | The Red Lion (main block plus a back wing), the church with a porch |
| Flat with parapet | A low wall lip around the edge, felt with puddles, plant boxes, a skylight row, a ladder hatch | Cafe, Pharmacy, the school (plus the mast) |
| Sawtooth / barrel | Corrugated in bays or one curved barrel roof with ribs | Garage, the fire station's appliance bay |
| Nave and tower | A long steep slate roof plus a separate tower roof (pyramid with louvres) | St Mary's |
| Mansard or dormers | A steep lower slope with 2-3 dormer windows | One shop on the square, so the square has a landmark |

### S1.3 Roof variety rules
- **Unique colour.** Each building gets its own roof tint within its material ramp: slate blue-grey, green-grey, purple-grey; tile red-orange or brown-red.
- **2-4 roof furniture items:** chimneys (vary count and position), TV aerials, a satellite dish, a skylight, a tarp patch weighted with tyres, missing slates showing battens, a bird's nest, a dead gutter plant.
- **Wear varies by building:** moss amount, sag (a 1 px dip in the ridge line on old roofs), soot near chimneys.
- **Silence and tonight details stay.** Keep each building's details from ART-PRD D6. Some move to the roof where that helps, for example the fire station's tied bell on the hose tower.

### S1.4 Acceptance criteria
- **Shape:** no two neighbouring buildings share roof type and colour. At least 6 buildings visibly aren't plain rectangles from above, with or without collision changes.
- **Gameplay:** collision, doors, barricades and racks are unchanged unless listed in S1.1; tests are green.
- **Views:** checked in `mapview.html` and in game at night with the generator on (window light still lines up with the windows).

---

## S2. Zone dividers
**Problem:** the four divider lines (x = 32, x = 64, y = 21, y = 43) are all the same capped brick wall.

### S2.1 Approach
**Collision is unchanged**, since the dividers stay `WALL` tiles. The variety is visual:
1. **One boundary type per divider segment.** A segment is the run between two junctions, so there are about 12 of them. Choose each type from what the zones on either side are. Proposed assignments:

| Divider segment | Between | Boundary |
|---|---|---|
| y = 21, x 2-31 | Churchyard / fire station | Old stone wall with coping and a lychgate pier at the gate door |
| y = 21, x 33-63 | School / town square | Green-painted school railings with mesh, a "SCHOOL" sign, children's paintings tied on |
| y = 21, x 65-93 | Builders' yard / garage | Hoarding boards (painted, with a faded developer's sign) and Heras panels |
| x = 32, y 2-20 | Church / school | Hedge with a gap filled by pallets |
| x = 64, y 2-20 | School playing field / builders' yard | Chain-link with a concrete post every 32 px, a torn section |
| y = 43, x 2-31 | Fire station / Red Lion | Brick with a collapsed run (rubble, still blocking), buttress piers |
| y = 43, x 33-63 | Square / post office | Shop backs: high brick wall, bins, an extractor fan, a rear door bricked up |
| y = 43, x 65-93 | Forecourt / Hunt & Tackle | Close-boarded garden fence, sheds behind |
| x = 32, y 22-42 | Fire station / square | Low brick wall plus railings |
| x = 64, y 22-42 | Square / garage | Breeze block with graffiti and a mural |
| x = 32, y 44-61 | Pub car park / post office | Beer-garden fence with festoon-light hooks (lights dead) |
| x = 64, y 44-61 | Pharmacy / allotments | Allotment fence: pallets, doors and corrugated sheet, bean poles |

2. **Variation inside a segment:** posts or piers every 2-4 tiles, one feature per 6-8 tiles. Features:
   - a poster or missing-person flyer
   - chalk tallies or "SHH" (the silence)
   - a fresh breach that's been patched (tonight)
   - ivy
   - a bin against it
   - a bicycle chained to it
3. **Junctions.** Where dividers meet, draw a pier or post, a bollard, a lamp or a phone box, so the corners aren't plain crossings.
4. **Break the straight line visually.** Overlay decor that overlaps the wall from either side (a shrub, a car parked against it, a skip), and vary the top edge by type (railing spikes, hedge bumps, fence boards at different heights). Draw within the tile plus a 4-6 px overhang upward, as now.
5. **Doors stay as they are.** The clearable doors keep their current look and price plates, since they're actioned.

### S2.2 Acceptance criteria
- **Variety:** no two adjacent segments share a boundary type, and none of the twelve is the old plain brick.
- **Gameplay:** collision and nav are unchanged and tests are green.
- **Silence and tonight:** every segment shows at least one silence detail or one tonight detail.

---

## S3. The map edge and beyond
**Problem:** the whole map is a hard rectangle with a fence around it. The camera clamps exactly to it, so at the edges the player sees a straight fence line and nothing beyond.

### S3.1 Show what's beyond (biggest win)
1. **Let the camera see past the edge.** Loosen `clampCam` so it can reach about 3-4 tiles beyond the outer fence on every side (keep the player clamp unchanged, so this is camera only).
2. **Bake a "beyond" apron into the static map.** Either enlarge `staticMap` by a margin and offset the draw, or render a separate apron canvas. Contents, matched to the existing outer ground:
   - **North, the woods:** dense trees in 3 depth layers (darker and smaller further out), a deer fence, a footpath sign, a fallen trunk.
   - **East, the river:** water with ripples, reeds, the far bank, a blocked footbridge, a moored narrowboat, a drowned car roof.
   - **South, the farmland:** a field with crop rows running off, hay bales, a tractor stopped mid-field, a farmhouse silhouette, a pylon line.
   - **West, the bypass:** the dual carriageway with a crash barrier, an overturned lorry, a burnt-out bus, abandoned cars nose to tail, a blue road sign ("ZION 1/2").
3. **Depth cue.** Draw the beyond darker and a little desaturated, with the far layer in silhouette. At night the lighting pass already darkens it, so add a few distant light sources: a car's hazard lights, a fire on a far farm, a flashing police light on the bypass.
4. **The dead out there.** Animated silhouettes drift toward the fence in the apron, renderer only. Each spawn barricade gets a few pacing silhouettes behind it during a wave, so you can see where they're coming from. Do this as purely visual sprites with no sim involvement, culled to the view, and cap them at about 30.

### S3.2 A mixed border, not one fence
**Collision stays on the ring at x = 1 / 94 and y = 1 / 62.** The drawing changes per stretch, matching what's beyond:

| Side | Border material |
|---|---|
| North | Overgrown hedge with gaps plugged by doors and pallets. A dry-stone wall stretch by the church (keep the existing hedge idea but vary it). |
| East | River bank: a low embankment, sandbags, a chain-link riverside fence with lifebuoy posts. |
| South | Farm gate and post-and-rail, then a car barricade where the south road would leave town. |
| West | Crash barrier plus a wall of stacked cars and a lorry trailer across the bypass slip road. |

Each side also gets:
- **2-3 "set pieces"** that break the line:
  - a collapsed barn wall
  - a shipping container
  - a burnt-out van wedged into the gap
  - a scaffold tower
  - a fallen tree across the fence with its root plate showing beyond
- **Organic corners.** Bury the corners in trees or a building (a ruined cottage at one corner), so they never read as right angles.
- **Spawn barricades stay recognisable.** Keep the plank look, but frame each one in that side's material, with the window cut into the hedge, the car gap, and so on.

### S3.3 Make the playable shape feel less rectangular (optional, light gameplay touch)
**Visual-only first:** ground treatments that ignore the grid near the edge. For example, a woodland floor creeping 1-2 tiles inside the fence in the north (leaf litter, brambles as decor), and river mud and reeds inside the east fence.

**If S3.1 and S3.2 still feel boxy, then** allow a few `WALL` notches in town.js: move a short run of the outer fence 1-2 tiles inward around a set piece (for example a pond in the south-east corner, or a collapsed house in the north-west), keeping these clear of:
- spawn barricades
- doors
- the zones' main paths

After any of these changes, check nav with `scripts/simulate-rounds.js` and run the tests.

### S3.4 Acceptance criteria
- **Beyond:** at every edge of the map the player sees scenery beyond the border, never a flat background.
- **Mixed border:** the four sides use four different border materials. No straight run of identical fence is longer than about 8 tiles. No corner reads as a plain right angle.
- **Spawns:** spawn barricades are still easy to spot.
- **Performance:** fps holds; the apron is baked once and the drifting dead are capped and culled.

---

## S4. The rest of the repetition audit
These are from ART-PRD-2 VA; see that file for the full table. Build them in this order:

| # | Item | Notes |
|---|---|---|
| VA-1 | **Walker look seeds** | Add `e.id % 4` to the sprite key, so each of the 12 outfits gets 4 looks (48 in all). The seed varies skin within the dead ramp, hair (bald, long, matted), tear and stain positions, and one injury (a missing ear, a bitten forearm, a lower jaw, a missing shoe). Silhouettes stay the same. Renderer and people.js only. |
| VA-7 | **Corpse poses** | 3 poses plus a mirror, chosen by a corpse seed. |
| VA-8 | **Pub floor** | A worn path from the door to the bar, a rug by the fire, a spill stain, the odd replaced board. |
| VA-2 | **Lawns** | 57% of tiles are grass. Scatter per block: long-grass clumps, molehills, garden plots, washing lines, toys, a tyre swing, 1-3 trees inside blocks, worn desire paths from doors to the road. Decor only, no collision. |
| VA-4 | **Trees** | Four species (oak, conifer, birch, dead), lean, and shadow on the lower right. |
| VA-6 | **Street furniture** | Lamps: straight, leaning, smashed (the smashed one flickers). Bins: knocked over, lid open. |
| VA-9 | **Roads** | Patch repairs, oil under cars, skid marks, manholes, leaves in the gutters. |
| VA-10 | **Survivors** | Body build, glasses, beards, caps, a living outfit palette. The role prop stays the readable part. |
| VA-11 | **Light colour per source** | Only if the lighting pass gains colour. |

---

## 4. Phases
| Phase | Scope | Done when |
|---|---|---|
| A | VA-1, VA-7, VA-8 (cheap, renderer-only) | No two walkers in the same outfit look identical in a crowd of 20; corpse fields vary. |
| B | S2 dividers | S2.2 criteria. |
| C | S1 roofs and visual footprints (S1.1 default, S1.2, S1.3) | S1.4 criteria without collision changes. |
| D | S3.1 beyond and the camera clamp, S3.2 mixed border | S3.4 criteria. |
| E | VA-2, VA-4, VA-6, VA-9, VA-10 | Before and after map overview: no block reads as an empty rectangle. |
| F (optional) | S1.1 shape masks, S3.3 fence notches | Nav checked, tests green, no route or spawn changes beyond those listed. |

**Every phase:**
- Screenshot before and after, at 1x and 3x, in `mapview.html` and in game at night with the generator on. Save them to `art/screens/`.
- Run `npm test`.
- Spot-check fps with 150 enemies.

## 5. Decisions (answered by the user, 2026-10-10)
1. **Small collision changes are allowed.** Phase F (building L-shapes via `shape` masks, outer-fence notches) is in scope, under the S1.1 and S3.3 safeguards: tests stay green, nav is checked with `scripts/simulate-rounds.js`, and every door, barricade and spawn stays reachable.
2. **The dead beyond the fence show only during waves.** Between waves, the apron is still and empty.
3. **Add a horizon landmark: a faint glow toward Hilltop.** Use a warm sky glow on the far side of the apron, with a radio mast silhouette and a blinking light. It ties into the radio and signal quest. Optionally, it brightens once the signal booster is built (`g.mastRepaired`).
