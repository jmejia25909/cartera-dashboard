const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

for (const tabla of [
  "historical_bootstrap_batches",
  "documento_eventos",
  "documentos_anulados_log",
  "importaciones"
]) {
  console.log(`\n=== ${tabla} ===`);

  console.log(
    db.prepare(`PRAGMA table_info("${tabla}")`).all()
  );
}

console.log("\n=== MUESTRA ANULADOS LOG ===");

console.log(
  db.prepare(`
    SELECT *
    FROM documentos_anulados_log
    ORDER BY id
    LIMIT 3
  `).all()
);

console.log("\n=== EVENTOS ACTUALES RELACIONADOS CON ANULACION ===");

console.log(
  db.prepare(`
    SELECT *
    FROM documento_eventos
    WHERE fuente = 'ANULADOS'
       OR tipo_evento LIKE '%ANUL%'
    LIMIT 10
  `).all()
);

db.close();
