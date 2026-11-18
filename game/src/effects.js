// Particles, skid marks, floating score text and screen shake. The renderer
// draws these lists; the systems below only spawn and age them.

export function createEffects() {
  return { particles: [], skids: [], floats: [], shake: 0, flash: 0 };
}

export function spawnParticles(fx, x, y, { count = 8, color = '#d8cbb0', speed = 90, life = 0.6, size = 3, gravity = 0, spread = Math.PI * 2, angle = 0 } = {}) {
  for (let i = 0; i < count; i++) {
    const a = angle + (Math.random() - 0.5) * spread;
    const s = speed * (0.3 + Math.random() * 0.9);
    fx.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: life * (0.6 + Math.random() * 0.7),
      maxLife: life,
      size: size * (0.6 + Math.random() * 0.8),
      color,
      gravity,
    });
  }
  if (fx.particles.length > 900) fx.particles.splice(0, fx.particles.length - 900);
}

export function spawnSmoke(fx, x, y, dark = false) {
  spawnParticles(fx, x, y, { count: 2, color: dark ? '#3a3a3f' : '#cfc8ba', speed: 26, life: 1.1, size: 7, gravity: -14 });
}

export function spawnSparks(fx, x, y) {
  spawnParticles(fx, x, y, { count: 6, color: '#ffd76a', speed: 190, life: 0.3, size: 2, gravity: 260 });
}

export function spawnBlood(fx, x, y) {
  spawnParticles(fx, x, y, { count: 7, color: '#a02c22', speed: 120, life: 0.5, size: 3, gravity: 300 });
}

export function spawnExplosion(fx, x, y) {
  spawnParticles(fx, x, y, { count: 26, color: '#ff9a3d', speed: 240, life: 0.7, size: 9, gravity: -40 });
  spawnParticles(fx, x, y, { count: 18, color: '#ffd76a', speed: 160, life: 0.45, size: 7 });
  spawnParticles(fx, x, y, { count: 14, color: '#4a4a50', speed: 70, life: 1.6, size: 11, gravity: -30 });
  addShake(fx, 16);
}

export function spawnSkid(fx, x, y, angle) {
  const last = fx.skids[fx.skids.length - 1];
  if (last && Math.hypot(last.x - x, last.y - y) < 9) return;
  fx.skids.push({ x, y, angle, life: 5 });
  if (fx.skids.length > 500) fx.skids.splice(0, fx.skids.length - 500);
}

export function spawnFloatText(fx, x, y, text, color = '#ffffff') {
  fx.floats.push({ x, y, text, color, life: 1.4 });
}

export function addShake(fx, amount) {
  fx.shake = Math.min(26, fx.shake + amount);
}

export function damageFlash(fx) {
  fx.flash = 0.55;
}

export function updateEffects(fx, dt) {
  for (let i = fx.particles.length - 1; i >= 0; i--) {
    const p = fx.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      fx.particles.splice(i, 1);
      continue;
    }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 1.6 * dt;
    p.vy *= 1 - 1.6 * dt;
  }
  for (let i = fx.skids.length - 1; i >= 0; i--) {
    fx.skids[i].life -= dt;
    if (fx.skids[i].life <= 0) fx.skids.splice(i, 1);
  }
  for (let i = fx.floats.length - 1; i >= 0; i--) {
    const f = fx.floats[i];
    f.life -= dt;
    f.y -= 34 * dt;
    if (f.life <= 0) fx.floats.splice(i, 1);
  }
  fx.shake = Math.max(0, fx.shake - 42 * dt);
  fx.flash = Math.max(0, fx.flash - 1.6 * dt);
}
