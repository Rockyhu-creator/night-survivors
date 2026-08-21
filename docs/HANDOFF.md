# 夜裔幸存者 · 项目 Handoff 文档

> 供新会话窗口快速接手项目的上下文文档。最后更新：2026-08-21（v5.5：肥波尿液攻击修复(攻击触发去掉70px贴身死锁改ENGAGE_RANGE内即发动,尿液飞溅放大6x5+描边)+宠物商店删「无宠物」卡; v5.4：宠物完全不可见修复(渲染坐标未转屏幕坐标:PetSystem.draw/Pet.draw漏传cam,世界坐标直接画到已平移ctx→屏幕外;改 x-cam.ox/y-cam.oy+水洼飞溅同步); v5.3：宠物拾取不生效修复(_hasNearbyGem误用this.game.pickupSystem应为this.game.pickups)+跟随算法重写(贴身跟随血裔为主/拾取攻击短暂偏离/FOLLOW_LEASH=240钳制/共用行为CD=2.0s); v5.2：宠物屏幕钳制+吸附范围扩大(magnetRadius 80→170/pickupRadius 30→52)+永夜使徒初始光环修复(渲染层漏 innateWeapons,重构 drawAuraRingColored 支持紫配色)+宠物改名肥波/肥强; v5.1：宠物选中失效修复+美短图标暗底可见性+微信域名验证; v5.0：宠物战斗拾取系统; v4.3.6：永夜使徒无初始武器死锁修复(槽外固有永夜光环起手); v4.3.5：永夜化身boss重绘；v4.3.4：apostle portrait 彩色重绘；v4.3：P9 遗漏补漏 portrait 选择卡片立绘同步；v4.2：P9 白色系精灵暗底重绘 + 血裔角色差异化立绘；P3b-3~5 精英内容(差异化行为/保底掉落/图鉴分组/HUD) + P4-1 精英悬赏 + P4-2 连杀Combo + P5-1 美术占位统一工具(带标签方块+HTML图标防碎图) + P5-2 移动端真机门禁(≤12ms软告警) + P5-3 精灵缺失断言; v3.14 仓库卫生：.gitignore 补 vite.config.js.timestamp-* 忽略规则(vite每次dev/build生成新临时产物持续污染git status)+§11 回填 v3.13 文档提交哈希 ae95024 并新增「占位行回填」维护红线(制度化先回填再插新行,根治461a5a5那类哈希丢失),未改 src/ 无运行时回归面;v3.13 技能树重叠常驻回归用例(tests/skilltree_overlap.py 8档:桌面3档+真触屏移动端5分支全遍历)+test:skilltree脚本(依赖dev server,刻意不接prebuild);v3.12 桌面技能树布局常量校正(CARD_H 104→160/ROW_H 126→178)消除父子纵向重叠;v3.11 移动端技能树同层重叠修复(renderSkillTree列分配重写:首前置父严格树消菱形坍缩+汇聚节点取双亲中点+按深度层量化列号兜底);v3.10 技能树校验护栏(validate_skilltree.mjs+prebuild钩子)；v3.9 移动端技能树交互重构：顶部分段控件切分支+单分支竖向链+底部抽屉+最小缩放0.6+命中区修复；v3.8 资源加载优化：内容哈希精准缓存+分级懒加载；v3.7 重置弹窗暗黑风+移动端长按复制屏蔽+技能树二叉化重构+前置审计）

---

## 0. ✅ 大版本 S 档（属性面板 + 被动扩展）——v1.0 已开发完成并推送

**线上现状**：v1.0（`1e20a0115bd82da06063a40d1ecd655b223e8bea`）已推送上线，在 v0.39 基础上落地 S 档全部内容；v1.1（`2dc7f04`，见 §11）为被动徽标视觉重设计（D5 像素 icon 落地细化）；**v1.4 将 13 个被动 icon 从 CSS box-shadow 8×8 方框升级为 AI 文生图（ImageGen）+ Pillow 像素化产出的 80×80 哥特像素 sprite（`passive_*.png`），并纳入 AI_OWNED 保护**——至此被动 icon 路线由「零 PNG 程序化」转为「AI 美术 + 脚本后处理」。v0.39 修复了圣光矩阵 shadowBlur 卡顿与宝箱指引 dpr 缩放。

**大版本状态**：**已开发完成**。用户确认「根据方案进入开发」后，按主方案 v1.1 的 D1~D5 决议落地 9 项任务（属性面板 + 6 新被动 + 同类合并 + 分类权重 + 暴击接入 + 护盾条 + CSS 徽标）；e2e 全量回归 ALL PASS（零控制台报错）。

**暂停入口（v1.3 补全）**：桌面端右上角 `#btn-pause`（⏸，紧邻静音按钮左侧，`z-index:50`，`.touch-device` 下隐藏）+ 键盘 Esc/P；触屏端 `#touch-pause-btn`（mobile-controls.js 动态创建，自带）。暂停层 `#pause-overlay` 含「继续」「属性(Tab/C)」。护盾机制（受击扣盾不扣血 / 受击 3s 内不回盾 / 3s 后自然回盾(基础速率+被动加成) / 封顶）v1.3 实测无 bug；v1.12 起新增 `SHIELD_REGEN_BASE` 基础回盾速率，无「灵能回响」被动也能自然回盾。

**版本号规范（用户 2026-07-26 指定）**：S 档为**首个大版本 v1.0**；今后「大版本」（多系统/机制跃迁）跳主版本号 **1.0 → 2.0 → 3.0…**；大版本内小补丁/热修用次版本号 **x.1 / x.2…**（如 1.1、1.2）。每次发版同步 CHANGELOG + HANDOFF（含 §11 commit 历史）。

**方案文档**：
- 主方案：`docs/plans/2026-07-26-major-update-design.md`（**v1.1，以此为准**）
- 工程 GDD：`docs/plans/2026-07-26-s-tier-gdd.md`（**已同步 v1.1，D1~D5 决议落地**）

**已落地决策（D1~D5）**：
- **D1** 局内挑战任务移出 S 档（降 M 档，未在 S 档实现）。
- **D2** 暴击按默认值落地：`critChance +5%/级`（基础 0.05，硬上限 0.75）、`critMul +15%/级`（基础 1.5）。`player.rollCrit()` 在 `weapons.js hitEnemy` 接入，DOT 每 tick 独立 roll；暴击飘字金字放大 +「暴击 」前缀（14/帧节流）。
- **D3** 被动分类权重（`buildPool` 内 `w = 1 + 0.6·catCount[category]`）+ 同类被动合并：删 `swift`/`rage`，`boots` 吸并移速（+6%/级·ML99）、`tome` 吸并全伤（+8%/级·ML99）。保底：**池中有武器时优先武器**（保证每层可拿武器），无武器可给时才退化为进攻向被动（防"三张全生存向"卡 build）。
- **D4** 护盾条：`#shield-bar` 置于 HP 条下方独立灰底（`#2a2a33`）细条，蓝色盾量段；护盾恢复=受击打断 `SHIELD_REGEN_DELAY=3`s 后开始自然回盾，`rate = SHIELD_REGEN_BASE(2/s, 基础) + shieldRegen(被动加成)`，封顶 `maxShield`（v1.12 起无被动也能回盾，详见 entities.js）。
- **D5** 被动 icon 视觉方案（已演进）：v1.0 初版为 `PASSIVE_BADGE_SYMBOL` 单字 + `.passive-badge`；**v1.1 重设计为 8×8 CSS box-shadow 像素 sprite**（`passiveBadge()` 用 `--pb-px` + `box-shadow` 逐格拼图 + 哥特画框）；**v1.4 废弃 CSS 方案**，改为 **AI 文生图（`gen_passive_pixels.py`：ImageGen 原图 → 众数色背景键控 → 40 网格 LANCZOS → NEAREST 2x 至 80×80 → 1px 暗描边 `(8,4,14)`）→ `passive_*.png`**，渲染侧 `passiveBadge()` 改输出 `<img class="passive-badge">`（`object-fit:contain` + `image-rendering:pixelated`）。新 13 张 `passive_*.png` 已加入 `gen_assets.py` AI_OWNED 保护集，防程序化生成器覆盖。

**S 档最终范围（已交付）**：① 9 属性机制（critChance/critMul/shield+maxShield/shieldRegen/armor/dodgeChance 六字段；承伤顺序：闪避→防御 `max(1,(raw-armor)×damageTakenMul)`→护盾→扣血）② 6 新被动（致命专注/毁灭之刃/幽能屏障/灵能回响/暗夜铠甲/魅影身法，均 ML5）③ 同类被动合并 + 分类权重 ④ 属性面板 UI（`#stats-panel`：暂停内嵌 + 结算屏，Tab/C 切换）⑤ 护盾灰色细条。**未做（留 M 档）**：局内任务、新武器/神器、新怪词缀。

**被动总数**：13（boots/heart/tome/magnet/greed/guard/regen + critrate/critdmg/shield/shieldregen/armor/dodge）。图鉴卡片总数 47（16 武器 + 13 被动 + 18 神器）。

**其他注意**：`gen_assets.py` 旧 `gen_passive_rage/swift` 生成器产物（`passive_rage.png`/`passive_swift.png`）已于 v1.4 删除（孤儿、无引用）；13 张 AI 被动 `passive_*.png`（boots/heart/tome/magnet/greed/guard/regen/critrate/critdmg/shield/shieldregen/armor/dodge）现已纳入 AI_OWNED 保护集，重跑 `gen_assets.py` 不会覆盖。

**v1.11 小补丁（暗夜铠甲 icon 重制【误标为钢铁意志】+ 图鉴拆四分类）**：① `passive_armor.png` 由暗钢盔甲重写为亮底银盾 + 十字（亮度 48→197/255）——【此处为误改：把「暗夜铠甲」armor 当成了「钢铁意志」】，`gen_passive_pixels.py` 新增 `auto_brighten()`（Brightness/Contrast 兜底），armor 绕过 `key_bg`（亮底图 key_bg 会吃主体亮部）直接裁剪 bbox + LANCZOS 缩网格 + NEAREST 放大，质心偏移 (0.5,0.5) 居中清晰；② 游戏图鉴由「神器/怪物/武器」3 类扩为「被动/神器/怪物/武器」4 类独立屏——`index.html` 新增 `#codex-passives` 屏、`ui.js` hub 菜单 cats 扩为 4 个 + `renderCodexPassives()` 仅渲染被动、`main.js` 加 `btn-codex-passives-back`/`btn-codex-passives-topback` 事件绑定、`style.css` 屏幕规则/`#codex-hub`/`.gothic-btn`/touch 防御均加 `#codex-passives`（红色线：未动 15 张 AI_OWNED、未跑 gen_assets.sh）。

**v1.12 修复（icon 纠错 + loot beacon 隐藏 + 护盾自然回盾）**：① icon 纠错——`passive_armor.png` 还原为 v1.9 之前暗夜铠甲原版（git checkout v1.8 提交），`passive_guard.png`(真正的钢铁意志) 经 ImageGen 重做亮银骑士盾+十字（亮度 177、居中清晰）；② `src/ui.js` loot beacon 在 `showTitle()` 补 `hideLootBeacon()` 且 `updateLootBeacon()` 非 playing 态强制隐藏，通关/返回主界面不再残留宝箱圆圈；③ `src/entities.js`+`src/data.js` 新增 `SHIELD_REGEN_BASE=2` 基础回盾速率，护盾不受击 3s 后自然回盾（带「灵能回响」被动后共 3.5/s）。红线：未动 15 张 AI_OWNED 其他图、未跑 gen_assets.sh。

**v2.0 大版本跃迁（武器 8→16 / 神器 10→18）**：① 新增 8 件武器（starfall/judgment/phantom/aegis/warden/maul/sanguine/resolve），开火逻辑落地 `src/weapons.js` 的 `fire*` + `update*` 桶；② 新增 8 件神器（fatalis/retribution/mirage/bastion/sentinel/cataclysm/bloodpact/absolution，rarity:'normal'），经 RECIPES 与被动 critrate/critdmg/dodge/shield/shieldregen/armor/regen/guard 1:1 配对，由「满级对应武器 + 该被动」合成进化；③ 神器觉醒效果门控 `_awakened(weapon)`（仅当玩家持有配对被动时启用觉醒效果）；④ D4 新武器发现加成（`ownedWeaponKinds<4` 时 v2.0 新武器 `weapon-new` 权重 ×1.5，`NEW_WEAPON_BOOST=1.5`，后期按 `(1-0.85*late)` 衰减，src/upgrade.js）；⑤ RL2 性能硬上限 `enforceCaps()`（src/weapons.js `update(dt)` 末尾按桶 oldest-first 裁剪，`PROJECTILE_CAP=600/POOL_CAP=60/BOLT_CAP=80/VIAL_CAP=40/SLASH_CAP=40` + 环绕类 `MAX_SENTINELS=6/MAX_ORBS=8/MAX_SHOCKWAVES=12/MAX_RUNES=24` + `thunderRunes=24/bursts=12/mirageResidues=32`）；⑥ `src/entities.js` 新增 `stunTimer`（敌方眩晕跳过移动）与 `absolutionDR`（承伤链减伤，赦罪觉醒用）。可访问性：红/绿配对神器 裁决(retribution)/哨卫(sentinel) 仅靠色相易混淆，已通过亮度(luminance)差异区分。红线：未动 15 张 AI_OWNED、未跑 gen_assets.sh、未跑 `npm run build` 清 dist（用 `npx vite build --outDir .ns-build-2x` 验证）。

---

## 0b. 技能树 v3.0（元进度·独立层）

**定位**：跨局永久元进度，消耗灵魂（与灵魂祭坛并存双 sink），`localStorage` 存档（`loadSouls().tree/treeResets`），零污染 `ALTAR`/`startRun` 现有循环逻辑（仅追加并列注入循环）。

**结构（5 分支 × 4 类型 = 39 节点）**：
- 分支：征伐 `war`（武器/伤害）、血裔协同 `bly`（6 血裔深化）、永夜抗性 `nfr`（生存/终局）、灵魂经济 `eco`（灵魂获取）、通用机能 `utl`（冷却/暴击/吸血/闪避/拾取）。
- 类型：`gate`（开门无效果）/ `stat`（数值加成）/ `modifier`（武器机制修饰）/ `keystone`（强力节点，部分需 `cleared:['hard']` 或 `cleared:['normal']` 门槛）。
- 全树成本约 13,750 灵魂（gate 250~350 / stat 160~360 / modifier 280~360 / keystone 650~850）；高风险 keystone（使徒权能 `bly_keystone_apostle`、终焉守护 `nfr_keystone_endgame`）需 `cleared:['hard']` 门槛；噩梦投资子区 `eco_gate_nightmare` 需 `cleared:['normal']` 门槛。

**4 引擎钩子（src/entities.js + src/weapons.js + src/game.js）**：
- `Player.weaponMods = {}`（axe.count / lightning.chains / holywater.count / starfall.critChance,critMul）——武器机制修饰，默认空。
- `rollCrit(baseDamage, bonusChance=0, bonusMul=0)` 扩参（默认 0 = 行为不变）；逐武器暴击由 `weapons.js hitEnemy(e,baseDamage,knockX,knockY,color,critBonus=0,critMulBonus=0)` 透传 `rollCrit(...,critBonus,critMulBonus)`。
- `Player.lifestealToShield = false`（`bly_blood_lifeshield` 置 true）——吸血回血溢出转护盾。
- `game.js startRun()` 在 ALTAR 循环后并列 `for (const n of SKILL_TREE) if (soulsNow.tree.includes(n.id)) n.apply(this)`（不碰 ALTAR/其余逻辑）。

**购买 / 洗点（src/data.js）**：
- `buySkillNode(id)`：幂等（已购返 `owned`）、prereq 链校验、cleared/achievement 门槛、balance 校验、扣费写档。
- `respecTree()`：全额返还 `refund` + 一次性手续费 `fee = max(25, floor(refund*0.05))`（[校准] 5% 斜率待真机观察），`tree=[]`、`treeResets+1`。

**UI（src/ui.js / index.html / main.js / style.css）**：标题屏 `btn-skilltree`（含 `skilltree_menu.png` 图标，与祭坛/图鉴并列的菜单按钮）+ `skilltree-screen`；5 分支卡片三态渲染（owned/available/locked，locked 显 prereq/cleared 门槛文案）、点击购买、`btn-skilltree-respec`（confirm 显返还/手续费）、返回按钮。分支色：war 红 / bly 紫 / nfr 蓝 / eco 暗金 / utl 青绿。

