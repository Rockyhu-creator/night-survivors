# UX  overhaul（新手指引 + 角色全身像 + 祭坛专属图标）Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 三项纯 UI/资产改造——(1) 首启自动弹出的「玩法说明」指引 + 常驻按钮；(2) 角色选择展示全身立绘并说明初始武器（不再显示武器图标）；(3) 灵魂祭坛 7 件商品图全部重做、不复用任何现有素材。

**Architecture:** 复用现有 `gen_assets.py` 程序化像素管线（new_canvas/px/rect/fill_ellipse_shaded/save）新增立绘与祭坛图标；UI 层在 `ui.js` 的 `renderBloodline`/`renderAltar` 与新增 `showGuide`/`hideGuide` 上接线；首启判定走 `localStorage`。战斗/平衡逻辑零改动。

**Tech Stack:** Vite + Canvas2D + 原生 ES Module；Python3 + PIL 生成 PNG；Playwright e2e（`test_game.py`）。

---

## Task 1 · 新手指引（玩法说明）

**Files:**
- Create: `index.html` 新增 `#guide-screen` + 标题界面「玩法说明」按钮
- Modify: `src/ui.js` 构造函数取 `#guide-screen`/`#btn-guide`，新增 `showGuide()/hideGuide()`，首启在 `showTitle()` 末尾弹窗
- Modify: `src/main.js` 接线 `#btn-guide` 点击 → `game.ui.showGuide()`
- Modify: `src/style.css` 新增 `.guide-screen`/`.guide-card` 哥特石板风样式
- Test: `test_game.py` 新增「首启自动弹窗」「按钮可开/关」断言

**Step 1: index.html 标题按钮 + 指引弹窗**
在 `#bloodline-screen` 之后（line 109 后）插入：
```html
    <!-- 玩法说明（首启自动弹） -->
    <div id="guide-screen" class="screen guide-screen hidden">
      <div class="guide-card">
        <h2 class="guide-title">活到黎明 · 玩法说明</h2>
        <ul class="guide-list">
          <li><b>目标</b>：活到黎明（30 分钟）。每 5 分钟降临一位 Boss，击败后掉落的宝箱是进化的钥匙。</li>
          <li><b>角色</b>：开局可在「血裔选择」中挑选初始角色，不同血裔起手武器与天赋不同。</li>
          <li><b>移动</b>：WASD / 方向键；手机触屏拖动。你只管走位，活下去。</li>
          <li><b>攻击</b>：武器自动索敌开火，无需手动瞄准。</li>
          <li><b>升级</b>：拾取掉落的灵魂宝石积累经验，升级时三选一强化（满槽后只能升级已有装备）。</li>
          <li><b>进化</b>：武器升满级并持有对应被动，开启 Boss 宝箱即可进化为更强神器。</li>
          <li><b>长远</b>：阵亡后获得灵魂，在「灵魂祭坛」永久强化；武器/被动槽也可用灵魂扩容。</li>
        </ul>
        <button id="btn-guide-close" class="gothic-btn">开始狩猎</button>
      </div>
    </div>
```
在标题界面 `.title-btns`（line 57-61）内追加按钮：
```html
          <button id="btn-guide" class="gothic-btn ghost">玩法说明</button>
```

**Step 2: ui.js 构造函数取元素 + 方法**
构造函数（line 28 后）追加：
```js
    this.guideScreen = document.getElementById('guide-screen');
    this.guideCloseBtn = document.getElementById('btn-guide-close');
```
构造函数末尾（line 36 `this.spawnTitleBats();` 后）追加：
```js
    this.guideCloseBtn.addEventListener('click', () => { this.audio.uiClick(); this.hideGuide(); });
```
类内新增（放在 `showTitle()` 之后）：
```js
  showGuide() { this.guideScreen.classList.remove('hidden'); }
  hideGuide() { this.guideScreen.classList.add('hidden'); localStorage.setItem('ns_guide_seen', '1'); }
```
`showTitle()` 方法末尾（line 75 之后，`}` 前）追加首启判定：
```js
    if (!localStorage.getItem('ns_guide_seen')) this.showGuide();
```

**Step 3: main.js 接线按钮**
在 line 58 之后追加：
```js
document.getElementById('btn-guide').addEventListener('click', () => game.ui.showGuide());
```

**Step 4: style.css 样式**
在文件末尾追加：
```css
.guide-screen { background: linear-gradient(rgba(8,6,18,.82), rgba(8,6,18,.95)); z-index: 40; }
.guide-card { width: min(560px, 92vw); background: rgba(24,18,40,.92); border: 1px solid var(--purple); border-radius: 12px; padding: 26px 30px; box-shadow: 0 0 40px rgba(142,68,173,.4); }
.guide-title { color: var(--bone); font-size: 22px; letter-spacing: 3px; text-align: center; margin-bottom: 16px; }
.guide-list { list-style: none; padding: 0; margin: 0 0 20px; }
.guide-list li { color: #d8d0e8; font-size: 14px; line-height: 1.7; padding: 7px 0; border-bottom: 1px dashed rgba(142,68,173,.25); }
.guide-list b { color: var(--purple); margin-right: 6px; }
.guide-card .gothic-btn { display: block; margin: 0 auto; }
```
（变量 `--purple`/`--bone` 已在现有 CSS 定义，复用即可）

