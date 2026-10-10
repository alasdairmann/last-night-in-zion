# Last Night in Zion: art PRD (pixel-art detail pass)

| | |
|---|---|
| **Version** | Art 1.0 |
| **Date** | 2026-10-10 |
| **Project** | `/Users/alasdairmann/Desktop/Enoch Nights` (folder name is historical; the game is now *Last Night in Zion*) |
| **Builds on** | `PRD.md`, `ENHANCEMENT-PRD.md`, `PRD-v1.2.md`, `PRD-v1.3.md` (read C8 for the current premise) |
| **Status** | Not started |

## 0. Open items outside the art (from PRD-v1.3)
Everything in PRD-v1.3 (C1 to C8) is built and tested. Still to do:
- [ ] Update `WORLD.md` to the Zion premise (Phase 0 below).
- [ ] Playtest the power attack (C5): charge time, knockback and stamina cost in a real fight. Tune `T.power` / `T.stamina` in `src/tuning.js`.
- [ ] Playtest dying, then **Retry wave N** (C6): it restores the start of that wave, and Continue on the main menu picks the newer save.

## 1. Goal
Redraw every sprite, tile, structure, icon and effect in the game with much more hand-placed detail, at the **same pixel sizes**, so gameplay, hitboxes and layout don't change. Sections D0 to D10 below describe each asset; D11 is the build order.

## 2. Setting (what the art has to say)
- **Last Night in Zion** is a prequel to *Project Enoch* (`../Project Enoch`). Zion is a small English-American town, about a year after the outbreak: overgrown, rusting, quiet.
- **Cain** (late 50s, grey beard, red bandana) and his partner lived there for a year **in silence**, because the dead hunt by sound. Tonight the partner shot themself. The shot woke the city, and every noise since brings more. The game is Cain's last night, fought in **waves**.
- **Visual theme:** a year of careful silence (felt, cloth, tied bells, chalk "SHH" marks) torn open tonight (broken glass, kicked doors, alarms, fire). Bright nature, dull salvage, night lighting.
- `WORLD.md` holds the older tone and style notes (shared look with *Project Enoch*). Its premise section is out of date: replace the "Enoch hilltop camp" framing with the Zion premise above as task 0 of this work.

## 3. How the art works today (read before changing anything)
| File | What it draws |
|---|---|
| `src/render/sprites.js` | Characters: `charSprite(kind, outfit, view, frame, pose, variant)`, cached by that key. 16x24 humans (crawler and Cain-downed 16x12, dogs and Biscuit 18x12), drawn as flat fills, then an automatic `shaded()` rim/shadow pass and `outlined()` selective outline. Palettes in `palFor()` and `CAIN`; walker outfits in `OUTFITS` (`src/data.js`). 5 views (S, SE, E, NE, N), mirrored for the other 3 (`viewForDir`). Variants: `w` (white hit flash), dark night silhouette with glowing eyes. Also the **12x12 icon set** (`ICONS`, `icon()`, `iconWhite()`) and the pixel font (`GLYPHS`, `pixelText`). |
| `src/render/mapart.js` | The static town, baked once into one canvas by `buildStatic(map)`: ground tiles (`GROUND` palettes), trees, fences, brick walls, buildings (roof plus 3/4 face), props (`prop()` cases: car, fireengine, memorial, phonebox, shelter, bin, grave, digger, pallets, pump, tyres, policebox, shed, tunnel, scarecrow, goal, towtruck, bench, noticeboard), weapon racks, comfort signs, decor (banner, trolley, bicycle, pram, binbags, sand, scaffold, bed, flowers, bench, bunting). |
| `src/render/renderer.js` | Everything dynamic: enemies, player and weapon (`drawPlayer`, `drawWeapon`), survivors, Biscuit, world items, the fire engine, corpses, hatches, pub door, barricades and reinforcements, doors, braziers, fire, gas, barrels, the trader's crate, finds, generator, workshop, trap switches and areas, explosions, particles (blood, sparks, smoke), decals, rings and slashes, weather (rain, fog), and the lighting pass (`drawLighting`: head torch, lamps, fires). Event-driven effects are in `consume(g, ev)`. |
| `src/render/hud.js` | HUD plaques, weapon panel, stamina bar, minimap, banners, notes. Out of scope except where it shows icons. |
| `src/map/town.js` | The map data: tiles, buildings (name, roof colour, wall type, kind), props, spots. Don't change the layout. |

