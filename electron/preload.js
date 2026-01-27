const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("carteraApi", {
  ping: async () => "pong",
  onMainMessage: (callback) => {
    ipcRenderer.on("main-process-message", (_event, value) => callback(value));
  },
});
