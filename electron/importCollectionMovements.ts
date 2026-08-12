import type Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { normalizeDocumentNumber } from "./reconciliation/documentIdentity";
import { insertDocumentEvent } from "./reconciliation/eventRepository";

type RawRow = Record<string, unknown>;

export type CollectionMovementClass =
  | "COBRO"
  | "CRUCE"
  | "ANTICIPO"
  | "RETENCION"
  | "OTRO";

export interface CollectionMovementPreviewRow {
  sourceRow: number;
  fecha: string;
  identificacion: string;
  persona: string;
  tipoFuente: string;
  formaCobroPago: string;
  asiento: string;
  documentoCruce: string;
  codigoComprobante: string;
  documentoRelacionado: string;
  documentoRelacionadoNormalizado: string;
  detalle: string;
  valor: number;
  claseMovimiento: CollectionMovementClass;
  matchStatus: "ENCONTRADO" | "NO_ENCONTRADO" | "SIN_DOCUMENTO";
  movementKey: string;
}

export interface CollectionMovementPreviewResult {
  ok: boolean;
  filePath: string;
  sheetName: string;
  totalRows: number;
  sourceCollections: number;
  ignoredPayments: number;
  proveedoresExcluidos: number;
  legacyRows: number;
  uniqueMovements: number;
  duplicateRows: number;
  matchedDocuments: number;
  unmatchedDocuments: number;
  missingDocument: number;
  totalValue: number;
  classes: Record<CollectionMovementClass, { count: number; value: number }>;
  rows: CollectionMovementPreviewRow[];
  message: string;
}

export interface CollectionMovementImportResult
  extends CollectionMovementPreviewResult {
  importacionId?: number;
  importedMovements: number;
  existingMovements: number;
  reconciledMovements: number;
  pendingMovements: number;
}

const text = (value: unknown): string => String(value ?? "").trim();

const money = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(Math.abs(value) * 100) / 100;
  }

  const raw = text(value)
    .replace(/\s+/g, "")
    .replace(/\$/g, "");

  if (!raw) return 0;

  let normalized = raw;
  const comma = raw.lastIndexOf(",");
  const dot = raw.lastIndexOf(".");

  if (comma >= 0 && dot >= 0) {
    normalized =
      comma > dot
        ? raw.replace(/\./g, "").replace(",", ".")
        : raw.replace(/,/g, "");
  } else if (comma >= 0) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(Math.abs(parsed) * 100) / 100 : 0;
};

function normalizeHeader(value: unknown): string {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function rowObject(headers: unknown[], row: unknown[]): RawRow {
  const result: RawRow = {};
  headers.forEach((header, index) => {
    result[normalizeHeader(header)] = row[index];
  });
  return result;
}

function findHeaderRow(rows: unknown[][]): number {
  return rows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return (
      headers.includes("fecha") &&
      headers.includes("tipo") &&
      headers.some((h) => h.includes("forma cobro pago")) &&
      headers.some((h) => h.includes("codigo comprobante")) &&
      headers.includes("valor")
    );
  });
}

function formatDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const month = String(parsed.m).padStart(2, "0");
      const day = String(parsed.d).padStart(2, "0");
      return `${parsed.y}-${month}-${day}`;
    }
  }

  const raw = text(value);
  if (!raw) return "";

  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    return `${year}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }

  return raw;
}

function classifyMovement(
  tipoFuente: string,
  forma: string,
  detalle: string,
): CollectionMovementClass {
  const normalizedType = tipoFuente
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

  const source = `${forma} ${detalle}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  // Las subclasificaciones explícitas prevalecen sobre el tipo fuente COBRO.
  if (source.includes("RETENC")) return "RETENCION";
  if (source.includes("ANTICIP")) return "ANTICIPO";
  if (source.includes("CRUCE") || source.includes("COMPENS")) return "CRUCE";
  if (
    source.includes("CAJA") ||
    source.includes("EFECT") ||
    source.includes("TRANSFER") ||
    source.includes("CHEQUE") ||
    source.includes("DEPOS") ||
    source.includes("TARJ") ||
    source.includes("BANCO") ||
    source.includes("COBRO") ||
    source.includes("PAGO")
  ) {
    return "COBRO";
  }

  // Contífico ya define estas filas como COBRO. El texto libre solo sirve para
  // especializar la clase (cruce/anticipo/retención), no para negar su naturaleza.
  if (normalizedType === "COBRO") return "COBRO";

  return "OTRO";
}

function extractInvoiceReference(
  codigoComprobante: string,
  documentoCruce: string,
): string {
  const candidates = [codigoComprobante, documentoCruce];

  for (const candidate of candidates) {
    if (!candidate) continue;

    const formatted = candidate.match(/\b\d{3}-\d{3}-\d{9}\b/);
    if (formatted?.[0]) return formatted[0];

    const digits = candidate.replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 15) return digits;
  }

  return "";
}

