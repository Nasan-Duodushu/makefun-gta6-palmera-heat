// Palmera itself: a seeded coastal city of road grids, named districts, signed
// buildings, palms and lamps, docks to the south-west and a beach along the bottom.
// buildCity returns plain data — rectangles to collide with, things to draw, and the
// road queries the traffic and pedestrians use. Rendering lives in render.js.
window.PH = window.PH || {};

const ROOF_TONES = ['#ff8fab', '#ffb703', '#fb8500', '#e07a5f', '#c77dff', '#f28482'];
const WALL_TONES = ['#ffe5d9', '#d8f3dc', '#caf0f8', '#fde2e4', '#e2eafc', '#fff1d6'];
const NEON = ['#ff5d8f', '#00e5ff', '#ffc93c', '#7cff6b', '#ff8c42', '#c792ff'];

PH.districtAt = function districtAt(x, y) {
  if (y >= PH.WORLD.sandY) return 'Palmera Beach';
  if (x >= 1900 && y < 1100) return 'Marina Heights';
  if (x < 1300 && y >= 1500) return 'Dockside';
  if (x >= 2300 && y >= 1500) return 'Sunset Flats';
  if (x >= 900 && x < 2300 && y >= 950 && y < 1500) return 'Neon Mile';
  if (x < 1300 && y < 950) return 'Old Palmera';
  return 'Palmera';
};

