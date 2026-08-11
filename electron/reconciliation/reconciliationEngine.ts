import type {
  ReconciliationContext,
  ReconciliationResult,
} from "./reconciliationTypes";

const money = (value: number): number => Math.round(value * 100) / 100;

export function reconcileDocument(
  context: ReconciliationContext,
): ReconciliationResult {
  const previous = Math.max(0, Number(context.saldoAnterior ?? 0));
  const current = Math.max(0, Number(context.saldoActual ?? 0));
  const deltaReduction = Math.max(0, previous - current);
  const cobros = Math.max(0, Number(context.cobrosConfirmados ?? 0));
  const notas = Math.max(0, Number(context.notasCredito ?? 0));
  const explained = Math.min(deltaReduction, cobros + notas);

  if (context.anulado) {
    return {
      estado: "ANULADO",
      confirmacion: "CONFIRMADO",
      fuentePrincipal: "ANULADOS",
      saldoPendiente: 0,
      deltaTotal: money(deltaReduction),
      deltaCobros: money(cobros),
      deltaNotasCredito: money(notas),
      deltaNoConciliado: money(Math.max(0, deltaReduction - explained)),
    };
  }

  if (!context.presenteEnCartera) {
    const confirmed = cobros + notas >= previous - 0.01;
    return {
      estado: "PAGADO_TOTAL",
      confirmacion: confirmed ? "CONFIRMADO" : "PROVISIONAL",
      fuentePrincipal: confirmed
        ? cobros > 0
          ? "COBROS_ABONOS"
          : "NOTAS_CREDITO"
        : "DELTA_CARTERA",
      saldoPendiente: 0,
      deltaTotal: money(previous),
      deltaCobros: money(cobros),
      deltaNotasCredito: money(notas),
      deltaNoConciliado: money(Math.max(0, previous - cobros - notas)),
    };
  }

  if (notas > 0 && deltaReduction > 0) {
    return {
      estado: "AJUSTADO_NC",
      confirmacion: "CONFIRMADO",
      fuentePrincipal: "NOTAS_CREDITO",
      saldoPendiente: money(current),
      deltaTotal: money(deltaReduction),
      deltaCobros: money(cobros),
      deltaNotasCredito: money(notas),
      deltaNoConciliado: money(Math.max(0, deltaReduction - explained)),
    };
  }

  if (cobros > 0 && deltaReduction > 0) {
    return {
      estado: "ABONADO_PARCIAL",
      confirmacion: "CONFIRMADO",
      fuentePrincipal: "COBROS_ABONOS",
      saldoPendiente: money(current),
      deltaTotal: money(deltaReduction),
      deltaCobros: money(cobros),
      deltaNotasCredito: money(notas),
      deltaNoConciliado: money(Math.max(0, deltaReduction - explained)),
    };
  }

  return {
    estado: "ACTIVO_PENDIENTE",
    confirmacion: "CONFIRMADO",
    fuentePrincipal: "CARTERA_CONTIFICO",
    saldoPendiente: money(current),
    deltaTotal: money(deltaReduction),
    deltaCobros: 0,
    deltaNotasCredito: 0,
    deltaNoConciliado: money(deltaReduction),
  };
}
