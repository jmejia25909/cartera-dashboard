import type { ReactNode } from "react";

export function DashboardPanel({
  title,
  subtitle,
  children,
  action,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`bi-panel ${className}`}>
      <header className="bi-panel__header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>

        {action || (
          <span className="bi-panel__menu">•••</span>
        )}
      </header>

      <div className="bi-panel__body">
        {children}
      </div>
    </section>
  );
}
