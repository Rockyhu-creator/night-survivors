#!/usr/bin/env python3
# v4.4 · 宠物帧动画后处理（contact sheet → 抠图 → 归一化 → 柔和投影）
#
# 输入：两张 contact sheet（橘猫 2×3=6格、美短 2×4=7格+1空）
#   - 橘猫：Downloads/ChatGPT Image 2026年8月20日 11_17_15.png (1254×1254, 2×3)
#   - 美短：Downloads/ChatGPT Image 2026年8月20日 11_17_52.png (1254×1254, 2×4)
# 输出：public/assets/pet_<cat>_<action>_<frame>.png（RGBA 透明背景，64×64，compress_level=9）
#
# 管线：
#   1) 按网格坐标切片
#   2) 边缘泛洪键控抠白底（复用 gen_portrait_pixels.flood_key_bg，离线、不依赖 rembg 模型下载）
#   3) LANCZOS 平滑归一化到 64×64（不像素化，贴合照片质感）
#   4) 柔和投影（图鉴黑底可见，不破坏照片感）
import os, sys
from collections import deque
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'public', 'assets')
FINAL_SIZE = 64


def flood_key_bg(im, bg_min=246, spread_tol=22, bridge_min=120, bridge_max_depth=3):
    """从画布四边泛洪，删除与边界连通的背景（纯白底）像素。

    两阶段判定：
    - 种子（四边起点）：严格纯白 min(r,g,b) > bg_min(246)，避免把猫身白毛(~240)当起点。
    - 蔓延：放宽到「距纯白≤spread_tol(22) 即亮度≥233」且 min>215。
      这样能从纯白背景越过轮廓处那道稍暗的接缝（肚皮下背景白常落 233–246），
      吃掉残留白边；而被深色身体包围、不连通四边的猫白毛不会被波及。

    **背景洞穿透（bridge）**：猫腿之间的背景白常被猫腿暗色边缘围成
    不连通四边的孤岛（连通泛洪遇暗边即断 → 漏删）。允许泛洪「借道」穿过
    1~bridge_max_depth 层暗色桥像素（min 在 [bridge_min, 215] 的腿缘/阴影，
    本身保留不删）到达另一侧近白背景并删除。桥接深度受限：猫身厚度远大于
    腿缝暗边，不会被误穿到猫白毛（猫身 min<bridge_min 非桥，阻断）。"""
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()

    def is_seed(p):
        return p[0] > bg_min and p[1] > bg_min and p[2] > bg_min

    def is_near(p):
        return (min(p) > 215
                and max(255 - p[0], 255 - p[1], 255 - p[2]) <= spread_tol)

    def is_bridge(p):
        # 暗色腿缘/阴影：不够亮算近白、但也不是猫身（猫身 min 通常 < bridge_min）
        return (not is_near(p)) and min(p) >= bridge_min

    visited = bytearray(w * h)
    dq = deque()       # 近白背景像素（删）
    bdq = deque()      # 借道桥像素 (x, y, depth)，不删，仅借道
    for x in range(w):
        for y in (0, h - 1):
            i = y * w + x
            if not visited[i] and is_seed(px[x, y][:3]):
                visited[i] = 1
                dq.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            i = y * w + x
            if not visited[i] and is_seed(px[x, y][:3]):
                visited[i] = 1
                dq.append((x, y))
    NEIGH4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
    NEIGH8 = NEIGH4 + ((1, 1), (1, -1), (-1, 1), (-1, -1))
    while dq or bdq:
        if dq:
            x, y = dq.popleft()
            px[x, y] = (0, 0, 0, 0)
            for dx, dy in NEIGH4:
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h:
                    i = ny * w + nx
                    if visited[i]:
                        continue
                    p = px[nx, ny][:3]
                    if is_near(p):
                        visited[i] = 1
                        dq.append((nx, ny))
                    elif is_bridge(p):
                        visited[i] = 1
                        bdq.append((nx, ny, 1))
        else:
            x, y, depth = bdq.popleft()
            for dx, dy in NEIGH8:
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h:
                    i = ny * w + nx
                    if visited[i]:
                        continue
                    p = px[nx, ny][:3]
                    if is_near(p):
                        visited[i] = 1
                        dq.append((nx, ny))
                    elif depth < bridge_max_depth and is_bridge(p):
                        visited[i] = 1
                        bdq.append((nx, ny, depth + 1))
    return im

