import type Database from "better-sqlite3";
import { insertDocumentEvent } from "./eventRepository";

export const RECOVERY_REVERSAL_EVENT_TYPE = "RECUPERACION_REVERSADA";

export const RECOVERY_PROJECTION_CTES = `
  recuperacion_base AS (
    SELECT
      m.*,
      CASE
        WHEN m.clase_movimiento = 'COBRO'
         AND m.estado_conciliacion = 'CONCILIADO'
        THEN m.valor ELSE 0
      END AS recuperacion_bruta,
      CASE
        WHEN m.clase_movimiento = 'COBRO'
         AND m.estado_conciliacion = 'CONCILIADO'
         AND EXISTS (
           SELECT 1
           FROM documento_eventos reversal
           WHERE reversal.tipo_evento = '${RECOVERY_REVERSAL_EVENT_TYPE}'
             AND reversal.event_key =
               'RECUPERACION_REVERSADA:ANULACION:' || m.movimiento_key
         )
        THEN m.valor ELSE 0
      END AS recuperacion_reversada
    FROM cobros_movimientos_importados m
  ),
  recuperacion_conciliada AS (
    SELECT
      recuperacion_base.*,
      recuperacion_bruta - recuperacion_reversada AS recuperacion_neta
    FROM recuperacion_base
  )
`;

export type RecoveryReversalResult = {
  eventsWritten: number;
  amountReversed: number;
};

export function reverseDocumentRecoveryForCancellation(
  db: Database.Database,
  documentKey: string,
): RecoveryReversalResult {
  const cancellation = db.prepare(`
    SELECT fecha_anulacion, importacion_id
    FROM documentos_anulados_log
    WHERE documento_normalizado = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(documentKey) as
    | { fecha_anulacion: string | null; importacion_id: number | null }
    | undefined;

  if (!cancellation) {
    return { eventsWritten: 0, amountReversed: 0 };
  }

  const movements = db.prepare(`
    SELECT
      movimiento_key,
      valor,
      importacion_id,
      fecha_movimiento,
      asiento,
      codigo_comprobante
    FROM cobros_movimientos_importados
    WHERE documento_relacionado_normalizado = ?
      AND clase_movimiento = 'COBRO'
      AND estado_conciliacion = 'CONCILIADO'
    ORDER BY id
  `).all(documentKey) as Array<{
    movimiento_key: string;
    valor: number;
    importacion_id: number | null;
    fecha_movimiento: string | null;
    asiento: string | null;
    codigo_comprobante: string | null;
  }>;

  const eventExists = db.prepare(
    "SELECT 1 FROM documento_eventos WHERE event_key = ? LIMIT 1",
  );
  let eventsWritten = 0;
  let amountReversed = 0;

  for (const movement of movements) {
    const eventKey =
      `RECUPERACION_REVERSADA:ANULACION:${movement.movimiento_key}`;
    if (eventExists.get(eventKey)) continue;

    insertDocumentEvent(db, {
      eventKey,
      documentoNormalizado: documentKey,
      tipoEvento: RECOVERY_REVERSAL_EVENT_TYPE,
      fuente: "ANULADOS",
      importe: movement.valor,
      estadoAnterior: "PAGADO_TOTAL",
      estadoNuevo: "ANULADO",
      provisional: false,
      importacionId: cancellation.importacion_id,
      referenciaExterna:
        movement.asiento ||
        movement.codigo_comprobante ||
        movement.movimiento_key.slice(0, 16),
      metadata: {
        motivo: "ANULACION",
        monto_revertido: movement.valor,
        fecha_anulacion: cancellation.fecha_anulacion,
        fecha_cobro: movement.fecha_movimiento,
        movement_key: movement.movimiento_key,
        evento_original: `COBRO:${movement.movimiento_key}`,
        importacion_cobro_id: movement.importacion_id,
      },
    });

    eventsWritten += 1;
    amountReversed += Number(movement.valor ?? 0);
  }

  return {
    eventsWritten,
    amountReversed: Math.round(amountReversed * 100) / 100,
  };
}

export function getNetRecoveryTotal(
  db: Database.Database,
  documentKey?: string,
): number {
  const row = db.prepare(`
    WITH ${RECOVERY_PROJECTION_CTES}
    SELECT COALESCE(SUM(recuperacion_neta), 0) AS value
    FROM recuperacion_conciliada
    WHERE (? IS NULL OR documento_relacionado_normalizado = ?)
  `).get(documentKey ?? null, documentKey ?? null) as { value: number };

  return Math.round(Number(row.value ?? 0) * 100) / 100;
}
