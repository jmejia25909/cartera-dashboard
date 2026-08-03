import type { jsPDF } from 'jspdf';
import { PDF_THEME } from './pdfTheme';
import type { PdfColor } from './pdfTypes';

export interface PdfMetricCard {
  label: string;
  value: string;
  color: PdfColor;
  soft: PdfColor;
}

export interface DrawPdfMetricCardsParams {
  y: number;
  contentLeft: number;
  pageWidth: number;
  cards: PdfMetricCard[];
  height?: number;
  gap?: number;
}

export const drawPdfMetricCards = (
  doc: jsPDF,
  params: DrawPdfMetricCardsParams
): number => {
  const height = params.height ?? 16;
  const gap = params.gap ?? 4;
  const count = Math.max(params.cards.length, 1);
  const availableWidth = params.pageWidth - params.contentLeft * 2;
  const cardWidth = (availableWidth - gap * (count - 1)) / count;

  params.cards.forEach((card, index) => {
    const x = params.contentLeft + index * (cardWidth + gap);

    doc.setDrawColor(...PDF_THEME.border);
    doc.setFillColor(...card.soft);
    doc.roundedRect(x, params.y, cardWidth, height, 3, 3, 'FD');

    doc.setFillColor(...card.color);
    doc.rect(x, params.y, cardWidth, 1.2, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...PDF_THEME.muted);
    doc.text(card.label.toUpperCase(), x + 4, params.y + 6);

    doc.setFontSize(10);
    doc.setTextColor(...card.color);
    doc.text(card.value, x + 4, params.y + 12);
  });

  return params.y + height;
};
