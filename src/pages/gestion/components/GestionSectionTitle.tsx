interface GestionSectionTitleProps {
  icon: string;
  title: string;
  subtitle: string;
  className?: string;
}

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
