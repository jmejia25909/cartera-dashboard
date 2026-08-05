import type {
  DashboardExecutiveStats,
} from "../../../types/dashboardExecutive";
import type {
  DashboardNavigationTarget,
} from "../../../types/dashboardNavigation";
import {
  DashboardPanel,
} from "./DashboardPanel";

const money = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const integer = new Intl.NumberFormat("es-EC");

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
    | "amber"
    | "orange"
    | "violet"
    | "red"
    | "teal";
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
        className={
          `bi-operation__icon ` +
          `bi-operation__icon--${tone}`
        }
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

export function OperationsWidget({
  operacion,
  calidadDatos,
  onNavigate,
  onOpenReports,
}: {
  operacion: DashboardExecutiveStats["operacion"];
  calidadDatos:
    DashboardExecutiveStats["calidadDatos"];
  onNavigate?: (
    target: DashboardNavigationTarget,
  ) => void;
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
          onClick={() =>
            onNavigate?.("reportes")
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
          detail={
            `${operacion.documentosVence7Dias} ` +
            "documentos"
          }
          tone="amber"
          onClick={navigateReports}
        />

        <OperationCard
          label="Vence 8–30 días"
          value={money.format(
            operacion.vence8a30Dias,
          )}
          detail={
            `${operacion.documentosVence8a30Dias} ` +
            "documentos"
          }
          tone="orange"
          onClick={navigateReports}
        />

        <OperationCard
          label="Clientes sin política"
          value={integer.format(
            operacion.clientesSinPolitica,
          )}
          detail={
            `${operacion.documentosCreditoPendiente} ` +
            "docs. pendientes"
          }
          tone="violet"
          onClick={() =>
            onNavigate?.("creditos")
          }
        />

        <OperationCard
          label="Anulados no encontrados"
          value={integer.format(
            operacion.anuladosNoEncontrados,
          )}
          detail={
            `${calidadDatos.coincidenciaAnulaciones.toFixed(1)}% ` +
            "coincidencia"
          }
          tone="red"
          onClick={() =>
            onNavigate?.("anulados")
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
            onNavigate?.("gestion")
          }
        />

        <OperationCard
          label="Calidad del dato"
          value={calidadDatos.estado}
          detail={
            `${calidadDatos.documentosEvaluados} ` +
            "docs. evaluados"
          }
          tone="teal"
        />
      </div>
    </DashboardPanel>
  );
}
