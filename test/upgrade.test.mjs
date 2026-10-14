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
  assert.equal(versions.desktop, '2.2.0');
  assert.equal(versions.bundledCli, '2.2.0');
  assert.equal(versions.globalCli, null, 'a missing npm is a missing CLI, not a crash');
});
