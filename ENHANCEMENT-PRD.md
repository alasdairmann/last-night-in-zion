# Enoch Nights: Enhancement PRD (v1.1)

| | |
|---|---|
| **Product** | Enoch Nights |
| **Version** | 1.1 |
| **Date** | 2026-10-09 |
| **Status** | Draft for development |
| **Builds on** | `PRD.md` (v1.0). Everything in v1.0 stays unless this document says otherwise. |
| **Players** | Still single player, keyboard only |

---

## Contents

1. Summary
2. What changes in scope
3. The next 20%: choosing the features
4. Controls added in v1.1
5. **Errands: the side-mission system**
6. Errand catalogue
7. Escape: the fire engine (exfil)
8. The Signal (main quest)
9. Survivors and the safe house
10. Biscuit, the dog
11. Padding (armour)
12. Tricks (field upgrades)
13. Weapon condition (rarity)
14. Keepsakes (Gobblegums)
15. The noticeboard (trials)
16. Weather
17. New enemies and special rounds
18. Town events
19. The blowtorch (quest wonder weapon)
20. Lore and the secret song
21. HUD, UI and audio additions
22. Technical changes
23. Tuning tables
24. Debug additions
25. Milestones
26. Acceptance tests
27. Still out of scope
28. Open questions
29. Appendix: CoD source for each feature

---

## 1. Summary

v1.0 is the core loop: kill, earn Scrap, spend, survive escalating rounds. v1.1 gives the run **shape, goals and stories**.

The generator's fuel run showed what we want more of: **a short errand that pulls you across a dangerous town, for a reward you can feel, while the rounds keep coming.** v1.1 turns that into a system (**Errands**) with 12 errands, then adds the next tier of Black Ops (and later Cold War) Zombies features, adapted to Enoch's world:

- **Errands**: side missions offered over the radio and the noticeboard, of several types (fetch, carry, hold, escort, repair, hunt).
- **Escape**: repair the town's last fire engine and drive out. A run can now be *won*.
- **The Signal**: a multi-step main quest with a story payoff.
- **Survivors**: rescue people, who then help you from a safe house that you also have to protect.
- **Biscuit**: a dog companion.
- **Padding, Tricks, weapon condition, Keepsakes, trials**: the best of Cold War Zombies' depth systems, adapted.
- **Weather, Raiders, new walkers, town events**: more variety from round to round.

**Design goal for v1.1:** in any 3-round stretch, the player should have **one thing they're trying to do besides survive**.

---

## 2. What changes in scope

| Category | v1.0 | v1.1 |
|---|---|---|
| Objectives and secrets | Out | **In** (errands, escape, main quest, lore, secret song) |
| Co-op and social | Out | Still out. Survivors and the dog give a single-player sense of company. |
| Meta and replayability | Out | Still out, except the **local record of escapes and quest completion** on the menu (no unlocks). |
| Everything else | In | Extended |

**Prerequisite:** every v1.0 [Depth] feature that these systems use must ship first: generator fuel (§12.4 of v1.0), Parts (§8.9), buildables and benches (§18), bounties (§8.5), the Looter (§19.3), special rounds (§20.5). If any were cut from v1.0, build them in milestone E0 (§25).

---

## 3. The next 20%: choosing the features

v1.0 took the ten features that give 80% of the fun. The next tier are the ones that turn a good arcade loop into **a run you tell stories about**. I ranked the remaining CoD Zombies features by "fun added per unit of work", plus the *Walking Dead* features that the world asks for.

| Rank | Feature | CoD source | Why it's next | Priority |
|---|---|---|---|---|
| 1 | **Errands** | Generator power-up steps, Easter egg steps, Cold War Outbreak objectives | Gives every few rounds a goal and a route through danger. Builds on what already works. | P1 |
| 2 | **Escape (fire engine)** | Exfil (Cold War) | A way to *win*. Gives a run a climax and a decision: leave or keep going. | P1 |
| 3 | **Survivors and safe house** | (TWD) + crew/helper ideas | Something to protect besides yourself. Emotional stakes. | P1 |
| 4 | **Padding (armour)** | Armour plates (Cold War) | A second health bar to buy and repair. Another clean Scrap sink. | P1 |
| 5 | **Tricks (field upgrades)** | Field upgrades (Cold War) | An active ability on a key. Keeps the one-button combat from getting stale. | P1 |
| 6 | **Weapon condition** | Rarity tiers (Cold War) | Makes crate pulls and upgrades more interesting. More long-term spending. | P1 |
| 7 | **Raider rounds and new walkers** | Special rounds, new enemy types | Variety in what you fight. Raiders are TWD's real threat. | P1 |
| 8 | **The Signal (main quest)** | Main Easter egg | A long goal and a story payoff for committed players. | P2 |
| 9 | **Biscuit (dog)** | Ally AI ideas (e.g. Hellhound ally, Origins robots) | Personality. A friend in the dark. | P2 |
| 10 | **Keepsakes** | Gobblegums | Small surprises and bursts of power. | P2 |
| 11 | **Noticeboard trials** | Trials (Cold War) | In-run challenges that steer how you play for a while. | P2 |
| 12 | **Weather** | Map conditions (fog, Origins rain) | Changes the noise rules round to round. | P2 |
| 13 | **Town events** | Dynamic map events | Surprises with loot and risk. | P2 |
| 14 | **The blowtorch** | Wonder-weapon quests (Origins staffs, Wunderwaffe) | A quest that ends in a weapon. | P3 |
| 15 | **Lore and secret song** | Radios, secret songs | Atmosphere and discovery. | P3 |

**P1** must ship in v1.1. **P2** should ship. **P3** ships if time allows.

---

## 4. Controls added in v1.1

| Key | Action | Section |
|---|---|---|
| **X** | Use your Trick (field upgrade) | §12 |
| **Z** | Command Biscuit: tap = attack what you face / come back (toggles); hold 1 s = stay here | §10 |
| **T** | Open the errand log (pauses the game) | §5.6 |
| **Tab** (hold) | Town map: now also shows errand markers, survivors and the escape route | §21 |

All remappable. No other v1.0 bindings change.

---

## 5. Errands: the side-mission system

### 5.1 Concept
An **errand** is a short task somewhere in town, with a clear goal, a reward and sometimes a time limit or a cost for failing. Errands are offered over **Cain's walkie-talkie** (a voice from the hill, "Hilltop", and later from survivors) and on the **post office noticeboard**. They give the player a reason to go somewhere dangerous during a round.

Generator fuel (v1.0 §12.4) is refactored into this system as the **first errand** (Fuel Run).

### 5.2 Rules
- **One active errand at a time** (plus Fuel Run, which runs alongside anything else).
- **Offering:**
  - At the start of every **3rd round** (3, 6, 9…), Hilltop offers **one errand** over the radio: a banner with the errand name, a 1-line brief and "**F** accept / ignore". It stays in the log (§5.6) for that round and the next. Accepting is done with **F within 8 s** or from the log.
  - The **noticeboard** in the square (zone 1) always shows **two** available errands (refreshed every 4 rounds). Accepting: hold F at the board.
  - Some errands trigger from the world instead (e.g. knocking from the pharmacy cellar; a dog barking). These show a **"?"** marker.
- **Eligibility:** each errand has requirements (doors open, round, generator state). Never offer an errand that can't be completed.
- **No repeats** within 8 rounds, except Fuel Run.
- **Abandon:** from the log (T). No penalty except losing a Hold or Escort in progress.
- **Time limits:** shown as a countdown on the tracker. Most errands have none; urgent ones do.
- **The round doesn't pause.** Errands overlap with fighting. That's the point.

### 5.3 Errand types (building blocks)
Every errand is built from these step types. Implement each type once; errands are data (§22.2).

