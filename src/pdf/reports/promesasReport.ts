import type { jsPDF as JsPdfInstance } from 'jspdf';
import type { PdfContext, PdfColor } from '../core/pdfTypes';
import { drawPdfHeader } from '../core/pdfHeader';
import { loadPdfLibraries, savePdfDocument } from '../core/pdfDocument';

export interface PromesaPagoReportRow {
  cliente?: string;
  razon_social?: string;
  fecha_promesa?: string;
  monto_promesa?: number;
  monto_pagado?: number;
  estado_promesa?: string;
  observacion?: string;
}

interface AutoTableCellHookData {
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

export interface GeneratePromesasReportParams {
  promesas: PromesaPagoReportRow[];
  promesasFiltradas: PromesaPagoReportRow[];
  context: PdfContext;
}

const fmtMoney = (amount: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number.isFinite(amount) ? amount : 0);

const parseIsoDate = (value?: string): Date | null => {
  if (!value) return null;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const [, year, month, day] = match;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    0,
    0,
    0,
    0
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getDayDifference = (dateValue: string | undefined, now: Date): number => {
  const date = parseIsoDate(dateValue);
  if (!date) return 0;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  return Math.floor((date.getTime() - today.getTime()) / 86_400_000);
};

const cleanStatus = (rawStatus?: string): string =>
  (rawStatus || '')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const getStatusLabel = (
  promesa: PromesaPagoReportRow,
  generatedAt: Date
): string => {
  const explicitStatus = cleanStatus(promesa.estado_promesa);
  if (explicitStatus) return explicitStatus;

  const days = getDayDifference(promesa.fecha_promesa, generatedAt);

  if (days < 0) return 'Vencida';
  if (days === 0) return 'Hoy';
  if (days <= 3) return 'Proxima';
  return 'Vigente';
};

const drawMetricCards = (
  doc: JsPdfInstance,
  params: {
    y: number;
    contentLeft: number;
    pageWidth: number;
    promesas: PromesaPagoReportRow[];
    generatedAt: Date;
  }
): number => {
  const { y, contentLeft, pageWidth, promesas, generatedAt } = params;
  const muted: PdfColor = [100, 116, 139];

  const totalPromesas = promesas.length;
  const montoTotal = promesas.reduce(
    (sum, promesa) => sum + (promesa.monto_promesa || 0),
    0
  );
  const vencidas = promesas.filter(
    (promesa) => getDayDifference(promesa.fecha_promesa, generatedAt) < 0
  ).length;
  const vigentes = totalPromesas - vencidas;

  const cardHeight = 16;
  const cardGap = 4;
  const availableWidth = pageWidth - contentLeft * 2;
  const cardWidth = (availableWidth - cardGap * 3) / 4;

  const cards = [
    {
      label: 'Total Promesas',
      value: String(totalPromesas),
      color: [59, 130, 246] as PdfColor,
      soft: [219, 234, 254] as PdfColor,
    },
    {
      label: 'Monto Total',
      value: fmtMoney(montoTotal),
      color: [14, 116, 144] as PdfColor,
      soft: [204, 251, 241] as PdfColor,
    },
    {
      label: 'Vencidas',
      value: String(vencidas),
      color: [239, 68, 68] as PdfColor,
      soft: [254, 226, 226] as PdfColor,
    },
    {
      label: 'Vigentes',
      value: String(vigentes),
      color: [16, 185, 129] as PdfColor,
      soft: [209, 250, 229] as PdfColor,
    },
  ];

  cards.forEach((item, index) => {
    const x = contentLeft + index * (cardWidth + cardGap);

    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(...item.soft);
    doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'FD');

    doc.setFillColor(...item.color);
    doc.rect(x, y, cardWidth, 1.2, 'F');

    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text(item.label.toUpperCase(), x + 4, y + 6);

    doc.setFontSize(10);
    doc.setTextColor(...item.color);
    doc.text(item.value, x + 4, y + 12);
  });

  return y + cardHeight;
};

export const generatePromesasReport = async ({
  promesas,
  promesasFiltradas,
  context,
}: GeneratePromesasReportParams): Promise<void> => {
  if (promesasFiltradas.length === 0) {
    throw new Error('No hay promesas para generar el reporte.');
  }

  const { jsPDF, autoTable } = await loadPdfLibraries();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const { headerHeight, contentLeft, pageWidth, accent, text } =
    drawPdfHeader(doc, {
      title: 'Reporte de Promesas de Pago',
      context,
    });

  const cardsEndY = drawMetricCards(doc, {
    y: headerHeight + 6,
    contentLeft,
    pageWidth,
    promesas,
    generatedAt: context.generadoEn,
  });

  const tableData = promesasFiltradas.map((promesa) => {
    const montoPrometido = promesa.monto_promesa || 0;
    const montoPagado = promesa.monto_pagado || 0;
    const falta = montoPrometido - montoPagado;

    return [
      promesa.razon_social || promesa.cliente || '-',
      promesa.fecha_promesa || '-',
      fmtMoney(montoPrometido),
      fmtMoney(montoPagado),
      fmtMoney(falta),
      getStatusLabel(promesa, context.generadoEn),
      promesa.observacion || '-',
    ];
  });

  autoTable(doc, {
    head: [[
      'Cliente',
      'Fecha Promesa',
      'Prometido',
      'Pagado',
      'Falta',
      'Estado',
      'Observación',
    ]],
    body: tableData,
    startY: cardsEndY + 8,
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
      fillColor: [219, 234, 254],
      textColor: accent,
      fontStyle: 'bold',
      halign: 'left',
      lineColor: [147, 197, 253],
      lineWidth: 0.25,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: {
      top: 16,
      left: contentLeft,
      right: contentLeft,
      bottom: 18,
    },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 24, halign: 'center' },
      2: { cellWidth: 24, halign: 'right' },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 32 },
    },
    pageBreak: 'auto',
    rowPageBreak: 'avoid',
    didParseCell: (data: AutoTableCellHookData) => {
      if (data.section !== 'body') return;

      const estado = String(tableData[data.row.index]?.[5] || '').toLowerCase();

      if (estado === 'vencida') {
        data.cell.styles.fillColor = [254, 226, 226];
        if (data.column.index === 4 || data.column.index === 5) {
          data.cell.styles.textColor = [185, 28, 28];
          data.cell.styles.fontStyle = 'bold';
        }
      } else if (estado === 'hoy' || estado === 'proxima') {
        data.cell.styles.fillColor = [254, 243, 199];
        if (data.column.index === 5) {
          data.cell.styles.textColor = [180, 83, 9];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  const filename = `Promesas_${context.generadoEn
    .toISOString()
    .split('T')[0]}.pdf`;

  savePdfDocument(doc, filename, context);
};
