# 手机端适配设计（方案 B：完整移动端体验）

**日期**：2026-07-22
**状态**：已确认，待编写实现计划
**前置**：已完成无限成长被动 + Reroll/Banish + 暂停功能（commit `30d6656`）

## 1. 目标与范围

将《夜裔幸存者》从桌面端独占适配到手机端，使朋友在手机浏览器中也能流畅游玩。

### 目标设备

- **主要**：iPhone / Android 横屏手机
- **检测**：通过 `matchMedia('(pointer: coarse)')` 或 `'ontouchstart' in window` 识别触屏设备
- **非目标**：不做平板专门优化、不做 PWA 离线、不做竖屏游玩

### 功能范围

保留所有桌面端功能：难度选择、虚拟摇杆移动、升级三选一、Reroll/Banish、暂停、图鉴、Boss 战、神器进化。

## 2. 架构

### 2.1 核心原则

- **保持 960×540 逻辑分辨率不变**：现有美术、坐标系统、渲染逻辑全部复用
- **触屏与桌面共存**：通过 `Input` 类统一抽象，键盘 WASD 与虚拟摇杆都写入同一移动向量，互不冲突
- **仅触屏设备渲染控件**：桌面端完全不渲染虚拟摇杆和触屏暂停按钮

### 2.2 新增模块

```
src/
├── mobile-controls.js   # 新增：虚拟摇杆 + 触屏暂停按钮
├── engine.js            # 修改：Input 类扩展 setVirtualInput
├── entities.js          # 修改：Player.takeDamage 中触发振动
├── game.js              # 修改：暂停状态机已被触屏按钮复用
├── main.js              # 修改：实例化 MobileControls
└── style.css            # 修改：响应式 CSS、旋转提示遮罩
index.html               # 修改：viewport meta、新增遮罩和控件 DOM
```

## 3. 组件设计

### 3.1 viewport meta（index.html）

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
```

- `user-scalable=no` 禁止双指缩放（避免误触）
- `viewport-fit=cover` 适配刘海屏（配合 CSS `env(safe-area-inset-*)`）

### 3.2 MobileControls 类（src/mobile-controls.js）

**职责**：管理虚拟摇杆和触屏暂停按钮的 DOM 与 pointer 事件。

**接口**：
```javascript
class MobileControls {
  constructor(game);
  enable();    // 显示控件，绑定 pointer 事件
  disable();   // 隐藏控件，解绑事件
  destroy();   // 游戏结束时彻底清理
}
```

**虚拟摇杆实现**：
- DOM 结构：外层 `#joystick-base`（圆盘，直径 120px）+ 内层 `#joystick-thumb`（中心点，直径 60px）
- 位置：左下角，距边缘 30px（考虑 `env(safe-area-inset-bottom)`）
- 交互：
  - `pointerdown` 在 base 范围内 → 激活摇杆，记录中心点
  - `pointermove` → 计算 dx/dy，限幅到半径 40px，归一化为 -1~1
  - `pointerup` / `pointercancel` → thumb 回中心，调用 `input.setVirtualInput(0, 0)`
- 归一化向量通过 `game.input.setVirtualInput(nx, ny)` 传入

**触屏暂停按钮**：
- DOM：`#touch-pause-btn`，右上角，44×44px（满足苹果触控最小尺寸建议）
- 点击 → `game.togglePause()`
- 仅在 `state === 'playing'` 或 `state === 'paused'` 时可点

### 3.3 Input 类扩展（src/engine.js）

新增方法：
```javascript
setVirtualInput(x, y) {
  this.virtualX = x;
  this.virtualY = y;
}
```

`frame()` 修改：合并键盘状态与虚拟输入，取每轴绝对值最大者：
```javascript
const kx = (this.keys['d'] || this.keys['arrowright'] ? 1 : 0) - (this.keys['a'] || this.keys['arrowleft'] ? 1 : 0);
const ky = (this.keys['s'] || this.keys['arrowdown'] ? 1 : 0) - (this.keys['w'] || this.keys['arrowup'] ? 1 : 0);
this.moveX = Math.abs(kx) > Math.abs(this.virtualX) ? kx : this.virtualX;
this.moveY = Math.abs(ky) > Math.abs(this.virtualY) ? ky : this.virtualY;
```

初始化 `this.virtualX = 0; this.virtualY = 0;`。

### 3.4 方向引导遮罩（index.html + style.css）

```html
<div id="rotate-hint" class="hidden">
  <p class="rotate-icon">📱</p>
  <p class="rotate-text">请横屏游玩</p>
</div>
```

