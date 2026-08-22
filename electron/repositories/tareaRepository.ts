import type Database from 'better-sqlite3';
import {
  TAREA_ESTADOS,
  TAREA_PRIORIDADES,
  TAREA_TIPOS,
  type PaginatedResult,
  type Tarea,
  type TareaCreateInput,
  type TareaEstado,
  type TareaEstadoOperativo,
  type TareaEvento,
  type TareaMutationResult,
  type TareaUpdateInput,
  type TareasListQuery,
} from '../../src/types/tarea';

const TAREA_COLUMNS = `id,cliente,responsable,gestion_origen_id,promesa_id,tipo,titulo,
  descripcion,fecha_programada,prioridad,estado,creado_en,actualizado_en,
  completado_en,cancelado_en,version,idempotency_key`;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/;
const OPEN_STATES: readonly TareaEstado[] = ['PENDIENTE', 'EN_PROGRESO'];

function localTimestamp(value = new Date()): string {
  const part = (number: number) => String(number).padStart(2, '0');
  return `${value.getFullYear()}-${part(value.getMonth() + 1)}-${part(value.getDate())} ${part(value.getHours())}:${part(value.getMinutes())}:${part(value.getSeconds())}`;
}

export function normalizeTareaDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = DATE_PATTERN.exec(value.trim());
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const date = new Date(year, month - 1, day, hour, minute, second, 0);
  if (
    date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day
    || date.getHours() !== hour || date.getMinutes() !== minute || date.getSeconds() !== second
  ) return null;
  return `${yearText}-${monthText}-${dayText} ${hourText}:${minuteText}:${secondText}`;
}

export function deriveTareaEstadoOperativo(tarea: Pick<Tarea, 'estado' | 'fecha_programada'>, now = localTimestamp()): TareaEstadoOperativo {
  if (tarea.estado === 'COMPLETADA') return 'COMPLETADA';
  if (tarea.estado === 'CANCELADA') return 'CANCELADA';
  if (tarea.fecha_programada < now) return 'VENCIDA';
  if (tarea.fecha_programada.slice(0, 10) === now.slice(0, 10)) return 'HOY';
  return 'PROXIMA';
}

const includes = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && values.includes(value as T);

const positiveId = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const cleanText = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const optionalText = (value: unknown): string | null => {
  const normalized = cleanText(value);
  return normalized || null;
};

function actorOf(value: unknown): string {
  return cleanText(value) || 'sistema';
}

function failure(code: Extract<TareaMutationResult, { ok: false }>['code'], message: string): TareaMutationResult {
  return { ok: false, code, message };
}

export function getTareaById(db: Database.Database, id: number): Tarea | undefined {
  if (!positiveId(id)) return undefined;
  return db.prepare(`SELECT ${TAREA_COLUMNS} FROM tareas WHERE id=?`).get(id) as Tarea | undefined;
}

function referenceExists(db: Database.Database, table: 'gestiones' | 'promesas', id: number | null): boolean {
  return id === null || Boolean(db.prepare(`SELECT 1 FROM ${table} WHERE id=?`).get(id));
}

function insertEvent(
  db: Database.Database,
  tareaId: number,
  type: TareaEvento['tipo_evento'],
  from: TareaEstado | null,
  to: TareaEstado | null,
  actor: string,
  metadata: Record<string, unknown> = {},
): void {
  db.prepare(`INSERT INTO tarea_eventos(tarea_id,tipo_evento,estado_anterior,estado_nuevo,actor,metadata)
    VALUES(?,?,?,?,?,?)`).run(tareaId, type, from, to, actor, JSON.stringify(metadata));
}

type NormalizedCreate = {
  cliente: string;
  responsable: string;
  gestion_origen_id: number | null;
  promesa_id: number | null;
  tipo: string;
  titulo: string;
  descripcion: string | null;
  fecha_programada: string;
  prioridad: string;
  estado: TareaEstado;
  idempotency_key: string | null;
};

