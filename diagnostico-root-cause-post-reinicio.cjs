const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

console.log("\n=== CONTROL PRODUCCION ===");

console.log(
  db.prepare(`
    SELECT mode, generation
    FROM reconciliation_control
    WHERE id = 1
  `).get()
);

console.log("\n=== COBROS POST REINICIO ===");

console.log(
  db.prepare(`
    SELECT
      periodo_desde,
      periodo_hasta,
      registros_leidos,
      registros_in_scope,
      registros_ignorados,
      registros_legacy
    FROM historical_bootstrap_batches
    WHERE fuente = 'COBROS_MOVIMIENTOS'
    ORDER BY periodo_desde
  `).all()
);

console.log("\n=== TOTALES ===");

console.log(
  db.prepare(`
    SELECT
      COUNT(*) AS batches,
      SUM(registros_leidos) AS leidos,
      SUM(registros_in_scope) AS in_scope,
      SUM(registros_ignorados) AS ignorados,
      SUM(registros_legacy) AS legacy
    FROM historical_bootstrap_batches
    WHERE fuente = 'COBROS_MOVIMIENTOS'
  `).get()
);

db.close();
