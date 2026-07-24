import { CONFIG, ENEMY_TYPES, BOSSES, NIGHT_START, ENDGAME_BOSS_TIME, AFFIXES } from './data.js';
import { sprite } from './assets.js';

export class Player {
  constructor() { this.reset(); }

  reset() {
    this.x = 0;
    this.y = 0;
    this.radius = CONFIG.PLAYER_RADIUS;
    this.maxHp = 100;
    this.hp = 100;
    this.baseSpeed = 170;
    this.speedMul = 1;
    this.damageMul = 1;
    this.magnetMul = 1;
    this.expMul = 1;
    this.damageTakenMul = 1;
    this.regenRate = 0;
    this.baseMagnet = 95;
    // 血裔注入属性：冷却倍率(<1=更快) / 范围倍率 / 命中吸血
    this.cooldownMul = 1;
    this.areaMul = 1;
    this.lifesteal = 0;
    this.level = 1;
    this.exp = 0;
    this.weapons = [];
    this.passives = new Map();
    // S3 槽位上限（基础上限，startRun 时由祭坛解锁 +1）
    this.maxWeapons = CONFIG.MAX_WEAPONS;
    this.maxPassives = CONFIG.MAX_PASSIVES;
    this.iframes = 0;
    this.facing = 1;
    this.walkTime = 0;
    this.moving = false;
  }

  get speed() { return this.baseSpeed * this.speedMul; }
  get magnetRange() { return this.baseMagnet * this.magnetMul; }

  update(dt, input) {
    const axis = input.axis();
    this.moving = axis.x !== 0 || axis.y !== 0;
    if (this.moving) {
      this.x += axis.x * this.speed * dt;
      this.y += axis.y * this.speed * dt;
      this.walkTime += dt;
      if (axis.x !== 0) this.facing = axis.x > 0 ? 1 : -1;
    }
    this.iframes = Math.max(0, this.iframes - dt);
    // 血色再生：持续回血（封顶 maxHp），死亡后不再回
    if (this.regenRate > 0 && this.hp > 0) {
      this.hp = Math.min(this.maxHp, this.hp + this.regenRate * dt);
    }
  }

  takeDamage(amount) {
    if (this.iframes > 0) return false;
    this.hp -= amount * (this.damageTakenMul || 1);
    this.iframes = 0.5;
    if (navigator.vibrate) navigator.vibrate(50);
    return true;
  }

