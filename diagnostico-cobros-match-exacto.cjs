const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

console.log("\n=== EVENTOS COBRO + MOVIMIENTO EXACTO ===");

const rows = db.prepare(`
  SELECT
    e.id AS evento_id,
    e.event_key,
    e.referencia_externa,
    e.documento_normalizado,
    e.importe,
    e.ocurrido_en,

    m.id AS movimiento_id,
    m.movimiento_key,
    m.fecha_movimiento,
    m.codigo_comprobante,
    m.asiento,
    m.documento_relacionado,
    m.valor,
    m.clase_movimiento

  FROM documento_eventos e
  LEFT JOIN cobros_movimientos_importados m
    ON m.importacion_id = e.importacion_id
   AND m.documento_relacionado_normalizado = e.documento_normalizado
   AND ABS(m.valor - e.importe) < 0.005
   AND (
        m.codigo_comprobante = e.referencia_externa
        OR m.asiento = e.referencia_externa
   )

  WHERE e.fuente = 'COBROS_MOVIMIENTOS'
    AND e.tipo_evento = 'COBRO_CONFIRMADO'

  ORDER BY e.id
`).all();

console.log(rows);

console.log("\n=== RESUMEN MATCH ===");

console.log({
  eventos: rows.length,
  matched: rows.filter(r => r.movimiento_id != null).length,
  unmatched: rows.filter(r => r.movimiento_id == null).length,
  fechasIncorrectas: rows.filter(
    r => r.movimiento_id != null &&
         r.ocurrido_en !== r.fecha_movimiento
  ).length
});

console.log("\n=== UNMATCHED ===");
console.log(
  rows.filter(r => r.movimiento_id == null)
);

console.log("\n=== FECHAS REALMENTE DIFERENTES ===");
console.log(
  rows.filter(
    r => r.movimiento_id != null &&
         r.ocurrido_en !== r.fecha_movimiento
  )
);

db.close();
