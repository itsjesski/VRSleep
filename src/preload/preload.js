const { contextBridge, ipcRenderer } = require("electron");

/**
 * Preload Script.
 * Securely bridges the renderer process (UI) with the main process.
 * Only explicit, safe functions are exposed via contextBridge to ensure
 * the renderer cannot access Node.js or Electron internals directly.
 */

/**
 * Security: Input validation helpers
 */
function validateArray(value, name = "value") {
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array`);
  }
  return true;
}

function validateString(value, name = "value") {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
  return true;
}

function validateObject(value, name = "value") {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${name} must be a plain object`);
  }
  return true;
}

function validateNumber(value, name = "value", min = -Infinity, max = Infinity) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
  if (value < min || value > max) {
    throw new RangeError(`${name} must be between ${min} and ${max}`);
  }
  return true;
}

contextBridge.exposeInMainWorld("sleepchat", {
  // Whitelist Management
  getWhitelist: () => ipcRenderer.invoke("whitelist:get"),
  setWhitelist: (list) => {
    validateArray(list, "whitelist");
    // Security: Ensure all entries are strings
    if (!list.every(item => typeof item === "string")) {
      throw new TypeError("All whitelist entries must be strings");
    }
    return ipcRenderer.invoke("whitelist:set", list);
  },

  // Application Settings
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (settings) => {
    validateObject(settings, "settings");
    return ipcRenderer.invoke("settings:set", settings);
  },

  // Sleep Mode Engine Controls
  startSleep: () => ipcRenderer.invoke("sleep:start"),
  stopSleep: () => ipcRenderer.invoke("sleep:stop"),
  getStatus: () => ipcRenderer.invoke("sleep:status"),

  // Authentication Flow
  getAuthStatus: () => ipcRenderer.invoke("auth:status"),
  getCurrentUser: () => ipcRenderer.invoke("auth:user"),
  login: (username, password) => {
    validateString(username, "username");
    validateString(password, "password");
    return ipcRenderer.invoke("auth:login", { username, password });
  },
  verifyTwoFactor: (type, code) => {
    validateString(type, "2FA type");
    validateString(code, "2FA code");
    return ipcRenderer.invoke("auth:verify", { type, code });
  },
  logout: () => ipcRenderer.invoke("auth:logout"),

  // VRChat Message Slots (Customization)
  getCachedMessageSlots: () => ipcRenderer.invoke("messages:get-cached"),
  getMessageSlot: (type, slot) => {
    validateString(type, "message type");
    validateNumber(slot, "slot", 0, 11);
    return ipcRenderer.invoke("messages:get-slot", { type, slot });
  },
  getMessageSlots: (type) => {
    validateString(type, "message type");
    return ipcRenderer.invoke("messages:get-all", type);
  },
  updateMessageSlot: (type, slot, message) => {
    validateString(type, "message type");
    validateNumber(slot, "slot", 0, 11);
    validateString(message, "message");
    return ipcRenderer.invoke("messages:update-slot", { type, slot, message });
  },

  // Cooldown Tracking
  getCooldowns: () => ipcRenderer.invoke("messages:get-cooldowns"),
  setCooldown: (type, slot, unlockTimestamp) => {
    validateString(type, "cooldown type");
    validateNumber(slot, "slot", 0, 11);
    validateNumber(unlockTimestamp, "unlock timestamp", 0);
    return ipcRenderer.invoke("messages:set-cooldown", {
      type,
      slot,
      unlockTimestamp,
    });
  },

  // Utilities & External Data
  getFriends: () => ipcRenderer.invoke("friends:get"),
  downloadUpdate: () => ipcRenderer.invoke("update:download"),

  // Log Management
  openLog: () => ipcRenderer.invoke("log:open"),
  clearLog: () => ipcRenderer.invoke("log:clear"),
  getLogInfo: () => ipcRenderer.invoke("log:info"),

  /**
   * Event Listeners: Inbound communication from the main process.
   */
  onLog: (handler) => {
    ipcRenderer.removeAllListeners("log");
    ipcRenderer.on("log", (_event, message) => handler(message));
  },
  onUpdateAvailable: (handler) => {
    ipcRenderer.removeAllListeners("update-available");
    ipcRenderer.on("update-available", () => handler());
  },
});
