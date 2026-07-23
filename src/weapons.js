import { WEAPONS, CONFIG } from './data.js';
import { sprite } from './assets.js';

export class WeaponSystem {
  constructor(game) {
    this.game = game;
    this.projectiles = [];
    this.pools = [];
    this.bolts = [];
    this.slashes = [];
    this.vials = [];
    this.artifactState = { stormTimer: 0, devourAngle: 0, stormcallTimer: 1.0, tempestDistance: 0, lastX: 0, lastY: 0 };
    this.devourPool = null;
  }

  reset() {
    this.projectiles.length = 0;
    this.pools.length = 0;
    this.bolts.length = 0;
    this.slashes.length = 0;
    this.vials.length = 0;
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
        // 血裔·攻速/冷却缩减：cooldown 乘 player.cooldownMul（<1=更快）
        weapon.timer += s.cooldown * (player.cooldownMul || 1);
        this.fire(weapon, s);
      }
    }
    this.updateProjectiles(dt);
    this.updatePools(dt);
    this.updateBolts(dt);
    this.updateVials(dt);
    this.updateSlashes(dt);
  }

  updateSlashes(dt) {
    for (let i = this.slashes.length - 1; i >= 0; i -= 1) {
      this.slashes[i].life -= dt;
      if (this.slashes[i].life <= 0) this.slashes.splice(i, 1);
    }
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
    } else if (weapon.id === 'sepulcher') {
      // 寂灭结界：更大光环持续伤害 + 每 1.2s 向 4 向迸射骨刺
      st.devourAngle += dt;
      const r = 150;
      for (const e of game.enemies.enemiesNear(player.x, player.y, r + 30)) {
        if (e.hp > 0 && Math.hypot(e.x - player.x, e.y - player.y) < r) {
          game.enemies.damageEnemy(e, 20 * player.damageMul, 0, 0);
        }
      }
      st.sepTimer = (st.sepTimer || 0) - dt;
      if (st.sepTimer <= 0) {
        st.sepTimer = 1.2;
        for (let i = 0; i < 4; i += 1) {
          const ang = (i / 4) * Math.PI * 2 + st.devourAngle;
          this.projectiles.push({
            kind: 'blade', x: player.x, y: player.y,
            vx: Math.cos(ang) * 360, vy: Math.sin(ang) * 360,
            damage: 24 * player.damageMul, pierce: 2, life: 1.4, spin: 0, hitSet: new Set(),
          });
        }
      }
    } else if (weapon.id === 'eternalwhip') {
      // 永劫之鞭：每 1.0s 三向(-20°/0/+20°)齐扫、更宽
      st.ewTimer = (st.ewTimer || 0) - dt;
      if (st.ewTimer <= 0) {
        st.ewTimer = 1.0;
        const target = this.pickTarget(0);
        const base = target ? Math.atan2(target.y - player.y, target.x - player.x) : (player.facing >= 0 ? 0 : Math.PI);
        for (const off of [-0.35, 0, 0.35]) {
          this.applyWhip(player, base + off, { damage: 30, length: 300, width: 70 });
        }
      }
    } else if (weapon.id === 'matrix') {
      // 圣光矩阵：每 1.2s 常驻八向放射、穿透 3
      st.mxTimer = (st.mxTimer || 0) - dt;
      if (st.mxTimer <= 0) {
        st.mxTimer = 1.2;
        const n = 8;
        for (let i = 0; i < n; i += 1) {
          const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
          this.projectiles.push({
            kind: 'blade', x: player.x, y: player.y,
            vx: Math.cos(ang) * 440, vy: Math.sin(ang) * 440,
            damage: 30 * player.damageMul, pierce: 3, life: 1.6, spin: 0, hitSet: new Set(),
          });
        }
      }
    }
  }

  fire(weapon, s) {
    const game = this.game;
    const player = game.player;
    const enemies = game.enemies.enemies;
    if (enemies.length === 0) return;

    if (weapon.id === 'blade') {
      // 忍者飞刀：以最近敌人为中心、count 片扇形连掷，像飞刀出手
      const target = this.pickTarget(0) || enemies[0];
      const base = Math.atan2(target.y - player.y, target.x - player.x);
      const spread = 0.16;
      const n = s.count;
      for (let i = 0; i < n; i += 1) {
        const ang = base + (i - (n - 1) / 2) * spread;
        this.projectiles.push({
          kind: 'blade',
          x: player.x, y: player.y,
          vx: Math.cos(ang) * s.speed, vy: Math.sin(ang) * s.speed,
          damage: s.damage * player.damageMul,
          pierce: s.pierce, life: 1.6, spin: 0, hitSet: new Set(),
        });
      }
    } else if (weapon.id === 'holywater') {
      // 血裔·范围/持续：圣徒 areaMul 放大圣水领域；改为抛物线飞瓶，落地生成领域
      const area = player.areaMul || 1;
      for (let i = 0; i < s.count; i += 1) {
        const target = this.pickTarget(i) || enemies[0];
        const jx = target.x + (Math.random() * 2 - 1) * 40;
        const jy = target.y + (Math.random() * 2 - 1) * 40;
        const dist = Math.hypot(jx - player.x, jy - player.y);
        this.vials.push({
          x0: player.x, y0: player.y, x: player.x, y: player.y,
          tx: jx, ty: jy,
          t: 0,
          dur: Math.max(0.34, Math.min(0.72, dist / 420)),
          radius: s.radius * area,
          damage: s.damage * player.damageMul,
          duration: s.duration * area, tick: s.tick, tickTimer: 0, age: 0,
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
    } else if (weapon.id === 'aura') {
      // 亡灵光环：贴身脉冲，对环内所有敌人造成 tick 伤害（连续 AoE，与圣水远处领域互补）
      const r = s.radius * (player.areaMul || 1);
      for (const e of game.enemies.enemiesNear(player.x, player.y, r + 30)) {
        if (e.hp > 0 && Math.hypot(e.x - player.x, e.y - player.y) < r) {
          game.enemies.damageEnemy(e, s.damage * player.damageMul, 0, 0);
          game.fx.spawnDamageNumber(e.x, e.y - e.radius, Math.round(s.damage * player.damageMul), '#c060a0');
          // 血裔·吸血(嗜血者) 同步回血
          if (player.lifesteal > 0) game.player.hp = Math.min(game.player.maxHp, game.player.hp + player.lifesteal);
        }
      }
    } else if (weapon.id === 'whip') {
      // 噬魂长鞭：朝最近敌人方向挥出长条 hitbox（静止时朝面向），一线清空
      const target = this.pickTarget(0) || enemies[0];
      const ang = target
        ? Math.atan2(target.y - player.y, target.x - player.x)
        : (player.facing >= 0 ? 0 : Math.PI);
      this.applyWhip(player, ang, s);
    } else if (weapon.id === 'cross') {
      // 黎明圣印：多向放射（4/6/8 方向），复用 blade 投射物渲染
      const n = s.count;
      for (let i = 0; i < n; i += 1) {
        const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
        this.projectiles.push({
          kind: 'blade', x: player.x, y: player.y,
          vx: Math.cos(ang) * s.speed, vy: Math.sin(ang) * s.speed,
          damage: s.damage * player.damageMul,
          pierce: s.pierce, life: 1.6, spin: 0, hitSet: new Set(),
        });
      }
    }
  }

  // 长鞭：沿方向线段 hitbox 采样，命中矩形内敌人（点到线段距离判定）
  applyWhip(player, ang, s) {
    const game = this.game;
    const len = s.length;
    const halfW = (s.width || 44) / 2;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    for (let t = 20; t <= len; t += 12) {
      const cx = player.x + dx * t;
      const cy = player.y + dy * t;
      for (const e of game.enemies.enemiesNear(cx, cy, halfW + 30)) {
        if (e.hp <= 0) continue;
        const px = e.x - player.x;
        const py = e.y - player.y;
        const proj = px * dx + py * dy;
        if (proj < 0 || proj > len) continue;
        const perp = Math.abs(px * dy - py * dx);
        if (perp < halfW + e.radius) {
          game.enemies.damageEnemy(e, s.damage * player.damageMul, dx, dy);
          game.fx.spawnDamageNumber(e.x, e.y - e.radius, Math.round(s.damage * player.damageMul), '#c060a0');
          if (player.lifesteal > 0) game.player.hp = Math.min(game.player.maxHp, game.player.hp + player.lifesteal);
        }
      }
    }
    this.slashes.push({ x: player.x, y: player.y, ang, len, width: s.width || 44, life: 0.22, maxLife: 0.22, bow: (Math.random() < 0.5 ? -1 : 1) });
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
    const firstX = current.x, firstY = current.y;
    const points = [{ x: firstX, y: firstY - 360, sky: true }, { x: firstX, y: firstY }];
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
    game.fx.spawnSparks(firstX, firstY, '#f5d76e', 10);
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
          // 血裔·吸血(嗜血者)：每次命中按 lifesteal 回血（不含 pool/artifact，避免过载）
          if (game.player.lifesteal > 0) {
            game.player.hp = Math.min(game.player.maxHp, game.player.hp + game.player.lifesteal);
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

  updateVials(dt) {
    const game = this.game;
    for (let i = this.vials.length - 1; i >= 0; i -= 1) {
      const v = this.vials[i];
      v.t += dt / v.dur;
      if (v.t >= 1) {
        // 落地：生成圣水领域
        this.pools.push({
          x: v.tx, y: v.ty, radius: v.radius, damage: v.damage,
          duration: v.duration, tick: v.tick, tickTimer: 0, age: 0,
        });
        game.fx.spawnSparks(v.tx, v.ty, '#a8d8ff', 8);
        this.vials.splice(i, 1);
        continue;
      }
      const e = v.t;
      const arc = Math.sin(Math.PI * e) * Math.min(130, Math.hypot(v.tx - v.x0, v.ty - v.y0) * 0.3);
      v.x = v.x0 + (v.tx - v.x0) * e;
      v.y = v.y0 + (v.ty - v.y0) * e - arc;
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

    // 圣水飞瓶（抛物线投掷）
    for (const v of this.vials) {
      const sx = v.x - cam.ox;
      const sy = v.y - cam.oy;
      const img = sprite('holywater');
      const sz = 18;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(v.t * Math.PI * 1.6);
      if (img) ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
      else { ctx.fillStyle = '#7ec8ff'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }

    // 亡灵光环 + 长鞭横扫 + 寂灭结界（武器丰富化新增视觉）
    const auraW = this.game.player.weapons.find((w) => w.id === 'aura' && !w.artifact);
    if (auraW) {
      const st = this.stats(auraW);
      const r = st.radius * (this.game.player.areaMul || 1);
      const pulse = 0.85 + Math.sin(this.game.time * 4) * 0.1;
      const sx = this.game.player.x - cam.ox;
      const sy = this.game.player.y - cam.oy;
      const rot = this.game.time * 0.6;
      ctx.save();
      ctx.translate(sx, sy);
      // 红色圆环（脉冲）
      ctx.globalAlpha = 0.30;
      ctx.fillStyle = '#c0202a';
      ctx.beginPath(); ctx.arc(0, 0, r * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = '#e23b3b';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = 'rgba(226,59,59,0.8)';
      ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(0, 0, r * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;
      // 内嵌六芒星（两等边三角形，缓慢旋转）
      ctx.rotate(rot);
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = '#ff7a85';
      ctx.lineWidth = 2;
      const R = r * 0.55;
      for (let tri = 0; tri < 2; tri += 1) {
        const off = tri * Math.PI;
        ctx.beginPath();
        for (let k = 0; k <= 3; k += 1) {
          const ang = -Math.PI / 2 + off + (k % 3) * (Math.PI * 2 / 3);
          const px = Math.cos(ang) * R, py = Math.sin(ang) * R;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    // 寂灭结界：更亮更大的光环
    if (this.hasArtifact('sepulcher')) {
      const sx = this.game.player.x - cam.ox;
      const sy = this.game.player.y - cam.oy;
      const r = 150;
      const pulse = 0.85 + Math.sin(this.game.time * 4) * 0.1;
      ctx.save();
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = '#8a2f5a';
      ctx.beginPath(); ctx.arc(sx, sy, r * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = '#e07ac0';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(sx, sy, r * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    // 长鞭横扫：锥形曲线鞭 + 末端裂响
    const qbez = (x0, y0, cx, cy, x1, y1, u) => {
      const m = 1 - u;
      return {
        x: m * m * x0 + 2 * m * u * cx + u * u * x1,
        y: m * m * y0 + 2 * m * u * cy + u * u * y1,
      };
    };
    for (const sl of this.slashes) {
      const a = sl.life / sl.maxLife;
      const t = 1 - a;
      const grow = Math.min(1, t * 5);          // 快速挥出
      const fade = a;
      ctx.save();
      ctx.translate(sl.x - cam.ox, sl.y - cam.oy);
      ctx.rotate(sl.ang);
      const tipX = sl.len * grow;
      const bow = Math.sin(t * Math.PI) * sl.width * 0.55 * (sl.bow || 1);
      ctx.lineCap = 'round';
      const N = 16;
      for (let i = 0; i < N; i += 1) {
        const u0 = i / N, u1 = (i + 1) / N;
        const p0 = qbez(0, 0, tipX * 0.5, bow, tipX, 0, u0);
        const p1 = qbez(0, 0, tipX * 0.5, bow, tipX, 0, u1);
        ctx.lineWidth = Math.max(1, sl.width * (1 - 0.82 * u0));
        ctx.globalAlpha = fade * (0.95 - u0 * 0.35);
        ctx.strokeStyle = i < N * 0.5 ? 'rgba(236,140,200,0.95)' : 'rgba(200,90,165,0.85)';
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
      if (grow >= 0.96) {
        ctx.globalAlpha = fade * 0.9;
        ctx.fillStyle = 'rgba(255,224,246,0.95)';
        ctx.beginPath();
        ctx.arc(tipX, 0, 3 + (1 - fade) * 6, 0, Math.PI * 2);
        ctx.fill();
      }
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

    // 闪电（含天降落雷）
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
        if (idx === 0) {
          if (pt.sky) ctx.moveTo(sx, sy);
          else ctx.moveTo(sx, sy - 40);
        } else {
          ctx.lineTo(sx, sy);
        }
      });
      ctx.stroke();
      // 落点爆闪（additive）
      const impact = bolt.points.find((p) => !p.sky);
      if (impact) {
        const ix = impact.x - cam.ox, iy = impact.y - cam.oy;
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha * 0.85;
        ctx.fillStyle = 'rgba(255,245,180,0.9)';
        ctx.beginPath();
        ctx.arc(ix, iy, 5 + alpha * 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore();
    }
  }
}
