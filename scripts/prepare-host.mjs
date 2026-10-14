#!/usr/bin/env node
/**
 * Stages what travels with the app: a real Node (DSH's native addon refuses Electron's runtime by fingerprint), the
 * host CLI, and the versions the upgrade panel reads back.
 *
 * Written in Node rather than shell on purpose. The first version used rsync, which does not exist on a Windows
 * runner, and it excluded the win32 prebuilds while building the Windows app — the copy has to know which platform
 * it is packing for, and that is a fact the target, not the builder's laptop, decides.
 *
 * The layout written here IS the layout inside Resources/app: the shell resolves its host at host/cli/dist/cli.js
 * next to host/bin/node.
 */
import { copyFileSync, existsSync, lstatSync, mkdirSync, readlinkSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

const target = process.env.GBH_TARGET ?? process.platform;
const cliDir = process.env.GBH_CLI
  ?? join(execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), '@galaxy-stack', 'blackhole-cli');

if (!existsSync(join(cliDir, 'package.json'))) {
  console.error(`không thấy CLI ở ${cliDir}`);
  console.error('  cài nó (npm i -g @galaxy-stack/blackhole-cli) hoặc đặt GBH_CLI=<đường dẫn>');
  process.exit(1);
}
const desktopVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
const cliVersion = JSON.parse(readFileSync(join(cliDir, 'package.json'), 'utf8')).version;

/*
 * Everything that is not this target's is dead weight — and worse than dead weight: a mac build that keeps the
 * win32 prebuilds ships 40 MB nobody can load, and a Windows build that keeps only the mac ones ships a node-pty
 * that refuses to start.
 */
const foreign = new Set(['darwin', 'win32', 'linux'].filter((platform) => platform !== target));
const skip = (source) => {
  const entry = relative(cliDir, source).split(sep).join('/');
  if (entry === '') return false;
  if (entry.startsWith('node_modules/@opentelemetry')) return true;
  if (entry.startsWith('node_modules/sherpa-onnx-')) return true;
  const prebuild = /^node_modules\/node-pty\/prebuilds\/([a-z0-9]+)-/.exec(entry);
  if (prebuild !== null && foreign.has(prebuild[1])) return true;
  const sharp = /^node_modules\/@img\/sharp-([a-z0-9]+)-/.exec(entry);
  if (sharp !== null && foreign.has(sharp[1])) return true;
  return false;
};

console.log(`1/3 host: CLI ${cliVersion} từ ${cliDir} (cho ${target})`);
/*
 * Absolute paths, every one of them: cpSync throws ENOENT when its destination is relative, and it did so silently
 * enough that the build looked fine while host/cli was never created.
 */
const hostDir = join(root, 'host');
rmSync(hostDir, { force: true, recursive: true });
mkdirSync(join(hostDir, 'bin'), { recursive: true });
/* process.execPath is the Node running this script, which on Windows is node.exe — the name the shell looks for. */
copyFileSync(process.execPath, join(hostDir, 'bin', process.platform === 'win32' ? 'node.exe' : 'node'));
/*
 * The destination must NOT exist: cpSync into an existing directory nests the copy one level down, which shipped a
 * host whose CLI lived at host/cli/blackhole-cli and a shell that found nothing to run.
 *
 * Dereferenced: npm's .bin entries are symlinks, and a Windows runner cannot always create them.
 */
/*
 * A copy written here rather than fs.cpSync: cpSync answered ENOENT on a relative destination and then, with that
 * fixed, still created nothing without raising — three attempts, no error, an empty host. This walks the tree
 * itself, keeps symlinks the way rsync did, follows one when the platform refuses to create it, and reports how
 * many entries it wrote so a silent nothing is impossible.
 */
function copyTree(source, destination) {
  const stats = lstatSync(source);
  if (stats.isSymbolicLink()) {
    const linkTarget = readlinkSync(source);
    try {
      symlinkSync(linkTarget, destination);
      return 1;
    } catch {
      /*
       * A platform that refuses to create the link gets the thing it pointed at. Following it matters: npm's .bin
       * entries include links to directories, and copying one of those as a file fails with EISDIR — which is how
       * the macOS and Linux runners failed a step that passed on the machine this was written on.
       */
      const target = statSync(source);
      if (target.isDirectory()) return copyTree(realpathSync(source), destination);
      copyFileSync(source, destination);
      return 1;
    }
  }
  if (stats.isDirectory()) {
    mkdirSync(destination, { recursive: true });
    let count = 1;
    for (const entry of readdirSync(source)) {
      const from = join(source, entry);
      if (skip(from)) continue;
      count += copyTree(from, join(destination, entry));
    }
    return count;
  }
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  return 1;
}

const copied = copyTree(cliDir, join(hostDir, 'cli'));
console.log(`  → đã copy ${copied} mục vào host/cli`);
if (!existsSync(join(hostDir, 'cli', 'package.json'))) {
  console.error('  ✗ host/cli/package.json không có — bản build này sẽ không chạy được');
  process.exit(1);
}

console.log('2/3 build-info.json');
let commit = 'unknown';
try { commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch {}
writeFileSync('build-info.json', JSON.stringify({
  bundledCliVersion: cliVersion,
  builtAt: new Date().toISOString(),
  commit,
  desktopVersion,
  target,
}, null, 2) + String.fromCharCode(10));

console.log('3/3 cổng chặn đồng bộ version');
await import('./check-version-sync.mjs');
