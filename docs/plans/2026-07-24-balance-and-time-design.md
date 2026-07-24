# 夜裔幸存者 · 平衡校准 + 终局时间机制 + Boss 技能节奏（Phase 1 概念方案）

> 版本: v0.1 | 日期: 2026-07-24 | 阶段: **概念方案（仅设计，未实现）**
> 负责人: 设计策略（design-strategist） | 任务号: DESIGN-BALANCE-01 | 优先级: high
> 约束: **纯方案文档，不修改任何源码**。所有数值为"默认建议 + 真机校准"，非终值。

---

## 0. 设计支柱与自洽约束（贯穿三章）

引用已确认《终局平衡设计文档》(v1.0) 的五大支柱：

1. **玩家强，但世界更强** — 玩家成长是乘法，敌人威胁也是乘法。
2. **每个神器都是军备竞赛** — 神器不是"无敌"，而是"强了，世界也注意到了"。
3. **15 分钟一个心跳** — 准备期 → 高压期 → 终局决战，结束即结算。
4. **后期升级不停** — 经验经济随时间缩放，升级频率不衰减。
5. **行为多样化 > 数值膨胀** — 后期怪不是"更硬"，而是"更烦"。

**自洽链条（本方案必须串起来的一条 15 分钟心流曲线）**：
```
刷怪斜率(hpSlope/dmgSlope) → 玩家 DPS 成长(武器满级+神器) 
   → 经验曲线(expScaleForTime) 保证 ~12min 前凑齐满 build 
   → 9min 永夜加深(nightBase) 制造压力爬坡 
   → 12min avatar 降临(ENDGAME_BOSS_TIME=720) 
   → 180s 窗口(→900) 内以"生存"而非"DPS"为约束讨伐 
   → 15min 硬上限(GAME_HARD_CAP=900) 超时失败兜底
```
所有占位符数值都必须落回这条曲线，不能孤立拍脑袋。

> ⚠️ **跨文档冲突提示（需主理人拍板）**：本方案将 `ENDGAME_BOSS_TIME` 由 `900` 改为 `720`，与已确认《终局平衡设计文档》v1.0 第 3.1 节"时间到达 15 分钟 (900s)……降临"直接冲突。若确认采用本方案，应同步修订该文档第 3.1 节与第 2/6 节相关描述。

---

## 一、数值校准方案

### 1.1 占位符盘点表（11 处）

| # | 文件:行 | 当前占位语义（读源码核对） | 影响系统 | 校准优先级 |
|---|---------|--------------------------|----------|------------|
| 1 | `src/systems.js:50` | 血瓶 `dropPotion(x,y,heal=20)` 的 `heal` 默认 20（注释标 [PLACEHOLDER]） | 续航 / 生存 | **P1** |
| 2 | `src/game.js:45` | 装饰密度 `COUNT=150`（注释"120~180 可微调"） | 视觉通透度 / 低端机性能 | **P2** |
| 3 | `src/game.js:313` | 血瓶掉率 `Math.random() < 0.025`（已从 0.07 压低） | 续航 / 难度 | **P1** |
| 4 | `src/upgrade.js:59` | 后期升级池权重 `W`（weaponUp/passiveUp/weaponNew/passiveNew） | 成长曲线 / build 成型 | **P1** |
| 5 | `src/data.js:16` | `SOUL_REWARDS` 每 30s/20杀/每级/每 Boss 发放量（注释标全部占位） | 元进度 / 灵魂通胀 | **P1** |
| 6 | `src/data.js:28` | `ALTAR` 祭坛 cost（**读源码发现已填值 60~220**，注释标占位，疑似已失效标记） | 元进度 / 长期循环 | **P2** |
| 7 | `src/data.js:115` | 爆破词缀 `blastRadius:70 / blastDamage:18` | 词缀威胁 / 永夜阶段难度 | **P2** |
| 8 | `src/data.js:169` | 三把新武器 `aura/whip/cross` 满级数值 | 武器平衡 | **P1** |
| 9 | `src/data.js:217` | 续航被动 `regen` 0.8/级（满级 4 HP/s） | 续航 / 长期生存 | **P1** |
| 10 | `src/data.js:226` | 经验时间缩放系数 `0.08`（`expScaleForTime`） | 成长 / 核心循环（P0 级影响） | **P0** |
| 11 | `src/data.js:248` | `BLOODLINES` cost / 偏向幅度（注释标全部占位） | 元进度 / 起手差异 | **P2** |