| Type | What the player does | Implementation |
|---|---|---|
| **Fetch** | Pick up an item somewhere (walk over or hold F) | Item spawns at one of N candidate spots |
| **Carry** | Bring a carried item to a place. While carrying: speed 85%, can't use guns (melee and shove only); taking 3 hits drops it (pick it up again) | `carry` state on the player |
| **Use** | Hold F at an object for X seconds; the player can't attack while holding; being hit cancels progress | Generic interaction with hold time |
| **Hold** | Stay inside an area for X seconds. The timer only counts while inside. Spawns favour that area. | Area trigger + timer, pauses when outside |
| **Escort** | An NPC follows you to a place. The NPC has HP. If it dies, the errand fails. | NPC follow AI |
| **Hunt** | Kill a marked enemy (or N of a type, or N in an area) | Tag enemies at spawn |
| **Light / Activate** | Activate N objects in a set time | Multiple Use steps with a shared timer |
| **Deliver Scrap** | Pay Scrap to someone (a contribution, not a purchase) | Purchase prompt |

### 5.4 Rewards
Errand rewards are deliberately **varied** so they're not just more Scrap. Each errand gives one or more of:
- Scrap
- Parts
- A guaranteed find (§14 of v1.0) spawned at the errand's end point
- A free trader's crate pull
- A permanent map change (a spawn point closed, a shortcut opened, a trap upgraded)
- A survivor (§9)
- A unique item (keys, a radio, a weapon)
- Progress in the main quest (§8) or the escape (§7)

### 5.5 Failure
- Failing (timer runs out, escort dies) shows a short banner and a radio line. Some errands have a **consequence** (listed per errand). Most just end.
- Being downed doesn't fail an errand, unless the step was Hold or Escort and the timer runs out.

### 5.6 The errand log (T)
- Pauses the game.
- Lists: the active errand with its current step, the generator fuel status, offered errands (radio and noticeboard), main-quest progress (only steps found so far), escape progress.
- Q/E to select, F to accept or abandon, T or Esc to close.

