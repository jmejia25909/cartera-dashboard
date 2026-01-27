import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";
import { openDb, getDbFilePath } from "./db";
import * as XLSX from "xlsx";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let db: any;

// --- FUNCIONES AUXILIARES (Extraídas para usar en API Web y Desktop) ---

function getEmpresa() {
  try {
    return db.prepare("SELECT * FROM empresa WHERE id = 1").get();
  } catch (e: any) {
    return { nombre: "Mi Empresa" };
  }
}

function getAnalisisRiesgo() {
  try {
    const rows = db.prepare(`
      SELECT 
        cliente, 
        MAX(razon_social) as razon_social,
        COUNT(1) as docs_count,
        COALESCE(SUM(total), 0) as total_deuda,
        COALESCE(SUM(CASE WHEN date(fecha_vencimiento) < date('now', 'localtime') THEN total ELSE 0 END), 0) as deuda_vencida,
        MAX(CAST(julianday(date('now', 'localtime')) - julianday(fecha_vencimiento) AS INTEGER)) as max_dias_mora
      FROM documentos 
      WHERE is_subtotal = 0
      GROUP BY cliente
      HAVING total_deuda > 0.01
      ORDER BY total_deuda DESC
    `).all();

    const analisis = rows.map((r: any) => {
      let score = 100;
      const pctVencida = r.total_deuda > 0 ? (r.deuda_vencida / r.total_deuda) : 0;
      const maxMora = r.max_dias_mora || 0;

      if (pctVencida > 0.05) score -= 10;
      if (pctVencida > 0.30) score -= 15;
      if (pctVencida > 0.70) score -= 20;

      if (maxMora > 5) score -= 5;
      if (maxMora > 30) score -= 15;
      if (maxMora > 60) score -= 20;
      if (maxMora > 90) score -= 30;

      return { ...r, score: Math.max(0, Math.round(score)) };
    });

    return { ok: true, rows: analisis.sort((a: any, b: any) => a.score - b.score) };
  } catch (e: any) {
    return { ok: false, message: e.message, rows: [] };
  }
}

function getNetworkIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

function getClienteInfo(codigo: string) {
  try {
    let info = db.prepare("SELECT * FROM clientes WHERE cliente = ?").get(codigo);
    if (!info) {
      const doc = db.prepare("SELECT razon_social, vendedor FROM documentos WHERE cliente = ? LIMIT 1").get(codigo);
      info = { cliente: codigo, razon_social: doc?.razon_social || "", vendedor: doc?.vendedor || "", telefono: "", email: "", direccion: "", contacto: "" };
    }
    return info;
  } catch (e) { return null; }
}

function listGestiones(cliente: string) {
  try {
    if (!cliente) {
      // Si no se especifica cliente, devolver todas las PROMESAS DE PAGO (Global)
      // Usamos alias 'd' para documentos para evitar confusiones en la subconsulta
      return db.prepare(`
        SELECT 
          g.id, g.cliente, g.fecha, g.tipo, g.resultado, g.observacion, g.fecha_promesa, g.monto_promesa,
          COALESCE((SELECT d.razon_social FROM documentos d WHERE d.cliente = g.cliente LIMIT 1), g.cliente) as razon_social 
        FROM gestiones g
        WHERE g.resultado LIKE '%Promesa%' 
        ORDER BY 
          CASE WHEN g.fecha_promesa IS NULL THEN 1 ELSE 0 END,
          g.fecha_promesa ASC
        LIMIT 1000
      `).all();
    }
    return db.prepare("SELECT * FROM gestiones WHERE cliente = ? ORDER BY id DESC").all(cliente);
  } catch (e: any) { 
    console.error("Error obteniendo gestiones:", e.message);
    return []; 
  }
}

function markGestionFulfilled(id: number) {
  try {
    // Cambiamos el resultado para que ya no salga en la lista de pendientes
    db.prepare("UPDATE gestiones SET resultado = 'Promesa Cumplida' WHERE id = ?").run(id);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: e.message };
  }
}

function updateGestion(id: number, data: any) {
  try {
    const { tipo, resultado, observacion, fecha_promesa, monto_promesa } = data;
    db.prepare(`
      UPDATE gestiones 
      SET tipo = @tipo, resultado = @resultado, observacion = @observacion, 
          fecha_promesa = @fecha_promesa, monto_promesa = @monto_promesa 
      WHERE id = @id
    `).run({ id, tipo, resultado, observacion, fecha_promesa, monto_promesa });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: e.message };
  }
}

function deleteGestion(id: number) {
  try {
    db.prepare("DELETE FROM gestiones WHERE id = ?").run(id);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: e.message };
  }
}

