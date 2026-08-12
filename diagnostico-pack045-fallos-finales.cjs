const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

console.log("\n=== 1. BATCHES COBROS VS IMPORTACIONES ===");

console.table(
  db.prepare(`
    SELECT
      b.id AS batch_id,
      b.generation,
      b.periodo_desde,
      b.periodo_hasta,
      b.registros_leidos,
      b.registros_in_scope,
      b.registros_ignorados AS batch_ignorados,
      b.registros_legacy,
      i.id AS importacion_id,
      i.registros_importados,
      i.registros_ignorados AS import_ignorados,
      i.registros_duplicados
    FROM historical_bootstrap_batches b
    JOIN importaciones i
      ON i.tipo = 'COBROS_MOVIMIENTOS'
     AND i.reconciliation_generation = b.generation
     AND i.periodo_desde = b.periodo_desde
     AND i.periodo_hasta = b.periodo_hasta
    WHERE b.fuente = 'COBROS_MOVIMIENTOS'
    ORDER BY b.periodo_desde
  `).all()
);

console.log("\n=== 2. TOTALES IMPORTACIONES COBROS ===");

console.log(
  db.prepare(`
    SELECT
      SUM(registros_leidos) AS leidos,
      SUM(registros_importados) AS importados,
      SUM(registros_ignorados) AS ignorados,
      SUM(registros_duplicados) AS duplicados
    FROM importaciones
    WHERE tipo = 'COBROS_MOVIMIENTOS'
      AND estado IN ('COMPLETADA','COMPLETADA_ADVERTENCIAS')
  `).get()
);

console.log("\n=== 3. EVENTOS COBRO_CONFIRMADO ===");

console.log(
  db.prepare(`
    SELECT
      COUNT(*) AS eventos,
      MIN(ocurrido_en) AS fecha_min,
      MAX(ocurrido_en) AS fecha_max,
      ROUND(SUM(COALESCE(importe,0)),2) AS importe
    FROM documento_eventos
    WHERE fuente = 'COBROS_MOVIMIENTOS'
      AND tipo_evento = 'COBRO_CONFIRMADO'
  `).get()
);

console.log("\n=== 4. EVENTOS CON IMPORTACION_ID ===");

console.table(
  db.prepare(`
    SELECT
      e.id AS evento_id,
      e.importacion_id,
      e.documento_normalizado,
      e.referencia_externa,
      e.importe,
      e.ocurrido_en,
      i.periodo_desde,
      i.periodo_hasta
    FROM documento_eventos e
    LEFT JOIN importaciones i
      ON i.id = e.importacion_id
    WHERE e.fuente = 'COBROS_MOVIMIENTOS'
      AND e.tipo_evento = 'COBRO_CONFIRMADO'
    ORDER BY e.ocurrido_en, e.id
  `).all()
);

console.log("\n=== 5. MATCH POR IMPORTACION + DOCUMENTO + VALOR ===");

const matches = db.prepare(`
  SELECT
    e.id AS evento_id,
    e.importacion_id,
    e.documento_normalizado,
    e.referencia_externa,
    e.importe,
    e.ocurrido_en AS fecha_evento,

    m.id AS movimiento_id,
    m.fecha_movimiento,
    m.valor,
    m.clase_movimiento,

    CASE
      WHEN e.ocurrido_en = m.fecha_movimiento THEN 'OK'
      ELSE 'DIFERENTE'
    END AS resultado

  FROM documento_eventos e

  JOIN cobros_movimientos_importados m
    ON m.importacion_id = e.importacion_id
   AND m.documento_relacionado_normalizado = e.documento_normalizado
   AND ABS(COALESCE(m.valor,0) - COALESCE(e.importe,0)) < 0.005

  WHERE e.fuente = 'COBROS_MOVIMIENTOS'
    AND e.tipo_evento = 'COBRO_CONFIRMADO'

  ORDER BY e.id, m.fecha_movimiento
`).all();

console.table(matches);

console.log("\n=== 6. RESUMEN MATCH EXACTO ===");

const resumen = matches.reduce(
  (acc, row) => {
    acc.total++;

    if (row.resultado === "OK") {
      acc.ok++;
    } else {
      acc.diferentes++;
    }

    return acc;
  },
  { total: 0, ok: 0, diferentes: 0 }
);

console.log(resumen);

console.log("\n=== 7. EVENTOS CON MULTIPLES CANDIDATOS ===");

console.table(
  db.prepare(`
    SELECT
      e.id AS evento_id,
      e.importacion_id,
      e.documento_normalizado,
      e.importe,
      e.ocurrido_en,
      COUNT(m.id) AS candidatos
    FROM documento_eventos e
    JOIN cobros_movimientos_importados m
      ON m.importacion_id = e.importacion_id
     AND m.documento_relacionado_normalizado = e.documento_normalizado
     AND ABS(COALESCE(m.valor,0) - COALESCE(e.importe,0)) < 0.005
    WHERE e.fuente = 'COBROS_MOVIMIENTOS'
      AND e.tipo_evento = 'COBRO_CONFIRMADO'
    GROUP BY e.id
    HAVING COUNT(m.id) > 1
    ORDER BY candidatos DESC
  `).all()
);

console.log("\n=== 8. DIFERENCIAS REALES POR IMPORTACION ===");

console.table(
  db.prepare(`
    SELECT
      e.id AS evento_id,
      e.importacion_id,
      e.documento_normalizado,
      e.referencia_externa,
      e.importe,
      e.ocurrido_en AS fecha_evento,

      MIN(m.fecha_movimiento) AS movimiento_min,
      MAX(m.fecha_movimiento) AS movimiento_max,

      SUM(
        CASE
          WHEN m.fecha_movimiento = e.ocurrido_en
          THEN 1
          ELSE 0
        END
      ) AS candidatos_fecha_correcta,

      COUNT(m.id) AS candidatos

    FROM documento_eventos e

    JOIN cobros_movimientos_importados m
      ON m.importacion_id = e.importacion_id
     AND m.documento_relacionado_normalizado = e.documento_normalizado
     AND ABS(COALESCE(m.valor,0) - COALESCE(e.importe,0)) < 0.005

    WHERE e.fuente = 'COBROS_MOVIMIENTOS'
      AND e.tipo_evento = 'COBRO_CONFIRMADO'

    GROUP BY e.id

    HAVING candidatos_fecha_correcta = 0

    ORDER BY e.id
  `).all()
);

db.close();
