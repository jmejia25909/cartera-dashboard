const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

const OFICIAL = 912706.94;
const DASHBOARD = 946908.47;
const OBJETIVO = Number((DASHBOARD - OFICIAL).toFixed(2));

console.log("\n==============================================");
console.log(" DIAGNOSTICO FORENSE DIFERENCIA CARTERA");
console.log("==============================================");
console.log({
  contifico: OFICIAL,
  sqlite: DASHBOARD,
  diferencia_objetivo: OBJETIVO
});

const BASE = `
  is_subtotal = 0
  AND COALESCE(anulado,0) = 0
  AND COALESCE(estado_documento,'') <> 'ANULADO'
  AND COALESCE(posicion_cartera,'DEUDA_VIVA') = 'DEUDA_VIVA'
  AND COALESCE(saldo_pendiente,0) > 0
`;

function show(title, sql) {
  console.log(`\n=== ${title} ===`);
  console.log(db.prepare(sql).all());
}

/* ============================================================
   1. ESTADO DOCUMENTO
   ============================================================ */

show(
  "1. POR ESTADO_DOCUMENTO",
  `
  SELECT
    COALESCE(estado_documento,'(NULL)') estado_documento,
    COUNT(*) documentos,
    ROUND(SUM(saldo_pendiente),2) saldo
  FROM documentos
  WHERE ${BASE}
  GROUP BY COALESCE(estado_documento,'(NULL)')
  ORDER BY saldo DESC
  `
);

/* ============================================================
   2. ESTADO CONFIRMACION
   ============================================================ */

show(
  "2. POR ESTADO_CONFIRMACION",
  `
  SELECT
    COALESCE(estado_confirmacion,'(NULL)') estado_confirmacion,
    COUNT(*) documentos,
    ROUND(SUM(saldo_pendiente),2) saldo
  FROM documentos
  WHERE ${BASE}
  GROUP BY COALESCE(estado_confirmacion,'(NULL)')
  ORDER BY saldo DESC
  `
);

/* ============================================================
   3. ESTADO FUENTE
   ============================================================ */

show(
  "3. POR ESTADO_FUENTE",
  `
  SELECT
    COALESCE(estado_fuente,'(NULL)') estado_fuente,
    COUNT(*) documentos,
    ROUND(SUM(saldo_pendiente),2) saldo
  FROM documentos
  WHERE ${BASE}
  GROUP BY COALESCE(estado_fuente,'(NULL)')
  ORDER BY saldo DESC
  `
);

/* ============================================================
   4. CREDITO FUENTE
   ============================================================ */

show(
  "4. POR CREDITO_FUENTE",
  `
  SELECT
    COALESCE(NULLIF(TRIM(credito_fuente),''),'(VACIO)') credito_fuente,
    COUNT(*) documentos,
    ROUND(SUM(saldo_pendiente),2) saldo
  FROM documentos
  WHERE ${BASE}
  GROUP BY COALESCE(NULLIF(TRIM(credito_fuente),''),'(VACIO)')
  ORDER BY saldo DESC
  `
);

/* ============================================================
   5. CREDITO PENDIENTE
   ============================================================ */

show(
  "5. POR CREDITO_PENDIENTE",
  `
  SELECT
    credito_pendiente,
    COUNT(*) documentos,
    ROUND(SUM(saldo_pendiente),2) saldo
  FROM documentos
  WHERE ${BASE}
  GROUP BY credito_pendiente
  ORDER BY saldo DESC
  `
);

/* ============================================================
   6. TIPO DOCUMENTO
   ============================================================ */

show(
  "6. POR TIPO_DOCUMENTO",
  `
  SELECT
    COALESCE(tipo_documento,'(NULL)') tipo_documento,
    COUNT(*) documentos,
    ROUND(SUM(saldo_pendiente),2) saldo
  FROM documentos
  WHERE ${BASE}
  GROUP BY COALESCE(tipo_documento,'(NULL)')
  ORDER BY saldo DESC
  `
);

/* ============================================================
   7. AÑO DE EMISION
   ============================================================ */

show(
  "7. POR AÑO EMISION",
  `
  SELECT
    SUBSTR(fecha_emision,1,4) anio,
    COUNT(*) documentos,
    ROUND(SUM(saldo_pendiente),2) saldo
  FROM documentos
  WHERE ${BASE}
  GROUP BY SUBSTR(fecha_emision,1,4)
  ORDER BY anio
  `
);

/* ============================================================
   8. MES DE EMISION
   ============================================================ */

show(
  "8. POR MES EMISION",
  `
  SELECT
    SUBSTR(fecha_emision,1,7) mes,
    COUNT(*) documentos,
    ROUND(SUM(saldo_pendiente),2) saldo
  FROM documentos
  WHERE ${BASE}
  GROUP BY SUBSTR(fecha_emision,1,7)
  ORDER BY mes
  `
);

