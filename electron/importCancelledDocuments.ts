import fs from "node:fs";
import * as XLSX from "xlsx";
import type Database from "better-sqlite3";

export type CancelledDocumentPreviewRow = {
  rowNumber: number;
  cancellationDate: string;
  documentType: string;
  documentNumber: string;
  normalizedDocumentNumber: string;
  sourceStatus: string;
  authorizationNumber: string;
  matchStatus: "ENCONTRADO" | "NO_ENCONTRADO" | "YA_ANULADO";
  customer: string | null;
  activePayments: number;
};

export type CancelledDocumentPreviewResult = {
  ok: boolean;
  filePath: string;
  sheetName: string;
  companyName: string;
  reportTitle: string;
  totalRows: number;
  foundDocuments: number;
  alreadyCancelledDocuments: number;
  unmatchedDocuments: number;
  paymentsToReverse: number;
  rows: CancelledDocumentPreviewRow[];
  message?: string;
};

export type CancelledDocumentImportResult = {
  ok: boolean;
  filePath: string;
  totalRows: number;
  matchedDocuments: number;
  alreadyCancelledDocuments: number;
  cancelledDocuments: number;
  reversedPayments: number;
  unmatchedDocuments: number;
  message?: string;
};

type DocumentRecord = {
  id: number;
  documento: string;
  cliente: string | null;
  estado_documento: string | null;
  anulado: number | null;
};

type ParsedCancelledReport = {
  sheetName: string;
  companyName: string;
  reportTitle: string;
  rows: Array<{
    rowNumber: number;
    cancellationDate: string;
    documentType: string;
    documentNumber: string;
    normalizedDocumentNumber: string;
    sourceStatus: string;
    authorizationNumber: string;
  }>;
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

function normalizeDocumentNumber(value: unknown): string {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) return "";

  const alnum = raw.replace(/[^A-Z0-9]/g, "");
  if (!alnum) return "";

  return /^\d+$/.test(alnum)
    ? alnum.replace(/^0+/, "") || "0"
    : alnum;
}

function toIsoDate(value: unknown): string {
  if (!value) return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      return `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }

  const raw = String(value).trim();
  const dmy = raw.match(/^([0-3]?\d)[/-]([0-1]?\d)[/-](\d{2}|\d{4})$/);

  if (dmy) {
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];

    return `${year}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

function parseCancelledReport(filePath: string): ParsedCancelledReport {
  const workbook = XLSX.read(fs.readFileSync(filePath), {
    type: "buffer",
    cellDates: true,
    cellNF: false,
    cellText: false,
  });

  const sheetName =
    workbook.SheetNames.find((name) =>
      normalizeHeader(name).includes("documentosanulados"),
    ) ?? workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error("No se encontró la hoja DocumentosAnulados.");
  }

  const rawRows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
  }) as unknown[][];

  const companyName = String(rawRows[0]?.[0] ?? "").trim();
  const reportTitle = String(rawRows[1]?.[0] ?? "").trim();

  let headerIndex = -1;
  let cancellationDateIndex = -1;
  let documentTypeIndex = -1;
  let documentNumberIndex = -1;
  let sourceStatusIndex = -1;
  let authorizationNumberIndex = -1;

  for (let index = 0; index < Math.min(rawRows.length, 30); index += 1) {
    const headers = (rawRows[index] ?? []).map(normalizeHeader);

    const currentDocumentIndex = headers.findIndex((header) =>
      ["# documento", "documento", "numero documento"].includes(header),
    );

    if (currentDocumentIndex < 0) continue;

    headerIndex = index;
    documentNumberIndex = currentDocumentIndex;
    cancellationDateIndex = headers.findIndex((header) =>
      ["fecha de anulacion", "fecha anulacion"].includes(header),
    );
    documentTypeIndex = headers.findIndex((header) =>
      ["tipo de documento", "tipo documento"].includes(header),
    );
    sourceStatusIndex = headers.findIndex((header) => header === "estado");
    authorizationNumberIndex = headers.findIndex((header) =>
      ["# autorizacion", "autorizacion", "numero autorizacion"].includes(header),
    );
    break;
  }

  if (headerIndex < 0 || documentNumberIndex < 0) {
    throw new Error(
      "No se encontró la cabecera esperada de Documentos Anulados.",
    );
  }

  const parsedRows = rawRows
    .slice(headerIndex + 1)
    .map((row, relativeIndex) => {
      const documentNumber = String(
        row[documentNumberIndex] ?? "",
      ).trim();

      return {
        rowNumber: headerIndex + relativeIndex + 2,
        cancellationDate:
          cancellationDateIndex >= 0
            ? toIsoDate(row[cancellationDateIndex])
            : "",
        documentType:
          documentTypeIndex >= 0
            ? String(row[documentTypeIndex] ?? "").trim()
            : "",
        documentNumber,
        normalizedDocumentNumber: normalizeDocumentNumber(documentNumber),
        sourceStatus:
          sourceStatusIndex >= 0
            ? String(row[sourceStatusIndex] ?? "").trim()
            : "",
        authorizationNumber:
          authorizationNumberIndex >= 0
            ? String(row[authorizationNumberIndex] ?? "").trim()
            : "",
      };
    })
    .filter((row) => row.normalizedDocumentNumber);

  return {
    sheetName,
    companyName,
    reportTitle,
    rows: parsedRows,
  };
}

