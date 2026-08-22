import assert from "node:assert/strict";

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
      importPortfolio(ctx, "portfolio-b", []);
      importCancellation(ctx, "void-after-payment", DOCUMENT);
      const event = latestEvent(ctx.db, DOCUMENT);
      assert.equal(event?.estado_nuevo, "ANULADO");
      assert.equal(Number(event?.provisional), 0);
      assert.equal(recovery(ctx.db, DOCUMENT), 0);
      assert.equal(creditAdjustment(ctx.db, DOCUMENT), 0);
      assert.equal(eventCount(ctx, "ANULACION_CONFIRMADA"), 1);
      assert.equal(eventCount(ctx, "ESTADO_RECLASIFICADO"), 1);
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

if (totals.UNEXPECTED_FAIL > 0) {
  process.exitCode = 1;
}
