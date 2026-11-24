// Traffic: civilian cars that drive the road grid on the correct side, slow for
// whatever is in front of them, turn at intersections, and park along the kerbs.
// A traffic car's brain is tiny: it follows its lane, watches a short way ahead,
// and at each crossing sometimes picks a new road.
window.PH = window.PH || {};

const TRAFFIC_TYPES = ['compact', 'sedan', 'sedan', 'taxi', 'pickup', 'sports'];

/** The lane centre for a car on `axis` ('v' | 'h') of road `road`, going `sign` (+1 | -1). */
function laneOffset(axis, sign) {
  // Right-hand traffic: southbound keeps west, eastbound keeps south.
  return axis === 'v' ? -sign * PH.ROAD.lane : sign * PH.ROAD.lane;
}

function startOnRoad(car, rand) {
  const axis = rand.chance(0.5) ? 'v' : 'h';
  const roads = axis === 'v' ? PH.V_ROADS : PH.H_ROADS;
  const road = rand.pick(roads);
  const sign = rand.chance(0.5) ? 1 : -1;
  const along = rand.range(80, (axis === 'v' ? PH.WORLD.height : PH.WORLD.width) - 80);
  car.ai = { axis, road, sign, cruise: rand.range(120, 210), turnCooldown: 0 };
  if (axis === 'v') { car.x = road + laneOffset(axis, sign); car.y = along; car.angle = sign > 0 ? Math.PI / 2 : -Math.PI / 2; }
  else { car.x = along; car.y = road + laneOffset(axis, sign); car.angle = sign > 0 ? 0 : Math.PI; }
}

/** Something solid a short way ahead of this car? Returns 0..1 (1 = bumper to bumper). */
function obstacleAhead(G, car, reach) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let worst = 0;
  const test = (ox, oy, orad) => {
    const dx = ox - car.x;
    const dy = oy - car.y;
    const ahead = dx * fx + dy * fy;
    if (ahead < 6 || ahead > reach) return;
    const side = Math.abs(dx * -fy + dy * fx);
    if (side < orad + car.spec.width * 0.55) worst = Math.max(worst, 1 - ahead / reach);
  };
  for (const other of G.cars) if (other !== car && !other.dead) test(other.x, other.y, other.spec.length * 0.4);
  for (const ped of G.peds) if (!ped.down) test(ped.x, ped.y, 12);
  if (!G.player.car) test(G.player.x, G.player.y, 13);
  return worst;
}

PH.spawnTraffic = function spawnTraffic(G, count) {
  for (let i = 0; i < count; i += 1) {
    const car = PH.createCar(PH.rand.pick(TRAFFIC_TYPES), 0, 0, 0);
    car.driver = 'traffic';
    startOnRoad(car, PH.rand);
    G.cars.push(car);
  }
};

/** Parked cars along the kerbs: the stock the player steals from. */
PH.spawnParked = function spawnParked(G, count) {
  let placed = 0;
  let guard = 0;
  while (placed < count && guard < count * 30) {
    guard += 1;
    const vertical = PH.rand.chance(0.5);
    const road = PH.rand.pick(vertical ? PH.V_ROADS : PH.H_ROADS);
    const along = PH.rand.range(120, (vertical ? PH.WORLD.height : PH.WORLD.width) - 120);
    // Skip intersection mouths so parked cars never block a crossing.
    const cross = vertical ? PH.H_ROADS : PH.V_ROADS;
    if (cross.some((c) => Math.abs(c - along) < 110)) continue;
    const side = PH.rand.chance(0.5) ? 1 : -1;
    const off = side * (PH.ROAD.width / 2 - 13);
    const x = vertical ? road + off : along;
    const y = vertical ? along : road + off;
    if (G.city.isWater(x, y) || y > PH.WORLD.waterY - 60) continue;
    // Never nose-to-tail with another car: a stolen car must be able to pull out.
    if (G.cars.some((c) => PH.dist(c.x, c.y, x, y) < 130)) continue;
    const angle = vertical ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : (side > 0 ? Math.PI : 0);
    const car = PH.createCar(PH.rand.pick(TRAFFIC_TYPES), x, y, angle);
    car.driver = 'parked';
    G.cars.push(car);
    placed += 1;
  }
};

PH.updateTraffic = function updateTraffic(G, dt) {
  for (const car of G.cars) {
    if (car.driver !== 'traffic' || car.dead) continue;
    const ai = car.ai;
    ai.turnCooldown -= dt;
    // Where the lane wants the car to be, and the heading along it.
    const crossNow = ai.axis === 'v' ? car.x : car.y;
    const crossWant = ai.road + laneOffset(ai.axis, ai.sign);
    const steerToLane = PH.clamp((crossWant - crossNow) * 0.02, -0.5, 0.5);
    const heading = ai.axis === 'v' ? (ai.sign > 0 ? Math.PI / 2 : -Math.PI / 2) : (ai.sign > 0 ? 0 : Math.PI);
    const steer = PH.clamp(PH.angleDelta(car.angle, heading) * 2.2 + steerToLane, -1, 1);

    // Turning: at a crossing, sometimes take the road that crosses here.
    const along = ai.axis === 'v' ? car.y : car.x;
    const crossings = ai.axis === 'v' ? PH.H_ROADS : PH.V_ROADS;
    if (ai.turnCooldown <= 0) {
      for (const c of crossings) {
        if (Math.abs(along - c) < 14 && PH.rand.chance(0.4)) {
          const oldRoad = ai.road;
          ai.axis = ai.axis === 'v' ? 'h' : 'v';
          ai.road = c;
          ai.sign = PH.rand.chance(0.5) ? 1 : -1;
          ai.turnCooldown = 2.5;
          // Sit on the crossing road's centre line so the lane pull turns the car.
          if (ai.axis === 'v') car.x = oldRoad + PH.clamp(car.x - oldRoad, -20, 20);
          else car.y = oldRoad + PH.clamp(car.y - oldRoad, -20, 20);
          break;
        }
      }
    }

    const block = obstacleAhead(G, car, 96);
    let throttle = block > 0.55 ? -0.4 : block > 0.15 ? 0 : 0.75;
    if (PH.carForwardSpeed(car) > ai.cruise) throttle = 0;
    if (block > 0.3 && PH.rand.chance(0.01)) { car.honkAt = 0.4; G.audio.horn(); }
    PH.stepCar(G, car, { throttle, steer, handbrake: false }, dt);
    PH.carEffects(G, car, dt);
    // Keep traffic inside the world: respawn a wanderer that left the map.
    if (car.x < 30 || car.y < 30 || car.x > PH.WORLD.width - 30 || car.y > PH.WORLD.height - 30) startOnRoad(car, PH.rand);
  }
};
