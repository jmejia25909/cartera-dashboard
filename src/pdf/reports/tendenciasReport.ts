import type { PdfContext } from '../core/pdfTypes';
import { drawPdfHeader } from '../core/pdfHeader';
import { drawPdfMetricCards } from '../core/pdfCards';
import { loadPdfLibraries, savePdfDocument } from '../core/pdfDocument';

export interface TendenciaReportRow {
  mes?: string;
  documentos?: number;
  emision?: number;
  cobrado?: number;
  vencidos?: number;
}

export interface GenerateTendenciasReportParams {
  tendencias: TendenciaReportRow[];
  context: PdfContext;
}

const fmtMoney = (amount: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number.isFinite(amount) ? amount : 0);

const getTasaCobro = (row: TendenciaReportRow): number => {
  const documentos = row.documentos || 0;
  return documentos > 0
    ? Math.round(((documentos - (row.vencidos || 0)) / documentos) * 100)
    : 0;
};

export const generateTendenciasReport = async ({
  tendencias,
  context,
}: GenerateTendenciasReportParams): Promise<void> => {
  if (tendencias.length === 0) {
    throw new Error('No hay datos de tendencias para generar el reporte.');
  }

  const { jsPDF, autoTable } = await loadPdfLibraries();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const { headerHeight, contentLeft, pageWidth, accent, text } = drawPdfHeader(doc, {
    title: 'Tendencias Históricas',
    context,
    detailLines: ['Periodo: Últimos 12 meses'],
  });

  const totalEmision = tendencias.reduce((sum, item) => sum + (item.emision || 0), 0);
  const totalCobrado = tendencias.reduce((sum, item) => sum + (item.cobrado || 0), 0);
  const totalDocumentos = tendencias.reduce(
    (sum, item) => sum + (item.documentos || 0),
    0
  );
  const totalVencidos = tendencias.reduce((sum, item) => sum + (item.vencidos || 0), 0);
  const tasaCobro = totalDocumentos > 0
    ? Math.round(((totalDocumentos - totalVencidos) / totalDocumentos) * 100)
    : 0;

  const cardsEndY = drawPdfMetricCards(doc, {
    y: headerHeight + 6,
    contentLeft,
    pageWidth,
    cards: [
      {
        label: 'Total Emitido',
        value: fmtMoney(totalEmision),
        color: [59, 130, 246],
        soft: [219, 234, 254],
      },
      {
        label: 'Total Cobrado',
        value: fmtMoney(totalCobrado),
        color: [16, 185, 129],
        soft: [209, 250, 229],
      },
      {
        label: 'Tasa de Cobro',
        value: `${tasaCobro}%`,
        color: [107, 114, 128],
        soft: [243, 244, 246],
      },
    ],
  });

  const tableData = tendencias.map((item) => [
    item.mes || '-',
    String(item.documentos || 0),
    fmtMoney(item.emision || 0),
    fmtMoney(item.cobrado || 0),
    `${getTasaCobro(item)}%`,
    String(item.vencidos || 0),
  ]);

  autoTable(doc, {
    head: [['Mes', 'Documentos', 'Emisión', 'Cobrado', 'Tasa Cobro', 'Vencidos']],
    body: tableData,
    startY: cardsEndY + 8,
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: text,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [219, 234, 254],
      textColor: accent,
      fontStyle: 'bold',
      halign: 'center',
      lineColor: accent,
      lineWidth: 0.5,
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: contentLeft, right: contentLeft, bottom: 18 },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right', textColor: [16, 185, 129] },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
    pageBreak: 'auto',
    rowPageBreak: 'avoid',
  });

  savePdfDocument(
    doc,
    `Tendencias_${context.generadoEn.toISOString().split('T')[0]}.pdf`,
    context
  );
};
