// The Enoch town map (PRD §10). Hand-authored as data; layers match §27.6
// (ground, objects, collision, zones, doors, spawns/barricades, racks, comforts, lights, crateSpots, traps, hazards).

export const W = 96, H = 64;
export const FLOOR = 0, WALL = 1, BLD = 2, OUT = 3, PROP = 4, DOOR = 5, BAR = 6, SOFT = 7;
// v1.4 C1: small props are soft. Nothing snags on them (player or the dead), but they still stop bullets.
export const SOFT_PROPS = new Set(['phonebox', 'shelter', 'bin', 'grave', 'pallets', 'tyres', 'scarecrow', 'bench', 'noticeboard']);
const HEAVY_SOFT = new Set(['bin', 'bench', 'pallets', 'tyres']); // wading through these costs 10% speed
export const G = { GRASS: 0, ROAD: 1, PAVE: 2, GRAVEL: 3, TARMAC: 4, FIELD: 5, YARD: 6, GRAVE: 7, SOIL: 8, WOODS: 9, FARM: 10, RIVER: 11, BYPASS: 12, FLOORBOARD: 13 };

const COLS = [[2, 31], [33, 63], [65, 93]];
const ROWS = [[2, 20], [22, 42], [44, 61]];
const ZGRID = [[6, 7, 8], [3, 1, 4], [5, 2, 9]];

// [zoneA, zoneB, name, cost, kind]
const DOORS = [
  [1, 2, 'Boarded post-office door', 750, 'boards'],
  [1, 3, 'Wrecked cars', 1000, 'cars'],
  [1, 4, 'Padlocked chain-link gate', 1000, 'gate'],
  [1, 7, 'School alley fence', 1250, 'fence'],
  [2, 5, 'Pallet barricade', 1000, 'pallets'],
  [2, 9, 'Back-garden fence', 1000, 'fence'],
  [3, 5, 'Overturned skip', 1250, 'skip'],
  [3, 6, 'Chained church gate', 1250, 'gate'],
  [4, 8, 'Heras fencing', 1250, 'heras'],
  [4, 9, 'Rolled-down shutter', 1500, 'shutter'],
  [6, 7, 'Hedge and fallen tree', 1000, 'hedge'],
  [7, 8, 'Portable cabin', 1500, 'cabin'],
];

// Buildings: x,y,w,h in tiles; facade = bottom row.
const BUILDINGS = [
  { zone: 1, x: 34, y: 23, w: 11, h: 5, name: 'HARDWARE', roof: '#4a5560', wall: 'brick', kind: 'shop' },
  { zone: 1, x: 52, y: 23, w: 11, h: 5, name: 'NEWS & BAKERY', roof: '#5a4a48', wall: 'brick', kind: 'shop' },
  { zone: 1, x: 34, y: 37, w: 9, h: 5, name: 'CAFE', roof: '#4a5560', wall: 'brick', kind: 'shop', facadeTop: true },
  { zone: 1, x: 54, y: 37, w: 9, h: 5, name: 'BUTCHER', roof: '#55504a', wall: 'brick', kind: 'shop', facadeTop: true },
  { zone: 3, x: 6, y: 23, w: 15, h: 7, name: 'FIRE STATION', roof: '#5a3a35', wall: 'brick', kind: 'fire' },
  { zone: 3, x: 4, y: 36, w: 7, h: 6, name: '', roof: '#4a5560', wall: 'brick', kind: 'house', facadeTop: true },
  // ART-PRD-3 F (S1.1 shape masks): '#' is building, '.' is the zone's ground. The church's chancel is narrower than
  // its nave; the school is an L round its playground. Neither frees a route past a barricade or door.
  { zone: 6, x: 6, y: 4, w: 10, h: 8, name: 'ST MARY\'S', roof: '#4a5560', wall: 'stone', kind: 'church', shape: ['...#######', '##########', '##########', '##########', '##########', '##########', '##########', '##########'] },
  { zone: 7, x: 35, y: 3, w: 12, h: 7, name: 'ZION PRIMARY', roof: '#5a4a48', wall: 'brick', kind: 'school', shape: ['....########', '....########', '....########', '############', '############', '############', '############'] },
  { zone: 8, x: 67, y: 3, w: 7, h: 4, name: 'SITE OFFICE', roof: '#9aa3a8', wall: 'tin', kind: 'cabin' },
  { zone: 8, x: 84, y: 3, w: 7, h: 4, name: 'STORES', roof: '#9aa3a8', wall: 'tin', kind: 'cabin' },
  { zone: 4, x: 74, y: 23, w: 17, h: 6, name: 'GARAGE', roof: '#6f787d', wall: 'tin', kind: 'garage' },
  { zone: 5, x: 4, y: 45, w: 11, h: 6, name: 'THE RED LION', roof: '#4a5560', wall: 'brick', kind: 'pub' },
  { zone: 2, x: 35, y: 45, w: 11, h: 6, name: 'POST OFFICE', roof: '#5a3a35', wall: 'brick', kind: 'post' },
  { zone: 2, x: 50, y: 45, w: 12, h: 6, name: 'PHARMACY', roof: '#4a5560', wall: 'brick', kind: 'pharmacy' },
  { zone: 9, x: 67, y: 45, w: 11, h: 6, name: 'HUNT & TACKLE', roof: '#55504a', wall: 'wood', kind: 'shop' },
];