function getGestionesReporte(args?: { desde?: string, hasta?: string }) {
  try {
    const where: string[] = [];
    const params: any = {};

    if (args?.desde) {
      where.push("date(g.fecha) >= date(@desde)");
      params.desde = args.desde;
    }
    if (args?.hasta) {
      where.push("date(g.fecha) <= date(@hasta)");
      params.hasta = args.hasta;
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    return db.prepare(`
      SELECT 
        g.*,
        COALESCE(c.razon_social, g.cliente) as razon_social
      FROM gestiones g
      LEFT JOIN clientes c ON g.cliente = c.cliente
      ${whereClause}
      ORDER BY g.fecha DESC
      LIMIT 2000
    `).all(params);
  } catch (e: any) {
    return [];
  }
}

// --- SERVIDOR WEB LOCAL ---
function startWebServer() {
  const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    
    // 1. API Endpoints
    if (url.pathname.startsWith("/api/")) {
      res.setHeader("Content-Type", "application/json");
      try {
        let data: any = { ok: false, message: "Ruta no encontrada" };

        if (url.pathname === "/api/stats") data = computeStats();
        else if (url.pathname === "/api/filtros") data = listFiltros();
        else if (url.pathname === "/api/empresa") data = getEmpresa();
        else if (url.pathname === "/api/top-clientes") data = topClientes(Number(url.searchParams.get("limit")) || 10);
        else if (url.pathname === "/api/analisis") data = getAnalisisRiesgo();
        else if (url.pathname === "/api/cliente-info") data = getClienteInfo(url.searchParams.get("id") || "");
        else if (url.pathname === "/api/gestiones") data = listGestiones(url.searchParams.get("cliente") || "");
        else if (url.pathname === "/api/gestiones-reporte") data = getGestionesReporte({ desde: url.searchParams.get("desde") || undefined, hasta: url.searchParams.get("hasta") || undefined });
        else if (url.pathname === "/api/documentos") {
          data = { ok: true, rows: listarDocumentos({
            cliente: url.searchParams.get("cliente") || undefined,
            vendedor: url.searchParams.get("vendedor") || undefined,
            tipoDocumento: url.searchParams.get("tipoDocumento") || undefined,
            tipoFecha: (url.searchParams.get("tipoFecha") as any) || "emision",
            desde: url.searchParams.get("desde") || undefined,
            hasta: url.searchParams.get("hasta") || undefined,
            buscar: url.searchParams.get("buscar") || undefined,
            soloVencidos: url.searchParams.get("soloVencidos") === "true",
          })};
        }
        res.writeHead(200);
        res.end(JSON.stringify(data));
      } catch (e: any) {
        res.writeHead(500);
        res.end(JSON.stringify({ ok: false, message: e.message }));
      }
      return;
    }

    // 2. Archivos Estáticos (Frontend)
    let safePath = url.pathname === "/" ? "/index.html" : url.pathname;
    // Evitar salir del directorio
    if (safePath.includes("..")) safePath = "/index.html";
    
    const distPath = join(__dirname, "../dist");
    if (!fs.existsSync(distPath)) {
      console.log("⚠️  ADVERTENCIA: No se encontró la carpeta 'dist'. Recuerda ejecutar 'npm run build' para que funcione en el celular.");
    }
    let filePath = join(distPath, safePath.startsWith("/") ? safePath.slice(1) : safePath);

    // Tipos MIME correctos (CRUCIAL para que no salga pantalla blanca)
    const mimeTypes: Record<string, string> = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".png": "image/png",
      ".jpg": "image/jpg",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon"
    };

    const serveFile = (pathToFile: string) => {
      fs.readFile(pathToFile, (err, content) => {
        if (err) {
          // Si no encuentra el archivo (ej. una ruta de React Router), servir index.html
          if (pathToFile !== join(distPath, "index.html")) {
            serveFile(join(distPath, "index.html"));
          } else {
            res.writeHead(404);
            res.end("Not found");
          }
        } else {
          const ext = extname(pathToFile).toLowerCase();
          const contentType = mimeTypes[ext] || "application/octet-stream";
          res.writeHead(200, { "Content-Type": contentType });
          res.end(content);
        }
      });
    };

    serveFile(filePath);
  });

  server.listen(3000, "0.0.0.0", () => {
    console.log("--- SERVIDOR WEB LOCAL INICIADO ---");
    const interfaces = os.networkInterfaces();
    Object.keys(interfaces).forEach((ifaceName) => {
      interfaces[ifaceName]?.forEach((iface) => {
        if (iface.family === "IPv4" && !iface.internal) {
          console.log(`Accede desde el celular a: http://${iface.address}:3000`);
        }
      });
    });
  });
}

