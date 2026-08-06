import type { GestionChildrenProps } from "../types";

export function GestionClientsPanel({
  children,
}: GestionChildrenProps) {
  return (
    <section className="card gestion-clients-panel">
      {children}
    </section>
  );
}
