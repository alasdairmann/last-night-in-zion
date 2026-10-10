// Weapon, comfort, find and crate tables (PRD §9, §14, §15, §16, §17).

// Melee timings are in seconds. cls: light | heavy | thrust (animation class)
export const MELEE = {
  hammer:  { name: 'Claw Hammer',  cost: 0,    dmg: 60,  reach: 16, arc: 70,  wind: 0.08, active: 0.06, rec: 0.22, cleave: 1, kb: 10, stagger: 0.3,  dur: Infinity, cls: 'light',  len: 6,  color: '#9aa3a8', feel: 'blunt' },
  bat:     { name: 'Baseball Bat', cost: 500,  dmg: 110, reach: 20, arc: 100, wind: 0.12, active: 0.08, rec: 0.30, cleave: 3, kb: 22, stagger: 0.5,  dur: 150, cls: 'heavy', len: 10, color: '#c49a62', feel: 'blunt' },
  machete: { name: 'Machete',      cost: 750,  dmg: 150, reach: 20, arc: 90,  wind: 0.07, active: 0.06, rec: 0.20, cleave: 2, kb: 8,  stagger: 0.25, dur: 150, cls: 'light', len: 9,  color: '#d6dadf', feel: 'blade' },
  axe:     { name: 'Fire Axe',     cost: 1250, dmg: 260, reach: 22, arc: 80,  wind: 0.18, active: 0.08, rec: 0.38, cleave: 2, kb: 18, stagger: 0.6,  dur: 120, cls: 'heavy', len: 10, color: '#b5503b', power: true, feel: 'chop' },
  spear:   { name: 'Rebar Spear',  cost: 900,  dmg: 170, reach: 32, arc: 30,  wind: 0.10, active: 0.08, rec: 0.28, cleave: 4, kb: 14, stagger: 0.4,  dur: 120, cls: 'thrust', len: 15, color: '#8f6a3e', feel: 'stab' },
  sledge:  { name: 'Sledgehammer', cost: 1500, dmg: 400, reach: 20, arc: 120, wind: 0.30, active: 0.10, rec: 0.50, cleave: 5, kb: 40, stagger: 1.0,  dur: 100, cls: 'heavy', len: 11, color: '#6f787d', ignoresArmour: true, feel: 'blunt' },
  cricket: { name: 'Cricket Bat',  cost: 0,    dmg: 130, reach: 22, arc: 110, wind: 0.11, active: 0.08, rec: 0.28, cleave: 3, kb: 26, stagger: 0.5,  dur: 150, cls: 'heavy', len: 10, color: '#e8dfc6', crateOnly: true, feel: 'blunt' },
  cleaver: { name: 'Meat Cleaver',  cost: 0,    dmg: 180, reach: 18, arc: 70,  wind: 0.06, active: 0.06, rec: 0.18, cleave: 2, kb: 8,  stagger: 0.3,  dur: 150, cls: 'light', len: 7,  color: '#c0c4c8', crateOnly: true, special: true, feel: 'chop' },
  golf:    { name: 'Golf Club',    cost: 0,    dmg: 130, reach: 22, arc: 110, wind: 0.11, active: 0.08, rec: 0.28, cleave: 3, kb: 26, stagger: 0.5,  dur: 150, cls: 'heavy', len: 11, color: '#c0c4c8', crateOnly: true, feel: 'blunt' },
};

