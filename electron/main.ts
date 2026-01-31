import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";
import { openDb, getDbFilePath } from "./db";
import * as XLSX from "xlsx";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import { spawn } from "child_process";
/* eslint-disable @typescript-eslint/no-explicit-any */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Exponer __dirname para dependencias CommonJS (ej. ngrok) en entorno ESM
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__dirname = __dirname;

let mainWindow: BrowserWindow | null = null;
let db: any;
let cloudflaredProcess: any = null;
let ngrokUrl: string = "";
let ngrokListener: any = null;

// Token secreto para identificar que la petición viene de la app desktop
const DESKTOP_TOKEN = `desktop-${Date.now()}-${Math.random().toString(36)}`;

// Constantes para ngrok (acceso remoto)
const NGROK_PORT = 3000;
const NGROK_AUTHTOKEN = process.env.NGROK_AUTHTOKEN || "";

// Verbosidad de logs (por defecto reducido para evitar ruido en terminal)
const VERBOSE_API_LOGS = process.env.VERBOSE_API_LOGS === "1";
const VERBOSE_IP_LOGS = process.env.VERBOSE_IP_LOGS === "1";

// Constantes placeholder para compatibilidad con lógica previa de Cloudflare
const CLOUDFLARE_TUNNEL_URL = "";
const CLOUDFLARE_TUNNEL_NAME = "";

// Función para verificar si la petición viene de la aplicación desktop
function isDesktopClient(req: http.IncomingMessage): boolean {
  return req.headers["x-desktop-token"] === DESKTOP_TOKEN;
}

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

    const sorted = analisis.sort((a: any, b: any) => a.score - b.score) as Array<Record<string, unknown>>;
    return { ok: true, rows: sorted };
  } catch (e: any) {
    return { ok: false, message: e.message, rows: [] as unknown[] };
  }
}

function getNetworkIp(log: boolean = false) {
  const interfaces = os.networkInterfaces();
  const validIps: { name: string; address: string; priority: number }[] = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      if (iface.family === "IPv4" && !iface.internal) {
        // Determinar prioridad: WiFi > Ethernet > VirtualBox > Otros
        let priority = 999;
        const nameLower = name.toLowerCase();
        
        if (nameLower.includes('wi-fi') || nameLower.includes('wifi') || nameLower.includes('wlan')) {
          priority = 1; // Mayor prioridad para WiFi
        } else if (nameLower.includes('ethernet') || nameLower.includes('eth')) {
          priority = 2;
        } else if (nameLower.includes('virtualbox') || nameLower.includes('vmware') || nameLower.includes('vbox')) {
          priority = 100; // Menor prioridad para adaptadores virtuales
        }
        
        validIps.push({ name, address: iface.address, priority });
      }
    }
  }
  
  // Ordenar por prioridad y devolver la primera
  if (validIps.length > 0) {
    validIps.sort((a, b) => a.priority - b.priority);
    if (log || VERBOSE_IP_LOGS) {
      console.log(`📡 IP seleccionada: ${validIps[0].address} (${validIps[0].name})`);
    }
    return validIps[0].address;
  }
  
  return "localhost";
}

// Función para verificar si el túnel de Cloudflare está activo
async function checkCloudflaredTunnel(): Promise<boolean> {
  try {
    const response = await fetch(`${CLOUDFLARE_TUNNEL_URL}/api/stats`, {
      method: "GET",
      timeout: 5000,
    } as any);
    const isHealthy = response.status >= 200 && response.status < 500;
    console.log(`🌐 Tunnel health check: ${isHealthy ? "✓ OK" : "✗ FAILED"} (${response.status})`);
    return isHealthy;
  } catch (error) {
    console.log(`🌐 Tunnel health check failed:`, error);
    return false;
  }
}

