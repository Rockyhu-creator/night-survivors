# 技能树视觉规格 —— `skilltree_menu.png` + 节点绘制规范

> - **Task ID**：ART-SKILLTREE-ICONS-01
> - **负责人**：林绘澄（美术方向 / 技术美术）
> - **日期**：2026-07-29
> - **范围**：仅出视觉规格与资产命名；不改动 `src/` 游戏逻辑代码
> - **对应设计文档**：`docs/plans/2026-07-28-skilltree-design-proposal.md` §3.4

---

## 0. 上下文与约束

### 0.1 视觉现状（务必对齐）

- 项目基调：**哥特暗色 + 灵魂紫金**，像素风（pixel art / 程序化生成）。
- 标题屏菜单按钮结构（`index.html` `.title-btns`）：每个按钮为 `.gothic-btn.ghost.menu-btn`，内部含 `.menu-btn-icon` `<img>`。
- 已有入口图标：
  - `altar_menu.png`：阶梯石台 + 悬浮灵魂火（祭坛）。
  - `codex_menu.png`：摊开魔典 + 发光窥视之眼（图鉴）。
- 新技能树按钮将沿用同一结构，图标文件名固定为 `skilltree_menu.png`。

### 0.2 管线约束

- `gen_assets.py` 在模块加载时**全量重绘** `public/assets/*`，并通过 `AI_OWNED` 集合跳过 AI 独占资产。
- `gen_assets.sh`（文生图）已降级，**不要**用它生成新图标。
- 当前最稳的像素图标生成路径：`gen_passive_pixels.py`（AI 原图 → 众数色键控 → 裁 bbox → LANCZOS 缩 40 网格 → NEAREST 2x → 描边 → 80×80）。
- **红线**：任何非由 `gen_assets.py` 自身函数生成、而是外部落盘的图标 PNG，必须加入 `gen_assets.py` 顶部 `AI_OWNED`，否则会被静默覆盖。

---

## 1. 技能树入口图标 `skilltree_menu.png`

### 1.1 母题与构图

**核心识别目标**：一眼可辨为「技能树 / 成长网络」，且**清晰区别于**左侧祭坛（石台+火）与右侧图鉴（书本+眼）。

**选定母题**：**「符文枝 lattice」**——一株从底部向上升展的 stylized 分枝树，主干分出左右主枝与子枝，枝杈交点及末端镶嵌金色符文节点，暗示「节点-连线」网络。整体造型偏竖向，重心居中，剪影为树形/星座形，不含书本、眼睛、火焰、武器等易混淆元素。

**构图要点（40×40 画布坐标系，最终 80×80）**：

| 元素 | 位置 / 形状 | 作用 |
|---|---|---|
| 根基 | 底部中心小梯形（y≈33-36） | 稳定重心，暗示「生长之根」 |
| 主干 | 自 y≈33 竖直上升至 y≈20 | 视觉主轴 |
| 主分裂节点 | 中心 (cx,20)，最大符文节点 | 技能树「根节点」语义 |
| 左/右主枝 | 从中心分别向左上、右上延伸 | 形成树冠状 |
| 子枝 | 从主枝中段再分出短枝 | 增加网络感 |
| 末端节点 | 5-6 个小圆点分布于枝尖 | 「可点节点」语义 |
| 金色星座点 | 沿枝稀疏点缀 | 强化「连线/星座」感 |

### 1.2 配色

沿用项目共享调色板（与 `docs/art/codex-icon-specs.md` 一致）：

| 用途 | 色名 | RGBA | Hex |
|---|---|---|---|
| 树枝暗部 | soul purple dark | `(60, 40, 120, 255)` | `#3c2878` |
| 树枝主体 | soul purple mid | `(107, 63, 160, 255)` | `#6b3fa0` |
| 树枝亮部 / 节点外圈 | soul purple light | `(150, 90, 255, 255)` | `#965aff` |
| 节点高光 / 星座点 | soul purple hi | `(210, 170, 255, 255)` | `#d2aaff` |
| 节点核心 / 描边 | gold dark | `(150, 120, 35, 255)` | `#967823` |
| 节点核心 / 枝 highlights | gold mid | `(212, 175, 55, 255)` | `#d4af37` |
| 节点中心高光 | gold light | `(255, 230, 140, 255)` | `#ffe68c` |
| 统一暗描边 | outline | `(8, 4, 14, 255)` | `#08040e` |
| 背景 | transparent | `(0, 0, 0, 0)` | — |

