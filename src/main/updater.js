const { dialog } = require('electron');
const { autoUpdater } = require('electron-updater');

function setupAutoUpdater(getWindow, log) {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  let errorNotified = false;
  let downloadNotified = false;
  let installNotified = false;

  autoUpdater.on('update-available', async (info) => {
    // Check if the release has any files attached
    if (!info.files || info.files.length === 0) {
      log('Update available but no installer found. Please download manually from GitHub.');
      return;
    }

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
      try {
        autoUpdater.downloadUpdate();
      } catch (error) {
        log('Failed to download update. Please download manually from GitHub.');
      }
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

  autoUpdater.on('error', (error) => {
    if (errorNotified) return;
    errorNotified = true;
    
    const errorMsg = error?.message || '';
    
    // Check for common update errors
    if (errorMsg.includes('No published versions') || 
        errorMsg.includes('Cannot find') || 
        errorMsg.includes('404')) {
      log('Update check failed: No release files found. Skipping auto-update.');
    } else {
      log('Auto updater failed. Please visit the repo and download the latest release.');
    }
  });
}

function checkForUpdates() {
  try {
    autoUpdater.checkForUpdates();
  } catch (error) {
    // Silent fail - don't crash the app if update check fails
  }
}

module.exports = {
  setupAutoUpdater,
  checkForUpdates
};
