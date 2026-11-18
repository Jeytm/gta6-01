// SOLMARINA — boot, the game loop, the screen state machine (title, playing,
// paused, busted, wasted, complete) and the zone interactions (safehouse save,
// respray, hospital). ?seed=N fixes the city; ?shot=<scene>&seed=N stages one
// deterministic screenshot frame and sets window.__shotReady.

import { WORLD, LANDMARKS, TUNING, districtAt } from './config.js';
import { createRandom } from './random.js';
import { createInput } from './input.js';
import { createCity } from './city.js';
import { createCamera, renderWorld } from './render.js';
import { createPlayer, updatePlayer } from './player.js';
import { createVehicle, driveVehicle, updateTraffic, updateBurningVehicles, updateLooseVehicles, spawnTrafficCar, spawnParkedCars } from './vehicles.js';
import { updatePeds, spawnPeds } from './pedestrians.js';
import { createWanted, updatePolice } from './police.js';
import { fireWeapon, meleeAttack, enemyShoot, updateBullets, updatePickups } from './combat.js';
import { createMissionState, updateMissions, failMission } from './missions.js';
import { createActivities, updateActivities } from './activities.js';
import { createEffects, updateEffects } from './effects.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createSave } from './save.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', () => {
  resizeCanvas();
  G.camera.resize(canvas.width, canvas.height);
});

const rng = createRandom(seed);
const city = createCity(rng);
const input = createInput(canvas);
const camera = createCamera(canvas);
const fx = createEffects();
const audio = createAudio();
const hud = createHud();
const save = createSave();

const G = {
  canvas, ctx, camera, city, rng, input, fx, audio, hud, save,
  player: createPlayer(LANDMARKS.garage.x - 80, LANDMARKS.garage.y + 60),
  vehicles: [],
  peds: [],
  bullets: [],
  pickups: [],
  mission: createMissionState(),
  activities: createActivities(rng),
  dialogue: { queue: [], current: null, timer: 0 },
  stats: { kills: 0, gangDown: 0, carsDestroyed: 0, carsStolen: 0, fares: 0, packages: 0, jumps: 0, missionsDone: 0 },
  time: 0,
  state: 'title',
  lastGunshot: null,
  zoneCooldown: 0,
  respawnTimer: 0,
  combat: { fireWeapon, meleeAttack, enemyShoot, updateBullets, updatePickups },
  vehiclesDrive: driveVehicle,
  events: {},
  step: null,
};
G.wanted = createWanted(G);
G.camera.resize(canvas.width, canvas.height);
hud.buildMinimapBase(city);

// Populate the world: traffic, parked cars, pedestrians and a starter car.
spawnParkedCars(G, 16);
for (let i = 0; i < TUNING.trafficCount; i++) spawnTrafficCar(G, false);
spawnPeds(G, TUNING.pedCount);
const starterCar = createVehicle('sedan', LANDMARKS.garage.x + 40, LANDMARKS.garage.y + 90, Math.PI / 2, '#4a6fa5', 'parked');
G.vehicles.push(starterCar);

G.events.busted = () => {
  if (G.state !== 'playing') return;
  const fine = Math.min(G.player.cash, Math.max(150, Math.floor(G.player.cash * 0.12)));
  G.player.cash -= fine;
  document.getElementById('busted-penalty').textContent = `Fine: $${fine}  •  Weapons kept, dignity lost`;
  G.state = 'busted';
  G.respawnTimer = 3.4;
  G.hud.showScreen('busted');
  G.audio.missionFail();
  if (G.mission.active) failMission(G, 'Busted by the SCPD.');
};

G.events.wasted = () => {
  if (G.state !== 'playing') return;
  const bill = Math.min(G.player.cash, TUNING.hospitalCost);
  G.player.cash -= bill;
  document.getElementById('wasted-penalty').textContent = `Hospital bill: $${bill}`;
  G.state = 'wasted';
  G.respawnTimer = 3.4;
  G.hud.showScreen('wasted');
  G.audio.missionFail();
  if (G.mission.active) failMission(G, 'Mara did not make it.');
};

