# 宠物战斗拾取系统 Implementation Plan（v2 · 双猫自定义攻击 + 宠物商店）

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 加入宠物系统：宠物商店（花灵魂购买）解锁宠物；已拥有的宠物在局内跟随玩家，**辅助拾取宝石/血瓶/宝箱**，并各按自身攻击模式参与输出。本期两只猫：橘猫（抛物线黄色尿液→落地减速+扣血）、美短（冲撞头击）。宠物形象来自用户真实宠物照片，自动抠图后作精灵。

**Architecture:** 新增 `PetSystem`（含 `Pet` 实体），主循环与玩家一起 update/render。
- **拾取**：宠物作「第二磁吸源 + 第二拾取点」挂进 `PickupSystem`，复用掉落/经验逻辑。
- **攻击**：每宠一个 `attack` 模式字段——`urine`（橘猫）在落地点调用现有 `game.enemies.addHazard(...)` 生成黄色地面危害区（自带减速 debuff + 持续伤害，复用 `entities.js` 既有 hazard/applyDebuff）；`headbutt`（美短）是宠物冲撞状态机，接触时调现有 `game.weapons.hitEnemy`；`bolt` 为通用弱弹兜底。
- **商店**：完全镜像现有 `ALTAR` 模式——`data.js` 加 `PET_SHOP` 数组，`spendSouls` 扣灵魂、`souls.unlocks` 记录已购，`ui.js` 加 `petScreen` 复用祭坛界面骨架。
- **抠图**：`rembg` 自动抠主体 → 透明 PNG → 归一化 + 暗底描边 → 注册 `assets.js`。

**Tech Stack:** Vite5 + 原生 Canvas2D + ES Modules（零新框架）；抠图 Python `rembg`(U2Net) 落受管 venv。

---

## 设计决策（默认方案，待你确认）

| # | 决策点 | 默认方案 | 说明 |
|---|--------|----------|------|
| D1 | 宠物获取 | **宠物商店花灵魂购买**解锁，已购宠物局内跟随 | 复用 `ALTAR`+`spendSouls`+`altarScreen` 整套，最低风险 |
| D2 | 拾取行为 | 宠物作第二磁吸源 + 第二拾取点（同 v1） | 进入宠物半径宝石被吸向宠物，触点入账，复用 `PickupSystem` |
| D3 | 攻击模式 | 每宠独立 `attack` 字段（见下） | 橘猫 `urine`、美短 `headbutt`、默认 `bolt` 兜底 |
| D4 | 强度成长 | 伤害随 `player.damageMul` + `statScale` 时间缩放（已确认） | 后期仍保持「一部分」贡献 |
| D5 | 移动 | 弹性跟随飘身后 + bob + 极轻旋转（同 v1） | 照片无逐帧动画，靠浮动体现活物 |
| D6 | 形象 | 每宠 1 张照片 → `rembg` 抠图 → PNG → 注册 | **攻击动作不另需照片**，用程序化特效表现（见 §图片需求） |
| D7 | 出战数量 | **每局仅 1 只出战**（局前「出战选择」UI，复用血裔选择逻辑） | 已购多只但同场只 1 只，强度好控；未选则无宠物跟随 |

### 两只猫的攻击配置（写入 `PET_DEFS`）

```js
export const PET_DEFS = {
  orange_cat: {            // 橘猫
    id: 'orange_cat', name: '橘猫', sprite: 'pet_orange',
    cost: 120,             // 宠物商店价（灵魂）
    followDist: 38, orbitSpeed: 0.5, bobAmp: 6, bobSpeed: 3, scale: 46,
    magnetRange: 95, pickRadius: 12,
    attack: 'urine',
    urine: { interval: 1.6, speed: 300, gravity: 520, range: 150,
             puddle: { radius: 70, life: 3.0, dps: 10, slowMul: 0.55, slowDur: 0.6, color: '#ffd24a' },
             damageMul: 0.5 },
  },
  shorthair: {            // 美短（英国短毛猫）
    id: 'shorthair', name: '美短', sprite: 'pet_short',
    cost: 160,
    followDist: 34, orbitSpeed: 0.6, bobAmp: 5, bobSpeed: 3.2, scale: 48,
    magnetRange: 100, pickRadius: 12,
    attack: 'headbutt',
    headbutt: { cooldown: 1.4, dashSpeed: 520, dashTime: 0.22, hitRadius: 30,
                damageMul: 1.2, recoil: 0.3, knockback: 220 },
  },
};
```

