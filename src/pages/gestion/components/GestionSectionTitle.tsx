import type { GestionSectionTitleProps } from "../types";

export function GestionSectionTitle({
  icon,
  title,
  subtitle,
  className = "",
}: GestionSectionTitleProps) {
  return (
    <div
      className={
        `gestion-panel-title ${className}`.trim()
      }
    >
      <span className="gestion-panel-title__icon">
        {icon}
      </span>

      <span>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
    </div>
  );
}
