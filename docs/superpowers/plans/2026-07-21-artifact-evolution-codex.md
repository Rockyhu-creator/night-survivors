# 神器合成 + 图鉴系统 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 参照《吸血鬼幸存者》实现"满级武器+指定被动→神器"的进化系统：精英怪掉宝箱开启进化、4 常规配方 + 2 隐藏配方、跨局持久化的全收集图鉴。

**Architecture:** 在现有 Vite + 原生 JS + Canvas 2D 游戏上扩展。数据层新增神器/配方定义与图鉴 localStorage 结构；玩法层新增宝箱拾取物与进化判定、神器武器行为；UI 层新增主界面图鉴页。沿用现有对象池/空间哈希/HUD 模式。

**Tech Stack:** Vite@5、原生 ES Modules、Canvas 2D、localStorage、Playwright（端到端验证）。

**关键文件地图：**
- `src/data.js` — 新增 `ARTIFACTS`（神器定义）、`RECIPES`（配方表）、图鉴存取 `loadCollection/saveCollection`
- `src/weapons.js` — 武器系统支持神器：进化替换、神器各自攻击逻辑
- `src/systems.js` — 拾取系统新增宝箱（Chest）类型
- `src/entities.js` — 精英怪死亡掉宝箱
- `src/evolution.js` — 新增：进化判定、图鉴数据组装
- `src/ui.js` — 图鉴界面渲染、主界面入口
- `index.html` — 图鉴页 DOM、宝箱开启提示
- `src/style.css` — 图鉴页样式

---

## 配方设计（已确认）

| 满级武器 | + 被动 | → 神器 | 神器效果 |
|---|---|---|---|
| 血之飞刃 blade(5) | + 疾行之靴 boots | **千刃风暴** | 无冷却，持续向 3 个最近敌人连射飞刃 |
| 圣水洗礼 holywater(5) | + 引力宝珠 magnet | **圣洁吞噬** | 跟随玩家移动的大范围持续灼烧领域 |
| 回旋战斧 axe(5) | + 巨人之心 heart | **死亡螺旋** | 6 把斧刃环绕玩家全屏旋转 |
| 雷霆审判 lightning(5) | + 秘法魔典 tome | **雷霆循环** | 每 1.2s 轰击 6 目标，连锁 6 跳 |
| 血之飞刃 blade(5) | + 秘法魔典 tome | **猩红之拥**（隐藏） | 飞刃命中回复 1 HP，伤害翻倍 |
| 雷霆审判 lightning(5) | + 疾行之靴 boots | **雷劫**（隐藏） | 移动路径上持续触发落雷 |

图鉴跨局持久化 key：`night_survivors_collection`，结构 `{ unlocked: ["blade","artifact_storm",...] }`。武器/被动默认已解锁（获得过即解锁），神器需进化成功才解锁。

---

### Task 1: 数据层 — 神器定义、配方表、图鉴持久化

**Files:**
- Modify: `src/data.js`

- [ ] **Step 1: 在 data.js 末尾追加神器与配方定义**

```javascript
// ---------- 神器（Artifact）----------
export const ARTIFACTS = {
  storm: {
    id: 'storm', name: '千刃风暴', icon: 'blade', baseWeapon: 'blade', rarity: 'normal',
    desc: '无冷却,持续向最近的 3 个敌人倾泻飞刃',
  },
  devour: {
    id: 'devour', name: '圣洁吞噬', icon: 'holywater', baseWeapon: 'holywater', rarity: 'normal',
    desc: '环绕你的圣域,持续灼烧踏入的一切',
  },
  spiral: {
    id: 'spiral', name: '死亡螺旋', icon: 'axe', baseWeapon: 'axe', rarity: 'normal',
    desc: '六把战斧环绕你全屏旋转,绞碎靠近之敌',
  },
  stormcall: {
    id: 'stormcall', name: '雷霆循环', icon: 'lightning', baseWeapon: 'lightning', rarity: 'normal',
    desc: '每 1.2 秒轰击 6 个目标,雷电跳跃 6 次',
  },
  crimson: {
    id: 'crimson', name: '猩红之拥', icon: 'blade', baseWeapon: 'blade', rarity: 'hidden',
    desc: '飞刃命中回复 1 点生命,伤害翻倍',
  },
  tempest: {
    id: 'tempest', name: '雷劫', icon: 'lightning', baseWeapon: 'lightning', rarity: 'hidden',
    desc: '你行经之处,落雷不绝',
  },
};

// ---------- 合成配方 ----------
export const RECIPES = [
  { weapon: 'blade', passive: 'boots', artifact: 'storm' },
  { weapon: 'holywater', passive: 'magnet', artifact: 'devour' },
  { weapon: 'axe', passive: 'heart', artifact: 'spiral' },
  { weapon: 'lightning', passive: 'tome', artifact: 'stormcall' },
  { weapon: 'blade', passive: 'tome', artifact: 'crimson' },
  { weapon: 'lightning', passive: 'boots', artifact: 'tempest' },
];

const COLLECTION_KEY = 'night_survivors_collection';

export function loadCollection() {
  try {
    const raw = localStorage.getItem(COLLECTION_KEY);
    return raw ? JSON.parse(raw) : { unlocked: [] };
  } catch {
    return { unlocked: [] };
  }
}

export function saveCollection(c) {
  try {
    localStorage.setItem(COLLECTION_KEY, JSON.stringify(c));
  } catch { /* ignore */ }
}

export function unlockInCollection(id) {
  const c = loadCollection();
  if (!c.unlocked.includes(id)) {
    c.unlocked.push(id);
    saveCollection(c);
  }
}
```

