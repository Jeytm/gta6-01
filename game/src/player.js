// Mara Quinn on foot: movement, aiming, entering and leaving cars, health and
// armour. Driving itself lives in vehicles.js; shooting lives in combat.js.

import { TUNING, WEAPONS, CAR_MODELS } from './config.js';
import { moveWithCollision } from './city.js';
import { nearestVehicle } from './vehicles.js';
import { spawnFloatText, damageFlash } from './effects.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    vx: 0, vy: 0,
    hp: TUNING.playerHealth,
    maxHp: TUNING.playerHealth,
    armor: 0,
    maxArmor: TUNING.playerArmor,
    cash: TUNING.startCash,
    weapon: 'pistol',
    weaponsOwned: ['fists', 'pistol'],
    ammo: { smg: 0, shotgun: 0 },
    inCar: null,
    fireCooldown: 0,
    punchTimer: 0,
    sprinting: false,
    moving: false,
    walkPhase: 0,
    dead: false,
    enterCooldown: 0,
    aimAngle: -Math.PI / 2,
  };
}

export function giveWeapon(player, key) {
  if (!player.weaponsOwned.includes(key)) player.weaponsOwned.push(key);
  player.weapon = key;
  if (key === 'smg') player.ammo.smg = Math.max(player.ammo.smg, WEAPONS.smg.ammo);
  if (key === 'shotgun') player.ammo.shotgun = Math.max(player.ammo.shotgun, WEAPONS.shotgun.ammo);
}

export function damagePlayer(G, amount) {
  const p = G.player;
  if (p.dead) return;
  let rest = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, rest * 0.6);
    p.armor -= absorbed;
    rest -= absorbed;
  }
  p.hp -= rest;
  damageFlash(G.fx);
  if (p.hp <= 0) {
    p.hp = 0;
    p.dead = true;
  }
}

export function healPlayer(G, amount) {
  const p = G.player;
  p.hp = Math.min(p.maxHp, p.hp + amount);
}

function tryEnterCar(G) {
  const p = G.player;
  const car = nearestVehicle(G, p.x, p.y, 78);
  if (!car) return;
  if (car.driver === 'traffic') {
    // Carjacking an occupied car: the driver bails and it draws heat.
    car.driver = 'player';
    G.wanted.addStars(1, 'carjacking');
    spawnFloatText(G.fx, car.x, car.y - 30, 'CARJACKED!', '#ffb347');
    G.audio.wantedUp();
  } else if (car.driver === 'police') {
    car.driver = 'player';
    G.wanted.addStars(2, 'stole a police car');
    spawnFloatText(G.fx, car.x, car.y - 30, 'STOLE A COP CAR!', '#ffb347');
  } else {
    car.driver = 'player';
    spawnFloatText(G.fx, car.x, car.y - 30, CAR_MODELS[car.model].name, '#ffffff');
  }
  p.inCar = car;
  p.x = car.x;
  p.y = car.y;
  G.audio.click();
  G.stats.carsStolen++;
}

function exitCar(G) {
  const p = G.player;
  const car = p.inCar;
  if (!car) return;
  const side = car.angle + Math.PI / 2;
  const px = car.x + Math.cos(side) * 34;
  const py = car.y + Math.sin(side) * 34;
  const spot = moveWithCollision(G.city, car.x, car.y, px - car.x, py - car.y, 10);
  p.x = spot.x;
  p.y = spot.y;
  p.inCar = null;
  car.driver = 'coast';
  p.enterCooldown = 0.5;
  G.audio.click();
}

export function updatePlayer(G, dt) {
  const p = G.player;
  const input = G.input;
  if (p.dead) return;
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.enterCooldown = Math.max(0, p.enterCooldown - dt);
  p.punchTimer = Math.max(0, p.punchTimer - dt);

  if (p.inCar) {
    // Driving: throttle, steering and handbrake go to the car.
    const throttle = (input.axis('up') ? 1 : 0) - (input.axis('down') ? 1 : 0);
    const steer = (input.axis('left') ? -1 : 0) + (input.axis('right') ? 1 : 0);
    const handbrake = input.axis('handbrake');
    G.vehiclesDrive(G, p.inCar, throttle, steer, handbrake, dt);
    p.x = p.inCar.x;
    p.y = p.inCar.y;
    p.angle = p.inCar.angle;
    G.audio.setEngine(Math.abs(p.inCar.vx * Math.cos(p.inCar.angle) + p.inCar.vy * Math.sin(p.inCar.angle)) / p.inCar.spec.topSpeed, true);
    if (input.wasPressed('enter') && p.enterCooldown <= 0) exitCar(G);
    if (input.wasPressed('horn')) G.audio.horn();
    return;
  }

  G.audio.setEngine(0, false);

  // On foot: WASD moves, the mouse aims.
  const mx = (input.axis('right') ? 1 : 0) - (input.axis('left') ? 1 : 0);
  const my = (input.axis('down') ? 1 : 0) - (input.axis('up') ? 1 : 0);
  const sprinting = input.axis('sprint') && (mx !== 0 || my !== 0);
  p.sprinting = sprinting;
  const speed = sprinting ? TUNING.sprintSpeed : TUNING.walkSpeed;
  let dx = 0;
  let dy = 0;
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    dx = (mx / len) * speed * dt;
    dy = (my / len) * speed * dt;
    p.moving = true;
    p.walkPhase += dt * (sprinting ? 12 : 8);
  } else {
    p.moving = false;
  }
  const moved = moveWithCollision(G.city, p.x, p.y, dx, dy, 12);
  p.x = moved.x;
  p.y = moved.y;

  // Aim at the mouse cursor in world space.
  const worldMouse = G.camera.screenToWorld(input.mouse.x, input.mouse.y);
  p.aimAngle = Math.atan2(worldMouse.y - p.y, worldMouse.x - p.x);
  p.angle = p.aimAngle;

  if (input.wasPressed('enter') && p.enterCooldown <= 0) tryEnterCar(G);
  if (input.wasPressed('punch')) G.combat.meleeAttack(G);
  if (input.wasPressed('weaponNext')) cycleWeapon(G, 1);
  if (input.wasPressed('weaponPrev')) cycleWeapon(G, -1);
  if (input.mouse.wheel !== 0) cycleWeapon(G, input.mouse.wheel > 0 ? 1 : -1);

  // Shooting: click for single shots, hold for automatics.
  const weapon = WEAPONS[p.weapon];
  const wantFire = weapon.automatic ? input.mouse.down : input.mouse.clicked;
  if (wantFire && p.fireCooldown <= 0) {
    if (weapon.melee) G.combat.meleeAttack(G);
    else G.combat.fireWeapon(G);
  }
}

function cycleWeapon(G, dir) {
  const owned = G.player.weaponsOwned;
  if (owned.length < 2) return;
  const index = owned.indexOf(G.player.weapon);
  const next = owned[(index + dir + owned.length) % owned.length];
  G.player.weapon = next;
  G.audio.click();
}
