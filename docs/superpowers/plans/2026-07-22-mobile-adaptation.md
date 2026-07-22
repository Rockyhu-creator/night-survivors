# 手机端适配实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为《夜裔幸存者》添加手机端触屏适配，包括虚拟摇杆移动、触屏暂停按钮、响应式 UI 和方向引导。

**Architecture:** 保持 960×540 逻辑分辨率不变；新增 `MobileControls` 类管理虚拟摇杆和触屏暂停按钮的 DOM 与 pointer 事件；扩展 `Input` 类的 `axis()` 方法合并键盘与虚拟输入；通过 CSS 媒体查询适配小屏。仅在触屏设备激活控件，桌面端零影响。

**Tech Stack:** 原生 ES Modules + Canvas 2D + pointer 事件 + CSS 媒体查询。无测试框架，依赖手动浏览器验证。

**Spec:** [docs/superpowers/specs/2026-07-22-mobile-adaptation-design.md](../specs/2026-07-22-mobile-adaptation-design.md)

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `index.html` | 修改 | viewport meta、新增旋转提示/摇杆/暂停按钮 DOM |
| `src/engine.js` | 修改 | `Input` 类新增 `setVirtualInput` + `axis()` 合并虚拟输入 |
| `src/mobile-controls.js` | 新增 | `MobileControls` 类：摇杆 + 暂停按钮的 DOM 与事件 |
| `src/entities.js` | 修改 | `Player.takeDamage` 成功受击后触发振动 |
| `src/main.js` | 修改 | 检测触屏设备并实例化 `MobileControls` |
| `src/style.css` | 修改 | 摇杆/按钮样式、旋转提示、响应式小屏适配 |

---

## Task 1: viewport meta + 旋转提示遮罩

**Files:**
- Modify: `index.html:5` (viewport meta)
- Modify: `index.html:104` (在 `#pause-overlay` 后、`</div>` 前，新增 `#rotate-hint`)
- Modify: `src/style.css` (文件末尾追加)

- [ ] **Step 1: 更新 viewport meta**

修改 `index.html` 第 5 行：

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

- [ ] **Step 2: 新增旋转提示遮罩 DOM**

在 `index.html` 中 `#pause-overlay` div 的结束标签 `</div>` 之后、外层 `</div>`（`#app`）之前，插入：

```html
    <!-- 手机端竖屏旋转提示 -->
    <div id="rotate-hint">
      <p class="rotate-icon">📱</p>
      <p class="rotate-text">请横屏游玩</p>
    </div>
```

- [ ] **Step 3: 新增旋转提示遮罩 CSS**

在 `src/style.css` 文件末尾追加：

```css
/* ---------- 手机端竖屏旋转提示 ---------- */
#rotate-hint {
  position: absolute; inset: 0; z-index: 100;
  background: rgba(6, 3, 12, 0.92);
  display: none;
  flex-direction: column; align-items: center; justify-content: center;
  gap: 18px;
}
.rotate-icon { font-size: 64px; animation: rotateHint 2s ease-in-out infinite; }
@keyframes rotateHint {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(90deg); }
}
.rotate-text {
  font-family: var(--pixel-font); font-size: 14px;
  letter-spacing: 4px; color: var(--bone); opacity: 0.85;
}
@media (orientation: portrait) and (pointer: coarse) {
  #rotate-hint { display: flex; }
}
```

- [ ] **Step 4: 浏览器验证**

Run: `npm run dev`，访问 `http://localhost:5173`

验证：
- 桌面端（默认横屏宽屏）：`#rotate-hint` 不显示
- Chrome DevTools 切换到设备模拟（如 iPhone 12 Pro），切到竖屏：显示"请横屏游玩"提示
- 切回横屏：提示消失

- [ ] **Step 5: 构建验证**

Run: `npm run build`
Expected: 构建成功，无报错

- [ ] **Step 6: Commit**

```bash
git add index.html src/style.css
git commit -m "feat(mobile): viewport meta + 竖屏旋转提示"
```

---

