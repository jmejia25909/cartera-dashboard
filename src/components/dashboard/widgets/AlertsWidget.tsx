import type {
  DashboardExecutiveStats,
} from "../../../types/dashboardExecutive";
import type {
  DashboardNavigationTarget,
} from "../../../types/dashboardNavigation";
import {
  DashboardPanel,
} from "./DashboardPanel";

const integer = new Intl.NumberFormat("es-EC");

export function AlertsWidget({
  alertas,
  onNavigate,
}: {
  alertas: DashboardExecutiveStats["alertas"];
  onNavigate?: (
    target: DashboardNavigationTarget,
  ) => void;
}) {
  return (
    <DashboardPanel
      title="Alertas críticas"
      subtitle="Acciones prioritarias"
      className="bi-panel--alerts"
      action={
        <button
          type="button"
          className="bi-link"
          onClick={() =>
            onNavigate?.("reportes")
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
                  DashboardNavigationTarget;

              onNavigate?.(target);
            }}
          >
            <i
              className={
                `bi-alert-dot ` +
                `bi-alert-dot--${alert.severity.toLowerCase()}`
              }
            />

            <span>
              <strong>{alert.label}</strong>
              <small>
                {alert.severity === "CRITICAL"
                  ? "Prioridad alta"
                  : "Requiere revisión"}
              </small>
            </span>

            <b>
              {integer.format(alert.count)}
            </b>

            <em>›</em>
          </button>
        ))}
      </div>
    </DashboardPanel>
  );
}
