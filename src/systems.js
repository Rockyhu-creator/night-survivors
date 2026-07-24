import { sprite } from './assets.js';

const GEM_DEFS = [
  { key: 'gemSmall', min: 1, size: 16, color: '#2ecc71' },
  { key: 'gemMedium', min: 3, size: 20, color: '#4aa3df' },
  { key: 'gemLarge', min: 10, size: 26, color: '#8e44ad' },
  { key: 'gemGold', min: 25, size: 30, color: '#d4af37' }, // 金宝石：精英/石像鬼掉落
  { key: 'gemRed', min: 50, size: 34, color: '#e74c3c' },   // 红宝石：暗影猎手/终局召唤
];

export class PickupSystem {
  constructor(game) {
    this.game = game;
    this.gems = [];
  }

  reset() { this.gems.length = 0; }

  drop(x, y, expValue) {
    let rest = expValue;
    while (rest > 0) {
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
    for (let i = this.gems.length - 1; i >= 0; i -= 1) {
      const g = this.gems[i];
      g.bob += dt * 4;
      const dx = player.x - g.x;
      const dy = player.y - g.y;
      const d = Math.hypot(dx, dy);
      if (d < magnetR) g.magnet = true;
      if (g.magnet) {
        const speed = Math.min(560, 260 + (magnetR * 2 - Math.min(d, magnetR * 2)));
        g.vx = (dx / (d || 1)) * speed;
        g.vy = (dy / (d || 1)) * speed;
        g.x += g.vx * dt;
        g.y += g.vy * dt;
      }
      if (d < player.radius + (g.chest ? 18 : 8)) {
        if (g.chest) {
          this.game.onChestOpened(g);
          this.gems.splice(i, 1);
          continue;
        }
        if (g.potion) {
          const healed = Math.round(Math.min(player.maxHp, player.hp + g.heal) - player.hp);
          player.hp = Math.min(player.maxHp, player.hp + g.heal);
          this.game.audio.pickup();
          this.game.fx.spawnSparks(player.x, player.y, '#ff6b81', 7);
          if (healed > 0) this.game.fx.spawnDamageNumber(player.x, player.y - 18, `+${healed}`, '#7dff9a');
          this.gems.splice(i, 1);
          continue;
        }
        this.game.gainExp(g.value);
        this.game.audio.pickup();
        this.game.fx.spawnSparks(player.x, player.y, g.def.color, 3);
        this.gems.splice(i, 1);
      }
    }
  }

  render(ctx, cam) {
    for (const g of this.gems) {
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
      ctx.restore();
    }
  }
}

export class FXSystem {
  constructor() {
    this.numbers = [];
    this.particles = [];
  }

  reset() {
    this.numbers.length = 0;
    this.particles.length = 0;
  }

  spawnDamageNumber(x, y, amount, color = '#fff') {
    if (this.numbers.length > 120) this.numbers.shift();
    this.numbers.push({
      x: x + (Math.random() * 2 - 1) * 8,
      y,
      text: String(amount),
      color,
      life: 0.7,
      vy: -55,
    });
  }

  spawnSparks(x, y, color, count) {
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

  update(dt) {
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
  }

  render(ctx, cam) {
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
      ctx.fillStyle = '#000';
      ctx.fillText(n.text, n.x - cam.ox + 1, n.y - cam.oy + 1);
      ctx.fillStyle = n.color;
      ctx.fillText(n.text, n.x - cam.ox, n.y - cam.oy);
    }
    ctx.restore();
  }
}
