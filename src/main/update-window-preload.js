const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("updateWindowApi", {
  installUpdate: () => ipcRenderer.send("install-update"),
  onProgress: (handler) => {
    ipcRenderer.removeAllListeners("update-download-progress");
    ipcRenderer.on("update-download-progress", (_event, payload) => {
      handler(payload);
    });
  },
  onReady: (handler) => {
    ipcRenderer.removeAllListeners("update-download-ready");
    ipcRenderer.on("update-download-ready", () => {
      handler();
    });
  },
});
