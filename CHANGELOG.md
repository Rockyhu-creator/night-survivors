# 夜裔幸存者 · 版本更新日志

> 本文档专门用于版本管理。**每当发生版本更新时，在此记录当前版本的功能变更记录，统一使用中文书写。**
> 格式约定：按版本倒序排列（最新在最上），每个版本标注日期与 commit 哈希，下设「新增 / 调整 / 修复 / 优化」分类条目。

---

## v0.31（2026-07-25 · `[HASH]`）

### 新增
- **运行时版本自检（version.json + boot 比对 + 横幅/进度条 UI）**：`vite.config.js` 新增 `emitVersionJson()` 插件（`writeBundle` 钩子），把 `{ buildId, commit, builtAt }` 写入 `dist/version.json`；`buildId` 复用模块级变量，与 `__BUILD_ID__`（define 注入）同源，杜绝比对错位。
- **新增 `src/version-check.js`**：`game.init()` 之前 fire-and-forget 发起 `fetch('/version.json', {cache:'no-store'})` 比对 `__BUILD_ID__`；不一致时派发 `version-mismatch` 事件并写 `window.__versionInfo={buildId,commit,builtAt,hasUpdate}`；离线 / 404(dev) / JSON 异常全静默跳过，绝不影响启动；**不读写 localStorage**。
- **顶部滑入更新横幅 `#update-prompt`**（z45、非阻断、`pointer-events:none` 仅本体可点）+ **首屏加载幕 `#loading`**（z100，`bg_title.png` 暗化背景）+ **`#load-bar` 进度条**（ember 渐变、金描边，由 `loadAssets(onProgress)` 钩子驱动）；严格按 `docs/art/update-ux-spec.md` 美术规格落地，零新色零新字体。
- **横幅按钮**：稍后（`sessionStorage` 记忆 `ns_update_dismiss`，针对该 latest 版本，本次会话不重复弹）/ 立即刷新（`location.reload(true)`）；主按钮 ember 修饰 `.gothic-btn.is-ember`（`#f1c40f`）。

### 调整
- **`public/_headers`**：显式补 `/version.json → Cache-Control: no-store`（根路径 `/` 的 no-store 不覆盖它，CF 精确匹配需单独声明）。
- **顺带补 `.gothic-btn:focus-visible` 金环**（消除既有缺口，对齐 `.top-back`）。

### 优化
- 首屏新增加载进度条，告别「纯色空屏」，弱网/低端机加载体验更明确。

### 说明
- dev 下 `version.json` 由 build 插件生成、dev 不写（fetch 自然 404 → 静默跳过）；`vite.config.js` 改动需重启 dev server 才生效（否则运行时 `__BUILD_ID__` 不被替换 → e2e 崩溃）。
- 用户存档仍存 `localStorage`，本机制零读写，100% 安全。

### 测试
- e2e 加固：新增 `__BUILD_ID__` 注入、`#update-prompt`/`#load-bar` 元素存在、`/version.json` 请求不报错（dev 404 静默跳过）断言；全量回归 ALL PASS（零控制台错误）。

---

## v0.30（2026-07-25 · `b552a9a`）

### 新增
- **美术图 URL 缓存击穿**：构建时由 `vite.config.js` 的 `define` 注入 `BUILD_ID`（Cloudflare Pages 自动注入 `CF_PAGES_COMMIT_SHA`，本地 fallback `Date.now()`），所有 PNG 请求自动附 `?v=BUILD_ID`。每次发版 commit 变化 → URL 变化 → 旧图缓存自动失效，无需手动清缓存。
- 新建 `vite.config.js`，仅注入 `__BUILD_ID__` 这个构建常量，不改 Vite 其他默认行为。

### 调整
- **`_headers`**：`/assets/*.png` 由 `max-age=0, must-revalidate`（每次 ETag 校验）改为 `public, max-age=31536000, immutable`（永久缓存）。依赖上方 URL 版本号击穿来区分版本，换图即时生效。

### 优化
- 重复访问时美术图（约 50 张 PNG）首屏加载后**零请求**，消除启动时的 304 校验往返；弱网/低端机加载更顺。

### 说明
- 仅改 `assets.js` 主加载与 `ui.js` 血裔按钮图标两处裸拼接 URL（图鉴/升级/祭坛图标经 `sprite().src` 间接继承版本号，无需改动）；CSS 背景图（`bg_title.png`，固定 AI 美术）与 `upgrade.js` 兜底字符串属边缘且不变，保持原样。
- 用户存档仍存 `localStorage`，与本优化无关，100% 安全。

