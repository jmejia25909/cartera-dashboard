import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import type { Documento } from '../types';
import type {
  AnalisisRetenciones,
  AnalisisVendedor,
} from '../services';
import { fmtMoney, getAgingLabel } from '../utils';

interface ClienteOption {
  cliente: string;
  razon_social?: string;
}

type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ReportsPageProps {
  isMobile: boolean;
  documentos: Documento[];
  clientes: ClienteOption[];
  vendedores: string[];
  centrosCosto: string[];
  selectedCliente: string;
  setSelectedCliente: Dispatch<SetStateAction<string>>;
  selectedVendedor: string;
  setSelectedVendedor: Dispatch<SetStateAction<string>>;
  filtroCentroCosto: string;
  setFiltroCentroCosto: Dispatch<SetStateAction<string>>;
  filtroAging: string;
  setFiltroAging: Dispatch<SetStateAction<string>>;
  searchDocumentos: string;
  setSearchDocumentos: Dispatch<SetStateAction<string>>;
  vistaAgrupada: boolean;
  setVistaAgrupada: Dispatch<SetStateAction<boolean>>;
  soloPendientes: boolean;
  setSoloPendientes: Dispatch<SetStateAction<boolean>>;
  analisisPorVendedor: AnalisisVendedor[];
  analisisRetenciones: AnalisisRetenciones;
  onExportPdf: () => Promise<void>;
  onNotify: (message: string, type: ToastType) => void;
}

interface DocumentoAgrupado {
  cliente: string;
  total: number;
  rows: Documento[];
}

const getDocumentAmount = (documento: Documento): number =>
  typeof documento.total === 'number'
    ? documento.total
    : Number(documento.valor_documento ?? 0);