**Constraints**
- Vanilla JS, ES modules, canvas, no build step, no dependencies. `npm start` serves on port 4174; `.claude/launch.json` has the `enoch-nights` preview config.
- The view is 480x270, integer-scaled. Keep `imageSmoothingEnabled = false`.
- **Keep every sprite size and anchor.** Sprites are cached by key; the redraw replaces what's behind the key and nothing else.
- Procedural drawing (more detailed code) or PNG sheets are both fine. If PNGs: put them in `assets/`, load them before the game starts, and fall back to the procedural sprite if a sheet is missing.
- The simulation (`src/sim/`) must not change. `npm test` (53 tests) must stay green.
- Performance: keep 60 fps with 150 enemies on screen. Cache everything; do no per-frame `getImageData`.

## 4. Phases and acceptance criteria
| Phase | Scope | Done when |
|---|---|---|
| 0 | Update `WORLD.md` to the Zion premise. Create `src/render/palette.js` with named ramps (D0) and move existing colours into it. | No visual change; tests green. |
| 1 | Cain (D1), all poses and costume variants | Readable at 1x; bandana, beard, felt boots and head torch visible in all 5 views. Before/after screenshots. |
| 2 | Walker plus all 12 outfits, deaths and corpses (D2) | Each outfit recognisable at 1x; death 4 frames; corpse variants. |
| 3 | Specials, dogs, Brute, Butcher, looter, raiders (D2) | Each type identifiable from its silhouette and signature colour alone. |
| 4 | Survivors and Biscuit (D3) | A role prop on each survivor. |
| 5 | Ground and terrain (D4), walls, fences, barricades, doors (D5) | No visible tiling repeats over a 3x3 tile area; each barricade plank stage is distinct. |
| 6 | Buildings (D6) | Each building has its sign, its silence detail and its tonight detail. |
| 7 | Large structures and props (D7) | Generator, fire engine and mast states are all drawn. |
| 8 | Weapons and icons (D8, D9) | Every key in `ICONS` redrawn; in-hand sprites for every weapon. |
| 9 | Effects, weather, lighting (D10) | Blood life cycle, fire, gas, explosions and power attack done; no fps drop. |

Each phase: look at it in the browser at 1x and 3x, at night and with the generator on, then take before and after screenshots.

---


Everything below is a spec for redrawing. The current art is procedural (`src/render/sprites.js`, `mapart.js`, `renderer.js`) with flat fills plus an automatic shading and outline pass. The goal is hand-placed detail at the **same sizes**, so gameplay hitboxes and layout don't move. Each sprite stays behind its existing cache key so it can be swapped one for one, either as redrawn procedural code or as PNG sheets.

## D0. Global rules

