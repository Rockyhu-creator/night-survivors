import { sprite } from './assets.js';
import { ENEMY_TYPES } from './data.js';

const GEM_DEFS = [
  { key: 'gemSmall', min: 1, size: 16, color: '#2ecc71' },
  { key: 'gemMedium', min: 3, size: 20, color: '#4aa3df' },
  { key: 'gemLarge', min: 10, size: 26, color: '#8e44ad' },
  { key: 'gemGold', min: 25, size: 30, color: '#d4af37' }, // 金宝石：精英/石像鬼掉落
  { key: 'gemRed', min: 50, size: 34, color: '#e74c3c' },   // 红宝石：暗影猎手/终局召唤
];

// 宝石实体数量上限（L4）：后期怪潮下 drop 可能无限堆积，接近上限时把剩余经验合并成单颗宝石，
// 既限制数组规模防掉帧，又不丢失经验值。
const MAX_GEMS = 500;

export class PickupSystem {
  constructor(game) {
    this.game = game;
    this.gems = [];
  }

  reset() { this.gems.length = 0; }

  drop(x, y, expValue, enemyType) {
    // 石像鬼/暗影猎手强制掉落高价值宝石（其余怪维持原 expValue 选档逻辑，零改动）
    if (enemyType === ENEMY_TYPES.gargoyle) {
      const def = GEM_DEFS[3]; // gemGold 金宝石
      this.gems.push({ x: x + (Math.random() * 2 - 1) * 14, y: y + (Math.random() * 2 - 1) * 14, value: def.min, def, magnet: false, vx: 0, vy: 0, bob: Math.random() * Math.PI * 2, life: 20, birth: 0.35 });
      return;
    }
    if (enemyType === ENEMY_TYPES.shadow_hunter) {
      const def = GEM_DEFS[4]; // gemRed 红宝石
      this.gems.push({ x: x + (Math.random() * 2 - 1) * 14, y: y + (Math.random() * 2 - 1) * 14, value: def.min, def, magnet: false, vx: 0, vy: 0, bob: Math.random() * Math.PI * 2, life: 20, birth: 0.35 });
      return;
    }
    // D3 裁决：精英击杀保底掉 1 颗 gemGold(GEM_DEFS[3].min=25)，并从 exp 扣除 → 净经验不通胀
    // （杜绝「精英经验随名义 exp 收缩」；普通怪走下方分级逻辑不受影响）。
    if (enemyType && enemyType.isElite) {
      const def = GEM_DEFS[3]; // gemGold 金宝石
      this.gems.push({ x: x + (Math.random() * 2 - 1) * 14, y: y + (Math.random() * 2 - 1) * 14, value: def.min, def, magnet: false, vx: 0, vy: 0, bob: Math.random() * Math.PI * 2, life: 20, birth: 0.35 });
      expValue -= def.min; // 扣 25，下方 let rest = expValue 自动继承
    }
    let rest = expValue;
    while (rest > 0) {
      // 接近上限：把剩余经验合并成一颗红宝石，避免数组无限增长（经验不丢）
      if (this.gems.length >= MAX_GEMS) {
        this.gems.push({
          x: x + (Math.random() * 2 - 1) * 14,
          y: y + (Math.random() * 2 - 1) * 14,
          value: rest,
          def: GEM_DEFS[4],
          magnet: false,
          vx: 0, vy: 0,
          bob: Math.random() * Math.PI * 2,
          life: 20,
        });
        return;
      }
      let def = GEM_DEFS[0];
      if (rest >= 50) def = GEM_DEFS[4];        // 红宝石
      else if (rest >= 25) def = GEM_DEFS[3];   // 金宝石
      else if (rest >= 10) def = GEM_DEFS[2];   // 紫宝石
      else if (rest >= 3) def = GEM_DEFS[1];    // 蓝宝石
      this.gems.push({
        x: x + (Math.random() * 2 - 1) * 14,
        y: y + (Math.random() * 2 - 1) * 14,
        value: def.min,
        def,
        magnet: false,
        vx: 0, vy: 0,
        bob: Math.random() * Math.PI * 2,
        life: 20, // 普通经验宝石 20s 未被拾取则过期消失，防止后期大量堆积掉帧
        birth: 0.35, // 出生闪光：让玩家在爆炸/怪潮中注意到新掉落
      });
      rest -= def.min;
    }
  }

