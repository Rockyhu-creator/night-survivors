#!/usr/bin/env python3
"""程序化像素风素材生成器：逐像素绘制 16-bit 哥特像素精灵，输出透明 PNG。"""
import math
import random
from PIL import Image, ImageDraw, ImageFilter

random.seed(7)
OUT = "public/assets"

TRANSPARENT = (0, 0, 0, 0)

def new_canvas(w, h=None):
    if h is None:
        h = w
    img = Image.new("RGBA", (w, h), TRANSPARENT)
    return img, ImageDraw.Draw(img)

def px(draw, x, y, color):
    # 边界保护：椭圆/近边绘制越界时静默跳过，避免 PIL 报错
    try:
        draw.point((x, y), fill=color)
    except Exception:
        pass

def rect(draw, x0, y0, x1, y1, color):
    draw.rectangle([x0, y0, x1, y1], fill=color)

def outline(img, color=(8, 4, 14, 255)):
    """给非透明像素描 1px 深色轮廓，像素风关键步骤。"""
    src = img.load()
    w, h = img.size
    out = Image.new("RGBA", (w, h), TRANSPARENT)
    dst = out.load()
    for y in range(h):
        for x in range(w):
            if src[x, y][3] > 0:
                dst[x, y] = src[x, y]
    for y in range(h):
        for x in range(w):
            if src[x, y][3] == 0:
                for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    nx, ny = x+dx, y+dy
                    if 0 <= nx < w and 0 <= ny < h and src[nx, ny][3] > 0:
                        dst[x, y] = color
                        break
    return out

def save(img, name, scale=1):
    img = outline(img)
    if scale != 1:
        img = img.resize((img.width*scale, img.height*scale), Image.NEAREST)
    img.save(f"{OUT}/{name}")
    print("OK", name)


# ---------- 公共：带光照的椭圆填充（像素体积感） ----------
def _clamp(v, a, b):
    return max(a, min(b, v))


def fill_ellipse_shaded(d, cx, cy, rx, ry, pal, lx=-0.35, ly=-0.9):
    """pal=(dark, mid, light)；用伪法线做上左打光，营造像素体积。"""
    dark, mid, light = pal
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            dx = (x - cx) / rx
            dy = (y - cy) / ry
            dd = dx * dx + dy * dy
            if dd > 1.0:
                continue
            z = (1 - dd) ** 0.5
            ll = dx * lx + dy * ly + z * 0.25
            b = _clamp(0.6 + 0.55 * ll, 0, 1)
            col = light if b > 0.66 else (mid if b > 0.36 else dark)
            px(d, x, y, col)


# ---------- 主角：夜裔猎人（戴兜帽斗篷） ----------
def gen_player(name, spec):
    cloth, skin, accent, feature = spec
    S = 46
    cx = 23
    img, d = new_canvas(S)
    armor = ((60, 62, 88), (150, 150, 180), (205, 205, 230))
    eye, gem = accent, (46, 204, 113)
    # 斗篷（下摆梯形，左上来光）
    for y in range(14, 43):
        half = int(3 + (y - 14) * 0.52)
        for x in range(cx - half, cx + half + 1):
            t = (x - (cx - half)) / (half * 2 + 1)
            col = cloth[2] if t < 0.22 else (cloth[1] if t < 0.72 else cloth[0])
            px(d, x, y, col)
    # 斗篷竖向褶皱（明暗）
    for y in range(16, 42, 3):
        px(d, cx - 6, y, cloth[0]); px(d, cx + 7, y, cloth[0])
        px(d, cx, y, cloth[2])
    # 靴子
    for x in range(cx - 9, cx - 3):
        px(d, x, 41, (30, 18, 26)); px(d, x, 42, (20, 12, 18))
    for x in range(cx + 3, cx + 9):
        px(d, x, 41, (30, 18, 26)); px(d, x, 42, (20, 12, 18))
    # 肩甲
    fill_ellipse_shaded(d, cx - 12, 17, 6, 5, armor)
    fill_ellipse_shaded(d, cx + 12, 17, 6, 5, armor)
    # 兜帽
    fill_ellipse_shaded(d, cx, 11, 11, 12, cloth)
    # 面部阴影
    for y in range(7, 18):
        for x in range(cx - 7, cx + 7):
            dx = (x - cx) / 7.0
            dy = (y - 13) / 9.0
            if dx * dx + dy * dy <= 1:
                px(d, x, y, (18, 6, 14, 255))
    # 兜帽顶部高光
    for y in range(2, 6):
        px(d, cx - 4 + y, y, cloth[2])
    # 眼睛 + 微光
    px(d, cx - 5, 13, (120, 20, 20, 170)); px(d, cx + 4, 13, (120, 20, 20, 170))
    px(d, cx - 4, 13, eye); px(d, cx + 3, 13, eye)
    # 胸甲
    fill_ellipse_shaded(d, cx, 24, 7, 9, armor)
    px(d, cx, 22, armor[2]); px(d, cx - 2, 24, armor[2])
    # 腰带 + 灵魂宝石
    for x in range(cx - 9, cx + 10):
        px(d, x, 30, (40, 22, 34)); px(d, x, 31, (26, 14, 24))
    px(d, cx, 30, gem); px(d, cx - 1, 30, gem); px(d, cx, 29, (120, 255, 180))
    # 侧边短刃（暗示武器）
    for i in range(11):
        x = cx + 12 + i // 3
        y = 19 + i
        px(d, x, y, (200, 60, 60) if i % 2 == 0 else (255, 150, 150))
    px(d, cx + 12, 19, (255, 200, 200))
    # 血裔专属特征（与立绘同源）
    feature(d, cx)
    save(img, name, 1)


def gen_player_default():
    gen_player('player.png', CHAR_SPECS['wanderer'])


