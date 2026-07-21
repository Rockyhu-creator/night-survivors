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
    draw.point((x, y), fill=color)

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


# ---------- 主角：夜裔猎人（戴兜帽斗篷） ----------
def gen_player():
    S = 24
    img, d = new_canvas(S)
    cloak_d, cloak, cloak_l = (60,10,20,255), (140,24,40,255), (200,60,70,255)
    armor, armor_l = (90,90,110,255), (170,170,190,255)
    skin, eye = (230,200,170,255), (255,40,40,255)
    # 斗篷主体（梯形下摆）
    for y in range(8, 22):
        w = 3 + (y - 8) // 2
        for x in range(12 - w, 12 + w + 1):
            px(d, x, y, cloak_d if x in (12-w, 12+w) else (cloak if random.random() > 0.12 else cloak_l))
    # 兜帽
    for y in range(2, 9):
        w = 4 - abs(y - 5)
        for x in range(12 - w, 12 + w + 1):
            px(d, x, y, cloak)
    # 脸部阴影区
    for y in range(4, 8):
        for x in range(10, 15):
            px(d, x, y, (20, 8, 16, 255))
    # 眼睛
    px(d, 10, 5, eye); px(d, 13, 5, eye)
    px(d, 11, 6, skin)
    # 胸甲
    for y in range(9, 14):
        for x in range(10, 15):
            px(d, x, y, armor if (x+y) % 3 else armor_l)
    rect(d, 11, 10, 13, 12, armor_l)  # 胸甲高光
    save(img, "player.png", 4)


# ---------- 蝙蝠 ----------
def gen_bat():
    S = 22
    img, d = new_canvas(S)
    body, wing, wing_l, eye = (40,20,60,255), (80,40,120,255), (130,80,180,255), (255,50,50,255)
    # 翅膀（对称扇形）
    for i in range(9):
        y0 = 8 - i // 2
        for x in range(2, 2 + i):
            px(d, 11 - 1 - x, y0 + x // 2, wing_l if x == i - 1 else wing)
            px(d, 11 + x, y0 + x // 2, wing_l if x == i - 1 else wing)
    # 身体
    for y in range(7, 14):
        w = 2 if y < 11 else 1
        for x in range(11 - w, 11 + w + 1):
            px(d, x, y, body)
    # 耳朵
    px(d, 9, 6, body); px(d, 12, 6, body)
    # 眼睛
    px(d, 9, 9, eye); px(d, 12, 9, eye)
    save(img, "enemy_bat.png", 4)


# ---------- 骷髅 ----------
def gen_skeleton():
    S = 24
    img, d = new_canvas(S)
    bone, bone_d, bone_l = (220, 212, 190, 255), (150, 140, 120, 255), (245, 240, 225, 255)
    eye = (80, 255, 120, 255)
    # 颅骨
    for y in range(2, 10):
        w = 4 if y < 8 else 3
        for x in range(12 - w, 12 + w + 1):
            px(d, x, y, bone if random.random() > 0.15 else bone_l)
    # 眼窝
    rect(d, 9, 5, 10, 7, bone_d); rect(d, 14, 5, 15, 7, bone_d)
    px(d, 9, 6, eye); px(d, 15, 6, eye)
    # 鼻腔
    rect(d, 12, 8, 12, 9, bone_d)
    # 牙齿
    for x in range(10, 15):
        px(d, x, 10, bone_l)
    # 肋骨
    for y in range(12, 20):
        if y % 2 == 0:
            for x in range(9, 16):
                px(d, x, y, bone)
        else:
            px(d, 12, y, bone_d)
    # 手臂 + 剑
    for i in range(6):
        px(d, 7 - i // 2, 13 + i, bone)
        px(d, 17 + i // 2, 13 + i, bone)
    for i in range(7):  # 剑
        px(d, 19 + i // 2, 10 + i, (180, 180, 200, 255))
    px(d, 18, 15, (120, 80, 40, 255))
    save(img, "enemy_skeleton.png", 4)


# ---------- 史莱姆 ----------
def gen_slime():
    S = 26
    img, d = new_canvas(S)
    goo_d, goo, goo_l = (20, 90, 50, 255), (40, 170, 90, 255), (120, 230, 150, 255)
    eye = (255, 255, 255, 255)
    pupil = (10, 40, 20, 255)
    # 半球形身体
    cx, cy, r = 13, 16, 10
    for y in range(S):
        for x in range(S):
            dx, dy = x - cx, y - cy
            if dy > 6: continue
            dist = math.hypot(dx, dy * 1.3)
            if dist < r:
                edge = dist > r - 1.5
                px(d, x, y, goo_d if edge else (goo if random.random() > 0.08 else goo_l))
    # 高光
    for i in range(4):
        px(d, 8 + i, 10 - i // 2, goo_l)
    # 内部骨头点缀
    rect(d, 16, 14, 18, 15, (230, 230, 220, 200))
    rect(d, 9, 18, 11, 19, (230, 230, 220, 200))
    # 眼睛
    rect(d, 9, 12, 11, 14, eye); rect(d, 15, 12, 17, 14, eye)
    px(d, 10, 13, pupil); px(d, 16, 13, pupil)
    save(img, "enemy_slime.png", 4)


# ---------- 精英吸血鬼领主 ----------
def gen_elite():
    S = 32
    img, d = new_canvas(S)
    armor, armor_l = (30, 24, 40, 255), (90, 70, 120, 255)
    gold, wing, aura, eye = (212, 175, 55, 255), (70, 30, 100, 255), (200, 40, 60, 255), (255, 60, 60, 255)
    # 大翅膀
    for i in range(12):
        y0 = 8 - i // 3
        for x in range(2, 2 + i):
            if (x + i) % 2:
                px(d, 16 - 1 - x, y0 + x // 2, wing)
                px(d, 16 + x, y0 + x // 2, wing)
    # 身体铠甲
    for y in range(10, 26):
        w = 5 - (y - 10) // 6
        for x in range(16 - w, 16 + w + 1):
            px(d, x, y, armor if random.random() > 0.1 else armor_l)
    # 金饰
    rect(d, 14, 12, 17, 13, gold)
    rect(d, 15, 16, 16, 20, gold)
    # 头盔
    for y in range(4, 11):
        w = 4 - abs(y - 7) // 2
        for x in range(16 - w, 16 + w + 1):
            px(d, x, y, armor)
    # 角
    px(d, 12, 3, gold); px(d, 19, 3, gold)
    px(d, 13, 4, gold); px(d, 18, 4, gold)
    # 脸 + 眼
    rect(d, 14, 7, 17, 9, (16, 8, 20, 255))
    px(d, 14, 8, eye); px(d, 17, 8, eye)
    save(img, "enemy_elite.png", 4)


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
print("---- 全部素材生成完成 ----")
