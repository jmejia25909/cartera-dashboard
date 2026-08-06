import type { ReactNode } from "react";

interface GestionFiltersPanelProps {
  children: ReactNode;
}

export function GestionFiltersPanel({
  children,
}: GestionFiltersPanelProps) {
  return (
    <div className="gestion-filters-panel">
      {children}
    </div>
  );
}
