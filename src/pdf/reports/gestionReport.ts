import type { UserOptions } from 'jspdf-autotable';
import type { PdfColor, PdfContext } from '../core/pdfTypes';
import { drawPdfHeader } from '../core/pdfHeader';
import { drawPdfMetricCards } from '../core/pdfCards';
import { loadPdfLibraries, savePdfDocument } from '../core/pdfDocument';

export interface GestionReportRow {
  cliente?: string;
  razon_social?: string;
  fecha?: string;
  tipo?: string;
  resultado?: string;
  observacion?: string;
  promesa?: unknown;
  monto_promesa?: number;
}

export interface GenerateGestionReportParams {
  gestiones: GestionReportRow[];
  alcance?: string;
  context: PdfContext;
}

const fmtMoney = (amount: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number.isFinite(amount) ? amount : 0);

const safeFilename = (value: string): string =>
  value.replace(/[^a-z0-9]/gi, '_');

const includesType = (tipo: string | undefined, expected: string): boolean =>
  (tipo || '').includes(expected);

const getResultadoColorWithDate = (
  resultado: string | undefined,
  dateIndex: number
): PdfColor => {
  const colorMap = {
    0: {
      Contactado: [187, 247, 208] as PdfColor,
      Promesa: [253, 224, 71] as PdfColor,
      NoContesta: [252, 165, 165] as PdfColor,
      Enviado: [191, 219, 255] as PdfColor,
      Default: [248, 250, 252] as PdfColor,
    },
    1: {
      Contactado: [210, 248, 225] as PdfColor,
      Promesa: [254, 235, 131] as PdfColor,
      NoContesta: [253, 195, 195] as PdfColor,
      Enviado: [212, 230, 255] as PdfColor,
      Default: [240, 245, 250] as PdfColor,
    },
  };

  const colors = colorMap[dateIndex % 2 === 0 ? 0 : 1];
  if (resultado?.includes('Contactado')) return colors.Contactado;
  if (resultado?.includes('Promesa')) return colors.Promesa;
  if (resultado?.includes('No Contesta')) return colors.NoContesta;
  if (resultado?.includes('Enviado') || resultado?.includes('Generado')) return colors.Enviado;
  return colors.Default;
};

