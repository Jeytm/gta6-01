// Pedestrians: civilians strolling the sidewalks, gang members who fight the
// player, and foot cops. Civilians flee gunfire and speeding cars; armed peds
// take aim and shoot when they have line of sight.

import { TUNING } from './config.js';
import { moveWithCollision, randomSidewalkPoint, cityCollides } from './city.js';
import { randomPick, randomRange } from './random.js';
import { spawnBlood, spawnFloatText } from './effects.js';

const SHIRTS = ['#d85a7a', '#4a6fa5', '#e8b23a', '#3f8f7a', '#8a5aa8', '#e8e4da', '#c94f42', '#5a7a3a'];
const SKINS = ['#f0c8a0', '#c98d5e', '#8a5a3a', '#6b4423', '#e8b88a'];

let nextPedId = 1;

export function createPed(x, y, kind = 'civilian') {
  return {
    id: nextPedId++,
    kind, // civilian | gang | cop | driver
    x, y,
    angle: Math.random() * Math.PI * 2,
    speed: 0,
    hp: kind === 'gang' ? 60 : kind === 'cop' ? 50 : 30,
    maxHp: kind === 'gang' ? 60 : kind === 'cop' ? 50 : 30,
    shirt: kind === 'cop' ? '#2a3a5c' : kind === 'gang' ? '#3a2a4a' : randomPick(Math.random, SHIRTS),
    skin: randomPick(Math.random, SKINS),
    target: null,
    waitTimer: 0,
    fleeTimer: 0,
    fleeFrom: null,
    fireCooldown: randomRange(Math.random, 0.4, 1.2),
    dead: false,
    deathTimer: 0,
    walkPhase: Math.random() * Math.PI * 2,
    weapon: kind === 'civilian' ? null : 'pistol',
    dropAmmo: kind !== 'civilian',
  };
}

export function spawnPeds(G, count) {
  for (let i = 0; i < count; i++) {
    const point = randomSidewalkPoint(G.city, G.rng);
    const ped = createPed(point.x, point.y, 'civilian');
    G.peds.push(ped);
  }
}

export function damagePed(G, ped, amount, fromPlayer) {
  if (ped.dead) return;
  ped.hp -= amount;
  spawnBlood(G.fx, ped.x, ped.y);
  if (ped.hp <= 0) {
    ped.dead = true;
    ped.deathTimer = 6;
    G.stats.kills++;
    if (ped.kind === 'civilian' && fromPlayer) {
      G.wanted.addStars(1, 'ped down');
    }
    if (ped.kind === 'gang' && fromPlayer) {
      G.stats.gangDown++;
      spawnFloatText(G.fx, ped.x, ped.y - 20, '+$40', '#8ae08a');
      G.player.cash += 40;
    }
    if (ped.dropAmmo && fromPlayer && Math.random() < 0.6) {
      G.pickups.push({ x: ped.x, y: ped.y, kind: 'ammo', amount: 30, life: 30 });
    }
  } else if (ped.kind === 'civilian') {
    ped.fleeTimer = 4;
    ped.fleeFrom = { x: G.player.x, y: G.player.y };
  }
}

function pedSeesThreat(G, ped) {
  // Gunfire and explosions near a civilian send them running.
  if (G.lastGunshot && Math.hypot(ped.x - G.lastGunshot.x, ped.y - G.lastGunshot.y) < 420) return G.lastGunshot;
  return null;
}

