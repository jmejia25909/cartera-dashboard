import type Database from 'better-sqlite3';
import {
  cancelTarea,
  changeTareaState,
  completeTarea,
  createTarea,
  getTareaById,
  listTareaEventos,
  listTareas,
  updateTarea,
} from '../repositories/tareaRepository';
import type {
  TareaCancelInput,
  TareaCompleteInput,
  TareaCreateInput,
  TareaEditRequest,
  TareaErrorResult,
  TareaEventListQuery,
  TareaListQuery,
  TareaStateChangeInput,
} from '../../src/types/tarea';

const own = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const positiveInteger = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;

function invalid(message: string): TareaErrorResult {
  return { ok: false, code: 'TAREA_INVALID', message };
}

function validPage(value: unknown, fallback: number): value is number | undefined {
  return value === undefined || (positiveInteger(value) && Number(value) <= (fallback === 25 ? Number.MAX_SAFE_INTEGER : 100));
}

const CREATE_PROTECTED = ['id', 'version', 'completado_en', 'cancelado_en', 'creado_en', 'actualizado_en'];
const EDIT_PROTECTED = ['cliente', 'gestion_origen_id', 'promesa_id', 'estado', 'version', 'completado_en', 'cancelado_en', 'creado_en', 'actualizado_en', 'idempotency_key'];

export function normalizeDatetimeLocal(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/.exec(value.trim());
  return match ? `${match[1]} ${match[2]}:${match[3] ?? '00'}` : null;
}

export function createTareaIpcHandlers(db: Database.Database) {
  return {
    tareaCrear(payload: unknown) {
      if (!record(payload)) return invalid('Contrato de creación inválido.');
      if (CREATE_PROTECTED.some(key => own(payload, key)) || (own(payload, 'estado') && payload.estado !== 'PENDIENTE')) {
        return invalid('La creación contiene campos protegidos.');
      }
      const input: TareaCreateInput = {
        cliente: payload.cliente as string,
        responsable: payload.responsable as string | undefined,
        gestion_origen_id: payload.gestion_origen_id as number | null | undefined,
        promesa_id: payload.promesa_id as number | null | undefined,
        tipo: payload.tipo as TareaCreateInput['tipo'],
        titulo: payload.titulo as string,
        descripcion: payload.descripcion as string | null | undefined,
        fecha_programada: payload.fecha_programada as string,
        prioridad: payload.prioridad as TareaCreateInput['prioridad'],
        idempotency_key: payload.idempotency_key as string | null | undefined,
        actor: payload.actor as string | undefined,
      };
      return createTarea(db, input);
    },

    tareaObtener(id: unknown) {
      return positiveInteger(id) ? getTareaById(db, id) ?? null : null;
    },

    tareasListar(payload: unknown) {
      if (payload !== undefined && !record(payload)) return invalid('Contrato de listado inválido.');
      const query = (payload ?? {}) as Record<string, unknown>;
      if (!validPage(query.page, 25) || !validPage(query.pageSize, 100)) return invalid('page debe ser >= 1 y pageSize debe estar entre 1 y 100.');
      return listTareas(db, query as TareaListQuery);
    },

    tareaEditar(payload: unknown) {
      if (!record(payload) || !positiveInteger(payload.id) || !positiveInteger(payload.expectedVersion)) return invalid('id y expectedVersion son requeridos.');
      if (EDIT_PROTECTED.some(key => own(payload, key))) return invalid('La edición contiene campos protegidos.');
      const request: TareaEditRequest = {
        id: payload.id,
        expectedVersion: payload.expectedVersion,
        tipo: payload.tipo as TareaEditRequest['tipo'],
        titulo: payload.titulo as string | undefined,
        descripcion: payload.descripcion as string | null | undefined,
        fecha_programada: payload.fecha_programada as string | undefined,
        prioridad: payload.prioridad as TareaEditRequest['prioridad'],
        responsable: payload.responsable as string | undefined,
        actor: payload.actor as string | undefined,
      };
      return updateTarea(db, request.id, request);
    },

    tareaCambiarEstado(payload: unknown) {
      if (!record(payload) || !positiveInteger(payload.id) || !positiveInteger(payload.expectedVersion)
        || (payload.estado !== 'PENDIENTE' && payload.estado !== 'EN_PROGRESO')) return invalid('Cambio de estado inválido.');
      const request = payload as unknown as TareaStateChangeInput;
      return changeTareaState(db, request.id, request.expectedVersion, request.estado, request.actor);
    },

    tareaCompletar(payload: unknown) {
      if (!record(payload) || !positiveInteger(payload.id) || !positiveInteger(payload.expectedVersion)) return invalid('id y expectedVersion son requeridos.');
      const request = payload as unknown as TareaCompleteInput;
      return completeTarea(db, request.id, request.expectedVersion, request.actor);
    },

    tareaCancelar(payload: unknown) {
      if (!record(payload) || !positiveInteger(payload.id) || !positiveInteger(payload.expectedVersion)) return invalid('id y expectedVersion son requeridos.');
      const request = payload as unknown as TareaCancelInput;
      return cancelTarea(db, request.id, request.expectedVersion, request.motivo, request.actor);
    },

    tareaEventosListar(payload: unknown) {
      if (!record(payload) || !positiveInteger(payload.tareaId) || !validPage(payload.page, 25) || !validPage(payload.pageSize, 100)) {
        return invalid('tareaId, page y pageSize inválidos.');
      }
      const request = payload as unknown as TareaEventListQuery;
      return listTareaEventos(db, request.tareaId, request);
    },
  };
}

export type TareaIpcHandlers = ReturnType<typeof createTareaIpcHandlers>;
