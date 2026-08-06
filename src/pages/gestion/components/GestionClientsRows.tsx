import type { ReactNode } from "react";

interface GestionClientsRowsProps {
  children: ReactNode;
}

export function GestionClientsRows({
  children,
}: GestionClientsRowsProps) {
  return <>{children}</>;
}
