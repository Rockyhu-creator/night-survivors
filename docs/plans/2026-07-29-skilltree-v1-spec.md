# 角色技能树（Skill Tree）v1 · 可编码节点规格文档

> - **文档类型**：GDD 八节级落地规格（设计产物 → 工程师可直接照敲）
> - **版本 / 日期**：v1.0 规格稿 · 2026-07-29
> - **作者**：文策渊（设计 · 叙事）
> - **状态**：待评审 → 实现；**本文件不修改任何 `src/` 代码，仅规格**
> - **定位**：元进度 · 全新独立层——跨局永久、消耗灵魂、存 localStorage；与「灵魂祭坛」**并存双 sink、零污染**

---

## 0. 落地地基核对（基于真实代码现状，非凭空造）

本文所有数值与字段锚定以下已落地的真实代码（v2.5b，G1+G2+G3 已推送）：

| 真实系统 | 现状（代码证据） | 对技能树的意义 |
|---|---|---|
| 持久化地基 (G1) | `src/data.js` `loadSouls()` 已返回 `tree:[]` / `treeResets` / `achievements:[]`（默认空，旧档安全兜底）；`migrateSouls()` 占位 | 技能树**已有持久化位**，无需再迁移 schema |
| 引擎三机制 (G2) | `src/entities.js` `Player.reset()` 已含 `thorns=0` / `nightDmgReduction=0` / `statusAmp=1`；`takeDamage(amount, source)` 已反伤；`applyDebuff(e,{type:'slow'\|'burn',value,duration})` 已按 `statusAmp` 放大；`aura` 在 `statusAmp>1` 时已对环内敌施加 slow（proof-of-concept 已接线） | `thorns`/`nightDmgReduction`/`statusAmp` **可直接作为 stat 节点目标**，无需新引擎字段 |
| 成就框架 (G3) | `src/data.js` `ACHIEVEMENTS` 枚举 + `hasAchievement`/`grantAchievement`（幂等）；`game.js` `recordAchievements()` 在 `gameWin` 写入 `clear_easy/normal/hard`、`beat_endgame_any`、`beat_hard_endgame`、`no_hit_clear` | `gateReq.achievement` 可挂钩；`cleared[]` 记录 `'easy'/'normal'/'hard'`（见 `game.js:419`） |
| 祭坛 (保留) | `src/data.js` `ALTAR`：7 项，cost `60/90/130/160/220/150/150`；`apply(g)` 在 `game.js:233-235` 的 `for (const a of ALTAR){ if(isUnlocked(a.id)) a.apply(this); }` 注入 | 技能树 `apply` 必须**并列、独立数组、不碰此循环** |
| 灵魂结算 | `game.js:413-423` `computeSoulReward()`：`reward = floor(time/900*500)+level`；末行 `floor(reward * soulGainMul * difficulty.soulMul)`；`soulGainMul` 默认 1（`game.js:39,232`） | `eco` 分支直接乘 `g.soulGainMul` 即生效，含首通奖励（首通写入 `cleared` 后被同式乘区放大） |
| 既有引擎字段（可安全作为 stat 目标） | `maxHp, speedMul, damageMul, areaMul, cooldownMul, lifesteal, maxWeapons, maxPassives, critChance(CRIT_CHANCE_CAP=0.75), critMul, dodgeChance(DODGE_CAP=0.35), magnetMul, armor, regenRate, guard→damageTakenMul, maxShield, shield, shieldRegen` | stat 节点直接 `+=` / `*=` 这些字段 |

**红线（设计理论，发现即标注）**：杜绝主导策略、经济失衡（通胀/真空期）、认知过载、支柱漂移。

---

## 1. 数据 Schema（镜像 ALTAR）

定义在 `src/data.js`，与 `ALTAR` 同文件、同结构，但**独立数组、独立持久化位 `tree[]`**。

