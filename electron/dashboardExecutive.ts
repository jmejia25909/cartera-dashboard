import Database from "better-sqlite3";
import type {
  DashboardAgingItem,
  DashboardCriticalAlert,
  DashboardCriticalDebtor,
  DashboardExecutiveFilters,
  DashboardExecutiveStats,
  DashboardMonthlySeries,
  DashboardSellerPortfolio,
  DashboardTopClient,
} from "../src/types/dashboardExecutive";
import {
  getCollectionPeriodReconciliation,
  isCollectionReconciliationCurrent,
} from "./collectionPeriodReconciliation";

type NumericRow = {
  value?: number | null;
  count?: number | null;
};

const MONTH_LABELS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

const ACTIVE_DOCUMENT_WHERE = `
  is_subtotal = 0
  AND COALESCE(total, 0) > 0
  AND COALESCE(posicion_cartera, 'DEUDA_VIVA') = 'DEUDA_VIVA'
  AND COALESCE(estado_documento, 'ACTIVO') <> 'ANULADO'
`;

const roundMoney = (value: unknown): number =>
  Math.round((Number(value) || 0) * 100) / 100;

const roundPercent = (value: unknown): number =>
  Math.round((Number(value) || 0) * 100) / 100;

const toDateOnlyIso = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const normalizeYear = (
  value: unknown,
  fallback: number,
): number => {
  const parsed = Number(value);

  if (
    Number.isInteger(parsed) &&
    parsed >= 2000 &&
    parsed <= 2100
  ) {
    return parsed;
  }

  return fallback;
};

const normalizeMonth = (
  value: unknown,
  fallback: number | null,
): number | null => {
  if (value === null) {
    return null;
  }

  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);

  if (
    Number.isInteger(parsed) &&
    parsed >= 1 &&
    parsed <= 12
  ) {
    return parsed;
  }

  return fallback;
};

const createPeriod = (
  now: Date,
  filters?: DashboardExecutiveFilters,
) => {
  const selectedYear = normalizeYear(
    filters?.year,
    now.getFullYear(),
  );

  const selectedMonth = normalizeMonth(
    filters?.month,
    now.getMonth() + 1,
  );

  const startDate =
    selectedMonth === null
      ? new Date(selectedYear, 0, 1)
      : new Date(selectedYear, selectedMonth - 1, 1);

  const endDate =
    selectedMonth === null
      ? new Date(selectedYear + 1, 0, 1)
      : new Date(selectedYear, selectedMonth, 1);

  const label =
    selectedMonth === null
      ? `Año ${selectedYear}`
      : `${MONTH_LABELS[selectedMonth - 1]} ${selectedYear}`;

  return {
    selectedYear,
    selectedMonth,
    label,
    from: toDateOnlyIso(startDate),
    toExclusive: toDateOnlyIso(endDate),
  };
};

