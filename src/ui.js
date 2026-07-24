import { CONFIG, WEAPONS, PASSIVES, ARTIFACTS, expForLevel, loadBest, saveBest, formatTime, loadCollection, ALTAR, BLOODLINES, loadSouls, buyUnlock, buyBloodlineUnlock, getSelectedBloodline, isBloodlineUnlocked } from './data.js';
import { buildCollectionData } from './evolution.js';
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
    this.victoryScreen = document.getElementById('victory-screen');
    this.victoryNewRecordEl = document.getElementById('victory-new-record');
    this.victoryStatsEl = document.getElementById('victory-stats');
    this.soulBalanceEl = document.getElementById('soul-balance');
    this.altarScreen = document.getElementById('altar-screen');
    this.altarBalanceEl = document.getElementById('altar-balance');
    this.altarContentEl = document.getElementById('altar-content');
    this.bloodlineBtnEl = document.getElementById('btn-bloodline');
    this.bloodlineScreen = document.getElementById('bloodline-screen');
    this.bloodlineBalanceEl = document.getElementById('bloodline-balance');
    this.bloodlineContentEl = document.getElementById('bloodline-content');
    this.vignette = document.getElementById('damage-vignette');
    this.bossBarWrap = document.getElementById('boss-bar-wrap');
    this.bossName = document.getElementById('boss-name');
    this.bossBarFill = document.getElementById('boss-bar-fill');
    this.bossWarning = document.getElementById('boss-warning');
    this.warnName = document.getElementById('warn-name');
    this.guideScreen = document.getElementById('guide-screen');
    this.guideCloseBtn = document.getElementById('btn-guide-close');
    this.vignetteAlpha = 0;
    this.spawnTitleBats();
    this.guideCloseBtn.addEventListener('click', () => { this.game.audio.uiClick(); this.hideGuide(); });
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
    // 灵魂货币：主界面显示累计余额
    const souls = loadSouls();
    this.soulBalanceEl.classList.remove('hidden');
    this.soulBalanceEl.textContent = `👁 灵魂  ${souls.balance}`;
    // 血裔：标题按钮显示当前选定血裔
    const bl = BLOODLINES.find((b) => b.id === getSelectedBloodline()) || BLOODLINES[0];
    if (this.bloodlineBtnEl) this.bloodlineBtnEl.textContent = `血裔：${bl.name}`;
    // 首启自动弹玩法说明（localStorage 记忆，仅首次）。try/catch 防隐私模式抛异常（P0）
    let guideSeen = false;
    try { guideSeen = localStorage.getItem('ns_guide_seen') === '1'; } catch (_) { /* 禁用则跳过 */ }
    if (!guideSeen) this.showGuide();
  }

  showGuide() { this.guideScreen.classList.remove('hidden'); }
  hideGuide() {
    this.guideScreen.classList.add('hidden');
    try { localStorage.setItem('ns_guide_seen', '1'); } catch (_) { /* 禁用则跳过 */ }
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
    this.updateBossBar();
  }

  flashVignette() {
    this.vignetteAlpha = 0.95;
    this.vignette.style.opacity = '0.95';
  }

  showBossWarning(name) {
    this.warnName.textContent = name;
    this.bossWarning.classList.remove('hidden');
    clearTimeout(this._warnTimer);
    this._warnTimer = setTimeout(() => {
      this.bossWarning.classList.add('hidden');
      this.showBossBar(name);
    }, 2200);
  }

  showBossBar(name) {
    this.bossName.textContent = name;
    this.bossBarWrap.classList.remove('hidden');
    this.bossBarFill.style.width = '100%';
  }

  updateBossBar() {
    const boss = this.game.enemies.activeBoss;
    if (!boss) return;
    const pct = Math.max(0, (boss.hp / boss.maxHp) * 100);
    this.bossBarFill.style.width = `${pct}%`;
  }

  hideBossBar() {
    this.bossBarWrap.classList.add('hidden');
  }

  showEvolutionBanner(artifact) {
    const el = document.getElementById('evolution-banner');
    document.getElementById('evo-name').textContent = artifact.name;
    document.getElementById('evo-desc').textContent = artifact.desc;
    el.classList.remove('hidden');
    clearTimeout(this._evoTimer);
    this._evoTimer = setTimeout(() => el.classList.add('hidden'), 2600);
  }

  showToast(text) {
    const el = document.getElementById('toast');
    el.textContent = text;
    el.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.add('hidden'), 1800);
  }

  refreshLoadout() {
    const player = this.game.player;
    this.loadoutEl.innerHTML = '';
    const counter = document.createElement('div');
    counter.className = 'loadout-slots';
    counter.textContent = `武器 ${player.weapons.length}/${player.maxWeapons} · 被动 ${player.passives.size}/${player.maxPassives}`;
    this.loadoutEl.appendChild(counter);
    for (const w of player.weapons) {
      const def = WEAPONS[w.id] || ARTIFACTS[w.id];
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
      ['获得灵魂', `${game.runSouls}`],
      ['灵魂累计', `${game.totalSouls}`],
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

  showVictory() {
    const game = this.game;
    this.hud.classList.add('hidden');
    const result = { time: Math.floor(game.time), kills: game.kills, level: game.player.level };
    const prev = loadBest();
    const isRecord = !prev || result.time > prev.time;
    if (isRecord) saveBest(result);
    this.victoryNewRecordEl.classList.toggle('hidden', !isRecord);
    this.victoryStatsEl.innerHTML = '';
    const lines = [
      ['通关时间', formatTime(result.time)],
      ['击杀怪物', `${result.kills}`],
      ['抵达等级', `LV.${result.level}`],
      ['最佳纪录', formatTime((isRecord ? result : prev).time)],
      ['获得灵魂', `${game.runSouls}`],
      ['灵魂累计', `${game.totalSouls}`],
    ];
    for (const [label, value] of lines) {
      const div = document.createElement('div');
      div.className = 'stat-line';
      const b = document.createElement('b');
      b.textContent = label;
      const span = document.createElement('span');
      span.textContent = value;
      div.append(b, span);
      this.victoryStatsEl.appendChild(div);
    }
    this.victoryScreen.classList.remove('hidden');
  }

  showCodex() {
    const { unlocked } = loadCollection();
    const data = buildCollectionData(unlocked);
    const root = document.getElementById('codex-content');
    root.innerHTML = '';
    const sections = [['武器', data.weapons], ['被动道具', data.passives], ['神器', data.artifacts]];
    for (const [title, items] of sections) {
      const sec = document.createElement('div');
      sec.className = 'codex-section';
      const h = document.createElement('h3');
      h.textContent = title;
      sec.appendChild(h);
      const grid = document.createElement('div');
      grid.className = 'codex-grid';
      for (const item of items) {
        const card = document.createElement('div');
        card.className = `codex-card ${item.unlocked ? '' : 'locked'} ${item.rarity === 'hidden' ? 'hidden-item' : ''}`;
        const img = document.createElement('img');
        img.src = this.iconURL(item.icon);
        img.alt = item.name;
        const name = document.createElement('p');
        name.className = 'cc-name';
        name.textContent = item.name;
        card.append(img, name);
        if (item.hint) {
          const hint = document.createElement('p');
          hint.className = 'cc-hint';
          hint.textContent = item.hint;
          card.appendChild(hint);
        } else if (item.desc && item.unlocked) {
          const desc = document.createElement('p');
          desc.className = 'cc-hint';
          desc.textContent = item.desc;
          card.appendChild(desc);
        }
        grid.appendChild(card);
      }
      sec.appendChild(grid);
      root.appendChild(sec);
    }
    document.getElementById('codex-screen').classList.remove('hidden');
    document.getElementById('title-screen').classList.add('hidden');
  }

  hideCodex() {
    document.getElementById('codex-screen').classList.add('hidden');
    document.getElementById('title-screen').classList.remove('hidden');
  }

  showAltar() {
    this.titleScreen.classList.add('hidden');
    this.altarScreen.classList.remove('hidden');
    this.renderAltar();
  }

  hideAltar() {
    this.altarScreen.classList.add('hidden');
    this.showTitle();
  }

  renderAltar() {
    const souls = loadSouls();
    this.altarBalanceEl.textContent = `👁 灵魂  ${souls.balance}`;
    this.altarContentEl.innerHTML = '';
    for (const def of ALTAR) {
      const owned = souls.unlocks.includes(def.id);
      const affordable = souls.balance >= def.cost;
      const card = document.createElement('div');
      card.className = `altar-card ${owned ? 'owned' : ''}`;

      const img = document.createElement('img');
      img.src = this.iconURL(def.icon);
      img.alt = def.name;

      const name = document.createElement('h3');
      name.textContent = def.name;

      const desc = document.createElement('p');
      desc.className = 'ac-desc';
      desc.textContent = def.desc;

      const btn = document.createElement('button');
      btn.className = 'gothic-btn ac-buy';
      if (owned) {
        btn.textContent = '已解锁';
        btn.disabled = true;
        btn.classList.add('owned-btn');
      } else if (!affordable) {
        btn.textContent = `👁 ${def.cost}`;
        btn.disabled = true;
      } else {
        btn.textContent = `👁 ${def.cost}`;
        btn.addEventListener('click', () => {
          if (buyUnlock(def.id)) {
            this.game.audio.uiClick();
            this.renderAltar();
          }
        });
      }

      card.append(img, name, desc, btn);
      this.altarContentEl.appendChild(card);
    }
  }

  showBloodline() {
    this.titleScreen.classList.add('hidden');
    this.bloodlineScreen.classList.remove('hidden');
    this.renderBloodline();
  }

  hideBloodline() {
    this.bloodlineScreen.classList.add('hidden');
    this.showTitle();
  }

  renderBloodline() {
    const souls = loadSouls();
    const selected = getSelectedBloodline();
    this.bloodlineBalanceEl.textContent = `👁 灵魂  ${souls.balance}`;
    this.bloodlineContentEl.innerHTML = '';
    for (const def of BLOODLINES) {
      // 隐藏血裔（永夜使徒）仅在已解锁后显示，制造发现感
      const unlocked = isBloodlineUnlocked(def.id);
      if (def.hidden && !unlocked) continue;
      const isSelected = def.id === selected;
      const affordable = souls.balance >= def.cost;
      const card = document.createElement('div');
      card.className = `altar-card ${unlocked ? 'owned' : ''} ${isSelected ? 'selected' : ''}`;

      const img = document.createElement('img');
      img.src = this.iconURL(def.icon);
      img.alt = def.name;

      const name = document.createElement('h3');
      name.textContent = def.name;

      const desc = document.createElement('p');
      desc.className = 'ac-desc';
      desc.textContent = def.desc;

      const btn = document.createElement('button');
      btn.className = 'gothic-btn ac-buy';
      if (isSelected) {
        btn.textContent = '使用中';
        btn.disabled = true;
        btn.classList.add('owned-btn');
      } else if (unlocked) {
        btn.textContent = '选择';
        btn.addEventListener('click', () => {
          if (this.game.setBloodline(def.id)) {
            this.game.audio.uiClick();
            this.renderBloodline();
          }
        });
      } else if (affordable) {
        btn.textContent = `👁 ${def.cost} 解锁`;
        btn.addEventListener('click', () => {
          if (buyBloodlineUnlock(def.id) && this.game.setBloodline(def.id)) {
            this.game.audio.uiClick();
            this.renderBloodline();
          }
        });
      } else {
        btn.textContent = `👁 ${def.cost}`;
        btn.disabled = true;
      }

      // 初始武器说明（纯文本，不放图标）
      const wLine = document.createElement('p');
      wLine.className = 'bl-weapon';
      if (def.weapon) {
        const wdef = WEAPONS[def.weapon];
        wLine.innerHTML = `初始武器：<b>${wdef.name}</b><br><span class="bl-wdesc">${wdef.desc}</span>`;
      } else {
        wLine.innerHTML = `初始武器：<b>无</b><br><span class="bl-wdesc">纯血裔天赋流</span>`;
      }

      card.append(img, name, wLine, desc, btn);
      this.bloodlineContentEl.appendChild(card);
    }
  }
}
