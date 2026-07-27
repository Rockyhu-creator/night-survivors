# 运行时版本自检 · UI 视觉规格文档

> **归属**：美术负责人（art-director）产出，供工程负责人（tech-lead）落地。
> **范围**：本文件只定义视觉方案与落地规范，不含任何实现代码。所有 `/* CSS 片段 */` 均为「需由工程按此写入 `src/style.css` 的规格描述」，美术不写代码。
> 主理人已定调技术接口（见 §7），美术与工程无需相互通信，由主理人中转汇编。

---

## 0. 现状核查结论（已实地读取，非假设）

| 核查项 | 结论 | 证据 |
|---|---|---|
| CSS 实际路径 | `src/style.css`（index.html line 8 引用 `/src/style.css`） | 非根目录 `style.css` |
| 字体 | `public/fonts/PressStart2P.woff2` 自托管；中文走 `--body-font` 系统栈 | style.css line 2–9 |
| 调色板 | `--bg #0d0a1a` / `--gold #d4af37` / `--blood #c0392b` / `--blood-bright #e74c3c` / `--bone #e8e0d0` / `--purple #8e44ad`；`#f1c40f`、`#e67e22` 已用于图鉴词缀 | :root + ui.js AFFIX_MONSTERS |
| 复用 UI 类 | `.gothic-btn`/`.ghost`/`.ua-btn`/`.uc-pick`/`.toast`/`.warn-sub`/`.top-back`（含 `:focus-visible` 金环）齐全 | style.css |
| 焦点环缺口 | **`.gothic-btn` 自身无 `:focus-visible`**（仅 `.top-back`/`.codex-hub-card` 有） | style.css grep |
| 加载画面 / 进度条 | **当前源码完全缺失**（index.html、style.css 无 `#loading`；全项目 grep 无 `progress`/`加载条`） | 见 §3 |
| 进度钩子 | `assets.js` `loadAssets(onProgress)` 已天然回传 `done/keys.length`（0–1）；`game.js` 状态 `'loading'→'title'` | assets.js line 86–105 / game.js line 18,105 |
| 自检接口 | `version-mismatch` / `window.__versionInfo` / `#update-prompt` 全项目 grep 无命中 → 全新功能，从零设计 | grep |

**核查读取文件清单**：`index.html`、`src/style.css`、`src/ui.js`、`src/assets.js`、`src/game.js`、`src/main.js`、`public/fonts/PressStart2P.woff2`。

---

## 1. 视觉系统对齐说明（复用，不引入新色）

### 1.1 调色 Token 映射表（全部取自既有代码，零新增）

| 语义 | Token | 取值 | 代码出处 | 本规格用途 |
|---|---|---|---|---|
| **night 底** | `--bg` | `#0d0a1a` | :root | 加载幕背景、横幅深色底 |
| night 渐变面 | — | `rgba(13,10,26,·)` | 各 `.screen` 背景 | 横幅/加载卡半透明表面 |
| **ember 橙金** | — | `#f1c40f`（琥珀）/ `#e67e22`（橙） | ui.js 词缀数据 | 进度条填充渐变、主按钮 ember 强调 |
| **gold 主金** | `--gold` | `#d4af37` | :root | 横幅描边、按钮 hover 金、百分比字 |
| **blood 血红** | `--blood` / `--blood-bright` | `#c0392b` / `#e74c3c` | :root | 危险/警示语义（默认 `.gothic-btn` 描边） |
| bone 骨白 | `--bone` | `#e8e0d0` | :root | 正文/文案文字 |
| purple 紫 | `--purple` | `#8e44ad` | :root | 辉光（沿用 `#achievement` 阴影） |

> ⚠️ **ember vs gold 澄清**：brief 将「ember 橙金」定义为 `#f1c40f / #e67e22`；系统通用 UI 金为 `--gold #d4af37`。两者皆为既有色，本规格**同时复用**：
> - 进度条填充 / 主按钮 ember → 用 brief 定义的 `#f1c40f`/`#e67e22`（橙金）。
> - 横幅描边 / 边框 / 百分比字 → 用系统主金 `--gold #d4af37`（与 `#achievement`/`#toast` 视觉家族一致）。
> **不引入任何 hex 之外的新色。**

### 1.2 复用既有 UI 类（不另起炉灶）