function loadDocuments(
  db: Database.Database,
): Map<string, DocumentRecord> {
  const documents = db.prepare(`
    SELECT
      id,
      documento,
      cliente,
      estado_documento,
      anulado
    FROM documentos
    WHERE is_subtotal = 0
  `).all() as DocumentRecord[];

  return new Map(
    documents.map((document) => [
      normalizeDocumentNumber(document.documento),
      document,
    ]),
  );
}

export function previewCancelledDocumentsExcel(
  filePath: string,
  db: Database.Database,
): CancelledDocumentPreviewResult {
  const report = parseCancelledReport(filePath);
  const documentsByKey = loadDocuments(db);

  const countActivePayments = db.prepare(`
    SELECT COUNT(*) AS total
    FROM abonos
    WHERE COALESCE(reversado, 0) = 0
      AND documento_normalizado = ?
  `);

  let foundDocuments = 0;
  let alreadyCancelledDocuments = 0;
  let unmatchedDocuments = 0;
  let paymentsToReverse = 0;

  const rows: CancelledDocumentPreviewRow[] = report.rows.map((row) => {
    const document = documentsByKey.get(row.normalizedDocumentNumber);
    let matchStatus: CancelledDocumentPreviewRow["matchStatus"];
    let activePayments = 0;

    if (!document) {
      matchStatus = "NO_ENCONTRADO";
      unmatchedDocuments += 1;
    } else if (
      document.anulado === 1 ||
      document.estado_documento === "ANULADO"
    ) {
      matchStatus = "YA_ANULADO";
      alreadyCancelledDocuments += 1;
    } else {
      matchStatus = "ENCONTRADO";
      foundDocuments += 1;

      const paymentCount = countActivePayments.get(
        row.normalizedDocumentNumber,
      ) as { total: number };

      activePayments = Number(paymentCount.total ?? 0);
      paymentsToReverse += activePayments;
    }

    return {
      ...row,
      matchStatus,
      customer: document?.cliente ?? null,
      activePayments,
    };
  });

  return {
    ok: true,
    filePath,
    sheetName: report.sheetName,
    companyName: report.companyName,
    reportTitle: report.reportTitle,
    totalRows: rows.length,
    foundDocuments,
    alreadyCancelledDocuments,
    unmatchedDocuments,
    paymentsToReverse,
    rows,
    message: "Vista previa generada correctamente.",
  };
}

