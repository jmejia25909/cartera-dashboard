import type { Documento } from '../types';
import { getDocAmount } from '../utils';

export interface EficienciaCobranza {
  totalEmitido: number;
  totalCobrado: number;
  totalPendiente: number;
  porcentajeCobrado: number;
  dsoReal: number;
}

export interface VencimientosProximos {
  dias7: Documento[];
  monto7: number;
  dias30: Documento[];
  monto30: number;
  docs7: number;
  docs30: number;
}

export interface RetencionDetalle {
  documento: string;
  cliente: string;
  monto: number;
  total: number;
}

export interface AnalisisRetenciones {
  totalRetenido: number;
  cantidadDocs: number;
  promedioPorDoc: number;
  detalles: RetencionDetalle[];
}

export interface AnalisisVendedor {
  vendedor: string;
  totalFacturado: number;
  totalCobrado: number;
  totalPendiente: number;
  totalVencido: number;
  documentos: number;
  cantidadClientes: number;
  porcentajeMorosidad: number;
  porcentajeCobrado: number;
}

export interface DeudorCronico {
  cliente: string;
  razon_social: string;
  totalDeuda: number;
  totalVencido: number;
  documentosVencidos: number;
  dias_promedio: number;
  vendedor: string;
}

export const getDocumentosVencidos = (
  documentos: readonly Documento[]
): Documento[] => documentos.filter(
  (documento) => (documento.dias_vencidos ?? 0) > 0 && getDocAmount(documento) > 0
);

export const getClientesConVencidos = (
  documentos: readonly Documento[]
): string[] => Array.from(
  new Set(
    getDocumentosVencidos(documentos)
      .map((documento) => documento.cliente)
      .filter(Boolean)
  )
);

export const getResumenVencidos = (
  documentos: readonly Documento[]
): Array<{ cliente: string; total: number }> => {
  const resumen = new Map<string, number>();

  documentos.forEach((documento) => {
    const cliente = documento.razon_social || documento.cliente || 'Sin cliente';
    resumen.set(cliente, (resumen.get(cliente) ?? 0) + getDocAmount(documento));
  });

  return Array.from(resumen.entries())
    .map(([cliente, total]) => ({ cliente, total }))
    .sort((a, b) => b.total - a.total);
};

export const calculateEficienciaCobranza = (
  documentos: readonly Documento[]
): EficienciaCobranza => {
  const totalEmitido = documentos.reduce(
    (sum, documento) => sum + Number(documento.valor_documento ?? 0),
    0
  );
  const totalCobrado = documentos.reduce(
    (sum, documento) => sum + (
      Number(documento.valor_documento ?? 0) - Number(documento.total ?? 0)
    ),
    0
  );
  const totalPendiente = documentos.reduce(
    (sum, documento) => sum + Number(documento.total ?? 0),
    0
  );

  return {
    totalEmitido,
    totalCobrado,
    totalPendiente,
    porcentajeCobrado: totalEmitido > 0 ? (totalCobrado / totalEmitido) * 100 : 0,
    dsoReal: totalEmitido > 0 ? Math.round((totalPendiente / totalEmitido) * 90) : 0,
  };
};

export const calculateVencimientosProximos = (
  documentos: readonly Documento[],
  fechaBase: Date = new Date()
): VencimientosProximos => {
  const inicio = new Date(fechaBase);

  const en7Dias = new Date(inicio.getTime() + 7 * 24 * 60 * 60 * 1000);
  const en30Dias = new Date(inicio.getTime() + 30 * 24 * 60 * 60 * 1000);

  const pendientes = documentos.filter((documento) => {
    if (!documento.fecha_vencimiento || Number(documento.total ?? 0) <= 0) {
      return false;
    }

    const vencimiento = new Date(documento.fecha_vencimiento);
    return !Number.isNaN(vencimiento.getTime()) && vencimiento >= inicio;
  });

  const dias7 = pendientes.filter(
    (documento) => new Date(documento.fecha_vencimiento) <= en7Dias
  );
  const dias30 = pendientes.filter(
    (documento) => new Date(documento.fecha_vencimiento) <= en30Dias
  );

  return {
    dias7,
    monto7: dias7.reduce((sum, documento) => sum + Number(documento.total ?? 0), 0),
    dias30,
    monto30: dias30.reduce((sum, documento) => sum + Number(documento.total ?? 0), 0),
    docs7: dias7.length,
    docs30: dias30.length,
  };
};