export const generateGestionReport = async ({
  gestiones,
  alcance,
  context,
}: GenerateGestionReportParams): Promise<void> => {
  if (gestiones.length === 0) {
    throw new Error('No hay gestiones para generar el reporte.');
  }

  const { jsPDF, autoTable } = await loadPdfLibraries();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const { headerHeight, contentLeft, pageWidth, accent, text } = drawPdfHeader(doc, {
    title: 'Reporte de Gestión de Cobranza',
    context,
    detailLines: [`Alcance: ${alcance || 'General (Todos los clientes)'}`],
  });

  const totalContactos = gestiones.filter((item) =>
    ['Llamada', 'Visita'].some((tipo) => includesType(item.tipo, tipo)) ||
    item.resultado?.includes('Contactado')
  ).length;
  const totalPromesas = gestiones.filter((item) => item.promesa || item.monto_promesa).length;
  const totalPdfs = gestiones.filter((item) => includesType(item.tipo, 'PDF')).length;

  const cardsEndY = drawPdfMetricCards(doc, {
    y: headerHeight + 6,
    contentLeft,
    pageWidth,
    cards: [
      { label: 'Gestiones', value: String(gestiones.length), color: [59, 130, 246], soft: [219, 234, 254] },
      { label: 'Contactos', value: String(totalContactos), color: [14, 116, 144], soft: [204, 251, 241] },
      { label: 'Promesas', value: String(totalPromesas), color: [245, 158, 11], soft: [254, 243, 199] },
      { label: 'PDFs', value: String(totalPdfs), color: [99, 102, 241], soft: [224, 231, 255] },
    ],
  });

  const clientesMap = new Map<string, GestionReportRow[]>();
  gestiones.forEach((item) => {
    const cliente = item.razon_social || item.cliente || 'Cliente no identificado';
    const rows = clientesMap.get(cliente) ?? [];
    rows.push(item);
    clientesMap.set(cliente, rows);
  });

  const clientesOrdenados = Array.from(clientesMap.entries()).sort(([a], [b]) =>
    a.localeCompare(b, 'es', { sensitivity: 'base' })
  );

  let startY = cardsEndY + 18;

  clientesOrdenados.forEach(([cliente, clienteGestiones]) => {
    const gestionesOrdenadas = [...clienteGestiones].sort((a, b) => {
      const fechaA = a.fecha ? a.fecha.split('T')[0] : '';
      const fechaB = b.fecha ? b.fecha.split('T')[0] : '';
      return fechaB.localeCompare(fechaA);
    });

    const fechaIndexMap = new Map<string, number>();
    let fechaCounter = 0;
    gestionesOrdenadas.forEach((item) => {
      const fecha = item.fecha ? item.fecha.split('T')[0] : 'sin-fecha';
      if (!fechaIndexMap.has(fecha)) {
        fechaIndexMap.set(fecha, fechaCounter);
        fechaCounter += 1;
      }
    });

    const totalClientePromesas = gestionesOrdenadas.filter(
      (item) => item.promesa || item.monto_promesa
    ).length;
    const totalMontoPromesas = gestionesOrdenadas.reduce(
      (sum, item) => sum + (item.monto_promesa || 0),
      0
    );
    const contactosCliente = gestionesOrdenadas.filter((item) =>
      ['Llamada', 'Visita'].some((tipo) => includesType(item.tipo, tipo)) ||
      item.resultado?.includes('Contactado')
    ).length;

    const body: UserOptions['body'] = gestionesOrdenadas.map((item) => {
      const fechaKey = item.fecha ? item.fecha.split('T')[0] : 'sin-fecha';
      const bgColor = getResultadoColorWithDate(
        item.resultado,
        fechaIndexMap.get(fechaKey) || 0
      );

      return [
        { content: item.fecha ? item.fecha.replace('T', ' ').substring(0, 16) : '-', styles: { fillColor: bgColor } },
        { content: ['Llamada', 'Visita'].some((tipo) => includesType(item.tipo, tipo)) ? 'X' : '', styles: { halign: 'center', fillColor: bgColor } },
        { content: includesType(item.tipo, 'Email') ? 'X' : '', styles: { halign: 'center', fillColor: bgColor } },
        { content: includesType(item.tipo, 'WhatsApp') ? 'X' : '', styles: { halign: 'center', fillColor: bgColor } },
        { content: includesType(item.tipo, 'PDF') ? 'X' : '', styles: { halign: 'center', fillColor: bgColor } },
        { content: item.resultado || '-', styles: { fillColor: bgColor } },
        { content: item.observacion || '-', styles: { fillColor: bgColor } },
        {
          content: item.monto_promesa ? fmtMoney(item.monto_promesa) : '-',
          styles: {
            fontStyle: item.monto_promesa ? 'bold' : 'normal',
            halign: 'right',
            textColor: item.monto_promesa ? [245, 158, 11] : text,
            fillColor: bgColor,
          },
        },
      ];
    });

    const montoStr = totalMontoPromesas > 0 ? fmtMoney(totalMontoPromesas) : '-';
    body?.push([
      {
        content: `SUBTOTAL: ${gestionesOrdenadas.length} gest. | ${contactosCliente} contactos | ${totalClientePromesas} promesas | ${montoStr}`,
        colSpan: 8,
        styles: {
          fontStyle: 'bold',
          fontSize: 7,
          textColor: text,
          fillColor: [243, 244, 246],
          cellPadding: [2, 4],
        },
      },
    ]);

    autoTable(doc, {
      startY,
      head: [
        [{ content: cliente.toUpperCase(), colSpan: 8, styles: { fontStyle: 'bold', fontSize: 8, textColor: accent, fillColor: [219, 234, 254], cellPadding: [3, 4], halign: 'center' } }],
        ['Fecha', 'Telf', 'Mail', 'WApp', 'PDF', 'Resultado', 'Observación', 'Monto'],
      ],
      body,
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: [2, 3], valign: 'middle', textColor: text },
      headStyles: { fillColor: [219, 234, 254], textColor: accent, fontStyle: 'bold', halign: 'center', fontSize: 8 },
      margin: { left: contentLeft, right: contentLeft, bottom: 18 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 14, halign: 'center' },
        2: { cellWidth: 14, halign: 'center' },
        3: { cellWidth: 14, halign: 'center' },
        4: { cellWidth: 14, halign: 'center' },
        5: { cellWidth: 35 },
        6: { cellWidth: 56 },
        7: { cellWidth: 21, halign: 'right' },
      },
      pageBreak: 'auto',
      rowPageBreak: 'avoid',
    });

    startY = (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
      ? (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
      : startY + 8;
  });

  const safeName = safeFilename(alcance || 'General');
  savePdfDocument(
    doc,
    `Reporte_Gestion_${safeName}_${context.generadoEn.toISOString().split('T')[0]}.pdf`,
    context
  );
};
