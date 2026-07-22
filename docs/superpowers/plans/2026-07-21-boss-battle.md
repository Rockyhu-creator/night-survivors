# Boss 战系统 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development。Steps use checkbox (`- [ ]`).

**Goal:** 周期性多阶段 Boss 战：3/6/9 分钟各刷一只具名 Boss，带阶段技能（召唤小怪/突进/弹幕），击杀必掉宝箱且优先给神器进化，全部进化完给经验+回血补偿。

**Architecture:** 复用现有精英怪/宝箱/进化系统。数据层新增 BOSS 定义；实体层新增 Boss 类（继承敌人基础 + 阶段技能状态机）；UI 层新增 Boss 血条与登场警告；掉落层 Boss 必掉"强化宝箱"。

**Tech Stack:** 同现有（Vite + 原生 JS + Canvas 2D + localStorage + Playwright）。

**关键文件：**
- `src/data.js` — 新增 `BOSSES`（3 只 Boss 定义）
- `src/entities.js` — EnemyManager 支持 Boss 生成/阶段技能/专属掉落
- `src/game.js` — Boss 登场警告、击杀后强化宝箱逻辑
- `src/systems.js` — 新增强化宝箱（BossChest）类型，优先给进化
- `src/ui.js` + `index.html` + `src/style.css` — Boss 血条、登场警告横幅

---

## Boss 设计（已定）

| 时间 | Boss | 血量 | 阶段技能 |
|---|---|---|---|
| 3:00 | 血色男爵 | 1800 | 70%血召唤 4 蝙蝠；40%血扇形弹幕 |
| 6:00 | 苍白女王 | 4500 | 60%血突进冲撞；30%血召唤 3 骷髅+弹幕 |
| 9:00 | 永夜君王 | 9000 | 75%血召唤 5 蝙蝠；50%血突进+弹幕；25%血狂暴加速 |

通用规则：Boss 移速低于精英但血厚；受击闪白+轻微击退抗性；死亡必掉强化宝箱（bossChest）；登场时全屏警告横幅+音效震动；血条显示在屏幕顶部。

强化宝箱开启逻辑（在现有 onChestOpened 基础上扩展参数 `fromBoss`）：
1. 有可进化配方 → 进化（同普通宝箱）
2. 无进化但来自 Boss → 补偿：+40 经验 + 回满血，toast "Boss 宝箱: +40 经验,生命回满"
3. 无进化且非 Boss → +25 经验（现有逻辑）

---

### Task 1: 数据层 + Boss 定义

**Files:** Modify `src/data.js`

- [ ] **Step 1: data.js 末尾追加 BOSSES**

```javascript
// ---------- Boss ----------
export const BOSSES = [
  {
    id: 'baron', name: '血色男爵', sprite: 'elite', unlockAt: 180,
    hp: 1800, speed: 38, damage: 40, exp: 120,
    radius: 34, spriteSize: 128, knockResist: 0.98,
    skills: [
      { at: 0.7, type: 'summon', enemyType: 'bat', count: 4 },
      { at: 0.4, type: 'barrage', count: 8, speed: 130, damage: 15 },
    ],
  },
  {
    id: 'queen', name: '苍白女王', sprite: 'elite', unlockAt: 360,
    hp: 4500, speed: 42, damage: 55, exp: 300,
    radius: 36, spriteSize: 140, knockResist: 0.98,
    skills: [
      { at: 0.6, type: 'dash', speedMul: 4.2, duration: 0.5, damage: 20 },
      { at: 0.3, type: 'summon_barrage', enemyType: 'skeleton', count: 3, barrageCount: 10, speed: 140, damage: 18 },
    ],
  },
  {
    id: 'overlord', name: '永夜君王', sprite: 'elite', unlockAt: 540,
    hp: 9000, speed: 46, damage: 70, exp: 600,
    radius: 40, spriteSize: 156, knockResist: 0.99,
    skills: [
      { at: 0.75, type: 'summon', enemyType: 'bat', count: 5 },
      { at: 0.5, type: 'dash_barrage', speedMul: 4.5, duration: 0.5, barrageCount: 12, speed: 150, damage: 22 },
      { at: 0.25, type: 'enrage', speedMul: 1.6 },
    ],
  },
];
```

