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
};

// ---------- 灵魂货币（长期循环 / 元进度）----------
// Sources（单局结算发放，全部 [PLACEHOLDER] 待真机校准）：
//   存活每 30s +1 / 击杀每 20 +1 / 每等级 +1 / 每 Boss +25 / 难度首通一次性奖励
// Sinks：祭坛永久解锁（见 ALTAR 表）。防通胀：单局上限 ~150，真机按 metric 调。
export const SOUL_REWARDS = {
  per30s: 1,        // 每存活 30 秒
  per20Kills: 1,    // 每 20 击杀
  perLevel: 1,      // 每等级
  perBoss: 25,      // 每个 Boss
  firstClear: { easy: 30, normal: 50, hard: 80 }, // 难度首通（仅一次，收敛防通胀）
};

// 祭坛解锁表：永久增益，花灵魂购买。apply(game) 在 startRun 注入。
// cost 全部 [PLACEHOLDER]，真机按投放速率与通胀阈值调。
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
    nightBase: 1.22, artifactCounter: 0.08, bossHpMul: 0.7, affixMul: 0.5,
    packMin: 4, packMax: 6, expMul: 1.0, soulMul: 0.8,
  },
  normal: {
    id: 'normal', name: '狩猎者', desc: '标准难度,挑战与乐趣并存',
    hpSlope: 0.26, dmgSlope: 0.15, spawnMul: 0.80, bossCalm: 0.5, bossGapMul: 1.0,
    nightBase: 1.35, artifactCounter: 0.15, bossHpMul: 1.0, affixMul: 1.0,
    packMin: 6, packMax: 10, expMul: 1.0, soulMul: 1.0,
  },
  hard: {
    id: 'hard', name: '永夜', desc: '敌人凶猛,怪潮汹涌,仅限高手',
    hpSlope: 0.38, dmgSlope: 0.22, spawnMul: 1.05, bossCalm: 0.7, bossGapMul: 0.85,
    nightBase: 1.50, artifactCounter: 0.25, bossHpMul: 1.4, affixMul: 1.75,
    packMin: 8, packMax: 14, expMul: 1.3, soulMul: 1.5,
  },
};

// 终局时间节点（秒）
export const NIGHT_START = 540;   // 9 分钟：永夜加深触发
export const ENDGAME_BOSS_TIME = 900; // 15 分钟：永夜化身降临

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
    name: '暗影猎手', sprite: 'bat', hp: 120, speed: 80, damage: 25, exp: 8,
    radius: 14, spriteSize: 40, knockResist: 0.2, unlockAt: 540, weight: 2,
    // 行为：进入 250px 后蓄力 dashCharge 秒，再以 dashSpeed×速度冲刺
    dashRange: 250, dashCharge: 0.5, dashSpeed: 3, tint: '#9b59b6',
  },
  gargoyle: {
    name: '石像鬼', sprite: 'elite', hp: 500, speed: 20, damage: 22, exp: 15,
    radius: 26, spriteSize: 96, knockResist: 1.0, unlockAt: 600, weight: 1,
    immuneKnockback: true, tint: '#7f8c8d',
  },
};
if (typeof window !== 'undefined') window.__enemyTypes = ENEMY_TYPES;

