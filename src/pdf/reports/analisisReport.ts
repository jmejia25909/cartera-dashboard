import type { jsPDF as JsPdfInstance } from 'jspdf';

import type { PdfColor, PdfContext } from '../core/pdfTypes';
import { drawPdfHeader } from '../core/pdfHeader';
import { loadPdfLibraries, savePdfDocument } from '../core/pdfDocument';

export type AnalisisView =
  | 'motivos'
  | 'productividad'
  | 'riesgo'
  | 'cronicos'
  | string;

export interface MotivoImpagoReportRow {
  label?: string;
  count?: number;
  total?: number;
}

export interface ProductividadReportRow {
  usuario?: string;
  total_gestiones?: number;
  promesas?: number;
  pagos?: number;
  tasa_promesa?: number;
  saldo_recuperable?: number;
}

export interface RiesgoReportRow {
  razon_social?: string;
  total_deuda?: number;
  deuda_vencida?: number;
  max_dias_mora?: number;
  score?: number;
}

export interface DeudorCronicoReportRow {
  razon_social?: string;
  vendedor?: string;
  totalDeuda?: number;
  totalVencido?: number;
  documentosVencidos?: number;
}

export interface GenerateAnalisisReportParams {
  vista: AnalisisView;
  motivos: MotivoImpagoReportRow[];
  productividad: ProductividadReportRow[];
  riesgos: RiesgoReportRow[];
  deudoresCronicos: DeudorCronicoReportRow[];
  context: PdfContext;
}

interface AnalysisReportConfig {
  key: string;
  title: string;
  head: string[];
  alignRightIndices: number[];
  rows: Array<Array<string | number>>;
}

interface MetricCard {
  label: string;
  value: string;
}

interface SectionPalette {
  accent: PdfColor;
  soft: PdfColor;
}

const fmtMoney = (amount: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number.isFinite(amount) ? amount : 0);

const compactLabel = (label: string, maxChars = 20): string => {
  const clean = label
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return clean.length > maxChars
    ? `${clean.slice(0, maxChars)}...`
    : clean;
};

const getPrediction = (score: number): string => {
  if (score < 30) return 'Alto Riesgo';
  if (score < 60) return 'Riesgo Medio';
  return 'Bajo Riesgo';
};

const getPalette = (vista: AnalisisView): SectionPalette => {
  const palettes: Record<string, SectionPalette> = {
    motivos: {
      accent: [59, 130, 246],
      soft: [219, 234, 254],
    },
    productividad: {
      accent: [16, 185, 129],
      soft: [209, 250, 229],
    },
    riesgo: {
      accent: [239, 68, 68],
      soft: [254, 226, 226],
    },
    cronicos: {
      accent: [220, 38, 38],
      soft: [254, 226, 226],
    },
  };

  return palettes[vista] ?? palettes.motivos;
};