> 与现有 `altar_menu.png`（石台+蓝紫火）、`codex_menu.png`（青书+青白眼）相比，本图标以**紫+金**为主，无石台、无书页、无眼睛，识别差异足够。

### 1.3 尺寸与格式

- **文件名**：`public/assets/skilltree_menu.png`
- **画布**：40 × 40 像素，程序化绘制后 `outline()` + `NEAREST` 放大 2× → **80 × 80 PNG**。
- **透明背景**，1 px 暗描边 `(8,4,14)`。
- **压缩**：`compress_level=9`（与 `gen_assets.py` / `gen_passive_pixels.py` 一致）。
- **CSS 显示**：通过 `image-rendering: pixelated` 缩放显示，与现有 `menu-btn-icon` 同尺寸感知。

### 1.4 文件名与 AI_OWNED

- 该图标文件必须加入 `gen_assets.py` 顶部 `AI_OWNED` 集合，防止被全量生成器覆盖。
- **需加入 AI_OWNED 的文件名**：

```python
"skilltree_menu.png",
```

> 若未来改由 `gen_assets.py` 内置 `gen_skilltree_menu()` 函数程序化输出，则应**从 `AI_OWNED` 移除**，让 `save()` 正常写出。当前版本以外部落盘为主，故加入 `AI_OWNED`。

### 1.5 ImageGen Prompt（直接可用）

```text
A pixel art UI icon for a dark fantasy skill tree, 80x80 pixels, transparent background. Centered stylized bare tree / runic branching lattice in deep soul purple (#6b3fa0) with dark gold (#c9a227) glowing rune nodes at branch tips and joints. Gothic 16-bit retro pixel art style, clean silhouette, high contrast, no text, no face, no book, no eye, no flame. Dark void background, subject perfectly centered, chunky pixels, 1px dark outline implied.
```

> 如通过 `gen_passive_pixels.py` 管线生产，将原图放入 `.ai_passive_raw/skilltree_menu/` 并扩展 `IDS` 即可。

### 1.6 Pillow 程序化生成配方（降级 / 主程直接执行）

以下为可直接运行的 Python 脚本，**不依赖 AI**，输出即最终 `public/assets/skilltree_menu.png`。风格与现有 `altar_menu.png` / `codex_menu.png` 同调。

