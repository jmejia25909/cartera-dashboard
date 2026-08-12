const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

console.log("\n=== 1. ULTIMA IMPORTACION COBROS ===");

const imp = db.prepare(`
  SELECT
    id,
    tipo,
    archivo_nombre,
    periodo_desde,
    periodo_hasta,
    registros_leidos,
    registros_importados,
    registros_ignorados,
    registros_duplicados,
    estado,
    observacion,
    metadata_json,
    reconciliation_generation,
    importado_en
  FROM importaciones
  WHERE tipo = 'COBROS_MOVIMIENTOS'
  ORDER BY id DESC
  LIMIT 1
`).get();

console.log(imp);

if (!imp) {
  console.log("ERROR: No existe importacion COBROS_MOVIMIENTOS.");
  db.close();
  process.exit(1);
}

console.log("\n=== 2. BATCH HISTORICO ===");

console.log(
  db.prepare(`
    SELECT *
    FROM historical_bootstrap_batches
    WHERE fuente = 'COBROS_MOVIMIENTOS'
    ORDER BY id DESC
    LIMIT 1
  `).get()
);

console.log("\n=== 3. MOVIMIENTOS PERSISTIDOS ===");

console.log(
  db.prepare(`
    SELECT
      COUNT(*) AS movimientos,
      MIN(fecha_movimiento) AS fecha_minima,
      MAX(fecha_movimiento) AS fecha_maxima,
      ROUND(SUM(COALESCE(valor,0)),2) AS valor_total
    FROM cobros_movimientos_importados
    WHERE importacion_id = ?
  `).get(imp.id)
);

console.log("\n=== 4. DISTRIBUCION POR CLASE ===");

console.log(
  db.prepare(`
    SELECT
      clase_movimiento,
      COUNT(*) AS cantidad,
      ROUND(SUM(COALESCE(valor,0)),2) AS valor
    FROM cobros_movimientos_importados
    WHERE importacion_id = ?
    GROUP BY clase_movimiento
    ORDER BY clase_movimiento
  `).all(imp.id)
);

console.log("\n=== 5. ESTADOS DE CONCILIACION ===");

console.log(
  db.prepare(`
    SELECT
      estado_conciliacion,
      COUNT(*) AS cantidad,
      ROUND(SUM(COALESCE(valor,0)),2) AS valor
    FROM cobros_movimientos_importados
    WHERE importacion_id = ?
    GROUP BY estado_conciliacion
    ORDER BY estado_conciliacion
  `).all(imp.id)
);

console.log("\n=== 6. VINCULACION CON DOCUMENTOS ===");

console.log(
  db.prepare(`
    SELECT
      SUM(CASE WHEN documento_id IS NOT NULL THEN 1 ELSE 0 END) AS vinculados,
      SUM(CASE WHEN documento_id IS NULL THEN 1 ELSE 0 END) AS no_vinculados,
      COUNT(*) AS total
    FROM cobros_movimientos_importados
    WHERE importacion_id = ?
  `).get(imp.id)
);

console.log("\n=== 7. MOVIMIENTOS VINCULADOS ===");

console.log(
  db.prepare(`
    SELECT *
    FROM cobros_movimientos_importados
    WHERE importacion_id = ?
      AND documento_id IS NOT NULL
    ORDER BY fecha_movimiento
  `).all(imp.id)
);

console.log("\n=== 8. EVENTOS GENERADOS ===");

console.log(
  db.prepare(`
    SELECT
      tipo_evento,
      fuente,
      COUNT(*) AS cantidad,
      ROUND(SUM(COALESCE(importe,0)),2) AS importe,
      MIN(ocurrido_en) AS fecha_minima,
      MAX(ocurrido_en) AS fecha_maxima
    FROM documento_eventos
    WHERE fuente = 'COBROS_MOVIMIENTOS'
    GROUP BY tipo_evento, fuente
    ORDER BY tipo_evento
  `).all()
);

console.log("\n=== 9. OTROS RESIDUALES ===");

console.log(
  db.prepare(`
    SELECT
      COUNT(*) AS cantidad,
      ROUND(SUM(COALESCE(valor,0)),2) AS valor
    FROM cobros_movimientos_importados
    WHERE importacion_id = ?
      AND clase_movimiento = 'OTRO'
  `).get(imp.id)
);

console.log("\n=== 10. CONTROL RECONCILIACION ===");

console.log(
  db.prepare(`
    SELECT *
    FROM reconciliation_control
    WHERE id = 1
  `).get()
);

db.close();
