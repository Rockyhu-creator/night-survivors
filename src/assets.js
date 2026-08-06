// 构建版本号（由 vite.config.js 的 define 注入），用于美术图 URL 缓存击穿。
const BUILD_ID = __BUILD_ID__;

const files = {
  player: 'player.png',
  player_wanderer: 'player_wanderer.png',
  player_saint: 'player_saint.png',
  player_berserker: 'player_berserker.png',
  player_thunder: 'player_thunder.png',
  player_bloodthirsty: 'player_bloodthirsty.png',
  player_apostle: 'player_apostle.png',
  bat: 'enemy_bat.png',
  skeleton: 'enemy_skeleton.png',
  slime: 'enemy_slime.png',
  elite: 'enemy_elite.png',
  boss_baron: 'boss_baron.png',
  boss_queen: 'boss_queen.png',
  boss_overlord: 'boss_overlord.png',
  boss_avatar: 'boss_avatar.png',
  // v4.1 P6 新增怪物贴图（AI 生图 + 像素化管线）
  herald: 'boss_herald.png',
  alchemist: 'boss_alchemist.png',
  warlord: 'boss_warlord.png',
  elite_reaver: 'enemy_elite_reaver.png',
  elite_conduit: 'enemy_elite_conduit.png',
  elite_colossus: 'enemy_elite_colossus.png',
  rat_swarm: 'enemy_rat_swarm.png',
  spitter: 'enemy_spitter.png',
  bone_knight: 'enemy_bone_knight.png',
  plague_bearer: 'enemy_plague_bearer.png',
  siren: 'enemy_siren.png',
  revenant: 'enemy_revenant.png',
  chest: 'chest.png',
  lootArrow: 'loot_arrow.png',
  blade: 'weapon_blade.png',
  holywater: 'weapon_holywater.png',
  axe: 'weapon_axe.png',
  lightning: 'weapon_lightning.png',
  weapon_aura: 'weapon_aura.png',
  weapon_whip: 'weapon_whip.png',
  weapon_cross: 'weapon_cross.png',
  scythe: 'weapon_scythe.png',
  weapon_starfall: 'weapon_starfall.png',
  weapon_judgment: 'weapon_judgment.png',
  weapon_phantom: 'weapon_phantom.png',
  weapon_aegis: 'weapon_aegis.png',
  weapon_warden: 'weapon_warden.png',
  weapon_maul: 'weapon_maul.png',
  weapon_sanguine: 'weapon_sanguine.png',
  weapon_resolve: 'weapon_resolve.png',
  art_storm: 'art_storm.png',
  art_devour: 'art_devour.png',
  art_spiral: 'art_spiral.png',
  art_stormcall: 'art_stormcall.png',
  art_crimson: 'art_crimson.png',
  art_tempest: 'art_tempest.png',
  art_sepulcher: 'art_sepulcher.png',
  art_eternalwhip: 'art_eternalwhip.png',
  art_matrix: 'art_matrix.png',
  art_reaper: 'art_reaper.png',
  art_fatalis: 'art_fatalis.png',
  art_retribution: 'art_retribution.png',
  art_mirage: 'art_mirage.png',
  art_bastion: 'art_bastion.png',
  art_sentinel: 'art_sentinel.png',
  art_cataclysm: 'art_cataclysm.png',
  art_bloodpact: 'art_bloodpact.png',
  art_absolution: 'art_absolution.png',
  portrait_wanderer: 'portrait_wanderer.png',
  portrait_saint: 'portrait_saint.png',
  portrait_berserker: 'portrait_berserker.png',
  portrait_thunder: 'portrait_thunder.png',
  portrait_bloodthirsty: 'portrait_bloodthirsty.png',
  portrait_apostle: 'portrait_apostle.png',
  altar_hp: 'altar_hp.png',
  altar_spd: 'altar_spd.png',
  altar_dmg: 'altar_dmg.png',
  altar_gain: 'altar_gain.png',
  altar_dual: 'altar_dual.png',
  altar_slot_weapon: 'altar_slot_weapon.png',
  altar_slot_passive: 'altar_slot_passive.png',
  passive_boots: 'passive_boots.png',
  passive_heart: 'passive_heart.png',
  passive_tome: 'passive_tome.png',
  passive_magnet: 'passive_magnet.png',
  passive_greed: 'passive_greed.png',
  passive_guard: 'passive_guard.png',
  passive_regen: 'passive_regen.png',
  passive_critrate: 'passive_critrate.png',
  passive_critdmg: 'passive_critdmg.png',
  passive_shield: 'passive_shield.png',
  passive_shieldregen: 'passive_shieldregen.png',
  passive_armor: 'passive_armor.png',
  passive_dodge: 'passive_dodge.png',
  codex_artifacts: 'codex_artifacts.png',
  codex_monsters: 'codex_monsters.png',
  codex_weapons: 'codex_weapons.png',
  codex_book: 'codex_book.png',
  codex_menu: 'codex_menu.png',
  altar_menu: 'altar_menu.png',
  shadow_hunter: 'enemy_shadow_hunter.png',
  gargoyle: 'enemy_gargoyle.png',
  gemSmall: 'gem_small.png',
  gemMedium: 'gem_medium.png',
  gemLarge: 'gem_large.png',
  gemGold: 'gem_gold.png',
  gemRed: 'gem_red.png',
  ground: 'ground.png',
  tomb: 'decal_tomb.png',
  wood: 'decal_wood.png',
  rubble: 'decal_rubble.png',
  bone: 'decal_bone.png',
  cross: 'decal_cross.png',
  potion: 'potion.png',
};