// 词缀（叠加在现有怪上，制造行为多样化，低成本高产出）
export const AFFIXES = {
  pack: {
    id: 'pack', name: '狼群', expMul: 2, color: '#aab7c4',
    // 从同一方向一次刷 packCount 只，扇形包抄。packCount 取难度 packMin/Max
  },
  volatile: {
    id: 'volatile', name: '爆破', expMul: 1.6, color: '#e67e22',
    // 死亡时对玩家造成爆炸范围伤害
    blastRadius: 70, blastDamage: 18, // [PLACEHOLDER]
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
  // 以下 3 把为武器丰富化新增（2026-07-23），机制形态与现有 4 把正交。数值 [PLACEHOLDER] 待真机校准
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
};

if (typeof window !== 'undefined') window.__weapons = WEAPONS;

export const PASSIVES = {
  boots: { id: 'boots', name: '疾行之靴', icon: 'passive_boots', maxLevel: 5, desc: '移动速度 +8%', apply: (p) => { p.speedMul += 0.08; } },
  heart: { id: 'heart', name: '巨人之心', icon: 'passive_heart', maxLevel: 5, desc: '生命上限 +20,并回复 20', apply: (p) => { p.maxHp += 20; p.hp = Math.min(p.maxHp, p.hp + 20); } },
  tome: { id: 'tome', name: '秘法魔典', icon: 'passive_tome', maxLevel: 5, desc: '所有伤害 +10%', apply: (p) => { p.damageMul += 0.1; } },
  magnet: { id: 'magnet', name: '引力宝珠', icon: 'passive_magnet', maxLevel: 5, desc: '拾取范围 +25%', apply: (p) => { p.magnetMul += 0.25; } },
  // 无限成长被动：20+ 级后期每次升级依然有意义
  rage: { id: 'rage', name: '战斗狂热', icon: 'passive_rage', maxLevel: 99, desc: '所有伤害 +3%', apply: (p) => { p.damageMul += 0.03; } },
  swift: { id: 'swift', name: '极速猎手', icon: 'passive_swift', maxLevel: 99, desc: '移动速度 +3%', apply: (p) => { p.speedMul += 0.03; } },
  greed: { id: 'greed', name: '财富之魂', icon: 'passive_greed', maxLevel: 99, desc: '经验获取 +8%', apply: (p) => { p.expMul += 0.08; } },
  guard: { id: 'guard', name: '钢铁意志', icon: 'passive_guard', maxLevel: 99, desc: '受到伤害 -2%', apply: (p) => { p.damageTakenMul = Math.max(0.3, (p.damageTakenMul || 1) * 0.98); } },
  // 续航被动：与血瓶掉落互补，解决"掉血不可逆"的核心挫败。0.8/级 [PLACEHOLDER] 满级 4 HP/s
  regen: { id: 'regen', name: '血色再生', icon: 'potion', maxLevel: 5, desc: '每秒回复 0.8 生命', apply: (p) => { p.regenRate = (p.regenRate || 0) + 0.8; } },
};

export function expForLevel(level) {
  return Math.floor(4 + (level - 1) * 3 + Math.pow(level - 1, 1.7) * 2);
}

// 经验时间缩放：保证后期升级频率不衰减。1 + (t/60)*0.08 → 10min×1.8, 15min×2.6
// [PLACEHOLDER] 系数 0.08 待真机校准
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
// 数值全部 [PLACEHOLDER]：cost 为解锁价、偏向幅度按设计文档假设，真机试玩后调。
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
  crimson: { id: 'crimson', name: '猩红之拥', icon: 'art_crimson', baseWeapon: 'blade', rarity: 'hidden', desc: '飞刃命中回复 1 点生命,伤害翻倍' },
  tempest: { id: 'tempest', name: '雷劫', icon: 'art_tempest', baseWeapon: 'lightning', rarity: 'hidden', desc: '你行经之处,落雷不绝' },
  // 以下 3 个为武器丰富化新增进化神器（2026-07-23）
  sepulcher: { id: 'sepulcher', name: '寂灭结界', icon: 'art_sepulcher', baseWeapon: 'aura', rarity: 'normal', desc: '光环暴涨并迸射骨刺,绞杀周遭' },
  eternalwhip: { id: 'eternalwhip', name: '永劫之鞭', icon: 'art_eternalwhip', baseWeapon: 'whip', rarity: 'normal', desc: '三向齐扫,横扫千军' },
  matrix: { id: 'matrix', name: '圣光矩阵', icon: 'art_matrix', baseWeapon: 'cross', rarity: 'normal', desc: '常驻八向圣印,穿透涤荡' },
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
      { at: 0.7, type: 'summon', enemyType: 'bat', count: 4 },
      { at: 0.4, type: 'barrage', count: 8, speed: 130, damage: 15 },
    ],
  },
  {
    id: 'queen', name: '苍白女王', sprite: 'boss_queen', unlockAt: 360,
    hp: 4500, speed: 42, damage: 55, exp: 300,
    radius: 36, spriteSize: 140, knockResist: 0.98,
    skills: [
      { at: 0.6, type: 'dash', speedMul: 4.2, duration: 0.5, damage: 20 },
      { at: 0.3, type: 'summon_barrage', enemyType: 'skeleton', count: 3, barrageCount: 10, speed: 140, damage: 18 },
    ],
  },
  {
    id: 'overlord', name: '永夜君王', sprite: 'boss_overlord', unlockAt: 540,
    hp: 9000, speed: 46, damage: 70, exp: 600,
    radius: 40, spriteSize: 156, knockResist: 0.99,
    skills: [
      { at: 0.75, type: 'summon', enemyType: 'bat', count: 5 },
      { at: 0.5, type: 'dash_barrage', speedMul: 4.5, duration: 0.5, barrageCount: 12, speed: 150, damage: 22 },
      { at: 0.25, type: 'enrage', speedMul: 1.6 },
    ],
  },
  // 终局 Boss：永夜化身（15 分钟降临，击杀=通关结算）。三段变身见 GDD §3.3
  {
    id: 'avatar', name: '永夜化身', sprite: 'boss_overlord', unlockAt: 99999,
    hp: 15000, speed: 50, damage: 80, exp: 1000,
    radius: 44, spriteSize: 168, knockResist: 0.99,
    isEndgame: true,
    skills: [
      { at: 0.7, type: 'summon', enemyType: 'shadow_hunter', count: 5 },
      { at: 0.7, type: 'barrage', count: 12, speed: 140, damage: 18 },
      { at: 0.35, type: 'dash_barrage', speedMul: 4.2, duration: 0.5, barrageCount: 12, speed: 150, damage: 22 },
      { at: 0.35, type: 'summon', enemyType: 'gargoyle', count: 3 },
      { at: 0.15, type: 'enrage', speedMul: 1.6 },
      { at: 0.15, type: 'summon', enemyType: 'slime', count: 4, affix: 'volatile' },
    ],
  },
];

if (typeof window !== 'undefined') window.__bosses = BOSSES;