```js
// ============ 技能树 v1（独立数组，与 ALTAR 并列，不污染祭坛循环）============
export const SKILL_TREE = [
  {
    id: 'war_root',          // 唯一 id（同时是 prereq/gate 引用键）
    branch: 'war',           // 'war' | 'bly' | 'nfr' | 'eco' | 'utl'
    type: 'gate',            // 'stat' | 'modifier' | 'keystone' | 'gate'
    name: '征伐之门',         // 中文显示名
    desc: '解锁「征伐」分支：武器与伤害的专精投资线',
    cost: 300,               // 灵魂成本（整数，具体值见 §4）
    prereq: [],              // 前置节点 id 数组（必须全部已购）；gate 通常为 []
    gateReq: null,           // null | { cleared:['normal'], achievement:['no_hit_clear'] }
    apply: (g) => { /* 一般为空或仅记录解锁；详见 §4 */ },
    icon: 'sk_war_root',     // UI 图标 key（art-bible 待对齐，先占位）
  },
  // ... 共 39 节点（完整目录见 §4）
];

// gateReq 语义：
//   null             → 无额外门槛（纯灵魂）
//   { cleared:[...] }        → 要求 loadSouls().cleared 含列表内【全部】难度 id（'easy'|'normal'|'hard'）
//   { achievement:[...] }    → 要求 loadSouls().achievements 含列表内【全部】成就 id
//   两者可同时给（AND 关系）
```

### 1.1 `apply(g)` 调用点（在 `game.js` `startRun`，与 ALTAR 并列）

`g` 即 `game` 实例，可访问 `g.player` / `g.soulGainMul` / `g.weapons` 等。

```js
// game.js startRun()，在现有 ALTAR 循环【之后】、【玩家回满血之前】追加：
//   for (const a of ALTAR) { if (isUnlocked(a.id)) a.apply(this); }   // ← 现有，勿改
//   ↓↓↓ 新增并列循环（独立数组，不碰 ALTAR）↓↓↓
//   const soulsNow = loadSouls();
//   for (const n of SKILL_TREE) {
//     if (soulsNow.tree.includes(n.id)) n.apply(this);
//   }
//   this.player.hp = this.player.maxHp;   // 现有回满血（在 SKILL_TREE 后，使 maxHp 增益落到开局 HP）
```

> **顺序说明**：`player.reset()`（line 213）已把 `weaponMods` 归 `{}`（见 §5 钩子 1），ALTAR 与 SKILL_TREE 的 `apply` 在同一 `startRun` 内顺序注入；maxHp 类增益经 line 237 `hp = maxHp` 同步到开局血量。两个循环互不引用、互不影响。

---

## 2. 成本分层模型（防双 sink 失衡）

祭坛全买 ≈ **960** 灵魂（顶项 220）；技能树全买 ≈ **13 750** 灵魂（顶项 keystone 850）。树成本是祭坛的 ~14×，且**单节点最低 160 远高于祭坛项（60）**——树是"长期投资"，祭坛是"基础盘"，二者不竞争。

| 节点层 | 类型 | 成本区间 | 依据 |
|---|---|---|---|
| 分支入口 gate | gate | **250–350** | 高于祭坛顶项 220 的 ~1.5×，作为"新 sink 门槛" |
| 第 1 层 stat | stat | **160–240** | 祭坛单项的 ~1.3–2× |
| 第 2 层 modifier | modifier | **280–360** | 阶梯 ×1.4–1.8 |
| 深层 keystone | keystone | **650–850** | 远超祭坛，制造长线里程碑 |
| 终局/跨支 keystone | keystone | **800–850** | 需 `cleared` 硬门槛，最难获取 |

**单局收入参考**（来自 `computeSoulReward`）：normal 满局 ≈ 430–500 灵魂；hard 满局 ≈ 650–750（含 `soulMul=1.5`）；首通另 +30/50/80。→ 单 keystone ≈ 1.5–2 局；整树 ≈ 18–30 局（多难度混合）。健康长线目标，无真空期（祭坛买空后树成为唯一 sink，正合双 sink 意图）。

---

## 3. 完整节点目录（39 节点 · 5 分支 · 4 类型全覆盖）

> 类型分布：**gate 6 / stat 20 / modifier 6 / keystone 7** = 39。
> 分支分布：**war 9 / bly 8 / nfr 8 / eco 6 / utl 8**。
> 凡 `apply` 依赖**尚不存在**的引擎字段/钩子，效果列标注 ⚠️HOOK 并在 §5 单列。

### 3.1 总览表（id / 分支 / 类型 / 成本 / 前置 / 门槛 / 效果摘要）

