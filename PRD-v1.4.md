# Enoch Nights: v1.4 PRD (playtest feedback pass)

| | |
|---|---|
| **Version** | 1.4 |
| **Date** | 2026-10-10 |
| **Builds on** | `PRD.md`, `ENHANCEMENT-PRD.md`, `PRD-v1.2.md`, `PRD-v1.3.md` |
| **Status** | Built (2026-10-10). All sections A to I. See Build notes at the end for what each (verify) found. |

## Themes

The feedback clusters into seven problems. Fixing the cluster beats fixing each line.

1. **Too much text on screen.** Pop-ups, tooltips and pointers compete. One notification system, quieter world prompts.
2. **Collision is wrong for small props.** Player and zombies snag on things they should walk past; the bus is walkable when it should be solid.
3. **The Signal / raider loop is the worst part of the game.** No objective, no end, raiders go to the wrong place, theft is invisible.
4. **The Red Lion is hard to defend and expensive to fortify.** Survivors don't help, extra weapons have nowhere to go.
5. **Power attack feels automatic.** Needs release-to-fire and charge scaling.
6. **Errands fail on a timer and track kills badly.** Fail by wave; fire/explosive credit by damage, not killing blow.
7. **The map doesn't explain the town.** No streets, no names, identical buildings.

Ordering at the end.

---

## A. Notifications and UI

### A1. One notification feed (replaces top pop-ups)
- **Problem:** pop-ups stack at the top; the signal code took ages to read; Biscuit joining showed two near-identical toasts (yellow top, green bottom).
- **Design:** a single feed on the right edge, under the buff icons. Cards slide in, max 3 visible, older ones collapse to a "+N" chip. Each card has a priority:
  - **Critical** (Red Lion under attack, objective failing, raiders stealing): red edge, stays until resolved or dismissed, plays a sting.
  - **Objective** (codes, task steps, new errands): stays 8 s, and is copied into the pause-screen Notes.
  - **Info** (pickups, joins): 4 s.
- **Dedupe:** the feed drops a message whose key matches one shown in the last 5 s. Every emitter passes a key (`survivor.join.biscuit`). Fixes the double Biscuit pop-up at source as well: find the two call sites and remove one **(verify)**.
- Codes (signal code etc.) render in a monospace pill and are always in Notes.

### A2. Pause-screen Notes as a phone notification list
- Vertical scroll list of cards, newest on top. The focused card is expanded (full text, map pin button); the others collapse to one line (icon, title, wave received).
- Arrow keys / wheel move focus; the list sits in its own panel and never overlaps the menu.
- Small screens: below 900 px wide the pause screen goes to tabs (Menu / Notes / Map) instead of side-by-side panels.

### A3. Hoverable buffs
Hover (or focus with the pause cursor) any buff icon to see name, effect in one line, time/waves left.

### A4. No green escape pointer
Remove the auto pointer to the fire engine once the escape is available. The objective stays in Notes and the map pin; the player opts in by pinning it.

---

## B. World prompts and interactables

### B1. Highlight first, text on interact
- Walking near an interactable: a soft outline/glow only (pulse on the sprite edge). No text.
- Text appears when the player is **facing it and in range** (the "would interact" target), as a one-line prompt: `F  Cellar`. Longer text (costs, descriptions) only after pressing F, in a small panel.
- Applies to cellar doors, ground pickups, workbenches, ladders, signs.
- Only one prompt on screen at a time: the closest faced target.

### B2. Interact priority
- **Problem:** F didn't accept the Hilltop supply drop because a barricade repair was the active target.
- Radio/quest accepts no longer use F at all (see E1). For world targets, priority: quest objects > pickups > doors/ladders > repairs.

### B3. Make key interactables readable
- **Church tower ladder:** stronger sprite (rails in a lighter tone), the glow from B1, and a map icon.
- **School roof:** add a visible route from the walk-on side (painted arrow on the ground or a ramp/bin stack sprite), and make the ladder that does *not* reach the roof look clearly broken, or remove it **(verify which is which)**.