- [ ] **Step 2: 验证** `node --input-type=module -e "import('./src/data.js').then(m=>console.log(m.BOSSES.length))"` → 输出 `3`
- [ ] **Step 3: Commit** `feat(data): 3 只 Boss 定义与阶段技能表`

---

### Task 2: Boss 生成与阶段技能状态机

**Files:** Modify `src/entities.js`

**实现要点（子代理需先 Read 现有 EnemyManager 再改）：**

1. EnemyManager constructor 增加 `this.bossSpawned = new Set()` 与 `this.activeBoss = null`；reset() 时清空。
2. update(dt) 开头，遍历 BOSSES：若 `game.time >= boss.unlockAt && !this.bossSpawned.has(boss.id)`，则生成 Boss：调 `this.spawnBoss(boss)`，加入 `this.bossSpawned`，设 `this.activeBoss`，调 `game.onBossSpawn(boss)`。
3. 新方法 `spawnBoss(def)`：在玩家视野外随机角度生成一个敌人对象，除普通字段外额外带：`isBoss: true, bossDef: def, skillIndex: 0, dashing: 0, dashVx: 0, dashVy: 0, enraged: false`。push 进 this.enemies。
4. Boss 每帧逻辑（在敌人更新循环里，若 `e.isBoss` 走分支）：
   - 基础朝玩家移动（除非 dashing>0，则用 dashVx/dashVy 位移且 dashing-=dt）
   - 阶段技能：若 `e.skillIndex < def.skills.length && e.hp/e.maxHp <= def.skills[e.skillIndex].at`，触发 `this.triggerBossSkill(e, def.skills[e.skillIndex])` 并 `e.skillIndex++`
   - `triggerBossSkill(e, skill)` 按 skill.type 实现：summon（在 Boss 周围召唤 skill.count 只 skill.enemyType 普通怪）、barrage（向玩家方向扇形发 skill.count 个敌方弹幕，存入 `game.enemyProjectiles`）、dash（朝玩家方向设 dashVx/dashVy = 归一化*e.speed*skill.speedMul，dashing=skill.duration）、summon_barrage/dash_barrage（组合）、enrage（e.speed *= skill.speedMul, e.enraged=true）
5. 敌方弹幕系统：EnemyManager 新增 `this.enemyProjectiles = []`（reset 清空）。barrage 弹幕结构 `{x,y,vx,vy,damage,life:4,radius:5}`。每帧 update：位移、life 衰减、与玩家碰撞（`dist < radius + player.radius` 则 `player.takeDamage(damage)` + `game.onPlayerHit()` + 移除）、超界移除。render：红色小圆点带光晕。
6. Boss 死亡：在现有死亡清理分支，`if (e.isBoss)` 则 `this.activeBoss = null` 并调 `game.onBossKilled(e)`（不再走普通 elite 宝箱，Boss 用专属强化宝箱）。
7. render：Boss 血条由 UI 负责（DOM），画布内 Boss 正常渲染（spriteSize 大、受击闪白、enraged 时整体泛红——可在 render 里若 e.enraged 给 ctx 加红色叠加）。

**验证：** Playwright 注入 `game.time = 181`，等待 Boss 生成，断言 `enemies.some(e=>e.isBoss)` 为 true、`game.activeBoss` 非空；把 Boss 血打到 65%（`e.hp = e.maxHp*0.65`），断言召唤出蝙蝠（enemies 中有非 Boss 的 bat）；打到 35%，断言 enemyProjectiles.length > 0。控制台无错误。

**Commit:** `feat(boss): Boss 生成 + 阶段技能状态机 + 敌方弹幕`

---

### Task 3: 登场警告 + Boss 血条 UI

**Files:** Modify `index.html`、`src/ui.js`、`src/style.css`、`src/game.js`

1. index.html：HUD 内 `#hud-top` 之后加：
```html
      <div id="boss-bar-wrap" class="hidden"><div id="boss-name"></div><div id="boss-bar"><div id="boss-bar-fill"></div></div></div>
```
   登场警告 DOM（与 evolution-banner 同级）：
