// Vehicles: arcade driving physics shared by the player, traffic and police,
// plus the traffic system that keeps the roads alive around the player.

import { WORLD, CAR_MODELS, TUNING } from './config.js';
import { moveWithCollision, isRoadAt, randomRoadPoint, roadLines } from './city.js';
import { randomPick, randomRange, randomChance } from './random.js';
import { spawnParticles, spawnSkid, spawnSmoke, spawnSparks, spawnExplosion, addShake } from './effects.js';

let nextVehicleId = 1;

export function createVehicle(modelKey, x, y, angle, color, driver = 'parked') {
  const spec = CAR_MODELS[modelKey];
  return {
    id: nextVehicleId++,
    model: modelKey,
    spec,
    x, y, angle,
    vx: 0, vy: 0,
    steer: 0,
    color: color ?? randomPick(Math.random, spec.colors),
    driver,
    health: spec.health,
    maxHealth: spec.health,
    burning: 0,
    dead: false,
    exploded: false,
    brakeLights: false,
    hornTimer: 0,
    airTime: 0,
    axis: 'x',
    dir: 1,
    lane: 16,
    targetSpeed: 120,
    waitTimer: 0,
    sirenPhase: Math.random() * Math.PI * 2,
    smokeTimer: 0,
  };
}

export function forwardSpeed(v) {
  return v.vx * Math.cos(v.angle) + v.vy * Math.sin(v.angle);
}

// One physics step for any driven car. throttle -1..1, steer -1..1.
export function driveVehicle(G, v, throttle, steer, handbrake, dt) {
  const spec = v.spec;
  const fx = Math.cos(v.angle);
  const fy = Math.sin(v.angle);
  let fwd = forwardSpeed(v);
  let lat = -v.vx * fy + v.vy * fx;

  if (throttle > 0) fwd += spec.accel * throttle * dt;
  else if (throttle < 0) {
    if (fwd > 12) fwd += spec.accel * 1.6 * throttle * dt; // braking
    else fwd += spec.reverse * throttle * dt * 2.2; // reverse
  }
  // Rolling drag and air drag.
  fwd -= fwd * 0.35 * dt;
  if (throttle === 0) fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), 60 * dt);
  fwd = Math.max(-spec.reverse, Math.min(spec.topSpeed, fwd));

  // Steering bites harder at low speed, less at full speed.
  const speedRatio = Math.abs(fwd) / spec.topSpeed;
  const steerAuthority = spec.turn * (1.15 - 0.6 * speedRatio) * (fwd >= 0 ? 1 : -1);
  v.angle += steer * steerAuthority * Math.min(1, Math.abs(fwd) / 60) * dt;
  v.steer = steer;

  // Lateral grip: handbrake slides the car.
  const grip = handbrake ? spec.grip * 0.22 : spec.grip;
  lat *= Math.exp(-grip * dt);
  if (handbrake && Math.abs(fwd) > 90) {
    fwd *= 1 - 0.5 * dt;
    const rearX = v.x - Math.cos(v.angle) * spec.len * 0.32;
    const rearY = v.y - Math.sin(v.angle) * spec.len * 0.32;
    spawnSkid(G.fx, rearX, rearY, v.angle);
    spawnSmoke(G.fx, rearX, rearY);
  }

  const nx = Math.cos(v.angle);
  const ny = Math.sin(v.angle);
  v.vx = nx * fwd - ny * lat;
  v.vy = ny * fwd + nx * lat;
  v.brakeLights = throttle < 0 && fwd > 12;

  const radius = spec.len * 0.42;
  if (v.airTime > 0) {
    // Mid-jump: the car flies free over fences and traffic, then lands.
    v.airTime -= dt;
    v.x = Math.max(radius, Math.min(WORLD.size - radius, v.x + v.vx * dt));
    v.y = Math.max(radius, Math.min(WORLD.size - radius, v.y + v.vy * dt));
    if (v.airTime <= 0) {
      addShake(G.fx, 4);
      spawnSmoke(G.fx, v.x, v.y);
      G.audio.crash(0.25);
    }
  } else {
    const moved = moveWithCollision(G.city, v.x, v.y, v.vx * dt, v.vy * dt, radius);
    if (moved.hit) {
      const impact = Math.hypot(v.vx, v.vy);
      if (impact > 130) {
        damageVehicle(G, v, impact * 0.045, false);
        G.audio.crash(impact / 400);
        addShake(G.fx, Math.min(10, impact / 45));
        spawnSparks(G.fx, moved.x + nx * spec.len * 0.4, moved.y + ny * spec.len * 0.4);
      }
      v.vx *= 0.35;
      v.vy *= 0.35;
    }
    v.x = moved.x;
    v.y = moved.y;
  }

  if (v.health < v.maxHealth * 0.35 && !v.dead) {
    v.smokeTimer -= dt;
    if (v.smokeTimer <= 0) {
      v.smokeTimer = 0.12;
      spawnSmoke(G.fx, v.x + nx * spec.len * 0.35, v.y + ny * spec.len * 0.35, true);
    }
  }
}

