import {
  centsToMoney,
  toMoneyCents,
  type TemporalScope,
} from "./reconciliationConfig";

export type PortfolioSnapshotDocument = {
  documentoNormalizado: string;
  documento: string;
  cliente: string;
  fechaEmision: string;
  saldo: number;
  temporalScope: TemporalScope;
  positionType: "DEUDA_VIVA" | "CREDITO_VIVO";
};

export type PortfolioDeltaType =
  | "NO_EVENT"
  | "CARTERA_SNAPSHOT"
  | "SALDO_REDUCIDO"
  | "SALDO_INCREMENTADO"
  | "DOCUMENTO_DESAPARECIDO";

export type PortfolioDelta = {
  type: PortfolioDeltaType;
  documentoNormalizado: string;
  previous?: PortfolioSnapshotDocument;
  current?: PortfolioSnapshotDocument;
  saldoAnterior: number | null;
  saldoActual: number;
  delta: number;
};

export type PortfolioDeltaMetrics = {
  nuevos: number;
  sinCambios: number;
  reducidos: number;
  incrementados: number;
  desaparecidos: number;
};

function inScope(
  document: PortfolioSnapshotDocument,
): boolean {
  return document.temporalScope === "IN_SCOPE";
}

export function comparePortfolioSnapshots(
  previousRows: PortfolioSnapshotDocument[],
  currentRows: PortfolioSnapshotDocument[],
  baseline: boolean,
): {
  deltas: PortfolioDelta[];
  metrics: PortfolioDeltaMetrics;
} {
  const previous = new Map(
    previousRows
      .filter(inScope)
      .map((row) => [row.documentoNormalizado, row] as const),
  );
  const current = new Map(
    currentRows
      .filter(inScope)
      .map((row) => [row.documentoNormalizado, row] as const),
  );

  const deltas: PortfolioDelta[] = [];
  const metrics: PortfolioDeltaMetrics = {
    nuevos: 0,
    sinCambios: 0,
    reducidos: 0,
    incrementados: 0,
    desaparecidos: 0,
  };

  for (const [documentoNormalizado, currentRow] of current) {
    const previousRow = previous.get(documentoNormalizado);

    if (!previousRow) {
      metrics.nuevos += 1;
      deltas.push({
        type: "CARTERA_SNAPSHOT",
        documentoNormalizado,
        current: currentRow,
        saldoAnterior: null,
        saldoActual: currentRow.saldo,
        delta: currentRow.saldo,
      });
      continue;
    }

    const previousCents = toMoneyCents(previousRow.saldo);
    const currentCents = toMoneyCents(currentRow.saldo);

    if (previousCents === currentCents) {
      metrics.sinCambios += 1;
      deltas.push({
        type: "NO_EVENT",
        documentoNormalizado,
        previous: previousRow,
        current: currentRow,
        saldoAnterior: previousRow.saldo,
        saldoActual: currentRow.saldo,
        delta: 0,
      });
      continue;
    }

    if (currentCents < previousCents) {
      metrics.reducidos += 1;
      deltas.push({
        type: "SALDO_REDUCIDO",
        documentoNormalizado,
        previous: previousRow,
        current: currentRow,
        saldoAnterior: previousRow.saldo,
        saldoActual: currentRow.saldo,
        delta: centsToMoney(previousCents - currentCents),
      });
      continue;
    }

    metrics.incrementados += 1;
    deltas.push({
      type: "SALDO_INCREMENTADO",
      documentoNormalizado,
      previous: previousRow,
      current: currentRow,
      saldoAnterior: previousRow.saldo,
      saldoActual: currentRow.saldo,
      delta: centsToMoney(currentCents - previousCents),
    });
  }

  // Snapshot #1 es baseline: no existe universo anterior contra el cual
  // inferir desapariciones.
  if (!baseline) {
    for (const [documentoNormalizado, previousRow] of previous) {
      if (current.has(documentoNormalizado)) continue;

      metrics.desaparecidos += 1;
      deltas.push({
        type: "DOCUMENTO_DESAPARECIDO",
        documentoNormalizado,
        previous: previousRow,
        saldoAnterior: previousRow.saldo,
        saldoActual: 0,
        delta: previousRow.saldo,
      });
    }
  }

  return { deltas, metrics };
}