| # | id | 分支 | 类型 | 成本 | prereq | gateReq | 效果摘要 |
|---|---|---|---|---|---|---|---|
| 1 | war_root | war | gate | 300 | — | — | 解锁征伐分支 |
| 2 | war_dmg | war | stat | 180 | war_root | — | 全武器伤害 +8% |
| 3 | war_cd | war | stat | 180 | war_root | — | 全武器冷却 -8% |
| 4 | war_axe_extra | war | modifier | 280 | war_root | — | 回旋战斧 同时投掷 +1 把 ⚠️HOOK |
| 5 | war_lightning_chain | war | modifier | 300 | war_root | — | 雷霆审判 跳跃 +2 段 ⚠️HOOK |
| 6 | war_holywater_layer | war | modifier | 320 | war_root | — | 圣水洗礼 同时泼洒 +1 片领域 ⚠️HOOK |
| 7 | war_starfall_crit | war | modifier | 360 | war_dmg | — | 星陨弩 暴击率 +15% & 暴击伤害 +25% ⚠️HOOK |
| 8 | war_keystone_omni | war | keystone | 700 | war_dmg, war_axe_extra | — | 全武器伤害 +12% & 冷却 -10% |
| 9 | war_keystone_avalanche | war | keystone | 750 | war_axe_extra, war_lightning_chain | — | 全武器伤害 +15% & 范围 +20% |
| 10 | bly_root | bly | gate | 250 | — | — | 解锁血裔协同分支 |
| 11 | bly_saint_pulse | bly | modifier | 300 | bly_root | — | 圣水洗礼 同时泼洒 +1 片领域（圣徒协同）⚠️HOOK |
| 12 | bly_blood_lifeshield | bly | keystone | 700 | bly_root | — | 吸血(lifesteal) 溢出转为护盾 ⚠️HOOK |
| 13 | bly_thunder_chain | bly | modifier | 300 | bly_root | — | 雷霆审判 跳跃 +2 段（雷巫协同）⚠️HOOK |
| 14 | bly_berserk_rage | bly | stat | 260 | bly_root | — | 伤害 +8% & 移速 +5%（狂战协同） |
| 15 | bly_wanderer_omni | bly | stat | 240 | bly_root | — | 伤害 +5% & 生命 +20（流浪者均衡） |
| 16 | bly_sanguine_lifesteal | bly | stat | 300 | bly_root | — | 命中回血(lifesteal) +1.0（噬血协同） |
| 17 | bly_keystone_apostle | bly | keystone | 850 | bly_wanderer_omni, bly_sanguine_lifesteal | cleared:['hard'] | 伤害 +15% & 永夜减伤 +15%（使徒高风险高回报） |
| 18 | nfr_root | nfr | gate | 250 | — | — | 解锁永夜抗性分支 |
| 19 | nfr_hp | nfr | stat | 180 | nfr_root | — | 生命上限 +40 |
| 20 | nfr_shield | nfr | stat | 240 | nfr_hp | — | 护盾上限 +25（并 immediat 获 25 盾） |
| 21 | nfr_armor | nfr | stat | 200 | nfr_root | — | 防御(固定减伤) +3 |
| 22 | nfr_thorns | nfr | stat/mech | 320 | nfr_root | — | 反伤(thorns) +20（受击反弹等量） |
| 23 | nfr_nightdr | nfr | stat | 360 | nfr_shield | — | 永夜阶段(≥540s)受伤 -20% |
| 24 | nfr_statusamp | nfr | stat | 340 | nfr_armor | — | 状态增幅(statusAmp) +0.5（放大 aura 减速等） |
| 25 | nfr_keystone_endgame | nfr | keystone | 800 | nfr_nightdr, nfr_statusamp | cleared:['hard'] | 永夜减伤 +20% & 反伤 +25 & 护盾上限 +30 |
| 26 | eco_root | eco | gate | 250 | — | — | 解锁灵魂经济分支 |
| 27 | eco_gain1 | eco | stat | 200 | eco_root | — | 灵魂获取(soulGainMul) ×1.15 |
| 28 | eco_gain2 | eco | stat | 320 | eco_gain1 | — | 灵魂获取(soulGainMul) ×1.15（叠加） |
| 29 | eco_gate_nightmare | eco | gate | 350 | eco_root | cleared:['normal'] | 解锁"噩梦投资"子区 |
| 30 | eco_nightmare | eco | stat | 450 | eco_gate_nightmare | — | 灵魂获取(soulGainMul) ×1.20（高难 soulMul 已乘 → 高难高回报） |
| 31 | eco_keystone_hoarder | eco | keystone | 800 | eco_gain2, eco_nightmare | — | 灵魂获取(soulGainMul) ×1.30 |
| 32 | utl_root | utl | gate | 250 | — | — | 解锁通用机能分支 |
| 33 | utl_cd | utl | stat | 180 | utl_root | — | 全武器冷却 -7% |
| 34 | utl_crit | utl | stat | 220 | utl_cd | — | 暴击率 +8%（封顶 CRIT_CHANCE_CAP） |
| 35 | utl_critdmg | utl | stat | 220 | utl_crit | — | 暴击伤害 +20% |
| 36 | utl_magnet | utl | stat | 160 | utl_root | — | 拾取范围(magnetMul) +25% |
| 37 | utl_dodge | utl | stat | 240 | utl_root | — | 闪避率 +4%（封顶 DODGE_CAP） |
| 38 | utl_regen | utl | stat | 200 | utl_magnet | — | 每秒回血(regenRate) +1.0 |
| 39 | utl_keystone_efficient | utl | keystone | 650 | utl_crit, utl_dodge | — | 冷却 -10% & 暴击率 +5% & 闪避 +3%（封顶） |

