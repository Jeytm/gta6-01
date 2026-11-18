// The story: five missions for Mara Quinn, from Luz's garage to the last score.
// Each mission is a list of steps; the runner spawns what a step needs, tracks
// its goal, and advances with dialogue. Failing (wasted, busted, or a torched
// target car) returns Mara to the garage to try again.

import { LANDMARKS } from './config.js';
import { createVehicle, damageVehicle } from './vehicles.js';
import { createPed } from './pedestrians.js';
import { giveWeapon } from './player.js';
import { spawnFloatText } from './effects.js';

export const MISSIONS = [
  {
    id: 'm1',
    title: 'Back in the Driver’s Seat',
    reward: 300,
    briefing: [
      ['Luz', 'Mara. Five years clean, and Solmarina still owes you. I need a driver, not a hero.'],
      ['Luz', 'Come by the garage. There is a Torro with your name on it, and a delivery that pays.'],
    ],
    steps: [
      { kind: 'goto', x: LANDMARKS.garage.x, y: LANDMARKS.garage.y, radius: 90, text: 'Go to Luz’s Garage', dialogue: [['Luz', 'There she is. Take the Torro — treat her better than your last one.']] },
      { kind: 'enterCar', carTag: 'm1-car', text: 'Get in the Torro GT' },
      { kind: 'deliverCar', carTag: 'm1-car', x: LANDMARKS.motel.x, y: LANDMARKS.motel.y, radius: 110, text: 'Deliver the car to the Palm Motel', dialogue: [['Mara', 'Easy money. Maybe this town missed me after all.']] },
    ],
  },
  {
    id: 'm2',
    title: 'Hot Wheels',
    reward: 450,
    briefing: [
      ['Luz', 'The Vultures run a chop shop out of Vulture Motors. They took a Breeze Coupe that belongs to a friend.'],
      ['Luz', 'Take it back. Expect company — and expect the cops to notice.'],
    ],
    steps: [
      { kind: 'goto', x: LANDMARKS.dealership.x, y: LANDMARKS.dealership.y, radius: 120, text: 'Go to Vulture Motors', dialogue: [['Luz', 'The gold coupe out front. Take it, and do not stop for red lights.']] },
      { kind: 'steal', carTag: 'm2-car', text: 'Steal the gold Breeze Coupe', onDone: (G) => G.wanted.addStars(2, 'grand theft auto') },
      { kind: 'deliverCar', carTag: 'm2-car', x: LANDMARKS.garage.x, y: LANDMARKS.garage.y, radius: 110, text: 'Bring the coupe back to the garage' },
    ],
  },
  {
    id: 'm3',
    title: 'The Docks Deal',
    reward: 600,
    briefing: [
      ['Luz', 'A buyer at Pier 9 wants the merchandise. Simple handoff. What could go wrong?'],
      ['Mara', 'You just jinxed it, Luz.'],
    ],
    steps: [
      { kind: 'goto', x: LANDMARKS.docksDeal.x, y: LANDMARKS.docksDeal.y, radius: 110, text: 'Meet the buyer at Pier 9', dialogue: [['Vulture', 'Well, well. Luz sends her regards? We will take the goods AND the car.']] },
      { kind: 'kill', count: 5, spawnAt: { x: LANDMARKS.docksDeal.x, y: LANDMARKS.docksDeal.y }, text: 'Fight off the Vulture ambush', onStart: (G) => G.wanted.addStars(1, 'shots fired') },
      { kind: 'escape', x: LANDMARKS.safehouse.x, y: LANDMARKS.safehouse.y, radius: 110, text: 'Lose the heat and reach the safehouse', dialogue: [['Luz', 'You are still breathing. That is the whole job, most days.']] },
    ],
  },
  {
    id: 'm4',
    title: 'Heat Wave',
    reward: 700,
    briefing: [
      ['Luz', 'Solmarina Trust keeps a stash box for the Vultures. Walk in, hold the room, walk out rich.'],
      ['Mara', 'And the SCPD?'],
      ['Luz', 'Will be very interested. Marina Auto Body owes me a favour — a fresh coat fixes everything.'],
    ],
    steps: [
      { kind: 'goto', x: LANDMARKS.bank.x, y: LANDMARKS.bank.y, radius: 100, text: 'Reach Solmarina Trust' },
      { kind: 'survive', seconds: 25, x: LANDMARKS.bank.x, y: LANDMARKS.bank.y, radius: 190, text: 'Hold the bank while Luz cracks the box', onStart: (G) => G.wanted.addStars(3, 'bank robbery') },
      { kind: 'respray', x: LANDMARKS.respray.x, y: LANDMARKS.respray.y, radius: 110, text: 'Get a respray at Marina Auto Body' },
      { kind: 'goto', x: LANDMARKS.safehouse.x, y: LANDMARKS.safehouse.y, radius: 110, text: 'Reach the safehouse' },
    ],
  },
  {
    id: 'm5',
    title: 'The Last Score',
    reward: 1200,
    briefing: [
      ['Luz', 'The Vultures move their whole stash tonight — one van, Pier 9 to the bank and back. Take the van, Mara, and this town is ours.'],
      ['Mara', 'One last score. Then I am gone for good.'],
    ],
    steps: [
      { kind: 'goto', x: LANDMARKS.bank.x, y: LANDMARKS.bank.y, radius: 120, text: 'Intercept the stash van at the bank', dialogue: [['Vulture', 'The van does not stop for anyone. Neither do we.']] },
      { kind: 'kill', count: 6, spawnAt: { x: LANDMARKS.bank.x, y: LANDMARKS.bank.y }, text: 'Clear the Vulture guards', onStart: (G) => G.wanted.addStars(2, 'gang war') },
      { kind: 'steal', carTag: 'm5-van', text: 'Take the stash van', onDone: (G) => G.wanted.addStars(2, 'stole the stash') },
      { kind: 'deliverCar', carTag: 'm5-van', x: LANDMARKS.garage.x, y: LANDMARKS.garage.y, radius: 120, text: 'Bring the stash home to the garage' },
    ],
  },
];

