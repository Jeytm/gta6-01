// The city of Solmarina, generated from a seed: a 12x12 road grid, blocks of
// buildings in nine district styles, parks, palms, docks, piers and the bay.
// Collision is circle-vs-building-rectangle, looked up through the block grid.

import { WORLD, PALETTE, DISTRICTS, districtAt, LANDMARKS } from './config.js';
import { randomRange, randomInt, randomPick, randomChance } from './random.js';

const WALLS = [
  PALETTE.wallCream, PALETTE.wallWhite, PALETTE.wallPeach, PALETTE.wallMint,
  PALETTE.wallSky, PALETTE.wallBrick, PALETTE.wallGold,
];
const ROOFS = [PALETTE.roofTerracotta, PALETTE.roofSlate, PALETTE.roofSand, '#8a8f98'];

export function roadLines() {
  const lines = [];
  for (let i = 0; i < WORLD.roadCount; i++) lines.push(WORLD.firstRoad + i * WORLD.roadGap);
  return lines;
}

export function isRoadAt(x, y) {
  const half = WORLD.roadWidth / 2;
  for (const line of roadLines()) {
    if (Math.abs(x - line) <= half || Math.abs(y - line) <= half) return true;
  }
  return false;
}

// Snap a point to the nearest road centre line (used to place cars on roads).
export function nearestRoadPoint(x, y) {
  const lines = roadLines();
  let bestX = lines[0];
  let bestY = lines[0];
  for (const line of lines) {
    if (Math.abs(line - x) < Math.abs(bestX - x)) bestX = line;
    if (Math.abs(line - y) < Math.abs(bestY - y)) bestY = line;
  }
  if (Math.abs(bestX - x) <= Math.abs(bestY - y)) return { x: bestX, y };
  return { x, y: bestY };
}

function blockRects() {
  const lines = [-WORLD.roadGap + WORLD.firstRoad, ...roadLines(), WORLD.size + WORLD.roadGap - WORLD.firstRoad];
  const rects = [];
  for (let i = 0; i < lines.length - 1; i++) {
    for (let j = 0; j < lines.length - 1; j++) {
      const x0 = lines[i] + WORLD.roadWidth / 2;
      const x1 = lines[i + 1] - WORLD.roadWidth / 2;
      const y0 = lines[j] + WORLD.roadWidth / 2;
      const y1 = lines[j + 1] - WORLD.roadWidth / 2;
      rects.push({ x0, y0, x1, y1, i, j });
    }
  }
  return rects;
}

function makeBuilding(rng, x, y, w, d, style) {
  let h;
  if (style === 'towers') h = randomRange(rng, 55, 120);
  else if (style === 'mid') h = randomRange(rng, 26, 55);
  else if (style === 'docks') h = randomRange(rng, 13, 20);
  else h = randomRange(rng, 11, 30);
  return {
    x, y, w, d, h,
    face: randomPick(rng, WALLS),
    roof: randomPick(rng, ROOFS),
    seed: rng(),
    style,
  };
}

