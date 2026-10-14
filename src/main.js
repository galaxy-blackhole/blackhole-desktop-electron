/**
 * The Electron shell, the way the reference desktop app works: it owns its host instead of pointing at somebody
 * else's server.
 *
 * Two things it learned the hard way. The host must run on a real Node — DSH's native addon refuses Electron's
 * runtime by fingerprint — so a packaged build carries its own Node and in development the machine's stands in.
 * And the host's address is found by its marker rather than by a pattern, because the escaping a regular
 * expression needs in this file has been written wrong twice.
 *
 * --smoke records the marks, prints one JSON line and quits.
 */
const { app, BrowserWindow } = require("electron");
const { spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const { dirname, join } = require("node:path");

/** The page the window shows while the host boots. */
const SHELL_HTML = [
  "<!doctype html><html><head><meta charset='utf-8'><title>Galaxy Blackhole</title>",
  "<style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;",
  "background:#1a1a1a;color:#9d9d9d;font:13px -apple-system,system-ui,sans-serif}",
  "span{display:flex;gap:10px;align-items:center}i{width:8px;height:8px;border-radius:50%;",
  "background:#4d6bfe;animation:p 1.1s ease-in-out infinite}@keyframes p{50%{opacity:.25}}",
  "</style></head><body><span><i></i>Galaxy Blackhole dang khoi dong…</span></body></html>",
].join("");

const NEWLINE = String.fromCharCode(10);
const smoke = process.argv.includes("--smoke");
const started = Date.now();
const marks = [];
const mark = (name) => { marks.push({ at: Date.now() - started, name }); };

/* The packaged build carries both: a real Node (DSH refuses Electron's) and the host next to it. */
const CLI = process.env.GBH_HOST_ENTRY ?? join(__dirname, "..", "host", "cli", "dist", "cli.js");
const BUNDLED_NODE = join(__dirname, "..", "host", "bin", "node");
const NODE = process.env.GBH_NODE ?? (existsSync(BUNDLED_NODE) ? BUNDLED_NODE : "node");
let host = null;
let reported = false;

function startHost() {
  return new Promise((resolve) => {
    if (!existsSync(CLI)) { resolve(null); return; }
    host = spawn(NODE, [CLI, "web", "--port", "0", "--no-open"], {
      cwd: dirname(dirname(CLI)),
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    mark("host:spawned");
    let buffer = "";
    const onData = (chunk) => {
      buffer += String(chunk);
      const marker = buffer.indexOf("?token=");
      const from = marker < 0 ? -1 : buffer.lastIndexOf("http://", marker);
      const to = marker < 0 ? -1 : buffer.indexOf(NEWLINE, marker);
      if (from >= 0 && to > from) {
        mark("host:ready");
        resolve(buffer.slice(from, to).trim());
      }
    };
    host.stdout.on("data", onData);
    host.stderr.on("data", onData);
    host.on("exit", () => { resolve(null); });
    setTimeout(() => {
      process.stderr.write("host chua in URL sau 90s; output: " + buffer.slice(0, 300) + NEWLINE);
      resolve(null);
    }, 90000);
  });
}

app.whenReady().then(async () => {
  mark("ready");
  /*
   * The window opens first and shows a waiting page: the host takes seconds to boot, and a shell that stays
   * invisible for all of them reads as slow no matter what the clock says.
   */
  const window = new BrowserWindow({ backgroundColor: "#1a1a1a", height: 860, show: !smoke, width: 1280 });
  void window.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(SHELL_HTML));
  mark("window:early");
  const url = process.env.GBH_DESKTOP_URL ?? await startHost();
  if (url === null) { mark("host:failed"); finish(null); return; }
  window.webContents.on("did-finish-load", () => {
    mark("loaded");
    window.webContents.executeJavaScript("window.__DSH_BOOT__ ? 'booted' : 'no-boot'")
      .then((state) => mark("boot:" + state))
      .catch(() => undefined)
      .then(() => finish(window));
  });
  window.webContents.on("did-fail-load", (_event, code) => { mark("failed:" + code); finish(window); });
  window.loadURL(url);
});

function finish(window) {
  if (reported) return;
  reported = true;
  const memoryKb = app.getAppMetrics().reduce((sum, entry) => sum + (entry.memory?.workingSetSize ?? 0), 0);
  process.stdout.write(JSON.stringify({
    marks,
    memoryMb: Math.round(memoryKb / 1024),
    platform: "electron",
    processes: app.getAppMetrics().length,
  }) + NEWLINE);
  if (smoke) { app.quit(); return; }
  void window;
}

app.on("window-all-closed", () => { app.quit(); });
app.on("before-quit", () => { if (host !== null) host.kill(); });