## Task 2: Input 类扩展（支持虚拟摇杆输入）

**Files:**
- Modify: `src/engine.js:1-26` (整个 `Input` 类)

- [ ] **Step 1: 扩展 Input 类**

将 `src/engine.js` 中整个 `Input` 类替换为：

```javascript
export class Input {
  constructor() {
    this.keys = new Set();
    this.virtualX = 0;
    this.virtualY = 0;
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.virtualX = 0;
      this.virtualY = 0;
    });
  }

  // 由 MobileControls 调用，写入虚拟摇杆的归一化向量
  setVirtualInput(x, y) {
    this.virtualX = x;
    this.virtualY = y;
  }

  axis() {
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    // 合并虚拟摇杆输入：每轴取绝对值最大者
    if (Math.abs(this.virtualX) > Math.abs(x)) x = this.virtualX;
    if (Math.abs(this.virtualY) > Math.abs(y)) y = this.virtualY;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.SQRT2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }
}
```

- [ ] **Step 2: 桌面端回归验证**

Run: `npm run dev`，访问 `http://localhost:5173`，开始游戏

验证：
- WASD / 方向键移动正常（虚拟输入为 0，不影响）
- 角色斜向移动速度正确（对角线归一化生效）

- [ ] **Step 3: 构建验证**

Run: `npm run build`
Expected: 构建成功

- [ ] **Step 4: Commit**

```bash
git add src/engine.js
git commit -m "feat(mobile): Input 类支持虚拟摇杆输入合并"
```

---

## Task 3: MobileControls 类（虚拟摇杆 + 触屏暂停按钮）

**Files:**
- Create: `src/mobile-controls.js`

- [ ] **Step 1: 创建 MobileControls 类**

创建 `src/mobile-controls.js`：

```javascript
// 手机端触屏控件：虚拟摇杆（左下）+ 触屏暂停按钮（右上）
// 仅在触屏设备激活，桌面端不渲染
export class MobileControls {
  constructor(game) {
    this.game = game;
    this.enabled = false;
    this.joyActive = false;
    this.joyCenter = { x: 0, y: 0 };
    this.joyRadius = 40; // 摇杆拖动限幅半径
    this.buildDom();
  }

  buildDom() {
    // 虚拟摇杆：base 圆盘 + thumb 中心点
    this.joyBase = document.createElement('div');
    this.joyBase.id = 'joystick-base';
    this.joyThumb = document.createElement('div');
    this.joyThumb.id = 'joystick-thumb';
    this.joyBase.appendChild(this.joyThumb);
    this.joyBase.classList.add('hidden');

    // 触屏暂停按钮
    this.pauseBtn = document.createElement('button');
    this.pauseBtn.id = 'touch-pause-btn';
    this.pauseBtn.classList.add('hidden');
    this.pauseBtn.setAttribute('aria-label', '暂停');
    this.pauseBtn.textContent = '⏸';

    document.getElementById('app').append(this.joyBase, this.pauseBtn);
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.joyBase.classList.remove('hidden');
    this.pauseBtn.classList.remove('hidden');

    // 摇杆 pointer 事件
    this.joyBase.setPointerCapture = this.joyBase.setPointerCapture.bind(this.joyBase);
    this._onJoyDown = (e) => this.handleJoyDown(e);
    this._onJoyMove = (e) => this.handleJoyMove(e);
    this._onJoyUp = (e) => this.handleJoyUp(e);
    this.joyBase.addEventListener('pointerdown', this._onJoyDown);
    this.joyBase.addEventListener('pointermove', this._onJoyMove);
    this.joyBase.addEventListener('pointerup', this._onJoyUp);
    this.joyBase.addEventListener('pointercancel', this._onJoyUp);

    // 暂停按钮
    this._onPauseClick = () => {
      if (this.game.state === 'playing' || this.game.state === 'paused') {
        this.game.togglePause();
      }
    };
    this.pauseBtn.addEventListener('click', this._onPauseClick);
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    this.joyBase.classList.add('hidden');
    this.pauseBtn.classList.add('hidden');
    this.joyBase.removeEventListener('pointerdown', this._onJoyDown);
    this.joyBase.removeEventListener('pointermove', this._onJoyMove);
    this.joyBase.removeEventListener('pointerup', this._onJoyUp);
    this.joyBase.removeEventListener('pointercancel', this._onJoyUp);
    this.pauseBtn.removeEventListener('click', this._onPauseClick);
    this.game.input.setVirtualInput(0, 0);
    this.resetThumb();
  }

  destroy() {
    this.disable();
    this.joyBase.remove();
    this.pauseBtn.remove();
  }

  handleJoyDown(e) {
    this.joyActive = true;
    const rect = this.joyBase.getBoundingClientRect();
    this.joyCenter = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    this.joyBase.setPointerCapture(e.pointerId);
    this.updateJoy(e.clientX, e.clientY);
  }

  handleJoyMove(e) {
    if (!this.joyActive) return;
    this.updateJoy(e.clientX, e.clientY);
  }

  handleJoyUp(e) {
    if (!this.joyActive) return;
    this.joyActive = false;
    try { this.joyBase.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    this.game.input.setVirtualInput(0, 0);
    this.resetThumb();
  }

  updateJoy(clientX, clientY) {
    let dx = clientX - this.joyCenter.x;
    let dy = clientY - this.joyCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // 限幅到 joyRadius
    if (dist > this.joyRadius) {
      const scale = this.joyRadius / dist;
      dx *= scale;
      dy *= scale;
    }
    // 视觉位移
    this.joyThumb.style.transform = `translate(${dx}px, ${dy}px)`;
    // 归一化向量写入 Input
    const nx = this.joyRadius > 0 ? dx / this.joyRadius : 0;
    const ny = this.joyRadius > 0 ? dy / this.joyRadius : 0;
    this.game.input.setVirtualInput(nx, ny);
  }

  resetThumb() {
    this.joyThumb.style.transform = 'translate(0, 0)';
  }
}
```

