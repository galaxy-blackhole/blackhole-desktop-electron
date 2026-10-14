#!/bin/bash
#
# Make an Electron install actually usable on this machine. Three things conspire against it:
#   1. npm's allowScripts gate never runs the postinstall, so the binary is never fetched;
#   2. even when it runs, its own unzip leaves Electron.app without Frameworks;
#   3. a path.txt written with echo carries a newline, and the launcher then fails with ENOENT.
# This does all three properly, and is safe to re-run.
#
set -u
cd "$(dirname "$0")"

echo "1/4 duyệt script cài của electron"
npm install-scripts approve electron > /dev/null 2>&1 || true

echo "2/4 chạy postinstall để tải binary"
rm -rf node_modules/electron/dist
npm rebuild electron --foreground-scripts=true 2>&1 | tail -2

echo "3/4 giải nén bằng ditto (bản unzip của electron bị hụt)"
ZIP=$(find ~/Library/Caches/electron -name '*.zip' | head -1)
if [ -z "$ZIP" ]; then echo "  không thấy zip trong cache ✗"; exit 1; fi
rm -rf node_modules/electron/dist && mkdir -p node_modules/electron/dist
ditto -x -k "$ZIP" node_modules/electron/dist

echo "4/4 ghi path.txt không có ký tự xuống dòng"
printf '%s' 'Electron.app/Contents/MacOS/Electron' > node_modules/electron/path.txt

du -sh node_modules/electron/dist | cut -c1-40
ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron -e "console.log('  node bên trong electron:', process.versions.node)"
