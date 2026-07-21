import { WEAPONS, CONFIG } from './data.js';
import { sprite } from './assets.js';

export class WeaponSystem {
  constructor(game) {
    this.game = game;
    this.projectiles = [];
    this.pools = [];
    this.bolts = [];
    this.artifactState = { stormTimer: 0, devourAngle: 0, stormcallTimer: 1.0, tempestDistance: 0, lastX: 0, lastY: 0 };
    this.devourPool = null;
  }

  reset() {
    this.projectiles.length = 0;
    this.pools.length = 0;
    this.bolts.length = 0;
    this.artifactState = { stormTimer: 0, devourAngle: 0, stormcallTimer: 1.0, tempestDistance: 0, lastX: 0, lastY: 0 };
    this.devourPool = null;
  }

  addWeapon(id) {
    this.game.player.weapons.push({ id, level: 1, timer: 0.4 });
  }

  upgradeWeapon(id) {
    const w = this.game.player.weapons.find((x) => x.id === id);
    if (w && w.level < WEAPONS[id].maxLevel) w.level += 1;
  }

  hasWeapon(id) {
    return this.game.player.weapons.some((w) => w.id === id);
  }

  weaponLevel(id) {
    const w = this.game.player.weapons.find((x) => x.id === id);
    return w ? w.level : 0;
  }

  addArtifact(id) {
    this.game.player.weapons.push({ id, artifact: true, level: 1, timer: 0 });
  }

  hasArtifact(id) {
    return this.game.player.weapons.some((w) => w.artifact && w.id === id);
  }

  stats(weapon) {
    return WEAPONS[weapon.id].levels[weapon.level - 1];
  }

  update(dt) {
    const player = this.game.player;
    for (const weapon of player.weapons) {
      if (weapon.artifact) { this.updateArtifact(weapon, dt); continue; }
      weapon.timer -= dt;
      if (weapon.timer <= 0) {
        const s = this.stats(weapon);
        weapon.timer += s.cooldown;
        this.fire(weapon, s);
      }
    }
    this.updateProjectiles(dt);
    this.updatePools(dt);
    this.updateBolts(dt);
  }