---

## v0.29（2026-07-25 · `39379a8`）

### 调整
- **HTML 缓存策略 `no-cache` → `no-store`**：入口 `/` 与 `/index.html` 由「每次校验」升级为「完全不存储」。针对微信 X5 内核偶有「无视 `no-cache`、启发式直接喂旧缓存」的 bug，`no-store` 是更强的禁存信号，进一步压低旧 HTML 残留概率；HTML 仅几 KB，全量重下成本可忽略。hash 产物 `immutable`、PNG ETag 校验等其余策略不变。

### 说明
- **用户存档不受缓存策略影响**：全部进度存于 `localStorage`（`ns_best`/`ns_souls`/`ns_collection`/`ns_audio`/`ns_guide_seen`），与 HTTP 缓存是两套独立存储；清理/刷新缓存（含微信清缓存、debugx5 清内核）均不触碰 `localStorage`，存档安全。
- **已知边界**：缓存治理只对「新访问」生效，无法回捞「在 v0.28 前已被旧 `immutable` HTML 缓存污染」的设备——这类设备需手动清一次缓存（见 HANDOFF 应急三招）才能吃到新策略。

---

## v0.28（2026-07-25 · `dc379d3`）

### 修复
- **微信 WebView 顽固缓存（从源头治理）**：`public/_headers` 原为 `/*  max-age=31536000, immutable` 一刀切，把入口 `index.html` 与固定名美术 `/assets/*.png` 也设成「缓存一年、永不校验」，导致改了代码/换了贴图后微信永远显示旧版。改为**按文件类型分策略**：
  - `index.html`：`no-cache`（每次校验，即时拿到最新带 hash 的 JS/CSS 引用 → 代码/玩法更新立即生效）；
  - Vite 构建产物 `/assets/*.js|*.css`、`/fonts/*`：`max-age=31536000, immutable`（文件名带内容 hash，永久缓存安全）；
  - 游戏美术 `/assets/*.png`：`max-age=0, must-revalidate`（走 ETag，换图即时刷新、未改返回 304 零开销）。
  - 规避 CF Pages「同名 header 逗号拼接」坑：去掉 `/*` 兜底，全部改为互不重叠的按扩展名规则。

---

## v0.27（2026-07-25 · `b57c409`）

### 调整
- **词缀怪视觉统一（方案①）**：移除 `entities.js` 对词缀怪的全身 `tintedEnemySprite` 染色（原橙/蓝/黄高饱和块导致画面杂乱），本体恢复自然色；属性改由「彩色脉冲光环 + 头顶徽标」表达——`assets.js` 新增共享 `drawAffixBadge`（爆破=星爆 / 护盾=盾牌 / 狼群=三点），游戏内与图鉴共用，画面统一且一眼可辨属性。

### 新增
- **爆破死亡爆炸特效**：`FXSystem` 新增 `rings` 冲击波环 + `spawnExplosion()`，爆破词缀怪死亡时无条件播放范围冲击波 + 火花（无论玩家是否在范围内），更直观警示危险。

### 修复
- **图鉴词缀块更新**：`ui.js` 怪物图鉴「特殊属性」分类由 2 条扩为 3 条（爆破/护盾/狼群），缩略图改为自然精灵 + 彩色光环 + 头顶徽标（离屏 canvas 生成，与游戏内一致），lore 补充爆炸特效说明。

### 测试
- e2e 新增：词缀卡 爆破/护盾/狼群 自然精灵+彩边断言、爆破死亡触发 `fx.rings` 爆炸特效断言；全量回归 ALL PASS（零控制台错误）。

---

## v0.26（2026-07-25 · `df88d39`）

### 新增
- **圣光矩阵觉醒专属特效**：`matrix` 神器投射物加 `matrix:true` 标记，渲染用更大金色圣印 + additive 辉光 + 运动拖尾，与黎明圣印（`kind:'cross'`）明显区分（纯观感，不影响数值/命中）。

### 修复
- **飞刃手机/电脑差异（跨设备一致）**：`pickTarget` 改为「屏内优先」——手机竖屏与桌面横屏都只锁当前可见的最近敌人，消除「手机打屏外、电脑打最近」的差异；`tempest` 雷劫索敌半径由固定 320 改统一 `TARGET_RADIUS=540`；敌人回收环由 `LOGICAL_WIDTH*1.6`（设备相关）改固定 `RECYCLE_RADIUS=900`，跨设备行为一致。