- 按钮：`.gothic-btn`（主）、`.gothic-btn.ghost`（次）。**新增唯一修饰类 `.gothic-btn.is-ember`**（仅改描边/填充色，复用 `#f1c40f`，不改形状/尺寸/动效曲线）。
- 横幅形态：沿用 `#achievement` / `#toast` 的「顶部居中、金描边、紫调辉光」卡片语言。
- 进度条：沿用 `#hp-bar` / `#boss-bar` 的「暗轨 + 亮填充 + `outline:1px solid #000` + `box-shadow` 辉光 + `transition:width`」语言，仅把血红换成 ember。

### 1.3 z-index 层叠（基于既有系统，给出新组件定位）

```
canvas(基) ─ top-back(6) ─ hud(10)/touch-zone(11)/joystick(12) ─ vignette(15)
  ─ toast/evo(18)/boss-warning(19) ─ screens(20) ─ loot(25)
  ─ codex/altar/bloodline(30) ─ pause/achievement(40) ─ mute/pause-btn(50)
  ─【update-prompt = 45】─【loading = 100】
```

- **`#update-prompt` → z-index 45**：高于 pause/achievement(40)，低于常驻 mute(50)；全屏任意状态（标题/游戏中/图鉴）均可见，且非阻断。
- **`#loading` → z-index 100**：首屏最高层，加载期间完全遮挡，加载完成即移除/隐藏。

---

## 2. 版本更新提示组件（`#update-prompt`）

### 2.1 形态与层级（推荐：顶部滑入横幅）

非阻断。容器 `pointer-events:none`，仅 `.up-inner` 区域 `pointer-events:auto`，游戏画布其余区域照常可点（不挡操作）。

```
┌──────────────────────────────────────────────────────────────┐
│ #app (canvas 游戏中)                                           │
│                                              [🔇 mute z50]     │
│   ┌────────────────────────────────────────────────────────┐  │
│   │ #update-prompt  (z45, 顶部居中, 滑入)                    │  │
│   │  ┌──────────────────────────────────────────────────┐  │  │
│   │  │ ⚡  发现新版本                       [稍后][立即刷新]│  │  │  ← .up-inner 可点
│   │  │     发现新版本，是否立即更新？                      │  │  │
│   │  └──────────────────────────────────────────────────┘  │  │
│   └────────────────────────────────────────────────────────┘  │
│          ↑ 容器 pointer-events:none（其余画布可操作）            │
└──────────────────────────────────────────────────────────────┘
```

**并存备选（弱遮罩居中弹窗）**：若产品希望更醒目，可改用居中卡片（仍非阻断，背后游戏可见，仅一层半透明 `rgba(6,4,14,.45)` 不拦截点击）。z-index 同为 45，形态如下：

```
        ┌───────────────────────────────────┐
        │  发现新版本                          │   ← 金描边卡片, 居中
        │  发现新版本，是否立即更新？          │
        │            [稍后]  [立即刷新]        │
        └───────────────────────────────────┘
   （背后 canvas 可见，遮罩层 pointer-events:none）
```

> 本规格以**顶部横幅为 canon**，弱遮罩弹窗为可选并存形态；两者共用同一 DOM 结构与配色，工程二选一或并存皆可。

### 2.2 配色 Token（复用 night/ember/gold）

| 元素 | 规格 | Token |
|---|---|---|
| 横幅表面 | `linear-gradient(180deg, rgba(28,18,40,.96), rgba(12,8,22,.96))` | 同 `#achievement` |
| 横幅描边 | `2px solid rgba(212,175,55,.85)`（`--gold`） | 同 `#achievement` |
| 横幅辉光 | `0 0 30px rgba(142,68,173,.55), inset 0 0 18px rgba(212,175,55,.18)` | 同 `#achievement` |
| 标题/icon 强调 | `--gold #d4af37`（图标用字符或内联 SVG，**不新增图片资源**） | `--gold` |
| 正文文案 | `--bone #e8e0d0` | `--bone`（中文系统字体） |
| 主按钮 ember | 描边 `#f1c40f`，hover 填充 `#f1c40f`、文字 `#000` | brief ember |

### 2.3 动效曲线

