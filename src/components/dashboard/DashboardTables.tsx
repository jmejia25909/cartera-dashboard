import type {
  DashboardExecutiveStats,
} from "../../types/dashboardExecutive";
import { DashboardPanel } from "./DashboardCharts";

const money = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const integer = new Intl.NumberFormat("es-EC");

type DashboardTarget =
  | "reportes"
  | "creditos"
  | "anulados"
  | "gestion";

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
  tone: "amber" | "orange" | "violet" | "red" | "teal";
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
        {tone === "red"
          ? "!"
          : tone === "teal"
            ? "◇"
            : tone === "violet"
              ? "♙"
              : "▦"}
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

export function OperationsPanel({
  operacion,
  calidadDatos,
  onNavigate,
  onOpenReports,
}: {
  operacion: DashboardExecutiveStats["operacion"];
  calidadDatos: DashboardExecutiveStats["calidadDatos"];
  onNavigate?: (target: DashboardTarget) => void;
  onOpenReports?: () => void;
}) {
  const navigateReports = () => {
    if (onNavigate) {
      onNavigate("reportes");
      return;
    }

    onOpenReports?.();
  };

  return (
    <DashboardPanel
      title="Estado operativo"
      subtitle="Incidencias y próximos vencimientos"
      className="bi-panel--operations"
      action={
        <button
          type="button"
          className="bi-link"
          onClick={() => onNavigate?.("reportes")}
        >
          Ver incidencias →
        </button>
      }
    >
      <div className="bi-operation-grid">
        <OperationCard
          label="Vence 0–7 días"
          value={money.format(operacion.vence7Dias)}
          detail={`${operacion.documentosVence7Dias} documentos`}
          tone="amber"
          onClick={navigateReports}
        />

        <OperationCard
          label="Vence 8–30 días"
          value={money.format(operacion.vence8a30Dias)}
          detail={`${operacion.documentosVence8a30Dias} documentos`}
          tone="orange"
          onClick={navigateReports}
        />

        <OperationCard
          label="Clientes sin política"
          value={integer.format(operacion.clientesSinPolitica)}
          detail={`${operacion.documentosCreditoPendiente} docs. pendientes`}
          tone="violet"
          onClick={() => onNavigate?.("creditos")}
        />

        <OperationCard
          label="Anulados no encontrados"
          value={integer.format(
            operacion.anuladosNoEncontrados,
          )}
          detail={`${calidadDatos.coincidenciaAnulaciones.toFixed(1)}% coincidencia`}
          tone="red"
          onClick={() => onNavigate?.("anulados")}
        />

        <OperationCard
          label="Promesas vencidas"
          value={integer.format(operacion.promesasVencidas)}
          detail="Compromisos pendientes"
          tone="amber"
          onClick={() => onNavigate?.("gestion")}
        />

        <OperationCard
          label="Calidad del dato"
          value={calidadDatos.estado}
          detail={`${calidadDatos.documentosEvaluados} docs. evaluados`}
          tone="teal"
        />
      </div>
    </DashboardPanel>
  );
}

export function TopClientsPanel({
  topClientes,
  onOpenReports,
}: {
  topClientes: DashboardExecutiveStats["topClientes"];
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
        {topClientes.slice(0, 5).map((client, index) => (
          <div key={`${client.cliente}-${index}`}>
            <span>{index + 1}</span>
            <div>
              <strong>{client.cliente}</strong>
              <small>
                {client.porcentajeVencido.toFixed(1)}% vencido
              </small>
            </div>
            <b>{money.format(client.saldo)}</b>
            <i
              style={{
                width: `${Math.min(
                  100,
                  (client.saldo /
                    Math.max(topClientes[0]?.saldo || 1, 1)) *
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

export function CriticalPanel({
  moraCritica,
  onOpenReports,
}: {
  moraCritica: DashboardExecutiveStats["moraCritica"];
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
        {moraCritica.slice(0, 5).map((debtor, index) => (
          <div key={`${debtor.cliente}-${index}`}>
            <span>{index + 1}</span>
            <div>
              <strong>{debtor.cliente}</strong>
              <small>{debtor.documentos} documentos</small>
            </div>
            <em>{debtor.maxDias} días</em>
            <b>{money.format(debtor.mora90)}</b>
          </div>
        ))}
      </div>
    </DashboardPanel>
  );
}

export function AlertsPanel({
  alertas,
  onNavigate,
}: {
  alertas: DashboardExecutiveStats["alertas"];
  onNavigate?: (target: DashboardTarget) => void;
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
          onClick={() => onNavigate?.("reportes")}
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
                alert.target.toLowerCase() as DashboardTarget;

              onNavigate?.(target);
            }}
          >
            <i
              className={`bi-alert-dot bi-alert-dot--${alert.severity.toLowerCase()}`}
            />
            <span>
              <strong>{alert.label}</strong>
              <small>
                {alert.severity === "CRITICAL"
                  ? "Prioridad alta"
                  : "Requiere revisión"}
              </small>
            </span>
            <b>{integer.format(alert.count)}</b>
            <em>›</em>
          </button>
        ))}
      </div>
    </DashboardPanel>
  );
}

export function DashboardFooter({
  cobrosMes,
  descuadresDetectados,
  periodLabel,
}: {
  cobrosMes: DashboardExecutiveStats["cobrosMes"];
  descuadresDetectados: number;
  periodLabel: string;
}) {
  return (
    <footer className="bi-footer">
      <span>
        ◉ Cobros detectados:{" "}
        {money.format(cobrosMes.totalDetectado)}
      </span>

      <span>
        {descuadresDetectados > 0
          ? `⚠ ${descuadresDetectados} descuadres activos`
          : "● Sin descuadres activos"}
      </span>

      <span>Periodo: {periodLabel}</span>
      <span>Base conectada · LOCAL</span>
    </footer>
  );
}