> **源码核对重要发现（避免重复劳动）**：
> - **#6 ALTAR cost 已填**（60/90/130/160/220/150/150），`[PLACEHOLDER]` 注释是**过期标记**，本方案按"已填、仅需真机微调"处理，不再当空白。
> - **#5 SOUL_REWARDS 的 per30s/per20Kills/perLevel/perBoss 字段实际未被使用** —— `game.js:computeSoulReward` 用的是 `时间/终局×500 + 等级×1 + 首通` 公式（见 `game.js:366`）。这些字段是**死代码/待接线**。本方案建议：要么删掉闲置字段、要么真正接上"按行为发放"，避免误导后续维护。

### 1.2 初始建议值区间（重点项 + 全 11 项）

下列区间均**落在项目现有数值量级内**，并标注"为什么是这个区间"。

#### 1.2.1 重点先定项

**(A) Boss HP 各难度基准**

> 源码现状：仅 `avatar` 乘 `bossHpMul`（0.7/1.0/1.4），`baron/queen/overlord` 的 HP **不随难度缩放**（无论 easy/hard 都是 1800/4500/9000）。这与"三难度同机制同公式仅数值区分"的设计目标不一致。

**建议**：对所有 Boss 统一乘 `bossHpMul`（需改 `entities.js:spawnBoss`，见 §二.4），基准=normal 原值：

| Boss | easy(×0.7) | normal(×1.0) | hard(×1.4) | 理由 |
|------|-----------|-------------|-----------|------|
| baron | 1260 | 1800 | 2520 | 3min 登场，玩家 DPS 约 200~400，击杀 6~10s，符合"快 DPS 检验" |
| queen | 3150 | 4500 | 6300 | 6min，DPS 约 400~700，击杀 8~12s |
| overlord | 6300 | 9000 | 12600 | 9min，DPS 约 700~1100，击杀 10~14s |
| avatar | 10500 | 15000 | 21000 | 12min 终局，见 §二.3 窗口评估 |

理由：本作 Boss 均为"数十秒级 DPS 检验"（参考同作其他 Boss 击杀时长），HP 量级须与玩家各时段 DPS 量级匹配（DPS 估算见 §二.3）。

**(B) 永夜指数 `nightBase`**（现有 1.22/1.35/1.50）

| 难度 | 现有值 | 建议 | 理由 |
|------|--------|------|------|
| easy | 1.22 | **保持 1.22** | 15min 时 D=6，`1.22^6≈3.3`，叠 artifactCounter(0.08×3×6=1.44) → 总 ×7.6，压力温和 |
| normal | 1.35 | **保持 1.35** | `1.35^6≈6.05`，叠 artifact → ×22，压力陡但可控，符合"世界更强" |
| hard | 1.50 | **保持 1.50** | `1.50^6≈11.4`，叠 artifact(0.25×3×6=4.5) → ×63，专为高手，符合预期 |

> 结论：nightBase **无需调**，已是合理指数。保留，真机仅微调 ±0.03 容差。

**(C) 经验曲线系数**（P0，`expScaleForTime` 的 0.08）

| 参数 | 现有 | 建议默认 | 范围 | 理由 |
|------|------|----------|------|------|
| 系数 k | 0.08 | **0.08** | 0.06~0.10 | `1+(t/60)*k`：10min×1.8、15min×2.6。须保证玩家 ~12min 前凑齐 6 武器满级+神器，使 avatar 战是"满功率决战"。若 playtest 显示 12min 仍武器未满 → 上调至 0.10~0.12；若过早满级无事可做 → 下调至 0.06。 |

