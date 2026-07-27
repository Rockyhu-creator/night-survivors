# 夜裔幸存者 · 神器扩充设计方案（v2.0 预案 / 或分批 1.13+1.14）

> **状态**：设计阶段（仅方案，未执行任何代码/素材）。日期 2026-07-27。
> **参与专家**：design-strategist（文策渊）/ engineering-lead（程基岩）/ art-director（林绘澄）
> **满足用户 4 点需求**：① 新武器 × 无搭配被动 → 新神器　② 复用现有文生图素材管线　③ 性能护栏防掉帧　④ 图鉴 + 新手指引 + 合成指引同步更新

---

## 0. 主理人摘要 · 三个必须先拍板的决策

**D1 · 覆盖范围 / 版本号**（设计专家建议）
- **A) 2.0 大版本，一次性覆盖全部 8 个无搭配被动**（主推）。理由：还清 S 档「6 被动不进 RECIPES」技术债 + 2 个老孤儿，达成「无孤儿被动」完整体验，足以撑大版本；同屏预算受 `MAX_WEAPONS=6` 槽硬上限保护，性能可控；新增内容以复用模式为主，边际成本低。
- **B) 分两批去风险**：`1.13` = critrate / critdmg / shield / regen（4 个，先验证管线+性能）；`1.14` = dodge / shieldregen / armor / guard（剩余 4 个）。降低单版本认知负荷与校准风险。
- 倾向 **A**，但由你定。

**D2 · 新神器稀有度**：8 个统一 `normal`（图鉴/合成指引明示配方，便于探索，主推）　vs　部分改 `hidden`（保留惊喜但图鉴显示 `???`，与「明示配方」诉求冲突，不推荐）。

**D3 · 入池策略**：8 新武器 / 8 神器是否全部默认进升级池 + 图鉴？还是先 `hidden` 灰度、用真机数据再全开？

**D4 · build 收敛 vs 认知负荷**：16 武器是否稀释收敛？是否下调 `weaponNew` 权重或加「已拥有少 → 提新武器权重」逻辑以保心流？

---

## 1. 现状诊断（校正：武器实为 8 把，非 9）

- 武器 **8** / 被动 **13** / 神器 **10** / 配方 **10**（以 `src/data.js` 代码为准）。
- **无搭配被动（无 RECIPES）共 8 个**：`guard` `regen` `critrate` `critdmg` `shield` `shieldregen` `armor` `dodge`。
  - 其中 `critrate/critdmg/shield/shieldregen/armor/dodge` 正是 S 档新增时显式标「不进 RECIPES」的 6 个被动——现在是待补的坑。
  - 已被占用的被动：`boots`(×3) / `magnet` / `heart`(×2) / `tome`(×3) / `greed`。
- ⚠️ 主理人 Phase 0 初判写「武器 9 把」为笔误，三位专家实证代码为 8，本方案以 **8** 为准（扩充后 → **16 武器 / 18 神器 / 18 配方**）。

---

## 2. 设计（design-strategist）

### 2.1 八把新武器（每把配对 1 个无搭配被动，机制均正交现有 8 把）

| 武器 id | 中文 | 配对被动 | 机制（正交点） |
|---|---|---|---|
| `starfall` | 星陨弩 | `critrate` 致命专注 | 追踪弹 homing（曲线追敌，最吃暴击率） |
| `judgment` | 断罪之锋 | `critdmg` 毁灭之刃 | 重刺 heavy thrust（近距超高伤单次，最吃暴击伤） |
| `phantom` | 幻影裂片 | `dodge` 魅影身法 | 分裂弹 splitting（命中后裂为 N 碎片） |
| `aegis` | 守护结晶 | `shield` 幽能屏障 | 部署哨卫 deployable sentinel（首个可放置驻留单位） |
| `warden` | 回响哨卫 | `shieldregen` 灵能回响 | 环绕 Orb orbiting（贴身公转法球自动射击） |
| `maul` | 碎甲重锤 | `armor` 暗夜铠甲 | 扩张冲击波 expanding shockwave（周期性向外扩散环） |
| `sanguine` | 噬血荆棘 | `regen` 血色再生 | 吸血穿刺弹 lifesteal bolt（首个命中回血基础武器） |
| `resolve` | 镇魂钟鸣 | `guard` 钢铁意志 | 触发陷阱 rune trap（踏入触发 AoE 爆发） |

