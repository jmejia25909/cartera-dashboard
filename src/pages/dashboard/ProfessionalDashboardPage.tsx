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
  '#be123c',
  '#7f1d1d',
];

function formatDate(value?: string | null): string {
  if (!value) return 'Sin información';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'medium',
    timeStyle: value.includes('T') || value.includes(':')
      ? 'short'
      : undefined,
  }).format(date);
}

function shortPath(value?: string): string {
  if (!value) return 'Base no identificada';
  const parts = value.replace(/\\/g, '/').split('/');
  return parts.slice(-3).join('/');
}

function Icon({
  name,
}: {
  name:
    | 'wallet'
    | 'warning'
    | 'shield'
    | 'cash'
    | 'users'
    | 'docs'
    | 'calendar'
    | 'policy'
    | 'cancelled'
    | 'promise'
    | 'quality'
    | 'database'
    | 'chart'
    | 'target'
    | 'agent';
}) {
  const icons = {
    wallet: '◫',
    warning: '△',
    shield: '◇',
    cash: '$',
    users: '◎',
    docs: '▤',
    calendar: '▦',
    policy: '⬡',
    cancelled: '⊘',
    promise: '⌁',
    quality: '◈',
    database: '◉',
    chart: '⌁',
    target: '◉',
    agent: '♙',
  };

  return <span className="pro-icon">{icons[name]}</span>;
}

function KpiCard({
  title,
  value,
  subtitle,
  badge,
  tone,
  icon,
  warning,
}: {
  title: string;
  value: string;
  subtitle: string;
  badge?: string;
  tone: 'blue' | 'pink' | 'violet' | 'teal' | 'green' | 'indigo';
  icon: Parameters<typeof Icon>[0]['name'];
  warning?: boolean;
}) {
  return (
    <article className={`pro-kpi pro-kpi--${tone}`}>
      <div className="pro-kpi__head">
        <span className="pro-kpi__title">{title}</span>
        <span className="pro-kpi__info" title={subtitle}>i</span>
      </div>
      <div className="pro-kpi__body">
        <div>
          <strong className="pro-kpi__value">{value}</strong>
          <span className="pro-kpi__subtitle">{subtitle}</span>
        </div>
        <div className="pro-kpi__glyph"><Icon name={icon} /></div>
      </div>
      <div className="pro-kpi__foot">
        <span className={warning ? 'pro-badge pro-badge--warning' : 'pro-badge'}>
          {badge || 'Dato auditado'}
        </span>
        <span className="pro-kpi__pulse" aria-hidden="true">
          <i /><i /><i /><i /><i />
        </span>
      </div>
    </article>
  );
}

function MiniMetric({
  label,
  value,
  detail,
  icon,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  detail: string;
  icon: Parameters<typeof Icon>[0]['name'];
  tone: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="pro-mini"
      onClick={onClick}
      disabled={!onClick}
    >
      <span className={`pro-mini__icon pro-mini__icon--${tone}`}>
        <Icon name={icon} />
      </span>
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
        <em>{detail}</em>
      </span>
    </button>
  );
}

function Panel({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="pro-panel">
      <header className="pro-panel__head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action || <button type="button" className="pro-more">•••</button>}
      </header>
      <div className="pro-panel__body">{children}</div>
    </section>
  );
}

function EmptyFuture({
  title,
  icon,
  reason,
}: {
  title: string;
  icon: Parameters<typeof Icon>[0]['name'];
  reason: string;
}) {
  return (
    <article className="pro-future">
      <span className="pro-future__icon"><Icon name={icon} /></span>
      <div>
        <strong>{title}</strong>
        <span>Próximamente</span>
        <small>{reason}</small>
      </div>
    </article>
  );
}

