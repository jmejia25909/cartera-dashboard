import type { ReactNode } from "react";

interface GestionClientsTableBodyProps {
  children: ReactNode;
}

export function GestionClientsTableBody({
  children,
}: GestionClientsTableBodyProps) {
  return <tbody>{children}</tbody>;
}
