import assert from "node:assert/strict";
import { getManagementReportDetail } from "../../electron/managementReportDetails";
import {
  EVIDENCE_ATTRIBUTION_ACTIVATION_EVENT_KEY,
  ensureEvidenceAttributionBaseline,
} from "../../electron/reconciliation/evidenceAttribution";
import { reconcileDocumentHistory } from "../../electron/reconciliation/documentHistoryReconciliation";

import {
  createScenarioContext,
  creditAdjustment,
  importCancellation,
  importCollection,
  importCreditNote,
  importPortfolio,
  latestEvent,
  normalized,
  reimportCancellationFile,
  reimportCollectionFile,
  reimportCreditNoteFile,
  recovery,
  type ScenarioContext,
} from "./support";

type Scenario = {
  id: number;
  name: string;
  expectedFailure: boolean;
  defect?: string;
  run: (context: ScenarioContext) => void;
};

const DOCUMENT = "001-001-000000101";
const SECOND_DOCUMENT = "001-001-000000102";
let baselineBenchmark: {
  evidence: number;
  firstActivationMs: number;
  secondActivationMs: number;
} | null = null;

function projected(context: ScenarioContext, document = DOCUMENT) {
  return context.db.prepare(`
    SELECT * FROM documentos
    WHERE documento_normalizado = ? AND is_subtotal = 0
  `).get(normalized(document)) as Record<string, unknown> | undefined;
}

function eventCount(context: ScenarioContext, type?: string): number {
  const row = type
    ? context.db.prepare("SELECT COUNT(*) AS value FROM documento_eventos WHERE tipo_evento = ?").get(type)
    : context.db.prepare("SELECT COUNT(*) AS value FROM documento_eventos").get();
  return Number((row as { value: number }).value);
}

function attributed(
  context: ScenarioContext,
  options?: { kind?: "COBRO" | "NOTA_CREDITO"; balanceId?: number },
): number {
  const where = ["tipo_evento = 'EVIDENCIA_ATRIBUIDA_DELTA'"];
  const params: unknown[] = [];
  if (options?.kind) {
    where.push("referencia_externa LIKE ?");
    params.push(`${options.kind}:%`);
  }
  if (options?.balanceId != null) {
    where.push("event_key LIKE ?");
    params.push(`EVIDENCIA_ATRIBUIDA_DELTA:${options.balanceId}:%`);
  }
  const row = context.db.prepare(`
    SELECT COALESCE(SUM(importe), 0) AS value
    FROM documento_eventos WHERE ${where.join(" AND ")}
  `).get(...params) as { value: number };
  return Number(row.value ?? 0);
}

function balanceIds(context: ScenarioContext): number[] {
  return (context.db.prepare(`
    SELECT id FROM documento_saldos
    WHERE documento_normalizado = ? AND saldo_anterior IS NOT NULL
    ORDER BY id
  `).all(normalized(DOCUMENT)) as Array<{ id: number }>).map((row) => row.id);
}

function assertAttributionInvariants(context: ScenarioContext): void {
  const overEvidence = context.db.prepare(`
    WITH evidence AS (
      SELECT 'COBRO:' || movimiento_key AS reference, valor AS amount
      FROM cobros_movimientos_importados WHERE clase_movimiento = 'COBRO'
      UNION ALL
      SELECT 'NOTA_CREDITO:' || numero_nc_normalizado, total_nc
      FROM notas_credito_importadas
    ), attributed AS (
      SELECT referencia_externa AS reference, SUM(importe) AS amount
      FROM documento_eventos
      WHERE tipo_evento = 'EVIDENCIA_ATRIBUIDA_DELTA'
      GROUP BY referencia_externa
    )
    SELECT COUNT(*) AS value
    FROM attributed a
    LEFT JOIN evidence e ON e.reference = a.reference
    WHERE e.reference IS NULL OR a.amount > e.amount + 0.001
  `).get() as { value: number };
  assert.equal(Number(overEvidence.value), 0);

  const overDelta = context.db.prepare(`
    SELECT COUNT(*) AS value
    FROM (
      SELECT
        b.id,
        MAX(COALESCE(b.saldo_anterior, 0) - b.saldo_actual, 0) AS reduction,
        COALESCE(SUM(e.importe), 0) AS attributed
      FROM documento_saldos b
      LEFT JOIN documento_eventos e
        ON e.tipo_evento = 'EVIDENCIA_ATRIBUIDA_DELTA'
       AND CAST(json_extract(e.metadata_json, '$.balance_id') AS INTEGER) = b.id
      GROUP BY b.id
    )
    WHERE attributed > reduction + 0.001
  `).get() as { value: number };
  assert.equal(Number(overDelta.value), 0);

  const nonMonetary = context.db.prepare(`
    SELECT COUNT(*) AS value
    FROM documento_eventos e
    WHERE e.tipo_evento = 'EVIDENCIA_ATRIBUIDA_DELTA'
      AND EXISTS (
        SELECT 1 FROM cobros_movimientos_importados m
        WHERE e.referencia_externa = 'COBRO:' || m.movimiento_key
          AND m.clase_movimiento IN ('CRUCE', 'RETENCION')
      )
  `).get() as { value: number };
  assert.equal(Number(nonMonetary.value), 0);
}

