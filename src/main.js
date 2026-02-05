const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { getWhitelist, setWhitelist } = require('./whitelist-store');
const { fetchInvites, sendInvite } = require('./vrcapi');
const { login, verifyTwoFactor, logout, getAuthStatus, isReadyForApi } = require('./vrcauth');

let mainWindow;
let sleepMode = false;
let pollTimer = null;
const handledInviteIds = new Set();

const DEFAULT_POLL_MS = 15000;
const MIN_POLL_MS = 10000;

function applyLowRamSettings() {
  const maxOldSpace = Number(process.env.SLEEPCHAT_MAX_OLD_SPACE_MB || 128);
  if (Number.isFinite(maxOldSpace) && maxOldSpace > 0) {
    app.commandLine.appendSwitch('js-flags', `--max-old-space-size=${maxOldSpace}`);
  }

  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu-compositing');
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
}

function log(message) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('log', message);
  }
}

function getPollInterval() {
  const raw = Number(process.env.SLEEPCHAT_POLL_MS || DEFAULT_POLL_MS);
  if (!Number.isFinite(raw)) return DEFAULT_POLL_MS;
  return Math.max(raw, MIN_POLL_MS);
}

function normalizeEntry(entry) {
  return String(entry || '').trim().toLowerCase();
}

async function checkInvites() {
  if (!sleepMode) return;
  if (!isReadyForApi()) {
    log('API not ready: login required.');
    return;
  }

  let invites;
  try {
    invites = await fetchInvites();
  } catch (error) {
    log(`Failed to fetch invites: ${error.message}`);
    return;
  }

  if (!Array.isArray(invites) || invites.length === 0) return;

  const whitelist = getWhitelist().map(normalizeEntry).filter(Boolean);
  for (const invite of invites) {
    if (!invite) continue;
    const inviteId = invite.id || invite.notificationId || invite._id;
    if (inviteId && handledInviteIds.has(inviteId)) continue;

    const senderId = normalizeEntry(invite.senderId || invite.senderUserId || invite.userId);
    const senderName = normalizeEntry(invite.senderDisplayName || invite.senderUsername || invite.displayName);

    const matches = whitelist.includes(senderId) || whitelist.includes(senderName);
    if (!matches) continue;

    try {
      await sendInvite(senderId);
      if (inviteId) handledInviteIds.add(inviteId);
      log(`Sent invite to ${invite.senderDisplayName || invite.senderUsername || senderId}.`);
    } catch (error) {
      log(`Failed to send invite: ${error.message}`);
    }
  }
}

function startPolling() {
  if (pollTimer) return;
  const interval = getPollInterval();
  pollTimer = setInterval(checkInvites, interval);
  checkInvites();
}

function stopPolling() {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 520,
    show: false,
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
      spellcheck: false,
      backgroundThrottling: true
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  const menu = Menu.buildFromTemplate([
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle DevTools',
          accelerator: 'F12',
          click: () => {
            mainWindow.webContents.toggleDevTools();
          }
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);
}

applyLowRamSettings();

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('whitelist:get', () => getWhitelist());
ipcMain.handle('whitelist:set', (_event, list) => setWhitelist(list));

ipcMain.handle('sleep:start', () => {
  sleepMode = true;
  startPolling();
  log('Sleep mode enabled.');
  return { sleepMode };
});

ipcMain.handle('sleep:stop', () => {
  sleepMode = false;
  stopPolling();
  log('Sleep mode disabled.');
  return { sleepMode };
});

ipcMain.handle('sleep:status', () => ({ sleepMode }));

ipcMain.handle('auth:status', () => getAuthStatus());
ipcMain.handle('auth:login', async (_event, payload) => {
  const username = String(payload?.username || '').trim();
  const password = String(payload?.password || '');
  if (!username || !password) {
    return { ok: false, error: 'Username and password required.' };
  }

  try {
    const result = await login({ username, password });
    return { ok: true, result };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('auth:verify', async (_event, payload) => {
  const type = String(payload?.type || '').trim();
  const code = String(payload?.code || '').trim();
  if (!type || !code) {
    return { ok: false, error: 'Verification code required.' };
  }

  try {
    const user = await verifyTwoFactor(type, code);
    return { ok: true, user };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('auth:logout', async () => {
  await logout();
  return { ok: true };
});
