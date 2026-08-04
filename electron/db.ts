import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import Database from "better-sqlite3";
import {
  assertDatabaseIntegrity,
  initializeDataSafety,
  restoreDatabaseFile,
} from "./databaseSafety";

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function tableHasColumn(db: Database.Database, table: string, col: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((r) => String(r.name).toLowerCase() === col.toLowerCase());
}

function ensureSchema(db: Database.Database) {
      // Tabla de campaÃ±as de cobranza
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


  // LIMPIEZA: Eliminar columnas de aging estÃ¡tico si existen (ahora se calculan dinÃ¡micamente)
  const agingCols = ["por_vencer", "dias_30", "dias_60", "dias_90", "dias_120", "dias_mas_120"];
  for (const col of agingCols) {
    if (tableHasColumn(db, "documentos", col)) {
      try {
        db.exec(`ALTER TABLE documentos DROP COLUMN ${col}`);
      } catch {
        // Ignorar si la versiÃ³n de SQLite no soporta DROP COLUMN o si falla
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
      Nota: en el Excel existen filas "subtotal" por cliente donde "Tipo Documento" viene vacÃ­o.
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
      motivo TEXT, -- Error facturaciÃ³n, Producto defectuoso, Servicio no prestado, etc.
      fecha_creacion TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      estado TEXT DEFAULT 'Abierta', -- Abierta, En revisiÃ³n, Resuelta, Rechazada
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
      tipo TEXT, -- Adelanto, Abono sin factura, Nota crÃ©dito, DevoluciÃ³n
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

  // MigraciÃ³n suave: agregar columnas de auditorÃ­a si faltan
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

  // MigraciÃ³n: Agregar columna administrador si no existe
  if (!tableHasColumn(db, "empresa", "administrador")) {
    try {
      db.exec("ALTER TABLE empresa ADD COLUMN administrador TEXT DEFAULT ''");
    } catch (e) { console.warn("Error al agregar columna administrador a empresa:", e); }
  }

  // MigraciÃ³n: Agregar columna iva_percent si no existe
  if (!tableHasColumn(db, "empresa", "iva_percent")) {
    try {
      db.exec("ALTER TABLE empresa ADD COLUMN iva_percent REAL DEFAULT 15.0");
    } catch (e) { console.warn("Error al agregar columna iva_percent a empresa:", e); }
  }

  // MigraciÃ³n: Agregar columna meta_mensual si no existe
  if (!tableHasColumn(db, "empresa", "meta_mensual")) {
    try {
      db.exec("ALTER TABLE empresa ADD COLUMN meta_mensual REAL DEFAULT 100000");
    } catch (e) { console.warn("Error al agregar columna meta_mensual a empresa:", e); }
  }

  // MigraciÃ³n: Agregar columna excel_headers_json para guardar estructura esperada
  if (!tableHasColumn(db, "empresa", "excel_headers_json")) {
    try {
      db.exec("ALTER TABLE empresa ADD COLUMN excel_headers_json TEXT DEFAULT ''");
    } catch (e) { console.warn("Error al agregar columna excel_headers_json a empresa:", e); }
  }

  // MigraciÃ³n: Agregar columnas a clientes si no existen
  const clientCols = ["telefono", "email", "direccion", "contacto"];
  for (const c of clientCols) {
    if (!tableHasColumn(db, "clientes", c)) {
      try { db.exec(`ALTER TABLE clientes ADD COLUMN ${c} TEXT DEFAULT ''`); } catch (e) { console.warn(`Error al agregar columna ${c} a clientes:`, e); }
    }
  }

  // MigraciÃ³n: Agregar columna logo si no existe
  if (!tableHasColumn(db, "empresa", "logo")) {
    try {
      db.exec("ALTER TABLE empresa ADD COLUMN logo TEXT");
    } catch (e) { console.warn("Error al agregar columna logo a empresa:", e); }
  }


  const creditClientCols = [
    { name: "tipo_credito", type: "TEXT NOT NULL DEFAULT 'PENDIENTE'" },
    { name: "dias_credito", type: "INTEGER" },
    { name: "credito_configurado", type: "INTEGER NOT NULL DEFAULT 0" },
    { name: "credito_actualizado_en", type: "TEXT" }
  ];
  for (const col of creditClientCols) {
    if (!tableHasColumn(db, "clientes", col.name)) {
      try { db.exec(`ALTER TABLE clientes ADD COLUMN ${col.name} ${col.type}`); }
      catch (e) { console.warn(`Error al agregar columna ${col.name} a clientes:`, e); }
    }
  }
  const creditDocumentCols = [
    { name: "dias_credito_aplicados", type: "INTEGER" },
    { name: "credito_fuente", type: "TEXT NOT NULL DEFAULT 'CONTIFICO'" },
    { name: "credito_pendiente", type: "INTEGER NOT NULL DEFAULT 0" }
  ];
  for (const col of creditDocumentCols) {
    if (!tableHasColumn(db, "documentos", col.name)) {
      try { db.exec(`ALTER TABLE documentos ADD COLUMN ${col.name} ${col.type}`); }
      catch (e) { console.warn(`Error al agregar columna ${col.name} a documentos:`, e); }
    }
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS alertas_credito (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente TEXT NOT NULL UNIQUE,
      motivo TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'PENDIENTE',
      detectado_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      resuelto_en TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_alertas_credito_estado ON alertas_credito(estado);
  `);


  // Clasificar documentos historicos de credito.
  db.exec(`
    UPDATE documentos
    SET credito_fuente = 'PENDIENTE_CONFIGURACION',
        credito_pendiente = 1,
        dias_credito_aplicados = NULL
    WHERE is_subtotal = 0
      AND TRIM(COALESCE(cliente, '')) <> ''
      AND (
        TRIM(COALESCE(fecha_emision, '')) = ''
        OR TRIM(COALESCE(fecha_vencimiento, '')) = ''
        OR date(fecha_vencimiento) <= date(fecha_emision)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM clientes c
        WHERE c.cliente = documentos.cliente
          AND c.credito_configurado = 1
          AND c.dias_credito IS NOT NULL
      );

    INSERT INTO alertas_credito (
      cliente, motivo, estado, detectado_en, resuelto_en
    )
    SELECT DISTINCT
      d.cliente,
      'Cliente sin dias de credito configurados y vencimiento importado no valido',
      'PENDIENTE',
      datetime('now', 'localtime'),
      NULL
    FROM documentos d
    WHERE d.credito_pendiente = 1
      AND TRIM(COALESCE(d.cliente, '')) <> ''
    ON CONFLICT(cliente) DO UPDATE SET
      motivo = excluded.motivo,
      estado = 'PENDIENTE',
      detectado_en = excluded.detectado_en,
      resuelto_en = NULL;
  `);


  // Migración de documentos anulados.
  const ensureCancelledColumn = (
    tableName: string,
    columnName: string,
    definition: string,
  ): void => {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === columnName)) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
  };

  ensureCancelledColumn("documentos", "estado_documento", "TEXT DEFAULT 'ACTIVO'");
  ensureCancelledColumn("documentos", "anulado", "INTEGER DEFAULT 0");
  ensureCancelledColumn("documentos", "fecha_anulacion", "TEXT");
  ensureCancelledColumn("documentos", "motivo_anulacion", "TEXT");
  ensureCancelledColumn("documentos", "fuente_anulacion", "TEXT");

  ensureCancelledColumn("abonos", "estado", "TEXT DEFAULT 'ACTIVO'");
  ensureCancelledColumn("abonos", "reversado", "INTEGER DEFAULT 0");
  ensureCancelledColumn("abonos", "motivo_reversion", "TEXT");
  ensureCancelledColumn("abonos", "reversado_en", "TEXT");
  ensureCancelledColumn("abonos", "documento_normalizado", "TEXT");

  db.exec(`
    UPDATE abonos
    SET documento_normalizado = CASE
      WHEN TRIM(COALESCE(documento, '')) = '' THEN ''
      ELSE LTRIM(REPLACE(REPLACE(REPLACE(REPLACE(UPPER(documento), '-', ''), ' ', ''), '.', ''), '/', ''), '0')
    END
    WHERE TRIM(COALESCE(documento_normalizado, '')) = '';

    CREATE TABLE IF NOT EXISTS documentos_anulados_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      documento TEXT NOT NULL,
      documento_normalizado TEXT NOT NULL,
      cliente TEXT,
      fecha_anulacion TEXT,
      motivo TEXT,
      archivo_origen TEXT NOT NULL,
      detectado_en TEXT NOT NULL,
      documento_id INTEGER,
      resultado TEXT NOT NULL,
      UNIQUE(documento_normalizado, archivo_origen)
    );

    CREATE INDEX IF NOT EXISTS idx_documentos_anulados_log_documento
      ON documentos_anulados_log(documento_normalizado);

    CREATE INDEX IF NOT EXISTS idx_documentos_estado_documento
      ON documentos(estado_documento);

    CREATE INDEX IF NOT EXISTS idx_abonos_documento_normalizado
      ON abonos(documento_normalizado);

    CREATE INDEX IF NOT EXISTS idx_abonos_estado
      ON abonos(estado, reversado);
  `);

  ensureCancelledColumn(
    "documentos_anulados_log",
    "tipo_documento",
    "TEXT"
  );
  ensureCancelledColumn(
    "documentos_anulados_log",
    "estado_origen",
    "TEXT"
  );
  ensureCancelledColumn(
    "documentos_anulados_log",
    "numero_autorizacion",
    "TEXT"
  );


  // Conciliación histórica de cobros duplicados y movimientos no positivos.
  db.exec(`
    UPDATE abonos
    SET estado = 'REVERSADO',
        reversado = 1,
        motivo_reversion = 'DUPLICADO_POR_DESAPARICION',
        reversado_en = datetime('now', 'localtime')
    WHERE COALESCE(reversado, 0) = 0
      AND observacion = 'Abono detectado por documento no presente en importacion'
      AND EXISTS (
        SELECT 1
        FROM abonos total
        WHERE COALESCE(total.reversado, 0) = 0
          AND total.observacion = 'Cobro Total: Documento ya no aparece en cartera (Cancelado)'
          AND total.documento_normalizado = abonos.documento_normalizado
      );

    UPDATE abonos
    SET estado = 'REVERSADO',
        reversado = 1,
        motivo_reversion = 'MOVIMIENTO_NO_POSITIVO',
        reversado_en = datetime('now', 'localtime')
    WHERE COALESCE(reversado, 0) = 0
      AND (COALESCE(total_anterior, 0) - COALESCE(total_nuevo, 0)) <= 0;
  `);

  // Insertar registro de empresa por defecto si no existe
  db.exec("INSERT OR IGNORE INTO empresa (id, nombre) VALUES (1, 'Mi Empresa')");
}

export function openDb() {
  const userData = app.getPath("userData");
  const dataDir = path.join(userData, "data");
  ensureDir(dataDir);

  const dbPath = path.join(dataDir, "cartera.db");
  const db = new Database(dbPath);

  // ConfiguraciÃ³n de SQLite para permitir mÃºltiples lectores
  db.pragma("journal_mode = WAL");  // Write-Ahead Logging
  db.pragma("synchronous = NORMAL"); // Balance entre velocidad y seguridad
  db.pragma("cache_size = -64000");  // 64MB cache
  db.pragma("foreign_keys = ON");    // Integridad referencial
  db.pragma("temp_store = MEMORY");  // Tablas temp en memoria

  const safety = initializeDataSafety(db, dbPath, app.getVersion());

  try {
    ensureSchema(db);
    assertDatabaseIntegrity(db);
  } catch (error) {
    db.close();
    if (safety.backupPath) {
      restoreDatabaseFile(dbPath, safety.backupPath);
      console.error(`Base restaurada desde: ${safety.backupPath}`);
    }
    throw error;
  }

  if (safety.backupPath) {
    console.log(`Respaldo previo a actualizacion: ${safety.backupPath}`);
  }

  return { db, dbPath };
}

/**
 * Devuelve la ruta absoluta del archivo SQLite sin necesidad de abrir la conexiÃ³n.
 * Ãštil para mostrar la "Ruta DB" en el renderer.
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

