import type Database from "better-sqlite3";
import { applyCurrentProjection, insertDocumentEvent } from "./eventRepository";
import { reconcileDocument } from "./reconciliationEngine";
import type { ReconciliationResult } from "./reconciliationTypes";

type HistoricalBalance = {
  id: number;
  importacion_id: number;
  saldo_anterior: number | null;
  saldo_actual: number;
  presente_cartera: number;
};

type CurrentProjection = {
  documento: string | null;
  estado_documento: string | null;
  estado_confirmacion: string | null;
};

type LatestEvent = {
  estado_nuevo: string | null;
  provisional: number;
};

type EvidenceTotals = {
  amount: number;
  lastId: number;
};

export type DocumentHistoryReconciliation = {
  found: boolean;
  result: ReconciliationResult | null;
  linkedCollections: number;
  linkedCreditNotes: number;
  linkedFiscalRetentions: number;
  eventWritten: boolean;
};

function money(value: unknown): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function historicalBalance(
  db: Database.Database,
  documentKey: string,
): HistoricalBalance | undefined {
  const balance = db.prepare(`
    SELECT
      id,
      importacion_id,
      saldo_anterior,
      saldo_actual,
      presente_cartera
    FROM documento_saldos
    WHERE documento_normalizado = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(documentKey) as HistoricalBalance | undefined;

  if (balance) return balance;

  // Compatibilidad con historia anterior a documento_saldos: el último
  // snapshot conserva el saldo fuente y documentos determina presencia actual.
  return db.prepare(`
    SELECT
      -cs.id AS id,
      cs.importacion_id,
      sd.saldo AS saldo_anterior,
      CASE
        WHEN current.id IS NULL THEN 0
        ELSE COALESCE(current.total, 0)
      END AS saldo_actual,
      CASE WHEN current.id IS NULL THEN 0 ELSE 1 END AS presente_cartera
    FROM cartera_snapshot_documentos sd
    INNER JOIN cartera_snapshots cs
      ON cs.id = sd.snapshot_id
    LEFT JOIN documentos current
      ON current.is_subtotal = 0
     AND current.documento_normalizado = sd.documento_normalizado
    WHERE sd.documento_normalizado = ?
    ORDER BY cs.id DESC
    LIMIT 1
  `).get(documentKey) as HistoricalBalance | undefined;
}

function currentProjection(
  db: Database.Database,
  documentKey: string,
): CurrentProjection | undefined {
  return db.prepare(`
    SELECT documento, estado_documento, estado_confirmacion
    FROM documentos
    WHERE is_subtotal = 0
      AND documento_normalizado = ?
    LIMIT 1
  `).get(documentKey) as CurrentProjection | undefined;
}

function latestEvent(
  db: Database.Database,
  documentKey: string,
): LatestEvent | undefined {
  return db.prepare(`
    SELECT estado_nuevo, provisional
    FROM documento_eventos
    WHERE documento_normalizado = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(documentKey) as LatestEvent | undefined;
}

function linkCollections(
  db: Database.Database,
  documentKey: string,
): number {
  const pending = db.prepare(`
    SELECT
      id,
      movimiento_key,
      valor,
      importacion_id,
      asiento,
      codigo_comprobante,
      clase_movimiento,
      fecha_movimiento
    FROM cobros_movimientos_importados
    WHERE documento_relacionado_normalizado = ?
      AND clase_movimiento IN ('COBRO', 'CRUCE')
      AND estado_conciliacion = 'PENDIENTE_CONCILIACION'
    ORDER BY id
  `).all(documentKey) as Array<{
    id: number;
    movimiento_key: string;
    valor: number;
    importacion_id: number | null;
    asiento: string | null;
    codigo_comprobante: string | null;
    clase_movimiento: string;
    fecha_movimiento: string | null;
  }>;

  const mark = db.prepare(`
    UPDATE cobros_movimientos_importados
    SET estado_conciliacion = 'CONCILIADO'
    WHERE id = ?
      AND estado_conciliacion = 'PENDIENTE_CONCILIACION'
  `);

  for (const row of pending) {
    mark.run(row.id);
    insertDocumentEvent(db, {
      eventKey: `COBRO:${row.movimiento_key}`,
      documentoNormalizado: documentKey,
      tipoEvento: "COBRO_CONFIRMADO",
      fuente: "COBROS_MOVIMIENTOS",
      importe: row.valor,
      estadoAnterior: null,
      estadoNuevo: null,
      provisional: false,
      importacionId: row.importacion_id,
      referenciaExterna:
        row.asiento || row.codigo_comprobante || row.movimiento_key.slice(0, 16),
      metadata: {
        claseMovimiento: row.clase_movimiento,
        fechaMovimiento: row.fecha_movimiento,
        vinculacion: "RECONCILIACION_HISTORICA",
      },
    });
  }

  return pending.length;
}

function linkFiscalRetentions(
  db: Database.Database,
  documentKey: string,
): number {
  const pending = db.prepare(`
    SELECT
      id,
      movimiento_key,
      valor,
      importacion_id,
      asiento,
      codigo_comprobante,
      fecha_movimiento
    FROM cobros_movimientos_importados
    WHERE documento_relacionado_normalizado = ?
      AND clase_movimiento = 'RETENCION'
      AND estado_conciliacion = 'PENDIENTE_CONCILIACION'
    ORDER BY id
  `).all(documentKey) as Array<{
    id: number;
    movimiento_key: string;
    valor: number;
    importacion_id: number | null;
    asiento: string | null;
    codigo_comprobante: string | null;
    fecha_movimiento: string | null;
  }>;

  const mark = db.prepare(`
    UPDATE cobros_movimientos_importados
    SET estado_conciliacion = 'CONCILIADO'
    WHERE id = ?
      AND estado_conciliacion = 'PENDIENTE_CONCILIACION'
  `);

  for (const row of pending) {
    mark.run(row.id);
    insertDocumentEvent(db, {
      eventKey: `RETENCION:${row.movimiento_key}`,
      documentoNormalizado: documentKey,
      tipoEvento: "RETENCION_FISCAL_REGISTRADA",
      fuente: "COBROS_MOVIMIENTOS",
      importe: row.valor,
      estadoAnterior: null,
      estadoNuevo: null,
      provisional: false,
      importacionId: row.importacion_id,
      referenciaExterna:
        row.asiento || row.codigo_comprobante || row.movimiento_key.slice(0, 16),
      metadata: {
        claseMovimiento: "RETENCION",
        fechaMovimiento: row.fecha_movimiento,
        naturaleza: "EVIDENCIA_FISCAL_NO_MONETARIA",
        vinculacion: "RECONCILIACION_HISTORICA",
      },
    });
  }

  return pending.length;
}

function linkCreditNotes(
  db: Database.Database,
  documentKey: string,
): number {
  const pending = db.prepare(`
    SELECT
      id,
      numero_nc,
      numero_nc_normalizado,
      total_nc,
      importacion_id,
      fecha_nc
    FROM notas_credito_importadas
    WHERE documento_relacionado_normalizado = ?
      AND estado_conciliacion = 'PENDIENTE_CONCILIACION'
    ORDER BY id
  `).all(documentKey) as Array<{
    id: number;
    numero_nc: string;
    numero_nc_normalizado: string;
    total_nc: number;
    importacion_id: number | null;
    fecha_nc: string | null;
  }>;

  const mark = db.prepare(`
    UPDATE notas_credito_importadas
    SET estado_conciliacion = 'CONCILIADA'
    WHERE id = ?
      AND estado_conciliacion = 'PENDIENTE_CONCILIACION'
  `);

  for (const row of pending) {
    mark.run(row.id);
    insertDocumentEvent(db, {
      eventKey: `NC:${row.numero_nc_normalizado}:${documentKey}`,
      documentoNormalizado: documentKey,
      tipoEvento: "NOTA_CREDITO_APLICADA",
      fuente: "NOTAS_CREDITO",
      importe: row.total_nc,
      estadoAnterior: null,
      estadoNuevo: "AJUSTADO_NC",
      provisional: false,
      importacionId: row.importacion_id,
      referenciaExterna: row.numero_nc,
      metadata: {
        fecha: row.fecha_nc,
        vinculacion: "RECONCILIACION_HISTORICA",
      },
    });
  }

  return pending.length;
}

function collectionEvidence(
  db: Database.Database,
  documentKey: string,
): EvidenceTotals {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(valor), 0) AS amount,
      COALESCE(MAX(id), 0) AS last_id
    FROM cobros_movimientos_importados
    WHERE documento_relacionado_normalizado = ?
      AND clase_movimiento IN ('COBRO', 'CRUCE')
      AND estado_conciliacion = 'CONCILIADO'
  `).get(documentKey) as { amount: number; last_id: number };

  return { amount: money(row.amount), lastId: Number(row.last_id ?? 0) };
}

function creditNoteEvidence(
  db: Database.Database,
  documentKey: string,
): EvidenceTotals {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(total_nc), 0) AS amount,
      COALESCE(MAX(id), 0) AS last_id
    FROM notas_credito_importadas
    WHERE documento_relacionado_normalizado = ?
      AND estado_conciliacion = 'CONCILIADA'
  `).get(documentKey) as { amount: number; last_id: number };

  return { amount: money(row.amount), lastId: Number(row.last_id ?? 0) };
}

