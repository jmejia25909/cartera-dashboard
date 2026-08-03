import type { jsPDF as JsPdfInstance } from 'jspdf';
import type { PdfContext } from '../core/pdfTypes';
import { drawPdfHeader } from '../core/pdfHeader';
import { loadPdfLibraries, savePdfDocument } from '../core/pdfDocument';

export interface CarteraDocumento {
  documento?: string;
  numero?: string;
  cliente?: string;
  razon_social?: string;
  fecha_emision?: string;
  fecha_vencimiento?: string;
  dias_vencidos?: number;
  total?: number;
  saldo?: number;
  valor_documento?: number;
}

export interface CarteraReportFilters {
  cliente?: string;
  vendedor?: string;
}

export interface GenerateCarteraReportParams {
  documentos: CarteraDocumento[];
  filtros: CarteraReportFilters;
  context: PdfContext;
}

type PdfColor = [number, number, number];

interface AutoTableCellHookData {
  section: string;
  row: {
    index: number;
  };
  column: {
    index: number;
  };
  cell: {
    styles: {
      fillColor?: PdfColor;
      textColor?: PdfColor;
      fontStyle?: string;
      fontSize?: number;
      halign?: 'left' | 'center' | 'right';
    };
  };
}

type FilaReportePDF = [
  documento: string,
  fechaEmision: string,
  fechaVencimiento: string,
  diasVencidos: number | string,
  tramoMora: string,
  saldo: string,
];

type MetadataFilaPDF = {
  isGroup: boolean;
  documento?: CarteraDocumento;
};