**(D) 血瓶 heal / 掉率**（续航双支柱，与 regen 被动联动）

| 参数 | 现有 | 建议默认 | 范围 | 理由 |
|------|------|----------|------|------|
| heal(`systems.js:50`) | 20 | **20** | 18~30 | 占 maxHp(100~200) 的 10~20%。刚把掉率从 0.07→0.025 是为"降续航压难度"，heal 不宜再高，否则回血不可逆挫败再现 |
| 掉率(`game.js:313`) | 0.025 | **0.025** | 0.02~0.04 | 约每 40 杀 1 瓶。死亡频率高 → 上探 0.035；过易 → 0.02。与 regen(§D)、嗜血者吸血三者叠加监控，防"掉血不可逆"反转成"无敌" |

**(E) 祭坛 cost**（已填，过期占位标记）

| 项 | 现有 cost | 建议 | 理由 |
|----|-----------|------|------|
| soul_hp/soul_spd/soul_dmg/soul_gain | 60/90/130/160 | **保持** | 单局净灵魂 ~550（normal 满 15min），2~3 局可购 1 件，节奏合理 |
| soul_slot_weapon/passive | 150/150 | **保持或微升 180** | 槽位扩容是强长期投资，略升使其更"珍贵" |
| soul_dual | 220 | **保持** | 最高价，对应"开局多一把武器"的强收益 |

**(F) 三把新武器**（`aura/whip/cross`，满级数值已填，需平衡校准）

| 武器 | 满级单目标裸 DPS 估值 | 定位 | 建议 |
|------|----------------------|------|------|
| aura(L5: 24/0.5, r162) | ~48 裸（贴身 AoE） | 点控 AoE，清潮 | **保持**；单目标低但群伤强，与现有 4 把正交 |
| whip(L5: 36/1.0, 320×70) | ~36 裸（一线） | 线控，走位配合 | **保持**；低单目标但横扫一线，互补 |
| cross(L5: 42×8/1.4, pierce3) | ~240 裸（八向，对单仅 1~2 向命中≈30~60） | 远程放射 | **保持但监控**：满级 8 弹×42 总量偏高，若 playtest 显示 cross 起手过强 → L5 count 8→6 或 dmg 42→36 |

#### 1.2.2 其余占位符（全 11 项汇总）

| # | 项 | 建议默认值 | 区间 | 仅一句话理由 |
|---|----|-----------|------|--------------|
| 2 | 装饰密度 `game.js:45` | 150 | 120~180 | 纯观感/性能，低性能机取 120、桌面取 180 |
| 4 | 后期升级池权重 `upgrade.js:59` | 维持现有 W 结构 | 调 0.85/0.5/1.0 系数 | 仅后期生效、前期零影响；目标 15min 时 weaponNew≈0.3、passiveNew≈2.0。注意边界：6 武器+被动全满时池可能空 → 已有 `expQueue=0` 兜底，无需改 |
| 5 | 灵魂发放 `data.js:16` | 采用 `computeSoulReward` 公式（*500 改对齐 HARD_CAP） | 500→600 上限 | per-X 字段为死代码，建议删或接线；单局上限 ~150 防通胀 |
| 7 | 爆破词缀 `data.js:115` | blastDamage **35**（或随 t 缩放）/ blastRadius **100** | dmg 25~45, r 90~110 | 现有 18/70 在 12~15min 被 night 放大后仍是"挠痒"（玩家承伤 80），须抬到能威胁满血玩家 |
| 9 | regen 被动 `data.js:217` | 0.8/级（满 4 HP/s） | 0.6~1.2 | 与血瓶/吸血互补，4 HP/s≈2~3%/s 明显但不主导；若叠加过强→降至 0.6 |
| 11 | 血裔 cost/偏向 `data.js:248` | 保持现有 cost(0/80/120/160/200/260) | — | 已填；apostle(260) 收益极高（-20HP 换 dmg+30%/速+25%/CD-25%）但成就解锁门槛已制衡，保持 |

