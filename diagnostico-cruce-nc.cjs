const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

console.log("\n=== COLUMNAS DOCUMENTOS ===");
const columnas = db.prepare(`PRAGMA table_info(documentos)`).all();

for (const col of columnas) {
  console.log(col.name);
}

console.log("\n=== MUESTRA FACTURAS EN CARTERA ===");

const rows = db.prepare(`
  SELECT
    id,
    documento,
    documento_normalizado,
    tipo_documento,
    razon_social,
    total
  FROM documentos
  WHERE is_subtotal = 0
    AND tipo_documento = 'FAC'
  ORDER BY id
  LIMIT 30
`).all();

for (const row of rows) {
  console.log(JSON.stringify(row));
}

console.log("\n=== BUSQUEDA DE FACTURAS DE LAS NC ===");

const relacionados = [
  '001-001-000012137',
  '001-001-000011073'
];

for (const documento of relacionados) {
  const normalizado = documento.replace(/\D/g, '');

  const encontrados = db.prepare(`
    SELECT
      id,
      documento,
      documento_normalizado,
      tipo_documento,
      razon_social,
      total
    FROM documentos
    WHERE is_subtotal = 0
      AND (
        documento = ?
        OR documento_normalizado = ?
        OR REPLACE(REPLACE(REPLACE(documento, '-', ''), ' ', ''), '.', '') = ?
      )
  `).all(documento, normalizado, normalizado);

  console.log(`\n${documento} -> ${normalizado}`);
  console.log(encontrados);
}

db.close();