**图标（public/assets/skilltree_menu.png + gen_skilltree_menu.py）**：80×80 像素风透明底 1px 暗描边，已注册 `gen_assets.py` AI_OWNED 防程序化生成器覆盖。

## 0c. v3.1 生存向平衡校准（基于无头模拟器量化）

**方法论**：`/tmp/balance_sim.mjs` 纯 Node 导入 `src/data.js` 常量，复刻 `computeSoulReward`（game.js:418）与 `statScale`（entities.js:188）真实公式，量出「灵魂经济可解锁性」+「敌人缩放曲线」。**无需 DOM/Canvas**，可随时重跑出对比表。

**关键量化结论**：
- 经济已收敛：单局灵魂硬顶 ~500（普通满 15min）+ 一次性首通（普通 50）；典型单局(死亡@8min)≈291。祭坛全买 4 局 / 血裔全解锁 3 局 / 各树门 1–2 局 / 全树 48 局（投满经济分支 ×2.6 后降至 19 局）。时间系数封顶是天然抗通胀闸 → **经济不需要动**。
- 生存曲线是死亡螺旋风险点：普通档 15min 末小怪 HP ×16.9、伤害 ×10.7，其中 9min 后永夜指数叠 ×1.82；叠加终局刷怪地板 0.18s/波 × 狼群 6–10 只 → 不可风筝怪潮。

**本轮改动（src/data.js / entities.js / game.js，单值可逆）**：
- `nightBase` easy/normal/hard：1.12/1.22/1.32 → **1.08/1.16/1.24**（后期夜战 ×1.82→×1.56；普通 15min 小怪 HP ×16.9→×14.5、伤害 ×10.7→×9.2，各 −14%）。
- 刷怪节奏地板 `Math.max(0.18, …)` → **`Math.max(0.22, …)`**（entities.js:442）：终局怪潮密度 −22%。
- 血瓶掉率 `0.025` → **`0.035`**（game.js:363）：缓解「掉血不可逆」。

**待真机试玩再迭代**：钟鸣脉冲节奏/觉醒镰刀数值（data.js:344-348 / weapons.js:559-571）、装饰密度（game.js:57）仍标 PLACEHOLDER；全树成本 13,750 与难度斜率是否过陡，需真机 DPS/存活数据回调。

**设计 / 美术规格**：`docs/plans/2026-07-29-skilltree-v1-spec.md`（39 节点目录/apply/钩子/洗点/断言）、`docs/plans/2026-07-29-skilltree-art-spec.md`（节点视觉/分支色）。

**验证**：`node --check` 全 OK；`/tmp/skilltree_v1_probe.py`（?debug）T1-T7 + 零控制台报错 ALL PASS（购买链/幂等/prereq 拦截/cleared 门槛 normal+hard/startRun 注入增量/洗点精确/不变量/39 节点）；`/tmp/skilltree_ui_smoke.py` 菜单按钮+图标+界面+39 卡+5 分支+返回 ALL PASS；`test_game.py` 全量 ALL PASS 零回归零报错。

---

## 0d. v3.2 技能树 UI 打磨（纯表现层 · 三件套）

**依据**：`docs/plans/2026-07-29-skilltree-ui-polish-design.md`（UX 规范：hover 字段层级/连线信息语义/解锁动画 UX）+ `docs/plans/2026-07-29-skilltree-ui-polish-art.md`（视觉规范：解锁 keyframes/tooltip 暗玻璃/typeline 视觉）。主理人整合裁决：解锁动画取 450ms；移动端 hover 降级为**点击卡片展开**（单真源）；连线不按节点类型分线型、流光仅 `lk-next`；owned 持久态统一绿边沿用 `.altar-card.owned`；`prefers-reduced-motion` 降级。

**改动文件**：`src/ui.js`（renderSkillTree 加 `data-id`/tooltip/justUnlocked + 新 `drawConnections`/`showTip`/`hideTip` + resize 重绘连线）、`src/style.css`（`.st-links` SVG overlay / `.st-tooltip` 浮层 / `.just-unlocked` keyframes / `.lk-*` 三态 / reduced-motion 媒体查询）。

**三大件**：
1. **节点详情浮层**：单实例 `.st-tooltip`（暗玻璃拟态 + 分支色描边），桌面 hover / 触屏点击卡片展开同一真源；含 节点名·类型·状态·完整效果·成本·**前置清单含各自 ✓/✗ 解锁态**。因 `.altar-card` 有 `clip-path` 切角，tooltip 挂在 `#skilltree-screen` 下（非卡片子元素，避裁切）。
2. **路径连线**：每分支 `.st-branch-grid` 内注入 `<svg class="st-links">`（`position:absolute; inset:0; pointer-events:none; z-index:0`，不挡交互、不引布局抖动）；按 `prereq` 算卡片中心画贝塞尔。`lk-done`(已点亮·分支色 glow) / `lk-next`(可解锁·虚线流光 `stLinkFlow`) / `lk-locked`(暗灰虚线) 三态。
3. **解锁动画**：购买成功 `available→owned` 触发 `.just-unlocked` 450ms 脉冲（边框金光→回落绿边 + scale 1.06 回弹，`::after` 分支色扫光一次），文字 opacity 全程 1.0 无 blur。

**验证**：`/tmp/skilltree_ui_polish_probe.py`（?debug）T1–T5 ALL PASS（5 分支连线 svg / 40 条边 / hover 浮层含前置+状态 / 购买触发 just-unlocked + 5 条 lk-next 高亮 / 零控制台报错）；`test_game.py` 全量 ALL PASS 零回归零报错。

---

## 0e. v3.3 技能树重构为树状图（可平移/缩放）

**依据**：用户诉求——v3.2 的 CSS grid 纵横对齐不像技能树、连线乱。纯表现层、无机制/数值改动。

**布局算法**（`src/ui.js` `renderSkillTree` 内联）：children 反向图 → root(空 prereq) → 深度 cd() → 后序 ay() 分配 slot（叶顺序+1、内部取首尾子平均；共享子 `id in yPos` 守卫防双计）；`x = bandX + slot*COL_W, y = TITLE_OFF + depth*ROW_H`；`bandX += (maxSlot+1)*COL_W + BAND_GAP`。常量 `CARD_W150 / CARD_H104 / COL_W190 / ROW_H126 / BAND_GAP64 / TITLE_OFF46`。

**平移缩放**：`stTx/stTy/stScale` 状态 + `applyStTransform(translate+scale)` + `fitSkillTreeView`(适配居中, scale∈[0.35,1]) + `zoomSkillTree`(光标锚定) + `bindSkillTreePan`(pointerdown/move/up + wheel，按钮不触发拖拽, `stMoved` 防误触展开) + `buildSkillTreeViewCtl`(＋/－/适配)。`resize`→re-fit。

**改动文件**：`src/ui.js`（renderSkillTree 重写为树布局 + 平移缩放控制器；旧 `drawConnections` 重命名为 `_drawConnections` 弃用）、`src/style.css`（`#skilltree-content` 改 flex:1 画布 `overflow:hidden/cursor:grab/touch-action:none`；新增 `.st-world`/`.st-world>.st-links`/`.st-world .altar-card`(absolute 紧凑)/`.st-band-title`/`.st-viewctl`/`.st-ctl-btn`；`.st-links` 去 inset/width/height 改仅视觉）。

**验证**：`/tmp/skilltree_tree_probe.py`（?debug）T1–T8 ALL PASS（39 卡 / 5 标题 / 5 层纵深 span504 / 21 横向位 / 40 连线 / 平移 transform 变化 / 缩放 0.36→0.432 / 购买触发 just-unlocked+5 lk-next / 零报错）；`test_game.py` 全量 ALL PASS 零回归零报错。

---

## 0f. v3.4 技能树 UI 深度打磨（图标模式 / 路径高亮 / 缩放适配）

**触发**：用户参考移动端技能树截图，要求「节点用图标代替、点击才展示说明 + hover 高亮上下游 + 缩放字号自适应」。

**图标模式**：
- `gen_skilltree_icons.py` 程序化生成 39 个 48×48 像素风图标（`public/assets/sk_*.png`），按分支色（war红/bly紫/nfr蓝/eco金/utl青绿）× 类型形状（gate六边形/stat圆角方/modifier菱形/keystone星形）区分。
- 已注册 `gen_assets.py` AI_OWNED 防覆盖。
- 节点卡片 DOM 重构：`<img class="st-icon">` + `<div class="st-text">`（文字层）+ 按钮。
- 移动端/触屏（`@media max-width:768px` + `.touch-device`）：卡宽缩至 56-58px，`.st-text` 和 `.ac-buy` `display:none`，只显示图标；点击→tooltip 详情。

**路径高亮**：
- 新方法 `highlightPaths(nodeId)`：BFS 遍历祖先（沿 prereq 向上）+ 后代（沿 children 向下），给相关 SVG path 加 `.lk-highlight`（stroke-width:3 + 双重 drop-shadow glow）。
- `clearPathHighlight()` 移除所有 `.lk-highlight`。
- card 的 `mouseenter` 触发 highlight + showTip；`mouseleave` 触发 clear + hideTip；click expanded 也触发。
- path 元素新增 `data-from` / `data-to` 属性供高亮匹配。

**缩放字号自适应**：
- `zoomSkillTree()` / `fitSkillTreeView()` 设 CSS 变量 `--st-zoom`（当前缩放比）。
- 标题/名字/类型/按钮字号用 `clamp(min, calc(base/--st-zoom), max)` 反比缩放。

**缩放百分比指示器**：`.st-zoom-indicator` 绝对定位底部居中，显示 "XX%"，跟随缩放实时更新。

**改动文件**：`src/ui.js`（图标元素+文字层+路径高亮+缩放变量+指示器）、`src/style.css`（图标/紧凑模式/.lk-highlight/字号calc/指示器/分支标题渐变）、`gen_assets.py`（AI_OWNED 追加 39 图标）、`gen_skilltree_icons.py`（新建）、`public/assets/sk_*.png`（39 文件新建）。

**验证**：`skilltree_v34_probe.py` T1–T9 ALL PASS（39 图标 / 39 文件 / 高亮 / 清除 / 指示器 / 缩放机制 / 移动端紧凑 / 购买 / 零报错）；`test_game.py` 全量 ALL PASS 零回归。

## 0g. v3.5 移动端全屏画板 + 手势缩放（含移动端购买通路修复）

**触发**：用户反馈「手机端技能树不能放在这么小的一个画板内，需要该页面全屏能移动画板」+「需要支持技能树画板放大和缩小」。

**移动端全屏画板**：
- `.touch-device #skilltree-screen`：`display:block; overflow:hidden; padding:0; height:100dvh;` 整页全屏、不可滚动。
- `#skilltree-content`：`.touch-device` 下 `position:absolute; inset:0; width:100%!important; height:100%;` 铺满视口；圆角/边框/底色去除，画板即整屏。
- 标题(`#skilltree-screen .altar-title`)/灵魂余额(`#skilltree-balance`)/返回(`#btn-skilltree-topback`)/重置+返回(`#skilltree-actions`/`#btn-skilltree-back`)改为 `position:absolute` 浮层叠于画板之上（`pointer-events` 按需分配，空白区穿透给画板做平移）。
- 视图控制 `.st-viewctl` 移动端放大至 46px、竖排右下角；`.st-zoom-indicator` 上移避让底部操作条。

**双指捏合缩放（重写 `bindSkillTreePan`）**：
- 基于 Pointer Events 多点：`pointers` Map 记录活动指针；2 指时记录手势起点快照 `{dist, mx, my, tx, ty, scale}`，以中点为锚做「平移+缩放」合成——`wx0=(mx0−tx0)/scale0; stTx=mx−wx0*ns; stTy=my−wy0*ns`（手势起点世界点黏在中点）。
- 单指平移 `stDragging`；抬起一指自动以剩指续接平移；`stMoved` 防误触展开/购买。
- 缩放下限 `Math.max(0.2,…)`（`zoomSkillTree` 与 `fitSkillTreeView` 同步放宽），窄屏可纵览整棵宽树。
- 点击空白区（非节点）收起浮层。

**移动端购买通路修复**：
- 原移动端 `.ac-buy` 被 `display:none` 且 `.st-tooltip` `pointer-events:none` → 移动端「看得见买不了」。
- 现 `.st-tooltip` 触屏端 `pointer-events:auto`，`showTip` 内嵌 `.tt-buy` 按钮（可解锁→「解锁 −X 灵魂」；锁定→禁用并显示原因）；构造期在 `#skilltree-screen` 的浮层上注册事件委托，点击 `.tt-buy` → `buySkillNode` + 刷新。桌面端 `.tt-buy` 仍 `display:none`（沿用卡片内联购买），无回归。

**改动文件**：`src/ui.js`（`bindSkillTreePan` 重写多点手势 + `showTip` 加 `.tt-buy` + 构造期浮层点击委托 + `zoomSkillTree`/`fitSkillTreeView` 下限 0.2）、`src/style.css`（`.touch-device` 全屏画板 + 浮层定位 + 视图控制放大 + `.st-tooltip` 触屏可交互 + `.tt-buy` 样式）。

**验证**：`/tmp/skilltree_mobile_probe.py` ALL PASS（全屏布局 / tap→`.tt-buy` 可见可用 / 解锁→owned 持久化 / 捏合 scale 0.2→0.2828 / 零报错）；`test_game.py` 全量 ALL PASS 零回归。

## 0h. v3.6 解锁保持面板视图 + 玩法说明图标统一

**触发**：用户反馈「技能树解锁后会自动恢复到初始缩放大小，需要解锁保持当前面板不自动移动/缩放」+「给玩法说明更新一下，同时玩法说明按钮也加上 icon，保持体验一致性」。

**解锁不重置视图（核心修复）**：
- **根因**：`renderSkillTree()` 尾部无条件调用 `requestAnimationFrame(() => this.fitSkillTreeView())`，而购买/洗点回调均走 `renderSkillTree(id)` → 每次操作后画板被强制 fit 回初始缩放/位置。
- **修复**：`renderSkillTree(justUnlocked = null, fit = false)` 新增 `fit` 参数。尾部分支：`fit=true`（仅 `showSkillTree()` 打开时传入）→ 调用 `fitSkillTreeView()` 自动适配；`fit=false`（购买 tooltip buy / 卡片内联 buy / 洗点）→ 仅 `applyStTransform()` 复用当前 `stTx/stTy/stScale` + 更新 `--st-zoom` CSS 变量与缩放指示器文本。
- **调用点**：`showSkillTree()` → `renderSkillTree(null, true)`；tooltip buy(67行) → `(id, false)`；card buy(1031行) → `(def.id, false)`；respec(937行) → `(null, false)`。
- **行为**：打开技能树 → 自动 fit；之后任意次解锁/洗点 → 视图不动；关闭重开 → 再次 fit；窗口 resize → fit（resize handler 不变）。

**玩法说明按钮图标统一**：
- `#btn-guide` 从 `<button class="gothic-btn ghost">玩法说明</button>` 改为 `<button class="gothic-btn ghost menu-btn"><img class="menu-btn-icon" src="/assets/guide_menu.png" alt="玩法说明" /><span>玩法说明</span></button>`，与 `btn-skilltree` / `btn-codex` / `btn-altar` 四个入口按钮结构一致。
- 新增 `gen_guide_menu()` 程序化像素生成函数（gen_assets.py）：48×48 canvas ×2 → 96×96 PNG。视觉为暖色羊皮纸卷轴（左亮右暗渐变）+ 上下深色卷轴棒 + 居中青色发光 "?" 位图（7×9 像素位图 + 高光）。`outline()` 自动加 1px 深色描边。

---

## 0i. v3.7 重置弹窗暗黑风 + 移动端长按复制屏蔽 + 技能树二叉化 + 前置审计

**触发**：用户反馈 4 项——① 点击重置天赋弹窗没适配游戏 UI 风格；② 检查技能树前置解锁条件（怀疑永夜庇护前置的壁垒护盾不存在）；③ 长按技能树区域会弹出手机自带复制菜单；④ 优化节点分叉，一个节点最多分两个叉（含初始节点）。

**① 重置弹窗暗黑风**：
- `respecSkillTree()`（ui.js ~946）不再用原生 `confirm()`，改为显示自定义弹窗 `#st-respec-modal`（`.st-modal` 暗化遮罩 + `.st-modal-card` 玻璃拟态）。构造期（~60-72行）缓存 `stRespecModal/stRespecBody` 并绑定：取消按钮 / 确认按钮 / 点遮罩 / Esc 四种关闭方式；确认走原 `respecTree()` 后 `renderSkillTree(null,false)`。
- HTML：index.html `skilltree-screen` 末尾新增 `#st-respec-modal` 块（title/body/取消/确认）。CSS：新增 `.st-modal / .st-modal-card / .st-modal-title / .st-modal-body / .st-modal-actions` 暗黑哥特样式（半透明黑遮罩 + 暗玻璃拟态卡片 + 紫色描边 + `backdrop-filter: blur`）。

