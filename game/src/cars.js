// Cars: one entity for everything with wheels — the player's stolen ride, traffic,
// police interceptors, parked cars. Movement is an arcade model: a velocity vector
// pulled toward the heading by grip, so a handbrake-speed turn slides (drift) and a
// wall stops you dead with sparks. Drawing is a rounded body, glass, lights and a
// damage state that smokes as the health goes.
window.PH = window.PH || {};

let nextCarId = 1;

PH.createCar = function createCar(typeName, x, y, angle, colour) {
  const type = PH.CAR_TYPES[typeName];
  return {
    id: nextCarId++, type: typeName, spec: type,
    x, y, angle, vx: 0, vy: 0, steer: 0,
    colour: colour || PH.rand.pick(type.colours),
    health: type.health, driver: 'parked', // parked | traffic | police | player | mission
    dead: false, smokeAt: 0, honkAt: 0,
    ai: null, // traffic/police steering state, set by their modules
  };
};

PH.carSpeed = (car) => Math.hypot(car.vx, car.vy);
PH.carForwardSpeed = (car) => car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle);

/**
 * Advance one car. `control` is {throttle -1..1, steer -1..1, handbrake} from a
 * driver, human or AI. Collisions with the city and other cars are resolved here;
 * impacts call G.onCarCrash(car, strength, other) so the game can react.
 */
PH.stepCar = function stepCar(G, car, control, dt) {
  const spec = car.spec;
  const fwdX = Math.cos(car.angle);
  const fwdY = Math.sin(car.angle);
  const fwdSpeed = car.vx * fwdX + car.vy * fwdY;

  if (control.throttle > 0) {
    const room = Math.max(0, 1 - fwdSpeed / spec.topSpeed);
    car.vx += fwdX * spec.accel * room * control.throttle * dt;
    car.vy += fwdY * spec.accel * room * control.throttle * dt;
  } else if (control.throttle < 0) {
    if (fwdSpeed > 12) { // brake lights first, reverse only from a near stop
      car.vx -= fwdX * spec.accel * 1.5 * dt;
      car.vy -= fwdY * spec.accel * 1.5 * dt;
    } else {
      const room = Math.max(0, 1 + fwdSpeed / spec.reverse);
      car.vx -= fwdX * spec.accel * 0.6 * room * dt;
      car.vy -= fwdY * spec.accel * 0.6 * room * dt;
    }
  }
  // Rolling drag and a firm stop at walking pace with no throttle.
  const drag = control.throttle === 0 ? 1.6 : 0.25;
  car.vx -= car.vx * drag * dt * 0.4;
  car.vy -= car.vy * drag * dt * 0.4;

  const steerPower = PH.clamp(Math.abs(fwdSpeed) / 60, 0, 1) * (fwdSpeed < 0 ? -1 : 1);
  car.angle += control.steer * 2.35 * steerPower * dt * (control.handbrake ? 1.35 : 1);
  car.steer = control.steer;

  // Grip: velocity swings toward the heading; drift keeps some of the slide.
  const grip = control.handbrake ? spec.grip * 0.32 : spec.grip;
  const keep = Math.exp(-grip * dt);
  const sideX = -fwdY;
  const sideY = fwdX;
  const sideSpeed = car.vx * sideX + car.vy * sideY;
  const newFwdX = Math.cos(car.angle);
  const newFwdY = Math.sin(car.angle);
  const keptFwd = car.vx * newFwdX + car.vy * newFwdY;
  const keptSide = (car.vx * -newFwdY + car.vy * newFwdX) * keep * (control.handbrake ? spec.drift + 0.1 : 1);
  car.vx = newFwdX * keptFwd + -newFwdY * keptSide;
  car.vy = newFwdY * keptFwd + newFwdX * keptSide;
  void sideSpeed;

  car.x += car.vx * dt;
  car.y += car.vy * dt;

  // City collision as a circle of just under half the car's length. A graze that
  // moves the car a hair is not a crash: only a real shove costs speed and paint.
  const r = spec.length * 0.42;
  const before = PH.carSpeed(car);
  const [nx, ny] = G.city.resolve(car.x, car.y, r, true);
  const shove = Math.hypot(nx - car.x, ny - car.y);
  if (shove > 0.01) {
    car.x = nx;
    car.y = ny;
    if (shove > 1.6) {
      if (before > 90) {
        G.onCarCrash(car, before / 340, null);
        car.health -= before * 0.05;
      }
      car.vx *= 0.35;
      car.vy *= 0.35;
    }
  }

  // Other cars: a soft shove apart, damage and noise when it is hard.
  for (const other of G.cars) {
    if (other === car || other.dead) continue;
    const dx = car.x - other.x;
    const dy = car.y - other.y;
    const min = (spec.length + other.spec.length) * 0.36;
    const d2 = dx * dx + dy * dy;
    if (d2 >= min * min || d2 === 0) continue;
    const d = Math.sqrt(d2);
    const push = (min - d) / 2;
    const ux = dx / d;
    const uy = dy / d;
    car.x += ux * push;
    car.y += uy * push;
    if (other.driver !== 'parked' || PH.carSpeed(car) > 60) { other.x -= ux * push; other.y -= uy * push; }
    const rel = Math.abs(PH.carForwardSpeed(car) - PH.carForwardSpeed(other));
    if (rel > 70) {
      G.onCarCrash(car, rel / 340, other);
      car.health -= rel * 0.045;
      other.health -= rel * 0.04;
      const swap = (car.vx + other.vx) / 2;
      car.vx = swap + ux * rel * 0.2;
      other.vx = swap - ux * rel * 0.2;
    }
  }
  if (car.health <= 0 && !car.dead) { car.dead = true; car.health = 0; G.onCarWrecked(car); }
};