function shouldOpenDevTools() {
  return process.env.OPEN_DEVTOOLS === "1" || process.env.OPEN_DEVTOOLS === "true";
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    await mainWindow.loadURL(devUrl);
    if (shouldOpenDevTools()) mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function closeDb() {
  try {
    db?.close();
  } catch {
    // ignore
  }
}

function toDateOnlyIso(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function computeStats() {
  const todayIso = toDateOnlyIso(new Date());

  const totalSaldo = Number(
    db.prepare(`SELECT COALESCE(SUM(total), 0) AS v FROM documentos WHERE is_subtotal = 0`).get().v
  );
  const totalCobrado = Number(
    db.prepare(`SELECT COALESCE(SUM(cobros), 0) AS v FROM documentos WHERE is_subtotal = 0`).get().v
  );
  const vencidaSaldo = Number(
    db
      .prepare(
        `SELECT COALESCE(SUM(total), 0) AS v
         FROM documentos
         WHERE is_subtotal = 0
           AND total > 0
           AND date(fecha_vencimiento) < date(?)`
      )
      .get(todayIso).v
  );

  const mora90Saldo = Number(
    db
      .prepare(
        `SELECT COALESCE(SUM(total), 0) AS v
         FROM documentos
         WHERE is_subtotal = 0
           AND total > 0
           AND date(fecha_vencimiento) < date(?, '-90 day')`
      )
      .get(todayIso).v
  );

  const mora120Saldo = Number(
    db
      .prepare(
        `SELECT COALESCE(SUM(total), 0) AS v
         FROM documentos
         WHERE is_subtotal = 0
           AND total > 0
           AND date(fecha_vencimiento) < date(?, '-120 day')`
      )
      .get(todayIso).v
  );

  const docsPendientes = Number(
    db
      .prepare(
        `SELECT COUNT(1) AS c
         FROM documentos
         WHERE is_subtotal = 0 AND total > 0`
      )
      .get().c
  );

  const clientesConSaldo = Number(
    db
      .prepare(
        `SELECT COUNT(DISTINCT cliente) AS c
         FROM documentos
         WHERE is_subtotal = 0 AND total > 0 AND cliente IS NOT NULL AND cliente <> ''`
      )
      .get().c
  );

  // Calculamos el Aging dinámicamente comparando fechas (más preciso que guardar valores fijos)
  const aging = db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN (julianday(@today) - julianday(fecha_vencimiento)) <= 0 THEN total ELSE 0 END), 0) AS por_vencer,
        COALESCE(SUM(CASE WHEN (julianday(@today) - julianday(fecha_vencimiento)) > 0 AND (julianday(@today) - julianday(fecha_vencimiento)) <= 30 THEN total ELSE 0 END), 0) AS d30,
        COALESCE(SUM(CASE WHEN (julianday(@today) - julianday(fecha_vencimiento)) > 30 AND (julianday(@today) - julianday(fecha_vencimiento)) <= 60 THEN total ELSE 0 END), 0) AS d60,
        COALESCE(SUM(CASE WHEN (julianday(@today) - julianday(fecha_vencimiento)) > 60 AND (julianday(@today) - julianday(fecha_vencimiento)) <= 90 THEN total ELSE 0 END), 0) AS d90,
        COALESCE(SUM(CASE WHEN (julianday(@today) - julianday(fecha_vencimiento)) > 90 AND (julianday(@today) - julianday(fecha_vencimiento)) <= 120 THEN total ELSE 0 END), 0) AS d120,
        COALESCE(SUM(CASE WHEN (julianday(@today) - julianday(fecha_vencimiento)) > 120 THEN total ELSE 0 END), 0) AS d120p
       FROM documentos
       WHERE is_subtotal = 0`
    )
    .get({ today: todayIso });

  const top10Sum = Number(
    db
      .prepare(
        `SELECT COALESCE(SUM(saldo), 0) AS v
         FROM (
           SELECT cliente, SUM(total) AS saldo
           FROM documentos
           WHERE is_subtotal = 0
           GROUP BY cliente
           ORDER BY saldo DESC
           LIMIT 10
         )`
      )
      .get().v
  );

  const percentVencida = totalSaldo > 0 ? (vencidaSaldo / totalSaldo) * 100 : 0;
  const percentMora90 = totalSaldo > 0 ? (mora90Saldo / totalSaldo) * 100 : 0;
  const percentTop10 = totalSaldo > 0 ? (top10Sum / totalSaldo) * 100 : 0;

  // --- KPIs CRÍTICOS ADICIONALES ---
  // 1. NPL (Non-Performing Loans): % de cartera vencida
  const npl = percentVencida; // Ya lo calculamos arriba

  // 2. DSO (Days Sales Outstanding): días promedio para cobrar
  const totalVentas = Number(
    db.prepare(`SELECT COALESCE(SUM(valor_documento), 0) AS v FROM documentos WHERE is_subtotal = 0`).get().v
  );
  const diasPromedio = totalVentas > 0 ? Math.round((totalSaldo / totalVentas) * 365) : 0;
  const dso = Math.max(0, diasPromedio);

  // 3. Recuperación del mes actual (cobros registrados)
  const inicioMes = `${todayIso.substring(0, 7)}-01`;
  const recuperacionMesActual = Number(
    db.prepare(
      `SELECT COALESCE(SUM(cobros), 0) AS v FROM documentos WHERE is_subtotal = 0 AND date(importado_en) >= date(?)`
    ).get(inicioMes).v
  );

  // 4. Meta mensual (de la tabla empresa)
  const empresa = db.prepare("SELECT * FROM empresa WHERE id = 1").get();
  const metaMensual = empresa?.meta_mensual || 100000; // Default $100k

  // 5. % de cumplimiento de meta
  const percentMetaCumplida = metaMensual > 0 ? Math.min((recuperacionMesActual / metaMensual) * 100, 100) : 0;

  // 6. Tasa de cumplimiento de promesas
  const totalPromesas = Number(
    db.prepare(`SELECT COUNT(1) AS c FROM gestiones WHERE resultado LIKE '%Promesa%'`).get().c
  );
  const promesasCumplidas = Number(
    db.prepare(`SELECT COUNT(1) AS c FROM gestiones WHERE resultado = 'Promesa Cumplida'`).get().c
  );
  const tasaCumplimientoPromesas = totalPromesas > 0 ? Math.round((promesasCumplidas / totalPromesas) * 100) : 0;

  return {
    fechaCorte: todayIso,
    totalSaldo,
    totalCobrado,
    vencidaSaldo,
    percentVencida,
    mora90Saldo,
    percentMora90,
    mora120Saldo,
    docsPendientes,
    clientesConSaldo,
    aging: {
      porVencer: Number(aging.por_vencer || 0),
      d30: Number(aging.d30 || 0),
      d60: Number(aging.d60 || 0),
      d90: Number(aging.d90 || 0),
      d120: Number(aging.d120 || 0),
      d120p: Number(aging.d120p || 0),
    },
    percentTop10,
    // KPIs Críticos FASE 1
    npl: Math.round(npl * 100) / 100,
    dso,
    recuperacionMesActual,
    metaMensual,
    percentMetaCumplida: Math.round(percentMetaCumplida * 100) / 100,
    tasaCumplimientoPromesas,
  };
}

function listFiltros() {
  const clientes = db
    .prepare(
      `SELECT DISTINCT cliente, razon_social
       FROM documentos
       WHERE is_subtotal = 0 AND cliente IS NOT NULL AND cliente <> ''
       ORDER BY razon_social, cliente`
    )
    .all();
  const vendedores = db
    .prepare(
      `SELECT DISTINCT vendedor AS v
       FROM documentos
       WHERE is_subtotal = 0 AND vendedor IS NOT NULL AND vendedor <> ''
       ORDER BY v`
    )
    .all()
    .map((r: any) => r.v);
  const tipos = db
    .prepare(
      `SELECT DISTINCT tipo_documento AS v
       FROM documentos
       WHERE is_subtotal = 0 AND tipo_documento IS NOT NULL AND tipo_documento <> ''
       ORDER BY v`
    )
    .all()
    .map((r: any) => r.v);

  return { clientes, vendedores, tipos };
}

type ListarArgs = {
  cliente?: string;
  vendedor?: string;
  tipoDocumento?: string;
  tipoFecha?: "emision" | "vencimiento"; // Nuevo parámetro
  desde?: string; // YYYY-MM-DD
  hasta?: string; // YYYY-MM-DD
  buscar?: string;
  soloVencidos?: boolean;
  limit?: number;
  ids?: number[]; // Nuevo filtro por IDs
};

function listarDocumentos(args: ListarArgs) {
  const where: string[] = ["is_subtotal = 0"];
  const params: any[] = [];

  if (args.cliente && args.cliente !== "(Todos)") {
    // Filtramos por Razón Social para evitar problemas con IDs duplicados o S/N
    where.push("razon_social = ?");
    params.push(args.cliente);
  }
  if (args.vendedor && args.vendedor !== "(Todos)") {
    where.push("vendedor = ?");
    params.push(args.vendedor);
  }
  if (args.tipoDocumento && args.tipoDocumento !== "(Todos)") {
    where.push("tipo_documento = ?");
    params.push(args.tipoDocumento);
  }
  
  // Determinamos qué columna de fecha usar (por defecto Emisión)
  const dateCol = args.tipoFecha === "vencimiento" ? "fecha_vencimiento" : "fecha_emision";

  if (args.desde) {
    where.push(`date(${dateCol}) >= date(?)`);
    params.push(args.desde);
  }
  if (args.hasta) {
    where.push(`date(${dateCol}) <= date(?)`);
    params.push(args.hasta);
  }
  if (args.soloVencidos) {
    where.push("date(fecha_vencimiento) < date('now') AND total > 0");
  }
  if (args.buscar && args.buscar.trim()) {
    const s = `%${args.buscar.trim()}%`;
    where.push("(razon_social LIKE ? OR cliente LIKE ? OR documento LIKE ? OR descripcion LIKE ?)");
    params.push(s, s, s, s);
  }
  if (args.ids && args.ids.length > 0) {
    const placeholders = args.ids.map(() => "?").join(",");
    where.push(`id IN (${placeholders})`);
    params.push(...args.ids);
  }

  const limit = Math.min(Math.max(args.limit ?? 2000, 1), 5000);

  const sql = `
    SELECT
      id,
      cliente,
      razon_social,
      tipo_documento,
      documento,
      fecha_emision,
      fecha_vencimiento,
      vendedor,
      descripcion,
      valor_documento,
      retenciones,
      iva,
      cobros,
      total,
      -- Calculamos días vencidos al vuelo: (Hoy - Vencimiento)
      CAST(julianday(date('now', 'localtime')) - julianday(fecha_vencimiento) AS INTEGER) as dias_vencidos
    FROM documentos
    WHERE ${where.join(" AND ")}
    ORDER BY date(fecha_vencimiento) ASC, razon_social ASC, documento ASC
    LIMIT ${limit}
  `;

  return db.prepare(sql).all(...params);
}

function topClientes(limit = 10) {
  const n = Math.min(Math.max(limit, 1), 200);
  return db
    .prepare(
      `SELECT
         cliente,
         MAX(razon_social) AS razon_social,
         SUM(total) AS total,
         SUM(CASE WHEN date(fecha_vencimiento) < date('now', 'localtime') AND total > 0 THEN total ELSE 0 END) AS vencida,
         SUM(CASE WHEN date(fecha_vencimiento) < date('now', 'localtime', '-90 day') AND total > 0 THEN total ELSE 0 END) AS mora90,
         COUNT(1) AS documentos
       FROM documentos
       WHERE is_subtotal = 0
       GROUP BY cliente
       ORDER BY total DESC
       LIMIT ${n}`
    )
    .all();
}

// -----------------------------
// Helpers de Importación
// -----------------------------

// Normalizar texto (quitar tildes y ñ)
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Formatear fecha de Excel a YYYY-MM-DD
const formatDate = (val: any) => {
  if (val instanceof Date) return val.toISOString().split('T')[0];
  const s = String(val || "").trim();
  if (!s) return "";
  // Detectar formato DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  return s;
};

// Helper para parsear números (maneja "1.234,56" y "217,33")
const parseNumber = (val: any): number => {
  if (val == null || val === "") return 0;
  if (typeof val === 'number') return val;
  
  let s = String(val).trim();
  // Limpiar posibles símbolos de moneda
  s = s.replace(/[$\s]/g, '');

  if (s.includes(',') && s.includes('.')) {
    // Caso mixto: detectar cuál es el separador decimal por la posición
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) {
      // 1.234,56 -> 1234.56 (Europeo/Latino con miles)
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,234.56 -> 1234.56 (Americano)
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    // Solo coma: asumir decimal (217,33 -> 217.33)
    s = s.replace(',', '.');
  }
  
  const n = Number(s);
  return isNaN(n) ? 0 : n;
};

function parseExcel(filePath: string, ivaPercent: number) {
  console.log("📄 Leyendo archivo...");
  const fileBuffer = fs.readFileSync(filePath);
  console.log("📚 Parseando workbook...");
  const workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  console.log("📋 Hoja seleccionada:", sheetName);
  const sheet = workbook.Sheets[sheetName];
  
  console.log("🔄 Convirtiendo a JSON...");
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];
  console.log("📊 Total filas leídas:", rawRows.length);
  if (!rawRows || rawRows.length === 0) return [];

  // AJUSTE: El encabezado comienza en la Fila 5 (índice 4)
  const headerIdx = 4;

  if (!rawRows[headerIdx]) return [];

  const headers = rawRows[headerIdx].map(h => String(h).trim().toLowerCase());
  const dataRows = rawRows.slice(headerIdx + 1);
  const normalizedHeaders = headers.map(normalize);
  console.log("✅ Encabezados detectados:", normalizedHeaders.slice(0, 10), "...");

  // Validación de estructura mínima: abortar si faltan columnas clave.
  const hasHeader = (aliases: string[]) => aliases.some(alias => normalizedHeaders.some(h => h.includes(normalize(alias))));
  const missingHeaders: string[] = [];
  if (!hasHeader(["razon social", "nombre"])) missingHeaders.push("Razón Social / Nombre");
  if (!hasHeader(["documento", "# documento", "numero"])) missingHeaders.push("# Documento");
  if (!hasHeader(["total", "saldo"])) missingHeaders.push("Total / Saldo");
  if (!hasHeader(["vencimiento", "f. vencimiento", "vence"])) missingHeaders.push("Fecha de Vencimiento");

  if (missingHeaders.length > 0) {
    const msg = `Estructura de archivo no reconocida. Faltan columnas obligatorias: ${missingHeaders.join(", ")}. Verifica que el encabezado esté en la fila 5 y que los nombres de columna no se hayan removido o renombrado.`;
    throw new Error(msg);
  }
  console.log("✅ Validación de estructura OK");

  // Validar que el orden de columnas coincida con la importación anterior (si existe)
  const storedHeadersJson = db.prepare("SELECT excel_headers_json FROM empresa WHERE id = 1").get() as any;
  const storedHeaders = storedHeadersJson?.excel_headers_json ? JSON.parse(storedHeadersJson.excel_headers_json) : null;

  if (storedHeaders && Array.isArray(storedHeaders)) {
    // Comparar orden exacto
    if (JSON.stringify(normalizedHeaders) !== JSON.stringify(storedHeaders)) {
      const msg = `Orden de columnas no reconocido. Se esperaba: [${storedHeaders.join(", ")}]. Recibido: [${normalizedHeaders.join(", ")}]. Si cambió la estructura intencionalmente, usa 'Reiniciar estructura Excel' en Config.`;
      throw new Error(msg);
    }
  } else if (normalizedHeaders.length > 0) {
    // Primera importación: guardar la estructura
    try {
      db.prepare("UPDATE empresa SET excel_headers_json = @headers WHERE id = 1").run({ headers: JSON.stringify(normalizedHeaders) });
    } catch {}
  }

  const getVal = (row: any[], keys: string[], exclude: string[] = []) => {
    const idx = normalizedHeaders.findIndex(h => 
      keys.some(k => h.includes(normalize(k))) &&
      !exclude.some(e => h.includes(normalize(e)))
    );
    return (idx >= 0 && row[idx] != null) ? row[idx] : "";
  };

  const documents: any[] = [];

  for (const row of dataRows) {
    // Columna B: "razon social" (Nombre del cliente)
    const razon_social = String(getVal(row, ['razon social', 'razón social', 'nombre'])).trim();
    
    // Si no hay razón social, saltamos la fila (probablemente vacía)
    if (!razon_social) continue;

    // Usamos SIEMPRE la razón social como identificador, ignorando la columna A ("Cliente")
    const cliente = razon_social;

    // Columna D: "# documentos"
    // CORRECCIÓN: Excluir 'tipo' para que no lea la columna C ("Tipo Documento") por error
    const documento = String(getVal(row, ['# documentos', '# documento', 'documento', 'número'], ['tipo'])).trim();
    if (!documento) continue;

    // Columna R: "valor documento"
    const valor_documento = Number(parseNumber(getVal(row, ['valor documento', 'valor'])).toFixed(2));
    
    // Columna S: "retenciones"
    const retenciones = Number(parseNumber(getVal(row, ['retenciones', 'retencion'])).toFixed(2));
    
    // Columna T: "cobros"
    const cobros = Number(parseNumber(getVal(row, ['cobros', 'cobro'])).toFixed(2));
    
    // Columna P: "total"
    const total = Number(parseNumber(getVal(row, ['total', 'saldo'])).toFixed(2));

    // Cálculo de IVA: Desglosamos del valor_documento (Columna R)
    let iva = 0;
    if (iva === 0 && valor_documento > 0) {
      const base = valor_documento / (1 + (ivaPercent / 100));
      iva = Number((valor_documento - base).toFixed(2));
    }

    documents.push({
      cliente,
      razon_social,
      // Columna C: "tipo documento"
      tipo_documento: String(getVal(row, ['tipo documento', 'tipo doc', 'tipo'])).trim().toUpperCase() || 'FACTURA',
      documento,
      // Columna E: "f. emision"
      fecha_emision: formatDate(getVal(row, ['f. emision', 'f. emisión', 'emisión', 'emision'])),
      // Columna F: "f. vencimiento"
      fecha_vencimiento: formatDate(getVal(row, ['f. vencimiento', 'vencimiento', 'vence'])),
      // Columna G: "vendedor"
      vendedor: String(getVal(row, ['vendedor'])).trim(),
      total,
      valor_documento,
      iva,
      retenciones,
      cobros,
      // Columna Q: "descripcion"
      descripcion: String(getVal(row, ['descripcion', 'descripción', 'detalle'])).trim()
    });
  }
  return documents;
}

function saveDocumentsToDb(db: any, docs: any[]) {
  // Marca de tiempo para esta importación
  const now = new Date();
  const importTimestamp = now.toISOString().replace('T', ' ').slice(0, 19);

  const checkStmt = db.prepare("SELECT id FROM documentos WHERE documento = @documento AND cliente = @cliente AND tipo_documento = @tipo_documento LIMIT 1");
  
  const insertDoc = db.prepare(`
    INSERT INTO documentos (
      cliente, razon_social, tipo_documento, documento, 
      fecha_emision, fecha_vencimiento, vendedor,
      total, valor_documento, iva, retenciones, cobros, descripcion, is_subtotal,
      importado_en
    ) VALUES (
      @cliente, @razon_social, @tipo_documento, @documento,
      @fecha_emision, @fecha_vencimiento, @vendedor,
      @total, @valor_documento, @iva, @retenciones, @cobros, @descripcion, 0,
      @importado_en
    )
  `);

  // Actualización si hay cambios en valores
  const updateDocValues = db.prepare(`
    UPDATE documentos SET
      razon_social = @razon_social,
      fecha_emision = @fecha_emision,
      fecha_vencimiento = @fecha_vencimiento,
      vendedor = @vendedor,
      total = @total,
      valor_documento = @valor_documento,
      iva = @iva,
      retenciones = @retenciones,
      cobros = @cobros,
      descripcion = @descripcion,
      importado_en = @importado_en
    WHERE id = @id AND (
      COALESCE(razon_social, '') != @razon_social OR
      COALESCE(fecha_emision, '') != @fecha_emision OR
      COALESCE(fecha_vencimiento, '') != @fecha_vencimiento OR
      COALESCE(vendedor, '') != @vendedor OR
      ABS(COALESCE(total, 0) - @total) > 0.005 OR
      ABS(COALESCE(valor_documento, 0) - @valor_documento) > 0.005 OR
      ABS(COALESCE(iva, 0) - @iva) > 0.005 OR
      ABS(COALESCE(retenciones, 0) - @retenciones) > 0.005 OR
      ABS(COALESCE(cobros, 0) - @cobros) > 0.005 OR
      COALESCE(descripcion, '') != @descripcion
    )
  `);

  // Actualización simple de "Visto" (para confirmar que sigue en cartera aunque no cambie el saldo)
  const updateDocSeen = db.prepare(`UPDATE documentos SET importado_en = @importado_en WHERE id = @id`);

  let insertedDocs = 0;
  let updatedDocs = 0;
  let paidDocs = 0;
  const insertedIds: number[] = [];

  const transaction = db.transaction((documents: any[]) => {
    for (const doc of documents) {
      const existing = checkStmt.get({ documento: doc.documento, cliente: doc.cliente, tipo_documento: doc.tipo_documento });
      const docWithTime = { ...doc, importado_en: importTimestamp };

      if (existing) {
        // Intentamos actualizar valores
        const info = updateDocValues.run({ ...docWithTime, id: existing.id });
        if (info.changes > 0) {
          updatedDocs++;
        } else {
          // Si no cambiaron valores, solo actualizamos la fecha de "visto"
          updateDocSeen.run({ importado_en: importTimestamp, id: existing.id });
        }
      } else {
        const info = insertDoc.run(docWithTime);
        insertedIds.push(Number(info.lastInsertRowid));
        insertedDocs++;
      }
    }

    // LÓGICA CLAVE: Si una factura tenía saldo > 0 pero NO vino en este Excel (su importado_en es viejo),
    // significa que ya fue pagada totalmente en Contifico. 
    // NO LA BORRAMOS, solo actualizamos su saldo a 0 y ajustamos los cobros para que cuadre el historial.
    const closeInfo = db.prepare(`
      UPDATE documentos 
      SET 
        total = 0,
        cobros = MAX(0, valor_documento - retenciones)
      WHERE importado_en != @importTimestamp AND total > 0
    `).run({ importTimestamp });
    
    paidDocs = closeInfo.changes;
  });

  transaction(docs);

  return { insertedDocs, updatedDocs, insertedIds, paidDocs };
}

// -----------------------------
// Electron lifecycle
// -----------------------------
app.whenReady().then(async () => {
  // Inicializar DB cuando la app esté lista
  const dbInstance = openDb();
  db = dbInstance.db;

  // INICIAR SERVIDOR WEB
  startWebServer();

  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  closeDb();
  if (process.platform !== "darwin") app.quit();
});

// -----------------------------
// IPC
// -----------------------------
ipcMain.handle("ping", async () => ({ ok: true }));
ipcMain.handle("getDbPath", async () => getDbFilePath());

ipcMain.handle("statsObtener", async () => {
  return computeStats();
});

ipcMain.handle("filtrosListar", async () => {
  return listFiltros();
});

ipcMain.handle("topClientes", async (_evt, limit?: number) => {
  return topClientes(limit ?? 10);
});

ipcMain.handle("documentosListar", async (_evt, args: ListarArgs) => {
  try {
    const rows = listarDocumentos(args || {});
    return { ok: true, rows };
  } catch (e: any) {
    return { ok: false, message: e?.message || String(e), rows: [] };
  }
});

ipcMain.handle("generarPDF", async (_evt, filename) => {
  if (!mainWindow) return { ok: false, message: "Ventana no encontrada" };
  try {
    // Genera el PDF usando los estilos CSS de @media print
    const pdfData = await mainWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: "A4",
      margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 } // Márgenes en pulgadas aprox
    });
    
    const downloadPath = app.getPath("downloads");
    const safeName = (filename || "documento").replace(/[^a-z0-9]/gi, '_');
    const fullPath = join(downloadPath, `${safeName}.pdf`);
    
    fs.writeFileSync(fullPath, pdfData);
    
    // Abre la carpeta y selecciona el archivo para facilitar el adjuntado
    shell.showItemInFolder(fullPath);
    
    return { ok: true, path: fullPath };
  } catch (e: any) {
    return { ok: false, message: e.message };
  }
});

ipcMain.handle("actualizarDiasCredito", async (_evt, { id, dias }) => {
  try {
    // SQLite permite sumar días directamente a una fecha: date(fecha, '+X days')
    const stmt = db.prepare("UPDATE documentos SET fecha_vencimiento = date(fecha_emision, '+' || @dias || ' days') WHERE id = @id");
    stmt.run({ id, dias });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: e.message };
  }
});

ipcMain.handle("empresaObtener", async () => {
  return getEmpresa();
});

ipcMain.handle("empresaGuardar", async (_evt, data) => {
  const stmt = db.prepare(`
    UPDATE empresa 
    SET nombre = @nombre, direccion = @direccion, telefono = @telefono, email = @email, ruc = @ruc, administrador = @administrador, iva_percent = @iva_percent
    WHERE id = 1
  `);
  stmt.run(data);
  return { ok: true };
});

ipcMain.handle("reiniciarEstructuraExcel", async () => {
  try {
    db.prepare("UPDATE empresa SET excel_headers_json = '' WHERE id = 1").run();
    return { ok: true, message: "Estructura de Excel reiniciada. La próxima importación definirá una nueva estructura." };
  } catch (e: any) {
    return { ok: false, message: e.message };
  }
});

ipcMain.handle("limpiarBaseDatos", async () => {
  try {
    const tx = db.transaction(() => {
      // Truncar tablas de datos, preservando config
      db.exec("DELETE FROM documentos");
      db.exec("DELETE FROM gestiones");
      db.exec("DELETE FROM disputas");
      db.exec("DELETE FROM cuentas_aplicar");
      db.exec("DELETE FROM abonos");
      db.exec("DELETE FROM campana_clientes");
      db.exec("DELETE FROM campanas");
      // Resetear excel_headers_json para que próxima importación defina nueva estructura
      db.prepare("UPDATE empresa SET excel_headers_json = '' WHERE id = 1").run();
    });
    tx();
    return { ok: true, message: "Base de datos limpia. Preservada: config de empresa, IVA, meta, clientes y vendedores." };
  } catch (e: any) {
    return { ok: false, message: e.message };
  }
});

ipcMain.handle("clientesAnalisis", async () => {
  return getAnalisisRiesgo();
});

ipcMain.handle("clienteObtenerInfo", (_evt, codigoCliente) => {
  return getClienteInfo(codigoCliente);
});

ipcMain.handle("clienteGuardarInfo", (_evt, data) => {
  const exists = db.prepare("SELECT 1 FROM clientes WHERE cliente = ?").get(data.cliente);
  if (exists) {
    db.prepare("UPDATE clientes SET telefono=@telefono, email=@email, direccion=@direccion, contacto=@contacto WHERE cliente=@cliente").run(data);
  } else {
    db.prepare("INSERT INTO clientes (cliente, razon_social, vendedor, telefono, email, direccion, contacto) VALUES (@cliente, @razon_social, @vendedor, @telefono, @email, @direccion, @contacto)").run(data);
  }
  return { ok: true };
});

ipcMain.handle("gestionGuardar", (_evt, data) => {
  db.prepare("INSERT INTO gestiones (cliente, tipo, resultado, observacion, fecha_promesa, monto_promesa, usuario, motivo) VALUES (@cliente, @tipo, @resultado, @observacion, @fecha_promesa, @monto_promesa, @usuario, @motivo)").run({
    ...data,
    usuario: data.usuario || 'sistema',
    motivo: data.motivo || null
  });
  return { ok: true };
});

ipcMain.handle("gestionesListar", (_evt, cliente) => {
  return listGestiones(cliente);
});

ipcMain.handle("gestionEditar", (_evt, { id, ...data }) => {
  // Añadir actualizado_en y usuario si viene
  return updateGestion(id, { ...data, actualizado_en: new Date().toISOString(), usuario: data.usuario || 'sistema' });
});

ipcMain.handle("gestionEliminar", (_evt, id) => {
  return deleteGestion(id);
});

ipcMain.handle("gestionCumplir", (_evt, id) => {
  return markGestionFulfilled(id);
});

ipcMain.handle("gestionesReporte", (_evt, args) => {
  return getGestionesReporte(args);
});

ipcMain.handle("getNetworkInfo", async () => {
  return { ip: getNetworkIp(), port: 3000 };
});

ipcMain.handle("campanasListar", async () => {
  const data = db.prepare(`
    SELECT id, nombre, descripcion, fecha_inicio, fecha_fin, responsable, creado_en
    FROM campanas
    ORDER BY creado_en DESC
  `).all();
  return { ok: true, rows: data };
});

ipcMain.handle("campanasGuardar", (_evt, data) => {
  if (data.id) {
    db.prepare(`
      UPDATE campanas
      SET nombre = @nombre, descripcion = @descripcion, fecha_inicio = @fecha_inicio, fecha_fin = @fecha_fin, responsable = @responsable
      WHERE id = @id
    `).run(data);
  } else {
    db.prepare(`
      INSERT INTO campanas (nombre, descripcion, fecha_inicio, fecha_fin, responsable)
      VALUES (@nombre, @descripcion, @fecha_inicio, @fecha_fin, @responsable)
    `).run(data);
  }
  return { ok: true };
});

ipcMain.handle("motivosImpago", async () => {
  const data = db.prepare(`
    SELECT g.motivo, COUNT(*) as count, SUM(COALESCE(d.total - d.cobros, 0)) as total
    FROM gestiones g
    LEFT JOIN documentos d ON g.cliente = d.cliente
    WHERE g.motivo IS NOT NULL AND g.motivo != ''
    GROUP BY g.motivo
    ORDER BY count DESC
  `).all();
  
  return data.map((row: any) => ({
    label: row.motivo,
    count: row.count,
    total: row.total || 0
  }));
});

ipcMain.handle("productividadGestor", async () => {
  const data = db.prepare(`
    SELECT 
      g.usuario,
      COUNT(*) as total_gestiones,
      SUM(CASE WHEN g.resultado LIKE '%Promesa%' THEN 1 ELSE 0 END) as promesas,
      SUM(CASE WHEN g.resultado LIKE '%Pagado%' OR g.resultado LIKE '%Abonado%' THEN 1 ELSE 0 END) as pagos,
      ROUND(100.0 * SUM(CASE WHEN g.resultado LIKE '%Promesa%' THEN 1 ELSE 0 END) / COUNT(*), 1) as tasa_promesa,
      ROUND(SUM(COALESCE(d.total - d.cobros, 0)), 2) as saldo_recuperable
    FROM gestiones g
    LEFT JOIN documentos d ON g.cliente = d.cliente
    WHERE g.usuario IS NOT NULL AND g.usuario != ''
    GROUP BY g.usuario
    ORDER BY total_gestiones DESC
  `).all();
  
  return data;
});

ipcMain.handle("segmentacionRiesgo", async () => {
  const data = db.prepare(`
    SELECT 
      c.id,
      c.cliente,
      ROUND(SUM(COALESCE(d.total - d.cobros, 0)), 2) as saldo_total,
      COUNT(DISTINCT d.id) as documentos,
      MAX(d.fecha_vencimiento) as fecha_vencimiento_max,
      CASE
        WHEN COUNT(g.id) = 0 THEN 'Bajo'
        WHEN SUM(COALESCE(d.total - d.cobros, 0)) > 100000 AND d.fecha_vencimiento < date('now', '-90 days') THEN 'Alto'
        WHEN SUM(COALESCE(d.total - d.cobros, 0)) > 50000 AND d.fecha_vencimiento < date('now', '-30 days') THEN 'Medio'
        ELSE 'Bajo'
      END as riesgo
    FROM clientes c
    LEFT JOIN documentos d ON c.cliente = d.cliente
    LEFT JOIN gestiones g ON c.cliente = g.cliente AND g.fecha >= date('now', '-30 days')
    GROUP BY c.id
    ORDER BY saldo_total DESC
  `).all();
  
  return data.map((row: any) => ({
    id: row.id,
    nombre: row.cliente,
    saldo: row.saldo_total || 0,
    documentos: row.documentos || 0,
    riesgo: row.riesgo
  }));
});

ipcMain.handle("alertasIncumplimiento", async () => {
  const data = db.prepare(`
    SELECT 
      d.cliente,
      d.documento,
      d.total as monto,
      d.fecha_vencimiento,
      CAST((julianday('now') - julianday(d.fecha_vencimiento)) AS INTEGER) as dias_vencidos,
      CASE 
        WHEN CAST((julianday('now') - julianday(d.fecha_vencimiento)) AS INTEGER) > 120 THEN 'Crítico'
        WHEN CAST((julianday('now') - julianday(d.fecha_vencimiento)) AS INTEGER) > 90 THEN 'Alto'
        WHEN CAST((julianday('now') - julianday(d.fecha_vencimiento)) AS INTEGER) > 30 THEN 'Medio'
        ELSE 'Bajo'
      END as severidad
    FROM documentos d
    WHERE d.fecha_vencimiento < date('now') AND (d.total - d.cobros) > 0
    ORDER BY dias_vencidos DESC
    LIMIT 50
  `).all();

  return data.map((row: any) => ({
    cliente: row.cliente,
    documento: row.documento,
    monto: row.monto || 0,
    diasVencidos: row.dias_vencidos || 0,
    severidad: row.severidad
  }));
});

ipcMain.handle("pronosticoFlujoCaja", async () => {
  const periodos = [];
  for (let i = 1; i <= 3; i++) {
    const dias = i * 15;
    const fecha_hasta = new Date();
    fecha_hasta.setDate(fecha_hasta.getDate() + dias);
    
    const promesas = db.prepare(`
      SELECT SUM(COALESCE(monto_promesa, 0)) as total
      FROM gestiones
      WHERE resultado LIKE '%Promesa%' 
        AND fecha_promesa >= date('now')
        AND fecha_promesa <= date(?)
        AND monto_promesa > 0
    `).get(fecha_hasta.toISOString().split('T')[0]);

    periodos.push({
      periodo: `${dias} días`,
      fechaHasta: fecha_hasta.toISOString().split('T')[0],
      flujoEsperado: promesas?.total || 0,
      confianza: i === 1 ? 95 : i === 2 ? 75 : 50
    });
  }
  return periodos;
});

ipcMain.handle("tendenciasHistoricas", async () => {
  const meses = [];
  for (let i = 11; i >= 0; i--) {
    const fecha = new Date();
    fecha.setMonth(fecha.getMonth() - i);
    const yearMes = fecha.getFullYear().toString() + '-' + String(fecha.getMonth() + 1).padStart(2, '0');
    
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as documentos,
        SUM(COALESCE(total, 0)) as emision,
        SUM(CASE WHEN fecha_vencimiento < date('now') AND (total - cobros) > 0 THEN 1 ELSE 0 END) as vencidos,
        SUM(COALESCE(cobros, 0)) as cobrado
      FROM documentos
      WHERE fecha_emision LIKE ?
    `).get(yearMes + '%');

    meses.push({
      mes: yearMes,
      documentos: stats?.documentos || 0,
      emision: stats?.emision || 0,
      cobrado: stats?.cobrado || 0,
      vencidos: stats?.vencidos || 0
    });
  }
  return meses;
});