**③ 移动端长按复制屏蔽**：
- style.css `#skilltree-content` 增 `-webkit-touch-callout:none` + `user-select:none`（`.touch-device` 下 `.st-world .altar-card` 已 `user-select:none`）；ui.js 构造期对 `skillTreeContentEl` 加 `contextmenu` 监听 `e.preventDefault()`，屏蔽系统右键/长按菜单。

**④ 技能树二叉化（每个节点 ≤2 子节点，含 5 个根）**：
- 数据改动集中在 `src/data.js` 的 `SKILL_TREE`（39 节点不变、效果不变）：重用现有节点作二叉链节，将扇出 >2 处改链。具体 11 处 `prereq` 调整（如 `war_root`5→2：`war_cd`/`war_lightning_chain` 挂 `war_root`，`war_holywater_layer`/`war_dmg` 挂 `war_cd`；`war_axe_extra`3→2：仅 `war_keystone_omni`+`war_keystone_avalanche`（后者改挂 `war_lightning_chain`）等）；
- 自检脚本 `/tmp/validate_skilltree.mjs`（data.js 无 import、`window` 已守卫，可直接 `node` 跑）：校验「每节点子节点≤2 / 前置全部有效 / 全可达 / 无环」。v3.7 通过：各分支最大子节点数均=2，无不可达、无环。
- 注：渲染层 `renderSkillTree` 的 tidy-tree 布局无需改动，二叉图天然适配。

**② 前置条件审计结论（无代码改动）**：
- 逐节点核对 39 个 `prereq`：`壁垒护盾(nfr_shield)` 真实存在，链路 `永夜之门(nfr_root) → 坚韧体魄(nfr_endure) → 壁垒护盾(nfr_shield) → 永夜庇护(nfr_sanctuary)` 完整有效。用户所见「前置不存在」是视觉上该节点埋在三层深处、不易在树中定位所致，非逻辑缺陷。如需改前置（如让永夜庇护直接要求永夜之门）属设计调整，未执行。

**验证**：`/tmp/validate_skilltree.mjs` 通过；`test_game.py` 全量 ALL PASS 零控制台报错；重置全流程（开树→点重置→确认）`console` 错误计数=0（CDP `pageerror` 报的 `null.classList` 经 `window.onerror`/`unhandledrejection` 双重验证为 Playwright 点击期模态遮罩覆盖按钮的测试侧伪影，非游戏真实报错）。

**玩法说明内容补充灵魂树条目**：
- 在「长远」（灵魂祭坛）bullet 后新增「灵魂树」bullet：描述 5 大分支天赋（征伐/血裔协同/永夜抗性/灵魂经济/通用机能）、可随时重置（净额扣 5% 手续费）、build 构建。

**改动文件**：`src/ui.js`（`renderSkillTree` 加 `fit` 参数 + 4 处调用点适配 + 尾部条件分支）、`index.html`（guide button 改 menu-btn 结构 + guide-list 加灵魂树 bullet）、`gen_assets.py`（新增 `gen_guide_menu()` 函数 + 主块调用）、`public/assets/guide_menu.png`（新生成）。

**验证**：`/tmp/skilltree_v36_probe.py` T1–T10 ALL PASS（全屏/touch-device/fit=0.20/＋缩放0.24/tooltip+tt-buy/**scale不变(解锁)**/持久化/**scale不变(洗点)**/重开re-fit/icon存在/零报错）；`test_game.py` 全量 ALL PASS 零回归。

---

## 0j. v3.8 资源加载优化（内容哈希精准缓存 + 分级懒加载）

**触发**：用户反馈「更新后进度条加载比较慢，是否每次更新都全量加载」，根因定位为全局 `BUILD_ID` 缓存击穿导致每次 push 全量重拉。

**① 内容哈希精准缓存（替代全局 `BUILD_ID`）**：
- `vite.config.js` 在 config 期读 `public/assets/*.png`（142 张），`crypto.createHash('sha256')` 取前 8 位 hex 建 `{文件名:哈希}` 映射，经 `define` 注入 `__ASSET_HASHES__`（保留 `__BUILD_ID__` 供版本自检）。
- `src/assets.js` 抽 `assetUrl(fn)`（按文件名取内容哈希、缺失回退 BUILD_ID）+ `loadOne` 助手；`loadAssets`/`loadAssetsLazy` 共用。`src/ui.js` 标题血裔按钮头像同样走哈希 URL。
- **效果**：图内容没变→哈希不变→URL 不变→浏览器/CDN 命中缓存；仅真正改字节的图重拉。纯代码更新近乎秒开。

**② 分级懒加载**：
- `assets.js` 拆 `LAZY_KEYS`(20) 与 `CRITICAL_KEYS`；进度条只等关键集（标题+开局+升级卡片必需），`loadAssetsLazy()`（模块级 `lazyPromise` 幂等）+ `ensureLazy()` 后台拉取懒加载集（codex_*/altar_*/boss_*/portrait_saint 等 5 张）。
- `src/game.js` 关键集完即进标题、后台跑懒加载；`src/ui.js` 的 `showCodex/showAltar/showBloodline` 入口包 `ensureLazy().then()` 守卫（视觉/逻辑不变）。

**验证**：`npm run build` 成功（URL 形如 `/assets/player.png?v=0f7a8664`）；`test_game.py` 全量 ALL PASS 零控制台报错。

**改动文件**：`vite.config.js`（新增 `buildAssetHashes()` + `__ASSET_HASHES__` define）、`src/assets.js`（assetUrl/loadOne/LAZY_KEYS/CRITICAL_KEYS/loadAssetsLazy/ensureLazy）、`src/game.js`（关键集完进标题+后台懒加载）、`src/ui.js`（标题头像哈希化 + 三界面 ensureLazy 守卫）。

---

## 0k. v3.9 移动端技能树交互重构（分段控件 + 竖向链 + 底部抽屉）

**触发**：用户反馈「技能树在移动端的体验还是有点问题」，要求参考有技能树手游的移动端做法、保持图标不变、优化移动端交互，允许修改二叉树分叉。

**方案（design-strategist）**：`docs/plans/2026-07-31-skilltree-mobile-redesign.md`——行业参考（原神/星穹铁道天赋树竖向滚动+点击弹详情、暗黑不朽 Paragon 竖向板+分页签、FF14 竖向树+详情面板、绝区零/崩坏3 竖向列+分页签）；提炼移动端最佳实践：竖向优先滚动、分支分页签、点击→底部抽屉、≥44px 热区、点击聚焦居中、最小缩放可读。用户拍板：移动端顶部分段控件 + 底部 bottom-sheet + 桌面保留 5 分支总览、图标与 prereq 不动。

**实现（移动端 `src/ui.js` `.touch-device` 分支；桌面 5-band 总览一字未改）**：
- **分支分段控件**：构造期建 `.st-seg`（5 分支按钮）挂 `#skilltree-screen`，点选切 `this.stBranch` 并重渲；CSS 基础 `display:none`、仅 `.touch-device` 显示。
- **单分支竖向链（坐标轴对调）**：`renderSkillTree` 移动端只渲染 `SKILL_TREE.filter(branch===stBranch)`，常量改紧凑（CARD58/COL_W92/ROW_H116/TITLE_OFF24）；`x=列号*COL_W`（兄弟有限横向偏移）、`y=depth*ROW_H`（纵向滚动）；双亲汇聚 keystone 列号取双父中点（合流视觉）。
- **底部抽屉**：点击节点 → `focusStNode`（平移到视口上 30%）+ `openStSheet`（`.st-sheet` 滑入，含名称/类型/描述/消耗/前置清单/解锁按钮，XSS `esc` 转义）；`.sh-buy` 事件委托 `buySkillNode` 后 `renderSkillTree(id,false)` 保持视图并刷新抽屉。桌面端保留 hover tooltip + 原地 expand。
- **最小可读缩放**：`stMinScale()` 移动端 0.6 / 桌面 0.2，fit/zoom/pinch 三处统一。
- **触摸热区**：`.touch-device .st-world .altar-card` 58px（≥44px）。

**底部浮层命中区修复（QA CONCERNS #77）**：`#skilltree-content` 加 `padding-bottom: calc(76px + safe-area)`，`fitSkillTreeView` 扣除该 padding 使默认 fit 节点避开返回/重置/视图控制按钮；`.st-viewctl` 容器 `pointer-events:none`、仅 `.st-ctl-btn` `auto` 透传间隙。

**验证**：`/tmp/skilltree_mobile_v39_probe.py` + `/tmp/skilltree_mobile_v39_qa.py`（14 项全 PASS）+ `/tmp/skilltree_fix_qa.py`（5/5）；`test_game.py` 全量 ALL PASS 零控制台报错（含桌面补 7 条技能树断言）。

**改动文件**：`src/ui.js`（renderSkillTree 移动端分支/竖向坐标/分段控件/.st-seg/.st-sheet/openStSheet/focusStNode/stMinScale）、`src/style.css`（`.st-seg`/`.st-sheet`/`.touch-device #skilltree-content` 底部留白/`.st-viewctl` 透传）、`docs/plans/2026-07-31-skilltree-mobile-redesign.md`（设计文档）。`src/data.js`/图标/`vite.config.js` 未动。

---

## 0l. v3.10 技能树数据完整性校验护栏（防 prereq 断裂回归）

**触发**：用户反馈「部分技能节点需要前置但前置不存在（点名嗜血渴望 lifesteal）」，要求整体排查并修复。

**排查（3 重，均基于 v3.9 源码 + 本地 dist）**：① node 真导入 `data.js` 校验 prereq 引用/可达性/≤2/无重复 → 全过；② 全仓 grep 仅 `src/data.js` 一份 SKILL_TREE、dist 未受 git 跟踪且其 `bly_sanguine_lifesteal` 的 `prereq:["bly_thunder_chain"]` 有效；③ **真实运行时仿真**——Playwright 起 dev server + `import('/src/data.js')` 拿真实 `buySkillNode`，拓扑顺序逐个解锁 39 节点 → 全部 "ok"（含噬血渴望）。

**结论**：当前代码无断链 prereq（39 节点全可解锁）；用户所见系**客户端缓存修复前的旧 JS bundle**（浏览器/CF 边缘缓存）。根因/系统缺口：prereq 校验器 `validate_skilltree.mjs` 此前只活在 /tmp、未进仓库 → 改 `data.js` 无回归护栏。

**修复（护栏，本版）**：`scripts/validate_skilltree.mjs`（校验 a 必填字段 / b 唯一 id / c prereq 存在性 / d ≤2 前置 / e 无环+每分支恰一 root+不跨分支+可达 / f gateReq 合法）+ `package.json` 加 `validate:skilltree` 与 `prebuild` 钩子（构建前自动跑，断链直接 build 失败）。反向验证：篡改缺失 id → exit 1（打印 `节点 X → 缺失前置 "Y"`）、`npm run build` 被 prebuild 拦停；环检测补测通过。

**验证**：`node scripts/validate_skilltree.mjs` → `✓ 技能树校验通过：39 节点，无断链/重复/越界/不可达`（exit 0）。`src/data.js` 无改动（working tree 仅 `package.json` +2 script + `scripts/` 新文件）。

---

## 0m. v3.11 移动端技能树同层节点重叠修复（列分配重写）

**触发**：用户二次反馈「永夜庇护(nfr_nightdr) 前置壁垒护盾(nfr_shield) 根本没有/无法解锁」，要求仔细排查。

**诊断转折**：初次用「手动往 document 注入 `.touch-device`」模拟触屏，结果 `htmlClass=""` 类根本没生效 → 走的是**桌面布局**，nfr 节点出现 `nfr_shield(180,411)` 与 `nfr_statusamp(180,411)` 完全重叠（桌面 bug 被遗漏）。改用 Playwright `has_touch=True, is_mobile=True` 正确模拟触屏后，`.touch-device` 真生效、分段控件可见、分支可切。

**真因（渲染层，非数据层）**：`renderSkillTree` 的 `ay`/`yPos` 列分配算法，对**双亲汇聚(菱形)**——某节点有 2 前置、且两前置各自唯一子节点都是该汇聚节点——会让两前置坍缩到同一列 → 同深度层、同列、完全重叠。实测 nfr 分支 `nfr_shield` 与 `nfr_statusamp` 都渲染在 (133,368)，后者压住前者，玩家点不到看不到 → 误以为「前置不存在」。实际菱形为 `nfr_keystone_endgame ← [nfr_nightdr, nfr_statusamp]`（非原先以为的 nightdr）。同类碰撞还存在于 bly 2 对、eco 2 对，共 5 对同层重叠。数据层干净（前序 3 重验证已证 39 节点全可解锁）。

**修复（本版，`src/ui.js` 仅 1063–1087 行）**：① 用「**首前置父**」构建 `sChildren` 严格树做列分配（消菱形）；② 多前置汇聚节点列号取双亲中点（合流视觉、与双亲水平分离）；③ 按深度层逐层把列号量化成互不相同的整数（**安全阀**，彻底杜绝同层水平重叠）。`children`(全量，供连线)、`data.js`/图标未动。

**验证**：移动端重叠探针（390×844, has_touch+is_mobile）5 分支**全 CLEAN**（nfr_shield 现 (88,368) vs statusamp (265,368) 已分离）；运行时 `buySkillNode` 拓扑解锁 39/39 ok；`validate_skilltree.mjs` PASS；`test_game.py` ALL PASS 零报错（桌面零回归）。

**遗留（非本版范围，建议单开）**：桌面 1440×900 仍有 26 组「父子相邻行纵向」相交（基线 52 组，已减半、无回归），属卡片文字层实高 > 行距的 CSS/ROW_H 问题，与列分配无关。→ **已在 v3.12 修复（见 0n）**。

---

## 0n. v3.12 桌面技能树父子纵向重叠修复（CARD_H/ROW_H 校正）

**触发**：v3.11 遗留项——桌面端父子相邻行纵向相交（放大查看时尤其明显，卡片文字被上/下卡压住）。

**真因（布局常量低估真实高度）**：技能树卡片启用了缩放自适应字号（`--st-zoom` CSS 变量 calc），在 fit 缩放下字号被撑到 clamp 上限，卡片**真实渲染高度达 157–160px**；而 `renderSkillTree` 的桌面布局常量仍是 `CARD_H=104`/`ROW_H=126`。父→子顶边间距(126) < 卡片实高(157) → **每个父子对纵向相交 31–34px**。与 v3.11 修的同层水平重叠（列分配）是两个独立问题。

**修复（本版，`src/ui.js` 仅 1040–1042 行）**：桌面 `CARD_H` 104→**160**、`ROW_H` 126→**178**，使布局常量匹配卡片真实渲染高度。移动端三值（58/116/24）及 `CARD_W`/`COL_W`/`BAND_GAP`/`TITLE_OFF` 均未动。连线起点 `a.y + CARD_H` 与世界高度 `y + CARD_H` 由同一常量驱动，自动对齐卡片真实底部，无需改连线逻辑。

**验证**：桌面重叠探针（1600×1000）父子纵向相交 **0 组**、任意两卡可见碰撞 **0 组** → PASS；卡片高度分布实测 `[157,160]`，`ROW_H=178` 留 18px 余量；全缩放层级（fit 0.2 ~ 放大 2.2）无重叠；移动端常量未变动无回归；`node --check src/ui.js` 语法 OK。

**技能树布局常量现状（桌面 / 移动）**：`CARD_W` 150/58、`CARD_H` **160**/58、`COL_W` 190/92、`ROW_H` **178**/116、`BAND_GAP` 64、`TITLE_OFF` 46/24。改动卡片内文字层级或字号 clamp 时，**必须同步复核 CARD_H/ROW_H**，否则会重现纵向重叠。

---

## 0o. v3.13 技能树重叠常驻回归用例（把探针沉淀为护栏）

**触发**：v3.12 质量门提出的两条非阻塞建议——① `ROW_H=178` 对实测最大卡高 160px **仅余 18px**，这类硬编码布局常量在节点描述文案变长、字号被撑到 clamp 上限时会**静默复发**，且往往要等玩家放大查看才发现；② v3.12 的重叠探针只活在 `/tmp`，**重启即失**，与 v3.10 之前「prereq 校验器只在 /tmp、未进仓库」是同一类系统性缺口。

