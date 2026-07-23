# S3 武器 / 被动槽位上限 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 给武器与被动加槽位上限（基础 6/6），满槽时升级三选一不再出现"新武器/新被动"卡，但保留已有装备升级；祭坛可用灵魂购买 +1 武器槽 / +1 被动槽（永久）。

**Architecture:** 上限存于 `Player.maxWeapons/maxPassives`（reset 时取 `CONFIG` 基础值，startRun 时由已解锁祭坛项 `+1`）；`UpgradeSystem.buildPool()` 在满槽时跳过"新"选项；UI 在升级操作条 + HUD 显示 `武器 X/Max · 被动 Y/Max`。进化（evolution）替换基底武器、槽数守恒，不受影响。

**Tech Stack:** Vite + 原生 Canvas2D + ES Modules；测试用 Playwright e2e（`test_game.py`）直连 `localhost:5173/?debug` 的 `window.__game`。

---

## Task 1: CONFIG 基础上限 + Player 字段

**Files:**
- Modify: `src/data.js:1-8`（`CONFIG` 对象）
- Modify: `src/entities.js:7-33`（`Player.reset()`）

**Step 1: ��失败断言（e2e 先占位，Task 5 统一跑）**

**Step 2: 加 CONFIG 常量**
```js
export const CONFIG = {
  LOGICAL_WIDTH: 960,
  // ...沿用...
  MAX_WEAPONS: 6,
  MAX_PASSIVES: 6,
};
```

**Step 3: Player.reset() 初始化上限**
```js
    this.weapons = [];
    this.passives = new Map();
    this.maxWeapons = CONFIG.MAX_WEAPONS;   // S3 槽位上限（基础）
    this.maxPassives = CONFIG.MAX_PASSIVES;
```

**Step 4: 提交**
```bash
git add src/data.js src/entities.js
git commit -m "feat(S3): CONFIG 基础上限 + Player.maxWeapons/maxPassives"
```

---

## Task 2: 祭坛 +1 槽灵魂解锁

**Files:**
- Modify: `src/data.js:27-31`（`ALTAR` 数组，soul_dual 之后追加）

**Step 1: 加两项解锁（apply 在 startRun 的 ALTAR 循环随其他解锁一并注入）**
```js
  { id: 'soul_slot_weapon',  name: '扩容武器槽', icon: 'blade',    cost: 150, desc: '武器槽 +1（永久，上限 7）',        apply: (g) => { g.player.maxWeapons += 1; } },
  { id: 'soul_slot_passive', name: '扩容被动槽', icon: 'gemMedium', cost: 150, desc: '被动槽 +1（永久，上限 7）',        apply: (g) => { g.player.maxPassives += 1; } },
```
> 数值 `[PLACEHOLDER]`：150 灵魂取中等价位（介于 soul_dmg 130 与 soul_dual 220 之间），真机按灵魂获取速率校准。

**Step 2: 提交**
```bash
git add src/data.js
git commit -m "feat(S3): 祭坛 +1 武器槽 / +1 被动槽 灵魂解锁"
```

---

## Task 3: buildPool 满槽抑制（核心）

**Files:**
- Modify: `src/upgrade.js:48-71`（`buildPool()`）

**Step 1: 武器循环加满槽判断**
```js
  buildPool() {
    const player = this.game.player;
    const pool = [];
    const W = { weaponUp: 5, passiveUp: 3, weaponNew: 2, passiveNew: 1 };
    const weaponCount = player.weapons.length;   // S3：含神器，与 addWeapon 计数口径一致
    for (const def of Object.values(WEAPONS)) {
      if (this.banned.has(def.id)) continue;
      if (this.game.weapons.hasWeapon(def.id)) {
        if (this.game.weapons.weaponLevel(def.id) < def.maxLevel) {
          pool.push({ kind: 'weapon-up', id: def.id, def, weight: W.weaponUp, isWeapon: true });
        }
      } else if (weaponCount < player.maxWeapons) {   // S3：满武器槽不再提供新武器
        pool.push({ kind: 'weapon-new', id: def.id, def, weight: W.weaponNew, isWeapon: true });
      }
    }
```