---

## 关键代码事实（已核对，落地直接复用）

- **灵魂/解锁商店（D1 模板）**：`data.js:37` `ALTAR` 数组；`addSouls`(`:873`)/`spendSouls`(`:880`)/`isUnlocked`(`:888`)/`unlockInCollection`(`:1014`)；解锁记录存 `loadSouls().unlocks`。`ui.js` 祭坛界面 `altarScreen`(`altar-content` 卡片循环 `:1231` 起)——宠物商店**完全镜像**这套。
- **地面危害区（橘猫尿液核心）**：`entities.js:200` `EnemyManager` 含 `addHazard({x,y,radius,life,dps,slowMul,slowDur,color})`（`hazard` 形状注释在 `:210`）；`applyDebuff('slow',...)`(`:1298`) 对敌人施加 `e.slowMul`/`e.slowTimer` 减速。尿液落地 = 调 `game.enemies.addHazard(puddle)`，零新增伤害/减速代码。
- **敌人受伤（美短头撞核心）**：`weapons.js` 的 `hitEnemy(e, dmg, kx, ky, color, ...)` 是对敌人结算伤害的统一入口，`game.weapons.hitEnemy` 可直接调用。
- **宝石拾取（D2）**：`systems.js:16` `PickupSystem.update`(`:111`) 以 `player.x/y` 算磁吸/拾取；扩展为「玩家 或 宠物」双源（见 Task 3）。
- **弹体（bolt 兜底）**：`weapons.js:254` `this.projectiles`，`push` 支持 `homing`(`:866`)。
- **资源**：`assets.js` `files` 映射 + `assetUrl` 内容哈希；新增 PNG 需注册。
- **主循环**：`game.js:406` `pickups.update` / `:689` `player.render`；宠物在玩家后 update、玩家后 render。

---

## Task 1: 宠物数据 + 商店配置（data.js）

**Files:** Modify: `src/data.js`（末尾追加 `PET_DEFS` + `PET_SHOP`）

**Step 1: 写入两只猫的 `PET_DEFS`**（见上「两只猫的攻击配置」）

**Step 2: 加 `PET_SHOP` 数组（镜像 ALTAR 结构）**
```js
export const PET_SHOP = [
  { id: 'orange_cat', name: '橘猫', desc: '尿液溅射：落地成黄色水洼，减速并持续灼伤敌人', cost: 120, sprite: 'pet_orange' },
  { id: 'shorthair',  name: '美短', desc: '冲撞头击：蓄力猛撞最近敌人，高伤击退',     cost: 160, sprite: 'pet_short' },
];
```

**Step 3: 构建校验**
Run: `npm run build` → 通过。

**Step 4: Commit**
```bash
git add src/data.js
git commit -m "feat(pet): PET_DEFS + PET_SHOP 双猫配置(v4.4)"
```

---

## Task 2: 宠物实体与系统（pet.js）

**Files:** Create: `src/pet.js`

**Step 1: PetSystem + Pet（含 urine 弧线 / headbutt 冲撞 / bolt 兜底）**

