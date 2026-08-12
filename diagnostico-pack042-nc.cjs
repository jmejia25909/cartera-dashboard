const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

console.log("\n=== IMPORTACION NOTAS DE CREDITO ===");
console.table(
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
    WHERE tipo = 'NOTAS_CREDITO'
    ORDER BY id DESC
  `).all()
);

console.log("\n=== NOTAS DE CREDITO IMPORTADAS ===");
console.log(
  db.prepare(`
    SELECT
      COUNT(*) AS total,
      ROUND(SUM(total_nc),2) AS valor_total
    FROM notas_credito_importadas
  `).get()
);

console.log("\n=== ESTADOS DE CONCILIACION ===");
console.table(
  db.prepare(`
    SELECT
      estado_conciliacion,
      COUNT(*) AS cantidad,
      ROUND(SUM(total_nc),2) AS valor
    FROM notas_credito_importadas
    GROUP BY estado_conciliacion
  `).all()
);

console.log("\n=== EVENTOS NC ===");
console.table(
  db.prepare(`
    SELECT
      tipo_evento,
      fuente,
      COUNT(*) AS cantidad,
      ROUND(SUM(COALESCE(importe,0)),2) AS valor
    FROM documento_eventos
    WHERE fuente = 'NOTAS_CREDITO'
       OR tipo_evento = 'NOTA_CREDITO_APLICADA'
    GROUP BY tipo_evento, fuente
  `).all()
);

console.log("\n=== MUESTRA NC PENDIENTES ===");
console.table(
  db.prepare(`
    SELECT
      numero_nc,
      documento_relacionado,
      total_nc,
      estado_conciliacion
    FROM notas_credito_importadas
    ORDER BY id
    LIMIT 10
  `).all()
);

db.close();
