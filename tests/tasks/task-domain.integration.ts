import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  cancelTarea,
  changeTareaState,
  completeTarea,
  createTarea,
  deriveTareaEstadoOperativo,
  getTareaById,
  listTareaEventos,
  listTareas,
  updateTarea,
} from '../../electron/repositories/tareaRepository';
import type { Tarea, TareaCreateInput, TareaMutationResult } from '../../src/types/tarea';
import { createTareaIpcHandlers } from '../../electron/ipc/tareaIpc';
import { createGestion, deleteGestion } from '../../electron/repositories/gestionRepository';
import { normalizeDatetimeLocalForTarea } from '../../src/services/tareaForm';

const SCHEMA = `
  PRAGMA foreign_keys=ON;
  CREATE TABLE gestiones(id INTEGER PRIMARY KEY AUTOINCREMENT,cliente TEXT NOT NULL,fecha TEXT NOT NULL DEFAULT(datetime('now','localtime')),tipo TEXT,resultado TEXT,observacion TEXT,fecha_promesa TEXT,monto_promesa REAL DEFAULT 0,usuario TEXT DEFAULT 'sistema',creado_en TEXT NOT NULL DEFAULT(datetime('now','localtime')),actualizado_en TEXT,motivo TEXT);
  CREATE TABLE gestion_legacy_migrations(source TEXT NOT NULL,legacy_id TEXT NOT NULL,gestion_id INTEGER,migrated_at TEXT NOT NULL DEFAULT(datetime('now','localtime')),payload_hash TEXT NOT NULL,deleted_at TEXT,PRIMARY KEY(source,legacy_id),FOREIGN KEY(gestion_id) REFERENCES gestiones(id));
  CREATE TABLE promesas(id INTEGER PRIMARY KEY AUTOINCREMENT,cliente TEXT NOT NULL,gestion_id INTEGER UNIQUE,estado TEXT NOT NULL,monto_pagado REAL NOT NULL DEFAULT 0,fecha_pago TEXT,actualizado_en TEXT);
  CREATE TABLE promesa_eventos(id INTEGER PRIMARY KEY AUTOINCREMENT,promesa_id INTEGER NOT NULL,tipo_evento TEXT NOT NULL,estado_anterior TEXT,estado_nuevo TEXT,fecha TEXT DEFAULT(datetime('now','localtime')),metadata TEXT NOT NULL DEFAULT '{}');
  CREATE TABLE documentos(id INTEGER PRIMARY KEY AUTOINCREMENT,total REAL);
  CREATE TABLE cobros_movimientos_importados(id INTEGER PRIMARY KEY AUTOINCREMENT,valor REAL);
  CREATE TABLE abonos(id INTEGER PRIMARY KEY AUTOINCREMENT,total_nuevo REAL);
  CREATE TABLE promesa_cobro_atribuciones(promesa_id INTEGER,movement_key TEXT,importe_atribuido REAL);
  CREATE TABLE tareas(
    id INTEGER PRIMARY KEY AUTOINCREMENT,cliente TEXT NOT NULL,responsable TEXT NOT NULL DEFAULT 'sistema',
    gestion_origen_id INTEGER,promesa_id INTEGER,
    tipo TEXT NOT NULL CHECK(tipo IN('LLAMAR','ENVIAR_CORREO','VISITAR','REVISAR_PROMESA','REVISAR_DOCUMENTOS','SEGUIMIENTO_GENERAL')),
    titulo TEXT NOT NULL,descripcion TEXT,fecha_programada TEXT NOT NULL,
    prioridad TEXT NOT NULL DEFAULT 'MEDIA' CHECK(prioridad IN('ALTA','MEDIA','BAJA')),
    estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK(estado IN('PENDIENTE','EN_PROGRESO','COMPLETADA','CANCELADA')),
    creado_en TEXT NOT NULL DEFAULT(datetime('now','localtime')),actualizado_en TEXT NOT NULL DEFAULT(datetime('now','localtime')),
    completado_en TEXT,cancelado_en TEXT,version INTEGER NOT NULL DEFAULT 1,idempotency_key TEXT UNIQUE,
    FOREIGN KEY(gestion_origen_id) REFERENCES gestiones(id) ON DELETE SET NULL,
    FOREIGN KEY(promesa_id) REFERENCES promesas(id) ON DELETE SET NULL,
    CHECK(TRIM(cliente)<>''),CHECK(TRIM(responsable)<>''),CHECK(TRIM(titulo)<>''),
    CHECK((estado='COMPLETADA' AND completado_en IS NOT NULL AND cancelado_en IS NULL)
      OR (estado='CANCELADA' AND cancelado_en IS NOT NULL AND completado_en IS NULL)
      OR (estado IN('PENDIENTE','EN_PROGRESO') AND completado_en IS NULL AND cancelado_en IS NULL)));
  CREATE TABLE tarea_eventos(id INTEGER PRIMARY KEY AUTOINCREMENT,tarea_id INTEGER NOT NULL,
    tipo_evento TEXT NOT NULL CHECK(tipo_evento IN('TAREA_CREADA','TAREA_EDITADA','TAREA_REPROGRAMADA','TAREA_ESTADO_CAMBIADO','TAREA_COMPLETADA','TAREA_CANCELADA')),
    estado_anterior TEXT,estado_nuevo TEXT,actor TEXT NOT NULL DEFAULT 'sistema',
    fecha TEXT NOT NULL DEFAULT(datetime('now','localtime')),metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY(tarea_id) REFERENCES tareas(id));
  CREATE INDEX idx_tareas_fecha_abiertas ON tareas(fecha_programada,id) WHERE estado IN('PENDIENTE','EN_PROGRESO');
  CREATE INDEX idx_tareas_cliente_fecha ON tareas(cliente,fecha_programada DESC,id DESC);
  CREATE INDEX idx_tareas_estado_fecha ON tareas(estado,fecha_programada,id);
  CREATE INDEX idx_tareas_responsable_fecha ON tareas(responsable,estado,fecha_programada,id);
  CREATE INDEX idx_tareas_prioridad_fecha ON tareas(prioridad,fecha_programada,id);
  CREATE INDEX idx_tareas_promesa ON tareas(promesa_id,estado,fecha_programada) WHERE promesa_id IS NOT NULL;
  CREATE INDEX idx_tareas_gestion_origen ON tareas(gestion_origen_id) WHERE gestion_origen_id IS NOT NULL;
  CREATE INDEX idx_tarea_eventos_tarea ON tarea_eventos(tarea_id,id DESC);
`;

