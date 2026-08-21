import type {
  ManagementReportDetailResult,
  ManagementReportType,
} from "../types/managementReportDetails";
import { loadPdfLibraries } from "../pdf/core/pdfDocument";

type ReportColumn = {
  key: string;
  label: string;
  money?: boolean;
  date?: boolean;
  width?: number;
};

type MetricKind = "number" | "money" | "percent";

type ReportMetric = {
  label: string;
  value: number;
  kind: MetricKind;
};

type ReportExportConfig = {
  title: string;
  category: string;
  excelColumns: ReportColumn[];
  pdfColumns: ReportColumn[];
};

const MONEY_FORMAT = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const NUMBER_FORMAT = new Intl.NumberFormat("es-EC");

const AGING_LABELS: Record<string, string> = {
  POR_VENCER: "Por vencer",
  D1_30: "1-30 días",
  D31_60: "31-60 días",
  D61_90: "61-90 días",
  D91_120: "91-120 días",
  D121_180: "121-180 días",
  D181_360: "181-360 días",
  D360_PLUS: ">360 días",
};

const CONFIG: Record<ManagementReportType, ReportExportConfig> = {
  COLLECTIONS_DETAIL: {
    title: "Recaudación del período",
    category: "Recaudación",
    excelColumns: [
      { key: "fecha_movimiento", label: "Fecha", date: true, width: 12 },
      { key: "persona", label: "Cliente", width: 36 },
      { key: "identificacion", label: "Identificación", width: 16 },
      { key: "documento_relacionado", label: "Documento relacionado", width: 22 },
      { key: "codigo_comprobante", label: "Comprobante", width: 24 },
      { key: "forma_cobro_pago", label: "Forma de pago", width: 16 },
      { key: "asiento", label: "Referencia", width: 22 },
      { key: "clase_movimiento", label: "Tipo", width: 12 },
      { key: "estado_conciliacion", label: "Verificación", width: 22 },
      { key: "valor", label: "Valor", money: true, width: 14 },
      { key: "detalle", label: "Observación", width: 36 },
    ],
    pdfColumns: [
      { key: "fecha_movimiento", label: "Fecha", date: true },
      { key: "persona", label: "Cliente" },
      { key: "documento_relacionado", label: "Documento" },
      { key: "forma_cobro_pago", label: "Forma pago" },
      { key: "asiento", label: "Referencia" },
      { key: "clase_movimiento", label: "Tipo" },
      { key: "estado_conciliacion", label: "Verificación" },
      { key: "valor", label: "Valor", money: true },
    ],
  },

  CRM_ACTIVITY: {
    title: "Actividad CRM",
    category: "Gestión CRM",
    excelColumns: [
      { key: "fecha", label: "Fecha", date: true, width: 12 },
      { key: "cliente", label: "Cliente", width: 18 },
      { key: "razon_social", label: "Razón social", width: 34 },
      { key: "tipo", label: "Tipo", width: 16 },
      { key: "resultado", label: "Estado", width: 18 },
      { key: "observacion", label: "Observación", width: 38 },
      { key: "fecha_promesa", label: "Fecha promesa", date: true, width: 14 },
      { key: "monto_promesa", label: "Monto promesa", money: true, width: 16 },
      { key: "usuario", label: "Gestor", width: 22 },
      { key: "motivo", label: "Motivo", width: 28 },
    ],
    pdfColumns: [
      { key: "fecha", label: "Fecha", date: true },
      { key: "razon_social", label: "Cliente" },
      { key: "tipo", label: "Tipo" },
      { key: "resultado", label: "Estado" },
      { key: "fecha_promesa", label: "F. promesa", date: true },
      { key: "monto_promesa", label: "Promesa", money: true },
      { key: "usuario", label: "Gestor" },
      { key: "observacion", label: "Observación" },
    ],
  },

  PORTFOLIO_AGING: {
    title: "Antigüedad de saldos",
    category: "Cartera y Riesgo",
    excelColumns: [
      { key: "cliente", label: "Código cliente", width: 18 },
      { key: "razon_social", label: "Cliente", width: 36 },
      { key: "tipo_documento", label: "Tipo documento", width: 16 },
      { key: "documento", label: "Documento", width: 22 },
      { key: "fecha_emision", label: "Fecha emisión", date: true, width: 14 },
      { key: "fecha_vencimiento", label: "Fecha vencimiento", date: true, width: 16 },
      { key: "vendedor", label: "Vendedor", width: 30 },
      { key: "saldo_original", label: "Saldo original", money: true, width: 16 },
      { key: "saldo_pendiente", label: "Saldo pendiente", money: true, width: 17 },
      { key: "dias_vencidos", label: "Días vencidos", width: 14 },
      { key: "aging_bucket", label: "Rango Aging", width: 16 },
    ],
    pdfColumns: [
      { key: "razon_social", label: "Cliente" },
      { key: "documento", label: "Documento" },
      { key: "fecha_vencimiento", label: "Vencimiento", date: true },
      { key: "vendedor", label: "Vendedor" },
      { key: "saldo_pendiente", label: "Saldo", money: true },
      { key: "dias_vencidos", label: "Días" },
      { key: "aging_bucket", label: "Aging" },
    ],
  },

  CANCELLED_DOCUMENTS: {
    title: "Documentos anulados",
    category: "Auditoría",
    excelColumns: [
      { key: "documento", label: "Documento", width: 22 },
      { key: "cliente", label: "Cliente", width: 34 },
      { key: "fecha_anulacion", label: "Fecha anulación", date: true, width: 15 },
      { key: "tipo_documento", label: "Tipo documento", width: 16 },
      { key: "estado_origen", label: "Estado origen", width: 16 },
      { key: "resultado", label: "Estado", width: 22 },
      { key: "motivo", label: "Motivo", width: 34 },
      { key: "numero_autorizacion", label: "Autorización", width: 40 },
      { key: "archivo_origen", label: "Archivo origen", width: 42 },
      { key: "detectado_en", label: "Detectado", width: 20 },
    ],
    pdfColumns: [
      { key: "fecha_anulacion", label: "Fecha", date: true },
      { key: "tipo_documento", label: "Tipo" },
      { key: "documento", label: "Documento" },
      { key: "cliente", label: "Cliente" },
      { key: "estado_origen", label: "Estado" },
      { key: "resultado", label: "Estado" },
      { key: "motivo", label: "Motivo" },
      { key: "numero_autorizacion", label: "Autorización" },
    ],
  },

  CREDIT_NOTES: {
    title: "Notas de crédito",
    category: "Auditoría",
    excelColumns: [
      { key: "numero_nc", label: "Nota de crédito", width: 22 },
      { key: "fecha_nc", label: "Fecha NC", date: true, width: 12 },
      { key: "persona", label: "Cliente", width: 32 },
      { key: "identificacion", label: "Identificación", width: 16 },
      { key: "vendedor", label: "Vendedor", width: 28 },
      { key: "documento_relacionado", label: "Documento relacionado", width: 22 },
      { key: "tipo_documento_relacionado", label: "Tipo documento", width: 16 },
      { key: "subtotal", label: "Subtotal", money: true, width: 14 },
      { key: "iva", label: "IVA", money: true, width: 12 },
      { key: "total_nc", label: "Total NC", money: true, width: 14 },
      { key: "saldo_nc", label: "Saldo NC", money: true, width: 14 },
      { key: "estado_fuente", label: "Estado fuente", width: 16 },
      { key: "estado_conciliacion", label: "Verificación", width: 22 },
      { key: "descripcion", label: "Descripción", width: 38 },
      { key: "autorizacion", label: "Autorización", width: 40 },
    ],
    pdfColumns: [
      { key: "numero_nc", label: "Nota crédito" },
      { key: "fecha_nc", label: "Fecha", date: true },
      { key: "persona", label: "Cliente" },
      { key: "vendedor", label: "Vendedor" },
      { key: "documento_relacionado", label: "Documento" },
      { key: "total_nc", label: "Total", money: true },
      { key: "estado_conciliacion", label: "Verificación" },
      { key: "descripcion", label: "Descripción" },
    ],
  },
};

