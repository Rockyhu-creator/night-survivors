export const CONFIG = {
  LOGICAL_WIDTH: 960,
  LOGICAL_HEIGHT: 540,
  TILE: 256,
  PLAYER_RADIUS: 14,
  PLAYER_SPRITE: 51,  // v4.3.2: 血裔精灵渲染放大 ~10%（46→51），源分辨率同步 46→64 提清晰度
  ENEMY_CAP: 400,
  GRID_CELL: 64,
  BEST_KEY: 'night_survivors_best',
  // S3 槽位上限（基础上限，祭坛可 +1）
  MAX_WEAPONS: 6,
  MAX_PASSIVES: 6,
  // ===== v2.0 性能桶硬上限（RL2：所有生成桶 oldest-first 回收，禁无界增长）=====
  PROJECTILE_CAP: 600,   // 投射物（homing/split/frag/sanguine/sentinel_shot/orb_shot 等）
  POOL_CAP: 60,          // 圣水领域
  BOLT_CAP: 80,          // 闪电
  SLASH_CAP: 40,         // 长鞭横扫
  VIAL_CAP: 40,          // 圣水飞瓶
  MAX_SENTINELS: 6,      // 哨卫（aegis/bastion，≤ RL5 建议）
  MAX_ORBS: 8,           // 环绕法球（warden/sentinel，≤ RL5 建议）
  MAX_SHOCKWAVES: 12,    // 扩张波（maul/cataclysm，常态 1）
  MAX_RUNES: 24,         // 符文陷阱（resolve/absolution，对齐 thunderRunes=24）
  HAZARD_CAP: 40,        // v4.0 P3a-S 地面危害池（毒径/减速网/伤害光环共用；oldest-first 回收）
  SPLIT_CAP_PER_HIT: 6,  // 分裂弹单次命中迸射碎片封顶（防 pierce 高时爆桶）
  ORBIT_OMEGA: 1.2,      // 法球公转角速度（rad/s）[需真机校准]
};

// ---------- 灵魂货币（长期循环 / 元进度）----------
// 单局结算发放走 game.js computeSoulReward 公式（时间进度×500 + 等级 + 首通收敛），
// perX 字段为历史死代码（已不被引用），仅保留首通收敛奖励。
export const SOUL_REWARDS = {
  firstClear: { easy: 30, normal: 50, hard: 80 }, // 难度首通（仅一次，收敛防通胀）
};

// 祭坛解锁表：永久增益，花灵魂购买。apply(game) 在 startRun 注入。
// cost 已填，真机按投放速率与通胀阈值微调。
export const ALTAR = [
  { id: 'soul_hp',  name: '永恒之躯', icon: 'altar_hp',  cost: 60,  desc: '生命上限 +30（永久）',       apply: (g) => { g.player.maxHp += 30; } },
  { id: 'soul_spd', name: '疾风之拥', icon: 'altar_spd',    cost: 90,  desc: '移动速度 +6%（永久）',        apply: (g) => { g.player.speedMul += 0.06; } },
  { id: 'soul_dmg', name: '嗜血诅咒', icon: 'altar_dmg',     cost: 130, desc: '所有伤害 +5%（永久）',        apply: (g) => { g.player.damageMul += 0.05; } },
  { id: 'soul_gain',name: '亡魂低语', icon: 'altar_gain', cost: 160, desc: '灵魂获取 +25%（永久）',       apply: (g) => { g.soulGainMul *= 1.25; } },
  { id: 'soul_dual',name: '双生武装', icon: 'altar_dual', cost: 220, desc: '开局额外获得「圣水洗礼」（槽外固有·不占武器槽）',     apply: (g) => { g.weapons.addWeapon('holywater', 1, true); } },
  // S3 槽位上限扩容：花灵魂永久 +1 槽（上限 7），深化长期循环
  { id: 'soul_slot_weapon',  name: '扩容武器槽', icon: 'altar_slot_weapon',  cost: 150, desc: '武器槽 +1（永久，上限 7）',  apply: (g) => { g.player.maxWeapons += 1; } },
  { id: 'soul_slot_passive', name: '扩容被动槽', icon: 'altar_slot_passive', cost: 150, desc: '被动槽 +1（永久，上限 7）',  apply: (g) => { g.player.maxPassives += 1; } },
];
if (typeof window !== 'undefined') window.__altar = ALTAR;

// ---------- 宠物系统（v4.4） ----------
export const PET_DEFS = {
  orange: {
    id: 'orange', name: '肥波', icon: 'pet_orange_follow_0',
    desc: '尿液攻击：抛物线落地生成减速水洼',
    attackType: 'urine',
    // 帧组：每种状态对应一组帧文件名（不含前缀/后缀）
    frames: {
      follow:  ['pet_orange_follow_0', 'pet_orange_follow_1'],
      pickup: ['pet_orange_pickup_0', 'pet_orange_pickup_1'],
      attack: ['pet_orange_urine_0', 'pet_orange_urine_1'],
    },
    baseDps: 10,       // 尿液持续 dps
    slowPct: 0.55,     // 减速百分比
    hazardDuration: 3, // 水洼持续时间(秒)
    attackCd: 1.6,     // 攻击冷却(秒)
    magnetRadius: 170, // 拾取磁吸半径（任务②：扩大吸附范围）
    pickupRadius: 52,  // 拾取触发半径
  },
  amer: {
    id: 'amer', name: '肥强', icon: 'pet_amer_follow_0',
    desc: '头撞攻击：冲撞最近敌人造成伤害+击退',
    attackType: 'butt',
    frames: {
      follow: ['pet_amer_follow_0', 'pet_amer_follow_1'],
      pickup: ['pet_amer_pickup_0', 'pet_amer_pickup_1'],
      attack: ['pet_amer_butt_0', 'pet_amer_butt_1', 'pet_amer_butt_2'],
    },
    baseDamage: 12,   // 头撞基础伤害
    knockback: 220,    // 击退力度
    attackCd: 1.4,     // 攻击冷却(秒)
    magnetRadius: 170,
    pickupRadius: 52,
  },
};

// 宠物商店：花灵魂购买，复用 isUnlocked/spendSouls/unlocks 体系
export const PET_SHOP = [
  { id: 'orange', name: '肥波', icon: 'pet_orange_follow_0', cost: 120,
    desc: '尿液减速水洼 · 帮你拾取宝石' },
  { id: 'amer',   name: '肥强', icon: 'pet_amer_follow_0',   cost: 180,
    desc: '冲撞头击+击退 · 帮你拾取宝石' },
];

// 当前出战宠物选择（持久化），镜像血裔 getSelectedBloodline 模式
export function getSelectedPet() {
  const s = loadSouls();
  const id = s.selectedPet;
  return (id && isUnlocked(id)) ? id : null; // null = 无出战宠物
}

export function setSelectedPet(id) {
  if (id && !isUnlocked(id)) return false; // null = 取消出战（允许）
  const s = loadSouls();
  s.selectedPet = id || null;
  saveSouls(s);
  return true;
}

// 购买宠物解锁：复用祭坛同一 unlocks 体系（isUnlocked/getSelectedPet 据此判定）
export function buyPetUnlock(id) {
  const def = PET_SHOP.find((p) => p.id === id);
  if (!def) return false;
  const s = loadSouls();
  if (s.unlocks.includes(id)) return false;
  if (s.balance < def.cost) return false;
  s.balance -= def.cost;
  s.spent += def.cost;
  s.unlocks.push(id);
  saveSouls(s);
  return true;
}

// 成就枚举（G3 · v1 落地 6 项，覆盖技能树 gate 刚需）。id 即 achievements[] 存储值。
export const ACHIEVEMENTS = {
  clear_easy: '夜行者首通',
  clear_normal: '梦魇行者首通',
  clear_hard: '终焉行者首通',
  no_hit_clear: '无伤通关',
  beat_endgame_any: '直面永夜',
  beat_hard_endgame: '终焉征服者',
};
if (typeof window !== 'undefined') window.__achievements = ACHIEVEMENTS;

export function hasAchievement(id) {
  return loadSouls().achievements.includes(id);
}

// 幂等写入：仅首次解锁时落盘，避免重复弹成就 / 重复持久化
export function grantAchievement(id) {
  const s = loadSouls();
  if (!s.achievements.includes(id)) {
    s.achievements.push(id);
    saveSouls(s);
    return true;
  }
  return false;
}

