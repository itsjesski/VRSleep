const { dialog, BrowserWindow, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");

/**
 * Updater Module.
 * Manages the application update lifecycle, including checking for new versions,
 * downloading installers, and showing progress to the user.
 */

function setupAutoUpdater(getWindow, log) {
  // Configuration: Disable automatic downloading to give users control over their bandwidth.
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  let errorNotified = false;
  let downloadNotified = false;
  let installNotified = false;
  let updateWindow = null;
  let updateInfo = null;

  /**
   * Creates a dedicated window to display download progress and installation options.
   * We use a basic BrowserWindow with inline HTML to keep dependencies minimal.
   */
  function createUpdateWindow() {
    updateWindow = new BrowserWindow({
      width: 400,
      height: 220,
      autoHideMenuBar: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      backgroundColor: "#0f1115",
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    updateWindow.on("closed", () => {
      updateWindow = null;
    });

    return updateWindow;
  }

  // Event: Update Found on Server
  autoUpdater.on("update-available", async (info) => {
    // Security & Validation: Ensure the release has valid installer files
    if (!info.files || info.files.length === 0) {
      log(
        "Update available but no installer found. Please download manually from GitHub.",
      );
      return;
    }

    // Validate that at least one file is a Windows installer
    const hasValidInstaller = info.files.some((file) => {
      const url = file.url || "";
      const name = file.name || "";
      return (
        url.toLowerCase().endsWith(".exe") ||
        url.toLowerCase().endsWith(".msi") ||
        name.toLowerCase().endsWith(".exe") ||
        name.toLowerCase().endsWith(".msi")
      );
    });

    if (!hasValidInstaller) {
      log(
        "Update available but no Windows installer found. Please download manually from GitHub.",
      );
      return;
    }

    updateInfo = info;
    log('Update available. Click the "Update Available" button to begin.');

    // Notify the main UI to show the update button
    const win = getWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send("update-available");
    }
  });

  /**
   * Initiates the download process and opens the progress window.
   */
  function startDownload() {
    if (!updateInfo) return;

    if (!downloadNotified) {
      downloadNotified = true;
      log("Downloading update...");
    }

    // Load the progress UI via a data URL to avoid needing a separate file.
    const win = createUpdateWindow();
    win.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(`
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              :root { color-scheme: dark; }
              body {
                margin: 0; padding: 20px;
                font-family: "Segoe UI", system-ui, sans-serif;
                display: flex; flex-direction: column;
                align-items: center; justify-content: center;
                height: 100vh; background: #0f1115; color: #e3e5e8;
              }
              h2 { margin: 0 0 20px 0; font-size: 18px; font-weight: 600; }
              .progress-container {
                width: 100%; max-width: 300px;
                background: #14171a; border: 1px solid #262a2e;
                border-radius: 8px; overflow: hidden;
                height: 32px; margin-bottom: 10px;
              }
              .progress-bar {
                height: 100%; background: #2f7d5e; width: 0%;
                transition: width 0.3s ease; display: flex;
                align-items: center; justify-content: center;
                font-weight: 500; font-size: 12px; color: #f5f7f9;
              }
              .status { font-size: 12px; color: #a2a8b0; }
              button {
                margin-top: 20px; padding: 8px 24px;
                background: #2f7d5e; color: #f5f7f9;
                border: none; border-radius: 8px;
                font-size: 14px; cursor: pointer; display: none;
              }
              button:hover { background: #347d63; }
            </style>
          </head>
          <body>
            <h2 id="title">Downloading Update</h2>
            <div class="progress-container">
              <div class="progress-bar" id="progress">0%</div>
            </div>
            <div class="status" id="status">Preparing download...</div>
            <button id="installBtn">Install and Restart</button>
            <script>
              const { ipcRenderer } = require('electron');
              document.getElementById('installBtn').onclick = () => {
                ipcRenderer.send('install-update');
              };
            </script>
          </body>
        </html>
      `)}`,
    );

    try {
      autoUpdater.downloadUpdate();
    } catch (error) {
      log("Failed to download update. Please download manually from GitHub.");
      if (updateWindow) updateWindow.close();
    }
  }

  // Event: Progress Tracking
  autoUpdater.on("download-progress", (progressObj) => {
    const percent = Math.round(progressObj.percent);
    log(`Downloading update: ${percent}%`);

    if (updateWindow && !updateWindow.isDestroyed()) {
      updateWindow.webContents.executeJavaScript(`
        document.getElementById('progress').style.width = '${percent}%';
        document.getElementById('progress').textContent = '${percent}%';
        document.getElementById('status').textContent = 'Downloading... ${percent}%';
      `);
    }
  });

  autoUpdater.on("update-not-available", () => {
    log("You are on the latest version of VRSleep.");
  });

  // Event: Download Complete
  autoUpdater.on("update-downloaded", async () => {
    if (!installNotified) {
      installNotified = true;
      log("Update downloaded successfully!");
    }

    if (updateWindow && !updateWindow.isDestroyed()) {
      updateWindow.webContents.executeJavaScript(`
        document.getElementById('progress').style.width = '100%';
        document.getElementById('progress').textContent = '100%';
        document.getElementById('status').textContent = 'Download complete!';
        document.getElementById('title').textContent = 'Update Ready';
        document.getElementById('installBtn').style.display = 'block';
      `);

      // One-time listener for the install button in the progress window
      ipcMain.once("install-update", () => {
        if (updateWindow) updateWindow.close();
        autoUpdater.quitAndInstall();
      });
    } else {
      // Fallback: If the progress window was closed, show a standard system dialog
      const result = await dialog.showMessageBox(getWindow(), {
        type: "info",
        buttons: ["Install and restart", "Later"],
        defaultId: 0,
        cancelId: 1,
        title: "Update ready",
        message: "Update downloaded. Install and restart now?",
      });

      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    }
  });

  // Event: Error Handling
  autoUpdater.on("error", (error) => {
    if (errorNotified) return;
    errorNotified = true;

    const errorMsg = error?.message || "";

    // Specific check for missing GitHub releases or draft status
    if (
      errorMsg.includes("No published versions") ||
      errorMsg.includes("Cannot find") ||
      errorMsg.includes("404")
    ) {
      log("Update check failed: No release files found. Skipping auto-update.");
    } else {
      log(
        "Auto updater failed. Please visit the repo and download the latest release.",
      );
    }
  });

  return {
    startDownload,
  };
}

/**
 * Triggers a manual check for updates.
 */
function checkForUpdates() {
  try {
    autoUpdater.checkForUpdates();
  } catch (error) {
    // Fail silently: we don't want update-check issues to crash the application.
  }
}

module.exports = {
  setupAutoUpdater,
  checkForUpdates,
};
