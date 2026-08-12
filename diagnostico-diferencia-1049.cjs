const Database = require("better-sqlite3");

const db = new Database(
  String.raw`C:\Proyectos\cartera-dashboard-test-data\data\cartera.db`,
  { readonly: true }
);

const OFICIAL_CONTIFICO = 912706.94;

console.log("\n=== 1. ULTIMA IMPORTACION CARTERA ===");

const imp = db.prepare(`
  SELECT *
  FROM importaciones
  WHERE tipo = 'CARTERA'
     OR tipo = 'CARTERA_CONTIFICO'
  ORDER BY id DESC
  LIMIT 1
`).get();

console.log(imp);

console.log("\n=== 2. ESTRUCTURA TABLA DOCUMENTOS ===");

const columns = db.prepare(`
  PRAGMA table_info(documentos)
`).all();

console.log(
  columns.map(c => c.name)
);

console.log("\n=== 3. PROYECCION VIVA ACTUAL ===");

const viva = db.prepare(`
  SELECT
    COUNT(*) AS documentos,
    ROUND(SUM(COALESCE(total,0)),2) AS total,
    ROUND(SUM(COALESCE(saldo_pendiente,0)),2) AS saldo_pendiente,
    ROUND(SUM(COALESCE(retenciones,0)),2) AS retenciones
  FROM documentos
  WHERE is_subtotal = 0
    AND COALESCE(anulado,0) = 0
    AND COALESCE(estado_documento,'ACTIVO') <> 'ANULADO'
    AND COALESCE(posicion_cartera,'DEUDA_VIVA') = 'DEUDA_VIVA'
    AND COALESCE(total,0) > 0
`).get();

console.log(viva);

console.log("\n=== 4. CREDITOS VIVOS ===");

const creditos = db.prepare(`
  SELECT
    COUNT(*) AS documentos,
    ROUND(SUM(COALESCE(total,0)),2) AS total,
    ROUND(SUM(COALESCE(saldo_pendiente,0)),2) AS saldo_pendiente
  FROM documentos
  WHERE is_subtotal = 0
    AND COALESCE(anulado,0) = 0
    AND COALESCE(estado_documento,'ACTIVO') <> 'ANULADO'
    AND COALESCE(posicion_cartera,'DEUDA_VIVA') = 'CREDITO_VIVO'
`).get();

console.log(creditos);

console.log("\n=== 5. TODAS LAS POSICIONES DE CARTERA ===");

console.log(
  db.prepare(`
    SELECT
      COALESCE(posicion_cartera,'NULL') AS posicion,
      COUNT(*) AS documentos,
      ROUND(SUM(COALESCE(total,0)),2) AS total,
      ROUND(SUM(COALESCE(saldo_pendiente,0)),2) AS saldo
    FROM documentos
    WHERE is_subtotal = 0
      AND COALESCE(anulado,0) = 0
      AND COALESCE(estado_documento,'ACTIVO') <> 'ANULADO'
    GROUP BY COALESCE(posicion_cartera,'NULL')
    ORDER BY posicion
  `).all()
);

console.log("\n=== 6. DOCUMENTOS EXCLUIDOS DE DEUDA VIVA ===");

console.log(
  db.prepare(`
    SELECT
      documento,
      cliente,
      razon_social,
      tipo_documento,
      total,
      saldo_pendiente,
      retenciones,
      posicion_cartera,
      estado_documento,
      anulado,
      credito_fuente,
      fecha_emision,
      fecha_vencimiento
    FROM documentos
    WHERE is_subtotal = 0
      AND COALESCE(anulado,0) = 0
      AND COALESCE(estado_documento,'ACTIVO') <> 'ANULADO'
      AND (
        COALESCE(posicion_cartera,'DEUDA_VIVA') <> 'DEUDA_VIVA'
        OR COALESCE(total,0) <= 0
      )
    ORDER BY ABS(COALESCE(total,0)) DESC
  `).all()
);

console.log("\n=== 7. DESCOMPOSICION DEL KPI ===");

const gross = Number(viva.total || 0);
const credit = Math.abs(Number(creditos.total || 0));

console.log({
  carteraBrutaDashboard: gross,
  creditosVivos: credit,
  carteraNetaDashboard: Number((gross - credit).toFixed(2)),
  oficialContifico: OFICIAL_CONTIFICO,
  diferenciaBrutaVsOficial: Number((gross - OFICIAL_CONTIFICO).toFixed(2)),
  diferenciaNetaVsOficial: Number((gross - credit - OFICIAL_CONTIFICO).toFixed(2))
});

console.log("\n=== 8. BUSQUEDA DE IMPORTES CERCANOS A 1049.06 ===");

console.log(
  db.prepare(`
    SELECT
      documento,
      cliente,
      razon_social,
      tipo_documento,
      total,
      saldo_pendiente,
      retenciones,
      posicion_cartera,
      estado_documento,
      credito_fuente
    FROM documentos
    WHERE is_subtotal = 0
      AND (
        ABS(ABS(COALESCE(total,0)) - 1049.06) < 5
        OR ABS(ABS(COALESCE(saldo_pendiente,0)) - 1049.06) < 5
        OR ABS(ABS(COALESCE(retenciones,0)) - 1049.06) < 5
      )
    ORDER BY ABS(COALESCE(total,0)) DESC
  `).all()
);

console.log("\n=== 9. DOCUMENTOS DEL SNAPSHOT RECIENTE POR FUENTE ===");

console.log(
  db.prepare(`
    SELECT
      COALESCE(fuente,'NULL') AS fuente,
      COUNT(*) AS documentos,
      ROUND(SUM(COALESCE(total,0)),2) AS total,
      ROUND(SUM(COALESCE(saldo_pendiente,0)),2) AS saldo
    FROM documentos
    WHERE is_subtotal = 0
      AND COALESCE(anulado,0) = 0
      AND COALESCE(estado_documento,'ACTIVO') <> 'ANULADO'
    GROUP BY COALESCE(fuente,'NULL')
    ORDER BY documentos DESC
  `).all()
);

console.log("\n=== 10. INVARIANTE OBJETIVO ===");

console.log({
  esperadoContifico: OFICIAL_CONTIFICO,
  obtenidoDashboard: gross,
  diferencia: Number((gross - OFICIAL_CONTIFICO).toFixed(2)),
  cuadra: Math.abs(gross - OFICIAL_CONTIFICO) < 0.005
});

db.close();
