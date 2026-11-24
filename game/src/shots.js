// The screenshot scenes behind ?shot=title|chase|combat|end (with &seed=N).
// Each builds the real city with the fixed Palmera seed, places the real entities,
// runs the real rules forward a little, and leaves the game on the frame to paint —
// so a screenshot is the game itself, staged, never a mock-up. The cover is the
// chase: a stolen Vireo at golden hour, three stars, the law behind, a delivery
// on the clock, and the minimap watching it all.
window.PH = window.PH || {};

function buildWorld(G) {
  G.city = PH.buildCity(PH.createRandom(20261124));
  G.cars = [];
  G.peds = [];
  G.cops = [];
  G.bullets = [];
  G.particles = [];
  G.skids = [];
  G.pickups = [];
  G.texts = [];
  G.dialogue = [];
  G.player = PH.createPlayer(1000, 1560);
  PH.spawnParked(G, 26);
  PH.spawnTraffic(G, 14);
  PH.spawnPeds(G, 42);
}

/** Advance the staged world without a human at the keys. */
function stepSim(G, steps, driveControl) {
  for (let i = 0; i < steps; i += 1) {
    G.time += PH.STEP;
    if (driveControl && G.player.car) {
      PH.stepCar(G, G.player.car, driveControl, PH.STEP);
      PH.carEffects(G, G.player.car, PH.STEP);
      G.player.x = G.player.car.x;
      G.player.y = G.player.car.y;
    }
    PH.updateTraffic(G, PH.STEP);
    PH.updatePeds(G, PH.STEP);
    PH.updatePolice(G, PH.STEP);
    PH.updateBullets(G, PH.STEP);
    PH.updateFx(G, PH.STEP);
  }
}

function centreCamera(G, x, y) {
  G.camera.x = PH.clamp(x - G.view.w / 2, 0, Math.max(0, PH.WORLD.width - G.view.w));
  G.camera.y = PH.clamp(y - G.view.h / 2, 0, Math.max(0, PH.WORLD.height - G.view.h));
  G.camera.w = G.view.w;
  G.camera.h = G.view.h;
}

function stageTitle(G) {
  buildWorld(G);
  G.screen = 'title';
  stepSim(G, 150, null);
  centreCamera(G, 1420, 1230);
}

function stageChase(G) {
  buildWorld(G);
  G.screen = 'play';
  G.cash = 640;
  G.clock = 17 * 60 + 38;
  // Clear the chase corridor so nothing wanders into the frame's path.
  for (let i = G.cars.length - 1; i >= 0; i -= 1) {
    const c = G.cars[i];
    if (Math.abs(c.y - 1400) < 115 && c.x > 250 && c.x < 2600) G.cars.splice(i, 1);
  }
  // Nia in a stolen Vireo GT, eastbound on the Neon Mile road, mid-delivery.
  const car = PH.createCar('sports', 980, 1400 + PH.ROAD.lane, 0, '#ef476f');
  car.driver = 'player';
  car.vx = 300;
  G.cars.push(car);
  G.player.car = car;
  G.player.x = car.x;
  G.player.y = car.y;
  G.mission.index = 1;
  G.mission.phase = 'active';
  G.mission.stage = 1;
  G.mission.timer = 87;
  G.wanted.stars = 3;
  G.wanted.lastCrime = 0;
  const spots = [[700, 1400 - PH.ROAD.lane], [792, 1400 + PH.ROAD.lane], [606, 1400 - PH.ROAD.lane]];
  for (const [x, y] of spots) {
    const cop = PH.createCar('police', x, y, 0);
    cop.driver = 'police';
    cop.vx = 330;
    cop.ai = { stuckAt: 0, reverseAt: 0 };
    G.cars.push(cop);
  }
  G.say('MARISOL', 'That is Ruiz behind you. The lookout, Nia — go!');
  stepSim(G, 50, { throttle: 0.85, steer: 0, handbrake: false });
  centreCamera(G, G.player.x + 120, G.player.y);
}

function stageCombat(G) {
  buildWorld(G);
  G.screen = 'play';
  G.cash = 1310;
  G.clock = 18 * 60 + 5;
  G.player.x = 618;
  G.player.y = 2112;
  G.player.angle = 0.2;
  G.player.aim = -0.35;
  G.player.health = 72;
  G.player.ammo = 9;
  G.mission.index = 3;
  G.mission.phase = 'active';
  G.mission.stage = 0;
  const spots = [[748, 2064], [838, 2126], [762, 2172]];
  G.mission.data.hostiles = [];
  for (const [x, y] of spots) {
    const gunman = PH.makePed(x, y, 'gunman');
    gunman.hp = 70;
    gunman.shirt = '#5b2a86';
    gunman.angle = Math.PI;
    G.peds.push(gunman);
    G.mission.data.hostiles.push(gunman);
  }
  const fallen = PH.makePed(706, 2148, 'gunman');
  fallen.shirt = '#5b2a86';
  fallen.down = true;
  fallen.downAt = 1.2;
  G.peds.push(fallen);
  G.mission.data.left = 3;
  G.wanted.stars = 1;
  G.say('NIA', 'You traced the wrong crate, friends.');
  stepSim(G, 26, null);
  // One frozen instant: her shot halfway to its mark, muzzle still lit.
  const a = -0.35;
  G.bullets.push({
    x: G.player.x + Math.cos(a) * 150, y: G.player.y + Math.sin(a) * 150,
    vx: Math.cos(a) * 1150, vy: Math.sin(a) * 1150, life: 0.3, from: 'player', damage: 34,
  });
  const flash = PH.spawnParticle(G.player.x + Math.cos(a) * 24, G.player.y + Math.sin(a) * 24, 'flash');
  flash.maxLife = 1;
  flash.life = 0.9;
  flash.size = 13;
  G.particles.push(flash);
  PH.burst(G, 748, 2064, 'spark', 4);
  centreCamera(G, G.player.x + 60, G.player.y);
}

function stageEnd(G) {
  buildWorld(G);
  G.screen = 'play';
  G.cash = 3540;
  G.clock = 18 * 60 + 44;
  G.mission.index = PH.MISSIONS.length;
  G.mission.phase = 'done';
  G.player.x = 470;
  G.player.y = 2206;
  G.player.angle = Math.PI / 2;
  const marisol = PH.makePed(512, 2218, 'walker');
  marisol.shirt = '#ffd166';
  marisol.angle = Math.PI / 2;
  G.peds.push(marisol);
  const car = PH.createCar('sports', 640, 2162, Math.PI, '#ffd166');
  car.driver = 'parked';
  G.cars.push(car);
  G.dropPickup(438, 2176, 'cash', 100);
  G.dropPickup(520, 2252, 'cash', 100);
  G.dropPickup(430, 2240, 'health', 30);
  G.time = 100;
  G.banner('MISSION COMPLETE', 'Last Sunset Run  ·  +$1500  ·  Story complete');
  G.bannerAt = 99.4;
  G.say('MARISOL', 'Palmera is yours now. Spend it loud.');
  centreCamera(G, 520, 2210);
}

PH.stageShot = function stageShot(G, name) {
  if (name === 'chase') stageChase(G);
  else if (name === 'combat') stageCombat(G);
  else if (name === 'end') stageEnd(G);
  else stageTitle(G);
};
