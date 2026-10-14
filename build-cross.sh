#!/bin/bash
#
# Windows and Linux packages that actually run.
#
# npm is not asked for Electron here: its allowScripts gate never runs the postinstall, and its own unzip leaves
# an empty app behind, which is how the first attempt produced 800 KB "Electron" folders. The official release
# zip is fetched and unpacked directly instead — the same route that fixed macOS.
#
# What is produced is an artefact, not a tested app: this machine is a Mac, so Windows and Linux have to be
# installed and checked on their own systems.
#
set -eu
cd "$(dirname "$0")"
OUT=release/cross
NODE_VER=v22.20.0
ELECTRON_VER=v38.4.0
BASE=https://github.com/electron/electron/releases/download/$ELECTRON_VER
CLI="$HOME/.nvm/versions/node/v26.9.0/lib/node_modules/@galaxy-stack/blackhole-cli"
mkdir -p "$OUT" /tmp/gbh-cross

fetch_zip() {
  local url=$1 file=$2 dir=$3
  if [ ! -f "$file" ]; then
    curl -fsSL -o "$file" "$url" || { echo "    ✗ tải hỏng: $url"; return 1; }
  fi
  echo "    $(du -h "$file" | cut -f1)  $(basename "$file")"
  rm -rf "$dir" && mkdir -p "$dir"
  ditto -x -k "$file" "$dir" || { echo "    ✗ giải nén hỏng"; return 1; }
}

echo "1/4 electron cho windows"
fetch_zip "$BASE/electron-$ELECTRON_VER-win32-x64.zip" /tmp/gbh-cross/electron-win.zip /tmp/gbh-cross/win
echo "2/4 electron cho linux"
fetch_zip "$BASE/electron-$ELECTRON_VER-linux-x64.zip" /tmp/gbh-cross/electron-linux.zip /tmp/gbh-cross/linux

echo "3/4 node runtime"
[ -f /tmp/node-win.zip ] || curl -fsSL -o /tmp/node-win.zip "https://nodejs.org/dist/$NODE_VER/node-$NODE_VER-win-x64.zip"
[ -f /tmp/node-linux.tar.xz ] || curl -fsSL -o /tmp/node-linux.tar.xz "https://nodejs.org/dist/$NODE_VER/node-$NODE_VER-linux-x64.tar.xz"
rm -rf /tmp/node-win-extract /tmp/node-$NODE_VER-linux-x64
unzip -q -o /tmp/node-win.zip -d /tmp/node-win-extract
tar -xJf /tmp/node-linux.tar.xz -C /tmp

echo "4/4 ghép gói"
for target in windows linux; do
  case $target in
    windows) SRC=/tmp/gbh-cross/win; NODEBIN=/tmp/node-win-extract/node-$NODE_VER-win-x64/node.exe; DESTNAME=node.exe; DROP='linux-*' ;;
    linux)   SRC=/tmp/gbh-cross/linux; NODEBIN=/tmp/node-$NODE_VER-linux-x64/bin/node; DESTNAME=node; DROP='win32-*' ;;
  esac
  P="$OUT/Galaxy-Blackhole-$target-x64"
  rm -rf "$P"
  mkdir -p "$P/app/src" "$P/host/bin" "$P/host/cli" "$P/resources/app"
  cp -R "$SRC"/* "$P/"
  cp src/main.js "$P/app/src/main.js"
  printf '%s' '{ "name": "galaxy-blackhole", "main": "app/src/main.js" }' > "$P/resources/app/package.json"
  cp "$NODEBIN" "$P/host/bin/$DESTNAME"
  rsync -a --exclude "node_modules/node-pty/prebuilds/$DROP" --exclude 'node_modules/node-pty/prebuilds/darwin-*' \
    --exclude 'node_modules/sherpa-onnx-*' --exclude 'node_modules/@opentelemetry' \
    "$CLI/" "$P/host/cli/"
  echo "  $target: electron $(du -sh "$P" | cut -f1) · node $(du -h "$P/host/bin/$DESTNAME" | cut -f1)"
  if [ "$target" = windows ]; then (cd "$OUT" && rm -f "Galaxy-Blackhole-windows-x64.zip" && zip -q -r "Galaxy-Blackhole-windows-x64.zip" "Galaxy-Blackhole-windows-x64");
  else (cd "$OUT" && rm -f "Galaxy-Blackhole-linux-x64.tar.gz" && tar -czf "Galaxy-Blackhole-linux-x64.tar.gz" "Galaxy-Blackhole-linux-x64"); fi
done

echo "--- kết quả"
ls -la "$OUT"/*.zip "$OUT"/*.tar.gz 2>/dev/null | awk '{printf "  %s  %.0f MB\n", $9, $5/1048576}'
