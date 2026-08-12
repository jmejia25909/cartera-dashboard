const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

console.log("\n=== BATCHES ANULADOS ===");
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
      registros_legacy
    FROM historical_bootstrap_batches
    WHERE fuente = 'ANULADOS'
    ORDER BY periodo_desde
  `).all()
);

console.log("\n=== RESUMEN ANULADOS ===");
console.log(
  db.prepare(`
    SELECT
      COUNT(*) AS total_hechos,
      COUNT(DISTINCT documento_normalizado) AS documentos_unicos,
      MIN(fecha_anulacion) AS fecha_minima,
      MAX(fecha_anulacion) AS fecha_maxima,
      SUM(CASE WHEN resultado = 'NO_ENCONTRADO' THEN 1 ELSE 0 END) AS no_encontrados,
      SUM(CASE WHEN resultado = 'ANULADO' THEN 1 ELSE 0 END) AS anulados,
      SUM(CASE WHEN resultado = 'YA_ANULADO' THEN 1 ELSE 0 END) AS ya_anulados
    FROM documentos_anulados_log
  `).get()
);

console.log("\n=== IMPORTACIONES ANULADOS ===");
console.log(
  db.prepare(`
    SELECT
      id,
      periodo_desde,
      periodo_hasta,
      registros_leidos,
      registros_importados,
      registros_duplicados,
      estado
    FROM importaciones
    WHERE tipo = 'ANULADOS'
    ORDER BY periodo_desde
  `).all()
);

console.log("\n=== CONTROL ===");
console.log(
  db.prepare(`
    SELECT *
    FROM reconciliation_control
    WHERE id = 1
  `).get()
);

db.close();
