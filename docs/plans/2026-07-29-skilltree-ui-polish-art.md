# 技能树 UI 润色 · 纯美术 / 视觉规范（T3-UI-POLISH-ART）

> - **Task ID**：T3-UI-POLISH-ART · 优先级 P1 · 角色：美术方向 / 技术美术
> - **负责人**：林绘澄（art-director）
> - **日期**：2026-07-29
> - **范围**：仅出视觉 / 动效 / 连线规范到本 Markdown；**不写代码、不修改 `src/`、不修改 `index.html`**。下列所有 `/* CSS / SVG 片段 */` 均为「拟交付工程的规格草案」，由工程负责人落地，美术不碰源码。
> - **对应功能**：即将新增三件套——① 节点详情 hover 浮层 tooltip、② 每分支 grid 内 SVG 路径连线（按 `prereq` 画依赖）、③ 解锁动画（`available → owned` 状态转换）。
> - **对齐文件（已实地读取，非假设）**：`src/style.css`（技能树段 line 803–834）、`index.html`（#skilltree-screen line 191–202）、`docs/plans/2026-07-29-skilltree-v1-spec.md`（39 节点 / 5 分支 / prereq 模型）、`docs/art/update-ux-spec.md`（AA 级可访问性 + `prefers-reduced-motion` 约定）。

---

## 0. 对齐前提（务必先读）

### 0.1 现状（来自 `src/style.css` 实测）

| 项 | 现有实现（line） | 取值 |
|---|---|---|
| 屏幕 | `#skilltree-screen` | 复用祭坛视觉，`bg_title.png` 暗化，z-index 30，可滚动 |
| 分支容器 | `.st-branch` / `.st-branch-grid` | CSS grid：`repeat(auto-fill, minmax(200px,1fr))`，`gap:14px` |
| 节点卡 | `.altar-card`（复用祭坛卡） | 深色半透明底 + 像素图标 + 名称/类型/描述/按钮；哥特切角 `clip-path` |
| 锁定态 `.locked` | line 828 | `opacity:.42; filter:grayscale(.6)` |
| 可解锁态 `.available` | line 829 | `box-shadow: 0 0 16px rgba(201,162,39,.35)`（**金色辉光**） |
| 已解锁态 `.owned` | line 767 | `border-color: rgba(46,204,113,.6)`（**绿色边**） |
| 分支色 class | line 822–826 | `.st-war` `rgba(198,60,60,.6)` / `.st-bly` `rgba(142,68,173,.6)` / `.st-nfr` `rgba(70,120,210,.6)` / `.st-eco` `rgba(201,162,39,.6)` / `.st-utl` `rgba(60,180,150,.6)` |

**调色 Token（取自 `:root`，全部复用，零新色）**：`--bg #0d0a1a` / `--gold #d4af37` / `--bone #e8e0d0` / `--purple #8e44ad` / `--gem #2ecc71`（绿）。分支主色（rgba 同上，实心 hex 备用）：

| 分支 | id | rgba | 实心 hex |
|---|---|---|---|
| 征伐 | `war` | `rgba(198,60,60)` | `#c63c3c` |
| 血裔协同 | `bly` | `rgba(142,68,173)` | `#8e44ad` |
| 永夜抗性 | `nfr` | `rgba(70,120,210)` | `#4678d2` |
| 灵魂经济 | `eco` | `rgba(201,162,39)` | `#c9a227` |
| 通用机能 | `utl` | `rgba(60,180,150)` | `#3cb496` |

### 0.2 设计约束（红线）

