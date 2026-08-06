import type { GestionChildrenProps } from "../types";

export function GestionFiltersPanel({
  children,
}: GestionChildrenProps) {
  return (
    <div className="gestion-filters-panel">
      {children}
    </div>
  );
}