function movementKey(row: {
  fecha: string;
  identificacion: string;
  persona: string;
  formaCobroPago: string;
  asiento: string;
  documentoCruce: string;
  codigoComprobante: string;
  valor: number;
  detalle: string;
}): string {
  return createHash("sha256")
    .update(
      [
        row.fecha,
        row.identificacion,
        row.persona,
        row.formaCobroPago,
        row.asiento,
        row.documentoCruce,
        row.codigoComprobante,
        row.valor.toFixed(2),
        row.detalle,
      ].join("|"),
      "utf8",
    )
    .digest("hex");
}

function emptyClasses(): Record<
  CollectionMovementClass,
  { count: number; value: number }
> {
  return {
    COBRO: { count: 0, value: 0 },
    CRUCE: { count: 0, value: 0 },
    ANTICIPO: { count: 0, value: 0 },
    RETENCION: { count: 0, value: 0 },
    OTRO: { count: 0, value: 0 },
  };
}

function parseReport(
  filePath: string,
  db: Database.Database,
): CollectionMovementPreviewResult {
  const workbook = XLSX.read(readFileSync(filePath), {
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
      "No se encontró la cabecera de Cobros/Pagos Detallado. " +
        "En Contífico usa filtro TODOS y Excel Detallado.",
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

  const rows: CollectionMovementPreviewRow[] = [];
  let ignoredPayments = 0;

  const excludedProviderTypes = new Set([
    "PAGO",
    "PAGO MASIVO",
    "COBRO MASIVO",
    "COBRO/PAGO MASIVO",
  ]);
  const includedCustomerTypes = new Set(["COBRO", "CRUCE"]);

  for (
    let matrixIndex = headerIndex + 1;
    matrixIndex < matrix.length;
    matrixIndex += 1
  ) {
    const source = rowObject(headers, matrix[matrixIndex]);
    const tipoFuente = text(source["tipo"]);

    if (!tipoFuente) continue;

    const normalizedType = tipoFuente
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();

    // PACK-045-FIX-009 — frontera semántica estricta:
    // cartera de clientes = COBRO/CRUCE; pagos/masivos = proveedores excluidos.
    if (excludedProviderTypes.has(normalizedType)) {
      ignoredPayments += 1;
      continue;
    }
    if (!includedCustomerTypes.has(normalizedType)) {
      // Tipos no reconocidos no ingresan silenciosamente a cartera. Se contabilizan
      // como ignorados para mantener registros_leidos = in_scope + ignorados + legacy
      // (salvo duplicados internos, reportados aparte).
      ignoredPayments += 1;
      continue;
    }

    const fecha = formatDate(source["fecha"]);
    const identificacion = text(source["identificacion"]);
    const persona = text(source["persona"]);
    const formaCobroPago = text(
      source["forma cobro pago"] ??
        source["forma cobro/pago"] ??
        source["forma cobro"] ??
        source["forma pago"],
    );
    const asiento = text(source["# asiento"] ?? source["asiento"]);
    const documentoCruce = text(source["documento cruce"]);
    const codigoComprobante = text(source["codigo comprobante"]);
    const detalle = text(source["detalle"]);
    const valor = money(source["valor"]);

    if (valor <= 0) continue;

    const documentoRelacionado = extractInvoiceReference(
      codigoComprobante,
      documentoCruce,
    );
    const documentoRelacionadoNormalizado = documentoRelacionado
      ? normalizeDocumentNumber(documentoRelacionado)
      : "";

    const matchStatus: CollectionMovementPreviewRow["matchStatus"] =
      !documentoRelacionadoNormalizado
        ? "SIN_DOCUMENTO"
        : existsDocument.get(documentoRelacionadoNormalizado)
          ? "ENCONTRADO"
          : "NO_ENCONTRADO";

    const claseMovimiento = classifyMovement(
      normalizedType,
      formaCobroPago,
      detalle,
    );

    const core = {
      fecha,
      identificacion,
      persona,
      formaCobroPago,
      asiento,
      documentoCruce,
      codigoComprobante,
      valor,
      detalle,
    };

    rows.push({
      sourceRow: matrixIndex + 1,
      ...core,
      tipoFuente: "Cobro",
      documentoRelacionado,
      documentoRelacionadoNormalizado,
      claseMovimiento,
      matchStatus,
      movementKey: movementKey(core),
    });
  }

  const uniqueMap = new Map<string, CollectionMovementPreviewRow>();
  for (const row of rows) {
    if (!uniqueMap.has(row.movementKey)) uniqueMap.set(row.movementKey, row);
  }
  const uniqueRows = [...uniqueMap.values()];

  const classes = emptyClasses();
  for (const row of uniqueRows) {
    classes[row.claseMovimiento].count += 1;
    classes[row.claseMovimiento].value = money(
      classes[row.claseMovimiento].value + row.valor,
    );
  }

  const matchedDocuments = uniqueRows.filter(
    (row) => row.matchStatus === "ENCONTRADO",
  ).length;
  const unmatchedDocuments = uniqueRows.filter(
    (row) => row.matchStatus === "NO_ENCONTRADO",
  ).length;
  const missingDocument = uniqueRows.filter(
    (row) => row.matchStatus === "SIN_DOCUMENTO",
  ).length;

  const cutoffDate = (
    db.prepare(`SELECT cutoff_date FROM reconciliation_control WHERE id = 1`).get() as
      | { cutoff_date?: string | null }
      | undefined
  )?.cutoff_date ?? "2024-01-01";
  const legacyRows = uniqueRows.filter(
    (row) => Boolean(row.fecha) && row.fecha < cutoffDate,
  ).length;

  return {
    ok: true,
    filePath,
    sheetName,
    totalRows: rows.length + ignoredPayments,
    sourceCollections: rows.length,
    ignoredPayments,
    proveedoresExcluidos: ignoredPayments,
    legacyRows,
    uniqueMovements: uniqueRows.length,
    duplicateRows: Math.max(rows.length - uniqueRows.length, 0),
    matchedDocuments,
    unmatchedDocuments,
    missingDocument,
    totalValue: money(uniqueRows.reduce((sum, row) => sum + row.valor, 0)),
    classes,
    rows,
    message:
      `Vista previa: ${uniqueRows.length} movimientos únicos de cobro; ` +
      `${matchedDocuments} vinculados a documentos vigentes y ` +
      `${unmatchedDocuments + missingDocument} pendientes de conciliación.`,
  };
}

export function previewCollectionMovementsExcel(
  filePath: string,
  db: Database.Database,
): CollectionMovementPreviewResult {
  return parseReport(filePath, db);
}

export function importCollectionMovementsExcel(
  filePath: string,
  db: Database.Database,
  importacionId: number,
): CollectionMovementImportResult {
  const preview = parseReport(filePath, db);
  const uniqueRows = Array.from(
    new Map(preview.rows.map((row) => [row.movementKey, row] as const)).values(),
  );

  const existsLedger = db.prepare(`
    SELECT 1
    FROM cobros_movimientos_importados
    WHERE movimiento_key = ?
    LIMIT 1
  `);

  const insertMovement = db.prepare(`
    INSERT INTO cobros_movimientos_importados (
      movimiento_key,
      fecha_movimiento,
      identificacion,
      persona,
      tipo_fuente,
      forma_cobro_pago,
      asiento,
      documento_cruce,
      codigo_comprobante,
      documento_relacionado,
      documento_relacionado_normalizado,
      detalle,
      valor,
      clase_movimiento,
      estado_conciliacion,
      importacion_id
    ) VALUES (
      @movimiento_key,
      @fecha_movimiento,
      @identificacion,
      @persona,
      @tipo_fuente,
      @forma_cobro_pago,
      @asiento,
      @documento_cruce,
      @codigo_comprobante,
      @documento_relacionado,
      @documento_relacionado_normalizado,
      @detalle,
      @valor,
      @clase_movimiento,
      @estado_conciliacion,
      @importacion_id
    )
  `);

  const currentDocument = db.prepare(`
    SELECT estado_documento
    FROM documentos
    WHERE is_subtotal = 0
      AND documento_normalizado = ?
    LIMIT 1
  `);

  let importedMovements = 0;
  let existingMovements = 0;
  let reconciledMovements = 0;
  let pendingMovements = 0;

  const cutoff = (db.prepare(`SELECT cutoff_date FROM reconciliation_control WHERE id=1`).get() as { cutoff_date?: string } | undefined)?.cutoff_date ?? "2024-01-01";
  const replayRows = uniqueRows.filter((row) => !row.fecha || row.fecha >= cutoff).sort((a, b) => a.fecha.localeCompare(b.fecha));

  const transaction = db.transaction(() => {
    for (const row of replayRows) {
      if (existsLedger.get(row.movementKey)) {
        existingMovements += 1;
        continue;
      }

      const linked =
        row.documentoRelacionadoNormalizado &&
        currentDocument.get(row.documentoRelacionadoNormalizado);

      const estadoConciliacion = linked
        ? "CONCILIADO"
        : "PENDIENTE_CONCILIACION";

      insertMovement.run({
        movimiento_key: row.movementKey,
        fecha_movimiento: row.fecha || null,
        identificacion: row.identificacion || null,
        persona: row.persona || null,
        tipo_fuente: row.tipoFuente,
        forma_cobro_pago: row.formaCobroPago || null,
        asiento: row.asiento || null,
        documento_cruce: row.documentoCruce || null,
        codigo_comprobante: row.codigoComprobante || null,
        documento_relacionado: row.documentoRelacionado || null,
        documento_relacionado_normalizado:
          row.documentoRelacionadoNormalizado || null,
        detalle: row.detalle || null,
        valor: row.valor,
        clase_movimiento: row.claseMovimiento,
        estado_conciliacion: estadoConciliacion,
        importacion_id: importacionId,
      });

      importedMovements += 1;

      if (linked && row.documentoRelacionadoNormalizado) {
        const linkedRow = linked as { estado_documento?: string | null };

        insertDocumentEvent(db, {
          eventKey: `COBRO:${row.movementKey}`,
          documentoNormalizado: row.documentoRelacionadoNormalizado,
          tipoEvento: "COBRO_CONFIRMADO",
          fuente: "COBROS_MOVIMIENTOS",
          importe: row.valor,
          estadoAnterior: linkedRow.estado_documento ?? "ACTIVO_PENDIENTE",
          estadoNuevo: linkedRow.estado_documento ?? "ACTIVO_PENDIENTE",
          provisional: false,
          importacionId,
          referenciaExterna:
            row.asiento || row.codigoComprobante || row.movementKey.slice(0, 16),
          metadata: {
            fechaMovimiento: row.fecha,
            persona: row.persona,
            identificacion: row.identificacion,
            formaCobroPago: row.formaCobroPago,
            codigoComprobante: row.codigoComprobante,
            documentoCruce: row.documentoCruce,
            claseMovimiento: row.claseMovimiento,
            detalle: row.detalle,
            regla:
              "COBRO_EXPLICITO_AUDITABLE_SIN_REDUCIR_BASELINE_ACTUAL",
          },
        });

        // El ledger histórico debe reproducir la fecha económica real, no la fecha
        // de ingesta. insertDocumentEvent es compartido y conserva su API; aquí
        // proyectamos ocurrido_en de forma idempotente usando event_key.
        if (row.fecha) {
          db.prepare(`
            UPDATE documento_eventos
            SET ocurrido_en = ?
            WHERE event_key = ?
              AND fuente = 'COBROS_MOVIMIENTOS'
              AND tipo_evento = 'COBRO_CONFIRMADO'
          `).run(row.fecha, `COBRO:${row.movementKey}`);
        }

        reconciledMovements += 1;
      } else {
        pendingMovements += 1;
      }
    }

    const duplicateTotal =
      preview.duplicateRows + existingMovements;

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
      importedMovements,
      preview.ignoredPayments,
      duplicateTotal,
      pendingMovements > 0 ? "COMPLETADA_ADVERTENCIAS" : "COMPLETADA",
      `Cobros/Pagos: ${preview.sourceCollections} filas tipo Cobro; ` +
        `${preview.ignoredPayments} filas tipo Pago excluidas; ` +
        `${importedMovements} movimientos nuevos; ` +
        `${reconciledMovements} conciliados; ${pendingMovements} pendientes.`,
      JSON.stringify({
        sourceCollections: preview.sourceCollections,
        ignoredPayments: preview.ignoredPayments,
        proveedoresExcluidos: preview.proveedoresExcluidos,
        legacyRows: preview.legacyRows,
        cutoffPolicy: "LEGACY_SOLO_FECHA_MOVIMIENTO_ANTERIOR_A_CUTOFF",
        uniqueMovements: preview.uniqueMovements,
        duplicateRowsInFile: preview.duplicateRows,
        existingMovements,
        importedMovements,
        reconciledMovements,
        pendingMovements,
        matchedDocuments: preview.matchedDocuments,
        unmatchedDocuments: preview.unmatchedDocuments,
        missingDocument: preview.missingDocument,
        totalValue: preview.totalValue,
        classes: preview.classes,
        balancePolicy:
          "Los cobros históricos confirman y explican movimientos; no reducen nuevamente el saldo del corte de cartera vigente.",
      }),
      importacionId,
    );
  });

  transaction();

  return {
    ...preview,
    importacionId,
    importedMovements,
    existingMovements,
    reconciledMovements,
    pendingMovements,
    message:
      `Importación completada: ${importedMovements} movimientos nuevos; ` +
      `${reconciledMovements} conciliados; ${pendingMovements} pendientes; ` +
      `${preview.ignoredPayments} filas tipo Pago excluidas de cartera de clientes.`,
  };
}
