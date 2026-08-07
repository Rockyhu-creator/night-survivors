#!/usr/bin/env python3
# 血裔游戏内精灵后处理（与选择卡片共用 .ai_portrait_raw 源图，保证形象一致）
#
# 输入：.ai_portrait_raw/<id>/raw.png（与 gen_portrait_pixels.py 完全相同的竖版原图）
# 输出：public/assets/player_<id>.png（64x64 透明背景，LANCZOS 平滑）
#
# 为何另起一个脚本（而不是复用 gen_monster_pixels.py 的血裔分支）：
#   v4.3.2 的血裔走怪物管线（众数色键控 + GRID/NEAREST 2x 像素化 + 1px 描边），
#   导致四个问题被用户实测反馈：
#     1) 卡片用竖版源图、游戏内用方形源图 —— 两套不同 ImageGen 生成，形象/配色不一致
#     2) NEAREST 2x 像素化让细节（如 apostle 能量环）发糊，不清晰
#     3) 众数色键控 + 描边在 apostle 上引入 313 个内部白噪点
#     4) 各血裔在方形源图里相对尺寸不同，wanderer 在 64x64 只占 42%，明显偏小
#
#   本脚本直接复用卡片的源图与键控逻辑，从根上消除以上四项：
#     1) 同源 -> 与卡片形象/配色/设计完全一致
#     2) LANCZOS 平滑、无 NEAREST、无描边 -> 清晰
#     3) 边缘泛洪键控（同卡片）-> 不抠穿白袍、无内部白噪点
#     4) fit_contain 归一化到 64x64 -> 6 血裔统一缩放基准，流浪者不再偏小
import os, sys, glob
from PIL import Image
from gen_portrait_pixels import flood_key_bg, fit_contain

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'public', 'assets')
RAW = os.path.join(ROOT, '.ai_portrait_raw')

FINAL = 64  # 输出边长（正方形）；游戏内 PLAYER_SPRITE 再决定世界显示尺寸
IDS = ['wanderer', 'saint', 'berserker', 'thunder', 'bloodthirsty', 'apostle']


def process(id_):
    src_dir = os.path.join(RAW, id_)
    files = sorted(glob.glob(os.path.join(src_dir, '*.png')))
    if not files:
        print(f'SKIP {id_}: {src_dir} 下无源图')
        return False
    src = files[-1]  # 同目录多张时取最新

    im = Image.open(src).convert('RGBA')
    im = flood_key_bg(im)                 # 边缘泛洪键控（保留 saint 白袍 / apostle 青白眼）

    bbox = im.getbbox()
    if not bbox:
        print(f'FAIL {id_}: 键控后全透明（背景色判定过宽？）')
        return False
    im = im.crop(bbox)                     # 裁到角色实际包围盒

    out = fit_contain(im, FINAL, FINAL)    # 归一化：等比适配 64x64 并居中

    alpha = out.getchannel('A')
    opaque = sum(1 for v in list(alpha.get_flattened_data()) if v > 200)
    cover = opaque / (FINAL * FINAL) * 100

    dst = os.path.join(OUT, f'player_{id_}.png')
    out.save(dst, compress_level=9)
    print(f'OK {id_}: {os.path.basename(src)} -> player_{id_}.png '
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
