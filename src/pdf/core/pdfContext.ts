import type { PdfContext } from './pdfTypes';

export interface EmpresaPdfSource {
  nombre?: string;
  ruc?: string;
  logo?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  administrador?: string;
}

export const createPdfContext = (
  empresa: EmpresaPdfSource,
  generatedAt: Date = new Date()
): PdfContext => ({
  empresa: {
    nombre: empresa.nombre?.trim() || 'Mi Empresa',
    ruc: empresa.ruc?.trim() || undefined,
    logo: empresa.logo?.trim() || undefined,
    direccion: empresa.direccion?.trim() || undefined,
    telefono: empresa.telefono?.trim() || undefined,
    email: empresa.email?.trim() || undefined,
  },
  usuario: {
    nombre: empresa.administrador?.trim() || 'Usuario no configurado',
  },
  generadoEn: generatedAt,
  sistema: 'Cartera Dashboard',
});
