#!/usr/bin/env python3
# v4.3 · 血裔选择卡片立绘后处理（AI 竖版原图 -> 80x120 透明背景 portrait）
#
# 输入：.ai_portrait_raw/<id>/*.png（由内置 ImageGen 生成的 832x1216 竖版原图）
# 输出：public/assets/portrait_<id>.png（RGBA 透明背景，compress_level=9）
#
# 与 gen_monster_pixels.py 的关键差异（务必理解，勿混用）：
#   1) 背景键控用「边缘泛洪」而非「全图众数色」。
#      众数键控会把主体内部的同色区域一并吃掉——saint 是白金长袍，
#      在白底上做全图键白会直接抠穿袍子。泛洪只删与画布边界连通的背景，
#      主体内部的白色安全保留。
#   2) 不做 NEAREST 放大 / 不加描边。portrait 是 UI 立绘（CSS 渲染 64x96
#      object-fit:contain），不是游戏内像素 sprite，保留 LANCZOS 平滑更清晰。
#   3) 输出固定 80x120（2:3），主体按 contain 等比适配后居中，不拉伸变形。
import os, sys, glob
from collections import deque
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'public', 'assets')
RAW = os.path.join(ROOT, '.ai_portrait_raw')

FINAL_W, FINAL_H = 80, 120

IDS = ['wanderer', 'saint', 'berserker', 'thunder', 'bloodthirsty', 'apostle']


def flood_key_bg(im, tol=40):
    """从画布四边泛洪，删除与边界连通的背景色像素。

    相比众数色键控，泛洪保证只删「外部背景」，主体内部的浅色/白色区域
    （如圣徒白金袍、骸骨白骨）不会被误伤。
    tol 为通道最大差容差；AI 出图的白底常带轻微噪点与渐变，40 足够宽松。
    """
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()

    # 以四角均值作为背景基准色（比单点取样抗噪）
    corners = [px[0, 0][:3], px[w - 1, 0][:3], px[0, h - 1][:3], px[w - 1, h - 1][:3]]
    bg = tuple(sum(c[i] for c in corners) // 4 for i in range(3))

    def near_bg(p):
        return max(abs(p[0] - bg[0]), abs(p[1] - bg[1]), abs(p[2] - bg[2])) <= tol

    visited = bytearray(w * h)
    dq = deque()

    # 四边全部入队作为泛洪种子
    for x in range(w):
        for y in (0, h - 1):
            i = y * w + x
            if not visited[i] and near_bg(px[x, y][:3]):
                visited[i] = 1
                dq.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            i = y * w + x
            if not visited[i] and near_bg(px[x, y][:3]):
                visited[i] = 1
                dq.append((x, y))

    while dq:
        x, y = dq.popleft()
        px[x, y] = (0, 0, 0, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                i = ny * w + nx
                if not visited[i] and near_bg(px[nx, ny][:3]):
                    visited[i] = 1
                    dq.append((nx, ny))
    return im


def fit_contain(im, tw, th):
    """等比缩放到能放进 tw×th 的最大尺寸，再居中贴到透明画布上。"""
    w, h = im.size
    scale = min(tw / w, th / h)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    resized = im.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new('RGBA', (tw, th), (0, 0, 0, 0))
    canvas.paste(resized, ((tw - nw) // 2, (th - nh) // 2), resized)
    return canvas


def process(id_):
    src_dir = os.path.join(RAW, id_)
    files = sorted(glob.glob(os.path.join(src_dir, '*.png')))
    if not files:
        print(f'SKIP {id_}: {src_dir} 下无原图')
        return False
    src = files[-1]  # 同目录多张时取最新

    im = Image.open(src).convert('RGBA')
    im = flood_key_bg(im)

    bbox = im.getbbox()
    if not bbox:
        print(f'FAIL {id_}: 键控后全透明（背景色判定过宽？）')
        return False
    im = im.crop(bbox)

    out = fit_contain(im, FINAL_W, FINAL_H)

    # 覆盖率自检：主体过小或过满都说明键控异常
    alpha = out.getchannel('A')
    opaque = sum(1 for v in alpha.get_flattened_data() if v > 200) if hasattr(alpha, 'get_flattened_data') \
        else sum(1 for v in list(alpha.getdata()) if v > 200)
    cover = opaque / (FINAL_W * FINAL_H) * 100

    dst = os.path.join(OUT, f'portrait_{id_}.png')
    out.save(dst, compress_level=9)
    print(f'OK {id_}: {os.path.basename(src)} -> portrait_{id_}.png '
          f'{out.size} 覆盖率={cover:.1f}%')
    return True


if __name__ == '__main__':
    only = sys.argv[1:] or IDS
    ok = 0
    for i in only:
        if i not in IDS:
            print(f'SKIP {i}: 未知血裔 id')
            continue
        if process(i):
            ok += 1
    print(f'--- 完成 {ok}/{len(only)} ---')
