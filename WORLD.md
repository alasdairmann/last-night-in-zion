# Last Night in Zion: the world

*Visual and tonal foundation. Prequel to **Project Enoch** (`../Project Enoch`). The folder is still called "Enoch Nights" for historical reasons.*

## The pitch in one line

For a year **Cain** and his partner lived in Zion **in silence**, because the dead hunt by sound. Tonight the partner shot themself. The shot woke the town, and every noise since brings more. **Last Night in Zion is Cain's last night there, fought in waves.**

What he carries out of Zion (the habits, the bandana, the guilt) is what he brings to the camp he later founds in *Project Enoch*.

---

## Where and when

- **About a year after the outbreak.** Not the panicked first weeks. The world has gone quiet, overgrown and settled into a new normal. Cars rust where they stopped. Lawns are knee-high meadows. Nobody's coming to help.
- **Zion is a small English-American town** (keep the blend: county roads and post offices, a fire station and a pub called the Red Lion). Wooded hills around it, a bypass, farmland going wild.
- **A year of careful silence**, visible everywhere: cloth-wrapped door handles, felt pads nailed along floors, chalk "SHH" marks and tally walls, bells with their clappers tied, car batteries pulled, wind chimes cut down.
- **Torn open tonight**: fresh broken glass, kicked-in doors, alarms flashing, fires. The art always shows both layers.
- **Cain**: late 50s, grey beard, red bandana on his left arm, felt-wrapped boots, a head torch. He is the only playable character.

## Tone: *The Walking Dead*, not *Resident Evil*

- **Grounded, human and improvised.** No labs, mutants or glowing weapons at the core. The dead are slow, numerous and relentless, and the horror is how many there are.
- **Quiet and noisy matter.** Gunfire is loud and draws more dead. Ammo is rare. **That is why melee is common**: a bat or a machete is reliable, silent and never runs out.
- **Warmth amid ruin.** As in Enoch, people made a life up here. Bunting over the kitchen, a scarecrow in a hi-vis jacket, the campfire. The game should feel like you're protecting *something*, not just surviving.
- **Bright nature, dull salvage.** Enoch's rule carries over: vivid greens around weathered, mismatched human-made stuff. Night recolours this, but the logic stays the same.

---

## Visual style (shared with Enoch)

Enoch Nights should look like **the same artist made both games**:

- **Chunky pixel art, WorldBox-style.** Hard pixel edges, no anti-aliasing, no gradients, every curve a staircase.
- **3/4 top-down.** You see roofs and front faces. That suits a Boxhead-style shooter perfectly.
- **Light from the upper left** in daylight, with stepped pixel shadows to the lower right.
- **1 px warm near-black outline** (`#2b1d16`) on sprites and icons.
- **Characters about 8 × 12 px in Enoch.** For a shooter you need to read facing direction and weapons, so go 2× (about 16 × 24) with the same proportions and outline weight. Test that first.
- **Same UI language.** Chunky stone-and-olive plaques with dark inset slots, amber/gold numbers, Nunito ExtraBold labels, Silkscreen numerals, snappy motion. Score popups, the round counter and the buy prompts should all use these frames.

### Palette

Reuse Enoch's material palette directly (see `Project Enoch/docs/BUILDINGS.md`):

| Material | Colours |
|---|---|
| Corrugated sheet | `#9aa3a8`, ridges `#6f787d`, rust `#a8552e` |
| Pallet / plywood | `#c49a62`, grain `#8f6a3e` |
| Tarp | blue `#4d7fb8`, green `#5d8a4a`, orange `#d9822b`, grey `#8c8f86` |
| Vehicle paint | cream `#e8dfc6`, faded red `#b5503b`, bus yellow `#e2b53c`, teal `#4d8f8a` |
| Tyres | `#2f2f33` |
| Oil drums | blue `#3e67a0`, red `#a8402f` |
| Meadow | `#4e962f` → `#6cb946` |
| Forest floor | `#3f7d27` → `#579d35` |
| Paths / earth | `#9a7444` → `#c09a62` |
| Trees | outline `#1f4a1e`, `#2f6f2c`, `#46963a`, highlight `#6cbf4a` |

### Night: the new layer this game adds

Enoch is mostly a daytime game, so this is where Enoch Nights earns its own identity:

- **Palette shift, not darkness.** Map every daytime colour to a cooled, desaturated night version (greens go to blue-teal, browns to slate) using a lookup table, not a translucent overlay, so it stays crisp pixel art.
- **Warm light is the hero.** Braziers made from oil drums, hurricane lanterns, the RV's orange windows, torches, muzzle flash and burning barrels. Light pools are **stepped pixel circles** with 2–3 hard bands, in Enoch's amber and orange.
- **Light is gameplay.** Turning on the generator ("the power") lights the searchlight, strings of bulbs and the workshop. Pools of light make the dead visible and the map readable. Darkness means hearing groans before you see anything.
- **Moonlight** comes from the upper left as a cold rim highlight, so silhouettes still read.
- **Red is reserved for danger**: blood, low health, breached barricades, cursed drops. Keep it rare so it shouts.
- **Fog** rolls in on surge rounds, drawn as layered dithered bands rather than blur.

---

## The dead

- **Shamblers, a year gone.** Grey-green skin, clothes torn and faded to the same dull palette as the salvage, which shows they've been out in the weather. What they used to be still shows: a hi-vis vest, a nurse's scrubs, a postman's bag, a hunting jacket, a supermarket tabard. Draw a varied wardrobe from Enoch's scavenging locations.
- **Readable silhouettes:** hunched, arms forward, an uneven gait. One idle frame and 2–4 walking frames are enough. A slight body sway sells it.
- **Corpses persist briefly:** a dark pool, an outflung arm, then a fade (as Enoch already draws them). A field of bodies at the end of a round is part of the satisfaction.
- **Variety stays grounded** (TWD-plausible, no monsters):
  - **Walker:** the baseline
  - **Crawler:** legless, low, easy to miss in tall grass
  - **Bloated:** slow and tough, bursts when killed
  - **Armoured:** riot gear, a firefighter's coat or a motorbike helmet, so you need to switch weapons or get behind it
  - **Fresh / runner:** recently turned, faster, cleaner clothes (later rounds)
  - **The herd:** a surge round where dozens come at once from one compass direction, as Enoch's "horde in the woods" event does
- **Sound over sight:** groans, shuffling through leaves, chain-link rattling. The audio warns you before you see anything.

---

## Melee-first arsenal

Every weapon is improvised or scavenged. Nothing should look factory-new.

