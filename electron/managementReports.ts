import type Database from "better-sqlite3";

import { RECOVERY_PROJECTION_CTES } from "./reconciliation/recoveryProjection";

export type ManagementReportFilters = {
  year: number;
  month?: number | null;
};

export type DataFreshnessSource = {
  type: string;
  label: string;
  lastImport: string | null;
  periodUntil: string | null;
  status: "UPDATED" | "PARTIAL" | "NO_DATA";
};

export type ManagementReportsSummary = {
  period: {
    year: number;
    month: number | null;
    from: string;
    toExclusive: string;
    label: string;
  };

  freshness: {
    status: "UPDATED" | "WARNING";
    canIssueOfficialReport: boolean;
    sources: DataFreshnessSource[];
    warnings: string[];
  };

  collections: {
    movements: number;
    total: number;
    collections: number;
    crossings: number;
    reconciled: number;
    pendingReconciliation: number;
  };

  crm: {
    contacts: number;
    customers: number;
    promises: number;
    promisedAmount: number;
    overduePromises: number;
  };

  audit: {
    cancelledDocuments: number;
    creditNotes: number;
    creditNotesAmount: number;
  };
};

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril",
  "Mayo", "Junio", "Julio", "Agosto",
  "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function isoDate(
  year: number,
  month: number,
  day = 1,
): string {
  return [
    year,
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function toDateOnlyIso(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function createPeriod(filters: ManagementReportFilters) {
  const year = Number(filters.year);
  const month =
    filters.month == null
      ? null
      : Number(filters.month);

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("Año de reporte inválido.");
  }

  if (
    month !== null &&
    (!Number.isInteger(month) || month < 1 || month > 12)
  ) {
    throw new Error("Mes de reporte inválido.");
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
    from: isoDate(year, month),
    toExclusive: isoDate(nextYear, nextMonth),
    label: `${MONTHS[month - 1]} ${year}`,
  };
}

function getFreshness(
  db: Database.Database,
  period: ReturnType<typeof createPeriod>,
) {
  const today = new Date();
  const todayIso = toDateOnlyIso(today);

  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const isCurrentMonth =
    period.month !== null &&
    period.year === currentYear &&
    period.month === currentMonth;

  const isCurrentYear =
    period.month === null &&
    period.year === currentYear;

  /*
   * PACK 010.0
   *
   * IMPORTANTE:
   *
   * La fecha máxima de una transacción NO representa la cobertura
   * de un archivo.
   *
   * Ejemplo:
   * una fuente de Notas de Crédito puede haberse descargado hoy
   * correctamente y no contener ninguna NC posterior al día 10.
   *
   * Por ello, en operación normal la cobertura se determina mediante
   * la fecha de la última importación exitosa de la fuente.
   *
   * Esta regla es válida porque el procedimiento operativo exige
   * exportar las fuentes de Contífico usando el filtro TODOS.
   */

  const expectedThrough = (() => {
    if (isCurrentMonth || isCurrentYear) {
      return todayIso;
    }

    const exclusive =
      new Date(`${period.toExclusive}T00:00:00`);

    exclusive.setDate(
      exclusive.getDate() - 1,
    );

    return toDateOnlyIso(exclusive);
  })();

  const reconciliationState = db.prepare(`
    SELECT
      mode
    FROM reconciliation_control
    WHERE id = 1
  `).get() as {
    mode?: string | null;
  } | undefined;

  const reconciliationMode =
    String(
      reconciliationState?.mode ??
      "PRODUCTION",
    );

  const definitions = [
    {
      type: "CARTERA",
      label: "Cartera",
    },
    {
      type: "COBROS_MOVIMIENTOS",
      label: "Cobros",
    },
    {
      type: "NOTAS_CREDITO",
      label: "Notas de crédito",
    },
    {
      type: "ANULADOS",
      label: "Anulados",
    },
  ] as const;

  const latestSuccessfulImport = db.prepare(`
    SELECT
      MAX(importado_en) AS last_import
    FROM importaciones
    WHERE tipo = ?
      AND estado IN (
        'COMPLETADA',
        'COMPLETADA_ADVERTENCIAS'
      )
  `);

  const sources: DataFreshnessSource[] = [];
  const warnings: string[] = [];

  for (const definition of definitions) {
    const row = latestSuccessfulImport.get(
      definition.type,
    ) as {
      last_import?: string | null;
    } | undefined;

    const lastImport =
      row?.last_import ?? null;

    /*
     * importado_en puede venir como:
     *
     * 2026-08-21 15:20:10
     * 2026-08-21T15:20:10
     *
     * Los primeros 10 caracteres representan YYYY-MM-DD.
     */
    const coverageDate =
      lastImport
        ? String(lastImport).slice(0, 10)
        : null;

    let status: DataFreshnessSource["status"];

    if (
      !lastImport ||
      !coverageDate
    ) {
      status = "NO_DATA";
    } else if (
      coverageDate < period.from
    ) {
      /*
       * Existe una importación, pero es anterior
       * al período solicitado.
       */
      status = "PARTIAL";
    } else if (
      coverageDate < expectedThrough
    ) {
      status = "PARTIAL";
    } else {
      status = "UPDATED";
    }

    /*
     * Durante bootstrap histórico no existen
     * reportes gerenciales definitivos.
     *
     * Aunque todas las fuentes hayan sido cargadas,
     * la generación debe cerrarse explícitamente antes
     * de emitir un reporte oficial.
     */
    if (
      reconciliationMode !== "PRODUCTION" &&
      status === "UPDATED"
    ) {
      status = "PARTIAL";
    }

    sources.push({
      type: definition.type,
      label: definition.label,
      lastImport,
      periodUntil: coverageDate,
      status,
    });

    if (status === "NO_DATA") {
      warnings.push(
        `${definition.label}: todavía no existe una importación válida.`,
      );

      continue;
    }

    if (
      reconciliationMode !== "PRODUCTION"
    ) {
      warnings.push(
        `${definition.label}: carga histórica en curso. ` +
        `Finaliza el histórico antes de emitir reportes oficiales.`,
      );

      continue;
    }

    if (status === "PARTIAL") {
      warnings.push(
        `${definition.label}: última carga válida ${coverageDate}; ` +
        `se requiere actualizar la fuente hasta ${expectedThrough}.`,
      );
    }
  }

  const hasWarnings =
    reconciliationMode !== "PRODUCTION" ||
    sources.some(
      (source) =>
        source.status !== "UPDATED",
    );

  return {
    status:
      hasWarnings
        ? "WARNING" as const
        : "UPDATED" as const,

    canIssueOfficialReport:
      !hasWarnings,

    sources,

    warnings,
  };
}

export function getManagementReportsSummary(
  db: Database.Database,
  filters: ManagementReportFilters,
): ManagementReportsSummary {
  const period = createPeriod(filters);

  const collections = db.prepare(`
    WITH ${RECOVERY_PROJECTION_CTES}
    SELECT
      COUNT(*) AS movements,
      COALESCE(SUM(recuperacion_neta), 0) AS total,

      COALESCE(SUM(
        CASE
          WHEN clase_movimiento = 'COBRO'
          THEN recuperacion_neta ELSE 0
        END
      ), 0) AS collections,

      COALESCE(SUM(
        CASE
          WHEN clase_movimiento = 'CRUCE'
          THEN valor ELSE 0
        END
      ), 0) AS crossings,

      COALESCE(SUM(
        CASE
          WHEN estado_conciliacion = 'CONCILIADO'
          THEN recuperacion_neta ELSE 0
        END
      ), 0) AS reconciled,

      COALESCE(SUM(
        CASE
          WHEN estado_conciliacion = 'PENDIENTE_CONCILIACION'
          THEN valor ELSE 0
        END
      ), 0) AS pending_reconciliation

    FROM recuperacion_conciliada

    WHERE fecha_movimiento >= ?
      AND fecha_movimiento < ?
      AND clase_movimiento IN ('COBRO', 'CRUCE')
  `).get(
    period.from,
    period.toExclusive,
  ) as any;

  const crm = db.prepare(`
    SELECT
      COUNT(*) AS contacts,
      COUNT(DISTINCT cliente) AS customers,

      SUM(
        CASE
          WHEN fecha_promesa IS NOT NULL
          THEN 1 ELSE 0
        END
      ) AS promises,

      COALESCE(SUM(
        CASE
          WHEN fecha_promesa IS NOT NULL
          THEN monto_promesa ELSE 0
        END
      ), 0) AS promised_amount,

      SUM(
        CASE
          WHEN fecha_promesa IS NOT NULL
           AND date(fecha_promesa) < date('now','localtime')
          THEN 1 ELSE 0
        END
      ) AS overdue_promises

    FROM gestiones

    WHERE date(fecha) >= date(?)
      AND date(fecha) < date(?)
  `).get(
    period.from,
    period.toExclusive,
  ) as any;

  const cancelled = db.prepare(`
    SELECT COUNT(*) AS value
    FROM documentos_anulados_log
    WHERE fecha_anulacion >= ?
      AND fecha_anulacion < ?
  `).get(
    period.from,
    period.toExclusive,
  ) as any;

  const creditNotes = db.prepare(`
    SELECT
      COUNT(*) AS count,
      COALESCE(SUM(total_nc), 0) AS amount
    FROM notas_credito_importadas
    WHERE fecha_nc >= ?
      AND fecha_nc < ?
  `).get(
    period.from,
    period.toExclusive,
  ) as any;

  return {
    period,

    freshness: getFreshness(db, period),

    collections: {
      movements: Number(collections?.movements ?? 0),
      total: Number(collections?.total ?? 0),
      collections: Number(collections?.collections ?? 0),
      crossings: Number(collections?.crossings ?? 0),
      reconciled: Number(collections?.reconciled ?? 0),
      pendingReconciliation:
        Number(collections?.pending_reconciliation ?? 0),
    },

    crm: {
      contacts: Number(crm?.contacts ?? 0),
      customers: Number(crm?.customers ?? 0),
      promises: Number(crm?.promises ?? 0),
      promisedAmount: Number(crm?.promised_amount ?? 0),
      overduePromises: Number(crm?.overdue_promises ?? 0),
    },

    audit: {
      cancelledDocuments: Number(cancelled?.value ?? 0),
      creditNotes: Number(creditNotes?.count ?? 0),
      creditNotesAmount: Number(creditNotes?.amount ?? 0),
    },
  };
}



