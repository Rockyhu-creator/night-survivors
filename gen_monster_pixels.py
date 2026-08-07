#!/usr/bin/env python3
# v4.1 · 怪物/精英/Boss 立绘像素化脚本（AI PNG -> 像素 sprite）
# 输入：.ai_monster_raw/<id>/*.png（由内置 ImageGen 生成的 1024² 原图）
# 输出：public/assets/<目标文件名>（RGBA，1px 暗描边，compress_level=9）
#
# 管线：ImageGen 出 1024² 原图 → 本脚本后处理（众数色键控 / 裁 bbox / LANCZOS 缩到 GRID / NEAREST 2x / 描边）
#
# 与 gen_passive_pixels.py 的差异（关键）：
#   passive icon 主体刻意只占画布一半（icon 四周留白）；怪物贴图必须**填满画布**，
#   否则游戏内 drawImage 到 spriteSize 后主体显著偏小。故本脚本按 GRID 填满 + 仅留描边余量。
#
# 复用 gen_passive_pixels 的已验证函数：众数色键控 / 去水印连通域 / 描边 / 质心居中 / 亮度兜底。
import os, glob, sys
from PIL import Image

from gen_passive_pixels import (
    has_real_alpha, key_bg, remove_watermark, add_outline, recenter_com, auto_brighten,
)
from gen_portrait_pixels import flood_key_bg  # 血裔与 portrait 卡同策略：边缘泛洪键控

OUT = os.path.join(os.path.dirname(__file__), 'public', 'assets')
RAW = os.path.join(os.path.dirname(__file__), '.ai_monster_raw')

# id -> (输出文件名, FINAL 画布边长, GRID 像素网格)
# FINAL 对齐现有资产规格：Boss 64 / 精英 96 / 小怪 34~52。
# GRID = FINAL/2 -> NEAREST 2x 放大得 2px 实心块（复古 chunky，与 passive 一致）；
# 小怪尺寸本就小，GRID=FINAL/2 会丢失辨识细节，故用 FINAL 同值（1px 块）保留轮廓。
SPECS = {
    # ---- Boss（64×64，对齐 boss_baron/queen/overlord）----
    'herald':         ('boss_herald.png',         64, 32),
    'alchemist':      ('boss_alchemist.png',      64, 32),
    'warlord':        ('boss_warlord.png',        64, 32),
    # P7: 原有 3 Boss 重设计（彻底替换旧模板形象）
    'baron':          ('boss_baron.png',           64, 32),
    'queen':          ('boss_queen.png',           64, 32),
    'overlord':       ('boss_overlord.png',        64, 32),
    # P7: 终局 Boss 独立立绘（不再复用 overlord）
    'avatar':         ('boss_avatar.png',          64, 32),
    # ---- 精英（96×96，对齐 enemy_elite/gargoyle）----
    'elite_reaver':   ('enemy_elite_reaver.png',  96, 48),
    'elite_conduit':  ('enemy_elite_conduit.png', 96, 48),
    'elite_colossus': ('enemy_elite_colossus.png',96, 48),
    # ---- 小怪（尺寸贴近各自 spriteSize，1px 块保细节）----
    'rat_swarm':      ('enemy_rat_swarm.png',     34, 34),
    'spitter':        ('enemy_spitter.png',       44, 44),
    'bone_knight':    ('enemy_bone_knight.png',   52, 52),
    'plague_bearer':  ('enemy_plague_bearer.png', 50, 50),
    'siren':          ('enemy_siren.png',         46, 46),
    'revenant':       ('enemy_revenant.png',      52, 52),
    # 注：6 血裔已迁移到 gen_bloodline_pixels.py（与选择卡片共用源图+边缘泛洪管线），此处不再生成。
}


def process(id_):
    spec = SPECS.get(id_)
    if not spec:
        print(f'SKIP {id_}: 未在 SPECS 中定义')
        return False
    fname, FINAL, GRID = spec

    src_glob = glob.glob(os.path.join(RAW, id_, '*.png'))
    if not src_glob:
        print(f'SKIP {id_}: no source png in {os.path.join(RAW, id_)}')
        return False
    src = sorted(src_glob)[0]

    im = Image.open(src).convert('RGBA')
    if id_ in ('wanderer', 'saint', 'berserker', 'thunder', 'bloodthirsty', 'apostle'):
        im = flood_key_bg(im)           # 血裔与 portrait 卡同源：边缘泛洪键控（保 saint 白袍，避免众数色抠穿）
    elif not has_real_alpha(im):
        im = key_bg(im)                 # 其余怪物：众数色键控（纯白底 -> 透明）
    im = remove_watermark(im)           # 去 ImageGen 水印/角落噪点连通域

    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    bw, bh = im.size
    if bw == 0 or bh == 0:
        print(f'SKIP {id_}: empty after key/crop')
        return False

    # 填满 GRID 网格，仅留 1 格描边余量（与 passive 的「占一半」策略相反）
    target = max(1, GRID - 2)
    scale = min(target / bw, target / bh)
    nw, nh = max(1, round(bw * scale)), max(1, round(bh * scale))
    grid = im.resize((nw, nh), Image.LANCZOS)

    # 先在 GRID 画布上居中，再整体 NEAREST 放大到 FINAL（保证像素块整齐对齐）
    mult = max(1, round(FINAL / GRID))
    gcanvas = Image.new('RGBA', (GRID, GRID), (0, 0, 0, 0))
    gcanvas.paste(grid, ((GRID - nw) // 2, (GRID - nh) // 2), grid)

    out = gcanvas.resize((GRID * mult, GRID * mult), Image.NEAREST)
    if out.size != (FINAL, FINAL):      # GRID*mult 与 FINAL 不整除时兜底
        canvas = Image.new('RGBA', (FINAL, FINAL), (0, 0, 0, 0))
        ox, oy = (FINAL - out.size[0]) // 2, (FINAL - out.size[1]) // 2
        canvas.paste(out, (ox, oy), out)
        out = canvas

    out = add_outline(out)              # 1px 暗描边（OUTLINE 与全项目一致）
    out = recenter_com(out)             # 质心再居中，修正累积偏移
    out = auto_brighten(out)            # 暗色主体亮度兜底

    dst = os.path.join(OUT, fname)
    out.save(dst, compress_level=9)
    print(f'OK   {fname}  ({out.size[0]}x{out.size[1]}, src={os.path.basename(src)})')
    return True


if __name__ == '__main__':
    only = sys.argv[1:] or list(SPECS.keys())
    ok = 0
    for i in only:
        if process(i):
            ok += 1
    print(f'---- done: {ok}/{len(only)} ----')
