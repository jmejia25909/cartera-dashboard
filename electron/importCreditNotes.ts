import type Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { normalizeDocumentNumber } from "./reconciliation/documentIdentity";
import { insertDocumentEvent } from "./reconciliation/eventRepository";

type RawRow = Record<string, unknown>;

export interface CreditNotePreviewRow {
  fecha: string;
  numeroNotaCredito: string;
  numeroNotaCreditoNormalizado: string;
  tipoDocumentoRelacionado: string;
  documentoRelacionado: string;
  documentoRelacionadoNormalizado: string;
  autorizacion: string;
  persona: string;
  identificacion: string;
  vendedor: string;
  subtotal: number;
  iva: number;
  total: number;
  saldo: number;
  estado: string;
  descripcion: string;
  matchStatus: "ENCONTRADO" | "NO_ENCONTRADO" | "SIN_DOCUMENTO_RELACIONADO";
  ingestionStatus: "NUEVA" | "DUPLICADO_HISTORICO";
}

export interface CreditNotePreviewResult {
  ok: boolean;
  filePath: string;
  sheetName: string;
  totalRows: number;
  uniqueCreditNotes: number;
  duplicateRows: number;
  historicalDuplicates: number;
  matchedDocuments: number;
  unmatchedDocuments: number;
  missingRelatedDocument: number;
  totalAmount: number;
  rows: CreditNotePreviewRow[];
  message: string;
}

export interface CreditNoteImportResult extends CreditNotePreviewResult {
  importacionId?: number;
  appliedCreditNotes: number;
  pendingCreditNotes: number;
}

const money = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
};

const text = (value: unknown): string => String(value ?? "").trim();

function normalizeHeader(value: unknown): string {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function findHeaderRow(rows: unknown[][]): number {
  return rows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return headers.includes("# documento") &&
      headers.includes("# documento relacionado") &&
      headers.some((h) => h === "tipo documento");
  });
}

function rowObject(headers: unknown[], row: unknown[]): RawRow {
  const result: RawRow = {};
  headers.forEach((header, index) => {
    result[normalizeHeader(header)] = row[index];
  });
  return result;
}

function formatExcelDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const raw = text(value);
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) { let year = Number(dmy[3]); if (year < 100) year += 2000; return `${year}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`; }
  return raw;
}

function parseCreditNotes(
  filePath: string,
  db: Database.Database,
): CreditNotePreviewResult {
  const fileBuffer = readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, {
    type: "buffer",
    cellDates: true,
  });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("El archivo no contiene hojas.");

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  const headerIndex = findHeaderRow(matrix);
  if (headerIndex < 0) {
    throw new Error(
      "No se encontró la cabecera esperada. El archivo debe incluir '# Documento' y '# Documento Relacionado'.",
    );
  }

  const headers = matrix[headerIndex];
  const existsDocument = db.prepare(`
    SELECT 1
    FROM documentos
    WHERE is_subtotal = 0
      AND documento_normalizado = ?
    LIMIT 1
  `);

  const existsCreditNote = db.prepare(`
    SELECT
      id,
      estado_conciliacion,
      importacion_id
    FROM notas_credito_importadas
    WHERE numero_nc_normalizado = ?
    LIMIT 1
  `);

  const parsedRows: CreditNotePreviewRow[] = [];

  for (const row of matrix.slice(headerIndex + 1)) {
    const source = rowObject(headers, row);
    const numeroNc = text(source["# documento"]);
    const tipoDocumento = text(source["tipo documento"]);

    if (!numeroNc || !/nota de credito/i.test(
      tipoDocumento.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
    )) {
      continue;
    }

    const related = text(source["# documento relacionado"]);
    const relatedNormalized = normalizeDocumentNumber(related);
    const matchStatus: CreditNotePreviewRow["matchStatus"] =
      !relatedNormalized
        ? "SIN_DOCUMENTO_RELACIONADO"
        : existsDocument.get(relatedNormalized)
          ? "ENCONTRADO"
          : "NO_ENCONTRADO";

    const numeroNcNormalizado = normalizeDocumentNumber(numeroNc);

    const ingestionStatus: CreditNotePreviewRow["ingestionStatus"] =
      existsCreditNote.get(numeroNcNormalizado)
        ? "DUPLICADO_HISTORICO"
        : "NUEVA";

    parsedRows.push({
      fecha: formatExcelDate(source["fecha"]),
      numeroNotaCredito: numeroNc,
      numeroNotaCreditoNormalizado: numeroNcNormalizado,
      tipoDocumentoRelacionado: text(source["# tipo documento relacionado"]),
      documentoRelacionado: related,
      documentoRelacionadoNormalizado: relatedNormalized,
      autorizacion: text(source["autorizacion"]),
      persona: text(source["persona"]),
      identificacion: text(source["identificacion"]),
      vendedor: text(source["vendedor"]),
      subtotal: money(source["subtotal iva mayor a 0%"]) +
        money(source["subtotal iva 0%"]),
      iva: money(source["iva"]),
      total: Math.abs(money(source["total"])),
      saldo: money(source["saldo"]),
      estado: text(source["estado"]),
      descripcion: text(source["descripcion"]),
      matchStatus,
      ingestionStatus,
    });
  }

  const uniqueMap = new Map<string, CreditNotePreviewRow>();
  for (const row of parsedRows) {
    const key = row.numeroNotaCreditoNormalizado || row.autorizacion;
    if (key && !uniqueMap.has(key)) uniqueMap.set(key, row);
  }

  const uniqueRows = [...uniqueMap.values()];
  const historicalDuplicates = uniqueRows.filter(
    (r) => r.ingestionStatus === "DUPLICADO_HISTORICO",
  ).length;

  const matchedDocuments = uniqueRows.filter((r) => r.matchStatus === "ENCONTRADO").length;
  const unmatchedDocuments = uniqueRows.filter((r) => r.matchStatus === "NO_ENCONTRADO").length;
  const missingRelatedDocument = uniqueRows.filter(
    (r) => r.matchStatus === "SIN_DOCUMENTO_RELACIONADO",
  ).length;
  const totalAmount = money(uniqueRows.reduce((sum, r) => sum + r.total, 0));

  return {
    ok: true,
    filePath,
    sheetName,
    totalRows: parsedRows.length,
    uniqueCreditNotes: uniqueRows.length,
    duplicateRows: Math.max(parsedRows.length - uniqueRows.length, 0),
    historicalDuplicates,
    matchedDocuments,
    unmatchedDocuments,
    missingRelatedDocument,
    totalAmount,
    rows: parsedRows,
    message:
      `Vista previa: ${parsedRows.length} filas, ${uniqueRows.length} notas de crédito únicas, ` +
      `${matchedDocuments} facturas relacionadas encontradas.`,
  };
}

