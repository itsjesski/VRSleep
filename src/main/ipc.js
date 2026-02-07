const { ipcMain } = require('electron');

function registerIpcHandlers({
  getWhitelist,
  setWhitelist,
  sleepMode,
  auth,
  updater
}) {
  ipcMain.handle('whitelist:get', () => getWhitelist());
  ipcMain.handle('whitelist:set', (_event, list) => setWhitelist(list));

  ipcMain.handle('sleep:start', () => sleepMode.start());
  ipcMain.handle('sleep:stop', () => sleepMode.stop());
  ipcMain.handle('sleep:status', () => sleepMode.status());

  ipcMain.handle('auth:status', () => auth.getStatus());
  ipcMain.handle('auth:login', async (_event, payload) => {
    const username = String(payload?.username || '').trim();
    const password = String(payload?.password || '');
    if (!username || !password) {
      return { ok: false, error: 'Username and password required.' };
    }

    try {
      const result = await auth.login({ username, password });
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
      const user = await auth.verify(type, code);
      return { ok: true, user };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('auth:logout', async () => {
    await auth.logout();
    return { ok: true };
  });

  ipcMain.handle('update:download', async () => {
    if (updater) {
      updater.startDownload();
    }
    return { ok: true };
  });
}

module.exports = {
  registerIpcHandlers
};