### B4. Cellar door controls
Left / Right cycle destinations. F travels. Esc or F on "Stay" exits. Up/Down do nothing.

---

## C. Collision and movement

### C1. Props: soft vs hard
- Tag every prop `hard` (walls, buildings, vehicles, large barricades) or `soft` (signboards, phone boxes, bins, benches, cones, bodies, debris).
- **Soft props:** no player or zombie movement collision, but they **still block bullets** (cover stays). Bullets stop on soft props as they do now.
- Draw order handles "walking behind". Optionally a 10% speed slow while overlapping heavier soft props (bins, benches).
- Player collision box: shrink to the feet (bottom ~40% of the sprite) so overhangs don't snag.
- Add corner sliding on hard props: if blocked on one axis, keep moving on the other.

### C2. Zombies stuck behind props
- Zombies use the same soft/hard tags (soft props ignored).
- Stuck detector: if a zombie moves < 4 px in 1.5 s while it has a target, re-path via `nav.js`; after 3 s, nudge it along the hard prop's edge normal. After 6 s off-screen, teleport it to the nearest nav node.

### C3. The bus
- Once the bus rams through, it becomes a hard prop.
- The breach it makes is 1.5x the usual doorway width so the route stays open.

### C4. Red Lion: walk through broken reinforcement
When reinforcement HP is 0, its collision is removed. It's a rubble sprite until repaired.

---

## D. Combat

### D1. Power attack: release to fire
- Hold to charge. At full charge (or max affordable by stamina) Cain **holds** the charge instead of firing. Release fires.
- "Ready" tell: a white flash on the charge ring and weapon, a short ping, and a small idle shake while held. Holding drains stamina slowly; when stamina hits 0 it fires on its own (the only auto-release).

### D2. Power attack: scaling
Let `c` = charge 0..1 (capped by stamina on hand).
| | c = 0.2 | c = 0.5 | c = 1.0 | Regular swing |
|---|---|---|---|---|
| Damage per target | 0.4x | 0.7x | 1.5x | 1.0x |
| Knockback | 20 px | 40 px | 80 px | small |
| Score per hit | scaled by the same multiplier | | | |

- Hits **everything** in the radius (remove any target cap **(verify cap)**). Brutes/Butcher still get the interrupt, not knockback.
- Score from a power attack = base score × damage multiplier, so tapping out half-charges in a crowd doesn't farm points.

### D3. Pipe bomb lure
On throw: beeps and flashes for 4 s (beep rate quickens), attracts every zombie within a large radius (~ 1.5 screens), then explodes. Brutes ignore the lure. Rain does **not** stop it.

### D4. Fire/explosive tagging
- Any damage of type `fire` or `explosive` sets `zombie.markedFireExplosive = true`. On death, if marked, it counts toward "kill with explosive or fire", whatever the killing blow.
- Rain may dampen burning duration, but a pipe bomb or Molotov hit always marks. Check current rain code for a branch that drops the damage type **(verify; the playtest saw pipe bomb kills not counting)**.

### D5. "Kill with weapon X" errands
Only pick from weapons the player **owns** (held or stored at the Red Lion, see F3), and prefer the class (ranged/melee) the player has used least this run (from run log counters).

### D6. Aim assist on raiders
- Guns only. When firing, if a raider is within a ±12° cone of the aim direction and in range with a clear line, the shot bends toward the raider's centre (full snap within ±6°, linear falloff to ±12°).
- Raiders behind cover (hard or soft prop on the line) are not eligible; cover still works.
- Zombies get a smaller cone (±5°) so this doesn't trivialise hordes. Values in `T.aimAssist`.

### D7. Raider and looter rewards
Raider kill: 3x a zombie's Scrap/score. Looter: 4x. Always drop everything they carried (see E4).

---

## E. Quests, errands and raiders

