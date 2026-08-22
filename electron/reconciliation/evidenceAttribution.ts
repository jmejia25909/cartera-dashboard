import type Database from "better-sqlite3";
import {
  insertDocumentEvent,
  prepareDocumentEventInserter,
} from "./eventRepository";

export const EVIDENCE_ATTRIBUTION_EVENT_TYPE =
  "EVIDENCIA_ATRIBUIDA_DELTA";
export const EVIDENCE_BASELINE_EVENT_TYPE = "EVIDENCIA_BASELINE_B4";
export const EVIDENCE_ATTRIBUTION_ACTIVATION_EVENT_KEY =
  "MODELO_ATRIBUCION_EVIDENCIA:B5:ACTIVADO";

type EvidenceKind = "COBRO" | "NOTA_CREDITO";

type Evidence = {
  kind: EvidenceKind;
  id: number;
  key: string;
  amount: number;
  date: string | null;
  importId: number | null;
};

export type DeltaEvidenceAttribution = {
  collections: number;
  creditNotes: number;
  total: number;
  eventsWritten: number;
};

const money = (value: unknown): number =>
  Math.round((Number(value) || 0) * 100) / 100;

function evidenceReference(evidence: Evidence): string {
  return `${evidence.kind}:${evidence.key}`;
}

function loadEvidence(
  db: Database.Database,
  documentKey: string,
): Evidence[] {
  const collections = db.prepare(`
    SELECT
      id,
      movimiento_key AS evidence_key,
      valor AS amount,
      fecha_movimiento AS evidence_date,
      importacion_id AS import_id
    FROM cobros_movimientos_importados
    WHERE documento_relacionado_normalizado = ?
      AND clase_movimiento = 'COBRO'
      AND estado_conciliacion = 'CONCILIADO'
  `).all(documentKey) as Array<{
    id: number;
    evidence_key: string;
    amount: number;
    evidence_date: string | null;
    import_id: number | null;
  }>;

  const creditNotes = db.prepare(`
    SELECT
      id,
      numero_nc_normalizado AS evidence_key,
      total_nc AS amount,
      fecha_nc AS evidence_date,
      importacion_id AS import_id
    FROM notas_credito_importadas
    WHERE documento_relacionado_normalizado = ?
      AND estado_conciliacion = 'CONCILIADA'
  `).all(documentKey) as Array<{
    id: number;
    evidence_key: string;
    amount: number;
    evidence_date: string | null;
    import_id: number | null;
  }>;

  return [
    ...collections.map((row): Evidence => ({
      kind: "COBRO",
      id: row.id,
      key: row.evidence_key,
      amount: money(row.amount),
      date: row.evidence_date,
      importId: row.import_id,
    })),
    ...creditNotes.map((row): Evidence => ({
      kind: "NOTA_CREDITO",
      id: row.id,
      key: row.evidence_key,
      amount: money(row.amount),
      date: row.evidence_date,
      importId: row.import_id,
    })),
  ].sort((left, right) =>
    String(left.date ?? "9999-12-31").localeCompare(
      String(right.date ?? "9999-12-31"),
    ) ||
    left.kind.localeCompare(right.kind) ||
    left.id - right.id,
  );
}

function attributedByEvidence(
  db: Database.Database,
  documentKey: string,
): Map<string, number> {
  const rows = db.prepare(`
    SELECT referencia_externa, COALESCE(SUM(importe), 0) AS amount
    FROM documento_eventos
    WHERE documento_normalizado = ?
      AND tipo_evento IN (?, ?)
    GROUP BY referencia_externa
  `).all(
    documentKey,
    EVIDENCE_ATTRIBUTION_EVENT_TYPE,
    EVIDENCE_BASELINE_EVENT_TYPE,
  ) as Array<{
    referencia_externa: string;
    amount: number;
  }>;

  return new Map(
    rows.map((row) => [row.referencia_externa, money(row.amount)]),
  );
}

