export const CONFIG = {
  LOGICAL_WIDTH: 960,
  LOGICAL_HEIGHT: 540,
  TILE: 256,
  PLAYER_RADIUS: 14,
  PLAYER_SPRITE: 46,
  ENEMY_CAP: 400,
  GRID_CELL: 64,
  BEST_KEY: 'night_survivors_best',
};

export const ENEMY_TYPES = {
  bat: {
    sprite: 'bat', hp: 12, speed: 95, damage: 8, exp: 1,
    radius: 12, spriteSize: 34, knockResist: 0, unlockAt: 0, weight: 3,
  },
  skeleton: {
    sprite: 'skeleton', hp: 34, speed: 52, damage: 14, exp: 2,
    radius: 14, spriteSize: 42, knockResist: 0.3, unlockAt: 45, weight: 2,
  },
  slime: {
    sprite: 'slime', hp: 90, speed: 30, damage: 20, exp: 5,
    radius: 18, spriteSize: 54, knockResist: 0.7, unlockAt: 120, weight: 1,
  },
  elite: {
    sprite: 'elite', hp: 650, speed: 42, damage: 32, exp: 40,
    radius: 26, spriteSize: 96, knockResist: 0.95, unlockAt: 180, weight: 0,
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
      { damage: 11, cooldown: 3.0, count: 1, radius: 70, duration: 2.6, tick: 0.5 },
      { damage: 14, cooldown: 2.8, count: 2, radius: 78, duration: 2.8, tick: 0.5 },
      { damage: 18, cooldown: 2.6, count: 2, radius: 88, duration: 3.0, tick: 0.45 },
      { damage: 24, cooldown: 2.3, count: 3, radius: 100, duration: 3.4, tick: 0.4 },
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
};

export const PASSIVES = {
  boots: { id: 'boots', name: '疾行之靴', icon: 'player', maxLevel: 5, desc: '移动速度 +8%', apply: (p) => { p.speedMul += 0.08; } },
  heart: { id: 'heart', name: '巨人之心', icon: 'gemLarge', maxLevel: 5, desc: '生命上限 +20,并回复 20', apply: (p) => { p.maxHp += 20; p.hp = Math.min(p.maxHp, p.hp + 20); } },
  tome: { id: 'tome', name: '秘法魔典', icon: 'lightning', maxLevel: 5, desc: '所有伤害 +10%', apply: (p) => { p.damageMul += 0.1; } },
  magnet: { id: 'magnet', name: '引力宝珠', icon: 'gemMedium', maxLevel: 5, desc: '拾取范围 +25%', apply: (p) => { p.magnetMul += 0.25; } },
};

export function expForLevel(level) {
  return Math.floor(5 + (level - 1) * 4 + Math.pow(level - 1, 1.7) * 2);
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

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
