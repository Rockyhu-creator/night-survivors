# 永劫之鞭（eternalwhip）专属配色增强 · 视觉规格

> 范围：仅视觉（颜色 / 光效 / 粒子），不写游戏逻辑。落地由工程负责人按本规格在渲染层应用 `tint`。
> 关联神器：`eternalwhip`（baseWeapon: `whip`，效果：每 1.0s 三向 -20°/0/+20° 齐扫、width 70 vs 基础 44）。
> 关联文档：`src/weapons.js`、`src/systems.js`（`spawnSparks`）、`src/data.js`（神器定义）、`docs/architecture/loot-drop-fixes.md`（渲染盘点 §4）。

---

## 1. 现状盘点（已 grep 确认）

| 项 | 现状 | 位置 |
|---|---|---|
| 鞭身绘制方式 | **canvas `stroke`（二次贝塞尔曲线），非 sprite** | `weapons.js:608-648`（render 内 slash 循环） |
| 当前鞭身颜色 | **硬编码粉色**，无 `tint` 字段 | `weapons.js:634` `rgba(236,140,200,0.95)` / `rgba(200,90,165,0.85)`；尖端 `weapons.js:642` `rgba(255,224,246,0.95)` |
| slash 对象结构 | `{ x, y, ang, len, width, life, maxLife, bow }`，**无颜色字段** | `weapons.js:351` |
| `applyWhip` 调用方 | 基础鞭 `fire()`（`weapons.js:308`）+ 永劫之鞭 `updateArtifact`（`weapons.js:207`，三向循环）共用同一函数 | `weapons.js:326-352` |
| 命中火花 | **当前鞭身命中不 spawn 火花**（仅 `spawnDamageNumber('#c060a0')`） | `weapons.js:346` |
| `spawnSparks` API | `spawnSparks(x, y, color, count)`，存在且可用（单帧≤40、池≤300 粒子） | `systems.js:247-266` |

**结论 / 与任务假设的差异**：任务假设「颜色由 `tint` 字段控制」，但实际鞭身**当前无 `tint` 字段、颜色硬编码**。本规格定义 `tint` 配色对象并打通 `applyWhip → slash 对象 → render()` 链路；基础鞭保持原粉色（向后兼容），仅永劫之鞭注入新配色。

---

## 2. 配色方案：概念「熔金黑鞭 / 永劫熔火」

永劫之鞭是长鞭的进化形态，主题为「被永恒之火锻造、缠绕深渊的禁断之鞭」。在像素哥特体系内取 `gold #d4af37` / `ember #f1c40f` / `night #0d0b1a`，并以**近黑青铜描边（深渊边缘）**作为核心辨识点——这是 9 个神器均未使用近黑色描边的空白区，可一眼区分于基础鞭的粉色、圣光矩阵（matrix）的圣洁亮金、寂灭（sepulcher）/ 雷暴（tempest）/ 螺旋（spiral）的紫、猩红（crimson）的红、风暴（storm）/ 吞噬（devour）的青蓝。

### 2.1 色值表（hex + 渲染用 rgba）

| 角色 | 名称 | hex | 渲染用 rgba（含透明度） | 来源 |
|---|---|---|---|---|
| 鞭身主色（内半段核心能量） | 熔金琥珀 | `#ffb847` | `rgba(255,184,71,0.95)` | 体系内 ember/gold 的暖化衍生 |
| 鞭身边缘（外半段 / 描边） | 深渊青铜 | `#4a2f12` | `rgba(74,47,18,0.88)` | 体系内 night `#0d0b1a` + gold 合成的近黑青铜（**核心辨识点**） |
| 高光 / 尖端辉光 | 熔火白热（**+1 专属强调色**） | `#fff1c9` | `rgba(255,241,201,0.95)` | **本神器新增**，非体系原色 |
| 运动拖尾 / 挥砍残影（additive 光晕） | 鎏金残影 | `#d4af37` | `rgba(212,175,55,0.30)` | 体系内 gold |
| 命中火花（主） | 余烬金 | `#f1c40f` | —（`spawnSparks` 用 hex） | 体系内 ember |
| 命中火花（高光） | 熔火白热 | `#fff1c9` | — | 同 +1 强调色 |
| 伤害数字（对齐主题，可选） | 鎏金数字 | `#e0a93b` | — | 体系内 gold 暖化 |