// 难度配置：hpSlope/dmgSlope=线性段敌我成长斜率；spawnMul=刷怪频率倍率；
// bossCalm=boss存活时刷怪比例；bossGapMul=boss间隔倍率；
// nightBase=永夜指数底数(敌人在永夜阶段HP/伤害乘 1.35^D 等)；artifactCounter=神器反制系数；
// bossHpMul=终局Boss基础HP缩放；affixMul=词缀怪出现概率倍率；packMin/Max=狼群规模；
// expMul=难度经验补偿(硬难度击杀慢，补偿升级频率)；soulMul=灵魂倍率(高难高回报)
// 2026-07 难度下修 [PLACEHOLDER 待真机验证]：原三档敌人成长斜率远超玩家离散升级的成长，
// 中期形成"清不动→吃不到经验→更打不动"的死亡螺旋。全面放缓 hp/dmg/spawn 线性曲线。
// 2026-07-24 终局平衡：三难度保持结构一致(同机制同公式)，仅数值区分(见 GDD §6)。
// 2026-08-04 v4.0 P1 威胁等级 TL 反制（design §1.3 / §1.4）[待真机校准]：
//   ① 基线再平衡（候选 C 辅助手段）：仅 normal/hard 上调 hpSlope/dmgSlope/spawnMul/nightBase，
//      easy 完全不动（easy 存在意义是新手上手，任何上调都是净损失）。
//      normal 在 TL=0 时相对 v3.14 仅 +7.3%（t=720s/4神器口径），新手曲线基本原样保留。
//   ② 新增 tlHpK/tlDmgK/tlSpawnK/tlNightK：TL 只缩放【已有的四条难度斜率】，
//      不新增乘区 —— 避免与 nightMult/artifactMult 形成三重指数相乘（design §1.2 候选 B 关键取舍）。
//   ③ tlMax=TL_auto(局外投入折算)封顶；wagerMax=玩家开局主动加码上限。
//      hard 的 tlMax=12 依赖 statScale 的放大倍数硬上限兜底（见 entities.js statScale 与 §8.1）。
export const DIFFICULTIES = {
  easy: {
    id: 'easy', name: '夜行者', desc: '敌人较弱,节奏舒缓,适合休闲上手',
    hpSlope: 0.18, dmgSlope: 0.10, spawnMul: 0.55, bossCalm: 0.3, bossGapMul: 1.5,
    nightBase: 1.08, artifactCounter: 0.08, bossHpMul: 0.7, affixMul: 0.5,
    packMin: 4, packMax: 6, expMul: 1.0, soulMul: 0.8,
    bossSkillCdMul: 1.3, // 高难<1 缩短 Boss 技能 CD、低难>1 延长
    // TL 缩放系数（easy 最低，保护新手）[待真机校准]
    tlHpK: 0.04, tlDmgK: 0.025, tlSpawnK: 0.015, tlNightK: 0.005,
    tlMax: 6, wagerMax: 3,
    // v4.0 P3 精英节奏（design §2 难度表）[消费方待实现：精英刷新规则单元]
    eliteGapBase: 125, eliteGapMin: 50, maxAliveElites: 2,
  },
  normal: {
    id: 'normal', name: '狩猎者', desc: '标准难度,挑战与乐趣并存',
    // hpSlope 0.26→0.28 / dmgSlope 0.14→0.15 / spawnMul 0.70→0.74 / nightBase 1.16→1.17 [待真机校准]
    hpSlope: 0.28, dmgSlope: 0.15, spawnMul: 0.74, bossCalm: 0.5, bossGapMul: 1.0,
    nightBase: 1.17, artifactCounter: 0.15, bossHpMul: 1.0, affixMul: 1.0,
    packMin: 6, packMax: 10, expMul: 1.0, soulMul: 1.0,
    bossSkillCdMul: 1.0,
    // TL 缩放系数 [待真机校准]：TL=10 → hpSlope 0.448 / dmgSlope 0.21 / spawnMul 0.925 / nightBase 1.25
    tlHpK: 0.06, tlDmgK: 0.04, tlSpawnK: 0.025, tlNightK: 0.008,
    tlMax: 10, wagerMax: 5,
    // v4.0 P3 精英节奏（design §2 难度表）[消费方待实现：精英刷新规则单元]
    eliteGapBase: 105, eliteGapMin: 38, maxAliveElites: 3,
  },
  hard: {
    id: 'hard', name: '永夜', desc: '敌人凶猛,怪潮汹涌,仅限高手',
    // hpSlope 0.38→0.44 / dmgSlope 0.18→0.21 / spawnMul 0.85→0.95 / nightBase 1.24→1.27 [待真机校准]
    // hard 玩家定义上就是老玩家，基线可以更硬（design §1.2 推荐结论：C 只对 hard 明显上调）
    hpSlope: 0.44, dmgSlope: 0.21, spawnMul: 0.95, bossCalm: 0.7, bossGapMul: 0.85,
    nightBase: 1.27, artifactCounter: 0.25, bossHpMul: 1.4, affixMul: 1.20,
    packMin: 6, packMax: 10, expMul: 1.3, soulMul: 1.5,
    bossSkillCdMul: 0.75,
    // TL 缩放系数（最高档）[待真机校准]
    tlHpK: 0.075, tlDmgK: 0.05, tlSpawnK: 0.035, tlNightK: 0.010,
    tlMax: 12, wagerMax: 5,
    // v4.0 P3 精英节奏（design §2 难度表）[消费方待实现：精英刷新规则单元]
    eliteGapBase: 92, eliteGapMin: 32, maxAliveElites: 4,
  },
};

// ---------- v4.0 P1：威胁等级 Threat Level（局外投入的显性反制）----------
// 设计依据 design §1.2 候选 B / §1.3 / §1.4。核心取舍：
//   · TL 只缩放已有斜率，不新增乘区；
//   · TL=0 必须与「基线」逐位等价（statScale 内走短路分支），新手零感知；
//   · 硬上限只钳制「TL 引入的放大倍数」而非绝对倍率 —— 这样才能同时满足
//     「TL=0 等价旧版」与「TL 极限不爆炸」两个约束（对 design §8.1 绝对上限口径的修正，
//      绝对上限会在 hard/t=900/6神器 的 TL=0 场景就被触发，反而改变了既有玩法）。
export const TL_SOUL_PER_LEVEL = 1200;      // 每投入 1200 灵魂到技能树 → TL_auto +1（满树 13750 ≈ 11 级）[待真机校准]
export const TL_SOUL_MUL_PER_LEVEL = 0.05;  // 灵魂回报 ×(1 + 0.05×TL) [待真机校准]（§8.1 提示必要时降到 0.035）
export const TL_EXP_MUL_PER_LEVEL = 0.02;   // 经验回报 ×(1 + 0.02×TL) [待真机校准]
export const TL_HP_AMP_CAP = 2.20;          // TL 对敌人 HP 的最大放大倍数（相对同时刻 TL=0 基线）[待真机校准]
export const TL_DMG_AMP_CAP = 1.80;         // TL 对敌人伤害的最大放大倍数 [待真机校准]
export const TL_SPAWN_MUL_CAP = 1.60;       // spawnMul 缩放后的绝对上限，防刷怪间隔塌到地板 [待真机校准]
export const TL_BOSS_HP_K = 0.06;            // 威胁等级对 Boss 血量的线性缩放系数：TL=10 → +60%（丙-2）
export const TL_BOSS_HP_CAP = 1.60;         // Boss 血量受 TL 缩放的绝对上限（相对 TL=0 基线）（丙-2）

// TL → 叙事称谓（design §1.2 UI 呈现表）。叙事化而非数值化：
// 玩家投入的不是"点数"，是"与永夜的契约"——你越深入这套力量体系，永夜越认得你。
export const TL_TIERS = [
  { min: 12, name: '终焉', color: '#c0392b' },
  { min: 9,  name: '永夜', color: '#8e44ad' },
  { min: 6,  name: '血月', color: '#e74c3c' },
  { min: 3,  name: '深夜', color: '#5b6ea8' },
  { min: 0,  name: '薄暮', color: '#7a6a8e' },
];

export function threatTier(tl, diffId) {
  const v = Math.max(0, Math.floor(tl || 0));
  let tier = TL_TIERS[TL_TIERS.length - 1];
  for (const t of TL_TIERS) {
    if (v >= t.min) { tier = t; break; }
  }
  // v4.0 P2 尾：难度感知（design §1.2「终焉 仅 hard 可达」）。
  // normal/easy 即使 TL 拉满（tlMax + wagerMax 可超 12）也只显示到 永夜，杜绝称谓漂移。
  // diffId 缺省（如 P1 探针）则保持原行为不封顶。
  if (diffId && diffId !== 'hard' && tier.name === '终焉') {
    const cap = TL_TIERS.find((t) => t.name === '永夜');
    if (cap) tier = cap;
  }
  return tier;
}

// 已投入技能树的灵魂总额（按已购节点 cost 求和；洗点后 tree[] 被清空 → 自然回落）
export function treeInvestedSouls(souls) {
  const owned = souls?.tree;
  if (!owned || owned.length === 0) return 0;
  let sum = 0;
  for (const n of SKILL_TREE) if (owned.includes(n.id)) sum += n.cost || 0;
  return sum;
}

// TL_auto = clamp(floor(技能树投入 / 1200), 0, diff.tlMax)
export function computeAutoThreat(diff, souls) {
  const cap = diff?.tlMax ?? 0;
  if (cap <= 0) return 0;
  return Math.max(0, Math.min(cap, Math.floor(treeInvestedSouls(souls) / TL_SOUL_PER_LEVEL)));
}

// 终局时间节点（秒）
export const NIGHT_START = 540;   // 9 分钟：永夜加深触发
export const ENDGAME_BOSS_TIME = 720; // 12 分钟：永夜化身降临
export const GAME_HARD_CAP = 900;    // 15 分钟硬上限：到点仍有终局 Boss 存活则判失败

// ---------- S 档新属性：基础值与硬上限（2026-07-26）----------
export const CRIT_CHANCE_BASE = 0.05;  // 暴击率基础值
export const CRIT_CHANCE_CAP  = 0.75;  // 暴击率硬上限
export const CRIT_MUL_BASE    = 1.5;   // 暴击伤害基础倍率
export const DODGE_CAP        = 0.35;  // 闪避率硬上限
export const SHIELD_REGEN_DELAY = 3;   // 护盾受击打断秒数 [校准]
export const SHIELD_REGEN_BASE = 2;    // 护盾自然回盾基础速率(盾/秒) [校准]
export const DAMAGE_MIN       = 1;     // 防御减免后的保底伤害