```python
#!/usr/bin/env python3
# gen_skilltree_menu.py — 技能树入口图标程序化生成
from PIL import Image, ImageDraw

TRANSPARENT = (0, 0, 0, 0)
OUTLINE = (8, 4, 14, 255)

SOUL = {
    'dark':  (60, 40, 120, 255),
    'mid':   (107, 63, 160, 255),
    'light': (150, 90, 255, 255),
    'hi':    (210, 170, 255, 255),
}
GOLD = {
    'dark':  (150, 120, 35, 255),
    'mid':   (212, 175, 55, 255),
    'light': (255, 230, 140, 255),
}

def new_canvas(w, h=None):
    h = h or w
    return Image.new('RGBA', (w, h), TRANSPARENT)

def px(draw, x, y, color):
    try:
        draw.point((x, y), fill=color)
    except Exception:
        pass

def line(draw, x0, y0, x1, y1, color):
    """Bresenham 1px 像素线。"""
    dx, dy = abs(x1 - x0), abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx - dy
    while True:
        px(draw, x0, y0, color)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 > -dy:
            err -= dy
            x0 += sx
        if e2 < dx:
            err += dx
            y0 += sy

def circle(draw, cx, cy, r, color):
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.5:
                px(draw, x, y, color)

def outline(img, color=OUTLINE):
    """给非透明像素描 1px 深色轮廓（与 gen_assets.py 一致）。"""
    src = img.load()
    w, h = img.size
    out = Image.new('RGBA', (w, h), TRANSPARENT)
    dst = out.load()
    for y in range(h):
        for x in range(w):
            if src[x, y][3] > 0:
                dst[x, y] = src[x, y]
    for y in range(h):
        for x in range(w):
            if src[x, y][3] == 0:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and src[nx, ny][3] > 0:
                        dst[x, y] = color
                        break
    return out

def gen_skilltree_menu():
    S = 40
    img = new_canvas(S)
    d = ImageDraw.Draw(img)
    cx = cy = 20

    # 1. 根基（底部小梯形）
    for y in range(33, 37):
        w = 4 - (y - 33)
        for x in range(cx - w, cx + w + 1):
            px(d, x, y, SOUL['dark'])

    # 2. 主干（3px 宽，左亮右暗）
    for y in range(20, 33):
        px(d, cx, y, SOUL['mid'])
        px(d, cx - 1, y, SOUL['dark'])
        px(d, cx + 1, y, SOUL['dark'])

    # 3. 主分裂节点（最大符文节点）
    circle(d, cx, 20, 2, SOUL['light'])
    circle(d, cx, 20, 1, GOLD['mid'])
    px(d, cx, 20, GOLD['light'])

    # 4. 主枝与子枝
    branches = [
        ((cx, 20), (11, 12), SOUL['mid']),
        ((cx, 20), (29, 12), SOUL['mid']),
        ((15, 16), (8, 9), SOUL['light']),
        ((25, 16), (32, 9), SOUL['light']),
    ]
    for (x0, y0), (x1, y1), col in branches:
        line(d, x0, y0, x1, y1, col)

    # 5. 末端节点 + 根节点
    nodes = [(cx, 33), (11, 12), (29, 12), (8, 9), (32, 9)]
    for nx, ny in nodes:
        circle(d, nx, ny, 2, SOUL['light'])
        circle(d, nx, ny, 1, GOLD['mid'])
        px(d, nx, ny, GOLD['light'])

    # 6. 金色星座点（沿枝点缀，强化网络感）
    dots = [(20, 26), (14, 14), (26, 14), (10, 10), (30, 10)]
    for x, y in dots:
        px(d, x, y, GOLD['light'])

    # 7. 描边 + 2x 最近邻放大
    img = outline(img)
    img = img.resize((80, 80), Image.NEAREST)
    img.save('public/assets/skilltree_menu.png', compress_level=9)
    print('OK skilltree_menu.png')

if __name__ == '__main__':
    gen_skilltree_menu()
```

**运行方式**：

```bash
python3 gen_skilltree_menu.py
```

---

## 2. 树内节点 Canvas2D 绘制规范

技能树在 Canvas2D 上绘制，节点**不依赖 PNG**，全部用几何图形 + 描边 + 合成实现。

### 2.1 节点类型与形状

| 类型 | 形状 | 尺寸（参考 1920×1080 画布，按树缩放系数调整） | 绘制要点 |
|---|---|---|---|
| `stat` | **实心圆** | 半径 r = 10 px | fill = 分支 mid；stroke = 分支 dark，2 px |
| `modifier` | **方角块** | 边长 18 px | fill = 分支 mid；stroke = 分支 dark，2 px；四角可切 3 px 倒角 |
| `keystone` | **正六边形** | 外接圆半径 r = 12 px | fill = 分支 dark；stroke = **金色** `#c9a227`，3 px；背后加 `lighter` 合成辉光 |
| `gate` | **虚线环** | 半径 r = 14 px | stroke = 分支 light，2 px，`setLineDash([6, 4])`；中心可留白或加分支小徽记 |

**统一描边**：所有节点统一 2 px 深色描边 `(8,4,14)`，落在金色/亮色 stroke 外侧，保证在暗背景上清晰。

### 2.2 分支主色板

从灵魂紫金基调派生 5 个可区分色相，与现有图鉴/祭坛/武器色系不冲突：

