const { ipcMain } = require("electron");
const vrcapi = require("../api/vrcapi");
const messageSlotsStore = require("../stores/message-slots-store");

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
    return messageSlotsStore.getCachedSlots();
  });

  ipcMain.handle("messages:get-slot", async (_event, { type, slot }) => {
    console.log(`IPC: messages:get-slot type=${type}, slot=${slot}`);

    try {
      const authStatus = auth.getStatus();

      if (!authStatus.authenticated || !authStatus.userId) {
        throw new Error("Not authenticated");
      }

      const result = await vrcapi.getMessageSlot(authStatus.userId, type, slot);

      // Update cache

      const message =
        typeof result === "string" ? result : result?.message || "";

      messageSlotsStore.updateCachedSlot(type, slot, message);

      // Update cooldown if present - only if it differs significantly from current local tracking

      if (result && typeof result.remainingCooldownMinutes === "number") {
        const currentCooldowns = messageSlotsStore.getSlotCooldowns();

        const currentUnlockTime = currentCooldowns[type]
          ? currentCooldowns[type][slot]
          : 0;

        const currentRemainingMins =
          currentUnlockTime > Date.now()
            ? Math.ceil((currentUnlockTime - Date.now()) / 60000)
            : 0;

        // Only update if there's a significant change (more than 1 min difference)

        // or if we have no local record and API says there is one

        if (
          Math.abs(currentRemainingMins - result.remainingCooldownMinutes) >
            1 ||
          (currentRemainingMins === 0 && result.remainingCooldownMinutes > 0)
        ) {
          const unlockTime =
            result.remainingCooldownMinutes > 0
              ? Date.now() + result.remainingCooldownMinutes * 60 * 1000
              : 0;

          messageSlotsStore.updateSlotCooldown(type, slot, unlockTime);
        }
      }

      return { ok: true, slotData: result };
    } catch (error) {
      console.error(`Error in messages:get-slot:`, error);

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

      // Update cooldowns if the API returns them in the bulk request
      result.forEach((r) => {
        if (typeof r.remainingCooldownMinutes === "number") {
          const unlockTime =
            r.remainingCooldownMinutes > 0
              ? Date.now() + r.remainingCooldownMinutes * 60 * 1000
              : 0;
          messageSlotsStore.updateSlotCooldown(type, r.slot, unlockTime);
        }
      });

      return { ok: true, messages: result };
    } catch (error) {
      console.error(`Error in messages:get-all:`, error);
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

        const result = await vrcapi.updateMessageSlot(
          authStatus.userId,
          type,
          slot,
          message,
        );

        // result is an array of all 12 slots for this type
        if (Array.isArray(result)) {
          const cache = messageSlotsStore.getCachedSlots();
          const cooldowns = messageSlotsStore.getSlotCooldowns();
          cache[type] = result.map((s) => s.message);
          messageSlotsStore.saveCachedSlots(cache);

          result.forEach((s) => {
            if (typeof s.remainingCooldownMinutes === "number") {
              const currentUnlockTime = cooldowns[type]
                ? cooldowns[type][s.slot]
                : 0;
              const currentRemainingMins =
                currentUnlockTime > Date.now()
                  ? Math.ceil((currentUnlockTime - Date.now()) / 60000)
                  : 0;

              if (
                Math.abs(currentRemainingMins - s.remainingCooldownMinutes) >
                  1 ||
                (currentRemainingMins === 0 && s.remainingCooldownMinutes > 0)
              ) {
                const unlockTime =
                  s.remainingCooldownMinutes > 0
                    ? Date.now() + s.remainingCooldownMinutes * 60 * 1000
                    : 0;
                messageSlotsStore.updateSlotCooldown(type, s.slot, unlockTime);
              }
            }
          });
        }

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