- [ ] **Step 2: 新增摇杆和暂停按钮 CSS**

在 `src/style.css` 文件末尾追加：

```css
/* ---------- 手机端虚拟摇杆 + 触屏暂停按钮 ---------- */
#joystick-base {
  position: absolute;
  left: calc(30px + env(safe-area-inset-left));
  bottom: calc(30px + env(safe-area-inset-bottom));
  width: 120px; height: 120px;
  border-radius: 50%;
  background: rgba(20, 14, 32, 0.5);
  border: 3px solid rgba(212, 175, 55, 0.5);
  z-index: 12;
  touch-action: none;
  display: flex; align-items: center; justify-content: center;
}
#joystick-thumb {
  width: 60px; height: 60px;
  border-radius: 50%;
  background: rgba(212, 175, 55, 0.7);
  border: 2px solid rgba(255, 255, 255, 0.4);
  pointer-events: none;
  transition: transform 0.08s ease-out;
}
#joystick-base.hidden { display: none; }

#touch-pause-btn {
  position: absolute;
  top: calc(32px + env(safe-area-inset-top));
  right: calc(14px + env(safe-area-inset-right));
  width: 44px; height: 44px;
  background: rgba(20, 14, 32, 0.8);
  border: 2px solid rgba(212, 175, 55, 0.5);
  color: var(--bone);
  font-size: 20px;
  border-radius: 6px;
  z-index: 13;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  touch-action: manipulation;
}
#touch-pause-btn.hidden { display: none; }
#touch-pause-btn:active { background: rgba(212, 175, 55, 0.3); }

/* 仅触屏设备显示控件 */
@media (pointer: fine) {
  #joystick-base, #touch-pause-btn { display: none !important; }
}
```

- [ ] **Step 3: 构建验证**

Run: `npm run build`
Expected: 构建成功，无报错

- [ ] **Step 4: Commit**

```bash
git add src/mobile-controls.js src/style.css
git commit -m "feat(mobile): MobileControls 类(虚拟摇杆+触屏暂停按钮)"
```

---

## Task 4: 集成到 main.js + game.js