export const calculateAnalisisRetenciones = (
  documentos: readonly Documento[]
): AnalisisRetenciones => {
  const documentosConRetencion = documentos.filter(
    (documento) => Number(documento.retenciones ?? 0) > 0
  );
  const totalRetenido = documentosConRetencion.reduce(
    (sum, documento) => sum + Number(documento.retenciones ?? 0),
    0
  );

  return {
    totalRetenido,
    cantidadDocs: documentosConRetencion.length,
    promedioPorDoc: documentosConRetencion.length > 0
      ? totalRetenido / documentosConRetencion.length
      : 0,
    detalles: documentosConRetencion.map((documento) => ({
      documento: documento.documento,
      cliente: documento.razon_social || documento.cliente,
      monto: Number(documento.retenciones ?? 0),
      total: Number(documento.total ?? 0),
    })),
  };
};

export const calculateAnalisisPorVendedor = (
  documentos: readonly Documento[]
): AnalisisVendedor[] => {
  const vendedorMap = new Map<string, {
    vendedor: string;
    totalFacturado: number;
    totalCobrado: number;
    totalPendiente: number;
    totalVencido: number;
    documentos: number;
    clientes: Set<string>;
  }>();

  documentos.forEach((documento) => {
    const vendedor = documento.vendedor || 'Sin Vendedor';
    const actual = vendedorMap.get(vendedor) ?? {
      vendedor,
      totalFacturado: 0,
      totalCobrado: 0,
      totalPendiente: 0,
      totalVencido: 0,
      documentos: 0,
      clientes: new Set<string>(),
    };

    const valorDocumento = Number(documento.valor_documento ?? 0);
    const pendiente = Number(documento.total ?? 0);

    actual.totalFacturado += valorDocumento;
    actual.totalCobrado += valorDocumento - pendiente;
    actual.totalPendiente += pendiente;
    actual.documentos += 1;
    actual.clientes.add(documento.cliente);

    if ((documento.dias_vencidos ?? 0) > 0) {
      actual.totalVencido += pendiente;
    }

    vendedorMap.set(vendedor, actual);
  });

  return Array.from(vendedorMap.values())
    .map((vendedor) => ({
      vendedor: vendedor.vendedor,
      totalFacturado: vendedor.totalFacturado,
      totalCobrado: vendedor.totalCobrado,
      totalPendiente: vendedor.totalPendiente,
      totalVencido: vendedor.totalVencido,
      documentos: vendedor.documentos,
      cantidadClientes: vendedor.clientes.size,
      porcentajeMorosidad: vendedor.totalPendiente > 0
        ? (vendedor.totalVencido / vendedor.totalPendiente) * 100
        : 0,
      porcentajeCobrado: vendedor.totalFacturado > 0
        ? (vendedor.totalCobrado / vendedor.totalFacturado) * 100
        : 0,
    }))
    .sort((a, b) => b.totalPendiente - a.totalPendiente);
};

export const calculateDeudoresCronicos = (
  documentos: readonly Documento[],
  diasMinimos = 90,
  limite = 20
): DeudorCronico[] => {
  const clienteMap = new Map<string, DeudorCronico>();

  documentos.forEach((documento) => {
    const dias = Number(documento.dias_vencidos ?? 0);

    if (dias <= 0) {
      return;
    }

    const clave = documento.cliente || documento.razon_social || 'Sin cliente';
    const actual = clienteMap.get(clave) ?? {
      cliente: clave,
      razon_social: documento.razon_social || documento.cliente || 'Sin cliente',
      totalDeuda: 0,
      totalVencido: 0,
      documentosVencidos: 0,
      dias_promedio: 0,
      vendedor: documento.vendedor || 'N/A',
    };

    const saldo = Number(documento.total ?? 0);
    actual.totalDeuda += saldo;
    actual.totalVencido += saldo;
    actual.documentosVencidos += 1;

    if (dias > diasMinimos) {
      actual.dias_promedio = Math.max(actual.dias_promedio, dias);
    }

    clienteMap.set(clave, actual);
  });

  return Array.from(clienteMap.values())
    .filter((cliente) => cliente.dias_promedio >= diasMinimos)
    .sort((a, b) => b.totalVencido - a.totalVencido)
    .slice(0, limite);
};