export function createCity(rng) {
  const buildings = [];
  const palms = [];
  const trees = [];
  const lamps = [];
  const crates = [];
  const hydrants = [];
  const parks = new Set();
  const rects = blockRects();

  // A few blocks become parks: trees and paths instead of buildings.
  for (let n = 0; n < 14; n++) {
    const r = rects[randomInt(rng, 0, rects.length - 1)];
    if (r.y0 > WORLD.sandY) continue;
    parks.add(`${r.i},${r.j}`);
  }
  // The central park is always green.
  parks.add('6,6');

  for (const rect of rects) {
    const cx = (rect.x0 + rect.x1) / 2;
    const cy = (rect.y0 + rect.y1) / 2;
    if (rect.y0 >= WORLD.sandY) continue; // beach and water, no blocks
    const district = districtAt(cx, cy);
    const key = `${rect.i},${rect.j}`;
    const inset = WORLD.sidewalk + 4;
    const bx0 = rect.x0 + inset;
    const by0 = rect.y0 + inset;
    const bx1 = rect.x1 - inset;
    const by1 = rect.y1 - inset;
    if (parks.has(key)) {
      const count = randomInt(rng, 5, 9);
      for (let t = 0; t < count; t++) {
        trees.push({ x: randomRange(rng, bx0, bx1), y: randomRange(rng, by0, by1), s: randomRange(rng, 14, 22), seed: rng() });
      }
      continue;
    }
    const style = district.style;
    if (style === 'towers' || style === 'docks') {
      const w = randomRange(rng, 0.45, 0.7) * (bx1 - bx0);
      const d = randomRange(rng, 0.45, 0.7) * (by1 - by0);
      const x = cx - w / 2 + randomRange(rng, -20, 20);
      const y = cy - d / 2 + randomRange(rng, -20, 20);
      buildings.push(makeBuilding(rng, x, y, w, d, style));
      if (style === 'docks') {
        for (let c = 0; c < randomInt(rng, 2, 5); c++) {
          crates.push({ x: randomRange(rng, bx0, bx1), y: randomRange(rng, by0, by1), s: randomRange(rng, 10, 16), seed: rng() });
        }
      }
    } else {
      // Split the block into a 2x2 of lots, each with a building or a yard.
      const mx = (bx0 + bx1) / 2;
      const my = (by0 + by1) / 2;
      const lots = [[bx0, by0, mx, my], [mx, by0, bx1, my], [bx0, my, mx, by1], [mx, my, bx1, by1]];
      for (const [lx0, ly0, lx1, ly1] of lots) {
        if (randomChance(rng, 0.18)) {
          trees.push({ x: (lx0 + lx1) / 2, y: (ly0 + ly1) / 2, s: randomRange(rng, 13, 19), seed: rng() });
          continue;
        }
        const pad = randomRange(rng, 8, 18);
        const w = lx1 - lx0 - pad * 2;
        const d = ly1 - ly0 - pad * 2;
        buildings.push(makeBuilding(rng, lx0 + pad, ly0 + pad, w, d, style));
      }
    }
    // Palms line the sidewalks of beach and palm districts; lamps everywhere.
    if (style === 'beach' || style === 'low' || style === 'color') {
      for (let p = 0; p < 3; p++) {
        palms.push({ x: randomRange(rng, rect.x0 + 6, rect.x1 - 6), y: rect.y0 + 6, s: randomRange(rng, 12, 17), seed: rng() });
      }
    }
  }

  // Lamps at every other intersection, hydrants scattered, palms on the beach.
  const lines = roadLines();
  for (let i = 0; i < lines.length; i += 2) {
    for (let j = 0; j < lines.length; j += 2) {
      lamps.push({ x: lines[i] + WORLD.roadWidth / 2 + 4, y: lines[j] + WORLD.roadWidth / 2 + 4 });
    }
  }
  for (let h = 0; h < 26; h++) {
    const x = randomRange(rng, 60, WORLD.size - 60);
    const y = randomRange(rng, 60, WORLD.sandY - 60);
    hydrants.push({ x, y });
  }
  for (let p = 0; p < 34; p++) {
    palms.push({ x: randomRange(rng, 40, WORLD.size - 40), y: randomRange(rng, WORLD.sandY + 6, WORLD.sandY + 90), s: randomRange(rng, 13, 19), seed: rng() });
  }

  const piers = [
    { x0: 940, x1: 1060, y0: WORLD.sandY - 10, y1: 4720 },
    { x0: 3340, x1: 3460, y0: WORLD.sandY - 10, y1: 4720 },
  ];

  const city = {
    buildings, palms, trees, lamps, crates, hydrants, piers,
    parkKeys: parks,
    districts: DISTRICTS,
    landmarks: LANDMARKS,
    blocks: rects,
    // Spatial lookup: block key -> buildings, for fast collision checks.
    grid: new Map(),
  };
  for (const b of buildings) {
    const key = `${Math.floor(b.x / WORLD.roadGap)},${Math.floor(b.y / WORLD.roadGap)}`;
    if (!city.grid.has(key)) city.grid.set(key, []);
    city.grid.get(key).push(b);
  }
  return city;
}

function circleHitsRect(x, y, r, rx, ry, rw, rd) {
  const cx = Math.max(rx, Math.min(x, rx + rw));
  const cy = Math.max(ry, Math.min(y, ry + rd));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < r * r;
}

export function onPier(city, x, y) {
  return city.piers.some((p) => x >= p.x0 && x <= p.x1 && y >= p.y0 && y <= p.y1);
}

// True when a circle at (x, y) with radius r touches a building, the water
// (unless on a pier), a tree trunk, or the edge of the world.
export function cityCollides(city, x, y, r) {
  if (x < r || y < r || x > WORLD.size - r || y > WORLD.size - r) return true;
  if (y > WORLD.waterY && !onPier(city, x, y)) return true;
  const gx = Math.floor(x / WORLD.roadGap);
  const gy = Math.floor(y / WORLD.roadGap);
  for (let i = gx - 1; i <= gx + 1; i++) {
    for (let j = gy - 1; j <= gy + 1; j++) {
      const list = city.grid.get(`${i},${j}`);
      if (!list) continue;
      for (const b of list) {
        if (circleHitsRect(x, y, r, b.x, b.y, b.w, b.d)) return true;
      }
    }
  }
  return false;
}

// Move with axis-separated sliding: try the full step, then x-only, then y-only.
export function moveWithCollision(city, x, y, dx, dy, r) {
  let hit = false;
  if (!cityCollides(city, x + dx, y + dy, r)) return { x: x + dx, y: y + dy, hit: false };
  hit = true;
  if (!cityCollides(city, x + dx, y, r)) return { x: x + dx, y, hit };
  if (!cityCollides(city, x, y + dy, r)) return { x, y: y + dy, hit };
  return { x, y, hit };
}

export function randomRoadPoint(city, rng) {
  const lines = roadLines();
  const horizontal = randomChance(rng, 0.5);
  const line = randomPick(rng, lines);
  const along = randomRange(rng, 100, WORLD.size - 100);
  return horizontal ? { x: along, y: line } : { x: line, y: along };
}

export function randomSidewalkPoint(city, rng) {
  for (let tries = 0; tries < 20; tries++) {
    const x = randomRange(rng, 80, WORLD.size - 80);
    const y = randomRange(rng, 80, WORLD.sandY - 80);
    if (!isRoadAt(x, y) && !cityCollides(city, x, y, 10)) return { x, y };
  }
  return { x: 1000, y: 1000 };
}
