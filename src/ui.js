import { CONFIG, WEAPONS, PASSIVES, expForLevel, loadBest, saveBest, formatTime } from './data.js';
import { sprite } from './assets.js';

export class UIManager {
  constructor(game) {
    this.game = game;
    this.hud = document.getElementById('hud');
    this.expBar = document.getElementById('exp-bar');
    this.levelText = document.getElementById('level-text');
    this.hpBar = document.getElementById('hp-bar');
    this.hpText = document.getElementById('hp-text');
    this.timerEl = document.getElementById('timer');
    this.killEl = document.getElementById('kill-count');
    this.loadoutEl = document.getElementById('loadout');
    this.titleScreen = document.getElementById('title-screen');
    this.gameoverScreen = document.getElementById('gameover-screen');
    this.bestRecordEl = document.getElementById('best-record');
    this.newRecordEl = document.getElementById('new-record');
    this.finalStatsEl = document.getElementById('final-stats');
    this.vignette = document.getElementById('damage-vignette');
    this.vignetteAlpha = 0;
    this.spawnTitleBats();
  }

  spawnTitleBats() {
    const layer = document.getElementById('bat-layer');
    for (let i = 0; i < 9; i += 1) {
      const bat = document.createElement('div');
      bat.className = 'bat';
      bat.style.top = `${5 + Math.random() * 55}%`;
      bat.style.animationDuration = `${9 + Math.random() * 14}s`;
      bat.style.animationDelay = `${-Math.random() * 15}s`;
      bat.style.setProperty('--s', (0.5 + Math.random() * 1.4).toFixed(2));
      layer.appendChild(bat);
    }
  }

  iconURL(key) {
    const src = sprite(key);
    if (!src) return '';
    return src instanceof HTMLCanvasElement ? src.toDataURL() : src.src;
  }

  showTitle() {
    this.titleScreen.classList.remove('hidden');
    this.gameoverScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    const best = loadBest();
    if (best) {
      this.bestRecordEl.classList.remove('hidden');
      this.bestRecordEl.textContent = `最佳纪录  ${formatTime(best.time)}  ·  击杀 ${best.kills}  ·  LV.${best.level}`;
    } else {
      this.bestRecordEl.classList.add('hidden');
    }
  }

  startGame() {
    this.titleScreen.classList.add('hidden');
    this.gameoverScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.refreshLoadout();
  }

  update(dt) {
    const game = this.game;
    const player = game.player;
    this.expBar.style.width = `${Math.min(100, (player.exp / expForLevel(player.level)) * 100)}%`;
    this.levelText.textContent = `LV.${player.level}`;
    this.hpBar.style.width = `${Math.max(0, (player.hp / player.maxHp) * 100)}%`;
    this.hpText.textContent = `${Math.max(0, Math.ceil(player.hp))} / ${player.maxHp}`;
    this.timerEl.textContent = formatTime(game.time);
    this.killEl.textContent = `☠ ${game.kills}`;
    if (this.vignetteAlpha > 0) {
      this.vignetteAlpha = Math.max(0, this.vignetteAlpha - dt * 2.4);
      this.vignette.style.opacity = this.vignetteAlpha.toFixed(2);
    }
  }

  flashVignette() {
    this.vignetteAlpha = 0.95;
    this.vignette.style.opacity = '0.95';
  }

  refreshLoadout() {
    const player = this.game.player;
    this.loadoutEl.innerHTML = '';
    for (const w of player.weapons) {
      const def = WEAPONS[w.id];
      const div = document.createElement('div');
      div.className = 'loadout-icon';
      const img = document.createElement('img');
      img.src = this.iconURL(def.icon);
      img.alt = def.name;
      const lv = document.createElement('span');
      lv.className = 'loadout-lv';
      lv.textContent = w.level;
      div.append(img, lv);
      this.loadoutEl.appendChild(div);
    }
    for (const [id, lv] of player.passives) {
      const def = PASSIVES[id];
      const div = document.createElement('div');
      div.className = 'loadout-icon passive';
      const img = document.createElement('img');
      img.src = this.iconURL(def.icon);
      img.alt = def.name;
      const lvEl = document.createElement('span');
      lvEl.className = 'loadout-lv';
      lvEl.textContent = lv;
      div.append(img, lvEl);
      this.loadoutEl.appendChild(div);
    }
  }

  showGameOver() {
    const game = this.game;
    this.hud.classList.add('hidden');
    const result = { time: Math.floor(game.time), kills: game.kills, level: game.player.level };
    const prev = loadBest();
    const isRecord = !prev || result.time > prev.time;
    if (isRecord) saveBest(result);
    this.newRecordEl.classList.toggle('hidden', !isRecord);
    this.finalStatsEl.innerHTML = '';
    const lines = [
      ['存活时间', formatTime(result.time)],
      ['击杀怪物', `${result.kills}`],
      ['抵达等级', `LV.${result.level}`],
      ['最佳纪录', formatTime((isRecord ? result : prev).time)],
    ];
    for (const [label, value] of lines) {
      const div = document.createElement('div');
      div.className = 'stat-line';
      const b = document.createElement('b');
      b.textContent = label;
      const span = document.createElement('span');
      span.textContent = value;
      div.append(b, span);
      this.finalStatsEl.appendChild(div);
    }
    this.gameoverScreen.classList.remove('hidden');
  }
}