function parseIsoDate(value: unknown): Date | null {
  if (value == null || value === "") return null;

  const raw = String(value).slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
    0,
    0,
  );
}

function shortDate(value: unknown): string {
  const date = parseIsoDate(value);

  if (!date) {
    return value == null || value === ""
      ? ""
      : String(value).slice(0, 10);
  }

  return date.toLocaleDateString("es-EC");
}

function inclusivePeriodEnd(toExclusive: string): Date {
  const date = parseIsoDate(toExclusive);

  if (!date) {
    return new Date();
  }

  date.setDate(date.getDate() - 1);
  return date;
}

function agingLabel(value: unknown): string {
  const raw = String(value ?? "");
  return AGING_LABELS[raw] ?? raw;
}

function managementExportLabel(
  column: ReportColumn,
  value: unknown,
): string | null {
  const raw = String(value ?? "");

  if (
    column.key === "estado_conciliacion" ||
    column.key === "resultado"
  ) {
    switch (raw) {
      case "CONCILIADO":
      case "CONCILIADA":
        return "Verificado";

      case "PENDIENTE_CONCILIACION":
        return "Por verificar";

      case "NO_ENCONTRADO":
        return "No registrado en cartera";

      case "ANULADO_HISTORICO":
        return "Anulado previamente";

      default:
        return raw || "—";
    }
  }

  return null;
}
function displayValue(column: ReportColumn, value: unknown): string {
  const managementLabel =
    managementExportLabel(column, value);

  if (managementLabel !== null) {
    return managementLabel;
  }

  if (value == null || value === "") return "—";
  if (column.money) return MONEY_FORMAT.format(Number(value ?? 0));
  if (column.date) return shortDate(value);
  if (column.key === "aging_bucket") return agingLabel(value);
  if (typeof value === "number") return NUMBER_FORMAT.format(value);
  return String(value);
}