### 优化
- **Canvas DPR 去虚**：backing store 按 `min(devicePixelRatio,2)` 放大 + `ctx.setTransform(dpr,...)`，高 DPI 屏（尤其手机）画面锐利不再发虚；CSS 尺寸保持逻辑像素、等比居中。
- **命中特效节流（L2）**：`FXSystem` 每帧伤害数字 ≤14、粒子 ≤40（保留原有 120/300 硬上限），抑制 AoE 密集命中刷屏与数组抖动。
- **敌方弹幕数量上限（L3）**：Boss 弹幕超 `MAX_ENEMY_PROJECTILES=400` 时丢弃最旧弹幕，防极端堆量卡顿/崩溃。
- **宝石数量上限（L4）**：`PickupSystem.drop` 接近 `MAX_GEMS=500` 时把剩余经验合并成单颗红宝石，限制实体规模防掉帧且不丢经验。
- **buildGrid 复用（L5）**：每帧复用持久 `Map` 与桶数组（free-list），消除 `new Map()` + 大量小数组分配的 GC 压力。

### 文档
- **玩法说明对接现状**：`index.html` 指南重写——12 分钟终局 / 9 分钟入夜 / Boss 3·6·9·12′、7 武器 / 9 被动 / 9 神器进化 / 6 血裔 / 灵魂祭坛 / 词缀怪；标题栏新增「Boss 宝箱→进化神器」提示。

### 测试
- e2e 加固：65% 召唤蝙蝠 / 35% 扇形弹幕「重臂 Boss 技能运行时 + 等待窗口 600→1500ms」，消除偶发误报；全量回归 ALL PASS（零控制台错误）。

---

## v0.25（2026-07-25 · `ea4d947`）

### 修复
- **狼群怪灰化**：`pack` 词缀颜色由灰蓝 `#aab7c4` 改**琥珀金 `#f1c40f`**（原 `tintedEnemySprite` 整只染灰、且 pack 不画脉冲圈导致看起来像"灰色遮罩"）；脉冲圈分支纳入 pack（淡金慢闪 1.2Hz 椭圆圈）。
- **Boss 弹幕"还是一波"**：三波由"同帧同速从 Boss 中心射出、仅角度错开 18°"改为**时间错峰**——第 1 波立即发射，第 2/3 波各延迟 0.35s/0.70s 从 Boss **当前位置**射出（`e.pendingWaves` 队列 + update 倒计时，Boss 移动后波跟随），视觉压迫感递进、能清楚分辨三波。

### 优化
- **宝石防掉帧**：普通经验宝石加 `life: 20s` 过期自动消失（宝箱/血瓶永不消失，磁吸飞行中不过期，最后 5s 高频闪烁提示）；`PickupSystem.update` 距离判定改平方距离比较，仅磁吸中的少数宝石做 `sqrt` 归一化。

### 测试
- e2e 新增 4 条断言（狼群怪 `affixDef.color`=琥珀金、狼群渲染无报错、普通宝石 20s 过期消失、宝箱/血瓶不过期），断言总数 → 132，控制台零错误。

---

## v0.24（2026-07-25 · `1f79014`）

### 新增
- **切后台自动暂停**：注册 `visibilitychange`，`hidden` 且 `playing` 时自动进正式暂停界面；`paused/upgrading` 分支持续重置时间基准（`lastTs=0`），恢复时 dt 从零起步，杜绝切后台回来被"快进"偷袭。
- **手机端锁竖屏**：`resize()` 竖屏判定改为纯 `isTouchDevice`（去掉高宽比），横持时仍按竖屏 540×[960~1400] 渲染、等比缩放居中留黑边，不再切横屏布局。**手机端不再支持横屏**。

### 优化（全部为等价变换，画面/玩法零差异）
- 敌人渲染排序复用 `_renderScratch` 数组原地 sort，消除每帧 `[...enemies]` 全拷贝分配。
- `pickTarget` 全量排序改线性选第 k 近（平方距离 + scratch 池），结果与全排序等价。
- 敌方弹幕 `hypot` → 平方距离，一次计算供触碰 + 800 外清理两用。
- HUD 六项 + Boss 血条加值缓存（`_hudCache`/`_bossPct`），值变化才写 DOM。

---

