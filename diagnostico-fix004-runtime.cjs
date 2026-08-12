const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

console.log("\n=== IMPORTACIONES TRANSACCIONALES ===");

console.log(
  db.prepare(`
    SELECT
      id,
      tipo,
      periodo_desde,
      periodo_hasta,
      registros_leidos,
      registros_importados,
      registros_duplicados,
      estado,
      reconciliation_generation
    FROM importaciones
    WHERE tipo IN (
      'ANULADOS',
      'NOTAS_CREDITO',
      'COBROS_MOVIMIENTOS'
    )
    ORDER BY id
  `).all()
);

console.log("\n=== BATCHES HISTORICOS ===");

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
      registros_legacy,
      creado_en,
      completado_en
    FROM historical_bootstrap_batches
    ORDER BY generation, fuente, periodo_desde
  `).all()
);

console.log("\n=== ANULADOS IMPORTACION 8 ===");

console.log(
  db.prepare(`
    SELECT
      COUNT(*) AS hechos,
      MIN(fecha_anulacion) AS desde,
      MAX(fecha_anulacion) AS hasta
    FROM documentos_anulados_log
    WHERE importacion_id = 8
  `).get()
);

console.log("\n=== CONTROL RECONCILIACION ===");

console.log(
  db.prepare(`
    SELECT *
    FROM reconciliation_control
    WHERE id = 1
  `).get()
);

db.close();