- [ ] **Step 2: 验证无语法错误**

Run: `node --input-type=module -e "import('./src/data.js').then(m=>console.log(Object.keys(m.ARTIFACTS).length, m.RECIPES.length))"` (在项目根目录)
Expected: 输出 `6 6`

- [ ] **Step 3: Commit**

```bash
git add src/data.js
git commit -m "feat(data): 神器定义/配方表/图鉴持久化结构"
```

---

### Task 2: 进化判定模块 evolution.js

**Files:**
- Create: `src/evolution.js`

- [ ] **Step 1: 创建 evolution.js，实现进化条件查询**

```javascript
import { RECIPES, ARTIFACTS, WEAPONS, PASSIVES, unlockInCollection } from './data.js';

// 返回当前可进化的配方（满级武器 + 持有被动 + 尚未拥有该神器），无则返回 null
export function findEvolvableRecipe(player, weaponSystem) {
  for (const r of RECIPES) {
    if (weaponSystem.weaponLevel(r.weapon) < WEAPONS[r.weapon].maxLevel) continue;
    if (!player.passives.has(r.passive)) continue;
    if (weaponSystem.hasArtifact(r.artifact)) continue;
    return r;
  }
  return null;
}

// 玩家是否已有任何可进化配方（用于宝箱开启提示）
export function hasEvolvable(player, weaponSystem) {
  return findEvolvableRecipe(player, weaponSystem) !== null;
}

// 执行进化：移除满级原武器，注入神器，解锁图鉴，返回神器定义
export function performEvolution(player, weaponSystem, recipe) {
  const idx = player.weapons.findIndex((w) => w.id === recipe.weapon);
  if (idx >= 0) player.weapons.splice(idx, 1);
  weaponSystem.addArtifact(recipe.artifact);
  unlockInCollection(recipe.artifact);
  // 图鉴同时记录用到的武器与被动（防御性，正常早已解锁）
  unlockInCollection(recipe.weapon);
  unlockInCollection(recipe.passive);
  return ARTIFACTS[recipe.artifact];
}

// 组装图鉴页数据
export function buildCollectionData(unlocked) {
  const has = (id) => unlocked.includes(id);
  const weapons = Object.values(WEAPONS).map((d) => ({ id: d.id, name: d.name, icon: d.icon, kind: 'weapon', unlocked: has(d.id), desc: d.desc }));
  const passives = Object.values(PASSIVES).map((d) => ({ id: d.id, name: d.name, icon: d.icon, kind: 'passive', unlocked: has(d.id), desc: d.desc }));
  const artifacts = Object.values(ARTIFACTS).map((d) => {
    const recipe = RECIPES.find((r) => r.artifact === d.id);
    const hint = d.rarity === 'hidden' && !has(d.id)
      ? '???（隐藏配方，自行探索）'
      : `${WEAPONS[recipe.weapon].name}(满级) + ${PASSIVES[recipe.passive].name}`;
    return { id: d.id, name: has(d.id) ? d.name : '???', icon: d.icon, kind: 'artifact', rarity: d.rarity, unlocked: has(d.id), desc: d.desc, hint };
  });
  return { weapons, passives, artifacts };
}
```