export const ENEMY_TYPES = {
  bat: {
    id: 'bat', name: '夜行蝙蝠', sprite: 'bat', hp: 12, speed: 95, damage: 8, exp: 1,
    radius: 12, spriteSize: 34, knockResist: 0, unlockAt: 0, weight: 3, lateWeight: 4,
  },
  skeleton: {
    id: 'skeleton', name: '骷髅', sprite: 'skeleton', hp: 34, speed: 52, damage: 14, exp: 2,
    radius: 14, spriteSize: 42, knockResist: 0.3, unlockAt: 45, weight: 2,
  },
  slime: {
    id: 'slime', name: '史莱姆', sprite: 'slime', hp: 90, speed: 30, damage: 20, exp: 5,
    radius: 18, spriteSize: 54, knockResist: 0.7, unlockAt: 120, weight: 1, lateWeight: 2,
  },
  elite: {
    id: 'elite', name: '血狱典狱长', sprite: 'elite', hp: 650, speed: 42, damage: 32, exp: 40,
    radius: 26, spriteSize: 96, knockResist: 0.95, unlockAt: 150, weight: 0,
    // P3b-3③：血量首次 < 50% 召唤 4 只 bat 护主（通用 onLowHp 钩子，once 语义由 _lowHpFired 保证）
    onLowHp: { at: 0.5, type: 'summon', enemyType: 'bat', count: 4, once: true },
    isElite: true, eliteWeight: 3, eliteColor: '#d4af37',
  },
  // ---------- v4.0 P3 新精英（纯数据层；刷新规则与差异化行为留后续单元）----------
  // 判定口径：「是不是精英」一律读 e.type.isElite（数据层），【绝不写实例 e.isElite】——
  //   weapons.js:_retributionAwaken 有个 `e.isBoss || e.isElite` 的死分支，实例上一写就会
  //   静默激活它（精英从「残血秒杀」变成「扣 15% 最大生命」），构成未申报的既有玩法变更。
  // weight 必须为 0：>0 会被 pickType() 当普通杂兵抽到，精英直接沦为路边怪。
  //   精英之间的相对权重走独立的 eliteWeight 字段，由后续刷新器消费。
  // sprite 是【复用键】不是同名 PNG：文生图管线降级中，硬约束禁止新增 PNG，
  //   故 掠夺者→shadow_hunter（同为冲刺型）、导体→elite（同源，靠光环紫色区分）、
  //   巨像→gargoyle（同为免疫击退的石质肉盾）。精灵键写错会静默降级成紫色实心圆
  //   （不抛异常不打日志），故 test_game.py 有一条全量资产存在性断言兜底。
  // eliteColor 由渲染层的脉动光环消费——elite_conduit 与 elite 共用同一张图，
  //   光环色是玩家区分二者的唯一手段。
  // 本单元【不声明任何机制字段】（onLowHp/dashRange/barrage/allyBuff/frontalArmor 等）：
  //   声明了没人读的字段比不声明更糟（P2 的 lateWeight 前车之鉴）。
  //   immuneKnockback 是例外——现有代码已支持（gargoyle 在用）。
  elite_reaver: {
    id: 'elite_reaver', name: '裂魂掠夺者', sprite: 'elite_reaver', hp: 520, speed: 72, damage: 38, exp: 45,
    radius: 22, spriteSize: 84, knockResist: 0.85, unlockAt: 240, weight: 0,
    // D5：冲刺字段名与 shadow_hunter 完全一致；dashCd:3.2 + dashDuration:0.45 → 周期≈4s（可预判读招，非骚扰）
    dashRange: 320, dashCharge: 0.45, dashSpeed: 3.4, dashCd: 3.2, dashDuration: 0.45,
    isElite: true, eliteWeight: 3, eliteColor: '#e74c3c',
  },
  elite_conduit: {
    id: 'elite_conduit', name: '永夜导体', sprite: 'elite_conduit', hp: 700, speed: 30, damage: 30, exp: 55,
    radius: 24, spriteSize: 90, knockResist: 0.90, unlockAt: 380, weight: 0,
    // P3b-3④：每 3s 发 8 发环形弹幕（复用 P3a-S _fireRadialWave）；给 180px 内非精英友军 +25% 移速
    //   （加速光环由 update() 预扫描统一施加，见 entities.js；用户决议：仅杂兵+暗影猎手，不加速其它精英）
    barrage: { cd: 3.0, count: 8, speed: 140, damage: 18 },
    allyBuff: { radius: 180, speedMul: 1.25 },
    isElite: true, eliteWeight: 2, eliteColor: '#8e44ad',
  },
  elite_colossus: {
    id: 'elite_colossus', name: '腐骸巨像', sprite: 'elite_colossus', hp: 1400, speed: 16, damage: 48, exp: 80,
    radius: 34, spriteSize: 118, knockResist: 1.0, unlockAt: 500, weight: 0,
    turnRate: 0.6, // P3b-3① / D1：限转向速率（比 knight 略低，[待真机校准] 带宽 0.6–1.0）
    frontalArmor: { arcCos: -0.34, mul: 0.40 }, // P3b-3① / D2：正面 140° 减伤 60%（复用 bone_knight 点积判向）
    isElite: true, eliteWeight: 2, eliteColor: '#6b8e23', immuneKnockback: true,
  },
  // 后期新怪（永夜阶段解锁）
  shadow_hunter: {
    id: 'shadow_hunter', name: '暗影猎手', sprite: 'shadow_hunter', hp: 120, speed: 80, damage: 25, exp: 8,
    radius: 14, spriteSize: 40, knockResist: 0.2, unlockAt: 540, weight: 2,
    // 行为：进入 250px 后蓄力 dashCharge 秒，再以 dashSpeed×速度冲刺
    dashRange: 250, dashCharge: 0.5, dashSpeed: 3,
  },
  gargoyle: {
    id: 'gargoyle', name: '石像鬼', sprite: 'gargoyle', hp: 500, speed: 20, damage: 22, exp: 15,
    radius: 26, spriteSize: 96, knockResist: 1.0, unlockAt: 600, weight: 1,
    immuneKnockback: true,
  },
  // ---------- v4.0 P2 新小怪（纯数据层；差异化行为留 P3）[待真机校准] ----------
  // 精灵复用现有资产（design §8.2 美术硬约束：禁止新增 PNG）。行为钩子（cluster/ranged/
  // frontalArmor/trail/healAura/splitOnDeath）为 P3 占位，本版 spawn 仅按 weight/unlockAt
  // 调度为默认追击；数值全部 [待真机校准]。
  rat_swarm: {
    id: 'rat_swarm', name: '尸鼠群', sprite: 'rat_swarm', hp: 6, speed: 130, damage: 5, exp: 1,
    radius: 10, spriteSize: 30, knockResist: 0, unlockAt: 20, weight: 3, lateWeight: 4,
    groupSize: 3, // P3a-1：成簇 ×3 生成（复用 P3a-S spawnAt groupSize 钩子，±28px 散开）
  },
  spitter: {
    id: 'spitter', name: '腐唾者', sprite: 'spitter', hp: 28, speed: 40, damage: 12, exp: 3,
    radius: 13, spriteSize: 40, knockResist: 0.1, unlockAt: 75, weight: 2,
    ranged: true, // P3：远程吐弹、保持距离（小怪单发弹幕，复用现有弹幕池）
    spitCd: 2.2, spitSpeed: 175, spitDamage: 10, keepDist: 200, // P3a-1：吐弹节奏/弹速/弹伤/偏好距离 [待真机校准]
  },
  bone_knight: {
    id: 'bone_knight', name: '骸骨骑士', sprite: 'bone_knight', hp: 180, speed: 58, damage: 26, exp: 10,
    radius: 14, spriteSize: 42, knockResist: 0.3, unlockAt: 200, weight: 2,
    turnRate: 0.7, // P3a-4 / D1：限转向速率(rad/s)，让「绕后破甲」从数学不可能变可教学 [待真机校准 0.6–1.0]
    frontalArmor: { arcCos: -0.5, mul: 0.30 }, // P3：正面 120° 减伤 70%（点积判向）
    affixBan: ['bulwark'], // 与 bulwark 同机制叠加几乎无敌（design §5.4）
  },
  plague_bearer: {
    id: 'plague_bearer', name: '疫病携带者', sprite: 'plague_bearer', hp: 150, speed: 34, damage: 18, exp: 8,
    radius: 16, spriteSize: 50, knockResist: 0.4, unlockAt: 260, weight: 1,
    trail: true, // P3：行走留毒径、死亡大池（hazards[] 池）
    trailCd: 0.6, trailRadius: 26, trailLife: 3, trailDps: 8, trailColor: '#7dcea0', // P3a-3：毒径参数 [待真机校准]
    onDeath: { type: 'hazard', radius: 60, life: 5, dps: 12, color: '#6fcf6f' }, // P3a-3：死亡大毒池
  },
  siren: {
    id: 'siren', name: '哀嚎女妖', sprite: 'siren', hp: 210, speed: 46, damage: 20, exp: 12,
    radius: 15, spriteSize: 46, knockResist: 0.3, unlockAt: 320, weight: 1,
    healAura: true, // P3：治疗友军 12%×3（治疗+光束渲染）
    healCd: 3, healRange: 160, healPct: 0.12, healMax: 3, // P3a-2：治疗光环参数（周期/范围/比例/上限） [待真机校准]
  },
  revenant: {
    id: 'revenant', name: '复仇残躯', sprite: 'revenant', hp: 240, speed: 44, damage: 24, exp: 14,
    radius: 16, spriteSize: 52, knockResist: 0.5, unlockAt: 400, weight: 1,
    onDeath: { type: 'split', enemyType: 'revenant_shard', count: 2 }, // P3a-2：死亡分裂 ×2（P3a-S _runOnDeath 钩子；revenant_shard 仅由此生成）
  },
  // 分裂产物：weight 0 → 永不从刷怪池出现，仅由 revenant.splitOnDeath 生成（P3）
  revenant_shard: {
    id: 'revenant_shard', name: '残躯碎片', sprite: 'skeleton', hp: 60, speed: 70, damage: 12, exp: 3,
    radius: 10, spriteSize: 28, knockResist: 0, unlockAt: 400, weight: 0,
  },
};
if (typeof window !== 'undefined') window.__enemyTypes = ENEMY_TYPES;

// 词缀（叠加在现有怪上，制造行为多样化，低成本高产出）
export const AFFIXES = {
  pack: {
    id: 'pack', name: '狼群', expMul: 2, color: '#f1c40f',
    // 从同一方向一次刷 packCount 只，扇形包抄。packCount 取难度 packMin/Max
  },
  volatile: {
    id: 'volatile', name: '爆破', expMul: 1.6, color: '#e67e22',
    // 死亡时对玩家造成爆炸范围伤害
    blastRadius: 140, blastDamage: 35,
  },
  shielded: {
    id: 'shielded', name: '护盾', expMul: 2, color: '#3498db', minTime: 60,
    // 受到的伤害 ×0.3（正面180°减伤70%的完整版留 PLACEHOLDER，先用全时减伤简化）
    dmgTakenMul: 0.3,
  },
  // ---------- v4.0 P2 新词缀（纯数据层；效果由 P3 行为层读取）[待真机校准] ----------
  // minTime：分时段解锁（design §5.1，零成本把词缀变成"时间轴内容"）。
  // affixBan：怪种级互斥黑名单（design §5.4，防止组合爆炸产生不可战胜怪）。
  // 注：本版 rollSingleAffix 已支持 minTime + affixBan 过滤（entities.js）。
  swift: {
    id: 'swift', name: '疾行', expMul: 1.5, color: '#2ecc71', minTime: 30,
    speedMul: 1.55, // P3：移动速度 ×1.55
  },
  regen: {
    id: 'regen', name: '再生', expMul: 1.8, color: '#27ae60', minTime: 150,
    regenPct: 0.04, // P3：每秒回 4% maxHp，受击后 1.5s 暂停
  },
  leech: {
    id: 'leech', name: '汲取', expMul: 1.9, color: '#8e44ad', minTime: 210,
    leechPct: 0.5, // P3：接触玩家造成伤害的 50% 回自身
  },
  bulwark: {
    id: 'bulwark', name: '壁垒', expMul: 2.0, color: '#95a5a6', minTime: 300,
    frontalArmor: { arcCos: -0.34, mul: 0.25 }, // P3：正面减伤 75%（复用 bone_knight 点积判向）
  },
  frost: {
    id: 'frost', name: '霜蚀', expMul: 1.7, color: '#5ad1e6', minTime: 240,
    slowOnHit: { value: 0.35, duration: 2.0 }, // P3：接触玩家减速 35%/2s（需玩家侧 slow debuff）
  },
};

