import type { PdfContext } from '../core/pdfTypes';
import { drawPdfHeader } from '../core/pdfHeader';
import { drawPdfMetricCards } from '../core/pdfCards';
import { loadPdfLibraries, savePdfDocument } from '../core/pdfDocument';

export interface AbonoReportRow {
  fecha?: string;
  cliente?: string;
  razon_social?: string;
  documento?: string;
  total_anterior?: number;
  total_nuevo?: number;
  observacion?: string;
}

export interface GenerateAbonosReportParams {
  abonos: AbonoReportRow[];
  context: PdfContext;
}

const fmtMoney = (amount: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number.isFinite(amount) ? amount : 0);

export const generateAbonosReport = async ({
  abonos,
  context,
}: GenerateAbonosReportParams): Promise<void> => {
  if (abonos.length === 0) {
    throw new Error('No hay abonos para generar el reporte.');
  }

  const { jsPDF, autoTable } = await loadPdfLibraries();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const { headerHeight, contentLeft, pageWidth, accent, text } = drawPdfHeader(doc, {
    title: 'Reporte de Abonos Detectados',
    context,
  });

  const montoTotal = abonos.reduce(
    (sum, abono) => sum + ((abono.total_anterior || 0) - (abono.total_nuevo || 0)),
    0
  );

  const documentosUnicos = new Set(
    abonos.map((abono) => abono.documento).filter(Boolean)
  ).size;

  const cardsEndY = drawPdfMetricCards(doc, {
    y: headerHeight + 6,
    contentLeft,
    pageWidth,
    cards: [
      {
        label: 'Total Abonos',
        value: String(abonos.length),
        color: [59, 130, 246],
        soft: [219, 234, 254],
      },
      {
        label: 'Monto Total',
        value: fmtMoney(montoTotal),
        color: [16, 185, 129],
        soft: [209, 250, 229],
      },
      {
        label: 'Documentos',
        value: String(documentosUnicos),
        color: [107, 114, 128],
        soft: [243, 244, 246],
      },
    ],
  });

  const tableData = abonos.map((abono) => [
    abono.fecha ? abono.fecha.split('T')[0] : '-',
    abono.cliente || abono.razon_social || '-',
    abono.documento || '-',
    fmtMoney(abono.total_anterior || 0),
    fmtMoney((abono.total_anterior || 0) - (abono.total_nuevo || 0)),
    fmtMoney(abono.total_nuevo || 0),
    abono.observacion || '-',
  ]);

  autoTable(doc, {
    head: [[
      'Fecha',
      'Cliente',
      'Documento',
      'Saldo Anterior',
      'Pago',
      'Nuevo Saldo',
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
      lineWidth: 0.2,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [219, 234, 254],
      textColor: accent,
      fontStyle: 'bold',
      halign: 'left',
      lineColor: accent,
      lineWidth: 0.5,
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: contentLeft, right: contentLeft, bottom: 18 },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right', textColor: [16, 185, 129] },
      5: { halign: 'right' },
    },
    pageBreak: 'auto',
    rowPageBreak: 'avoid',
  });

  savePdfDocument(
    doc,
    `Abonos_${context.generadoEn.toISOString().split('T')[0]}.pdf`,
    context
  );
};
