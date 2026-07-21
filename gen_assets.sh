#!/bin/bash
# AI 素材批量生成脚本（带重试）：接口为异步生成，需轮询重试直至拿到真实图片
set -u
cd "$(dirname "$0")/public/assets"

API="https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image"
PLACEHOLDER_SIZE=176626   # 占位图固定字节数

gen() {
  local file="$1" size="$2" prompt="$3"
  local enc
  enc=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$prompt")
  local url="$API?prompt=$enc&image_size=$size"
  local try=1
  while [ $try -le 8 ]; do
    curl -sfL --max-time 120 "$url" -o "$file" || { echo "FAIL($try) $file"; rm -f "$file"; try=$((try+1)); sleep 3; continue; }
    local bytes
    bytes=$(stat -f%z "$file")
    if [ "$bytes" != "$PLACEHOLDER_SIZE" ]; then
      echo "OK   $file (${bytes}B, 第${try}次)"
      return 0
    fi
    echo "WAIT($try) $file 生成中..."
    sleep 6
    try=$((try+1))
  done
  echo "GIVEUP $file"
  rm -f "$file"
  return 1
}

STYLE="16-bit pixel art, dark gothic vampire survivors game style, single isolated sprite centered on plain solid white background, no shadow, no scene, no border, no text, clean sharp pixels, top-down game asset"

rm -f *.png   # 清掉占位图重新生成

gen player.png        square "hooded vampire hunter hero character sprite, dark crimson cape and silver armor, glowing red eyes, facing viewer, full body visible, $STYLE"
gen enemy_bat.png     square "dark vampire bat monster sprite, tattered purple-black wings spread wide, glowing red eyes, flying pose, full body visible, $STYLE"
gen enemy_skeleton.png square "undead skeleton warrior sprite, cracked bones, rusty sword, glowing green eye sockets, full body visible, $STYLE"
gen enemy_slime.png   square "giant toxic green slime blob monster sprite, translucent goo body with skulls inside, dripping, full body visible, $STYLE"
gen enemy_elite.png   square "elite vampire lord boss sprite, black and gold armor, huge bat wings, crimson glowing aura, menacing, full body visible, $STYLE"
gen weapon_blade.png  square "crimson blood magic dagger projectile game icon, glowing red blade with dark energy trail, $STYLE"
gen weapon_holywater.png square "holy water flask game icon, glass vial with glowing blue liquid and golden cross, $STYLE"
gen weapon_axe.png    square "spinning throwing axe game icon, silver double headed axe with blue magical glow, $STYLE"
gen weapon_lightning.png square "lightning bolt spell game icon, crackling golden thunderbolt with purple sparks, $STYLE"
gen gem_small.png     square "small glowing emerald crystal gem sprite, green magical glow, faceted, $STYLE"
gen gem_medium.png    square "medium glowing sapphire crystal gem sprite, blue magical glow, faceted, $STYLE"
gen gem_large.png     square "large glowing amethyst crystal gem sprite, purple magical glow, faceted, $STYLE"
gen ground.png        square "seamless tileable dark gothic ground texture, deep purple-black dirt with subtle cracks and sparse dead grass, very dark muted colors, flat top-down view, 16-bit pixel art game texture, no objects, no characters, no text"
gen bg_title.png      landscape_16_9 "epic dark gothic vampire castle on a hill under blood moon, silhouettes of flying bats swarm, misty graveyard foreground, 16-bit pixel art, moody atmospheric, deep blacks with crimson red accents, game title screen background art, no text, no logo"
gen icon_skull.png    square "pixel art skull game icon, bone white skull with red glowing eyes, $STYLE"

echo "---- 生成完毕 ----"
ls -la
