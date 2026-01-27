import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("carteraApi", {
  ping: () => ipcRenderer.invoke("ping"),
  getDbPath: () => ipcRenderer.invoke("getDbPath"),
  statsObtener: () => ipcRenderer.invoke("statsObtener"),
  filtrosListar: () => ipcRenderer.invoke("filtrosListar"),
  topClientes: (limit?: number) => ipcRenderer.invoke("topClientes", limit),
  documentosListar: (args: any) => ipcRenderer.invoke("documentosListar", args),
  importarContifico: () => ipcRenderer.invoke("importarContifico"),
  limpiarBaseDatos: () => ipcRenderer.invoke("limpiarBaseDatos"),
  actualizarDiasCredito: (id: number, dias: number) => ipcRenderer.invoke("actualizarDiasCredito", { id, dias }),
  generarPDF: (filename: string) => ipcRenderer.invoke("generarPDF", filename),
  empresaObtener: () => ipcRenderer.invoke("empresaObtener"),
  empresaGuardar: (data: any) => ipcRenderer.invoke("empresaGuardar", data),
  clientesAnalisis: () => ipcRenderer.invoke("clientesAnalisis"),
  getNetworkInfo: () => ipcRenderer.invoke("getNetworkInfo"),
  clienteObtenerInfo: (codigo: string) => ipcRenderer.invoke("clienteObtenerInfo", codigo),
  clienteGuardarInfo: (data: any) => ipcRenderer.invoke("clienteGuardarInfo", data),
  gestionGuardar: (data: any) => ipcRenderer.invoke("gestionGuardar", data),
  gestionesListar: (cliente: string) => ipcRenderer.invoke("gestionesListar", cliente),
  gestionCumplir: (id: number) => ipcRenderer.invoke("gestionCumplir", id),
  gestionesReporte: (args: any) => ipcRenderer.invoke("gestionesReporte", args),
});