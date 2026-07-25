# 夜裔幸存者 · 项目 Handoff 文档

> 供新会话窗口快速接手项目的上下文文档。最后更新：2026-07-25

---

## 1. 项目概览

**项目名称**：夜裔幸存者（Night Survivors）
**类型**：网页类吸血鬼幸存者游戏
**线上地址**：https://night-survivors.pages.dev
**仓库**：https://github.com/Rockyhu-creator/night-survivors
**本地路径**：`/Users/a34481/Documents/Trae_game`
**分支**：`main`（已合并 feature/night-survivors，所有开发在 main 上进行）

### 核心玩法
- 玩家在永夜中移动躲避敌人，武器自动攻击
- 拾取经验宝石升级，三选一强化（含 Reroll/Banish）
- 6 件神器可两两合成进化
- Boss 战定时出现，必掉宝箱
- 三档难度：夜行者（易）/ 狩猎者（中）/ 永夜（难）

### 终局机制（v0.12+）
- **9 分钟（`NIGHT_START=540`）**：永夜加深，敌人 HP/伤害指数提升
- **12 分钟（`ENDGAME_BOSS_TIME=720`）**：终局 Boss「永夜化身」降临，**击杀即通关**（`state='victory'`）
- **15 分钟（`GAME_HARD_CAP=900`）**：硬上限，到点仍有终局 Boss 存活则 `gameOver('timeout')` 判失败（区别于阵亡/胜利）
- 后期小怪：暗影猎手（冲刺）、石像鬼（免疫击退）、狼群 pack 波次
- 词缀系统：`volatile`（死亡爆破·橙）/ `shielded`（减伤·蓝）/ `pack`（成群·琥珀金）

---

## 2. 技术栈

| 类别 | 技术 |
|------|------|
| 构建工具 | Vite 5 |
| 渲染 | 原生 Canvas 2D（无游戏引擎） |
| 模块 | 原生 ES Modules |
| 字体 | Press Start 2P（自托管像素，拉丁/数字 HUD）+ 系统 CJK 栈（中文 UI，PingFang/YaHei/Noto Sans CJK） |
| 部署 | Cloudflare Pages（自动部署，git push 触发） |
| Node 版本 | **受管 v22.22.2**（`/Users/a34481/.workbuddy/binaries/node/versions/22.22.2/bin/node`，`npm run dev` 即可，无需 nvm） |
| e2e Python | 受管 venv `/Users/a34481/.workbuddy/binaries/python/envs/default/bin/python`（Pillow==12.3.0 + Playwright） |

### 关键技术约定
- **像素级渲染**：`image-rendering: pixelated`，固定 60Hz 逻辑步长（`STEP=1/60` 累加器）+ rAF 渲染，模拟帧率无关
- **动态逻辑分辨率**：
  - 桌面/横屏：960×540
  - **移动端锁竖屏（v0.24+，不再支持横屏）**：宽 540，高度按屏幕比例动态计算（960~1400）；横持时仍按竖屏渲染、等比缩放居中留黑边
- **Canvas DPR 去虚（v0.26+）**：`canvas.width/height = LOGICAL * min(devicePixelRatio,2)`，`ctx.setTransform(dpr,0,0,dpr,0,0)`，CSS 尺寸保持逻辑像素→高 DPI 屏（尤其手机）锐利不发虚；DPR 封顶 2x 防 3x 手机内存爆炸
- **跨设备瞄准一致（v0.26+）**：`pickTarget` 屏内优先（手机竖屏/桌面横屏都只锁可见最近敌）；`TARGET_RADIUS=540` 统一雷劫索敌；敌人回收环固定 `RECYCLE_RADIUS=900`（取代原 `LOGICAL_WIDTH*1.6`，设备无关）
- **切后台自动暂停（v0.24+）**：`visibilitychange` 监听，`hidden` 且 `playing` 时自动进暂停界面，恢复时 dt 从零起步
- **触屏检测**：`ontouchstart` + `maxTouchPoints` + `pointer: coarse` 多重检测，给 `<html>` 加 `.touch-device` class
- **不依赖 CSS `pointer: coarse` 媒体查询**（微信 WebView 不支持）

