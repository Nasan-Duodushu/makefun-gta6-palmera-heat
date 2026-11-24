// Combat and effects: the player's fists and pistol, enemy gunfire, bullets and
// tracers, impact sparks, smoke, skid smoke, and the cash/ammo/health pickups that
// float where they fall. Violence stays cartoonish — the hit fall down and fade.
window.PH = window.PH || {};

PH.spawnParticle = function spawnParticle(x, y, kind) {
  return { x, y, kind, vx: 0, vy: 0, life: 0, maxLife: 1, size: 3, text: null };
};

function pushParticle(G, p) {
  if (G.particles.length > 700) G.particles.splice(0, G.particles.length - 700);
  G.particles.push(p);
}

PH.burst = function burst(G, x, y, kind, count) {
  for (let i = 0; i < count; i += 1) {
    const a = PH.rand.range(0, Math.PI * 2);
    const sp = PH.rand.range(20, kind === 'spark' ? 190 : 60);
    const p = PH.spawnParticle(x, y, kind);
    p.vx = Math.cos(a) * sp;
    p.vy = Math.sin(a) * sp;
    p.maxLife = p.life = PH.rand.range(0.25, kind === 'smoke' ? 1.4 : 0.6);
    p.size = PH.rand.range(2, kind === 'smoke' ? 9 : 4.5);
    pushParticle(G, p);
  }
};

/** Someone goes down: a fall, a puff, and consequences with the law. */
PH.downTarget = function downTarget(G, target) {
  target.down = true;
  target.downAt = 0;
  PH.burst(G, target.x, target.y, 'smoke', 5);
  if (target.kind === 'cop') {
    PH.commitCrime(G, 3);
    G.dropPickup(target.x, target.y, 'ammo', 6);
  } else if (target.kind === 'gunman') {
    G.onGunmanDown(target);
    G.dropPickup(target.x, target.y, 'cash', PH.rand.int(20, 60));
  } else {
    PH.commitCrime(G, 2);
  }
};

function hurtTarget(G, target, damage, kx, ky) {
  if (target.down) return;
  target.hp -= damage;
  target.x += kx * 6;
  target.y += ky * 6;
  PH.burst(G, target.x, target.y, 'spark', 3);
  G.audio.hit();
  if (target.hp <= 0) PH.downTarget(G, target);
  else if (target.kind === 'walker') {
    target.state = 'flee';
    target.fleeAt = 3;
    target.fleeX = G.player.x;
    target.fleeY = G.player.y;
  }
}

/** The player's swing: anything within reach and in the aim arc takes it. */
PH.playerMelee = function playerMelee(G) {
  const p = G.player;
  const aim = p.aim;
  G.audio.punch();
  p.swingAt = G.time;
  let hitAny = false;
  const test = (t) => {
    if (t.down) return;
    if (PH.dist(p.x, p.y, t.x, t.y) > PH.PLAYER.meleeRange) return;
    if (Math.abs(PH.angleDelta(aim, PH.angleTo(p.x, p.y, t.x, t.y))) > 1.0) return;
    hurtTarget(G, t, PH.PLAYER.meleeDamage, Math.cos(aim), Math.sin(aim));
    hitAny = true;
  };
  G.peds.forEach(test);
  G.cops.forEach(test);
  if (hitAny) PH.commitCrime(G, 1);
  PH.scarePeds(G, p.x, p.y, 120);
};

/** Fire the pistol toward a world point. Ammo and the law permitting. */
PH.playerShoot = function playerShoot(G, tx, ty) {
  const p = G.player;
  if (p.ammo <= 0) { G.audio.empty(); p.shootCd = 0.25; return; }
  p.ammo -= 1;
  p.shootCd = PH.PISTOL.cooldown;
  const angle = PH.angleTo(p.x, p.y, tx, ty) + PH.rand.range(-PH.PISTOL.spread, PH.PISTOL.spread);
  const speed = 1150;
  G.bullets.push({
    x: p.x + Math.cos(angle) * 18, y: p.y + Math.sin(angle) * 18,
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    life: PH.PISTOL.range / speed, from: 'player', damage: PH.PISTOL.damage,
  });
  const flash = PH.spawnParticle(p.x + Math.cos(angle) * 24, p.y + Math.sin(angle) * 24, 'flash');
  flash.maxLife = flash.life = 0.06;
  flash.size = 13;
  pushParticle(G, flash);
  G.audio.shoot();
  G.shake = Math.min(6, G.shake + 1.2);
  PH.scarePeds(G, p.x, p.y, 300);
  PH.commitCrime(G, 1);
};

