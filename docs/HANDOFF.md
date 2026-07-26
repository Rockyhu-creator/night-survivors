# 夜裔幸存者 · 项目 Handoff 文档

> 供新会话窗口快速接手项目的上下文文档。最后更新：2026-07-26（v1.0 大版本S档上线后）

---

## 0. ✅ 大版本 S 档（属性面板 + 被动扩展）——v1.0 已开发完成并推送

**线上现状**：v1.0（`<HASH>`）已推送上线，在 v0.39 基础上落地 S 档全部内容。v0.39 修复了圣光矩阵 shadowBlur 卡顿与宝箱指引 dpr 缩放。

**大版本状态**：**已开发完成**。用户确认「根据方案进入开发」后，按主方案 v1.1 的 D1~D5 决议落地 9 项任务（属性面板 + 6 新被动 + 同类合并 + 分类权重 + 暴击接入 + 护盾条 + CSS 徽标）；e2e 全量回归 ALL PASS（零控制台报错）。

**版本号规范（用户 2026-07-26 指定）**：S 档为**首个大版本 v1.0**；今后「大版本」（多系统/机制跃迁）跳主版本号 **1.0 → 2.0 → 3.0…**；大版本内小补丁/热修用次版本号 **x.1 / x.2…**（如 1.1、1.2）。每次发版同步 CHANGELOG + HANDOFF（含 §11 commit 历史）。

**方案文档**：
- 主方案：`docs/plans/2026-07-26-major-update-design.md`（**v1.1，以此为准**）
- 工程 GDD：`docs/plans/2026-07-26-s-tier-gdd.md`（**已同步 v1.1，D1~D5 决议落地**）

**已落地决策（D1~D5）**：
- **D1** 局内挑战任务移出 S 档（降 M 档，未在 S 档实现）。
- **D2** 暴击按默认值落地：`critChance +5%/级`（基础 0.05，硬上限 0.75）、`critMul +15%/级`（基础 1.5）。`player.rollCrit()` 在 `weapons.js hitEnemy` 接入，DOT 每 tick 独立 roll；暴击飘字金字放大 +「暴击 」前缀（14/帧节流）。
- **D3** 被动分类权重（`buildPool` 内 `w = 1 + 0.6·catCount[category]`）+ 同类被动合并：删 `swift`/`rage`，`boots` 吸并移速（+6%/级·ML99）、`tome` 吸并全伤（+8%/级·ML99）。保底：**池中有武器时优先武器**（保证每层可拿武器），无武器可给时才退化为进攻向被动（防"三张全生存向"卡 build）。
- **D4** 护盾条：`#shield-bar` 置于 HP 条下方独立灰底（`#2a2a33`）细条，蓝色盾量段；受击后 `shieldRegen` 暂停 3s（见 `entities.js` 护盾恢复）。
- **D5** 被动/属性 icon 全程序化 CSS 徽标（`PASSIVE_BADGE_SYMBOL` + `.passive-badge` + `.stat-*` `--ic`），**零新 PNG**，未碰 AI_OWNED 15 张，未跑 `gen_assets.sh`。

**S 档最终范围（已交付）**：① 9 属性机制（critChance/critMul/shield+maxShield/shieldRegen/armor/dodgeChance 六字段；承伤顺序：闪避→防御 `max(1,(raw-armor)×damageTakenMul)`→护盾→扣血）② 6 新被动（致命专注/毁灭之刃/幽能屏障/灵能回响/暗夜铠甲/魅影身法，均 ML5）③ 同类被动合并 + 分类权重 ④ 属性面板 UI（`#stats-panel`：暂停内嵌 + 结算屏，Tab/C 切换）⑤ 护盾灰色细条。**未做（留 M 档）**：局内任务、新武器/神器、新怪词缀。

**被动总数**：13（boots/heart/tome/magnet/greed/guard/regen + critrate/critdmg/shield/shieldregen/armor/dodge）。图鉴卡片总数 31（8 武器 + 13 被动 + 10 神器）。