## v0.23（2026-07-25 · `788da63`）

### 修复
- **小怪被渲染成白色（真 bug）**：根因=`damageEnemy` 每帧把 `e.flash=0.12` 硬重置，射程内小怪每帧挨打→白闪 `alpha≈0.96` 常驻满格糊白；同时词缀怪的橙/蓝着色也被这层白闪盖住（两现象同根因）。修复：敌人加 `flashCd` 冷却门控，仅 `flashCd<=0` 才点亮白闪（持续受击变 ~0.14s 一次的清晰脉冲）。
- **词缀怪颜色看不出/图鉴不同步**：`tintedEnemySprite` 迁到 `assets.js` 共享（单一来源），游戏内词缀怪橙/蓝显形；图鉴词缀卡渲染着色精灵（`data:image`）+ 彩色左边框，脉冲环配色统一到 `affixDef.color`。

### 测试
- e2e 把「控制台无报错」纳入硬断言（原仅 print，导致词缀怪 `const img` 崩溃能"带病通过"），新增 2 条词缀卡着色断言，断言总数 → 127。

---

## v0.22（2026-07-24 · `425ed2b`）

### 新增
- **首页「游戏图鉴」按钮独立图标**：新增程序化像素图标 `codex_menu.png`（摊开魔典 + 发光窥视之眼，scale 2，避开 `AI_OWNED`、不复用 `codex_book`），接入 `#btn-codex`。

### 调整
- **Boss 技能 CD 大幅下调 + 弹幕三波**：baron/queen/overlord/avatar 全体技能 CD 砍 30~50%（如 barrage cd9→5、dash cd9→5、enrage cd12→8/8→6），弹幕一次性 `waves:3`、弹速/伤害同步上调，Boss 威胁显著提升。
- **爆破史莱姆/护盾骷髅独立图鉴**：图鉴新增「词缀变种」分组，卡左边框着词缀色、专属 lore，与普通史莱姆/骷髅不重合。

### 修复
- **永夜化身图鉴出现时间描述错误**：`MONSTER_LORE.avatar` 改「存活至 12 分钟降临」；图鉴判定由失效的 `key==='avatar'`（BOSSES 数组遍历使 key 退化为 `'0'..'3'`）改 `t.id==='avatar'`。

---

## v0.21（2026-07-24 · `c34bed0`）

### 调整
- **真机数值收敛（后期墙下调）**：easy `nightBase` 1.22→1.12；normal `nightBase` 1.35→1.22、`dmgSlope` 0.15→0.14、`spawnMul` 0.80→0.70；hard `nightBase` 1.50→1.32、`dmgSlope` 0.22→0.18、`spawnMul` 1.05→0.85、`affixMul` 1.75→1.20、`packMin` 8→6、`packMax` 14→10（avatar HP 15000 / bossHpMul 不动）。

### 修复
- **超时失败判定笔误（真 bug）**：`game.js` step 末 `this.entities.bossSpawned` → `this.enemies.bossSpawned`（原写错对象导致 15 分钟硬上限超时失败永不触发）。

---

## v0.20（2026-07-24 · `2614b85`）

### 修复
- **胜利结算弹窗不可关闭**：补全屏背景遮罩 + 按钮关闭逻辑（`src/style.css` 遮罩样式 + `src/ui.js` 关闭路径）。

### 测试
- e2e 回归覆盖胜利结算弹窗；清理图鉴测试遗留状态。

---


### 新增
- **12 分钟降临终局 Boss + 15 分钟硬上限超时失败**：`ENDGAME_BOSS_TIME` 900→720（12min 永夜化身降临）；新增 `GAME_HARD_CAP=900`，`game.js` step 末判定——到点仍 `bossSpawned.has('avatar')` 且未击败则 `gameOver('timeout')`，区别于阵亡/胜利；`ui.js` 按 reason 切换「时限已尽 · 永夜吞没了你」文案与副标题。
- **Boss 技能「门槛+冷却」循环释放**：废弃原 `skillIndex` 单向一次性触发，改为每技能独立运行时状态 `{triggered, lastCast}`，首次按 `at` 阈值触发后进入阶段带循环（cooldown × `DIFFICULTIES.bossSkillCdMul`：easy1.3/normal1.0/hard0.75），`enrage` 标 `once` 防速度指数叠加。
- **怪物/Boss 形象重绘（脱离撞脸）**：`boss_avatar`（悬浮虚空神祇：星云裙裾+破碎虚空光环+纵向发光裂瞳+星尘翼，区别于 overlord 人形君王）、`enemy_shadow_hunter`（半虚影猎手+紫能弓，脱离蝙蝠）、`enemy_gargoyle`（蹲伏石躯+折岩石翼+橙裂隙眼，脱离精英）；`avatar.sprite` 由 `boss_overlord` 改 `boss_avatar`，并移除 shadow_hunter/gargoyle 上未生效的 `tint` 字段。
- **词缀视觉标识 + 精英光环（P2）**：`volatile` 橙色脉冲裂纹/引线辉光、`shielded` 蓝色结晶护盾环（颜色与 `data.js` AFFIXES 对齐，形状双通道可访问），`elite` 加脉动暗金精英光环作为高威胁信号；均为渲染层叠加，不换主体贴图。