G.events.gameComplete = () => {
  G.state = 'complete';
  G.hud.showScreen('complete');
  document.getElementById('complete-stats').textContent =
    `Missions ${G.mission.done.length}/5  •  $${Math.floor(G.player.cash).toLocaleString('en-US')}  •  ${G.stats.kills} takedowns  •  ${G.stats.fares} fares  •  ${G.activities.packagesFound}/10 packages`;
};

function respawnPlayer() {
  const p = G.player;
  p.dead = false;
  p.hp = p.maxHp;
  p.armor = 0;
  p.inCar = null;
  p.x = LANDMARKS.hospital.x;
  p.y = LANDMARKS.hospital.y + 60;
  G.wanted.clear();
  G.bullets.length = 0;
  G.camera.x = p.x;
  G.camera.y = p.y;
  G.state = 'playing';
  G.hud.showScreen(null);
  G.hud.flashTitle(districtName(), 'Back on your feet');
}

function districtName() {
  return districtAt(G.player.x, G.player.y).name;
}

function updateZones(dt) {
  G.zoneCooldown = Math.max(0, G.zoneCooldown - dt);
  if (G.zoneCooldown > 0) return;
  const p = G.player;
  // Safehouse: walk in on foot to save.
  if (!p.inCar && Math.hypot(p.x - LANDMARKS.safehouse.x, p.y - LANDMARKS.safehouse.y) < 95) {
    if (save.saveGame(G)) {
      G.hud.flashTitle('GAME SAVED', 'Progress stored at the safehouse');
      G.audio.pickup();
      G.zoneCooldown = 8;
    }
    return;
  }
  // Respray: drive in with heat and cash to clear the wanted level.
  if (p.inCar && G.wanted.stars > 0 && p.cash >= TUNING.resprayCost &&
    Math.hypot(p.x - LANDMARKS.respray.x, p.y - LANDMARKS.respray.y) < 95) {
    p.cash -= TUNING.resprayCost;
    G.wanted.clear('FRESH PAINT — HEAT GONE');
    G.audio.cash();
    G.zoneCooldown = 5;
    return;
  }
  // Hospital: walk in hurt to get patched up.
  if (!p.inCar && p.hp < p.maxHp && Math.hypot(p.x - LANDMARKS.hospital.x, p.y - LANDMARKS.hospital.y) < 95) {
    const fee = Math.min(p.cash, TUNING.hospitalCost);
    p.cash -= fee;
    p.hp = p.maxHp;
    G.hud.flashTitle('PATCHED UP', fee > 0 ? `Treatment: $${fee}` : 'On the house');
    G.audio.pickup();
    G.zoneCooldown = 8;
  }
}

function updateAttract(dt) {
  // Title-screen backdrop: the city lives while the menu shows.
  G.time += dt;
  updateTraffic(G, dt);
  updatePeds(G, dt);
  updateEffects(fx, dt);
  const t = G.time * 0.05;
  camera.x = 2300 + Math.sin(t) * 320;
  camera.y = 1100 + Math.cos(t * 0.7) * 240;
  camera.zoom = 0.92;
}

function updatePlaying(dt) {
  G.time += dt;
  updatePlayer(G, dt);
  updateTraffic(G, dt);
  updateBurningVehicles(G, dt);
  updateLooseVehicles(G, dt);
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateBullets(G, dt);
  updatePickups(G, dt);
  updateMissions(G, dt);
  updateActivities(G, dt);
  updateEffects(fx, dt);
  updateZones(dt);
  audio.update(dt);
  camera.update(G, dt);
  hud.update(G, dt);
  if (G.player.dead && G.state === 'playing') {
    if (G.wanted.stars > 0) G.events.busted();
    else G.events.wasted();
  }
  if (input.wasPressed('pause')) {
    G.state = 'paused';
    fillPauseStats();
    hud.showScreen('pause');
    audio.setSiren(false);
    audio.setEngine(0, false);
  }
}

