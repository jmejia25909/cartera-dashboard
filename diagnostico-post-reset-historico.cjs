const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

const tablas = [
  "documentos",
  "clientes",
  "gestiones",
  "campanas",
  "campana_clientes",
  "disputas",
  "cuentas_aplicar",
  "abonos",
  "alertas_credito",
  "conciliaciones_cobros",
  "documento_eventos",
  "documento_saldos",
  "documentos_anulados_log",
  "notas_credito_importadas",
  "cobros_movimientos_importados",
  "importaciones",
  "importacion_snapshots",
  "cartera_snapshots",
  "cartera_snapshot_documentos",
  "historical_bootstrap_batches"
];

console.log("\n=== RESIDUOS POST RESET HISTORICO ===");

for (const tabla of tablas) {
  const existe = db.prepare(`
    SELECT 1
    FROM sqlite_master
    WHERE type = 'table' AND name = ?
  `).get(tabla);

  if (!existe) {
    console.log(`${tabla}: NO EXISTE`);
    continue;
  }

  const { cantidad } = db
    .prepare(`SELECT COUNT(*) AS cantidad FROM "${tabla}"`)
    .get();

  console.log(`${tabla}: ${cantidad}`);
}

console.log("\n=== RECONCILIATION CONTROL ===");
console.log(
  db.prepare(`
    SELECT *
    FROM reconciliation_control
    WHERE id = 1
  `).get()
);

db.close();
