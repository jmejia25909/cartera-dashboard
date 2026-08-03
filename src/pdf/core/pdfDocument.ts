import type { jsPDF as JsPdfInstance } from 'jspdf';
import type { PdfContext, PdfLibraries } from './pdfTypes';
import { drawPdfFooter } from './pdfFooter';

export const loadPdfLibraries = async (): Promise<PdfLibraries> => {
  const jspdfModule = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');

  const jsPDF = jspdfModule.default;
  const autoTable = autoTableModule.default ?? autoTableModule.autoTable;

  if (!jsPDF || typeof autoTable !== 'function') {
    throw new Error('No se pudieron cargar jsPDF y jsPDF-AutoTable.');
  }

  return { jsPDF, autoTable };
};

export const savePdfDocument = (
  doc: JsPdfInstance,
  filename: string,
  context: PdfContext
): void => {
  drawPdfFooter(doc, { context });

  doc.setProperties({
    title: filename.replace(/\.pdf$/i, ''),
    subject: 'Reporte generado por Cartera Dashboard',
    author: context.usuario?.nombre || context.empresa.nombre,
    creator: context.sistema,
    keywords: 'cartera,cobranza,reporte,pdf',
  });

  doc.save(filename);
};
