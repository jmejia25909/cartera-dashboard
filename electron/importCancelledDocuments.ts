import fs from "node:fs";
import * as XLSX from "xlsx";
import type Database from "better-sqlite3";
import { normalizeDocumentNumber } from "./reconciliation/documentIdentity";
import { insertDocumentEvent } from "./reconciliation/eventRepository";

export type CancelledDocumentPreviewRow = {
  rowNumber: number;
  cancellationDate: string;
  documentType: string;
  documentNumber: string;
  normalizedDocumentNumber: string;
  sourceStatus: string;
  authorizationNumber: string;
  matchStatus: "ENCONTRADO" | "NO_ENCONTRADO" | "YA_ANULADO" | "DUPLICADO_HISTORICO";
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
  uniqueDocuments: number;
  duplicateRows: number;
  historicalDuplicates: number;
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
  uniqueDocuments: number;
  duplicateRows: number;
  historicalDuplicates: number;
  matchedDocuments: number;
  alreadyCancelledDocuments: number;
  cancelledDocuments: number;
  reversedPayments: number;
  unmatchedDocuments: number;
  message?: string;
};

type DocumentRecord = {
  id: number | null;
  documento: string;
  cliente: string | null;
  estado_documento: string | null;
  anulado: number | null;
  historical: boolean;
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

function buildCancellationEventKey(args: {
  normalizedDocumentNumber: string;
  cancellationDate: string;
  authorizationNumber: string;
}): string {
  const eventIdentity = [
    args.normalizedDocumentNumber,
    args.cancellationDate || "SIN_FECHA",
    args.authorizationNumber || "SIN_AUTORIZACION",
  ].join(":");

  return `ANULACION_CONFIRMADA:${eventIdentity}`;
}
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
  `).all() as Array<Omit<DocumentRecord, "historical">>;

  const result = new Map<string, DocumentRecord>();

  for (const document of documents) {
    const key = normalizeDocumentNumber(document.documento);
    if (!key) continue;
    result.set(key, { ...document, historical: false });
  }

  // Si el documento ya no está en la cartera vigente, conserva su identidad
  // desde el ledger. Esto permite que Anulados haga override sobre una
  // desaparición/PAGADO_TOTAL provisional.
  const historicalRows = db.prepare(`
    SELECT
      e.documento_normalizado,
      e.referencia_externa,
      e.estado_nuevo,
      e.metadata_json,
      EXISTS (
        SELECT 1
        FROM documento_eventos a
        WHERE a.documento_normalizado = e.documento_normalizado
          AND a.tipo_evento = 'ANULACION_CONFIRMADA'
      ) AS anulado
    FROM documento_eventos e
    WHERE e.id IN (
      SELECT MAX(id)
      FROM documento_eventos
      GROUP BY documento_normalizado
    )
  `).all() as Array<{
    documento_normalizado: string;
    referencia_externa: string | null;
    estado_nuevo: string | null;
    metadata_json: string | null;
    anulado: number;
  }>;

  for (const row of historicalRows) {
    if (!row.documento_normalizado || result.has(row.documento_normalizado)) {
      continue;
    }

    let cliente: string | null = null;
    try {
      const metadata = JSON.parse(row.metadata_json || "{}") as Record<string, unknown>;
      cliente = metadata.cliente ? String(metadata.cliente) : null;
    } catch {
      cliente = null;
    }

    result.set(row.documento_normalizado, {
      id: null,
      documento: row.referencia_externa || row.documento_normalizado,
      cliente,
      estado_documento: row.anulado ? "ANULADO" : row.estado_nuevo,
      anulado: row.anulado ? 1 : 0,
      historical: true,
    });
  }

  return result;
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

  const eventAlreadyProcessed = db.prepare(`
    SELECT 1
    FROM documento_eventos
    WHERE event_key = ?
    LIMIT 1
  `);

  const cancellationAlreadyLogged = db.prepare(`
    SELECT 1
    FROM documentos_anulados_log
    WHERE documento_normalizado = ?
      AND COALESCE(fecha_anulacion, '') = COALESCE(?, '')
      AND COALESCE(numero_autorizacion, '') = COALESCE(?, '')
    LIMIT 1
  `);

  const seenDocuments = new Set<string>();
  let historicalDuplicates = 0;
  let foundDocuments = 0;
  let alreadyCancelledDocuments = 0;
  let unmatchedDocuments = 0;
  let paymentsToReverse = 0;

  const rows: CancelledDocumentPreviewRow[] = report.rows.map((row) => {
    const document = documentsByKey.get(row.normalizedDocumentNumber);
    let matchStatus: CancelledDocumentPreviewRow["matchStatus"];
    let activePayments = 0;

    const cancellationEventKey = buildCancellationEventKey({
      normalizedDocumentNumber: row.normalizedDocumentNumber,
      cancellationDate: row.cancellationDate,
      authorizationNumber: row.authorizationNumber,
    });

    const historicalDuplicate =
      Boolean(eventAlreadyProcessed.get(cancellationEventKey)) ||
      Boolean(
        cancellationAlreadyLogged.get(
          row.normalizedDocumentNumber,
          row.cancellationDate || "",
          row.authorizationNumber || "",
        ),
      );

    if (historicalDuplicate) {
      matchStatus = "DUPLICADO_HISTORICO";
    } else if (!document) {
      matchStatus = "NO_ENCONTRADO";
    } else if (
      document.anulado === 1 ||
      document.estado_documento === "ANULADO"
    ) {
      matchStatus = "YA_ANULADO";
    } else {
      matchStatus = "ENCONTRADO";

      const paymentCount = countActivePayments.get(
        row.normalizedDocumentNumber,
      ) as { total: number };

      activePayments = Number(paymentCount.total ?? 0);
    }

    // Los contadores financieros/auditables son por documento único.
    // Las 168 filas del archivo siguen visibles en el detalle, pero un mismo
    // documento repetido no puede anularse/revertirse varias veces.
    if (!seenDocuments.has(row.normalizedDocumentNumber)) {
      seenDocuments.add(row.normalizedDocumentNumber);

      if (matchStatus === "DUPLICADO_HISTORICO") {
        historicalDuplicates += 1;
      } else if (matchStatus === "NO_ENCONTRADO") {
        unmatchedDocuments += 1;
      } else if (matchStatus === "YA_ANULADO") {
        alreadyCancelledDocuments += 1;
      } else {
        foundDocuments += 1;
        paymentsToReverse += activePayments;
      }
    }

    return {
      ...row,
      matchStatus,
      customer: document?.cliente ?? null,
      activePayments,
    };
  });

  const uniqueDocuments = seenDocuments.size;
  const duplicateRows = Math.max(rows.length - uniqueDocuments, 0);

  return {
    ok: true,
    filePath,
    sheetName: report.sheetName,
    companyName: report.companyName,
    reportTitle: report.reportTitle,
    totalRows: rows.length,
    uniqueDocuments,
    duplicateRows,
    historicalDuplicates,
    foundDocuments,
    alreadyCancelledDocuments,
    unmatchedDocuments,
    paymentsToReverse,
    rows,
    message:
      `Vista previa: ${rows.length} filas, ${uniqueDocuments} documentos únicos` +
      ` y ${duplicateRows} duplicados consolidados.`,
  };
}

export function importCancelledDocumentsExcel(
  filePath: string,
  db: Database.Database,
  importacionId?: number,
): CancelledDocumentImportResult {
  const preview = previewCancelledDocumentsExcel(filePath, db);

  const updateDocument = db.prepare(`
    UPDATE documentos
    SET estado_documento = 'ANULADO',
        anulado = 1,
        saldo_pendiente = 0,
        fecha_anulacion = @fecha_anulacion,
        motivo_anulacion = 'Importado desde Documentos Anulados',
        fuente_anulacion = 'ARCHIVO_DOCUMENTOS_ANULADOS'
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
      numero_autorizacion,
      importacion_id
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
      @numero_autorizacion,
      @importacion_id
    )
    ON CONFLICT(documento_normalizado, archivo_origen) DO UPDATE SET
      cliente = excluded.cliente,
      fecha_anulacion = excluded.fecha_anulacion,
      detectado_en = excluded.detectado_en,
      documento_id = excluded.documento_id,
      resultado = excluded.resultado,
      tipo_documento = excluded.tipo_documento,
      estado_origen = excluded.estado_origen,
      numero_autorizacion = excluded.numero_autorizacion,
      importacion_id = excluded.importacion_id
  `);

  const documentsByKey = loadDocuments(db);

  const uniqueRows = Array.from(
    new Map(
      preview.rows.map((row) => [row.normalizedDocumentNumber, row] as const),
    ).values(),
  );

  const cutoff = (db.prepare(`SELECT cutoff_date FROM reconciliation_control WHERE id=1`).get() as { cutoff_date?: string } | undefined)?.cutoff_date ?? "2024-01-01";
  const eventAlreadyProcessed = db.prepare(`
    SELECT 1
    FROM documento_eventos
    WHERE event_key = ?
    LIMIT 1
  `);

  const cancellationAlreadyLogged = db.prepare(`
    SELECT 1
    FROM documentos_anulados_log
    WHERE documento_normalizado = ?
      AND COALESCE(fecha_anulacion, '') = COALESCE(?, '')
      AND COALESCE(numero_autorizacion, '') = COALESCE(?, '')
    LIMIT 1
  `);

  const replayRows = uniqueRows
    .filter((row) => !row.cancellationDate || row.cancellationDate >= cutoff)
    .sort((a, b) => a.cancellationDate.localeCompare(b.cancellationDate));

  let historicalDuplicates = 0;
  let matchedDocuments = 0;
  let alreadyCancelledDocuments = 0;
  let cancelledDocuments = 0;
  let reversedPayments = 0;
  let unmatchedDocuments = 0;

  const transaction = db.transaction(() => {
    for (const row of replayRows) {
      const document = documentsByKey.get(row.normalizedDocumentNumber);

      const cancellationEventKey = buildCancellationEventKey({
        normalizedDocumentNumber: row.normalizedDocumentNumber,
        cancellationDate: row.cancellationDate,
        authorizationNumber: row.authorizationNumber,
      });

      const historicalDuplicate =
        Boolean(eventAlreadyProcessed.get(cancellationEventKey)) ||
        Boolean(
          cancellationAlreadyLogged.get(
            row.normalizedDocumentNumber,
            row.cancellationDate || "",
            row.authorizationNumber || "",
          ),
        );

      if (historicalDuplicate) {
        historicalDuplicates += 1;
        continue;
      }

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

        if (document.id != null) {
          cancelledDocuments += updateDocument.run({
            id: document.id,
            fecha_anulacion: row.cancellationDate || null,
          }).changes;
        } else {
          // Documento histórico: no se recrea una fila ficticia en `documentos`.
          // El override fiscal queda representado por eventos inmutables.
          cancelledDocuments += 1;
        }

        reversedPayments += reversePayments.run({
          documento_normalizado: row.normalizedDocumentNumber,
        }).changes;

        const previousState = document.estado_documento || "PAGADO_TOTAL";
        const eventIdentity = [
          row.normalizedDocumentNumber,
          row.cancellationDate || "SIN_FECHA",
          row.authorizationNumber || "SIN_AUTORIZACION",
        ].join(":");

        insertDocumentEvent(db, {
          eventKey: cancellationEventKey,
          documentoNormalizado: row.normalizedDocumentNumber,
          tipoEvento: "ANULACION_CONFIRMADA",
          fuente: "ANULADOS",
          importe: 0,
          estadoAnterior: previousState,
          estadoNuevo: "ANULADO",
          provisional: false,
          importacionId: importacionId ?? null,
          referenciaExterna: row.documentNumber,
          metadata: {
            cliente: document.cliente,
            fecha_anulacion: row.cancellationDate || null,
            numero_autorizacion: row.authorizationNumber || null,
            tipo_documento: row.documentType || null,
            historico: document.historical,
          },
        });

        // En HISTORICAL_LOAD el tiempo del evento es la fecha efectiva
        // del hecho fiscal, no la fecha en que el operador importó el Excel.
        if (row.cancellationDate) {
          db.prepare(`
            UPDATE documento_eventos
            SET ocurrido_en = ?
            WHERE event_key = ?
          `).run(row.cancellationDate, cancellationEventKey);
        }

        if (previousState === "PAGADO_TOTAL") {
          const reclassifiedEventKey =
            `ESTADO_RECLASIFICADO:${eventIdentity}`;

          insertDocumentEvent(db, {
            eventKey: reclassifiedEventKey,
            documentoNormalizado: row.normalizedDocumentNumber,
            tipoEvento: "ESTADO_RECLASIFICADO",
            fuente: "ANULADOS",
            importe: 0,
            estadoAnterior: "PAGADO_TOTAL",
            estadoNuevo: "ANULADO",
            provisional: false,
            referenciaExterna: row.documentNumber,
            metadata: {
              motivo: "Override fiscal por archivo de documentos anulados",
              fecha_anulacion: row.cancellationDate || null,
            },
          });

          if (row.cancellationDate) {
            db.prepare(`
              UPDATE documento_eventos
              SET ocurrido_en = ?
              WHERE event_key = ?
            `).run(row.cancellationDate, reclassifiedEventKey);
          }
        }

        result = document.historical ? "ANULADO_HISTORICO" : "ANULADO";
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
        importacion_id: importacionId ?? null,
      });
    }

    if (importacionId != null) {
      db.prepare(`
        UPDATE importaciones
        SET
          registros_leidos = ?,
          registros_importados = ?,
          registros_ignorados = ?,
          registros_duplicados = ?,
          estado = 'COMPLETADA',
          observacion = ?,
          metadata_json = ?
        WHERE id = ?
      `).run(
        preview.totalRows,
        Math.max(0, replayRows.length - historicalDuplicates),
        historicalDuplicates,
        preview.duplicateRows,
        `Anulados procesados: ${preview.uniqueDocuments} documentos únicos; ` +
          `${preview.duplicateRows} filas duplicadas consolidadas; ` +
          `${unmatchedDocuments} no encontrados.`,
        JSON.stringify({
          totalRows: preview.totalRows,
          uniqueDocuments: preview.uniqueDocuments,
          duplicateRows: preview.duplicateRows,
          historicalDuplicates,
          matchedDocuments,
          alreadyCancelledDocuments,
          cancelledDocuments,
          reversedPayments,
          unmatchedDocuments,
        }),
        importacionId,
      );
    }
  });

  transaction();

  return {
    ok: true,
    filePath,
    totalRows: preview.totalRows,
    uniqueDocuments: preview.uniqueDocuments,
    duplicateRows: preview.duplicateRows,
    historicalDuplicates,
    matchedDocuments,
    alreadyCancelledDocuments,
    cancelledDocuments,
    reversedPayments,
    unmatchedDocuments,
    message:
      `Importación completada: ${preview.totalRows} filas, ` +
      `${preview.uniqueDocuments} documentos únicos, ` +
      `${preview.duplicateRows} duplicados consolidados, ` +
      `${cancelledDocuments} anulados y ${unmatchedDocuments} no encontrados.`,
  };
}