- [ ] **Step 2: 依赖说明**

`weaponSystem` 需具备 `weaponLevel(id)`、`hasArtifact(id)`、`addArtifact(id)` 三个方法（Task 3 在 weapons.js 实现）。`player.passives` 为 `Map<passiveId, level>`（已存在）。

- [ ] **Step 3: Commit**

```bash
git add src/evolution.js
git commit -m "feat(evolution): 进化条件判定与图鉴数据组装"
```

---

### Task 3: 武器系统支持神器 + 6 种神器攻击逻辑

**Files:**
- Modify: `src/weapons.js`

- [ ] **Step 1: WeaponSystem 增加神器管理方法与状态**

在 `constructor` 的 `this.bolts = []` 后追加：

```javascript
    this.artifactState = { stormTimer: 0, devourAngle: 0, stormcallTimer: 1.0, tempestDistance: 0 };
```

在 `reset()` 末尾追加：

```javascript
    this.artifactState = { stormTimer: 0, devourAngle: 0, stormcallTimer: 1.0, tempestDistance: 0 };
```

新增方法（放在 `weaponLevel` 之后）：

```javascript
  addArtifact(id) {
    this.game.player.weapons.push({ id, artifact: true, level: 1, timer: 0 });
  }

  hasArtifact(id) {
    return this.game.player.weapons.some((w) => w.artifact && w.id === id);
  }
```

- [ ] **Step 2: update() 分流神器与普通武器**

将 `update(dt)` 中遍历 `player.weapons` 的循环体改为：

```javascript
    for (const weapon of player.weapons) {
      if (weapon.artifact) { this.updateArtifact(weapon, dt); continue; }
      weapon.timer -= dt;
      if (weapon.timer <= 0) {
        const s = this.stats(weapon);
        weapon.timer += s.cooldown;
        this.fire(weapon, s);
      }
    }
```

- [ ] **Step 3: 实现 updateArtifact 六个神器逻辑（追加到 weapons.js）**

```javascript
  updateArtifact(weapon, dt) {
    const game = this.game;
    const player = game.player;
    const enemies = game.enemies.enemies;
    const st = this.artifactState;
    if (weapon.id === 'storm') {
      st.stormTimer -= dt;
      if (st.stormTimer <= 0 && enemies.length > 0) {
        st.stormTimer = 0.12;
        for (let i = 0; i < 3; i += 1) {
          const target = this.pickTarget(i);
          if (!target) break;
          const dx = target.x - player.x;
          const dy = target.y - player.y;
          const d = Math.hypot(dx, dy) || 1;
          this.projectiles.push({
            kind: 'blade', x: player.x, y: player.y,
            vx: (dx / d) * 420, vy: (dy / d) * 420,
            damage: 18 * player.damageMul, pierce: 2, life: 1.4, spin: 0, hitSet: new Set(),
          });
        }
      }
    } else if (weapon.id === 'devour') {
      st.devourAngle += dt;
      if (!this.devourPool) {
        this.devourPool = { radius: 110, tick: 0.4, tickTimer: 0 };
      }
      const pool = this.devourPool;
      pool.x = player.x;
      pool.y = player.y;
      pool.tickTimer -= dt;
      if (pool.tickTimer <= 0) {
        pool.tickTimer = pool.tick;
        for (const e of game.enemies.enemiesNear(player.x, player.y, pool.radius + 30)) {
          if (e.hp > 0 && Math.hypot(e.x - player.x, e.y - player.y) < pool.radius) {
            game.enemies.damageEnemy(e, 16 * player.damageMul);
            game.fx.spawnDamageNumber(e.x, e.y - e.radius, Math.round(16 * player.damageMul), '#a8d8ff');
          }
        }
      }
    } else if (weapon.id === 'spiral') {
      st.devourAngle += dt * 2.2;
      const blades = 6;
      for (let i = 0; i < blades; i += 1) {
        const ang = st.devourAngle + (i * Math.PI * 2) / blades;
        const bx = player.x + Math.cos(ang) * 130;
        const by = player.y + Math.sin(ang) * 130;
        for (const e of game.enemies.enemiesNear(bx, by, 40)) {
          if (e.hp > 0 && !e._spiralHit) {
            e._spiralHit = true;
            game.enemies.damageEnemy(e, 24 * player.damageMul, Math.cos(ang), Math.sin(ang));
            game.fx.spawnDamageNumber(e.x, e.y - e.radius, Math.round(24 * player.damageMul));
            setTimeout(() => { e._spiralHit = false; }, 400);
          }
        }
      }
    } else if (weapon.id === 'stormcall') {
      st.stormcallTimer -= dt;
      if (st.stormcallTimer <= 0 && enemies.length > 0) {
        st.stormcallTimer = 1.2;
        for (let i = 0; i < 6; i += 1) {
          const target = enemies[Math.floor(Math.random() * enemies.length)];
          this.strikeLightning(target, { damage: 40, chains: 6, chainRange: 220 }, new Set());
        }
      }
    } else if (weapon.id === 'crimson') {
      st.stormTimer -= dt;
      if (st.stormTimer <= 0 && enemies.length > 0) {
        st.stormTimer = 0.5;
        for (let i = 0; i < 2; i += 1) {
          const target = this.pickTarget(i);
          if (!target) break;
          const dx = target.x - player.x;
          const dy = target.y - player.y;
          const d = Math.hypot(dx, dy) || 1;
          this.projectiles.push({
            kind: 'blade', x: player.x, y: player.y,
            vx: (dx / d) * 400, vy: (dy / d) * 400,
            damage: 32 * player.damageMul, pierce: 2, life: 1.5, spin: 0, hitSet: new Set(), lifeSteal: true,
          });
        }
      }
    } else if (weapon.id === 'tempest') {
      const moved = Math.hypot(player.x - (st.lastX || player.x), player.y - (st.lastY || player.y));
      st.tempestDistance += moved;
      st.lastX = player.x;
      st.lastY = player.y;
      if (st.tempestDistance > 60 && enemies.length > 0) {
        st.tempestDistance = 0;
        const target = game.enemies.nearestTo(player.x, player.y, 320);
        if (target) this.strikeLightning(target, { damage: 30, chains: 2, chainRange: 160 }, new Set());
      }
    }
  }
```