type TareaRepositoryCreateInput = TareaCreateInput & { estado?: TareaEstado };

function normalizeCreate(input: TareaRepositoryCreateInput): NormalizedCreate | string {
  const cliente = cleanText(input?.cliente);
  const responsable = cleanText(input?.responsable ?? 'sistema');
  const titulo = cleanText(input?.titulo);
  const fecha = normalizeTareaDate(input?.fecha_programada);
  if (!cliente) return 'cliente requerido';
  if (!responsable) return 'responsable requerido';
  if (!includes(TAREA_TIPOS, input?.tipo)) return 'tipo inválido';
  if (!titulo) return 'titulo requerido';
  if (!fecha) return 'fecha_programada inválida; use YYYY-MM-DD HH:mm:ss local';
  if (!includes(TAREA_PRIORIDADES, input?.prioridad ?? 'MEDIA')) return 'prioridad inválida';
  if ((input?.estado ?? 'PENDIENTE') !== 'PENDIENTE') return 'estado inicial debe ser PENDIENTE';
  if (input?.gestion_origen_id != null && !positiveId(input.gestion_origen_id)) return 'gestion_origen_id inválido';
  if (input?.promesa_id != null && !positiveId(input.promesa_id)) return 'promesa_id inválido';
  return {
    cliente,
    responsable,
    gestion_origen_id: input.gestion_origen_id ?? null,
    promesa_id: input.promesa_id ?? null,
    tipo: input.tipo,
    titulo,
    descripcion: optionalText(input.descripcion),
    fecha_programada: fecha,
    prioridad: input.prioridad ?? 'MEDIA',
    estado: 'PENDIENTE',
    idempotency_key: optionalText(input.idempotency_key),
  };
}

function sameFunctionalPayload(existing: Tarea, normalized: NormalizedCreate): boolean {
  return existing.cliente === normalized.cliente
    && existing.responsable === normalized.responsable
    && existing.gestion_origen_id === normalized.gestion_origen_id
    && existing.promesa_id === normalized.promesa_id
    && existing.tipo === normalized.tipo
    && existing.titulo === normalized.titulo
    && existing.descripcion === normalized.descripcion
    && existing.fecha_programada === normalized.fecha_programada
    && existing.prioridad === normalized.prioridad
    && existing.estado === normalized.estado;
}

export function createTarea(db: Database.Database, input: TareaRepositoryCreateInput): TareaMutationResult {
  const normalized = normalizeCreate(input);
  if (typeof normalized === 'string') return failure('TAREA_INVALID', normalized);
  return db.transaction((): TareaMutationResult => {
    if (!referenceExists(db, 'gestiones', normalized.gestion_origen_id)) return failure('TAREA_INVALID', 'La Gestión de origen no existe.');
    if (!referenceExists(db, 'promesas', normalized.promesa_id)) return failure('TAREA_INVALID', 'La Promesa relacionada no existe.');
    if (normalized.idempotency_key) {
      const existing = db.prepare(`SELECT ${TAREA_COLUMNS} FROM tareas WHERE idempotency_key=?`).get(normalized.idempotency_key) as Tarea | undefined;
      if (existing) {
        return sameFunctionalPayload(existing, normalized)
          ? { ok: true, tarea: existing, changed: false }
          : failure('TAREA_IDEMPOTENCY_CONFLICT', 'La idempotency_key ya representa otra Tarea.');
      }
    }
    const result = db.prepare(`INSERT INTO tareas(
      cliente,responsable,gestion_origen_id,promesa_id,tipo,titulo,descripcion,
      fecha_programada,prioridad,estado,idempotency_key
    ) VALUES(
      @cliente,@responsable,@gestion_origen_id,@promesa_id,@tipo,@titulo,@descripcion,
      @fecha_programada,@prioridad,@estado,@idempotency_key
    )`).run(normalized);
    const tarea = getTareaById(db, Number(result.lastInsertRowid))!;
    insertEvent(db, tarea.id, 'TAREA_CREADA', null, tarea.estado, actorOf(input.actor), {
      cliente: tarea.cliente,
      responsable: tarea.responsable,
      tipo: tarea.tipo,
      titulo: tarea.titulo,
      fecha_programada: tarea.fecha_programada,
      prioridad: tarea.prioridad,
      gestion_origen_id: tarea.gestion_origen_id,
      promesa_id: tarea.promesa_id,
    });
    return { ok: true, tarea, changed: true };
  })();
}

