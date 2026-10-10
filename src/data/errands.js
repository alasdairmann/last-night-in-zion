// Errands as data (ENHANCEMENT-PRD §6, §22.2). Step types and effects are a fixed vocabulary implemented once
// in sim/errands.js; new errands should need no new code.
//   offer.source: radio | board | world | auto
//   requires: 'zone:N' (open), 'power', 'everPowered', 'safeRoom' (a survivor slot is free), 'sick' (a survivor is sick)
//   steps: fetch | carry | use | hold | clear | escort | hunt | activate | cars | watch | bounty
//   rewards: scrap | parts | finds | cratePull | closeSpawn | survivor | effect | keepsake | padding | power | biscuit | bandage | cure
export const ERRANDS = [
  {
    id: 'fuel', name: 'Fuel Run', parallel: true, brief: 'Gennie\'s getting thirsty.',
    offer: { source: 'auto' },
    steps: [
      { type: 'watch', key: 'haveJerry', text: 'Buy a jerry can at the garage' },
      { type: 'watch', key: 'fuelFull', text: 'Carry it to the generator' },
    ],
    rewards: [], failure: null,
  },
  {
    id: 'fuse', name: 'Blown Fuse', parallel: true, brief: 'Fuse has gone. Spare\'s in town somewhere.',
    offer: { source: 'auto' },
    steps: [
      { type: 'fetch', item: 'fuse', spots: ['hardware_a', 'garage_a', 'school_care'], text: 'Find a fuse' },
      { type: 'use', at: 'fuseboard', seconds: 2, needs: 'fuse', label: 'Fit the fuse', text: 'Fit it at the fire station fuse board' },
    ],
    rewards: [{ power: true }, { scrap: 300 }], failure: null,
  },
  {
    id: 'supplyDrop', name: 'Supply Drop', brief: 'Fix the school mast and we\'ll call in a drop.',
    offer: { source: 'radio', minRound: 6, requires: ['zone:7', 'zone:4', 'zone:3'] },
    steps: [
      { type: 'fetch', item: 'battery', spots: ['garage_a', 'garage_b'], text: 'Get a car battery from the garage' },
      { type: 'fetch', item: 'cable', spots: ['hardware_a', 'hardware_b'], text: 'Get cable from the hardware shop' },
      { type: 'use', at: 'school_mast', seconds: 3, label: 'Repair the radio mast', text: 'Repair the mast on the school roof', done: [{ effect: 'mast' }, { effect: 'radio', text: 'Mast\'s up. Drop\'s coming. Light a flare on the playing field.' }] },
      { type: 'fetch', item: 'flare', spots: ['fire_locker'], text: 'Take a flare from the fire station locker' },
      { type: 'use', at: 'field', seconds: 2, label: 'Light the flare', text: 'Light it in the middle of the playing field', done: [{ effect: 'light', at: 'field', r: 70, t: 60 }] },
      { type: 'hold', at: 'field', seconds: 45, radius: 72, retries: 1, minAlive: 6, text: 'Hold the playing field', label: 'A plane circles overhead', done: [{ effect: 'drop', at: 'field' }] },
      { type: 'use', at: 'field', seconds: 1.5, label: 'Open the supply crate', text: 'Open the crate' },
    ],
    rewards: [{ finds: 2, at: 'field' }, { cratePull: true }, { parts: 3 }, { padding: true }],
    failure: { radio: 'Plane couldn\'t find you. Drop\'s gone in the woods.' },
  },
  {
    id: 'cellar', name: 'Knocking in the Cellar', brief: 'Someone is knocking from the pharmacy cellar.',
    offer: { source: 'world', minRound: 5, at: 'pharmacy_cellar', requires: ['zone:2', 'zone:5', 'safeRoom'] },
    steps: [
      { type: 'use', at: 'pharmacy_cellar', seconds: 2, label: 'Prise the cellar door open', text: 'Open the cellar door', done: [{ effect: 'survivor', at: 'pharmacy_cellar' }] },
      { type: 'clear', at: 'pharmacy_cellar', n: 4, text: 'Kill the walkers that came up with them' },
      { type: 'escort', to: 'pub_in', text: 'Take the survivor to the Red Lion' },
    ],
    rewards: [{ survivor: true }],
    failure: { silence: true, bark: 'I\'m sorry. I\'m so sorry.' },
  },
  {
    id: 'medicine', name: 'Medicine Run', brief: 'Antibiotics in the pharmacy. A walker has the key.',
    offer: { source: 'radio', minRound: 8, requires: ['zone:2'] }, timeRounds: 3,
    steps: [
      { type: 'hunt', mark: 'whitecoat', drop: 'key', text: 'Find the walker in the white coat' },
      { type: 'fetch', item: 'key', text: 'Pick up the back-room key' },
      { type: 'use', at: 'pharmacy_back', seconds: 1, needs: 'key', label: 'Unlock the back room', text: 'Unlock the pharmacy back room' },
      { type: 'fetch', item: 'antibiotics', spots: ['pharmacy_back'], text: 'Take the antibiotics' },
      { type: 'carry', item: 'antibiotics', to: 'pub_in', text: 'Bring them to the Red Lion' },
    ],
    rewards: [{ cure: true }, { bandage: true }, { scrap: 500 }],
    failure: { sickDies: true },
  },
  {
    id: 'beacons', name: 'Light the Beacons', brief: 'Herd\'s coming. Light the beacons to turn some.',
    offer: { source: 'radio', beforeHerd: true, requires: ['zone:6', 'zone:3', 'zone:7'] }, timeRounds: 1, // v1.4 E2: set at wave 7, fails at the end of wave 8
    steps: [{ type: 'activate', spots: ['church_ladder', 'fire_ladder', 'school_mast'], seconds: 1.5, label: 'Light the beacon', text: 'Light all three rooftop beacons' }],
    rewards: [{ effect: 'beacons' }], failure: { radio: 'Not enough light. They\'re all coming.' },
  },
  {
    id: 'sealDrain', name: 'Seal the Drain', brief: 'The storm drain in the square has become a nest.',
    offer: { source: 'board', minRound: 10, requires: ['zone:8'] }, onOffer: [{ effect: 'nest' }],
    steps: [
      { type: 'fetch', item: 'nails', spots: ['hardware_a', 'hardware_b'], text: 'Get nails from the hardware shop' },
      { type: 'fetch', item: 'pallet', spots: ['yard_a', 'yard_b', 'yard_c'], carry: true, heavy: true, text: 'Get a pallet from the builders\' yard' },
      { type: 'carry', item: 'pallet', to: 'drain', text: 'Carry the pallet to the drain' },
      { type: 'hold', at: 'drain', seconds: 20, noAttack: true, noFail: true, text: 'Nail it down inside the ring (shove only)', label: 'Nailing the pallet down' },
    ],
    rewards: [{ closeSpawn: 'drain' }, { scrap: 1000 }], failure: null,
  },
  {
    id: 'trader', name: 'The Trader\'s Errand', brief: 'Take the trader\'s parcel to a dead drop. Fast.',
    offer: { source: 'world', at: 'crate' }, timeRounds: 1,
    steps: [
      { type: 'fetch', item: 'parcel', spots: ['crate'], carry: true, text: 'Take the parcel from the crate' },
      { type: 'carry', item: 'parcel', to: 'deadDrop', text: 'Deliver it to the dead drop' },
    ],
    rewards: [{ effect: 'traderDeal' }], failure: { effect: 'traderAnnoyed' },
  },
  {
    id: 'sluice', name: 'Open the Sluice', brief: 'Open the sluice and flood the underpass.',
    offer: { source: 'board', minRound: 8, requires: ['zone:9'] },
    steps: [
      { type: 'fetch', item: 'wheel', spots: ['shed'], text: 'Find the sluice wheel in the allotment shed' },
      { type: 'use', at: 'sluice', seconds: 3, needs: 'wheel', label: 'Crank the sluice gate', text: 'Open the sluice gate by the river' },
    ],
    rewards: [{ effect: 'sluice' }], failure: null,
  },
  // v1.2 B19: the searchlight errand is gone; the light costs 500 a use instead.
  {
    id: 'wire', name: 'Wire the Town', brief: 'Wire the traps to a switchboard in the Red Lion.',
    offer: { source: 'pub', minRound: 6, at: 'pub_spool', requires: ['zone:5', 'pubDoor'] }, build: 'wireSteps', // v1.5 W1: started from the spool in the Red Lion
    steps: [
      { type: 'fetch', item: 'drum', spots: ['hardware_a', 'hardware_b'], carry: true, text: 'Get a cable drum from the hardware shop' },
      // one 'use' step per trap is added when the errand starts (sim/errands.js wireSteps)
    ],
    rewards: [{ scrap: 500 }], failure: null,
  },
  {
    id: 'bounty', name: 'Bounty Contract', brief: 'Somebody wants a head. Big money.',
    offer: { source: 'board', minRound: 8 }, timeRounds: 4,
    steps: [{ type: 'bounty', text: 'Hunt the named special' }],
    rewards: [{ scrap: 1500 }, { keepsake: true }], failure: { radio: 'Contract\'s expired.' },
  },
  {
    id: 'lostDog', name: 'Lost Dog', brief: 'Barking. A dog, trapped somewhere.',
    offer: { source: 'world', minRound: 4, once: true, at: 'dogShed', requires: ['zone:5'] }, timeRounds: 5,
    steps: [
      { type: 'clear', at: 'dogShed', n: 5, text: 'Clear the walkers round the shed' },
      { type: 'fetch', item: 'food', spots: ['pub_kitchen'], text: 'Get food from the pub kitchen' },
      { type: 'use', at: 'dogShed', seconds: 1, needs: 'food', label: 'Open the shed door', text: 'Open the shed with the food in hand' },
    ],
    rewards: [{ biscuit: true }], failure: { radio: 'The barking\'s stopped.' },
  },
];
export const ERRAND = Object.fromEntries(ERRANDS.map((e) => [e.id, e]));
