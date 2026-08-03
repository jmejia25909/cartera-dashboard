import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import Database from "better-sqlite3";

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function tableHasColumn(db: Database.Database, table: string, col: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((r) => String(r.name).toLowerCase() === col.toLowerCase());
}

function ensureSchema(db: Database.Database) {
      // Tabla de campañas de cobranza
      db.exec(`
        CREATE TABLE IF NOT EXISTS campanas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          descripcion TEXT,
          fecha_inicio TEXT,
          fecha_fin TEXT,
          responsable TEXT,
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS campana_clientes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          campana_id INTEGER NOT NULL,
          cliente TEXT NOT NULL,
          asignado_en TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (campana_id) REFERENCES campanas(id),
          FOREIGN KEY (cliente) REFERENCES clientes(cliente)
        );
        CREATE INDEX IF NOT EXISTS idx_campana_clientes_campana ON campana_clientes(campana_id);
        CREATE INDEX IF NOT EXISTS idx_campana_clientes_cliente ON campana_clientes(cliente);
      `);
    // Nueva tabla para historial de abonos y cambios de estado
    db.exec(`
      CREATE TABLE IF NOT EXISTS abonos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        documento TEXT NOT NULL,
        total_anterior REAL NOT NULL,
        total_nuevo REAL NOT NULL,
        fecha TEXT NOT NULL DEFAULT (datetime('now')),
        observacion TEXT DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS idx_abonos_documento ON abonos(documento);
    `);
  // Migración: Si detectamos la columna antigua 'fecha', borramos la tabla para recrearla
  // con el nuevo esquema (fecha_emision, fecha_vencimiento).
  if (tableHasColumn(db, "documentos", "fecha")) {
    db.exec("DROP TABLE IF EXISTS documentos");
  }

  // Migración: Si la tabla clientes existe pero no tiene la columna 'cliente' (versión corrupta), recrearla.
  // Esto soluciona el error "no such column: c.cliente"
  if (tableHasColumn(db, "clientes", "id") && !tableHasColumn(db, "clientes", "cliente")) {
    db.exec("DROP TABLE IF EXISTS clientes");
  }

  // LIMPIEZA: Eliminar columnas de aging estático si existen (ahora se calculan dinámicamente)
  const agingCols = ["por_vencer", "dias_30", "dias_60", "dias_90", "dias_120", "dias_mas_120"];
  for (const col of agingCols) {
    if (tableHasColumn(db, "documentos", col)) {
      try {
        db.exec(`ALTER TABLE documentos DROP COLUMN ${col}`);
      } catch {
        // Ignorar si la versión de SQLite no soporta DROP COLUMN o si falla
      }
    }
  }

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente TEXT NOT NULL UNIQUE,
      razon_social TEXT,
      vendedor TEXT, 
      telefono TEXT DEFAULT '',
      email TEXT DEFAULT '',
      direccion TEXT DEFAULT '',
      contacto TEXT DEFAULT '',
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );

    /*
      Tabla principal: cartera importada desde Contifico (CarteraPorCobrar).
      Nota: en el Excel existen filas "subtotal" por cliente donde "Tipo Documento" viene vacío.
      Esas filas se guardan con is_subtotal=1 para poder usarlas (opcionalmente) en reportes,
      pero la vista de "Documentos" debe filtrar is_subtotal=0.
    */
    CREATE TABLE IF NOT EXISTS documentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente TEXT,
      razon_social TEXT,
      tipo_documento TEXT,
      documento TEXT,
      fecha_emision TEXT,
      fecha_vencimiento TEXT,
      vendedor TEXT,
      total REAL DEFAULT 0,
      descripcion TEXT,
      valor_documento REAL DEFAULT 0,
      retenciones REAL DEFAULT 0,
      iva REAL DEFAULT 0,
      cobros REAL DEFAULT 0,
      is_subtotal INTEGER NOT NULL DEFAULT 0,
      importado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_doc_cliente ON documentos(cliente);
    CREATE INDEX IF NOT EXISTS idx_doc_venc ON documentos(fecha_vencimiento);
    CREATE INDEX IF NOT EXISTS idx_doc_total ON documentos(total);

    CREATE TABLE IF NOT EXISTS empresa (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      nombre TEXT DEFAULT 'Mi Empresa',
      direccion TEXT DEFAULT '',
      telefono TEXT DEFAULT '',
      email TEXT DEFAULT '',
      ruc TEXT DEFAULT '',
      administrador TEXT DEFAULT '',
      iva_percent REAL DEFAULT 15.0,
      meta_mensual REAL DEFAULT 100000,
      logo TEXT
    );

    /* Tabla de Gestiones (CRM) */
    CREATE TABLE IF NOT EXISTS gestiones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente TEXT NOT NULL,
      fecha TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      tipo TEXT, -- Llamada, Visita, WhatsApp, Email
      resultado TEXT, -- Contactado, No contesta, Promesa, etc.
      observacion TEXT,
      fecha_promesa TEXT,
      monto_promesa REAL DEFAULT 0,
      usuario TEXT DEFAULT 'sistema',
      creado_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      actualizado_en TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_gestiones_cliente ON gestiones(cliente);

    /* Tabla de Disputas */
    CREATE TABLE IF NOT EXISTS disputas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      documento TEXT NOT NULL,
      cliente TEXT NOT NULL,
      monto REAL DEFAULT 0,
      motivo TEXT, -- Error facturación, Producto defectuoso, Servicio no prestado, etc.
      fecha_creacion TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      estado TEXT DEFAULT 'Abierta', -- Abierta, En revisión, Resuelta, Rechazada
      fecha_resolucion TEXT,
      observacion TEXT,
      usuario_creador TEXT DEFAULT 'sistema'
    );

    CREATE INDEX IF NOT EXISTS idx_disputas_cliente ON disputas(cliente);
    CREATE INDEX IF NOT EXISTS idx_disputas_estado ON disputas(estado);

    /* Tabla de Cuentas por Aplicar */
    CREATE TABLE IF NOT EXISTS cuentas_aplicar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      documento TEXT,
      cliente TEXT NOT NULL,
      monto REAL DEFAULT 0,
      tipo TEXT, -- Adelanto, Abono sin factura, Nota crédito, Devolución
      fecha_recepcion TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      estado TEXT DEFAULT 'Pendiente', -- Pendiente, Aplicada, Rechazada
      fecha_aplicacion TEXT,
      documento_aplicado TEXT,
      observacion TEXT,
      usuario_creador TEXT DEFAULT 'sistema'
    );

    CREATE INDEX IF NOT EXISTS idx_cuentas_cliente ON cuentas_aplicar(cliente);
    CREATE INDEX IF NOT EXISTS idx_cuentas_estado ON cuentas_aplicar(estado);
  `);

  // Migración suave: agregar columnas de auditoría si faltan
  const gestionCols = [
    { name: "usuario", type: "TEXT DEFAULT 'sistema'" },
    { name: "creado_en", type: "TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))" },
    { name: "actualizado_en", type: "TEXT" },
    { name: "motivo", type: "TEXT" }
  ];
  for (const col of gestionCols) {
    if (!tableHasColumn(db, "gestiones", col.name)) {
      try { db.exec(`ALTER TABLE gestiones ADD COLUMN ${col.name} ${col.type}`); } catch (e) { console.warn(`Error al agregar columna ${col.name} a gestiones:`, e); }
    }
  }

  // Migraciones suaves: si la tabla existe (por DB previa) y faltan columnas nuevas, se agregan.
  const alters: string[] = [];
  const docCols = [
    "cliente",
    "razon_social",
    "tipo_documento",
    "documento",
    "fecha_emision",
    "fecha_vencimiento",
    "vendedor",
    "total",
    "descripcion",
    "valor_documento",
    "retenciones",
    "iva",
    "cobros",
    "is_subtotal",
    "importado_en",
  ];

  for (const c of docCols) {
    if (!tableHasColumn(db, "documentos", c)) {
      // Tipos por defecto
      let sqlType = "TEXT";
      if (["total", "valor_documento", "retenciones", "cobros", "iva"].includes(c)) {
        sqlType = "REAL DEFAULT 0";
      }
      if (c === "is_subtotal") sqlType = "INTEGER NOT NULL DEFAULT 0";
      if (c === "importado_en") sqlType = "TEXT NOT NULL DEFAULT (datetime('now'))";
      alters.push(`ALTER TABLE documentos ADD COLUMN ${c} ${sqlType}`);
    }
  }

  for (const sql of alters) {
    try {
      db.exec(sql);
    } catch (e) {
      console.warn(`Error al ejecutar alter: ${sql}`, e);
    }
  }

  // Migración: Agregar columna administrador si no existe
  if (!tableHasColumn(db, "empresa", "administrador")) {
    try {
      db.exec("ALTER TABLE empresa ADD COLUMN administrador TEXT DEFAULT ''");
    } catch (e) { console.warn("Error al agregar columna administrador a empresa:", e); }
  }

  // Migración: Agregar columna iva_percent si no existe
  if (!tableHasColumn(db, "empresa", "iva_percent")) {
    try {
      db.exec("ALTER TABLE empresa ADD COLUMN iva_percent REAL DEFAULT 15.0");
    } catch (e) { console.warn("Error al agregar columna iva_percent a empresa:", e); }
  }

  // Migración: Agregar columna meta_mensual si no existe
  if (!tableHasColumn(db, "empresa", "meta_mensual")) {
    try {
      db.exec("ALTER TABLE empresa ADD COLUMN meta_mensual REAL DEFAULT 100000");
    } catch (e) { console.warn("Error al agregar columna meta_mensual a empresa:", e); }
  }

  // Migración: Agregar columna excel_headers_json para guardar estructura esperada
  if (!tableHasColumn(db, "empresa", "excel_headers_json")) {
    try {
      db.exec("ALTER TABLE empresa ADD COLUMN excel_headers_json TEXT DEFAULT ''");
    } catch (e) { console.warn("Error al agregar columna excel_headers_json a empresa:", e); }
  }

  // Migración: Agregar columnas a clientes si no existen
  const clientCols = ["telefono", "email", "direccion", "contacto"];
  for (const c of clientCols) {
    if (!tableHasColumn(db, "clientes", c)) {
      try { db.exec(`ALTER TABLE clientes ADD COLUMN ${c} TEXT DEFAULT ''`); } catch (e) { console.warn(`Error al agregar columna ${c} a clientes:`, e); }
    }
  }

  // Migración: Agregar columna logo si no existe
  if (!tableHasColumn(db, "empresa", "logo")) {
    try {
      db.exec("ALTER TABLE empresa ADD COLUMN logo TEXT");
    } catch (e) { console.warn("Error al agregar columna logo a empresa:", e); }
  }

  // Insertar registro de empresa por defecto si no existe
  db.exec("INSERT OR IGNORE INTO empresa (id, nombre) VALUES (1, 'Mi Empresa')");
}

export function openDb() {
  const userData = app.getPath("userData");
  const dataDir = path.join(userData, "data");
  ensureDir(dataDir);

  const dbPath = path.join(dataDir, "cartera.db");
  const db = new Database(dbPath);

  // Configuración de SQLite para permitir múltiples lectores
  db.pragma("journal_mode = WAL");  // Write-Ahead Logging
  db.pragma("synchronous = NORMAL"); // Balance entre velocidad y seguridad
  db.pragma("cache_size = -64000");  // 64MB cache
  db.pragma("foreign_keys = ON");    // Integridad referencial
  db.pragma("temp_store = MEMORY");  // Tablas temp en memoria

  ensureSchema(db);

  return { db, dbPath };
}

/**
 * Devuelve la ruta absoluta del archivo SQLite sin necesidad de abrir la conexión.
 * Útil para mostrar la "Ruta DB" en el renderer.
 */
export function getDbFilePath(): string {
  try {
    const userData = app.getPath("userData");
    return path.join(userData, "data", "cartera.db");
  } catch {
    // Fallback (por ejemplo, si se ejecuta fuera del contexto de Electron)
    return path.join(process.cwd(), "data", "cartera.db");
  }
}
