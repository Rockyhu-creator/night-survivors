# 手机端竖屏游玩适配设计

**日期**：2026-07-22
**状态**：已确认，待编写实现计划
**前置**：已完成手机端横屏适配（commit `201fe8e`），但微信内置浏览器的 `orientation` 媒体查询不可靠，竖屏下显示"请横屏游玩"但用户转横屏后无法检测，卡死在提示页。

## 1. 目标

让游戏在手机竖屏下也能流畅游玩，不再强制横屏。横屏模式保留，两种方向自动切换。

## 2. 方案：动态逻辑分辨率

### 2.1 核心原则

- **检测方向用 JS**：`window.innerHeight > window.innerWidth`（微信可靠，不依赖 CSS `orientation` 媒体查询）
- **仅触屏设备启用竖屏模式**：桌面端始终保持 960×540（避免桌面缩窗口时误触发）
- **动态切换 CONFIG**：竖屏时 `LOGICAL_WIDTH=540, LOGICAL_HEIGHT=960`，横屏/桌面恢复 `960×540`
- **可视面积不变**：540×960 = 960×540 = 518400 像素，游戏平衡不受影响

### 2.2 改动概览

```
src/
├── data.js          # 修改：LOGICAL_WIDTH/HEIGHT 改为可变（导出 setLogicalSize）
├── game.js          # 修改：resize() 检测方向切换分辨率 + 重置相机 + 重新跟随
├── main.js          # 修改：方向变化时调用 game.resize()，给 <html> 加 .portrait class
├── mobile-controls.js  # 微调：触屏控件位置在竖屏下适配
├── style.css        # 修改：移除 #rotate-hint，新增 .portrait 布局适配
└── index.html       # 修改：移除 #rotate-hint DOM
```

## 3. 组件设计

### 3.1 方向检测与分辨率切换（game.js + main.js）

**game.js `resize()` 改造**：
```javascript
resize() {
  const isTouchDevice = document.documentElement.classList.contains('touch-device');
  const isPortrait = isTouchDevice && window.innerHeight > window.innerWidth;
  // 动态切换逻辑分辨率
  if (isPortrait) {
    CONFIG.LOGICAL_WIDTH = 540;
    CONFIG.LOGICAL_HEIGHT = 960;
    document.documentElement.classList.add('portrait');
  } else {
    CONFIG.LOGICAL_WIDTH = 960;
    CONFIG.LOGICAL_HEIGHT = 540;
    document.documentElement.classList.remove('portrait');
  }
  this.canvas.width = CONFIG.LOGICAL_WIDTH;
  this.canvas.height = CONFIG.LOGICAL_HEIGHT;
  this.ctx.imageSmoothingEnabled = false;
  // 重新生成地面 pattern（依赖 ctx）
  this.regenerateGroundPattern?.();
  // 等比缩放居中
  const scale = Math.min(
    window.innerWidth / CONFIG.LOGICAL_WIDTH,
    window.innerHeight / CONFIG.LOGICAL_HEIGHT,
  );
  const w = Math.floor(CONFIG.LOGICAL_WIDTH * scale);
  const h = Math.floor(CONFIG.LOGICAL_HEIGHT * scale);
  this.canvas.style.width = `${w}px`;
  this.canvas.style.height = `${h}px`;
  this.canvas.style.left = `${Math.floor((window.innerWidth - w) / 2)}px`;
  this.canvas.style.top = `${Math.floor((window.innerHeight - h) / 2)}px`;
  // 相机重新跟随玩家（避免画面错位）
  if (this.player) {
    this.camera.x = this.player.x - CONFIG.LOGICAL_WIDTH / 2;
    this.camera.y = this.player.y - CONFIG.LOGICAL_HEIGHT / 2;
  }
}
```

**main.js 监听方向变化**：
```javascript
// game.js 已监听 window 'resize'，但 orientationchange 在某些移动浏览器
// 需单独监听 + 延迟（旋转动画期间 innerWidth/Height 不稳定）
window.addEventListener('orientationchange', () => setTimeout(() => game.resize(), 100));
// 微信 WebView 可能不触发 orientationchange，加 200ms 轮询兜底
let lastPortrait = null;
setInterval(() => {
  const isPortrait = window.innerHeight > window.innerWidth;
  if (isPortrait !== lastPortrait) {
    lastPortrait = isPortrait;
    game.resize();
  }
}, 200);
```

