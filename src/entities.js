import { CONFIG, ENEMY_TYPES, BOSSES, NIGHT_START, ENDGAME_BOSS_TIME, AFFIXES, CRIT_CHANCE_BASE, CRIT_MUL_BASE, CRIT_CHANCE_CAP, DODGE_CAP, SHIELD_REGEN_DELAY, SHIELD_REGEN_BASE, DAMAGE_MIN, TL_BOSS_HP_K, TL_BOSS_HP_CAP, TL_HP_AMP_CAP, TL_DMG_AMP_CAP, TL_SPAWN_MUL_CAP } from './data.js';
import { sprite, drawAffixBadge } from './assets.js';

// 敌方弹幕数量硬上限：Boss 弹幕(三波错峰)极端情况下可能刷爆，超限时丢弃最旧弹幕，防卡顿/崩溃
const MAX_ENEMY_PROJECTILES = 400;
// 回收环半径（世界单位，设备无关）：敌人游离超过此距离则传送回玩家前方，避免白走。
// 固定值取代原 CONFIG.LOGICAL_WIDTH*1.6，使手机竖屏与桌面横屏回收行为一致。
const RECYCLE_RADIUS = 900;
// 亡魂收割者（reaper）·收割回能初值 [PLACEHOLDER 待真机校准]：
// 被 scythe/rend 击杀且持有 reaper 神器时，给玩家回收的 HP 量。
const REND_HARVEST_HP = 4;
// 精英类型集合（isElite 数据层判定）；精英刷新器(P3b-2)消费 eliteWeight 加权选种
const ELITE_TYPES = Object.values(ENEMY_TYPES).filter((e) => e.isElite);
// 最早精英解锁时间：刷新器门控起点（t >= 此值才开始刷精英）
const ELITE_START_AT = ELITE_TYPES.length ? Math.min(...ELITE_TYPES.map((e) => e.unlockAt)) : Infinity;

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
    // 技能树 v1 武器机制修饰（默认空对象 = 行为逐字节不变）
    this.weaponMods = {};           // { axe:{count}, lightning:{chains}, holywater:{count}, starfall:{critChance,critMul} }
    this.lifestealToShield = false; // 吸血溢出转护盾（bly_blood_lifeshield 置 true）
    this.level = 1;
    this.exp = 0;
    this.weapons = [];
    this.innateWeapons = []; // 槽外固有武器（如双生武装/圣徒授予的圣水洗礼）：不占武器槽、仍可升级/进化
    this.passives = new Map();
    // S3 槽位上限（基础上限，startRun 时由祭坛解锁 +1）
    this.maxWeapons = CONFIG.MAX_WEAPONS;
    this.maxPassives = CONFIG.MAX_PASSIVES;
    this.iframes = 0;
    this.slowTimer = 0;               // 减速 debuff 剩余时长（秒）；0 = 无减速（P3-0c）
    this.slowMul = 1;                 // 减速乘区（<1 变慢）；到期复位为 1 防陈旧残留
    this.facing = 1;
    this.walkTime = 0;
    this.moving = false;
  }

  get speed() { return this.baseSpeed * this.speedMul * (this.slowTimer > 0 ? this.slowMul : 1); }
  get magnetRange() { return this.baseMagnet * this.magnetMul; }

  // 暴击结算：返回 { damage, isCrit }。所有「对敌伤害」必须先经此函数（含 DOT 每 tick）。
  // 暴击结算：返回 { damage, isCrit }。所有「对敌伤害」必须先经此函数（含 DOT 每 tick）。
  // bonusChance/bonusMul 为逐武器暴击加成（技能树 war_starfall_crit 注入），默认 0 = 行为不变。
  rollCrit(baseDamage, bonusChance = 0, bonusMul = 0) {
    const cc = Math.min(CRIT_CHANCE_CAP, this.critChance + bonusChance);
    const cm = this.critMul + bonusMul;
    const isCrit = Math.random() < cc;
    return { damage: isCrit ? baseDamage * cm : baseDamage, isCrit };
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
    if (this.slowTimer > 0) { this.slowTimer -= dt; if (this.slowTimer <= 0) this.slowMul = 1; }  // P3-0c：减速计时递减+到期复位，口径与敌人侧 L594 一致
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

  // 持续伤害通道（毒池/灼烧等 DOT）。与 takeDamage() 减免链路逐项一致，但 deliberate 不碰 iframes/闪避/thorns/震动：
  //  · 不读/不写 iframes —— 否则站在毒池里持续刷新无敌帧，「危险区」反而变「安全区」（审计 R5 必踩坑）
  //  · 不触发闪避（DOT 不该被 dodge roll 拦）
  //  · 无 source 参数 → 不触发 thorns 反伤
  //  · 不调 navigator.vibrate（每 tick 震一次会吵死）
  // 调用约定：调用方按 **0.5s tick** 调用，**禁止逐帧调用**——
  //   armor 每次结算固定减一次，逐帧会把减伤放大 ~60×，高甲免毒、低甲瞬秒；0.5s 与 iframes 时长对齐，口径统一。
  // 返回实际扣血量（护盾吸收后），便于调用方做伤害数字 FX。
  takeDamageOverTime(amount) {
    const nightDR = (this.game && this.game.time >= NIGHT_START) ? (1 - (this.nightDmgReduction || 0)) : 1;
    let dmg = Math.max(DAMAGE_MIN, (amount - this.armor)) * (this.damageTakenMul || 1) * (this.absolutionDR || 1) * nightDR;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, dmg);
      this.shield -= absorbed;
      dmg -= absorbed;
    }
    this.hp -= dmg;
    this.lastHitTime = this.game ? this.game.time : 0;  // 持续打断回盾计时（设计意图）
    if (dmg > 0 && this.game) this.game.tookDamage = true;
    return dmg;  // 实际扣血量（护盾吸收后）
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
    // v4.0 P3a-S 地面危害池（毒径 / 减速网 / 伤害光环共用的公共通道）。
    // 条目形状：{ x, y, radius, life, dps, slowMul, slowDur, color, tickTimer }
    //   life     剩余存活秒数，<=0 移除
    //   dps      每秒伤害（按 0.5s tick 结算，每 tick 扣 dps*0.5）
    //   slowMul  减速乘区（<1 生效；=1 表示不减速）
    //   slowDur  单次 tick 施加给玩家的减速持续秒数
    //   tickTimer 结算累加器，满 0.5s 结一次（见 update() 末尾循环的硬约束注释）
    this.hazards = [];
    // v4.0 P2 Boss 串行化：同一时刻仅一只 Boss。当前 Boss 存活时到点的下一只入队，
    // 待其死亡后延迟 15s（bossReleasableAt）再释放队首。
    this.pendingBosses = [];
    this.bossReleasableAt = 0;
  }

  reset() {
    this.enemies.length = 0;
    this.spawnTimer = 0.5;
    this.eliteTimer = 0; // P3b-2：归零→首个精英在其 unlockAt(150s) 即登场（原 180 因 decrement 仅在门控内致首刷拖到 ~330s）
    this.bossSpawned = new Set();
    this.activeBoss = null;
    this.enemyProjectiles = [];
    this.hazards = [];
    this.pendingBosses = [];
    this.bossReleasableAt = 0;
  }

  // v4.0 P1：TL 缩放后的有效刷怪倍率（spawnMul 越大 → interval 越小 → 刷得越密）。
  // 绝对上限 TL_SPAWN_MUL_CAP 防止 interval 塌到地板（interval 自身还有 0.22s 下限 + ENEMY_CAP 兜底）。
  effSpawnMul() {
    const diff = this.game.difficulty;
    const tl = this.game.threatLevel || 0;
    if (tl <= 0) return diff.spawnMul;
    return Math.min(TL_SPAWN_MUL_CAP, diff.spawnMul * (1 + (diff.tlSpawnK || 0) * tl));
  }

  statScale(isBoss = false) {
    const t = this.game.time;
    const diff = this.game.difficulty;
    const speed = 1 + Math.min(0.5, (t / 60) * 0.06);
    // 永夜加深（9 分钟后指数增长）：敌人 HP/伤害 = 线性 × nightBase^D × (1 + 神器数×artifactCounter×D)
    // 速度不乘永夜指数，避免后期怪变成不可风筝的子弹
    // 非 Boss（小怪/精英）永夜伤害指数减半（D/2），避免后期指数秒杀；Boss 保持全额威慑
    const D = Math.max(0, (t - NIGHT_START) / 60);
    const exp = isBoss ? D : D / 2;
    const artifacts = this.game.player.weapons.filter((w) => w.artifact).length;
    const artifactMult = 1 + diff.artifactCounter * artifacts * D;
    // ---- 基线（TL=0）：与 v3.14 完全同构，仅难度常量按 §1.3 再平衡 ----
    const baseNight = Math.pow(diff.nightBase, exp) * artifactMult;
    const baseHp = (1 + (t / 60) * diff.hpSlope) * baseNight;
    const baseDamage = (1 + (t / 60) * diff.dmgSlope) * baseNight;
    // v4.0 P1 威胁等级 TL（design §1.2 候选 B）：只缩放已有的三条斜率 + 永夜底数，不新增乘区。
    // TL=0 走短路分支 → 与基线逐位等价，未投入技能树的新手零感知。
    const tl = this.game.threatLevel || 0;
    if (tl <= 0) return { hp: baseHp, speed, damage: baseDamage };
    const hpSlopeEff = diff.hpSlope * (1 + (diff.tlHpK || 0) * tl);
    const dmgSlopeEff = diff.dmgSlope * (1 + (diff.tlDmgK || 0) * tl);
    const nightBaseEff = diff.nightBase + (diff.tlNightK || 0) * tl;
    const tlNight = Math.pow(nightBaseEff, exp) * artifactMult;
    const tlHp = (1 + (t / 60) * hpSlopeEff) * tlNight;
    const tlDamage = (1 + (t / 60) * dmgSlopeEff) * tlNight;
    // 硬上限（§8.1 三重乘区爆炸缓解）：钳制「TL 相对同时刻基线的放大倍数」，而非绝对倍率。
    // 绝对上限(如 hp≤80×)会在 hard/t=900/6神器 的 TL=0 场景就误触发 → 改变既有玩法，故不采用。
    // baseHp/baseDamage 恒 ≥ 1×正数，不会除零。
    const ampHp = Math.min(TL_HP_AMP_CAP, tlHp / baseHp);
    const ampDamage = Math.min(TL_DMG_AMP_CAP, tlDamage / baseDamage);
    return { hp: baseHp * ampHp, speed, damage: baseDamage * ampDamage };
  }

  pickType() {
    const t = this.game.time;
    const late = t >= NIGHT_START;
    const w = (e) => (late ? (e.lateWeight ?? e.weight) : e.weight);
    const pool = Object.values(ENEMY_TYPES).filter((e) => e.weight > 0 && t >= e.unlockAt);
    const total = pool.reduce((s, e) => s + w(e), 0);
    let roll = Math.random() * total;
    for (const e of pool) {
      roll -= w(e);
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
    // v4.0 P3a-S 成簇生成：type.groupSize > 1 时在基准点附近小范围散开刷 N 只。
    // 缺省（无 groupSize / <=1）走原单只路径，行为逐位不变。
    // ENEMY_CAP 门控在循环条件里 —— 超上限就少生成，绝不排队（排队会在解除拥堵瞬间雪崩）。
    const group = type.groupSize | 0;
    if (group > 1) {
      for (let i = 0; i < group && this.enemies.length < CONFIG.ENEMY_CAP; i += 1) {
        const ox = (Math.random() * 2 - 1) * 28;
        const oy = (Math.random() * 2 - 1) * 28;
        this.enemies.push(this.createEnemy(type, scale, x + ox, y + oy, affix));
      }
      return;
    }
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

  // 随机词缀（非 pack，单怪属性型）。概率 = 0.26 × 难度 affixMul（v4.0 P2：0.20→0.26）
  // v4.0 P2：支持 minTime 分时段解锁 + affixBan 怪种互斥（design §5.3 / §5.4）
  rollSingleAffix(type) {
    const diff = this.game.difficulty;
    const t = this.game.time;
    if (Math.random() > 0.26 * diff.affixMul) return null;
    const ban = (type && type.affixBan) || [];
    const keys = Object.keys(AFFIXES).filter(
      (k) => k !== 'pack' && !ban.includes(k) && t >= (AFFIXES[k].minTime || 0),
    );
    if (keys.length === 0) return null;
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
    // 丙-2：Boss 血量吃威胁等级(TL)缩放，上限 +60%（TL=10 时满额）。TL=0 时 bossTl=1，逐位等价于原公式。
    const bossTl = Math.min(TL_BOSS_HP_CAP, 1 + TL_BOSS_HP_K * (this.game.threatLevel || 0));
    const boss = {
      type: def,
      x: cam.ox + w / 2 + Math.cos(angle) * dist,
      y: cam.oy + h / 2 + Math.sin(angle) * dist,
      hp: def.hp * this.game.difficulty.bossHpMul * bossTl,
      maxHp: def.hp * this.game.difficulty.bossHpMul * bossTl,
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

  // v4.0 P3a-S 环形弹幕：360° 均匀分布，供后续需要全向压制的单位使用。
  // 【为何不复用 _fireBarrageWave】上面那个是朝玩家的 ±40° 扇形（spread=40°），
  //   直接复用会得到错的形状。此处角度按 (i/count)*2π 均匀铺满整圈，与玩家位置无关。
  // offset 用于多波之间错开相位（默认 0），避免连发时弹丸完全重叠成一条线。
  // 弹丸对象结构与 _fireBarrageWave 完全一致，共用同一个 enemyProjectiles 池与上限保护。
  _fireRadialWave(e, count, speed, damage, offset = 0) {
    if (!(count > 0)) return;
    // 数量上限保护：超限先丢弃最旧弹幕（与 _fireBarrageWave 同款 oldest-first 回收）
    while (this.enemyProjectiles.length >= MAX_ENEMY_PROJECTILES) this.enemyProjectiles.shift();
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + offset;
      this.enemyProjectiles.push({
        x: e.x, y: e.y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        damage, life: 4, radius: 5,
      });
    }
  }

  // v4.0 P3a-S 地面危害区生成入口。统一在这里做上限回收，调用方不必各自处理。
  // 上限用 oldest-first 丢弃（与弹幕池同款），保证最新生成的危害区一定可见——
  // 若改成「满了就不生成」，玩家会看到怪死了却没留下毒池，观感像 bug。
  spawnHazard(x, y, radius, life, opts = {}) {
    while (this.hazards.length >= CONFIG.HAZARD_CAP) this.hazards.shift();
    this.hazards.push({
      x, y, radius, life,
      dps: opts.dps || 0,
      slowMul: opts.slowMul != null ? opts.slowMul : 1,
      slowDur: opts.slowDur || 0,
      color: opts.color || '#7dcea0',
      tickTimer: 0,
    });
  }

  // v4.0 P3a-S 通用死亡钩子分发。e.type.onDeath 形状：{ type: 'split'|'blast'|'hazard', ... }
  //   split : { count, enemyType?, speedMul? }  死亡分裂出小怪（缺省沿用死者自身类型）
  //   blast : { radius, damage, color? }        死亡爆炸（伤害玩家 + 冲击波特效）
  //   hazard: { radius, life, dps, slowMul, slowDur, color }  死亡留下地面危害区
  // 【本刀为休眠代码】没有任何 ENEMY_TYPES 条目声明 onDeath，行为逐位不变。
  _runOnDeath(e, player) {
    const od = e.type && e.type.onDeath;
    if (!od) return;
    if (od.type === 'split') {
      const type = od.enemyType ? ENEMY_TYPES[od.enemyType] : e.type;
      if (!type) return;
      const scale = this.statScale(false);
      const count = od.count | 0;
      // 【ENEMY_CAP 硬门控】现有 bossSummon()/词缀分裂都漏了这个检查（既有隐患），
      //   新代码不把坑扩大：超上限就少生成或不生成，绝不排队。
      for (let i = 0; i < count && this.enemies.length < CONFIG.ENEMY_CAP; i += 1) {
        const angle = (i / Math.max(1, count)) * Math.PI * 2 + Math.random() * 0.6;
        const dist = 24 + Math.random() * 12;
        this.enemies.push(this.createEnemy(
          type, scale, e.x + Math.cos(angle) * dist, e.y + Math.sin(angle) * dist,
        ));
      }
    } else if (od.type === 'blast') {
      const r = od.radius || 0;
      const bd = Math.hypot(player.x - e.x, player.y - e.y);
      if (bd < r && player.takeDamage(od.damage || 0)) this.game.onPlayerHit();
      // 特效无条件播放（与 volatile 词缀同口径：玩家在范围外也要看到爆炸）
      this.game.fx.spawnExplosion(e.x, e.y, r, od.color || '#ff7a33');
    } else if (od.type === 'hazard') {
      this.spawnHazard(e.x, e.y, od.radius || 0, od.life || 0, od);
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
        if (this.enemies[i].isBoss) {
          const e = this.enemies[i];
          // 甲-2：化身吞噬正在交战的 Boss，仅补经验（不补 Boss 宝箱），避免与正常击杀的双倍奖励
          this.game.pickups.drop(e.x, e.y, e.expValue, e.type);
          this.enemies.splice(i, 1);
        }
      }
      this.activeBoss = null;
      // v4.0 P2 Boss 串行化：化身登场即清空积压队列，避免旧 Boss 在终局后冒出
      this.pendingBosses.length = 0;
      this.bossReleasableAt = 0;
      const avatarDef = BOSSES.find((d) => d.id === 'avatar');
      this.activeBoss = this.spawnBoss(avatarDef);
      this.game.onBossSpawn?.(avatarDef);
    }
    // 终局已触发则不再生成其他 Boss（避免 time 跳变时早期 Boss 一次性全刷）
    if (!this.bossSpawned.has('avatar')) {
      // v4.0 P2 Boss 串行化：先释放排队的 Boss（当前无 Boss 且已过死亡后 15s 缓冲）
      if (this.pendingBosses.length > 0 && !this.activeBoss && t >= this.bossReleasableAt) {
        const def = this.pendingBosses.shift();
        this.activeBoss = this.spawnBoss(def);
        this.game.onBossSpawn?.(def);
      }
      // 检查新到点的 Boss：到点的若当前已有 Boss 存活则入队（pending），否则立即生成
      const N = BOSSES.length - 1; // 常规 Boss 数（不含终局化身）
      for (let i = 0; i < BOSSES.length; i += 1) {
        const def = BOSSES[i];
        if (def.id === 'avatar') continue; // 终局单独处理
        // 甲-1：钳制最后一波解锁时间，保证 easy（bossGapMul=1.5）下 overlord 在化身(720s)前可达。
        // 相邻波次至少间隔 45s，最末波不得晚于化身登场前 90s；normal/hard 因 unlockAt 本就更小而不触发钳制。
        const clamped = ENDGAME_BOSS_TIME - 90 - (N - 1 - i) * 45;
        const unlockAt = Math.min(Math.round(def.unlockAt * diff.bossGapMul), clamped);
        if (t >= unlockAt && !this.bossSpawned.has(def.id)) {
          this.bossSpawned.add(def.id); // 标记已处理，避免重复入队
          if (!this.activeBoss && t >= this.bossReleasableAt) {
            this.activeBoss = this.spawnBoss(def);
            this.game.onBossSpawn?.(def);
          } else {
            this.pendingBosses.push(def);
          }
        }
      }
    }
    // v4.0 P1：刷怪倍率走 effSpawnMul()（TL=0 时 === diff.spawnMul，行为不变）
    const interval = Math.max(0.22, 0.9 - t / 160) / this.effSpawnMul();
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer += interval;
      // Boss 存活时降低刷怪量，让玩家集中火力打 Boss
      const bossCalm = this.activeBoss ? diff.bossCalm : 1;
      if (this.enemies.length < CONFIG.ENEMY_CAP) {
        if (Math.random() < 0.20 * diff.affixMul) {
          this.spawnPack(this.pickType(), scale); // 狼群波次
        } else {
          const type = this.pickType();
          this.spawnAt(type, scale, this.rollSingleAffix(type));
        }
        const extra = t > 120 ? 2 : (t > 60 ? 1 : 0);
        const adjustedExtra = Math.round(extra * bossCalm);
        for (let i = 0; i < adjustedExtra && this.enemies.length < CONFIG.ENEMY_CAP; i += 1) {
          if (Math.random() < 0.20 * diff.affixMul) {
            this.spawnPack(this.pickType(), scale);
          } else {
            const type = this.pickType();
            this.spawnAt(type, scale, this.rollSingleAffix(type));
          }
        }
      }
    }
    // P3b-2：精英刷新规则（消费难度 eliteGapBase/eliteGapMin/maxAliveElites + 类型 eliteWeight）
    // 与原写死「每 90s 固定刷 elite」不同：① 按 eliteWeight 加权选已解锁类型 ② 间隔随进程从 base 线性降到 min ③ 受 maxAliveElites 上限约束
    if (t >= ELITE_START_AT) {
      this.eliteTimer -= dt;
      if (this.eliteTimer <= 0) {
        const aliveElites = this.enemies.reduce((n, e) => n + (e.type.isElite ? 1 : 0), 0);
        if (aliveElites < diff.maxAliveElites) {
          const pool = ELITE_TYPES.filter((e) => t >= e.unlockAt && e.eliteWeight > 0);
          if (pool.length > 0) {
            const total = pool.reduce((s, e) => s + e.eliteWeight, 0);
            let r = Math.random() * total;
            let chosen = pool[0];
            for (const e of pool) { r -= e.eliteWeight; if (r <= 0) { chosen = e; break; } }
            this.spawnAt(chosen, scale);
          }
        }
        // 间隔随进程从 eliteGapBase 线性降到 eliteGapMin（150s→720s），保证后期精英更密集
        const ramp = Math.max(0, Math.min(1, (t - ELITE_START_AT) / (ENDGAME_BOSS_TIME - ELITE_START_AT)));
        this.eliteTimer = Math.max(diff.eliteGapMin, diff.eliteGapBase - (diff.eliteGapBase - diff.eliteGapMin) * ramp);
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
      // 行为分发表（P0 抽象）：Boss 冲锋(dash 技能)独立于敌人类型行为，先拦截；
      // 其余敌人走 behaviors[e.type.id]，未注册则 defaultChase（同质寻路）。运行时行为逐字节等价。
      if (e.isBoss && e.dashing > 0) {
        e.x += e.dashVx * dt;
        e.y += e.dashVy * dt;
        e.dashing -= dt;
      } else {
        const beh = behaviors[e.type.id] || defaultChase;
        beh(e, dt, this, { dx, dy, dist });
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
        // v4.0 P3a-S 通用死亡钩子 onDeath（split / blast / hazard 三型）。
        // 【位置约束】必须留在这个反向索引循环【内部】—— 循环正对 this.enemies 做 splice，
        //   提到循环外处理会导致索引错乱。这里紧邻 volatile 分支，同属死亡清理块。
        // 本刀之后没有任何 ENEMY_TYPES 条目声明 onDeath，故这整段是休眠代码。
        this._runOnDeath(e, player);
        this.game.onEnemyKilled(e);
        if (e.isBoss) {
          if (this.activeBoss === e) this.activeBoss = null;
          // v4.0 P2 Boss 串行化：当前 Boss 死亡 → 15s 后释放排队的下一只要
          this.bossReleasableAt = this.game.time + 15;
          this.game.onBossKilled?.(e);
        } else if (e.type.isElite) {
          this.game.pickups.dropChest(e.x, e.y);
        }
        this.enemies.splice(i, 1);
        continue;
      }
      const far = Math.hypot(e.x - player.x, e.y - player.y);
      if (far > RECYCLE_RADIUS && !e.type.isElite && !e.isBoss) {
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

    // v4.0 P3a-S 地面危害池结算（毒径 / 减速网 / 伤害光环共用）
    // 【0.5s tick 是硬约束，禁止改成逐帧】takeDamageOverTime() 内部每次结算固定减一次 armor，
    //   逐帧调用会把减伤放大 ~60×：高护甲玩家完全免疫毒池、低护甲玩家瞬秒。
    //   0.5s 同时与 iframes 时长对齐，口径统一（见 Player.takeDamageOverTime 注释）。
    const HAZARD_TICK = 0.5;
    for (let i = this.hazards.length - 1; i >= 0; i -= 1) {
      const hz = this.hazards[i];
      hz.life -= dt;
      if (hz.life <= 0) { this.hazards.splice(i, 1); continue; }
      hz.tickTimer += dt;
      if (hz.tickTimer < HAZARD_TICK) continue;
      hz.tickTimer -= HAZARD_TICK;
      // 平方距离比较，省一次开方（与上面弹幕循环同款）
      const dxH = player.x - hz.x, dyH = player.y - hz.y;
      const touchR = hz.radius + player.radius;
      if (dxH * dxH + dyH * dyH > touchR * touchR) continue;
      if (hz.dps > 0) {
        const dealt = this.game.player.takeDamageOverTime(hz.dps * HAZARD_TICK);
        if (dealt > 0) this.game.fx.spawnDamageNumber(player.x, player.y - 20, `${Math.round(dealt)}`, hz.color);
      }
      if (hz.slowMul < 1) {
        // 取更强者 + 时长取较大者，与 applyDebuff('slow') 对敌人的口径一致
        player.slowMul = Math.min(player.slowMul != null ? player.slowMul : 1, hz.slowMul);
        player.slowTimer = Math.max(player.slowTimer || 0, hz.slowDur || 0);
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
      // v4.0 P3a-S：untargetable 单位（如后续的潜行态单位）不进自动索敌。
      // 放在循环第一行是为了顺带跳过 Math.hypot —— 本函数是 O(n) 全表扫描，
      // 每把自动瞄准武器每次开火都调一次，属热路径。
      if (e.untargetable) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  // v4.0 P3a-S 地面危害区渲染：半透明填充 + 描边。
  // 【禁用 canvas 阴影模糊】项目既有禁令（离屏模糊 pass 成本极高，审计 R1）。
  //   本文件对该属性保持零命中，护栏靠 grep 字面量巡检，故此处连注释都不写出那个属性名。
  // 绘制层级由 game.js 决定：贴花之上、拾取物之下（否则会盖住宝箱与经验宝石）。
  renderHazards(ctx, cam) {
    if (this.hazards.length === 0) return;
    ctx.save();
    for (const hz of this.hazards) {
      const sx = hz.x - cam.ox;
      const sy = hz.y - cam.oy;
      // 屏外剔除：margin 取自身半径，形式抄敌人渲染那行
      const m = hz.radius + 8;
      if (sx < -m || sy < -m || sx > CONFIG.LOGICAL_WIDTH + m || sy > CONFIG.LOGICAL_HEIGHT + m) continue;
      // 将熄时淡出，避免到期瞬间硬切（life<1s 起线性衰减）
      const fade = Math.min(1, Math.max(0, hz.life));
      ctx.globalAlpha = 0.22 * fade;
      ctx.fillStyle = hz.color;
      ctx.beginPath();
      ctx.arc(sx, sy, hz.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.55 * fade;
      ctx.strokeStyle = hz.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
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
        } else if (e.type.isElite || e.isBoss) {
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
      // v4.0 P2：放宽到任意带 affixDef 的词缀（含 5 个新词缀），统一走椭圆光环 + affixDef.color；
      // 仅 volatile 保留射线特例。对旧三词缀（pack/shielded/volatile）逐字节等价。
      const t = this.game.time;
      if (e.affix && e.affixDef) {
        const affixColor = e.affixDef.color || '#ffffff';
        const pulse = e.affix === 'volatile'
          ? 0.4 + 0.5 * (0.5 + 0.5 * Math.sin(t * Math.PI * 3))    // ~1.5Hz
          : (e.affix === 'pack'
            ? 0.18 + 0.18 * (0.5 + 0.5 * Math.sin(t * Math.PI * 1.2)) // 狼群：淡金慢闪
            : 0.25 + 0.25 * (0.5 + 0.5 * Math.sin(t * Math.PI * 1.6))); // 护盾/新词缀 ~0.8Hz
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
      // v4.0 P3：判定改读数据层 e.type.isElite；光环色参数化为 e.type.eliteColor
      //   —— elite_conduit 与 elite 共用同一张精灵图，光环色是玩家区分二者的唯一手段。
      //   `|| '#d4af37'` 兜底保证任何漏填 eliteColor 的类型行为不变。
      if (e.type.isElite) {
        const pulse = 0.2 + 0.2 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2));
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = e.type.eliteColor || '#d4af37';
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
      // 正面装甲扇区弧线 + 朝向箭头（P3a-4 / D1.4：屏幕坐标、避开 facing 镜像、零 PNG）。
      // 仅当敌人有 facing 且配置了 frontalArmor 才画；弧宽直接复用 arcCos（与判定同源，永不脱节）。
      const faArmor = (e.type && e.type.frontalArmor) || (e.affixDef && e.affixDef.frontalArmor);
      if (faArmor && typeof e.facingX === 'number' && typeof e.facingY === 'number') {
        const half = Math.acos(Math.min(1, Math.max(-1, faArmor.arcCos))) / 2; // 半角（arcCos=-0.5 → 60°）
        const baseAng = Math.atan2(e.facingY, e.facingX);
        ctx.save();
        ctx.translate(sx, sy);
        ctx.fillStyle = 'rgba(180,192,210,0.20)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, e.radius + 9, baseAng - half, baseAng + half);
        ctx.closePath();
        ctx.fill();
        const al = e.radius + 15; // 朝向箭头（楔形中心，强化盾面朝向）
        ctx.strokeStyle = 'rgba(214,224,240,0.92)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(baseAng) * al, Math.sin(baseAng) * al);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.save();  // 弹幕批量绘制：save/restore 提到循环外（逐颗 save 纯浪费）
    for (const p of this.enemyProjectiles) {
      const sx = p.x - cam.ox;
      const sy = p.y - cam.oy;
      if (sx < -16 || sy < -16 || sx > CONFIG.LOGICAL_WIDTH + 16 || sy > CONFIG.LOGICAL_HEIGHT + 16) continue;  // 屏外剔除（margin 16，弹丸半径远小于敌人）
      // 发光弹：双层 arc 替代辉光模糊（成本 ~1/20，保留辨识度，杜绝离屏模糊 pass，审计 R1）
      ctx.fillStyle = 'rgba(255,107,107,0.35)';
      ctx.beginPath();
      ctx.arc(sx, sy, p.radius * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.arc(sx, sy, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  damageEnemy(e, rawDamage, knockX = 0, knockY = 0) {
    // 护盾词缀：受到的伤害 ×dmgTakenMul（完整正背面减伤留 PLACEHOLDER，先用全时减伤）
    let dmg = rawDamage * (e.dmgTakenMul || 1);
    // v4.0 P3a-S 正面装甲（design rulings §1.6 统一规则）：
    //   「仅非零 knock 的【有方向直伤】受正面护甲；零向量 / 范围伤害 / DOT 一律全额。」
    //   这条规则让「AoE 与领域类武器天然无视正面护甲」自动成立，无需逐武器打补丁
    //   （12 个传 (0,0) 的调用点 + 3 条绕过 hitEnemy 的 DOT 全部自动全额）。
    // 【必须点积，禁止 atan2】本方法是超热路径（每次命中都调），三角函数开销不可接受。
    //   knockX/knockY 传入时已归一化，直接与朝向单位向量点积即可。
    //   dot < arcCos ⇒ 攻击来向与朝向夹角落在正面扇区内（如 arcCos=-0.5 ⇒ 正面 120°）。
    // 【两道守卫，缺一不可】
    //   ① 零向量：knock 全零时不做判定（否则 dot 恒 0，会把范围伤害误判进扇区）。
    //   ② 朝向缺失：e.facingX/facingY 目前【没有任何代码设置】（后续单元的事），
    //      undefined 参与运算得 NaN，而 NaN 比较恒 false 会静默吞掉伤害——故缺 facing 时也走全额。
    // ⚠️【休眠靠的是守卫②，不是"没有数据"】与直觉相反：frontalArmor 配置【今天就已存在】——
    //   P2 已给 ENEMY_TYPES.bone_knight 声明 { arcCos: -0.5, mul: 0.30 }，
    //   也给 AFFIXES.bulwark 声明 { arcCos: -0.34, mul: 0.25 }（二者被 affixBan 互斥，不会叠加）。
    //   所以本段是否生效【完全取决于 facing 是否存在】。后续单元一旦给敌人写 facingX/facingY，
    //   骸骨骑士与壁垒词缀怪会【当场获得正面减伤】——那是预期中的 P3 玩法，但必须显式申报，
    //   不能当成加 facing 的副作用悄悄发生。改动 facing 的单元请务必连带跑一次伤害基线。
    if (knockX !== 0 || knockY !== 0) {
      const fa = (e.type && e.type.frontalArmor) || (e.affixDef && e.affixDef.frontalArmor);
      if (fa && typeof e.facingX === 'number' && typeof e.facingY === 'number') {
        const dot = knockX * e.facingX + knockY * e.facingY;
        if (dot < fa.arcCos) dmg *= fa.mul;
      }
    }
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

// ── 敌人行为分发表（P0 抽象重构）────────────────────────────────────────────
// 设计：每个敌人类型的专属移动/行为抽到 behaviors[typeId](e, dt, mgr, ctx) 函数，
// 主循环通过 `behaviors[e.type.id] || defaultChase` 分发。新增敌人行为（P2/P3 的
// siren / void_stalker / blood_titan 等）只需调用 registerBehavior(typeId, fn)，
// 无需再改 update() 大循环。
//   ctx = { dx, dy, dist }：玩家相对方向（dist 已做 ||1 兜底），由主循环每敌算一次后传入，
//     避免每个行为重复开方，且保证与重构前 dx/dy/dist 计算时机逐字节一致。
//   mgr = EnemyManager 实例（行为内可访问网格/玩家等，留待后续系统行为使用）。
const behaviors = {
  // 未特例化类型：同质寻路（行为逐字节等价于重构前 update() 的 else 分支）
  bat: defaultChase,
  skeleton: defaultChase,
  slime: defaultChase,
  elite: defaultChase,
  gargoyle: defaultChase,
  // 暗影猎手：dashState 三态机，作为首个显式 behavior 模板
  shadow_hunter: shadowHunterBehavior,
  // 腐唾者：保持偏好距离 + 周期性朝玩家单发弹幕（P3a-1）
  spitter: spitterBehavior,
  // 哀嚎女妖：同质追击 + 周期性治疗友军（P3a-2）
  siren: sirenBehavior,
  // 疫病携带者：同质追击 + 周期性脚下留毒径（P3a-3）
  plague_bearer: plagueBehavior,
  // 骸骨骑士：同质寻路 + 限转向速率 facing 插值（P3a-4 / D1：绕后破甲教学怪）
  bone_knight: boneKnightBehavior,
  // 腐骸巨像：复用 bone_knight 的 facing+frontalArmor 机制（P3b-3① / D1·D2）——类型驱动，
  //   渲染 140° 弧线自动（entities.js:1104 读 e.type.frontalArmor），turnRate 0.6 取自数据层。
  elite_colossus: boneKnightBehavior,
};

// 默认行为：当前「未特例化」敌人的同质寻路（朝玩家移动 + 晕眩/减速/击退处理）。
// 等价于重构前 update() 主循环 else 分支；shadow_hunter 的 dashSpeed guard 对其余类型恒 false，
// 仅为与原始分支逐字节一致而保留。
function defaultChase(e, dt, mgr, ctx) {
  const { dx, dy, dist } = ctx;
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

// 暗影猎手：dashState 三态机（idle | charging | dashing），作为首个显式 behavior 模板。
// 与重构前 update() 的对应分支逐字节等价。
function shadowHunterBehavior(e, dt, mgr, ctx) {
  const { dx, dy, dist } = ctx;
  if (e.dashState === 'dashing') {
    e.x += e.dashVx * dt;
    e.y += e.dashVy * dt;
    e.dashTimer -= dt;
    if (e.dashTimer <= 0) e.dashState = 'idle';
  } else if (e.dashState === 'charging') {
    e.dashTimer -= dt;
    if (e.dashTimer <= 0) {
      e.dashState = 'dashing';
      e.dashTimer = 0.35;
      e.dashVx = (dx / dist) * e.speed * e.dashSpeed;
      e.dashVy = (dy / dist) * e.speed * e.dashSpeed;
    }
  } else {
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
}

// 注册入口：供后续内容切片（P2/P3）挂载行为，无需再改 update() 大循环。
export function registerBehavior(typeId, fn) {
  behaviors[typeId] = fn;
}

// 腐唾者（P3a-1）：保持偏好距离（太近后退、太远靠近）+ 周期性朝玩家单发弹幕。
// 吐弹复用 _fireBarrageWave(e, 1, ...) —— count=1 时 t=0 → 弹道正中玩家，无需另写瞄准。
// 首次吐弹延迟一个 spitCd（避免一出生就在屏外丢弹），之后每 spitCd 一发。
function spitterBehavior(e, dt, mgr, ctx) {
  const { dx, dy, dist } = ctx;
  const keep = e.type.keepDist || 200;
  const mvx = dist < keep ? -dx : dx; // 保持距离：<keep 后退，否则靠近
  const mvy = dist < keep ? -dy : dy;
  const mlen = Math.hypot(mvx, mvy) || 1;
  if (e.stunTimer > 0) {
    e.stunTimer -= dt;
    e.x += e.kx * dt; e.y += e.ky * dt;
  } else {
    const slowFactor = (e.slowTimer > 0) ? (e.slowMul || 1) : 1;
    e.x += (mvx / mlen) * e.speed * slowFactor * dt + e.kx * dt;
    e.y += (mvy / mlen) * e.speed * slowFactor * dt + e.ky * dt;
  }
  e.spitTimer = (e.spitTimer === undefined) ? (e.type.spitCd || 2.2) : e.spitTimer - dt;
  if (e.spitTimer <= 0) {
    e.spitTimer = e.type.spitCd || 2.2;
    mgr._fireBarrageWave(e, 1, e.type.spitSpeed || 175, e.type.spitDamage || 10, 0, 1);
  }
}

// 哀嚎女妖（P3a-2）：同质追击（与 defaultChase 等价）+ 周期性治疗范围内友军（不含自身）。
// 每次治疗最多 healMax 个目标，各回 healPct×maxHp；视觉用绿色飘字（与 reaper 回收回能同色系），零 PNG。
function sirenBehavior(e, dt, mgr, ctx) {
  const { dx, dy, dist } = ctx;
  if (e.stunTimer > 0) {
    e.stunTimer -= dt; e.x += e.kx * dt; e.y += e.ky * dt;
  } else {
    const slowFactor = (e.slowTimer > 0) ? (e.slowMul || 1) : 1;
    e.x += (dx / dist) * e.speed * slowFactor * dt + e.kx * dt;
    e.y += (dy / dist) * e.speed * slowFactor * dt + e.ky * dt;
  }
  e.healTimer = (e.healTimer === undefined) ? (e.type.healCd || 3) : e.healTimer - dt;
  if (e.healTimer <= 0) {
    e.healTimer = e.type.healCd || 3;
    const range = e.type.healRange || 160;
    const pct = e.type.healPct || 0.12;
    const max = e.type.healMax || 3;
    let healed = 0;
    for (const a of mgr.enemies) {
      if (a === e || a.hp >= a.maxHp) continue;
      if (Math.hypot(a.x - e.x, a.y - e.y) <= range) {
        const amt = a.maxHp * pct;
        a.hp = Math.min(a.maxHp, a.hp + amt);
        mgr.game.fx.spawnDamageNumber(a.x, a.y - 18, `+${Math.round(amt)}`, '#7dff9a');
        healed += 1;
        if (healed >= max) break;
      }
    }
  }
}

// 疫病携带者（P3a-3）：同质追击 + 周期性在脚下留毒径（hazards[] 池）。
// 死亡大池由 data.js onDeath.hazard 钩子（P3a-S _runOnDeath）生成，无需行为代码。
function plagueBehavior(e, dt, mgr, ctx) {
  const { dx, dy, dist } = ctx;
  if (e.stunTimer > 0) {
    e.stunTimer -= dt; e.x += e.kx * dt; e.y += e.ky * dt;
  } else {
    const slowFactor = (e.slowTimer > 0) ? (e.slowMul || 1) : 1;
    e.x += (dx / dist) * e.speed * slowFactor * dt + e.kx * dt;
    e.y += (dy / dist) * e.speed * slowFactor * dt + e.ky * dt;
  }
  e.trailTimer = (e.trailTimer === undefined) ? (e.type.trailCd || 0.6) : e.trailTimer - dt;
  if (e.trailTimer <= 0) {
    e.trailTimer = e.type.trailCd || 0.6;
    mgr.spawnHazard(e.x, e.y, e.type.trailRadius || 26, e.type.trailLife || 3, {
      dps: e.type.trailDps || 8, color: e.type.trailColor || '#7dcea0',
    });
  }
}

// 骸骨骑士（P3a-4 / D1·D2）：同质寻路（与 defaultChase 等价）＋ 限转向速率的 facing 插值。
// 不接 facing 时正面装甲靠「守卫②：facing 缺失」休眠；本 behavior 设置 facingX/facingY 后，
// bone_knight 的 frontalArmor 当场生效——这是预期的 P3 玩法，伤害基线已在 test_game.py 申报。
//   · 朝向量 = ctx(dx,dy)（敌人→玩家方向）；knock（玩家→敌人，damageEnemy 已归一化）与之反向。
//   · 正面命中 dot(knock,facing)<arcCos → ×mul 减伤；背面 dot>arcCos → 全额；零向量/AoE/DOT 全额。
//   · 转向限 turnRate（0.7 rad/s，[待真机校准]）：玩家贴身(d≤80px)2.5s 内可从正面绕到背面破甲，
//     拉远(d>243px)骑士完全跟上、背面窗口关闭——把「绕后」从数学不可能变成可教学操作。
//   注：AFFIXES.bulwark 的 frontalArmor 本版不激活（其宿主走 defaultChase 无 facing，且缺设计 turnRate，
//   贸然激活会重现 D1 陷阱）；保持与 P3a-4 前一致的休眠态，留待后续单元按 bulwark 专属 turnRate 接入。
function boneKnightBehavior(e, dt, mgr, ctx) {
  const { dx, dy, dist } = ctx;
  // 移动：与 defaultChase 逐字节等价（stun / slow / knockback 处理一致）
  if (e.stunTimer > 0) {
    e.stunTimer -= dt;
    e.x += e.kx * dt; e.y += e.ky * dt;
  } else {
    const slowFactor = (e.slowTimer > 0) ? (e.slowMul || 1) : 1;
    e.x += (dx / dist) * e.speed * slowFactor * dt + e.kx * dt;
    e.y += (dy / dist) * e.speed * slowFactor * dt + e.ky * dt;
  }
  // 限转向速率插值 facing（D1）：每帧最多转 turnRate*dt 弧度，首次出现直接对齐玩家方向
  const turnRate = e.type.turnRate || 0.7;
  const tx = dx / dist, ty = dy / dist; // 敌人→玩家单位向量（ctx 已归一化方向）
  if (typeof e.facingX !== 'number' || typeof e.facingY !== 'number') {
    e.facingX = tx; e.facingY = ty;
  } else {
    let diff = Math.atan2(ty, tx) - Math.atan2(e.facingY, e.facingX);
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    const step = Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
    const na = Math.atan2(e.facingY, e.facingX) + step;
    e.facingX = Math.cos(na); e.facingY = Math.sin(na);
  }
}