/** An enemy shot at the player or their car: fast, fallible, drawn as a tracer. */
PH.enemyShoot = function enemyShoot(G, shooter, target, damage) {
  const miss = PH.rand.range(-0.09, 0.09) + (PH.rand.chance(0.35) ? PH.rand.range(-0.16, 0.16) : 0);
  const angle = PH.angleTo(shooter.x, shooter.y, target.x, target.y) + miss;
  const speed = 980;
  G.bullets.push({
    x: shooter.x + Math.cos(angle) * 16, y: shooter.y + Math.sin(angle) * 16,
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    life: 0.65, from: 'enemy', damage,
  });
  const flash = PH.spawnParticle(shooter.x + Math.cos(angle) * 20, shooter.y + Math.sin(angle) * 20, 'flash');
  flash.maxLife = flash.life = 0.06;
  flash.size = 11;
  pushParticle(G, flash);
  G.audio.shoot();
};

/** A hostile gunman's brain: keep his range, strafe a little, shoot on a cadence. */
PH.updateGunman = function updateGunman(G, ped, dt) {
  const player = G.player;
  const d = PH.dist(ped.x, ped.y, player.x, player.y);
  ped.angle = PH.angleTo(ped.x, ped.y, player.x, player.y);
  if (d > 300) {
    const [rx, ry] = G.city.resolve(ped.x + Math.cos(ped.angle) * 150 * dt, ped.y + Math.sin(ped.angle) * 150 * dt, 11);
    ped.x = rx; ped.y = ry;
    ped.walkPhase += dt * 12;
  } else if (d < 130) {
    const back = ped.angle + Math.PI;
    const [rx, ry] = G.city.resolve(ped.x + Math.cos(back) * 90 * dt, ped.y + Math.sin(back) * 90 * dt, 11);
    ped.x = rx; ped.y = ry;
  }
  ped.shootCd -= dt;
  if (ped.shootCd <= 0 && d < 380) {
    ped.shootCd = PH.rand.range(0.8, 1.5);
    PH.enemyShoot(G, ped, player.car || player, 11);
  }
};

PH.updateBullets = function updateBullets(G, dt) {
  for (let i = G.bullets.length - 1; i >= 0; i -= 1) {
    const b = G.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let spent = b.life <= 0;
    // Buildings stop bullets cold.
    if (!spent) {
      for (const c of G.city.colliders) {
        if (!c.soft && b.x >= c.x && b.x <= c.x + c.w && b.y >= c.y && b.y <= c.y + c.h) { spent = true; break; }
      }
      if (spent) PH.burst(G, b.x, b.y, 'spark', 2);
    }
    if (!spent && b.from === 'player') {
      const targets = G.peds.concat(G.cops);
      for (const t of targets) {
        if (t.down || PH.dist(b.x, b.y, t.x, t.y) > 13) continue;
        hurtTarget(G, t, b.damage, b.vx / 1150, b.vy / 1150);
        spent = true;
        break;
      }
      if (!spent) {
        for (const car of G.cars) {
          if (car.driver === 'player' || car.dead) continue;
          if (PH.dist(b.x, b.y, car.x, car.y) < car.spec.length * 0.42) {
            car.health -= b.damage * 0.5;
            PH.burst(G, b.x, b.y, 'spark', 3);
            if (car.health <= 0 && !car.dead) { car.dead = true; G.onCarWrecked(car); }
            spent = true;
            break;
          }
        }
      }
    } else if (!spent && b.from === 'enemy') {
      const target = G.player.car || G.player;
      const r = G.player.car ? G.player.car.spec.length * 0.4 : 13;
      if (PH.dist(b.x, b.y, target.x, target.y) < r) {
        PH.damagePlayer(G, b.damage);
        spent = true;
      }
    }
    if (spent) G.bullets.splice(i, 1);
  }
};

