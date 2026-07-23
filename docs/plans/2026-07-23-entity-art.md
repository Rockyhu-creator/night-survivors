# 实体美术优化计划（角色 / 敌人 / 道具显示）

> 日期：2026-07-23 · 角色：Technical Artist（技术美术）
> 目标：在**不重写渲染管线**的前提下，让游戏内的「角色、敌人、道具」显示更有辨识度、更有生命感，且「游戏内角色」与「角色选择立绘」保持一致。
> 约束：Canvas 2D + 程序化像素美术（`gen_assets.py`）。性能红线——动画只走 in-code 变换（scale/translate/rotate），不新增 `shadowBlur`、不新增每帧贴图裁切；新精灵严格复用现有 `fill_ellipse_shaded / outline / px / rect` 管线，避免风格漂移。

---

## 设计支柱（Design Pillars）
1. **辨识度优先** —— Boss 必须与杂兵一眼区分；宝箱必须是「箱子」不是「大宝石」。
2. **生命感** —— 怪物与玩家要有微动作，不能是贴纸。
3. **同源一致** —— 选人界面的立绘，进游戏后得是「同一个人」。
4. **零风险回归** —— 所有改动可 e2e 断言；不碰 y 排序 / 翻转逻辑 / 战斗数值。

---

## A1 · Boss 专属精灵（辨识度最大杠杆）
**现状坑**：`data.js` 中 `baron / queen / overlord` 三个 Boss 的 `sprite` 全为 `'elite'`，仅靠 `spriteSize` 128/140/156 放大 → 与精英杂兵长得一模一样。

**方案**：
- `gen_assets.py` 在现有精英怪骨架（`gen_elite`）上派生 3 个专用生成器：
  - `gen_boss_baron()`：血色男爵——暗红披风 + 金冠犄角（复用精英装甲/翅脉笔法）。
  - `gen_boss_queen()`：苍白女王——冷白骸骨质感 + 尖后冠 + 幽蓝眼芒。
  - `gen_boss_overlord()`：永夜君王——最深紫黑 + 巨翼 + 王座肩甲 + 红紫双芒。
  - 三者尺寸统一 `S=128`（与现有 elite 96 区分，更压迫），配色/王冠/肩翼做轮廓区分。
- `assets.js` 注册 `boss_baron / boss_queen / boss_overlord` 三键。
- `data.js` 将三 Boss 的 `sprite` 由 `'elite'` 改为对应键。
- 渲染：`entities.js` 已按 `e.type.sprite` 取图 + 按 `spriteSize` 缩放，无需改渲染逻辑，Boss 自动变大变专属。

**调参 [PLACEHOLDER]**：Boss 精灵尺寸/主色在真机比对精英怪可读性后再微调。

---

## A2 · 宝箱专属精灵（道具显示可信度）
**现状坑**：`systems.js` 的 `dropChest / dropBossChest` 把 `def.key` 设为 `'gemLarge'` 且 `chest:true` → 渲染时画一颗发光大宝石，不是箱子。

**方案**：
- `gen_assets.py` 新增 `gen_chest()`：木质箱体（左亮右暗体积光）+ 金边 + 顶面微光 + 锁扣，尺寸 `S=40`（2× → 80），boss 箱可复用同图、靠渲染放大。
- `assets.js` 注册 `chest` 键。
- `systems.js`：`dropChest / dropBossChest` 的 `def` 改为 `{ key: 'chest', min:0, size: 36, color:'#d4af37' }`（boss 箱 `size:48`）；`render` 中 `chest` 分支已画金色光晕，无需改。
- 掉落拾取逻辑（`onChestOpened`）完全不动。

---

## A3 · 敌人 / 玩家微动画（生命感，零新素材）
**方案**（纯 `entities.js` render/update 改造，复用单帧精灵做 in-code 变换）：
- **史莱姆**：挤压回弹——按 `wobble` 做 `scaleY` 压扁 + `scaleX` 微胀，活体果冻感。
- **骷髅**：左右轻摆——`rotate(±2°)` 随 `wobble` 正弦。
- **精英 / Boss**：披风飘动——`scaleX` 随 `wobble` 微呼吸（复用现有 `wobble` 字段）。
- **蝙蝠**：现有垂直 `wobbleY` 保留，增强为扑动（翼展感，靠 `scaleX` 微脉）。
- **玩家**：呼吸缩放——静止时 `scaleY` 随 `time` 正弦 ±1.5%，走动时维持现有 bob。
- **规则**：所有变换在 `ctx.save/restore` 内、且**在 existing 翻转/阴影之后、drawImage 之前**应用；不动 `y` 排序与 `if (player.x < e.x) scale(-1,1)` 翻转逻辑。

**调参 [PLACEHOLDER]**：摆动幅度/频率真机试手感。

---

## A4 · 玩家角色一致性（游戏内 ⇄ 立绘同源）
**现状坑**：游戏内 `player` 是单一 46×46 兜帽斗篷精灵；角色选择立绘是 6 张 40×60 全身像（`gen_portrait` + 6 个 `_feat_*`）。两者**不同生成器、不同风格**，且游戏内角色不随所选血裔变化 → 选了「圣徒」进游戏还是兜帽流浪者。

