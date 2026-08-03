import type { PdfColor } from './pdfTypes';

export const PDF_THEME = {
  accent: [59, 130, 246] as PdfColor,
  muted: [100, 116, 139] as PdfColor,
  text: [15, 23, 42] as PdfColor,
  headerBackground: [241, 245, 249] as PdfColor,
  headerCirclePrimary: [219, 234, 254] as PdfColor,
  headerCircleSecondary: [191, 219, 254] as PdfColor,
  border: [226, 232, 240] as PdfColor,
  contentLeft: 14,
  headerHeight: 47,
} as const;
