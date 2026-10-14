/**
 * The upgrade decision, with no Electron in it.
 *
 * Kept apart from the window on purpose: what should happen when someone clicks upgrade is a question about
 * versions and platforms, and a question like that can be answered in a test instead of by clicking.
 */
const { execFileSync } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

/** The package the CLI is published as; the desktop carries the same version of it. */
const CLI_PACKAGE = '@galaxy-stack/blackhole-cli';

function readVersion(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')).version; } catch { return null; }
}

/**
 * The three versions this machine can disagree about.
 *
 * The window's own, the CLI travelling inside it, and the CLI on the PATH — which is the one a terminal runs, and
 * therefore the one that has to be brought along when the window is upgraded.
 */
function readVersions(appRoot, exec = execFileSync) {
  const info = (() => { try { return JSON.parse(readFileSync(join(appRoot, 'build-info.json'), 'utf8')); } catch { return null; } })();
  return {
    bundledCli: readVersion(join(appRoot, 'host', 'cli', 'package.json')),
    desktop: info?.desktopVersion ?? readVersion(join(appRoot, 'package.json')),
    globalCli: readGlobalCliVersion(exec),
  };
}

/** The version of the CLI npm has installed globally, or null when this machine has none. */
function readGlobalCliVersion(exec = execFileSync) {
  try {
    const root = exec('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
    return readVersion(join(root, '@galaxy-stack', 'blackhole-cli', 'package.json'));
  } catch { return null; }
}

/**
 * The argv that brings the CLI to `version`.
 *
 * It never contains sudo. A build that escalates on its own is a build that can rewrite a machine's global tree
 * without the person ever seeing the prompt; when npm refuses for permissions, the window shows the command and the
 * person decides.
 */
function updateArgv(version) {
  return ['install', '-g', `${CLI_PACKAGE}@${version}`];
}

/**
 * What the upgrade button should do here.
 *
 * macOS cannot self-update an unsigned build — Squirrel.Mac checks a signature the build does not have — so there
 * the honest action is to fetch the new dmg and open it, and let the person drag it across. Windows and Linux
 * replace in place. The CLI half is the same everywhere, and it is opt-in when there is nothing to update.
 */
function planUpgrade(input) {
  const { desktop, globalCli, latest, platform } = input;
  const steps = [];
  const desktopAction = latest === null || latest === desktop
    ? 'none'
    : platform === 'darwin' ? 'download-dmg' : 'in-place';
  if (desktopAction === 'download-dmg') steps.push(`tải bản ${latest} rồi mở tệp dmg để bạn kéo vào Applications`);
  if (desktopAction === 'in-place') steps.push(`tải và thay bản ${latest}, sau đó khởi động lại`);
  if (desktopAction === 'none') steps.push('không có bản desktop mới hơn');

  let cliAction = 'none';
  if (globalCli === null) cliAction = 'install-offer';
  else if (latest !== null && globalCli !== latest) cliAction = 'update';
  if (cliAction === 'update') steps.push(`nâng CLI trên máy từ ${globalCli} lên ${latest}`);
  if (cliAction === 'install-offer') steps.push(`máy chưa có CLI — hiện lệnh cài ${CLI_PACKAGE}@${latest ?? desktop}`);
  if (cliAction === 'none') steps.push('CLI trên máy đã cùng version');

  return { cliAction, desktopAction, steps };
}

/** True when the CLI on the machine is behind the window, which is worth saying out loud. */
function cliIsBehind(versions) {
  return versions.globalCli !== null && versions.desktop !== null && versions.globalCli !== versions.desktop;
}

module.exports = { CLI_PACKAGE, cliIsBehind, existsSync, planUpgrade, readGlobalCliVersion, readVersions, updateArgv };