const images = {};
const processed = {};
if (typeof window !== 'undefined') window.__assets = files;

// 分级懒加载：懒加载集（仅特定界面/后期才用），其余为关键集（标题+开局+升级卡片必需）。
const LAZY_KEYS = new Set([
  'codex_artifacts', 'codex_monsters', 'codex_weapons', 'codex_book',
  'altar_hp', 'altar_spd', 'altar_dmg', 'altar_gain', 'altar_dual',
  'altar_slot_weapon', 'altar_slot_passive',
  'boss_baron', 'boss_queen', 'boss_overlord', 'boss_avatar',
  'herald', 'alchemist', 'warlord',
  'portrait_saint', 'portrait_berserker', 'portrait_thunder',
  'portrait_bloodthirsty', 'portrait_apostle',
]);
// 关键集 = files 中除懒加载键外的全部（含 player/passive/art/weapon/敌人/gem/ground/decal/chest/各 menu 图标 等）
const CRITICAL_KEYS = Object.keys(files).filter((k) => !LAZY_KEYS.has(k));

// 资源 URL：按文件名取内容哈希，缺失回退 BUILD_ID（精准缓存击穿）
function assetUrl(fn) {
  const h = (typeof __ASSET_HASHES__ !== 'undefined' && __ASSET_HASHES__[fn])
    ? __ASSET_HASHES__[fn]
    : BUILD_ID;
  return `/assets/${fn}?v=${h}`;
}

// 单图加载（含内容哈希精准缓存），两波加载共用
function loadOne(key) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { images[key] = img; resolve(); };
    img.onerror = () => { images[key] = null; resolve(); };
    img.src = assetUrl(files[key]);
  });
}

export function hasImage(key) {
  return Boolean(images[key]);
}

// 第一波：仅关键集，进度按 done/关键总数
export function loadAssets(onProgress) {
  let done = 0;
  const total = CRITICAL_KEYS.length;
  return Promise.all(CRITICAL_KEYS.map((key) => loadOne(key).then(() => {
    done += 1;
    onProgress?.(done / total);
  })));
}

// 第二波：懒加载集（不驱动进度条），模块级 lazyPromise 幂等
let lazyPromise = null;
export function loadAssetsLazy() {
  if (!lazyPromise) {
    lazyPromise = Promise.all([...LAZY_KEYS].map((key) => loadOne(key)));
  }
  return lazyPromise;
}

// 供界面入口守卫 await：返回懒加载 Promise（未触发则触发）
export function ensureLazy() {
  return loadAssetsLazy();
}