**Files:**
- Modify: `src/main.js:1-3` (import + 实例化)
- Modify: `src/game.js` (确认 `togglePause` 可被外部调用，无需改动则跳过)

- [ ] **Step 1: 检查 game.js 的 togglePause 是否已公开**

读取 `src/game.js` 确认 `togglePause()` 是类方法（无 `private` 前缀），可被 `MobileControls` 通过 `this.game.togglePause()` 调用。

如果已经是公开方法（根据 spec 第 5.3 节"暂停状态机不变，触屏按钮调用同一 togglePause()"），则无需改动 `game.js`，跳到 Step 2。

如果需要改动，将 `togglePause` 方法确保无 `#` 私有前缀。

- [ ] **Step 2: 修改 main.js 实例化 MobileControls**

将 `src/main.js` 第 1-5 行：

```javascript
import { Game } from './game.js';
import { DIFFICULTIES } from './data.js';

const game = new Game();
game.init();
```

替换为：

```javascript
import { Game } from './game.js';
import { DIFFICULTIES } from './data.js';
import { MobileControls } from './mobile-controls.js';

const game = new Game();
game.init();

// 触屏设备检测：激活手机端控件
const isTouchDevice = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouchDevice) {
  const mobileControls = new MobileControls(game);
  mobileControls.enable();
}
```

- [ ] **Step 3: 桌面端回归验证**

Run: `npm run dev`，访问 `http://localhost:5173`

验证：
- 桌面端（`pointer: fine`）：不显示摇杆和暂停按钮（CSS `@media (pointer: fine)` 强制隐藏）
- 桌面端 WASD 移动正常

- [ ] **Step 4: 移动端验证（Chrome DevTools 设备模拟）**

在 Chrome DevTools 中切换到设备模拟模式（如 iPhone 12 Pro 横屏）：

验证：
- 左下角出现半透明虚拟摇杆
- 右上角出现暂停按钮
- 用鼠标拖动摇杆 thumb：角色朝拖动方向移动
- 松开鼠标：thumb 回中心，角色停止
- 摇杆 thumb 不会拖出 base 圆盘边界（限幅 40px）
- 点击暂停按钮：显示"已暂停"遮罩
- 再点暂停按钮：恢复游戏

- [ ] **Step 5: 构建验证**

Run: `npm run build`
Expected: 构建成功

- [ ] **Step 6: Commit**

```bash
git add src/main.js src/game.js
git commit -m "feat(mobile): main.js 集成 MobileControls 触屏检测"
```

---

## Task 5: 振动反馈

**Files:**
- Modify: `src/entities.js` (`Player.takeDamage` 方法)

- [ ] **Step 1: 定位 Player.takeDamage 方法**

读取 `src/entities.js`，找到 `takeDamage` 方法（根据 spec 第 5.2 节，已应用 `damageTakenMul` 减伤）。

预期代码形如：
```javascript
takeDamage(amount) {
  if (this.iframes > 0) return false;
  this.hp -= amount * (this.damageTakenMul || 1);
  this.iframes = 0.5;
  return true;
}
```

- [ ] **Step 2: 在 takeDamage 成功扣血后添加振动**

将 `takeDamage` 方法修改为（在 `return true;` 前插入振动）：

```javascript
takeDamage(amount) {
  if (this.iframes > 0) return false;
  this.hp -= amount * (this.damageTakenMul || 1);
  this.iframes = 0.5;
  if (navigator.vibrate) navigator.vibrate(50);
  return true;
}
```

- [ ] **Step 3: 浏览器验证**

Run: `npm run dev`

验证：
- 桌面端：受击时无报错（`navigator.vibrate` 在桌面浏览器为 undefined，`if` 自动跳过）
- 移动端（真机，如 Android Chrome）：受击时手机振动 50ms
- iOS Safari：无振动但无报错（自动跳过）

- [ ] **Step 4: 构建验证**

Run: `npm run build`
Expected: 构建成功

- [ ] **Step 5: Commit**

```bash
git add src/entities.js
git commit -m "feat(mobile): 受击振动反馈"
```

