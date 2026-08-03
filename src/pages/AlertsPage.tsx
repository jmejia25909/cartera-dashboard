import type { Alerta } from '../types';
import { fmtMoney, normalizeSeveridad } from '../utils';

export interface AlertsPageProps {
  alertas: Alerta[];
  searchAlertas: string;
  setSearchAlertas: (value: string) => void;
  filtroSeveridad: string;
  setFiltroSeveridad: (value: string) => void;
  onExportPdf: () => void | Promise<void>;
}

export function AlertsPage({
  alertas,
  searchAlertas,
  setSearchAlertas,
  filtroSeveridad,
  setFiltroSeveridad,
  onExportPdf,
}: AlertsPageProps) {
  const totalVencidos = alertas.length;
  const montoVencido = alertas.reduce(
    (sum, alerta) => sum + (alerta.monto || 0),
    0
  );
  const promedioDias =
    totalVencidos > 0
      ? Math.round(
          alertas.reduce(
            (sum, alerta) => sum + (alerta.diasVencidos || 0),
            0
          ) / totalVencidos
        )
      : 0;

  const kpis = [
    {
      label: 'Documentos Vencidos',
      value: String(totalVencidos),
      color: '#ef4444',
      background: '#fee2e2',
    },
    {
      label: 'Monto Vencido',
      value: fmtMoney(montoVencido),
      color: '#ea580c',
      background: '#ffedd5',
    },
    {
      label: 'Promedio Días',
      value: String(promedioDias),
      color: '#6b7280',
      background: '#f3f4f6',
    },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div className="card">
        <div className="card-title">🚨 Alertas de Incumplimiento</div>

        {alertas.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              marginBottom: '15px',
            }}
          >
            {kpis.map((kpi) => (
              <div
                key={kpi.label}
                style={{
                  background: kpi.background,
                  padding: '12px 14px',
                  borderRadius: '8px',
                  borderLeft: `4px solid ${kpi.color}`,
                }}
              >
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#64748b',
                    fontWeight: 500,
                    marginBottom: '4px',
                  }}
                >
                  {kpi.label.toUpperCase()}
                </div>
                <div
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: kpi.color,
                  }}
                >
                  {kpi.value}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="row">
          <label className="field">
            <span>Búsqueda</span>
            <input
              type="text"
              value={searchAlertas}
              onChange={(event) => setSearchAlertas(event.target.value)}
              placeholder="Buscar cliente o documento..."
            />
          </label>

          <label className="field">
            <span>Severidad</span>
            <select
              value={filtroSeveridad}
              onChange={(event) => setFiltroSeveridad(event.target.value)}
            >
              <option value="Todos">Todas</option>
              <option value="Crítico">Crítico</option>
              <option value="Alta">Alta</option>
              <option value="Media">Media</option>
              <option value="Baja">Baja</option>
            </select>
          </label>

          <button
            className="btn secondary"
            onClick={() => void onExportPdf()}
            disabled={alertas.length === 0}
            style={{ alignSelf: 'flex-end' }}
          >
            📄 Exportar PDF
          </button>
        </div>

        <div className="table-wrapper">
          <table className="data-table no-sticky-header">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Documento</th>
                <th className="num">Monto</th>
                <th className="num">Días Vencido</th>
                <th>Severidad</th>
              </tr>
            </thead>
            <tbody>
              {alertas.length > 0 ? (
                alertas.map((alerta, index) => {
                  const severidad = normalizeSeveridad(alerta.severidad);

                  return (
                    <tr key={`${alerta.documento}-${index}`}>
                      <td>{alerta.cliente}</td>
                      <td>{alerta.documento}</td>
                      <td className="num">{fmtMoney(alerta.monto)}</td>
                      <td className="num">{alerta.diasVencidos}</td>
                      <td>
                        <span className={`status-label status-${severidad.level}`}>
                          {severidad.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      textAlign: 'center',
                      padding: '20px',
                      color: '#9ca3af',
                    }}
                  >
                    No hay alertas activas
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
