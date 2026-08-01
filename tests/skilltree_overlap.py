"""技能树布局重叠回归测试（常驻回归用例 · v3.13 固化）

【用途】
守护技能树卡片布局，防止「文案变长 / 布局常量被改」导致节点重叠悄悄复发。
覆盖两类历史 bug：
  - v3.12：桌面端父子节点纵向重叠（CARD_H 104→160、ROW_H 126→178 修复）
  - v3.11：移动端同层节点水平重叠（必须用真·移动端 context 才能复现）

【断言项】（每个档位都跑）
  ① 父子纵向相交量 = 0        —— 父卡底边不得压到子卡顶边
  ② 任意两卡可见碰撞 = 0      —— 横向 + 纵向同时重叠即为肉眼可见的压卡
  ③ ROW_H 余量预警（不失败）  —— 行距 - 最大卡高 < 8px 时打 WARNING，
                                 提示「文案再长一点就要重叠了」

【覆盖档位】
  桌面 1280x800 / 1600x1000 / 1920x1080（普通 context）
  移动 390x844（has_touch=True, is_mobile=True，逐一切换全部 5 个分支）

  ⚠️ 移动端必须用 Playwright 的 has_touch/is_mobile context。
     手动往 <html> 注入 .touch-device 类【无效】——main.js 在模块初始化阶段
     就用 matchMedia('(pointer: coarse)') 等做了检测，注入时机永远赶不上，
     v3.10/v3.11 两次移动端 bug 就是这样漏检的。

【运行】
    npm run test:skilltree
  或
    <python> tests/skilltree_overlap.py

【前置依赖】
  dev server 必须已在 http://localhost:5173 运行（npm run dev）。
  本脚本【不】接入 prebuild —— 它依赖 dev server，接进构建会让 CI 挂掉。

【退出码】
  0 = PASS（可含 WARNING）
  1 = FAIL（存在重叠；输出会列出具体节点 id 对与相交 px）
"""

import sys

from playwright.sync_api import sync_playwright

URL = "http://localhost:5173/"

TOL = 0.5          # 几何容差（px）：小于此值的相交视为亚像素舍入，不算重叠
WARN_MARGIN = 8.0  # ROW_H 余量预警阈值（px）：低于此值给 WARNING，不判失败

DESKTOP_VIEWPORTS = [(1280, 800), (1600, 1000), (1920, 1080)]
MOBILE_VIEWPORT = (390, 844)
MOBILE_BRANCHES = [
    ("war", "征伐"),
    ("bly", "血裔协同"),
    ("nfr", "永夜抗性"),
    ("eco", "灵魂经济"),
    ("utl", "通用机能"),
]

# 从 DOM 抓每张卡的 offset 几何（offsetLeft/Top 相对 .st-world，不受 pan/zoom 变换干扰）
MEASURE_JS = """() => {
    const tree = window.__skilltree || [];
    const cards = [...document.querySelectorAll('.st-world .altar-card')];
    const byId = {};
    cards.forEach(c => { byId[c.dataset.id] = c; });
    const rows = [];
    for (const def of tree) {
        const c = byId[def.id];
        if (!c) continue;   // 移动端一次只渲染当前分支，其余节点不在 DOM 里
        rows.push({
            id: def.id,
            branch: def.branch || '',
            prereq: def.prereq || [],
            left: c.offsetLeft, top: c.offsetTop,
            w: c.offsetWidth, h: c.offsetHeight,
            right: c.offsetLeft + c.offsetWidth,
            bottom: c.offsetTop + c.offsetHeight,
        });
    }
    return {
        rows,
        touchDevice: document.documentElement.classList.contains('touch-device'),
        domCards: cards.length,
    };
}"""


# ── 页面驱动 ────────────────────────────────────────────────────────────────

