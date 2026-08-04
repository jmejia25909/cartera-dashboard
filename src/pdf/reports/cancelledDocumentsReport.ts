import type { PdfContext } from '../core/pdfTypes';
import { drawPdfHeader } from '../core/pdfHeader';
import { drawPdfMetricCards } from '../core/pdfCards';
import { loadPdfLibraries, savePdfDocument } from '../core/pdfDocument';

export interface CancelledDocumentReportRow {
  documento: string;
  cliente?: string | null;
  fecha_anulacion?: string | null;
  archivo_origen?: string | null;
  detectado_en?: string | null;
  resultado: string;
  tipo_documento?: string | null;
  estado_origen?: string | null;
  numero_autorizacion?: string | null;
}

export interface GenerateCancelledDocumentsReportParams {
  rows: CancelledDocumentReportRow[];
  context: PdfContext;
  reversedPayments?: number;
  reversedAmount?: number;
}

const fmtMoney = (amount: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number.isFinite(amount) ? amount : 0);

const fileNameOnly = (value?: string | null): string => {
  if (!value) return '-';
  return value.replace(/\\/g, '/').split('/').pop() || value;
};

const formatResult = (value?: string | null): string => {
  if (!value) return '-';
  return value.split('_').join(' ');
};

const formatDate = (value?: string | null): string => {
  if (!value) return '-';
  const normalized = value.includes('T') ? value.split('T')[0] : value;
  return normalized || '-';
};

export const generateCancelledDocumentsReport = async ({
  rows,
  context,
  reversedPayments = 0,
  reversedAmount = 0,
}: GenerateCancelledDocumentsReportParams): Promise<void> => {
  if (rows.length === 0) {
    throw new Error('No hay documentos anulados para generar el reporte.');
  }

  const { jsPDF, autoTable } = await loadPdfLibraries();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const { headerHeight, contentLeft, pageWidth, accent, text } = drawPdfHeader(doc, {
    title: 'Reporte de Documentos Anulados',
    context,
  });

  const anulados = rows.filter((row) => row.resultado === 'ANULADO').length;
  const yaAnulados = rows.filter((row) => row.resultado === 'YA_ANULADO').length;
  const noEncontrados = rows.filter((row) => row.resultado === 'NO_ENCONTRADO').length;

  const cardsEndY = drawPdfMetricCards(doc, {
    y: headerHeight + 6,
    contentLeft,
    pageWidth,
    cards: [
      {
        label: 'Total Registros',
        value: String(rows.length),
        color: [59, 130, 246],
        soft: [219, 234, 254],
      },
      {
        label: 'Anulados',
        value: String(anulados),
        color: [220, 38, 38],
        soft: [254, 226, 226],
      },
      {
        label: 'Ya Anulados',
        value: String(yaAnulados),
        color: [217, 119, 6],
        soft: [254, 243, 199],
      },
      {
        label: 'No Encontrados',
        value: String(noEncontrados),
        color: [107, 114, 128],
        soft: [243, 244, 246],
      },
      {
        label: 'Abonos Reversados',
        value: String(reversedPayments),
        color: [124, 58, 237],
        soft: [237, 233, 254],
      },
      {
        label: 'Valor Reversado',
        value: fmtMoney(reversedAmount),
        color: [5, 150, 105],
        soft: [209, 250, 229],
      },
    ],
  });

  const tableData = rows.map((row) => [
    formatDate(row.fecha_anulacion),
    row.tipo_documento || '-',
    row.documento || '-',
    row.cliente || '-',
    row.estado_origen || '-',
    formatResult(row.resultado),
    row.numero_autorizacion || '-',
    formatDate(row.detectado_en),
    fileNameOnly(row.archivo_origen),
  ]);

  autoTable(doc, {
    head: [[
      'Fecha AnulaciÃ³n',
      'Tipo',
      'Documento',
      'Cliente',
      'Estado Origen',
      'Resultado',
      'AutorizaciÃ³n',
      'Detectado',
      'Archivo Origen',
    ]],
    body: tableData,
    startY: cardsEndY + 8,
    theme: 'plain',
    styles: {
      fontSize: 7.2,
      cellPadding: 1.8,
      textColor: text,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [254, 226, 226],
      textColor: [185, 28, 28],
      fontStyle: 'bold',
      halign: 'left',
      lineColor: accent,
      lineWidth: 0.4,
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: contentLeft, right: contentLeft, bottom: 18 },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 22 },
      2: { cellWidth: 34 },
      3: { cellWidth: 46 },
      4: { cellWidth: 24 },
      5: { cellWidth: 30, fontStyle: 'bold' },
      6: { cellWidth: 48, fontSize: 6.4 },
      7: { cellWidth: 22 },
      8: { cellWidth: 30 },
    },
    didParseCell: (data: any) => {
      if (data.section !== 'body' || data.column.index !== 5) return;
      const value = String(data.cell.raw || '');
      if (value === 'ANULADO') {
        data.cell.styles.fillColor = [254, 226, 226];
        data.cell.styles.textColor = [185, 28, 28];
      } else if (value === 'YA ANULADO') {
        data.cell.styles.fillColor = [254, 243, 199];
        data.cell.styles.textColor = [161, 98, 7];
      } else if (value === 'NO ENCONTRADO') {
        data.cell.styles.fillColor = [243, 244, 246];
        data.cell.styles.textColor = [75, 85, 99];
      }
    },
    pageBreak: 'auto',
    rowPageBreak: 'avoid',
  });

  savePdfDocument(
    doc,
    `Documentos_Anulados_${context.generadoEn.toISOString().split('T')[0]}.pdf`,
    context,
  );
};

