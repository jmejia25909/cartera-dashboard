import type Database from "better-sqlite3";
import type {
  ManagementReportFilters,
} from "./managementReports";
import { RECOVERY_PROJECTION_CTES } from "./reconciliation/recoveryProjection";

export type ManagementReportType =
  | "COLLECTIONS_DETAIL"
  | "CRM_ACTIVITY"
  | "PORTFOLIO_AGING"
  | "CANCELLED_DOCUMENTS"
  | "CREDIT_NOTES";

export type ManagementReportDetailRequest = {
  type: ManagementReportType;
  filters: ManagementReportFilters & {
    customer?: string;
    seller?: string;
    movementClass?: "COBRO" | "CRUCE" | null;
    reconciliationStatus?: string | null;
  };
};

export type ManagementReportDetailResult = {
  type: ManagementReportType;
  period: {
    year: number;
    month: number | null;
    from: string;
    toExclusive: string;
    label: string;
  };
  rows: Array<Record<string, unknown>>;
  totals: Record<string, number>;
};

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril",
  "Mayo", "Junio", "Julio", "Agosto",
  "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function buildPeriod(filters: ManagementReportFilters) {
  const year = Number(filters.year);
  const month =
    filters.month == null ? null : Number(filters.month);

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("Año inválido.");
  }

  if (
    month !== null &&
    (!Number.isInteger(month) || month < 1 || month > 12)
  ) {
    throw new Error("Mes inválido.");
  }

  if (month === null) {
    return {
      year,
      month,
      from: `${year}-01-01`,
      toExclusive: `${year + 1}-01-01`,
      label: `Año ${year}`,
    };
  }

  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return {
    year,
    month,
    from: `${year}-${String(month).padStart(2, "0")}-01`,
    toExclusive:
      `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`,
    label: `${MONTHS[month - 1]} ${year}`,
  };
}

function collectionsDetail(
  db: Database.Database,
  request: ManagementReportDetailRequest,
): ManagementReportDetailResult {
  const period = buildPeriod(request.filters);

  const where: string[] = [
    "m.fecha_movimiento >= @from",
    "m.fecha_movimiento < @to",
    "m.clase_movimiento IN ('COBRO','CRUCE')",
  ];

  const params: Record<string, unknown> = {
    from: period.from,
    to: period.toExclusive,
  };

  if (request.filters.customer?.trim()) {
    where.push(`
      (
        m.persona LIKE @customer
        OR m.identificacion LIKE @customer
      )
    `);
    params.customer = `%${request.filters.customer.trim()}%`;
  }

  if (request.filters.movementClass) {
    where.push("m.clase_movimiento = @movementClass");
    params.movementClass = request.filters.movementClass;
  }

  if (request.filters.reconciliationStatus) {
    where.push("m.estado_conciliacion = @reconciliationStatus");
    params.reconciliationStatus =
      request.filters.reconciliationStatus;
  }

  const rows = db.prepare(`
    WITH ${RECOVERY_PROJECTION_CTES}
    SELECT
      m.id,
      m.fecha_movimiento,
      m.persona,
      m.identificacion,
      m.documento_relacionado,
      m.codigo_comprobante,
      m.forma_cobro_pago,
      m.asiento,
      m.clase_movimiento,
      m.estado_conciliacion,
      m.valor,
      m.recuperacion_bruta,
      m.recuperacion_reversada,
      m.recuperacion_neta,
      m.detalle
    FROM recuperacion_conciliada m
    WHERE ${where.join(" AND ")}
    ORDER BY
      m.fecha_movimiento DESC,
      m.id DESC
  `).all(params) as Array<Record<string, unknown>>;

  const totals = rows.reduce<{
    movements: number;
    total: number;
    collections: number;
    crossings: number;
  }>(
    (acc, row) => {
      const value = Number(row.valor ?? 0);
      const netRecovery = Number(row.recuperacion_neta ?? 0);
      const type = String(row.clase_movimiento ?? "");

      acc.movements += 1;
      acc.total += netRecovery;

      if (type === "COBRO") acc.collections += netRecovery;
      // Métrica nominal informativa. `total` usa exclusivamente recuperación
      // neta y por tanto nunca incorpora cruces.
      if (type === "CRUCE") acc.crossings += value;

      return acc;
    },
    {
      movements: 0,
      total: 0,
      collections: 0,
      crossings: 0,
    },
  );

  return {
    type: request.type,
    period,
    rows,
    totals,
  };
}

