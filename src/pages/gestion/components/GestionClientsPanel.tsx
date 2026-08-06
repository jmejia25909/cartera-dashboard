import type { ReactNode } from "react";

interface GestionClientsPanelProps {
  children: ReactNode;
}

export function GestionClientsPanel({
  children,
}: GestionClientsPanelProps) {
  return (
    <section className="card gestion-clients-panel">
      {children}
    </section>
  );
}
