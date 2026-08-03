import type { SeveridadNormalizada } from '../types';

export const normalizeSeverity = (raw?: string): SeveridadNormalizada => {
  const value = (raw ?? '').trim().toLowerCase();

  if (
    value === 'critico' ||
    value === 'crítico' ||
    value === 'critica' ||
    value === 'crítica' ||
    value === 'critical'
  ) {
    return { label: 'Crítico', level: 'critical' };
  }

  if (value === 'alta' || value === 'alto' || value === 'high') {
    return { label: 'Alta', level: 'high' };
  }

  if (value === 'media' || value === 'medio' || value === 'medium') {
    return { label: 'Media', level: 'medium' };
  }

  if (value === 'baja' || value === 'bajo' || value === 'low') {
    return { label: 'Baja', level: 'low' };
  }

  if (!value) {
    return { label: 'Sin datos', level: 'normal' };
  }

  return {
    label: value.charAt(0).toUpperCase() + value.slice(1),
    level: 'normal',
  };
};

// Alias temporal para conservar las llamadas existentes.
export const normalizeSeveridad = normalizeSeverity;
