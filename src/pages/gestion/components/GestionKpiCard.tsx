import type { GestionKpiCardProps } from "../types";

export function GestionKpiCard({
  label,
  value,
  tone = "primary",
  negative = false,
}: GestionKpiCardProps) {
  return (
    <article
      className={
        `kpi-card gestion-kpi-card ` +
        `gestion-kpi-card--${tone}`
      }
    >
      <div className="kpi-title gestion-kpi-title">
        {label}
      </div>

      <div
        className={
          `kpi-value gestion-kpi-value` +
          (negative ? " kpi-negative" : "")
        }
      >
        {value}
      </div>
    </article>
  );
}
