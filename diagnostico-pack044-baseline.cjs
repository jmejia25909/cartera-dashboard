const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

console.log("\n=== CONFIGURACION TEMPORAL ===");
console.log(
  db.prepare(`
    SELECT
      cutoff_date,
      operation_start_date,
      mode,
      generation,
      actualizado_en
    FROM reconciliation_control
    WHERE id = 1
  `).get()
);

console.log("\n=== ULTIMAS IMPORTACIONES CARTERA ===");
console.table(
  db.prepare(`
    SELECT
      id,
      archivo_nombre,
      estado,
      registros_leidos,
      registros_importados,
      registros_ignorados,
      registros_duplicados,
      reconciliation_generation,
      observacion,
      metadata_json,
      importado_en
    FROM importaciones
    WHERE tipo = 'CARTERA'
    ORDER BY id DESC
    LIMIT 3
  `).all()
);

console.log("\n=== SNAPSHOTS ===");
console.table(
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
      hash_contenido,
      creado_en
    FROM cartera_snapshots
    ORDER BY id DESC
    LIMIT 5
  `).all()
);

console.log("\n=== DOCUMENTOS DEL ULTIMO SNAPSHOT ===");
console.log(
  db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN temporal_scope = 'IN_SCOPE' THEN 1 ELSE 0 END) AS in_scope,
      SUM(CASE WHEN temporal_scope = 'OUT_OF_SCOPE_LEGACY' THEN 1 ELSE 0 END) AS legacy
    FROM cartera_snapshot_documentos
    WHERE snapshot_id = (
      SELECT id
      FROM cartera_snapshots
      ORDER BY id DESC
      LIMIT 1
    )
  `).get()
);

console.log("\n=== EVENTOS DEL MOTOR INCREMENTAL ===");
console.table(
  db.prepare(`
    SELECT
      tipo_evento,
      COUNT(*) AS cantidad,
      ROUND(SUM(COALESCE(importe,0)),2) AS importe
    FROM documento_eventos
    WHERE tipo_evento IN (
      'CARTERA_SNAPSHOT',
      'SALDO_REDUCIDO',
      'SALDO_INCREMENTADO',
      'DOCUMENTO_DESAPARECIDO'
    )
    GROUP BY tipo_evento
    ORDER BY tipo_evento
  `).all()
);

console.log("\n=== EVENTOS DE LA ULTIMA IMPORTACION CARTERA ===");
console.table(
  db.prepare(`
    SELECT
      tipo_evento,
      provisional,
      COUNT(*) AS cantidad,
      ROUND(SUM(COALESCE(importe,0)),2) AS importe
    FROM documento_eventos
    WHERE importacion_id = (
      SELECT id
      FROM importaciones
      WHERE tipo = 'CARTERA'
      ORDER BY id DESC
      LIMIT 1
    )
    GROUP BY tipo_evento, provisional
    ORDER BY tipo_evento
  `).all()
);

db.close();