export const WEAPONS = {
  blade: {
    id: 'blade', name: '血之飞刃', icon: 'blade', maxLevel: 5,
    desc: '朝最近的敌人射出猩红飞刃',
    levels: [
      { damage: 10, cooldown: 1.0, count: 1, pierce: 1, speed: 340 },
      { damage: 13, cooldown: 0.9, count: 2, pierce: 1, speed: 360 },
      { damage: 16, cooldown: 0.8, count: 2, pierce: 2, speed: 380 },
      { damage: 20, cooldown: 0.7, count: 3, pierce: 2, speed: 400 },
      { damage: 26, cooldown: 0.6, count: 4, pierce: 3, speed: 420 },
    ],
  },
  holywater: {
    id: 'holywater', name: '圣水洗礼', icon: 'holywater', maxLevel: 5,
    desc: '在随机敌群处泼洒圣水,留下灼烧领域',
    levels: [
      { damage: 8, cooldown: 3.2, count: 1, radius: 60, duration: 2.4, tick: 0.5 },
      { damage: 11, cooldown: 3.0, count: 1, radius: 82, duration: 2.6, tick: 0.5 },
      { damage: 14, cooldown: 2.8, count: 2, radius: 106, duration: 2.8, tick: 0.5 },
      { damage: 18, cooldown: 2.6, count: 2, radius: 132, duration: 3.0, tick: 0.45 },
      { damage: 24, cooldown: 2.3, count: 3, radius: 160, duration: 3.4, tick: 0.4 },
    ],
  },
  axe: {
    id: 'axe', name: '回旋战斧', icon: 'axe', maxLevel: 5,
    desc: '掷出回旋战斧,穿透敌人并折返',
    levels: [
      { damage: 14, cooldown: 1.7, count: 1, pierce: 99, speed: 250, range: 170 },
      { damage: 18, cooldown: 1.6, count: 1, pierce: 99, speed: 265, range: 190 },
      { damage: 22, cooldown: 1.5, count: 2, pierce: 99, speed: 280, range: 210 },
      { damage: 28, cooldown: 1.4, count: 2, pierce: 99, speed: 295, range: 230 },
      { damage: 36, cooldown: 1.2, count: 3, pierce: 99, speed: 315, range: 250 },
    ],
  },
  lightning: {
    id: 'lightning', name: '雷霆审判', icon: 'lightning', maxLevel: 5,
    desc: '召唤落雷轰击随机敌人,命中后向邻近敌人跳跃',
    levels: [
      { damage: 22, cooldown: 2.6, strikes: 1, chains: 2, chainRange: 150 },
      { damage: 28, cooldown: 2.4, strikes: 2, chains: 2, chainRange: 160 },
      { damage: 34, cooldown: 2.2, strikes: 2, chains: 3, chainRange: 170 },
      { damage: 42, cooldown: 2.0, strikes: 3, chains: 3, chainRange: 185 },
      { damage: 54, cooldown: 1.8, strikes: 4, chains: 4, chainRange: 200 },
    ],
  },
  // 以下 3 把为武器丰富化新增（2026-07-23），机制形态与现有 4 把正交。数值已给默认，真机校准
  aura: {
    id: 'aura', name: '亡灵光环', icon: 'weapon_aura', maxLevel: 5,
    desc: '周身脉冲光环,踏入之敌持续受腐蚀',
    levels: [
      { damage: 6,  cooldown: 0.6,  radius: 70 },
      { damage: 9,  cooldown: 0.6,  radius: 90 },
      { damage: 13, cooldown: 0.55, radius: 112 },
      { damage: 18, cooldown: 0.5,  radius: 136 },
      { damage: 24, cooldown: 0.5,  radius: 162 },
    ],
  },
  whip: {
    id: 'whip', name: '噬魂长鞭', icon: 'weapon_whip', maxLevel: 5,
    desc: '朝最近敌人挥出长鞭,横扫一线之敌',
    levels: [
      { damage: 12, cooldown: 1.6, length: 180, width: 44 },
      { damage: 16, cooldown: 1.5, length: 210, width: 48 },
      { damage: 22, cooldown: 1.35, length: 245, width: 54 },
      { damage: 28, cooldown: 1.2, length: 280, width: 60 },
      { damage: 36, cooldown: 1.0, length: 320, width: 70 },
    ],
  },
  cross: {
    id: 'cross', name: '黎明圣印', icon: 'weapon_cross', maxLevel: 5,
    desc: '放射圣印,向多个方向涤荡敌人',
    levels: [
      { damage: 16, cooldown: 2.2, count: 4, pierce: 1, speed: 380 },
      { damage: 20, cooldown: 2.0, count: 4, pierce: 2, speed: 400 },
      { damage: 26, cooldown: 1.9, count: 6, pierce: 2, speed: 420 },
      { damage: 33, cooldown: 1.6, count: 6, pierce: 3, speed: 440 },
      { damage: 42, cooldown: 1.4, count: 8, pierce: 3, speed: 460 },
    ],
  },
  // 第 10 神器「亡魂收割者」基础武器：对齐 axe（自旋+高穿透+可回旋返回），半径更大、清场更强。
  // 基础形态只做「大范围回旋镰斩」，无 DOT/回血；撕裂 DOT 与收割回能由 reaper 觉醒追加（见 weapons.js/entities.js）。
  scythe: {
    id: 'scythe', name: '亡魂镰刀', icon: 'scythe', maxLevel: 5,
    desc: '掷出回旋镰刀,大范围横扫并折返,清场更强',
    levels: [
      { damage: 16, cooldown: 1.6, count: 1, pierce: 99, speed: 240, range: 210 },
      { damage: 21, cooldown: 1.5, count: 1, pierce: 99, speed: 255, range: 235 },
      { damage: 27, cooldown: 1.4, count: 2, pierce: 99, speed: 270, range: 260 },
      { damage: 34, cooldown: 1.3, count: 2, pierce: 99, speed: 285, range: 290 },
      { damage: 44, cooldown: 1.1, count: 3, pierce: 99, speed: 305, range: 320 },
    ],
  },
  // ===== v2.0 新武器（8 把，配对 8 个无搭配被动；mech 落点见 GDD §2，visual 锚定 §2 配色）=====
  starfall: {
    id: 'starfall', name: '星陨弩', icon: 'weapon_starfall', maxLevel: 5,
    desc: '射出追踪星铁,自动咬住最近的敌人', mech: 'homing', visual: 'starfall',
    levels: [
      { damage: 12, cooldown: 1.4, count: 1, speed: 320, pierce: 1, life: 1.8, homing: 200 },
      { damage: 15, cooldown: 1.2, count: 1, speed: 340, pierce: 1, life: 1.9, homing: 210 },
      { damage: 19, cooldown: 1.1, count: 2, speed: 350, pierce: 2, life: 2.0, homing: 220 },
      { damage: 24, cooldown: 1.0, count: 2, speed: 370, pierce: 2, life: 2.0, homing: 230 },
      { damage: 30, cooldown: 0.9, count: 3, speed: 390, pierce: 2, life: 2.2, homing: 240 },
    ],
  },
  judgment: {
    id: 'judgment', name: '断罪之锋', icon: 'weapon_judgment', maxLevel: 5,
    desc: '向前方重刺,单体超高伤暴击撕裂', mech: 'thrust', visual: 'judgment',
    levels: [
      { damage: 28, cooldown: 1.8, length: 120, width: 40 },
      { damage: 36, cooldown: 1.6, length: 135, width: 44 },
      { damage: 45, cooldown: 1.5, length: 150, width: 48 },
      { damage: 56, cooldown: 1.4, length: 165, width: 52 },
      { damage: 70, cooldown: 1.3, length: 180, width: 56 },
    ],
  },
  phantom: {
    id: 'phantom', name: '幻影裂片', icon: 'weapon_phantom', maxLevel: 5,
    desc: '掷出裂片,命中后炸成多枚幻影碎片', mech: 'splitting', visual: 'phantom',
    levels: [
      { damage: 10, cooldown: 1.4, count: 1, speed: 360, pierce: 1, splits: 2, splitMul: 0.50, splitSpeed: 280 },
      { damage: 13, cooldown: 1.3, count: 1, speed: 370, pierce: 1, splits: 3, splitMul: 0.50, splitSpeed: 290 },
      { damage: 16, cooldown: 1.2, count: 2, speed: 380, pierce: 1, splits: 3, splitMul: 0.55, splitSpeed: 300 },
      { damage: 20, cooldown: 1.1, count: 2, speed: 390, pierce: 2, splits: 4, splitMul: 0.55, splitSpeed: 310 },
      { damage: 25, cooldown: 1.0, count: 2, speed: 400, pierce: 2, splits: 4, splitMul: 0.60, splitSpeed: 320 },
    ],
  },
  aegis: {
    id: 'aegis', name: '守护结晶', icon: 'weapon_aegis', maxLevel: 5,
    desc: '在脚下布设守护哨卫,自动扫射来犯', mech: 'sentinel', visual: 'aegis',
    levels: [
      { damage: 10, cooldown: 4.0, range: 160, shotCD: 0.70, projSpeed: 300, duration: 8,  maxSentinels: 2 },
      { damage: 13, cooldown: 3.8, range: 180, shotCD: 0.65, projSpeed: 310, duration: 9,  maxSentinels: 2 },
      { damage: 17, cooldown: 3.6, range: 200, shotCD: 0.60, projSpeed: 320, duration: 10, maxSentinels: 3 },
      { damage: 21, cooldown: 3.4, range: 220, shotCD: 0.55, projSpeed: 330, duration: 11, maxSentinels: 3 },
      { damage: 26, cooldown: 3.2, range: 240, shotCD: 0.50, projSpeed: 340, duration: 12, maxSentinels: 3 },
    ],
  },
  warden: {
    id: 'warden', name: '回响哨卫', icon: 'weapon_warden', maxLevel: 5,
    desc: '召唤环绕法球,公转间自动开火', mech: 'orb', visual: 'warden',
    levels: [
      { damage: 8,  cooldown: 4.0, count: 1, orbitRadius: 90,  shotCD: 1.20, projSpeed: 320, pierce: 1 },
      { damage: 11, cooldown: 3.8, count: 2, orbitRadius: 100, shotCD: 1.10, projSpeed: 330, pierce: 1 },
      { damage: 14, cooldown: 3.6, count: 2, orbitRadius: 110, shotCD: 1.00, projSpeed: 340, pierce: 1 },
      { damage: 18, cooldown: 3.4, count: 3, orbitRadius: 120, shotCD: 0.95, projSpeed: 350, pierce: 1 },
      { damage: 22, cooldown: 3.2, count: 3, orbitRadius: 130, shotCD: 0.90, projSpeed: 360, pierce: 2 },
    ],
  },
  maul: {
    id: 'maul', name: '碎甲重锤', icon: 'weapon_maul', maxLevel: 5,
    desc: '周期性轰出扩张冲击波,碾碎周遭', mech: 'shockwave', visual: 'maul',
    levels: [
      { damage: 16, cooldown: 3.0, radius: 150, width: 36, expand: 0.50, knock: 40 },
      { damage: 21, cooldown: 2.8, radius: 170, width: 38, expand: 0.50, knock: 45 },
      { damage: 27, cooldown: 2.6, radius: 190, width: 40, expand: 0.55, knock: 50 },
      { damage: 34, cooldown: 2.4, radius: 210, width: 42, expand: 0.60, knock: 55 },
      { damage: 42, cooldown: 2.2, radius: 230, width: 44, expand: 0.60, knock: 60 },
    ],
  },
  sanguine: {
    id: 'sanguine', name: '噬血荆棘', icon: 'weapon_sanguine', maxLevel: 5,
    desc: '射出吸血荆棘,命中回血续航', mech: 'lifesteal', visual: 'sanguine',
    levels: [
      { damage: 12, cooldown: 1.4, count: 1, speed: 330, pierce: 2, heal: 1 },
      { damage: 15, cooldown: 1.3, count: 1, speed: 345, pierce: 2, heal: 1 },
      { damage: 19, cooldown: 1.2, count: 2, speed: 360, pierce: 3, heal: 1.5 },
      { damage: 24, cooldown: 1.1, count: 2, speed: 375, pierce: 3, heal: 1.5 },
      { damage: 30, cooldown: 1.0, count: 2, speed: 390, pierce: 3, heal: 2 },
    ],
  },
  resolve: {
    id: 'resolve', name: '镇魂钟鸣', icon: 'weapon_resolve', maxLevel: 5,
    desc: '符文环绕周身,敌人进入范围即触发音波脉冲', mech: 'rune', visual: 'resolve',
    levels: [
      { damage: 18, cooldown: 3.0, count: 1, triggerRange: 28, burstRadius: 130, deployRange: 170, spin: 0.6, duration: 8,  maxRunes: 8,  pulseInterval: 1.0,  pulseMul: 0.5 }, // [PLACEHOLDER] 脉冲节奏/倍率/范围待真机校准
      { damage: 23, cooldown: 2.8, count: 1, triggerRange: 30, burstRadius: 145, deployRange: 185, spin: 0.6, duration: 9,  maxRunes: 9,  pulseInterval: 0.95, pulseMul: 0.5 }, // [PLACEHOLDER]
      { damage: 29, cooldown: 2.6, count: 2, triggerRange: 32, burstRadius: 160, deployRange: 200, spin: 0.6, duration: 10, maxRunes: 10, pulseInterval: 0.9,  pulseMul: 0.5 }, // [PLACEHOLDER]
      { damage: 36, cooldown: 2.4, count: 2, triggerRange: 34, burstRadius: 175, deployRange: 215, spin: 0.6, duration: 11, maxRunes: 11, pulseInterval: 0.85, pulseMul: 0.5 }, // [PLACEHOLDER]
      { damage: 44, cooldown: 2.2, count: 2, triggerRange: 36, burstRadius: 190, deployRange: 230, spin: 0.6, duration: 12, maxRunes: 12, pulseInterval: 0.8,  pulseMul: 0.5 }, // [PLACEHOLDER]
    ],
  },
};

