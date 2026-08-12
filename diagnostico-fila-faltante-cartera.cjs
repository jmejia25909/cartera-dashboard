const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

const OFICIAL = 912706.94;

console.log("\n=== 1. UNIVERSO COMPLETO DOCUMENTOS ===");

console.log(db.prepare(`
  SELECT
    COUNT(*) AS filas,
    ROUND(SUM(COALESCE(total,0)),2) AS total,
    ROUND(SUM(COALESCE(valor_documento,0)),2) AS valor_documento,
    ROUND(SUM(COALESCE(saldo_pendiente,0)),2) AS saldo_pendiente,
    ROUND(SUM(COALESCE(retenciones,0)),2) AS retenciones
  FROM documentos
  WHERE is_subtotal = 0
`).get());

console.log("\n=== 2. AGRUPADO POR ESTADO / ANULADO / POSICION ===");

console.log(db.prepare(`
  SELECT
    COALESCE(estado_documento,'NULL') AS estado,
    COALESCE(anulado,0) AS anulado,
    COALESCE(posicion_cartera,'NULL') AS posicion,
    COUNT(*) AS filas,
    ROUND(SUM(COALESCE(total,0)),2) AS total,
    ROUND(SUM(COALESCE(saldo_pendiente,0)),2) AS saldo
  FROM documentos
  WHERE is_subtotal = 0
  GROUP BY
    COALESCE(estado_documento,'NULL'),
    COALESCE(anulado,0),
    COALESCE(posicion_cartera,'NULL')
  ORDER BY anulado, posicion, estado
`).all());

console.log("\n=== 3. FILAS NO INCLUIDAS EN LOS 624 DEUDA_VIVA ===");

console.log(db.prepare(`
  SELECT
    id,
    documento,
    tipo_documento,
    cliente,
    fecha_emision,
    total,
    valor_documento,
    saldo_pendiente,
    retenciones,
    estado_documento,
    anulado,
    posicion_cartera,
    estado_confirmacion,
    estado_fuente,
    credito_fuente
  FROM documentos
  WHERE is_subtotal = 0
    AND NOT (
      COALESCE(anulado,0) = 0
      AND COALESCE(estado_documento,'ACTIVO') <> 'ANULADO'
      AND COALESCE(posicion_cartera,'DEUDA_VIVA') = 'DEUDA_VIVA'
      AND COALESCE(total,0) > 0
    )
  ORDER BY ABS(COALESCE(total,0)) DESC
`).all());

console.log("\n=== 4. ESTADOS FUENTE ===");

console.log(db.prepare(`
  SELECT
    COALESCE(estado_fuente,'NULL') AS estado_fuente,
    COUNT(*) AS filas,
    ROUND(SUM(COALESCE(total,0)),2) AS total
  FROM documentos
  WHERE is_subtotal = 0
  GROUP BY COALESCE(estado_fuente,'NULL')
  ORDER BY filas DESC
`).all());

console.log("\n=== 5. ESTADOS CONFIRMACION ===");

console.log(db.prepare(`
  SELECT
    COALESCE(estado_confirmacion,'NULL') AS estado_confirmacion,
    COUNT(*) AS filas,
    ROUND(SUM(COALESCE(total,0)),2) AS total
  FROM documentos
  WHERE is_subtotal = 0
  GROUP BY COALESCE(estado_confirmacion,'NULL')
  ORDER BY filas DESC
`).all());

console.log("\n=== 6. SUMAS ALTERNATIVAS DEL SNAPSHOT ACTIVO ===");

const r = db.prepare(`
  SELECT
    ROUND(SUM(
      CASE WHEN COALESCE(anulado,0)=0
      THEN COALESCE(total,0) ELSE 0 END
    ),2) AS total_no_anulados,

    ROUND(SUM(
      CASE WHEN COALESCE(anulado,0)=0
      THEN COALESCE(valor_documento,0) ELSE 0 END
    ),2) AS valor_documento_no_anulados,

    ROUND(SUM(
      CASE WHEN COALESCE(anulado,0)=0
      THEN COALESCE(saldo_pendiente,0) ELSE 0 END
    ),2) AS saldo_no_anulados
  FROM documentos
  WHERE is_subtotal = 0
`).get();

console.log(r);

console.log("\n=== 7. COMPARACION CONTRA CONTIFICO ===");

for (const [campo, valor] of Object.entries(r)) {
  console.log({
    campo,
    valor,
    oficial: OFICIAL,
    diferencia: Number((Number(valor || 0) - OFICIAL).toFixed(2))
  });
}

console.log("\n=== 8. BUSCAR COMBINACIONES SOSPECHOSAS ===");

console.log(db.prepare(`
  SELECT
    documento,
    tipo_documento,
    cliente,
    total,
    valor_documento,
    saldo_pendiente,
    retenciones,
    estado_documento,
    anulado,
    posicion_cartera
  FROM documentos
  WHERE is_subtotal = 0
    AND (
      ABS(COALESCE(total,0)) BETWEEN 1000 AND 1100
      OR ABS(COALESCE(valor_documento,0)) BETWEEN 1000 AND 1100
      OR ABS(COALESCE(saldo_pendiente,0)) BETWEEN 1000 AND 1100
    )
  ORDER BY ABS(COALESCE(total,0)) DESC
`).all());

db.close();