1. **只动边框 / 外辉光，绝不模糊或位移文字**。所有动效仅作用于 `.altar-card` 的 `box-shadow` / `border-color` / 伪元素扫光层 / SVG 连线；卡片内 `name/type/desc/按钮` 的 `opacity` 与 `transform` 保持恒定（可用伪元素做闪光，但不得覆盖或位移文本）。
2. **统一视觉语言**：复用既有「暗哥特·紫金」+ 骨白文字 + 哥特切角 + 金/紫辉光；新组件不得引入新字体、新色相。
3. **降级一致**：所有循环动画（`prefers-reduced-motion: reduce`）下关闭，仅做静态状态切换（沿用 `update-ux-spec.md` §4 约定，并入既有媒体查询）。
4. **连线为装饰**：节点真实信息由卡面文字 + 三态（locked/available/owned）承载；连线仅作依赖关系的视觉补充，可接受「颜色唯一编码」（WCAG 装饰性元素豁免）。

### 0.3 可访问性对齐

- 对比度：骨白 `#e8e0d0` on `--bg` ≈ 14:1（AAA）；金 `#d4af37` on night ≈ 8:1；绿 `#2ecc71` on night ≈ 8:1。全部达标。
- 动效降级：`prefers-reduced-motion` 下关闭脉冲 / 扫光 / 流动，直接落到终态。
- 焦点可达：tooltip 内不含可聚焦控件；其触发卡为既有 `<button>`，天然可 Tab 聚焦，hover/focus 都应唤起浮层（focus 唤起满足键盘可达）。

---

## 1. 解锁动画视觉规范（`available → owned`）

### 1.1 设计目标

把「点击解锁 → 节点被点亮」做成**一次清晰、克制、有分支个性的庆祝**，同时绝不干扰网格里其他卡的文字阅读。核心语义：`available`（金色呼吸辉光）**扩散并交叉淡出为** `owned`（绿色边辉光，与全游戏 `owned=绿` 语义一致）。

### 1.2 视觉编排（keyframes 思路）

总时长 **600ms**，分三段编排（时间轴，单位 ms）：

| 阶段 | 时间窗 | 作用对象 | 视觉动作 | 缓动 |
|---|---|---|---|---|
| ① 脉冲弹回 | 0 → 300 | 卡片（伪元素 + `transform: scale`） | scale `1 → 1.05 → 1.0` 过冲回弹；**文字与内容 opacity 恒定 = 1，零位移** | `cubic-bezier(.2,1.4,.4,1)`（复用 `#achievement.ach-pop` / `#evoIn` 同款过冲曲线） |
| ② 辉光交叉淡出 | 200 → 560 | `box-shadow` + `border-color` | 盒辉光 `0 0 16px rgba(201,162,39,.35)`（金）→ `0 0 18px rgba(46,204,113,.55)`（绿）；边色 `分支色(.6)` → `绿(.6)` | `cubic-bezier(.4,0,.2,1)`（ease-in-out） |
| ③ 分支色扫光 | 180 → 520 | 伪元素 `.altar-card::after`（覆盖整卡、不挡字） | 一道分支色高光条从左至右单次横扫（`translateX(-120% → 120%)` + opacity `0→.6→0`） | `cubic-bezier(.4,0,.2,1)` |
| ④ 收束定格 | 560 → 600 | 全部 | scale 回 1.0、扫光淡出、盒辉光定格为 owned 静止态：`0 0 12px rgba(46,204,113,.25)`（轻绿辉光） | — |

**关键红线落实**：阶段①的 `scale` 只作用在整卡外框（切角盒），**文字/图标/按钮不单独缩放也不位移**；阶段③扫光用 `::after` 薄层（如 `linear-gradient(105deg, transparent 40%, 分支色 50%, transparent 60%)`），置于内容之下 / 或 `mix-blend-mode: screen` 仅提亮、不遮字。

### 1.3 分支色如何参与（**明确建议**）

> **推荐方案 A（采用）**：**持久 `owned` 终态统一绿边 + 绿辉光**（与 `.altar-card.owned` 现有绿边、祭坛/升级卡 `owned=绿` 全游戏语义完全一致）；**分支色仅用于瞬时爆发**——即阶段③那一道横扫高光取该卡分支色，让「点亮瞬间」带分支个性，但落定后回归统一绿。
>
> **备选方案 B（不推荐）**：`owned` 边/辉光改取分支色。→ 会打破「owned=绿」的全局语言，且与现有 `.owned` 绿边冲突；5 种绿调并存也削弱「已解锁」这一状态的快速识别。