> **+1 专属强调色 = `#fff1c9`（熔火白热）**：用于鞭身尖端辉光与命中火花高光，使整体呈现「被永恒之火锻白」的签名质感。stormcall 虽有黄白闪电（`#fff2a8`），但为冷调直闪、形态/温度不同，不与本色冲突。

### 2.2 调色理由（撞色校验）

- 避开 `#ff3b6b` 猩红（crimson）、`#c0392b/#e74c3c` 血色红 → 本方案非红。
- 避开 `#b07cff` 紫（sepulcher）、螺旋/雷暴紫 → 本方案非紫。
- 避开 `#5ad1e6` 青（storm）、`#4aa3df/#a8d8ff` 蓝（devour） → 本方案非青蓝。
- 与 matrix 圣洁亮金（`#ffd76a` 核心 / `#ffd24a` 阴影 / `#ffe6a0` 拖尾）拉开：本方案核心更饱和暖橙（`#ffb847`），且带**近黑青铜描边**，读作「禁断熔金」而非「圣洁之光」。
- 与基础鞭粉色（`rgba(236,140,200,…)`）完全异色，进化对比清晰。

---

## 3. 渲染层应用点（工程落地指引）

### 3.1 `applyWhip` 增加可选 `tint` 参数，并透传到 slash 对象

文件：`src/weapons.js:326`（签名）与 `:351`（push）。

```js
// 签名新增第 5 参 tint（神器配色对象），基础鞭不传
applyWhip(player, ang, s, hitSet, tint) {
  // ...命中结算（保持原逻辑）...
  // 命中处新增：仅当 tint 存在才 spawn 火花（基础鞭不受影响）
  if (tint) {
    game.fx.spawnSparks(e.x, e.y, tint.spark, 6);
    game.fx.spawnSparks(e.x, e.y, tint.sparkHot, 3);
  }
  // 伤害数字：有 tint 时用 tint.dmg 对齐主题，否则保持原 #c060a0
  game.fx.spawnDamageNumber(e.x, e.y - e.radius,
    Math.round(s.damage * player.damageMul),
    tint ? tint.dmg : '#c060a0');

  // push 时带上 tint（无则 undefined，render 走旧粉色分支）
  this.slashes.push({
    x: player.x, y: player.y, ang, len,
    width: s.width || 44, life: 0.22, maxLife: 0.22,
    bow: (Math.random() < 0.5 ? -1 : 1),
    tint,               // ← 新增
  });
}
```

### 3.2 两处调用方传入 tint

- 基础鞭（`weapons.js:308`）：保持 `this.applyWhip(player, ang, s, new Set())` —— **不传 tint**，沿用旧粉色（向后兼容）。
- 永劫之鞭（`weapons.js:207` 三向循环）：改为传入配色对象：

```js
for (const off of [-0.35, 0, 0.35]) {
  this.applyWhip(player, base + off,
    { damage: 30, length: 300, width: 70 }, new Set(), ETERNALWHIP_TINT);
}
```

`ETERNALWHIP_TINT` 建议定义于 `weapons.js` 顶部（或 `data.js` 神器条目内），结构：

```js
const ETERNALWHIP_TINT = {
  bodyCore: 'rgba(255,184,71,0.95)',  // #ffb847
  bodyEdge: 'rgba(74,47,18,0.88)',    // #4a2f12
  tip:      'rgba(255,241,201,0.95)', // #fff1c9  (+1 专属强调色)
  glow:     'rgba(212,175,55,0.30)',  // #d4af37  additive 残影/光晕
  spark:    '#f1c40f',                // 命中火花主
  sparkHot: '#fff1c9',                // 命中火花高光
  dmg:      '#e0a93b',                // 伤害数字（可选）
};
```

### 3.3 `render()` slash 循环改为 tint 感知

文件：`src/weapons.js:616-648`。规则：**有 `sl.tint` 用新配色（含 additive 残影光晕）；无 `sl.tint` 保持现硬编码粉色**（见 3.1 说明，确保基础鞭不变）。

