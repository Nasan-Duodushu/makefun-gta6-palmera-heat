// Everything that lives on the screen rather than in the world: the HUD (cash,
// clock, wanted stars, health, weapon, speedometer), the minimap, the objective
// ribbon, dialogue boxes, centre banners, and the menu screens — title, how to
// play, pause, wasted and busted. Buttons register themselves in G.uiButtons as
// they are drawn, so the loop can answer clicks without a second layout pass.
window.PH = window.PH || {};

function panel(ctx, x, y, w, h, fill) {
  ctx.fillStyle = fill || 'rgba(18,16,28,0.82)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,201,60,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function button(ctx, G, x, y, w, h, label, action, hot) {
  ctx.fillStyle = hot ? '#ffc93c' : 'rgba(255,246,236,0.10)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 9);
  ctx.fill();
  ctx.fillStyle = hot ? '#23160a' : PH.PALETTE.text;
  ctx.font = 'bold 19px ' + PH.FONT;
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 7);
  G.uiButtons.push({ x, y, w, h, action });
}

function star(ctx, x, y, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#ffc93c' : 'rgba(255,246,236,0.22)';
  ctx.fill();
}

function drawMinimap(ctx, G, x, y, w, h) {
  panel(ctx, x, y, w, h, 'rgba(14,18,26,0.78)');
  const sx = w / PH.WORLD.width;
  const sy = h / PH.WORLD.height;
  const px = (wx) => x + wx * sx;
  const py = (wy) => y + wy * sy;
  ctx.fillStyle = '#155a85';
  ctx.fillRect(x, py(PH.WORLD.waterY), w, (PH.WORLD.height - PH.WORLD.waterY) * sy);
  ctx.fillStyle = '#ecd096';
  ctx.fillRect(x, py(PH.WORLD.sandY), w, (PH.WORLD.waterY - PH.WORLD.sandY) * sy);
  ctx.strokeStyle = 'rgba(233,226,200,0.55)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (const vx of PH.V_ROADS) { ctx.moveTo(px(vx), y + 3); ctx.lineTo(px(vx), y + h - 3); }
  for (const hy of PH.H_ROADS) { ctx.moveTo(x + 3, py(hy)); ctx.lineTo(x + w - 3, py(hy)); }
  ctx.stroke();
  const dot = (wx, wy, colour, r) => {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(px(wx), py(wy), r, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const car of G.cars) if (car.driver === 'police' && !car.dead) dot(car.x, car.y, '#4da3ff', 2.6);
  for (const cop of G.cops) if (!cop.down) dot(cop.x, cop.y, '#4da3ff', 2.2);
  if (G.mission.index === 3 && G.mission.phase === 'active') {
    for (const ped of G.peds) if (ped.kind === 'gunman' && !ped.down) dot(ped.x, ped.y, '#ef476f', 2.4);
  }
  const target = PH.missionTarget(G);
  if (target) {
    ctx.save();
    if (Math.floor(G.time * 2.4) % 2 === 0) dot(target.x, target.y, '#ffc93c', 4.4);
    else dot(target.x, target.y, '#fff3bf', 3.4);
    ctx.restore();
  }
  // The player: a white arrow that turns with them.
  ctx.save();
  ctx.translate(px(G.player.x), py(G.player.y));
  ctx.rotate(G.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,246,236,0.65)';
  ctx.font = '10px ' + PH.FONT;
  ctx.textAlign = 'left';
  ctx.fillText('PALMERA', x + 7, y + 13);
}

function drawDialogue(ctx, G, w, h) {
  const line = G.dialogue[0];
  if (!line) return;
  const bw = Math.min(620, w - 60);
  panel(ctx, (w - bw) / 2, h - 118, bw, 62);
  ctx.fillStyle = '#ffc93c';
  ctx.font = 'bold 13px ' + PH.FONT;
  ctx.textAlign = 'left';
  ctx.fillText(line.who, (w - bw) / 2 + 18, h - 92);
  ctx.fillStyle = PH.PALETTE.text;
  ctx.font = '16.5px ' + PH.FONT;
  ctx.fillText(line.text, (w - bw) / 2 + 18, h - 68);
}

PH.drawScreen = function drawScreen(ctx, G) {
  const w = G.view.w;
  const h = G.view.h;
  G.uiButtons = [];
  ctx.textBaseline = 'alphabetic';

  if (G.screen === 'title' || G.screen === 'howto') { drawTitle(ctx, G, w, h); return; }

  // --- in-game HUD ---
  ctx.fillStyle = 'rgba(14,12,22,0.55)';
  ctx.beginPath();
  ctx.roundRect(14, 12, 252, 62, 9);
  ctx.fill();
  ctx.fillStyle = '#7cff6b';
  ctx.font = 'bold 25px ' + PH.FONT;
  ctx.textAlign = 'left';
  ctx.fillText('$' + G.cash.toLocaleString('en-US'), 26, 42);
  const hh = Math.floor(G.clock / 60);
  const mm = Math.floor(G.clock % 60);
  ctx.fillStyle = PH.PALETTE.muted;
  ctx.font = '14px ' + PH.FONT;
  const clockText = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}  ·  ${PH.districtAt(G.player.x, G.player.y)}`;
  ctx.fillText(clockText, 26, 64);

  for (let i = 0; i < 5; i += 1) star(ctx, w - 196 + i * 34, 34, 14, i < G.wanted.stars);
  drawMinimap(ctx, G, w - 208, 52, 192, 144);

  // Objective ribbon.
  const objective = PH.missionObjective(G);
  ctx.font = 'bold 15.5px ' + PH.FONT;
  const ow = Math.min(w - 480, ctx.measureText(objective).width + 34);
  if (ow > 60) {
    ctx.fillStyle = 'rgba(14,12,22,0.55)';
    ctx.beginPath();
    ctx.roundRect((w - ow) / 2, 12, ow, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.textAlign = 'center';
    ctx.fillText(objective, w / 2, 35);
  }

  // Health.
  ctx.fillStyle = 'rgba(14,12,22,0.55)';
  ctx.beginPath();
  ctx.roundRect(14, h - 44, 224, 30, 8);
  ctx.fill();
  ctx.fillStyle = G.player.health > 30 ? '#7cff6b' : '#ef476f';
  ctx.beginPath();
  ctx.roundRect(20, h - 38, 212 * PH.clamp(G.player.health / 100, 0, 1), 18, 5);
  ctx.fill();
  ctx.fillStyle = '#10131a';
  ctx.font = 'bold 12px ' + PH.FONT;
  ctx.textAlign = 'left';
  ctx.fillText('NIA', 26, h - 25);

  // Weapon and speed, bottom right.
  ctx.textAlign = 'right';
  if (G.player.car) {
    const kmh = Math.round(Math.abs(PH.carForwardSpeed(G.player.car)) * 0.36);
    ctx.fillStyle = PH.PALETTE.text;
    ctx.font = 'bold 40px ' + PH.FONT;
    ctx.fillText(String(kmh), w - 22, h - 46);
    ctx.fillStyle = PH.PALETTE.muted;
    ctx.font = '13px ' + PH.FONT;
    ctx.fillText('km/h · ' + G.player.car.spec.name, w - 22, h - 24);
  } else {
    ctx.fillStyle = PH.PALETTE.text;
    ctx.font = 'bold 19px ' + PH.FONT;
    ctx.fillText(G.player.weapon === 'pistol' ? `PISTOL  ${G.player.ammo} / ${G.player.reserve}` : 'FISTS', w - 22, h - 26);
    if (G.player.reloadAt > 0) {
      ctx.fillStyle = '#ffd166';
      ctx.font = '13px ' + PH.FONT;
      ctx.fillText('RELOADING…', w - 22, h - 48);
    }
  }

  if (G.prompt) {
    ctx.fillStyle = 'rgba(14,12,22,0.7)';
    const pw = ctx.measureText(G.prompt).width + 30;
    ctx.beginPath();
    ctx.roundRect((w - pw) / 2, h - 168, pw, 30, 8);
    ctx.fill();
    ctx.fillStyle = PH.PALETTE.text;
    ctx.font = '15px ' + PH.FONT;
    ctx.textAlign = 'center';
    ctx.fillText(G.prompt, w / 2, h - 148);
  }

  if (G.bust > 0.02) {
    const bw = 240;
    ctx.fillStyle = 'rgba(14,12,22,0.7)';
    ctx.beginPath();
    ctx.roundRect((w - bw) / 2, h * 0.62, bw, 26, 7);
    ctx.fill();
    ctx.fillStyle = '#4da3ff';
    ctx.beginPath();
    ctx.roundRect((w - bw) / 2 + 4, h * 0.62 + 4, (bw - 8) * G.bust, 18, 5);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px ' + PH.FONT;
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED', w / 2, h * 0.62 + 18);
  }

  drawDialogue(ctx, G, w, h);

  if (G.bannerAt > G.time - 3.2 && G.bannerTitle) {
    const age = G.time - G.bannerAt;
    const alpha = age < 0.3 ? age / 0.3 : age > 2.6 ? (3.2 - age) / 0.6 : 1;
    ctx.save();
    ctx.globalAlpha = PH.clamp(alpha, 0, 1);
    ctx.fillStyle = 'rgba(14,12,22,0.72)';
    ctx.fillRect(0, h * 0.3, w, 108);
    ctx.fillStyle = '#ffc93c';
    ctx.font = 'bold 44px ' + PH.FONT;
    ctx.textAlign = 'center';
    ctx.fillText(G.bannerTitle, w / 2, h * 0.3 + 52);
    ctx.fillStyle = PH.PALETTE.text;
    ctx.font = '19px ' + PH.FONT;
    ctx.fillText(G.bannerSub || '', w / 2, h * 0.3 + 84);
    ctx.restore();
  }

  if (G.screen === 'paused') {
    ctx.fillStyle = 'rgba(10,8,18,0.6)';
    ctx.fillRect(0, 0, w, h);
    panel(ctx, w / 2 - 170, h / 2 - 150, 340, 300);
    ctx.fillStyle = PH.PALETTE.text;
    ctx.font = 'bold 32px ' + PH.FONT;
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', w / 2, h / 2 - 96);
    button(ctx, G, w / 2 - 120, h / 2 - 66, 240, 46, 'Resume', 'resume', false);
    button(ctx, G, w / 2 - 120, h / 2 - 8, 240, 46, 'Restart story', 'restart', false);
    button(ctx, G, w / 2 - 120, h / 2 + 50, 240, 46, 'Title screen', 'title', false);
    ctx.fillStyle = PH.PALETTE.muted;
    ctx.font = '13.5px ' + PH.FONT;
    ctx.fillText('M — mute · Esc — resume', w / 2, h / 2 + 128);
  }

  if (G.screen === 'wasted' || G.screen === 'busted') {
    const wasted = G.screen === 'wasted';
    ctx.fillStyle = wasted ? 'rgba(60,4,16,0.55)' : 'rgba(6,20,50,0.55)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = wasted ? '#ef476f' : '#4da3ff';
    ctx.font = 'bold 92px ' + PH.FONT;
    ctx.textAlign = 'center';
    ctx.fillText(wasted ? 'WASTED' : 'BUSTED', w / 2, h * 0.42);
    ctx.fillStyle = PH.PALETTE.text;
    ctx.font = '19px ' + PH.FONT;
    ctx.fillText(wasted ? 'The hospital takes $100 for its trouble.' : 'The law takes $100 and your afternoon.', w / 2, h * 0.42 + 42);
    button(ctx, G, w / 2 - 110, h * 0.42 + 74, 220, 48, 'Back on the street', 'respawn', true);
  }
};

/** A palm in silhouette against the title sunset: one curved trunk, six fronds. */
function drawPalmSilhouette(ctx, x, y, s, flip) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip * s, s);
  ctx.strokeStyle = '#1d1030';
  ctx.lineCap = 'round';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(10, -52, 30, -88);
  ctx.stroke();
  ctx.lineWidth = 5;
  for (let i = 0; i < 6; i += 1) {
    const a = Math.PI * (0.08 + i * 0.17);
    ctx.beginPath();
    ctx.moveTo(30, -88);
    ctx.quadraticCurveTo(30 + Math.cos(a) * 34, -88 - Math.sin(a) * 22 - 8, 30 + Math.cos(a) * 58, -88 - Math.sin(a) * 26 + 14);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTitle(ctx, G, w, h) {
  // A sunset band behind the name, whatever part of Palmera is showing.
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(30,16,54,0.25)');
  grad.addColorStop(0.55, 'rgba(90,30,70,0.18)');
  grad.addColorStop(1, 'rgba(16,10,26,0.78)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // The big retro sun: a striped disc sinking behind the skyline, palms in front.
  const sunX = w / 2;
  const sunY = h * 0.52;
  const sunR = Math.min(w, h) * 0.215;
  const sun = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  sun.addColorStop(0, '#ffe259');
  sun.addColorStop(0.55, '#ffa751');
  sun.addColorStop(1, '#ff5d8f');
  ctx.save();
  ctx.globalAlpha = 0.62;
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(29,16,48,0.85)';
  for (let i = 0; i < 5; i += 1) {
    const sy = sunY + sunR * (0.08 + i * 0.17);
    ctx.fillRect(sunX - sunR, sy, sunR * 2, 3 + i * 2.2);
  }
  ctx.restore();
  drawPalmSilhouette(ctx, w * 0.16, h * 0.86, 1.5, 1);
  drawPalmSilhouette(ctx, w * 0.85, h * 0.9, 1.9, -1);
  drawPalmSilhouette(ctx, w * 0.07, h * 0.95, 1.0, 1);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 26px ' + PH.FONT;
  ctx.fillText('P A L M E R A', w / 2, h * 0.24);
  ctx.save();
  ctx.shadowColor = '#ff5d8f';
  ctx.shadowBlur = 26;
  ctx.fillStyle = '#fdf6ec';
  ctx.font = 'bold 96px ' + PH.FONT;
  ctx.fillText('PALMERA HEAT', w / 2, h * 0.24 + 92);
  ctx.restore();
  ctx.fillStyle = '#ffc93c';
  ctx.font = '18px ' + PH.FONT;
  ctx.fillText('One city. One driver. Every siren in town.', w / 2, h * 0.24 + 128);

  if (G.screen === 'howto') {
    const bw = 560;
    const bh = 330;
    panel(ctx, (w - bw) / 2, h * 0.52, bw, bh);
    ctx.fillStyle = PH.PALETTE.text;
    ctx.font = '16.5px ' + PH.FONT;
    ctx.textAlign = 'left';
    const lines = [
      'WASD / arrows — walk and drive        Shift — run',
      'Mouse — aim            Click — shoot (pistol out)',
      'F — melee / fists      Q — swap fists & pistol',
      'E — enter / exit a car (steal it, if it has a driver)',
      'R — reload             H — horn        Space — handbrake',
      'Esc / P — pause        M — mute',
      '',
      'Follow the gold pillar of light to the next job.',
      'Stars bring police. Break their sight to cool down.',
      'Downed officers drop ammo. Missions pay cash.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, (w - bw) / 2 + 30, h * 0.52 + 44 + i * 29));
    button(ctx, G, w / 2 - 90, h * 0.52 + bh + 18, 180, 46, 'Back', 'title', true);
    return;
  }

  const save = PH.loadGame();
  let y = h * 0.52;
  button(ctx, G, w / 2 - 130, y, 260, 50, 'New game', 'new', true);
  y += 62;
  if (save) {
    button(ctx, G, w / 2 - 130, y, 260, 50, `Continue — $${save.cash}`, 'continue', false);
    y += 62;
  }
  button(ctx, G, w / 2 - 130, y, 260, 50, 'How to play', 'howto', false);
  ctx.fillStyle = 'rgba(253,246,236,0.6)';
  ctx.font = '13.5px ' + PH.FONT;
  ctx.fillText('An original Palmera story — no relation to any other city.', w / 2, h - 26);
}
