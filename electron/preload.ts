import { contextBridge, ipcRenderer } from "electron";

const apiMethods = {
  cambiarLogo: () => {
    console.log("🔄 Preload: Iniciando cambio de logo...");
    return ipcRenderer.invoke("cambiarLogo");
  },
  ping: () => ipcRenderer.invoke("ping"),
  getDbPath: () => ipcRenderer.invoke("getDbPath"),
  getDesktopToken: () => ipcRenderer.invoke("getDesktopToken"),
  hasWritePermissions: () => ipcRenderer.invoke("hasWritePermissions"),
  statsObtener: () => ipcRenderer.invoke("statsObtener"),
  dashboardExecutiveStats: (filters?: {
    year?: number;
    month?: number | null;
  }) =>
    ipcRenderer.invoke(
      "dashboardExecutiveStats",
      filters,
    ),

  managementReportsSummary: (filters: {
    year: number;
    month?: number | null;
  }) =>
    ipcRenderer.invoke(
      "managementReportsSummary",
      filters,
    ),
  managementReportDetail: (request: {
    type:
      | "COLLECTIONS_DETAIL"
      | "CRM_ACTIVITY"
      | "PORTFOLIO_AGING"
      | "CANCELLED_DOCUMENTS"
      | "CREDIT_NOTES";
    filters: {
      year: number;
      month?: number | null;
      customer?: string;
      seller?: string;
      movementClass?: "COBRO" | "CRUCE" | null;
      reconciliationStatus?: string | null;
    };
  }) =>
    ipcRenderer.invoke(
      "managementReportDetail",
      request,
    ),

  collectionReconciliationGet: (payload: { year: number; month: number }) => ipcRenderer.invoke("collectionReconciliationGet", payload),
  collectionReconciliationSave: (payload: { year: number; month: number; officialValue: number; observation?: string; user?: string }) => ipcRenderer.invoke("collectionReconciliationSave", payload),
  filtrosListar: () => ipcRenderer.invoke("filtrosListar"),
  topClientes: (limit?: number) => ipcRenderer.invoke("topClientes", limit),
  documentosListar: (args: unknown) => ipcRenderer.invoke("documentosListar", args),
  creditPoliciesList: () => ipcRenderer.invoke("creditPoliciesList"),
  creditPolicyPreview: (cliente: string) => ipcRenderer.invoke("creditPolicyPreview", cliente),
  creditPolicySave: (data: unknown) => ipcRenderer.invoke("creditPolicySave", data),
  previewCancelledDocuments: () =>
    ipcRenderer.invoke("previewCancelledDocuments"),
  confirmCancelledDocumentsImport: (filePath: string) =>
    ipcRenderer.invoke("confirmCancelledDocumentsImport", filePath),
  previewCreditNotes: () =>
    ipcRenderer.invoke("previewCreditNotes"),
  confirmCreditNotesImport: (filePath: string) =>
    ipcRenderer.invoke("confirmCreditNotesImport", filePath),
  previewCollectionMovements: () =>
    ipcRenderer.invoke("previewCollectionMovements"),
  confirmCollectionMovementsImport: (filePath: string) =>
    ipcRenderer.invoke("confirmCollectionMovementsImport", filePath),
  cancelledDocumentsList: () => ipcRenderer.invoke("cancelledDocumentsList"),
  cancelledDocumentsReversalSummary: () =>
    ipcRenderer.invoke("cancelledDocumentsReversalSummary"),
  importarContifico: () => ipcRenderer.invoke("importarContifico"),
  importHistoryList: (args?: {
    tipo?: "CARTERA" | "ANULADOS" | "NOTAS_CREDITO" | "COBROS_MOVIMIENTOS";
    limit?: number;
  }) => ipcRenderer.invoke("importHistoryList", args),
  importHistoryGet: (id: number) =>
    ipcRenderer.invoke("importHistoryGet", id),
  importHistoryRevert: (args: {
    id: number;
    observacion?: string;
  }) => ipcRenderer.invoke("importHistoryRevert", args),
  exportarBackup: () => ipcRenderer.invoke("exportarBackup"),
  limpiarBaseDatos: () => ipcRenderer.invoke("limpiarBaseDatos"),
  resetReconciliationProjection: () =>
    ipcRenderer.invoke("resetReconciliationProjection"),
  reconciliationControlGet: () =>
    ipcRenderer.invoke("reconciliationControlGet"),
  historicalBootstrapStart: (snapshotDate: string) =>
    ipcRenderer.invoke("historicalBootstrapStart", { snapshotDate }),
  historicalBootstrapFinish: () =>
    ipcRenderer.invoke("historicalBootstrapFinish"),
  historicalBootstrapReset: () =>
    ipcRenderer.invoke("historicalBootstrapReset"),
  actualizarDiasCredito: (id: number, dias: number) => ipcRenderer.invoke("actualizarDiasCredito", { id, dias }),
  generarPDF: (filename: string) => ipcRenderer.invoke("generarPDF", filename),
  empresaObtener: () => ipcRenderer.invoke("empresaObtener"),
  empresaGuardar: (data: unknown) => ipcRenderer.invoke("empresaGuardar", data),
  clientesAnalisis: () => ipcRenderer.invoke("clientesAnalisis"),
  getNetworkInfo: () => ipcRenderer.invoke("getNetworkInfo"),
  clienteObtenerInfo: (codigo: string) => ipcRenderer.invoke("clienteObtenerInfo", codigo),
  clienteGuardarInfo: (data: unknown) => ipcRenderer.invoke("clienteGuardarInfo", data),
  gestionGuardar: (data: unknown) => ipcRenderer.invoke("gestionGuardar", data),
  gestionesListar: (cliente: string) => ipcRenderer.invoke("gestionesListar", cliente),
  gestionEditar: (data: unknown) => ipcRenderer.invoke("gestionEditar", data),
  gestionCumplir: (id: number) => ipcRenderer.invoke("gestionCumplir", id),
  gestionEliminar: (id: number) => ipcRenderer.invoke("gestionEliminar", id),
  gestionesLegacyMigrar: (data: unknown) => ipcRenderer.invoke("gestionesLegacyMigrar", data),
  gestionesReporte: (args: unknown) => ipcRenderer.invoke("gestionesReporte", args),
  campanasListar: () => ipcRenderer.invoke("campanasListar"),
  campanasGuardar: (data: unknown) => ipcRenderer.invoke("campanasGuardar", data),
  motivosImpago: () => ipcRenderer.invoke("motivosImpago"),
  productividadGestor: () => ipcRenderer.invoke("productividadGestor"),
  alertasIncumplimiento: () => ipcRenderer.invoke("alertasIncumplimiento"),
  pronosticoFlujoCaja: () => ipcRenderer.invoke("pronosticoFlujoCaja"),
  tendenciasHistoricas: () => ipcRenderer.invoke("tendenciasHistoricas"),
  disputasListar: () => ipcRenderer.invoke("disputasListar"),
  disputaCrear: (data: unknown) => ipcRenderer.invoke("disputaCrear", data),
  cuentasAplicarListar: () => ipcRenderer.invoke("cuentasAplicarListar"),
  cuentaAplicarCrear: (data: unknown) => ipcRenderer.invoke("cuentaAplicarCrear", data),
  cuentaAplicarActualizar: (data: unknown) => ipcRenderer.invoke("cuentaAplicarActualizar", data),
  abonosListar: () => ipcRenderer.invoke("abonosListar"),
  clientesListar: () => ipcRenderer.invoke("clientesListar"),
  getGitRemoteUrl: () => ipcRenderer.invoke("getGitRemoteUrl"),
  getUpdateInfo: () => ipcRenderer.invoke("getUpdateInfo"),
};

contextBridge.exposeInMainWorld("carteraApi", apiMethods);
contextBridge.exposeInMainWorld("api", apiMethods);