# ---------- 蝙蝠 ----------
def gen_bat():
    S = 34
    cx = 17
    img, d = new_canvas(S)
    wing = ((60, 28, 95), (110, 55, 160), (165, 100, 210))
    body_pal = ((35, 16, 55), (70, 34, 105), (120, 60, 165))
    eye = (255, 55, 55)
    # 膜翼（左右）
    for side in (-1, 1):
        fill_ellipse_shaded(d, cx + side * 9, 16, 9, 7, wing)
        for k in range(1, 9):  # 翅脉
            px(d, cx + side * k, 16 - abs(k) // 3, wing[0])
        for k in range(2, 16, 3):  # 扇贝下缘
            px(d, cx + side * k, 21 - abs(k) // 4, TRANSPARENT)
    # 身体
    fill_ellipse_shaded(d, cx, 18, 4, 6, body_pal)
    # 耳朵
    px(d, cx - 4, 10, body_pal[1]); px(d, cx + 3, 10, body_pal[1])
    px(d, cx - 4, 9, body_pal[0]); px(d, cx + 3, 9, body_pal[0])
    # 眼睛 + 獠牙
    px(d, cx - 3, 17, eye); px(d, cx + 2, 17, eye)
    px(d, cx - 3, 18, (255, 200, 200)); px(d, cx + 2, 18, (255, 200, 200))
    px(d, cx - 2, 20, (245, 245, 245)); px(d, cx + 1, 20, (245, 245, 245))
    save(img, "enemy_bat.png", 1)


# ---------- 骷髅 ----------
def gen_skeleton():
    S = 42
    cx = 21
    img, d = new_canvas(S)
    bone = ((150, 140, 118), (220, 212, 190), (245, 242, 228))
    eye = (90, 255, 120)
    # 颅骨
    fill_ellipse_shaded(d, cx, 12, 9, 9, bone)
    # 下颌
    for y in range(19, 22):
        for x in range(cx - 5, cx + 6):
            px(d, x, y, bone[1])
    for x in range(cx - 5, cx + 6, 2):  # 牙缝
        px(d, x, 20, bone[0]); px(d, x, 21, bone[0])
    # 眼窝 + 绿眼
    for side in (-1, 1):
        for y in range(9, 14):
            for x in range(cx + side * 3 - 2, cx + side * 3 + 2):
                dx = (x - (cx + side * 3)) / 2.2
                dy = (y - 11) / 2.6
                if dx * dx + dy * dy <= 1:
                    px(d, x, y, (40, 50, 35, 255))
        px(d, cx + side * 3, 11, eye); px(d, cx + side * 3 - 1, 11, eye)
        px(d, cx + side * 3, 10, (180, 255, 180, 160))
    # 鼻腔
    for y in range(14, 17):
        px(d, cx, y, bone[0])
    # 脊柱
    for y in range(22, 35):
        px(d, cx, y, bone[0])
    # 肋骨（每对留中缝）
    for y in (25, 28, 31):
        for x in range(cx - 9, cx - 1):
            px(d, x, y, bone[1])
        for x in range(cx + 2, cx + 10):
            px(d, x, y, bone[1])
        px(d, cx - 1, y, bone[0]); px(d, cx + 1, y, bone[0])
    # 手臂 + 手
    for i in range(8):
        px(d, cx - 9 - i // 2, 24 + i, bone[1])
        px(d, cx + 9 + i // 2, 24 + i, bone[1])
    fill_ellipse_shaded(d, cx - 13, 33, 2, 2, bone)
    fill_ellipse_shaded(d, cx + 13, 33, 2, 2, bone)
    # 右手持剑
    metal = (180, 180, 200)
    for i in range(10):
        px(d, cx + 14 + i // 2, 24 + i, metal)
    px(d, cx + 13, 24, metal); px(d, cx + 17, 24, metal)  # 护手
    save(img, "enemy_skeleton.png", 1)


# ---------- 史莱姆 ----------
def gen_slime():
    S = 54
    cx = 27
    img, d = new_canvas(S)
    goo = ((20, 90, 50), (40, 170, 90), (120, 230, 150))
    eye_w, pupil = (245, 245, 245), (10, 40, 20)
    def _half(y):
        if y <= 32:
            v = 22 * (1 - ((y - 32) / 20.0) ** 2) ** 0.5
            return int(max(0, v))
        return 21
    # 身体：圆顶 + 扁平底
    for y in range(14, 50):
        half = _half(y)
        for x in range(cx - half, cx + half + 1):
            px(d, x, y, goo[1])
    # 体积光照（上左亮、边缘暗）
    for y in range(14, 50):
        half = _half(y)
        for x in range(cx - half, cx + half + 1):
            dx = (x - cx) / (half + 1)
            dy = (y - 32) / 20.0
            dd = (dx * dx + dy * dy) ** 0.5
            if dd > 0.78:
                px(d, x, y, goo[0])
            elif dx < -0.3 and dy < -0.2:
                px(d, x, y, goo[2])
    # 内核辉光（半透明亮）
    for y in range(26, 42):
        for x in range(cx - 8, cx + 9):
            dx = (x - cx) / 9.0
            dy = (y - 34) / 9.0
            if dx * dx + dy * dy <= 1:
                px(d, x, y, (90, 240, 150, 150))
    # 高光
    for i in range(5):
        px(d, cx - 8 + i, 18 - i // 3, goo[2])
    # 嵌骨
    px(d, cx + 6, 40, (235, 230, 215)); px(d, cx + 7, 41, (235, 230, 215))
    px(d, cx - 9, 44, (235, 230, 215))
    # 眼睛
    for side in (-1, 1):
        for y in range(28, 33):
            for x in range(cx + side * 6 - 3, cx + side * 6 + 3):
                dx = (x - (cx + side * 6)) / 3.0
                dy = (y - 30) / 3.0
                if dx * dx + dy * dy <= 1:
                    px(d, x, y, eye_w)
        px(d, cx + side * 6 - 1, 30, pupil); px(d, cx + side * 6, 30, pupil)
        px(d, cx + side * 6 - 1, 29, (200, 235, 255))  # 眼神光
    # 滴落
    px(d, cx + 10, 48, goo[2]); px(d, cx + 10, 49, goo[1])
    save(img, "enemy_slime.png", 1)


# ---------- 精英吸血鬼领主 ----------
def gen_elite():
    S = 96
    cx = 48
    img, d = new_canvas(S)
    armor = ((28, 22, 42), (90, 70, 125), (150, 120, 190))
    gold = (212, 175, 55)
    wing = ((55, 24, 90), (110, 55, 160), (160, 95, 205))
    eye, aura = (255, 60, 60), (200, 40, 60)
    # 披风（身后暗色）
    for y in range(30, 86):
        half = int(10 + (y - 30) * 0.6)
        for x in range(cx - half, cx + half + 1):
            px(d, x, y, (22, 14, 34, 255))
    # 翅膀（左右大膜翼）
    for side in (-1, 1):
        fill_ellipse_shaded(d, cx + side * 30, 44, 27, 34, wing)
        for k in range(1, 22):  # 翅脉
            px(d, cx + side * k, 44 - abs(k) // 3, wing[0])
        for k in range(4, 56, 6):  # 扇贝下缘
            px(d, cx + side * k, 70 - abs(k) // 6, TRANSPARENT)
    # 身体铠甲（倒梯形 + 椭圆）
    fill_ellipse_shaded(d, cx, 54, 15, 30, armor)
    for y in range(40, 80):
        half = int(14 - (y - 54) * 0.18) if y < 54 else int(14 + (y - 54) * 0.12)
        for x in range(cx - half, cx + half + 1):
            t = (x - (cx - half)) / (half * 2 + 1)
            col = armor[2] if t < 0.2 else (armor[1] if t < 0.75 else armor[0])
            px(d, x, y, col)
    # 胸口金纹
    for y in range(46, 64):
        px(d, cx, y, gold)
    px(d, cx - 2, 50, gold); px(d, cx + 2, 50, gold)
    # 头盔
    fill_ellipse_shaded(d, cx, 30, 12, 12, armor)
    # 金冠 + 犄角
    for y in range(16, 22):
        for x in range(cx - 10, cx + 11):
            if x % 4 != 0:
                px(d, x, y, gold)
    px(d, cx - 9, 16, gold); px(d, cx + 9, 16, gold)
    px(d, cx - 11, 12, gold); px(d, cx + 11, 12, gold)  # 犄角尖
    px(d, cx - 10, 14, gold); px(d, cx + 10, 14, gold)
    # 面部阴影
    for y in range(24, 36):
        for x in range(cx - 7, cx + 7):
            dx = (x - cx) / 7.0
            dy = (y - 30) / 8.0
            if dx * dx + dy * dy <= 1:
                px(d, x, y, (14, 8, 22, 255))
    # 眼睛 + 红芒
    px(d, cx - 6, 29, (120, 20, 20, 160)); px(d, cx + 5, 29, (120, 20, 20, 160))
    px(d, cx - 4, 30, eye); px(d, cx + 3, 30, eye)
    save(img, "enemy_elite.png", 1)


# ---------- 武器图标 ----------
def gen_blade():
    # 忍者飞刀(kunai)：朝右(+x)尖刺刀身 + 护手 + 握柄环 + 镂孔 + 缠绳，体积光
    S = 40
    img, d = new_canvas(S)
    steel_d, steel_m, steel_l = (64, 72, 92, 255), (150, 162, 188, 255), (228, 238, 252, 255)
    ring_d, ring_m = (70, 74, 90, 255), (120, 126, 146, 255)
    wrap = (150, 60, 60, 255)
    cy = 20
    # 刀身（朝右尖刺，上亮下暗）
    for i in range(26):
        x = 12 + i
        t = i / 25
        half = max(1, round(5 * (1 - t * 0.82)))
        for w in range(-half, half + 1):
            y = cy + w
            col = steel_l if w < -half * 0.35 else (steel_m if w < 0 else steel_d)
            px(d, x, y, col)
    # 刀尖高光
    for i in range(7):
        px(d, 33 + i, cy, steel_l)
        px(d, 34 + i, cy - 1, steel_l)
    # 护手（竖直短杠）
    for y in range(cy - 8, cy + 9):
        px(d, 10, y, ring_m); px(d, 11, y, ring_d)
    # 握柄环（左端圆）
    for y in range(cy - 6, cy + 7):
        for x in range(4, 11):
            dx = (x - 7) / 6.0; dy = (y - cy) / 6.0
            if dx * dx + dy * dy <= 1:
                px(d, x, y, ring_m if dx < 0.2 else ring_d)
    # 镂孔（透明）
    for y in range(cy - 3, cy + 4):
        for x in range(5, 10):
            dx = (x - 7) / 3.0; dy = (y - cy) / 3.0
            if dx * dx + dy * dy <= 1:
                px(d, x, y, (0, 0, 0, 0))
    # 缠绳
    for y in range(cy - 4, cy + 1):
        for x in range(11, 14):
            px(d, x, y, wrap)
    save(img, "weapon_blade.png", 2)

def gen_holywater():
    S = 40
    img, d = new_canvas(S)
    glass, water, cross, cork = (182, 206, 226, 200), (58, 140, 222, 235), (236, 200, 92, 255), (122, 80, 40, 255)
    # 瓶身（下宽上窄）
    for y in range(15, 33):
        w = 7 + (32 - y) // 3
        for x in range(20 - w, 20 + w + 1):
            px(d, x, y, glass)
    # 圣水
    for y in range(18, 31):
        for x in range(16, 25):
            px(d, x, y, water)
    # 瓶颈 + 木塞
    rect(d, 17, 9, 22, 15, glass)
    rect(d, 16, 6, 23, 9, cork)
    # 十字
    rect(d, 19, 19, 20, 28, cross); rect(d, 16, 22, 23, 24, cross)
    # 玻璃高光
    px(d, 15, 18, (220, 240, 255, 220)); px(d, 15, 20, (220, 240, 255, 220))
    save(img, "weapon_holywater.png", 2)

def gen_axe():
    S = 40
    img, d = new_canvas(S)
    metal, metal_hi, handle, wrap = (176, 186, 216, 255), (226, 236, 255, 255), (96, 60, 32, 255), (150, 60, 60, 255)
    # 双刃斧头（顶部，左右弯刃）
    for i in range(12):
        px(d, 8 + i, 6 + i // 3, metal_hi)
        px(d, 8 + i, 8 + i // 3, metal)
        px(d, 8 + i, 10 + i // 3, (120, 128, 150, 255))
        px(d, 31 - i, 6 + i // 3, metal_hi)
        px(d, 31 - i, 8 + i // 3, metal)
        px(d, 31 - i, 10 + i // 3, (120, 128, 150, 255))
    for i in range(6):  # 刃尖高光
        px(d, 9 + i, 6 + i // 3, metal_hi); px(d, 30 - i, 6 + i // 3, metal_hi)
    # 柄 + 缠绳
    rect(d, 18, 8, 21, 34, handle)
    rect(d, 16, 14, 23, 17, wrap)
    save(img, "weapon_axe.png", 2)

def gen_lightning():
    S = 40
    img, d = new_canvas(S)
    bolt, bolt_hi = (245, 215, 110, 255), (255, 246, 192, 255)
    pts = [(22, 4), (15, 16), (23, 17), (14, 28), (22, 29), (12, 36)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for i in range(steps):
            x = x0 + (x1 - x0) * i / steps
            y = y0 + (y1 - y0) * i / steps
            xi, yi = round(x), round(y)
            px(d, xi, yi, bolt_hi if i % 3 == 0 else bolt)
            px(d, xi + 1, yi, bolt); px(d, xi, yi + 1, bolt)
    save(img, "weapon_lightning.png", 2)


# ---------- 经验宝石 ----------
def gen_gem(name, base, light, dark):
    S = 36
    img, d = new_canvas(S)
    cx, cy = 18, 18
    # 菱形刻面宝石（对角线分 3 面）
    for y in range(4, 33):
        half = 14 - abs(y - 18) if y < 18 else 14 - (y - 18)
        if half < 0:
            half = 0
        for x in range(cx - half, cx + half + 1):
            f = (x - cx) + (y - cy)
            color = light if f > 6 else (dark if f < -6 else base)
            px(d, x, y, color)
    # 内核辉光
    for y in range(13, 24):
        for x in range(14, 23):
            if (x - 18) ** 2 + (y - 18) ** 2 < 16:
                px(d, x, y, light)
    # 顶部高光
    rect(d, 14, 9, 17, 11, light)
    px(d, 13, 10, light); px(d, 18, 10, light)
    save(img, name, 2)


# ---------- 地面纹理（无缝平铺） ----------
def gen_ground():
    # 哥特石砖墓园地面：256×256 无缝平铺，直接生成（不再放大避免模糊）
    S = 256
    img = Image.new("RGBA", (S, S), (38, 32, 52, 255))
    d = ImageDraw.Draw(img)
    # 颗粒噪点（石板色微扰，形成地面颗粒质感）
    stones = [(32, 27, 45), (40, 34, 56), (36, 30, 50), (44, 38, 62), (30, 25, 42)]
    for _ in range(34000):
        x = random.randint(0, S - 1)
        y = random.randint(0, S - 1)
        px(d, x, y, stones[random.randrange(len(stones))])
    # 周期石板网格（32px 一格, 8×8, 跨边界无缝）
    GRID = 32
    seam = (15, 11, 24, 255)
    seam_hi = (56, 48, 72, 255)
    for g in range(0, S + 1, GRID):
        d.line([(g, 0), (g, S)], fill=seam)
        if g + 1 < S:
            d.line([(g + 1, 0), (g + 1, S)], fill=seam_hi)
        d.line([(0, g), (S, g)], fill=seam)
        if g + 1 < S:
            d.line([(0, g + 1), (S, g + 1)], fill=seam_hi)
    # 裂纹（自由分支, wrap 保证无缝）
    def crack(x, y, n):
        for _ in range(n):
            px(d, x % S, y % S, (18, 13, 28, 255))
            px(d, (x + S) % S, (y + S) % S, (18, 13, 28, 255))
            x += random.choice((-1, 0, 1))
            y += random.choice((0, 1, -1))
    for _ in range(12):
        crack(random.randint(0, S - 1), random.randint(0, S - 1), random.randint(6, 18))
    # 苔斑（暗绿, wrap）
    moss = (46, 66, 46, 255)
    for _ in range(46):
        cx, cy = random.randint(0, S - 1), random.randint(0, S - 1)
        for _ in range(random.randint(3, 9)):
            px(d, (cx + random.randint(-2, 2)) % S, (cy + random.randint(-2, 2)) % S, moss)
    # 暗红血渍（半透明晕染, wrap）—— 呼应夜裔/战斗主题
    for _ in range(16):
        cx, cy = random.randint(0, S - 1), random.randint(0, S - 1)
        r = random.randint(2, 5)
        for yy in range(-r, r + 1):
            for xx in range(-r, r + 1):
                if xx * xx + yy * yy <= r * r:
                    a = 150 if (xx * xx + yy * yy) < r * r * 0.4 else 70
                    px(d, (cx + xx) % S, (cy + yy) % S, (95, 22, 28, a))
    # 零散小碎石高光
    for _ in range(40):
        px(d, random.randint(0, S - 1), random.randint(0, S - 1), (62, 54, 78, 255))
    img.save(f"{OUT}/ground.png")
    print("OK ground.png")


# ---------- 环境装饰：墓碑 / 枯木 / 碎石（带体积光 + 投影，随精灵描边） ----------
def gen_decal_tomb():
    W, H = 16, 30
    img, d = new_canvas(W, H)
    d.ellipse([2, 26, 14, 30], fill=(22, 16, 30, 255))  # 底部投影
    for y in range(8, 27):                               # 碑身（左亮右暗）
        for x in range(5, 12):
            t = (x - 5) / 6
            col = (150, 145, 165) if t < 0.34 else ((118, 113, 136) if t < 0.67 else (80, 76, 96))
            px(d, x, y, col)
    fill_ellipse_shaded(d, 8, 8, 5, 5, ((80, 76, 96), (118, 113, 136), (160, 155, 175)))  # 拱顶
    for y in range(13, 23):                              # 十字铭文（暗刻）
        for x in range(7, 10):
            px(d, x, y, (40, 36, 52, 255))
    for x in range(5, 12):
        for y in range(16, 19):
            px(d, x, y, (40, 36, 52, 255))
    for y in range(26, 29):                              # 底座
        for x in range(3, 14):
            px(d, x, y, (68, 64, 82, 255))
    save(img, "decal_tomb.png", 1)


def gen_decal_wood():
    W, H = 20, 34
    img, d = new_canvas(W, H)
    d.ellipse([3, 30, 17, 34], fill=(22, 16, 30, 255))   # 投影
    for y in range(6, 33):                               # 主干（左亮右暗）
        for x in range(9, 14):
            t = (x - 9) / 5
            col = (120, 104, 84) if t < 0.4 else ((92, 80, 64) if t < 0.7 else (60, 50, 40))
            px(d, x, y, col)
    for y in range(8, 31):                               # 树皮竖纹
        if random.random() < 0.3:
            px(d, random.randint(10, 12), y, (48, 40, 32, 255))
    for i in range(7):                                   # 左枝
        px(d, 9 - i // 2, 20 + i // 2, (84, 72, 58, 255))
    for i in range(5):
        px(d, 4 + i, 17 - i // 2, (84, 72, 58, 255))
    for i in range(7):                                   # 右枝
        px(d, 13 + i // 2, 14 + i // 2, (84, 72, 58, 255))
    for i in range(4):
        px(d, 15 + i, 11 - i // 2, (84, 72, 58, 255))
    px(d, 10, 6, (60, 50, 40)); px(d, 11, 6, (60, 50, 40))  # 顶部断尖
    px(d, 10, 5, (84, 72, 58)); px(d, 11, 5, (84, 72, 58))
    save(img, "decal_wood.png", 1)


def gen_decal_rubble():
    W, H = 28, 16
    img, d = new_canvas(W, H)
    d.ellipse([2, 11, 26, 16], fill=(22, 16, 30, 255))   # 投影
    fill_ellipse_shaded(d, 10, 9, 6, 3, ((70, 66, 84), (112, 107, 128), (156, 150, 172)))
    fill_ellipse_shaded(d, 18, 10, 4, 3, ((66, 62, 80), (108, 103, 124), (148, 143, 164)))
    fill_ellipse_shaded(d, 22, 9, 3, 2, ((64, 60, 78), (104, 99, 120), (140, 135, 158)))
    fill_ellipse_shaded(d, 6, 10, 3, 2, ((70, 66, 84), (110, 105, 126), (150, 145, 166)))
    save(img, "decal_rubble.png", 1)


def gen_decal_bone():
    W, H = 26, 14
    img, d = new_canvas(W, H)
    d.ellipse([2, 10, 24, 14], fill=(22, 16, 30, 255))   # 投影
    bone_d, bone_m, bone_l = (150, 142, 124, 255), (190, 182, 164, 255), (238, 234, 220, 255)
    # 散落骨头1（水平）
    for x in range(4, 14):
        px(d, x, 7, bone_m); px(d, x, 8, bone_m)
    fill_ellipse_shaded(d, 4, 7.5, 2, 2, (bone_d, bone_m, bone_l))
    fill_ellipse_shaded(d, 13, 7.5, 2, 2, (bone_d, bone_m, bone_l))
    # 散落骨头2（略斜，偏下）
    for x in range(11, 21):
        py = 10 + (x - 11) // 4
        px(d, x, py, bone_m); px(d, x, py + 1, bone_m)
    fill_ellipse_shaded(d, 11, 10, 2, 2, (bone_d, bone_m, bone_l))
    fill_ellipse_shaded(d, 20, 12, 2, 2, (bone_d, bone_m, bone_l))
    # 颅骨
    fill_ellipse_shaded(d, 19, 5, 3, 3, ((150, 142, 124), (200, 192, 174), (240, 236, 222)))
    px(d, 18, 5, (40, 36, 30)); px(d, 20, 5, (40, 36, 30))  # 眼窝
    for x in range(17, 22):
        px(d, x, 8, bone_d)  # 下颌
    save(img, "decal_bone.png", 1)


def gen_decal_cross():
    W, H = 14, 22
    img, d = new_canvas(W, H)
    d.ellipse([2, 17, 12, 21], fill=(22, 16, 30, 255))   # 投影
    stone_d, stone_m, stone_l = (80, 76, 96, 255), (112, 107, 128, 255), (160, 155, 175, 255)
    # 竖杆
    for y in range(3, 21):
        for x in range(6, 9):
            t = (x - 6) / 3
            px(d, x, y, stone_m if t < 0.5 else stone_d)
    # 横杆
    for y in range(8, 12):
        for x in range(2, 12):
            t = (x - 2) / 10
            px(d, x, y, stone_m if 0.2 < t < 0.8 else stone_d)
    fill_ellipse_shaded(d, 7, 3, 2, 2, (stone_d, stone_m, stone_l))  # 顶端圆头
    px(d, 7, 12, (60, 56, 76)); px(d, 7, 13, (60, 56, 76))  # 裂纹
    save(img, "decal_cross.png", 1)


# ---------- 标题背景 ----------
def gen_bg():
    W, H = 960, 540
    img = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(img)
    # 夜空渐变
    for y in range(H):
        t = y / H
        r = int(20 + 30 * t); g = int(10 + 12 * t); b = int(40 + 30 * t)
        d.line([(0, y), (W, y)], fill=(r, g, b, 255))
    # 血月
    moon_x, moon_y, mr = 700, 130, 70
    for y in range(H):
        for x in range(W):
            dist = math.hypot(x - moon_x, y - moon_y)
            if dist < mr:
                shade = 1 - dist / mr * 0.4
                px(d, x, y, (int(220*shade), int(70*shade), int(60*shade), 255))
            elif dist < mr * 1.8:
                a = int(60 * (1 - (dist - mr) / (mr * 0.8)))
                if a > 0:
                    px(d, x, y, (200, 60, 50, a))
    # 星星
    for _ in range(120):
        x, y = random.randint(0, W-1), random.randint(0, H//2)
        b = random.randint(120, 255)
        px(d, x, y, (b, b, min(255, b+20), 255))
    # 城堡剪影（山丘 + 塔楼）
    for x in range(W):
        hill = int(420 + 40 * math.sin(x / 180))
        d.line([(x, hill), (x, H)], fill=(10, 6, 18, 255))
    def tower(cx, w, h, base):
        rect(d, cx - w//2, base - h, cx + w//2, base, (10, 6, 18, 255))
        for i in range(w // 2 + 2):  # 尖顶
            d.line([(cx - w//2 - 1 + i, base - h - i*2), (cx + w//2 + 1 - i, base - h - i*2)], fill=(10, 6, 18, 255))
        for wy in range(base - h + 14, base - 10, 26):  # 窗
            rect(d, cx - 3, wy, cx + 3, wy + 8, (230, 180, 60, 255))
    tower(240, 60, 170, 430)
    tower(180, 40, 110, 440)
    tower(310, 44, 130, 435)
    # 蝙蝠群剪影
    for _ in range(30):
        x, y = random.randint(50, W-50), random.randint(40, 300)
        s = random.randint(2, 5)
        d.arc([x-s*2, y-s, x, y+s], 200, 340, fill=(5, 3, 10, 255), width=2)
        d.arc([x, y-s, x+s*2, y+s], 200, 340, fill=(5, 3, 10, 255), width=2)
    # 雾气
    fog = Image.new("RGBA", (W, H), (0,0,0,0))
    fd = ImageDraw.Draw(fog)
    for _ in range(40):
        x, y = random.randint(0, W), random.randint(H-160, H)
        rx, ry = random.randint(60, 200), random.randint(10, 30)
        fd.ellipse([x-rx, y-ry, x+rx, y+ry], fill=(80, 60, 110, 18))
    fog = fog.filter(ImageFilter.GaussianBlur(8))
    img = Image.alpha_composite(img, fog)
    img.convert("RGB").save(f"{OUT}/bg_title.png")
    print("OK bg_title.png")


# ---------- 骷髅图标 ----------
def gen_icon_skull():
    S = 40
    img, d = new_canvas(S)
    bone, bone_d, eye = (233, 227, 206, 255), (150, 145, 130, 255), (255, 50, 50, 255)
    # 颅骨（上宽下窄）
    for y in range(6, 28):
        w = 13 if y < 22 else 13 - (y - 22) * 2
        for x in range(20 - w, 20 + w + 1):
            px(d, x, y, bone)
    # 眼窝
    for y in range(13, 22):
        for x in range(11, 16):
            px(d, x, y, bone_d)
        for x in range(24, 29):
            px(d, x, y, bone_d)
    # 发光眼
    for (x, y) in ((13, 17), (14, 17), (13, 18), (14, 18), (26, 17), (27, 17), (26, 18), (27, 18)):
        px(d, x, y, eye)
    # 鼻腔
    rect(d, 19, 22, 20, 25, bone_d)
    # 牙齿行
    for x in range(13, 28):
        if x % 3 != 0:
            px(d, x, 26, bone); px(d, x, 27, bone_d)
    rect(d, 12, 27, 28, 28, bone_d)
    save(img, "icon_skull.png", 2)


# ---------- 血瓶（拾取回血道具） ----------
def gen_potion():
    # 球形烧瓶盛血，木塞封口，像素体积光；风格对齐经验宝石一套管线
    S = 36
    img, d = new_canvas(S)
    cx = 18
    blood_pal = ((140, 16, 32), (205, 32, 50), (255, 120, 130))
    glass = (210, 228, 240, 150)
    cork_d, cork_m, cork_l = (70, 44, 22), (122, 80, 40), (178, 128, 76)
    # 球形瓶身（血色体积光，上左来光）
    fill_ellipse_shaded(d, cx, 23, 11, 11, blood_pal)
    # 瓶内血浆液面（上半更亮，示意满瓶血液）
    for y in range(16, 21):
        for x in range(cx - 8, cx + 9):
            dx = (x - cx) / 11.0
            dy = (y - 23) / 11.0
            if dx * dx + dy * dy <= 1:
                px(d, x, y, (235, 64, 80))
    # 瓶颈（玻璃半透明）
    rect(d, cx - 3, 8, cx + 2, 14, glass)
    # 木塞（左亮右暗）
    for y in range(3, 9):
        for x in range(cx - 4, cx + 5):
            t = (x - (cx - 4)) / 9
            px(d, x, y, cork_l if t < 0.3 else (cork_m if t < 0.7 else cork_d))
    # 玻璃高光点
    px(d, cx - 6, 18, (255, 255, 255, 220)); px(d, cx - 7, 20, (255, 255, 255, 170))
    px(d, cx - 5, 16, (255, 255, 255, 170))
    save(img, "potion.png", 2)


import os
os.makedirs(OUT, exist_ok=True)


# ---------- 神器图标 ----------
def gen_art_storm():  # 千刃风暴：三把猩红飞刃 120° 风轮
    S = 40
    img, d = new_canvas(S)
    body, tip, core = (220, 60, 60, 255), (255, 160, 160, 255), (255, 220, 220, 255)
    cx, cy = 20, 20
    for k in range(3):
        a = math.radians(k * 120)
        for i in range(5, 17):
            x, y = cx + math.cos(a) * i, cy - math.sin(a) * i
            px(d, round(x), round(y), tip if i >= 15 else body)
            px(d, round(x) + 1, round(y), body); px(d, round(x), round(y) + 1, body)
    for y in range(17, 24):
        for x in range(17, 24):
            if (x - 20) ** 2 + (y - 20) ** 2 < 12:
                px(d, x, y, core)
    save(img, "art_storm.png", 2)

def gen_art_devour():  # 圣洁吞噬：圣杯涌出蓝色圣焰
    S = 40
    img, d = new_canvas(S)
    metal, metal_hi, base_c, flame, flame_hi = (200, 200, 220, 255), (240, 240, 255, 255), (140, 140, 170, 255), (74, 163, 223, 255), (170, 216, 255, 255)
    # 圣焰（杯口向上）
    flame_rows = {6: (18,), 7: (18,), 8: (17, 18), 9: (18, 19), 10: (17, 18, 19), 11: (16, 17, 18, 19, 20), 12: (16, 17, 18, 19, 20)}
    for y, xs in flame_rows.items():
        for x in xs:
            px(d, x, y, flame)
    for (x, y) in ((18, 7), (18, 8), (18, 9), (17, 10), (18, 10), (19, 10)):
        px(d, x, y, flame_hi)
    # 杯身
    rect(d, 11, 14, 29, 16, metal)
    for y in range(16, 26):
        w = 8 - (y - 16) // 2
        for x in range(20 - w, 20 + w + 1):
            px(d, x, y, metal)
    rect(d, 13, 15, 16, 19, metal_hi)
    px(d, 22, 14, flame_hi)
    rect(d, 18, 26, 21, 28, metal)
    rect(d, 12, 28, 28, 30, base_c)
    save(img, "art_devour.png", 2)

def gen_art_spiral():  # 死亡螺旋：6 把小斧刃绕中心环列
    S = 40
    img, d = new_canvas(S)
    metal, metal_hi, grip = (175, 185, 215, 255), (226, 236, 255, 255), (96, 60, 32, 255)
    cx, cy, r = 20, 20, 14
    for k in range(6):
        a = math.radians(k * 60 + 90)
        x = round(cx + math.cos(a) * r)
        y = round(cy - math.sin(a) * r)
        for dx in range(3):
            for dy in range(3):
                px(d, x + dx, y + dy, metal)
        hx = round(cx + math.cos(a) * (r + 2))
        hy = round(cy - math.sin(a) * (r + 2))
        px(d, hx, hy, metal_hi); px(d, hx + 1, hy, metal_hi)
    rect(d, 18, 18, 21, 21, grip)
    save(img, "art_spiral.png", 2)

def gen_art_stormcall():  # 雷霆循环：首尾相接的锯齿闪电环
    S = 40
    img, d = new_canvas(S)
    bolt, bolt_hi = (245, 215, 110, 255), (255, 246, 192, 255)
    cx, cy = 20, 20
    pts = []
    for k in range(12):
        a = math.radians(k * 30)
        r = 16 if k % 2 == 0 else 10
        pts.append((cx + math.cos(a) * r, cy - math.sin(a) * r))
    for k in range(12):
        (x0, y0), (x1, y1) = pts[k], pts[(k + 1) % 12]
        steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for i in range(steps):
            x = x0 + (x1 - x0) * i / steps
            y = y0 + (y1 - y0) * i / steps
            xi, yi = round(x), round(y)
            px(d, xi, yi, bolt_hi if i % 3 == 0 else bolt)
            px(d, xi + 1, yi, bolt); px(d, xi, yi + 1, bolt)
    save(img, "art_stormcall.png", 2)

def gen_art_crimson():  # 猩红之拥（隐藏）：血滴包裹心脏
    S = 40
    img, d = new_canvas(S)
    edge, body, heart, glint = (120, 15, 25, 255), (182, 32, 46, 255), (222, 72, 92, 255), (255, 150, 160, 255)
    cx = 20
    for y in range(6, 34):
        if y <= 14:
            dd = (14 - y) * (14 - y)
            half = int((121 - dd) ** 0.5) if dd < 121 else 0
        else:
            half = int((33 - y) * 0.75)
            if half < 0:
                half = 0
        for x in range(cx - half, cx + half + 1):
            px(d, x, y, edge if x in (cx - half, cx + half) else body)
    heart_pts = [(15, 13), (16, 13), (18, 13), (19, 13),
                 (15, 14), (16, 14), (17, 14), (18, 14), (19, 14),
                 (16, 15), (17, 15), (18, 15), (17, 16)]
    for (x, y) in heart_pts:
        px(d, x, y, heart)
    px(d, 14, 9, glint)
    save(img, "art_crimson.png", 2)

def gen_art_tempest():  # 雷劫（隐藏）：粗壮紫雷劈落裂纹地面
    S = 40
    img, d = new_canvas(S)
    bolt, core, ground, crack = (180, 120, 230, 255), (230, 200, 255, 255), (40, 30, 55, 255), (15, 10, 25, 255)
    pts = [(24, 2), (18, 12), (24, 18), (14, 26), (20, 32), (16, 36)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for i in range(steps):
            x = x0 + (x1 - x0) * i / steps
            y = y0 + (y1 - y0) * i / steps
            xi, yi = round(x), round(y)
            px(d, xi, yi, core)
            px(d, xi - 1, yi, bolt); px(d, xi + 1, yi, bolt)
    for fx in (12, 21, 28):
        px(d, fx, 35, bolt)
    rect(d, 0, 36, 39, 39, ground)
    px(d, 8, 36, crack); px(d, 9, 37, crack)
    px(d, 24, 37, crack); px(d, 25, 36, crack)
    px(d, 30, 37, crack); px(d, 31, 36, crack)
    save(img, "art_tempest.png", 2)


# ---------- 武器丰富化：3 把新武器图标（2026-07-23） ----------
def gen_weapon_aura():  # 亡灵光环：红色圆环 + 六芒星
    S = 40
    img, d = new_canvas(S)
    cx, cy = 20, 20
    red_m, red_l = (190, 30, 44, 255), (240, 95, 105, 255)
    # 外红环
    for r in (16, 13):
        col = red_m if r == 16 else red_l
        for a in range(0, 360, 3):
            rad = math.radians(a)
            px(d, round(cx + math.cos(rad) * r), round(cy + math.sin(rad) * r), col)
    # 六芒星：两个重叠等边三角形
    R = 11
    up = [(cx + math.cos(-math.pi / 2 + k * 2 * math.pi / 3) * R,
           cy + math.sin(-math.pi / 2 + k * 2 * math.pi / 3) * R) for k in range(3)]
    down = [(cx + math.cos(math.pi / 2 + k * 2 * math.pi / 3) * R,
             cy + math.sin(math.pi / 2 + k * 2 * math.pi / 3) * R) for k in range(3)]
    d.polygon([(round(x), round(y)) for (x, y) in up], fill=(150, 20, 32, 170))
    d.polygon([(round(x), round(y)) for (x, y) in down], fill=(200, 50, 60, 150))
    for poly in (up, down):
        d.line([(round(x), round(y)) for (x, y) in poly] +
               [(round(poly[0][0]), round(poly[0][1]))], fill=red_l, width=1)
    px(d, cx, cy, red_l)
    save(img, "weapon_aura.png", 2)

def gen_weapon_whip():  # 噬魂长鞭：弯曲鞭身 + 柄 + 尖
    S = 40
    img, d = new_canvas(S)
    leather, leather_hi, tip = (120, 50, 60, 255), (200, 110, 120, 255), (240, 200, 180, 255)
    pts = []
    for i in range(20):
        t = i / 19
        x = 8 + t * 22
        y = 6 + math.sin(t * math.pi * 1.5) * 18 + t * 10
        pts.append((x, y))
    for (x, y) in pts:
        xi, yi = round(x), round(y)
        px(d, xi, yi, leather_hi); px(d, xi + 1, yi, leather); px(d, xi, yi + 1, leather)
    rect(d, 6, 4, 10, 9, leather)
    px(d, round(pts[-1][0]), round(pts[-1][1]), tip)
    save(img, "weapon_whip.png", 2)

def gen_weapon_cross():  # 黎明圣印：放射光芒 + 金环 + 十字
    S = 40
    img, d = new_canvas(S)
    gold, gold_hi, ray = (212, 175, 55, 255), (255, 230, 140, 255), (255, 210, 90, 255)
    cx, cy = 20, 20
    for k in range(8):  # 放射
        a = math.radians(k * 45 + 22.5)
        for r in range(16, 19):
            px(d, round(cx + math.cos(a) * r), round(cy + math.sin(a) * r), ray)
    for r in (13, 11):  # 环
        col = gold if r == 11 else gold_hi
        for a in range(0, 360, 4):
            rad = math.radians(a)
            px(d, round(cx + math.cos(rad) * r), round(cy + math.sin(rad) * r), col)
    rect(d, 18, 9, 22, 31, gold); rect(d, 14, 16, 26, 24, gold)
    px(d, 19, 10, gold_hi); px(d, 20, 10, gold_hi)
    save(img, "weapon_cross.png", 2)


# ---------- 武器丰富化：3 个新进化神器图标（2026-07-23） ----------
def gen_art_sepulcher():  # 寂灭结界：紫光包裹棺木 + 十字铭文
    S = 40
    img, d = new_canvas(S)
    glow = (180, 90, 200, 255); glow_hi = (230, 170, 240, 255)
    wood_d, wood_m, wood_l = (70, 40, 90, 255), (120, 80, 140, 255), (170, 120, 190, 255)
    cx = 20
    for y in range(4, 36):
        for x in range(4, 36):
            dx = (x - cx) / 16.0; dy = (y - 20) / 16.0
            dd = dx * dx + dy * dy
            if dd < 1:
                px(d, x, y, (glow[0], glow[1], glow[2], int(70 * (1 - dd))))
    for y in range(8, 33):  # 棺木（菱形）
        half = 10 - abs(y - 20) * 0.5
        if half < 0:
            half = 0
        rh = round(half)
        for x in range(cx - rh, cx + rh + 1):
            t = (x - (cx - rh)) / (rh * 2 + 1) if rh > 0 else 0.5
            col = wood_l if t < 0.3 else (wood_m if t < 0.7 else wood_d)
            px(d, x, y, col)
    rect(d, 18, 12, 22, 28, wood_d); rect(d, 14, 16, 26, 20, wood_d)
    px(d, 19, 12, glow_hi); px(d, 20, 12, glow_hi)
    save(img, "art_sepulcher.png", 2)

def gen_art_eternalwhip():  # 永劫之鞭：双鞭交叉 + 中心结
    S = 40
    img, d = new_canvas(S)
    leather, leather_hi = (120, 50, 60, 255), (220, 130, 140, 255)
    cx, cy = 20, 20
    for off in (-1, 1):
        for i in range(24):
            t = i / 23
            x = cx + off * (t - 0.5) * 30
            y = cy + (t - 0.5) * 30
            xi, yi = round(x), round(y)
            px(d, xi, yi, leather_hi); px(d, xi + (1 if off > 0 else -1), yi, leather)
    for y in range(17, 24):  # 中心结
        for x in range(17, 24):
            if (x - 20) ** 2 + (y - 20) ** 2 < 10:
                px(d, x, y, (150, 70, 80, 255))
    save(img, "art_eternalwhip.png", 2)

def gen_art_matrix():  # 圣光矩阵：八芒星 + 放射
    S = 40
    img, d = new_canvas(S)
    gold, gold_hi, ray = (212, 175, 55, 255), (255, 235, 150, 255), (255, 215, 90, 255)
    cx, cy = 20, 20
    for k in range(16):  # 放射
        a = math.radians(k * 22.5)
        for r in range(8, 19):
            px(d, round(cx + math.cos(a) * r), round(cy + math.sin(a) * r), ray if r > 14 else gold)
    for y in range(10, 31):  # 八芒星核心
        for x in range(10, 31):
            dx = (x - cx) / 10.0; dy = (y - cy) / 10.0
            c1 = abs(dx) + abs(dy); c2 = max(abs(dx), abs(dy))
            if c1 < 0.9 or c2 < 0.55:
                px(d, x, y, gold if (c1 < 0.5 or c2 < 0.3) else gold_hi)
    save(img, "art_matrix.png", 2)


# ---------- 角色全身立绘（UX 改造，2026-07-23）：40×60 全身像，不含武器 ----------
def gen_portrait(name, cloth, skin, accent, feature):
    W, H = 40, 60
    img, d = new_canvas(W, H)
    cx = 20
    cd, cm, cl = cloth
    sd, sm, sl = skin
    # 腿（底部 3 行为靴）
    for side in (-1, 1):
        for x in range(cx + side * 3, cx + side * 3 + 4):
            for y in range(42, 58):
                px(d, x, y, cd if y < 55 else (24, 14, 20))
    # 躯干（左亮右暗）
    for y in range(22, 42):
        for x in range(cx - 9, cx + 10):
            t = (x - (cx - 9)) / 19
            px(d, x, y, cl if t < 0.3 else (cm if t < 0.7 else cd))
    # 手臂
    for side in (-1, 1):
        for y in range(23, 41):
            px(d, cx + side * 10, y, cm); px(d, cx + side * 11, y, cd)
    # 肩
    fill_ellipse_shaded(d, cx - 9, 23, 4, 4, cloth)
    fill_ellipse_shaded(d, cx + 9, 23, 4, 4, cloth)
    # 头
    fill_ellipse_shaded(d, cx, 12, 7, 8, skin)
    # 眼
    px(d, cx - 3, 12, accent); px(d, cx + 2, 12, accent)
    # 各血裔特征
    feature(d, cx)
    save(img, name, 2)


def _feat_wanderer(d, cx):
    cloth = ((38, 6, 14), (120, 20, 38), (192, 56, 72))
    fill_ellipse_shaded(d, cx, 6, 9, 6, cloth)          # 兜顶
    for y in range(6, 16):
        px(d, cx - 9, y, cloth[1]); px(d, cx + 8, y, cloth[1])  # 侧帘
    px(d, cx, 33, (46, 204, 113)); px(d, cx - 1, 33, (46, 204, 113)); px(d, cx, 32, (120, 255, 180))  # 腰带灵魂宝石


def _feat_saint(d, cx):
    gold = ((160, 130, 40), (212, 175, 55), (255, 230, 140))
    for a in range(0, 360, 6):                            # 光环
        rad = math.radians(a)
        px(d, round(cx + math.cos(rad) * 9), round(6 + math.sin(rad) * 3), gold[2])
    rect(d, cx - 1, 27, cx + 1, 34, gold[1]); rect(d, cx - 3, 29, cx + 3, 31, gold[1])  # 胸前十字


def _feat_berserker(d, cx):
    for x in range(cx - 4, cx + 5): px(d, x, 9, (40, 20, 20))   # 眼上横疤
    for i in range(5):                                          # 战纹
        px(d, cx - 6 + i, 14 + i, (200, 40, 40)); px(d, cx + 3 - i, 14 + i, (200, 40, 40))
    fur = ((200, 180, 150), (230, 215, 190), (255, 245, 230))
    fill_ellipse_shaded(d, cx - 9, 23, 4, 3, fur); fill_ellipse_shaded(d, cx + 9, 23, 4, 3, fur)  # 毛肩


def _feat_thunder(d, cx):
    bolt = ((180, 120, 230, 255), (230, 200, 255, 255))
    pts = [(cx, 26), (cx - 3, 31), (cx, 31), (cx - 3, 37)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for i in range(steps):
            x = x0 + (x1 - x0) * i / steps; y = y0 + (y1 - y0) * i / steps
            px(d, round(x), round(y), bolt[1])
    px(d, cx - 12, 20, bolt[0]); px(d, cx + 12, 22, bolt[0])   # 肩头电火花


def _feat_bloodthirsty(d, cx):
    cape = ((120, 15, 30), (180, 30, 50), (230, 90, 110))
    for y in range(2, 14):                                       # 高领血披风
        half = 9 - abs(y - 2) * 0.4
        for x in range(int(cx - half), int(cx + half) + 1):
            px(d, x, y, cape[0])
    px(d, cx - 2, 16, (245, 245, 245)); px(d, cx + 1, 16, (245, 245, 245))  # 獠牙


def _feat_apostle(d, cx):
    void = ((18, 12, 30), (45, 35, 65), (80, 65, 110))
    fill_ellipse_shaded(d, cx, 12, 7, 8, void)                  # 无面暗影
    px(d, cx - 3, 12, (120, 220, 255)); px(d, cx + 2, 12, (120, 220, 255))  # 幽光眼
    px(d, cx - 3, 11, (200, 245, 255)); px(d, cx + 2, 11, (200, 245, 255))


def gen_portrait_wanderer():
    gen_portrait('portrait_wanderer.png', ((38, 6, 14), (120, 20, 38), (192, 56, 72)), ((225, 200, 180), (245, 225, 210), (255, 245, 235)), (255, 45, 45), _feat_wanderer)

def gen_portrait_saint():
    gen_portrait('portrait_saint.png', ((200, 200, 215), (235, 235, 245), (255, 255, 255)), ((230, 205, 180), (248, 228, 205), (255, 248, 235)), (255, 210, 90), _feat_saint)

def gen_portrait_berserker():
    gen_portrait('portrait_berserker.png', ((90, 40, 40), (150, 70, 60), (200, 110, 90)), ((180, 140, 110), (210, 170, 140), (235, 200, 170)), (255, 230, 120), _feat_berserker)

def gen_portrait_thunder():
    gen_portrait('portrait_thunder.png', ((60, 30, 110), (110, 70, 170), (160, 120, 215)), ((210, 200, 225), (235, 225, 245), (255, 250, 255)), (245, 215, 110), _feat_thunder)

def gen_portrait_bloodthirsty():
    gen_portrait('portrait_bloodthirsty.png', ((120, 15, 30), (180, 30, 50), (230, 90, 110)), ((210, 200, 205), (235, 228, 232), (250, 245, 248)), (255, 40, 40), _feat_bloodthirsty)

def gen_portrait_apostle():
    gen_portrait('portrait_apostle.png', ((18, 12, 30), (45, 35, 65), (80, 65, 110)), ((30, 25, 45), (55, 48, 75), (90, 80, 120)), (120, 220, 255), _feat_apostle)


# ---------- 角色统一 spec（A4，2026-07-23）：立绘与游戏内精灵同源 ----------
# 元组与上方 6 个 gen_portrait_* wrapper 完全一致，保证「选人立绘 = 游戏内角色」
CHAR_SPECS = {
    'wanderer':     (((38, 6, 14), (120, 20, 38), (192, 56, 72)),
                     ((225, 200, 180), (245, 225, 210), (255, 245, 235)),
                     (255, 45, 45), _feat_wanderer),
    'saint':        (((200, 200, 215), (235, 235, 245), (255, 255, 255)),
                     ((230, 205, 180), (248, 228, 205), (255, 248, 235)),
                     (255, 210, 90), _feat_saint),
    'berserker':    (((90, 40, 40), (150, 70, 60), (200, 110, 90)),
                     ((180, 140, 110), (210, 170, 140), (235, 200, 170)),
                     (255, 230, 120), _feat_berserker),
    'thunder':      (((60, 30, 110), (110, 70, 170), (160, 120, 215)),
                     ((210, 200, 225), (235, 225, 245), (255, 250, 255)),
                     (245, 215, 110), _feat_thunder),
    'bloodthirsty': (((120, 15, 30), (180, 30, 50), (230, 90, 110)),
                     ((210, 200, 205), (235, 228, 232), (250, 245, 248)),
                     (255, 40, 40), _feat_bloodthirsty),
    'apostle':      (((18, 12, 30), (45, 35, 65), (80, 65, 110)),
                     ((30, 25, 45), (55, 48, 75), (90, 80, 120)),
                     (120, 220, 255), _feat_apostle),
}

# 游戏内玩家精灵（A4）：同一 spec，配色/特征与立绘一致
def gen_player_wanderer():
    gen_player('player_wanderer.png', CHAR_SPECS['wanderer'])
def gen_player_saint():
    gen_player('player_saint.png', CHAR_SPECS['saint'])
def gen_player_berserker():
    gen_player('player_berserker.png', CHAR_SPECS['berserker'])
def gen_player_thunder():
    gen_player('player_thunder.png', CHAR_SPECS['thunder'])
def gen_player_bloodthirsty():
    gen_player('player_bloodthirsty.png', CHAR_SPECS['bloodthirsty'])
def gen_player_apostle():
    gen_player('player_apostle.png', CHAR_SPECS['apostle'])


# ---------- Boss 专属精灵（A1，2026-07-23）：替换复用精英怪的尴尬 ----------
def _boss_base(d, robe, trim, skin, eye, accent):
    # 长袍下摆（梯形，左上来光）
    for y in range(20, 62):
        half = int(7 + (y - 20) * 0.52)
        for x in range(32 - half, 32 + half + 1):
            t = (x - (32 - half)) / (half * 2 + 1)
            col = robe[2] if t < 0.18 else (robe[1] if t < 0.7 else robe[0])
            px(d, x, y, col)
    # 袍边纹路
    for y in range(22, 60, 4):
        px(d, 26, y, trim); px(d, 38, y, trim)
    # 肩
    fill_ellipse_shaded(d, 18, 25, 9, 8, robe)
    fill_ellipse_shaded(d, 46, 25, 9, 8, robe)
    # 头
    fill_ellipse_shaded(d, 32, 15, 11, 12, skin)
    # 眼（发光）
    px(d, 27, 15, eye); px(d, 37, 15, eye)
    px(d, 27, 14, accent); px(d, 37, 14, accent)
    # 胸前纹章
    fill_ellipse_shaded(d, 32, 36, 6, 9, (trim, trim, accent))

def gen_boss_baron():
    # 血色男爵：红金长袍 + 双角王冠 + 高领
    S = 64
    img, d = new_canvas(S)
    robe = ((90, 12, 22), (165, 28, 42), (225, 70, 88))
    trim = (212, 175, 55)
    skin = ((210, 180, 165), (235, 215, 200), (250, 240, 230))
    eye, accent = (255, 40, 40), (255, 200, 90)
    _boss_base(d, robe, trim, skin, eye, accent)
    # 高领（披风立起）
    for y in range(18, 30):
        for x in range(20, 44):
            if abs(x - 32) > (y - 18) * 1.4:
                px(d, x, y, robe[0])
    # 双角王冠
    for i in range(10):
        px(d, 22 + i // 3, 6 - i // 2, (230, 200, 90))
        px(d, 42 - i // 3, 6 - i // 2, (230, 200, 90))
    px(d, 32, 4, (255, 225, 120)); px(d, 31, 5, (255, 225, 120)); px(d, 33, 5, (255, 225, 120))
    save(img, "boss_baron.png", 1)

def gen_boss_queen():
    # 苍白女王：苍白蓝白长裙 + 尖顶冠 + 幽光
    S = 64
    img, d = new_canvas(S)
    robe = ((70, 80, 110), (140, 160, 195), (215, 230, 250))
    trim = (180, 220, 255)
    skin = ((225, 230, 245), (240, 245, 255), (255, 255, 255))
    eye, accent = (120, 220, 255), (200, 245, 255)
    _boss_base(d, robe, trim, skin, eye, accent)
    # 拖地长裙（更宽下摆）
    for y in range(50, 62):
        for x in range(8, 56):
            if abs(x - 32) < (y - 50) * 2 + 4:
                px(d, x, y, robe[2] if (x + y) % 3 else robe[1])
    # 尖顶冠
    for i in range(12):
        px(d, 32 - i, 10 - i // 2, (210, 235, 255))
        px(d, 32 + i, 10 - i // 2, (210, 235, 255))
    px(d, 32, 2, (255, 255, 255))
    save(img, "boss_queen.png", 1)

def gen_boss_overlord():
    # 永夜君王：暗紫虚空长袍 + 宽大肩翼 + 王冕
    S = 64
    img, d = new_canvas(S)
    robe = ((20, 10, 40), (50, 30, 80), (90, 60, 135))
    trim = (120, 80, 200)
    skin = ((30, 25, 45), (55, 48, 75), (90, 80, 120))
    eye, accent = (150, 90, 255), (200, 160, 255)
    _boss_base(d, robe, trim, skin, eye, accent)
    # 巨大肩翼（夹紧在画布内）
    for side in (-1, 1):
        for y in range(20, 50):
            half = int(7 + (y - 20) * 0.32)
            x0 = 32 + side * 10
            x1 = 32 + side * (10 + half)
            lo, hi = (x0, x1) if side > 0 else (x1, x0)
            lo = max(2, min(62, lo)); hi = max(2, min(62, hi))
            for x in range(lo, hi + 1):
                px(d, x, y, robe[1] if (x + y) % 4 else robe[0])
    # 宽王冕
    for x in range(20, 45):
        px(d, x, 8, (160, 110, 230))
    for x in range(22, 43, 4):
        for y in range(3, 9):
            px(d, x, y, (200, 160, 255))
    save(img, "boss_overlord.png", 1)

# ---------- 宝箱专属精灵（A2，2026-07-23）：替换「大号宝石伪宝箱」 ----------
def gen_chest():
    S = 44
    img, d = new_canvas(S)
    wood = ((90, 55, 30), (140, 95, 55), (190, 140, 85))
    gold = ((200, 160, 50), (235, 200, 90), (255, 230, 140))
    # 箱体
    for y in range(20, 38):
        for x in range(6, 38):
            px(d, x, y, wood[2] if (x + y) % 3 else wood[1])
    # 木纹
    for y in range(22, 38, 3):
        px(d, 6, y, wood[0]); px(d, 37, y, wood[0])
    # 弧形箱盖
    for y in range(8, 20):
        half = int(16 - (y - 8) * 0.4)
        for x in range(32 - half, 32 + half + 1):
            px(d, x, y, wood[2] if (x + y) % 3 else wood[1])
    # 金属包边
    for y in range(8, 39):
        px(d, 6, y, gold[1]); px(d, 37, y, gold[1])
    for x in range(6, 38):
        px(d, x, 19, gold[1]); px(d, x, 38, gold[0])
    # 锁扣 + 金光封印
    for x in range(28, 36):
        px(d, x, 18, gold[2]); px(d, x, 19, gold[2])
    px(d, 32, 20, gold[2]); px(d, 31, 21, gold[2]); px(d, 33, 21, gold[2])
    save(img, "chest.png", 1)


# ---------- 祭坛专属图标（UX 改造，2026-07-23）：不复用任何现有素材 ----------
def gen_altar_hp():  # 永恒之躯：心形护符
    S = 40
    img, d = new_canvas(S)
    body, hi = (205, 32, 50, 255), (255, 120, 130, 255)
    fill_ellipse_shaded(d, 14, 16, 7, 7, (body, body, hi))
    fill_ellipse_shaded(d, 26, 16, 7, 7, (body, body, hi))
    for y in range(20, 33):
        half = int(14 - (y - 20) * 0.95)
        if half < 0: half = 0
        for x in range(20 - half, 20 + half + 1):
            px(d, x, y, body if y < 28 else hi)
    px(d, 11, 14, hi); px(d, 12, 13, hi)
    save(img, "altar_hp.png", 2)

def gen_altar_spd():  # 疾风之拥：风纹羽翼
    S = 40
    img, d = new_canvas(S)
    wing = ((40, 150, 170), (90, 210, 225), (170, 240, 250))
    for side in (-1, 1):
        for i in range(16):
            t = i / 15
            x = 20 + side * 4 + side * t * 14
            y = 20 - (t - 0.5) * 10 - abs(t - 0.5) * 6
            xi, yi = round(x), round(y)
            px(d, xi, yi, wing[2] if i % 4 == 0 else wing[1])
            px(d, xi, yi + 1, wing[0])
    save(img, "altar_spd.png", 2)

def gen_altar_dmg():  # 嗜血诅咒：滴血獠牙
    S = 40
    img, d = new_canvas(S)
    tooth = (245, 245, 250, 255)
    blood = ((150, 15, 30), (205, 32, 50))
    for y in range(10, 30):
        half = int((y - 10) * 0.7) + 2
        for x in range(20 - half, 20 + half + 1):
            px(d, x, y, tooth if x in (20 - half, 20 + half) else (235, 235, 242, 255))
    for y in range(28, 36):
        half = int(3 - (y - 28) * 0.3)
        if half < 0: half = 0
        for x in range(20 - half, 20 + half + 1):
            px(d, x, y, blood[1])
    px(d, 20, 35, blood[0])
    save(img, "altar_dmg.png", 2)

def gen_altar_gain():  # 亡魂低语：低语鬼脸
    S = 40
    img, d = new_canvas(S)
    ghost = ((120, 80, 170), (160, 120, 210), (200, 170, 240))
    eye = (225, 205, 255, 255)
    fill_ellipse_shaded(d, 20, 16, 11, 12, ghost)
    for x in (15, 16, 24, 25): px(d, x, 15, eye)
    for x in range(10, 31):
        y = 30 if (x // 4) % 2 == 0 else 27
        for yy in range(26, y + 1):
            px(d, x, yy, ghost[1])
    save(img, "altar_gain.png", 2)

def gen_altar_dual():  # 双生武装：交叉双匕
    S = 40
    img, d = new_canvas(S)
    metal, hi, grip = (176, 186, 216, 255), (226, 236, 255, 255), (96, 60, 32, 255)
    for off in (-1, 1):
        for i in range(22):
            t = i / 21
            x = 20 + off * (t - 0.5) * 26
            y = 20 + (t - 0.5) * 26
            xi, yi = round(x), round(y)
            px(d, xi, yi, hi if i % 3 == 0 else metal)
            px(d, xi + off, yi, metal)
        px(d, 20 + off, 19, grip); px(d, 20 + off, 20, grip)
    save(img, "altar_dual.png", 2)

def _tablet(d, inner):
    gold, edge = (212, 175, 55, 255), (150, 120, 35, 255)
    for y in range(7, 33):
        w = 14 if 11 < y < 29 else 10
        for x in range(20 - w, 20 + w + 1):
            px(d, x, y, gold)
    for y in range(7, 33):
        ex = 14 if 11 < y < 29 else 10
        px(d, 20 - ex, y, edge); px(d, 20 + ex, y, edge)
    inner(d)
    for x in range(6, 12): px(d, x, 6, (255, 80, 80, 255))   # 加号横
    for y in range(3, 9): px(d, 8, y, (255, 80, 80, 255))    # 加号竖

def _draw_sword(d):
    blade, hi, guard = (200, 200, 220, 255), (240, 240, 255, 255), (180, 140, 60, 255)
    for y in range(13, 27): px(d, 20, y, hi if y % 2 == 0 else blade)
    px(d, 19, 13, hi); px(d, 21, 13, hi)
    rect(d, 16, 27, 24, 29, guard)
    rect(d, 19, 29, 21, 33, (96, 60, 32, 255))

def _draw_shield(d):
    shield = (200, 200, 220, 255)
    for y in range(13, 30):
        half = int(9 - abs(y - 21) * 0.4)
        if half < 0: half = 0
        for x in range(20 - half, 20 + half + 1):
            px(d, x, y, (240, 240, 255, 255) if (17 < x < 23 and y < 24) else shield)
    px(d, 20, 17, (255, 255, 255, 255))

def gen_altar_slot_weapon():  # 扩容武器槽：符文牌 + 剑
    S = 40
    img, d = new_canvas(S)
    _tablet(d, _draw_sword)
    save(img, "altar_slot_weapon.png", 2)

def gen_altar_slot_passive():  # 扩容被动槽：符文牌 + 盾
    S = 40
    img, d = new_canvas(S)
    _tablet(d, _draw_shield)
    save(img, "altar_slot_passive.png", 2)


gen_player_default()
gen_player_wanderer()
gen_player_saint()
gen_player_berserker()
gen_player_thunder()
gen_player_bloodthirsty()
gen_player_apostle()
gen_boss_baron()
gen_boss_queen()
gen_boss_overlord()
gen_chest()
gen_bat()
gen_skeleton()
gen_slime()
gen_elite()
gen_blade()
gen_holywater()
gen_axe()
gen_lightning()
gen_gem("gem_small.png", (46, 204, 113, 255), (160, 255, 200, 255), (20, 120, 60, 255))
gen_gem("gem_medium.png", (74, 163, 223, 255), (170, 220, 255, 255), (25, 80, 140, 255))
gen_gem("gem_large.png", (142, 68, 173, 255), (220, 160, 255, 255), (80, 30, 110, 255))
gen_ground()
gen_decal_tomb()
gen_decal_wood()
gen_decal_rubble()
gen_decal_bone()
gen_decal_cross()
gen_bg()
gen_icon_skull()
gen_potion()
gen_art_storm()
gen_art_devour()
gen_art_spiral()
gen_art_stormcall()
gen_art_crimson()
gen_art_tempest()
gen_weapon_aura()
gen_weapon_whip()
gen_weapon_cross()
gen_art_sepulcher()
gen_art_eternalwhip()
gen_art_matrix()
gen_portrait_wanderer()
gen_portrait_saint()
gen_portrait_berserker()
gen_portrait_thunder()
gen_portrait_bloodthirsty()
gen_portrait_apostle()
gen_altar_hp()
gen_altar_spd()
gen_altar_dmg()
gen_altar_gain()
gen_altar_dual()
gen_altar_slot_weapon()
gen_altar_slot_passive()
print("---- 全部素材生成完成 ----")