### 调整
- **全 Boss 统一难度缩放**：`spawnBoss` 改为所有 Boss 的 HP 均乘 `bossHpMul`（easy0.7/normal1.0/hard1.4），原仅 avatar 缩放，现 baron/queen/overlord/avatar 一致随难度变化。
- **爆破词缀威胁提升**：`blastDamage` 18→35、`blastRadius` 70→100，永夜阶段不再「挠痒」。

### 优化
- **数值校准落地**：11 处 `[PLACEHOLDER]` 填默认中值并清理过期注释（三武器/续航/血瓶/血裔/经验曲线等）；清理 `SOUL_REWARDS` 未被引用的死字段（per30s/per20Kills/perLevel/perBoss），保留首通收敛奖励；`computeSoulReward` 分母由 `ENDGAME_BOSS_TIME` 修正为 `GAME_HARD_CAP`。

---

## v0.18（2026-07-24 · `f8a4f7b`）

### 新增
- **图鉴分类 / 入口 / 祭坛菜单独立图标（5 张程序化像素图）**：新增 `codex_artifacts`（暗金符文圆盘 + 中央悬浮棱面钻石 + 8 向 rune 刻痕）、`codex_monsters`（恶魔眼印记·双犄角 + 发光裂瞳）、`codex_weapons`（剑 + 斧异型交叉成 X + 血红魂芯铆钉）、`codex_book`（中性炭灰闭合魔典 + 金属搭扣 + 发光书页）、`altar_menu`（阶梯式石台 + 上方悬浮幽蓝/紫灵魂火）。均为 `gen_assets.py` 程序化专属、**不加入 `AI_OWNED`**，菜单图标统一 scale=2（codex_book 用 48×48 → 96×96），与现有 `altar_*` / `passive_tome` / `weapon_*` 等明显区分。

### 修复
- **游戏图鉴一级菜单三张卡片 icon 不显示**：`showCodex()` 原引用未注册的 key（`art_sword` / `icon_skull` / `weapon_blade`），`sprite()` 返回 null → `<img src="">` 空白。现改为新注册的 `codex_artifacts` / `codex_monsters` / `codex_weapons`，并在 `src/assets.js` 的 `files` 注册这 5 个新 key（含 `codex_book` / `altar_menu`）。
- **灵魂祭坛主菜单按钮 icon 改为祭坛造型**：`index.html` `#btn-altar` 的 `<img>` 由复用的 `altar_hp` 升级图标改为独立 `altar_menu` 祭坛建筑图标；`#codex-hub` 顶部新增 `codex_book` 书本徽记（`src/style.css` 补 `.codex-hub-book` 样式与 `.touch-device` 适配）。

---

## v0.17（2026-07-24 · `4ea9889`）

### 调整
- **灵魂货币结算收敛**：旧公式（存活/击杀/等级/Boss 累加）通关一把≈400~600，一两把即可买光祭坛。新公式 `floor((坚持时间/通关总时间 900s)×500) + 等级×1`，通关≈500+等级、死在 9 分钟≈250+等级；保留难度 `soulMul` 与祭坛 `soulGainMul` 乘区，首通奖励收敛为 easy30/normal50/hard80（一次性）。祭坛总价 1160 ≈ 通关 2~3 把毕业。
- **石像鬼平衡（后期一击秒杀修复）**：基础伤害 `40 → 22`（肉盾定位，不该有刺客级爆发）；新增**非 Boss 单次触碰伤害上限 = 35% 最大生命**（Boss 保持全额威慑），给玩家反应窗口；**永夜加深对非 Boss 伤害指数减半**（小怪用 `nightBase^(D/2)`，Boss 仍 `nightBase^D`），后期小怪仍变强但不再指数秒杀。

