import type { ReactNode } from "react";

interface GestionClientsTableHeaderProps {
  children: ReactNode;
}

export function GestionClientsTableHeader({
  children,
}: GestionClientsTableHeaderProps) {
  return <thead>{children}</thead>;
}