PH.buildCity = function buildCity(rand) {
  const half = PH.ROAD.width / 2;
  const walk = PH.ROAD.sidewalk;
  const buildings = [];
  const colliders = [];
  const props = [];
  const signs = PH.SIGNS.slice();
  let signAt = 0;

  function addBuilding(x, y, w, h, tall) {
    const sign = signs[signAt % signs.length];
    signAt += 1;
    const b = {
      x, y, w, h, tall,
      wall: rand.pick(WALL_TONES), roof: rand.pick(ROOF_TONES),
      sign, neon: rand.pick(NEON), district: PH.districtAt(x + w / 2, y + h / 2),
      windows: rand.int(2, 5),
    };
    buildings.push(b);
    colliders.push({ x, y, w, h });
    return b;
  }

  // One building (or a 2x2 cluster) per city block between the roads.
  for (let i = 0; i < PH.V_ROADS.length - 1; i += 1) {
    for (let j = 0; j < PH.H_ROADS.length - 1; j += 1) {
      const x0 = PH.V_ROADS[i] + half + walk + 6;
      const x1 = PH.V_ROADS[i + 1] - half - walk - 6;
      const y0 = PH.H_ROADS[j] + half + walk + 6;
      const y1 = PH.H_ROADS[j + 1] - half - walk - 6;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      if (y0 > 1900) continue; // the southern strip is docks and beach, built below
      if (x0 < 1250 && y0 > 1350 && y0 < 1950) continue; // the Dockside container yard
      const split = rand.chance(0.55) ? 2 : 1;
      const cw = (x1 - x0) / split;
      const ch = (y1 - y0) / split;
      for (let a = 0; a < split; a += 1) {
        for (let b = 0; b < split; b += 1) {
          if (split === 2 && rand.chance(0.16)) continue; // a plaza gap in the block
          const m = rand.range(6, 16);
          addBuilding(x0 + a * cw + m, y0 + b * ch + m, cw - m * 2, ch - m * 2, rand.range(14, 64));
        }
      }
      // Palms and lamps dress the block corners.
      if (rand.chance(0.8)) props.push({ kind: 'palm', x: x0 + 4, y: y0 + 4, s: rand.range(0.85, 1.25) });
      if (rand.chance(0.6)) props.push({ kind: 'palm', x: x1 - 4, y: y1 - 4, s: rand.range(0.85, 1.25) });
      if (rand.chance(0.5)) props.push({ kind: 'bench', x: (x0 + x1) / 2, y: y0 - 2, a: 0 });
    }
  }

  // Dockside: two long warehouses and a yard of containers above the beach road.
  addBuilding(300, 1900, 340, 110, 16).sign = 'ALMACENES DEL PUERTO';
  addBuilding(760, 1900, 300, 110, 16).sign = 'FRIGORIFICO MAR';
  const CONTAINER = ['#c8553d', '#588157', '#3a6ea5', '#e0a458', '#7d5ba6'];
  for (let i = 0; i < 14; i += 1) {
    const cx = 260 + (i % 7) * 118;
    const cy = 1560 + Math.floor(i / 7) * 120;
    if (rand.chance(0.2)) continue;
    const c = { x: cx, y: cy, w: 96, h: 44, colour: rand.pick(CONTAINER), container: true };
    buildings.push(c);
    colliders.push({ x: cx, y: cy, w: 96, h: 44 });
  }

  // Lamps at every intersection corner, palms scattered over the sand.
  for (const vx of PH.V_ROADS) {
    for (const hy of PH.H_ROADS) {
      props.push({ kind: 'lamp', x: vx - half - 8, y: hy - half - 8 });
      props.push({ kind: 'lamp', x: vx + half + 8, y: hy + half + 8 });
    }
  }
  for (let i = 0; i < 46; i += 1) {
    props.push({ kind: 'palm', x: rand.range(40, PH.WORLD.width - 40), y: rand.range(PH.WORLD.sandY + 26, PH.WORLD.waterY - 60), s: rand.range(0.9, 1.4) });
  }
  // The beach boulevard: a proud double row of palms along the shore road.
  for (let x = 110; x < PH.WORLD.width - 60; x += 165) {
    props.push({ kind: 'palm', x: x + rand.range(-14, 14), y: 2084 + rand.range(-5, 5), s: rand.range(1.05, 1.35) });
    props.push({ kind: 'palm', x: x + 82 + rand.range(-14, 14), y: 2216 + rand.range(-5, 5), s: rand.range(1.05, 1.35) });
  }
  for (let i = 0; i < 12; i += 1) {
    props.push({ kind: 'bench', x: rand.range(80, PH.WORLD.width - 80), y: PH.WORLD.sandY + 14, a: Math.PI });
  }
  for (const p of props) {
    if (p.kind === 'palm') colliders.push({ x: p.x - 5, y: p.y - 5, w: 10, h: 10, soft: true });
    if (p.kind === 'lamp') colliders.push({ x: p.x - 3, y: p.y - 3, w: 6, h: 6, soft: true });
  }

  const pier = { x: 420, y: 2140, w: 130, h: 190 };

  function isRoad(x, y) {
    for (const vx of PH.V_ROADS) if (Math.abs(x - vx) <= half) return true;
    for (const hy of PH.H_ROADS) if (Math.abs(y - hy) <= half) return true;
    return false;
  }
  function isWater(x, y) {
    if (y < PH.WORLD.waterY) return false;
    return !(x >= pier.x && x <= pier.x + pier.w && y >= pier.y && y <= pier.y + pier.h);
  }
  /**
   * Push a circle at (x, y) out of every collider and the water; returns [x, y].
   * With `forCar` set, soft street furniture (lamp posts, palm trunks) is driven
   * through rather than collided with — a car must never grind dead on a lamp.
   */
  function resolve(x, y, r, forCar) {
    for (const c of colliders) {
      if (forCar && c.soft) continue;
      const nx = PH.clamp(x, c.x, c.x + c.w);
      const ny = PH.clamp(y, c.y, c.y + c.h);
      const dx = x - nx;
      const dy = y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 > 0.001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        y = ny + (dy / d) * r;
      } else {
        // Centre inside the rect: leave by the nearest face.
        const left = x - c.x;
        const right = c.x + c.w - x;
        const top = y - c.y;
        const bottom = c.y + c.h - y;
        const min = Math.min(left, right, top, bottom);
        if (min === left) x = c.x - r;
        else if (min === right) x = c.x + c.w + r;
        else if (min === top) y = c.y - r;
        else y = c.y + c.h + r;
      }
    }
    if (isWater(x, y)) y = PH.WORLD.waterY - r;
    x = PH.clamp(x, r, PH.WORLD.width - r);
    y = PH.clamp(y, r, PH.WORLD.height - r);
    return [x, y];
  }

  return { buildings, colliders, props, pier, isRoad, isWater, resolve };
};
