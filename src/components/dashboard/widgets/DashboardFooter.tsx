import type {
  DashboardExecutiveStats,
} from "../../../types/dashboardExecutive";

const money = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

export function DashboardFooter({
  cobrosMes,
  descuadresDetectados,
  periodLabel,
}: {
  cobrosMes:
    DashboardExecutiveStats["cobrosMes"];
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