  updateArtifact(weapon, dt) {
    const game = this.game;
    const player = game.player;
    const enemies = game.enemies.enemies;
    const st = this.artifactState;
    if (weapon.id === 'storm') {
      st.stormTimer -= dt;
      if (st.stormTimer <= 0 && enemies.length > 0) {
        st.stormTimer = 0.12;
        for (let i = 0; i < 3; i += 1) {
          const target = this.pickTarget(i);
          if (!target) break;
          const dx = target.x - player.x;
          const dy = target.y - player.y;
          const d = Math.hypot(dx, dy) || 1;
          this.projectiles.push({
            kind: 'blade', x: player.x, y: player.y,
            vx: (dx / d) * 420, vy: (dy / d) * 420,
            damage: 18 * player.damageMul, pierce: 2, life: 1.4, spin: 0, hitSet: new Set(),
          });
        }
      }
    } else if (weapon.id === 'devour') {
      st.devourAngle += dt;
      if (!this.devourPool) this.devourPool = { radius: 110, tick: 0.4, tickTimer: 0 };
      const pool = this.devourPool;
      pool.x = player.x;
      pool.y = player.y;
      pool.tickTimer -= dt;
      if (pool.tickTimer <= 0) {
        pool.tickTimer = pool.tick;
        for (const e of game.enemies.enemiesNear(player.x, player.y, pool.radius + 30)) {
          if (e.hp > 0 && Math.hypot(e.x - player.x, e.y - player.y) < pool.radius) {
            game.enemies.damageEnemy(e, 16 * player.damageMul);
            game.fx.spawnDamageNumber(e.x, e.y - e.radius, Math.round(16 * player.damageMul), '#a8d8ff');
          }
        }
      }
    } else if (weapon.id === 'spiral') {
      st.devourAngle += dt * 2.2;
      for (let i = 0; i < 6; i += 1) {
        const ang = st.devourAngle + (i * Math.PI * 2) / 6;
        const bx = player.x + Math.cos(ang) * 130;
        const by = player.y + Math.sin(ang) * 130;
        for (const e of game.enemies.enemiesNear(bx, by, 40)) {
          if (e.hp > 0 && !e._spiralHit) {
            e._spiralHit = true;
            game.enemies.damageEnemy(e, 24 * player.damageMul, Math.cos(ang), Math.sin(ang));
            game.fx.spawnDamageNumber(e.x, e.y - e.radius, Math.round(24 * player.damageMul));
            setTimeout(() => { e._spiralHit = false; }, 400);
          }
        }
      }
    } else if (weapon.id === 'stormcall') {
      st.stormcallTimer -= dt;
      if (st.stormcallTimer <= 0 && enemies.length > 0) {
        st.stormcallTimer = 1.2;
        for (let i = 0; i < 6; i += 1) {
          const target = enemies[Math.floor(Math.random() * enemies.length)];
          this.strikeLightning(target, { damage: 40 * player.damageMul, chains: 6, chainRange: 220 }, new Set());
        }
      }
    } else if (weapon.id === 'crimson') {
      st.stormTimer -= dt;
      if (st.stormTimer <= 0 && enemies.length > 0) {
        st.stormTimer = 0.5;
        for (let i = 0; i < 2; i += 1) {
          const target = this.pickTarget(i);
          if (!target) break;
          const dx = target.x - player.x;
          const dy = target.y - player.y;
          const d = Math.hypot(dx, dy) || 1;
          this.projectiles.push({
            kind: 'blade', x: player.x, y: player.y,
            vx: (dx / d) * 400, vy: (dy / d) * 400,
            damage: 32 * player.damageMul, pierce: 2, life: 1.5, spin: 0, hitSet: new Set(), lifeSteal: true,
          });
        }
      }
    } else if (weapon.id === 'tempest') {
      const moved = Math.hypot(player.x - (st.lastX || player.x), player.y - (st.lastY || player.y));
      st.tempestDistance += moved;
      st.lastX = player.x;
      st.lastY = player.y;
      if (st.tempestDistance > 60 && enemies.length > 0) {
        st.tempestDistance = 0;
        const target = game.enemies.nearestTo(player.x, player.y, 320);
        if (target) this.strikeLightning(target, { damage: 30 * player.damageMul, chains: 2, chainRange: 160 }, new Set());
      }
    }
  }

  fire(weapon, s) {
    const game = this.game;
    const player = game.player;
    const enemies = game.enemies.enemies;
    if (enemies.length === 0) return;

    if (weapon.id === 'blade') {
      for (let i = 0; i < s.count; i += 1) {
        const target = this.pickTarget(i);
        if (!target) return;
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        const d = Math.hypot(dx, dy) || 1;
        this.projectiles.push({
          kind: 'blade',
          x: player.x, y: player.y,
          vx: (dx / d) * s.speed, vy: (dy / d) * s.speed,
          damage: s.damage * player.damageMul,
          pierce: s.pierce, life: 1.6, spin: 0, hitSet: new Set(),
        });
      }
    } else if (weapon.id === 'holywater') {
      for (let i = 0; i < s.count; i += 1) {
        const target = this.pickTarget(i) || enemies[0];
        const jx = target.x + (Math.random() * 2 - 1) * 40;
        const jy = target.y + (Math.random() * 2 - 1) * 40;
        this.pools.push({
          x: jx, y: jy,
          radius: s.radius,
          damage: s.damage * player.damageMul,
          duration: s.duration, tick: s.tick, tickTimer: 0,
          age: 0,
        });
      }
    } else if (weapon.id === 'axe') {
      const baseAngle = Math.atan2(
        this.game.enemies.enemies[0].y - player.y,
        this.game.enemies.enemies[0].x - player.x,
      );
      for (let i = 0; i < s.count; i += 1) {
        const angle = baseAngle + (i - (s.count - 1) / 2) * 0.5;
        this.projectiles.push({
          kind: 'axe',
          x: player.x, y: player.y,
          vx: Math.cos(angle) * s.speed, vy: Math.sin(angle) * s.speed,
          speed: s.speed, angle,
          damage: s.damage * player.damageMul,
          pierce: 99, life: 3, spin: 0, traveled: 0, range: s.range,
          returning: false, hitSet: new Set(),
        });
      }
    } else if (weapon.id === 'lightning') {
      for (let i = 0; i < s.strikes; i += 1) {
        const target = enemies[Math.floor(Math.random() * enemies.length)];
        this.strikeLightning(target, s, new Set());
      }
    }
  }