### 1.3 真机校准方法论（Playtest 框架）

采用 quality-lead 的 **Playtest 数据驱动校准**，分 3 轮收敛。核心原则：**先给默认、playtest 后再定**（所有 [PLACEHOLDER] 均标记为"默认待校准"）。

**监控指标（建表，每局自动上报）**：
- **难度斜率**：各时段敌人有效 HP/伤害（=基础×线性×nightBase^D×artifact），画出 0~15min 曲线。
- **存活时间分布**：3 难度 × 3 血裔 × n=20 局，取中位数/四分位；目标 normal 中位数 ≥ 720s（能见到 avatar）。
- **击杀速率**：kills/min 随时间，验证"清得动→吃得到经验→更打得过"无死亡螺旋。
- **升级曲线**：level vs time，校验 §1.2.1(C) 的"12min 前满 build"目标。
- **Boss 击杀时长**：4 Boss 各自，校验 §1.2.1(A) 量级匹配。
- **死亡原因分布**：掉血不可逆 / 被弹幕 / 被冲撞 / 被群殴 —— 指导 #1/#3/#7/#9 续航项。

**迭代轮次**：
- **Round 1（铺默认）**：写入 §1.2 全部默认值，跑基线。验收门槛：normal 见 avatar 率 ≥ 70%，avatar **胜率 40~60%**（既是 climax 又不保证赢）。
- **Round 2（收斜率）**：按 Round1 的"难度斜率"与"死亡原因"调系数（nightBase ±0.03、exp 系数 0.06~0.10、掉率 0.02~0.04、blast 词缀）。目标：消除"中期清不动"与"后期秒杀"两端。
- **Round 3（收边界）**：极端 build（最弱 1 武器/最强 3 神器）与 accessibility（移动端触屏）验证；锁定通胀（灵魂单局 ≤150）。

**标注"先给默认、playtest 后再定"的项**：`nightBase`、`expScaleForTime` 系数、avatar HP（§二.3）、血瓶掉率/heal、爆破词缀、新武器 cross 上限、SOUL_REWARDS 公式乘子。

---

## 二、终局时间机制重设计

### 2.1 出 Boss 时间

- **改动**：`src/data.js:71-72` —— `ENDGAME_BOSS_TIME` 由 `900` → **`720`**（12 分钟降临永夜化身）。
- **配套**：`NIGHT_START=540` 不变（9min 永夜加深）。节奏变为：9min 永夜加深 → 9min(overlord 540) → 12min(avatar 720) → 15min 硬上限(900)。
- **理由**：12min 出终局更紧凑，避免 15min 末段"已知必胜"的拖沓；同时给玩家 180s 明确决战窗口（见 §2.3）。

### 2.2 硬上限失败（GAME_HARD_CAP）

- **新增常量**：`src/data.js:71-72` 增 `export const GAME_HARD_CAP = 900;`（15 分钟）。
- **触发逻辑（描述，不写代码）**：在 `src/game.js:step()` 末尾（现有 `if (this.player.hp <= 0) this.gameOver();` 之后）新增判定：当 `t >= GAME_HARD_CAP` 且场上仍存在 `isBoss === true` 的敌人存活时，进入**超时失败结算**。
- **状态机扩展（描述）**：
  - 现状：`state` 有 `gameover`(阵亡)、`victory`(杀 avatar)。
  - 新增 `state = 'timeout_fail'`，与阵亡（`gameOver` 由 `hp<=0` 触发）和胜利（`gameWin` 由杀 avatar 触发）**三者互斥、清晰区分**。
  - `game.js:gameOver()` 增加 `reason` 参数（或新增 `gameTimeout()` 方法），UI 据此展示不同文案：超时 = "永夜吞没了你——未能在时限内讨伐化身"；阵亡 = "你倒下了"。
  - `ui.js` 新增 `showTimeoutFail()`（或 `showGameOver(reason)` 分支）；`game.js:frame()` 的 `else if (this.state === 'title' || this.state === 'gameover')` 渲染分支需把 `timeout_fail` 并入（共用 backdrop 渲染即可）。