### 1.4 扫光 / 粒子（**明确建议**）

- **扫光（sweep）：✅ 建议有**，单次、分支色、180–520ms。理由：① 廉价（一个伪元素渐变 + transform，GPU 友好）；② 提供清晰「这一格刚刚被激活」的定向反馈；③ 走外框/薄层，不模糊文字，契合 0.2 红线；④ 与游戏既有「光流动」语言（loot-ring 脉冲、available 金辉光）同源。
- **粒子（particles）：❌ 建议无**。理由：① 网格 `gap` 仅 **14px**，粒子极易溢出并遮挡**相邻卡文字**，违反 0.2 红线；② 性能——respec 后可能一次性点亮数十个节点，并发粒子系统开销大；③ 品牌：既有庆祝语言是「辉光/脉冲」（achievement pop、available 呼吸），而非粒子，加粒子反而出戏。
  - *可选增强（仅当用户坚持要火花）*：若坚持，只允许**约束在卡自身 box 内**（`overflow:hidden` 裁切）、分支色、≤6 颗、单帧短爆、且 `pointer-events:none`；但仍建议在排序/移动端关闭以防邻字遮挡。

### 1.5 拟交付工程的 keyframes 参考（规格草案，非源码）

```css
/* ===== 解锁动画：available → owned（由工程落地到 src/style.css，美术不写码）===== */
.altar-card.unlocking {
  animation: stUnlockPulse 600ms cubic-bezier(.2,1.4,.4,1) both;
}
.altar-card.unlocking::after {          /* 分支色扫光层：不挡字，置于内容之下 */
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(105deg, transparent 42%, var(--branch-color, #c9a227) 50%, transparent 58%);
  opacity: 0; pointer-events: none; mix-blend-mode: screen;
  animation: stUnlockSweep 340ms cubic-bezier(.4,0,.2,1) 180ms both;
}
@keyframes stUnlockPulse {
  0%   { transform: scale(1);    box-shadow: 0 0 16px rgba(201,162,39,.35); border-color: var(--branch-color, rgba(201,162,39,.6)); }
  35%  { transform: scale(1.05); }
  60%  { transform: scale(1.02); box-shadow: 0 0 18px rgba(46,204,113,.55);  border-color: rgba(46,204,113,.6); }
  100% { transform: scale(1);    box-shadow: 0 0 12px rgba(46,204,113,.25);  border-color: rgba(46,204,113,.6); }
}
@keyframes stUnlockSweep {
  0%   { opacity: 0; transform: translateX(-120%); }
  50%  { opacity: .6; }
  100% { opacity: 0; transform: translateX(120%); }
}
```

> `--branch-color` 由 JS 按节点 `branch` 写入卡内联（如 `style="--branch-color: rgba(198,60,60,.6)"`），使扫光取对应分支色，而落定态仍为统一绿。

### 1.6 降级（并入既有 `prefers-reduced-motion` 媒体查询）

```css
@media (prefers-reduced-motion: reduce) {
  .altar-card.unlocking,
  .altar-card.unlocking::after { animation: none; }
  /* 直接落到 owned 终态：绿边 + 静止轻绿辉光，无脉冲/扫光 */
  .altar-card.unlocking { transform: none; box-shadow: 0 0 12px rgba(46,204,113,.25); border-color: rgba(46,204,113,.6); }
}
```

### 1.7 待拍板决策

- **D1**：`owned` 持久态 —— A 统一绿（推荐，采用）/ B 分支色接管。
- **D2**：扫光 YES（推荐）/ NO；粒子 NO（推荐）/ 加约束火花（可选）。