// fire: semi | auto | draw. reload in s (perShell for shotgun). noise: quiet|medium|loud|vloud
export const GUNS = {
  revolver: { name: 'Revolver',        cost: 0,    ammoCost: 250, dmg: 100, pellets: 1, fire: 'semi', rpm: 240, mag: 6,  reserve: 36,  reload: 2.2, range: 200, pen: 1, noise: 'loud',   spread: 2,  head: 0.15 },
  pistol:   { name: 'Service Pistol',  cost: 400,  ammoCost: 200, dmg: 70,  pellets: 1, fire: 'semi', rpm: 400, mag: 15, reserve: 75,  reload: 1.4, range: 180, pen: 1, noise: 'loud',   spread: 3,  head: 0.15 },
  shotgun:  { name: 'Pump Shotgun',    cost: 1000, ammoCost: 500, dmg: 60,  pellets: 8, fire: 'semi', rpm: 70,  mag: 6,  reserve: 36,  reload: 0.5, perShell: true, range: 90, pen: 1, noise: 'vloud', spread: 16, head: 0 },
  dbarrel:  { name: 'Double-Barrel',   cost: 0,    ammoCost: 0,   dmg: 80,  pellets: 8, fire: 'semi', rpm: 400, mag: 2,  reserve: 40,  reload: 2.0, range: 80,  pen: 1, noise: 'vloud',  spread: 20, head: 0, crateOnly: true },
  rifle:    { name: 'Hunting Rifle',   cost: 1200, ammoCost: 600, dmg: 450, pellets: 1, fire: 'semi', rpm: 45,  mag: 5,  reserve: 35,  reload: 2.5, range: 360, pen: 4, noise: 'loud',   spread: 0,  head: 0.40 },
  crossbow: { name: 'Crossbow',        cost: 1500, ammoCost: 750, dmg: 300, pellets: 1, fire: 'semi', rpm: 40,  mag: 1,  reserve: 20,  reload: 1.6, range: 280, pen: 2, noise: 'quiet',  spread: 0,  head: 0.30, projectile: 'bolt', speed: 420 },
  smg:      { name: 'SMG',             cost: 0,    ammoCost: 0,   dmg: 90,  pellets: 1, fire: 'auto', rpm: 700, mag: 30, reserve: 180, reload: 2.0, range: 200, pen: 1, noise: 'loud',   spread: 6,  head: 0.10, crateOnly: true },
  ar:       { name: 'Army Rifle',      cost: 0,    ammoCost: 0,   dmg: 130, pellets: 1, fire: 'auto', rpm: 600, mag: 30, reserve: 210, reload: 2.4, range: 320, pen: 2, noise: 'vloud',  spread: 3,  head: 0.20, crateOnly: true },
  bow:      { name: 'Compound Bow',    cost: 0,    ammoCost: 0,   dmg: 400, pellets: 1, fire: 'draw', rpm: 60,  mag: 1,  reserve: 15,  reload: 0.5, range: 300, pen: 3, noise: 'quiet',  spread: 0,  head: 0.30, projectile: 'bolt', speed: 380, drawTime: 0.8, crateOnly: true },
  flare:    { name: 'Flare Gun',       cost: 0,    ammoCost: 0,   dmg: 250, pellets: 1, fire: 'semi', rpm: 30,  mag: 1,  reserve: 8,   reload: 2.0, range: 220, pen: 1, noise: 'loud',   spread: 0,  head: 0,    projectile: 'flare', speed: 260, crateOnly: true },
  blowtorch:{ name: 'The Blowtorch',   cost: 0,    ammoCost: 0,   dmg: 120, pellets: 1, fire: 'flame', rpm: 600, mag: 20, reserve: 0, reload: 0, range: 28, pen: 99, noise: 'medium', spread: 0, head: 0, special: true, wonder: true },
  nailgun:  { name: 'Nail Gun Cannon', cost: 0,    ammoCost: 0,   dmg: 220, pellets: 1, fire: 'auto', rpm: 450, mag: 50, reserve: 250, reload: 3.0, range: 220, pen: 6, noise: 'medium', spread: 3,  head: 0.10, noFalloff: true, crateOnly: true, wonder: true },
};

export const THROWS = {
  brick:   { name: 'Brick',       max: 4, noise: 'quiet' },
  molotov: { name: 'Molotov',     max: 4, cost: 600,  noise: 'medium' },
  pipe:    { name: 'Pipe Bomb',   max: 5, cost: 1000, noise: 'vloud', power: true },
  alarm:   { name: 'Alarm Clock', max: 3, cost: 1000, noise: 'loud' },
};

