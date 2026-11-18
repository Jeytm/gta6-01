// Shooting, melee, bullets and pickups. Bullets are fast projectiles that stop
// at walls, cars and people; enemy fire only comes from peds with line of
// sight, so cover genuinely works.

import { WEAPONS } from './config.js';
import { cityCollides } from './city.js';
import { damagePed, hasLineOfSight } from './pedestrians.js';
import { damageVehicle } from './vehicles.js';
import { damagePlayer } from './player.js';
import { spawnParticles, spawnSparks, spawnBlood, spawnFloatText } from './effects.js';

function spawnBullet(G, x, y, angle, def, from) {
  const speed = def.bulletSpeed;
  G.bullets.push({
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    damage: def.damage,
    rangeLeft: def.range,
    from, // 'player' | 'enemy'
  });
}

export function fireWeapon(G) {
  const p = G.player;
  const def = WEAPONS[p.weapon];
  if (p.weapon === 'smg' && p.ammo.smg <= 0) {
    G.audio.click();
    p.weapon = 'pistol';
    return;
  }
  if (p.weapon === 'shotgun' && p.ammo.shotgun <= 0) {
    G.audio.click();
    p.weapon = 'pistol';
    return;
  }
  if (p.weapon === 'smg') p.ammo.smg--;
  if (p.weapon === 'shotgun') p.ammo.shotgun--;
  p.fireCooldown = def.rate;

  const pellets = def.pellets ?? 1;
  const muzzleX = p.x + Math.cos(p.aimAngle) * 22;
  const muzzleY = p.y + Math.sin(p.aimAngle) * 22;
  for (let i = 0; i < pellets; i++) {
    const angle = p.aimAngle + (Math.random() - 0.5) * 2 * def.spread;
    spawnBullet(G, muzzleX, muzzleY, angle, def, 'player');
  }
  spawnParticles(G.fx, muzzleX, muzzleY, { count: 3, color: '#ffd76a', speed: 60, life: 0.08, size: 4, spread: 0.9, angle: p.aimAngle });
  G.audio.shoot(p.weapon);
  G.lastGunshot = { x: p.x, y: p.y, time: G.time };
  G.wanted.noiseCheck(1);
}

export function meleeAttack(G) {
  const p = G.player;
  if (p.punchTimer > 0) return;
  p.punchTimer = WEAPONS.fists.rate;
  p.fireCooldown = WEAPONS.fists.rate;
  G.audio.punch();
  const reach = WEAPONS.fists.range;
  const hx = p.x + Math.cos(p.aimAngle) * reach;
  const hy = p.y + Math.sin(p.aimAngle) * reach;
  let hitSomething = false;
  for (const ped of G.peds) {
    if (ped.dead) continue;
    if (Math.hypot(ped.x - hx, ped.y - hy) < 30) {
      damagePed(G, ped, WEAPONS.fists.damage, true);
      ped.x += Math.cos(p.aimAngle) * 8;
      ped.y += Math.sin(p.aimAngle) * 8;
      hitSomething = true;
    }
  }
  for (const v of G.vehicles) {
    if (v.dead) continue;
    if (Math.hypot(v.x - hx, v.y - hy) < v.spec.len * 0.5) {
      damageVehicle(G, v, 6, true);
      hitSomething = true;
    }
  }
  if (hitSomething) spawnParticles(G.fx, hx, hy, { count: 4, color: '#e8e4da', speed: 70, life: 0.25, size: 3 });
}

