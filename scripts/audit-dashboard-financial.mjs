import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dbPath = process.argv[2];
const outputDir = process.argv[3];

if (!dbPath) {
  throw new Error("Falta la ruta de la base de datos temporal.");
}

if (!fs.existsSync(dbPath)) {
  throw new Error(`No existe la base: ${dbPath}`);
}

const db = new Database(dbPath, { readonly: true });

const scalar = (sql, params = []) => {
  const row = db.prepare(sql).get(...params);
  return Number(row?.v ?? row?.c ?? 0);
};

const row = (sql, params = []) => db.prepare(sql).get(...params);
const rows = (sql, params = []) => db.prepare(sql).all(...params);

const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, "0");
const firstDay = `${year}-${month}-01`;
const nextMonthDate = new Date(year, now.getMonth() + 1, 1);
const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}-01`;

const activeDocumentWhere = `
  is_subtotal = 0
  AND COALESCE(total, 0) > 0
  AND COALESCE(estado_documento, 'ACTIVO') <> 'ANULADO'
`;

const current = {
  carteraTotal: scalar(`
    SELECT COALESCE(SUM(total), 0) AS v
    FROM documentos
    WHERE is_subtotal = 0
  `),
  carteraVencida: scalar(`
    SELECT COALESCE(SUM(total), 0) AS v
    FROM documentos
    WHERE is_subtotal = 0
      AND total > 0
      AND date(fecha_vencimiento) < date('now', 'localtime')
  `),
  cobradoMesEtiquetaActual: scalar(`
    SELECT COALESCE(SUM(cobros), 0) AS v
    FROM documentos
    WHERE is_subtotal = 0
  `),
  clientesConSaldo: scalar(`
    SELECT COUNT(DISTINCT cliente) AS c
    FROM documentos
    WHERE is_subtotal = 0
      AND total > 0
      AND cliente IS NOT NULL
      AND cliente <> ''
  `),
  documentosPendientes: scalar(`
    SELECT COUNT(1) AS c
    FROM documentos
    WHERE is_subtotal = 0
      AND total > 0
  `),
};

const corrected = {
  carteraPendiente: scalar(`
    SELECT COALESCE(SUM(total), 0) AS v
    FROM documentos
    WHERE ${activeDocumentWhere}
  `),
  carteraVencida: scalar(`
    SELECT COALESCE(SUM(total), 0) AS v
    FROM documentos
    WHERE ${activeDocumentWhere}
      AND date(fecha_vencimiento) < date('now', 'localtime')
  `),
  mora90: scalar(`
    SELECT COALESCE(SUM(total), 0) AS v
    FROM documentos
    WHERE ${activeDocumentWhere}
      AND date(fecha_vencimiento) < date('now', 'localtime', '-90 day')
  `),
  cobrosDetectadosMes: scalar(`
    SELECT COALESCE(SUM(total_anterior - total_nuevo), 0) AS v
    FROM abonos
    WHERE COALESCE(reversado, 0) = 0
      AND COALESCE(estado, 'ACTIVO') = 'ACTIVO'
      AND (COALESCE(total_anterior, 0) - COALESCE(total_nuevo, 0)) > 0
      AND datetime(fecha) >= datetime(?)
      AND datetime(fecha) < datetime(?)
  `, [firstDay, nextMonth]),
  clientesConSaldo: scalar(`
    SELECT COUNT(DISTINCT cliente) AS c
    FROM documentos
    WHERE ${activeDocumentWhere}
      AND cliente IS NOT NULL
      AND cliente <> ''
  `),
  documentosPendientes: scalar(`
    SELECT COUNT(1) AS c
    FROM documentos
    WHERE ${activeDocumentWhere}
  `),
  vence7Dias: scalar(`
    SELECT COALESCE(SUM(total), 0) AS v
    FROM documentos
    WHERE ${activeDocumentWhere}
      AND date(fecha_vencimiento) >= date('now', 'localtime')
      AND date(fecha_vencimiento) <= date('now', 'localtime', '+7 day')
  `),
  vence8a30Dias: scalar(`
    SELECT COALESCE(SUM(total), 0) AS v
    FROM documentos
    WHERE ${activeDocumentWhere}
      AND date(fecha_vencimiento) > date('now', 'localtime', '+7 day')
      AND date(fecha_vencimiento) <= date('now', 'localtime', '+30 day')
  `),
  anuladosNoEncontrados: scalar(`
    SELECT COUNT(1) AS c
    FROM documentos_anulados_log
    WHERE resultado = 'NO_ENCONTRADO'
  `),
  clientesSinPolitica: scalar(`
    SELECT COUNT(DISTINCT d.cliente) AS c
    FROM documentos d
    LEFT JOIN clientes c
      ON c.cliente = d.cliente
    WHERE d.is_subtotal = 0
      AND COALESCE(d.total, 0) > 0
      AND COALESCE(d.estado_documento, 'ACTIVO') <> 'ANULADO'
      AND d.cliente IS NOT NULL
      AND TRIM(d.cliente) <> ''
      AND (
        c.cliente IS NULL
        OR COALESCE(c.credito_configurado, 0) = 0
      )
  `),
  documentosCreditoPendiente: scalar(`
    SELECT COUNT(1) AS c
    FROM documentos
    WHERE ${activeDocumentWhere}
      AND COALESCE(credito_pendiente, 0) = 1
  `),
  saldosNoPositivos: row(`
    SELECT
      COUNT(1) AS documentos,
      ROUND(COALESCE(SUM(total), 0), 2) AS saldo
    FROM documentos
    WHERE is_subtotal = 0
      AND COALESCE(total, 0) <= 0
      AND COALESCE(estado_documento, 'ACTIVO') <> 'ANULADO'
  `),
};

corrected.porcentajeVencido =
  corrected.carteraPendiente > 0
    ? (corrected.carteraVencida / corrected.carteraPendiente) * 100
    : 0;

corrected.porcentajeMora90 =
  corrected.carteraPendiente > 0
    ? (corrected.mora90 / corrected.carteraPendiente) * 100
    : 0;

const aging = rows(`
  SELECT
    CASE
      WHEN dias <= 0 THEN 'Por vencer'
      WHEN dias <= 30 THEN '1-30'
      WHEN dias <= 60 THEN '31-60'
      WHEN dias <= 90 THEN '61-90'
      WHEN dias <= 120 THEN '91-120'
      WHEN dias <= 180 THEN '121-180'
      WHEN dias <= 360 THEN '181-360'
      ELSE '>360'
    END AS tramo,
    ROUND(SUM(total), 2) AS saldo,
    COUNT(*) AS documentos
  FROM (
    SELECT
      total,
      CAST(julianday(date('now', 'localtime')) - julianday(fecha_vencimiento) AS INTEGER) AS dias
    FROM documentos
    WHERE ${activeDocumentWhere}
      AND fecha_vencimiento IS NOT NULL
      AND TRIM(fecha_vencimiento) <> ''
  )
  GROUP BY tramo
  ORDER BY
    CASE tramo
      WHEN 'Por vencer' THEN 0
      WHEN '1-30' THEN 1
      WHEN '31-60' THEN 2
      WHEN '61-90' THEN 3
      WHEN '91-120' THEN 4
      WHEN '121-180' THEN 5
      WHEN '181-360' THEN 6
      ELSE 7
    END
