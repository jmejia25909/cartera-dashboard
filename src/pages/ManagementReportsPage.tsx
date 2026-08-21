import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ManagementReportsSummary,
} from "../types/managementReports";
import type {
  ManagementReportDetailResult,
  ManagementReportType,
} from "../types/managementReportDetails";
import {
  exportManagementReportExcel,
  exportManagementReportPdf,
} from "./managementReportsExport";
import "./management-reports.css";


import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
const MONTHS = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

const REPORTS: Array<{
  type: ManagementReportType;
  category: string;
  title: string;
  description: string;
  requiredSources: string[];
}> = [
  {
    type: "COLLECTIONS_DETAIL",
    category: "Recaudación",
    title: "Recaudación del período",
    description: "Cobros y cruces registrados según la fecha real de la transacción.",
    requiredSources: ["COBROS_MOVIMIENTOS"],
  },
  {
    type: "CRM_ACTIVITY",
    category: "Gestión CRM",
    title: "Actividad CRM",
    description: "Contactos, gestiones y compromisos registrados.",
    requiredSources: [],
  },
  {
    type: "PORTFOLIO_AGING",
    category: "Cartera y Riesgo",
    title: "Antigüedad de saldos",
    description: "Distribución de la cartera vigente por días de vencimiento al corte actual.",
    requiredSources: ["CARTERA"],
  },
  {
    type: "CANCELLED_DOCUMENTS",
    category: "Auditoría",
    title: "Documentos anulados",
    description: "Anulaciones detectadas durante el período.",
    requiredSources: ["ANULADOS"],
  },
  {
    type: "CREDIT_NOTES",
    category: "Auditoría",
    title: "Notas de crédito",
    description: "Notas de crédito registradas y su conciliación.",
    requiredSources: ["NOTAS_CREDITO"],
  },
];

function formatShortDate(
  value: string | null | undefined,
): string {
  if (!value) return "—";

  const raw = String(value).slice(0, 10);
  const parts = raw.split("-");

  if (parts.length !== 3) {
    return raw;
  }

  const [year, month, day] = parts;

  return `${day}/${month}/${year}`;
}

