import type { Documento } from '../types';
import { getDocAmount } from '../utils';

export function createDemoData() {
  const today = new Date();
  const formatDate = (offsetDays: number) => {
    const d = new Date(today);
    d.setDate(today.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };

  const docs: Documento[] = [
    { id: 1, documento: 'F001-0001', cliente: 'C001', razon_social: 'Constructora ABC', vendedor: 'Luis', fecha_emision: formatDate(-30), fecha_vencimiento: formatDate(3), total: 285000, saldo: 220000, valor_documento: 285000, dias_vencidos: 0, retenciones: 0, centro_costo: 'Bogotá' },
    { id: 2, documento: 'F001-0002', cliente: 'C002', razon_social: 'Distribuidora Delta', vendedor: 'Ana', fecha_emision: formatDate(-45), fecha_vencimiento: formatDate(-7), total: 142500, saldo: 142500, valor_documento: 142500, dias_vencidos: 14, retenciones: 0, centro_costo: 'Medellín' },
    { id: 3, documento: 'F001-0003', cliente: 'C003', razon_social: 'Grupo Norte', vendedor: 'Carlos', fecha_emision: formatDate(-60), fecha_vencimiento: formatDate(12), total: 98000, saldo: 78000, valor_documento: 98000, dias_vencidos: 0, retenciones: 25000, centro_costo: 'Cali' },
    { id: 4, documento: 'F001-0004', cliente: 'C004', razon_social: 'Inversiones Prisma', vendedor: 'Marta', fecha_emision: formatDate(-90), fecha_vencimiento: formatDate(-22), total: 310000, saldo: 310000, valor_documento: 310000, dias_vencidos: 45, retenciones: 0, centro_costo: 'Bogotá' },
  ];

  const totalSaldo = docs.reduce((sum, d) => sum + getDocAmount(d), 0);
  const totalCobrado = docs.reduce((sum, d) => sum + Math.max(0, (d.valor_documento || 0) - (d.total || 0)), 0);
  const vencidaSaldo = docs.filter(d => (d.dias_vencidos || 0) > 0).reduce((sum, d) => sum + getDocAmount(d), 0);

  return {
    docs,
    stats: {
      fechaCorte: today.toISOString(),
      totalSaldo,
      totalCobrado,
      vencidaSaldo,
      percentVencida: totalSaldo > 0 ? (vencidaSaldo / totalSaldo) * 100 : 0,
      mora90Saldo: vencidaSaldo * 0.6,
      percentMora90: 18,
      docsPendientes: docs.length,
      clientesConSaldo: 4,
      aging: { porVencer: 98000, d30: 0, d60: 0, d90: 0, d120: 0, d120p: 0 },
      npl: 28,
      dso: 34,
      recuperacionMesActual: 540000,
      metaMensual: 900000,
      percentMetaCumplida: 60,
      tasaCumplimientoPromesas: 82,
    },
    clientes: [
      { cliente: 'C001', razon_social: 'Constructora ABC' },
      { cliente: 'C002', razon_social: 'Distribuidora Delta' },
      { cliente: 'C003', razon_social: 'Grupo Norte' },
      { cliente: 'C004', razon_social: 'Inversiones Prisma' },
    ],
    vendedores: ['Luis', 'Ana', 'Carlos', 'Marta'],
    topClientes: [
      { cliente: 'C004', razon_social: 'Inversiones Prisma', total: 310000 },
      { cliente: 'C001', razon_social: 'Constructora ABC', total: 220000 },
      { cliente: 'C002', razon_social: 'Distribuidora Delta', total: 142500 },
    ],
    alertas: [
      { cliente: 'Inversiones Prisma', documento: 'F001-0004', monto: 310000, diasVencidos: 45, severidad: 'Alta' },
      { cliente: 'Distribuidora Delta', documento: 'F001-0002', monto: 142500, diasVencidos: 14, severidad: 'Media' },
    ],
    tendencias: [
      { mes: 'Ene', valor: 520000 },
      { mes: 'Feb', valor: 610000 },
      { mes: 'Mar', valor: 780000 },
      { mes: 'Abr', valor: 860000 },
    ],
    abonos: [
      { id: 1, cliente: 'Constructora ABC', fecha: today.toISOString(), monto: 65000 },
    ],
    gestiones: [
      { id: 1001, cliente: 'C001', razon_social: 'Constructora ABC', tipo: 'Llamada', resultado: 'Contactado', observacion: 'Se acordó pago parcial', fecha: today.toISOString() },
    ],
    analisisRiesgo: [
      { cliente: 'C004', razon_social: 'Inversiones Prisma', total_deuda: 310000, deuda_vencida: 310000, score: 38 },
      { cliente: 'C002', razon_social: 'Distribuidora Delta', total_deuda: 142500, deuda_vencida: 142500, score: 57 },
    ],
  };
}

