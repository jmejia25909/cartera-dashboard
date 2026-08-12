const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

console.log("\n=== LOG ANULADOS ===");
console.log(
  db.prepare(`
    SELECT
      COUNT(*) AS filas_log,
      COUNT(DISTINCT documento_normalizado) AS documentos_unicos
    FROM documentos_anulados_log
  `).get()
);

console.log("\n=== DUPLICADOS EN LOG ===");
console.table(
  db.prepare(`
    SELECT
      documento_normalizado,
      COUNT(*) AS cantidad
    FROM documentos_anulados_log
    GROUP BY documento_normalizado
    HAVING COUNT(*) > 1
    ORDER BY cantidad DESC
    LIMIT 20
  `).all()
);

console.log("\n=== IMPORTACIONES REGISTRADAS ===");
console.table(
  db.prepare(`
    SELECT id, tipo, archivo_nombre, registros_leidos,
           registros_importados, registros_duplicados,
           estado, importado_en
    FROM importaciones
    ORDER BY id
  `).all()
);

console.log("\n=== DISTRIBUCION CARTERA ===");
console.table(
  db.prepare(`
    SELECT
      COALESCE(NULLIF(TRIM(tipo_documento),''),'VACIO') AS tipo,
      COUNT(*) AS documentos,
      ROUND(SUM(COALESCE(total,0)),2) AS saldo
    FROM documentos
    WHERE is_subtotal = 0
    GROUP BY COALESCE(NULLIF(TRIM(tipo_documento),''),'VACIO')
    ORDER BY documentos DESC
  `).all()
);

db.close();