- **灵魂结算**：超时失败仍调用 `computeSoulReward`（按存活时间 `t` 计），因已活满 900s，时间项给满，与"坚持到最后的幸存者"语义一致，应照发灵魂（区别于中途阵亡按实际时间折算，但二者公式同源，无需特判）。

**判定范围建议（需主理人拍板，给出我的推荐）**：

| 方案 | 判定条件 | 推荐度 | 理由与取舍 |
|------|----------|--------|------------|
| **A（推荐）** | **t>=900 且任意 `isBoss` 存活** | ★★★ | 健壮、无边缘 bug。avatar 在 720 降临时会清掉其他 Boss（`entities.js:328-330`），所以 900s 时场上只可能剩 avatar；用"任意 isBoss"覆盖了"万一中间 Boss 因跳变残留"的异常，不会因为漏判而让玩家白活 15min 却判胜利 |
| B | 仅 `avatar` 未击败 | ★ | 更窄但语义等价（900s 时仅 avatar 可能是 Boss）。缺点：若未来出现"非 avatar 的残留 Boss"，会漏判 → 不推荐 |

**推荐 A**：用"任意 `isBoss` 存活"。实践中与"仅 avatar"等价，但容错更好，且逻辑一句话、零额外状态。

### 2.3 窗口可行性评估（180s：720→900，击败 avatar 15000hp）

**关键结论：180s 窗口对 DPS 而言远超充足；本战的约束是"生存"而非"DPS"。**

**DPS 估算（normal，t≈720s，基于 `weapons.js` 真实满级数值）**：
- 假设终局 build：6 武器满级 + `damageMul≈1.8~2.2` + 0~2 件神器。
- 单武器对单 Boss 裸 DPS（×damageMul 后）：blade≈346、lightning≈240、axe≈250、holywater≈150(有效)、aura≈96、whip≈72、cross≈100(有效，八向仅 1~2 向命中 Boss)。
- 6 武器合计 ≈ **1150~1300 DPS**（裸）；神器（storm/spiral≈700~900、stormcall/crimson≈250~400）再加。
- **典型终局 DPS ≈ 1300（无神器）~ 2000+（1~2 神器）**。
- 极端弱 build（1 神器、低 rage）≈ 800 DPS。

**avatar(15000hp) 击杀时长**：
| 玩家强度 | DPS | 击杀 avatar 耗时 |
|----------|-----|------------------|
| 弱 | 800 | ~19s |
| 典型 | 1300~2000 | **~7.5~11.5s** |
| 强(双神器) | 3000+ | ~5s |

**判断**：
- 180s 窗口是 DPS 需求的 **15~30 倍余量**。即使把 avatar 移到 12min（比原 15min 少 3min 发育），玩家 DPS 仍 ≥800，19s 即可击杀，**远在 180s 内**。
- 因此**不存在"窗口不够、需下调 avatar HP 或延长窗口"的问题**——恰恰相反，按现有 15000hp，avatar 是"数秒闪击"，作为终局 Boss 偏短、偏易。
- 真正的失败风险是**生存**：avatar 接触伤害 80 + 召唤(shadow_hunter/gargoyle/volatile slime) + 弹幕 + 冲刺 + 狂暴，玩家可能在那 7~12s 内被技能/召唤物打死（→ `hp<=0` 阵亡），而非打不动。

**明确推荐值（需主理人拍板，二选一）**：