ipcMain.handle("disputasListar", async () => {
  const data = db.prepare(`
    SELECT id, documento, cliente, monto, motivo, estado, 
           fecha_creacion, fecha_resolucion, observacion
    FROM disputas
    ORDER BY fecha_creacion DESC
  `).all();
  return data;
});

ipcMain.handle("disputaCrear", (_evt, data) => {
  db.prepare(`
    INSERT INTO disputas (documento, cliente, monto, motivo, observacion, usuario_creador)
    VALUES (@documento, @cliente, @monto, @motivo, @observacion, @usuario)
  `).run({
    ...data,
    usuario: data.usuario || 'sistema'
  });
  return { ok: true };
});

ipcMain.handle("disputaActualizar", (_evt, data) => {
  db.prepare(`
    UPDATE disputas 
    SET estado = @estado, fecha_resolucion = @fecha_resolucion, observacion = @observacion
    WHERE id = @id
  `).run(data);
  return { ok: true };
});

ipcMain.handle("cuentasAplicarListar", async () => {
  const data = db.prepare(`
    SELECT id, documento, cliente, monto, tipo, estado, 
           fecha_recepcion, fecha_aplicacion, documento_aplicado, observacion
    FROM cuentas_aplicar
    ORDER BY fecha_recepcion DESC
  `).all();
  return data;
});

