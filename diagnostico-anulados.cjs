const Database = require("better-sqlite3");

const db = new Database(
  "C:/Users/j-mej/Downloads/PRUEBA-CARTERA-LIMPIA/data/cartera.db",
  { readonly: true }
);

console.log("\n=== RESUMEN DOCUMENTOS ===");

console.table(
  db.prepare(`
    SELECT
      COUNT(*) AS total_documentos,
      SUM(CASE WHEN COALESCE(anulado, 0) = 1 THEN 1 ELSE 0 END) AS anulados
    FROM documentos
  `).all()
);

console.log("\n=== DOCUMENTOS DE PRUEBA ===");

console.table(
  db.prepare(`
    SELECT *
    FROM documentos
    WHERE documento LIKE '%12635%'
       OR documento LIKE '%12169%'
    LIMIT 20
  `).all()
);

console.log("\n=== ULTIMAS IMPORTACIONES ===");

console.table(
  db.prepare(`
    SELECT
      id,
      tipo,
      archivo_nombre,
      estado,
      registros_leidos,
      registros_importados,
      registros_ignorados,
      registros_duplicados,
      observacion,
      importado_en
    FROM importaciones
    ORDER BY id DESC
    LIMIT 10
  `).all()
);

db.close();