const scenarios: Scenario[] = [
  {
    id: 1,
    name: "snapshot inicial",
    expectedFailure: false,
    run: (ctx) => {
      const { result } = importPortfolio(ctx, "portfolio-initial", [{ document: DOCUMENT, balance: 1000 }]);
      const row = projected(ctx);
      assert.equal(result.baseline, true);
      assert.equal(result.nuevos, 1);
      assert.equal(Number(row?.total), 1000);
      assert.equal(row?.estado_documento, "ACTIVO_PENDIENTE");
      assert.equal(eventCount(ctx, "CARTERA_SNAPSHOT"), 1);
    },
  },
  {
    id: 2,
    name: "snapshot idéntico",
    expectedFailure: false,
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      const before = eventCount(ctx);
      const { result } = importPortfolio(ctx, "portfolio-b", [{ document: DOCUMENT, balance: 1000 }]);
      assert.equal(result.sinCambios, 1);
      assert.equal(result.eventosGenerados, 0);
      assert.equal(eventCount(ctx), before);
    },
  },
  {
    id: 3,
    name: "documento nuevo",
    expectedFailure: false,
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      const { result } = importPortfolio(ctx, "portfolio-b", [
        { document: DOCUMENT, balance: 1000 },
        { document: SECOND_DOCUMENT, balance: 500 },
      ]);
      assert.equal(result.nuevos, 1);
      assert.equal(Number(projected(ctx, SECOND_DOCUMENT)?.total), 500);
    },
  },
  {
    id: 4,
    name: "reducción parcial de saldo",
    expectedFailure: true,
    defect: "El delta se procesa con cobros/NC en cero y no materializa ABONADO_PARCIAL.",
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      importCollection(ctx, "collection-partial", DOCUMENT, 300);
      importPortfolio(ctx, "portfolio-b", [{ document: DOCUMENT, balance: 700 }]);
      const row = projected(ctx);
      assert.equal(Number(row?.saldo_pendiente), 700);
      assert.equal(row?.estado_documento, "ABONADO_PARCIAL");
      assert.equal(recovery(ctx.db, DOCUMENT), 300);
    },
  },
  {
    id: 5,
    name: "pago total",
    expectedFailure: true,
    defect: "La desaparición no consulta el cobro ya importado y permanece PAGADO_TOTAL provisional.",
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      importCollection(ctx, "collection-total", DOCUMENT, 1000);
      importPortfolio(ctx, "portfolio-b", []);
      const event = latestEvent(ctx.db, DOCUMENT);
      assert.equal(event?.estado_nuevo, "PAGADO_TOTAL");
      assert.equal(Number(event?.provisional), 0);
      assert.equal(recovery(ctx.db, DOCUMENT), 1000);
    },
  },
  {
    id: 6,
    name: "desaparición sin evidencia",
    expectedFailure: false,
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      importPortfolio(ctx, "portfolio-b", []);
      const event = latestEvent(ctx.db, DOCUMENT);
      assert.equal(event?.tipo_evento, "DOCUMENTO_DESAPARECIDO");
      assert.equal(event?.estado_nuevo, "PAGADO_TOTAL");
      assert.equal(Number(event?.provisional), 1);
      assert.equal(recovery(ctx.db, DOCUMENT), 0);
    },
  },
  {
    id: 7,
    name: "desaparición + cobro posterior",
    expectedFailure: true,
    defect: "Cobros tardíos buscan sólo documentos vigentes; el movimiento queda pendiente.",
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      importPortfolio(ctx, "portfolio-b", []);
      importCollection(ctx, "collection-late", DOCUMENT, 1000);
      const event = latestEvent(ctx.db, DOCUMENT);
      assert.equal(event?.estado_nuevo, "PAGADO_TOTAL");
      assert.equal(Number(event?.provisional), 0);
      assert.equal(recovery(ctx.db, DOCUMENT), 1000);
    },
  },
  {
    id: 8,
    name: "desaparición + anulación posterior",
    expectedFailure: false,
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      importPortfolio(ctx, "portfolio-b", []);
      importCancellation(ctx, "void-late", DOCUMENT);
      const event = latestEvent(ctx.db, DOCUMENT);
      assert.equal(event?.estado_nuevo, "ANULADO");
      assert.equal(Number(event?.provisional), 0);
      assert.equal(recovery(ctx.db, DOCUMENT), 0);
      assert.equal(eventCount(ctx, "ANULACION_CONFIRMADA"), 1);
    },
  },
  {
    id: 9,
    name: "desaparición + NC posterior",
    expectedFailure: true,
    defect: "NC tardías buscan sólo documentos vigentes y no reclasifican el desaparecido.",
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      importPortfolio(ctx, "portfolio-b", []);
      importCreditNote(ctx, "nc-late", "001-001-000000901", DOCUMENT, 1000);
      const event = latestEvent(ctx.db, DOCUMENT);
      assert.equal(event?.estado_nuevo, "AJUSTADO_NC");
      assert.equal(creditAdjustment(ctx.db, DOCUMENT), 1000);
    },
  },
  {
    id: 10,
    name: "NC parcial",
    expectedFailure: false,
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      importPortfolio(ctx, "portfolio-b", [{ document: DOCUMENT, balance: 800 }]);
      importCreditNote(ctx, "nc-partial", "001-001-000000902", DOCUMENT, 200);
      const row = projected(ctx);
      assert.equal(Number(row?.saldo_pendiente), 800);
      assert.equal(row?.estado_documento, "AJUSTADO_NC");
      assert.equal(creditAdjustment(ctx.db, DOCUMENT), 200);
      assert.equal(recovery(ctx.db, DOCUMENT), 0);
    },
  },
  {
    id: 11,
    name: "cobro + NC sobre el mismo documento",
    expectedFailure: false,
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      importPortfolio(ctx, "portfolio-b", [{ document: DOCUMENT, balance: 600 }]);
      importCollection(ctx, "collection-mixed", DOCUMENT, 300);
      importCreditNote(ctx, "nc-mixed", "001-001-000000903", DOCUMENT, 100);
      const row = projected(ctx);
      assert.equal(Number(row?.saldo_pendiente), 600);
      assert.equal(row?.estado_documento, "AJUSTADO_NC");
      assert.equal(recovery(ctx.db, DOCUMENT), 300);
      assert.equal(creditAdjustment(ctx.db, DOCUMENT), 100);
      assert.equal(eventCount(ctx, "COBRO_CONFIRMADO"), 1);
      assert.equal(eventCount(ctx, "NOTA_CREDITO_APLICADA"), 1);
    },
  },
  {
    id: 12,
    name: "retención fiscal excluida de recuperación",
    expectedFailure: true,
    defect: "La retención se excluye del agregado, pero se registra incorrectamente como COBRO_CONFIRMADO.",
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      importCollection(ctx, "retention", DOCUMENT, 20, { form: "RETENCION FISCAL", detail: "RETENCION" });
      const beforeDisappearance = projected(ctx);
      assert.equal(Number(beforeDisappearance?.saldo_pendiente), 1000);
      assert.equal(beforeDisappearance?.estado_documento, "ACTIVO_PENDIENTE");
      assert.equal(recovery(ctx.db, DOCUMENT), 0);
      assert.equal(eventCount(ctx, "COBRO_CONFIRMADO"), 0);
      assert.equal(eventCount(ctx, "RETENCION_FISCAL_REGISTRADA"), 1);
      importPortfolio(ctx, "portfolio-b", []);
      const disappearance = latestEvent(ctx.db, DOCUMENT);
      assert.equal(disappearance?.estado_nuevo, "PAGADO_TOTAL");
      assert.equal(Number(disappearance?.provisional), 1);
      assert.equal(recovery(ctx.db, DOCUMENT), 0);
    },
  },
  {
    id: 13,
    name: "incremento de saldo",
    expectedFailure: false,
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 700 }]);
      const { result } = importPortfolio(ctx, "portfolio-b", [{ document: DOCUMENT, balance: 900 }]);
      const event = latestEvent(ctx.db, DOCUMENT);
      assert.equal(result.incrementados, 1);
      assert.equal(event?.tipo_evento, "SALDO_INCREMENTADO");
      assert.equal(Number(event?.importe), 200);
      assert.equal(recovery(ctx.db, DOCUMENT), 0);
    },
  },
  {
    id: 14,
    name: "cobro duplicado",
    expectedFailure: false,
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      const first = importCollection(ctx, "collection-duplicate", DOCUMENT, 300);
      reimportCollectionFile(ctx, "collection-duplicate-2", first.filePath);
      assert.equal(Number((ctx.db.prepare("SELECT COUNT(*) AS value FROM cobros_movimientos_importados").get() as { value: number }).value), 1);
      assert.equal(eventCount(ctx, "COBRO_CONFIRMADO"), 1);
      assert.equal(recovery(ctx.db, DOCUMENT), 300);
    },
  },
  {
    id: 15,
    name: "NC duplicada",
    expectedFailure: false,
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 800 }]);
      const first = importCreditNote(ctx, "nc-duplicate", "001-001-000000904", DOCUMENT, 200);
      reimportCreditNoteFile(ctx, "nc-duplicate-2", first.filePath);
      assert.equal(Number((ctx.db.prepare("SELECT COUNT(*) AS value FROM notas_credito_importadas").get() as { value: number }).value), 1);
      assert.equal(eventCount(ctx, "NOTA_CREDITO_APLICADA"), 1);
    },
  },
  {
    id: 16,
    name: "anulado duplicado",
    expectedFailure: false,
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      const first = importCancellation(ctx, "void-duplicate", DOCUMENT);
      reimportCancellationFile(ctx, "void-duplicate-2", first.filePath);
      assert.equal(eventCount(ctx, "ANULACION_CONFIRMADA"), 1);
      assert.equal(Number((ctx.db.prepare("SELECT COUNT(*) AS value FROM documentos_anulados_log").get() as { value: number }).value), 1);
    },
  },
  {
    id: 17,
    name: "cartera duplicada",
    expectedFailure: false,
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      const before = eventCount(ctx);
      const { result } = importPortfolio(ctx, "portfolio-a-copy", [{ document: DOCUMENT, balance: 1000 }]);
      assert.equal(result.eventosGenerados, 0);
      assert.equal(eventCount(ctx), before);
      assert.equal(Number((ctx.db.prepare("SELECT COUNT(*) AS value FROM documentos").get() as { value: number }).value), 1);
    },
  },
  {
    id: 18,
    name: "evidencia tardía sin nueva cartera",
    expectedFailure: true,
    defect: "No hay reconciliador histórico disparado por cobros/NC tardíos sobre documentos ausentes.",
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      importPortfolio(ctx, "portfolio-b", []);
      const snapshotsBefore = Number((ctx.db.prepare("SELECT COUNT(*) AS value FROM cartera_snapshots").get() as { value: number }).value);
      importCollection(ctx, "collection-late-no-portfolio", DOCUMENT, 1000);
      const snapshotsAfter = Number((ctx.db.prepare("SELECT COUNT(*) AS value FROM cartera_snapshots").get() as { value: number }).value);
      const event = latestEvent(ctx.db, DOCUMENT);
      assert.equal(snapshotsAfter, snapshotsBefore);
      assert.equal(Number(event?.provisional), 0);
      assert.equal(recovery(ctx.db, DOCUMENT), 1000);
    },
  },
  {
    id: 19,
    name: "consistencia integral estado/saldo/recuperación/ajuste/anulación/ledger",
    expectedFailure: true,
    defect: "La anulación reclasifica estado/ledger, pero no revierte cobros en el ledger transaccional usado para recuperación.",
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      importCollection(ctx, "collection-before-void", DOCUMENT, 1000);
      assert.equal(recovery(ctx.db, DOCUMENT), 1000);
      importPortfolio(ctx, "portfolio-b", []);
      const cancellation = importCancellation(ctx, "void-after-payment", DOCUMENT);
      const event = latestEvent(ctx.db, DOCUMENT);
      assert.equal(event?.estado_nuevo, "ANULADO");
      assert.equal(Number(event?.provisional), 0);
      assert.equal(recovery(ctx.db, DOCUMENT), 0);
      assert.equal(creditAdjustment(ctx.db, DOCUMENT), 0);
      assert.equal(eventCount(ctx, "ANULACION_CONFIRMADA"), 1);
      assert.equal(eventCount(ctx, "ESTADO_RECLASIFICADO"), 1);
      assert.equal(eventCount(ctx, "COBRO_CONFIRMADO"), 1);
      assert.equal(eventCount(ctx, "RECUPERACION_REVERSADA"), 1);
      assert.equal(Number((ctx.db.prepare(`
        SELECT COUNT(*) AS value
        FROM cobros_movimientos_importados
        WHERE documento_relacionado_normalizado = ?
      `).get(normalized(DOCUMENT)) as { value: number }).value), 1);
      reimportCancellationFile(
        ctx,
        "void-after-payment-duplicate",
        cancellation.filePath,
      );
      assert.equal(eventCount(ctx, "RECUPERACION_REVERSADA"), 1);
      assert.equal(eventCount(ctx, "COBRO_CONFIRMADO"), 1);
      assert.equal(recovery(ctx.db, DOCUMENT), 0);
    },
  },
  {
    id: 20,
    name: "cobro consumido no reutilizable",
    expectedFailure: false,
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      importCollection(ctx, "collection-first-delta", DOCUMENT, 500);
      importPortfolio(ctx, "portfolio-b", [{ document: DOCUMENT, balance: 500 }]);
      importPortfolio(ctx, "portfolio-c", []);
      const event = latestEvent(ctx.db, DOCUMENT);
      assert.equal(event?.estado_nuevo, "PAGADO_TOTAL");
      assert.equal(Number(event?.provisional), 1);
    },
  },
  {
    id: 21,
    name: "dos cobros para dos deltas",
    expectedFailure: false,
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      importCollection(ctx, "collection-first", DOCUMENT, 500);
      importPortfolio(ctx, "portfolio-b", [{ document: DOCUMENT, balance: 500 }]);
      importCollection(ctx, "collection-second", DOCUMENT, 500);
      importPortfolio(ctx, "portfolio-c", []);
      const event = latestEvent(ctx.db, DOCUMENT);
      assert.equal(event?.estado_nuevo, "PAGADO_TOTAL");
      assert.equal(Number(event?.provisional), 0);
      assert.equal(recovery(ctx.db, DOCUMENT), 1000);
    },
  },
  {
    id: 22,
    name: "NC consumida no reutilizable",
    expectedFailure: false,
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      importCreditNote(ctx, "nc-first", "001-001-000000922", DOCUMENT, 400);
      importPortfolio(ctx, "portfolio-b", [{ document: DOCUMENT, balance: 600 }]);
      importPortfolio(ctx, "portfolio-c", []);
      const event = latestEvent(ctx.db, DOCUMENT);
      assert.equal(event?.estado_nuevo, "PAGADO_TOTAL");
      assert.equal(Number(event?.provisional), 1);
    },
  },
  {
    id: 23,
    name: "cobro y NC consumidos no reutilizables",
    expectedFailure: false,
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      importCollection(ctx, "collection-combined", DOCUMENT, 300);
      importCreditNote(ctx, "nc-combined", "001-001-000000923", DOCUMENT, 200);
      importPortfolio(ctx, "portfolio-b", [{ document: DOCUMENT, balance: 500 }]);
      importPortfolio(ctx, "portfolio-c", []);
      const event = latestEvent(ctx.db, DOCUMENT);
      assert.equal(event?.estado_nuevo, "PAGADO_TOTAL");
      assert.equal(Number(event?.provisional), 1);
    },
  },
  {
    id: 24,
    name: "evidencia nueva después del snapshot",
    expectedFailure: false,
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      importCollection(ctx, "collection-300", DOCUMENT, 300);
      importPortfolio(ctx, "portfolio-b", [{ document: DOCUMENT, balance: 700 }]);
      importCollection(ctx, "collection-700", DOCUMENT, 700);
      importPortfolio(ctx, "portfolio-c", []);
      const event = latestEvent(ctx.db, DOCUMENT);
      assert.equal(event?.estado_nuevo, "PAGADO_TOTAL");
      assert.equal(Number(event?.provisional), 0);
    },
  },
  {
    id: 25,
    name: "CRUCE consistente y no monetario",
    expectedFailure: false,
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      importCollection(ctx, "crossing", DOCUMENT, 300, {
        form: "CRUCE",
        detail: "COMPENSACION POR CRUCE",
      });
      assert.equal(recovery(ctx.db, DOCUMENT), 0);
      const detail = getManagementReportDetail(ctx.db, {
        type: "COLLECTIONS_DETAIL",
        filters: { year: 2026, month: 1, movementClass: "CRUCE" },
      });
      assert.equal(detail.totals.total, 0);
      assert.equal(detail.totals.collections, 0);
      assert.equal(detail.totals.crossings, 300);
      assert.equal(Number(detail.rows[0]?.recuperacion_neta), 0);
    },
  },
  {
    id: 26,
    name: "anulación después de evidencia consumida",
    expectedFailure: false,
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      importCollection(ctx, "collection-consumed-before-void", DOCUMENT, 500);
      importPortfolio(ctx, "portfolio-b", [{ document: DOCUMENT, balance: 500 }]);
      const cancellation = importCancellation(ctx, "void-consumed", DOCUMENT);
      assert.equal(projected(ctx)?.estado_documento, "ANULADO");
      assert.equal(recovery(ctx.db, DOCUMENT), 0);
      assert.equal(eventCount(ctx, "COBRO_CONFIRMADO"), 1);
      assert.equal(eventCount(ctx, "RECUPERACION_REVERSADA"), 1);
      reimportCancellationFile(ctx, "void-consumed-copy", cancellation.filePath);
      assert.equal(eventCount(ctx, "RECUPERACION_REVERSADA"), 1);
      assert.equal(Number((ctx.db.prepare(`
        SELECT COUNT(*) AS value FROM cobros_movimientos_importados
        WHERE documento_relacionado_normalizado = ?
      `).get(normalized(DOCUMENT)) as { value: number }).value), 1);
    },
  },
  {
    id: 27,
    name: "cobro parcialmente consumido en dos deltas",
    expectedFailure: false,
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      importCollection(ctx, "collection-800", DOCUMENT, 800);
      importPortfolio(ctx, "portfolio-b", [{ document: DOCUMENT, balance: 500 }]);
      importPortfolio(ctx, "portfolio-c", [{ document: DOCUMENT, balance: 200 }]);
      const [first, second] = balanceIds(ctx);
      assert.equal(attributed(ctx, { balanceId: first }), 500);
      assert.equal(attributed(ctx, { balanceId: second }), 300);
      assert.equal(attributed(ctx, { kind: "COBRO" }), 800);
    },
  },
  {
    id: 28,
    name: "cobro mayor al delta",
    expectedFailure: false,
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      importCollection(ctx, "collection-1500", DOCUMENT, 1500);
      importPortfolio(ctx, "portfolio-b", [{ document: DOCUMENT, balance: 400 }]);
      assert.equal(attributed(ctx, { kind: "COBRO" }), 600);
      assert.equal(1500 - attributed(ctx, { kind: "COBRO" }), 900);
    },
  },
  {
    id: 29,
    name: "evidencia insuficiente no reutilizable",
    expectedFailure: false,
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      importCollection(ctx, "collection-300-insufficient", DOCUMENT, 300);
      importPortfolio(ctx, "portfolio-b", [{ document: DOCUMENT, balance: 500 }]);
      assert.equal(attributed(ctx, { kind: "COBRO" }), 300);
      importPortfolio(ctx, "portfolio-c", []);
      assert.equal(attributed(ctx, { kind: "COBRO" }), 300);
      assert.equal(Number(latestEvent(ctx.db, DOCUMENT)?.provisional), 1);
    },
  },
  {
    id: 30,
    name: "idempotencia directa de atribución",
    expectedFailure: false,
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      importCollection(ctx, "collection-idempotent", DOCUMENT, 500);
      importPortfolio(ctx, "portfolio-b", [{ document: DOCUMENT, balance: 500 }]);
      const beforeEvents = eventCount(ctx, "EVIDENCIA_ATRIBUIDA_DELTA");
      const beforeAmount = attributed(ctx);
      const first = reconcileDocumentHistory(ctx.db, normalized(DOCUMENT));
      const second = reconcileDocumentHistory(ctx.db, normalized(DOCUMENT));
      assert.equal(first.result?.estado, second.result?.estado);
      assert.equal(eventCount(ctx, "EVIDENCIA_ATRIBUIDA_DELTA"), beforeEvents);
      assert.equal(attributed(ctx), beforeAmount);
      assert.equal(Number(projected(ctx)?.saldo_pendiente), 500);
    },
  },
  {
    id: 31,
    name: "NC parcialmente consumida en dos deltas",
    expectedFailure: false,
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      importCreditNote(ctx, "nc-800", "001-001-000000931", DOCUMENT, 800);
      importPortfolio(ctx, "portfolio-b", [{ document: DOCUMENT, balance: 500 }]);
      importPortfolio(ctx, "portfolio-c", [{ document: DOCUMENT, balance: 200 }]);
      const [first, second] = balanceIds(ctx);
      assert.equal(attributed(ctx, { kind: "NOTA_CREDITO", balanceId: first }), 500);
      assert.equal(attributed(ctx, { kind: "NOTA_CREDITO", balanceId: second }), 300);
      assert.equal(attributed(ctx, { kind: "NOTA_CREDITO" }), 800);
    },
  },
  {
    id: 32,
    name: "múltiples evidencias para un delta",
    expectedFailure: false,
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      importCollection(ctx, "collection-200", DOCUMENT, 200);
      importCollection(ctx, "collection-150", DOCUMENT, 150);
      importCreditNote(ctx, "nc-100", "001-001-000000932", DOCUMENT, 100);
      importPortfolio(ctx, "portfolio-b", [{ document: DOCUMENT, balance: 550 }]);
      assert.equal(attributed(ctx), 450);
      const [balanceId] = balanceIds(ctx);
      assert.equal(attributed(ctx, { balanceId }), 450);
    },
  },
  {
    id: 33,
    name: "orden alternativo de evidencia tardía",
    expectedFailure: false,
    run: (ctx) => {
      importPortfolio(ctx, "portfolio-a", [{ document: DOCUMENT, balance: 1000 }]);
      importPortfolio(ctx, "portfolio-b", [{ document: DOCUMENT, balance: 500 }]);
      importCollection(ctx, "collection-late-order", DOCUMENT, 500);
      reconcileDocumentHistory(ctx.db, normalized(DOCUMENT));
      assert.equal(projected(ctx)?.estado_documento, "ABONADO_PARCIAL");
      assert.equal(attributed(ctx, { kind: "COBRO" }), 500);
      assert.equal(eventCount(ctx, "EVIDENCIA_ATRIBUIDA_DELTA"), 1);
    },
  },
  {
    id: 34,
    name: "upgrade pre-B4 bloquea evidencia histórica",
    expectedFailure: false,
    run: (ctx) => {
      importPortfolio(ctx, "legacy-a", [{ document: DOCUMENT, balance: 1000 }]);
      importCollection(ctx, "legacy-collection", DOCUMENT, 500);
      importPortfolio(ctx, "legacy-b", [{ document: DOCUMENT, balance: 500 }]);

      // Simula el ledger anterior a B4: conserva cobro, saldo y eventos de
      // dominio, pero aún no existen marcador ni atribuciones explícitas.
      ctx.db.prepare(`DELETE FROM documento_eventos WHERE tipo_evento = ?`).run(
        "EVIDENCIA_ATRIBUIDA_DELTA",
      );
      ctx.db.prepare(`DELETE FROM documento_eventos WHERE event_key = ?`).run(
        EVIDENCE_ATTRIBUTION_ACTIVATION_EVENT_KEY,
      );
      const activation = ensureEvidenceAttributionBaseline(ctx.db);
      assert.equal(activation.activated, true);
      assert.equal(activation.baselineEvents, 1);

      importPortfolio(ctx, "post-upgrade", []);
      assert.equal(Number(latestEvent(ctx.db, DOCUMENT)?.provisional), 1);
      assert.equal(attributed(ctx), 0);
      assert.equal(eventCount(ctx, "EVIDENCIA_BASELINE_B4"), 1);
    },
  },
  {
    id: 35,
    name: "baseline masivo 10k",
    expectedFailure: false,
    run: (ctx) => {
      ctx.db.prepare(`DELETE FROM documento_eventos WHERE event_key = ?`).run(
        EVIDENCE_ATTRIBUTION_ACTIVATION_EVENT_KEY,
      );
      const insertCollection = ctx.db.prepare(`
        INSERT INTO cobros_movimientos_importados (
          movimiento_key, tipo_fuente, documento_relacionado_normalizado,
          valor, clase_movimiento, estado_conciliacion
        ) VALUES (?, 'COBRO', ?, 10, ?, ?)
      `);
      const insertCreditNote = ctx.db.prepare(`
        INSERT INTO notas_credito_importadas (
          numero_nc, numero_nc_normalizado,
          documento_relacionado_normalizado, total_nc, estado_conciliacion
        ) VALUES (?, ?, ?, 10, ?)
      `);
      ctx.db.transaction(() => {
        for (let index = 0; index < 5000; index += 1) {
          const documentKey = String(9000000000000 + (index % 1000));
          insertCollection.run(
            `bulk-collection-${index}`,
            documentKey,
            index % 10 === 0 ? "CRUCE" : "COBRO",
            index % 11 === 0 ? "PENDIENTE_CONCILIACION" : "CONCILIADO",
          );
          const note = String(8000000000000 + index);
          insertCreditNote.run(
            note,
            note,
            documentKey,
            index % 13 === 0 ? "PENDIENTE_CONCILIACION" : "CONCILIADA",
          );
        }
      })();

      const eligible = Number((ctx.db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM cobros_movimientos_importados
           WHERE clase_movimiento = 'COBRO'
             AND estado_conciliacion = 'CONCILIADO') +
          (SELECT COUNT(*) FROM notas_credito_importadas
           WHERE estado_conciliacion = 'CONCILIADA') AS value
      `).get() as { value: number }).value);
      const firstStarted = performance.now();
      const first = ensureEvidenceAttributionBaseline(ctx.db);
      const firstActivationMs = performance.now() - firstStarted;
      const secondStarted = performance.now();
      const second = ensureEvidenceAttributionBaseline(ctx.db);
      const secondActivationMs = performance.now() - secondStarted;

      assert.equal(first.baselineEvents, eligible);
      assert.equal(eventCount(ctx, "EVIDENCIA_BASELINE_B4"), eligible);
      assert.equal(second.activated, false);
      assert.equal(second.baselineEvents, 0);
      assert.equal(eventCount(ctx, "EVIDENCIA_BASELINE_B4"), eligible);
      baselineBenchmark = {
        evidence: 10000,
        firstActivationMs,
        secondActivationMs,
      };
    },
  },
];

type Result = {
  id: number;
  scenario: string;
  status: "PASS" | "EXPECTED FAIL" | "UNEXPECTED FAIL";
  detail: string;
};

const results: Result[] = [];

for (const scenario of scenarios) {
  const context = createScenarioContext(`scenario-${scenario.id}`);
  try {
    scenario.run(context);
    assertAttributionInvariants(context);
    results.push({
      id: scenario.id,
      scenario: scenario.name,
      status: "PASS",
      detail: scenario.expectedFailure
        ? "La regla esperada ya se cumple; revisar si el defecto fue corregido."
        : "Comportamiento conforme al dominio.",
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    results.push({
      id: scenario.id,
      scenario: scenario.name,
      status: scenario.expectedFailure ? "EXPECTED FAIL" : "UNEXPECTED FAIL",
      detail: scenario.expectedFailure ? `${scenario.defect} | ${detail}` : detail,
    });
  } finally {
    context.close();
  }
}

console.log("\nZENITH CARTERA - REGRESION DEL MOTOR DE CONCILIACION\n");
console.table(results);

const totals = {
  PASS: results.filter((item) => item.status === "PASS").length,
  EXPECTED_FAIL: results.filter((item) => item.status === "EXPECTED FAIL").length,
  UNEXPECTED_FAIL: results.filter((item) => item.status === "UNEXPECTED FAIL").length,
};

console.log("INTEGRATION_RESULT_JSON=" + JSON.stringify({ totals, results }));
console.log("BASELINE_BENCHMARK_JSON=" + JSON.stringify(baselineBenchmark));

if (totals.UNEXPECTED_FAIL > 0) {
  process.exitCode = 1;
}
