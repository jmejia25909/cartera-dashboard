import { extname } from "node:path";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

export type ImportReportType =
  | "CARTERA"
  | "ANULADOS"
  | "NOTAS_CREDITO"
  | "COBROS_MOVIMIENTOS";

type HeaderRule = {
  label: string;
  aliases: string[];
};

type ReportDefinition = {
  label: string;
  operatorGuide: string;
  required: HeaderRule[];
};

const DEFINITIONS: Record<ImportReportType, ReportDefinition> = {
  CARTERA: {
    label: "Cartera Contífico",
    operatorGuide: "Contífico: modo GENERAL · Excel DETALLADO.",
    required: [
      { label: "cliente/razón social", aliases: ["cliente", "razon social"] },
      { label: "documento", aliases: ["# documentos", "# documento", "documento", "numero documento"] },
      { label: "total", aliases: ["total"] },
      { label: "fecha de emisión", aliases: ["f emision", "fecha emision", "emision"] },
    ],
  },
  ANULADOS: {
    label: "Documentos anulados",
    operatorGuide: "Contífico: filtro TODOS · Excel NORMAL.",
    required: [
      { label: "documento", aliases: ["# documento", "documento", "numero documento"] },
      { label: "estado", aliases: ["estado"] },
      { label: "fecha de anulación/autorización", aliases: ["fecha de anulacion", "fecha anulacion", "# autorizacion", "autorizacion", "numero autorizacion"] },
    ],
  },
  NOTAS_CREDITO: {
    label: "Notas de crédito",
    operatorGuide: "Contífico: Clientes → Notas de Crédito · filtro TODOS · Excel NORMAL.",
    required: [
      { label: "tipo documento", aliases: ["tipo documento"] },
      { label: "documento de NC", aliases: ["# documento", "documento"] },
      { label: "documento relacionado", aliases: ["# documento relacionado", "documento relacionado"] },
    ],
  },
  COBROS_MOVIMIENTOS: {
    label: "Cobros y movimientos relacionados",
    operatorGuide: "Contífico: filtro TODOS · Excel DETALLADO.",
    required: [
      { label: "fecha", aliases: ["fecha", "fecha aplicacion", "fecha de aplicacion", "fecha cobro", "fecha pago"] },
      { label: "tipo", aliases: ["tipo", "tipo movimiento"] },
      { label: "forma cobro/pago", aliases: ["forma cobro pago", "forma cobro/pago", "forma cobro", "forma de cobro", "forma pago", "forma de pago"] },
      { label: "código comprobante", aliases: ["codigo comprobante", "código comprobante", "documento relacionado", "# documento", "documento"] },
      { label: "valor/monto", aliases: ["valor", "monto", "total", "valor cobro", "valor pago"] },
    ],
  },
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesAlias(header: string, alias: string): boolean {
  const normalizedAlias = normalizeHeader(alias);
  return (
    header === normalizedAlias ||
    header.startsWith(`${normalizedAlias} `) ||
    header.endsWith(` ${normalizedAlias}`)
  );
}

function findMatchingHeader(
  headers: string[],
  aliases: string[],
): string | undefined {
  return headers.find((header) =>
    aliases.some((alias) => matchesAlias(header, alias)),
  );
}

export type ExcelStructureValidation = {
  ok: boolean;
  reportType: ImportReportType;
  sheetName?: string;
  headerRow?: number;
  detectedHeaders: string[];
  missing: string[];
  message: string;
};

export function validateExcelStructure(
  filePath: string,
  expectedType: ImportReportType,
): ExcelStructureValidation {
  const extension = extname(filePath).toLowerCase();
  const definition = DEFINITIONS[expectedType];

  if (![".xls", ".xlsx"].includes(extension)) {
    return {
      ok: false,
      reportType: expectedType,
      detectedHeaders: [],
      missing: definition.required.map((rule) => rule.label),
      message:
        `Formato no permitido (${extension || "sin extensión"}). ` +
        "Selecciona un archivo .XLS o .XLSX exportado desde Contífico.",
    };
  }

  let workbook: XLSX.WorkBook;

  try {
    workbook = XLSX.read(readFileSync(filePath), {
      type: "buffer",
      cellDates: true,
      cellNF: false,
      cellText: false,
    });
  } catch (error: unknown) {
    return {
      ok: false,
      reportType: expectedType,
      detectedHeaders: [],
      missing: definition.required.map((rule) => rule.label),
      message:
        "El archivo no pudo abrirse como Excel (.XLS/.XLSX). " +
        (error instanceof Error ? error.message : ""),
    };
  }

  let best:
    | {
        sheetName: string;
        rowIndex: number;
        headers: string[];
        matched: number;
        missing: string[];
      }
    | undefined;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: true,
    });

    for (let rowIndex = 0; rowIndex < Math.min(rows.length, 40); rowIndex += 1) {
      const headers = (rows[rowIndex] ?? [])
        .map(normalizeHeader)
        .filter(Boolean);

      if (headers.length < 2) continue;

      const missing = definition.required
        .filter((rule) => !findMatchingHeader(headers, rule.aliases))
        .map((rule) => rule.label);

      const matched = definition.required.length - missing.length;

      if (!best || matched > best.matched) {
        best = { sheetName, rowIndex, headers, matched, missing };
      }

      if (missing.length === 0) {
        return {
          ok: true,
          reportType: expectedType,
          sheetName,
          headerRow: rowIndex + 1,
          detectedHeaders: headers,
          missing: [],
          message:
            `${definition.label}: estructura válida en hoja "${sheetName}", ` +
            `fila de encabezados ${rowIndex + 1}.`,
        };
      }
    }
  }

  const detected = best?.headers ?? [];
  const missing = best?.missing ?? definition.required.map((rule) => rule.label);

  return {
    ok: false,
    reportType: expectedType,
    sheetName: best?.sheetName,
    headerRow: best ? best.rowIndex + 1 : undefined,
    detectedHeaders: detected,
    missing,
    message:
      `El archivo seleccionado no corresponde al importador "${definition.label}". ` +
      `Faltan encabezados requeridos: ${missing.join(", ")}. ` +
      `${definition.operatorGuide} ` +
      "El nombre del archivo no importa; la validación se realiza por su estructura interna.",
  };
}
