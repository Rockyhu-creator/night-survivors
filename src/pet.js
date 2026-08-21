// v4.4 · 宠物系统核心类
//
// 职责：
//   1) 弹性跟随玩家（飘身后方，不重叠）
//   2) 帧动画（follow/pickup/attack 三组帧，按状态切换）
//   3) 攻击状态机（橘猫 urine 抛物线→落地水洼 applyDebuff；美短 butt 冲撞→hitEnemy）
//   4) 拾取辅助（作为第二磁吸源/拾取点，由 PickupSystem.update 调用）
import { PET_DEFS, getSelectedPet, CONFIG } from './data.js';
import { sprite, hasImage } from './assets.js';

const STATE = { FOLLOW: 'follow', PICKUP: 'pickup', ATTACK: 'attack' };
const GRAVITY = 900;          // 尿液抛物线重力 px/s²
const PET_DRAW = 40;          // 宠物世界绘制尺寸(px)
const PUDDLE_TICK = 0.3;      // 水洼每 0.3s 刷新一次 debuff
const PUDDLE_R = 42;          // 尿液水洼半径

// 不规则尿渍：生成一圈随机半径顶点（落地时一次性生成，避免逐帧抖动）
function makeBlobVerts(n) {
  const verts = [];
  for (let i = 0; i < n; i += 1) {
    verts.push({ ang: (i / n) * Math.PI * 2, rad: 0.62 + Math.random() * 0.42 });
  }
  return verts;
}
// 卫星小滴：主斑周围几滴飞溅
function makeDrops(m) {
  const drops = [];
  for (let i = 0; i < m; i += 1) {
    const ang = Math.random() * Math.PI * 2;
    const dist = PUDDLE_R * (0.6 + Math.random() * 0.6);
    drops.push({
      dx: Math.cos(ang) * dist,
      dy: Math.sin(ang) * dist * 0.62,
      r: 4 + Math.random() * 6,
    });
  }
  return drops;
}
// 任务② 跟随算法：贴身跟随血裔为主，仅拾取/攻击时短暂偏离
const FOLLOW_LEASH = 240;     // 宠物偏离血裔的最大距离(px)
const ENGAGE_RANGE = 180;     // 触发拾取/攻击的目标需在血裔此范围内
const ACTION_CD = 2.0;        // 拾取/攻击共用 CD(秒)，避免频繁远离血裔

export class Pet {
  constructor(def, game) {
    this.def = def;          // PET_DEFS[orange|amer]
    this.game = game;
    this.x = 0;
    this.y = 0;
    // 跟随参数
    this.offsetAngle = -Math.PI * 0.35; // 飘在玩家左后方 ~63°
    this.offsetDist = 46;               // 距离玩家中心
    this.smoothX = 0;
    this.smoothY = 0;
    // 帧动画
    this.state = STATE.FOLLOW;
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.frameRate = 4;       // follow 两帧循环 ~0.5s 一轮
    this.attackFrameRate = 8;
    this._attackStartTime = 0;
    // 攻击冷却
    this.attackCdTimer = 0;
    // 拾取/攻击共用行为 CD（任务②：避免频繁远离血裔）
    this.actionCdTimer = 0;
    // 拾取状态
    this.pickupTimer = 0;
    // 帧图片 key（绘制时由 sprite() 解析）
    this.frameKeys = {};      // { follow:[k,k], pickup:[...], attack:[...] }
    this._loadFrames();
  }

  _loadFrames() {
    const frames = this.def.frames;
    for (const [state, names] of Object.entries(frames)) {
      this.frameKeys[state] = names.slice();
    }
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.smoothX = x;
    this.smoothY = y;
    this.state = STATE.FOLLOW;
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.attackCdTimer = 0;
    this.pickupTimer = 0;
    this._attackStartTime = 0;
  }

