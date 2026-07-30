import { CONFIG, WEAPONS, PASSIVES, ARTIFACTS, expForLevel, loadBest, saveBest, formatTime, loadCollection, ALTAR, SKILL_TREE, BLOODLINES, ENEMY_TYPES, BOSSES, loadSouls, buySkillNode, respecTree, buyUnlock, buyBloodlineUnlock, getSelectedBloodline, isBloodlineUnlocked } from './data.js';
import { buildCollectionData } from './evolution.js';
import { sprite, drawAffixBadge } from './assets.js';

// 构建版本号（由 vite define 注入，用于美术图 URL 缓存击穿）
const BUILD_ID = __BUILD_ID__;

// 怪物图鉴描述（基于实际行为，不剧透公式）
const MONSTER_LORE = {
  bat: '高速直冲,成群结队,单体孱弱',
  skeleton: '直线追击的骷髅,基础杂兵',
  slime: '缓慢但厚实,成群蠕动',
  elite: '周期降临的精英,高血高伤,优先清理',
  shadow_hunter: '进入 250px 后蓄力冲刺,突进极快',
  gargoyle: '免疫击退的肉盾,缓慢却坚硬',
  baron: '首位降临的 Boss,召唤蝙蝠并弹幕',
  queen: '苍白女王,多重弹幕与位移',
  overlord: '永夜君王,半场后狂暴',
  avatar: '终局化身,存活至 12 分钟降临,击杀即通关',
};

// 被动像素 icon（程序化 CSS，零 PNG，D5）。每项是 8×8 ASCII 像素图，
// 字符→调色板见 PX；运行时由 spriteShadow() 转成 box-shadow 拼出像素 icon，
// 单元尺寸由 CSS 变量 --pb-px 控制（升级卡/图鉴/装备栏分别缩放），图像用 image-rendering:pixelated。
// 被动 icon 现在走 AI PNG + gen_passive_pixels.py 像素化管线（v1.4），
// 不再使用 CSS box-shadow 拼图。以下旧数据已移除。

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
    // 技能树 v1 屏引用
    this.skillTreeScreen = document.getElementById('skilltree-screen');
    this.skillTreeBalanceEl = document.getElementById('skilltree-balance');
    this.skillTreeContentEl = document.getElementById('skilltree-content');
    this.skillTreeRespecBtn = document.getElementById('btn-skilltree-respec');
    this.skillTreeTip = document.createElement('div');
    this.skillTreeTip.className = 'st-tooltip';
    this.skillTreeScreen.appendChild(this.skillTreeTip);
    // 触屏端：详情浮层内嵌解锁按钮（事件委托，仅在 .touch-device 下可见可点）
    this.skillTreeTip.addEventListener('click', (e) => {
      const b = e.target.closest('.tt-buy');
      if (!b || b.disabled) return;
      const id = b.dataset.id;
      if (buySkillNode(id).ok) { this.game.audio.uiClick(); this.hideTip(); this.renderSkillTree(id, false); }
    });
    // 技能树画布平移/缩放状态
    this.stTx = 0; this.stTy = 0; this.stScale = 1;
    this.stWorldW = 0; this.stWorldH = 0; this.stDragging = false; this.stMoved = false;
    this.stViewCtl = this.buildSkillTreeViewCtl();
    this.skillTreeScreen.appendChild(this.stViewCtl);
    this.bindSkillTreePan();
    window.addEventListener('resize', () => {
      if (this.skillTreeScreen && !this.skillTreeScreen.classList.contains('hidden')) { this.fitSkillTreeView(); this.hideTip(); }
    });
    this.bloodlineContentEl = document.getElementById('bloodline-content');
    this.vignette = document.getElementById('damage-vignette');
    this.bossBarWrap = document.getElementById('boss-bar-wrap');
    this.bossName = document.getElementById('boss-name');
    this.bossBarFill = document.getElementById('boss-bar-fill');
    this.bossWarning = document.getElementById('boss-warning');
    this.warnName = document.getElementById('warn-name');
    this.guideScreen = document.getElementById('guide-screen');
    this.guideCloseBtn = document.getElementById('btn-guide-close');
    // S 档：属性面板 + 护盾条 HUD
    this.statsPanel = document.getElementById('stats-panel');
    this.statsGrid = document.getElementById('stats-grid');
    this.statsGridExtra = document.getElementById('stats-grid-extra');
    this.statsPortrait = document.getElementById('stats-portrait');
    this.statsBloodlineEl = document.getElementById('stats-bloodline');
    this.statsLevelEl = document.getElementById('stats-level');
    this.shieldBar = document.getElementById('shield-bar');
    this.shieldFill = document.getElementById('shield-fill');
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
    this.victoryScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.hideLootBeacon();
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
      if (icon) icon.src = `/assets/${bl.icon}.png?v=${BUILD_ID}`;
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
    this.victoryScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.hideLootBeacon();
    this.refreshLoadout();
  }

  update(dt) {
    const game = this.game;
    const player = game.player;
    // 值变化才写 DOM：避免每帧 textContent/style.width 触发重排（显示内容不变）
    const h = this._hudCache || (this._hudCache = {});
    const expW = `${Math.min(100, (player.exp / expForLevel(player.level)) * 100).toFixed(1)}%`;
    if (h.expW !== expW) { h.expW = expW; this.expBar.style.width = expW; }
    const lv = `LV.${player.level}`;
    if (h.lv !== lv) { h.lv = lv; this.levelText.textContent = lv; }
    const hpW = `${Math.max(0, (player.hp / player.maxHp) * 100).toFixed(1)}%`;
    if (h.hpW !== hpW) { h.hpW = hpW; this.hpBar.style.width = hpW; }
    const hpT = `${Math.max(0, Math.ceil(player.hp))} / ${player.maxHp}`;
    if (h.hpT !== hpT) { h.hpT = hpT; this.hpText.textContent = hpT; }
    const t = formatTime(game.time);
    if (h.t !== t) { h.t = t; this.timerEl.textContent = t; }
    const k = `☠ ${game.kills}`;
    if (h.k !== k) { h.k = k; this.killEl.textContent = k; }
    // S 档护盾条（D4）：灰底空槽 + 青色盾量段，HP 条下方。
    // 常驻显示（maxShield===0 时显示空槽），避免「无护盾流派」下护盾条完全不可见；
    // null-guard 防止微信 X5 缓存旧 HTML（缺 #shield-bar）时每帧 classList 报错拖垮 HUD。
    if (this.shieldBar) {
      const ratio = player.maxShield > 0
        ? Math.max(0, Math.min(1, player.shield / player.maxShield))
        : 0;
      const sw = `${(ratio * 100).toFixed(1)}%`;
      if (h.sw !== sw) { h.sw = sw; if (this.shieldFill) this.shieldFill.style.width = sw; }
    }
    if (this.vignetteAlpha > 0) {
      this.vignetteAlpha = Math.max(0, this.vignetteAlpha - dt * 2.4);
      this.vignette.style.opacity = this.vignetteAlpha.toFixed(2);
    }
    this.updateBossBar();
    this.updateLootBeacon();
  }

  // 战利品指引：每帧定位最近的未拾取宝箱，屏外给边缘方向箭头、屏内给精确脉冲环
  updateLootBeacon() {
    if (this.game.state !== 'playing') { this.lootBeacon.classList.add('hidden'); return; }
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
    // 世界坐标为逻辑像素，画布内部分辨率 = LOGICAL×dpr（game.js:89）；映射到 CSS 必须除以 LOGICAL 尺寸，
    // 而非 canvas.width（含 dpr 倍），否则高分屏(dpr=2)下环/箭头整体缩到约一半位置 → 圈不住宝箱 / 箭头歪。
    const sx = rect.width / CONFIG.LOGICAL_WIDTH, sy = rect.height / CONFIG.LOGICAL_HEIGHT;
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
      // 圆环直径动态跟随宝箱屏显尺寸：chestSize × CSS缩放sx × 系数1.4（>pulse峰值1.12，任意相位都圈住）
      const chestSize = best.boss ? 48 : 40;
      const dia = chestSize * sx * 1.4;
      this.lootRing.style.width = `${dia}px`;
      this.lootRing.style.height = `${dia}px`;
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
    const pct = `${Math.max(0, (boss.hp / boss.maxHp) * 100).toFixed(1)}%`;
    if (this._bossPct !== pct) { this._bossPct = pct; this.bossBarFill.style.width = pct; }
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
    for (const w of [...player.weapons, ...player.innateWeapons]) {
      const def = WEAPONS[w.id] || ARTIFACTS[w.id];
      const div = document.createElement('div');
      div.className = 'loadout-icon' + (w.innate ? ' innate' : '');
      const img = document.createElement('img');
      img.src = this.iconURL(def.icon);
      img.alt = def.name;
      const lv = document.createElement('span');
      lv.className = 'loadout-lv';
      lv.textContent = w.level;
      div.append(img, lv);
      if (w.innate) {
        const free = document.createElement('span');
        free.className = 'loadout-free';
        free.textContent = '免';
        div.append(free);
      }
      this.loadoutEl.appendChild(div);
    }
    for (const [id, lv] of player.passives) {
      const def = PASSIVES[id];
      const div = document.createElement('div');
      div.className = 'loadout-icon passive';
      const badge = this.passiveBadge(def);
      const lvEl = document.createElement('span');
      lvEl.className = 'loadout-lv';
      lvEl.textContent = lv;
      div.append(badge, lvEl);
      this.loadoutEl.appendChild(div);
    }
  }

  // ===== S 档：被动像素 icon（AI PNG + 像素化 sprite，v1.4）=====
