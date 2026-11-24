// A small seeded random number generator (mulberry32) plus helpers built on it.
// The same seed grows the same city and stages the same screenshot, every time.
window.PH = window.PH || {};

PH.createRandom = function createRandom(seed) {
  let a = seed | 0;
  function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  random.range = (min, max) => min + random() * (max - min);
  random.int = (min, max) => Math.floor(random.range(min, max + 1));
  random.pick = (list) => list[Math.floor(random() * list.length) % list.length];
  random.chance = (p) => random() < p;
  return random;
};

/** The live game's generator: seeded once from the clock so every visit differs. */
PH.rand = PH.createRandom((Date.now() ^ 0x9e3779b9) | 0);

/** Clamp, lerp and friends, kept tiny and shared. */
PH.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
PH.lerp = (a, b, t) => a + (b - a) * t;
PH.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
PH.angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
/** Shortest signed turn from one heading to another, in radians. */
PH.angleDelta = (from, to) => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};
