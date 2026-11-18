// The camera and the renderer: a 2.5D top-down view of Solmarina with extruded
// buildings, long afternoon shadows, the bay, traffic, pedestrians, effects
// and the objective beacon. Everything is drawn in code; there are no assets.

import { WORLD, PALETTE, DISTRICTS, districtAt, LANDMARKS } from './config.js';
import { roadLines } from './city.js';
import { currentObjective } from './missions.js';
import { JUMP_RAMPS } from './activities.js';

export function createCamera(canvas) {
  const camera = {
    x: 1000, y: 1000,
    zoom: 1,
    targetZoom: 1,
    shakeX: 0, shakeY: 0,
    width: canvas.width,
    height: canvas.height,
    resize(w, h) {
      camera.width = w;
      camera.height = h;
    },
    update(G, dt) {
      const p = G.player;
      const lookX = p.inCar ? p.inCar.vx * 0.35 : 0;
      const lookY = p.inCar ? p.inCar.vy * 0.35 : 0;
      const tx = p.x + lookX;
      const ty = p.y + lookY;
      camera.x += (tx - camera.x) * Math.min(1, 4.5 * dt);
      camera.y += (ty - camera.y) * Math.min(1, 4.5 * dt);
      const speed = p.inCar ? Math.hypot(p.inCar.vx, p.inCar.vy) : 0;
      camera.targetZoom = p.inCar ? Math.max(0.78, 1 - speed / 1600) : 1;
      camera.zoom += (camera.targetZoom - camera.zoom) * Math.min(1, 2.5 * dt);
      const shake = G.fx.shake;
      camera.shakeX = (Math.random() - 0.5) * shake;
      camera.shakeY = (Math.random() - 0.5) * shake;
    },
    screenToWorld(sx, sy) {
      return {
        x: (sx - camera.width / 2) / camera.zoom + camera.x,
        y: (sy - camera.height / 2) / camera.zoom + camera.y,
      };
    },
    worldToScreen(wx, wy) {
      return {
        x: (wx - camera.x) * camera.zoom + camera.width / 2,
        y: (wy - camera.y) * camera.zoom + camera.height / 2,
      };
    },
  };
  return camera;
}

function visibleRect(camera) {
  const hw = camera.width / 2 / camera.zoom;
  const hh = camera.height / 2 / camera.zoom;
  return { x0: camera.x - hw - 160, y0: camera.y - hh - 160, x1: camera.x + hw + 160, y1: camera.y + hh + 160 };
}

function drawGround(ctx, G, view) {
  const { city, time } = G;
  ctx.fillStyle = PALETTE.groundDry;
  ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.ground;
    ctx.fillRect(d.x0, d.y0, d.x1 - d.x0, Math.min(d.y1, WORLD.sandY) - d.y0);
  }
  // Parks: soft green blocks.
  ctx.fillStyle = PALETTE.groundPark;
  for (const block of city.blocks) {
    const key = `${block.i},${block.j}`;
    if (city.parkKeys && city.parkKeys.has(key)) {
      ctx.fillRect(block.x0, block.y0, block.x1 - block.x0, block.y1 - block.y0);
    }
  }
  // Beach and the bay.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(view.x0, WORLD.sandY, view.x1 - view.x0, WORLD.waterY - WORLD.sandY);
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.fillRect(view.x0, WORLD.waterY, view.x1 - view.x0, view.y1 - WORLD.waterY);
  // Animated wave lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let row = 0; row < 4; row++) {
    const y = WORLD.waterY + 30 + row * 55;
    ctx.beginPath();
    for (let x = Math.floor(view.x0 / 60) * 60; x < view.x1; x += 60) {
      const wave = Math.sin(x * 0.02 + time * 1.4 + row * 1.7) * 6;
      if (x === Math.floor(view.x0 / 60) * 60) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }
  // Foam where the waves meet the sand.
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 14]);
  ctx.lineDashOffset = -time * 22;
  ctx.beginPath();
  ctx.moveTo(view.x0, WORLD.waterY + 4);
  ctx.lineTo(view.x1, WORLD.waterY + 4);
  ctx.stroke();
  ctx.setLineDash([]);
  // Piers.
  for (const pier of city.piers) {
    ctx.fillStyle = '#8a6a4a';
    ctx.fillRect(pier.x0, pier.y0, pier.x1 - pier.x0, pier.y1 - pier.y0);
    ctx.strokeStyle = '#6e543a';
    ctx.lineWidth = 2;
    for (let y = pier.y0 + 20; y < pier.y1; y += 34) {
      ctx.beginPath();
      ctx.moveTo(pier.x0, y);
      ctx.lineTo(pier.x1, y);
      ctx.stroke();
    }
  }
  // District names painted faintly on the ground.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const d of DISTRICTS) {
    const cx = (d.x0 + d.x1) / 2;
    const cy = Math.min((d.y0 + d.y1) / 2, WORLD.sandY - 60);
    if (cx < view.x0 || cx > view.x1 || cy < view.y0 || cy > view.y1) continue;
    ctx.font = 'bold 64px Arial, sans-serif';
    ctx.fillStyle = 'rgba(90, 70, 40, 0.13)';
    ctx.fillText(d.name.toUpperCase(), cx, cy);
  }
}