---

## 2. hover tooltip 视觉规范

### 2.1 容器形态（暗玻璃拟态）

- **表面**：`background: rgba(18,12,30,.92)`（贴近 `--bg` 的暗紫黑，与 `#achievement`/`#update-prompt` 同族）。
- **可选背景模糊**：`backdrop-filter: blur(6px)`（在已暗化的 `bg_title` 上叠加霜化，强化「浮层」离屏感）。**降级建议**：若目标低端机 backdrop-filter 掉帧，回退为纯 `rgba(18,12,30,.96)` 不模糊——视觉仍成立。
- **描边**：`1px solid` 取**该卡分支色** `rgba(<branch>,.6)`，外发光 `0 0 14px rgba(<branch>,.35)`；圆角 `10px`（贴近哥特软切，匹配 `#codex`/`#stats-card` 既有圆角语言）。
- **层级 / 定位**：**单实例浮层**（全屏仅一个 `<div class="st-tooltip">`，由 JS 在 hover/focus 时填充内容并定位到触发卡旁），`position: absolute` 挂于 `#skilltree-screen` 内、`z-index` 高于卡片（建议 31，高于 screen 30、低于 pause 40）；**边界翻转**：默认显示在卡上方，若上方空间不足则翻到下方；水平钳制在视口内（含 `safe-area-inset`），永不溢出屏幕边缘。

### 2.2 字体层级

| 行 | 内容 | 颜色 | 字号 | 备注 |
|---|---|---|---|---|
| 标题 | 节点名 | `--bone #e8e0d0` | 15px / 700 | 字距 1px；与卡内 `h3` 同源 |
| 类型标签 | 「类型 · 分支」（如「基石 · 征伐」） | **分支色**（实心 hex，如 `#c63c3c`） | 11px | `letter-spacing:2px`；与卡 `.st-type`（紫）区分——tooltip 里用分支色强化归属 |
| 描述 | `desc` | `--bone` @ **0.76 透明**（同 `.ac-desc`） | 12–13px | 行高 1.6，`line-height` 宽松防挤 |
| 成本（可选行） | 「灵魂 −N」 | `--purple #8e44ad`（或金 `#d4af37`） | 12px | 仅 available 态显示「可解锁花费」，owned 显示「已点亮」灰字 |

### 2.3 出现 / 消失过渡

- **出现**：`opacity 0 → 1` + `translateY(6px → 0)`（轻微上移「到位」），`180ms ease-out`；可叠加 `scale(.98→1)` 极小缩放增质感（**不缩放内容文字**）。
- **消失**：反向 `opacity → 0` + `translateY(0 → 4px)`，`140ms ease-in`；或在鼠标移出后立即 `hidden` 也可。
- **触发**：`mouseenter` / `focus`（键盘可达）唤起；`mouseleave` / `blur` 收起；**避免闪烁**：加 ~80ms 延迟收起，鼠标从卡移到浮层时不消失。

### 2.4 小箭头（指向卡片）

- **推荐：有**，一个 8px CSS 三角（border 技巧）置于浮层贴近卡片的那一侧，取**分支色**填充，锚定「此浮层描述哪张卡」的关系。
- 位置随边界翻转联动：浮层在卡上方 → 箭头在浮层底边朝下；浮层在卡下方 → 箭头在浮层顶边朝上。
- 若追求极简可省，但**推荐保留**以增强「卡片—浮层」归属可读性（尤其密集网格）。

### 2.5 尺寸与最大宽度（防溢出视口）

| 端 | 推荐宽 | 最大宽 | 内边距 |
|---|---|---|---|
| 桌面 | `260px` | `300px` | `14px 16px` |
| 移动（`.touch-device`） | `min(86vw, 300px)` | `min(86vw, 300px)` | `12px 14px` |

