const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

console.log("\n=== IMPORTACION H1-2024 COBROS ===");
console.log(
  db.prepare(`
    SELECT
      id,
      tipo,
      periodo_desde,
      periodo_hasta,
      registros_leidos,
      registros_importados,
      registros_ignorados,
      registros_duplicados,
      reconciliation_generation,
      metadata_json
    FROM importaciones
    WHERE tipo = 'COBROS_MOVIMIENTOS'
    ORDER BY id
    LIMIT 1
  `).get()
);

console.log("\n=== BATCH H1-2024 COBROS ===");
console.log(
  db.prepare(`
    SELECT
      generation,
      fuente,
      periodo_desde,
      periodo_hasta,
      registros_leidos,
      registros_in_scope,
      registros_ignorados,
      registros_legacy,
      estado
    FROM historical_bootstrap_batches
    WHERE fuente = 'COBROS_MOVIMIENTOS'
    ORDER BY id
    LIMIT 1
  `).get()
);

console.log("\n=== EVENTO COBRO CONFIRMADO ===");
console.log(
  db.prepare(`
    SELECT
      documento_normalizado,
      tipo_evento,
      importe,
      ocurrido_en,
      referencia_externa
    FROM documento_eventos
    WHERE fuente = 'COBROS_MOVIMIENTOS'
      AND tipo_evento = 'COBRO_CONFIRMADO'
    ORDER BY id
  `).all()
);

console.log("\n=== INVARIANTE FECHA EFECTIVA ===");
console.log(
  db.prepare(`
    SELECT COUNT(*) AS inconsistencias
    FROM documento_eventos e
    JOIN cobros_movimientos_importados m
      ON m.documento_relacionado_normalizado = e.documento_normalizado
     AND ABS(COALESCE(m.valor,0) - COALESCE(e.importe,0)) < 0.005
    WHERE e.fuente = 'COBROS_MOVIMIENTOS'
      AND e.tipo_evento = 'COBRO_CONFIRMADO'
      AND COALESCE(m.fecha_movimiento,'') <> ''
      AND e.ocurrido_en <> m.fecha_movimiento
  `).get()
);

db.close();