### E1. Auto-accept with a do-nothing fail
- Radio offers (like the Hilltop supply drop) auto-accept after the card shows. No key press.
- They fail only if the player hasn't done the **first step** within N waves (default 2). Players can still dismiss from Notes.

### E2. Fail by wave, not seconds
- Every errand timer is in waves. Earliest fail point is end of the current wave. Example: "Light the beacon" set at wave 7 fails at the end of wave 8 if not done.
- Notes show "Fails end of wave 8".

### E3. Street names on tasks
Tasks name a street only if the map shows it (G1). The task's map pin highlights the street segment.

### E4. Raiders stealing from the Red Lion (rework)
**What the code does now (`src/sim/raiders.js` `raiderAI`):** any non-Captain raider more than 300 px from Cain walks to the bar, takes 1 Part the moment it arrives, shows "RAIDERS TOOK A PART FROM THE BAR", then flees and vanishes. So the theft is real, but each raider is in the bar for a split second, and the part is gone for good. That's why the playtester found nobody there.
**Principle: the player always gets a fair chance to stop it.** Theft is slow, visible and reversible.
- **Warning first.** As soon as raiders head for the Red Lion, a Critical card says "Raiders heading for the Red Lion" with a map pin and an arrow at the screen edge. They walk there and break in through a window as they do now, so you have time to react before anything is taken.
- **They stay inside.** Once in, raiders stay in the pub and loot it. They don't grab one Part and vanish any more. Every 8 s each raider inside takes 1 Part or 15 Scrap, capped at 5 items per raider. A counter on the map and the card show the running total: "Raiders in the Red Lion: −3 Parts, −45 Scrap".
- **They don't leave while you're on your way.** A raider only leaves once it's full (5 items) **and** the wave has ended. If you're heading to the pub or already inside, they stay and fight. So you can always get there in time to win it back.
- **Theft only happens where you can see it.** If no raider is in the pub, nothing is taken, and every theft message comes from a real raider inside.
- **Killing a raider returns everything it took.** The loot drops on the spot and is collected automatically. This always applies, including to Captains and to raiders that were already leaving.
- **If they get away anyway,** the loss is capped at what the raiders carried. You never lose more than the counter showed.
- Survivors inside fight back (F1), which slows the looting while you're on your way.

### E5. The Signal / school roof (rework)

**What it is now (`src/sim/quest.js` step 6):** you switch on the booster at the school mast. A hidden timer of `T.signal.boostHold` s runs **only while Cain is within 80 px of the mast**. Every 40 s, 4 more raiders land at the two nearest drop points, with no limit until the timer finishes. Any raider more than 300 px from Cain goes to the Red Lion instead (E4). So leaving the roof stops the clock but not the raiders, and nothing on screen says how long is left. That's why it felt endless.

**What it becomes: "Defend the booster."**
- **Objective:** kill every raider who comes for the booster. That's the whole job. There's no timer and you don't have to stay on the roof.
- **Fixed size:** 4 raider groups of 3, 4, 5 and 6, so **18 raiders in total**. This is the same every run and doesn't scale with the wave. The next group drops 10 s after the previous one is dead, or after 45 s, whichever comes first. There's a hard cap of 8 raiders alive at once.
- **Raiders' target is the booster, not the pub.** Signal raiders (`spawnRaiders(..., 'signal')`) ignore the Red Lion completely and skip the bar logic in E4. They go for the mast. If Cain is close (within their sight range) they fight him; otherwise they walk to the mast and start sabotaging it.
- **Booster HP replaces the stay-on-the-roof rule.** The booster has 100 HP. A raider at the mast takes 5 HP per second off it. If it reaches 0, the Signal step fails and you have to rebuild the booster (the Parts cost again). This gives you a reason to defend the roof without having to stand on it.
- **The Red Lion is safe for the duration.** All Red Lion raid logic is paused until the hold ends.
- **Making it obvious:**
  - Start banner: "DEFEND THE BOOSTER: kill 18 raiders. They're coming for the school roof."
  - A pinned objective bar at the top centre: `Booster 100% · Raiders 7/18 · Group 2/4`.
  - Each raider has a red marker, and raiders off screen get edge arrows.
  - A Critical card when the booster is being damaged: "Raiders at the booster!"