if (typeof window !== 'undefined') window.__weapons = WEAPONS;

export const PASSIVES = {
  // ===== 同类被动合并（D3，v1.1）：boots 吸收 swift / tome 吸收 rage，保留主键，删 swift/rage =====
  boots: { id: 'boots', name: '疾行之靴', icon: 'passive_boots', maxLevel: 99, category: 'utility', desc: '移动速度 +6%', apply: (p) => { p.speedMul += 0.06; } },
  heart: { id: 'heart', name: '巨人之心', icon: 'passive_heart', maxLevel: 5, category: 'survival', desc: '生命上限 +20,并回复 20', apply: (p) => { p.maxHp += 20; p.hp = Math.min(p.maxHp, p.hp + 20); } },
  tome: { id: 'tome', name: '秘法魔典', icon: 'passive_tome', maxLevel: 99, category: 'offense', desc: '所有伤害 +8%', apply: (p) => { p.damageMul += 0.08; } },
  magnet: { id: 'magnet', name: '引力宝珠', icon: 'passive_magnet', maxLevel: 5, category: 'utility', desc: '拾取范围 +25%', apply: (p) => { p.magnetMul += 0.25; } },
  // 无限成长被动：20+ 级后期每次升级依然有意义
  greed: { id: 'greed', name: '财富之魂', icon: 'passive_greed', maxLevel: 99, category: 'utility', desc: '经验获取 +8%', apply: (p) => { p.expMul += 0.08; } },
  guard: { id: 'guard', name: '钢铁意志', icon: 'passive_guard', maxLevel: 99, category: 'survival', desc: '受到伤害 -2%', apply: (p) => { p.damageTakenMul = Math.max(0.3, (p.damageTakenMul || 1) * 0.98); } },
  // 续航被动：与血瓶掉落互补，解决"掉血不可逆"的核心挫败。0.8/级 满级 4 HP/s
  regen: { id: 'regen', name: '血色再生', icon: 'passive_regen', maxLevel: 5, category: 'survival', desc: '每秒回复 0.8 生命', apply: (p) => { p.regenRate = (p.regenRate || 0) + 0.8; } },
  // ===== S 档新被动（2026-07-26，默认全开放入池，不进 RECIPES）=====
  critrate: {
    id: 'critrate', name: '致命专注', icon: 'passive_critrate',
    maxLevel: 5, category: 'offense',
    desc: '暴击率 +5%',
    apply: (p) => { p.critChance = Math.min(CRIT_CHANCE_CAP, p.critChance + 0.05); },
  },
  critdmg: {
    id: 'critdmg', name: '毁灭之刃', icon: 'passive_critdmg',
    maxLevel: 5, category: 'offense',
    desc: '暴击伤害 +15%',
    apply: (p) => { p.critMul += 0.15; },
  },
  shield: {
    id: 'shield', name: '幽能屏障', icon: 'passive_shield',
    maxLevel: 5, category: 'survival',
    desc: '护盾上限 +20,并立即可获得 20 护盾',
    apply: (p) => { p.maxShield += 20; p.shield = Math.min(p.maxShield, p.shield + 20); },
  },
  shieldregen: {
    id: 'shieldregen', name: '灵能回响', icon: 'passive_shieldregen',
    maxLevel: 5, category: 'survival',
    desc: '每秒恢复 1.5 护盾(受击后 3 秒内暂停)',
    apply: (p) => { p.shieldRegen += 1.5; },
  },
  armor: {
    id: 'armor', name: '暗夜铠甲', icon: 'passive_armor',
    maxLevel: 5, category: 'survival',
    desc: '防御 +2(每次受击固定少受 2 点伤害)',
    apply: (p) => { p.armor += 2; },
  },
  dodge: {
    id: 'dodge', name: '魅影身法', icon: 'passive_dodge',
    maxLevel: 5, category: 'survival',
    desc: '闪避率 +4%',
    apply: (p) => { p.dodgeChance = Math.min(DODGE_CAP, p.dodgeChance + 0.04); },
  },
};

export function expForLevel(level) {
  return Math.floor(4 + (level - 1) * 3 + Math.pow(level - 1, 1.7) * 2);
}

// 经验时间缩放：保证后期升级频率不衰减。1 + (t/60)*0.08 → 10min×1.8, 15min×2.6
export function expScaleForTime(t) {
  return 1 + (t / 60) * 0.08;
}