const getReportConfig = (
  params: GenerateAnalisisReportParams
): AnalysisReportConfig => {
  const {
    vista,
    motivos,
    productividad,
    riesgos,
    deudoresCronicos,
  } = params;

  if (vista === 'motivos') {
    const total = motivos.reduce(
      (sum, item) => sum + (item.total || 0),
      0
    );

    return {
      key: 'motivos_impago',
      title: 'Motivos de Impago',
      head: ['Motivo', 'Casos', 'Monto Total', '%'],
      alignRightIndices: [1, 2, 3],
      rows: motivos.map((item) => [
        item.label || '-',
        String(item.count ?? 0),
        fmtMoney(item.total || 0),
        `${total > 0
          ? (((item.total || 0) / total) * 100).toFixed(1)
          : '0'}%`,
      ]),
    };
  }

  if (vista === 'productividad') {
    return {
      key: 'productividad',
      title: 'Productividad de Gestores',
      head: [
        'Gestor',
        'Gestiones',
        'Promesas',
        'Pagos',
        'Tasa Promesa',
        'Saldo Recuperable',
      ],
      alignRightIndices: [1, 2, 3, 4, 5],
      rows: productividad.map((item) => [
        item.usuario || '-',
        String(item.total_gestiones ?? 0),
        String(item.promesas ?? 0),
        String(item.pagos ?? 0),
        `${item.tasa_promesa ?? 0}%`,
        fmtMoney(item.saldo_recuperable || 0),
      ]),
    };
  }

  if (vista === 'riesgo') {
    return {
      key: 'riesgo',
      title: 'AnÃ¡lisis de Riesgo',
      head: [
        'Cliente',
        'Deuda Total',
        'Deuda Vencida',
        'DÃ­as Mora',
        'Score',
        'PredicciÃ³n',
      ],
      alignRightIndices: [1, 2, 3, 4],
      rows: riesgos.map((item) => {
        const score = item.score ?? 0;

        return [
          item.razon_social || '-',
          fmtMoney(item.total_deuda || 0),
          fmtMoney(item.deuda_vencida || 0),
          String(item.max_dias_mora ?? 0),
          String(score),
          getPrediction(score),
        ];
      }),
    };
  }

  return {
    key: 'deudores_cronicos',
    title: 'Deudores CrÃ³nicos',
    head: [
      '#',
      'Cliente',
      'Vendedor',
      'Deuda Total',
      'Vencido (+90 dÃ­as)',
      'Docs Vencidos',
    ],
    alignRightIndices: [0, 3, 4, 5],
    rows: deudoresCronicos.map((item, index) => [
      String(index + 1),
      item.razon_social || '-',
      item.vendedor || '-',
      fmtMoney(item.totalDeuda || 0),
      fmtMoney(item.totalVencido || 0),
      String(item.documentosVencidos ?? 0),
    ]),
  };
};

const getSummary = (
  params: GenerateAnalisisReportParams
): MetricCard[] => {
  const {
    vista,
    motivos,
    productividad,
    riesgos,
    deudoresCronicos,
  } = params;

  if (vista === 'motivos') {
    const totalCasos = motivos.reduce(
      (sum, item) => sum + (item.count || 0),
      0
    );

    const totalMonto = motivos.reduce(
      (sum, item) => sum + (item.total || 0),
      0
    );

    return [
      {
        label: 'Casos',
        value: String(totalCasos),
      },
      {
        label: 'Monto Total',
        value: fmtMoney(totalMonto),
      },
      {
        label: 'Top Motivo',
        value: compactLabel(motivos[0]?.label || 'Sin datos'),
      },
    ];
  }

  if (vista === 'productividad') {
    const totalGestiones = productividad.reduce(
      (sum, item) => sum + (item.total_gestiones || 0),
      0
    );

    const totalPromesas = productividad.reduce(
      (sum, item) => sum + (item.promesas || 0),
      0
    );

    const tasaPromesa =
      totalGestiones > 0
        ? ((totalPromesas / totalGestiones) * 100).toFixed(1)
        : '0.0';

    return [
      {
        label: 'Gestiones',
        value: String(totalGestiones),
      },
      {
        label: 'Promesas',
        value: String(totalPromesas),
      },
      {
        label: 'Tasa Promesa',
        value: `${tasaPromesa}%`,
      },
    ];
  }

  if (vista === 'riesgo') {
    const deudaTotal = riesgos.reduce(
      (sum, item) => sum + (item.total_deuda || 0),
      0
    );

    const deudaVencida = riesgos.reduce(
      (sum, item) => sum + (item.deuda_vencida || 0),
      0
    );

    return [
      {
        label: 'Clientes',
        value: String(riesgos.length),
      },
      {
        label: 'Deuda Total',
        value: fmtMoney(deudaTotal),
      },
      {
        label: 'Deuda Vencida',
        value: fmtMoney(deudaVencida),
      },
    ];
  }

  const deudaTotal = deudoresCronicos.reduce(
    (sum, item) => sum + (item.totalDeuda || 0),
    0
  );

  const deudaVencida = deudoresCronicos.reduce(
    (sum, item) => sum + (item.totalVencido || 0),
    0
  );

  return [
    {
      label: 'Deudores',
      value: String(deudoresCronicos.length),
    },
    {
      label: 'Deuda Total',
      value: fmtMoney(deudaTotal),
    },
    {
      label: 'Vencido +90',
      value: fmtMoney(deudaVencida),
    },
  ];
};

