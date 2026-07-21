import { CONFIG, WEAPONS, PASSIVES, unlockInCollection } from './data.js';
import { sprite } from './assets.js';

export class UpgradeSystem {
  constructor(game) {
    this.game = game;
    this.screen = document.getElementById('levelup-screen');
    this.cardsEl = document.getElementById('upgrade-cards');
  }

  buildPool() {
    const player = this.game.player;
    const pool = [];
    for (const def of Object.values(WEAPONS)) {
      if (this.game.weapons.hasWeapon(def.id)) {
        if (this.game.weapons.weaponLevel(def.id) < def.maxLevel) {
          pool.push({ kind: 'weapon-up', id: def.id, def });
        }
      } else {
        pool.push({ kind: 'weapon-new', id: def.id, def });
      }
    }
    for (const def of Object.values(PASSIVES)) {
      const lv = player.passives.get(def.id) || 0;
      if (lv < def.maxLevel) pool.push({ kind: 'passive', id: def.id, def });
    }
    return pool;
  }

  rollOptions() {
    const pool = this.buildPool();
    const options = [];
    while (options.length < 3 && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      options.push(pool.splice(idx, 1)[0]);
    }
    return options;
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
      if (next.cooldown) bits.push(`冷却 ${next.cooldown}s`);
      return { tag: `升级 → LV.${lv + 1}`, tagClass: '', title: option.def.name, desc: bits.join(' · '), icon: option.def.icon };
    }
    const lv = player.passives.get(option.id) || 0;
    return { tag: `属性 → LV.${lv + 1}`, tagClass: '', title: option.def.name, desc: option.def.desc, icon: option.def.icon };
  }

  open(options) {
    this.cardsEl.innerHTML = '';
    for (const option of options) {
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
      card.append(img, tag, h3, p);
      card.addEventListener('click', () => {
        this.apply(option);
        this.screen.classList.add('hidden');
        this.game.resumeFromUpgrade();
      }, { once: true });
      this.cardsEl.appendChild(card);
    }
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
