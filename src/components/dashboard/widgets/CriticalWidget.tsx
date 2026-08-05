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

export function CriticalWidget({
  moraCritica,
  onOpenReports,
}: {
  moraCritica:
    DashboardExecutiveStats["moraCritica"];
  onOpenReports: () => void;
}) {
  return (
    <DashboardPanel
      title="Mora crítica"
      subtitle="Clientes con más de 90 días"
      className="bi-panel--critical"
      action={
        <button
          type="button"
          className="bi-link"
          onClick={onOpenReports}
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
                <strong>
                  {debtor.cliente}
                </strong>
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
    </DashboardPanel>
  );
}