# ── 网格定义 ──────────────────────────────────────────────
# 每张 contact sheet 的切片规格：(文件路径, 行数, 列数, 格子映射)
SHEETS = [
    {
        'src': os.path.expanduser('~/Downloads/ChatGPT Image 2026年8月20日 11_17_15.png'),
        'prefix': 'pet_orange',
        'rows': 2, 'cols': 3,
        'grid': [  # (row, col) -> filename suffix
            (0, 0, 'follow_0'), (0, 1, 'follow_1'), (0, 2, 'pickup_0'),
            (1, 0, 'pickup_1'), (1, 1, 'urine_0'),  (1, 2, 'urine_1'),
        ],
    },
    {
        'src': os.path.expanduser('~/Downloads/ChatGPT Image 2026年8月20日 11_17_52.png'),
        'prefix': 'pet_amer',
        'rows': 2, 'cols': 4,
        'grid': [
            (0, 0, 'follow_0'), (0, 1, 'follow_1'), (0, 2, 'pickup_0'), (0, 3, 'pickup_1'),
            (1, 0, 'butt_0'),   (1, 1, 'butt_1'),   (1, 2, 'butt_2'),
            # (1, 3) 留空
        ],
    },
]


def slice_cell(sheet, row, col):
    """从 contact sheet 切出指定格子。"""
    img = Image.open(sheet['src']).convert('RGBA')
    w, h = img.size
    cw = w // sheet['cols']
    ch = h // sheet['rows']
    # 切出格子（留边距去掉分割线/文字区域）
    margin_h = max(4, cw // 30)   # ~3% 水平边距
    margin_v = max(50, ch // 10)  # ~10% 垂直边距（底部文字区 + 地面阴影）
    box = (
        col * cw + margin_h,
        row * ch + margin_v,
        (col + 1) * cw - margin_h,
        (row + 1) * ch - margin_v,
    )
    return img.crop(box)


def _flood_remove_connected_white(im, white_thresh=246, spread_tol=22):
    """从已透明的背景区域出发，泛洪删除与之连通的近背景白残留（肚皮下/地面反光），
    保留被猫身体包围、不连通边界的内部白毛。
    判定与 flood_key_bg 的 is_near 一致：min>215 且距纯白≤spread_tol。"""
    px = im.load()
    w, h = im.size
    visited = bytearray(w * h)
    dq = deque()
    # seed：已被边缘泛洪删成透明（即背景）的像素
    for y in range(h):
        for x in range(w):
            if px[x, y][3] == 0:
                visited[y * w + x] = 1
                dq.append((x, y))
    while dq:
        x, y = dq.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                i = ny * w + nx
                if visited[i]:
                    continue
                r, g, b, a = px[nx, ny]
                if a > 0 and min(r, g, b) > 215 \
                        and max(255 - r, 255 - g, 255 - b) <= spread_tol:
                    px[nx, ny] = (0, 0, 0, 0)
                    visited[i] = 1
                    dq.append((nx, ny))
    return im


def _fill_white_holes(im, pure_min=250):
    """洞填充：删除不连通四边、且纯白(min>pure_min 且距纯白≤5)的孤立块。
    这些是被猫腿实心封死的背景白（连通泛洪进不去的『真孤岛』），亮度 250–255
    与背景纯白一致、与猫身白毛(240–249)区分。保留猫身白毛（不在此亮度区间）。"""
    px = im.load()
    w, h = im.size

    def is_pure(p):
        r, g, b, a = p
        return a > 0 and min(r, g, b) > pure_min and max(255 - r, 255 - g, 255 - b) <= 5

    seen = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            i = y * w + x
            if is_pure(px[x, y]) and not seen[i]:
                comp = []
                dq = deque([(x, y)])
                seen[i] = 1
                edge = False
                while dq:
                    cx, cy = dq.popleft()
                    comp.append((cx, cy))
                    if cx == 0 or cx == w - 1 or cy == 0 or cy == h - 1:
                        edge = True
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < w and 0 <= ny < h:
                            j = ny * w + nx
                            if is_pure(px[nx, ny]) and not seen[j]:
                                seen[j] = 1
                                dq.append((nx, ny))
                if not edge:  # 不连通四边 = 背景洞，删
                    for (cx, cy) in comp:
                        px[cx, cy] = (0, 0, 0, 0)
    return im


def remove_bg(cell):
    """边缘泛洪键控抠白底 + 连通性白底清理 + 纯白洞填充（离线，保留猫身白毛）。"""
    im = flood_key_bg(cell, bg_min=246)
    # 后清理：只删与背景连通的近纯白残留（地面阴影/反光），绝删内部白毛
    im = _flood_remove_connected_white(im, white_thresh=246)
    # 洞填充：删被猫腿封死、不连通四边的纯白背景孤岛（腿缝残留）
    return _fill_white_holes(im, pure_min=250)


def fit_contain(im, size):
    """等比缩放到能放进 size×size 的最大尺寸，居中贴到透明画布。"""
    w, h = im.size
    scale = min(size / w, size / h)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    resized = im.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    canvas.paste(resized, ((size - nw) // 2, (size - nh) // 2), resized)
    return canvas


def add_soft_shadow(im, radius=2, offset=(1, 1), opacity=80):
    """加柔和投影（不破坏照片感，仅做边缘分离）。"""
    alpha = im.getchannel('A')
    # 用 alpha 通道生成模糊阴影
    shadow = Image.new('L', im.size, 0)
    shadow.paste(alpha, offset, alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius))
    # 合成到原图下方
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    # 先画阴影层
    shadow_rgba = Image.new('RGBA', im.size, (0, 0, 0, opacity))
    shadow_rgba.putalpha(shadow)
    out = Image.alpha_composite(shadow_rgba, im)
    return out


def process_sheet(sheet):
    """处理一张 contact sheet：切片→抠图→归一化→投影→保存。"""
    prefix = sheet['prefix']
    ok = 0
    for row, col, name in sheet['grid']:
        print(f'  切片 {prefix}_{name} ...', end=' ', flush=True)
        try:
            cell = slice_cell(sheet, row, col)
            cut = remove_bg(cell)

            # 裁掉透明边缘（让主体更紧凑）
            bbox = cut.getbbox()
            if bbox:
                cut = cut.crop(bbox)

            normalized = fit_contain(cut, FINAL_SIZE)
            with_shadow = add_soft_shadow(normalized)

            dst_name = f'{prefix}_{name}.png'
            dst_path = os.path.join(OUT, dst_name)
            with_shadow.save(dst_path, compress_level=9)

            # 覆盖率自检
            alpha = with_shadow.getchannel('A')
            opaque_pixels = sum(1 for v in list(alpha.getdata()) if v > 200)
            cover = opaque_pixels / (FINAL_SIZE * FINAL_SIZE) * 100
            print(f'OK ({FINAL_SIZE}×{FINAL_SIZE} 覆盖={cover:.0f}%)')
            ok += 1
        except Exception as e:
            print(f'FAIL: {e}')
    return ok


if __name__ == '__main__':
    total = sum(len(s['grid']) for s in SHEETS)
    print(f'宠物帧处理开始：{len(SHEETS)} 张 contact sheet → {total} 帧 → {OUT}')
    ok_total = 0
    for sheet in SHEETS:
        src_name = os.path.basename(sheet['src'])
        if not os.path.exists(sheet['src']):
            print(f'SKIP {src_name}: 文件不存在')
            continue
        print(f'\n处理 {src_name} ({sheet["rows"]}×{sheet["cols"]}, {len(sheet["grid"])} 格):')
        ok_total += process_sheet(sheet)
    print(f'\n--- 完成 {ok_total}/{total} ---')
