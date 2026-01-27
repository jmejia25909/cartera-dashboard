const { contextBridge, ipcRenderer } = require("electron");

const api = {
  ping: async () => "pong",
  onMainMessage: (callback) => {
    ipcRenderer.on("main-process-message", (_event, value) => callback(value));
  },
  // Stats and filters
  statsObtener: async () => ipcRenderer.invoke("statsObtener"),
  filtrosListar: async () => ipcRenderer.invoke("filtrosListar"),
  topClientes: async (limit) => ipcRenderer.invoke("topClientes", limit),
  documentosListar: async (args) => ipcRenderer.invoke("documentosListar", args),
  
  // Import and database
  importarContifico: async () => ipcRenderer.invoke("importarContifico"),
  limpiarBaseDatos: async () => ipcRenderer.invoke("limpiarBaseDatos"),
  getDbPath: async () => ipcRenderer.invoke("getDbPath"),
  
  // Documents
  actualizarDiasCredito: async (id, dias) => ipcRenderer.invoke("actualizarDiasCredito", { id, dias }),
  generarPDF: async (filename) => ipcRenderer.invoke("generarPDF", filename),
  
  // Company
  empresaObtener: async () => ipcRenderer.invoke("empresaObtener"),
  empresaGuardar: async (data) => ipcRenderer.invoke("empresaGuardar", data),
  
  // Clients
  clientesAnalisis: async () => ipcRenderer.invoke("clientesAnalisis"),
  getNetworkInfo: async () => ipcRenderer.invoke("getNetworkInfo"),
  clienteObtenerInfo: async (codigo) => ipcRenderer.invoke("clienteObtenerInfo", codigo),
  clienteGuardarInfo: async (data) => ipcRenderer.invoke("clienteGuardarInfo", data),
  
  // Management
  gestionGuardar: async (data) => ipcRenderer.invoke("gestionGuardar", data),
  gestionesListar: async (cliente) => ipcRenderer.invoke("gestionesListar", cliente),
  gestionCumplir: async (id) => ipcRenderer.invoke("gestionCumplir", id),
  gestionEliminar: async (id) => ipcRenderer.invoke("gestionEliminar", id),
  gestionesReporte: async (args) => ipcRenderer.invoke("gestionesReporte", args),
  
  // Campaigns
  campanasListar: async () => ipcRenderer.invoke("campanasListar"),
  campanasGuardar: async (data) => ipcRenderer.invoke("campanasGuardar", data),
  
  // Analysis
  motivosImpago: async () => ipcRenderer.invoke("motivosImpago"),
  productividadGestor: async () => ipcRenderer.invoke("productividadGestor"),
  segmentacionRiesgo: async () => ipcRenderer.invoke("segmentacionRiesgo"),
  
  // Phase 3
  alertasIncumplimiento: async () => ipcRenderer.invoke("alertasIncumplimiento"),
  pronosticoFlujoCaja: async () => ipcRenderer.invoke("pronosticoFlujoCaja"),
  tendenciasHistoricas: async () => ipcRenderer.invoke("tendenciasHistoricas"),
  
  // Phase 4
  disputasListar: async () => ipcRenderer.invoke("disputasListar"),
  disputaCrear: async (data) => ipcRenderer.invoke("disputaCrear", data),
  cuentasAplicarListar: async () => ipcRenderer.invoke("cuentasAplicarListar"),
  cuentaAplicarCrear: async (data) => ipcRenderer.invoke("cuentaAplicarCrear", data),
  cuentaAplicarActualizar: async (data) => ipcRenderer.invoke("cuentaAplicarActualizar", data),
};

contextBridge.exposeInMainWorld("carteraApi", api);
contextBridge.exposeInMainWorld("api", api);
