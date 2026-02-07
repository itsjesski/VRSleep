const { dialog } = require('electron');
const { autoUpdater } = require('electron-updater');

function setupAutoUpdater(getWindow, log) {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  let errorNotified = false;
  let downloadNotified = false;
  let installNotified = false;

  autoUpdater.on('update-available', async () => {
    const result = await dialog.showMessageBox(getWindow(), {
      type: 'info',
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update available',
      message: 'A new version is available. Download now?'
    });

    if (result.response === 0) {
      if (!downloadNotified) {
        downloadNotified = true;
        log('Downloading the latest release.');
      }
      autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on('update-not-available', () => {
    log('You are on the latest version of VRSleep.');
  });

  autoUpdater.on('update-downloaded', async () => {
    if (!installNotified) {
      installNotified = true;
      log('Installing the latest release.');
    }
    const result = await dialog.showMessageBox(getWindow(), {
      type: 'info',
      buttons: ['Install and restart', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update ready',
      message: 'Update downloaded. Install and restart now?'
    });

    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.on('error', () => {
    if (errorNotified) return;
    errorNotified = true;
    log('Auto updater failed. Please visit the repo and download the latest release.');
  });
}

function checkForUpdates() {
  autoUpdater.checkForUpdates();
}

module.exports = {
  setupAutoUpdater,
  checkForUpdates
};
