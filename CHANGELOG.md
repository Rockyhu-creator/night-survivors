# 夜裔幸存者 · 版本更新日志

> 本文档专门用于版本管理。**每当发生版本更新时，在此记录当前版本的功能变更记录，统一使用中文书写。**
> 格式约定：按版本倒序排列（最新在最上），每个版本标注日期与 commit 哈希，下设「新增 / 调整 / 修复 / 优化」分类条目。

---

## v4.3.2（2026-08-07 · `1743a2d`）

### 调整
- **6 血裔游戏内精灵（`player_*.png`）提清晰度 + 放大 10%**（`1743a2d`）：真机试玩反馈血裔精灵像素偏低、与选择卡片（portrait）观感脱节。
  - 源分辨率 46×46 → **64×64**（清晰度提升，渲染时 `PLAYER_SPRITE` 46→**51**，即放大约 10%）
  - 键控策略统一：血裔分支从 `gen_monster_pixels.py` 的众数色键控改为**边缘泛洪键控** `flood_key_bg`（与 portrait 卡同策略），修复 saint 白袍被众数色抠穿的隐患，保持血裔与角色立绘卡形象一致
  - 复用 P9 已生成的 1024² 高清源图（`.ai_monster_raw/<id>/`），未额外消耗 ImageGen 积分；6 张均 64×64、四角透明、saint 白袍保留

---

## v4.3.1（2026-08-07 · `8573d6d`）

### 修复
- **apostle portrait 灰阶→彩色重绘**（`8573d6d`）：v4.3 的 apostle 源图 ImageGen 生成为纯灰阶稿（饱和度=3, 彩色占比=0%），深色 UI 上几乎全黑无辨识度。重新生成彩色版（品红/洋红能量碎片环 + 青白发光眼 + 暗紫电弧披风，彩色占比提升至 ~10%），经 `gen_portrait_pixels.py` 边缘泛洪键控后处理输出 80×120 透明背景 portrait_apostle.png。

---

## v4.3（2026-08-07 · `23c1e36`）

> **Portrait 同步**：P9（v4.2）重做了 6 个血裔的 `player_*.png` 游戏内精灵（46×46），但选择卡片用的 `portrait_*.png`（80×120）仍沿用旧「兜帽+长袍+圆脸+发光眼」模板，两套资源视觉脱节。本版用 ImageGen 竖版立绘 + 边缘泛洪键控后处理管线同步 6 张 portrait，与 P9 精灵形象一致。

### 调整
- **6 张血裔 portrait 选择卡片立绘重做**（`23c1e36`）：全部替换为 ImageGen 生成的竖版立绘（832×1216 原图 → `gen_portrait_pixels.py` 边缘泛洪键控去白底 → LANCZOS 缩放至 80×120 透明背景）——
  - `portrait_wanderer`：红褐旅行装 + 头巾破斗篷（对齐 P9 player_wanderer）
  - `portrait_saint`：白金长袍 + 大光环/翼状光晕 + 法杖（**边缘泛洪键控保留白袍完整性**，opaque=70%）
  - `portrait_berserker`：裸肌赤红 + 巨剑扛肩
  - `portrait_thunder`：蓝紫法师袍 + 雷电弧环绕
  - `portrait_bloodthirsty`：蝙蝠翼披风 X 形剪影 + 利爪獠牙
  - `portrait_apostle`：近黑虚空剪影 + 漂浮碎片环

### 新增
- `gen_portrait_pixels.py`：portrait 专用后处理脚本——`flood_key_bg()` 边缘泛洪键控（只删与画布边界连通的白色背景，**不抠穿白袍等浅色主体**）+ `fit_contain()` 等比居中缩放至固定 80×120。解决 `gen_passive_pixels.py` 的全图众数色键控对 saint 白金袍的误伤问题。

### 验证
- 两门质量门全绿：`vite build`(0 error) + `validate:skilltree`(39 节点无断链)。
- 视觉抽检：6 张四角透明(alpha_range=(0,255))、深色 UI 无白方块、与 P9 player_* 精灵配色/特征一致。

---

## v4.2（2026-08-06 · `70f21e3`）

> **视觉更新**汇总：用户真机反馈两类问题——① 4 个白色系精灵（骸骨骑士/哀嚎女妖/复仇残躯/骨戈战将）主色过淡，在游戏画布上"显示不鲜明"；② 6 个血裔角色严重同质化，全部沿用「兜帽长袍 + 苍白圆脸 + 发光眼睛」同一模板，仅色调不同、剪影完全一致，战斗中无法分辨操作的是哪个角色。本版重做 10 张精灵，三门质量门全绿；12 个基线未跟踪文件按红线从不提交。

### 调整
- **4 个白色系怪物暗底重绘**（ImageGen → `gen_monster_pixels.py` 管线）：核心策略从「亮主色」转为「暗底 + 局部强对比亮点」，解决白/浅色系概念（骨骼、亡灵）在画布上对比度不足的根因（`70f21e3`）——
  - `bone_knight` 52px：暗钢黑甲 + 橙红发光眼窝（唯一亮部）+ 深裂痕
  - `siren` 46px：深蓝紫长袍 + 亮青发光长发（互补高对比，占主体 50% 面积）+ 大张尖叫黑嘴
  - `revenant` 52px：深色绷带破布 + 暗铁肩甲（脱离苍白幽灵风）
  - `warlord` 64px：暗金/深灰重甲 + 猩红符文与眼 + 象牙骨戟
- **6 个血裔角色差异化立绘**（`70f21e3`）：彻底打散「兜帽 + 长袍 + 圆脸」共用模板，每个角色改为**独立剪影**，46px 下一眼可辨——
  - `wanderer` 流浪者：红褐旅行装 + 头巾（非兜帽）+ 破旧红斗篷
  - `saint` 圣徒：白金长袍 + 大法杖 + 背后大光环/翼状光晕
  - `berserker` 狂战士：裸上身肌肉 + 红发 + 巨剑扛肩（完全无袍无兜帽）
  - `thunder` 雷巫：浮空姿态 + 蓝紫法师袍 + 手臂环绕雷电弧
  - `bloodthirsty` 嗜血者：蝙蝠翼披风（X 形剪影）+ 利爪 + 獠牙面孔
  - `apostle` 永夜使徒：近黑紫虚空剪影 + 漂浮碎片环 + 多触手

### 新增
- `gen_monster_pixels.py` 的 `SPECS` 补入 6 个血裔角色条目（`wanderer`/`saint`/`berserker`/`thunder`/`bloodthirsty`/`apostle`，均 46×46），此前玩家精灵不在管线覆盖范围内、无法走 AI 生图流程（`70f21e3`）。
- `bone_knight` 规格由 46×46 调整为 52×52，与其余小怪尺寸梯度对齐（`70f21e3`）。

### 验证
- 三门质量门全绿：`vite build`（371ms，17 模块）+ `validate:skilltree`(39 节点) + `test:assets`(109/109 精灵存在)。
- 抽检 4 张白色系怪物 + 2 张血裔 + 血裔六连并排预览图，确认无白团、6 角剪影互不相同。
- 12 个基线未跟踪文件（`.ai_monster_raw/` / `docs/plans/*` / `docs/architecture/` / `docs/DESIGN_PLAN.md` / `generated-images/` / `overview.md`）**未提交**，符合红线。

### 已知偏差
- `warlord` 与 `revenant` 各经 4 次重试仍与设计稿有轻微出入：warlord 偏暗金而非纯黑铁；revenant 面部仍偏亮。ImageGen 在「纯黑金属」「完全非苍白腐肉」这两类描述上收敛困难，当前版为管线能力内最佳，如真机观感仍不满意可再精修。

---

## v4.1（2026-08-06 · `5338c51`）

> **内容更新**汇总：用户真机演示反馈两类问题——① 新怪物/Boss 无动画（仅 bat/slime/skeleton 有程序化动画）；② 部分新精灵在 34~64px 下呈白团/混沌，辨识度差。本版重做 10 张精灵 + 为全部 18 个新对象补程序化动画，四门质量门全绿；12 个基线未跟踪文件按红线从不提交。

### 调整
- **10 张精灵全量重做**（ImageGen → `gen_monster_pixels.py` 像素化管线）：红旗 7 张（rat_swarm/plague_bearer/siren/herald/alchemist/overlord/avatar 原呈白团混沌）+ 黄旗 3 张（spitter/elite_colossus/warlord 轮廓偏糊）；改进核心为单一大轮廓、亮主色 + 粗轮廓、2~3 个超大特征、减少内部细节（`5338c51`）。
- **18 个新对象程序化动画**（`src/entities.js` `render()` 动画块由 4 分支扩至 21 分支，纯 in-code scale/rotate 变换零新素材）：8 新小怪 + 7 Boss（按 `e.type.id` 区分个体）+ 3 精英，各配符合形象气质的微动（`5338c51`）。

### 验证
- 四门质量门全绿：`node --check` + `validate:skilltree`(39 节点) + `test:assets`(109/109) + `test:content`(PASS，新怪渲染无 console error)。
- 12 个基线未跟踪文件（`.ai_monster_raw/` / `docs/plans/*` / `docs/architecture/` / `docs/DESIGN_PLAN.md` / `generated-images/` / `overview.md`）**未提交**，符合红线。

### 修复
- **首页操作卡片删除 + 玩法说明重写**（`index.html`）：移除 `how-to` 区块（WASD/自动攻击/拾取宝石/Boss 宝箱 四张卡片）；玩法说明弹窗全面重写——Boss 列表从 3 个补全到 **7 个**（含时间点）、武器数量修正为 **18 把**、血裔逐条描述、词缀怪合并进敌人条目、补充精英行为模式、操作合并为单条（`1107f14`）。

---

## v4.0（2026-08-05 · `67e510e`）

> **大版本**汇总：把 P3b-3~5（精英差异化内容）、P4-1（精英悬赏）、P4-2（连杀 Combo）与 P5（美术占位统一工具 / 移动端真机门禁 / 精灵缺失断言）整批随 v4.0 发布。全量本地提交、四门质量门（node --check / validate:skilltree / test:content / test_game.py）逐切片全绿；7 个基线未跟踪文件按红线从不提交。本版**未改动已发布的线上构建行为契约**，仅新增内容与护栏。

### 新增
- **P3b-3 精英差异化行为（4 单元）**：
  - 腐骸巨像：复用 `boneKnightBehavior` + 正面装甲（`0c4a7a8`）。
  - 裂魂掠夺者：复用 `shadowHunterBehavior` + dash，可预判读招（`55d719a`，`shadow_hunter` 立绘逐字节不变）。
  - 血狱典狱长：半血 `onLowHp` 召唤 bat×4，通用钩子 + `ENEMY_CAP` 守卫（可复用，`ad64ef7`）。
  - 永夜导体：环形弹幕 + 友军加速光环，每帧预扫描 `_speedMul`（`abb26c6`）。
- **P3b-4 精英保底金宝石**：精英死亡保底掉 `gemGold(min=25)`，净经验不通胀（仅对 `exp<25` 生效）；巨像死掉双宝箱（`b5954d4`）。
- **P3b-5a 图鉴分组重构 + 弱点情报**：怪种/词缀(8 条)/精英/Boss 四分组，data-driven 弱点 badge，击杀分级解锁（`6e02edc`）。
- **P3b-5b 游戏内 HUD**：精英边缘紫色指示箭头 + 屏内头顶血条 + 侧背命中暴击级飘字（`d803086`）。
- **P4-1 精英悬赏**：精英击杀累加灵魂 `bounty=round(exp*0.5)`，结算并入 `addSouls`（零局内平衡扰动，`90d446a`）。
- **P4-2 连杀 Combo**：`onEnemyKilled` 计数 + `COMBO_WINDOW=3s` 窗口（超时/受击断连），经验分段乘区 ≥10×1.1 / ≥25×1.25 / ≥50×1.5，居中 HUD 白金红分级（`88b7614`）。
- **P5-1 美术占位统一工具**：`safeIconURL`（HTML `<img>` 缺失返带标签 SVG data-URI）+ `drawSpriteSafe`（canvas 缺失画带标签占位方块，替代裸紫圆）；图鉴/升级图标与敌怪渲染缺失绝不碎图；补 `enemy_shadow_hunter.png`/`enemy_gargoyle.png` 立绘，Boss `avatar` 复用 `boss_overlord`（`56a7657`）。
- **P5-2 移动端真机门禁**：`frame()` 注入 `performance.now()` 单帧耗时 EMA → `window.__perfDebug`；触屏 ≤12ms / 桌面 ≤16.6ms 软告警（仅 `console.warn`，不改玩法）；e2e 加 3 条断言门禁（`115114e`）。
- **P5-3 精灵缺失断言**：`scripts/test_assets.mjs` 校验 `assets.js` 96 项清单 PNG 全部存在（缺失 exit 1），挂 `npm run test:assets`，不接 prebuild（`67e510e`）。