> 正交性检查：现有 8 把覆盖「直射飞刀 / 地面灼烧 / 回旋穿透 / 连锁雷 / 贴身光环 / 横扫一线 / 多向放射 / 大范围回旋镰」。上表 8 把取自未使用的形态原型（追踪 / 重刺 / 分裂 / 哨卫 / 环绕 / 扩张波 / 吸血弹 / 陷阱），逐一与现有区分。
> 每把 5 级数值表（字段随机制：damage / cooldown / count / pierce / speed / length / width / radius / range / splits / shotCD / duration / triggerRange / heal 等）全部 `[PLACEHOLDER]`，待真机校准。

### 2.2 八个新神器（配方 = 新武器 + 配对被动，reaper 式门控）

**范式**：基础形态 = 强化武器本体（进化为神器即生效）；**觉醒专属机制门控「持有配对被动」**才触发。进化不移除被动，故觉醒在进化后恒常生效——这是「投资该被动」的应有回报，与 `reaper` 一致。
**双硬指标**：① 直伤 ≥ 满级原武器 ×1.3；② 含专属机制总效能 ≥ ×1.6。
**视觉强制区分**：每个神器给主色锚点（渲染层 `tint` + 缓存辉光贴图，复用 `getGlowSprite` 加法合成，禁止逐帧 `shadowBlur`）。

| 神器 id | 中文 | 配方 | 觉醒机制（门控配对被动） | 直伤 | 含觉醒总效能 | 配色锚点 |
|---|---|---|---|---|---|---|
| `fatalis` | 命运星轨 | starfall + critrate | 暴击命中的星铁额外迸射 2 枚迷你追踪碎片 | ×1.4 | ≈×1.8 | 琥珀金 `#ffcf4d` |
| `retribution` | 断罪终焉 | judgment + critdmg | 暴击十字爆裂 + 对生命<30% 敌人处决 | ×1.5 | ≈×1.75 | 绯红白 `#ff5a5a`/`#fff4e6` |
| `mirage` | 幻影千袭 | phantom + dodge | 每枚裂片残留滞留「魅影」0.6s 持续 AoE | ×1.4 | ≈×1.7 | 紫罗兰 `#9b6cff` + 青 `#5ad1e6` |
| `bastion` | 永恒壁垒 | aegis + shield | 护盾>0 时哨卫每发伤害 20% 转化为你的护盾 | ×1.3 | ≈×1.8 | 钢青 `#7fd4ff` |
| `sentinel` | 回响守望 | warden + shieldregen | 法球每 2s 向玩家发「护盾恢复」脉冲（叠加 shieldregen） | ×1.35 | ≈×1.65 | 翡翠 `#6cffb0` |
| `cataclysm` | 碎甲天罚 | maul + armor | 冲击波伤害 += 你的 `armor` 值，并击退/硬直 | ×1.4 | ≈×1.7 | 铁橙 `#ff9a3c` |
| `bloodpact` | 血契荆棘 | sanguine + regen | 吸血转 HoT 叠层；满血溢出转临时护盾 | ×1.4 | ≈×1.8 | 深红 `#ff3b5c` |
| `absolution` | 镇魂赦令 | resolve + guard | 站己方符文内时受伤额外降低 `guard` 减伤百分比 | ×1.35 | ≈×1.7 | 苍金 `#e8d8a0` |

### 2.3 模块更新规格

