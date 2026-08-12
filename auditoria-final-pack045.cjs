const Database = require("better-sqlite3");

const DB_PATH = String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`;
const db = new Database(DB_PATH, { readonly: true });

let failures = 0;
let warnings = 0;

function check(name, condition, detail) {
  const status = condition ? "PASS" : "FAIL";
  if (!condition) failures++;

  console.log(
    `[${status}] ${name}` +
    (detail !== undefined ? ` -> ${JSON.stringify(detail)}` : "")
  );
}

function warn(name, condition, detail) {
  const status = condition ? "PASS" : "WARN";
  if (!condition) warnings++;

  console.log(
    `[${status}] ${name}` +
    (detail !== undefined ? ` -> ${JSON.stringify(detail)}` : "")
  );
}

function scalar(sql, params = []) {
  const row = db.prepare(sql).get(...params);
  if (!row) return 0;

  const value = Object.values(row)[0];
  return Number(value ?? 0);
}

console.log("============================================================");
console.log(" AUDITORIA FINAL PACK-045");
console.log("============================================================");
console.log("DB:", DB_PATH);
console.log("");

// ------------------------------------------------------------
// 1. CONTROL DE RECONCILIACION
// ------------------------------------------------------------

console.log("=== 1. CONTROL ===");

const control = db.prepare(`
  SELECT *
  FROM reconciliation_control
  WHERE id = 1
`).get();

console.log(control);

check(
  "Control de reconciliacion existente",
  Boolean(control),
  control
);

check(
  "Modo previo al cierre = HISTORICAL_LOAD",
  control?.mode === "HISTORICAL_LOAD",
  control?.mode
);

check(
  "Cutoff historico = 2024-01-01",
  control?.cutoff_date === "2024-01-01",
  control?.cutoff_date
);

// ------------------------------------------------------------
// 2. SNAPSHOT ACTUAL CONTIFICO
// ------------------------------------------------------------

console.log("\n=== 2. CARTERA CONTIFICO ===");

const cartera = db.prepare(`
  SELECT
    COUNT(*) AS filas_reales,
    ROUND(SUM(COALESCE(total,0)),2) AS total_snapshot,
    ROUND(SUM(
      CASE
        WHEN COALESCE(total,0) > 0
         AND COALESCE(posicion_cartera,'DEUDA_VIVA') = 'DEUDA_VIVA'
         AND COALESCE(estado_documento,'ACTIVO') <> 'ANULADO'
        THEN total
        ELSE 0
      END
    ),2) AS deuda_operativa,
    ROUND(ABS(SUM(
      CASE
        WHEN COALESCE(posicion_cartera,'DEUDA_VIVA') = 'CREDITO_VIVO'
         AND COALESCE(total,0) < 0
         AND COALESCE(estado_documento,'ACTIVO') <> 'ANULADO'
        THEN total
        ELSE 0
      END
    )),2) AS creditos_vivos
  FROM documentos
  WHERE is_subtotal = 0
`).get();

console.log(cartera);

check(
  "Total snapshot Contifico = 912706.94",
  Math.abs(Number(cartera?.total_snapshot) - 912706.94) < 0.005,
  cartera?.total_snapshot
);

check(
  "Deuda operativa = 911657.88",
  Math.abs(Number(cartera?.deuda_operativa) - 911657.88) < 0.005,
  cartera?.deuda_operativa
);

check(
  "Creditos vivos = 796.40",
  Math.abs(Number(cartera?.creditos_vivos) - 796.40) < 0.005,
  cartera?.creditos_vivos
);

// ------------------------------------------------------------
// 3. BATCHES HISTORICOS
// ------------------------------------------------------------

console.log("\n=== 3. BATCHES HISTORICOS ===");

const batches = db.prepare(`
  SELECT
    fuente,
    COUNT(*) AS batches,
    SUM(registros_leidos) AS leidos,
    SUM(registros_in_scope) AS in_scope,
    SUM(COALESCE(registros_ignorados,0)) AS ignorados,
    SUM(registros_legacy) AS legacy
  FROM historical_bootstrap_batches
  GROUP BY fuente
  ORDER BY fuente
