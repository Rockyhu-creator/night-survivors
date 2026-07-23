# 灵魂货币 + 祭坛永久解锁 + 存档 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 补上长期循环——单局死亡转化为永久变强（结算发灵魂 → 祭坛花灵魂解锁永久增益 → localStorage 存档），解决移动端留存最大短板 G1。

**Architecture:** 在 `data.js` 新增灵魂持久化（沿用 `loadBest/saveBest` 模式）与祭坛解锁表；`game.js` 在 `gameOver` 按「存活/击杀/等级/Boss/首通难度」结算灵魂并发放，在 `startRun` 注入已解锁的永久增益；`ui.js` + `index.html` + `style.css` 新增祭坛界面与主界面灵魂显示；`main.js` 接按钮与 debug 钩子；`test_game.py` 加两条断言。

**Tech Stack:** ES Modules / Canvas2D / localStorage / Playwright(e2e)

**设计支柱对齐：** 越战越神（永久成长）、一局即一段百局不重样（祭坛 build 差异）、移动端再来一局（灵魂钩子）。

---

## 经济模型（Sources / Sinks，数值全部 `[PLACEHOLDER]` 待真机校准）

Sources（单局结算）：
- 存活：`floor(time/30)` 每 30 秒 +1
- 击杀：`floor(kills/20)` 每 20 击杀 +1
- 等级：`player.level` 每级 +1
- Boss：`bossKills * 25`
- 首通难度（一次性）：easy 50 / normal 100 / hard 200（存 `cleared[]` 防重复发）

Sinks（祭坛解锁，永久）：
| id | 名称 | 花费 | 效果 |
|----|------|------|------|
| soul_hp | 永恒之躯 | 60 | maxHp +30 |
| soul_spd | 疾风之拥 | 90 | speedMul +6% |
| soul_dmg | 嗜血诅咒 | 130 | damageMul +5% |
| soul_gain | 亡魂低语 | 160 | 灵魂获取 +25%（soulGainMul） |
| soul_dual | 双生武装 | 220 | 开局额外获得「圣水洗礼」 |

防通胀：单局上限约 ~150（含首通），移动端短局可达；`灵魂/活跃玩家/天` 超阈值再平衡 pass（本次仅留 metric 说明，不实现埋点）。

---

## Task 1: 灵魂持久化 + 祭坛配置（data.js）

**Files:** Modify `src/data.js`

**Step 1:** 加 `SOUL_KEY` 常量与 `SOUL_REWARDS` / `ALTAR` 配置（见上表）。
**Step 2:** 加函数 `loadSouls / saveSouls / addSouls / spendSouls / isUnlocked / buyUnlock`，结构 `{ balance, spent, unlocks:[], cleared:[] }`，try/catch 包裹 localStorage。
**Step 3:** 在 `game.js` 调用前确认导出可用（import 侧在 Task 2）。

Commit: `feat(data): 灵魂货币持久化与祭坛解锁配置`

## Task 2: 结算发放 + 开局注入（game.js）

**Files:** Modify `src/game.js:14-32`(构造) `src/game.js:161-182`(startRun) `src/game.js:297-302`(onBossKilled) `src/game.js:330-334`(gameOver)

**Step 1:** 构造加 `this.bossKills=0; this.soulGainMul=1;`。
**Step 2:** `onBossKilled` 内 `this.bossKills += 1;`。
**Step 3:** `startRun` 在 `weapons.addWeapon('blade')` 后循环 `for (const a of ALTAR) if (isUnlocked(a.id)) a.apply(this);` 并 `this.player.hp = this.player.maxHp;`。
**Step 4:** 加 `computeSoulReward()` 按 Sources 计算（乘 `this.soulGainMul`，首通写 `cleared`）。
**Step 5:** `gameOver` 内 `const reward=this.computeSoulReward(); addSouls(reward); this.runSouls=reward; this.totalSouls=loadSouls().balance;` 再 `ui.showGameOver()`。

Commit: `feat(game): 结算发灵魂 + 祭坛增益开局注入`

## Task 3: 祭坛 UI + 主界面灵魂显示（ui.js / index.html / style.css）

**Files:** Modify `src/ui.js` `index.html` `src/style.css`
**Step 1:** `index.html` 标题页加 `#soul-balance` 与 `#btn-altar`；新增 `#altar-screen`（`#altar-balance` `#altar-content` `#btn-altar-back`）。
**Step 2:** `ui.js` 构造缓存新 DOM；`showTitle` 更新 `#soul-balance`；`showGameOver` 在 final-stats 追加灵魂行（本局获得 / 累计）。
**Step 3:** `ui.js` 加 `showAltar()`（按 ALTAR 渲染卡片：名称/花费/状态/购买按钮，余额不足或已拥有禁用）与 `hideAltar()`；购买走 `buyUnlock` 后重渲染。
**Step 4:** `style.css` 祭坛界面哥特样式 + 灵魂显示。

Commit: `feat(ui): 祭坛解锁界面与主界面灵魂显示`

## Task 4: 按钮接线 + debug 钩子（main.js）

**Files:** Modify `src/main.js`
**Step 1:** import 灵魂函数；`#btn-altar` → `game.ui.showAltar()`；`#btn-altar-back` → `game.ui.hideAltar()`。
**Step 2:** debug 模式暴露 `window.__souls = { loadSouls, saveSouls, addSouls, buyUnlock, isUnlocked }`。

Commit: `feat(main): 祭坛按钮接线 + 灵魂调试钩子`

## Task 5: e2e 断言（test_game.py）

**Files:** Modify `test_game.py`
**Step 1:** 重置灵魂后强制 gameOver，断言 `runSouls>0` 且 `loadSouls().balance===runSouls`。
**Step 2:** `addSouls(1000)` + `buyUnlock('soul_hp')`，断言已解锁且余额 `=940`；`startRun()` 后断言 `maxHp>=130`。
**Step 3:** 跑 `test_game.py`，确认全绿、零控制台错误。

Commit: `test: 灵魂结算与祭坛解锁断言`

## Task 6: 提交并推送

`git add` 全部改动，`commit`，经 GitHub 连接器 `git push origin main`。

---

## 风险
- 数值 `[PLACEHOLDER]`：首周可能通胀或偏紧，留 metric 说明，真机后调。
- 祭坛增益在 `startRun` 注入，测试用 `startRun()` 直接验证 maxHp，不依赖完整对局。
- 不改变现有单局平衡/难度，仅叠加长期层。