CSS：
```css
@media (orientation: portrait) and (pointer: coarse) {
  #rotate-hint { display: flex !important; }
}
```

仅触屏设备 + 竖屏时显示，横屏后自动隐藏。

### 3.5 响应式 CSS（style.css）

**断点**：`@media (max-width: 720px) and (pointer: coarse)`

**升级卡片堆叠**：
```css
@media (max-width: 720px) and (pointer: coarse) {
  #upgrade-cards { flex-direction: column; gap: 12px; }
  .upgrade-card { width: min(420px, 88vw); padding: 14px 16px; }
  .upgrade-card img { width: 56px; height: 56px; }
  .upgrade-card h3 { font-size: 16px; }
  .upgrade-card p { font-size: 12px; }
}
```

**HUD 缩放**：
- `#timer` 字号 26px → 20px
- `#hp-wrap` 宽度 220px → 160px
- `#kill-count` 宽度 220px → 140px，字号 14px → 12px
- `.loadout-icon` 46×46 → 36×36

**操作条按钮**：
- `.ua-btn` padding 增大（触控友好），字号略减

### 3.6 振动反馈（entities.js）

Player 受击时（在 `takeDamage` 方法内部，成功扣血后）：
```javascript
if (navigator.vibrate) navigator.vibrate(50);
```

可选特性，不支持 `navigator.vibrate` 的设备（如 iOS Safari）自动跳过，无副作用。

## 4. 数据流

```
触屏 pointerdown（在摇杆范围内）
  → MobileControls 激活摇杆，记录中心点

触屏 pointermove
  → 计算 dx = currentX - centerX, dy = currentY - centerY
  → 限幅：dist = min(sqrt(dx²+dy²), 40)
  → 归一化：nx = dx / 40, ny = dy / 40（限幅后）
  → input.setVirtualInput(nx, ny)
  → thumb 视觉位移到限幅后的 dx/dy

游戏 frame()
  → input.frame() 合并键盘 + 虚拟输入（取 max abs）
  → player.update() 应用 moveX/moveY

触屏 pointerup / pointercancel
  → input.setVirtualInput(0, 0)
  → thumb 动画回中心
```

## 5. 集成点

### 5.1 main.js

```javascript
import { MobileControls } from './mobile-controls.js';
// ...
const mobileControls = new MobileControls(game);
if (isTouchDevice) mobileControls.enable();
```

### 5.2 entities.js

- `Player.takeDamage` 成功受击后触发振动（`navigator.vibrate?.(50)`）

### 5.3 game.js

- 暂停状态机不变（已支持），触屏按钮调用同一 `togglePause()`

## 6. 不做的事（YAGNI）

- ❌ PWA / 离线缓存（方案 C 范围，后续可单独迭代）
- ❌ 竖屏游玩（仅横屏，竖屏显示旋转提示）
- ❌ 重做美术资源（复用 960×540 逻辑分辨率）
- ❌ 新增游戏机制（仅操控和 UI 适配）
- ❌ 平板专门优化（按手机横屏适配，平板可用但不专门调优）

## 7. 测试策略

无单元测试框架，依赖手动浏览器测试。

### 7.1 回归测试（桌面端）

- [ ] WASD / 方向键移动正常
- [ ] ESC / P 暂停正常
- [ ] 升级三选一卡片点击、Reroll、Banish 正常
- [ ] 图鉴打开 / 关闭正常
- [ ] Boss 战血条、警告正常
- [ ] 桌面端不出现虚拟摇杆和触屏暂停按钮

### 7.2 移动端测试

使用 Chrome DevTools 设备模拟（iPhone 12 Pro 横屏）+ 真机验证（如条件允许）。

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
- [ ] 受击时振动反馈（支持的设备上）
- [ ] 双指捏合不触发页面缩放

### 7.3 边界情况

- [ ] 游戏过程中切换横竖屏：竖屏暂停显示提示，横屏恢复
- [ ] 多点触控：摇杆 + 暂停按钮可同时操作
- [ ] pointer 离开 base 范围后仍能拖动（pointer capture）

## 8. 风险与缓解

| 风险 | 缓解 |
|------|------|
| iOS Safari 不支持 `navigator.vibrate` | 已用可选链 `navigator.vibrate?.(50)`，自动跳过 |
| pointer 事件在老旧手机浏览器兼容性 | pointer 事件已广泛支持（iOS 13+、Android Chrome 全部），无回退方案 |
| 虚拟摇杆遮挡游戏画面 | 摇杆半透明（opacity: 0.5），且固定在左下角不跟随相机 |
| 升级卡片纵向堆叠后高度溢出 | 卡片尺寸缩小 + `overflow-y: auto` 兜底 |
