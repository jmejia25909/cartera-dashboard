import * as XLSX from "xlsx";
import type Database from "better-sqlite3";

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

// -----------------------------
// Import Principal
// -----------------------------
export function importarCarteraPorCobrarExcel(filePath: string, db: Database.Database): ImportResult {
  const normalizeDocumento = (value: unknown): string => {
    const raw = String(value ?? "").trim().toUpperCase();
    if (!raw) return "";
    const alnum = raw.replace(/[^A-Z0-9]/g, "");
    if (!alnum) return raw;
    if (/^[0-9]+$/.test(alnum)) return alnum.replace(/^0+/, "") || "0";
    return alnum;
  };

  // 1. Obtener documentos actuales para detectar abonos/pagos
  const docsPrevios: Record<string, { documento: string; total: number; cobros: number }> = {};
  for (const row of db.prepare("SELECT documento, total, cobros FROM documentos WHERE is_subtotal=0").all() as Array<{ documento: string; total: number; cobros: number }>) {
    const key = normalizeDocumento(row.documento);
    if (key) docsPrevios[key] = { documento: row.documento, total: Number(row.total), cobros: Number(row.cobros) };
  }
  const isPrimeraImportacion = Object.keys(docsPrevios).length === 0;
  const docsImportados = new Set<string>();

  // 2. Leer archivo Excel
  const wb = XLSX.readFile(filePath, { cellDates: true, cellNF: false, cellText: false });
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
      cliente, razon_social, tipo_documento, documento,
      fecha_emision, fecha_vencimiento,
      vendedor, centro_costo, categoria_persona,
      por_vencer, dias_30, dias_60, dias_90, dias_120, dias_mas_120,
      total, descripcion, valor_documento, retenciones, cobros,
      is_subtotal
    ) VALUES (
      @cliente, @razon_social, @tipo_documento, @documento,
      @fecha_emision, @fecha_vencimiento,
      @vendedor, @centro_costo, @categoria_persona,
      @por_vencer, @dias_30, @dias_60, @dias_90, @dias_120, @dias_mas_120,
      @total, @descripcion, @valor_documento, @retenciones, @cobros,
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

  const stmtInsertAbono = db.prepare(`
    INSERT INTO abonos (documento, total_anterior, total_nuevo, fecha, observacion)
    VALUES (@documento, @total_anterior, @total_nuevo, @fecha, @observacion)
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
      const fecha_vencimiento = toISODate(getCell(r, map, kVence));
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

      // Registro de Abonos
      if (!is_subtotal && documento) {
        const docKey = normalizeDocumento(documento);
        if (docKey) docsImportados.add(docKey);
        const previo = docKey ? docsPrevios[docKey] : undefined;

        if (previo) {
          const totalBajo = Math.abs(previo.total - total) > 0.01 && total < previo.total;
          const cobrosSubio = Math.abs(cobros - previo.cobros) > 0.01 && cobros > previo.cobros;
          if (totalBajo || cobrosSubio) {
            stmtInsertAbono.run({
              documento,
              total_anterior: previo.total,
              total_nuevo: total,
              fecha: new Date().toISOString(),
              observacion: totalBajo ? 'Abono detectado por reducción de saldo' : 'Abono detectado por aumento de cobros',
            });
          }
        } else if (isPrimeraImportacion && cobros > 0) {
          stmtInsertAbono.run({
            documento,
            total_anterior: Math.max(0, total + cobros),
            total_nuevo: total,
            fecha: new Date().toISOString(),
            observacion: 'Abono detectado en carga inicial',
          });
        }
      }

      stmtInsertDoc.run({
        cliente,
        razon_social,
        tipo_documento,
        documento,
        fecha_emision,
        fecha_vencimiento,
        vendedor,
        centro_costo,
        categoria_persona,
        por_vencer,
        dias_30,
        dias_60,
        dias_90,
        dias_120,
        dias_mas_120,
        total,
        descripcion,
        valor_documento,
        retenciones,
        cobros,
        is_subtotal,
      });

      if (!is_subtotal) insertedDocs++;
    }

    // Liquidar automáticamente documentos pagados (que ya no vienen en la nueva importación)
    for (const docKey in docsPrevios) {
      if (!docsImportados.has(docKey)) {
        const doc = docsPrevios[docKey].documento;
        stmtInsertDoc.run({
          cliente: '',
          razon_social: '',
          tipo_documento: '',
          documento: doc,
          fecha_emision: '',
          fecha_vencimiento: '',
          vendedor: '',
          centro_costo: '',
          categoria_persona: '',
          por_vencer: 0,
          dias_30: 0,
          dias_60: 0,
          dias_90: 0,
          dias_120: 0,
          dias_mas_120: 0,
          total: 0,
          descripcion: 'Liquidado automáticamente por importación',
          valor_documento: 0,
          retenciones: 0,
          cobros: 0,
          is_subtotal: 0,
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