function drawRoads(ctx, G, view) {
  const lines = roadLines();
  const half = WORLD.roadWidth / 2;
  ctx.fillStyle = PALETTE.asphalt;
  for (const line of lines) {
    ctx.fillRect(view.x0, line - half, view.x1 - view.x0, WORLD.roadWidth);
    ctx.fillRect(line - half, view.y0, WORLD.roadWidth, view.y1 - view.y0);
  }
  // Lane dashes.
  ctx.strokeStyle = PALETTE.laneDash;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  for (const line of lines) {
    ctx.beginPath();
    ctx.moveTo(view.x0, line);
    ctx.lineTo(view.x1, line);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(line, view.y0);
    ctx.lineTo(line, view.y1);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(240, 236, 224, 0.75)';
  for (const lx of lines) {
    for (const ly of lines) {
      if (lx < view.x0 - 80 || lx > view.x1 + 80 || ly < view.y0 - 80 || ly > view.y1 + 80) continue;
      for (let s = -1; s <= 1; s += 2) {
        for (let k = -2; k <= 2; k++) {
          ctx.fillRect(lx + k * 12 - 4, ly + s * (half - 8) - 3, 8, 6);
          ctx.fillRect(lx + s * (half - 8) - 3, ly + k * 12 - 4, 6, 8);
        }
      }
    }
  }
  // Sidewalk rings around blocks.
  ctx.strokeStyle = PALETTE.sidewalk;
  ctx.lineWidth = WORLD.sidewalk;
  for (const block of G.city.blocks) {
    if (block.x1 < view.x0 || block.x0 > view.x1 || block.y1 < view.y0 || block.y0 > view.y1) continue;
    if (block.y0 >= WORLD.sandY) continue;
    ctx.strokeRect(block.x0 + 2, block.y0 + 2, block.x1 - block.x0 - 4, block.y1 - block.y0 - 4);
  }
}

function drawBuilding(ctx, b, time) {
  const lift = b.h * 0.24;
  const shx = b.h * 0.3 + 8;
  const shy = b.h * 0.3 + 8;
  // Shadow.
  ctx.fillStyle = PALETTE.shadow;
  ctx.fillRect(b.x + shx, b.y + shy, b.w, b.d);
  // South face (darker) and east face.
  ctx.fillStyle = shade(b.face, -34);
  ctx.beginPath();
  ctx.moveTo(b.x, b.y + b.d);
  ctx.lineTo(b.x + b.w, b.y + b.d);
  ctx.lineTo(b.x + b.w - lift * 0.6, b.y + b.d - lift);
  ctx.lineTo(b.x - lift * 0.6, b.y + b.d - lift);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(b.face, -18);
  ctx.beginPath();
  ctx.moveTo(b.x + b.w, b.y);
  ctx.lineTo(b.x + b.w, b.y + b.d);
  ctx.lineTo(b.x + b.w - lift * 0.6, b.y + b.d - lift);
  ctx.lineTo(b.x + b.w - lift * 0.6, b.y - lift);
  ctx.closePath();
  ctx.fill();
  // Roof.
  const rx = b.x - lift * 0.6;
  const ry = b.y - lift;
  ctx.fillStyle = b.roof;
  ctx.fillRect(rx, ry, b.w, b.d);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(rx, ry, b.w, b.d);
  // Roof details: vents and skylights, seeded per building.
  const vents = 1 + Math.floor(b.seed * 3);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let i = 0; i < vents; i++) {
    const vx = rx + 12 + ((b.seed * 997 + i * 37) % Math.max(20, b.w - 30));
    const vy = ry + 10 + ((b.seed * 613 + i * 53) % Math.max(20, b.d - 26));
    ctx.fillRect(vx, vy, 12, 9);
  }
  // Windows on the south face for taller buildings.
  if (b.h > 24) {
    const rows = Math.min(4, Math.floor(b.h / 22));
    const cols = Math.max(2, Math.floor(b.w / 26));
    ctx.fillStyle = PALETTE.glass;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = b.x + 10 + c * ((b.w - 20) / cols);
        const wy = b.y + b.d - lift + 4 + r * ((lift - 8) / rows);
        ctx.fillRect(wx, wy, 10, 7);
      }
    }
  }
  void time;
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amount));
  return `rgb(${r},${g},${b})`;
}