// Función para reiniciar el túnel de Cloudflare
async function restartCloudflaredTunnel(): Promise<boolean> {
  try {
    console.log("🌐 Intentando reiniciar túnel de Cloudflare...");
    
    // Path del ejecutable cloudflared
    const cloudflaredPath = "C:\\Users\\j-mej\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe\\cloudflared.exe";
    
    // Ejecutar el túnel en background
    cloudflaredProcess = spawn(cloudflaredPath, ["tunnel", "run", CLOUDFLARE_TUNNEL_NAME], {
      detached: true,
      stdio: "ignore",
    });
    
    cloudflaredProcess.unref();
    console.log(`✅ Túnel reiniciado (PID: ${cloudflaredProcess?.pid})`);
    
    // Esperar 5 segundos para que se conecte
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Verificar que esté conectado
    const isHealthy = await checkCloudflaredTunnel();
    if (isHealthy) {
      mainWindow?.webContents.send("tunnel-status", { status: "connected" });
      return true;
    } else {
      console.log("⚠️ Túnel reiniciado pero aún no responde");
      return false;
    }
  } catch (error) {
    console.error("❌ Error reiniciando túnel:", error);
    return false;
  }
}

// Función para iniciar ngrok y obtener URL remota
async function startNgrok(): Promise<string> {
  try {
    const ngrok = await import("@ngrok/ngrok");
    console.log("🌐 Iniciando ngrok para acceso remoto...");
    
    // Configurar authtoken si existe
    if (NGROK_AUTHTOKEN) {
      console.log("🔐 Usando authtoken de ngrok");
    }
    
    // Iniciar listener
    ngrokListener = await ngrok.forward({
      addr: NGROK_PORT,
      authtoken_from_env: true,
    });
    
    const url = ngrokListener.url();
    ngrokUrl = url || "";
    console.log(`✅ ngrok conectado: ${ngrokUrl}`);
    mainWindow?.webContents.send("remote-url-updated", { url: ngrokUrl });
    return ngrokUrl;
  } catch (error) {
    console.error("❌ Error iniciando ngrok:", error);
    return "";
  }
}

// Función para verificar y reiniciar ngrok si es necesario
async function checkAndRefreshNgrok(): Promise<string> {
  try {
    // Probar si la URL actual funciona
    if (ngrokUrl) {
      const response = await fetch(`${ngrokUrl}/api/stats`, {
        timeout: 5000,
      } as any);
      
      if (response.status >= 200 && response.status < 500) {
        console.log(`✅ ngrok sigue activo: ${ngrokUrl}`);
        return ngrokUrl;
      }
    }
    
    // Si no funciona, reiniciar
    console.log("⚠️ ngrok desconectado, reiniciando...");
    if (ngrokListener) {
      await ngrokListener.close();
      ngrokListener = null;
    }
    return await startNgrok();
  } catch (error) {
    console.error("❌ Error verificando ngrok:", error);
    try {
      return await startNgrok();
    } catch (e) {
      return "";
    }
  }
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
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-desktop-token");
    
    // Manejar preflight requests
    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }
    
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const isDesktop = isDesktopClient(req);
    
    // 1. API Endpoints
    if (url.pathname.startsWith("/api/")) {
      res.setHeader("Content-Type", "application/json");
      
      // Operaciones que requieren permisos de escritura (solo desktop)
      const writeOperations = [
        "/api/importar",
        "/api/limpiar",
        "/api/empresa/guardar",
        "/api/cliente/guardar",
        "/api/gestion/guardar",
        "/api/gestion/eliminar",
        "/api/gestion/cumplir",
        "/api/campana/guardar",
        "/api/campana/eliminar",
        "/api/disputa/crear",
        "/api/cuenta-aplicar/crear",
        "/api/cuenta-aplicar/actualizar"
      ];
      
      // Verificar permisos para operaciones de escritura
      if (writeOperations.some(op => url.pathname.startsWith(op)) && !isDesktop) {
        res.writeHead(403);
        res.end(JSON.stringify({ 
          ok: false, 
          message: "⚠️ Operación no permitida. Solo la aplicación de escritorio puede hacer cambios."
        }));
        return;
      }
      
      try {
        let data: any = { ok: false, message: "Ruta no encontrada" };

        if (VERBOSE_API_LOGS) {
          console.log(`📥 [${url.pathname}] Request desde ${isDesktop ? 'Desktop' : 'Web'}`);
        }

        if (url.pathname === "/api/config") {
          // Endpoint para obtener configuración (IP local, etc)
          const localIp = getNetworkIp();
          data = { 
            ok: true, 
            remoteUrl: `http://${localIp}:${NGROK_PORT}`,
            localIp,
            port: NGROK_PORT
          };
        }
        else if (url.pathname === "/api/stats") data = computeStats();
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
    const filePath = join(distPath, safePath.startsWith("/") ? safePath.slice(1) : safePath);

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
    const interfaces = os.networkInterfaces();
    const urls: string[] = [];
    Object.keys(interfaces).forEach((ifaceName) => {
      interfaces[ifaceName]?.forEach((iface) => {
        if (iface.family === "IPv4" && !iface.internal) {
          urls.push(`http://${iface.address}:3000`);
        }
      });
    });

    console.log(`--- SERVIDOR WEB LOCAL INICIADO --- ${urls.join(" | ")}`);
    if (VERBOSE_IP_LOGS) {
      urls.forEach(u => console.log(`Acceso disponible en: ${u}`));
    }
    
    // Enviar IP local como URL remota inicial
    const localIp = getNetworkIp();
    if (localIp !== "localhost") {
      mainWindow?.webContents.send("remote-url-updated", { url: `http://${localIp}:3000` });
    }
  });
}