### 3.2 逐节点 `apply` 实现草图（伪代码级，工程师无需再猜）

> 约定：`CRIT_CHANCE_CAP` / `DODGE_CAP` 已在 `data.js` 顶层 import，SKILL_TREE 的 `apply` 可直接引用（同 ALTAR）。
> `weaponMods` 为 `g.player.weaponMods`（§5 钩子 1 新增，默认 `{}`）。

**war（征伐）**
```js
war_root:              apply:(g)=>{}                                  // 仅解锁分支，无需注入
war_dmg:               apply:(g)=>{ g.player.damageMul += 0.08; }
war_cd:                apply:(g)=>{ g.player.cooldownMul *= 0.92; }
war_axe_extra:         apply:(g)=>{ const m=g.player.weaponMods||={}; m.axe||={}; m.axe.count=(m.axe.count||0)+1; }   // ⚠️HOOK
war_lightning_chain:   apply:(g)=>{ const m=g.player.weaponMods||={}; m.lightning||={}; m.lightning.chains=(m.lightning.chains||0)+2; } // ⚠️HOOK
war_holywater_layer:   apply:(g)=>{ const m=g.player.weaponMods||={}; m.holywater||={}; m.holywater.count=(m.holywater.count||0)+1; }   // ⚠️HOOK
war_starfall_crit:     apply:(g)=>{ const m=g.player.weaponMods||={}; m.starfall||={}; m.starfall.critChance=(m.starfall.critChance||0)+0.15; m.starfall.critMul=(m.starfall.critMul||0)+0.25; } // ⚠️HOOK(逐武器暴击)
war_keystone_omni:     apply:(g)=>{ g.player.damageMul += 0.12; g.player.cooldownMul *= 0.90; }
war_keystone_avalanche:apply:(g)=>{ g.player.damageMul += 0.15; g.player.areaMul *= 1.20; }
```

**bly（血裔协同）**
```js
bly_root:              apply:(g)=>{}
bly_saint_pulse:       apply:(g)=>{ const m=g.player.weaponMods||={}; m.holywater||={}; m.holywater.count=(m.holywater.count||0)+1; } // ⚠️HOOK（与 war_holywater_layer 叠加）
bly_blood_lifeshield:  apply:(g)=>{ g.player.lifestealToShield = true; }   // ⚠️HOOK（需改 3 处回血位点）
bly_thunder_chain:     apply:(g)=>{ const m=g.player.weaponMods||={}; m.lightning||={}; m.lightning.chains=(m.lightning.chains||0)+2; } // ⚠️HOOK（与 war_lightning_chain 叠加）
bly_berserk_rage:      apply:(g)=>{ g.player.damageMul += 0.08; g.player.speedMul += 0.05; }
bly_wanderer_omni:     apply:(g)=>{ g.player.damageMul += 0.05; g.player.maxHp += 20; }
bly_sanguine_lifesteal:apply:(g)=>{ g.player.lifesteal += 1.0; }
bly_keystone_apostle:  apply:(g)=>{ g.player.damageMul += 0.15; g.player.nightDmgReduction = Math.min(0.9, g.player.nightDmgReduction + 0.15); }
```