function fillPauseStats() {
  document.getElementById('pause-stats').textContent =
    `Cash $${Math.floor(G.player.cash).toLocaleString('en-US')}  •  Missions ${G.mission.done.length}/5  •  ` +
    `Takedowns ${G.stats.kills}  •  Cars stolen ${G.stats.carsStolen}  •  Fares ${G.stats.fares}  •  ` +
    `Packages ${G.activities.packagesFound}/10  •  Stunt jumps ${G.activities.jumpsDone.size}/3`;
}

// One fixed simulation step, shared by the live loop and the ?shot= staging.
G.step = (dt, staging = false) => {
  if (staging) {
    G.time += dt;
    updatePlayer(G, dt);
    updateTraffic(G, dt);
    updateBurningVehicles(G, dt);
    updateLooseVehicles(G, dt);
    updatePeds(G, dt);
    updatePolice(G, dt);
    updateBullets(G, dt);
    updatePickups(G, dt);
    updateMissions(G, dt);
    updateActivities(G, dt);
    updateEffects(fx, dt);
    camera.update(G, dt);
  } else {
    updatePlaying(dt);
  }
};

function startGame(fromSave) {
  audio.unlock();
  audio.startMusic();
  if (fromSave) {
    save.loadGame(G);
    camera.x = G.player.x;
    camera.y = G.player.y;
  } else {
    save.clearSave();
  }
  G.state = 'playing';
  hud.showScreen(null);
  hud.flashTitle('SOLMARINA', 'Go to Luz’s Garage — the gold L on the map');
  sayIntro();
}

function sayIntro() {
  G.dialogue.queue.push({ who: 'Luz', text: 'Mara. Five years clean, and Solmarina still owes you. Come by the garage.' });
}

function wireButtons() {
  const on = (id, fn) => {
    const button = document.getElementById(id);
    if (button) button.addEventListener('click', () => {
      audio.unlock();
      audio.click();
      fn();
    });
  };
  on('btn-new', () => startGame(false));
  on('btn-continue', () => startGame(true));
  on('btn-resume', () => {
    G.state = 'playing';
    hud.showScreen(null);
  });
  on('btn-save', () => {
    save.saveGame(G);
    G.hud.flashTitle('GAME SAVED', '');
  });
  on('btn-restart', () => window.location.reload());
  on('btn-quit', () => {
    G.state = 'title';
    hud.showScreen('title');
    audio.stopMusic();
    audio.setSiren(false);
  });
  on('btn-respawn', () => respawnPlayer());
  on('btn-respawn-2', () => respawnPlayer());
  on('btn-freeroam', () => {
    G.state = 'playing';
    hud.showScreen(null);
  });
  on('btn-mute', () => {
    audio.setMuted(!audio.isMuted());
    document.getElementById('btn-mute').textContent = audio.isMuted() ? '🔇 Sound off' : '🔊 Sound on';
  });
  const continueButton = document.getElementById('btn-continue');
  if (continueButton && !save.hasSave()) continueButton.classList.add('disabled');
}

wireButtons();
hud.showScreen('title');

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  try {
    if (G.state === 'playing') {
      updatePlaying(dt);
    } else if (G.state === 'title') {
      updateAttract(dt);
    } else if (G.state === 'paused') {
      if (input.wasPressed('pause')) {
        G.state = 'playing';
        hud.showScreen(null);
      }
    } else if (G.state === 'busted' || G.state === 'wasted') {
      G.respawnTimer -= dt;
      updateEffects(fx, dt);
      if (G.respawnTimer <= 0) respawnPlayer();
    }
  } catch (err) {
    // One bad frame must never freeze the game: log it and keep going.
    console.error('frame error:', err);
  }
  renderWorld(G);
  input.endFrame();
  requestAnimationFrame(frame);
}

if (shot) {
  // Deterministic screenshot mode: stage the scene, paint it, signal ready.
  G.state = 'playing';
  hud.showScreen(null);
  stageShot(G, shot);
  // Let transient overlays (mission title card, district label) fade so the
  // staged frame shows the world; the objective tracker still names the job.
  hud.update(G, 3);
  renderWorld(G);
  renderWorld(G);
  window.__shotReady = true;
} else {
  requestAnimationFrame(frame);
}

// Keep the game honest in the background tab: never simulate huge steps.
document.addEventListener('visibilitychange', () => {
  lastTime = performance.now();
});
