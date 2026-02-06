// Tipos centralizados para la API de Cartera

export interface Filtros {
  cliente?: string;
  vendedor?: string;
  tipo?: string;
  desde?: string;
  hasta?: string;
  estado?: string;
  minTotal?: number;
  maxTotal?: number;
}

export interface Documento {
  id: number;
  cliente: string;
  razon_social: string;
  tipo_documento: string;
  documento: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  vendedor: string;
  total: number;
  descripcion: string;
  valor_documento: number;
  retenciones: number;
  iva: number;
  cobros: number;
  is_subtotal: number;
  importado_en: string;
}

export interface EmpresaData {
  nombre: string;
  ruc?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  administrador?: string;
  iva_percent?: number;
  meta_mensual?: number;
  excel_headers_json?: string;
  tema?: string;
  logo?: string;
}

export interface ClienteInfo {
  cliente: string;
  razon_social?: string;
  vendedor?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  contacto?: string;
}

export interface GestionData {
  id?: number;
  cliente: string;
  fecha?: string;
  tipo?: string;
  resultado?: string;
  observacion?: string;
  fecha_promesa?: string;
  monto_promesa?: number;
  usuario?: string;
}

export interface GestionesReporteArgs {
  cliente?: string;
  tipo?: string;
  resultado?: string;
  desde?: string;
  hasta?: string;
}

export interface CampanaData {
  id?: number;
  nombre: string;
  descripcion?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  responsable?: string;
  clientes?: string[];
}

export interface DisputaData {
  id?: number;
  documento: string;
  cliente: string;
  monto?: number;
  motivo?: string;
  estado?: string;
  observacion?: string;
}

export interface CuentaAplicarData {
  id?: number;
  documento?: string;
  cliente: string;
  monto?: number;
  tipo?: string;
  estado?: string;
  fecha_aplicacion?: string;
  documento_aplicado?: string;
  observacion?: string;
}

export interface TopCliente {
  cliente: string;
  razon_social: string;
  total: number;
  percent: number;
}

export interface RiesgoCliente {
  cliente: string;
  razon_social: string;
  nivel: string;
  score: number;
  total: number;
}

export interface PronosticoMes {
  mes: string;
  proyectado: number;
  comprometido: number;
  riesgo: number;
}
