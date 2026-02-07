const { app, BrowserWindow } = require('electron');
const { getWhitelist, setWhitelist } = require('./whitelist-store');
const { fetchInvites, sendInvite, deleteNotification } = require('./vrcapi');
const { login, verifyTwoFactor, logout, getAuthStatus, isReadyForApi } = require('./vrcauth');
const { applyLowRamSettings } = require('./main/low-ram');
const updater = require('./main/updater');
const { createMainWindow } = require('./main/window');
const { createSleepMode } = require('./main/sleep-mode');
const { registerIpcHandlers } = require('./main/ipc');

let mainWindow;
let updaterInstance = null;

const DEFAULT_POLL_MS = 15000;
const MIN_POLL_MS = 10000;

function log(message) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('log', message);
  }
}

applyLowRamSettings();

app.whenReady().then(() => {
  app.setAppUserModelId('com.sleepchat.app');

  mainWindow = createMainWindow(() => updater.checkForUpdates());
  updaterInstance = updater.setupAutoUpdater(() => mainWindow, log);
  updater.checkForUpdates();

  const sleepMode = createSleepMode({
    getWhitelist,
    fetchInvites,
    sendInvite,
    deleteNotification,
    isReadyForApi,
    log,
    pollIntervalMs: process.env.SLEEPCHAT_POLL_MS || DEFAULT_POLL_MS,
    minPollMs: MIN_POLL_MS
  });

  registerIpcHandlers({
    getWhitelist,
    setWhitelist,
    sleepMode,
    auth: {
      login,
      verify: verifyTwoFactor,
      logout,
      getStatus: getAuthStatus
    },
    updater: updaterInstance
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow(() => updater.checkForUpdates());
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