**Step 5: 提交**
```bash
git add index.html src/ui.js src/main.js src/style.css
git commit -m "feat(UX): 首启自动弹玩法说明 + 常驻按钮"
```

---

## Task 2 · 角色选择：全身立绘 + 初始武器说明

**Files:**
- Modify: `gen_assets.py` 新增 6 个 `gen_portrait_*` 生成器（40×60，2× 放大）
- Modify: `src/assets.js` 注册 `portrait_*` 6 键
- Modify: `src/data.js` BLOODLINES 各 `icon` → `portrait_*`
- Modify: `src/ui.js` `renderBloodline` 卡片加「初始武器」行
- Modify: `src/style.css` 加 `.bloodline-portrait` 竖图位
- Test: `test_game.py` 新增「6 立绘键存在」「卡片含初始武器文案」断言

**Step 1: gen_assets.py 立绘生成器**
在 `gen_art_matrix()`（line 953）之后、`gen_player()` 调用区之前新增通用人体 + 6 个变体。通用底座 `gen_portrait(name, cloth, skin, accent, feature)`：
```python
def gen_portrait(name, cloth, skin, accent, feature):
    W, H = 40, 60
    img, d = new_canvas(W, H)
    cx = 20
    cd, cm, cl = cloth
    sd, sm, sl = skin
    # 腿
    for side in (-1, 1):
        for x in range(cx + side*3, cx + side*3 + 4):
            for y in range(42, 57):
                px(d, x, y, cd if (y < 49) else (30, 18, 26))
        px(d, cx + side*5, 56, (20, 12, 18)); px(d, cx + side*5, 57, (20, 12, 18))
    # 躯干（左亮右暗）
    for y in range(22, 42):
        for x in range(cx - 9, cx + 10):
            t = (x - (cx - 9)) / 19
            px(d, x, y, cl if t < 0.3 else (cm if t < 0.7 else cd))
    # 手臂
    for side in (-1, 1):
        for y in range(23, 41):
            px(d, cx + side*10, y, cm); px(d, cx + side*11, y, cd)
    # 肩
    fill_ellipse_shaded(d, cx - 9, 23, 4, 4, cloth)
    fill_ellipse_shaded(d, cx + 9, 23, 4, 4, cloth)
    # 头
    fill_ellipse_shaded(d, cx, 12, 7, 8, skin)
    # 眼
    px(d, cx - 3, 12, accent); px(d, cx + 2, 12, accent)
    feature(d, cx)  # 各血裔特征
    save(img, name, 2)
```
6 个变体（特征回调）：
- `gen_portrait_wanderer`：兜帽（cloak 色覆盖头顶）+ 腰带灵魂宝石
- `gen_portrait_saint`：头顶金色光环 + 胸前十字
- `gen_portrait_berserker`：眼上横疤 + 红战纹 + 毛肩
- `gen_portrait_thunder`：紫袍 + 胸口闪电纹 + 电光描边
- `gen_portrait_bloodthirsty`：高领血披风 + 獠牙 + 红眼
- `gen_portrait_apostle`：无面暗影 + 幽光眼 + 虚空斗篷

各调用 `gen_portrait('portrait_wanderer.png', ((38,6,14),(120,20,38),(192,56,72)), ((225,200,180),(245,225,210),(255,245,235)), (255,45,45), feature_fn)` 等。具体调色见实现。

并在主调用区追加 6 行 `gen_portrait_*()`。

**Step 2: assets.js 注册**
```js
  portrait_wanderer: 'portrait_wanderer.png',
  portrait_saint: 'portrait_saint.png',
  portrait_berserker: 'portrait_berserker.png',
  portrait_thunder: 'portrait_thunder.png',
  portrait_bloodthirsty: 'portrait_bloodthirsty.png',
  portrait_apostle: 'portrait_apostle.png',
```

**Step 3: data.js BLOODLINES icon 替换**
`icon: 'blade'` → `icon: 'portrait_wanderer'`（wanderer）
`icon: 'holywater'` → `icon: 'portrait_saint'`（saint）
`icon: 'axe'` → `icon: 'portrait_berserker'`（berserker）
`icon: 'lightning'` → `icon: 'portrait_thunder'`（thunder）
`icon: 'blade'` → `icon: 'portrait_bloodthirsty'`（bloodthirsty）
`icon: 'player'` → `icon: 'portrait_apostle'`（apostle）

