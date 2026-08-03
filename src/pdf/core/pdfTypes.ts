import type { jsPDF } from 'jspdf';

export type PdfColor = [number, number, number];

export interface PdfCompanyContext {
  nombre: string;
  ruc?: string;
  logo?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
}

export interface PdfUserContext {
  nombre?: string;
  cargo?: string;
}

export interface PdfContext {
  empresa: PdfCompanyContext;
  usuario?: PdfUserContext;
  generadoEn: Date;
  sistema: string;
}

export interface PdfHeaderOptions {
  title: string;
  context: PdfContext;
  detailLines?: string[];
}

export interface PdfHeaderResult {
  headerHeight: number;
  contentLeft: number;
  pageWidth: number;
  accent: PdfColor;
  muted: PdfColor;
  text: PdfColor;
}

export interface PdfFooterOptions {
  context: PdfContext;
  contentLeft?: number;
}

export interface PdfLibraries {
  jsPDF: typeof jsPDF;
  autoTable: typeof import('jspdf-autotable').default;
}
