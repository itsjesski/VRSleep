const { ipcMain } = require("electron");
const { shell } = require("electron");
const vrcapi = require("../api/vrcapi");
const messageSlotsStore = require("../stores/message-slots-store");
const { logError, getLogFilePath, clearLog, getLogFileSize } = require("../utils/logger");

/**
 * IPC Communication Module.
 * Registers all IPC handlers for communication between the renderer and main process.
 */

/**
 * Settings cache to reduce redundant disk reads.
 * Cache expires after 1 second to balance performance with data freshness.
 */
let settingsCache = null;
let settingsCacheTimestamp = 0;
const SETTINGS_CACHE_TTL = 1000;

/**
 * Gets settings with caching to improve performance.
 * @param {Function} getSettings - The settings getter function
 * @returns {Object} The current settings
 */
function getCachedSettings(getSettings) {
  const now = Date.now();
  if (!settingsCache || now - settingsCacheTimestamp > SETTINGS_CACHE_TTL) {
    settingsCache = getSettings();
    settingsCacheTimestamp = now;
  }
  return settingsCache;
}

/**
 * Invalidates the settings cache.
 */
function invalidateSettingsCache() {
  settingsCache = null;
  settingsCacheTimestamp = 0;
}

/**
 * Registers all IPC handlers for communication between the renderer and main process.
 * @param {Object} deps - Dependency object containing all required functions
 */
