import { useCallback, useMemo } from 'react';

export interface PromesaFilterable {
  fecha_promesa?: string;
  monto_promesa?: number;
  [key: string]: unknown;
}

export interface PromiseFilterResult<T extends PromesaFilterable> {
  promesasFiltradas: T[];
  totalPromesas: number;
  montoTotal: number;
  vencidas: number;
  calcularDiasDiferencia: (fecha: string) => number;
}

export const usePromiseFilters = <T extends PromesaFilterable>(
  promesas: T[],
  filtroFecha: string,
  filtroMonto: string
): PromiseFilterResult<T> => {
  const hoy = useMemo(() => {
    const current = new Date();
    current.setHours(0, 0, 0, 0);
    return current;
  }, []);

  const calcularDiasDiferencia = useCallback(
    (fechaStr: string): number => {
      const [anio, mes, dia] = fechaStr.split('-').map(Number);
      const fecha = new Date(anio, mes - 1, dia, 0, 0, 0, 0);
      const diffMs = fecha.getTime() - hoy.getTime();
      return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    },
    [hoy]
  );

  const promesasFiltradas = useMemo(
    () =>
      promesas.filter((promesa) => {
        if (!promesa.fecha_promesa) return true;

        const diffDias = calcularDiasDiferencia(promesa.fecha_promesa);
        let cumpleFecha = true;

        if (filtroFecha === 'Hoy') cumpleFecha = diffDias === 0;
        else if (filtroFecha === 'Esta Semana') {
          cumpleFecha = diffDias >= 0 && diffDias <= 7;
        } else if (filtroFecha === 'Vencidas') cumpleFecha = diffDias < 0;

        const monto = promesa.monto_promesa ?? 0;
        let cumpleMonto = true;

        if (filtroMonto === 'Menor 1000') cumpleMonto = monto < 1000;
        else if (filtroMonto === '1000-5000') {
          cumpleMonto = monto >= 1000 && monto <= 5000;
        } else if (filtroMonto === 'Mayor 5000') cumpleMonto = monto > 5000;

        return cumpleFecha && cumpleMonto;
      }),
    [calcularDiasDiferencia, filtroFecha, filtroMonto, promesas]
  );

  const montoTotal = useMemo(
    () =>
      promesas.reduce(
        (total, promesa) => total + (promesa.monto_promesa ?? 0),
        0
      ),
    [promesas]
  );

  const vencidas = useMemo(
    () =>
      promesas.filter(
        (promesa) =>
          Boolean(promesa.fecha_promesa) &&
          calcularDiasDiferencia(promesa.fecha_promesa as string) < 0
      ).length,
    [calcularDiasDiferencia, promesas]
  );

  return {
    promesasFiltradas,
    totalPromesas: promesas.length,
    montoTotal,
    vencidas,
    calcularDiasDiferencia,
  };
};