---

## 3. 文件结构

```
Trae_game/
├── index.html              # 入口 HTML（含所有 DOM 结构）
├── package.json            # Vite 依赖
├── CHANGELOG.md            # 版本更新日志（每次版本更新在顶部追加，倒序中文）
├── src/
│   ├── main.js             # 入口：触屏检测 + 事件绑定 + 难度选择
│   ├── game.js             # Game 类：主循环、resize()、状态机、相机
│   ├── engine.js           # Input 类（键盘+虚拟摇杆合并）、Camera 类
│   ├── entities.js         # Player、Enemy、EnemyManager（含 HP/伤害缩放/词缀/Boss技能）
│   ├── weapons.js          # WeaponSystem：6 神器攻击逻辑
│   ├── evolution.js        # 神器进化合成
│   ├── systems.js          # PickupSystem（宝石/宝箱/血瓶）、FXSystem
│   ├── upgrade.js          # 升级系统 + Reroll/Banish
│   ├── ui.js               # UIManager：HUD、Boss 血条、图鉴、警告
│   ├── mobile-controls.js  # 浮动摇杆（全屏触摸）+ 触屏暂停按钮
│   ├── data.js             # CONFIG、DIFFICULTIES、ENEMY_TYPES、BOSSES、AFFIXES、PASSIVES、WEAPONS
│   ├── assets.js           # 素材加载 + tintedEnemySprite（词缀着色共享）
│   └── style.css           # 全部样式（含 .touch-device/.portrait 响应式）
├── public/
│   ├── assets/             # 游戏图片素材（png）
│   ├── _redirects          # Cloudflare Pages SPA 回退
│   └── _headers            # Cloudflare Pages 头
├── docs/
│   ├── HANDOFF.md          # 本文档
│   ├── plans/              # 设计 GDD（终局平衡、平衡调校等）
│   └── superpowers/
│       ├── specs/          # 设计文档
│       └── plans/          # 实现计划
├── .workbuddy/memory/      # 项目工作记忆（每日日志 + MEMORY.md 长期备忘）
├── .trae/documents/        # PRD + 技术架构文档
├── test_game.py            # e2e 自动化测试脚本（Playwright）
└── gen_assets.py/sh        # 素材生成脚本（见下方红线）
```

### 素材管线红线（必读，踩过坑）
- **`gen_assets.py`**（程序化像素精灵，受管 venv 跑）：模块加载即全量生成，但 `save()` 内有 `AI_OWNED` 集合拦截，**永不覆盖那 15 张 AI 美术**；重跑安全（SKIP=15、字节一致）。
- **`gen_assets.sh`**（AI 文生图管线）：**⚠️ 绝不在仓库里跑**——历史上会 `rm -f *.png` 删光 `public/assets/` 全部 png。现已改为只删 AI 自有集，但仍**默认不用它**。
- **撞名 15 张**（两边都生成、线上以 AI 版为准）：`player/enemy_bat/skeleton/slime/elite/weapon_blade/holywater/axe/lightning/gem_small/medium/large/ground/bg_title/icon_skull`。
- 新增程序化图标：在 `gen_assets.py` 加生成函数、避开 `AI_OWNED`，用受管 venv 跑。

---

## 4. 核心架构

### 状态机（Game.state）
```
title → playing → paused（ESC/P/按钮/切后台自动触发）
                → upgrading（升级时暂停）
                → gameover（阵亡/超时）
                → victory（击杀永夜化身通关）
```

### 主循环（Game.frame）
- `playing`：accumulator 固定步长 step（`STEP=1/60`，dt 封顶 0.25s）+ render + ui.update
- `title/gameover/victory`：renderBackdropOnly（仅渲染背景蝙蝠粒子）
- `upgrading/paused`：仅 render（冻结 step）；`lastTs=0` 持续重置时间基准，恢复时 dt 从零起步
- **切后台**：`visibilitychange` 监听，`document.hidden && state==='playing'` 时自动 `togglePause()`