export function ReportsPage({
  isMobile,
  documentos,
  clientes,
  vendedores,
  centrosCosto,
  selectedCliente,
  setSelectedCliente,
  selectedVendedor,
  setSelectedVendedor,
  filtroCentroCosto,
  setFiltroCentroCosto,
  filtroAging,
  setFiltroAging,
  searchDocumentos,
  setSearchDocumentos,
  vistaAgrupada,
  setVistaAgrupada,
  soloPendientes,
  setSoloPendientes,
  analisisPorVendedor,
  analisisRetenciones,
  onExportPdf,
  onNotify,
}: ReportsPageProps) {
  const totalMonto = documentos.reduce(
    (sum, documento) => sum + Number(documento.total ?? 0),
    0
  );

  const documentosVencidos = documentos.filter(
    (documento) => (documento.dias_vencidos ?? 0) > 0
  );

  const montoVencido = documentosVencidos.reduce(
    (sum, documento) => sum + Number(documento.total ?? 0),
    0
  );

  const porcentajeDocumentosVencidos = documentos.length > 0
    ? (documentosVencidos.length / documentos.length) * 100
    : 0;

  const porcentajeMontoVencido = totalMonto > 0
    ? (montoVencido / totalMonto) * 100
    : 0;

  const clientesUnicos = new Set(
    documentos.map((documento) => documento.cliente)
  ).size;

  const grupos = Object.values(
    documentos.reduce<Record<string, DocumentoAgrupado>>((acc, documento) => {
      const key = documento.razon_social || documento.cliente || 'Sin cliente';

      if (!acc[key]) {
        acc[key] = {
          cliente: key,
          total: 0,
          rows: [],
        };
      }

      acc[key].rows.push(documento);
      acc[key].total += Number(documento.total ?? documento.saldo ?? 0);
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total);

  const gridTwoCol: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
    gap: '16px',
    alignItems: 'stretch',
  };

  const exportarExcel = async (): Promise<void> => {
    try {
      const XLSX = await import('xlsx');
      const dataExport = documentos.map((documento) => ({
        Documento: documento.documento,
        Cliente: documento.cliente,
        'Razón Social': documento.razon_social,
        Vendedor: documento.vendedor || '-',
        Emisión: documento.fecha_emision,
        Vencimiento: documento.fecha_vencimiento,
        'Días Vencidos': documento.dias_vencidos ?? 0,
        Aging: documento.aging || getAgingLabel(documento),
        Total: documento.total,
        Valordocumento: documento.valor_documento,
        Retenciones: documento.retenciones ?? 0,
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Cartera');

      let nombreArchivo = 'Cartera_GENERAL';

      if (selectedVendedor) {
        nombreArchivo = `Cartera_${selectedVendedor.replace(/[^a-z0-9]/gi, '_')}`;
      } else if (selectedCliente && selectedCliente !== 'Todos') {
        nombreArchivo = `Cartera_${selectedCliente.replace(/[^a-z0-9]/gi, '_')}`;
      }

      XLSX.writeFile(
        workbook,
        `${nombreArchivo}_${new Date().toISOString().split('T')[0]}.xlsx`
      );

      onNotify('✅ Reporte Excel generado', 'success');
    } catch (error: unknown) {
      console.error('Error al generar Excel:', error);
      onNotify('❌ Error al generar Excel', 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="card">
        <div className="card-title">📊 Resumen Ejecutivo</div>
        <div
          className="kpis-grid"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
        >
          <div className="kpi-card">
            <div className="kpi-title">Total Documentos</div>
            <div className="kpi-value">{documentos.length}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-title">Monto Total</div>
            <div className="kpi-value">{fmtMoney(totalMonto)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-title">Docs Vencidos</div>
            <div className="kpi-value kpi-negative">{documentosVencidos.length}</div>
            <div className="kpi-subtitle">
              {porcentajeDocumentosVencidos.toFixed(1)}% del total
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-title">Monto Vencido</div>
            <div className="kpi-value kpi-negative">{fmtMoney(montoVencido)}</div>
            <div className="kpi-subtitle">
              {porcentajeMontoVencido.toFixed(1)}% del total
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-title">Clientes Únicos</div>
            <div className="kpi-value">{clientesUnicos}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">📋 Reporte de Documentos</div>
        <div className="row">
          <label className="field">
            <span>Cliente</span>
            <select
              value={selectedCliente}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedCliente(value === 'Todos' ? '' : value);
              }}
            >
              <option value="">Todos</option>
              {clientes.map((cliente) => (
                <option key={cliente.cliente} value={cliente.cliente}>
                  {cliente.razon_social || cliente.cliente}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Vendedor</span>
            <select
              value={selectedVendedor}
              onChange={(event) => setSelectedVendedor(event.target.value)}
            >
              <option value="">Todos</option>
              {vendedores.map((vendedor) => (
                <option key={vendedor} value={vendedor}>
                  {vendedor}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Centro de Costo</span>
            <select
              value={filtroCentroCosto}
              onChange={(event) => setFiltroCentroCosto(event.target.value)}
            >
              <option value="Todos">Todos</option>
              {centrosCosto.map((centroCosto) => (
                <option key={centroCosto} value={centroCosto}>
                  {centroCosto}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Aging</span>
            <select
              value={filtroAging}
              onChange={(event) => setFiltroAging(event.target.value)}
            >
              <option value="Todos">Todos</option>
              <option value="Vencidos">Vencidos (Todos)</option>
              <option value="Por vencer">Por vencer</option>
              <option value="30">30</option>
              <option value="60">60</option>
              <option value="90">90</option>
              <option value="120">120</option>
              <option value="+120">+120</option>
            </select>
          </label>
        </div>

        <div className="row">
          <label className="field">
            <span>Búsqueda</span>
            <input
              type="text"
              value={searchDocumentos}
              onChange={(event) => setSearchDocumentos(event.target.value)}
              placeholder="Buscar por cliente o documento..."
            />
          </label>

          <label className="field field-wrapper">
            <input
              type="checkbox"
              checked={vistaAgrupada}
              onChange={(event) => setVistaAgrupada(event.target.checked)}
            />
            <span>Vista Agrupada con Subtotales</span>
          </label>

          <label className="field field-wrapper">
            <input
              type="checkbox"
              checked={soloPendientes}
              onChange={(event) => setSoloPendientes(event.target.checked)}
            />
            <span>Solo saldo pendiente</span>
          </label>
        </div>

        <div className="flex-row" style={{ flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={() => void exportarExcel()}>
            📥 Exportar a Excel
          </button>
          <button className="btn primary" onClick={() => void onExportPdf()}>
            📄 Exportar a PDF
          </button>
          <button
            className="btn secondary"
            onClick={() => alert('Comparativa mensual: función en desarrollo')}
          >
            📈 Comparar Períodos
          </button>
        </div>

        {!vistaAgrupada ? (
          <div className="table-wrapper">
            <table className="data-table retenciones-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Documento</th>
                  <th>Vendedor</th>
                  <th className="th-fvenc">Fecha Vencimiento</th>
                  <th>Aging</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {documentos.length > 0 ? (
                  documentos.map((documento) => (
                    <tr key={documento.id}>
                      <td>{documento.razon_social}</td>
                      <td>{documento.documento}</td>
                      <td>{documento.vendedor}</td>
                      <td>{documento.fecha_vencimiento}</td>
                      <td>
                        <span
                          className={
                            (documento.dias_vencidos ?? 0) > 90
                              ? 'kpi-negative'
                              : (documento.dias_vencidos ?? 0) > 60
                                ? 'kpi-warning'
                                : ''
                          }
                        >
                          {documento.aging || getAgingLabel(documento)}
                        </span>
                      </td>
                      <td className="num">{fmtMoney(getDocumentAmount(documento))}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>No hay resultados</td>
                  </tr>
                )}
              </tbody>
            </table>
            <p className="table-footnote">
              Mostrando {documentos.length} de {documentos.length} documentos
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Documento</th>
                  <th>Vendedor</th>
                  <th className="th-fvenc">Fecha Vencimiento</th>
                  <th>Aging</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {documentos.length > 0 ? (
                  grupos.flatMap((grupo) => [
                    <tr key={`group-${grupo.cliente}`} style={{ background: '#f8fafc' }}>
                      <td colSpan={5} style={{ fontWeight: 700 }}>
                        {grupo.cliente}
                      </td>
                      <td className="num" style={{ fontWeight: 700 }}>
                        {fmtMoney(grupo.total)}
                      </td>
                    </tr>,
                    ...grupo.rows.map((documento) => (
                      <tr key={documento.id}>
                        <td />
                        <td>{documento.documento}</td>
                        <td>{documento.vendedor}</td>
                        <td>{documento.fecha_vencimiento}</td>
                        <td>{documento.aging || getAgingLabel(documento)}</td>
                        <td className="num">{fmtMoney(getDocumentAmount(documento))}</td>
                      </tr>
                    )),
                  ])
                ) : (
                  <tr>
                    <td colSpan={6}>No hay resultados</td>
                  </tr>
                )}
              </tbody>
            </table>
            <p className="table-footnote">
              Mostrando {documentos.length} de {documentos.length} documentos
            </p>
          </div>
        )}
      </div>

      <div style={analisisRetenciones.cantidadDocs > 0 ? gridTwoCol : {}}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title">👤 Análisis por Vendedor</div>
          <div className="table-wrapper wide-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vendedor</th>
                  <th className="num">Docs</th>
                  <th className="num">Clientes</th>
                  <th className="num">Facturado</th>
                  <th className="num">Cobrado</th>
                  <th className="num">Pendiente</th>
                  <th className="num">% Mora</th>
                </tr>
              </thead>
              <tbody>
                {analisisPorVendedor.length > 0 ? (
                  analisisPorVendedor.map((vendedor) => (
                    <tr key={vendedor.vendedor}>
                      <td>{vendedor.vendedor}</td>
                      <td className="num">{vendedor.documentos}</td>
                      <td className="num">{vendedor.cantidadClientes}</td>
                      <td className="num">{fmtMoney(vendedor.totalFacturado)}</td>
                      <td className="num">{fmtMoney(vendedor.totalCobrado)}</td>
                      <td className="num">{fmtMoney(vendedor.totalPendiente)}</td>
                      <td className="num">
                        <span
                          className={
                            vendedor.porcentajeMorosidad > 30
                              ? 'kpi-negative'
                              : vendedor.porcentajeMorosidad > 15
                                ? 'kpi-warning'
                                : 'kpi-positive'
                          }
                        >
                          {vendedor.porcentajeMorosidad.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7}>No hay datos de vendedores</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {analisisRetenciones.cantidadDocs > 0 && (
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-title">💵 Detalle de Retenciones</div>
            <div
              className="kpis-grid"
              style={{
                marginBottom: '20px',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              }}
            >
              <div className="kpi-card">
                <div className="kpi-title">Total Retenido</div>
                <div className="kpi-value">
                  {fmtMoney(analisisRetenciones.totalRetenido)}
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Documentos con Retención</div>
                <div className="kpi-value">{analisisRetenciones.cantidadDocs}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Promedio por Doc</div>
                <div className="kpi-value">
                  {fmtMoney(analisisRetenciones.promedioPorDoc)}
                </div>
              </div>
            </div>

            <div className="table-wrapper wide-table">
              <table className="data-table retenciones-table">
                <thead>
                  <tr>
                    <th>Doc</th>
                    <th>Cliente</th>
                    <th className="num">Total</th>
                    <th className="num">Retención</th>
                    <th className="num">% Retención</th>
                  </tr>
                </thead>
                <tbody>
                  {analisisRetenciones.detalles.slice(0, 20).map((detalle) => (
                    <tr key={`${detalle.documento}-${detalle.cliente}`}>
                      <td>{detalle.documento}</td>
                      <td>{detalle.cliente}</td>
                      <td className="num">{fmtMoney(detalle.total)}</td>
                      <td className="num">{fmtMoney(detalle.monto)}</td>
                      <td className="num">
                        {detalle.total > 0
                          ? ((detalle.monto / detalle.total) * 100).toFixed(1)
                          : 0}
                        %
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
