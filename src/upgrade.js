import { CONFIG, WEAPONS, PASSIVES, NIGHT_START, unlockInCollection, RECIPES, ARTIFACTS, loadCollection } from './data.js';
import { sprite } from './assets.js';
import { findEvolvableRecipe } from './evolution.js';

// ---------- 合成提示（方案 A+B，详见 design/plans/2026-07-26-synth-hint-design.md §5）----------
// 设置开关：当前项目无统一设置 UI（各模块各自读写 localStorage，见 audio.js / ui.js）。
// 故此处默认开启，不新建复杂设置面板；后续版本接入统一设置时改为读取 localStorage（TODO）。
const SHOW_RECIPE_HINTS = true;

// v2.0 · D4（用户已拍板）：已拥有基础武器种类少 → 仅对 8 把 v2.0 新武器提高权重，
// 保 build 收敛与心流；原 8 把武器与被动权重完全不变。
const BOOST_THRESHOLD = 4;     // 已拥有基础武器 < 4 种时触发加成 [校准]
const NEW_WEAPON_BOOST = 1.5; // v2.0 新武器权重乘数 [校准]
const V2_WEAPON_IDS = new Set([
  'starfall', 'judgment', 'phantom', 'aegis',
  'warden', 'maul', 'sanguine', 'resolve',
]);

// 方案 A：选中此被动后，下一次开箱「真会」进化吗？
// 「选后即持有」语义：把该被动临时并入模拟持有集合，再复用引擎 findEvolvableRecipe，
// 不手动复制 passives.has（避免与真实进化逻辑漂移），并按 §1.4 全局顺序返回真实会触发的配方，杜绝误导。
function readyRecipeForPassive(passiveId, player, weaponSystem) {
  const simPassives = new Set(player.passives.keys());
  simPassives.add(passiveId);
  const r = findEvolvableRecipe({ passives: simPassives }, weaponSystem);
  return r && r.passive === passiveId ? r : null;
}

// 本被动「尚未拥有」的全部配方（按 RECIPES 顺序），用于方案 B 精炼行；已拥有的神器不再提示，避免误导。
function pendingRecipesForPassive(passiveId, weaponSystem) {
  return RECIPES.filter((r) => r.passive === passiveId && !weaponSystem.hasArtifact(r.artifact));
}

// 神器显示名：hidden 且未解锁 → "???"，与图鉴 buildCollectionData 遮罩一致，不泄露隐藏配方。
function artifactDisplayName(artifactId, unlockedSet) {
  const def = ARTIFACTS[artifactId];
  const hidden = def && def.rarity === 'hidden';
  const unlocked = hidden ? unlockedSet.has(artifactId) : true;
  return hidden && !unlocked ? '???' : (def ? def.name : artifactId);
}

export class UpgradeSystem {
  constructor(game) {
    this.game = game;
    this.screen = document.getElementById('levelup-screen');
    this.cardsEl = document.getElementById('upgrade-cards');
    this.banned = new Set(); // 本局被放逐的选项 id，Banish 会写入
    this.currentOptions = [];
    this.buildActionBar();
  }

  buildActionBar() {
    // 升级界面顶部操作条：Reroll 重掷 / Banish 放逐
    const bar = document.createElement('div');
    bar.id = 'upgrade-actions';
    bar.innerHTML = `
      <button id="btn-reroll" class="ua-btn">重掷 <span id="reroll-count">3</span></button>
      <button id="btn-banish" class="ua-btn">放逐 <span id="banish-count">3</span></button>
      <p class="ua-hint">重掷:换一组三选一;放逐:选中一项后点放逐,本局不再出现</p>
      <p id="slot-count" class="ua-slots"></p>
    `;
    this.screen.insertBefore(bar, this.cardsEl);
    this.rerollBtn = bar.querySelector('#btn-reroll');
    this.banishBtn = bar.querySelector('#btn-banish');
    this.rerollCountEl = bar.querySelector('#reroll-count');
    this.banishCountEl = bar.querySelector('#banish-count');
    this.slotCountEl = bar.querySelector('#slot-count');
    this.rerollBtn.addEventListener('click', () => this.reroll());
    this.banishBtn.addEventListener('click', () => this.banish());
  }

  reset() {
    // 每局重置计数与放逐表
    this.banned.clear();
    this.selectedIdx = -1;
    this.game.rerollsLeft = 3;
    this.game.banishesLeft = 3;
    this.updateActionBar();
  }

  updateActionBar() {
    this.rerollCountEl.textContent = this.game.rerollsLeft;
    this.banishCountEl.textContent = this.game.banishesLeft;
    this.rerollBtn.disabled = this.game.rerollsLeft <= 0;
    this.banishBtn.disabled = this.game.banishesLeft <= 0 || this.selectedIdx < 0;
    const p = this.game.player;
    this.slotCountEl.textContent = `武器 ${p.weapons.length}/${p.maxWeapons} · 被动 ${p.passives.size}/${p.maxPassives}`;
  }