function currentForMutation(db: Database.Database, id: number, expectedVersion: number): TareaMutationResult | Tarea {
  const current = getTareaById(db, id);
  if (!current) return failure('TAREA_NOT_FOUND', 'La Tarea no existe.');
  if (!Number.isSafeInteger(expectedVersion) || current.version !== expectedVersion) {
    return failure('TAREA_VERSION_CONFLICT', 'La Tarea fue modificada por otra operación.');
  }
  return current;
}

export function updateTarea(db: Database.Database, id: number, input: TareaUpdateInput): TareaMutationResult {
  return db.transaction((): TareaMutationResult => {
    const loaded = currentForMutation(db, id, input.expectedVersion);
    if ('ok' in loaded) return loaded;
    const current = loaded;
    if (current.estado === 'COMPLETADA' || current.estado === 'CANCELADA') {
      return failure('TAREA_INVALID_TRANSITION', 'Una Tarea terminal no puede editarse.');
    }

    const next = {
      tipo: input.tipo ?? current.tipo,
      titulo: input.titulo === undefined ? current.titulo : cleanText(input.titulo),
      descripcion: input.descripcion === undefined ? current.descripcion : optionalText(input.descripcion),
      fecha_programada: input.fecha_programada === undefined ? current.fecha_programada : normalizeTareaDate(input.fecha_programada),
      prioridad: input.prioridad ?? current.prioridad,
      responsable: input.responsable === undefined ? current.responsable : cleanText(input.responsable),
    };
    if (!includes(TAREA_TIPOS, next.tipo) || !includes(TAREA_PRIORIDADES, next.prioridad)
      || !next.titulo || !next.responsable || !next.fecha_programada) {
      return failure('TAREA_INVALID', 'Campos editables inválidos.');
    }

    const changes: Record<string, { anterior: unknown; nuevo: unknown }> = {};
    for (const key of ['tipo', 'titulo', 'descripcion', 'fecha_programada', 'prioridad', 'responsable'] as const) {
      if (current[key] !== next[key]) changes[key] = { anterior: current[key], nuevo: next[key] };
    }
    if (Object.keys(changes).length === 0) return { ok: true, tarea: current, changed: false };

    const result = db.prepare(`UPDATE tareas SET tipo=@tipo,titulo=@titulo,descripcion=@descripcion,
      fecha_programada=@fecha_programada,prioridad=@prioridad,responsable=@responsable,
      actualizado_en=datetime('now','localtime'),version=version+1 WHERE id=@id AND version=@expectedVersion`)
      .run({ ...next, id, expectedVersion: input.expectedVersion });
    if (result.changes !== 1) return failure('TAREA_VERSION_CONFLICT', 'La Tarea fue modificada por otra operación.');

    const actor = actorOf(input.actor);
    if (changes.fecha_programada) {
      insertEvent(db, id, 'TAREA_REPROGRAMADA', current.estado, current.estado, actor, {
        fecha_anterior: current.fecha_programada,
        fecha_nueva: next.fecha_programada,
      });
    }
    const otherChanges = Object.fromEntries(Object.entries(changes).filter(([key]) => key !== 'fecha_programada'));
    if (Object.keys(otherChanges).length > 0) insertEvent(db, id, 'TAREA_EDITADA', current.estado, current.estado, actor, { changes: otherChanges });
    return { ok: true, tarea: getTareaById(db, id)!, changed: true };
  })();
}