export const COMFORTS = {
  stew:     { name: 'Hot Stew',      cost: 2500, color: '#d9822b', desc: 'Max health 250' },
  coffee:   { name: 'Black Coffee',  cost: 3000, color: '#8f6a3e', desc: 'Faster reload & swap' },
  steady:   { name: 'Steady Hands',  cost: 2000, color: '#9b3a5a', desc: 'Guns fire faster, hit twice' },
  bandages: { name: 'Bandages',      cost: 500,  color: '#e8dfc6', desc: 'Self-revive (3 per run). Own slot', noPower: true },
  shoes:    { name: 'Running Shoes', cost: 2000, color: '#4d8f8a', desc: 'Move faster' },
  gasmask:  { name: 'Gasmask',       cost: 2500, color: '#5d8a4a', desc: 'Blast & fire immune, shove dash' },
  mule:     { name: 'Pack Mule',     cost: 4000, color: '#4d7fb8', desc: 'Extra gun slot, +50% ammo, +1 comfort' },
  eagle:    { name: 'Eagle Eye',     cost: 1500, color: '#e2b53c', desc: 'Headshots x2, aim snap' },
  barbed:   { name: 'Barbed Wrap',   cost: 4000, color: '#8c8f86', desc: 'Snare attackers' },
};

export const FINDS = {
  ammo:      { name: 'AMMO BAG',      color: '#c49a62', barks: ['Someone was hoarding.', 'Full pockets. Nice.', 'That\'ll do.'] },
  adrenaline:{ name: 'ADRENALINE',    color: '#e03a2a', barks: ['Oh, that\'s the good stuff.', 'Heart\'s going like a drum.', 'Everything\'s slow now.'], timed: true },
  double:    { name: 'DOUBLE SCRAP',  color: '#e2b53c', barks: ['Payday.', 'Look at all that.', 'Pockets are heavy this wave.'], timed: true },
  dynamite:  { name: 'DYNAMITE',      color: '#b5503b', barks: ['Cover your ears.', 'Fire in the hole.', 'Duck.'] },
  toolbox:   { name: 'TOOLBOX',       color: '#a8402f', barks: ['Hold still, you.', 'Good as new. Ish.', 'Measure twice.'] },
  sale:      { name: 'TRADER\'S SALE', color: '#4d8f8a', barks: ['Everything must go.', 'She\'s feeling generous.', 'Bargain wave.'], timed: true },
  chainsaw:  { name: 'THE CHAINSAW',  color: '#d9822b', barks: ['Now we\'re talking.', 'Groovy.', 'Stand back.'] },
  wallet:    { name: 'WALLET',        color: '#8f6a3e', barks: ['Finders keepers.', 'He won\'t need it.', 'Cash is just paper now. Still.'] },
  guts:      { name: 'WALKER GUTS',   color: '#5d6b2a', barks: ['Oh, that\'s rank.', 'Never again. Until next time.', 'Smell like them, walk like them.'], timed: true },
};
export const FIND_TYPES = Object.keys(FINDS);

export const EFFECTS = {
  burn:  { name: 'Burn',  desc: 'Sets them alight', color: '#e8823a', long: '15% of hits set the target on fire (40 dmg/s for 4 s). Fire spreads to anything it touches.' },
  shock: { name: 'Shock', desc: 'Arcs to 3 nearby', color: '#7ac0ff', long: '15% of hits arc lightning to up to 3 enemies within 48 px for half damage.' },
  chill: { name: 'Chill', desc: 'Slows, shatters', color: '#bfe8f4', long: '20% of hits slow the target by 60% for 3 s. Killing a chilled walker shatters it.' },
  rot:   { name: 'Rot',   desc: 'Turns one briefly', color: '#7ad04a', long: '5% of hits turn a normal walker into an ally for 10 s. It fights for you, then drops.' },
  bleed: { name: 'Bleed', desc: 'Stacking bleed', color: '#e0404a', long: 'Every hit adds a bleed stack (15 dmg/s each, up to 5) for 5 s.' },
};

