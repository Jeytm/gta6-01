// Side activities between jobs: taxi fares, hidden packages and stunt jumps.
// They pay cash, fill the stats screen, and give free roam something to do
// after the story ends.

import { LANDMARKS, TUNING } from './config.js';
import { randomPick } from './random.js';
import { spawnFloatText, spawnParticles } from './effects.js';

const TAXI_DESTINATIONS = [
  'hospital', 'stadium', 'bank', 'dealership', 'motel', 'safehouse', 'respray', 'taxiStand',
];

export const JUMP_RAMPS = [
  { x: 2200, y: 300, angle: Math.PI / 2, label: 'Harbor Leap' },
  { x: 3800, y: 2600, angle: 0, label: 'Dockside Flyer' },
  { x: 1000, y: 3800, angle: Math.PI / 2, label: 'Beachfront Boost' },
];

export function createActivities(rng) {
  const packages = [];
  const spots = [
    { x: 620, y: 620 }, { x: 2380, y: 420 }, { x: 4180, y: 620 },
    { x: 420, y: 2020 }, { x: 1980, y: 2220 }, { x: 4380, y: 1980 },
    { x: 620, y: 3420 }, { x: 2620, y: 3220 }, { x: 4020, y: 4020 },
    { x: 1000, y: 4560 },
  ];
  for (const spot of spots) packages.push({ ...spot, taken: false });
  return {
    taxi: { state: 'idle', passenger: null, dest: null, timer: 0, fare: 0 },
    packages,
    packagesFound: 0,
    jumpsDone: new Set(),
    jumpCooldown: 0,
  };
}

function taxiStandPoint() {
  return { x: LANDMARKS.taxiStand.x, y: LANDMARKS.taxiStand.y };
}

function updateTaxi(G, dt) {
  const taxi = G.activities.taxi;
  const p = G.player;
  taxi.timer = Math.max(0, taxi.timer - dt);
  const inTaxi = p.inCar && p.inCar.model === 'taxi';

  if (taxi.state === 'idle') {
    if (inTaxi) {
      // A fare is waiting at the stand.
      taxi.state = 'toPickup';
      taxi.passenger = taxiStandPoint();
      G.hud.setPrompt('Taxi: pick up the fare at the stand');
    }
    return;
  }
  if (!inTaxi) {
    taxi.state = 'idle';
    taxi.passenger = null;
    taxi.dest = null;
    return;
  }
  if (taxi.state === 'toPickup') {
    if (Math.hypot(p.x - taxi.passenger.x, p.y - taxi.passenger.y) < 80) {
      const key = randomPick(G.rng, TAXI_DESTINATIONS);
      taxi.dest = { ...LANDMARKS[key], key };
      const dist = Math.hypot(taxi.dest.x - p.x, taxi.dest.y - p.y);
      taxi.fare = Math.round(60 + dist * TUNING.taxiFarePerUnit);
      taxi.timer = Math.max(30, dist / 190);
      taxi.state = 'toDest';
      spawnFloatText(G.fx, p.x, p.y - 30, `Fare: ${taxi.dest.label} — $${taxi.fare}`, '#ffd76a');
      G.audio.pickup();
    }
    return;
  }
  if (taxi.state === 'toDest') {
    if (Math.hypot(p.x - taxi.dest.x, p.y - taxi.dest.y) < 90) {
      const bonus = taxi.timer > 0 ? Math.round(taxi.timer * 2) : 0;
      const total = taxi.fare + bonus;
      p.cash += total;
      G.stats.fares++;
      spawnFloatText(G.fx, p.x, p.y - 30, `+$${total} FARE`, '#8ae08a');
      G.audio.cash();
      taxi.state = 'toPickup';
      taxi.passenger = taxiStandPoint();
      taxi.dest = null;
    } else if (taxi.timer <= 0) {
      spawnFloatText(G.fx, p.x, p.y - 30, 'FARE CANCELLED — TOO SLOW', '#ff6a5a');
      taxi.state = 'idle';
      taxi.dest = null;
    }
  }
}

function updatePackages(G) {
  const p = G.player;
  if (p.inCar) return;
  for (const pack of G.activities.packages) {
    if (pack.taken) continue;
    if (Math.hypot(p.x - pack.x, p.y - pack.y) < 30) {
      pack.taken = true;
      G.activities.packagesFound++;
      p.cash += TUNING.packageReward;
      G.stats.packages++;
      spawnFloatText(G.fx, p.x, p.y - 30, `PACKAGE ${G.activities.packagesFound}/10  +$${TUNING.packageReward}`, '#ffd76a');
      spawnParticles(G.fx, pack.x, pack.y, { count: 14, color: '#ffd76a', speed: 110, life: 0.7, size: 4 });
      G.audio.cash();
    }
  }
}

function updateJumps(G, dt) {
  G.activities.jumpCooldown = Math.max(0, G.activities.jumpCooldown - dt);
  const p = G.player;
  if (!p.inCar || G.activities.jumpCooldown > 0) return;
  const car = p.inCar;
  const speed = Math.hypot(car.vx, car.vy);
  for (const ramp of JUMP_RAMPS) {
    if (Math.hypot(car.x - ramp.x, car.y - ramp.y) < 46 && speed > 240) {
      G.activities.jumpCooldown = 3;
      car.airTime = 0.85;
      car.airPeak = 26;
      const first = !G.activities.jumpsDone.has(ramp.label);
      G.activities.jumpsDone.add(ramp.label);
      if (first) {
        p.cash += TUNING.jumpReward;
        G.stats.jumps++;
        spawnFloatText(G.fx, car.x, car.y - 40, `STUNT JUMP: ${ramp.label}  +$${TUNING.jumpReward}`, '#ffd76a');
        G.audio.cash();
      } else {
        spawnFloatText(G.fx, car.x, car.y - 40, `STUNT JUMP: ${ramp.label}`, '#ffffff');
      }
      spawnParticles(G.fx, car.x, car.y, { count: 10, color: '#e8ddc0', speed: 90, life: 0.5, size: 4 });
    }
  }
}

export function updateActivities(G, dt) {
  updateTaxi(G, dt);
  updatePackages(G);
  updateJumps(G, dt);
}

export function taxiObjective(G) {
  const taxi = G.activities.taxi;
  if (taxi.state === 'toPickup' && taxi.passenger) {
    return { x: taxi.passenger.x, y: taxi.passenger.y, text: 'Pick up the fare', kind: 'taxi' };
  }
  if (taxi.state === 'toDest' && taxi.dest) {
    return { x: taxi.dest.x, y: taxi.dest.y, text: `Drop off: ${taxi.dest.label} (${Math.ceil(taxi.timer)}s)`, kind: 'taxi' };
  }
  return null;
}