- **图鉴（codex）**：武器/神器/配方均数据驱动，`buildCollectionData` 自动遍历，**零 ui.js 改动**。建议给被动图鉴每张卡加一行「可合成 ✨神器 = 满级🗡武器 + 本被动」（用 `RECIPES.filter(r=>r.passive===id)`）——顺带让 5 个旧已配对被动首显配方，全图鉴一致；13 被动至此全部「可进化」。
- **新手指引（index.html #guide-screen）**：现有文案已 stale（写「8 武器 + 9 被动 + 10 配方」）。改为 16 武器 + 13 被动 + 18 配方（N-proof 文案），新增「觉醒机制」说明行（进化后持被动即觉醒专属机制）；修正「9 种被动」为 13。纯 DOM 文本改动，无 JS 逻辑改动。
- **合成指引（upgrade.js Plan A/B）**：`readyRecipeForPassive`（金徽章）/ `pendingRecipesForPassive`（精炼行）均遍历全局 `RECIPES`，**零代码改动**即接通。8 个新神器统一 `normal`（明示配方，便于探索）。

### 2.4 设计支柱对齐（心流 + 自我决定论）

- **暗黑哥特**：全部主题/配色锚定哥特暗调，无漂移。
- **割草爽感**：8 种新清场形态（追踪/重刺/分裂/哨卫/环绕/波/吸血/陷阱）扩充爽感维度。
- **心流**：平滑中期目标（集齐武器+被动→开箱进化）、性能护栏保帧率、合成指引降不确定性。
- **自我决定论**：自主（8 条可见 build 路径 + 觉醒由被动投资解锁）、胜任（明确可达的进化目标 + 即时数值反馈）、关联（全图鉴配方网 + 「无孤儿被动」叙事）。

---

## 3. 工程管线 + 性能护栏（engineering-lead）

### 3.1 接入管线（查表化，横向扩展 N 把）

**核心改造**：把 `weapons.js` 按 id 的巨型 if/else（`fire()` :338 / `updateArtifact()` :167 / `render()` :914）解耦为**机制查表**——`MECH_FIRE[mech]` / `ARTIFACT_BEHAVIORS[id]` / `VISUAL_PRESETS[visual]`。每把武器在 `data.js` 声明 `mech` + `visual` 字段。

| 步骤 | 文件 / 函数 | 改动 |
|---|---|---|
| ① | `data.js` → `WEAPONS` | 加 N 个新条目：`{ id, name, icon, maxLevel:5, desc, mech, visual, levels:[…] }` |
| ② | `data.js` → `PASSIVES` | **0 改动**（复用现有 8 个无搭配被动） |
| ③ | `data.js` → `ARTIFACTS` | 加 N 个：`{ id, name, icon, baseWeapon, rarity:'normal', desc }` |
| ④ | `data.js` → `RECIPES` | 加 N 行 `{ weapon, passive, artifact }`（唯一接线点） |
| ⑤ | `assets.js` → `files` | 加 `weapon_<id>` / `art_<id>` 键（loadAssets 自动遍历） |
| ⑥ | `weapons.js` → `MECH_FIRE` | 复用既有 mech → **0 改动**；仅全新机制才加 1 handler |
| ⑦ | `weapons.js` → `ARTIFACT_BEHAVIORS` | 注册 `ARTIFACT_BEHAVIORS[id] = (ws, weapon, dt)=>{…}` |
| ⑧ | `weapons.js` → `VISUAL_PRESETS` | 渲染走 `VISUAL_PRESETS[visual]`（sprite 键/尺寸/辉光色/additive） |
| ⑨ | `evolution.js` → `performEvolution` | **0 改动**（已纯数据驱动） |
| ⑩ | 缺图兜底 | `sprite()` 缺图返回 null，已有 `if (img)` 纯色矩形兜底，不崩 |

**关键收益**：复用既有 `mech` 的新武器只需 ①③④⑤ 四步纯数据 + 资源，`weapons.js` 逻辑 0 改动。