export const UPG_NAMES = {
  hammer: ['Claw & Order', 'Split Claw', 'Old Faithful'],
  bat: ['Nail Bat', 'Barbed Nail Bat', 'Mabel'],
  machete: ['Brush Cutter', 'Serrated Cutter', 'The Harvest'],
  axe: ['Station Axe', 'Red Axe', 'Last Alarm'],
  spear: ['Long Rebar', 'Barbed Rebar', 'The Steeple'],
  sledge: ['Demolisher', 'Wrecking Ball', 'Groundbreaker'],
  cricket: ['Sticky Wicket', 'Howzat', 'Last Over'],
  golf: ['Nine Iron', 'Sand Wedge', 'Hole in One'],
  cleaver: ['Chopper', 'Butcher\'s Block', 'Sunday Roast'],
  blowtorch: ['The Dragon', 'The Dragon II', 'The Dragon III'],
  revolver: ['Six-Shot Sally', 'Sally Mk II', 'Sally Forth'],
  pistol: ['Duty Calls', 'Off Duty', 'Overtime'],
  shotgun: ['Barn Door', 'Barn Burner', 'Harvest Moon'],
  dbarrel: ['Two Pints', 'Last Orders', 'Lock-In'],
  rifle: ['Long Walk', 'Longer Walk', 'The Valley'],
  crossbow: ['Quiet Neighbour', 'Hush', 'Vespers'],
  smg: ['Chatterbox', 'Gossip', 'Town Crier'],
  ar: ['Army Surplus', 'Surplus Plus', 'Last Garrison'],
  bow: ['Yew Tree', 'Old Yew', 'Robin'],
  flare: ['Bonfire Night', 'Guy Fawkes', 'Beacon'],
  nailgun: ['Framer', 'First Fix', 'The Roofer'],
};

// §17.3. Throwable bundles are pocket refills.
export const CRATE_WEIGHTS = [
  ['pistol', 6], ['shotgun', 9], ['rifle', 9], ['crossbow', 7],
  ['bat', 4], ['machete', 4], ['spear', 5], ['axe', 6], ['sledge', 6],
  ['cricket', 3], ['golf', 3], ['dbarrel', 7], ['smg', 8], ['bow', 5], ['flare', 4],
  ['t:molotov', 2], ['t:pipe', 2], ['t:alarm', 2], ['ar', 6], ['nailgun', 4],
];

// What a crate item is worth, in Scrap (shown while the crate spins). Crate-only weapons have no shop price, so they get an estimate.
const CRATE_ONLY_VALUE = { dbarrel: 1250, smg: 1800, ar: 2500, bow: 1600, flare: 900, nailgun: 3000, cricket: 650, golf: 650 };
export function itemValue(id) {
  const t = id.startsWith('t:') ? THROWS[id.slice(2)] : null;
  const d = t || GUNS[id] || MELEE[id];
  return (d && d.cost) || CRATE_ONLY_VALUE[id] || 0;
}
// colour of a value readout against the crate's price: worse than a pull, about even, better, jackpot
export function valueTint(v) { return v >= 2000 ? '#f0d070' : v >= 1250 ? '#6cbf4a' : v >= 800 ? '#cfc7a8' : '#8f8a7a'; }


export const OUTFITS = [
  { name: 'hi-vis',     shirt: '#d9c23a', trim: '#8c8f86', pants: '#3d4550' },
  { name: 'scrubs',     shirt: '#5f9a9a', trim: '#4d8080', pants: '#5f9a9a' },
  { name: 'postman',    shirt: '#7a3a35', trim: '#c9a24a', pants: '#3a3e4a' },
  { name: 'hunter',     shirt: '#5d6b3a', trim: '#8f6a3e', pants: '#4a4033' },
  { name: 'tabard',     shirt: '#4d7fb8', trim: '#e8dfc6', pants: '#33363d' },
  { name: 'hoodie',     shirt: '#6b6f75', trim: '#4a4d52', pants: '#3e5a80' },
  { name: 'suit',       shirt: '#2f3238', trim: '#c8bf9a', pants: '#2f3238' },
  { name: 'school',     shirt: '#2f4060', trim: '#a8402f', pants: '#3a3a3e' },
  { name: 'firefighter',shirt: '#3a3530', trim: '#d9c23a', pants: '#3a3530' },
  { name: 'chef',       shirt: '#d8d4c8', trim: '#a8a49a', pants: '#4a4a4a' },
  { name: 'farmer',     shirt: '#3e5a80', trim: '#2f3a50', pants: '#3e5a80', boots: '#2f4a2a' },
  { name: 'barmaid',    shirt: '#7a5a8a', trim: '#e8dfc6', pants: '#3a3030' },
];

