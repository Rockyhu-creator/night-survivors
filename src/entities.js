import { CONFIG, ENEMY_TYPES, BOSSES, NIGHT_START, ENDGAME_BOSS_TIME, AFFIXES, CRIT_CHANCE_BASE, CRIT_MUL_BASE, CRIT_CHANCE_CAP, DODGE_CAP, SHIELD_REGEN_DELAY, SHIELD_REGEN_BASE, DAMAGE_MIN } from './data.js';
import { sprite, drawAffixBadge } from './assets.js';

// 敌方弹幕数量硬上限：Boss 弹幕(三波错峰)极端情况下可能刷爆，超限时丢弃最旧弹幕，防卡顿/崩溃
const MAX_ENEMY_PROJECTILES = 400;
// 回收环半径（世界单位，设备无关）：敌人游离超过此距离则传送回玩家前方，避免白走。
// 固定值取代原 CONFIG.LOGICAL_WIDTH*1.6，使手机竖屏与桌面横屏回收行为一致。
const RECYCLE_RADIUS = 900;
// 亡魂收割者（reaper）·收割回能初值 [PLACEHOLDER 待真机校准]：
// 被 scythe/rend 击杀且持有 reaper 神器时，给玩家回收的 HP 量。
const REND_HARVEST_HP = 4;

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
    // ===== S 档新属性（2026-07-26）=====
    this.critChance = CRIT_CHANCE_BASE;  // 暴击率（0~1，硬上限 CRIT_CHANCE_CAP）
    this.critMul = CRIT_MUL_BASE;        // 暴击伤害倍率（≥1）
    this.maxShield = 20;                 // 护盾上限（开局基础值，护盾被动可叠加）
    this.shield = 20;                    // 当前护盾（开局满盾）
    this.shieldRegen = 0;                // 护盾恢复速度（盾/秒）
    this.armor = 0;                      // 防御（固定减伤值）
    this.dodgeChance = 0;                // 闪避率（0~1，硬上限 DODGE_CAP，基础 0）
    this.lastHitTime = -999;             // 最后一次实际承伤的游戏时间（受击打断回盾用）
    // 技能树 v1 前置 · 三缺失机制引擎字段（默认零值 = 行为逐字节不变）
    this.thorns = 0;                // 反伤：受击时对来源敌人反弹等量伤害
    this.nightDmgReduction = 0;     // 永夜减伤：NIGHT_START 后受伤 ×(1 - val)
    this.statusAmp = 1;             // 状态增幅：对敌 debuff 强度 ×statusAmp
    this.level = 1;
    this.exp = 0;
    this.weapons = [];
    this.innateWeapons = []; // 槽外固有武器（如双生武装/圣徒授予的圣水洗礼）：不占武器槽、仍可升级/进化
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

  // 暴击结算：返回 { damage, isCrit }。所有「对敌伤害」必须先经此函数（含 DOT 每 tick）。
  rollCrit(baseDamage) {
    const isCrit = Math.random() < this.critChance;
    return { damage: isCrit ? baseDamage * this.critMul : baseDamage, isCrit };
  }

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
    // 护盾恢复：受击打断 SHIELD_REGEN_DELAY 秒后开始自然回盾（基础速率 + 被动加成，封顶 maxShield），死亡后不回
    if (this.maxShield > 0 && this.hp > 0) {
      const nowT = this.game ? this.game.time : 0;
      if (nowT - this.lastHitTime >= SHIELD_REGEN_DELAY) {
        const rate = SHIELD_REGEN_BASE + this.shieldRegen;
        if (rate > 0) this.shield = Math.min(this.maxShield, this.shield + rate * dt);
      }
    }
  }

  // 承伤四段（顺序固定）：闪避 → 防御 → 护盾 → 扣血。返回 true=实际承伤；false=未承伤（iframes 中或闪避）。
  // source=造成本次伤害的来源敌人（用于 thorns 反伤）；无来源时省略。
  takeDamage(amount, source) {
    if (this.iframes > 0) return false;
    // ① 闪避：概率完全免伤，但仍刷新 iframes 保持受击节奏
    if (Math.random() < this.dodgeChance) {
      this.iframes = 0.5;
      this.game?.fx?.spawnDamageNumber(this.x, this.y - 18, '闪避!', '#9fd8ff');
      return false;
    }
    // ② 防御：固定减伤后乘百分比乘区，保底 DAMAGE_MIN
    // 永夜减伤：NIGHT_START 后受伤额外 ×(1 - nightDmgReduction)；默认 0 → 不受影响（逐字节不变）
    const nightDR = (this.game && this.game.time >= NIGHT_START) ? (1 - (this.nightDmgReduction || 0)) : 1;
    let dmg = Math.max(DAMAGE_MIN, (amount - this.armor)) * (this.damageTakenMul || 1) * (this.absolutionDR || 1) * nightDR;
    // 反伤（thorns）：来源为敌人且 thorns>0 时反弹等量伤害（默认 0 不触发，逐字节不变）
    if (source && this.thorns > 0) {
      this.game?.weapons?.hitEnemy(source, this.thorns, 0, 0, '#ff6b6b');
    }
    // ③ 护盾吸收：先扣盾，扣完再扣血
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, dmg);
      this.shield -= absorbed;
      dmg -= absorbed;
    }
    // ④ 扣血 + 受击打断回盾计时
    this.hp -= dmg;
    if (dmg > 0 && this.game) this.game.tookDamage = true;
    this.lastHitTime = this.game ? this.game.time : 0;
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
      flashCd: 0,
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
      // 亡魂收割者·撕裂 DOT：scythe 命中(reaper 激活)时由 weapons.js 写入 { dps, time }；null=无
      rend: null,
      // 状态增幅 debuff（statusAmp）：burn=持续掉血；slow=减速。默认零值不生效
      burnTimer: 0,
      burnDps: 0,
      slowTimer: 0,
      slowMul: 1,
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
      hp: def.hp * this.game.difficulty.bossHpMul,
      maxHp: def.hp * this.game.difficulty.bossHpMul,
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
      rend: null,
      // 状态增幅 debuff（statusAmp）：burn/slow。Boss 同样可被 debuff
      burnTimer: 0,
      burnDps: 0,
      slowTimer: 0,
      slowMul: 1,
      isBoss: true,
      bossDef: def,
      // 技能运行时状态（门槛+冷却双条件）：每技能独立 {triggered, lastCast}
      skillRuntime: (def.skills || []).map(() => ({ triggered: false, lastCast: -999 })),
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
      this.bossBarrage(e, skill.barrageCount || skill.count, skill.speed, skill.damage, skill.waves || 1);
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

  bossBarrage(e, count, speed, damage, waves = 1) {
    // 三波时间错峰：第 1 波立刻从 Boss 当前位置射出，后续波存入 e.pendingWaves，
    // 由 update 每 0.35s 触发一波（从 Boss 当时位置射出，Boss 移动后波会跟随，压迫感递进）。
    const WAVE_INTERVAL = 0.35;
    this._fireBarrageWave(e, count, speed, damage, 0, waves); // 第 1 波立即
    for (let w = 1; w < waves; w += 1) {
      e.pendingWaves = e.pendingWaves || [];
      e.pendingWaves.push({ delay: w * WAVE_INTERVAL, count, speed, damage, wave: w, waves });
    }
  }

  _fireBarrageWave(e, count, speed, damage, wave, waves) {
    const player = this.game.player;
    const base = Math.atan2(player.y - e.y, player.x - e.x);
    const spread = (40 * Math.PI) / 180;
    const waveStep = (18 * Math.PI) / 180;
    const wbase = base + (wave - (waves - 1) / 2) * waveStep;
    // 数量上限保护：超限先丢弃最旧弹幕，腾出空间给本波，避免弹幕堆积卡顿
    while (this.enemyProjectiles.length >= MAX_ENEMY_PROJECTILES) this.enemyProjectiles.shift();
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
      const angle = wbase + t * spread;
      this.enemyProjectiles.push({
        x: e.x, y: e.y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        damage, life: 4, radius: 5,
      });
    }
  }

  update(dt) {
    const scale = this.statScale(false);
    const t = this.game.time;
    const diff = this.game.difficulty;
    // 终局 Boss：永夜化身（12 分钟降临，击杀=通关）。登场时清掉现有 Boss
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
        if (e.stunTimer > 0) {
          e.stunTimer -= dt;
          e.x += e.kx * dt;
          e.y += e.ky * dt;
        } else {
          const slowFactor = (e.slowTimer > 0) ? (e.slowMul || 1) : 1;
          e.x += (dx / dist) * e.speed * slowFactor * dt + e.kx * dt;
          e.y += (dy / dist) * e.speed * slowFactor * dt + e.ky * dt;
        }
      }
      if (e.isBoss) {
        const cdMul = this.game.difficulty.bossSkillCdMul || 1;
        for (let si = 0; si < e.bossDef.skills.length; si += 1) {
          const skill = e.bossDef.skills[si];
          const rt = e.skillRuntime[si];
          const ratio = e.hp / e.maxHp;
          // 阶段带：ratio ∈ (bandLo, skill.at]，bandLo = 比本技能 at 更小的下一档阈值
          let bandLo = 0;
          for (const o of e.bossDef.skills) if (o.at < skill.at) bandLo = Math.max(bandLo, o.at);
          const inBand = ratio <= skill.at && ratio > bandLo;
          if (!rt.triggered && inBand) {
            this.triggerBossSkill(e, skill);
            rt.triggered = true;
            rt.lastCast = t;
          } else if (rt.triggered && !skill.once && inBand
            && (t - rt.lastCast) >= (skill.cooldown || 999) * cdMul) {
            this.triggerBossSkill(e, skill);
            rt.lastCast = t;
          }
        }
      }
      const decay = Math.pow(0.0001, dt);
      e.kx *= decay;
      e.ky *= decay;
      e.flash = Math.max(0, e.flash - dt);
      e.flashCd = Math.max(0, (e.flashCd || 0) - dt);
      e.hitCooldown = Math.max(0, e.hitCooldown - dt);
      e.wobble += dt * 6;

      // 亡魂收割者·撕裂 DOT：scythe 命中(reaper 激活)写入 e.rend，每帧按 dps*dt 结算伤害并递减 time
      if (e.rend && e.rend.time > 0) {
        // rend 每 tick 独立 roll 暴击（DOT 定稿口径）；暴击飘字金色、非暴击沿用绿色
        const base = e.rend.dps * dt;
        const { damage: d, isCrit } = this.game.player.rollCrit(base);
        const finalD = d * (e.dmgTakenMul || 1);
        e.hp -= finalD;
        e.rend.time -= dt;
        e.rend._acc = (e.rend._acc || 0) + finalD;
        if (e.rend._acc >= 1) {
          this.game.fx.spawnDamageNumber(e.x, e.y - e.radius, Math.round(e.rend._acc), isCrit ? '#ffd24a' : '#7CFC00');
          e.rend._acc = 0;
        }
        if ((e.flashCd || 0) <= 0) { e.flash = 0.08; e.flashCd = 0.2; }
      }

      // 状态增幅 debuff 结算（statusAmp 框架）：burn=持续掉血；slow=减速。默认零值不生效
      if (e.burnTimer > 0) {
        const { damage: bd, isCrit } = this.game.player.rollCrit(e.burnDps * dt);
        e.hp -= bd * (e.dmgTakenMul || 1);
        e.burnTimer -= dt;
        if ((e.flashCd || 0) <= 0) { e.flash = 0.08; e.flashCd = 0.2; }
      }
      if (e.slowTimer > 0) {
        e.slowTimer -= dt;
        if (e.slowTimer <= 0) e.slowMul = 1;  // 到期复位，避免陈旧 slowMul 残留
      }

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
        if (player.takeDamage(touchDamage, e)) {
          this.game.onPlayerHit();
        }
        e.hitCooldown = 0.8;
      }
    }

    // Boss 延迟弹幕波：三波错峰，每 0.35s 从 Boss 当前位置射出一波
    for (const e of this.enemies) {
      if (!e.pendingWaves || e.pendingWaves.length === 0) continue;
      for (let i = e.pendingWaves.length - 1; i >= 0; i -= 1) {
        const pw = e.pendingWaves[i];
        pw.delay -= dt;
        if (pw.delay <= 0) {
          this._fireBarrageWave(e, pw.count, pw.speed, pw.damage, pw.wave, pw.waves);
          e.pendingWaves.splice(i, 1);
        }
      }
      if (e.pendingWaves.length === 0) e.pendingWaves = null;
    }

    // 清理死亡/超远
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const e = this.enemies[i];
      if (e.hp <= 0) {
        // 亡魂收割者·收割回能：被 scythe/rend 击杀且持有 reaper 神器时，回收少量生命。
        // e.rend.time>0 覆盖了两种致死来源：scythe 直击（命中的同帧已写入 rend）与 rend DOT 持续掉血致死。
        if (this.game.weapons.hasArtifact('reaper') && e.rend && e.rend.time > 0) {
          const player = this.game.player;
          const healed = Math.min(player.maxHp, player.hp + REND_HARVEST_HP) - player.hp;
          player.hp = Math.min(player.maxHp, player.hp + REND_HARVEST_HP);
          if (healed > 0) this.game.fx.spawnDamageNumber(player.x, player.y - 18, `+${Math.round(healed)}`, '#7dff9a');
        }
        // 爆破词缀：死亡时对附近玩家造成范围伤害
        if (e.affix === 'volatile') {
          const bd = Math.hypot(player.x - e.x, player.y - e.y);
          if (bd < AFFIXES.volatile.blastRadius) {
            if (player.takeDamage(AFFIXES.volatile.blastDamage)) this.game.onPlayerHit();
          }
          // 爆破死亡特效：范围冲击波 + 火花（无论玩家是否在范围内都播放）
          this.game.fx.spawnExplosion(e.x, e.y, AFFIXES.volatile.blastRadius, '#ff7a33');
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
      if (far > RECYCLE_RADIUS && e.type !== ENEMY_TYPES.elite && !e.isBoss) {
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
      // 平方距离比较：与 hypot 数学等价，一次计算供触碰与 800 外清理两用，消除每弹每帧开方
      const dxP = p.x - player.x, dyP = p.y - player.y;
      const d2 = dxP * dxP + dyP * dyP;
      const touchR = p.radius + player.radius;
      if (d2 < touchR * touchR) {
        if (player.takeDamage(p.damage, p.owner)) {
          this.game.onPlayerHit();
        }
        this.enemyProjectiles.splice(i, 1);
        continue;
      }
      if (p.life <= 0 || d2 > 800 * 800) {
        this.enemyProjectiles.splice(i, 1);
      }
    }
  }

  buildGrid() {
    // 复用持久 Map 与桶数组，避免每帧 new Map() + 大量小数组分配带来的 GC 压力（L5）
    const grid = this._gridMap || (this._gridMap = new Map());
    if (this._gridFree === undefined) this._gridFree = [];
    for (const arr of grid.values()) this._gridFree.push(arr);
    grid.clear();
    const cell = CONFIG.GRID_CELL;
    const free = this._gridFree;
    for (const e of this.enemies) {
      const gx = Math.floor(e.x / cell);
      const gy = Math.floor(e.y / cell);
      const key = `${gx},${gy}`;
      let bucket = grid.get(key);
      if (!bucket) {
        bucket = free.length ? free.pop() : [];
        bucket.length = 0;
        grid.set(key, bucket);
      }
      bucket.push(e);
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
    // 复用 scratch 数组原地排序：消除每帧 [...enemies] 全拷贝分配；
    // y 顺序帧间近似稳定，原生 sort 在近有序输入上接近 O(n)，绘制结果与全排序一致
    const sorted = this._renderScratch || (this._renderScratch = []);
    sorted.length = 0;
    for (const e of this.enemies) sorted.push(e);
    sorted.sort((a, b) => a.y - b.y);
    for (const e of sorted) {
      const sx = Math.round(e.x - cam.ox);
      const sy = Math.round(e.y - cam.oy);
      if (sx < -120 || sy < -120 || sx > CONFIG.LOGICAL_WIDTH + 120 || sy > CONFIG.LOGICAL_HEIGHT + 120) continue;
      let img = sprite(e.type.sprite);
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
      // 词缀 / 精英标识层（不换主体 sprite，仅渲染提示）
      const t = this.game.time;
      if (e.affix === 'volatile' || e.affix === 'shielded' || e.affix === 'pack') {
        const affixColor = (e.affixDef && e.affixDef.color)
          || (e.affix === 'volatile' ? '#e67e22' : (e.affix === 'pack' ? '#f1c40f' : '#3498db'));
        const pulse = e.affix === 'volatile'
          ? 0.4 + 0.5 * (0.5 + 0.5 * Math.sin(t * Math.PI * 3))    // ~1.5Hz
          : (e.affix === 'pack'
            ? 0.18 + 0.18 * (0.5 + 0.5 * Math.sin(t * Math.PI * 1.2)) // 狼群：淡金慢闪
            : 0.25 + 0.25 * (0.5 + 0.5 * Math.sin(t * Math.PI * 1.6))); // 护盾 ~0.8Hz
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(1, pulse + (e.flash > 0 ? 0.4 : 0));
        ctx.strokeStyle = affixColor;
        ctx.lineWidth = 2;
        const rr = e.radius * (e.affix === 'volatile' ? 1.2 : 1.35);
        if (e.affix === 'volatile') {
          for (let k = 0; k < 5; k += 1) {
            const ang = (k / 5) * Math.PI * 2 + t * 0.5;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
            ctx.stroke();
          }
          ctx.fillStyle = '#ffb866';
          ctx.beginPath();
          ctx.arc(0, 0, e.radius * 0.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.ellipse(0, 0, rr, rr * 0.95, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      // P2：精英脉动光环（高威胁信号，不重画主体）
      if (e.type === ENEMY_TYPES.elite) {
        const pulse = 0.2 + 0.2 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2));
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, e.radius * 1.15, e.radius * 1.15, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
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
      // 词缀头顶徽标（方案①：本体不染色，属性用光环+徽标表达）；屏幕坐标绘制避免被 facing/微动画变换拉伸
      if (e.affix === 'volatile' || e.affix === 'shielded' || e.affix === 'pack') {
        ctx.save();
        ctx.translate(sx, sy - (e.radius + 14));
        drawAffixBadge(ctx, e.affix, 0, 0, 1);
        ctx.restore();
      }
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
    // 白闪冷却门控：仅在冷却结束后才重新点亮，避免持续受击时白闪常驻满格把精灵糊成白色
    if ((e.flashCd || 0) <= 0) {
      e.flash = 0.12;
      e.flashCd = 0.14;
    }
    const kb = 90 * (1 - e.knockResist);
    e.kx += knockX * kb;
    e.ky += knockY * kb;
  }

  // 状态增幅 debuff 施加：强度按 player.statusAmp 放大（默认 1 → 不放大）。
  // type='slow'：降低敌人速度（slowMul 越低越慢，取更强者）；type='burn'：持续掉血（burnDps）。
  // 时长取较大者刷新；默认零值不生效。供武器命中时调用（如 aura 在 statusAmp>1 时施加 slow）。
  applyDebuff(e, opts) {
    if (!e) return;
    const amp = (this.game && this.game.player && this.game.player.statusAmp) || 1;
    if (opts.type === 'slow') {
      const v = (opts.value || 0) * amp;
      e.slowMul = Math.min(e.slowMul != null ? e.slowMul : 1, 1 - v);
      e.slowTimer = Math.max(e.slowTimer || 0, opts.duration || 0);
    } else if (opts.type === 'burn') {
      const v = (opts.value || 0) * amp;
      e.burnDps = Math.max(e.burnDps || 0, v);
      e.burnTimer = Math.max(e.burnTimer || 0, opts.duration || 0);
    }
  }
}
