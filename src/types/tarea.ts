export const TAREA_TIPOS = [
  'LLAMAR',
  'ENVIAR_CORREO',
  'VISITAR',
  'REVISAR_PROMESA',
  'REVISAR_DOCUMENTOS',
  'SEGUIMIENTO_GENERAL',
] as const;

export const TAREA_PRIORIDADES = ['ALTA', 'MEDIA', 'BAJA'] as const;
export const TAREA_ESTADOS = ['PENDIENTE', 'EN_PROGRESO', 'COMPLETADA', 'CANCELADA'] as const;
export const TAREA_ESTADOS_OPERATIVOS = ['VENCIDA', 'HOY', 'PROXIMA', 'COMPLETADA', 'CANCELADA'] as const;

export type TareaTipo = typeof TAREA_TIPOS[number];
export type TareaPrioridad = typeof TAREA_PRIORIDADES[number];
export type TareaEstado = typeof TAREA_ESTADOS[number];
export type TareaEstadoOperativo = typeof TAREA_ESTADOS_OPERATIVOS[number];
export type TareaSort = 'FECHA_ASC' | 'FECHA_DESC' | 'PRIORIDAD';

export interface Tarea {
  id: number;
  cliente: string;
  responsable: string;
  gestion_origen_id: number | null;
  promesa_id: number | null;
  tipo: TareaTipo;
  titulo: string;
  descripcion: string | null;
  fecha_programada: string;
  prioridad: TareaPrioridad;
  estado: TareaEstado;
  creado_en: string;
  actualizado_en: string;
  completado_en: string | null;
  cancelado_en: string | null;
  version: number;
  idempotency_key: string | null;
  creation_payload_hash: string | null;
  estado_operativo?: TareaEstadoOperativo;
}

export interface TareaCreateInput {
  cliente: string;
  responsable?: string;
  gestion_origen_id?: number | null;
  promesa_id?: number | null;
  tipo: TareaTipo;
  titulo: string;
  descripcion?: string | null;
  fecha_programada: string;
  prioridad?: TareaPrioridad;
  idempotency_key?: string | null;
  actor?: string;
}

export type TareaEditableFields = Pick<Tarea, 'tipo' | 'titulo' | 'descripcion' | 'fecha_programada' | 'prioridad' | 'responsable'>;
export type TareaUpdateInput = Partial<TareaEditableFields> & { expectedVersion: number; actor?: string };

export interface TareasListQuery {
  page?: number;
  pageSize?: number;
  cliente?: string;
  responsable?: string;
  tipo?: TareaTipo;
  prioridad?: TareaPrioridad;
  estado?: TareaEstado | TareaEstadoOperativo;
  fechaDesde?: string;
  fechaHasta?: string;
  search?: string;
  sort?: TareaSort;
  now?: string;
}

export type TareaListQuery = TareasListQuery;

export interface TareaStateChangeInput {
  id: number;
  expectedVersion: number;
  estado: Extract<TareaEstado, 'PENDIENTE' | 'EN_PROGRESO'>;
  actor?: string;
}

export interface TareaCompleteInput {
  id: number;
  expectedVersion: number;
  actor?: string;
}

export interface TareaCancelInput extends TareaCompleteInput {
  motivo?: string;
}

export interface TareaEditRequest extends TareaUpdateInput {
  id: number;
}

export interface TareaEventListQuery {
  tareaId: number;
  page?: number;
  pageSize?: number;
}

export interface TareaEvento {
  id: number;
  tarea_id: number;
  tipo_evento: 'TAREA_CREADA' | 'TAREA_EDITADA' | 'TAREA_REPROGRAMADA' | 'TAREA_ESTADO_CAMBIADO' | 'TAREA_COMPLETADA' | 'TAREA_CANCELADA';
  estado_anterior: TareaEstado | null;
  estado_nuevo: TareaEstado | null;
  actor: string;
  fecha: string;
  metadata: string;
}

export type TareaEvent = TareaEvento;

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type TareaErrorCode =
  | 'TAREA_INVALID'
  | 'TAREA_NOT_FOUND'
  | 'TAREA_VERSION_CONFLICT'
  | 'TAREA_INVALID_TRANSITION'
  | 'TAREA_IDEMPOTENCY_CONFLICT';

export type TareaMutationResult =
  | { ok: true; tarea: Tarea; changed: boolean }
  | { ok: false; code: TareaErrorCode; message: string };

export type TareaErrorResult = Extract<TareaMutationResult, { ok: false }>;
export type TareaListResult = PaginatedResult<Tarea> | TareaErrorResult;
export type TareaEventListResult = PaginatedResult<TareaEvent> | TareaErrorResult;