`);

const topClientes = rows(`
  SELECT
    MAX(COALESCE(NULLIF(razon_social, ''), cliente)) AS cliente,
    ROUND(SUM(total), 2) AS saldo,
    ROUND(SUM(
      CASE
        WHEN date(fecha_vencimiento) < date('now', 'localtime')
        THEN total
        ELSE 0
      END
    ), 2) AS vencido,
    ROUND(SUM(
      CASE
        WHEN date(fecha_vencimiento) < date('now', 'localtime', '-90 day')
        THEN total
        ELSE 0
      END
    ), 2) AS mora90
  FROM documentos
  WHERE ${activeDocumentWhere}
  GROUP BY cliente
  ORDER BY saldo DESC
  LIMIT 10
`);

const vendedores = rows(`
  SELECT
    COALESCE(NULLIF(vendedor, ''), 'Sin vendedor') AS vendedor,
    ROUND(SUM(total), 2) AS saldo,
    ROUND(SUM(
      CASE
        WHEN date(fecha_vencimiento) < date('now', 'localtime')
        THEN total
        ELSE 0
      END
    ), 2) AS vencido,
    COUNT(DISTINCT cliente) AS clientes
  FROM documentos
  WHERE ${activeDocumentWhere}
  GROUP BY COALESCE(NULLIF(vendedor, ''), 'Sin vendedor')
  ORDER BY saldo DESC
  LIMIT 10
