# Enoch Nights: Product Requirements Document

| | |
|---|---|
| **Product** | Enoch Nights (companion game to *Enoch*) |
| **Version** | 1.0 (demo scope) |
| **Date** | 2026-10-08 |
| **Status** | Draft for development |
| **Platform** | Desktop browser (HTML5 canvas), keyboard only |
| **Players** | Single player |
| **Related docs** | `WORLD.md` (world and visual bible), `../Project Enoch/docs/BUILDINGS.md` (palette and materials), `../Project Enoch/docs/ART-DIRECTION.md` (asset pipeline and UI feel) |

**Changes from WORLD.md:** the demo is set in a **small town**, not the hilltop camp. The demo map does **not** read or reflect the player's Enoch save. Where WORLD.md and this PRD disagree, this PRD wins.

---

## Contents

1. Summary
2. Goals, non-goals and success criteria
3. The Pareto core: 20% of features, 80% of the fun
4. Game loop
5. Controls
6. Player character
7. Combat
8. Economy (Scrap)
9. Weapons and ammo
10. The map: Enoch town
11. Barricades and fortification
12. The generator (power)
13. Traps
14. Scavenged finds (power-ups)
15. Comforts (perks)
16. The workshop (Pack-a-Punch)
17. The trader's crate (Mystery Box)
18. Crafting and buildables
19. The dead (enemies)
20. Rounds, spawning and the director
21. Survival, downed state and game over
22. Noise
23. Camera, rendering and art
24. Audio
25. UI and HUD
26. Menus, pause, save and settings
27. Technical requirements
28. Tuning tables (single source of truth)
29. Debug and developer tools
30. Milestones and build order
31. Acceptance tests
32. Out of scope
33. Open questions
34. Appendix A: CoD Zombies → Enoch Nights feature map

---

## 1. Summary

Enoch Nights is a **single-player, top-down, round-based horde survival game** played entirely on the keyboard. The player is one of Cain's survivors, trapped overnight in the small valley town of **Enoch** (the town the hilltop settlement took its name from) about a year after the outbreak. Every round, more of the dead shamble in from the fields and woods. The player kills them for **Scrap**, spends Scrap on weapons, ammo, barricades, opening up the town, starting the generator, comforts and workshop upgrades, and tries to survive as many rounds as possible.

It combines three things:
- **The systems of Call of Duty: Black Ops Zombies:** kill-to-earn economy, buyable weapons and doors, a power switch, a random box, perks, a weapon upgrade machine, timed drops and endless escalating rounds.
- **The controls of Boxhead:** you face the way you move, and you fire in the direction you face. WASD and Space. No mouse.
- **The world of Enoch:** grounded *Walking Dead*-style rural post-apocalypse, chunky WorldBox-style pixel art, improvised salvage, and **melee as the main way to fight**, because guns are loud and ammo is rare.

**One-sentence pitch:** *Hold a dying town through the night with a nail bat, a generator, and whatever Scrap you can pull off the dead.*

---

## 2. Goals, non-goals and success criteria

### 2.1 Goals
1. **Feel great in the first 30 seconds.** Moving, swinging a bat and knocking a walker back must feel crunchy before any other system exists.
2. **One economy, constant decisions.** Every kill pays Scrap. Every few seconds the player is weighing "spend now or save".
3. **Escalation that never stops.** Each round is visibly harder; the run always ends in death, and the score is the round reached.
4. **Keyboard only, readable at any density.** Over 60 enemies on screen and the player can still see where they are, which way they're facing and what's about to hit them.
5. **Melee-first, guns as a costly tool.** Players should use both, and feel the trade-off.
6. **Unmistakably the same world as Enoch.** Same palette, same pixel rules, same tone.

### 2.2 Non-goals (this version)
- Co-op, online, social features, leaderboards
- Persistent progression, unlocks, prestige, daily challenges
- Main or side quests, Easter eggs, lore collectibles, exfil
- Mouse aiming, controller support (controller is a likely v2)
- More than one map
- Story campaign or cutscenes

### 2.3 Success criteria (playtest targets)
| Metric | Target |
|---|---|
| First-time player reaches round 5 | ≥ 80% |
| First-time player reaches round 10 | 30–50% |
| Median first-run length | 12–20 minutes |
| Players who choose "Play again" immediately after their first death | ≥ 60% |
| Average frame time with 60 enemies + effects on a 2020 laptop | ≤ 16.6 ms (60 fps) |
| Players who can explain the scrap → buy loop unprompted after one run | ≥ 90% |
| Share of kills that are melee across a full run | 35–65% (both styles used) |

---

## 3. The Pareto core: 20% of features, 80% of the fun

I went through the full Black Ops Zombies feature list and asked which features carry the experience. **These ten features are the game.** Everything else adds depth, but the game must be fun with only these. They are milestone 1–2 scope and get the most polish.

| # | Feature | Why it carries the fun | Enoch Nights version |
|---|---|---|---|
| 1 | **Points for every hit and kill** | Constant reward; turns every action into progress | **Scrap** pops off every hit and kill |
| 2 | **Endless escalating rounds** | Tension, a clear score ("I made round 14"), the reason to keep spending | Round counter, more dead each round, health and speed climb |
| 3 | **Buying weapons and ammo from the walls** | The first, simplest spend decision; makes the map a shopping list | **Racks and pegboards** around town |
| 4 | **Doors that open the map** | The map *is* the progression; where to go next is a strategy | **Barricaded gaps, car wrecks and fences** to clear |
| 5 | **Barricades the dead tear down and you rebuild** | Defensive play, breathing room, extra income in quiet moments | **Boarded windows and fence gaps**, rebuilt plank by plank |
| 6 | **Timed drops (Max Ammo, Insta-Kill, Nuke, Double Points)** | Big, sudden, joyful moments; a reason to take risks | **Scavenged finds** dropped by the dead |
| 7 | **The Mystery Box** | The jackpot. Variety and stories each run | **The trader's crate** |
| 8 | **Perks** | Visible permanent power; agonising choices; painful to lose | **Comforts** (hot stew, black coffee, etc.) |
| 9 | **Pack-a-Punch** | The late-game power spike that makes high rounds possible | **The workshop**: weld, tape, upgrade |
| 10 | **The power switch** | A mid-game goal that unlocks everything else; makes the map feel alive | **The generator** |

**Plus two Enoch Nights–specific pillars that hold the game's identity together:**

| # | Pillar | Why |
|---|---|---|
| 11 | **Crunchy directional melee with knockback** | Melee is the default here. If it doesn't feel good, the game fails. |
| 12 | **Noise** | The one rule that makes "melee or gun?" a real choice, and gives the world its *Walking Dead* flavour. |

**Priority rule for the team:** if time is short, polish features 1–12 before building anything else in this document. Features outside this list are marked **[Depth]** throughout and can ship later or be simplified.

---

## 4. Game loop

### 4.1 Moment-to-moment (seconds)
Move → face the dead → swing or shoot → knock back, kill → Scrap pops up → reposition before you're surrounded → repair a plank when there's a gap.

### 4.2 Round-to-round (minutes)
Round starts (bell rings) → dead spawn from the edges and break through barricades → player fights, earns, kites → last few dead → round ends (short break, ~10 s) → player spends: ammo, a door, a weapon, repairs → next round.

### 4.3 Run arc (one session, 15–60 minutes)
| Phase | Rounds | What the player is doing |
|---|---|---|
| **Opening** | 1–3 | Bat or pistol only. Learn melee. Hold Main Street. Repair windows for Scrap. Buy the first rack weapon. |
| **Expansion** | 4–8 | Open the town. Choose a route. Find the generator. Buy first comfort. Try the trader's crate. |
| **Power** | 6–12 | Generator on: comforts and the workshop become usable, traps and lights work. First upgraded weapon. |
| **Holding** | 12–20 | Specials appear (dogs, Brutes). The player picks a "training" route or a defensible corner. Resource management under pressure. |
| **Collapse** | 20+ | Health and numbers outscale the player. Ammo burns fast. The run ends; the score is the round. |

### 4.4 End of run
Death → "You fell on night **N**" screen with stats (§25.6) → Play again (one key) or Main menu.

---

## 5. Controls

Keyboard only. All bindings remappable in Settings (§26.3). Defaults:

| Key | Action | Notes |
|---|---|---|
| **W A S D** | Move in 8 directions | Also the arrow keys, both work at once |
| **Space** | Attack with the held weapon | Melee: swing. Gun: fire (hold for automatic weapons) |
| **Shift** (hold) | **Lock facing / strafe** | Keep facing your current direction while moving. Lets you back away while attacking. |
| **Q / E** | Previous / next weapon | Cycles melee, gun 1, gun 2 (and gun 3 with Pack Mule) |
| **1 / 2 / 3 / 4** | Select slot directly | 1 = melee, 2–4 = guns |
| **R** | Reload | Auto-reloads when empty if Space is pressed |
| **F** (hold) | Interact | Buy, repair, open, start generator, use crate. Hold time per object (§28). |
| **G** | Throw a throwable | In facing direction, at a fixed arc (§9.6) |
| **C** | Shove | Quick knockback push, always available, short cooldown, no damage (§7.4) |
| **Tab** (hold) | Town map overlay | Shows opened zones, prices, generator, crate location |
| **Esc / P** | Pause | |

### 5.1 Facing rules (Boxhead core)
- The character faces the **last direction of movement** (8 directions).
- While **Shift** is held, facing is locked to its value at the moment Shift was pressed; movement does not change it.
- Attacks always go in the facing direction. There is **no aim assist** in the base game (a mild cone is built into melee arcs and shotgun spread).
- Pressing a direction for one frame (a tap) turns the player without moving more than 1 px. Implement this as **turn-in-place**: a tap shorter than 80 ms rotates without stepping. This lets players aim precisely without walking into the dead.

### 5.2 Input handling
- Use `KeyboardEvent.code`, not `key`, so layouts don't break the defaults.
- Diagonals: when two direction keys are held, move diagonally at normalised speed (×0.707 per axis).
- Opposite keys cancel (A + D = no horizontal movement).
- Input is sampled once per fixed simulation tick (§27.2). Buffer an attack press made during a swing's recovery window of up to 120 ms, then execute it.
- Prevent the browser default for Space, Tab and arrow keys while the game is focused.
- Pressing keys while the window is unfocused must not register as held when focus returns (clear key state on `blur`).

---

## 6. Player character

### 6.1 Who you play
**Cain** is the default and only playable character in the demo. He's in his 50s, with a grey beard, a khaki work jacket, a tarp-patch on one shoulder and a bandana. He's drawn from the Enoch portrait system and sprite style (§23.3). Short voice-free text barks appear above his head (§25.5).

### 6.2 Stats
| Stat | Base value |
|---|---|
| Health | 100 HP |
| Health regen | Starts 4 s after last damage; 25 HP/s until full |
| Walk speed | 88 px/s (logical pixels; ~5.5 tiles/s) |
| Speed with Shift held | 75% of walk speed |
| Collision radius | 5 px |
| Damage from a walker hit | 34 HP (so 3 hits down you; 4 with Hot Stew) |
| Invulnerability after a hit | 0.35 s |

### 6.3 Movement feel
- **Instant acceleration and stop** (Boxhead feel). No momentum.
- Slide along walls when moving diagonally into them (resolve per axis).
- The dead push against the player slightly (soft collision): being surrounded slows the player to 60% and **can trap them** if 3+ dead are touching on opposite sides. This is the core "you got cornered" fail state. Shove (§7.4) is the escape tool.

---

## 7. Combat

### 7.1 Melee (the default)
Melee weapons swing in a **cone in the facing direction**.

| Property | Meaning |
|---|---|
| **Reach** | Distance from the player's centre the cone extends |
| **Arc** | Width of the cone, in degrees |
| **Wind-up** | Time before damage applies (telegraph) |
| **Active** | Time window in which hits register |
| **Recovery** | Time after before the next action |
| **Damage** | HP removed from each enemy hit |
| **Cleave** | Max enemies one swing can damage |
| **Knockback** | Distance an enemy is pushed |
| **Stagger** | Time the enemy can't move or attack |
| **Durability** | Swings before the weapon breaks (§9.3) |

Rules:
- Each swing hits each enemy at most once.
- Enemies hit by a swing are knocked back along the vector from player to enemy and play a stagger animation.
- **Hit stop:** on any melee hit, freeze the game for 40 ms (60 ms on a kill). Shake the screen 1 px (2 px on kills with heavy weapons).
- A **critical hit** (head hit) happens when the hit lands while the enemy is in its stagger state: ×1.5 damage and bonus Scrap (§8.2). This rewards hit, stagger, hit rhythm.
- Melee makes **no noise** beyond Quiet (§22).

### 7.2 Guns
- Bullets are **hitscan along the facing direction** out to the weapon's range, except crossbow bolts and thrown weapons, which are projectiles.
- The shot origin is the weapon muzzle, offset from the player by facing.
- **Penetration:** every gun has a penetration value (how many enemies one bullet passes through). Damage falls by 25% per enemy passed.
- **Spread:** 0° for rifles, small random cone for SMGs and pistols, multiple pellets for shotguns.
- Muzzle flash lights the area for 1 frame (§23.6). Shell casings drop as 1 px sprites and fade after 5 s.
- Every shot creates noise (§22).
- Hitting the head: since aim is directional, "headshots" are a **random chance per weapon** (rifle 40%, pistol 15%, shotgun 0%). They do ×2 damage and pay bonus Scrap. Show a distinct hit flash so it feels earned.

