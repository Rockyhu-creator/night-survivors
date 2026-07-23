const files = {
  player: 'player.png',
  bat: 'enemy_bat.png',
  skeleton: 'enemy_skeleton.png',
  slime: 'enemy_slime.png',
  elite: 'enemy_elite.png',
  blade: 'weapon_blade.png',
  holywater: 'weapon_holywater.png',
  axe: 'weapon_axe.png',
  lightning: 'weapon_lightning.png',
  weapon_aura: 'weapon_aura.png',
  weapon_whip: 'weapon_whip.png',
  weapon_cross: 'weapon_cross.png',
  art_storm: 'art_storm.png',
  art_devour: 'art_devour.png',
  art_spiral: 'art_spiral.png',
  art_stormcall: 'art_stormcall.png',
  art_crimson: 'art_crimson.png',
  art_tempest: 'art_tempest.png',
  art_sepulcher: 'art_sepulcher.png',
  art_eternalwhip: 'art_eternalwhip.png',
  art_matrix: 'art_matrix.png',
  portrait_wanderer: 'portrait_wanderer.png',
  portrait_saint: 'portrait_saint.png',
  portrait_berserker: 'portrait_berserker.png',
  portrait_thunder: 'portrait_thunder.png',
  portrait_bloodthirsty: 'portrait_bloodthirsty.png',
  portrait_apostle: 'portrait_apostle.png',
  gemSmall: 'gem_small.png',
  gemMedium: 'gem_medium.png',
  gemLarge: 'gem_large.png',
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

export function hasImage(key) {
  return Boolean(images[key]);
}

export function loadAssets(onProgress) {
  const keys = Object.keys(files);
  let done = 0;
  return Promise.all(keys.map((key) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      images[key] = img;
      done += 1;
      onProgress?.(done / keys.length);
      resolve();
    };
    img.onerror = () => {
      images[key] = null;
      done += 1;
      onProgress?.(done / keys.length);
      resolve();
    };
    img.src = `/assets/${files[key]}`;
  })));
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

export function sprite(key) {
  const img = images[key];
  if (!img) return null;
  if (!processed[key]) {
    // ground/bg 原样使用；精灵类自动裁掉透明边距，让绘制尺寸贴近视觉尺寸
    processed[key] = (key === 'ground') ? img : trimTransparent(img);
  }
  return processed[key];
}
