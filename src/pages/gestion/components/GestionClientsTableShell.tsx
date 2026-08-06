import type { ReactNode } from "react";

interface GestionClientsTableShellProps {
  children: ReactNode;
}

export function GestionClientsTableShell({
  children,
}: GestionClientsTableShellProps) {
  return (
    <div className="table-wrapper gestion-table-wrapper">
      {children}
    </div>
  );
}
