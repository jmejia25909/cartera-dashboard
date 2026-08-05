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

export function AgingWidget({
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
                    DASHBOARD_CHART_COLORS[index],
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
                {item.porcentaje.toFixed(1)}% de la cartera
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
    </DashboardPanel>
  );
}
