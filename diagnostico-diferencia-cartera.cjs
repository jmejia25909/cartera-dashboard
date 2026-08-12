const Database = require("better-sqlite3");

const DB_PATH =
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`;

const OFICIAL_CONTIFICO = 912706.94;

const db = new Database(DB_PATH, { readonly: true });

const money = (value) => Number(Number(value ?? 0).toFixed(2));

const printDiff = (label, value) => {
  const total = money(value);
  console.log({
    metrica: label,
    total,
    diferencia_vs_contifico: money(total - OFICIAL_CONTIFICO)
  });
};

console.log("\n====================================================");
console.log(" DIAGNOSTICO DIFERENCIA CARTERA CONTIFICO");
console.log("====================================================");
console.log("TOTAL OFICIAL CONTIFICO:", OFICIAL_CONTIFICO);

/* =========================================================
   0. ESTRUCTURA DE DOCUMENTOS
   ========================================================= */

console.log("\n=== 0. COLUMNAS TABLA DOCUMENTOS ===");

const columnas = db.prepare(`
  PRAGMA table_info(documentos)
`).all();

console.table(
  columnas.map(c => ({
    columna: c.name,
    tipo: c.type,
    nullable: c.notnull === 0
  }))
);

const columnNames = new Set(columnas.map(c => c.name));

const has = (column) => columnNames.has(column);

/* =========================================================
   1. SUMA FIEL POR COLUMNAS
   ========================================================= */

console.log("\n=== 1. SUMAS BASE DOCUMENTOS NO ANULADOS ===");

const baseWhere = `
  is_subtotal = 0
  AND COALESCE(anulado, 0) = 0
  AND COALESCE(estado_documento, '') <> 'ANULADO'
`;

const sums = db.prepare(`
  SELECT
    COUNT(*) AS documentos,

    ROUND(SUM(COALESCE(valor_documento,0)),2) AS valor_documento,

    ROUND(SUM(COALESCE(total,0)),2) AS total,

    ROUND(SUM(COALESCE(saldo_pendiente,0)),2) AS saldo_pendiente,

    ROUND(SUM(COALESCE(retenciones,0)),2) AS retenciones,

    ROUND(
      SUM(
        CASE
          WHEN COALESCE(posicion_cartera,'DEUDA_VIVA') = 'DEUDA_VIVA'
           AND COALESCE(total,0) > 0
          THEN total
          ELSE 0
        END
      ),2
    ) AS total_deuda_viva,

    ROUND(
      SUM(
        CASE
          WHEN COALESCE(posicion_cartera,'DEUDA_VIVA') = 'DEUDA_VIVA'
           AND COALESCE(saldo_pendiente,0) > 0
          THEN saldo_pendiente
          ELSE 0
        END
      ),2
    ) AS saldo_pendiente_deuda_viva,

    ROUND(
      SUM(
        CASE
          WHEN COALESCE(total,0) > 0
          THEN total - COALESCE(retenciones,0)
          ELSE 0
        END
      ),2
    ) AS total_menos_retenciones

  FROM documentos
  WHERE ${baseWhere}