**落地（本版，不碰 `src/`）**：新增 `tests/skilltree_overlap.py` 常驻回归用例，覆盖 **8 档**——桌面 3 档（1280×800 / 1600×1000 / 1920×1080）+ 真触屏移动端 5 分支全遍历（`has_touch=True, is_mobile=True`，390×844，dsf=3）；`package.json` 加 `test:skilltree`。**刻意不接 `prebuild`/`build`**：该用例依赖 dev server 在 5173 运行，接进构建链会让离线构建失败（挂 prebuild 的是 `validate:skilltree`，纯数据校验、无需浏览器）。

**移动端为何必须遍历 5 分支**：`ui.js` 的 `branchIds = isMobile ? [this.stBranch] : Object.keys(...)` —— 移动端一次只渲染当前分支，只测默认 war 会放过其余 4 支；切换走 `.st-seg-btn[data-branch=...]` 真实点击。

**抗退化设计（三条，都是为了别变成「永远绿的假测试」）**：
- **行距不硬编码**：从卡片 top 网格取相邻最小正差**反推实测 `ROW_H`**，日后改布局常量测试自动跟上，不会因常量变更而失效。
- **移动端 `.touch-device` 失真守卫**：若 `<html>` 未带该类名**直接判 FAIL**——防 v3.10/v3.11 那种「以为测了移动端、其实测的是桌面布局」的漏检。
- **WARNING 语义分级**：余量 <8px 给 WARNING 但不失败（吃紧、尚未重叠），真正重叠才 FAIL 并逐对打印定位。

**验证**：`npm run test:skilltree` → EXIT 0，**8 档全 PASS**。桌面 3 档：39 节点、卡高 157–160px、实测行距 178px、余量 18px、父子纵向相交 **0 组** + 可见碰撞 **0 组**；移动 5 分支（war 9 / bly 8 / nfr 8 / eco 6 / utl 8）：卡高 58px、行距 116px、余量 58px，同为 **0/0**。**mutation 负向对照**：运行时强制撑高卡片至 175px（余量 3px）→ WARNING 仍 PASS（语义正确）；撑到 185px（超 ROW_H 7px）→ **FAIL**，检出 38 组父子相交 + 26 组可见碰撞并逐对定位（如 `war_root → war_dmg 纵向相交 7px`）。

**顺带修正的文档欠账**：`CHANGELOG.md` L6 历史工具残留标记 `<arg_value:...>`（破坏 MD 分隔线渲染）；`__ASSET_HASHES__` define 名笔误 **6 处**（HANDOFF §0j×2 / §11 / §16×2 + CHANGELOG v3.8 条目 1 处，根因 `4cbfb61` 回填哈希时全局替换误伤，代码侧未受污染）；`.gitignore` 补 `__pycache__/`、`*.pyc`。

⚠️ **维护提示**：桌面余量仅 18px。后续若要**加长节点描述文案**，应**先把 `ROW_H` 提到 190+ 再加文案**，而不是等测试报红再回补。

---

## 0p. v3.14 仓库卫生补丁（vite 临时产物忽略 + §11 占位行回填红线）

**触发**：v3.13 交接时列出的两条「已知遗留，交下一版」——① `vite.config.js.timestamp-*.mjs` 常驻 `git status` 的 `??` 列表；② §11 代码块首行 v3.13 的 `(本次文档提交)` 占位符待回填。主理人在此基础上**追加第三项根治措施**：只做前两条是治标，不把规则写进文档，下一版还会再生同样的欠账。

**落地（本版，不碰 `src/`）**：
- **`.gitignore` 追加 `vite.config.js.timestamp-*`**（第 9 行）。vite 每跑一次 dev/build 就生成一个新的 `vite.config.js.timestamp-<epoch>-<rand>.mjs`，旧的不清理，长期在 `??` 列表里堆积——既污染工作区视图（每次发布都要在禁提清单里多念一个文件名），也在批量 `git add` 时构成误提交风险。**只加忽略规则，不删磁盘上已存在的那个文件**：它是 vite 自己的临时产物，交由工具管理，发布流程不动用户工作区文件。
- **§11 回填 v3.13 文档提交哈希**：首行 `(本次文档提交)` → `ae95024`，行内其余文字（含 `| tag v3.13 指向此提交` 尾注）原样保留，写法对齐同节 `ab8d08e` / `461a5a5`。
- **§11 新增「占位行回填」维护红线**（本版核心）：在节标题与代码块之间立引用块，规定**写新版本提交行前第一步必须先回填上一版占位符，再插新行**，并给出可机械执行的核对命令 `grep -c '^(本次文档提交)' docs/HANDOFF.md` 应输出 **1**。

**根因（为什么要立红线，而不是每版手工记得）**：`(本次文档提交)` 是一个**结构性必需的占位符**——文档提交无法在自身内容里写入自己的哈希（哈希要等提交生成后才存在），只能留白由下一版代填。但「下一版」的实际动作是**在代码块顶部插入新行**，占位行被顺势顶下去、看着还在，**回填这一步没有任何东西提醒你做**，于是被系统性地遗漏。这不是某个人某次的疏忽，是流程本身缺了一道校验。**存证**：`461a5a5`（v3.11 文档提交）就这样空占了两个版本，直到 v3.13 才补回。红线把这道校验写进文档、并给出可机械执行的核对命令，才算修在根因上。

**v3.13 当时为何不顺手做 `.gitignore`**：改 `.gitignore` 属**代码提交 H_A**。v3.13 彼时 H_A 已定为 `7898588` 且 CHANGELOG / HANDOFF 里已写死引用，临时插一条 `.gitignore` 改动会让 `7898588` 失效，进而连带重做文档提交 H_B——**为一条噪音规则触发一轮哈希连锁返工，不划算**，故记为遗留。本版是纯仓库卫生版、无此约束，一并清掉。

**验证**：`git check-ignore -v vite.config.js.timestamp-...mjs` → 命中 `.gitignore:9:vite.config.js.timestamp-*`；`git status --short` 禁提未跟踪文件 **8 → 7**（该 `.mjs` 已从 `??` 列表消失，文件仍在磁盘）；`grep -c '^(本次文档提交)' docs/HANDOFF.md` = **1**（仅本版文档提交行）。本版**未改动 `src/` 下任何产品代码，无运行时回归面**，未动 `tests/` / `scripts/` / `package.json`。

**一个落地时发现的坑（已在红线里写死）**：核对命令**必须带 `^` 行首锚定**。红线与本节为讲清规则，散文里会反复提到 `(本次文档提交)` 这个字符串，不加锚定的全文 `grep -c` 会把这些说明文字一并计入，**数值随文档措辞增删而漂移、恒 > 1**，永远不等于 1——**规则一写下去就会把自己判红**。占位符的真实语义是「代码块中某行提交记录的行首前缀」，只有 `grep -c '^(本次文档提交)'` 对应这个语义。若不修，下一版按红线一跑就见红、几次之后这条红线会被当成噪音忽略掉，等于白立。

⚠️ **维护提示**：本版起 `vite.config.js.timestamp-*` 不再出现在 `git status`，发布前的禁提清单基线为 **7 个未跟踪文件**（`docs/DESIGN_PLAN.md`、`docs/architecture/`、`docs/plans/` 下 3 个、`generated-images/`、`overview.md`）。若某次 `git status` 又冒出第 8 个，说明有新的未忽略产物混入，**先查清来源再提交**，不要习惯性放过。

---

## 0q. v4.0 大版本（P3b-3~5 精英内容 + P4 悬赏/Combo + P5 美术占位/移动端门禁/精灵断言）

**范围**：把 P3b-3~5（精英差异化行为/保底掉落/图鉴分组/HUD）、P4-1（精英悬赏）、P4-2（连杀Combo）与 P5（美术占位统一工具 / 移动端真机门禁 / 精灵缺失断言）整批随 v4.0 发布。全量本地提交、四门质量门（node --check / validate:skilltree / test:content / test_game.py）逐切片全绿，7 个基线未跟踪文件按红线从不提交。

### 新增
- **P3b-3 精英差异化行为（4 单元，依赖序逐个提交）**：腐骸巨像（复用 boneKnightBehavior + 正面装甲，`0c4a7a8`）、裂魂掠夺者（复用 shadowHunterBehavior + dash，`55d719a`）、血狱典狱长（onLowHp 召唤，`ad64ef7`）、永夜导体（环形弹幕 + 友军加速光环，`abb26c6`）。
- **P3b-4 精英保底金宝石**：精英死亡保底掉 `gemGold(min=25)`，净经验不通胀（分支仅对 exp<25 生效）。`b5954d4`。
- **P3b-5a 图鉴分组重构 + 弱点情报**：怪种/词缀(8 条)/精英/Boss 四分组，data-driven 弱点 badge，击杀分级解锁。`6e02edc`。
- **P3b-5b 游戏内 HUD**：精英边缘紫色指示箭头 + 屏内头顶血条 + 侧背命中暴击级飘字。`d803086`。
- **P4-1 精英悬赏**：精英击杀累加灵魂 `bounty=round(exp*0.5)`，结算并入 `addSouls`（零局内平衡扰动）。`90d446a`。
- **P4-2 连杀 Combo**：`onEnemyKilled` 计数 + `COMBO_WINDOW=3s` 窗口（超时/受击断连），经验分段乘区 ≥10×1.1 / ≥25×1.25 / ≥50×1.5。`88b7614`。
- **P5-1 美术占位统一工具**：`safeIconURL`(HTML `<img>` 缺失返带标签 SVG data-URI) + `drawSpriteSafe`(canvas 缺失画带标签占位方块，替代裸紫圆)；图鉴/升级图标与敌怪渲染缺失绝不碎图；补 `enemy_shadow_hunter.png`/`enemy_gargoyle.png` 立绘，Boss `avatar` 复用 `boss_overlord`。`56a7657`。
- **P5-2 移动端真机门禁**：`frame()` 注入 `performance.now()` 单帧耗时 EMA → `window.__perfDebug`；触屏 ≤12ms / 桌面 ≤16.6ms 软告警（仅 console.warn，不改玩法）；e2e 加 3 条断言门禁。`115114e`。
- **P5-3 精灵缺失断言**：`scripts/test_assets.mjs` 校验 `assets.js` 96 项清单 PNG 全部存在（缺失 exit 1），挂 `npm run test:assets`，不接 prebuild。`67e510e`。

### 验证
- 四门质量门全绿：P5-1/P5-2/P5-3 各切片 `node --check` + `validate:skilltree`(39 节点) + `test:content` + `test_game.py`(ALL PASS / 无 console error)；P5-3 另跑 `npm run test:assets`（96/96 存在，0 缺失）。
- `grep -c '^(本次文档提交)' docs/HANDOFF.md` = **1**（本版文档提交行）。

---

## 0r. v4.1（P8 怪物/Boss 辨识度修复 + 程序化动画系统）

**范围**：用户真机演示反馈两类问题——① 新怪物/Boss 无动画（仅 bat/slime/skeleton 有程序化动画）；② 部分新精灵在 34~64px 下呈白团/混沌，辨识度差。本版重做 10 张精灵 + 为全部 18 个新对象补程序化动画，四门质量门全绿，12 个基线未跟踪文件按红线从不提交。

### 调整
- **10 张精灵全量重做**（ImageGen → `gen_monster_pixels.py` 像素化管线）：红旗 7 张（rat_swarm/plague_bearer/siren/herald/alchemist/overlord/avatar 原呈白团混沌）+ 黄旗 3 张（spitter/elite_colossus/warlord 轮廓偏糊）。改进核心：单一大轮廓（不再画"一群小东西"）、亮主色 + 粗轮廓、2~3 个超大特征、减少内部细节；rat_swarm 改为「1 大 + 2 小紧贴」避免被 `remove_watermark` 当噪点删。`5338c51`。
- **18 个新对象程序化动画**（`src/entities.js` `render()` 动画块由 4 分支扩至 21 分支，1035~1132 行，纯 in-code scale/rotate 变换零新素材）：8 新小怪（尸鼠群高频窜动 / 腐唾者头部脉冲 / 骸骨骑士沉重步伐 / 疫病携带者毒气脉动 / 女妖漂浮 / 残躯顿挫步 / 暗影猎手冲刺蹲伏 / 石像鬼静止）+ 7 Boss（按 `e.type.id` 区分：先驱施法 / 男爵披风呼吸 / 炼金术士沸腾 / 女王冰晶摇曳 / 战将攻击姿态 / 君王威严慢脉动 / 化身混沌扭曲）+ 3 精英（掠夺者攻击切换 / 导体奥术呼吸 / 巨像重踏）。判定顺序"具体 Boss/精英 > 通用兜底"防误拦截。`5338c51`。

### 验证
- 四门质量门全绿：`node --check`(SYNTAX_OK) + `validate:skilltree`(39 节点无断链) + `test:assets`(109/109) + `test:content`(PASS，新怪渲染无 console error)。
- `grep -c '^(本次文档提交)' docs/HANDOFF.md` = **1**（本版文档提交行）。

---

## 0s. v4.2（P9 白色系精灵暗底重绘 + 血裔角色差异化立绘）

**范围**：用户真机反馈两类视觉问题——① 4 个白色系精灵（骸骨骑士/哀嚎女妖/复仇残躯/骨戈战将）"显示不鲜明"；② 6 个血裔角色同质化，战斗中分不清操作的是谁。本版重做 10 张精灵，三门质量门全绿，12 个基线未跟踪文件按红线从不提交。

### 调整
- **4 个白色系怪物暗底重绘**（`70f21e3`）：`bone_knight` 52px 暗钢黑甲 + 橙红发光眼窝 + 深裂痕；`siren` 46px 深蓝紫袍 + 亮青发光长发（占主体 50%）+ 尖叫黑嘴；`revenant` 52px 深色绷带破布 + 暗铁肩甲；`warlord` 64px 暗金深灰重甲 + 猩红符文 + 象牙骨戟。
- **6 个血裔角色差异化立绘**（`70f21e3`，均 46px）：wanderer 头巾破斗篷 / saint 白金袍 + 大光环 + 法杖 / berserker 裸肌 + 红发 + 巨剑扛肩 / thunder 浮空 + 雷电环绕 / bloodthirsty 蝠翼披风 X 形 + 利爪獠牙 / apostle 虚空剪影 + 碎片环 + 触手。

### 新增
- `gen_monster_pixels.py` `SPECS` 补入 6 个血裔条目（均 46×46）——此前玩家精灵不在 AI 生图管线覆盖内；`bone_knight` 规格 46→52px。`70f21e3`。

### 关键结论（管线经验，下次沿用）
- **prompt v2「亮主色」策略并非普适**：对白/浅色系概念（骨骼、亡灵、幽灵）反而加剧发白。这类对象必须改用 **「暗底 + 局部强对比亮点」**——主体压暗，只留 1~2 处高饱和亮部（发光眼窝、符文、荧光长发）作视觉锚点。v2 策略适用于**深色概念**，两者是互补而非替代关系。
- **角色去同质化的关键是剪影而非配色**：6 血裔此前共用「兜帽 + 长袍 + 圆脸」模板换色，46px 下完全不可分辨。有效做法是让每个角色的**外轮廓形状**本身不同（X 形蝠翼 / 光环圆盘 / 扛肩巨剑折线 / 浮空无腿），配色只是辅助。
- **ImageGen 收敛困难项**：「纯黑金属」「完全非苍白的腐肉」两类描述各重试 4 次仍有偏差（warlord 偏暗金、revenant 面部偏亮）。模型对「暗到接近黑」和「脏色皮肤」倾向性回避，属已知能力边界，不必反复烧积分。
- **`.ai_monster_raw/` 保持未跟踪**：原图可随时按 prompt 重生成，不入库。

### 验证
- 三门质量门全绿：`vite build`(371ms/17 模块) + `validate:skilltree`(39 节点) + `test:assets`(109/109)。
- `grep -c '^(本次文档提交)' docs/HANDOFF.md` = **1**（本版文档提交行）。

## 0t. v4.3（P9 遗漏补漏：portrait 选择卡片立绘同步）

**范围**：P9（v4.2）重做了 6 血裔 `player_*.png` 游戏内精灵，但选择卡片 `portrait_*.png`（80×120）仍沿用旧「兜帽+长袍+圆脸」模板，两套资源视觉脱节。本版用 ImageGen 竖版立绘 + 边缘泛洪键控管线同步 6 张 portrait。

### 调整
- **6 张 portrait 重做**（`23c1e36`）：ImageGen 832×1216 竖版原图 → `gen_portrait_pixels.py` `flood_key_bg()` 边缘泛洪键控去白底 → LANCZOS 缩放至 80×120 透明背景。与 P9 player_* 形象一致。