```html
    <div id="boss-warning" class="hidden"><p class="warn-icon">☠</p><p id="warn-name"></p><p class="warn-sub">降临</p></div>
```
2. game.js：新增 `onBossSpawn(boss)`：`this.ui.showBossWarning(boss.name)`、`this.camera.addShake(0.8)`；`onBossKilled(e)`：`this.ui.hideBossBar()`、`this.pickups.dropBossChest(e.x, e.y)`、`this.fx.spawnSparks(e.x, e.y, '#d4af37', 40)`、`this.camera.addShake(1)`。
3. ui.js：新增 `showBossWarning(name)`（显示横幅 2s 后隐藏并 showBossBar）、`showBossBar(name)`、`updateBossBar(boss)`（game.step 里若有 activeBoss 则每帧调用更新宽度）、`hideBossBar()`。
4. style.css：Boss 血条（顶部居中、血色渐变、名字发光）、登场警告（中央大骷髅+名字+闪烁动画，类似 evolution-banner 但红色系）。

**验证：** 注入 time=181，截图警告横幅；等待出现 #boss-bar-wrap 且 #boss-name 为"血色男爵"；打血后 #boss-bar-fill 宽度变化。

**Commit:** `feat(boss-ui): Boss 登场警告 + 顶部血条`

---

### Task 4: 强化宝箱 + 掉落

**Files:** Modify `src/systems.js`、`src/game.js`

1. systems.js PickupSystem 新增 `dropBossChest(x, y)`：chest 标记 + `boss: true`，渲染尺寸 48*pulse、shadowBlur 24、金色，底座光晕更大。
2. update 拾取判定：宝箱统一走 `this.game.onChestOpened(g)`，把 `g.boss` 传给 game。
3. game.js 的 `onChestOpened(chest)` 改为：
```javascript
  onChestOpened(chest = {}) {
    const recipe = findEvolvableRecipe(this.player, this.weapons);
    if (recipe) {
      const artifact = performEvolution(this.player, this.weapons, recipe);
      this.ui.showEvolutionBanner(artifact);
      this.ui.refreshLoadout();
      this.fx.spawnSparks(this.player.x, this.player.y, '#d4af37', 30);
    } else if (chest.boss) {
      this.gainExp(40);
      this.player.hp = this.player.maxHp;
      this.ui.showToast('Boss 宝箱: +40 经验,生命回满');
    } else {
      this.gainExp(25);
      this.ui.showToast('宝箱: +25 经验');
    }
  }
```
4. entities.js 中 Boss 死亡分支改为调 `game.pickups.dropBossChest(e.x, e.y)`（Task 2 若写成 onBossKilled 则在 game.onBossKilled 里调用，保持一致）。

**验证：** Playwright 击杀 Boss（`e.hp=0`），断言掉落 bossChest；玩家无可进化配方时拾取，断言经验 +40 且血量回满。

**Commit:** `feat(boss-loot): Boss 必掉强化宝箱 + 进化/补偿逻辑`

---

### Task 5: 端到端验证

**Files:** Modify `test_game.py`

- [ ] 追加 Boss 战端到端：注入 time=181 → Boss 登场警告 → 阶段技能触发 → 击杀 Boss → 拾取强化宝箱 → （有可进化时）进化 或 （无进化时）经验+回血补偿。断言各步骤 + 控制台无错误。跑通整局 10 项 + Boss 5 项断言。

**Commit:** `test: Boss 战端到端验证`

---

## Self-Review
- Spec 覆盖：周期 Boss ✅(T2)、阶段技能 ✅(T2)、登场警告+血条 ✅(T3)、必掉宝箱+进化/补偿 ✅(T4)、端到端 ✅(T5)
- 类型一致：`dropBossChest/onBossSpawn/onBossKilled/activeBoss/enemyProjectiles` 跨文件命名统一 ✅
- YAGNI：Boss 复用 elite 精灵图（更大尺寸+泛红），不新增美术负担；弹幕复用玩家投射物渲染风格