export function computeDashboardExecutiveStats(
  db: Database.Database,
  now: Date = new Date(),
  filters?: DashboardExecutiveFilters,
): DashboardExecutiveStats {
  const todayIso = toDateOnlyIso(now);
  const period = createPeriod(now, filters);

  const scalar = (
    sql: string,
    params: readonly unknown[] = [],
  ): number => {
    const result = db.prepare(sql).get(...params) as
      | NumericRow
      | undefined;

    return Number(result?.value ?? result?.count ?? 0);
  };

  // Total financiero fiel al snapshot vigente de Contífico.
  // Incluye todas las filas reales del reporte:
  // - deuda positiva,
  // - créditos vivos/NCT negativos,
  // - documentos que el replay histórico haya reclasificado posteriormente.
  //
  // NO se utiliza para aging, mora ni gestión operativa.
  const totalSnapshotContifico = scalar(`
    SELECT COALESCE(SUM(total), 0) AS value
    FROM documentos
    WHERE is_subtotal = 0
  `);

  // Deuda positiva actualmente gestionable para cobranza.
  const carteraPendiente = scalar(`
    SELECT COALESCE(SUM(total), 0) AS value
    FROM documentos
    WHERE ${ACTIVE_DOCUMENT_WHERE}
  `);

  const creditosVivos = scalar(`
    SELECT ABS(COALESCE(SUM(total), 0)) AS value
    FROM documentos
    WHERE is_subtotal = 0
      AND COALESCE(posicion_cartera, 'DEUDA_VIVA') = 'CREDITO_VIVO'
      AND COALESCE(total, 0) < 0
      AND COALESCE(estado_documento, 'ACTIVO') <> 'ANULADO'
  `);

  const posicionNeta = carteraPendiente - creditosVivos;

  const carteraVencida = scalar(`
    SELECT COALESCE(SUM(total), 0) AS value
    FROM documentos
    WHERE ${ACTIVE_DOCUMENT_WHERE}
      AND date(fecha_vencimiento) <
        date('now', 'localtime')
  `);

  const mora90 = scalar(`
    SELECT COALESCE(SUM(total), 0) AS value
    FROM documentos
    WHERE ${ACTIVE_DOCUMENT_WHERE}
      AND date(fecha_vencimiento) <
        date('now', 'localtime', '-90 day')
  `);

  const clientesConSaldo = scalar(`
    SELECT COUNT(DISTINCT cliente) AS count
    FROM documentos
    WHERE ${ACTIVE_DOCUMENT_WHERE}
      AND TRIM(COALESCE(cliente, '')) <> ''
  `);

  const documentosPendientes = scalar(`
    SELECT COUNT(1) AS count
    FROM documentos
    WHERE ${ACTIVE_DOCUMENT_WHERE}
  `);

  const ultimaImportacionRow = db.prepare(`
    SELECT MAX(importado_en) AS value
    FROM documentos
    WHERE is_subtotal = 0
  `).get() as { value?: string | null } | undefined;

  const ultimaDeteccionAbonoRow = db.prepare(`
    SELECT MAX(fecha) AS value
    FROM abonos
    WHERE COALESCE(reversado, 0) = 0
      AND COALESCE(estado, 'ACTIVO') = 'ACTIVO'
      AND (
        COALESCE(total_anterior, 0) -
        COALESCE(total_nuevo, 0)
      ) > 0
  `).get() as { value?: string | null } | undefined;

  const availableYearsRows = db.prepare(`
    SELECT DISTINCT year
    FROM (
      SELECT CAST(strftime('%Y', fecha) AS INTEGER) AS year
      FROM abonos
      WHERE datetime(fecha) IS NOT NULL

      UNION

      SELECT CAST(strftime('%Y', importado_en) AS INTEGER) AS year
      FROM documentos
      WHERE datetime(importado_en) IS NOT NULL
    )
    WHERE year IS NOT NULL
  `).all() as Array<{ year: number }>;

  const availableYearsSet = new Set<number>(
    availableYearsRows.map((item) => Number(item.year)),
  );

  for (
    let year = now.getFullYear() - 1;
    year <= now.getFullYear() + 4;
    year += 1
  ) {
    availableYearsSet.add(year);
  }

  availableYearsSet.add(period.selectedYear);

  const availableYears = Array.from(availableYearsSet)
    .filter((year) => Number.isInteger(year))
    .sort((left, right) => left - right);

  const collectionRows = db.prepare(`
    SELECT
      observacion,
      COUNT(*) AS movimientos,
      ROUND(
        SUM(total_anterior - total_nuevo),
        2
      ) AS valor
    FROM abonos
    WHERE COALESCE(reversado, 0) = 0
      AND COALESCE(estado, 'ACTIVO') = 'ACTIVO'
      AND (
        COALESCE(total_anterior, 0) -
        COALESCE(total_nuevo, 0)
      ) > 0
      AND datetime(fecha) >= datetime(?)
      AND datetime(fecha) < datetime(?)
    GROUP BY observacion
  `).all(period.from, period.toExclusive) as Array<{
    observacion: string | null;
    movimientos: number;
    valor: number;
  }>;

  let movimientosParciales = 0;
  let abonosParcialesDetectados = 0;
  let movimientosPorDesaparicion = 0;
  let cierresPorDesaparicionDetectados = 0;
  let otrosMovimientos = 0;
  let otrosDetectados = 0;

  for (const item of collectionRows) {
    const observation = String(item.observacion || "");
    const movements = Number(item.movimientos || 0);
    const amount = Number(item.valor || 0);

    if (
      observation ===
      "Abono detectado por cambio de total"
    ) {
      movimientosParciales += movements;
      abonosParcialesDetectados += amount;
      continue;
    }

    if (
      observation ===
      "Cobro Total: Documento ya no aparece en cartera (Cancelado)"
    ) {
      movimientosPorDesaparicion += movements;
      cierresPorDesaparicionDetectados += amount;
      continue;
    }

    otrosMovimientos += movements;
    otrosDetectados += amount;
  }

  const movimientosDetectados =
    movimientosParciales +
    movimientosPorDesaparicion +
    otrosMovimientos;

  const totalDetectado =
    abonosParcialesDetectados +
    cierresPorDesaparicionDetectados +
    otrosDetectados;

  const collectionReconciliation =
    period.selectedMonth === null
      ? null
      : getCollectionPeriodReconciliation(
          db,
          period.selectedYear,
          period.selectedMonth,
        );

  const collectionReconciliationCurrent =
    period.selectedMonth !== null &&
    isCollectionReconciliationCurrent(
      collectionReconciliation,
      totalDetectado,
      movimientosDetectados,
    );

  const collectionStatus =
    collectionReconciliationCurrent
      ? "CONCILIADO"
      : "REQUIERE_CONCILIACION";

  const collectionOfficialValue =
    collectionReconciliationCurrent &&
    collectionReconciliation
      ? roundMoney(collectionReconciliation.officialValue)
      : null;

  const monthlyRows = db.prepare(`
    SELECT
      CAST(strftime('%m', fecha) AS INTEGER) AS month,
      ROUND(
        SUM(
          CASE
            WHEN observacion =
              'Abono detectado por cambio de total'
            THEN total_anterior - total_nuevo
            ELSE 0
          END
        ),
        2
      ) AS partial_payments,
      ROUND(
        SUM(
          CASE
            WHEN observacion =
              'Cobro Total: Documento ya no aparece en cartera (Cancelado)'
            THEN total_anterior - total_nuevo
            ELSE 0
          END
        ),
        2
      ) AS disappearances,
      ROUND(
        SUM(
          CASE
            WHEN observacion NOT IN (
              'Abono detectado por cambio de total',
              'Cobro Total: Documento ya no aparece en cartera (Cancelado)'
            )
            THEN total_anterior - total_nuevo
            ELSE 0
          END
        ),
        2
      ) AS other_movements
    FROM abonos
    WHERE COALESCE(reversado, 0) = 0
      AND COALESCE(estado, 'ACTIVO') = 'ACTIVO'
      AND (
        COALESCE(total_anterior, 0) -
        COALESCE(total_nuevo, 0)
      ) > 0
      AND strftime('%Y', fecha) = ?
    GROUP BY CAST(strftime('%m', fecha) AS INTEGER)
    ORDER BY month
  `).all(String(period.selectedYear)) as Array<{
    month: number;
    partial_payments: number;
    disappearances: number;
    other_movements: number;
  }>;

  const monthlyMap = new Map(
    monthlyRows.map((item) => [Number(item.month), item]),
  );

  const monthlySeries: DashboardMonthlySeries[] =
    MONTH_LABELS.map((label, index) => {
      const month = index + 1;
      const item = monthlyMap.get(month);
      const partialPayments = roundMoney(
        item?.partial_payments,
      );
      const disappearances = roundMoney(
        item?.disappearances,
      );
      const otherMovements = roundMoney(
        item?.other_movements,
      );

      return {
        month,
        label,
        partialPayments,
        disappearances,
        otherMovements,
        total: roundMoney(
          partialPayments +
          disappearances +
          otherMovements,
        ),
      };
    });

  const vence7Dias = scalar(`
    SELECT COALESCE(SUM(total), 0) AS value
    FROM documentos
    WHERE ${ACTIVE_DOCUMENT_WHERE}
      AND date(fecha_vencimiento) >=
        date('now', 'localtime')
      AND date(fecha_vencimiento) <=
        date('now', 'localtime', '+7 day')
  `);

  const documentosVence7Dias = scalar(`
    SELECT COUNT(1) AS count
    FROM documentos
    WHERE ${ACTIVE_DOCUMENT_WHERE}
      AND date(fecha_vencimiento) >=
        date('now', 'localtime')
      AND date(fecha_vencimiento) <=
        date('now', 'localtime', '+7 day')
  `);

  const vence8a30Dias = scalar(`
    SELECT COALESCE(SUM(total), 0) AS value
    FROM documentos
    WHERE ${ACTIVE_DOCUMENT_WHERE}
      AND date(fecha_vencimiento) >
        date('now', 'localtime', '+7 day')
      AND date(fecha_vencimiento) <=
        date('now', 'localtime', '+30 day')
  `);

  const documentosVence8a30Dias = scalar(`
    SELECT COUNT(1) AS count
    FROM documentos
    WHERE ${ACTIVE_DOCUMENT_WHERE}
      AND date(fecha_vencimiento) >
        date('now', 'localtime', '+7 day')
      AND date(fecha_vencimiento) <=
        date('now', 'localtime', '+30 day')
  `);

  const clientesSinPolitica = scalar(`
    SELECT COUNT(DISTINCT d.cliente) AS count
    FROM documentos d
    LEFT JOIN clientes c
      ON c.cliente = d.cliente
    WHERE d.is_subtotal = 0
      AND COALESCE(d.total, 0) > 0
      AND COALESCE(
        d.estado_documento,
        'ACTIVO'
      ) <> 'ANULADO'
      AND TRIM(COALESCE(d.cliente, '')) <> ''
      AND (
        c.cliente IS NULL
        OR COALESCE(c.credito_configurado, 0) = 0
      )
  `);

  const documentosCreditoPendiente = scalar(`
    SELECT COUNT(1) AS count
    FROM documentos
    WHERE ${ACTIVE_DOCUMENT_WHERE}
      AND COALESCE(credito_pendiente, 0) = 1
  `);

  const documentosSinVencimientoValido = scalar(`
    SELECT COUNT(1) AS count
    FROM documentos
    WHERE ${ACTIVE_DOCUMENT_WHERE}
      AND (
        TRIM(COALESCE(fecha_vencimiento, '')) = ''
        OR date(fecha_vencimiento) IS NULL
      )
  `);

  const anuladosNoEncontrados = scalar(`
    SELECT COUNT(1) AS count
    FROM documentos_anulados_log
    WHERE resultado = 'NO_ENCONTRADO'
  `);

  const totalAnulacionesImportadas = scalar(`
    SELECT COUNT(1) AS count
    FROM documentos_anulados_log
  `);

  const anulacionesCoincidentes = scalar(`
    SELECT COUNT(1) AS count
    FROM documentos_anulados_log
    WHERE resultado IN ('ANULADO', 'YA_ANULADO')
  `);

  const promesasVencidas = scalar(`
    SELECT COUNT(1) AS count
    FROM gestiones
    WHERE TRIM(COALESCE(fecha_promesa, '')) <> ''
      AND date(fecha_promesa) <
        date('now', 'localtime')
      AND COALESCE(resultado, '') LIKE '%Promesa%'
      AND COALESCE(resultado, '') <>
        'Promesa Cumplida'
  `);

  const rawAging = db.prepare(`
    SELECT
      bucket,
      SUM(total) AS saldo,
      COUNT(*) AS documentos
    FROM (
      SELECT
        total,
        CASE
          WHEN days_overdue <= 0 THEN 'POR_VENCER'
          WHEN days_overdue <= 30 THEN 'D1_30'
          WHEN days_overdue <= 60 THEN 'D31_60'
          WHEN days_overdue <= 90 THEN 'D61_90'
          WHEN days_overdue <= 120 THEN 'D91_120'
          WHEN days_overdue <= 180 THEN 'D121_180'
          WHEN days_overdue <= 360 THEN 'D181_360'
          ELSE 'D360_PLUS'
        END AS bucket
      FROM (
        SELECT
          total,
          CAST(
            julianday(date('now', 'localtime')) -
            julianday(fecha_vencimiento)
            AS INTEGER
          ) AS days_overdue
        FROM documentos
        WHERE ${ACTIVE_DOCUMENT_WHERE}
          AND date(fecha_vencimiento) IS NOT NULL
      )
    )
    GROUP BY bucket
  `).all() as Array<{
    bucket: DashboardAgingItem["key"];
    saldo: number;
    documentos: number;
  }>;

  const agingMetadata: Array<{
    key: DashboardAgingItem["key"];
    label: string;
  }> = [
    { key: "POR_VENCER", label: "Por vencer" },
    { key: "D1_30", label: "1-30 días" },
    { key: "D31_60", label: "31-60 días" },
    { key: "D61_90", label: "61-90 días" },
    { key: "D91_120", label: "91-120 días" },
    { key: "D121_180", label: "121-180 días" },
    { key: "D181_360", label: "181-360 días" },
    { key: "D360_PLUS", label: ">360 días" },
  ];

  const agingMap = new Map(
    rawAging.map((item) => [item.bucket, item]),
  );

  const aging: DashboardAgingItem[] =
    agingMetadata.map((metadata) => {
      const item = agingMap.get(metadata.key);
      const saldo = roundMoney(item?.saldo);

      return {
        key: metadata.key,
        label: metadata.label,
        saldo,
        documentos: Number(item?.documentos || 0),
        porcentaje:
          carteraPendiente > 0
            ? roundPercent(
                (saldo / carteraPendiente) * 100,
              )
            : 0,
      };
    });

  const topClientes = db.prepare(`
    SELECT
      MAX(
        COALESCE(
          NULLIF(razon_social, ''),
          cliente
        )
      ) AS cliente,
      SUM(total) AS saldo,
      SUM(
        CASE
          WHEN date(fecha_vencimiento) <
            date('now', 'localtime')
          THEN total
          ELSE 0
        END
      ) AS vencido,
      SUM(
        CASE
          WHEN date(fecha_vencimiento) <
            date('now', 'localtime', '-90 day')
          THEN total
          ELSE 0
        END
      ) AS mora90
    FROM documentos
    WHERE ${ACTIVE_DOCUMENT_WHERE}
    GROUP BY cliente
    ORDER BY saldo DESC
    LIMIT 10
  `).all() as Array<{
    cliente: string;
    saldo: number;
    vencido: number;
    mora90: number;
  }>;

  const normalizedTopClients: DashboardTopClient[] =
    topClientes.map((item) => {
      const saldo = roundMoney(item.saldo);
      const vencido = roundMoney(item.vencido);

      return {
        cliente: item.cliente || "Sin cliente",
        saldo,
        vencido,
        mora90: roundMoney(item.mora90),
        porcentajeVencido:
          saldo > 0
            ? roundPercent((vencido / saldo) * 100)
            : 0,
      };
    });

  const sellers = db.prepare(`
    SELECT
      COALESCE(
        NULLIF(vendedor, ''),
        'Sin vendedor'
      ) AS vendedor,
      SUM(total) AS saldo,
      SUM(
        CASE
          WHEN date(fecha_vencimiento) <
            date('now', 'localtime')
          THEN total
          ELSE 0
        END
      ) AS vencido,
      SUM(
        CASE
          WHEN date(fecha_vencimiento) <
            date('now', 'localtime', '-90 day')
          THEN total
          ELSE 0
        END
      ) AS mora90,
      COUNT(DISTINCT cliente) AS clientes
    FROM documentos
    WHERE ${ACTIVE_DOCUMENT_WHERE}
    GROUP BY COALESCE(
      NULLIF(vendedor, ''),
      'Sin vendedor'
    )
    ORDER BY saldo DESC
    LIMIT 10
  `).all() as Array<{
    vendedor: string;
    saldo: number;
    vencido: number;
    mora90: number;
    clientes: number;
  }>;

  const carteraPorVendedor: DashboardSellerPortfolio[] =
    sellers.map((item) => {
      const saldo = roundMoney(item.saldo);
      const vencido = roundMoney(item.vencido);

      return {
        vendedor: item.vendedor,
        saldo,
        vencido,
        mora90: roundMoney(item.mora90),
        clientes: Number(item.clientes || 0),
        porcentajeVencido:
          saldo > 0
            ? roundPercent(
                (vencido / saldo) * 100,
              )
            : 0,
      };
    });

  const criticalRows = db.prepare(`
    SELECT
      MAX(
        COALESCE(
          NULLIF(razon_social, ''),
          cliente
        )
      ) AS cliente,
      SUM(total) AS mora90,
      MAX(
        CAST(
          julianday(date('now', 'localtime')) -
          julianday(fecha_vencimiento)
          AS INTEGER
        )
      ) AS max_dias,
      COUNT(*) AS documentos,
      MAX(
        COALESCE(
          NULLIF(vendedor, ''),
          'Sin vendedor'
        )
      ) AS vendedor
    FROM documentos
    WHERE ${ACTIVE_DOCUMENT_WHERE}
      AND date(fecha_vencimiento) <
        date('now', 'localtime', '-90 day')
    GROUP BY cliente
    ORDER BY mora90 DESC
    LIMIT 10
  `).all() as Array<{
    cliente: string;
    mora90: number;
    max_dias: number;
    documentos: number;
    vendedor: string;
  }>;

  const moraCritica: DashboardCriticalDebtor[] =
    criticalRows.map((item) => ({
      cliente: item.cliente || "Sin cliente",
      mora90: roundMoney(item.mora90),
      maxDias: Number(item.max_dias || 0),
      documentos: Number(item.documentos || 0),
      vendedor: item.vendedor || "Sin vendedor",
    }));

  const coberturaPoliticaCredito =
    clientesConSaldo > 0
      ? roundPercent(
          (
            (clientesConSaldo - clientesSinPolitica) /
            clientesConSaldo
          ) * 100,
        )
      : 100;

  const coincidenciaAnulaciones =
    totalAnulacionesImportadas > 0
      ? roundPercent(
          (
            anulacionesCoincidentes /
            totalAnulacionesImportadas
          ) * 100,
        )
      : 100;

  const qualityIsCritical =
    documentosCreditoPendiente > 0 ||
    documentosSinVencimientoValido > 0;

  const qualityNeedsAttention =
    clientesSinPolitica > 0 ||
    anuladosNoEncontrados > 0;

  const calidadEstado = qualityIsCritical
    ? "CRITICO"
    : qualityNeedsAttention
      ? "ATENCION"
      : "OK";

  const alertas: DashboardCriticalAlert[] = [
    {
      key: "CLIENTES_SIN_POLITICA",
      label: "Clientes sin política de crédito",
      count: clientesSinPolitica,
      severity:
        clientesSinPolitica > 0
          ? "WARNING"
          : "INFO",
      target: "CREDITO",
    },
    {
      key: "DOCUMENTOS_CREDITO_PENDIENTE",
      label: "Documentos con crédito pendiente",
      count: documentosCreditoPendiente,
      severity:
        documentosCreditoPendiente > 0
          ? "CRITICAL"
          : "INFO",
      target: "CREDITO",
    },
    {
      key: "ANULADOS_NO_ENCONTRADOS",
      label: "Anulados no encontrados",
      count: anuladosNoEncontrados,
      severity:
        anuladosNoEncontrados > 0
          ? "WARNING"
          : "INFO",
      target: "ANULADOS",
    },
    {
      key: "PROMESAS_VENCIDAS",
      label: "Promesas de pago vencidas",
      count: promesasVencidas,
      severity:
        promesasVencidas > 0
          ? "WARNING"
          : "INFO",
      target: "GESTION",
    },
    {
      key: "MORA_90",
      label: "Documentos en mora mayor a 90 días",
      count: moraCritica.reduce(
        (sum, item) => sum + item.documentos,
        0,
      ),
      severity:
        mora90 > 0
          ? "CRITICAL"
          : "INFO",
      target: "REPORTES",
    },
  ];

  const hasHistoricalMovements =
    monthlySeries.some((item) => item.total > 0);

  return {
    fechaCorte: todayIso,
    ultimaImportacion:
      ultimaImportacionRow?.value || null,
    ultimaDeteccionAbono:
      ultimaDeteccionAbonoRow?.value || null,

    periodo: {
      selectedYear: period.selectedYear,
      selectedMonth: period.selectedMonth,
      label: period.label,
      from: period.from,
      toExclusive: period.toExclusive,
      availableYears,
      note:
        "El filtro mensual aplica a movimientos detectados. " +
        "Los saldos, aging y rankings corresponden al corte actual.",
    },

    cartera: {
      totalSnapshotContifico: roundMoney(totalSnapshotContifico),
      pendiente: roundMoney(carteraPendiente),
      creditosVivos: roundMoney(creditosVivos),
      posicionNeta: roundMoney(posicionNeta),
      vencida: roundMoney(carteraVencida),
      porcentajeVencida:
        carteraPendiente > 0
          ? roundPercent(
              (
                carteraVencida /
                carteraPendiente
              ) * 100,
            )
          : 0,
      mora90: roundMoney(mora90),
      porcentajeMora90:
        carteraPendiente > 0
          ? roundPercent(
              (mora90 / carteraPendiente) * 100,
            )
          : 0,
      clientesConSaldo,
      documentosPendientes,
    },

    cobrosMes: {
      estado: collectionStatus,
      valorOficial: collectionOfficialValue,
      totalDetectado: roundMoney(totalDetectado),
      movimientosDetectados,
      abonosParcialesDetectados:
        roundMoney(abonosParcialesDetectados),
      movimientosParciales,
      cierresPorDesaparicionDetectados:
        roundMoney(
          cierresPorDesaparicionDetectados,
        ),
      movimientosPorDesaparicion,
      otrosDetectados: roundMoney(otrosDetectados),
      otrosMovimientos,
      desde: period.from,
      hastaExclusivo: period.toExclusive,
      nota:
        "La fecha corresponde a la detección del cambio. " +
        "Los cierres por desaparición no constituyen cobro " +
        "bancario conciliado.",
    },

    operacion: {
      vence7Dias: roundMoney(vence7Dias),
      documentosVence7Dias,
      vence8a30Dias: roundMoney(vence8a30Dias),
      documentosVence8a30Dias,
      clientesSinPolitica,
      documentosCreditoPendiente,
      documentosSinVencimientoValido,
      anuladosNoEncontrados,
      promesasVencidas,
    },

    calidadDatos: {
      estado: calidadEstado,
      puntuacion: null,
      coberturaPoliticaCredito,
      coincidenciaAnulaciones,
      clientesEvaluados: clientesConSaldo,
      documentosEvaluados: documentosPendientes,
      notas: [
        "No se muestra una puntuación compuesta arbitraria.",
        "La cobertura considera contado de 0 días como válido.",
        "La coincidencia de anulaciones compara encontrados " +
          "frente al total importado.",
      ],
    },

    aging,
    topClientes: normalizedTopClients,
    carteraPorVendedor,
    moraCritica,
    alertas,

    historico: {
      disponible: hasHistoricalMovements,
      motivo:
        hasHistoricalMovements
          ? "Movimientos detectados por mes."
          : "No existen movimientos detectados para el año seleccionado.",
      series: monthlySeries,
    },

    kpisFuturos: [
      {
        key: "DSO_REAL",
        label: "DSO real",
        estado: "SIN_DATOS",
        motivo:
          "Requiere ventas a crédito mensuales confiables.",
      },
      {
        key: "PROYECCION_COBRANZA",
        label: "Proyección de cobranza",
        estado: "SIN_DATOS",
        motivo:
          "Requiere histórico de pagos conciliados.",
      },
      {
        key: "CUMPLIMIENTO_META",
        label: "Cumplimiento de meta",
        estado: "REQUIERE_CONFIGURACION",
        motivo:
          "Requiere meta aprobada y cobros conciliados.",
      },
      {
        key: "EFECTIVIDAD_GESTOR",
        label: "Efectividad por gestor",
        estado: "SIN_DATOS",
        motivo:
          "Requiere asignación consistente de gestiones.",
      },
    ],
  };
}

