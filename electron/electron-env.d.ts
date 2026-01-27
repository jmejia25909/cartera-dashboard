// electron/preload.ts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("carteraApi", {
  ping: async () => "OK",
  getDbPath: async () => ipcRenderer.invoke("db:getPath"),
});