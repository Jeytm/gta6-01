// The ?shot= scenes: deterministic staged frames for screenshots, built by
// playing the real rules forward from a seeded state — the same code paths a
// player drives through, with scripted input. Each scene ends with the game
// rendered and window.__shotReady set by main.js.

import { LANDMARKS } from './config.js';
import { createVehicle } from './vehicles.js';
import { createPed } from './pedestrians.js';
import { startMission } from './missions.js';
import { giveWeapon } from './player.js';

function runSteps(G, steps, script) {
  for (let i = 0; i < steps; i++) {
    if (script) script(i, steps);
    G.step(1 / 60, true);
    G.input.endFrame();
  }
  G.input.releaseAll();
}

function settleCamera(G) {
  G.camera.x = G.player.x;
  G.camera.y = G.player.y;
  G.camera.zoom = G.player.inCar ? 0.86 : 1;
  G.camera.shakeX = 0;
  G.camera.shakeY = 0;
}

function stageChase(G) {
  const p = G.player;
  // Mara in a black Torro GT, eastbound on the 2200 road, three stars up.
  const car = createVehicle('muscle', 1800, 2200, 0, '#23232b', 'player');
  car.vx = 300;
  G.vehicles.push(car);
  p.inCar = car;
  p.x = car.x;
  p.y = car.y;
  G.wanted.addStars(3, 'grand theft auto');
  // Three interceptors in pursuit, staggered behind.
  const offsets = [[-130, 14], [-230, -16], [-330, 10]];
  for (const [dx, dy] of offsets) {
    const cop = createVehicle('police', car.x + dx, car.y + dy, 0, undefined, 'police');
    cop.vx = 290;
    cop.unstickTimer = 0;
    G.vehicles.push(cop);
  }
  // The Hot Wheels delivery is the live objective.
  startMission(G, 1);
  const mission = G.mission.active;
  mission.stepIndex = 2;
  mission.runtime.cars['m2-car'] = car;
  G.dialogue.queue.length = 0;
  G.dialogue.current = { who: 'Luz', text: 'Three stars and counting — lose them, then bring the car home.' };
  G.dialogue.timer = 30;
  runSteps(G, 110, () => {
    G.input.inject(['KeyW'], false);
  });
  settleCamera(G);
}

function stageStreet(G) {
  const p = G.player;
  p.x = 2200;
  p.y = 1400;
  p.aimAngle = Math.PI / 4;
  p.angle = p.aimAngle;
  // A busy downtown corner: pedestrians on every sidewalk.
  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2;
    const ped = createPed(p.x + Math.cos(angle) * (90 + (i % 3) * 55), p.y + Math.sin(angle) * (90 + (i % 3) * 55), 'civilian');
    G.peds.push(ped);
  }
  startMission(G, 0);
  G.dialogue.queue.length = 0;
  G.dialogue.current = { who: 'Luz', text: 'Come by the garage. There is a Torro with your name on it.' };
  G.dialogue.timer = 30;
  runSteps(G, 70);
  settleCamera(G);
}

function stageShootout(G) {
  const p = G.player;
  giveWeapon(p, 'smg');
  p.weapon = 'smg';
  p.x = LANDMARKS.docksDeal.x - 190;
  p.y = LANDMARKS.docksDeal.y + 60;
  p.aimAngle = 0;
  p.angle = 0;
  G.wanted.addStars(1, 'shots fired');
  // The Pier 9 ambush, mid-fight.
  startMission(G, 2);
  const mission = G.mission.active;
  mission.stepIndex = 1;
  mission.runtime.enemies = [];
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const ped = createPed(
      LANDMARKS.docksDeal.x + Math.cos(angle) * (80 + (i % 2) * 50),
      LANDMARKS.docksDeal.y + Math.sin(angle) * (80 + (i % 2) * 50),
      'gang',
    );
    ped.missionTag = 'm3';
    G.peds.push(ped);
    mission.runtime.enemies.push(ped);
  }
  G.dialogue.queue.length = 0;
  G.dialogue.current = { who: 'Vulture', text: 'Well, well. Luz sends her regards? We will take the goods AND the car.' };
  G.dialogue.timer = 30;
  // Let the fight develop, then fire a burst just before the frame.
  runSteps(G, 55);
  runSteps(G, 5, () => {
    G.input.mouse.x = G.camera.width * 0.72;
    G.input.mouse.y = G.camera.height * 0.42;
    G.input.inject([], true);
    p.fireCooldown = 0;
  });
  settleCamera(G);
}

function stageStart(G) {
  // The title screen over a living downtown: traffic and pedestrians move
  // while the camera drifts slowly across the towers.
  G.camera.x = 2300;
  G.camera.y = 900;
  G.camera.zoom = 0.92;
  runSteps(G, 150, (i) => {
    G.camera.x = 2300 + Math.sin(i * 0.01) * 160;
    G.camera.y = 900 + Math.cos(i * 0.007) * 110;
  });
  G.state = 'title';
  G.hud.showScreen('title');
}

export function stageShot(G, name) {
  if (name === 'chase') stageChase(G);
  else if (name === 'street') stageStreet(G);
  else if (name === 'mission') stageShootout(G);
  else if (name === 'start') stageStart(G);
  else stageStreet(G);
}