  // 就近找一个「可拾取的宝石」（chest/potion/经验宝石均可）
  _findNearestGem(maxR) {
    const gems = this.game.pickups?.gems; // 修复①：pickupSystem→pickups（game.js 实例名是 this.pickups）
    if (!gems || !gems.length) return null;
    const p = this.game.player;
    const maxR2 = maxR * maxR;
    let best = null, bestD2 = Infinity;
    for (const g of gems) {
      const dx = g.x - p.x, dy = g.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < maxR2 && d2 < bestD2) { bestD2 = d2; best = g; }
    }
    return best;
  }

  _hasNearbyGem() {
    return this._findNearestGem(this.def.magnetRadius) != null;
  }

  update(dt) {
    const p = this.game.player;
    // 行为 CD（拾取/攻击共用，避免频繁远离血裔）
    if (this.actionCdTimer > 0) this.actionCdTimer -= dt;

    // ---- 感知：血裔附近是否有可拾取宝石 / 可攻击敌人 ----
    const gem = this.actionCdTimer <= 0 ? this._findNearestGem(ENGAGE_RANGE) : null;
    const enemy = this.actionCdTimer <= 0 ? this._findNearestEnemy(ENGAGE_RANGE) : null;

    // ---- 决定期望位置：默认贴身跟随血裔；仅在有目标且 CD 就绪时短暂偏离 ----
    const anchor = this._followAnchor(p); // 贴身锚点（血裔身后）
    let desiredX = anchor.x, desiredY = anchor.y, desiredState = STATE.FOLLOW;

    if (this.state === STATE.ATTACK && enemy) {
      desiredX = enemy.x; desiredY = enemy.y; desiredState = STATE.ATTACK;
    } else if (this.state === STATE.PICKUP && gem) {
      desiredX = gem.x; desiredY = gem.y; desiredState = STATE.PICKUP;
    } else if (enemy) {
      desiredX = enemy.x; desiredY = enemy.y; desiredState = STATE.ATTACK;
    } else if (gem) {
      desiredX = gem.x; desiredY = gem.y; desiredState = STATE.PICKUP;
    }

    // 偏离血裔距离钳制：永远不超出 FOLLOW_LEASH，保证「不远离血裔」
    {
      const dx = desiredX - p.x, dy = desiredY - p.y;
      const d = Math.hypot(dx, dy);
      if (d > FOLLOW_LEASH) {
        desiredX = p.x + (dx / d) * FOLLOW_LEASH;
        desiredY = p.y + (dy / d) * FOLLOW_LEASH;
      }
    }

    // ---- 弹性趋近期望位置 ----
    const lerp = 1 - Math.pow(0.02, dt); // ~每秒追 98% 距离
    this.smoothX += (desiredX - this.smoothX) * lerp;
    this.smoothY += (desiredY - this.smoothY) * lerp;

    // 钳制宠物不超出屏幕可视范围（按相机视口，留边距）
    const cam = this.game.camera;
    if (cam) {
      const M = 28;
      this.smoothX = Math.max(cam.x + M, Math.min(cam.x + CONFIG.LOGICAL_WIDTH - M, this.smoothX));
      this.smoothY = Math.max(cam.y + M, Math.min(cam.y + CONFIG.LOGICAL_HEIGHT - M, this.smoothY));
    }
    this.x = this.smoothX;
    this.y = this.smoothY;

    // ---- 状态机 ----
    this.state = desiredState;

    // 触发攻击（CD 就绪、且确有敌人目标）
    // 尿液是远程抛物线喷射、头撞是冲撞结算，二者都只需敌人落在血裔 ENGAGE_RANGE 内即可发动，
    // 不再要求宠物贴到敌人 70px（FOLLOW_LEASH 钳制下几乎不可达，会导致攻击永不触发）。
    if (this.state === STATE.ATTACK && enemy && this.actionCdTimer <= 0) {
      if (this._tryAttack(enemy)) {
        this.actionCdTimer = ACTION_CD; // 拾取/攻击共用 CD
      }
    }
    // 触发拾取（到达宝石附近、CD 就绪）
    if (this.state === STATE.PICKUP && gem && this.actionCdTimer <= 0) {
      const dx = gem.x - this.x, dy = gem.y - this.y;
      if (dx * dx + dy * dy < this.def.pickupRadius * this.def.pickupRadius) {
        this.actionCdTimer = ACTION_CD;
      }
    }

    // ---- 帧推进 ----
    const rate = this.state === STATE.ATTACK ? this.attackFrameRate : this.frameRate;
    this.frameTimer += dt;
    if (this.frameTimer >= 1 / rate) {
      this.frameTimer -= 1 / rate;
      const frames = this.frameKeys[this.state] || this.frameKeys.follow;
      this.frameIndex = (this.frameIndex + 1) % (frames.length || 1);
    }
  }

  // 贴身跟随锚点：血裔身后偏一侧，用 facing(±1) 决定左右
  _followAnchor(p) {
    const side = p.facing != null ? -p.facing : 1; // 跟在血裔背后
    return {
      x: p.x + side * this.offsetDist,
      y: p.y + this.offsetDist * 0.5,
    };
  }

  _findNearestEnemy(maxR) {
    const enemyList = this.game.enemies?.enemies;
    if (!enemyList || !enemyList.length) return null;
    const p = this.game.player;
    const maxR2 = maxR * maxR;
    let best = null, bestD2 = Infinity;
    for (const e of enemyList) {
      if (e.hp <= 0) continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < maxR2 && d2 < bestD2) { bestD2 = d2; best = e; }
    }
    return best;
  }

  _tryAttack(target) {
    // target 由 update() 通过 _findNearestEnemy 锁定（血裔 ENGAGE_RANGE 内最近敌人）
    if (!target || target.hp <= 0) return false;
    if (this.def.attackType === 'urine') this._fireUrine(target);
    else if (this.def.attackType === 'butt') this._fireButt(target);
    return true;
  }

  _fireUrine(target) {
    // 抛物线尿液：推入 PetSystem 自管飞溅弹道，落地生成减速+灼烧水洼
    const dx = target.x - this.x, dy = target.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const flight = Math.max(0.3, Math.min(0.7, dist / 220));
    const vx = dx / flight;
    // 解抛物线：y(t)=y0+vy*t+0.5*g*t²，令 t=flight 时 y≈target.y
    const vy = (dy - 0.5 * GRAVITY * flight * flight) / flight;
    const burnDps = this.def.baseDps * (this.game.player?.damageMul || 1) * this._statScale();
    // 从猫的侧前方「喷」出（朝血裔朝向偏移），更显侧身射击姿态
    const f = this.game.player?.facing || 1;
    this.game.pets.spawnUrineShot(this.x + f * 10, this.y - 8, vx, vy, flight, burnDps, this.def.slowPct, this.def.hazardDuration);
  }

  _fireButt(target) {
    // 冲撞：直接调现有 hitEnemy 结算伤害 + 击退
    const dmg = this.def.baseDamage * (this.game.player?.damageMul || 1) * this._statScale();
    const ang = Math.atan2(target.y - this.y, target.x - this.x);
    const ratio = (this.def.knockback || 0) / 220; // 归一化击退方向(≤1)
    const kx = Math.cos(ang) * ratio;
    const ky = Math.sin(ang) * ratio;
    this.game.weapons?.hitEnemy(target, dmg, kx, ky, '#fff');
    if (this.game.fx) this.game.fx.spawnSparks(target.x, target.y, '#fff', 5);
  }

  _statScale() {
    const t = this.game.time || 0;
    if (t < 540) return 1;
    const D = (t - 540) / 60;
    return 1 + D * 0.03; // 轻微成长，保持「一部分」贡献
  }

  draw(ctx, cam) {
    const frames = this.frameKeys[this.state] || this.frameKeys.follow;
    const key = frames?.[this.frameIndex];
    if (!key || !hasImage(key)) return;
    const img = sprite(key);
    if (!img) return;
    const flip = (this.game.player?.vx || 0) < 0 ? -1 : 1;
    const w = PET_DRAW, h = PET_DRAW * img.height / img.width;
    // 世界坐标 → 屏幕坐标（与其他实体一致：x - cam.ox / y - cam.oy）
    const sx = this.x - (cam?.ox || 0);
    const sy = this.y - (cam?.oy || 0);
    ctx.save();
    ctx.translate(sx, sy);
    // 暗底可见性：柔和浅色背光，避免深色猫（如黑美短）融入黑夜背景
    const br = w * 0.72;
    const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, br);
    bg.addColorStop(0, 'rgba(196,188,224,0.22)');
    bg.addColorStop(1, 'rgba(196,188,224,0)');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(0, 0, br, 0, Math.PI * 2);
    ctx.fill();
    if (flip < 0) ctx.scale(-1, 1);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  // ---- 拾取接口（PickupSystem 调用）----
  getMagnetPos() { return { x: this.x, y: this.y }; }
  getPickupRadius() { return this.def.pickupRadius; }
}