const TRANSITIONS: Record<TareaEstado, readonly TareaEstado[]> = {
  PENDIENTE: ['EN_PROGRESO', 'COMPLETADA', 'CANCELADA'],
  EN_PROGRESO: ['PENDIENTE', 'COMPLETADA', 'CANCELADA'],
  COMPLETADA: [],
  CANCELADA: [],
};

function transitionTarea(
  db: Database.Database,
  id: number,
  expectedVersion: number,
  target: TareaEstado,
  actor: string,
  motivo?: string,
): TareaMutationResult {
  return db.transaction((): TareaMutationResult => {
    const loaded = currentForMutation(db, id, expectedVersion);
    if ('ok' in loaded) return loaded;
    const current = loaded;
    if (current.estado === target) return { ok: true, tarea: current, changed: false };
    if (!TRANSITIONS[current.estado].includes(target)) return failure('TAREA_INVALID_TRANSITION', `Transición ${current.estado} → ${target} no permitida.`);

    const terminal = target === 'COMPLETADA' || target === 'CANCELADA';
    const result = db.prepare(`UPDATE tareas SET estado=@target,
      completado_en=CASE WHEN @target='COMPLETADA' THEN datetime('now','localtime') ELSE NULL END,
      cancelado_en=CASE WHEN @target='CANCELADA' THEN datetime('now','localtime') ELSE NULL END,
      actualizado_en=datetime('now','localtime'),version=version+1
      WHERE id=@id AND version=@expectedVersion`).run({ target, id, expectedVersion });
    if (result.changes !== 1) return failure('TAREA_VERSION_CONFLICT', 'La Tarea fue modificada por otra operación.');
    const type: TareaEvento['tipo_evento'] = target === 'COMPLETADA'
      ? 'TAREA_COMPLETADA'
      : target === 'CANCELADA'
        ? 'TAREA_CANCELADA'
        : 'TAREA_ESTADO_CAMBIADO';
    insertEvent(db, id, type, current.estado, target, actorOf(actor), target === 'CANCELADA' && optionalText(motivo) ? { motivo: optionalText(motivo) } : {});
    const tarea = getTareaById(db, id)!;
    if (terminal && ((target === 'COMPLETADA' && !tarea.completado_en) || (target === 'CANCELADA' && !tarea.cancelado_en))) {
      throw new Error('Timestamp terminal ausente.');
    }
    return { ok: true, tarea, changed: true };
  })();
}

export function changeTareaState(db: Database.Database, id: number, expectedVersion: number, estado: TareaEstado, actor = 'sistema'): TareaMutationResult {
  if (!includes(TAREA_ESTADOS, estado) || !OPEN_STATES.includes(estado)) return failure('TAREA_INVALID_TRANSITION', 'changeTareaState sólo acepta PENDIENTE o EN_PROGRESO.');
  return transitionTarea(db, id, expectedVersion, estado, actor);
}

export function completeTarea(db: Database.Database, id: number, expectedVersion: number, actor = 'sistema'): TareaMutationResult {
  return transitionTarea(db, id, expectedVersion, 'COMPLETADA', actor);
}

export function cancelTarea(db: Database.Database, id: number, expectedVersion: number, motivo?: string, actor = 'sistema'): TareaMutationResult {
  return transitionTarea(db, id, expectedVersion, 'CANCELADA', actor, motivo);
}

function pagination(pageValue?: number, pageSizeValue?: number): { page: number; pageSize: number } {
  const page = Number.isSafeInteger(pageValue) && Number(pageValue) > 0 ? Number(pageValue) : 1;
  const requestedSize = Number.isSafeInteger(pageSizeValue) && Number(pageSizeValue) > 0 ? Number(pageSizeValue) : 25;
  return { page, pageSize: Math.min(requestedSize, 100) };
}