export function createMissionState() {
  return { active: null, next: 0, done: [], allDone: false };
}

export function say(G, who, text) {
  G.dialogue.queue.push({ who, text, timer: 0 });
}

function sayAll(G, lines) {
  if (!lines) return;
  for (const [who, text] of lines) say(G, who, text);
}

function spawnStepActors(G, mission, step) {
  const runtime = mission.runtime;
  if (step.kind === 'kill') {
    runtime.enemies = [];
    runtime.killsNeeded = step.count;
    runtime.killsDone = 0;
    for (let i = 0; i < step.count; i++) {
      const angle = (i / step.count) * Math.PI * 2;
      const ped = createPed(
        step.spawnAt.x + Math.cos(angle) * (90 + (i % 3) * 40),
        step.spawnAt.y + Math.sin(angle) * (90 + (i % 3) * 40),
        'gang',
      );
      ped.missionTag = mission.def.id;
      G.peds.push(ped);
      runtime.enemies.push(ped);
    }
  }
  if (step.kind === 'enterCar' || step.kind === 'steal' || step.kind === 'deliverCar') {
    const tag = step.carTag;
    if (!runtime.cars[tag]) {
      let car;
      if (tag === 'm1-car') {
        car = createVehicle('muscle', LANDMARKS.garage.x + 60, LANDMARKS.garage.y + 40, 0, '#23232b', 'parked');
      } else if (tag === 'm2-car') {
        car = createVehicle('coupe', LANDMARKS.dealership.x + 40, LANDMARKS.dealership.y - 30, Math.PI / 2, '#e8b23a', 'parked');
        // Two guards watch the coupe.
        for (let i = 0; i < 2; i++) {
          const ped = createPed(car.x + 40 + i * 30, car.y + 30, 'gang');
          ped.missionTag = mission.def.id;
          G.peds.push(ped);
        }
      } else if (tag === 'm5-van') {
        car = createVehicle('van', LANDMARKS.bank.x + 50, LANDMARKS.bank.y + 60, 0, '#e8e4da', 'parked');
      }
      car.missionTag = tag;
      runtime.cars[tag] = car;
      G.vehicles.push(car);
    }
  }
  if (step.onStart) step.onStart(G);
}

function startStep(G, mission, index) {
  const step = mission.def.steps[index];
  mission.stepIndex = index;
  mission.stepTimer = 0;
  mission.stepState = {};
  spawnStepActors(G, mission, step);
  sayAll(G, step.dialogue);
}

export function startMission(G, index) {
  const def = MISSIONS[index];
  const mission = {
    def,
    stepIndex: 0,
    runtime: { cars: {}, enemies: [] },
    stepTimer: 0,
    stepState: {},
  };
  G.mission.active = mission;
  sayAll(G, def.briefing);
  startStep(G, mission, 0);
  G.hud.flashTitle(def.title);
}

export function failMission(G, reason) {
  const mission = G.mission.active;
  if (!mission) return;
  G.mission.active = null;
  G.audio.missionFail();
  G.hud.flashTitle('MISSION FAILED', reason ?? '');
  cleanupMissionActors(G, mission);
}

function cleanupMissionActors(G, mission) {
  for (const ped of G.peds) {
    if (ped.missionTag === mission.def.id && !ped.dead) ped.kind = 'civilian';
  }
  for (const tag of Object.keys(mission.runtime.cars)) {
    const car = mission.runtime.cars[tag];
    if (car && car.driver !== 'player') car.driver = 'parked';
  }
}