---

## Task 6: 响应式 CSS 完整适配（升级卡片 + HUD + 操作条）

**Files:**
- Modify: `src/style.css` (文件末尾追加响应式媒体查询)

- [ ] **Step 1: 追加响应式 CSS**

在 `src/style.css` 文件末尾追加：

```css
/* ---------- 手机端响应式适配 ---------- */
@media (max-width: 720px) and (pointer: coarse) {
  /* 升级卡片纵向堆叠 */
  #upgrade-cards {
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
    max-height: 70vh;
    padding: 0 12px;
  }
  .upgrade-card {
    width: min(420px, 88vw);
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 14px;
    text-align: left;
  }
  .upgrade-card img { width: 56px; height: 56px; flex-shrink: 0; }
  .upgrade-card .uc-kind { margin-top: 0; font-size: 8px; }
  .upgrade-card h3 { margin: 4px 0 4px; font-size: 16px; }
  .upgrade-card p { font-size: 12px; line-height: 1.5; }
  .upgrade-card .uc-pick { flex-shrink: 0; }

  .levelup-title { font-size: 32px; letter-spacing: 8px; }
  .levelup-sub { margin: 8px 0 18px; letter-spacing: 3px; font-size: 13px; }

  /* 升级操作条触控友好 */
  #upgrade-actions { gap: 10px; margin-bottom: 14px; flex-wrap: wrap; justify-content: center; }
  .ua-btn { padding: 10px 16px; font-size: 9px; }
  .ua-hint { font-size: 10px; width: 100%; text-align: center; opacity: 0.6; }

  /* HUD 缩放 */
  #hud-top { top: 28px; gap: 20px; }
  #hp-wrap { width: 160px; height: 16px; }
  #timer { font-size: 20px; letter-spacing: 2px; }
  #kill-count { width: 140px; font-size: 12px; }

  /* 装备图标缩小 */
  #loadout { left: 10px; bottom: 10px; gap: 6px; }
  .loadout-icon { width: 36px; height: 36px; }
  .loadout-lv { font-size: 7px; padding: 1px 2px; }

  /* Boss 血条 */
  #boss-bar-wrap { top: 56px; width: min(420px, 80vw); }
  #boss-name { font-size: 14px; letter-spacing: 4px; }

  /* 图鉴界面 */
  #codex-screen { padding: 20px 12px; }
  .codex-title { font-size: 30px; letter-spacing: 8px; }
  .codex-grid { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 10px; }
  .codex-card { padding: 10px 6px; }
  .codex-card img { width: 42px; height: 42px; }
  .codex-card .cc-name { font-size: 12px; }
  .codex-card .cc-hint { font-size: 10px; }

  /* 暂停提示文案适配 */
  .pause-hint { font-size: 12px; letter-spacing: 2px; }

  /* 结算界面 */
  .gameover-title { font-size: 36px; letter-spacing: 6px; }
  .stat-line { font-size: 11px; gap: 14px; }
  .stat-line b { min-width: 90px; }
  .gameover-btns { gap: 14px; flex-wrap: wrap; }

  /* 标题界面 */
  .game-title { font-size: clamp(42px, 12vw, 72px); letter-spacing: 6px; }
  .title-tagline { margin: 12px 0 22px; font-size: 13px; letter-spacing: 4px; }
  .how-to { gap: 18px; margin-top: 24px; flex-wrap: wrap; }
  .how-key { font-size: 8px; padding: 5px 7px; }
}
```

- [ ] **Step 2: 移动端验证（Chrome DevTools 设备模拟）**

Run: `npm run dev`，Chrome DevTools 切到 iPhone 12 Pro 横屏

验证：
- 标题界面：标题字号缩小，难度按钮可触屏点击，"开始狩猎"按钮可点
- 游戏中：HUD（HP/计时器/击杀数）字号可读，不溢出
- 升级界面：三张卡片纵向堆叠，每张卡片为横向布局（图标+文字+选择按钮）
- 升级卡片可滚动（如高度溢出）
- Reroll/Banish 按钮可触屏点击
- 图鉴界面：卡片网格 2 列，可触屏滚动
- 结算界面：字号适配，按钮可点

