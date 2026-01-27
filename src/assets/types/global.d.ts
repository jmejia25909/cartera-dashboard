// src/global.d.ts
export {};

declare global {
  interface Window {
    carteraApi?: {
      ping: () => Promise<{ ok: boolean }>;
      getDbPath: () => Promise<string>; // Corregido: devuelve string directo, no objeto

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

      documentosListar: (filtros: any) => Promise<{ ok: boolean; rows: any[] }>;

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
        vencidaSaldo: number;
        percentVencida: number;
        mora90Saldo: number;
        percentMora90: number;
        mora120Saldo: number;
        percentTop10: number;
        docsPendientes: number;
        clientesConSaldo: number;
        aging: { porVencer: number; d30: number; d60: number; d90: number; d120: number; d120p: number };
      }>;

      topClientes: (limit?: number) => Promise<any[]>;

      limpiarBaseDatos: () => Promise<{ ok: boolean; message: string }>;

      actualizarDiasCredito: (id: number, dias: number) => Promise<{ ok: boolean; message?: string }>;
    };
  }
}