const { app, BrowserWindow } = require("electron");
const config = require("../config");

/**
 * Main Entry Point for VRSleep.
 * Orchestrates service initialization, IPC registration, and application lifecycle.
 */

try {
  // Hot reloading for development environments
  require("electron-reloader")(module);
} catch (_) {}

// Local Stores
const { getWhitelist, setWhitelist } = require("../stores/whitelist-store");
const { getSettings, setSettings } = require("../stores/settings-store");

// VRChat API Integration
const {
  fetchInvites,
  sendInvite,
  deleteNotification,
  getFriends,
  getCurrentUser,
  updateStatus,
  getMessageSlots,
} = require("../api/vrcapi");

const {
  login,
  verifyTwoFactor,
  logout,
  getAuthStatus,
  isReadyForApi,
} = require("../api/vrcauth");

// Internal Modules
const { applyLowRamSettings } = require("./low-ram");
const updater = require("./updater");
const { createMainWindow } = require("./window");
const { createSleepMode } = require("./sleep-mode");
const { registerIpcHandlers } = require("./ipc");
const { logInfo } = require("../utils/logger");

// State Management
let mainWindow;
let updaterInstance = null;
let sleepModeInstance = null;
let isQuitting = false;

// Polling Configuration
const DEFAULT_POLL_MS = config.api.defaultPollMs;
const MIN_POLL_MS = config.api.minPollMs;

/**
 * Sends a log message to the renderer process for display in the Activity Log.
 * Also writes to the log file for persistent debugging.
 * @param {string} message - The log message to display
 */
function log(message) {
  // Write to file log
  logInfo("Activity", message);
  
  // Send to UI
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("log", message);
  }
}

/**
 * Notifies the renderer that settings have changed globally.
 * @param {Object} settings - The updated settings object
 */
function notifySettingsChanged(settings) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("settings-changed", settings);
  }
}

// Optimization: Apply Electron-level performance tweaks before window creation
applyLowRamSettings();

/**
 * Main Application Lifecycle
 */
app.whenReady().then(() => {
  // Required for Windows Toast Notifications and taskbar grouping
  app.setAppUserModelId(config.app.appUserModelId);

  // 1. Initialize UI
  mainWindow = createMainWindow(() => updater.checkForUpdates());

  // 2. Initialize Updater
  updaterInstance = updater.setupAutoUpdater(() => mainWindow, log);
  updater.checkForUpdates();

  // 3. Initialize Sleep Mode Engine
  // Orchestrates the core logic of checking invites and responding.
  sleepModeInstance = createSleepMode({
    getWhitelist,
    fetchInvites,
    sendInvite,
    deleteNotification,
    isReadyForApi,
    getCurrentUser,
    updateStatus,
    getMessageSlots,
    getSettings,
    setSettings: (settings) => {
      const next = setSettings(settings);
      notifySettingsChanged(next);
      return next;
    },
    log,
    pollIntervalMs: process.env.SLEEPCHAT_POLL_MS || DEFAULT_POLL_MS,
    minPollMs: MIN_POLL_MS,
  });

  // 4. Register IPC Handlers
  // Bridges the frontend UI with the backend services.
  registerIpcHandlers({
    getWhitelist,
    setWhitelist,
    getSettings,
    setSettings: (settings) => {
      const next = setSettings(settings);
      // Immediately refresh engine state when settings change via UI
      if (sleepModeInstance) {
        sleepModeInstance.refreshStatus();
      }
      notifySettingsChanged(next);
      return next;
    },
    sleepMode: sleepModeInstance,
    auth: {
      login,
      verify: verifyTwoFactor,
      logout,
      getStatus: getAuthStatus,
    },
    updater: updaterInstance,
    getFriends,
    getCurrentUser,
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow(() => updater.checkForUpdates());
    }
  });
});

/**
 * Graceful Shutdown Handling
 * Ensures that if Sleep Mode is active, we properly stop it (and restore VRC status)
 * before the application process exits.
 */
app.on("before-quit", async (event) => {
  if (isQuitting) return;

  if (sleepModeInstance && sleepModeInstance.status().sleepMode) {
    event.preventDefault();
    isQuitting = true;
    try {
      await sleepModeInstance.stop();
    } catch (error) {
      // Fail silently during shutdown to avoid hanging the process
    }
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
