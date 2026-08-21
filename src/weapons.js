import { WEAPONS, CONFIG } from './data.js';
import { sprite } from './assets.js';

// 跨设备一致的瞄准半径：取桌面端可视半对角线（960×540 → ≈550）。
// 手机端竖屏锁定后可视范围更窄，统一用此上限，避免「手机打屏外敌人、电脑打最近」的差异。
const TARGET_RADIUS = 540;

// 永劫之鞭（eternalwhip）「熔金黑鞭」专属配色：仅渲染层 tint 使用，无需新 PNG。
// body=鞭身主色(熔金琥珀) / edge=深渊青铜描边(核心辨识) / tip=白热尖端 / trail·spark 备未来用。
const ETERNALWHIP_TINT = { body:'#ffb847', edge:'#4a2f12', tip:'#fff1c9', trail:'#d4af37', spark:'#f1c40f', sparkHot:'#fff1c9', dmg:'#e0a93b' };

// 圣光矩阵觉醒投射物辉光：一次性缓存的径向渐变贴图，加法合成替代逐帧 shadowBlur（性能修复）。
// 原理同 systems.js 宝箱辉光——shadowBlur 是 Canvas2D 头号性能杀手（O(面积) 模糊），dpr=2 下模糊面积×4 → 严重掉帧。
let _matrixGlowSprite = null;
function getMatrixGlowSprite() {
  if (_matrixGlowSprite) return _matrixGlowSprite;
  const s = 96;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(s / 2, s / 2, 3, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(255,210,74,0.95)');
  grad.addColorStop(0.45, 'rgba(255,210,74,0.35)');
  grad.addColorStop(1, 'rgba(255,210,74,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  _matrixGlowSprite = c;
  return c;
}

// 统一辉光贴图缓存：所有神器光晕走离屏缓存 + 加法合成，彻底规避逐帧 shadowBlur（性能红线）。
const _glowCache = new Map();
function getGlowSprite(key, size, color) {
  const ck = key + '_' + size + '_' + color;
  if (_glowCache.has(ck)) return _glowCache.get(ck);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
    _glowCache.set(ck, c); return c;
  }

  // v2.2 子弹/形态差异化：每种武器+神器独立剪影，离屏缓存一次渲染（性能安全：无逐帧 path 重描、无 shadowBlur、无分配）。
  // 每个 shapeKey 对应一个「在 size×size 画布中心用 col 画剪影」的函数；getShapeSprite 仅首次渲染并缓存，每帧只 drawImage+旋转。
  const SHAPE_DRAWERS = {
    // 星陨：八方星芒
    star(g, s, col) {
      const c = s / 2; g.fillStyle = col;
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2, r1 = s * 0.46, r2 = s * 0.15;
        g.beginPath();
        g.moveTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
        g.lineTo(c + Math.cos(a + 0.20) * r2, c + Math.sin(a + 0.20) * r2);
        g.lineTo(c + Math.cos(a + Math.PI / 4) * r2, c + Math.sin(a + Math.PI / 4) * r2);
        g.lineTo(c + Math.cos(a + Math.PI / 4 - 0.20) * r2, c + Math.sin(a + Math.PI / 4 - 0.20) * r2);
        g.closePath(); g.fill();
      }
      g.beginPath(); g.arc(c, c, s * 0.12, 0, Math.PI * 2); g.fill();
    },
    // 终焉(觉醒)：带尾迹彗星
    comet(g, s, col) {
      const c = s / 2; g.fillStyle = col;
      g.beginPath(); g.moveTo(c, s * 0.06); g.lineTo(c + s * 0.12, s * 0.58); g.lineTo(c - s * 0.12, s * 0.58); g.closePath(); g.fill();
      g.beginPath(); g.arc(c, s * 0.42, s * 0.24, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(c, s * 0.40, s * 0.09, 0, Math.PI * 2); g.fill();
    },
    // 幻影：不对称碎晶
    shard(g, s, col) {
      const c = s / 2; g.fillStyle = col;
      g.beginPath(); g.moveTo(c, s * 0.06); g.lineTo(s * 0.82, s * 0.5); g.lineTo(c, s * 0.72); g.lineTo(s * 0.30, s * 0.62); g.lineTo(s * 0.18, s * 0.30); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.moveTo(c, s * 0.12); g.lineTo(s * 0.55, s * 0.5); g.lineTo(c, s * 0.6); g.closePath(); g.fill();
    },
    // 幻界(觉醒)：双重残影
    ghost(g, s, col) {
      const c = s / 2;
      g.globalAlpha = 0.55; g.fillStyle = col;
      g.beginPath(); g.moveTo(c - s * 0.04, s * 0.10); g.lineTo(s * 0.66, s * 0.5); g.lineTo(c - s * 0.04, s * 0.66); g.lineTo(s * 0.20, s * 0.55); g.closePath(); g.fill();
      g.globalAlpha = 0.9; g.fillStyle = col;
      g.beginPath(); g.moveTo(c + s * 0.10, s * 0.12); g.lineTo(s * 0.86, s * 0.52); g.lineTo(c + s * 0.10, s * 0.70); g.lineTo(s * 0.30, s * 0.58); g.closePath(); g.fill();
      g.globalAlpha = 1;
    },
    // 血怒：獠牙滴血
    fang(g, s, col) {
      const c = s / 2; g.fillStyle = col;
      g.beginPath(); g.moveTo(c, s * 0.08); g.lineTo(s * 0.78, s * 0.5); g.lineTo(c, s * 0.42); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(c, s * 0.42); g.lineTo(s * 0.34, s * 0.5); g.lineTo(c, s * 0.95); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.moveTo(c, s * 0.12); g.lineTo(s * 0.55, s * 0.5); g.lineTo(c, s * 0.42); g.closePath(); g.fill();
    },
    // 血契(觉醒)：血心
    bloodheart(g, s, col) {
      const c = s / 2; g.fillStyle = col;
      g.beginPath(); g.moveTo(c, s * 0.82);
      g.bezierCurveTo(s * 0.05, s * 0.40, s * 0.30, s * 0.10, c, s * 0.38);
      g.bezierCurveTo(s * 0.70, s * 0.10, s * 0.95, s * 0.40, c, s * 0.82);
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(s * 0.40, s * 0.34, s * 0.07, 0, Math.PI * 2); g.fill();
    },
    // 壁垒哨卫弹：晶棱弩矢
    bolt(g, s, col) {
      const c = s / 2; g.fillStyle = col;
      g.beginPath(); g.moveTo(s * 0.88, c); g.lineTo(c, s * 0.18); g.lineTo(s * 0.34, c); g.lineTo(c, s * 0.82); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.moveTo(s * 0.88, c); g.lineTo(c, s * 0.18); g.lineTo(c * 0.72, c); g.closePath(); g.fill();
    },
    // 永恒壁垒(觉醒)：六边结界矢
    ward(g, s, col) {
      const c = s / 2, R = s * 0.42; g.fillStyle = col; g.beginPath();
      for (let i = 0; i < 6; i += 1) { const a = (i / 6) * Math.PI * 2 - Math.PI / 2; const x = c + Math.cos(a) * R, y = c + Math.sin(a) * R; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(c, c, s * 0.12, 0, Math.PI * 2); g.fill();
    },
    // 守望法球弹：环纹能量球
    orbiter(g, s, col) {
      const c = s / 2; g.fillStyle = col; g.beginPath(); g.arc(c, c, s * 0.28, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = s * 0.06; g.beginPath(); g.arc(c, c, s * 0.40, 0, Math.PI * 2); g.stroke();
    },
    // 回响守望(觉醒)：眼形矢
    eyebolt(g, s, col) {
      const c = s / 2; g.fillStyle = col; g.beginPath(); g.ellipse(c, c, s * 0.44, s * 0.26, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0a0a0a'; g.beginPath(); g.arc(c, c, s * 0.15, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(c - s * 0.05, c - s * 0.04, s * 0.05, 0, Math.PI * 2); g.fill();
    },
  };
  const _shapeCache = new Map();
  function getShapeSprite(shapeKey, size, color) {
    if (!SHAPE_DRAWERS[shapeKey]) return null;
    const ck = shapeKey + '_' + size + '_' + color;
    if (_shapeCache.has(ck)) return _shapeCache.get(ck);
    const c = document.createElement('canvas'); c.width = c.height = size;
    SHAPE_DRAWERS[shapeKey](c.getContext('2d'), size, color);
    _shapeCache.set(ck, c);
    return c;
  }
  // 投射物形状映射：基础武器 → 基础剪影；觉醒(神器) → 更精致的神器剪影
  function projShape(visual, awakenId) {
    switch (visual) {
      case 'starfall': return awakenId === 'fatalis' ? 'comet' : 'star';
      case 'phantom': return awakenId === 'mirage' ? 'ghost' : 'shard';
      case 'sanguine': return awakenId === 'bloodpact' ? 'bloodheart' : 'fang';
      case 'aegis': return awakenId === 'bastion' ? 'ward' : 'bolt';
      case 'warden': return awakenId === 'sentinel' ? 'eyebolt' : 'orbiter';
      default: return null;
    }
  }

  // ===== v2.0 性能护栏（RL2）：生成桶硬上限 + oldest-first 回收 =====
  // 与 CONFIG 同源（CONFIG 已含 PROJECTILE_CAP/POOL_CAP/BOLT_CAP/SLASH_CAP/VIAL_CAP 等）；
  // 模块级常量便于武器内聚引用，避免热路径跨模块查找。
  const PROJECTILE_CAP = 600, POOL_CAP = 60, BOLT_CAP = 80, SLASH_CAP = 40, VIAL_CAP = 40;
  const MAX_SENTINELS  = CONFIG.MAX_SENTINELS;   // 6
  const MAX_ORBS       = CONFIG.MAX_ORBS;        // 8
  const MAX_SHOCKWAVES = CONFIG.MAX_SHOCKWAVES;  // 12
  const MAX_RUNES      = CONFIG.MAX_RUNES;       // 24
  const SPLIT_CAP_PER_HIT = CONFIG.SPLIT_CAP_PER_HIT; // 6
  const ORBIT_OMEGA    = CONFIG.ORBIT_OMEGA;     // 1.2 rad/s
  const MIRAGE_RESIDUE_CAP = 30;  // 幻影残留 AoE 实体上限
  const BURST_CAP      = 12;      // 瞬时爆裂环上限
  const STUN_DURATION  = 0.3;     // cataclysm 觉醒硬直时长

  // oldest-first 回收：桶满则丢弃最旧（shift）再 push，禁无界增长
  function capPush(arr, item, cap) {
    if (arr.length >= cap) arr.shift();
    arr.push(item);
  }

// 圣光矩阵八向星纹 sigil：8 条 spoke 预渲染一次（金 #f5d76e），玩家脚下每帧 additive 旋转绘制。
let _matrixSigilSprite = null;
function getMatrixSigilSprite() {
  if (_matrixSigilSprite) return _matrixSigilSprite;
  const s = 108;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.translate(s / 2, s / 2);
  const R = s / 2 - 4;
  g.strokeStyle = '#f5d76e';
  g.lineWidth = 3;
  g.lineCap = 'round';
  for (let i = 0; i < 8; i += 1) {
    const ang = (i / 8) * Math.PI * 2;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(Math.cos(ang) * R, Math.sin(ang) * R);
    g.stroke();
  }
  g.fillStyle = '#f5d76e';
  g.beginPath(); g.arc(0, 0, 5, 0, Math.PI * 2); g.fill();
  _matrixSigilSprite = c;
  return c;
}

// 亡魂收割者（reaper）撕裂 DOT 初值 [PLACEHOLDER 待真机校准]：
// REND_DPS 为基础每秒伤害（实际施加时再乘 player.damageMul，随 build 成长）；
// REND_DURATION 为单次撕裂持续秒数（命中会刷新）。
const REND_DPS = 16;
const REND_DURATION = 3;

// ===== v2.0 神器扩充：配色锚点 + 机制/觉醒查表（RL1/RL4：辉光全走缓存 sprite）=====
// VISUAL_PRESETS 以「武器 visual 键」为索引，提供投射物渲染用的主色与缓存辉光参数；
// 神器觉醒投射物用自身 glowKey 覆盖（fatalis/mirage/...），主色更亮一档。
const VISUAL_PRESETS = {
  starfall:  { color: '#caa23a', glowKey: 'starfall',  glowColor: 'rgba(255,207,77,0.9)',  glowSize: 44, spriteKey: 'weapon_starfall' },
  judgment:  { color: '#ff5a5a', glowKey: 'judgment',  glowColor: 'rgba(255,90,90,0.9)',   glowSize: 56, spriteKey: 'weapon_judgment' },
  phantom:   { color: '#9b6cff', glowKey: 'phantom',   glowColor: 'rgba(155,108,255,0.9)', glowSize: 40, spriteKey: 'weapon_phantom' },
  aegis:     { color: '#7fd4ff', glowKey: 'aegis',     glowColor: 'rgba(127,212,255,0.9)', glowSize: 48, spriteKey: 'weapon_aegis' },
  warden:    { color: '#6cffb0', glowKey: 'warden',    glowColor: 'rgba(108,255,176,0.9)', glowSize: 48, spriteKey: 'weapon_warden' },
  maul:      { color: '#ff9a3c', glowKey: 'maul',      glowColor: 'rgba(255,154,60,0.9)',  glowSize: 52, spriteKey: 'weapon_maul' },
  sanguine:  { color: '#ff3b5c', glowKey: 'sanguine',  glowColor: 'rgba(255,59,92,0.9)',   glowSize: 44, spriteKey: 'weapon_sanguine' },
  resolve:   { color: '#e8d8a0', glowKey: 'resolve',   glowColor: 'rgba(232,216,160,0.9)', glowSize: 52, spriteKey: 'weapon_resolve' },
};
// 神器觉醒主色（比武器更亮一档，渲染区分于基础形态）
const ARTIFACT_TINT = {
  fatalis: '#ffcf4d', retribution: '#ff7a7a', mirage: '#b98cff', bastion: '#a9e6ff',
  sentinel: '#9affce', cataclysm: '#ffb46c', bloodpact: '#ff6f88', absolution: '#f3e8c0',
};
// 取辉光/主色参数：artGlowKey 优先（神器用自身 glow 缓存键，避免与基础形态同 key 串色）
function applyVisual(p, visual, artGlowKey) {
  const v = VISUAL_PRESETS[visual];
  p.color = v.color;
  p.glowKey = artGlowKey || v.glowKey;
  p.glowColor = v.glowColor;
  p.glowSize = v.glowSize;
  p.spriteKey = v.spriteKey;
}

// 新武器机制查表：新武器走此表，既有 8 武器保持原 fire() if/else 路径不变（防回归）
const MECH_FIRE = {
  homing(ws, weapon, s) { ws.fireHoming(weapon, s, false); },
  thrust(ws, weapon, s) { ws.fireThrust(weapon, s, false); },
  splitting(ws, weapon, s) { ws.fireSplitting(weapon, s, false); },
  sentinel(ws, weapon, s) { ws.fireSentinel(weapon, s); },
  orb(ws, weapon, s) { ws.fireOrb(weapon, s); },
  shockwave(ws, weapon, s) { ws.fireShockwave(weapon, s, false); },
  lifesteal(ws, weapon, s) { ws.fireLifesteal(weapon, s, false); },
  rune(ws, weapon, s) { ws.fireRune(weapon, s); },
};
// 新神器觉醒查表：进化后由 updateArtifact 调度，基础形态硬编码于各 tick*（门控配对被动觉醒）
const ARTIFACT_BEHAVIORS = {
  fatalis(ws, weapon, dt) { ws.tickFatalis(weapon, dt); },
  retribution(ws, weapon, dt) { ws.tickRetribution(weapon, dt); },
  mirage(ws, weapon, dt) { ws.tickMirage(weapon, dt); },
  bastion(ws, weapon, dt) { ws.tickBastion(weapon, dt); },
  sentinel(ws, weapon, dt) { ws.tickSentinel(weapon, dt); },
  cataclysm(ws, weapon, dt) { ws.tickCataclysm(weapon, dt); },
  bloodpact(ws, weapon, dt) { ws.tickBloodpact(weapon, dt); },
  absolution(ws, weapon, dt) { ws.tickAbsolution(weapon, dt); },
};

export class WeaponSystem {
  constructor(game) {
    this.game = game;
    this.projectiles = [];
    this.pools = [];
    this.bolts = [];
    this.slashes = [];
    this.vials = [];
    this.thunderRunes = [];
    // v2.0 新实体桶（RL2：各自硬上限 + oldest-first 回收；reset 一并清空）
    this.sentinels = [];        // 守护结晶/永恒壁垒 哨卫
    this.orbs = [];             // 回响哨卫/回响守望 环绕法球
    this.shockwaves = [];       // 碎甲重锤/碎甲天罚 扩张波
    this.runes = [];            // 镇魂钟鸣/镇魂赦令 符文陷阱
    this.runePulses = [];       // 符文周期性扩张音波脉冲（每脉冲一道环，前缘扫敌）
    this.mirageResidues = [];   // 幻影千袭 残留魅影（持续 AoE）
    this.bursts = [];           // 瞬时爆裂环（断罪十字爆裂等，上限 12）
    this.artifactState = { stormTimer: 0, devourAngle: 0, stormcallTimer: 1.0, tempestDistance: 0, tempestIdleTimer: 0, lastX: 0, lastY: 0 };
    this.devourPool = null;
  }

  reset() {
    this.projectiles.length = 0;
    this.pools.length = 0;
    this.bolts.length = 0;
    this.slashes.length = 0;
    this.vials.length = 0;
    this.thunderRunes.length = 0;
    this.sentinels.length = 0;
    this.orbs.length = 0;
    this.shockwaves.length = 0;
    this.runes.length = 0;
    this.runePulses.length = 0;
    this.mirageResidues.length = 0;
    this.bursts.length = 0;
    this.artifactState = { stormTimer: 0, devourAngle: 0, stormcallTimer: 1.0, tempestDistance: 0, tempestIdleTimer: 0, lastX: 0, lastY: 0 };
    this.devourPool = null;
  }

  // innate=true → 入「槽外固有」表（不占武器槽、仍可被升级/进化）；如已持有则合并升一级（双源圣水→两级）
  addWeapon(id, level = 1, innate = false) {
    const p = this.game.player;
    const existing = [...p.weapons, ...p.innateWeapons].find((w) => w.id === id);
    if (existing) {
      existing.level = Math.min(WEAPONS[id].maxLevel, existing.level + 1);
      existing.innate = existing.innate || innate;
      existing.visual = (WEAPONS[id] && WEAPONS[id].visual) || id;
      return existing;
    }
    const arr = innate ? p.innateWeapons : p.weapons;
    // 实例带 visual：v2.2+ 子弹/形态差异化靠 projShape(weapon.visual,...) 取剪影；
    // 实例此前无 .visual → projShape(undefined,...) 恒返 null → 永远回落菱形。此处根治。
    const entry = { id, level, timer: 0.4, innate, visual: (WEAPONS[id] && WEAPONS[id].visual) || id };
    arr.push(entry);
    return entry;
  }

  upgradeWeapon(id) {
    const p = this.game.player;
    const w = [...p.weapons, ...p.innateWeapons].find((x) => x.id === id);
    if (w && w.level < WEAPONS[id].maxLevel) w.level += 1;
  }

  hasWeapon(id) {
    const p = this.game.player;
    return [...p.weapons, ...p.innateWeapons].some((w) => w.id === id);
  }

  weaponLevel(id) {
    const p = this.game.player;
    const w = [...p.weapons, ...p.innateWeapons].find((x) => x.id === id);
    return w ? w.level : 0;
  }

  // 从「武器槽」或「槽外固有」任一处移除（供进化消费基础武器，兼容固有圣水）
  removeWeapon(id) {
    const p = this.game.player;
    let idx = p.weapons.findIndex((w) => w.id === id);
    if (idx >= 0) { p.weapons.splice(idx, 1); return; }
    idx = p.innateWeapons.findIndex((w) => w.id === id);
    if (idx >= 0) p.innateWeapons.splice(idx, 1);
  }

  addArtifact(id) {
    this.game.player.weapons.push({ id, artifact: true, level: 1, timer: 0, visual: (WEAPONS[id] && WEAPONS[id].visual) || id });
  }

  hasArtifact(id) {
    return this.game.player.weapons.some((w) => w.artifact && w.id === id);
  }

  // 伤害+飘字一把梭（所有直伤点改用此函数）：先经 player.rollCrit，暴击飘字金色放大
  // critBonus/critMulBonus：逐武器暴击加成（技能树 war_starfall_crit），默认 0 = 行为不变
  hitEnemy(e, baseDamage, knockX = 0, knockY = 0, color, critBonus = 0, critMulBonus = 0) {
    const { damage, isCrit } = this.game.player.rollCrit(baseDamage, critBonus, critMulBonus);
    this.game.enemies.damageEnemy(e, damage, knockX, knockY);
    this.game.fx.spawnDamageNumber(e.x, e.y - e.radius, Math.round(damage), isCrit ? '#ffd24a' : color, isCrit);
    return { damage, isCrit };
  }

  stats(weapon) {
    return WEAPONS[weapon.id].levels[weapon.level - 1];
  }

  update(dt) {
    const player = this.game.player;
    for (const weapon of [...player.weapons, ...player.innateWeapons]) {
      if (weapon.artifact) { this.updateArtifact(weapon, dt); continue; }
      weapon.timer -= dt;
      if (weapon.timer <= 0) {
        const s = this.stats(weapon);
        // 血裔·攻速/冷却缩减：cooldown 乘 player.cooldownMul（<1=更快）
        weapon.timer += s.cooldown * (player.cooldownMul || 1);
        this.fire(weapon, s);
      }
    }
    this.updateProjectiles(dt);
    this.updatePools(dt);
    this.updateBolts(dt);
    this.updateVials(dt);
    this.updateSlashes(dt);
    this.updateThunderRunes(dt);
    // v2.0 新实体系统（桶空则 no-op；RL2 上限回收）
    this.updateSentinels(dt);
    this.updateOrbs(dt);
    this.updateShockwaves(dt);
    this.updateRunes(dt);
    this.updateRunePulses(dt);
    this.updateMirageResidues(dt);
    this.updateBursts(dt);
    this.enforceCaps();
  }

  // v2.0 RL2 性能护栏：每帧末统一裁剪所有生成桶到硬上限（oldest-first 回收最旧），
  // 杜绝无界增长导致掉帧。上限取自本文件顶部常量（PROJECTILE_CAP 等）与 CONFIG（MAX_*）。
  enforceCaps() {
    const trim = (arr, cap) => { if (arr.length > cap) arr.splice(0, arr.length - cap); };
    trim(this.projectiles, PROJECTILE_CAP);
    trim(this.pools, POOL_CAP);
    trim(this.bolts, BOLT_CAP);
    trim(this.vials, VIAL_CAP);
    trim(this.slashes, SLASH_CAP);
    trim(this.thunderRunes, 24);      // 现有硬上限（新符文≤24），保留
    trim(this.sentinels, MAX_SENTINELS);
    trim(this.orbs, MAX_ORBS);
    trim(this.shockwaves, MAX_SHOCKWAVES);
    trim(this.runes, MAX_RUNES);
    trim(this.runePulses, 200);   // 音波脉冲有 life 上限自然收敛；此处为性能安全网
    trim(this.bursts, 12);            // 瞬时爆裂环，注释约定上限 12
    trim(this.mirageResidues, 32);    // 幻影残留 AoE 安全网
  }

  updateSlashes(dt) {
    for (let i = this.slashes.length - 1; i >= 0; i -= 1) {
      this.slashes[i].life -= dt;
      if (this.slashes[i].life <= 0) this.slashes.splice(i, 1);
    }
  }

  updateArtifact(weapon, dt) {
    const game = this.game;
    const player = game.player;
    const enemies = game.enemies.enemies;
    const st = this.artifactState;
    if (weapon.id === 'storm') {
      st.stormTimer -= dt;
      if (st.stormTimer <= 0 && enemies.length > 0) {
        st.stormTimer = 0.12;
        for (let i = 0; i < 3; i += 1) {
          const target = this.pickTarget(i);
          if (!target) break;
          const dx = target.x - player.x;
          const dy = target.y - player.y;
          const d = Math.hypot(dx, dy) || 1;
          this.projectiles.push({
            kind: 'blade', x: player.x, y: player.y,
            vx: (dx / d) * 420, vy: (dy / d) * 420,
            damage: 18 * player.damageMul, pierce: 2, life: 1.4, spin: 0, hitSet: new Set(),
            tint: '#5ad1e6', // 千刃风暴：青色碎片，区别于基础红飞刀
          });
        }
      }
    } else if (weapon.id === 'devour') {
      st.devourAngle += dt;
      if (!this.devourPool) this.devourPool = { radius: 140, tick: 0.4, tickTimer: 0 };
      const pool = this.devourPool;
      pool.x = player.x;
      pool.y = player.y;
      pool.tickTimer -= dt;
      if (pool.tickTimer <= 0) {
        pool.tickTimer = pool.tick;
        for (const e of game.enemies.enemiesNear(player.x, player.y, pool.radius + 30)) {
          if (e.hp > 0 && Math.hypot(e.x - player.x, e.y - player.y) < pool.radius) {
            this.hitEnemy(e, 34 * player.damageMul, 0, 0, '#ffd76a');
          }
        }
      }
    } else if (weapon.id === 'spiral') {
      st.devourAngle += dt * 2.2;
      for (let i = 0; i < 6; i += 1) {
        const ang = st.devourAngle + (i * Math.PI * 2) / 6;
        const bx = player.x + Math.cos(ang) * 130;
        const by = player.y + Math.sin(ang) * 130;
        for (const e of game.enemies.enemiesNear(bx, by, 40)) {
          if (e.hp > 0 && !e._spiralHit) {
            e._spiralHit = true;
            this.hitEnemy(e, 24 * player.damageMul, Math.cos(ang), Math.sin(ang));
            setTimeout(() => { e._spiralHit = false; }, 400);
          }
        }
      }
    } else if (weapon.id === 'stormcall') {
      st.stormcallTimer -= dt;
      if (st.stormcallTimer <= 0 && enemies.length > 0) {
        st.stormcallTimer = 1.2;
        for (let i = 0; i < 6; i += 1) {
          const target = enemies[Math.floor(Math.random() * enemies.length)];
          this.strikeLightning(target, { damage: 40 * player.damageMul, chains: 6, chainRange: 220, color: '#ffd76e' }, new Set());
        }
      }
    } else if (weapon.id === 'crimson') {
      st.stormTimer -= dt;
      if (st.stormTimer <= 0 && enemies.length > 0) {
        st.stormTimer = 0.5;
        for (let i = 0; i < 4; i += 1) {
          const target = this.pickTarget(i);
          if (!target) break;
          const dx = target.x - player.x;
          const dy = target.y - player.y;
          const d = Math.hypot(dx, dy) || 1;
          this.projectiles.push({
            kind: 'blade', x: player.x, y: player.y,
            vx: (dx / d) * 400, vy: (dy / d) * 400,
            damage: 35 * player.damageMul, pierce: 3, life: 1.5, spin: 0, hitSet: new Set(), lifeSteal: true,
            tint: '#ff3b6b', // 猩红之拥：猩红碎片
          });
        }
      }
    } else if (weapon.id === 'tempest') {
      const moved = Math.hypot(player.x - (st.lastX || player.x), player.y - (st.lastY || player.y));
      st.tempestDistance += moved;
      st.lastX = player.x;
      st.lastY = player.y;
      if (st.tempestDistance > 42 && enemies.length > 0) {
        st.tempestDistance = 0;
        this.fireTempest(player);
      }
      // 静止兜底：长时间未移动也触发一次，避免站桩无输出（复用 fireTempest）
      st.tempestIdleTimer = (st.tempestIdleTimer || 0) + dt;
      if (st.tempestIdleTimer >= 0.35 && enemies.length > 0) {
        st.tempestIdleTimer = 0;
        this.fireTempest(player);
      }
    } else if (weapon.id === 'sepulcher') {
      // 寂灭结界：更大光环持续伤害 + 每 1.2s 向 4 向迸射骨刺
      st.devourAngle += dt;
      const r = 150;
      for (const e of game.enemies.enemiesNear(player.x, player.y, r + 30)) {
        if (e.hp > 0 && Math.hypot(e.x - player.x, e.y - player.y) < r) {
          this.hitEnemy(e, 20 * player.damageMul, 0, 0, '#b07cff');
        }
      }
      st.sepTimer = (st.sepTimer || 0) - dt;
      if (st.sepTimer <= 0) {
        st.sepTimer = 1.2;
        for (let i = 0; i < 4; i += 1) {
          const ang = (i / 4) * Math.PI * 2 + st.devourAngle;
          this.projectiles.push({
            kind: 'blade', x: player.x, y: player.y,
            vx: Math.cos(ang) * 360, vy: Math.sin(ang) * 360,
            damage: 24 * player.damageMul, pierce: 2, life: 1.4, spin: 0, hitSet: new Set(),
            tint: '#b07cff', // 寂灭结界：紫色骨刺
          });
        }
      }
    } else if (weapon.id === 'eternalwhip') {
      // 永劫之鞭：每 1.0s 三向(-20°/0/+20°)齐扫、更宽
      st.ewTimer = (st.ewTimer || 0) - dt;
      if (st.ewTimer <= 0) {
        st.ewTimer = 1.0;
        const target = this.pickTarget(0);
        const base = target ? Math.atan2(target.y - player.y, target.x - player.x) : (player.facing >= 0 ? 0 : Math.PI);
        for (const off of [-0.35, 0, 0.35]) {
          this.applyWhip(player, base + off, { damage: 30, length: 300, width: 70, tint: ETERNALWHIP_TINT }, new Set());
        }
      }
    } else if (weapon.id === 'matrix') {
      // 圣光矩阵：每 0.8s 常驻八向放射、穿透 3
      st.mxTimer = (st.mxTimer || 0) - dt;
      if (st.mxTimer <= 0) {
        st.mxTimer = 0.8;
        const n = 8;
        for (let i = 0; i < n; i += 1) {
          const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
          this.projectiles.push({
            kind: 'cross', x: player.x, y: player.y,
            vx: Math.cos(ang) * 440, vy: Math.sin(ang) * 440,
            damage: 40 * player.damageMul, pierce: 3, life: 1.6, spin: 0, hitSet: new Set(),
            matrix: true, // 圣光矩阵觉醒标记：渲染时用专属特效区分于黎明圣印
          });
        }
      }
    } else if (weapon.id === 'reaper') {
      // 亡魂收割者（觉醒）：继承镰刀大范围回旋横扫，并追加撕裂 DOT 与收割回能。
      // 因进化会从 player.weapons 移除基础 scythe 武器，此处由神器自行发射 scythe 投射物；
      // rend/harvest 的实际结算在命中处(updateProjectiles)与敌人死亡处(entities.js)，由 hasArtifact('reaper') 门控。
      st.reaperTimer = (st.reaperTimer || 0) - dt;
      if (st.reaperTimer <= 0 && enemies.length > 0) {
        st.reaperTimer = 1.0; // [PLACEHOLDER] 觉醒镰斩节奏
        const n = 4;          // [PLACEHOLDER] 觉醒镰刀数量（对齐满级 scythe）
        for (let i = 0; i < n; i += 1) {
          const target = this.pickTarget(i) || enemies[i % enemies.length];
          const ang = target
            ? Math.atan2(target.y - player.y, target.x - player.x)
            : (player.facing >= 0 ? 0 : Math.PI);
          const a = ang + (i - (n - 1) / 2) * 0.5;
          this.projectiles.push({
            kind: 'scythe', x: player.x, y: player.y,
            vx: Math.cos(a) * 305, vy: Math.sin(a) * 305,
            speed: 305, angle: a,
            damage: 44 * player.damageMul, // [PLACEHOLDER] 觉醒镰刀伤害（对齐满级 scythe）
            pierce: 99, life: 3, spin: 0, traveled: 0, range: 320,
            returning: false, hitSet: new Set(),
            reaper: true, // 觉醒标记：渲染用紫辉光 + 大号镰刀区分于基础 scythe
          });
        }
      }
    } else if (ARTIFACT_BEHAVIORS[weapon.id]) {
      // v2.0 新神器（fatalis/retribution/.../absolution）：基础形态 + 觉醒门控配对被动
      ARTIFACT_BEHAVIORS[weapon.id](this, weapon, dt);
    }
  }

  fire(weapon, s) {
    const game = this.game;
    const player = game.player;
    const enemies = game.enemies.enemies;
    if (enemies.length === 0) return;

    if (weapon.id === 'blade') {
      // 忍者飞刀：以最近敌人为中心、count 片扇形连掷，像飞刀出手
      const target = this.pickTarget(0) || enemies[0];
      const base = Math.atan2(target.y - player.y, target.x - player.x);
      const spread = 0.16;
      const n = s.count + (player.weaponMods?.blade?.count || 0);
      for (let i = 0; i < n; i += 1) {
        const ang = base + (i - (n - 1) / 2) * spread;
        this.projectiles.push({
          kind: 'blade',
          x: player.x, y: player.y,
          vx: Math.cos(ang) * s.speed, vy: Math.sin(ang) * s.speed,
          damage: s.damage * player.damageMul,
          pierce: s.pierce, life: 1.6, spin: 0, hitSet: new Set(),
        });
      }
    } else if (weapon.id === 'holywater') {
      // 血裔·范围/持续：圣徒 areaMul 放大圣水领域；改为抛物线飞瓶，落地生成领域
      const area = player.areaMul || 1;
      for (let i = 0; i < s.count + (player.weaponMods?.holywater?.count || 0); i += 1) {
        const target = this.pickTarget(i) || enemies[0];
        const jx = target.x + (Math.random() * 2 - 1) * 40;
        const jy = target.y + (Math.random() * 2 - 1) * 40;
        const dist = Math.hypot(jx - player.x, jy - player.y);
        this.vials.push({
          x0: player.x, y0: player.y, x: player.x, y: player.y,
          tx: jx, ty: jy,
          t: 0,
          dur: Math.max(0.34, Math.min(0.72, dist / 420)),
          radius: s.radius * area,
          damage: s.damage * player.damageMul,
          duration: s.duration * area, tick: s.tick, tickTimer: 0, age: 0,
        });
      }
    } else if (weapon.id === 'axe') {
      const baseAngle = Math.atan2(
        this.game.enemies.enemies[0].y - player.y,
        this.game.enemies.enemies[0].x - player.x,
      );
      const n = s.count + (player.weaponMods?.axe?.count || 0);
      for (let i = 0; i < n; i += 1) {
        const angle = baseAngle + (i - (n - 1) / 2) * 0.5;
        this.projectiles.push({
          kind: 'axe',
          x: player.x, y: player.y,
          vx: Math.cos(angle) * s.speed, vy: Math.sin(angle) * s.speed,
          speed: s.speed, angle,
          damage: s.damage * player.damageMul,
          pierce: 99, life: 3, spin: 0, traveled: 0, range: s.range,
          returning: false, hitSet: new Set(),
        });
      }
    } else if (weapon.id === 'lightning') {
      for (let i = 0; i < s.strikes; i += 1) {
        const target = enemies[Math.floor(Math.random() * enemies.length)];
        this.strikeLightning(target, { ...s, chains: (s.chains || 0) + (player.weaponMods?.lightning?.chains || 0) }, new Set());
      }
    } else if (weapon.id === 'aura') {
      // 亡灵光环：贴身脉冲，对环内所有敌人造成 tick 伤害（连续 AoE，与圣水远处领域互补）
      const r = s.radius * (player.areaMul || 1);
      for (const e of game.enemies.enemiesNear(player.x, player.y, r + 30)) {
        if (e.hp > 0 && Math.hypot(e.x - player.x, e.y - player.y) < r) {
          this.hitEnemy(e, s.damage * player.damageMul, 0, 0, '#c060a0');
          // 状态增幅 proof-of-concept：仅当玩家已投资 statusAmp(>1) 时，aura 对环内敌人施加短暂减速；
          // 默认 statusAmp=1 → 不触发，现有光环行为逐字节不变（减速强度随 statusAmp 放大）
          if (player.statusAmp > 1) this.game.enemies.applyDebuff(e, { type: 'slow', value: 0.06, duration: 0.5 });
          // 血裔·吸血(嗜血者) 同步回血
          if (player.lifesteal > 0) {
            const before = player.hp;
            player.hp = Math.min(player.maxHp, player.hp + player.lifesteal);
            const healed = player.hp - before;
            if (player.lifestealToShield && healed < player.lifesteal && player.maxShield > 0) {
              const over = player.lifesteal - healed;
              player.shield = Math.min(player.maxShield, player.shield + over);
            }
          }
        }
      }
    } else if (weapon.id === 'whip') {
      // 噬魂长鞭：朝最近敌人方向挥出长条 hitbox（静止时朝面向），一线清空
      const target = this.pickTarget(0) || enemies[0];
      const ang = target
        ? Math.atan2(target.y - player.y, target.x - player.x)
        : (player.facing >= 0 ? 0 : Math.PI);
      this.applyWhip(player, ang, s, new Set());
    } else if (weapon.id === 'cross') {
      // 黎明圣印：多向放射（4/6/8 方向），独立 kind:'cross'，金色圣印贴图渲染
      const n = s.count;
      for (let i = 0; i < n; i += 1) {
        const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
        this.projectiles.push({
          kind: 'cross', x: player.x, y: player.y,
          vx: Math.cos(ang) * s.speed, vy: Math.sin(ang) * s.speed,
          damage: s.damage * player.damageMul,
          pierce: s.pierce, life: 1.6, spin: 0, hitSet: new Set(),
        });
      }
    } else if (weapon.id === 'scythe') {
      // 亡魂镰刀：大范围回旋镰斩（对齐 axe 自旋+高穿透+可回旋返回，半径更大、清场更强）
      // 基础形态只做 cleave；撕裂 DOT 与收割回能由 reaper 觉醒层追加（见 updateProjectiles 命中处）
      const baseAngle = Math.atan2(
        this.game.enemies.enemies[0].y - player.y,
        this.game.enemies.enemies[0].x - player.x,
      );
      for (let i = 0; i < s.count; i += 1) {
        const angle = baseAngle + (i - (s.count - 1) / 2) * 0.5;
        this.projectiles.push({
          kind: 'scythe',
          x: player.x, y: player.y,
          vx: Math.cos(angle) * s.speed, vy: Math.sin(angle) * s.speed,
          speed: s.speed, angle,
          damage: s.damage * player.damageMul,
          pierce: 99, life: 3, spin: 0, traveled: 0, range: s.range,
          returning: false, hitSet: new Set(),
        });
      }
    } else {
      // v2.0 新武器：查表 MECH_FIRE[mech] 分发（既有 8 武器无 mech 字段，走上方原路径，零回归风险）
      const def = WEAPONS[weapon.id];
      const mech = def && def.mech;
      if (mech && MECH_FIRE[mech]) MECH_FIRE[mech](this, weapon, s);
    }
  }

  // 长鞭：沿方向线段 hitbox 采样，命中矩形内敌人（点到线段距离判定）
  // hitSet：单次挥击内对每敌只结算一次伤害（大型敌人会跨多个采样点，去重避免被秒）
  applyWhip(player, ang, s, hitSet, tint = null, onHit = null) {
    const game = this.game;
    const len = s.length;
    const halfW = (s.width || 44) / 2;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    for (let t = 20; t <= len; t += 12) {
      const cx = player.x + dx * t;
      const cy = player.y + dy * t;
      for (const e of game.enemies.enemiesNear(cx, cy, halfW + 30)) {
        if (e.hp <= 0) continue;
        if (hitSet.has(e)) continue;
        const px = e.x - player.x;
        const py = e.y - player.y;
        const proj = px * dx + py * dy;
        if (proj < 0 || proj > len) continue;
        const perp = Math.abs(px * dy - py * dx);
        if (perp < halfW + e.radius) {
          hitSet.add(e);
          const res = this.hitEnemy(e, s.damage * player.damageMul, dx, dy, tint ? tint.dmg : '#c060a0');
          if (tint) {
            game.fx.spawnSparks(e.x, e.y, tint.spark, 6);
            game.fx.spawnSparks(e.x, e.y, tint.sparkHot, 3);
          }
          if (player.lifesteal > 0) {
            const before = player.hp;
            player.hp = Math.min(player.maxHp, player.hp + player.lifesteal);
            const healed = player.hp - before;
            if (player.lifestealToShield && healed < player.lifesteal && player.maxShield > 0) {
              const over = player.lifesteal - healed;
              player.shield = Math.min(player.maxShield, player.shield + over);
            }
          }
          // v2.0：断罪终焉觉醒钩子（仅暴击命中点触发十字爆裂+处决）
          if (onHit) onHit(e, e.x, e.y, res.isCrit);
        }
      }
    }
    this.slashes.push({ x: player.x, y: player.y, ang, len, width: s.width || 44, life: 0.22, maxLife: 0.22, bow: (Math.random() < 0.5 ? -1 : 1), tint: s.tint || null });
  }

  pickTarget(offset = 0) {
    // 线性选第 offset 近敌人（平方距离比较）：与原先全量 sort 结果等价，
    // 但 O(offset·n) 无数组分配，避免每次开火都 [...enemies].sort()
    const enemies = this.game.enemies.enemies;
    if (enemies.length === 0) return null;
    const player = this.game.player;
    const px = player.x, py = player.y;
    const cam = this.game.camera;
    // 可视矩形（含 50px 外扩余量）：屏内优先，手机/电脑都只锁「看得见」的敌人，消除跨设备差异
    const vx0 = cam.ox - 50, vy0 = cam.oy - 50;
    const vx1 = cam.ox + CONFIG.LOGICAL_WIDTH + 50, vy1 = cam.oy + CONFIG.LOGICAL_HEIGHT + 50;
    const k = Math.min(offset, enemies.length - 1);
    // scratch 池按 (k+1) 复用，避免每帧分配
    const pool = this._pickPool || (this._pickPool = []);
    if (pool.length < k + 1) pool.length = k + 1;
    let count = 0;
    let visBest = null, visD = Infinity;
    for (const e of enemies) {
      const dx = e.x - px, dy = e.y - py;
      const d = dx * dx + dy * dy;
      // 屏内最近（仅主目标 offset=0 生效，避免扇形副目标也强锁屏内）
      if (offset === 0) {
        const onScreen = e.x >= vx0 && e.x <= vx1 && e.y >= vy0 && e.y <= vy1;
        if (onScreen && d < visD) { visD = d; visBest = e; }
      }
      if (count < k + 1) {
        // 未满：按升序插入
        let i = count++;
        while (i > 0 && pool[i - 1].d > d) { pool[i] = pool[i - 1]; i -= 1; }
        pool[i] = { d, e };
      } else if (d < pool[k].d) {
        let i = k;
        while (i > 0 && pool[i - 1].d > d) { pool[i] = pool[i - 1]; i -= 1; }
        pool[i] = { d, e };
      }
    }
    // 屏内优先：优先锁屏内最近敌人；屏内无敌人（罕见）再退回全局最近
    if (offset === 0 && visBest) return visBest;
    return count > 0 ? pool[Math.min(k, count - 1)].e : null;
  }

  strikeLightning(startEnemy, s, hitSet) {
    const game = this.game;
    const color = s.color || '#f5d76e'; // 雷色区分：stormcall 金雷 / tempest 紫电 / 基础 lightning 默认金
    let current = startEnemy;
    const firstX = current.x, firstY = current.y;
    const points = [{ x: firstX, y: firstY - 360, sky: true }, { x: firstX, y: firstY }];
    let remaining = s.chains;
    hitSet.add(current);
    this.hitEnemy(current, s.damage * game.player.damageMul, 0, 0, color);
    while (remaining > 0) {
      const next = game.enemies.enemiesNear(current.x, current.y, s.chainRange)
        .filter((e) => !hitSet.has(e) && e.hp > 0)
        .sort((a, b) => Math.hypot(a.x - current.x, a.y - current.y) - Math.hypot(b.x - current.x, b.y - current.y))[0];
      if (!next) break;
      hitSet.add(next);
      points.push({ x: next.x, y: next.y });
      this.hitEnemy(next, s.damage * game.player.damageMul * 0.85, 0, 0, color);
      current = next;
      remaining -= 1;
    }
    this.bolts.push({ points, life: 0.22, maxLife: 0.22, color });
    game.fx.spawnSparks(firstX, firstY, color, 10);
    game.audio.zap();
  }

  // 雷劫（tempest）专属雷印 AoE：临时留场紫色光环，对象池复用、上限 24，无逐帧 new 数组
  fireTempest(player) {
    const target = this.game.enemies.nearestTo(player.x, player.y, TARGET_RADIUS);
    if (!target) return;
    this.strikeLightning(target, { damage: 56 * player.damageMul, chains: 4, chainRange: 200, color: '#b07cff' }, new Set());
    this.spawnThunderRune(player.x, player.y, 20 * player.damageMul);
  }

  spawnThunderRune(x, y, damage) {
    if (this.thunderRunes.length >= 24) return; // 对象池硬上限，避免留场对象无界增长
    this.thunderRunes.push({
      x, y, radius: 70, damage,
      tick: 0.2, tickTimer: 0, duration: 1.2, color: '#b07cff',
    });
  }

  updateThunderRunes(dt) {
    const game = this.game;
    for (let i = this.thunderRunes.length - 1; i >= 0; i -= 1) {
      const r = this.thunderRunes[i];
      r.duration -= dt;
      r.tickTimer -= dt;
      if (r.tickTimer <= 0) {
        r.tickTimer += r.tick;
        for (const e of game.enemies.enemiesNear(r.x, r.y, r.radius + 30)) {
          if (e.hp > 0 && Math.hypot(e.x - r.x, e.y - r.y) < r.radius) {
            this.hitEnemy(e, r.damage, 0, 0, r.color);
          }
        }
      }
      if (r.duration <= 0) this.thunderRunes.splice(i, 1);
    }
  }

  updateProjectiles(dt) {
    const game = this.game;
    const player = game.player;
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.spin += dt * 14;

      // v2.0 追踪（homing）：朝最近敌人转向，限制在 homing(deg/s) 内
      if (p.homing) {
        const tgt = game.enemies.nearestTo(p.x, p.y, 600);
        if (tgt) {
          const desired = Math.atan2(tgt.y - p.y, tgt.x - p.x);
          const cur = Math.atan2(p.vy, p.vx);
          let diff = desired - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const maxTurn = (p.homing * Math.PI / 180) * dt;
          const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
          const na = cur + turn;
          p.vx = Math.cos(na) * p.speed;
          p.vy = Math.sin(na) * p.speed;
        }
      }

      if (p.kind === 'axe' || p.kind === 'scythe') {
        if (!p.returning) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.traveled += p.speed * dt;
          if (p.traveled >= p.range) p.returning = true;
        } else {
          const dx = player.x - p.x;
          const dy = player.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          p.x += (dx / d) * p.speed * 1.2 * dt;
          p.y += (dy / d) * p.speed * 1.2 * dt;
          if (d < 24) p.life = 0;
        }
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }

      const queryR = p.kind === 'scythe' ? 84 : 60;
      const targets = game.enemies.enemiesNear(p.x, p.y, queryR);
      for (const e of targets) {
        if (e.hp <= 0 || p.hitSet.has(e)) continue;
        const pad = p.kind === 'scythe' ? 22 : 12;
        if (Math.hypot(e.x - p.x, e.y - p.y) < e.radius + pad) {
          p.hitSet.add(e);
          const kd = Math.hypot(p.vx, p.vy) || 1;
          const projColor = p.tint || (p.kind === 'blade' ? '#e74c3c' : (p.kind === 'scythe' ? '#7CFC00' : '#9fc5ff'));
          const res = this.hitEnemy(e, p.damage, p.vx / kd, p.vy / kd, projColor, p.critBonus || 0, p.critMulBonus || 0);
          game.fx.spawnSparks(e.x, e.y, projColor, 4);
          // v2.0 吸血（sanguine/bloodpact）：命中回血
          if (p.heal) {
            const before = player.hp;
            player.hp = Math.min(player.maxHp, player.hp + p.heal);
            const healed = player.hp - before;
            if (p.awaken === 'bloodpact' && player.passives.has('regen') && healed <= 0) {
              // 满血溢出 → 临时护盾
              player.shield = Math.min(player.maxShield, player.shield + p.heal);
            }
          }
          if (game.player.lifesteal > 0) {
            const before = game.player.hp;
            game.player.hp = Math.min(game.player.maxHp, game.player.hp + game.player.lifesteal);
            const healed = game.player.hp - before;
            if (game.player.lifestealToShield && healed < game.player.lifesteal && game.player.maxShield > 0) {
              const over = game.player.lifesteal - healed;
              game.player.shield = Math.min(game.player.maxShield, game.player.shield + over);
            }
          }
          if (p.kind === 'scythe' && this.game.weapons.hasArtifact('reaper')) {
            e.rend = { dps: REND_DPS * game.player.damageMul, time: REND_DURATION };
          }
          // v2.0 觉醒 per-hit 钩子（fatalis/mirage/bastion）
          this._applyAwakenHit(p, e, res);
          // v2.0 分裂（phantom/mirage）：命中迸射碎片
          if (p.splits > 0 && !p._split) {
            p._split = true;
            for (let k = 0; k < p.splits; k += 1) {
              const a = Math.random() * Math.PI * 2;
              this.projectiles.push({
                kind: 'blade', x: e.x, y: e.y,
                vx: Math.cos(a) * p.splitSpeed, vy: Math.sin(a) * p.splitSpeed,
                speed: p.splitSpeed, damage: p.damage * p.splitMul, pierce: 1, life: 1.0, spin: 0,
                hitSet: new Set(), tint: p.tint, glowKey: p.glowKey, glowColor: p.glowColor, glowSize: p.glowSize,
                shape: p.shape, awaken: p.awaken,
              });
            }
          }
          p.pierce -= 1;
          if (p.pierce <= 0) { p.life = 0; break; }
        }
      }

      if (p.life <= 0) this.projectiles.splice(i, 1);
    }
  }

  // v2.0 觉醒 per-hit 效果（门控配对被动）
  _applyAwakenHit(p, e, res) {
    const game = this.game, player = game.player;
    if (p.awaken === 'fatalis' && res.isCrit) {
      // 暴击星铁迸射 2 枚迷你追踪碎片
      for (let k = 0; k < 2; k += 1) {
        const a = Math.random() * Math.PI * 2;
        this.projectiles.push({
          kind: 'blade', x: e.x, y: e.y, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300,
          speed: 300, damage: 14 * player.damageMul, pierce: 1, life: 1.2, spin: 0,
          hitSet: new Set(), tint: '#ffcf4d', glowKey: 'starfall', glowColor: 'rgba(255,207,77,0.9)', glowSize: 44, awaken: null,
        });
      }
    } else if (p.awaken === 'mirage' && player.passives.has('dodge')) {
      // 魅影残留 AoE
      this.mirageResidues.push({ x: e.x, y: e.y, radius: 40, damage: 10 * player.damageMul, tick: 0.2, tickTimer: 0, duration: 0.6, life: 0.6, hitSet: new Set() });
    } else if (p.awaken === 'bastion' && player.passives.has('shield') && player.shield > 0) {
      // 护盾下哨卫伤害 20% 转护盾
      player.shield = Math.min(player.maxShield, player.shield + res.damage * 0.2);
    }
  }

  updatePools(dt) {
    const game = this.game;
    for (let i = this.pools.length - 1; i >= 0; i -= 1) {
      const pool = this.pools[i];
      pool.age += dt;
      pool.duration -= dt;
      pool.tickTimer -= dt;
      if (pool.tickTimer <= 0) {
        pool.tickTimer += pool.tick;
        const targets = game.enemies.enemiesNear(pool.x, pool.y, pool.radius + 30);
        for (const e of targets) {
          if (e.hp > 0 && Math.hypot(e.x - pool.x, e.y - pool.y) < pool.radius) {
            this.hitEnemy(e, pool.damage, 0, 0, '#7ec8ff');
          }
        }
      }
      if (pool.duration <= 0) this.pools.splice(i, 1);
    }
  }

  updateBolts(dt) {
    for (let i = this.bolts.length - 1; i >= 0; i -= 1) {
      this.bolts[i].life -= dt;
      if (this.bolts[i].life <= 0) this.bolts.splice(i, 1);
    }
  }

  updateVials(dt) {
    const game = this.game;
    for (let i = this.vials.length - 1; i >= 0; i -= 1) {
      const v = this.vials[i];
      v.t += dt / v.dur;
      if (v.t >= 1) {
        // 落地：生成圣水领域
        this.pools.push({
          x: v.tx, y: v.ty, radius: v.radius, damage: v.damage,
          duration: v.duration, tick: v.tick, tickTimer: 0, age: 0,
        });
        game.fx.spawnSparks(v.tx, v.ty, '#a8d8ff', 8);
        game.audio.splash();
        this.vials.splice(i, 1);
        continue;
      }
      const e = v.t;
      const arc = Math.sin(Math.PI * e) * Math.min(130, Math.hypot(v.tx - v.x0, v.ty - v.y0) * 0.3);
      v.x = v.x0 + (v.tx - v.x0) * e;
      v.y = v.y0 + (v.ty - v.y0) * e - arc;
    }
  }

  // 红环（脉冲）+ 缓慢旋转六芒星：亡灵光环 / 寂灭结界共用，统一视觉语言
  // 通用彩色光环环（fill 底色 / stroke 描边 / sigil 六芒星色），供亡灵光环(红)与永夜使徒固有光环(紫)复用。
  drawAuraRingColored(ctx, sx, sy, r, time, fill, stroke, sigil, alphaMul = 1) {
    const pulse = 0.85 + Math.sin(time * 4) * 0.1;
    const rot = time * 0.6;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.globalAlpha = 0.30 * alphaMul;
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.arc(0, 0, r * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.85 * alphaMul;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = stroke;
    ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(0, 0, r * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.rotate(rot);
    ctx.globalAlpha = 0.55 * alphaMul;
    ctx.strokeStyle = sigil;
    ctx.lineWidth = 2;
    const R = r * 0.55;
    for (let tri = 0; tri < 2; tri += 1) {
      const off = tri * Math.PI;
      ctx.beginPath();
      for (let k = 0; k <= 3; k += 1) {
        const ang = -Math.PI / 2 + off + (k % 3) * (Math.PI * 2 / 3);
        const px = Math.cos(ang) * R, py = Math.sin(ang) * R;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  drawRedAuraRing(ctx, sx, sy, r, time, alphaMul = 1) {
    this.drawAuraRingColored(ctx, sx, sy, r, time, '#c0202a', '#e23b3b', '#ff7a85', alphaMul);
  }

  // ===== v2.0 新武器 / 新神器 运行时实现 =====
  // 配对被动（觉醒门控）：拥有该被动时神器觉醒机制生效
  _baseVisual(id) {
    return ({ fatalis: 'starfall', retribution: 'judgment', mirage: 'phantom', bastion: 'aegis', sentinel: 'warden', cataclysm: 'maul', bloodpact: 'sanguine', absolution: 'resolve' })[id] || null;
  }
  _awakened(weapon) {
    const pair = this._baseVisual(weapon.id) ? ({ fatalis: 'critrate', retribution: 'critdmg', mirage: 'dodge', bastion: 'shield', sentinel: 'shieldregen', cataclysm: 'armor', bloodpact: 'regen', absolution: 'guard' })[weapon.id] : null;
    return pair ? this.game.player.passives.has(pair) : false;
  }
  _preset(weapon) {
    const vid = weapon.visual || this._baseVisual(weapon.id) || weapon.id;
    return VISUAL_PRESETS[vid] || VISUAL_PRESETS.starfall;
  }

  // ---------- 新武器 fire 方法（MECH_FIRE 分发；神器 tick 复用） ----------
  fireHoming(weapon, s, awakened) {
    const game = this.game, player = game.player, enemies = game.enemies.enemies;
    if (enemies.length === 0) return;
    const pr = this._preset(weapon);
    const n = s.count || 1;
    for (let i = 0; i < n; i += 1) {
      const target = this.pickTarget(i) || enemies[i % enemies.length];
      const ang = target ? Math.atan2(target.y - player.y, target.x - player.x) : Math.random() * Math.PI * 2;
      this.projectiles.push({
        kind: 'blade', x: player.x, y: player.y,
        vx: Math.cos(ang) * s.speed * 0.6, vy: Math.sin(ang) * s.speed * 0.6,
        speed: s.speed, homing: s.homing || 200,
        damage: s.damage * player.damageMul, pierce: s.pierce || 1, life: s.life || 2, spin: 0,
        hitSet: new Set(), tint: pr.color, glowKey: pr.glowKey, glowColor: pr.glowColor, glowSize: pr.glowSize,
        shape: projShape(weapon.visual, awakened ? weapon.id : null),
        awaken: awakened ? weapon.id : null,
        // 技能树 war_starfall_crit：仅星陨弩携带逐武器暴击加成（其他归航武器默认 0）
        critBonus: weapon.id === 'starfall' ? (player.weaponMods?.starfall?.critChance || 0) : 0,
        critMulBonus: weapon.id === 'starfall' ? (player.weaponMods?.starfall?.critMul || 0) : 0,
      });
    }
  }

  fireThrust(weapon, s, awakened) {
    const game = this.game, player = game.player, enemies = game.enemies.enemies;
    if (enemies.length === 0) return;
    const pr = this._preset(weapon);
    const target = this.pickTarget(0) || enemies[0];
    const ang = target ? Math.atan2(target.y - player.y, target.x - player.x) : (player.facing >= 0 ? 0 : Math.PI);
    const tint = { dmg: pr.color, trail: pr.color, spark: pr.color, sparkHot: '#ffffff' };
    const onHit = (awakened && this._awakened(weapon)) ? (e, x, y, isCrit) => this._retributionAwaken(e, x, y, isCrit) : null;
    this.applyWhip(player, ang, { damage: s.damage, length: s.length, width: s.width, tint }, new Set(), null, onHit);
  }

  fireSplitting(weapon, s, awakened) {
    const game = this.game, player = game.player, enemies = game.enemies.enemies;
    if (enemies.length === 0) return;
    const pr = this._preset(weapon);
    const n = s.count || 1;
    for (let i = 0; i < n; i += 1) {
      const target = this.pickTarget(i) || enemies[i % enemies.length];
      const ang = target ? Math.atan2(target.y - player.y, target.x - player.x) : Math.random() * Math.PI * 2;
      this.projectiles.push({
        kind: 'blade', x: player.x, y: player.y, vx: Math.cos(ang) * s.speed, vy: Math.sin(ang) * s.speed,
        speed: s.speed, damage: s.damage * player.damageMul, pierce: s.pierce || 1, life: 1.6, spin: 0, hitSet: new Set(),
        tint: pr.color, glowKey: pr.glowKey, glowColor: pr.glowColor, glowSize: pr.glowSize,
        shape: projShape(weapon.visual, awakened ? weapon.id : null),
        splits: s.splits || 0, splitMul: s.splitMul || 0.6, splitSpeed: s.splitSpeed || 300,
        awaken: awakened ? weapon.id : null,
      });
    }
  }

  fireSentinel(weapon, s) {
    const player = this.game.player;
    const maxN = s.maxSentinels || 2;
    if (this.sentinels.length >= maxN) return;
    const pr = this._preset(weapon);
    const idx = this.sentinels.length;
    const offAng = (idx / maxN) * Math.PI * 2;
    const offR = 64;
    this.sentinels.push({
      offAng, offR, x: player.x + Math.cos(offAng) * offR, y: player.y + Math.sin(offAng) * offR,
      range: s.range || 160, shotCD: s.shotCD || 0.6, shotTimer: 0,
      damage: s.damage * player.damageMul, projSpeed: s.projSpeed || 300, pierce: 1,
      life: s.duration || 8, maxLife: s.duration || 8, color: pr.color,
      glowKey: pr.glowKey, glowColor: pr.glowColor, glowSize: pr.glowSize, awaken: weapon.id, visual: weapon.visual,
    });
  }

  fireOrb(weapon, s) {
    const player = this.game.player;
    const maxN = s.count || 1;
    const pr = this._preset(weapon);
    while (this.orbs.length < maxN) {
      this.orbs.push({
        angle: (this.orbs.length / maxN) * Math.PI * 2, orbitRadius: s.orbitRadius || 100,
        shotCD: s.shotCD || 1, shotTimer: 0, damage: s.damage * player.damageMul,
        projSpeed: s.projSpeed || 320, pierce: s.pierce || 1, color: pr.color,
        glowKey: pr.glowKey, glowColor: pr.glowColor, glowSize: pr.glowSize, awaken: weapon.id, visual: weapon.visual,
      });
    }
  }

  fireShockwave(weapon, s, awakened) {
    const player = this.game.player;
    const pr = this._preset(weapon);
    this.shockwaves.push({
      x: player.x, y: player.y, radius: s.radius || 180, width: s.width || 40, expand: s.expand || 0.6,
      currentR: 0, damage: s.damage * player.damageMul, knock: s.knock || 40,
      life: 2.0, maxLife: 2.0, hitSet: new Set(), color: pr.color, awaken: awakened ? weapon.id : null,
    });
  }

  fireLifesteal(weapon, s, awakened) {
    const game = this.game, player = game.player, enemies = game.enemies.enemies;
    if (enemies.length === 0) return;
    const pr = this._preset(weapon);
    const n = s.count || 1;
    for (let i = 0; i < n; i += 1) {
      const target = this.pickTarget(i) || enemies[i % enemies.length];
      const ang = target ? Math.atan2(target.y - player.y, target.x - player.x) : Math.random() * Math.PI * 2;
      this.projectiles.push({
        kind: 'blade', x: player.x, y: player.y, vx: Math.cos(ang) * s.speed, vy: Math.sin(ang) * s.speed,
        speed: s.speed, damage: s.damage * player.damageMul, pierce: s.pierce || 2, life: 1.6, spin: 0, hitSet: new Set(),
        tint: pr.color, glowKey: pr.glowKey, glowColor: pr.glowColor, glowSize: pr.glowSize,
        shape: projShape(weapon.visual, awakened ? weapon.id : null),
        heal: s.heal || 0, awaken: awakened ? weapon.id : null,
      });
    }
  }

  fireRune(weapon, s) {
    const player = this.game.player;
    const maxN = s.maxRunes || 8;
    if (this.runes.length >= maxN) return;
    const pr = this._preset(weapon);
    const idx = this.runes.length;
    const ang = (idx / maxN) * Math.PI * 2;
    const r = s.deployRange || 150;
    this.runes.push({
      x: player.x + Math.cos(ang) * r, y: player.y + Math.sin(ang) * r,
      offAng: ang, offR: r, spin: s.spin != null ? s.spin : 0.6,
      triggerRange: s.triggerRange || 30, burstRadius: s.burstRadius || 80,
      damage: s.damage * player.damageMul, duration: s.duration || 8, life: s.duration || 8,
      maxLife: s.duration || 8,
      pulseInterval: s.pulseInterval || 1.0,
      pulseMul: s.pulseMul != null ? s.pulseMul : 0.5,
      pulseTimer: 0.3,
      color: pr.color, glowKey: pr.glowKey, glowColor: pr.glowColor, glowSize: pr.glowSize,
      awaken: weapon.id,
    });
  }

  // ---------- 新实体桶 update ----------
  updateSentinels(dt) {
    const game = this.game, player = game.player, enemies = game.enemies.enemies;
    for (let i = this.sentinels.length - 1; i >= 0; i -= 1) {
      const sn = this.sentinels[i];
      sn.life -= dt;
      sn.x += (player.x + Math.cos(sn.offAng) * sn.offR - sn.x) * Math.min(1, dt * 4);
      sn.y += (player.y + Math.sin(sn.offAng) * sn.offR - sn.y) * Math.min(1, dt * 4);
      sn.shotTimer -= dt;
      if (sn.shotTimer <= 0 && enemies.length > 0) {
        const target = game.enemies.nearestTo(sn.x, sn.y, sn.range);
        if (target) {
          sn.shotTimer = sn.shotCD;
          const dx = target.x - sn.x, dy = target.y - sn.y, d = Math.hypot(dx, dy) || 1;
          this.projectiles.push({
            kind: 'blade', x: sn.x, y: sn.y, vx: (dx / d) * sn.projSpeed, vy: (dy / d) * sn.projSpeed,
            speed: sn.projSpeed, damage: sn.damage, pierce: sn.pierce, life: 1.5, spin: 0, hitSet: new Set(),
            tint: sn.color, glowKey: sn.glowKey, glowColor: sn.glowColor, glowSize: sn.glowSize,
            shape: projShape(sn.visual, sn.awaken), awaken: sn.awaken,
          });
        }
      }
      if (sn.life <= 0) this.sentinels.splice(i, 1);
    }
  }

  updateOrbs(dt) {
    const game = this.game, player = game.player, enemies = game.enemies.enemies;
    for (const o of this.orbs) {
      o.angle += ORBIT_OMEGA * dt;
      o.x = player.x + Math.cos(o.angle) * o.orbitRadius;
      o.y = player.y + Math.sin(o.angle) * o.orbitRadius;
      o.shotTimer -= dt;
      if (o.shotTimer <= 0 && enemies.length > 0) {
        const target = game.enemies.nearestTo(o.x, o.y, 420);
        if (target) {
          o.shotTimer = o.shotCD;
          const dx = target.x - o.x, dy = target.y - o.y, d = Math.hypot(dx, dy) || 1;
          this.projectiles.push({
            kind: 'blade', x: o.x, y: o.y, vx: (dx / d) * o.projSpeed, vy: (dy / d) * o.projSpeed,
            speed: o.projSpeed, damage: o.damage, pierce: o.pierce, life: 1.5, spin: 0, hitSet: new Set(),
            tint: o.color, glowKey: o.glowKey, glowColor: o.glowColor, glowSize: o.glowSize,
            shape: projShape(o.visual, o.awaken), awaken: o.awaken,
          });
        }
      }
    }
  }

  updateShockwaves(dt) {
    const game = this.game, player = game.player;
    for (let i = this.shockwaves.length - 1; i >= 0; i -= 1) {
      const sw = this.shockwaves[i];
      sw.currentR += sw.radius * sw.expand * dt;
      sw.life -= dt;
      const targets = game.enemies.enemiesNear(sw.x, sw.y, sw.currentR + 30);
      for (const e of targets) {
        if (e.hp <= 0 || sw.hitSet.has(e)) continue;
        const d = Math.hypot(e.x - sw.x, e.y - sw.y);
        if (d <= sw.currentR && d >= sw.currentR - sw.width - e.radius) {
          sw.hitSet.add(e);
          let dmg = sw.damage;
          if (sw.awaken === 'cataclysm') dmg += player.armor;
          const kd = Math.hypot(e.x - sw.x, e.y - sw.y) || 1;
          this.hitEnemy(e, dmg, (e.x - sw.x) / kd, (e.y - sw.y) / kd, '#ff9a3c');
          if (sw.awaken === 'cataclysm' && e.knockResist < 1) { e.stunTimer = STUN_DURATION; }
        }
      }
      if (sw.life <= 0 || sw.currentR > sw.radius + sw.width) this.shockwaves.splice(i, 1);
    }
  }

  updateRunes(dt) {
    const game = this.game;
    const player = game.player;
    for (let i = this.runes.length - 1; i >= 0; i -= 1) {
      const rn = this.runes[i];
      rn.life -= dt;
      // 符文绕玩家自转(orbit) + 跟随：角度随时间推进，世界坐标每帧重算
      rn.offAng += (rn.spin || 0) * dt;
      // 符文环绕玩家：每帧重算世界坐标，避免玩家移动后范围被甩在身后
      rn.x = player.x + Math.cos(rn.offAng) * rn.offR;
      rn.y = player.y + Math.sin(rn.offAng) * rn.offR;
      // 周期性音波脉冲：每隔 pulseInterval 秒从中心发出一道扩张环（替换原单次踏入触发）
      rn.pulseTimer -= dt;
      if (rn.pulseTimer <= 0) {
        rn.pulseTimer += rn.pulseInterval;
        this.runePulses.push({
          x: rn.x, y: rn.y, maxR: rn.burstRadius,
          currentR: 0, width: 26, speed: rn.burstRadius / 0.22,
          damage: rn.damage * rn.pulseMul, hitSet: new Set(),
          life: 0.28, maxLife: 0.28,
          awaken: rn.awaken,
          color: (rn.awaken === 'absolution' || rn.awaken === 'resolve') ? '#ff3b5c' : rn.color,
        });
      }
      // 进入即触发：敌人踏入 burstRadius 圈内时把脉冲等待压到 0.3s 以内（持续脉冲）；无敌人时回落到 idle 慢节奏
      const ACTIVE_CAP = 0.3; // 敌人进入圈内后脉冲最快节奏(秒)
      const hasEnemy = game.enemies.enemiesNear(rn.x, rn.y, rn.burstRadius).length > 0;
      if (hasEnemy && rn.pulseTimer > ACTIVE_CAP) rn.pulseTimer = ACTIVE_CAP;
      if (rn.life <= 0) this.runes.splice(i, 1);
    }
  }

  updateRunePulses(dt) {
    const game = this.game;
    for (let i = this.runePulses.length - 1; i >= 0; i -= 1) {
      const p = this.runePulses[i];
      p.life -= dt;
      p.currentR += p.speed * dt;
      const targets = game.enemies.enemiesNear(p.x, p.y, p.maxR + p.width);
      for (const e of targets) {
        if (e.hp > 0 && !p.hitSet.has(e)) {
          const d = Math.hypot(e.x - p.x, e.y - p.y);
          if (d <= p.currentR && d >= p.currentR - p.width - e.radius) {
            this.hitEnemy(e, p.damage, 0, 0, p.color);
            p.hitSet.add(e);
          }
        }
      }
      if (p.life <= 0 || p.currentR > p.maxR + p.width) this.runePulses.splice(i, 1);
    }
  }

  updateMirageResidues(dt) {
    const game = this.game;
    for (let i = this.mirageResidues.length - 1; i >= 0; i -= 1) {
      const m = this.mirageResidues[i];
      m.life -= dt;
      m.tickTimer -= dt;
      if (m.tickTimer <= 0) {
        m.tickTimer += m.tick;
        for (const e of game.enemies.enemiesNear(m.x, m.y, m.radius + 30)) {
          if (e.hp > 0 && Math.hypot(e.x - m.x, e.y - m.y) < m.radius) this.hitEnemy(e, m.damage, 0, 0, '#9b6cff');
        }
      }
      if (m.life <= 0) this.mirageResidues.splice(i, 1);
    }
  }

  updateBursts(dt) {
    for (let i = this.bursts.length - 1; i >= 0; i -= 1) {
      this.bursts[i].life -= dt;
      if (this.bursts[i].life <= 0) this.bursts.splice(i, 1);
    }
  }

  spawnBurst(x, y, radius, damage, color) {
    const game = this.game;
    for (const e of game.enemies.enemiesNear(x, y, radius + 30)) {
      if (e.hp > 0 && Math.hypot(e.x - x, e.y - y) < radius) this.hitEnemy(e, damage, 0, 0, color);
    }
    this.bursts.push({ x, y, radius, life: 0.3, maxLife: 0.3, color });
  }

  _retributionAwaken(e, x, y, isCrit) {
    if (!isCrit) return;
    const player = this.game.player;
    this.spawnBurst(x, y, 60, 40 * player.damageMul, '#ff5a5a');
    if (e.hp > 0 && e.hp < e.maxHp * 0.3) {
      if (e.isBoss || e.isElite) this.hitEnemy(e, e.maxHp * 0.15, 0, 0, '#ff5a5a');
      else e.hp = 0;
    }
  }

  // ---------- 新神器 tick（基础形态 + 觉醒门控） ----------
  tickFatalis(weapon, dt) {
    const player = this.game.player;
    if (this.game.enemies.enemies.length === 0) return;
    weapon.timer -= dt;
    if (weapon.timer <= 0) {
      weapon.timer += 0.9 * (player.cooldownMul || 1);
      this.fireHoming({ visual: 'starfall', id: weapon.id }, { damage: 30, count: 4, cooldown: 0.9, speed: 390, pierce: 2, life: 2.2, homing: 240 }, this._awakened(weapon));
    }
  }
  tickRetribution(weapon, dt) {
    const player = this.game.player;
    if (this.game.enemies.enemies.length === 0) return;
    weapon.timer -= dt;
    if (weapon.timer <= 0) {
      weapon.timer += 1.2 * (player.cooldownMul || 1);
      this.fireThrust({ visual: 'judgment', id: weapon.id }, { damage: 100, cooldown: 1.2, length: 180, width: 56 }, this._awakened(weapon));
    }
  }
  tickMirage(weapon, dt) {
    const player = this.game.player;
    if (this.game.enemies.enemies.length === 0) return;
    weapon.timer -= dt;
    if (weapon.timer <= 0) {
      weapon.timer += 1.0 * (player.cooldownMul || 1);
      this.fireSplitting({ visual: 'phantom', id: weapon.id }, { damage: 34, count: 2, cooldown: 1.0, speed: 400, pierce: 2, splits: 4, splitMul: 0.6, splitSpeed: 320 }, this._awakened(weapon));
    }
  }
  tickBastion(weapon, dt) {
    const player = this.game.player;
    weapon.timer -= dt;
    if (weapon.timer <= 0) {
      weapon.timer += 4.0 * (player.cooldownMul || 1);
      this.fireSentinel({ visual: 'aegis', id: weapon.id }, { damage: 34, cooldown: 4.0, range: 240, shotCD: 0.5, projSpeed: 340, duration: 12, maxSentinels: 3 });
    }
  }
  tickSentinel(weapon, dt) {
    const player = this.game.player;
    weapon.timer -= dt;
    if (weapon.timer <= 0) {
      weapon.timer += 3.2 * (player.cooldownMul || 1);
      this.fireOrb({ visual: 'warden', id: weapon.id }, { damage: 30, cooldown: 3.2, count: 3, orbitRadius: 130, shotCD: 0.9, projSpeed: 360, pierce: 2 });
    }
    if (this._awakened(weapon)) {
      weapon._pulse = (weapon._pulse || 0) - dt;
      if (weapon._pulse <= 0) { weapon._pulse = 2.0; player.shield = Math.min(player.maxShield, player.shield + 2); }
    }
  }
  tickCataclysm(weapon, dt) {
    const player = this.game.player;
    weapon.timer -= dt;
    if (weapon.timer <= 0) {
      weapon.timer += 2.2 * (player.cooldownMul || 1);
      this.fireShockwave({ visual: 'maul', id: weapon.id }, { damage: 58, cooldown: 2.2, radius: 230, width: 44, expand: 0.6, knock: 60 }, this._awakened(weapon));
    }
  }
  tickBloodpact(weapon, dt) {
    const player = this.game.player;
    weapon.timer -= dt;
    if (weapon.timer <= 0) {
      weapon.timer += 1.0 * (player.cooldownMul || 1);
      this.fireLifesteal({ visual: 'sanguine', id: weapon.id }, { damage: 42, count: 2, cooldown: 1.0, speed: 390, pierce: 3, heal: 3 }, this._awakened(weapon));
    }
  }
  tickAbsolution(weapon, dt) {
    const player = this.game.player;
    weapon.timer -= dt;
    if (weapon.timer <= 0) {
      weapon.timer += 2.2 * (player.cooldownMul || 1);
      this.fireRune({ visual: 'resolve', id: weapon.id }, { damage: 44, cooldown: 2.2, count: 2, triggerRange: 36, burstRadius: 200, deployRange: 240, spin: 0.6, duration: 12, maxRunes: 12, pulseInterval: 0.7, pulseMul: 0.6 });
    }
    if (this._awakened(weapon)) {
      let inRune = false;
      for (const rn of this.runes) {
        if (rn.awaken === weapon.id && Math.hypot(player.x - rn.x, player.y - rn.y) < rn.burstRadius) { inRune = true; break; }
      }
      player.absolutionDR = inRune ? 0.8 : 1;
    }
  }

  render(ctx, cam) {
    // 圣水领域
    for (const pool of this.pools) {
      const sx = pool.x - cam.ox;
      const sy = pool.y - cam.oy;
      const fadeIn = Math.min(1, pool.age * 4);
      const fadeOut = Math.min(1, pool.duration * 2);
      const alpha = 0.32 * fadeIn * fadeOut;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#4aa3df';
      ctx.beginPath();
      ctx.arc(sx, sy, pool.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha * 1.6;
      ctx.strokeStyle = '#a8d8ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, pool.radius * (0.85 + Math.sin(pool.age * 6) * 0.08), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 圣水飞瓶（抛物线投掷）
    for (const v of this.vials) {
      const sx = v.x - cam.ox;
      const sy = v.y - cam.oy;
      const img = sprite('holywater');
      const sz = 18;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(v.t * Math.PI * 1.6);
      if (img) ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
      else { ctx.fillStyle = '#7ec8ff'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }

    // 亡灵光环 + 长鞭横扫 + 寂灭结界（武器丰富化新增视觉）
    // 任务③修复：原仅查 player.weapons，漏掉 innateWeapons → 永夜使徒的槽外固有光环无视觉反馈。
    const auraW = [...this.game.player.weapons, ...this.game.player.innateWeapons]
      .find((w) => w.id === 'aura' && !w.artifact);
    if (auraW) {
      const st = this.stats(auraW);
      const r = st.radius * (this.game.player.areaMul || 1);
      const sx = this.game.player.x - cam.ox;
      const sy = this.game.player.y - cam.oy;
      if (auraW.innate) {
        // 永夜使徒槽外固有光环：永夜紫配色，与普通亡灵光环区分（高难高回报的视觉身份）
        this.drawAuraRingColored(ctx, sx, sy, r, this.game.time, '#6a2f8f', '#9b4fc9', '#c77bff');
      } else {
        this.drawRedAuraRing(ctx, sx, sy, r, this.game.time);
      }
    }
    // 寂灭结界：与亡灵光环统一的红环 + 六芒星
    if (this.hasArtifact('sepulcher')) {
      const sx = this.game.player.x - cam.ox;
      const sy = this.game.player.y - cam.oy;
      this.drawRedAuraRing(ctx, sx, sy, 150, this.game.time, 1.15);
    }
    // 神器：圣光矩阵八向星纹 sigil（脚下持续场，金，additive 预渲染，无 shadowBlur）
    if (this.hasArtifact('matrix')) {
      const player = this.game.player;
      const sx = player.x - cam.ox;
      const sy = player.y - cam.oy;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(this.game.time * 0.8);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5;
      ctx.drawImage(getMatrixSigilSprite(), -54, -54, 108, 108);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }
    // 长鞭横扫：锥形曲线鞭 + 末端裂响
    const qbez = (x0, y0, cx, cy, x1, y1, u) => {
      const m = 1 - u;
      return {
        x: m * m * x0 + 2 * m * u * cx + u * u * x1,
        y: m * m * y0 + 2 * m * u * cy + u * u * y1,
      };
    };
    for (const sl of this.slashes) {
      const a = sl.life / sl.maxLife;
      const t = 1 - a;
      const grow = Math.min(1, t * 5);          // 快速挥出
      const fade = a;
      ctx.save();
      ctx.translate(sl.x - cam.ox, sl.y - cam.oy);
      ctx.rotate(sl.ang);
      const tipX = sl.len * grow;
      const bow = Math.sin(t * Math.PI) * sl.width * 0.55 * (sl.bow || 1);
      ctx.lineCap = 'round';
      const N = 16;
      // 亡劫之鞭·残影光晕（additive）：仅 eternalwhip（sl.tint 存在）绘制
      if (sl.tint) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = fade * 0.30;
        ctx.strokeStyle = sl.tint.trail;
        ctx.lineWidth = sl.width * 1.8;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(tipX * 0.5, bow, tipX, 0);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
      for (let i = 0; i < N; i += 1) {
        const u0 = i / N, u1 = (i + 1) / N;
        const p0 = qbez(0, 0, tipX * 0.5, bow, tipX, 0, u0);
        const p1 = qbez(0, 0, tipX * 0.5, bow, tipX, 0, u1);
        ctx.lineWidth = Math.max(1, sl.width * (1 - 0.82 * u0));
        ctx.globalAlpha = fade * (0.95 - u0 * 0.35);
        ctx.strokeStyle = sl.tint ? (i < N * 0.5 ? sl.tint.body : sl.tint.edge) : (i < N * 0.5 ? 'rgba(236,140,200,0.95)' : 'rgba(200,90,165,0.85)');
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
      if (grow >= 0.96) {
        ctx.globalAlpha = fade * 0.9;
        ctx.fillStyle = sl.tint ? sl.tint.tip : 'rgba(255,224,246,0.95)';
        ctx.beginPath();
        ctx.arc(tipX, 0, 3 + (1 - fade) * 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 神器：死亡螺旋环绕斧刃
    if (this.hasArtifact('spiral')) {
      const st = this.artifactState;
      const player = this.game.player;
      const img = sprite('axe');
      for (let i = 0; i < 6; i += 1) {
        const ang = st.devourAngle + (i * Math.PI * 2) / 6;
        const bx = player.x + Math.cos(ang) * 130 - cam.ox;
        const by = player.y + Math.sin(ang) * 130 - cam.oy;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(st.devourAngle * 3);
        if (img) ctx.drawImage(img, -17, -17, 34, 34);
        ctx.restore();
      }
    }
    // 神器：圣洁吞噬跟随领域
    if (this.hasArtifact('devour') && this.devourPool) {
      const player = this.game.player;
      const sx = player.x - cam.ox;
      const sy = player.y - cam.oy;
      const r = this.devourPool.radius;
      ctx.save();
      // additive 金白光晕（替代 shadowBlur，与亡灵红环/圣水蓝池三色正交）
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5;
      ctx.drawImage(getGlowSprite('devour', r * 2, 'rgba(255,215,106,0.8)'), sx - r, sy - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = 'rgba(255,215,106,0.85)';
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#fff3c4';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(sx, sy, r * (0.9 + Math.sin(this.artifactState.devourAngle * 5) * 0.06), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 雷劫专属雷印 AoE（临时留场紫光环，对象池上限 24，无逐帧 new 数组）
    for (const r of this.thunderRunes) {
      const sx = r.x - cam.ox;
      const sy = r.y - cam.oy;
      const a = Math.max(0, r.duration / 1.2); // 生命衰减 alpha
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 * a;
      ctx.drawImage(getGlowSprite('tempest', r.radius * 2, 'rgba(176,124,255,0.8)'), sx - r.radius, sy - r.radius, r.radius * 2, r.radius * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.35 * a;
      ctx.fillStyle = 'rgba(176,124,255,0.35)';
      ctx.beginPath(); ctx.arc(sx, sy, r.radius, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.7 * a;
      ctx.strokeStyle = '#b07cff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, r.radius * (0.85 + Math.sin(this.game.time * 5) * 0.06), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // 投射物
    for (const p of this.projectiles) {
      const sx = p.x - cam.ox;
      const sy = p.y - cam.oy;
      ctx.save();
      ctx.translate(sx, sy);
      if (p.kind === 'cross' && p.matrix) {
        // 圣光矩阵觉醒：更大金色圣印 + additive 辉光 + 运动拖尾，与黎明圣印明显区分（纯观感）。
        // 性能修复：禁止逐帧 shadowBlur（Canvas2D 头号性能杀手，dpr=2 下模糊面积×4 → 严重掉帧）；
        // 改用一次性缓存的径向辉光贴图 + 加法合成，与 systems.js 宝箱辉光同源手法。
        const img = sprite('weapon_cross');
        const size = 48;
        const spin = (p.spin || 0) + (this.game.time || 0) * 2.2;
        const sp = Math.hypot(p.vx, p.vy) || 1;
        const ux = p.vx / sp, uy = p.vy / sp;
        ctx.globalCompositeOperation = 'lighter';
        // 运动拖尾（沿 -v 方向，加法合成）
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = '#ffe6a0';
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(-ux * 24, -uy * 24);
        ctx.lineTo(ux * 24, uy * 24);
        ctx.stroke();
        // 缓存辉光：径向渐变贴图仅创建一次，加法合成替代 shadowBlur
        const glow = getMatrixGlowSprite();
        const gs = 78;
        ctx.globalAlpha = 0.6;
        ctx.drawImage(glow, -gs / 2, -gs / 2, gs, gs);
        ctx.globalAlpha = 1;
        ctx.rotate(spin);
        if (img) ctx.drawImage(img, -size / 2, -size / 2, size, size);
        else {
          ctx.fillStyle = '#ffd76a';
          ctx.fillRect(-size / 2, -4, size, 8);
          ctx.fillRect(-4, -size / 2, 8, size);
        }
        ctx.globalCompositeOperation = 'source-over';
      } else if (p.kind === 'cross') {
        // 黎明圣印：金色圣印贴图 + 辉光 + 缓慢自旋，与红色飞刃区分
        const img = sprite('weapon_cross');
        const size = 30;
        ctx.rotate((p.spin || 0) + (this.game.time || 0) * 1.5);
        ctx.shadowColor = '#ffe08a';
        ctx.shadowBlur = 10;
        if (img) ctx.drawImage(img, -size / 2, -size / 2, size, size);
        else { ctx.fillStyle = '#ffd76a'; ctx.fillRect(-size / 2, -3, size, 6); }
      } else if (p.kind === 'blade' && (p.shape || p.tint)) {
        // v2.2 差异化子弹：有 shape 用缓存剪影 sprite（每武器/神器独立形态），否则回落菱形（遗留武器保持原观感）
        ctx.rotate(Math.atan2(p.vy, p.vx));
        const size = 26;
        if (p.glowKey) {
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5;
          ctx.drawImage(getGlowSprite(p.glowKey, p.glowSize || 44, p.glowColor || 'rgba(255,255,255,0.9)'), -(p.glowSize || 44) / 2, -(p.glowSize || 44) / 2, p.glowSize || 44, p.glowSize || 44);
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        } else {
          // 遗留武器（tempest/crimson/sepulcher）无 glowKey，保持原硬编码 crimson 辉光观感
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5;
          ctx.drawImage(getGlowSprite('crimson', 44, 'rgba(255,59,107,0.9)'), -22, -22, 44, 44);
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        }
        const shp = p.shape ? getShapeSprite(p.shape, size, p.tint) : null;
        if (shp) ctx.drawImage(shp, -size / 2, -size / 2, size, size);
        else {
          ctx.fillStyle = p.tint;
          ctx.beginPath();
          ctx.moveTo(size / 2, 0);
          ctx.lineTo(0, -size / 3);
          ctx.lineTo(-size / 2, 0);
          ctx.lineTo(0, size / 3);
          ctx.closePath();
          ctx.fill();
        }
      } else if (p.kind === 'scythe') {
        // 亡魂镰刀：骨白镰刀贴图自旋绘制（复用 axe 的 drawImage+rotate 写法，尺寸按 scythe 贴图）
        const img = sprite('scythe');
        const size = p.reaper ? 48 : 40;
        ctx.rotate(p.spin);
        if (p.reaper) {
          // 亡魂收割者觉醒：紫辉光 + 大号镰刀，强区分于基础 scythe
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55;
          ctx.drawImage(getGlowSprite('reaper', 60, 'rgba(176,124,255,0.9)'), -30, -30, 60, 60);
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
          if (img) ctx.drawImage(img, -size / 2, -size / 2, size, size);
          else { ctx.fillStyle = '#b07cff'; ctx.fillRect(-size / 2, -3, size, 6); }
        } else if (img) {
          // 基础 scythe：保持原样（存量 shadowBlur 留后续 hotfix，本次不动）
          ctx.shadowColor = '#7CFC00';
          ctx.shadowBlur = 8;
          ctx.drawImage(img, -size / 2, -size / 2, size, size);
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = '#cfd8dc';
          ctx.fillRect(-size / 2, -3, size, 6);
        }
      } else {
        const img = sprite(p.kind === 'blade' ? 'blade' : 'axe');
        const size = p.kind === 'blade' ? 26 : 34;
        ctx.rotate(p.kind === 'blade' ? Math.atan2(p.vy, p.vx) : p.spin);
        if (img) ctx.drawImage(img, -size / 2, -size / 2, size, size);
        else {
          ctx.fillStyle = p.kind === 'blade' ? '#e74c3c' : '#9fc5ff';
          ctx.fillRect(-size / 2, -3, size, 6);
        }
      }
      ctx.restore();
    }

    // 闪电（含天降落雷）
    for (const bolt of this.bolts) {
      const alpha = bolt.life / bolt.maxLife;
      const color = bolt.color || '#f5d76e';
      const impact = bolt.points.find((p) => !p.sky);
      ctx.save();
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      // additive 辉光替代 shadowBlur（性能修复，彻底移除 shadowBlur；雷色随神器区分）
      if (impact) {
        const ix = impact.x - cam.ox, iy = impact.y - cam.oy;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha * 0.6;
        ctx.drawImage(getGlowSprite(color, 64, color), ix - 32, iy - 32, 64, 64);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.beginPath();
      bolt.points.forEach((pt, idx) => {
        const sx = pt.x - cam.ox + (Math.random() * 2 - 1) * 4;
        const sy = pt.y - cam.oy + (Math.random() * 2 - 1) * 4;
        if (idx === 0) {
          if (pt.sky) ctx.moveTo(sx, sy);
          else ctx.moveTo(sx, sy - 40);
        } else {
          ctx.lineTo(sx, sy);
        }
      });
      ctx.stroke();
      // 落点爆闪（additive，随 bolt.color 区分）
      if (impact) {
        const ix = impact.x - cam.ox, iy = impact.y - cam.oy;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha * 0.85;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(ix, iy, 5 + alpha * 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore();
    }

    // ===== v2.0 新实体渲染（哨卫/法球/冲击波/符文/魅影/爆裂）=====
    // 哨卫（aegis/bastion）
    for (const sn of this.sentinels) {
      const sx = sn.x - cam.ox, sy = sn.y - cam.oy;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.4;
      ctx.drawImage(getGlowSprite(sn.glowKey, sn.glowSize, sn.glowColor), sx - sn.glowSize / 2, sy - sn.glowSize / 2, sn.glowSize, sn.glowSize);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      const img = sprite('weapon_aegis');
      if (img) ctx.drawImage(img, sx - 16, sy - 16, 32, 32);
      else { ctx.fillStyle = sn.color; ctx.beginPath(); ctx.arc(sx, sy, 12, 0, Math.PI * 2); ctx.fill(); }
      // 永恒壁垒(觉醒)：六边结界纹叠加，区别于基础哨卫
      if (sn.awaken === 'bastion') {
        ctx.globalAlpha = 0.85; ctx.strokeStyle = '#a9e6ff'; ctx.lineWidth = 2;
        const R = 19;
        ctx.beginPath();
        for (let i = 0; i < 6; i += 1) { const ang = (i / 6) * Math.PI * 2 - Math.PI / 2; const x = sx + Math.cos(ang) * R, y = sy + Math.sin(ang) * R; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.closePath(); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
    // 法球（warden/sentinel）
    for (const o of this.orbs) {
      const sx = o.x - cam.ox, sy = o.y - cam.oy;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45;
      ctx.drawImage(getGlowSprite(o.glowKey, o.glowSize, o.glowColor), sx - o.glowSize / 2, sy - o.glowSize / 2, o.glowSize, o.glowSize);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      const img = sprite('weapon_warden');
      if (img) ctx.drawImage(img, sx - 12, sy - 12, 24, 24);
      else { ctx.fillStyle = o.color; ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI * 2); ctx.fill(); }
      // 回响守望(觉醒)：眼形瞳孔叠加，区别于基础法球
      if (o.awaken === 'sentinel') {
        ctx.fillStyle = '#9affce'; ctx.beginPath(); ctx.ellipse(sx, sy, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#06210f'; ctx.beginPath(); ctx.arc(sx, sy, 3.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    // 冲击波（maul/cataclysm）
    for (const sw of this.shockwaves) {
      const sx = sw.x - cam.ox, sy = sw.y - cam.oy, a = Math.max(0, sw.life / sw.maxLife);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 * a;
      if (sw.awaken === 'cataclysm') {
        // 碎甲天罚(觉醒)：红色锯齿分段环，区别于 maul 橙色平滑环
        ctx.strokeStyle = '#ff5a3c'; ctx.lineWidth = Math.max(3, sw.width * 0.5);
        const seg = 30; ctx.beginPath();
        for (let i = 0; i <= seg; i += 1) {
          const ang = (i / seg) * Math.PI * 2;
          const rr = sw.currentR + (i % 2 ? 7 : -7);
          const x = sx + Math.cos(ang) * rr, y = sy + Math.sin(ang) * rr;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      } else {
        ctx.strokeStyle = sw.color; ctx.lineWidth = Math.max(2, sw.width * 0.4);
        ctx.beginPath(); ctx.arc(sx, sy, sw.currentR, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over'; ctx.restore();
    }
    // 符文（resolve/absolution）
    for (const rn of this.runes) {
      const sx = rn.x - cam.ox, sy = rn.y - cam.oy, a = Math.max(0, rn.life / rn.maxLife);
      ctx.save();
      ctx.translate(sx, sy); ctx.rotate(this.game.time * 0.8);
      if (rn.awaken === 'absolution' || rn.awaken === 'resolve') {
        // 镇魂钟鸣家族（基础 resolve + 觉醒 absolution）：红色圆环内嵌血色红钟（替换原光晕圈）
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.4 * a;
        ctx.drawImage(getGlowSprite('absolution', rn.burstRadius * 2, 'rgba(255,59,92,0.9)'), -rn.burstRadius, -rn.burstRadius, rn.burstRadius * 2, rn.burstRadius * 2);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.9 * a;
        const bs = rn.burstRadius * 0.92;
        ctx.strokeStyle = '#ff3b5c'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, rn.burstRadius * 0.78, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#b01230';
        ctx.beginPath(); ctx.arc(0, -bs * 0.08, bs * 0.28, Math.PI, 0); ctx.lineTo(bs * 0.34, bs * 0.42); ctx.lineTo(-bs * 0.34, bs * 0.42); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff3b5c';
        ctx.beginPath(); ctx.moveTo(-bs * 0.30, bs * 0.08); ctx.lineTo(bs * 0.30, bs * 0.08); ctx.lineTo(bs * 0.22, bs * 0.46); ctx.lineTo(-bs * 0.22, bs * 0.46); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffd0d8'; ctx.beginPath(); ctx.arc(0, bs * 0.54, bs * 0.06, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 * a;
        ctx.drawImage(getGlowSprite(rn.glowKey, rn.burstRadius * 2, rn.glowColor), -rn.burstRadius, -rn.burstRadius, rn.burstRadius * 2, rn.burstRadius * 2);
        ctx.globalAlpha = 0.6 * a; ctx.strokeStyle = rn.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, rn.triggerRange, 0, Math.PI * 2); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore();
    }
    // 符文音波脉冲（resolve/absolution：周期性扩张环，亮外环 + 淡内回响环）
    for (const p of this.runePulses) {
      const sx = p.x - cam.ox, sy = p.y - cam.oy, a = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.7 * a;
      ctx.strokeStyle = p.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, p.currentR, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.3 * a;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, p.currentR * 0.7, 0, Math.PI * 2); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }
    // 魅影残留（mirage）
    for (const m of this.mirageResidues) {
      const sx = m.x - cam.ox, sy = m.y - cam.oy, a = Math.max(0, m.life / m.duration);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3 * a;
      ctx.fillStyle = '#9b6cff';
      ctx.beginPath(); ctx.arc(sx, sy, m.radius * (0.85 + Math.sin(this.game.time * 6) * 0.06), 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over'; ctx.restore();
    }
    // 爆裂环（retribution 等）
    for (const b of this.bursts) {
      const sx = b.x - cam.ox, sy = b.y - cam.oy, a = Math.max(0, b.life / b.maxLife);
      const r = b.radius * (1 - a * 0.4);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.7 * a;
      ctx.strokeStyle = b.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over'; ctx.restore();
    }
  }
}