```js
for (const sl of this.slashes) {
  const a = sl.life / sl.maxLife;
  const t = 1 - a;
  const grow = Math.min(1, t * 5);
  const fade = a;
  ctx.save();
  ctx.translate(sl.x - cam.ox, sl.y - cam.oy);
  ctx.rotate(sl.ang);
  const tipX = sl.len * grow;
  const bow = Math.sin(t * Math.PI) * sl.width * 0.55 * (sl.bow || 1);
  ctx.lineCap = 'round';
  const N = 16;

  // —— 新增：additive 残影光晕（仅 eternalwhip）——
  if (sl.tint) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = fade * 0.30;
    ctx.strokeStyle = sl.tint.glow;
    ctx.lineWidth = sl.width * 1.8;
    const c = qbez(0, 0, tipX * 0.5, bow, tipX, 0, 0.5); // 中线近似
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.quadraticCurveTo(tipX * 0.5, bow, tipX, 0);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }

  for (let i = 0; i < N; i += 1) {
    const u0 = i / N, u1 = (i + 1) / N;
    const p0 = qbez(0, 0, tipX * 0.5, bow, tipX, 0, u0);
    const p1 = qbez(0, 0, tipX * 0.5, bow, tipX, 0, u1);
    ctx.lineWidth = Math.max(1, sl.width * (1 - 0.82 * u0));
    ctx.globalAlpha = fade * (0.95 - u0 * 0.35);
    // —— 改：tint 优先，否则旧粉色 ——
    ctx.strokeStyle = sl.tint
      ? (i < N * 0.5 ? sl.tint.bodyCore : sl.tint.bodyEdge)
      : (i < N * 0.5 ? 'rgba(236,140,200,0.95)' : 'rgba(200,90,165,0.85)');
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }

  if (grow >= 0.96) {
    ctx.globalAlpha = fade * 0.9;
    // —— 改：tint 用白热尖端，否则旧粉色尖端 ——
    ctx.fillStyle = sl.tint ? sl.tint.tip : 'rgba(255,224,246,0.95)';
    ctx.beginPath();
    ctx.arc(tipX, 0, 3 + (1 - fade) * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
```

---

## 4. 是否需要新 PNG 资源

**不需要新 PNG。**

- 鞭身 slash 为纯 canvas `stroke`（二次贝塞尔），无 sprite 引用（render 内不读 `sprite('whip')`）。增强仅凭 `tint` 配色对象 + 新增 additive 残影光晕即可，零新增位图。
- `assets.js` **无需改动**，无新增映射。
- 若未来希望鞭身带「锻造纹理 / 能量裂纹」贴图：建议用**程序化生成函数**（基于本配色做 emissive 噪声纹理，非 AI、避开 `AI_OWNED`），作为可选后续，不在本论范围。

---

## 5. 与现有视觉系统对齐说明

- 体系色复用：`gold #d4af37`（残影）、`ember #f1c40f`（火花）、`night #0d0b1a`（深渊青铜边缘来源）；`+1` 专属色 `#fff1c9`（熔火白热）为唯一新增。
- 渲染范式一致：与 matrix 神器（`weapons.js:693-720`）同为「additive 光晕 + 专属 tint + 更强辉光」的观感增强手法，工程实现风格统一。
- 向后兼容：基础鞭（粉色）与所有其他神器 tint 均不受影响；改动严格 gate 在 `sl.tint` 存在性上。
- 性能：additive 残影为单条宽 stroke（每 slash 1 次 draw），命中火花复用现有 `spawnSparks` 上限（单帧≤40、池≤300），无新性能风险。

---

## 6. 落地检查清单（工程自测）

- [ ] `applyWhip` 第 5 参 `tint` 透传至 slash 对象。
- [ ] 基础鞭（`fire()`）调用仍不传 tint → 观察仍为粉色，无回归。
- [ ] 永劫之鞭三向调用传入 `ETERNALWHIP_TINT` → 鞭身呈熔金琥珀 + 深渊青铜边缘 + 白热尖端。
- [ ] 残影光晕（additive，gold）在挥砍时可见。
- [ ] 命中时 spawn 6×`#f1c40f` + 3×`#fff1c9` 火花；基础鞭命中无火花（保持原状）。
- [ ] 无新增 PNG / 无 `assets.js` 改动。
- [ ] 撞色复核：与 crimson 红 / sepulcher·tempest·spiral 紫 / storm·devour 青蓝 / matrix 亮金 均可辨识区分。

---

*本规格仅描述视觉表现与渲染层应用点，不含任何游戏逻辑数值改动。所有数值（damage/width/三向角度）维持 `data.js` 既有定义。*