- [ ] **Step 4: 猩红之拥吸血 + 死亡螺旋/圣洁吞噬渲染**

在 `updateProjectiles` 命中敌人分支的 `game.fx.spawnSparks(...)` 之后追加：

```javascript
          if (p.lifeSteal) {
            game.player.hp = Math.min(game.player.maxHp, game.player.hp + 1);
          }
```

在 `render()` 的圣水领域循环之后追加神器渲染：

```javascript
    // 神器：死亡螺旋环绕斧刃
    if (this.hasArtifact('spiral')) {
      const st = this.artifactState;
      const player = this.game.player;
      const img = sprite('axe');
      for (let i = 0; i < 6; i += 1) {
        const ang = st.devourAngle + (i * Math.PI * 2) / 6;
        const bx = player.x + Math.cos(ang) * 130 - cam.ox;
        const by = player.y + Math.sin(ang) * 130 - cam.oy;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(st.devourAngle * 3);
        if (img) ctx.drawImage(img, -17, -17, 34, 34);
        ctx.restore();
      }
    }
    // 神器：圣洁吞噬跟随领域
    if (this.hasArtifact('devour') && this.devourPool) {
      const player = this.game.player;
      const sx = player.x - cam.ox;
      const sy = player.y - cam.oy;
      const r = this.devourPool.radius;
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#4aa3df';
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#a8d8ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy, r * (0.9 + Math.sin(st.devourAngle * 5) * 0.06), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
```

- [ ] **Step 5: Playwright 冒烟——游戏仍可启动无报错**

Run: `python3 test_game.py`（现有脚本，验证启动+升级流程）
Expected: 控制台错误: 无

- [ ] **Step 6: Commit**

```bash
git add src/weapons.js
git commit -m "feat(weapons): 神器武器系统 + 6 种神器攻击逻辑"
```

---

### Task 4: 宝箱系统 — 精英怪掉落与开启进化

**Files:**
- Modify: `src/systems.js`（PickupSystem）
- Modify: `src/entities.js`（精英怪掉落）
- Modify: `index.html`、`src/game.js`（开启提示）

- [ ] **Step 1: PickupSystem 支持宝箱类型**

在 `systems.js` 的 `drop()` 方法后新增：

```javascript
  dropChest(x, y) {
    this.gems.push({
      chest: true,
      x, y,
      value: 0,
      def: { key: 'gemLarge', min: 0, size: 34, color: '#d4af37' },
      magnet: false, vx: 0, vy: 0, bob: 0,
    });
  }
```