type Scenario = { id: string; name: string; run: () => void };
const tempRoot = path.resolve(os.tmpdir());

function cleanup(directory: string): void {
  const resolved = path.resolve(directory);
  if (resolved === tempRoot || !resolved.startsWith(`${tempRoot}${path.sep}`)) throw new Error('Ruta temporal insegura.');
  fs.rmSync(resolved, { recursive: true, force: true });
}

function withDb(run: (db: Database.Database, file: string) => void): void {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'zenith-d2a-'));
  const file = path.join(directory, 'tasks.sqlite');
  const db = new Database(file);
  db.exec(SCHEMA);
  try { run(db, file); } finally { if (db.open) db.close(); cleanup(directory); }
}

function base(overrides: Partial<TareaCreateInput> = {}): TareaCreateInput {
  return { cliente: 'CLIENTE-D2A', tipo: 'LLAMAR', titulo: 'Contactar al cliente', fecha_programada: '2099-01-02 09:30:00', ...overrides };
}

function created(db: Database.Database, overrides: Partial<TareaCreateInput> = {}): Tarea {
  const result = createTarea(db, base(overrides));
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
  return result.tarea;
}

function expectError(result: TareaMutationResult, code: Extract<TareaMutationResult, { ok: false }>['code']): void {
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, code);
}

function eventTypes(db: Database.Database, id: number): string[] {
  return (db.prepare('SELECT tipo_evento FROM tarea_eventos WHERE tarea_id=? ORDER BY id').all(id) as Array<{ tipo_evento: string }>).map(row => row.tipo_evento);
}

function financialSnapshot(db: Database.Database): unknown {
  return ['documentos', 'cobros_movimientos_importados', 'abonos', 'promesas', 'promesa_cobro_atribuciones'].map(table => ({
    table,
    rows: db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(),
  }));
}

