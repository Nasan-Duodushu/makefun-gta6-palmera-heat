// The law: a wanted level from one to five stars, interceptor cars that hunt the
// player across the city, and uniformed officers on foot who chase, and at three
// stars shoot. Stay unseen long enough and the heat cools, star by star. Get held
// at walking pace with an officer on you and the run ends BUSTED.
window.PH = window.PH || {};

PH.commitCrime = function commitCrime(G, minStars) {
  if (minStars > G.wanted.stars) {
    G.wanted.stars = Math.min(5, minStars);
    G.audio.sting();
  }
  G.wanted.unseen = 0;
  G.wanted.lastCrime = G.time;
};

/** A road point a few blocks from the player, where a unit can join the chase. */
function spawnPoint(G, minD, maxD) {
  for (let tries = 0; tries < 10; tries += 1) {
    const vx = PH.rand.pick(PH.V_ROADS);
    const hy = PH.rand.pick(PH.H_ROADS);
    const x = vx + PH.rand.range(-30, 30);
    const y = hy + PH.rand.range(-30, 30);
    const d = PH.dist(x, y, G.player.x, G.player.y);
    if (d >= minD && d <= maxD) return [x, y];
  }
  return [PH.clamp(G.player.x + 700, 60, PH.WORLD.width - 60), PH.clamp(G.player.y, 60, PH.WORLD.height - 60)];
}

function maintainForces(G) {
  const stars = G.wanted.stars;
  const wantCars = PH.WANTED.policeCars[stars];
  const cars = G.cars.filter((c) => c.driver === 'police' && !c.dead);
  if (cars.length < wantCars) {
    const [x, y] = spawnPoint(G, 640, 980);
    const car = PH.createCar('police', x, y, PH.angleTo(x, y, G.player.x, G.player.y));
    car.driver = 'police';
    car.ai = { stuckAt: 0, reverseAt: 0 };
    G.cars.push(car);
  } else if (cars.length > wantCars) {
    const extra = cars[cars.length - 1];
    if (PH.dist(extra.x, extra.y, G.player.x, G.player.y) > 500) {
      G.cars.splice(G.cars.indexOf(extra), 1);
    }
  }
  const wantCops = PH.WANTED.footCops[stars];
  if (G.cops.length < wantCops) {
    const [x, y] = spawnPoint(G, 420, 760);
    const cop = PH.makePed(x, y, 'cop');
    cop.hp = 80;
    cop.shirt = '#27354d';
    G.cops.push(cop);
  } else if (G.cops.length > wantCops && G.cops.length > 0) {
    const extra = G.cops[G.cops.length - 1];
    if (PH.dist(extra.x, extra.y, G.player.x, G.player.y) > 420) G.cops.pop();
  }
}

function drivePoliceCar(G, car, dt) {
  const target = G.player.car || G.player;
  const ai = car.ai;
  const d = PH.dist(car.x, car.y, target.x, target.y);
  // Aim where the target is heading, so intercepts cut corners chases cannot.
  const lead = PH.clamp(d / 300, 0, 0.8);
  const tx = target.x + (target.vx || 0) * lead;
  const ty = target.y + (target.vy || 0) * lead;
  const want = PH.angleTo(car.x, car.y, tx, ty);
  const delta = PH.angleDelta(car.angle, want);
  const steer = PH.clamp(delta * 2.4, -1, 1);
  let throttle = 1;
  if (ai.reverseAt > 0) { ai.reverseAt -= dt; throttle = -1; }
  else if (Math.abs(delta) > 2.5 && PH.carSpeed(car) < 60) throttle = -1;
  if (d < 46) throttle = 0.25; // pull alongside rather than through the target
  if (PH.carSpeed(car) < 14 && throttle > 0) {
    ai.stuckAt += dt;
    if (ai.stuckAt > 1.6) { ai.reverseAt = 0.7; ai.stuckAt = 0; }
  } else ai.stuckAt = 0;
  PH.stepCar(G, car, { throttle, steer, handbrake: Math.abs(delta) > 1.9 && PH.carSpeed(car) > 200 }, dt);
  PH.carEffects(G, car, dt);
}

function updateFootCop(G, cop, dt) {
  if (cop.down) { cop.downAt += dt; return; }
  const player = G.player;
  const d = PH.dist(cop.x, cop.y, player.x, player.y);
  const canShoot = G.wanted.stars >= PH.WANTED.copShotsFrom;
  const holdAt = canShoot ? 235 : 24;
  if (d > holdAt) {
    const speed = player.car ? 120 : 196;
    const want = PH.angleTo(cop.x, cop.y, player.x, player.y);
    cop.angle += PH.clamp(PH.angleDelta(cop.angle, want), -6 * dt, 6 * dt);
    const [rx, ry] = G.city.resolve(cop.x + Math.cos(cop.angle) * speed * dt, cop.y + Math.sin(cop.angle) * speed * dt, 11);
    cop.x = rx;
    cop.y = ry;
    cop.walkPhase += dt * speed * 0.11;
  } else if (canShoot) {
    cop.angle = PH.angleTo(cop.x, cop.y, player.x, player.y);
    cop.shootCd -= dt;
    if (cop.shootCd <= 0 && d < 330) {
      cop.shootCd = PH.rand.range(0.7, 1.3);
      PH.enemyShoot(G, cop, player.car || player, 15);
    }
  } else {
    cop.angle = PH.angleTo(cop.x, cop.y, player.x, player.y);
  }
}

PH.updatePolice = function updatePolice(G, dt) {
  const w = G.wanted;
  if (w.stars > 0) {
    // Seen while any unit is close, or a fresh crime is still warm.
    let seen = G.time - w.lastCrime < 4;
    if (!seen) {
      for (const c of G.cars) if (c.driver === 'police' && PH.dist(c.x, c.y, G.player.x, G.player.y) < 470) { seen = true; break; }
    }
    if (!seen) for (const cop of G.cops) if (!cop.down && PH.dist(cop.x, cop.y, G.player.x, G.player.y) < 380) { seen = true; break; }
    if (seen) w.unseen = 0;
    else {
      w.unseen += dt;
      if (w.unseen > PH.WANTED.decaySeconds[w.stars]) {
        w.stars -= 1;
        w.unseen = 0;
      }
    }
  }
  maintainForces(G);
  for (const car of G.cars) if (car.driver === 'police' && !car.dead) drivePoliceCar(G, car, dt);
  for (const cop of G.cops) updateFootCop(G, cop, dt);
  for (let i = G.cops.length - 1; i >= 0; i -= 1) {
    if (G.cops[i].down && G.cops[i].downAt > 8) G.cops.splice(i, 1);
  }

  // Busted: held close and slow, the meter fills; break away and it drains.
  const speed = G.player.car ? PH.carSpeed(G.player.car) : PH.dist(0, 0, G.player.vx || 0, G.player.vy || 0);
  let held = false;
  if (w.stars > 0 && speed < 42) {
    for (const cop of G.cops) if (!cop.down && PH.dist(cop.x, cop.y, G.player.x, G.player.y) < 44) held = true;
    if (!held) for (const c of G.cars) if (c.driver === 'police' && PH.dist(c.x, c.y, G.player.x, G.player.y) < 74) held = true;
  }
  G.bust = PH.clamp(G.bust + (held ? dt / PH.WANTED.bustSeconds : -dt * 0.8), 0, 1);
  if (G.bust >= 1 && G.screen === 'play') G.onBusted();
};
