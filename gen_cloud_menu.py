#!/usr/bin/env python3
# 云存档主菜单按钮图标（v5.13）：复用 gen_passive_pixels.py 管线
# 输入：.ai_passive_raw/cloud/*.png（ImageGen，亮主色+粗轮廓+白底 v2 铁律）
# 输出：public/assets/cloud_menu.png（80x80 RGBA，1px 暗描边，compress_level=9）
# 与 skilltree_menu.png 同规格；独立脚本避免触碰 gen_assets.py 的 AI_OWNED 拦截区。
import os
import gen_passive_pixels as gp

OUT_NAME = 'cloud_menu.png'
src_glob = os.listdir(gp.RAW) if False else None
import glob
srcs = sorted(glob.glob(os.path.join(gp.RAW, 'cloud', '*.png')))
if not srcs:
    raise SystemExit('no source png in .ai_passive_raw/cloud/')
src = srcs[-1]  # 取最新一张
from PIL import Image

def ensure_margin(im, margin=2):
    """收尾保底：recenter_com 的质心重定位会把内容推到画布边缘（实测底部贴边），
    这里按 bbox 做整像素平移补边。位移量取偶数，保持 2px 像素块对齐不糊。"""
    w, h = im.size
    bbox = im.getbbox()
    if not bbox:
        return im
    dx = dy = 0
    if bbox[0] < margin:
        dx = margin - bbox[0]
    if bbox[2] > w - margin:
        dx = (w - margin) - bbox[2]
    if bbox[1] < margin:
        dy = margin - bbox[1]
    if bbox[3] > h - margin:
        dy = (h - margin) - bbox[3]
    dx -= dx % 2
    dy -= dy % 2
    if dx == 0 and dy == 0:
        return im
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out.paste(im, (dx, dy), im)
    return out


def process_cloud():
    im = Image.open(src).convert('RGBA')
    if not gp.has_real_alpha(im):
        im = gp.key_bg(im)
    im = gp.remove_watermark(im)
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    bw, bh = im.size
    if bw == 0 or bh == 0:
        raise SystemExit('empty image')
    # 留 12% 内边距：撑满画布会把底部锁具裁掉（实测下边贴边 24px），
    # 目标覆盖率对齐 altar_menu(47%)/guide_menu(49%) 且四边不贴边。
    CONTENT_RATIO = 0.88
    scale = min(gp.GRID / bw, gp.GRID / bh) * CONTENT_RATIO
    nw, nh = max(1, round(bw*scale)), max(1, round(bh*scale))
    grid = im.resize((nw, nh), Image.LANCZOS)
    # 注意：在 GRID(40) 画布上拼贴、再 NEAREST 放大 2x 到 FINAL(80)。
    # 若直接在 FINAL 画布上拼贴，主体只占画布 1/4，图标会明显偏小（实测覆盖率仅 12.5%）。
    canvas = Image.new('RGBA', (gp.GRID, gp.GRID), (0,0,0,0))
    gx_arr = list(grid.getdata())
    sum_x = sum_y = count = 0
    for idx, pixel in enumerate(gx_arr):
        if pixel[3] > 16:
            sum_x += idx % nw
            sum_y += idx // nw
            count += 1
    if count > 0:
        com_x = sum_x / count
        com_y = sum_y / count
        paste_x = int(gp.GRID/2 - com_x)
        paste_y = int(gp.GRID/2 - com_y)
    else:
        paste_x = (gp.GRID - nw) // 2
        paste_y = (gp.GRID - nh) // 2
    canvas.paste(grid, (paste_x, paste_y), grid)
    out = canvas.resize((gp.FINAL, gp.FINAL), Image.NEAREST)
    out = gp.add_outline(out)
    out = gp.recenter_com(out)
    out = gp.auto_brighten(out)
    out = ensure_margin(out, margin=2)
    dst = os.path.join(gp.OUT, OUT_NAME)
    out.save(dst, compress_level=9)
    print(f'OK {OUT_NAME} ({out.size}, src={os.path.basename(src)})')

process_cloud()