function shouldOpenDevTools() {
  return process.env.OPEN_DEVTOOLS === "1" || process.env.OPEN_DEVTOOLS === "true";
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    frame: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    // Intentar cargar icono personalizado
    icon: fs.existsSync(join(app.getPath('userData'), 'custom-logo.png')) 
      ? join(app.getPath('userData'), 'custom-logo.png') 
      : undefined
  });

  mainWindow.maximize();
  mainWindow.show();

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
        COALESCE(SUM(CASE WHEN (julianday(@today) - julianday(fecha_vencimiento)) > 120 AND (julianday(@today) - julianday(fecha_vencimiento)) <= 150 THEN total ELSE 0 END), 0) AS d150,
        COALESCE(SUM(CASE WHEN (julianday(@today) - julianday(fecha_vencimiento)) > 150 AND (julianday(@today) - julianday(fecha_vencimiento)) <= 180 THEN total ELSE 0 END), 0) AS d180,
        COALESCE(SUM(CASE WHEN (julianday(@today) - julianday(fecha_vencimiento)) > 180 AND (julianday(@today) - julianday(fecha_vencimiento)) <= 210 THEN total ELSE 0 END), 0) AS d210,
        COALESCE(SUM(CASE WHEN (julianday(@today) - julianday(fecha_vencimiento)) > 210 AND (julianday(@today) - julianday(fecha_vencimiento)) <= 240 THEN total ELSE 0 END), 0) AS d240,
        COALESCE(SUM(CASE WHEN (julianday(@today) - julianday(fecha_vencimiento)) > 240 AND (julianday(@today) - julianday(fecha_vencimiento)) <= 270 THEN total ELSE 0 END), 0) AS d270,
        COALESCE(SUM(CASE WHEN (julianday(@today) - julianday(fecha_vencimiento)) > 270 AND (julianday(@today) - julianday(fecha_vencimiento)) <= 300 THEN total ELSE 0 END), 0) AS d300,
        COALESCE(SUM(CASE WHEN (julianday(@today) - julianday(fecha_vencimiento)) > 300 AND (julianday(@today) - julianday(fecha_vencimiento)) <= 330 THEN total ELSE 0 END), 0) AS d330,
        COALESCE(SUM(CASE WHEN (julianday(@today) - julianday(fecha_vencimiento)) > 330 AND (julianday(@today) - julianday(fecha_vencimiento)) <= 360 THEN total ELSE 0 END), 0) AS d360,
        COALESCE(SUM(CASE WHEN (julianday(@today) - julianday(fecha_vencimiento)) > 360 THEN total ELSE 0 END), 0) AS d360p
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
      d150: Number(aging.d150 || 0),
      d180: Number(aging.d180 || 0),
      d210: Number(aging.d210 || 0),
      d240: Number(aging.d240 || 0),
      d270: Number(aging.d270 || 0),
      d300: Number(aging.d300 || 0),
      d330: Number(aging.d330 || 0),
      d360: Number(aging.d360 || 0),
      d360p: Number(aging.d360p || 0),
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