const drawMetricCards = (
  doc: JsPdfInstance,
  params: {
    cards: MetricCard[];
    y: number;
    contentLeft: number;
    pageWidth: number;
    accent: PdfColor;
  }
): number => {
  const {
    cards,
    y,
    contentLeft,
    pageWidth,
    accent,
  } = params;

  const muted: PdfColor = [100, 116, 139];
  const cardHeight = 16;
  const cardGap = 6;
  const availableWidth = pageWidth - contentLeft * 2;
  const cardWidth =
    (availableWidth - cardGap * (cards.length - 1)) /
    cards.length;

  cards.forEach((item, index) => {
    const x = contentLeft + index * (cardWidth + cardGap);

    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(
      x,
      y,
      cardWidth,
      cardHeight,
      3,
      3,
      'FD'
    );

    doc.setFillColor(...accent);
    doc.rect(x, y, cardWidth, 1.2, 'F');

    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text(
      item.label.toUpperCase(),
      x + 4,
      y + 6
    );

    doc.setFontSize(10);
    doc.setTextColor(...accent);
    doc.text(item.value, x + 4, y + 12);
  });

  return y + cardHeight;
};

export const generateAnalisisReport = async (
  params: GenerateAnalisisReportParams
): Promise<void> => {
  const config = getReportConfig(params);

  if (config.rows.length === 0) {
    throw new Error(
      'No hay datos para reportar en esta vista.'
    );
  }

  const palette = getPalette(params.vista);
  const { jsPDF, autoTable } = await loadPdfLibraries();

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const {
    headerHeight,
    contentLeft,
    pageWidth,
    text,
  } = drawPdfHeader(doc, {
    title: 'Panel de AnÃ¡lisis',
    context: params.context,
    detailLines: [`SecciÃ³n: ${config.title}`],
  });

  const cardsEndY = drawMetricCards(doc, {
    cards: getSummary(params),
    y: headerHeight + 6,
    contentLeft,
    pageWidth,
    accent: palette.accent,
  });

  const columnStyles = config.alignRightIndices.reduce<
    Record<number, { halign: 'right' }>
  >((styles, index) => {
    styles[index] = {
      halign: 'right',
    };

    return styles;
  }, {});

  autoTable(doc, {
    startY: cardsEndY + 8,
    head: [config.head],
    body: config.rows,
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: text,
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: palette.soft,
      textColor: palette.accent,
      fontStyle: 'bold',
      halign: 'left',
      lineColor: palette.accent,
      lineWidth: 0.25,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles,
    pageBreak: 'auto',
    rowPageBreak: 'avoid',
    didParseCell: (
      data: {
        section: string;
        row: {
          index: number;
        };
        column: {
          index: number;
        };
        cell: {
          styles: {
            fillColor?: PdfColor;
            textColor?: PdfColor;
            fontStyle?: string;
          };
        };
      }
    ) => {
      if (data.section !== 'body') {
        return;
      }

      if (params.vista === 'riesgo') {
        const score =
          params.riesgos[data.row.index]?.score ?? 0;

        const riskColor: PdfColor =
          score < 30
            ? [254, 226, 226]
            : score < 60
              ? [254, 243, 199]
              : [220, 252, 231];

        data.cell.styles.fillColor = riskColor;

        if (data.column.index === 5) {
          data.cell.styles.textColor =
            score < 30
              ? [185, 28, 28]
              : score < 60
                ? [180, 83, 9]
                : [22, 101, 52];

          data.cell.styles.fontStyle = 'bold';
        }
      }

      if (params.vista === 'cronicos') {
        data.cell.styles.fillColor = [
          254,
          226,
          226,
        ];

        if (data.column.index === 4) {
          data.cell.styles.textColor = [
            185,
            28,
            28,
          ];

          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  const filename =
    `Reporte_Analisis_${config.key}_` +
    `${params.context.generadoEn
      .toISOString()
      .split('T')[0]}.pdf`;

  try {
    const blobUrl = doc.output('bloburl');
    window.open(
      blobUrl,
      '_blank',
      'noopener,noreferrer'
    );
  } catch (error) {
    console.warn(
      'No se pudo abrir la vista previa del PDF:',
      error
    );
  }

  savePdfDocument(
    doc,
    filename,
    params.context
  );
};
