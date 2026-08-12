const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

console.log("\n=== AUDITORIA FINAL BATCHES COBROS ===");

const rows = db.prepare(`
  SELECT
    b.id,
    b.periodo_desde,
    b.periodo_hasta,
    b.registros_leidos,
    b.registros_in_scope,
    b.registros_ignorados,
    b.registros_legacy,
    i.registros_duplicados,
    (
      b.registros_in_scope
      + b.registros_ignorados
      + b.registros_legacy
      + COALESCE(i.registros_duplicados,0)
    ) AS reconstruido,
    (
      b.registros_leidos
      - (
          b.registros_in_scope
          + b.registros_ignorados
          + b.registros_legacy
          + COALESCE(i.registros_duplicados,0)
        )
    ) AS diferencia
  FROM historical_bootstrap_batches b
  JOIN importaciones i
    ON i.tipo = 'COBROS_MOVIMIENTOS'
   AND i.reconciliation_generation = b.generation
   AND i.periodo_desde = b.periodo_desde
   AND i.periodo_hasta = b.periodo_hasta
  WHERE b.fuente = 'COBROS_MOVIMIENTOS'
  ORDER BY b.periodo_desde
`).all();

console.log(rows);

console.log("\n=== TOTALES ===");

console.log(
  db.prepare(`
    SELECT
      COUNT(*) AS batches,
      SUM(b.registros_leidos) AS leidos,
      SUM(b.registros_in_scope) AS in_scope,
      SUM(b.registros_ignorados) AS ignorados,
      SUM(b.registros_legacy) AS legacy,
      SUM(i.registros_duplicados) AS duplicados
    FROM historical_bootstrap_batches b
    JOIN importaciones i
      ON i.tipo = 'COBROS_MOVIMIENTOS'
     AND i.reconciliation_generation = b.generation
     AND i.periodo_desde = b.periodo_desde
     AND i.periodo_hasta = b.periodo_hasta
    WHERE b.fuente = 'COBROS_MOVIMIENTOS'
  `).get()
);

console.log("\n=== DIFERENCIAS ===");

console.log(
  rows.filter(r => Number(r.diferencia) !== 0)
);

db.close();