### 7.3 Damage feedback
- Hit: the enemy flashes white for 1 frame, then a small blood burst (3–6 dark red pixels, `#7a2a22` and `#a8402f`) spatters in the hit direction.
- Kill: a larger burst, the enemy drops to the corpse sprite (re-use Enoch's corpse: dark pool, torn clothes, outflung arm), and the corpse fades over 8 s. Cap corpses at 60 on screen; fade the oldest first.
- A Scrap number pops up from the enemy (§25.3).

### 7.4 Shove
- **C** pushes every enemy in a 90° cone, reach 18 px, 30 px knockback, 0.6 s stagger, no damage.
- Cooldown: 2.5 s. HUD shows the cooldown.
- Purpose: escape being trapped, set up critical hits, interrupt the Brute's charge (§19).

### 7.5 Friendly fire and self-damage
- Explosives (Molotov, pipe bomb, burning barrels) **damage the player** at 50% of their enemy damage. The Gasmask comfort (§15) removes this.

---

## 8. Economy (Scrap)

### 8.1 Currency
**Scrap** is the only currency in a run. It's the salvage the dead carry: keys, wire, buttons, batteries, a wristwatch. It's shown as an amber number in a stone plaque with the loot icon from Enoch (`loot`: salvage crate with metal poking out).

- Start each run with **500 Scrap**.
- No cap.
- Scrap is lost when the run ends. Nothing carries between runs.

### 8.2 Earning Scrap
| Action | Scrap |
|---|---|
| Damaging hit with a gun (non-lethal) | 10 |
| Damaging hit with melee (non-lethal) | 10 |
| Kill with a gun | 50 |
| Kill with a gun, headshot | 100 |
| **Kill with melee** | **130** |
| Kill with melee, critical hit (§7.1) | 160 |
| Kill with a thrown weapon or trap | 50 (traps: 0, §13) |
| Repairing one barricade plank | 10, capped at 500 per round |
| Killing a dog (§19) | 50 |
| Killing a Brute (§19) | 500 |
| Killing a Looter (§19) | 250 plus everything they stole |
| Round survived bonus | 0 (the economy is about kills, not waiting) |
| Bounty (§8.5) | as shown |

Hits on the last remaining enemy of a round give the same Scrap as normal.

**Why melee pays more:** it's riskier (you need to be close) and it's the identity of this world. Matching CoD's knife-kill bonus, this makes "farming" with melee in early rounds the expert strategy.

### 8.3 Multipliers and streaks
- **Double Scrap** (find, §14) doubles all Scrap earned for 30 s.
- **Streak** **[Depth]**: kills within 2.0 s of the previous kill build a streak. Every 10 kills in a streak adds +10% Scrap (max +50%). The streak breaks on 2.0 s with no kill or on taking damage. HUD shows a small "×1.3" plaque under the Scrap counter, which pulses on increase and drains as a thin bar. This is the Boxhead combo, kept modest so it doesn't overshadow the round economy.

### 8.4 Spending
Everything that costs Scrap is bought with **F** (hold) at a world object. The prompt shows the item name, the cost, and whether you can afford it (amber if yes, red if not). Every price is in §28.

### 8.5 Bounties [Depth]
At the start of some rounds (from round 8, 30% chance), a notice is nailed to the **post office board** in the town square: one marked target (a walker wearing a specific item, e.g. a red raincoat) spawns that round. Killing it pays **400 Scrap**. The target has a small tag icon above its head when on screen. Like-for-like for CoD's special-enemy reward moments.

### 8.6 Dynamic pricing [Depth]
- Each **ammo refill** at the same rack costs the listed price; there's no increase.
- The **trader's crate** costs 950 Scrap, rising by 50 for each pull this run (cap 1,450). The trader's prices go up because demand does.
- Comforts are a flat price.

### 8.7 The town safe (bank) [Depth]
The **bank vault** in the post office (once opened, §10) lets the player **deposit** Scrap in units of 1,000 and **withdraw** it later.
- Deposits earn **5% interest per round survived**, credited at round start (rounded down to 10).
- A 10% fee on withdrawal.
- On being downed (§21), Scrap held by the player drops by 10% (Scrap in the safe is protected).
- Purpose: a single-player version of CoD's banking. It rewards planning ahead and gives a reason to come back to the square.

### 8.8 The trader's loan [Depth]
When the player's Scrap is below 500, the trader (at the crate, §17) offers a **loan of 1,000 Scrap**, repaid automatically from the next 1,500 Scrap earned (a 50% fee). Only one loan at a time. The HUD shows the outstanding debt beneath the Scrap counter in red. Like-for-like for "debt/loans" in the original list.

### 8.9 Parts (secondary currency) [Depth]
**Parts** are a second resource used only for crafting buildables (§18) and barricade upgrades (§11.3). Shown as a small count beside Scrap with Enoch's `materials` icon (timber planks with a steel bar).
- 5% chance per kill to drop a Part (a visible pickup, auto-collected on walk-over, fades after 20 s).
- Specific map locations hold fixed Parts (§18).

---

## 9. Weapons and ammo

### 9.1 Inventory
- **Slot 1: Melee.** Always holds exactly one melee weapon. Start: **Claw hammer**.
- **Slots 2–3: Guns.** Start: slot 2 holds a **revolver** with 6 + 24 rounds. Slot 3 empty.
- **Slot 4: Third gun**, only with the Pack Mule comfort (§15).
- **Throwable pocket:** separate, holds one type of throwable, up to its max.
- Buying a gun when gun slots are full **replaces the held gun** (if a gun is held) or the gun in slot 2 (if melee is held). The prompt says "Replace [name]".
- Buying a melee weapon replaces the current one.
- Switching weapons takes 0.25 s (melee) or 0.4 s (guns). Sleight-equivalent comfort halves it.

### 9.2 Melee weapons

| Weapon | Where | Cost | Dmg | Reach | Arc | Wind / Active / Recover (ms) | Cleave | Knockback | Stagger | Durability |
|---|---|---|---|---|---|---|---|---|---|---|
| Claw hammer | Start | — | 60 | 16 | 70° | 80 / 60 / 220 | 1 | 10 | 0.3 s | ∞ |
| Baseball bat | Rack: Main St hardware | 500 | 110 | 20 | 100° | 120 / 80 / 300 | 3 | 22 | 0.5 s | 150 |
| Machete | Rack: Fire station | 750 | 150 | 20 | 90° | 70 / 60 / 200 | 2 | 8 | 0.25 s | 150 |
| Fire axe | Rack: Fire station (power) | 1,250 | 260 | 22 | 80° | 180 / 80 / 380 | 2 | 18 | 0.6 s | 120 |
| Rebar spear | Rack: Builders' yard | 900 | 170 | 32 | 30° | 100 / 80 / 280 | 4 (in a line) | 14 | 0.4 s | 120 |
| Sledgehammer | Rack: Garage | 1,500 | 400 | 20 | 120° | 300 / 100 / 500 | 5 | 40 | 1.0 s | 100 |
| Cricket bat / golf club | Crate only | — | 130 | 22 | 110° | 110 / 80 / 280 | 3 | 26 | 0.5 s | 150 |
| Nail bat | Workshop upgrade (§16) | — | | | | | | | | |

- **Durability**: each swing that hits at least one enemy uses 1. At 25% the weapon icon cracks and flashes amber. At 0, the weapon breaks and the player falls back to the **claw hammer** (never breaks). Rebuying from a rack (half price) restores full durability. The Workshop's Reinforce upgrade (§16) makes a weapon unbreakable.
- Damage scales with rounds the same way gun damage does: not at all. Enemy health scaling (§20.3) forces upgrades.

### 9.3 Guns

| Gun | Where | Cost | Ammo cost | Damage | Fire | RPM | Mag / reserve | Reload | Range (px) | Pen. | Noise |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Revolver | Start | — | 250 | 100 | Semi | 240 | 6 / 36 | 2.2 s | 200 | 1 | Loud |
| Service pistol | Rack: Police box | 400 | 200 | 70 | Semi | 400 | 15 / 75 | 1.4 s | 180 | 1 | Loud |
| Pump shotgun | Rack: Hardware store | 1,000 | 500 | 8 × 60 | Pump | 70 | 6 / 36 | 0.5 s/shell | 90 | 1 | Very loud |
| Double-barrel | Crate only | — | — | 8 × 80 | Break | 2 shots fast | 2 / 40 | 2.0 s | 80 | 1 | Very loud |
| Hunting rifle | Rack: Hunting shop | 1,200 | 600 | 450 | Bolt | 45 | 5 / 35 | 2.5 s | 360 | 4 | Loud |
| Crossbow | Rack: Church yard | 1,500 | 750 | 300 | Single | 40 | 1 / 20 | 1.6 s | 280 (projectile) | 2 | **Quiet** |
| SMG | Crate only | — | — | 90 | Auto | 700 | 30 / 180 | 2.0 s | 200 | 1 | Loud |
| Assault rifle (army) | Crate only | — | — | 130 | Auto | 600 | 30 / 210 | 2.4 s | 320 | 2 | Very loud |
| Compound bow | Crate only | — | — | 400 (full draw) | Hold to draw | — | 1 / 15 | — | 300 (projectile) | 3 | **Quiet** |
| Flare gun | Crate only | — | — | 250 + fire | Single | 30 | 1 / 8 | 2.0 s | 220 (projectile) | 1 | Loud |
| **Nail gun cannon** (wonder) | Crate only, rare | — | — | 220 | Auto | 450 | 50 / 250 | 3.0 s | 220 | 6 | Medium |

- **Crossbow and bow bolts** stick into enemies or walls and can be **picked up again** by walking over them (1 bolt each) within 30 s. Quiet ranged is precious.
- **Bow:** hold Space to draw (0.8 s to full), release to fire. Partial draw does proportionally less damage and range.
- **Flare gun:** the flare lands and burns for 6 s, lighting a large area and setting enemies in a 20 px radius on fire (30 dmg/s for 4 s). Draws all walkers within 150 px towards it for its burn time (a lure).
- **Nail gun cannon:** the demo's "wonder weapon". A rig built from a framing nailer, a scuba tank and car battery. Nails pierce up to 6 enemies with no damage drop-off and stick dead enemies to walls (purely visual). Lightning-in-a-bottle crate pull: 3% chance.

### 9.4 Ammo
- **Buying ammo**: hold F at the gun's own rack while holding that gun. Refills mag and reserve to max. Price as listed ("Ammo cost").
- A rack sells ammo **only for its own gun** (and its workshop-upgraded version, at 4,500 Scrap).
- Crate-only guns have **no rack**: their ammo comes from Max Ammo finds (§14) and the ammo crate buildable (§18). This is the scarcity that keeps crate guns from being a no-brainer.
- When a gun's mag and reserve both hit 0, the gun's icon greys out. Attacking with it plays an empty click and shows "Out of ammo" over Cain's head.
- **Ammo crates** [Depth] at the police box: 1,500 Scrap, refills **all** carried guns' reserves by 50%. Usable once per round.

### 9.5 Rack weapons ("wall-buys")
- Each rack is a **visible pegboard, gun rack or wall hook** with the weapon's silhouette painted or chalked onto it, so you can see what's on offer from a distance (like CoD's chalk outlines).
- The price is chalked under it and shown in the prompt.
- A rack can be bought from unlimited times.

### 9.6 Throwables
| Throwable | Where | Cost | Max | Effect | Noise |
|---|---|---|---|---|---|
| Brick | Start (2), refills 2 each round | — | 2 | 50 dmg, stagger 0.8 s on the first enemy hit | Quiet |
| Molotov | Rack: Pub | 600 for 3 | 3 | Fire patch 32 px wide, 6 s, 40 dmg/s; enemies inside burn | Medium |
| Pipe bomb | Crate only, or rack: Garage (power) | 1,000 for 2 | 2 | 1.5 s fuse, 300 dmg in 40 px | Very loud |
| **Alarm clock** (lure) | Rack: Post office | 1,000 for 2 | 2 | Lands and rings for 6 s. All walkers within 200 px walk to it. Explodes for 250 dmg at the end. | Loud (that's the point) |
| Bottle (noisemaker) | Free pickups on the map | — | 3 | Smashes, pulls walkers within 120 px for 3 s | Medium |

- Throwables fly along the facing direction in a fixed arc and land 80 px away (or at the first wall).
- Throwable refills: 2 bricks per round. Others must be rebought.

### 9.7 Starting loadout
Claw hammer, revolver (6 + 24 rounds), 2 bricks, 500 Scrap.

---

## 10. The map: Enoch town

### 10.1 Overview
The demo has one map: **Enoch**, a small valley town at the foot of the hill, abandoned for a year. A single crossroads, one high street, a church, a fire station and a few back streets. It's **night**. The map is roughly **96 × 64 tiles** at 16 px/tile (1,536 × 1,024 logical px). Only about a quarter of it is visible on screen at once (§23.1).

The town is divided into **9 zones**. The player starts in Zone 1. Every other zone is behind at least one **obstruction** that costs Scrap to clear.

### 10.2 Zones

```
                 N (woods / spawn)
   +-----------+-----------+-----------+
   | 6 CHURCH  | 7 SCHOOL  | 8 BUILDERS|
   | & yard    | & playing | YARD      |
   |           |  field    |           |
   +-----[$]---+----[$]----+----[$]----+
   | 3 FIRE    | 1 MAIN    | 4 GARAGE  |
   | STATION   | STREET &  | & PETROL  |
   | (gen)     | SQUARE    | STATION   |
   +----[$]----+----[$]----+----[$]----+
   | 5 PUB &   | 2 POST    | 9 HUNTING |
   | car park  | OFFICE &  | SHOP &    |
   |           | PHARMACY  | allotments|
   +-----------+-----------+-----------+
                 S (fields / spawn)
```
Doors ([$]) link adjacent zones as listed in §10.3. The outer ring (woods, fields, the river to the east, the bypass road to the west) is not walkable; it is where the dead come from.

| # | Zone | What's there | Notes |
|---|---|---|---|
| 1 | **Main Street & the square** | War memorial, phone box, bus shelter, the hardware store (bat rack, shotgun rack), boarded shopfronts (6 barricaded windows), the post office board (bounties) | Start. Two open exits blocked by obstructions. Wide but cluttered. |
| 2 | **Post office & pharmacy** | Post office counter, **bank vault** (§8.7), pharmacy shelves, **Bandages** comfort, alarm-clock rack, police box (pistol rack, ammo crate) | Close quarters. Good for a safe-ish room. |
| 3 | **Fire station** | Engine bay with the last fire engine, pole, lockers. **The generator** in a yard out back. Machete rack, fire axe rack (needs power). **Black Coffee** comfort | The key early objective. Two big bay doors on the west side are spawn points. |
| 4 | **Garage & petrol station** | Forecourt, pumps, a car on a lift, a tyre stack, **the Workshop** (§16) in the service bay. Sledgehammer rack, pipe bomb rack (power). **Pack Mule** comfort | The petrol pumps are a trap (§13). |
| 5 | **Pub & car park** | The Red Lion pub with a beer garden, cellar, Molotov rack, **Hot Stew** comfort in the kitchen. Car park with 5 abandoned cars to weave between | Open car park is a good training ground. |
| 6 | **Church & yard** | Nave, pews, bell tower, graveyard, lychgate. Crossbow rack in the vestry. **Steady Hands** comfort. **The trader's crate** can be here | Bell tower: the round-start bell. The graveyard is a spawn point. |
| 7 | **School & playing field** | Classrooms (barricaded windows), canteen, a big open playing field with goalposts | The field is the best loop for kiting large groups. **The searchlight** (generator) covers it. |
| 8 | **Builders' yard** | Scaffold, pallets, a digger, sand piles, portable cabins. Rebar spear rack. Fixed **Parts** spawns (§18). **Gasmask** comfort | Lots of clutter, many crafting spots. |
| 9 | **Hunting shop & allotments** | Hunting rifle rack, the second trader's crate location, allotment sheds, polytunnels, scarecrow. **Second Wind** comfort | Back-gardens feel. Fences everywhere. |

### 10.3 Obstructions ("doors")
Each is a physical blocker drawn in the Enoch salvage style. Clearing one plays a short animation (0.6 s): planks pulled off, a car pushed with a groan, a fence panel kicked down.

| Between | Obstruction | Cost |
|---|---|---|
| 1 ↔ 2 | Boarded post-office door | 750 |
| 1 ↔ 3 | Two wrecked cars across the road | 1,000 |
| 1 ↔ 4 | Chain-link gate with a padlock | 1,000 |
| 1 ↔ 7 | Fence panels across the school alley | 1,250 |
| 2 ↔ 5 | Pallet barricade in the alley | 1,000 |
| 2 ↔ 9 | Back-garden fence | 1,000 |
| 3 ↔ 5 | Overturned skip | 1,250 |
| 3 ↔ 6 | Church gate, chained | 1,250 |
| 4 ↔ 8 | Builders' yard Heras fencing | 1,250 |
| 4 ↔ 9 | Rolled-down shutter | 1,500 |
| 6 ↔ 7 | Hedge with a fallen tree | 1,000 |
| 7 ↔ 8 | Portable cabin blocking the path | 1,500 |

- Opening a door **activates the spawn points** in the newly opened zone (§20.2).
- Opening a door is permanent for the run.
- Total cost to open every door: 13,750 Scrap. The intended path to the generator is 1 → 3 (1,000) or 1 → 2 → 5 → 3 (3,250).

### 10.4 Static map layout rules
- **Every zone has at least two routes out once fully opened**, so the player can't be trapped in a dead end by design. Exception: the pub cellar and the post office vault room (deliberate risk).
- **Chokepoints**: doorways and alleys 2–3 tiles wide.
- **Loops**: the square (around the war memorial), the car park (around the cars), the playing field (open), the church (around the pews and through the graveyard). Loops are where expert players train (§20.6).
- **Cover and clutter**: cars, bins, bus shelter, skips. They block movement and bullets. The dead path around them.
- Building interiors are drawn with **roofs removed** when the player is inside (roof fades out over 150 ms) and roofs drawn when outside. Use Enoch's 3/4 view: you see the front face and the top.

### 10.5 Hazards and environment
| Element | Behaviour |
|---|---|
| **Broken glass** (shop interiors) | Makes a crunch: Quiet noise when walked on. Purely an audio and noise effect. |
| **Car alarms** (3 cars in the car park) | Hitting one with a melee swing, a bullet or an enemy colliding at speed sets it off: **Loud** noise for 10 s, pulling walkers. Can be used deliberately as a lure (§22). One-shot each run. |
| **Fuel puddle** (petrol station) | Flammable. Any fire (Molotov, flare, burning barrel) ignites it for 8 s, 40 dmg/s. |
| **Oil-drum braziers** (lit) | Light sources. Static. Can't be moved. |
| **Explosive barrels** (red drums) | 6 on the map. Shoot or hit them: 1.0 s fuse (hiss), then 300 dmg in 48 px. Player damage per §7.5. They don't respawn. |
| **Darkness** | Unlit areas are hard to see (§23.6). The generator lights more of the town. |
| **Fog** | On fog rounds (§20.5), vision drops further. |
| **Flooded underpass** [Depth] | Under the bypass (zone 9 edge): shallow water slows everything, player and dead, to 60%. |

### 10.6 Map changes during the run [Depth]
- At round 15, the **church bell tower** catches fire (scripted, lit by a flare from "somewhere"): zone 6 becomes brighter but a burning section blocks one route until round 20.
- At round 20, the **fire station's** rear wall collapses: a new permanent spawn point opens in zone 3.

---

## 11. Barricades and fortification

### 11.1 Barricade windows (core)
- Every building has **barricaded openings** (windows, fence gaps, back doors) that the dead must break through to get inside. There are **28** on the map; zone 1 has 6.
- Each barricade has **6 planks** (pallet slats, fence boards, door panels: they look mismatched).
- An enemy at a barricade tears off one plank every 1.0 s (dogs: can't; Brutes: all at once). When all planks are gone, the enemy climbs through (0.8 s) and is inside.
- **Repair**: hold F next to a barricade. One plank goes back up every 0.45 s while held. Each plank pays 10 Scrap (cap 500/round, §8.2).
- The player **cannot be hit while repairing** for the first 0.2 s of each plank (a small grace). Otherwise repairing is risky by design: an enemy on the other side can swipe through the gap at a damaged barricade (if 3 or fewer planks remain), dealing 34 damage.
- Enemies trying to get in at a fully boarded window wait there and keep tearing.
- Outdoor zones (car park, playing field, allotments) have **fence-gap barricades** instead of windows. Same rules.

### 11.2 Planks visual
- Each plank is a separate sprite placed with a slight random tilt and colour pulled from the pallet/plywood/fence palette.
- Torn-off planks fly 8–16 px away and lie on the ground until the barricade is repaired (then they lift back in an arc, 150 ms).

### 11.3 Reinforcement [Depth]
With the generator on, the player can reinforce a barricade at the **workshop bench prompt** shown on any barricade:
| Tier | Cost | Effect | Visual |
|---|---|---|---|
| Steel bars | 3 Parts | Each plank takes 2.0 s to tear | Welded rebar across the window |
| Sheet metal | 6 Parts | 3.0 s per plank; walkers attacking it take 10 dmg per tear | Corrugated sheet screwed on, rusty |
Reinforcement survives a full tear-down and is restored with the planks.

### 11.4 Placeables
These are throwable-style deployables that the player sets down in front of them with **G** when the placeable is selected as the pocket item (they replace the throwable). Bought from the Builders' yard rack.
| Placeable | Cost | Effect |
|---|---|---|
| **Nail board** | 750 for 3 | Placed on the ground. First 8 walkers that step on it take 80 dmg and stagger 1.0 s. Then it breaks. |
| **Barbed wire coil** | 1,000 for 2 | A 3-tile line. Dead crossing it slow to 40% and take 10 dmg/s. Lasts 60 s or 30 dead. |
| **Pallet wall** | 1,250 for 2 | A 2-tile wall. Blocks movement. 600 HP; the dead attack it. The player can repair it like a barricade. Lasts until destroyed. |
Max 6 placeables in the world at once; the oldest disappears when a 7th is placed.

### 11.5 The Carpenter equivalent
See §14: **Toolbox** find.

---

## 12. The generator (power)

### 12.1 What it is
A **diesel generator in a corrugated-tin box** (straight from Enoch's scrapyard level 5) in the fire station's back yard, zone 3. Cables run from it across the town on poles and rooftops (visible as a sagging line from the start, so players can follow them).

### 12.2 Starting it
- Hold F for **1.5 s** (pull-start: 3 tugs, each with a rising cough). No Scrap cost: the cost is reaching it.
- On start: the sound of the engine catching, then a **town-wide event (2.0 s)**: lights flick on zone by zone (string lights over the square, the searchlight on the school, shop signs half-working, a jukebox in the pub). The music shifts to a fuller version (§24). A plaque: **"THE LIGHTS ARE ON IN ENOCH"**.

### 12.3 What it powers
| Unlocks | Detail |
|---|---|
| **Comforts** | All comforts are "closed" until the generator runs (§15). Exception: Bandages, which works without power (single player needs one early lifeline). |
| **The workshop** | Power tools (§16) |
| **Traps** | §13 |
| **Lighting** | Street lamps, the searchlight and signs light large areas (§23.6) |
| **Power-only racks** | Fire axe, pipe bombs |
| **Barricade reinforcement** | §11.3 |

### 12.4 Running out of fuel [Depth]
The generator has a **fuel gauge** (shown on the Tab map and the HUD power icon):
- Full tank = **8 rounds**.
- Refuel with a **jerry can**: pick one up from the petrol station (zone 4) for 500 Scrap and carry it (slot replaces throwable until used; Cain carries it visibly, slowing him to 85%) to the generator. Hold F for 1.0 s to refill.
- When fuel runs out, everything in §12.3 switches off. Comforts the player already has **stay**. The lights go out zone by zone (reverse of §12.2). The music thins out.
- **Why:** this is resource management in the spirit of the original list (switching on power), extended to give a recurring mid- and late-game errand and a dramatic moment when the lights die mid-round.

### 12.5 Partial power [Depth]
The **fuse board** in the fire station lets the player choose, at a 1.0 s hold, to **shed one zone's lights** to stretch fuel to 10 rounds. Optional for v1; ship the gauge first.

---

## 13. Traps
All traps need the generator running. Each has an activation switch (hold F 0.5 s), a Scrap cost, an active time and a cooldown. During cooldown the switch's lamp is red.

| Trap | Location | Cost | Active | Cooldown | Effect |
|---|---|---|---|---|---|
| **Electrified fence** | Allotments (zone 9) gate, Builders' yard entrance (zone 8) | 1,000 | 25 s | 60 s | A chain-link panel live-wired to the generator. Kills any walker that touches it; dogs and Brutes take 400 dmg. Sparks and buzzing. |
| **Fire line** | Pub car park (zone 5) | 1,000 | 20 s | 60 s | A line of oil drums and a petrol trail lights up. Enemies crossing it burn (40 dmg/s, 4 s). |
| **Petrol pump spray** | Petrol station (zone 4) | 1,500 | 15 s | 90 s | Sprays fuel across the forecourt, then ignites. Large area, 80 dmg/s. |
| **Church bell** (lure) | Church bell tower (zone 6) | 750 | 15 s | 120 s | Rings: all walkers on the map head for the churchyard. Doesn't kill. Used to clear pressure on the player, or to bunch enemies for an explosive. |
| **Searchlight blind** [Depth] | School (zone 7) | 500 | 10 s | 45 s | Swings onto the playing field: enemies in its beam move at 50% speed. |

Rules:
- **Traps kill the player** if the player is inside them (the electrified fence and fire line deal 50 dmg/s to the player; this can down them).
- Trap kills pay **no Scrap**, as in CoD. The cost buys breathing room, not money.
- Traps cannot be activated while already active or cooling down.

---

## 14. Scavenged finds (power-ups)

### 14.1 Dropping
- When an enemy dies there's a **chance it drops a find** (it was carrying something).
- Base chance: **2% per kill**. Max **4 finds per round**. Finds can't drop from trap kills.
- A **pity counter** forces a drop if 50 kills pass without one in a round, if the round cap isn't reached.
- Finds are drawn from a **shuffled bag** of the eight core finds (each appears once per bag; when the bag is empty, reshuffle). Max Ammo can't be drawn twice in a row across a reshuffle. This mirrors CoD's predictable cycle, and expert players can learn it.
- The find is a pixel item **glowing amber** with a pulsing stepped-pixel light circle, floating 2 px up and down. It plays a soft chime when it appears.
- Lasts **26 s**. Blinks from 20 s (slow), 23 s (fast). Then vanishes with a puff.
- Picked up by walking over it. **Pickup**: big text banner over the HUD for 1.5 s, a distinct sound, and Cain says a short line (§25.5).

### 14.2 The finds (like-for-like with CoD)

| CoD power-up | Enoch Nights find | Looks like | Effect | Duration |
|---|---|---|---|---|
| Max Ammo | **Ammo Bag** | Bulging canvas haversack | Fills mag and reserve for every carried gun, refills throwables to max, restores melee durability to full | Instant |
| Insta-Kill | **Adrenaline** | A medical syringe and auto-injector | Every hit kills any normal enemy (dogs and Brutes take ×4 damage). The screen edge pulses red. | 30 s |
| Double Points | **Double Scrap** | A battered cash tin bursting with salvage | All Scrap earned ×2 | 30 s |
| Nuke | **Dynamite** | A bundle of mining dynamite with a fizzing fuse | 1.0 s after pickup: a white flash and boom. Every enemy on the map dies (Brutes take 2,000 dmg). +400 Scrap flat. No per-kill Scrap. | Instant |
| Carpenter | **Toolbox** | A red toolbox | Every barricade on the map repairs fully over 1.5 s (planks fly back zone by zone). +200 Scrap. Placeables repair to full. | Instant |
| Fire Sale | **Trader's Sale** | A trader's handbell | The trader's crate costs 10 Scrap and appears at **all** crate locations | 30 s |
| Death Machine | **The Chainsaw** | A chainsaw on the ground | Cain wields a chainsaw: continuous cone damage of 600/s in front, 22 px reach, no knockback, constant medium noise. Replaces the held weapon temporarily. | 30 s |
| Bonus Points | **Wallet** | A leather wallet | +500 Scrap instantly | Instant |
| Zombie Blood | **Walker Guts** (from TWD) | A jar of rotten guts | Cain smears himself in guts. Walkers ignore him unless he attacks one directly (then that one alone notices). Dogs still track him. Drawn as a dark green tint. | 20 s |

### 14.3 Drop rules, extended
- When two timed finds are active, show both timers stacked (§25.2). A second pickup of the same type **resets** its timer to full (doesn't stack beyond).
- **Cursed finds** [Depth], from round 15, 10% of drops are **rotten** (find glows sickly green, not amber): touching one has a 50/50 chance of either its normal effect or a curse:
  - **Dry**: Lose all reserve ammo for the held gun.
  - **Rush**: Next 10 dead spawn as runners.
  - **Bait**: Every walker on the map targets Cain at once for 10 s, regardless of noise or Walker Guts.
  Players can walk around rotten finds and let them expire. Risky reward.
- **Carry-back finds** [Depth]: on some rounds (§20.5), one find is a **supply sack** that has to be carried (walk over it, then it slows Cain to 80%) back to the square's war memorial. When delivered, it gives two random finds at once.

---

## 15. Comforts (perks)

### 15.1 What they are
Comforts are **permanent upgrades for Cain** (until he's downed). Each is bought at a physical place in town. They are signboards, stalls and spots, not machines: a stove with a pot, a coffee urn, a bench with a medic's bag.

- Each comfort location has a **sign** with a bright icon, readable from a distance, and plays a **short identifying jingle** (8 bars in Enoch's GBA-style synth, §24) when the player is near (30% chance every 60 s, within 120 px). This replaces CoD's perk jingles.
- Cost is paid with F (hold 0.8 s). Cain plays a short drink, eat or strap-on animation (1.0 s, he can't attack but can move at 50%).
- **Comfort cap: 4.** The cap rises to 5 with an upgrade (§15.4).
- Comforts need **power**, except Bandages.
- A HUD row shows held comforts as 12 × 12 icons in stone slots (§25.2).
- **Losing them:** if Cain is downed (§21) and revived by Second Wind or Bandages, he **loses all comforts** except the one used to revive. They must be rebought.

### 15.2 The comforts (like-for-like with every CoD perk listed)

| CoD perk | Enoch Nights comfort | Place | Cost | Effect |
|---|---|---|---|---|
| Juggernog | **Hot Stew** | Pub kitchen (zone 5): a blackened stockpot over a drum stove | 2,500 | Max health 100 → 250 (walkers need 8 hits instead of 3). |
| Speed Cola | **Black Coffee** | Fire station mess (zone 3): a dented coffee urn | 3,000 | Reload and weapon swap 50% faster. Melee recovery 25% faster. |
| Double Tap | **Steady Hands** | Church vestry (zone 6): a bottle of communion wine and a candle | 2,000 | Guns fire 33% faster and every bullet hits twice (×2 dmg). Melee wind-up 20% faster. |
| Quick Revive | **Bandages** | Pharmacy (zone 2): a medic's bag on a counter | 500 | **Single player self-revive** (§21.3). Usable 3 times per run: then the bag is empty and the counter shows "Out of stock". Also: health regen starts after 2 s instead of 4. **Works without power.** |
| Stamin-Up | **Running Shoes** | Hunting shop (zone 9): a pair of trail shoes on a shelf | 2,000 | Move speed +12%. Shift-strafe speed 75% → 90%. |
| PhD Flopper | **Gasmask** | Builders' yard (zone 8): a respirator on a hook | 2,500 | Immune to your own explosives and fire, and to trap damage. Being knocked down by a Brute charge stuns for 0.2 s instead of 0.8 s. **The Shove (C) becomes a 0.3 s dash** that knocks back everything in its path. |
| Mule Kick | **Pack Mule** | Garage (zone 4): a hiking rucksack | 4,000 | Third gun slot (slot 4). If Cain is downed, the gun in slot 4 is lost. |
| Deadshot | **Eagle Eye** | School (zone 7): a pair of binoculars on the caretaker's desk | 1,500 | Headshot and critical chance doubled (§7.1, §7.2). Gun spread −50%. Melee arc +20°. Facing snaps to a target within 10° of the facing line (the only aim assist). |
| Widow's Wine | **Barbed Wrap** | Builders' yard (zone 8): a roll of barbed wire on the bench | 4,000 | When a walker hits Cain, all enemies within 40 px are snared (slowed 80%) for 3 s. Bricks become **wire-wrapped**: snare in 40 px on impact. Throwable refill: +1. |

### 15.3 Comfort flavours [Depth]
Once the player has held a comfort for **5 rounds**, it ripens. The icon gains a gold rim and a small second effect:

| Comfort | Ripened bonus |
|---|---|
| Hot Stew | +10% damage resistance |
| Black Coffee | Reloading a gun with an empty mag reloads it instantly every 30 s |
| Steady Hands | Ammo refills at racks cost 25% less |
| Bandages | Self-revive leaves 2 s of invulnerability and a free shove |
| Running Shoes | No slow from being surrounded (§6.3) |
| Gasmask | Explosions heal 10 HP |
| Pack Mule | Weapon swap is instant |
| Eagle Eye | Critical hits stagger every enemy in a 20 px radius |
| Barbed Wrap | Snared enemies take 10 dmg/s |

### 15.4 Raising the cap [Depth]
The **comfort cap rises to 5** when the player kills their first Brute (§19). A short banner: "ENOCH IS GETTING USED TO YOU".

### 15.5 Free comfort [Depth]
Once per run, a **random comfort** spawns as a free pickup on a Brute kill (in addition to its usual drop), if the player has room. A gentle catch-up gift.

### 15.6 Moving comforts [Depth]
Not used. Comforts are fixed so the map is learnable.

---

## 16. The workshop (Pack-a-Punch)

### 16.1 What it is
The **service bay of the garage** in zone 4. A car on a lift, a bench with a vice, a welding torch, a pegboard of tools, and an angle grinder throwing sparks. It's Enoch's "The Box" workshop moved into town. **Needs power.**

### 16.2 Using it
- Hold F at the bench while holding a weapon. Cost: **5,000 Scrap** (guns and melee).
- Cain hands the weapon over. The bench works for **4 s** (sparks, grinding, a hammer clanging). The player has nothing in that hand; Cain can still shove (C) and move.
- The upgraded weapon sits on the bench for **15 s**. Hold F to take it. If not taken, it's **lost**.
- A weapon can be upgraded **up to 3 times** (tiers I, II, III). Tier II costs 7,500, Tier III 10,000.

### 16.3 What upgrading does
**Every gun:**
| Tier | Effect |
|---|---|
| I | Damage ×2. Mag ×1.5, reserve ×2. New name, painted with tape and a stencilled number. Ammo refill at its rack costs 4,500. |
| II | Damage ×1.5 more. Adds an **effect** (below). |
| III | Damage ×1.25 more. Effect is stronger. Gun glows faintly amber at the muzzle. |

**Every melee weapon:**
| Tier | Effect |
|---|---|
| I | Damage ×2, reach +4, **unbreakable** |
| II | Adds an **effect**. Cleave +1. |
| III | Damage ×1.5 more. Stagger ×1.5. |

**Effects** (chosen at Tier II from a random pick of 2, shown as two options on the bench prompt, Q/E to choose, F to confirm):
| Effect | Like-for-like (CoD elemental Pack-a-Punch) | Behaviour |
|---|---|---|
| **Burn** (soaked in fuel) | Napalm / Blast Furnace | 15% chance per hit to set the target on fire: 40 dmg/s for 4 s, spreads to touching enemies once |
| **Shock** (car-battery wired) | Dead Wire | 15% chance to arc to 3 nearby enemies for 50% damage |
| **Chill** (CO₂ canister) | Cryofreeze | 20% chance to slow the target 60% for 3 s. Kills while slowed shatter (no corpse) |
| **Rot** (soaked in guts) | Turned | 5% chance to turn the target into an ally for 10 s: it attacks other dead, then falls |
| **Bleed** (nails and saw blades) | Thunder Wall-ish / bleed | Every hit adds a bleed stack: 15 dmg/s each, max 5 stacks |

### 16.4 Upgraded names (examples)
Bat → **Nail Bat** → **Barbed Nail Bat** → **"Lucille"**-style named version (**"Mabel"** in the demo, to avoid using the TWD name). Revolver → **Six-Shot Sally** → … The team writes the full name list. Upgraded weapon art adds visible changes each tier (tape, nails, wire, welded plates).

---

## 17. The trader's crate (Mystery Box)

### 17.1 What it is
The **travelling trader** from Enoch has left a **padlocked green army footlocker** in town, with a battered radio on top playing her signature tune. It's at one of **4 locations**: the square (zone 1, the start position), the church yard (6), the hunting shop (9), the builders' yard (8). The current location has a **lantern** burning beside it, visible from far away, and a beam of warm light into the sky (stepped pixel column) for 10 s after it moves.

### 17.2 Using it
- Cost: **950 Scrap** (rises with use, §8.6).
- Hold F (0.4 s). The lid opens. **Weapons cycle** visibly above the crate (icon flicker, 10 changes slowing over 4 s, with a ticking sound like a dial).
- The final weapon sits there for **12 s**. Hold F to take it (replaces a gun or melee per §9.1). If not taken, it's gone.
- The crate can give **any gun or melee weapon** in the game except the claw hammer, the revolver and anything the player is already carrying.

### 17.3 Weights
| Weapon | Weight |
|---|---|
| Service pistol | 8 |
| Pump shotgun | 8 |
| Hunting rifle | 8 |
| Crossbow | 7 |
| Baseball bat / Machete / Rebar spear / Fire axe / Sledgehammer | 6 each |
| Cricket bat / Golf club | 5 each |
| Double-barrel | 6 |
| SMG | 6 |
| Compound bow | 5 |
| Flare gun | 4 |
| Molotov ×3 / Pipe bomb ×2 / Alarm clock ×2 (pocket refill) | 3 each |
| Assault rifle | 4 |
| **Nail gun cannon** | 3 (≈ 3%) |
- **Pity rule**: after 8 pulls without the Nail gun cannon, its weight doubles for each following pull until it appears.

### 17.4 The trader moves on (teddy bear)
- After **4–10** pulls (random per stop), the cycle ends on the trader's **"CLOSED" sign** instead of a weapon. The player's Scrap is **refunded**. The radio plays a falling tune. The crate lifts away and **moves** to a different location over 6 s (a puff and the lantern goes out). Like-for-like for the teddy bear.
- During a **Trader's Sale** find (§14.2), the crate can't move.

### 17.5 Loan
See §8.8: the trader offers loans at the crate.

---

## 18. Crafting and buildables [Depth]

### 18.1 Concept
Like the buildables of later Black Ops maps. Cain picks up **specific parts** found around town and assembles them at a **workbench** into a usable item.

- Specific parts sit in **fixed rooms but random positions** each run (3 candidate spots per part, one chosen at random at run start).
- Parts show as an amber sparkle on the ground, collected by walking over them. Each run shows found parts in the HUD under "Parts list" while a buildable is incomplete.
- Workbenches: the garage (zone 4), the builders' yard (zone 8), the fire station (zone 3). Any bench works for any buildable.
- Building takes a 2.0 s hold of F.

### 18.2 Buildables
| Buildable | Parts (3 each) | Effect |
|---|---|---|
| **Riot shield** | Bin lid (zone 1), belt (zone 5), bolts (zone 8) | Held in the gun slot. Blocks frontal hits (300 HP before breaking; regenerates at a bench). Space bashes for 100 dmg + knockback. Can be planted (G) as a 1-tile wall. |
| **Ammo crate** | Ammo tin (zone 2), cargo strap (zone 4), pallet (zone 8) | Placed once. Refills all reserves by 50%, once per round. Lasts the run. |
| **Lawnmower turret** | Engine (zone 9), car battery (zone 4), wheels (zone 7) | Placeable turret: shreds anything in a 3-tile cone for 30 s. Rebuild at a bench (cooldown 3 rounds). Very loud. |
| **Tin-can alarm** | Cans (zone 5), string (zone 6), pegs (zone 9) | A tripwire between two posts placed by Cain. When the dead cross it, a rattle and a HUD arrow show where they came from. Early warning. |

---

## 19. The dead (enemies)

All enemies are **grounded** (*Walking Dead* style). No mutants. Variety comes from clothing and behaviour.

### 19.1 Common behaviour
- Pathfinding: flow field from the player's tile, recomputed every 250 ms (§27.4). Enemies outside the player's reachable zones path to the **nearest barricade or open entrance** instead.
- Soft separation between enemies (they jostle, never overlap fully).
- **Groan** randomly every 3–8 s within audible range (§24).
- Attack: when within 8 px of the player, wind up for 0.5 s (arms rise, visible), then swipe. Interrupted by stagger.
- **Knockback** and **stagger** apply as per weapon.
- Health scales with round (§20.3).

### 19.2 Walker types

| Type | From round | Share of spawns | HP (× round scale) | Speed | Behaviour / look |
|---|---|---|---|---|---|
| **Walker** | 1 | Base | 1.0× | Shamble 30 px/s (round 1–3), walk 45 (4–8), lurch 60 (9+) | Hunched, arms forward. Wardrobe from §19.4. |
| **Crawler** | 3 | 10% | 0.6× | 20 px/s | Legless. Low sprite (half height); hard to see in grass and dark. Can't climb through barricades fast (2× time). Can't be knocked back. Explosives turn some walkers into crawlers (25% chance on survivable explosive damage). |
| **Bloater** | 7 | 6% | 2.5× | 25 px/s | Swollen, bursting clothes. Dies in a burst of gas: 2 s cloud, 20 dmg/s to the player, and blocks vision. Melee kills cause the burst at the player; killing at range is safer. |
| **Armoured** | 10 | 8% | 1.5× | Walk | Riot gear, firefighter coat, motorbike helmet. **Takes 75% less damage from the front** (gun or melee) until the armour breaks (200 × round scale dmg). Shove + hit from behind, or explosives, or the sledgehammer (ignores armour). |
| **Runner (fresh)** | 12 | 5% → 25% at round 25 | 0.8× | 110 px/s (faster than the player) | Recently turned: cleaner clothes, reddish skin tone, upright posture. Spawns with a scream (2 s audio cue). Must be fought, not outrun. |

### 19.3 Specials

**Dogs (hellhounds)**
- **Dog rounds** happen every 4–6 rounds starting at round 5 (first one guaranteed between rounds 5 and 7). No walkers that round.
- Packs of feral, turned dogs: thin, matted, a collar still on. 70 HP at their first round (×1.2 each dog round after). Speed 140 px/s. Attack: lunge (fast 0.25 s wind-up), 25 dmg. Can't break barricades: they spawn **in open space** near the player, preceded by howling (1.5 s warning) and a **pixel fog puff** at each spawn spot.
- Count: 6 at the first dog round, +2 per dog round, cap 24.
- The **last dog killed always drops an Ammo Bag** (§14.2), as in CoD.
- From round 15, 1–2 dogs mix into normal rounds.

**The Brute (Panzer Soldat / Brutus equivalent)**
- A huge former **riot policeman**: shield, helmet and body armour, a chain around his wrist. 3,000 HP at first spawn, +2,000 every Brute spawn after.
- First appears at round 9, then every 4–5 rounds. Arrives with a **siren wail** (8 s warning) and a flashing blue light at his spawn point.
- **Behaviour**: walks at walker speed. Every 8 s, **charges** in a straight line at 160 px/s for 1.0 s (red flash on his helmet 0.6 s before; a telegraph line on the ground). The charge knocks Cain down (0.8 s stun, 60 dmg) and **smashes through barricades and placeables**.
- Takes **75% less damage from the front** (shield). Shove (C) during the charge's wind-up **stops it** and stuns him 1.5 s; his back is open. Explosives and Burn effect deal full damage.
- Kill reward: 500 Scrap and a guaranteed find (§14).
- **He also disables** [Depth] whatever the player last powered (one trap, or the workshop for one round) if he reaches it: he has a tendency to wreck things. CoD Brutus-like.

**The Looter (thief)**
- A **living** survivor, not a zombie. Hood, backpack, a crowbar. Spawns at most once per 3 rounds from round 6, with a 25% chance per eligible round.
- He runs (100 px/s) towards **the nearest comfort sign or the bank vault**. Every hit Cain takes from him **steals 500 Scrap** (or a carried throwable if Scrap < 500). If he reaches a comfort sign first, that comfort is **locked** for 2 rounds (CoD monkey-style "steals a perk" from the location, not the player).
- 400 HP flat. Flees after 30 s or after stealing 3 times, dropping smoke (vision block).
- Kill: drops everything stolen plus 250 Scrap.
- **Why it fits**: in *Walking Dead*, the living are as dangerous as the dead.

### 19.4 Wardrobe (visual variety)
Each walker spawns with a random outfit, seeded per spawn. At least 12 outfits for v1, pulled from Enoch's scavenging locations: hi-vis road worker, nurse's scrubs, postman with a bag, hunting jacket, supermarket tabard, hoodie and jeans, suit and tie, school uniform (older teen), fire service jacket, chef's whites, farmer's overalls and wellies, pub barmaid's apron. Skin is Enoch's grey-green (`#79b04c`, `#6fa84a`) with variants. Eyes are the single red pixel (`#e03a2a`) from Enoch's zombie sprite, kept at the larger scale as a 1–2 px glow so you see them in the dark.

### 19.5 Enemy sounds as information
| Cue | Meaning |
|---|---|
| Wood splintering | A barricade is losing planks (directional, §24.3) |
| Scream | A runner spawned |
| Howling | Dog round starting / dogs spawning |
| Siren wail | The Brute is coming |
| Running footsteps + rattling | The Looter is in town |

---

## 20. Rounds, spawning and the director

### 20.1 Round flow
1. **Round start**: the church bell tolls once per round number up to 5, then once (long) after (§24). Round number animates on the HUD (big amber numeral, 1.0 s).
2. **Spawning**: the round's total enemy count is set (§20.3). Enemies spawn over time, limited by an **active cap**.
3. **Round end**: when every enemy of the round is dead, a "round over" sting plays; the round number on the HUD blinks for 2 s.
4. **Break**: **10 s** before the next round (§28). During the break, no new enemies spawn. The HUD shows a small countdown.

### 20.2 Spawn points
- Each zone has **3–6 spawn points**: outside a barricade (most), at the treeline edge of outdoor zones, a drain, the graveyard, the fire station bay doors.
- A spawn point is **active** only if its zone is open (§10.3).
- Spawn choice: pick from active spawn points weighted toward the ones **closest to the player** (by path distance): 60% from the nearest third, 30% from the middle third, 10% from the farthest third. Never spawn within 96 px or within the visible screen of the player **unless** it's a barricade spawn (they come from outside the window).
- Dogs spawn in open space between 80 and 160 px from the player.

### 20.3 Scaling formulas (single player)
- **Enemies per round** (total):
  `count(r) = round(6 + 2.5 × (r − 1) + 0.09 × r²)`, capped at 160.
  Round 1: 6. Round 5: 18. Round 10: 38. Round 15: 61. Round 20: 90. Round 30: 160 (cap).
- **Active cap** (max alive at once): `min(24, 6 + r)`. With a performance budget up to 60 when we tune later.
- **Spawn interval**: `max(0.4, 2.0 − 0.08 × (r − 1))` seconds between spawns while under the cap.
- **Walker health**:
  - Rounds 1–9: `150 + 100 × (r − 1)`
  - Rounds 10+: `previous × 1.1` each round
  - Round 1: 150. Round 5: 550. Round 9: 950. Round 10: 1,045. Round 20: ≈2,710. Round 30: ≈7,030.
- **Speed tiers**: shamble until round 3, walk from round 4, a mix of walk and lurch from 7, mostly lurch from round 12. Runners per §19.2.
- **Damage to player**: flat (34 per walker hit). The threat grows through numbers, health and speed, not damage.

These are CoD's well-tested curves, made slightly gentler for single player and a keyboard-only game. **Tune in §28, not in code.**

### 20.4 The last walker
- When **3 or fewer** enemies remain, each becomes outlined with a 1 px dim amber edge, and the HUD shows "**3 left**".
- When **only one** remains and it hasn't reached the player for 20 s, it **speeds up** to the current runner speed so a round can't stall forever.
- Expert tactic (keep a crawler alive to buy time) is **allowed**: a crawler never speeds up. That's deliberate, as in CoD.

### 20.5 Special round types [Depth]
| Round type | When | What |
|---|---|---|
| Dog round | §19.3 | Dogs only |
| **Fog round** | 15% chance from round 8, never twice in a row | Thick dithered fog: vision radius halves. Walkers move 10% slower. |
| **Herd round** | Every 10th round | All spawns come from **one compass direction** (shown as a HUD arrow and "THE HERD IS COMING FROM THE NORTH" 5 s before). ×1.3 count. |
| **Supply round** | 10% chance from round 6 | One find is a carry-back sack (§14.3) |
| **Bounty round** | §8.5 | One marked target |

### 20.6 The director (pacing) [Depth]
A light-touch AI director:
- Tracks **pressure** = (enemies within 80 px of the player × 2) + (damage taken in the last 10 s / 10) + (1 if health < 40%).
- If pressure > 8 for 6 s straight, **delay the next 3 spawns by +1 s each** (a breather).
- If pressure < 1 for 15 s and enemies remain to be spawned, **spawn the next one immediately** from the nearest active spawn point.
- The director **never** changes counts, health or damage: only timing. It must not feel like rubber-banding.

### 20.7 Training
Players will run in loops with a big group following them, then turn and cut through it. Support this:
- Enemies follow the player's path rather than predicting it, so groups bunch into a "train".
- Melee cleave and gun penetration let one strike hit a bunched line.
- Loops in §10.4 must have no snag points (test this; §31).

---

## 21. Survival, downed state and game over

### 21.1 Health
100 HP base (250 with Hot Stew). Regen per §6.2. At 34% or lower: the screen edges get a pulsing dark-red vignette (stepped pixel border, not a blur), heartbeat audio, and the music ducks.

### 21.2 Going down
When HP reaches 0:
- **If Cain has Bandages with a use left**, he enters the **downed state**:
  - He falls and **crawls** at 25 px/s. He can only use a pistol (if he has the service pistol or revolver; otherwise a free "last-chance" revolver with 12 rounds is drawn).
  - After **6 s** he gets back up (self-revive) with 100% HP, 2 s of invulnerability and a free shockwave shove that knocks back everything within 40 px.
  - He **loses all comforts** except Bandages (whose use counter drops by 1). See §15.1.
  - 10% of held Scrap is lost (rounded to 10).
- **If not**, the run ends (§21.4).

### 21.3 Second Wind (single-player extra)
CoD single player relies on Quick Revive. Enoch Nights adds a second, harder-to-get lifeline:
- **Second Wind** is the **comfort at the hunting shop (zone 9)** that replaces the CoD revive-a-teammate role. It doesn't take a comfort slot. Cost: 1,500. **Single use**: if Cain goes down without Bandages, he gets back up as in §21.2 and Second Wind is consumed. Can be bought again for 3,000, then 4,500.
(The Running Shoes are at the hunting shop too; make it a shop counter with two items.)

### 21.4 Game over
- Slow motion (×0.3 for 1.5 s), the music cuts to a single held note, the view zooms 1.5× (integer zoom, §23.1) on Cain, the screen desaturates zone by zone.
- Then **game over screen** (§25.6).

### 21.5 Health items [Depth]
None in v1 apart from regen and finds. Enoch's medical items are reserved for the comforts. (Adding healing items would weaken the regen loop.)

---

## 22. Noise

### 22.1 Purpose
Noise is what makes melee the sensible default in this world and gives the guns a real cost beyond Scrap. It's a light system: it **shifts where the dead go and how fast they come**, never more.

### 22.2 Levels
| Level | Sources | Radius (px) |
|---|---|---|
| Quiet | Melee, crossbow, bow, bricks, walking on glass | 48 |
| Medium | Molotov, bottle, chainsaw (per second), nail gun | 140 |
| Loud | Revolver, pistol, rifle, SMG, flare, alarm clock, car alarm | 260 |
| Very loud | Shotgun, assault rifle, pipe bomb, explosive barrel, lawnmower turret | 400 |

### 22.3 Effects
1. **Attraction**: every enemy **within a noise radius** that isn't currently chasing Cain (e.g. one pathing to a barricade, or wandering after a lure) heads towards the noise source for 4 s, then resumes normal pathing. Lures (alarm clock, bottle, bell, car alarm, flare) use the same system.
2. **The Noise meter**: a thin bar on the HUD (§25.2), 0–100.
   - Each shot adds: Loud +4, Very loud +7, Medium +2. Explosions +10.
   - Decays 8/s after 1.5 s of no noise.
   - **At 50+:** spawn interval × 0.8 (spawns come faster).
   - **At 80+:** the active cap +4, and the next spawns favour the spawn points nearest the player (80% from the nearest third). The meter flashes red and a groan swell plays.
3. **Quiet has no meter cost.** Melee never raises the meter.

### 22.4 Tuning intent
- A player who uses guns carefully (bursts, then melee while it cools down) shouldn't notice much.
- A player who holds down the trigger on an SMG all round should feel the town **close in**.
- Noise must **never** make a round longer or add enemies to the round total; it only changes tempo. (Counts stay readable and fair.)

---

## 23. Camera, rendering and art

### 23.1 Resolution and scaling
- **Logical resolution: 480 × 270** (16:9). Render to an offscreen canvas at that size, then scale up to the window by the **largest integer factor** that fits (×2 at 960 × 540, ×3 at 1440 × 810, ×4 at 1920 × 1080). Letterbox the rest in the UI frame colour.
- `imageSmoothingEnabled = false`. CSS `image-rendering: pixelated`.
- The camera position is snapped to whole logical pixels.

### 23.2 Camera
- Follows the player, offset **24 px in the facing direction** (look-ahead), smoothed (lerp 0.12 per tick).
- **Clamped** to the map edges.
- Shake: per §7.1 (hit), explosions 3 px for 200 ms, Brute charge 2 px for 300 ms. Shake is snapped to whole pixels. Respect a "Reduce screen shake" setting (§26.3).

### 23.3 Characters
- **Scale:** Enoch's survivors are 8 × 12 px and too small to read facing and weapons in a shooter. Use **16 × 24 px** characters for Cain and enemies (2× the proportions of Enoch's sprites), with the **same 1 px warm near-black outline** (`#2b1d16`), light from the upper left and 2–3 tones per material. The look must read as Enoch's people drawn closer up.
- **Directions:** 8-direction sprites. Draw 5 (S, SE, E, NE, N) and mirror for the other 3.
- **Animations:**
  | Character | Animations (frames) |
  |---|---|
  | Cain | Idle (2), walk (4), melee swing per weapon class (light/heavy/thrust: 3 each), gun hold and fire (2), reload (3), throw (3), shove (2), interact/repair (2), drink/eat (3), hit flinch (1), downed crawl (2), death (4) |
  | Walker | Idle sway (2), walk (4), attack (3), stagger (2), climb through window (3), death (3) |
  | Crawler | Crawl (4), attack (2), death (2) |
  | Dog | Run (4), lunge (2), death (2) |
  | Brute | Walk (4), charge wind-up (2), charge (2), stunned (2), death (4) |
  | Looter | Run (4), hit (2), flee (4), death (3) |
- Cain's held weapon is drawn as a **separate sprite layer** so all weapons work with all animations. Each weapon has a sprite per direction.
- **Cain's look:** grey beard, khaki work jacket, a tarp patch, bandana, practical boots. Pull his colours from the Enoch portrait system (§WORLD.md "People").
- **Walker look:** grey-green skin, red eye pixel, shredded wardrobe outfit (§19.4). Their palette should be duller than Cain's, so Cain always stands out.

### 23.4 Environment
- **Tile size 16 px.** The ground is a tile layer, plus a decoration layer (props), plus an object layer (buildings, cars, depth-sorted).
- **3/4 top-down** as in Enoch: roofs and front faces. Depth sort by ground line (y of the base), as Enoch's renderer does.
- **Materials and palette from Enoch** (`BUILDINGS.md`): corrugated sheet, pallet wood, tarp colours, faded vehicle paint, tyres, oil drums. Town additions use the same rules: **red brick** (`#9b4a36` with mortar `#c9b79a`), **slate roofs** (`#4a5560`), **tarmac** (`#3f4246` with cracks), **road paint** faded to `#c8bf9a`, **shop signs** with faded, partly readable lettering (no real brands).
- **Overgrowth:** grass and weeds push through tarmac cracks; ivy on walls; moss on roofs; abandoned cars sunk in grass. A year of neglect. Use Enoch's ground rules: pixel grid only, wobbly edges, clustered colour, no lone random pixels.
- **Clutter tells the story:** a pram on its side, a "SAVE OUR TOWN" banner, a supermarket trolley, boarded windows with spray-painted X marks (*Walking Dead*-style "searched" marks), bin bags, a fallen bicycle.
- Every **interactive object** must read at a glance: racks, comforts, the crate, the generator and the workshop each have a unique, high-contrast silhouette and a warm light source.

### 23.5 The night palette
- Author all art in **daytime colours** (consistent with Enoch).
- At runtime, convert to night with a **palette lookup table** (LUT): each source colour maps to a cooled, darker, desaturated night colour. The LUT is authored as an image (§27.6). This keeps the art crisp, avoids translucent overlays and lets the generator "turn the lights on" by swapping the LUT within lit areas.
- In **lit areas**, use the daytime colours, shifted warm.

### 23.6 Lighting
- A **light map** at 1/2 logical resolution (240 × 135) is computed each frame from light sources, then used to choose between three LUTs per pixel: **dark**, **dim**, **lit**. Hard bands, no smooth gradient.
- **Light sources**:
  | Source | Radius | Colour | When |
  |---|---|---|---|
  | Cain's torch (head torch) | 40 px cone in facing direction + 14 px circle around him | Cool white | Always |
  | Braziers (oil drums) | 48 px | Amber, flickers ±2 px | Always (6 on the map) |
  | Street lamps | 56 px | Sodium orange | With power |
  | String lights over the square | 12 px per bulb, 20 bulbs | Warm | With power |
  | Searchlight | Moving beam 32 × 160 px | White | With power, over the playing field |
  | Shop signs | 24 px | Coloured | With power |
  | Muzzle flash | 64 px, 1 frame | White-yellow | On fire |
  | Fire (Molotov, burning, fuel) | 32–64 px, flicker | Orange | While burning |
  | Finds | 16 px pulse | Amber | While on the ground |
  | Racks, comforts, crate lantern | 20–32 px | Warm | Always (they are lit beacons so players can find them) |
- **Darkness gameplay:** in "dark" areas, enemies are drawn as **silhouettes** (outline + red eyes only). In "dim", sprites show at reduced detail. "Lit" shows full colour. This makes the generator matter and makes the dark scary without being unfair: you can still see shapes.

### 23.7 Effects
- **Blood:** pixel spatters on the ground that stay for the round, max 200 decals; oldest fade first.
- **Fire:** 3-frame pixel flames.
- **Smoke:** reuse Enoch's smoke puffs from `src/life.js`.
- **Explosions:** 5-frame pixel burst + a 1-frame white flash on the whole screen at 20% opacity (respect reduced flashing setting).
- **Sparks:** for the workshop, electric trap, generator.

### 23.8 Art pipeline
- Follow `../Project Enoch/docs/ART-DIRECTION.md`: create **one approved reference sheet shared with Enoch** before generating anything with Higgsfield. Transparent PNGs, nearest-neighbour scaling only, every prompt logged.
- **Start with placeholders:** like Enoch, draw everything procedurally (coloured boxes with outlines and a facing indicator) in milestone 1. Final art replaces placeholders by manifest key (§27.6), as Enoch's `ART` object does.

---

## 24. Audio

### 24.1 Music
- Use Enoch's synth (`../Project Enoch/src/music.js`) as the engine. Same GBA-style voice.
- **Three layers** of one theme, crossfaded (300 ms):
  1. **Dark**: before the generator. Slow, minor, sparse: a bass drone, a single lead line.
  2. **Lit**: after the generator. The same melody fuller: percussion, a warm pad.
  3. **Pressure**: added on top when there are 15+ enemies within 160 px, a Brute is alive, or the noise meter is 80+. Faster hi-hat and a pulsing bass.
- **Round transition sting** (2 s): a falling minor arpeggio. Round 10, 20, 30: a longer, special sting.
- **Game over**: one held note fading out.

### 24.2 Sound effects (required list)
| Group | Sounds |
|---|---|
| Player | Footsteps (tarmac, grass, wood, glass), swing whoosh (light/heavy), hit thud (flesh, armour), critical crack, gun fire per gun, empty click, reload per gun, throw, shove grunt, hurt, low health heartbeat, downed, revive |
| Enemies | Groans (6 variants, pitched randomly), attack snarl, plank tear, window climb, death (3), crawler drag, bloater burst, runner scream, dog howl, dog bark, dog death, Brute siren, Brute charge roar, Looter footsteps and taunt |
| World | Door/obstruction clearing per type, generator pull and run (loop), lights clunking on, trap activate (each), car alarm, explosive barrel hiss and boom, fire loop, rain [Depth] |
| Economy | Scrap tick (pitched up with amount), purchase (ka-ching of loose metal), can't afford (dull clunk) |
| Finds | Spawn chime, pickup sting per find (9), Adrenaline pulse loop, timer-ending tick |
| Trader's crate | Lid open, cycling tick, weapon land, "CLOSED" falling tune, crate whoosh away |
| Comforts | Jingle per comfort (9), buy sound (drink/eat/strap) |
| Workshop | Grinder, welding, hammer clanks, done bell |
| Rounds | Church bell (round start), round-end sting |

### 24.3 Positional audio
- Simple stereo panning and volume by distance for all world sounds (Web Audio `StereoPannerNode` + gain). Max audible distance 400 px.
- **Barricade under attack** off-screen: a short wood-splinter cue with panning, plus a small HUD arrow at the screen edge pointing at it (§25.4).
- Limit concurrent groans to 6, hits to 8, others by group (§27.5).

---

## 25. UI and HUD

### 25.1 Style
Follow Enoch's UI rules exactly (`ART-DIRECTION.md` "UI feel"):
- Chunky stone-and-olive plaques: 3 px near-black outline, olive body, 2 px lighter top lip, 3 px darker bottom lip, hard 4 px drop shadow. No blur or gradients.
- Content in dark inset slots.
- Fonts: **Nunito** ExtraBold/Black with a hard 1–2 px shadow for labels; **Silkscreen** for numbers.
- Colours: amber/gold values and titles, red danger, green the one forward action, muted khaki secondary text.
- Icons drawn on a 12 × 12 grid with the `icon()` system from Enoch's `src/icons.js`, extended with new icons for weapons, finds and comforts.
- Motion snappy: 1 px lifts, nothing longer than 150 ms, except celebratory banners.
- The HUD is drawn on a **separate canvas layer at the same integer scale** (not DOM), so it stays pixel-perfect. Menus may use DOM with the same CSS tokens as Enoch.

### 25.2 HUD layout (logical 480 × 270)
```
+---------------------------------------------------------------+
| [ROUND 7]                                  [FINDS: ADR 0:24 ] |
|                                            [      2xS 0:11  ] |
|                                                               |
|                                                               |
|                      (game)                                   |
|                                                               |
| [Comforts: 🍲 ☕ 🩹 ·]                                        |
| [SCRAP 4,320]  x1.3                    [🔨 Nail Bat  ▮▮▮▮▯ ] |
| [Noise ▮▮▯▯▯▯] [Parts 3] [⚡ fuel ▮▮▮▯]  [🔫 Shotgun 4 / 22 ] |
+---------------------------------------------------------------+
```
| Element | Position | Detail |
|---|---|---|
| Round counter | Top-left | Big amber Silkscreen numeral in a plaque. Animates on change. |
| Remaining count | Under round | Only when ≤ 3 enemies left ("3 LEFT") |
| Active finds | Top-right | One row per active timed find: icon + seconds. Blinks under 5 s. |
| Comforts | Bottom-left, row above Scrap | Up to 5 slots, empty slots shown as dark wells |
| Scrap | Bottom-left | Amber number, Enoch loot icon, debt in red under it if any |
| Streak | Next to Scrap | "×1.3" with drain bar, only while active |
| Noise meter | Bottom-left row 2 | 6 segments; amber at 50+, red flashing at 80+ |
| Parts | Bottom-left row 2 | Only once the player has any |
| Generator | Bottom-left row 2 | Lightning icon; fuel bar once on. Greyed until started. |
| Weapons | Bottom-right | Current weapon big (icon, name, ammo `mag / reserve` or a durability bar for melee). Other slots as small icons above. Throwable icon + count. |
| Shove cooldown | Around the weapon plaque | A thin bar under the plaque |

### 25.3 In-world UI
- **Scrap pop-ups**: "+130" in amber Silkscreen above the enemy, rising 12 px over 0.6 s, fading. Critical/headshot pop-ups are larger and white-gold. Multiple hits on one enemy within 0.3 s merge into one number.
- **Interaction prompts**: a small plaque above the object when Cain is within 20 px and facing it (or nearest object if several). Shows "**F** Baseball Bat — 500" or "**F** Ammo — 250", amber if affordable, red if not. A hold-F radial fill (stepped, 8 segments) shows hold progress.
- **Barricade plank count**: no number; the planks are visible. The prompt says "**F** Repair".
- **Last enemies outline** (§20.4).

### 25.4 Off-screen indicators
- **Barricade under attack** within 2 zones: a small amber arrow at the screen edge with a plank icon, for 2 s after each tear.
- **Finds** off-screen: a small amber diamond arrow.
- **Brute** off-screen: a red arrow with his helmet icon.
- **Herd direction** at herd round start: a large arrow + banner.

### 25.5 Barks
Text-only lines over Cain's head in a small plaque, 1.5 s. Short, dry, Enoch-style. Never more than one every 8 s, except find pickups (always). Examples:
- Ammo Bag: "Someone was hoarding."
- Adrenaline: "Oh, that's the good stuff."
- Dynamite: "Cover your ears."
- Toolbox: "Hold still, you."
- Out of ammo: "Empty. Brilliant."
- Generator on: "Let there be light. And noise."
- Crate gives a hammer: "Another hammer. Great."
- Low health: "Not today."
Write 3–5 per trigger; never repeat the same line twice in a row.

### 25.6 Game over screen
In an Enoch-style plaque:
- **"You fell on night N."** (N = the round you died in), with "You held Enoch for N − 1 nights" underneath.
- Stats: rounds, total kills, melee kills %, headshots/criticals, Scrap earned, Scrap spent, doors opened, the most-used weapon, the run time, times downed, best streak.
- A short **epitaph** generated from what happened ("Cain was last seen swinging a fire axe in the church car park."), using the zone and the held weapon at death.
- **Play again** (Space or Enter, green button) and **Main menu** (Esc).
- Store the **personal best round** locally (`localStorage`) and show "New best!" if beaten. (A local best is not meta progression; it unlocks nothing.)

---

## 26. Menus, pause, save and settings

### 26.1 Main menu
Over a slowly panning shot of the night town with a few walkers shambling. Options: **Play**, **How to play**, **Settings**, **Credits**. Shows the personal best round.

### 26.2 How to play
One screen: a controls diagram (keyboard image with highlighted keys), and five lines:
1. Kill the dead for Scrap.
2. Spend Scrap at racks, doors and the crate (hold F).
3. Repair barricades between fights.
4. Find the generator.
5. Guns are loud. Melee is quiet.

**First-run tutorial prompts** (in-game, first run only, can be turned off): contextual plaques during round 1–2 ("Hold **F** to repair", "Press **C** to shove", "Hold **Shift** to keep facing"). Each appears once.

### 26.3 Settings
- Music volume, SFX volume
- Key remapping (all actions in §5)
- Screen shake: Full / Reduced / Off
- Flashing effects: Full / Reduced
- Hit stop: On / Off
- Show Scrap pop-ups: On / Off
- Tutorial prompts: On / Off
- Fullscreen toggle
- Colour-blind assist: switches danger red to magenta and amber to cyan for key UI

### 26.4 Pause
Esc/P freezes simulation, ducks audio, shows: Resume, How to play, Settings, Quit to menu (asks to confirm). Auto-pause on window blur.

### 26.5 Saving
- **No mid-run saves** in v1 (runs are short, and save-scumming breaks the tension).
- Persist settings and personal best in `localStorage`.

---

## 27. Technical requirements

### 27.1 Stack
- Match Project Enoch: **vanilla JavaScript ES modules, HTML5 canvas 2D, Web Audio, no dependencies, no build step.** `npm start` serves the folder on `http://localhost:4174` (Enoch uses 4173). `npm test` runs Node-based simulation tests, as Enoch does.
- Target: latest Chrome, Firefox, Safari, Edge on desktop.

### 27.2 Game loop
- **Fixed-timestep simulation at 60 Hz** with an accumulator; rendering at display refresh with interpolation between the last two states for smoothness.
- The simulation is **deterministic given a seed and an input log** (seeded RNG, the same approach as Enoch's seeded daily sim). This enables replays for debugging and automated tests (§31).
- Cap catch-up to 5 ticks per frame (avoid the spiral of death when the tab returns from background).

### 27.3 Architecture (suggested modules)
| Module | Responsibility |
|---|---|
| `main.js` | Boot, loop, scene switching |
| `input.js` | Key state, bindings, buffering (§5) |
| `sim/` | Pure simulation: `world.js`, `player.js`, `combat.js`, `enemies.js`, `director.js`, `economy.js`, `noise.js`, `finds.js`, `comforts.js`, `workshop.js`, `crate.js`, `generator.js`, `traps.js`, `barricades.js`, `buildables.js` |
| `tuning.js` | **Every number in §28.** No magic numbers elsewhere. |
| `map/` | Map data (tiles, zones, doors, spawn points, racks, lights), loader, collision grid |
| `nav.js` | Flow fields (§27.4) |
| `render/` | `renderer.js`, `lighting.js`, `sprites.js`, `effects.js`, `hud.js`, `camera.js` |
| `audio/` | `music.js` (adapted from Enoch), `sfx.js`, `mixer.js` |
| `ui/` | Menus, settings, game over (DOM, with Enoch's CSS tokens) |
| `assets.js` | Sprite manifest, as in Enoch (procedural fallback when a key is null) |
| `debug.js` | §29 |

The simulation (`sim/`) must not touch the DOM, canvas or audio. It emits **events** (`hit`, `kill`, `purchase`, `findSpawned`, `roundStart`…) that rendering, audio and UI subscribe to.

### 27.4 Pathfinding
- A collision grid at tile resolution (16 px), with sub-tile collision for props via AABBs.
- **Flow field** from the player's tile using BFS (or Dijkstra with cost for water/glass), recomputed every 250 ms or when the player changes tile. All chasing enemies read the field: O(1) per enemy.
- A second set of **static flow fields**, one per barricade, precomputed at load, for enemies outside.
- Lures (noise, alarm clock, bell, flare) compute a temporary flow field on the lure's tile, cached for its lifetime.
- Local avoidance: simple separation force between enemies within 10 px.
- Dogs use the player flow field but can cut corners (line-of-sight smoothing).

### 27.5 Performance budget
| Item | Budget |
|---|---|
| Max alive enemies | 24 by design (tuning can raise to 60) |
| Simulation tick | ≤ 4 ms at 60 enemies |
| Render | ≤ 8 ms at 60 enemies, 200 decals, 30 lights |
| Lighting | Light map at half resolution; LUT lookups via precomputed palette-indexed sprites (sprites stored as palette indices, swapped per band), **not** per-pixel `getImageData` each frame |
| Audio voices | ≤ 32 concurrent |
| Memory | ≤ 300 MB |
| Load time | ≤ 3 s on broadband |

Use **object pools** for enemies, projectiles, particles, pop-ups and decals. No per-frame allocations in hot loops.

### 27.6 Data formats
- **Map**: authored in [Tiled](https://www.mapeditor.org/) (free) and exported to JSON, with layers: `ground`, `decor`, `objects`, `collision`, and object layers `zones`, `doors`, `spawns`, `barricades`, `racks`, `comforts`, `lights`, `crateSpots`, `parts`, `traps`, `hazards`. Custom properties carry IDs, costs and links. If the team prefers, a hand-written JSON is fine for v1, but the layers must match.
- **Tuning**: `tuning.js` exports one frozen object. Hot-reloadable in debug mode.
- **Sprites**: PNG sheets + a JSON atlas. Palette-indexed source so the LUT approach works (§23.5).
- **Night LUT**: a 256 × 3 PNG (row 0 dark, row 1 dim, row 2 lit) indexed by palette entry.

### 27.7 Accessibility
- Every gameplay audio cue has a visual counterpart (§25.4).
- Remappable keys, reduced shake and flashing, colour-blind assist (§26.3).
- Don't rely on colour alone: finds, comforts and rotten finds also differ in shape/icon.

---

## 28. Tuning tables (single source of truth)

Everything here lives in `tuning.js`. Values above are repeated here; if they disagree, **this table wins** and the section text should be fixed.

### 28.1 Player
| Key | Value |
|---|---|
| `player.hp` | 100 |
| `player.regenDelay` | 4.0 s |
| `player.regenRate` | 25 HP/s |
| `player.speed` | 88 px/s |
| `player.strafeMult` | 0.75 |
| `player.surroundedSlow` | 0.6 |
| `player.iframes` | 0.35 s |
| `player.turnTapMs` | 80 |
| `shove.cooldown` | 2.5 s |
| `shove.reach / arc / knockback / stagger` | 18 / 90° / 30 / 0.6 s |

### 28.2 Economy
| Key | Value |
|---|---|
| `scrap.start` | 500 |
| `scrap.hit` | 10 |
| `scrap.killGun / killHead / killMelee / killCrit` | 50 / 100 / 130 / 160 |
| `scrap.plank / plankCapPerRound` | 10 / 500 |
| `scrap.dog / brute / looter` | 50 / 500 / 250 |
| `streak.window / stepKills / stepBonus / max` | 2.0 s / 10 / 0.1 / 0.5 |
| `downed.scrapLoss` | 0.10 |
| `bank.interest / fee / unit` | 0.05 / 0.10 / 1,000 |
| `loan.amount / repay / threshold` | 1,000 / 1,500 / 500 |
| `parts.dropChance` | 0.05 |

### 28.3 Prices
| Item | Scrap |
|---|---|
| Doors | per §10.3 (750–1,500) |
| Racks | per §9.2–9.3, §9.6 |
| Rack re-buy for durability | 50% of rack price |
| Upgraded ammo | 4,500 |
| Ammo crate (police box) | 1,500 |
| Trader's crate | 950, +50 per pull, max 1,450 |
| Workshop tiers | 5,000 / 7,500 / 10,000 |
| Hot Stew / Black Coffee / Steady Hands / Bandages / Running Shoes / Gasmask / Pack Mule / Eagle Eye / Barbed Wrap | 2,500 / 3,000 / 2,000 / 500 / 2,000 / 2,500 / 4,000 / 1,500 / 4,000 |
| Second Wind | 1,500 / 3,000 / 4,500 |
| Traps | per §13 |
| Jerry can | 500 |
| Placeables | per §11.4 |

### 28.4 Rounds and enemies
| Key | Value |
|---|---|
| `round.break` | 10 s |
| `round.count(r)` | `round(6 + 2.5(r−1) + 0.09r²)`, cap 160 |
| `round.activeCap(r)` | `min(24, 6 + r)` |
| `round.spawnInterval(r)` | `max(0.4, 2.0 − 0.08(r−1))` s |
| `walker.hp(r)` | `150 + 100(r−1)` for r ≤ 9, then ×1.1 per round |
| `walker.damage` | 34 |
| `walker.attackWindup` | 0.5 s |
| `walker.speed` | 30 / 45 / 60 px/s by tier |
| `runner.speed` | 110 px/s |
| `dog.hp / speed / damage` | 70 (×1.2 per dog round) / 140 / 25 |
| `dog.roundEvery` | 4–6, first 5–7 |
| `brute.hp` | 3,000, +2,000 per spawn |
| `brute.firstRound / every` | 9 / 4–5 |
| `looter.hp / steal` | 400 / 500 |
| `lastEnemy.speedUpAfter` | 20 s |
| `barricade.planks / tearTime / repairTime` | 6 / 1.0 s / 0.45 s |

### 28.5 Finds
| Key | Value |
|---|---|
| `finds.chance` | 0.02 |
| `finds.maxPerRound` | 4 |
| `finds.pityKills` | 50 |
| `finds.lifetime` | 26 s (blink 20 s, fast 23 s) |
| `finds.timed` | 30 s (Walker Guts 20 s) |
| `finds.rottenFrom / rottenChance` | round 15 / 0.10 |

### 28.6 Noise
| Key | Value |
|---|---|
| Radii | 48 / 140 / 260 / 400 |
| Meter add | Medium 2, Loud 4, Very loud 7, Explosion 10 |
| Meter decay | 8/s after 1.5 s |
| Threshold 1 (50) | spawn interval ×0.8 |
| Threshold 2 (80) | active cap +4, near-spawn bias 0.8 |

### 28.7 Generator
| Key | Value |
|---|---|
| `generator.startHold` | 1.5 s |
| `generator.fuelRounds` | 8 |
| `generator.refuelHold` | 1.0 s |

---

## 29. Debug and developer tools

Enabled with `?debug` in the URL. **Required** before balance work starts.

| Key | Tool |
|---|---|
| `` ` `` | Toggle debug overlay: FPS, tick time, alive enemies, active cap, spawn timer, noise meter value, director pressure, current find bag |
| F1 | Show collision grid and flow field arrows |
| F2 | Show spawn points (active green, inactive grey) and zone borders |
| F3 | Show noise radii as circles when emitted |
| F4 | Show light map bands |
| F5 | God mode |
| F6 | +10,000 Scrap |
| F7 | Kill all enemies (ends round) |
| F8 | Skip to round N (prompt) |
| F9 | Spawn a chosen enemy type at the cursor tile (keyboard-move cursor) |
| F10 | Spawn a chosen find |
| F11 | Open all doors and start the generator |
| F12 | Dump the seed and input log to a downloadable file |

- **Replay**: load `?seed=…&replay=file.json` to re-run a recorded run deterministically.
- **Headless balance sim**: like Enoch's `scripts/`, add `scripts/simulate-rounds.js`, which runs a scripted bot (kites in a loop, buys in a fixed order) for 200 seeds and reports the median round reached, Scrap curve and time per round. Use it to compare tuning changes.

---

## 30. Milestones and build order

Each milestone ends with a playtest. **Don't start the next milestone until the current one's exit criteria are met.**

### M0: Skeleton (week 1)
- Loop, input, integer-scaled canvas, camera, tuning file, debug overlay.
- A test room (grey box) with collision.
- **Exit:** Cain (placeholder box with a facing notch) moves in 8 directions with Shift lock and turn-in-place, at 60 fps.

### M1: The fun core (weeks 2–4) (Pareto features 1, 2, 11)
- Walkers with flow-field chase, attack, stagger, death, corpses.
- Melee with all properties in §7.1 (hammer, bat), hit stop, shake, blood.
- Revolver with hitscan, ammo, reload, penetration.
- Scrap for hits and kills with pop-ups.
- Rounds with the §20.3 formulas, round counter, break, bell.
- Health, regen, death, game over screen (basic).
- **Exit:** in a grey box, 5 testers unprompted say melee "feels good"; a run to round 6–8 is tense; the team wants to keep playing.

### M2: The economy and the town (weeks 5–8) (Pareto 3, 4, 5, 10, 12)
- The Enoch town map (placeholder art), all 9 zones, doors, collision.
- Barricades with tear and repair.
- All racks, all melee weapons, all rack guns, throwables, ammo purchase.
- The generator (on/off only, no fuel yet).
- Noise system and meter.
- Lighting v1 (dark/dim/lit bands, Cain's torch, braziers, generator lights).
- HUD v1.
- **Exit:** a full run uses the map; testers make real choices about what to open first; the generator feels like an event.

### M3: The spice (weeks 9–12) (Pareto 6, 7, 8, 9)
- All 9 finds with the bag system.
- Trader's crate with cycling, weights, moving.
- All comforts (with the cap and loss on down) and Bandages self-revive, Second Wind.
- Workshop with tiers I–III and effects.
- Dogs and dog rounds.
- **Exit:** median tester run reaches round 10–14; at least one "jackpot" moment per run reported.

### M4: Depth (weeks 13–16)
- Crawler, Bloater, Armoured, Runner, Brute, Looter.
- Traps.
- Generator fuel.
- Placeables, barricade reinforcement, Parts.
- Special rounds (fog, herd), director.
- Bank, loan, bounties, streaks.
- Buildables.
- **Exit:** runs past round 20 stay interesting; experts and beginners both have goals.

### M5: Art, audio and polish (weeks 17–22)
- Final sprites via the shared reference sheet (§23.8), night LUT, all animations.
- Full SFX list, music layers.
- Menus, settings, tutorial prompts, accessibility.
- Performance pass to §27.5.
- Balance pass using the headless sim and playtests to hit §2.3 targets.
- **Exit:** all acceptance tests (§31) pass. Demo ships.

---

## 31. Acceptance tests

Write these as automated sim tests where marked (A), and manual checks otherwise (M).

**Controls**
- (A) Holding W and D moves at the same speed as W alone (±1%).
- (A) With Shift held, facing doesn't change while moving.
- (A) A 50 ms tap of A turns Cain west and moves him ≤ 1 px.
- (M) Space during swing recovery buffers and fires the next swing.

**Combat**
- (A) A bat swing at 3 walkers in its arc hits all 3; at 4 hits 3 (cleave).
- (A) A walker hit during stagger takes 1.5× and gives 160 Scrap on a kill.
- (A) A rifle bullet passes through 4 enemies with 25% fall-off each.
- (A) Durability drops by 1 per hitting swing only.

**Economy**
- (A) Round 1 start: 500 Scrap. A melee kill: +130. A gun kill: +50.
- (A) Plank Scrap stops at 500 per round.
- (A) Buying with insufficient Scrap does nothing and plays the fail sound.
- (A) Trader's crate price rises 50 per pull and caps at 1,450.

**Rounds**
- (A) `count(1..30)` matches the formula; `hp(10)` = 1,045.
- (A) Alive enemies never exceed the active cap (plus 4 at noise 80+).
- (A) No enemy spawns inside the visible screen except at barricades.
- (A) A round always ends: with a lone non-crawler walker idle for 20 s, it speeds up.

**Finds**
- (A) In 1,000 seeded rounds, never more than 4 finds per round; no round with 50+ kills ends with 0 finds (if under the cap).
- (A) Ammo Bag never appears twice in a row.
- (A) Dynamite kills all enemies and pays 400 flat.

**Comforts and downing**
- (A) Buying a 5th comfort without the cap upgrade is refused.
- (A) Downed with Bandages: back up after 6 s with only Bandages kept and its uses −1.
- (A) Downed without Bandages or Second Wind: game over.

**Map**
- (A) Every zone is reachable from zone 1 with all doors open.
- (A) From every walkable tile, there's a path to at least 2 exits once all doors are open (except the two exempt rooms).
- (M) Each loop in §10.4 can be run 10 times continuously with a train of 20 walkers without snagging.

**Noise**
- (A) 10 revolver shots in 5 s raise the meter to ≥ 30; 0 melee swings raise it at all.
- (A) Noise never changes `round.count`.

**Performance**
- (M) 60 enemies, 30 lights, 200 decals: ≥ 58 fps average on the reference laptop over 60 s.

**Determinism**
- (A) The same seed + input log produces the same final state hash (on two runs and two browsers).

---

## 32. Out of scope (this version)

From the original feature analysis, these categories are **excluded on purpose**:
- **Co-op and social:** co-op, shared points, revive-a-teammate (replaced by Second Wind), pings, character banter between players, Grief, leaderboards, spectating.
- **Meta and replayability:** persistent unlocks, prestige, daily challenges, modifiers, custom games, map rotation, mod support, map editor, meta-currency.
- **Objectives and secrets:** main and side Easter eggs, lore collectibles, wonder-weapon quests, exfil, trials, Gobblegums, achievements.

Also out: mouse aim, gamepad, more maps, the Enoch save link, mobile.

---

## 33. Open questions

| # | Question | Default if unanswered |
|---|---|---|
| 1 | Is "Enoch" also the town's name, or should the town have its own name? | Town is called Enoch |
| 2 | 16 × 24 characters: approve after the M0 test? | Yes, 16 × 24 |
| 3 | Should Cain be the only playable character, or choose from 4 of his people (cosmetic only)? | Cain only |
| 4 | Any guns at all in the starting loadout, or melee only for round 1? | Revolver with 30 rounds |
| 5 | Is the streak (Boxhead combo) in v1 or cut? | In, as [Depth] |
| 6 | Generator fuel: is the jerry-can errand fun or a chore? | Ship it in M4 and test; cut if testers dislike it |
| 7 | "Lucille"-style named melee weapons: the team picks original names | "Mabel" for the bat |

---

## Appendix A: CoD Zombies → Enoch Nights feature map

Every feature from the original analysis, outside the excluded categories, with its like-for-like version and where it's specified. ★ = Pareto core.

### Economy and points
| CoD | Enoch Nights | § |
|---|---|---|
| ★ Points per hit, kill, headshot, melee kill | Scrap: 10 / 50 / 100 / 130 (+ criticals) | 8.2 |
| Points for barricade repair (capped) | 10 per plank, 500 cap | 8.2, 11.1 |
| Points for reviving teammates | n/a (co-op excluded); Second Wind | 21.3 |
| Bonus points for objectives | Bounties | 8.5 |
| Point sharing | n/a (co-op excluded) | — |
| Bank / interest | The town safe | 8.7 |
| Point multipliers | Double Scrap find | 14.2 |
| Penalty on going down | 10% Scrap loss | 21.2 |
| Dynamic pricing | Crate price rises | 8.6 |
| Debt / loans | Trader's loan | 8.8 |
| Bounties on special enemies | Brute / Looter rewards, bounty notices | 8.5, 19.3 |
| Combo multipliers | Streak | 8.3 |
| Secondary currency | Parts | 8.9 |
| Meta-currency | Excluded (meta) | 32 |

### Weapons and ammo
| CoD | Enoch Nights | § |
|---|---|---|
| ★ Wall-buys | Racks and pegboards | 9.5 |
| ★ Buy ammo at the wall-buy | Ammo at the gun's rack | 9.4 |
| Two-weapon limit (+1 with perk) | 2 gun slots + melee slot; Pack Mule | 9.1, 15.2 |
| ★ Mystery Box | Trader's crate | 17 |
| Box moves (teddy bear) | "CLOSED" sign, trader moves on | 17.4 |
| Box weighting, pity | Weights table, pity rule | 17.3 |
| Wonder weapons | Nail gun cannon | 9.3 |
| ★ Pack-a-Punch | The workshop | 16 |
| Repeat upgrades, elemental effects | Tiers I–III, Burn/Shock/Chill/Rot/Bleed | 16.3 |
| Ammo scarcity | Crate guns have no rack; Ammo Bag | 9.4 |
| Ammo crafting / scavenging | Ammo crate buildable, bolt pickups | 18.2, 9.3 |
| Durability / overheating | Melee durability | 9.2 |
| Trading weapons between players | Excluded (co-op) | — |
| Weapon locker | Excluded (meta, carries between sessions) | — |
| Melee upgrades (Bowie, ballistic knife) | The melee arsenal + workshop | 9.2, 16 |
| Equipment: grenades, monkey bombs, claymores | Bricks, Molotovs, pipe bombs, alarm clock, nail boards | 9.6, 11.4 |
| Lethal refill per round | 2 bricks per round | 9.6 |

### Map and space control
| CoD | Enoch Nights | § |
|---|---|---|
| ★ Doors and debris | Cars, fences, shutters, skips | 10.3 |
| Route choice | 9 zones, 12 obstructions | 10.2 |
| ★ Power switch | The generator | 12 |
| Multiple generators / partial power | Fuel and the fuse board | 12.4–12.5 |
| Teleporters / fast travel | Not needed on a small town map (kept out for clarity) | — |
| Traps | Electrified fence, fire line, petrol spray, church bell, searchlight | 13 |
| Traps that hurt players | Yes, unless Gasmask | 13, 15.2 |
| Choke points and training areas | Alleys and loops | 10.4, 20.7 |
| Map hazards: fog, water, darkness | Fog rounds, flooded underpass, darkness | 10.5, 20.5, 23.6 |
| Explosive barrels, interactables | Red drums, car alarms, fuel puddles | 10.5 |
| Destructible routes | Brute smashes barricades and placeables | 19.3 |
| Dynamic maps | Church fire, fire station collapse | 10.6 |

### Barricades and fortification
| CoD | Enoch Nights | § |
|---|---|---|
| ★ Boarded windows, rebuild plank by plank | Windows and fence gaps, 6 planks | 11.1 |
| Repair pays points | 10 per plank | 11.1 |
| Upgraded barricades | Steel bars, sheet metal | 11.3 |
| Shield buildable | Riot shield | 18.2 |
| Player-placed defences | Nail boards, wire, pallet walls, turret | 11.4, 18.2 |
| Resource cost separate from points | Parts | 8.9 |
| Defence decay | Placeables have lifetimes | 11.4 |
| Carpenter | Toolbox find | 14.2 |

### Temporary power-ups
| CoD | Enoch Nights | § |
|---|---|---|
| ★ Max Ammo | Ammo Bag | 14.2 |
| ★ Insta-Kill | Adrenaline | 14.2 |
| ★ Double Points | Double Scrap | 14.2 |
| ★ Nuke | Dynamite | 14.2 |
| Carpenter | Toolbox | 14.2 |
| Fire Sale | Trader's Sale | 14.2 |
| Death Machine | The Chainsaw | 14.2 |
| Bonus Points | Wallet | 14.2 |
| Zombie Blood | Walker Guts | 14.2 |
| Drop chance, cap, cycle | 2%, cap 4, shuffled bag, pity | 14.1 |
| Expiry and blinking | 26 s, blink | 14.1 |
| Cursed drops | Rotten finds | 14.3 |
| Carry-back drops | Supply sack | 14.3 |

### Perks
| CoD | Enoch Nights | § |
|---|---|---|
| ★ Juggernog | Hot Stew | 15.2 |
| Speed Cola | Black Coffee | 15.2 |
| Double Tap | Steady Hands | 15.2 |
| Quick Revive | Bandages (self-revive ×3) | 15.2, 21.2 |
| Stamin-Up | Running Shoes | 15.2 |
| PhD Flopper | Gasmask (+ dash) | 15.2 |
| Mule Kick | Pack Mule | 15.2 |
| Deadshot | Eagle Eye | 15.2 |
| Widow's Wine | Barbed Wrap | 15.2 |
| Perk cap and more slots | Cap 4, +1 on first Brute kill | 15.1, 15.4 |
| Losing perks on down | Lose all but Bandages | 15.1 |
| Perk tiers / modifiers | Ripened comforts | 15.3 |
| Perks need power | Yes, except Bandages | 12.3 |
| Free perk | Brute free-comfort pickup | 15.5 |
| Moving perks | Deliberately not used | 15.6 |

### Enemies and escalation
| CoD | Enoch Nights | § |
|---|---|---|
| ★ Escalating rounds | Formulas | 20.3 |
| Round counter and sting | Bell + HUD | 20.1, 24 |
| Break between rounds | 10 s | 20.1 |
| Special rounds (hellhounds) | Dog rounds | 19.3 |
| Bosses (Panzer, Brutus) | The Brute | 19.3 |
| Enemy variants | Crawler, Bloater, Armoured, Runner | 19.2 |
| Thieves (Thief, monkeys) | The Looter | 19.3 |
| Spawn zones activating with doors | Spawn points per zone | 20.2 |
| AI director | The director | 20.6 |
| Last zombie / crawler tactic | Allowed; speed-up for non-crawlers | 20.4 |
| Hordes shaped by noise and light | Noise system, lures, herd rounds | 22, 20.5 |

### Survival and player state
| CoD | Enoch Nights | § |
|---|---|---|
| Downed state, pistol | Crawl with a pistol | 21.2 |
| Bleed-out timer | 6 s self-revive timer | 21.2 |
| Revive (teammate) | Excluded (co-op); Bandages, Second Wind | 21.2–21.3 |
| Spectate and respawn | Excluded (single player has no respawn) | — |
| Health regen | Yes | 6.2 |
| Self-revive items | Bandages, Second Wind | 21 |
| Stamina | Running Shoes changes speed; no stamina bar (simpler on keyboard) | 15.2 |
| Hunger / sanity | Not used (they belong to the Enoch sim) | — |
| Flashlight / visibility | Cain's head torch, lighting bands | 23.6 |

### Crafting and buildables
| CoD | Enoch Nights | § |
|---|---|---|
| Collect parts, build at a bench | Specific parts, 3 benches | 18 |
| Randomised part locations | 3 candidate spots per part | 18.1 |
| Buildables (shields, turrets) | Riot shield, ammo crate, lawnmower turret, tin-can alarm | 18.2 |
| Upgrade trees | Shield regenerates at benches (kept simple) | 18.2 |
| Elemental staff quests | Excluded (objectives) | — |

### Atmosphere and feedback
| CoD | Enoch Nights | § |
|---|---|---|
| Audio signature per event | Full SFX list | 24.2 |
| Secret songs | Excluded (secrets) | — |
| Danger tells | Red eyes, telegraphs, audio cues | 19, 24 |
| Points popping on every hit | Scrap pop-ups | 25.3 |
| Score screen | Game over stats + epitaph | 25.6 |
| Lighting tied to power | Generator lights the town | 12.2, 23.6 |