### 新增
- **游戏图鉴分级菜单**：主菜单「合成图鉴」升级为「游戏图鉴」一级菜单（3 张分类卡片），下钻为「神器图鉴 / 怪物图鉴 / 武器图鉴」三屏；怪物图鉴按夜行/永夜/Boss 分组，每怪卡含贴图、HP/伤害/首现时间/行为描述；左上返回键可逐级回退。
- **图鉴分类配色标签（⑤）**：武器图鉴卡片按「武器=红 / 被动=青 / 神器=金」加圆角色徽 + 同色系边框，怪物图鉴 Boss 用金色、小怪用紫色，扫一眼即知类别。
- **祭坛 / 血裔入口图标（双端适配）**：主菜单「灵魂祭坛」前加祭坛图标、「血裔：XXX」前加当前血裔头像（随所选血裔动态切换）；桌面端图标左文字右横排，触屏/窄屏改为图标上文字下、触控区 ≥72px。

### 优化
- ENEMY_TYPES 补 `name` 中文字段，怪物图鉴正确显示「夜行蝙蝠 / 骷髅 / 史莱姆 / 精英 / 暗影猎手 / 石像鬼」；暴露 `window.__enemyTypes` 调试钩子。

---

## v0.16（2026-07-24 · `5d21614`）

### 修复
- **长鞭单次挥击去重（真 bug，Boss 被秒元凶）**：`applyWhip` 沿长鞭每 12px 采样，原本大型敌人（尤其 Boss 半径 ~40）会同时落在多个采样点被命中 ~10 次，导致满级鞭甚至进化永劫之鞭近乎秒杀 Boss。新增 `hitSet` 单次挥击内每敌只结算一次伤害，基础长鞭与永劫之鞭三向齐扫各自独立去重。
- **神器投射物视觉雷同（同源圣印 bug）**：千刃风暴 / 猩红之拥 / 寂灭结界 原共用红色 `blade` 贴图、圣光矩阵（cross 进化）竟被画成红飞刀。现矩阵改用金色 `weapon_cross` 贴图（与黎明圣印一致），风暴 / 猩红 / 结界 分别加青 / 猩红 / 紫 `tint` 主题色，**零新素材**，4 个神器一眼区分。

### 新增
- **隐藏血裔「永夜使徒」首通解锁 + 成就横幅**：此前 `apostle` 因无解锁触发而永久死锁（永远点不到）。现于首次通关 `gameWin()` 自动写入解锁列表并 `saveSouls()`，同时弹出金色描边的「成就解锁 · 永夜使徒」横幅（`prefers-reduced-motion` 下自动关动画）。

### 优化
- 测试覆盖：e2e 新增 8 条断言（长鞭去重 / 4 神器投射物主题 / 隐藏血裔首通解锁 + 成就横幅），断言总数 95 → 103，控制台零错误。

---

## v0.15（2026-07-24 · `3a946d6`）

### 调整
- **嗜血者起手武器去重**：起手由「血之飞刃 blade」改为专属「噬魂长鞭 whip」，与流浪者区分；保留命中回血 +1.5、伤害 +5% 的吸血签名。
- **血瓶掉率下调**：非 Boss 击杀掉落概率由 7% 降至 2.5%（约每 40 杀一个），Boss / 精英掉率与专属宝箱不变，压低续航过强导致的难度坍缩。
- **后期升级池偏置被动**：新增后期因子 `late = clamp((t - NIGHT_START)/360, 0, 1)`（9min→15min 渐强）。`weapon-new` 权重 2→0.3（后期基本不再刷新新武器），`passive-up` 3→4.5、`passive-new` 1→2.0（偏置属性成长）；`weapon-up` 不变（已拥有武器仍可升满）。**前期 `t<540` 时 `late=0`，权重与现状完全一致**，满足"前期不用调"。

### 修复
- **黎明圣印投射物去重（真 bug）**：`cross` 发射的投射物原本 `kind:'blade'`、渲染统一画红飞刃贴图，视觉与血之飞刃完全混淆。改为独立 `kind:'cross'`，复用金色 `weapon_cross` 贴图 + 金色辉光 + 自旋，一眼区分，零新素材。

### 文档
- 新增设计方案 `docs/plans/2026-07-24-balance-tuning-design.md`（四改点根因 + 权重公式 + 验证）。