### 3.2 性能红线 5 条（落地即检）

1. **RL1 · 零逐帧 shadowBlur**：武器/神器渲染禁 `ctx.shadowBlur`，仅用缓存辉光（`getGlowSprite`/`getMatrixGlowSprite`）。CI grep 阻断。
2. **RL2 · 所有生成桶硬上限**：projectiles / pools / bolts / slashes / vials / runes 均设 CAP（建议 `PROJECTILE_CAP=600`、`POOL_CAP=60`、`BOLT_CAP=80`、`SLASH_CAP=40`、`VIAL_CAP=40`）+ oldest-first 回收，禁无界增长。
3. **RL3 · 热循环零分配**：update/fire/render 禁每帧 `new Array()`/`[...].sort()`，复用 scratch 与 `enemiesNear()` 网格查询。
4. **RL4 · 加法辉光必走缓存 sprite**：lighter 残影/光晕用 `getGlowSprite` 键控缓存，禁每帧 `createRadialGradient`。
5. **RL5 · 单神器 ≤12 draw op / 全神器合计 ≤250**：render() 插桩计数，test_game 压测断言。

> 新神器觉醒特效上限建议：持续光环半径 ≤180（禁全敌扫）；多向弹幕单次齐射 ≤8；轨道环绕实体 ≤8；留场领域/符文 ≤24（对齐 `thunderRunes`）。dpr=2 下辉光按逻辑尺寸建离屏 canvas，交给 `setTransform(dpr)` 放大，禁预乘 dpr（参考 v0.39 loot beacon 坑）。

### 3.3 模块技术触点

- **图鉴**：数据驱动，**零代码改动**（前提：icon 键存在且 assets.js 已映射）。
- **新手指引**：纯 `index.html` 文本改动（N-proof 文案，避免每版改 DOM）。
- **合成指引**：自动纳入，**零代码改动**；`rarity:'hidden'` 自动遮罩为 `???`。
- ⚠️ **进化冲突**：强制 1:1 配对到 8 个无搭配被动，避免 `findEvolvableRecipe` 返回首个匹配导致金徽章指向非预期神器。

### 3.4 test_game.py 断言更新

- 计数：`codex total` 31 → 31+2N（N=8 → **47**）；武器 8→16、神器 10→18、被动 13 不变。建议抽成 `len(WEAPONS)` 式动态断言（N-proof）。
- 补 N 个新配方进化路径 + 新武器可装备/开火命中 + 资源键存在性断言。
- **新增性能护栏断言**：满 build（6 武器 + 6 神器 + 400 敌）跑 10s，断言 `projectiles.length ≤ PROJECTILE_CAP`、`fx.particles ≤ 300`、`fx.numbers ≤ 120`、单帧 draw ≤ 250。

### 3.5 风险清单

机制正交性（约束在 6 种既有 mech 内）｜进化冲突（1:1 配对缓解）｜回归测试面（计数断言必先改）｜**性能回归（最大不确定项，靠桶上限+单神器预算+压测）**｜资源缺口（art 须联调前交付）｜dpr 双缩放（照搬 `ui.js:202` loot beacon 写法）｜对象池泄漏（持续特效自带 cap）｜S3 槽位竞争（确认新武器权重不破坏「每层至少 1 武器向」）｜图鉴单屏过长（滚动可接受）。

---

## 4. 素材管线复用（art-director）

### 4.1 选型（复用现有文生图 / 像素流程）

