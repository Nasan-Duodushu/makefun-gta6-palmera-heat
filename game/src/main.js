// PALMERA HEAT — boot, the loop, and the game's wiring. The world advances in fixed
// 1/60 s steps; screens (title, how-to, play, pause, wasted, busted) decide what a
// step does and what a frame draws. Everything the other files need from each other
// travels through the one game object G built here.
//
// ?seed=N fixes the city's traffic luck. ?shot=chase|title|combat|end (with &seed=N)
// stages a deterministic scene instead of running the loop, paints it and sets
// window.__shotReady — that is how the screenshots in screenshots/ were taken.
window.PH = window.PH || {};

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
if (Number.isInteger(seedParam)) PH.rand = PH.createRandom(seedParam);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const G = {
  screen: 'title', time: 0, dt: PH.STEP, clock: 17 * 60 + 25, // golden hour
  city: null, cars: [], peds: [], cops: [], bullets: [], particles: [],
  skids: [], pickups: [], texts: [], dialogue: [], uiButtons: [],
  player: null, cash: 250, bust: 0,
  wanted: { stars: 0, unseen: 0, lastCrime: -99 },
  mission: PH.createMissionState(),
  camera: { x: 900, y: 900, w: 1280, h: 800 },
  view: { w: 1280, h: 800 }, dpr: 1, shake: 0,
  mouseWorld: { x: 0, y: 0 }, frameActions: 0, prompt: '',
  bannerTitle: '', bannerSub: '', bannerAt: -99,
  audio: PH.createAudio(), input: null,

  say(who, text) {
    G.dialogue.push({ who, text, ttl: 2.1 + text.length * 0.042 });
    if (G.dialogue.length > 4) G.dialogue.shift();
  },
  banner(title, sub) {
    G.bannerTitle = title;
    G.bannerSub = sub || '';
    G.bannerAt = G.time;
  },
  floatText(x, y, text, colour) {
    G.texts.push({ x, y, text, colour, life: 1.3 });
  },
  dropPickup(x, y, kind, amount) {
    G.pickups.push({ x, y, kind, amount, bob: PH.rand.range(0, 6) });
  },

  onCarCrash(car, strength, other) {
    PH.burst(G, car.x, car.y, 'spark', Math.floor(3 + strength * 8));
    if (PH.dist(car.x, car.y, G.player.x, G.player.y) < 700) G.audio.crash(strength);
    if (car.driver === 'player') {
      G.shake = Math.min(10, G.shake + strength * 7);
      if (strength > 0.3) PH.commitCrime(G, other && other.driver === 'police' ? 2 : 1);
    }
    PH.scarePeds(G, car.x, car.y, 110);
  },
  onCarWrecked(car) {
    PH.burst(G, car.x, car.y, 'smoke', 16);
    PH.burst(G, car.x, car.y, 'spark', 10);
    if (G.player && G.player.car === car) {
      G.player.car = null;
      car.driver = 'parked';
      G.player.health -= 8;
      G.floatText(car.x, car.y - 30, 'WRECKED', '#ef476f');
      if (G.player.health <= 0) { G.player.health = 0; G.onWasted(); }
    }
  },
  onGunmanDown(target) {
    const hostiles = G.mission.data.hostiles;
    if (hostiles && hostiles.includes(target)) {
      G.mission.data.left = Math.max(0, (G.mission.data.left || 1) - 1);
      G.floatText(target.x, target.y - 20, 'DOWN', '#ffd166');
    }
  },
  failMission(why) {
    if (G.mission.phase !== 'active') return;
    G.banner('MISSION FAILED', why);
    G.audio.fail();
    cleanupMissionEntities();
    G.mission.phase = 'offer';
    G.mission.stage = 0;
    G.mission.data = {};
  },
  onWasted() { endRun('wasted'); },
  onBusted() { endRun('busted'); },
};
window.PH_GAME = G;

function cleanupMissionEntities() {
  const data = G.mission.data;
  if (data.hostiles) {
    for (const h of data.hostiles) {
      const i = G.peds.indexOf(h);
      if (i >= 0) G.peds.splice(i, 1);
    }
  }
  if (data.rival) {
    const i = G.cars.indexOf(data.rival);
    if (i >= 0) G.cars.splice(i, 1);
  }
}

function endRun(kind) {
  if (G.screen !== 'play') return;
  G.screen = kind;
  G.cash = Math.max(0, G.cash - 100);
  cleanupMissionEntities();
  if (G.mission.phase === 'active') {
    G.mission.phase = 'offer';
    G.mission.stage = 0;
    G.mission.data = {};
  }
  G.audio.fail();
  G.audio.engine(null);
}

function respawn() {
  const p = G.player;
  if (p.car) { p.car.driver = 'parked'; p.car = null; }
  p.health = 100;
  p.ammo = PH.PISTOL.mag;
  const spot = PH.SPOTS.safehouse;
  const [rx, ry] = G.city.resolve(spot.x + 60, spot.y + 40, 13);
  p.x = rx;
  p.y = ry;
  G.wanted.stars = 0;
  G.wanted.unseen = 0;
  G.bust = 0;
  G.cops = G.cops.filter(() => false);
  for (let i = G.cars.length - 1; i >= 0; i -= 1) if (G.cars[i].driver === 'police') G.cars.splice(i, 1);
  G.screen = 'play';
  PH.saveGame({ cash: G.cash, mission: G.mission.index, x: p.x, y: p.y });
}

