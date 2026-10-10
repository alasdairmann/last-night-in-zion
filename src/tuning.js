// Every gameplay number (PRD §28). No magic numbers elsewhere in the simulation.
function deepFreeze(o) { Object.values(o).forEach((v) => { if (v && typeof v === 'object') deepFreeze(v); }); return Object.freeze(o); }

export const T = deepFreeze({
  tile: 16,
  dt: 1 / 60,
  view: { w: 480, h: 270 },

  player: {
    hp: 100, regenDelay: 4.0, regenDelayBandages: 2.0, regenRate: 25,
    speed: 88, strafeMult: 0.75, surroundedSlow: 0.6, iframes: 0.35, turnTapMs: 80, radius: 5,
    lowHealth: 0.34, interactRange: 22, doorRange: 26, busyMoveMult: 0.5,
    footR: 4, cornerSlide: 6, softSlow: 0.9, // v1.4 C1: collision is the feet only; slide round corners; bins and benches slow you 10%
  },
  stamina: { regen: 0.25 },
  // v1.4 D1/D2: hold to charge, it holds at full (or where stamina runs out), release fires. Damage and knockback scale with charge c (0..1)
  power: { holdDelay: 0.3, chargeTime: 0.7, drain: 1.0, minStamina: 0.25, reserve: 0.04, holdDrain: 0.12, reachAdd: 8, stagger: 0.8, moveMult: 0.5, recover: 0.3,
    dmg: [[0, 0.25], [0.2, 0.4], [0.5, 0.7], [1, 1.5]], kb: [[0, 10], [0.2, 20], [0.5, 40], [1, 80]] },
  shove: { stamina: 0.6, cooldown: 2.5, reach: 18, arc: 90, knockback: 30, stagger: 0.6, dashTime: 0.3, dashSpeed: 210 },
  swap: { melee: 0.25, gun: 0.4 },
  buffer: 0.12,

  scrap: {
    start: 500, hit: 10, killGun: 50, killHead: 100, killMelee: 130, killCrit: 160, killThrow: 50,
    plank: 10, plankCapPerRound: 500, killTrap: 160, killMeleeLate: 110, meleeLateFrom: 12, // v1.2 B14, B18 dog: 50, brute: 500, looter: 250,
  },
  streak: { window: 2.0, stepKills: 10, stepBonus: 0.1, max: 0.5 },
  downed: { scrapLoss: 0.10, time: 6, crawlSpeed: 25, invuln: 2, shockRadius: 40, lastChanceAmmo: 12 },

  prices: {
    rackRebuyMult: 0.5, upgradedAmmo: 4500, ammoCrate: 1500,
    crate: { base: 950, step: 50, max: 1450, sale: 10 },
    workshop: [5000, 7500, 10000],
    secondWind: [1500, 3000, 4500],
  },
  hold: { buy: 0.3, door: 0.5, comfort: 0.8, crate: 0.4, take: 0.15, trap: 0.5, generator: 1.5, repair: 0.45, workshop: 0.4 },

  round: {
    break: 10, firstDelay: 4, countCap: 160, activeCapMax: 24,
    count: (r) => Math.min(160, Math.round(6 + 2.5 * (r - 1) + 0.09 * r * r)),
    activeCap: (r) => Math.min(24, 6 + r),
    spawnInterval: (r) => Math.max(0.4, 2.0 - 0.08 * (r - 1)),
  },
  walker: {
    hp: (r) => { let h = 150 + 100 * (Math.min(r, 9) - 1); for (let i = 10; i <= r; i++) h *= 1.1; return Math.round(h); },
    damage: 34, attackWindup: 0.5, attackCooldown: 0.6, reach: 8, hitReach: 13, radius: 5,
    speeds: [30, 45, 60], groan: [3, 8],
  },
  types: {
    crawler: { from: 3, share: 0.10, hpMult: 0.6, speed: 20, climbMult: 2 },
    bloater: { from: 7, share: 0.06, hpMult: 2.5, speed: 25, gasTime: 2, gasDps: 20, gasRadius: 22 },
    armoured: { from: 10, share: 0.08, hpMult: 1.5, armour: 200, frontReduce: 0.75 },
    runner: { from: 12, share: 0.05, shareMax: 0.25, shareMaxRound: 25, hpMult: 0.8, speed: 110 },
  },
  dog: { hp: 70, hpMult: 1.2, speed: 140, damage: 25, windup: 0.25, first: [5, 7], every: [4, 6], count: 6, step: 2, cap: 24, warn: 1.5, minDist: 80, maxDist: 160, mixFrom: 15 },
  brute: { hp: 3000, hpStep: 2000, first: 9, every: [4, 5], warn: 8, speed: 45, chargeEvery: 8, chargeWarn: 0.6, chargeTime: 1.0, chargeSpeed: 160, stun: 0.8, stunGasmask: 0.2, chargeDamage: 60, swipeDamage: 50, shoveStun: 1.5, frontReduce: 0.75, radius: 8 },
  // v1.4 E6: he loots town caches, never you. ~90% of Cain's speed, stops 2 s at each of 2-3 caches; hurt once, he drops half his haul
  looter: { hp: 400, speed: 79, from: 6, every: 3, chance: 0.25, startHaul: 300, cacheScrap: 250, grab: 2, caches: [2, 3], spotR: 200, passBy: 64 },
  lastEnemy: { outlineAt: 3, speedUpAfter: 20 },
  barricade: { planks: 6, tearTime: 1.0, repairTime: 0.45, climbTime: 0.8, grace: 0.2, swipeAt: 3 },

  finds: {
    chance: 0.02, maxPerRound: 4, pityKills: 50, lifetime: 26, blinkSlow: 20, blinkFast: 23,
    timed: 30, guts: 20, rottenFrom: 15, rottenChance: 0.10, dynamiteDelay: 1.0, dynamiteScrap: 400,
    dynamiteBrute: 2000, wallet: 500, toolboxScrap: 200, chainsawDps: 600, chainsawReach: 22, chainsawArc: 100,
    adrenalineSpecialMult: 4, pickupRange: 11, rushCount: 10, baitTime: 10,
  },
  comforts: { cap: 4, capRaised: 5, bandagesUses: 3, ripenRounds: 5, drinkTime: 1.0 },
  workshop: { workTime: 4, waitTime: 15, maxTier: 3 },
  crate: { cycleTime: 4, waitTime: 12, moveTime: 6, movePulls: [4, 10], nailPity: 8 },

  noise: {
    radius: { quiet: 48, medium: 140, loud: 260, vloud: 400 },
    add: { quiet: 0, medium: 2, loud: 4, vloud: 7, explosion: 10 },
    decay: 8, decayDelay: 1.5, t1: 50, t1Mult: 0.8, t2: 80, t2Cap: 4, t2Bias: 0.8, attractTime: 4,
  },
  explosive: { barrel: { dmg: 300, radius: 48, fuse: 1.0 }, selfDamageMult: 0.5, crawlerChance: 0.25 },
  throwables: { range: 80, flightTime: 0.45 },
  fire: { dps: 40, burnTime: 4 },
  traps: { playerDps: 50, fenceSpecialDmg: 400, armN: 4, armSpecial: 1, noteVol: 0.35 }, // v1.2 B22: armed traps wait for a crowd
  generator: { startHold: 1.5, fuelRounds: 8, refuelHold: 1.0, jerryCost: 500, jerrySlow: 0.85 },
  bank: { interest: 0.05, fee: 0.10, unit: 1000, repeat: 0.35 }, // v1.5 B1: s per 1,000 while you hold
  loan: { amount: 1000, repay: 1500, threshold: 500 },
  bounty: { from: 8, chance: 0.30, scrap: 400 },
  director: { highPressure: 8, highTime: 6, delay: 1, delayCount: 3, lowPressure: 1, lowTime: 15 },
  specials: { fogChance: 0.15, fogFrom: 8, fogSlow: 0.9, herdEvery: 10, herdMult: 1.3, herdBonus: 1500, herdAggro: 80 }, // v1.4 E7: kill the whole herd for a bonus
  fx: { hitStop: 0.04, hitStopKill: 0.06, corpseLife: 8, corpseCap: 60, decalCap: 200 },
  camera: { lookAhead: 24, lerp: 0.12 },

  // ---------------- v1.1 (ENHANCEMENT-PRD §23) ----------------
  // barricades pay more and slam the walker tearing at them (v1.2 B14: traps now pay T.scrap.killTrap)
  barricadeSlam: { stagger: 0.8, scrap: 10, reach: 20 },
  chainsaw: { hpMult: 3, minDps: 900, reach: 28, arc: 150 },
  parts: { brute: 2, looter: 1, dogRound: 1, partSpots: 3, max: 99, errand: 2 }, // v1.2: every finished errand pays Parts
  reinforce: { bars: { scrap: 450, tear: 2.0 }, sheet: { scrap: 900, tear: 3.0, dmg: 10 } }, // v1.2: Scrap, not Parts. v1.4 F2: 40% cheaper (750 / 1,500 before)
  // v1.2: the Red Lion's windows take their own, much heavier shutters (and a Brute can't smash them in one go)
  pubReinforce: { oak: { scrap: 750, tear: 5.0 }, steel: { scrap: 1500, tear: 9.0, dmg: 25 } }, // v1.4 F2: 40% cheaper (1,250 / 2,500 before)

  errands: { radioEvery: 3, firstStepWaves: 2, boardSlots: 2, boardRefresh: 4, noRepeatRounds: 8, worldFrom: 4 }, // v1.4 E1: radio jobs auto-accept; fail if the first step isn't done within 2 waves
  carry: { speedMult: 0.85, heavyMult: 0.7, dropAfterHits: 3 },
  holdArea: { leaveGrace: 15, radius: 56 },
  fuse: { blowChance: 0.04 },
  jerryBlast: { dmg: 300, radius: 48 },

  escape: { unlockRound: 15, fitBurst: 6, lastStand: 90, lastStandSignal: 45, herdMult: 1.5, spawnRateMult: 2.0, bruteAt: 45, fitHold: 3, chiefHp: 6, driveTime: 7, finalHold: 1.2 },

  survivors: { max: 6, hp: 100, dmg: 20, attackEvery: 1.5, fighterHp: 200, fighterDmg: 40, sickChance: 0.125, sickFromRound: 10, sickDeathRounds: 3, healPerRound: 10, riseDelay: 1.5, raidChance: 0.03, raidChanceFar: 0.05, raidFarDist: 220 },
  escort: { followDist: 16, cowerCount: 2, cowerRadius: 24, hp: 150, speed: 70 },
  // v1.4 G: Biscuit is control, not damage. Trip (walker to crawler), pin (2 s, your hits crit), bark (knockback + stagger); keeps himself alive
  biscuit: { hp: 300, hpGrowth: 75, speed: 120, bite: 3, biteEvery: 0.8, pinEvery: 2, pinTime: 2, tripChance: 0.25, barkEvery: 5, barkKnock: 24, barkStagger: 0.6, barkR: 36, barkTrigger: 28, wary: 0.3, flee: 0.15, recover: 0.5, reviveHold: 1.5, downedHits: 6, downGrace: 4, followDist: 24, guardDist: 32, attackRange: 120, stayGuard: 48, barkRange: 160, scrap: 25, stagger: 0.3 },

  padding: { layers: 3, pointsPerLayer: 50, absorb: 0.75, costs: [1500, 2500, 4000], unlockRound2: 6, partRepair: 25, scrapRepair: 250 },
  tricks: { charge: { flare: 25, mist: 30, smoke: 20, whistle: 15, stand: 30 }, trapKillCharge: 0.5, upgradeCost: 5000,
    flare: { radius: 120, blind: 4, light: 8 }, mist: { time: 8, dmg: 2, speed: 0.7, heal: 10 },
    smoke: { radius: 24, time: 6 }, whistle: { dist: 100, radius: 260, time: 5 }, stand: { time: 10, radius: 40, reduce: 0.5 } },
  condition: { damage: [-0.2, 0, 0.2, 0.45, 0.8], dur: [-0.3, 0, 0.3, 0.3, 0], crateOdds: [0.15, 0.45, 0.25, 0.12, 0.03], partCosts: [1, 2, 4, 7], jamChance: 0.05, jamClear: 0.6 },
  keepsakes: { costs: [500, 1000, 2000], resetEvery: 5, poolSize: 8, doubleTap: 0.35 },
  trials: { every: 2, fromRound: 4 },
  weather: { fromRound: 5, odds: [['clear', 0.5], ['rain', 0.22], ['storm', 0.08], ['fog', 0.15], ['still', 0.05]], maxRun: 3, rainNoise: 0.6, stillNoise: 1.5, stillSlow: 0.9, thunderEvery: [15, 25], stormFuse: 0.1 },
  screamer: { from: 9, share: 0.03, max: 2, every: 6, windup: 1.0, extra: 4, keepMin: 100, keepMax: 160, budget: 12, aliveOver: 8 }, // v1.2: summons capped per wave and by how many are alive
  hazmat: { from: 11, share: 0.05, cloudDps: 15, healPs: 20, cloudTime: 3, cloudRadius: 32 },
  tangled: { from: 6, share: 0.06, durMult: 2, thorns: 5 },
  burning: { chance: 0.3, touch: 4, plankEvery: 2 },
  butcher: { hp: 2500, growth: 1500, from: 13, every: [6, 8], grabRange: 20, windup: 0.6, hold: 2, dmg: 40, mash: 8, speed: 42, radius: 8, scrap: 600 },
  raiders: { from: 14, base: 6, growth: 1, cap: 14, bulletSpeed: 260, scrap: 100, captainScrap: 1000, ammoRefill: 0.1, fleeTime: 1, megaphone: 5 },
  dogLeader: { fromRound: 3, hpMult: 2 },
  events: { from: 6, chancePerRound: 0.25 },
  signal: { from: 5, receiverChance: 0.02, receiverBy: 10, towerHold: 5, boostHold: 120, boostParts: 3 },
  blowtorch: { dps: 120, cone: 28, burnDps: 40, burnTime: 4, fuel: 20, dragonDps: 240, dragonCone: 40, buildParts: 3 },
  lore: { songRounds: 1, songMult: 2 },

  // ---------------- v1.2 (PRD-v1.2.md) ----------------
  gunTier: { dmg: [2, 1.75, 1.6], pen: [0, 1, 1], killScrap: [50, 90, 130, 170] }, // upgraded guns out-scale melee for crowds
  pubSafe: { hold: 0.3, fix: 500, fixHold: 1.5, clearR: 96, tearMult: 3, raiderTear: 4, regenDelay: 1.0, regenMult: 2 },
  hatch: { hold: 0.6, cooldown: 3, invuln: 1.5, range: 20, fixPub: 300, fix: 500, fixHold: 1.5, clearR: 96 },
  // ---------- v1.2 Part B ----------
  banners: { min: 4, perChar: 0.06, help: 8, queue: 6 },            // B8
  notes: { max: 200 },
  swapHold: 1.0,                                                      // B6: replacing an upgraded or better weapon
  downedTarget: 160,                                                  // B3
  searchlight: { blindTime: 0.5 },                                    // B19 (cost and duration live on the trap)
  pacing: { gap: 8, slots: [6, 20, 35, 50] },                         // v1.5 P1: s apart, and s into the wave for the 1st/2nd/3rd/4th+ major event
  flareSpawn: { every: 1.2 },                                          // v1.5 Z3: the supply-drop flare tops the dead up this often
  beacons: { payMult: 1.5, parts: 2 },                                 // v1.5 E1: the beacons' reward beats the Scrap the smaller herd costs you
  survivorArrive: { from: 3, every: 3, chance: 0.7 },                   // v1.5 R9: a survivor walks up to the fixed Red Lion door
  truckRoof: { run: 75, range: 150, every: 0.7, dmg: 45, dogAt: 0.5 },   // v1.5 L3/L4: survivors on the engine's roof in the last stand; Biscuit climbs up below half health
  aggro: { dogPath: 12, pubMax: 2 },                                   // v1.5 R1/Z2: the player first; Biscuit only in the way; 2 at the pub at most
  pubDefend: { reach: 24, doorR: 40, dmgMult: 1.5, meleeShare: 0.33 },                  // v1.5 R2: survivors stab through the windows at the dead tearing them
  pubRaid: { warn: 20, hops: 2, survivorMult: 2, reinforceMult: 2 }, // B24
  wire: { hold: 3, from: 6 },                                         // B21
  heal: { medicPerRound: 25, bandage: 50, biscuitBreak: 15 },         // B12

  // ---------------- v1.4 (PRD-v1.4.md) ----------------
  cards: { info: 4, objective: 8, critical: 60, dedupe: 5, max: 3 },  // A1: seconds on screen per priority; critical waits to be resolved
  // E5: Defend the booster. Fixed 18 raiders in 4 groups; next group 10 s after the last dies or 45 s, whichever first
  booster: { hp: 100, dps: 5, groups: [3, 4, 5, 6], afterDead: 10, afterTime: 45, maxAlive: 8, reach: 22, firstDelay: 3, warnEvery: 8 },
  // E4: raiders in the Red Lion take 1 Part (or 15 Scrap) every 8 s each, 5 items at most, and give it all back when killed
  pubTheft: { every: 8, parts: 1, scrap: 15, cap: 5, survivorSlow: 1.5, farDist: 300, stayNear: 220 },
  rewards: { raiderMult: 3, looterMult: 4 },
  mule: { ammoMult: 1.5, comfortSlots: 1, bandageStack: 1 },          // F7: Pack Mule's extra benefits on top of the extra gun slot
  consumables: { bandageStack: 3 },                                    // F6: Bandages have their own slot
  survivorGuns: { range: 140, dmgMult: 0.5, slowMult: 2, minEvery: 0.45 }, // F5: survivors with a stash gun shoot through the windows
  prompt: { glowR: 44, faceDot: 0.35, closeR: 10, reveal: 0.35 },     // B1: glow when near; text only for the faced target; costs show on F
  // I: end-of-run score
  score: { scrap: 1, task: 250, story: 2000, wave: 100, survivor: 300, signalEscape: 2.0, engineEscape: 1.75, death: 1.0 },
  autoBolt: { leave: 24, rearm: 56, approach: 30, clearR: 48 },       // F1: survivors bolt the door behind you and open it when you come back
  pipeBomb: { fuse: 4, lure: 720, beepFast: 0.12, beepSlow: 0.6 },     // D3: a 4 s beeping lure ~1.5 screens wide. Brutes ignore it; rain doesn't stop it
  aimAssist: { raider: { snap: 6, cone: 12 }, zombie: { snap: 2.5, cone: 5 } }, // D6: degrees, guns only
  stuck: { dist: 4, repath: 1.5, nudge: 3, nudgeSpeed: 30, teleport: 6, offscreen: 280 }, // C2
  bus: { w: 5, h: 2 },                                                 // C3: the bus wreck is a hard prop beside a 1.5x breach                           // D7: x a melee walker kill
});