**nfr（永夜抗性）**
```js
nfr_root:              apply:(g)=>{}
nfr_hp:                apply:(g)=>{ g.player.maxHp += 40; }
nfr_shield:            apply:(g)=>{ g.player.maxShield += 25; g.player.shield = Math.min(g.player.maxShield, g.player.shield + 25); }
nfr_armor:             apply:(g)=>{ g.player.armor += 3; }
nfr_thorns:            apply:(g)=>{ g.player.thorns += 20; }   // 已生效字段（G2）
nfr_nightdr:           apply:(g)=>{ g.player.nightDmgReduction = Math.min(0.9, g.player.nightDmgReduction + 0.20); }
nfr_statusamp:         apply:(g)=>{ g.player.statusAmp += 0.5; }   // 已生效字段（G2）；放大 aura 减速等
nfr_keystone_endgame:  apply:(g)=>{ g.player.nightDmgReduction = Math.min(0.9, g.player.nightDmgReduction + 0.20); g.player.thorns += 25; g.player.maxShield += 30; g.player.shield = Math.min(g.player.maxShield, g.player.shield + 30); }
```

**eco（灵魂经济）**
```js
eco_root:              apply:(g)=>{}
eco_gain1:             apply:(g)=>{ g.soulGainMul *= 1.15; }   // g.soulGainMul 已存在（game.js:39）
eco_gain2:             apply:(g)=>{ g.soulGainMul *= 1.15; }
eco_gate_nightmare:    apply:(g)=>{}                           // 解锁子区；gateReq cleared:['normal']
eco_nightmare:         apply:(g)=>{ g.soulGainMul *= 1.20; }
eco_keystone_hoarder:  apply:(g)=>{ g.soulGainMul = Math.min(4.0, g.soulGainMul * 1.30); }  // 软上限 4.0 防 runaway（[校准]）
```

**utl（通用机能）**
```js
utl_root:              apply:(g)=>{}
utl_cd:                apply:(g)=>{ g.player.cooldownMul *= 0.93; }
utl_crit:              apply:(g)=>{ g.player.critChance = Math.min(CRIT_CHANCE_CAP, g.player.critChance + 0.08); }
utl_critdmg:           apply:(g)=>{ g.player.critMul += 0.20; }
utl_magnet:            apply:(g)=>{ g.player.magnetMul += 0.25; }   // 注意字段是 magnetMul（非 magnet）
utl_dodge:             apply:(g)=>{ g.player.dodgeChance = Math.min(DODGE_CAP, g.player.dodgeChance + 0.04); }
utl_regen:             apply:(g)=>{ g.player.regenRate += 1.0; }
utl_keystone_efficient:apply:(g)=>{ g.player.cooldownMul *= 0.90; g.player.critChance = Math.min(CRIT_CHANCE_CAP, g.player.critChance + 0.05); g.player.dodgeChance = Math.min(DODGE_CAP, g.player.dodgeChance + 0.03); }
```

---

## 4. 门槛 / 可达性校验（仅 keystone / 终局 gate 要 `cleared`）

遵循用户决策：绝大多数节点**纯灵魂可达**，仅 3 个节点要求 `cleared[]`，避免休闲玩家卡死。

| 节点 | gateReq | 要求的 cleared | 说明 |
|---|---|---|---|
| eco_gate_nightmare | `cleared:['normal']` | 通关 normal 一次 | 仅锁"噩梦投资"子区；休闲玩家首通 normal 即可解 |
| nfr_keystone_endgame | `cleared:['hard']` | 通关 hard 一次 | 终局生存基石，绑定技术成就"又肝又强" |
| bly_keystone_apostle | `cleared:['hard']` | 通关 hard 一次 | 使徒高风险高回报强化，绑定 hard |

- **仅 easy 玩家**：可解锁 gate + 全部 stat + 全部 modifier + 除上 3 外的全部 keystone（共 36/39 节点），纯灵魂可达。
- **normal 玩家**：额外解锁 eco 噩梦子区（含 eco_nightmare、eco_keystone_hoarder）。
- **hard 玩家**：解锁全部 39 节点。
- 无节点要求 `achievement`（预留接口，不在 v1 强制使用，防止过度劝退）。

---

## 5. 需要新增的引擎字段 / 钩子清单（重点 · 供主程评估工时）

> 下列效果依赖代码里**尚不存在**的字段或武器钩子。已生效字段（`thorns`/`nightDmgReduction`/`statusAmp`/`soulGainMul`/全部既有 `player.*`）**不在此列**，直接 `apply` 即可，零引擎改动。

