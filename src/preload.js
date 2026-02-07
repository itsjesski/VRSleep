const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sleepchat', {
  getWhitelist: () => ipcRenderer.invoke('whitelist:get'),
  setWhitelist: (list) => ipcRenderer.invoke('whitelist:set', list),
  startSleep: () => ipcRenderer.invoke('sleep:start'),
  stopSleep: () => ipcRenderer.invoke('sleep:stop'),
  getStatus: () => ipcRenderer.invoke('sleep:status'),
  getAuthStatus: () => ipcRenderer.invoke('auth:status'),
  login: (username, password) => ipcRenderer.invoke('auth:login', { username, password }),
  verifyTwoFactor: (type, code) => ipcRenderer.invoke('auth:verify', { type, code }),
  logout: () => ipcRenderer.invoke('auth:logout'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  onLog: (handler) => {
    ipcRenderer.removeAllListeners('log');
    ipcRenderer.on('log', (_event, message) => handler(message));
  },
  onUpdateAvailable: (handler) => {
    ipcRenderer.removeAllListeners('update-available');
    ipcRenderer.on('update-available', () => handler());
  }
});