export const BARKS = {
  outOfAmmo: ['Empty. Brilliant.', 'Click. Great.', 'Out. Of course.', 'Should\'ve counted.'],
  power: ['Let there be light. And noise.', 'There she goes.', 'Lights on. Lights on!'],
  lowHealth: ['Not today.', 'Still standing.', 'Keep it together, old man.', 'That one hurt.'],
  crateHammer: ['Another hammer. Great.'],
  crateGood: ['Oh, she\'s lovely.', 'I\'ll take it.', 'Now that\'s a find.', 'Merry Christmas.'],
  crateClosed: ['Closed? Typical.', 'Off she goes then.', 'Come back with that.'],
  door: ['Mind the glass.', 'Room to breathe.', 'More town, more trouble.'],
  comfort: ['That\'s better.', 'Hits the spot.', 'Now I\'m ready.'],
  revive: ['Not yet.', 'Up. Get up.', 'Still here.'],
  brute: ['Oh, he\'s big.', 'That\'s a riot cop.', 'Big lad incoming.'],
  dogs: ['Dogs. Why\'s it always dogs.', 'Hear that?', 'Here, boy. No.'],
  workshop: ['Let\'s see what she can do.', 'Bit of welding never hurt.'],
};

export const ZONE_NAMES = {
  1: 'Main Street', 2: 'the post office', 3: 'the fire station', 4: 'the garage', 5: 'the Red Lion car park',
  6: 'the churchyard', 7: 'the school field', 8: 'the builders\' yard', 9: 'the allotments',
};

// ======================= v1.1 (ENHANCEMENT-PRD) =======================

// What each comfort does, and what it gains when it ripens after 5 waves (shown in the HUD tooltip and the Enochpedia).
export const COMFORT_INFO = {
  stew:     { does: 'Max health goes from 100 to 250 and tops you up by 150.', ripe: 'Ripened: you take 10% less damage from everything.' },
  coffee:   { does: 'Reloads twice as fast, weapon swaps twice as fast, melee recovers 25% quicker.', ripe: 'Ripened: once every 30 s, reloading an empty gun is instant.' },
  steady:   { does: 'Guns fire 33% faster and every bullet does double damage. Melee winds up 20% quicker.', ripe: 'Ripened: ammo at racks costs 25% less.' },
  bandages: { does: 'When you go down, you get back up after 6 s. 3 uses per run, shared stock.', ripe: 'Ripened: getting back up takes half as long.' },
  shoes:    { does: 'You move 12% faster and strafe at 90% speed instead of 75%.', ripe: 'Ripened: being surrounded no longer slows you down.' },
  gasmask:  { does: 'Immune to blasts, fire, gas and traps. Shove becomes a dash that barges through walkers.', ripe: 'Ripened: explosions near you heal you 10 HP instead.' },
  mule:     { does: 'An extra gun slot (slot 4, Primary or Secondary), +50% ammo for every gun, +1 comfort slot (so it costs you none) and +1 Bandage. Guns only go to the stash once slot 4 is full too.', ripe: 'Ripened: weapon swaps are instant.' },
  eagle:    { does: 'Headshot chance doubled, gun spread halved, and your aim snaps to walkers within 10 degrees. Melee arcs are 20 degrees wider.', ripe: 'Ripened: melee critical hits stagger everything within 20 px.' },
  barbed:   { does: 'When something hits you, everything within 40 px is snared (80% slower) for 3 s. Bricks are wire-wrapped. +1 brick.', ripe: 'Ripened: snared walkers also bleed 10 HP/s.' },
};