### 钩子 1 · `player.weaponMods`（新字段 + `fire()` 各武器循环读取）— 支撑 6 个 modifier 节点

- **加在哪**：`src/entities.js` `Player.reset()` 增加 `this.weaponMods = {};`（默认 `{}` = 行为逐字节不变）。
- **类型**：`object`，按武器 id 嵌套：`{ axe:{count}, lightning:{chains}, holywater:{count}, blade:{count}, starfall:{critChance, critMul} }`，未投资键缺省为 0/不存在（读取用 `|| 0` / `|| {}` 兜底）。
- **需改的武器循环**（`src/weapons.js` `fire()`）：
  - `blade` 循环（line 594）：`const n = s.count + (player.weaponMods?.blade?.count || 0);` 用 `n` 替原 `s.count`。
  - `axe` 循环（line 628）：`const n = s.count + (player.weaponMods?.axe?.count || 0);` 用 `n`。
  - `holywater` 循环（line 608）：`const n = s.count + (player.weaponMods?.holywater?.count || 0);` 用 `n`。
  - `lightning`：`strikeLightning(startEnemy, s, new Set())`（line 643）改为传入 `chains = (s.chains||0) + (player.weaponMods?.lightning?.chains||0)`（如 `this.strikeLightning(target, { ...s, chains }, new Set())`，`strikeLightning` 内 `let remaining = s.chains` 自动取新值）。
- **逐武器暴击（仅 starfall）**— 见钩子 2。

### 钩子 2 · 逐武器暴击（`rollCrit` / `hitEnemy` 增加 `critBonus` / `critMulBonus` 参数）— 支撑 `war_starfall_crit`

- **改 `src/entities.js` `rollCrit(baseDamage, bonusChance = 0, bonusMul = 0)`**：
  ```js
  rollCrit(baseDamage, bonusChance = 0, bonusMul = 0) {
    const cc = Math.min(CRIT_CHANCE_CAP, this.critChance + bonusChance);
    const cm = this.critMul + bonusMul;
    const isCrit = Math.random() < cc;
    return { damage: isCrit ? baseDamage * cm : baseDamage, isCrit };
  }
  ```
- **改 `src/weapons.js` `hitEnemy(e, baseDamage, knockX, knockY, color, critBonus = 0, critMulBonus = 0)`**：内部 `this.game.player.rollCrit(baseDamage, critBonus, critMulBonus)`。
- **星陨弩（starfall）携带暴击加成**：在 `MECH_FIRE.homing` → `fireHoming()` 生成 projectile 时，写入
  `critBonus: (player.weaponMods?.starfall?.critChance || 0)`、`critMulBonus: (player.weaponMods?.starfall?.critMul || 0)`；
  在 `updateProjectiles` 的 star/comet 命中分支调用 `hitEnemy(e, dmg, kx, ky, color, p.critBonus || 0, p.critMulBonus || 0)`。
- **默认不变量**：未投资时 `critBonus/critMulBonus = 0` → `rollCrit` 行为与现状逐字节一致。

> **风险点（见 §8）**：钩子 1+2 是 v1 唯一的"机制级"引擎改动（其余皆为纯字段赋值）。`fire()` 有 5 个武器分支 + `MECH_FIRE` 分发表，改动需逐一核对 `s.count`/`s.chains` 读取点，回归面中等。

### 钩子 3 · `player.lifestealToShield`（新字段 + 3 处回血位点改写）— 支撑 `bly_blood_lifeshield`

- **加在哪**：`src/entities.js` `Player.reset()` 增加 `this.lifestealToShield = false;`（默认 false = 行为不变）。
- **需改的 3 处吸血回血位点**（`src/weapons.js`，当前均为 `game.player.hp = Math.min(game.player.maxHp, game.player.hp + player.lifesteal);`）：
  - `aura` 循环（line 655）
  - `whip` `applyWhip`（line 730）
  - `sanguine` `fireLifesteal` / `tickBloodpact`（line 904–905）
  - **统一改写为**（溢出转盾，封顶 `maxShield`）：
    ```js
    if (player.lifesteal > 0) {
      const before = player.hp;
      player.hp = Math.min(player.maxHp, player.hp + player.lifesteal);
      const healed = player.hp - before;
      if (player.lifestealToShield && healed < player.lifesteal && player.maxShield > 0) {
        const over = player.lifesteal - healed;
        player.shield = Math.min(player.maxShield, player.shield + over);
      }
    }
    ```
