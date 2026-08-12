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

console.log("\n=== 2. SNAPSHOTS GENERACION 3 ===");

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

console.log("\n=== 3. EVENTOS GENERACION 3 ===");

console.log(
  db.prepare(`
    SELECT
      e.tipo_evento,
      e.fuente,
      COUNT(*) AS cantidad,
      ROUND(SUM(COALESCE(e.importe,0)),2) AS importe,
      MIN(e.ocurrido_en) AS desde,
      MAX(e.ocurrido_en) AS hasta
    FROM documento_eventos e
    LEFT JOIN importaciones i
      ON i.id = e.importacion_id
    WHERE COALESCE(i.reconciliation_generation,3) = 3
    GROUP BY e.tipo_evento, e.fuente
    ORDER BY e.fuente, e.tipo_evento
  `).all()
);

console.log("\n=== 4. EVENTOS SNAPSHOT CARTERA ===");

console.log(
  db.prepare(`
    SELECT
      e.tipo_evento,
      COUNT(*) AS cantidad,
      ROUND(SUM(COALESCE(e.importe,0)),2) AS importe
    FROM documento_eventos e
    JOIN importaciones i
      ON i.id = e.importacion_id
    WHERE i.tipo = 'CARTERA'
      AND i.reconciliation_generation = 3
    GROUP BY e.tipo_evento
    ORDER BY e.tipo_evento
  `).all()
);

console.log("\n=== 5. EVENTOS DEL ULTIMO SNAPSHOT ===");

console.log(
  db.prepare(`
    SELECT
      e.tipo_evento,
      COUNT(*) AS cantidad,
      ROUND(SUM(COALESCE(e.importe,0)),2) AS importe
    FROM documento_eventos e
    WHERE e.importacion_id = 27
    GROUP BY e.tipo_evento
    ORDER BY e.tipo_evento
  `).all()
);

console.log("\n=== 6. DOCUMENTOS ACTUALES ===");

console.log(
  db.prepare(`
    SELECT
      COUNT(*) AS filas,
      SUM(CASE WHEN is_subtotal = 0 THEN 1 ELSE 0 END) AS documentos_reales,
      ROUND(SUM(
        CASE
          WHEN is_subtotal = 0
          THEN COALESCE(total,0)
          ELSE 0
        END
      ),2) AS total_snapshot
    FROM documentos
  `).get()
);

console.log("\n=== 7. ESTADOS ACTUALES ===");

console.log(
  db.prepare(`
    SELECT
      COALESCE(posicion_cartera,'NULL') AS posicion,
      COALESCE(estado_documento,'NULL') AS estado,
      COUNT(*) AS cantidad,
      ROUND(SUM(COALESCE(total,0)),2) AS saldo
    FROM documentos
    WHERE is_subtotal = 0
    GROUP BY
      COALESCE(posicion_cartera,'NULL'),
      COALESCE(estado_documento,'NULL')
    ORDER BY posicion, estado
  `).all()
);

console.log("\n=== 8. DELTA SNAPSHOT 4 -> 5 ===");

console.log(
  db.prepare(`
    SELECT
      COUNT(*) AS eventos,
      MIN(ocurrido_en) AS desde,
      MAX(ocurrido_en) AS hasta
    FROM documento_eventos
    WHERE importacion_id = 27
  `).get()
);

db.close();