function currentDeltaAttribution(
  db: Database.Database,
  documentKey: string,
  balanceId: number,
): DeltaEvidenceAttribution {
  const rows = db.prepare(`
    SELECT fuente, COALESCE(SUM(importe), 0) AS amount
    FROM documento_eventos
    WHERE documento_normalizado = ?
      AND tipo_evento = ?
      AND event_key LIKE ?
    GROUP BY fuente
  `).all(
    documentKey,
    EVIDENCE_ATTRIBUTION_EVENT_TYPE,
    `EVIDENCIA_ATRIBUIDA_DELTA:${balanceId}:%`,
  ) as Array<{ fuente: string; amount: number }>;

  let collections = 0;
  let creditNotes = 0;
  for (const row of rows) {
    if (row.fuente === "COBROS_ABONOS") collections += money(row.amount);
    if (row.fuente === "NOTAS_CREDITO") creditNotes += money(row.amount);
  }

  return {
    collections: money(collections),
    creditNotes: money(creditNotes),
    total: money(collections + creditNotes),
    eventsWritten: 0,
  };
}

export function attributeEvidenceToDelta(
  db: Database.Database,
  args: {
    documentKey: string;
    balanceId: number;
    importId: number;
    reduction: number;
  },
): DeltaEvidenceAttribution {
  const existing = currentDeltaAttribution(
    db,
    args.documentKey,
    args.balanceId,
  );
  let remainingDelta = money(Math.max(0, args.reduction - existing.total));
  if (remainingDelta <= 0) return existing;

  const consumed = attributedByEvidence(db, args.documentKey);
  let collections = existing.collections;
  let creditNotes = existing.creditNotes;
  let eventsWritten = 0;

  for (const evidence of loadEvidence(db, args.documentKey)) {
    if (remainingDelta <= 0) break;

    const reference = evidenceReference(evidence);
    const available = money(
      Math.max(0, evidence.amount - (consumed.get(reference) ?? 0)),
    );
    const attributed = money(Math.min(remainingDelta, available));
    if (attributed <= 0) continue;

    const eventKey = [
      "EVIDENCIA_ATRIBUIDA_DELTA",
      args.balanceId,
      evidence.kind,
      evidence.key,
    ].join(":");

    const changes = insertDocumentEvent(db, {
      eventKey,
      documentoNormalizado: args.documentKey,
      tipoEvento: EVIDENCE_ATTRIBUTION_EVENT_TYPE,
      fuente:
        evidence.kind === "COBRO" ? "COBROS_ABONOS" : "NOTAS_CREDITO",
      importe: attributed,
      provisional: false,
      importacionId: args.importId,
      referenciaExterna: reference,
      metadata: {
        balance_id: args.balanceId,
        evidencia_tipo: evidence.kind,
        evidencia_id: evidence.id,
        evidencia_key: evidence.key,
        evidencia_importacion_id: evidence.importId,
        evidencia_fecha: evidence.date,
        evidencia_importe_total: evidence.amount,
        importe_atribuido: attributed,
        regla: "EVIDENCIA_NO_CONSUMIDA_ASIGNADA_A_DELTA",
      },
    });

    if (changes === 1) {
      consumed.set(reference, money((consumed.get(reference) ?? 0) + attributed));
      remainingDelta = money(remainingDelta - attributed);
      if (evidence.kind === "COBRO") collections = money(collections + attributed);
      else creditNotes = money(creditNotes + attributed);
      eventsWritten += 1;
      continue;
    }

    const persisted = currentDeltaAttribution(
      db,
      args.documentKey,
      args.balanceId,
    );
    collections = persisted.collections;
    creditNotes = persisted.creditNotes;
    remainingDelta = money(Math.max(0, args.reduction - persisted.total));
  }

  return {
    collections,
    creditNotes,
    total: money(collections + creditNotes),
    eventsWritten,
  };
}

/**
 * Activa una sola vez el modelo explícito. El baseline no reconstruye una
 * relación histórica ambigua: solo bloquea el remanente de evidencia que ya
 * estaba conciliada/aplicada. Evidencia pendiente permanece disponible.
 */