- **滑入**：`@keyframes upSlideIn` `from{opacity:0; transform:translateY(-120%)} to{opacity:1; transform:translateY(0)}`，`cubic-bezier(.2,1.3,.4,1)`（复用 `#achievement.ach-pop` 同款缓动），时长 `.45s`。
- **停留**：常驻直到用户操作（「稍后」收起 / 「立即刷新」刷新）。主按钮可加极轻 `box-shadow` 呼吸（可选，非必须）。
- **消失**：反向上滑收起 `.45s` 或直接 `hidden` 瞬间隐藏。
- **降级**：`prefers-reduced-motion` 时关闭所有 transform/opacity 关键帧，仅做 `display` 切换（静态显示，见 §4）。

### 2.4 按钮样式（沿用 `.gothic-btn`）

| 按钮 | class | 视觉 |
|---|---|---|
| 稍后（次） | `.gothic-btn.ghost` | 既有灰描边 `#4a3f5e`，沿用不变 |
| 立即刷新（主，ember） | `.gothic-btn.is-ember` | 描边 `#f1c40f`，hover 填充 `#f1c40f` + 文字 `#000`（对比度 AA），`box-shadow:0 0 22px rgba(241,196,15,.6)` |

### 2.5 文案（中文系统 CJK，零下载）

- 标题：`发现新版本`
- 正文：`发现新版本，是否立即更新？`
- 按钮：`稍后` / `立即刷新`
- （可选副信息，取自 `e.detail`）：`当前 v{current} → 最新 v{latest}`，用 `--body-font` 小字、`--bone` 70% 透明。

---

## 3. 加载进度条（`#loading` + `#load-bar`）

### 3.1 现状结论

**当前源码中无加载画面、无进度条**（index.html / src/style.css 均无 `#loading`；`game.js` 仅将 `state` 置 `'loading'` 直至 `assets.js` 加载完切 `'title'`，期间画布为 `--bg` 纯色空屏）。
→ 属「缺失，需新建」。下方给出统一视觉规格 + 改进方案，并指明既有进度钩子 `loadAssets(onProgress)`。

### 3.2 改进方案（新建加载幕）

在 `#app` 内新增 `#loading`（z-index 100，首屏默认可见），承载品牌标题与进度条；加载完成由工程移除 `hidden`/卸载节点，露出标题屏。

```
┌──────────────────────────────────────────────────────────────┐
│ #loading  (z100, 全屏, bg_title 暗化背景)                      │
│                                                                │
│            夜裔幸存者                                          │
│         NIGHT  SURVIVORS   ← Press Start 2P, gold             │
│                                                                │
│        ┌────────────────────────────────────┐                │
│        │███████████████░░░░░░░░░░░░░░░░░│  ← #load-bar-fill │
│        └────────────────────────────────────┘                │
│                   62%   ← Press Start 2P, gold                │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 统一视觉规格

| 项 | 规格 | 复用对齐 |
|---|---|---|
| 位置 | `#loading` 全屏 `inset:0` 居中布局；进度条 `width:min(420px,80vw)` 居中 | 同 `.screen` 居中 |
| 背景 | `linear-gradient(rgba(13,10,26,.82), rgba(13,10,26,.95)), url("/assets/bg_title.png") center/cover` | 复用 `#title-screen` 背景语言 |
| 轨道 `#load-bar` | `height:16px; background:rgba(0,0,0,.7); border:2px solid var(--gold); outline:1px solid #000` | 复用 `#boss-bar` 语言（血红→金） |
| 填充 `#load-bar-fill` | `height:100%; width:0%; background:linear-gradient(90deg,#e67e22,#f1c40f); box-shadow:0 0 14px rgba(241,196,15,.8); transition:width .18s ease` | 复用 `#exp-bar`/`#hp-bar` 的 `transition:width .18s ease` |
| 百分比字 `#load-pct` | `font-family:var(--pixel-font); font-size:14px; color:var(--gold); text-shadow:0 0 10px rgba(212,175,55,.6)` | 复用 HUD 数字字（Press Start 2P + gold） |
| 标题 | `夜裔幸存者` 用 `--body-font` 粗体 gold；`NIGHT SURVIVORS` 用 `--pixel-font` `--bone` 字距 | 复用 `.title-sub`/`.game-title` 语言 |

### 3.4 填充动画曲线