| 分支 id | 分支名 | 主色 mid | 暗色 dark | 亮色 light | 色相关键词 |
|---|---|---|---|---|---|
| `war` | 征伐 | `#b03040` `(176,48,64)` | `#701a26` `(112,26,38)` | `#e06070` `(224,96,112)` | 血红 / 武器伤害 |
| `bly` | 血裔协同 | `#8a3fa0` `(138,63,160)` | `#522660` `(82,38,96)` | `#c080e0` `(192,128,224)` | 灵魂紫 / 血脉 |
| `nfr` | 永夜抗性 | `#3f4a9e` `(63,74,158)` | `#242a5c` `(36,42,92)` | `#6e7ed6` `(110,126,214)` | 夜蓝 / 防御 |
| `eco` | 灵魂经济 | `#c9a227` `(201,162,39)` | `#8a6f1a` `(138,111,26)` | `#f0d060` `(240,208,96)` | 暗金 / 灵魂 |
| `utl` | 通用机能 | `#3fa088` `(63,160,136)` | `#266652` `(38,102,82)` | `#6ed4b8` `(110,212,184)` | 青绿 / 机能 |

> 所有颜色在锁定态统一去饱和为灰阶（见 2.3）。

### 2.3 三态视觉

| 状态 | 视觉处理 | 动画 |
|---|---|---|
| **已解锁 unlocked** | 使用分支完整色板；节点实心；连线实线 100% 不透明度 | 无脉冲，保持静态 |
| **可解锁 available**（满足前置 + 灵魂足够） | 在解锁态基础上：节点 scale 做正弦脉冲 `1.0 → 1.08 → 1.0`，周期 ~1.2 s；stroke 亮度 +15%；末端节点加轻微金色星点 | 脉冲缩放 + 柔和辉光呼吸 |
| **锁定 locked** | 整体去饱和为灰阶（建议 `filter: grayscale(0.85)` 或手动换算），不透明度 55%；连线虚线或半透明 | 无动画；hover 时显示锁定原因提示 |

**灰阶换算（手动 fallback）**：`gray = R*0.299 + G*0.587 + B*0.114`。

### 2.4 连线样式

- **形状**：二次贝塞尔曲线（quadratic Bézier），控制点取父子节点中点并略向上/外偏移，营造自然生长弧线。
- **样式**：
  - 已解锁路径：实线，2 px，子节点分支色，不透明度 1.0。
  - 可解锁路径：实线，2 px，子节点分支色，不透明度 0.85，可叠加细脉冲。
  - 锁定路径：虚线 `setLineDash([4, 4])`，2 px，灰紫色 `(80,80,100)`，不透明度 0.4。
- **层级**：连线在节点下层绘制，避免遮挡节点。

示例 Canvas2D 绘制片段：

```js
function drawBranchLink(ctx, parent, child, state) {
  const mx = (parent.x + child.x) / 2;
  const my = (parent.y + child.y) / 2 - 24; // 控制点外偏
  ctx.beginPath();
  ctx.moveTo(parent.x, parent.y);
  ctx.quadraticCurveTo(mx, my, child.x, child.y);
  if (state === 'locked') {
    ctx.strokeStyle = 'rgba(80,80,100,0.4)';
    ctx.setLineDash([4, 4]);
  } else {
    ctx.strokeStyle = child.branchColor;
    ctx.globalAlpha = state === 'available' ? 0.85 : 1.0;
    ctx.setLineDash([]);
  }
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.globalAlpha = 1.0;
  ctx.setLineDash([]);
}
```

### 2.5 热区与点击反馈

- **热区半径**：节点几何半径 + 6 px 缓冲，最小 18 px，优先保证移动端可点。
- **Hover / 按下**：
  - 节点 scale +10%，亮度 +15%。
  - 显示金色描边高亮（`#d4af37`）。
  - 可解锁态触发详情卡；锁定态显示「锁定原因」浮层。
- **点击音效 / 震动**：由文策渊/程基岩按 UX 规范接入，本规格不展开。

### 2.6 详情卡视觉建议

- **面板**：暗石色背景 `rgba(24,22,34,0.95)`，1 px 金色边框 `#d4af37`，圆角 6 px（或项目惯用的尖角 Gothic 风格）。
- **标题**：节点名，金色 `#ffe68c`，16 px 像素字体。
- **效果文本**：骨白色 `#e9e3ce`。
- **成本**：灵魂图标（复用 `gem_gold.png` 或绘制小灵魂火）+ 数字，可解锁为金色，不足为暗红。
- **前置 / 锁定原因**：灰色 `#a0a0b0`，带小图标分隔。
- **定位**：优先显示在节点右下方，边界检测避免超出画布。