```js
import { PET_DEFS } from './data.js';

export class Pet {
  constructor(def) {
    this.def = def; this.x = 0; this.y = 0;
    this.phase = Math.random() * Math.PI * 2; this.bob = 0;
    this.img = null;
    this.cd = 0;                 // 攻击冷却
    this.state = 'follow';       // follow | charge | recoil
    this.stateT = 0; this.dashVX = 0; this.dashVY = 0;
    this.shots = [];             // urine 弧线弹（自带重力，不入 weapons.projectiles）
  }
  setImage(img) { this.img = img; }

  update(dt, game) {
    const p = game.player;
    this.bob += dt * this.def.bobSpeed;
    // —— 攻击（按 attack 模式）——
    this.cd -= dt;
    if (this.def.attack === 'urine') this._urine(dt, game);
    else if (this.def.attack === 'headbutt') this._headbutt(dt, game);
    else this._bolt(dt, game);
    // —— 移动（follow / charge / recoil）——
    if (this.state === 'follow') {
      this.phase += dt * this.def.orbitSpeed;
      const tx = p.x - Math.cos(this.phase) * this.def.followDist;
      const ty = p.y - Math.sin(this.phase) * this.def.followDist + 18;
      this.x += (tx - this.x) * Math.min(1, dt * 6);
      this.y += (ty - this.y) * Math.min(1, dt * 6);
    } else if (this.state === 'charge') {
      this.x += this.dashVX * dt; this.y += this.dashVY * dt;
      this.stateT -= dt;
      const tgt = game.enemies.nearestTo(this.x, this.y, 60);
      if (tgt && Math.hypot(tgt.x - this.x, tgt.y - this.y) < (this.def.headbutt.hitRadius + tgt.radius)) {
        const dmg = 30 * this.def.headbutt.damageMul * p.damageMul * game.statScaleDamage();
        game.weapons.hitEnemy(tgt, dmg, this.dashVX / 520, this.dashVY / 520, '#ffd1a8');
        tgt.x += (this.def.headbutt.knockback) * (this.dashVX / 520) * dt * 4;
        this.state = 'recoil'; this.stateT = this.def.headbutt.recoil;
      } else if (this.stateT <= 0) { this.state = 'recoil'; this.stateT = this.def.headbutt.recoil; }
    } else { // recoil：回弹归位
      this.stateT -= dt;
      const tx = p.x - Math.cos(this.phase) * this.def.followDist;
      const ty = p.y - Math.sin(this.phase) * this.def.followDist + 18;
      this.x += (tx - this.x) * Math.min(1, dt * 4);
      this.y += (ty - this.y) * Math.min(1, dt * 4);
      if (this.stateT <= 0) this.state = 'follow';
    }
    // —— urine 弧线推进 ——
    for (let i = this.shots.length - 1; i >= 0; i -= 1) {
      const s = this.shots[i];
      s.vy += s.gravity * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.t -= dt;
      if (s.t <= 0 || s.y >= s.gy) {  // 落地
        const pu = this.def.urine.puddle;
        game.enemies.addHazard({ x: s.x, y: s.gy, radius: pu.radius, life: pu.life,
          dps: pu.dps * p.damageMul * game.statScaleDamage(), slowMul: pu.slowMul,
          slowDur: pu.slowDur, color: pu.color });
        this.shots.splice(i, 1);
      }
    }
  }

  _urine(dt, game) {
    if (this.cd > 0 || this.state !== 'follow') return;
    this.cd = this.def.urine.interval;
    const tgt = game.enemies.nearestTo(this.x, this.y, 360); if (!tgt) return;
    const gy = tgt.y; const dx = tgt.x - this.x;
    const sp = this.def.urine.speed; const t = Math.max(0.3, Math.abs(dx) / sp);
    this.shots.push({ x: this.x, y: this.y - 6, vx: dx / t, vy: -0.5 * this.def.urine.gravity * t,
      gravity: this.def.urine.gravity, gy, t: t + 0.1 });
  }
  _headbutt(dt, game) {
    if (this.cd > 0 || this.state !== 'follow') return;
    const tgt = game.enemies.nearestTo(this.x, this.y, 300); if (!tgt) return;
    this.cd = this.def.headbutt.cooldown;
    const d = Math.hypot(tgt.x - this.x, tgt.y - this.y) || 1;
    this.dashVX = (tgt.x - this.x) / d * this.def.headbutt.dashSpeed;
    this.dashVY = (tgt.y - this.y) / d * this.def.headbutt.dashSpeed;
    this.state = 'charge'; this.stateT = this.def.headbutt.dashTime;
  }
  _bolt(dt, game) {
    if (this.cd > 0 || this.state !== 'follow') return;
    this.cd = 1.1;
    const tgt = game.enemies.nearestTo(this.x, this.y, 520); if (!tgt) return;
    const d = Math.hypot(tgt.x - this.x, tgt.y - this.y) || 1, sp = 360;
    game.weapons.projectiles.push({ kind: 'blade', x: this.x, y: this.y,
      vx: (tgt.x - this.x) / d * sp, vy: (tgt.y - this.y) / d * sp, speed: sp,
      damage: 14 * 0.35 * game.player.damageMul * game.statScaleDamage(),
      pierce: 1, life: 1.6, spin: 0, hitSet: new Set(), tint: '#ffd76a', homing: 120 });
  }

  render(ctx, cam) {
    if (!this.img) return;
    const h = this.def.scale, w = h * (this.img.width / this.img.height);
    const oy = Math.sin(this.bob) * this.def.bobAmp;
    // urine 弧线视觉（黄色抛物线 + 落地前提示）
    for (const s of this.shots) {
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath(); ctx.arc(s.x - cam.x, s.y - cam.y, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.save();
    ctx.translate(this.x - cam.x, this.y - cam.y + oy);
    ctx.rotate((this.state === 'charge' ? 0.5 : Math.sin(this.bob * 0.5) * 0.04));
    ctx.drawImage(this.img, -w / 2, -h, w, h);
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(this.x - cam.x, this.y - cam.y + 2, w * 0.32, 5, 0, 0, Math.PI * 2); ctx.fill();
  }
}

export class PetSystem {
  constructor(game) { this.game = game; this.pets = []; }
  reset() {
    this.pets = [];
    const id = this.game.activePet;                   // 出战宠物（局前选择，D7）
    const def = id && PET_DEFS[id];
    if (def) { const pet = new Pet(def); pet.setImage(this.game.getAsset(def.sprite)); this.pets.push(pet); }
  }
  update(dt) { for (const pet of this.pets) pet.update(dt, this.game); }
  render(ctx, cam) { for (const pet of this.pets) pet.render(ctx, cam); }
}
```

