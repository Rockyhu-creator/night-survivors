#!/bin/bash
# 大版本 S 档 · 第三期 AI icon 集（16 张）生成脚本
# 只新增生成 stat_*/passive_*/quest_scroll 共 16 张，绝不删除/覆盖任何既有资产。
# 与 gen_assets.sh 同一 API / STYLE / gen() 重试逻辑；image_size 用 square。
# 注意：这 16 张不要加进 gen_assets.py 的 AI_OWNED，也不要加进 gen_assets.sh 的 AI_FILES，
#       防止整跑时被 rm -f 误删。
#
# 【2026-07-26 复跑须知】文生图 API 当前处于"只读缓存、无法新生成"降级状态：
#   已生成过的 prompt 串稳定返回真图，但全新 prompt 串的首次生成一直返回占位图(176626B)，
#   GET 轮询拿不回。16 张首轮 128 次请求全部占位，未生成任何一张。
#   → 服务恢复后直接 `bash gen_icons.sh` 复跑即可（前几发会命中）；
#     降级期可调大重试：MAX_TRIES=60 SLEEP_SEC=30 bash gen_icons.sh
set -u
cd "$(dirname "$0")/public/assets"

API="https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image"
PLACEHOLDER_SIZE=176626   # 占位图固定字节数
MAX_TRIES="${MAX_TRIES:-30}"   # 服务端降级期加大重试；正常期会被前几次命中
SLEEP_SEC="${SLEEP_SEC:-20}"

# 备注（2026-07-26 诊断）：该 API 按 prompt 串缓存，已生成过的串稳定返回真图；
# 但"首次生成"的新串在服务端降级期间会一直返回占位图（GET 轮询拿不回）。
# 服务正常时本脚本前几次即可命中；降级期请加大 MAX_TRIES / SLEEP_SEC 或择时复跑。
gen() {
  local file="$1" size="$2" prompt="$3"
  local enc
  enc=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$prompt")
  local url="$API?prompt=$enc&image_size=$size"
  local try=1
  while [ $try -le "$MAX_TRIES" ]; do
    curl -sfL --max-time 120 "$url" -o "$file" || { echo "FAIL($try) $file"; rm -f "$file"; try=$((try+1)); sleep 5; continue; }
    local bytes
    bytes=$(stat -f%z "$file")
    if [ "$bytes" != "$PLACEHOLDER_SIZE" ]; then
      echo "OK   $file (${bytes}B, 第${try}次)"
      return 0
    fi
    echo "WAIT($try) $file 生成中..."
    sleep "$SLEEP_SEC"
    try=$((try+1))
  done
  echo "GIVEUP $file"
  rm -f "$file"
  return 1
}

STYLE="16-bit pixel art, dark gothic vampire survivors game style, single isolated game icon sprite centered on plain solid white background, no shadow, no scene, no border, no text, clean sharp pixels, dark muted palette with golden or monochrome accent, 64x64 game icon"

# ---- 面板属性 icon（stat_*，9 张）----
gen stat_hp.png          square "red pixel heart with golden outline, blood drop, health stat icon, $STYLE"
gen stat_exp.png         square "glowing cyan soul orb gem with swirling spirit wisp inside, experience bonus stat icon, distinct from plain crystal gem, $STYLE"
gen stat_magnet.png      square "horseshoe magnet with purple gravitational ring waves, pickup range stat icon, $STYLE"
gen stat_critmul.png     square "exploding golden sword blade shattering with sparks, critical damage stat icon, $STYLE"
gen stat_critrate.png    square "golden crosshair reticle with single red eye in center, critical rate stat icon, $STYLE"
gen stat_shield.png      square "blue energy shield, glowing arcane barrier hexagon, shield stat icon, $STYLE"
gen stat_shieldregen.png square "blue energy shield with circular golden regen arrow around it, shield regeneration stat icon, $STYLE"
gen stat_armor.png       square "dark iron plate armor chestpiece, steel bulwark, armor defense stat icon, $STYLE"
gen stat_dodge.png       square "ghostly fading afterimage of a running figure, phantom dash, dodge stat icon, $STYLE"

# ---- 新被动 icon（passive_*，6 张，对齐既有 passive_ 系列）----
gen passive_critrate.png    square "crimson crosshair with demonic red eye, deadly focus passive skill icon, $STYLE"
gen passive_critdmg.png     square "massive crimson greatsword blade bursting with golden sparks, destruction blade passive skill icon, $STYLE"
gen passive_shield.png      square "spectral blue barrier shield with ghostly skull emblem, ghost-energy barrier passive skill icon, $STYLE"
gen passive_shieldregen.png square "blue shield surrounded by echoing ripple rings of psychic energy, psionic echo passive skill icon, $STYLE"
gen passive_armor.png       square "midnight black knight armor with dark purple trim, night armor passive skill icon, $STYLE"
gen passive_dodge.png       square "phantom assassin silhouette splitting into fading afterimages, phantom step passive skill icon, $STYLE"

# ---- 局内挑战任务卷轴（1 张）----
gen quest_scroll.png     square "old parchment scroll tied with golden ribbon and red wax seal, quest scroll icon, $STYLE"

echo "---- 16 张 icon 生成完毕 ----"
for f in stat_hp.png stat_exp.png stat_magnet.png stat_critmul.png stat_critrate.png \
         stat_shield.png stat_shieldregen.png stat_armor.png stat_dodge.png \
         passive_critrate.png passive_critdmg.png passive_shield.png passive_shieldregen.png \
         passive_armor.png passive_dodge.png quest_scroll.png; do
  if [ -f "$f" ]; then
    printf "%-28s %s B\n" "$f" "$(stat -f%z "$f")"
  else
    echo "$f MISSING"
  fi
done