**Step 4: ui.js renderBloodline 加初始武器行**
在 `card.append(img, name, desc, btn);`（line 383）之前插入：
```js
      // 初始武器说明（纯文本，不放图标）
      const wLine = document.createElement('p');
      wLine.className = 'bl-weapon';
      if (def.weapon) {
        const wdef = WEAPONS[def.weapon];
        wLine.innerHTML = `初始武器：<b>${wdef.name}</b><br><span class="bl-wdesc">${wdef.desc}</span>`;
      } else {
        wLine.innerHTML = `初始武器：<b>无</b><br><span class="bl-wdesc">纯血裔天赋流</span>`;
      }
```
`card.append(img, name, wLine, desc, btn);`

（需把 `WEAPONS` 加入 ui.js 顶部 import —— 当前已 import `WEAPONS`）

**Step 5: style.css 竖图位**
```css
#bloodline-content .altar-card img { width: 64px; height: 96px; object-fit: contain; image-rendering: pixelated; }
.bl-weapon { font-size: 12px; color: var(--bone); margin: 4px 0 2px; }
.bl-weapon b { color: var(--purple); }
.bl-wdesc { font-size: 11px; color: #b9aed0; }
```

**Step 6: 提交**
```bash
git add gen_assets.py src/assets.js src/data.js src/ui.js src/style.css public/assets/portrait_*.png
git commit -m "feat(UX): 角色全身立绘 + 初始武器说明, 去武器图标"
```

---

## Task 3 · 祭坛商品图重做（不复用现有素材）

**Files:**
- Modify: `gen_assets.py` 新增 7 个 `gen_altar_*` 生成器
- Modify: `src/assets.js` 注册 `altar_*` 7 键
- Modify: `src/data.js` ALTAR 各 `icon` → `altar_*`
- Test: `test_game.py` 新增「7 祭坛新图标键存在」断言

**Step 1: gen_assets.py 7 个祭坛图标（40×40，2× 放大）**
- `gen_altar_hp`：心形护符（红）
- `gen_altar_spd`：风纹羽翼（青）
- `gen_altar_dmg`：滴血獠牙（猩红）
- `gen_altar_gain`：低语鬼脸（紫）
- `gen_altar_dual`：交叉双匕（银）
- `gen_altar_slot_weapon`：`+武器` 符文牌（金，刻剑形）
- `gen_altar_slot_passive`：`+被动` 符文牌（金，刻盾形）
全部独立绘制，不复用 blade/holywater/player/gem 任何像素。

主调用区追加 7 行。

**Step 2: assets.js 注册**
```js
  altar_hp: 'altar_hp.png',
  altar_spd: 'altar_spd.png',
  altar_dmg: 'altar_dmg.png',
  altar_gain: 'altar_gain.png',
  altar_dual: 'altar_dual.png',
  altar_slot_weapon: 'altar_slot_weapon.png',
  altar_slot_passive: 'altar_slot_passive.png',
```

**Step 3: data.js ALTAR icon 替换**
soul_hp→altar_hp, soul_spd→altar_spd, soul_dmg→altar_dmg, soul_gain→altar_gain, soul_dual→altar_dual, soul_slot_weapon→altar_slot_weapon, soul_slot_passive→altar_slot_passive

**Step 4: 提交**
```bash
git add gen_assets.py src/assets.js src/data.js public/assets/altar_*.png
git commit -m "feat(UX): 祭坛 7 商品专属图标, 不复用现有素材"
```

---

## Task 4 · e2e 验证 + 全量 + 推送

**Files:**
- Modify: `test_game.py` 新增 3 组断言
- Run: `/Users/a34481/.workbuddy/binaries/python/envs/default/bin/python test_game.py`
- 预期：全绿（原 63 + 新增约 5），零控制台错误
- Commit + `git push origin main`（经 GitHub connector）

**Step 1: 断言**
- 导引：首启 `localStorage` 清空后 `eval` 检查 `#guide-screen` 不含 `hidden`；点击 `#btn-guide-close` 后含 `hidden`；点 `#btn-guide` 再弹。
- 立绘：`['portrait_wanderer','portrait_saint','portrait_berserker','portrait_thunder','portrait_bloodthirsty','portrait_apostle'].every(k => window.__assets && window.__assets[k])`（需在 assets.js 暴露 `window.__assets` 调试钩子，或经 `sprite(k)` 判非空）。
- 祭坛：`['altar_hp',...].every(k => sprite(k))`。
- 卡片文案：renderBloodline 后某卡 innerHTML 含「初始武器」。

**Step 2: 提交 + 推送**
```bash
git add test_game.py docs/plans/2026-07-23-ux-overhaul.md
git commit -m "test(UX): e2e 验证指引/立绘/祭坛图标, 全量绿"
git push origin main
```

---

## Changelog
- v0.1 (2026-07-23) — 用户确认：首启弹窗式新手指引 + 角色全身像(去武器图标,加初始武器说明) + 祭坛专属图标重做。