---

## v0.14（2026-07-24 · `78a7414`）

### 修复
- **被动专属图标**：消除「武器 / 被动 / 角色」跨类目重复贴图。新增 8 个程序化像素图标（`passive_boots` 靴 / `passive_heart` 心脏 / `passive_tome` 魔典 / `passive_magnet` 磁铁 / `passive_rage` 交叉双刃 / `passive_swift` 青翼 / `passive_greed` 金币 / `passive_guard` 钢盾），9 个被动现已使用 9 张互不重复、也不与武器 / 角色 / 宝石撞车的贴图。风格对齐现有 altar / art 图标管线，`gen_assets.py` 新增对应生成函数且避开 AI_OWNED 碰撞集。

---

## v0.13（2026-07-24 · `3087273`）

### 新增
- **左上角返回按钮**：祭坛 / 血裔 / 图鉴三个界面在左上角新增带 SVG 箭头的返回键（44px 触控靶、`:focus-visible` 焦点环、`safe-area` 适配），与原底部返回按钮并存，符合用户习惯。
- **战利品指引系统**：Boss / 精英 / 宝箱掉落物新增屏幕指引。掉落物在屏外时，屏幕边缘显示金色方向箭头并旋转指向；在屏内时，掉落位置显示金色脉冲环（绘制在怪物之上，解决被遮挡问题）。世界→屏幕坐标用 `canvas.getBoundingClientRect()` + 相机偏移映射，竖屏 / 横屏 resize 后依然准确；`prefers-reduced-motion` 下自动关闭环动画。

### 修复
- 补充 `.top-back` 按钮的 `:focus-visible` 焦点环（此前遗留的中优可访问性债）。

---

## v0.12（2026-07-24 · `bfb7ebd`）

### 新增
- **终局平衡系统（核心）**：
  - **永夜加深**：`statScale()` 指数缩放，第 9 分钟起敌人 HP / 伤害按指数曲线提升，速度不变。
  - **神器反制**：持有神器越多、越到后期，敌人强度越高，对冲「拿到神器即无敌」。
  - **终局 Boss「永夜化身」**：第 15 分钟降临（15000 HP），击杀即通关，结算画面 `state='victory'`。
  - **后期小怪**：暗影猎手（冲刺状态机）、石像鬼（免疫击退）、狼群 pack 波次。
  - **词缀系统**：`volatile`（死亡爆破）、`shielded`（减伤）、`pack`（成群）。
- **宝石 5 档分层**：新增金（25）/ 红（50）两档经验宝石。
- **经验时间缩放**：`expScaleForTime(t)=1+(t/60)*0.08`，保证后期升级频率不衰减。
- **难度数值区分**：三难度仅做数值差异（`nightBase`/`artifactCounter`/`bossHpMul`/`affixMul`/`packMin-Max`/`expMul`/`soulMul`），保持机制结构一致，保证可维护性与体验一致性。
- **通关结算画面**：`victory-screen` + 按钮 + 金色样式。
- 附终局平衡 GDD：`docs/plans/2026-07-24-endgame-balance-design.md`。

### 调整
- 大量数值标记 `[PLACEHOLDER]`，待真机校准（永夜 / 神器 / 词缀 / Boss HP / 宝石阈值 / 难度曲线）。

---

## v0.11（2026-07-23 · `8ba12a7`）

### 优化
- **渲染性能**：暗角（vignette）离屏缓存，避免每帧重复绘制。
- **宝石辉光**：`shadowBlur` 改为 `lighter` 合成，降低 GPU 开销。

---

## v0.10（2026-07-23 · `e69da32`）

### 修复
- **字体高优修复**：自托管像素字体（Press Start 2P woff2 拉丁子集，本地加载）；中文 UI 切系统 CJK 字体栈（PingFang/YaHei/Noto Sans CJK），去除 Google Fonts 三个外链（两个 preconnect + stylesheet），解决国内加载不可靠问题。
- 像素字体仅保留用于拉丁 / 数字 HUD，15 条中文 UI 规则切换到 `--body-font`。

---

## v0.9（2026-07-23 · `cadc99b`）

### 修复
- **P0 崩溃防护**：关键路径容错。
- **P0 网格缓存**：优化空间网格性能。
- **P1 测试退出码**：e2e 失败时正确返回非零退出码。

---

## v0.8（2026-07-23 · `414dd5f`）