function excelValue(column: ReportColumn, value: unknown): unknown {
  const managementLabel =
    managementExportLabel(column, value);

  if (managementLabel !== null) {
    return managementLabel;
  }

  if (value == null || value === "") return "";

  if (column.money) {
    return Number(value ?? 0);
  }

  if (column.date) {
    return parseIsoDate(value) ?? String(value);
  }

  if (column.key === "aging_bucket") {
    return agingLabel(value);
  }

  return value;
}

function safeFilePart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function reportMetrics(detail: ManagementReportDetailResult): ReportMetric[] {
  const t = detail.totals;

  switch (detail.type) {
    case "COLLECTIONS_DETAIL":
      return [
        { label: "Movimientos", value: Number(t.movements ?? 0), kind: "number" },
        { label: "Total recaudado", value: Number(t.total ?? 0), kind: "money" },
        { label: "Cobros", value: Number(t.collections ?? 0), kind: "money" },
        { label: "Cruces", value: Number(t.crossings ?? 0), kind: "money" },
      ];

    case "CRM_ACTIVITY":
      return [
        { label: "Gestiones registradas", value: Number(t.contacts ?? 0), kind: "number" },
        { label: "Clientes gestionados", value: Number(t.customers ?? 0), kind: "number" },
        { label: "Compromisos de pago", value: Number(t.promises ?? 0), kind: "number" },
        { label: "Monto comprometido", value: Number(t.promisedAmount ?? 0), kind: "money" },
      ];

    case "PORTFOLIO_AGING":
      return [
        { label: "Cartera total", value: Number(t.portfolio ?? 0), kind: "money" },
        { label: "Cartera vencida", value: Number(t.overdue ?? 0), kind: "money" },
        { label: "Por vencer", value: Number(t.current ?? 0), kind: "money" },
        { label: "Mora crítica >90 días", value: Number(t.critical90 ?? 0), kind: "money" },
      ];

    case "CANCELLED_DOCUMENTS": {
      const notFound = detail.rows.filter(
        (row) => String(row.resultado ?? "") === "NO_ENCONTRADO",
      ).length;

      const historical = detail.rows.filter((row) =>
        ["ANULADO_HISTORICO", "YA_ANULADO", "DUPLICADO_HISTORICO"].includes(
          String(row.resultado ?? ""),
        ),
      ).length;

      const incidence = detail.rows.length > 0
        ? notFound / detail.rows.length
        : 0;

      return [
        { label: "Documentos detectados", value: detail.rows.length, kind: "number" },
        { label: "No encontrados", value: notFound, kind: "number" },
        { label: "Anulados históricos", value: historical, kind: "number" },
        { label: "Incidencia no encontrada", value: incidence, kind: "percent" },
      ];
    }

    case "CREDIT_NOTES":
      return [
        { label: "Notas de crédito", value: Number(t.notes ?? 0), kind: "number" },
        { label: "Total notas de crédito", value: Number(t.amount ?? 0), kind: "money" },
        { label: "Verificadas", value: Number(t.reconciled ?? 0), kind: "number" },
        { label: "Por verificar", value: Number(t.pending ?? 0), kind: "number" },
      ];
  }
}

