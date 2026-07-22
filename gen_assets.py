#!/usr/bin/env python3
"""程序化像素风素材生成器：逐像素绘制 16-bit 哥特像素精灵，输出透明 PNG。"""
import math
import random
from PIL import Image, ImageDraw, ImageFilter

random.seed(7)
OUT = "public/assets"

TRANSPARENT = (0, 0, 0, 0)

def new_canvas(size):
    img = Image.new("RGBA", (size, size), TRANSPARENT)
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
def gen_player():
    S = 46
    cx = 23
    img, d = new_canvas(S)
    cloak = ((38, 6, 14), (120, 20, 38), (192, 56, 72))
    armor = ((60, 62, 88), (150, 150, 180), (205, 205, 230))
    eye, gem = (255, 45, 45), (46, 204, 113)
    # 斗篷（下摆梯形，左上来光）
    for y in range(14, 43):
        half = int(3 + (y - 14) * 0.52)
        for x in range(cx - half, cx + half + 1):
            t = (x - (cx - half)) / (half * 2 + 1)
            col = cloak[2] if t < 0.22 else (cloak[1] if t < 0.72 else cloak[0])
            px(d, x, y, col)
    # 斗篷竖向褶皱（明暗）
    for y in range(16, 42, 3):
        px(d, cx - 6, y, cloak[0]); px(d, cx + 7, y, cloak[0])
        px(d, cx, y, cloak[2])
    # 靴子
    for x in range(cx - 9, cx - 3):
        px(d, x, 41, (30, 18, 26)); px(d, x, 42, (20, 12, 18))
    for x in range(cx + 3, cx + 9):
        px(d, x, 41, (30, 18, 26)); px(d, x, 42, (20, 12, 18))
    # 肩甲
    fill_ellipse_shaded(d, cx - 12, 17, 6, 5, armor)
    fill_ellipse_shaded(d, cx + 12, 17, 6, 5, armor)
    # 兜帽
    fill_ellipse_shaded(d, cx, 11, 11, 12, cloak)
    # 面部阴影
    for y in range(7, 18):
        for x in range(cx - 7, cx + 7):
            dx = (x - cx) / 7.0
            dy = (y - 13) / 9.0
            if dx * dx + dy * dy <= 1:
                px(d, x, y, (18, 6, 14, 255))
    # 兜帽顶部高光
    for y in range(2, 6):
        px(d, cx - 4 + y, y, cloak[2])
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
    save(img, "player.png", 1)


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
    S = 20
    img, d = new_canvas(S)
    # 斜向血刃
    for i in range(12):
        x, y = 4 + i, 15 - i
        for w in range(-1, 2):
            px(d, x + w, y, (220, 60, 60, 255) if w == 0 else (150, 20, 30, 255))
    for i in range(4):  # 刀尖高光
        px(d, 14 + i // 2, 5 - i // 2, (255, 160, 160, 255))
    rect(d, 2, 16, 5, 18, (60, 30, 20, 255))  # 柄
    save(img, "weapon_blade.png", 4)

def gen_holywater():
    S = 20
    img, d = new_canvas(S)
    glass, water, cross = (180, 200, 220, 180), (60, 140, 220, 230), (230, 200, 90, 255)
    for y in range(8, 18):
        w = 3 + (18 - y) // 5
        for x in range(10 - w, 10 + w + 1):
            px(d, x, y, glass)
    for y in range(11, 17):
        for x in range(8, 13):
            px(d, x, y, water)
    rect(d, 9, 3, 10, 8, glass)  # 瓶颈
    rect(d, 8, 2, 11, 3, (120, 80, 40, 255))  # 木塞
    rect(d, 9, 12, 10, 15, cross); rect(d, 8, 13, 11, 14, cross)  # 十字
    save(img, "weapon_holywater.png", 4)

def gen_axe():
    S = 20
    img, d = new_canvas(S)
    metal, metal_l, handle = (170, 180, 210, 255), (220, 230, 250, 255), (90, 60, 30, 255)
    # 双刃斧头
    for i in range(6):
        px(d, 4 + i, 4 + i // 2, metal_l)
        px(d, 15 - i, 4 + i // 2, metal_l)
        px(d, 4 + i, 6 + i // 2, metal)
        px(d, 15 - i, 6 + i // 2, metal)
    # 柄
    for y in range(5, 18):
        px(d, 9, y, handle); px(d, 10, y, handle)
    rect(d, 8, 4, 11, 6, (140, 60, 60, 255))  # 缠绳
    save(img, "weapon_axe.png", 4)

def gen_lightning():
    S = 20
    img, d = new_canvas(S)
    bolt, bolt_l = (245, 215, 110, 255), (255, 245, 180, 255)
    pts = [(11,2),(8,7),(11,8),(7,13),(10,14),(6,18)]
    for (x0,y0),(x1,y1) in zip(pts, pts[1:]):
        steps = max(abs(x1-x0), abs(y1-y0)) * 2 + 1
        for i in range(steps):
            x = x0 + (x1-x0)*i/steps
            y = y0 + (y1-y0)*i/steps
            xi, yi = round(x), round(y)
            px(d, xi, yi, bolt_l if i % 3 == 0 else bolt)
            px(d, xi+1, yi, bolt)
    save(img, "weapon_lightning.png", 4)


# ---------- 经验宝石 ----------
def gen_gem(name, base, light, dark):
    S = 18
    img, d = new_canvas(S)
    cx, cy = 9, 9
    # 菱形刻面
    for y in range(2, 17):
        half = 7 - abs(y - 9) if y < 9 else 7 - (y - 9)
        for x in range(cx - half, cx + half + 1):
            facet = (x + y) % 3
            color = light if facet == 0 else (dark if facet == 2 else base)
            px(d, x, y, color)
    rect(d, 6, 5, 8, 6, light)  # 顶部高光
    save(img, name, 4)


# ---------- 地面纹理（无缝平铺） ----------
def gen_ground():
    S = 64
    img = Image.new("RGBA", (S, S), (26, 20, 40, 255))
    d = ImageDraw.Draw(img)
    palette = [(22, 17, 35, 255), (30, 24, 46, 255), (26, 20, 40, 255), (34, 27, 50, 255)]
    for y in range(S):
        for x in range(S):
            if random.random() < 0.5:
                px(d, x, y, random.choice(palette))
    # 裂纹
    for _ in range(5):
        x, y = random.randint(4, S-4), random.randint(4, S-4)
        for _ in range(random.randint(4, 10)):
            px(d, x, y, (14, 10, 24, 255))
            x += random.choice((-1, 0, 1)); y += random.choice((0, 1))
            x = max(0, min(S-1, x)); y = max(0, min(S-1, y))
    # 枯草
    for _ in range(8):
        x, y = random.randint(1, S-2), random.randint(1, S-3)
        c = (60, 50, 40, 255)
        px(d, x, y, c); px(d, x, y-1, c); px(d, x+1, y-2, c)
    img = img.resize((256, 256), Image.NEAREST)
    img.save(f"{OUT}/ground.png")
    print("OK ground.png")


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
    S = 20
    img, d = new_canvas(S)
    bone, bone_d, eye = (230, 224, 205, 255), (150, 145, 130, 255), (255, 50, 50, 255)
    for y in range(3, 14):
        w = 6 if y < 11 else 4
        for x in range(10 - w, 10 + w + 1):
            px(d, x, y, bone)
    rect(d, 6, 8, 8, 11, bone_d); rect(d, 12, 8, 14, 11, bone_d)
    px(d, 7, 9, eye); px(d, 13, 9, eye)
    rect(d, 9, 12, 10, 13, bone_d)
    for x in range(7, 13):
        px(d, x, 15, bone if x % 2 else bone_d)
    save(img, "icon_skull.png", 4)


import os
os.makedirs(OUT, exist_ok=True)


# ---------- 神器图标 ----------
def gen_art_storm():  # 千刃风暴：三把猩红飞刃 120° 风轮
    S = 20
    img, d = new_canvas(S)
    body, tip, core = (220, 60, 60, 255), (255, 160, 160, 255), (255, 220, 220, 255)
    cx, cy = 10, 10
    for k in range(3):
        a = math.radians(k * 120)  # 0°/120°/240° 三个方向
        pa = a + math.pi / 2  # 垂直方向，单侧加厚呈旋翼感
        for i in range(2, 8):  # 从中心向外 6px 斜线刃
            x, y = cx + math.cos(a) * i, cy - math.sin(a) * i
            px(d, round(x), round(y), tip if i >= 6 else body)
            if i < 6:
                px(d, round(x + math.cos(pa)), round(y - math.sin(pa)), body)
    px(d, cx, cy, core)
    px(d, cx - 1, cy, body); px(d, cx + 1, cy, body)
    px(d, cx, cy - 1, body); px(d, cx, cy + 1, body)
    save(img, "art_storm.png", 4)

def gen_art_devour():  # 圣洁吞噬：圣杯涌出蓝色圣焰
    S = 20
    img, d = new_canvas(S)
    metal, metal_l, base = (200, 200, 220, 255), (240, 240, 255, 255), (140, 140, 170, 255)
    flame, flame_l = (74, 163, 223, 255), (168, 216, 255, 255)
    # 圣焰（杯中向上涌出）
    flame_rows = {2: (10,), 3: (10,), 4: (9, 10), 5: (10, 11), 6: (9, 10, 11), 7: (8, 9, 10, 11, 12)}
    for y, xs in flame_rows.items():
        for x in xs:
            px(d, x, y, flame)
    for (x, y) in ((10, 4), (10, 5), (10, 6), (9, 7), (10, 7)):
        px(d, x, y, flame_l)  # 内焰
    # 杯身（碗状，上宽下窄）
    rect(d, 5, 8, 14, 9, metal)  # 杯口沿
    for y in range(10, 14):
        w = 4 - (y - 9) // 2
        for x in range(10 - w, 10 + w + 1):
            px(d, x, y, metal)
    rect(d, 6, 9, 7, 11, metal_l)  # 杯身高光
    px(d, 11, 8, flame_l)  # 杯口火光
    # 杯柄 + 杯底
    rect(d, 9, 14, 10, 15, metal)
    rect(d, 6, 16, 13, 17, base)
    save(img, "art_devour.png", 4)

def gen_art_spiral():  # 死亡螺旋：6 把小斧刃绕中心环列
    S = 20
    img, d = new_canvas(S)
    metal, metal_l, grip = (170, 180, 210, 255), (220, 230, 250, 255), (90, 60, 30, 255)
    cx, cy, r = 10, 10, 7
    for k in range(6):
        a = math.radians(k * 60 + 90)
        x = round(cx + math.cos(a) * r)
        y = round(cy - math.sin(a) * r)
        px(d, x, y, metal); px(d, x + 1, y, metal)  # 2×2 斧刃块
        px(d, x, y + 1, metal); px(d, x + 1, y + 1, metal)
        hx = round(cx + math.cos(a) * (r + 1))  # 外侧刃口高光
        hy = round(cy - math.sin(a) * (r + 1))
        px(d, hx, hy, metal_l); px(d, hx + 1, hy, metal_l)
    rect(d, 9, 9, 10, 10, grip)  # 中心握点
    save(img, "art_spiral.png", 4)

def gen_art_stormcall():  # 雷霆循环：首尾相接的锯齿闪电环
    S = 20
    img, d = new_canvas(S)
    bolt, bolt_l = (245, 215, 110, 255), (255, 245, 180, 255)
    cx, cy = 10, 10
    pts = []
    for k in range(12):
        a = math.radians(k * 30)
        r = 8 if k % 2 == 0 else 5  # 奇偶点内外交错半径 5/8
        pts.append((cx + math.cos(a) * r, cy - math.sin(a) * r))
    for k in range(12):  # 连线成环
        (x0, y0), (x1, y1) = pts[k], pts[(k + 1) % 12]
        steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for i in range(steps):
            x = x0 + (x1 - x0) * i / steps
            y = y0 + (y1 - y0) * i / steps
            px(d, round(x), round(y), bolt_l if i % 3 == 0 else bolt)
    save(img, "art_stormcall.png", 4)

def gen_art_crimson():  # 猩红之拥（隐藏）：血珠包裹心脏，上半圆下尖
    S = 20
    img, d = new_canvas(S)
    edge, body = (120, 15, 25, 255), (180, 30, 45, 255)
    heart, glint = (220, 70, 90, 255), (255, 150, 160, 255)
    rows = [(3, 9, 10), (4, 8, 11), (5, 7, 12), (6, 6, 13), (7, 6, 13), (8, 7, 12),
            (9, 7, 12), (10, 8, 11), (11, 8, 11), (12, 9, 10), (13, 9, 10), (14, 10, 10)]
    for y, x0, x1 in rows:
        for x in range(x0, x1 + 1):
            px(d, x, y, edge if x in (x0, x1) else body)
    # 包裹的心脏
    for (x, y) in ((8, 6), (9, 6), (11, 6), (12, 6),
                   (8, 7), (9, 7), (10, 7), (11, 7), (12, 7),
                   (9, 8), (10, 8), (11, 8), (10, 9)):
        px(d, x, y, heart)
    px(d, 8, 4, glint)  # 顶部反光
    save(img, "art_crimson.png", 4)

def gen_art_tempest():  # 雷劫（隐藏）：粗壮紫雷劈落裂纹地面
    S = 20
    img, d = new_canvas(S)
    bolt, core = (180, 120, 230, 255), (230, 200, 255, 255)
    ground, crack = (40, 30, 55, 255), (15, 10, 25, 255)
    # 折线雷身（顶部劈到底部）
    pts = [(12, 0), (9, 5), (12, 8), (7, 12), (10, 15), (8, 17)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        steps = max(abs(x1 - x0), abs(y1 - y0)) * 2 + 1
        for i in range(steps):
            x = x0 + (x1 - x0) * i / steps
            y = y0 + (y1 - y0) * i / steps
            xi, yi = round(x), round(y)
            px(d, xi, yi, core)  # 高光芯
            px(d, xi - 1, yi, bolt); px(d, xi + 1, yi, bolt)
    # 落雷迸溅
    px(d, 6, 16, bolt); px(d, 11, 16, bolt); px(d, 9, 16, core)
    # 地面 2 行 + 3 条裂纹
    rect(d, 0, 18, 19, 19, ground)
    px(d, 4, 18, crack); px(d, 5, 19, crack)
    px(d, 12, 19, crack); px(d, 13, 18, crack); px(d, 14, 19, crack)
    px(d, 16, 18, crack); px(d, 17, 19, crack)
    save(img, "art_tempest.png", 4)


gen_player()
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
gen_bg()
gen_icon_skull()
gen_art_storm()
gen_art_devour()
gen_art_spiral()
gen_art_stormcall()
gen_art_crimson()
gen_art_tempest()
print("---- 全部素材生成完成 ----")