**Step 2: game.js 接入**
- `:127` 后加 `this.pets = new PetSystem(this);`
- `startRun` 注入 `this.activePet = getSelectedPet();`（读局前选择的出战宠物；`getSelectedPet/setSelectedPet` 镜像 `getSelectedBloodline`，存于 `souls.selectedPet`）
- `:271` 后 `this.pets.reset();`；`:406` 后 `this.pets.update(dt);`；`:689` 后 `this.pets.render(ctx, cam);`
- 补 `getAsset(key)`（读 `window.__assets[key]` 或复用 `assets.getImage`）

**Step 3: 构建 + 冒烟**
Run: `npm run build && npm run dev` → 商店购买后开局应见宠物跟随；橘猫间歇落黄色水洼（敌人变慢+掉血）；美短间歇冲撞敌人。

**Step 4: Commit**
```bash
git add src/pet.js src/game.js
git commit -m "feat(pet): PetSystem 双猫攻击(urine/headbutt)+跟随接入(v4.4)"
```

---

## Task 3: 拾取系统第二磁吸/拾取点（systems.js）

**Files:** Modify: `src/systems.js:111` `PickupSystem.update`

**Step 1:** 把仅以玩家为基准的判断扩展为「玩家 或 宠物」（同 v1 Task 3）：
```js
const pet = this.game.pets && this.game.pets.pets[0];
const petMagnetR2 = pet ? pet.def.magnetRange ** 2 : 0;
const petPickR = pet ? pet.def.pickRadius + 8 : 0, petPickR2 = petPickR * petPickR;
const pdx = pet ? pet.x - g.x : 0, pdy = pet ? pet.y - g.y : 0;
const dPet2 = pet ? pdx*pdx + pdy*pdy : Infinity;
if (d2 < magnetR2 || dPet2 < petMagnetR2) g.magnet = true;
if (g.magnet) { const usePet = pet && dPet2 < d2;
  const ax = usePet ? pdx : dx, ay = usePet ? pdy : dy, ad = Math.sqrt(usePet ? dPet2 : d2) || 1;
  const speed = Math.min(560, 260 + (magnetR * 2 - Math.min(ad, magnetR * 2)));
  g.vx = ax/ad*speed; g.vy = ay/ad*speed; g.x += g.vx*dt; g.y += g.vy*dt; }
const pickR = player.radius + (g.chest ? 18 : 8);
if (d2 < pickR*pickR || dPet2 < petPickR2) { /* 拾取逻辑不变 */ }
```

**Step 2: 构建 + 冒烟**（宝石被更近一方吸走、宠物触碰入账）**Step 3: Commit**
```bash
git add src/systems.js
git commit -m "feat(pet): PickupSystem 支持宠物第二磁吸/拾取点(v4.4)"
```

