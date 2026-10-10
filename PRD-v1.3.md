# Enoch Nights: v1.3 PRD (small feedback pass)

| | |
|---|---|
| **Version** | 1.3 |
| **Date** | 2026-10-09 |
| **Builds on** | `PRD.md`, `ENHANCEMENT-PRD.md`, `PRD-v1.2.md` |
| **Status** | C1 to C5 built. |

## Analysis

| Feedback | What the code did | Decision |
|---|---|---|
| Enochpedia lacks detail on long objectives (the school roof hold) and on *why* you're doing any of it | The Signal quest was only listed under "Secrets" in one line. The school-roof hold (120 s, raiders every 40 s) was never documented. Nothing said who you are or what you're fighting for. | New **Story** tab: who Cain is, Hilltop, what the radio voices are, the two ways a run can end (the Signal, the fire engine). New **Objectives** section with every multi-step job, its steps, and what attacks you while you do it. |
| Info on healing survivors | One sentence buried in the Survivors tab. | Own "Healing survivors" section with every source. |
| Main character should be Cain | Already Cain in code (death epitaph, escape screen, Signal ending), but never stated to the player. | Say so on the Story tab and the Basics tab. No code rename needed. |
| Padding repair costs Parts, so armour drains Parts | "Patch padding" at the fire station cost 1 Part per 25 points. Things bought with Parts (condition, mods, Trick upgrade, booster) are never lost, so repairs are the only recurring Parts sink and it's the wrong currency. | Patch padding costs **Scrap** (`T.padding.scrapRepair`, 250 per 25 points). Parts stay for permanent builds only. |
| Power attack | Shove ran on a 2.5 s cooldown; holding attack with a melee weapon auto-repeated swings. | Add a **stamina** meter that shove and the power attack share. See C5. |

## C1. Story tab (Enochpedia)
You are **Cain**, who leads Enoch, the camp on the hill above town. Hilltop is Enoch on the radio. Each night Cain comes down to hold the town: its generator, its stores, the people still hiding there. The aim is to get help: either answer the Signal and reach Ashworth (a town with power and a hospital), or get the last fire engine running and drive out. Or just see how many nights you last.

## C2. Objectives section
A table of long jobs: The Signal (all 7 steps), the school-roof hold (120 s inside 80 px of the mast; 4 raiders from the nearest drop points every 40 s), the fire engine and its last stand, the Fuel Run. Each row: steps, what comes for you, how long, the reward.

## C3. Healing survivors
Every night: `T.survivors.healPerRound` HP (`T.heal.medicPerRound` with a Medic). At once: spend a Bandages use while talking to them (`T.heal.bandage`). Sick survivors: Medicine Run. Biscuit: heals in the break, the dog tin keepsake.

## C4. Padding repairs cost Scrap
`Patch padding` costs `T.padding.scrapRepair` Scrap (no Parts). Enochpedia updated.

## C5. Power attack and stamina
- **Stamina** (0 to 1) regenerates at `T.stamina.regen`/s. Shove costs `T.shove.stamina` (0.6, regen 0.25/s, so a shove every 2.4 s, close to the old cooldown). The HUD bar under the weapon panel is now the stamina bar: green when a shove is affordable, gold while charging.
- **Melee: tap** swings. **Hold** attack for `T.power.holdDelay` s (after any swing in progress) and Cain starts charging, as long as he has `T.power.minStamina`. Charging drains stamina, slows him to half speed and draws a growing ring.
- **Release** (or run out of stamina) to spin: a 360° hit with reach + `T.power.reachAdd`, damage x0.8 to x1.6 and knockback 30 to 64 px depending on charge, stagger on everything hit (so follow-ups crit). Brutes and the Butcher are interrupted as by a shove rather than knocked back. Costs 1 durability if anything was hit. Brief recovery after.
- Behaviour change: holding attack with a melee weapon no longer auto-repeats swings (it charges instead). Guns are unchanged.

## C6. Autosave every wave
At each `roundStart` the run is saved to its own slot (`enochNights.v1.auto`), separate from the manual pause-menu save. Death clears the manual save but keeps the autosave, so the death screen offers **Retry wave N** (the default choice). The main menu's Continue loads whichever save is newer. Starting a new run or escaping clears both.

## C7. "Night" is now "Wave"
Rounds start on their own and there's no daytime, so "night" was misleading. Every player-facing "night" now says "wave" (HUD, banners, menus, Enochpedia, errands). Kept: the game title *Enoch Nights*, "Bonfire Night", run-log field names (`k: 'night'`) and code identifiers. The radio lore says "after dark".

## C8. Last Night in Zion (title, setting, premise)
- **Title:** *Last Night in Zion*, a prequel to *Project Enoch*. Changed: page title, main menu, credits, package and server text. Kept: the save keys (`enochNights.v1*`), so existing saves and settings survive. The Enochpedia is now the **Zionpedia** in the menus (the file is still `enochpedia.js`).
- **The town is Zion.** Every player-facing "Enoch" for the town now says Zion: the map title, the school (ZION PRIMARY), banners, radio lore, the Signal ending, the fire engine and the death screen ("You held Zion for 6 waves").
- **Premise** (Story tab, plus a Hilltop radio line as wave 1 starts): Cain and his partner lived in Zion for a year in silence, as in *A Quiet Place*. Tonight the partner shot themself. The shot woke the city, and every noise since brings more of the dead, so it can't be stopped. This is Cain's last night. "Waves" are the surges within that one night.
- **Hilltop** is now someone on the ridge with binoculars and a handheld radio, not the Enoch camp, which doesn't exist yet.
- **Escape screen:** "Cain made it out of Zion. Somewhere past the hills, he would try to start again. That is *Project Enoch*."
- `WORLD.md` still describes the older Enoch-camp framing. Update it when the art pass starts.

---

# Part D: art bible

Moved to **`ART-PRD.md`**, which is the standalone spec for the pixel-art detail pass.
