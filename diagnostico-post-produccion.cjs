const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

console.log("\n=== CONTROL POST PRODUCCION ===");

console.log(
  db.prepare(`
    SELECT *
    FROM reconciliation_control
    WHERE id = 1
  `).get()
);

console.log("\n=== ULTIMOS SNAPSHOTS ===");

console.log(
  db.prepare(`
    SELECT
      id,
      importacion_id,
      generation,
      fecha_snapshot,
      snapshot_anterior_id,
      cantidad_documentos,
      cantidad_legacy,
      baseline,
      creado_en
    FROM cartera_snapshots
    ORDER BY id DESC
    LIMIT 5
  `).all()
);

console.log("\n=== BATCHES HISTORICOS ===");

console.log(
  db.prepare(`
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
  `).all()
);

db.close();
