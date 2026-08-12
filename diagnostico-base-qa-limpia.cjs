const Database = require("better-sqlite3");

const dbPath = String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`;
const db = new Database(dbPath, { readonly: true });

const tablas = [
  "documentos",
  "clientes",
  "abonos",
  "importaciones",
  "importacion_snapshots",
  "documento_eventos",
  "documento_saldos",
  "documentos_anulados_log",
  "conciliaciones_cobros"
];

console.log("\n=== BASE QA OFICIAL ===");
console.log(dbPath);

console.log("\n=== CONTEO DE TABLAS OPERACIONALES ===");

for (const tabla of tablas) {
  const existe = db.prepare(`
    SELECT COUNT(*) AS cantidad
    FROM sqlite_master
    WHERE type = 'table'
      AND name = ?
  `).get(tabla).cantidad > 0;

  if (!existe) {
    console.log(`${tabla}: NO EXISTE`);
    continue;
  }

  const resultado = db.prepare(
    `SELECT COUNT(*) AS cantidad FROM "${tabla}"`
  ).get();

  console.log(`${tabla}: ${resultado.cantidad}`);
}

console.log("\n=== LIQUIDACION_AUTOMATICA ===");

const columnasDocumentos = db
  .prepare(`PRAGMA table_info(documentos)`)
  .all()
  .map(c => c.name);

if (columnasDocumentos.includes("credito_fuente")) {
  console.log(
    db.prepare(`
      SELECT COUNT(*) AS cantidad
      FROM documentos
      WHERE COALESCE(credito_fuente, '') = 'LIQUIDACION_AUTOMATICA'
    `).get()
  );
}

db.close();
