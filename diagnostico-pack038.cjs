const Database = require("better-sqlite3");

const dbPath = String.raw`C:\Users\j-mej\AppData\Roaming\cartera-dashboard\data\cartera.db`;
const db = new Database(dbPath, { readonly: true });

function count(sql, params = []) {
  return db.prepare(sql).get(...params);
}

console.log("\n=== BASE ===");
console.log(dbPath);

console.log("\n=== TABLAS PACK 038 ===");
console.table(
  db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name IN ('documento_saldos','documento_eventos')
    ORDER BY name
  `).all()
);

console.log("\n=== COLUMNAS NUEVAS EN documentos ===");
const columnas = db.prepare(`PRAGMA table_info(documentos)`).all();
console.table(
  columnas.filter(c =>
    [
      'estado_confirmacion',
      'estado_fuente',
      'saldo_pendiente',
      'saldo_original',
      'ultima_conciliacion_en'
    ].includes(c.name)
  )
);

console.log("\n=== ESTADO GENERAL documentos ===");
console.log(
  count(`
    SELECT
      COUNT(*) AS total_filas,
      SUM(CASE WHEN is_subtotal = 0 THEN 1 ELSE 0 END) AS documentos,
      SUM(CASE WHEN is_subtotal = 1 THEN 1 ELSE 0 END) AS subtotales
    FROM documentos
  `)
);

console.log("\n=== LIQUIDACION_AUTOMATICA HEREDADA ===");
console.log(
  count(`
    SELECT COUNT(*) AS cantidad
    FROM documentos
    WHERE COALESCE(credito_fuente,'') = 'LIQUIDACION_AUTOMATICA'
  `)
);

console.log("\n=== EVENTOS ===");
console.log(
  count(`SELECT COUNT(*) AS total_eventos FROM documento_eventos`)
);

console.table(
  db.prepare(`
    SELECT tipo_evento, fuente, COUNT(*) AS cantidad
    FROM documento_eventos
    GROUP BY tipo_evento, fuente
    ORDER BY cantidad DESC
  `).all()
);

console.log("\n=== SALDOS ===");
console.log(
  count(`SELECT COUNT(*) AS total_saldos FROM documento_saldos`)
);

console.log("\n=== ESTADOS PROYECTADOS ===");
console.table(
  db.prepare(`
    SELECT
      COALESCE(estado_documento,'NULL') AS estado_documento,
      COALESCE(estado_confirmacion,'NULL') AS confirmacion,
      COALESCE(estado_fuente,'NULL') AS fuente,
      COUNT(*) AS cantidad
    FROM documentos
    WHERE is_subtotal = 0
    GROUP BY estado_documento, estado_confirmacion, estado_fuente
    ORDER BY cantidad DESC
  `).all()
);

console.log("\n=== EVENTOS DE DESAPARICION ===");
console.table(
  db.prepare(`
    SELECT tipo_evento, COUNT(*) AS cantidad
    FROM documento_eventos
    WHERE tipo_evento IN ('DOCUMENTO_DESAPARECIDO','PAGO_TOTAL_INFERIDO')
    GROUP BY tipo_evento
  `).all()
);

db.close();
