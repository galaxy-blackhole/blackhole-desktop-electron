#!/bin/bash
#
# Stages what travels with the app: a real Node (DSH's native addon refuses Electron's runtime by fingerprint), the
# host CLI, and the versions the upgrade panel reads back. electron-builder packages this directory, so the layout
# written here IS the layout inside Resources/app — the shell resolves its host at ../host/cli/dist/cli.js.
#
set -eu
cd "$(dirname "$0")/.."

DESKTOP_VERSION="$(node -p "require('./package.json').version")"
# The globally installed CLI is the default source; CI overrides it with the version it just installed from the
# registry, so the app always carries the CLI that was actually published.
CLI="${GBH_CLI:-$(npm root -g)/@galaxy-stack/blackhole-cli}"
NODE_BIN="${GBH_NODE_BIN:-$(command -v node)}"

if [ ! -f "$CLI/package.json" ]; then
  echo "không thấy CLI ở $CLI" >&2
  echo "cài nó (npm i -g @galaxy-stack/blackhole-cli) hoặc đặt GBH_CLI=<đường dẫn>" >&2
  exit 1
fi
CLI_VERSION="$(node -p "require('$CLI/package.json').version")"

echo "1/3 host: CLI $CLI_VERSION từ $CLI"
rm -rf host
mkdir -p host/bin host/cli
cp "$NODE_BIN" host/bin/node
rsync -a --exclude 'node_modules/node-pty/prebuilds/win32-*' \
  --exclude 'node_modules/sherpa-onnx-*' --exclude 'node_modules/@opentelemetry' \
  --exclude 'node_modules/@img/sharp-win32-*' --exclude 'node_modules/@img/sharp-linux-*' \
  "$CLI/" host/cli/

echo "2/3 build-info.json"
node -e "
  const fs = require('node:fs');
  const { execFileSync } = require('node:child_process');
  let commit = 'unknown';
  try { commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch {}
  fs.writeFileSync('build-info.json', JSON.stringify({
    bundledCliVersion: process.argv[1],
    builtAt: new Date().toISOString(),
    commit,
    desktopVersion: process.argv[2],
  }, null, 2) + '\n');
" "$CLI_VERSION" "$DESKTOP_VERSION"

echo "3/3 cổng chặn đồng bộ version"
node scripts/check-version-sync.mjs
du -sh host | cut -c1-40