const NOTCHES = [[2, 2], [3, 2], [4, 2], [2, 3], [3, 3], [4, 3]];

// Barricades: tile, inward direction (into the playable zone). The dead spawn behind (tile - inward).
const BARRICADES = [
  [37, 27, 0, 1], [42, 27, 0, 1], [55, 27, 0, 1], [60, 27, 0, 1], [38, 37, 0, -1], [58, 37, 0, -1], // zone 1 shopfronts
  [10, 1, 0, 1], [1, 16, 1, 0], [24, 1, 0, 1],      // 6 church
  [52, 1, 0, 1], [60, 1, 0, 1], [38, 9, 0, 1],      // 7 school
  [76, 1, 0, 1], [94, 10, -1, 0], [94, 16, -1, 0],  // 8 builders
  [1, 26, 1, 0], [1, 38, 1, 0], [7, 36, 0, -1],     // 3 fire station
  [94, 33, -1, 0], [94, 39, -1, 0], [89, 28, 0, 1], // 4 garage
  [1, 55, 1, 0], [24, 62, 0, -1], [10, 62, 0, -1],   // 5 pub (v1.1: the old pub-wall barricade moved to the south fence)
  [42, 62, 0, -1], [56, 62, 0, -1],                 // 2 post office
  [74, 62, 0, -1], [94, 54, -1, 0],                 // 9 hunting
];

// Racks sit on building facades / walls (solid tiles); interact from the adjacent floor tile.
const RACKS = [
  { item: 'bat', x: 35, y: 27 }, { item: 'shotgun', x: 40, y: 27 },
  { item: 'machete', x: 8, y: 29 }, { item: 'axe', x: 12, y: 29 },
  { item: 'crossbow', x: 8, y: 11 },
  { item: 'spear', x: 69, y: 6 },
  { item: 'sledge', x: 85, y: 28 }, { item: 't:pipe', x: 87, y: 28 },
  { item: 't:molotov', x: 6, y: 50 },
  { item: 't:alarm', x: 37, y: 50 }, { item: 'pistol', x: 39, y: 56 },
  { item: 'rifle', x: 69, y: 50 },
];
const COMFORT_SPOTS = [
  { id: 'coffee', x: 16, y: 29 }, { id: 'steady', x: 11, y: 11 }, { id: 'eagle', x: 41, y: 9 },
  { id: 'gasmask', x: 71, y: 6 }, { id: 'barbed', x: 87, y: 6 }, { id: 'mule', x: 76, y: 28 },
  { id: 'stew', x: 5, y: 45 }, // v1.5 R7: in the kitchen, well away from the door { id: 'bandages', x: 53, y: 50 }, { id: 'shoes', x: 72, y: 50 },
];
const SECOND_WIND = { x: 75, y: 50 };
const WORKSHOP = { x: 81, y: 28 };
const GENERATOR = { x: 26, y: 25 };
const AMMO_CRATE = { x: 40, y: 56 };
const VAULT = [{ x: 43, y: 50, mode: 'deposit' }, { x: 44, y: 50, mode: 'withdraw' }];
const JERRY = { x: 78, y: 28 };
const CRATE_SPOTS = [{ x: 58, y: 30, zone: 1 }, { x: 24, y: 16, zone: 6 }, { x: 88, y: 51, zone: 9 }, { x: 88, y: 15, zone: 8 }];

