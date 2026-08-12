import * as XLSX from "xlsx";
import fs from "node:fs";
import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { normalizeDocumentNumber } from "./reconciliation/documentIdentity";
import { reconcileDocument } from "./reconciliation/reconciliationEngine";
import { comparePortfolioSnapshots, type PortfolioSnapshotDocument } from "./reconciliation/portfolioDeltaEngine";
import { classifyTemporalScope, toMoneyCents } from "./reconciliation/reconciliationConfig";
import {
  applyCurrentProjection,
  insertDocumentEvent,
  upsertDocumentBalance,
} from "./reconciliation/eventRepository";

export type ImportResult = {
  ok: boolean;
  filePath: string;
  insertedDocs: number;
  insertedClientes: number;
  omittedRows: number;
  descuadresDetectados?: number;
  baseline: boolean;
  snapshotId?: number;
  snapshotAnteriorId?: number | null;
  nuevos: number;
  sinCambios: number;
  reducidos: number;
  incrementados: number;
  desaparecidos: number;
  legacy: number;
  eventosGenerados: number;
  message?: string;
};

// -----------------------------
// Helpers
// -----------------------------
function normHeader(s: unknown): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .replace(/\./g, "")
    .replace(/#/g, "#")
    .replace(/\(\s*/g, "(")
    .replace(/\s*\)/g, ")")
    .trim();
}

