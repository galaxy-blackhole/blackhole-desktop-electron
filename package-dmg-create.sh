#!/bin/bash
#
# The disk image, built by the tool that exists for exactly this.
#
# hdiutil makes the image and Finder decides the layout, and Finder refuses half of what it is asked for on this
# machine — silently, in two different ways, with a volume-name cache in the middle. create-dmg has met all of that
# before and carries the retries and the workarounds; the layout it produces is the one people recognise.
#
set -euo pipefail
cd "$(dirname "$0")"

APP=release/Galaxy-Blackhole.app
DMG=release/Galaxy-Blackhole.dmg
NAME="Galaxy Blackhole"

command -v create-dmg > /dev/null || { echo "chưa có create-dmg ✗ — chạy: brew install create-dmg"; exit 1; }

echo "1/3 dựng thư mục nguồn"
STAGE=$(mktemp -d)/stage
mkdir -p "$STAGE"
cp -R "$APP" "$STAGE/$NAME.app"

echo "2/3 create-dmg (app trái ✓ Applications phải ✓ icon 128 ✓ cửa sổ 660×440 ✓)"
rm -f "$DMG"
create-dmg \
  --volname "$NAME" \
  --window-pos 200 120 \
  --window-size 660 440 \
  --icon-size 128 \
  --icon "$NAME.app" 170 220 \
  --hide-extension "$NAME.app" \
  --app-drop-link 490 220 \
  --no-internet-enable \
  "$DMG" "$STAGE" 2>&1 | tail -8 | sed 's/^/     /'

echo "3/3 kiểm chứng"
du -sh "$DMG" | cut -c1-40 | sed 's/^/     /'
rm -rf /tmp/gbh-cdmg && mkdir -p /tmp/gbh-cdmg
hdiutil attach -nobrowse -readonly "$DMG" -mountpoint /tmp/gbh-cdmg > /dev/null
ls /tmp/gbh-cdmg | sed 's/^/     trong ảnh: /'
if [ -f /tmp/gbh-cdmg/.DS_Store ]; then echo "     .DS_Store CÓ ✓✓ → LAYOUT ĐÃ LƯU ✓✓"; else echo "     .DS_Store KHÔNG có ✗"; fi
hdiutil detach /tmp/gbh-cdmg > /dev/null 2>&1 || true
