# 平衡微调设计（v0.15 候选）

> 日期：2026-07-24 · 状态：设计已确认，待实现
> 目标：修复 4 处体验/平衡问题，不改前期手感、不动既有关卡机制。

## 1. 嗜血者起始武器去重
- **问题**：`bloodthirsty` 与 `wanderer` 起始武器同为 `blade`（`data.js:252/276`），仅差 1.5 吸血，辨识度低。
- **方案**：`bloodthirsty.weapon` 由 `blade` 改为 `whip`（噬魂长鞭）。保留 `apply` 中的 `lifesteal +1.5` + `damageMul +0.05` 作为血裔签名（吸血对长鞭照常生效）。
- **影响**：起手武器与流浪者错开；whip 当前无人作起始武器。

## 2. 黎明圣印投射物去重（修复真 bug）
- **根因**：`cross` 发射投射物 `kind:'blade'`（`weapons.js:307`），渲染块 `weapons.js:651` 对所有 `blade` 投射物画 `blade.png` 红刃 → 圣印被画成猩红飞刀。
- **方案**：
  - 发射处 `kind: 'cross'`（`weapons.js:307` 附近）。
  - 渲染块 `weapons.js:648-662` 新增 `cross` 分支：贴图 `sprite('weapon_cross')`（金色圣印，已有素材），金色 `shadowBlur` 辉光 + 缓慢自旋。
- **零新素材**，与红色飞刃一眼区分。

## 3. 血瓶掉率下调
- **问题**：`game.js:314` 每非 Boss 击杀 `Math.random() < 0.07`（7%）掉血瓶回 20，续航过强压低难度。
- **方案**：基础掉率 `0.07 → 0.025`（约每 40 杀一个）。Boss/精英掉率不动。
- **数值 `[PLACEHOLDER]`**：真机按死亡频率/续航手感再调。

## 4. 后期压低"再拿新武器"概率，偏置被动
- **问题**：武器进化成神器后，原武器以 `weapon-new`（权重 2）回池可再拾取，后期武器越滚越多、挤压被动成长。前期不动。
- **方案**（仅后期生效，前期零影响）：
  - `buildPool`（`upgrade.js:52`）引入 `late = clamp((t - NIGHT_START)/360, 0, 1)`（9min→15min 渐强，用 `game.time`）。
  - 权重随 `late` 偏移：
    - `weaponNew` 2 → `2*(1 - 0.85*late)` ≈ 0.3（后期基本不刷新武器）
    - `passiveUp` 3 → `3*(1 + 0.5*late)` ≈ 4.5
    - `passiveNew` 1 → `1*(1 + 1.0*late)` ≈ 2.0
    - `weaponUp` 5 不变（已拥有武器仍可升满，不卡成型）
  - `rollOptions` 的"保底 1 武器"保留；因 `weaponNew` 骤降，后期三选一自然偏被动。
  - `t < 540` 时 `late=0`，权重与现状完全一致 → 满足"前期不用调"。

## 验证计划
- `node --check` 改动的 JS；e2e `test_game.py` 全绿 + 控制台无错。
- 新增/补强断言：① 嗜血者起手武器为 `whip`；② cross 投射物 `kind==='cross'` 且渲染非 `blade` 贴图；③ 血瓶掉率常量 0.025；④ 后期 `buildPool` 在 `t>540` 时 `weaponNew` 权重显著低于早期。
- 推送后更新 `CHANGELOG.md` 追加 v0.15。
