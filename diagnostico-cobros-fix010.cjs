const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

console.log("\n=== 1. BATCHES VS IMPORTACIONES ===");

console.log(
  db.prepare(`
    SELECT
      b.id AS batch_id,
      b.periodo_desde,
      b.periodo_hasta,
      b.registros_leidos,
      b.registros_in_scope,
      b.registros_ignorados AS batch_ignorados,
      b.registros_legacy,
      i.id AS importacion_id,
      i.registros_importados,
      i.registros_ignorados AS importacion_ignorados,
      i.registros_duplicados
    FROM historical_bootstrap_batches b
    LEFT JOIN importaciones i
      ON i.tipo = 'COBROS_MOVIMIENTOS'
     AND i.reconciliation_generation = b.generation
     AND i.periodo_desde = b.periodo_desde
     AND i.periodo_hasta = b.periodo_hasta
    WHERE b.fuente = 'COBROS_MOVIMIENTOS'
    ORDER BY b.periodo_desde
  `).all()
);

console.log("\n=== 2. EVENTOS CON POSIBLE FECHA INCORRECTA ===");

const inconsistencias = db.prepare(`
  SELECT
    e.id AS evento_id,
    e.importacion_id,
    e.documento_normalizado,
    e.referencia_externa,
    e.importe,
    e.ocurrido_en AS fecha_evento,
    m.fecha_movimiento,
    m.documento_relacionado,
    m.clase_movimiento,
    m.valor
  FROM documento_eventos e
  JOIN cobros_movimientos_importados m
    ON m.documento_relacionado_normalizado = e.documento_normalizado
   AND ABS(COALESCE(m.valor,0) - COALESCE(e.importe,0)) < 0.005
  WHERE e.fuente = 'COBROS_MOVIMIENTOS'
    AND e.tipo_evento = 'COBRO_CONFIRMADO'
    AND COALESCE(m.fecha_movimiento,'') <> ''
    AND e.ocurrido_en <> m.fecha_movimiento
  ORDER BY e.id, m.fecha_movimiento
`).all();

console.log(inconsistencias);
console.log("TOTAL:", inconsistencias.length);

console.log("\n=== 3. EVENTOS POR IMPORTACION ===");

console.log(
  db.prepare(`
    SELECT
      e.importacion_id,
      COUNT(*) AS eventos,
      MIN(e.ocurrido_en) AS desde,
      MAX(e.ocurrido_en) AS hasta
    FROM documento_eventos e
    WHERE e.fuente = 'COBROS_MOVIMIENTOS'
      AND e.tipo_evento = 'COBRO_CONFIRMADO'
    GROUP BY e.importacion_id
    ORDER BY e.importacion_id
  `).all()
);

console.log("\n=== 4. ESTRUCTURA COBROS_MOVIMIENTOS_IMPORTADOS ===");

console.log(
  db.prepare(`
    PRAGMA table_info(cobros_movimientos_importados)
  `).all()
);

console.log("\n=== 5. ESTRUCTURA DOCUMENTO_EVENTOS ===");

console.log(
  db.prepare(`
    PRAGMA table_info(documento_eventos)
  `).all()
);

db.close();