export function importCancelledDocumentsExcel(
  filePath: string,
  db: Database.Database,
): CancelledDocumentImportResult {
  const preview = previewCancelledDocumentsExcel(filePath, db);

  const updateDocument = db.prepare(`
    UPDATE documentos
    SET estado_documento = 'ANULADO',
        anulado = 1,
        fecha_anulacion = @fecha_anulacion,
        motivo_anulacion = 'Importado desde Documentos Anulados',
        fuente_anulacion = 'ARCHIVO_DOCUMENTOS_ANULADOS',
        saldo = 0
    WHERE id = @id
  `);

  const reversePayments = db.prepare(`
    UPDATE abonos
    SET estado = 'REVERSADO',
        reversado = 1,
        motivo_reversion = 'ANULACION_DOCUMENTO',
        reversado_en = datetime('now', 'localtime')
    WHERE COALESCE(reversado, 0) = 0
      AND documento_normalizado = @documento_normalizado
  `);

  const insertLog = db.prepare(`
    INSERT INTO documentos_anulados_log (
      documento,
      documento_normalizado,
      cliente,
      fecha_anulacion,
      motivo,
      archivo_origen,
      detectado_en,
      documento_id,
      resultado,
      tipo_documento,
      estado_origen,
      numero_autorizacion
    )
    VALUES (
      @documento,
      @documento_normalizado,
      @cliente,
      @fecha_anulacion,
      'Importado desde Documentos Anulados',
      @archivo_origen,
      datetime('now', 'localtime'),
      @documento_id,
      @resultado,
      @tipo_documento,
      @estado_origen,
      @numero_autorizacion
    )
    ON CONFLICT(documento_normalizado, archivo_origen) DO UPDATE SET
      cliente = excluded.cliente,
      fecha_anulacion = excluded.fecha_anulacion,
      detectado_en = excluded.detectado_en,
      documento_id = excluded.documento_id,
      resultado = excluded.resultado,
      tipo_documento = excluded.tipo_documento,
      estado_origen = excluded.estado_origen,
      numero_autorizacion = excluded.numero_autorizacion
  `);

  const documentsByKey = loadDocuments(db);

  let matchedDocuments = 0;
  let alreadyCancelledDocuments = 0;
  let cancelledDocuments = 0;
  let reversedPayments = 0;
  let unmatchedDocuments = 0;

  const transaction = db.transaction(() => {
    for (const row of preview.rows) {
      const document = documentsByKey.get(row.normalizedDocumentNumber);
      let result = "NO_ENCONTRADO";

      if (!document) {
        unmatchedDocuments += 1;
      } else if (
        document.anulado === 1 ||
        document.estado_documento === "ANULADO"
      ) {
        matchedDocuments += 1;
        alreadyCancelledDocuments += 1;
        result = "YA_ANULADO";
      } else {
        matchedDocuments += 1;
        cancelledDocuments += updateDocument.run({
          id: document.id,
          fecha_anulacion: row.cancellationDate || null,
        }).changes;

        reversedPayments += reversePayments.run({
          documento_normalizado: row.normalizedDocumentNumber,
        }).changes;

        result = "ANULADO";
      }

      insertLog.run({
        documento: row.documentNumber,
        documento_normalizado: row.normalizedDocumentNumber,
        cliente: document?.cliente ?? null,
        fecha_anulacion: row.cancellationDate || null,
        archivo_origen: filePath,
        documento_id: document?.id ?? null,
        resultado: result,
        tipo_documento: row.documentType || null,
        estado_origen: row.sourceStatus || null,
        numero_autorizacion: row.authorizationNumber || null,
      });
    }
  });

  transaction();

  return {
    ok: true,
    filePath,
    totalRows: preview.totalRows,
    matchedDocuments,
    alreadyCancelledDocuments,
    cancelledDocuments,
    reversedPayments,
    unmatchedDocuments,
    message: "Importación de documentos anulados completada.",
  };
}
