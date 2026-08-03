import type { PdfContext } from '../core/pdfTypes';
import { drawPdfHeader } from '../core/pdfHeader';
import { loadPdfLibraries, savePdfDocument } from '../core/pdfDocument';

export interface EstadoCuentaDocumento {
  documento?: string;
  numero?: string;
  fecha_emision?: string;
  fecha_vencimiento?: string;
  total?: number;
  saldo?: number;
  valor_documento?: number;
  dias_vencidos?: number;
}

export interface GenerateEstadoCuentaReportParams {
  clienteNombre: string;
  documentos: EstadoCuentaDocumento[];
  context: PdfContext;
}

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getAmount = (documento: EstadoCuentaDocumento): number =>
  toNumber(documento.total ?? documento.saldo ?? documento.valor_documento ?? 0);

const fmtMoney = (amount: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number.isFinite(amount) ? amount : 0);

const safeFilename = (value: string): string =>
  value.replace(/[^a-z0-9]/gi, '_');

export const generateEstadoCuentaReport = async ({
  clienteNombre,
  documentos,
  context,
}: GenerateEstadoCuentaReportParams): Promise<void> => {
  if (!clienteNombre.trim()) {
    throw new Error('Debe especificar un cliente para generar el estado de cuenta.');
  }

  if (documentos.length === 0) {
    throw new Error('El cliente no tiene documentos para generar el estado de cuenta.');
  }

  const { jsPDF, autoTable } = await loadPdfLibraries();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margin = 15;

  const { headerHeight, pageWidth, text, accent } = drawPdfHeader(doc, {
    title: 'ESTADO DE CUENTA',
    context,
  });

  const totalDeuda = documentos.reduce((sum, item) => sum + getAmount(item), 0);
  const documentosVencidos = documentos.filter((item) => (item.dias_vencidos || 0) > 0);
  const totalVencido = documentosVencidos.reduce((sum, item) => sum + getAmount(item), 0);
  const totalPorVencer = totalDeuda - totalVencido;

  const startYInfo = headerHeight + 18;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, startYInfo, pageWidth - margin * 2, 25, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text('CLIENTE', margin + 6, startYInfo + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...text);
  doc.text(clienteNombre, margin + 6, startYInfo + 17);

  const startYKpi = startYInfo + 35;
  const kpiWidth = (pageWidth - margin * 2 - 10) / 3;

  const drawKpi = (
    x: number,
    label: string,
    value: number,
    color: [number, number, number]
  ): void => {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, startYKpi, kpiWidth, 22, 2, 2, 'FD');
    doc.setFillColor(...color);
    doc.rect(x, startYKpi, 3, 22, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(label, x + 8, startYKpi + 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...text);
    doc.text(fmtMoney(value), x + 8, startYKpi + 17);
  };

  drawKpi(margin, 'TOTAL DEUDA', totalDeuda, [59, 130, 246]);
  drawKpi(margin + kpiWidth + 5, 'VENCIDO', totalVencido, [239, 68, 68]);
  drawKpi(margin + (kpiWidth + 5) * 2, 'POR VENCER', totalPorVencer, [16, 185, 129]);

  const tableData = documentosVencidos
    .sort((a, b) => (b.dias_vencidos || 0) - (a.dias_vencidos || 0))
    .map((item) => [
      item.documento || item.numero || '-',
      item.fecha_emision || '-',
      item.fecha_vencimiento || '-',
      `${item.dias_vencidos || 0} días`,
      fmtMoney(getAmount(item)),
    ]);

  autoTable(doc, {
    head: [['Documento', 'Emisión', 'Vencimiento', 'Estado', 'Saldo']],
    body: tableData,
    startY: startYKpi + 32,
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: text,
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [219, 234, 254],
      textColor: accent,
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
    margin: { left: margin, right: margin, bottom: 18 },
    pageBreak: 'auto',
    rowPageBreak: 'avoid',
  });

  savePdfDocument(
    doc,
    `Estado_Cuenta_${safeFilename(clienteNombre)}.pdf`,
    context
  );
};
