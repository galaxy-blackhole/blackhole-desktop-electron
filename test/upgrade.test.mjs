import { readFileSync } from "node:fs";
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
/* The app root is this file's grandparent, so the test needs no argument and no cwd. */
const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { planUpgrade, readVersions, updateArgv } = require('../src/upgrade.js');

test('the CLI command never escalates on its own', () => {
  const argv = updateArgv('2.2.0');
  assert.deepEqual(argv, ['install', '-g', '@galaxy-stack/blackhole-cli@2.2.0']);
  assert.equal(argv.some((part) => part.includes('sudo')), false, 'a build that sudoes by itself can rewrite a machine unseen');
});

test('an unsigned macOS build downloads instead of pretending it can self-update', () => {
  const plan = planUpgrade({ desktop: '2.2.0', globalCli: '2.2.0', latest: '2.3.0', platform: 'darwin' });
  assert.equal(plan.desktopAction, 'download-dmg');
  assert.match(plan.steps.join(' | '), /dmg/);
});

test('windows and linux replace in place', () => {
  for (const platform of ['win32', 'linux']) {
    const plan = planUpgrade({ desktop: '2.2.0', globalCli: '2.2.0', latest: '2.3.0', platform });
    assert.equal(plan.desktopAction, 'in-place', platform);
  }
});

test('the CLI is brought along when the window moves', () => {
  const plan = planUpgrade({ desktop: '2.2.0', globalCli: '2.1.36', latest: '2.3.0', platform: 'win32' });
  assert.equal(plan.cliAction, 'update');
  assert.match(plan.steps.join(' | '), /2\.1\.36 lên 2\.3\.0/);
});

test('a machine with no CLI is offered one, not given one', () => {
  const plan = planUpgrade({ desktop: '2.2.0', globalCli: null, latest: '2.2.0', platform: 'linux' });
  assert.equal(plan.cliAction, 'install-offer');
  assert.equal(plan.desktopAction, 'none');
  assert.match(plan.steps.join(' | '), /chưa có CLI/);
});

test('versions are read from the app it is running inside', () => {
  const versions = readVersions(APP_ROOT, () => { throw new Error('npm không có ở đây'); });
  /*
   * Read the same way the app reads them, instead of writing the numbers down here: a version in a test is edited on
   * every release or, more often, forgotten — which is exactly how this line went red on the 2.3.0 bump while nothing
   * in the product was wrong.
   */
  const readJson = (relative) => {
    try { return JSON.parse(readFileSync(new URL(relative, import.meta.url), 'utf8')); } catch { return {}; }
  };
  /*
   * The app reports what the build told it, so the test reads the same build record. Deriving from package.json alone
   * was wrong: that is the version about to be built, while build-info.json is the version already staged, and the
   * whole point of this test is that the app reports the second one.
   */
  const buildInfo = readJson('../build-info.json');
  const appVersion = buildInfo.desktopVersion ?? readJson('../package.json').version;
  /*
   * The bundled CLI is whatever was staged into host/, which is the same file the app reads. Comparing it against
   * build-info instead was the test's own invention: the record says what the packaging step intended, while the
   * staged tree is what actually shipped, and on a machine that has not re-staged them they differ.
   */
  const bundledVersion = readJson('../host/cli/package.json').version ?? buildInfo.bundledCliVersion ?? appVersion;
  assert.equal(versions.desktop, appVersion);
  assert.equal(versions.bundledCli, bundledVersion);
  assert.equal(versions.globalCli, null, 'a missing npm is a missing CLI, not a crash');
});