function DashboardLoading() {
  return (
    <div className="professional-dashboard">
      <div className="pro-loading">
        <div className="pro-loading__orb" />
        <h2>Preparando inteligencia financiera</h2>
        <p>Cargando la fuente ejecutiva auditada del dashboard.</p>
      </div>
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
    kpisFuturos,
  } = executiveStats;

  const sellerTotal = carteraPorVendedor.reduce(
    (sum, seller) => sum + seller.saldo,
    0,
  );

  const collectionVisible = cobrosMes.valorOficial === null
    ? 'Pendiente'
    : money.format(cobrosMes.valorOficial);

  const qualityLabel = calidadDatos.puntuacion === null
    ? calidadDatos.estado
    : `${calidadDatos.puntuacion.toFixed(1)}%`;

  const collectionBreakdown = [
    {
      name: 'Abonos parciales',
      value: cobrosMes.abonosParcialesDetectados,
    },
    {
      name: 'Cierres por desaparición',
      value: cobrosMes.cierresPorDesaparicionDetectados,
    },
  ];

  const navigateReports = () => {
    if (onNavigate) onNavigate('reportes');
    else onOpenReports?.();
  };

  return (
    <div className="professional-dashboard">
      <section className="pro-commandbar">
        <div className="pro-commandbar__identity">
          <span className="pro-commandbar__mark">
            <Icon name="chart" />
          </span>
          <div>
            <small>Centro de inteligencia de cartera</small>
            <strong>{empresa?.nombre || 'Dashboard ejecutivo'}</strong>
          </div>
        </div>

        <div className="pro-commandbar__meta">
          <span>
            <small>Fecha de corte</small>
            <strong>{formatDate(executiveStats.fechaCorte)}</strong>
          </span>
          <span>
            <small>Última importación</small>
            <strong>{formatDate(executiveStats.ultimaImportacion)}</strong>
          </span>
          <span>
            <small>Calidad del dato</small>
            <strong className={`pro-status pro-status--${calidadDatos.estado.toLowerCase()}`}>
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
          className="pro-refresh"
          onClick={() => void onRefresh?.()}
        >
          ↻ Actualizar
        </button>
      </section>

      {(descuadresDetectados > 0 ||
        operacion.documentosCreditoPendiente > 0) && (
        <section className="pro-attention">
          <span><Icon name="warning" /></span>
          <div>
            <strong>Atención operativa requerida</strong>
            <p>
              {operacion.documentosCreditoPendiente} documentos tienen
              política de crédito pendiente
              {descuadresDetectados > 0
                ? ` y existen ${descuadresDetectados} descuadres activos.`
                : '.'}
            </p>
          </div>
          <button type="button" onClick={() => onNavigate?.('creditos')}>
            Revisar ahora →
          </button>
        </section>
      )}

      <section className="pro-kpi-grid">
        <KpiCard
          title="CARTERA PENDIENTE"
          value={money.format(cartera.pendiente)}
          subtitle="Saldo activo por cobrar"
          badge="Universo depurado"
          tone="blue"
          icon="wallet"
        />
        <KpiCard
          title="CARTERA VENCIDA"
          value={money.format(cartera.vencida)}
          subtitle={`${cartera.porcentajeVencida.toFixed(2)}% de la cartera`}
          badge="Riesgo elevado"
          tone="pink"
          icon="warning"
          warning
        />
        <KpiCard
          title="MORA > 90 DÍAS"
          value={money.format(cartera.mora90)}
          subtitle={`${cartera.porcentajeMora90.toFixed(2)}% de la cartera`}
          badge="Cartera crítica"
          tone="violet"
          icon="shield"
          warning
        />
        <KpiCard
          title="COBROS DEL MES"
          value={collectionVisible}
          subtitle="Requiere conciliación bancaria"
          badge={`${money.format(cobrosMes.totalDetectado)} detectado`}
          tone="teal"
          icon="cash"
          warning
        />
        <KpiCard
          title="CLIENTES CON SALDO"
          value={integer.format(cartera.clientesConSaldo)}
          subtitle="Clientes activos en cartera"
          badge={`${calidadDatos.coberturaPoliticaCredito.toFixed(1)}% con política`}
          tone="green"
          icon="users"
        />
        <KpiCard
          title="DOCUMENTOS PENDIENTES"
          value={integer.format(cartera.documentosPendientes)}
          subtitle="Documentos con saldo positivo"
          badge="Sin anulados"
          tone="indigo"
          icon="docs"
        />
      </section>

      <section className="pro-mini-grid">
        <MiniMetric
          label="VENCE 0–7 DÍAS"
          value={money.format(operacion.vence7Dias)}
          detail={`${operacion.documentosVence7Dias} documentos`}
          icon="calendar"
          tone="amber"
          onClick={navigateReports}
        />
        <MiniMetric
          label="VENCE 8–30 DÍAS"
          value={money.format(operacion.vence8a30Dias)}
          detail={`${operacion.documentosVence8a30Dias} documentos`}
          icon="calendar"
          tone="orange"
          onClick={navigateReports}
        />
        <MiniMetric
          label="SIN POLÍTICA"
          value={integer.format(operacion.clientesSinPolitica)}
          detail={`${operacion.documentosCreditoPendiente} docs. pendientes`}
          icon="policy"
          tone="violet"
          onClick={() => onNavigate?.('creditos')}
        />
        <MiniMetric
          label="ANULADOS NO ENCONTRADOS"
          value={integer.format(operacion.anuladosNoEncontrados)}
          detail={`${calidadDatos.coincidenciaAnulaciones.toFixed(1)}% coincidencia`}
          icon="cancelled"
          tone="rose"
          onClick={() => onNavigate?.('anulados')}
        />
        <MiniMetric
          label="PROMESAS VENCIDAS"
          value={integer.format(operacion.promesasVencidas)}
          detail="Compromisos pendientes"
          icon="promise"
          tone="red"
          onClick={() => onNavigate?.('gestion')}
        />
        <MiniMetric
          label="CALIDAD DEL DATO"
          value={qualityLabel}
          detail={`${calidadDatos.documentosEvaluados} docs. evaluados`}
          icon="quality"
          tone="teal"
        />
      </section>

      <section className="pro-analytics-grid">
        <Panel
          title="Aging de cartera"
          subtitle="Distribución del saldo pendiente por antigüedad"
        >
          <div className="pro-aging">
            {aging.map((item, index) => (
              <div className="pro-aging__row" key={item.key}>
                <span>{item.label}</span>
                <div className="pro-aging__track">
                  <i
                    style={{
                      width: `${Math.max(item.porcentaje, 1)}%`,
                      background: CHART_COLORS[index],
                    }}
                  />
                </div>
                <strong>{money.format(item.saldo)}</strong>
                <small>{item.porcentaje.toFixed(1)}%</small>
                <em>{item.documentos} docs.</em>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Evolución de cartera y cobros"
          subtitle={
            historico.disponible
              ? 'Comparación mensual'
              : 'Preparado para snapshots mensuales'
          }
        >
          {historico.disponible ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={historico.series}>
                <defs>
                  <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8edf7" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => compactMoney.format(v)} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => money.format(Number(value))} />
                <Area
                  type="monotone"
                  dataKey="cartera"
                  stroke="#6366f1"
                  fill="url(#portfolioGradient)"
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="pro-history-empty">
              <div className="pro-history-empty__visual">
                <span /><span /><span /><span /><span /><span />
              </div>
              <strong>Histórico insuficiente</strong>
              <p>{historico.motivo}</p>
            </div>
          )}
        </Panel>

        <Panel
          title="Top clientes por saldo"
          subtitle="Concentración de cartera activa"
          action={
            <button type="button" className="pro-link" onClick={navigateReports}>
              Ver detalle →
            </button>
          }
        >
          <div className="pro-ranking">
            {topClientes.slice(0, 6).map((client, index) => (
              <div className="pro-ranking__row" key={`${client.cliente}-${index}`}>
                <span className="pro-ranking__number">{index + 1}</span>
                <div className="pro-ranking__name">
                  <strong>{client.cliente}</strong>
                  <small>
                    Vencido {money.format(client.vencido)} ·
                    {' '}{client.porcentajeVencido.toFixed(1)}%
                  </small>
                </div>
                <div className="pro-ranking__value">
                  <strong>{money.format(client.saldo)}</strong>
                  <i style={{
                    width: `${Math.min(
                      100,
                      (client.saldo / Math.max(topClientes[0]?.saldo || 1, 1)) * 100,
                    )}%`,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Cartera por vendedor"
          subtitle="Participación sobre saldo pendiente"
        >
          <div className="pro-seller-layout">
            <div className="pro-donut">
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={carteraPorVendedor.slice(0, 6)}
                    dataKey="saldo"
                    nameKey="vendedor"
                    innerRadius={58}
                    outerRadius={84}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {carteraPorVendedor.slice(0, 6).map((seller, index) => (
                      <Cell
                        key={seller.vendedor}
                        fill={CHART_COLORS[index]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => money.format(Number(value))}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pro-donut__center">
                <small>Total</small>
                <strong>{compactMoney.format(sellerTotal)}</strong>
              </div>
            </div>
            <div className="pro-seller-list">
              {carteraPorVendedor.slice(0, 5).map((seller, index) => (
                <div key={seller.vendedor}>
                  <i style={{ background: CHART_COLORS[index] }} />
                  <span title={seller.vendedor}>{seller.vendedor}</span>
                  <strong>
                    {sellerTotal > 0
                      ? ((seller.saldo / sellerTotal) * 100).toFixed(1)
                      : '0.0'}%
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel
          title="Mora crítica"
          subtitle="Clientes con saldo superior a 90 días"
          action={
            <button type="button" className="pro-link" onClick={navigateReports}>
              Reporte completo →
            </button>
          }
        >
          <div className="pro-critical-list">
            {moraCritica.slice(0, 6).map((debtor, index) => (
              <div key={`${debtor.cliente}-${index}`}>
                <span className="pro-critical-list__rank">{index + 1}</span>
                <div>
                  <strong>{debtor.cliente}</strong>
                  <small>{debtor.vendedor} · {debtor.documentos} docs.</small>
                </div>
                <span className="pro-critical-list__days">
                  {debtor.maxDias} días
                </span>
                <strong>{money.format(debtor.mora90)}</strong>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Alertas críticas"
          subtitle="Acciones que requieren atención"
        >
          <div className="pro-alert-list">
            {alertas.map((alert) => (
              <button
                key={alert.key}
                type="button"
                onClick={() => {
                  const target = alert.target.toLowerCase() as
                    'reportes' | 'creditos' | 'anulados' | 'gestion';
                  onNavigate?.(target);
                }}
              >
                <span className={`pro-alert-list__dot pro-alert-list__dot--${alert.severity.toLowerCase()}`} />
                <div>
                  <strong>{alert.label}</strong>
                  <small>
                    {alert.severity === 'CRITICAL'
                      ? 'Prioridad alta'
                      : alert.severity === 'WARNING'
                        ? 'Requiere revisión'
                        : 'Informativo'}
                  </small>
                </div>
                <b>{integer.format(alert.count)}</b>
                <em>→</em>
              </button>
            ))}
          </div>
        </Panel>

        <Panel
          title="Composición de movimientos detectados"
          subtitle="No equivale a cobranza bancaria oficial"
        >
          <div className="pro-collection-layout">
            <ResponsiveContainer width="42%" height={220}>
              <PieChart>
                <Pie
                  data={collectionBreakdown}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={54}
                  outerRadius={78}
                  stroke="none"
                >
                  <Cell fill="#14b8a6" />
                  <Cell fill="#8b5cf6" />
                </Pie>
                <Tooltip formatter={(value) => money.format(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pro-collection-legend">
              <span>
                <i className="pro-dot-teal" />
                <small>Abonos parciales</small>
                <strong>{money.format(cobrosMes.abonosParcialesDetectados)}</strong>
                <em>{cobrosMes.movimientosParciales} movimientos</em>
              </span>
              <span>
                <i className="pro-dot-violet" />
                <small>Cierres por desaparición</small>
                <strong>{money.format(cobrosMes.cierresPorDesaparicionDetectados)}</strong>
                <em>{cobrosMes.movimientosPorDesaparicion} movimientos</em>
              </span>
              <p>{cobrosMes.nota}</p>
            </div>
          </div>
        </Panel>
      </section>

      <section className="pro-future-grid">
        {kpisFuturos.slice(0, 3).map((item, index) => (
          <EmptyFuture
            key={item.key}
            title={item.label}
            icon={index === 0 ? 'chart' : index === 1 ? 'target' : 'agent'}
            reason={item.motivo}
          />
        ))}
      </section>

      <footer className="pro-footer">
        <span>
          <i className="pro-online-dot" />
          Fuente ejecutiva conectada
        </span>
        <span>
          Corte {formatDate(executiveStats.fechaCorte)} ·
          {' '}Última detección {formatDate(executiveStats.ultimaDeteccionAbono)}
        </span>
      </footer>
    </div>
  );
}