function newGame(fromSave) {
  const save = fromSave ? PH.loadGame() : null;
  if (!fromSave) PH.clearSave();
  G.city = PH.buildCity(PH.createRandom(20261124)); // one fixed Palmera for every visit
  G.cars = [];
  G.peds = [];
  G.cops = [];
  G.bullets = [];
  G.particles = [];
  G.skids = [];
  G.pickups = [];
  G.texts = [];
  G.dialogue = [];
  G.cash = save ? save.cash : 250;
  G.bust = 0;
  G.wanted = { stars: 0, unseen: 0, lastCrime: -99 };
  G.mission = PH.createMissionState();
  if (save && typeof save.mission === 'number') {
    G.mission.index = PH.clamp(save.mission, 0, PH.MISSIONS.length);
    G.mission.phase = G.mission.index >= PH.MISSIONS.length ? 'done' : 'offer';
  }
  const startX = save && typeof save.x === 'number' ? save.x : 1000;
  const startY = save && typeof save.y === 'number' ? save.y : 1560;
  G.player = PH.createPlayer(startX, startY);
  const [rx, ry] = G.city.resolve(startX, startY, 13);
  G.player.x = rx;
  G.player.y = ry;
  PH.spawnParked(G, 26);
  PH.spawnTraffic(G, 14);
  PH.spawnPeds(G, 42);
  G.camera.x = PH.clamp(G.player.x - G.view.w / 2, 0, PH.WORLD.width - G.view.w);
  G.camera.y = PH.clamp(G.player.y - G.view.h / 2, 0, PH.WORLD.height - G.view.h);
  G.screen = 'play';
  if (!save) {
    G.say('MARISOL', 'Nia — welcome to Palmera. Gold light, first job. Come to Club Sirena.');
  }
}

/** One fixed step of the living city (also the title screen's backdrop life). */
function stepWorld(dt, withPlayer) {
  G.time += dt;
  if (withPlayer) {
    G.clock = (G.clock + dt * 0.5) % (24 * 60);
    PH.updatePlayer(G, dt);
    PH.updatePolice(G, dt);
    PH.updateMissions(G, dt);
    // The player's car meeting a pedestrian is the crime it looks like.
    const car = G.player.car;
    if (car && PH.carSpeed(car) > 130) {
      for (const ped of G.peds) {
        if (!ped.down && PH.dist(ped.x, ped.y, car.x, car.y) < 30) {
          PH.downTarget(G, ped);
          car.health -= 4;
          G.shake = Math.min(9, G.shake + 2.5);
        }
      }
      for (const cop of G.cops) {
        if (!cop.down && PH.dist(cop.x, cop.y, car.x, car.y) < 30) PH.downTarget(G, cop);
      }
    }
  }
  PH.updateTraffic(G, dt);
  PH.updatePeds(G, dt);
  PH.updateBullets(G, dt);
  PH.updateFx(G, dt);
  if (G.dialogue.length) {
    G.dialogue[0].ttl -= dt;
    if (G.dialogue[0].ttl <= 0) G.dialogue.shift();
  }
  // The little prompt over the player's head: what E would do right now.
  G.prompt = '';
  if (withPlayer && !G.player.car) {
    for (const car of G.cars) {
      if (!car.dead && PH.dist(G.player.x, G.player.y, car.x, car.y) - car.spec.length * 0.4 < PH.PLAYER.enterRange) {
        G.prompt = car.driver === 'parked' ? 'E — take the ' + car.spec.name : 'E — steal the ' + car.spec.name;
        break;
      }
    }
  }
}

function updateCamera(dt) {
  const cam = G.camera;
  cam.w = G.view.w;
  cam.h = G.view.h;
  if (G.screen === 'title' || G.screen === 'howto') {
    cam.x = 1050 + Math.sin(G.time * 0.05) * 260;
    cam.y = 950 + Math.cos(G.time * 0.037) * 200;
    return;
  }
  const p = G.player;
  const lead = p.car ? 0.42 : 0.12;
  const tx = p.x + (p.car ? p.car.vx : p.vx) * lead - cam.w / 2;
  const ty = p.y + (p.car ? p.car.vy : p.vy) * lead - cam.h / 2;
  const k = 1 - Math.exp(-(p.car ? 3.4 : 5.2) * dt);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  cam.x = PH.clamp(cam.x, 0, Math.max(0, PH.WORLD.width - cam.w));
  cam.y = PH.clamp(cam.y, 0, Math.max(0, PH.WORLD.height - cam.h));
}