| 选项 | avatar HP(normal) | 评估 | 推荐 |
|------|-------------------|------|------|
| **A（默认，安全）** | **保持 15000**（×bossHpMul → 10500/15000/21000） | 闪击式终局，胜负极取决于生存/走位；180s 窗口纯兜底，零"打不动"风险 | ★★★ 作为默认 |
| B（可选，增强 climax） | **上调至 ~45000~60000** | 中强玩家(2000 DPS)≈22~30s、弱玩家(800)≈56~75s、双神器(3000)≈15~20s——窗口仍 ≤180s 可通关，且终局更有"决战感" | ★★ 进阶打磨时再定 |

- **不推荐**下调 HP 或延长窗口到 960：下调会让终局更无存在感；延长窗口与"15min 心跳"支柱冲突且无必要。
- **联动建议**：若选 A（保持 15000），Boss 技能"循环释放"(§三) 因 Boss 秒死而仅可见 1~2 轮，体现有限；若选 B（上调 HP），循环技能才能充分展现持续压力——**§三 的技能节奏方案与 §二.3 的 HP 决策强相关，建议一并拍板**。

### 2.4 涉及改动的常量 / 函数清单（仅描述，不写代码）

| 文件:行 | 现状 | 应改成什么 |
|---------|------|-----------|
| `src/data.js:71-72` | `NIGHT_START=540; ENDGAME_BOSS_TIME=900` | 保持 `NIGHT_START=540`；`ENDGAME_BOSS_TIME=900 → 720`；**新增** `GAME_HARD_CAP=900` |
| `src/data.js:443-487` (BOSSES.avatar) | `hp:15000` | 默认保持 15000；可选上调至 45000~60000（见 §2.3） |
| `src/entities.js:326` | `if (t >= ENDGAME_BOSS_TIME && !bossSpawned.has('avatar'))` | 常量改名后自动生效（`ENDGAME_BOSS_TIME` 已改为 720），**无需改逻辑** |
| `src/entities.js:241-242` (spawnBoss) | `hp: def.isEndgame ? def.hp*bossHpMul : def.hp` | 建议改为**所有 Boss** 均乘 `bossHpMul`（统一难度缩放，呼应 §1.2.1(A)）；avatar 段保持 `isEndgame` 分支 |
| `src/game.js:262-271` (step) | 仅 `if (player.hp<=0) gameOver()` | 其后**新增**：`if (t >= GAME_HARD_CAP && enemies 中存在 isBoss 存活) → gameOver('timeout')` 或 `gameTimeout()` |
| `src/game.js:379-387` (gameOver) | 无 reason 参数 | 增加 `reason`（或新增 `gameTimeout`），超时亦结算灵魂（公式同源） |
| `src/game.js:227` (frame 渲染) | `state==='title'||'gameover'` 走 backdrop | 渲染分支并入 `timeout_fail`（共用 backdrop） |
| `src/ui.js:300` (showGameOver) | 单文案 | 新增 `showTimeoutFail()` 或 `showGameOver(reason)` 分支，区分"阵亡/超时"文案 |
| `src/game.js:366` (computeSoulReward) | 用 `ENDGAME_BOSS_TIME` 作分母 `(time/ENDGAME_BOSS_TIME)*500` | 分母改为 `GAME_HARD_CAP`（避免 720 击杀时时间项 <500；900 时自然封顶），并核对单局 ≤150 防通胀 |

---

## 三、Boss 技能节奏重设计

### 3.1 现状问题定性（先讲清"不是什么"）

> **当前不是"CD 太长"，而是"阈值一次性触发、无循环"。**

- 触发逻辑（`src/entities.js:415-419`）：
  ```js
  if (e.isBoss && e.skillIndex < e.bossDef.skills.length
      && e.hp / e.maxHp <= e.bossDef.skills[e.skillIndex].at) {
    this.triggerBossSkill(e, e.bossDef.skills[e.skillIndex]);
    e.skillIndex += 1;
  }
  ```
- **本质**：`skillIndex` 是单向指针，每个技能**整场只放一次**，按数组顺序在 HP 跌破各自 `at` 时触发。
- **后果**：
  1. 每技能仅 1 次，阶段间**长空窗**（尤其 avatar 6 技能散在 70%→15%，放完即静默）。
  2. 技能密度**与难度无关**（`skills` 无难度字段），"高难更密"无从体现。
  3. 整场节奏是"70% 一波、35% 一波、15% 一波"的**三段爆发**，而非持续压迫。
