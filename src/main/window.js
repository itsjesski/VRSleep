const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");

function createMainWindow(onCheckForUpdates) {
  const mainWindow = new BrowserWindow({
    width: 500,
    height: 670,
    show: false,
    icon: path.join(__dirname, "..", "..", "images", "icon.ico"),
    backgroundColor: "#0f1115",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !require("electron").app.isPackaged,
      spellcheck: false,
      backgroundThrottling: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  mainWindow.setTitle(`VRSleep - v${app.getVersion()}`);

  const menu = Menu.buildFromTemplate([
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
  ]);
  Menu.setApplicationMenu(null);

  return mainWindow;
}

module.exports = {
  createMainWindow,
};