// §13 Weapon condition
export const CONDITIONS = [
  { id: 'rusty', name: 'Rusty', color: '#8c8f86' },
  { id: 'worn', name: 'Worn', color: '#b8ae8a' },
  { id: 'sound', name: 'Sound', color: '#6cbf4a' },
  { id: 'fine', name: 'Fine', color: '#4d9fe0' },
  { id: 'master', name: 'Masterwork', color: '#f0b030' },
];
export const GUN_MODS = {
  extmag: { name: 'Extended mag', desc: '+50% magazine' },
  quick: { name: 'Quick hands', desc: 'Reload 30% faster' },
  suppressor: { name: 'Suppressor', desc: 'One noise level quieter' },
  hollow: { name: 'Hollow points', desc: '+1 penetration' },
  hair: { name: 'Hair trigger', desc: '+15% fire rate' },
};
export const MELEE_MODS = {
  grip: { name: 'Long grip', desc: '+4 reach' },
  heavy: { name: 'Heavy head', desc: '+50% knockback' },
  taped: { name: 'Taped handle', desc: 'Swing recovery 20% faster' },
  barbed: { name: 'Barbed', desc: 'Hits bleed 5 dmg/s for 3 s' },
  balanced: { name: 'Balanced', desc: 'Criticals on pinned targets too' },
};

// §11 Padding
export const PADDING = [
  { name: 'Taped magazines', desc: 'Magazines taped round the forearms' },
  { name: 'Leather jacket', desc: 'A biker jacket, cracked at the elbows' },
  { name: 'Stab vest', desc: 'An old police stab vest' },
];

// §12 Tricks (field upgrades), X to use
export const TRICKS = {
  flare: { name: 'Flare Burst', desc: 'Blind every walker within 120 px for 4 s and light the area for 8 s.', up: 'Upgraded: blinded walkers catch fire.', color: '#e8823a' },
  mist: { name: 'Red Mist', desc: '8 s of fury: melee damage x2, swings 30% faster, each melee kill heals 10 HP.', up: 'Upgraded: lasts 12 s and kills heal 20 HP.', color: '#e03a2a' },
  smoke: { name: 'Smoke Bomb', desc: 'A 48 px smoke cloud for 6 s. Walkers lose track of you while you are inside it.', up: 'Upgraded: the cloud is twice as wide and lasts 10 s.', color: '#9aa3a8' },
  whistle: { name: 'Whistle', desc: 'A sharp whistle 100 px ahead: everything within 260 px walks to it for 5 s.', up: 'Upgraded: lasts 9 s and lured walkers are staggered when they arrive.', color: '#e2b53c' },
  stand: { name: 'Stand Your Ground', desc: 'Plant a flag: for 10 s, within 40 px you take 50% less damage and barricade repairs are instant.', up: 'Upgraded: 75% less damage and you heal 5 HP/s near the flag.', color: '#4d7fb8' },
};

// §14 Keepsakes (held: use with a double tap of X)
export const KEEPSAKES = {
  penny: { name: 'Lucky Penny', desc: 'Next crate pull can\'t be CLOSED and rolls one condition better.' },
  ring: { name: 'Wedding Ring', held: true, desc: 'Use it, and the next time you go down you are straight back up with full health and your comforts.' },
  watch: { name: 'Pocket Watch', desc: '3 rounds: reloads don\'t use reserve ammo.' },
  keys: { name: 'Car Keys', held: true, desc: 'Use it to get moved to a quiet spot in an open zone.' },
  rosary: { name: 'Rosary', held: true, desc: 'Use it to drop an Adrenaline find at your feet.' },
  polaroid: { name: 'Polaroid', desc: '60 s: every 10 Scrap earned puts a bullet in the gun you hold.' },
  soldier: { name: 'Toy Soldier', held: true, desc: 'Use it: a friendly rifleman covers you from a rooftop for 30 s.' },
  harmonica: { name: 'Harmonica', held: true, desc: 'Use it: everything within 200 px stops and sways for 5 s.' },
  lighter: { name: 'Lighter', held: true, desc: 'Use it: the next 10 enemies that hit you catch fire.' },
  crossword: { name: 'Crossword', desc: 'The next find dropped lasts twice as long.' },
  photo: { name: 'Old Photo', desc: 'A random comfort you don\'t have, free (if you have room).' },
  dogtag: { name: 'Dog Tag', desc: '+1 comfort slot for the rest of the run.' },
  ticket: { name: 'Train Ticket', desc: '3 rounds: every gun shot is a headshot.' },
  tin: { name: 'Biscuit Tin', desc: 'Biscuit is healed and bites twice as hard for 2 rounds. No dog? 5 Parts.' },
};