### 验证
- 四门质量门全绿：P5-1/P5-2/P5-3 各切片 `node --check` + `validate:skilltree`(39 节点) + `test:content` + `test_game.py`(ALL PASS / 无 console error)；P5-3 另跑 `npm run test:assets`（96/96 存在，0 缺失）。
- 移动端门禁真实触屏模拟（Playwright `has_touch+is_mobile`）下 e2e 全 PASS、无越界。
- 7 个基线未跟踪文件（`docs/DESIGN_PLAN.md` / `docs/architecture/` / `docs/plans/*` / `generated-images/` / `overview.md`）**未提交**，符合红线。
- `docs/HANDOFF.md` §11 已回填 v3.14 文档提交哈希 `ddc31fe`，v4.0 文档提交行留占位符由 v4.1 回填（遵循「先回填再插新行」红线）。

## v3.14（2026-08-01 · `ca273ef`）

> 纯**仓库卫生**补丁，清理 v3.13 交接时列出的两条遗留，并追加一项根治措施。本版**未改动 `src/` 下任何产品代码，无运行时回归面**，亦未动 `tests/` / `scripts/` / `package.json`——改动仅落在 `.gitignore` 与两份文档。

### 修复
- **`.gitignore` 补 `vite.config.js.timestamp-*`**：vite 每跑一次 dev/build 就生成一个新的 `vite.config.js.timestamp-<epoch>-<rand>.mjs` 临时产物且不清理旧的，长期堆在 `git status` 的 `??` 列表里——既污染工作区视图（每次发布都要在禁提清单里多念一个文件名），也在批量 `git add` 时构成误提交风险。**只加忽略规则，不删磁盘上已存在的文件**（属 vite 自管的临时产物）。
- **`docs/HANDOFF.md` §11 回填 v3.13 文档提交哈希**：代码块首行 `(本次文档提交)` → **`ae95024`**，行内其余文字（含 `| tag v3.13 指向此提交` 尾注）原样保留，写法对齐同节 `ab8d08e` / `461a5a5`。

### 优化
- **§11 新增「占位行回填」维护红线（修根因，非修症状）**：在节标题与代码块之间立引用块，把**「写新版本提交行前，第一步先把上一版 `(本次文档提交)` 回填为真实哈希，然后才在顶部插新行」**制度化，并给出可机械执行的核对命令（`grep -c '^(本次文档提交)' docs/HANDOFF.md` 必须输出 1，**行首锚定不可省**）。
  - **为何需要**：`(本次文档提交)` 是结构性必需的占位符——文档提交无法在自身内容里写入自己的哈希，只能留白由下一版代填。但下一版的实际动作是「在顶部插新行」，占位行被顺势顶下去、看着还在，**回填这步没有任何东西提醒你做**，于是被系统性遗漏。缺的是流程校验，不是某次疏忽。
  - **存证**：`461a5a5`（v3.11 文档提交）就这样空占了两个版本，直到 v3.13 才补回。本版回填的是 v3.13 的 `ae95024`。

### 新增
- **`docs/HANDOFF.md` 新增 `## 0p.` 小节**（置于 0o 与 §1 之间）：记录本版触发、落地、根因（含「占位行被顶掉」这一机制性缺陷）、v3.13 当时为何不顺手做 `.gitignore`（彼时改它属 H_A，会让已写死的 `7898588` 失效并连带重做 H_B，为一条噪音规则触发哈希连锁返工不划算；本版无此约束）与验证。

### 验证
- `git check-ignore -v vite.config.js.timestamp-1785400370343-31d3b8f68dacf.mjs` → 命中 `.gitignore:9:vite.config.js.timestamp-*`。
- `git status --short` 禁提未跟踪文件 **8 → 7**（该 `.mjs` 已从 `??` 列表消失，文件仍在磁盘未被删除）。
- `grep -c '^(本次文档提交)' docs/HANDOFF.md` = **1**（仅本版文档提交行），符合新立红线的收尾核对标准。
  - **核对命令必须带 `^` 行首锚定**：红线与 §0p 为讲清规则，散文里会反复提到 `(本次文档提交)` 这个字符串，不加锚定的全文 `grep -c` 会把这些说明文字一并计入，**数值随文档措辞增删而漂移、恒 > 1**，永远不等于 1，**规则一写下去就会把自己判红**。占位符的真实语义是「代码块中某行提交记录的行首前缀」，只有行首锚定与之对应。
- 本版**未改动 `src/` 下任何产品代码，无运行时回归面**。

## v3.13（2026-08-01 · `7898588`）

> 把 v3.12 的一次性人工探针沉淀为**常驻回归用例**。v3.12 用 `CARD_H=160`/`ROW_H=178` 消除了桌面父子纵向重叠，但对实测最大卡高 160px **仅余 18px**——这类硬编码布局常量在日后节点描述文案变长、缩放自适应字号被撑到 clamp 上限时会**静默复发**，且往往只有玩家放大查看时才发现。本版落地 v3.12 质量门提出的两条非阻塞建议：给这条余量装上「会响的警报」，并顺手清掉两处文档污染。

### 新增
- **技能树重叠常驻回归用例** `tests/skilltree_overlap.py`：覆盖 **8 档**——桌面 3 档（1280×800 / 1600×1000 / 1920×1080）+ 真触屏移动端 5 分支全遍历（`has_touch=True, is_mobile=True`，390×844，dsf=3）。断言「父子纵向相交 0 组」与「任意两卡可见碰撞 0 组」。
  - **移动端必须遍历 5 分支**：`ui.js:1054` 的 `branchIds = isMobile ? [this.stBranch] : Object.keys(...)`，移动端一次只渲染当前分支，只测默认 war 会放过其余 4 支；切换走 `.st-seg-btn[data-branch=...]` 真实点击。
  - **抗退化设计**：行距**不硬编码**，从卡片 top 网格取相邻最小正差反推实测 `ROW_H`，日后改常量测试自动跟上；余量 < 8px 给 WARNING（不失败）。
  - **移动端失真守卫**：若 `<html>` 未带 `.touch-device` 直接判 FAIL——防 v3.10/v3.11 那种「以为测了移动端、其实测的是桌面布局」的漏检。
- **`package.json` 新增 `test:skilltree` 脚本**：`npm run test:skilltree` 手动运行。**刻意不接 `prebuild`/`build`**——该用例依赖 dev server 在 5173 运行，接进构建链会让离线构建失败。

### 修复
- **`CHANGELOG.md` 第 6 行历史工具残留标记清除**：`<arg_value:6124c78e>---` → `---`。该前缀系历史工具写入残留，会破坏 Markdown 分隔线渲染（全仓 grep 确认仅此一处）。
- **`__ASSET_HASHES__` define 名笔误全量修正（6 处）**：`__ASSET_38f5eb9ES__` → `__ASSET_HASHES__`——`docs/HANDOFF.md` **5 处**（§0j 正文、§0j 改动文件清单、§11 提交历史、§16 运行时自检 ×2）+ 本文件 v3.8 条目 **1 处**。根因为 `4cbfb61`「docs: v3.8 CHANGELOG + HANDOFF 同步」回填 commit 哈希时执行了全局替换，把两份文档里的 `HASH` 连带换成短哈希 `38f5eb9`，**是一次误替换的 6 个落点、而非 6 个独立笔误**。代码侧 `vite.config.js:59`、`src/assets.js:122-123`、`src/ui.js:221` 均为正确 define 名，未受污染。其中 §16 那处危害最大：它给出的排障串 `ReferenceError: __ASSET_..._ is not defined` 照抄去 grep 源码永远搜不到。
- **`.gitignore` 补 `__pycache__/`、`*.pyc`**：新用例运行会产出 `tests/__pycache__/*.pyc` 编译产物，此前未被忽略，存在误提交风险。

### 验证
- `npm run test:skilltree` → **EXIT 0，8 档全 PASS**。
  - 桌面 3 档：39 节点、卡高 min/max **157/160px**、实测行距 **178px**、`ROW_H` 余量 **18px**、父子纵向相交 **0 组**、任意两卡可见碰撞 **0 组**。
  - 移动端 5 分支（war 9 / bly 8 / nfr 8 / eco 6 / utl 8 节点）：卡高 58px、行距 116px、余量 58px，均 **0 组 / 0 组**。
- **负向对照（mutation 验证，证明不是「永远绿的假测试」）**：运行时强制撑高卡片——
  - 卡高 **175px**（余量 3px）→ 触发 **WARNING 但仍 PASS**（语义正确：余量吃紧尚未重叠）；
  - 卡高 **185px**（超 `ROW_H` 7px）→ **FAIL**，检出 **38 组父子相交 + 26 组可见碰撞**并逐对定位（如 `war_root → war_dmg 纵向相交 7px`）。
- 本版**未改动 `src/` 下任何产品代码**，无运行时回归面。

## v3.12（2026-08-01 · `1b83ca2`）

> 修复桌面端技能树**父子节点纵向重叠**。卡片真实渲染高度为 157–160px（缩放自适应字号在 fit 缩放下被撑到 clamp 上限），但布局常量 `CARD_H=104`/`ROW_H=126` 严重低估真实高度，导致父→子顶边间距(126) < 卡片实高(157)，**每个父子对纵向相交 31–34px**（放大查看时尤其明显）。v3.11 只修了同层水平重叠（列分配），未覆盖本处纵向问题。

### 修复
- **`src/ui.js` `renderSkillTree` 桌面布局常量校正**：`CARD_H` 104→160、`ROW_H` 126→178（匹配卡片真实渲染高度）。移动端三值（`CARD_H=58`/`ROW_H=116`/`TITLE_OFF=24`）及 `CARD_W`/`COL_W`/`BAND_GAP`/`TITLE_OFF` 桌面值均**未改动**。
- 连线起点 `a.y + CARD_H` 与世界高度 `y + CARD_H` 由同一常量驱动，常量校正后自动对齐卡片真实底部，无需额外改连线逻辑。

### 验证
- 桌面重叠探针（1600×1000）：父子纵向相交 **0 组**、任意两卡可见碰撞 **0 组** → **PASS**。
- 卡片高度分布实测 `[157, 160]`，`ROW_H=178` 留 18px 余量；全缩放层级（fit 0.2 ~ 放大 2.2）均无重叠。
- 移动端常量未变动，无回归；`node --check src/ui.js` 语法 OK。

## v3.11（2026-07-31 · `90629d2`）

> 修复移动端技能树**同层节点重叠**（双亲汇聚/菱形分叉导致兄弟节点坍缩到同一列、完全重叠）。实测 nfr 分支 `壁垒护盾(nfr_shield)` 被 `nfr_statusamp` 压在下方，玩家点不到看不到，误以为「前置不存在/无法解锁」；同类重叠全树共 5 对（nfr1/bly2/eco2）。数据层无误（39 节点全可解锁，前序 3 重验证已证）。

### 修复
- **`src/ui.js` `renderSkillTree` 列分配重写**：以「首前置父」构建严格树消除菱形坍缩；多前置汇聚节点列号取双亲中点（合流视觉、水平分离）；按深度层逐层量化列号为互不相同整数（安全阀，杜绝同层水平重叠）。`children`(连线) 与 `data.js`/图标未动。
- 移动端重叠探针（390×844 真触屏）5 分支全 CLEAN；运行时 `buySkillNode` 拓扑解锁 39/39 全 ok；`validate_skilltree.mjs` PASS；`test_game.py` 全量 ALL PASS 零报错（桌面零回归）。

## v3.10（2026-07-31 · `f486df8`）

> 技能树数据完整性**永久校验护栏**：新增 `scripts/validate_skilltree.mjs`，挂到 `package.json` 的 `validate:skilltree` 与 `prebuild` 钩子，任何「节点 prereq 指向不存在的节点 / 重复 id / 超过 2 前置 / 不可达 / 成环 / gateReq 非法」都会在构建前直接让 build 失败。起因：用户反馈「嗜血渴望(lifesteal) 等节点前置不存在」，经 3 重验证（node 导入 / 全仓 grep / 真实运行时 `buySkillNode` 拓扑解锁仿真）确认当前 v3.9 源码 39 节点 prereq 全部有效、全部可解锁——所见系客户端缓存了修复前的旧 bundle；护栏用于杜绝此类数据断裂再次悄悄溜入。

### 新增
- **技能树校验脚本** `scripts/validate_skilltree.mjs`：校验 a 必填字段 / b 唯一 id / c prereq 存在性（核心防护）/ d ≤2 前置 / e 无环+每分支恰一 root+不跨分支+可达 / f gateReq 合法（`cleared` ∈ `DIFFICULTIES`）。`node scripts/validate_skilltree.mjs` 通过则 exit 0，任何问题 exit 1 并打印定位。
- **package.json 脚本**：`validate:skilltree`（手动跑）、`prebuild`（构建前自动跑，断链直接 build 失败）。

### 修复
- （预防性）填补「prereq 校验器只活在 /tmp、未进仓库」的系统性缺口——此前改 `src/data.js` 时无回归护栏，是数据断裂反复溜入的根因。