- [ ] **Step 3: 桌面端回归验证**

切换回桌面端（关闭设备模拟）

验证：
- 所有界面保持原有布局（响应式 CSS 仅在 `pointer: coarse` 时生效）
- 字号、间距与适配前完全一致

- [ ] **Step 4: 构建验证**

Run: `npm run build`
Expected: 构建成功

- [ ] **Step 5: Commit**

```bash
git add src/style.css
git commit -m "feat(mobile): 响应式 CSS 适配小屏(升级卡片堆叠+HUD缩放+图鉴)"
```

---

## Task 7: 端到端验证 + 真机测试

**Files:**
- 无文件修改，仅验证

- [ ] **Step 1: 桌面端完整回归测试**

Run: `npm run dev`，桌面浏览器访问 `http://localhost:5173`

逐项验证（spec 7.1 节）：
- [ ] WASD / 方向键移动正常
- [ ] ESC / P 暂停正常
- [ ] 升级三选一卡片点击、Reroll、Banish 正常
- [ ] 图鉴打开 / 关闭正常
- [ ] Boss 战血条、警告正常
- [ ] 桌面端不出现虚拟摇杆和触屏暂停按钮

- [ ] **Step 2: 移动端模拟完整测试**

Chrome DevTools 切到 iPhone 12 Pro 横屏

逐项验证（spec 7.2 节）：
- [ ] 虚拟摇杆拖动 → 角色移动，方向准确
- [ ] 摇杆限幅生效（thumb 不超出 base 边界）
- [ ] 松开摇杆 → 角色停止
- [ ] 触屏暂停按钮可点，点击后显示暂停遮罩
- [ ] 暂停状态下再点暂停按钮可恢复
- [ ] 升级界面：卡片纵向堆叠，可触屏选中
- [ ] "选择"按钮可触屏点击
- [ ] Reroll / Banish 按钮可触屏点击
- [ ] 难度选择按钮可触屏点击
- [ ] 图鉴可触屏滚动浏览
- [ ] 竖屏进入 → 显示旋转提示遮罩，横屏后消失
- [ ] Boss 血条不溢出小屏
- [ ] HUD 字号在小屏下可读
- [ ] 双指捏合不触发页面缩放

- [ ] **Step 3: 真机测试（如条件允许）**

用手机浏览器访问 Cloudflare Pages 部署的域名（或本地 IP）：

- [ ] 横屏游玩完整一局（开始 → 升级 → Boss 战 → 死亡）
- [ ] 振动反馈触发（Android 设备）
- [ ] 无控制台报错（通过 Chrome 远程调试查看）

- [ ] **Step 4: 边界情况验证**

- [ ] 游戏过程中切换横竖屏：竖屏显示提示（且游戏暂停），横屏恢复
- [ ] 多点触控：摇杆 + 暂停按钮可同时操作
- [ ] pointer 离开 base 范围后仍能拖动（pointer capture 生效）

- [ ] **Step 5: 构建最终验证**

Run: `npm run build`
Expected: 构建成功，dist 目录生成

- [ ] **Step 6: 推送部署**

```bash
git push
```

观察 Cloudflare Pages 自动部署成功，用手机访问线上域名做最终验证。

---

## 验收清单

完成所有 Task 后，确认以下全部通过：

- [ ] 桌面端零影响：所有原有功能不变，不显示触屏控件
- [ ] 移动端可用：虚拟摇杆移动、触屏暂停、升级/Reroll/Banish、图鉴、Boss 战全部可触屏操作
- [ ] 竖屏引导：竖屏进入显示"请横屏游玩"
- [ ] 响应式 UI：小屏下字号、卡片、HUD 适配可读
- [ ] 振动反馈：支持的设备上受击振动
- [ ] 构建成功：`npm run build` 无报错
- [ ] 已推送到 GitHub 触发 Cloudflare Pages 自动部署