### 输入系统（engine.js Input 类）
- `keys` Set：键盘 WASD/方向键
- `virtualX/virtualY`：虚拟摇杆归一化向量
- `axis()`：合并键盘与虚拟输入，每轴取绝对值最大者
- `setVirtualInput(x, y)`：由 MobileControls 调用

### 渲染流程（Game.render）
1. 清屏 + 绘制地面 pattern
2. 应用相机变换
3. 绘制敌人 → 玩家 → 拾取物 → 武器特效 → FX
4. UI 由 DOM 层叠加（非 Canvas 绘制）

---

## 5. 移动端适配（当前重点）

### 浮动摇杆（借鉴 VS 手游）
- **设计**：手指按下哪里摇杆就在哪里出现，松手隐藏，不遮挡视野
- **实现**：`#touch-zone` 透明层覆盖全屏（z-index 11），pointerdown 时定位 `#joystick-base` 到按下点并显示
- **限幅**：joyRadius=50px，归一化向量写入 Input
- **文件**：[src/mobile-controls.js](file:///Users/a34481/Documents/Trae_game/src/mobile-controls.js)

### 触屏检测（关键修复历史）
- **必须在 `game.init()` 之前完成**（init 内部调用 resize，resize 依赖 .touch-device class）
- **多重检测**：`ontouchstart` || `maxTouchPoints > 0` || `pointer: coarse`
- **文件**：[src/main.js](file:///Users/a34481/Documents/Trae_game/src/main.js) 第 5-15 行

### 暂停恢复（双路径）
- 路径 1：右上角暂停按钮（z-index 50，高于 pause-overlay 的 40）
- 路径 2：暂停界面中央"继续"按钮（`#btn-resume`）
- 提示文案双版本：桌面"按 ESC 或 P 继续" / 移动"点击下方继续"
- **文件**：[index.html](file:///Users/a34481/Documents/Trae_game/index.html) 第 100-106 行、[src/style.css](file:///Users/a34481/Documents/Trae_game/src/style.css) 第 321-339 行

### 首页说明（双版本）
- 桌面：`WASD / 方向键` 移动
- 移动：`触屏拖动` 移动
- 基于 `.desktop-only` / `.touch-only` class + `.touch-device` 切换
- 「玩法说明」弹层（`index.html` #guide-screen）已于 v0.26 对接现状：12 分钟终局 / 9 分钟入夜 / Boss 3·6·9·12′、7 武器 / 9 被动 / 9 神器进化 / 6 血裔 / 灵魂祭坛 / 词缀怪；标题栏新增「Boss 宝箱→进化神器」提示。改动指南须同步此处。

### 竖屏布局（.portrait class，v0.24 起锁竖屏）
- HUD 顶部元素垂直排列
- 装备栏改纵向、避开左下
- Boss 血条下移到 130px
- **判定（v0.24 起）**：触屏设备一律竖屏（`resize()` 中 `isPortrait = isTouchDevice`，去掉旧的高宽比 `innerHeight > innerWidth*1.2` 判定）；横持时仍按竖屏 540×[960~1400] 渲染、等比缩放居中留黑边。**手机端不再支持横屏。**

---

## 6. 开发工作流

### 本地运行
```bash
cd /Users/a34481/Documents/Trae_game
npm run dev
# 访问 http://localhost:5173（受管 node v22.22.2，无需 nvm）
# 调试模式：http://localhost:5173/?debug（暴露 window.__game 等钩子）
```

### e2e 测试（需 dev server 在跑）
```bash
/Users/a34481/.workbuddy/binaries/python/envs/default/bin/python test_game.py
# Playwright 驱动，模拟完整流程；含「控制台无报错」硬门控
```

### 部署流程
```bash
git add <files>
git commit -m "单行中文描述"   # commit message 用单行更稳（多行 -m 曾静默失败）
git push origin main
# 1-2 分钟后 Cloudflare Pages 自动部署
```
- **推送姿势**：优先直连 `git push`；沙箱网络偶发 502/CONNECT tunnel 失败时，改走 **GitHub 连接器**（`mcp__github__push_files`）或请用户本机推。直连成功则以直连为准。

### Cloudflare Pages 配置
- Framework preset: Vite
- Build command: `npm run build`
- Build output directory: `dist`
- Deploy command: 留空
- **注意**：必须用 Pages（不是 Workers），可能误识别为 VitePress 需手动纠正

### 微信缓存问题
微信 WebView 缓存严重，普通刷新无效。解决方法：
1. 加参数访问：`https://night-survivors.pages.dev/?v=2`（绕过缓存）
2. 微信 → 设置 → 通用 → 存储空间 → 清理缓存
3. 换 Safari/Chrome 验证

---

## 7. 难度系统（src/data.js DIFFICULTIES，v0.21 数值收敛后）

| 难度 | ID | HP 斜率 | 伤害斜率 | 小怪刷新 | Boss 间隔 | 永夜基数 | Boss HP | Boss 技能 CD |
|------|----|---------|----------|----------|-----------|----------|---------|--------------|
| 夜行者 | easy | +18%/min | +10%/min | ×0.55 | ×1.5 | 1.12 | ×0.7 | ×1.3 |
| 狩猎者 | normal | +26%/min | +14%/min | ×0.70 | ×1.0 | 1.22 | ×1.0 | ×1.0 |
| 永夜 | hard | +38%/min | +18%/min | ×0.85 | ×0.85 | 1.32 | ×1.4 | ×0.75 |

- 敌人 HP/伤害斜率与永夜指数缩放在 [src/entities.js](file:///Users/a34481/Documents/Trae_game/src/entities.js) `statScale()`
- 三难度机制结构一致，仅数值区分（`nightBase/artifactCounter/bossHpMul/affixMul/packMin-Max/expMul/soulMul/bossSkillCdMul`）
- Boss 战时小怪刷新量按 `bossCalm` 系数减少
- 升级必回满血；大量数值仍标 `[PLACEHOLDER]` 待真机校准

---

## 8. 升级系统（src/upgrade.js）

### 升级选项池
- 武器（6 件神器，初始解锁）
- 被动（4 个无限成长被动 + 有限被动）
  - 战斗狂热：+3% 伤害（无限）
  - 极速猎手：+3% 移速（无限）
  - 财富之魂：+8% 经验（无限）
  - 钢铁意志：-2% 受伤（无限）

### Reroll / Banish
- 每局各 3 次
- Reroll：重新随机三个选项
- Banish：移除当前选项中的一个，从本局池中永久移除

---

## 9. 神器进化（src/evolution.js）

6 件神器两两可合成进化：
- 暗夜之刃 + 疾风之刃 → 血色旋风
- 神圣之水 + 风暴之锤 → 圣洁吞噬
- 雷霆之矛 + 旋风之斧 → 风暴使者
- 等等（详见 evolution.js 的 recipe 表）

图鉴界面（`#codex-screen`）显示解锁状态。

---

## 10. 测试

### 自动化测试（e2e，Playwright）
```bash
# 先确保 dev server 在跑（npm run dev），再：
/Users/a34481/.workbuddy/binaries/python/envs/default/bin/python test_game.py
```
- 模拟完整游戏流程：升级、神器进化、Boss 战、宝箱掉落、图鉴、灵魂结算、词缀渲染、宝石过期等
- **130+ 断言**，含「控制台无报错」硬门控（v0.23 起，防止渲染崩溃带病通过）
- 已知 flaky：`65%血 召唤蝙蝠` 偶发（Boss 血瞬置 0.65 后 600ms 内可能被打下阶段带），复跑可过；`TOTAL FAILURES` 计数偶发误报

### 浏览器手动测试
- 桌面：WASD 移动，ESC/P 暂停
- 移动端：真机访问线上地址（锁竖屏，横持留黑边）
- 关键验证点：竖屏铺满、浮动摇杆在按下位置出现、暂停/恢复、切后台自动暂停、狼群怪金圈、Boss 弹幕分三波

---

## 11. 最近 commit 历史（最新在前）

```
ea4d947 狼群词缀去灰(琥珀金+脉冲圈)；宝石20s过期+平方距离；Boss弹幕三波错峰0.35s
1f79014 切后台自动暂停+手机锁竖屏；渲染/瞄准/弹幕/HUD 热路径等价优化
788da63 修复白闪常驻满白致小怪发白；词缀怪着色显形+图鉴同步换色
425ed2b 图鉴图标/词缀着色/头像时间修复 + Boss 技能CD下调与弹幕三波 + e2e加固
c34bed0 真机数值收敛：后期墙下调 + 超时失败修复
2614b85 fix: 胜利结算弹窗背景遮罩+按钮关闭；e2e 回归覆盖；图鉴测试清理
6618d2c feat: v0.19 数值校准+12min终局+15min超时失败+Boss技能循环+怪物Boss形象重绘
```

完整版本变更见 [CHANGELOG.md](file:///Users/a34481/Documents/Trae_game/CHANGELOG.md)。

---

## 12. 已知问题 & 待验证

### 待用户验证（最新部署后）
- [ ] 微信内打开 `https://night-survivors.pages.dev/?v=4` 确认：
  - 竖屏铺满、横持留黑边（锁竖屏生效）
  - 切后台自动进暂停，回来点继续不被快进偷袭
  - 狼群怪显琥珀金圈（不再灰）
  - Boss 弹幕明显分三波
  - 后期宝石 20s 自动消失、不卡帧

### 待修复 backlog（已定位，未动）
- 圣光矩阵（matrix）觉醒无专属特效（与普通 cross 视觉雷同）
- 手机/电脑「血之飞刃」自动瞄准差异（锁定半径/生成环/DPR），锁竖屏后按竖屏定参即可
- 审查第二批：命中特效全局节流、enemyProjectiles/gems 数量上限、buildGrid 每帧新建 Map
- e2e 两处加固（见 §10）

### 已知坑点
1. **微信 WebView**：
   - 不支持 `pointer: coarse` 媒体查询 → 已用 JS 检测 + class 替代
   - 缓存严重 → 需 `?v=N` 参数强制刷新
2. **触屏检测时序**：必须在 `game.init()` 之前添加 `.touch-device` class（否则 resize 走横屏分支）
3. **素材管线**：`gen_assets.sh` 默认不用（曾 `rm -f *.png`）；新图标用受管 venv 跑 `gen_assets.py` 且避开 `AI_OWNED`（见 §3 红线）
4. **Cloudflare Pages**：可能误识别为 VitePress，需手动设置 Build command 和 output directory
5. **沙箱推送**：直连 `git push` 偶发 502/CONNECT tunnel；失败时走 GitHub 连接器或请用户本机推

---

## 13. 用户偏好

- **沟通语言**：简体中文（代码注释、UI 文案、commit message 均中文）
- **工作流**：修改前需明确方案确认，修改后需 commit + push 部署
- **不主动创建文档**：除非用户明确要求（如本 handoff 文档）
- **Skill 相关**：修改 skill 内容需先获许可；skill 相关脚本放对应 skill 的 scripts 文件夹

---

## 14. 相关文档

- [PRD-夜裔幸存者.md](file:///Users/a34481/Documents/Trae_game/.trae/documents/PRD-夜裔幸存者.md)
- [技术架构-夜裔幸存者.md](file:///Users/a34481/Documents/Trae_game/.trae/documents/技术架构-夜裔幸存者.md)
- [手机端适配设计](file:///Users/a34481/Documents/Trae_game/docs/superpowers/specs/2026-07-22-mobile-adaptation-design.md)
- [竖屏适配设计](file:///Users/a34481/Documents/Trae_game/docs/superpowers/specs/2026-07-22-portrait-adaptation-design.md)
- [手机端适配实现计划](file:///Users/a34481/Documents/Trae_game/docs/superpowers/plans/2026-07-22-mobile-adaptation.md)

---

## 15. 快速上手建议

新窗口接手后：
1. 先读本 handoff 文档了解全局
2. 如需改代码，先读对应文件再改（遵循"不读不改"原则）
3. 移动端相关改动注意触屏检测时序（init 之前）
4. 部署后提醒用户用 `?v=N` 强制刷新微信缓存
5. 复杂改动考虑用 superpowers 工作流（brainstorming → writing-plans → subagent-driven-development）