- 描述过长时内部 `max-height` + `overflow:auto` 或自动换行（`word-break: break-word`），**绝不横向溢出视口**。
- 一行不超过 ~22 中文字（按 260px / 12px 估算），过长描述建议上游（文策渊）在 `desc` 字段控长。

### 2.6 拟交付工程参考（规格草案，非源码）

```css
/* ===== 技能树节点 tooltip（由工程落地，美术不写码）===== */
.st-tooltip {
  position: absolute; z-index: 31;                       /* 高于 screen(30) 低于 pause(40) */
  width: 260px; max-width: 300px;
  padding: 14px 16px; border-radius: 10px;
  background: rgba(18,12,30,.92);
  backdrop-filter: blur(6px);                            /* 可降级为纯色 */
  border: 1px solid var(--branch-color, rgba(142,68,173,.6));
  box-shadow: 0 0 14px rgba(142,68,173,.35), inset 0 0 10px rgba(0,0,0,.4);
  color: var(--bone); pointer-events: none;              /* 浮层本身不拦截事件 */
  opacity: 0; transform: translateY(6px);
  transition: opacity 180ms ease-out, transform 180ms ease-out;
}
.st-tooltip.show { opacity: 1; transform: translateY(0); }
.st-tooltip .tt-title { font-size: 15px; font-weight: 700; color: var(--bone); letter-spacing: 1px; }
.st-tooltip .tt-type  { font-size: 11px; letter-spacing: 2px; color: var(--branch-solid, #8e44ad); margin: 4px 0 8px; }
.st-tooltip .tt-desc  { font-size: 12px; line-height: 1.6; opacity: .76; }
.st-tooltip .tt-cost  { font-size: 12px; color: var(--purple); margin-top: 8px; }
.st-tooltip .tt-arrow { /* 8px 三角，分支色，随翻转切换边 */ }
.touch-device .st-tooltip { width: min(86vw, 300px); max-width: min(86vw, 300px); padding: 12px 14px; }
@media (prefers-reduced-motion: reduce) {
  .st-tooltip { transition: opacity 120ms linear; transform: none; }
  .st-tooltip.show { transform: none; }
}
```

### 2.7 待拍板决策

- **D3**：小箭头 —— 有（推荐，采用）/ 无。
- **D4**：`backdrop-filter: blur(6px)` —— 启用（推荐）/ 回退纯色（低端面性能优先）。

---

## 3. 路径连线 SVG 视觉规范

### 3.1 容器与层级

- **每分支一个 `<svg class="st-links">`**，作为 `.st-branch` 内、`.st-branch-grid` **之前**的首个子元素；`position:absolute; inset:0; width:100%; height:100%`；`pointer-events:none`（纯装饰，不拦截点击）；`z-index:0`，同时 `.st-branch-grid` 设 `position:relative; z-index:1` 使卡片压在连线之上。
- 单个 SVG 覆盖该分支整块网格；因分支内 prereq 均在同支（v1 目录中 root/gate/keystone 皆同支），**每 SVG 继承该分支色**，无需逐线指定色（tier3 灰覆盖除外）。
- 坐标：JS 在渲染后读取每张 `.altar-card` 的中心（相对 `.st-branch` 容器），从 `prereq` 卡中心连到依赖卡中心；**响应式**：`ResizeObserver` 监听 `.st-branch` 尺寸变化重算，且每次解锁（状态变更）后重算 tier 分类。

### 3.2 线型 / 线宽 / 颜色规则（三档）

| 档 | 关系（两端状态） | 线型 | 线宽 | 颜色 | 辉光 |
|---|---|---|---|---|---|
| **T1 已完成** | `owned → owned` | **实线** | `2px` | **分支色**（实心 hex，opacity 1） | `drop-shadow(0 0 3px <branch>)`（CSS filter，GPU 友好） |
| **T2 可解锁引导** | `owned → available` | **虚线** `stroke-dasharray:7 5` | `2px` | **分支色** opacity **.6** | 轻 `drop-shadow(0 0 2px <branch>)` |
| **T3 潜在** | 其余（locked↔locked / locked→available / available→locked 等） | **虚线** `stroke-dasharray:5 5` | `1.5px` | **暗灰** `rgba(120,120,140,.35)` | 无 |