### 新增
- `gen_portrait_pixels.py`：portrait 专用后处理——边缘泛洪键控（不抠穿白袍）+ fit_contain 等比居中。

### 关键结论
- **边缘泛洪键控 vs 全图众数色键控**：saint 白金袍用 `key_bg()`（全图众数色）会被抠穿（白色=背景），改用 `flood_key_bg()` 只删与边界连通区域、保留内部浅色主体。这是 P9 prompt v2「亮主色」策略的 UI 版延伸。
- **`.ai_portrait_raw/` 保持未跟踪**：原图可重生成，不入库。

### 验证
- 两门质量门全绿：`vite build` + `validate:skilltree`(39 节点)。
- 视觉抽检：6 张四角透明、深色 UI 无白方块、与 P9 精灵一致。
- `grep -c '^(本次文档提交)' docs/HANDOFF.md` = **1**（本版文档提交行）。

---

## 0u. v4.3.1（apostle portrait 彩色重绘）

**范围**：v4.3 的 apostle portrait 源图 ImageGen 生成为纯灰阶稿（饱和度=3, 彩色占比=0%），深色 UI 上几乎全黑无辨识度。

### 修复
- **apostle portrait 灰阶→彩色重绘**（`8573d6d`）：重新生成彩色版（品红/洋红能量碎片环 + 青白发光眼 + 暗紫电弧披风，彩色占比提升至 ~10%），经 `gen_portrait_pixels.py` 边缘泛洪键控输出 80×120 透明背景 portrait_apostle.png。

### 验证
- `vite build` 通过；视觉抽检深色 UI 有明显品红/青白彩色锚点。

---

## 0v. v4.3.2（血裔游戏内精灵清晰度 + 放大 10% + 键控统一）

**范围**：真机试玩反馈 6 血裔游戏内精灵 `player_*.png`（46×46）像素偏低、与选择卡片（portrait）观感脱节。

### 调整
- **源分辨率 46→64**（`1743a2d`）：`gen_monster_pixels.py` 血裔 SPECS `FINAL/GRID` 46→64，清晰度提升。
- **渲染放大 10%**：`src/data.js` `PLAYER_SPRITE` 46→51。
- **键控统一**：血裔分支从众数色键控改为 `flood_key_bg()` 边缘泛洪（与 portrait 卡同策略），保留 saint 白袍不被抠穿。

### 关键结论
- 复用 P9 已生成的 1024² 高清源图（`.ai_monster_raw/<id>/`），未额外消耗 ImageGen 积分即满足「清晰 + 放大 + 与卡一致」。

### 验证
- `vite build` 通过；6 张 64×64 四角透明、saint 白袍保留、彩色占比 13–45%；player↔portrait 主色差 Δ=72–151（同角色不同光照，形象一致）。

---

## 0w. v4.3.3（血裔游戏内精灵统一到卡片同源管线）

**范围**：真机试玩反馈 v4.3.2 修复后仍存在 4 个问题：卡片与游戏内形象不一致、游戏内不清晰、apostle 白噪点、流浪者缩放偏小。

### 修复
- **新建 `gen_bloodline_pixels.py`**（`e60dc49`）：复用卡片的 `.ai_portrait_raw/<id>/raw.png` 源图 + 同一套边缘泛洪 + LANCZOS 管线，输出 64×64 归一化精灵。从架构上保证"同源 = 天然一致"。
- **从 `gen_monster_pixels.py` SPECS 移除 6 条血裔配置**（避免以后被错误管线重新生成）。

### 关键结论
- 根因是两套不同 ImageGen 源图 + 两套不同后处理管线。统一到卡片管线后，4 个问题同时消除：
  - 卡片/游戏内主色差 Δ 从 72–151 → **1.0–2.4**
  - apostle 内部白噪点从 **313 → 0**
  - wanderer 全身归一化到 64 高，与卡片比例一致
  - LANCZOS 平滑替代 NEAREST 像素化/描边

### 验证
- `vite build` 通过；6 张 64×64 四角透明；apostle 零内部白噪点；视觉对比图确认上下行形象一致。

---

## 0x. v4.3.4（apostle 永夜使徒高保真重绘）

**范围**：真机试玩反馈 apostle（永夜使徒）在游戏中太黑，几乎纯黑无法辨识。

### 修复
- **ImageGen 高保真重绘 apostle**（`2141d7a`）：迭代 3 版选 v3（紫水晶星云半透明高调发光），源图亮度 96/255、彩色 95%、暗部仅 19%（v2 仅 61/60%/66%）。
- 经 `gen_portrait_pixels.py` + `gen_bloodline_pixels.py` 双管线输出，卡片与游戏内同步更新。

### 关键结论
- 游戏内 player_apostle 亮度从 ~30→**82/255**，不再纯黑。
- ImageGen prompt 策略：对"暗色概念"角色，必须用 **"亮主色+高调发光+半透明材质"** 替代"近黑虚空剪影"，否则键控后主体仍偏黑。

---

## 0y. v4.3.5（永夜化身 Boss 重绘：太亮→暗哥特风格）

**范围**：真机试玩反馈终局 Boss `boss_avatar` 太亮（亮度 143/255，高亮像素 33%），不符合整体暗哥特风格。

### 修复
- **ImageGen 重绘永夜化身**（`88fd903`）：迭代 3 版选 cand3（暮光紫罗兰 + 强轮廓光 + 发光眼/虚空冠）。经 `gen_monster_pixels.py` 标准怪物管线输出。
- **效果**：亮度 143→**82/255**，高亮 33%→**9%**，暗部 27%→**35%**，彩色 67%→**99%**。图鉴黑底清晰可辨。

### 关键结论
- **Boss 设计四约束平衡**："不要太亮"（降亮度）+ "符合暗哥特"（暮光紫罗兰）+ "也不要太黑"（轮廓光保可见）+ "避免图鉴异常"（黑底上轮廓可辨）。
- 陈旧源图 `.ai_monster_raw/avatar/raw.png` 已缺失 → 必须重新 ImageGen。管线 `sorted(glob)[0]` 会优先取旧文件名排序靠前的陈旧源——重绘时需先清理旧源。

---

## 0z. v4.3.6（永夜使徒无初始武器死锁修复：槽外固有永夜光环起手）

**触发**：真机试玩反馈选永夜使徒开局后无法攻击怪物、无法获得经验升级，整局卡死。

**根因**：`data.js` 中 `apostle` 血裔 `weapon: null`，`game.js:281` 的 `if (bl.weapon)` 因 null 为假跳过发武器；其 `apply` 只加属性、技能树「使徒权能」节点也只加伤害/减伤，全程无攻击手段。游戏升级经济完全依赖击杀掉落经验（`game.js:471/518/523 → gainExp`），无武器 → 无法击杀 → 无经验 → 无法升级 → 无法开宝箱选武器，构成开局硬死锁。

**修法（方案 A · 槽外固有权能）**：复用既有 `innate` 机制（圣徒圣水同款），将 `apostle` 改为 `weapon: 'aura', innate: true`，开局获得「永夜光环（亡灵光环复用，槽外固有·不占武器槽）」。玩家既能攻击/击杀/升级/开宝箱，又保留「无武器（槽）起手」差异化身份（0 武器槽被占用，仍可正常捡/升级常规武器）。

### 关键结论
- 「无武器起手·高难高回报」意图成立，但缺起手攻击手段导致高难变不可玩——本次仅补起手攻击能力，属性偏向（伤害+30% / 移速+25% / 冷却-25% / 生命-20%）不变，强度是否需随固有光环重新校准留待真机数据判定。
- 复用 `aura` 固有可能带来轻微叙事错位（使徒签名能力显示为通用「亡灵光环」），若需专属使徒武器为后续可选项，非阻塞。

---

## 0aa. v5.0（宠物战斗拾取系统）

**触发**：用户要用自家真实猫照片作宠物，要求跟随+拾取宝石+部分攻击，并拆成独立帧动画（跟随/拾取/攻击各一组）。

**方案与落地**：
- **图片管线**：用户发两张「姿势表 contact sheet」（橘猫 2×3、美短 2×4），`gen_pet_frames.py` 按网格切片 → 边缘泛洪键控抠白底（rembg 需联网下载模型、代理 502 不通，改用离线泛洪；近白残余阈值 220 清理）→ LANCZOS 平滑归一化 64×64 → 暗底柔和投影（保留照片质感、图鉴黑底可见）。共 13 帧：`pet_orange_follow_0/1 pickup_0/1 urine_0/1`、`pet_amer_follow_0/1 pickup_0/1 butt_0/1/2`。
- **橘猫 urine**：攻击调 `PetSystem.spawnUrineShot` 自管抛物线弹道，落地生成水洼（`puddles[]`），每 0.3s 对范围内敌人 `applyDebuff('slow', 55%)` + `applyDebuff('burn', dps)`。**关键修正**：游戏既有 `spawnHazard` 只对**玩家**生效（entities.js:894-914），不能减速敌人，故尿液水洼是宠物系统自管实体，不复用 `spawnHazard`。
- **美短 butt**：攻击调既有 `WeaponSystem.hitEnemy(e, dmg, kx, ky, '#fff')` 结算伤害+击退，零新伤害代码。
- **拾取**：`PickupSystem.update` 挂第二磁吸源/拾取点（`this.game.pets.pet`），就近宝石被吸走、触点入账，不动掉落逻辑。
- **契约屏**：标题新增「宠物」入口，屏内花**灵魂**购买（`buyPetUnlock` 查 `PET_SHOP`、写入 `souls.unlocks`，与祭坛同一 unlocks 体系）、已购猫「选择」出战（单只，`setSelectedPet`/`getSelectedPet` 持久化，含「不带宠物」）。`setSelectedPet` 允许传 `null` 取消出战。
- **强度**：随 `player.damageMul` + 时间缩放（540s 后轻微成长），保持「一部分贡献」。

**红线自检**：`npm run build` 通过（技能树 39 节点无断链）；dev server 冒烟页面/模块/资源均 200；13 张宠物 PNG 已入库（非 AI_OWNED 集，不受 gen_assets.py 覆盖）。

---

## 0ab. v5.1（宠物选中失效修复 + 美短图标可见性 + 微信验证）

**触发**：用户反馈 PC 端宠物「选择」按钮点击无反应；美短猫卡片图标黑色花纹融入暗底不可见。

**根因与修复**：
- **选中失效**：`loadSouls()` base 对象逐字段还原 localStorage，但**漏写 `selectedPet` 字段**（对比 `selectedBloodline` 已包含）。`setSelectedPet` 写入成功但每次读取丢弃 → `getSelectedPet()` 恒返 null → 卡片永远不显示「使用中」。修复：base 补 `selectedPet: o?.selectedPet ?? null`。**教训：新增持久化字段必须同步加进 loadSouls base。**
- **美短暗底不可见**：宠物卡缩略图背景 `rgba(0,0,0,.5)` 暗底，深色猫毛低对比。改为浅中性渐变背景；游戏内宠物本体加柔和浅色背光。
- **微信验证文件**：`public/f3cf20e70ac09eb3e2c94fba4342e616.txt`（微信分享链接风控）。

---

## 0ac. v5.2（`4f0cdf1` · 宠物跟随/吸附/使徒光环/改名）

**触发**：真机试玩反馈——宠物易脱屏、拾取无吸附感、使徒初始光环看不见、用户要求宠物改名。

**根因与修复**：
- **宠物脱屏**：`pet.js` 按相机视口 `cam.x/y` + 28px 边距钳制（用平滑目标 `cam.x/y` 避免震屏抖动）。
- **拾取吸附**：`PET_DEFS` magnetRadius 80→170、pickupRadius 30→52。
- **使徒光环不生效**：渲染层只查 `player.weapons` 漏了 `innateWeapons` → 光环无视觉（伤害结算本就遍历 innateWeapons 生效）。补查 innateWeapons，并重构 `drawAuraRingColored` 支持使徒专属永夜紫配色。
- **改名**：橘猫→肥波、美短→肥强（PET_DEFS + PET_SHOP）。

## 0ad. v5.3（`0963e92` · 宠物拾取引用修复 + 跟随算法重写）

**触发**：仍看不到宠物攻击/拾取效果。

**根因与修复**：
- **拾取从未触发**：`_hasNearbyGem` 误用 `this.game.pickupSystem?.gems`，但 game.js 实例名是 `this.pickups`（`new PickupSystem(this)`）→ `pickupSystem` 恒 undefined → 拾取检测永不工作。改为 `this.game.pickups?.gems`。
- **跟随算法重写**：期望位置驱动——默认贴身跟随血裔；仅血裔 `ENGAGE_RANGE=180` 内有宝石/敌人时短暂偏离，偏离钳制 `FOLLOW_LEASH=240`；拾取/攻击共用 `ACTION_CD=2.0s`。

## 0ae. v5.4（`3651162` · 宠物完全不可见）

**触发**：PC 端仍看不到宠物跟随血裔。

**根因与修复**：`render()` 已对 ctx 应用相机平移（`-cam.ox/-cam.oy`），所有实体用世界坐标−cam 转屏幕坐标；而 `pets.draw(ctx)` 调用**未传 cam**，宠物 draw 直接用世界坐标 → 画到屏幕外。修复：`PetSystem.draw`/`Pet.draw` 接收 cam 改用 `x-cam.ox/y-cam.oy`，水洼与尿液飞溅同步；`game.js` 调用处补传 cam。

## 0af. v5.5（`a71661c` · 肥波尿液攻击修复 + 宠物商店删「无宠物」卡）

**触发**：肥波未实现抛物线尿液攻击；用户要求删除「无宠物」选项卡。

**根因与修复**：
- **尿液不生效**：攻击触发死卡 `宠物须贴到敌人 70px 内`，但 `FOLLOW_LEASH=240` 钳制 + `ENGAGE_RANGE=180` 感知 → 宠物几乎到不了 70px → 远程抛物线尿液从不触发。改为敌人落 `ENGAGE_RANGE` 内即发动（尿液抛物线 / 美短头撞均远程结算）；尿液飞溅放大 6×5 + 描边提升可见性。
- **删「无宠物」卡**：`renderPet` 移除「不带宠物」选项卡，玩家只能从已解锁宠物中选。

---

## 0ag. v5.6（`d3347e1` · 肥波尿液可见性：抛物线拖尾 + 不规则尿渍 + 危害层移至暗角后）

**触发**：v5.5 修完触发后用户真机仍看不到肥波「侧身射出的黄色抛物线尿液」和「地上的不规则黄色尿液标记」。

**根因**：v5.5 只修了「触发」，但渲染太弱且被暗角渐变压暗：
- 飞溅弹体只是 `6×5` 小黄点（看不出抛物线轨迹）；
- 地面水洼是 `alpha 0.30` 的规整椭圆，且 `pets.draw` 在 vignette 之前绘制 → 被暗角进一步压暗，几乎不可见；
- 形状是椭圆，不符合「不规则」诉求。

**修复**：
- `pet.js` `_fireUrine`：尿液从猫侧前方喷出（`player.facing` 偏移 10px），更显侧身射击姿态；
- `pet.js` `spawnUrineShot` 加 `trail:[]`；`_updateShots` 每帧记录轨迹（最多 16 点）；
- `pet.js` `PetSystem.draw` 拆为 `drawPet`（猫本体，vignette 前）+ `drawHazards`（尿液层，vignette 后）：
  - 飞行尿液：轨迹渐隐黄线 + 径向光晕发光弹体（实心黄核）；
  - 地面尿渍：`makeBlobVerts(12)` 一次性生成随机顶点主斑（压扁成地贴）、暗边描边、湿润高光、3–5 颗 `makeDrops` 卫星小滴；alpha 提到 `0.62`；
- `game.js` `render()`：`this.pets.drawPet(ctx,cam)` 保留原位，`ctx.drawImage(vignette)` 之后新增 `this.pets.drawHazards(ctx,cam)`；
- 验证：`npx vite build --outDir .ns-build-2x` 通过（18 模块），无 `pets.draw(` 残留引用。

---

## 0ah. v5.7（`cd52bf5` · 肥波设为初始自带宠物：免购买 + 永久解锁 + 默认出战）

**触发**：用户要求「初始宠物携带肥波，不需要购买」。