### 修复
- **素材管线根治**：解决两条同名素材管线互踩——程序化生成器（`gen_assets.py`）新增 `AI_OWNED` 集合永不覆盖 15 张 AI 美术；AI 脚本（`gen_assets.sh`）不再用 `rm -f *.png` 误删 ~30 张程序化独占资产。

---

## v0.7（2026-07-23 · `f405a0d`）

### 修复
- 锁定 Pillow 版本（`Pillow==12.3.0`）+ 固定 PNG 编码参数（`compress_level=9` 并剥离辅助块），根治素材重跑时的字节漂移，保证逐字节一致。

---

## v0.6（2026-07-23 · `72d86f1` / `ecd736f`）

### 新增
- **武器特效优化**：飞刃改忍者飞刀、光环改红环六芒星、长鞭挥鞭、雷霆落雷、圣水抛物线。
- 圆形技能范围升级曲线拉陡、`sepulcher` 红六芒星统一、雷霆 / 飞瓶命中音效。

---

## v0.5（2026-07-23 · `18b46b2` / `67749f7`）

### 新增
- **Boss 专属精灵 + 宝箱专属精灵**（A1/A2）。
- **玩家血裔精灵一致 + 敌人 / 玩家微动画**（A3/A4）。

---

## v0.4（2026-07-23 · `8b92a79` / `543795f` / `9d7bdd0`）

### 新增
- **祭坛 7 商品专属图标**：不复用现有素材。
- **角色全身立绘 + 初始武器说明**：去武器图标。
- **首启自动弹玩法说明 + 常驻按钮**。

---

## v0.3（2026-07-23 · `08fea8b` ~ `6191eef`，S3 槽位系统）

### 新增
- **武器 / 被动槽位上限**：`CONFIG` 基础上限 + `Player.maxWeapons/maxPassives`。
- **满槽抑制**：`buildPool` 在满槽时不再提供新武器 / 新被动卡，逼出 build 取舍。
- **祭坛扩容**：灵魂解锁 +1 武器槽 / +1 被动槽。
- **UI 显示槽位**：武器 / 被动槽位 X/Max。

---

## v0.2（2026-07-23 · `b4dfee5` ~ `d27fab0`）

### 新增
- **武器丰富化**：3 把新武器 + 3 件进化神器，对标吸血鬼幸存者。
- **S2 血裔系统**：开局角色差异，6 血裔 + 灵魂解锁 + 武器攻速 / 范围 / 吸血注入。

---

## v0.1（2026-07-21 ~ 2026-07-23 · 早期核心循环）

### 新增
- 灵魂货币长期循环（结算发灵魂 + 祭坛永久解锁 + localStorage 存档）。
- 升级选项改加权随机 + 武器配额（对齐吸血鬼幸存者「越拿越来」）。
- 难度下修 + 回血续航（血瓶掉落 / 血色再生被动）。
- 难度选择系统 + 升级回满血 + 敌人 HP 曲线调整。
- Boss 战（生成 / 阶段技能状态机 / 敌方弹幕 / 登场警告 + 顶部血条 / 必掉强化宝箱 + 进化补偿）。
- 神器合成 + 图鉴系统。
- 移动端适配（竖屏动态分辨率、虚拟摇杆、受击振动、刘海屏 safe-area、WebAudio 音效、玩法说明）。

---

## 待办 / 已知债

- 大量数值标 `[PLACEHOLDER]`，待真机校准。
- 圣光矩阵（matrix）觉醒后无专属特效（与普通 cross 投射物视觉雷同），待加金色描边 + 辉光 + 拖尾。
- 手机/电脑端「血之飞刃」自动瞄准差异（锁定半径、生成/回收环、DPR 去虚）已定位，待按锁竖屏定参修复。
- e2e 两处待加固：`65%血 召唤蝙蝠` 时序 flaky；`TOTAL FAILURES` 计数偶发误报。
- 审查第二批：命中特效全局节流、enemyProjectiles/gems 数量上限、buildGrid 每帧新建 Map。
- 升级界面 `backdrop-filter:blur` 移动端降级未做。
- Boss 预警 / 进化横幅重叠错开未做。
- `:focus-visible` 焦点环目前仅 `.top-back`，需铺到全局按钮。

---

> **维护说明**：此后每次版本更新，请在文档顶部按上述格式追加新版本的「日期 + commit + 分类条目」，保持中文书写与倒序排列。