def open_skilltree(page):
    """进入技能树界面。两个历史坑：
    ① #guide-screen 首启自动弹出，会遮挡 #btn-skilltree 的点击 → 直接 remove 掉；
    ② 不要等 `#loading.hidden`——.hidden 是 display:none，Playwright 默认等元素
       可见，必然超时。改等 #btn-skilltree 出现。
    """
    page.goto(URL, wait_until="networkidle")
    try:
        page.wait_for_selector("#guide-screen", timeout=4000)
        page.evaluate("() => { const g = document.getElementById('guide-screen'); if (g) g.remove(); }")
    except Exception:
        pass
    page.wait_for_selector("#btn-skilltree", timeout=8000)
    page.click("#btn-skilltree")
    page.wait_for_selector(".st-world .altar-card", timeout=8000)
    page.wait_for_timeout(500)   # 等入场动画/字体回流稳定后再量几何


def switch_branch(page, bid):
    """移动端切分支（桌面端 5 分支同屏，无需调用）。"""
    page.click(f'.st-seg-btn[data-branch="{bid}"]')
    page.wait_for_selector(".st-world .altar-card", timeout=8000)
    page.wait_for_timeout(350)


# ── 几何分析 ────────────────────────────────────────────────────────────────

def analyze(rows):
    """返回 (父子纵向相交列表, 任意两卡碰撞列表, 度量字典)。"""
    by_id = {r["id"]: r for r in rows}

    pc_overlaps = []
    for r in rows:
        for pid in r["prereq"]:
            parent = by_id.get(pid)
            if not parent:
                continue           # 跨分支前置在移动端不同屏，跳过
            vo = parent["bottom"] - r["top"]
            if vo > TOL:
                pc_overlaps.append((pid, r["id"], round(vo, 1)))

    any_overlaps = []
    for i in range(len(rows)):
        for j in range(i + 1, len(rows)):
            a, b = rows[i], rows[j]
            vo = min(a["bottom"], b["bottom"]) - max(a["top"], b["top"])
            ho = min(a["right"], b["right"]) - max(a["left"], b["left"])
            if vo > TOL and ho > TOL:
                any_overlaps.append((a["id"], b["id"], round(vo, 1), round(ho, 1)))

    heights = [r["h"] for r in rows] or [0]

    # 实测行距（ROW_H）：卡片 top 被量化到 TITLE_OFF + depth*ROW_H 的网格上，
    # 取相邻不同 top 的最小正差即为 ROW_H —— 不硬编码常量，改了源码也能自动跟上
    tops = sorted({round(r["top"], 1) for r in rows})
    diffs = [b - a for a, b in zip(tops, tops[1:]) if b - a > TOL]
    row_pitch = min(diffs) if diffs else None

    # 最小父子间距：子卡顶边 - 父卡底边（相邻层父子对给出最紧的那个值）
    gaps = []
    for r in rows:
        for pid in r["prereq"]:
            parent = by_id.get(pid)
            if parent:
                gaps.append(r["top"] - parent["bottom"])
    min_pc_gap = min(gaps) if gaps else None

    margin = (row_pitch - max(heights)) if row_pitch is not None else None

    return pc_overlaps, any_overlaps, {
        "count": len(rows),
        "h_min": min(heights),
        "h_max": max(heights),
        "row_pitch": row_pitch,
        "min_pc_gap": min_pc_gap,
        "margin": margin,
    }