/* ============================================================
   9. DOCUMENTOS CON COBROS
   ============================================================ */

console.log("\n=== 9. EFECTO COLUMNA COBROS ===");

console.log(
  db.prepare(`
    SELECT
      COUNT(*) documentos,
      ROUND(SUM(COALESCE(cobros,0)),2) cobros,
      ROUND(SUM(saldo_pendiente),2) saldo,
      ROUND(SUM(valor_documento),2) valor_documento,
      ROUND(SUM(retenciones),2) retenciones
    FROM documentos
    WHERE ${BASE}
      AND ABS(COALESCE(cobros,0)) > 0.004
  `).get()
);

/* ============================================================
   10. IDENTIDAD FINANCIERA
   ============================================================ */

console.log("\n=== 10. IDENTIDAD VALOR - RETENCIONES - COBROS ===");

console.log(
  db.prepare(`
    SELECT
      COUNT(*) documentos,

      ROUND(SUM(valor_documento),2) valor_documento,

      ROUND(SUM(retenciones),2) retenciones,

      ROUND(SUM(cobros),2) cobros,

      ROUND(
        SUM(
          COALESCE(valor_documento,0)
          - COALESCE(retenciones,0)
          - COALESCE(cobros,0)
        ),
        2
      ) calculado,

      ROUND(SUM(saldo_pendiente),2) saldo_pendiente

    FROM documentos
    WHERE ${BASE}
  `).get()
);

/* ============================================================
   11. DIFERENCIA POR DOCUMENTO ENTRE FORMULA Y SALDO
   ============================================================ */

show(
  "11. DIFERENCIAS FORMULA VS SALDO",
  `
  SELECT
    id,
    cliente,
    documento,
    fecha_emision,
    valor_documento,
    retenciones,
    cobros,
    saldo_pendiente,

    ROUND(
      (
        COALESCE(valor_documento,0)
        - COALESCE(retenciones,0)
        - COALESCE(cobros,0)
      )
      - COALESCE(saldo_pendiente,0),
      2
    ) diferencia

  FROM documentos

  WHERE ${BASE}

    AND ABS(
      (
        COALESCE(valor_documento,0)
        - COALESCE(retenciones,0)
        - COALESCE(cobros,0)
      )
      - COALESCE(saldo_pendiente,0)
    ) > 0.004

  ORDER BY ABS(diferencia) DESC
  `
);

/* ============================================================
   12. DOCUMENTOS MAS GRANDES
   ============================================================ */

show(
  "12. TOP 50 SALDOS",
  `
  SELECT
    id,
    cliente,
    documento,
    fecha_emision,
    fecha_vencimiento,
    tipo_documento,
    estado_documento,
    estado_confirmacion,
    estado_fuente,
    credito_fuente,
    credito_pendiente,
    valor_documento,
    retenciones,
    cobros,
    saldo_pendiente
  FROM documentos
  WHERE ${BASE}
  ORDER BY saldo_pendiente DESC
  LIMIT 50
  `
);

/* ============================================================
   13. BUSQUEDA COMBINATORIA DE GRUPOS
   Intenta localizar una categoría cuyo saldo sea 34,201.53.
   ============================================================ */

const dimensions = [
  "estado_documento",
  "estado_confirmacion",
  "estado_fuente",
  "credito_fuente",
  "credito_pendiente",
  "tipo_documento"
];

console.log("\n=== 13. GRUPOS CERCANOS A $34,201.53 ===");

for (const dimension of dimensions) {

  const rows = db.prepare(`
    SELECT
      COALESCE(CAST(${dimension} AS TEXT),'(NULL)') valor,
      COUNT(*) documentos,
      ROUND(SUM(saldo_pendiente),2) saldo
    FROM documentos
    WHERE ${BASE}
    GROUP BY ${dimension}
  `).all();

  for (const row of rows) {

    const diferencia = Math.abs(
      Number(row.saldo ?? 0) - OBJETIVO
    );

    if (diferencia <= 5000) {
      console.log({
        dimension,
        valor: row.valor,
        documentos: row.documentos,
        saldo: row.saldo,
        distancia_objetivo: Number(diferencia.toFixed(2))
      });
    }
  }
}

/* ============================================================
   14. CONTROL FINAL
   ============================================================ */

console.log("\n=== 14. CONTROL ===");

const control = db.prepare(`
  SELECT
    COUNT(*) documentos,
    ROUND(SUM(saldo_pendiente),2) cartera
  FROM documentos
  WHERE ${BASE}
`).get();

console.log({
  ...control,
  contifico: OFICIAL,
  exceso: Number(
    (Number(control.cartera) - OFICIAL).toFixed(2)
  )
});

console.log("\n==============================================");
console.log(" FIN DIAGNOSTICO FORENSE");
console.log("==============================================");

db.close();