function crmActivity(
  db: Database.Database,
  request: ManagementReportDetailRequest,
): ManagementReportDetailResult {
  const period = buildPeriod(request.filters);

  const where: string[] = [
    "date(g.fecha) >= date(@from)",
    "date(g.fecha) < date(@to)",
  ];

  const params: Record<string, unknown> = {
    from: period.from,
    to: period.toExclusive,
  };

  if (request.filters.customer?.trim()) {
    where.push(`
      (
        g.cliente LIKE @customer
        OR COALESCE(c.razon_social, '') LIKE @customer
      )
    `);
    params.customer = `%${request.filters.customer.trim()}%`;
  }

  const rows = db.prepare(`
    SELECT
      g.id,
      g.fecha,
      g.cliente,
      COALESCE(c.razon_social, g.cliente) AS razon_social,
      g.tipo,
      g.resultado,
      g.observacion,
      g.fecha_promesa,
      g.monto_promesa,
      g.usuario,
      g.motivo
    FROM gestiones g
    LEFT JOIN clientes c
      ON c.cliente = g.cliente
    WHERE ${where.join(" AND ")}
    ORDER BY
      g.fecha DESC,
      g.id DESC
  `).all(params) as Array<Record<string, unknown>>;

  const uniqueCustomers = new Set<string>();

  const totals = rows.reduce<{
    contacts: number;
    customers: number;
    promises: number;
    promisedAmount: number;
  }>(
    (acc, row) => {
      acc.contacts += 1;

      uniqueCustomers.add(String(row.cliente ?? ""));

      if (row.fecha_promesa) {
        acc.promises += 1;
        acc.promisedAmount += Number(row.monto_promesa ?? 0);
      }

      return acc;
    },
    {
      contacts: 0,
      customers: 0,
      promises: 0,
      promisedAmount: 0,
    },
  );

  totals.customers = uniqueCustomers.size;

  return {
    type: request.type,
    period,
    rows,
    totals,
  };
}

function portfolioAging(
  db: Database.Database,
  request: ManagementReportDetailRequest,
): ManagementReportDetailResult {
  const period = buildPeriod(request.filters);

  const where: string[] = [
    "d.is_subtotal = 0",
    "COALESCE(d.anulado, 0) = 0",
    "COALESCE(d.saldo_pendiente, 0) > 0",
    "date(d.fecha_vencimiento) IS NOT NULL",
    "COALESCE(d.posicion_cartera, 'DEUDA_VIVA') = 'DEUDA_VIVA'",
  ];

  const params: Record<string, unknown> = {};

  if (request.filters.customer?.trim()) {
    where.push(`
      (
        d.cliente LIKE @customer
        OR COALESCE(d.razon_social, '') LIKE @customer
        OR d.documento LIKE @customer
      )
    `);

    params.customer =
      `%${request.filters.customer.trim()}%`;
  }

  if (request.filters.seller?.trim()) {
    where.push("d.vendedor LIKE @seller");
    params.seller =
      `%${request.filters.seller.trim()}%`;
  }

  const rows = db.prepare(`
    SELECT
      d.id,
      d.cliente,
      COALESCE(d.razon_social, d.cliente)
        AS razon_social,
      d.tipo_documento,
      d.documento,
      d.fecha_emision,
      d.fecha_vencimiento,
      d.vendedor,
      d.saldo_original,
      d.saldo_pendiente,

      CAST(
        julianday(date('now', 'localtime')) -
        julianday(d.fecha_vencimiento)
        AS INTEGER
      ) AS dias_vencidos,

      CASE
        WHEN (
          julianday(date('now', 'localtime')) -
          julianday(d.fecha_vencimiento)
        ) <= 0
          THEN 'POR_VENCER'

        WHEN (
          julianday(date('now', 'localtime')) -
          julianday(d.fecha_vencimiento)
        ) <= 30
          THEN 'D1_30'

        WHEN (
          julianday(date('now', 'localtime')) -
          julianday(d.fecha_vencimiento)
        ) <= 60
          THEN 'D31_60'

        WHEN (
          julianday(date('now', 'localtime')) -
          julianday(d.fecha_vencimiento)
        ) <= 90
          THEN 'D61_90'

        WHEN (
          julianday(date('now', 'localtime')) -
          julianday(d.fecha_vencimiento)
        ) <= 120
          THEN 'D91_120'

        WHEN (
          julianday(date('now', 'localtime')) -
          julianday(d.fecha_vencimiento)
        ) <= 180
          THEN 'D121_180'

        WHEN (
          julianday(date('now', 'localtime')) -
          julianday(d.fecha_vencimiento)
        ) <= 360
          THEN 'D181_360'

        ELSE 'D360_PLUS'
      END AS aging_bucket

    FROM documentos d

    WHERE ${where.join(" AND ")}

    ORDER BY
      dias_vencidos DESC,
      d.saldo_pendiente DESC,
      d.id DESC
  `).all(params) as Array<Record<string, unknown>>;

  const uniqueCustomers = new Set<string>();

  const totals = rows.reduce<{
    documents: number;
    customers: number;
    portfolio: number;
    overdue: number;
    current: number;
    critical90: number;
  }>(
    (acc, row) => {
      const balance =
        Number(row.saldo_pendiente ?? 0);

      const days =
        Number(row.dias_vencidos ?? 0);

      acc.documents += 1;
      acc.portfolio += balance;

      uniqueCustomers.add(
        String(row.cliente ?? "")
      );

      if (days > 0) {
        acc.overdue += balance;
      } else {
        acc.current += balance;
      }

      if (days > 90) {
        acc.critical90 += balance;
      }

      return acc;
    },
    {
      documents: 0,
      customers: 0,
      portfolio: 0,
      overdue: 0,
      current: 0,
      critical90: 0,
    },
  );

  totals.customers = uniqueCustomers.size;

  return {
    type: request.type,
    period: {
      ...period,
      label: `Corte actual - ${new Date().toLocaleDateString(
        "es-EC",
      )}`,
    },
    rows,
    totals,
  };
}
function cancelledDocuments(
  db: Database.Database,
  request: ManagementReportDetailRequest,
): ManagementReportDetailResult {
  const period = buildPeriod(request.filters);

  const rows = db.prepare(`
    SELECT
      id,
      documento,
      cliente,
      fecha_anulacion,
      tipo_documento,
      estado_origen,
      resultado,
      motivo,
      numero_autorizacion,
      archivo_origen,
      detectado_en
    FROM documentos_anulados_log
    WHERE fecha_anulacion >= ?
      AND fecha_anulacion < ?
    ORDER BY
      fecha_anulacion DESC,
      id DESC
  `).all(
    period.from,
    period.toExclusive,
  ) as Array<Record<string, unknown>>;

  return {
    type: request.type,
    period,
    rows,
    totals: {
      documents: rows.length,
    },
  };
}