**其他注意**：`gen_assets.py` 仍含 `gen_passive_rage/swift` 生成器（产物 `passive_rage.png`/`passive_swift.png` 已无引用，属死代码）；`assets.js` 已移除这两项孤儿引用（A8 清理）。

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
- 词缀系统：`volatile`（死亡爆破·亮黄冲击波·虚线描边+淡填充·`blastRadius=140`）/ `shielded`（减伤·蓝·盾牌徽标）/ `pack`（成群·琥珀金·三点徽标）；**本体不染色**，属性用彩色脉冲光环 + 头顶徽标表达（共享 `drawAffixBadge`）；爆破死亡时先 `pickups.drop(expValue)` 掉落经验宝石，再播放范围冲击波特效；经验宝石带 0.35s 出生金色闪光，降低被特效遮挡的误读。

---

### 战利品指引与掉落特判（v0.35）

- **宝箱指示箭头 PNG 精灵**：`#loot-arrow` 为 `<img>` 引用 `loot_arrow.png`（32×32 金箭头带尾翼，默认朝右），`ui.js` 的 `updateLootBeacon()` 按 `Math.atan2(dy,dx)` 算角度并 `transform: rotate(angle)` 定位（屏外/贴边指向最近宝箱）；`style.css` 去 border 三角、改 `width/height:32px` + `drop-shadow` 辉光 + `image-rendering:pixelated`。
- **宝箱指示圆环动态半径（修复 #195，v0.39 修正 dpr 缩放）**：`#loot-ring` 直径由 JS 在 `onX&&onY` 分支内按 `chestSize(普通40/boss48) × CSS缩放 sx × 1.4` 动态设（系数 > pulse 峰值 1.12），放大屏与 boss 宝箱任意呼吸相位都圈住；`style.css` 已去固定 `width/height:52px`、加 `box-sizing:border-box`。**注意 `sx/sy` 必须 `rect.width/height ÷ CONFIG.LOGICAL_WIDTH/HEIGHT`（世界=逻辑像素），绝不能 `÷ canvas.width/height`（含 dpr 倍）——否则高分屏(dpr=2)环/箭头整体缩到一半位置、圈不住宝箱（v0.39 已修）**。
- **掉落特判（修复 #196）**：`PickupSystem.drop(x,y,expValue,enemyType)` 新增第 4 参；石像鬼（`ENEMY_TYPES.gargoyle`）强制掉金宝石（`GEM_DEFS[3]`，价值 25）、暗影猎手（`ENEMY_TYPES.shadow_hunter`）强制掉红宝石（`GEM_DEFS[4]`，价值 50）；其余怪维持原 `expValue` 选档逻辑零改动，100% 掉落不变。`onEnemyKilled` 调用处补传 `enemy.type`（def 对象，非字符串 key）。

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
- **Canvas DPR 去虚（v0.26+）**：`canvas.width/height = LOGICAL * min(devicePixelRatio,2)`，`ctx.setTransform(dpr,0,0,dpr,0,0)`，CSS 尺寸保持逻辑像素→高 DPI 屏（尤其手机）锐利不发虚；DPR 封顶 2x 防 3x 手机内存爆炸。**副作用**：DOM 覆盖层（如 loot beacon）用 canvas 坐标映射 CSS 须 `÷ CONFIG.LOGICAL_*`（逻辑像素），不可 `÷ canvas.width`（含 dpr），否则位置/尺寸缩半（v0.39 已修 loot beacon 圈不住/箭头偏位）。
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
│   ├── assets.js           # 素材加载 + drawAffixBadge（词缀头顶徽标，游戏内/图鉴共用）；tintedEnemySprite 已弃用
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
- 新增程序化图标：在 `gen_assets.py` 加生成函数、避开 `AI_OWNED`，用受管 venv 跑。例：v0.34 用 `gen_gem()` 补齐 `gem_gold.png`/`gem_red.png`（金/红高价值宝石精灵），`assets.js` 补 `gemGold`/`gemRed` 映射；重跑经验证仅新增两张、其余 73 张字节一致。

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
- 「玩法说明」弹层（`index.html` #guide-screen）已于 v0.26 对接现状：12 分钟终局 / 9 分钟入夜 / Boss 3·6·9·12′、8 武器 / 13 被动 / 10 神器进化 / 6 血裔 / 灵魂祭坛 / 词缀怪；标题栏新增「Boss 宝箱→进化神器」提示。改动指南须同步此处。

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

### 微信缓存问题（v0.28 已从源头治理）
**根因**（历史）：`public/_headers` 曾用 `/*  Cache-Control: public, max-age=31536000, immutable` 一刀切，把 `index.html` 与固定名 `/assets/*.png` 也设成「缓存一年、永不校验」，导致改了代码/美术微信永远看旧版。

