import type { ReactNode } from "react";
import {
  GestionSectionTitle,
} from "./GestionSectionTitle";

interface GestionPanelProps {
  children: ReactNode;
}

export function GestionKpisPanel({
  children,
}: GestionPanelProps) {
  return (
    <section className="card gestion-kpi-panel">
      <GestionSectionTitle
        icon="▦"
        title="Resumen de gestión"
        subtitle="Indicadores operativos de cobranza"
      />
      {children}
    </section>
  );
}

export function GestionToolbarPanel({
  children,
}: GestionPanelProps) {
  return (
    <section className="card gestion-toolbar-panel">
      <GestionSectionTitle
        icon="⌕"
        title="Filtros y acciones"
        subtitle="Consulta, reportes y gestión masiva"
      />
      {children}
    </section>
  );
}
