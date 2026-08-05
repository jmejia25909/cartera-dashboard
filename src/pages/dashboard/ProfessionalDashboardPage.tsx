import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  createHttpApiClient,
  getElectronApi,
} from '../../app/api';
import type {
  DashboardExecutiveFilters,
  DashboardExecutiveStats,
} from '../../types/dashboardExecutive';
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
    target:
      | 'reportes'
      | 'creditos'
      | 'anulados'
      | 'gestion',
  ) => void;
}

const MONTHS = [
  { value: 1, label: 'Ene' },
  { value: 2, label: 'Feb' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Abr' },
  { value: 5, label: 'May' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Ago' },
  { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dic' },
];

const CHART_COLORS = [
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#f59e0b',
  '#f97316',
  '#ef4444',
];

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

function KpiIcon({
  kind,
}: {
  kind:
    | 'portfolio'
    | 'overdue'
    | 'risk'
    | 'cash'
    | 'clients'
    | 'docs';
}) {
  const icons = {
    portfolio: '$',
    overdue: '▦',
    risk: '◷',
    cash: '▣',
    clients: '♙',
    docs: '▤',
  };

  return (
    <span className={`bi-kpi-icon bi-kpi-icon--${kind}`}>
      {icons[kind]}
    </span>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  kind,
  tooltip,
}: {
  title: string;
  value: string;
  subtitle: string;
  kind:
    | 'portfolio'
    | 'overdue'
    | 'risk'
    | 'cash'
    | 'clients'
    | 'docs';
  tooltip: string;
}) {
  return (
    <article className={`bi-kpi bi-kpi--${kind}`}>
      <div className="bi-kpi__content">
        <KpiIcon kind={kind} />
        <div>
          <span className="bi-kpi__title">{title}</span>
          <strong className="bi-kpi__value">{value}</strong>
          <small className="bi-kpi__subtitle">
            {subtitle}
          </small>
        </div>
      </div>

      <span className="bi-kpi__accent" aria-hidden="true" />

      <div className="bi-hover-card">
        <strong>{title}</strong>
        <p>{tooltip}</p>
      </div>
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
    <section className={`bi-panel ${className}`}>
      <header className="bi-panel__header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action || <span className="bi-panel__menu">•••</span>}
      </header>
      <div className="bi-panel__body">{children}</div>
    </section>
  );
}

function OperationCard({
  label,
  value,
  detail,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  detail: string;
  tone:
    | 'amber'
    | 'orange'
    | 'violet'
    | 'red'
    | 'teal';
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="bi-operation"
      onClick={onClick}
      disabled={!onClick}
    >
      <span
        className={`bi-operation__icon bi-operation__icon--${tone}`}
      >
        {tone === 'red'
          ? '!'
          : tone === 'teal'
            ? '◇'
            : tone === 'violet'
              ? '♙'
              : '▦'}
      </span>
      <span className="bi-operation__text">
        <small>{label}</small>
        <strong>{value}</strong>
        <em>{detail}</em>
      </span>
      {onClick && <b>›</b>}
    </button>
  );
}

function DashboardLoading() {
  return (
    <div className="powerbi-dashboard powerbi-dashboard--loading">
      <div className="bi-loader" />
      <h2>Actualizando inteligencia financiera</h2>
      <p>Consultando el periodo seleccionado.</p>
    </div>
  );
}

export function DashboardPage({
  executiveStats,
  descuadresDetectados = 0,
  onNavigate,
  onOpenReports,
}: DashboardPageProps) {
  const initialMonth =
    executiveStats?.periodo.selectedMonth ??
    new Date().getMonth() + 1;

  const initialYear =
    executiveStats?.periodo.selectedYear ??
    new Date().getFullYear();

  const [data, setData] =
    useState<DashboardExecutiveStats | null>(
      executiveStats || null,
    );

  const [selectedMonth, setSelectedMonth] =
    useState<number | null>(initialMonth);

  const [selectedYear, setSelectedYear] =
    useState<number>(initialYear);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (executiveStats) {
      setData(executiveStats);
    }
  }, [executiveStats]);

  const loadExecutiveData = useCallback(
    async (
      filters: DashboardExecutiveFilters,
    ): Promise<void> => {
      const electronApi = getElectronApi();
      const api = electronApi || createHttpApiClient();

      if (!api?.dashboardExecutiveStats) {
        return;
      }

      setLoading(true);

      try {
        const result =
          await api.dashboardExecutiveStats(filters);

        setData(result);
      } catch (error) {
        console.error(
          'Error cargando dashboard ejecutivo:',
          error,
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadExecutiveData({
      year: selectedYear,
      month: selectedMonth,
    });
  }, [
    loadExecutiveData,
    selectedMonth,
    selectedYear,
  ]);

  const navigateReports = () => {
    if (onNavigate) {
      onNavigate('reportes');
      return;
    }

    onOpenReports?.();
  };

  const availableYears = useMemo(() => {
    const years =
      data?.periodo.availableYears || [];

    if (years.length > 0) {
      return years;
    }

    const currentYear = new Date().getFullYear();

    return [
      currentYear - 1,
      currentYear,
      currentYear + 1,
      currentYear + 2,
      currentYear + 3,
      currentYear + 4,
    ];
  }, [data]);

  if (!data) {
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
    periodo,
  } = data;

  const sellerTotal =
    carteraPorVendedor.reduce(
      (sum, seller) => sum + seller.saldo,
      0,
    );

  const collectionLabel =
    cobrosMes.valorOficial === null
      ? 'Pendiente'
      : money.format(cobrosMes.valorOficial);

  const collectionTitle =
    selectedMonth === null
      ? 'MOVIMIENTOS DEL AÑO'
      : 'COBROS DEL MES';

  const chartSeries = historico.series;

  const selectedMonthLabel =
    selectedMonth === null
      ? 'Todos los meses'
      : MONTHS.find(
          (month) => month.value === selectedMonth,
        )?.label || 'Mes seleccionado';

  return (
    <div className="powerbi-dashboard">
      <section className="bi-filterbar">
        <div className="bi-month-filter">
          <strong>Filtrar por mes:</strong>

          {MONTHS.map((month) => (
            <button
              key={month.value}
              type="button"
              className={
                selectedMonth === month.value
                  ? 'is-active'
                  : ''
              }
              onClick={() =>
                setSelectedMonth(month.value)
              }
            >
              {month.label}
            </button>
          ))}

          <button
            type="button"
            className={
              selectedMonth === null
                ? 'is-active'
                : ''
            }
            onClick={() => setSelectedMonth(null)}
          >
            Todos
          </button>
        </div>

        <div className="bi-filterbar__right">
          <span
            className={`bi-data-state bi-data-state--${calidadDatos.estado.toLowerCase()}`}
            title={
              `${operacion.documentosCreditoPendiente} documentos con crédito pendiente · ` +
              `${operacion.anuladosNoEncontrados} anulados no encontrados`
            }
          >
            ● Calidad del dato: {calidadDatos.estado}
          </span>

          <label className="bi-year-filter">
            <span>Año</span>
            <select
              value={selectedYear}
              onChange={(event) =>
                setSelectedYear(
                  Number(event.target.value),
                )
              }
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

        </div>
      </section>

      <section className="bi-kpi-grid">
        <KpiCard
          title="CARTERA PENDIENTE"
          value={money.format(cartera.pendiente)}
          subtitle="Saldo activo por cobrar"
          kind="portfolio"
          tooltip={
            'Suma de saldos positivos activos. ' +
            'Excluye anulados y subtotales.'
          }
        />

        <KpiCard
          title="CARTERA VENCIDA"
          value={money.format(cartera.vencida)}
          subtitle={`${cartera.porcentajeVencida.toFixed(1)}% de la cartera`}
          kind="overdue"
          tooltip={
            'Saldo activo cuya fecha de vencimiento ' +
            'es anterior a la fecha de corte.'
          }
        />

        <KpiCard
          title="MORA > 90 DÍAS"
          value={money.format(cartera.mora90)}
          subtitle={`${cartera.porcentajeMora90.toFixed(1)}% de la cartera`}
          kind="risk"
          tooltip={
            'Saldo activo con más de 90 días de mora. ' +
            'Mide la cartera crítica.'
          }
        />

        <KpiCard
          title={collectionTitle}
          value={collectionLabel}
          subtitle={`${money.format(cobrosMes.totalDetectado)} detectado`}
          kind="cash"
          tooltip={
            `${periodo.label}. ` +
            'Movimientos detectados; requieren ' +
            'conciliación bancaria.'
          }
        />

        <KpiCard
          title="CLIENTES ACTIVOS"
          value={integer.format(cartera.clientesConSaldo)}
          subtitle="Con saldo pendiente"
          kind="clients"
          tooltip={
            'Clientes únicos con al menos un ' +
            'documento activo y saldo positivo.'
          }
        />

        <KpiCard
          title="DOCUMENTOS"
          value={integer.format(cartera.documentosPendientes)}
          subtitle="Pendientes de cobro"
          kind="docs"
          tooltip={
            'Documentos activos con saldo positivo. ' +
            'Excluye anulados y subtotales.'
          }
        />
      </section>

      <section className="bi-main-grid">
        <Panel
          title="Aging de cartera"
          subtitle="Saldo pendiente por antigüedad"
          className="bi-panel--aging"
        >
          <div className="bi-aging-table">
            <div className="bi-aging-table__head">
              <span>Rango</span>
              <span />
              <span>Saldo</span>
              <span>%</span>
              <span>Docs.</span>
            </div>

            {aging.map((item, index) => (
              <div
                className="bi-aging-row"
                key={item.key}
              >
                <span>{item.label}</span>

                <div className="bi-aging-row__bar">
                  <i
                    style={{
                      width: `${Math.max(
                        item.porcentaje,
                        1,
                      )}%`,
                      background:
                        CHART_COLORS[index],
                    }}
                  />
                </div>

                <strong>
                  {money.format(item.saldo)}
                </strong>

                <small>
                  {item.porcentaje.toFixed(1)}%
                </small>

                <em>{item.documentos}</em>

                <div className="bi-aging-tooltip">
                  <strong>{item.label}</strong>
                  <span>
                    Saldo {money.format(item.saldo)}
                  </span>
                  <span>
                    {item.porcentaje.toFixed(1)}% de
                    la cartera
                  </span>
                  <span>
                    {item.documentos} documentos
                  </span>
                </div>
              </div>
            ))}

            <div className="bi-aging-total">
              <strong>Total</strong>
              <span />
              <strong>
                {money.format(cartera.pendiente)}
              </strong>
              <strong>100%</strong>
              <strong>
                {cartera.documentosPendientes}
              </strong>
            </div>
          </div>
        </Panel>

        <Panel
          title="Evolución de movimientos"
          subtitle={`${periodo.selectedYear} · 12 meses · ${selectedMonthLabel} resaltado`}
          className="bi-panel--evolution"
          action={
            <span
              className="bi-period-note"
              title={periodo.note}
            >
              i
            </span>
          }
        >
          {historico.disponible ? (
            <>
              <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart
                data={chartSeries}
                margin={{
                  top: 8,
                  right: 10,
                  left: 0,
                  bottom: 0,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#edf1f7"
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={10}
                  width={54}
                  tickFormatter={(value) =>
                    compactMoney.format(
                      Number(value),
                    )
                  }
                />
                <Tooltip
                  formatter={(value, name) => [
                    money.format(Number(value)),
                    name === 'partialPayments'
                      ? 'Abonos parciales detectados'
                      : 'Cierres por desaparición',
                  ]}
                />
                <Bar
                  dataKey="partialPayments"
                  radius={[5, 5, 0, 0]}
                  name="partialPayments"
                >
                  {chartSeries.map((item) => (
                    <Cell
                      key={`partial-${item.month}`}
                      fill="#2563eb"
                      fillOpacity={
                        selectedMonth === null ||
                        item.month === selectedMonth
                          ? 1
                          : 0.22
                      }
                    />
                  ))}
                </Bar>
                <Bar
                  dataKey="disappearances"
                  radius={[5, 5, 0, 0]}
                  name="disappearances"
                >
                  {chartSeries.map((item) => (
                    <Cell
                      key={`disappearance-${item.month}`}
                      fill="#10b981"
                      fillOpacity={
                        selectedMonth === null ||
                        item.month === selectedMonth
                          ? 1
                          : 0.22
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="bi-chart-legend">
              <span>
                <i className="bi-chart-legend__blue" />
                Abonos parciales detectados
              </span>
              <span>
                <i className="bi-chart-legend__green" />
                Cierres por desaparición
              </span>
              <em>
                El mes seleccionado se resalta; los demás
                permanecen visibles.
              </em>
            </div>
            </>
          ) : (
            <div className="bi-empty-chart">
              <span>▥</span>
              <strong>Sin movimientos</strong>
              <small>{historico.motivo}</small>
            </div>
          )}
        </Panel>

        <Panel
          title="Estado operativo"
          subtitle="Incidencias y próximos vencimientos"
          className="bi-panel--operations"
          action={
            <button
              type="button"
              className="bi-link"
              onClick={() =>
                onNavigate?.('reportes')
              }
            >
              Ver incidencias →
            </button>
          }
        >
          <div className="bi-operation-grid">
            <OperationCard
              label="Vence 0–7 días"
              value={money.format(
                operacion.vence7Dias,
              )}
              detail={`${operacion.documentosVence7Dias} documentos`}
              tone="amber"
              onClick={navigateReports}
            />

            <OperationCard
              label="Vence 8–30 días"
              value={money.format(
                operacion.vence8a30Dias,
              )}
              detail={`${operacion.documentosVence8a30Dias} documentos`}
              tone="orange"
              onClick={navigateReports}
            />

            <OperationCard
              label="Clientes sin política"
              value={integer.format(
                operacion.clientesSinPolitica,
              )}
              detail={`${operacion.documentosCreditoPendiente} docs. pendientes`}
              tone="violet"
              onClick={() =>
                onNavigate?.('creditos')
              }
            />

            <OperationCard
              label="Anulados no encontrados"
              value={integer.format(
                operacion.anuladosNoEncontrados,
              )}
              detail={`${calidadDatos.coincidenciaAnulaciones.toFixed(1)}% coincidencia`}
              tone="red"
              onClick={() =>
                onNavigate?.('anulados')
              }
            />

            <OperationCard
              label="Promesas vencidas"
              value={integer.format(
                operacion.promesasVencidas,
              )}
              detail="Compromisos pendientes"
              tone="amber"
              onClick={() =>
                onNavigate?.('gestion')
              }
            />

            <OperationCard
              label="Calidad del dato"
              value={calidadDatos.estado}
              detail={`${calidadDatos.documentosEvaluados} docs. evaluados`}
              tone="teal"
            />
          </div>
        </Panel>

        <Panel
          title="Top clientes por saldo"
          subtitle="Concentración del saldo pendiente"
          className="bi-panel--clients"
          action={
            <button
              type="button"
              className="bi-link"
              onClick={navigateReports}
            >
              Ver detalle →
            </button>
          }
        >
          <div className="bi-ranking">
            {topClientes
              .slice(0, 5)
              .map((client, index) => (
                <div
                  key={`${client.cliente}-${index}`}
                >
                  <span>{index + 1}</span>
                  <div>
                    <strong>{client.cliente}</strong>
                    <small>
                      {client.porcentajeVencido.toFixed(1)}%
                      vencido
                    </small>
                  </div>
                  <b>
                    {money.format(client.saldo)}
                  </b>
                  <i
                    style={{
                      width: `${Math.min(
                        100,
                        (
                          client.saldo /
                          Math.max(
                            topClientes[0]?.saldo ||
                              1,
                            1,
                          )
                        ) * 100,
                      )}%`,
                    }}
                  />
                </div>
              ))}
          </div>
        </Panel>

        <Panel
          title="Cartera por vendedor"
          subtitle="Participación del saldo pendiente"
          className="bi-panel--sellers"
        >
          <div className="bi-seller-layout">
            <div className="bi-donut">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <PieChart>
                  <Pie
                    data={carteraPorVendedor.slice(
                      0,
                      5,
                    )}
                    dataKey="saldo"
                    nameKey="vendedor"
                    innerRadius={45}
                    outerRadius={66}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {carteraPorVendedor
                      .slice(0, 5)
                      .map((seller, index) => (
                        <Cell
                          key={seller.vendedor}
                          fill={
                            CHART_COLORS[index]
                          }
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

              <div className="bi-donut__center">
                <small>Total</small>
                <strong>
                  {compactMoney.format(sellerTotal)}
                </strong>
              </div>
            </div>

            <div className="bi-seller-list">
              {carteraPorVendedor
                .slice(0, 5)
                .map((seller, index) => (
                  <div key={seller.vendedor}>
                    <i
                      style={{
                        background:
                          CHART_COLORS[index],
                      }}
                    />
                    <span title={seller.vendedor}>
                      {seller.vendedor}
                    </span>
                    <strong>
                      {sellerTotal > 0
                        ? (
                            (
                              seller.saldo /
                              sellerTotal
                            ) * 100
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
          className="bi-panel--critical"
          action={
            <button
              type="button"
              className="bi-link"
              onClick={navigateReports}
            >
              Reporte →
            </button>
          }
        >
          <div className="bi-critical-list">
            {moraCritica
              .slice(0, 5)
              .map((debtor, index) => (
                <div
                  key={`${debtor.cliente}-${index}`}
                >
                  <span>{index + 1}</span>
                  <div>
                    <strong>{debtor.cliente}</strong>
                    <small>
                      {debtor.documentos} documentos
                    </small>
                  </div>
                  <em>{debtor.maxDias} días</em>
                  <b>
                    {money.format(debtor.mora90)}
                  </b>
                </div>
              ))}
          </div>
        </Panel>

        <Panel
          title="Alertas críticas"
          subtitle="Acciones prioritarias"
          className="bi-panel--alerts"
          action={
            <button
              type="button"
              className="bi-link"
              onClick={() =>
                onNavigate?.('reportes')
              }
            >
              Ver todas →
            </button>
          }
        >
          <div className="bi-alert-list">
            {alertas.slice(0, 5).map((alert) => (
              <button
                key={alert.key}
                type="button"
                onClick={() => {
                  const target =
                    alert.target.toLowerCase() as
                      | 'reportes'
                      | 'creditos'
                      | 'anulados'
                      | 'gestion';

                  onNavigate?.(target);
                }}
              >
                <i
                  className={`bi-alert-dot bi-alert-dot--${alert.severity.toLowerCase()}`}
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
                <em>›</em>
              </button>
            ))}
          </div>
        </Panel>
      </section>

      <footer className="bi-footer">
        <span>
          ◉ Cobros detectados:{' '}
          {money.format(
            cobrosMes.totalDetectado,
          )}
        </span>

        <span>
          {descuadresDetectados > 0
            ? `⚠ ${descuadresDetectados} descuadres activos`
            : '● Sin descuadres activos'}
        </span>

        <span>
          Periodo: {periodo.label}
        </span>

        <span>
          Base conectada · LOCAL
        </span>
      </footer>

      {loading && (
        <div className="bi-loading-overlay">
          <div className="bi-loader" />
        </div>
      )}
    </div>
  );
}
