// The wanted system and the Solmarina City Police Department: stars rise with
// crimes, police cars pursue and ram, foot cops chase and shoot, and staying
// out of sight lets the heat cool off one star at a time.

import { TUNING } from './config.js';
import { createVehicle, driveVehicle, forwardSpeed } from './vehicles.js';
import { createPed, hasLineOfSight } from './pedestrians.js';
import { randomRoadPoint } from './city.js';
import { spawnFloatText } from './effects.js';

export function createWanted(G) {
  const wanted = {
    stars: 0,
    evadeTimer: 0,
    evading: false,
    heatCooldown: 0,
    bustedTimer: 0,
    addStars(n, reason) {
      const before = wanted.stars;
      wanted.stars = Math.max(0, Math.min(5, wanted.stars + n));
      wanted.evadeTimer = 0;
      if (wanted.stars > before) {
        G.audio.wantedUp();
        spawnFloatText(G.fx, G.player.x, G.player.y - 40, `${'★'.repeat(wanted.stars)} ${reason ?? ''}`, '#ff6a5a');
      }
    },
    clear(reason) {
      wanted.stars = 0;
      wanted.evadeTimer = 0;
      wanted.evading = false;
      if (reason) spawnFloatText(G.fx, G.player.x, G.player.y - 40, reason, '#8ae08a');
    },
    // Gunfire near police draws attention, at most once every few seconds.
    noiseCheck(n) {
      if (wanted.heatCooldown > 0) return;
      for (const v of G.vehicles) {
        if (v.driver === 'police' && Math.hypot(v.x - G.player.x, v.y - G.player.y) < 520) {
          wanted.addStars(n, 'shots fired');
          wanted.heatCooldown = 5;
          return;
        }
      }
      for (const ped of G.peds) {
        if (ped.kind === 'cop' && !ped.dead && Math.hypot(ped.x - G.player.x, ped.y - G.player.y) < 420) {
          wanted.addStars(n, 'shots fired');
          wanted.heatCooldown = 5;
          return;
        }
      }
    },
  };
  return wanted;
}

function policeCanSee(G) {
  const p = G.player;
  for (const v of G.vehicles) {
    if (v.driver !== 'police' || v.dead) continue;
    const d = Math.hypot(v.x - p.x, v.y - p.y);
    if (d < 700 && hasLineOfSight(G.city, v.x, v.y, p.x, p.y)) return true;
  }
  for (const ped of G.peds) {
    if (ped.kind !== 'cop' || ped.dead) continue;
    const d = Math.hypot(ped.x - p.x, ped.y - p.y);
    if (d < 480 && hasLineOfSight(G.city, ped.x, ped.y, p.x, p.y)) return true;
  }
  return false;
}

function spawnPoliceCar(G) {
  const rng = G.rng;
  let point = randomRoadPoint(G.city, rng);
  for (let tries = 0; tries < 10; tries++) {
    const candidate = randomRoadPoint(G.city, rng);
    const d = Math.hypot(candidate.x - G.player.x, candidate.y - G.player.y);
    if (d > 480 && d < 1100) {
      point = candidate;
      break;
    }
  }
  const angle = Math.atan2(G.player.y - point.y, G.player.x - point.x);
  const car = createVehicle('police', point.x, point.y, angle, undefined, 'police');
  car.unstickTimer = 0;
  G.vehicles.push(car);
  return car;
}

function spawnFootCop(G) {
  const angle = Math.random() * Math.PI * 2;
  const dist = 420 + Math.random() * 160;
  const x = G.player.x + Math.cos(angle) * dist;
  const y = G.player.y + Math.sin(angle) * dist;
  const cop = createPed(x, y, 'cop');
  G.peds.push(cop);
  return cop;
}

