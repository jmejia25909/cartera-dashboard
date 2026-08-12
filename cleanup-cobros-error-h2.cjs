const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`
);

const failed = db.prepare(`
  SELECT id, archivo_nombre, archivo_hash
  FROM importaciones
  WHERE tipo = 'COBROS_MOVIMIENTOS'
    AND estado = 'ERROR'
  ORDER BY id DESC
  LIMIT 1
`).get();

console.log("IMPORTACION FALLIDA:", failed);

if (!failed) {
  console.log("No existe importación fallida que limpiar.");
  db.close();
  process.exit(0);
}

const tx = db.transaction(() => {
  const events = db.prepare(`
    DELETE FROM documento_eventos
    WHERE importacion_id = ?
  `).run(failed.id);

  const movements = db.prepare(`
    DELETE FROM cobros_movimientos_importados
    WHERE importacion_id = ?
  `).run(failed.id);

  const batches = db.prepare(`
    DELETE FROM historical_bootstrap_batches
    WHERE fuente = 'COBROS_MOVIMIENTOS'
      AND archivo_hash = ?
  `).run(failed.archivo_hash);

  const imp = db.prepare(`
    DELETE FROM importaciones
    WHERE id = ?
  `).run(failed.id);

  return {
    eventosEliminados: events.changes,
    movimientosEliminados: movements.changes,
    batchesEliminados: batches.changes,
    importacionesEliminadas: imp.changes
  };
});

console.log("RESULTADO:", tx());

db.close();
