# Enoch Nights: v1.2 PRD (playtest feedback)

| | |
|---|---|
| **Version** | 1.2 |
| **Date** | 2026-10-09 |
| **Builds on** | `PRD.md` (v1.0) and `ENHANCEMENT-PRD.md` (v1.1). Both still apply unless this document says otherwise. |
| **Source** | Two rounds of playtest feedback. One run reached night 15. |
| **Status** | Part A (A1 to A10) and Part B (B1 to B25) are built. |

---

## Part A: built in this pass

### A1. Run logging
Each run streams to `logs/<UTC date>-s<seed>.jsonl` while the game is served by `npm start`. The client is `src/runlog.js` and the server endpoint is `POST /log` in `server.js`. One JSON object is written per line:

| `k` | When | Contents |
|---|---|---|
| `start` | Run starts or a save is continued | Seed, settings, user agent |
| `ev` | Every notable event | Banners, downs, errands, doors, comforts, raids, specials, hatch use, door bolting, survivors. Each special-enemy kill records the weapon and its tier. Every hit of 30+ damage records its source. |
| `snap` | Every 5 s of game time | Enemies alive by type, enemies left to spawn, player position, zone, HP, padding, Second Wind, weapons with ammo, comforts, scrap, parts, bank, power, noise, streak, every barricade's planks, Red Lion door and windows, survivors, Biscuit, errand steps, Screamer summons, FPS |
| `night` | End of each night | Kills by enemy type and by weapon+tier, gun/melee/trap split, damage taken by source, scrap earned and spent, peak alive, Screamer summons |
| `end` | Death or escape | Cause, night, final stats |

Chatty events (shots, hits, scrap pops) are counted per night, not written one by one. Run `node scripts/runlog-report.js [file]` to get one row per night plus a timeline of notable events. With no argument it reads the newest log. Kill events now carry `enemy` (the enemy type was being overwritten by the event name). That bug also meant every corpse was drawn as a generic one. Both are fixed.

### A2. Going down keeps your comforts
Second Wind and Bandages no longer strip comforts, the Mule's third gun or max HP. The only loss is Bandages itself once its last use is spent. You still lose 10% of your Scrap and drop to the pistol while downed.

### A3. Second Wind is explained
- The prompt now says "Not a comfort: uses no slot".
- On night 3, if you don't own it, a radio line explains where Second Wind is sold and that it takes no comfort slot. Radio lines stay in the log.

### A4. Upgraded guns beat melee for crowds
| Tier | v1.1 damage | v1.2 damage | Pierce | Kill Scrap |
|---|---|---|---|---|
| 0 | x1 | x1 | base | 50 |
| 1 | x2 | x2 | base | 90 |
| 2 | x3 | x3.5 | +1 | 130 |
| 3 | x3.75 | **x5.6** | **+2** | **170** |

A headshot adds the old head bonus (+50) on top. A tier-3 Army Rifle now pierces 4 walkers at about 730 damage each. A tier-3 bat does 330 to 4 targets. The settings are in `T.gunTier`.

### A5. Screamer summons are capped (the night-9 flood)
Before v1.2, each Screamer summoned 4 walkers every 6 s, with no limit until 90 enemies were alive. The summons also counted toward the night's total, so the night never ended. That matches the night-9 report. Now:
- Each night allows at most **12 summons**, shared by all Screamers (`T.screamer.budget`).
- No summon happens while the alive count is above the night's active cap + 8.
- Summoned walkers are extras. They pay normal kill Scrap but don't hold the night open.

### A6. The Red Lion is a real safehouse
- **The door can be bolted** from inside or outside: hold the interact key at the door. While it's bolted, nothing can path through it, including Raiders and looters.
- **Getting in means tearing a window down.** Window planks take 3x as long to tear while the door is bolted. Brutes can't one-shot a bolted pub's windows. Raiders must stand at a window and pull planks (4 s each) before they can climb in. They can only take from the bar after they are inside.
- **Resting:** while you're inside, the door is bolted, every window has a plank and nothing is in there with you, you heal twice as fast after 1 s.
- If you're bolted in, walkers stop milling at the walls and go for the windows. You can hear and fight them there.
- Bolting the door makes the windows live barricades, even before any survivor moves in.

### A7. Cellar hatches (9)
Each zone has one trapdoor. The Red Lion's is inside, by the kitchen, so you can leave a besieged pub without using the door. Hold the interact key to drop through. Q/E picks which open zone you come out in. You get 1.5 s of invulnerability on arrival, and there's a 3 s cooldown. You can't use a hatch while carrying a jerry can or a heavy item. Hatches blink gold when you're near one. They sit in the Red Lion cellar, town square, post office, fire station, garage, St Mary's, school field, builders' yard and Hunt & Tackle. The settings are in `T.hatch` and the code is in `src/sim/safehouse.js`.