function toISODate(v: unknown): string {
  if (v == null || v === "") return "";

  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }

  if (typeof v === "number") {
    const dc = XLSX.SSF.parse_date_code(v);
    if (dc && dc.y && dc.m && dc.d) {
      const yyyy = String(dc.y).padStart(4, "0");
      const mm = String(dc.m).padStart(2, "0");
      const dd = String(dc.d).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  const s = String(v).trim();
  const m = s.match(/^([0-3]?\d)[/-]([0-1]?\d)[/-](\d{2}|\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    const yy = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yy}-${mm}-${dd}`;
  }
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) return s;

  return "";
}

function toNumber(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;

  let s = String(v).trim();
  if (!s) return 0;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    const decSep = lastComma > lastDot ? "," : ".";
    const thouSep = decSep === "," ? "." : ",";
    s = s.split(thouSep).join("");
    s = decSep === "," ? s.replace(/,/g, ".") : s;
  } else if (hasComma && !hasDot) {
    s = s.replace(/\./g, "");
    s = s.replace(/,/g, ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function findHeaderRow(rows: unknown[][]): { idx: number; map: Record<string, number> } {
  // Aliases flexibles para ubicar la fila de encabezados sin recortar estáticamente
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const row = rows[i] ?? [];
    const norm = row.map(normHeader);
    
    const hasCliente = norm.some(h => h.includes("cliente") || h.includes("razon social"));
    const hasDoc = norm.some(h => h.includes("documento") || h.includes("doc"));
    const hasTotal = norm.some(h => h === "total");

    if (hasCliente && hasDoc && hasTotal) {
      const map: Record<string, number> = {};
      for (let c = 0; c < norm.length; c++) {
        const k = norm[c];
        if (k) map[k] = c;
      }
      return { idx: i, map };
    }
  }
  return { idx: -1, map: {} };
}

function getCell(row: unknown[], map: Record<string, number>, key: string): unknown {
  const idx = map[key];
  if (idx == null) return "";
  return row[idx];
}


function parseISODate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
function differenceInCalendarDays(from: string, to: string): number | null {
  const start=parseISODate(from); const end=parseISODate(to);
  if(!start || !end) return null;
  return Math.round((end.getTime()-start.getTime())/86400000);
}
function addCalendarDays(dateValue: string, days: number): string {
  const date=parseISODate(dateValue); if(!date) return "";
  date.setDate(date.getDate()+days); return date.toISOString().slice(0,10);
}
type CreditPolicy = { tipo_credito: string; dias_credito: number | null; credito_configurado: number; };

// -----------------------------
// Import Principal — PACK 044
// -----------------------------
export function importarCarteraPorCobrarExcel(
  filePath: string,
  db: Database.Database,
  importacionId?: number,
): ImportResult {
  const generationRow = db.prepare(`
    SELECT generation, mode, cutoff_date, next_snapshot_date
    FROM reconciliation_control
    WHERE id = 1
  `).get() as { generation?: number; mode?: string; cutoff_date?: string; next_snapshot_date?: string | null } | undefined;
  const generation = Number(generationRow?.generation ?? 1);
  const cutoffDate = String(generationRow?.cutoff_date ?? '2024-01-01');
  // PACK045-FIX-001: Cartera Contífico es LIVE_OUTSTANDING_SNAPSHOT.
  // Nunca se le asigna una fecha histórica artificial: la fecha de snapshot es
  // la fecha local real de ingesta, incluso durante HISTORICAL_LOAD.
  const effectiveSnapshotDate = String(
    (db.prepare(`SELECT date('now','localtime') AS value`).get() as { value?: string } | undefined)?.value
      ?? new Date().toISOString().slice(0, 10),
  );

  const previousSnapshot = db.prepare(`
    SELECT id, fecha_snapshot
    FROM cartera_snapshots
    WHERE generation = ?
    ORDER BY fecha_snapshot DESC, id DESC
    LIMIT 1
  `).get(generation) as { id: number; fecha_snapshot: string } | undefined;


  const snapshotAnteriorId = previousSnapshot?.id ?? null;
  const baseline = snapshotAnteriorId == null;

  const previousRows: PortfolioSnapshotDocument[] = snapshotAnteriorId
    ? (db.prepare(`
        SELECT
          documento_normalizado,
          documento,
          COALESCE(cliente, '') AS cliente,
          COALESCE(fecha_emision, '') AS fecha_emision,
          saldo,
          temporal_scope,
          COALESCE(posicion_cartera, 'DEUDA_VIVA') AS posicion_cartera
        FROM cartera_snapshot_documentos
        WHERE snapshot_id = ?
      `).all(snapshotAnteriorId) as Array<{
        documento_normalizado: string;
        documento: string;
        cliente: string;
        fecha_emision: string;
        saldo: number;
        temporal_scope: "IN_SCOPE" | "OUT_OF_SCOPE_LEGACY";
        posicion_cartera: "DEUDA_VIVA" | "CREDITO_VIVO";
      }>).map((row) => ({
        documentoNormalizado: row.documento_normalizado,
        documento: row.documento,
        cliente: row.cliente,
        fechaEmision: row.fecha_emision,
        saldo: Number(row.saldo ?? 0),
        temporalScope: row.temporal_scope,
        positionType: row.posicion_cartera,
      }))
    : [];

  // Conservamos estados explícitos de la proyección anterior para documentos
  // que permanecen idénticos. El snapshot define presencia/saldo; documentos
  // sigue siendo la proyección de consulta actual.
  const previousProjection = new Map<string, {
    estadoDocumento: string;
    estadoConfirmacion: string;
    estadoFuente: string;
    saldoOriginal: number;
  }>();

  for (const row of db.prepare(`
    SELECT
      documento_normalizado,
      estado_documento,
      estado_confirmacion,
      estado_fuente,
      saldo_original
    FROM documentos
    WHERE is_subtotal = 0
      AND TRIM(COALESCE(documento_normalizado, '')) <> ''
  `).all() as Array<{
    documento_normalizado: string;
    estado_documento: string | null;
    estado_confirmacion: string | null;
    estado_fuente: string | null;
    saldo_original: number | null;
  }>) {
    previousProjection.set(row.documento_normalizado, {
      estadoDocumento: row.estado_documento || "ACTIVO_PENDIENTE",
      estadoConfirmacion: row.estado_confirmacion || "CONFIRMADO",
      estadoFuente: row.estado_fuente || "CARTERA_CONTIFICO",
      saldoOriginal: Number(row.saldo_original ?? 0),
    });
  }

  const excelBuffer = fs.readFileSync(filePath);
  const wb = XLSX.read(excelBuffer, {
    type: "buffer",
    cellDates: true,
    cellNF: false,
    cellText: false,
  });
  const wsName = wb.SheetNames[0];
  const ws = wb.Sheets[wsName];

  const emptyResult = (message: string): ImportResult => ({
    ok: false,
    filePath,
    insertedDocs: 0,
    insertedClientes: 0,
    omittedRows: 0,
    descuadresDetectados: 0,
    baseline,
    snapshotAnteriorId,
    nuevos: 0,
    sinCambios: 0,
    reducidos: 0,
    incrementados: 0,
    desaparecidos: 0,
    legacy: 0,
    eventosGenerados: 0,
    message,
  });

  if (!ws) {
    return emptyResult("No se encontró una hoja válida en el Excel.");
  }

  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
    raw: true,
  }) as unknown[][];

  const header = findHeaderRow(rows);
  if (header.idx < 0) {
    return emptyResult(
      "No se detectó el encabezado esperado en el archivo de Contifico.",
    );
  }

  const map = header.map;
  const pick = (key: string, ...aliases: string[]): string => {
    if (map[key] != null) return key;
    for (const alias of aliases) {
      if (map[alias] != null) return alias;
    }
    return key;
  };

  const kCliente = pick("cliente", "razon social", "razon social ", "razon");
  const kTipoDoc = pick("tipo documento", "tipo doc", "tipo");
  const kDoc = pick(
    "# documento",
    "#documento",
    "documento",
    "n° documento",
    "numero documento",
  );
  const kEmision = pick("f. emision", "f emision", "fecha emision");
  const kVence = pick("f. vencimiento", "f vencimiento", "fecha vencimiento");
  const kVendedor = pick("vendedor");
  const kCentro = pick("centro de costo", "centro costo");
  const kCategoria = pick("categoria de persona", "categoria persona");
  const kPorVencer = pick("por vencer", "porvencer");
  const k30 = pick("30 dias", "30 dia", "30 dias ");
  const k60 = pick("60 dias");
  const k90 = pick("90 dias");
  const k120 = pick("120 dias");
  const kMas120 = pick("> 120 dias", ">120 dias", "> 120 días", ">120 días");
  const kTotal = pick("total");
  const kDescripcion = pick("descripcion", "descripción");
  const kValorDoc = pick("valor documento", "valor del documento", "valor");
  const kRet = pick("retenciones", "retencion");
  const kCobros = pick("cobros", "cobro");

  const stmtInsertDoc = db.prepare(`
    INSERT INTO documentos (
      cliente, razon_social, tipo_documento, documento, documento_normalizado,
      posicion_cartera,
      fecha_emision, fecha_vencimiento,
      vendedor,
      total, descripcion, valor_documento, retenciones, cobros,
      dias_credito_aplicados, credito_fuente, credito_pendiente,
      is_subtotal
    ) VALUES (
      @cliente, @razon_social, @tipo_documento, @documento, @documento_normalizado,
      @posicion_cartera,
      @fecha_emision, @fecha_vencimiento,
      @vendedor,
      @total, @descripcion, @valor_documento, @retenciones, @cobros,
      @dias_credito_aplicados, @credito_fuente, @credito_pendiente,
      @is_subtotal
    )
  `);

  const stmtUpsertCliente = db.prepare(`
    INSERT INTO clientes (
      cliente,
      razon_social,
      categoria_persona,
      vendedor,
      centro_costo
    )
    VALUES (
      @cliente,
      @razon_social,
      @categoria_persona,
      @vendedor,
      @centro_costo
    )
    ON CONFLICT(cliente) DO UPDATE SET
      razon_social = excluded.razon_social,
      categoria_persona = COALESCE(
        excluded.categoria_persona,
        clientes.categoria_persona
      ),
      vendedor = COALESCE(excluded.vendedor, clientes.vendedor),
      centro_costo = COALESCE(excluded.centro_costo, clientes.centro_costo)
  `);

  const stmtGetCreditPolicy = db.prepare(`
    SELECT tipo_credito, dias_credito, credito_configurado
    FROM clientes
    WHERE cliente = ?
    LIMIT 1
  `);

  const stmtUpsertCreditAlert = db.prepare(`
    INSERT INTO alertas_credito (
      cliente,
      motivo,
      estado,
      detectado_en,
      resuelto_en
    )
    VALUES (
      @cliente,
      @motivo,
      'PENDIENTE',
      datetime('now', 'localtime'),
      NULL
    )
    ON CONFLICT(cliente) DO UPDATE SET
      motivo = excluded.motivo,
      estado = 'PENDIENTE',
      detectado_en = excluded.detectado_en,
      resuelto_en = NULL
  `);

  const stmtResolveCreditAlert = db.prepare(`
    UPDATE alertas_credito
    SET estado = 'RESUELTA',
        resuelto_en = datetime('now', 'localtime')
    WHERE cliente = ?
      AND estado <> 'RESUELTA'
  `);

  const stmtRestoreProjectionState = db.prepare(`
    UPDATE documentos
    SET
      estado_documento = ?,
      estado_confirmacion = ?,
      estado_fuente = ?,
      saldo_pendiente = CASE
        WHEN COALESCE(posicion_cartera, 'DEUDA_VIVA') = 'CREDITO_VIVO'
        THEN 0
        ELSE total
      END,
      saldo_original = CASE
        WHEN ? > 0 THEN ?
        ELSE MAX(COALESCE(valor_documento, 0), COALESCE(total, 0))
      END
    WHERE is_subtotal = 0
      AND documento_normalizado = ?
  `);

  let insertedDocs = 0;
  let insertedClientes = 0;
  let omittedRows = 0;
  let descuadresDetectados = 0;
  let legacy = 0;
  let eventosGenerados = 0;
  let snapshotId: number | undefined;

  const currentRows: PortfolioSnapshotDocument[] = [];
  const dataRows = rows.slice(header.idx + 1);

  const tx = db.transaction(() => {
    // documentos es la proyección del corte vigente. El histórico compacto
    // vive en cartera_snapshots + cartera_snapshot_documentos.
    db.exec("DELETE FROM documentos;");

    for (const row of dataRows) {
      const cliente = String(getCell(row, map, kCliente)).trim();
      const tipoDocumento = String(getCell(row, map, kTipoDoc)).trim();
      const documento = String(getCell(row, map, kDoc)).trim();

      if (!cliente && !tipoDocumento && !documento) {
        omittedRows += 1;
        continue;
      }

      const razonSocial = String(getCell(row, map, kCliente)).trim();
      const fechaEmision = toISODate(getCell(row, map, kEmision));
      const temporalScope = classifyTemporalScope(fechaEmision);

      // Preexistencias anteriores a 2024-01-01 permanecen fuera de la
      // máquina de estados automatizada.
      if (temporalScope === "OUT_OF_SCOPE_LEGACY") {
        legacy += 1;
        continue;
      }

      const fechaVencimientoImportada = toISODate(getCell(row, map, kVence));
      const policy = cliente
        ? (stmtGetCreditPolicy.get(cliente) as CreditPolicy | undefined)
        : undefined;

      const importedCreditDays = differenceInCalendarDays(
        fechaEmision,
        fechaVencimientoImportada,
      );
      const importedDueDateIsValid =
        importedCreditDays != null && importedCreditDays > 0;

      let fechaVencimiento = fechaVencimientoImportada;
      let diasCreditoAplicados: number | null = importedCreditDays;
      let creditoFuente = "CONTIFICO";
      let creditoPendiente = 0;

      if (!importedDueDateIsValid) {
        const configured =
          policy?.credito_configurado === 1 &&
          policy.dias_credito != null &&
          Number.isFinite(Number(policy.dias_credito));

        if (configured) {
          const configuredDays = Math.max(0, Number(policy?.dias_credito ?? 0));
          fechaVencimiento = addCalendarDays(fechaEmision, configuredDays);
          diasCreditoAplicados = configuredDays;
          creditoFuente = "POLITICA_CLIENTE";
        } else {
          fechaVencimiento = fechaEmision || fechaVencimientoImportada;
          diasCreditoAplicados = null;
          creditoFuente = "PENDIENTE_CONFIGURACION";
          creditoPendiente = 1;
        }
      }

      const vendedor = String(getCell(row, map, kVendedor)).trim();
      const centroCosto = String(getCell(row, map, kCentro)).trim();
      const categoriaPersona = String(getCell(row, map, kCategoria)).trim();

      const porVencer = toNumber(getCell(row, map, kPorVencer));
      const dias30 = toNumber(getCell(row, map, k30));
      const dias60 = toNumber(getCell(row, map, k60));
      const dias90 = toNumber(getCell(row, map, k90));
      const dias120 = toNumber(getCell(row, map, k120));
      const diasMas120 = toNumber(getCell(row, map, kMas120));
      const total = toNumber(getCell(row, map, kTotal));
      const posicionCartera: "DEUDA_VIVA" | "CREDITO_VIVO" =
        tipoDocumento.trim().toUpperCase() === "NCT" && total < 0
          ? "CREDITO_VIVO"
          : "DEUDA_VIVA";
      const descripcion = String(getCell(row, map, kDescripcion)).trim();
      const valorDocumento = toNumber(getCell(row, map, kValorDoc));
      const retenciones = toNumber(getCell(row, map, kRet));
      const cobros = toNumber(getCell(row, map, kCobros));

      const sumaTramos =
        porVencer + dias30 + dias60 + dias90 + dias120 + diasMas120;

      if (
        Math.abs(sumaTramos - total) > 0.01 &&
        (tipoDocumento || documento)
      ) {
        descuadresDetectados += 1;
      }

      const isSubtotal =
        tipoDocumento || (documento && cliente) ? 0 : 1;

      if (cliente) {
        stmtUpsertCliente.run({
          cliente,
          razon_social: razonSocial,
          categoria_persona: categoriaPersona,
          vendedor,
          centro_costo: centroCosto,
        });
        insertedClientes += 1;

        if (creditoPendiente === 1) {
          stmtUpsertCreditAlert.run({
            cliente,
            motivo:
              "Cliente sin dias de credito configurados y vencimiento importado no valido",
          });
        } else {
          stmtResolveCreditAlert.run(cliente);
        }
      }

      const docKey = !isSubtotal
        ? normalizeDocumentNumber(documento)
        : "";

      stmtInsertDoc.run({
        cliente,
        razon_social: razonSocial,
        tipo_documento: tipoDocumento,
        documento,
        documento_normalizado: docKey,
        posicion_cartera: posicionCartera,
        fecha_emision: fechaEmision,
        fecha_vencimiento: fechaVencimiento,
        vendedor,
        total,
        descripcion,
        valor_documento: valorDocumento,
        retenciones,
        cobros,
        dias_credito_aplicados: diasCreditoAplicados,
        credito_fuente: creditoFuente,
        credito_pendiente: creditoPendiente,
        is_subtotal: isSubtotal,
      });

      if (!isSubtotal && docKey) {
        insertedDocs += 1;
        currentRows.push({
          documentoNormalizado: docKey,
          documento,
          cliente,
          fechaEmision,
          saldo: total,
          temporalScope,
          positionType: posicionCartera,
        });
      }
    }

    const comparison = comparePortfolioSnapshots(
      previousRows,
      currentRows,
      baseline,
    );

    for (const delta of comparison.deltas) {
      if (delta.type === "NO_EVENT") {
        const preserved = previousProjection.get(delta.documentoNormalizado);
        if (preserved) {
          stmtRestoreProjectionState.run(
            preserved.estadoDocumento,
            preserved.estadoConfirmacion,
            preserved.estadoFuente,
            preserved.saldoOriginal,
            preserved.saldoOriginal,
            delta.documentoNormalizado,
          );
        }
        continue;
      }

      if (!importacionId || importacionId <= 0) continue;

      const previousState = previousProjection.get(delta.documentoNormalizado);
      const currentReference =
        delta.current?.documento ??
        delta.previous?.documento ??
        delta.documentoNormalizado;
      const cliente =
        delta.current?.cliente ?? delta.previous?.cliente ?? "";
      const positionType =
        delta.current?.positionType ??
        delta.previous?.positionType ??
        "DEUDA_VIVA";

      if (positionType === "CREDITO_VIVO") {
        const creditEventType =
          delta.type === "CARTERA_SNAPSHOT"
            ? "CREDITO_VIVO_SNAPSHOT"
            : delta.type === "DOCUMENTO_DESAPARECIDO"
              ? "CREDITO_VIVO_DESAPARECIDO"
              : "CREDITO_VIVO_VARIADO";

        upsertDocumentBalance(db, {
          documentoNormalizado: delta.documentoNormalizado,
          importacionId,
          saldoAnterior: delta.saldoAnterior,
          saldoActual: delta.saldoActual,
          presenteCartera:
            delta.type !== "DOCUMENTO_DESAPARECIDO",
        });

        insertDocumentEvent(db, {
          eventKey:
            `${creditEventType}:${generation}:${importacionId}:` +
            delta.documentoNormalizado,
          documentoNormalizado: delta.documentoNormalizado,
          tipoEvento: creditEventType,
          fuente: "CARTERA_CONTIFICO",
          importe:
            delta.type === "CARTERA_SNAPSHOT"
              ? delta.saldoActual
              : delta.delta,
          estadoAnterior: previousState?.estadoDocumento ?? null,
          estadoNuevo: "CREDITO_VIVO",
          provisional: delta.type !== "CARTERA_SNAPSHOT",
          importacionId,
          referenciaExterna: currentReference,
          metadata: {
            cliente,
            generation,
            baseline,
            cutoff_date: cutoffDate,
            posicion_cartera: "CREDITO_VIVO",
            saldo_anterior: delta.saldoAnterior,
            saldo_actual: delta.saldoActual,
            delta: delta.delta,
          },
        });

        eventosGenerados += 1;
        continue;
      }

      if (delta.type === "CARTERA_SNAPSHOT") {
        const result = reconcileDocument({
          documento: delta.documentoNormalizado,
          saldoAnterior: null,
          saldoActual: delta.saldoActual,
          presenteEnCartera: true,
          cobrosConfirmados: 0,
          notasCredito: 0,
          anulado: false,
        });

        upsertDocumentBalance(db, {
          documentoNormalizado: delta.documentoNormalizado,
          importacionId,
          saldoAnterior: null,
          saldoActual: delta.saldoActual,
          presenteCartera: true,
        });

        insertDocumentEvent(db, {
          eventKey:
            `CARTERA_SNAPSHOT:${generation}:${importacionId}:` +
            delta.documentoNormalizado,
          documentoNormalizado: delta.documentoNormalizado,
          tipoEvento: "CARTERA_SNAPSHOT",
          fuente: "CARTERA_CONTIFICO",
          importe: delta.saldoActual,
          estadoAnterior: previousState?.estadoDocumento ?? null,
          estadoNuevo: result.estado,
          provisional: false,
          importacionId,
          referenciaExterna: currentReference,
          metadata: {
            cliente,
            generation,
            baseline,
            cutoff_date: cutoffDate,
            saldo_anterior: null,
            saldo_actual: delta.saldoActual,
          },
        });

        applyCurrentProjection(db, delta.documentoNormalizado, result);
        eventosGenerados += 1;
        continue;
      }

      if (
        delta.type === "SALDO_REDUCIDO" ||
        delta.type === "SALDO_INCREMENTADO"
      ) {
        const result = reconcileDocument({
          documento: delta.documentoNormalizado,
          saldoAnterior: delta.saldoAnterior,
          saldoActual: delta.saldoActual,
          presenteEnCartera: true,
          cobrosConfirmados: 0,
          notasCredito: 0,
          anulado: false,
        });

        upsertDocumentBalance(db, {
          documentoNormalizado: delta.documentoNormalizado,
          importacionId,
          saldoAnterior: delta.saldoAnterior,
          saldoActual: delta.saldoActual,
          presenteCartera: true,
        });

        insertDocumentEvent(db, {
          eventKey:
            `${delta.type}:${generation}:${importacionId}:` +
            delta.documentoNormalizado,
          documentoNormalizado: delta.documentoNormalizado,
          tipoEvento: delta.type,
          fuente: "DELTA_CARTERA",
          importe: delta.delta,
          estadoAnterior:
            previousState?.estadoDocumento ?? "ACTIVO_PENDIENTE",
          estadoNuevo: result.estado,
          provisional: true,
          importacionId,
          referenciaExterna: currentReference,
          metadata: {
            cliente,
            generation,
            cutoff_date: cutoffDate,
            saldo_anterior: delta.saldoAnterior,
            saldo_actual: delta.saldoActual,
            delta: delta.delta,
          },
        });

        applyCurrentProjection(db, delta.documentoNormalizado, result);
        eventosGenerados += 1;
        continue;
      }

      if (delta.type === "DOCUMENTO_DESAPARECIDO") {
        upsertDocumentBalance(db, {
          documentoNormalizado: delta.documentoNormalizado,
          importacionId,
          saldoAnterior: delta.saldoAnterior,
          saldoActual: 0,
          presenteCartera: false,
        });

        insertDocumentEvent(db, {
          eventKey:
            `DOCUMENTO_DESAPARECIDO:${generation}:${importacionId}:` +
            delta.documentoNormalizado,
          documentoNormalizado: delta.documentoNormalizado,
          tipoEvento: "DOCUMENTO_DESAPARECIDO",
          fuente: "DELTA_CARTERA",
          importe: delta.saldoAnterior ?? 0,
          estadoAnterior:
            previousState?.estadoDocumento ?? "ACTIVO_PENDIENTE",
          estadoNuevo: "PAGADO_TOTAL",
          provisional: true,
          importacionId,
          referenciaExterna: currentReference,
          metadata: {
            cliente,
            generation,
            cutoff_date: cutoffDate,
            saldo_anterior: delta.saldoAnterior,
            saldo_actual: 0,
            confirmacion: "PROVISIONAL",
          },
        });

        eventosGenerados += 1;
      }
    }

    const normalizedSnapshotRows = [...currentRows].sort((a, b) =>
      a.documentoNormalizado.localeCompare(b.documentoNormalizado),
    );

    const snapshotHash = createHash("sha256")
      .update(
        normalizedSnapshotRows
          .map(
            (row) =>
              `${row.documentoNormalizado}:${toMoneyCents(row.saldo)}`,
          )
          .join("\n"),
        "utf8",
      )
      .digest("hex");

    if (importacionId && importacionId > 0) {
      const insertSnapshot = db.prepare(`
        INSERT INTO cartera_snapshots (
          importacion_id,
          generation,
          snapshot_anterior_id,
          fecha_snapshot,
          cantidad_documentos,
          cantidad_legacy,
          hash_contenido,
          baseline
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        importacionId,
        generation,
        snapshotAnteriorId,
        effectiveSnapshotDate,
        normalizedSnapshotRows.length,
        legacy,
        snapshotHash,
        baseline ? 1 : 0,
      );

      snapshotId = Number(insertSnapshot.lastInsertRowid);


      const insertSnapshotDocument = db.prepare(`
        INSERT INTO cartera_snapshot_documentos (
          snapshot_id,
          documento_normalizado,
          documento,
          cliente,
          fecha_emision,
          saldo,
          saldo_centavos,
          temporal_scope,
          posicion_cartera
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const snapshotRow of normalizedSnapshotRows) {
        insertSnapshotDocument.run(
          snapshotId,
          snapshotRow.documentoNormalizado,
          snapshotRow.documento,
          snapshotRow.cliente,
          snapshotRow.fechaEmision || null,
          snapshotRow.saldo,
          toMoneyCents(snapshotRow.saldo),
          snapshotRow.temporalScope,
          snapshotRow.positionType,
        );
      }
    }
  });

  tx();

  const comparison = comparePortfolioSnapshots(
    previousRows,
    currentRows,
    baseline,
  );

  return {
    ok: true,
    filePath,
    insertedDocs,
    insertedClientes: Math.max(0, insertedClientes),
    omittedRows,
    descuadresDetectados,
    baseline,
    snapshotId,
    snapshotAnteriorId,
    nuevos: comparison.metrics.nuevos,
    sinCambios: comparison.metrics.sinCambios,
    reducidos: comparison.metrics.reducidos,
    incrementados: comparison.metrics.incrementados,
    desaparecidos: comparison.metrics.desaparecidos,
    legacy,
    eventosGenerados,
    message:
      `Snapshot ${baseline ? "BASELINE" : "INCREMENTAL"}: ` +
      `${comparison.metrics.nuevos} nuevos, ` +
      `${comparison.metrics.sinCambios} sin cambios, ` +
      `${comparison.metrics.reducidos} reducidos, ` +
      `${comparison.metrics.incrementados} incrementados, ` +
      `${comparison.metrics.desaparecidos} desaparecidos, ` +
      `${legacy} legacy.`,
  };
}

export const importContificoExcel = importarCarteraPorCobrarExcel;