  dropChest(x, y) {
    this.gems.push({
      chest: true,
      x, y,
      value: 0,
      def: { key: 'chest', min: 0, size: 34, color: '#d4af37' },
      magnet: false, vx: 0, vy: 0, bob: 0,
    });
  }

  // 血瓶：击杀续航掉落，拾取回血（heal=20，占 maxHp 10~20%）
  dropPotion(x, y, heal = 20) {
    this.gems.push({
      potion: true,
      x, y,
      value: 0,
      heal,
      def: { key: 'potion', min: 0, size: 22, color: '#ff5a6e' },
      magnet: false, vx: 0, vy: 0, bob: Math.random() * Math.PI * 2,
    });
  }

  dropBossChest(x, y) {
    this.gems.push({
      chest: true, boss: true,
      x, y,
      value: 0,
      def: { key: 'chest', min: 0, size: 40, color: '#d4af37' },
      magnet: false, vx: 0, vy: 0, bob: 0,
    });
  }

  update(dt) {
    const player = this.game.player;
    const magnetR = player.magnetRange;
    const magnetR2 = magnetR * magnetR;
    // v4.4 宠物第二拾取源
    const pet = this.game.pets?.pet;
    const petPos = pet ? { x: pet.x, y: pet.y, r: pet.def?.pickupRadius || 30, magR: pet.def?.magnetRadius || 80 } : null;

    for (let i = this.gems.length - 1; i >= 0; i -= 1) {
      const g = this.gems[i];
      g.bob += dt * 4;
      if (g.birth !== undefined && g.birth > 0) {
        g.birth -= dt;
        if (g.birth < 0) g.birth = 0;
      }
      // 过期：仅普通经验宝石（chest/potion 永不消失）；磁吸飞行中的宝石不过期，避免吸到一半消失
      if (g.life !== undefined && !g.magnet) {
        g.life -= dt;
        if (g.life <= 0) {
          this.gems.splice(i, 1);
          continue;
        }
      }
      const dx = player.x - g.x;
      const dy = player.y - g.y;
      const d2 = dx * dx + dy * dy; // 平方距离，避免每颗每帧 hypot

      // v4.4 磁吸目标：玩家 vs 宠物，取更近者
      let magTargetX = player.x, magTargetY = player.y, isPetMag = false;
      if (petPos) {
        const dxPet = petPos.x - g.x, dyPet = petPos.y - g.y;
        const d2Pet = dxPet * dxPet + dyPet * dyPet;
        if (d2Pet < petPos.magR * petPos.magR && d2Pet < d2) {
          magTargetX = petPos.x; magTargetY = petPos.y; isPetMag = true;
        }
      }
      if (d2 < magnetR2 || isPetMag) g.magnet = true;
      if (g.magnet) {
        const dxT = magTargetX - g.x, dyT = magTargetY - g.y;
        const d2T = dxT * dxT + dyT * dyT;
        const d = Math.sqrt(d2T);
        const speed = Math.min(560, 260 + (magnetR * 2 - Math.min(d, magnetR * 2)));
        g.vx = (dxT / (d || 1)) * speed;
        g.vy = (dyT / (d || 1)) * speed;
        g.x += g.vx * dt;
        g.y += g.vy * dt;
      }

      // v4.4 拾取判定：玩家半径 vs 宠物拾取半径
      const pickR = player.radius + (g.chest ? 18 : 8);
      let collected = false, cx = player.x, cy = player.y;
      if (d2 < pickR * pickR) { collected = true; }
      else if (petPos) {
        const dxP = petPos.x - g.x, dyP = petPos.y - g.y;
        if (dxP * dxP + dyP * dyP < petPos.r * petPos.r) { collected = true; cx = petPos.x; cy = petPos.y; }
      }

      if (collected) {
        if (g.chest) {
          this.game.onChestOpened(g);
          this.gems.splice(i, 1);
          continue;
        }
        if (g.potion) {
          const healed = Math.round(Math.min(player.maxHp, player.hp + g.heal) - player.hp);
          player.hp = Math.min(player.maxHp, player.hp + g.heal);
          this.game.audio.pickup();
          this.game.fx.spawnSparks(cx, cy, '#ff6b81', 7);
          if (healed > 0) this.game.fx.spawnDamageNumber(cx, cy - 18, `+${healed}`, '#7dff9a');
          this.gems.splice(i, 1);
          continue;
        }
        this.game.gainExp(g.value);
        this.game.audio.pickup();
        this.game.fx.spawnSparks(cx, cy, g.def.color, 3);
        this.gems.splice(i, 1);
      }
    }
  }