- 这正好违背支柱 5"行为多样化>数值膨胀"——应为 Boss 注入**持续、随难度变化的技能节律**。

### 3.2 重设计方案（门槛 + 冷却双条件）

**数据结构变更**（描述，不写代码）：
- 保留 `skill.at` 作为**首次触发门槛**（血量百分比阈值，进入该阶段带）。
- 新增 `skill.cooldown`（秒）：首次触发后，在该阶段带内**每 `cooldown` 秒循环释放一次**。
- 新增 `skill.once`（可选布尔）：用于 `enrage` 等**增益型**技能——只放一次、不循环（见 §3.4 边界）。
- `DIFFICULTIES` 新增 `bossSkillCdMul`（高难 <1 缩短 CD、低难 >1 延长）：easy 1.3 / normal 1.0 / hard 0.75，呼应"技能密度随难度变化"。

**阶段带（band）模型**（让循环有边界、不乱叠）：
- 将 Boss 的 `skills` 按 `at` 降序排列，相邻阈值切出阶段带：`[at_{i-1}, at_i)`，`at_0=0` 为最低带。
- 技能 `i` **激活条件**：`hp/maxHp` 落入其带（即 `≤ at_i` 且 `> at_{i-1}`）。
- **循环规则**：进入带时立即首发；之后每 `cooldown × bossSkillCdMul` 秒在带内重放；离开带（HP 继续跌入下一带）则该技能停止（避免 early 技能全程乱放）。
- 例：avatar `at:0.7` 技能，仅在 HP∈(35%,70%] 循环；`at:0.15` 技能仅在 HP≤15% 循环。

**`entities.js:415` 触发逻辑应如何改（描述，不写代码）**：
- 弃用单一 `skillIndex` 指针，改为**每个技能独立状态**：`skill._triggered`（是否已首发）、`skill._last`（上次释放时刻）。
- 每帧对 Boss 的每个 `skill`：
  1. 若 `!skill._triggered && hp/maxHp <= skill.at` → 触发，`_triggered=true`，`_last=now`。
  2. 否则若 `skill._triggered && !skill.once && (now - _last) >= skill.cooldown * diff.bossSkillCdMul && hp/maxHp 仍在该技能阶段带内` → 触发，`_last=now`。
- 这样从"一次性顺序触发"变为"**分阶段、按冷却循环、随难度缩放**"的节律。

### 3.3 四 Boss 技能重排数据草稿（非终值，供确认）

> 设计意图：难度递增 + avatar 作为终局高密度。带 `once` 者不循环（防增益叠加）。`cooldown` 为 normal 基准，实际生效时乘 `bossSkillCdMul`。

**baron**（HP 1800，轻量，2 技能）
```js
skills: [
  { at: 0.7,  cooldown: 10, type: 'summon',        enemyType: 'bat',     count: 4 },
  { at: 0.4,  cooldown: 9,  type: 'barrage',        count: 8, speed: 130, damage: 15 },
]
```

**queen**（HP 4500，中量，2 技能）
```js
skills: [
  { at: 0.6,  cooldown: 9,  type: 'dash',           speedMul: 4.2, duration: 0.5, damage: 20 },
  { at: 0.3,  cooldown: 8,  type: 'summon_barrage',  enemyType: 'skeleton', count: 3, barrageCount: 10, speed: 140, damage: 18 },
]
```

**overlord**（HP 9000，重量，3 技能）
```js
skills: [
  { at: 0.75, cooldown: 10, type: 'summon',        enemyType: 'bat',     count: 5 },
  { at: 0.5,  cooldown: 8,  type: 'dash_barrage',  speedMul: 4.5, duration: 0.5, barrageCount: 12, speed: 150, damage: 22 },
  { at: 0.25, cooldown: 12, type: 'enrage', speedMul: 1.6, once: true },  // 增益型，仅一次
]
```

