const Database = require("better-sqlite3");

const dbPath = String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`;
const db = new Database(dbPath, { readonly: true });

console.log("\n=== BASE ===");
console.log(dbPath);

console.log("\n=== TABLAS RELACIONADAS PACK044/045 ===");
console.table(
  db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND (
        name LIKE '%histor%'
        OR name LIKE '%replay%'
        OR name LIKE '%batch%'
        OR name LIKE '%chunk%'
        OR name LIKE '%snapshot%'
        OR name LIKE '%config%'
      )
    ORDER BY name
  `).all()
);

console.log("\n=== TODAS LAS TABLAS ===");
console.table(
  db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all()
);

function tableExists(name) {
  return Boolean(
    db.prepare(`
      SELECT 1
      FROM sqlite_master
      WHERE type = 'table' AND name = ?
    `).get(name)
  );
}

if (tableExists("cartera_snapshots")) {
  console.log("\n=== COLUMNAS cartera_snapshots ===");
  console.table(db.prepare(`PRAGMA table_info(cartera_snapshots)`).all());

  console.log("\n=== SNAPSHOTS ACTUALES ===");
  console.table(
    db.prepare(`
      SELECT *
      FROM cartera_snapshots
      ORDER BY id DESC
      LIMIT 10
    `).all()
  );
}

console.log("\n=== TABLAS DE CONFIGURACION DETECTADAS ===");

const configTables = db.prepare(`
  SELECT name
  FROM sqlite_master
  WHERE type = 'table'
    AND name LIKE '%config%'
  ORDER BY name
`).all();

console.table(configTables);

for (const { name } of configTables) {
  console.log("\n--- " + name + " ---");

  try {
    console.table(db.prepare(`SELECT * FROM "${name}" LIMIT 50`).all());
  } catch (error) {
    console.log("No se pudo consultar:", error.message);
  }
}

console.log("\n=== IMPORTACIONES RECIENTES ===");
console.table(
  db.prepare(`
    SELECT
      id,
      tipo,
      archivo_nombre,
      registros_leidos,
      registros_importados,
      registros_ignorados,
      registros_duplicados,
      estado,
      observacion,
      importado_en
    FROM importaciones
    ORDER BY id DESC
    LIMIT 10
  `).all()
);

console.log("\n=== FIN DIAGNOSTICO ===");

db.close();
