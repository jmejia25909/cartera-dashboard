import { useMemo } from 'react';
import type { Documento } from '../types';
import { getAgingLabel, getDocAmount } from '../utils';

export interface DocumentFilterOptions {
  selectedCliente: string;
  selectedVendedor: string;
  filtroCentroCosto: string;
  filtroAging: string;
  searchDocumentos: string;
  soloPendientes: boolean;
}

export const useDocumentFilters = (
  documentos: Documento[],
  options: DocumentFilterOptions
): Documento[] => {
  const {
    selectedCliente,
    selectedVendedor,
    filtroCentroCosto,
    filtroAging,
    searchDocumentos,
    soloPendientes,
  } = options;

  return useMemo(() => {
    const normalizedSearch = searchDocumentos.trim().toLowerCase();

    return documentos.filter((documento) => {
      const clienteNombre = documento.razon_social || documento.cliente || '';
      const matchCliente =
        !selectedCliente ||
        documento.cliente === selectedCliente ||
        documento.razon_social === selectedCliente;
      const matchVendedor =
        !selectedVendedor || documento.vendedor === selectedVendedor;
      const matchCentro =
        filtroCentroCosto === 'Todos' ||
        documento.centro_costo === filtroCentroCosto;
      const matchPendiente = !soloPendientes || getDocAmount(documento) > 0;

      let matchAging = true;
      const dias = documento.dias_vencidos ?? 0;

      if (filtroAging === 'Vencidos') {
        matchAging = dias > 0;
      } else if (
        filtroAging === 'Por vencer' ||
        filtroAging === 'Por Vencer'
      ) {
        matchAging = dias <= 0;
      } else if (filtroAging === '+120') {
        matchAging = dias > 120;
      } else if (filtroAging !== 'Todos') {
        matchAging = getAgingLabel(documento) === filtroAging;
      }

      const matchSearch =
        !normalizedSearch ||
        clienteNombre.toLowerCase().includes(normalizedSearch) ||
        (documento.cliente || '').toLowerCase().includes(normalizedSearch) ||
        (documento.documento || documento.numero || '')
          .toLowerCase()
          .includes(normalizedSearch);

      return (
        matchCliente &&
        matchVendedor &&
        matchCentro &&
        matchAging &&
        matchSearch &&
        matchPendiente
      );
    });
  }, [
    documentos,
    filtroAging,
    filtroCentroCosto,
    searchDocumentos,
    selectedCliente,
    selectedVendedor,
    soloPendientes,
  ]);
};
