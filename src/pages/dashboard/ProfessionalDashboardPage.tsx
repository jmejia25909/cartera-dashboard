import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DashboardExecutiveStats } from '../../types/dashboardExecutive';
import './professional-dashboard.css';

type LegacyProps = {
  isMobile?: boolean;
  descuadresDetectados?: number;
  stats?: unknown;
  agingData?: unknown;
  topClientesData?: unknown;
  eficienciaCobranza?: unknown;
  vencimientosProximos?: unknown;
  analisisRetenciones?: unknown;
  analisisPorVendedor?: unknown;
  deudoresCronicos?: unknown;
  onOpenReports?: () => void;
};

export interface DashboardPageProps extends LegacyProps {
  executiveStats?: DashboardExecutiveStats | null;
  empresa?: {
    nombre?: string;
    administrador?: string;
  };
  dbPath?: string;
  onRefresh?: () => void | Promise<void>;
  onNavigate?: (
    target: 'reportes' | 'creditos' | 'anulados' | 'gestion',
  ) => void;
}

const money = new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

const compactMoney = new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const integer = new Intl.NumberFormat('es-EC');

const CHART_COLORS = [
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#f59e0b',
  '#f97316',
  '#ef4444',
];

function formatDate(value?: string | null): string {
  if (!value) return 'Sin información';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'medium',
    timeStyle:
      value.includes('T') || value.includes(':')
        ? 'short'
        : undefined,
  }).format(date);
}

function shortPath(value?: string): string {
  if (!value) return 'Base no identificada';
  const parts = value.replace(/\\/g, '/').split('/');
  return parts.slice(-3).join('/');
}

function KpiCard({
  title,
  value,
  meta,
  tone,
  critical = false,
}: {
  title: string;
  value: string;
  meta: string;
  tone: 'blue' | 'red' | 'violet' | 'teal' | 'green' | 'indigo';
  critical?: boolean;
}) {
  return (
    <article className={`exec-kpi exec-kpi--${tone}`}>
      <header>
        <span>{title}</span>
        <i>{critical ? '!' : 'i'}</i>
      </header>
      <strong>{value}</strong>
      <footer>
        <span>{meta}</span>
        <b aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </b>
      </footer>
    </article>
  );
}

function Panel({
  title,
  subtitle,
  children,
  action,
  className = '',
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`exec-panel ${className}`}>
      <header className="exec-panel__header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action || <span className="exec-panel__menu">•••</span>}
      </header>
      <div className="exec-panel__body">{children}</div>
    </section>
  );
}

function StatusItem({
  label,
  value,
  detail,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  detail: string;
  tone: 'blue' | 'amber' | 'red' | 'violet' | 'teal';
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="exec-status-item"
      onClick={onClick}
      disabled={!onClick}
    >
      <i className={`exec-status-dot exec-status-dot--${tone}`} />
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
        <em>{detail}</em>
      </span>
      {onClick && <b>→</b>}
    </button>
  );
}

function DashboardLoading() {
  return (
    <div className="executive-dashboard executive-dashboard--loading">
      <div className="exec-loader" />
      <h2>Preparando inteligencia financiera</h2>
      <p>Cargando la fuente ejecutiva auditada.</p>
    </div>
  );
}

