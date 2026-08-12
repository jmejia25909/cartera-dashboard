export type TemporalScope = "IN_SCOPE" | "OUT_OF_SCOPE_LEGACY";

export type ReconciliationMode =
  | "TEST"
  | "HISTORICAL_LOAD"
  | "PRODUCTION";

export const RECONCILIATION_CONFIG = Object.freeze({
  cutoffDate: "2024-01-01",
  operationStartDate: "2024-02-01",
  defaultMode: "TEST" as ReconciliationMode,
});

export function classifyTemporalScope(
  effectiveDate: string | null | undefined,
): TemporalScope {
  // Fecha ausente no se presume legacy. El parser/origen puede advertirla
  // por separado, pero nunca descartamos evidencia sin una fecha válida.
  if (!effectiveDate || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
    return "IN_SCOPE";
  }

  return effectiveDate < RECONCILIATION_CONFIG.cutoffDate
    ? "OUT_OF_SCOPE_LEGACY"
    : "IN_SCOPE";
}

export function toMoneyCents(value: number): number {
  return Math.round(Number(value || 0) * 100);
}

export function centsToMoney(value: number): number {
  return Math.round(value) / 100;
}
