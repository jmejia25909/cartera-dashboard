const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

console.log("\n=== EVENTOS NC POR FECHA EFECTIVA ===");

console.log(
  db.prepare(`
    SELECT
      e.referencia_externa AS nota_credito,
      n.fecha_nc,
      e.ocurrido_en,
      e.documento_normalizado,
      e.importe
    FROM documento_eventos e
    LEFT JOIN notas_credito_importadas n
      ON n.numero_nc = e.referencia_externa
    WHERE e.fuente = 'NOTAS_CREDITO'
      AND e.tipo_evento = 'NOTA_CREDITO_APLICADA'
    ORDER BY n.fecha_nc, e.id
  `).all()
);

console.log("\n=== INCONSISTENCIAS FECHA EFECTIVA ===");

console.log(
  db.prepare(`
    SELECT COUNT(*) AS inconsistencias
    FROM documento_eventos e
    JOIN notas_credito_importadas n
      ON n.numero_nc = e.referencia_externa
    WHERE e.fuente = 'NOTAS_CREDITO'
      AND e.tipo_evento = 'NOTA_CREDITO_APLICADA'
      AND TRIM(COALESCE(n.fecha_nc,'')) <> ''
      AND e.ocurrido_en <> n.fecha_nc
  `).get()
);

console.log("\n=== CREDITOS VIVOS CON NC TRANSACCIONAL ===");

console.log(
  db.prepare(`
    SELECT
      d.documento,
      d.total AS credito_vivo,
      n.fecha_nc,
      n.total_nc,
      n.saldo_nc,
      n.estado_conciliacion,
      n.documento_relacionado
    FROM documentos d
    JOIN notas_credito_importadas n
      ON n.numero_nc_normalizado = d.documento_normalizado
    WHERE d.is_subtotal = 0
      AND COALESCE(d.posicion_cartera,'DEUDA_VIVA') = 'CREDITO_VIVO'
      AND COALESCE(d.total,0) < 0
      AND COALESCE(d.anulado,0) = 0
    ORDER BY d.documento
  `).all()
);

db.close();
