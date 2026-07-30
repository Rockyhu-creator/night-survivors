#!/usr/bin/env python3
"""
Generate 48×48 pixel-art icons for all 39 SKILL_TREE nodes.
Branch colors × type shapes → unique visual identity per node.
Output: public/assets/sk_{node_id}.png
"""
from PIL import Image, ImageDraw
import os, math

OUT = os.path.join(os.path.dirname(__file__), 'public', 'assets')

# ── Palette (dark gothic) ──────────────────────────────────────────────
BRANCH_COLORS = {
    'war': ((198, 60, 60), (140, 40, 40), (255, 120, 120)),    # red: main / dark / bright
    'bly': ((142, 68, 173), (90, 40, 120), (200, 150, 230)),   # purple
    'nfr': ((70, 120, 210), (40, 75, 150), (130, 180, 255)),   # blue
    'eco': ((201, 162, 39), (140, 110, 20), (255, 220, 100)),  # gold
    'utl': ((60, 180, 150), (30, 120, 100), (120, 230, 200)),  # teal
}

BG = (0, 0, 0, 0)       # transparent
OUTLINE = (18, 14, 32)   # dark gothic outline
GLOW = None              # subtle inner highlight

# ── Node catalog (id → branch, type, visual_hint) ──────────────────────
# visual_hint: short string to seed shape variation (e.g. weapon type letter, element)
NODES = [
    # war (征伐) – red, aggressive shapes
    ('war_root',       'war', 'gate',      '⚔'),
    ('war_dmg',        'war', 'stat',      '↑'),
    ('war_cd',         'war', 'stat',      '⚡'),
    ('war_axe_extra',  'war', 'modifier',  '🪓'),
    ('war_lightning_chain','war','modifier','⛈'),
    ('war_holywater_layer','war','modifier','💧'),
    ('war_starfall_crit', 'war', 'modifier','★'),
    ('war_keystone_omni',  'war', 'keystone','✦'),
    ('war_keystone_avalanche','war','keystone','▼'),
    # bly (血裔协同) – purple, organic/blood shapes
    ('bly_root',          'bly', 'gate',     '🩸'),
    ('bly_saint_pulse',   'bly', 'modifier', '✝'),
    ('bly_blood_lifeshield','bly','keystone','🛡'),
    ('bly_thunder_chain', 'bly', 'modifier', '⚡'),
    ('bly_berserk_rage',  'bly', 'stat',     '😤'),
    ('bly_wanderer_omni', 'bly', 'stat',     '≈'),
    ('bly_sanguine_lifesteal','bly','stat','♥'),
    ('bly_keystone_apostle','bly','keystone','✙'),
    # nfr (永夜抗性) – blue, defensive/shield shapes
    ('nfr_root',           'nfr', 'gate',     '🌙'),
    ('nfr_hp',             'nfr', 'stat',     '♥'),
    ('nfr_shield',         'nfr', 'stat',     '🛡'),
    ('nfr_armor',          'nfr', 'stat',     '▣'),
    ('nfr_thorns',         'nfr', 'stat',     '⊕'),
    ('nfr_nightdr',        'nfr', 'stat',     '☾'),
    ('nfr_statusamp',      'nfr', 'stat',     '↗'),
    ('nfr_keystone_endgame','nfr','keystone','◉'),
    # eco (灵魂经济) – gold, coin/value shapes
    ('eco_root',            'eco', 'gate',     '💰'),
    ('eco_gain1',           'eco', 'stat',     '↑'),
    ('eco_gain2',           'eco', 'stat',     '↑↑'),
    ('eco_gate_nightmare',  'eco', 'gate',     '💀'),
    ('eco_nightmare',       'eco', 'stat',     '☠'),
    ('eco_keystone_hoarder','eco', 'keystone','♦'),
    # utl (通用机能) – teal, utility/tech shapes
    ('utl_root',            'utl', 'gate',     '⚙'),
    ('utl_cd',              'utl', 'stat',     '⟳'),
    ('utl_crit',            'utl', 'stat',     '◎'),
    ('utl_critdmg',         'utl', 'stat',     '✖'),
    ('utl_magnet',          'utl', 'stat',     '◎'),
    ('utl_dodge',           'utl', 'stat',     '～'),
    ('utl_regen',           'utl', 'stat',     '♥'),
    ('utl_keystone_efficient','utl','keystone','⬢'),
]

SIZE = 48
CX, CY = SIZE // 2, SIZE // 2