// ---------- PetSystem（管理单只出战宠物 + 尿液飞溅/水洼）----------
export class PetSystem {
  constructor(game) {
    this.game = game;
    this.pet = null;
    this.activeDefId = null;
    this.shots = [];    // 飞行中的尿液弹道 {x,y,vx,vy,life,burnDps,slowPct,dur}
    this.puddles = [];  // 落地尿液水洼 {x,y,life,maxLife,burnDps,slowPct,tick}
  }

  reset() {
    this.shots.length = 0;
    this.puddles.length = 0;
    const selectedId = getSelectedPet() || null;
    if (!selectedId || !PET_DEFS[selectedId]) {
      this.pet = null;
      this.activeDefId = null;
      return;
    }
    this.pet = new Pet(PET_DEFS[selectedId], this.game);
    this.activeDefId = selectedId;
    if (this.game.player) this.pet.reset(this.game.player.x, this.game.player.y);
  }

  spawnUrineShot(x, y, vx, vy, life, burnDps, slowPct, dur) {
    this.shots.push({ x, y, vx, vy, life, burnDps, slowPct, dur, trail: [] });
  }

  update(dt) {
    if (this.pet) this.pet.update(dt);
    this._updateShots(dt);
    this._updatePuddles(dt);
    // 调试探针：便于真机排查当前出战宠物与尿液生成情况（仅写入全局，无性能/逻辑影响）
    if (typeof window !== 'undefined') {
      window.__petDebug = {
        active: this.activeDefId,
        shots: this.shots.length,
        puddles: this.puddles.length,
        cd: this.pet ? +this.pet.actionCdTimer.toFixed(1) : null,
      };
    }
  }