- **`bly_blood_lifeshield.apply`** 置 `g.player.lifestealToShield = true`（§3.2 已给）。

### 钩子 4 · `startRun` 注入循环（§1.1）— 已描述，零侵入 ALTAR

- 在 `game.js:233-235` ALTAR 循环之后追加 SKILL_TREE 并列循环；不动 ALTAR、不动 `startRun` 其余逻辑。

---

## 6. 洗点（respec）规格

### 6.1 触发入口
- 技能树屏幕（与祭坛并列的独立屏）底部「重置」按钮；仅在该屏、非对局中可点。
- 点击 → 弹确认框，显示：将返还总额、手续费、重置后净余额。确认后执行。

### 6.2 手续费（具体数字，防通胀）
```
respecFee = max(25, floor(refundTotal * 0.05))
```
- **25** = 固定地板（匹配 brief 示例"25 灵魂"），覆盖小额退款场景。
- **5%** = "返还额极小值"条款；随投资规模线性增长但始终保持小额。
- **示例**：退款 3000 → 费 150（≈1 局 normal）；退款 13 750（全树）→ 费 687（≈1–2 局 hard）。与"≈1–2 局灵魂"吻合，且**每次重置净损 5% 灵魂 → 无法刷灵魂、无通胀**。
- 斜率 5% 标注为 **[待真机校准]**（可按手感调到 3%–8%，但保持"小额 + 不通胀"）。

### 6.3 `buySkillNode(id)` 语义（幂等，防连点/重复扣费）
```js
export function buySkillNode(id) {
  const def = SKILL_TREE.find((n) => n.id === id);
  if (!def) return { ok: false, reason: 'not_found' };
  const s = loadSouls();
  if (s.tree.includes(id)) return { ok: false, reason: 'owned' };            // 幂等：已购不重复扣
  for (const p of def.prereq || [])                                            // 前置链
    if (!s.tree.includes(p)) return { ok: false, reason: 'prereq' };
  if (def.gateReq) {                                                          // 门槛
    if (def.gateReq.cleared && !def.gateReq.cleared.every((c) => s.cleared.includes(c)))
      return { ok: false, reason: 'cleared' };
    if (def.gateReq.achievement && !def.gateReq.achievement.every((a) => s.achievements.includes(a)))
      return { ok: false, reason: 'achievement' };
  }
  if (s.balance < def.cost) return { ok: false, reason: 'balance' };
  s.balance -= def.cost;
  s.spent += def.cost;
  s.tree.push(id);
  saveSouls(s);
  return { ok: true };
}
```

### 6.4 `respecTree()` 语义
```js
export function respecTree() {
  const s = loadSouls();
  const refund = SKILL_TREE.filter((n) => s.tree.includes(n.id))
                           .reduce((sum, n) => sum + n.cost, 0);
  const fee = Math.max(25, Math.floor(refund * 0.05));
  if (s.balance < fee) return { ok: false, reason: 'fee', fee, refund };      // 需手头有足额手续费
  s.balance += refund;          // 灵魂【全额返还】
  s.balance -= fee;             // 扣除【一次性小额手续费】
  s.tree = [];                  // 清空已购节点
  s.treeResets += 1;            // 计数 +1（统计/成就用）
  saveSouls(s);
  return { ok: true, fee, refund };
}
```
- **与 `loadSouls()` 协作**：每次 `buySkillNode`/`respecTree` 内 load→改→save 一次性完成，无中间态；`tree` 清空后下一局 `startRun` 不再注入任何 `apply`（因 `weaponMods` 每局 `reset()` 归 `{}`，无残留）。
- **幂等防连点**：UI 在请求返回前禁用按钮；`s.tree=[]` 后再点 respec → `refund=0` → `fee=25` 且 `balance<25` 时返回 `fee` 失败，不会重复计数。
- **备选（更友好）**：若担心"手头无 25 灵魂无法重置"，可改为 `s.balance = s.balance + refund - fee`（从返还额内扣费，永不因余额不足阻塞）。v1 采用明确两步（全额返还 + 手续费），若实现期发现体验问题再切备选。

---

## 7. 风险与缓解