  buildPool() {
    const player = this.game.player;
    const pool = [];
    // 后期偏置：t>=NIGHT_START(540) 起渐强，至 ENDGAME(900) 满档；前期 late=0 与现状完全一致。
    const t = this.game.time || 0;
    const late = Math.max(0, Math.min(1, (t - NIGHT_START) / 360));
    // 加权随机（对齐吸血鬼幸存者"越拿越来"）：已有未满级武器权重大幅高于新武器，加速单 build 成型
    // 后期压低"再拿新武器"概率，避免 build 失衡；前期不动。
    const W = {
      weaponUp: 5,
      weaponNew: 2 * (1 - 0.85 * late),
    };
    // D4（v2.0）：已拥有基础武器种类少 → 提高新武器权重，保 build 收敛与心流
    // 复用模块级 BOOST_THRESHOLD / NEW_WEAPON_BOOST（upgrade.js 顶部，lines 12-14）。
    const ownedWeaponKinds = player.weapons.filter((w) => !w.artifact).length; // 仅计基础武器，不含神器
    const newWeaponMul = ownedWeaponKinds < BOOST_THRESHOLD ? NEW_WEAPON_BOOST : 1;
    // D3 分类权重：统计玩家已投资各分类的被动等级总和。
    // 候选被动最终权重 = 1 + Δ·catCount[category]（Δ=0.6[校准]），走某流派时更易滚到同系被动、成型更顺。
    const DELTA = 0.6;
    const catCount = { offense: 0, survival: 0, utility: 0 };
    for (const [pid, lv] of player.passives) {
      const def = PASSIVES[pid];
      if (def && def.category) catCount[def.category] += lv;
    }
    // S3 武器计数含神器（同 player.weapons 数组），与 addWeapon 口径一致
    const weaponCount = player.weapons.length;
    for (const def of Object.values(WEAPONS)) {
      if (this.banned.has(def.id)) continue;
      if (this.game.weapons.hasWeapon(def.id)) {
        if (this.game.weapons.weaponLevel(def.id) < def.maxLevel) {
          pool.push({ kind: 'weapon-up', id: def.id, def, weight: W.weaponUp, isWeapon: true });
        }
      } else if (weaponCount < player.maxWeapons) {
        // S3：满武器槽不再提供新武器卡（保留已有武器升级），逼出 build 取舍
        pool.push({ kind: 'weapon-new', id: def.id, def, weight: W.weaponNew * newWeaponMul, isWeapon: true });
      }
    }
    for (const def of Object.values(PASSIVES)) {
      if (this.banned.has(def.id)) continue;
      const lv = player.passives.get(def.id) || 0;
      if (lv >= def.maxLevel) continue;
      // S3：满被动槽时，只跳过尚未拥有的"新被动"；已拥有的被动升级照常（保留后期成长）
      if (lv === 0 && player.passives.size >= player.maxPassives) continue;
      const catW = def.category ? 1 + DELTA * catCount[def.category] : 1;
      pool.push({ kind: 'passive', id: def.id, def, weight: catW, isWeapon: false });
    }
    return pool;
  }