- 填充宽度由 JS 设置 `style.width = pct + '%'`，CSS 仅负责 `transition: width .18s ease`（状态驱动，非装饰循环，reduced-motion 下保留）。
- 可选：加载中轨道外发光做 `1.2s` 轻微 `pulse` 呼吸（**属装饰循环，须在 `prefers-reduced-motion` 下关闭**，见 §4）。

---

## 4. 可访问性清单（AA 级）

| 维度 | 要求 | 本规格落地 |
|---|---|---|
| 对比度 AA | 文字 vs 背景 ≥ 4.5:1（大字 ≥ 3:1） | `--bone #e8e0d0` on `#0d0a1a` ≈ 14:1（AAA）；`--gold #d4af37` on night ≈ 8:1；`#f1c40f` on night ≈ 11:1；主按钮 hover 填充 `#f1c40f` 时文字转 `#000`（≈ 12:1）。全部达标。 |
| 焦点环 | `:focus-visible` 金环（参照 `.top-back`） | **需新增** `.gothic-btn:focus-visible { outline:2px solid var(--gold); outline-offset:2px; }`（补既有缺口）；`.up-close`/`.is-ember` 同样适用。 |
| 读屏 | 更新提示可被朗读 | `#update-prompt` 设 `role="status"` + `aria-live="polite"`；文案变更即播报「发现新版本，是否立即更新？」。 |
| 读屏（进度） | 进度可被感知 | `#load-bar` 设 `role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="{pct}" aria-label="加载进度"`；`#load-pct` 文本可 `aria-hidden="true"`（视觉冗余）。 |
| 动效降级 | `prefers-reduced-motion` | 关闭 `#update-prompt` 滑入关键帧（仅 `display` 切换）；关闭加载幕可选 `pulse` 循环；进度条 `transition:width` 为状态驱动，保留。 |
| 键盘可达 | 按钮可 Tab 聚焦并回车触发 | 容器内按钮为标准 `<button>`，天然可达；显示时建议把焦点移到主按钮「立即刷新」便于键盘用户直接操作。 |
| 触控友好 | 按钮最小命中区 | 沿用 `.gothic-btn` 既有 `padding:16px 42px`（桌面）；触控端建议 ≥44px 高（可复用 `.touch-device .gothic-btn` 放大规则，若工程沿用）。 |

> 既有 `prefers-reduced-motion` 媒体块（style.css line 326–328、801–803）已覆盖 `#achievement`/`#loot-ring`；本规格新增规则须并入同一媒体查询。

---

## 5. 落地 DOM / class 规范（供工程按此实现）

> ⚠️ 以下为「规格草案」，由工程负责人落地到 `index.html` / `src/style.css` / `main.js`。**美术不写代码。**

### 5.1 `#update-prompt` DOM 草案（index.html 内，已预留容器）

```html
<!-- 运行时版本自检：顶部滑入横幅（非阻断）。hidden 由 JS 控制显隐 -->
<div id="update-prompt" role="status" aria-live="polite" hidden>
  <div class="up-inner">
    <span class="up-icon" aria-hidden="true">⚡</span>
    <div class="up-text">
      <p class="up-title">发现新版本</p>
      <p class="up-msg">发现新版本，是否立即更新？</p>
      <p class="up-meta" hidden></p><!-- 可选：当前 vX → 最新 vY -->
    </div>
    <div class="up-actions">
      <button type="button" class="gothic-btn ghost" data-action="later">稍后</button>
      <button type="button" class="gothic-btn is-ember" data-action="reload">立即刷新</button>
    </div>
  </div>
</div>
```

- **class 命名约定**：容器 `#update-prompt`（接口预留）；子元素统一 `up-*` 前缀（`.up-inner/.up-icon/.up-text/.up-title/.up-msg/.up-meta/.up-actions`），作用域隔离，不与既有类冲突。
- **按钮**：次 `.gothic-btn.ghost`；主 `.gothic-btn.is-ember`（唯一新增修饰类）。

### 5.2 事件绑定点（对齐主理人既定接口）

```js
// 监听文档级不一致事件（e.detail: {current, latest, builtAt}）
document.addEventListener('version-mismatch', (e) => {
  const { current, latest } = e.detail;          // 取自 e.detail
  // 1) 填充可选副信息：up-meta.textContent = `当前 v${current} → 最新 v${latest}`
  // 2) 移除 #update-prompt 的 hidden → 触发滑入
  // 3) （可选）键盘：焦点移到 [data-action="reload"]
});
// 按钮：data-action="later" → 收起（加回 hidden）
// 按钮：data-action="reload" → location.reload(true)
// 版本信息源：window.__versionInfo = { buildId, commit, builtAt, hasUpdate }
```

