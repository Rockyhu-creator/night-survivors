# 武器丰富化 + 合成深化 设计 / 实现计划 (2026-07-23)

> 状态：已实现并验证（e2e 58/58 全绿，零控制台错误）。
> 依据：通读 `data.js / weapons.js / upgrade.js / evolution.js / ui.js / assets.js / gen_assets.py`。
> 对标：吸血鬼幸存者（Vampire Survivors）的武器形态多样性 + 武器+被动→神器合成。

## 目标
- 现有 4 武器（追踪/地面/往返/连锁）形态单一；本计划新增 **3 把机制完全不同的武器** + 各自 **1 个进化神器**，build 多样性翻倍。
- 沿用现有 `RECIPES`（武器满级 + 持特定被动 → 神器，Boss 宝箱触发）模型，零额外进化逻辑改动。

## 一、三把新武器（形态与现有正交）

| 武器 | id | 形态 | 对标 VS | 等级骨架 `[PLACEHOLDER]` |
|------|----|------|---------|--------------------------|
| 亡灵光环 | `aura` | 贴身脉冲光环：敌踏入环内持续 tick 伤害（与圣水"远处领域"互补，是贴身保镖） | Garlic | dmg 6→24 / 半径 70→130 / tick 0.6→0.5s |
| 噬魂长鞭 | `whip` | 朝最近敌人方向挥出长条 hitbox，一线清空（与斧"径向往返"、飞刃"追踪"不重叠） | Whip | dmg 12→36 / 长度 180→320 / 宽 44→70 / CD 1.6→1.0s |
| 黎明圣印 | `cross` | 多向放射：LV1 四向、LV5 八向（与闪电"锁定+连锁"不重叠） | Cross | dmg 16→42 / 方向 4→8 / 穿透 1→3 / CD 2.2→1.4s |

实现要点：
- `aura` 走武器计时器（cooldown 即 tick 间隔），`fire()` 对环内敌人直接 tick 伤害；`render()` 画脉动环。
- `whip` 用 `pickTarget(0)` 取最近敌人方向，`applyWhip()` 做线段 hitbox 采样；`render()` 画 fading 横扫弧。
- `cross` 朝 N 个方向发射 `kind:'blade'` 投射物（复用现有渲染）。

## 二、三个新进化配方（合成深化）

| 武器(满级) | + 被动 | → 神器 | 神器效果（在 `updateArtifact` 内实现） |
|------------|--------|--------|----------------------------------------|
| 亡灵光环 | 巨人之心 | **寂灭结界** `sepulcher` | 更大光环(150)持续伤害 + 每1.2s 向4向迸射骨刺 |
| 噬魂长鞭 | 疾行之靴 | **永劫之鞭** `eternalwhip` | 每1.0s 三向(-20°/0/+20°)齐扫、更宽 |
| 黎明圣印 | 秘法魔典 | **圣光矩阵** `matrix` | 每1.2s 常驻八向放射、穿透3 |

→ 武器 4→7，神器 6→9，图鉴总数 19→**25**。

## 三、代码改动清单
1. `data.js`：WEAPONS +3、ARTIFACTS +3、RECIPES +3（升级池 `buildPool` 自动遍历 WEAPONS，新武器零接线）
2. `src/weapons.js`：
   - 构造/`reset` 增 `this.slashes = []`
   - `fire()` 增 `aura`/`whip`/`cross` 分支 + 新增方法 `applyWhip()`
   - `update()` 增 `slashes` 生命周期衰减
   - `updateArtifact()` 增 `sepulcher`/`eternalwhip`/`matrix`
   - `render()` 增 光环环 / 长鞭弧 / 寂灭结界环（cross/matrix 复用 blade 投射物渲染）
3. `src/gen_assets.py`：新增 6 个程序化图标（3 武器 + 3 神器），`main()` 调用
4. `src/assets.js`：注册 6 个 sprite key
5. `src/upgrade.js`：`describe()` 增 `radius`/`length`/`width` 显示
6. `test_game.py`：图鉴断言 19→25；新增「新武器可装备+开火」「新配方进化出神器」断言

## 四、风险 / 注意
- 光环是贴身 AoE，易过强/过弱 → 数值 `[PLACEHOLDER]`，真机校准。
- 无武器槽上限（S3 未做）→ 后期全收集、build 决策退化，建议后续接 S3。
- `bg_title.png` 重跑会因随机雾效抖动，提交前 `git checkout --` 恢复保持聚焦。

## Changelog
- v0.1 (2026-07-23) — 用户确认方案：3 新武器 + 各 1 进化神器。
- v1.0 (2026-07-23) — 全部实现：data/weapons/gen_assets/assets/upgrade/test 改动落地；
  6 个程序化图标生成；e2e 由 55→58 项（新增「新武器可装备+开火命中」「3 条新配方进化出神器」断言），
  58/58 全绿、控制台零错误。
  注：`test_game.py` 原手写 dummy 缺 `speed` 字段在 `EnemyManager.update` 中变 NaN 导致「开火命中」断言失败，
  已改为用游戏自身 `createEnemy` 生成完整靶子并 `speed=0` 静止贴脸。