`).all();

console.table(batches);

const incompleteBatches = scalar(`
  SELECT COUNT(*)
  FROM historical_bootstrap_batches
  WHERE estado <> 'COMPLETADO'
`);

check(
  "Todos los batches historicos COMPLETADOS",
  incompleteBatches === 0,
  { incompletos: incompleteBatches }
);

// ------------------------------------------------------------
// 4. INVARIANTE COBROS
// ------------------------------------------------------------

console.log("\n=== 4. COBROS / MOVIMIENTOS ===");

const collectionTotals = db.prepare(`
  SELECT
    COUNT(*) AS batches,
    SUM(b.registros_leidos) AS leidos,
    SUM(b.registros_in_scope) AS in_scope,
    SUM(COALESCE(b.registros_ignorados,0)) AS ignorados,
    SUM(b.registros_legacy) AS legacy,
    SUM(COALESCE(i.registros_duplicados,0)) AS duplicados
  FROM historical_bootstrap_batches b
  JOIN importaciones i
    ON i.tipo = 'COBROS_MOVIMIENTOS'
   AND i.reconciliation_generation = b.generation
   AND i.periodo_desde = b.periodo_desde
   AND i.periodo_hasta = b.periodo_hasta
  WHERE b.fuente = 'COBROS_MOVIMIENTOS'
`).get();

console.log(collectionTotals);

const collectionReconstructed =
  Number(collectionTotals?.in_scope ?? 0) +
  Number(collectionTotals?.ignorados ?? 0) +
  Number(collectionTotals?.legacy ?? 0) +
  Number(collectionTotals?.duplicados ?? 0);

check(
  "Cobros: leidos = in_scope + ignorados + legacy + duplicados",
  Number(collectionTotals?.leidos) === collectionReconstructed,
  {
    leidos: collectionTotals?.leidos,
    reconstruido: collectionReconstructed
  }
);

check(
  "Cobros legacy = 0 para dataset >= cutoff",
  Number(collectionTotals?.legacy ?? 0) === 0,
  collectionTotals?.legacy
);

// ------------------------------------------------------------
// 5. FECHA EFECTIVA DE COBROS
// ------------------------------------------------------------

console.log("\n=== 5. FECHA EFECTIVA COBROS ===");

const badCollectionDates = scalar(`
  SELECT COUNT(*)
  FROM documento_eventos e
  JOIN cobros_movimientos_importados m
    ON m.documento_relacionado_normalizado = e.documento_normalizado
   AND ABS(COALESCE(m.valor,0) - COALESCE(e.importe,0)) < 0.005
  WHERE e.fuente = 'COBROS_MOVIMIENTOS'
    AND e.tipo_evento = 'COBRO_CONFIRMADO'
    AND COALESCE(m.fecha_movimiento,'') <> ''
    AND e.ocurrido_en <> m.fecha_movimiento
`);

check(
  "COBRO_CONFIRMADO usa fecha_movimiento efectiva",
  badCollectionDates === 0,
  { inconsistencias: badCollectionDates }
);

// ------------------------------------------------------------
// 6. FECHA EFECTIVA NOTAS DE CREDITO
// ------------------------------------------------------------

console.log("\n=== 6. FECHA EFECTIVA NOTAS DE CREDITO ===");

const badCreditNoteDates = scalar(`
  SELECT COUNT(*)
  FROM documento_eventos e
  JOIN notas_credito_importadas n
    ON n.numero_nc = e.referencia_externa
  WHERE e.fuente = 'NOTAS_CREDITO'
    AND e.tipo_evento = 'NOTA_CREDITO_APLICADA'
    AND TRIM(COALESCE(n.fecha_nc,'')) <> ''
    AND e.ocurrido_en <> n.fecha_nc