function updatePoliceCar(G, car, dt) {
  const p = G.player;
  // Aim slightly ahead of a moving player.
  const lead = 0.35;
  const tx = p.x + (p.inCar ? p.inCar.vx * lead : 0);
  const ty = p.y + (p.inCar ? p.inCar.vy * lead : 0);
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.4));
  const dist = Math.hypot(tx - car.x, ty - car.y);
  let throttle = 1;
  if (!p.inCar && dist < 55) throttle = 0.2; // pull up beside a runner
  // Unstick: if pushing hard but barely moving, reverse out and turn.
  car.unstickTimer = (car.unstickTimer ?? 0) + dt;
  if (Math.abs(forwardSpeed(car)) < 25 && throttle > 0.5) {
    if (car.unstickTimer > 1.4) {
      car.reverseTimer = 0.8;
      car.unstickTimer = 0;
    }
  } else {
    car.unstickTimer = 0;
  }
  if (car.reverseTimer > 0) {
    car.reverseTimer -= dt;
    driveVehicle(G, car, -1, -steer, false, dt);
  } else {
    driveVehicle(G, car, throttle, steer, false, dt);
  }
  car.sirenPhase += dt * 6;
  // Ramming the player's car damages it.
  if (p.inCar && Math.hypot(car.x - p.inCar.x, car.y - p.inCar.y) < 46) {
    const impact = Math.hypot(car.vx - p.inCar.vx, car.vy - p.inCar.vy);
    if (impact > 120) {
      p.inCar.health -= impact * 0.02;
    }
  }
}

export function updatePolice(G, dt) {
  const wanted = G.wanted;
  wanted.heatCooldown = Math.max(0, wanted.heatCooldown - dt);

  let copCars = 0;
  let footCops = 0;
  for (const v of G.vehicles) if (v.driver === 'police' && !v.dead) copCars++;
  for (const ped of G.peds) if (ped.kind === 'cop' && !ped.dead) footCops++;

  if (wanted.stars === 0) {
    // Stand down: police cruise away and despawn.
    for (let i = G.vehicles.length - 1; i >= 0; i--) {
      const v = G.vehicles[i];
      if (v.driver === 'police') {
        const d = Math.hypot(v.x - G.player.x, v.y - G.player.y);
        if (d > 900 || v.dead) G.vehicles.splice(i, 1);
        else driveVehicle(G, v, 0.4, 0, false, dt);
      }
    }
    for (let i = G.peds.length - 1; i >= 0; i--) {
      if (G.peds[i].kind === 'cop') G.peds.splice(i, 1);
    }
    G.audio.setSiren(false);
    return;
  }

  const wantCars = Math.min(5, wanted.stars + (wanted.stars >= 3 ? 1 : 0));
  while (copCars < wantCars) {
    spawnPoliceCar(G);
    copCars++;
  }
  if (wanted.stars >= 2 && !G.player.inCar) {
    const wantCops = Math.min(4, wanted.stars);
    while (footCops < wantCops) {
      spawnFootCop(G);
      footCops++;
    }
  }
  G.audio.setSiren(copCars > 0);

  for (const v of G.vehicles) {
    if (v.driver === 'police' && !v.dead) {
      const d = Math.hypot(v.x - G.player.x, v.y - G.player.y);
      if (d > 2400) {
        v.x = G.player.x + (Math.random() - 0.5) * 1400;
        v.y = G.player.y + (Math.random() - 0.5) * 1400;
      }
      updatePoliceCar(G, v, dt);
    }
  }

  // Evade: unseen for long enough, one star cools off.
  const seen = policeCanSee(G);
  wanted.evading = !seen;
  if (seen) {
    wanted.evadeTimer = 0;
  } else {
    wanted.evadeTimer += dt;
    if (wanted.evadeTimer >= TUNING.evadeSeconds) {
      wanted.evadeTimer = 0;
      wanted.stars = Math.max(0, wanted.stars - 1);
      spawnFloatText(G.fx, G.player.x, G.player.y - 40, wanted.stars === 0 ? 'YOU LOST THEM' : 'HEAT COOLING…', '#8ae08a');
    }
  }

  // Busted: on foot, slow, and a cop right on top of you.
  if (!G.player.inCar && !G.player.dead) {
    let cornered = false;
    for (const v of G.vehicles) {
      if (v.driver === 'police' && !v.dead && Math.hypot(v.x - G.player.x, v.y - G.player.y) < 58) cornered = true;
    }
    for (const ped of G.peds) {
      if (ped.kind === 'cop' && !ped.dead && Math.hypot(ped.x - G.player.x, ped.y - G.player.y) < 48) cornered = true;
    }
    if (cornered && !G.player.moving) {
      wanted.bustedTimer += dt;
      if (wanted.bustedTimer > 2.2) {
        wanted.bustedTimer = 0;
        G.events.busted();
      }
    } else {
      wanted.bustedTimer = 0;
    }
  }
}
