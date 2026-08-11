import * as XLSX from "xlsx";
import fs from "node:fs";
import type Database from "better-sqlite3";
import { normalizeDocumentNumber } from "./reconciliation/documentIdentity";
import { reconcileDocument } from "./reconciliation/reconciliationEngine";
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
// Import Principal
// -----------------------------
export function importarCarteraPorCobrarExcel(
  filePath: string,
  db: Database.Database,
  importacionId?: number,
): ImportResult {
  // 1. Snapshot de cartera REAL previa. Las antiguas filas
  // LIQUIDACION_AUTOMATICA son evidencia histórica, no cartera vigente.
  const docsPrevios: Record<string, {
    documento: string;
    cliente: string;
    total: number;
    cobros: number;
    estadoDocumento: string;
  }> = {};

  for (const row of db.prepare(`
    SELECT documento, cliente, total, cobros, estado_documento
    FROM documentos
    WHERE is_subtotal = 0
      AND COALESCE(credito_fuente, '') <> 'LIQUIDACION_AUTOMATICA'
  `).all() as Array<{
    documento: string;
    cliente: string;
    total: number;
    cobros: number;
    estado_documento: string;
  }>) {
    const key = normalizeDocumentNumber(row.documento);
    if (key) {
      docsPrevios[key] = {
        documento: row.documento,
        cliente: row.cliente ?? "",
        total: Number(row.total ?? 0),
        cobros: Number(row.cobros ?? 0),
        estadoDocumento: row.estado_documento || "ACTIVO_PENDIENTE",
      };
    }
  }

  const docsImportados = new Set<string>();

  // 2. Leer archivo Excel
  const excelBuffer = fs.readFileSync(filePath);
  const wb = XLSX.read(excelBuffer, {
    type: "buffer",
    cellDates: true,
    cellNF: false,
    cellText: false,
  });
  const wsName = wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  if (!ws) {
    return { ok: false, filePath, insertedDocs: 0, insertedClientes: 0, omittedRows: 0, message: "No se encontró una hoja válida en el Excel." };
  }

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true }) as unknown[][];

  // 3. Ubicar encabezado de forma dinámica
  const header = findHeaderRow(rows);
  if (header.idx < 0) {
    return {
      ok: false,
      filePath,
      insertedDocs: 0,
      insertedClientes: 0,
      omittedRows: 0,
      message: "No se detectó el encabezado esperado en el archivo de Contifico.",
    };
  }

  const map = header.map;
  const pick = (k: string, ...aliases: string[]) => {
    if (map[k] != null) return k;
    for (const a of aliases) if (map[a] != null) return a;
    return k;
  };

  const kCliente = pick("cliente", "razon social", "razon social ", "razon");
  const kTipoDoc = pick("tipo documento", "tipo doc", "tipo");
  const kDoc = pick("# documento", "#documento", "documento", "n° documento", "numero documento");
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
      fecha_emision, fecha_vencimiento,
      vendedor,
      total, descripcion, valor_documento, retenciones, cobros,
      dias_credito_aplicados, credito_fuente, credito_pendiente,
      is_subtotal
    ) VALUES (
      @cliente, @razon_social, @tipo_documento, @documento, @documento_normalizado,
      @fecha_emision, @fecha_vencimiento,
      @vendedor,
      @total, @descripcion, @valor_documento, @retenciones, @cobros,
      @dias_credito_aplicados, @credito_fuente, @credito_pendiente,
      @is_subtotal
    )
  `);

  const stmtUpsertCliente = db.prepare(`
    INSERT INTO clientes (cliente, razon_social, categoria_persona, vendedor, centro_costo)
    VALUES (@cliente, @razon_social, @categoria_persona, @vendedor, @centro_costo)
    ON CONFLICT(cliente) DO UPDATE SET
      razon_social = excluded.razon_social,
      categoria_persona = COALESCE(excluded.categoria_persona, clientes.categoria_persona),
      vendedor = COALESCE(excluded.vendedor, clientes.vendedor),
      centro_costo = COALESCE(excluded.centro_costo, clientes.centro_costo)
  `);

  // Inserta cada evento lógico una sola vez. La fecha no forma parte de la
  // identidad porque una reimportación puede ocurrir en otro momento.

  const stmtGetCreditPolicy = db.prepare(`
    SELECT tipo_credito, dias_credito, credito_configurado
    FROM clientes
    WHERE cliente = ?
    LIMIT 1
  `);

  const stmtUpsertCreditAlert = db.prepare(`
    INSERT INTO alertas_credito (cliente, motivo, estado, detectado_en, resuelto_en)
    VALUES (@cliente, @motivo, 'PENDIENTE', datetime('now', 'localtime'), NULL)
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

  let insertedDocs = 0;
  let insertedClientes = 0;
  let omittedRows = 0;
  let descuadresDetectados = 0;

  const dataRows = rows.slice(header.idx + 1);

  const tx = db.transaction(() => {
    db.exec("DELETE FROM documentos;");

    for (const r of dataRows) {
      const cliente = String(getCell(r, map, kCliente)).trim();
      const tipo_documento = String(getCell(r, map, kTipoDoc)).trim();
      const documento = String(getCell(r, map, kDoc)).trim();

      // Ignorar filas totalmente vacías o subtotales de reporte
      if (!cliente && !tipo_documento && !documento) {
        omittedRows++;
        continue;
      }

      const razon_social = String(getCell(r, map, kCliente)).trim();
      const fecha_emision = toISODate(getCell(r, map, kEmision));
      const fecha_vencimiento_importada = toISODate(getCell(r, map, kVence));
      const policy = cliente ? stmtGetCreditPolicy.get(cliente) as CreditPolicy | undefined : undefined;
      const importedCreditDays = differenceInCalendarDays(fecha_emision, fecha_vencimiento_importada);
      const importedDueDateIsValid = importedCreditDays != null && importedCreditDays > 0;
      let fecha_vencimiento = fecha_vencimiento_importada;
      let dias_credito_aplicados: number | null = importedCreditDays;
      let credito_fuente = "CONTIFICO";
      let credito_pendiente = 0;
      if (!importedDueDateIsValid) {
        const configured = policy?.credito_configurado === 1 && policy.dias_credito != null && Number.isFinite(Number(policy.dias_credito));
        if (configured) {
          const configuredDays = Math.max(0, Number(policy.dias_credito));
          fecha_vencimiento = addCalendarDays(fecha_emision, configuredDays);
          dias_credito_aplicados = configuredDays;
          credito_fuente = "POLITICA_CLIENTE";
        } else {
          fecha_vencimiento = fecha_emision || fecha_vencimiento_importada;
          dias_credito_aplicados = null;
          credito_fuente = "PENDIENTE_CONFIGURACION";
          credito_pendiente = 1;
        }
      }
      const vendedor = String(getCell(r, map, kVendedor)).trim();
      const centro_costo = String(getCell(r, map, kCentro)).trim();
      const categoria_persona = String(getCell(r, map, kCategoria)).trim();

      const por_vencer = toNumber(getCell(r, map, kPorVencer));
      const dias_30 = toNumber(getCell(r, map, k30));
      const dias_60 = toNumber(getCell(r, map, k60));
      const dias_90 = toNumber(getCell(r, map, k90));
      const dias_120 = toNumber(getCell(r, map, k120));
      const dias_mas_120 = toNumber(getCell(r, map, kMas120));
      const total = toNumber(getCell(r, map, kTotal));
      const descripcion = String(getCell(r, map, kDescripcion)).trim();
      const valor_documento = toNumber(getCell(r, map, kValorDoc));
      const retenciones = toNumber(getCell(r, map, kRet));
      const cobros = toNumber(getCell(r, map, kCobros));

      // AGING DEL EXCEL: solo validación. No se persiste en documentos.
      // El aging operativo se calcula dinámicamente con fecha_vencimiento.
      // VALIDACIÓN DE DESCUADRE EN EXCEL:
      // Compara si el Total del documento equivale a la suma de los tramos de días
      const sumaTramos = por_vencer + dias_30 + dias_60 + dias_90 + dias_120 + dias_mas_120;
      if (Math.abs(sumaTramos - total) > 0.01 && (tipo_documento || documento)) {
        descuadresDetectados++;
      }

      const is_subtotal = (tipo_documento || (documento && cliente)) ? 0 : 1;

      if (cliente) {
        stmtUpsertCliente.run({ cliente, razon_social, categoria_persona, vendedor, centro_costo });
        insertedClientes++;
      }

      if (cliente) {
        if (credito_pendiente === 1) {
          stmtUpsertCreditAlert.run({ cliente, motivo: "Cliente sin dias de credito configurados y vencimiento importado no valido" });
        } else {
          stmtResolveCreditAlert.run(cliente);
        }
      }

      const docKey = !is_subtotal
        ? normalizeDocumentNumber(documento)
        : "";

      if (docKey) {
        docsImportados.add(docKey);
      }

      stmtInsertDoc.run({
        cliente,
        razon_social,
        tipo_documento,
        documento,
        documento_normalizado: docKey,
        fecha_emision,
        fecha_vencimiento,
        vendedor,
        total,
        descripcion,
        valor_documento,
        retenciones,
        cobros,
        dias_credito_aplicados,
        credito_fuente,
        credito_pendiente,
        is_subtotal,
      });

      if (!is_subtotal) {
        insertedDocs++;

        if (docKey && importacionId && importacionId > 0) {
          const previo = docsPrevios[docKey];
          const saldoAnterior = previo ? previo.total : null;
          const result = reconcileDocument({
            documento: docKey,
            saldoAnterior,
            saldoActual: total,
            presenteEnCartera: true,
            cobrosConfirmados: 0,
            notasCredito: 0,
            anulado: false,
          });

          upsertDocumentBalance(db, {
            documentoNormalizado: docKey,
            importacionId,
            saldoAnterior,
            saldoActual: total,
            presenteCartera: true,
          });

          insertDocumentEvent(db, {
            eventKey: `CARTERA_SNAPSHOT:${importacionId}:${docKey}`,
            documentoNormalizado: docKey,
            tipoEvento: "CARTERA_SNAPSHOT",
            fuente: "CARTERA_CONTIFICO",
            importe: total,
            estadoAnterior: previo?.estadoDocumento ?? null,
            estadoNuevo: result.estado,
            provisional: false,
            importacionId,
            referenciaExterna: documento,
            metadata: {
              cliente,
              saldo_anterior: saldoAnterior,
              saldo_actual: total,
              retenciones,
              cobros_reportados: cobros,
            },
          });

          if (previo && total < previo.total - 0.01) {
            insertDocumentEvent(db, {
              eventKey: `SALDO_REDUCIDO:${importacionId}:${docKey}`,
              documentoNormalizado: docKey,
              tipoEvento: "SALDO_REDUCIDO",
              fuente: "DELTA_CARTERA",
              importe: Math.max(0, previo.total - total),
              estadoAnterior: previo.estadoDocumento,
              estadoNuevo: result.estado,
              provisional: true,
              importacionId,
              referenciaExterna: documento,
              metadata: {
                cliente,
                saldo_anterior: previo.total,
                saldo_actual: total,
                delta_no_conciliado: result.deltaNoConciliado,
              },
            });
          }

          applyCurrentProjection(db, docKey, result);
        }
      }
    }

    // Documentos presentes en N-1 y ausentes en N:
    // la desaparición es una señal provisional, nunca un cobro confirmado.
    if (importacionId && importacionId > 0) {
      for (const [docKey, previo] of Object.entries(docsPrevios)) {
        if (docsImportados.has(docKey)) continue;

        const result = reconcileDocument({
          documento: docKey,
          saldoAnterior: previo.total,
          saldoActual: 0,
          presenteEnCartera: false,
          cobrosConfirmados: 0,
          notasCredito: 0,
          anulado: false,
        });

        upsertDocumentBalance(db, {
          documentoNormalizado: docKey,
          importacionId,
          saldoAnterior: previo.total,
          saldoActual: 0,
          presenteCartera: false,
        });

        insertDocumentEvent(db, {
          eventKey: `DOCUMENTO_DESAPARECIDO:${importacionId}:${docKey}`,
          documentoNormalizado: docKey,
          tipoEvento: "DOCUMENTO_DESAPARECIDO",
          fuente: "DELTA_CARTERA",
          importe: previo.total,
          estadoAnterior: previo.estadoDocumento,
          estadoNuevo: "PAGADO_TOTAL",
          provisional: true,
          importacionId,
          referenciaExterna: previo.documento,
          metadata: {
            cliente: previo.cliente,
            saldo_anterior: previo.total,
            saldo_actual: 0,
          },
        });

        insertDocumentEvent(db, {
          eventKey: `PAGO_TOTAL_INFERIDO:${importacionId}:${docKey}`,
          documentoNormalizado: docKey,
          tipoEvento: "PAGO_TOTAL_INFERIDO",
          fuente: "DELTA_CARTERA",
          importe: previo.total,
          estadoAnterior: previo.estadoDocumento,
          estadoNuevo: result.estado,
          provisional: true,
          importacionId,
          referenciaExterna: previo.documento,
          metadata: {
            cliente: previo.cliente,
            confirmacion: result.confirmacion,
            delta_no_conciliado: result.deltaNoConciliado,
          },
        });
      }
    }
  });

  tx();

  return {
    ok: true,
    filePath,
    insertedDocs,
    insertedClientes: Math.max(0, insertedClientes),
    omittedRows,
    descuadresDetectados,
  };
}

export const importContificoExcel = importarCarteraPorCobrarExcel;