function draw() {
  const cam = G.camera;
  const tint = PH.dayTint(G.clock);
  ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
  ctx.fillStyle = '#191024';
  ctx.fillRect(0, 0, G.view.w, G.view.h);
  const shX = G.shake > 0.2 ? PH.rand.range(-G.shake, G.shake) * 0.5 : 0;
  const shY = G.shake > 0.2 ? PH.rand.range(-G.shake, G.shake) * 0.5 : 0;
  ctx.save();
  ctx.translate(-Math.round(cam.x + shX), -Math.round(cam.y + shY));
  PH.drawWorld(ctx, G);
  PH.drawFx(ctx, G, false);
  for (const car of G.cars) {
    if (car.x < cam.x - 160 || car.y < cam.y - 160 || car.x > cam.x + cam.w + 160 || car.y > cam.y + cam.h + 160) continue;
    PH.drawCar(ctx, car, tint.dark);
  }
  for (const ped of G.peds) PH.drawPed(ctx, ped, G.time);
  for (const cop of G.cops) PH.drawPed(ctx, cop, G.time);
  if (G.screen !== 'title' && G.screen !== 'howto') PH.drawPlayer(ctx, G);
  PH.drawFx(ctx, G, true);
  ctx.restore();
  if (tint.alpha > 0) {
    ctx.fillStyle = tint.colour;
    ctx.fillRect(0, 0, G.view.w, G.view.h);
  }
  G.shake = Math.max(0, G.shake - 0.35);
  PH.drawScreen(ctx, G);
}

function resize() {
  G.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  G.view.w = window.innerWidth;
  G.view.h = window.innerHeight;
  canvas.width = Math.round(G.view.w * G.dpr);
  canvas.height = Math.round(G.view.h * G.dpr);
}

function handleScreenAction(action) {
  G.audio.unlock();
  if (action === 'new') newGame(false);
  else if (action === 'continue') newGame(true);
  else if (action === 'howto') G.screen = 'howto';
  else if (action === 'title') G.screen = 'title';
  else if (action === 'resume') G.screen = 'play';
  else if (action === 'restart') { PH.clearSave(); newGame(false); }
  else if (action === 'respawn') respawn();
}

function runGame() {
  G.input = PH.createInput(canvas);
  G.city = PH.buildCity(PH.createRandom(20261124));
  G.player = PH.createPlayer(1000, 1560);
  PH.spawnParked(G, 26);
  PH.spawnTraffic(G, 14);
  PH.spawnPeds(G, 42);
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('pointerdown', () => G.audio.unlock(), { once: true });
  window.addEventListener('keydown', () => G.audio.unlock(), { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.screen === 'play') G.screen = 'paused';
  });

  let accumulator = 0;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, 0.25);
    last = now;
    const input = G.input;
    const actions = input.takeActions();
    const clicked = input.takeClick();
    G.mouseWorld.x = G.camera.x + input.mouse.x / G.dpr;
    G.mouseWorld.y = G.camera.y + input.mouse.y / G.dpr;

    if (actions & PH.ACT.MUTE) {
      const muted = G.audio.toggleMute();
      G.floatText(G.player.x, G.player.y - 30, muted ? 'MUTED' : 'SOUND ON', '#fdf6ec');
    }
    if (G.screen === 'play' && (actions & PH.ACT.PAUSE)) G.screen = 'paused';
    else if (G.screen === 'paused' && (actions & PH.ACT.PAUSE)) G.screen = 'play';
    else if ((G.screen === 'wasted' || G.screen === 'busted') && (actions & PH.ACT.CONFIRM)) respawn();
    else if (G.screen === 'title' && (actions & PH.ACT.CONFIRM)) newGame(false);

    if (clicked && G.screen !== 'play') {
      const mx = input.mouse.x / G.dpr;
      const my = input.mouse.y / G.dpr;
      for (const b of G.uiButtons) {
        if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) { handleScreenAction(b.action); break; }
      }
    }

    let stepped = false;
    while (accumulator >= PH.STEP) {
      accumulator -= PH.STEP;
      if (G.screen === 'play') {
        G.frameActions = stepped ? 0 : actions;
        stepWorld(PH.STEP, true);
        stepped = true;
      } else if (G.screen === 'title' || G.screen === 'howto') {
        stepWorld(PH.STEP, false);
      } else {
        G.time += PH.STEP;
      }
    }
    G.frameActions = 0;
    updateCamera(Math.min((now - last) / 1000 + PH.STEP, 0.05));
    // Standing audio voices follow the frame.
    const driving = G.screen === 'play' && G.player.car;
    G.audio.engine(driving ? PH.clamp(PH.carSpeed(G.player.car) / G.player.car.spec.topSpeed, 0, 1) : null);
    let sirenNear = false;
    if (G.wanted.stars > 0) {
      for (const c of G.cars) if (c.driver === 'police' && PH.dist(c.x, c.y, G.player.x, G.player.y) < 620) { sirenNear = true; break; }
    }
    G.audio.siren(sirenNear, G.time);
    draw();
  }
  requestAnimationFrame(frame);
}

function runShot(name) {
  resize();
  PH.stageShot(G, name);
  let painted = 0;
  function paint() {
    draw();
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

if (shotName) runShot(shotName);
else runGame();