> T1 实线表示「这条路径已走通」；T2 半亮虚线表示「下一步可走的引导」；T3 暗灰虚线表示「潜在依赖，尚未激活」。

### 3.3 端点样式

- 每条线两端各一个小 `<circle r=3>` 连接点：T1/T2 取**分支色**填充，T3 取**暗灰**填充。
- **不使用箭头**（arrowhead）：网格密集 + 多线交汇，箭头会增加杂乱；方向语义由「流动动画方向（仅 T2）」+ 卡片 available 辉光自然传达。若产品坚持方向指示，可仅在 T2 线末端（available 端）加一个分支色小三角，但默认不推荐。

### 3.4 流动感（stroke-dasharray + dashoffset）

- **仅 T2（`owned → available`）启用流动**，语义明确：能量从「已点亮的 prereq」**流向**「可解锁的下一节点」，暗示「这是你现在能走的那一步」。
- 实现：`stroke-dasharray:7 5; animation: stLinkFlow 1.1s linear infinite;` 其中 `@keyframes stLinkFlow { to { stroke-dashoffset: -12; } }`（负偏移 = 虚线朝终点/available 方向移动）。
- **T1 不流动**（已完成，静态实线即可）；**T3 不流动**（潜在，静态暗灰虚线）。
- 为什么只让 T2 流：避免全屏流动造成的视觉噪音；把「动」集中在唯一有行动意义的那条路径上，引导玩家下一步。

### 3.5 坐标与线形（基线 vs 增强）

- **基线（推荐）**：`prereq 中心 → dependent 中心` 的**直线** `<line>`。对响应式最稳健——重排后只需重算两端点，无需维护肘形几何。
- **增强（可选）**：若想要更「技能树」的枝杈感，可改为**单段二次贝塞尔** `<path d="M x0 y0 Q mx my x1 y1">`，控制点 `mx,my` 取两端中点略向上/外偏移。工程二选一；视觉规范对两版均适用（线型/颜色/tier 规则不变）。

### 3.6 可访问性

- 连线为**装饰性**（WCAG 装饰豁免），颜色唯一编码可接受；真实信息已由卡面文字 + 三态承载。
- `prefers-reduced-motion` 下 T2 流动动画关闭（虚线静态），tier 分类与颜色保留。
- `pointer-events:none` 确保连线永不干扰卡片点击 / 键盘聚焦。

### 3.7 拟交付工程参考（规格草案，非源码）

```html
<!-- 每分支一个，置于 .st-branch-grid 之前；坐标由 JS 按卡中心注入 -->
<svg class="st-links st-links-war" aria-hidden="true" pointer-events="none">
  <line class="lk-owned"  x1=".." y1=".." x2=".." y2=".."/>   <!-- T1 -->
  <line class="lk-next"   x1=".." y1=".." x2=".." y2=".."/>   <!-- T2（流动） -->
  <line class="lk-latent" x1=".." y1=".." x2=".." y2=".."/>   <!-- T3 -->
  <circle class="lk-dot-owned"  cx=".." cy=".." r="3"/>        <!-- 端点圆点 -->
</svg>
```