**Step 2: 被动循环加满槽判断（只跳过尚未拥有的新被动）**
```js
    for (const def of Object.values(PASSIVES)) {
      if (this.banned.has(def.id)) continue;
      const lv = player.passives.get(def.id) || 0;
      if (lv >= def.maxLevel) continue;
      // S3：满被动槽时，只跳过尚未拥有的"新被动"；已拥有的被动升级照常（保留后期成长）
      if (lv === 0 && player.passives.size >= player.maxPassives) continue;
      pool.push({ kind: 'passive', id: def.id, def, weight: lv > 0 ? W.passiveUp : W.passiveNew, isWeapon: false });
    }
    return pool;
  }
```

**Step 3: 提交**
```bash
git add src/upgrade.js
git commit -m "feat(S3): buildPool 满槽抑制新武器/新被动卡"
```

---

## Task 4: UI 槽位计数显示

**Files:**
- Modify: `src/upgrade.js:14-46`（`buildActionBar` + `updateActionBar`）
- Modify: `src/ui.js:150-179`（`refreshLoadout`）
- Modify: `src/style.css:345-360`（`#upgrade-actions` 区加 `.ua-slots`）、`src/style.css:197-212`（`.loadout-slots`）

**Step 1: 升级操作条加计数元素**
```js
  buildActionBar() {
    const bar = document.createElement('div');
    bar.id = 'upgrade-actions';
    bar.innerHTML = `
      <button id="btn-reroll" class="ua-btn">重掷 <span id="reroll-count">3</span></button>
      <button id="btn-banish" class="ua-btn">放逐 <span id="banish-count">3</span></button>
      <p class="ua-hint">重掷:换一组三选一;放逐:选中一项后点放逐</p>
      <p id="slot-count" class="ua-slots"></p>
    `;
    this.screen.insertBefore(bar, this.cardsEl);
    this.rerollBtn = bar.querySelector('#btn-reroll');
    this.banishBtn = bar.querySelector('#btn-banish');
    this.rerollCountEl = bar.querySelector('#reroll-count');
    this.banishCountEl = bar.querySelector('#banish-count');
    this.slotCountEl = bar.querySelector('#slot-count');
    this.rerollBtn.addEventListener('click', () => this.reroll());
    this.banishBtn.addEventListener('click', () => this.banish());
  }
```

**Step 2: updateActionBar 刷新计数**
```js
  updateActionBar() {
    this.rerollCountEl.textContent = this.game.rerollsLeft;
    this.banishCountEl.textContent = this.game.banishesLeft;
    this.rerollBtn.disabled = this.game.rerollsLeft <= 0;
    this.banishBtn.disabled = this.game.banishesLeft <= 0 || this.selectedIdx < 0;
    const p = this.game.player;
    this.slotCountEl.textContent = `武器 ${p.weapons.length}/${p.maxWeapons} · 被动 ${p.passives.size}/${p.maxPassives}`;
  }
```

**Step 3: refreshLoadout 在 HUD 顶部显示计数**
```js
  refreshLoadout() {
    const player = this.game.player;
    this.loadoutEl.innerHTML = '';
    const counter = document.createElement('div');
    counter.className = 'loadout-slots';
    counter.textContent = `武器 ${player.weapons.length}/${player.maxWeapons} · 被动 ${player.passives.size}/${player.maxPassives}`;
    this.loadoutEl.appendChild(counter);
    for (const w of player.weapons) {
      // ...沿用原有武器图标渲染...
```