function metricDisplay(metric: ReportMetric): string {
  if (metric.kind === "money") {
    return MONEY_FORMAT.format(metric.value);
  }

  if (metric.kind === "percent") {
    return metric.value.toLocaleString("es-EC", {
      style: "percent",
      maximumFractionDigits: 1,
    });
  }

  return NUMBER_FORMAT.format(metric.value);
}

function buildFilename(
  detail: ManagementReportDetailResult,
  extension: "xlsx" | "pdf",
): string {
  const config = CONFIG[detail.type];
  const today = new Date().toISOString().slice(0, 10);
  const period = safeFilePart(detail.period.label);

  return `${safeFilePart(config.title)}_${period}_${today}.${extension}`;
}

function setCellFormat(
  sheet: Record<string, unknown>,
  address: string,
  format: string,
): void {
  const cell = sheet[address] as { z?: string } | undefined;

  if (cell) {
    cell.z = format;
  }
}

function setExcelNumberFormats(
  sheet: Record<string, unknown>,
  columns: ReportColumn[],
  rowCount: number,
  encodeCell: (cell: { r: number; c: number }) => string,
): void {
  columns.forEach((column, columnIndex) => {
    if (!column.money && !column.date) return;

    for (let rowIndex = 1; rowIndex <= rowCount; rowIndex += 1) {
      const address = encodeCell({
        r: rowIndex,
        c: columnIndex,
      });

      setCellFormat(
        sheet,
        address,
        column.money
          ? '$#,##0.00'
          : 'dd/mm/yyyy',
      );
    }
  });
}

function summaryMetricRaw(metric: ReportMetric): number {
  return metric.value;
}

export async function exportManagementReportExcel(
  detail: ManagementReportDetailResult,
): Promise<void> {
  if (detail.rows.length === 0) {
    throw new Error("No hay registros para exportar.");
  }

  const XLSX = await import("xlsx");
  const config = CONFIG[detail.type];
  const metrics = reportMetrics(detail);
  const generatedAt = new Date();

  const isAging = detail.type === "PORTFOLIO_AGING";

  const summaryRows: unknown[][] = [
    ["REPORTE GERENCIAL", "", "", ""],
    [config.title.toUpperCase(), "", "", ""],
    [config.category, "", "", ""],
    [],
    ["INFORMACIÓN DEL REPORTE", "", "", ""],
    ["Período / corte", detail.period.label],
    ...(isAging
      ? []
      : [
          ["Desde", parseIsoDate(detail.period.from)],
          ["Hasta", inclusivePeriodEnd(detail.period.toExclusive)],
        ]),
    ["Generado", generatedAt],
    [],
    ["INDICADORES", "", "", ""],
    ...metrics.map((metric) => [
      metric.label,
      summaryMetricRaw(metric),
    ]),
    [],
    ["Registros exportados", detail.rows.length],
  ];

  const detailRows = detail.rows.map((row) => {
    const record: Record<string, unknown> = {};

    for (const column of config.excelColumns) {
      record[column.label] = excelValue(
        column,
        row[column.key],
      );
    }

    return record;
  });

  const summarySheet = XLSX.utils.aoa_to_sheet(
    summaryRows,
    { cellDates: true },
  );

  const detailSheet = XLSX.utils.json_to_sheet(
    detailRows,
    {
      cellDates: true,
      skipHeader: false,
    },
  );

  summarySheet["!cols"] = [
    { wch: 30 },
    { wch: 34 },
    { wch: 4 },
    { wch: 4 },
  ];

  summarySheet["!rows"] = [
    { hpt: 18 },
    { hpt: 26 },
    { hpt: 18 },
    { hpt: 8 },
    { hpt: 20 },
  ];

  summarySheet["!merges"] = [
    XLSX.utils.decode_range("A1:D1"),
    XLSX.utils.decode_range("A2:D2"),
    XLSX.utils.decode_range("A3:D3"),
    XLSX.utils.decode_range("A5:D5"),
  ];

  detailSheet["!cols"] = config.excelColumns.map(
    (column) => ({
      wch: column.width ?? 18,
    }),
  );

  detailSheet["!rows"] = [
    { hpt: 22 },
  ];

  const lastColumn = XLSX.utils.encode_col(
    config.excelColumns.length - 1,
  );

  const lastRow = detail.rows.length + 1;

  detailSheet["!autofilter"] = {
    ref: `A1:${lastColumn}${lastRow}`,
  };

  // Best effort: SheetJS CE mantiene el autofiltro y algunos lectores
  // respetan esta metadata de pane congelado.
  (
    detailSheet as typeof detailSheet & {
      "!freeze"?: {
        xSplit: number;
        ySplit: number;
        topLeftCell: string;
        activePane: string;
        state: string;
      };
    }
  )["!freeze"] = {
    xSplit: 0,
    ySplit: 1,
    topLeftCell: "A2",
    activePane: "bottomLeft",
    state: "frozen",
  };

  setExcelNumberFormats(
    detailSheet as unknown as Record<string, unknown>,
    config.excelColumns,
    detail.rows.length,
    XLSX.utils.encode_cell,
  );

  // Formatos explícitos del Resumen.
  // No dependemos de una coordenada fija como B7, porque Aging
  // tiene una estructura distinta y eso podía mostrar "12:00"
  // en la fecha Hasta.
  if (isAging) {
    setCellFormat(
      summarySheet as unknown as Record<string, unknown>,
      "B7",
      "dd/mm/yyyy hh:mm",
    );
  } else {
    setCellFormat(
      summarySheet as unknown as Record<string, unknown>,
      "B7",
      "dd/mm/yyyy",
    );

    setCellFormat(
      summarySheet as unknown as Record<string, unknown>,
      "B8",
      "dd/mm/yyyy",
    );

    setCellFormat(
      summarySheet as unknown as Record<string, unknown>,
      "B9",
      "dd/mm/yyyy hh:mm",
    );
  }

  // Aplicar formatos numéricos a los KPI del resumen.
  const indicatorStartRow = isAging ? 10 : 12;

  metrics.forEach((metric, index) => {
    const address = `B${indicatorStartRow + index}`;

    if (metric.kind === "money") {
      setCellFormat(
        summarySheet as unknown as Record<string, unknown>,
        address,
        '$#,##0.00',
      );
    } else if (metric.kind === "percent") {
      setCellFormat(
        summarySheet as unknown as Record<string, unknown>,
        address,
        '0.0%',
      );
    } else {
      setCellFormat(
        summarySheet as unknown as Record<string, unknown>,
        address,
        '#,##0',
      );
    }
  });

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    summarySheet,
    "Resumen",
  );

  XLSX.utils.book_append_sheet(
    workbook,
    detailSheet,
    "Detalle",
  );

  workbook.Props = {
    Title: config.title,
    Subject: `Reporte gerencial - ${detail.period.label}`,
    Author: "Cartera Dashboard",
    Company: "Cartera Dashboard",
    CreatedDate: generatedAt,
  };

  XLSX.writeFile(
    workbook,
    buildFilename(detail, "xlsx"),
    {
      bookType: "xlsx",
      cellDates: true,
      compression: true,
    },
  );
}