- **武器精灵 `weapon_<id>.png` → 主路径程序化 `gen_assets.py`**（仿 `gen_weapon_scythe` / `gen_art_storm` 模板，S=40、save scale=2、80×80）。理由：降级零风险、与多数程序化武器 + 全神器视觉统一、主题色/剪影精确可控满足「视觉强制区分」。
- **神器图标 `art_<id>.png` → 同样程序化 `gen_assets.py`**（现有 10 神器全程序化，最强一致性基线）。
- **例外（不默认）**：个别标杆武器若要 AI 观感，走「内置 ImageGen（非降级 Trae 端点）→ 泛化像素化后处理 → 入 AI_OWNED 保护」兜底。
- **降级保证**：主路径纯本地零 API，Trae 降级无影响；AI 兜底用未降级的内置 ImageGen；**禁用 `gen_icons.sh`**（Trae 新 prompt 恒返占位图 176626B）。建议把 `gen_passive_pixels.py` 像素引擎抽成 `pixel_pipeline.py` 共享库（仅 AI 兜底路径用），保证 weapon/art/passive 观感一致。

### 4.2 命名 / 注册 / AI_OWNED

- `weapon_<id>.png` / `art_<id>.png`，`<id>` 与游戏数据表完全一致（运行时 `loadImage('weapon_'+id)` 直解析，错配=缺图）。
- 新程序化文件**不进 AI_OWNED**（进了反会被 `save()` 跳过不落盘，错误）；仅 AI 兜底资产才进。
- `gen_assets.sh` 当前已是 `rm -f $AI_FILES`（15 张），非全量删；真脆弱点是 `AI_FILES`(.sh) 与 `AI_OWNED`(.py) 两份名单漂移 → 建议抽单一真相源 + `--dry-run` 硬断言。**本任务全程只跑 `gen_assets.py`，绝不调用 `gen_assets.sh`**。

### 4.3 精灵规格 + 配色锚点

- 80×80 RGBA 透明底；1px 暗描边 `(8,4,14)`；3 档色调体积感；`image-rendering:pixelated`。
- 每把新武器一个主题色（对齐 §2.2 配色锚点）：琥珀金 / 绯红白 / 紫罗兰+青 / 钢青 / 翡翠 / 铁橙 / 深红 / 苍金。
- 区分必须**剪影 + 色相 + 明度三维**（色盲友好：红/绿高危对，绝不作为唯一区分）。

### 4.4 可访问性 / 性能

- PNG 只载静态精灵；脉冲/辉光/粒子全交运行时加法合成。
- 16 张新图总量 <100KB，零压力。

### 4.5 产出清单（N=8）

```
weapon_starfall.png   art_fatalis.png
weapon_judgment.png   art_retribution.png
weapon_phantom.png    art_mirage.png
weapon_aegis.png      art_bastion.png
weapon_warden.png     art_sentinel.png
weapon_maul.png       art_cataclysm.png
weapon_sanguine.png   art_bloodpact.png
weapon_resolve.png    art_absolution.png
```
共 16 张 80×80，全走 `gen_assets.py` 幂等生成（字节稳定、跳过 AI_OWNED）。

---

## 5. 实施路线（确认后）

1. 你拍板 **D1~D4**。
2. design-strategist 出逐系统 GDD 八节 + 性能预算表（数值填默认中值）。
3. art-director 按 id 生成 16 张 PNG（`gen_assets.py`）+ `assets.js` 注册。
4. engineering-lead 落查表化管线 + 8 配方 + 性能护栏 + 模块文案。
5. quality-lead e2e（计数 31→47、新配方进化路径、性能压测）+ 真机帧率抽帧。
6. 文档（CHANGELOG / HANDOFF）+ 推送。

---

## 6. 设计红线自查

- **无单一必胜 build**：每个神器门控特定被动，单局至多 6 武器槽 + 需该被动，无法集齐 8 神器。
- **无经济通胀**：灵魂/祭坛经济本次不动，新内容不改变 `SOUL_REWARDS`/掉落。
- **认知过载可控**：16 武器 + 18 配方偏多，以合成指引 Plan A/B + 图鉴配方 + 引导文案 +（可选）分批发布缓解。
- **支柱无漂移**：全内容哥特暗调、服务割草/心流/SDT。