- **Win:** the 18th raider dies, then "ASHWORTH HEARS YOU" and `signalComplete()`.
- Update the Enochpedia Objectives row to match.

### E6. The Looter
**The same principle applies: the player gets a fair chance.**
- **He's easy to spot.** His first appearance is scripted to run past the player within about 6 tiles. He has a yellow "!" over his head, an icon on the map and an arrow at the screen edge. A Critical card says "Looter spotted. He's carrying Scrap, catch him."
- **He's catchable.** He runs at about 90% of Cain's sprint speed and stops to grab loot (about 2 s at each cache, 2 to 3 caches per run). The chase is a pursuit, not a race you can't win. His route is shown as a dotted line on the map once he's spotted.
- **He doesn't take from you.** He loots town caches, not the Red Lion. If he gets away, you only miss a bonus; you don't lose anything you already had.
- **Hitting him pays off.** The first time he is hurt he drops half his haul. That gives you a partial win even if he escapes.
- **Killing him returns his whole haul** plus the D7 bonus.

### E7. Roaming herd
If the wave where zombies walked west and vanished is the "herd passing" behaviour, name it. If not, it's a pathing bug **(verify against logs from the wave 10 run)**.
- Message: "A herd is passing through. Engage them for a bonus, or stay out of sight."
- Herd zombies don't aggro unless the player is within close range or makes noise (gunfire, pipe bomb). Killing the whole herd gives a bonus; leaving them alone is fine.
- Same check for the wave 10 zombies running at the west wall: if they're chasing a lure/sound, the herd message covers it; otherwise fix the target selection.

### E8. Wiring job
Move the stand/face point so it's at least 2 tiles from the arming spot. While holding the wire (job in progress), the arm interaction is disabled.

---

## F. Red Lion, survivors and inventory

### F1. Survivors auto-bolt and defend
- When the player leaves the Red Lion, any survivor inside bolts the door (if a bolt exists).
- Survivors fight from inside: they shoot through windows/at the door with equipped weapons, and unbolt for the player on approach.

### F2. Reinforce from outside, cheaper
- Reinforce works from either side of the door/window.
- Cut reinforcement cost by ~40% **(set exact value after checking `tuning.js`)**.

### F3. Red Lion stash
- Picking up a weapon you have no free slot for sends it to the **Red Lion stash**. It never replaces what you hold. Card: "Shotgun sent to the Red Lion."
- At the Red Lion, a stash panel lets you swap between held and stored.

### F4. Weapon slots
Two gun slots become **Primary** (rifles, shotguns) and **Secondary** (pistols, SMGs). Melee slot unchanged.

### F5. Survivors equip spare weapons
At the start of each break, survivors take the best weapons from the stash they can use. Hover a survivor to see their weapon.

### F6. Bandages
Bandages stop using a comfort slot. They go in a consumables slot with their own stack.

### F7. Pack Mule (keep it, make it worth taking)
Pack Mule stays as a reward, with broader benefits:
- **+1 gun slot** (a second Primary or Secondary, whichever the player chooses)
- **+50% ammo carry cap** for every gun
- **+1 comfort/collectible slot** and +1 consumable stack size
- A small carry bonus: picked-up items aren't sent to the stash (F3) until the extra slots are full

---

## G. Biscuit (dog)
- Damage near zero. Value is control:
  - **Trip:** 25% chance on bite to cripple a walker into a crawler.
  - **Pin:** holds a zombie down for 2 s (player hits on pinned zombies crit).
  - **Bark:** knocks back and staggers on a short cooldown.
- **Self-preservation:** below 30% HP, stops engaging and stays behind the player; below 15%, runs back to the Red Lion and heals in the break.

