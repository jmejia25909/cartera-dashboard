import type { GestionChildrenProps } from "../types";
import {
  GestionSectionTitle,
} from "./GestionSectionTitle";

export function GestionKpisPanel({
  children,
}: GestionChildrenProps) {
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
}: GestionChildrenProps) {
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