export async function exportManagementReportPdf(
  detail: ManagementReportDetailResult,
): Promise<void> {
  if (detail.rows.length === 0) {
    throw new Error("No hay registros para exportar.");
  }

  const config = CONFIG[detail.type];
  const metrics = reportMetrics(detail);
  const { jsPDF, autoTable } = await loadPdfLibraries();

  const orientation =
    config.pdfColumns.length >= 8
      ? "landscape"
      : "portrait";

  const doc = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  const generatedAt = new Date();

  // Página 1: cabecera completa.
  const firstHeaderHeight = 25;
  const infoTop = 29;
  const infoHeight = 12;
  const metricsTop = 45;
  const metricsHeight = 16;
  const tableStartY = 66;

  // Páginas de continuación: cabecera mucho más compacta.
  const continuationHeaderHeight = 14;
  const continuationTableTop = 19;

  const drawFirstPageHeader = (): void => {
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageWidth, firstHeaderHeight, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);

    doc.text(
      config.title,
      margin,
      10.5,
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    doc.text(
      `${config.category} · Reporte gerencial`,
      margin,
      16.5,
    );

    doc.setFontSize(7.5);

    doc.text(
      detail.period.label,
      margin,
      21.5,
    );

    doc.text(
      generatedAt.toLocaleString("es-EC"),
      pageWidth - margin,
      21.5,
      { align: "right" },
    );
  };

  const drawContinuationHeader = (): void => {
    doc.setFillColor(37, 99, 235);
    doc.rect(
      0,
      0,
      pageWidth,
      continuationHeaderHeight,
      "F",
    );

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);

    doc.text(
      config.title,
      margin,
      6.5,
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);

    doc.text(
      detail.period.label,
      margin,
      11,
    );

    doc.text(
      "Reporte gerencial",
      pageWidth - margin,
      11,
      { align: "right" },
    );
  };

  const drawReportInfo = (): void => {
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);

    doc.roundedRect(
      margin,
      infoTop,
      contentWidth,
      infoHeight,
      1.5,
      1.5,
      "FD",
    );

    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2);

    doc.text(
      "PERÍODO / CORTE",
      margin + 3,
      infoTop + 4,
    );

    doc.text(
      "REGISTROS",
      margin + contentWidth * 0.52,
      infoTop + 4,
    );

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);

    doc.text(
      detail.period.label,
      margin + 3,
      infoTop + 9,
    );

    doc.text(
      NUMBER_FORMAT.format(detail.rows.length),
      margin + contentWidth * 0.52,
      infoTop + 9,
    );
  };

  const drawMetrics = (): void => {
    const gap = 3;

    const cardWidth =
      (
        contentWidth -
        gap * (metrics.length - 1)
      ) / metrics.length;

    metrics.forEach((metric, index) => {
      const x =
        margin +
        index * (cardWidth + gap);

      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(255, 255, 255);

      doc.roundedRect(
        x,
        metricsTop,
        cardWidth,
        metricsHeight,
        1.5,
        1.5,
        "FD",
      );

      doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);

      doc.text(
        metric.label,
        x + 2.5,
        metricsTop + 4.5,
        {
          maxWidth: cardWidth - 5,
        },
      );

      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.8);

      doc.text(
        metricDisplay(metric),
        x + 2.5,
        metricsTop + 11.5,
        {
          maxWidth: cardWidth - 5,
        },
      );
    });
  };

  drawFirstPageHeader();
  drawReportInfo();
  drawMetrics();

  const head = [
    config.pdfColumns.map(
      (column) => column.label,
    ),
  ];

  const body = detail.rows.map((row) =>
    config.pdfColumns.map((column) =>
      displayValue(
        column,
        row[column.key],
      ),
    ),
  );

  autoTable(doc, {
    startY: tableStartY,
    head,
    body,

    theme: "grid",
    showHead: "everyPage",

    styles: {
      font: "helvetica",
      fontSize:
        orientation === "landscape"
          ? 5.9
          : 6.5,
      cellPadding: 1.15,
      overflow: "linebreak",
      valign: "middle",
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.12,
      minCellHeight: 0,
    },

    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      lineColor: [203, 213, 225],
      lineWidth: 0.18,
      halign: "left",
      valign: "middle",
      cellPadding: 1.25,
    },

    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },

    margin: {
      left: margin,
      right: margin,
      top: continuationTableTop,
      bottom: 14,
    },

    rowPageBreak: "avoid",

    willDrawCell: (data: {
      pageNumber: number;
      section: string;
      cell: {
        styles: {
          fontSize: number;
        };
      };
    }) => {
      if (
        data.pageNumber > 1 &&
        data.section === "body"
      ) {
        data.cell.styles.fontSize =
          orientation === "landscape"
            ? 6.2
            : 6.8;
      }

      if (
        data.pageNumber > 1 &&
        data.section === "head"
      ) {
        data.cell.styles.fontSize =
          orientation === "landscape"
            ? 6.1
            : 6.7;
      }
    },

    didDrawPage: (data: { pageNumber: number }) => {
      if (data.pageNumber > 1) {
        drawContinuationHeader();
      }
    },
  });

  const pageCount = doc.getNumberOfPages();

  for (
    let page = 1;
    page <= pageCount;
    page += 1
  ) {
    doc.setPage(page);

    doc.setDrawColor(226, 232, 240);

    doc.line(
      margin,
      pageHeight - 10,
      pageWidth - margin,
      pageHeight - 10,
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.6);
    doc.setTextColor(100, 116, 139);

    doc.text(
      "Cartera Dashboard · Información interna",
      margin,
      pageHeight - 5.5,
    );

    doc.text(
      `Página ${page} de ${pageCount}`,
      pageWidth - margin,
      pageHeight - 5.5,
      {
        align: "right",
      },
    );
  }

  doc.setProperties({
    title: config.title,
    subject: `Reporte gerencial - ${detail.period.label}`,
    author: "Cartera Dashboard",
    creator: "Cartera Dashboard",
    keywords: "cartera, gerencia, reporte",
  });

  doc.save(
    buildFilename(detail, "pdf"),
  );
}