export function DashboardPage({
  executiveStats,
  empresa,
  dbPath,
  descuadresDetectados = 0,
  onRefresh,
  onNavigate,
  onOpenReports,
}: DashboardPageProps) {
  if (!executiveStats) {
    return <DashboardLoading />;
  }

  const {
    cartera,
    cobrosMes,
    operacion,
    calidadDatos,
    aging,
    topClientes,
    carteraPorVendedor,
    moraCritica,
    alertas,
    historico,
  } = executiveStats;

  const navigateReports = () => {
    if (onNavigate) {
      onNavigate('reportes');
      return;
    }

    onOpenReports?.();
  };

  const sellerTotal = carteraPorVendedor.reduce(
    (sum, seller) => sum + seller.saldo,
    0,
  );

  const collectionLabel =
    cobrosMes.valorOficial === null
      ? 'Pendiente'
      : money.format(cobrosMes.valorOficial);

  const qualityLabel =
    calidadDatos.puntuacion === null
      ? calidadDatos.estado
      : `${calidadDatos.puntuacion.toFixed(1)}%`;

  return (
    <div className="executive-dashboard">
      <section className="exec-topbar">
        <div className="exec-topbar__brand">
          <span className="exec-topbar__logo">◆</span>
          <div>
            <small>Centro de inteligencia de cartera</small>
            <strong>{empresa?.nombre || 'Dashboard ejecutivo'}</strong>
          </div>
        </div>

        <div className="exec-topbar__meta">
          <span>
            <small>Corte</small>
            <strong>{formatDate(executiveStats.fechaCorte)}</strong>
          </span>
          <span>
            <small>Última importación</small>
            <strong>{formatDate(executiveStats.ultimaImportacion)}</strong>
          </span>
          <span>
            <small>Calidad</small>
            <strong
              className={`exec-quality exec-quality--${calidadDatos.estado.toLowerCase()}`}
            >
              {qualityLabel}
            </strong>
          </span>
          <span>
            <small>Base activa</small>
            <strong title={dbPath}>{shortPath(dbPath)}</strong>
          </span>
        </div>

        <button
          type="button"
          className="exec-refresh"
          onClick={() => void onRefresh?.()}
        >
          ↻ Actualizar
        </button>
      </section>

      <section className="exec-kpi-grid">
        <KpiCard
          title="CARTERA PENDIENTE"
          value={money.format(cartera.pendiente)}
          meta="Saldo activo por cobrar"
          tone="blue"
        />
        <KpiCard
          title="CARTERA VENCIDA"
          value={money.format(cartera.vencida)}
          meta={`${cartera.porcentajeVencida.toFixed(1)}% de la cartera`}
          tone="red"
          critical
        />
        <KpiCard
          title="MORA > 90 DÍAS"
          value={money.format(cartera.mora90)}
          meta={`${cartera.porcentajeMora90.toFixed(1)}% de la cartera`}
          tone="violet"
          critical
        />
        <KpiCard
          title="COBROS DEL MES"
          value={collectionLabel}
          meta={`${money.format(cobrosMes.totalDetectado)} detectado`}
          tone="teal"
          critical
        />
        <KpiCard
          title="CLIENTES"
          value={integer.format(cartera.clientesConSaldo)}
          meta="Con saldo activo"
          tone="green"
        />
        <KpiCard
          title="DOCUMENTOS"
          value={integer.format(cartera.documentosPendientes)}
          meta="Pendientes de cobro"
          tone="indigo"
        />
      </section>

      <section className="exec-layout">
        <Panel
          title="Aging de cartera"
          subtitle="Saldo pendiente por antigüedad"
          className="exec-panel--aging"
        >
          <div className="exec-aging">
            {aging.map((item, index) => (
              <div className="exec-aging__row" key={item.key}>
                <span>{item.label}</span>
                <div className="exec-aging__track">
                  <i
                    style={{
                      width: `${Math.max(item.porcentaje, 1)}%`,
                      background: CHART_COLORS[index],
                    }}
                  />
                </div>
                <strong>{compactMoney.format(item.saldo)}</strong>
                <small>{item.porcentaje.toFixed(1)}%</small>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Evolución de cartera"
          subtitle={
            historico.disponible
              ? 'Comparación mensual'
              : 'Esperando histórico comparable'
          }
          className="exec-panel--history"
        >
          {historico.disponible ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historico.series}>
                <defs>
                  <linearGradient
                    id="executiveGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#6366f1"
                      stopOpacity={0.36}
                    />
                    <stop
                      offset="100%"
                      stopColor="#6366f1"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#edf1f7"
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(value) =>
                    compactMoney.format(Number(value))
                  }
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(value) =>
                    money.format(Number(value))
                  }
                />
                <Area
                  type="monotone"
                  dataKey="cartera"
                  stroke="#6366f1"
                  fill="url(#executiveGradient)"
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="exec-history-empty">
              <div className="exec-history-empty__chart">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <strong>Histórico insuficiente</strong>
              <small>Se habilitará después de dos cortes comparables.</small>
            </div>
          )}
        </Panel>

        <Panel
          title="Estado operativo"
          subtitle="Incidencias y próximos vencimientos"
          className="exec-panel--operations"
        >
          <div className="exec-status-list">
            <StatusItem
              label="Vence 0–7 días"
              value={money.format(operacion.vence7Dias)}
              detail={`${operacion.documentosVence7Dias} documentos`}
              tone="amber"
              onClick={navigateReports}
            />
            <StatusItem
              label="Vence 8–30 días"
              value={money.format(operacion.vence8a30Dias)}
              detail={`${operacion.documentosVence8a30Dias} documentos`}
              tone="blue"
              onClick={navigateReports}
            />
            <StatusItem
              label="Clientes sin política"
              value={integer.format(operacion.clientesSinPolitica)}
              detail={`${operacion.documentosCreditoPendiente} docs. pendientes`}
              tone="violet"
              onClick={() => onNavigate?.('creditos')}
            />
            <StatusItem
              label="Anulados no encontrados"
              value={integer.format(operacion.anuladosNoEncontrados)}
              detail={`${calidadDatos.coincidenciaAnulaciones.toFixed(1)}% coincidencia`}
              tone="red"
              onClick={() => onNavigate?.('anulados')}
            />
            <StatusItem
              label="Promesas vencidas"
              value={integer.format(operacion.promesasVencidas)}
              detail="Compromisos pendientes"
              tone="amber"
              onClick={() => onNavigate?.('gestion')}
            />
            <StatusItem
              label="Calidad del dato"
              value={qualityLabel}
              detail={`${calidadDatos.documentosEvaluados} docs. evaluados`}
              tone="teal"
            />
          </div>
        </Panel>

        <Panel
          title="Top clientes"
          subtitle="Concentración por saldo"
          action={
            <button
              type="button"
              className="exec-link"
              onClick={navigateReports}
            >
              Ver detalle →
            </button>
          }
          className="exec-panel--clients"
        >
          <div className="exec-ranking">
            {topClientes.slice(0, 5).map((client, index) => (
              <div key={`${client.cliente}-${index}`}>
                <span>{index + 1}</span>
                <div>
                  <strong>{client.cliente}</strong>
                  <small>
                    Vencido {client.porcentajeVencido.toFixed(1)}%
                  </small>
                </div>
                <b>{compactMoney.format(client.saldo)}</b>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Cartera por vendedor"
          subtitle="Participación del saldo"
          className="exec-panel--sellers"
        >
          <div className="exec-seller-grid">
            <div className="exec-donut">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={carteraPorVendedor.slice(0, 5)}
                    dataKey="saldo"
                    nameKey="vendedor"
                    innerRadius={44}
                    outerRadius={65}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {carteraPorVendedor
                      .slice(0, 5)
                      .map((seller, index) => (
                        <Cell
                          key={seller.vendedor}
                          fill={CHART_COLORS[index]}
                        />
                      ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) =>
                      money.format(Number(value))
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
              <div>
                <small>Total</small>
                <strong>{compactMoney.format(sellerTotal)}</strong>
              </div>
            </div>

            <div className="exec-sellers">
              {carteraPorVendedor.slice(0, 5).map((seller, index) => (
                <div key={seller.vendedor}>
                  <i style={{ background: CHART_COLORS[index] }} />
                  <span title={seller.vendedor}>
                    {seller.vendedor}
                  </span>
                  <strong>
                    {sellerTotal > 0
                      ? (
                          (seller.saldo / sellerTotal) *
                          100
                        ).toFixed(1)
                      : '0.0'}
                    %
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel
          title="Mora crítica"
          subtitle="Clientes con más de 90 días"
          action={
            <button
              type="button"
              className="exec-link"
              onClick={navigateReports}
            >
              Reporte →
            </button>
          }
          className="exec-panel--critical"
        >
          <div className="exec-critical">
            {moraCritica.slice(0, 5).map((debtor, index) => (
              <div key={`${debtor.cliente}-${index}`}>
                <span>{index + 1}</span>
                <div>
                  <strong>{debtor.cliente}</strong>
                  <small>{debtor.documentos} documentos</small>
                </div>
                <em>{debtor.maxDias} d</em>
                <b>{compactMoney.format(debtor.mora90)}</b>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Alertas críticas"
          subtitle="Acciones prioritarias"
          className="exec-panel--alerts"
        >
          <div className="exec-alerts">
            {alertas.slice(0, 5).map((alert) => (
              <button
                key={alert.key}
                type="button"
                onClick={() => {
                  const target = alert.target.toLowerCase() as
                    | 'reportes'
                    | 'creditos'
                    | 'anulados'
                    | 'gestion';

                  onNavigate?.(target);
                }}
              >
                <i
                  className={`exec-alert-dot exec-alert-dot--${alert.severity.toLowerCase()}`}
                />
                <span>
                  <strong>{alert.label}</strong>
                  <small>
                    {alert.severity === 'CRITICAL'
                      ? 'Prioridad alta'
                      : 'Requiere revisión'}
                  </small>
                </span>
                <b>{integer.format(alert.count)}</b>
                <em>→</em>
              </button>
            ))}
          </div>
        </Panel>
      </section>

      <footer className="exec-footer">
        <span>
          ● Fuente ejecutiva conectada
        </span>
        <span>
          {descuadresDetectados > 0
            ? `${descuadresDetectados} descuadres activos`
            : 'Sin descuadres activos'}
        </span>
        <span>
          Cobros detectados: {money.format(cobrosMes.totalDetectado)}
        </span>
      </footer>
    </div>
  );
}
