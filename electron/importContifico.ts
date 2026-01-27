import * as XLSX from "xlsx";
import type Database from "better-sqlite3";

export type ImportResult = {
  ok: boolean;
  filePath: string;
  insertedDocs: number;
  insertedClientes: number;
  omittedRows: number;
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

function toISODate(v: any): string {
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
  // dd/mm/yy or dd/mm/yyyy
  const m = s.match(/^([0-3]?\d)[/\-]([0-1]?\d)[/\-](\d{2}|\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    const yy = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yy}-${mm}-${dd}`;
  }
  // yyyy-mm-dd already
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) return s;

  return "";
}

function toNumber(v: any): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;

  let s = String(v).trim();
  if (!s) return 0;

  // Handle Contifico-style values: 305.718,39
  // Also handle 305,718.39
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // assume last separator is decimal
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    const decSep = lastComma > lastDot ? "," : ".";
    const thouSep = decSep === "," ? "." : ",";
    s = s.split(thouSep).join("");
    s = decSep === "," ? s.replace(/,/g, ".") : s;
  } else if (hasComma && !hasDot) {
    // assume comma is decimal
    s = s.replace(/\./g, "");
    s = s.replace(/,/g, ".");
  } else {
    // dot decimal or plain
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function findHeaderRow(rows: any[][]): { idx: number; map: Record<string, number> } {
  // We look for a row that includes at least these headers
  const required = ["cliente", "tipo documento", "# documento", "f. vencimiento", "total"];

  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i] ?? [];
    const norm = row.map(normHeader);
    const hasAll = required.every((r) => norm.includes(r));
    if (!hasAll) continue;

    const map: Record<string, number> = {};
    for (let c = 0; c < norm.length; c++) {
      const k = norm[c];
      if (k) map[k] = c;
    }
    return { idx: i, map };
  }
  return { idx: -1, map: {} };
}

function getCell(row: any[], map: Record<string, number>, key: string): any {
  const idx = map[key];
  if (idx == null) return "";
  return row[idx];
}

// -----------------------------
// Import
// -----------------------------
export function importarCarteraPorCobrarExcel(filePath: string, db: Database.Database): ImportResult {
    // 1. Obtener documentos actuales para comparar
    const docsPrevios: Record<string, { total: number }> = {};
    for (const row of db.prepare("SELECT documento, total FROM documentos WHERE is_subtotal=0").all() as any[]) {
      docsPrevios[row.documento] = { total: Number(row.total) };
    }

    // 2. Llevar control de documentos importados en esta sesión
    const docsImportados = new Set<string>();
  const wb = XLSX.readFile(filePath, { cellDates: true, cellNF: false, cellText: false });
  const wsName = wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  if (!ws) {
    return { ok: false, filePath, insertedDocs: 0, insertedClientes: 0, omittedRows: 0, message: "No se encontró una hoja válida en el Excel." };
  }

  // Leer todas las filas y limpiar columnas/filas
  let rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true }) as any[][];
  // 1. Eliminar filas 1-4 (índices 0-3)
  rows = rows.slice(4);
  // 2. Eliminar columnas A, H, I (índices 0, 7, 8) de todas las filas
  rows = rows.map(row => row.filter((_, idx) => idx !== 0 && idx !== 7 && idx !== 8));
  // 3. Renombrar encabezados
  if (rows.length > 0) {
    let headerRow = rows[0].map((h: string) => {
      let norm = String(h).trim().toLowerCase();
      if (norm === "razón social" || norm === "razon social") return "Cliente";
      if (norm === "tipo documento") return "Tipo";
      if (norm === "# documento" || norm === "n° documento" || norm === "número documento") return "Documento";
      return h;
    });
    rows[0] = headerRow;
  }
  // 4. Eliminar filas vacías o de subtotales (donde Cliente o Documento estén vacíos)
  const idxCliente = rows[0].findIndex((h: string) => String(h).toLowerCase() === "cliente");
  const idxDoc = rows[0].findIndex((h: string) => String(h).toLowerCase() === "documento");
  rows = [rows[0], ...rows.slice(1).filter(row => {
    const cliente = String(row[idxCliente] ?? "").trim();
    const doc = String(row[idxDoc] ?? "").trim();
    return cliente && doc;
  })];

  // Buscar encabezado ya limpio
  const header = findHeaderRow(rows);
  if (header.idx < 0) {
    return {
      ok: false,
      filePath,
      insertedDocs: 0,
      insertedClientes: 0,
      omittedRows: 0,
      message:
        "No se detectó el encabezado esperado de CarteraPorCobrar. Asegúrate de que existan columnas como: Cliente, Tipo, Documento, F. Vencimiento y Total.",
    };
  }

  const map = header.map;

  // Column normalization (handle minor header variants)
  const pick = (k: string, ...aliases: string[]) => {
    if (map[k] != null) return k;
    for (const a of aliases) if (map[a] != null) return a;
    return k;
  };

  const kCliente = pick("cliente");
  const kRazon = pick("razon social", "razon", "razon social ");
  const kTipoDoc = pick("tipo documento", "tipo doc");
  const kDoc = pick("# documento", "#documento", "documento");
  const kEmision = pick("f. emision", "f emision", "fecha emision");
  const kVence = pick("f. vencimiento", "f vencimiento", "fecha vencimiento");
  const kVendedor = pick("vendedor");
  const kCentro = pick("centro de costo", "centro costo");
  const kCategoria = pick("categoria de persona", "categoria persona");
  const kPorVencer = pick("por vencer", "porvencer");
  const k30 = pick("30 dias", "30 día", "30 dias ");
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

  let insertedDocs = 0;
  let insertedClientes = 0;
  let omittedRows = 0;

  const dataRows = rows.slice(header.idx + 1);

  const stmtInsertAbono = db.prepare(`
    INSERT INTO abonos (documento, total_anterior, total_nuevo, fecha, observacion)
    VALUES (@documento, @total_anterior, @total_nuevo, @fecha, @observacion)
  `);

  const tx = db.transaction(() => {
    // Re-import: limpiar solo documentos, no clientes
    db.exec("DELETE FROM documentos;");

    for (const r of dataRows) {
      const cliente = String(getCell(r, map, kCliente)).trim();
      const tipo_documento = String(getCell(r, map, kTipoDoc)).trim();
      const documento = String(getCell(r, map, kDoc)).trim();

      // Skip completely empty rows
      if (!cliente && !tipo_documento && !documento) {
        omittedRows++;
        continue;
      }

      const razon_social = String(getCell(r, map, kRazon)).trim();
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

      const is_subtotal = tipo_documento ? 0 : 1;

      // Upsert client (only if we have a key)
      if (cliente) {
        stmtUpsertCliente.run({ cliente, razon_social, categoria_persona, vendedor, centro_costo });
        insertedClientes++;
      }

      // Detectar abonos: si el documento ya existía y el total cambió
      if (!is_subtotal && documento) {
        docsImportados.add(documento);
        const previo = docsPrevios[documento];
        if (previo && Math.abs(previo.total - total) > 0.01 && total < previo.total) {
          // Registrar abono
          stmtInsertAbono.run({
            documento,
            total_anterior: previo.total,
            total_nuevo: total,
            fecha: new Date().toISOString(),
            observacion: 'Abono detectado por importación',
          });
        }
      }

      // Insertar documento actualizado
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

    // Marcar como pagados los documentos que ya no aparecen en la importación
    for (const doc in docsPrevios) {
      if (!docsImportados.has(doc)) {
        // Insertar documento como pagado (total=0, estado='pagado')
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
          descripcion: 'Documento liquidado por importación',
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
  };
}

// Backwards-compat alias (older code / scripts)
export const importContificoExcel = importarCarteraPorCobrarExcel;
