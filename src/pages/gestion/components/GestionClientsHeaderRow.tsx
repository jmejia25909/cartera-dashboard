import type { ReactNode } from "react";

interface GestionClientsHeaderRowProps {
  children: ReactNode;
}

export function GestionClientsHeaderRow({
  children,
}: GestionClientsHeaderRowProps) {
  return <tr>{children}</tr>;
}
