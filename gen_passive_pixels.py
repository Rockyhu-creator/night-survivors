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

def remove_watermark(im, min_area_ratio=0.02):
    """去除小面积孤立连通域（水印/文字通常在角落且面积远小于主体）。
       保留最大连通域作为主视觉，其余置透明。"""
    a = im.split()[3]
    w, h = im.size
    total_pixels = w * h
    visited = [[False] * w for _ in range(h)]
    components = []

    def bfs(sx, sy):
        stack = [(sx, sy)]
        pixels = []
        while stack:
            x, y = stack.pop()
            if x < 0 or x >= w or y < 0 or y >= h:
                continue
            if visited[y][x]:
                continue
            if a.getpixel((x, y)) <= 16:
                continue
            visited[y][x] = True
            pixels.append((x, y))
            stack.extend([(x+1,y), (x-1,y), (x,y+1), (x,y-1)])
        return pixels

    for y in range(h):
        for x in range(w):
            if not visited[y][x] and a.getpixel((x, y)) > 16:
                comp = bfs(x, y)
                if comp:
                    components.append(comp)

    if not components:
        return im

    # 按面积排序，保留最大的
    components.sort(key=len, reverse=True)
    main_area = len(components[0])
    min_area = total_pixels * min_area_ratio

    # 构建清理后的 mask：仅保留最大连通域 + 超过阈值的中等连通域（防误删）
    out = im.copy()
    od = out.load()
    keep_ids = {id(c) for c in components if len(c) > min_area or c is components[0]}
    # 如果有多个大面积组件（如多部分图标），全保留；只删小的
    if len(keep_ids) > 1:
        pass  # 多个有效组件都保留
    else:
        keep_ids = {id(components[0])}  # 只保留最大的

    removed = 0
    for i, comp in enumerate(components):
        if id(comp) not in keep_ids:
            for x, y in comp:
                od[x, y] = (0, 0, 0, 0)
            removed += 1

    if removed > 0:
        print(f'     去除 {removed} 个小连通域（水印/噪点）')
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

def recenter_com(im):
    """最终 80x80 输出的质心再居中：将不透明像素质心对齐画布正中心。"""
    w, h = im.size
    px = im.load()
    sum_x = sum_y = count = 0
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 16:
                sum_x += x
                sum_y += y
                count += 1
    if count == 0:
        return im
    com_x = sum_x / count
    com_y = sum_y / count
    offset_x = round(w / 2 - com_x)
    offset_y = round(h / 2 - com_y)
    if offset_x == 0 and offset_y == 0:
        return im
    # 平移：新建画布，偏移粘贴
    shifted = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    shifted.paste(im, (offset_x, offset_y), im)
    return shifted

def auto_brighten(im, min_brightness=100, max_boost=4.0):
    """若非透明像素平均亮度低于阈值，自动增强（修复暗色主题 key_bg 吃掉亮部的问题）"""
    from PIL import ImageStat, ImageEnhance
    try:
        import numpy as np
        arr = np.array(im)
        mask = arr[:,:,3] > 16
        if mask.any():
            avg = float(arr[:,:,:3][mask].mean())
        else:
            return im
    except ImportError:
        stat = ImageStat.Stat(im.convert('RGB'))
        avg = float(stat.mean[0])
    if avg < min_brightness:
        factor = min(max_boost, min_brightness / max(avg, 1))
        out = ImageEnhance.Brightness(im).enhance(factor)
        stat2 = ImageStat.Stat(out.convert('RGB'))
        if float(stat2.mean[0]) < min_brightness * 0.8:
            out = ImageEnhance.Contrast(out).enhance(1.5)
        return out
    return im


def process(id_):
    src_glob = glob.glob(os.path.join(RAW, id_, '*.png'))
    if not src_glob:
        print(f'SKIP {id_}: no source png'); return False
    src = sorted(src_glob)[0]
    im = Image.open(src).convert('RGBA')
    if not has_real_alpha(im):
        im = key_bg(im)
    # 去除水印/角落小面积孤立连通域（ImageGen 自动加水印文字）
    im = remove_watermark(im)
    # 裁剪到内容 bbox（去水印后 bbox 紧贴主体）
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
    # 用质心居中贴到 GRID*2 透明画布（而非按尺寸居中——修正主体偏移）
    canvas = Image.new('RGBA', (FINAL, FINAL), (0,0,0,0))
    # 计算网格图的不透明像素质心
    gx_arr = list(grid.getdata())
    gw_gh = nw * nh
    sum_x = sum_y = count = 0
    for idx, pixel in enumerate(gx_arr):
        if pixel[3] > 16:
            sum_x += idx % nw
            sum_y += idx // nw
            count += 1
    if count > 0:
        com_x = sum_x / count
        com_y = sum_y / count
        # 偏移使质心对齐画布中心（放大 2x 后的坐标）
        paste_x = int(FINAL/2 - com_x * 2)
        paste_y = int(FINAL/2 - com_y * 2)
    else:
        paste_x = (FINAL - nw * 2) // 2
        paste_y = (FINAL - nh * 2) // 2
    canvas.paste(grid, (paste_x, paste_y), grid)
    # 最近邻放大 2x -> 2px 实心块
    out = canvas.resize((FINAL, FINAL), Image.NEAREST)
    out = add_outline(out)
    # 最终质心再居中：修正所有前序步骤的累积偏移
    out = recenter_com(out)
    # 亮度兜底：若主体平均亮度过低（暗色主题图 key_bg 吃掉亮部），自动增强
    out = auto_brighten(out)
    dst = os.path.join(OUT, f'passive_{id_}.png')
    out.save(dst, compress_level=9)
    print(f'OK   passive_{id_}.png  ({out.size}, src={os.path.basename(src)})')
    return True

if __name__ == '__main__':
    only = sys.argv[1:] or IDS
    for i in only:
        process(i)
    print('---- done ----')
