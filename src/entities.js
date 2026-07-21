import { CONFIG, ENEMY_TYPES } from './data.js';
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
    this.baseMagnet = 95;
    this.level = 1;
    this.exp = 0;
    this.weapons = [];
    this.passives = new Map();
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
  }

  takeDamage(amount) {
    if (this.iframes > 0) return false;
    this.hp -= amount;
    this.iframes = 0.5;
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
    const img = sprite('player');
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
  }

  reset() {
    this.enemies.length = 0;
    this.spawnTimer = 0.5;
    this.eliteTimer = 180;
  }

  statScale() {
    const t = this.game.time;
    return {
      hp: 1 + (t / 60) * 0.55,
      speed: 1 + Math.min(0.5, (t / 60) * 0.06),
      damage: 1 + (t / 60) * 0.22,
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

  spawnAt(type, scale) {
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
    this.enemies.push({
      type,
      x, y,
      hp: type.hp * scale.hp,
      maxHp: type.hp * scale.hp,
      speed: type.speed * scale.speed * (0.9 + Math.random() * 0.2),
      damage: type.damage * scale.damage,
      radius: type.radius,
      spriteSize: type.spriteSize,
      knockResist: type.knockResist,
      expValue: type.exp,
      flash: 0,
      kx: 0, ky: 0,
      hitCooldown: 0,
      wobble: Math.random() * Math.PI * 2,
      dotAccumulator: 0,
    });
  }

  update(dt) {
    const scale = this.statScale();
    const t = this.game.time;
    const interval = Math.max(0.22, 1.15 - t / 150);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer += interval;
      if (this.enemies.length < CONFIG.ENEMY_CAP) {
        this.spawnAt(this.pickType(), scale);
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
    const grid = this.buildGrid();
    const now = t;

    for (const e of this.enemies) {
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      e.x += (dx / dist) * e.speed * dt + e.kx * dt;
      e.y += (dy / dist) * e.speed * dt + e.ky * dt;
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
        if (player.takeDamage(e.damage)) {
          this.game.onPlayerHit();
        }
        e.hitCooldown = 0.8;
      }
    }

    // 清理死亡/超远
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const e = this.enemies[i];
      if (e.hp <= 0) {
        this.game.onEnemyKilled(e);
        this.enemies.splice(i, 1);
        continue;
      }
      const far = Math.hypot(e.x - player.x, e.y - player.y);
      if (far > CONFIG.LOGICAL_WIDTH * 1.6 && e.type !== ENEMY_TYPES.elite) {
        // 传送到玩家前方视野边缘,避免白走
        const angle = Math.random() * Math.PI * 2;
        e.x = player.x + Math.cos(angle) * (CONFIG.LOGICAL_WIDTH / 2 + 80);
        e.y = player.y + Math.sin(angle) * (CONFIG.LOGICAL_HEIGHT / 2 + 80);
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
    const grid = this.buildGrid();
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
      ctx.restore();
    }
  }

  damageEnemy(e, rawDamage, knockX = 0, knockY = 0) {
    e.hp -= rawDamage;
    e.flash = 0.12;
    const kb = 90 * (1 - e.knockResist);
    e.kx += knockX * kb;
    e.ky += knockY * kb;
  }
}