// §15 Trials (the noticeboard posts one every other round from wave 4)
// v1.5 T1/T2: targets come from the dead expected in the trial's window (see trialTarget in sim/nights.js).
// share = the fraction of those kills the player can reasonably make eligible; fixed = a target not tied to kills.
export const TRIALS = {
  melee: { name: 'Kill {n} with melee', share: 0.9 },
  crit: { name: 'Land {n} critical kills: strike staggered or pinned dead', share: 0.5 }, // v1.5 T3: crits come from staggers, not luck
  weapon: { name: 'Kill {n} with the {w}', share: 0.8 },
  zone: { name: 'Kill {n} in {z}', share: 0.6 },
  planks: { name: 'Repair {n} planks', fixed: 20 },
  untouched: { name: 'Kill {n} without being hit', share: 0.6, max: 15 },
  boom: { name: 'Kill {n} with explosives or fire', share: 0.4, max: 12 },
  quiet: { name: 'Kill {n} while noise is under 20', share: 0.6, max: 30 },
  biscuit: { name: 'Kill {n} that Biscuit pinned', share: 0.35, max: 10 },
};

// §16 Weather
export const WEATHER = {
  clear: { name: 'Clear', desc: 'Normal rules.' },
  rain: { name: 'Rain', desc: 'Noise carries only 60% as far, so guns are safer. Fires burn out twice as fast. Harder to see.' },
  storm: { name: 'Storm', desc: 'Rain, plus lightning every 15-25 s that lights the whole town, and thunder that pulls walkers away. Can blow the fuse.' },
  fog: { name: 'Fog', desc: 'Light reaches half as far and the dead are 10% slower. Stay near the lamps.' },
  still: { name: 'Still and cold', desc: 'Sound carries 50% further. Walkers are 10% slower in the cold.' },
};

// §9 Survivors
export const ROLES = {
  medic: { name: 'Medic', desc: '+1 Bandages use (up to 4), health regen starts 1 s sooner, treats sick survivors.' },
  mechanic: { name: 'Mechanic', desc: 'Workshop 20% cheaper, generator fuel lasts 10 waves, fuse blows half as often.' },
  lookout: { name: 'Lookout', desc: 'Marks every special on your HUD the moment it spawns, with a radio warning.' },
  cook: { name: 'Cook', desc: 'Hot Stew 30% cheaper. Each wave, repairs a Padding layer if you are near the pub.' },
  scavenger: { name: 'Scavenger', desc: 'Leaves 1 Part and 100-300 Scrap on the bar every wave.' },
  fighter: { name: 'Fighter', desc: 'Guards the safe house: 200 HP, double damage, kills walkers that get in.' },
};
export const SURVIVOR_NAMES = ['Maggie', 'Tom', 'Edna', 'Ravi', 'Bryn', 'Agnes', 'Colin', 'Priya', 'Gethin', 'Joan', 'Dev', 'Moira', 'Stan', 'Lowri', 'Frank', 'Hattie'];
export const SURVIVOR_LINES = [
  'I used to run the Saturday market. Feels like a hundred years ago.',
  'My lad went up to the RV on the first day. Haven\'t heard since.',
  'I keep counting the tins. Habit.',
  'Thank you. I mean it. I thought that cellar was it.',
  'You hear the bells at wave? Gives me the shivers.',
  'Forty years I taught in that school. Forty years.',
  'If you see a blue Fiesta, it was mine. Keys are in it.',
  'I sleep better when I can hear you out there.',
  'The trader came through before, you know. Before all this.',
  'Somebody has to keep the kettle on.',
];

// §5/§21 Radio voice lines (typed, with a blip per word)
export const RADIO = {
  offer: 'Hilltop here. Got a job for you, if you\'re up for it.',
  fuel: 'Gennie\'s getting thirsty.',
  fuse: 'Fuse has gone. Spare\'s in town somewhere.',
  beacons: 'Herd\'s coming. Light the beacons and we can turn some of them.',
  escape: 'That engine at the station. If you can get it running, we\'ll open the gate for you.',
  callIn: 'Ninety seconds. Hold on.',
  silence: '...',
  signal: ['...ksshh... Kirkby... Low Fell... Ashworth... is anyone...', '...forty-one... seventeen... ksshh... repeat...', '...we have power... and a doctor... kssh...'],
  raiders: 'We just want your stuff, old man.',
};