`).get();

console.log(sums);

printDiff("SUM(valor_documento)", sums.valor_documento);
printDiff("SUM(total)", sums.total);
printDiff("SUM(saldo_pendiente)", sums.saldo_pendiente);
printDiff("DEUDA_VIVA / total", sums.total_deuda_viva);
printDiff(
  "DEUDA_VIVA / saldo_pendiente",
  sums.saldo_pendiente_deuda_viva
);
printDiff(
  "total positivo - retenciones",
  sums.total_menos_retenciones
);

/* =========================================================
   2. POSICION CARTERA
   ========================================================= */

console.log("\n=== 2. DESGLOSE POR POSICION CARTERA ===");

console.log(
  db.prepare(`
    SELECT
      COALESCE(posicion_cartera,'SIN_CLASIFICAR') AS posicion,
      COUNT(*) AS documentos,
      ROUND(SUM(COALESCE(valor_documento,0)),2) AS valor_documento,
      ROUND(SUM(COALESCE(total,0)),2) AS total,
      ROUND(SUM(COALESCE(saldo_pendiente,0)),2) AS saldo_pendiente,
      ROUND(SUM(COALESCE(retenciones,0)),2) AS retenciones
    FROM documentos
    WHERE ${baseWhere}
    GROUP BY COALESCE(posicion_cartera,'SIN_CLASIFICAR')
    ORDER BY posicion
  `).all()
);

/* =========================================================
   3. TIPOS DE DOCUMENTO
   ========================================================= */

console.log("\n=== 3. DESGLOSE POR TIPO DOCUMENTO ===");

console.log(
  db.prepare(`
    SELECT
      COALESCE(tipo_documento,'SIN_TIPO') AS tipo_documento,
      COUNT(*) AS cantidad,
      ROUND(SUM(COALESCE(valor_documento,0)),2) AS valor_documento,
      ROUND(SUM(COALESCE(total,0)),2) AS total,
      ROUND(SUM(COALESCE(saldo_pendiente,0)),2) AS saldo_pendiente,
      ROUND(SUM(COALESCE(retenciones,0)),2) AS retenciones
    FROM documentos
    WHERE ${baseWhere}
    GROUP BY COALESCE(tipo_documento,'SIN_TIPO')
    ORDER BY ABS(SUM(COALESCE(total,0))) DESC
  `).all()
);

/* =========================================================
   4. SUBTOTALES COLADOS
   ========================================================= */

console.log("\n=== 4. SUBTOTALES ===");

const subtotales = db.prepare(`
  SELECT
    COUNT(*) AS filas,
    ROUND(SUM(COALESCE(valor_documento,0)),2) AS valor_documento,
    ROUND(SUM(COALESCE(total,0)),2) AS total,
    ROUND(SUM(COALESCE(saldo_pendiente,0)),2) AS saldo_pendiente,
    ROUND(SUM(COALESCE(retenciones,0)),2) AS retenciones
  FROM documentos
  WHERE is_subtotal = 1
`).get();

console.log(subtotales);

/* =========================================================
   5. CREDITOS / LIQUIDACION AUTOMATICA
   ========================================================= */

console.log("\n=== 5. CREDITO FUENTE ===");

if (has("credito_fuente")) {
  console.log(
    db.prepare(`
      SELECT
        CASE
          WHEN TRIM(COALESCE(credito_fuente,'')) = ''
            THEN '(VACIO)'
          ELSE credito_fuente
        END AS credito_fuente,
        COUNT(*) AS cantidad,
        ROUND(SUM(COALESCE(valor_documento,0)),2) AS valor_documento,
        ROUND(SUM(COALESCE(total,0)),2) AS total,
        ROUND(SUM(COALESCE(saldo_pendiente,0)),2) AS saldo_pendiente
      FROM documentos
      WHERE ${baseWhere}
      GROUP BY
        CASE
          WHEN TRIM(COALESCE(credito_fuente,'')) = ''
            THEN '(VACIO)'
          ELSE credito_fuente
        END
      ORDER BY ABS(SUM(COALESCE(total,0))) DESC
    `).all()
  );

  console.log("\n=== LIQUIDACION_AUTOMATICA ===");

  console.log(
    db.prepare(`
      SELECT
        COUNT(*) AS cantidad,
        ROUND(SUM(COALESCE(valor_documento,0)),2) AS valor_documento,
        ROUND(SUM(COALESCE(total,0)),2) AS total,
        ROUND(SUM(COALESCE(saldo_pendiente,0)),2) AS saldo_pendiente
      FROM documentos
      WHERE ${baseWhere}
        AND credito_fuente = 'LIQUIDACION_AUTOMATICA'
    `).get()
  );
} else {
  console.log(
    "La tabla documentos no contiene columna credito_fuente."
  );
}

/* =========================================================
   6. RETENCIONES
   ========================================================= */

console.log("\n=== 6. DOCUMENTOS CON RETENCIONES ===");

const retenciones = db.prepare(`
  SELECT
    COUNT(*) AS documentos,
    ROUND(SUM(COALESCE(retenciones,0)),2) AS total_retenciones,
    ROUND(SUM(COALESCE(total,0)),2) AS total_documentos,
    ROUND(SUM(COALESCE(saldo_pendiente,0)),2) AS saldo_pendiente
  FROM documentos
  WHERE ${baseWhere}
    AND ABS(COALESCE(retenciones,0)) > 0.004