在 `update(dt)` 的拾取判定（`if (d < player.radius + 8)`）分支开头，区分宝箱：

```javascript
      if (d < player.radius + (g.chest ? 16 : 8)) {
        if (g.chest) {
          this.game.onChestOpened(g);
          this.gems.splice(i, 1);
          continue;
        }
        this.game.gainExp(g.value);
        this.game.fx.spawnSparks(player.x, player.y, g.def.color, 3);
        this.gems.splice(i, 1);
      }
```

在 `render()` 中，宝箱用更大尺寸 + 金色呼吸光晕（在宝石绘制分支里，若 `g.chest` 则 `size = 40*pulse` 且 `shadowBlur = 18`）。

- [ ] **Step 2: 精英怪死亡掉宝箱**

`entities.js` 中 `EnemyManager.update` 清理死亡敌人的循环里，`this.game.onEnemyKilled(e)` 之后追加：

```javascript
        if (e.type === ENEMY_TYPES.elite) {
          this.game.pickups.dropChest(e.x, e.y);
        }
```

- [ ] **Step 3: game.js 增加 onChestOpened 进化流程**

在 `onEnemyKilled` 方法后新增：

```javascript
  onChestOpened() {
    const recipe = findEvolvableRecipe(this.player, this.weapons);
    if (recipe) {
      const artifact = performEvolution(this.player, this.weapons, recipe);
      this.ui.showEvolutionBanner(artifact);
      this.ui.refreshLoadout();
      this.fx.spawnSparks(this.player.x, this.player.y, '#d4af37', 30);
    } else {
      // 无可进化配方：宝箱补偿 25 经验
      this.gainExp(25);
      this.ui.showToast('宝箱: +25 经验');
    }
  }
```

并在 `game.js` 顶部 import 处加入：

```javascript
import { findEvolvableRecipe, performEvolution } from './evolution.js';
```

- [ ] **Step 4: UI 进化横幅 + Toast**

`index.html` 在 `<div id="damage-vignette">` 前新增：

```html
    <div id="evolution-banner" class="hidden">
      <p class="evo-label">神器觉醒</p>
      <p id="evo-name"></p>
      <p id="evo-desc"></p>
    </div>
    <div id="toast" class="hidden"></div>
```

`ui.js` 新增方法：

```javascript
  showEvolutionBanner(artifact) {
    const el = document.getElementById('evolution-banner');
    document.getElementById('evo-name').textContent = artifact.name;
    document.getElementById('evo-desc').textContent = artifact.desc;
    el.classList.remove('hidden');
    clearTimeout(this._evoTimer);
    this._evoTimer = setTimeout(() => el.classList.add('hidden'), 2600);
  }

  showToast(text) {
    const el = document.getElementById('toast');
    el.textContent = text;
    el.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.add('hidden'), 1800);
  }
```

`style.css` 追加：

```css
#evolution-banner {
  position: absolute; top: 30%; left: 50%; transform: translateX(-50%);
  text-align: center; z-index: 18; pointer-events: none;
  animation: evoIn .5s cubic-bezier(.2,1.6,.4,1) both;
}
@keyframes evoIn { from { opacity: 0; transform: translateX(-50%) scale(.6); } to { opacity: 1; transform: translateX(-50%) scale(1); } }
.evo-label { font-family: var(--pixel-font); font-size: 12px; letter-spacing: 6px; color: var(--gold); }
#evo-name { font-family: var(--body-font); font-weight: 900; font-size: 52px; letter-spacing: 8px; color: var(--gold); text-shadow: 0 0 34px rgba(212,175,55,.9); margin: 8px 0; }
#evo-desc { font-size: 16px; letter-spacing: 3px; opacity: .85; }
#toast {
  position: absolute; top: 24%; left: 50%; transform: translateX(-50%);
  font-family: var(--pixel-font); font-size: 12px; color: var(--bone);
  background: rgba(0,0,0,.7); border: 2px solid rgba(212,175,55,.5);
  padding: 10px 20px; z-index: 18; pointer-events: none; letter-spacing: 2px;
}
```

- [ ] **Step 5: Playwright 验证宝箱掉落与进化**

用调试钩子注入：满级飞刃 + 靴子，召唤精英怪击杀，拾取宝箱，断言进化横幅出现且武器变为神器。（脚本见 Task 6 统一端到端）

- [ ] **Step 6: Commit**

