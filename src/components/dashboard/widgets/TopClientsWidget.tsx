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

export function TopClientsWidget({
  topClientes,
  onOpenReports,
}: {
  topClientes:
    DashboardExecutiveStats["topClientes"];
  onOpenReports: () => void;
}) {
  return (
    <DashboardPanel
      title="Top clientes por saldo"
      subtitle="Concentración del saldo pendiente"
      className="bi-panel--clients"
      action={
        <button
          type="button"
          className="bi-link"
          onClick={onOpenReports}
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
                <strong>
                  {client.cliente}
                </strong>
                <small>
                  {client.porcentajeVencido.toFixed(
                    1,
                  )}
                  % vencido
                </small>
              </div>

              <b>
                {money.format(client.saldo)}
              </b>

              <i
                style={{
                  width: `${Math.min(
                    100,
                    (client.saldo /
                      Math.max(
                        topClientes[0]?.saldo || 1,
                        1,
                      )) *
                      100,
                  )}%`,
                }}
              />
            </div>
          ))}
      </div>
    </DashboardPanel>
  );
}
