import { useMemo } from 'react';
import { fmtMoney } from '../utils';

export interface AbonoItem {
  id: number | string;
  fecha: string;
  cliente?: string;
  razon_social?: string;
  documento: string;
  total_anterior: number;
  total_nuevo: number;
  observacion?: string;
  estado?: string;
  reversado?: number;
  motivo_reversion?: string;
}

export interface AbonosPageProps {
  abonos: AbonoItem[];
  fechaDesde: string;
  fechaHasta: string;
  onFechaDesdeChange: (value: string) => void;
  onFechaHastaChange: (value: string) => void;
  onExportPdf: () => Promise<void>;
}

export function AbonosPage({
  abonos,
  fechaDesde,
  fechaHasta,
  onFechaDesdeChange,
  onFechaHastaChange,
  onExportPdf,
}: AbonosPageProps) {
  const abonosFiltrados = useMemo(
    () =>
      abonos.filter((abono) => {
        const valorAplicado =
          Number(abono.total_anterior || 0) -
          Number(abono.total_nuevo || 0);

        if (abono.reversado === 1 || abono.estado === "REVERSADO") {
          return false;
        }

        if (valorAplicado <= 0) {
          return false;
        }

        if (fechaDesde && (!abono.fecha || abono.fecha < fechaDesde)) {
          return false;
        }

        if (fechaHasta) {
          const hasta =
            fechaHasta.length === 10
              ? `${fechaHasta}T23:59:59`
              : fechaHasta;

          if (!abono.fecha || abono.fecha > hasta) {
            return false;
          }
        }

        return true;
      }),
    [abonos, fechaDesde, fechaHasta]
  );

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
        <div className="card-title">📜 Historial de Abonos Detectados</div>
        <div className="row" style={{ marginBottom: '10px' }}>
          <label className="field">
            <span>Desde</span>
            <input
              type="date"
              value={fechaDesde}
              onChange={(event) => onFechaDesdeChange(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Hasta</span>
            <input
              type="date"
              value={fechaHasta}
              onChange={(event) => onFechaHastaChange(event.target.value)}
            />
          </label>
          <div className="field" style={{ alignSelf: 'flex-end' }}>
            <button
              type="button"
              className="btn secondary"
              onClick={() => void onExportPdf()}
            >
              📄 Exportar PDF
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha Detección</th>
                <th>Cliente</th>
                <th>Documento</th>
                <th className="num">Saldo Anterior</th>
                <th className="num">Pago Aplicado</th>
                <th className="num">Nuevo Saldo</th>
                <th>Observación</th>
              </tr>
            </thead>
            <tbody>
              {abonosFiltrados.length > 0 ? (
                abonosFiltrados.map((abono) => (
                  <tr key={abono.id}>
                    <td>{abono.fecha.split('T')[0]}</td>
                    <td>
                      <strong>
                        {abono.cliente || abono.razon_social || '-'}
                      </strong>
                    </td>
                    <td>
                      <strong>{abono.documento}</strong>
                    </td>
                    <td className="num">
                      {fmtMoney(abono.total_anterior)}
                    </td>
                    <td className="num kpi-positive">
                      {fmtMoney(abono.total_anterior - abono.total_nuevo)}
                    </td>
                    <td className="num">{fmtMoney(abono.total_nuevo)}</td>
                    <td
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {abono.observacion || '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      textAlign: 'center',
                      color: '#9ca3af',
                      padding: '40px',
                    }}
                  >
                    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>
                      📭
                    </div>
                    <div style={{ fontSize: '1rem', marginBottom: '8px' }}>
                      No hay abonos detectados aún
                    </div>
                    <div style={{ fontSize: '0.85rem' }}>
                      Importa el Excel para detectar cambios en los saldos
                    </div>
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
