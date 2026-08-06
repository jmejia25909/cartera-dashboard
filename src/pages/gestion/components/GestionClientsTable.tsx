import type { GestionChildrenProps } from "../types";

export function GestionClientsTable({
  children,
}: GestionChildrenProps) {
  return (
    <table className="gestion-data-table data-table">
      {children}
    </table>
  );
}