function clientesListar() {
  try {
    // Obtener todos los clientes de la tabla clientes con su información
    const clientes = db.prepare(`
      SELECT 
        c.id,
        c.cliente,
        c.razon_social,
        c.vendedor,
        c.telefono,
        c.email,
        c.direccion,
        c.contacto,
        COALESCE(SUM(d.total), 0) as total_deuda,
        COALESCE(SUM(CASE WHEN date(d.fecha_vencimiento) < date('now', 'localtime') AND d.total > 0 THEN d.total ELSE 0 END), 0) as deuda_vencida,
        COUNT(d.id) as total_documentos,
        MAX(CASE WHEN date(d.fecha_vencimiento) < date('now', 'localtime') THEN CAST(julianday(date('now', 'localtime')) - julianday(d.fecha_vencimiento) AS INTEGER) ELSE 0 END) as max_dias_vencidos
      FROM clientes c
      LEFT JOIN documentos d ON c.cliente = d.cliente AND d.is_subtotal = 0
      GROUP BY c.id, c.cliente, c.razon_social, c.vendedor, c.telefono, c.email, c.direccion, c.contacto
      ORDER BY c.razon_social ASC
    `).all();
    
    return { ok: true, rows: clientes };
  } catch (e: any) {
    console.error("Error en clientesListar:", e);
    return { ok: false, message: e.message, rows: [] as unknown[] };
  }
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
    } catch (err) {
      console.warn("No se pudo guardar la estructura de encabezados en DB:", err);
    }
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

  // MIGRACIÓN AUTOMÁTICA: Asegurar que existe la columna 'tema'
  try {
    const cols = db.prepare("PRAGMA table_info(empresa)").all();
    if (!cols.find((c: any) => c.name === 'tema')) {
      db.prepare("ALTER TABLE empresa ADD COLUMN tema TEXT DEFAULT 'claro'").run();
    }
  } catch (e) { console.error("Error verificando columna tema:", e); }

  // INICIAR SERVIDOR WEB
  startWebServer();

  // Cargar icono personalizado si existe
  const customIconPath = join(app.getPath('userData'), 'custom-logo.png');
  if (fs.existsSync(customIconPath)) {
    // Se aplicará cuando se cree la ventana
  }

  await createWindow();

  // ngrok deshabilitado (requiere cuenta verificada con authtoken)
  // Para acceso remoto, usa la IP local mostrada en la consola
  console.log("ℹ️  ngrok deshabilitado. Usa la IP local para acceso remoto en tu red WiFi.");

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  closeDb();
  if (process.platform !== "darwin") {
    // Limpiar procesos antes de cerrar
    cleanupProcesses();
    app.quit();
  }
});

// Manejador para antes de cerrar la aplicación (en Windows)
app.on("before-quit", () => {
  cleanupProcesses();
});

// Función para limpiar todos los procesos secundarios
function cleanupProcesses() {
  try {
    // Cerrar ngrok listener
    if (ngrokListener) {
      ngrokListener.close?.();
      ngrokListener = null;
    }
    
    // Cerrar proceso de cloudflare si existe
    if (cloudflaredProcess) {
      try {
        cloudflaredProcess.kill();
      } catch (e) {
        // Ignorar si no puede matar el proceso
      }
      cloudflaredProcess = null;
    }
    
    console.log("✅ Procesos limpios");
  } catch (e) {
    console.error("Error al limpiar procesos:", e);
  }
}

// -----------------------------
// IPC
// -----------------------------
ipcMain.handle("ping", async () => ({ ok: true }));
ipcMain.handle("getDbPath", async () => getDbFilePath());

// Obtener el token de la aplicación desktop
ipcMain.handle("getDesktopToken", async () => DESKTOP_TOKEN);

