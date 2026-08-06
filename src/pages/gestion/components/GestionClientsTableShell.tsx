import type { GestionChildrenProps } from "../types";

export function GestionClientsTableShell({
  children,
}: GestionChildrenProps) {
  return (
    <div className="table-wrapper gestion-table-wrapper">
      {children}
    </div>
  );
}
