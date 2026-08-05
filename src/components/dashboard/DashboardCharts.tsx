import type { ReactNode } from "react";
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
} from "recharts";
import type {
  DashboardExecutiveStats,
} from "../../types/dashboardExecutive";

export const DASHBOARD_CHART_COLORS = [
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#f97316",
  "#ef4444",
];

const money = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const compactMoney = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function DashboardPanel({
  title,
  subtitle,
  children,
  action,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
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

export function AgingPanel({
  aging,
  cartera,
}: {
  aging: DashboardExecutiveStats["aging"];
  cartera: DashboardExecutiveStats["cartera"];
}) {
  return (
    <DashboardPanel
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
          <div className="bi-aging-row" key={item.key}>
            <span>{item.label}</span>

            <div className="bi-aging-row__bar">
              <i
                style={{
                  width: `${Math.max(item.porcentaje, 1)}%`,
                  background: DASHBOARD_CHART_COLORS[index],
                }}
              />
            </div>

            <strong>{money.format(item.saldo)}</strong>
            <small>{item.porcentaje.toFixed(1)}%</small>
            <em>{item.documentos}</em>

            <div className="bi-aging-tooltip">
              <strong>{item.label}</strong>
              <span>Saldo {money.format(item.saldo)}</span>
              <span>
                {item.porcentaje.toFixed(1)}% de la cartera
              </span>
              <span>{item.documentos} documentos</span>
            </div>
          </div>
        ))}

        <div className="bi-aging-total">
          <strong>Total</strong>
          <span />
          <strong>{money.format(cartera.pendiente)}</strong>
          <strong>100%</strong>
          <strong>{cartera.documentosPendientes}</strong>
        </div>
      </div>
    </DashboardPanel>
  );
}

export function EvolutionPanel({
  historico,
  selectedMonth,
  selectedMonthLabel,
  period,
}: {
  historico: DashboardExecutiveStats["historico"];
  selectedMonth: number | null;
  selectedMonthLabel: string;
  period: DashboardExecutiveStats["periodo"];
}) {
  const chartSeries = historico.series;

  return (
    <DashboardPanel
      title="Evolución de movimientos"
      subtitle={`${period.selectedYear} · 12 meses · ${selectedMonthLabel} resaltado`}
      className="bi-panel--evolution"
      action={
        <span className="bi-period-note" title={period.note}>
          i
        </span>
      }
    >
      {historico.disponible ? (
        <>
          <ResponsiveContainer width="100%" height="100%">
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
                  compactMoney.format(Number(value))
                }
              />
              <Tooltip
                formatter={(value, name) => [
                  money.format(Number(value)),
                  name === "partialPayments"
                    ? "Abonos parciales detectados"
                    : "Cierres por desaparición",
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
    </DashboardPanel>
  );
}

export function SellersPanel({
  carteraPorVendedor,
}: {
  carteraPorVendedor:
    DashboardExecutiveStats["carteraPorVendedor"];
}) {
  const sellerTotal = carteraPorVendedor.reduce(
    (sum, seller) => sum + seller.saldo,
    0,
  );

  return (
    <DashboardPanel
      title="Cartera por vendedor"
      subtitle="Participación del saldo pendiente"
      className="bi-panel--sellers"
    >
      <div className="bi-seller-layout">
        <div className="bi-donut">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={carteraPorVendedor.slice(0, 5)}
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
                      fill={DASHBOARD_CHART_COLORS[index]}
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
            <strong>{compactMoney.format(sellerTotal)}</strong>
          </div>
        </div>

        <div className="bi-seller-list">
          {carteraPorVendedor
            .slice(0, 5)
            .map((seller, index) => (
              <div key={seller.vendedor}>
                <i
                  style={{
                    background: DASHBOARD_CHART_COLORS[index],
                  }}
                />
                <span title={seller.vendedor}>
                  {seller.vendedor}
                </span>
                <strong>
                  {sellerTotal > 0
                    ? (
                        (seller.saldo / sellerTotal) *
                        100
                      ).toFixed(1)
                    : "0.0"}
                  %
                </strong>
              </div>
            ))}
        </div>
      </div>
    </DashboardPanel>
  );
}