  pickTarget(offset = 0) {
    const enemies = this.game.enemies.enemies;
    if (enemies.length === 0) return null;
    const player = this.game.player;
    const sorted = [...enemies].sort((a, b) => {
      const da = Math.hypot(a.x - player.x, a.y - player.y);
      const db = Math.hypot(b.x - player.x, b.y - player.y);
      return da - db;
    });
    return sorted[Math.min(offset, sorted.length - 1)];
  }

  strikeLightning(startEnemy, s, hitSet) {
    const game = this.game;
    let current = startEnemy;
    const points = [{ x: current.x, y: current.y }];
    let remaining = s.chains;
    hitSet.add(current);
    game.enemies.damageEnemy(current, s.damage * game.player.damageMul);
    while (remaining > 0) {
      const next = game.enemies.enemiesNear(current.x, current.y, s.chainRange)
        .filter((e) => !hitSet.has(e) && e.hp > 0)
        .sort((a, b) => Math.hypot(a.x - current.x, a.y - current.y) - Math.hypot(b.x - current.x, b.y - current.y))[0];
      if (!next) break;
      hitSet.add(next);
      points.push({ x: next.x, y: next.y });
      game.enemies.damageEnemy(next, s.damage * game.player.damageMul * 0.85);
      current = next;
      remaining -= 1;
    }
    this.bolts.push({ points, life: 0.22, maxLife: 0.22 });
    game.fx.spawnSparks(points[0].x, points[0].y, '#f5d76e', 8);
  }

  updateProjectiles(dt) {
    const game = this.game;
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.spin += dt * 14;

      if (p.kind === 'axe') {
        if (!p.returning) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.traveled += p.speed * dt;
          if (p.traveled >= p.range) p.returning = true;
        } else {
          const player = game.player;
          const dx = player.x - p.x;
          const dy = player.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          p.x += (dx / d) * p.speed * 1.2 * dt;
          p.y += (dy / d) * p.speed * 1.2 * dt;
          if (d < 24) p.life = 0;
        }
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }

      const targets = game.enemies.enemiesNear(p.x, p.y, 60);
      for (const e of targets) {
        if (e.hp <= 0 || p.hitSet.has(e)) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) < e.radius + 12) {
          p.hitSet.add(e);
          const kd = Math.hypot(p.vx, p.vy) || 1;
          game.enemies.damageEnemy(e, p.damage, p.vx / kd, p.vy / kd);
          game.fx.spawnDamageNumber(e.x, e.y - e.radius, Math.round(p.damage));
          game.fx.spawnSparks(e.x, e.y, p.kind === 'blade' ? '#e74c3c' : '#9fc5ff', 4);
          if (p.lifeSteal) {
            game.player.hp = Math.min(game.player.maxHp, game.player.hp + 1);
          }
          p.pierce -= 1;
          if (p.pierce <= 0) { p.life = 0; break; }
        }
      }

      if (p.life <= 0) this.projectiles.splice(i, 1);
    }
  }

  updatePools(dt) {
    const game = this.game;
    for (let i = this.pools.length - 1; i >= 0; i -= 1) {
      const pool = this.pools[i];
      pool.age += dt;
      pool.duration -= dt;
      pool.tickTimer -= dt;
      if (pool.tickTimer <= 0) {
        pool.tickTimer += pool.tick;
        const targets = game.enemies.enemiesNear(pool.x, pool.y, pool.radius + 30);
        for (const e of targets) {
          if (e.hp > 0 && Math.hypot(e.x - pool.x, e.y - pool.y) < pool.radius) {
            game.enemies.damageEnemy(e, pool.damage);
            game.fx.spawnDamageNumber(e.x, e.y - e.radius, Math.round(pool.damage), '#7ec8ff');
          }
        }
      }
      if (pool.duration <= 0) this.pools.splice(i, 1);
    }
  }

  updateBolts(dt) {
    for (let i = this.bolts.length - 1; i >= 0; i -= 1) {
      this.bolts[i].life -= dt;
      if (this.bolts[i].life <= 0) this.bolts.splice(i, 1);
    }
  }

  render(ctx, cam) {
    // 圣水领域
    for (const pool of this.pools) {
      const sx = pool.x - cam.ox;
      const sy = pool.y - cam.oy;
      const fadeIn = Math.min(1, pool.age * 4);
      const fadeOut = Math.min(1, pool.duration * 2);
      const alpha = 0.32 * fadeIn * fadeOut;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#4aa3df';
      ctx.beginPath();
      ctx.arc(sx, sy, pool.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha * 1.6;
      ctx.strokeStyle = '#a8d8ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, pool.radius * (0.85 + Math.sin(pool.age * 6) * 0.08), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 神器：死亡螺旋环绕斧刃
    if (this.hasArtifact('spiral')) {
      const st = this.artifactState;
      const player = this.game.player;
      const img = sprite('axe');
      for (let i = 0; i < 6; i += 1) {
        const ang = st.devourAngle + (i * Math.PI * 2) / 6;
        const bx = player.x + Math.cos(ang) * 130 - cam.ox;
        const by = player.y + Math.sin(ang) * 130 - cam.oy;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(st.devourAngle * 3);
        if (img) ctx.drawImage(img, -17, -17, 34, 34);
        ctx.restore();
      }
    }
    // 神器：圣洁吞噬跟随领域
    if (this.hasArtifact('devour') && this.devourPool) {
      const player = this.game.player;
      const sx = player.x - cam.ox;
      const sy = player.y - cam.oy;
      const r = this.devourPool.radius;
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#4aa3df';
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#a8d8ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy, r * (0.9 + Math.sin(this.artifactState.devourAngle * 5) * 0.06), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 投射物
    for (const p of this.projectiles) {
      const sx = p.x - cam.ox;
      const sy = p.y - cam.oy;
      const img = sprite(p.kind === 'blade' ? 'blade' : 'axe');
      const size = p.kind === 'blade' ? 26 : 34;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(p.kind === 'blade' ? Math.atan2(p.vy, p.vx) : p.spin);
      if (img) ctx.drawImage(img, -size / 2, -size / 2, size, size);
      else {
        ctx.fillStyle = p.kind === 'blade' ? '#e74c3c' : '#9fc5ff';
        ctx.fillRect(-size / 2, -3, size, 6);
      }
      ctx.restore();
    }

    // 闪电
    for (const bolt of this.bolts) {
      const alpha = bolt.life / bolt.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#f5d76e';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#fff2a8';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      bolt.points.forEach((pt, idx) => {
        const sx = pt.x - cam.ox + (Math.random() * 2 - 1) * 4;
        const sy = pt.y - cam.oy + (Math.random() * 2 - 1) * 4;
        if (idx === 0) ctx.moveTo(sx, sy - 40);
        ctx.lineTo(sx, sy);
      });
      ctx.stroke();
      ctx.restore();
    }
  }
}
