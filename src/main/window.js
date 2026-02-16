const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");

/**
 * Window Management Module.
 * Handles the creation, configuration, and security settings of the main application window.
 */

/**
 * Creates and configures the main application window.
 * @param {Function} onCheckForUpdates - Callback function to trigger a manual update check.
 * @returns {Electron.BrowserWindow} The created window instance.
 */
function createMainWindow(onCheckForUpdates) {
  const mainWindow = new BrowserWindow({
    width: 500,
    height: 670,
    show: false, // Hidden initially to prevent visual artifacts during the initial load.
    icon: path.join(__dirname, "..", "images", "icon.ico"),
    backgroundColor: "#0f1115",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true, // Enables Chromium's internal sandbox for better security.
      devTools: !app.isPackaged,
      spellcheck: false,
      backgroundThrottling: true, // Allows Chromium to reduce resource usage when the app is minimized.
    },
  });

  // Smooth appearance: display the window only when the content is ready to be shown.
  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  mainWindow.setTitle(`VRSleep - v${app.getVersion()}`);

  /**
   * Build a custom menu template for utility and developer tasks.
   * Note: The menu is defined here but hidden by default to provide a clean utility-app look.
   */
  const menuTemplate = [
    {
      label: "View",
      submenu: [
        {
          label: "Toggle DevTools",
          accelerator: "F12",
          click: () => {
            mainWindow.webContents.toggleDevTools();
          },
        },
        { type: "separator" },
        { role: "reload" },
        { role: "forceReload" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Check for Updates",
          click: () => onCheckForUpdates(),
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
      ],
    },
  ];

  // Set to null to remove the top menu bar for a more polished "Application" feel.
  // The shortcuts (like F12) can still be handled via listeners if required.
  Menu.setApplicationMenu(null);

  return mainWindow;
}

module.exports = {
  createMainWindow,
};