// Verificar si tiene permisos de escritura (siempre true en desktop)
ipcMain.handle("hasWritePermissions", async () => true);

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
  // Obtenemos datos actuales para asegurar que no falten campos al hacer merge
  const current = db.prepare("SELECT * FROM empresa WHERE id = 1").get();
  const finalData = { ...current, ...data };

  const stmt = db.prepare(`
    UPDATE empresa 
    SET nombre = @nombre, direccion = @direccion, telefono = @telefono, 
        email = @email, ruc = @ruc, administrador = @administrador, 
        iva_percent = @iva_percent,
        tema = @tema
    WHERE id = 1
  `);
  stmt.run(finalData);
  return { ok: true };
});

ipcMain.handle("exportarBackup", async () => {
  try {
    const dbPath = getDbFilePath();
    const { filePath } = await dialog.showSaveDialog({
      title: "Guardar Respaldo de Base de Datos",
      defaultPath: `cartera-backup-${new Date().toISOString().split('T')[0]}.db`,
      filters: [{ name: "SQLite Database", extensions: ["db"] }]
    });

    if (filePath) {
      fs.copyFileSync(dbPath, filePath);
      return { ok: true, path: filePath };
    }
    return { ok: false, message: "Cancelado por el usuario" };
  } catch (e: any) {
    return { ok: false, message: e.message };
  }
});

ipcMain.handle("cambiarLogo", async () => {
  if (!mainWindow) return { ok: false, message: "Ventana no disponible" };
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: "Seleccionar Logotipo de Empresa",
      properties: ['openFile'],
      filters: [{ name: 'Imágenes', extensions: ['png', 'ico', 'jpg', 'jpeg'] }]
    });

    if (canceled || filePaths.length === 0) return { ok: false, message: "Cancelado" };

    const sourcePath = filePaths[0];
    const destPath = join(app.getPath('userData'), 'custom-logo.png');
    fs.copyFileSync(sourcePath, destPath);
    mainWindow.setIcon(destPath);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: e.message };
  }
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

ipcMain.handle("abonosListar", async () => {
  const data = db.prepare(`
    SELECT id, documento, total_anterior, total_nuevo, fecha, observacion
    FROM abonos
    ORDER BY fecha DESC
    LIMIT 50
  `).all();
  return data;
});

ipcMain.handle("clientesListar", async () => {
  return clientesListar();
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

ipcMain.handle("getGitRemoteUrl", async () => {
  // Retornar URL del servidor web local para compartir
  const networkIp = getNetworkIp();
  const port = 3000; // Puerto del servidor web
  return { ok: true, url: `http://${networkIp}:${port}` };
});

// Handler para obtener la URL remota de Cloudflare
ipcMain.handle("getCloudflareUrl", async () => {
  return { ok: true, url: CLOUDFLARE_TUNNEL_URL };
});

// Handler para verificar el estado del túnel de Cloudflare
ipcMain.handle("checkCloudflaredStatus", async () => {
  try {
    const isHealthy = await checkCloudflaredTunnel();
    return { ok: true, status: isHealthy ? "connected" : "disconnected" };
  } catch (error) {
    return { ok: false, status: "error" };
  }
});

// Handler para reiniciar manualmente el túnel (si falla)
ipcMain.handle("restartCloudflared", async () => {
  try {
    const success = await restartCloudflaredTunnel();
    return { ok: success, message: success ? "Túnel reiniciado" : "Error reiniciando túnel" };
  } catch (error: any) {
    return { ok: false, message: error.message };
  }
});

// Handler para obtener la URL remota de ngrok (dinámica)
ipcMain.handle("getRemoteUrl", async () => {
  if (!ngrokUrl) {
    ngrokUrl = await startNgrok();
  }
  return { ok: !!ngrokUrl, url: ngrokUrl };
});

// Handler para verificar y actualizar ngrok si es necesario
ipcMain.handle("checkRemoteUrl", async () => {
  const url = await checkAndRefreshNgrok();
  return { ok: !!url, url };
});
