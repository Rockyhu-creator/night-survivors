# 战利品指引与宝箱视觉规格 · Loot & Chest Visual Spec

> 项目：夜裔幸存者（Night Survivors）  
> 日期：2026-07-26  
> 负责人：美术负责人（art-director）  
> 范围：仅视觉规格与程序化资产落地，不写游戏逻辑  

## 一、任务总览

| 任务 | 结论 | 落地资产/改动 |
|------|------|---------------|
| ① 宝箱指示箭头新样式 | **采用方案 B（PNG 精灵）** | 新增 `public/assets/loot_arrow.png`；`gen_assets.py` 新增 `gen_loot_arrow()`；`src/assets.js` 新增 `lootArrow` 映射 |
| ② 宝箱 chest icon 重做 | 已重做 | 重生成 `public/assets/chest.png`；`gen_assets.py` 重写 `gen_chest()` |
| ③ 红色高级宝石 gemRed 视觉确认/增强 | **决定增强**（同步增强 gemGold） | 重生成 `public/assets/gem_red.png`、`gem_gold.png`；`gen_assets.py` 新增 `gen_gem_premium()` 并在高价值宝石处调用 |

---

## 二、任务 1：宝箱指示箭头新样式

### 2.1 现状问题

- `#loot-arrow` 为纯 CSS `border-left` 三角形，默认向右。
- 方向感弱：玩家难以快速判断宝箱在“哪个方向”。
- 与怪物重叠时仅靠 drop-shadow 区分，辨识度不足。
- 无法做像素风尾翼/羽毛等哥特细节。

### 2.2 方案 A：纯 CSS 改进（备用）

保留现有 `transform: rotate(angle)` 机制，`ui.js` 角度计算无需改动，仅改 `#loot-arrow` 外观：

```css
#loot-arrow {
  position: absolute;
  width: 0;
  height: 0;
  border-left: 18px solid var(--gold);
  border-top: 12px solid transparent;
  border-bottom: 12px solid transparent;
  transform-origin: 50% 50%;
  filter:
    drop-shadow(0 0 6px rgba(212, 175, 55, .95))
    drop-shadow(0 0 2px rgba(241, 196, 15, .8));
}

/* 尾翼：用 ::before 做分裂羽毛感 */
#loot-arrow::before {
  content: '';
  position: absolute;
  left: -26px;
  top: -8px;
  width: 0;
  height: 0;
  border-right: 10px solid var(--gold);
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
  opacity: .75;
  filter: drop-shadow(0 0 2px rgba(212, 175, 55, .7));
}

/* 额外辉光层 */
#loot-arrow::after {
  content: '';
  position: absolute;
  left: -30px;
  top: -2px;
  width: 8px;
  height: 4px;
  background: var(--ember);
  border-radius: 0;
  opacity: .6;
  box-shadow: 0 0 6px var(--ember);
}

@media (prefers-reduced-motion: reduce) {
  #loot-arrow { filter: none; } /* 简化运动敏感用户的辉光动画 */
}
```

**评价**：CSS 三角形本质仍是位图模拟，难以表达像素哥特风的羽尾、锁链或金属质感；缩放后边缘发虚。仅作为 fallback。

### 2.3 方案 B：PNG 精灵（推荐并已落地）

**推荐理由**：

1. 像素风箭头可精确绘制尾翼、锥形头部、金属高光，方向感极强。
2. 与游戏内其他精灵（chest、gem、武器）统一为程序化像素资产，视觉语言一致。
3. `ui.js` 只需把 `border` 元素换成 `<img>` 或 `background-image`，`transform: rotate(angle)` 机制完全保留。
4. 发光通过 CSS `filter: drop-shadow()` 实现，无需在精灵里画发光，方便调参。

**资产规格**：

| 项 | 规格 |
|----|------|
| 文件名 | `public/assets/loot_arrow.png` |
| 尺寸 | 32 × 32 px |
| 格式 | 透明 PNG（由 `gen_assets.py` 程序化生成） |
| 默认朝向 | 右方（0°），旋转中心为画布中心 `(16,16)` |
| 主色 | `#d4af37` gold |
| 高光 | `#f1c40f` ember |
| 尾翼深色 | `#9e7e1f` |
| 描边 | 由 `save()` 自动添加 1px 深色像素描边 `(8,4,14)` |
| AI 管线 | 不在 `AI_OWNED` 列表，可安全程序化生成 |

**生成函数**：`gen_assets.py` 新增 `gen_loot_arrow()`（已落地）。

**映射**：`src/assets.js` 新增：

```js
lootArrow: 'loot_arrow.png',
```

**UI 接入建议**（供工程负责人参考，不修改 `ui.js`）：

```html
<!-- index.html 中 #loot-arrow 改为 img -->
<img id="loot-arrow" src="/assets/loot_arrow.png" alt="" aria-hidden="true">
```