  _updateShots(dt) {
    for (let i = this.shots.length - 1; i >= 0; i -= 1) {
      const s = this.shots[i];
      s.vy += GRAVITY * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      // 记录轨迹（用于绘制抛物线拖尾）
      s.trail.push({ x: s.x, y: s.y });
      if (s.trail.length > 16) s.trail.shift();
      if (s.life <= 0) {
        this.puddles.push({
          x: s.x, y: s.y, life: s.dur, maxLife: s.dur,
          burnDps: s.burnDps, slowPct: s.slowPct, tick: 0,
          verts: makeBlobVerts(12), drops: makeDrops(3 + Math.floor(Math.random() * 3)),
        });
        this.shots.splice(i, 1);
      }
    }
  }

  _updatePuddles(dt) {
    const enemyList = this.game.enemies?.enemies;
    for (let i = this.puddles.length - 1; i >= 0; i -= 1) {
      const hz = this.puddles[i];
      hz.life -= dt;
      if (hz.life <= 0) { this.puddles.splice(i, 1); continue; }
      hz.tick += dt;
      if (hz.tick < PUDDLE_TICK) continue;
      hz.tick -= PUDDLE_TICK;
      if (!enemyList) continue;
      const r2 = PUDDLE_R * PUDDLE_R;
      for (const e of enemyList) {
        if (e.hp <= 0) continue;
        const dx = e.x - hz.x, dy = e.y - hz.y;
        if (dx * dx + dy * dy > r2) continue;
        this.game.enemies.applyDebuff(e, { type: 'slow', value: hz.slowPct, duration: 0.4 });
        this.game.enemies.applyDebuff(e, { type: 'burn', value: hz.burnDps, duration: 0.4 });
      }
    }
  }

