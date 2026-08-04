export type DashboardCollectionStatus =
  | 'REQUIERE_CONCILIACION'
  | 'CONCILIADO';

export type DashboardDataQualityStatus =
  | 'OK'
  | 'ATENCION'
  | 'CRITICO';

export interface DashboardAgingItem {
  key:
    | 'POR_VENCER'
    | 'D1_30'
    | 'D31_60'
    | 'D61_90'
    | 'D91_120'
    | 'D121_180'
    | 'D181_360'
    | 'D360_PLUS';
  label: string;
  saldo: number;
  documentos: number;
  porcentaje: number;
}

export interface DashboardTopClient {
  cliente: string;
  saldo: number;
  vencido: number;
  mora90: number;
  porcentajeVencido: number;
}

export interface DashboardSellerPortfolio {
  vendedor: string;
  saldo: number;
  vencido: number;
  mora90: number;
  clientes: number;
  porcentajeVencido: number;
}

export interface DashboardCriticalDebtor {
  cliente: string;
  mora90: number;
  maxDias: number;
  documentos: number;
  vendedor: string;
}

export interface DashboardCriticalAlert {
  key:
    | 'CLIENTES_SIN_POLITICA'
    | 'DOCUMENTOS_CREDITO_PENDIENTE'
    | 'ANULADOS_NO_ENCONTRADOS'
    | 'PROMESAS_VENCIDAS'
    | 'MORA_90';
  label: string;
  count: number;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  target:
    | 'CREDITO'
    | 'ANULADOS'
    | 'GESTION'
    | 'REPORTES';
}

export interface DashboardExecutiveStats {
  fechaCorte: string;
  ultimaImportacion: string | null;
  ultimaDeteccionAbono: string | null;

  cartera: {
    pendiente: number;
    vencida: number;
    porcentajeVencida: number;
    mora90: number;
    porcentajeMora90: number;
    clientesConSaldo: number;
    documentosPendientes: number;
  };

  cobrosMes: {
    estado: DashboardCollectionStatus;
    valorOficial: number | null;
    totalDetectado: number;
    movimientosDetectados: number;
    abonosParcialesDetectados: number;
    movimientosParciales: number;
    cierresPorDesaparicionDetectados: number;
    movimientosPorDesaparicion: number;
    otrosDetectados: number;
    otrosMovimientos: number;
    desde: string;
    hastaExclusivo: string;
    nota: string;
  };

  operacion: {
    vence7Dias: number;
    documentosVence7Dias: number;
    vence8a30Dias: number;
    documentosVence8a30Dias: number;
    clientesSinPolitica: number;
    documentosCreditoPendiente: number;
    documentosSinVencimientoValido: number;
    anuladosNoEncontrados: number;
    promesasVencidas: number;
  };

  calidadDatos: {
    estado: DashboardDataQualityStatus;
    puntuacion: number | null;
    coberturaPoliticaCredito: number;
    coincidenciaAnulaciones: number;
    clientesEvaluados: number;
    documentosEvaluados: number;
    notas: string[];
  };

  aging: DashboardAgingItem[];
  topClientes: DashboardTopClient[];
  carteraPorVendedor: DashboardSellerPortfolio[];
  moraCritica: DashboardCriticalDebtor[];
  alertas: DashboardCriticalAlert[];

  historico: {
    disponible: boolean;
    motivo: string;
    series: [];
  };

  kpisFuturos: Array<{
    key:
      | 'DSO_REAL'
      | 'PROYECCION_COBRANZA'
      | 'CUMPLIMIENTO_META'
      | 'EFECTIVIDAD_GESTOR';
    label: string;
    estado: 'SIN_DATOS' | 'REQUIERE_CONFIGURACION';
    motivo: string;
  }>;
}