注意：仅当触屏设备时才需要轮询，可在 `isTouchDevice` 判断内执行以避免桌面端开销。

### 3.2 地面 pattern 重新生成

`game.js` init() 中创建 `this.groundPattern`（依赖 ctx）。分辨率切换后 canvas 重建，pattern 可能失效。需将 pattern 生成提取为方法 `regenerateGroundPattern()`，在 resize() 后调用。

### 3.3 移除旋转提示

- 删除 `index.html` 中的 `#rotate-hint` DOM
- 删除 `style.css` 中 `#rotate-hint` 相关 CSS 和 `@media (orientation: portrait)` 规则

### 3.4 竖屏 UI 适配（style.css）

新增 `.portrait` 前缀的 CSS 规则：

**HUD 竖屏布局**：
- `#hud-top`：横向 → 纵向堆叠（HP/计时器/击杀数垂直排列，居中）
- `#boss-bar-wrap`：宽度自适应竖屏
- `#loadout`：竖屏下移到右侧或顶部

**升级界面竖屏**：
- 卡片纵向堆叠（已有 `.touch-device` 规则，`.portrait` 下复用）

**触屏控件竖屏位置**：
- `#joystick-base`：保持左下
- `#touch-pause-btn`：保持右上

### 3.5 游戏逻辑硬编码点检查

需检查以下可能硬编码 960×540 的位置：
- `entities.js`：敌人生成位置（第 355-359 行已用 CONFIG 变量，OK）
- `game.js`：相机初始位置（第 122-123 行已用 CONFIG 变量，OK）
- `weapons.js`、`systems.js`：需 grep 确认无硬编码

## 4. 数据流

```
用户旋转手机
  → window 'orientationchange' / 'resize' 事件
  → game.resize()
  → 检测 isPortrait（innerHeight > innerWidth 且 touch-device）
  → 切换 CONFIG.LOGICAL_WIDTH/HEIGHT
  → canvas.width/height 更新
  → 重新生成 groundPattern
  → 重新缩放居中 canvas
  → 相机重新跟随玩家
  → <html> 添加/移除 .portrait class
  → CSS 自动切换竖屏布局
  → 下一帧 render() 用新分辨率渲染
```

## 5. 不做的事（YAGNI）

- ❌ 不做横屏模式移除（横屏仍可用，两种方向自动切换）
- ❌ 不做竖屏专门美术资源（复用现有素材，相机视野调整即可）
- ❌ 不做平板专门优化
- ❌ 不做 PWA 离线

## 6. 测试策略

无单元测试框架，依赖浏览器验证。

### 6.1 桌面端回归

- [ ] 桌面端（非 touch-device）：保持 960×540，无 .portrait class
- [ ] 缩放窗口不触发竖屏模式

### 6.2 移动端横屏

- [ ] 横屏：960×540，触屏控件显示，游戏正常
- [ ] 横屏下 `<html>` 无 .portrait class

### 6.3 移动端竖屏

- [ ] 竖屏：540×960，画布填满屏幕
- [ ] 竖屏下 `<html>` 有 .portrait class
- [ ] HUD 纵向布局可读
- [ ] 虚拟摇杆移动正常
- [ ] 升级卡片纵向堆叠
- [ ] Boss 血条不溢出
- [ ] 图鉴可滚动

### 6.4 方向切换

- [ ] 游戏中旋转手机：分辨率平滑切换，画面不错位
- [ ] 竖屏→横屏：恢复 960×540
- [ ] 横屏→竖屏：切换到 540×960
- [ ] 切换后角色位置不丢失，相机重新跟随

## 7. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 方向切换瞬间画面错位 | resize() 中立即重置相机跟随玩家 |
| groundPattern 失效 | 提取为方法，resize 后重新生成 |
| orientationchange 时 innerWidth 不稳定 | 用 setTimeout(100ms) 延迟读取 |
| 微信 WebView orientation 事件不触发 | 同时监听 resize + orientationchange + 定期检测（200ms 轮询兜底） |