### 验证
- 干净数据：`node scripts/validate_skilltree.mjs` → `✓ 技能树校验通过：39 节点，无断链/重复/越界/不可达`（exit 0）。
- 反向验证：篡改为缺失 prereq id → exit 1 并打印 `节点 bly_sanguine_lifesteal → 缺失前置 "bly_nonexistent"`；`npm run build` 被 prebuild 直接拦停。补测环检测亦 exit 1。
- `src/data.js` 无改动（仅新增脚本 + package.json 两行）。

---

## v3.9（2026-07-31 · `b82d99a`）

> 移动端技能树交互重构：参考手游天赋树（原神/星穹铁道/暗黑不朽/FF14/绝区零）做法，把移动端技能树从「5 分支宽幅 fan-out 整树 fit（过小需反复缩放）」改为「顶部分段控件切分支 + 单分支竖向链 + 点击节点弹底部抽屉」。桌面端 5 分支总览不变，图标与节点数不动。

### 新增
- **移动端分支分段控件**：`.st-seg` 顶部悬浮 5 个分支标签（征伐/血裔协同/永夜抗性/灵魂经济/通用机能），点选即切换并重渲该分支竖向链；桌面端 `display:none` 不介入。
- **移动端底部详情抽屉**：点击节点从底部滑出 `.st-sheet`（名称/类型/描述/消耗/前置清单/解锁按钮，含 XSS 转义），替代原地 expand/tooltip；解锁经 `.sh-buy` 事件委托走 `buySkillNode`，保持视图。

### 优化
- **移动端竖向链布局（坐标轴对调）**：depth→纵向滚动、兄弟→有限横向列偏移（紧凑尺寸 COL_W92/CARD58/ROW_H116），二叉分叉最多 2 条并行竖线，宽度钳制单屏，彻底消除横向 fan-out；双亲汇聚 keystone 列号取双父中点（合流视觉）。
- **点击聚焦居中**：`focusStNode` 把节点平移到视口上半部（让出底部抽屉空间）。
- **最小可读缩放**：移动端 `stMinScale()` 下限 0.6（桌面仍 0.2），fit 钳底、超高分支靠纵向 pan 看全。
- **触摸热区**：`.touch-device .st-world .altar-card` 58px 命中区（≥44px）。
- **底部浮层命中区修复（QA CONCERNS #77）**：`#skilltree-content` 加底部安全留白（`fitSkillTreeView` 扣除该 padding），`.st-viewctl` 容器改 `pointer-events:none`、仅按钮 `auto`，默认 fit 后节点不再被返回/重置/视图控制按钮抢占。

### 验证
- 设计文档：`docs/plans/2026-07-31-skilltree-mobile-redesign.md`。
- 移动端探针 `/tmp/skilltree_mobile_v39_probe.py` + 独立 QA `/tmp/skilltree_mobile_v39_qa.py`（14 项全 PASS）+ 修复探针 `/tmp/skilltree_fix_qa.py`（5/5）。
- `test_game.py` 全量 ALL PASS、零控制台报错（桌面零回归）。

---

## v3.8（2026-07-30 · `38f5eb9`）

> 资源加载优化：内容哈希精准缓存 + 分级懒加载。根治「每次更新都全量重拉、进度条变慢」——此前所有 ~100+ 张图共用全局 `BUILD_ID` 作 `?v=` 缓存击穿，每次 push 该值必变 → 全部图 URL 同时失效 → 浏览器+CDN 缓存被一次性击穿。

### 优化
- **资源 URL 精准缓存击穿（替代全局 `BUILD_ID`）**：`vite.config.js` 在构建期读 `public/assets/*.png`（142 张），对每张图按**文件内容 sha256** 生成 8 位哈希，经 `define` 注入 `__ASSET_HASHES__`（保留 `__BUILD_ID__` 供版本自检）。`src/assets.js` 抽 `assetUrl(fn)`（按文件名取内容哈希、缺失回退 BUILD_ID）、`loadOne`/`loadAssets` 改用之；`src/ui.js` 标题血裔按钮头像同样走哈希 URL。**效果**：图内容没变→哈希不变→URL 不变→浏览器/CDN 命中缓存；只有真正改了字节的图才重拉。纯代码更新时近乎秒开。
- **分级懒加载**：`assets.js` 拆 `LAZY_KEYS`(20) 与 `CRITICAL_KEYS`。进度条只等**关键集**（标题+开局+升级卡片必需：player/passive/art/weapon/敌人/gem/ground/decal/chest/各 menu 图标等）；`loadAssetsLazy()`（模块级 `lazyPromise` 幂等）+ `ensureLazy()` 后台拉取懒加载集（codex_*/altar_*/boss_*/portrait_saint 等 5 张）。`src/game.js` 关键集加载完即进标题、后台跑懒加载；`src/ui.js` 的 `showCodex/showAltar/showBloodline` 入口包 `ensureLazy().then()` 守卫，确保极快点开界面时图已就绪（视觉/逻辑不变）。

### 验证
- `npm run build` 成功，资源 URL 形如 `/assets/player.png?v=0f7a8664`、懒加载集 `/assets/codex_book.png?v=f4730e08`。
- 独立重跑 `test_game.py`：ALL PASS、零控制台报错。

---

## v3.7（2026-07-30 · `4f7d6d0`）

**技能树体验四项打磨（含前置条件审计 + 二叉化重构）**

- **新增**：重置天赋改用贴合暗黑哥特风的自定义确认弹窗（暗化遮罩 + 玻璃拟态卡片），替代原生 `confirm()`；支持「取消 / 确认重置」，点遮罩或 Esc 取消。
- **修复**：屏蔽移动端长按技能树区域弹出的系统复制/选择菜单——CSS 加 `-webkit-touch-callout:none` + `user-select:none`，并对画板 `contextmenu` 事件 `preventDefault()`。
- **优化**：技能树前置关系**二叉化**——每个节点（含 5 个分支根节点）最多 2 个子节点，原扇出 >2 处用现有节点串成链、复用现有节点作二叉链节，未新增节点；`SKILL_TREE` 由脚本校验为合法二叉树（每分支 ≤2 子节点 / 全可达 / 无环）。
- **审计**：用户报告「永夜庇护前置的壁垒护盾不存在」——逐节点核对 39 个节点 `prereq`，`壁垒护盾(nfr_shield)` 实际存在，链路 `永夜之门 → 坚韧体魄 → 壁垒护盾 → 永夜庇护` 完整有效，故未改动逻辑（视觉上该节点埋在三层深处，已在布局中可正常展开）。

**验证**：`/tmp/validate_skilltree.mjs` 通过（各分支最大子节点 2 / 无不可达 / 无环）；`test_game.py` 全量 ALL PASS 零控制台报错；重置全流程（开树→重置→确认）0 控制台错误。

---

## v3.6（2026-07-30 · `446bbc6`）

> 解锁后保持面板位置/缩放 + 玩法说明内容更新与图标统一。

### 修复
- **解锁不重置视图**：`renderSkillTree(justUnlocked, fit)` 新增 `fit` 参数——仅「打开技能树」时自动适配画板（`fit=true`）；解锁/重置等局部刷新保持当前平移与缩放不变（`fit=false`），解决每次点亮节点后面板突然跳回初始缩放的问题。`showSkillTree()` → `renderSkillTree(null, true)`；购买/洗点回调 → `renderSkillTree(id/null, false)`。

### 新增
- **玩法说明按钮图标**：`btn-guide` 改为 `.menu-btn` 结构，内嵌 `<img class="menu-btn-icon" src="/assets/guide_menu.png">` + `<span>` 标签，与技能树/图鉴/祭坛三个入口按钮视觉一致。
- **guide_menu.png**：程序化像素风「羊皮卷轴 + 发光问号」菜单图标（96×96 RGBA），由 `gen_assets.py` 新增 `gen_guide_menu()` 函数生成（暖色羊皮纸卷轴 + 青色发光 "?" 位图）。

### 调整
- **玩法说明内容补充灵魂树条目**：在「长远」条目后新增「灵魂树」bullet，描述 5 大分支天赋 / 洗点手续费 / build 构建，引导玩家发现主菜单的永久成长第二条线。

### 验证
- v3.6 探针 T1–T10 ALL PASS：全屏布局 / 初始 fit=0.20 / ＋缩放到 0.24 / tooltip+tt-buy 可用 / **解锁后 scale 不变(0.24==0.24)** / 持久化正确 / **洗点后 scale 不变(0.24==0.24)** / 重开 re-fit 回 0.20 / 玩法说明有 icon / 零报错。
- `test_game.py` 全量 ALL PASS 零回归。

---

## v3.5（2026-07-30 · `c31a079`）

> 移动端技能树全屏化 + 手势缩放 + 移动端购买通路修复：整页全屏铺满视口的自由平移画板、双指捏合缩放与放大/缩小按钮；并修复移动端「看得见买不了」的隐性缺陷（详情浮层内嵌解锁按钮）。

### 新增
- **移动端全屏画板**：`.touch-device #skilltree-screen` 改为整页全屏、不可滚动；画板 `#skilltree-content` 绝对定位铺满视口（`inset:0`），标题/灵魂余额/返回/重置以浮层叠加于画板之上，不再挤占画板空间，触点可全屏拖动查看整棵树。
- **双指捏合缩放**：`bindSkillTreePan` 重写为基于 Pointer Events 的多点手势——双指以中点为锚做「平移 + 缩放」合成（手势起点的世界坐标点黏在中点），单指继续平移、抬起一指自动续接平移；缩放下限由 0.35 放宽至 0.2，便于窄屏纵览整棵宽树。
- **详情浮层解锁按钮（移动端购买通路）**：`.st-tooltip` 在触屏端改为可交互（`pointer-events:auto`），内嵌 `.tt-buy` 解锁按钮（可解锁态显示「解锁 −X 灵魂」、锁定态禁用并显示原因），事件委托到浮层单击处理，点击即购买并刷新。修复此前移动端 `.ac-buy` 隐藏 + 浮层 `pointer-events:none` 导致「看得见买不了」的缺陷。
- **视图控制按钮触屏优化**：＋/－/适配按钮在移动端放大至 46px、竖排置于右下角，缩放百分比指示器上移避让底部操作条。

### 调整
- 桌面端交互完全不变（鼠标单指拖动平移、滚轮缩放、卡片内联购买按钮），无回归。

### 验证
- `/tmp/skilltree_mobile_probe.py` ALL PASS：全屏布局（content=视口尺寸、touch 类生效）/ tap 浮层显示且 `.tt-buy` 可见可用 / 点击解锁→节点 owned 并持久化（tree=['war_root']、余额 9699）/ 捏合手势使画板 scale 0.2→0.2828 / 零控制台报错。
- `test_game.py` 全量 ALL PASS 零回归零报错。

---

## v3.4（2026-07-29 · `3ff5dd2`）

> 技能树 UI 深度打磨：图标模式 + 路径高亮 + 缩放适配（参考移动端技能树截图优化）。

### 新增
- **图标模式**：39 个节点各生成 48×48 像素风图标（`sk_*.png`，按分支色×类型形状区分）；节点卡片新增 `<img class="st-icon">` 图标元素；移动端/触屏自动切换紧凑模式（56-58px 卡宽，仅显示图标，文字和按钮隐藏，点击→tooltip 展示详情）。
- **hover 高亮上下游路径**：鼠标悬停/触摸节点时，BFS 遍历该节点的所有祖先（沿 prereq 向上）和后代（沿 children 向下），相关连线加 `.lk-highlight` 类（3px 宽 + 双重 glow 投影）；离开时自动清除。
- **缩放字号自适应**：`zoomSkillTree` / `fitSkillTreeView` 设 CSS 变量 `--st-zoom`；标题/名字/类型/按钮字号用 `clamp(min, base/--st-zoom, max)` 反比缩放——放大时字号不膨胀、缩小时保持可读。
- **缩放百分比指示器**：画布底部居中显示 "XX%"（参考截图风格），实时跟随缩放更新。

### 调整
- 分支标题栏增加渐变底色+2px 底边框，视觉更贴近参考图的深色面板风格。
- `#skilltree-content` 增加 `overflow-x: hidden` 防止横向溢出。

### 验证
- `/tmp/skilltree_v34_probe.py` T1–T9 ALL PASS：39 图标加载 / 39 文件存在 / hover 路径高亮 / 离开清除 / 指示器可见 / 缩放机制 / 移动端紧凑模式 / 购买正常 / 零报错。
- `test_game.py` 全量 ALL PASS 零回归零报错。

---

## v3.3（2026-07-29 · `92d6e56`）

## v3.2（2026-07-29 · `47b4d53`）

> 技能树 UI 打磨三件套（纯表现层，无机制/数值改动）。依据 `docs/plans/2026-07-29-skilltree-ui-polish-design.md`（UX 规范）与 `-art.md`（视觉规范）落地，主理人整合裁决采用其「推荐」项。

