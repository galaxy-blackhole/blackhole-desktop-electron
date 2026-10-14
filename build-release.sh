#!/bin/bash
#
# The self-contained release: the window, a real Node, and the host, so the app runs on a machine that has never
# installed any of them. DSH's native addon refuses Electron's Node by runtime fingerprint, which is why a real
# Node has to travel with the app.
#
set -eu
cd "$(dirname "$0")"
APP=release/Galaxy-Blackhole.app
CLI="${GBH_CLI:-$HOME/.nvm/versions/node/v26.9.0/lib/node_modules/@galaxy-stack/blackhole-cli}"
NODE_BIN="$(command -v node)"

echo "1/5 vỏ Electron"
# cp -R into an existing directory nests the copy, so the destination must not exist yet.
rm -rf "$APP" release/host
cp -R node_modules/electron/dist/Electron.app "$APP"

echo "2/5 mã của app"
mkdir -p "$APP/Contents/Resources/app/src"
cp src/main.js "$APP/Contents/Resources/app/src/main.js"
printf '%s' '{ "name": "galaxy-blackhole", "productName": "Galaxy Blackhole", "version": "0.1.0", "main": "src/main.js" }' > "$APP/Contents/Resources/app/package.json"

echo "3/5 node runtime đi kèm"
mkdir -p "$APP/Contents/Resources/app/host/bin"
cp "$NODE_BIN" "$APP/Contents/Resources/app/host/bin/node"

echo "4/5 host (CLI + DSH), bỏ phần của nền khác"
mkdir -p "$APP/Contents/Resources/app/host/cli"
rsync -a --exclude 'node_modules/node-pty/prebuilds/win32-*' \
  --exclude 'node_modules/sherpa-onnx-*' --exclude 'node_modules/@opentelemetry' \
  --exclude 'node_modules/@img/sharp-win32-*' --exclude 'node_modules/@img/sharp-linux-*' \
  "$CLI/" "$APP/Contents/Resources/app/host/cli/"

echo "5/5 kích thước"
du -sh "$APP" | cut -c1-40
du -sh "$APP/Contents/Resources/app/host" | cut -c1-40