  rollOptions() {
    const pool = this.buildPool();
    const options = [];
    // 加权不放回抽样：按 weight 随机，抽中即移出池
    const pickWeighted = (arr) => {
      const total = arr.reduce((s, o) => s + (o.weight || 1), 0);
      let roll = Math.random() * total;
      for (let i = 0; i < arr.length; i += 1) {
        roll -= arr[i].weight || 1;
        if (roll <= 0) return arr.splice(i, 1)[0];
      }
      return arr.pop();
    };
    // 保底 1 张武器向：池中有武器时优先武器（保证每层至少能拿到武器，对齐玩家预期与旧配额测试）；
    // 仅当无武器可给（全武器满级）时才退化为进攻向被动（D5/§5.3：防"三张全生存向"卡 build）。
    const weaponsOnly = pool.filter((o) => o.isWeapon);
    const offenseFallback = pool.filter((o) => o.def && o.def.category === 'offense');
    if (weaponsOnly.length > 0) {
      const picked = pickWeighted(weaponsOnly);
      options.push(picked);
      pool.splice(pool.indexOf(picked), 1);
    } else if (offenseFallback.length > 0) {
      const picked = pickWeighted(offenseFallback);
      options.push(picked);
      pool.splice(pool.indexOf(picked), 1);
    }
    while (options.length < 3 && pool.length > 0) {
      options.push(pickWeighted(pool));
    }
    // 打乱展示顺序，避免"第一个固定是武器"的察觉
    for (let i = options.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    this.currentOptions = options;
    this.selectedIdx = -1;
    this.updateActionBar();
    return options;
  }

  reroll() {
    if (this.game.rerollsLeft <= 0) return;
    this.game.rerollsLeft -= 1;
    const options = this.rollOptions();
    if (options.length === 0) return;
    this.open(options);
  }

  banish() {
    if (this.game.banishesLeft <= 0 || this.selectedIdx < 0) return;
    const opt = this.currentOptions[this.selectedIdx];
    this.banned.add(opt.id);
    this.game.banishesLeft -= 1;
    const options = this.rollOptions();
    if (options.length === 0) return;
    this.open(options);
  }

  describe(option) {
    const player = this.game.player;
    if (option.kind === 'weapon-new') {
      return { tag: '新武器', tagClass: 'new', title: option.def.name, desc: option.def.desc, icon: option.def.icon };
    }
    if (option.kind === 'weapon-up') {
      const lv = this.game.weapons.weaponLevel(option.id);
      const next = WEAPONS[option.id].levels[lv];
      const bits = [];
      if (next.damage) bits.push(`伤害 ${next.damage}`);
      if (next.count) bits.push(`数量 ${next.count}`);
      if (next.strikes) bits.push(`落雷 ${next.strikes}`);
      if (next.radius) bits.push(`半径 ${next.radius}`);
      if (next.length) bits.push(`长度 ${next.length}`);
      if (next.width) bits.push(`宽度 ${next.width}`);
      if (next.cooldown) bits.push(`冷却 ${next.cooldown}s`);
      return { tag: `升级 → LV.${lv + 1}`, tagClass: '', title: option.def.name, desc: bits.join(' · '), icon: option.def.icon };
    }
    const lv = player.passives.get(option.id) || 0;
    const info = { tag: `属性 → LV.${lv + 1}`, tagClass: '', title: option.def.name, desc: option.def.desc, icon: option.def.icon };
    // 方案 A+B：被动卡合成提示（仅被动卡）
    const ready = readyRecipeForPassive(option.id, player, this.game.weapons);
    if (ready) {
      info.evoReady = ready; // 方案 A：选后即进化（金徽章）
    } else if (SHOW_RECIPE_HINTS) {
      const pending = pendingRecipesForPassive(option.id, this.game.weapons);
      if (pending.length > 0) info.recipeHint = pending; // 方案 B：精炼配方行
    }
    return info;
  }

  open(options) {
    this.cardsEl.innerHTML = '';
    const unlockedSet = new Set(loadCollection().unlocked);
    options.forEach((option, idx) => {
      const info = this.describe(option);
      const card = document.createElement('div');
      card.className = 'upgrade-card';
      const img = document.createElement('img');
      const src = sprite(info.icon);
      img.src = src instanceof HTMLCanvasElement ? src.toDataURL() : (src?.src || '/assets/gem_small.png');
      img.alt = info.title;
      card.appendChild(img);
      const body = document.createElement('div');
      body.className = 'uc-body';
      const tag = document.createElement('div');
      tag.className = `uc-kind ${info.tagClass}`;
      tag.textContent = info.tag;
      const h3 = document.createElement('h3');
      h3.textContent = info.title;
      const p = document.createElement('p');
      p.textContent = info.desc;
      // 方案 A：进化就绪金徽章（置顶，不占额外纵向高度；CSS 脉冲，无 per-frame shadowBlur）
      if (info.evoReady) {
        const badge = document.createElement('div');
        badge.className = 'uc-evo-ready';
        const artName = artifactDisplayName(info.evoReady.artifact, unlockedSet);
        badge.textContent = `⚡ 进化就绪 · 拾箱即合成 ✨${artName}`;
        body.append(badge, tag, h3, p);
      } else {
        body.append(tag, h3, p);
      }
      // 方案 B：精炼配方行（desc 下方，灰青；多目标只列首条 + 等 N 种）
      if (info.recipeHint) {
        const recipe = info.recipeHint[0];
        const artName = artifactDisplayName(recipe.artifact, unlockedSet);
        const wName = WEAPONS[recipe.weapon].name;
        const row = document.createElement('div');
        row.className = 'uc-recipe';
        let text = `可合成 ✨${artName} = 满级🗡️${wName} + 本被动`;
        if (info.recipeHint.length > 1) text += ` 等 ${info.recipeHint.length} 种 ›`;
        row.textContent = text;
        body.append(row);
      }
      card.appendChild(body);
      const pickBtn = document.createElement('button');
      pickBtn.className = 'uc-pick';
      pickBtn.textContent = '选择';
      card.appendChild(pickBtn);
      // 卡片本体点击=标记为放逐目标；按钮点击=选择该项
      card.addEventListener('click', () => {
        this.cardsEl.querySelectorAll('.upgrade-card').forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedIdx = idx;
        this.updateActionBar();
      });
      pickBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.apply(option);
        this.screen.classList.add('hidden');
        this.game.resumeFromUpgrade();
      }, { once: true });
      this.cardsEl.appendChild(card);
    });
    this.screen.classList.remove('hidden');
  }

  apply(option) {
    const player = this.game.player;
    if (option.kind === 'weapon-new') {
      this.game.weapons.addWeapon(option.id);
    } else if (option.kind === 'weapon-up') {
      this.game.weapons.upgradeWeapon(option.id);
    } else {
      const lv = (player.passives.get(option.id) || 0) + 1;
      player.passives.set(option.id, lv);
      option.def.apply(player);
    }
    this.game.ui.refreshLoadout();
    unlockInCollection(option.id);
  }
}
