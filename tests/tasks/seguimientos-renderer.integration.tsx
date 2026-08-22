import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HistoryContent, SeguimientosPage } from '../../src/pages/SeguimientosPage';
import {
  buildTaskQuery,
  canonicalNow,
  canonicalToDatetimeLocal,
  createHistoryRequestGuard,
  createSeguimientosClient,
  datetimeLocalToCanonical,
  friendlyTaskDate,
  normalizedPage,
  tareaOrigin,
  taskErrorMessage,
  type SeguimientosApi,
} from '../../src/pages/seguimientosModel';
import type { PaginatedResult, Tarea, TareaEvento, TareaMutationResult } from '../../src/types/tarea';

const task: Tarea = { id: 7, cliente: 'ACME', responsable: 'ana', gestion_origen_id: null, promesa_id: null, tipo: 'LLAMAR', titulo: 'Cobrar', descripcion: null, fecha_programada: '2099-05-06 14:30:00', prioridad: 'ALTA', estado: 'PENDIENTE', estado_operativo: 'HOY', creado_en: '2099-01-01 00:00:00', actualizado_en: '2099-01-01 00:00:00', completado_en: null, cancelado_en: null, version: 3, idempotency_key: 'key', creation_payload_hash: 'hash' };
const page = <T,>(items: T[] = [], total = items.length): PaginatedResult<T> => ({ items, page: 1, pageSize: 25, total, totalPages: total ? 1 : 0 });
const ok = (tarea = task): TareaMutationResult => ({ ok: true, tarea, changed: true });
const calls: Array<{ method: string; payload: unknown }> = [];
const api: SeguimientosApi = {
  tareasListar: async query => { calls.push({ method: 'list', payload: query }); return page([task]); },
  tareaCrear: async payload => { calls.push({ method: 'create', payload }); return ok(); },
  tareaEditar: async payload => { calls.push({ method: 'edit', payload }); return ok(); },
  tareaCambiarEstado: async payload => { calls.push({ method: 'state', payload }); return ok(); },
  tareaCompletar: async payload => { calls.push({ method: 'complete', payload }); return ok(); },
  tareaCancelar: async payload => { calls.push({ method: 'cancel', payload }); return ok(); },
  tareaEventosListar: async query => { calls.push({ method: 'events', payload: query }); return page<TareaEvento>(); },
};
const client = createSeguimientosClient(api);
const source = fs.readFileSync(path.resolve('src/pages/SeguimientosPage.tsx'), 'utf8');
const scenario = (id: string, name: string, run: () => void | Promise<void>) => ({ id, name, run });
const scenarios = [
  scenario('D3A-01', 'carga página real', () => assert.match(renderToStaticMarkup(<SeguimientosPage api={api} />), /Seguimientos/)),
  scenario('D3A-02', 'vista HOY server-side', () => assert.equal(buildTaskQuery('HOY', {}, 1, 25, '2099-01-01 00:00:00').estado, 'HOY')),
  scenario('D3A-03', 'vista VENCIDAS server-side', () => assert.equal(buildTaskQuery('VENCIDA', {}, 1, 25).estado, 'VENCIDA')),
  scenario('D3A-04', 'vista PRÓXIMAS server-side', () => assert.equal(buildTaskQuery('PROXIMA', {}, 1, 25).estado, 'PROXIMA')),
  scenario('D3A-05', 'vista COMPLETADAS server-side', () => assert.equal(buildTaskQuery('COMPLETADA', {}, 1, 25).estado, 'COMPLETADA')),
  scenario('D3A-06', 'filtros via query servidor', () => { const q = buildTaskQuery('TODAS', { cliente: 'A', responsable: 'B', search: 'C' }, 1, 25); assert.deepEqual([q.cliente, q.responsable, q.search], ['A', 'B', 'C']); }),
  scenario('D3A-07', 'paginación via servidor', async () => { calls.length = 0; await client.list(buildTaskQuery('HOY', {}, 3, 50)); assert.deepEqual(calls[0]?.payload && [(calls[0].payload as any).page, (calls[0].payload as any).pageSize], [3, 50]); }),
  scenario('D3A-08', 'crear tarea por API', async () => { calls.length = 0; await client.create({ cliente: 'A', tipo: 'LLAMAR', titulo: 'T', fecha_programada: '2099-01-01 10:00:00' }); assert.equal(calls[0]?.method, 'create'); }),
  scenario('D3A-09', 'intento usa idempotency key', () => assert.match(source, /idempotency_key: attemptKey\.current/)),
  scenario('D3A-10', 'editar usa versión', async () => { calls.length = 0; await client.edit(task, { titulo: 'Nuevo' }); assert.deepEqual(calls[0]?.payload && [(calls[0].payload as any).id, (calls[0].payload as any).expectedVersion], [7, 3]); }),
  scenario('D3A-11', 'mensaje version conflict', () => assert.match(taskErrorMessage({ ok: false, code: 'TAREA_VERSION_CONFLICT', message: 'x' }), /otra ventana/)),
  scenario('D3A-12', 'iniciar', async () => { calls.length = 0; await client.changeState(task, 'EN_PROGRESO'); assert.equal((calls[0]?.payload as any).estado, 'EN_PROGRESO'); }),
  scenario('D3A-13', 'volver a pendiente', async () => { calls.length = 0; await client.changeState({ ...task, estado: 'EN_PROGRESO' }, 'PENDIENTE'); assert.equal((calls[0]?.payload as any).estado, 'PENDIENTE'); }),
  scenario('D3A-14', 'completar', async () => { calls.length = 0; await client.complete(task); assert.equal(calls[0]?.method, 'complete'); }),
  scenario('D3A-15', 'completar no registra Gestión', async () => { calls.length = 0; await client.complete(task); assert.equal(calls.some(call => call.method === 'gestion'), false); }),
  scenario('D3A-16', 'cancelar con motivo', async () => { calls.length = 0; await client.cancel(task, 'Duplicada'); assert.equal((calls[0]?.payload as any).motivo, 'Duplicada'); }),
  scenario('D3A-17', 'terminal sin mutaciones inválidas', () => { assert.match(source, /!terminal &&/); assert.doesNotMatch(source, /client\.changeState\([^)]*COMPLETADA/); }),
  scenario('D3A-18', 'historial paginado', async () => { calls.length = 0; await client.events({ tareaId: 7, page: 2, pageSize: 10 }); assert.deepEqual(calls[0]?.payload, { tareaId: 7, page: 2, pageSize: 10 }); }),
  scenario('D3A-19', 'origen Gestión', () => assert.equal(tareaOrigin({ gestion_origen_id: 4, promesa_id: null }), 'Gestión #4')),
  scenario('D3A-20', 'origen Promesa', () => assert.equal(tareaOrigin({ gestion_origen_id: null, promesa_id: 9 }), 'Promesa #9')),
  scenario('D3A-21', 'referencia eliminada segura', () => assert.equal(tareaOrigin({ gestion_origen_id: null, promesa_id: null }), 'Sin vínculo')),
  scenario('D3A-22', 'fecha renderer canónica local', () => { assert.equal(datetimeLocalToCanonical('2099-05-06T14:30'), '2099-05-06 14:30:00'); assert.equal(canonicalToDatetimeLocal('2099-05-06 14:30:00'), '2099-05-06T14:30'); assert.equal(friendlyTaskDate('2099-05-06 14:30:00'), '06/05/2099 14:30'); assert.doesNotMatch(canonicalNow(new Date(2099, 4, 6, 14, 30)), /T|Z/); }),
  scenario('D3A-23', 'error estructurado', () => assert.equal(taskErrorMessage({ ok: false, code: 'TAREA_NOT_FOUND', message: 'x' }), 'La tarea ya no existe. Actualice el listado.')),
  scenario('D3A-24', 'empty state', () => assert.match(source, /No hay tareas en esta vista/)),
  scenario('D3A-25', 'filtros vuelven a página uno', () => assert.match(source, /changeFilter[\s\S]*setPage\(1\)/)),
  scenario('D3AF-01', 'respuesta tardía de A no reemplaza B', () => { const guard = createHistoryRequestGuard(); const requestA = guard.begin(1, 1); const requestB = guard.begin(2, 1); assert.equal(guard.isCurrent(requestB, 2, 1, true), true); assert.equal(guard.isCurrent(requestA, 2, 1, true), false); }),
  scenario('D3AF-02', 'respuesta tardía de página 1 no reemplaza página 2', () => { const guard = createHistoryRequestGuard(); const first = guard.begin(7, 1); const second = guard.begin(7, 2); assert.equal(guard.isCurrent(second, 7, 2, true), true); assert.equal(guard.isCurrent(first, 7, 2, true), false); }),
  scenario('D3AF-03', 'cerrar invalida request pendiente', () => { const guard = createHistoryRequestGuard(); const pending = guard.begin(7, 1); guard.invalidate(); assert.equal(guard.isCurrent(pending, null, 1, false), false); }),
  scenario('D3AF-04', 'historial pendiente muestra loading', () => { const html = renderToStaticMarkup(<HistoryContent loading error={null} events={[]} />); assert.match(html, /Cargando historial/); assert.doesNotMatch(html, /Sin eventos/); }),
  scenario('D3AF-05', 'historial vacío después de cargar', () => { const html = renderToStaticMarkup(<HistoryContent loading={false} error={null} events={[]} />); assert.match(html, /Sin eventos/); }),
  scenario('D3AF-06', 'error específico de historial', () => { const html = renderToStaticMarkup(<HistoryContent loading={false} error="Historial no disponible" events={[]} />); assert.match(html, /Historial no disponible/); assert.doesNotMatch(html, /Sin eventos/); }),
  scenario('D3AF-07', 'página superior al total se corrige', () => assert.equal(normalizedPage(4, 3), 3)),
  scenario('D3AF-08', 'cero páginas vuelve a uno', () => assert.equal(normalizedPage(4, 0), 1)),
  scenario('D3AF-09', 'runner agregado incluye dominio y renderer', () => { const scripts = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8')).scripts; assert.match(scripts['test:tasks'], /test:tasks:domain/); assert.match(scripts['test:tasks'], /test:seguimientos/); }),
];

async function main(): Promise<void> {
  const results: Array<{ id: string; scenario: string; status: 'PASS' | 'FAIL'; detail: string }> = [];
  for (const item of scenarios) {
    try { await item.run(); results.push({ id: item.id, scenario: item.name, status: 'PASS', detail: 'Conforme.' }); }
    catch (error) { results.push({ id: item.id, scenario: item.name, status: 'FAIL', detail: error instanceof Error ? error.message : String(error) }); }
  }
  const totals = { PASS: results.filter(result => result.status === 'PASS').length, FAIL: results.filter(result => result.status === 'FAIL').length };
  console.log('\nZENITH CARTERA - D3.A SEGUIMIENTOS RENDERER\n');
  console.table(results);
  console.log(`D3A_RESULT_JSON=${JSON.stringify({ totals, results })}`);
  if (totals.PASS !== 34 || totals.FAIL) process.exitCode = 1;
}

void main();