  render(ctx, cam) {
    for (const g of this.gems) {
      // 即将过期的普通宝石：最后 5s 闪烁提示玩家去捡
      if (g.life !== undefined && g.life < 5 && !g.magnet) {
        if (Math.sin(g.bob * 6) > 0.2) continue; // 高频闪烁（约一半帧跳过绘制）
      }
      const sx = g.x - cam.ox;
      const sy = g.y - cam.oy + Math.sin(g.bob) * 2.5;
      const img = sprite(g.def.key);
      const pulse = 1 + Math.sin(g.bob * 1.4) * 0.12;
      const size = (g.chest ? (g.boss ? 48 : 40) : g.def.size) * pulse;
      ctx.save();
      if (g.chest) {
        if (g.boss) {
          ctx.fillStyle = 'rgba(212,175,55,0.35)';
          ctx.beginPath();
          ctx.ellipse(sx, sy + 12, 22, 9, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = 'rgba(212,175,55,0.25)';
          ctx.beginPath();
          ctx.ellipse(sx, sy + 10, 18, 7, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      /* 辉光：用 lighter 合成模式替代 shadowBlur。
         shadowBlur 是 Canvas2D 开销最大的属性(O(N²)级模糊)，每帧按宝石数重复执行。
         lighter(加法合成)近乎零开销，在暗色背景下同样产生辉光效果。 */
      ctx.globalCompositeOperation = 'lighter';
      if (img) {
        ctx.globalAlpha = g.chest ? (g.boss ? 0.38 : 0.28) : 0.18;
        const gl = size * 1.25;
        ctx.drawImage(img, sx - gl / 2, sy - gl / 2, gl, gl);
      } else {
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = g.def.color;
        ctx.beginPath();
        ctx.arc(sx, sy, size / 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      // 正常绘制
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      if (img) ctx.drawImage(img, sx - size / 2, sy - size / 2, size, size);
      else {
        ctx.fillStyle = g.def.color;
        ctx.beginPath();
        ctx.arc(sx, sy, size / 3, 0, Math.PI * 2);
        ctx.fill();
      }
      // 出生闪光：新掉落的宝石在 0.35s 内显现金色收缩环，避免被爆炸/怪潮淹没
      if (g.birth !== undefined && g.birth > 0) {
        const k = g.birth / 0.35;
        const br = size * (1.6 + k * 1.4);
        ctx.save();
        ctx.globalAlpha = k * 0.55;
        ctx.strokeStyle = '#fff4d6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, br / 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }
  }
}

export class FXSystem {
  constructor() {
    this.numbers = [];
    this.particles = [];
    this.rings = []; // 爆破冲击波环（扩张描边圆）
    this._frameN = 0; // L2: 每帧伤害数字计数（update 中重置）
    this._frameP = 0; // L2: 每帧粒子计数
  }

  reset() {
    this.numbers.length = 0;
    this.particles.length = 0;
    this.rings.length = 0;
    this._frameN = 0;
    this._frameP = 0;
  }

  spawnDamageNumber(x, y, amount, color = '#fff', isCrit = false) {
    // L2: 每帧至多 14 个伤害数字，避免 AoE 密集命中时刷屏与数组抖动
    if (this._frameN >= 14) return;
    this._frameN += 1;
    if (this.numbers.length > 120) this.numbers.shift();
    this.numbers.push({
      x: x + (Math.random() * 2 - 1) * 8,
      y,
      text: String(amount),
      color,
      isCrit,
      life: isCrit ? 0.95 : 0.7,
      vy: isCrit ? -72 : -55,
    });
  }

  // v4.0 P3b-5b：侧/背命中全额伤害时的教学飘字（青色强调，引导绕背输出）。
  // 仅命中「带正面装甲且朝向已设定」的敌人侧/背时触发，避免对无装甲目标刷屏。
  spawnWeakFloat(x, y, amount) {
    if (this._frameN >= 14) return;
    this._frameN += 1;
    if (this.numbers.length > 120) this.numbers.shift();
    this.numbers.push({
      x: x + (Math.random() * 2 - 1) * 8,
      y,
      text: String(amount),
      color: '#5ef0ff',
      isCrit: true,
      weak: true,
      life: 0.95,
      vy: -72,
    });
  }

  spawnSparks(x, y, color, count) {
    // L2: 每帧至多 40 个粒子，配合下方硬上限避免单帧爆量
    count = Math.min(count, 40 - this._frameP);
    if (count <= 0) return;
    this._frameP += count;
    for (let i = 0; i < count; i += 1) {
      if (this.particles.length > 300) this.particles.shift();
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 90;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.6,
        color,
        size: 1.5 + Math.random() * 2,
      });
    }
  }

  // 爆破死亡特效：亮黄色范围冲击波环 + 半透明填充 + 火花，避免与红宝石视觉混淆
  spawnExplosion(x, y, radius, color = '#ffcc00') {
    if (this.rings.length > 40) this.rings.shift();
    this.rings.push({
      x, y,
      r: radius * 0.2,
      rMax: radius,
      life: 0.45,
      maxLife: 0.45,
      color,
      fillColor: 'rgba(255, 190, 0, 0.18)',
      dash: [5, 5],
    });
    this.spawnSparks(x, y, '#ffcc00', 18);
    this.spawnSparks(x, y, '#ff7a33', 12);
    this.spawnSparks(x, y, '#fff4d6', 8);
  }

  update(dt) {
    this._frameN = 0; // L2: 新的一帧，重置特效节流计数
    this._frameP = 0;
    for (let i = this.numbers.length - 1; i >= 0; i -= 1) {
      const n = this.numbers[i];
      n.life -= dt;
      n.y += n.vy * dt;
      n.vy *= Math.pow(0.02, dt);
      if (n.life <= 0) this.numbers.splice(i, 1);
    }
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i -= 1) {
      const r = this.rings[i];
      r.life -= dt;
      const k = 1 - Math.max(0, r.life) / r.maxLife; // 0→1 扩张进度
      r.r = r.rMax * (0.2 + 0.8 * k);
      if (r.life <= 0) this.rings.splice(i, 1);
    }
  }

  render(ctx, cam) {
    for (const r of this.rings) {
      ctx.save();
      const alpha = Math.max(0, r.life / r.maxLife) * 0.8;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = r.color;
      ctx.fillStyle = r.fillColor;
      ctx.lineWidth = 2.5;
      if (r.dash) ctx.setLineDash(r.dash);
      ctx.beginPath();
      ctx.arc(r.x - cam.ox, r.y - cam.oy, r.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - cam.ox - p.size / 2, p.y - cam.oy - p.size / 2, p.size, p.size);
      ctx.restore();
    }
    ctx.save();
    ctx.font = 'bold 13px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    for (const n of this.numbers) {
      ctx.globalAlpha = Math.min(1, n.life * 3);
      const label = n.weak ? `背 ${n.text}` : (n.isCrit ? `暴击 ${n.text}` : n.text);
      ctx.font = n.isCrit ? 'bold 17px "Press Start 2P", monospace' : 'bold 13px "Press Start 2P", monospace';
      ctx.fillStyle = '#000';
      ctx.fillText(label, n.x - cam.ox + 1, n.y - cam.oy + 1);
      ctx.fillStyle = n.color;
      ctx.fillText(label, n.x - cam.ox, n.y - cam.oy);
    }
    ctx.restore();
  }
}