// Solid props (tiles)
const PROPS = [
  { kind: 'memorial', x: 48, y: 32, w: 1, h: 1 },
  { kind: 'phonebox', x: 44, y: 29, w: 1, h: 1 }, { kind: 'shelter', x: 55, y: 29, w: 2, h: 1 },
  { kind: 'bin', x: 34, y: 35, w: 1, h: 1 }, { kind: 'bin', x: 62, y: 35, w: 1, h: 1 },
  { kind: 'car', x: 37, y: 34, w: 2, h: 1, paint: '#e8dfc6' },
  { kind: 'grave', x: 19, y: 4, w: 1, h: 1 }, { kind: 'grave', x: 22, y: 4, w: 1, h: 1 }, { kind: 'grave', x: 25, y: 4, w: 1, h: 1 },
  { kind: 'grave', x: 19, y: 8, w: 1, h: 1 }, { kind: 'grave', x: 22, y: 8, w: 1, h: 1 }, { kind: 'grave', x: 25, y: 8, w: 1, h: 1 },
  { kind: 'grave', x: 28, y: 6, w: 1, h: 1 }, { kind: 'grave', x: 19, y: 12, w: 1, h: 1 }, { kind: 'grave', x: 25, y: 12, w: 1, h: 1 },
  { kind: 'digger', x: 78, y: 9, w: 3, h: 2 }, { kind: 'pallets', x: 68, y: 13, w: 1, h: 1 }, { kind: 'pallets', x: 70, y: 15, w: 1, h: 1 },
  { kind: 'pallets', x: 84, y: 11, w: 2, h: 1 },
  { kind: 'pump', x: 69, y: 35, w: 1, h: 1 }, { kind: 'pump', x: 72, y: 35, w: 1, h: 1 },
  { kind: 'tyres', x: 91, y: 31, w: 1, h: 1 },
  { kind: 'car', x: 17, y: 48, w: 2, h: 1, paint: '#b5503b', alarm: true }, { kind: 'car', x: 24, y: 48, w: 2, h: 1, paint: '#4d8f8a' },
  { kind: 'car', x: 17, y: 54, w: 2, h: 1, paint: '#e2b53c', alarm: true }, { kind: 'car', x: 24, y: 54, w: 2, h: 1, paint: '#e8dfc6' },
  { kind: 'car', x: 28, y: 51, w: 2, h: 1, paint: '#6f787d', alarm: true },
  { kind: 'policebox', x: 39, y: 55, w: 2, h: 2 },
  { kind: 'shed', x: 84, y: 46, w: 3, h: 2 }, { kind: 'tunnel', x: 83, y: 58, w: 7, h: 2 }, { kind: 'scarecrow', x: 90, y: 55, w: 1, h: 1 },
  { kind: 'goal', x: 50, y: 11, w: 1, h: 1 }, { kind: 'goal', x: 62, y: 11, w: 1, h: 1 },
  // v1.1
  { kind: 'fireengine', x: 27, y: 27, w: 4, h: 2 }, { kind: 'towtruck', x: 86, y: 38, w: 3, h: 2 },
  { kind: 'bench', x: 74, y: 12, w: 1, h: 1 }, { kind: 'noticeboard', x: 51, y: 30, w: 1, h: 1 },
];
// v1.4 H1/E3: named streets, drawn on the map with their names. Tasks only name a street that's on this list.
export const STREETS = [
  { name: 'HIGH STREET', title: 'High Street', x0: 2, y0: 31, x1: 93, y1: 33, v: false },
  { name: 'SCHOOL LANE', title: 'School Lane', x0: 47, y0: 2, x1: 49, y1: 30, v: true },
  { name: 'STATION ROAD', title: 'Station Road', x0: 47, y0: 34, x1: 49, y1: 61, v: true },
  { name: 'THE BYPASS', title: 'the bypass', x0: 0, y0: 2, x1: 1, y1: 61, v: true },
];
// v1.1 (ENHANCEMENT-PRD §22.3): named spots for errands, quests, lore and events. Tile coords of walkable tiles.
const SPOTS = {
  hardware_a: [36, 29], hardware_b: [41, 29], garage_a: [80, 30], garage_b: [88, 30], school_care: [34, 10],
  fuseboard: [14, 30], fire_locker: [19, 30], school_mast: [47, 6], field: [56, 11], church_ladder: [16, 10], fire_ladder: [21, 26],
  drain: [45, 33], yard_a: [69, 14], yard_b: [71, 16], yard_c: [84, 12], pharmacy_cellar: [59, 52], pharmacy_back: [51, 52],
  pub_door: [9, 51], pub_in: [9, 48], pub_kitchen: [6, 47], pub_bar: [10, 47], pub_spool: [12, 49], pub_flap_in: [7, 49], pub_flap_out: [7, 51], phonebox: [45, 30], church_porch: [11, 13],
  shed: [85, 48], sluice: [93, 48], searchlight: [44, 10], school_shed: [58, 14], towtruck: [87, 37], tyres: [90, 31],
  engine: [28, 29], engine_cab: [31, 28], church_board: [11, 13], staffroom: [45, 11], dartboard: [12, 48], memorial: [49, 33],
  church_roof: [8, 12], lost_property: [40, 11], scarecrow: [90, 56], bbq: [6, 57], bench_yard: [74, 13], bench_garage: [83, 29],
  bench_fire: [19, 30], noticeboard: [51, 31], jukebox: [12, 46], workshop: [81, 29],
  tape0: [53, 40], tape1: [4, 34], tape2: [28, 18], tape3: [60, 17], tape4: [90, 18], tape5: [66, 24], tape6: [29, 60], tape7: [78, 60],
  roof_hardware: [39, 29], roof_news: [57, 29], roof_post: [41, 52], truck_drop: [3, 40], heli_1: [56, 33], heli_3: [16, 34], heli_4: [80, 34],
  heli_6: [24, 10], heli_7: [56, 16], heli_9: [86, 54], heli_2: [50, 56], heli_5: [24, 50], heli_8: [80, 12],
  raid_3: [4, 32], raid_8: [80, 16], raid_1: [36, 32], raid_4: [91, 35], raid_5: [20, 60], raid_2: [46, 58], raid_7: [40, 14], raid_6: [10, 16], raid_9: [72, 56],
  part_1: [63, 40], part_8: [90, 8], part_4: [66, 40], part_3: [3, 24], part_9: [92, 60],
};
// The Red Lion's inner rooms become the safe house (§9.2): carved floor, a door gap and 4 window barricades of its own.
const PUB_INTERIOR = [5, 46, 13, 49];
const PUB_DOOR = [9, 50];
const SAFE_BARS = [[4, 47, 1, 0], [7, 45, 0, 1], [10, 45, 0, 1], [14, 47, -1, 0]];
// Rooftop beacons (§6.6), drawn on the roofs; lit from the ladder spot
const BEACONS = [{ id: 'church', x: 13.5, y: 2.5, spot: 'church_ladder', zone: 6 }, { id: 'fire', x: 9, y: 23, spot: 'fire_ladder', zone: 3 }, { id: 'school', x: 44, y: 3, spot: 'school_mast', zone: 7 }];
const BRAZIERS = [{ x: 45, y: 36 }, { x: 22, y: 33 }, { x: 12, y: 17 }, { x: 47, y: 15 }, { x: 88, y: 54 }, { x: 5, y: 57 }];
const BARRELS = [{ x: 34, y: 30 }, { x: 24, y: 38 }, { x: 70, y: 40 }, { x: 91, y: 13 }, { x: 60, y: 58 }, { x: 9, y: 58 }];
const LAMPS = [
  [44, 30], [52, 30], [44, 34], [52, 34], [36, 32], [60, 32], [26, 31], [12, 33], [20, 14], [48, 12], [48, 6],
  [82, 14], [78, 34], [86, 34], [20, 46], [48, 53], [48, 59], [78, 53], [10, 53], [30, 9],
];
// Traps: switch tile + area rect (tiles, inclusive)
const TRAPS = [
  { kind: 'fence', name: 'Electrified fence', cost: 700, active: 25, cooldown: 60, sx: 83, sy: 19, area: [77, 18, 81, 20], zone: 8 },
  { kind: 'fence', name: 'Electrified fence', cost: 700, active: 25, cooldown: 60, sx: 79, sy: 56, area: [79, 50, 82, 54], zone: 9 },
  { kind: 'fireline', name: 'Fire line', cost: 700, active: 20, cooldown: 60, sx: 15, sy: 57, area: [16, 58, 30, 59], zone: 5 },
  { kind: 'petrol', name: 'Petrol pump spray', cost: 1000, active: 15, cooldown: 90, sx: 76, sy: 33, area: [65, 33, 75, 39], zone: 4 },
  { kind: 'bell', name: 'Church bell', cost: 500, active: 15, cooldown: 120, sx: 14, sy: 11, area: [17, 13, 27, 19], zone: 6 },
  { kind: 'searchlight', name: 'Searchlight', cost: 500, active: 20, cooldown: 45, sx: 44, sy: 9, area: [50, 4, 62, 19], zone: 7 },
];
const DECOR = [
  ['banner', 48, 22.2], ['trolley', 61, 30], ['bicycle', 35, 29.5], ['pram', 57, 35], ['binbags', 45, 28], ['binbags', 62, 41],
  ['binbags', 21, 30], ['trolley', 30, 50], ['bicycle', 36, 52], ['sand', 75, 15], ['sand', 88, 17], ['scaffold', 69, 6.5],
  ['bed', 82, 48], ['bed', 82, 51], ['bed', 86, 50], ['bed', 90, 47], ['bed', 90, 50], ['flowers', 13, 18], ['bench', 20, 17],
  ['bench', 41, 30], ['bunting', 0, 0],
];