function hasCancellation(
  db: Database.Database,
  documentKey: string,
): boolean {
  return Boolean(db.prepare(`
    SELECT 1
    FROM documentos_anulados_log
    WHERE documento_normalizado = ?
    LIMIT 1
  `).get(documentKey));
}

export function reconcileDocumentHistory(
  db: Database.Database,
  documentKey: string,
): DocumentHistoryReconciliation {
  const key = String(documentKey || "").trim();
  if (!key) {
    return {
      found: false,
      result: null,
      linkedCollections: 0,
      linkedCreditNotes: 0,
      linkedFiscalRetentions: 0,
      eventWritten: false,
    };
  }

  const balance = historicalBalance(db, key);
  if (!balance) {
    return {
      found: false,
      result: null,
      linkedCollections: 0,
      linkedCreditNotes: 0,
      linkedFiscalRetentions: 0,
      eventWritten: false,
    };
  }

  const linkedCollections = linkCollections(db, key);
  const linkedFiscalRetentions = linkFiscalRetentions(db, key);
  const linkedCreditNotes = linkCreditNotes(db, key);
  const collections = collectionEvidence(db, key);
  const creditNotes = creditNoteEvidence(db, key);
  const cancelled = hasCancellation(db, key);
  const projection = currentProjection(db, key);
  const previousEvent = latestEvent(db, key);

  const result = reconcileDocument({
    documento: key,
    saldoAnterior: balance.saldo_anterior,
    saldoActual: balance.saldo_actual,
    presenteEnCartera: balance.presente_cartera === 1,
    cobrosConfirmados: collections.amount,
    notasCredito: creditNotes.amount,
    anulado: cancelled,
  });

  if (projection) {
    applyCurrentProjection(db, key, result);
  }

  const previousState =
    projection?.estado_documento || previousEvent?.estado_nuevo || null;
  const previousProvisional = projection
    ? projection.estado_confirmacion === "PROVISIONAL"
    : previousEvent?.provisional === 1;
  const stateChanged = previousState !== result.estado;
  const confirmationChanged =
    previousProvisional !== (result.confirmacion === "PROVISIONAL");

  if (!stateChanged && !confirmationChanged) {
    return {
      found: true,
      result,
      linkedCollections,
      linkedCreditNotes,
      linkedFiscalRetentions,
      eventWritten: false,
    };
  }

  const eventType = stateChanged
    ? "ESTADO_RECLASIFICADO"
    : "ESTADO_CONFIRMADO";
  const eventKey = [
    "RECONCILIACION_HISTORICA",
    balance.id,
    collections.lastId,
    creditNotes.lastId,
    cancelled ? 1 : 0,
    result.estado,
    result.confirmacion,
  ].join(":");

  const before = db.prepare(
    "SELECT 1 FROM documento_eventos WHERE event_key = ? LIMIT 1",
  ).get(eventKey);

  insertDocumentEvent(db, {
    eventKey,
    documentoNormalizado: key,
    tipoEvento: eventType,
    fuente: result.fuentePrincipal,
    importe: result.deltaTotal,
    estadoAnterior: previousState,
    estadoNuevo: result.estado,
    provisional: result.confirmacion === "PROVISIONAL",
    importacionId: balance.importacion_id,
    referenciaExterna: projection?.documento || key,
    metadata: {
      saldo_anterior: balance.saldo_anterior,
      saldo_actual: balance.saldo_actual,
      delta_total: result.deltaTotal,
      delta_cobros: result.deltaCobros,
      delta_notas_credito: result.deltaNotasCredito,
      delta_no_conciliado: result.deltaNoConciliado,
      evidencia_cobros_ultimo_id: collections.lastId,
      evidencia_nc_ultimo_id: creditNotes.lastId,
      anulacion_confirmada: cancelled,
    },
  });

  return {
    found: true,
    result,
    linkedCollections,
    linkedCreditNotes,
    linkedFiscalRetentions,
    eventWritten: !before,
  };
}