**根因与改动**：原宠物走 `PET_SHOP` 花灵魂购买、`s.unlocks` 记录解锁、`isUnlocked(id)` 判定、`getSelectedPet()` 返回已选宠物（无选则 `null`=无宠物）。改为初始自带：
- `PET_DEFS.orange` 加 `starter: true`；
- `isUnlocked(id)`：`if (PET_DEFS[id]?.starter) return true;`（**新/老存档均永久免解锁**——老存档 `unlocks` 为空也直接 true）；
- `PET_SHOP` 移除 orange 项（肥强 amer 仍保留 👁180 出售）；
- `buyPetUnlock(id)`：`if (PET_DEFS[id]?.starter) return false;`（防误买免费宠）；
- `getSelectedPet()`：`if (!s.selectedPet && isUnlocked('orange')) return 'orange';`——**未显式选择时默认出战肥波**（开局即带）；已选肥强等保留；
- `ui.js` `renderPet`：starter 宠物的卡加「初始自带」金色徽标（`.ac-badge.starter-badge` 样式，`style.css`）。

**验证（Node 仿真，stub localStorage/assets）**：
- 新档 `isUnlocked('orange')=true`、`getSelectedPet()='orange'`、`buyPetUnlock('orange')=false`、`PET_SHOP.length=1`；
- 老存档 `selectedPet=null` → `getSelectedPet()='orange'`（初始自带默认出战）；已选 `amer` → 保留 `amer`。
- 构建 `npx vite build --outDir .ns-build-2x` 通过（18 模块）。

---

## 0ai. v5.8（`ba2155a` · 修复宠物契约界面空白 TDZ）

**触发**：用户反馈「宠物契约那里没有宠物选择和购买了」——界面整片空白。

**根因**：v5.7 把 `renderPet` 的 `def.starter` 徽标逻辑写在了 `const name = document.createElement('h3')` **声明之前**：
```js
if (def.starter) { /* ... */ name.appendChild(badge); }   // ← name 此时处于 TDZ
const name = document.createElement('h3');
```
循环首个宠物(肥波)即抛 `ReferenceError: Cannot access 'name' before initialization`，整个 `renderPet()` 中断，`pet-content` 始终为空，选宠/购买按钮全无。

**改动**：将 `def.starter` 徽标块移回 `name` 声明**之后**（`src/ui.js` `renderPet`）。

**验证（stub-DOM 运行时仿真，抽真实 renderPet 方法体跑）**：正常渲染 2 张卡片——肥波(`altar-card owned`，按钮「选择/使用中」)、肥强(`altar-card`，按钮「👁 180 解锁」)；无 TDZ 报错。构建通过（18 模块）。

---

## 0aj. v5.9（`3534f70` · 老存档迁移：曾选肥强→改回初始肥波出战）

**触发**：用户反馈「还是没看到肥波尿液攻击，好像只有冲撞，是否攻击模式和肥强搞混了」。

**排查（先证伪部署假说）**：抓取线上 `night-survivors.pages.dev` 当前 JS bundle，确认含 `初始自带`/`#ffe066`/`#e8c21e`/`drawHazards` 等 v5.6+ 特征，旧弱渲染色 `#f2d94a`/`#e6c230` 计数 0 → **部署未卡旧版本**，攻击模式代码未搞混（orange=urine、amer=butt 分发正确）。

**根因**：出战宠物实为 **肥强(amer)** 而非肥波(orange)。v5.7 把肥波设为初始自带时，`getSelectedPet()` 仅在「从未选过宠物」时默认肥波；用户在 v5.5 强制选宠时若选了肥强，`selectedPet='amer'` 为真不会被覆盖 → 一直带肥强、只见冲撞，被误认「肥波尿液与肥强冲撞搞混」。

**改动**：`migrateSouls` 加一次性迁移——肥波 starter 且老存档 `selectedPet` 为非 orange 值时改回 `orange`，置 `_starterPetV57` 持久化标志；迁移后用户仍可在契约界面手动切回肥强，不会被二次覆盖。`base` 同步加 `_starterPetV57` 字段。

**验证（Node 仿真 stub localStorage，7 场景全过）**：① 老档 selectedPet=amer→迁移 orange 且标志置位；② 新档默认 orange；③ 迁移后手动选 amer→重开保持 amer（不被二次迁移）；④ 已选 orange 的老档不触发迁移。构建通过（18 模块）。

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
├── scripts/
│   └── validate_skilltree.mjs  # 技能树数据完整性校验（prebuild 钩子）
├── tests/
│   └── skilltree_overlap.py    # 技能树重叠回归用例（需 dev server）
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
- 「玩法说明」弹层（`index.html` #guide-screen）已于 v0.26 对接现状：12 分钟终局 / 9 分钟入夜 / Boss 3·6·9·12′、8 武器 / 13 被动 / 10 神器进化 / 6 血裔 / 灵魂祭坛 / 技能树 / 词缀怪；标题栏新增「Boss 宝箱→进化神器」提示。改动指南须同步此处。

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
- 武器（16 件，初始解锁；v2.0 新增 8 件：starfall/judgment/phantom/aegis/warden/maul/sanguine/resolve）
- 神器（18 件：原 10 件两两合成 + v2.0 新增 8 件「满级对应武器 + 配对被动」合成进化，rarity:'normal'）
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

图鉴界面（`#codex-screen`）：一级菜单分「被动 / 神器 / 怪物 / 武器」4 类独立屏（`#codex-hub` → `#codex-passives`/`#codex-artifacts`/`#codex-monsters`/`#codex-weapons`），每类只渲染本类卡片；被动图鉴 v1.11 起独立拆出（此前被动/神器/武器混在武器图鉴内）。各卡显示解锁状态。

> **武器特效 / tint 链路（v0.36）**：各神器觉醒武器的专属视觉差异目前集中在渲染层 tint。永劫之鞭（eternalwhip）在 `src/weapons.js` 顶部定义 `ETERNALWHIP_TINT`（熔金黑鞭配色：body #ffb847 / edge #4a2f12 / tip #fff1c9），经 `applyWhip` 第 5 参透传至 slash，render 描边与尖端高光改 tint 感知；基础鞭不传 tint 走原粉色。其余神器（storm/devour/spiral/stormcall/crimson/tempest/sepulcher/matrix）的专属特效沿用各自既有渲染分支。规格扩展项（残影光晕 / 命中火花 / 主题伤害数字）已于 v0.38 实现：additive 残影光晕（`sl.tint.trail` #d4af37）+ 命中金色火花（`spawnSparks` 6×`spark`+3×`sparkHot`）+ 鎏金主题伤害数字（`tint.dmg` #e0a93b），均 gate 在 `sl.tint` 存在性上，基础鞭零变化。

> **第 10 神器：亡魂收割者 Reaper's Scythe（v0.37）**：新增 scythe 武器（亡魂镰刀，回旋镰刀投射物=大范围回旋镰斩）+ reaper 神器（由 scythe 武器 + 贪婪之魂 被动进化，配方见 `RECIPES`）。觉醒后 scythe 攻击追加：① 撕裂 DOT（`entities.js` 敌人身上的 `rend` 字段，每帧按 `dps*dt` 结算）② 收割回能（被 scythe/rend 击杀且持有 reaper 时归还少量 HP）。两项觉醒效果均门控 `hasArtifact('reaper')`，基础 scythe 不受影响。骨白 #e8e0c0 + 幽魂绿 #7fff9f 专属配色（`weapon_scythe.png` / `art_reaper.png`）。数值（镰刀数量 / 伤害 / rend dps / 回血量）标 `[PLACEHOLDER]` 待真机校准。

> **v2.0 新增 8 武器 + 8 神器（被动配对合成，src/data.js RECIPES + src/weapons.js）**：8 件新武器（starfall 星陨=追踪陨落 / judgment 审判=贯穿雷枪 / phantom 幻影=分身残影 / aegis 壁垒=哨卫环绕 / warden 守望=法球环绕 / maul 重锤=震荡波 / sanguine 血怒=吸血近战 / resolve 决意=符文爆发）各自 1:1 配对一件新神器（fatalis 终焉 / retribution 裁决 / mirage 幻界 / bastion 堡垒 / sentinel 哨卫 / cataclysm 灭世 / bloodpact 血契 / absolution 赦罪），合成路径为「满级该武器 + 配对被动」（`RECIPES` 表）。新神器觉醒效果经 `_awakened(weapon)` 门控——仅当玩家持有配对被动才启用（如 retribution↔shield、sentinel↔shieldregen），基础神器零变化。性能：`enforceCaps()` 在 `weapons.js update(dt)` 末尾 oldest-first 裁剪所有桶（`PROJECTILE_CAP=600/POOL_CAP=60/BOLT_CAP=80/VIAL_CAP=40/SLASH_CAP=40` + `MAX_SENTINELS=6/MAX_ORBS=8/MAX_SHOCKWAVES=12/MAX_RUNES=24` + `thunderRunes=24/bursts=12/mirageResidues=32`），压测验证后期不掉帧。可访问性：retribution(红)/sentinel(绿) 配色仅靠色相易混淆，已用亮度差区分。**v2.1 起 8 件神器图标不再共用「纹章盾」底形，改为各自专属剪影——fatalis(八方罗盘星)/retribution(直立审判剑)/mirage(不对称碎晶簇)/bastion(城塞垛口)/sentinel(全视之眼)/cataclysm(战锤)/bloodpact(缠棘血心)/absolution(钟)，配色与暗描边风格不变**。**v2.2 起渲染进一步差异化：5 把新武器弹丸各有专属剪影（星陨=八方星芒 / 幻影=不对称碎晶 / 血怒=獠牙滴血 / 壁垒=晶棱弩矢 / 守望=环纹能量球，经 `SHAPE_DRAWERS`+`getShapeSprite`+`projShape` 离屏缓存）；8 件神器觉醒 id 同步驱动弹幕/形态差异（终焉=彗星残迹 / 幻界=双重残影 / 血契=血心 / 堡垒哨卫=六边结界纹 / 哨卫法球=眼形瞳孔 / 灭世冲击波=红色锯齿环 / 赦罪符文=红圈血钟），全部 `getShapeSprite` 缓存、无逐帧 shadowBlur、均在 `enforceCaps()` 桶内，性能红线未破**。**v2.3 起两处调整**：① 升级卡「神器合成提示」行改为选项卡最下方单独整行、允许换行不再溢出（src/upgrade.js + style.css 卡片纵向结构 `.uc-top`/`.uc-recipe`）；② 新增「槽外固有武器」双表模型（`player.weapons` 占槽 + `player.innateWeapons` 槽外）——圣水洗礼（双生武装 `soul_dual.apply` 与圣徒 `saint` 血裔的 `weapon:'holywater', innate:true`）入槽外表，**双源持有自动合并为单条两级、0 槽占用**，`hasWeapon`/`weaponLevel`/`upgradeWeapon`/`removeWeapon` 查双表、`update()` 每帧迭代 `[...weapons, ...innateWeapons]` 保证槽外武器照样开火，圣徒路线仍可升满级 + magnet 进化「吞噬」神器（devour 从槽外表移除基础圣水）。装备栏以青描边 +「免」角标标注槽外固有武器。**v2.4 修复 v2.2/v2.3 形状「代码已部署但运行时仍是棱形」的根因**：`addWeapon`/`addArtifact` 创建的武器实例 `{id, level, timer}` **缺 `.visual` 字段**，`fireHoming` 等内部 `projShape(weapon.visual, …)` 恒拿到 `undefined` → `default: return null` → `p.shape` 永远 `null` → 永远走菱形 fallback（仅 `tint` 换色故「棱形只是颜色不同」）。v2.4 于 `addWeapon`/`addArtifact` 创建实例时补齐 `visual: WEAPONS[id].visual || id`，整条链路（homing/splitting/lifesteal/fireSentinel 派生 `sn.visual`/fireOrb 派生 `o.visual`/fireRune→`rn.awaken`）从此取得到正确剪影；神器 `tick*` 本就显式传 `{visual,…}` 故不受影响。另：v2.2 红钟仅 `rn.awaken==='absolution'` 触发，而基础武器 `resolve`(镇魂钟鸣) 的 `rn.awaken==='resolve'` 仍走圆圈光晕——用户实际测的是基础武器，故 v2.4 将红钟条件扩为 `rn.awaken==='absolution' || rn.awaken==='resolve'`，**整个钟鸣家族（基础 + 觉醒）均渲染红圈血钟**。运行时探针验证：starfall→`star`/phantom→`shard`/sanguine→`fang`/aegis 哨卫→`bolt`/warden 法球→`orbiter`（均正确挂载）；起始武器 `blade`(忍者飞刀) 按设计保留菱形。

---

> **v2.5 镇魂钟鸣音波脉冲化（src/weapons.js `updateRunes`/`updateRunePulses`/`fireRune` + src/data.js `resolve.levels`）**：原符文陷阱「敌人踏入极小触发圈(`triggerRange` 28~36px)才引爆一次、且 `triggered=true` 后一生只炸一次」导致大爆发圈(`burstRadius` 70~110px)内未踩中中心小圈的敌人完全不掉血、且符文存活期(8~12s)内仅造成一次伤害（用户反馈「触发频率低、进圈有时不触发」）。现改为圈内**周期性音波脉冲**：每个存活符文每隔 `pulseInterval`(L1~L5：1.1→0.8s；absolution 0.7s) 从中心发出向外扩张的音波环（亮外环 + 内回响环），环前缘扫过的敌人掉血（每脉冲每敌命中一次，伤害 = 符文基础伤害 × `pulseMul`，基础 0.5 / absolution 0.6）。`fireRune` 同步修补原符文缺 `maxLife` 导致渲染透明度 `NaN` 的隐性 bug；`resolve.desc` 同步改为「周期音波脉冲持续肃清范围内敌人」。数值（节奏/倍率/脉冲 life/speed/width）标 `[PLACEHOLDER]` 待真机校准。`enforceCaps()` 新增 `trim(runePulses,200)` 安全网，性能红线未破。**v2.5a 范围跟进修复**：用户实测仍「范围太小、进圈有时不触发」，根因为符文静止被甩在身后、内圈死区(`burstRadius`<`deployRange`)、环间隙。现符文每帧环绕玩家重算坐标(`fireRune` 存 `offAng/offR`、`updateRunes` 重算 `x/y`)；`burstRadius` 调大 `deployRange` 调小使 `burstRadius>deployRange`(L1~L5：130/145/160/175/190 vs 110/120/130/140/150，absolution 200 vs 150)封死内圈死区并扩大范围；`updateRunes` 新增进入即触发(敌人踏入 `burstRadius` 即把脉冲等待压到 `ACTIVE_CAP=0.3s`，无敌人回落 `pulseInterval`)。觉醒 absolution 减伤光环因符文常伴玩家而**常驻**(合理增强)。`resolve.desc` 最终为「符文环绕周身,敌人进入范围即触发音波脉冲」。**v2.5b 吸附修复**：用户实测 v2.5a 虽已跟随但 `burstRadius`(190)>`deployRange`(150) 且符文不自转，12 个辉光罩住玩家像贴脸光环。现 `deployRange` 提到 `burstRadius+40`(L1~L5：170/185/200/215/230，absolution 240) 使辉光向外不罩脸，并加 `spin:0.6` 让符文绕玩家自转扫场(`updateRunes` 每帧 `rn.offAng += spin*dt`)。

## 10. 测试

### 自动化测试（e2e，Playwright）
```bash
# 先确保 dev server 在跑（npm run dev），再：
/Users/a34481/.workbuddy/binaries/python/envs/default/bin/python test_game.py
```
- 模拟完整游戏流程：升级、神器进化、Boss 战、宝箱掉落、图鉴、灵魂结算、词缀渲染、宝石过期等
- **130+ 断言**，含「控制台无报错」硬门控（v0.23 起，防止渲染崩溃带病通过）
- 已知 flaky：`65%血 召唤蝙蝠` 偶发（Boss 血瞬置 0.65 后 600ms 内可能被打下阶段带），复跑可过；`TOTAL FAILURES` 计数偶发误报

### 技能树重叠常驻回归用例（v3.13 新增）
```bash
# ⚠️ 前置条件：dev server 必须在 5173 运行（另开终端 npm run dev）——本用例走真实浏览器渲染，无法离线跑
npm run test:skilltree
```
- **覆盖 8 档**：桌面 3 档（1280×800 / 1600×1000 / 1920×1080）+ 真触屏移动端 5 分支全遍历（`has_touch=True, is_mobile=True`，390×844，dsf=3）。
  - 移动端**必须逐分支切换**：`ui.js` 的 `branchIds = isMobile ? [this.stBranch] : Object.keys(...)` 一次只渲染当前分支，只测默认 war 会放过其余 4 支（war 9 / bly 8 / nfr 8 / eco 6 / utl 8 节点）；切换走 `.st-seg-btn[data-branch=...]` 真实点击。
