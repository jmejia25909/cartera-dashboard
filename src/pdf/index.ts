export { createPdfContext } from './core/pdfContext';
export { loadPdfLibraries, savePdfDocument } from './core/pdfDocument';
export { drawPdfHeader } from './core/pdfHeader';
export { drawPdfFooter } from './core/pdfFooter';
export { PDF_THEME } from './core/pdfTheme';
export type {
  PdfColor,
  PdfCompanyContext,
  PdfContext,
  PdfFooterOptions,
  PdfHeaderOptions,
  PdfHeaderResult,
  PdfLibraries,
  PdfUserContext,
} from './core/pdfTypes';
export { generateCarteraReport } from './reports/carteraReport';
export type {
  CarteraDocumento,
  CarteraReportFilters,
  GenerateCarteraReportParams,
} from './reports/carteraReport';
export { generatePromesasReport } from './reports/promesasReport';
export type {
  GeneratePromesasReportParams,
  PromesaPagoReportRow,
} from './reports/promesasReport';

export { generateAnalisisReport } from './reports/analisisReport';
export type {
  AnalisisView,
  DeudorCronicoReportRow,
  GenerateAnalisisReportParams,
  MotivoImpagoReportRow,
  ProductividadReportRow,
  RiesgoReportRow,
} from './reports/analisisReport';
export { drawPdfMetricCards } from './core/pdfCards';
export type {
  DrawPdfMetricCardsParams,
  PdfMetricCard,
} from './core/pdfCards';
export { generateAbonosReport } from './reports/abonosReport';
export type {
  AbonoReportRow,
  GenerateAbonosReportParams,
} from './reports/abonosReport';
export { generateAlertasReport } from './reports/alertasReport';
export type {
  AlertaReportRow,
  GenerateAlertasReportParams,
} from './reports/alertasReport';
export { generateEstadoCuentaReport } from './reports/estadoCuentaReport';
export type {
  EstadoCuentaDocumento,
  GenerateEstadoCuentaReportParams,
} from './reports/estadoCuentaReport';
export { generateGestionReport } from './reports/gestionReport';
export type {
  GenerateGestionReportParams,
  GestionReportRow,
} from './reports/gestionReport';
export { generateTendenciasReport } from './reports/tendenciasReport';
export type {
  GenerateTendenciasReportParams,
  TendenciaReportRow,
} from './reports/tendenciasReport';
