const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

console.log("\n=== 1. IMPORTACIONES COBROS ===");

console.log(
  db.prepare(`
    SELECT
      id,
      archivo_nombre,
      periodo_desde,
      periodo_hasta,
      registros_leidos,
      registros_importados,
      registros_ignorados,
      registros_duplicados,
      estado,
      reconciliation_generation
    FROM importaciones
    WHERE tipo = 'COBROS_MOVIMIENTOS'
    ORDER BY periodo_desde, id
  `).all()
);

console.log("\n=== 2. TOTALES CONSOLIDADOS IMPORTACIONES ===");

console.log(
  db.prepare(`
    SELECT
      COUNT(*) AS archivos,
      SUM(registros_leidos) AS registros_leidos,
      SUM(registros_importados) AS registros_importados,
      SUM(registros_ignorados) AS registros_ignorados,
      SUM(registros_duplicados) AS registros_duplicados,
      MIN(periodo_desde) AS fecha_minima,
      MAX(periodo_hasta) AS fecha_maxima
    FROM importaciones
    WHERE tipo = 'COBROS_MOVIMIENTOS'
      AND estado IN ('COMPLETADA','COMPLETADA_ADVERTENCIAS')
  `).get()
);

console.log("\n=== 3. BATCHES HISTORICOS COBROS ===");

console.log(
  db.prepare(`
    SELECT
      id,
      generation,
      fuente,
      periodo_desde,
      periodo_hasta,
      estado,
      registros_leidos,
      registros_in_scope,
      registros_ignorados,
      registros_legacy
    FROM historical_bootstrap_batches
    WHERE fuente = 'COBROS_MOVIMIENTOS'
    ORDER BY periodo_desde, id
  `).all()
);

console.log("\n=== 4. TOTALES BATCHES ===");

console.log(
  db.prepare(`
    SELECT
      COUNT(*) AS batches,
      SUM(registros_leidos) AS registros_leidos,
      SUM(registros_in_scope) AS registros_in_scope,
      SUM(registros_ignorados) AS registros_ignorados,
      SUM(registros_legacy) AS registros_legacy,
      MIN(periodo_desde) AS fecha_minima,
      MAX(periodo_hasta) AS fecha_maxima
    FROM historical_bootstrap_batches
    WHERE fuente = 'COBROS_MOVIMIENTOS'
      AND estado = 'COMPLETADO'
  `).get()
);

console.log("\n=== 5. MOVIMIENTOS PERSISTIDOS ===");

console.log(
  db.prepare(`
    SELECT
      COUNT(*) AS movimientos,
      MIN(fecha_movimiento) AS fecha_minima,
      MAX(fecha_movimiento) AS fecha_maxima,
      ROUND(SUM(COALESCE(valor,0)),2) AS valor_total
    FROM cobros_movimientos_importados
  `).get()
);

console.log("\n=== 6. DISTRIBUCION POR CLASE ===");

console.log(
  db.prepare(`
    SELECT
      clase_movimiento,
      COUNT(*) AS cantidad,
      ROUND(SUM(COALESCE(valor,0)),2) AS valor
    FROM cobros_movimientos_importados
    GROUP BY clase_movimiento
    ORDER BY clase_movimiento
  `).all()
);

console.log("\n=== 7. ESTADOS DE CONCILIACION ===");

console.log(
  db.prepare(`
    SELECT
      estado_conciliacion,
      COUNT(*) AS cantidad,
      ROUND(SUM(COALESCE(valor,0)),2) AS valor
    FROM cobros_movimientos_importados
    GROUP BY estado_conciliacion
    ORDER BY estado_conciliacion
  `).all()
);

console.log("\n=== 8. EVENTOS COBROS ===");

console.log(
  db.prepare(`
    SELECT
      tipo_evento,
      COUNT(*) AS cantidad,
      ROUND(SUM(COALESCE(importe,0)),2) AS importe,
      MIN(ocurrido_en) AS fecha_minima,
      MAX(ocurrido_en) AS fecha_maxima
    FROM documento_eventos
    WHERE fuente = 'COBROS_MOVIMIENTOS'
    GROUP BY tipo_evento
    ORDER BY tipo_evento
  `).all()
);

console.log("\n=== 9. INVARIANTE FECHA EFECTIVA ===");

console.log(
  db.prepare(`
    SELECT COUNT(*) AS inconsistencias
    FROM documento_eventos e
    JOIN cobros_movimientos_importados m
      ON m.documento_relacionado_normalizado = e.documento_normalizado
     AND ABS(COALESCE(m.valor,0) - COALESCE(e.importe,0)) < 0.005
    WHERE e.fuente = 'COBROS_MOVIMIENTOS'
      AND e.tipo_evento = 'COBRO_CONFIRMADO'
      AND COALESCE(m.fecha_movimiento,'') <> ''
      AND e.ocurrido_en <> m.fecha_movimiento
  `).get()
);

console.log("\n=== 10. OTROS RESIDUALES ===");

console.log(
  db.prepare(`
    SELECT
      COUNT(*) AS cantidad,
      ROUND(SUM(COALESCE(valor,0)),2) AS valor
    FROM cobros_movimientos_importados
    WHERE clase_movimiento = 'OTRO'
  `).get()
);

console.log("\n=== 11. DUPLICADOS LOGICOS ===");

console.log(
  db.prepare(`
    SELECT
      movimiento_hash,
      COUNT(*) AS cantidad
    FROM cobros_movimientos_importados
    WHERE COALESCE(movimiento_hash,'') <> ''
    GROUP BY movimiento_hash
    HAVING COUNT(*) > 1
    ORDER BY cantidad DESC
    LIMIT 20
  `).all()
);

console.log("\n=== 12. CONTROL RECONCILIACION ===");

console.log(
  db.prepare(`
    SELECT *
    FROM reconciliation_control
    WHERE id = 1
  `).get()
);

db.close();
