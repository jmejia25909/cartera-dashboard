const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

console.log("\n=== 1. CONTROL ===");
console.log(
  db.prepare(`
    SELECT *
    FROM reconciliation_control
    WHERE id = 1
  `).get()
);

console.log("\n=== 2. SNAPSHOTS GENERACION ACTUAL ===");
console.log(
  db.prepare(`
    SELECT
      id,
      importacion_id,
      generation,
      fecha_snapshot,
      snapshot_anterior_id,
      cantidad_documentos,
      cantidad_legacy,
      baseline,
      creado_en
    FROM cartera_snapshots
    WHERE generation = 3
    ORDER BY id
  `).all()
);

console.log("\n=== 3. IMPORTACIONES DE CARTERA ===");
console.log(
  db.prepare(`
    SELECT
      id,
      tipo,
      archivo_nombre,
      registros_leidos,
      registros_importados,
      registros_ignorados,
      registros_duplicados,
      estado,
      reconciliation_generation,
      importado_en
    FROM importaciones
    WHERE tipo = 'CARTERA'
    ORDER BY id
  `).all()
);

console.log("\n=== 4. EVENTOS ENTRE SNAPSHOTS ===");
console.log(
  db.prepare(`
    SELECT
      tipo_evento,
      fuente,
      COUNT(*) AS cantidad,
      ROUND(SUM(COALESCE(importe,0)),2) AS importe
    FROM documento_eventos
    WHERE generation = 3
    GROUP BY tipo_evento, fuente
    ORDER BY fuente, tipo_evento
  `).all()
);

console.log("\n=== 5. EVENTOS POR FECHA EFECTIVA ===");
console.log(
  db.prepare(`
    SELECT
      MIN(ocurrido_en) AS desde,
      MAX(ocurrido_en) AS hasta,
      COUNT(*) AS eventos
    FROM documento_eventos
    WHERE generation = 3
  `).get()
);

console.log("\n=== 6. DOCUMENTOS ACTUALES ===");
console.log(
  db.prepare(`
    SELECT
      COUNT(*) AS filas,
      SUM(CASE WHEN is_subtotal = 0 THEN 1 ELSE 0 END) AS documentos_reales,
      ROUND(SUM(
        CASE
          WHEN is_subtotal = 0 THEN COALESCE(total,0)
          ELSE 0
        END
      ),2) AS total_snapshot
    FROM documentos
  `).get()
);

console.log("\n=== 7. ESTADOS DE CARTERA ===");
console.log(
  db.prepare(`
    SELECT
      COALESCE(posicion_cartera,'NULL') AS posicion,
      COALESCE(estado_documento,'NULL') AS estado,
      COUNT(*) AS cantidad,
      ROUND(SUM(COALESCE(total,0)),2) AS saldo
    FROM documentos
    WHERE is_subtotal = 0
    GROUP BY posicion_cartera, estado_documento
    ORDER BY posicion, estado
  `).all()
);

db.close();
