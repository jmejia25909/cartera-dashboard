const Database = require("better-sqlite3");

const db = new Database(
  "C:/Users/j-mej/AppData/Roaming/cartera-dashboard/data/cartera.db",
  { readonly: true }
);

console.log("\n=== TIPOS DE FILA ===");

console.table(
  db.prepare(`
    SELECT
      is_subtotal,
      COUNT(*) AS cantidad,
      SUM(COALESCE(total,0)) AS suma_total
    FROM documentos
    GROUP BY is_subtotal
    ORDER BY is_subtotal
  `).all()
);

console.log("\n=== TIPOS DE DOCUMENTO REALES ===");

console.table(
  db.prepare(`
    SELECT
      COALESCE(tipo_documento,'(VACIO)') AS tipo_documento,
      COUNT(*) AS cantidad,
      SUM(COALESCE(total,0)) AS suma_total
    FROM documentos
    WHERE COALESCE(is_subtotal,0)=0
    GROUP BY tipo_documento
    ORDER BY cantidad DESC
  `).all()
);

console.log("\n=== MUESTRA SUBTOTALES ===");

console.table(
  db.prepare(`
    SELECT
      id,
      cliente,
      razon_social,
      tipo_documento,
      documento,
      total,
      descripcion,
      is_subtotal
    FROM documentos
    WHERE is_subtotal = 1
    LIMIT 30
  `).all()
);

console.log("\n=== MUESTRA DOCUMENTOS REALES ===");

console.table(
  db.prepare(`
    SELECT
      id,
      cliente,
      razon_social,
      tipo_documento,
      documento,
      total,
      descripcion,
      is_subtotal
    FROM documentos
    WHERE COALESCE(is_subtotal,0)=0
    LIMIT 30
  `).all()
);

db.close();