---

## H. Map and art

### H1. Map rework
- Draw streets as roads with names along them (text follows the road). Use the street names tasks already reference.
- Buildings: distinct footprints and colours by type (pub, church, school, shops, houses), named for key ones.
- Icons: cellar doors, ladders, workbenches, the Red Lion stash, active task pins, Looter.
- Ground props on the map in a muted tone only if they're hard (from C1); soft props left off.

### H2. Black splodge
The bottom-left building in the middle area has a black blob on its door. Audit every building and door sprite for stray pixels (`sprites.html` side-by-side, plus a script that flags pure-black clusters over N px on door layers).

---

## I. End-of-run score
Shown when the run ends, by escape or death.

| Source | Points |
|---|---|
| Scrap earned (lifetime) | 1 per Scrap |
| Tasks/errands completed | 250 each |
| Storylines completed (Signal, fire engine, etc.) | 2,000 each |
| Waves survived | 100 each |
| Survivors alive at end | 300 each |

**Multiplier:** escape ×2.0 (Signal) / ×1.75 (fire engine); death ×1.0. Show the breakdown line by line, then the total, and keep a best score on the main menu.

---

## Build order

| # | Item | Why first |
|---|---|---|
| 1 | E5 Signal rework, E4 raider theft | Worst-rated loop, likely bugs |
| 2 | C1–C4 collision | Constant annoyance every run |
| 3 | A1 notification feed (+ dedupe) | Prerequisite for clean E/F messaging |
| 4 | D1–D4 combat, D4 tagging fix | Core feel + a broken errand |
| 5 | E1, E2, E6, E7, E8 | Quest clarity |
| 6 | F1–F7 Red Lion and inventory | Bigger systems change |
| 7 | B1–B4 prompts, A2–A4 UI | Polish |
| 8 | G Biscuit, I score | New features |
| 9 | H map and art | Largest art lift |

## Decisions (rev 2)
- Pack Mule is kept, with broader benefits (F7).
- Signal raiders are a fixed 18 (E5). The goal is to make the objective obvious, not to change the challenge.
- Props block bullets, soft ones included (C1).
- Raiders get aim assist (D6).

## Build notes (2026-10-10)

**(verify) results**
- **A1 double Biscuit pop-up:** the two call sites were the `adoptBiscuit` banner and the `biscuitJoin` dog tip in the HUD. The tip is gone; the banner carries the key `survivor.join.biscuit`.
- **B3 school roof:** the mast ladder on the school's east wall is the way up. The ladder hatch drawn on the ZION PRIMARY roof led nowhere and is removed.
- **D2 target cap:** `powerAttack` already hit everything in reach. No cap to remove.
- **D4 pipe bomb kills not counting:** no rain branch drops the damage type. The cause was the 10 s `fireCredit` window: a walker blasted, then finished by melee later, didn't count. Replaced by a permanent `markedFireExplosive` flag.
- **E7 wave 10:** the 2026-10-10 run's wave 10 was a herd from the EAST (`herd: "EAST"` in the log). `herdAI` walks them to the far side and they leave, so the west-wall zombies were the herd. Not a pathing bug.
- **F2 reinforcement cost:** 40% off: town bars 750 to 450, sheet 1,500 to 900, Red Lion oak 1,250 to 750, steel 2,500 to 1,500.
- **H2 black splodge:** the CAFE's "smashed window" detail was a 12x8 near-black rectangle drawn over its door. Moved onto a window. `sprites.html?doors=1` now audits every building door for dark clusters (0 flagged).

**Choices the PRD left open**
- Street names (H1/E3): High Street (east-west), School Lane and Station Road (the north-south road), the bypass.
- Storylines for the score (I): the Signal, the fire engine, the Blowtorch.
- Survivors' stash guns (F5) don't use ammo.
- The Looter's caches are town spots (shops, the yard, the shed); his haul is Scrap you never had.