**治本方案（v0.28 起，`public/_headers` 按类型分策略）**：
- `/` 与 `/index.html`：`no-store`（v0.29 起，原为 `no-cache`）—— 入口完全不存储、每次打开拉最新，能立刻拿到最新带 hash 的 JS/CSS 引用（代码/玩法更新即时生效）。用 `no-store` 是因微信 X5 内核偶有无视 `no-cache` 启发式喂旧缓存的 bug，`no-store` 禁存信号更强。
- `/assets/*.js`、`/assets/*.css`、`/fonts/*`：`max-age=31536000, immutable` —— Vite 产物文件名带内容 hash，内容变文件名变，可安全永久缓存。
- `/assets/*.png`（游戏美术，固定文件名）：`max-age=31536000, immutable`（v0.30 起，原为 `must-revalidate`）。配合**构建版本号击穿**——`vite.config.js` 的 `define` 在构建时注入 `BUILD_ID`（= Cloudflare Pages 的 `CF_PAGES_COMMIT_SHA`，本地 fallback `Date.now()`），所有 PNG 请求自动附 `?v=BUILD_ID`；每次发版 commit 变化 → URL 变化 → 旧图缓存自动失效，因此可安全永久缓存。仅 `assets.js` 主加载与 `ui.js` 血裔按钮图标两处裸拼接加版本号（图鉴/升级/祭坛图标经 `sprite().src` 间接继承，不用改）。
- ⚠️ **CF Pages 坑**：多规则命中同一文件时同名 header 会「逗号拼接」（非覆盖），因此**禁止再用 `/*` 兜底 Cache-Control**，全部写成互不重叠的按扩展名规则。
- ⚠️ **dev server 必须先重启才能吃新 config**：`vite.config.js` 是 vite **启动时**读取的，运行中新建/修改不会热加载。改完 config 必须重启 dev server（否则 dev 模式下 `__BUILD_ID__` 不被替换、浏览器报 `ReferenceError` 使游戏崩溃）。生产 `vite build` 不受影响（构建时必读 config）。

**用户存档与缓存的关系（重要，勿混淆）**：全部进度存于 `localStorage`（`ns_best`/`ns_souls`/`ns_collection`/`ns_audio`/`ns_guide_seen`），与 HTTP 缓存是**两套独立存储**。上述所有缓存治理/清缓存操作（含微信清缓存、debugx5 清内核、`?v=` 绕过）**只影响 HTTP 缓存，绝不动 `localStorage`**，存档 100% 安全。唯一会清存档的是「清除网站数据/清除全部数据」，任何缓存方案都不应涉及它。

**覆盖完整性（v0.29 核对）**：`public/` 仅 73 张 PNG（全在 `/assets/`）+ 1 个 woff2（`/fonts/`）+ `_headers`/`_redirects` 特殊文件，全部命中规则、无漏网类型。`_redirects` 为 SPA 回退 `/* /index.html 200`，故所有路由都走 index.html、受 HTML `no-store` 覆盖。

**已卡旧版设备的应急清缓存**（治本部署后仍需清一次历史脏缓存）：
1. 加随机参数访问：`https://night-survivors.pages.dev/?v=时间戳`（改 URL 必定绕过缓存）
2. 微信 → 我 → 设置 → 通用 → 存储空间 → 清理缓存
3. 微信内打开 `http://debugx5.qq.com` → 进 X5 内核调试页清内核缓存
4. 换 Safari/Chrome 验证

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
- 武器（8 件，初始解锁）
- 神器（10 件，两两合成进化解锁）
- 被动（13 个，按 category 分类权重；同类合并后删 `swift`/`rage`）
  - 无限成长（maxLevel 99）：`boots` 疾行之靴 +6% 移速（utility，吸并 swift）/`tome` 秘法魔典 +8% 全伤（offense，吸并 rage）/`greed` 财富之魂 +8% 经验（utility）/`guard` 钢铁意志 -2% 受伤（survival）
  - 有限（maxLevel 5）：`heart` 巨人之心 +20 HP（survival）/`magnet` 引力宝珠 +25% 拾取（utility）/`regen` 血色再生 +0.8 HP/s（survival）/`critrate` 致命专注 +5% 暴击率（offense）/`critdmg` 毁灭之刃 +15% 暴击伤害（offense）/`shield` 幽能屏障 +20 护盾（survival）/`shieldregen` 灵能回响 +1.5 护盾/s（survival）/`armor` 暗夜铠甲 +2 防御（survival）/`dodge` 魅影身法 +4% 闪避（survival）
