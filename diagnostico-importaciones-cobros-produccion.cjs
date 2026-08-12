const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

console.log("\n=== IMPORTACIONES COBROS ===");

console.log(
  db.prepare(`
    SELECT
      id,
      periodo_desde,
      periodo_hasta,
      registros_leidos,
      registros_importados,
      registros_ignorados,
      registros_duplicados,
      reconciliation_generation,
      estado
    FROM importaciones
    WHERE tipo = 'COBROS_MOVIMIENTOS'
    ORDER BY periodo_desde
  `).all()
);

console.log("\n=== TOTAL IMPORTACIONES ===");

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

db.close();
