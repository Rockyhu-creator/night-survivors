export const CONFIG = {
  LOGICAL_WIDTH: 960,
  LOGICAL_HEIGHT: 540,
  TILE: 256,
  PLAYER_RADIUS: 14,
  PLAYER_SPRITE: 46,
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
  { id: 'soul_dual',name: '双生武装', icon: 'altar_dual', cost: 220, desc: '开局额外获得「圣水洗礼」',     apply: (g) => { g.weapons.addWeapon('holywater'); } },
  // S3 槽位上限扩容：花灵魂永久 +1 槽（上限 7），深化长期循环
  { id: 'soul_slot_weapon',  name: '扩容武器槽', icon: 'altar_slot_weapon',  cost: 150, desc: '武器槽 +1（永久，上限 7）',  apply: (g) => { g.player.maxWeapons += 1; } },
  { id: 'soul_slot_passive', name: '扩容被动槽', icon: 'altar_slot_passive', cost: 150, desc: '被动槽 +1（永久，上限 7）',  apply: (g) => { g.player.maxPassives += 1; } },
];
if (typeof window !== 'undefined') window.__altar = ALTAR;

// 难度配置：hpSlope/dmgSlope=线性段敌我成长斜率；spawnMul=刷怪频率倍率；
// bossCalm=boss存活时刷怪比例；bossGapMul=boss间隔倍率；
// nightBase=永夜指数底数(敌人在永夜阶段HP/伤害乘 1.35^D 等)；artifactCounter=神器反制系数；
// bossHpMul=终局Boss基础HP缩放；affixMul=词缀怪出现概率倍率；packMin/Max=狼群规模；
// expMul=难度经验补偿(硬难度击杀慢，补偿升级频率)；soulMul=灵魂倍率(高难高回报)
// 2026-07 难度下修 [PLACEHOLDER 待真机验证]：原三档敌人成长斜率远超玩家离散升级的成长，
// 中期形成"清不动→吃不到经验→更打不动"的死亡螺旋。全面放缓 hp/dmg/spawn 线性曲线。
// 2026-07-24 终局平衡：三难度保持结构一致(同机制同公式)，仅数值区分(见 GDD §6)。
export const DIFFICULTIES = {
  easy: {
    id: 'easy', name: '夜行者', desc: '敌人较弱,节奏舒缓,适合休闲上手',
    hpSlope: 0.18, dmgSlope: 0.10, spawnMul: 0.55, bossCalm: 0.3, bossGapMul: 1.5,
    nightBase: 1.12, artifactCounter: 0.08, bossHpMul: 0.7, affixMul: 0.5,
    packMin: 4, packMax: 6, expMul: 1.0, soulMul: 0.8,
    bossSkillCdMul: 1.3, // 高难<1 缩短 Boss 技能 CD、低难>1 延长
  },
  normal: {
    id: 'normal', name: '狩猎者', desc: '标准难度,挑战与乐趣并存',
    hpSlope: 0.26, dmgSlope: 0.14, spawnMul: 0.70, bossCalm: 0.5, bossGapMul: 1.0,
    nightBase: 1.22, artifactCounter: 0.15, bossHpMul: 1.0, affixMul: 1.0,
    packMin: 6, packMax: 10, expMul: 1.0, soulMul: 1.0,
    bossSkillCdMul: 1.0,
  },
  hard: {
    id: 'hard', name: '永夜', desc: '敌人凶猛,怪潮汹涌,仅限高手',
    hpSlope: 0.38, dmgSlope: 0.18, spawnMul: 0.85, bossCalm: 0.7, bossGapMul: 0.85,
    nightBase: 1.32, artifactCounter: 0.25, bossHpMul: 1.4, affixMul: 1.20,
    packMin: 6, packMax: 10, expMul: 1.3, soulMul: 1.5,
    bossSkillCdMul: 0.75,
  },
};

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
    name: '夜行蝙蝠', sprite: 'bat', hp: 12, speed: 95, damage: 8, exp: 1,
    radius: 12, spriteSize: 34, knockResist: 0, unlockAt: 0, weight: 3,
  },
  skeleton: {
    name: '骷髅', sprite: 'skeleton', hp: 34, speed: 52, damage: 14, exp: 2,
    radius: 14, spriteSize: 42, knockResist: 0.3, unlockAt: 45, weight: 2,
  },
  slime: {
    name: '史莱姆', sprite: 'slime', hp: 90, speed: 30, damage: 20, exp: 5,
    radius: 18, spriteSize: 54, knockResist: 0.7, unlockAt: 120, weight: 1,
  },
  elite: {
    name: '精英', sprite: 'elite', hp: 650, speed: 42, damage: 32, exp: 40,
    radius: 26, spriteSize: 96, knockResist: 0.95, unlockAt: 180, weight: 0,
  },
  // 后期新怪（永夜阶段解锁）
  shadow_hunter: {
    name: '暗影猎手', sprite: 'shadow_hunter', hp: 120, speed: 80, damage: 25, exp: 8,
    radius: 14, spriteSize: 40, knockResist: 0.2, unlockAt: 540, weight: 2,
    // 行为：进入 250px 后蓄力 dashCharge 秒，再以 dashSpeed×速度冲刺
    dashRange: 250, dashCharge: 0.5, dashSpeed: 3,
  },
  gargoyle: {
    name: '石像鬼', sprite: 'gargoyle', hp: 500, speed: 20, damage: 22, exp: 15,
    radius: 26, spriteSize: 96, knockResist: 1.0, unlockAt: 600, weight: 1,
    immuneKnockback: true,
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
    id: 'shielded', name: '护盾', expMul: 2, color: '#3498db',
    // 受到的伤害 ×0.3（正面180°减伤70%的完整版留 PLACEHOLDER，先用全时减伤简化）
    dmgTakenMul: 0.3,
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
    desc: '埋设镇魂符文,敌人踏入即引爆', mech: 'rune', visual: 'resolve',
    levels: [
      { damage: 18, cooldown: 3.0, count: 1, triggerRange: 28, burstRadius: 70,  deployRange: 140, duration: 8,  maxRunes: 8 },
      { damage: 23, cooldown: 2.8, count: 1, triggerRange: 30, burstRadius: 80,  deployRange: 150, duration: 9,  maxRunes: 8 },
      { damage: 29, cooldown: 2.6, count: 2, triggerRange: 32, burstRadius: 90,  deployRange: 160, duration: 10, maxRunes: 10 },
      { damage: 36, cooldown: 2.4, count: 2, triggerRange: 34, burstRadius: 100, deployRange: 170, duration: 11, maxRunes: 10 },
      { damage: 44, cooldown: 2.2, count: 2, triggerRange: 36, burstRadius: 110, deployRange: 180, duration: 12, maxRunes: 12 },
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
    desc: '圣水起手 · 范围与持续 +20%',
    weapon: 'holywater', cost: 80, hidden: false,
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
    desc: '无武器起手 · 高难高回报: 伤害+30% · 移速+25% · 冷却-25% · 生命-20%',
    weapon: null, cost: 260, hidden: true,
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

export function loadSouls() {
  try {
    const raw = localStorage.getItem(SOUL_KEY);
    const o = raw ? JSON.parse(raw) : null;
    return {
      balance: o?.balance || 0,
      spent: o?.spent || 0,
      unlocks: o?.unlocks || [],
      cleared: o?.cleared || [],
      bloodlines: o?.bloodlines || ['wanderer'],
      selectedBloodline: o?.selectedBloodline || 'wanderer',
    };
  } catch {
    return { balance: 0, spent: 0, unlocks: [], cleared: [], bloodlines: ['wanderer'], selectedBloodline: 'wanderer' };
  }
}

export function saveSouls(s) {
  try { localStorage.setItem(SOUL_KEY, JSON.stringify(s)); } catch { /* ignore */ }
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
  {
    id: 'baron', name: '血色男爵', sprite: 'boss_baron', unlockAt: 180,
    hp: 1800, speed: 38, damage: 40, exp: 120,
    radius: 34, spriteSize: 128, knockResist: 0.98,
    skills: [
      { at: 0.7, cooldown: 6, type: 'summon', enemyType: 'bat', count: 4 },
      { at: 0.4, cooldown: 5, type: 'barrage', count: 8, speed: 150, damage: 20, waves: 3 },
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