- **断言项**：父子纵向相交 **0 组**、任意两卡可见碰撞 **0 组**，并输出节点数、卡高 min/max、实测行距、`ROW_H` 余量。
- **行距不硬编码**：从卡片 top 网格取相邻最小正差**反推实测 `ROW_H`**，日后改布局常量测试自动跟上，不会因常量变更而失效。
- **WARNING 语义**：余量 **< 8px 给 WARNING 但不失败**（吃紧、尚未重叠）；真正重叠才 FAIL，且逐对打印定位（如 `war_root → war_dmg 纵向相交 7px`）。
- **移动端失真守卫**：若 `<html>` 未带 `.touch-device` **直接判 FAIL**——防 v3.10/v3.11 那种「以为测了移动端、其实测的是桌面布局」的漏检。
- **刻意不接 `prebuild`/`build`**：本用例依赖 dev server，接进构建链会让离线构建失败。挂 prebuild 钩子的是 `validate:skilltree`（纯数据校验，无需浏览器）。
- ⚠️ **维护提示（重要）**：桌面 `ROW_H=178` 对实测最大卡高 160px **仅余 18px**。若后续要**加长节点描述文案**，应**先把 `ROW_H` 提到 190+ 再加文案**，而不是等测试报红再回补。

### 浏览器手动测试
- 桌面：WASD 移动，ESC/P 暂停
- 移动端：真机访问线上地址（锁竖屏，横持留黑边）
- 关键验证点：竖屏铺满、浮动摇杆在按下位置出现、暂停/恢复、切后台自动暂停、狼群怪金圈、Boss 弹幕分三波

---

## 11. 最近 commit 历史（最新在前）

> 🚨 **维护红线（写本节前必读，顺序不可颠倒）**
>
> **第一步：先回填，再插新行。** 动笔写新版本的提交行之前，**必须先**把代码块第一行上一版的 `(本次文档提交)` 替换成它的**真实短哈希**（提交后用 `git rev-parse --short HEAD` 或 `git log --oneline -1` 取），**然后**才在顶部插入本版的新行。
>
> **为什么有 `(本次文档提交)` 这个占位符**：文档提交本身无法在自己的内容里写入自己的哈希（哈希要等提交生成后才存在，自引用不可能），所以文档提交行只能先留占位符，由**下一版**代为回填。
>
> **不回填会怎样**：历次直接在顶部插新行，会把上一版那行占位符原样「顶下去」而非补齐，该版文档提交的哈希就**永久丢失**在历史里，日后再想定位只能翻 `git log` 反查。
>
> **存证**：`461a5a5`（v3.11 文档提交）就是这样被顶掉的，一路空占到 **v3.13 才补回**，中间跨了两个版本；本次 v3.14 回填的是 v3.13 的 `ae95024`。
>
> **收尾核对（务必用行首锚定）**：
>
> ```bash
> grep -c '^(本次文档提交)' docs/HANDOFF.md   # 必须输出 1
> ```
>
> 结果**有且仅有 1**——即你当前正在写的这一版那一行。**0** 说明漏写本版占位符，**≥2** 说明上一版没回填，两种都要就地修掉再提交。
>
> ⚠️ **必须带 `^` 锚定**：本节正文（以及 §0p）为讲清这条规则，会在散文里多次提到 `(本次文档提交)` 这个字符串，不加锚定的 `grep -c '(本次文档提交)'` 会把这些说明文字一并计入，**数值随文档措辞增删而漂移、恒 > 1**，永远不等于 1。占位符的真实语义是**代码块里一行提交记录的行首前缀**，只有行首锚定才对应这个语义。

