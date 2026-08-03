import type { Documento } from '../types';
import { toNumber } from './number';

export const getDocumentAmount = (documento: Documento): number =>
  toNumber(
    documento.total ??
      documento.saldo ??
      documento.valor_documento ??
      0,
  );

// Alias temporal para evitar cambios funcionales durante el refactor.
export const getDocAmount = getDocumentAmount;

export const getAgingLabel = (documento: Documento): string => {
  const dias = documento.dias_vencidos ?? 0;

  if (dias <= 0) return 'Por Vencer';
  if (dias > 360) return '>360';
  if (dias > 330) return '360';
  if (dias > 300) return '330';
  if (dias > 270) return '300';
  if (dias > 240) return '270';
  if (dias > 210) return '240';
  if (dias > 180) return '210';
  if (dias > 150) return '180';
  if (dias > 120) return '150';
  if (dias > 90) return '120';
  if (dias > 60) return '90';
  if (dias > 30) return '60';

  return '30';
};
