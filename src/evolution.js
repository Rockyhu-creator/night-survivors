import { RECIPES, ARTIFACTS, WEAPONS, PASSIVES, unlockInCollection } from './data.js';

// 返回当前可进化的配方（满级武器 + 持有被动 + 尚未拥有该神器），无则返回 null
export function findEvolvableRecipe(player, weaponSystem) {
  for (const r of RECIPES) {
    if (weaponSystem.weaponLevel(r.weapon) < WEAPONS[r.weapon].maxLevel) continue;
    if (!player.passives.has(r.passive)) continue;
    if (weaponSystem.hasArtifact(r.artifact)) continue;
    return r;
  }
  return null;
}

// 玩家是否已有任何可进化配方
export function hasEvolvable(player, weaponSystem) {
  return findEvolvableRecipe(player, weaponSystem) !== null;
}

// 执行进化：移除满级原武器，注入神器，解锁图鉴，返回神器定义
export function performEvolution(player, weaponSystem, recipe) {
  const idx = player.weapons.findIndex((w) => w.id === recipe.weapon);
  if (idx >= 0) player.weapons.splice(idx, 1);
  weaponSystem.addArtifact(recipe.artifact);
  unlockInCollection(recipe.artifact);
  unlockInCollection(recipe.weapon);
  unlockInCollection(recipe.passive);
  return ARTIFACTS[recipe.artifact];
}

// 组装图鉴页数据
export function buildCollectionData(unlocked) {
  const has = (id) => unlocked.includes(id);
  const weapons = Object.values(WEAPONS).map((d) => ({ id: d.id, name: d.name, icon: d.icon, kind: 'weapon', unlocked: has(d.id), desc: d.desc }));
  const passives = Object.values(PASSIVES).map((d) => ({ id: d.id, name: d.name, icon: d.icon, kind: 'passive', unlocked: has(d.id), desc: d.desc }));
  const artifacts = Object.values(ARTIFACTS).map((d) => {
    const recipe = RECIPES.find((r) => r.artifact === d.id);
    const hint = d.rarity === 'hidden' && !has(d.id)
      ? '???（隐藏配方，自行探索）'
      : `${WEAPONS[recipe.weapon].name}(满级) + ${PASSIVES[recipe.passive].name}`;
    return { id: d.id, name: has(d.id) ? d.name : '???', icon: d.icon, kind: 'artifact', rarity: d.rarity, unlocked: has(d.id), desc: d.desc, hint };
  });
  return { weapons, passives, artifacts };
}
