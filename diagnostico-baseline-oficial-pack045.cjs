const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

function exists(table) {
  return Boolean(
    db.prepare(`
      SELECT 1
      FROM sqlite_master
      WHERE type = 'table' AND name = ?
    `).get(table)
  );
}

console.log("\n=== 1. CONTROL DE RECONCILIACION ===");
console.log(
  db.prepare(`
    SELECT *
    FROM reconciliation_control
    WHERE id = 1
  `).get()
);

console.log("\n=== 2. ULTIMA IMPORTACION DE CARTERA ===");
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
      observacion,
      importado_en
    FROM importaciones
    WHERE tipo = 'CARTERA'
    ORDER BY id DESC
    LIMIT 1
  `).get()
);

console.log("\n=== 3. SNAPSHOT BASELINE ===");
console.log(
  db.prepare(`
    SELECT *
    FROM cartera_snapshots
    ORDER BY id DESC
    LIMIT 1
  `).get()
);

console.log("\n=== 4. DOCUMENTOS DEL SNAPSHOT ===");
console.log(
  db.prepare(`
    SELECT COUNT(*) AS cantidad
    FROM cartera_snapshot_documentos
    WHERE snapshot_id = (
      SELECT id
      FROM cartera_snapshots
      ORDER BY id DESC
      LIMIT 1
    )
  `).get()
);

console.log("\n=== 5. DOCUMENTOS TABLA PRINCIPAL ===");
console.log(
  db.prepare(`
    SELECT
      COUNT(*) AS filas_totales,
      SUM(CASE WHEN is_subtotal = 0 THEN 1 ELSE 0 END) AS documentos_reales,
      SUM(CASE WHEN is_subtotal = 1 THEN 1 ELSE 0 END) AS subtotales,
      SUM(
        CASE
          WHEN is_subtotal = 0
           AND COALESCE(anulado,0) = 0
           AND COALESCE(saldo_pendiente,total,0) > 0
          THEN 1 ELSE 0
        END
      ) AS documentos_activos,
      ROUND(SUM(
        CASE
          WHEN is_subtotal = 0
           AND COALESCE(anulado,0) = 0
           AND COALESCE(saldo_pendiente,total,0) > 0
          THEN COALESCE(saldo_pendiente,total,0)
          ELSE 0
        END
      ),2) AS saldo_activo
    FROM documentos
  `).get()
);

console.log("\n=== 6. DESGLOSE POR TIPO ===");
console.log(
  db.prepare(`
    SELECT
      tipo_documento,
      COUNT(*) AS cantidad,
      ROUND(SUM(COALESCE(saldo_pendiente,total,0)),2) AS saldo
    FROM documentos
    WHERE is_subtotal = 0
    GROUP BY tipo_documento
    ORDER BY cantidad DESC
  `).all()
);

console.log("\n=== 7. EVENTOS DEL BASELINE ===");
console.log(
  db.prepare(`
    SELECT
      tipo_evento,
      COUNT(*) AS cantidad,
      ROUND(SUM(COALESCE(importe,0)),2) AS importe
    FROM documento_eventos
    GROUP BY tipo_evento
    ORDER BY tipo_evento
  `).all()
);

console.log("\n=== 8. DESAPARICIONES ===");
console.log(
  db.prepare(`
    SELECT COUNT(*) AS cantidad
    FROM documento_eventos
    WHERE tipo_evento = 'DOCUMENTO_DESAPARECIDO'
  `).get()
);

console.log("\n=== 9. SNAPSHOTS EXISTENTES ===");
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
    ORDER BY id
  `).all()
);

console.log("\n=== 10. TABLAS HISTORICAS PACK045 ===");

for (const table of [
  "historical_bootstrap_batches",
  "notas_credito_importadas",
  "cobros_movimientos_importados",
  "documentos_anulados_log"
]) {
  if (!exists(table)) {
    console.log(`${table}: NO EXISTE`);
    continue;
  }

  const result = db
    .prepare(`SELECT COUNT(*) AS cantidad FROM "${table}"`)
    .get();

  console.log(`${table}: ${result.cantidad}`);
}

db.close();