**方案（同源 spec，从根上保证一致）**：
- `gen_assets.py` 顶部定义 `CHAR_SPECS`（每血裔一套 `{cloth:(d,m,l), skin:(d,m,l), accent, feature}`），与现有 6 个 `_feat_*` 回调一一对应。
- 重构 `gen_portrait(name, spec)` 直接吃 `spec`（与现有 6 个 wrapper 等价，行为不变，仅参数化）。
- 现有 `gen_player()` 升级为 `gen_player(name, spec)`：沿用原兜帽斗篷构图，但 **cloth 配色 + feature 取 spec**（兜帽色随血裔、圣徒加光环、狂战加疤/毛肩、雷巫加电纹、嗜血者加血披风+獠牙、使徒加虚空无面），尺寸 `S=52`（略放大增强存在感）。生成 6 张 `player_wanderer … player_apostle`。
- `assets.js` 注册 6 个 `player_*` 键（保留 `player` 作 fallback）。
- `data.js`：`BLOODLINES` 每项加 `sprite: 'player_<id>'`（永夜使徒 hidden 同样）。
- `entities.js`：`Player.reset` 按 `this.game.bloodline`（或 `getSelectedBloodline()`）选 `player_<id>` 精灵；`render` 用该键。
- 立绘本身轻量优化：复用 spec 后确保与游戏内同一配色/特征（已在 spec 层统一，无需额外改绘制）。

---

## 资产生成策略（避免随机素材漂移）
现有 `gen_assets.py` 的 `main` 块（含 `gen_ground/gen_bg` 等随机噪点）每次全跑会改写 `ground.png`/`bg_title.png` 字节。
- 将 main 块包进 `if __name__ == '__main__':`，使本模块可被 import 而不触发全量生成。
- 新增一个 `gen_assets_patch.py`，仅 `from gen_assets import *` 后调用**本次新增/修改**的生成器（boss×3、chest、player×6、portrait 若改），精准生成、不污染随机素材。
- 提交前确认 `git status` 仅含预期 PNG。

---

## 验证（e2e，扩展 test_game.py）
1. 3 个 Boss 精灵键存在且互不相同（`window.__assets` 取图比对宽高/字节）。
2. `chest` 键存在；模拟击杀精英掉落 → 场景 DOM/调试钩子确认宝箱用 `chest` 精灵。
3. 6 个 `player_*` 键存在；切换不同血裔 `startRun` 后玩家精灵键随血裔变化。
4. 动画运行 30s 无报错、无 NaN（敌人坐标/缩放正常）。
5. 全量 e2e 零失败、零控制台错误；dev server 实机目检 Boss/宝箱/动画/角色切换。

## 提交与部署
- 按 A1→A2→A3→A4 分阶段 commit（单行 message）。
- 末步经 GitHub 连接器 `git push origin main`，Cloudflare 自动部署。
- 全程数值/幅度标 `[PLACEHOLDER]` 待真机校准。

## 实现记录（v0.2，2026-07-23 完成）

> 计划初稿与最终实现存在若干偏差，此处以**实际落地**为准：

### 实际做法（对照计划偏差）
- **A1 Boss 尺寸**：计划写 `S=128`，实际原生 `S=64`（与 elite 96 区分且更利落），绘制时由 `spriteSize` 128/140/156 放大 → 2×~2.4× 清晰像素。轮廓区分靠：男爵=双角金冠+高领红袍 / 女王=尖顶冠+拖地白裙 / 君王=宽王冕+巨肩翼+暗紫。生成器 `_boss_base()` 复用 `fill_ellipse_shaded`。
- **A2 宝箱尺寸**：实际 `S=44`（非计划 40），木质箱+金包边+锁扣金光，下落绘制 40/48 由 `chest` 标记决定。
- **A4 切换方式**：计划写「`BLOODLINES[id].sprite` 字段」，实际改为 **render 时按 `this.game.bloodline` 拼键** `player_<id>`（`game.js:80` 注入 `this.player.game = this`，并保留 `|| sprite('player')` 兜底）。`gen_player(name, spec)` 参数化 `S=46`（沿用原兜帽构图，cloth+feature 取 spec），`CHAR_SPECS` 与 6 立绘 `_feat_*` 同源。
- **A3 微动画**：史莱姆挤压 `scaleY`+`scaleX` 反比、骷髅 `rotate ±0.06`、精英/Boss `scaleY` 呼吸、蝙蝠 `scaleX/Y` 扑动（在 `e.wobble` 相位上）、玩家呼吸 `scale ±0.025`（用 `walkTime` 非 `time`）。全部在 `save/restore` + 翻转之后、`drawImage` 之前，未动 y 排序/翻转。

### 验证结果
- e2e **61 PASS / 0 FAIL，控制台错误：无**（含 A1 3 Boss 键+Boss 实例用 `boss_baron`、A2 宝箱键接线、A4 6 玩家血裔键、BOSSES 数据接线）。
- 顺带修复：`Player` 渲染原缺 `this.game` 注入 → 加 `this.player.game = this`，否则 `this.game.bloodline` 在 rAF 中每帧抛 `undefined`（23+ 次控制台错误，游戏仍跑但玩家不可见）。

## Changelog
- v0.1 (2026-07-23)：初版计划，覆盖 A1–A4 与设计支柱。
- v0.2 (2026-07-23)：实现完成；修正 Boss/宝箱/玩家尺寸与 A4 切换方式偏差，记录 e2e 结果。