| Rule | Spec |
|---|---|
| Scale | 16 px tiles. Native view, integer upscaling only, no smoothing. |
| Characters | 16x24 frame, feet on row 22, 1 px ground shadow ellipse (10x3, black at 35%). Head about 7 px tall, so proportions are about 3.3 heads. |
| Light | Key light from the upper left in daylight logic. At night the real light comes from Cain's head torch, street lamps and fires, which the lighting pass handles. Sprites carry a **3-step ramp** for every material (light, base, shadow) plus a **1 px rim** on the upper-left edges. |
| Outline | Selective: each outline pixel is a very dark version of the colour it touches (as now), darkest along the bottom edge. Interior lines (belt, collar, sleeve seams) use the shadow tone, never the outline colour. |
| Palette | Warm-dull salvage colours on cool night greens and blues. No pure black (darkest #14100d) and no pure white (lightest #f2ead6). Blood is two reds only: fresh #a3241c / #d23a2a highlight, old #4a1612. Infected skin ramps: #9cc06a / #79b04c / #4f7a34, with grey-blue bruising (#5a6a70) at joints. |
| Dithering | Allowed only on large surfaces (roofs, tarmac, grass) as a 2-colour checker at 25%. Never on characters. |
| Animation | Walk 4 frames, attack 3 (wind, strike, recover), hurt 1, death 4, idle 2 (breathing: the chest rises 1 px). 8 directions from 5 drawn views (S, SE, E, NE, N), mirrored as now. |
| Readability | Silhouette first. Every enemy type must be identifiable as a solid black shape at 1x. Specials carry one **signature colour** that no other type uses. |
| The silence | Zion lived silently for a year, and that shows everywhere: **cloth-wrapped door handles, felt pads nailed to floors, chalk "SHH" marks and tally walls, bells with their clappers tied, cars with batteries pulled, wind chimes cut down**. Tonight's chaos sits on top of that: fresh broken glass, doors kicked in, alarms flashing. |

## D1. Cain (player)
- **Build:** late 50s, wiry, slightly stooped, broad hands. 16x24.
- **Head:** weathered tan skin (#d9a47a / #b5845e / #8e6446). Short grey hair (#8c8f86, highlight #b0b2aa), receding at the temples. Full short beard (#b8b8ae / #8f8f86) that covers the jaw as 3 px of texture, with a darker moustache line. Eyes: 1 px dark pixels with a 1 px lighter brow ridge above. Visible from S/SE: a **head torch** strap (#3a3530) across the forehead and a lamp housing (2x2, #d9d2b8 lens) that glows when lit.
- **Torso:** an olive-tan canvas work jacket (#a8915a / #8a7548 / #6a5836) with two chest pockets (1 px flap lines), the collar turned up and sleeves pushed to the forearms. A faded blue work shirt (#4d7fb8) shows at the collar. A **red bandana** (#b5503b) on the left upper arm: his marker, visible from every view.
- **Legs and feet:** dark canvas trousers (#4a4a3a) with knee patches 1 tone lighter. **Felt-wrapped boots**: brown leather (#5a3e2a) with grey felt (#8a857a) bound over the toes. That's the silence habit, and it should read clearly.
- **Gear:** a small belt pouch on the right hip and a radio clipped to the left chest strap (2x3, #2b2b2b, 1 px amber LED that blinks when Hilltop speaks).
- **States:** hurt flashes the whole sprite #f2ead6 for 2 frames. Low health adds a 1 px darker sweat and blood smear on the cheek. Downed has its own crawl sheet (4 frames, pistol in hand). Carrying: arms forward, the item drawn over the torso. Charging a power attack: a crouch frame, the weapon pulled back over the shoulder, a dust puff at the feet each 0.2 s. The spin release is a 4-frame 360 smear.
- **Costume variants** (cain1-3): keep the bandana, beard and boots on all of them so he is always recognisable.

## D2. The dead (all share the base body, then add their identity)
**Common body rules:** greyish-green skin ramp (D0), sunken eyes (2 px dark socket with a 1 px #e03a2a pupil that only shows at night), jaw slack (the mouth is a 2x1 dark gap), and one arm always a pixel lower than the other. Clothes come from `OUTFITS` but **aged**: every outfit gets 2-4 random tear pixels (showing skin), dirt along the hems (shadow tone +1), and a blood stain (old red) on chest or hands. The walk is a shamble: a 1 px head bob out of phase with the feet, and the leading foot drags (no lift).

| Type | Size | Signature detail |
|---|---|---|
| **Walker** | 16x24 | 12 outfits: hi-vis (reflective strips as 1 px #e8e0c0 bands that flash in torchlight), scrubs (a lanyard), postman (a satchel strap across the chest), hunter (orange cap), tabard, hoodie (hood up on half), suit (loose tie), school (tie and blazer badge), firefighter (yellow helmet stripe), chef (apron), farmer (wellies), barmaid (apron). Three speed tiers show in the posture: slow ones are hunched, fast ones lean forward. |
| **Crawler** | 16x12 | Legless torso dragging on its arms, with a smear trail (old blood decal every 8 px). Spine shows as 3 vertebra pixels. Clawing animation, 4 frames. |
| **Runner** | 16x24 | Fresher: skin pinker (#c4906e), clothes cleaner, sprint pose leaning 2 px forward, arms back. Signature: **torn running vest** and one bare foot. |
| **Bloater** | 18x24 | Swollen belly that pushes the shirt up, veins (#5a6a70) across the belly, a 1 px gas-yellow (#b8c43a) drip at the mouth. The belly pulses 1 px in idle. Signature colour: **sickly yellow-green**. |
| **Armoured** | 16x24 | Riot helmet with the visor cracked, a body vest with a "POLICE" strip (unreadable, 3 px light bar), shin guards. Front-on it looks plated; from behind the vest straps and exposed back show (so players learn to flank). Signature: **hi-vis yellow** (#d9c23a) strip. |
| **Tangled** | 16x24 | Barbed wire wound round the torso and arms as a 1 px #c0c4c8 zigzag with barb dots, plus cuts (fresh red) where it bites. Signature: **silver wire**. |
| **Screamer** | 16x24 | Thin, long-necked, jaw unhinged (the mouth is 3 px tall). When winding up, the head tilts back, the neck veins go red and the chest fills. Signature: **red throat**. |
| **Hazmat** | 16x24 | Yellow suit (#d9c23a / #a8961e), black respirator, a cracked visor with green mist inside, tape at the wrists. Bursts into green gas. Signature: **hazmat yellow plus green visor**. |
| **Burning** | 16x24 | Any walker on fire: charred patches (#2b1d16) creep up from the feet over 3 s, 2-3 animated flame tongues (3 frames) on the shoulders and head, embers rising. |
| **Dog** | 18x12 | A lean, mangy infected dog: rib lines, patchy fur (bald pink-grey patches), a torn ear, red eyes. Lunge frame: fully stretched. **Scarred leader:** bigger (20x13), a dark scar slash across the face, a collar with a dangling tag. |
| **Brute** | 22x28 | A riot cop, huge: a full-height riot shield (scuffed, smeared, a crack across it, a "POLICE" strip), helmet down, a belt with cuffs. Charge wind-up: lowers his shoulder, the shield forward, dust kicked behind. Signature: **navy plus shield clear-grey**. |
| **The Butcher** | 22x28 | A huge figure in a white butcher's coat stained dark to the elbows, a striped apron, a meat hook on the belt, a cleaver (bright edge). A grab wind-up with both arms wide. Signature: **stained white**. |
| **Looter** | 16x24 | Living, not dead: normal skin, a dark balaclava, a bulging holdall over the shoulder (spilling a scrap coin), quick crouched run. |
| **Raider** | 16x24 | Living: mismatched leather and denim, a red rag tied on the arm (the gang mark), a rifle or pistol drawn. **Captain:** a long coat, a red laser line from his weapon, a cap. |

**Death:** 4 frames: knees buckle, fall, impact, settle. The corpse (16x10) keeps the outfit colours, gets a blood pool decal underneath, and fades over 30 s to an old-blood stain. Headshot deaths add a spray decal behind the body. Gas, fire and explosion deaths each get their own corpse (yellow residue, charred, scattered pieces).

## D3. Survivors and Biscuit
- **Survivors** (16x24): clean but worn clothes, living skin tones (4), varied hair, and a **role prop** so you can tell jobs apart at a glance: Medic (white armband with a red cross), Mechanic (spanner in the back pocket, oil-dark hands), Cook (apron, ladle), Lookout (binoculars round the neck), Scavenger (backpack), Fighter (a bat over the shoulder). Sick: a pale-green tint and a blanket round the shoulders. Hurt: a bandage on the head or arm.
- **Biscuit** (14x10): a scruffy wire-haired terrier, wheaten with a darker saddle, a **red collar** with a brass tag that glints. Ears up when alert and back when biting. Tail wag in idle (2 frames). Pinning frame: front paws on the walker. Downed: on his side, a whimper puff.

## D4. Ground and terrain
| Surface | Spec |
|---|---|
| Tarmac roads | Base #3a3d40 with 25% dither of #33363a, random 1 px aggregate flecks (#4a4d50), cracks (dark 1 px branching lines, 1 per 4 tiles), potholes with water (reflecting street-lamp light), faded white and yellow lines with gaps where worn, drain grates at the kerb. |
| Pavements | Grey slabs (#6b6a62) in a 8x8 grid with 1 px joints, kerbstones 1 tone darker with a light top rim, weeds (#46963a) in about 1 in 6 joints, a dropped kerb at crossings. |
| Grass | Knee-high, a year uncut: 3 greens (#2f6f2c / #46963a / #6cbf4a) as tufts, not flat fill; 1-2 px dandelion and clover specks; trampled paths (lower, browner) where the dead walk most. |
| Dirt and mud | Brown (#5a4632) with footprints, tyre ruts and puddles in rain. |
| Floors (interiors) | Lino (pub kitchen, pharmacy), boards (pub, church: 1 px plank seams, knots), tiles (butcher's: white with grout lines, blood on some), concrete (garage: oil stains). **Felt pads nailed down along routes**: Zion's silence. |
| Rubble | Broken brick piles, plaster dust, rebar sticking out. |

## D5. Walls, fences, barricades
- **Brick walls:** running bond, bricks 4x2 px in 3 reds (#9b4a36 / #b5604a / #7d3a2a) with a 1 px mortar line (#5a4a40), a capstone row with a light top lip, moss in the bottom courses, and chalk tally marks or "SHH" on some.
- **Building faces:** brick, render (cream with stains and cracks), timber cladding (the cabins) or stone (church: big irregular blocks, darker mortar).
- **Fences:** the town fences are **salvage**: panels of garden fence (vertical boards), pallets, corrugated sheet (rusty ribs every 2 px), chain-link with holes. Each 16 px segment picks one; the joints are tied with rope or wire.
- **Barricades (windows):** 5 planks, each one tracked: a fresh board is pale (#c49a62) with a wood grain line and 2 nail heads; as it's torn it splinters (jagged ends), tilts 1-2 px and darkens. Steel bars: 4 vertical bars with rust at the welds. Sheet metal: a rivet border and dents. Red Lion shutters: oak (dark, studded) and steel (painted green, a padlock).
- **Doors:** wooden (4 panels, a brass handle wrapped in cloth), shop doors (glass with a CLOSED sign), garage roller (horizontal slats), church (arched, iron strap hinges). Clear-to-open cost as an amber price plate.

## D6. Buildings (rooftop view, 3/4 face)
Every building gets: a roof with material texture and a ridge light line, chimney or vents, a face with windows (lit or dark), a sign, wear (moss, stains, a broken gutter), and **one silence detail and one tonight detail**.

| Building | Roof | Face and sign | Silence detail | Tonight detail |
|---|---|---|---|---|
| Hardware | Grey slate | Green shopfront, a "HARDWARE" sign in cream serif | Rolled carpet against the door | The window smashed, glass on the pavement |
| News & Bakery | Red tile | A striped awning (torn), bread racks inside | A hand-written "QUIET PLEASE" card | The awning half torn down |
| Cafe | Felt, flat | Bistro chairs stacked outside | Chair legs with tennis balls on them | A table thrown through the glass |
| Butcher | Slate | A tiled red and white front | Meat hooks wrapped in rags | A dark trail out of the door |
| Fire station | Flat, with a hose tower | Red bays, a white "FIRE STATION" | The bell clapper tied | Bay door dented outward |
| St Mary's | Long slate roof, a square bell tower with louvres | Stone, a lancet window (stained glass in dark tones that light up when the power's on) | The bell rope tied up | Graves disturbed (earth heaped) |
| Zion Primary | Long flat roof with a **radio mast** (lattice, a red light on top) | A brick front with children's paintings in the windows | Chalk "SHH" hopscotch | A coat peg row fallen |
| Garage | Corrugated | Roller door, a tyre stack, a fuel price sign | A battery pile (pulled from cars) | An oil spill fire risk |
| The Red Lion | Slate, chimneys | A hanging pub sign (a red lion rampant, 10x12), hanging baskets (dead), a chalkboard | Felt round the bar stools | Bolted door, light through the gaps |
| Post office | Tile | A red postbox outside, a "POST OFFICE" sign | Letters stacked, unsent | The safe door glinting |
| Pharmacy | Flat | A green cross sign (unlit or flickering) | Cardboard over the windows | The cellar hatch with knocking (dust jumps) |
| Hunt & Tackle | Tile | Antlers over the door, a rod display | Rifles with rag-wrapped bolts | An empty rack |
| Site office and stores | Portacabin: corrugated roof, a door with a step | A hi-vis jacket on a nail | Generator muffled with blankets | Door kicked in |

## D7. Large structures and equipment
- **Generator** (fire station yard, 32x24): a diesel genset on skids, a yellow and black hazard frame, an exhaust pipe with a spark arrester, a fuel gauge (needle by fuel left), a control panel with 3 LEDs, and cables snaking to the station. Running: 2-frame vibration, a smoke puff every 0.5 s, LEDs green. Off: a cold blanket draped over it (the silence habit).
- **Fire engine** (48x24): a red cab-forward pump with a white roof stripe, a ladder on top, a rolled hose, chrome lockers and a blue light bar. It shows its missing parts (battery bay open, a wheel on blocks, the fuel cap off) and fills in as you fit them. Running: lights spin (3 frames), the exhaust puffs.
- **Searchlight** (16x16): a drum lamp on a tripod; when lit, a cone of light in the lighting pass.
- **Radio mast** (school roof, 16x40): lattice tower, guy wires, a red aircraft light. Booster built: a box at the foot with a blinking green LED.
- **Digger** (builders' yard, 40x28): yellow, mud-caked, the bucket resting on the ground, a cracked windscreen.
- **Tow truck** (40x20): the battery source, a hook and boom, an amber light.
- **Bus** (town event): green double-decker, through the fence, windows broken.
- **Helicopter crash** (event): a rotor bent, fire, scattered crates.
- **Traps:** each trap has its switch box (a grey box with a lever and LED) and a world prop: the petrol sprayer (pipes and a nozzle row), electrified fence (insulators and a warning sign), bell (church bell), and so on, each with an armed look (LED amber) and a firing look.
- **Workshop bench, other benches, noticeboard, jukebox, crate (the trader's), ammo crate, town safe, switchboard, cellar hatch, braziers, barrels (red with a flammable diamond), cars (6 models: hatchback, estate, van, police car, taxi, pickup; doors open on some; flashing alarm lights when set off), phone box, police box, bus shelter, bins and binbags, graves, memorial, scarecrow (in a hi-vis jacket), pallets, tyres, pram, trolley, bicycle, sandbags, scaffold, flowers, bunting, goalposts.** Each one: a 3-tone material ramp, 1 px wear, and an outline per D0.

## D8. Weapons (12x12 HUD icon plus an in-hand sprite)
In-hand sprites are drawn along the swing or aim line, 8 to 14 px long, with the tier tint (I: brighter metal, II: an effect-colour glint, III: gold edge).

| Weapon | Look |
|---|---|
| Claw hammer | Steel head, the claw split clearly, a wooden handle with tape at the grip |
| Bat | A cricket-style wooden bat with nails through the end (3 bright dots) |
| Machete | A long dull blade, a bright 1 px edge, a black grip |
| Axe | A red fire axe: red head with a spike, a yellow handle |
| Spear | A broom handle with a kitchen knife lashed on with tape |
| Sledgehammer | A big block head, a long ash handle |
| Cricket bat, golf club | Classic shapes; the golf club has a tartan grip |
| Cleaver | The Butcher's drop: a big square blade with a hole, stained |
| Chainsaw | Orange body, a bar with chain teeth (animated), exhaust smoke |
| Revolver, pistol | Revolver: a cylinder and wooden grip. Pistol: black, a slide line |
| Shotgun, double barrel | Pump with a wooden fore-end; side-by-side barrels with a wood stock |
| Rifle, crossbow, bow | Bolt rifle with a scope; crossbow with string and limbs; recurve bow |
| SMG, Army Rifle | Compact black SMG; an assault rifle with a curved magazine |
| Flare gun, nail gun | Orange flare pistol; yellow nail gun with a hose |
| Blowtorch | A propane bottle, hose and burner |
| Throwables | Brick (red with mortar crumbs); Molotov (a bottle with a rag); pipe bomb (a capped pipe with a fuse); alarm clock (bells on top) |

Muzzle flashes: 3 frames per gun class (small star, wide cone for shotguns, a long flicker for automatics). Shell casings: 1 px brass, bouncing. Tracers: 1 px pale gold, coloured by effect at tier II.

## D9. Items, pickups and icons (12x12, drawn at up to 2x on plaques)
Each icon: a centred object with a 1 px outline and a 3-tone ramp, readable at 1x on the dark HUD.
- **Comforts** as camp signboards: Hot Stew (a steaming pot), Coffee (an enamel mug), Steady hands, Bandages (a roll with a pin), Shoes (trainers), Gasmask, Pack Mule (a backpack), Eagle eye, Barbed, Second Wind (a lungs-and-arrow symbol).
- **Finds:** ammo bag, adrenaline syringe, double-scrap coin pile, dynamite bundle, toolbox, SALE tag, chainsaw, wallet, guts (a smear jar). Rotten finds get a green glow and flies (2 px dots orbiting).
- **Quest and errand items:** jerry can (red, with a spout), battery (black with red and black terminals), tyre, keys (on a fire-service fob), tape (a cassette), teddy bear, supplies box, parcel, bomb, fuse, cable, flare, key, antibiotics (a pill bottle), nails, wheel, food tin, receiver (a ham radio with dials), frequency card (with numbers), case.
- **Keepsakes:** penny, wedding ring, pocket watch, car keys, rosary, polaroid, toy soldier, harmonica, lighter, crossword, photo, dog tag, ticket, dog-food tin. Each one gets a small personal flaw (a scratch, a dent, a name) to sell the loss.
- **Currency:** Scrap (a bolt and washer cluster), Parts (a gear and spring).

## D10. Effects
| Effect | Spec |
|---|---|
| Blood (hit) | 3-6 particles of fresh red, arcing away from the hit, landing as 1-2 px decals. A melee kill adds a 6-10 px splash decal shaped by the hit direction. |
| Blood (pools and trails) | Corpse pools grow over 1 s (3 sizes), go dark (old red) over 20 s, then fade. Wounded walkers drip a dot every 0.5 s. Crawlers leave trails. |
| Gore (explosions) | Chunks (dark red and skin tone) and a scorch decal (radial, #2b1d16 at 60%). |
| Melee feel | Blunt: a shock ring and dust. Blade: a bright 1 px slash arc and extra blood. Stab: sparks. The power attack: a full circular smear in the weapon's colour, dust ring, and debris. |
| Fire | A 3-frame flame (#f0b030 core, #e05a20 edge, #8a2a10 tip), embers rising, a heat shimmer (1 px row offset) over large fires, scorch decals left behind. |
| Smoke and gas | Smoke: soft grey puffs that grow and fade. Bloater gas: yellow-green. Hazmat gas: bright green with a bubbling edge. Smoke bomb: a dense grey wall. |
| Explosions | 5 frames: white flash, orange ball, dark smoke, a debris ring, then the scorch decal. Screen shake per settings. |
| Electricity | Blue-white (#9ad0ff) jagged arcs, 2 frames, sparks. |
| Weather | Rain: 1x3 streaks at an angle, ripples in puddles, a wet sheen on tarmac. Storm: lightning flashes the whole screen for 2 frames plus thunder. Fog: drifting bands at 30% that hide distant sprites. Still: dust motes in light cones. |
| Lighting | Cain's head torch: a warm cone. Street lamps: orange pools with a flicker when power is low. Fires: flickering orange light. Generator on: interior lights spill from windows. |
| UI feedback | Damage numbers in the pixel font, crit in gold. Scrap pops as small spinning bolts. Banners on plaques. |

## D11. Build plan for the art pass
1. **Palette file:** move every colour into `src/render/palette.js` as named ramps (`skin.cain`, `skin.dead`, `brick`, `tarmac` and so on).
2. **Cain first,** then walker plus outfits, then specials in threat order, then survivors and Biscuit.
3. **Terrain tiles** (D4), then walls and fences (D5), then buildings (D6) in the order players see them (the square outwards).
4. **Structures, weapons, items, effects.**
5. Each step: draw at 1x, check silhouettes at 1x, then in the night lighting at 3x. Screenshots of before and after go in the PR.
6. If hand-drawn PNG sheets are made instead, the format is: one sheet per character (columns = frames, rows = 5 views x poses), one sheet per tileset, keyed to the existing cache names.
