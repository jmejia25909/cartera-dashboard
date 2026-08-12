const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

console.log("\n=== POSICIONES CARTERA ===");

console.log(
  db.prepare(`
    SELECT
      COALESCE(posicion_cartera,'DEUDA_VIVA') AS posicion,
      COUNT(*) AS documentos,
      ROUND(SUM(COALESCE(total,0)),2) AS saldo
    FROM documentos
    WHERE is_subtotal = 0
    GROUP BY COALESCE(posicion_cartera,'DEUDA_VIVA')
    ORDER BY posicion
  `).all()
);

console.log("\n=== NCT NEGATIVAS ===");

console.log(
  db.prepare(`
    SELECT
      tipo_documento,
      documento,
      total,
      saldo_original,
      saldo_pendiente,
      estado_documento,
      posicion_cartera
    FROM documentos
    WHERE is_subtotal = 0
      AND tipo_documento = 'NCT'
      AND total < 0
    ORDER BY documento
  `).all()
);

console.log("\n=== DNA ===");

console.log(
  db.prepare(`
    SELECT
      tipo_documento,
      documento,
      total,
      saldo_original,
      saldo_pendiente,
      estado_documento,
      posicion_cartera
    FROM documentos
    WHERE is_subtotal = 0
      AND tipo_documento = 'DNA'
    ORDER BY documento
  `).all()
);

console.log("\n=== EVENTOS CREDITOS VIVOS ===");

console.log(
  db.prepare(`
    SELECT
      tipo_evento,
      COUNT(*) AS cantidad,
      ROUND(SUM(COALESCE(importe,0)),2) AS importe
    FROM documento_eventos
    WHERE tipo_evento LIKE 'CREDITO_VIVO%'
    GROUP BY tipo_evento
    ORDER BY tipo_evento
  `).all()
);

console.log("\n=== EVENTOS CARTERA NORMAL ===");

console.log(
  db.prepare(`
    SELECT
      tipo_evento,
      COUNT(*) AS cantidad,
      ROUND(SUM(COALESCE(importe,0)),2) AS importe
    FROM documento_eventos
    WHERE tipo_evento = 'CARTERA_SNAPSHOT'
    GROUP BY tipo_evento
  `).all()
);

console.log("\n=== METRICAS CONTABLES ===");

console.log(
  db.prepare(`
    SELECT
      ROUND(SUM(
        CASE
          WHEN is_subtotal = 0
           AND COALESCE(posicion_cartera,'DEUDA_VIVA') = 'DEUDA_VIVA'
           AND COALESCE(total,0) > 0
          THEN total
          ELSE 0
        END
      ),2) AS cartera_bruta,

      ROUND(ABS(SUM(
        CASE
          WHEN is_subtotal = 0
           AND COALESCE(posicion_cartera,'DEUDA_VIVA') = 'CREDITO_VIVO'
           AND COALESCE(total,0) < 0
          THEN total
          ELSE 0
        END
      )),2) AS creditos_vivos,

      ROUND(
        SUM(
          CASE
            WHEN is_subtotal = 0
             AND COALESCE(posicion_cartera,'DEUDA_VIVA') = 'DEUDA_VIVA'
             AND COALESCE(total,0) > 0
            THEN total
            ELSE 0
          END
        )
        +
        SUM(
          CASE
            WHEN is_subtotal = 0
             AND COALESCE(posicion_cartera,'DEUDA_VIVA') = 'CREDITO_VIVO'
             AND COALESCE(total,0) < 0
            THEN total
            ELSE 0
          END
        )
      ,2) AS posicion_neta
    FROM documentos
  `).get()
);

db.close();
