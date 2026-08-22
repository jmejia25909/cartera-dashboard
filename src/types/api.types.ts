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
  creado_en?: string;
  actualizado_en?: string | null;
  motivo?: string | null;
}

export type GestionCreateInput = Omit<
  GestionData,
  'id' | 'creado_en' | 'actualizado_en'
>;

export type GestionUpdateInput = Pick<
  GestionData,
  'tipo' | 'resultado' | 'observacion' | 'fecha_promesa' | 'monto_promesa' | 'usuario' | 'motivo'
>;

export type GestionMutationResult =
  | { ok: true; gestion: GestionData }
  | { ok: false; code: 'GESTION_NOT_FOUND' | 'GESTION_INVALID_ID'; message: string };

export interface GestionLegacyInput extends GestionCreateInput {
  legacy_id: string;
  id?: number;
}

export type GestionLegacyMigrationResult = {
  ok: true;
  mappings: Array<{
    legacy_id: string;
    gestion_id: number | null;
    inserted: boolean;
    deleted: boolean;
  }>;
} | {
  ok: false;
  code: 'LEGACY_ID_CONFLICT' | 'LEGACY_INVALID_RECORD';
  legacy_id: string;
  message: string;
};

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
