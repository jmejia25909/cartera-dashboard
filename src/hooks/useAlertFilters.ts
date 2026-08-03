import { useMemo } from 'react';
import type { Alerta } from '../types';
import { normalizeSeveridad } from '../utils';

export const useAlertFilters = (
  alertas: Alerta[],
  searchAlertas: string,
  filtroSeveridad: string
): Alerta[] =>
  useMemo(() => {
    const search = searchAlertas.trim().toLowerCase();

    return alertas.filter((alerta) => {
      const matchSearch =
        !search ||
        alerta.cliente.toLowerCase().includes(search) ||
        alerta.documento.toLowerCase().includes(search);
      const severidad = normalizeSeveridad(alerta.severidad);
      const matchSeveridad =
        filtroSeveridad === 'Todos' || severidad.label === filtroSeveridad;

      return matchSearch && matchSeveridad;
    });
  }, [alertas, filtroSeveridad, searchAlertas]);