export function buildMap() {
  const tiles = new Uint8Array(W * H).fill(OUT);
  const ground = new Uint8Array(W * H).fill(G.GRASS);
  const zoneId = new Int8Array(W * H).fill(-1);
  const doorId = new Int8Array(W * H).fill(-1);
  const I = (x, y) => y * W + x;
  const zones = {};

  // outer ground: woods north, fields south, river east, bypass west
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let g = G.WOODS;
    if (y >= 62) g = G.FARM; else if (x >= 94) g = G.RIVER; else if (x <= 1 && y > 1) g = G.BYPASS;
    ground[I(x, y)] = g;
  }
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const id = ZGRID[r][c]; const [x0, x1] = COLS[c]; const [y0, y1] = ROWS[r];
    zones[id] = { id, c, r, x0, x1, y0, y1, cx: ((x0 + x1 + 1) / 2) * 16, cy: ((y0 + y1 + 1) / 2) * 16 };
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { tiles[I(x, y)] = FLOOR; ground[I(x, y)] = G.GRASS; zoneId[I(x, y)] = id; }
  }
  // walls: outer fence ring and zone dividers
  const setWall = (x, y) => { tiles[I(x, y)] = WALL; ground[I(x, y)] = G.GRASS; };
  for (let y = 1; y <= 62; y++) { setWall(1, y); setWall(94, y); }
  for (let x = 1; x <= 94; x++) { setWall(x, 1); setWall(x, 62); }
  for (let y = 2; y <= 61; y++) { setWall(32, y); setWall(64, y); }
  for (let x = 2; x <= 93; x++) { setWall(x, 21); setWall(x, 43); }
  // ART-PRD-3 F (S3.3): the fence steps in round a collapsed cottage in the north-west corner, clear of spawns and doors
  for (const [x, y] of NOTCHES) setWall(x, y);

  // ground layers
  const fillG = (x0, y0, x1, y1, g) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) ground[I(x, y)] = g; };
  fillG(65, 2, 93, 20, G.GRAVEL);          // builders yard
  fillG(18, 3, 30, 14, G.GRAVE);            // graveyard
  fillG(50, 4, 62, 19, G.FIELD);            // playing field
  fillG(16, 45, 31, 61, G.TARMAC);          // pub car park
  fillG(65, 30, 77, 41, G.TARMAC);          // forecourt
  fillG(22, 23, 31, 29, G.YARD);            // fire station yard
  fillG(80, 45, 93, 61, G.SOIL);            // allotments
  fillG(43, 29, 53, 35, G.PAVE);            // the square
  fillG(2, 31, 93, 33, G.ROAD);             // high street (E-W)
  fillG(47, 2, 49, 61, G.ROAD);             // the crossroads (N-S)
  for (const y of [28, 36]) { fillG(33, y, 46, y, G.PAVE); fillG(50, y, 63, y, G.PAVE); } // v1.6: the pavements stop at the kerb, not across Station Road / School Lane
  fillG(36, 34, 39, 34, G.PAVE);            // v1.6: a lay-by under the car parked off the High Street
  fillG(85, 34, 89, 40, G.GRAVEL);          // v1.6: a gravel pull-in for the tow truck, not grass
  fillG(32, 52, 46, 54, G.TARMAC);          // v1.6: the pub car park's drive, through its gate to Station Road

  // buildings
  const buildings = BUILDINGS.map((b) => ({ ...b }));
  for (const b of buildings) {
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (!b.shape || b.shape[y - b.y][x - b.x] === '#') tiles[I(x, y)] = BLD;
    const py = b.facadeTop ? b.y - 1 : b.y + b.h;
    for (let x = b.x; x < b.x + b.w; x++) if (tiles[I(x, py)] === FLOOR && ground[I(x, py)] === G.GRASS) ground[I(x, py)] = G.PAVE;
  }
  // v1.1: carve the pub interior (safe house)
  for (let y = PUB_INTERIOR[1]; y <= PUB_INTERIOR[3]; y++) for (let x = PUB_INTERIOR[0]; x <= PUB_INTERIOR[2]; x++) { tiles[I(x, y)] = FLOOR; ground[I(x, y)] = G.FLOORBOARD; zoneId[I(x, y)] = 5; }
  tiles[I(PUB_DOOR[0], PUB_DOOR[1])] = FLOOR; ground[I(PUB_DOOR[0], PUB_DOOR[1])] = G.FLOORBOARD; zoneId[I(PUB_DOOR[0], PUB_DOOR[1])] = 5;
  // props
  const props = PROPS.map((p, i) => ({ ...p, id: i }));
  const heavySoft = new Set();
  for (const p of props) {
    if (p.kind === 'goal') continue; // goalposts are decor you can walk through
    const soft = SOFT_PROPS.has(p.kind); p.soft = soft;
    for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) { tiles[I(x, y)] = soft ? SOFT : PROP; if (HEAVY_SOFT.has(p.kind)) heavySoft.add(I(x, y)); }
  }
  for (const b of BRAZIERS) tiles[I(b.x, b.y)] = PROP;
  for (const b of BARRELS) tiles[I(b.x, b.y)] = PROP;
  for (const c of CRATE_SPOTS) tiles[I(c.x, c.y)] = PROP;
  tiles[I(GENERATOR.x, GENERATOR.y)] = PROP;
  for (const t of TRAPS) tiles[I(t.sx, t.sy)] = PROP;

  // doors
  const doors = DOORS.map(([a, b, name, cost, kind], id) => {
    const za = zones[a], zb = zones[b];
    let tl = [];
    if (za.r === zb.r) { // vertical wall
      const x = Math.max(za.c, zb.c) === 1 ? 32 : 64;
      const cy = Math.round((ROWS[za.r][0] + ROWS[za.r][1]) / 2);
      for (let y = cy - 1; y <= cy + 1; y++) tl.push([x, y]);
    } else {
      const y = Math.max(za.r, zb.r) === 1 ? 21 : 43;
      const cx = Math.round((COLS[za.c][0] + COLS[za.c][1]) / 2);
      for (let x = cx - 1; x <= cx + 1; x++) tl.push([x, y]);
    }
    for (const [x, y] of tl) { tiles[I(x, y)] = DOOR; doorId[I(x, y)] = id; ground[I(x, y)] = ground[I(x, y)] === G.ROAD ? G.ROAD : G.PAVE; }
    const mid = tl[1];
    return { id, a, b, name, cost, kind, tiles: tl, x: mid[0] * 16 + 8, y: mid[1] * 16 + 8, vertical: za.r === zb.r, open: false };
  });

  // barricades
  const barricades = BARRICADES.map(([x, y, ix, iy], id) => {
    tiles[I(x, y)] = BAR;
    const inX = x + ix, inY = y + iy;
    return {
      id, tx: x, ty: y, ix, iy, x: x * 16 + 8, y: y * 16 + 8,
      zone: zoneId[I(inX, inY)], inside: { x: inX * 16 + 8, y: inY * 16 + 8, tx: inX, ty: inY },
      spawn: { x: (x - ix) * 16 + 8, y: (y - iy) * 16 + 8 },
      outer: { x: x * 16 + 8 - ix * 9, y: y * 16 + 8 - iy * 9 },
      building: tiles[I(x - ix, y - iy)] === BLD,
    };
  });

  // v1.1 safe-house windows: barricades whose outside is the car park and inside is the pub
  const safeBars = SAFE_BARS.map(([x, y, ix, iy], id) => {
    tiles[I(x, y)] = BAR;
    const inX = x + ix, inY = y + iy;
    return {
      id: 100 + id, safe: true, tx: x, ty: y, ix, iy, x: x * 16 + 8, y: y * 16 + 8, zone: 5,
      inside: { x: inX * 16 + 8, y: inY * 16 + 8, tx: inX, ty: inY },
      spawn: { x: (x - ix) * 16 + 8, y: (y - iy) * 16 + 8 }, outer: { x: x * 16 + 8 - ix * 9, y: y * 16 + 8 - iy * 9 }, building: false,
    };
  });
  const spots = {};
  for (const [k, [x, y]] of Object.entries(SPOTS)) spots[k] = { id: k, x, y, px: x * 16 + 8, py: y * 16 + 8, zone: zoneId[I(x, y)] };
  // cover points for Raiders (§22.3): walkable tiles with a solid neighbour (cars, bins, walls)
  const cover = [];
  for (let y = 3; y < H - 3; y += 2) for (let x = 3; x < W - 3; x += 2) {
    if (tiles[I(x, y)] !== FLOOR) continue;
    let n = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (tiles[I(x + dx, y + dy)] === PROP || tiles[I(x + dx, y + dy)] === SOFT || tiles[I(x + dx, y + dy)] === BLD) n++;
    if (n) cover.push({ x: x * 16 + 8, y: y * 16 + 8, zone: zoneId[I(x, y)] });
  }

  const center = (o) => ({ ...o, px: o.x * 16 + 8, py: o.y * 16 + 8, zone: zoneOfFacade(o) });
  function zoneOfFacade(o) {
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [0, 0]]) {
      const z = zoneId[I(o.x + dx, o.y + dy)]; if (z > 0 && tiles[I(o.x + dx, o.y + dy)] === FLOOR) return z;
    }
    return zoneId[I(o.x, o.y)];
  }

  return {
    W, H, tiles, ground, zoneId, doorId, zones, buildings, props, doors, barricades,
    racks: RACKS.map(center), comfortSpots: COMFORT_SPOTS.map(center), secondWind: center(SECOND_WIND),
    workshop: center(WORKSHOP), generator: center(GENERATOR), ammoCrate: center(AMMO_CRATE),
    vault: VAULT.map(center), jerry: center(JERRY),
    crateSpots: CRATE_SPOTS.map(center), braziers: BRAZIERS.map(center), barrels: BARRELS.map(center),
    lamps: LAMPS.map(([x, y]) => ({ x: x * 16 + 8, y: y * 16 + 8 })),
    traps: TRAPS.map((t) => ({ ...t, px: t.sx * 16 + 8, py: t.sy * 16 + 8, rect: [t.area[0] * 16, t.area[1] * 16, (t.area[2] + 1) * 16, (t.area[3] + 1) * 16] })),
    decor: DECOR.map(([kind, x, y]) => ({ kind, x: x * 16 + 8, y: y * 16 + 8 })),
    start: { x: 48 * 16 + 8, y: 34 * 16 + 12 },
    safeBars, spots, cover, heavySoft, beacons: BEACONS.map((b) => ({ ...b, px: b.x * 16 + 8, py: b.y * 16 + 8 })),
    pub: { x0: PUB_INTERIOR[0] * 16, y0: PUB_INTERIOR[1] * 16, x1: (PUB_INTERIOR[2] + 1) * 16, y1: (PUB_INTERIOR[3] + 1) * 16, door: { x: PUB_DOOR[0] * 16 + 8, y: PUB_DOOR[1] * 16 + 8 } },
    engine: { x: 27, y: 27, w: 4, h: 2, px: 29 * 16, py: 28 * 16 },
  };
}