ipcMain.handle("cuentaAplicarCrear", (_evt, data) => {
  db.prepare(`
    INSERT INTO cuentas_aplicar (documento, cliente, monto, tipo, observacion, usuario_creador)
    VALUES (@documento, @cliente, @monto, @tipo, @observacion, @usuario)
  `).run({
    ...data,
    usuario: data.usuario || 'sistema'
  });
  return { ok: true };
});

ipcMain.handle("cuentaAplicarActualizar", (_evt, data) => {
  db.prepare(`
    UPDATE cuentas_aplicar 
    SET estado = @estado, fecha_aplicacion = @fecha_aplicacion, documento_aplicado = @documento_aplicado, observacion = @observacion
    WHERE id = @id
  `).run(data);
  return { ok: true };
});

ipcMain.handle("importarContifico", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      { name: "Excel", extensions: ["xlsx", "xls", "xlsm"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { ok: false, message: "Importación cancelada", insertedDocs: 0, insertedClientes: 0, omittedRows: 0 };
  }

  const filePath = result.filePaths[0];
  try {
    console.log("📥 Iniciando importación:", filePath);
    
    // Re-open DB in case previous instance closed unexpectedly
    if (!db || !db.open) {
      db = openDb().db;
    }
    
    const empresa = db.prepare("SELECT iva_percent FROM empresa WHERE id = 1").get();
    const ivaPercent = empresa?.iva_percent ?? 15.0;

    // 1. Parsear Excel
    console.log("📋 Parseando Excel con IVA:", ivaPercent);
    console.log("🚀 A punto de llamar parseExcel...");
    const docs = parseExcel(filePath, ivaPercent);
    console.log("✅ parseExcel completado, documentos:", docs.length);
    if (docs.length === 0) {
      return { ok: false, message: "El archivo no tiene datos o no se encontraron encabezados en la Fila 5.", insertedDocs: 0, updatedDocs: 0, insertedClientes: 0, omittedRows: 0 };
    }

    // 2. Guardar en DB
    const { insertedDocs, updatedDocs, insertedIds, paidDocs } = saveDocumentsToDb(db, docs);
    
    // Si hubo inserciones O actualizaciones, es un éxito. Si no hubo nada, ya estaba ingresada.
    let message = "Proceso completado.";
    if (insertedDocs > 0) message = `Se ingresaron ${insertedDocs} nuevos documentos.`;
    else if (updatedDocs > 0) message = `Se actualizaron saldos en ${updatedDocs} documentos.`;
    else if (paidDocs > 0) message = `Se cerraron ${paidDocs} documentos pagados.`;
    else message = "La cartera está al día (sin cambios).";

    return { 
      ok: true, 
      filePath, 
      insertedDocs, 
      updatedDocs,
      paidDocs,
      insertedClientes: 0, 
      omittedRows: 0, 
      message,
      insertedIds // Devolvemos los IDs para que el frontend pueda revisarlos
    };
  } catch (e: any) {
    console.error("❌ Error en importación:", e);
    return { ok: false, message: e?.message || String(e), insertedDocs: 0, insertedClientes: 0, omittedRows: 0 };
  }
});
