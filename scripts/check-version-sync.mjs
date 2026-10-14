import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * The desktop and the CLI are one product in two shapes, so they carry one version.
 *
 * A release train that bumps one and forgets the other ships an app whose upgrade button offers a CLI that does
 * not exist, or a CLI newer than the window that drives it. The check is cheap and it fails the build instead of
 * failing the person who clicked upgrade.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const desktop = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

let cli;
let source;
try {
  cli = JSON.parse(readFileSync(join(root, 'host', 'cli', 'package.json'), 'utf8')).version;
  source = 'host/cli (bản sẽ đi kèm app)';
} catch {
  /*
   * Resolved the same way the staging resolves it. Reading npm_config_prefix here meant that running this file
   * outside npm — which is exactly what `npm run host:stage` does at its last step — joined an empty string and
   * looked for the CLI under a relative 'lib/node_modules'.
   */
  const { execFileSync } = await import('node:child_process');
  const onWindows = process.platform === 'win32';
  const npm = onWindows ? 'npm.cmd' : 'npm';
  const cliDir = process.env.GBH_CLI
    ?? join(execFileSync(npm, ['root', '-g'], { encoding: 'utf8', shell: onWindows }).trim(), '@galaxy-stack', 'blackhole-cli');
  cli = JSON.parse(readFileSync(join(cliDir, 'package.json'), 'utf8')).version;
  source = cliDir;
}
const info = (() => { try { return JSON.parse(readFileSync(join(root, 'build-info.json'), 'utf8')); } catch { return null; } })();

const problems = [];
if (desktop !== cli) problems.push(`desktop ${desktop} != CLI ${cli} (${source})`);
if (info !== null && info.bundledCliVersion !== cli) problems.push(`build-info ghi CLI ${info.bundledCliVersion} nhưng bản kèm theo là ${cli}`);
if (info !== null && info.desktopVersion !== desktop) problems.push(`build-info ghi desktop ${info.desktopVersion} nhưng package.json là ${desktop}`);

if (problems.length > 0) {
  for (const problem of problems) console.error('  ✗ ' + problem);
  console.error('  ⇒ sửa: đặt version của desktop bằng version của CLI, rồi chạy lại npm run prepare');
  process.exit(1);
}
console.log(`  ✓ desktop ${desktop} == CLI ${cli} (${source})`);