export function completeMission(G) {
  const mission = G.mission.active;
  const def = mission.def;
  G.mission.active = null;
  G.mission.done.push(def.id);
  G.mission.next++;
  G.player.cash += def.reward;
  G.audio.missionDone();
  G.audio.cash();
  spawnFloatText(G.fx, G.player.x, G.player.y - 40, `+$${def.reward}`, '#8ae08a');
  G.hud.flashTitle('MISSION COMPLETE', `${def.title}  •  +$${def.reward}`);
  if (def.id === 'm2') giveWeapon(G.player, 'smg');
  if (def.id === 'm3') giveWeapon(G.player, 'shotgun');
  cleanupMissionActors(G, mission);
  G.save.saveGame(G);
  if (G.mission.next >= MISSIONS.length) {
    G.mission.allDone = true;
    say(G, 'Luz', 'It is done, Mara. Solmarina is yours now — every street, every sunset. What is next is up to you.');
    G.events.gameComplete();
  }
}

function advanceStep(G, mission) {
  const step = mission.def.steps[mission.stepIndex];
  if (step.onDone) step.onDone(G);
  if (mission.stepIndex + 1 >= mission.def.steps.length) {
    completeMission(G);
  } else {
    startStep(G, mission, mission.stepIndex + 1);
  }
}

function stepComplete(G, mission, step, dt) {
  const p = G.player;
  switch (step.kind) {
    case 'goto':
      return Math.hypot(p.x - step.x, p.y - step.y) < step.radius;
    case 'enterCar': {
      const car = mission.runtime.cars[step.carTag];
      return car && p.inCar === car;
    }
    case 'steal': {
      const car = mission.runtime.cars[step.carTag];
      return car && p.inCar === car;
    }
    case 'deliverCar': {
      const car = mission.runtime.cars[step.carTag];
      if (!car) return false;
      if (car.dead || car.exploded) {
        failMission(G, 'The car was destroyed.');
        return false;
      }
      return p.inCar === car && Math.hypot(car.x - step.x, car.y - step.y) < step.radius;
    }
    case 'kill': {
      const alive = mission.runtime.enemies.filter((e) => !e.dead).length;
      return alive === 0;
    }
    case 'survive': {
      mission.stepTimer += dt;
      const inside = Math.hypot(p.x - step.x, p.y - step.y) < step.radius;
      if (!inside) mission.stepTimer = Math.max(0, mission.stepTimer - dt * 2);
      return mission.stepTimer >= step.seconds;
    }
    case 'escape':
      return G.wanted.stars === 0 && Math.hypot(p.x - step.x, p.y - step.y) < step.radius;
    case 'respray':
      if (!p.inCar) return false;
      if (Math.hypot(p.x - step.x, p.y - step.y) < step.radius && G.wanted.stars > 0) {
        G.wanted.clear('FRESH PAINT — HEAT GONE');
        return true;
      }
      return G.wanted.stars === 0 && Math.hypot(p.x - step.x, p.y - step.y) < step.radius;
    default:
      return false;
  }
}

export function updateMissions(G, dt) {
  const mission = G.mission.active;
  if (!mission) {
    // The gold L marker at the garage starts the next mission. The radius
    // covers the spawn point, so a new player can start with one keypress.
    if (!G.mission.allDone && Math.hypot(G.player.x - LANDMARKS.garage.x, G.player.y - LANDMARKS.garage.y) < 130) {
      G.hud.setPrompt('Press E — talk to Luz, start the next job');
      if (G.input.wasPressed('enter') && !G.player.inCar) {
        startMission(G, G.mission.next);
      }
    }
    return;
  }
  const step = mission.def.steps[mission.stepIndex];
  if (stepComplete(G, mission, step, dt) && G.mission.active === mission) {
    advanceStep(G, mission);
  }
}

export function currentObjective(G) {
  const mission = G.mission.active;
  if (!mission) {
    if (G.mission.allDone) return null;
    return { x: LANDMARKS.garage.x, y: LANDMARKS.garage.y, text: 'Go to Luz’s Garage for work', kind: 'mission' };
  }
  const step = mission.def.steps[mission.stepIndex];
  let x = step.x;
  let y = step.y;
  if ((step.kind === 'enterCar' || step.kind === 'steal' || step.kind === 'deliverCar') && mission.runtime.cars[step.carTag]) {
    const car = mission.runtime.cars[step.carTag];
    if (step.kind === 'deliverCar' && G.player.inCar === car) {
      x = step.x;
      y = step.y;
    } else {
      x = car.x;
      y = car.y;
    }
  }
  if (step.kind === 'kill' && mission.runtime.enemies.length > 0) {
    const alive = mission.runtime.enemies.find((e) => !e.dead);
    if (alive) {
      x = alive.x;
      y = alive.y;
    }
  }
  return { x, y, text: step.text, kind: 'mission', missionTitle: mission.def.title };
}

export function missionProgressText(G) {
  const mission = G.mission.active;
  if (!mission) return '';
  const step = mission.def.steps[mission.stepIndex];
  if (step.kind === 'kill') {
    const alive = mission.runtime.enemies.filter((e) => !e.dead).length;
    return `${mission.runtime.enemies.length - alive}/${mission.runtime.enemies.length} down`;
  }
  if (step.kind === 'survive') {
    return `${Math.max(0, Math.ceil(step.seconds - mission.stepTimer))}s`;
  }
  return '';
}