| 风险 | 等级 | 缓解 |
|---|---|---|
| **双 sink 失衡** | 低 | 树成本 160 起、全树 13 750，均远高于祭坛（顶 220 / 全 960）；树=长期投资、祭坛=基础盘，效果空间不重叠（祭坛扁平永久 / 树结构化前置）。监控"整树可解锁局数"，若 < 15 局上调 keystone 成本。 |
| **主导策略（dominant build）** | 中 | `eco` 分支 `soulGainMul` 自乘是潜在"滚雪球"——但仅返还更多灵魂供再投资，不直接给战力；且需先投入多节点才到 keystone。缓解：① `eco_keystone_hoarder` 软上限 `soulGainMul ≤ 4.0`；② 不建议把 `eco` 设为唯一最优开局（combat 节点直接决定 hard 生存）。真机观察 eco 使用率，若过高则下调 `eco_gain*` 乘数（1.15→1.10）。 |
| **认知过载（39 节点导航）** | 中 | ① 分支 gate 锁定：未购 `xxx_root` 则该支节点全灰显不可点；② 视觉层级（gate=虚线环 / keystone=金色六边形辉光 / stat=圆 / modifier=方）；③ UI 分支切换 tab + 详情卡显示前置链与锁定原因；④ 移动端缩放/热区（P2，不影响 v1 桌面）。 |
| **数值通胀** | 低 | respec 每次净损 5% 灵魂，无重复获利路径；`soulGainMul` 受 4.0 软上限；不设全局灵魂上限，靠成本曲线自然拉长回收（沿用 `soul-currency.md`）。 |
| **难度斜率未校准** | 待校准 | 所有具体成本/乘数/手续费斜率均按投放速率估算，标注 `[待真机校准]` 处（eco 软上限、respec 5%、各 modifier 增量）需在真机按"整树解锁局数 18–30"反推微调。 |

---

## 8. 验收 / 测试断言建议（给工程师，参考提案 §8）

- `buySkillNode('war_dmg')` 后 `loadSouls().tree.includes('war_dmg')` 且 `balance` 扣 180；重复购买返回 `owned` 不重复扣。
- `buySkillNode('war_keystone_omni')` 在 `war_dmg` 未购时返回 `prereq` 失败。
- `buySkillNode('nfr_keystone_endgame')` 在 `cleared` 不含 `'hard'` 时返回 `cleared` 失败；写入 `'hard'` 后成功。
- `startRun()` 后：`war_dmg` 已购 → `player.damageMul` 较基线 +0.08；`nfr_thorns` 已购 → `player.thorns===20`；`war_axe_extra` 已购 → 实际投掷 axe 数量 = `s.count + 1`（构造最小对局验证）。
- `respecTree()` 后：`tree===[]`、`balance === 旧余额 + 退款 - 手续费`、`treeResets+1`；旧档（无 `tree` 字段）`loadSouls()` 不报错。
- 引擎不变量：未购任何 modifier 时 `player.weaponMods` 为空对象、`rollCrit(100)` 暴击率 == `critChance`（无加成），与现状逐字节一致。

---

## 9. 一句话总结（交付回执）

- **节点总数**：**39**（gate 6 / stat 20 / modifier 6 / keystone 7），覆盖全部 5 分支 + 4 类型。
- **各分支节点数**：war 9 / bly 8 / nfr 8 / eco 6 / utl 8。
- **成本区间**：gate 250–350；stat 160–360；modifier 280–360；keystone 650–850；全树解锁合计 ≈ **13 750** 灵魂。
- **需要新增的引擎字段数**：**4 类钩子**（① `player.weaponMods` 对象 + `fire()` 4 处循环读取 + starfall 携带 `critBonus`；② `rollCrit`/`hitEnemy` 增加逐武器暴击参数；③ `player.lifestealToShield` + 3 处回血位点改写；④ `startRun` 并列注入循环）。其中 **2/3/4 真实落地成本集中在武器与回血代码路径**，stat 类节点（含已生效的 `thorns`/`nightDmgReduction`/`statusAmp`/`soulGainMul`）零引擎改动。
- **v1 实现风险最高的 1–2 点**：① **钩子 1+2（weaponMods + 逐武器暴击）**——这是唯一"机制级"引擎改动，`fire()` 多分支 + `MECH_FIRE` 分发表需逐点核对 `s.count`/`s.chains`/`rollCrit` 读取，回归面中等，是工期与 bug 的主要来源；② **主导策略（eco 滚雪球）**——`soulGainMul` 自乘若未被软上限/使用率监控约束，可能演化为"唯一最优开局"，需在真机优先观察并预留下调旋钮。
