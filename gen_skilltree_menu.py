#!/usr/bin/env python3
# gen_skilltree_menu.py — 技能树入口图标程序化生成
# 输出：public/assets/skilltree_menu.png（80x80 RGBA，1px 暗描边，compress_level=9）
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