### 5.3 `#loading` 挂载点与 DOM 约定（新建）

```html
<!-- 首屏加载幕（z100），默认可见；加载完成由工程移除 hidden / 卸载 -->
<div id="loading" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="加载进度">
  <div class="loading-inner">
    <p class="loading-title">夜裔幸存者</p>
    <p class="loading-sub">NIGHT SURVIVORS</p>
    <div id="load-bar"><div id="load-bar-fill"></div></div>
    <p id="load-pct" aria-hidden="true">0%</p>
  </div>
</div>
```

- **进度钩子**：`src/assets.js` 的 `loadAssets(onProgress)` 已回传 `0..1`；工程在 `game.init()` 前/中把 `onProgress(p)` 接到：
  - `#load-bar-fill`.style.width = `${p*100}%`
  - `#load-pct`.textContent = `${Math.round(p*100)}%`
  - `#loading`.setAttribute('aria-valuenow', Math.round(p*100))
  - 完成时移除 `#loading` 的 `hidden` / 卸载节点，露出标题屏。

### 5.4 需由工程写入 `src/style.css` 的规格片段（美术给出，工程落地）

```css
/* ===== 版本更新提示横幅（沿用 .gothic-btn / #achievement 语言） ===== */
#update-prompt {
  position: absolute; top: 0; left: 0; right: 0;
  z-index: 45;                 /* 高于 pause(40) 低于 mute(50) */
  display: flex; justify-content: center;
  pointer-events: none;        /* 非阻断：仅横幅本体可点 */
  padding-top: calc(12px + env(safe-area-inset-top, 0px));
}
#update-prompt[hidden] { display: none; }
.up-inner {
  pointer-events: auto;        /* 恢复横幅内交互 */
  display: flex; align-items: center; gap: 18px;
  max-width: min(720px, 92vw);
  background: linear-gradient(180deg, rgba(28,18,40,.96), rgba(12,8,22,.96));
  border: 2px solid rgba(212,175,55,.85);
  box-shadow: 0 0 30px rgba(142,68,173,.55), inset 0 0 18px rgba(212,175,55,.18);
  padding: 14px 22px;
  clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
}
.up-icon { font-size: 20px; color: var(--gold); text-shadow: 0 0 12px rgba(212,175,55,.7); flex: none; }
.up-text { flex: 1 1 auto; min-width: 0; }
.up-title { font-family: var(--body-font); font-weight: 900; font-size: 15px; letter-spacing: 2px; color: var(--gold); }
.up-msg { font-family: var(--body-font); font-size: 13px; color: var(--bone); margin-top: 3px; line-height: 1.5; }
.up-meta { font-family: var(--body-font); font-size: 11px; color: var(--bone); opacity: .7; margin-top: 2px; }
.up-actions { display: flex; gap: 10px; flex: none; }

/* 主按钮 ember 修饰（唯一新增类，复用 #f1c40f） */
.gothic-btn.is-ember { border-color: #f1c40f; }
.gothic-btn.is-ember:hover { background: #f1c40f; color: #000; box-shadow: 0 0 22px rgba(241,196,15,.6); }

/* 焦点环：补 .gothic-btn 既有缺口，对齐 .top-back */
.gothic-btn:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }

/* 滑入动效 */
#update-prompt:not([hidden]) .up-inner { animation: upSlideIn .45s cubic-bezier(.2,1.3,.4,1) both; }
@keyframes upSlideIn {
  from { opacity: 0; transform: translateY(-120%); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ===== 加载幕 + 进度条（沿用 #boss-bar / #exp-bar 语言） ===== */
#loading {
  position: absolute; inset: 0; z-index: 100;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(rgba(13,10,26,.82), rgba(13,10,26,.95)), url("/assets/bg_title.png") center / cover no-repeat;
}
#loading[hidden] { display: none; }
.loading-inner { text-align: center; }
.loading-title { font-family: var(--body-font); font-weight: 900; font-size: clamp(34px,7vw,64px); letter-spacing: 10px; color: var(--gold); text-shadow: 0 0 26px rgba(212,175,55,.55); }
.loading-sub { font-family: var(--pixel-font); font-size: 11px; letter-spacing: 6px; color: var(--bone); opacity: .8; margin: 10px 0 34px; }
#load-bar {
  width: min(420px, 80vw); height: 16px; margin: 0 auto;
  background: rgba(0,0,0,.7); border: 2px solid var(--gold); outline: 1px solid #000;
}
#load-bar-fill {
  height: 100%; width: 0%;
  background: linear-gradient(90deg, #e67e22, #f1c40f);
  box-shadow: 0 0 14px rgba(241,196,15,.8);
  transition: width .18s ease;
}
#load-pct { font-family: var(--pixel-font); font-size: 14px; color: var(--gold); text-shadow: 0 0 10px rgba(212,175,55,.6); margin-top: 14px; }

/* ===== 降级：prefers-reduced-motion（并入既有媒体查询） ===== */
@media (prefers-reduced-motion: reduce) {
  #update-prompt:not([hidden]) .up-inner { animation: none; }
  /* 加载幕可选 pulse 循环在此处关闭 */
}
```

