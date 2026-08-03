import type { jsPDF } from 'jspdf';
import { PDF_THEME } from './pdfTheme';
import type { PdfHeaderOptions, PdfHeaderResult } from './pdfTypes';

const clean = (value?: string): string => (value || '').trim();

export const drawPdfHeader = (
  doc: jsPDF,
  options: PdfHeaderOptions
): PdfHeaderResult => {
  const { title, context } = options;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentLeft = PDF_THEME.contentLeft;
  const headerHeight = PDF_THEME.headerHeight;

  doc.setFillColor(...PDF_THEME.headerBackground);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  doc.setFillColor(...PDF_THEME.accent);
  doc.rect(0, 0, pageWidth, 3, 'F');

  doc.setFillColor(...PDF_THEME.headerCirclePrimary);
  doc.circle(pageWidth - 28, 12, 18, 'F');

  doc.setFillColor(...PDF_THEME.headerCircleSecondary);
  doc.circle(pageWidth - 50, 30, 24, 'F');

  const logo = clean(context.empresa.logo);
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', contentLeft, 9, 22, 22, undefined, 'FAST');
    } catch (error) {
      console.warn('No se pudo cargar el logo en el PDF:', error);
    }
  }

  const titleX = logo ? contentLeft + 28 : contentLeft;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...PDF_THEME.text);
  doc.text(title, titleX, 16);

  const defaultLines = [
    `Empresa: ${clean(context.empresa.nombre) || 'Mi Empresa'}`,
    clean(context.empresa.ruc) ? `RUC: ${clean(context.empresa.ruc)}` : '',
    clean(context.usuario?.nombre) ? `Usuario: ${clean(context.usuario?.nombre)}` : '',
    `Fecha: ${context.generadoEn.toLocaleString('es-EC')}`,
  ];

  const lines = [...defaultLines, ...(options.detailLines ?? [])]
    .map(clean)
    .filter(Boolean)
    .slice(0, 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_THEME.muted);

  const baseY = 22;
  lines.forEach((line, index) => {
    doc.text(line, titleX, baseY + index * 4.6);
  });

  return {
    headerHeight,
    contentLeft,
    pageWidth,
    accent: PDF_THEME.accent,
    muted: PDF_THEME.muted,
    text: PDF_THEME.text,
  };
};
