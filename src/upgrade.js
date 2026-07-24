import { CONFIG, WEAPONS, PASSIVES, NIGHT_START, unlockInCollection } from './data.js';
import { sprite } from './assets.js';

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
    // 加权随机（对齐吸血鬼幸存者"越拿越来"）：已有未满级装备权重大幅高于新装备，加速单 build 成型
    // 后期压低"再拿新武器"概率、抬升被动，避免 build 失衡；前期不动。
    const W = {
      weaponUp: 5,
      passiveUp: 3 * (1 + 0.5 * late),
      weaponNew: 2 * (1 - 0.85 * late),
      passiveNew: 1 * (1 + 1.0 * late),
    };
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
        pool.push({ kind: 'weapon-new', id: def.id, def, weight: W.weaponNew, isWeapon: true });
      }
    }
    for (const def of Object.values(PASSIVES)) {
      if (this.banned.has(def.id)) continue;
      const lv = player.passives.get(def.id) || 0;
      if (lv >= def.maxLevel) continue;
      // S3：满被动槽时，只跳过尚未拥有的"新被动"；已拥有的被动升级照常（保留后期成长）
      if (lv === 0 && player.passives.size >= player.maxPassives) continue;
      pool.push({ kind: 'passive', id: def.id, def, weight: lv > 0 ? W.passiveUp : W.passiveNew, isWeapon: false });
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
    // 武器配额：池里有武器向时先保底 1 个，杜绝"3 个全是被动"卡 build
    if (pool.some((o) => o.isWeapon)) {
      const weaponsOnly = pool.filter((o) => o.isWeapon);
      const picked = pickWeighted(weaponsOnly);
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
    return { tag: `属性 → LV.${lv + 1}`, tagClass: '', title: option.def.name, desc: option.def.desc, icon: option.def.icon };
  }

  open(options) {
    this.cardsEl.innerHTML = '';
    options.forEach((option, idx) => {
      const info = this.describe(option);
      const card = document.createElement('div');
      card.className = 'upgrade-card';
      const img = document.createElement('img');
      const src = sprite(info.icon);
      img.src = src instanceof HTMLCanvasElement ? src.toDataURL() : (src?.src || '/assets/gem_small.png');
      img.alt = info.title;
      const tag = document.createElement('div');
      tag.className = `uc-kind ${info.tagClass}`;
      tag.textContent = info.tag;
      const h3 = document.createElement('h3');
      h3.textContent = info.title;
      const p = document.createElement('p');
      p.textContent = info.desc;
      const pickBtn = document.createElement('button');
      pickBtn.className = 'uc-pick';
      pickBtn.textContent = '选择';
      card.append(img, tag, h3, p, pickBtn);
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
