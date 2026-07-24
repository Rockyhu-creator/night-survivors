import { CONFIG, WEAPONS, PASSIVES, ARTIFACTS, expForLevel, loadBest, saveBest, formatTime, loadCollection, ALTAR, BLOODLINES, ENEMY_TYPES, BOSSES, loadSouls, buyUnlock, buyBloodlineUnlock, getSelectedBloodline, isBloodlineUnlocked } from './data.js';
import { buildCollectionData } from './evolution.js';
import { sprite } from './assets.js';

// 怪物图鉴描述（基于实际行为，不剧透公式）
const MONSTER_LORE = {
  bat: '高速直冲,成群结队,单体孱弱',
  skeleton: '直线追击的骷髅,基础杂兵',
  slime: '缓慢但厚实,死亡时可能引爆',
  elite: '周期降临的精英,高血高伤,优先清理',
  shadow_hunter: '进入 250px 后蓄力冲刺,突进极快',
  gargoyle: '免疫击退的肉盾,缓慢却坚硬',
  baron: '首位降临的 Boss,召唤蝙蝠并弹幕',
  queen: '苍白女王,多重弹幕与位移',
  overlord: '永夜君王,半场后狂暴',
  avatar: '终局化身,击杀即通关',
};

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
    // 战利品指引（指向未拾取宝箱）：左下角底边箭头 + 屏内脉冲环
    this.lootBeacon = document.getElementById('loot-beacon');
    this.lootArrow = document.getElementById('loot-arrow');
    this.lootRing = document.getElementById('loot-ring');
    this.lootLabel = document.getElementById('loot-label');
    if (this.lootLabel) this.lootLabel.textContent = '宝箱';
    this._lootInset = 46; // 边缘箭头距屏幕边的内缩（CSS px）
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
    // 血裔：标题按钮显示当前选定血裔 + 角色头像图标
    const bl = BLOODLINES.find((b) => b.id === getSelectedBloodline()) || BLOODLINES[0];
    if (this.bloodlineBtnEl) {
      const span = this.bloodlineBtnEl.querySelector('span');
      if (span) span.textContent = `血裔：${bl.name}`;
      const icon = document.getElementById('btn-bloodline-icon');
      if (icon) icon.src = `/assets/${bl.icon}.png`;
    }
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
    this.hideLootBeacon();
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
    this.updateLootBeacon();
  }

  // 战利品指引：每帧定位最近的未拾取宝箱，屏外给边缘方向箭头、屏内给精确脉冲环
  updateLootBeacon() {
    const g = this.game, cam = g.camera, player = g.player;
    const gems = g.pickups ? g.pickups.gems : null;
    let best = null, bestD = Infinity;
    if (gems) {
      for (const gm of gems) {
        if (!gm.chest) continue; // 仅指引宝箱（boss/普通）
        const d = (gm.x - player.x) ** 2 + (gm.y - player.y) ** 2;
        if (d < bestD) { bestD = d; best = gm; }
      }
    }
    if (!best) { this.lootBeacon.classList.add('hidden'); return; }
    this.lootBeacon.classList.remove('hidden');

    const canvas = g.canvas;
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width / canvas.width, sy = rect.height / canvas.height;
    const cssX = rect.left + (best.x - cam.ox) * sx;
    const cssY = rect.top + (best.y - cam.oy) * sy;
    const m = this._lootInset;
    const left = rect.left + m, right = rect.right - m, top = rect.top + m, bottom = rect.bottom - m;
    const onX = cssX >= left && cssX <= right;
    const onY = cssY >= top && cssY <= bottom;

    if (onX && onY) {
      // 屏内：精确脉冲环（永远盖在怪物之上，解决被遮挡问题）
      this.lootArrow.style.display = 'none';
      this.lootRing.style.display = 'block';
      this.lootRing.style.left = `${cssX}px`;
      this.lootRing.style.top = `${cssY}px`;
      this.lootLabel.style.display = 'block';
      this.lootLabel.style.left = `${cssX}px`;
      this.lootLabel.style.top = `${cssY + 38}px`;
    } else {
      // 屏外/贴边：边缘方向箭头
      this.lootRing.style.display = 'none';
      this.lootArrow.style.display = 'block';
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      let dx = cssX - cx, dy = cssY - cy;
      if (dx === 0 && dy === 0) dx = 0.001;
      const sx2 = dx > 0 ? right - cx : cx - left;
      const sy2 = dy > 0 ? bottom - cy : cy - top;
      const t = Math.min(Math.abs(sx2 / dx), Math.abs(sy2 / dy));
      const ax = cx + dx * t, ay = cy + dy * t;
      const angle = Math.atan2(dy, dx) * 180 / Math.PI; // 0°=右，与默认箭头方向一致
      this.lootArrow.style.left = `${ax}px`;
      this.lootArrow.style.top = `${ay}px`;
      this.lootArrow.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
      this.lootLabel.style.display = 'block';
      this.lootLabel.style.left = `${ax}px`;
      this.lootLabel.style.top = `${ay + 24}px`;
    }
  }

  hideLootBeacon() {
    if (this.lootBeacon) this.lootBeacon.classList.add('hidden');
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

  // 成就提示：更醒目的横幅（区别于底部小 toast），通关解锁等内容触发
  showAchievement(title, desc) {
    const el = document.getElementById('achievement');
    el.innerHTML = `<div class="ach-title">${title}</div><div class="ach-desc">${desc}</div>`;
    el.classList.remove('hidden');
    el.classList.remove('ach-pop');
    void el.offsetWidth; // 重置动画
    el.classList.add('ach-pop');
    clearTimeout(this._achTimer);
    this._achTimer = setTimeout(() => el.classList.add('hidden'), 4200);
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
    this.hideLootBeacon();
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
    this.hideLootBeacon();
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

  // 游戏图鉴 一级菜单：三个分类卡片
  showCodex() {
    const root = document.getElementById('codex-hub-grid');
    root.innerHTML = '';
    const cats = [
      { id: 'artifacts', icon: 'codex_artifacts', name: '神器图鉴', sub: '合成配方', color: 'gold' },
      { id: 'monsters', icon: 'codex_monsters', name: '怪物图鉴', sub: '夜行造物', color: 'purple' },
      { id: 'weapons', icon: 'codex_weapons', name: '武器图鉴', sub: '武器/被动/神器', color: 'red' },
    ];
    for (const c of cats) {
      const card = document.createElement('button');
      card.className = `codex-hub-card cat-${c.color}`;
      card.dataset.target = c.id;
      const img = document.createElement('img');
      img.src = this.iconURL(c.icon);
      img.alt = c.name;
      const name = document.createElement('p');
      name.className = 'chc-name';
      name.textContent = c.name;
      const sub = document.createElement('p');
      sub.className = 'chc-sub';
      sub.textContent = c.sub;
      card.append(img, name, sub);
      card.addEventListener('click', () => {
        if (c.id === 'artifacts') this.renderCodexArtifacts();
        else if (c.id === 'monsters') this.renderCodexMonsters();
        else if (c.id === 'weapons') this.renderCodexWeapons();
      });
      root.appendChild(card);
    }
    this.hideAllScreens();
    document.getElementById('codex-hub').classList.remove('hidden');
  }

  // 神器图鉴（合成配方，原合成图鉴内容）
  renderCodexArtifacts() {
    const { unlocked } = loadCollection();
    const data = buildCollectionData(unlocked);
    const root = document.getElementById('codex-artifacts-content');
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
        const desc = document.createElement('p');
        desc.className = 'cc-hint';
        desc.textContent = item.hint || (item.desc && item.unlocked ? item.desc : '');
        card.appendChild(desc);
        grid.appendChild(card);
      }
      sec.appendChild(grid);
      root.appendChild(sec);
    }
    this.hideAllScreens();
    document.getElementById('codex-artifacts').classList.remove('hidden');
  }

  // 怪物图鉴：夜行小怪 / 永夜小怪 / Boss
  renderCodexMonsters() {
    const root = document.getElementById('codex-monsters-content');
    root.innerHTML = '';
    const lore = MONSTER_LORE;
    const fmtTime = (s) => (s >= 60 ? `${Math.floor(s / 60)}分` : `${s}秒`);
    const groups = [
      { title: '夜行小怪', filter: (k, t) => !Array.isArray(t.skills) && (t.unlockAt || 0) < 540, color: 'purple' },
      { title: '永夜小怪', filter: (k, t) => !Array.isArray(t.skills) && (t.unlockAt || 0) >= 540, color: 'purple' },
      { title: 'Boss', filter: (k, t) => Array.isArray(t.skills), color: 'gold' },
    ];
    for (const g of groups) {
      const sec = document.createElement('div');
      sec.className = 'codex-section';
      const h = document.createElement('h3');
      h.textContent = g.title;
      sec.appendChild(h);
      const grid = document.createElement('div');
      grid.className = 'codex-grid';
      for (const [key, t] of Object.entries({ ...ENEMY_TYPES, ...BOSSES })) {
        if (!g.filter(key, t)) continue;
        const info = lore[key] || {};
        const card = document.createElement('div');
        card.className = `codex-card cat-${g.color}`;
        const img = document.createElement('img');
        img.src = this.iconURL(t.sprite || 'icon_skull');
        img.alt = t.name || key;
        const name = document.createElement('p');
        name.className = 'cc-name';
        name.textContent = t.name || key;
        const stats = document.createElement('p');
        stats.className = 'cc-hint';
        const unlock = t.unlockAt ? `首现 ${fmtTime(t.unlockAt)}` : '开局';
        stats.textContent = `HP ${t.hp} · 伤害 ${t.damage} · ${unlock}`;
        const desc = document.createElement('p');
        desc.className = 'cc-hint';
        desc.textContent = info.desc || '';
        card.append(img, name, stats, desc);
        grid.appendChild(card);
      }
      if (grid.children.length) {
        sec.appendChild(grid);
        root.appendChild(sec);
      }
    }
    this.hideAllScreens();
    document.getElementById('codex-monsters').classList.remove('hidden');
  }

  // 武器图鉴：武器/被动/神器 分类配色标签（⑤）
  renderCodexWeapons() {
    const { unlocked } = loadCollection();
    const data = buildCollectionData(unlocked);
    const root = document.getElementById('codex-weapons-content');
    root.innerHTML = '';
    const sections = [
      { title: '武器', items: data.weapons, cat: 'red' },
      { title: '被动', items: data.passives, cat: 'cyan' },
      { title: '神器', items: data.artifacts, cat: 'gold' },
    ];
    for (const s of sections) {
      const sec = document.createElement('div');
      sec.className = 'codex-section';
      const h = document.createElement('h3');
      h.textContent = s.title;
      sec.appendChild(h);
      const grid = document.createElement('div');
      grid.className = 'codex-grid';
      for (const item of s.items) {
        const card = document.createElement('div');
        card.className = `codex-card cat-${s.cat} ${item.unlocked ? '' : 'locked'} ${item.rarity === 'hidden' ? 'hidden-item' : ''}`;
        const img = document.createElement('img');
        img.src = this.iconURL(item.icon);
        img.alt = item.name;
        const tag = document.createElement('span');
        tag.className = `cat-tag tag-${s.cat}`;
        tag.textContent = s.title;
        const name = document.createElement('p');
        name.className = 'cc-name';
        name.textContent = item.name;
        const desc = document.createElement('p');
        desc.className = 'cc-hint';
        desc.textContent = item.hint || (item.desc && item.unlocked ? item.desc : '');
        card.append(tag, img, name, desc);
        grid.appendChild(card);
      }
      sec.appendChild(grid);
      root.appendChild(sec);
    }
    this.hideAllScreens();
    document.getElementById('codex-weapons').classList.remove('hidden');
  }

  // 图鉴各子屏统一回退到一级菜单
  backToCodexHub() {
    this.hideAllScreens();
    document.getElementById('codex-hub').classList.remove('hidden');
  }

  hideCodex() {
    this.hideAllScreens();
    document.getElementById('title-screen').classList.remove('hidden');
  }

  // 隐藏所有图鉴相关屏 + 主菜单，避免残留
  hideAllScreens() {
    for (const id of ['codex-hub', 'codex-artifacts', 'codex-monsters', 'codex-weapons']) {
      document.getElementById(id).classList.add('hidden');
    }
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
