const { ipcMain } = require("electron");

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
  ipcMain.handle("whitelist:get", () => getWhitelist());
  ipcMain.handle("whitelist:set", (_event, list) => setWhitelist(list));

  ipcMain.handle("settings:get", () => getSettings());
  ipcMain.handle("settings:set", (_event, settings) => setSettings(settings));

  ipcMain.handle("sleep:start", () => sleepMode.start());
  ipcMain.handle("sleep:stop", () => sleepMode.stop());
  ipcMain.handle("sleep:status", () => sleepMode.status());

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

  ipcMain.handle("update:download", async () => {
    if (updater) {
      updater.startDownload();
    }
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

  ipcMain.handle("messages:get-cached", () => {
    const { getCachedSlots } = require("../stores/message-slots-store");
    return getCachedSlots();
  });

  ipcMain.handle("messages:get-all", async (_event, type) => {
    try {
      const authStatus = auth.getStatus();
      if (!authStatus.authenticated || !authStatus.userId) {
        throw new Error("Not authenticated");
      }
      const { getMessageSlots } = require("../api/vrcapi");
      const {
        saveCachedSlots,
        getCachedSlots,
      } = require("../stores/message-slots-store");

      const result = await getMessageSlots(authStatus.userId, type);

      // Update cache
      const cache = getCachedSlots();
      cache[type] = result.map((r) => r.message);
      saveCachedSlots(cache);

      return { ok: true, messages: result };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle(
    "messages:update-slot",
    async (_event, { type, slot, message }) => {
      console.log(
        `IPC: messages:update-slot type=${type}, slot=${slot}, message="${message}"`,
      );
      try {
        const authStatus = auth.getStatus();
        if (!authStatus.authenticated || !authStatus.userId) {
          throw new Error("Not authenticated");
        }
        const { updateMessageSlot } = require("../api/vrcapi");
        const {
          updateCachedSlot,
          updateSlotCooldown,
        } = require("../stores/message-slots-store");

        console.log(`Calling VRC API to update slot...`);
        const result = await updateMessageSlot(
          authStatus.userId,
          type,
          slot,
          message,
        );
        console.log(`VRC API result:`, result);

        // Update cache
        updateCachedSlot(type, slot, message);

        // On success, VRChat locks the slot for 60 minutes
        const unlockTime = Date.now() + 60 * 60 * 1000;
        updateSlotCooldown(type, slot, unlockTime);

        return { ok: true, result };
      } catch (error) {
        console.error(`Error in messages:update-slot:`, error);
        return { ok: false, error: error.message };
      }
    },
  );

  ipcMain.handle("messages:get-cooldowns", async () => {
    const { getSlotCooldowns } = require("../stores/message-slots-store");
    return getSlotCooldowns();
  });

  ipcMain.handle(
    "messages:set-cooldown",
    async (_event, { type, slot, unlockTimestamp }) => {
      const { updateSlotCooldown } = require("../stores/message-slots-store");
      updateSlotCooldown(type, slot, unlockTimestamp);
      return { ok: true };
    },
  );
}

module.exports = {
  registerIpcHandlers,
};
