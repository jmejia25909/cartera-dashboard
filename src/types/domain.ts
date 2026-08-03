export interface Documento {
  id: number;
  documento: string;
  numero?: string;
  cliente: string;
  razon_social?: string;
  vendedor?: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  total: number;
  saldo?: number;
  valor_documento?: number;
  dias_vencidos?: number;
  por_vencer?: number;
  retenciones?: number;
  centro_costo?: string;
  aging?: string;
}

export interface Alerta {
  cliente: string;
  documento: string;
  monto: number;
  diasVencidos: number;
  severidad: string;
}

export interface Gestion {
  id: number | string;
  cliente: string;
  razon_social?: string;
  fecha: string;
  tipo: string;
  resultado: string;
  observacion: string;
  motivo?: string;
  fecha_promesa?: string;
  monto_promesa?: number;
}

export type SeveridadLevel = 'critical' | 'high' | 'medium' | 'low' | 'normal';

export interface SeveridadNormalizada {
  label: string;
  level: SeveridadLevel;
}