function registerIpcHandlers({
  getWhitelist,
  setWhitelist,
  getSettings,
  setSettings,
  sleepMode,
  auth,
  updater,
  getFriends,
  getCurrentUser,
}) {
  // Whitelist & Settings
  ipcMain.handle("whitelist:get", () => getWhitelist());
  ipcMain.handle("whitelist:set", (_event, list) => setWhitelist(list));
  ipcMain.handle("settings:get", () => getCachedSettings(getSettings));
  ipcMain.handle("settings:set", (_event, settings) => {
    invalidateSettingsCache();
    return setSettings(settings);
  });

  // Sleep Mode Control
  ipcMain.handle("sleep:start", () => sleepMode.start());
  ipcMain.handle("sleep:stop", () => sleepMode.stop());
  ipcMain.handle("sleep:status", () => sleepMode.status());

  // Authentication
  ipcMain.handle("auth:status", () => auth.getStatus());
  ipcMain.handle("auth:user", async () => {
    try {
      const user = await getCurrentUser();
      return { ok: true, user };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle("auth:login", async (_event, payload) => {
    const username = String(payload?.username || "").trim();
    const password = String(payload?.password || "");
    if (!username || !password) {
      return { ok: false, error: "Username and password required." };
    }
    try {
      const result = await auth.login({ username, password });
      return { ok: true, result };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle("auth:verify", async (_event, payload) => {
    const type = String(payload?.type || "").trim();
    const code = String(payload?.code || "").trim();
    if (!type || !code) {
      return { ok: false, error: "Verification code required." };
    }
    try {
      const user = await auth.verify(type, code);
      return { ok: true, user };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle("auth:logout", async () => {
    await auth.logout();
    return { ok: true };
  });

  // Updates & Friends
  ipcMain.handle("update:download", async () => {
    if (updater) updater.startDownload();
    return { ok: true };
  });

  ipcMain.handle("friends:get", async () => {
    try {
      const friends = await getFriends();
      return { ok: true, friends };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  // Log Management
  ipcMain.handle("log:open", async () => {
    try {
      const logPath = getLogFilePath();
      const fs = require("fs");
      
      // Create the file with an initial message if it doesn't exist
      if (!fs.existsSync(logPath)) {
        const initialMessage = `[${new Date().toISOString()}] [INFO] [System] Log file created\n`;
        fs.writeFileSync(logPath, initialMessage, "utf8");
      }
      
      // Opens the log file with the default text editor
      const result = await shell.openPath(logPath);
      
      // Check if the file was opened successfully
      if (result) {
        // Non-empty string means there was an error
        throw new Error(result);
      }
      
      return { ok: true };
    } catch (error) {
      logError("IPC", "Failed to open log file", error);
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle("log:clear", async () => {
    try {
      clearLog();
      return { ok: true };
    } catch (error) {
      logError("IPC", "Failed to clear log file", error);
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle("log:info", async () => {
    try {
      const size = getLogFileSize();
      const path = getLogFilePath();
      return { ok: true, size, path };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  // Message Slots Management
  ipcMain.handle("messages:get-cached", () => {
    return messageSlotsStore.getCachedSlots();
  });

  /**
   * Smart Sync Logic: Shared helper to update cooldowns only when significant drift is detected.
   * This prevents the UI countdown from jumping back to the top of the minute on every sync.
   */
  const syncCooldown = (type, slot, apiMins) => {
    if (typeof apiMins !== "number") return;

    const currentCooldowns = messageSlotsStore.getSlotCooldowns();
    const currentUnlockTime = currentCooldowns[type]?.[slot] || 0;
    const currentRemainingMins =
      currentUnlockTime > Date.now()
        ? Math.ceil((currentUnlockTime - Date.now()) / 60000)
        : 0;

    const isSignificantChange = Math.abs(currentRemainingMins - apiMins) > 1;
    const isNewCooldown = currentRemainingMins === 0 && apiMins > 0;

    if (
      isSignificantChange ||
      isNewCooldown ||
      (apiMins > 0 && currentUnlockTime === 0)
    ) {
      const unlockTime = apiMins > 0 ? Date.now() + apiMins * 60000 : 0;
      messageSlotsStore.updateSlotCooldown(type, slot, unlockTime);
    }
  };

  ipcMain.handle("messages:get-slot", async (_event, { type, slot }) => {
    console.log(`IPC: messages:get-slot type=${type}, slot=${slot}`);
    try {
      const authStatus = auth.getStatus();
      if (!authStatus.authenticated || !authStatus.userId) {
        throw new Error("Not authenticated");
      }

      const result = await vrcapi.getMessageSlot(authStatus.userId, type, slot);

      // Update local message cache
      const message =
        typeof result === "string" ? result : result?.message || "";
      messageSlotsStore.updateCachedSlot(type, slot, message);

      // Smart Sync cooldown
      syncCooldown(type, slot, result?.remainingCooldownMinutes);

      return { ok: true, slotData: result };
    } catch (error) {
      logError("IPC", "Error in messages:get-slot", error);
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle("messages:get-all", async (_event, type) => {
    console.log(`IPC: messages:get-all type=${type}`);
    try {
      const authStatus = auth.getStatus();
      if (!authStatus.authenticated || !authStatus.userId) {
        throw new Error("Not authenticated");
      }

      const result = await vrcapi.getMessageSlots(authStatus.userId, type);

      // Update cache
      const cache = messageSlotsStore.getCachedSlots();
      cache[type] = result.map((r) => r.message);
      messageSlotsStore.saveCachedSlots(cache);

      // Smart Sync all returned cooldowns
      result.forEach((r) =>
        syncCooldown(type, r.slot, r.remainingCooldownMinutes),
      );

      return { ok: true, messages: result };
    } catch (error) {
      logError("IPC", "Error in messages:get-all", error);
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle(
    "messages:update-slot",
    async (_event, { type, slot, message }) => {
      console.log(`IPC: messages:update-slot type=${type}, slot=${slot}`);
      try {
        const authStatus = auth.getStatus();
        if (!authStatus.authenticated || !authStatus.userId) {
          throw new Error("Not authenticated");
        }

        const result = await vrcapi.updateMessageSlot(
          authStatus.userId,
          type,
          slot,
          message,
        );

        // VRChat returns an array of slots (all 12, or normalized to array)
        if (Array.isArray(result)) {
          const cache = messageSlotsStore.getCachedSlots();
          cache[type] = result.map((s) => s.message);
          messageSlotsStore.saveCachedSlots(cache);

          result.forEach((s) =>
            syncCooldown(type, s.slot, s.remainingCooldownMinutes),
          );
        }

        return { ok: true, result };
      } catch (error) {
        logError("IPC", "Error in messages:update-slot", error);

        // If we get a 429, we KNOW the slot is locked.
        if (error.status === 429) {
          let mins = 60;
          // Try to extract "wait X more minutes" from the API message
          const match = error.message.match(/wait (\d+) more minutes/i);
          if (match) {
            mins = parseInt(match[1], 10) + 1;
          }
          messageSlotsStore.updateSlotCooldown(
            type,
            slot,
            Date.now() + mins * 60000,
          );
        }

        return { ok: false, error: error.message };
      }
    },
  );

  ipcMain.handle("messages:get-cooldowns", async () => {
    return messageSlotsStore.getSlotCooldowns();
  });

  ipcMain.handle(
    "messages:set-cooldown",
    async (_event, { type, slot, unlockTimestamp }) => {
      messageSlotsStore.updateSlotCooldown(type, slot, unlockTimestamp);
      return { ok: true };
    },
  );
}

module.exports = {
  registerIpcHandlers,
};
