const Database = require("better-sqlite3");

const dbPath = String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`;
const db = new Database(dbPath, { readonly: true });

console.log("\n=== ULTIMAS IMPORTACIONES ===");
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
    ORDER BY id DESC
    LIMIT 5
  `).all()
);

console.log("\n=== DOCUMENTOS ANULADOS EN PROYECCION ===");
console.log(
  db.prepare(`
    SELECT COUNT(*) AS cantidad
    FROM documentos
    WHERE COALESCE(anulado, 0) = 1
       OR estado_documento = 'ANULADO'
  `).get()
);

console.log("\n=== LOG DE ANULADOS ===");
console.log(
  db.prepare(`
    SELECT COUNT(*) AS cantidad
    FROM documentos_anulados_log
  `).get()
);

console.table(
  db.prepare(`
    SELECT
      resultado,
      COUNT(*) AS cantidad
    FROM documentos_anulados_log
    GROUP BY resultado
    ORDER BY cantidad DESC
  `).all()
);

console.log("\n=== EVENTOS DE ANULACION ===");
console.table(
  db.prepare(`
    SELECT
      tipo_evento,
      fuente,
      COUNT(*) AS cantidad
    FROM documento_eventos
    WHERE fuente = 'ANULADOS'
       OR tipo_evento IN ('ANULACION_CONFIRMADA','ESTADO_RECLASIFICADO','MOVIMIENTO_REVERTIDO')
    GROUP BY tipo_evento, fuente
    ORDER BY cantidad DESC
  `).all()
);

console.log("\n=== ABONOS REVERSADOS ===");
console.log(
  db.prepare(`
    SELECT COUNT(*) AS cantidad
    FROM abonos
    WHERE COALESCE(reversado, 0) = 1
  `).get()
);

console.log("\n=== CARTERA VIGENTE ===");
console.log(
  db.prepare(`
    SELECT
      COUNT(*) AS documentos,
      ROUND(SUM(COALESCE(total,0)), 2) AS saldo
    FROM documentos
    WHERE is_subtotal = 0
      AND COALESCE(anulado,0) = 0
      AND COALESCE(estado_documento,'ACTIVO') <> 'ANULADO'
  `).get()
);

db.close();
