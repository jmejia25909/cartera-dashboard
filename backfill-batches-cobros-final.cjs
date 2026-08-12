const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`
);

const tx = db.transaction(() => {
  const rows = db.prepare(`
    SELECT
      b.id AS batch_id,
      b.generation,
      b.periodo_desde,
      b.periodo_hasta,
      i.id AS importacion_id,
      i.registros_ignorados,
      i.registros_duplicados
    FROM historical_bootstrap_batches b
    JOIN importaciones i
      ON i.tipo = 'COBROS_MOVIMIENTOS'
     AND i.reconciliation_generation = b.generation
     AND i.periodo_desde = b.periodo_desde
     AND i.periodo_hasta = b.periodo_hasta
    WHERE b.fuente = 'COBROS_MOVIMIENTOS'
  `).all();

  const update = db.prepare(`
    UPDATE historical_bootstrap_batches
    SET registros_ignorados = ?,
        registros_legacy = 0
    WHERE id = ?
  `);

  let actualizados = 0;

  for (const row of rows) {
    const result = update.run(
      Number(row.registros_ignorados ?? 0),
      row.batch_id
    );

    actualizados += result.changes;
  }

  return {
    batchesEncontrados: rows.length,
    batchesActualizados: actualizados
  };
});

console.log("RESULTADO BACKFILL:", tx());

db.close();
