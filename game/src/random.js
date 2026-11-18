// A small seeded random number generator (mulberry32). The same seed builds the
// same city and stages the same screenshot scenes, which is what makes the
// ?shot= scenes repeatable frame for frame.

export function createRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomRange(rng, min, max) {
  return min + rng() * (max - min);
}

export function randomInt(rng, min, max) {
  return Math.floor(randomRange(rng, min, max + 1));
}

export function randomPick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function randomChance(rng, probability) {
  return rng() < probability;
}