### 新增
- **节点详情浮层**：单实例 `.st-tooltip`（暗玻璃拟态 + 分支色描边），桌面 hover / 触屏点击卡片展开（同一真源）。字段：节点名 · 类型 · 状态（可解锁/已点亮/前置未解锁）· 完整效果描述 · 灵魂成本 · **前置清单含各自 ✓已解锁/✗未解锁 态**。
- **路径连线**：每分支 `.st-branch-grid` 内注入 SVG overlay（`pointer-events:none` 不挡交互），按 `prereq` 算卡片中心画贝塞尔。三态：`lk-done`（已点亮路径·分支色 glow）、`lk-next`（可解锁下一步·虚线流光）、`lk-locked`（暗灰虚线）。
- **解锁动画**：购买成功 `available→owned` 触发 `just-unlocked` 450ms 脉冲（边框金光→回落绿边 + scale 1.06 回弹），文字全程不动。

### 优化
- `prefers-reduced-motion` 降级：解锁动画降级纯色切换、连线流光降级静态，照顾前庭敏感玩家。

### 验证
- UI 打磨探针（`/tmp/skilltree_ui_polish_probe.py`）T1–T5 全 PASS：5 分支连线 svg / 40 条边 / hover 浮层含前置+状态 / 购买触发 just-unlocked + 5 条 lk-next 高亮 / 零控制台报错。`test_game.py` 全量 e2e ALL PASS 零回归。

---

## v3.1（2026-07-29 · `692ae11`）

> 生存向平衡校准（v3.0 后首轮微调）。基于无头平衡模拟器（`/tmp/balance_sim.mjs` 复刻 `computeSoulReward` / `statScale` 真实公式）量化：经济已收敛无需动，校准重心在生存曲线的死亡螺旋风险点。

### 调整
- **永夜指数底数 `nightBase` 软化**：easy 1.12→1.08 / normal 1.22→1.16 / hard 1.32→1.24。9 分钟后夜战指数（非 Boss 取 D/2）由 1.22³=1.82× 降至 1.16³=1.56×，普通档 15min 末小怪 HP ×16.9→×14.5（−14%）、伤害 ×10.7→×9.2（−14%）。
- **刷怪节奏地板 `Math.max(0.18, …)` → `Math.max(0.22, …)`**（src/entities.js:442）：终局最后 ~4 分钟刷怪间隔下限放宽，怪潮密度 −22%。
- **血瓶掉率 2.5%→3.5%**（src/game.js:363）：缓解「掉血不可逆」，由原 7% 过高与 2.5% 偏紧之间取中值。

### 验证
- `node --check` src/data.js / entities.js / game.js 全 OK；`/tmp/balance_sim.mjs` 复跑确认新缩放曲线；`test_game.py` 全量 e2e 连跑 2 次 ALL PASS 零回归零报错（首跑偶发 1–2 条词缀观测断言失败，经复跑确认为 RNG 时序抖动，非回归）。

---

## v3.0（2026-07-29 · `4223272`）

> 新增「技能树」元进度层：跨局永久、消耗灵魂、`localStorage` 存档，与灵魂祭坛并存为双 sink，零污染 `ALTAR`/`startRun`。5 分支（征伐/血裔协同/永夜抗性/灵魂经济/通用机能）× 4 节点类型（gate/stat/modifier/keystone）= **39 节点**，含洗点(respec)。标题屏新增独立入口「灵魂树」按钮（`skilltree_menu.png` 图标）。

### 新增
- **技能树数据层（src/data.js `SKILL_TREE`）**：39 节点完整定义（id/branch/type/name/icon/desc/cost/prereq/gateReq/apply）；`buySkillNode(id)` 幂等购买（prereq 链 + cleared/achievement 门槛 + balance 校验）；`respecTree()` 全额返还 + 一次性小额手续费 `max(25, floor(refund*0.05))`（[校准] 5% 斜率待真机观察）。暴露 `window.__skilltree/__buySkillNode/__respecTree` 调试钩子。
- **4 个引擎钩子**：① `entities.js Player.weaponMods`（武器机制修饰 axe/lightning/holywater/starfall）② `rollCrit(baseDamage, bonusChance, bonusMul)` 扩参支持逐武器暴击 ③ `Player.lifestealToShield`（吸血溢出转护盾）④ `game.js startRun()` 在 ALTAR 循环后并列注入已购技能树节点（不碰 ALTAR/其余逻辑）。
- **武器接线（src/weapons.js）**：`hitEnemy` 扩参 `critBonus/critMulBonus` 透传 `rollCrit`；blade/holywater/axe 循环接 `player.weaponMods.{blade/holywater/axe}.count`；lightning 跳数接 `weaponMods.lightning.chains`；starfall 暴击接 `weaponMods.starfall`；吸血位点改「先回血、溢出且 lifestealToShield 时转盾」。
- **UI 入口（src/ui.js / index.html / main.js / style.css）**：标题屏新增 `btn-skilltree`（含 `skilltree_menu.png` 图标）与 `skilltree-screen`；5 分支卡片渲染、三态（owned/available/locked）、点击购买、重置天赋（confirm 显示返还/手续费）、返回；分支色 征伐红/血裔紫/永夜蓝/灵魂经济暗金/通用机能青绿。
- **独立入口图标（public/assets/skilltree_menu.png + gen_skilltree_menu.py）**：80×80 像素风、透明底、1px 暗描边；已注册 `gen_assets.py` AI_OWNED 防程序化生成器覆盖。

### 调整
- 全树成本约 13,750 灵魂（gate 250~350 / stat 160~360 / modifier 280~360 / keystone 650~850）；高风险 keystone（使徒权能 `bly_keystone_apostle`、终焉守护 `nfr_keystone_endgame`）需 `cleared:['hard']` 门槛，噩梦投资子区 `eco_gate_nightmare` 需 `cleared:['normal']` 门槛。

