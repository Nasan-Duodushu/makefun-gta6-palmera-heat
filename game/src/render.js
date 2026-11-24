// Painting the world: water and sand first, then streets with their markings,
// sidewalks, buildings with neon signs, palms and lamps, and the gold pillar of
// light on the mission target. Everything is culled to the camera's view, and the
// time of day washes the whole frame through dayTint.
window.PH = window.PH || {};

/** The light at a clock time: a tint to lay over the world, and whether it is dark. */
PH.dayTint = function dayTint(minutes) {
  const h = minutes / 60;
  if (h >= 6.5 && h < 16.5) return { colour: 'rgba(0,0,0,0)', alpha: 0, dark: false };
  if (h >= 16.5 && h < 19) return { colour: 'rgba(255,105,135,0.15)', alpha: 0.15, dark: false }; // pink golden hour
  if (h >= 19 && h < 20.5) return { colour: 'rgba(94,40,140,0.30)', alpha: 0.3, dark: true };  // purple dusk
  if (h >= 20.5 || h < 5.5) return { colour: 'rgba(16,20,54,0.42)', alpha: 0.42, dark: true };  // night
  return { colour: 'rgba(255,150,90,0.10)', alpha: 0.1, dark: false };                          // dawn
};

function inView(G, x, y, m) {
  const c = G.camera;
  return x > c.x - m && y > c.y - m && x < c.x + c.w + m && y < c.y + c.h + m;
}

function drawGround(ctx, G) {
  const { width: W, height: H, waterY, sandY } = PH.WORLD;
  const P = PH.PALETTE;
  ctx.fillStyle = P.plaza;
  ctx.fillRect(0, 0, W, H);
  // Block checker: a faint alternating tone over the city blocks.
  ctx.fillStyle = P.plazaAlt;
  for (let i = 0; i < PH.V_ROADS.length - 1; i += 1) {
    for (let j = 0; j < PH.H_ROADS.length - 1; j += 1) {
      if ((i + j) % 2 === 0) continue;
      ctx.fillRect(PH.V_ROADS[i], PH.H_ROADS[j], PH.V_ROADS[i + 1] - PH.V_ROADS[i], PH.H_ROADS[j + 1] - PH.H_ROADS[j]);
    }
  }
  // Sand and sea along the south.
  ctx.fillStyle = P.sand;
  ctx.fillRect(0, sandY, W, H - sandY);
  ctx.fillStyle = P.sandWet;
  ctx.fillRect(0, waterY - 16, W, 16);
  const grad = ctx.createLinearGradient(0, waterY, 0, H);
  grad.addColorStop(0, P.water);
  grad.addColorStop(1, P.waterDeep);
  ctx.fillStyle = grad;
  ctx.fillRect(0, waterY, W, H - waterY);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 26; i += 1) {
    const wx = ((i * 173 + Math.floor(G.time * 22)) % W);
    const wy = waterY + 14 + ((i * 61) % (H - waterY - 24));
    ctx.moveTo(wx, wy);
    ctx.lineTo(wx + 26, wy);
  }
  ctx.stroke();
}

function drawRoads(ctx, G) {
  const P = PH.PALETTE;
  const half = PH.ROAD.width / 2;
  const walk = PH.ROAD.sidewalk;
  const H = PH.WORLD.height;
  const W = PH.WORLD.width;
  ctx.fillStyle = P.sidewalk;
  for (const x of PH.V_ROADS) ctx.fillRect(x - half - walk, 0, PH.ROAD.width + walk * 2, H);
  for (const y of PH.H_ROADS) ctx.fillRect(0, y - half - walk, W, PH.ROAD.width + walk * 2);
  ctx.fillStyle = P.asphalt;
  for (const x of PH.V_ROADS) ctx.fillRect(x - half, 0, PH.ROAD.width, H);
  for (const y of PH.H_ROADS) ctx.fillRect(0, y - half, W, PH.ROAD.width);
  // Centre dashes.
  ctx.fillStyle = P.lane;
  for (const x of PH.V_ROADS) {
    for (let y = 14; y < H; y += 56) {
      if (PH.H_ROADS.some((hy) => Math.abs(y - hy) < 70)) continue;
      ctx.fillRect(x - 2, y, 4, 30);
    }
  }
  for (const y of PH.H_ROADS) {
    for (let x = 14; x < W; x += 56) {
      if (PH.V_ROADS.some((vx) => Math.abs(x - vx) < 70)) continue;
      ctx.fillRect(x, y - 2, 30, 4);
    }
  }
  // Crosswalks at every intersection.
  ctx.fillStyle = P.crosswalk;
  for (const x of PH.V_ROADS) {
    for (const y of PH.H_ROADS) {
      for (let s = -3; s <= 3; s += 1) {
        if (s === 0) continue;
        ctx.fillRect(x + s * 12 - 4, y - half - 10, 8, 7);
        ctx.fillRect(x + s * 12 - 4, y + half + 3, 8, 7);
        ctx.fillRect(x - half - 10, y + s * 12 - 4, 7, 8);
        ctx.fillRect(x + half + 3, y + s * 12 - 4, 7, 8);
      }
    }
  }
}

const DISTRICT_LABELS = [
  ['OLD PALMERA', 700, 560], ['MARINA HEIGHTS', 2500, 560], ['NEON MILE', 1600, 1230],
  ['DOCKSIDE', 620, 1400], ['SUNSET FLATS', 2650, 1400], ['PALMERA BEACH', 1700, 2110],
];