---

## Task 4: 宠物商店 + 出战选择 UI（ui.js / data.js，镜像祭坛+血裔）

**Files:** Modify: `src/data.js`（加 `getSelectedPet/setSelectedPet`）、`src/ui.js`（加 `petScreen` + 按钮，复用 `altarScreen` 骨架）、`index.html`（加 `#pet-screen` 与标题栏按钮）

**Step 1: data.js 加出战宠物存取（镜像 `getSelectedBloodline` `:933`）**
```js
export function getSelectedPet() {
  const s = loadSouls();
  const id = s.selectedPet;
  return (id && isUnlocked(id)) ? id : null;   // 未选/未购 → null（无宠物跟随）
}
export function setSelectedPet(id) {
  if (!isUnlocked(id)) return false;
  const s = loadSouls();
  s.selectedPet = id; saveSouls(s); return true;
}
```
并在 `loadSouls` 默认对象（`:685`/`:697`）加 `selectedPet: o?.selectedPet || null`。

**Step 2: 标题界面加「宠物」入口按钮**（仿 `btn-bloodline` `:171`）；`ui.js` 顶部 import 加 `getSelectedPet, setSelectedPet`

**Step 3: 渲染宠物卡片（购买 + 设出战，仿 `showAltar` `:1219`+）**
```js
showPetShop() {
  const s = loadSouls();
  this.petBalanceEl.textContent = `👁 灵魂  ${s.balance}`;
  this.petContentEl.innerHTML = '';
  for (const def of PET_SHOP) {
    const owned = isUnlocked(def.id);
    const card = document.createElement('div');
    card.className = `altar-card ${owned ? 'owned' : ''}`;
    card.innerHTML = `<img src="/assets/${def.sprite}.png" class="altar-icon"><h3>${def.name}</h3><p>${def.desc}</p>`;
    if (!owned) {
      const buy = document.createElement('button');
      buy.textContent = `👁 ${def.cost}`;
      buy.onclick = () => { if (s.balance >= def.cost && spendSouls(def.cost)) {
        unlockInCollection(def.id); this.showPetShop(); this.refreshSoulBalance(); } };
      card.appendChild(buy);
    } else {
      const act = document.createElement('button');
      act.textContent = (getSelectedPet() === def.id) ? '出战中' : '设出战';
      act.onclick = () => { setSelectedPet(def.id); this.showPetShop(); };
      card.appendChild(act);
    }
    this.petContentEl.appendChild(card);
  }
  this.petScreen.classList.remove('hidden');
}
```
> 复用 `altar-card`/`altar-icon` 样式，零新 CSS（深色卡 + 紫色描边已存在）。

**Step 4: 构建 + 冒烟**（灵魂足够可购买；购买后 `isUnlocked` 为真；「设出战」后 `getSelectedPet` 返回该 id；下局该宠物出场、其余不出现）

**Step 5: Commit**
```bash
git add src/data.js src/ui.js index.html
git commit -m "feat(pet): 宠物商店+出战选择 UI(镜像祭坛/血裔,花灵魂解锁)(v4.4)"
```

---

## Task 5: 照片抠图管线 + 图片需求

**Files:** Create: `scripts/cutout_pet.py`；Create: `public/assets/pet_orange.png` / `pet_short.png`；Modify: `src/assets.js`（`files` 加两行）

**Step 1: 抠图脚本**（受管 venv 装 `rembg`+`pillow`）
```bash
/Users/a34481/.workbuddy/binaries/python/envs/default/bin/pip install rembg pillow
```
`scripts/cutout_pet.py`：读照片 → `rembg.remove` 去背 → 归一化高度 92（LANCZOS，保比例）→ 暗底 1px 描边 → 存透明 PNG。

**Step 2: 运行**（你发照片后）
Run: `python scripts/cutout_pet.py <橘猫照片> public/assets/pet_orange.png` / 同理 `pet_short.png`

**Step 3: 注册** `src/assets.js` 加 `pet_orange: 'pet_orange.png',` / `pet_short: 'pet_short.png',`

**Step 4: 兜底**（rembg 联网受限）→ 纯色背景照片用 `gen_portrait_pixels.py` 边缘泛洪；否则手动去背 PNG。

