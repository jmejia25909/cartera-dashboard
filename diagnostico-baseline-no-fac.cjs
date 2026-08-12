const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

console.log("\n=== DOCUMENTOS NO FAC DEL BASELINE ===");

console.log(
  db.prepare(`
    SELECT
      id,
      cliente,
      razon_social,
      tipo_documento,
      documento,
      fecha_emision,
      fecha_vencimiento,
      total,
      valor_documento,
      retenciones,
      cobros,
      saldo_original,
      saldo_pendiente,
      estado_documento,
      estado_confirmacion,
      estado_fuente
    FROM documentos
    WHERE is_subtotal = 0
      AND tipo_documento <> 'FAC'
    ORDER BY tipo_documento, documento
  `).all()
);

console.log("\n=== EVENTOS DE ESOS DOCUMENTOS ===");

console.log(
  db.prepare(`
    SELECT
      documento_normalizado,
      tipo_evento,
      fuente,
      importe,
      estado_anterior,
      estado_nuevo,
      provisional,
      referencia_externa
    FROM documento_eventos
    WHERE documento_normalizado IN (
      SELECT documento_normalizado
      FROM documentos
      WHERE is_subtotal = 0
        AND tipo_documento <> 'FAC'
    )
    ORDER BY documento_normalizado, id
  `).all()
);

db.close();