// §20 Tapes (typed on screen when picked up)
export const TAPES = [
  { title: 'The landlord', text: 'Red Lion, Tuesday. Cellar\'s full of the good stuff and nobody to drink it. Locked the doors at nine. Somebody knocked till midnight. I didn\'t answer. God forgive me.' },
  { title: 'Miss Pryce, Year 3', text: 'The buses never came. We walked them up the hill in a line, holding hands, singing. I counted twenty-six. At the top I counted twenty-six. I will always remember that I counted twenty-six.' },
  { title: 'Station Officer Hale', text: 'Control, this is Zion. Engine one is out of diesel and the pump\'s seized. We are holding the station. If anyone hears this, tell my wife the cat is fed.' },
  { title: 'The trader', text: 'First time I came through Zion they paid me in apples. Second time, in bullets. Third time there was nobody to pay. I left a crate anyway. Old habits.' },
  { title: 'The postmistress', text: 'Letters still come, if you can believe it. Nobody brings them. They just turn up in the box. I\'ve stopped opening them.' },
  { title: 'The vicar', text: 'Rang the bell for evensong like always. They came, all of them. Not to pray. I have not rung it since.' },
  { title: 'A farmer, south field', text: 'Cows went first. Then the dogs started acting strange. Then the quiet. The quiet is the worst of it.' },
  { title: 'Unknown', text: 'If you\'re hearing this, tune in after dark. There\'s a woman reading towns off a list. She said Zion once. I think she\'s real. I think there\'s somewhere else.' },
];

// §6.3 / §8 / misc item names shown on the tracker and in the world
export const ITEMS = {
  jerry: 'jerry can', fuse: 'fuse', battery: 'car battery', cable: 'cable', flare: 'flare', crate: 'supply crate', key: 'back-room key',
  antibiotics: 'antibiotics', pallet: 'pallet', nails: 'nails', parcel: 'parcel', bomb: 'ticking parcel', wheel: 'sluice wheel',
  carbattery: 'battery', food: 'food', tyre: 'tyre', keys: 'engine keys', receiver: 'ham radio', card: 'frequency card',
  burner: 'weed burner', propane: 'propane tank', pump: 'pump', shedkey: 'shed key', part: 'Part', supplies: 'supplies crate',
  drum: 'cable drum',
};
// v1.2 B11: what each pocket item is for (the Journal's Items tab)
export const ITEM_USES = {
  fuse: 'From a shop shelf: fits the fuse board at the fire station after it blows.',
  battery: 'From the garage: powers the school radio mast.',
  cable: 'From the hardware shop: wires up the school radio mast.',
  flare: 'From the fire station locker: light it on the playing field to call the drop.',
  key: 'From the walker in the white coat: opens the pharmacy back room.',
  antibiotics: 'From the pharmacy back room: cures a sick survivor at the Red Lion.',
  nails: 'From the hardware shop: nail the pallet over the drain.',
  wheel: 'From the allotment shed: cranks the sluice gate open.',
  food: 'From the pub kitchen: coaxes the dog out of the shed.',
  receiver: 'A dead ham radio: it needs mains power.',
  card: 'A frequency card: part of the Signal.',
  burner: 'Weed burner: one of three Blowtorch parts. Build it at a bench.',
  propane: 'Propane tank: one of three Blowtorch parts.',
  pump: 'Pump: one of three Blowtorch parts.',
  shedkey: 'Opens a locked shed.',
  drum: 'From the hardware shop: run it to each trap\'s junction box.',
  tyre: 'For the fire engine.', keys: 'The fire engine\'s keys.', carbattery: 'For the fire engine.',
};

// what each trap does, in a sentence (prompts, map tooltips, Enochpedia)
export const TRAP_INFO = {
  fence: 'Zaps every walker in the yard dead.',
  fireline: 'Sets walkers alight as they cross the line.',
  petrol: 'Sprays burning petrol that scales with the wave.',
  bell: 'Rings the whole town in to this spot.',
  searchlight: 'For 20 s blinds the dead in its beam and marks specials through walls.',
};