/** Tyre marks and exhaust: called by the renderer-facing loop for moving cars. */
PH.carEffects = function carEffects(G, car, dt) {
  const speed = PH.carSpeed(car);
  const side = Math.abs(car.vx * -Math.sin(car.angle) + car.vy * Math.cos(car.angle));
  if (speed > 90 && side > 42) {
    const bx = Math.cos(car.angle) * -car.spec.length * 0.32;
    const by = Math.sin(car.angle) * -car.spec.length * 0.32;
    const px = -Math.sin(car.angle) * car.spec.width * 0.36;
    const py = Math.cos(car.angle) * car.spec.width * 0.36;
    G.skids.push({ x: car.x + bx + px, y: car.y + by + py, life: 5 });
    G.skids.push({ x: car.x + bx - px, y: car.y + by - py, life: 5 });
    if (G.skids.length > 900) G.skids.splice(0, G.skids.length - 900);
  }
  if (car.health < car.spec.health * 0.45 && speed > 4) {
    car.smokeAt -= dt;
    if (car.smokeAt <= 0) {
      car.smokeAt = 0.09;
      const puff = PH.spawnParticle(car.x + Math.cos(car.angle) * car.spec.length * 0.4, car.y + Math.sin(car.angle) * car.spec.length * 0.4, 'smoke');
      puff.maxLife = puff.life = 1.1;
      puff.size = 7;
      G.particles.push(puff);
    }
  }
};

PH.drawCar = function drawCar(ctx, car, dark) {
  const { length: L, width: W } = car.spec;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow, then body, glass and details in the car's own frame (nose toward +x).
  ctx.fillStyle = 'rgba(30,20,40,0.30)';
  ctx.beginPath();
  ctx.roundRect(-L / 2 + 3, -W / 2 + 5, L, W, 9);
  ctx.fill();
  ctx.fillStyle = car.dead ? '#3a3a40' : car.colour;
  ctx.beginPath();
  ctx.roundRect(-L / 2, -W / 2, L, W, 9);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.roundRect(-L / 2 + 4, -W / 2 + 3, L * 0.4, W - 6, 6);
  ctx.fill();
  ctx.fillStyle = '#1d2733';
  ctx.beginPath();
  ctx.roundRect(-L * 0.08, -W / 2 + 5, L * 0.3, W - 10, 4); // windscreen band
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(-L * 0.34, -W / 2 + 6, L * 0.16, W - 12, 4); // rear glass
  ctx.fill();
  if (car.type === 'taxi') {
    ctx.fillStyle = '#20242c';
    ctx.fillRect(-6, -8, 16, 16);
    ctx.fillStyle = '#f2b705';
    ctx.font = 'bold 9px ' + PH.FONT;
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 2, 3);
  }
  if (car.type === 'police') {
    ctx.fillStyle = '#f4f6f8';
    ctx.beginPath();
    ctx.roundRect(-L * 0.3, -W / 2 + 3, L * 0.62, W - 6, 5);
    ctx.fill();
    ctx.fillStyle = '#20242c';
    ctx.font = 'bold 10px ' + PH.FONT;
    ctx.textAlign = 'center';
    ctx.fillText('POLICIA', 0, 3.5);
    const phase = Math.floor(performance.now() / 280) % 2 === 0;
    ctx.fillStyle = phase ? '#ff3b30' : '#4da3ff';
    ctx.fillRect(-8, -W / 2 - 3, 16, 5);
    ctx.fillStyle = phase ? '#4da3ff' : '#ff3b30';
    ctx.fillRect(-8, W / 2 - 2, 16, 5);
  }
  if (car.type === 'pickup') {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(-L / 2 + 4, -W / 2 + 4, L * 0.36, W - 8);
  }
  // Wheels, turned with the steering at the front.
  ctx.fillStyle = '#15161a';
  const wy = W / 2 - 2;
  for (const [wx, front] of [[-L * 0.32, false], [L * 0.32, true]]) {
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(wx, s * wy);
      if (front) ctx.rotate(car.steer * 0.42);
      ctx.fillRect(-7, -3, 14, 6);
      ctx.restore();
    }
  }
  // Headlights after dusk: two cones ahead of the car.
  if (dark) {
    const grad = ctx.createLinearGradient(L / 2, 0, L / 2 + 130, 0);
    grad.addColorStop(0, 'rgba(255,236,170,0.30)');
    grad.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(L / 2, -W * 0.3);
    ctx.lineTo(L / 2 + 130, -W * 0.85);
    ctx.lineTo(L / 2 + 130, W * 0.85);
    ctx.lineTo(L / 2, W * 0.3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
};