### A8. Art pass on vehicles
New art for the cars (wheel arches, bumpers, head and tail lights, window pillars and glare, door seams, rust, some cracked windscreens), the digger (tracked, framed cab, boom, dipper, toothed bucket), the tow truck (boom and hook, amber beacons) and the fire engine. The fire engine had no art at all before. Armed car alarms now blink a red dashboard LED.

### A9. Parts: earn more, spend less
In the night-15 run Parts never kept up with demand. The fix is more sources and fewer, cheaper uses:
- **Every finished errand now pays +2 Parts** (`T.parts.errand`), on top of its normal reward. Errands are the main way to earn Parts.
- **Barricade reinforcement costs Scrap instead of Parts** (this was B15): steel bars 750, sheet metal 1,500.
- **Weapon condition costs are halved**: 1 / 2 / 4 / 7 Parts (was 2 / 4 / 8 / 14).
- **The Blowtorch costs 3 Parts to build** (was 5).
- Parts are now spent only on condition, padding patches, the signal booster and the Blowtorch.
- The Enochpedia and the HUD tooltip now list where Parts come from.
- *Check with logs:* compare Parts earned and spent per night. The `night` rows carry `parts`. Aim for one condition step every 2 nights from night 6.

### A10. Red Lion shutters
The Red Lion's windows take their own reinforcement, separate from the town barricades. It costs more but is far stronger:

| | Scrap | Tear time per plank | Bolted door (x3) | Notes |
|---|---|---|---|---|
| Plain plank | free | 1 s | 3 s | |
| Town steel bars / sheet | 750 / 1,500 | 2 s / 3 s | n/a | Sheet hurts for 10 |
| **Oak shutter** | **1,250** | **5 s** | **15 s** | A Brute can't smash it |
| **Steel shutter** | **2,500** | **9 s** | **27 s** | Tearing hurts for 25. A Brute can't smash it |

A steel-shuttered window with all 6 planks holds one walker for 54 s, or 2:42 with the door bolted (oak: 30 s, or 1:30 bolted). Shutters have their own art: a dark oak frame with a diagonal brace, or riveted steel. Town bars and sheet metal now show on their barricades too; before, they were invisible. The settings are in `T.pubReinforce`.

---

## Part B: to build next (ordered by impact)

### P0: fairness bugs and frustrations

**B1. No hits across a barricade.** At present a walker outside can swipe you through a barricade with 3 or fewer planks (`T.barricade.swipeAt`) while you repair it. Change: an *outside* walker can't damage the player while its barricade has ≥1 plank. Walkers already inside still hit you normally. This applies to safehouse windows too.

**B2. Raiders and looters never take things off your body.** Looters lock a comfort *machine*, and Raiders take from the bar *stash*. Neither should ever remove a comfort you own. The "lost my running shoes" report was the v1.1 rule that going down cleared your comforts, which A2 fixed. Also:
- Change the banner to "LOOTERS JAMMED THE SHOE MACHINE: can't buy it for 2 nights".
- Show a raid HUD counter: "RAIDERS 6/9 · kill the Captain and they run". It clears with a banner when the raid ends.

**B3. Targets that are downed are ignored.** Walkers pick the nearest *standing* target. A downed Biscuit or survivor is a target only if nothing else is within 160 px.

**B4. Seal the Drain can't fail.** Remove the timer. Show a ring of `T.holdArea.radius` around the drain. It pulses with a hammer *tock* and a progress arc while you're inside and nailing. Leaving the ring pauses progress instead of failing.

**B5. Q/E only cycle options.** Weapon switching moves to the number keys and the mouse wheel. Q/E cycle interaction options only. Remove the prev/next weapon bindings from Q/E and update the remap screen.

**B6. No accidental weapon swaps.** Taking a weapon from the ground that would replace an upgraded (tier ≥1) or better-condition weapon needs a 1.0 s hold. The prompt turns amber: "Replaces your Mabel (Tier 3)". It's still a 0.15 s hold when the slot is empty or the old weapon is worse.

**B7. Explosive and fire kill credit.** A kill counts for "kill with explosives or fire" if the enemy took damage from fire, burning, a molotov, a barrel, a pipe bomb or dynamite in the 10 s before it died. Store `e.lastFireT` in `damageEnemy` and check it in `trialKill` and `errandKill`.

### P1: readability

**B8. Messages last longer, and a notification tray.**
- Banners stay at least 4 s, plus 0.06 s per character. Tutorial and help banners (dog commands, jukebox, teddies) stay 8 s.
- Every banner, radio line and tip is also written to a notification list.
- The pause screen gets a right-hand tray with the newest at the top. It scrolls, and each entry shows its night.

**B9. Errand cards never truncate.** Remove the "..." ellipsis. Let the text wrap to 2 lines and make the card taller. Rewrite errand descriptions to 50 characters or fewer, for example "Find the sluice wheel in the allotment shed."