`).get();

console.log(retenciones);

console.log("\n=== TOP RETENCIONES ===");

console.log(
  db.prepare(`
    SELECT
      id,
      cliente,
      documento,
      tipo_documento,
      valor_documento,
      total,
      saldo_pendiente,
      retenciones
    FROM documentos
    WHERE ${baseWhere}
      AND ABS(COALESCE(retenciones,0)) > 0.004
    ORDER BY ABS(retenciones) DESC
    LIMIT 30
  `).all()
);

/* =========================================================
   7. SALDOS A FAVOR / NCT
   ========================================================= */

console.log("\n=== 7. CREDITOS VIVOS / NCT ===");

console.log(
  db.prepare(`
    SELECT
      COUNT(*) AS cantidad,
      ROUND(SUM(COALESCE(valor_documento,0)),2) AS valor_documento,
      ROUND(SUM(COALESCE(total,0)),2) AS total,
      ROUND(SUM(COALESCE(saldo_pendiente,0)),2) AS saldo_pendiente
    FROM documentos
    WHERE ${baseWhere}
      AND (
        COALESCE(posicion_cartera,'') = 'CREDITO_VIVO'
        OR COALESCE(tipo_documento,'') = 'NCT'
        OR COALESCE(total,0) < 0
      )
  `).get()
);

console.log("\n=== DETALLE CREDITOS VIVOS ===");

console.log(
  db.prepare(`
    SELECT
      id,
      cliente,
      documento,
      tipo_documento,
      valor_documento,
      total,
      saldo_pendiente,
      retenciones,
      posicion_cartera
    FROM documentos
    WHERE ${baseWhere}
      AND (
        COALESCE(posicion_cartera,'') = 'CREDITO_VIVO'
        OR COALESCE(tipo_documento,'') = 'NCT'
        OR COALESCE(total,0) < 0
      )
    ORDER BY ABS(COALESCE(total,0)) DESC
  `).all()
);

/* =========================================================
   8. DIFERENCIA DIRECTA ACTUAL
   ========================================================= */

console.log("\n=== 8. DIFERENCIA DASHBOARD VS CONTIFICO ===");

const carteraActual = money(
  db.prepare(`
    SELECT
      SUM(
        CASE
          WHEN is_subtotal = 0
           AND COALESCE(anulado,0) = 0
           AND COALESCE(estado_documento,'') <> 'ANULADO'
           AND COALESCE(posicion_cartera,'DEUDA_VIVA') = 'DEUDA_VIVA'
           AND COALESCE(total,0) > 0
          THEN total
          ELSE 0
        END
      ) AS cartera
    FROM documentos
  `).get().cartera
);

console.log({
  cartera_dashboard_actual: carteraActual,
  cartera_oficial_contifico: OFICIAL_CONTIFICO,
  diferencia: money(carteraActual - OFICIAL_CONTIFICO)
});

/* =========================================================
   9. CANDIDATOS QUE EXPLICAN DIFERENCIA
   ========================================================= */

console.log("\n=== 9. DOCUMENTOS CON TOTAL != SALDO_PENDIENTE ===");

const diferencias = db.prepare(`
  SELECT
    id,
    cliente,
    documento,
    tipo_documento,
    valor_documento,
    total,
    saldo_original,
    saldo_pendiente,
    retenciones,
    cobros,
    posicion_cartera,
    ROUND(
      COALESCE(total,0) - COALESCE(saldo_pendiente,0),
      2
    ) AS diferencia
  FROM documentos
  WHERE ${baseWhere}
    AND COALESCE(posicion_cartera,'DEUDA_VIVA') = 'DEUDA_VIVA'
    AND COALESCE(total,0) > 0
    AND ABS(
      COALESCE(total,0) - COALESCE(saldo_pendiente,0)
    ) > 0.004
  ORDER BY ABS(
    COALESCE(total,0) - COALESCE(saldo_pendiente,0)
  ) DESC
`);

const diffRows = diferencias.all();

console.log(diffRows);

console.log("\n=== SUMA DIFERENCIAS TOTAL - SALDO_PENDIENTE ===");

console.log({
  documentos: diffRows.length,
  diferencia_acumulada: money(
    diffRows.reduce(
      (acc, row) => acc + Number(row.diferencia ?? 0),
      0
    )
  )
});

/* =========================================================
   10. CANDIDATO SALDO VIVO ESTRICTO
   ========================================================= */

console.log("\n=== 10. CARTERA POR SALDO PENDIENTE ESTRICTO ===");

const saldoEstricto = db.prepare(`
  SELECT
    COUNT(*) AS documentos,
    ROUND(SUM(COALESCE(saldo_pendiente,0)),2) AS cartera
  FROM documentos
  WHERE ${baseWhere}
    AND COALESCE(posicion_cartera,'DEUDA_VIVA') = 'DEUDA_VIVA'
    AND COALESCE(saldo_pendiente,0) > 0
`).get();

console.log(saldoEstricto);

printDiff(
  "SALDO_PENDIENTE ESTRICTO",
  saldoEstricto.cartera
);

console.log("\n====================================================");
console.log(" FIN DIAGNOSTICO");
console.log("====================================================");

db.close();
