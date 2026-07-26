#!/usr/bin/env python3
# 大版本 · 被动 icon 像素化脚本（AI PNG -> 像素 sprite）
# 输入：.ai_passive_raw/<id>/*.png（由 ImageGen/文生图生成，暗哥特 16-bit 像素风）
# 输出：public/assets/passive_<id>.png（80x80 RGBA，1px 暗描边，compress_level=9）
# 与全游戏资产规格（80x80）一致；背景自动抠透明（角点取色键控，兼容白底/彩底）。
import os, glob, sys
from PIL import Image, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), 'public', 'assets')
RAW = os.path.join(os.path.dirname(__file__), '.ai_passive_raw')
OUTLINE = (8, 4, 14, 255)          # 与游戏其他资产一致的暗描边（codex 规格 OUTLINE）
GRID = 40                          # 像素网格：40 -> 放大 2x 到 80，2px 实心块，复古 chunky
FINAL = 80                         # 统一 80x80

IDS = ['boots','heart','tome','magnet','greed','guard','regen',
       'critrate','critdmg','shield','shieldregen','armor','dodge']

def has_real_alpha(im):
    if im.mode != 'RGBA':
        return False
    a = im.split()[3]
    # 存在任意半透明/透明像素即视为真 alpha
    hist = a.histogram()
    return sum(hist[0:128]) > 0

def mode_bg(rgb):
    # 取全图出现次数最多的颜色作为纯色背景（鲁棒：白/黑/灰/彩底均可）
    colors = rgb.getcolors(maxcolors=65536)
    if not colors:
        return rgb.getpixel((0, 0))[:3]
    colors.sort(key=lambda c: -c[0])
    return colors[0][1][:3]

def key_bg(im):
    # 众数背景键控 -> 透明（对深色/浅色/彩色纯底均有效）
    rgb = im.convert('RGB')
    bg = mode_bg(rgb)
    px = im.load()
    w, h = im.size
    out = im.convert('RGBA')
    od = out.load()
    def dist(a, b):
        return max(abs(a[0] - b[0]), abs(a[1] - b[1]), abs(a[2] - b[2]))
    for y in range(h):
        for x in range(w):
            r, g, b_ = px[x, y][:3]
            if dist((r, g, b_), bg) < 55 or (r > 238 and g > 238 and b_ > 238):
                od[x, y] = (0, 0, 0, 0)
    return out

def add_outline(im):
    # 透明像素若 4-邻域有非透明像素 -> 染成 OUTLINE（外描边）
    a = im.split()[3]
    mask = a.point(lambda p: 255 if p > 16 else 0)
    # 膨胀得到"壳"
    kern = ImageFilter.Kernel((3,3), [0,1,0,1,1,1,0,1,0], 1, 0)
    dilated = mask.filter(kern)
    shell = dilated.point(lambda p: 255 if p > 0 else 0).convert('L')
    out = im.copy()
    od = out.load()
    sd = shell.load()
    ad = a.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            if sd[x,y] > 0 and ad[x,y] <= 16:
                od[x,y] = OUTLINE
    return out

def process(id_):
    src_glob = glob.glob(os.path.join(RAW, id_, '*.png'))
    if not src_glob:
        print(f'SKIP {id_}: no source png'); return False
    src = sorted(src_glob)[0]
    im = Image.open(src).convert('RGBA')
    if not has_real_alpha(im):
        im = key_bg(im)
    # 裁剪到内容 bbox
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    # 等比缩进 GRID 网格（LANCZOS 取色均值 -> 像素感来源）
    bw, bh = im.size
    if bw == 0 or bh == 0:
        print(f'SKIP {id_}: empty'); return False
    scale = min(GRID / bw, GRID / bh)
    nw, nh = max(1, round(bw*scale)), max(1, round(bh*scale))
    grid = im.resize((nw, nh), Image.LANCZOS)
    # 贴到 GRID*2 透明画布（留边，居中）
    canvas = Image.new('RGBA', (FINAL, FINAL), (0,0,0,0))
    canvas.paste(grid, ((FINAL-nw*2)//2, (FINAL-nh*2)//2), grid)
    # 最近邻放大 2x -> 2px 实心块
    out = canvas.resize((FINAL, FINAL), Image.NEAREST)
    out = add_outline(out)
    dst = os.path.join(OUT, f'passive_{id_}.png')
    out.save(dst, compress_level=9)
    print(f'OK   passive_{id_}.png  ({out.size}, src={os.path.basename(src)})')
    return True

if __name__ == '__main__':
    only = sys.argv[1:] or IDS
    for i in only:
        process(i)
    print('---- done ----')