---

## 6. 与现有视觉系统的对齐说明（收敛点）

1. **零新色**：ember 用 `#f1c40f/#e67e22`（图鉴词缀既有）、gold 用 `--gold #d4af37`、night 用 `--bg`/`rgba(13,10,26)`、blood 用 `--blood`，全部取自 `:root` 与 ui.js，未引入任何新 hex。
2. **按钮不另起炉灶**：仅新增 `.gothic-btn.is-ember` 一个修饰类；次按钮直接复用 `.gothic-btn.ghost`。
3. **横幅视觉家族一致**：表面/描边/辉光直接复用 `#achievement` 的数值，与游戏内既有金色横幅同源。
4. **进度条语言一致**：轨道复用 `#boss-bar`（暗轨+金描边+`outline:1px #000`），填充复用 `#exp-bar`/`#hp-bar` 的 `transition:width .18s ease` 与辉光写法，仅换色为 ember。
5. **字体一致**：拉丁/数字（百分比、NIGHT SURVIVORS）用 `--pixel-font`（Press Start 2P 自托管）；中文文案用 `--body-font` 系统栈，零下载。
6. **焦点环对齐**：补 `.gothic-btn:focus-visible` 金环，与 `.top-back` 完全同款（`outline:2px solid var(--gold); outline-offset:2px`），消除既有缺口。
7. **降级并入既有媒体查询**：`prefers-reduced-motion` 规则追加到 style.css 已有 block，不新建媒体查询。

---

## 7. 技术接口对齐（主理人已定调，美术无需与工程互通信）

| 接口 | 约定 | 本规格对应 |
|---|---|---|
| 不一致事件 | `document.addEventListener('version-mismatch', e => { /* e.detail: {current, latest, builtAt} */ })` | §5.2 事件绑定点 |
| UI 容器 | `<div id="update-prompt" hidden></div>`（index.html 预留） | §5.1 DOM |
| 版本信息 | `window.__versionInfo = { buildId, commit, builtAt, hasUpdate }` | 可选副信息源 |
| 刷新入口 | `location.reload(true)` | 主按钮 `data-action="reload"` |

---

## 8. 待主理人 / 工程确认项（审批清单）

1. **版本提示形态**：采用顶部横幅（canon）✓，还是并存弱遮罩弹窗？请拍板。
2. **主按钮 ember 色**：用 `#f1c40f`（brief ember）✓，还是改用系统主金 `--gold #d4af37` 以更贴近 `#achievement` 家族？二选一确认。
3. **加载幕是否采用 `bg_title.png` 暗化背景**（复用标题屏语言）✓，还是纯 `--bg` 实心（更轻量）？
4. **`.gothic-btn:focus-visible` 金环补充**：本规格建议补（消除既有缺口），是否同意随本次 MR 一并合入？
5. **进度条挂载时机**：确认由 `loadAssets(onProgress)` 驱动（既有钩子），工程在 `game.init()` 中接线。
6. **可选副信息**（当前 vX → 最新 vY）是否显示？默认隐藏，由 `e.detail` 填充。

---

*文档版本：v1.0 · 美术负责人产出 · 落地由工程负责人按 §5 规格实现（美术不写代码）。*
