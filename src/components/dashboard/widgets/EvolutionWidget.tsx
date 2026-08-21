import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  DashboardExecutiveStats,
} from "../../../types/dashboardExecutive";
import {
  DashboardPanel,
} from "./DashboardPanel";

const money = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const compactMoney = new Intl.NumberFormat(
  "es-EC",
  {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  },
);

export function EvolutionWidget({
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
      subtitle={
        `${period.selectedYear} · 12 meses · ` +
        `${selectedMonthLabel} resaltado`
      }
      className="bi-panel--evolution"
      action={
        <span
          className="bi-period-note"
          title={period.note}
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
                  name === "partialPayments"
                    ? "Cobros"
                    : name === "otherMovements"
                      ? "Cruces"
                      : String(name),
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
                dataKey="otherMovements"
                radius={[5, 5, 0, 0]}
                name="otherMovements"
              >
                {chartSeries.map((item) => (
                  <Cell
                    key={`cross-${item.month}`}
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
              Cobros
            </span>

            <span>
              <i className="bi-chart-legend__green" />
              Cruces
            </span>

            <em>
              El mes seleccionado se resalta;
              los demás permanecen visibles.
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


