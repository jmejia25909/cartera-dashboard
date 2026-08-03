import type { PdfContext } from '../core/pdfTypes';
import { drawPdfHeader } from '../core/pdfHeader';
import { drawPdfMetricCards } from '../core/pdfCards';
import { loadPdfLibraries, savePdfDocument } from '../core/pdfDocument';

export interface AlertaReportRow {
  cliente?: string;
  documento?: string;
  monto?: number;
  diasVencidos?: number;
  severidad?: string;
}

export interface GenerateAlertasReportParams {
  alertas: AlertaReportRow[];
  context: PdfContext;
}

const fmtMoney = (amount: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number.isFinite(amount) ? amount : 0);

const normalizeSeveridad = (raw?: string): string => {
  const value = (raw || '').trim().toLowerCase();
  if (['critico', 'crítico', 'critica', 'crítica', 'critical'].includes(value)) return 'Crítico';
  if (['alta', 'alto', 'high'].includes(value)) return 'Alta';
  if (['media', 'medio', 'medium'].includes(value)) return 'Media';
  if (['baja', 'bajo', 'low'].includes(value)) return 'Baja';
  if (!value) return 'Sin datos';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

export const generateAlertasReport = async ({
  alertas,
  context,
}: GenerateAlertasReportParams): Promise<void> => {
  if (alertas.length === 0) {
    throw new Error('No hay alertas para generar el reporte.');
  }

  const { jsPDF, autoTable } = await loadPdfLibraries();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const { headerHeight, contentLeft, pageWidth, text } = drawPdfHeader(doc, {
    title: 'Alertas de Incumplimiento',
    context,
  });

  const montoVencido = alertas.reduce((sum, alerta) => sum + (alerta.monto || 0), 0);
  const promedioDias = alertas.length > 0
    ? Math.round(
        alertas.reduce((sum, alerta) => sum + (alerta.diasVencidos || 0), 0) /
          alertas.length
      )
    : 0;

  const cardsEndY = drawPdfMetricCards(doc, {
    y: headerHeight + 6,
    contentLeft,
    pageWidth,
    cards: [
      {
        label: 'Documentos Vencidos',
        value: String(alertas.length),
        color: [239, 68, 68],
        soft: [254, 226, 226],
      },
      {
        label: 'Monto Vencido',
        value: fmtMoney(montoVencido),
        color: [234, 88, 12],
        soft: [254, 237, 213],
      },
      {
        label: 'Promedio Días',
        value: String(promedioDias),
        color: [107, 114, 128],
        soft: [243, 244, 246],
      },
    ],
  });

  const tableData = alertas.map((alerta) => [
    alerta.cliente || '-',
    alerta.documento || '-',
    fmtMoney(alerta.monto || 0),
    String(alerta.diasVencidos || 0),
    normalizeSeveridad(alerta.severidad),
  ]);

  autoTable(doc, {
    head: [['Cliente', 'Documento', 'Monto', 'Días Vencido', 'Severidad']],
    body: tableData,
    startY: cardsEndY + 8,
    theme: 'plain',
    headStyles: {
      fillColor: [219, 234, 254],
      textColor: text,
      fontSize: 9,
      fontStyle: 'bold',
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    bodyStyles: {
      textColor: text,
      fontSize: 8,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } },
    margin: { left: contentLeft, right: contentLeft, bottom: 18 },
    pageBreak: 'auto',
    rowPageBreak: 'avoid',
  });

  savePdfDocument(
    doc,
    `Alertas-Incumplimiento-${context.generadoEn.toISOString().split('T')[0]}.pdf`,
    context
  );
};