```bash
git add src/systems.js src/entities.js src/game.js src/ui.js index.html src/style.css
git commit -m "feat(chest): 精英怪掉宝箱 + 开启进化流程 + 觉醒横幅"
```

---

### Task 5: 图鉴界面 — 主界面入口 + 全收集页

**Files:**
- Modify: `index.html`、`src/ui.js`、`src/style.css`、`src/main.js`

- [ ] **Step 1: index.html 增加图鉴页与入口按钮**

开始界面 `how-to` 之后新增按钮：

```html
        <button id="btn-codex" class="gothic-btn ghost">合成图鉴</button>
```

`gameover-screen` 之后新增图鉴页：

```html
    <div id="codex-screen" class="screen hidden">
      <p class="codex-title">合成图鉴</p>
      <p class="codex-sub">集齐神器,对抗永夜</p>
      <div id="codex-content"></div>
      <button id="btn-codex-back" class="gothic-btn">返回</button>
    </div>
```

- [ ] **Step 2: ui.js 实现图鉴渲染**

新增方法：

```javascript
  showCodex() {
    const { unlocked } = loadCollection();
    const data = buildCollectionData(unlocked);
    const root = document.getElementById('codex-content');
    root.innerHTML = '';
    const sections = [
      ['武器', data.weapons],
      ['被动道具', data.passives],
      ['神器', data.artifacts],
    ];
    for (const [title, items] of sections) {
      const sec = document.createElement('div');
      sec.className = 'codex-section';
      const h = document.createElement('h3');
      h.textContent = title;
      sec.appendChild(h);
      const grid = document.createElement('div');
      grid.className = 'codex-grid';
      for (const item of items) {
        const card = document.createElement('div');
        card.className = `codex-card ${item.unlocked ? '' : 'locked'} ${item.rarity === 'hidden' ? 'hidden-item' : ''}`;
        const img = document.createElement('img');
        img.src = this.iconURL(item.icon);
        const name = document.createElement('p');
        name.className = 'cc-name';
        name.textContent = item.name;
        grid.appendChild(card);
        card.append(img, name);
        if (item.hint) {
          const hint = document.createElement('p');
          hint.className = 'cc-hint';
          hint.textContent = item.hint;
          card.appendChild(hint);
        } else if (item.desc && item.unlocked) {
          const desc = document.createElement('p');
          desc.className = 'cc-hint';
          desc.textContent = item.desc;
          card.appendChild(desc);
        }
      }
      sec.appendChild(grid);
      root.appendChild(sec);
    }
    document.getElementById('codex-screen').classList.remove('hidden');
    document.getElementById('title-screen').classList.add('hidden');
  }

  hideCodex() {
    document.getElementById('codex-screen').classList.add('hidden');
    document.getElementById('title-screen').classList.remove('hidden');
  }
```

`ui.js` 顶部 import 增加：`loadCollection`（来自 data.js）、`buildCollectionData`（来自 evolution.js）。

- [ ] **Step 3: main.js 绑定按钮**

```javascript
document.getElementById('btn-codex').addEventListener('click', () => game.ui.showCodex());
document.getElementById('btn-codex-back').addEventListener('click', () => game.ui.hideCodex());
```

- [ ] **Step 4: style.css 图鉴页样式**

```css
#codex-screen { background: rgba(8,5,16,.97); z-index: 30; overflow-y: auto; padding: 40px 20px; justify-content: flex-start; }
.codex-title { font-family: var(--body-font); font-weight: 900; font-size: 44px; letter-spacing: 12px; color: var(--gold); text-shadow: 0 0 26px rgba(212,175,55,.5); margin-top: 20px; }
.codex-sub { margin: 10px 0 26px; letter-spacing: 5px; opacity: .7; }
#codex-content { width: min(880px, 92vw); }
.codex-section h3 { font-size: 20px; letter-spacing: 6px; color: var(--blood-bright); margin: 22px 0 12px; border-bottom: 1px solid rgba(212,175,55,.3); padding-bottom: 6px; }
.codex-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
.codex-card { background: rgba(20,14,32,.9); border: 2px solid rgba(212,175,55,.4); padding: 14px 10px; text-align: center; }
.codex-card img { width: 52px; height: 52px; object-fit: cover; image-rendering: pixelated; border: 1px solid rgba(232,224,208,.2); background: #000; }
.codex-card .cc-name { margin-top: 8px; font-size: 14px; letter-spacing: 1px; }
.codex-card .cc-hint { margin-top: 6px; font-size: 11px; line-height: 1.5; opacity: .7; }
.codex-card.locked { opacity: .38; filter: grayscale(1); }
.codex-card.hidden-item { border-color: rgba(142,68,173,.5); }
#codex-screen .gothic-btn { margin-top: 28px; }
```

