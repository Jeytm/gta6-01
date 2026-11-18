// SOLMARINA — a sun-soaked open-world crime game. All tuning, palette, districts,
// car models and weapons live here so the other systems share one source of truth.

export const WORLD = {
  size: 4800, // the city is a square, 0..4800 on both axes
  roadGap: 400, // distance between road centre lines
  roadWidth: 64, // asphalt width of every road
  sidewalk: 14, // pavement ring around each block
  firstRoad: 200, // centre line of the first road
  roadCount: 12, // 12 roads each way, 144 intersections
  waterY: 4380, // the bay starts here, along the whole south edge
  sandY: 4260, // beach strip above the water
};

export const PALETTE = {
  groundDry: '#c9b489',
  groundPark: '#79a75c',
  groundDowntown: '#b5a98f',
  groundDocks: '#a89c86',
  sand: '#ecd9a0',
  waterDeep: '#2e7f9e',
  waterShallow: '#4fb0c4',
  asphalt: '#4b4b55',
  asphaltDark: '#3f3f49',
  laneDash: '#e8dd9a',
  sidewalk: '#c2b8a4',
  curb: '#9a917e',
  roofTerracotta: '#b5633f',
  roofSlate: '#6e7683',
  roofSand: '#d9c48f',
  wallCream: '#f2e6cf',
  wallWhite: '#fbf7ee',
  wallPeach: '#f0c9a0',
  wallMint: '#bcd8c0',
  wallSky: '#bcd2e8',
  wallBrick: '#c98a6b',
  wallGold: '#e8c46e',
  glass: '#9fd4e8',
  palmTrunk: '#7a5a3a',
  palmLeaf: '#4f9e4d',
  shadow: 'rgba(60, 30, 10, 0.28)',
};

// Nine districts in a 3x3 grid over the city; the south row is beachfront.
export const DISTRICTS = [
  { name: 'Old Town', x0: 0, y0: 0, x1: 1600, y1: 1600, ground: '#cbb693', style: 'old' },
  { name: 'Downtown', x0: 1600, y0: 0, x1: 3200, y1: 1600, ground: '#b5a98f', style: 'towers' },
  { name: 'Marina Heights', x0: 3200, y0: 0, x1: 4800, y1: 1600, ground: '#c2b28d', style: 'mid' },
  { name: 'Calle Verde', x0: 0, y0: 1600, x1: 1600, y1: 3200, ground: '#c4b28a', style: 'color' },
  { name: 'Central Solmarina', x0: 1600, y0: 1600, x1: 3200, y1: 3200, ground: '#bfae8e', style: 'mid' },
  { name: 'The Docks', x0: 3200, y0: 1600, x1: 4800, y1: 3200, ground: '#a89c86', style: 'docks' },
  { name: 'Palm Court', x0: 0, y0: 3200, x1: 1600, y1: 4800, ground: '#cdbb96', style: 'low' },
  { name: 'Beachfront', x0: 1600, y0: 3200, x1: 3200, y1: 4800, ground: '#d8c493', style: 'beach' },
  { name: 'South Docks', x0: 3200, y0: 3200, x1: 4800, y1: 4800, ground: '#b3a284', style: 'docks' },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  }
  return DISTRICTS[4];
}

// Fixed landmarks, always on or beside a road so missions can reach them.
export const LANDMARKS = {
  garage: { x: 1000, y: 1000, label: "Luz's Garage" },
  safehouse: { x: 3400, y: 3000, label: 'Safehouse' },
  docksDeal: { x: 4200, y: 2200, label: 'Pier 9 Warehouse' },
  bank: { x: 2200, y: 1800, label: 'Solmarina Trust' },
  hospital: { x: 1400, y: 3000, label: 'St. Alma Hospital' },
  respray: { x: 3000, y: 1400, label: 'Marina Auto Body' },
  taxiStand: { x: 2200, y: 2600, label: 'Taxi Stand' },
  stadium: { x: 3800, y: 3800, label: 'Solmarina Arena' },
  motel: { x: 600, y: 2600, label: 'Palm Motel' },
  dealership: { x: 2600, y: 3400, label: 'Vulture Motors' },
};

// Arcade car models: length/width in world units, speed in units per second.
export const CAR_MODELS = {
  sedan: { name: 'Solano Sedan', len: 52, wid: 26, accel: 240, topSpeed: 330, reverse: 110, grip: 3.4, turn: 2.5, health: 100, colors: ['#c94f42', '#4a6fa5', '#d8d3c8', '#5a5a66', '#7a8c5a'] },
  coupe: { name: 'Breeze Coupe', len: 50, wid: 25, accel: 290, topSpeed: 370, reverse: 120, grip: 3.8, turn: 2.8, health: 90, colors: ['#e8b23a', '#3f8f7a', '#d85a7a', '#f0ede4'] },
  muscle: { name: 'Torro GT', len: 54, wid: 27, accel: 340, topSpeed: 410, reverse: 130, grip: 3.0, turn: 2.4, health: 110, colors: ['#23232b', '#8c2f2f', '#e8e4da'] },
  van: { name: 'Cargo Van', len: 58, wid: 28, accel: 190, topSpeed: 270, reverse: 90, grip: 3.0, turn: 2.0, health: 140, colors: ['#e8e4da', '#7a8a99', '#b5a06a'] },
  taxi: { name: 'Solmarina Cab', len: 52, wid: 26, accel: 250, topSpeed: 340, reverse: 110, grip: 3.5, turn: 2.6, health: 100, colors: ['#f2c230'] },
  police: { name: 'SCPD Interceptor', len: 53, wid: 26, accel: 320, topSpeed: 400, reverse: 130, grip: 3.9, turn: 2.9, health: 160, colors: ['#1d2a44'] },
  truck: { name: 'Hauler Truck', len: 66, wid: 30, accel: 160, topSpeed: 240, reverse: 80, grip: 2.8, turn: 1.8, health: 180, colors: ['#6a7a8a', '#a85a2a'] },
};

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, rate: 0.38, range: 46, spread: 0, ammo: Infinity, automatic: false, melee: true },
  pistol: { name: 'P9 Pistol', damage: 26, rate: 0.24, range: 520, spread: 0.035, ammo: Infinity, automatic: false, bulletSpeed: 900 },
  smg: { name: 'K-9 SMG', damage: 13, rate: 0.085, range: 460, spread: 0.09, ammo: 240, automatic: true, bulletSpeed: 950 },
  shotgun: { name: 'Breacher 12', damage: 14, rate: 0.75, range: 300, spread: 0.16, pellets: 6, ammo: 36, automatic: false, bulletSpeed: 820 },
};

export const TUNING = {
  walkSpeed: 175,
  sprintSpeed: 265,
  playerHealth: 100,
  playerArmor: 50,
  trafficCount: 24,
  pedCount: 42,
  copCarBase: 1,
  evadeSeconds: 14, // unseen time that drops one wanted star
  resprayCost: 250,
  hospitalCost: 200,
  taxiFarePerUnit: 0.055,
  packageReward: 150,
  jumpReward: 200,
  startCash: 120,
};

export const STORY = {
  city: 'Solmarina',
  hero: 'Mara Quinn',
  fixer: 'Luz Delgado',
  rival: 'The Vultures',
  copForce: 'SCPD',
};