function updateCivilian(G, ped, dt) {
  const threat = pedSeesThreat(G, ped);
  if (threat) {
    ped.fleeTimer = 3;
    ped.fleeFrom = threat;
  }
  if (ped.fleeTimer > 0) {
    ped.fleeTimer -= dt;
    const away = Math.atan2(ped.y - ped.fleeFrom.y, ped.x - ped.fleeFrom.x);
    ped.angle = away;
    const speed = 210;
    const moved = moveWithCollision(G.city, ped.x, ped.y, Math.cos(away) * speed * dt, Math.sin(away) * speed * dt, 10);
    ped.x = moved.x;
    ped.y = moved.y;
    ped.speed = speed;
    ped.walkPhase += dt * 11;
    return;
  }
  if (ped.waitTimer > 0) {
    ped.waitTimer -= dt;
    ped.speed = 0;
    return;
  }
  if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 24) {
    ped.target = randomSidewalkPoint(G.city, G.rng);
    if (Math.random() < 0.3) ped.waitTimer = randomRange(Math.random, 1, 4);
  }
  const angle = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
  ped.angle = angle;
  const speed = 62;
  const moved = moveWithCollision(G.city, ped.x, ped.y, Math.cos(angle) * speed * dt, Math.sin(angle) * speed * dt, 10);
  ped.x = moved.x;
  ped.y = moved.y;
  ped.speed = moved.hit ? 0 : speed;
  ped.walkPhase += dt * 7;
  if (moved.hit) ped.target = null;
}

function updateFighter(G, ped, dt) {
  // Gang members and foot cops close in on the player and shoot.
  const dx = G.player.x - ped.x;
  const dy = G.player.y - ped.y;
  const dist = Math.hypot(dx, dy);
  const wantRange = ped.kind === 'cop' ? 260 : 210;
  ped.angle = Math.atan2(dy, dx);
  if (dist > wantRange) {
    const speed = ped.kind === 'cop' ? 195 : 165;
    const moved = moveWithCollision(G.city, ped.x, ped.y, Math.cos(ped.angle) * speed * dt, Math.sin(ped.angle) * speed * dt, 10);
    ped.x = moved.x;
    ped.y = moved.y;
    ped.speed = speed;
    ped.walkPhase += dt * 10;
  } else {
    // Strafe sideways so a group does not stack on one spot.
    const strafe = ped.angle + Math.PI / 2 * (ped.id % 2 === 0 ? 1 : -1);
    const moved = moveWithCollision(G.city, ped.x, ped.y, Math.cos(strafe) * 40 * dt, Math.sin(strafe) * 40 * dt, 10);
    ped.x = moved.x;
    ped.y = moved.y;
    ped.speed = 40;
    ped.walkPhase += dt * 6;
  }
  ped.fireCooldown -= dt;
  if (ped.fireCooldown <= 0 && dist < 420 && !G.player.dead) {
    ped.fireCooldown = randomRange(Math.random, 0.7, 1.4);
    G.combat.enemyShoot(G, ped);
  }
}

export function updatePeds(G, dt) {
  let civilians = 0;
  for (let i = G.peds.length - 1; i >= 0; i--) {
    const ped = G.peds[i];
    if (ped.dead) {
      ped.deathTimer -= dt;
      if (ped.deathTimer <= 0) G.peds.splice(i, 1);
      continue;
    }
    if (ped.kind === 'civilian') {
      civilians++;
      updateCivilian(G, ped, dt);
      // Run over by a fast car.
      for (const v of G.vehicles) {
        if (v.dead) continue;
        const speed = Math.hypot(v.vx, v.vy);
        if (speed > 90 && Math.hypot(v.x - ped.x, v.y - ped.y) < 30) {
          damagePed(G, ped, 100, v.driver === 'player');
          break;
        }
      }
      // Too far from the player: recycle.
      if (Math.hypot(ped.x - G.player.x, ped.y - G.player.y) > 1800) {
        const point = randomSidewalkPoint(G.city, G.rng);
        ped.x = point.x;
        ped.y = point.y;
        ped.target = null;
      }
    } else {
      updateFighter(G, ped, dt);
      if (Math.hypot(ped.x - G.player.x, ped.y - G.player.y) > 2200) {
        G.peds.splice(i, 1);
      }
    }
  }
  while (civilians < TUNING.pedCount) {
    const point = randomSidewalkPoint(G.city, G.rng);
    if (Math.hypot(point.x - G.player.x, point.y - G.player.y) < 1400) {
      G.peds.push(createPed(point.x, point.y, 'civilian'));
    }
    civilians++;
  }
}

// A straight ray check for gunfire: true when no building blocks the shot.
export function hasLineOfSight(city, x1, y1, x2, y2) {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.ceil(dist / 26);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (cityCollides(city, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 3)) return false;
  }
  return true;
}
