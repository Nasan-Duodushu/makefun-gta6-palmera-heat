// The player: one person on foot, or whatever car they have taken. On foot they
// walk and run, aim with the mouse, swing with F and shoot with a click; Q swaps
// fists and pistol, R reloads. E climbs into a nearby car — parked ones quietly,
// moving ones by pulling the driver out — and E climbs out again.
window.PH = window.PH || {};

PH.createPlayer = function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, aim: -Math.PI / 2, vx: 0, vy: 0,
    health: PH.PLAYER.health, car: null, walkPhase: 0, moving: false,
    weapon: 'pistol', ammo: PH.PISTOL.mag, reserve: 48,
    shootCd: 0, reloadAt: 0, swingAt: -9,
  };
};

PH.damagePlayer = function damagePlayer(G, amount) {
  const p = G.player;
  if (G.screen !== 'play') return;
  if (p.car) {
    p.car.health -= amount * 0.75;
    p.health -= amount * 0.3;
    if (p.car.health <= 0 && !p.car.dead) { p.car.dead = true; G.onCarWrecked(p.car); }
  } else {
    p.health -= amount;
  }
  G.shake = Math.min(9, G.shake + amount * 0.14);
  PH.burst(G, p.x, p.y, 'spark', 2);
  if (p.health <= 0) { p.health = 0; G.onWasted(); }
};

function nearestCar(G, range) {
  let best = null;
  let bestD = range;
  for (const car of G.cars) {
    if (car.dead) continue;
    const d = PH.dist(G.player.x, G.player.y, car.x, car.y) - car.spec.length * 0.4;
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function enterCar(G, car) {
  const p = G.player;
  if (car.driver === 'traffic') {
    // The driver is pulled out and runs for it.
    const driver = PH.makePed(car.x + 20, car.y + 10, 'walker');
    driver.state = 'flee';
    driver.fleeAt = 3.5;
    driver.fleeX = p.x;
    driver.fleeY = p.y;
    G.peds.push(driver);
    PH.scarePeds(G, car.x, car.y, 130);
    PH.commitCrime(G, 1);
  }
  if (car.driver === 'police') PH.commitCrime(G, 2);
  car.driver = 'player';
  car.ai = null;
  p.car = car;
  p.x = car.x;
  p.y = car.y;
  G.audio.door();
}

function exitCar(G) {
  const p = G.player;
  const car = p.car;
  car.driver = 'parked';
  const side = car.angle + Math.PI / 2;
  const [rx, ry] = G.city.resolve(car.x + Math.cos(side) * (car.spec.width / 2 + 16), car.y + Math.sin(side) * (car.spec.width / 2 + 16), 12);
  p.x = rx;
  p.y = ry;
  p.car = null;
  G.audio.door();
}

PH.updatePlayer = function updatePlayer(G, dt) {
  const p = G.player;
  const input = G.input;
  const actions = G.frameActions;
  p.shootCd = Math.max(0, p.shootCd - dt);
  p.aim = PH.angleTo(p.x, p.y, G.mouseWorld.x, G.mouseWorld.y);

  if (p.reloadAt > 0) {
    p.reloadAt -= dt;
    if (p.reloadAt <= 0 && p.ammo < PH.PISTOL.mag && p.reserve > 0) {
      const take = Math.min(PH.PISTOL.mag - p.ammo, p.reserve);
      p.ammo += take;
      p.reserve -= take;
    }
  }
  if (actions & PH.ACT.RELOAD && p.reloadAt <= 0 && p.ammo < PH.PISTOL.mag && p.reserve > 0) {
    p.reloadAt = PH.PISTOL.reloadTime;
    G.audio.reload();
  }
  if (actions & PH.ACT.WEAPON) p.weapon = p.weapon === 'pistol' ? 'fists' : 'pistol';

  if (p.car) {
    const car = p.car;
    const control = {
      throttle: (input.up() ? 1 : 0) - (input.down() ? 1 : 0),
      steer: (input.right() ? 1 : 0) - (input.left() ? 1 : 0),
      handbrake: input.brake(),
    };
    PH.stepCar(G, car, control, dt);
    PH.carEffects(G, car, dt);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    if (actions & PH.ACT.HORN) G.audio.horn();
    if (actions & PH.ACT.INTERACT && PH.carSpeed(car) < 60) exitCar(G);
    return;
  }

  // On foot.
  const mx = (input.right() ? 1 : 0) - (input.left() ? 1 : 0);
  const my = (input.down() ? 1 : 0) - (input.up() ? 1 : 0);
  p.moving = mx !== 0 || my !== 0;
  if (p.moving) {
    const len = Math.hypot(mx, my);
    const speed = input.run() ? PH.PLAYER.runSpeed : PH.PLAYER.walkSpeed;
    p.vx = (mx / len) * speed;
    p.vy = (my / len) * speed;
    p.angle = Math.atan2(my, mx);
    p.walkPhase += dt * speed * 0.09;
  } else { p.vx = 0; p.vy = 0; }
  const [rx, ry] = G.city.resolve(p.x + p.vx * dt, p.y + p.vy * dt, PH.PLAYER.radius);
  // Wading is allowed on the pier only; resolve() already keeps walkers out of the sea.
  p.x = rx;
  p.y = ry;

  if (actions & PH.ACT.INTERACT) {
    const car = nearestCar(G, PH.PLAYER.enterRange);
    if (car && PH.carSpeed(car) < 55) enterCar(G, car);
  }
  if (actions & PH.ACT.MELEE && p.weapon === 'pistol') p.weapon = 'fists';
  if ((actions & PH.ACT.MELEE) || (input.mouse.down && p.weapon === 'fists')) {
    if (G.time - p.swingAt > 0.34) PH.playerMelee(G);
  }
  if (input.mouse.down && p.weapon === 'pistol' && p.shootCd <= 0 && p.reloadAt <= 0) {
    PH.playerShoot(G, G.mouseWorld.x, G.mouseWorld.y);
  }
};

PH.drawPlayer = function drawPlayer(ctx, G) {
  const p = G.player;
  if (p.car) return; // the car is the player while driving
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(30,20,40,0.28)';
  ctx.beginPath();
  ctx.ellipse(1, 3, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(p.angle);
  const stride = p.moving ? Math.sin(p.walkPhase) * 5 : 0;
  ctx.strokeStyle = '#263238';
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(-4 + stride * 0.4, -6);
  ctx.moveTo(0, 0); ctx.lineTo(-4 - stride * 0.4, 6);
  ctx.stroke();
  // A sunset-orange jacket: the one splash of colour that is always the player.
  ctx.fillStyle = '#ff7b33';
  ctx.beginPath();
  ctx.roundRect(-8, -7.5, 17, 15, 6);
  ctx.fill();
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(-8, -2, 17, 4);
  ctx.restore();
  // The gun arm points at the mouse, and a swing shows as a quick arc.
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.aim);
  if (p.weapon === 'pistol') {
    ctx.fillStyle = '#22242a';
    ctx.fillRect(6, -2, 16, 4.5);
    ctx.fillStyle = '#f2c9a0';
    ctx.fillRect(2, -2.5, 6, 5);
  } else if (G.time - p.swingAt < 0.16) {
    ctx.strokeStyle = 'rgba(255,240,210,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 30, -0.7, 0.7);
    ctx.stroke();
  }
  ctx.restore();
};