export function damageVehicle(G, v, amount, fromPlayer) {
  if (v.dead) return;
  v.health -= amount;
  if (v.health <= 0) {
    v.health = 0;
    v.dead = true;
    v.burning = 2.2;
    if (fromPlayer) G.stats.carsDestroyed++;
  }
}

// Traffic: cars cruise the road grid, turn at intersections, brake for the
// car ahead, and respawn near the player when they wander too far away.
export function spawnTrafficCar(G, nearPlayer = true) {
  const rng = G.rng;
  const models = ['sedan', 'sedan', 'coupe', 'van', 'taxi', 'truck', 'muscle'];
  const model = randomPick(rng, models);
  let point;
  if (nearPlayer) {
    for (let tries = 0; tries < 12; tries++) {
      point = randomRoadPoint(G.city, rng);
      const d = Math.hypot(point.x - G.player.x, point.y - G.player.y);
      if (d > 500 && d < 1500) break;
    }
  } else {
    point = randomRoadPoint(G.city, rng);
  }
  const horizontal = isRoadAt(point.x + 40, point.y) && !isRoadAt(point.x, point.y + 40)
    ? true
    : randomChance(rng, 0.5);
  const axis = horizontal ? 'x' : 'y';
  const dir = randomChance(rng, 0.5) ? 1 : -1;
  const lane = 16;
  const car = createVehicle(model, point.x, point.y, axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2), undefined, 'traffic');
  car.axis = axis;
  car.dir = dir;
  car.lane = lane;
  car.targetSpeed = randomRange(rng, 105, 150);
  if (axis === 'x') car.y += dir > 0 ? lane : -lane;
  else car.x += dir > 0 ? -lane : lane;
  G.vehicles.push(car);
  return car;
}

export function spawnParkedCars(G, count) {
  const rng = G.rng;
  for (let i = 0; i < count; i++) {
    const point = randomRoadPoint(G.city, rng);
    const horizontal = randomChance(rng, 0.5);
    const dir = randomChance(rng, 0.5) ? 1 : -1;
    const edge = WORLD.roadWidth / 2 - 14;
    const x = horizontal ? point.x : point.x + dir * edge;
    const y = horizontal ? point.y + dir * edge : point.y;
    const angle = horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const model = randomPick(rng, ['sedan', 'sedan', 'coupe', 'van', 'muscle', 'taxi']);
    const car = createVehicle(model, x, y, angle, undefined, 'parked');
    G.vehicles.push(car);
  }
}

function vehicleAhead(G, car, lookAhead) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let nearest = Infinity;
  for (const other of G.vehicles) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * fx + dy * fy;
    const side = Math.abs(-dx * fy + dy * fx);
    if (along > 0 && along < lookAhead && side < 30) nearest = Math.min(nearest, along);
  }
  // Also brake for the player on foot in front of the car.
  if (!G.player.inCar) {
    const dx = G.player.x - car.x;
    const dy = G.player.y - car.y;
    const along = dx * fx + dy * fy;
    const side = Math.abs(-dx * fy + dy * fx);
    if (along > 0 && along < lookAhead && side < 26) nearest = Math.min(nearest, along);
  }
  return nearest;
}

