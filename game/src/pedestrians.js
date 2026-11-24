// Pedestrians: Palmera's walkers. They amble along sidewalks, plazas and the sand,
// pick a new corner when they arrive, and run from gunfire, fights and fast cars.
// The same body serves the story's gunmen and (in police.js) uniformed officers —
// what differs is the brain: wander, flee, fight, or chase.
window.PH = window.PH || {};

const SHIRTS = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#f78c6b', '#c792ff', '#f4f1de', '#e07a5f', '#81b29a'];
const SKINS = ['#f2c9a0', '#d9a066', '#a9713f', '#7a4a21', '#ffe0bd'];

PH.makePed = function makePed(x, y, kind) {
  return {
    x, y, angle: PH.rand.range(0, Math.PI * 2), kind: kind || 'walker',
    hp: 60, state: 'wander', tx: x, ty: y, thinkAt: 0, fleeAt: 0, fleeX: 0, fleeY: 0,
    down: false, downAt: 0, shootCd: PH.rand.range(0.4, 1.4), walkPhase: PH.rand.range(0, 6),
    shirt: PH.rand.pick(SHIRTS), skin: PH.rand.pick(SKINS), speed: PH.rand.range(52, 84),
  };
};

/** A point a walker would happily stand on: pavement, plaza or sand, never a wall or the sea. */
function walkablePoint(G, nearX, nearY, spread) {
  for (let tries = 0; tries < 8; tries += 1) {
    const x = PH.clamp(nearX + PH.rand.range(-spread, spread), 20, PH.WORLD.width - 20);
    const y = PH.clamp(nearY + PH.rand.range(-spread, spread), 20, PH.WORLD.height - 20);
    if (G.city.isWater(x, y)) continue;
    const [rx, ry] = G.city.resolve(x, y, 12);
    if (Math.abs(rx - x) < 2 && Math.abs(ry - y) < 2) return [x, y];
  }
  return null;
}

PH.spawnPeds = function spawnPeds(G, count) {
  for (let i = 0; i < count; i += 1) {
    // Cluster walkers around the lively districts and the beach.
    const hubs = [[1230, 1230], [2740, 500], [500, 500], [480, 2130], [1600, 900], [900, 1700]];
    const [hx, hy] = PH.rand.pick(hubs);
    const spot = walkablePoint(G, hx, hy, 620);
    if (!spot) continue;
    G.peds.push(PH.makePed(spot[0], spot[1], 'walker'));
  }
};

/** Danger at a point: nearby walkers run from it. Called for shots, fights, crashes. */
PH.scarePeds = function scarePeds(G, x, y, radius) {
  for (const ped of G.peds) {
    if (ped.down || ped.kind !== 'walker') continue;
    if (PH.dist(x, y, ped.x, ped.y) < radius) {
      ped.state = 'flee';
      ped.fleeAt = PH.rand.range(2.2, 4.2);
      ped.fleeX = x;
      ped.fleeY = y;
    }
  }
};

function movePed(G, ped, tx, ty, speed, dt) {
  const d = PH.dist(ped.x, ped.y, tx, ty);
  if (d < 4) return true;
  const want = PH.angleTo(ped.x, ped.y, tx, ty);
  ped.angle += PH.clamp(PH.angleDelta(ped.angle, want), -7 * dt, 7 * dt);
  const nx = ped.x + Math.cos(ped.angle) * speed * dt;
  const ny = ped.y + Math.sin(ped.angle) * speed * dt;
  const [rx, ry] = G.city.resolve(nx, ny, 11);
  ped.x = rx;
  ped.y = ry;
  ped.walkPhase += dt * speed * 0.11;
  return d < 16;
}

PH.updatePeds = function updatePeds(G, dt) {
  const px = G.player.x;
  const py = G.player.y;
  for (const ped of G.peds) {
    if (ped.down) { ped.downAt += dt; continue; }
    if (ped.kind === 'gunman') { PH.updateGunman(G, ped, dt); continue; }
    // A car bearing down is danger enough on its own.
    if (ped.state !== 'flee' && G.player.car && PH.carSpeed(G.player.car) > 200
      && PH.dist(ped.x, ped.y, G.player.car.x, G.player.car.y) < 110) {
      ped.state = 'flee';
      ped.fleeAt = 1.6;
      ped.fleeX = G.player.car.x;
      ped.fleeY = G.player.car.y;
    }
    if (ped.state === 'flee') {
      ped.fleeAt -= dt;
      const away = PH.angleTo(ped.fleeX, ped.fleeY, ped.x, ped.y);
      movePed(G, ped, ped.x + Math.cos(away) * 120, ped.y + Math.sin(away) * 120, 215, dt);
      if (ped.fleeAt <= 0) ped.state = 'wander';
      continue;
    }
    ped.thinkAt -= dt;
    if (movePed(G, ped, ped.tx, ped.ty, ped.speed, dt) || ped.thinkAt <= 0) {
      const spot = walkablePoint(G, ped.x, ped.y, 340);
      if (spot) { ped.tx = spot[0]; ped.ty = spot[1]; }
      ped.thinkAt = PH.rand.range(4, 9);
    }
    void px; void py;
  }
  // The fallen fade and are replaced elsewhere, so the city never empties.
  for (let i = G.peds.length - 1; i >= 0; i -= 1) {
    if (G.peds[i].down && G.peds[i].downAt > 7) {
      G.peds.splice(i, 1);
      const spot = walkablePoint(G, G.player.x, G.player.y, 1500);
      if (spot && PH.dist(spot[0], spot[1], G.player.x, G.player.y) > 500) G.peds.push(PH.makePed(spot[0], spot[1], 'walker'));
    }
  }
};

PH.drawPed = function drawPed(ctx, ped, t) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.down) {
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.globalAlpha = PH.clamp(1.4 - ped.downAt * 0.16, 0, 1);
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.roundRect(-14, -6, 28, 12, 6);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(16, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = 'rgba(30,20,40,0.25)';
  ctx.beginPath();
  ctx.ellipse(1, 3, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(ped.angle);
  const stride = Math.sin(ped.walkPhase) * 5;
  ctx.strokeStyle = '#2e3440';
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(-4 + stride * 0.4, -6);
  ctx.moveTo(0, 0); ctx.lineTo(-4 - stride * 0.4, 6);
  ctx.stroke();
  ctx.fillStyle = ped.kind === 'cop' ? '#27354d' : ped.shirt;
  ctx.beginPath();
  ctx.roundRect(-8, -7.5, 17, 15, 6);
  ctx.fill();
  if (ped.kind === 'cop') {
    ctx.fillStyle = '#f2b705';
    ctx.fillRect(2, -5, 3, 10);
  }
  if (ped.kind === 'gunman') {
    ctx.fillStyle = '#22242a';
    ctx.fillRect(4, 4, 15, 4); // the gun in his hand
  }
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(3, 0, 5.6, 0, Math.PI * 2);
  ctx.fill();
  if (ped.kind === 'cop') {
    ctx.fillStyle = '#1d2733';
    ctx.beginPath();
    ctx.arc(3.5, 0, 5.8, Math.PI * 0.7, Math.PI * 1.7);
    ctx.fill();
  }
  void t;
  ctx.restore();
};