export function previewCreditNotesExcel(
  filePath: string,
  db: Database.Database,
): CreditNotePreviewResult {
  return parseCreditNotes(filePath, db);
}

export function importCreditNotesExcel(
  filePath: string,
  db: Database.Database,
  importacionId: number,
): CreditNoteImportResult {
  const preview = parseCreditNotes(filePath, db);
  const uniqueRows = Array.from(
    new Map(
      preview.rows.map((row) => [
        row.numeroNotaCreditoNormalizado || row.autorizacion,
        row,
      ] as const),
    ).values(),
  );

  const insertNote = db.prepare(`
    INSERT INTO notas_credito_importadas (
      numero_nc,
      numero_nc_normalizado,
      fecha_nc,
      tipo_documento_relacionado,
      documento_relacionado,
      documento_relacionado_normalizado,
      autorizacion,
      persona,
      identificacion,
      vendedor,
      subtotal,
      iva,
      total_nc,
      saldo_nc,
      estado_fuente,
      descripcion,
      estado_conciliacion,
      importacion_id
    ) VALUES (
      @numero_nc,
      @numero_nc_normalizado,
      @fecha_nc,
      @tipo_documento_relacionado,
      @documento_relacionado,
      @documento_relacionado_normalizado,
      @autorizacion,
      @persona,
      @identificacion,
      @vendedor,
      @subtotal,
      @iva,
      @total_nc,
      @saldo_nc,
      @estado_fuente,
      @descripcion,
      @estado_conciliacion,
      @importacion_id
    )
    ON CONFLICT(numero_nc_normalizado) DO NOTHING
  `);

  const currentDocument = db.prepare(`
    SELECT
      estado_documento,
      COALESCE(saldo_pendiente, total, valor_documento, 0) AS saldo_pendiente
    FROM documentos
    WHERE is_subtotal = 0
      AND documento_normalizado = ?
    LIMIT 1
  `);

  const liveCreditByCreditNote = db.prepare(`
    SELECT
      id,
      documento,
      documento_normalizado,
      total,
      posicion_cartera
    FROM documentos
    WHERE is_subtotal = 0
      AND documento_normalizado = ?
      AND COALESCE(posicion_cartera, 'DEUDA_VIVA') = 'CREDITO_VIVO'
      AND COALESCE(total, 0) < 0
      AND COALESCE(anulado, 0) = 0
    LIMIT 1
  `);

  const updateProjection = db.prepare(`
    UPDATE documentos
    SET
      estado_documento = 'AJUSTADO_NC',
      estado_confirmacion = 'CONFIRMADO',
      estado_fuente = 'NOTAS_CREDITO',
      ultima_conciliacion_en = datetime('now', 'localtime')
    WHERE is_subtotal = 0
      AND documento_normalizado = ?
      AND COALESCE(anulado, 0) = 0
  `);

  const existingCreditNote = db.prepare(`
    SELECT
      id,
      estado_conciliacion,
      importacion_id,
      documento_relacionado_normalizado
    FROM notas_credito_importadas
    WHERE numero_nc_normalizado = ?
    LIMIT 1
  `);

  const markCreditNoteReconciled = db.prepare(`
    UPDATE notas_credito_importadas
    SET estado_conciliacion = 'CONCILIADA'
    WHERE id = ?
      AND estado_conciliacion <> 'CONCILIADA'
  `);

  let newCreditNotes = 0;
  let historicalDuplicates = 0;
  let rehydratedCreditNotes = 0;
  let appliedCreditNotes = 0;
  let pendingCreditNotes = 0;

  const cutoff = (db.prepare(`SELECT cutoff_date FROM reconciliation_control WHERE id=1`).get() as { cutoff_date?: string } | undefined)?.cutoff_date ?? "2024-01-01";
  const replayRows = uniqueRows.filter((row) => !row.fecha || row.fecha >= cutoff).sort((a, b) => a.fecha.localeCompare(b.fecha));

  const transaction = db.transaction(() => {
    for (const row of replayRows) {
      const existing = existingCreditNote.get(
        row.numeroNotaCreditoNormalizado,
      ) as
        | {
            id: number;
            estado_conciliacion: string;
            importacion_id: number | null;
            documento_relacionado_normalizado: string | null;
          }
        | undefined;

      const linked = row.documentoRelacionadoNormalizado
        ? currentDocument.get(row.documentoRelacionadoNormalizado) as
            | {
                estado_documento?: string | null;
                saldo_pendiente?: number | null;
              }
            | undefined
        : undefined;

      const liveCredit = row.numeroNotaCreditoNormalizado
        ? liveCreditByCreditNote.get(row.numeroNotaCreditoNormalizado) as
            | {
                id?: number;
                documento?: string | null;
                documento_normalizado?: string | null;
                total?: number | null;
                posicion_cartera?: string | null;
              }
            | undefined
        : undefined;

      const creditNoteEventKey =
        row.documentoRelacionadoNormalizado
          ? `NC:${row.numeroNotaCreditoNormalizado}:${row.documentoRelacionadoNormalizado}`
          : "";

      // ------------------------------------------------------
      // NC YA INGRESADA EN UNA IMPORTACION ANTERIOR
      // ------------------------------------------------------
      if (existing) {
        historicalDuplicates += 1;

        // Si continúa sin documento relacionado disponible,
        // permanece pendiente y no se reprocesa.
        if (!linked || !row.documentoRelacionadoNormalizado) {
          if (existing.estado_conciliacion === "PENDIENTE_CONCILIACION") {
            pendingCreditNotes += 1;
          }
          continue;
        }

        // Una NC histórica pendiente puede conciliarse posteriormente
        // cuando la factura reaparece en un snapshot futuro.
        if (existing.estado_conciliacion === "PENDIENTE_CONCILIACION") {
          markCreditNoteReconciled.run(existing.id);

          insertDocumentEvent(db, {
            eventKey: creditNoteEventKey,
            documentoNormalizado: row.documentoRelacionadoNormalizado,
            tipoEvento: "NOTA_CREDITO_APLICADA",
            fuente: "NOTAS_CREDITO",
            importe: row.total,
            estadoAnterior:
              linked.estado_documento ?? "ACTIVO_PENDIENTE",
            estadoNuevo: "AJUSTADO_NC",
            provisional: false,

            // Conservamos la trazabilidad de la ingesta original de la NC.
            importacionId: existing.importacion_id ?? importacionId,

            referenciaExterna: row.numeroNotaCredito,
            metadata: {
              autorizacion: row.autorizacion,
              fecha: row.fecha,
              descripcion: row.descripcion,
              persona: row.persona,
              documentoRelacionado: row.documentoRelacionado,
              totalNc: row.total,
              saldoNc: row.saldo,
              creditoVivoPresente: Boolean(liveCredit),
              creditoVivoDocumentoId: liveCredit?.id ?? null,
              creditoVivoSaldo: liveCredit?.total ?? null,
              rehidratada: true,
              rehidratadaPorImportacionId: importacionId,
              regla: liveCredit
                ? "VINCULO_EXPLICITO_SIN_DOBLE_IMPACTO_CREDITO_VIVO"
                : "VINCULO_EXPLICITO_DOCUMENTO_RELACIONADO",
            },
          });

          if (row.fecha) {
            db.prepare(`
              UPDATE documento_eventos
              SET ocurrido_en = ?
              WHERE event_key = ?
            `).run(row.fecha, creditNoteEventKey);
          }

          updateProjection.run(row.documentoRelacionadoNormalizado);

          rehydratedCreditNotes += 1;
          appliedCreditNotes += 1;
        }

        continue;
      }

      // ------------------------------------------------------
      // NC REALMENTE NUEVA
      // ------------------------------------------------------
      newCreditNotes += 1;

      const reconciliationStatus =
        linked ? "CONCILIADA" : "PENDIENTE_CONCILIACION";

      insertNote.run({
        numero_nc: row.numeroNotaCredito,
        numero_nc_normalizado: row.numeroNotaCreditoNormalizado,
        fecha_nc: row.fecha || null,
        tipo_documento_relacionado:
          row.tipoDocumentoRelacionado || null,
        documento_relacionado:
          row.documentoRelacionado || null,
        documento_relacionado_normalizado:
          row.documentoRelacionadoNormalizado || null,
        autorizacion: row.autorizacion || null,
        persona: row.persona || null,
        identificacion: row.identificacion || null,
        vendedor: row.vendedor || null,
        subtotal: row.subtotal,
        iva: row.iva,
        total_nc: row.total,
        saldo_nc: row.saldo,
        estado_fuente: row.estado || null,
        descripcion: row.descripcion || null,
        estado_conciliacion: reconciliationStatus,
        importacion_id: importacionId,
      });

      if (!linked || !row.documentoRelacionadoNormalizado) {
        pendingCreditNotes += 1;
        continue;
      }

      insertDocumentEvent(db, {
        eventKey: creditNoteEventKey,
        documentoNormalizado: row.documentoRelacionadoNormalizado,
        tipoEvento: "NOTA_CREDITO_APLICADA",
        fuente: "NOTAS_CREDITO",
        importe: row.total,
        estadoAnterior:
          linked.estado_documento ?? "ACTIVO_PENDIENTE",
        estadoNuevo: "AJUSTADO_NC",
        provisional: false,
        importacionId,
        referenciaExterna: row.numeroNotaCredito,
        metadata: {
          autorizacion: row.autorizacion,
          fecha: row.fecha,
          descripcion: row.descripcion,
          persona: row.persona,
          documentoRelacionado: row.documentoRelacionado,
          totalNc: row.total,
          saldoNc: row.saldo,
          creditoVivoPresente: Boolean(liveCredit),
          creditoVivoDocumentoId: liveCredit?.id ?? null,
          creditoVivoSaldo: liveCredit?.total ?? null,
          rehidratada: false,
          regla: liveCredit
            ? "VINCULO_EXPLICITO_SIN_DOBLE_IMPACTO_CREDITO_VIVO"
            : "VINCULO_EXPLICITO_DOCUMENTO_RELACIONADO",
        },
      });

      if (row.fecha) {
        db.prepare(`
          UPDATE documento_eventos
          SET ocurrido_en = ?
          WHERE event_key = ?
        `).run(row.fecha, creditNoteEventKey);
      }

      // La NC explica el cambio de estado; NO resta de nuevo el saldo
      // porque Cartera Contífico ya es el snapshot financiero vigente.
      updateProjection.run(row.documentoRelacionadoNormalizado);

      appliedCreditNotes += 1;
    }
    db.prepare(`
      UPDATE importaciones
      SET
        registros_leidos = ?,
        registros_importados = ?,
        registros_ignorados = ?,
        registros_duplicados = ?,
        estado = ?,
        observacion = ?,
        metadata_json = ?
      WHERE id = ?
    `).run(
      preview.totalRows,
      newCreditNotes,
      historicalDuplicates,
      preview.duplicateRows,
      pendingCreditNotes > 0 ? "COMPLETADA_ADVERTENCIAS" : "COMPLETADA",
      `Notas de crédito: ${preview.uniqueCreditNotes} únicas; ` +
        `${appliedCreditNotes} conciliadas; ${pendingCreditNotes} pendientes.`,
      JSON.stringify({
        totalRows: preview.totalRows,
        uniqueCreditNotes: preview.uniqueCreditNotes,
        duplicateRows: preview.duplicateRows,
        historicalDuplicates,
        newCreditNotes,
        rehydratedCreditNotes,
        matchedDocuments: preview.matchedDocuments,
        unmatchedDocuments: preview.unmatchedDocuments,
        missingRelatedDocument: preview.missingRelatedDocument,
        totalAmount: preview.totalAmount,
        appliedCreditNotes,
        pendingCreditNotes,
      }),
      importacionId,
    );
  });

  transaction();

  return {
    ...preview,
    importacionId,
    appliedCreditNotes,
    pendingCreditNotes,
    message:
      `Importación completada: ${preview.uniqueCreditNotes} notas únicas; ` +
      `${appliedCreditNotes} conciliadas y ${pendingCreditNotes} pendientes.`,
  };
}