- 分类权重（D3，`buildPool`）：候选被动权重 `w = 1 + 0.6·catCount[category]`（catCount=玩家已投该分类被动等级和）；保底优先武器，无武器可给时退化为进攻向被动（offense）。

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

> **武器特效 / tint 链路（v0.36）**：各神器觉醒武器的专属视觉差异目前集中在渲染层 tint。永劫之鞭（eternalwhip）在 `src/weapons.js` 顶部定义 `ETERNALWHIP_TINT`（熔金黑鞭配色：body #ffb847 / edge #4a2f12 / tip #fff1c9），经 `applyWhip` 第 5 参透传至 slash，render 描边与尖端高光改 tint 感知；基础鞭不传 tint 走原粉色。其余神器（storm/devour/spiral/stormcall/crimson/tempest/sepulcher/matrix）的专属特效沿用各自既有渲染分支。规格扩展项（残影光晕 / 命中火花 / 主题伤害数字）已于 v0.38 实现：additive 残影光晕（`sl.tint.trail` #d4af37）+ 命中金色火花（`spawnSparks` 6×`spark`+3×`sparkHot`）+ 鎏金主题伤害数字（`tint.dmg` #e0a93b），均 gate 在 `sl.tint` 存在性上，基础鞭零变化。

> **第 10 神器：亡魂收割者 Reaper's Scythe（v0.37）**：新增 scythe 武器（亡魂镰刀，回旋镰刀投射物=大范围回旋镰斩）+ reaper 神器（由 scythe 武器 + 贪婪之魂 被动进化，配方见 `RECIPES`）。觉醒后 scythe 攻击追加：① 撕裂 DOT（`entities.js` 敌人身上的 `rend` 字段，每帧按 `dps*dt` 结算）② 收割回能（被 scythe/rend 击杀且持有 reaper 时归还少量 HP）。两项觉醒效果均门控 `hasArtifact('reaper')`，基础 scythe 不受影响。骨白 #e8e0c0 + 幽魂绿 #7fff9f 专属配色（`weapon_scythe.png` / `art_reaper.png`）。数值（镰刀数量 / 伤害 / rend dps / 回血量）标 `[PLACEHOLDER]` 待真机校准。

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
b2785fb docs: 回填 v0.39 commit 哈希 a8828af
a8828af fix: 圣光矩阵shadowBlur卡顿改缓存辉光 + 宝箱指引DPR缩放修正圈不住/箭头偏位 (v0.39)
55cd381 art: 大版本S档 16张AI像素icon生成脚本(gen_icons.sh)；文生图服务降级暂无法出图，待恢复复跑
d6cd3bd docs: v0.38 CHANGELOG + HANDOFF 同步（eternalwhip 扩展特效，哈希 a9435b8）
a9435b8 feat: eternalwhip 扩展特效 残影光晕+命中火花+主题伤害数字（向前兼容基础鞭）
4c4cbcf docs: v0.37 CHANGELOG + HANDOFF + 指南文案同步（亡魂收割者，哈希 71cbf72）
71cbf72 feat: 第10神器 亡魂收割者 scythe 武器+reaper 进化(回旋镰斩/撕裂DOT/收割回能)
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
- [大版本主方案 v1.1（当前进行中，见 §0）](file:///Users/a34481/Documents/Trae_game/docs/plans/2026-07-26-major-update-design.md)
- [S 档工程 GDD v1.1（D1~D5 已同步）](file:///Users/a34481/Documents/Trae_game/docs/plans/2026-07-26-s-tier-gdd.md)

---

## 15. 快速上手建议

新窗口接手后：
1. 先读本 handoff 文档了解全局
2. 如需改代码，先读对应文件再改（遵循"不读不改"原则）
3. 移动端相关改动注意触屏检测时序（init 之前）
4. 部署后提醒用户用 `?v=N` 强制刷新微信缓存
5. 复杂改动考虑用 superpowers 工作流（brainstorming → writing-plans → subagent-driven-development）

---

## 16. 运行时版本自检（v0.31+）

用户输入「改了代码微信看不到」类问题的运行时兜底：页面启动即比对「当前运行构建号」与「线上最新构建号」，有新版本时顶部滑入横幅提示刷新（非阻断，不自动强刷）。

### 机制
- **version.json 生成**：`vite.config.js` 新增 `emitVersionJson()` 插件（`apply:'build'`，`writeBundle` 钩子），把 `{ buildId, commit, builtAt }` 写入 `dist/version.json`。`buildId` 复用模块级变量，与 `__BUILD_ID__`（define 注入）同源，杜绝比对错位。dev 下插件不运行 → 无 version.json（fetch 自然 404 → 静默跳过）。
- **boot 比对**：`src/version-check.js` 的 `initVersionCheck()` 在 `game.init()` 之前 fire-and-forget 调用。fetch 使用**带戳 URL** `fetch('/version.json?t=' + Date.now(), {cache:'no-store'})` 比对 `window.__BUILD_ID__`（= `__BUILD_ID__`）与 `latest.buildId`；不一致时 `document.dispatchEvent(new CustomEvent('version-mismatch', {detail:{current,latest,builtAt}}))` 并写 `window.__versionInfo={buildId,commit,builtAt,hasUpdate}`。离线 / 404(dev) / JSON 异常 → 静默跳过，不影响启动，**不读写 localStorage**。
- **微信 X5 缓存击穿（v0.33 关键修复）**：微信内置 X5 内核**无视 `Cache-Control: no-store`**，按「完整 URL 命中」的应用级缓存回旧文件，导致 `fetch('/version.json')` 拿到与旧 HTML 内联 `__BUILD_ID__` 同源的陈旧 version.json → `hasUpdate=false` → 不弹横幅（用户需手动右上角刷新才更新）。修复 = 给 version.json 的 fetch URL 加唯一时间戳 query（`?t=Date.now()`），X5 缓存按完整 URL 键控、带戳即每次必走网络 → 拿到最新 version.json → 正确触发 mismatch 横幅。这是微信缓存的业界标准兜底。
- **周期复检（v0.33 增强）**：`initVersionCheck` 内 `setInterval` 每 90s 再发起一次带戳自检，使**长开页面**的玩家在后台发版后也能被提示，不依赖「下次打开」。90s 足够稀疏、对 version.json 无感知压力。
- **_headers 增量**：`public/_headers` 显式声明 `/version.json  Cache-Control: no-store`（CF 精确匹配，根路径 `/` 的 no-store 不覆盖它）。
- **UI 组件**（美术规格 `docs/art/update-ux-spec.md` 落地，工程不另起炉灶）：
  - `#update-prompt`：顶部滑入横幅（z45），`pointer-events:none` 仅 `.up-inner` 可点；主按钮 `.gothic-btn.is-ember`（ember `#f1c40f`），次按钮 `.gothic-btn.ghost`。
  - `#loading` + `#load-bar`：首屏加载幕（z100，`bg_title.png` 暗化背景），进度条由 `game.js` 的 `loadAssets(onProgress)` 钩子驱动（width + `#load-pct` + `aria-valuenow`），加载完成 `hidden` 移除。
- **sessionStorage 记忆**：点「稍后」写 `sessionStorage['ns_update_dismiss']=latest`（针对该 latest 版本），命中则本次不再弹；新部署产生新 latest → 仍会提示。仅在同会话、同 latest 下抑制，**不污染 localStorage**。
- **刷新入口**：`data-action="reload"` → `location.reload(true)`。

### ⚠️ dev server 重启坑（必读）
`vite.config.js` 是 vite **启动时**读取的，运行中改动（本次加插件）**不热加载**。改完必须杀旧 dev server（`lsof -ti tcp:5173 | xargs kill -9`）并重启 `npm run dev`，否则旧 dev server 不识别新插件/define，`__BUILD_ID__` 运行时 ReferenceError → e2e 崩溃。生产 `vite build` 不受影响（构建时必读 config）。

### 验证命令
- dev 跑 e2e：先重启 dev server 再 `python test_game.py`。
- 验证 version.json 生成：`npm run build` 后 `cat dist/version.json`、`grep '/version.json' dist/_headers`。