**Step 5: Commit**
```bash
git add scripts/cutout_pet.py src/assets.js public/assets/pet_orange.png public/assets/pet_short.png
git commit -m "feat(pet): 双猫抠图管线+资源注册(v4.4)"
```

### 📸 你需要发给我的照片（回答你的「需要什么动作图片」）

**每只猫只需 1 张照片，攻击动作不需要单独的动作帧**——尿液/头撞都是程序化特效（黄色抛物线+落地水洼 / 宠物前冲+撞击火花），宠物图始终是那张抠出来的静态照片。

| 猫 | 推荐姿态 | 为什么 | 背景/画质 |
|----|----------|--------|-----------|
| **橘猫**（尿液） | 侧面或 3/4 侧身、**站立**、身体+臀部入镜 | 尿液从臀部发射，侧身更易读「喷射弧线」 | 纯色背景最佳（易抠）；≥512px 长边；光线均匀 |
| **美短**（头撞） | 正面或 3/4、**脸/头清晰圆润**、最好抬头前倾 | 头撞靠「头往前」读意图，脸清楚更像在撞 | 同上 |

- **通用**：全身入镜、不要运动模糊、不要被遮挡；背景越干净抠图越干净（非纯色也能用 `rembg`，但纯色最稳）。
- **可选（非必需）**：若你想要美短头撞更「有戏」，可额外发一张「扑击/前倾」pose，我做成冲撞瞬间的替帧——但这是后期润色，不影响首版。
- 跟随模式本身不需要照片（宠物飘在身后 + 上下浮动即可）。

---

## Task 6: 质量门 + 发版文档（项目强制流程）

**Files:** Test: `tests/test_pet.py`；Modify: `CHANGELOG.md` / `docs/HANDOFF.md`

**Step 1: e2e 探针**（沿用 `test_game.py`，启 dev server 后断言）
- `game.pets.pets.length` === 1（每局仅 1 只出战；未选出战宠物则为 0）
- 橘猫 `shots` 在数秒内出现；落地后 `game.enemies` 危害区存在且敌人 `slowTimer>0`
- 美短 `state` 周期性进入 `'charge'` 且敌人受 `hitEnemy` 伤害
- 宝石在玩家远离、宠物靠近时被宠物拾取、`player.exp` 增长

**Step 2: 质量门**
Run: `npm run build` + `python test_game.py`（既有回归不破）

**Step 3: 发版**
- `CHANGELOG.md` 顶部插 v4.4 条目
- `docs/HANDOFF.md`：第 3 行「最后更新」跟版本；新增 `## 0z.` 小节；§11 回填上一版占位符 + 插新占位行（`grep -c '^(本次文档提交)'` == 1 红线）
- commit 单行 message；tag `v4.4`；**SSH 远程 `github-ssh`** 推送

**Step 4: Commit + push**
```bash
git add CHANGELOG.md docs/HANDOFF.md
git commit -m "docs(v4.4): CHANGELOG + HANDOFF 同步(宠物系统:商店+双猫)"
git tag v4.4 <docs哈希> && git push github-ssh main && git push github-ssh v4.4
```

---

## 待你确认的分叉（D1 货币、D7 出场数量均已确认）

- **数值初值**：`urine`(dps10/减速55%/间隔1.6s/范围150) 与 `headbutt`(伤害×1.2/击退220/冷却1.4s/冲刺0.22s) 为初值，真机试玩后按感受微调（数值标初值，预留 `[PLACEHOLDER]` 思路）。
- **照片**：确认按 §图片需求 发两张猫照（橘猫侧身站立、美短正面抬头）后即可启动 Task 5 抠图；也可现在就发，我先把抠图管线跑通。

---

## 风险与备注

- **风格差异**：真实猫照片 vs 像素敌人有观感落差，属预期；统一像素化留作后期 polish。
- **rembg 联网**：权重下载可能受限，已备纯色背景兜底。
- **性能**：宠物弹/危害区并入既有数组（`PROJECTILE_CAP` / hazard 上限），不会无限增长。
- **平衡**：单只出战已限强度；若某猫过强/过弱，调 `PET_DEFS` 对应初值，真机校准。
- **多宠预留**：`pets[]` + `ownedPets` 已留接口，后续可加更多猫/狗。