  render(ctx, cam) {
    const sx = Math.round(this.x - cam.ox);
    const sy = Math.round(this.y - cam.oy);
    const bob = this.moving ? Math.sin(this.walkTime * 12) * 2 : 0;
    const blink = this.iframes > 0 && Math.floor(this.iframes * 16) % 2 === 0;
    const size = CONFIG.PLAYER_SPRITE;
    // 脚下阴影
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + this.radius + 3, this.radius * 0.95, this.radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    if (blink) ctx.globalAlpha = 0.35;
    ctx.translate(sx, sy + bob);
    ctx.scale(this.facing, 1);
    const breath = 1 + Math.sin(this.walkTime * 3) * 0.025;
    ctx.scale(breath, breath);
    // A4 玩家精灵按血裔切换；this.game 在部分预览上下文未注入，做防御性兜底
    const bl = (this.game && this.game.bloodline) || (typeof window !== 'undefined' && window.__game && window.__game.bloodline) || 'wanderer';
    const img = sprite('player_' + bl) || sprite('player');
    if (img) {
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export class EnemyManager {
  constructor(game) {
    this.game = game;
    this.enemies = [];
    this.spawnTimer = 0;
    this.eliteTimer = 0;
    this.bossSpawned = new Set();
    this.activeBoss = null;
    this.enemyProjectiles = [];
  }

  reset() {
    this.enemies.length = 0;
    this.spawnTimer = 0.5;
    this.eliteTimer = 180;
    this.bossSpawned = new Set();
    this.activeBoss = null;
    this.enemyProjectiles = [];
  }

  statScale(isBoss = false) {
    const t = this.game.time;
    const diff = this.game.difficulty;
    const linear = {
      hp: 1 + (t / 60) * diff.hpSlope,
      speed: 1 + Math.min(0.5, (t / 60) * 0.06),
      damage: 1 + (t / 60) * diff.dmgSlope,
    };
    // 永夜加深（9 分钟后指数增长）：敌人 HP/伤害 = 线性 × nightBase^D × (1 + 神器数×artifactCounter×D)
    // 速度不乘永夜指数，避免后期怪变成不可风筝的子弹
    // 非 Boss（小怪/精英）永夜伤害指数减半（D/2），避免后期指数秒杀；Boss 保持全额威慑
    const D = Math.max(0, (t - NIGHT_START) / 60);
    const exp = isBoss ? D : D / 2;
    const nightMult = Math.pow(diff.nightBase, exp);
    const artifacts = this.game.player.weapons.filter((w) => w.artifact).length;
    const artifactMult = 1 + diff.artifactCounter * artifacts * D;
    const endMult = nightMult * artifactMult;
    return {
      hp: linear.hp * endMult,
      speed: linear.speed,
      damage: linear.damage * endMult,
    };
  }

  pickType() {
    const t = this.game.time;
    const pool = Object.values(ENEMY_TYPES).filter((e) => e.weight > 0 && t >= e.unlockAt);
    const total = pool.reduce((s, e) => s + e.weight, 0);
    let roll = Math.random() * total;
    for (const e of pool) {
      roll -= e.weight;
      if (roll <= 0) return e;
    }
    return pool[0];
  }

  spawnAt(type, scale, affix) {
    const cam = this.game.camera;
    const w = CONFIG.LOGICAL_WIDTH;
    const h = CONFIG.LOGICAL_HEIGHT;
    const margin = 60;
    const side = Math.floor(Math.random() * 4);
    let x;
    let y;
    if (side === 0) { x = cam.ox - margin; y = cam.oy + Math.random() * h; }
    else if (side === 1) { x = cam.ox + w + margin; y = cam.oy + Math.random() * h; }
    else if (side === 2) { x = cam.ox + Math.random() * w; y = cam.oy - margin; }
    else { x = cam.ox + Math.random() * w; y = cam.oy + h + margin; }
    this.enemies.push(this.createEnemy(type, scale, x, y, affix));
  }

  // 狼群词缀：从同一方向一次刷一队扇形包抄
  spawnPack(type, scale) {
    const cam = this.game.camera;
    const w = CONFIG.LOGICAL_WIDTH;
    const h = CONFIG.LOGICAL_HEIGHT;
    const margin = 60;
    const side = Math.floor(Math.random() * 4);
    let baseX;
    let baseY;
    if (side === 0) { baseX = cam.ox - margin; baseY = cam.oy + Math.random() * h; }
    else if (side === 1) { baseX = cam.ox + w + margin; baseY = cam.oy + Math.random() * h; }
    else if (side === 2) { baseX = cam.ox + Math.random() * w; baseY = cam.oy - margin; }
    else { baseX = cam.ox + Math.random() * w; baseY = cam.oy + h + margin; }
    const diff = this.game.difficulty;
    const count = diff.packMin + Math.floor(Math.random() * (diff.packMax - diff.packMin + 1));
    for (let i = 0; i < count && this.enemies.length < CONFIG.ENEMY_CAP; i += 1) {
      const ox = (Math.random() * 2 - 1) * 40;
      const oy = (Math.random() * 2 - 1) * 40;
      this.enemies.push(this.createEnemy(type, scale, baseX + ox, baseY + oy, 'pack'));
    }
  }

  // 随机词缀（非 pack，单怪属性型）。概率 = 0.20 × 难度 affixMul
  rollSingleAffix() {
    const diff = this.game.difficulty;
    if (Math.random() > 0.20 * diff.affixMul) return null;
    const keys = Object.keys(AFFIXES).filter((k) => k !== 'pack');
    return keys[Math.floor(Math.random() * keys.length)];
  }

  createEnemy(type, scale, x, y, affix) {
    const affixDef = affix ? AFFIXES[affix] : null;
    const expValue = Math.round(type.exp * (affixDef ? affixDef.expMul : 1));
    const e = {
      type,
      x, y,
      hp: type.hp * scale.hp,
      maxHp: type.hp * scale.hp,
      speed: type.speed * scale.speed * (0.9 + Math.random() * 0.2),
      damage: type.damage * scale.damage,
      radius: type.radius,
      spriteSize: type.spriteSize,
      knockResist: type.immuneKnockback ? 1 : type.knockResist,
      expValue,
      flash: 0,
      affix: affix || null,
      affixDef,
      // 暗影猎手冲刺状态
      dashState: 'idle', // idle | charging | dashing
      dashTimer: 0,
      dashVx: 0, dashVy: 0,
      dashSpeed: type.dashSpeed || 0,
      dmgTakenMul: affixDef && affixDef.dmgTakenMul ? affixDef.dmgTakenMul : 1,
      kx: 0, ky: 0,
      hitCooldown: 0,
      wobble: Math.random() * Math.PI * 2,
      dotAccumulator: 0,
    };
    return e;
  }

  spawnBoss(def) {
    const cam = this.game.camera;
    const w = CONFIG.LOGICAL_WIDTH;
    const h = CONFIG.LOGICAL_HEIGHT;
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.hypot(w, h) / 2 + 80;
    const boss = {
      type: def,
      x: cam.ox + w / 2 + Math.cos(angle) * dist,
      y: cam.oy + h / 2 + Math.sin(angle) * dist,
      hp: def.isEndgame ? def.hp * this.game.difficulty.bossHpMul : def.hp,
      maxHp: def.isEndgame ? def.hp * this.game.difficulty.bossHpMul : def.hp,
      speed: def.speed,
      damage: def.damage,
      radius: def.radius,
      spriteSize: def.spriteSize,
      knockResist: def.knockResist,
      expValue: def.exp,
      flash: 0,
      kx: 0, ky: 0,
      hitCooldown: 0,
      wobble: Math.random() * Math.PI * 2,
      dotAccumulator: 0,
      isBoss: true,
      bossDef: def,
      skillIndex: 0,
      dashing: 0,
      dashVx: 0,
      dashVy: 0,
      dashBonusDamage: 0,
      enraged: false,
    };
    this.enemies.push(boss);
    return boss;
  }

  triggerBossSkill(e, skill) {
    const player = this.game.player;
    if (skill.type === 'summon' || skill.type === 'summon_barrage') {
      this.bossSummon(e, skill.enemyType, skill.count, skill.affix);
    }
    if (skill.type === 'barrage' || skill.type === 'summon_barrage' || skill.type === 'dash_barrage') {
      this.bossBarrage(e, skill.barrageCount || skill.count, skill.speed, skill.damage);
    }
    if (skill.type === 'dash' || skill.type === 'dash_barrage') {
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      e.dashVx = (dx / dist) * e.speed * skill.speedMul;
      e.dashVy = (dy / dist) * e.speed * skill.speedMul;
      e.dashing = skill.duration;
      e.dashBonusDamage = skill.damage || 0;
    }
    if (skill.type === 'enrage') {
      e.speed *= skill.speedMul;
      e.enraged = true;
    }
  }

  bossSummon(e, enemyType, count, affix) {
    const type = ENEMY_TYPES[enemyType];
    if (!type) return;
    const scale = this.statScale(false);
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
      const x = e.x + Math.cos(angle) * 60;
      const y = e.y + Math.sin(angle) * 60;
      this.enemies.push(this.createEnemy(type, scale, x, y, affix));
    }
  }

  bossBarrage(e, count, speed, damage) {
    const player = this.game.player;
    const base = Math.atan2(player.y - e.y, player.x - e.x);
    const spread = (40 * Math.PI) / 180;
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
      const angle = base + t * spread;
      this.enemyProjectiles.push({
        x: e.x,
        y: e.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        damage,
        life: 4,
        radius: 5,
      });
    }
  }

  update(dt) {
    const scale = this.statScale(false);
    const t = this.game.time;
    const diff = this.game.difficulty;
    // 终局 Boss：永夜化身（15 分钟降临，击杀=通关）。登场时清掉现有 Boss
    if (t >= ENDGAME_BOSS_TIME && !this.bossSpawned.has('avatar')) {
      this.bossSpawned.add('avatar');
      for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
        if (this.enemies[i].isBoss) this.enemies.splice(i, 1);
      }
      this.activeBoss = null;
      const avatarDef = BOSSES.find((d) => d.id === 'avatar');
      this.activeBoss = this.spawnBoss(avatarDef);
      this.game.onBossSpawn?.(avatarDef);
    }
    // 终局已触发则不再生成其他 Boss（避免 time 跳变时早期 Boss 一次性全刷）
    if (!this.bossSpawned.has('avatar')) {
      for (const def of BOSSES) {
        const unlockAt = Math.round(def.unlockAt * diff.bossGapMul);
        if (t >= unlockAt && !this.bossSpawned.has(def.id)) {
          this.bossSpawned.add(def.id);
          this.activeBoss = this.spawnBoss(def);
          this.game.onBossSpawn?.(def);
        }
      }
    }
    const interval = Math.max(0.18, 0.9 - t / 160) / diff.spawnMul;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer += interval;
      // Boss 存活时降低刷怪量，让玩家集中火力打 Boss
      const bossCalm = this.activeBoss ? diff.bossCalm : 1;
      if (this.enemies.length < CONFIG.ENEMY_CAP) {
        if (Math.random() < 0.20 * diff.affixMul) {
          this.spawnPack(this.pickType(), scale); // 狼群波次
        } else {
          this.spawnAt(this.pickType(), scale, this.rollSingleAffix());
        }
        const extra = t > 120 ? 2 : (t > 60 ? 1 : 0);
        const adjustedExtra = Math.round(extra * bossCalm);
        for (let i = 0; i < adjustedExtra && this.enemies.length < CONFIG.ENEMY_CAP; i += 1) {
          if (Math.random() < 0.20 * diff.affixMul) {
            this.spawnPack(this.pickType(), scale);
          } else {
            this.spawnAt(this.pickType(), scale, this.rollSingleAffix());
          }
        }
      }
    }
    if (t >= ENEMY_TYPES.elite.unlockAt) {
      this.eliteTimer -= dt;
      if (this.eliteTimer <= 0) {
        this.eliteTimer = 90;
        this.spawnAt(ENEMY_TYPES.elite, scale);
      }
    }

