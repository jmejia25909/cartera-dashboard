import { fmtMoney } from '../utils';

export interface PromiseItem {
  id: number;
  cliente?: string;
  razon_social?: string;
  fecha_promesa?: string;
  monto_promesa?: number;
  monto_pagado?: number;
  estado_promesa?: string;
  observacion?: string;
  [key: string]: unknown;
}

export interface PromisesPageProps {
  promesasFiltradas: PromiseItem[];
  totalPromesas: number;
  montoTotal: number;
  vencidas: number;
  tasaCumplimiento: number;
  filtroFecha: string;
  setFiltroFecha: (value: string) => void;
  filtroMonto: string;
  setFiltroMonto: (value: string) => void;
  calcularDiasDiferencia: (fecha: string) => number;
  hasWritePermissions: boolean;
  isMobile: boolean;
  onExportPdf: () => void | Promise<void>;
  onCumplirPromesa: (id: number) => void | Promise<void>;
  onEditarPromesa: (promesa: PromiseItem) => void;
  onEliminarPromesa: (id: number) => void | Promise<void>;
}

const resolvePromiseStatus = (
  promesa: PromiseItem,
  diasDiferencia: number,
  saldoPendiente: number
): { label: string; color: string } => {
  const rawStatus = String(promesa.estado_promesa ?? '');
  const normalizedStatus = rawStatus
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalizedStatus) {
    if (diasDiferencia < 0) return { label: 'Vencida', color: '#ef4444' };
    if (diasDiferencia === 0) return { label: 'Hoy', color: '#f59e0b' };
    if (diasDiferencia <= 3) return { label: 'Proxima', color: '#f59e0b' };
    return { label: 'Vigente', color: '#10b981' };
  }

  if (normalizedStatus === 'Cumplida' || saldoPendiente <= 0) {
    return { label: normalizedStatus, color: '#10b981' };
  }

  if (normalizedStatus === 'Parcialmente Cumplida') {
    return { label: normalizedStatus, color: '#f59e0b' };
  }

  if (normalizedStatus === 'Incumplida' || normalizedStatus === 'Vencida') {
    return { label: normalizedStatus, color: '#ef4444' };
  }

  if (normalizedStatus === 'Reprogramada') {
    return { label: normalizedStatus, color: '#3b82f6' };
  }

  if (normalizedStatus === 'Hoy' || normalizedStatus === 'Proxima') {
    return { label: normalizedStatus, color: '#f59e0b' };
  }

  if (normalizedStatus === 'Vigente') {
    return { label: normalizedStatus, color: '#10b981' };
  }

  return { label: normalizedStatus, color: '#9ca3af' };
};