  // 猫本体（保持在暗角渐变之前绘制——猫通常贴着血裔在屏幕中部，几乎不被压暗）
  drawPet(ctx, cam) {
    if (this.pet) this.pet.draw(ctx, cam);
  }

  // 尿液危害层（飞溅抛物线 + 落地不规则尿渍），放在暗角渐变之后绘制，保证始终清晰可见
  drawHazards(ctx, cam) {
    const ox = cam?.ox || 0;
    const oy = cam?.oy || 0;
    // —— 落地不规则黄色尿渍（地面层）——
    for (const hz of this.puddles) {
      const a = 0.62 * Math.max(0.25, hz.life / hz.maxLife);
      this._drawPuddle(ctx, hz.x - ox, hz.y - oy, hz, a);
    }
    // —— 飞行尿液抛物线（带拖尾 + 发光弹体）——
    for (const s of this.shots) {
      // 抛物线拖尾
      for (let i = 1; i < s.trail.length; i += 1) {
        const t = i / s.trail.length;
        const p0 = s.trail[i - 1], p1 = s.trail[i];
        ctx.save();
        ctx.globalAlpha = t * 0.55;
        ctx.strokeStyle = '#ffe066';
        ctx.lineWidth = 3.2 * t;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p0.x - ox, p0.y - oy);
        ctx.lineTo(p1.x - ox, p1.y - oy);
        ctx.stroke();
        ctx.restore();
      }
      // 发光弹体
      ctx.save();
      const g = ctx.createRadialGradient(s.x - ox, s.y - oy, 0, s.x - ox, s.y - oy, 12);
      g.addColorStop(0, 'rgba(255,238,130,0.95)');
      g.addColorStop(1, 'rgba(240,200,40,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x - ox, s.y - oy, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f4dc4a';
      ctx.beginPath();
      ctx.arc(s.x - ox, s.y - oy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // 不规则尿渍：主斑(随机顶点压扁成地贴) + 暗边 + 湿润高光 + 卫星小滴
  _drawPuddle(ctx, cx, cy, hz, alpha) {
    ctx.save();
    ctx.translate(cx, cy);
    // 主斑
    this._blobPath(ctx, hz.verts, PUDDLE_R);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#e8c21e';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(150,110,10,0.75)';
    ctx.stroke();
    // 湿润高光
    ctx.globalAlpha = alpha * 0.5;
    this._blobPath(ctx, hz.verts, PUDDLE_R * 0.55);
    ctx.fillStyle = 'rgba(255,242,150,0.85)';
    ctx.fill();
    // 卫星小滴
    ctx.globalAlpha = alpha * 0.85;
    ctx.fillStyle = '#e8c21e';
    for (const d of hz.drops) {
      ctx.beginPath();
      ctx.ellipse(d.dx, d.dy, d.r, d.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _blobPath(ctx, verts, baseR) {
    ctx.beginPath();
    for (let i = 0; i < verts.length; i += 1) {
      const v = verts[i];
      const x = Math.cos(v.ang) * v.rad * baseR;
      const y = Math.sin(v.ang) * v.rad * baseR * 0.62; // 压扁，呈地面泼洒感
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
}