    const player = this.game.player;
    this._grid = this.buildGrid();  // 每帧构建一次网格，复用给 enemiesNear 与敌人推开
    const grid = this._grid;
    const now = t;

    for (const e of this.enemies) {
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (e.isBoss && e.dashing > 0) {
        e.x += e.dashVx * dt;
        e.y += e.dashVy * dt;
        e.dashing -= dt;
      } else if (e.dashState === 'dashing') {
        // 暗影猎手冲刺中：高速直线冲
        e.x += e.dashVx * dt;
        e.y += e.dashVy * dt;
        e.dashTimer -= dt;
        if (e.dashTimer <= 0) e.dashState = 'idle';
      } else if (e.dashState === 'charging') {
        // 蓄力中：原地不动
        e.dashTimer -= dt;
        if (e.dashTimer <= 0) {
          e.dashState = 'dashing';
          e.dashTimer = 0.35;
          e.dashVx = (dx / dist) * e.speed * e.dashSpeed;
          e.dashVy = (dy / dist) * e.speed * e.dashSpeed;
        }
      } else {
        // 暗影猎手：进入射程后开始蓄力
        if (e.type.dashSpeed && dist < e.type.dashRange && dist > 1) {
          e.dashState = 'charging';
          e.dashTimer = e.type.dashCharge;
        }
        e.x += (dx / dist) * e.speed * dt + e.kx * dt;
        e.y += (dy / dist) * e.speed * dt + e.ky * dt;
      }
      if (e.isBoss && e.skillIndex < e.bossDef.skills.length
        && e.hp / e.maxHp <= e.bossDef.skills[e.skillIndex].at) {
        this.triggerBossSkill(e, e.bossDef.skills[e.skillIndex]);
        e.skillIndex += 1;
      }
      const decay = Math.pow(0.0001, dt);
      e.kx *= decay;
      e.ky *= decay;
      e.flash = Math.max(0, e.flash - dt);
      e.hitCooldown = Math.max(0, e.hitCooldown - dt);
      e.wobble += dt * 6;

      // 敌人间软推开
      const neighbors = this.neighborsOf(grid, e.x, e.y);
      for (const o of neighbors) {
        if (o === e) continue;
        const ddx = e.x - o.x;
        const ddy = e.y - o.y;
        const dd = Math.hypot(ddx, ddy);
        const minD = (e.radius + o.radius) * 0.8;
        if (dd > 0.001 && dd < minD) {
          const push = (minD - dd) / minD * 30 * dt;
          e.x += (ddx / dd) * push;
          e.y += (ddy / dd) * push;
        }
      }

      // 触碰玩家
      if (dist < e.radius + player.radius && e.hitCooldown <= 0) {
        let touchDamage = e.isBoss && e.dashing > 0
          ? e.damage + (e.dashBonusDamage || 0)
          : e.damage;
        // 非 Boss 单次触碰伤害上限 = 35% 最大生命，避免后期小怪一次秒杀（Boss 保持全额威慑）
        if (!e.isBoss) {
          const cap = player.maxHp * 0.35;
          if (touchDamage > cap) touchDamage = cap;
        }
        if (player.takeDamage(touchDamage)) {
          this.game.onPlayerHit();
        }
        e.hitCooldown = 0.8;
      }
    }

