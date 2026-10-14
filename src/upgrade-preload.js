/**
 * The bridge the upgrade page talks through. Context isolation stays on: the page is local, but a page with Node in
 * it is a page that can run anything, and this one only needs four verbs.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('galaxyUpgrade', {
  cli: () => ipcRenderer.invoke('upgrade:cli'),
  desktop: () => ipcRenderer.invoke('upgrade:desktop'),
  onLog: (handler) => ipcRenderer.on('upgrade:log', (_event, line) => handler(String(line))),
  plan: () => ipcRenderer.invoke('upgrade:plan'),
  versions: () => ipcRenderer.invoke('upgrade:versions'),
});