### 5.7 Tracking
- **HUD tracker** (top-right, under active finds): the errand name, the current step in a few words ("Bring the fuse to the generator"), and a timer if any.
- **Off-screen arrow** in green (the only green arrow, so it's never confused with danger) pointing at the current objective.
- **Tab map** shows the objective with a green marker.

---

## 6. Errand catalogue

12 errands for v1.1. Every number goes in `tuning.js` (§23). Each errand lists: offered by, requirements, steps, reward, failure.

### 6.1 Fuel Run (refactor of v1.0 generator fuel)
- **Offered:** automatically when generator fuel is at **2 rounds left**. Radio: "Gennie's getting thirsty."
- **Requires:** generator started.
- **Steps:** (1) Fetch a jerry can at the petrol station (zone 4): costs 500 Scrap (2) Carry it to the generator (3) Use 1.0 s.
- **Reward:** fuel full (8 rounds).
- **Failure:** fuel runs out: the lights go out (v1.0 §12.4). The errand stays active until done.
- **New in v1.1:** the jerry can can be **dropped and picked up again** (G drops it), and **shooting a dropped jerry can makes it explode** (300 dmg, 48 px). Players will use this.

### 6.2 Blown Fuse
- **Offered:** world trigger. With the generator on, each trap activation and workshop use has a **4% chance** to blow the fuse. The lights go out with a bang (same as running out of fuel) and the radio says "Fuse has gone."
- **Steps:** (1) Fetch a fuse: one of 3 spots: hardware store (zone 1), garage (zone 4), school caretaker's room (zone 7) (2) Use the fuse board at the fire station, 2.0 s.
- **Reward:** power back, +300 Scrap.
- **Failure:** none; power stays off until fixed.
- **Why:** turns the power into something you protect, not something you switch on once.

### 6.3 Supply Drop
- **Offered:** radio, from round 6. Requires zone 7 (school) open.
- **Steps:**
  1. Repair the radio mast on the school roof: **Use** 3 s at the mast **after** fetching 2 parts: a **car battery** (garage, zone 4) and **cable** (hardware store, zone 1). 2 Fetches + 1 Use.
  2. Hilltop says a drop is coming. Fetch a **flare** from the fire station locker and **Use** it on the centre of the playing field (2 s).
  3. **Hold** the playing field for **45 s** while a small plane is heard overhead. Spawns favour the playing field. At 45 s, a crate on a parachute lands.
  4. **Use** the crate, 1.5 s.
- **Reward:** the crate holds **2 finds** (from the bag), **1 free trader's crate pull** (claim at the crate within 2 rounds), **3 Parts** and a Padding refill (§11).
- **Failure:** if the player leaves the field for more than 15 s during step 3, the plane goes round again: the timer resets to 45 s once. Leaving twice: the drop lands in the woods and is lost.

### 6.4 Knocking in the Cellar (rescue)
- **Offered:** world trigger, from round 5 when zone 2 is open. A knocking sound from the pharmacy cellar door, "?" marker.
- **Steps:**
  1. **Use** the cellar door, 2.0 s (it's nailed shut from the outside).
  2. Inside: a survivor (§9) is hiding with 4 walkers. **Hunt**: kill the 4.
  3. **Escort** the survivor to the safe house (the pub, zone 5). The survivor has 150 HP, follows 16 px behind Cain, and stops and cowers when 2+ walkers are within 24 px (Cain has to clear them).
- **Reward:** the survivor joins the safe house (§9).
- **Failure:** the survivor dies. Radio silence for a round (no errands offered next radio cycle). Cain says a line.

### 6.5 Medicine Run
- **Offered:** by a **survivor in the safe house** who is **sick** (§9.4), or from round 8 by Hilltop.
- **Steps:**
  1. Fetch the **pharmacy back-room key**: carried by a marked walker (**Hunt**: a walker in a white coat spawns this round).
  2. **Use** the back-room door at the pharmacy, 1.0 s.
  3. Fetch **antibiotics** inside.
  4. Carry them to the safe house within **3 rounds**.
- **Reward:** the sick survivor recovers; **+1 Bandages use** (max 3, can refill a used one).
- **Failure:** the sick survivor dies.

### 6.6 Light the Beacons
- **Offered:** radio, the round **before a herd round** (every 10th round, v1.0 §20.5). "Herd's coming. Light the beacons and we can turn some of them."
- **Steps:** **Light/Activate** 3 rooftop braziers within **90 s**: the church tower (zone 6), the fire station tower (zone 3), the school roof (zone 7). Each needs **1.5 s Use**. The braziers are reached by ladders (fixed points, map data).
- **Reward:** the herd round has **25% fewer** enemies, and all 3 beacons stay lit (light sources, 64 px) for the rest of the run.
- **Failure:** the herd comes at full size.

### 6.7 Seal the Drain (clear the nest)
- **Offered:** noticeboard, from round 10. The **storm drain** in the square (a v1.0 spawn point) has become a "nest": it spawns **50% more often** than other points from now on (applied when offered, so ignoring it has a cost).
- **Steps:**
  1. Fetch a **pallet** (builders' yard, zone 8) and **nails** (hardware store, zone 1).
  2. Carry the pallet to the drain.
  3. **Hold** at the drain for 20 s (Cain nails the pallet down; he can't attack, but can shove).
- **Reward:** the drain spawn point is **closed** for the rest of the run. +1,000 Scrap.
- **Failure:** none, but the drain stays a nest.

### 6.8 The Trader's Errand
- **Offered:** at the trader's crate, when the player uses it for the 3rd time in a run. The trader wants a parcel taken to a dead drop.
- **Steps:**
  1. Fetch the parcel at the crate.
  2. Carry it to the **phone box** in the square (if the crate is in zone 1, the destination is the church porch instead) within **60 s**.
- **Reward:** crate price **−25%** for the rest of the run, and the crate gains the **Masterwork** pool (§13) for the next pull.
- **Failure:** the trader is annoyed: crate price +100 for 3 rounds.
- **Twist:** 1 time in 4, the parcel is **ticking**. It's a pipe bomb (G throws it). Cain says "That's not a parcel." The reward still pays if delivered.

### 6.9 Open the Sluice
- **Offered:** noticeboard, from round 8. Requires zone 9 open.
- **Steps:** (1) Fetch the **sluice wheel** (allotments shed, zone 9) (2) Use it on the sluice gate at the river's edge (3.0 s).
- **Reward:** the **flooded underpass** spreads: a second water area (12 × 4 tiles) floods the path into zone 9 from the south, slowing all dead there to 60% for the rest of the run. Players gain a permanent defensive zone.
- **Failure:** none.

### 6.10 Searchlight Batteries
- **Offered:** radio, from round 7, requires the generator on and zone 7 open.
- **Steps:** Fetch **3 batteries** from cars around town (marked cars: hold F 1.0 s each, setting off the car's alarm, Loud noise, v1.0 §22) and Use the searchlight base (1.0 s).
- **Reward:** the searchlight works **without the generator** and its beam now also **marks specials** (Brutes, Looters, Screamers) with a white outline when they cross the field.
- **Failure:** none.

### 6.11 Bounty Contract (extension of v1.0 bounties)
- **Offered:** noticeboard, from round 8.
- **Steps:** **Hunt** a named special: one of "the Butcher" (§17.2), a Raider captain (§17.4), or 3 Screamers in one round.
- **Reward:** 1,500 Scrap + a Keepsake (§14).
- **Failure:** if not done within 4 rounds, it expires.

### 6.12 Lost Dog
- **Offered:** world trigger, from round 4, once per run. Barking from the allotments (zone 9) or the school (7), "?" marker. This is how Biscuit (§10) joins.
- **Steps:**
  1. Find the dog: it's trapped in a shed with walkers outside. **Hunt**: clear them (5 walkers).
  2. Fetch **food** from the pub kitchen (zone 5).
  3. **Use** the shed door with the food in hand, 1.0 s.
- **Reward:** Biscuit joins.
- **Failure:** if not done within 5 rounds, the barking stops. The dog is gone for this run.

### 6.13 Errand offer schedule (summary)
| Round | Typical offer |
|---|---|
| 3 | Radio: Supply Drop (if school open) or Lost Dog |
| 4–6 | World: Knocking in the Cellar, Lost Dog. Noticeboard: Open the Sluice, Searchlight Batteries |
| 6–9 | Radio: Supply Drop, Medicine Run, Light the Beacons (before round 10) |
| 10+ | Noticeboard: Seal the Drain, Bounty Contract. Escape steps (§7) |
| Any time | Fuel Run, Blown Fuse, the Trader's Errand (triggered) |

Picking: from the eligible set, weighted toward errands the player hasn't done this run.

---

## 7. Escape: the fire engine (exfil)

### 7.1 Concept
The fire station has **the last fire engine in the valley**. It doesn't run. If Cain fixes it, he can drive out of Enoch: the run ends in **escape** (a win). It's long, risky and optional. Players who don't take it keep playing endless rounds as in v1.0.

### 7.2 Unlock
At **round 15**, if the generator has been on at least once, Hilltop says: "That engine at the station. If you can get it running, we'll open the gate for you." The escape steps appear in the log.

### 7.3 Steps (any order for 1–4)
| # | Part | How | Where |
|---|---|---|---|
| 1 | **Battery** | Fetch from the tow truck at the garage; Use 2 s | Zone 4 |
| 2 | **Tyre** | Fetch from the tyre stack; it's heavy: **Carry** (speed 70%, no guns) | Zone 4 |
| 3 | **Diesel** | Two **jerry cans** (each a Carry, 500 Scrap each) | Petrol station |
| 4 | **Keys** | Carried by **the Fire Chief**: a marked, armoured walker in a white helmet who spawns once Step 4 is revealed. **Hunt** him. | Wanders zones 3, 5, 6 |
| 5 | **Fit everything** | Use the fire engine 3 × 3 s (battery, tyre, fuel): each one triggers a burst of 6 walkers from the bay doors | Zone 3 |
| 6 | **Call it in** | Use the engine's radio, 1 s. Hilltop: "Ninety seconds. Hold on." | Zone 3 |
| 7 | **The last stand** | **Hold** the fire station for **90 s**. A herd comes from all directions (count = the current round × 1.5, spawning at 2× rate). A Brute arrives at 45 s. | Zone 3 |
| 8 | **Drive** | At 90 s, the engine starts (a big moment: siren, lights). Hold F at the cab 1 s. | Zone 3 |

- Steps 1–4 progress is **kept** if Cain goes down and is revived.
- During the last stand, the round counter stops; the herd replaces the round.
- **After step 6 there's no going back**: the escape must be completed or the run ends in death.

### 7.4 Ending
- A short scene in engine (no cutscene art needed): the fire engine smashes through the fence panels at the end of Main Street, walkers bounce off, it drives up the road toward the hill as the camera holds on the burning town. Text: **"Cain made it home."**
- The **escape screen** replaces the game-over screen: same stats, plus "Escaped on night N", and the time taken.
- Menu shows "Escapes: N" and the best (earliest) escape round. (Local only, not an unlock.)

### 7.5 Tuning intent
- A competent player should be able to escape around **rounds 18–24**.
- The escape should cost a lot (at least 2,000 Scrap of jerry cans and errands while not earning) so going for it is a real trade against farming.

---

## 8. The Signal (main quest)

### 8.1 Concept
A broadcast on a loop cuts in on Cain's walkie-talkie: numbers, static, a woman's voice reading a list of towns. Following it is the main quest: a chain of **7 steps**, mostly hidden, that end in a story payoff and a reward. Like CoD's main Easter eggs, the steps are **not explained**: the player discovers them, with hints in radio lines and the world.

### 8.2 Steps
| # | Step | Hint the player gets | Mechanic |
|---|---|---|---|
| 1 | **Hear it** | From round 5, 1 in 3 radio cycles: static and fragments | Automatic |
| 2 | **Find the receiver** | A walker in a hunting jacket carries a ham radio receiver (a 2% chance spawn from round 5, guaranteed by round 10). It glows faintly. | Hunt + Fetch |
| 3 | **Power it** | The receiver needs mains power: Use it at the workshop with the generator on, 3 s | Use |
| 4 | **Tune it** | Three **frequency cards** are pinned up around town (church noticeboard, school staffroom, the pub's dartboard). Each is a Fetch. They only appear after step 3. | 3 × Fetch |
| 5 | **Find higher ground** | The receiver needs height: Use it at the top of the church bell tower | Use (5 s, Hold-like: spawns favour the tower) |
| 6 | **Answer** | The voice asks for a code: the 3 numbers on the cards, **in the order of the bell rings** at the start of the next round (1–3 rings mean 1st–3rd card). Use the receiver at the tower again, choose cards with Q/E and F. Wrong order: a Brute spawns. | Puzzle |
| 7 | **The signal tower** | The voice says she'll send help if they can boost the signal. Build the **booster** (3 Parts + the radio mast from Supply Drop already repaired) and **Hold** the school roof for **120 s** with Raiders (§17.4) attacking. | Build + Hold |

### 8.3 Payoff
- A **radio exchange** (text on screen, typed out) reveals who the voice is (a group in the next valley, with power and a working hospital, which sets up later Enoch content in the grand strategy).
- **Rewards:** every held comfort **ripens** instantly (v1.0 §15.3); the player gets **all 9 comforts** without a cap for the rest of the run; and the **escape** (§7) last stand is shortened to 45 s.
- Menu shows a small radio icon once The Signal has been completed (local only).

### 8.4 Design rules
- The quest must be **completable solo by a strong player by round 20–25**.
- **Every step must be visible in the world** once its previous step is done. No hidden pixel hunts: items glow faintly and make a quiet sound.
- The errand log shows only the steps already done, as "?" for the next one, with a single hint line.

---

## 9. Survivors and the safe house

### 9.1 Concept
In *The Walking Dead*, the living are the point. In v1.1 Cain can **rescue survivors** (from errands, mostly §6.4, plus events §18). They shelter in the **safe house**: the **Red Lion pub** (zone 5), which gets its own barricades. Each survivor gives a **service** while they're alive. If the dead get into the safe house, survivors can die.

### 9.2 The safe house
- The pub's **inner rooms** (bar and back room) become the safe house the first time a survivor is rescued. Banner: "The Red Lion is a safe house now."
- The safe house has **4 dedicated barricades** (v1.0 barricade rules).
- A **safe-house health** bar (shown on the HUD only when it's under attack): if any walker gets inside, it attacks survivors: each survivor has 100 HP and fights back weakly (20 dmg every 1.5 s).
- When a survivor is hurt, the HUD shows a red plaque: "**The Red Lion is under attack**", plus an off-screen arrow.
- Max **4 survivors**.

### 9.3 Survivors
Each survivor is generated from the Enoch portrait system (§23.3 of v1.0), with a **name**, an **age** and one **role**. Roles are chosen so the first survivor rescued in a run has a role the player doesn't have yet.

| Role | Service | How it shows |
|---|---|---|
| **Medic** | +1 Bandages use (up to 4). Health regen starts 1 s sooner. Treats sick survivors (Medicine Run not needed if the Medic is healthy). | Stands by the bar with a first-aid kit |
| **Mechanic** | Workshop costs −20%. Generator fuel lasts 10 rounds. Blown fuse chance halved. | Tinkering at a table |
| **Lookout** | Specials (Brutes, Looters, Screamers, Raiders) get a marker on the HUD as soon as they spawn. A radio warning 5 s before each special. | Upstairs window |
| **Cook** | Hot Stew costs −30%. Every round start: Cain regains Padding (§11) of 1 layer if he's within 64 px of the pub. | At the stove |
| **Scavenger** | At every round start, drops **1 Part** and 100–300 Scrap on the bar for Cain to collect. | Comes and goes |
| **Fighter** | Defends the safe house: 2× damage, 200 HP. Kills walkers that get inside. | By the door with a bat |

### 9.4 Survivor states
- **Healthy:** service works.
- **Hurt** (under 50% HP): service works at half effect. Heals 10 HP per round.
- **Sick:** 1 in 8 chance per round per survivor from round 10 (only if no healthy Medic). Service stops. Triggers the **Medicine Run** errand (§6.5). Dies after 3 rounds if untreated.
- **Bitten:** a survivor killed by walkers inside the safe house turns: they rise as a **walker in their clothes**, inside the pub. Cain must kill them. Cain says a short line. This is the emotional cost.

### 9.5 Visiting
- Cain can walk into the safe house and **talk** (F) to each survivor: one short line about their past, rotating. No dialogue trees.
- Survivors comment over the radio on big moments (the generator turning on, the Brute arriving).

---

## 10. Biscuit, the dog

### 10.1 Concept
A scruffy brown-and-white terrier cross with a red collar. Rescued through the **Lost Dog** errand (§6.12). Follows Cain, bites walkers, barks at danger. A friend in the dark.

### 10.2 Behaviour
| Mode | Behaviour |
|---|---|
| **Follow** (default) | Stays within 24 px behind Cain. Attacks any walker that gets within 32 px of Cain. |
| **Attack** (Z tap toward a target) | Runs at the nearest enemy in Cain's facing direction within 120 px, bites until it dies or Z is tapped again. |
| **Stay** (Z hold 1 s) | Holds position. Guards that spot: attacks walkers within 48 px. Good for guarding a barricade or the safe house. Z tap: come back. |

### 10.3 Stats
| Stat | Value |
|---|---|
| HP | 200 (+50 every 5 rounds) |
| Speed | 120 px/s |
| Bite | 60 dmg, 0.8 s interval, staggers walkers 0.3 s |
| Pins | Every 4th bite **knocks a walker down** for 1.5 s (Cain's hits on a downed walker are criticals, v1.0 §7.1) |
| Barks | Barks and points (head toward it) at specials and Looters within 160 px, even in the dark: they get a silhouette outline for 2 s |

### 10.4 Down and out
- When Biscuit's HP hits 0, he's **down**: he lies whimpering where he fell. Cain revives him by holding F for 2 s. While down, he can be killed by 3 more walker hits.
- If he dies, he's gone for the run. A short scene: Cain kneels (1 s), says a line.
- He doesn't take damage from Cain's melee or bullets. He does take damage from explosions and fire.
- Biscuit **doesn't earn Scrap**. His kills give Cain half Scrap (25).
- Noise: barking is **Medium** noise (v1.0 §22). He barks when attacking.

---

## 11. Padding (armour)

### 11.1 Concept
Cold War's armour plates, as *Walking Dead* armour: magazines and cardboard taped to the forearms, a leather jacket, a motorbike back protector, an old stab vest. **Padding** is a second bar that absorbs damage before health.

### 11.2 Rules
- **Up to 3 layers.** Each layer has **50 points** and absorbs **75%** of incoming damage (the rest goes to health) until it's used up.
- **Buy** at the builders' yard bench (zone 8) and the fire station lockers (zone 3):
  | Tier | What it looks like | Cost | Unlocks the next tier |
  |---|---|---|---|
  | Layer 1 | Taped magazines on forearms | 1,500 | Always available |
  | Layer 2 | Leather biker jacket | 2,500 | Round 6 |
  | Layer 3 | Stab vest | 4,000 | Generator on |
- Buying a layer **repairs** all current layers.
- **Repair** partly with **Parts**: 1 Part = 25 points to the most damaged layer, at any bench (hold F 0.5 s). The Ammo Bag find also repairs 1 layer.
- Layers are drawn on Cain's sprite (tape on the arms, a jacket, a vest) so you can see them.
- Padding is **not lost** when downed, but it's all **used up** (0 points left).

### 11.3 HUD
Three small segmented blocks above the health bar (v1.0 had no health bar, only the vignette; v1.1 adds a thin health bar here, so both read together).

---

## 12. Tricks (field upgrades)

### 12.1 Concept
Cold War's field upgrades: an **active ability** on its own key (**X**), charged by kills. In v1.1, Tricks are improvised survival tricks.

### 12.2 Picking a Trick
- At the **start of each run**, before round 1 begins (during a 10 s pre-round), a choice of **all 5 Tricks** appears on a stone plaque. Q/E to choose, F to confirm. The choice is permanent for the run.
- **Last choice is remembered** (local preference only).

### 12.3 The Tricks
| Trick | Effect | Charge (kills) |
|---|---|---|
| **Flare Burst** | Cain lights a road flare and holds it up. All walkers within 120 px are **blinded** for 4 s (they stop and turn away), and the area is lit for 8 s. | 25 |
| **Red Mist** | 8 s of fury: melee damage ×2, swings 30% faster, every melee kill heals 10 HP. Screen edges tint red. | 30 |
| **Smoke Bomb** | A cloud 48 px wide for 6 s. Walkers lose track of Cain inside it; he's invisible to them while in it. Lets him slip a group. | 20 |
| **Whistle** | A sharp whistle. Creates a Loud noise lure at Cain's facing point, 100 px out, for 5 s; everything within 260 px walks there. Ideal before a pipe bomb or a trap. | 15 |
| **Stand Your Ground** | Plants a flag (rag on a broken pole): for 10 s, within 40 px of it Cain takes 50% less damage and his barricade repairs are instant. | 30 |

- Charge from **kills only** (any kills, including traps, at 50%).
- When full, the HUD icon glows and a small chime plays.
- **Upgrade** [P2]: the workshop can upgrade the Trick once (5,000 Scrap, needs power) for a stronger effect (e.g. Flare Burst sets blinded walkers on fire).

---

## 13. Weapon condition (rarity)

### 13.1 Concept
Cold War's weapon rarity (Common → Legendary), as **condition**: in this world, every gun and blade has been through a year of weather.

| Condition | Colour (HUD and pickup glow) | Damage | Other |
|---|---|---|---|
| **Rusty** | Grey | −20% | Melee durability −30%; guns jam (5% chance per shot: 0.6 s to clear) |
| **Worn** | Khaki | Base | — (all v1.0 weapons are Worn) |
| **Sound** | Green | +20% | Melee durability +30% |
| **Fine** | Blue | +45% | +1 mod (§13.3) |
| **Masterwork** | Amber | +80% | +2 mods. Melee: unbreakable. |

### 13.2 Getting condition
- **Racks** sell **Worn**.
- **The trader's crate** rolls condition: Rusty 15%, Worn 45%, Sound 25%, Fine 12%, Masterwork 3%. (The Trader's Errand gives the next pull the Masterwork pool: Fine 50%, Masterwork 50%.)
- **Improve condition** at any bench: hold F and pay **Parts**: Rusty → Worn 2 Parts, Worn → Sound 4, Sound → Fine 8, Fine → Masterwork 14. (This is the Cold War salvage-to-rarity loop, with Parts as salvage.)
- **The workshop** (Pack-a-Punch, v1.0 §16) stacks multiplicatively with condition.

### 13.3 Mods
Mods are random from a list, rolled when a weapon reaches Fine or Masterwork. Shown in the weapon prompt and on the HUD weapon plaque.

| Gun mods | Melee mods |
|---|---|
| Extended mag (+50% mag) | Long grip (+4 reach) |
| Quick hands (reload −30%) | Heavy head (+50% knockback) |
| Suppressor (noise one level lower) | Taped handle (swing recovery −20%) |
| Hollow points (+1 penetration) | Barbed (5 dmg/s bleed for 3 s) |
| Hair trigger (+15% fire rate) | Balanced (crit chance: staggered **or** pinned targets) |

---

## 14. Keepsakes (Gobblegums)

### 14.1 Concept
Gobblegums, as **keepsakes**: odd little things from the old world that give a one-time or short boost. Dispensed by the **jukebox in the pub** (zone 5): put in Scrap, it plays a song and a keepsake drops from the change slot. (The jukebox needs power.)

### 14.2 Rules
- **1 keepsake per round.** Cost: 500, then 1,000, then 2,000 within a run (resets every 5 rounds to 500).
- Keepsakes are **activated immediately** when taken, or (marked ⏵) **held** and used by pressing **X twice quickly** (double tap). Only one held at a time.
- Each run's jukebox has a random **pool of 8** from the 14 below.

### 14.3 The keepsakes
| Keepsake | Like-for-like | Effect |
|---|---|---|
| **Lucky Penny** | In Plain Sight / misc | Next trader's crate pull can't be the "CLOSED" sign and rolls condition +1 |
| **Wedding Ring** ⏵ | Near Death Experience-ish | When used: next time Cain goes down, he's back up instantly with full HP (no comfort loss) |
| **Pocket Watch** | Stock Option-ish | 3 rounds: every gun reload is free from reserve (ammo doesn't go down on reload) |
| **Car Keys** ⏵ | Anywhere But Here | When used: Cain is moved to a random safe spot in an open zone, away from enemies |
| **Rosary** ⏵ | Kill Joy | When used: drops an Adrenaline find at Cain's feet |
| **Polaroid** | Alchemical Antithesis-ish | 60 s: every 10 Scrap earned also gives 1 bullet to the held gun |
| **Toy Soldier** ⏵ | Phoenix Up / ally | When used: **a friendly survivor NPC** shoots from a nearby rooftop for 30 s (a rifle, 300 dmg every 1 s at the nearest walker) |
| **Harmonica** ⏵ | Profit Sharing / lure | When used: Cain plays: every walker within 200 px stops and sways for 5 s |
| **Lighter** ⏵ | Burned Out | When used: the next 10 enemies that hit Cain catch fire |
| **Crossword** | Temporal Gift | The next find dropped lasts 2× as long |
| **Old Photo** | Perkaholic-lite | A random comfort Cain doesn't have, free (respects the cap) |
| **Dog Tag** | Unquenchable-ish | +1 comfort cap for the rest of the run |
| **Train Ticket** | Head Drama | 3 rounds: every gun shot is a headshot |
| **Biscuit Tin** | (Enoch) | If Biscuit is with you: heals him and +100% bite for 2 rounds. If not: 5 Parts |

---

## 15. The noticeboard (trials)

### 15.1 Concept
Cold War's trials machine, as the **post office noticeboard**, which already gives bounties (v1.0 §8.5) and errands (§5). Now it also posts a **trial**: a challenge for the next **2 rounds**.

### 15.2 Rules
- One trial is posted at the start of **every 2nd round** from round 4, replacing the previous one.
- **No accepting needed.** It's active automatically. HUD: a small plaque under the errand tracker with the trial and a progress bar.
- **Tiers:** each trial has a target; reaching it gives a reward, and reaching **2×** the target gives a better one.

### 15.3 Trial pool (draw randomly, never the same twice in a row)
| Trial | Target |
|---|---|
| Kill N walkers with melee | 25 + 2 × round |
| Kill N walkers with critical hits | 10 + round |
| Kill N with the shotgun / rifle / crossbow (if owned) | 15 + round |
| Kill N walkers while inside zone X (random open zone) | 20 + round |
| Repair N planks | 20 |
| Kill N walkers without taking damage (resets on hit) | 15 |
| Kill N walkers with explosives or fire | 12 |
| Kill N walkers while the noise meter is under 20 | 30 |
| Kill N walkers with Biscuit's help (pinned walkers) | 10 |

### 15.4 Rewards (random per tier)
| Tier | Rewards |
|---|---|
| 1 | 500 Scrap, 2 Parts, a throwable refill, or 1 Padding layer repair |
| 2 | A Keepsake, a random find spawned at Cain's feet, 5 Parts, or a free condition upgrade on the held weapon |

---

## 16. Weather

### 16.1 Concept
Weather changes the rules of a round, especially the **noise** rules, which makes guns more or less attractive.

### 16.2 Conditions
Weather is rolled at the start of each round from round 5 (it can also continue for up to 3 rounds):

| Weather | Chance | Effect |
|---|---|---|
| **Clear** | 50% | v1.0 rules |
| **Rain** | 22% | Noise radii ×0.6 (guns are safer). Visibility −15%. Puddles on tarmac reflect lights (2 px reflection, cosmetic). Fire effects last half as long. |
| **Storm** | 8% | Rain effects, plus **thunder**: every 15–25 s a lightning flash lights the whole map for 0.3 s (all enemies visible), and thunder is a Very loud noise from a random point (pulling some walkers away). 10% chance per storm round to **blow the fuse** (§6.2). |
| **Fog** | 15% | v1.0 fog round rules (now as weather). |
| **Still and cold** | 5% | Noise radii ×1.5 (sound carries). Breath puffs (cosmetic). Walkers 10% slower. |

- The **round-start banner** shows the weather with an icon. The music layer gets a weather variant (§21.3).
- Weather is drawn as pixel particles: rain streaks (2 px diagonal lines, 300 max), fog as dithered bands (v1.0).

---

## 17. New enemies and special rounds

### 17.1 New walker types
| Type | From round | Share | Behaviour |
|---|---|---|---|
| **Screamer** | 9 | 3% (max 2 alive) | A thin walker with its jaw hanging. Keeps away from Cain (stays 100–160 px off). Every 6 s it **screams** (1.0 s wind-up, visible): +4 walkers spawn at the nearest spawn points, beyond the round count. Killing it during the wind-up interrupts it. A priority target. |
| **Hazmat** | 11 | 5% | In a torn yellow hazmat suit. On death, bursts in a green cloud: 3 s, 32 px, 15 dmg/s, and enemies inside heal 20 HP/s. Fire burns the cloud away. |
| **Burning** | Created | — | A walker set on fire (Molotov, Burn, fuel) has a 30% chance to keep walking while burning: it **sets fire** to anything it touches (Cain, barricades: planks burn 1 per 2 s, placeables) for 4 s. |
| **Tangled** | 6 | 6% | Wrapped in barbed wire from someone's fence. Melee hits on it cost **double durability** and the attacker takes 5 dmg. Guns, shove and explosives are fine. |

### 17.2 The Butcher (mini-boss)
- A huge walker in a stained apron with a meat cleaver lodged in its shoulder. 2,500 HP (+1,500 each appearance). From round 13, spawns once every 6–8 rounds **instead of a Brute** in that slot.
- **Grab:** if within 20 px, a 0.6 s wind-up, then grabs Cain: he's held for 2 s, takes 40 dmg, and must **mash Space** (8 presses) to break free early. Shove during the wind-up dodges it.
- Reward: 600 Scrap, a guaranteed find, and the **meat cleaver** dropped as a melee weapon (Sound condition: 180 dmg, 70° arc, fast).

### 17.3 Herd rounds, extended
v1.0's herd round (every 10th round) now **moves through town**: the herd spawns at one edge and paths toward the **opposite** edge rather than straight at Cain. Walkers that see Cain within 80 px (or hear him) leave the herd and attack. A careful player can **let most of it pass** by hiding and staying quiet (Smoke Bomb, no guns, safe house). A loud player fights all of it. Light the Beacons (§6.6) reduces it.

### 17.4 Raider rounds
- Living enemies with guns: *The Walking Dead*'s real danger. From round 14, a **Raider round** replaces some dog rounds (alternate: dogs, Raiders, dogs…).
- Announcement: an engine revving and a voice on a megaphone: "We just want your stuff, old man." 5 s warning.
- **Raiders** (6 + 1 per Raider round, cap 14) arrive in pickups at 2 fixed drop points (the bypass, the builders' yard). **No walkers spawn during a Raider round.**

| Raider | HP | Weapon | Behaviour |
|---|---|---|---|
| **Gunman** | 300 | Pistol: 15 dmg per shot, 1 shot per 1.2 s | Takes cover behind cars, bins, walls (marked cover points in the map data, §22.3). Moves between cover. Peeks and shoots along 8 directions (same rules as Cain). |
| **Brawler** | 450 | Bat | Rushes like a runner. |
| **Shotgunner** | 400 | Shotgun: 6 × 8 dmg, short range | Advances slowly. |
| **Captain** (1 per round) | 1,200 | Rifle: 40 dmg, 1 shot per 2 s, a visible red laser line 0.8 s before | Stays back. Kill the Captain and the rest **flee** (they despawn running). |

- **Bullets are visible projectiles** (2 × 1 px yellow tracers, 260 px/s) so the player can dodge on a keyboard. Cover blocks them.
- Raiders **fire noise** that attracts the dead (but walkers don't spawn during the round, so this only matters if walkers remain from the last one).
- Raiders **target the safe house** if Cain is far away: they try to take survivors' supplies (−1 Part each that reaches the bar).
- **Rewards:** each Raider drops ammo (fills the held gun's reserve by 10%), 100 Scrap. The Captain drops 1,000 Scrap and a guaranteed Fine weapon (a gun from their arsenal).

### 17.5 Dog rounds, extended
- Some dogs are **"leaders"** (1 per dog round from the 3rd dog round): bigger, scarred, 2× HP. While the leader lives, the pack circles and attacks together (all dogs lunge within 1 s of each other). Killing the leader breaks them up.
- If **Biscuit** is with you, he **barks at the pack 3 s early** and draws 1–2 dogs onto himself.

---

## 18. Town events

### 18.1 Concept
One-off events that happen mid-round, at random, from round 6: about **1 per 4 rounds**, never in the same round as an errand world trigger. Each lasts 30–90 s, makes noise, and offers loot and danger.

### 18.2 Events
| Event | What happens | Reward | Risk |
|---|---|---|---|
| **Helicopter crash** | Heard overhead, then a crash in an open zone (smoke column). The wreck burns for 60 s. | When the fire's out: a locked case (Use 2 s): a Fine or Masterwork gun + 3 Parts | Very loud: pulls every walker on the map toward it |
| **Bus through the fence** | A school bus rolls down the hill (no driver) and crashes through a fence on the edge of town. | Opens a **permanent new shortcut** between two zones | A new spawn point opens at the gap |
| **Car alarm chain** | A walker sets off a car alarm, and then 3 more go off across town over 20 s | Lure walkers away from you, if you're far from them | Spawns favour those directions |
| **Survivor on a roof** | A survivor waves from a roof and shouts. Reach the building: **Hold** under the window 20 s while they climb down. | A survivor (§9) | Spawns favour that building |
| **Supply truck** | A wrecked truck's back door has fallen open on the bypass edge. | Fetch 3 crates (Carry each, 1 at a time, to the safe house): 2 Parts + 300 Scrap each | Each Carry is slow |
| **The quiet** | No spawns for 20 s, total silence, the music stops. Then a herd of 10 arrives at once. | None | Pure tension (use sparingly: max once per run) |
| **Fire spreads** | A building catches fire (a Molotov or Burning walker can also start one). It burns for 3 rounds: it can't be entered and is a light source. | Light | Lose access to anything inside (a rack, a comfort) for 3 rounds |

---

## 19. The blowtorch (quest wonder weapon) [P3]

### 19.1 Concept
Like CoD's quest wonder weapons (Origins staffs), a weapon you **build through a quest**. Cain builds a **flamethrower from a weed-burner**, a propane tank and the fire engine's pump.

### 19.2 Steps
1. **Fetch the weed burner**: allotments shed (zone 9). The shed is padlocked: the key is on the **scarecrow** (Use 1 s).
2. **Fetch the propane tank**: the pub's beer garden barbecue (zone 5).
3. **Fetch the pump**: the fire engine (zone 3). **Use** 3 s (if the escape is in progress, this takes from the engine's *spare* pump instead, no conflict).
4. **Build** at any bench with 5 Parts.
5. **Feed it**: the blowtorch needs **fuel**: every jerry can (500 Scrap) fills it fully. No other ammo source (Ammo Bag fills 25%).

### 19.3 Stats
| Property | Value |
|---|---|
| Damage | 120/s in a 28 px cone + burning (40 dmg/s, 4 s) |
| Fuel | 20 s of continuous fire |
| Penetration | Hits everything in the cone |
| Noise | Medium |
| Workshop upgrade | **"The Dragon"**: 240/s, 40 px cone, burning spreads between touching enemies |

Takes a gun slot.

---

## 20. Lore and the secret song [P3]

### 20.1 Radio tapes
- **8 cassette tapes** hidden around town (fixed spots, glinting faintly), each played on Cain's walkie-talkie when picked up: a 20–30 s text log typed on screen with a short synth sting.
- Content: the town's last days (the pub landlord's diary, a schoolteacher's evacuation, the fire chief's last call, the trader's first visit). The 8th tape hints at **The Signal**.
- The errand log has a **Tapes** tab.

### 20.2 The secret song
- **3 teddy bears** (a nod to CoD's Mystery Box bear) sit in odd places: on the war memorial, on the church roof, in the school lost-property box. Hold F on each for 1 s (a squeak).
- After the third, the jukebox (§14) plays **the Enoch Nights song** (an original track in Enoch's synth: the town theme, full band, 2–3 minutes) for one round, and every walker killed during it pays 2× Scrap.

---

## 21. HUD, UI and audio additions

### 21.1 HUD
```
+---------------------------------------------------------------+
| [ROUND 12  🌧]                              [ADR 0:24        ]|
|                                             [ERRAND          ]|
|                                             [Seal the Drain  ]|
|                                             [Bring the pallet]|
|                                             [TRIAL ▮▮▮▯ 18/25]|
|                      (game)                                   |
| [Comforts]                                                    |
| [Padding ▮▮▮ ▮▮▯ ▯▯▯]                                         |
| [Health ▬▬▬▬▬▬▬▬▬▬]                        [Weapon (cond.)] |
| [SCRAP] [Noise] [Parts] [⚡fuel]  [Trick ◉] [Biscuit ▬▬]       |
+---------------------------------------------------------------+
```
| Element | Detail |
|---|---|
| Weather icon | In the round plaque |
| Errand tracker | Under the finds, §5.7 |
| Trial | Under the errand |
| Padding + health bar | Above Scrap, §11.3 |
| Trick | Bottom row: icon with a charge ring (stepped, 8 segments) |
| Biscuit | Bottom row: his face icon and HP bar; flashes when down |
| Safe house alert | Red plaque centre-top when under attack, §9.2 |
| Weapon condition | Weapon name colour + a small condition pip; mods listed in a tooltip-like line when switching |
| Green objective arrow | §5.7 |

### 21.2 Tab map additions
Errand markers (green), safe house (with survivor faces), Biscuit, the escape progress (icons for each part, ticked when done), bench locations, the jukebox, and found tapes/bears (ticked).

### 21.3 Audio additions
| Group | Sounds |
|---|---|
| Radio | Walkie-talkie squelch, static, Hilltop voice (as **typed text** with a radio blip per word: no voice acting), the Signal's voice (different blip) |
| Errands | Accept sting, step done, errand complete fanfare (short), failure sting |
| Escape | Engine cough, engine start, siren, the escape theme (a fast full-band version of the town theme) |
| Survivors | Text barks + a soft blip; the "survivor turned" sting |
| Biscuit | Bark, growl, bite, whimper, happy yip on revive |
| Padding | Hit-on-padding (dull thump, different from flesh), layer break (rip), repair (tape) |
| Tricks | One per Trick + "ready" chime |
| Weather | Rain loop, thunder (3 variants), wind loop |
| Enemies | Screamer scream, Hazmat burst, Butcher roar and grab, Raider megaphone (text), gunshots per Raider weapon, engine revs |
| Jukebox | Coin, 4 short tunes, keepsake drop |
| Music | Weather variants (rain: muffled filter; storm: low drones), errand "Hold" layer (urgent percussion while holding) |

---

## 22. Technical changes

### 22.1 New modules
| Module | Responsibility |
|---|---|
| `sim/errands.js` | Errand state machine, step types (§5.3), offering, tracking |
| `data/errands.js` | Errand definitions as data |
| `sim/escape.js` | Escape steps (built on errands), last stand, ending |
| `sim/quest.js` | The Signal |
| `sim/survivors.js` | Survivor roster, safe house, states |
| `sim/companion.js` | Biscuit |
| `sim/padding.js`, `sim/tricks.js`, `sim/condition.js`, `sim/keepsakes.js`, `sim/trials.js`, `sim/weather.js`, `sim/events.js` | Each system |
| `sim/raiders.js` | Raider AI (cover, shooting) |
| `sim/npc.js` | Shared NPC base: follow, flee, cower, HP (used by survivors on escort, Biscuit, Raiders) |

### 22.2 Errands as data
Errands must be **data, not code**. Example:

```js
{
  id: "sealDrain",
  name: "Seal the Drain",
  offer: { source: "board", minRound: 10, requires: ["zone1"] },
  onOffer: [{ effect: "spawnWeight", point: "drain_square", mult: 1.5 }],
  steps: [
    { type: "fetch", item: "pallet", spots: ["yard_a", "yard_b", "yard_c"] },
    { type: "fetch", item: "nails", spots: ["hardware_a", "hardware_b"] },
    { type: "carry", item: "pallet", to: "drain_square" },
    { type: "hold", area: "drain_square", seconds: 20, canAttack: false },
  ],
  rewards: [{ scrap: 1000 }, { closeSpawn: "drain_square" }],
  failure: null,
  timeLimit: null,
  cooldownRounds: 8,
}
```
Step types and effects are a fixed vocabulary implemented once. New errands should need no new code unless they add a new step type.

### 22.3 Map data additions
New object layers in the Tiled map (v1.0 §27.6): `errandSpots` (named candidate spots), `ladders`, `coverPoints` (for Raiders: a position + the direction it protects from), `raiderDrops`, `safeHouse` (area + barricades), `tapes`, `bears`, `eventSpots`, `holdAreas`, `escapeRoute` (the path the fire engine drives).

### 22.4 NPCs and performance
- NPC count budget: up to 4 survivors (static unless escorted or fighting) + Biscuit + up to 14 Raiders. Survivors inside the safe house don't run AI when no enemy is inside (sleep).
- Raiders use the same flow fields toward cover points, plus line-of-sight raycasts against the collision grid (8 directions only, cheap).

### 22.5 Save
Still no mid-run saves. The menu's local record grows: `bestRound`, `escapes`, `bestEscapeRound`, `signalComplete`, `tapesFound` (lore viewer only; no gameplay effect), `lastTrick`.

---

## 23. Tuning tables

All new keys go into `tuning.js` under these groups.

### 23.1 Errands
| Key | Value |
|---|---|
| `errands.radioEvery` | 3 rounds |
| `errands.acceptWindow` | 8 s |
| `errands.boardSlots / boardRefresh` | 2 / 4 rounds |
| `errands.noRepeatRounds` | 8 |
| `carry.speedMult / dropAfterHits` | 0.85 / 3 |
| `hold.leaveGrace` | 15 s |
| `fuse.blowChance` | 0.04 per trap/workshop use |
| Per-errand values | In `data/errands.js` (§6) |

### 23.2 Escape
| Key | Value |
|---|---|
| `escape.unlockRound` | 15 |
| `escape.fitBurst` | 6 walkers per fitting |
| `escape.lastStand` | 90 s (45 s after The Signal) |
| `escape.herdMult / spawnRateMult` | 1.5 / 2.0 |
| `escape.bruteAt` | 45 s |

### 23.3 Survivors and Biscuit
| Key | Value |
|---|---|
| `survivors.max` | 4 |
| `survivor.hp / dmg / attackEvery` | 100 / 20 / 1.5 s (Fighter 200 / 40) |
| `survivor.sickChance / sickFromRound / sickDeathRounds` | 0.125 / 10 / 3 |
| `survivor.healPerRound` | 10 |
| `escort.followDist / cowerCount / cowerRadius` | 16 px / 2 / 24 px |
| `biscuit.hp / hpGrowth / speed` | 200 / +50 per 5 rounds / 120 |
| `biscuit.bite / biteEvery / pinEvery / pinTime` | 60 / 0.8 s / 4 / 1.5 s |
| `biscuit.reviveHold / downedHits` | 2 s / 3 |

### 23.4 Padding, Tricks, condition, keepsakes
| Key | Value |
|---|---|
| `padding.layers / pointsPerLayer / absorb` | 3 / 50 / 0.75 |
| `padding.costs` | 1,500 / 2,500 / 4,000 |
| `padding.partRepair` | 25 per Part |
| `tricks.charge` | Flare 25, Red Mist 30, Smoke 20, Whistle 15, Stand 30 |
| `tricks.trapKillCharge` | 0.5 |
| `condition.damage` | −0.2 / 0 / +0.2 / +0.45 / +0.8 |
| `condition.crateOdds` | 0.15 / 0.45 / 0.25 / 0.12 / 0.03 |
| `condition.partCosts` | 2 / 4 / 8 / 14 |
| `condition.jamChance / jamClear` | 0.05 / 0.6 s |
| `keepsakes.costs / resetEvery / poolSize` | 500, 1,000, 2,000 / 5 rounds / 8 |

### 23.5 Trials, weather, enemies, events
| Key | Value |
|---|---|
| `trials.every / fromRound` | 2 rounds / 4 |
| `weather.fromRound / odds` | 5 / Clear 0.5, Rain 0.22, Storm 0.08, Fog 0.15, Still 0.05 |
| `weather.rainNoise / stillNoise` | 0.6 / 1.5 |
| `screamer.from / share / max / every / extra` | 9 / 0.03 / 2 / 6 s / 4 |
| `hazmat.from / share / cloudDps / healPs` | 11 / 0.05 / 15 / 20 |
| `tangled.from / share` | 6 / 0.06 |
| `butcher.hp / growth / from / every` | 2,500 / 1,500 / 13 / 6–8 |
| `raiders.from / base / growth / cap` | 14 / 6 / 1 / 14 |
| `raider.bulletSpeed` | 260 px/s |
| `events.from / chancePerRound` | 6 / 0.25 |

---

## 24. Debug additions
Extend v1.0 §29:
| Key | Tool |
|---|---|
| Shift+F1 | Show errand state machine and spots |
| Shift+F2 | Offer / complete / fail a chosen errand |
| Shift+F3 | Jump to a chosen escape step / Signal step |
| Shift+F4 | Spawn a survivor of a chosen role / Biscuit |
| Shift+F5 | Force weather |
| Shift+F6 | Force a special round (Raiders, herd, dogs, Butcher) |
| Shift+F7 | Trigger a town event |
| Shift+F8 | Show Raider cover points and line-of-sight |
| Shift+F9 | Give a keepsake / set Trick charge full |

Extend the headless balance sim with a bot that does errands (always accepts, follows the green arrow), and report: escape rate and median escape round over 200 seeds.

---

## 25. Milestones

| Milestone | Content | Exit criteria |
|---|---|---|
| **E0: Foundation** | Any v1.0 [Depth] prerequisites (§2) not yet built; the errand system with all step types; Fuel Run and Blown Fuse moved onto it; errand log, tracker, green arrow | A tester completes a fuel run and a fuse repair without being told how |
| **E1: Goals** (P1) | Errands 6.3–6.12 (minus Lost Dog until E3); survivors and the safe house; escape | Median tester run includes 3+ errands; 30% of good players escape |
| **E2: Depth** (P1) | Padding, Tricks, weapon condition and mods, new walkers, Raider rounds, the Butcher, extended herd and dog rounds | Testers use their Trick at least 5 times per run; Raider rounds feel different from walker rounds |
| **E3: Character** (P2) | Biscuit + Lost Dog; keepsakes; trials; weather; town events | 70% of testers rescue Biscuit; testers name a weather type that changed how they played |
| **E4: Secrets** (P2/P3) | The Signal; the blowtorch; tapes; teddy bears and song | A tester finishes The Signal without help in 3 runs or fewer (with hints only) |
| **E5: Polish** | Art for all new sprites (survivors, Biscuit, Raiders, new walkers, Padding layers, escape scene), audio list, balance with the sim | All acceptance tests pass |

---

## 26. Acceptance tests

**Errands**
- (A) Only one non-Fuel errand is active at a time.
- (A) An errand is never offered when its requirements aren't met.
- (A) A Hold timer pauses when Cain leaves the area and fails after the grace period per the errand's rules.
- (A) Carrying an item: guns can't be fired; 3 hits drop the item at Cain's position.
- (A) Seal the Drain: after completion, `drain_square` never spawns again.
- (A) Every errand in `data/errands.js` can be completed by the errand bot within 6 rounds on 20 seeds.

**Escape**
- (A) Steps 1–4 can be done in any order; step 5 is impossible until all four are done.
- (A) After step 6, the round counter stops and the last stand runs for exactly the tuned time.
- (A) Completing the escape writes `escapes += 1` and shows the escape screen.

**Survivors and Biscuit**
- (A) A survivor killed inside the safe house rises as a walker within 2 s.
- (A) The Mechanic's presence makes the generator last 10 rounds.
- (A) Biscuit doesn't take damage from Cain's melee or bullets.
- (A) Biscuit's kills give Cain 25 Scrap.

**Systems**
- (A) Padding absorbs 75% of damage until the layer is empty, then the next layer.
- (A) Trick charge only increases on kills; trap kills count half.
- (A) Crate condition rolls match the odds within ±1.5% over 10,000 pulls.
- (A) Rain multiplies all noise radii by 0.6.
- (A) The Screamer's scream adds exactly 4 enemies beyond the round count, and only if not interrupted.
- (A) Raider bullets are blocked by cover tiles.
- (A) Killing the Raider Captain makes all other Raiders flee within 1 s.

**Quest**
- (A) Each Signal step's items only spawn after the previous step is done.
- (A) A wrong code at step 6 spawns a Brute and allows another attempt next round.

**Performance**
- (M) 14 Raiders + 4 survivors + Biscuit + storm weather + 24 walkers left over: ≥ 58 fps on the reference laptop.

---

## 27. Still out of scope
- Co-op, online, leaderboards
- Unlocks between runs, prestige, daily challenges, meta-currency
- More maps
- Mouse aim, gamepad
- Reading the player's Enoch save
- Voice acting (all dialogue is typed text with blips)

---

## 28. Open questions

| # | Question | Default |
|---|---|---|
| 1 | Should a successful escape unlock anything (cosmetic, a second character)? | No, by the "no meta" rule. Revisit for v1.2. |
| 2 | Is Hilltop (the radio voice) a named character from Enoch (e.g. someone at the RV)? | Unnamed in v1.1 |
| 3 | Can survivors ever leave the safe house to fight beside Cain? | No (performance and focus). The Toy Soldier keepsake gives a taste. |
| 4 | Do Raiders belong in this game, or is "only the dead" purer? | In, as TWD's signature threat |
| 5 | Should the escape be available at a fixed round (15) or after The Signal only? | Round 15 |
| 6 | Pick-a-Trick at the start: is the pre-round menu too much friction? | Keep it, remember the last choice |

---

## 29. Appendix: CoD source for each feature

| Enoch Nights v1.1 | CoD Zombies source |
|---|---|
| Errands (fetch, carry, hold, escort, repair, hunt) | Power-up steps (Kino, Der Riese), buildable fetching (Tranzit, Origins), Easter-egg steps, Cold War **Outbreak** objectives (Retrieve, Defend, Escort, Holdout) |
| Fuel Run, Blown Fuse | Turning on the power; Tranzit's power and turbine management |
| Supply Drop | Outbreak "Retrieve" / airdrop objectives, Black Ops 4 supply drops |
| Seal the Drain | Origins generators being reclaimed; Cold War "close the portal" ideas |
| Light the Beacons | Mob of the Dead / Origins multi-point activation steps |
| Escape | Cold War **exfil**; Mob of the Dead's escape ending (the plane) |
| The Signal | Main Easter eggs (Moon, Origins, Der Eisendrache) |
| Survivors | (TWD) — closest: the Cold War "requisition" NPCs and Mob of the Dead's crew |
| Biscuit | Hellhound allies; the Origins robot; companion ideas |
| Padding | Cold War armour plates |
| Tricks | Cold War field upgrades |
| Weapon condition | Cold War weapon rarity + salvage |
| Keepsakes | Gobblegums |
| Noticeboard trials | Cold War trials machine |
| Weather | Origins rain, Tranzit fog |
| Screamer | Shi No Numa / spawning enemies |
| Hazmat | Black Ops 3 spiders and gas zombies (Nova crawlers' gas) |
| The Butcher | Mangler / Margwa-style mini-bosses |
| Raider rounds | Special rounds (hellhounds, Nova crawlers); Infinite Warfare and BO4 human bosses; TWD's Saviors |
| Town events | Dynamic map events (Tranzit's lava, Buried's events) |
| The blowtorch | Quest wonder weapons (Origins staffs, Blundergat from Mob of the Dead) |
| Tapes | Radios (all maps) |
| Teddy bears and the secret song | Secret songs (Lullaby for a Dead Man, 115) |
