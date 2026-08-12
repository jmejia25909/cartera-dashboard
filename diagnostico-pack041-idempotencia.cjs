const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

console.log("\n=== IMPORTACIONES ===");
console.table(
  db.prepare(`
    SELECT
      id,
      tipo,
      archivo_nombre,
      archivo_hash,
      registros_leidos,
      registros_importados,
      registros_ignorados,
      registros_duplicados,
      estado,
      observacion,
      importado_en
    FROM importaciones
    ORDER BY id DESC
  `).all()
);

console.log("\n=== RESUMEN POR TIPO ===");
console.table(
  db.prepare(`
    SELECT
      tipo,
      COUNT(*) AS cantidad
    FROM importaciones
    GROUP BY tipo
    ORDER BY tipo
  `).all()
);

console.log("\n=== LOG ANULADOS ===");
console.log(
  db.prepare(`
    SELECT
      COUNT(*) AS filas,
      COUNT(DISTINCT documento_normalizado) AS documentos_unicos
    FROM documentos_anulados_log
  `).get()
);

db.close();
