const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Users\j-mej\AppData\Roaming\cartera-dashboard\data\cartera.db`,
  { readonly: true }
);

console.log("\n=== ULTIMAS IMPORTACIONES CARTERA ===");
console.table(
  db.prepare(`
    SELECT
      id,
      archivo_nombre,
      archivo_hash,
      registros_leidos,
      registros_importados,
      estado,
      observacion,
      importado_en
    FROM importaciones
    WHERE tipo = 'CARTERA'
    ORDER BY id DESC
    LIMIT 5
  `).all()
);

console.log("\n=== DOCUMENTO_SALDOS ===");
console.log(
  db.prepare(`
    SELECT COUNT(*) AS cantidad
    FROM documento_saldos
  `).get()
);

console.log("\n=== EVENTOS ===");
console.table(
  db.prepare(`
    SELECT tipo_evento, fuente, COUNT(*) AS cantidad
    FROM documento_eventos
    GROUP BY tipo_evento, fuente
    ORDER BY cantidad DESC
  `).all()
);

console.log("\n=== LIQUIDACION_AUTOMATICA ===");
console.log(
  db.prepare(`
    SELECT COUNT(*) AS cantidad
    FROM documentos
    WHERE COALESCE(credito_fuente,'') = 'LIQUIDACION_AUTOMATICA'
  `).get()
);

db.close();