export function listTareas(db: Database.Database, query: TareasListQuery = {}): PaginatedResult<Tarea> {
  const { page, pageSize } = pagination(query.page, query.pageSize);
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  const equals = (column: string, key: string, value: unknown) => {
    if (value !== undefined && value !== null && value !== '') {
      where.push(`${column}=@${key}`);
      params[key] = value;
    }
  };
  equals('cliente', 'cliente', optionalText(query.cliente));
  equals('responsable', 'responsable', optionalText(query.responsable));
  if (query.tipo !== undefined && !includes(TAREA_TIPOS, query.tipo)) throw new Error('tipo inválido');
  if (query.prioridad !== undefined && !includes(TAREA_PRIORIDADES, query.prioridad)) throw new Error('prioridad inválida');
  equals('tipo', 'tipo', query.tipo);
  equals('prioridad', 'prioridad', query.prioridad);

  const now = query.now === undefined ? localTimestamp() : normalizeTareaDate(query.now);
  if (!now) throw new Error('now inválido');
  if (query.estado) {
    if (query.estado === 'VENCIDA') {
      where.push("estado IN ('PENDIENTE','EN_PROGRESO') AND fecha_programada < @now");
      params.now = now;
    } else if (query.estado === 'HOY') {
      where.push("estado IN ('PENDIENTE','EN_PROGRESO') AND date(fecha_programada)=date(@now)");
      params.now = now;
    } else if (query.estado === 'PROXIMA') {
      where.push("estado IN ('PENDIENTE','EN_PROGRESO') AND date(fecha_programada)>date(@now)");
      params.now = now;
    } else if (includes(TAREA_ESTADOS, query.estado)) {
      equals('estado', 'estado', query.estado);
    } else throw new Error('estado inválido');
  }

  if (query.fechaDesde !== undefined) {
    const value = normalizeTareaDate(query.fechaDesde);
    if (!value) throw new Error('fechaDesde inválida');
    where.push('fecha_programada>=@fechaDesde');
    params.fechaDesde = value;
  }
  if (query.fechaHasta !== undefined) {
    const value = normalizeTareaDate(query.fechaHasta);
    if (!value) throw new Error('fechaHasta inválida');
    where.push('fecha_programada<=@fechaHasta');
    params.fechaHasta = value;
  }
  const search = optionalText(query.search);
  if (search) {
    where.push("(cliente LIKE @search ESCAPE '\\' OR titulo LIKE @search ESCAPE '\\' OR COALESCE(descripcion,'') LIKE @search ESCAPE '\\')");
    params.search = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const order = query.sort === 'FECHA_DESC'
    ? 'fecha_programada DESC,id DESC'
    : query.sort === 'PRIORIDAD'
      ? "CASE prioridad WHEN 'ALTA' THEN 3 WHEN 'MEDIA' THEN 2 ELSE 1 END DESC,fecha_programada ASC,id ASC"
      : 'fecha_programada ASC,id ASC';
  if (query.sort !== undefined && !['FECHA_ASC', 'FECHA_DESC', 'PRIORIDAD'].includes(query.sort)) throw new Error('sort inválido');
  const total = Number((db.prepare(`SELECT COUNT(*) total FROM tareas ${clause}`).get(params) as { total: number }).total);
  const rows = db.prepare(`SELECT ${TAREA_COLUMNS} FROM tareas ${clause} ORDER BY ${order} LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize }) as Tarea[];
  const items = rows.map(tarea => ({ ...tarea, estado_operativo: deriveTareaEstadoOperativo(tarea, now) }));
  return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

export function listTareaEventos(db: Database.Database, tareaId: number, query: { page?: number; pageSize?: number } = {}): PaginatedResult<TareaEvento> {
  const { page, pageSize } = pagination(query.page, query.pageSize);
  if (!positiveId(tareaId)) return { items: [], page, pageSize, total: 0, totalPages: 0 };
  const total = Number((db.prepare('SELECT COUNT(*) total FROM tarea_eventos WHERE tarea_id=?').get(tareaId) as { total: number }).total);
  const items = db.prepare(`SELECT id,tarea_id,tipo_evento,estado_anterior,estado_nuevo,actor,fecha,metadata
    FROM tarea_eventos WHERE tarea_id=? ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(tareaId, pageSize, (page - 1) * pageSize) as TareaEvento[];
  return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}