---

## 3. 无障碍 / 可访问性

### 3.1 图标可辨识度

- `skilltree_menu.png` 必须在以下背景下保持 ≥ 3:1 对比（金色节点 / 紫色枝干 vs 背景）：
  - 标题屏深色背景 `#0d0b14`
  - 菜单按钮 hover 态 `#1a1525`
  - 高对比模式纯黑 `#000000`
- 依靠 **1 px 深色描边** 和金色节点高亮，确保在纯色背景下仍有清晰剪影。
- 避免细线宽于 1 px（画布级），放大后仍保持可读。

### 3.2 节点类型多重编码

**绝不单独依赖颜色**区分节点类型：

| 类型 | 形状 | 描边/特效 | 额外编码 |
|---|---|---|---|
| `stat` | 圆 | 分支色 stroke | 无 |
| `modifier` | 方块 | 分支色 stroke | 内部可画小「+」或斜纹 |
| `keystone` | 六边形 | **金色 stroke + `lighter` 辉光** | 发光层 + 尺寸略大 |
| `gate` | 虚线环 | 分支色 light dash | 中心空白，可加锁形徽记 |

- **色盲友好**：使用 `deuteranopia` / `protanopia` 模拟检查，确保形状差异在灰阶下仍可辨。
- **文本兜底**：详情卡始终显示节点类型标签（如「基石」「门槛」）。

### 3.3 动效可访问

- 脉冲动画应支持 `prefers-reduced-motion`（如浏览器环境提供）：关闭时可用静态金色边框代替脉冲。
- 脉冲幅度不宜过大（scale 1.08 以内），避免眩晕。

---

## 4. 资产登记与 AI_OWNED 更新

### 4.1 新增 / 引用资产清单

| 资产 key | 文件名 | 用途 | 生成方式 |
|---|---|---|---|
| `skilltree_menu` | `skilltree_menu.png` | 标题屏「技能树」菜单按钮图标 | Pillow 程序化脚本（推荐）或 ImageGen + `gen_passive_pixels.py` |

### 4.2 `index.html` 引用位置（工程落地用）

在 `#title-screen .title-btns` 内，与「灵魂祭坛」「游戏图鉴」并列新增：

```html
<button id="btn-skilltree" class="gothic-btn ghost menu-btn">
  <img class="menu-btn-icon" src="/assets/skilltree_menu.png" alt="技能树" />
  <span>技能树</span>
</button>
```

> 本规格不改动 `src/`；具体 DOM 插入与事件绑定由程基岩在工程阶段落地。

### 4.3 `gen_assets.py` AI_OWNED 更新

在 `gen_assets.py` 顶部 `AI_OWNED` 集合中添加：

```python
AI_OWNED = {
    ...
    # 技能树入口图标（外部生成，防止被全量生成器覆盖）
    "skilltree_menu.png",
}
```

---

## 5. 总结

- **图标母题**：选定「符文枝 lattice」—— stylized 分枝树 + 金色符文节点，清晰区别于祭坛（石台火）与图鉴（书眼）。
- **文件清单**：新增 `public/assets/skilltree_menu.png`（80×80，透明，紫金配色，暗描边）。
- **生成路径建议**：
  - **首选**：运行本规格附带的 `gen_skilltree_menu.py` Pillow 脚本，无 AI 积分消耗、输出稳定。
  - **备选**：ImageGen 文生图 + `gen_passive_pixels.py` 像素化管线。
- **必须加入 AI_OWNED**：`skilltree_menu.png`。
- **节点规范**：`stat`=圆、`modifier`=方块、`keystone`=六边形+金色描边+`lighter`辉光、`gate`=虚线环；5 分支色从紫金基调派生；三态为解锁/可解锁脉冲/锁定灰显。
- **无障碍**：图标靠描边+金色节点保证多背景可辨；节点类型使用形状+颜色+特效三重编码，不单独依赖颜色。