function creditNotes(
  db: Database.Database,
  request: ManagementReportDetailRequest,
): ManagementReportDetailResult {
  const period = buildPeriod(request.filters);

  const rows = db.prepare(`
    SELECT
      id,
      numero_nc,
      fecha_nc,
      persona,
      identificacion,
      vendedor,
      documento_relacionado,
      tipo_documento_relacionado,
      subtotal,
      iva,
      total_nc,
      saldo_nc,
      estado_fuente,
      estado_conciliacion,
      descripcion,
      autorizacion
    FROM notas_credito_importadas
    WHERE fecha_nc >= ?
      AND fecha_nc < ?
    ORDER BY
      fecha_nc DESC,
      id DESC
  `).all(
    period.from,
    period.toExclusive,
  ) as Array<Record<string, unknown>>;

  const totals = rows.reduce<{
    notes: number;
    amount: number;
    reconciled: number;
    pending: number;
  }>(
    (acc, row) => {
      acc.notes += 1;
      acc.amount += Number(row.total_nc ?? 0);

      if (
        String(row.estado_conciliacion ?? "") === "CONCILIADA"
      ) {
        acc.reconciled += 1;
      } else {
        acc.pending += 1;
      }

      return acc;
    },
    {
      notes: 0,
      amount: 0,
      reconciled: 0,
      pending: 0,
    },
  );

  return {
    type: request.type,
    period,
    rows,
    totals,
  };
}

export function getManagementReportDetail(
  db: Database.Database,
  request: ManagementReportDetailRequest,
): ManagementReportDetailResult {
  switch (request.type) {
    case "COLLECTIONS_DETAIL":
      return collectionsDetail(db, request);

    case "CRM_ACTIVITY":
      return crmActivity(db, request);

    case "PORTFOLIO_AGING":
      return portfolioAging(db, request);

    case "CANCELLED_DOCUMENTS":
      return cancelledDocuments(db, request);

    case "CREDIT_NOTES":
      return creditNotes(db, request);

    default: {
      const exhaustive: never = request.type;
      throw new Error(
        `Tipo de reporte no soportado: ${String(exhaustive)}`,
      );
    }
  }
}




