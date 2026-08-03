import { fmtMoney } from '../utils';

export interface TendenciaItem {
  mes: string;
  documentos: number;
  emision: number;
  cobrado: number;
  vencidos?: number;
}

export interface TendenciasPageProps {
  tendencias: TendenciaItem[];
  mostrarGrafica: boolean;
  onToggleGrafica: () => void;
  onExportPdf: () => Promise<void>;
}

export function TendenciasPage({
  tendencias,
  mostrarGrafica,
  onToggleGrafica,
  onExportPdf,
}: TendenciasPageProps) {
  const maxEmision = Math.max(
    1,
    ...tendencias.map((tendencia) => tendencia.emision || 0)
  );
  const maxCobrado = Math.max(
    1,
    ...tendencias.map((tendencia) => tendencia.cobrado || 0)
  );

  const totalEmision = tendencias.reduce(
    (sum, tendencia) => sum + (tendencia.emision || 0),
    0
  );
  const totalCobrado = tendencias.reduce(
    (sum, tendencia) => sum + (tendencia.cobrado || 0),
    0
  );
  const totalDocumentos = tendencias.reduce(
    (sum, tendencia) => sum + (tendencia.documentos || 0),
    0
  );
  const totalVencidos = tendencias.reduce(
    (sum, tendencia) => sum + (tendencia.vencidos || 0),
    0
  );
  const tasaCobro =
    totalDocumentos > 0
      ? Math.round(
          ((totalDocumentos - totalVencidos) / totalDocumentos) * 100
        )
      : 0;

  const kpis = [
    {
      label: 'Total Emitido',
      value: fmtMoney(totalEmision),
      color: '#3b82f6',
      background: '#dbeafe',
    },
    {
      label: 'Total Cobrado',
      value: fmtMoney(totalCobrado),
      color: '#10b981',
      background: '#d1fae5',
    },
    {
      label: 'Tasa Cobro',
      value: `${tasaCobro}%`,
      color: '#6b7280',
      background: '#f3f4f6',
    },
    {
      label: 'Documentos Vencidos',
      value: String(totalVencidos),
      color: '#ef4444',
      background: '#fee2e2',
    },
  ];

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div
        className="card"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <div className="card-title">📈 Tendencias Históricas (12 meses)</div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            marginBottom: '10px',
          }}
        >
          <button
            type="button"
            className="btn secondary"
            onClick={() => void onExportPdf()}
            disabled={tendencias.length === 0}
          >
            📄 Exportar PDF
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={onToggleGrafica}
            disabled={tendencias.length === 0}
          >
            {mostrarGrafica ? '📋 Tabla' : '📊 Gráfica'}
          </button>
        </div>

        {tendencias.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
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

        {mostrarGrafica && tendencias.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gap: '10px',
              paddingBottom: '10px',
            }}
          >
            {tendencias.map((tendencia) => {
              const widthEmision = Math.max(
                6,
                Math.round(((tendencia.emision || 0) / maxEmision) * 100)
              );
              const widthCobrado = Math.max(
                6,
                Math.round(((tendencia.cobrado || 0) / maxCobrado) * 100)
              );

              return (
                <div
                  key={tendencia.mes}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 1fr 110px',
                    gap: '10px',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#334155' }}>
                    {tendencia.mes}
                  </div>
                  <div style={{ display: 'grid', gap: '6px' }}>
                    <div
                      style={{
                        background: '#e2e8f0',
                        height: 8,
                        borderRadius: 6,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${widthEmision}%`,
                          height: '100%',
                          background: '#3b82f6',
                        }}
                      />
                    </div>
                    <div
                      style={{
                        background: '#e2e8f0',
                        height: 8,
                        borderRadius: 6,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${widthCobrado}%`,
                          height: '100%',
                          background: '#10b981',
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                    <div>{fmtMoney(tendencia.emision || 0)}</div>
                    <div style={{ color: '#16a34a' }}>
                      {fmtMoney(tendencia.cobrado || 0)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div
              style={{
                fontSize: '0.75rem',
                color: '#64748b',
                display: 'flex',
                gap: '12px',
              }}
            >
              <span>⬜ Emisión</span>
              <span style={{ color: '#10b981' }}>⬜ Cobrado</span>
            </div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th className="num">Documentos</th>
                  <th className="num">Emisión</th>
                  <th className="num">Cobrado</th>
                  <th className="num">Tasa Cobro</th>
                  <th className="num">Vencidos</th>
                </tr>
              </thead>
              <tbody>
                {tendencias.length > 0 ? (
                  tendencias.map((tendencia) => {
                    const tasaMensual =
                      tendencia.documentos > 0
                        ? Math.round(
                            ((tendencia.documentos -
                              (tendencia.vencidos || 0)) /
                              tendencia.documentos) *
                              100
                          )
                        : 0;

                    return (
                      <tr key={tendencia.mes}>
                        <td>
                          <strong>{tendencia.mes}</strong>
                        </td>
                        <td className="num">{tendencia.documentos}</td>
                        <td className="num">
                          {fmtMoney(tendencia.emision)}
                        </td>
                        <td className="num">
                          {fmtMoney(tendencia.cobrado)}
                        </td>
                        <td
                          className="num"
                          style={{
                            color:
                              tasaMensual >= 50
                                ? '#10b981'
                                : tasaMensual >= 25
                                  ? '#f59e0b'
                                  : '#ef4444',
                          }}
                        >
                          <strong>{tasaMensual}%</strong>
                        </td>
                        <td className="num">{tendencia.vencidos || 0}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6}>Sin datos</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