    // 清理死亡/超远
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const e = this.enemies[i];
      if (e.hp <= 0) {
        // 爆破词缀：死亡时对附近玩家造成范围伤害
        if (e.affix === 'volatile') {
          const bd = Math.hypot(player.x - e.x, player.y - e.y);
          if (bd < AFFIXES.volatile.blastRadius) {
            if (player.takeDamage(AFFIXES.volatile.blastDamage)) this.game.onPlayerHit();
          }
        }
        this.game.onEnemyKilled(e);
        if (e.isBoss) {
          if (this.activeBoss === e) this.activeBoss = null;
          this.game.onBossKilled?.(e);
        } else if (e.type === ENEMY_TYPES.elite) {
          this.game.pickups.dropChest(e.x, e.y);
        }
        this.enemies.splice(i, 1);
        continue;
      }
      const far = Math.hypot(e.x - player.x, e.y - player.y);
      if (far > CONFIG.LOGICAL_WIDTH * 1.6 && e.type !== ENEMY_TYPES.elite && !e.isBoss) {
        // 传送到玩家前方视野边缘,避免白走
        const angle = Math.random() * Math.PI * 2;
        e.x = player.x + Math.cos(angle) * (CONFIG.LOGICAL_WIDTH / 2 + 80);
        e.y = player.y + Math.sin(angle) * (CONFIG.LOGICAL_HEIGHT / 2 + 80);
      }
    }

    // 敌方弹幕
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i -= 1) {
      const p = this.enemyProjectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      const distP = Math.hypot(p.x - player.x, p.y - player.y);
      if (distP < p.radius + player.radius) {
        if (player.takeDamage(p.damage)) {
          this.game.onPlayerHit();
        }
        this.enemyProjectiles.splice(i, 1);
        continue;
      }
      if (p.life <= 0 || distP > 800) {
        this.enemyProjectiles.splice(i, 1);
      }
    }
  }

  buildGrid() {
    const grid = new Map();
    const cell = CONFIG.GRID_CELL;
    for (const e of this.enemies) {
      const gx = Math.floor(e.x / cell);
      const gy = Math.floor(e.y / cell);
      const key = `${gx},${gy}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(e);
    }
    return grid;
  }

  neighborsOf(grid, x, y) {
    const cell = CONFIG.GRID_CELL;
    const gx = Math.floor(x / cell);
    const gy = Math.floor(y / cell);
    const out = [];
    for (let i = -1; i <= 1; i += 1) {
      for (let j = -1; j <= 1; j += 1) {
        const bucket = grid.get(`${gx + i},${gy + j}`);
        if (bucket) out.push(...bucket);
      }
    }
    return out;
  }

  enemiesNear(x, y, range) {
    const grid = this._grid;  // 复用 update() 中每帧只构建一次的网格，避免数百次全量重建（P0）
    const cell = CONFIG.GRID_CELL;
    const r = Math.ceil(range / cell);
    const gx = Math.floor(x / cell);
    const gy = Math.floor(y / cell);
    const out = [];
    for (let i = -r; i <= r; i += 1) {
      for (let j = -r; j <= r; j += 1) {
        const bucket = grid.get(`${gx + i},${gy + j}`);
        if (bucket) out.push(...bucket);
      }
    }
    return out;
  }

  nearestTo(x, y, maxDist = Infinity) {
    let best = null;
    let bestD = maxDist;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  render(ctx, cam) {
    const sorted = [...this.enemies].sort((a, b) => a.y - b.y);
    for (const e of sorted) {
      const sx = Math.round(e.x - cam.ox);
      const sy = Math.round(e.y - cam.oy);
      if (sx < -120 || sy < -120 || sx > CONFIG.LOGICAL_WIDTH + 120 || sy > CONFIG.LOGICAL_HEIGHT + 120) continue;
      const img = sprite(e.type.sprite);
      const wobbleY = e.type === ENEMY_TYPES.bat ? Math.sin(e.wobble) * 3 : 0;
      const size = e.spriteSize;
      // 脚下阴影
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + e.radius * 0.85, e.radius * 0.85, e.radius * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(sx, sy + wobbleY);
      if (this.game.player.x < e.x) ctx.scale(-1, 1);
      // A3 屏幕内微动画：纯 in-code 变换，零新素材，按 type 区分
      {
        const ph = e.wobble;
        const t = this.game.time;
        if (e.type === ENEMY_TYPES.slime) {
          const sq = 1 + Math.sin(t * 6 + ph) * 0.12;
          ctx.scale(1 / Math.sqrt(sq), sq);
        } else if (e.type === ENEMY_TYPES.skeleton) {
          ctx.rotate(Math.sin(t * 4 + ph) * 0.06);
        } else if (e.type === ENEMY_TYPES.elite || e.isBoss) {
          ctx.scale(1, 1 + Math.sin(t * 5 + ph) * 0.03);
        } else if (e.type === ENEMY_TYPES.bat) {
          ctx.scale(1 + Math.sin(t * 18 + ph) * 0.14, 1 + Math.cos(t * 18 + ph) * 0.08);
        }
      }
      if (img) {
        ctx.drawImage(img, -size / 2, -size / 2, size, size);
      } else {
        ctx.fillStyle = '#8e44ad';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      if (e.flash > 0) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.globalAlpha = Math.min(1, e.flash * 8);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius * 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
      if (e.isBoss && e.enraged) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius * 1.15, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    for (const p of this.enemyProjectiles) {
      const sx = p.x - cam.ox;
      const sy = p.y - cam.oy;
      ctx.save();
      ctx.fillStyle = '#e74c3c';
      ctx.shadowColor = '#ff6b6b';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(sx, sy, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  damageEnemy(e, rawDamage, knockX = 0, knockY = 0) {
    // 护盾词缀：受到的伤害 ×dmgTakenMul（完整正背面减伤留 PLACEHOLDER，先用全时减伤）
    const dmg = rawDamage * (e.dmgTakenMul || 1);
    e.hp -= dmg;
    e.flash = 0.12;
    const kb = 90 * (1 - e.knockResist);
    e.kx += knockX * kb;
    e.ky += knockY * kb;
  }
}
