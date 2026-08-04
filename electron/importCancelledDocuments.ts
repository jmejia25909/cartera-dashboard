import * as XLSX from "xlsx";
import type Database from "better-sqlite3";

export type CancelledDocumentImportResult = {
  ok: boolean;
  filePath: string;
  totalRows: number;
  matchedDocuments: number;
  cancelledDocuments: number;
  reversedPayments: number;
  unmatchedDocuments: number;
  message?: string;
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().normalize("NFD")
    .replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeDocumentNumber(value: unknown): string {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) return "";
  const alnum = raw.replace(/[^A-Z0-9]/g, "");
  if (!alnum) return "";
  return /^\d+$/.test(alnum) ? alnum.replace(/^0+/, "") || "0" : alnum;
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

export function importCancelledDocumentsExcel(
  filePath: string,
  db: Database.Database,
): CancelledDocumentImportResult {
  const workbook = XLSX.readFile(filePath, { cellDates: true, cellNF: false, cellText: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("No se encontró una hoja válida.");

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true }) as unknown[][];
  const documentHeaders = new Set([
    "documento", "numero documento", "nro documento", "num documento",
    "numero comprobante", "comprobante", "factura", "numero factura", "nro factura",
  ]);

  let headerIndex = -1;
  let documentIndex = -1;
  let cancellationDateIndex = -1;
  let reasonIndex = -1;
  let customerIndex = -1;

  for (let i = 0; i < Math.min(rows.length, 30); i += 1) {
    const headers = (rows[i] ?? []).map(normalizeHeader);
    const index = headers.findIndex((header) => documentHeaders.has(header));
    if (index < 0) continue;

    headerIndex = i;
    documentIndex = index;
    cancellationDateIndex = headers.findIndex((header) =>
      ["fecha anulacion", "fecha de anulacion", "fecha"].includes(header));
    reasonIndex = headers.findIndex((header) =>
      ["motivo anulacion", "motivo", "observacion", "detalle"].includes(header));
    customerIndex = headers.findIndex((header) =>
      ["cliente", "razon social", "nombre cliente"].includes(header));
    break;
  }

  if (headerIndex < 0 || documentIndex < 0) {
    return {
      ok: false, filePath, totalRows: 0, matchedDocuments: 0,
      cancelledDocuments: 0, reversedPayments: 0, unmatchedDocuments: 0,
      message: "No se encontró una columna de documento o factura.",
    };
  }

  const documents = db.prepare(`
    SELECT id, documento, cliente
    FROM documentos
    WHERE is_subtotal = 0
  `).all() as Array<{ id: number; documento: string; cliente: string | null }>;

  const documentsByKey = new Map(
    documents.map((row) => [normalizeDocumentNumber(row.documento), row]),
  );

  const insertLog = db.prepare(`
    INSERT INTO documentos_anulados_log (
      documento, documento_normalizado, cliente, fecha_anulacion, motivo,
      archivo_origen, detectado_en, documento_id, resultado
    )
    VALUES (
      @documento, @documento_normalizado, @cliente, @fecha_anulacion, @motivo,
      @archivo_origen, datetime('now', 'localtime'), @documento_id, @resultado
    )
    ON CONFLICT(documento_normalizado, archivo_origen) DO UPDATE SET
      cliente = excluded.cliente,
      fecha_anulacion = excluded.fecha_anulacion,
      motivo = excluded.motivo,
      detectado_en = excluded.detectado_en,
      documento_id = excluded.documento_id,
      resultado = excluded.resultado
  `);

  const cancelDocument = db.prepare(`
    UPDATE documentos
    SET estado_documento = 'ANULADO',
        anulado = 1,
        fecha_anulacion = @fecha_anulacion,
        motivo_anulacion = @motivo,
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
    WHERE reversado = 0
      AND documento_normalizado = @documento_normalizado
  `);

  let totalRows = 0;
  let matchedDocuments = 0;
  let cancelledDocuments = 0;
  let reversedPaymentsCount = 0;
  let unmatchedDocuments = 0;

  const transaction = db.transaction(() => {
    for (const row of rows.slice(headerIndex + 1)) {
      const originalDocument = String(row[documentIndex] ?? "").trim();
      const normalizedDocument = normalizeDocumentNumber(originalDocument);
      if (!normalizedDocument) continue;

      totalRows += 1;
      const matched = documentsByKey.get(normalizedDocument);
      const cancellationDate = cancellationDateIndex >= 0
        ? toIsoDate(row[cancellationDateIndex])
        : "";
      const reason = reasonIndex >= 0
        ? String(row[reasonIndex] ?? "").trim() || "Importado desde Documentos Anulados"
        : "Importado desde Documentos Anulados";
      const importedCustomer = customerIndex >= 0
        ? String(row[customerIndex] ?? "").trim()
        : "";

      if (!matched) {
        unmatchedDocuments += 1;
        insertLog.run({
          documento: originalDocument,
          documento_normalizado: normalizedDocument,
          cliente: importedCustomer || null,
          fecha_anulacion: cancellationDate || null,
          motivo: reason,
          archivo_origen: filePath,
          documento_id: null,
          resultado: "NO_ENCONTRADO",
        });
        continue;
      }

      matchedDocuments += 1;
      cancelledDocuments += cancelDocument.run({
        id: matched.id,
        fecha_anulacion: cancellationDate || null,
        motivo: reason,
      }).changes;

      reversedPaymentsCount += reversePayments.run({
        documento_normalizado: normalizedDocument,
      }).changes;

      insertLog.run({
        documento: originalDocument,
        documento_normalizado: normalizedDocument,
        cliente: matched.cliente || importedCustomer || null,
        fecha_anulacion: cancellationDate || null,
        motivo: reason,
        archivo_origen: filePath,
        documento_id: matched.id,
        resultado: "ANULADO",
      });
    }
  });

  transaction();

  return {
    ok: true, filePath, totalRows, matchedDocuments, cancelledDocuments,
    reversedPayments: reversedPaymentsCount, unmatchedDocuments,
    message: "Importación de documentos anulados completada.",
  };
}