```css
#loot-arrow {
  position: absolute;
  width: 32px;
  height: 32px;
  transform-origin: 50% 50%;
  filter:
    drop-shadow(0 0 5px rgba(212, 175, 55, .95))
    drop-shadow(0 0 2px rgba(241, 196, 15, .7));
  image-rendering: pixelated;
}

@media (prefers-reduced-motion: reduce) {
  #loot-ring { animation: none; }
  #loot-arrow { filter: none; }
}
```

> `ui.js` 中的角度计算 `Math.atan2(dy, dx) * 180 / Math.PI` 与 `transform: rotate(angle)` 继续生效。

---

## 三、任务 2：宝箱 chest icon 重做

### 3.1 设计目标

- 更精致的像素哥特木箱：深色木纹、金属包边、铆钉、角铁。
- 正面锁扣 + 钥匙孔，强化“未开启宝箱”的识别。
- 锁扣周围添加金色微光封印，呼应 Boss 宝箱进化神器的设定。
- 保持文件名 `chest.png` 不变，`src/assets.js` 中 `chest: 'chest.png'` 无需改动。

### 3.2 资产规格

| 项 | 规格 |
|----|------|
| 文件名 | `public/assets/chest.png` |
| 尺寸 | 44 × 44 px |
| 格式 | 透明 PNG |
| 调色 | 深木色 `#4c2e1a` / `#744a2a` / `#a47044`；金色 `#d4af37` / `#f1c40f`；锁孔 `#1c1816` |
| 描边 | 1px 深色像素描边（由 `save()` 自动添加） |
| AI 管线 | 不在 `AI_OWNED` 列表，可安全重生成 |

### 3.3 视觉元素拆解

1. **箱体木板**：竖向拼接，深浅交替，模拟木纹。
2. **弧形箱盖**：与箱体同色木板，顶部加暗金包边。
3. **金属包边**：左右两条金色竖带 + 上下两条横带，带铆钉。
4. **角铁**：上下四角深色金加固件。
5. **锁扣面板**：正面中央偏右的金色矩形面板，内嵌黑色钥匙孔。
6. **金光封印**：锁扣上下左右 4 点 ember 微光，暗示神器封印。

### 3.4 实现位置

- `gen_assets.py`：`gen_chest()` 函数已重写（第 1247 行起）。
- 调用点：`gen_chest()` 仍在模块级调度区执行（第 1551 行附近）。

---

## 四、任务 3：红色高级宝石 gemRed 视觉确认/增强

### 4.1 现有评估

- 现有 `gem_red.png`（v0.34）为 72×72 菱形红宝石，刻面清晰，但：
  - 与低档 `gem_small/medium/large` 造型完全一致，仅颜色不同。
  - 在怪潮中不够醒目，难以一眼识别为“高价值掉落”。
  - 缺乏“高级/稀有”的视觉符号（如星芒、辉光）。

### 4.2 结论：增强（同步增强 gemGold）

- `gemRed` 与 `gemGold` 均对应高价值经验掉落（暗影猎手/石像鬼/终局召唤）。
- 二者需要在怪群中明显区分于绿/蓝/紫低档宝石。
- 因此同步将 `gem_gold.png`、`gem_red.png` 升级为 premium 版本。

### 4.3 增强策略

1. **保留菱形刻面**：维持宝石家族统一识别。
2. **更强内核辉光**：中心高光范围缩小、亮度提升。
3. **四角星芒**：在宝石上下左右添加 ember 色小十字星，作为“高级掉落”的视觉标签。
4. **描边不变**：仍由 `save()` 自动添加深色像素描边，保持像素风。

### 4.4 资产规格

| 项 | gemGold | gemRed |
|----|---------|--------|
| 文件名 | `public/assets/gem_gold.png` | `public/assets/gem_red.png` |
| 尺寸 | 72 × 72 px（S=36, scale=2） | 72 × 72 px |
| 主色 | `#d4af37` | `#e74c3c` |
| 高光 | `#ffe696` | `#ff968c` |
| 暗部 | `#966e14` | `#961e19` |
| 识别特征 | 四角星芒 + 亮核 | 四角星芒 + 亮核 |
| AI 管线 | 均不在 `AI_OWNED` | 均不在 `AI_OWNED` |

### 4.5 实现位置

- `gen_assets.py` 新增 `gen_gem_premium(name, base, light, dark)`（第 478 行起）。
- 调度区调用：
  - `gen_gem_premium("gem_gold.png", ...)`
  - `gen_gem_premium("gem_red.png", ...)`
- 低档绿/蓝/紫宝石仍使用原 `gen_gem()`，避免过度设计。

---

## 五、命名与映射规范

