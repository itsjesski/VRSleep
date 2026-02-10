const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sleepchat", {
  getWhitelist: () => ipcRenderer.invoke("whitelist:get"),
  setWhitelist: (list) => ipcRenderer.invoke("whitelist:set", list),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (settings) => ipcRenderer.invoke("settings:set", settings),
  startSleep: () => ipcRenderer.invoke("sleep:start"),
  stopSleep: () => ipcRenderer.invoke("sleep:stop"),
  getStatus: () => ipcRenderer.invoke("sleep:status"),
  getAuthStatus: () => ipcRenderer.invoke("auth:status"),
  getCurrentUser: () => ipcRenderer.invoke("auth:user"),
  login: (username, password) =>
    ipcRenderer.invoke("auth:login", { username, password }),
  verifyTwoFactor: (type, code) =>
    ipcRenderer.invoke("auth:verify", { type, code }),
  logout: () => ipcRenderer.invoke("auth:logout"),
  downloadUpdate: () => ipcRenderer.invoke("update:download"),
  getFriends: () => ipcRenderer.invoke("friends:get"),
  getCachedMessageSlots: () => ipcRenderer.invoke("messages:get-cached"),
  getMessageSlot: (type, slot) =>
    ipcRenderer.invoke("messages:get-slot", { type, slot }),
  getMessageSlots: (type) => ipcRenderer.invoke("messages:get-all", type),
  updateMessageSlot: (type, slot, message) =>
    ipcRenderer.invoke("messages:update-slot", { type, slot, message }),
  getCooldowns: () => ipcRenderer.invoke("messages:get-cooldowns"),
  setCooldown: (type, slot, unlockTimestamp) =>
    ipcRenderer.invoke("messages:set-cooldown", {
      type,
      slot,
      unlockTimestamp,
    }),
  onLog: (handler) => {
    ipcRenderer.removeAllListeners("log");
    ipcRenderer.on("log", (_event, message) => handler(message));
  },
  onUpdateAvailable: (handler) => {
    ipcRenderer.removeAllListeners("update-available");
    ipcRenderer.on("update-available", () => handler());
  },
});