```css
/* ===== 技能树依赖连线（由工程落地，美术不写码）===== */
.st-branch { position: relative; }
.st-links { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; overflow: visible; }
.st-branch-grid { position: relative; z-index: 1; }
.st-links line { fill: none; }
.lk-owned  { stroke: var(--branch-solid, #8e44ad); stroke-width: 2;  opacity: 1;   filter: drop-shadow(0 0 3px var(--branch-solid, #8e44ad)); }
.lk-next   { stroke: var(--branch-solid, #8e44ad); stroke-width: 2;  opacity: .6;  stroke-dasharray: 7 5; filter: drop-shadow(0 0 2px var(--branch-solid, #8e44ad)); animation: stLinkFlow 1.1s linear infinite; }
.lk-latent { stroke: rgba(120,120,140,.35);         stroke-width: 1.5; stroke-dasharray: 5 5; }
.lk-dot-owned, .lk-dot-next { fill: var(--branch-solid, #8e44ad); }
.lk-dot-latent { fill: rgba(120,120,140,.5); }
@keyframes stLinkFlow { to { stroke-dashoffset: -12; } }   /* 朝 available 端流动 */
@media (prefers-reduced-motion: reduce) {
  .lk-next { animation: none; }                          /* 静态虚线，无流动 */
}
```

### 3.8 待拍板决策

- **D5**：连线形态 —— 直线（推荐基线）/ 肘形树状线（增强，枝杈感更强）。
- **D6**：流动范围 —— 仅 T2（推荐，采用）/ T1+T2 都流（更华丽但更噪）。

---

## 4. 三件套交叉一致性（Token 收敛）

| 维度 | 统一约定 |
|---|---|
| 主调 | 暗哥特·紫金 + 骨白文字 + 哥特切角；**零新色**，全部取自 `:root` 与分支色表（§0.1） |
| 分支色来源 | 由 JS 在卡/浮层/SVG 上写内联 `--branch-color` / `--branch-solid`（按 `node.branch` 映射 §0.1 表） |
| 辉光语言 | 金（available）/ 绿（owned）/ 分支色（瞬时爆发 & 连线）三者并存但不冲突；统一用 `box-shadow` / `drop-shadow`，不用新混合模式 |
| 降级 | 三件套所有循环动画在 `prefers-reduced-motion` 下关闭，并入 `src/style.css` 既有媒体查询（不新建） |
| 层级 | tooltip z31 / SVG z0（卡片 z1）/ 既有 screen z30、pause z40 不变；连线 / 浮层均 `pointer-events:none` 不挡操作 |
| 字体 | 中文 `--body-font` 系统栈；数字/拉丁如需用 `--pixel-font`（Press Start 2P 自托管） |

---

## 5. 待主理人 / 工程确认项（审批清单）

| # | 决策点 | 推荐 | 备选 |
|---|---|---|---|
| D1 | `owned` 持久态颜色 | **统一绿**（与全游戏 owned=绿 一致） | 分支色接管 |
| D2 | 扫光 / 粒子 | **扫光 YES（分支色单次）/ 粒子 NO** | 粒子改约束火花（可选） |
| D3 | tooltip 小箭头 | **有（分支色，随翻转）** | 无 |
| D4 | tooltip `backdrop-filter` | 启用 blur(6px) | 回退纯色（低端机） |
| D5 | 连线形态 | 直线（响应式稳健） | 肘形树状线（增强） |
| D6 | 流动范围 | **仅 T2（owned→available）** | T1+T2 都流 |

> 美术侧默认按「推荐」落规格；若主理人/用户另有偏好，回执后我据此修订本文件对应章节。

---

## 6. 红线与交付声明

- 本文件**仅视觉 / 动效 / 连线规范**，不含任何 `src/` 源码改动、未触碰 `index.html`、未生成任何图片资产。
- 所有代码片段均为「拟交付工程的规格草案」，落地由工程负责人按此写入 `src/style.css` 与技能树 JS 渲染逻辑；美术不写码。
- 规范已对齐既有 `src/style.css` 技能树段（line 803–834）与 `update-ux-spec.md` 的 AA 可访问性 / `prefers-reduced-motion` 约定；分支色与现有 `.st-war` 等 class 完全一致。

*文档版本：v1.0 · 美术负责人（林绘澄）产出 · 落地由工程负责人按 §1.5 / §2.6 / §3.7 规格实现。*
