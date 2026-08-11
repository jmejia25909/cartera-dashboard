import type Database from "better-sqlite3";
import type { ReconciliationResult } from "./reconciliationTypes";

export type DocumentEventInput = {
  eventKey: string;
  documentoNormalizado: string;
  tipoEvento: string;
  fuente: string;
  importe?: number;
  estadoAnterior?: string | null;
  estadoNuevo?: string | null;
  provisional?: boolean;
  importacionId?: number | null;
  referenciaExterna?: string | null;
  metadata?: Record<string, unknown>;
};

export function insertDocumentEvent(
  db: Database.Database,
  event: DocumentEventInput,
): void {
  db.prepare(`
    INSERT OR IGNORE INTO documento_eventos (
      event_key,
      documento_normalizado,
      tipo_evento,
      fuente,
      importe,
      estado_anterior,
      estado_nuevo,
      provisional,
      importacion_id,
      referencia_externa,
      metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.eventKey,
    event.documentoNormalizado,
    event.tipoEvento,
    event.fuente,
    Number(event.importe ?? 0),
    event.estadoAnterior ?? null,
    event.estadoNuevo ?? null,
    event.provisional ? 1 : 0,
    event.importacionId ?? null,
    event.referenciaExterna ?? null,
    JSON.stringify(event.metadata ?? {}),
  );
}

export function upsertDocumentBalance(
  db: Database.Database,
  args: {
    documentoNormalizado: string;
    importacionId: number;
    saldoAnterior: number | null;
    saldoActual: number;
    presenteCartera: boolean;
  },
): void {
  db.prepare(`
    INSERT INTO documento_saldos (
      documento_normalizado,
      importacion_id,
      saldo_anterior,
      saldo_actual,
      delta,
      presente_cartera
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(documento_normalizado, importacion_id) DO UPDATE SET
      saldo_anterior = excluded.saldo_anterior,
      saldo_actual = excluded.saldo_actual,
      delta = excluded.delta,
      presente_cartera = excluded.presente_cartera
  `).run(
    args.documentoNormalizado,
    args.importacionId,
    args.saldoAnterior,
    args.saldoActual,
    Number(args.saldoActual) - Number(args.saldoAnterior ?? 0),
    args.presenteCartera ? 1 : 0,
  );
}

export function applyCurrentProjection(
  db: Database.Database,
  documentoNormalizado: string,
  result: ReconciliationResult,
): void {
  db.prepare(`
    UPDATE documentos
    SET estado_documento = ?,
        estado_confirmacion = ?,
        estado_fuente = ?,
        saldo_pendiente = ?,
        saldo_original = CASE
          WHEN COALESCE(saldo_original, 0) <= 0 THEN MAX(COALESCE(valor_documento, 0), COALESCE(total, 0))
          ELSE saldo_original
        END,
        ultima_conciliacion_en = datetime('now', 'localtime')
    WHERE is_subtotal = 0
      AND documento_normalizado = ?
  `).run(
    result.estado,
    result.confirmacion,
    result.fuentePrincipal,
    result.saldoPendiente,
    documentoNormalizado,
  );
}
