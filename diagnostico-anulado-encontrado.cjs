const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

console.log("\n=== ANULADO ENCONTRADO EN CARTERA VIVA ===");

console.log(
  db.prepare(`
    SELECT
      l.documento,
      l.documento_normalizado,
      l.fecha_anulacion,
      l.resultado,
      l.importacion_id,
      d.id AS documento_id,
      d.cliente,
      d.razon_social,
      d.tipo_documento,
      d.total,
      d.saldo_pendiente,
      d.estado_documento,
      d.anulado,
      d.fecha_anulacion AS fecha_anulacion_proyeccion,
      d.fuente_anulacion,
      d.posicion_cartera
    FROM documentos_anulados_log l
    LEFT JOIN documentos d
      ON d.id = l.documento_id
    WHERE l.resultado = 'ANULADO'
  `).all()
);

console.log("\n=== EVENTOS DEL DOCUMENTO ===");

console.log(
  db.prepare(`
    SELECT
      e.documento_normalizado,
      e.tipo_evento,
      e.fuente,
      e.importe,
      e.estado_anterior,
      e.estado_nuevo,
      e.provisional,
      e.ocurrido_en
    FROM documento_eventos e
    WHERE e.documento_normalizado IN (
      SELECT documento_normalizado
      FROM documentos_anulados_log
      WHERE resultado = 'ANULADO'
    )
    ORDER BY e.id
  `).all()
);

console.log("\n=== CARTERA VIVA POST ANULADOS ===");

console.log(
  db.prepare(`
    SELECT
      COUNT(*) AS documentos,
      ROUND(SUM(total),2) AS saldo
    FROM documentos
    WHERE is_subtotal = 0
      AND COALESCE(posicion_cartera,'DEUDA_VIVA') = 'DEUDA_VIVA'
      AND COALESCE(total,0) > 0
      AND COALESCE(anulado,0) = 0
      AND COALESCE(estado_documento,'ACTIVO') <> 'ANULADO'
  `).get()
);

db.close();