### 验证
- `node --check` src/* 全 OK；`/tmp/skilltree_v1_probe.py`（?debug）T1-T7 + 零控制台报错 ALL PASS（购买链/幂等/prereq 拦截/cleared 门槛 normal+hard/startRun 注入增量/洗点精确/不变量/39 节点）；`/tmp/skilltree_ui_smoke.py` 菜单按钮+图标+界面+39 卡+5 分支+返回 ALL PASS；`test_game.py` 全量 ALL PASS 零回归零报错。

---

## v2.5b（2026-07-29 · `dad7f2f`）

> 修复「镇魂钟鸣」(resolve) / 「镇魂赦令」(absolution) 符文视觉上「吸附在玩家身上」的问题。v2.5a 虽已让符文跟随玩家，但 `burstRadius`(190) 仍大于 `deployRange`(150) 且符文不自转，12 个红色辉光内缘 −40px 把玩家罩进红雾、叠加成贴脸光环。

### 调整
- **符文部署半径外推（src/data.js `resolve.levels` + src/weapons.js `tickAbsolution`）**：`deployRange` 提到 `burstRadius + 40`（L1~L5：170/185/200/215/230，觉醒 absolution：240），使辉光中心外移、内缘落到玩家身外（离玩家约 +40px 净空），不再把玩家罩进红雾。

### 新增
- **符文绕玩家自转（src/weapons.js `fireRune`/`updateRunes`）**：`fireRune` 在符文上记 `spin`（默认 0.6 rad/s，可由配置 `s.spin` 覆盖）；`updateRunes` 每帧 `rn.offAng += (rn.spin || 0) * dt` 推进角度，符文绕玩家旋转扫场，从静态贴脸光环变为可见部署环。

### 修复
- **吸附观感（根因：辉光半径 > 部署半径 + 无自转）**：经 Playwright 探针实测，符文坐标本身正确（150px 均布、跟随玩家无误），故非坐标 bug；真因为上述视觉/手感参数。修复后探针验证：12 符文均距 230px、玩家到辉光边距 +40px（脱离红雾）、自转推进正常、跟随仍生效、零控制台报错；`test_game.py` 全量 ALL PASS 无回归。

---

## v2.5（2026-07-28 · `4a20a3ede271d19f7fc02b7a736bad029ee9df17`）

> 本轮重做「镇魂钟鸣」(resolve) / 「镇魂赦令」(absolution) 的伤害触发机制：原符文陷阱为「敌人踏入极小触发圈才引爆一次、且一生只炸一次」，导致敌人在大爆发圈内未踩中中心小圈时完全不掉血、且符文存活期(8~12s)内仅造成一次伤害（用户反馈「触发频率低、进圈有时不触发伤害」）。现为圈内**周期性音波脉冲**：每个存活符文每隔 `pulseInterval`（L1~L5：1.1→0.8s；absolution：0.7s）从中心发出一道向外扩张的音波环（亮外环 + 内回响环视觉），环前缘扫过的敌人掉血（每脉冲每敌只命中一次，伤害 = 符文基础伤害 × `pulseMul`，基础 0.5 / absolution 0.6）。

### 调整
- **镇魂钟鸣机制重做（src/weapons.js `updateRunes`/`updateRunePulses`/`fireRune` + src/data.js `resolve.levels`）**：移除原 `triggered` 单次踏入触发分支；`fireRune` 在符文上记录 `pulseInterval`/`pulseMul`/`pulseTimer`，`updateRunes` 每帧递减 `pulseTimer`、归零即向 `runePulses` 桶 push 一道扩张环（`maxR=burstRadius`、`speed=burstRadius/0.22`、`width=26`、`life=0.28`、钟鸣家族色 `#ff3b5c`）；`updateRunePulses` 仿 `updateShockwaves` 用 `enemiesNear` 半径裁剪、`hitSet` 保证每脉冲每敌一次，命中带 `d<=currentR && d>=currentR-width-e.radius` 时 `hitEnemy`。渲染新增脉冲环绘制（亮外环 + 淡内回响环，`lighter` 辉光）。`absolution` 觉醒在 `tickAbsolution` 的 `fireRune` 内补 `pulseInterval:0.7, pulseMul:0.6`（更快更强），玩家减伤光环逻辑不受影响。
- **隐性 bug 修复（src/weapons.js `fireRune`）**：原符文对象缺 `maxLife`，而渲染用 `rn.life/rn.maxLife` 算透明度 → `NaN`；现补 `maxLife:s.duration`。
- **武器描述同步（src/data.js `resolve.desc`）**：由「埋设镇魂符文,敌人踏入即引爆」改为「符文环绕周身,敌人进入范围即触发音波脉冲」（v2.5a 范围修复后）。

### 修复
- **范围过小（v2.5a 跟进修复，src/weapons.js `fireRune`/`updateRunes` + src/data.js `resolve.levels`/`tickAbsolution`）**：用户实测 v2.5「范围还是太小、进圈有时不触发」。根因有三——① 符文布在开火那一刻的玩家周围、之后**静止不动**，玩家移动后范围被甩在身后；② **内圈死区**：符文布在 `deployRange`(140~180px) 一圈但 `burstRadius`(70~110px) 小于它，玩家身边约 70px 内打不到；③ **环间隙**：8~12 个符文按角度分布，相邻爆发圈之间有缝。现改为：符文**每帧环绕玩家重算坐标**（跟随移动，`fireRune` 存 `offAng/offR`、`updateRunes` 重算 `x/y`）；`burstRadius` 调大、`deployRange` 调小使 `burstRadius > deployRange`（L1~L5：130/145/160/175/190 vs 110/120/130/140/150，觉醒 absolution：200 vs 150），封闭内圈死区并显著扩大范围；`updateRunes` 新增**进入即触发**——敌人踏入 `burstRadius` 圈内时把脉冲等待压到 `ACTIVE_CAP=0.3s`（进入即触发、停留期间每 0.3s 持续脉冲），无敌人时回落 `pulseInterval` 慢节奏。
- **连带增强（觉醒 absolution 减伤常驻）**：因符文现跟随玩家且 `burstRadius>offR`，觉醒形态玩家恒在圈内，`tickAbsolution` 末尾的玩家减伤光环（`player.absolutionDR=0.8`）由「站圈内才生效」变为**常驻**——属合理增强（钟鸣护体），逻辑未改。

### 优化
- 性能：`enforceCaps()` 新增 `trim(this.runePulses, 200)` 安全网；脉冲 `life` 上限自然收敛、并发 ≤~12、`enemiesNear` 裁剪 + 极小 `hitSet`，无无界增长；`runes` 桶仍受 `MAX_RUNES` 约束；进入检测每帧每符文一次 `enemiesNear` 网格查询，开销极小。

### 验证
- 语法：`node --check` src/weapons.js / src/data.js 通过。
- e2e（test_game.py）：全断言 ALL PASS、控制台零报错（含新渲染循环与 `updateRunePulses` 无崩溃、无回归）。
- 针对性探针（Playwright，`?debug`）：① 加满级 resolve → 符文布设 → 圈内塞高血量敌 → 2 个脉冲周期后敌血量下降 23.1（= 44×0.5×玩家伤害系数），确认音波脉冲对范围内敌人可靠造成伤害；② **范围修复探针**：符文布设后瞬移玩家 220px，符文同步位移 220px（**跟随玩家**）；玩家身边 20px（旧内圈死区）敌与圈外敌均被脉冲击中掉血（delta=9 = L1 18×0.5），**内圈死区封死 + 进入即触发**成立；全程零控制台报错。
- 数值：`pulseMul` / `pulseInterval` / 脉冲 `life` / `speed` / `width` 为初版占位，标 `[PLACEHOLDER]` 待真机校准（相对原单次爆发为显著增强，建议实机手感微调）。

---

## v2.4（2026-07-28 · `7a53a1cfbf8bd563e99fc6fe88c3e9d6fad43384`）

> 本轮修复 v2.2/v2.3「武器/神器弹丸差异化」**代码已部署但运行时未生效**的问题（用户硬刷新仍见棱形）。

### 修复
- **子弹形状未渲染（根因修复，src/weapons.js `addWeapon`/`addArtifact`）**：v2.2 的 `SHAPE_DRAWERS`/`getShapeSprite`/`projShape` 代码与线上包均包含，但**运行时 `p.shape` 恒为 `null`**——`addWeapon` 创建的实例为 `{id, level, timer}`，**无 `.visual` 字段**；`fireHoming` 等内部 `projShape(weapon.visual, …)` 拿到 `undefined` → `default: return null` → 永远回落菱形 fallback（仅 `tint` 换色，故「棱形、只是颜色不同」）。现于 `addWeapon`/`addArtifact` 创建实例时补齐 `visual: WEAPONS[id].visual || id`，整条链路（homing/splitting/lifesteal/sentinel/orb 发射、哨卫/法球/符文对象 `visual` 派生）从此取得到正确剪影；神器 `tick*` 本就显式传 `{visual,…}` 故不受影响。**探针验证**：starfall→`star`、phantom→`shard`、sanguine→`fang`、aegis 哨卫→`bolt`、warden 法球→`orbiter` 全部正确挂上；起始武器 `blade`（忍者飞刀）按设计保留菱形。
- **镇魂钟鸣红钟扩展到基础武器（src/weapons.js rune 渲染）**：v2.2 红钟仅当 `rn.awaken==='absolution'` 触发，而神器 `absolution`（镇魂赦令）那条路本就正确；用户实际测的是**基础武器 `resolve`（镇魂钟鸣）**，其 `rn.awaken==='resolve'` 走 `else` 仍为圆圈光晕。现条件扩展为 `rn.awaken==='absolution' || rn.awaken==='resolve'`，**整个钟鸣家族（基础 + 觉醒）均渲染红圈血钟**，与「镇魂钟鸣应是红钟不是圆圈」的设计意图一致。

### 优化
- 双表 `update()` 每帧迭代 `[...weapons, ...innateWeapons]`，槽外固有武器（圣水洗礼）与占槽武器共用同一套差异化渲染，无额外热路径分配；`getShapeSprite` 离屏缓存不变，性能红线未破。

> 注：v2.2/v2.3 条目所记「武器弹丸差异化 / 神器形态差异化 / 镇魂钟鸣红圈血钟」**代码已落地并部署**，本次为「运行时挂载缺失 + 钟鸣家族判定收窄」的修正，非功能回退。

---

## v2.3（2026-07-27 · `2ca06f00c18e6e1d607ea8099e24076474cfba9e`）

> 本轮两类修复：① 升级卡内「神器合成提示」行溢出/被裁，改为选项卡最下方单独整行、允许换行不再溢出；② 圣水洗礼占槽问题——灵魂祭坛「双生武装」与「圣徒」血裔各给一把圣水、共占 2 个武器槽。现改为「槽外固有武器」机制：圣水不占武器槽、双源持有自动合并为两级、仍可被升级与进化（圣徒路线仍可进化出「吞噬」神器）。

### 调整
- **升级卡合成提示置底整行（src/upgrade.js + src/style.css）**：原 `.uc-recipe` 行塞在正文列内、窄卡 `white-space:nowrap` 溢出被裁。改为卡片纵向结构 `[.uc-top(图标+正文)] / 合成提示整行置底 / 选择按钮置底通栏`；`.uc-recipe` 取消 `nowrap`、允许换行并占满宽度，不再溢出。触屏覆写段同步（`.uc-top` 横向、`.uc-recipe` 换行）。整体观感与暗哥特风格一致。
- **圣水洗礼改为槽外固有（src/weapons.js `innateWeapons` + `addWeapon`/`removeWeapon` + `update`；src/entities.js `innateWeapons` 字段；src/game.js 血裔授予；src/data.js `soul_dual`/`saint`；src/ui.js 装备栏；src/evolution.js `performEvolution`）**：新增「槽外固有武器」双表模型——`player.weapons`(占槽) 与 `player.innateWeapons`(槽外)。`addWeapon(id, level, innate)` 的 `innate=true` 入槽外表；`hasWeapon`/`weaponLevel`/`upgradeWeapon` 查双表；`update()` 每帧迭代 `[...weapons, ...innateWeapons]` 保证槽外武器照样开火；`removeWeapon` 跨表移除（兼容进化消费）。**双生武装**(`soul_dual.apply`) 与 **圣徒**(`blade.weapon` + `innate:true`) 的圣水洗礼均走 `innate`，故 **0 槽占用**；二者皆持有时 `addWeapon` 合并为 **单条两级圣水**（不再占第 2 槽）。圣徒路线仍可升满级 + 持 magnet → 进化「吞噬」神器（devour 从槽外表移除基础圣水）。

### 优化
- **装备栏槽外标记（src/ui.js `refreshLoadout` + src/style.css）**：装备栏循环同时渲染 `weapons` 与 `innateWeapons`，槽外固有武器以青描边 + 角标「免」标注，玩家可直观看到圣水洗礼生效且不占槽。

### 验证
- 构建：`node --check` 全改文件通过、`vite build` 零错误。
- 运行时探针（Playwright）：圣徒起手 → `innateWeapons=[holywater lv1 innate]`、`weapons=[]`（**槽占用 0**）、`areaMul=1.2`；双源合并 → 单条 `holywater lv2`；圣水注入敌人后 `fire()` 正常生成 vials（确认槽外武器开火无碍）；升满级至 lv5；`removeWeapon` 跨表移除后 `hasWeapon` 返回 false。
- e2e（test_game.py）：升级流程/血裔/进化/装备栏断言全过、控制台零报错。升级卡合成提示断言随布局调整同步更新；Boss 65% 阶段召唤断言改为校验「阶段技能已触发(skillRuntime[0].triggered)」，比净蝙蝠数稳健（蝙蝠会被玩家武器消耗，净数时序不稳）。
- **注意**：用户侧若仍见旧版「棱形弹丸」，系浏览器缓存了旧 `index-*.js` 包，硬刷新（Cmd/Ctrl+Shift+R）即可见 v2.2 已部署的星芒/碎晶/獠牙/眼瞳等差异化剪影。

---

## v2.2（2026-07-27 · `fb0a75888537bb926d0d3feaf6f320f06b223219`）

> 渲染差异化热修：v2.0 新增的 8 件武器中 5 把走「菱形弹丸 + 换色」分支、辨识度低；8 件新神器觉醒后弹幕形态与基础武器完全一致、缺乏神器特征；镇魂钟鸣(absolution) 沿用 resolve 的「光晕圆圈」、无专属视觉。本次为 5 把新武器弹丸 + 8 件神器觉醒弹幕/形态 + 钟鸣重绘差异化剪影，全走离屏缓存 sprite 保障性能。

### 调整
- **5 把新武器弹丸差异化（src/weapons.js `SHAPE_DRAWERS` + `getShapeSprite` + `projShape`）**：新增 10 个离屏形状工厂（star/comet/shard/ghost/fang/bloodheart/bolt/ward/orbiter/eyebolt）与 `getShapeSprite(shapeKey,size,color)` 缓存；`projShape(visual, awakenId)` 按武器 visual 映射专属剪影——星陨 starfall=八方星芒(star)、幻影 phantom=不对称碎晶(shard)、血怒 sanguine=獠牙滴血(fang)、壁垒 aegis=晶棱弩矢(bolt)、守望 warden=环纹能量球(orbiter)。5 个 `fire*` 发射(追踪/分裂/吸血/哨卫/法球) 全部挂 `shape` 字段，渲染分支 `kind:'blade' && (shape||tint)` 改为 shape-aware 绘制（非 shape 时回落原菱形 fallback，保留遗留武器 crimson 等观感）。分裂碎片继承母弹 `shape`（幻影分身残影可见）。
- **8 件神器觉醒弹幕/形态差异化（awaken 驱动渲染）**：神器觉醒 id 此前仅用于伤害，本次同步驱动渲染差异——① 终焉 fatalis：星陨觉醒弹丸=带尾迹彗星(comet) ② 幻界 mirage：幻影觉醒弹丸=双重残影(ghost) ③ 血契 bloodpact：血怒觉醒弹丸=血心(bloodheart) ④ 堡垒 bastion：壁垒哨卫实体叠绘六边结界纹(青 #a9e6ff，R=19) ⑤ 哨卫 sentinel：守望法球实体叠绘眼形瞳孔(绿 #9affce 椭圆+黑瞳) ⑥ 灭世 cataclysm：重锤冲击波觉醒=红色(#ff5a3c) 锯齿分段环(30 段 ±7 锯齿，区别于 maul 橙色平滑环) ⑦ 血契 bloodpact：血怒吸血弹幕觉醒=血心 ⑧ 赦罪 absolution：决意符文觉醒=红圈血钟（见下）。
- **镇魂钟鸣 absolution 重绘（src/weapons.js 符文渲染分支）**：弃用原「光晕圆圈」效果，改为**红色圆环(#ff3b5c，stroke 3) 内嵌血色红钟**——穹顶 arc + 钟身 path + 钟舌圆点；base resolve 走原 generic ring 不变。钟鸣从此有专属神器视觉，与基础符文爆发明确区分。

### 优化
- **弹丸形状全缓存（仿 `getGlowSprite` 范式）**：`getShapeSprite` 首次离屏渲染后 Map 缓存，每帧仅 `drawImage` + `ctx.rotate(atan2(vy,vx))` 旋转，无逐帧 `shadowBlur`、无热路径 path 重描、无逐帧分配，彻底规避 Canvas2D 头号性能杀手；神器形态差异用轻量叠加绘制，均在 `enforceCaps()` 桶内（红/蓝配色：基础武器=原色，神器觉醒=更亮一档 ARTIFACT_TINT）。RL2 性能红线未破。

### 验证
- `node --check src/weapons.js` 通过；`npx vite build --outDir .ns-build-22` 17 模块零错误(198ms)；e2e(test_game.py) 全 PASS、控制台零报错；渲染探针(`http://localhost:5173/?debug` → `window.__game.weapons` 装全 8 武器+8 神器、各触发基础+觉醒形态) 零报错截图确认差异可见（星/彗星/碎晶/残影/獠牙/血心/弩矢/结界纹/眼形/锯齿红环/红圈血钟）。红线未碰（未动 15 张 AI_OWNED、未跑 gen_assets.sh、未跑 `npm run build` 清 dist、仅改 src/weapons.js）。

---

## v2.1（2026-07-27 · `4f3f6a5437f6d90983243de96cb59e71b0cc64c0`）

> 纯美术热修：v2.0 新增的 8 件神器图标此前共用同一「纹章盾」底形（仅换色与内嵌元素），辨识度不足。本次按各神器名称/特性重绘为差异化剪影，配色与暗描边风格不变。

### 调整
- **8 件神器图标差异化重绘（`gen_assets.py` + `public/assets/art_*.png`）**：统一底形改为各自专属剪影——终焉 fatalis（八方罗盘星）、裁决 retribution（直立审判剑）、幻界 mirage（不对称碎晶簇）、堡垒 bastion（城塞垛口）、哨卫 sentinel（全视之眼）、灭世 cataclysm（战锤）、血契 bloodpact（缠棘血心）、赦罪 absolution（钟）。沿用各自原色板（琥珀金/绯红/紫青/钢青/翡翠/铁橙/深红/苍金）+ 统一 `outline()` 暗描边，与游戏其他 sprite 视觉一致。

### 修复
- **神器辨识度**：消除 8 图「同多边形」问题；重绘后 8 个 PNG 字节互异、均 80×80 RGBA，其余程序化资产逐字节不变（无意外漂移）。

### 验证
- `gen_assets.py` 重跑：8 图均 OK 生成（非 SKIP，确认不在 AI_OWNED），无报错；`git status` 仅 8 个 `art_*.png` + `gen_assets.py` 改动，其余资产零漂移。红线未碰（未动 15 张 AI_OWNED、未跑 gen_assets.sh、未跑 `npm run build`）。

---

## v2.0（2026-07-26 · `cc6986d0e1dc2a832a8cb2ebb92452dfd36e2b20`）

> 大版本跃迁：武器 8→16、神器 10→18。新增 8 件武器，各自 1:1 配对一件新神器（经 RECIPES 由「满级武器 + 对应被动」合成），神器觉醒效果门控于对应被动是否已持有。配套 D4 新武器发现加成、RL2 性能硬上限（enforceCaps）防掉帧、敌方眩晕与减伤机制。

### 新增
- **8 件新武器（src/data.js + src/weapons.js）**：星陨（starfall，追踪陨落）、审判（judgment，贯穿雷枪）、幻影（phantom，分身残影）、壁垒（aegis，哨卫环绕）、守望（warden，法球环绕）、重锤（maul，震荡波）、血怒（sanguine，吸血近战）、决意（resolve，符文爆发）。每件武器含 `mech` + `visual` 字段，开火逻辑落地 `fireHoming/fireThrust/fireSplitting/fireSentinel/fireOrb/fireShockwave/fireLifesteal/fireRune` 及对应 `update*` 桶更新。
- **8 件新神器（rarity:'normal'）**：终焉（fatalis）、裁决（retribution）、幻界（mirage）、堡垒（bastion）、哨卫（sentinel）、灭世（cataclysm）、血契（bloodpact）、赦罪（absolution）。经 RECIPES 与 8 个被动 critrate/critdmg/dodge/shield/shieldregen/armor/regen/guard 1:1 配对，由「满级对应武器 + 该被动」合成进化。
- **神器觉醒门控（`_awakened(weapon)`）**：新神器的 `tick*` 觉醒效果仅在玩家持有配对被动时启用（如裁决需 `shield`、哨卫需 `shieldregen`），基础神器不受影响，零误导。
- **敌方眩晕机制（src/entities.js）**：新增 `stunTimer`，敌人被控制时跳过移动逻辑（配合新武器控制效果）。

### 调整
- **D4 新武器发现加成（src/upgrade.js）**：`ownedWeaponKinds < 4` 时，8 件 v2.0 新武器在升级池中的 `weapon-new` 权重 ×1.5（`NEW_WEAPON_BOOST=1.5`），鼓励早期探索新武器；后期（`t>540`）新武器权重按 `(1-0.85*late)` 自然衰减，避免滚雪球。
- **减伤机制（src/entities.js）**：`absolutionDR` 字段接入 `takeDamage` 承伤链（`× (this.absolutionDR || 1)`），赦罪神器觉醒提供伤害减免。
- **图鉴（src/ui.js）**：武器图鉴 8→16 张、神器图鉴 10→18 张（四分类屏架构不变），新条目正常显示解锁态与配色标签。

### 优化
- **RL2 性能硬上限（`enforceCaps()`，src/weapons.js）**：`update(dt)` 末尾统一按桶 oldest-first 裁剪，杜绝后期掉帧——`PROJECTILE_CAP=600 / POOL_CAP=60 / BOLT_CAP=80 / VIAL_CAP=40 / SLASH_CAP=40`，环绕类 `MAX_SENTINELS=6 / MAX_ORBS=8 / MAX_SHOCKWAVES=12 / MAX_RUNES=24`，残影/爆发 `thunderRunes=24 / bursts=12 / mirageResidues=32`。压测（真实 8 武器+8 神器+~300 敌 8s）峰值远未触顶；溢出注入 2×cap+5 后 300ms 内所有桶精确裁剪至硬上限。
- **可访问性（src/assets.js）**：红/绿配对神器 裁决(retribution)/哨卫(sentinel) 仅靠色相易混淆，已通过亮度（luminance）差异区分，色弱玩家可辨。

### 验证
- `node --check` 全过；`npx vite build --outDir .ns-build-2x` 17 模块零错误；smoke（16/16 资产键、16 武器、18 神器、零 fatal）、stress（caps 全生效）、e2e（test_game.py 全 PASS、零控制台报错）三层独立验证通过。红线未碰（未动 15 张 AI_OWNED、未跑 gen_assets.sh、未跑 `npm run build` 清 dist）。

---

## v1.12（2026-07-26 · `75312ca3dd0cb802703fc6d91941ed2c704f0666`）

> 三处修复：① 钢铁意志 icon 重做（此前误改了暗夜铠甲，本次还原暗夜铠甲 + 重做钢铁意志）② 通关/返回主界面后宝箱指引圆圈不再残留 ③ 护盾不受击 3 秒后自然回盾。

### 修复
- **`public/assets/passive_guard.png` + `public/assets/passive_armor.png`：被动 icon 纠错（v1.9/v1.11 误改）**。此前把「钢铁意志」(passive id=`guard`) 误认成「暗夜铠甲」(passive id=`armor`)，实际改的是 `passive_armor.png`。本次：**`passive_armor.png` 还原为 v1.9 之前的暗夜铠甲原版**（git checkout v1.8 提交）；**`passive_guard.png` 重做**——ImageGen 生成亮银骑士盾+十字（亮度 177、质心居中清晰），`gen_passive_pixels.py` 走标准管线（key_bg 抠底 + 去水印 64 小连通域 + 像素化 + 描边 + 质心居中 + auto_brighten）。注：`passive_guard`/`passive_armor` 均属 AI_OWNED，本次为有意为之的主动重制，未跑 `gen_assets.py` 故不冲突。
- **`src/ui.js`：宝箱指引圆圈(loot beacon) 在通关/返回主界面后不再显示**。根因：`showTitle()`（ui.js:103）未调 `hideLootBeacon()`，返回主界面经 `game.showTitle()` 转场后 beacon 残留；且 `updateLootBeacon()` 仅按「有无宝箱」显隐。修复：`updateLootBeacon()` 顶部加非 `playing` 态直接隐藏并返回（ui.js:186）；`showTitle()` 内补 `this.hideLootBeacon()`（ui.js:108）。`showVictory`/`showGameOver` 原有隐藏逻辑保留。
- **`src/entities.js` + `src/data.js`：护盾不受击 3 秒后自然回盾**。根因：回盾条件 `this.shieldRegen > 0`（entities.js:80），而 `shieldRegen` 初始 0、仅「灵能回响」被动>0，故不带该被动时护盾永不回。修复：新增 `SHIELD_REGEN_BASE = 2`（盾/秒，[校准]）作为基础回盾速率；回盾条件改为 `maxShield>0 && hp>0`，速率 = `SHIELD_REGEN_BASE + shieldRegen`，仍受 `SHIELD_REGEN_DELAY=3` 秒受击打断门控、封顶 `maxShield`。满盾 20 约 10 秒回满（不含延迟）；带「灵能回响」后共 3.5/秒。

### 验证
- `vite build` 零错误（216ms）；`node --check` 三个 JS 文件全过；红线未碰（未动 15 张 AI_OWNED 其他图、未跑 gen_assets.sh、`passive_guard/armor` 重制经 gen_passive_pixels.py 不触发 gen_assets.py 覆盖）。

---

## v1.11（2026-07-26 · `ca3281d22e64949058c316af750a6e04be2e7fd2`）

> 重制暗夜铠甲 icon（亮底银盾，彻底解决"只有头部"观感）+ 游戏图鉴拆为 武器/被动/神器/怪物 四独立分类。（注：v1.11 时误把「暗夜铠甲」记成「钢铁意志」，v1.12 已更正）

### 修复
- **`public/assets/passive_armor.png` + `gen_passive_pixels.py`：暗夜铠甲 icon 重制**。`passive_armor.png` 由暗钢盔甲重写为亮底银盾 + 十字（亮度 48→197/255）；`gen_passive_pixels.py` 新增 `auto_brighten()`（Brightness/Contrast 兜底），armor 绕过 `key_bg`（亮底图 key_bg 会吃主体亮部）直接裁剪 bbox + LANCZOS 缩网格 + NEAREST 放大，质心偏移 (0.5,0.5) 居中清晰。
- **`index.html` + `src/ui.js` + `src/main.js` + `src/style.css`：图鉴拆为四独立分类**。武器图鉴副标题改「武器」（原「武器·被动·神器」）；新增 `#codex-passives` 屏（被动图鉴）；`ui.js` hub 菜单 cats 由 3 个（artifacts/monsters/weapons）扩为 4 个（+passives），`renderCodexArtifacts/Weapons/Monsters` 各自只渲染本类、`renderCodexPassives` 只渲染 passives；`main.js` 加 `btn-codex-passives-back`/`btn-codex-passives-topback` 事件绑定；`style.css` 屏幕规则/`#codex-hub`/`.gothic-btn`/touch 防御均加 `#codex-passives`。

### 验证
- `vite build` 零错误（`.ns-build-v11-final` 170ms）；红线未碰（未动 15 张 AI_OWNED、未跑 gen_assets.sh）。

---

## v1.10（2026-07-26 · `b3b234ed1807993475d6a942416df87e25216b36`）

> 升级卡「武器+被动→神器」合成路径提示（方案 A+B）：进化就绪金徽章 + 精炼配方行，以引擎 findEvolvableRecipe 为单一事实源、零误导、尊重隐藏配方。

### 新增

- 升级卡被动分支新增「进化就绪」金徽章（方案 A）：当且仅当选此被动后下一箱真会进化时显示 `⚡ 进化就绪 · 拾箱即合成 ✨<神器>`，hidden 未解锁显 `???`。
- 升级卡被动分支新增「精炼配方行」（方案 B）：`可合成 ✨<神器> = 满级🗡️<武器> + 本被动`，仅对有配方的 5 个被动显示、过滤已拥有神器、多目标截断「等 N 种」、无配方被动不渲染，默认开启（`SHOW_RECIPE_HINTS`）。

### 文档

- 新增设计分析 `design/plans/2026-07-26-synth-hint-design.md`（合成规则抽取 + 同类游戏调研 + A/B/C/D 方案与 UI 规格）。

---

## v1.9（2026-07-26 · `ba42a4ef4e97500266329153fcde0d95b50ee937`）

> 修复三处被动 icon 残留（致命专注/血色再生右下角水印、钢铁意志太暗）+ 初始护盾空槽 + 升级卡「选择」按钮位置。

### 修复
- **`gen_passive_pixels.py` + 3 张 icon：被动 icon 残留清理**。致命专注（critrate，右下角「CRIT」水印→红准星）、血色再生（regen，右下角「CRD」水印→红心光晕）经 ImageGen 重生成 + 去水印三重保障（critrate 清 193 个水印连通域、regen 清 10 个），主体偏移 <2px、零文字；钢铁意志（armor，原图过暗不可辨→亮钢盔甲，prompt 强约束 VERY BRIGHT/HIGH CONTRAST）。
- **`src/entities.js`：初始护盾满值**。`Player` 初始化 `maxShield`/`shield` 从 `0/0` 改为 `20/20`，开局护盾条即满（不再是空槽），对齐 S 档「护盾 HUD 常驻」设计。
- **`src/upgrade.js` + `src/style.css`：升级卡「选择」按钮右置**。`pickBtn` 从 `.uc-body` 内部（文字下方）移到 `#upgrade-card` 直接子级，与 icon/文字区形成 `[图标] [文字] [选择]` 三栏横排；`.upgrade-card` 桌面端统一 `display:flex; flex-direction:row`（与移动端一致），`.uc-pick` 加 `flex-shrink:0; white-space:nowrap` 不被挤压。

### 验证
- `vite build` 零错误；3 张 icon 质心偏移 <2px（脚本自检全 PASS）。

---

## v1.8（2026-07-26 · `d59714ce6f6a3e2de9f6e8ada08555ac5951db28`）

> 修复两处回归：① v1.6 把升级卡改成纯纵向堆叠，移动端/桌面端丢失「icon + 文字 + 按钮」横排；② 7 张被动 icon（ImageGen 强制右下角水印「图片由AI生成」/旧版英文残留）致主体偏左上角不居中、图鉴与���化选择均偏移。

### 修复
- **`src/style.css` + `src/upgrade.js`：升级卡恢复横向布局**。`touch-device .upgrade-card` 改回 `display:flex; flex-direction:row; align-items:center; gap:14px`（icon 左 + 文字右）；`upgrade.js` 把 tag/h3/p/pickBtn 包进新增 `.uc-body` 容器，内部文字纵向排列不挤压，彻底规避 v1.6 移动端竖向文字问题。
- **`gen_passive_pixels.py`：被动 icon 去水印 + 质心居中三重保障**。① `remove_watermark()` BFS 连通域分析，保留最大连通域（主体图标）、删角落小面积孤立域（水印文字）；② COM 质心居中替代按尺寸居中；③ `recenter_com()` 最终 80×80 输出再做质心兜底。覆盖 heart/greed/guard/magnet/shieldregen/critdmg/dodge 共 7 张（右下角「图片由AI生成」/英文水印已清除），主体偏移量全部 <4px、居中清晰。

### 验证
- `vite build` 零错误；7 张 icon 质心偏移 <4px（脚本自检全 PASS）。

---

## v1.7（2026-07-26 · `8ba95573442b34d9b667246e644af25a5ce23faf`）

> 五大神器「双硬指标」重校（直伤 ≥ 满级原武器 ×1.3、含专属机制总效能 ≥ ×1.6）+ 视觉强制区分，根治「进化没提升 / 看不见」反馈。性能红线：所有新渲染分支零 per-frame shadowBlur（统一走离屏缓存辉光贴图 + additive）。

### 优化
- **crimson 猩红之拥**：弹幕 count 2→4、damage 32→35、pierce 2→3（直伤 DPS 256→840，≈ blade L5 的 1.62×）；渲染改缓存辉光 + 猩红菱形，移除 shadowBlur；ARTIFACTS 描述去掉「伤害翻倍」不符措辞。
- **matrix 圣光矩阵**：mxTimer 1.2→0.8、damage 30→40（直伤 DPS 600→1200，≈ cross L5 的 1.67×）；新增常驻八向星纹 sigil（预渲染一次缓存、旋转绘制），解决「看不到范围 / 弹幕」。
- **reaper 亡魂收割者**：镰刀 n 3→4、REND_DPS 12→16、REND_HARVEST_HP 3→4（直伤 DPS ≈ scythe L5 的 1.47×，含撕裂 DOT + 收割回血总效能 ≥ ×1.6）；加 reaper 标记 + 紫魂辉光大号镰刀，与基础骨白绿镰强区分。
- **devour 圣洁吞噬**：radius 110→140（探出亡灵光环满级 162 内侧）、damage 16→34（直伤 DPS 40→85，≈ holywater L5 的 1.42×）；环改圣金白配色 + 缓存辉光、伤害飘字转金，不被红环遮罩。
- **tempest 雷劫**：移动阈值 60→42、新增 0.35s 静止兜底、damage 30→56、chains 2→4、chainRange 160→200（走位 DPS ≈ lightning L5 的 2.22×、站桩 1.33×）；strikeLightning 加 color 参数（雷劫紫电 #b07cff / 雷霆循环金雷 #ffd76e）彻底区分，雷劫行经落雷印 AoE（对象池上限 24）；bolt 移除 shadowBlur=12 改缓存辉光。
- **stormcall 雷霆循环**：数值不变（已 2.31×），仅补金雷色区分。
- **性能基线**：新增统一 getGlowSprite(colorKey,size,color) 缓存辉光 helper；matrix sigil 预渲染一次；tempest thunderRunes 对象池（≤24）无逐帧 new；所有光晕 additive。存量 3 处基础 cross/blade/scythe 渲染 shadowBlur 与红环 drawRedAuraRing 非本次范围，留后续 hotfix。

## v1.6（2026-07-26 · `6643b93089668486922732bed2ea907b0e1a4fd7`）

> 升级卡 UI 一致性 + 移动端适配修复：① 强化选择时 13 个被动 icon 与武器 icon 渲染不统一（风格/尺寸双不一致）；② 移动端升级卡文字被横向 flex 压成竖向窄条。

### 修复
- **`src/upgrade.js`：升级卡 icon 统一渲染**。原武器走 `<img>`（`.upgrade-card img`：84×84、灰边、暗底、object-fit:cover），被动却走 `passiveBadge()`（分类彩边发光 div、object-fit:contain）——同卡两套风格；移动端武器被压 56px 而被动徽标仍 84px，尺寸也不一致。现把武器/被动双路渲染合并为单一 `<img>`（共用 `sprite(info.icon)`），两者完全一致。（`passiveBadge` 方法保留，仍供装备栏 HUD 与图鉴 codex 使用。）
- **`src/style.css`：移动端升级卡文字竖向 bug**。`.touch-device .upgrade-card` 原设 `display:flex`（横向），使卡内 icon+标签+标题+描述+按钮全挤进同一行 → 文字被压成竖向窄条。改为纵向堆叠（`text-align:center`，移除 `display:flex/align-items/gap/text-align:left`），修复后恢复正常的纵向卡片布局。
- **`src/style.css`：清理死规则 + 版本横幅移动端防御**。删除升级卡不再使用的 `.uc-badge` 规则（保留 `.passive-badge`/`.codex-badge`/装备栏规则）；为 `#update-prompt` 补 `.touch-device` 移动端规则（安全区 padding、`.up-inner` 换行、文字/按钮居中），避免版本更新横幅在手机上溢出。

### 验证
- `vite build` 零错误；e2e 升级相关用例（升级三选一流程 / 武器图鉴被动13张 / 卡片总数31）全 PASS。（注：e2e 套件存在固有时序抖动，偶发 1–2 条失败为已知现象、与本次改动无关。）

---

## v1.5（2026-07-26 · `96bdff68de86f32be0d518aec5a5144923e3b431`）

> 修复微信浏览器下护盾条不可见问题：根因并非缓存，而是 `maxShield===0` 时护盾条被 `class="hidden"`（`display:none!important`）整条隐藏，新开局未拿护盾被动即完全看不到。

### 修复
- **`index.html`：`#shield-bar` 移除初始 `class="hidden"`**，护盾槽改为常驻渲染（无护盾时显示暗蓝空槽）。
- **`ui.js` 护盾更新逻辑改造**：去掉 `classList.toggle('hidden', !hasShield)` 的显隐门控，改为始终按 `shield/maxShield` 比例刷新 `#shield-fill` 宽度（无护盾时为 0% 空槽）；并加 `this.shieldBar` / `this.shieldFill` 的 null 守卫，防止微信 X5 缓存旧 HTML（缺 `#shield-bar` 元素）时每帧 `classList` 报错拖垮整个 HUD 更新循环。
- **CSS 确认**：`#hp-wrap` 无 `overflow:hidden`，`#shield-bar` 的 `bottom:-11px` 负偏移不会被裁切；空槽 `#16202b` 暗蓝底 + 青色描边/辉光，0% 时亦可见。

### 说明
- 缓存非主因：`public/_headers` 早已对 `/` 与 `/index.html` 设 `Cache-Control:no-store`，微信每次都会重拉最新 HTML；构建产物 JS 文件名带哈希，天然防缓存。故无需改动缓存策略。
- 验证：`vite build` 零错误；e2e **ALL PASS**（无控制台报错）；13 张被动 PNG dev server 全 200。

---

## v1.4（2026-07-26 · `21cbb2e3dfc5e10cc848af28767157a833034403`）

> 被动 icon 全面升级：从 8×8 CSS box-shadow 方框替换为 AI 文生图 + Pillow 像素化管线生成的 80×80 哥特像素 sprite。

### 新增
- **被动 icon AI 管线**：`gen_passive_pixels.py`（AI PNG → 众数背景键控 → 40 网格像素化 → NEAREST 2x → 1px 暗描边 → 80×80 RGBA），对齐武器/神器规格。13 张 `passive_*.png` 全部由 ImageGen 生成 + 脚本后处理。
- **assets.js 注册 7 个新 key**：`passive_regen/critrate/critdmg/shield/shieldregen/armor/dodge`（原仅 6 个旧被动）。
- **`regen.icon` 从 `potion` 改为 `passive_regen`**（不再复用药水瓶贴图，拥有专属图标）。
- **`gen_assets.py` AI_OWNED 扩容**：13 个 `passive_*.png` 加入保护集，防止程序化生成器覆盖 AI 美术。

### 调整
- **`ui.js passiveBadge()` 渲染改造**：从 `<i class="pb-sprite">`（CSS box-shadow 拼 8×8 ASCII）改为 `<img>`（取 `passive_<id>.png`，`image-rendering:pixelated`）。删除 `PASSIVE_PIXELS`/`PX`/`spriteShadow` 死代码（~90 行）。
- **CSS 适配**：`.passive-badge img` 新增 `width:100%;height:100%;object-fit:contain;image-rendering:pixelated`；移除 `.pb-sprite` / `--pb-px` 变量体系。

### 清理
- 删除孤儿文件 `passive_rage.png`、`passive_swift.png`（旧合并被动残留，无代码引用）。

### 测试
- e2e 全量回归 ALL PASS（零控制台错误）；13 个 passive PNG dev server 200 验证通过。

---

## v1.3（2026-07-26 · `14b054ecc1a5efd4d97194b4a9467e7fc1b1d28f`)

> 修复桌面端缺失的暂停入口；护盾机制实测无 bug。

### 修复
- **桌面端暂停按钮缺失**：原桌面 HUD 仅有键盘 Esc/P 暂停入口、无可见按钮（触屏端 `#touch-pause-btn` 正常），用户反馈"界面上的暂停功能不见了"。新增 `#btn-pause`（右上角，紧邻静音按钮左侧，`z-index:50`），点击 `playing` 态下 `togglePause()`；`.touch-device` 下隐藏（避免与触屏暂停按钮重复）。暂停层提示补"或点右上角 ⏸"。
- 护盾机制（受击扣盾不扣血 / 受击 3s 内不回盾 / 3s 后自动回盾 / 封顶 maxShield）经 Playwright 实测**全部通过，无 bug**；`SHIELD_REGEN_DELAY=3`、`lastHitTime=-999` 初始化正确。

### 测试
- 双端暂停 Playwright 实测：桌面 `#btn-pause` 存在/可见/点击暂停生效/点继续恢复 + Esc 兼容；触屏 `#touch-pause-btn` 存在/可见/点击生效；护盾 4 项断言全 PASS。e2e 全量回归 ALL PASS（零控制台报错）。

---

## v1.2（2026-07-26 · `56364207f46ef011e25bdfece4d3c4ac98ce660c`）

> 护盾条 HUD 视觉修复（高度 + 颜色）。

### 修复
- **护盾条高度**：`4px → 8px`（原太窄肉眼难以辨识），`bottom: -7px → -11px` 保持紧贴 HP 条下方。
- **护盾条颜色**：空槽从 `#2a2a33`（普灰）改为 `#16202b`（暗蓝）+ 淡青边框；盾量段从暗海军蓝 `#1a4a8a→#5ac8fa` 改为亮青渐变 `#19b6ff→#7ef0ff` + `.85` 发光，与红色 HP 条形成清晰冷暖对比。

### 测试
- e2e ALL PASS（零控制台报错）；桌面/触屏双尺寸 Playwright 截图核验。

---

## v1.1（2026-07-26 · `2dc7f04`）

> 被动程序化 CSS 徽标视觉重设计（D5 落地细化）。方案：维持零 PNG 程序化路线，按现有哥特像素美术标准重绘 13 个被动 icon。

### 优化
- **被动徽标从「单字 + 色块」升级为 8×8 像素 sprite**：`ui.js` 移除 `PASSIVE_BADGE_SYMBOL`（汉字表），新增 `PASSIVE_BADGE_PIXELS`（13 个被动各一 ASCII 像素图）+ `passiveBadge()` 用 `box-shadow` 从像素图逐格拼出图形，纯 CSS、零 PNG、保持 `image-rendering: pixelated` 美术一致性。
- **哥特画框统一**：徽标外层暗底径向渐变 + 分类色边框微光（offense 金 / survival 青绿 / utility 钢蓝），与游戏升级卡/图鉴既有的像素框语言对齐。
- **三档缩放变量 `--pb-px`**：升级卡 6px、图鉴 3.5px、HUD 装备栏 3px，单套 sprite 适配全部落点（升级卡 / 装备栏 / 图鉴被动卡 / 结算屏）。
- 13 个 icon 语义：疾行之靴(靴)/巨人之心(心)/秘法魔典(书)/引力宝珠(磁铁)/财富之魂(金币)/钢铁意志(盾)/血色再生(血滴)/致命专注(准星)/毁灭之刃(剑)/幽能屏障(能量盾)/灵能回响(循环箭头)/暗夜铠甲(盔甲)/魅影身法(幽灵)。

### 测试
- e2e 全量回归 ALL PASS（零控制台报错）；`node --check` 改动 JS 全过；本地 Playwright 截图核验 13 个 icon 全部可辨识。

---

## v1.0（2026-07-26 · `1e20a0115bd82da06063a40d1ecd655b223e8bea`）

> 大版本 S 档（属性面板 + 被动扩展）。方案：主方案 v1.1（D1~D5 决议）；工程 GDD 同步 v1.1。

### 新增
- **9 属性角色系统**：承伤四段顺序固定为 闪避 → 防御 `max(1,(raw-armor)×damageTakenMul)` → 护盾 → 扣血（`entities.js takeDamage`）；新增 `critChance/critMul/shield+maxShield/shieldRegen/armor/dodgeChance` 六字段，基础暴击率 0.05 / 暴击伤害 1.5 / 闪避硬上限 / 护盾受击打断 3s。
- **暴击接入战斗**：`weapons.js hitEnemy()` 统一走 `player.rollCrit()`，所有直伤点（含 aura/whip/lightning/投射物/pool/sepulcher）接入；DOT 每 tick 独立 roll。`systems.js` 暴击飘字金字放大 +「暴击 」前缀（14/帧节流）。
- **6 个 S 档新被动**（均 ML5，默认全开放入池）：致命专注（暴击率 +5%/级）/ 毁灭之刃（暴击伤害 +15%/级）/ 幽能屏障（护盾 +20）/ 灵能回响（护盾恢复 1.5/s）/ 暗夜铠甲（防御 +2）/ 魅影身法（闪避 +4%/级）。
- **属性面板 UI（`#stats-panel`）**：暂停内嵌「属 性」按钮（Tab/C 切换，状态保持 paused）+ 结算屏「本局最终属性」区块；两列网格展示核心 9 项 + 衍生 7 项（`ui.js _collectStats/_collectStatsExtra/renderStats`）。
- **护盾条（D4）**：`#shield-bar` 置于 HP 条下方独立灰底（`#2a2a33`）细条 + 蓝色盾量段，首次获得护盾才显形（`ui.js update` 走 `_hudCache`）。
- **程序化 CSS 徽标（D5，零新 PNG）**：被动/属性 icon 全走 `PASSIVE_BADGE_SYMBOL` + `.passive-badge`（按 category 着色 offense/survival/utility），升级卡 / 装备栏 / 图鉴被动卡 / 结算屏统一复用；未碰 AI_OWNED 15 张、未跑 `gen_assets.sh`。

### 调整
- **同类被动合并（D3）**：删 `swift`/`rage`，`boots` 吸并移速（+6%/级·ML99）、`tome` 吸并全伤（+8%/级·ML99）；被动总数 7 → 13。
- **升级池分类权重（D3）**：候选被动权重 `w = 1 + 0.6·catCount[category]`（catCount=已投该系等级和）；保底改为**池中有武器时优先武器**（保证每层可拿武器），仅当无武器可给时退化为进攻向被动（防"三张全生存向"卡 build）。
- 图鉴被动卡由 `<img>` 改为 CSS 徽标（与新被动无 PNG 一致）；图鉴卡片总数 27 → 31（8 武器 + 13 被动 + 10 神器）。

### 修复
- **升级卡渲染崩溃**：`upgrade.js open()` 被动分支引用未定义 `img`（`ReferenceError` 致升级界面白屏），改为被动走徽标、武器/神器走 `<img>`，二者各自 append。
- **A8 孤儿引用清理**：`assets.js` 移除 `passive_rage`/`passive_swift` 两项已删被动的 files-map 条目（PNG 仍留盘但无引用）。

### 测试
- e2e 全量回归 ALL PASS（零控制台报错），含权重配额、分类权重公式、长鞭去重、属性面板、护盾条、图鉴 31 卡、暴击飘字等新增断言；`node --check` 改动 JS 全过。
- 注意：`test_game.py` 中「狼群/爆破」词缀断言为 RNG/时机敏感偶发抖动（词缀系统 2026-07-24 既有，与 S 档无关），非 S 档回归。

---

## v0.39（2026-07-26 · `a8828af`）

### 修复
- **圣光矩阵合成后严重掉帧（性能）**：`weapons.js` matrix 投射物渲染原每帧 `ctx.shadowBlur=18` + 加法合成——`shadowBlur` 是 Canvas2D 头号性能杀手，dpr=2 下模糊面积×4 → 高分屏严重掉帧。改为一次性缓存的径向辉光贴图（`getMatrixGlowSprite()`）+ 加法合成，与 `systems.js` 宝箱辉光同源手法，零逐帧模糊；观感基本一致。
- **宝箱指引圆环圈不住宝箱 / 箭头偏位（坐标缩放）**：`ui.js updateLootBeacon()` 缩放因子误用 `rect.width / canvas.width`，而画布内部分辨率 = `LOGICAL×dpr`、世界坐标为逻辑像素 → 高分屏(dpr=2)下环/箭头整体缩到约一半位置。改为 `÷ CONFIG.LOGICAL_WIDTH/HEIGHT`，环直径 `chestSize*sx*1.4` 与箭头位置一并修正。dpr=1 测试机此前掩盖此 bug。

### 说明
- 「未选秘法魔典却合成圣光矩阵」非代码 bug：matrix 配方硬要求被动 `tome`（实名「秘法魔典」，+10% 全伤，maxLevel 5），且进化在开任意宝箱时**自动触发**（`game.js onChestOpened`）。玩家持有秘法魔典（口称"魔法秘典"）+ 黎明圣印满级时开宝箱即自动合成，并不点选。若希望进化改为显式确认，属设计变更，另行评估。

### 测试
- e2e 全量回归 ALL PASS（零控制台报错）；`node --check src/weapons.js`、`node --check src/ui.js` 通过；宝箱指引屏外箭头/旋转、屏内脉冲环断言均过。

---

## v0.38（2026-07-26 · `a9435b8`）

### 新增
- **永劫之鞭扩展特效（补全 v0.36 规格 §3.1/§3.3）**：① 残影光晕——挥砍时 additive（`globalCompositeOperation='lighter'`）鎏金残影描边（#d4af37）；② 命中火花——eternalwhip 命中迸 6×余烬金(#f1c40f)+3×白热高光(#fff1c9) 火花；③ 主题伤害数字——eternalwhip 伤害数字呈鎏金色(#e0a93b)。三项均 gate 在 `sl.tint` 存在性上，基础噬魂长鞭（无 tint）仍为粉色、无火花无光晕，向前兼容零变化。`ETERNALWHIP_TINT` 扩为 7 键（新增 sparkHot/dmg）。

### 测试
- e2e 全量回归 ALL PASS（零控制台报错）；`node --check src/weapons.js` 通过；无新 PNG / assets.js 未动。

---

## v0.37（2026-07-26 · `71cbf72`）

### 新增
- **第 10 神器「亡魂收割者 Reaper's Scythe」**：新增 scythe 武器（亡魂镰刀，回旋镰刀投射物=大范围回旋镰斩）+ reaper 神器（由 scythe 武器 + 贪婪之魂 被动进化）。觉醒后 scythe 攻击追加：① 撕裂 DOT（rend，命中施加持续掉血）；② 收割回能（被 scythe/rend 击杀归还少量生命）。两项觉醒效果均门控 `hasArtifact('reaper')`，基础 scythe 不受影响。骨白 #e8e0c0 + 幽魂绿 #7fff9f 专属配色。
- 资产：`weapon_scythe.png`（80×80）/`art_reaper.png`（80×80）程序化生成（art 提交 `0ee4b80`），md5 校验 15 张 AI_OWNED 字节不变。

### 优化
- 数值（镰刀数量 / 伤害 / rend dps / 收割回血量）标 `[PLACEHOLDER]`，待真机校准。

### 测试
- e2e 全量回归 ALL PASS（零控制台报错）；`node --check` 改动 JS 全过；`test_game.py` 新增 `scythe→greed→reaper` 进化路径断言。

---

## v0.36（2026-07-26 · `594785e`）

### 新增
- **永劫之鞭专属配色（熔金黑鞭）**：打通此前缺失的 tint 链路——`applyWhip` 新增第 5 参 `tint`，`ETERNALWHIP_TINT`（鞭身主色 #ffb847 / 青铜描边 #4a2f12 / 尖端高光 #fff1c9 / 拖尾 #d4af37 / 火花 #f1c40f）仅在 eternalwhip 觉醒时上色；render 的 slash 描边与尖端高光改 tint 感知，基础鞭不传 tint 仍走原粉色，向前兼容零变化。无需新增 PNG，纯 canvas stroke 着色。

### 测试
- e2e 全量回归 ALL PASS（零控制台错误）；`node --check src/weapons.js` 通过。

---

## v0.35（2026-07-26 · `9057ca2`）

### 新增
- **宝箱指示箭头改用 PNG 精灵**：`#loot-arrow` 由纯 CSS 三角改为 `<img>` 引用 `loot_arrow.png`（32×32 金箭头带尾翼，默认朝右），方向性与哥特细节显著增强；`ui.js` 的 `rotate(angle)` 旋转与 `left/top` 定位逻辑完全保留，`style.css` 去除 border 三角写法、改 `width/height:32px` + `drop-shadow` 辉光 + `image-rendering:pixelated`。

### 修复
- **宝箱指示圆环圈不住宝箱（#195）**：`#loot-ring` 固定 52px 改为在 `updateLootBeacon()` 屏内分支按 `宝箱屏显尺寸(普通40/boss48) × CSS缩放 sx × 1.4` 动态设直径（系数 > pulse 峰值 1.12，任意呼吸相位都圈住），放大屏与 boss 宝箱均不再漏圈；`style.css` 去固定尺寸、加 `box-sizing:border-box`。
- **石像鬼/暗影猎手不掉高价值宝石（#196）**：`drop()` 新增第 4 参 `enemyType`，石像鬼强制掉金宝石（gemGold，价值 25）、暗影猎手强制掉红宝石（gemRed，价值 50）；其余怪维持原 `expValue` 选档逻辑零改动，100% 掉落不变。

### 优化
- **chest/gem 资产增强**：`chest.png` 重做为像素哥特木箱（金属包边/铆钉/锁扣/金光封印）；`gem_gold.png`/`gem_red.png` 升级 premium 版（更强内核辉光 + 四角星芒，怪潮中明显区分低档宝石）。

### 测试
- e2e 全量回归 ALL PASS（零控制台错误）；`node --check` 改动 JS 全过；`vite build` 确认 dist 含 `loot_arrow.png`/`chest.png`/`gem_*`/`version.json`。

---

## v0.34（2026-07-26 · `594ce29`）

### 修复
- **高价值经验宝石缺精灵图（红/金宝石显示为纯色圆点）**：`GEM_DEFS` 定义 5 档（绿/蓝/紫/金/红），但 `assets.js` 仅映射 `gemSmall/Medium/Large` 三张 PNG，缺少 `gem_gold.png` / `gem_red.png`；渲染逻辑找不到图时 fallback 画实心圆。红点=价值 ≥50 的 `gemRed`（暗影猎手/终局召唤掉落），交互与宝石一致但视觉为纯色圆，易与特效混淆。修复 = ① `gen_assets.py` 用 `gen_gem()` 补齐两张程序化菱形宝石精灵（金 `#d4af37` / 红 `#e74c3c`，72×72）；② `assets.js` 补 `gemGold`/`gemRed` 映射。

### 测试
- e2e 新增 `gemGold/gemRed` 键存在 + 文件以 `image/png` 200 返回断言；全量回归 ALL PASS（零控制台错误）。`gen_assets.py` 重跑验证：仅新增两张、其余 73 张 png 字节一致（AI_OWNED 未误改）。

---

## v0.33（2026-07-25 · `c672432`）

### 修复
- **微信打开首页不提示更新（运行时版本自检失效）**：根因为微信 X5 内核无视 `Cache-Control: no-store`，按其「按完整 URL 命中」的应用级缓存回旧 `version.json`，导致与旧 HTML 内联 `__BUILD_ID__` 同源 → 自检判定无更新 → 不弹横幅（需手动刷新才更新）。修复 = `src/version-check.js` 的 fetch URL 加唯一时间戳 query（`/version.json?t=Date.now()`）做缓存击穿，X5 必走网络拿最新版本清单 → 正确触发「发现新版本」横幅。

### 优化
- **版本自检周期复检**：`initVersionCheck` 内新增 `setInterval` 每 90s 复检一次，长开页面的玩家在后台发版后也能被提示，不再依赖「下次打开」。

### 测试
- e2e 将 version.json 断言改为带戳 URL（`/version.json?t=...`）端到端验证；全量回归 ALL PASS（零控制台错误）。

---

## v0.32（2026-07-25 · `b7a1af6`）

### 调整
- **爆破（volatile）词缀死亡爆炸范围扩大**：`blastRadius` 100 → 140，伤害判定与视觉特效同步放大，提升词缀存在感与威胁。
- **爆破冲击波特效视觉重调**：颜色由橙红 `#ff7a33` 改为亮黄 `#ffcc00` + 淡橙半透明填充 + 虚线描边，明显区别于红宝石/掉落物，解决玩家把爆炸环误当成红色宝石的混淆。
- **经验宝石出生闪光**：新掉落的普通经验宝石在 0.35s 内带金色收缩环，在爆炸与怪潮中更醒目，避免玩家错过 affix 怪掉落的宝石。

### 修复
- **排查特殊属性怪物「不掉宝石」现象**：复核 `entities.js` 词缀生成、`createEnemy` 的 `expValue` 计算（已按 `affixDef.expMul` 倍率）、`game.js` 的 `onEnemyKilled` → `pickups.drop` 链路，确认 `volatile`/`shielded`/`pack` 死亡均会正常掉落经验宝石；问题主要是爆炸环颜色与红宝石相近 + 小宝石被爆炸遮挡所致，已通过视觉调整与出生闪光改善。

### 测试
- e2e 全量回归 ALL PASS（零控制台错误），含词缀怪渲染、爆破特效触发、宝石过期等既有断言。

---

## v0.31（2026-07-25 · `537136b`）

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