def hex_points(cx, cy, r, n=6, rot=0):
    """Regular polygon vertices."""
    return [(cx + r * math.cos(2 * math.pi * i / n + rot),
             cy + r * math.sin(2 * math.pi * i / n + rot)) for i in range(n)]


def draw_shape(img, node_type, branch, hint=''):
    """Draw the main shape for a node type in branch color."""
    main, dark, bright = BRANCH_COLORS[branch]
    draw = ImageDraw.Draw(img)
    r = 18  # shape radius

    if node_type == 'gate':
        # Hexagon (6-sided)
        pts = hex_points(CX, CY, r, 6, math.pi / 6)
        draw.polygon(pts, fill=main, outline=OUTLINE)
        # Inner detail: smaller hexagon or gate symbol
        pts2 = hex_points(CX, CY, r * 0.5, 6, math.pi / 6)
        draw.polygon(pts2, fill=dark, outline=bright)

    elif node_type == 'keystone':
        # Star (8-pointed)
        outer_r = r
        inner_r = r * 0.45
        pts = []
        for i in range(8):
            angle = math.pi / 2 + 2 * math.pi * i / 8
            rr = outer_r if i % 2 == 0 else inner_r
            pts.append((CX + rr * math.cos(angle), CY + rr * math.sin(angle)))
        draw.polygon(pts, fill=main, outline=OUTLINE)
        # Center gem
        draw.ellipse([CX - 5, CY - 5, CX + 5, CY + 5], fill=bright, outline=dark)

    elif node_type == 'modifier':
        # Diamond / rhombus (rotated square)
        hw, hh = r * 0.78, r
        pts = [(CX, CY - hh), (CX + hw, CY), (CX, CY + hh), (CX - hw, CY)]
        draw.polygon(pts, fill=main, outline=OUTLINE)
        # Inner diamond
        hw2, hh2 = hw * 0.45, hh * 0.45
        pts2 = [(CX, CY - hh2), (CX + hw2, CY), (CX, CY + hh2), (CX - hw2, CY)]
        draw.polygon(pts2, fill=dark, outline=bright)

    else:  # stat
        # Rounded-look square (draw as octagon for pixel feel)
        corner = 6
        pts = [
            (CX - r + corner, CY - r),
            (CX + r - corner, CY - r),
            (CX + r, CY - r + corner),
            (CX + r, CY + r - corner),
            (CX + r - corner, CY + r),
            (CX - r + corner, CY + r),
            (CX - r, CY + r - corner),
            (CX - r, CY - r + corner),
        ]
        draw.polygon(pts, fill=main, outline=OUTLINE)
        # Inner accent bar or dot based on hint
        if hint == '↑' or hint == '↑↑':
            # Up arrow indicator
            draw.polygon([(CX, CY - 10), (CX - 6, CY + 2), (CX + 6, CY + 2)], fill=bright)
        elif hint == '♥':
            # Heart/circle indicator
            draw.ellipse([CX - 5, CY - 3, CX + 5, CY + 7], fill=bright)
        elif hint == '🛡':
            # Shield line
            draw.line([CX - 8, CY, CX + 8, CY], fill=bright, width=2)
        elif hint == '⚡':
            # Lightning bolt-ish
            draw.polygon([(CX - 2, CY - 9), (CX + 4, CY - 1), (CX, CY - 1),
                          (CX + 4, CY + 9), (CX - 4, CY + 1), (CX, CY + 1)], fill=bright)
        else:
            # Default: center dot
            draw.ellipse([CX - 4, CY - 4, CX + 4, CY + 4], fill=bright, outline=dark)

    # Subtle 1px inner glow at top-left edge
    pass  # kept simple for pixel aesthetic


def add_outline_glow(img):
    """Add a 1px darker outline by drawing shape slightly larger first."""
    # Already handled by outline color in each shape
    pass


def gen_icon(node_id, branch, node_type, hint=''):
    img = Image.new('RGBA', (SIZE, SIZE), BG)
    draw_shape(img, node_type, branch, hint)
    path = os.path.join(OUT, f'sk_{node_id}.png')
    img.save(path, compress_level=9)
    return path


def main():
    os.makedirs(OUT, exist_ok=True)
    paths = []
    for nid, branch, ntype, hint in NODES:
        p = gen_icon(nid, branch, ntype, hint)
        paths.append(p)
        sz = os.path.getsize(p)
        print(f'  {nid:28s} → sk_{nid}.png ({sz}B)')
    print(f'\nDone: {len(paths)} icons → {OUT}/')


if __name__ == '__main__':
    main()