export function loadBest() {
  try {
    const raw = localStorage.getItem(CONFIG.BEST_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveBest(best) {
  try {
    localStorage.setItem(CONFIG.BEST_KEY, JSON.stringify(best));
  } catch { /* ignore */ }
}

// ---------- 血裔系统（开局角色差异，S2）----------
// 6 个起始血裔：各有起始武器 + 属性偏向。除流浪者(默认)外需花灵魂解锁一次，永久可选。
// 数值已给默认成本与偏向幅度，真机试玩后微调。
export const BLOODLINES = [
  {
    id: 'wanderer', name: '流浪者', icon: 'portrait_wanderer',
    desc: '均衡起手 · 血之飞刃 + 微幅全能力',
    weapon: 'blade', cost: 0, hidden: false,
    apply: (g) => { g.player.damageMul += 0.05; g.player.maxHp += 5; },
  },
  {
    id: 'saint', name: '圣徒', icon: 'portrait_saint',
    desc: '圣水起手（槽外固有·不占武器槽） · 范围与持续 +20%',
    weapon: 'holywater', innate: true, cost: 80, hidden: false,
    apply: (g) => { g.player.areaMul *= 1.20; },
  },
  {
    id: 'berserker', name: '狂战', icon: 'portrait_berserker',
    desc: '战斧起手 · 攻速 +12% · 移速 +6%',
    weapon: 'axe', cost: 120, hidden: false,
    apply: (g) => { g.player.cooldownMul *= 0.88; g.player.speedMul += 0.06; },
  },
  {
    id: 'thunder', name: '雷巫', icon: 'portrait_thunder',
    desc: '雷霆起手 · 冷却缩减 +20%',
    weapon: 'lightning', cost: 160, hidden: false,
    apply: (g) => { g.player.cooldownMul *= 0.80; },
  },
  {
    id: 'bloodthirsty', name: '嗜血者', icon: 'portrait_bloodthirsty',
    desc: '长鞭起手 · 命中回血 + 伤害 +5%',
    weapon: 'whip', cost: 200, hidden: false,
    apply: (g) => { g.player.lifesteal += 1.5; g.player.damageMul += 0.05; },
  },
  {
    id: 'apostle', name: '永夜使徒', icon: 'portrait_apostle',
    desc: '永夜光环起手（槽外固有·不占武器槽） · 高难高回报: 伤害+30% · 移速+25% · 冷却-25% · 生命-20%',
    weapon: 'aura', innate: true, cost: 260, hidden: true,
    apply: (g) => {
      g.player.damageMul += 0.30;
      g.player.speedMul += 0.25;
      g.player.cooldownMul *= 0.75;
      g.player.maxHp -= 20;
    },
  },
];

// ---------- 灵魂货币持久化 ----------
const SOUL_KEY = 'night_survivors_souls';
export const SOUL_SCHEMA_VERSION = 1;

export function loadSouls() {
  try {
    const raw = localStorage.getItem(SOUL_KEY);
    const o = raw ? JSON.parse(raw) : null;
    const base = {
      balance: o?.balance || 0,
      spent: o?.spent || 0,
      unlocks: o?.unlocks || [],
      cleared: o?.cleared || [],
      bloodlines: o?.bloodlines || ['wanderer'],
      selectedBloodline: o?.selectedBloodline || 'wanderer',
      // === 宠物出战选择（v4.4）：持久化字段，漏写会导致选中后刷新即丢失 ===
      selectedPet: o?.selectedPet ?? null,
      // === 技能树 v1 持久化地基（G1：向后兼容默认，旧档缺字段 → 安全兜底）===
      tree: o?.tree || [],                 // 已购技能树节点 id
      treeResets: o?.treeResets || 0,      // 洗点次数
      achievements: o?.achievements || [], // 成就（与 G1 合并迁移）
      totalKills: o?.totalKills || 0,      // 累计击杀（前向兼容计数器）
      killsByType: o?.killsByType || {},  // 按怪种累计击杀（P3b-5a 图鉴弱点情报分级解锁）
      version: o?.version || SOUL_SCHEMA_VERSION,
    };
    return migrateSouls(base, o?.version);
  } catch {
    return { balance: 0, spent: 0, unlocks: [], cleared: [], bloodlines: ['wanderer'],
             selectedBloodline: 'wanderer', tree: [], treeResets: 0, achievements: [], totalKills: 0, killsByType: {}, version: 1 };
  }
}

// 版本驱动迁移：未来 schema 升级唯一入口（v1 仅占位留口，禁止在 loadSouls 散点判断）
function migrateSouls(s, fromVersion) {
  const v = fromVersion || 1;
  // 未来示例：if (v < 2) { s.xxx = []; s.version = 2; }
  return s;
}

export function saveSouls(s) {
  try { localStorage.setItem(SOUL_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

// ============ 技能树 v1（元进度 · 独立层）============
// 与 ALTAR 并列的独立数组，存于 loadSouls().tree[]，不污染祭坛循环。
// apply(g) 在 game.js startRun 中 ALTAR 循环之后并列注入。
// cost 已填（均显著高于祭坛，防双 sink 失衡）；数值待真机校准处已标注。
export const SKILL_TREE = [
  // ---------- 征伐 war ----------
  { id: 'war_root', branch: 'war', type: 'gate', name: '征伐之门', icon: 'sk_war_root',
    desc: '解锁「征伐」分支：武器与伤害的专精投资线', cost: 300, prereq: [], gateReq: null, apply: () => {} },
  { id: 'war_dmg', branch: 'war', type: 'stat', name: '全军破阵', icon: 'sk_war_dmg',
    desc: '所有武器伤害 +8%', cost: 180, prereq: ['war_root'], gateReq: null,
    apply: (g) => { g.player.damageMul += 0.08; } },
  { id: 'war_cd', branch: 'war', type: 'stat', name: '急速号令', icon: 'sk_war_cd',
    desc: '所有武器冷却 -8%', cost: 180, prereq: ['war_dmg'], gateReq: null,
    apply: (g) => { g.player.cooldownMul *= 0.92; } },
  { id: 'war_axe_extra', branch: 'war', type: 'modifier', name: '回旋精通', icon: 'sk_war_axe_extra',
    desc: '回旋战斧 同时投掷 +1 把', cost: 280, prereq: ['war_root'], gateReq: null,
    apply: (g) => { const m = g.player.weaponMods; m.axe = m.axe || {}; m.axe.count = (m.axe.count || 0) + 1; } },
  { id: 'war_lightning_chain', branch: 'war', type: 'modifier', name: '雷霆连锁', icon: 'sk_war_lightning_chain',
    desc: '雷霆审判 跳跃 +2 段', cost: 300, prereq: ['war_axe_extra'], gateReq: null,
    apply: (g) => { const m = g.player.weaponMods; m.lightning = m.lightning || {}; m.lightning.chains = (m.lightning.chains || 0) + 2; } },
  { id: 'war_holywater_layer', branch: 'war', type: 'modifier', name: '圣水漫延', icon: 'sk_war_holywater_layer',
    desc: '圣水洗礼 同时泼洒 +1 片领域', cost: 320, prereq: ['war_cd'], gateReq: null,
    apply: (g) => { const m = g.player.weaponMods; m.holywater = m.holywater || {}; m.holywater.count = (m.holywater.count || 0) + 1; } },
  { id: 'war_starfall_crit', branch: 'war', type: 'modifier', name: '星陨锐击', icon: 'sk_war_starfall_crit',
    desc: '星陨弩 暴击率 +15% & 暴击伤害 +25%', cost: 360, prereq: ['war_lightning_chain'], gateReq: null,
    apply: (g) => { const m = g.player.weaponMods; m.starfall = m.starfall || {}; m.starfall.critChance = (m.starfall.critChance || 0) + 0.15; m.starfall.critMul = (m.starfall.critMul || 0) + 0.25; } },
  { id: 'war_keystone_omni', branch: 'war', type: 'keystone', name: '万象征伐', icon: 'sk_war_keystone_omni',
    desc: '全武器伤害 +12% & 冷却 -10%', cost: 700, prereq: ['war_dmg', 'war_axe_extra'], gateReq: null,
    apply: (g) => { g.player.damageMul += 0.12; g.player.cooldownMul *= 0.90; } },
  { id: 'war_keystone_avalanche', branch: 'war', type: 'keystone', name: '崩裂征伐', icon: 'sk_war_keystone_avalanche',
    desc: '全武器伤害 +15% & 范围 +20%', cost: 750, prereq: ['war_lightning_chain', 'war_starfall_crit'], gateReq: null,
    apply: (g) => { g.player.damageMul += 0.15; g.player.areaMul *= 1.20; } },
  // ---------- 血裔协同 bly ----------
  { id: 'bly_root', branch: 'bly', type: 'gate', name: '血裔之门', icon: 'sk_bly_root',
    desc: '解锁「血裔协同」分支：6 血裔的起始武器/属性偏向深化', cost: 250, prereq: [], gateReq: null, apply: () => {} },
  { id: 'bly_saint_pulse', branch: 'bly', type: 'modifier', name: '圣徒恩泽', icon: 'sk_bly_saint_pulse',
    desc: '圣水洗礼 同时泼洒 +1 片领域（圣徒协同）', cost: 300, prereq: ['bly_root'], gateReq: null,
    apply: (g) => { const m = g.player.weaponMods; m.holywater = m.holywater || {}; m.holywater.count = (m.holywater.count || 0) + 1; } },
  { id: 'bly_blood_lifeshield', branch: 'bly', type: 'keystone', name: '噬血结界', icon: 'sk_bly_blood_lifeshield',
    desc: '吸血(lifesteal) 溢出转为护盾', cost: 700, prereq: ['bly_root'], gateReq: null,
    apply: (g) => { g.player.lifestealToShield = true; } },
  { id: 'bly_thunder_chain', branch: 'bly', type: 'modifier', name: '雷巫共鸣', icon: 'sk_bly_thunder_chain',
    desc: '雷霆审判 跳跃 +2 段（雷巫协同）', cost: 300, prereq: ['bly_saint_pulse'], gateReq: null,
    apply: (g) => { const m = g.player.weaponMods; m.lightning = m.lightning || {}; m.lightning.chains = (m.lightning.chains || 0) + 2; } },
  { id: 'bly_berserk_rage', branch: 'bly', type: 'stat', name: '狂战之怒', icon: 'sk_bly_berserk_rage',
    desc: '伤害 +8% & 移速 +5%（狂战协同）', cost: 260, prereq: ['bly_saint_pulse'], gateReq: null,
    apply: (g) => { g.player.damageMul += 0.08; g.player.speedMul += 0.05; } },
  { id: 'bly_wanderer_omni', branch: 'bly', type: 'stat', name: '流浪均衡', icon: 'sk_bly_wanderer_omni',
    desc: '伤害 +5% & 生命上限 +20（流浪者均衡）', cost: 240, prereq: ['bly_berserk_rage'], gateReq: null,
    apply: (g) => { g.player.damageMul += 0.05; g.player.maxHp += 20; } },
  { id: 'bly_sanguine_lifesteal', branch: 'bly', type: 'stat', name: '噬血渴望', icon: 'sk_bly_sanguine_lifesteal',
    desc: '命中回血(lifesteal) +1.0（噬血协同）', cost: 300, prereq: ['bly_thunder_chain'], gateReq: null,
    apply: (g) => { g.player.lifesteal += 1.0; } },
  { id: 'bly_keystone_apostle', branch: 'bly', type: 'keystone', name: '使徒权能', icon: 'sk_bly_keystone_apostle',
    desc: '伤害 +15% & 永夜减伤 +15%（高风险高回报）', cost: 850, prereq: ['bly_wanderer_omni', 'bly_sanguine_lifesteal'], gateReq: { cleared: ['hard'] },
    apply: (g) => { g.player.damageMul += 0.15; g.player.nightDmgReduction = Math.min(0.9, g.player.nightDmgReduction + 0.15); } },
  // ---------- 永夜抗性 nfr ----------
  { id: 'nfr_root', branch: 'nfr', type: 'gate', name: '永夜之门', icon: 'sk_nfr_root',
    desc: '解锁「永夜抗性」分支：生存/终局，高难门槛线', cost: 250, prereq: [], gateReq: null, apply: () => {} },
  { id: 'nfr_hp', branch: 'nfr', type: 'stat', name: '坚韧体魄', icon: 'sk_nfr_hp',
    desc: '生命上限 +40', cost: 180, prereq: ['nfr_root'], gateReq: null,
    apply: (g) => { g.player.maxHp += 40; } },
  { id: 'nfr_shield', branch: 'nfr', type: 'stat', name: '壁垒护盾', icon: 'sk_nfr_shield',
    desc: '护盾上限 +25（并立即获得 25 盾）', cost: 240, prereq: ['nfr_hp'], gateReq: null,
    apply: (g) => { g.player.maxShield += 25; g.player.shield = Math.min(g.player.maxShield, g.player.shield + 25); } },
  { id: 'nfr_armor', branch: 'nfr', type: 'stat', name: '铁壁防御', icon: 'sk_nfr_armor',
    desc: '防御(固定减伤) +3', cost: 200, prereq: ['nfr_root'], gateReq: null,
    apply: (g) => { g.player.armor += 3; } },
  { id: 'nfr_thorns', branch: 'nfr', type: 'stat', name: '荆棘反伤', icon: 'sk_nfr_thorns',
    desc: '反伤(thorns) +20（受击反弹等量）', cost: 320, prereq: ['nfr_hp'], gateReq: null,
    apply: (g) => { g.player.thorns += 20; } },
  { id: 'nfr_nightdr', branch: 'nfr', type: 'stat', name: '永夜庇护', icon: 'sk_nfr_nightdr',
    desc: '永夜阶段(≥540s)受伤 -20%', cost: 360, prereq: ['nfr_shield'], gateReq: null,
    apply: (g) => { g.player.nightDmgReduction = Math.min(0.9, g.player.nightDmgReduction + 0.20); } },
  { id: 'nfr_statusamp', branch: 'nfr', type: 'stat', name: '深渊侵蚀', icon: 'sk_nfr_statusamp',
    desc: '状态增幅(statusAmp) +0.5（放大减速等）', cost: 340, prereq: ['nfr_armor'], gateReq: null,
    apply: (g) => { g.player.statusAmp += 0.5; } },
  { id: 'nfr_keystone_endgame', branch: 'nfr', type: 'keystone', name: '终焉守护', icon: 'sk_nfr_keystone_endgame',
    desc: '永夜减伤 +20% & 反伤 +25 & 护盾上限 +30', cost: 800, prereq: ['nfr_nightdr', 'nfr_statusamp'], gateReq: { cleared: ['hard'] },
    apply: (g) => { g.player.nightDmgReduction = Math.min(0.9, g.player.nightDmgReduction + 0.20); g.player.thorns += 25; g.player.maxShield += 30; g.player.shield = Math.min(g.player.maxShield, g.player.shield + 30); } },
  // ---------- 灵魂经济 eco ----------
  { id: 'eco_root', branch: 'eco', type: 'gate', name: '贪婪之门', icon: 'sk_eco_root',
    desc: '解锁「灵魂经济」分支：灵魂获取/再投资', cost: 250, prereq: [], gateReq: null, apply: () => {} },
  { id: 'eco_gain1', branch: 'eco', type: 'stat', name: '亡魂亲和', icon: 'sk_eco_gain1',
    desc: '灵魂获取(soulGainMul) ×1.15', cost: 200, prereq: ['eco_root'], gateReq: null,
    apply: (g) => { g.soulGainMul *= 1.15; } },
  { id: 'eco_gain2', branch: 'eco', type: 'stat', name: '亡魂眷顾', icon: 'sk_eco_gain2',
    desc: '灵魂获取(soulGainMul) ×1.15（叠加）', cost: 320, prereq: ['eco_gain1'], gateReq: null,
    apply: (g) => { g.soulGainMul *= 1.15; } },
  { id: 'eco_gate_nightmare', branch: 'eco', type: 'gate', name: '噩梦投资', icon: 'sk_eco_gate_nightmare',
    desc: '解锁"噩梦投资"子区（高难高回报）', cost: 350, prereq: ['eco_root'], gateReq: { cleared: ['normal'] }, apply: () => {} },
  { id: 'eco_nightmare', branch: 'eco', type: 'stat', name: '噩梦红利', icon: 'sk_eco_nightmare',
    desc: '灵魂获取(soulGainMul) ×1.20（高难 soulMul 已乘 → 高难高回报）', cost: 450, prereq: ['eco_gate_nightmare'], gateReq: null,
    apply: (g) => { g.soulGainMul *= 1.20; } },
  { id: 'eco_keystone_hoarder', branch: 'eco', type: 'keystone', name: '守财龙裔', icon: 'sk_eco_keystone_hoarder',
    desc: '灵魂获取(soulGainMul) ×1.30（软上限 4.0）', cost: 800, prereq: ['eco_gain2', 'eco_nightmare'], gateReq: null,
    apply: (g) => { g.soulGainMul = Math.min(4.0, g.soulGainMul * 1.30); } }, // [校准] 软上限 4.0 待真机观察
  // ---------- 通用机能 utl ----------
  { id: 'utl_root', branch: 'utl', type: 'gate', name: '机能之门', icon: 'sk_utl_root',
    desc: '解锁「通用机能」分支：冷却/暴击/吸血/闪避/拾取', cost: 250, prereq: [], gateReq: null, apply: () => {} },
  { id: 'utl_cd', branch: 'utl', type: 'stat', name: '时序优化', icon: 'sk_utl_cd',
    desc: '全武器冷却 -7%', cost: 180, prereq: ['utl_root'], gateReq: null,
    apply: (g) => { g.player.cooldownMul *= 0.93; } },
  { id: 'utl_crit', branch: 'utl', type: 'stat', name: '致命精准', icon: 'sk_utl_crit',
    desc: '暴击率 +8%（封顶 CRIT_CHANCE_CAP）', cost: 220, prereq: ['utl_cd'], gateReq: null,
    apply: (g) => { g.player.critChance = Math.min(CRIT_CHANCE_CAP, g.player.critChance + 0.08); } },
  { id: 'utl_critdmg', branch: 'utl', type: 'stat', name: '致命重创', icon: 'sk_utl_critdmg',
    desc: '暴击伤害 +20%', cost: 220, prereq: ['utl_crit'], gateReq: null,
    apply: (g) => { g.player.critMul += 0.20; } },
  { id: 'utl_magnet', branch: 'utl', type: 'stat', name: '磁力场', icon: 'sk_utl_magnet',
    desc: '拾取范围(magnetMul) +25%', cost: 160, prereq: ['utl_root'], gateReq: null,
    apply: (g) => { g.player.magnetMul += 0.25; } },
  { id: 'utl_dodge', branch: 'utl', type: 'stat', name: '幻影步', icon: 'sk_utl_dodge',
    desc: '闪避率 +4%（封顶 DODGE_CAP）', cost: 240, prereq: ['utl_cd'], gateReq: null,
    apply: (g) => { g.player.dodgeChance = Math.min(DODGE_CAP, g.player.dodgeChance + 0.04); } },
  { id: 'utl_regen', branch: 'utl', type: 'stat', name: '血色再生', icon: 'sk_utl_regen',
    desc: '每秒回血(regenRate) +1.0', cost: 200, prereq: ['utl_magnet'], gateReq: null,
    apply: (g) => { g.player.regenRate += 1.0; } },
  { id: 'utl_keystone_efficient', branch: 'utl', type: 'keystone', name: '极致机能', icon: 'sk_utl_keystone_efficient',
    desc: '冷却 -10% & 暴击率 +5% & 闪避 +3%（封顶）', cost: 650, prereq: ['utl_crit', 'utl_dodge'], gateReq: null,
    apply: (g) => { g.player.cooldownMul *= 0.90; g.player.critChance = Math.min(CRIT_CHANCE_CAP, g.player.critChance + 0.05); g.player.dodgeChance = Math.min(DODGE_CAP, g.player.dodgeChance + 0.03); } },
];
if (typeof window !== 'undefined') window.__skilltree = SKILL_TREE;
if (typeof window !== 'undefined') { window.__buySkillNode = buySkillNode; window.__respecTree = respecTree; }

// 购买技能树节点（幂等，防连点/重复扣费）。返回 { ok, reason? }
export function buySkillNode(id) {
  const def = SKILL_TREE.find((n) => n.id === id);
  if (!def) return { ok: false, reason: 'not_found' };
  const s = loadSouls();
  if (s.tree.includes(id)) return { ok: false, reason: 'owned' };            // 幂等：已购不重复扣
  for (const p of def.prereq || [])                                          // 前置链
    if (!s.tree.includes(p)) return { ok: false, reason: 'prereq' };
  if (def.gateReq) {                                                        // 门槛（cleared / achievement）
    if (def.gateReq.cleared && !def.gateReq.cleared.every((c) => s.cleared.includes(c)))
      return { ok: false, reason: 'cleared' };
    if (def.gateReq.achievement && !def.gateReq.achievement.every((a) => s.achievements.includes(a)))
      return { ok: false, reason: 'achievement' };
  }
  if (s.balance < def.cost) return { ok: false, reason: 'balance' };
  s.balance -= def.cost;
  s.spent += def.cost;
  s.tree.push(id);
  saveSouls(s);
  return { ok: true };
}

// 洗点（respec）：灵魂全额返还 + 一次性小额手续费。返回 { ok, reason?, fee?, refund? }
export function respecTree() {
  const s = loadSouls();
  const refund = SKILL_TREE.filter((n) => s.tree.includes(n.id)).reduce((sum, n) => sum + n.cost, 0);
  const fee = Math.max(25, Math.floor(refund * 0.05));                       // [校准] 5% 斜率待真机观察
  if (s.balance < fee) return { ok: false, reason: 'fee', fee, refund };     // 需手头有足额手续费
  s.balance += refund;          // 灵魂全额返还
  s.balance -= fee;             // 扣除一次性小额手续费
  s.tree = [];                  // 清空已购节点
  s.treeResets += 1;            // 计数 +1（统计/成就用）
  saveSouls(s);
  return { ok: true, fee, refund };
}

export function addSouls(n) {
  const s = loadSouls();
  s.balance += Math.max(0, Math.floor(n));
  saveSouls(s);
  return s.balance;
}

export function spendSouls(n) {
  const s = loadSouls();
  if (s.balance < n) return false;
  s.balance -= n;
  saveSouls(s);
  return true;
}

export function isUnlocked(id) {
  return loadSouls().unlocks.includes(id);
}

// 购买祭坛解锁：余额不足或已拥有则失败。成功则扣费并记录
export function buyUnlock(id) {
  const def = ALTAR.find((a) => a.id === id);
  if (!def) return false;
  const s = loadSouls();
  if (s.unlocks.includes(id)) return false;
  if (s.balance < def.cost) return false;
  s.balance -= def.cost;
  s.spent += def.cost;
  s.unlocks.push(id);
  saveSouls(s);
  return true;
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ---------- 血裔解锁 / 选择 ----------
export function isBloodlineUnlocked(id) {
  if (id === 'wanderer') return true; // 默认血裔永久免费
  return loadSouls().bloodlines.includes(id);
}

// 购买血裔解锁：余额不足或已拥有则失败。成功扣费并记录
export function buyBloodlineUnlock(id) {
  const def = BLOODLINES.find((b) => b.id === id);
  if (!def) return false;
  if (isBloodlineUnlocked(id)) return false;
  const s = loadSouls();
  if (s.balance < def.cost) return false;
  s.balance -= def.cost;
  s.spent += def.cost;
  s.bloodlines.push(id);
  saveSouls(s);
  return true;
}

// 当前选定血裔（持久化）。未解锁或非法时回退默认
export function getSelectedBloodline() {
  const s = loadSouls();
  const id = s.selectedBloodline;
  return isBloodlineUnlocked(id) ? id : 'wanderer';
}

export function setSelectedBloodline(id) {
  if (!isBloodlineUnlocked(id)) return false;
  const s = loadSouls();
  s.selectedBloodline = id;
  saveSouls(s);
  return true;
}

// ---------- 神器（Artifact）----------
export const ARTIFACTS = {
  storm: { id: 'storm', name: '千刃风暴', icon: 'art_storm', baseWeapon: 'blade', rarity: 'normal', desc: '无冷却,持续向最近的 3 个敌人倾泻飞刃' },
  devour: { id: 'devour', name: '圣洁吞噬', icon: 'art_devour', baseWeapon: 'holywater', rarity: 'normal', desc: '环绕你的圣域,持续灼烧踏入的一切' },
  spiral: { id: 'spiral', name: '死亡螺旋', icon: 'art_spiral', baseWeapon: 'axe', rarity: 'normal', desc: '六把战斧环绕你全屏旋转,绞碎靠近之敌' },
  stormcall: { id: 'stormcall', name: '雷霆循环', icon: 'art_stormcall', baseWeapon: 'lightning', rarity: 'normal', desc: '每 1.2 秒轰击 6 个目标,雷电跳跃 6 次' },
  crimson: { id: 'crimson', name: '猩红之拥', icon: 'art_crimson', baseWeapon: 'blade', rarity: 'hidden', desc: '飞刃数量与伤害强化,命中吸血回血' },
  tempest: { id: 'tempest', name: '雷劫', icon: 'art_tempest', baseWeapon: 'lightning', rarity: 'hidden', desc: '你行经之处,落雷不绝' },
  // 以下 3 个为武器丰富化新增进化神器（2026-07-23）
  sepulcher: { id: 'sepulcher', name: '寂灭结界', icon: 'art_sepulcher', baseWeapon: 'aura', rarity: 'normal', desc: '光环暴涨并迸射骨刺,绞杀周遭' },
  eternalwhip: { id: 'eternalwhip', name: '永劫之鞭', icon: 'art_eternalwhip', baseWeapon: 'whip', rarity: 'normal', desc: '三向齐扫,横扫千军' },
  matrix: { id: 'matrix', name: '圣光矩阵', icon: 'art_matrix', baseWeapon: 'cross', rarity: 'normal', desc: '常驻八向圣印,穿透涤荡' },
  // 第 10 神器「亡魂收割者」：由 scythe 武器 + greed(财富之魂) 被动进化。
  // 觉醒后 scythe 攻击追加撕裂 DOT(rend) 与收割回能；基础 scythe 不受影响（门控见 weapons.js/entities.js）。
  // rarity 取 normal：作为全新武器 scythe 的标准进化，图鉴显示配方「亡魂镰刀(满级) + 财富之魂」便于玩家探索。
  reaper: { id: 'reaper', name: '亡魂收割者', icon: 'art_reaper', baseWeapon: 'scythe', rarity: 'normal', desc: '镰刀命中撕裂伤口持续掉血,收割之敌归还生命' },
  // ===== v2.0 新神器（8 个，统一 rarity:'normal'，配方见 RECIPES；觉醒门控配对被动）=====
  fatalis:    { id: 'fatalis',    name: '命运星轨',   icon: 'art_fatalis',    baseWeapon: 'starfall',  rarity: 'normal', desc: '星铁永追不舍,暴击迸射追命碎片' },
  retribution: { id: 'retribution', name: '断罪终焉',   icon: 'art_retribution', baseWeapon: 'judgment', rarity: 'normal', desc: '断罪十字爆裂,残血者立遭处决' },
  mirage:     { id: 'mirage',     name: '幻影千袭',   icon: 'art_mirage',     baseWeapon: 'phantom',   rarity: 'normal', desc: '幻影千袭,碎片残留魅影持续灼烧' },
  bastion:    { id: 'bastion',    name: '永恒壁垒',   icon: 'art_bastion',    baseWeapon: 'aegis',     rarity: 'normal', desc: '壁垒不破,护盾下哨卫伤害化为屏障' },
  sentinel:   { id: 'sentinel',   name: '回响守望',   icon: 'art_sentinel',   baseWeapon: 'warden',    rarity: 'normal', desc: '回响永续,法球脉动向你输送护盾' },
  cataclysm:  { id: 'cataclysm',  name: '碎甲天罚',   icon: 'art_cataclysm',  baseWeapon: 'maul',      rarity: 'normal', desc: '天罚随甲生威,冲击波击退硬直' },
  bloodpact:  { id: 'bloodpact',  name: '血契荆棘',   icon: 'art_bloodpact',  baseWeapon: 'sanguine',  rarity: 'normal', desc: '血契成,吸血化热,溢血成盾' },
  absolution: { id: 'absolution',  name: '镇魂赦令',   icon: 'art_absolution', baseWeapon: 'resolve',   rarity: 'normal', desc: '镇魂赦令,立于符文中伤减更甚' },
};

// ---------- 合成配方 ----------
export const RECIPES = [
  { weapon: 'blade', passive: 'boots', artifact: 'storm' },
  { weapon: 'holywater', passive: 'magnet', artifact: 'devour' },
  { weapon: 'axe', passive: 'heart', artifact: 'spiral' },
  { weapon: 'lightning', passive: 'tome', artifact: 'stormcall' },
  { weapon: 'blade', passive: 'tome', artifact: 'crimson' },
  { weapon: 'lightning', passive: 'boots', artifact: 'tempest' },
  // 武器丰富化新增配方（2026-07-23）
  { weapon: 'aura', passive: 'heart', artifact: 'sepulcher' },
  { weapon: 'whip', passive: 'boots', artifact: 'eternalwhip' },
  { weapon: 'cross', passive: 'tome', artifact: 'matrix' },
  // 第 10 神器「亡魂收割者」：镰刀武器 + 贪婪之魂(财富之魂) 进化
  { weapon: 'scythe', passive: 'greed', artifact: 'reaper' },
  // ===== v2.0 神器扩充：8 套新配方，passive 取自 8 个此前无搭配被动（1:1 配对，不与已占用被动 boots/magnet/heart/tome/greed 冲突）=====
  { weapon: 'starfall',  passive: 'critrate',   artifact: 'fatalis' },
  { weapon: 'judgment',  passive: 'critdmg',    artifact: 'retribution' },
  { weapon: 'phantom',   passive: 'dodge',      artifact: 'mirage' },
  { weapon: 'aegis',     passive: 'shield',     artifact: 'bastion' },
  { weapon: 'warden',    passive: 'shieldregen', artifact: 'sentinel' },
  { weapon: 'maul',      passive: 'armor',      artifact: 'cataclysm' },
  { weapon: 'sanguine',  passive: 'regen',      artifact: 'bloodpact' },
  { weapon: 'resolve',   passive: 'guard',      artifact: 'absolution' },
];

const COLLECTION_KEY = 'night_survivors_collection';

export function loadCollection() {
  try {
    const raw = localStorage.getItem(COLLECTION_KEY);
    return raw ? JSON.parse(raw) : { unlocked: [] };
  } catch {
    return { unlocked: [] };
  }
}

export function saveCollection(c) {
  try { localStorage.setItem(COLLECTION_KEY, JSON.stringify(c)); } catch { /* ignore */ }
}

export function unlockInCollection(id) {
  const c = loadCollection();
  if (!c.unlocked.includes(id)) {
    c.unlocked.push(id);
    saveCollection(c);
  }
}

// ---------- Boss ----------
export const BOSSES = [
  // ---------- v4.0 P2 新 Boss（仅用现有 6 种 skill type：summon/barrage/dash/
  // summon_barrage/dash_barrage/enrage，无新增 type）。全部 [待真机校准]。----------
  // ★ 血月先驱（教学型小 Boss，90s）：游戏中第一次出现弹幕，刻意"打不死你但教会你"
  {
    id: 'herald', name: '血月先驱', sprite: 'herald', unlockAt: 90,
    hp: 700, speed: 40, damage: 26, exp: 60,
    radius: 28, spriteSize: 104, knockResist: 0.90,
    skills: [
      { at: 0.80, cooldown: 7, type: 'summon', enemyType: 'bat', count: 3 },
      { at: 0.45, cooldown: 6, type: 'barrage', count: 5, speed: 120, damage: 12, waves: 1 },
    ],
  },
  {
    id: 'baron', name: '血色男爵', sprite: 'boss_baron', unlockAt: 180,
    hp: 1800, speed: 38, damage: 40, exp: 120,
    radius: 34, spriteSize: 128, knockResist: 0.98,
    skills: [
      { at: 0.7, cooldown: 6, type: 'summon', enemyType: 'bat', count: 4 },
      { at: 0.4, cooldown: 5, type: 'barrage', count: 8, speed: 150, damage: 20, waves: 3 },
    ],
  },
  // ★ 腐血炼金术士（场地污染 Boss，270s）：召唤 plague_bearer 铺满毒池，打得越久场地越小
  {
    id: 'alchemist', name: '腐血炼金术士', sprite: 'alchemist', unlockAt: 270,
    hp: 3000, speed: 36, damage: 46, exp: 200,
    radius: 34, spriteSize: 132, knockResist: 0.98,
    skills: [
      { at: 0.85, cooldown: 6, type: 'summon', enemyType: 'plague_bearer', count: 3 },
      { at: 0.55, cooldown: 5.5, type: 'summon_barrage', enemyType: 'spitter', count: 2, barrageCount: 9, speed: 145, damage: 22, waves: 2 },
      { at: 0.25, cooldown: 7, type: 'enrage', speedMul: 1.5, once: true },
    ],
  },
  {
    id: 'queen', name: '苍白女王', sprite: 'boss_queen', unlockAt: 360,
    hp: 4500, speed: 42, damage: 55, exp: 300,
    radius: 36, spriteSize: 140, knockResist: 0.98,
    skills: [
      { at: 0.6, cooldown: 5, type: 'dash', speedMul: 4.2, duration: 0.5, damage: 20 },
      { at: 0.3, cooldown: 5, type: 'summon_barrage', enemyType: 'skeleton', count: 3, barrageCount: 10, speed: 160, damage: 24, waves: 3 },
    ],
  },
  // ★ 骨戈战将（综合考试 Boss，450s）：全游戏冷却最短冲锋 + 正面减伤骸骨骑士
  {
    id: 'warlord', name: '骨戈战将', sprite: 'warlord', unlockAt: 450,
    hp: 6200, speed: 44, damage: 60, exp: 400,
    radius: 36, spriteSize: 142, knockResist: 0.98,
    skills: [
      { at: 0.80, cooldown: 5.5, type: 'summon', enemyType: 'bone_knight', count: 3 },
      { at: 0.50, cooldown: 4.5, type: 'dash', speedMul: 4.8, duration: 0.55, damage: 26 },
      { at: 0.30, cooldown: 6, type: 'summon_barrage', enemyType: 'bone_knight', count: 2, barrageCount: 10, speed: 165, damage: 28, waves: 3 },
    ],
  },
  {
    id: 'overlord', name: '永夜君王', sprite: 'boss_overlord', unlockAt: 540,
    hp: 9000, speed: 46, damage: 70, exp: 600,
    radius: 40, spriteSize: 156, knockResist: 0.99,
    skills: [
      { at: 0.75, cooldown: 6, type: 'summon', enemyType: 'bat', count: 5 },
      { at: 0.5, cooldown: 5, type: 'dash_barrage', speedMul: 4.5, duration: 0.5, barrageCount: 12, speed: 170, damage: 30, waves: 3 },
      { at: 0.25, cooldown: 8, type: 'enrage', speedMul: 1.6, once: true },
    ],
  },
  // 终局 Boss：永夜化身（12 分钟降临，击杀=通关结算）。三段变身见 GDD §3.3
  {
    id: 'avatar', name: '永夜化身', sprite: 'boss_avatar', unlockAt: 99999,
    hp: 15000, speed: 50, damage: 80, exp: 1000,
    radius: 44, spriteSize: 168, knockResist: 0.99,
    isEndgame: true,
    skills: [
      { at: 0.70, cooldown: 5, type: 'summon', enemyType: 'shadow_hunter', count: 5 },
      { at: 0.70, cooldown: 5, type: 'barrage', count: 12, speed: 160, damage: 26, waves: 3 },
      { at: 0.35, cooldown: 5, type: 'dash_barrage', speedMul: 4.2, duration: 0.5, barrageCount: 12, speed: 170, damage: 30, waves: 3 },
      { at: 0.35, cooldown: 7, type: 'summon', enemyType: 'gargoyle', count: 3 },
      { at: 0.15, cooldown: 6, type: 'enrage', speedMul: 1.6, once: true },
      { at: 0.15, cooldown: 6, type: 'summon', enemyType: 'slime', count: 4, affix: 'volatile' },
    ],
  },
];

if (typeof window !== 'undefined') window.__bosses = BOSSES;
if (typeof window !== 'undefined') window.__artifacts = ARTIFACTS;
