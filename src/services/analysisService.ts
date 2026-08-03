import type { Documento } from '../types';

export interface AnalisisRiesgoCliente {
  razon_social: string;
  total_deuda: number;
  deuda_vencida: number;
  max_dias_mora: number;
  score: number;
}

export const buildAnalisisRiesgo = (
  documentos: readonly Documento[]
): AnalisisRiesgoCliente[] => {
  const clienteMap = new Map<string, Omit<AnalisisRiesgoCliente, 'score'>>();

  documentos.forEach((documento) => {
    const cliente = documento.razon_social || documento.cliente || 'Sin cliente';
    const saldo = Number(documento.total ?? documento.saldo ?? 0);
    const dias = Number(documento.dias_vencidos ?? 0);

    const actual = clienteMap.get(cliente) ?? {
      razon_social: cliente,
      total_deuda: 0,
      deuda_vencida: 0,
      max_dias_mora: 0,
    };

    actual.total_deuda += saldo;

    if (dias > 0) {
      actual.deuda_vencida += saldo;
    }

    actual.max_dias_mora = Math.max(actual.max_dias_mora, dias);
    clienteMap.set(cliente, actual);
  });

  return Array.from(clienteMap.values())
    .map((cliente) => {
      const ratio = cliente.total_deuda > 0
        ? (cliente.deuda_vencida / cliente.total_deuda) * 100
        : 0;
      const mora = Math.min(100, (cliente.max_dias_mora / 180) * 100);
      const score = Math.max(0, Math.round(100 - (mora * 0.6 + ratio * 0.4)));

      return {
        ...cliente,
        score,
      };
    })
    .sort((a, b) => b.deuda_vencida - a.deuda_vencida);
};
