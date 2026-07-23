# S2 血裔系统（开局角色差异）— 实施计划

> 依据：DESIGN_PLAN.md §S2 + 已通读 `data.js/game.js/entities.js/weapons.js/ui.js/index.html/main.js/style.css`
> 目标：开局即差异化，解决 G2（单一玩家导致每局完全一致），让 build 从第一秒分叉。

## 设计决策
- **6 个血裔**（对齐 DESIGN_PLAN S2 表）：
  | id | 名 | 起始武器 | 偏向 | 解锁灵魂 |
  |----|----|---------|------|---------|
  | wanderer | 流浪者 | blade | 均衡 +5%伤/+5血 | 0 |
  | saint | 圣徒 | holywater | 范围/持续 +20% | 80 |
  | berserker | 狂战 | axe | 攻速+12%/移速+6% | 120 |
  | thunder | 雷巫 | lightning | 冷却缩减 +20% | 160 |
  | bloodthirsty | 嗜血者 | blade | 命中回血1.5/伤害+5% | 200 |
  | apostle | 永夜使徒(隐藏) | 无 | 伤+30%/移速+25%/CD-25%/生命-20 | 260 |
- **属性挂钩**：复用现有 Player 字段 + 新增 3 个：
  - `cooldownMul` ← 武器 `timer += cooldown * cooldownMul`（攻速/冷却缩减）
  - `areaMul` ← 圣水 `radius/duration * areaMul`（范围/持续）
  - `lifesteal` ← 投射物命中回血（吸血）
- **解锁/选择持久化**：并入灵魂存档对象 `souls.bloodlines[]` + `souls.selectedBloodline`，复用 `buyUnlock` 范式。
- **隐藏血裔**：`hidden:true` 的永夜使徒仅在已解锁后出现在选择界面（发现感）。
- **UI**：复用祭坛 `.altar-*` 样式，新增血裔界面 + 标题「血裔：X」标签按钮。
- 所有数值标 `[PLACEHOLDER]`，真机试玩后调。

## 经济/平衡假设（待校验）
- 解锁成本 80~260 灵魂；normal 首通 100 + 单局 ~150，约 1~3 局解锁廉价血裔。
- 永夜使徒 0 武器起手为高风险高回报，生命 80、需靠升级抢武器。
- 防通胀阈值沿用 S1 定义（灵魂/活跃玩家/天）。

## 文件改动
- `data.js`：BLOODLINES 表 + 解锁/选择持久化函数
- `entities.js`：Player.reset 加 cooldownMul/areaMul/lifesteal
- `weapons.js`：冷却×cooldownMul、圣水范围/持续×areaMul、命中回血 lifesteal
- `game.js`：startRun 注入选定血裔、setBloodline()
- `index.html`：血裔界面 + 标题按钮 + 标签
- `ui.js`：show/hide/renderBloodline，复用 altar 样式
- `main.js`：接线 + debug 钩子
- `style.css`：.altar-card.selected 选中态
- `test_game.py`：血裔断言

## 验证
- e2e：默认血裔起手 blade；各血裔属性注入正确；永夜使徒无武器+生命-20；解锁/选择持久化；零控制台错误。
