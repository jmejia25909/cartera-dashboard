/* PACK-045-FIX-004
 * Registro canónico de lotes históricos para fuentes transaccionales.
 * El período se deriva exclusivamente de las fechas efectivas persistidas;
 * nunca del nombre del archivo ni de una fecha ingresada por el operador.
 */

export type HistoricalSource =
  | "ANULADOS"
  | "NOTAS_CREDITO"
  | "COBROS_MOVIMIENTOS";

type SourceDefinition = {
  table: string;
  dateColumn: string;
};

const SOURCES: Record<HistoricalSource, SourceDefinition> = {
  ANULADOS: {
    table: "documentos_anulados_log",
    dateColumn: "fecha_anulacion",
  },
  NOTAS_CREDITO: {
    table: "notas_credito_importadas",
    dateColumn: "fecha_nc",
  },
  COBROS_MOVIMIENTOS: {
    table: "cobros_movimientos_importados",
    dateColumn: "fecha_movimiento",
  },
};

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

export function registerHistoricalTransactionBatch(
  db: any,
  importacionId: number,
  source: HistoricalSource,
): void {
  const definition = SOURCES[source];

  const importRow = db.prepare(`
    SELECT
      id,
      archivo_hash,
      registros_leidos,
      registros_duplicados,
      reconciliation_generation
    FROM importaciones
    WHERE id = ?
  `).get(importacionId) as
    | {
        id: number;
        archivo_hash?: string | null;
        registros_leidos?: number | null;
        registros_duplicados?: number | null;
        reconciliation_generation?: number | null;
      }
    | undefined;

  if (!importRow) {
    throw new Error(`Importación histórica ${importacionId} no encontrada.`);
  }

  const range = db.prepare(`
    SELECT
      MIN(${definition.dateColumn}) AS periodo_desde,
      MAX(${definition.dateColumn}) AS periodo_hasta,
      COUNT(*) AS registros_in_scope
    FROM ${definition.table}
    WHERE importacion_id = ?
      AND ${definition.dateColumn} IS NOT NULL
  `).get(importacionId) as {
    periodo_desde?: string | null;
    periodo_hasta?: string | null;
    registros_in_scope?: number | null;
  };

  const periodoDesde = normalizeDate(range.periodo_desde);
  const periodoHasta = normalizeDate(range.periodo_hasta);

  // Un archivo sin ninguna fecha efectiva válida no puede formar un batch replayable.
  if (!periodoDesde || !periodoHasta) return;

  const generation =
    Number(importRow.reconciliation_generation) ||
    Number(
      (
        db.prepare(`
          SELECT generation
          FROM reconciliation_control
          WHERE id = 1
        `).get() as { generation?: number } | undefined
      )?.generation ?? 1,
    );

  const leidos = Number(importRow.registros_leidos ?? 0);
  const duplicados = Number(importRow.registros_duplicados ?? 0);
  const inScope = Number(range.registros_in_scope ?? 0);
  const legacy = Math.max(0, leidos - duplicados - inScope);

  db.prepare(`
    UPDATE importaciones
    SET periodo_desde = ?,
        periodo_hasta = ?
    WHERE id = ?
  `).run(periodoDesde, periodoHasta, importacionId);

  db.prepare(`
    INSERT INTO historical_bootstrap_batches (
      generation,
      fuente,
      periodo_desde,
      periodo_hasta,
      archivo_hash,
      estado,
      registros_leidos,
      registros_in_scope,
      registros_legacy,
      completado_en
    )
    VALUES (?, ?, ?, ?, ?, 'COMPLETADO', ?, ?, ?, datetime('now','localtime'))
    ON CONFLICT(generation, fuente, periodo_desde, periodo_hasta, archivo_hash)
    DO UPDATE SET
      estado = 'COMPLETADO',
      registros_leidos = excluded.registros_leidos,
      registros_in_scope = excluded.registros_in_scope,
      registros_legacy = excluded.registros_legacy,
      completado_en = datetime('now','localtime')
  `).run(
    generation,
    source,
    periodoDesde,
    periodoHasta,
    importRow.archivo_hash ?? null,
    leidos,
    inScope,
    legacy,
  );
}

export function backfillHistoricalTransactionBatches(db: any): number {
  const rows = db.prepare(`
    SELECT id, tipo
    FROM importaciones
    WHERE tipo IN ('ANULADOS','NOTAS_CREDITO','COBROS_MOVIMIENTOS')
      AND estado IN ('COMPLETADA','COMPLETADA_ADVERTENCIAS')
    ORDER BY id
  `).all() as Array<{ id: number; tipo: HistoricalSource }>;

  let processed = 0;

  const tx = db.transaction(() => {
    for (const row of rows) {
      registerHistoricalTransactionBatch(db, row.id, row.tipo);
      processed += 1;
    }
  });

  tx();
  return processed;
}
