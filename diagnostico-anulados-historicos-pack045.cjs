const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

console.log("\n=== ANULADOS HISTORICOS ===");

console.log(
  db.prepare(`
    SELECT
      resultado,
      COUNT(*) AS cantidad,
      MIN(fecha_anulacion) AS fecha_minima,
      MAX(fecha_anulacion) AS fecha_maxima
    FROM documentos_anulados_log
    GROUP BY resultado
    ORDER BY resultado
  `).all()
);

console.log("\n=== TOTAL LOG ANULADOS ===");

console.log(
  db.prepare(`
    SELECT COUNT(*) AS cantidad
    FROM documentos_anulados_log
  `).get()
);

console.log("\n=== ULTIMA IMPORTACION ANULADOS ===");

console.log(
  db.prepare(`
    SELECT *
    FROM importaciones
    WHERE tipo LIKE '%ANUL%'
    ORDER BY id DESC
    LIMIT 1
  `).get()
);

console.log("\n=== BATCHES HISTORICOS ===");

console.log(
  db.prepare(`
    SELECT *
    FROM historical_bootstrap_batches
    ORDER BY id DESC
    LIMIT 10
  `).all()
);

console.log("\n=== EVENTOS DE ANULACION ===");

console.log(
  db.prepare(`
    SELECT
      tipo_evento,
      COUNT(*) AS cantidad,
      MIN(creado_en) AS primero,
      MAX(creado_en) AS ultimo
    FROM documento_eventos
    WHERE tipo_evento LIKE '%ANUL%'
    GROUP BY tipo_evento
    ORDER BY tipo_evento
  `).all()
);

db.close();