PH.updateFx = function updateFx(G, dt) {
  for (let i = G.particles.length - 1; i >= 0; i -= 1) {
    const p = G.particles[i];
    p.life -= dt;
    if (p.life <= 0) { G.particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    if (p.kind === 'smoke') { p.y -= 14 * dt; p.size += 6 * dt; }
  }
  for (let i = G.skids.length - 1; i >= 0; i -= 1) {
    G.skids[i].life -= dt;
    if (G.skids[i].life <= 0) G.skids.splice(i, 1);
  }
  // Pickups bob, drift toward the player when close, and land in the pocket.
  for (let i = G.pickups.length - 1; i >= 0; i -= 1) {
    const pk = G.pickups[i];
    pk.bob += dt * 3;
    const d = PH.dist(pk.x, pk.y, G.player.x, G.player.y);
    if (d < 90 && !G.player.car) {
      pk.x += (G.player.x - pk.x) * dt * 4;
      pk.y += (G.player.y - pk.y) * dt * 4;
    }
    if (d < 24) {
      if (pk.kind === 'cash') { G.cash += pk.amount; G.floatText(pk.x, pk.y - 18, '+$' + pk.amount, '#7cff6b'); }
      if (pk.kind === 'ammo') { G.player.reserve += pk.amount; G.floatText(pk.x, pk.y - 18, '+' + pk.amount + ' ammo', '#ffd166'); }
      if (pk.kind === 'health') { G.player.health = Math.min(100, G.player.health + pk.amount); G.floatText(pk.x, pk.y - 18, '+' + pk.amount + ' health', '#ff8fab'); }
      G.audio.pickup();
      G.pickups.splice(i, 1);
    }
  }
  for (let i = G.texts.length - 1; i >= 0; i -= 1) {
    const t = G.texts[i];
    t.life -= dt;
    t.y -= 26 * dt;
    if (t.life <= 0) G.texts.splice(i, 1);
  }
};

/** Two layers: skid marks and pickups go under the cars; the rest over them. */
PH.drawFx = function drawFx(ctx, G, over) {
  if (over) { drawFxOver(ctx, G); return; }
  for (const s of G.skids) {
    ctx.fillStyle = `rgba(24,22,28,${PH.clamp(s.life * 0.09, 0, 0.4)})`;
    ctx.fillRect(s.x - 3, s.y - 2, 6, 4);
  }
  for (const pk of G.pickups) {
    const bobY = Math.sin(pk.bob) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bobY);
    if (pk.kind === 'cash') {
      ctx.fillStyle = '#2f9e44';
      ctx.beginPath(); ctx.roundRect(-10, -6, 20, 12, 2); ctx.fill();
      ctx.fillStyle = '#d3f9d8';
      ctx.font = 'bold 10px ' + PH.FONT;
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 3.5);
    } else if (pk.kind === 'ammo') {
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.roundRect(-4, -9, 8, 18, 2); ctx.fill();
      ctx.fillStyle = '#8a5a00';
      ctx.fillRect(-4, -9, 8, 5);
    } else {
      ctx.fillStyle = '#f8f9fa';
      ctx.beginPath(); ctx.roundRect(-9, -9, 18, 18, 3); ctx.fill();
      ctx.fillStyle = '#e03131';
      ctx.fillRect(-2.5, -6, 5, 12);
      ctx.fillRect(-6, -2.5, 12, 5);
    }
    ctx.restore();
  }
};

function drawFxOver(ctx, G) {
  for (const b of G.bullets) {
    ctx.strokeStyle = 'rgba(255,220,130,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (const p of G.particles) {
    const f = p.life / p.maxLife;
    if (p.kind === 'spark') ctx.fillStyle = `rgba(255,${180 + Math.floor(60 * f)},90,${f})`;
    else if (p.kind === 'smoke') ctx.fillStyle = `rgba(90,88,96,${0.35 * f})`;
    else if (p.kind === 'flash') ctx.fillStyle = `rgba(255,214,110,${f})`;
    else ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (p.kind === 'flash' ? f + 0.4 : 1), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = 'bold 15px ' + PH.FONT;
  ctx.textAlign = 'center';
  for (const t of G.texts) {
    ctx.globalAlpha = PH.clamp(t.life, 0, 1);
    ctx.fillStyle = t.colour;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
};