`);

const moraCritica = rows(`
  SELECT
    MAX(COALESCE(NULLIF(razon_social, ''), cliente)) AS cliente,
    ROUND(SUM(total), 2) AS mora90,
    MAX(
      CAST(julianday(date('now', 'localtime')) - julianday(fecha_vencimiento) AS INTEGER)
    ) AS max_dias,
    COUNT(*) AS documentos,
    MAX(COALESCE(NULLIF(vendedor, ''), 'Sin vendedor')) AS vendedor
  FROM documentos
  WHERE ${activeDocumentWhere}
    AND date(fecha_vencimiento) < date('now', 'localtime', '-90 day')
  GROUP BY cliente
  ORDER BY mora90 DESC
  LIMIT 10
`);

const abonosMesPorTipo = rows(`
  SELECT
    COALESCE(NULLIF(observacion, ''), 'Sin observación') AS observacion,
    COUNT(*) AS movimientos,
    ROUND(SUM(total_anterior - total_nuevo), 2) AS valor
  FROM abonos
  WHERE COALESCE(reversado, 0) = 0
    AND COALESCE(estado, 'ACTIVO') = 'ACTIVO'
    AND (COALESCE(total_anterior, 0) - COALESCE(total_nuevo, 0)) > 0
    AND datetime(fecha) >= datetime(?)
    AND datetime(fecha) < datetime(?)
  GROUP BY COALESCE(NULLIF(observacion, ''), 'Sin observación')
  ORDER BY valor DESC
`, [firstDay, nextMonth]);

const comparison = [
  {
    indicador: "Cartera pendiente",
    actual: current.carteraTotal,
    corregido: corrected.carteraPendiente,
  },
  {
    indicador: "Cartera vencida",
    actual: current.carteraVencida,
    corregido: corrected.carteraVencida,
  },
  {
    indicador: "Cobrado mes",
    actual: current.cobradoMesEtiquetaActual,
    corregido: corrected.cobrosDetectadosMes,
  },
  {
    indicador: "Clientes con saldo",
    actual: current.clientesConSaldo,
    corregido: corrected.clientesConSaldo,
  },
  {
    indicador: "Documentos pendientes",
    actual: current.documentosPendientes,
    corregido: corrected.documentosPendientes,
  },
].map((item) => ({
  ...item,
  diferencia: item.corregido - item.actual,
}));

const result = {
  generadoEn: new Date().toISOString(),
  base: dbPath,
  periodoCobros: { desde: firstDay, hastaExclusivo: nextMonth },
  integridad: db.pragma("integrity_check", { simple: true }),
  current,
  corrected,
  comparison,
  aging,
  topClientes,
  vendedores,
  moraCritica,
  abonosMesPorTipo,
  notas: [
    "Cobros detectados del mes usa fecha de detección de abonos, no fecha bancaria real.",
    "Una política de contado con 0 días es válida cuando credito_configurado = 1.",
    "Todos los KPI corregidos excluyen anulados, subtotales y saldos <= 0.",
    "El DSO no se audita porque la base actual no contiene ventas a crédito mensuales confiables.",
  ],
};

db.close();

console.log("");
console.log("DASHBOARD FINANCIAL AUDIT");
console.log(JSON.stringify(result, null, 2));

if (outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "-").replace("T", "_").replace("Z", "");
  const jsonPath = path.join(outputDir, `dashboard-financial-audit-${stamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), "utf8");
  console.log("");
  console.log(`Archivo generado: ${jsonPath}`);
}

if (result.integridad !== "ok") {
  process.exitCode = 2;
}
