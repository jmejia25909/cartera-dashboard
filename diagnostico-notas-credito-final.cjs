const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

console.log("\n=== BATCHES NOTAS DE CREDITO ===");
console.log(
  db.prepare(`
    SELECT
      id,
      generation,
      fuente,
      periodo_desde,
      periodo_hasta,
      estado,
      registros_leidos,
      registros_in_scope,
      registros_legacy
    FROM historical_bootstrap_batches
    WHERE fuente = 'NOTAS_CREDITO'
    ORDER BY periodo_desde
  `).all()
);

console.log("\n=== RESUMEN NOTAS DE CREDITO ===");
console.log(
  db.prepare(`
    SELECT
      COUNT(*) AS total,
      COUNT(DISTINCT numero_nc) AS nc_unicas,
      MIN(fecha_nc) AS fecha_minima,
      MAX(fecha_nc) AS fecha_maxima,
      ROUND(SUM(COALESCE(total_nc,0)),2) AS valor_total
    FROM notas_credito_importadas
  `).get()
);

console.log("\n=== ESTADOS DE CONCILIACION NC ===");
console.log(
  db.prepare(`
    SELECT
      estado_conciliacion,
      COUNT(*) AS cantidad,
      ROUND(SUM(COALESCE(total_nc,0)),2) AS valor
    FROM notas_credito_importadas
    GROUP BY estado_conciliacion
    ORDER BY estado_conciliacion
  `).all()
);

console.log("\n=== IMPORTACIONES NC ===");
console.log(
  db.prepare(`
    SELECT
      id,
      periodo_desde,
      periodo_hasta,
      registros_leidos,
      registros_importados,
      registros_ignorados,
      registros_duplicados,
      estado,
      observacion
    FROM importaciones
    WHERE tipo = 'NOTAS_CREDITO'
    ORDER BY periodo_desde
  `).all()
);

console.log("\n=== EVENTOS NC ===");
console.log(
  db.prepare(`
    SELECT
      tipo_evento,
      COUNT(*) AS cantidad,
      ROUND(SUM(COALESCE(importe,0)),2) AS importe,
      MIN(ocurrido_en) AS desde,
      MAX(ocurrido_en) AS hasta
    FROM documento_eventos
    WHERE fuente = 'NOTAS_CREDITO'
       OR tipo_evento LIKE '%NOTA_CREDITO%'
    GROUP BY tipo_evento
    ORDER BY tipo_evento
  `).all()
);

console.log("\n=== CONTROL ===");
console.log(
  db.prepare(`
    SELECT *
    FROM reconciliation_control
    WHERE id = 1
  `).get()
);

db.close();