```
(本次文档提交) docs: v5.9 CHANGELOG + HANDOFF 同步(§0aj 老存档迁移肥强→肥波出战) + §11 回填 fa66a30(v5.8 文档提交) | 自身哈希待下一版回填
fa66a30 docs: v5.8 CHANGELOG + HANDOFF 同步(§0ai 宠物契约TDZ空白修复) + §11 回填 fac1e54(v5.7 文档提交) | tag v5.8 指向 ba2155a
fac1e54 docs: v5.7 CHANGELOG + HANDOFF 同步(初始宠物肥波免购买+永久解锁+默认出战) + §11 回填 945ed72(v5.6 文档提交) | tag v5.7 指向 cd52bf5
945ed72 docs: v5.6 CHANGELOG + HANDOFF 同步(肥波尿液可见性:抛物线拖尾+发光弹体+不规则尿渍,危害层移至暗角后绘制) + §11 回填 a71661c(v5.5 文档提交) | tag v5.6 指向 d3347e1
a71661c docs: v5.5 CHANGELOG + HANDOFF 同步(肥波尿液攻击修复:攻击触发去掉70px贴身死锁改ENGAGE_RANGE内即发动+尿液飞溅放大6x5;宠物商店删「无宠物」卡;§0ac-0af补小节,指向 a71661c) + §11 回填 5d2a1d5(v5.4 文档提交) | tag v5.5 指向此提交（自身哈希无法在提交内容中自引用）
5d2a1d5 docs: v5.4 CHANGELOG + HANDOFF 同步(宠物渲染坐标修复:世界坐标未转屏幕坐标漏传cam→画屏幕外不可见,指向 3651162) + §11 回填 4399b08(v5.3 文档提交) | tag v5.4 指向此提交（自身哈希无法在提交内容中自引用）
4399b08 docs: v5.3 CHANGELOG + HANDOFF 同步(宠物拾取引用修复 pickupSystem→pickups + 跟随算法重写,指向 0963e92) + §11 回填 a023c0b(v5.2 文档提交) | tag v5.3 指向此提交（自身哈希无法在提交内容中自引用）
a023c0b docs: v5.2 CHANGELOG + HANDOFF 同步(指向 4f0cdf1) + §11 回填 57a018e
4f0cdf1 feat: 宠物屏幕钳制+吸附范围扩大+使徒光环修复+宠物改名肥波肥强
57a018e fix: 宠物帧腿缝纯白岛残留修复(remove_bg加_fill_white_holes:删不连通四边+纯白min>250孤岛;13帧重生成,诊断残留纯白岛=0/猫白毛240-249保留5205px)+CHANGELOG补条目
8f3f56e docs: v5.1 宠物帧肚皮下白背景残留修复(flood_key_bg两阶段泛洪:种子min>246+蔓延距纯白≤22;13帧重生成,诊断残留白=0/猫白毛保留)+CHANGELOG补条目
6f2582b docs: v5.1 补录宠物帧白毛保留修复(gen_pet_frames.py绝对阈值min>246替代全局白清理)+CHANGELOG补条目
7a6121b fix: v5.1 宠物选中失效修复(loadSouls漏selectedPet持久化字段)+美短图标可见性(浅中性渐变背景+游戏内背光)+微信域名验证文件 | tag v5.1 指向此提交
004c7ca fix: 宠物帧白毛保留修复(gen_pet_frames.py:flood_key_bg改绝对阈值min>246判定背景+remove_bg连通性清理同阈值;13帧重生成,美短银渐层白底黑纹/橘猫白胸花纹肉眼确认恢复)
ea06f2c docs: v5.0 CHANGELOG + HANDOFF 同步(指向 3c0112c) + §0aa 小节(v5.0: 宠物战斗拾取系统) + §11 回填 8c1a76c(v5.0 重标号文档提交) | tag v5.0 指向此提交（自身哈希无法在提交内容中自引用）
f5af563 docs: v4.3.6 CHANGELOG + HANDOFF 同步(指向 d4981cb) + §0z 小节(v4.3.6: 永夜使徒无初始武器死锁修复,槽外固有永夜光环起手) | tag v4.3.6 指向此提交
b82f189 docs: v4.3.5 CHANGELOG + HANDOFF 同步(指向 88fd903) + §0y 小节(v4.3.5: 永夜化身boss重绘,亮度143→82/255) | tag v4.3.5 指向此提交（自身哈希无法在提交内容中自引用）
b9a311b docs: v4.3.4 CHANGELOG + HANDOFF 同步(指向 2141d7a) + §0x 小节(v4.3.4: apostle高保真重绘,亮度30→82/255) | tag v4.3.4 指向此提交
0a45c22 docs: v4.3.3 CHANGELOG + HANDOFF 同步(指向 e60dc49) + §0w 小节(v4.3.3: 血裔游戏内精灵统一到卡片同源管线, 修复4项不一致/不清晰/白噪点/缩放) + §11 回填 36e633d(v4.3.2 文档提交) | tag v4.3.3 指向此提交
36e633d docs: v4.3.2 CHANGELOG + HANDOFF 同步(指向 1743a2d) + §0v 小节(v4.3.2: 血裔精灵清晰度+放大10%+键控统一) + §11 回填 f2e1525(v4.3.1 文档提交) | tag v4.3.2 指向此提交
1743a2d feat(v4.3.2): 6血裔player精灵提清晰度(46->64源分辨率) + 渲染放大10%(PLAYER_SPRITE 46->51) + 键控统一边缘泛洪(与portrait卡一致,保留saint白袍) | gen_monster_pixels.py 血裔SPECS FINAL/GRID 46->64 + 血裔分支改用 flood_key_bg(边缘泛洪); src/data.js PLAYER_SPRITE 46->51; 8文件 +13/-10; vite build 通过
f2e1525 docs: v4.3.1 CHANGELOG + HANDOFF 同步(指向 8573d6d) + §0u 小节(v4.3.1: apostle portrait 彩色重绘) + §11 回填 d3a0dfd(v4.3 文档提交) | tag v4.3.1 指向此提交
8573d6d fix(v4.3.1): apostle portrait 灰阶→彩色重绘(品红能量环+青白眼, 替代原灰阶稿) | 源图 ImageGen 生成为纯灰阶(饱和度=3,彩色占比=0%), 重生成彩色版(饱和度=15,彩色占比~10%)经 gen_portrait_pixels.py 边缘泛洪键控输出 80×120;1文件;vite build 通过
d3a0dfd docs: v4.3 CHANGELOG + HANDOFF 同步(指向 23c1e36) + §0t 小节(v4.3: portrait选择卡片立绘同步) + §11 回填 b28e24d(v4.2 文档提交) + 头部"最后更新"更新到 2026-08-07 v4.3 | tag v4.3 指向此提交
b28e24d docs: v4.2 CHANGELOG + HANDOFF 同步(指向 70f21e3) + §0s 小节(v4.2: 白色系精灵暗底重绘 + 血裔角色差异化立绘) + §11 三处索引修复(回填 b5a3e46 此前为占位符 + 补录漏登的 61108b7 + 登记本版 70f21e3) + 头部"最后更新"更新到 2026-08-06 v4.2 | tag v4.2 指向此提交
70f21e3 feat(v4.2): 4白色系怪物暗底重绘(bone_knight/siren/revenant/warlord) + 6血裔角色差异化立绘(wanderer/saint/berserker/thunder/bloodthirsty/apostle) | 起因:用户真机反馈①白色系精灵"显示不鲜明"②6血裔共用「兜帽+长袍+圆脸」模板仅换色、剪影完全一致战斗中分不清;关键结论:prompt v2「亮主色」策略对白/浅色概念反而加剧发白,这类必须改用「暗底+局部强对比亮点」(发光眼窝/符文/荧光长发作视觉锚点),两策略互补而非替代;角色去同质化的关键是外轮廓形状而非配色(X形蝠翼/光环圆盘/扛肩巨剑折线/浮空无腿);gen_monster_pixels.py SPECS 补入 6 血裔条目(此前玩家精灵不在管线覆盖内)+bone_knight 规格 46→52px;warlord/revenant 各重试 4 次仍有偏差(模型对「纯黑金属」「非苍白腐肉」收敛困难,属能力边界);三门质量门全绿(vite build/validate:skilltree 39/test:assets 109);11文件 +8/-1 行
61108b7 docs: v4.1 UI修复文档同步(指向 1107f14) + §11 补录 | tag v4.1 之后的文档维护提交,不打版本 tag;当时补录了 1107f14 但**未回填上一行占位符**(应填 b5a3e46)、且**自身也未登记 §11**,造成两处索引空洞,由本版 v4.2 一并修复——教训:补录他人行与回填自身占位行是两件事,做前者时极易漏做后者,收尾自检必须同时核对「占位符计数=1」与「§11 前 N 行逐条对齐 git log --oneline -N」
1107f14 fix(ui): 删除首页 how-to 操作卡片(WASD/自动攻击/拾取宝石/Boss宝箱) + 重写 guide-screen 玩法说明弹窗(对齐v4.1实际数据:7 Boss全列/18把武器修正/血裔逐条描述/词缀怪合并进敌人条目/补充精英行为) | tag v4.1 之后 UI 修复,1文件 +10/-17 行,vite build 通过
b5a3e46 docs: v4.1 CHANGELOG + HANDOFF 同步(指向 5338c51) + §0r 小节(v4.1: 怪物/Boss 辨识度修复 + 程序化动画系统) + §11 回填 2ec5d52 文档提交哈希 + 补录漏登的 42ddf75(P7 Boss 重设计) + 头部"最后更新"更新到 2026-08-06 v4.1 | tag v4.1 指向此提交;此行此前为占位符,由 v4.2 回填(中间隔了 61108b7 一次维护提交未回填,见上)
42ddf75 feat(P7): 4 Boss 立绘重设计(baron/queen/overlord) + avatar 终局独立立绘 + 删除已失效降级管线(gen_assets.sh/gen_icons.sh) | 发版 tag 之后独立 feat 提交,此前未登记 §11(漏登),本次 v4.1 一并补录;4 Boss 形象彻底脱离旧模板撞图,avatar 不再复用 overlord
2ec5d52 docs: HANDOFF §11 索引补全 —— 回填 e30ba00(此前为占位符) + 补录漏登记的 194c4de(P6 怪物立绘,feat 提交当时未同步 §11) | 维护提交,不打版本 tag;起因:核对 §11 与 git log 发现两处索引空洞,一处是未回填占位符、一处是功能提交完全缺席,后者因无 tag 兜底一旦丢失只能靠 git log --grep 反查,故按 v3.14 制度化的「先回填再插新行」红线立即补齐,不拖到 v4.1
194c4de feat(P6): 12 怪物 AI 立绘去重(Boss3+精英3+小怪6) + 图鉴自动更新 | 12 个对象(herald/alchemist/warlord 三 Boss、elite_reaver/conduit/colossus 三精英、rat_swarm/spitter/bone_knight/plague_bearer/siren/revenant 六小怪)此前共用 9 张已有贴图造成图鉴大面积撞图,本版各给专属立绘;原 gen_assets.sh 文生图端点仍降级(实测返 176626B 占位图)故走降级路径:内置 ImageGen 出 1024² 原图 → 新增 gen_monster_pixels.py 后处理(复用 gen_passive_pixels.py 的众数色键控/去水印/描边,但主体填满画布而非 icon 式留白);prompt 策略经一轮试点否决后定稿为「亮主色+粗轮廓+高对比+2~3个大特征」——v1 暗紫黑方案被众数色键控吃掉深色区域,alpha 覆盖率仅 27% 且偏粉,v2 修正到 51.5%;12 张新 PNG 已加入 gen_assets.py 的 AI_OWNED 保护集防止被程序化生成器覆盖;图鉴零 UI 改动(renderCodexMonsters 走 iconURL(type.sprite) 数据驱动,改 data.js 指向即自动更新);四门质量门全绿(node --check / validate:skilltree / test:assets 108/108 / test:content PASS);16 文件 +138/-12 行
e30ba00 chore: 清理孤儿 PNG(boss_avatar/passive_rage/passive_swift) + 移除 gen_assets.py 对应生成函数(gen_passive_rage/gen_passive_swift/gen_boss_avatar) + HANDOFF §11 回填 v4.0 文档提交哈希 2b0e195 | 维护提交,不打版本 tag;关键点:仅 git rm 这三张 PNG 不够——gen_assets.py 每次运行会程序化重建 passive_rage/passive_swift(调用点在原 2685-2686 行),必须连生成函数+调用一并删除,gen_boss_avatar 则属从无调用的死代码;验证四道:py_compile 通过 → 重跑 gen_assets.py 确认三张不复活且其余资源逐字节不变 → test:assets 96/96 全绿 → 反向孤儿清单由 7 项降至 4 项(剩 bg_title/guide_menu/icon_skull/skilltree_menu,均 AI_OWNED 合法保留)
2b0e195 docs: v4.0 CHANGELOG + HANDOFF 同步(指向 67e510e) + §0q 小节(v4.0 大版本:P3b-3~5 精英内容/P4-1 悬赏/P4-2 Combo/P5-1 美术占位统一工具/P5-2 移动端真机门禁/P5-3 精灵缺失断言) + §11 回填 v3.14 文档提交哈希 ddc31fe(此前为占位符) + 头部"最后更新"更新到 2026-08-05 v4.0 | tag v4.0 指向此提交（自身哈希无法在提交内容中自引用）
ddc31fe docs: v3.14 CHANGELOG + HANDOFF 同步(指向 ca273ef) + 回填 v3.13 文档提交哈希 ae95024(此前为占位符) + §11 新增「占位行回填」维护红线(制度化"先回填再插新行",根治461a5a5那类哈希丢失) + 补 0p 小节 | tag v3.14 指向此提交（自身哈希无法在提交内容中自引用）
ca273ef v3.14 .gitignore 补 vite.config.js.timestamp-* 忽略规则 | vite 每跑一次 dev/build 就生成一个新的 vite.config.js.timestamp-<epoch>-<rand>.mjs 临时产物,长期停在 git status 的 ?? 列表里持续污染工作区视图,且易在批量 git add 时被误提交;本版仅追加忽略规则,不删除磁盘上已存在的该文件(属 vite 临时产物,交由工具自行管理);验证 git check-ignore -v 命中 .gitignore:9、禁提未跟踪文件由 8 个降为 7 个;v3.13 曾评估此项但因当时改 .gitignore 属代码提交 H_A、会让已写死的 7898588 失效并连带重做 H_B 而暂缓,本版无此约束故一并清掉;未改 src/ 任何产品代码
ae95024 docs: v3.13 CHANGELOG + HANDOFF 同步(指向 7898588) + 清除 CHANGELOG 第6行历史工具残留标记 `<arg_value:...>` + 修正 HANDOFF §0j/§11/§16 的 `__ASSET_HASHES__` define 名笔误(4cbfb61 回填哈希时全局替换误伤,HANDOFF 5 处 + CHANGELOG 1 处) | tag v3.13 指向此提交（自身哈希无法在提交内容中自引用）
7898588 v3.13 技能树重叠常驻回归用例：tests/skilltree_overlap.py(8档:桌面3档1280×800/1600×1000/1920×1080 + 真触屏移动端5分支全遍历390×844dsf3,has_touch+is_mobile) + package.json 加 test:skilltree(刻意不接prebuild/build,依赖dev server在5173) + .gitignore 补 __pycache__//*.pyc | 起因v3.12质量门两条非阻塞建议:ROW_H=178对实测最大卡高160px仅余18px,硬编码布局常量在节点文案变长时会静默复发,故把一次性人工探针沉淀为常驻用例;抗退化设计:行距不硬编码(从卡片top网格取相邻最小正差反推实测ROW_H,改常量自动跟上)+余量<8px给WARNING不失败+移动端.touch-device失真守卫(防v3.10/v3.11那种以为测移动端实测桌面布局的漏检);移动端必遍历5分支因ui.js:1054 branchIds=isMobile?[stBranch]:Object.keys()一次只渲当前分支;实跑EXIT 0八档全PASS(桌面39节点卡高157-160实测行距178余量18,移动端war9/bly8/nfr8/eco6/utl8卡高58行距116余量58,父子纵向相交0组+可见碰撞0组);mutation负向对照175px→WARNING仍PASS、185px→FAIL检出38组父子相交+26组可见碰撞并逐对定位(war_root→war_dmg 相交7px),证明非"永远绿的假测试";未改src/任何产品代码
ab8d08e docs: v3.12 CHANGELOG + HANDOFF 同步 (指向 1b83ca2) | tag v3.12 指向此提交（自身哈希无法在提交内容中自引用）
1b83ca2 v3.12 桌面技能树父子纵向重叠修复：renderSkillTree 桌面布局常量校正(CARD_H 104→160 / ROW_H 126→178,匹配卡片真实渲染高度) | 起因v3.11遗留桌面26组父子相邻行纵向相交;真因缩放自适应字号在fit缩放下撑到clamp上限致卡片实高157-160px,而布局常量CARD_H=104/ROW_H=126严重低估,父→子顶边间距(126)<卡片实高(157)每对纵向相交31-34px;移动端三值(58/116/24)及CARD_W/COL_W/BAND_GAP/TITLE_OFF未动,连线起点a.y+CARD_H与世界高度y+CARD_H同常量驱动自动对齐;桌面重叠探针(1600×1000)父子纵向相交0组+任意两卡可见碰撞0组PASS,高度实测[157,160]留18px余量,全缩放层级(0.2~2.2)无重叠,node --check OK
461a5a5 docs: v3.11 CHANGELOG + HANDOFF 同步 (指向 90629d2) | tag v3.11 指向此提交（自身哈希无法在提交内容中自引用）
90629d2 v3.11 移动端技能树同层重叠修复：renderSkillTree列分配重写(首前置父严格树消菱形坍缩 + 多前置汇聚节点取双亲中点 + 按深度层量化列号兜底,杜绝同层水平重叠) | 起因用户二次报"永夜庇护前置壁垒护盾不存在/无法解锁"→正确触屏模拟下发现nfr分支nfr_shield与nfr_statusamp完全重叠(133,368)被压住;实为渲染层菱形坍缩(真菱形nfr_keystone_endgame←[nfr_nightdr,nfr_statusamp]),全树共5对同层重叠(nfr1/bly2/eco2);数据层干净(39节点全可解锁);移动端重叠探针5分支全CLEAN+39/39运行时解锁+validate PASS+test_game全PASS零报错
f486df8 v3.10 技能树数据完整性校验护栏：scripts/validate_skilltree.mjs(校验 a必填字段/b唯一id/c-prereq存在性[核心]/d≤2前置/e无环+每分支恰一root+不跨分支+可达/f-gateReq合法) + package.json 加 validate:skilltree 与 prebuild 钩子(断链直接build失败) | 起因用户报"嗜血渴望前置不存在"→3重验证(导入/全仓grep/真实运行时buySkillNode拓扑解锁仿真)确认v3.9源码39节点prereq全有效全可解锁,所见系客户端缓存旧bundle;护栏防复发;反向验证篡改缺失id→exit1+build被拦
b82d99a v3.9 移动端技能树交互重构：顶部分段控件(5分支切页签) + 单分支竖向链(depth纵向/兄弟横向偏移,紧凑尺寸,消除fan-out) + 底部抽屉(.st-sheet含解锁按钮,XSS转义) + 最小缩放0.6 + 58px热区 + 底部浮层命中区修复(pointer-events透传) | 设计docs/plans/2026-07-31-skilltree-mobile-redesign.md + 移动端探针14项全PASS + test_game全PASS零报错(桌面零回归)
38f5eb9 v3.8 资源加载优化：内容哈希精准缓存(替代全局BUILD_ID,按文件内容sha256注入__ASSET_HASHES__,未改动的图命中缓存,更新后近乎秒开) + 分级懒加载(拆CRITICAL_KEYS/LAZY_KEYS(20张codex/altar/boss/portrait),进度条只等关键集,loadAssetsLazy后台幂等拉取,ensureLazy守卫三界面) | test_game全PASS零报错

4f7d6d0 v3.7 重置弹窗暗黑风(#st-respec-modal自定义玻璃拟态,替代原生confirm,取消/确认/遮罩/Esc) + 移动端长按复制屏蔽(#skilltree-content touch-callout:none+user-select:none + contextmenu preventDefault) + 技能树二叉化(每节点≤2子节点,11处prereq改链,零新增节点,validate_skilltree.mjs校验通过) + 前置审计(nfr_shield存在,链路完整) | test_game全PASS零报错+validate全PASS

446bbc6 v3.6 解锁保持面板视图(renderSkillTree加fit参数,仅打开时auto-fit,购买/洗点保持stTx/stTy/stScale) + 玩法说明按钮icon统一(guide_menu.png程序化像素卷轴+问号,menu-btn结构) + 玩法说明补充灵魂树条目 | v36探针T1-T10(含scale不变断言★)+test_game全PASS零回归
c31a079 v3.5 移动端技能树全屏画板(整页全屏+自由平移) + 双指捏合缩放(bindSkillTreePan重写Pointer多点手势,下限0.2) + 移动端购买通路修复(详情浮层内嵌.tt-buy解锁按钮) | 移动端探针全PASS(全屏/tap购买/捏合0.2->0.2828/零报错)+test_game全PASS零回归
3ff5dd2 v3.4 技能树UI深度打磨：图标模式(39节点sk_*.png像素风+移动端紧凑56px) + hover高亮上下游路径(lk-highlight BFS祖先/后代) + 缩放字号自适应(--st-zoom CSS变量calc) + 缩放百分比指示器 | v34探针T1-T9+test_game全PASS零回归
92d6e56 v3.3 技能树重构为树状图：每分支自上而下tidy-tree布局(按prereq深度分层) + 5分支左右并排可平移画布 + 拖拽平移/滚轮缩放(＋/－/适配) + world坐标贝塞尔连线(40边) | 树状探针T1-T8+test_game全PASS零回归
47b4d53 v3.2 技能树 UI 打磨：节点详情浮层(hover/点击单真源,含前置✓✗态) + prereq分支内SVG路径连线(lk-done/lk-next/lk-locked三态,流光仅lk-next) + 解锁动画just-unlocked450ms(reduced-motion降级) | 打磨探针T1-T5+test_game全PASS零回归
692ae11 v3.1 生存向平衡校准：nightBase 软化(1.12/1.22/1.32->1.08/1.16/1.24) + 刷怪地板0.18->0.22 + 血瓶2.5%->3.5% | 模拟器量化后期小怪HP×16.9->×14.5 test_game连跑2次全PASS
4223272 v3.0 技能树：元进度层(5分支39节点含洗点) + 独立入口图标(skilltree_menu.png) + 4引擎钩子(weaponMods/rollCrit扩参/吸血转盾/startRun并列注入) | 探针T1-T7+UI冒烟+test_game全PASS零报错零回归

dad7f2f v2.5b 镇魂钟鸣符文吸附修复：deployRange 外推 burstRadius+40(L1~L5 170/185/200/215/230,absolution 240)使辉光不罩脸 + 符文自转扫场(fireRune记spin/updateRunes每帧offAng+=spin*dt) | 探针验证12符文距230/净空+40/零报错 test_game全PASS

4a20a3ede271d19f7fc02b7a736bad029ee9df17 v2.5 镇魂钟鸣/镇魂赦令重做：圈内周期音波脉冲(替换单次踏入触发→每符文周期扩张音波环扫敌掉血) + v2.5a 范围跟进修复(符文跟随玩家/封闭内圈死区/扩大burstRadius/进入即触发ACTIVE_CAP=0.3s) + 补fireRune缺maxLife渲染NaN隐性bug + resolve.desc同步 | enforceCaps新增trim(runePulses,200)

2ca06f00c18e6e1d607ea8099e24076474cfba9e v2.3 升级卡合成提示置底整行(不溢出) + 圣水洗礼槽外固有(双生武装/圣徒不占槽、双源合并两级、仍可升级/进化吞噬) | innateWeapons双表 + getShapeSprite保性能

7a53a1cfbf8bd563e99fc6fe88c3e9d6fad43384 v2.4 修复子弹形状运行时未挂载(addWeapon实例补.visual→projShape不再拿undefined→根治棱形) + 镇魂钟鸣红钟扩到基础resolve武器(rn.awaken==='resolve'也画红圈血钟) | 探针验证star/shard/fang/bolt/orbiter剪影均挂载
fb0a75888537bb926d0d3feaf6f320f06b223219 v2.2 武器弹丸差异化(星/碎晶/獠牙/弩矢/能量球剪影) + 8神器觉醒弹幕/形态差异化(彗星/残影/血心/结界纹/眼瞳/锯齿红环) + 镇魂钟鸣红圈血钟(弃用光晕圈) | getShapeSprite离屏缓存保性能

4f3f6a5437f6d90983243de96cb59e71b0cc64c0 v2.1 八神器图标差异化重绘(星/剑/碎晶/城塞/眼/战锤/血心/钟剪影，弃用共用纹章盾底形)

cc6986d0e1dc2a832a8cb2ebb92452dfd36e2b20 v2.0 武器8→16/神器10→18(8新武器+8新神器被动配对合成+觉醒门控) + RL2性能硬上限enforceCaps + D4新武器发现加成 + 敌方眩晕/减伤

75312ca3dd0cb802703fc6d91941ed2c704f0666 v1.12 icon纠错(还原暗夜铠甲armor原版 + 重做钢铁意志guard亮银盾) + loot beacon通关/返回主界面隐藏 + 护盾自然回盾(SHIELD_REGEN_BASE=2)

ca3281d22e64949058c316af750a6e04be2e7fd2 v1.11 暗夜铠甲icon误改(亮底银盾，原误标钢铁意志，v1.12已更正) + 图鉴拆四分类(被动/神器/怪物/武器独立屏，index.html/ui.js/main.js/style.css + gen_passive_pixels.py auto_brighten)

b3b234ed1807993475d6a942416df87e25216b36 v1.10 升级卡合成路径提示 A+B（upgrade.js/style.css 进化就绪金徽章 + 精炼配方行，引擎同源零误导，尊重隐藏）

ba42a4ef4e97500266329153fcde0d95b50ee937 v1.9 三图标去水印+提亮 + 初始护盾满 + 选择按钮右置（gen_passive_pixels.py 去水印保障 + passive_critrate/regen/armor 重制 + entities.js 20/20 + upgrade.js/style.css 按钮三栏右置）
d59714ce6f6a3e2de9f6e8ada08555ac5951db28 v1.8 升级卡横排恢复 + 被动icon去水印居中（style.css/upgrade.js flex横排 + gen_passive_pixels.py 去水印三重保障 + 7张passive_*.png重制）
8ba95573442b34d9b667246e644af25a5ce23faf feat: 五大神器双硬指标重校 + 视觉区分 v1.7（crimson/matrix/reaper/devour/tempest 数值达标 + reaper 紫魂/devour 金白/matrix sigil/tempest 雷印紫电 + getGlowSprite 缓存辉光零 shadowBlur）
6643b93089668486922732bed2ea907b0e1a4fd7 fix: 升级卡被动icon与武器统一 + 移动端文字竖向修复 v1.6（upgrade.js 单img渲染 + .touch-device .upgrade-card 改纵向 + 清.uc-badge + #update-prompt 移动端防御）
96bdff68de86f32be0d518aec5a5144923e3b431 fix: 微信护盾条不可见修复 v1.5（#shield-bar 常驻 + ui.js 显隐门控移除 + null 守卫）
21cbb2e3dfc5e10cc848af28767157a833034403 feat: 被动 icon AI 像素化升级 v1.4（13 张 passive_*.png + gen_passive_pixels.py + 渲染切 img + AI_OWNED 扩容）
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
  - `#loading` + `#load-bar`：首屏加载幕（z100，`bg_title.png` 暗化背景），进度条由 `game.js` 的 `loadAssets(onProgress)` 钩子驱动（width + `#load-pct` + `aria-valuenow`），**只统计「关键集」加载进度**（约 80 张，标题+开局+升级卡片必需），加载完成 `hidden` 移除；图鉴/祭坛/血裔立绘等 20 张「懒加载集」由 `loadAssetsLazy()` 在标题出现后后台拉取（不驱动进度条）。资源 URL 自 v3.8 起按**文件内容 sha256 哈希**作 `?v=` 精准缓存击穿（替代原全局 `BUILD_ID`），未改动的图命中浏览器/CDN 缓存、更新后近乎秒开。
- **sessionStorage 记忆**：点「稍后」写 `sessionStorage['ns_update_dismiss']=latest`（针对该 latest 版本），命中则本次不再弹；新部署产生新 latest → 仍会提示。仅在同会话、同 latest 下抑制，**不污染 localStorage**。
- **刷新入口**：`data-action="reload"` → `location.reload(true)`。

### ⚠️ dev server 重启坑（必读）
`vite.config.js` 是 vite **启动时**读取的，运行中改动**不热加载**。改完必须杀旧 dev server（`lsof -ti tcp:5173 | xargs kill -9`）并重启 `npm run dev`，否则旧 dev server 不识别新 define（含 `__BUILD_ID__` 与 v3.8 新增的 `__ASSET_HASHES__`），运行时 `ReferenceError: __ASSET_HASHES__ is not defined` → e2e 崩溃。生产 `vite build` 不受影响（构建时必读 config）。

### 验证命令
- dev 跑 e2e：先重启 dev server 再 `python test_game.py`。
- 验证 version.json 生成：`npm run build` 后 `cat dist/version.json`、`grep '/version.json' dist/_headers`。
