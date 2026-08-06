import type { GestionChildrenProps } from "../types";

export function GestionClientsTable({
  children,
}: GestionChildrenProps) {
  return (
    <table className="data-table gestion-data-table">
      {children}
    </table>
  );
}