| 语义 | 文件名 | assets.js 键 | CSS ID/Class | 备注 |
|------|--------|--------------|--------------|------|
| 宝箱精灵 | `chest.png` | `chest` | — | 文件名不变 |
| 宝箱方向箭头 | `loot_arrow.png` | `lootArrow` | `#loot-arrow` | 新增 PNG 精灵 |
| 红宝石 | `gem_red.png` | `gemRed`（运行时映射） | — | 已由 `GEM_DEFS` 定义 |
| 金宝石 | `gem_gold.png` | `gemGold`（运行时映射） | — | 同步增强 |
| 战利品容器 | — | — | `#loot-beacon` | 已有 |
| 脉冲环 | — | — | `#loot-ring` | 已有，动画保留 |
| 标签 | — | — | `#loot-label` | 已有 |

**命名约定**：

- 精灵文件名使用 `snake_case`：`loot_arrow.png`、`gem_red.png`。
- `assets.js` 键使用 `camelCase`：`lootArrow`。
- 不修改现有 `chest` 映射，避免工程侧引用断裂。

---

## 六、与现有视觉系统对齐

1. **调色板**：全部使用项目既定色值：
   - gold `#d4af37`、ember `#f1c40f`
   - 深蓝紫底 `#0d0b1a`（由场景/透明背景自然呈现）
   - 血色红 `#e74c3c` / `#c0392b`
   - 未引入任何新色。
2. **像素风**：所有资产均为程序化像素绘制，`image-rendering: pixelated` 友好。
3. **哥特细节**：宝箱金属包边/铆钉/锁扣、箭头分裂尾翼，均符合哥特装备美学。
4. **发光表达**：通过 CSS `drop-shadow` 与精灵内高光共同实现，与现有 `#loot-ring`、`.gothic-btn` 发光语言一致。
5. **可访问性**：
   - 箭头方向性不依赖颜色，依赖形状。
   - `prefers-reduced-motion` 下关闭 `#loot-ring` 动画与箭头辉光（方案 B）。
   - 高价值宝石通过星芒形状 + 颜色共同区分，辅助色盲玩家识别。

---

## 七、落地改动清单

### 7.1 已修改文件

- `gen_assets.py`
  - 重写 `gen_chest()` → 输出 `chest.png`
  - 新增 `gen_loot_arrow()` → 输出 `loot_arrow.png`
  - 新增 `gen_gem_premium()` → 输出 `gem_gold.png`、`gem_red.png`
  - 调度区新增 `gen_loot_arrow()` 调用
  - 调度区 `gem_gold.png`、`gem_red.png` 改用 `gen_gem_premium()`
- `src/assets.js`
  - 新增 `lootArrow: 'loot_arrow.png'` 映射

### 7.2 已生成/变更资产

- `public/assets/chest.png`（重做）
- `public/assets/loot_arrow.png`（新增）
- `public/assets/gem_gold.png`（增强）
- `public/assets/gem_red.png`（增强）

### 7.3 未改动文件（红线）

- 未触碰 `AI_OWNED` 列表中的 15 张图。
- 未修改 `ui.js` / `systems.js` / `index.html` / `style.css` 中的游戏逻辑。
- 未触碰 `localStorage`。

---

## 八、工程接入提示（供主理人/工程负责人）

- 方案 B 箭头需要在 `index.html` 中将 `#loot-arrow` 容器改为 `<img>`，或在 `ui.js` 中改用 `backgroundImage`。
- `ui.js` 的旋转与定位逻辑完全保留，无需重新计算角度。
- 如需调整箭头大小，改 CSS `width/height` 即可（建议保持 32px 或 2 的整数倍以保持像素清晰）。
- 宝箱与宝石的 pickup 尺寸由 `GEM_DEFS` / 游戏逻辑控制，资产尺寸不变，无需工程侧调整。

---

## 九、验证结果

生成前后对 `public/assets/*.png` 做了全量 `md5` 对比：

```diff
- MD5 (public/assets/chest.png)     = b135f0268491f932cd501ddf74397e53
+ MD5 (public/assets/chest.png)     = 6f5393f52e98b14703e6607bed5fb004
- MD5 (public/assets/gem_gold.png)  = 5dbad77d47a7520a970da97927ec390d
+ MD5 (public/assets/gem_gold.png)  = 598576ac288e7ccc8b6fc64d2034fea6
- MD5 (public/assets/gem_red.png)   = 5bc90b34d95fb4a1d7e9032865ed0583
+ MD5 (public/assets/gem_red.png)   = 6aabcd73a709d9821dc84174b48cff06
+ MD5 (public/assets/loot_arrow.png)= ffb834c03644fe8b600239727daeb5b1
```

- **仅 4 个文件发生变更**：`chest.png`（重做）、`gem_gold.png`（增强）、`gem_red.png`（增强）、`loot_arrow.png`（新增）。
- **其余 71 张 PNG 字节一致**，包括 `AI_OWNED` 列表中的 15 张图，未越红线。
- 生成命令：`/Users/a34481/.workbuddy/binaries/python/envs/default/bin/python gen_assets.py`
