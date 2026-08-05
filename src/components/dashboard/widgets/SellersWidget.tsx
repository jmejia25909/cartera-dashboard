import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type {
  DashboardExecutiveStats,
} from "../../../types/dashboardExecutive";
import {
  DASHBOARD_CHART_COLORS,
} from "../dashboard.constants";
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

export function SellersWidget({
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
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
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
                      fill={
                        DASHBOARD_CHART_COLORS[
                          index
                        ]
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
                      DASHBOARD_CHART_COLORS[
                        index
                      ],
                  }}
                />

                <span title={seller.vendedor}>
                  {seller.vendedor}
                </span>

                <strong>
                  {sellerTotal > 0
                    ? (
                        (seller.saldo /
                          sellerTotal) *
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