function drawBuilding(ctx, b, dark) {
  const P = PH.PALETTE;
  if (b.container) {
    ctx.fillStyle = 'rgba(30,20,40,0.25)';
    ctx.fillRect(b.x + 4, b.y + 5, b.w, b.h);
    ctx.fillStyle = b.colour;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    for (let x = b.x + 12; x < b.x + b.w - 6; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, b.y + 4);
      ctx.lineTo(x, b.y + b.h - 4);
      ctx.stroke();
    }
    return;
  }
  const lift = b.tall;
  // The sunset throws every roof's shadow long to the east, then the wall skirt.
  ctx.fillStyle = P.roofShadow;
  ctx.fillRect(b.x + lift * 0.5, b.y + lift * 0.3, b.w, b.h);
  ctx.fillStyle = b.wall;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y + b.h);
  ctx.lineTo(b.x - lift * 0.28, b.y + b.h - lift * 0.2);
  ctx.lineTo(b.x - lift * 0.28, b.y - lift * 0.2);
  ctx.lineTo(b.x, b.y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = b.roof;
  ctx.fillRect(b.x - lift * 0.28, b.y - lift * 0.2, b.w, b.h);
  ctx.strokeStyle = 'rgba(90,50,40,0.5)';
  ctx.lineWidth = 3;
  ctx.strokeRect(b.x - lift * 0.28 + 5, b.y - lift * 0.2 + 5, b.w - 10, b.h - 10);
  // Roof furniture: vents and a water tank, placed by the building's own hash.
  ctx.fillStyle = 'rgba(70,50,45,0.55)';
  const n = 1 + (Math.floor(b.x + b.y) % 3);
  for (let i = 0; i < n; i += 1) {
    const vx = b.x - lift * 0.28 + 14 + ((i * 47 + Math.floor(b.x)) % Math.max(20, b.w - 40));
    const vy = b.y - lift * 0.2 + 12 + ((i * 31 + Math.floor(b.y)) % Math.max(16, b.h - 30));
    ctx.fillRect(vx, vy, 13, 10);
  }
  // The sign along the street edge, neon that glows as the light goes.
  ctx.save();
  if (dark) { ctx.shadowColor = b.neon; ctx.shadowBlur = 13; }
  ctx.fillStyle = dark ? b.neon : '#8a4a72';
  ctx.font = 'bold 13px ' + PH.FONT;
  ctx.textAlign = 'center';
  ctx.fillText(b.sign, b.x + b.w / 2, b.y + b.h + 17);
  ctx.restore();
}

function drawProp(ctx, p, dark, t) {
  const P = PH.PALETTE;
  if (p.kind === 'palm') {
    ctx.strokeStyle = P.palmTrunk;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.quadraticCurveTo(p.x + 4, p.y - 14 * p.s, p.x + 8, p.y - 24 * p.s);
    ctx.stroke();
    const topX = p.x + 8;
    const topY = p.y - 24 * p.s;
    const sway = Math.sin(t * 0.9 + p.x * 0.05) * 2;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + sway * 0.03;
      ctx.strokeStyle = i % 2 ? P.palmLeaf : P.palmLeafLight;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(topX + Math.cos(a) * 15 * p.s, topY + Math.sin(a) * 7 * p.s - 3, topX + Math.cos(a) * 26 * p.s, topY + Math.sin(a) * 12 * p.s + 5);
      ctx.stroke();
    }
  } else if (p.kind === 'lamp') {
    if (dark) {
      const grad = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 52);
      grad.addColorStop(0, 'rgba(255,217,138,0.5)');
      grad.addColorStop(1, 'rgba(255,217,138,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 52, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = P.lampPost;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    ctx.fillStyle = dark ? P.lampGlow : '#8f949e';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'bench') {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a);
    ctx.fillStyle = '#8a6a48';
    ctx.fillRect(-13, -3, 26, 6);
    ctx.fillStyle = '#6e5439';
    ctx.fillRect(-13, 4, 26, 3);
    ctx.restore();
  }
}

PH.drawWorld = function drawWorld(ctx, G) {
  const dark = PH.dayTint(G.clock).dark;
  drawGround(ctx, G);
  drawRoads(ctx, G);
  // District names painted large and faint on the ground.
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#4a3b2c';
  ctx.font = 'bold 44px ' + PH.FONT;
  ctx.textAlign = 'center';
  for (const [name, x, y] of DISTRICT_LABELS) if (inView(G, x, y, 500)) ctx.fillText(name, x, y);
  ctx.restore();
  // The pier: planks over the water at the beach's west end.
  const pier = G.city.pier;
  ctx.fillStyle = '#9a7a52';
  ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
  ctx.strokeStyle = 'rgba(70,50,30,0.5)';
  ctx.lineWidth = 2;
  for (let y = pier.y + 12; y < pier.y + pier.h; y += 16) {
    ctx.beginPath();
    ctx.moveTo(pier.x, y);
    ctx.lineTo(pier.x + pier.w, y);
    ctx.stroke();
  }
  for (const b of G.city.buildings) if (inView(G, b.x + b.w / 2, b.y + b.h / 2, 320)) drawBuilding(ctx, b, dark);
  for (const p of G.city.props) if (inView(G, p.x, p.y, 90)) drawProp(ctx, p, dark, G.time);
  // The mission beacon: a pillar of gold light on the target.
  const target = PH.missionTarget(G);
  if (target && G.screen === 'play') {
    const pulse = 0.65 + Math.sin(G.time * 4) * 0.25;
    const grad = ctx.createLinearGradient(0, target.y - 330, 0, target.y);
    grad.addColorStop(0, 'rgba(255,201,60,0)');
    grad.addColorStop(1, `rgba(255,201,60,${0.4 * pulse})`);
    ctx.fillStyle = grad;
    ctx.fillRect(target.x - 17, target.y - 330, 34, 330);
    ctx.strokeStyle = `rgba(255,201,60,${pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 30 + Math.sin(G.time * 4) * 5, 0, Math.PI * 2);
    ctx.stroke();
  }
};