**avatar**（HP 15000，终局高密度，6 技能）
```js
skills: [
  { at: 0.70, cooldown: 7, type: 'summon',        enemyType: 'shadow_hunter', count: 5 },
  { at: 0.70, cooldown: 9, type: 'barrage',        count: 12, speed: 140, damage: 18 },
  { at: 0.35, cooldown: 7, type: 'dash_barrage',  speedMul: 4.2, duration: 0.5, barrageCount: 12, speed: 150, damage: 22 },
  { at: 0.35, cooldown: 11, type: 'summon',        enemyType: 'gargoyle', count: 3 },
  { at: 0.15, cooldown: 8, type: 'enrage', speedMul: 1.6, once: true },
  { at: 0.15, cooldown: 9, type: 'summon',        enemyType: 'slime', count: 4, affix: 'volatile' },
]
```

**节奏对照（normal）**：
- avatar P1(70%)：两技能每 7~9s 各放一次 → 约每 4s 一次技能。
- P2(35%)：两技能每 7~11s → 约每 4~5s 一次。
- P3(15%)：两技能每 8~9s + enrage 一次性 → 持续高压收尾。
- 三阶段合计在 ~10s 战斗中可见 2~3 轮循环（若采用 §2.3 选项 B 上调 HP，则循环充分展现，压力贯穿整战）。

### 3.4 边界与防坑（实现时注意，列在此供确认）

1. **enrage 必须 `once`**：现有 `triggerBossSkill` 中 `enrage` 是 `e.speed *= skill.speedMul`——若循环释放，速度会**指数级叠加**（×1.6 每轮）→ 崩坏。草稿已标 `once:true`。
2. **阶段带防乱放**：early 技能（如 baron 0.7 召唤）不应在 HP=20% 时仍每 10s 刷——靠阶段带 `> at_{i-1}` 截止。
3. **难度缩放只缩 CD 不缩门槛**：`at` 阈值跨难度一致，`bossSkillCdMul` 仅作用于 `cooldown`（hard 0.75 → 技能更密），保持"同机制同公式仅数值区分"。
4. **与 §2.3 联动**：循环技能的"体感"依赖 Boss 存活时长；HP 15000（闪击）时循环几乎不可见，建议与 avatar HP 决策（选项 A/B）一并确认。

---

## 四、需主理人确认 / 拍板的事项（汇总）

| 项 | 我的推荐 | 备选 | 影响 |
|----|----------|------|------|
| ① `ENDGAME_BOSS_TIME` 900→720 | **通过** | 保持 900 | 决战提前 3min，更紧凑（与已确认终局文档冲突，需同步修订） |
| ② 超时判定范围 | **任意 `isBoss` 存活**（方案 A） | 仅 avatar | 健壮性，零额外状态 |
| ③ 180s 窗口是否够 | **足够（DPS 余量 15~30×）** | — | 约束是生存非 DPS |
| ④ avatar HP | **默认保持 15000**（选项 A）；进阶可选 **45000~60000**（选项 B） | 下调/延窗 | 决定终局是"闪击"还是"决战"；与 §三 循环技能体感强相关 |
| ⑤ 全 Boss 难度缩放 HP | **统一乘 `bossHpMul`** | 仅 avatar | 一致性，呼应"同公式" |
| ⑥ 死代码 `SOUL_REWARDS` per-X 字段 | **删或接线** | 保持 | 防误导 |
| ⑦ `nightBase` / `exp` 系数 / 掉率 / 词缀 | **保持默认，playtest 后定** | — | 全标"先给默认" |

---

## 变更日志（本方案）

| 版本 | 日期 | 说明 |
|------|------|------|
| v0.1 | 2026-07-24 | Phase 1 概念方案：数值校准 + 终局时间机制 + Boss 技能节奏。纯设计，未实现 |
