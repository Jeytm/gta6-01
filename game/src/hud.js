// The heads-up display: wanted stars, health and armour, cash, weapon, the
// objective tracker, dialogue subtitles, the live minimap and the big centre
// titles. All DOM except the minimap, which is a small canvas.

import { WORLD, LANDMARKS, WEAPONS, districtAt } from './config.js';
import { currentObjective, missionProgressText } from './missions.js';
import { taxiObjective } from './activities.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const hud = {
    root: el('hud'),
    stars: el('wanted-stars'),
    healthFill: el('health-fill'),
    armorFill: el('armor-fill'),
    armorRow: el('armor-row'),
    cash: el('cash-display'),
    weapon: el('weapon-display'),
    objective: el('objective-tracker'),
    objectiveTitle: el('objective-title'),
    objectiveText: el('objective-text'),
    subtitle: el('subtitle'),
    subtitleWho: el('subtitle-who'),
    subtitleText: el('subtitle-text'),
    prompt: el('prompt'),
    speed: el('speedometer'),
    speedValue: el('speed-value'),
    flash: el('title-flash'),
    flashMain: el('flash-main'),
    flashSub: el('flash-sub'),
    district: el('district-label'),
    evade: el('evade-indicator'),
    vignette: el('vignette'),
    minimap: el('minimap'),
    flashTimer: 0,
    districtTimer: 0,
    lastDistrict: '',
    promptTimer: 0,
    mapCanvas: null,
    mapCtx: null,
  };
  hud.mapCtx = hud.minimap.getContext('2d');

  hud.flashTitle = (main, sub = '') => {
    hud.flashMain.textContent = main;
    hud.flashSub.textContent = sub;
    hud.flash.classList.add('show');
    hud.flashTimer = 2.8;
  };
  hud.setPrompt = (text) => {
    hud.prompt.textContent = text;
    hud.prompt.classList.add('show');
    hud.promptTimer = 0.12;
  };

  hud.showScreen = (name) => {
    for (const screen of document.querySelectorAll('.screen')) screen.classList.remove('show');
    if (name) {
      const target = document.getElementById(`screen-${name}`);
      if (target) target.classList.add('show');
    }
    hud.root.classList.toggle('hidden', name === 'title');
  };

  // Pre-render the static map once: ground, water, roads and buildings.
  hud.buildMinimapBase = (city) => {
    const size = 180;
    const scale = size / WORLD.size;
    const base = document.createElement('canvas');
    base.width = size;
    base.height = size;
    const ctx = base.getContext('2d');
    ctx.fillStyle = '#b7a888';
    ctx.fillRect(0, 0, size, size);
    for (const d of city.districts) {
      ctx.fillStyle = d.ground;
      ctx.fillRect(d.x0 * scale, d.y0 * scale, (d.x1 - d.x0) * scale, (d.y1 - d.y0) * scale);
    }
    ctx.fillStyle = '#ecd9a0';
    ctx.fillRect(0, WORLD.sandY * scale, size, (WORLD.waterY - WORLD.sandY) * scale);
    ctx.fillStyle = '#3d9db5';
    ctx.fillRect(0, WORLD.waterY * scale, size, size - WORLD.waterY * scale);
    ctx.fillStyle = '#4b4b55';
    for (let i = 0; i < WORLD.roadCount; i++) {
      const line = (WORLD.firstRoad + i * WORLD.roadGap) * scale;
      ctx.fillRect(0, line - (WORLD.roadWidth / 2) * scale, size, WORLD.roadWidth * scale);
      ctx.fillRect(line - (WORLD.roadWidth / 2) * scale, 0, WORLD.roadWidth * scale, size);
    }
    ctx.fillStyle = 'rgba(90, 80, 60, 0.55)';
    for (const b of city.buildings) {
      ctx.fillRect(b.x * scale, b.y * scale, Math.max(1, b.w * scale), Math.max(1, b.d * scale));
    }
    hud.mapCanvas = base;
  };

  hud.drawMinimap = (G) => {
    const ctx = hud.mapCtx;
    const size = 180;
    const scale = size / WORLD.size;
    if (hud.mapCanvas) ctx.drawImage(hud.mapCanvas, 0, 0);
    const px = G.player.x * scale;
    const py = G.player.y * scale;

    const blip = (x, y, color, r = 3) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x * scale, y * scale, r, 0, Math.PI * 2);
      ctx.fill();
    };
    // Objective blip pulses.
    const objective = currentObjective(G) ?? taxiObjective(G);
    if (objective) {
      const pulse = 3 + Math.sin(G.time * 5) * 1.2;
      ctx.fillStyle = '#ffd23a';
      ctx.save();
      ctx.translate(objective.x * scale, objective.y * scale);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-pulse, -pulse, pulse * 2, pulse * 2);
      ctx.restore();
    }
    // Police blips flash red and blue.
    const copColor = Math.floor(G.time * 4) % 2 === 0 ? '#ff5a4a' : '#4a8aff';
    for (const v of G.vehicles) {
      if (v.driver === 'police' && !v.dead) blip(v.x, v.y, copColor, 2.5);
    }
    // Landmarks.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('H', LANDMARKS.hospital.x * scale, LANDMARKS.hospital.y * scale + 3);
    ctx.fillText('L', LANDMARKS.garage.x * scale, LANDMARKS.garage.y * scale + 3);

    // Player arrow, rotated to face the direction of travel.
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(G.player.angle + Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1d2a44';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // North marker and view frame.
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, size - 2, size - 2);
  };

  hud.update = (G, dt) => {
    const p = G.player;
    // Wanted stars.
    const stars = '★'.repeat(G.wanted.stars) + '☆'.repeat(5 - G.wanted.stars);
    if (hud.stars.textContent !== stars) hud.stars.textContent = stars;
    hud.stars.classList.toggle('hot', G.wanted.stars > 0);
    hud.evade.classList.toggle('show', G.wanted.stars > 0 && G.wanted.evading);
    // Health and armour.
    hud.healthFill.style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
    hud.healthFill.classList.toggle('low', p.hp < 30);
    hud.armorRow.classList.toggle('show', p.armor > 0);
    hud.armorFill.style.width = `${Math.max(0, (p.armor / p.maxArmor) * 100)}%`;
    // Cash and weapon.
    hud.cash.textContent = `$${Math.floor(p.cash).toLocaleString('en-US')}`;
    const weapon = WEAPONS[p.weapon];
    let ammoText = '∞';
    if (p.weapon === 'smg') ammoText = `${p.ammo.smg}`;
    if (p.weapon === 'shotgun') ammoText = `${p.ammo.shotgun}`;
    hud.weapon.textContent = weapon.melee ? weapon.name : `${weapon.name}  •  ${ammoText}`;
    // Objective tracker.
    const objective = currentObjective(G) ?? taxiObjective(G);
    if (objective) {
      hud.objective.classList.add('show');
      hud.objectiveTitle.textContent = objective.missionTitle ?? (objective.kind === 'taxi' ? 'TAXI FARE' : 'SOLMARINA');
      hud.objectiveText.textContent = objective.text;
      const progress = missionProgressText(G);
      hud.objectiveText.textContent = progress ? `${objective.text}  (${progress})` : objective.text;
    } else {
      hud.objective.classList.remove('show');
    }
    // Speedometer, only while driving.
    if (p.inCar) {
      const speed = Math.hypot(p.inCar.vx, p.inCar.vy);
      hud.speed.classList.add('show');
      hud.speedValue.textContent = Math.round(speed * 0.42);
    } else {
      hud.speed.classList.remove('show');
    }
    // Subtitles.
    const dialogue = G.dialogue;
    if (!dialogue.current && dialogue.queue.length > 0) {
      dialogue.current = dialogue.queue.shift();
      dialogue.timer = 3.6;
    }
    if (dialogue.current) {
      dialogue.timer -= dt;
      hud.subtitle.classList.add('show');
      hud.subtitleWho.textContent = dialogue.current.who;
      hud.subtitleText.textContent = dialogue.current.text;
      if (dialogue.timer <= 0) dialogue.current = null;
    } else {
      hud.subtitle.classList.remove('show');
    }
    // Context prompt fades unless refreshed every frame.
    hud.promptTimer -= dt;
    if (hud.promptTimer <= 0) hud.prompt.classList.remove('show');
    // Centre title flash.
    if (hud.flashTimer > 0) {
      hud.flashTimer -= dt;
      if (hud.flashTimer <= 0) hud.flash.classList.remove('show');
    }
    // District label on entering a new district.
    const district = districtAt(p.x, p.y).name;
    if (district !== hud.lastDistrict) {
      hud.lastDistrict = district;
      hud.district.textContent = district;
      hud.district.classList.add('show');
      hud.districtTimer = 2.6;
    }
    if (hud.districtTimer > 0) {
      hud.districtTimer -= dt;
      if (hud.districtTimer <= 0) hud.district.classList.remove('show');
    }
    // Damage vignette.
    hud.vignette.style.opacity = String(Math.min(0.85, G.fx.flash));
    hud.drawMinimap(G);
  };

  return hud;
}