function chromaKey(img, tolerance = 42) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  const bg = [px[0], px[1], px[2]];
  for (let i = 0; i < px.length; i += 4) {
    const dr = px[i] - bg[0];
    const dg = px[i + 1] - bg[1];
    const db = px[i + 2] - bg[2];
    if (dr * dr + dg * dg + db * db < tolerance * tolerance) px[i + 3] = 0;
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

function trimTransparent(img, padding = 2) {
  const w = img.width;
  const h = img.height;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, w, h);
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return img;
  const x0 = Math.max(0, minX - padding);
  const y0 = Math.max(0, minY - padding);
  const x1 = Math.min(w, maxX + padding + 1);
  const y1 = Math.min(h, maxY + padding + 1);
  const out = document.createElement('canvas');
  out.width = x1 - x0;
  out.height = y1 - y0;
  out.getContext('2d').drawImage(img, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

// 词缀着色：离屏 canvas + source-atop 只染精灵形状本体，避免染到透明区域；按 key|color 缓存
const affixTintCache = {};
export function tintedEnemySprite(base, color, key) {
  const ck = key + '|' + color;
  if (affixTintCache[ck]) return affixTintCache[ck];
  const c = document.createElement('canvas');
  c.width = base.width; c.height = base.height;
  const cx = c.getContext('2d');
  cx.drawImage(base, 0, 0);
  cx.globalCompositeOperation = 'source-atop';
  cx.globalAlpha = 0.85;
  cx.fillStyle = color;
  cx.fillRect(0, 0, c.width, c.height);
  cx.globalCompositeOperation = 'source-over';
  affixTintCache[ck] = c;
  return c;
}

// 词缀头顶徽标（方案①：本体不染色，属性用光环+徽标表达）。纯函数，游戏内渲染与图鉴共用。
// affix: 'volatile' | 'shielded' | 'pack'；cx/cy 为徽标中心，scale 控制尺寸。
export function drawAffixBadge(ctx, affix, cx, cy, scale = 1) {
  ctx.save();
  if (affix === 'volatile') {
    const col = '#e67e22';
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = 2 * scale;
    const R = 7 * scale;
    for (let k = 0; k < 8; k += 1) {
      const a = (k / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * R * 0.5, cy + Math.sin(a) * R * 0.5);
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 2.4 * scale, 0, Math.PI * 2);
    ctx.fill();
  } else if (affix === 'shielded') {
    const col = '#3498db';
    ctx.fillStyle = col;
    const w = 8 * scale, h = 10 * scale;
    ctx.beginPath();
    ctx.moveTo(cx, cy - h / 2);
    ctx.lineTo(cx + w / 2, cy - h / 2 + 2 * scale);
    ctx.lineTo(cx + w / 2, cy + h / 4);
    ctx.quadraticCurveTo(cx + w / 2, cy + h / 2, cx, cy + h / 2);
    ctx.quadraticCurveTo(cx - w / 2, cy + h / 2, cx - w / 2, cy + h / 4);
    ctx.lineTo(cx - w / 2, cy - h / 2 + 2 * scale);
    ctx.closePath();
    ctx.fill();
  } else if (affix === 'pack') {
    const col = '#f1c40f';
    ctx.fillStyle = col;
    const r = 2.6 * scale, d = 5 * scale;
    const pts = [[0, -d * 0.6], [-d * 0.6, d * 0.5], [d * 0.6, d * 0.5]];
    for (const [dx, dy] of pts) {
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function sprite(key) {
  const img = images[key];
  if (!img) return null;
  if (!processed[key]) {
    // ground/bg 原样使用；精灵类自动裁掉透明边距，让绘制尺寸贴近视觉尺寸
    processed[key] = (key === 'ground') ? img : trimTransparent(img);
  }
  return processed[key];
}

// ── P5-1 统一占位工具 ───────────────────────────────────────────────
// 缺失精灵的兜底：画带标签的占位方块，替代裸紫圆；HTML 图标返回 data-URI，绝不碎图。
// 仅当资源真实缺失（images[key] 为假）时触发占位；已加载资源走原路径。

// HTML <img> 用：缺失返回带标签 SVG data-URI，存在则返回带哈希的资源 URL。
const _iconPH = {};
export function safeIconURL(key, label) {
  if (images[key]) return assetUrl(files[key]);
  const ck = key + '|' + (label || key);
  if (_iconPH[ck]) return _iconPH[ck];
  const text = String(label || key).slice(0, 6);
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48">' +
    '<rect width="48" height="48" rx="6" fill="#332a45"/>' +
    '<rect x="3" y="3" width="42" height="42" rx="4" fill="none" stroke="#8e44ad" stroke-width="2"/>' +
    '<text x="24" y="29" font-size="9" fill="#c9b6e6" text-anchor="middle" font-family="sans-serif">' +
    text + '</text></svg>';
  const uri = 'data:image/svg+xml,' + encodeURIComponent(svg);
  _iconPH[ck] = uri;
  return uri;
}

// Canvas 用：缺失精灵画带标签占位方块；返回 true=真实精灵 / false=占位。
export function drawSpriteSafe(ctx, key, x, y, size, label) {
  const img = sprite(key);
  if (img) {
    ctx.drawImage(img, x, y, size, size);
    return true;
  }
  const px = Math.round(x), py = Math.round(y), s = Math.max(8, Math.round(size));
  ctx.save();
  ctx.fillStyle = '#332a45';
  ctx.fillRect(px, py, s, s);
  ctx.strokeStyle = '#8e44ad';
  ctx.lineWidth = Math.max(1, Math.round(s * 0.05));
  ctx.strokeRect(px + 1, py + 1, s - 2, s - 2);
  ctx.fillStyle = '#c9b6e6';
  ctx.font = Math.max(8, Math.round(s * 0.2)) + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(label || key).slice(0, 6), px + s / 2, py + s / 2);
  ctx.restore();
  return false;
}