function updateTrafficCar(G, car, dt) {
  const lines = roadLines();
  const half = WORLD.roadWidth / 2;
  // At an intersection, sometimes turn onto the crossing road.
  const nearX = lines.find((l) => Math.abs(car.x - l) < 6);
  const nearY = lines.find((l) => Math.abs(car.y - l) < 6);
  if (nearX !== undefined && nearY !== undefined && car.waitTimer <= 0) {
    car.waitTimer = 1.2;
    const roll = G.rng();
    if (roll < 0.22) {
      // Turn left or right.
      const turn = roll < 0.11 ? 1 : -1;
      if (car.axis === 'x') {
        car.axis = 'y';
        car.dir = car.dir * turn;
      } else {
        car.axis = 'x';
        car.dir = -car.dir * turn;
      }
    } else if (roll < 0.27) {
      car.dir *= -1; // U-turn, rarely
    }
  }
  car.waitTimer -= dt;

  // Steer back onto the lane centre line.
  let targetAngle;
  if (car.axis === 'x') {
    const line = lines.reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a));
    const laneY = line + (car.dir > 0 ? car.lane : -car.lane);
    const want = car.dir > 0 ? 0 : Math.PI;
    targetAngle = want + Math.max(-0.5, Math.min(0.5, (laneY - car.y) * 0.01)) * car.dir;
    if (car.y < line - half || car.y > line + half) targetAngle = want;
  } else {
    const line = lines.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a));
    const laneX = line + (car.dir > 0 ? -car.lane : car.lane);
    const want = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    targetAngle = want + Math.max(-0.5, Math.min(0.5, (laneX - car.x) * 0.01)) * -car.dir;
    if (car.x < line - half || car.x > line + half) targetAngle = want;
  }
  let diff = targetAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));

  const ahead = vehicleAhead(G, car, 110);
  let throttle = 0.55;
  if (ahead < 70) throttle = ahead < 42 ? -0.8 : 0;
  else if (forwardSpeed(car) > car.targetSpeed) throttle = 0;
  driveVehicle(G, car, throttle, steer, false, dt);
}

export function updateTraffic(G, dt) {
  let traffic = 0;
  for (const v of G.vehicles) {
    if (v.driver === 'traffic') traffic++;
  }
  for (let i = G.vehicles.length - 1; i >= 0; i--) {
    const v = G.vehicles[i];
    if (v.driver === 'traffic') {
      const d = Math.hypot(v.x - G.player.x, v.y - G.player.y);
      if (d > 1700 || v.exploded) {
        G.vehicles.splice(i, 1);
        traffic--;
        continue;
      }
      updateTrafficCar(G, v, dt);
    }
  }
  while (traffic < TUNING.trafficCount) {
    spawnTrafficCar(G, true);
    traffic++;
  }
}

export function updateBurningVehicles(G, dt) {
  for (const v of G.vehicles) {
    if (v.burning > 0) {
      v.burning -= dt;
      spawnSmoke(G.fx, v.x, v.y, true);
      if (Math.random() < 0.3) {
        spawnParticles(G.fx, v.x, v.y, { count: 2, color: '#ff9a3d', speed: 40, life: 0.4, size: 6, gravity: -30 });
      }
      if (v.burning <= 0 && !v.exploded) {
        v.exploded = true;
        G.audio.explosion();
        spawnExplosion(G.fx, v.x, v.y);
        // Splash damage to anyone close.
        const blast = 130;
        if (Math.hypot(G.player.x - v.x, G.player.y - v.y) < blast && !G.player.inCar) {
          G.player.hp -= 45;
        }
        for (const other of G.vehicles) {
          if (other !== v && Math.hypot(other.x - v.x, other.y - v.y) < blast) damageVehicle(G, other, 55, false);
        }
      }
    }
  }
}

// Cars the player just stepped out of keep rolling, then settle as parked.
export function updateLooseVehicles(G, dt) {
  for (const v of G.vehicles) {
    if (v.driver !== 'coast' || v.dead) continue;
    v.vx *= 1 - 1.4 * dt;
    v.vy *= 1 - 1.4 * dt;
    const moved = moveWithCollision(G.city, v.x, v.y, v.vx * dt, v.vy * dt, v.spec.len * 0.42);
    if (moved.hit) {
      v.vx *= 0.3;
      v.vy *= 0.3;
    }
    v.x = moved.x;
    v.y = moved.y;
    if (Math.hypot(v.vx, v.vy) < 8) {
      v.vx = 0;
      v.vy = 0;
      v.driver = 'parked';
    }
  }
}

export function nearestVehicle(G, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const v of G.vehicles) {
    if (v.dead || v.exploded) continue;
    const d = Math.hypot(v.x - x, v.y - y);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}
