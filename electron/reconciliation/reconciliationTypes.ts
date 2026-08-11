export type EstadoDocumento =
  | "ACTIVO_PENDIENTE"
  | "ABONADO_PARCIAL"
  | "PAGADO_TOTAL"
  | "ANULADO"
  | "AJUSTADO_NC";

export type NivelConfirmacion = "PROVISIONAL" | "CONFIRMADO";

export type FuenteEstado =
  | "CARTERA_CONTIFICO"
  | "DELTA_CARTERA"
  | "COBROS_ABONOS"
  | "NOTAS_CREDITO"
  | "ANULADOS";

export interface ReconciliationContext {
  documento: string;
  saldoAnterior: number | null;
  saldoActual: number | null;
  presenteEnCartera: boolean;
  cobrosConfirmados: number;
  notasCredito: number;
  anulado: boolean;
}

export interface ReconciliationResult {
  estado: EstadoDocumento;
  confirmacion: NivelConfirmacion;
  fuentePrincipal: FuenteEstado;
  saldoPendiente: number;
  deltaTotal: number;
  deltaCobros: number;
  deltaNotasCredito: number;
  deltaNoConciliado: number;
}