export function enemyShoot(G, ped) {
  const p = G.player;
  if (!hasLineOfSight(G.city, ped.x, ped.y, p.x, p.y)) return;
  const dist = Math.hypot(p.x - ped.x, p.y - ped.y);
  const aimError = 0.09 + dist * 0.00012;
  const angle = Math.atan2(p.y - ped.y, p.x - ped.x) + (Math.random() - 0.5) * 2 * aimError;
  const def = WEAPONS.pistol;
  spawnBullet(G, ped.x + Math.cos(angle) * 20, ped.y + Math.sin(angle) * 20, angle, { ...def, damage: 8 }, 'enemy');
  spawnParticles(G.fx, ped.x + Math.cos(angle) * 20, ped.y + Math.sin(angle) * 20, { count: 2, color: '#ffd76a', speed: 50, life: 0.07, size: 3 });
  if (dist < 700) G.audio.shoot('pistol');
}

function bulletHitsVehicle(G, bullet) {
  for (const v of G.vehicles) {
    if (v.dead || v.exploded) continue;
    if (bullet.from === 'player' && v === G.player.inCar) continue;
    const dx = bullet.x - v.x;
    const dy = bullet.y - v.y;
    // Rotate into the car's frame: an ellipse test along its length.
    const along = dx * Math.cos(v.angle) + dy * Math.sin(v.angle);
    const side = -dx * Math.sin(v.angle) + dy * Math.cos(v.angle);
    if (Math.abs(along) < v.spec.len / 2 && Math.abs(side) < v.spec.wid / 2 + 2) {
      damageVehicle(G, v, bullet.damage, bullet.from === 'player');
      spawnSparks(G.fx, bullet.x, bullet.y);
      return true;
    }
  }
  return false;
}

function bulletHitsPed(G, bullet) {
  for (const ped of G.peds) {
    if (ped.dead) continue;
    if (bullet.from === 'enemy' && ped.kind !== 'civilian') continue;
    if (Math.hypot(ped.x - bullet.x, ped.y - bullet.y) < 13) {
      damagePed(G, ped, bullet.damage, bullet.from === 'player');
      return true;
    }
  }
  return false;
}

export function updateBullets(G, dt) {
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    const step = Math.hypot(b.vx, b.vy) * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.rangeLeft -= step;
    let dead = b.rangeLeft <= 0;
    if (!dead && cityCollides(G.city, b.x, b.y, 2)) {
      spawnSparks(G.fx, b.x, b.y);
      dead = true;
    }
    if (!dead && bulletHitsVehicle(G, b)) dead = true;
    if (!dead && b.from === 'player' && bulletHitsPed(G, b)) dead = true;
    if (!dead && b.from === 'enemy') {
      const p = G.player;
      if (!p.inCar && Math.hypot(p.x - b.x, p.y - b.y) < 13) {
        damagePlayer(G, b.damage);
        spawnBlood(G.fx, p.x, p.y);
        dead = true;
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }
}

export function updatePickups(G, dt) {
  const p = G.player;
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const item = G.pickups[i];
    item.life -= dt;
    if (item.life <= 0) {
      G.pickups.splice(i, 1);
      continue;
    }
    if (!p.inCar && Math.hypot(p.x - item.x, p.y - item.y) < 26) {
      if (item.kind === 'ammo') {
        p.ammo.smg += item.amount;
        spawnFloatText(G.fx, p.x, p.y - 24, `+${item.amount} SMG`, '#ffd76a');
        if (!p.weaponsOwned.includes('smg')) p.weaponsOwned.push('smg');
      } else if (item.kind === 'health') {
        p.hp = Math.min(p.maxHp, p.hp + item.amount);
        spawnFloatText(G.fx, p.x, p.y - 24, `+${item.amount} HP`, '#8ae08a');
      } else if (item.kind === 'armor') {
        p.armor = Math.min(p.maxArmor, p.armor + item.amount);
        spawnFloatText(G.fx, p.x, p.y - 24, `+${item.amount} ARMOR`, '#7ab8e8');
      } else if (item.kind === 'cash') {
        p.cash += item.amount;
        spawnFloatText(G.fx, p.x, p.y - 24, `+$${item.amount}`, '#8ae08a');
      }
      G.audio.pickup();
      G.pickups.splice(i, 1);
    }
  }
}
