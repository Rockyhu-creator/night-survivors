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

  update(dt) {
    const p = this.game.player;
    // ---- 弹性跟随（玩家后方偏移）----
    const ang = p.facing != null ? p.facing : this.offsetAngle;
    const targetX = p.x + Math.cos(ang) * this.offsetDist;
    const targetY = p.y + Math.sin(ang) * this.offsetDist;
    const lerp = 1 - Math.pow(0.02, dt); // ~每秒追 98% 距离
    this.smoothX += (targetX - this.smoothX) * lerp;
    this.smoothY += (targetY - this.smoothY) * lerp;

    // 任务①：钳制宠物不超出屏幕可视范围（按相机视口，留边距）
    const cam = this.game.camera;
    if (cam) {
      const M = 28; // 距屏幕边缘边距(px)
      const minX = cam.x + M;
      const maxX = cam.x + CONFIG.LOGICAL_WIDTH - M;
      const minY = cam.y + M;
      const maxY = cam.y + CONFIG.LOGICAL_HEIGHT - M;
      this.smoothX = Math.max(minX, Math.min(maxX, this.smoothX));
      this.smoothY = Math.max(minY, Math.min(maxY, this.smoothY));
    }
    this.x = this.smoothX;
    this.y = this.smoothY;

    // ---- 状态机 ----
    const nearGem = this._hasNearbyGem();
    if (nearGem && this.state !== STATE.ATTACK) {
      this.state = STATE.PICKUP;
      this.pickupTimer = 0.5;
    }
    if (this.state === STATE.PICKUP) {
      this.pickupTimer -= dt;
      if (this.pickupTimer <= 0) this.state = STATE.FOLLOW;
    }

    if (this.attackCdTimer > 0) this.attackCdTimer -= dt;

    if (this.attackCdTimer <= 0 && this._tryAttack()) {
      this.state = STATE.ATTACK;
      this.attackCdTimer = this.def.attackCd;
      this._attackStartTime = this.game.time;
    }

    if (this.state === STATE.ATTACK) {
      const attackFrames = this.frameKeys.attack?.length || 2;
      const attackDur = attackFrames / this.attackFrameRate;
      if ((this.game.time - this._attackStartTime) >= attackDur) {
        this.state = STATE.FOLLOW;
        this._attackStartTime = 0;
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

  _hasNearbyGem() {
    const gems = this.game.pickupSystem?.gems;
    if (!gems || !gems.length) return false;
    const r2 = this.def.magnetRadius * this.def.magnetRadius;
    for (const g of gems) {
      const dx = g.x - this.x, dy = g.y - this.y;
      if (dx * dx + dy * dy < r2) return true;
    }
    return false;
  }

  _tryAttack() {
    const enemyList = this.game.enemies?.enemies;
    if (!enemyList || !enemyList.length) return false;
    let nearest = null, nearD2 = Infinity;
    for (const e of enemyList) {
      if (!e.alive) continue;
      const dx = e.x - this.x, dy = e.y - this.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < nearD2) { nearD2 = d2; nearest = e; }
    }
    if (!nearest || nearD2 > 180 * 180) return false; // 攻击范围 180px
    if (this.def.attackType === 'urine') this._fireUrine(nearest);
    else if (this.def.attackType === 'butt') this._fireButt(nearest);
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
    this.game.pets.spawnUrineShot(this.x, this.y, vx, vy, flight, burnDps, this.def.slowPct, this.def.hazardDuration);
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

  draw(ctx) {
    const frames = this.frameKeys[this.state] || this.frameKeys.follow;
    const key = frames?.[this.frameIndex];
    if (!key || !hasImage(key)) return;
    const img = sprite(key);
    if (!img) return;
    const flip = (this.game.player?.vx || 0) < 0 ? -1 : 1;
    const w = PET_DRAW, h = PET_DRAW * img.height / img.width;
    ctx.save();
    ctx.translate(this.x, this.y);
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
    this.shots.push({ x, y, vx, vy, life, burnDps, slowPct, dur });
  }

  update(dt) {
    if (this.pet) this.pet.update(dt);
    this._updateShots(dt);
    this._updatePuddles(dt);
  }

  _updateShots(dt) {
    for (let i = this.shots.length - 1; i >= 0; i -= 1) {
      const s = this.shots[i];
      s.vy += GRAVITY * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0) {
        this.puddles.push({
          x: s.x, y: s.y, life: s.dur, maxLife: s.dur,
          burnDps: s.burnDps, slowPct: s.slowPct, tick: 0,
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
        if (!e.alive) continue;
        const dx = e.x - hz.x, dy = e.y - hz.y;
        if (dx * dx + dy * dy > r2) continue;
        this.game.enemies.applyDebuff(e, { type: 'slow', value: hz.slowPct, duration: 0.4 });
        this.game.enemies.applyDebuff(e, { type: 'burn', value: hz.burnDps, duration: 0.4 });
      }
    }
  }

  draw(ctx) {
    // 先画水洼与飞溅（地面层），再画宠物（贴身层）
    for (const hz of this.puddles) {
      const a = 0.30 * Math.max(0.2, hz.life / hz.maxLife);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#e6c230';
      ctx.beginPath();
      ctx.ellipse(hz.x, hz.y, PUDDLE_R, PUDDLE_R * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const s of this.shots) {
      ctx.save();
      ctx.fillStyle = '#e6c230';
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (this.pet) this.pet.draw(ctx);
  }
}