const scenarios: Scenario[] = [
  { id: 'D2A-01', name: 'crear tarea', run: () => withDb(db => { const t = created(db); assert.equal(t.estado, 'PENDIENTE'); assert.deepEqual(eventTypes(db, t.id), ['TAREA_CREADA']); }) },
  { id: 'D2A-02', name: 'persistencia tras reapertura DB', run: () => withDb((db, file) => { const id = created(db).id; db.close(); const reopened = new Database(file); try { reopened.pragma('foreign_keys=ON'); assert.equal(getTareaById(reopened, id)?.id, id); } finally { reopened.close(); } }) },
  { id: 'D2A-03', name: 'cliente vacío rechazado', run: () => withDb(db => expectError(createTarea(db, base({ cliente: ' ' })), 'TAREA_INVALID')) },
  { id: 'D2A-04', name: 'título vacío rechazado', run: () => withDb(db => expectError(createTarea(db, base({ titulo: '' })), 'TAREA_INVALID')) },
  { id: 'D2A-05', name: 'tipo inválido rechazado', run: () => withDb(db => expectError(createTarea(db, base({ tipo: 'SMS' as never })), 'TAREA_INVALID')) },
  { id: 'D2A-06', name: 'fecha inválida rechazada', run: () => withDb(db => { for (const fecha of ['31/12/2099', '12/31/2099', '2099-02-30 10:00:00', '2099-01-01T10:00:00Z']) expectError(createTarea(db, base({ fecha_programada: fecha })), 'TAREA_INVALID'); }) },
  { id: 'D2A-07', name: 'prioridad inválida rechazada', run: () => withDb(db => expectError(createTarea(db, base({ prioridad: 'URGENTE' as never })), 'TAREA_INVALID')) },
  { id: 'D2A-08', name: 'relación gestión válida', run: () => withDb(db => { const id = Number(db.prepare("INSERT INTO gestiones(cliente) VALUES('C')").run().lastInsertRowid); assert.equal(created(db, { gestion_origen_id: id }).gestion_origen_id, id); }) },
  { id: 'D2A-09', name: 'relación gestión inexistente rechazada', run: () => withDb(db => expectError(createTarea(db, base({ gestion_origen_id: 999 })), 'TAREA_INVALID')) },
  { id: 'D2A-10', name: 'relación promesa válida', run: () => withDb(db => { const id = Number(db.prepare("INSERT INTO promesas(cliente,estado) VALUES('C','PENDIENTE')").run().lastInsertRowid); assert.equal(created(db, { promesa_id: id }).promesa_id, id); }) },
  { id: 'D2A-11', name: 'relación promesa inexistente rechazada', run: () => withDb(db => expectError(createTarea(db, base({ promesa_id: 999 })), 'TAREA_INVALID')) },
  { id: 'D2A-12', name: 'idempotency_key mismo payload', run: () => withDb(db => { const input = base({ idempotency_key: 'request-12' }); const a = createTarea(db, input); const b = createTarea(db, input); assert.equal(a.ok && b.ok && a.tarea.id, b.ok && b.tarea.id); assert.equal(db.prepare('SELECT COUNT(*) n FROM tareas').pluck().get(), 1); }) },
  { id: 'D2A-13', name: 'idempotency_key payload distinto', run: () => withDb(db => { created(db, { idempotency_key: 'request-13' }); expectError(createTarea(db, base({ idempotency_key: 'request-13', titulo: 'Distinta' })), 'TAREA_IDEMPOTENCY_CONFLICT'); }) },
  { id: 'D2A-14', name: 'dos tareas idénticas sin key sobreviven', run: () => withDb(db => { created(db); created(db); assert.equal(db.prepare('SELECT COUNT(*) n FROM tareas').pluck().get(), 2); }) },
  { id: 'D2A-15', name: 'editar incrementa version', run: () => withDb(db => { const t = created(db); const r = updateTarea(db, t.id, { expectedVersion: 1, titulo: 'Nuevo título' }); assert.equal(r.ok && r.tarea.version, 2); }) },
  { id: 'D2A-16', name: 'update con versión vieja falla', run: () => withDb(db => { const t = created(db); updateTarea(db, t.id, { expectedVersion: 1, titulo: 'v2' }); expectError(updateTarea(db, t.id, { expectedVersion: 1, titulo: 'v3' }), 'TAREA_VERSION_CONFLICT'); }) },
  { id: 'D2A-17', name: 'no-op no incrementa version', run: () => withDb(db => { const t = created(db); const r = updateTarea(db, t.id, { expectedVersion: 1, titulo: t.titulo }); assert.equal(r.ok && r.changed, false); assert.equal(getTareaById(db, t.id)?.version, 1); }) },
  { id: 'D2A-18', name: 'reprogramar genera evento', run: () => withDb(db => { const t = created(db); updateTarea(db, t.id, { expectedVersion: 1, fecha_programada: '2099-01-03 10:00:00' }); assert.deepEqual(eventTypes(db, t.id), ['TAREA_CREADA', 'TAREA_REPROGRAMADA']); }) },
  { id: 'D2A-19', name: 'iniciar genera evento', run: () => withDb(db => { const t = created(db); const r = changeTareaState(db, t.id, 1, 'EN_PROGRESO', 'gestor'); assert.equal(r.ok && r.tarea.estado, 'EN_PROGRESO'); assert.deepEqual(eventTypes(db, t.id).slice(-1), ['TAREA_ESTADO_CAMBIADO']); }) },
  { id: 'D2A-20', name: 'volver EN_PROGRESO a PENDIENTE', run: () => withDb(db => { const t = created(db); const started = changeTareaState(db, t.id, 1, 'EN_PROGRESO'); if (!started.ok) throw new Error(started.message); const back = changeTareaState(db, t.id, started.tarea.version, 'PENDIENTE'); assert.equal(back.ok && back.tarea.estado, 'PENDIENTE'); }) },
  { id: 'D2A-21', name: 'completar', run: () => withDb(db => { const t = created(db); const r = completeTarea(db, t.id, 1, 'gestor'); assert.equal(r.ok && r.tarea.estado, 'COMPLETADA'); assert.ok(r.ok && r.tarea.completado_en); assert.deepEqual(eventTypes(db, t.id).slice(-1), ['TAREA_COMPLETADA']); }) },
  { id: 'D2A-22', name: 'completar dos veces no-op con versión vigente', run: () => withDb(db => { const t = created(db); const first = completeTarea(db, t.id, 1); if (!first.ok) throw new Error(first.message); const second = completeTarea(db, t.id, first.tarea.version); assert.equal(second.ok && second.changed, false); assert.equal(eventTypes(db, t.id).filter(type => type === 'TAREA_COMPLETADA').length, 1); }) },
  { id: 'D2A-23', name: 'cancelar', run: () => withDb(db => { const t = created(db); const r = cancelTarea(db, t.id, 1, 'Duplicada', 'gestor'); assert.equal(r.ok && r.tarea.estado, 'CANCELADA'); const metadata = JSON.parse(listTareaEventos(db, t.id).items[0]!.metadata); assert.equal(metadata.motivo, 'Duplicada'); }) },
  { id: 'D2A-24', name: 'cancelada terminal', run: () => withDb(db => { const t = created(db); const r = cancelTarea(db, t.id, 1); if (!r.ok) throw new Error(r.message); expectError(changeTareaState(db, t.id, r.tarea.version, 'PENDIENTE'), 'TAREA_INVALID_TRANSITION'); }) },
  { id: 'D2A-25', name: 'completada terminal', run: () => withDb(db => { const t = created(db); const r = completeTarea(db, t.id, 1); if (!r.ok) throw new Error(r.message); expectError(cancelTarea(db, t.id, r.tarea.version), 'TAREA_INVALID_TRANSITION'); }) },
  { id: 'D2A-26', name: 'VENCIDA derivada', run: () => withDb(db => { const t = created(db, { fecha_programada: '2020-01-01 00:00:00' }); assert.equal(deriveTareaEstadoOperativo(t, '2020-01-02 00:00:00'), 'VENCIDA'); assert.equal(listTareas(db, { estado: 'VENCIDA', now: '2020-01-02 00:00:00' }).total, 1); }) },
  { id: 'D2A-27', name: 'HOY derivado', run: () => withDb(db => { const t = created(db, { fecha_programada: '2099-01-02 12:00:00' }); assert.equal(deriveTareaEstadoOperativo(t, '2099-01-02 08:00:00'), 'HOY'); assert.equal(listTareas(db, { estado: 'HOY', now: '2099-01-02 08:00:00' }).total, 1); }) },
  { id: 'D2A-28', name: 'reprogramar vencida a próxima', run: () => withDb(db => { const t = created(db, { fecha_programada: '2020-01-01 00:00:00' }); const r = updateTarea(db, t.id, { expectedVersion: 1, fecha_programada: '2099-01-02 00:00:00' }); assert.equal(r.ok && deriveTareaEstadoOperativo(r.tarea, '2020-01-02 00:00:00'), 'PROXIMA'); }) },
  { id: 'D2A-29', name: 'paginación 250 registros', run: () => withDb(db => { for (let i = 0; i < 250; i++) created(db, { titulo: `T-${i}` }); const result = listTareas(db, { page: 3, pageSize: 100 }); assert.equal(result.items.length, 50); assert.equal(result.total, 250); assert.equal(result.totalPages, 3); }) },
  { id: 'D2A-30', name: 'sin duplicados entre páginas', run: () => withDb(db => { for (let i = 0; i < 60; i++) created(db, { titulo: `T-${i}` }); const a = listTareas(db, { page: 1, pageSize: 25 }); const b = listTareas(db, { page: 2, pageSize: 25 }); assert.equal(new Set([...a.items, ...b.items].map(item => item.id)).size, 50); }) },
  { id: 'D2A-31', name: 'filtros combinados', run: () => withDb(db => { created(db, { cliente: 'A', responsable: 'ANA', prioridad: 'ALTA', tipo: 'VISITAR' }); created(db, { cliente: 'A', responsable: 'LUIS', prioridad: 'BAJA' }); assert.equal(listTareas(db, { cliente: 'A', responsable: 'ANA', prioridad: 'ALTA', tipo: 'VISITAR' }).total, 1); }) },
  { id: 'D2A-32', name: 'orden determinista', run: () => withDb(db => { const a = created(db); const b = created(db); const asc = listTareas(db, { sort: 'FECHA_ASC' }).items; const desc = listTareas(db, { sort: 'FECHA_DESC' }).items; assert.deepEqual(asc.map(x => x.id), [a.id, b.id]); assert.deepEqual(desc.map(x => x.id), [b.id, a.id]); }) },
  { id: 'D2A-33', name: 'search parametrizado', run: () => withDb(db => { created(db, { titulo: "Cliente O'Reilly 100%" }); created(db, { titulo: 'Otro' }); assert.equal(listTareas(db, { search: "O'Reilly 100%" }).total, 1); assert.equal(listTareas(db, { search: "' OR 1=1 --" }).total, 0); }) },
  { id: 'D2A-34', name: 'eventos paginados', run: () => withDb(db => { const t = created(db); let current = changeTareaState(db, t.id, 1, 'EN_PROGRESO'); if (!current.ok) throw new Error(current.message); current = changeTareaState(db, t.id, current.tarea.version, 'PENDIENTE'); if (!current.ok) throw new Error(current.message); const result = listTareaEventos(db, t.id, { page: 1, pageSize: 2 }); assert.equal(result.items.length, 2); assert.equal(result.total, 3); assert.ok(result.items[0]!.id > result.items[1]!.id); }) },
  { id: 'D2A-35', name: 'fallo evento revierte create y update', run: () => withDb(db => { db.exec("CREATE TRIGGER fail_create_event BEFORE INSERT ON tarea_eventos WHEN NEW.tipo_evento='TAREA_CREADA' BEGIN SELECT RAISE(ABORT,'event failed'); END"); assert.throws(() => createTarea(db, base()), /event failed/); assert.equal(db.prepare('SELECT COUNT(*) FROM tareas').pluck().get(), 0); db.exec('DROP TRIGGER fail_create_event'); const t = created(db); db.exec("CREATE TRIGGER fail_update_event BEFORE INSERT ON tarea_eventos WHEN NEW.tipo_evento='TAREA_EDITADA' BEGIN SELECT RAISE(ABORT,'event failed'); END"); assert.throws(() => updateTarea(db, t.id, { expectedVersion: 1, titulo: 'No persiste' }), /event failed/); assert.equal(getTareaById(db, t.id)?.titulo, t.titulo); assert.equal(getTareaById(db, t.id)?.version, 1); }) },
  { id: 'D2A-36', name: 'eliminar Gestión conserva Tarea', run: () => withDb(db => { const gestionId = Number(db.prepare("INSERT INTO gestiones(cliente) VALUES('C')").run().lastInsertRowid); const t = created(db, { gestion_origen_id: gestionId }); db.prepare('DELETE FROM gestiones WHERE id=?').run(gestionId); assert.equal(getTareaById(db, t.id)?.gestion_origen_id, null); }) },
  { id: 'D2A-37', name: 'completar Tarea no crea Gestión', run: () => withDb(db => { const t = created(db); const before = db.prepare('SELECT COUNT(*) FROM gestiones').pluck().get(); completeTarea(db, t.id, 1); assert.equal(db.prepare('SELECT COUNT(*) FROM gestiones').pluck().get(), before); }) },
  { id: 'D2A-38', name: 'completar Tarea no cambia Promesa', run: () => withDb(db => { const id = Number(db.prepare("INSERT INTO promesas(cliente,estado,monto_pagado) VALUES('C','PENDIENTE',15)").run().lastInsertRowid); const t = created(db, { promesa_id: id }); const before = db.prepare('SELECT * FROM promesas WHERE id=?').get(id); completeTarea(db, t.id, 1); assert.deepEqual(db.prepare('SELECT * FROM promesas WHERE id=?').get(id), before); }) },
  { id: 'D2A-39', name: 'cancelar Tarea no cambia Promesa', run: () => withDb(db => { const id = Number(db.prepare("INSERT INTO promesas(cliente,estado,monto_pagado) VALUES('C','PENDIENTE',15)").run().lastInsertRowid); const t = created(db, { promesa_id: id }); const before = db.prepare('SELECT * FROM promesas WHERE id=?').get(id); cancelTarea(db, t.id, 1, 'No procede'); assert.deepEqual(db.prepare('SELECT * FROM promesas WHERE id=?').get(id), before); }) },
  { id: 'D2A-40', name: 'no mutación financiera integral', run: () => withDb(db => { db.exec("INSERT INTO documentos(total) VALUES(100);INSERT INTO cobros_movimientos_importados(valor) VALUES(20);INSERT INTO abonos(total_nuevo) VALUES(80);INSERT INTO promesas(cliente,estado,monto_pagado) VALUES('C','PENDIENTE',0);INSERT INTO promesa_cobro_atribuciones VALUES(1,'M1',5)"); const before = financialSnapshot(db); const t = created(db); const edited = updateTarea(db, t.id, { expectedVersion: 1, descripcion: 'CRM' }); if (!edited.ok) throw new Error(edited.message); completeTarea(db, t.id, edited.tarea.version); const cancelled = created(db, { titulo: 'Cancelar' }); cancelTarea(db, cancelled.id, 1); assert.deepEqual(financialSnapshot(db), before); }) },
  { id: 'D2B-01', name: 'tareaCrear atraviesa contrato productivo', run: () => withDb(db => { const r = createTareaIpcHandlers(db).tareaCrear(base()); assert.equal(r.ok && r.tarea.cliente, 'CLIENTE-D2A'); }) },
  { id: 'D2B-02', name: 'tareaObtener devuelve entidad persistida', run: () => withDb(db => { const api = createTareaIpcHandlers(db); const r = api.tareaCrear(base()); if (!r.ok) throw new Error(r.message); assert.equal(api.tareaObtener(r.tarea.id)?.id, r.tarea.id); }) },
  { id: 'D2B-03', name: 'tareasListar pagina desde backend', run: () => withDb(db => { const api = createTareaIpcHandlers(db); for (let i = 0; i < 40; i++) api.tareaCrear(base({ titulo: `B-${i}` })); const r = api.tareasListar({ page: 2, pageSize: 15 }); assert.ok(!('ok' in r)); if (!('ok' in r)) { assert.equal(r.items.length, 15); assert.equal(r.total, 40); } }) },
  { id: 'D2B-04', name: 'pageSize mayor a 100 rechazado', run: () => withDb(db => { const r = createTareaIpcHandlers(db).tareasListar({ page: 1, pageSize: 101 }); assert.ok('ok' in r && r.ok === false && r.code === 'TAREA_INVALID'); }) },
  { id: 'D2B-05', name: 'tareaEditar exige expectedVersion', run: () => withDb(db => { const t = created(db); expectError(createTareaIpcHandlers(db).tareaEditar({ id: t.id, titulo: 'X' }), 'TAREA_INVALID'); }) },
  { id: 'D2B-06', name: 'version conflict preservado', run: () => withDb(db => { const api = createTareaIpcHandlers(db); const t = created(db); api.tareaEditar({ id: t.id, expectedVersion: 1, titulo: 'v2' }); expectError(api.tareaEditar({ id: t.id, expectedVersion: 1, titulo: 'v3' }), 'TAREA_VERSION_CONFLICT'); }) },
  { id: 'D2B-07', name: 'tareaCambiarEstado usa repositorio productivo', run: () => withDb(db => { const t = created(db); const r = createTareaIpcHandlers(db).tareaCambiarEstado({ id: t.id, expectedVersion: 1, estado: 'EN_PROGRESO' }); assert.equal(r.ok && r.tarea.estado, 'EN_PROGRESO'); }) },
  { id: 'D2B-08', name: 'tareaCompletar usa repositorio productivo', run: () => withDb(db => { const t = created(db); const r = createTareaIpcHandlers(db).tareaCompletar({ id: t.id, expectedVersion: 1 }); assert.equal(r.ok && r.tarea.estado, 'COMPLETADA'); }) },
  { id: 'D2B-09', name: 'tareaCancelar usa repositorio productivo', run: () => withDb(db => { const t = created(db); const r = createTareaIpcHandlers(db).tareaCancelar({ id: t.id, expectedVersion: 1, motivo: 'B' }); assert.equal(r.ok && r.tarea.estado, 'CANCELADA'); }) },
  { id: 'D2B-10', name: 'eventos paginados', run: () => withDb(db => { const api = createTareaIpcHandlers(db); const t = created(db); api.tareaCambiarEstado({ id: t.id, expectedVersion: 1, estado: 'EN_PROGRESO' }); const r = api.tareaEventosListar({ tareaId: t.id, page: 1, pageSize: 1 }); assert.ok(!('ok' in r)); if (!('ok' in r)) { assert.equal(r.items.length, 1); assert.equal(r.total, 2); } }) },
  { id: 'D2B-11', name: 'preload expone sólo APIs previstas', run: () => { const preload = fs.readFileSync(path.resolve('electron/preload.ts'), 'utf8'); for (const name of ['tareaCrear','tareaObtener','tareasListar','tareaEditar','tareaCambiarEstado','tareaCompletar','tareaCancelar','tareaEventosListar']) assert.match(preload, new RegExp(`\\b${name}:`)); assert.doesNotMatch(preload, /exposeInMainWorld\([^,]+,\s*ipcRenderer/); } },
  { id: 'D2B-12', name: 'renderer no puede editar campos protegidos', run: () => withDb(db => { const api = createTareaIpcHandlers(db); const t = created(db); expectError(api.tareaEditar({ id: t.id, expectedVersion: 1, cliente: 'ATAQUE', estado: 'COMPLETADA', completado_en: '2099-01-01' }), 'TAREA_INVALID'); assert.deepEqual(getTareaById(db, t.id), t); }) },
  { id: 'D2B-13', name: 'Gestión guardada no crea Tarea automáticamente', run: () => withDb(db => { createGestion(db, { cliente: 'C', tipo: 'Llamada' }); assert.equal(db.prepare('SELECT COUNT(*) FROM tareas').pluck().get(), 0); }) },
  { id: 'D2B-14', name: 'Gestión devuelve ID SQLite real', run: () => withDb(db => { const g = createGestion(db, { cliente: 'C', tipo: 'Llamada' }); assert.equal(typeof g.id, 'number'); assert.equal(db.prepare('SELECT id FROM gestiones').pluck().get(), g.id); }) },
  { id: 'D2B-15', name: 'Crear seguimiento usa gestion_origen_id real', run: () => withDb(db => { const g = createGestion(db, { cliente: 'C' }); const r = createTareaIpcHandlers(db).tareaCrear(base({ cliente: g.cliente, gestion_origen_id: g.id })); assert.equal(r.ok && r.tarea.gestion_origen_id, g.id); }) },
  { id: 'D2B-16', name: 'cancelar formulario conserva Gestión sin Tarea', run: () => withDb(db => { const g = createGestion(db, { cliente: 'C' }); assert.ok(g.id); assert.equal(db.prepare('SELECT COUNT(*) FROM gestiones').pluck().get(), 1); assert.equal(db.prepare('SELECT COUNT(*) FROM tareas').pluck().get(), 0); }) },
  { id: 'D2B-17', name: 'fallo creando Tarea conserva Gestión', run: () => withDb(db => { const g = createGestion(db, { cliente: 'C' }); const r = createTareaIpcHandlers(db).tareaCrear(base({ cliente: g.cliente, gestion_origen_id: g.id, fecha_programada: 'inválida' })); expectError(r, 'TAREA_INVALID'); assert.equal(db.prepare('SELECT COUNT(*) FROM gestiones').pluck().get(), 1); }) },
  { id: 'D2B-18', name: 'doble submit no duplica Tarea', run: () => withDb(db => { const api = createTareaIpcHandlers(db); const input = base({ idempotency_key: 'double-submit' }); api.tareaCrear(input); api.tareaCrear(input); assert.equal(db.prepare('SELECT COUNT(*) FROM tareas').pluck().get(), 1); }) },
  { id: 'D2B-19', name: 'reintento conserva idempotency_key', run: () => withDb(db => { const api = createTareaIpcHandlers(db); const input = base({ idempotency_key: 'retry-key' }); const a = api.tareaCrear(input); const b = api.tareaCrear(input); assert.equal(a.ok && b.ok && a.tarea.id, b.ok && b.tarea.id); }) },
  { id: 'D2B-20', name: 'nueva creación deliberada usa identidad distinta', run: () => withDb(db => { const api = createTareaIpcHandlers(db); const a = api.tareaCrear(base({ idempotency_key: 'new-a' })); const b = api.tareaCrear(base({ idempotency_key: 'new-b' })); assert.ok(a.ok && b.ok && a.tarea.id !== b.tarea.id); }) },
  { id: 'D2B-21', name: 'datetime-local se normaliza al formato canónico', run: () => { assert.equal(normalizeDatetimeLocalForTarea('2099-05-06T14:30'), '2099-05-06 14:30:00'); assert.equal(normalizeDatetimeLocalForTarea('2099-05-06T14:30:45'), '2099-05-06 14:30:45'); } },
  { id: 'D2B-22', name: 'no se agrega Z o UTC silencioso', run: () => { const value = normalizeDatetimeLocalForTarea('2099-05-06T14:30'); assert.ok(value && !value.includes('T') && !value.includes('Z')); assert.equal(normalizeDatetimeLocalForTarea('2099-05-06T14:30Z'), null); } },
  { id: 'D2B-23', name: 'eliminar Gestión conserva Tarea con FK NULL', run: () => withDb(db => { const g = createGestion(db, { cliente: 'C' }); const t = created(db, { gestion_origen_id: g.id }); const deleted = deleteGestion(db, g.id); assert.equal(deleted.ok, true); assert.equal(getTareaById(db, t.id)?.gestion_origen_id, null); }) },
  { id: 'D2B-24', name: 'completar Tarea no crea Gestión', run: () => withDb(db => { const api = createTareaIpcHandlers(db); const t = created(db); const before = db.prepare('SELECT COUNT(*) FROM gestiones').pluck().get(); api.tareaCompletar({ id: t.id, expectedVersion: 1 }); assert.equal(db.prepare('SELECT COUNT(*) FROM gestiones').pluck().get(), before); }) },
  { id: 'D2B-25', name: 'completar y cancelar no modifican Promesa', run: () => withDb(db => { const id = Number(db.prepare("INSERT INTO promesas(cliente,estado,monto_pagado) VALUES('C','PENDIENTE',10)").run().lastInsertRowid); const before = db.prepare('SELECT * FROM promesas WHERE id=?').get(id); const api = createTareaIpcHandlers(db); const a = created(db, { promesa_id: id }); const b = created(db, { promesa_id: id, titulo: 'B' }); api.tareaCompletar({ id: a.id, expectedVersion: 1 }); api.tareaCancelar({ id: b.id, expectedVersion: 1 }); assert.deepEqual(db.prepare('SELECT * FROM promesas WHERE id=?').get(id), before); }) },
  { id: 'D2B-26', name: 'aislamiento financiero integral', run: () => withDb(db => { db.exec("INSERT INTO documentos(total) VALUES(100);INSERT INTO cobros_movimientos_importados(valor) VALUES(20);INSERT INTO abonos(total_nuevo) VALUES(80);INSERT INTO promesas(cliente,estado,monto_pagado) VALUES('C','PENDIENTE',0);INSERT INTO promesa_cobro_atribuciones VALUES(1,'M',5)"); const before = financialSnapshot(db); const api = createTareaIpcHandlers(db); const r = api.tareaCrear(base()); if (!r.ok) throw new Error(r.message); api.tareaEditar({ id: r.tarea.id, expectedVersion: 1, titulo: 'Editada' }); api.tareaCompletar({ id: r.tarea.id, expectedVersion: 2 }); assert.deepEqual(financialSnapshot(db), before); }) },
  { id: 'D2B-27', name: 'contratos soportan promesa_id sin automatización', run: () => withDb(db => { const id = Number(db.prepare("INSERT INTO promesas(cliente,estado) VALUES('C','PENDIENTE')").run().lastInsertRowid); const before = db.prepare('SELECT COUNT(*) FROM tareas').pluck().get(); assert.equal(before, 0); const r = createTareaIpcHandlers(db).tareaCrear(base({ promesa_id: id })); assert.equal(r.ok && r.tarea.promesa_id, id); }) },
  { id: 'D2B-28', name: 'no existe INSERT automático desde gestionGuardar', run: () => withDb(db => { for (let i = 0; i < 3; i++) createGestion(db, { cliente: `C${i}`, resultado: 'Contactado' }); assert.equal(db.prepare('SELECT COUNT(*) FROM gestiones').pluck().get(), 3); assert.equal(db.prepare('SELECT COUNT(*) FROM tareas').pluck().get(), 0); }) },
  { id: 'D2B-29', name: 'listado no carga dataset completo', run: () => withDb(db => { const api = createTareaIpcHandlers(db); for (let i = 0; i < 250; i++) api.tareaCrear(base({ titulo: `P-${i}` })); const r = api.tareasListar({ page: 2, pageSize: 25 }); assert.ok(!('ok' in r)); if (!('ok' in r)) { assert.equal(r.items.length, 25); assert.equal(r.total, 250); } }) },
  { id: 'D2B-30', name: 'errores de dominio conservan código', run: () => withDb(db => { const api = createTareaIpcHandlers(db); const t = created(db); api.tareaEditar({ id: t.id, expectedVersion: 1, titulo: 'v2' }); const conflict = api.tareaCompletar({ id: t.id, expectedVersion: 1 }); expectError(conflict, 'TAREA_VERSION_CONFLICT'); const missing = api.tareaCompletar({ id: 999, expectedVersion: 1 }); expectError(missing, 'TAREA_NOT_FOUND'); }) },
];

const results: Array<{ id: string; scenario: string; status: 'PASS' | 'FAIL'; detail: string }> = [];
for (const scenario of scenarios) {
  try {
    scenario.run();
    results.push({ id: scenario.id, scenario: scenario.name, status: 'PASS', detail: 'Conforme.' });
  } catch (error) {
    results.push({ id: scenario.id, scenario: scenario.name, status: 'FAIL', detail: error instanceof Error ? error.message : String(error) });
  }
}
const totals = { PASS: results.filter(item => item.status === 'PASS').length, FAIL: results.filter(item => item.status === 'FAIL').length };
console.log('\nZENITH CARTERA - D2.A NÚCLEO CANÓNICO DE TAREAS\n');
console.table(results);
console.log(`TASK_DOMAIN_RESULT_JSON=${JSON.stringify({ totals, results })}`);
if (totals.FAIL > 0 || totals.PASS !== 70) process.exitCode = 1;