`);

check(
  "NOTA_CREDITO_APLICADA usa fecha_nc efectiva",
  badCreditNoteDates === 0,
  { inconsistencias: badCreditNoteDates }
);

// ------------------------------------------------------------
// 7. ANULACIONES
// ------------------------------------------------------------

console.log("\n=== 7. ANULACIONES ===");

const badCancellationDates = scalar(`
  SELECT COUNT(*)
  FROM documento_eventos e
  JOIN documentos d
    ON d.documento_normalizado = e.documento_normalizado
  WHERE e.fuente = 'ANULADOS'
    AND e.tipo_evento IN (
      'ANULACION_CONFIRMADA',
      'ESTADO_RECLASIFICADO'
    )
    AND TRIM(COALESCE(d.fecha_anulacion,'')) <> ''
    AND e.ocurrido_en <> d.fecha_anulacion
`);

check(
  "Anulaciones usan fecha efectiva",
  badCancellationDates === 0,
  { inconsistencias: badCancellationDates }
);

// ------------------------------------------------------------
// 8. IMPORTACIONES CON ERROR
// ------------------------------------------------------------

console.log("\n=== 8. IMPORTACIONES ===");

const importErrors = db.prepare(`
  SELECT
    id,
    tipo,
    archivo_nombre,
    estado,
    importado_en
  FROM importaciones
  WHERE estado = 'ERROR'
  ORDER BY id
`).all();

console.table(importErrors);

check(
  "No existen importaciones ERROR activas",
  importErrors.length === 0,
  { cantidad: importErrors.length }
);

// ------------------------------------------------------------
// 9. DUPLICIDAD DE EVENTOS
// ------------------------------------------------------------

console.log("\n=== 9. EVENTOS DUPLICADOS ===");

const duplicateEvents = db.prepare(`
  SELECT
    fuente,
    tipo_evento,
    documento_normalizado,
    referencia_externa,
    importe,
    ocurrido_en,
    COUNT(*) AS cantidad
  FROM documento_eventos
  WHERE fuente IN (
    'COBROS_MOVIMIENTOS',
    'NOTAS_CREDITO',
    'ANULADOS'
  )
  GROUP BY
    fuente,
    tipo_evento,
    documento_normalizado,
    referencia_externa,
    importe,
    ocurrido_en
  HAVING COUNT(*) > 1
  ORDER BY cantidad DESC
`).all();

console.table(duplicateEvents);

check(
  "Sin eventos historicos exactamente duplicados",
  duplicateEvents.length === 0,
  { gruposDuplicados: duplicateEvents.length }
);

// ------------------------------------------------------------
// 10. INVARIANTES DOCUMENTOS
// ------------------------------------------------------------

console.log("\n=== 10. INVARIANTES DOCUMENTOS ===");

const subtotalContamination = scalar(`
  SELECT COUNT(*)
  FROM documentos
  WHERE is_subtotal = 1
    AND (
      COALESCE(posicion_cartera,'') IN ('DEUDA_VIVA','CREDITO_VIVO')
      OR COALESCE(saldo_pendiente,0) <> 0
    )
`);

warn(
  "Subtotales sin contaminacion operativa",
  subtotalContamination === 0,
  { sospechosos: subtotalContamination }
);

const activeCancelled = scalar(`
  SELECT COUNT(*)
  FROM documentos
  WHERE is_subtotal = 0
    AND COALESCE(anulado,0) = 1
    AND COALESCE(estado_documento,'') <> 'ANULADO'
`);

check(
  "Documentos marcados anulado tienen estado ANULADO",
  activeCancelled === 0,
  { inconsistencias: activeCancelled }
);

// ------------------------------------------------------------
// RESULTADO
// ------------------------------------------------------------

console.log("\n============================================================");

if (failures === 0) {
  console.log(" RESULTADO PACK-045: PASS");
} else {
  console.log(` RESULTADO PACK-045: FAIL (${failures} fallo(s))`);
}

console.log(` Advertencias informativas: ${warnings}`);
console.log("============================================================");

db.close();

process.exitCode = failures === 0 ? 0 : 1;
