const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

console.log("\n=== ULTIMOS SNAPSHOTS ===");

console.log(
  db.prepare(`
    SELECT *
    FROM cartera_snapshots
    ORDER BY id DESC
    LIMIT 5
  `).all()
);

console.log("\n=== ULTIMAS IMPORTACIONES CARTERA ===");

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
    LIMIT 5
  `).all()
);

console.log("\n=== EVENTOS INCREMENTALES TOTALES ===");

console.log(
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

console.log("\n=== ULTIMOS EVENTOS ===");

console.log(
  db.prepare(`
    SELECT
      id,
      documento_id,
      tipo_evento,
      importe,
      creado_en
    FROM documento_eventos
    WHERE tipo_evento IN (
      'CARTERA_SNAPSHOT',
      'SALDO_REDUCIDO',
      'SALDO_INCREMENTADO',
      'DOCUMENTO_DESAPARECIDO'
    )
    ORDER BY id DESC
    LIMIT 10
  `).all()
);

db.close();