export function PromisesPage({
  promesasFiltradas,
  totalPromesas,
  montoTotal,
  vencidas,
  tasaCumplimiento,
  filtroFecha,
  setFiltroFecha,
  filtroMonto,
  setFiltroMonto,
  calcularDiasDiferencia,
  hasWritePermissions,
  isMobile,
  onExportPdf,
  onCumplirPromesa,
  onEditarPromesa,
  onEliminarPromesa,
}: PromisesPageProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: '16px',
          alignItems: 'stretch',
        }}
      >
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title">💼 Resumen</div>
          <div
            className="kpis-grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
          >
            <div className="kpi-card">
              <div className="kpi-title">Total Promesas</div>
              <div className="kpi-value">{totalPromesas}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">Monto Total</div>
              <div className="kpi-value">{fmtMoney(montoTotal)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">Vencidas</div>
              <div className="kpi-value kpi-negative">{vencidas}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">Vigentes</div>
              <div className="kpi-value kpi-positive">{totalPromesas - vencidas}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">Tasa Cumplimiento</div>
              <div className="kpi-value kpi-positive">{tasaCumplimiento}%</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title">🔍 Filtros</div>
          <div className="row" style={{ marginTop: '10px' }}>
            <label className="field">
              <span>Filtrar por Fecha</span>
              <select value={filtroFecha} onChange={(event) => setFiltroFecha(event.target.value)}>
                <option value="Todas">Todas</option>
                <option value="Hoy">Hoy</option>
                <option value="Esta Semana">Esta Semana</option>
                <option value="Vencidas">Vencidas</option>
              </select>
            </label>
            <label className="field">
              <span>Filtrar por Monto</span>
              <select value={filtroMonto} onChange={(event) => setFiltroMonto(event.target.value)}>
                <option value="Todos">Todos</option>
                <option value="Menor 1000">&lt; 1,000</option>
                <option value="1000-5000">1,000 - 5,000</option>
                <option value="Mayor 5000">&gt; 5,000</option>
              </select>
            </label>
          </div>
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <button
              className="btn primary"
              onClick={() => void onExportPdf()}
              style={{ padding: '6px 12px' }}
            >
              📊 Generar Reporte PDF
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">📅 Gestión de Promesas de Pago</div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Fecha Promesa</th>
                <th className="num">Prometido</th>
                <th className="num">Pagado</th>
                <th className="num">Falta</th>
                <th>Estado</th>
                <th>Observación</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {promesasFiltradas.length > 0 ? (
                promesasFiltradas.map((promesa) => {
                  const montoPagado = promesa.monto_pagado ?? 0;
                  const montoPrometido = promesa.monto_promesa ?? 0;
                  const saldoPendiente = montoPrometido - montoPagado;
                  const diasDiferencia = promesa.fecha_promesa
                    ? calcularDiasDiferencia(promesa.fecha_promesa)
                    : 0;
                  const estado = resolvePromiseStatus(
                    promesa,
                    diasDiferencia,
                    saldoPendiente
                  );

                  return (
                    <tr key={promesa.id} style={{ borderLeft: `4px solid ${estado.color}` }}>
                      <td>
                        <strong>{promesa.razon_social || promesa.cliente}</strong>
                      </td>
                      <td>{promesa.fecha_promesa}</td>
                      <td className="num" style={{ fontWeight: 'bold', color: '#3b82f6' }}>
                        {fmtMoney(montoPrometido)}
                      </td>
                      <td className="num" style={{ fontWeight: 'bold', color: '#10b981' }}>
                        {fmtMoney(montoPagado)}
                      </td>
                      <td
                        className="num"
                        style={{
                          fontWeight: 'bold',
                          color: saldoPendiente > 0 ? '#ef4444' : '#10b981',
                        }}
                      >
                        {fmtMoney(saldoPendiente)}
                      </td>
                      <td>
                        <span
                          className="status-label"
                          style={{
                            color: estado.color,
                            background: 'var(--bg-nav)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: estado.color,
                              display: 'inline-block',
                            }}
                          />
                          {estado.label}
                        </span>
                      </td>
                      <td
                        style={{
                          maxWidth: '300px',
                          fontSize: '0.85rem',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {promesa.observacion || '-'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div
                          className="action-buttons"
                          style={{ justifyContent: 'center', gap: '4px' }}
                        >
                          <button
                            className="btn primary"
                            style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                            onClick={() => void onCumplirPromesa(promesa.id)}
                            disabled={!hasWritePermissions}
                            title="Marcar como cumplida"
                          >
                            ✓
                          </button>
                          <button
                            className="btn secondary"
                            style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                            onClick={() => onEditarPromesa(promesa)}
                            title="Editar promesa"
                          >
                            ✏️
                          </button>
                          <button
                            className="promesa-eliminar"
                            onClick={() => void onEliminarPromesa(promesa.id)}
                            disabled={!hasWritePermissions}
                            title="Eliminar"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      textAlign: 'center',
                      padding: '24px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    No hay promesas de pago{' '}
                    {filtroFecha !== 'Todas' ? `para: ${filtroFecha}` : 'pendientes'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