**Melee (common, silent, durable)**
- Baseball bat, then a nail bat or a bat wrapped in barbed wire
- Sharpened rebar spear (already on Enoch's gate weapons rack) with long reach
- Machete, hatchet, fire axe, crowbar
- Sledgehammer and shovel: slow, with knockback
- Golf club, cricket bat, hockey stick (the wardrobe of a wrecked country club)
- Upgrades come from the workshop: tape the grip, add nails or a saw blade, weld on rebar

Melee design: short directional swings in your facing direction (works with Boxhead-style controls), **knockback** to make space, **stagger** for crowds, and weapon **durability** that the workshop repairs. Melee kills are worth more points, as knife kills are in CoD.

**Ranged (rare and loud)**
- Revolver or service pistol, hunting rifle, pump shotgun, crossbow (silent, bolts can be picked up), compound bow
- Later: an army-checkpoint rifle as the "wonder weapon"-tier jackpot
- **Every shot makes noise**, which draws nearby walkers toward you. Ranged is a choice, not the default.

**Throwables and placeables**
- Molotovs, pipe bombs, alarm-clock lures (a pocket "monkey bomb")
- Glass-bottle noisemakers to pull a herd away
- Nail boards, stakes, barbed wire and pallet barricades (straight from Enoch's wall upgrades)

---

## In-world versions of the Zombies mechanics

Everything in the CoD feature list should have a grounded, *diegetic* equivalent:

| CoD Zombies | Enoch Nights |
|---|---|
| Points | **Scrap.** Kills, repairs and rescues earn salvage, the same "loot" Enoch's scrapyard processes. Show it as the gold number in a stone plaque. |
| Wall-buys | Weapons hung on **pegboards and gate racks** around the camp |
| Ammo purchase | **Ammo crates** at the guard shack and watchtower |
| Mystery Box | **The supply drop / trader's crate**: a padlocked footlocker. The travelling trader from Enoch takes payment and gives you something random. Instead of a teddy bear, the trader packs up and moves on. |
| Doors / debris | **Fence panels, car barricades, chain-link gates** to cut open or move, which expands the playable camp and the woods beyond |
| Power switch | **The generator** in the scrapyard's tin box. Pull-start it to light the searchlight, workshop tools and string lights. |
| Pack-a-Punch | **The workshop container** ("The Box"): weld, tape and modify a weapon |
| Perks | **Camp comforts**: a hot meal from the Mess (more health), coffee from the lookout (faster reload or swing), Cain's pep talk (revive), a medic's kit. Drawn as signboards and stalls, not vending machines. |
| Barricades | **The palisade itself**: fence panels, pallets and sandbags that the dead tear down and you rebuild plank by plank |
| Traps | Spike boards, a hand-cranked siren lure, a burning oil-drum line, the pickup truck's horn as a distraction |
| Power-up drops | **Scavenged finds** the dead were carrying: a full ammo pouch, a flare (light and fear), adrenaline (fast melee), a cooking-fire meal (heal), a car battery (temporarily power the searchlight) |
| Easter eggs | **Valley lore**: radio broadcasts, who Cain was before, notes from the church tower, the army checkpoint |

---

## Maps: the valley

*Superseded:* the game is now one map, the town of Zion (see `ART-PRD.md` D6 for its buildings). The list below is the older multi-map plan, kept for reference; Enoch's hilltop camp does not exist yet at the time of this game.

1. **Enoch (the hilltop):** in *Project Enoch*, the camp Cain founds after Zion.
2. **The church on the ridge:** pews, bell tower, graveyard. Dead come through the lychgate.
3. **The truck stop off the interstate:** a diner, fuel pumps, an overturned semi. Tight aisles and open forecourt.
4. **The fire station with one engine left:** a big garage with poles. The engine is the end-game exfil.
5. **The flooded garden centre:** greenhouses, shallow water that slows everyone.
6. **The army checkpoint:** sandbags, HESCO barriers, the best (and loudest) guns.
7. **The retirement home on Hill Lane:** corridors, small rooms. Close-quarters melee.
8. **The housing estate:** half-built, scaffolding and diggers. The source of Enoch's fence panels.

Each map uses the same ground rules as Enoch: worn, wobbly dirt paths, sparse detail where people walk, thicker undergrowth at the edges, abandoned cars grown into the grass.

---

## People

- **Survivors look like Enoch's survivors.** The same generated portrait system (skin, hair, beards, bandanas, caps, glasses, scars) and shirt colours. Cain is the only playable character; the survivors he meets tonight are NPCs.
- **Clothing is practical and mismatched**: hoodies, work jackets, hi-vis, layers patched with tarp. Gloves, knee pads made of taped magazines.
- **Banter** in the style of Enoch's daily reports: short, dry, specific ("Found a tin of peaches in a dead man's jacket. Not sharing.").

## Sound

Enoch's synthesised GBA-style score is the base. Night versions use the same melodies slowed and in a minor key, which turn tense when a herd is coming (Enoch already does this on surge nights). Round transitions use a ringing school bell (from the Town Hall's meeting deck at level 5) or the hand-cranked siren.

---

## Assets you can reuse from Project Enoch

There are **no finished image files yet**: Enoch's art is procedural placeholder art drawn in code, with Higgsfield planned for final sprites. Reusable now:

- **Palette and material rules:** `Project Enoch/docs/BUILDINGS.md`
- **Asset brief format and Higgsfield workflow:** `Project Enoch/docs/ART-DIRECTION.md` (reference sheet, transparent PNGs, nearest-neighbour scaling, logged prompts)
- **Procedural sprites:** buildings, tents, trees and ground in `src/map.js`; villagers, zombies, corpses, smoke and lights in `src/life.js` (`drawZombie`)
- **Icons:** `src/icons.js` (12 × 12 grids: skull, ammo-crate-style loot, hammer, etc.)
- **UI frame CSS tokens:** `src/style.css` (`--ui-frame`, `--ui-panel`, `--ui-slot`, `--ui-amber`)
- **Music and SFX synth:** `src/music.js`
- **Location names and story lines:** `src/stories.js`

Plan **one shared reference sheet** for both games before any Higgsfield generation, so sprite scale and outlines match.

## Open questions

1. Same character scale as Enoch, or a 2× "zoomed in" scale? (I'd pick 2× and keep the outline weight.)
2. Should the Enoch hilltop map read the player's Enoch save, or stay standalone?
3. Does Cain's group fight to protect the settlement (a defence story) or go out on night scavenging runs (a raid story)? Both could be modes.