const fmtMoney = (amount: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (value === null || value === undefined) {
    return 0;
  }

  const raw = String(value).trim();
  if (!raw) {
    return 0;
  }

  const cleaned = raw.replace(/[^\d.,-]/g, '');

  if (cleaned.includes('.') && cleaned.includes(',')) {
    return Number(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
  }

  if (cleaned.includes(',') && !cleaned.includes('.')) {
    return Number(cleaned.replace(',', '.')) || 0;
  }

  return Number(cleaned) || 0;
};

const getDocumentAmount = (documento: CarteraDocumento): number =>
  toNumber(
    documento.total ??
      documento.saldo ??
      documento.valor_documento ??
      0
  );

const formatDate = (fecha?: string | null): string => {
  if (!fecha) {
    return '-';
  }

  const valor = fecha.trim();
  if (!valor) {
    return '-';
  }

  const formatoISO = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (formatoISO) {
    const [, anio, mes, dia] = formatoISO;
    return `${dia}/${mes}/${anio}`;
  }

  const formatoLatino = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (formatoLatino) {
    return formatoLatino[0];
  }

  const fechaInterpretada = new Date(valor);
  if (!Number.isNaN(fechaInterpretada.getTime())) {
    return fechaInterpretada.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  return valor;
};

const getAgingRange = (diasVencidos: number): string => {
  if (diasVencidos <= 0) return 'Por vencer';
  if (diasVencidos <= 30) return '1-30 días';
  if (diasVencidos <= 60) return '31-60 días';
  if (diasVencidos <= 90) return '61-90 días';
  if (diasVencidos <= 120) return '91-120 días';
  return '>120 días';
};

const getRowFill = (diasVencidos: number): PdfColor => {
  if (diasVencidos <= 0) return [248, 250, 252];
  if (diasVencidos <= 30) return [240, 253, 244];
  if (diasVencidos <= 60) return [236, 253, 245];
  if (diasVencidos <= 90) return [254, 249, 195];
  if (diasVencidos <= 120) return [255, 237, 213];
  return [254, 226, 226];
};

const buildReportTitle = (filtros: CarteraReportFilters): string => {
  if (filtros.vendedor) {
    return `Reporte de Cartera - ${filtros.vendedor}`;
  }

  if (filtros.cliente && filtros.cliente !== 'Todos') {
    return `Reporte de Cartera - ${filtros.cliente}`;
  }

  return 'Reporte de Cartera - GENERAL';
};

const sanitizeFilename = (value: string): string =>
  value.replace(/[^a-z0-9]/gi, '_');

const buildFilename = (
  filtros: CarteraReportFilters,
  generatedAt: Date
): string => {
  let base = 'Cartera_GENERAL';

  if (filtros.vendedor) {
    base = `Cartera_${sanitizeFilename(filtros.vendedor)}`;
  } else if (filtros.cliente && filtros.cliente !== 'Todos') {
    base = `Cartera_${sanitizeFilename(filtros.cliente)}`;
  }

  return `${base}_${generatedAt.toISOString().split('T')[0]}.pdf`;
};

const drawMetricCards = (
  doc: JsPdfInstance,
  params: {
    y: number;
    contentLeft: number;
    pageWidth: number;
    documentos: CarteraDocumento[];
  }
): number => {
  const { y, contentLeft, pageWidth, documentos } = params;
  const muted: PdfColor = [100, 116, 139];

  const documentosVencidos = documentos.filter(
    (documento) => (documento.dias_vencidos ?? 0) > 0
  );

  const totalMonto = documentos.reduce(
    (total, documento) => total + getDocumentAmount(documento),
    0
  );

  const totalVencido = documentosVencidos.reduce(
    (total, documento) => total + getDocumentAmount(documento),
    0
  );

  const cardHeight = 16;
  const cardGap = 4;
  const availableWidth = pageWidth - contentLeft * 2;
  const cardWidth = (availableWidth - cardGap * 3) / 4;

  const cards = [
    {
      label: 'Documentos',
      value: String(documentos.length),
      color: [59, 130, 246] as PdfColor,
      soft: [219, 234, 254] as PdfColor,
    },
    {
      label: 'Monto Total',
      value: fmtMoney(totalMonto),
      color: [14, 116, 144] as PdfColor,
      soft: [204, 251, 241] as PdfColor,
    },
    {
      label: 'Docs Vencidos',
      value: String(documentosVencidos.length),
      color: [245, 158, 11] as PdfColor,
      soft: [254, 243, 199] as PdfColor,
    },
    {
      label: 'Monto Vencido',
      value: fmtMoney(totalVencido),
      color: [239, 68, 68] as PdfColor,
      soft: [254, 226, 226] as PdfColor,
    },
  ];

  cards.forEach((item, index) => {
    const x = contentLeft + index * (cardWidth + cardGap);

    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(item.soft[0], item.soft[1], item.soft[2]);
    doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'FD');

    doc.setFillColor(item.color[0], item.color[1], item.color[2]);
    doc.rect(x, y, cardWidth, 1.2, 'F');

    doc.setFontSize(7);
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text(item.label.toUpperCase(), x + 4, y + 6);

    doc.setFontSize(10);
    doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    doc.text(item.value, x + 4, y + 12);
  });

  return y + cardHeight;
};

const buildGroupedRows = (
  documentos: CarteraDocumento[]
): {
  rows: FilaReportePDF[];
  metadata: MetadataFilaPDF[];
} => {
  const rows: FilaReportePDF[] = [];
  const metadata: MetadataFilaPDF[] = [];
  const documentosPorCliente = new Map<string, CarteraDocumento[]>();

  documentos.forEach((documento) => {
    const clienteNombre =
      documento.razon_social ||
      documento.cliente ||
      'Cliente no identificado';

    const documentosCliente = documentosPorCliente.get(clienteNombre) ?? [];
    documentosCliente.push(documento);
    documentosPorCliente.set(clienteNombre, documentosCliente);
  });

  const clientesAgrupados = Array.from(documentosPorCliente.entries()).sort(
    ([clienteA, documentosA], [clienteB, documentosB]) => {
      const maxDiasA = Math.max(
        ...documentosA.map((documento) => documento.dias_vencidos ?? 0)
      );
      const maxDiasB = Math.max(
        ...documentosB.map((documento) => documento.dias_vencidos ?? 0)
      );

      if (maxDiasA !== maxDiasB) {
        return maxDiasB - maxDiasA;
      }

      const subtotalA = documentosA.reduce(
        (total, documento) => total + getDocumentAmount(documento),
        0
      );
      const subtotalB = documentosB.reduce(
        (total, documento) => total + getDocumentAmount(documento),
        0
      );

      if (subtotalA !== subtotalB) {
        return subtotalB - subtotalA;
      }

      return clienteA.localeCompare(clienteB, 'es', {
        sensitivity: 'base',
      });
    }
  );

  clientesAgrupados.forEach(([clienteNombre, documentosCliente]) => {
    const documentosOrdenados = [...documentosCliente].sort(
      (documentoA, documentoB) => {
        const diasA = documentoA.dias_vencidos ?? 0;
        const diasB = documentoB.dias_vencidos ?? 0;

        if (diasA !== diasB) {
          return diasB - diasA;
        }

        return (documentoA.fecha_vencimiento || '').localeCompare(
          documentoB.fecha_vencimiento || ''
        );
      }
    );

    const subtotalCliente = documentosOrdenados.reduce(
      (subtotal, documento) => subtotal + getDocumentAmount(documento),
      0
    );

    rows.push([
      clienteNombre,
      '',
      '',
      '',
      'Subtotal',
      fmtMoney(subtotalCliente),
    ]);
    metadata.push({ isGroup: true });

    documentosOrdenados.forEach((documento) => {
      const diasVencidos = documento.dias_vencidos ?? 0;

      rows.push([
        documento.documento || documento.numero || '-',
        formatDate(documento.fecha_emision),
        formatDate(documento.fecha_vencimiento),
        diasVencidos,
        getAgingRange(diasVencidos),
        fmtMoney(getDocumentAmount(documento)),
      ]);

      metadata.push({
        isGroup: false,
        documento,
      });
    });
  });

  return { rows, metadata };
};

export const generateCarteraReport = async (
  params: GenerateCarteraReportParams
): Promise<void> => {
  const { documentos, filtros, context } = params;

  if (documentos.length === 0) {
    throw new Error('No hay documentos para generar el reporte PDF.');
  }

  const { jsPDF, autoTable } = await loadPdfLibraries();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const accent: PdfColor = [59, 130, 246];
  const text: PdfColor = [15, 23, 42];

  const { headerHeight, contentLeft, pageWidth } = drawPdfHeader(doc, {
    title: buildReportTitle(filtros),
    context,
  });

  const cardsBottomY = drawMetricCards(doc, {
    y: headerHeight + 6,
    contentLeft,
    pageWidth,
    documentos,
  });

  const { rows, metadata } = buildGroupedRows(documentos);

  autoTable(doc, {
    startY: cardsBottomY + 8,
    head: [[
      'Documento',
      'Emisión',
      'Vencimiento',
      'Días venc.',
      'Tramo de mora',
      'Saldo',
    ]],
    body: rows.map((row) => [...row]),
    theme: 'grid',
    showHead: 'everyPage',
    styles: {
      font: 'helvetica',
      fontSize: 7.2,
      cellPadding: 1.8,
      textColor: text,
      valign: 'middle',
      overflow: 'linebreak',
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [219, 234, 254],
      textColor: accent,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      lineColor: [147, 197, 253],
      lineWidth: 0.25,
    },
    margin: {
      top: 16,
      left: contentLeft,
      right: contentLeft,
      bottom: 18,
    },
    tableWidth: 'auto',
    columnStyles: {
      0: { cellWidth: 47, halign: 'left' },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 19, halign: 'right' },
      4: { cellWidth: 30, halign: 'center' },
      5: { cellWidth: 30, halign: 'right' },
    },
    pageBreak: 'auto',
    rowPageBreak: 'avoid',
    didParseCell: (data: AutoTableCellHookData) => {
      if (data.section !== 'body') {
        return;
      }

      const rowMetadata = metadata[data.row.index];
      if (!rowMetadata) {
        return;
      }

      if (rowMetadata.isGroup) {
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = [30, 41, 59];

        if (data.column.index === 0) {
          data.cell.styles.textColor = accent;
          data.cell.styles.fontSize = 8;
          data.cell.styles.halign = 'left';
        }

        if (data.column.index === 4) {
          data.cell.styles.textColor = [71, 85, 105];
          data.cell.styles.halign = 'right';
        }

        if (data.column.index === 5) {
          data.cell.styles.textColor = accent;
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.halign = 'right';
        }

        return;
      }

      const diasVencidos = rowMetadata.documento?.dias_vencidos ?? 0;
      data.cell.styles.fillColor = getRowFill(diasVencidos);

      const esColumnaCritica = [3, 4, 5].includes(data.column.index);

      if (
        diasVencidos > 90 &&
        diasVencidos <= 120 &&
        esColumnaCritica
      ) {
        data.cell.styles.textColor = [194, 65, 12];
        data.cell.styles.fontStyle = 'bold';
      }

      if (diasVencidos > 120 && esColumnaCritica) {
        data.cell.styles.textColor = [185, 28, 28];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  savePdfDocument(doc, buildFilename(filtros, context.generadoEn), context);
};
