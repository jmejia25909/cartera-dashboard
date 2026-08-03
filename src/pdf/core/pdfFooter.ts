import type { jsPDF } from 'jspdf';
import { PDF_THEME } from './pdfTheme';
import type { PdfFooterOptions } from './pdfTypes';

export const drawPdfFooter = (
  doc: jsPDF,
  options: PdfFooterOptions
): void => {
  const contentLeft = options.contentLeft ?? PDF_THEME.contentLeft;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const totalPages = doc.getNumberOfPages();
  const userName = options.context.usuario?.nombre?.trim();

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    doc.setPage(pageNumber);
    doc.setDrawColor(...PDF_THEME.border);
    doc.setLineWidth(0.3);
    doc.line(contentLeft, pageHeight - 14, pageWidth - contentLeft, pageHeight - 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...PDF_THEME.muted);

    const generatedBy = userName
      ? `Generado por: ${userName} · ${options.context.generadoEn.toLocaleString('es-EC')}`
      : `Generado: ${options.context.generadoEn.toLocaleString('es-EC')}`;

    doc.text(generatedBy, contentLeft, pageHeight - 10);
    doc.text(
      `Página ${pageNumber} de ${totalPages}`,
      pageWidth - contentLeft - 28,
      pageHeight - 10
    );
  }
};