function drawProps(ctx, G, view) {
  const { city, time } = G;
  for (const tree of city.trees) {
    if (tree.x < view.x0 || tree.x > view.x1 || tree.y < view.y0 || tree.y > view.y1) continue;
    ctx.fillStyle = PALETTE.shadow;
    ctx.beginPath();
    ctx.ellipse(tree.x + 8, tree.y + 8, tree.s, tree.s * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5d8a46';
    ctx.beginPath();
    ctx.arc(tree.x, tree.y, tree.s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6fae56';
    ctx.beginPath();
    ctx.arc(tree.x - tree.s * 0.25, tree.y - tree.s * 0.25, tree.s * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const palm of city.palms) {
    if (palm.x < view.x0 || palm.x > view.x1 || palm.y < view.y0 || palm.y > view.y1) continue;
    const sway = Math.sin(time * 1.1 + palm.seed * 9) * 2;
    ctx.strokeStyle = PALETTE.palmTrunk;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y);
    ctx.lineTo(palm.x + sway, palm.y - palm.s);
    ctx.stroke();
    ctx.strokeStyle = PALETTE.palmLeaf;
    ctx.lineWidth = 3;
    for (let f = 0; f < 6; f++) {
      const a = (f / 6) * Math.PI * 2 + palm.seed * 3;
      ctx.beginPath();
      ctx.moveTo(palm.x + sway, palm.y - palm.s);
      ctx.quadraticCurveTo(
        palm.x + sway + Math.cos(a) * palm.s * 0.7, palm.y - palm.s + Math.sin(a) * palm.s * 0.7 - 3,
        palm.x + sway + Math.cos(a) * palm.s * 1.15, palm.y - palm.s + Math.sin(a) * palm.s * 1.15 + 4,
      );
      ctx.stroke();
    }
  }
  for (const crate of city.crates) {
    if (crate.x < view.x0 || crate.x > view.x1 || crate.y < view.y0 || crate.y > view.y1) continue;
    ctx.fillStyle = '#a8814e';
    ctx.fillRect(crate.x - crate.s / 2, crate.y - crate.s / 2, crate.s, crate.s);
    ctx.strokeStyle = '#7a5a30';
    ctx.lineWidth = 2;
    ctx.strokeRect(crate.x - crate.s / 2, crate.y - crate.s / 2, crate.s, crate.s);
  }
  for (const lamp of city.lamps) {
    if (lamp.x < view.x0 || lamp.x > view.x1 || lamp.y < view.y0 || lamp.y > view.y1) continue;
    ctx.fillStyle = '#3a3a42';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const hydrant of city.hydrants) {
    if (hydrant.x < view.x0 || hydrant.x > view.x1 || hydrant.y < view.y0 || hydrant.y > view.y1) continue;
    ctx.fillStyle = '#c23a2e';
    ctx.fillRect(hydrant.x - 3, hydrant.y - 3, 6, 6);
  }
}

function drawLandmarkZones(ctx, G, view) {
  const zones = [
    { ...LANDMARKS.garage, color: '#ffd23a', label: 'GARAGE' },
    { ...LANDMARKS.respray, color: '#7ab8e8', label: 'RESPRAY' },
    { ...LANDMARKS.hospital, color: '#ff8a8a', label: 'HOSPITAL' },
    { ...LANDMARKS.safehouse, color: '#8ae08a', label: 'SAFEHOUSE' },
  ];
  ctx.textAlign = 'center';
  for (const zone of zones) {
    if (zone.x < view.x0 - 100 || zone.x > view.x1 + 100 || zone.y < view.y0 - 100 || zone.y > view.y1 + 100) continue;
    ctx.fillStyle = zone.color + '2e';
    ctx.fillRect(zone.x - 70, zone.y - 50, 140, 100);
    ctx.strokeStyle = zone.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(zone.x - 70, zone.y - 50, 140, 100);
    ctx.setLineDash([]);
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.fillStyle = zone.color;
    ctx.fillText(zone.label, zone.x, zone.y - 58);
  }
  // Stunt jump ramps: striped wedges.
  for (const ramp of JUMP_RAMPS) {
    if (ramp.x < view.x0 - 60 || ramp.x > view.x1 + 60 || ramp.y < view.y0 - 60 || ramp.y > view.y1 + 60) continue;
    ctx.save();
    ctx.translate(ramp.x, ramp.y);
    ctx.rotate(ramp.angle);
    ctx.fillStyle = '#e8b23a';
    ctx.fillRect(-26, -16, 52, 32);
    ctx.fillStyle = '#23232b';
    for (let i = -2; i <= 2; i++) ctx.fillRect(i * 11 - 3, -16, 6, 32);
    ctx.restore();
  }
}

function drawObjectiveBeacon(ctx, G) {
  const objective = currentObjective(G);
  if (!objective) return;
  const pulse = 1 + Math.sin(G.time * 4) * 0.12;
  const r = 46 * pulse;
  ctx.strokeStyle = 'rgba(255, 210, 58, 0.9)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(objective.x, objective.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 210, 58, 0.18)';
  ctx.beginPath();
  ctx.arc(objective.x, objective.y, r, 0, Math.PI * 2);
  ctx.fill();
  // Light pillar.
  const grad = ctx.createLinearGradient(objective.x, objective.y - 220, objective.x, objective.y);
  grad.addColorStop(0, 'rgba(255, 210, 58, 0)');
  grad.addColorStop(1, 'rgba(255, 210, 58, 0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(objective.x - 8, objective.y - 220, 16, 220);
  // Down arrow.
  const bob = Math.sin(G.time * 4) * 6;
  ctx.fillStyle = '#ffd23a';
  ctx.beginPath();
  ctx.moveTo(objective.x, objective.y - 96 + bob);
  ctx.lineTo(objective.x - 12, objective.y - 118 + bob);
  ctx.lineTo(objective.x + 12, objective.y - 118 + bob);
  ctx.closePath();
  ctx.fill();
}

function drawSkids(ctx, G) {
  for (const skid of G.fx.skids) {
    ctx.save();
    ctx.translate(skid.x, skid.y);
    ctx.rotate(skid.angle);
    ctx.fillStyle = `rgba(30, 30, 34, ${Math.min(0.55, skid.life * 0.14)})`;
    ctx.fillRect(-8, -2, 16, 4);
    ctx.restore();
  }
}

function drawPickups(ctx, G, time) {
  for (const item of G.pickups) {
    const bob = Math.sin(time * 5 + item.x) * 3;
    ctx.fillStyle = item.kind === 'ammo' ? '#ffd76a' : item.kind === 'health' ? '#8ae08a' : item.kind === 'armor' ? '#7ab8e8' : '#8ae08a';
    ctx.save();
    ctx.translate(item.x, item.y + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();
  }
  for (const pack of G.activities.packages) {
    if (pack.taken) continue;
    const glow = 0.5 + Math.sin(time * 3 + pack.x) * 0.3;
    ctx.fillStyle = `rgba(255, 215, 106, ${glow})`;
    ctx.beginPath();
    ctx.arc(pack.x, pack.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd76a';
    ctx.save();
    ctx.translate(pack.x, pack.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-8, -8, 16, 16);
    ctx.restore();
    ctx.fillStyle = '#8a6a1a';
    ctx.fillRect(pack.x - 2, pack.y - 8, 4, 16);
  }
}

function drawPed(ctx, ped, time) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.dead) {
    ctx.fillStyle = 'rgba(160, 44, 34, 0.5)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const bob = ped.speed > 10 ? Math.sin(ped.walkPhase) * 1.5 : 0;
  ctx.fillStyle = PALETTE.shadow;
  ctx.beginPath();
  ctx.ellipse(2, 4, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(ped.angle + Math.PI / 2);
  // Legs.
  const step = ped.speed > 10 ? Math.sin(ped.walkPhase) * 4 : 0;
  ctx.fillStyle = '#3a3a44';
  ctx.fillRect(-6, 4 + step, 4, 8);
  ctx.fillRect(2, 4 - step, 4, 8);
  // Body and head.
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(0, -3 + bob * 0.3, 6, 0, Math.PI * 2);
  ctx.fill();
  // Hair cap.
  ctx.fillStyle = 'rgba(40, 28, 18, 0.8)';
  ctx.beginPath();
  ctx.arc(0, -4 + bob * 0.3, 6, Math.PI, Math.PI * 2);
  ctx.fill();
  // Arms and gun.
  ctx.strokeStyle = ped.skin;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-8, -2);
  ctx.lineTo(-11, -7);
  ctx.moveTo(8, -2);
  ctx.lineTo(11, -7);
  ctx.stroke();
  if (ped.weapon) {
    ctx.fillStyle = '#23232b';
    ctx.fillRect(6, -14, 3, 9);
  }
  if (ped.kind === 'cop') {
    ctx.fillStyle = '#1d2a44';
    ctx.beginPath();
    ctx.arc(0, -3, 6.5, Math.PI, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  void time;
}

function drawVehicle(ctx, v, time) {
  const spec = v.spec;
  const airLift = v.airTime > 0 ? Math.sin((v.airTime / 0.85) * Math.PI) * 22 : 0;
  ctx.save();
  ctx.translate(v.x, v.y);
  // Shadow stays on the ground while the car flies.
  ctx.fillStyle = PALETTE.shadow;
  ctx.save();
  ctx.rotate(v.angle);
  ctx.beginPath();
  ctx.ellipse(3, 5, spec.len / 2, spec.wid / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.translate(0, -airLift);
  ctx.rotate(v.angle);
  const scale = 1 + airLift * 0.004;
  ctx.scale(scale, scale);
  // Wheels.
  ctx.fillStyle = '#1c1c22';
  const wheelAngle = v.steer * 0.42;
  for (const [wx, wy, front] of [[-spec.len * 0.32, -spec.wid / 2, true], [-spec.len * 0.32, spec.wid / 2, true], [spec.len * 0.32, -spec.wid / 2, false], [spec.len * 0.32, spec.wid / 2, false]]) {
    ctx.save();
    ctx.translate(wx, wy);
    if (front) ctx.rotate(wheelAngle);
    ctx.fillRect(-6, -3.5, 12, 7);
    ctx.restore();
  }
  // Body.
  const damage = 1 - v.health / v.maxHealth;
  ctx.fillStyle = v.dead ? shade(v.color, -40) : v.color;
  ctx.beginPath();
  ctx.roundRect(-spec.len / 2, -spec.wid / 2, spec.len, spec.wid, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Hood and trunk shading.
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(-spec.len / 2 + 3, -spec.wid / 2 + 3, spec.len * 0.22, spec.wid - 6);
  // Cabin.
  const cabinLen = spec.len * 0.42;
  const cabinWid = spec.wid * 0.78;
  ctx.fillStyle = PALETTE.glass;
  ctx.beginPath();
  ctx.roundRect(-cabinLen * 0.3, -cabinWid / 2, cabinLen, cabinWid, 5);
  ctx.fill();
  ctx.fillStyle = shade(v.color, -26);
  ctx.fillRect(cabinLen * 0.55, -cabinWid / 2, spec.len * 0.16, cabinWid);
  if (v.model === 'van' || v.model === 'truck') {
    ctx.fillStyle = shade(v.color, 14);
    ctx.fillRect(-spec.len * 0.1, -spec.wid / 2 + 2, spec.len * 0.52, spec.wid - 4);
  }
  if (v.model === 'taxi') {
    ctx.fillStyle = '#23232b';
    for (let i = 0; i < 5; i++) ctx.fillRect(-spec.len * 0.3 + i * 7, -spec.wid / 2 + 1, 4, 4);
    ctx.fillStyle = '#f2c230';
    ctx.fillRect(-6, -4, 12, 8);
    ctx.fillStyle = '#23232b';
    ctx.font = 'bold 7px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  if (v.model === 'police') {
    ctx.fillStyle = '#e8e4da';
    ctx.fillRect(-spec.len * 0.18, -spec.wid / 2 + 2, spec.len * 0.34, spec.wid - 4);
    // Flashing light bar.
    const phase = Math.floor(time * 6 + v.sirenPhase) % 2 === 0;
    ctx.fillStyle = phase ? '#ff3a2a' : '#3a7aff';
    ctx.fillRect(-8, -spec.wid / 2 + 2, 10, 6);
    ctx.fillStyle = phase ? '#3a7aff' : '#ff3a2a';
    ctx.fillRect(-2, -spec.wid / 2 + 2, 10, 6);
  }
  // Headlights and taillights.
  ctx.fillStyle = '#fff8d8';
  ctx.fillRect(spec.len / 2 - 4, -spec.wid / 2 + 3, 4, 6);
  ctx.fillRect(spec.len / 2 - 4, spec.wid / 2 - 9, 4, 6);
  ctx.fillStyle = v.brakeLights ? '#ff2a1a' : '#a02818';
  ctx.fillRect(-spec.len / 2, -spec.wid / 2 + 3, 4, 6);
  ctx.fillRect(-spec.len / 2, spec.wid / 2 - 9, 4, 6);
  if (v.brakeLights) {
    ctx.fillStyle = 'rgba(255, 60, 40, 0.25)';
    ctx.fillRect(-spec.len / 2 - 12, -spec.wid / 2, 12, spec.wid);
  }
  // Burnt wreck.
  if (v.dead) {
    ctx.fillStyle = 'rgba(20, 20, 22, 0.45)';
    ctx.beginPath();
    ctx.roundRect(-spec.len / 2, -spec.wid / 2, spec.len, spec.wid, 8);
    ctx.fill();
  }
  ctx.restore();
}

function drawBullets(ctx, G) {
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 2;
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.stroke();
  }
}

function drawParticles(ctx, G) {
  for (const p of G.fx.particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Floating texts.
  ctx.textAlign = 'center';
  ctx.font = 'bold 17px Arial, sans-serif';
  for (const f of G.fx.floats) {
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(20, 20, 26, 0.8)';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawOffscreenObjectiveArrow(ctx, G, camera) {
  const objective = currentObjective(G);
  if (!objective) return;
  const screen = camera.worldToScreen(objective.x, objective.y);
  const margin = 46;
  if (screen.x > margin && screen.x < camera.width - margin && screen.y > margin && screen.y < camera.height - margin) return;
  const cx = camera.width / 2;
  const cy = camera.height / 2;
  const angle = Math.atan2(screen.y - cy, screen.x - cx);
  const ax = cx + Math.cos(angle) * (Math.min(camera.width, camera.height) / 2 - margin);
  const ay = cy + Math.sin(angle) * (Math.min(camera.width, camera.height) / 2 - margin);
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(angle);
  ctx.fillStyle = '#ffd23a';
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-8, -11);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-8, 11);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function renderWorld(G) {
  const { ctx, camera } = G;
  const view = visibleRect(camera);
  ctx.save();
  ctx.clearRect(0, 0, camera.width, camera.height);
  ctx.translate(camera.width / 2 + camera.shakeX, camera.height / 2 + camera.shakeY);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  drawGround(ctx, G, view);
  drawRoads(ctx, G, view);
  drawLandmarkZones(ctx, G, view);
  drawSkids(ctx, G);
  drawObjectiveBeacon(ctx, G);

  // Buildings, sorted by y so nearer ones overlap correctly.
  const visible = G.city.buildings.filter((b) => b.x + b.w > view.x0 && b.x < view.x1 && b.y + b.d > view.y0 && b.y < view.y1);
  visible.sort((a, b) => a.y - b.y);
  for (const b of visible) drawBuilding(ctx, b, G.time);
  drawProps(ctx, G, view);
  drawPickups(ctx, G, G.time);

  // Actors sorted by y: pedestrians, cars and the player on foot.
  const actors = [];
  for (const ped of G.peds) actors.push({ y: ped.y, draw: () => drawPed(ctx, ped, G.time) });
  for (const v of G.vehicles) actors.push({ y: v.y, draw: () => drawVehicle(ctx, v, G.time) });
  if (!G.player.inCar && !G.player.dead) {
    actors.push({
      y: G.player.y,
      draw: () => drawPed(ctx, {
        x: G.player.x, y: G.player.y, angle: G.player.angle, speed: G.player.moving ? 120 : 0,
        walkPhase: G.player.walkPhase, shirt: '#e8634f', skin: '#e8b88a', dead: false,
        weapon: G.player.weapon === 'fists' ? null : 'pistol', kind: 'hero',
      }, G.time),
    });
  }
  actors.sort((a, b) => a.y - b.y);
  for (const actor of actors) actor.draw();

  drawBullets(ctx, G);
  drawParticles(ctx, G);
  ctx.restore();

  // Golden-hour wash and the off-screen objective arrow, in screen space.
  const wash = ctx.createRadialGradient(
    camera.width / 2, camera.height / 2, Math.min(camera.width, camera.height) * 0.35,
    camera.width / 2, camera.height / 2, Math.max(camera.width, camera.height) * 0.75,
  );
  wash.addColorStop(0, 'rgba(255, 220, 150, 0.05)');
  wash.addColorStop(1, 'rgba(255, 180, 90, 0.13)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, camera.width, camera.height);
  drawOffscreenObjectiveArrow(ctx, G, camera);
}