**B10. The map names places.** On the full map, draw each building's name and the zone name. Give each icon type its own glyph so the Red Lion and Hot Stew no longer share one. Show the cellar hatches, the bolted or unbolted state of the Red Lion door, and a "you are here" marker.

**B11. Rename the Errand Log to *Journal*.** It gets 4 tabs:
1. **Errands** (active and offered)
2. **Items**: everything in your pocket and what it's for. For example: "Fuse, from the fire engine: fits the generator box after it blows". "Charcoal, from the barbecue: ...".
3. **Notes**: the notification tray.
4. **How to**: healing, the dog, the safehouse, hatches, comforts vs Second Wind.

**B12. Healing survivors and the dog is explained.** When a rescued survivor or Biscuit is hurt, their prompt says how to heal them. Survivors heal 10 HP each night, and a Medic heals faster. Bandages on a survivor heal 50. Biscuit is revived by holding the interact key on him and heals over the break, or with the dog tin. Add these to the How to tab.

**B13. Roof interaction spots are marked.** The ladders at the school, church and fire station get a pulsing gold arrow and a ground marker once their errand step is live. The marker shows on the minimap too.

### P2: economy and balance

**B14. Traps pay a bonus, not a discount.** Trap kills pay 160 Scrap, the melee-crit rate. Currently they pay 0.75x melee. Remove `trapScrapMult` and use `T.scrap.killTrap = 160`.

**B15. ~~Reinforcing barricades costs Scrap.~~** Built in A9.

**B16. One bench for each Parts upgrade.** With fewer Parts uses after A9, this is a smaller change. The garage bench takes weapon Parts upgrades (condition, mods). The fire-station bench takes padding and armour. The yard bench does tricks only. Each bench's prompt lists only what it does.

**B17. More throwables.** Raise the carry limits: bricks 4, molotov 4, pipe bomb 5, noise alarm 3.

**B18. Melee vs guns.** A4 boosts guns. Also, melee kills from night 12 onward pay 110, not 130, so that guns at tier 2 and above pay best for crowd work. Check this with the logs before shipping.

**B19. Searchlight rework.** For 20 s it blinds walkers in its cone, which then drop their target and wander, and it marks specials through walls. It can be triggered from the switchboard (B21). It costs 500 Scrap a use, instead of an errand.

**B20. God mode in Settings.** A checkbox for unlimited Scrap: the HUD shows ∞ and buying doesn't subtract. Runs with it on are flagged in the log and on the game-over screen, and don't count for best-night records.

### P3: new systems

**B21. The switchboard (wiring errand).**
- *Errand "Wire the Town"*, from night 6: carry a cable drum from the hardware shop to each trap and hold the interact key for 3 s at its junction box. Each trap wired is one step.
- *Switchboard* in the Red Lion: an interactable panel opens a minimal top-down map. It shows only the zone outlines, traps, the church bell, the searchlight and the car alarm. Each has an ARMED/OFF toggle and a live status dot.
- Bell, searchlight and alarm can be fired from it. Each costs its normal price.

**B22. Traps arm, then fire when it's worth it.**
- An armed trap waits until at least N enemies are in its area. N = 4, or 1 for a special.
- Traps resolve even when off-screen: kills, Scrap and a sound cue at reduced volume, plus a notification ("Fence trap: 7 kills, +1,120 Scrap").
- When you get close, a small effect plays (sparks, dust or smoke). Without power, armed traps go idle.

**B23. Car alarm every night.** One alarm car in the pub car park (bottom left) is re-armed each night and shows the red LED (built in A8). The other alarm cars stay one use each.

**B24. Red Lion under attack: a fairer defence.** The shutters (A10) cover part of this.
- The "Red Lion under attack" event only starts while the door is bolted or the player is within 2 zones.
- Its warning comes 20 s ahead.
- Survivors at home fight at 2x damage and 2x HP while inside a bolted pub.
- Reinforcements on the pub windows count double.
- A cellar hatch is always open in zone 5 so you can get there fast.

**B25. Clear Raider rounds.** The radio gives the start and end. The HUD shows the counter from B2. Raiders target the player first and the bar only when the player is more than 300 px away, and they must breach the windows (A6).

---

## Acceptance checks (tests to add with Part B)
- An outside walker at a barricade with ≥1 plank does 0 damage to the player (B1).
- A walker burned, then killed by melee, counts for the fire/explosive objective (B7).
- Seal the Drain has no deadline, and leaving the ring pauses it (B4).
- Q/E never changes the weapon slot (B5).
- An interact hold can't swap out a tier-3 weapon in under 1 s (B6).
- A trap kill pays more than a melee kill (B14).
- Per-night logs show Parts earned ≥ Parts spent on average from night 6 (A9).
- A trap with fewer than N enemies in its area doesn't fire (B22).

## Notes for playtest feedback
After a run, say roughly which night something happened. The log file name includes the date and seed, and `node scripts/runlog-report.js` shows each night side by side.
