const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

console.log("\n=== DOCUMENTO ANULADO PROYECTADO ===");

console.log(
  db.prepare(`
    SELECT
      documento,
      total,
      saldo_pendiente,
      estado_documento,
      anulado,
      fecha_anulacion
    FROM documentos
    WHERE COALESCE(anulado,0) = 1
       OR estado_documento = 'ANULADO'
  `).all()
);

console.log("\n=== EVENTO EFECTIVO DE ANULACION ===");

console.log(
  db.prepare(`
    SELECT
      documento_normalizado,
      tipo_evento,
      fuente,
      estado_anterior,
      estado_nuevo,
      ocurrido_en
    FROM documento_eventos
    WHERE fuente = 'ANULADOS'
      AND tipo_evento IN (
        'ANULACION_CONFIRMADA',
        'ESTADO_RECLASIFICADO'
      )
    ORDER BY ocurrido_en
  `).all()
);

db.close();