- [ ] **Step 5: 升级解锁武器/被动进图鉴**

`upgrade.js` 的 `apply()` 方法末尾追加：

```javascript
    unlockInCollection(option.id);
```

并在 `upgrade.js` 顶部 import：`import { unlockInCollection } from './data.js';`
（注：武器/被动在"获得过"即解锁；初始飞刃在游戏开始 `startRun` 时也调用一次 `unlockInCollection('blade')`。）

- [ ] **Step 6: Commit**

```bash
git add index.html src/ui.js src/style.css src/main.js src/upgrade.js src/game.js
git commit -m "feat(codex): 全收集图鉴页 + 主界面入口 + 解锁记录"
```

---

### Task 6: 端到端验证

**Files:**
- Modify: `test_game.py`

- [ ] **Step 1: 编写进化 + 图鉴端到端脚本**

```python
from playwright.sync_api import sync_playwright

URL = 'http://localhost:5173/?debug'
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 720})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    # 图鉴初始：只有已解锁项
    page.click('#btn-codex')
    page.wait_for_timeout(400)
    page.screenshot(path='/tmp/codex_before.png')
    locked_artifacts = page.evaluate("() => [...document.querySelectorAll('.codex-card.locked')].length")
    print('初始锁定卡片数:', locked_artifacts)
    page.click('#btn-codex-back')

    page.click('#btn-start')
    page.wait_for_timeout(600)

    # 注入：飞刃满级 + 靴子被动
    page.evaluate("""() => {
      const g = window.__game;
      g.weapons.upgradeWeapon('blade'); g.weapons.upgradeWeapon('blade');
      g.weapons.upgradeWeapon('blade'); g.weapons.upgradeWeapon('blade');
      g.player.passives.set('boots', 1);
    }""")

    # 直接掉宝箱并吸附开启
    page.evaluate("""() => {
      const g = window.__game;
      g.pickups.dropChest(g.player.x, g.player.y);
    }""")
    page.wait_for_timeout(800)
    banner = page.evaluate("() => !document.getElementById('evolution-banner').classList.contains('hidden')")
    has_artifact = page.evaluate("() => window.__game.weapons.hasArtifact('storm')")
    print('进化横幅:', banner, '| 获得千刃风暴:', has_artifact)
    page.screenshot(path='/tmp/evolution.png')

    # 图鉴应显示神器已解锁
    page.evaluate("() => { window.__game.player.hp = 1; window.__game.enemies.enemies.forEach(e=>e.hp=0); }")
    page.wait_for_timeout(1200)
    page.click('#btn-home')
    page.wait_for_timeout(400)
    page.click('#btn-codex')
    page.wait_for_timeout(400)
    storm_unlocked = page.evaluate("""() => {
      const cards = [...document.querySelectorAll('.codex-card')];
      return cards.some(c => !c.classList.contains('locked') && c.textContent.includes('千刃风暴'));
    }""")
    print('图鉴中千刃风暴已解锁:', storm_unlocked)
    page.screenshot(path='/tmp/codex_after.png')
    print('控制台错误:', errors if errors else '无')
    browser.close()
```

- [ ] **Step 2: 运行验证全部通过**

Run: `python3 test_game.py`
Expected: 进化横幅 True、获得千刃风暴 True、图鉴解锁 True、无控制台错误

- [ ] **Step 3: Commit**

```bash
git add test_game.py
git commit -m "test: 神器进化与图鉴端到端验证"
```

---

## Self-Review 记录

- **Spec 覆盖**：配方表 ✅（Task 1）、宝箱进化 ✅（Task 4）、6 神器逻辑 ✅（Task 3）、图鉴页 ✅（Task 5）、持久化 ✅（Task 1+5）、端到端 ✅（Task 6）
- **类型一致性**：`weaponLevel/hasArtifact/addArtifact` 在 Task 3 定义、Task 2 依赖 ✅；`dropChest/onChestOpened` 跨文件一致 ✅；`unlockInCollection` data.js 定义、多处使用 ✅
- **YAGNI**：宝箱无可进化配方时给经验补偿，避免死宝箱；隐藏配方未解锁前图鉴显示 `???` 防剧透