export function ensureEvidenceAttributionBaseline(
  db: Database.Database,
): { activated: boolean; baselineEvents: number } {
  const alreadyActivated = db.prepare(`
    SELECT 1 FROM documento_eventos WHERE event_key = ? LIMIT 1
  `).get(EVIDENCE_ATTRIBUTION_ACTIVATION_EVENT_KEY);
  if (alreadyActivated) return { activated: false, baselineEvents: 0 };

  let baselineEvents = 0;
  const activate = db.transaction(() => {
    const insertBaselineEvent = prepareDocumentEventInserter(db);
    const rows = db.prepare(`
      SELECT
        'COBRO' AS kind,
        movimiento_key AS evidence_key,
        documento_relacionado_normalizado AS document_key,
        valor AS amount,
        importacion_id AS import_id
      FROM cobros_movimientos_importados
      WHERE clase_movimiento = 'COBRO'
        AND estado_conciliacion = 'CONCILIADO'
        AND TRIM(COALESCE(documento_relacionado_normalizado, '')) <> ''
      UNION ALL
      SELECT
        'NOTA_CREDITO' AS kind,
        numero_nc_normalizado AS evidence_key,
        documento_relacionado_normalizado AS document_key,
        total_nc AS amount,
        importacion_id AS import_id
      FROM notas_credito_importadas
      WHERE estado_conciliacion = 'CONCILIADA'
        AND TRIM(COALESCE(documento_relacionado_normalizado, '')) <> ''
    `).all() as Array<{
      kind: EvidenceKind;
      evidence_key: string;
      document_key: string;
      amount: number;
      import_id: number | null;
    }>;

    const consumedRows = db.prepare(`
      SELECT
        documento_normalizado AS document_key,
        referencia_externa AS reference,
        COALESCE(SUM(importe), 0) AS amount
      FROM documento_eventos
      WHERE tipo_evento = ?
      GROUP BY documento_normalizado, referencia_externa
    `).all(EVIDENCE_ATTRIBUTION_EVENT_TYPE) as Array<{
      document_key: string;
      reference: string;
      amount: number;
    }>;
    const consumedByEvidence = new Map(
      consumedRows.map((row) => [
        `${row.document_key}\u0000${row.reference}`,
        money(row.amount),
      ]),
    );

    for (const row of rows) {
      const reference = `${row.kind}:${row.evidence_key}`;
      const consumed = consumedByEvidence.get(
        `${row.document_key}\u0000${reference}`,
      ) ?? 0;
      const blockedRemainder = money(
        Math.max(0, money(row.amount) - consumed),
      );
      if (blockedRemainder <= 0) continue;

      baselineEvents += insertBaselineEvent({
        eventKey: `EVIDENCIA_BASELINE_B4:${row.kind}:${row.evidence_key}`,
        documentoNormalizado: row.document_key,
        tipoEvento: EVIDENCE_BASELINE_EVENT_TYPE,
        fuente: "MODELO_ATRIBUCION",
        importe: blockedRemainder,
        provisional: false,
        importacionId: row.import_id,
        referenciaExterna: reference,
        metadata: {
          naturaleza: "BASELINE_NO_ATRIBUCION",
          evidencia_tipo: row.kind,
          evidencia_key: row.evidence_key,
          evidencia_importe_total: money(row.amount),
          importe_bloqueado: blockedRemainder,
          regla:
            "EVIDENCIA_PRE_B4_CONCILIADA_NO_DISPONIBLE_PARA_NUEVOS_DELTAS",
        },
      });
    }

    insertBaselineEvent({
      eventKey: EVIDENCE_ATTRIBUTION_ACTIVATION_EVENT_KEY,
      documentoNormalizado: "__SISTEMA__",
      tipoEvento: "MODELO_ATRIBUCION_ACTIVADO",
      fuente: "SISTEMA",
      importe: 0,
      provisional: false,
      referenciaExterna: "B5",
      metadata: {
        baseline_eventos: baselineEvents,
        regla:
          "BASELINE_BLOQUEA_CONCILIADOS_PREEXISTENTES_Y_CONSERVA_PENDIENTES",
      },
    });
  });

  activate();
  return { activated: true, baselineEvents };
}