function money(value: unknown): string {
  return Number(value ?? 0).toLocaleString("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

const COLUMN_LABELS: Record<string, string> = {
  fecha_movimiento: "Fecha",
  persona: "Cliente",
  identificacion: "Identificación",
  documento_relacionado: "Documento",
  codigo_comprobante: "Comprobante",
  forma_cobro_pago: "Forma de pago",
  asiento: "Referencia",
  clase_movimiento: "Tipo",
  estado_conciliacion: "Verificación",
  valor: "Valor",
  detalle: "Observación",

  fecha: "Fecha",
  cliente: "Cliente",
  razon_social: "Razón social",
  tipo: "Tipo",
  resultado: "Estado",
  observacion: "Observación",
  fecha_promesa: "Fecha promesa",
  monto_promesa: "Monto promesa",
  usuario: "Gestor",
  motivo: "Motivo",

  documento: "Documento",
  fecha_anulacion: "Fecha anulación",
  tipo_documento: "Tipo documento",
  estado_origen: "Estado origen",
  numero_autorizacion: "Autorización",
  archivo_origen: "Archivo origen",
  detectado_en: "Detectado",

  numero_nc: "Nota de crédito",
  fecha_nc: "Fecha NC",
  vendedor: "Vendedor",
  tipo_documento_relacionado: "Tipo documento",
  subtotal: "Subtotal",
  iva: "IVA",
  total_nc: "Total NC",
  saldo_nc: "Saldo NC",
  estado_fuente: "Estado fuente",
  descripcion: "Descripción",
  autorizacion: "Autorización",

  fecha_emision: "Fecha emisión",
  fecha_vencimiento: "Fecha vencimiento",
  saldo_original: "Saldo original",
  saldo_pendiente: "Saldo pendiente",
  dias_vencidos: "Días vencidos",
  aging_bucket: "Rango Aging",
};

const MONEY_COLUMNS = new Set([
  "valor",
  "monto_promesa",
  "subtotal",
  "iva",
  "total_nc",
  "saldo_nc",
  "saldo_original",
  "saldo_pendiente",
]);

const AGING_BUCKETS = [
  { key: "POR_VENCER", label: "Por vencer" },
  { key: "D1_30", label: "1-30 días" },
  { key: "D31_60", label: "31-60 días" },
  { key: "D61_90", label: "61-90 días" },
  { key: "D91_120", label: "91-120 días" },
  { key: "D121_180", label: "121-180 días" },
  { key: "D181_360", label: "181-360 días" },
  { key: "D360_PLUS", label: ">360 días" },
] as const;

function getAgingBucketLabel(value: unknown): string {
  const key = String(value ?? "");

  return AGING_BUCKETS.find(
    (item) => item.key === key,
  )?.label ?? key;
}

function getColumnLabel(column: string): string {
  return COLUMN_LABELS[column]
    ?? column.replace(/_/g, " ").toUpperCase();
}

function formatCell(
  column: string,
  value: unknown,
): string {
  if (value == null || value === "") return "—";

  const raw = String(value).toUpperCase();

  if (
    column === "estado_conciliacion" ||
    column === "conciliacion"
  ) {
    switch (raw) {
      case "CONCILIADO":
      case "CONCILIADA":
        return "Verificado";

      case "PENDIENTE_CONCILIACION":
        return "Por verificar";
    }
  }

  if (column === "resultado") {
    switch (raw) {
      case "NO_ENCONTRADO":
        return "No registrado en cartera";

      case "ANULADO_HISTORICO":
        return "Anulado previamente";
    }
  }

  if (MONEY_COLUMNS.has(column)) {
    return money(value);
  }

  if (column === "aging_bucket") {
    return getAgingBucketLabel(value);
  }

  if (typeof value === "number") {
    return value.toLocaleString("es-EC");
  }

  return String(value);
}

export function ManagementReportsPage() {
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | null>(
    now.getMonth() + 1,
  );

  const [selectedReport, setSelectedReport] =
    useState<ManagementReportType>("COLLECTIONS_DETAIL");

  const [summary, setSummary] =
    useState<ManagementReportsSummary | null>(null);

  const [detail, setDetail] =
    useState<ManagementReportDetailResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] =
    useState<"excel" | "pdf" | null>(null);

  const [currentPage, setCurrentPage] = useState(1);

  const tableHeaderRef = useRef<HTMLDivElement>(null);
  const tableBodyRef = useRef<HTMLDivElement>(null);

  const PAGE_SIZE = 25;

  const years = useMemo(
    () => Array.from(
      { length: 6 },
      (_, index) => now.getFullYear() - index,
    ),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      if (
        !window.api?.managementReportsSummary ||
        !window.api?.managementReportDetail
      ) {
        setError(
          "Los reportes gerenciales requieren la aplicación de escritorio.",
        );
        return;
      }

      setLoading(true);
      setError("");

      try {
        const filters =
          selectedReport === "PORTFOLIO_AGING"
            ? {
                year: now.getFullYear(),
                month: now.getMonth() + 1,
              }
            : {
                year,
                month,
              };

        const [summaryResult, detailResult] =
          await Promise.all([
            window.api.managementReportsSummary(filters),
            window.api.managementReportDetail({
              type: selectedReport,
              filters,
            }),
          ]);

        if (cancelled) return;

        setSummary(summaryResult);
        setDetail(detailResult);
      } catch (cause: unknown) {
        if (cancelled) return;

        setError(
          cause instanceof Error
            ? cause.message
            : "No fue posible cargar los reportes gerenciales.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [year, month, selectedReport]);

  useEffect(() => {
    setCurrentPage(1);
  }, [year, month, selectedReport]);


  const columnWidths: Record<string, number> = {
    fecha_movimiento: 90,
    cliente: 390,
    identificacion: 130,
    documento: 150,
    comprobante: 170,
    forma_pago: 120,
    referencia: 150,
    clase_movimiento: 90,
    estado_conciliacion: 170,
    valor: 100,
    observacion: 320,

    fecha_emision: 110,
    fecha_vencimiento: 120,
    vendedor: 220,
    saldo_original: 120,
    saldo_pendiente: 120,
    dias_vencidos: 100,
    aging_bucket: 110,

    fecha_anulacion: 120,
    tipo_documento: 120,
    estado_origen: 120,
    resultado: 150,
    motivo: 260,
    autorizacion: 280,
    archivo_origen: 300,

    fecha_nc: 100,
    subtotal: 100,
    iva: 90,
    total_nc: 110,
    saldo_nc: 110,
    estado_fuente: 120,
    conciliacion: 150,
    descripcion: 320,
  };

  const getColumnWidth = (
    column: string,
  ): number => {
    return columnWidths[column] ?? 140;
  };

  /*
   * Notas de crédito:
   * vista gerencial compacta sin scroll horizontal.
   *
   * Se excluyen de la tabla principal:
   * - identificacion
   * - tipo_documento_relacionado
   * - subtotal
   * - iva
   * - saldo_nc
   * - estado_fuente
   * - autorizacion
   *
   * Estos datos permanecen disponibles en el backend/exportación.
   */
  const creditNotesColumns = [
    "numero_nc",
    "fecha_nc",
    "persona",
    "vendedor",
    "documento_relacionado",
    "total_nc",
    "estado_conciliacion",
    "descripcion",
  ];

  const creditNotesColumnWidths: Record<string, string> = {
    numero_nc: "11%",
    fecha_nc: "7%",
    persona: "17%",
    vendedor: "15%",
    documento_relacionado: "12%",
    total_nc: "8%",
    estado_conciliacion: "13%",
    descripcion: "17%",
  };
  /*
   * Documentos anulados:
   * vista gerencial sin scroll horizontal.
   * Los porcentajes suman 100%.
   */
  const cancelledColumnWidths: Record<string, string> = {
    documento: "9%",
    cliente: "20%",
    fecha_anulacion: "8%",
    tipo_documento: "7%",
    estado_origen: "7%",
    resultado: "9%",
    motivo: "14%",
    numero_autorizacion: "9%",
    archivo_origen: "11%",
    detectado_en: "6%",
  };

  const getColumnStyle = (
    column: string,
  ): React.CSSProperties => {
    if (
      selectedReport === "CANCELLED_DOCUMENTS" &&
      cancelledColumnWidths[column]
    ) {
      return {
        width: cancelledColumnWidths[column],
      };
    }

    if (
      selectedReport === "CREDIT_NOTES" &&
      creditNotesColumnWidths[column]
    ) {
      return {
        width: creditNotesColumnWidths[column],
      };
    }

    const width = getColumnWidth(column);

    return {
      width: `${width}px`,
      minWidth: `${width}px`,
      maxWidth: `${width}px`,
    };
  };

  const columns = useMemo(() => {
    if (!detail?.rows.length) return [];

    if (selectedReport === "CREDIT_NOTES") {
      return creditNotesColumns.filter(
        (column) =>
          Object.prototype.hasOwnProperty.call(
            detail.rows[0],
            column,
          ),
      );
    }

    return Object.keys(detail.rows[0]).filter(
      (column) => column !== "id",
    );
  }, [detail, selectedReport]);

  const totalPages = Math.max(
    1,
    Math.ceil((detail?.rows.length ?? 0) / PAGE_SIZE),
  );

  useEffect(() => {
    setCurrentPage((current) =>
      Math.min(
        Math.max(1, current),
        totalPages,
      ),
    );
  }, [totalPages]);

  const paginatedRows = useMemo(() => {
    if (!detail) return [];

    const start = (currentPage - 1) * PAGE_SIZE;

    return detail.rows.slice(
      start,
      start + PAGE_SIZE,
    );
  }, [detail, currentPage]);

  const selectedDefinition = REPORTS.find(
    (report) => report.type === selectedReport,
  );

  const requiredSources =
    selectedDefinition?.requiredSources ?? [];

  const collectionsDailySeries = useMemo(() => {
    if (
      selectedReport !== "COLLECTIONS_DETAIL" ||
      !detail
    ) {
      return [];
    }

    const daily = new Map<
      string,
      {
        fecha: string;
        cobros: number;
        cruces: number;
        total: number;
      }
    >();

    detail.rows.forEach((row) => {
      const rawDate = String(
        row.fecha_movimiento ?? "",
      ).slice(0, 10);

      if (!rawDate) return;

      const current = daily.get(rawDate) ?? {
        fecha: rawDate,
        cobros: 0,
        cruces: 0,
        total: 0,
      };

      const amount = Number(row.valor ?? 0);
      const movementClass = String(
        row.clase_movimiento ?? "",
      ).toUpperCase();

      if (movementClass === "COBRO") {
        current.cobros += amount;
      }

      if (movementClass === "CRUCE") {
        current.cruces += amount;
      }

      current.total += amount;

      daily.set(rawDate, current);
    });

    return Array.from(daily.values())
      .sort((a, b) =>
        a.fecha.localeCompare(b.fecha),
      )
      .map((item) => ({
        ...item,
        label: item.fecha
          .split("-")
          .reverse()
          .slice(0, 2)
          .join("/"),
      }));
  }, [selectedReport, detail]);

  const crmDailySeries = useMemo(() => {
    if (
      selectedReport !== "CRM_ACTIVITY" ||
      !detail
    ) {
      return [];
    }

    const daily = new Map<
      string,
      {
        fecha: string;
        gestiones: number;
        promesas: number;
        montoPrometido: number;
      }
    >();

    detail.rows.forEach((row) => {
      const rawDate = String(
        row.fecha ?? "",
      ).slice(0, 10);

      if (!rawDate) return;

      const current = daily.get(rawDate) ?? {
        fecha: rawDate,
        gestiones: 0,
        promesas: 0,
        montoPrometido: 0,
      };

      current.gestiones += 1;

      if (row.fecha_promesa) {
        current.promesas += 1;
        current.montoPrometido += Number(
          row.monto_promesa ?? 0,
        );
      }

      daily.set(rawDate, current);
    });

    return Array.from(daily.values())
      .sort((a, b) =>
        a.fecha.localeCompare(b.fecha),
      )
      .map((item) => ({
        ...item,
        label: item.fecha
          .split("-")
          .reverse()
          .slice(0, 2)
          .join("/"),
      }));
  }, [selectedReport, detail]);

  const cancelledSummary = useMemo(() => {
    if (
      selectedReport !== "CANCELLED_DOCUMENTS" ||
      !detail
    ) {
      return {
        total: 0,
        notFound: 0,
        historical: 0,
        other: 0,
        incidencePercentage: 0,
        series: [],
      };
    }

    const counts = new Map<string, number>();

    detail.rows.forEach((row) => {
      const result = String(
        row.resultado ?? "SIN_CLASIFICAR",
      ).toUpperCase();

      counts.set(
        result,
        (counts.get(result) ?? 0) + 1,
      );
    });

    const total = detail.rows.length;
    const notFound = counts.get("NO_ENCONTRADO") ?? 0;
    const historical =
      counts.get("ANULADO_HISTORICO") ?? 0;

    const other = Math.max(
      0,
      total - notFound - historical,
    );

    return {
      total,
      notFound,
      historical,
      other,

      /*
       * Incidencia gerencial:
       * documentos reportados como anulados que no pudieron
       * asociarse a la cartera/documentación conocida.
       */
      incidencePercentage:
        total > 0
          ? (notFound / total) * 100
          : 0,

      series: [
        {
          key: "NO_ENCONTRADO",
          label: "No encontrados",
          cantidad: notFound,
          color: "#ef4444",
        },
        {
          key: "ANULADO_HISTORICO",
          label: "Anulado histórico",
          cantidad: historical,
          color: "#f59e0b",
        },
        ...(other > 0
          ? [
              {
                key: "OTROS",
                label: "Otros",
                cantidad: other,
                color: "#64748b",
              },
            ]
          : []),
      ].filter((item) => item.cantidad > 0),
    };
  }, [selectedReport, detail]);

  const agingDistribution = useMemo(() => {
    if (
      selectedReport !== "PORTFOLIO_AGING" ||
      !detail
    ) {
      return [];
    }

    return AGING_BUCKETS.map((bucket) => {
      const rows = detail.rows.filter(
        (row) =>
          String(row.aging_bucket ?? "") ===
          bucket.key,
      );

      const customers = new Set(
        rows.map((row) =>
          String(row.cliente ?? ""),
        ),
      );

      const balance = rows.reduce(
        (sum, row) =>
          sum + Number(row.saldo_pendiente ?? 0),
        0,
      );

      const portfolio =
        Number(detail.totals.portfolio ?? 0);

      const colorByBucket: Record<string, string> = {
        POR_VENCER: "#14b8a6",
        D1_30: "#3b82f6",
        D31_60: "#6366f1",
        D61_90: "#f59e0b",
        D91_120: "#f97316",
        D121_180: "#ef4444",
        D181_360: "#dc2626",
        D360_PLUS: "#991b1b",
      };

      return {
        key: bucket.key,
        label: bucket.label,
        documents: rows.length,
        customers: customers.size,
        balance,
        percentage:
          portfolio > 0
            ? (balance / portfolio) * 100
            : 0,
        color:
          colorByBucket[bucket.key] ??
          "#64748b",
      };
    });
  }, [detail, selectedReport]);

  const requiredCoverageDate = useMemo(() => {
    if (!summary) return null;

    const toExclusive = new Date(
      `${summary.period.toExclusive}T00:00:00`,
    );

    toExclusive.setDate(
      toExclusive.getDate() - 1,
    );

    const today = new Date();

    const selectedIsCurrentPeriod =
      summary.period.year === today.getFullYear() &&
      (
        summary.period.month === null ||
        summary.period.month === today.getMonth() + 1
      );

    if (selectedIsCurrentPeriod) {
      return [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0"),
      ].join("-");
    }

    return [
      toExclusive.getFullYear(),
      String(toExclusive.getMonth() + 1).padStart(2, "0"),
      String(toExclusive.getDate()).padStart(2, "0"),
    ].join("-");
  }, [summary]);

  /*
   * Son conceptos distintos:
   *
   * - informationUpToDate:
   *   indica si TODAS las fuentes del banner están actualizadas.
   *
   * - officialEnabled:
   *   indica si el reporte activo puede emitirse oficialmente.
   *   Un reporte sin fuentes externas requeridas (ej. CRM) no debe
   *   quedar bloqueado por la cobertura de Cartera/Cobros/etc.
   */
  const informationUpToDate =
    summary !== null &&
    summary.freshness.sources.length > 0 &&
    summary.freshness.sources.every(
      (source) => source.status === "UPDATED",
    );

  const officialEnabled =
    summary !== null &&
    (
      requiredSources.length === 0 ||
      requiredSources.every((requiredSource) => {
        const source = summary.freshness.sources.find(
          (item) => item.type === requiredSource,
        );

        return source?.status === "UPDATED";
      })
    );

  /*
   * La exportación representa un reporte gerencial definitivo.
   * Por tanto, solamente puede generarse cuando:
   * - existen registros,
   * - todas las fuentes requeridas están actualizadas,
   * - no existe otra exportación en curso.
   *
   * La vista en pantalla puede seguir utilizándose como
   * información preliminar mientras officialEnabled sea false.
   */
  const exportAvailable =
    detail !== null &&
    detail.rows.length > 0 &&
    officialEnabled &&
    exporting === null;

  async function handleExportExcel(): Promise<void> {
    if (!detail || detail.rows.length === 0) {
      return;
    }

    setExporting("excel");

    try {
      await exportManagementReportExcel(detail);
    } catch (cause: unknown) {
      console.error("Error exportando reporte gerencial a Excel:", cause);
      window.alert(
        cause instanceof Error
          ? cause.message
          : "No fue posible generar el archivo Excel.",
      );
    } finally {
      setExporting(null);
    }
  }

  async function handleExportPdf(): Promise<void> {
    if (!detail || detail.rows.length === 0) {
      return;
    }

    setExporting("pdf");

    try {
      await exportManagementReportPdf(detail);
    } catch (cause: unknown) {
      console.error("Error exportando reporte gerencial a PDF:", cause);
      window.alert(
        cause instanceof Error
          ? cause.message
          : "No fue posible generar el archivo PDF.",
      );
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="mgr-page">
      <header className="mgr-header">
        <div>
          <span className="mgr-eyebrow">
            INFORMACIÓN INTERNA
          </span>

          <h1>Reportes Gerenciales</h1>

          <p>
            Información consolidada para jefatura y gerencia.
          </p>
        </div>

        <div className="mgr-period">
          <label>
            Año
            <select
              value={year}
              disabled={selectedReport === "PORTFOLIO_AGING"}
              onChange={(event) =>
                setYear(Number(event.target.value))
              }
            >
              {years.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label>
            Mes
            <select
              value={month ?? "all"}
              disabled={selectedReport === "PORTFOLIO_AGING"}
              onChange={(event) =>
                setMonth(
                  event.target.value === "all"
                    ? null
                    : Number(event.target.value),
                )
              }
            >
              <option value="all">Todo el año</option>

              {MONTHS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {summary && (
        <section
          className={`mgr-freshness ${
            informationUpToDate
              ? "mgr-freshness-ok"
              : "mgr-freshness-warning"
          }`}
        >
          <div className="mgr-freshness-title">
            <div>
              <strong>Estado de la información</strong>
              <span>{summary.period.label}</span>
            </div>

            <span className="mgr-status">
              {informationUpToDate
                ? "AL DÍA"
                : "REVISAR DATOS"}
            </span>
          </div>

          <div className="mgr-source-grid">
            {summary.freshness.sources.map((source) => (
              <article
                key={source.type}
                className={`mgr-source-card mgr-source-${source.status.toLowerCase()}`}
              >
                <div className="mgr-source-card-header">
                  <span>{source.label}</span>

                  <strong>
                    {source.status === "UPDATED"
                      ? "AL DÍA"
                      : source.status === "PARTIAL"
                        ? "PARCIAL"
                        : "SIN DATOS"}
                  </strong>
                </div>

                <small>
                  Última imp.:{" "}
                  {formatShortDate(source.lastImport)}
                </small>

                <small>
                  Disponible:{" "}
                  {formatShortDate(source.periodUntil)}
                  {" · "}
                  Req.:{" "}
                  {formatShortDate(requiredCoverageDate)}
                </small>
              </article>
            ))}
          </div>
        </section>
      )}
      <nav className="mgr-catalog" aria-label="Reportes gerenciales">
        {REPORTS.map((report) => (
          <button
            type="button"
            key={report.type}
            className={
              selectedReport === report.type
                ? "mgr-report-card active"
                : "mgr-report-card"
            }
            onClick={() => setSelectedReport(report.type)}
          >
            <small>{report.category}</small>
            <strong>{report.title}</strong>
            <span>{report.description}</span>
          </button>
        ))}
      </nav>

      <section className="mgr-preview">
        <div className="mgr-preview-header">
          <div>
            <span>
              {officialEnabled
                ? "REPORTE GERENCIAL"
                : "VISTA PREVIA · INFORMACIÓN PRELIMINAR"}
            </span>

            <h2>
              {
                REPORTS.find(
                  (report) => report.type === selectedReport,
                )?.title
              }
            </h2>

            <p>{detail?.period.label ?? "—"}</p>
          </div>

          {selectedReport === "CRM_ACTIVITY" &&
          detail && (
            <>
              <div className="mgr-kpis">
                <article>
                  <span>Gestiones registradas</span>
                  <strong>
                    {Number(
                      detail.totals.contacts ?? 0,
                    ).toLocaleString("es-EC")}
                  </strong>
                </article>

                <article>
                  <span>Clientes gestionados</span>
                  <strong>
                    {Number(
                      detail.totals.customers ?? 0,
                    ).toLocaleString("es-EC")}
                  </strong>
                </article>

                <article>
                  <span>Compromisos de pago</span>
                  <strong>
                    {Number(
                      detail.totals.promises ?? 0,
                    ).toLocaleString("es-EC")}
                  </strong>
                </article>

                <article>
                  <span>Monto comprometido</span>
                  <strong>
                    {money(
                      detail.totals.promisedAmount,
                    )}
                  </strong>
                </article>
              </div>

              {crmDailySeries.length > 0 ? (
                <section className="mgr-chart-card">
                  <div className="mgr-chart-header">
                    <div>
                      <strong>
                        Evolución diaria de la gestión CRM
                      </strong>

                      <span>
                        Gestiones realizadas y compromisos
                        generados por fecha
                      </span>
                    </div>

                    <small>
                      {crmDailySeries.length} días con actividad
                    </small>
                  </div>

                  <div className="mgr-chart-container">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <BarChart
                        data={crmDailySeries}
                        margin={{
                          top: 10,
                          right: 16,
                          left: 0,
                          bottom: 0,
                        }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                        />

                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          axisLine={false}
                        />

                        <YAxis
                          allowDecimals={false}
                          tickLine={false}
                          axisLine={false}
                        />

                        <Tooltip
                          formatter={(
                            value: number | string,
                            name: string,
                          ) => [
                            Number(value).toLocaleString(
                              "es-EC",
                            ),
                            name === "gestiones"
                              ? "Gestiones"
                              : "Compromisos",
                          ]}
                          labelFormatter={(label) =>
                            `Fecha: ${label}`
                          }
                        />

                        <Legend
                          formatter={(value) =>
                            value === "gestiones"
                              ? "Gestiones"
                              : value === "promesas"
                                ? "Compromisos"
                                : value
                          }
                        />

                        <Bar
                          dataKey="gestiones"
                          fill="#2563eb"
                          radius={[4, 4, 0, 0]}
                        />

                        <Bar
                          dataKey="promesas"
                          fill="#f59e0b"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              ) : (
                <section className="mgr-crm-empty">
                  <div className="mgr-crm-empty-icon">
                    CRM
                  </div>

                  <div>
                    <strong>
                      Sin actividad CRM registrada
                    </strong>

                    <span>
                      No existen gestiones, contactos ni
                      compromisos registrados para{" "}
                      {detail.period.label}.
                    </span>
                  </div>
                </section>
              )}
            </>
          )}

        {selectedReport === "PORTFOLIO_AGING" && (
            <div className="mgr-current-cutoff-note">
              Corte actual · Año y mes no aplican a este reporte
            </div>
          )}

          <div className="mgr-export-actions">
            <button
              type="button"
              disabled={!exportAvailable}
              onClick={() => void handleExportExcel()}
              title={
                !detail?.rows.length
                  ? "No hay registros para exportar."
                  : exporting === "excel"
                    ? "Generando Excel..."
                    : !officialEnabled
                      ? "Completa la carga de información del período para habilitar la exportación."
                      : "Exportar Excel"
              }
            >
              {exporting === "excel" ? "Generando..." : "Excel"}
            </button>

            <button
              type="button"
              disabled={!exportAvailable}
              onClick={() => void handleExportPdf()}
              title={
                !detail?.rows.length
                  ? "No hay registros para exportar."
                  : exporting === "pdf"
                    ? "Generando PDF..."
                    : !officialEnabled
                      ? "Completa la carga de información del período para habilitar la exportación."
                      : "Exportar PDF"
              }
            >
              {exporting === "pdf" ? "Generando..." : "PDF"}
            </button>
          </div>
        </div>

        

        {selectedReport === "CANCELLED_DOCUMENTS" &&
          detail && (
            <>
              <div className="mgr-kpis">
                <article>
                  <span>Documentos detectados</span>
                  <strong>
                    {cancelledSummary.total.toLocaleString(
                      "es-EC",
                    )}
                  </strong>
                </article>

                <article>
                  <span>No encontrados</span>
                  <strong>
                    {cancelledSummary.notFound.toLocaleString(
                      "es-EC",
                    )}
                  </strong>
                </article>

                <article>
                  <span>Anulados históricos</span>
                  <strong>
                    {cancelledSummary.historical.toLocaleString(
                      "es-EC",
                    )}
                  </strong>
                </article>

                <article>
                  <span>Incidencia no encontrada</span>
                  <strong>
                    {cancelledSummary.incidencePercentage.toLocaleString(
                      "es-EC",
                      {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      },
                    )}
                    %
                  </strong>
                </article>
              </div>

              
            </>
          )}

        {selectedReport === "PORTFOLIO_AGING" &&
          detail && (
            <>
              <div className="mgr-kpis">
                <article>
                  <span>Cartera total</span>
                  <strong>
                    {money(detail.totals.portfolio)}
                  </strong>
                </article>

                <article>
                  <span>Cartera vencida</span>
                  <strong>
                    {money(detail.totals.overdue)}
                  </strong>
                </article>

                <article>
                  <span>Por vencer</span>
                  <strong>
                    {money(detail.totals.current)}
                  </strong>
                </article>

                <article>
                  <span>Mora crítica &gt;90 días</span>
                  <strong>
                    {money(detail.totals.critical90)}
                  </strong>
                </article>

                <article>
                  <span>Documentos</span>
                  <strong>
                    {Number(
                      detail.totals.documents ?? 0,
                    ).toLocaleString("es-EC")}
                  </strong>
                </article>

                <article>
                  <span>Clientes</span>
                  <strong>
                    {Number(
                      detail.totals.customers ?? 0,
                    ).toLocaleString("es-EC")}
                  </strong>
                </article>
              </div>

              <section className="mgr-chart-card mgr-aging-chart-card">
                <div className="mgr-chart-header">
                  <div>
                    <strong>
                      Distribución de cartera por antigüedad
                    </strong>

                    <span>
                      Saldo pendiente agrupado por días
                      de vencimiento
                    </span>
                  </div>

                  <small>
                    {agingDistribution.length} rangos
                  </small>
                </div>

                <div className="mgr-aging-chart-container">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <BarChart
                      data={agingDistribution}
                      layout="vertical"
                      margin={{
                        top: 4,
                        right: 30,
                        left: 15,
                        bottom: 0,
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={false}
                      />

                      <XAxis
                        type="number"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) =>
                          Number(value).toLocaleString(
                            "es-EC",
                            {
                              notation: "compact",
                              maximumFractionDigits: 1,
                            },
                          )
                        }
                      />

                      <YAxis
                        type="category"
                        dataKey="label"
                        width={92}
                        tickLine={false}
                        axisLine={false}
                      />

                      <Tooltip
                        formatter={(
                          value: number | string,
                        ) => [
                          money(Number(value)),
                          "Saldo pendiente",
                        ]}
                        labelFormatter={(
                          _label,
                          payload,
                        ) => {
                          const item =
                            payload?.[0]?.payload;

                          if (!item) {
                            return "";
                          }

                          return [
                            item.label,
                            `${Number(
                              item.percentage ?? 0,
                            ).toLocaleString(
                              "es-EC",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              },
                            )}%`,
                            `${item.documents} documentos`,
                            `${item.customers} clientes`,
                          ].join(" · ");
                        }}
                      />

                      <Bar
                        dataKey="balance"
                        radius={[0, 5, 5, 0]}
                        maxBarSize={24}
                      >
                        {agingDistribution.map(
                          (item) => (
                            <Cell
                              key={item.key}
                              fill={item.color}
                            />
                          ),
                        )}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </>
          )}

        {selectedReport === "COLLECTIONS_DETAIL" &&
          detail && (
            <>
              <div className="mgr-kpis">
                <article>
                  <span>Movimientos</span>
                  <strong>
                    {Number(
                      detail.totals.movements ?? 0,
                    ).toLocaleString("es-EC")}
                  </strong>
                </article>

                <article>
                  <span>Cobros</span>
                  <strong>
                    {money(detail.totals.collections)}
                  </strong>
                </article>

                <article>
                  <span>Cruces</span>
                  <strong>
                    {money(detail.totals.crossings)}
                  </strong>
                </article>

                <article>
                  <span>Total recaudado</span>
                  <strong>
                    {money(detail.totals.total)}
                  </strong>
                </article>
              </div>

              <section className="mgr-chart-card">
                <div className="mgr-chart-header">
                  <div>
                    <strong>
                      Evolución diaria de la recaudación
                    </strong>

                    <span>
                      Cobros y cruces por fecha efectiva
                      del movimiento
                    </span>
                  </div>

                  <small>
                    {collectionsDailySeries.length} días
                    con movimientos
                  </small>
                </div>

                {collectionsDailySeries.length > 0 ? (
                  <div className="mgr-chart-container">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <BarChart
                        data={collectionsDailySeries}
                        margin={{
                          top: 10,
                          right: 16,
                          left: 8,
                          bottom: 0,
                        }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                        />

                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          axisLine={false}
                        />

                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          width={76}
                          tickFormatter={(value) =>
                            Number(value).toLocaleString(
                              "es-EC",
                              {
                                notation: "compact",
                                maximumFractionDigits: 1,
                              },
                            )
                          }
                        />

                        <Tooltip
                          formatter={(
                            value: number | string,
                            name: string,
                          ) => [
                            money(Number(value)),
                            name === "cobros"
                              ? "Cobros"
                              : name === "cruces"
                                ? "Cruces"
                                : "Total",
                          ]}
                          labelFormatter={(label) =>
                            `Fecha: ${label}`
                          }
                        />

                        <Legend
                          formatter={(value) =>
                            value === "cobros"
                              ? "Cobros"
                              : value === "cruces"
                                ? "Cruces"
                                : value
                          }
                        />

                        <Bar
                          dataKey="cobros"
                          stackId="recaudacion"
                          fill="#2563eb"
                          radius={[4, 4, 0, 0]}
                        />

                        <Bar
                          dataKey="cruces"
                          stackId="recaudacion"
                          fill="#14b8a6"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="mgr-chart-empty">
                    Sin movimientos para representar
                    en el período seleccionado.
                  </div>
                )}
              </section>
            </>
          )}

        {selectedReport === "CREDIT_NOTES" &&
          detail && (
            <div className="mgr-kpis">
              <article>
                <span>Notas de crédito</span>
                <strong>
                  {Number(
                    detail.totals.notes ?? 0,
                  ).toLocaleString("es-EC")}
                </strong>
              </article>

              <article>
                <span>Total notas de crédito</span>
                <strong>
                  {money(
                    detail.totals.amount ?? 0,
                  )}
                </strong>
              </article>

              <article>
                <span>Verificadas</span>
                <strong>
                  {Number(
                    detail.totals.reconciled ?? 0,
                  ).toLocaleString("es-EC")}
                </strong>
              </article>

              <article>
                <span>Por verificar</span>
                <strong>
                  {Number(
                    detail.totals.pending ?? 0,
                  ).toLocaleString("es-EC")}
                </strong>
              </article>
            </div>
          )}
        {loading && (
          <div className="mgr-state">
            Cargando información...
          </div>
        )}

        {error && (
          <div className="mgr-state mgr-error">
            {error}
          </div>
        )}

        {!loading &&
          !error &&
          detail &&
          detail.rows.length === 0 &&
          selectedReport !== "CRM_ACTIVITY" && (
            <div className="mgr-state">
              No existen registros para el período seleccionado.
            </div>
          )}

        {!loading &&
          !error &&
          detail &&
          detail.rows.length > 0 && (
            <>
              <div className="mgr-table-summary">
                <strong>
                  {detail.rows.length.toLocaleString("es-EC")}
                </strong>
                <span>
                  registros encontrados
                </span>
              </div>

              <div
                className={`mgr-table-shell ${
                  selectedReport === "CANCELLED_DOCUMENTS"
                    ? "mgr-table-shell-cancelled"
                    : selectedReport === "CREDIT_NOTES"
                      ? "mgr-table-shell-credit-notes"
                      : ""
                }`}
              >
                <div
                  ref={tableHeaderRef}
                  className="mgr-table-header"
                >
                  <table className="mgr-table mgr-table-head">
                    <colgroup>
                      {columns.map((column) => (
                        <col
                          key={column}
                          style={getColumnStyle(column)}
                        />
                      ))}
                    </colgroup>

                    <thead>
                      <tr>
                        {columns.map((column) => (
                          <th key={column}>
                            {getColumnLabel(column)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  </table>
                </div>

                <div
                  ref={tableBodyRef}
                  className="mgr-table-body"
                  onScroll={(event) => {
                    if (tableHeaderRef.current) {
                      tableHeaderRef.current.scrollLeft =
                        event.currentTarget.scrollLeft;
                    }
                  }}
                >
                  <table className="mgr-table mgr-table-data">
                    <colgroup>
                      {columns.map((column) => (
                        <col
                          key={column}
                          style={getColumnStyle(column)}
                        />
                      ))}
                    </colgroup>

                    <tbody>
                      {paginatedRows.map((row, index) => (
                        <tr key={String(row.id ?? index)}>
                          {columns.map((column) => (
                            <td
                              key={column}
                              title={
                                row[column] == null
                                  ? ""
                                  : String(row[column])
                              }
                            >
                              {formatCell(
                                column,
                                row[column],
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mgr-pagination">
                <span>
                  Mostrando{" "}
                  {detail.rows.length === 0
                    ? 0
                    : (currentPage - 1) * PAGE_SIZE + 1}
                  {" - "}
                  {Math.min(
                    currentPage * PAGE_SIZE,
                    detail.rows.length,
                  )}
                  {" de "}
                  {detail.rows.length.toLocaleString("es-EC")}
                </span>

                <div className="mgr-pagination-controls">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() =>
                      setCurrentPage((current) =>
                        Math.max(1, current - 1),
                      )
                    }
                  >
                    ‹
                  </button>

                  <strong>
                    Página {currentPage} de {totalPages}
                  </strong>

                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() =>
                      setCurrentPage((current) =>
                        Math.min(totalPages, current + 1),
                      )
                    }
                  >
                    ›
                  </button>
                </div>
              </div>
            </>
          )}
      </section>
    </div>
  );
}

































