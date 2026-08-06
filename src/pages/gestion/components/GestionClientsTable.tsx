import type { ReactNode } from "react";

interface GestionClientsTableProps {
  children: ReactNode;
}

export function GestionClientsTable({
  children,
}: GestionClientsTableProps) {
  return (
    <table className="data-table gestion-data-table">
      {children}
    </table>
  );
}