def report(label, rows, warnings):
    """打印一个档位的结果，返回 True=PASS / False=FAIL。"""
    print(f"\n── {label} ──")
    if not rows:
        print("  FAIL: 未采集到任何技能树卡片（页面结构变了？选择器 .st-world .altar-card 失配）")
        return False

    pc, anyo, m = analyze(rows)

    pitch = f"{m['row_pitch']:.0f}px" if m["row_pitch"] is not None else "n/a"
    gap = f"{m['min_pc_gap']:.0f}px" if m["min_pc_gap"] is not None else "n/a"
    margin_s = f"{m['margin']:.0f}px" if m["margin"] is not None else "n/a"
    print(f"  节点数 {m['count']}  卡高 min/max {m['h_min']:.0f}/{m['h_max']:.0f}px  实测行距 {pitch}")
    print(f"  ROW_H 余量(行距-最大卡高) {margin_s}   最小父子间距 {gap}")

    print(f"  [①父子纵向相交] {len(pc)} 组 (阈值 >{TOL}px)")
    for pid, cid, vo in pc[:20]:
        print(f"      ✗ {pid} → {cid} 纵向相交 {vo}px")
    if len(pc) > 20:
        print(f"      … 另有 {len(pc) - 20} 组未列出")

    print(f"  [②任意两卡可见碰撞] {len(anyo)} 组")
    for aid, bid, vo, ho in anyo[:20]:
        print(f"      ✗ {aid} ↔ {bid} 相交 {vo}x{ho}px (纵x横)")
    if len(anyo) > 20:
        print(f"      … 另有 {len(anyo) - 20} 组未列出")

    # ③ 余量预警：不失败，只提前示警「文案再长就要压卡了」
    for name, val in (("ROW_H 余量", m["margin"]), ("最小父子间距", m["min_pc_gap"])):
        if val is not None and val < WARN_MARGIN:
            msg = f"{label}: {name} 仅 {val:.1f}px (<{WARN_MARGIN:.0f}px)，文案再变长即会重叠"
            warnings.append(msg)
            print(f"  ⚠ WARNING  {msg}")

    ok = not pc and not anyo
    print(f"  → {'PASS' if ok else 'FAIL'}")
    return ok


# ── 主流程 ──────────────────────────────────────────────────────────────────

def main():
    results = []     # [(label, ok)]
    warnings = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # ---- 桌面档 ----
        for w, h in DESKTOP_VIEWPORTS:
            ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
            page = ctx.new_page()
            try:
                open_skilltree(page)
                data = page.evaluate(MEASURE_JS)
                label = f"桌面 {w}x{h}"
                if data["touchDevice"]:
                    print(f"\n── {label} ──\n  FAIL: 桌面 context 竟带 .touch-device，档位失真")
                    results.append((label, False))
                else:
                    results.append((label, report(label, data["rows"], warnings)))
            finally:
                ctx.close()

        # ---- 移动端档（真·触屏 context，逐分支）----
        mw, mh = MOBILE_VIEWPORT
        ctx = browser.new_context(
            viewport={"width": mw, "height": mh},
            device_scale_factor=3,
            has_touch=True,
            is_mobile=True,
        )
        page = ctx.new_page()
        try:
            open_skilltree(page)
            probe = page.evaluate(MEASURE_JS)
            if not probe["touchDevice"]:
                # 这不是布局 bug，是测试失真——必须红灯，否则移动端等于没测
                print(f"\n── 移动 {mw}x{mh} ──")
                print("  FAIL: <html> 未带 .touch-device，移动端布局分支未生效（context 配置失效），"
                      "本档测试无意义")
                results.append((f"移动 {mw}x{mh}", False))
            else:
                for bid, bname in MOBILE_BRANCHES:
                    if bid != MOBILE_BRANCHES[0][0]:
                        switch_branch(page, bid)
                    data = page.evaluate(MEASURE_JS)
                    label = f"移动 {mw}x{mh} · {bname}({bid})"
                    results.append((label, report(label, data["rows"], warnings)))
        finally:
            ctx.close()

        browser.close()

    # ---- 汇总 ----
    failed = [name for name, ok in results if not ok]
    print("\n" + "=" * 60)
    print(f"档位合计 {len(results)}  通过 {len(results) - len(failed)}  失败 {len(failed)}")
    if warnings:
        print(f"\nWARNING {len(warnings)} 条（不影响判定，属余量预警）：")
        for w in warnings:
            print(f"  ⚠ {w}")
    if failed:
        print("\n失败档位：")
        for name in failed:
            print(f"  ✗ {name}")
        print("\nQA 判定: FAIL（技能树存在节点重叠）")
        return 1
    print("\nQA 判定: PASS（全档位技能树无纵向/可见重叠）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
