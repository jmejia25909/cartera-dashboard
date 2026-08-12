const Database = require("better-sqlite3");

const db = new Database(
  "C:/Users/j-mej/AppData/Roaming/cartera-dashboard/data/cartera.db",
  { readonly: true }
);

console.log("\n=== RESUMEN GENERAL ===");

console.table(
  db.prepare(`
    SELECT
      COUNT(*) AS filas,
      COUNT(DISTINCT documento) AS documentos_distintos,
      SUM(CASE WHEN COALESCE(is_subtotal,0)=1 THEN 1 ELSE 0 END) AS subtotales,
      SUM(CASE WHEN COALESCE(is_subtotal,0)=0 THEN 1 ELSE 0 END) AS documentos_reales
    FROM documentos
  `).all()
);

console.log("\n=== DOCUMENTOS POR FECHA DE IMPORTACION ===");

console.table(
  db.prepare(`
    SELECT
      substr(importado_en,1,10) AS fecha,
      COUNT(*) AS cantidad
    FROM documentos
    GROUP BY substr(importado_en,1,10)
    ORDER BY fecha DESC
  `).all()
);

console.log("\n=== DOCUMENTOS POR FECHA/HORA DE IMPORTACION ===");

console.table(
  db.prepare(`
    SELECT
      substr(importado_en,1,16) AS momento,
      COUNT(*) AS cantidad
    FROM documentos
    GROUP BY substr(importado_en,1,16)
    ORDER BY momento DESC
    LIMIT 20
  `).all()
);

console.log("\n=== DUPLICADOS POR NUMERO DE DOCUMENTO ===");

console.table(
  db.prepare(`
    SELECT
      documento,
      COUNT(*) AS veces
    FROM documentos
    WHERE COALESCE(documento,'') <> ''
    GROUP BY documento
    HAVING COUNT(*) > 1
    ORDER BY veces DESC
    LIMIT 20
  `).all()
);

db.close();