// 供升级卡 / 装备栏 / 图鉴复用：哥特像素框 + 按 category 着色，
// 内部 <img> 取 passive_<id>.png（80x80 RGBA，由 gen_passive_pixels.py 生成）。
  passiveBadge(def) {
    const cat = (def && def.category) || 'utility';
    const el = document.createElement('div');
    el.className = `passive-badge cat-${cat}`;
    el.title = def ? def.name : '';
    const img = document.createElement('img');
    img.src = this.iconURL(def ? def.icon : '');
    img.alt = def ? def.name : '';
    img.style.imageRendering = 'pixelated';
    el.appendChild(img);
    return el;
  }

  // ===== S 档：角色属性面板（§3）=====
  // 核心 9 项（快照，打开时读一次）
  _collectStats() {
    const p = this.game.player;
    const pct = (v) => `+${(v * 100).toFixed(0)}%`;
    const pct1 = (v) => `${(v * 100).toFixed(1)}%`;
    const x2 = (v) => `×${v.toFixed(2)}`;
    return [
      { sym: '♥', cls: 'stat-hp', name: '血量上限', value: `${Math.round(p.maxHp)}`, tone: 'good' },
      { sym: '✦', cls: 'stat-exp', name: '经验加成', value: pct(p.expMul - 1), tone: 'good' },
      { sym: '磁', cls: 'stat-magnet', name: '拾取范围', value: pct(p.magnetMul - 1), tone: 'good' },
      { sym: '暴', cls: 'stat-critrate', name: '暴击率', value: pct1(p.critChance), tone: 'gold' },
      { sym: '×', cls: 'stat-critmul', name: '暴击伤害', value: x2(p.critMul), tone: 'gold' },
      { sym: '盾', cls: 'stat-shield', name: '护盾', value: p.maxShield > 0 ? `${Math.ceil(p.shield)} / ${p.maxShield}` : '—', tone: 'gold' },
      { sym: '↻', cls: 'stat-shieldregen', name: '护盾恢复', value: p.shieldRegen > 0 ? `+${p.shieldRegen.toFixed(1)}/s` : '—', tone: 'good' },
      { sym: '甲', cls: 'stat-armor', name: '防御', value: `${Math.round(p.armor)}`, tone: 'good' },
      { sym: '闪', cls: 'stat-dodge', name: '闪避率', value: pct1(p.dodgeChance), tone: 'gold' },
    ];
  }

  // 其他属性副区
  _collectStatsExtra() {
    const p = this.game.player;
    const pct = (v) => `+${(v * 100).toFixed(0)}%`;
    const x2 = (v) => `×${v.toFixed(2)}`;
    const neg = (v) => `-${Math.round((1 - v) * 100)}%`;
    return [
      { sym: '伤', cls: 'stat-dmg', name: '伤害倍率', value: x2(p.damageMul), tone: 'gold' },
      { sym: '速', cls: 'stat-speed', name: '移动速度', value: pct(p.speedMul - 1), tone: 'good' },
      { sym: '冷', cls: 'stat-cd', name: '冷却缩减', value: neg(p.cooldownMul), tone: 'neutral' },
      { sym: '范', cls: 'stat-area', name: '范围倍率', value: pct(p.areaMul - 1), tone: 'good' },
      { sym: '减', cls: 'stat-taken', name: '受伤减免', value: neg(p.damageTakenMul), tone: 'neutral' },
      { sym: '血', cls: 'stat-regen', name: '生命恢复', value: `+${p.regenRate.toFixed(1)}/s`, tone: 'good' },
      { sym: '吸', cls: 'stat-lifesteal', name: '命中吸血', value: `+${p.lifesteal.toFixed(1)}/次`, tone: 'good' },
    ];
  }

  _renderStatGrid(container, stats) {
    container.innerHTML = '';
    for (const s of stats) {
      const row = document.createElement('div');
      row.className = 'stat-row';
      const icon = document.createElement('span');
      icon.className = `stat-icon ${s.cls}`;
      icon.textContent = s.sym;
      const name = document.createElement('b');
      name.textContent = s.name;
      const val = document.createElement('span');
      val.className = `stat-val tone-${s.tone}`;
      val.textContent = s.value;
      row.append(icon, name, val);
      container.appendChild(row);
    }
  }

  // 渲染属性面板（局内 + 结算同源）
  renderStats() {
    this._renderStatGrid(this.statsGrid, this._collectStats());
    this._renderStatGrid(this.statsGridExtra, this._collectStatsExtra());
    const blId = this.game.bloodline || getSelectedBloodline();
    const bl = BLOODLINES.find((b) => b.id === blId) || BLOODLINES[0];
    this.statsPortrait.className = `stats-portrait bl-${blId}`;
    this.statsBloodlineEl.textContent = bl ? bl.name : '流浪者';
    this.statsLevelEl.textContent = `LV.${this.game.player.level}`;
  }

  showStatsPanel() {
    this.renderStats();
    this.statsPanel.classList.remove('hidden');
  }

  hideStatsPanel() {
    this.statsPanel.classList.add('hidden');
  }

  // 结算屏追加「本局最终属性」区块（与局内面板同源，§3.4）
  _appendFinalAttributes(container) {
    const title = document.createElement('p');
    title.className = 'stats-section-title';
    title.textContent = '本局最终属性';
    container.appendChild(title);
    const grid = document.createElement('div');
    grid.className = 'stats-grid in-result';
    this._renderStatGrid(grid, this._collectStats());
    container.appendChild(grid);
  }

  showGameOver(reason = 'defeat') {
    const game = this.game;
    this.hud.classList.add('hidden');
    this.victoryScreen.classList.add('hidden');
    this.hideLootBeacon();
    // 失败原因文案：阵亡 vs 超时
    const titleEl = document.querySelector('#gameover-screen .gameover-title');
    if (titleEl) {
      titleEl.textContent = reason === 'timeout' ? '时限已尽 · 永夜吞没了你' : '你倒在了黎明前';
    }
    const subEl = document.querySelector('#gameover-screen .gameover-sub');
    if (subEl) {
      subEl.textContent = reason === 'timeout' ? '未能在 15 分钟内讨伐永夜化身' : '';
    }
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
    this._appendFinalAttributes(this.finalStatsEl);
    this.gameoverScreen.classList.remove('hidden');
  }

  showVictory() {
    const game = this.game;
    this.hud.classList.add('hidden');
    this.gameoverScreen.classList.add('hidden');
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
    this._appendFinalAttributes(this.victoryStatsEl);
    this.victoryScreen.classList.remove('hidden');
  }

  // 游戏图鉴 一级菜单：三个分类卡片
  showCodex() {
    const root = document.getElementById('codex-hub-grid');
    root.innerHTML = '';
    const cats = [
      { id: 'weapons', icon: 'codex_weapons', name: '武器图鉴', sub: '攻击武器', color: 'red' },
      { id: 'passives', icon: 'passive_heart', name: '被动图鉴', sub: '被动道具与增益', color: 'cyan' },
      { id: 'artifacts', icon: 'codex_artifacts', name: '神器图鉴', sub: '合成配方', color: 'gold' },
      { id: 'monsters', icon: 'codex_monsters', name: '怪物图鉴', sub: '夜行造物', color: 'purple' },
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
        if (c.id === 'weapons') this.renderCodexWeapons();
        else if (c.id === 'passives') this.renderCodexPassives();
        else if (c.id === 'artifacts') this.renderCodexArtifacts();
        else if (c.id === 'monsters') this.renderCodexMonsters();
      });
      root.appendChild(card);
    }
    this.hideAllScreens();
    document.getElementById('codex-hub').classList.remove('hidden');
  }

  // 神器图鉴（仅神器，合成配方）
  renderCodexArtifacts() {
    const { unlocked } = loadCollection();
    const data = buildCollectionData(unlocked);
    const root = document.getElementById('codex-artifacts-content');
    root.innerHTML = '';
    const sections = [['神器', data.artifacts]];
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

  // 被动图鉴（仅被动道具）
  renderCodexPassives() {
    const { unlocked } = loadCollection();
    const data = buildCollectionData(unlocked);
    const root = document.getElementById('codex-passives-content');
    root.innerHTML = '';
    const sec = document.createElement('div');
    sec.className = 'codex-section';
    const h = document.createElement('h3');
    h.textContent = '被动道具';
    sec.appendChild(h);
    const grid = document.createElement('div');
    grid.className = 'codex-grid';
    for (const item of data.passives) {
      const card = document.createElement('div');
      card.className = `codex-card cat-cyan ${item.unlocked ? '' : 'locked'}`;
      const def = PASSIVES[item.id];
      if (def) {
        const badge = this.passiveBadge(def);
        badge.classList.add('codex-badge');
        card.appendChild(badge);
      }
      const tag = document.createElement('span');
      tag.className = 'cat-tag tag-cyan';
      tag.textContent = '被动';
      const name = document.createElement('p');
      name.className = 'cc-name';
      name.textContent = item.name;
      const desc = document.createElement('p');
      desc.className = 'cc-hint';
      desc.textContent = item.desc && item.unlocked ? item.desc : '';
      card.append(tag, name, desc);
      // v2.0（GDD §5.2）：被动卡标注「可合成」配方行（数据来自 buildCollectionData 的 recipes 字段）
      if (item.recipes && item.recipes.length) {
        const rec = document.createElement('p');
        rec.className = 'cc-hint codex-recipe';
        rec.textContent = '可合成 ✨神器 = 满级🗡武器 + 本被动';
        card.appendChild(rec);
        for (const r of item.recipes) {
          const pair = document.createElement('p');
          pair.className = 'cc-hint codex-recipe-pair';
          pair.textContent = `✨${r.artifact} = 满级🗡${r.weapon} + 本被动`;
          card.appendChild(pair);
        }
      }
      grid.appendChild(card);
    }
    sec.appendChild(grid);
    root.appendChild(sec);
    this.hideAllScreens();
    document.getElementById('codex-passives').classList.remove('hidden');
  }

  // 词缀图鉴缩略图：自然精灵 + 彩色光环 + 头顶徽标（与游戏内视觉一致，不染色本体）
  affixCodexDataURL(spriteKey, affixId, affixColor) {
    const base = sprite(spriteKey);
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = false;
    const ccx = 32, ccy = 38, s = 42;
    if (base) cx.drawImage(base, ccx - s / 2, ccy - s / 2, s, s);
    // 彩色光环（lighter 弱辉光，对应游戏内脉冲环）
    cx.save();
    cx.globalCompositeOperation = 'lighter';
    cx.globalAlpha = 0.9;
    cx.strokeStyle = affixColor;
    cx.lineWidth = 2;
    cx.beginPath();
    cx.arc(ccx, ccy, 26, 0, Math.PI * 2);
    cx.stroke();
    cx.restore();
    // 头顶徽标
    drawAffixBadge(cx, affixId, ccx, 12, 1.1);
    return c.toDataURL();
  }

  // 怪物图鉴：夜行小怪 / 永夜小怪 / Boss
  renderCodexMonsters() {
    const root = document.getElementById('codex-monsters-content');
    root.innerHTML = '';
    const lore = MONSTER_LORE;
    const fmtTime = (s) => (s >= 60 ? `${Math.floor(s / 60)}分` : `${s}秒`);
    // 特殊属性（独立条目，key 区别于 base 敌人；本体不染色，属性用光环+徽标表达）
    const AFFIX_MONSTERS = [
      { key: 'volatile', name: '爆破', sprite: 'slime', affixId: 'volatile', affix: '爆破', affixColor: '#e67e22',
        hp: 90, damage: 20,
        lore: '「爆破」词缀：死亡瞬间引爆范围冲击波并重创靠近的玩家,击杀时会播放明显爆炸特效,务必保持距离' },
      { key: 'shielded', name: '护盾', sprite: 'skeleton', affixId: 'shielded', affix: '护盾', affixColor: '#3498db',
        hp: 34, damage: 14,
        lore: '「护盾」词缀：受到伤害大幅降低,头顶盾牌徽标可快速识别,需集火或高爆发破除' },
      { key: 'pack', name: '狼群', sprite: 'bat', affixId: 'pack', affix: '狼群', affixColor: '#f1c40f',
        hp: 30, damage: 12,
        lore: '「狼群」词缀：从同一方向成群包抄出现,头顶三点徽标标示,数量优势是其主要威胁' },
    ];
    const groups = [
      { id: 'noct', title: '夜行小怪', filter: (k, t) => !Array.isArray(t.skills) && (t.unlockAt || 0) < 540, color: 'purple', source: 'bestiary' },
      { id: 'night', title: '永夜小怪', filter: (k, t) => !Array.isArray(t.skills) && (t.unlockAt || 0) >= 540, color: 'purple', source: 'bestiary' },
      { id: 'boss', title: 'Boss', filter: (k, t) => Array.isArray(t.skills), color: 'gold', source: 'bestiary' },
      { id: 'affix', title: '特殊属性', color: 'purple', source: 'affix' },
    ];
    for (const g of groups) {
      const sec = document.createElement('div');
      sec.className = 'codex-section';
      const h = document.createElement('h3');
      h.textContent = g.title;
      sec.appendChild(h);
      const grid = document.createElement('div');
      grid.className = 'codex-grid';
      const entries = g.source === 'affix'
        ? AFFIX_MONSTERS.map((t) => [t.key, t])
        : Object.entries({ ...ENEMY_TYPES, ...BOSSES });
      for (const [key, t] of entries) {
        if (g.filter && !g.filter(key, t)) continue;
        const isAffix = g.source === 'affix';
        const info = isAffix ? t : (lore[key] || {});
        const card = document.createElement('div');
        card.className = `codex-card cat-${g.color}`;
        if (isAffix) card.style.borderLeft = `4px solid ${t.affixColor}`;
        const img = document.createElement('img');
        if (isAffix) {
          img.src = this.affixCodexDataURL(t.sprite, t.affixId, t.affixColor);
        } else {
          img.src = this.iconURL(t.sprite || 'icon_skull');
        }
        img.alt = t.name || key;
        const name = document.createElement('p');
        name.className = 'cc-name';
        name.textContent = t.name || key;
        const stats = document.createElement('p');
        stats.className = 'cc-hint';
        let unlock = t.unlockAt ? `首现 ${fmtTime(t.unlockAt)}` : '开局';
        if (t.id === 'avatar') unlock = '终局 12 分降临';
        if (isAffix) {
          stats.textContent = `HP ${t.hp} · 伤害 ${t.damage} · 可附着多数敌人`;
        } else {
          stats.textContent = `HP ${t.hp} · 伤害 ${t.damage} · ${unlock}`;
        }
        const desc = document.createElement('p');
        desc.className = 'cc-hint';
        desc.textContent = isAffix ? (t.lore || '') : (info.desc || '');
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

  // 武器图鉴（仅武器）
  renderCodexWeapons() {
    const { unlocked } = loadCollection();
    const data = buildCollectionData(unlocked);
    const root = document.getElementById('codex-weapons-content');
    root.innerHTML = '';
    const sections = [
      { title: '武器', items: data.weapons, cat: 'red' },
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
        if (s.cat === 'cyan') {
          // 被动：程序化 CSS 徽标（D5，零 PNG）。新 S 档被动无贴图，避免空白 <img>
          const def = PASSIVES[item.id];
          if (def) {
            const badge = this.passiveBadge(def);
            badge.classList.add('codex-badge');
            card.appendChild(badge);
          }
        } else {
          const img = document.createElement('img');
          img.src = this.iconURL(item.icon);
          img.alt = item.name;
          card.appendChild(img);
        }
        const tag = document.createElement('span');
        tag.className = `cat-tag tag-${s.cat}`;
        tag.textContent = s.title;
        const name = document.createElement('p');
        name.className = 'cc-name';
        name.textContent = item.name;
        const desc = document.createElement('p');
        desc.className = 'cc-hint';
        desc.textContent = item.hint || (item.desc && item.unlocked ? item.desc : '');
        card.append(tag, name, desc);
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
    for (const id of ['codex-hub', 'codex-artifacts', 'codex-monsters', 'codex-weapons', 'codex-passives']) {
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

  // ---------- 技能树 v1（复用祭坛视觉与网格，不污染祭坛逻辑）----------
  showSkillTree() {
    this.titleScreen.classList.add('hidden');
    this.skillTreeScreen.classList.remove('hidden');
    this.renderSkillTree(null, true);
  }

  hideSkillTree() {
    this.skillTreeScreen.classList.add('hidden');
    this.showTitle();
  }

  respecSkillTree() {
    const s = loadSouls();
    const refund = SKILL_TREE.filter((n) => s.tree.includes(n.id)).reduce((sum, n) => sum + n.cost, 0);
    if (refund === 0) return;
    const fee = Math.max(25, Math.floor(refund * 0.05));
    if (!confirm(`确定重置灵魂树？\n将返还 ${refund} 灵魂，扣除手续费 ${fee}（净返还 ${refund - fee}）。`)) return;
    const r = respecTree();
    if (r.ok) { this.game.audio.uiClick(); this.renderSkillTree(null, false); }
  }

  renderSkillTree(justUnlocked = null, fit = false) {
    const souls = loadSouls();
    this.skillTreeBalanceEl.textContent = `👁 灵魂  ${souls.balance}`;
    this.skillTreeContentEl.innerHTML = '';
    const owned = new Set(souls.tree);
    const branchNames = { war: '征伐', bly: '血裔协同', nfr: '永夜抗性', eco: '灵魂经济', utl: '通用机能' };
    const typeNames = { gate: '门槛', stat: '属性', modifier: '机制', keystone: '基石' };
    const clearedNames = { easy: '轻松', normal: '普通', hard: '噩梦' };
    const branchColor = { war: 'rgba(198,60,60,.85)', bly: 'rgba(142,68,173,.85)', nfr: 'rgba(70,120,210,.85)', eco: 'rgba(201,162,39,.85)', utl: 'rgba(60,180,150,.85)' };
    const solid = { war: '#c63c3c', bly: '#8e44ad', nfr: '#4678d2', eco: '#c9a227', utl: '#3cb496' };

    const CARD_W = 150, CARD_H = 104, COL_W = 190, ROW_H = 126, BAND_GAP = 64, TITLE_OFF = 46;

    const world = document.createElement('div');
    world.className = 'st-world';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'st-links');
    world.appendChild(svg);

    const positions = {};
    const cards = {};
    let bandX = 0, maxW = 0, maxH = 0;

    for (const bid of Object.keys(branchNames)) {
      const nodes = SKILL_TREE.filter((n) => n.branch === bid);
      const children = {}; nodes.forEach((n) => { children[n.id] = []; });
      nodes.forEach((n) => (n.prereq || []).forEach((p) => { if (children[p]) children[p].push(n.id); }));
      const root = nodes.find((n) => !(n.prereq || []).length) || nodes[0];
      const depth = {};
      const cd = (id, d) => { depth[id] = Math.max(depth[id] || 0, d); (children[id] || []).forEach((c) => cd(c, d + 1)); };
      cd(root.id, 0);
      const yPos = {}; let slot = 0;
      const ay = (id) => {
        if (id in yPos) return;
        const ch = children[id] || [];
        if (!ch.length) { yPos[id] = slot; slot += 1; return; }
        ch.forEach(ay);
        yPos[id] = (yPos[ch[0]] + yPos[ch[ch.length - 1]]) / 2;
      };
      ay(root.id);
      const maxSlot = Math.max(...nodes.map((n) => yPos[n.id] || 0));

      const title = document.createElement('div');
      title.className = 'st-band-title';
      title.style.color = branchColor[bid];
      title.textContent = branchNames[bid];
      title.style.left = `${bandX + (maxSlot * COL_W) / 2}px`;
      title.style.top = `${TITLE_OFF - 38}px`;
      world.appendChild(title);

      for (const def of nodes) {
        const isOwned = owned.has(def.id);
        const prereqOk = (def.prereq || []).every((p) => owned.has(p));
        let gateOk = true, lockMsg = '';
        if (def.gateReq && def.gateReq.cleared && !def.gateReq.cleared.every((c) => souls.cleared.includes(c))) {
          gateOk = false;
          lockMsg = `需通关 ${def.gateReq.cleared.map((c) => clearedNames[c] || c).join('/')}`;
        }
        const affordable = souls.balance >= def.cost;
        const x = bandX + (yPos[def.id] || 0) * COL_W;
        const y = TITLE_OFF + (depth[def.id] || 0) * ROW_H;
        positions[def.id] = { x, y };
        maxW = Math.max(maxW, x + CARD_W);
        maxH = Math.max(maxH, y + CARD_H);

        const card = document.createElement('div');
        card.dataset.id = def.id;
        card.style.setProperty('--branch-color', branchColor[bid]);
        card.style.setProperty('--branch-solid', solid[bid]);
        card.style.left = `${x}px`;
        card.style.top = `${y}px`;
        card.style.width = `${CARD_W}px`;
        card.className = `altar-card st-${bid} ${isOwned ? 'owned' : ''} ${!prereqOk || !gateOk ? 'locked' : 'available'}${def.id === justUnlocked ? ' just-unlocked' : ''}`;
        // Icon image (always present; compact/icon mode shows only this)
        const icon = document.createElement('img');
        icon.className = 'st-icon';
        icon.src = `/assets/sk_${def.id}.png`;
        icon.alt = def.name;
        icon.draggable = false;
        // Text layer (hidden in compact/icon mode via CSS)
        const textLayer = document.createElement('div');
        textLayer.className = 'st-text';
        const nm = document.createElement('h3'); nm.textContent = def.name;
        const tp = document.createElement('div'); tp.className = 'st-type'; tp.textContent = typeNames[def.type] || def.type;
        const desc = document.createElement('p'); desc.className = 'ac-desc'; desc.textContent = def.desc;
        textLayer.append(nm, tp, desc);
        const btn = document.createElement('button'); btn.className = 'gothic-btn ac-buy';
        if (isOwned) { btn.textContent = '已解锁'; btn.disabled = true; btn.classList.add('owned-btn'); }
        else if (!prereqOk) { btn.textContent = '前置未解锁'; btn.disabled = true; }
        else if (!gateOk) { btn.textContent = lockMsg; btn.disabled = true; }
        else if (!affordable) { btn.textContent = `👁 ${def.cost}`; btn.disabled = true; }
        else { btn.textContent = `👁 ${def.cost}`; btn.addEventListener('click', (e) => { e.stopPropagation(); if (buySkillNode(def.id).ok) { this.game.audio.uiClick(); this.renderSkillTree(def.id, false); } }); }
        card.append(icon, textLayer, btn);
        // Hover / tap: tooltip + highlight upstream/downstream paths
        card.addEventListener('mouseenter', () => { this.showTip(def, card, owned, souls); this.highlightPaths(def.id); });
        card.addEventListener('mouseleave', () => { this.hideTip(); this.clearPathHighlight(); });
        card.addEventListener('click', (e) => {
          if (e.target.closest('button')) return;
          if (this.stMoved) return;
          if (card.classList.contains('expanded')) { card.classList.remove('expanded'); this.hideTip(); this.clearPathHighlight(); }
          else { card.classList.add('expanded'); this.showTip(def, card, owned, souls); this.highlightPaths(def.id); }
        });
        world.appendChild(card);
        cards[def.id] = card;
      }
      bandX += (maxSlot + 1) * COL_W + BAND_GAP;
    }

    world.style.width = `${maxW}px`;
    world.style.height = `${maxH}px`;
    svg.setAttribute('width', maxW);
    svg.setAttribute('height', maxH);

    for (const def of SKILL_TREE) {
      if (!def.prereq || !def.prereq.length) continue;
      const c = positions[def.id]; if (!c) continue;
      const b = cards[def.id]; if (!b) continue;
      for (const pid of def.prereq) {
        const a = positions[pid]; if (!a) continue;
        const pa = cards[pid]; if (!pa) continue;
        const ax = a.x + CARD_W / 2, ay2 = a.y + CARD_H;
        const bx = c.x + CARD_W / 2, by = c.y;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${ax} ${ay2} C ${ax} ${(ay2 + by) / 2}, ${bx} ${(ay2 + by) / 2}, ${bx} ${by}`);
        path.dataset.from = pid;
        path.dataset.to = def.id;
        let cls = 'lk-latent';
        if (pa.classList.contains('owned') && b.classList.contains('owned')) cls = 'lk-owned';
        else if (pa.classList.contains('owned') && b.classList.contains('available')) cls = 'lk-next';
        path.setAttribute('class', cls);
        svg.appendChild(path);
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', bx); dot.setAttribute('cy', by); dot.setAttribute('r', 3);
        dot.setAttribute('class', cls === 'lk-latent' ? 'lk-dot-latent' : 'lk-dot-owned');
        svg.appendChild(dot);
      }
    }

    this.skillTreeContentEl.appendChild(world);
    this.stWorld = world; this.stWorldW = maxW; this.stWorldH = maxH;
    // Zoom indicator (bottom-center)
    let zi = this.skillTreeContentEl.querySelector('.st-zoom-indicator');
    if (!zi) { zi = document.createElement('div'); zi.className = 'st-zoom-indicator'; this.skillTreeContentEl.appendChild(zi); }
    this.stZoomInd = zi;
    if (fit) {
      // 仅「打开技能树」时自动适配；解锁/重置等局部刷新保持当前面板位置与缩放
      requestAnimationFrame(() => this.fitSkillTreeView());
    } else {
      this.applyStTransform();
      this.skillTreeContentEl.style.setProperty('--st-zoom', this.stScale);
      if (this.stZoomInd) this.stZoomInd.textContent = `${Math.round(this.stScale * 100)}%`;
    }
  }

  applyStTransform() {
    if (this.stWorld) this.stWorld.style.transform = `translate(${this.stTx}px, ${this.stTy}px) scale(${this.stScale})`;
  }

  fitSkillTreeView() {
    if (!this.stWorldW || !this.stWorldH) return;
    const c = this.skillTreeContentEl;
    const cw = c.clientWidth, ch = c.clientHeight;
    if (!cw || !ch) return;
    const s = Math.min(cw / (this.stWorldW + 48), ch / (this.stWorldH + 48), 1) * 0.96;
    this.stScale = Math.max(0.2, s);
    this.stTx = (cw - this.stWorldW * this.stScale) / 2;
    this.stTy = Math.max(8, (ch - this.stWorldH * this.stScale) / 2);
    this.applyStTransform();
    this.skillTreeContentEl.style.setProperty('--st-zoom', this.stScale);
    if (this.stZoomInd) this.stZoomInd.textContent = `${Math.round(this.stScale * 100)}%`;
    if (this.stZoomInd) this.stZoomInd.textContent = `${Math.round(this.stScale * 100)}%`;
  }

  zoomSkillTree(factor, mx, my) {
    const ns = Math.min(2.2, Math.max(0.2, this.stScale * factor));
    const k = ns / this.stScale;
    this.stTx = mx - (mx - this.stTx) * k;
    this.stTy = my - (my - this.stTy) * k;
    this.stScale = ns;
    this.applyStTransform();
    // Drive font-size auto-adapt via CSS variable
    this.skillTreeContentEl.style.setProperty('--st-zoom', ns);
  }

  bindSkillTreePan() {
    const c = this.skillTreeContentEl;
    const pointers = new Map();
    let pinch = null;            // 手势起点快照 { dist, mx, my, tx, ty, scale }
    let panSX = 0, panSY = 0, panTx = 0, panTy = 0;
    const L = (e) => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, cx: e.clientX, cy: e.clientY }; };

    c.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      // 点空白处（非节点）收起浮层
      if (!e.target.closest('.altar-card')) this.hideTip();
      pointers.set(e.pointerId, L(e));
      if (pointers.size === 1) {
        this.stDragging = true; this.stMoved = false;
        panSX = e.clientX; panSY = e.clientY; panTx = this.stTx; panTy = this.stTy;
        c.style.cursor = 'grabbing';
      } else if (pointers.size === 2) {
        const p = [...pointers.values()];
        pinch = { dist: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1,
                  mx: (p[0].x + p[1].x) / 2, my: (p[0].y + p[1].y) / 2,
                  tx: this.stTx, ty: this.stTy, scale: this.stScale };
        this.stDragging = false; // 双指时暂停单指平移
      }
    });

    c.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, L(e));
      if (pointers.size >= 2 && pinch) {
        // 双指：以中点为锚做「平移 + 缩放」合成（手势起点的世界坐标点黏在中点）
        const p = [...pointers.values()];
        const dist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1;
        const mx = (p[0].x + p[1].x) / 2, my = (p[0].y + p[1].y) / 2;
        const ns = Math.min(2.2, Math.max(0.2, pinch.scale * (dist / pinch.dist)));
        const wx0 = (pinch.mx - pinch.tx) / pinch.scale;
        const wy0 = (pinch.my - pinch.ty) / pinch.scale;
        this.stScale = ns;
        this.stTx = mx - wx0 * ns;
        this.stTy = my - wy0 * ns;
        this.stMoved = true;
        this.applyStTransform();
        this.skillTreeContentEl.style.setProperty('--st-zoom', ns);
        if (this.stZoomInd) this.stZoomInd.textContent = `${Math.round(ns * 100)}%`;
      } else if (pointers.size === 1 && this.stDragging) {
        const dx = e.clientX - panSX, dy = e.clientY - panSY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) this.stMoved = true;
        this.stTx = panTx + dx; this.stTy = panTy + dy;
        this.applyStTransform();
      }
    });

    const onUp = (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (pointers.size === 1) {
        // 抬起一指，剩一指继续平移
        const rem = [...pointers.values()][0];
        panSX = rem.cx; panSY = rem.cy; panTx = this.stTx; panTy = this.stTy;
        this.stDragging = true; pinch = null;
      } else if (pointers.size === 0) {
        this.stDragging = false; pinch = null;
        c.style.cursor = 'grab';
      } else {
        pinch = null;
      }
    };
    c.addEventListener('pointerup', onUp);
    c.addEventListener('pointercancel', onUp);

    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = c.getBoundingClientRect();
      this.zoomSkillTree(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false });
  }

  buildSkillTreeViewCtl() {
    const wrap = document.createElement('div');
    wrap.className = 'st-viewctl';
    const mk = (label, fn) => {
      const b = document.createElement('button');
      b.className = 'st-ctl-btn'; b.textContent = label;
      b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
      return b;
    };
    const cc = () => ({ w: this.skillTreeContentEl.clientWidth, h: this.skillTreeContentEl.clientHeight });
    wrap.appendChild(mk('＋', () => { const { w, h } = cc(); this.zoomSkillTree(1.2, w / 2, h / 2); }));
    wrap.appendChild(mk('－', () => { const { w, h } = cc(); this.zoomSkillTree(1 / 1.2, w / 2, h / 2); }));
    wrap.appendChild(mk('适配', () => this.fitSkillTreeView()));
    return wrap;
  }

  // drawConnections 已弃用：连线现于 renderSkillTree 内按 world 坐标直接绘制（树状布局），不再调用本方法
  _drawConnections() {
    const solid = { war: '#c63c3c', bly: '#8e44ad', nfr: '#4678d2', eco: '#c9a227', utl: '#3cb496' };
    for (const grid of this.skillTreeContentEl.querySelectorAll('.st-branch-grid')) {
      const prev = grid.querySelector('.st-links');
      if (prev) prev.remove();
      const cards = [...grid.querySelectorAll('.altar-card')];
      if (!cards.length) continue;
      const bid = (cards[0].dataset.id || 'war').split('_')[0];
      const gb = grid.getBoundingClientRect();
      const center = (c) => { const r = c.getBoundingClientRect(); return { x: r.left - gb.left + r.width / 2, y: r.top - gb.top + r.height / 2 }; };
      const byId = Object.fromEntries(cards.map((c) => [c.dataset.id, c]));
      const isOwned = (c) => c.classList.contains('owned');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'st-links');
      svg.style.setProperty('--branch-solid', solid[bid] || '#8e44ad');
      for (const c of cards) {
        const def = SKILL_TREE.find((n) => n.id === c.dataset.id);
        if (!def || !def.prereq) continue;
        const b = center(c);
        for (const pid of def.prereq) {
          const pc = byId[pid];
          if (!pc) continue;
          const a = center(pc);
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', `M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${Math.min(a.y, b.y) - 18} ${b.x} ${b.y}`);
          let cls = 'lk-latent';
          if (isOwned(pc) && isOwned(c)) cls = 'lk-owned';
          else if (isOwned(pc) && c.classList.contains('available')) cls = 'lk-next';
          path.setAttribute('class', cls);
          svg.appendChild(path);
          const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          dot.setAttribute('cx', b.x); dot.setAttribute('cy', b.y); dot.setAttribute('r', 3);
          dot.setAttribute('class', cls === 'lk-latent' ? 'lk-dot-latent' : 'lk-dot-owned');
          svg.appendChild(dot);
        }
      }
      grid.appendChild(svg);
    }
  }

  showTip(def, card, owned, souls) {
    if (!this.skillTreeTip) return;
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const branchNames = { war: '征伐', bly: '血裔协同', nfr: '永夜抗性', eco: '灵魂经济', utl: '通用机能' };
    const typeNames = { gate: '门槛', stat: '属性', modifier: '机制', keystone: '基石' };
    const isOwned = owned.has(def.id);
    let statusText, statusCls;
    if (isOwned) { statusText = '已点亮'; statusCls = 'tt-own'; }
    else if (!(def.prereq || []).every((p) => owned.has(p))) { statusText = '前置未解锁'; statusCls = 'tt-lock'; }
    else if (def.gateReq && def.gateReq.cleared && !def.gateReq.cleared.every((c) => souls.cleared.includes(c))) { statusText = `需通关 ${def.gateReq.cleared.join('/')}`; statusCls = 'tt-lock'; }
    else { statusText = souls.balance >= def.cost ? '可解锁 ✓' : '灵魂不足'; statusCls = souls.balance >= def.cost ? 'tt-ok' : 'tt-lock'; }
    const prereqHtml = (def.prereq && def.prereq.length)
      ? def.prereq.map((p) => { const pn = SKILL_TREE.find((n) => n.id === p); const ok = owned.has(p); return `<div class="tt-pre"><span class="${ok ? 'tt-dot-on' : 'tt-dot-off'}">${ok ? '●' : '○'}</span> ${esc(pn ? pn.name : p)} <span class="${ok ? 'tt-own' : 'tt-lock'}">${ok ? '已解锁' : '未解锁'}</span></div>`; }).join('')
      : '<div class="tt-pre tt-lock">无前置 · 分支入口</div>';
    let buyHtml = '';
    if (!isOwned) {
      if (souls.balance >= def.cost && statusCls !== 'tt-lock') {
        buyHtml = `<button class="tt-buy" data-id="${def.id}">解锁 −${def.cost} 灵魂</button>`;
      } else {
        buyHtml = `<button class="tt-buy" disabled>${esc(statusText)}</button>`;
      }
    }
    this.skillTreeTip.innerHTML = `<div class="tt-title">${esc(def.name)}</div><div class="tt-type">${typeNames[def.type] || def.type} · ${branchNames[def.branch]}</div><div class="tt-status ${statusCls}">状态：${esc(statusText)}</div><div class="tt-desc">${esc(def.desc)}</div><div class="tt-cost">灵魂 ${isOwned ? '— 已点亮' : '−' + def.cost}</div><div class="tt-prewrap">前置：${prereqHtml}</div>${buyHtml}`;
    const r = card.getBoundingClientRect();
    this.skillTreeTip.style.left = `${r.left + r.width / 2}px`;
    this.skillTreeTip.style.top = `${r.top - 12}px`;
    this.skillTreeTip.classList.add('show');
  }

  hideTip() {
    if (this.skillTreeTip) this.skillTreeTip.classList.remove('show');
  }

  /** Highlight all ancestor + descendant paths for a node (hover/tap feedback) */
  highlightPaths(nodeId) {
    const svg = this.stWorld?.querySelector('.st-links');
    if (!svg) return;
    // Build reverse prereq map (child → parents) and forward map (parent → children)
    const parents = {}, children = {};
    for (const n of SKILL_TREE) {
      if (!n.prereq) continue;
      if (!children[n.id]) children[n.id] = [];
      for (const p of n.prereq) {
        if (!parents[n.id]) parents[n.id] = [];
        parents[n.id].push(p);
        if (!children[p]) children[p] = [];
        children[p].push(n.id);
      }
    }
    // Collect all related node IDs via BFS
    const related = new Set([nodeId]);
    // Ancestors (follow prereq upward)
    const queue = [nodeId];
    const visited = new Set([nodeId]);
    while (queue.length) {
      const cur = queue.shift();
      for (const p of (parents[cur] || [])) {
        if (!visited.has(p)) { visited.add(p); related.add(p); queue.push(p); }
      }
    }
    // Descendants (follow children downward)
    queue.push(nodeId);
    while (queue.length) {
      const cur = queue.shift();
      for (const c of (children[cur] || [])) {
        if (!visited.has(c)) { visited.add(c); related.add(c); queue.push(c); }
      }
    }
    // Add .lk-highlight to paths where either endpoint is in related set
    for (const path of svg.querySelectorAll('path')) {
      const from = path.dataset.from;
      const to = path.dataset.to;
      if ((from && related.has(from)) || (to && related.has(to))) {
        path.classList.add('lk-highlight');
      }
    }
  }

  clearPathHighlight() {
    const svg = this.stWorld?.querySelector('.st-links');
    if (!svg) return;
    for (const el of svg.querySelectorAll('.lk-highlight')) el.classList.remove('lk-highlight');
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