**Step 4: CSS**
```css
/* 升级操作条槽位计数 */
.ua-slots { font-family: var(--pixel-font); font-size: 11px; color: var(--gold); letter-spacing: 1px; margin: 0 0 0 auto; }
/* HUD 装载栏槽位计数 */
.loadout-slots { width: 100%; font-family: var(--pixel-font); font-size: 9px; color: var(--gold); opacity: 0.8; margin-bottom: 4px; }
```

**Step 5: 提交**
```bash
git add src/upgrade.js src/ui.js src/style.css
git commit -m "feat(S3): UI 显示武器/被动槽位 X/Max"
```

---

## Task 5: e2e 断言 + 全量验证

**Files:**
- Modify: `test_game.py`（在「升级加权」断言之后追加 S3 用例）

**Step 1: 新增断言——满 6 武器后无新武器卡、但有升级卡**
```python
    # --- S3 槽位上限：满 6 武器后新武器卡消失，但升级卡仍在 ---
    page.evaluate("""() => {
      const g = window.__game;
      g.state = 'playing';
      g.enemies.enemies = [];
      g.player.level = 999;
      g.player.weapons = [];
      g.player.passives = new Map();
      g.upgrade.banned.clear();
      // 塞满 6 把武器（含 1 把未满级以便验证升级卡仍在）
      const ids = ['blade','axe','holywater','lightning','aura','whip'];
      for (const id of ids) { g.weapons.addWeapon(id); }
      g.weapons.upgradeWeapon('blade');   // blade 进到 LV2（未满级）
      // 第六把之后已无空槽
    }""")
    capped = page.evaluate("""() => {
      const g = window.__game;
      let newW = 0, upW = 0;
      for (let i = 0; i < 200; i++) {
        const opts = g.upgrade.rollOptions();
        for (const o of opts) {
          if (o.kind === 'weapon-new') newW++;
          if (o.kind === 'weapon-up') upW++;
        }
      }
      return { newW, upW, count: g.player.weapons.length, max: g.player.maxWeapons };
    }""")
    expect('S3 满武器槽(6)新武器卡=0', capped['newW'] == 0)
    expect('S3 已满武器仍可升级(weapon-up>0)', capped['upW'] > 0)
    expect('S3 武器数=上限', capped['count'] == capped['max'])
```

**Step 2: 新增断言——祭坛 +1 槽生效**
```python
    page.evaluate("""() => {
      window.__souls.saveSouls({balance:9999,spent:0,unlocks:[],cleared:['normal']});
      window.__souls.buyUnlock('soul_slot_weapon');
      window.__souls.buyUnlock('soul_slot_passive');
      window.__game.startRun();
    }""")
    expect('S3 祭坛 +1 武器槽(上限7)', page.evaluate("() => window.__game.player.maxWeapons == 7"))
    expect('S3 祭坛 +1 被动槽(上限7)', page.evaluate("() => window.__game.player.maxPassives == 7"))
```

**Step 3: 跑全量 e2e**
```bash
/Users/a34481/.workbuddy/binaries/python/envs/default/bin/python test_game.py 2>&1 | tail -70
```
预期：全部 PASS（原 58 项 + S3 新增约 4 项），控制台错误：无。

**Step 4: 提交**
```bash
git add test_game.py
git commit -m "test(S3): e2e 验证槽位上限+祭坛扩容, 全量 62/62"
```

---

## Task 6: 推送

```bash
git push origin main   # 经 GitHub connector（已连通）
```

---

## 风险 / 注意
- 武器计数含神器（同 `player.weapons` 数组），进化替换基底武器 → 槽数守恒，不触发误判满槽。
- 被动含 maxLevel=99 的无限成长项（rage/swift/greed/guard）：满被动槽时不给"新"的，但已拥有的可无限升级——保留后期成长。
- 空池（满槽且全满级）：沿用 `processLevelUps` 静默吸收，不弹界面（本版不加回血反馈，YAGNI）。
- 血裔起手武器占用同一上限（apostle 无武器更从容），无需特判。
