// src/global.d.ts
export {};

import type { 
  Filtros, 
  Documento, 
  EmpresaData, 
  ClienteInfo, 
  GestionData, 
  GestionesReporteArgs,
  CampanaData,
  DisputaData,
  CuentaAplicarData,
  TopCliente,
  RiesgoCliente,
  PronosticoMes
} from '../../types/api.types';

declare global {
  interface Window {
    carteraApi?: {
      ping: () => Promise<{ ok: boolean }>;
      getDbPath: () => Promise<string>;

      importarContifico: () => Promise<{
        ok: boolean;
        filePath?: string;
        insertedDocs?: number;
        updatedDocs?: number;
        insertedClientes?: number;
        omittedRows?: number;
        message?: string;
        insertedIds?: number[];
      }>;

      documentosListar: (filtros: Filtros) => Promise<{ ok: boolean; rows: Documento[] }>;

      // Filtros para los combos (clientes, vendedores, etc)
      filtrosListar: () => Promise<{
        clientes: Array<{ cliente: string; razon_social: string }>;
        vendedores: string[];
        tipos: string[];
      }>;

      // KPIs del dashboard
      statsObtener: () => Promise<{
        fechaCorte: string;
        totalSaldo: number;
        totalCobrado?: number;
        vencidaSaldo: number;
        percentVencida: number;
        mora90Saldo: number;
        percentMora90: number;
        mora120Saldo?: number;
        percentTop10: number;
        docsPendientes: number;
        clientesConSaldo: number;
        aging: { porVencer: number; d30: number; d60: number; d90: number; d120: number; d120p: number };
        npl?: number;
        dso?: number;
        recuperacionMesActual?: number;
        metaMensual?: number;
        percentMetaCumplida?: number;
        tasaCumplimientoPromesas?: number;
      }>;

      topClientes: (limit?: number) => Promise<TopCliente[]>;
      limpiarBaseDatos: () => Promise<{ ok: boolean; message: string }>;
      actualizarDiasCredito: (id: number, dias: number) => Promise<{ ok: boolean; message?: string }>;
      empresaObtener: () => Promise<EmpresaData>;
      empresaGuardar: (data: EmpresaData) => Promise<{ ok: boolean; message?: string }>;
      clienteObtenerInfo: (codigo: string) => Promise<ClienteInfo | null>;
      clienteGuardarInfo: (data: ClienteInfo) => Promise<{ ok: boolean; message?: string }>;
      gestionGuardar: (data: GestionData) => Promise<{ ok: boolean; message?: string }>;
      gestionesListar: (cliente: string) => Promise<GestionData[]>;
      gestionCumplir: (id: number) => Promise<{ ok: boolean; message?: string }>;
      gestionEliminar: (id: number) => Promise<{ ok: boolean; message?: string }>;
      gestionesReporte: (args: GestionesReporteArgs) => Promise<GestionData[]>;
      campanasListar: () => Promise<CampanaData[]>;
      campanasGuardar: (data: CampanaData) => Promise<{ ok: boolean; message?: string }>;
      clientesAnalisis: () => Promise<unknown>;
      motivosImpago: () => Promise<unknown>;
      productividadGestor: () => Promise<unknown>;
      segmentacionRiesgo: () => Promise<RiesgoCliente[]>;
      alertasIncumplimiento: () => Promise<unknown>;
      pronosticoFlujoCaja: () => Promise<PronosticoMes[]>;
      tendenciasHistoricas: () => Promise<unknown>;
      disputasListar: () => Promise<DisputaData[]>;
      disputaCrear: (data: DisputaData) => Promise<{ ok: boolean; message?: string }>;
      cuentasAplicarListar: () => Promise<CuentaAplicarData[]>;
      cuentaAplicarCrear: (data: CuentaAplicarData) => Promise<{ ok: boolean; message?: string }>;
      cuentaAplicarActualizar: (data: CuentaAplicarData) => Promise<{ ok: boolean; message?: string }>;
      generarPDF: (filename: string) => Promise<{ ok: boolean; message?: string }>;
      getNetworkInfo: () => Promise<{ ip: string; tunnel?: string }>;
      getGitRemoteUrl: () => Promise<{ ok: boolean; url?: string }>;
      startLocalTunnel: () => Promise<{ ok: boolean; url?: string; message?: string }>;
      closeTunnel: () => Promise<{ ok: boolean; message?: string }>;
      getTunnelStatus: () => Promise<{ active: boolean; url?: string }>;
      campanaCrear?: (data: CampanaData) => Promise<{ ok: boolean; message?: string }>;
      campanaEliminar?: (id: number) => Promise<{ ok: boolean; message?: string }>;
      reiniciarEstructuraExcel?: () => Promise<{ ok: boolean; message?: string }>;
    };
    api?: Window['carteraApi'];
  }
}