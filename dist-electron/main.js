import { app as ca, BrowserWindow as Gn, ipcMain as Ne, dialog as Js, shell as Zs } from "electron";
import { fileURLToPath as qs } from "node:url";
import Et, { dirname as Qs, join as ta, extname as ec } from "node:path";
import wa from "node:fs";
import rc from "better-sqlite3";
import ac from "node:http";
import Xn from "node:os";
function tc(e) {
  wa.existsSync(e) || wa.mkdirSync(e, { recursive: !0 });
}
function br(e, a, r) {
  return e.prepare(`PRAGMA table_info(${a})`).all().some((n) => String(n.name).toLowerCase() === r.toLowerCase());
}
function nc(e) {
  e.exec(`
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
      `), e.exec(`
      CREATE TABLE IF NOT EXISTS abonos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        documento TEXT NOT NULL,
        total_anterior REAL NOT NULL,
        total_nuevo REAL NOT NULL,
        fecha TEXT NOT NULL DEFAULT (datetime('now')),
        observacion TEXT DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS idx_abonos_documento ON abonos(documento);
    `), br(e, "documentos", "fecha") && e.exec("DROP TABLE IF EXISTS documentos"), br(e, "clientes", "id") && !br(e, "clientes", "cliente") && e.exec("DROP TABLE IF EXISTS clientes");
  const a = ["por_vencer", "dias_30", "dias_60", "dias_90", "dias_120", "dias_mas_120"];
  for (const s of a)
    if (br(e, "documentos", s))
      try {
        e.exec(`ALTER TABLE documentos DROP COLUMN ${s}`);
      } catch {
      }
  e.exec(`
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
      iva_percent REAL DEFAULT 15.0
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
  `);
  const r = [
    { name: "usuario", type: "TEXT DEFAULT 'sistema'" },
    { name: "creado_en", type: "TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))" },
    { name: "actualizado_en", type: "TEXT" }
  ];
  for (const s of r)
    if (!br(e, "gestiones", s.name))
      try {
        e.exec(`ALTER TABLE gestiones ADD COLUMN ${s.name} ${s.type}`);
      } catch {
      }
  const t = [], n = [
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
    "importado_en"
  ];
  for (const s of n)
    if (!br(e, "documentos", s)) {
      let c = "TEXT";
      ["total", "valor_documento", "retenciones", "cobros", "iva"].includes(s) && (c = "REAL DEFAULT 0"), s === "is_subtotal" && (c = "INTEGER NOT NULL DEFAULT 0"), s === "importado_en" && (c = "TEXT NOT NULL DEFAULT (datetime('now'))"), t.push(`ALTER TABLE documentos ADD COLUMN ${s} ${c}`);
    }
  for (const s of t)
    try {
      e.exec(s);
    } catch {
    }
  if (!br(e, "empresa", "administrador"))
    try {
      e.exec("ALTER TABLE empresa ADD COLUMN administrador TEXT DEFAULT ''");
    } catch {
    }
  if (!br(e, "empresa", "iva_percent"))
    try {
      e.exec("ALTER TABLE empresa ADD COLUMN iva_percent REAL DEFAULT 15.0");
    } catch {
    }
  const i = ["telefono", "email", "direccion", "contacto"];
  for (const s of i)
    if (!br(e, "clientes", s))
      try {
        e.exec(`ALTER TABLE clientes ADD COLUMN ${s} TEXT DEFAULT ''`);
      } catch {
      }
  e.exec("INSERT OR IGNORE INTO empresa (id, nombre) VALUES (1, 'Mi Empresa')");
}
function zn() {
  const e = ca.getPath("userData"), a = Et.join(e, "data");
  tc(a);
  const r = Et.join(a, "cartera.db"), t = new rc(r);
  return nc(t), { db: t, dbPath: r };
}
function ic() {
  try {
    const e = ca.getPath("userData");
    return Et.join(e, "data", "cartera.db");
  } catch {
    return Et.join(process.cwd(), "data", "cartera.db");
  }
}
/*! xlsx.js (C) 2013-present SheetJS -- http://sheetjs.com */
var $n = 1252, sc = [874, 932, 936, 949, 950, 1250, 1251, 1252, 1253, 1254, 1255, 1256, 1257, 1258, 1e4], s0 = {
  /*::[*/
  0: 1252,
  /* ANSI */
  /*::[*/
  1: 65001,
  /* DEFAULT */
  /*::[*/
  2: 65001,
  /* SYMBOL */
  /*::[*/
  77: 1e4,
  /* MAC */
  /*::[*/
  128: 932,
  /* SHIFTJIS */
  /*::[*/
  129: 949,
  /* HANGUL */
  /*::[*/
  130: 1361,
  /* JOHAB */
  /*::[*/
  134: 936,
  /* GB2312 */
  /*::[*/
  136: 950,
  /* CHINESEBIG5 */
  /*::[*/
  161: 1253,
  /* GREEK */
  /*::[*/
  162: 1254,
  /* TURKISH */
  /*::[*/
  163: 1258,
  /* VIETNAMESE */
  /*::[*/
  177: 1255,
  /* HEBREW */
  /*::[*/
  178: 1256,
  /* ARABIC */
  /*::[*/
  186: 1257,
  /* BALTIC */
  /*::[*/
  204: 1251,
  /* RUSSIAN */
  /*::[*/
  222: 874,
  /* THAI */
  /*::[*/
  238: 1250,
  /* EASTEUROPE */
  /*::[*/
  255: 1252,
  /* OEM */
  /*::[*/
  69: 6969
  /* MISC */
}, c0 = function(e) {
  sc.indexOf(e) != -1 && ($n = s0[0] = e);
};
function cc() {
  c0(1252);
}
var Ar = function(e) {
  c0(e);
};
function Yn() {
  Ar(1200), cc();
}
function b0(e) {
  for (var a = [], r = 0, t = e.length; r < t; ++r) a[r] = e.charCodeAt(r);
  return a;
}
function fc(e) {
  for (var a = [], r = 0; r < e.length >> 1; ++r) a[r] = String.fromCharCode(e.charCodeAt(2 * r) + (e.charCodeAt(2 * r + 1) << 8));
  return a.join("");
}
function Kn(e) {
  for (var a = [], r = 0; r < e.length >> 1; ++r) a[r] = String.fromCharCode(e.charCodeAt(2 * r + 1) + (e.charCodeAt(2 * r) << 8));
  return a.join("");
}
var La = function(e) {
  var a = e.charCodeAt(0), r = e.charCodeAt(1);
  return a == 255 && r == 254 ? fc(e.slice(2)) : a == 254 && r == 255 ? Kn(e.slice(2)) : a == 65279 ? e.slice(1) : e;
}, ot = function(a) {
  return String.fromCharCode(a);
}, B0 = function(a) {
  return String.fromCharCode(a);
}, Ya, Kr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
function U0(e) {
  for (var a = "", r = 0, t = 0, n = 0, i = 0, s = 0, c = 0, f = 0, o = 0; o < e.length; )
    r = e.charCodeAt(o++), i = r >> 2, t = e.charCodeAt(o++), s = (r & 3) << 4 | t >> 4, n = e.charCodeAt(o++), c = (t & 15) << 2 | n >> 6, f = n & 63, isNaN(t) ? c = f = 64 : isNaN(n) && (f = 64), a += Kr.charAt(i) + Kr.charAt(s) + Kr.charAt(c) + Kr.charAt(f);
  return a;
}
function xr(e) {
  var a = "", r = 0, t = 0, n = 0, i = 0, s = 0, c = 0, f = 0;
  e = e.replace(/[^\w\+\/\=]/g, "");
  for (var o = 0; o < e.length; )
    i = Kr.indexOf(e.charAt(o++)), s = Kr.indexOf(e.charAt(o++)), r = i << 2 | s >> 4, a += String.fromCharCode(r), c = Kr.indexOf(e.charAt(o++)), t = (s & 15) << 4 | c >> 2, c !== 64 && (a += String.fromCharCode(t)), f = Kr.indexOf(e.charAt(o++)), n = (c & 3) << 6 | f, f !== 64 && (a += String.fromCharCode(n));
  return a;
}
var ge = /* @__PURE__ */ function() {
  return typeof Buffer < "u" && typeof process < "u" && typeof process.versions < "u" && !!process.versions.node;
}(), ua = /* @__PURE__ */ function() {
  if (typeof Buffer < "u") {
    var e = !Buffer.from;
    if (!e) try {
      Buffer.from("foo", "utf8");
    } catch {
      e = !0;
    }
    return e ? function(a, r) {
      return r ? new Buffer(a, r) : new Buffer(a);
    } : Buffer.from.bind(Buffer);
  }
  return function() {
  };
}();
function Zr(e) {
  return ge ? Buffer.alloc ? Buffer.alloc(e) : new Buffer(e) : typeof Uint8Array < "u" ? new Uint8Array(e) : new Array(e);
}
function H0(e) {
  return ge ? Buffer.allocUnsafe ? Buffer.allocUnsafe(e) : new Buffer(e) : typeof Uint8Array < "u" ? new Uint8Array(e) : new Array(e);
}
var wr = function(a) {
  return ge ? ua(a, "binary") : a.split("").map(function(r) {
    return r.charCodeAt(0) & 255;
  });
};
function ha(e) {
  if (Array.isArray(e)) return e.map(function(t) {
    return String.fromCharCode(t);
  }).join("");
  for (var a = [], r = 0; r < e.length; ++r) a[r] = String.fromCharCode(e[r]);
  return a.join("");
}
function f0(e) {
  if (typeof ArrayBuffer > "u") throw new Error("Unsupported");
  if (e instanceof ArrayBuffer) return f0(new Uint8Array(e));
  for (var a = new Array(e.length), r = 0; r < e.length; ++r) a[r] = e[r];
  return a;
}
var Yr = ge ? function(e) {
  return Buffer.concat(e.map(function(a) {
    return Buffer.isBuffer(a) ? a : ua(a);
  }));
} : function(e) {
  if (typeof Uint8Array < "u") {
    var a = 0, r = 0;
    for (a = 0; a < e.length; ++a) r += e[a].length;
    var t = new Uint8Array(r), n = 0;
    for (a = 0, r = 0; a < e.length; r += n, ++a)
      if (n = e[a].length, e[a] instanceof Uint8Array) t.set(e[a], r);
      else {
        if (typeof e[a] == "string")
          throw "wtf";
        t.set(new Uint8Array(e[a]), r);
      }
    return t;
  }
  return [].concat.apply([], e.map(function(i) {
    return Array.isArray(i) ? i : [].slice.call(i);
  }));
};
function oc(e) {
  for (var a = [], r = 0, t = e.length + 250, n = Zr(e.length + 255), i = 0; i < e.length; ++i) {
    var s = e.charCodeAt(i);
    if (s < 128) n[r++] = s;
    else if (s < 2048)
      n[r++] = 192 | s >> 6 & 31, n[r++] = 128 | s & 63;
    else if (s >= 55296 && s < 57344) {
      s = (s & 1023) + 64;
      var c = e.charCodeAt(++i) & 1023;
      n[r++] = 240 | s >> 8 & 7, n[r++] = 128 | s >> 2 & 63, n[r++] = 128 | c >> 6 & 15 | (s & 3) << 4, n[r++] = 128 | c & 63;
    } else
      n[r++] = 224 | s >> 12 & 15, n[r++] = 128 | s >> 6 & 63, n[r++] = 128 | s & 63;
    r > t && (a.push(n.slice(0, r)), r = 0, n = Zr(65535), t = 65530);
  }
  return a.push(n.slice(0, r)), Yr(a);
}
var cr = /\u0000/g, Pa = /[\u0001-\u0006]/g;
function _a(e) {
  for (var a = "", r = e.length - 1; r >= 0; ) a += e.charAt(r--);
  return a;
}
function Fr(e, a) {
  var r = "" + e;
  return r.length >= a ? r : Re("0", a - r.length) + r;
}
function o0(e, a) {
  var r = "" + e;
  return r.length >= a ? r : Re(" ", a - r.length) + r;
}
function _t(e, a) {
  var r = "" + e;
  return r.length >= a ? r : r + Re(" ", a - r.length);
}
function lc(e, a) {
  var r = "" + Math.round(e);
  return r.length >= a ? r : Re("0", a - r.length) + r;
}
function uc(e, a) {
  var r = "" + e;
  return r.length >= a ? r : Re("0", a - r.length) + r;
}
var W0 = /* @__PURE__ */ Math.pow(2, 32);
function ma(e, a) {
  if (e > W0 || e < -W0) return lc(e, a);
  var r = Math.round(e);
  return uc(r, a);
}
function Tt(e, a) {
  return a = a || 0, e.length >= 7 + a && (e.charCodeAt(a) | 32) === 103 && (e.charCodeAt(a + 1) | 32) === 101 && (e.charCodeAt(a + 2) | 32) === 110 && (e.charCodeAt(a + 3) | 32) === 101 && (e.charCodeAt(a + 4) | 32) === 114 && (e.charCodeAt(a + 5) | 32) === 97 && (e.charCodeAt(a + 6) | 32) === 108;
}
var V0 = [
  ["Sun", "Sunday"],
  ["Mon", "Monday"],
  ["Tue", "Tuesday"],
  ["Wed", "Wednesday"],
  ["Thu", "Thursday"],
  ["Fri", "Friday"],
  ["Sat", "Saturday"]
], bt = [
  ["J", "Jan", "January"],
  ["F", "Feb", "February"],
  ["M", "Mar", "March"],
  ["A", "Apr", "April"],
  ["M", "May", "May"],
  ["J", "Jun", "June"],
  ["J", "Jul", "July"],
  ["A", "Aug", "August"],
  ["S", "Sep", "September"],
  ["O", "Oct", "October"],
  ["N", "Nov", "November"],
  ["D", "Dec", "December"]
];
function hc(e) {
  return e || (e = {}), e[0] = "General", e[1] = "0", e[2] = "0.00", e[3] = "#,##0", e[4] = "#,##0.00", e[9] = "0%", e[10] = "0.00%", e[11] = "0.00E+00", e[12] = "# ?/?", e[13] = "# ??/??", e[14] = "m/d/yy", e[15] = "d-mmm-yy", e[16] = "d-mmm", e[17] = "mmm-yy", e[18] = "h:mm AM/PM", e[19] = "h:mm:ss AM/PM", e[20] = "h:mm", e[21] = "h:mm:ss", e[22] = "m/d/yy h:mm", e[37] = "#,##0 ;(#,##0)", e[38] = "#,##0 ;[Red](#,##0)", e[39] = "#,##0.00;(#,##0.00)", e[40] = "#,##0.00;[Red](#,##0.00)", e[45] = "mm:ss", e[46] = "[h]:mm:ss", e[47] = "mmss.0", e[48] = "##0.0E+0", e[49] = "@", e[56] = '"上午/下午 "hh"時"mm"分"ss"秒 "', e;
}
var de = {
  0: "General",
  1: "0",
  2: "0.00",
  3: "#,##0",
  4: "#,##0.00",
  9: "0%",
  10: "0.00%",
  11: "0.00E+00",
  12: "# ?/?",
  13: "# ??/??",
  14: "m/d/yy",
  15: "d-mmm-yy",
  16: "d-mmm",
  17: "mmm-yy",
  18: "h:mm AM/PM",
  19: "h:mm:ss AM/PM",
  20: "h:mm",
  21: "h:mm:ss",
  22: "m/d/yy h:mm",
  37: "#,##0 ;(#,##0)",
  38: "#,##0 ;[Red](#,##0)",
  39: "#,##0.00;(#,##0.00)",
  40: "#,##0.00;[Red](#,##0.00)",
  45: "mm:ss",
  46: "[h]:mm:ss",
  47: "mmss.0",
  48: "##0.0E+0",
  49: "@",
  56: '"上午/下午 "hh"時"mm"分"ss"秒 "'
}, G0 = {
  5: 37,
  6: 38,
  7: 39,
  8: 40,
  //  5 -> 37 ...  8 -> 40
  23: 0,
  24: 0,
  25: 0,
  26: 0,
  // 23 ->  0 ... 26 ->  0
  27: 14,
  28: 14,
  29: 14,
  30: 14,
  31: 14,
  // 27 -> 14 ... 31 -> 14
  50: 14,
  51: 14,
  52: 14,
  53: 14,
  54: 14,
  // 50 -> 14 ... 58 -> 14
  55: 14,
  56: 14,
  57: 14,
  58: 14,
  59: 1,
  60: 2,
  61: 3,
  62: 4,
  // 59 ->  1 ... 62 ->  4
  67: 9,
  68: 10,
  // 67 ->  9 ... 68 -> 10
  69: 12,
  70: 13,
  71: 14,
  // 69 -> 12 ... 71 -> 14
  72: 14,
  73: 15,
  74: 16,
  75: 17,
  // 72 -> 14 ... 75 -> 17
  76: 20,
  77: 21,
  78: 22,
  // 76 -> 20 ... 78 -> 22
  79: 45,
  80: 46,
  81: 47,
  // 79 -> 45 ... 81 -> 47
  82: 0
  // 82 ->  0 ... 65536 -> 0 (omitted)
}, xc = {
  //  5 -- Currency,   0 decimal, black negative
  5: '"$"#,##0_);\\("$"#,##0\\)',
  63: '"$"#,##0_);\\("$"#,##0\\)',
  //  6 -- Currency,   0 decimal, red   negative
  6: '"$"#,##0_);[Red]\\("$"#,##0\\)',
  64: '"$"#,##0_);[Red]\\("$"#,##0\\)',
  //  7 -- Currency,   2 decimal, black negative
  7: '"$"#,##0.00_);\\("$"#,##0.00\\)',
  65: '"$"#,##0.00_);\\("$"#,##0.00\\)',
  //  8 -- Currency,   2 decimal, red   negative
  8: '"$"#,##0.00_);[Red]\\("$"#,##0.00\\)',
  66: '"$"#,##0.00_);[Red]\\("$"#,##0.00\\)',
  // 41 -- Accounting, 0 decimal, No Symbol
  41: '_(* #,##0_);_(* \\(#,##0\\);_(* "-"_);_(@_)',
  // 42 -- Accounting, 0 decimal, $  Symbol
  42: '_("$"* #,##0_);_("$"* \\(#,##0\\);_("$"* "-"_);_(@_)',
  // 43 -- Accounting, 2 decimal, No Symbol
  43: '_(* #,##0.00_);_(* \\(#,##0.00\\);_(* "-"??_);_(@_)',
  // 44 -- Accounting, 2 decimal, $  Symbol
  44: '_("$"* #,##0.00_);_("$"* \\(#,##0.00\\);_("$"* "-"??_);_(@_)'
};
function kt(e, a, r) {
  for (var t = e < 0 ? -1 : 1, n = e * t, i = 0, s = 1, c = 0, f = 1, o = 0, l = 0, u = Math.floor(n); o < a && (u = Math.floor(n), c = u * s + i, l = u * o + f, !(n - u < 5e-8)); )
    n = 1 / (n - u), i = s, s = c, f = o, o = l;
  if (l > a && (o > a ? (l = f, c = i) : (l = o, c = s)), !r) return [0, t * c, l];
  var x = Math.floor(t * c / l);
  return [x, t * c - x * l, l];
}
function na(e, a, r) {
  if (e > 2958465 || e < 0) return null;
  var t = e | 0, n = Math.floor(86400 * (e - t)), i = 0, s = [], c = { D: t, T: n, u: 86400 * (e - t) - n, y: 0, m: 0, d: 0, H: 0, M: 0, S: 0, q: 0 };
  if (Math.abs(c.u) < 1e-6 && (c.u = 0), a && a.date1904 && (t += 1462), c.u > 0.9999 && (c.u = 0, ++n == 86400 && (c.T = n = 0, ++t, ++c.D)), t === 60)
    s = r ? [1317, 10, 29] : [1900, 2, 29], i = 3;
  else if (t === 0)
    s = r ? [1317, 8, 29] : [1900, 1, 0], i = 6;
  else {
    t > 60 && --t;
    var f = new Date(1900, 0, 1);
    f.setDate(f.getDate() + t - 1), s = [f.getFullYear(), f.getMonth() + 1, f.getDate()], i = f.getDay(), t < 60 && (i = (i + 6) % 7), r && (i = Ec(f, s));
  }
  return c.y = s[0], c.m = s[1], c.d = s[2], c.S = n % 60, n = Math.floor(n / 60), c.M = n % 60, n = Math.floor(n / 60), c.H = n, c.q = i, c;
}
var jn = /* @__PURE__ */ new Date(1899, 11, 31, 0, 0, 0), dc = /* @__PURE__ */ jn.getTime(), pc = /* @__PURE__ */ new Date(1900, 2, 1, 0, 0, 0);
function Jn(e, a) {
  var r = /* @__PURE__ */ e.getTime();
  return a ? r -= 1461 * 24 * 60 * 60 * 1e3 : e >= pc && (r += 24 * 60 * 60 * 1e3), (r - (dc + (/* @__PURE__ */ e.getTimezoneOffset() - /* @__PURE__ */ jn.getTimezoneOffset()) * 6e4)) / (24 * 60 * 60 * 1e3);
}
function l0(e) {
  return e.indexOf(".") == -1 ? e : e.replace(/(?:\.0*|(\.\d*[1-9])0+)$/, "$1");
}
function vc(e) {
  return e.indexOf("E") == -1 ? e : e.replace(/(?:\.0*|(\.\d*[1-9])0+)[Ee]/, "$1E").replace(/(E[+-])(\d)$/, "$10$2");
}
function mc(e) {
  var a = e < 0 ? 12 : 11, r = l0(e.toFixed(12));
  return r.length <= a || (r = e.toPrecision(10), r.length <= a) ? r : e.toExponential(5);
}
function gc(e) {
  var a = l0(e.toFixed(11));
  return a.length > (e < 0 ? 12 : 11) || a === "0" || a === "-0" ? e.toPrecision(6) : a;
}
function Ka(e) {
  var a = Math.floor(Math.log(Math.abs(e)) * Math.LOG10E), r;
  return a >= -4 && a <= -1 ? r = e.toPrecision(10 + a) : Math.abs(a) <= 9 ? r = mc(e) : a === 10 ? r = e.toFixed(10).substr(0, 12) : r = gc(e), l0(vc(r.toUpperCase()));
}
function fa(e, a) {
  switch (typeof e) {
    case "string":
      return e;
    case "boolean":
      return e ? "TRUE" : "FALSE";
    case "number":
      return (e | 0) === e ? e.toString(10) : Ka(e);
    case "undefined":
      return "";
    case "object":
      if (e == null) return "";
      if (e instanceof Date) return Er(14, Jn(e, a && a.date1904), a);
  }
  throw new Error("unsupported value in General format: " + e);
}
function Ec(e, a) {
  a[0] -= 581;
  var r = e.getDay();
  return e < 60 && (r = (r + 6) % 7), r;
}
function _c(e, a, r, t) {
  var n = "", i = 0, s = 0, c = r.y, f, o = 0;
  switch (e) {
    case 98:
      c = r.y + 543;
    case 121:
      switch (a.length) {
        case 1:
        case 2:
          f = c % 100, o = 2;
          break;
        default:
          f = c % 1e4, o = 4;
          break;
      }
      break;
    case 109:
      switch (a.length) {
        case 1:
        case 2:
          f = r.m, o = a.length;
          break;
        case 3:
          return bt[r.m - 1][1];
        case 5:
          return bt[r.m - 1][0];
        default:
          return bt[r.m - 1][2];
      }
      break;
    case 100:
      switch (a.length) {
        case 1:
        case 2:
          f = r.d, o = a.length;
          break;
        case 3:
          return V0[r.q][0];
        default:
          return V0[r.q][1];
      }
      break;
    case 104:
      switch (a.length) {
        case 1:
        case 2:
          f = 1 + (r.H + 11) % 12, o = a.length;
          break;
        default:
          throw "bad hour format: " + a;
      }
      break;
    case 72:
      switch (a.length) {
        case 1:
        case 2:
          f = r.H, o = a.length;
          break;
        default:
          throw "bad hour format: " + a;
      }
      break;
    case 77:
      switch (a.length) {
        case 1:
        case 2:
          f = r.M, o = a.length;
          break;
        default:
          throw "bad minute format: " + a;
      }
      break;
    case 115:
      if (a != "s" && a != "ss" && a != ".0" && a != ".00" && a != ".000") throw "bad second format: " + a;
      return r.u === 0 && (a == "s" || a == "ss") ? Fr(r.S, a.length) : (t >= 2 ? s = t === 3 ? 1e3 : 100 : s = t === 1 ? 10 : 1, i = Math.round(s * (r.S + r.u)), i >= 60 * s && (i = 0), a === "s" ? i === 0 ? "0" : "" + i / s : (n = Fr(i, 2 + t), a === "ss" ? n.substr(0, 2) : "." + n.substr(2, a.length - 1)));
    case 90:
      switch (a) {
        case "[h]":
        case "[hh]":
          f = r.D * 24 + r.H;
          break;
        case "[m]":
        case "[mm]":
          f = (r.D * 24 + r.H) * 60 + r.M;
          break;
        case "[s]":
        case "[ss]":
          f = ((r.D * 24 + r.H) * 60 + r.M) * 60 + Math.round(r.S + r.u);
          break;
        default:
          throw "bad abstime format: " + a;
      }
      o = a.length === 3 ? 1 : 2;
      break;
    case 101:
      f = c, o = 1;
      break;
  }
  var l = o > 0 ? Fr(f, o) : "";
  return l;
}
function jr(e) {
  var a = 3;
  if (e.length <= a) return e;
  for (var r = e.length % a, t = e.substr(0, r); r != e.length; r += a) t += (t.length > 0 ? "," : "") + e.substr(r, a);
  return t;
}
var Zn = /%/g;
function Tc(e, a, r) {
  var t = a.replace(Zn, ""), n = a.length - t.length;
  return Ur(e, t, r * Math.pow(10, 2 * n)) + Re("%", n);
}
function kc(e, a, r) {
  for (var t = a.length - 1; a.charCodeAt(t - 1) === 44; ) --t;
  return Ur(e, a.substr(0, t), r / Math.pow(10, 3 * (a.length - t)));
}
function qn(e, a) {
  var r, t = e.indexOf("E") - e.indexOf(".") - 1;
  if (e.match(/^#+0.0E\+0$/)) {
    if (a == 0) return "0.0E+0";
    if (a < 0) return "-" + qn(e, -a);
    var n = e.indexOf(".");
    n === -1 && (n = e.indexOf("E"));
    var i = Math.floor(Math.log(a) * Math.LOG10E) % n;
    if (i < 0 && (i += n), r = (a / Math.pow(10, i)).toPrecision(t + 1 + (n + i) % n), r.indexOf("e") === -1) {
      var s = Math.floor(Math.log(a) * Math.LOG10E);
      for (r.indexOf(".") === -1 ? r = r.charAt(0) + "." + r.substr(1) + "E+" + (s - r.length + i) : r += "E+" + (s - i); r.substr(0, 2) === "0."; )
        r = r.charAt(0) + r.substr(2, n) + "." + r.substr(2 + n), r = r.replace(/^0+([1-9])/, "$1").replace(/^0+\./, "0.");
      r = r.replace(/\+-/, "-");
    }
    r = r.replace(/^([+-]?)(\d*)\.(\d*)[Ee]/, function(c, f, o, l) {
      return f + o + l.substr(0, (n + i) % n) + "." + l.substr(i) + "E";
    });
  } else r = a.toExponential(t);
  return e.match(/E\+00$/) && r.match(/e[+-]\d$/) && (r = r.substr(0, r.length - 1) + "0" + r.charAt(r.length - 1)), e.match(/E\-/) && r.match(/e\+/) && (r = r.replace(/e\+/, "e")), r.replace("e", "E");
}
var Qn = /# (\?+)( ?)\/( ?)(\d+)/;
function wc(e, a, r) {
  var t = parseInt(e[4], 10), n = Math.round(a * t), i = Math.floor(n / t), s = n - i * t, c = t;
  return r + (i === 0 ? "" : "" + i) + " " + (s === 0 ? Re(" ", e[1].length + 1 + e[4].length) : o0(s, e[1].length) + e[2] + "/" + e[3] + Fr(c, e[4].length));
}
function Ac(e, a, r) {
  return r + (a === 0 ? "" : "" + a) + Re(" ", e[1].length + 2 + e[4].length);
}
var ei = /^#*0*\.([0#]+)/, ri = /\).*[0#]/, ai = /\(###\) ###\\?-####/;
function nr(e) {
  for (var a = "", r, t = 0; t != e.length; ++t) switch (r = e.charCodeAt(t)) {
    case 35:
      break;
    case 63:
      a += " ";
      break;
    case 48:
      a += "0";
      break;
    default:
      a += String.fromCharCode(r);
  }
  return a;
}
function X0(e, a) {
  var r = Math.pow(10, a);
  return "" + Math.round(e * r) / r;
}
function z0(e, a) {
  var r = e - Math.floor(e), t = Math.pow(10, a);
  return a < ("" + Math.round(r * t)).length ? 0 : Math.round(r * t);
}
function Fc(e, a) {
  return a < ("" + Math.round((e - Math.floor(e)) * Math.pow(10, a))).length ? 1 : 0;
}
function Sc(e) {
  return e < 2147483647 && e > -2147483648 ? "" + (e >= 0 ? e | 0 : e - 1 | 0) : "" + Math.floor(e);
}
function mr(e, a, r) {
  if (e.charCodeAt(0) === 40 && !a.match(ri)) {
    var t = a.replace(/\( */, "").replace(/ \)/, "").replace(/\)/, "");
    return r >= 0 ? mr("n", t, r) : "(" + mr("n", t, -r) + ")";
  }
  if (a.charCodeAt(a.length - 1) === 44) return kc(e, a, r);
  if (a.indexOf("%") !== -1) return Tc(e, a, r);
  if (a.indexOf("E") !== -1) return qn(a, r);
  if (a.charCodeAt(0) === 36) return "$" + mr(e, a.substr(a.charAt(1) == " " ? 2 : 1), r);
  var n, i, s, c, f = Math.abs(r), o = r < 0 ? "-" : "";
  if (a.match(/^00+$/)) return o + ma(f, a.length);
  if (a.match(/^[#?]+$/))
    return n = ma(r, 0), n === "0" && (n = ""), n.length > a.length ? n : nr(a.substr(0, a.length - n.length)) + n;
  if (i = a.match(Qn)) return wc(i, f, o);
  if (a.match(/^#+0+$/)) return o + ma(f, a.length - a.indexOf("0"));
  if (i = a.match(ei))
    return n = X0(r, i[1].length).replace(/^([^\.]+)$/, "$1." + nr(i[1])).replace(/\.$/, "." + nr(i[1])).replace(/\.(\d*)$/, function(p, h) {
      return "." + h + Re("0", nr(
        /*::(*/
        i[1]
      ).length - h.length);
    }), a.indexOf("0.") !== -1 ? n : n.replace(/^0\./, ".");
  if (a = a.replace(/^#+([0.])/, "$1"), i = a.match(/^(0*)\.(#*)$/))
    return o + X0(f, i[2].length).replace(/\.(\d*[1-9])0*$/, ".$1").replace(/^(-?\d*)$/, "$1.").replace(/^0\./, i[1].length ? "0." : ".");
  if (i = a.match(/^#{1,3},##0(\.?)$/)) return o + jr(ma(f, 0));
  if (i = a.match(/^#,##0\.([#0]*0)$/))
    return r < 0 ? "-" + mr(e, a, -r) : jr("" + (Math.floor(r) + Fc(r, i[1].length))) + "." + Fr(z0(r, i[1].length), i[1].length);
  if (i = a.match(/^#,#*,#0/)) return mr(e, a.replace(/^#,#*,/, ""), r);
  if (i = a.match(/^([0#]+)(\\?-([0#]+))+$/))
    return n = _a(mr(e, a.replace(/[\\-]/g, ""), r)), s = 0, _a(_a(a.replace(/\\/g, "")).replace(/[0#]/g, function(p) {
      return s < n.length ? n.charAt(s++) : p === "0" ? "0" : "";
    }));
  if (a.match(ai))
    return n = mr(e, "##########", r), "(" + n.substr(0, 3) + ") " + n.substr(3, 3) + "-" + n.substr(6);
  var l = "";
  if (i = a.match(/^([#0?]+)( ?)\/( ?)([#0?]+)/))
    return s = Math.min(
      /*::String(*/
      i[4].length,
      7
    ), c = kt(f, Math.pow(10, s) - 1, !1), n = "" + o, l = Ur(
      "n",
      /*::String(*/
      i[1],
      c[1]
    ), l.charAt(l.length - 1) == " " && (l = l.substr(0, l.length - 1) + "0"), n += l + /*::String(*/
    i[2] + "/" + /*::String(*/
    i[3], l = _t(c[2], s), l.length < i[4].length && (l = nr(i[4].substr(i[4].length - l.length)) + l), n += l, n;
  if (i = a.match(/^# ([#0?]+)( ?)\/( ?)([#0?]+)/))
    return s = Math.min(Math.max(i[1].length, i[4].length), 7), c = kt(f, Math.pow(10, s) - 1, !0), o + (c[0] || (c[1] ? "" : "0")) + " " + (c[1] ? o0(c[1], s) + i[2] + "/" + i[3] + _t(c[2], s) : Re(" ", 2 * s + 1 + i[2].length + i[3].length));
  if (i = a.match(/^[#0?]+$/))
    return n = ma(r, 0), a.length <= n.length ? n : nr(a.substr(0, a.length - n.length)) + n;
  if (i = a.match(/^([#0?]+)\.([#0]+)$/)) {
    n = "" + r.toFixed(Math.min(i[2].length, 10)).replace(/([^0])0+$/, "$1"), s = n.indexOf(".");
    var u = a.indexOf(".") - s, x = a.length - n.length - u;
    return nr(a.substr(0, u) + n + a.substr(a.length - x));
  }
  if (i = a.match(/^00,000\.([#0]*0)$/))
    return s = z0(r, i[1].length), r < 0 ? "-" + mr(e, a, -r) : jr(Sc(r)).replace(/^\d,\d{3}$/, "0$&").replace(/^\d*$/, function(p) {
      return "00," + (p.length < 3 ? Fr(0, 3 - p.length) : "") + p;
    }) + "." + Fr(s, i[1].length);
  switch (a) {
    case "###,##0.00":
      return mr(e, "#,##0.00", r);
    case "###,###":
    case "##,###":
    case "#,###":
      var d = jr(ma(f, 0));
      return d !== "0" ? o + d : "";
    case "###,###.00":
      return mr(e, "###,##0.00", r).replace(/^0\./, ".");
    case "#,###.00":
      return mr(e, "#,##0.00", r).replace(/^0\./, ".");
  }
  throw new Error("unsupported format |" + a + "|");
}
function Cc(e, a, r) {
  for (var t = a.length - 1; a.charCodeAt(t - 1) === 44; ) --t;
  return Ur(e, a.substr(0, t), r / Math.pow(10, 3 * (a.length - t)));
}
function yc(e, a, r) {
  var t = a.replace(Zn, ""), n = a.length - t.length;
  return Ur(e, t, r * Math.pow(10, 2 * n)) + Re("%", n);
}
function ti(e, a) {
  var r, t = e.indexOf("E") - e.indexOf(".") - 1;
  if (e.match(/^#+0.0E\+0$/)) {
    if (a == 0) return "0.0E+0";
    if (a < 0) return "-" + ti(e, -a);
    var n = e.indexOf(".");
    n === -1 && (n = e.indexOf("E"));
    var i = Math.floor(Math.log(a) * Math.LOG10E) % n;
    if (i < 0 && (i += n), r = (a / Math.pow(10, i)).toPrecision(t + 1 + (n + i) % n), !r.match(/[Ee]/)) {
      var s = Math.floor(Math.log(a) * Math.LOG10E);
      r.indexOf(".") === -1 ? r = r.charAt(0) + "." + r.substr(1) + "E+" + (s - r.length + i) : r += "E+" + (s - i), r = r.replace(/\+-/, "-");
    }
    r = r.replace(/^([+-]?)(\d*)\.(\d*)[Ee]/, function(c, f, o, l) {
      return f + o + l.substr(0, (n + i) % n) + "." + l.substr(i) + "E";
    });
  } else r = a.toExponential(t);
  return e.match(/E\+00$/) && r.match(/e[+-]\d$/) && (r = r.substr(0, r.length - 1) + "0" + r.charAt(r.length - 1)), e.match(/E\-/) && r.match(/e\+/) && (r = r.replace(/e\+/, "e")), r.replace("e", "E");
}
function Rr(e, a, r) {
  if (e.charCodeAt(0) === 40 && !a.match(ri)) {
    var t = a.replace(/\( */, "").replace(/ \)/, "").replace(/\)/, "");
    return r >= 0 ? Rr("n", t, r) : "(" + Rr("n", t, -r) + ")";
  }
  if (a.charCodeAt(a.length - 1) === 44) return Cc(e, a, r);
  if (a.indexOf("%") !== -1) return yc(e, a, r);
  if (a.indexOf("E") !== -1) return ti(a, r);
  if (a.charCodeAt(0) === 36) return "$" + Rr(e, a.substr(a.charAt(1) == " " ? 2 : 1), r);
  var n, i, s, c, f = Math.abs(r), o = r < 0 ? "-" : "";
  if (a.match(/^00+$/)) return o + Fr(f, a.length);
  if (a.match(/^[#?]+$/))
    return n = "" + r, r === 0 && (n = ""), n.length > a.length ? n : nr(a.substr(0, a.length - n.length)) + n;
  if (i = a.match(Qn)) return Ac(i, f, o);
  if (a.match(/^#+0+$/)) return o + Fr(f, a.length - a.indexOf("0"));
  if (i = a.match(ei))
    return n = ("" + r).replace(/^([^\.]+)$/, "$1." + nr(i[1])).replace(/\.$/, "." + nr(i[1])), n = n.replace(/\.(\d*)$/, function(p, h) {
      return "." + h + Re("0", nr(i[1]).length - h.length);
    }), a.indexOf("0.") !== -1 ? n : n.replace(/^0\./, ".");
  if (a = a.replace(/^#+([0.])/, "$1"), i = a.match(/^(0*)\.(#*)$/))
    return o + ("" + f).replace(/\.(\d*[1-9])0*$/, ".$1").replace(/^(-?\d*)$/, "$1.").replace(/^0\./, i[1].length ? "0." : ".");
  if (i = a.match(/^#{1,3},##0(\.?)$/)) return o + jr("" + f);
  if (i = a.match(/^#,##0\.([#0]*0)$/))
    return r < 0 ? "-" + Rr(e, a, -r) : jr("" + r) + "." + Re("0", i[1].length);
  if (i = a.match(/^#,#*,#0/)) return Rr(e, a.replace(/^#,#*,/, ""), r);
  if (i = a.match(/^([0#]+)(\\?-([0#]+))+$/))
    return n = _a(Rr(e, a.replace(/[\\-]/g, ""), r)), s = 0, _a(_a(a.replace(/\\/g, "")).replace(/[0#]/g, function(p) {
      return s < n.length ? n.charAt(s++) : p === "0" ? "0" : "";
    }));
  if (a.match(ai))
    return n = Rr(e, "##########", r), "(" + n.substr(0, 3) + ") " + n.substr(3, 3) + "-" + n.substr(6);
  var l = "";
  if (i = a.match(/^([#0?]+)( ?)\/( ?)([#0?]+)/))
    return s = Math.min(
      /*::String(*/
      i[4].length,
      7
    ), c = kt(f, Math.pow(10, s) - 1, !1), n = "" + o, l = Ur(
      "n",
      /*::String(*/
      i[1],
      c[1]
    ), l.charAt(l.length - 1) == " " && (l = l.substr(0, l.length - 1) + "0"), n += l + /*::String(*/
    i[2] + "/" + /*::String(*/
    i[3], l = _t(c[2], s), l.length < i[4].length && (l = nr(i[4].substr(i[4].length - l.length)) + l), n += l, n;
  if (i = a.match(/^# ([#0?]+)( ?)\/( ?)([#0?]+)/))
    return s = Math.min(Math.max(i[1].length, i[4].length), 7), c = kt(f, Math.pow(10, s) - 1, !0), o + (c[0] || (c[1] ? "" : "0")) + " " + (c[1] ? o0(c[1], s) + i[2] + "/" + i[3] + _t(c[2], s) : Re(" ", 2 * s + 1 + i[2].length + i[3].length));
  if (i = a.match(/^[#0?]+$/))
    return n = "" + r, a.length <= n.length ? n : nr(a.substr(0, a.length - n.length)) + n;
  if (i = a.match(/^([#0]+)\.([#0]+)$/)) {
    n = "" + r.toFixed(Math.min(i[2].length, 10)).replace(/([^0])0+$/, "$1"), s = n.indexOf(".");
    var u = a.indexOf(".") - s, x = a.length - n.length - u;
    return nr(a.substr(0, u) + n + a.substr(a.length - x));
  }
  if (i = a.match(/^00,000\.([#0]*0)$/))
    return r < 0 ? "-" + Rr(e, a, -r) : jr("" + r).replace(/^\d,\d{3}$/, "0$&").replace(/^\d*$/, function(p) {
      return "00," + (p.length < 3 ? Fr(0, 3 - p.length) : "") + p;
    }) + "." + Fr(0, i[1].length);
  switch (a) {
    case "###,###":
    case "##,###":
    case "#,###":
      var d = jr("" + f);
      return d !== "0" ? o + d : "";
    default:
      if (a.match(/\.[0#?]*$/)) return Rr(e, a.slice(0, a.lastIndexOf(".")), r) + nr(a.slice(a.lastIndexOf(".")));
  }
  throw new Error("unsupported format |" + a + "|");
}
function Ur(e, a, r) {
  return (r | 0) === r ? Rr(e, a, r) : mr(e, a, r);
}
function Dc(e) {
  for (var a = [], r = !1, t = 0, n = 0; t < e.length; ++t) switch (
    /*cc=*/
    e.charCodeAt(t)
  ) {
    case 34:
      r = !r;
      break;
    case 95:
    case 42:
    case 92:
      ++t;
      break;
    case 59:
      a[a.length] = e.substr(n, t - n), n = t + 1;
  }
  if (a[a.length] = e.substr(n), r === !0) throw new Error("Format |" + e + "| unterminated string ");
  return a;
}
var ni = /\[[HhMmSs\u0E0A\u0E19\u0E17]*\]/;
function Sa(e) {
  for (var a = 0, r = "", t = ""; a < e.length; )
    switch (r = e.charAt(a)) {
      case "G":
        Tt(e, a) && (a += 6), a++;
        break;
      case '"':
        for (
          ;
          /*cc=*/
          e.charCodeAt(++a) !== 34 && a < e.length;
        )
          ;
        ++a;
        break;
      case "\\":
        a += 2;
        break;
      case "_":
        a += 2;
        break;
      case "@":
        ++a;
        break;
      case "B":
      case "b":
        if (e.charAt(a + 1) === "1" || e.charAt(a + 1) === "2") return !0;
      case "M":
      case "D":
      case "Y":
      case "H":
      case "S":
      case "E":
      case "m":
      case "d":
      case "y":
      case "h":
      case "s":
      case "e":
      case "g":
        return !0;
      case "A":
      case "a":
      case "上":
        if (e.substr(a, 3).toUpperCase() === "A/P" || e.substr(a, 5).toUpperCase() === "AM/PM" || e.substr(a, 5).toUpperCase() === "上午/下午") return !0;
        ++a;
        break;
      case "[":
        for (t = r; e.charAt(a++) !== "]" && a < e.length; ) t += e.charAt(a);
        if (t.match(ni)) return !0;
        break;
      case ".":
      case "0":
      case "#":
        for (; a < e.length && ("0#?.,E+-%".indexOf(r = e.charAt(++a)) > -1 || r == "\\" && e.charAt(a + 1) == "-" && "0#".indexOf(e.charAt(a + 2)) > -1); )
          ;
        break;
      case "?":
        for (; e.charAt(++a) === r; )
          ;
        break;
      case "*":
        ++a, (e.charAt(a) == " " || e.charAt(a) == "*") && ++a;
        break;
      case "(":
      case ")":
        ++a;
        break;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        for (; a < e.length && "0123456789".indexOf(e.charAt(++a)) > -1; )
          ;
        break;
      case " ":
        ++a;
        break;
      default:
        ++a;
        break;
    }
  return !1;
}
function Rc(e, a, r, t) {
  for (var n = [], i = "", s = 0, c = "", f = "t", o, l, u, x = "H"; s < e.length; )
    switch (c = e.charAt(s)) {
      case "G":
        if (!Tt(e, s)) throw new Error("unrecognized character " + c + " in " + e);
        n[n.length] = { t: "G", v: "General" }, s += 7;
        break;
      case '"':
        for (i = ""; (u = e.charCodeAt(++s)) !== 34 && s < e.length; ) i += String.fromCharCode(u);
        n[n.length] = { t: "t", v: i }, ++s;
        break;
      case "\\":
        var d = e.charAt(++s), p = d === "(" || d === ")" ? d : "t";
        n[n.length] = { t: p, v: d }, ++s;
        break;
      case "_":
        n[n.length] = { t: "t", v: " " }, s += 2;
        break;
      case "@":
        n[n.length] = { t: "T", v: a }, ++s;
        break;
      case "B":
      case "b":
        if (e.charAt(s + 1) === "1" || e.charAt(s + 1) === "2") {
          if (o == null && (o = na(a, r, e.charAt(s + 1) === "2"), o == null))
            return "";
          n[n.length] = { t: "X", v: e.substr(s, 2) }, f = c, s += 2;
          break;
        }
      case "M":
      case "D":
      case "Y":
      case "H":
      case "S":
      case "E":
        c = c.toLowerCase();
      case "m":
      case "d":
      case "y":
      case "h":
      case "s":
      case "e":
      case "g":
        if (a < 0 || o == null && (o = na(a, r), o == null))
          return "";
        for (i = c; ++s < e.length && e.charAt(s).toLowerCase() === c; ) i += c;
        c === "m" && f.toLowerCase() === "h" && (c = "M"), c === "h" && (c = x), n[n.length] = { t: c, v: i }, f = c;
        break;
      case "A":
      case "a":
      case "上":
        var h = { t: c, v: c };
        if (o == null && (o = na(a, r)), e.substr(s, 3).toUpperCase() === "A/P" ? (o != null && (h.v = o.H >= 12 ? "P" : "A"), h.t = "T", x = "h", s += 3) : e.substr(s, 5).toUpperCase() === "AM/PM" ? (o != null && (h.v = o.H >= 12 ? "PM" : "AM"), h.t = "T", s += 5, x = "h") : e.substr(s, 5).toUpperCase() === "上午/下午" ? (o != null && (h.v = o.H >= 12 ? "下午" : "上午"), h.t = "T", s += 5, x = "h") : (h.t = "t", ++s), o == null && h.t === "T") return "";
        n[n.length] = h, f = c;
        break;
      case "[":
        for (i = c; e.charAt(s++) !== "]" && s < e.length; ) i += e.charAt(s);
        if (i.slice(-1) !== "]") throw 'unterminated "[" block: |' + i + "|";
        if (i.match(ni)) {
          if (o == null && (o = na(a, r), o == null))
            return "";
          n[n.length] = { t: "Z", v: i.toLowerCase() }, f = i.charAt(1);
        } else i.indexOf("$") > -1 && (i = (i.match(/\$([^-\[\]]*)/) || [])[1] || "$", Sa(e) || (n[n.length] = { t: "t", v: i }));
        break;
      case ".":
        if (o != null) {
          for (i = c; ++s < e.length && (c = e.charAt(s)) === "0"; ) i += c;
          n[n.length] = { t: "s", v: i };
          break;
        }
      case "0":
      case "#":
        for (i = c; ++s < e.length && "0#?.,E+-%".indexOf(c = e.charAt(s)) > -1; ) i += c;
        n[n.length] = { t: "n", v: i };
        break;
      case "?":
        for (i = c; e.charAt(++s) === c; ) i += c;
        n[n.length] = { t: c, v: i }, f = c;
        break;
      case "*":
        ++s, (e.charAt(s) == " " || e.charAt(s) == "*") && ++s;
        break;
      case "(":
      case ")":
        n[n.length] = { t: t === 1 ? "t" : c, v: c }, ++s;
        break;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        for (i = c; s < e.length && "0123456789".indexOf(e.charAt(++s)) > -1; ) i += e.charAt(s);
        n[n.length] = { t: "D", v: i };
        break;
      case " ":
        n[n.length] = { t: c, v: c }, ++s;
        break;
      case "$":
        n[n.length] = { t: "t", v: "$" }, ++s;
        break;
      default:
        if (",$-+/():!^&'~{}<>=€acfijklopqrtuvwxzP".indexOf(c) === -1) throw new Error("unrecognized character " + c + " in " + e);
        n[n.length] = { t: "t", v: c }, ++s;
        break;
    }
  var m = 0, A = 0, y;
  for (s = n.length - 1, f = "t"; s >= 0; --s)
    switch (n[s].t) {
      case "h":
      case "H":
        n[s].t = x, f = "h", m < 1 && (m = 1);
        break;
      case "s":
        (y = n[s].v.match(/\.0+$/)) && (A = Math.max(A, y[0].length - 1)), m < 3 && (m = 3);
      case "d":
      case "y":
      case "M":
      case "e":
        f = n[s].t;
        break;
      case "m":
        f === "s" && (n[s].t = "M", m < 2 && (m = 2));
        break;
      case "X":
        break;
      case "Z":
        m < 1 && n[s].v.match(/[Hh]/) && (m = 1), m < 2 && n[s].v.match(/[Mm]/) && (m = 2), m < 3 && n[s].v.match(/[Ss]/) && (m = 3);
    }
  switch (m) {
    case 0:
      break;
    case 1:
      o.u >= 0.5 && (o.u = 0, ++o.S), o.S >= 60 && (o.S = 0, ++o.M), o.M >= 60 && (o.M = 0, ++o.H);
      break;
    case 2:
      o.u >= 0.5 && (o.u = 0, ++o.S), o.S >= 60 && (o.S = 0, ++o.M);
      break;
  }
  var E = "", I;
  for (s = 0; s < n.length; ++s)
    switch (n[s].t) {
      case "t":
      case "T":
      case " ":
      case "D":
        break;
      case "X":
        n[s].v = "", n[s].t = ";";
        break;
      case "d":
      case "m":
      case "y":
      case "h":
      case "H":
      case "M":
      case "s":
      case "e":
      case "b":
      case "Z":
        n[s].v = _c(n[s].t.charCodeAt(0), n[s].v, o, A), n[s].t = "t";
        break;
      case "n":
      case "?":
        for (I = s + 1; n[I] != null && ((c = n[I].t) === "?" || c === "D" || (c === " " || c === "t") && n[I + 1] != null && (n[I + 1].t === "?" || n[I + 1].t === "t" && n[I + 1].v === "/") || n[s].t === "(" && (c === " " || c === "n" || c === ")") || c === "t" && (n[I].v === "/" || n[I].v === " " && n[I + 1] != null && n[I + 1].t == "?")); )
          n[s].v += n[I].v, n[I] = { v: "", t: ";" }, ++I;
        E += n[s].v, s = I - 1;
        break;
      case "G":
        n[s].t = "t", n[s].v = fa(a, r);
        break;
    }
  var b = "", O, F;
  if (E.length > 0) {
    E.charCodeAt(0) == 40 ? (O = a < 0 && E.charCodeAt(0) === 45 ? -a : a, F = Ur("n", E, O)) : (O = a < 0 && t > 1 ? -a : a, F = Ur("n", E, O), O < 0 && n[0] && n[0].t == "t" && (F = F.substr(1), n[0].v = "-" + n[0].v)), I = F.length - 1;
    var W = n.length;
    for (s = 0; s < n.length; ++s) if (n[s] != null && n[s].t != "t" && n[s].v.indexOf(".") > -1) {
      W = s;
      break;
    }
    var D = n.length;
    if (W === n.length && F.indexOf("E") === -1) {
      for (s = n.length - 1; s >= 0; --s)
        n[s] == null || "n?".indexOf(n[s].t) === -1 || (I >= n[s].v.length - 1 ? (I -= n[s].v.length, n[s].v = F.substr(I + 1, n[s].v.length)) : I < 0 ? n[s].v = "" : (n[s].v = F.substr(0, I + 1), I = -1), n[s].t = "t", D = s);
      I >= 0 && D < n.length && (n[D].v = F.substr(0, I + 1) + n[D].v);
    } else if (W !== n.length && F.indexOf("E") === -1) {
      for (I = F.indexOf(".") - 1, s = W; s >= 0; --s)
        if (!(n[s] == null || "n?".indexOf(n[s].t) === -1)) {
          for (l = n[s].v.indexOf(".") > -1 && s === W ? n[s].v.indexOf(".") - 1 : n[s].v.length - 1, b = n[s].v.substr(l + 1); l >= 0; --l)
            I >= 0 && (n[s].v.charAt(l) === "0" || n[s].v.charAt(l) === "#") && (b = F.charAt(I--) + b);
          n[s].v = b, n[s].t = "t", D = s;
        }
      for (I >= 0 && D < n.length && (n[D].v = F.substr(0, I + 1) + n[D].v), I = F.indexOf(".") + 1, s = W; s < n.length; ++s)
        if (!(n[s] == null || "n?(".indexOf(n[s].t) === -1 && s !== W)) {
          for (l = n[s].v.indexOf(".") > -1 && s === W ? n[s].v.indexOf(".") + 1 : 0, b = n[s].v.substr(0, l); l < n[s].v.length; ++l)
            I < F.length && (b += F.charAt(I++));
          n[s].v = b, n[s].t = "t", D = s;
        }
    }
  }
  for (s = 0; s < n.length; ++s) n[s] != null && "n?".indexOf(n[s].t) > -1 && (O = t > 1 && a < 0 && s > 0 && n[s - 1].v === "-" ? -a : a, n[s].v = Ur(n[s].t, n[s].v, O), n[s].t = "t");
  var z = "";
  for (s = 0; s !== n.length; ++s) n[s] != null && (z += n[s].v);
  return z;
}
var $0 = /\[(=|>[=]?|<[>=]?)(-?\d+(?:\.\d*)?)\]/;
function Y0(e, a) {
  if (a == null) return !1;
  var r = parseFloat(a[2]);
  switch (a[1]) {
    case "=":
      if (e == r) return !0;
      break;
    case ">":
      if (e > r) return !0;
      break;
    case "<":
      if (e < r) return !0;
      break;
    case "<>":
      if (e != r) return !0;
      break;
    case ">=":
      if (e >= r) return !0;
      break;
    case "<=":
      if (e <= r) return !0;
      break;
  }
  return !1;
}
function Oc(e, a) {
  var r = Dc(e), t = r.length, n = r[t - 1].indexOf("@");
  if (t < 4 && n > -1 && --t, r.length > 4) throw new Error("cannot find right format for |" + r.join("|") + "|");
  if (typeof a != "number") return [4, r.length === 4 || n > -1 ? r[r.length - 1] : "@"];
  switch (r.length) {
    case 1:
      r = n > -1 ? ["General", "General", "General", r[0]] : [r[0], r[0], r[0], "@"];
      break;
    case 2:
      r = n > -1 ? [r[0], r[0], r[0], r[1]] : [r[0], r[1], r[0], "@"];
      break;
    case 3:
      r = n > -1 ? [r[0], r[1], r[0], r[2]] : [r[0], r[1], r[2], "@"];
      break;
  }
  var i = a > 0 ? r[0] : a < 0 ? r[1] : r[2];
  if (r[0].indexOf("[") === -1 && r[1].indexOf("[") === -1) return [t, i];
  if (r[0].match(/\[[=<>]/) != null || r[1].match(/\[[=<>]/) != null) {
    var s = r[0].match($0), c = r[1].match($0);
    return Y0(a, s) ? [t, r[0]] : Y0(a, c) ? [t, r[1]] : [t, r[s != null && c != null ? 2 : 1]];
  }
  return [t, i];
}
function Er(e, a, r) {
  r == null && (r = {});
  var t = "";
  switch (typeof e) {
    case "string":
      e == "m/d/yy" && r.dateNF ? t = r.dateNF : t = e;
      break;
    case "number":
      e == 14 && r.dateNF ? t = r.dateNF : t = (r.table != null ? r.table : de)[e], t == null && (t = r.table && r.table[G0[e]] || de[G0[e]]), t == null && (t = xc[e] || "General");
      break;
  }
  if (Tt(t, 0)) return fa(a, r);
  a instanceof Date && (a = Jn(a, r.date1904));
  var n = Oc(t, a);
  if (Tt(n[1])) return fa(a, r);
  if (a === !0) a = "TRUE";
  else if (a === !1) a = "FALSE";
  else if (a === "" || a == null) return "";
  return Rc(n[1], a, r, n[0]);
}
function ia(e, a) {
  if (typeof a != "number") {
    a = +a || -1;
    for (var r = 0; r < 392; ++r) {
      if (de[r] == null) {
        a < 0 && (a = r);
        continue;
      }
      if (de[r] == e) {
        a = r;
        break;
      }
    }
    a < 0 && (a = 391);
  }
  return de[a] = e, a;
}
function ii() {
  de = hc();
}
var Nc = {
  5: '"$"#,##0_);\\("$"#,##0\\)',
  6: '"$"#,##0_);[Red]\\("$"#,##0\\)',
  7: '"$"#,##0.00_);\\("$"#,##0.00\\)',
  8: '"$"#,##0.00_);[Red]\\("$"#,##0.00\\)',
  23: "General",
  24: "General",
  25: "General",
  26: "General",
  27: "m/d/yy",
  28: "m/d/yy",
  29: "m/d/yy",
  30: "m/d/yy",
  31: "m/d/yy",
  32: "h:mm:ss",
  33: "h:mm:ss",
  34: "h:mm:ss",
  35: "h:mm:ss",
  36: "m/d/yy",
  41: '_(* #,##0_);_(* (#,##0);_(* "-"_);_(@_)',
  42: '_("$"* #,##0_);_("$"* (#,##0);_("$"* "-"_);_(@_)',
  43: '_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)',
  44: '_("$"* #,##0.00_);_("$"* (#,##0.00);_("$"* "-"??_);_(@_)',
  50: "m/d/yy",
  51: "m/d/yy",
  52: "m/d/yy",
  53: "m/d/yy",
  54: "m/d/yy",
  55: "m/d/yy",
  56: "m/d/yy",
  57: "m/d/yy",
  58: "m/d/yy",
  59: "0",
  60: "0.00",
  61: "#,##0",
  62: "#,##0.00",
  63: '"$"#,##0_);\\("$"#,##0\\)',
  64: '"$"#,##0_);[Red]\\("$"#,##0\\)',
  65: '"$"#,##0.00_);\\("$"#,##0.00\\)',
  66: '"$"#,##0.00_);[Red]\\("$"#,##0.00\\)',
  67: "0%",
  68: "0.00%",
  69: "# ?/?",
  70: "# ??/??",
  71: "m/d/yy",
  72: "m/d/yy",
  73: "d-mmm-yy",
  74: "d-mmm",
  75: "mmm-yy",
  76: "h:mm",
  77: "h:mm:ss",
  78: "m/d/yy h:mm",
  79: "mm:ss",
  80: "[h]:mm:ss",
  81: "mmss.0"
}, si = /[dD]+|[mM]+|[yYeE]+|[Hh]+|[Ss]+/g;
function Ic(e) {
  var a = typeof e == "number" ? de[e] : e;
  return a = a.replace(si, "(\\d+)"), new RegExp("^" + a + "$");
}
function Lc(e, a, r) {
  var t = -1, n = -1, i = -1, s = -1, c = -1, f = -1;
  (a.match(si) || []).forEach(function(u, x) {
    var d = parseInt(r[x + 1], 10);
    switch (u.toLowerCase().charAt(0)) {
      case "y":
        t = d;
        break;
      case "d":
        i = d;
        break;
      case "h":
        s = d;
        break;
      case "s":
        f = d;
        break;
      case "m":
        s >= 0 ? c = d : n = d;
        break;
    }
  }), f >= 0 && c == -1 && n >= 0 && (c = n, n = -1);
  var o = ("" + (t >= 0 ? t : (/* @__PURE__ */ new Date()).getFullYear())).slice(-4) + "-" + ("00" + (n >= 1 ? n : 1)).slice(-2) + "-" + ("00" + (i >= 1 ? i : 1)).slice(-2);
  o.length == 7 && (o = "0" + o), o.length == 8 && (o = "20" + o);
  var l = ("00" + (s >= 0 ? s : 0)).slice(-2) + ":" + ("00" + (c >= 0 ? c : 0)).slice(-2) + ":" + ("00" + (f >= 0 ? f : 0)).slice(-2);
  return s == -1 && c == -1 && f == -1 ? o : t == -1 && n == -1 && i == -1 ? l : o + "T" + l;
}
var Pc = /* @__PURE__ */ function() {
  var e = {};
  e.version = "1.2.0";
  function a() {
    for (var F = 0, W = new Array(256), D = 0; D != 256; ++D)
      F = D, F = F & 1 ? -306674912 ^ F >>> 1 : F >>> 1, F = F & 1 ? -306674912 ^ F >>> 1 : F >>> 1, F = F & 1 ? -306674912 ^ F >>> 1 : F >>> 1, F = F & 1 ? -306674912 ^ F >>> 1 : F >>> 1, F = F & 1 ? -306674912 ^ F >>> 1 : F >>> 1, F = F & 1 ? -306674912 ^ F >>> 1 : F >>> 1, F = F & 1 ? -306674912 ^ F >>> 1 : F >>> 1, F = F & 1 ? -306674912 ^ F >>> 1 : F >>> 1, W[D] = F;
    return typeof Int32Array < "u" ? new Int32Array(W) : W;
  }
  var r = a();
  function t(F) {
    var W = 0, D = 0, z = 0, G = typeof Int32Array < "u" ? new Int32Array(4096) : new Array(4096);
    for (z = 0; z != 256; ++z) G[z] = F[z];
    for (z = 0; z != 256; ++z)
      for (D = F[z], W = 256 + z; W < 4096; W += 256) D = G[W] = D >>> 8 ^ F[D & 255];
    var L = [];
    for (z = 1; z != 16; ++z) L[z - 1] = typeof Int32Array < "u" ? G.subarray(z * 256, z * 256 + 256) : G.slice(z * 256, z * 256 + 256);
    return L;
  }
  var n = t(r), i = n[0], s = n[1], c = n[2], f = n[3], o = n[4], l = n[5], u = n[6], x = n[7], d = n[8], p = n[9], h = n[10], m = n[11], A = n[12], y = n[13], E = n[14];
  function I(F, W) {
    for (var D = W ^ -1, z = 0, G = F.length; z < G; ) D = D >>> 8 ^ r[(D ^ F.charCodeAt(z++)) & 255];
    return ~D;
  }
  function b(F, W) {
    for (var D = W ^ -1, z = F.length - 15, G = 0; G < z; ) D = E[F[G++] ^ D & 255] ^ y[F[G++] ^ D >> 8 & 255] ^ A[F[G++] ^ D >> 16 & 255] ^ m[F[G++] ^ D >>> 24] ^ h[F[G++]] ^ p[F[G++]] ^ d[F[G++]] ^ x[F[G++]] ^ u[F[G++]] ^ l[F[G++]] ^ o[F[G++]] ^ f[F[G++]] ^ c[F[G++]] ^ s[F[G++]] ^ i[F[G++]] ^ r[F[G++]];
    for (z += 15; G < z; ) D = D >>> 8 ^ r[(D ^ F[G++]) & 255];
    return ~D;
  }
  function O(F, W) {
    for (var D = W ^ -1, z = 0, G = F.length, L = 0, J = 0; z < G; )
      L = F.charCodeAt(z++), L < 128 ? D = D >>> 8 ^ r[(D ^ L) & 255] : L < 2048 ? (D = D >>> 8 ^ r[(D ^ (192 | L >> 6 & 31)) & 255], D = D >>> 8 ^ r[(D ^ (128 | L & 63)) & 255]) : L >= 55296 && L < 57344 ? (L = (L & 1023) + 64, J = F.charCodeAt(z++) & 1023, D = D >>> 8 ^ r[(D ^ (240 | L >> 8 & 7)) & 255], D = D >>> 8 ^ r[(D ^ (128 | L >> 2 & 63)) & 255], D = D >>> 8 ^ r[(D ^ (128 | J >> 6 & 15 | (L & 3) << 4)) & 255], D = D >>> 8 ^ r[(D ^ (128 | J & 63)) & 255]) : (D = D >>> 8 ^ r[(D ^ (224 | L >> 12 & 15)) & 255], D = D >>> 8 ^ r[(D ^ (128 | L >> 6 & 63)) & 255], D = D >>> 8 ^ r[(D ^ (128 | L & 63)) & 255]);
    return ~D;
  }
  return e.table = r, e.bstr = I, e.buf = b, e.str = O, e;
}(), Ee = /* @__PURE__ */ function() {
  var a = {};
  a.version = "1.2.1";
  function r(v, T) {
    for (var g = v.split("/"), _ = T.split("/"), k = 0, w = 0, M = Math.min(g.length, _.length); k < M; ++k) {
      if (w = g[k].length - _[k].length) return w;
      if (g[k] != _[k]) return g[k] < _[k] ? -1 : 1;
    }
    return g.length - _.length;
  }
  function t(v) {
    if (v.charAt(v.length - 1) == "/") return v.slice(0, -1).indexOf("/") === -1 ? v : t(v.slice(0, -1));
    var T = v.lastIndexOf("/");
    return T === -1 ? v : v.slice(0, T + 1);
  }
  function n(v) {
    if (v.charAt(v.length - 1) == "/") return n(v.slice(0, -1));
    var T = v.lastIndexOf("/");
    return T === -1 ? v : v.slice(T + 1);
  }
  function i(v, T) {
    typeof T == "string" && (T = new Date(T));
    var g = T.getHours();
    g = g << 6 | T.getMinutes(), g = g << 5 | T.getSeconds() >>> 1, v.write_shift(2, g);
    var _ = T.getFullYear() - 1980;
    _ = _ << 4 | T.getMonth() + 1, _ = _ << 5 | T.getDate(), v.write_shift(2, _);
  }
  function s(v) {
    var T = v.read_shift(2) & 65535, g = v.read_shift(2) & 65535, _ = /* @__PURE__ */ new Date(), k = g & 31;
    g >>>= 5;
    var w = g & 15;
    g >>>= 4, _.setMilliseconds(0), _.setFullYear(g + 1980), _.setMonth(w - 1), _.setDate(k);
    var M = T & 31;
    T >>>= 5;
    var X = T & 63;
    return T >>>= 6, _.setHours(T), _.setMinutes(X), _.setSeconds(M << 1), _;
  }
  function c(v) {
    $e(v, 0);
    for (var T = (
      /*::(*/
      {}
    ), g = 0; v.l <= v.length - 4; ) {
      var _ = v.read_shift(2), k = v.read_shift(2), w = v.l + k, M = {};
      switch (_) {
        case 21589:
          g = v.read_shift(1), g & 1 && (M.mtime = v.read_shift(4)), k > 5 && (g & 2 && (M.atime = v.read_shift(4)), g & 4 && (M.ctime = v.read_shift(4))), M.mtime && (M.mt = new Date(M.mtime * 1e3));
          break;
      }
      v.l = w, T[_] = M;
    }
    return T;
  }
  var f;
  function o() {
    return f || (f = {});
  }
  function l(v, T) {
    if (v[0] == 80 && v[1] == 75) return M0(v, T);
    if ((v[0] | 32) == 109 && (v[1] | 32) == 105) return Xs(v, T);
    if (v.length < 512) throw new Error("CFB file size " + v.length + " < 512");
    var g = 3, _ = 512, k = 0, w = 0, M = 0, X = 0, P = 0, B = [], H = (
      /*::(*/
      v.slice(0, 512)
    );
    $e(H, 0);
    var K = u(H);
    switch (g = K[0], g) {
      case 3:
        _ = 512;
        break;
      case 4:
        _ = 4096;
        break;
      case 0:
        if (K[1] == 0) return M0(v, T);
      default:
        throw new Error("Major Version: Expected 3 or 4 saw " + g);
    }
    _ !== 512 && (H = /*::(*/
    v.slice(0, _), $e(
      H,
      28
      /* blob.l */
    ));
    var Q = v.slice(0, _);
    x(H, g);
    var ie = H.read_shift(4, "i");
    if (g === 3 && ie !== 0) throw new Error("# Directory Sectors: Expected 0 saw " + ie);
    H.l += 4, M = H.read_shift(4, "i"), H.l += 4, H.chk("00100000", "Mini Stream Cutoff Size: "), X = H.read_shift(4, "i"), k = H.read_shift(4, "i"), P = H.read_shift(4, "i"), w = H.read_shift(4, "i");
    for (var Z = -1, te = 0; te < 109 && (Z = H.read_shift(4, "i"), !(Z < 0)); ++te)
      B[te] = Z;
    var xe = d(v, _);
    m(P, w, xe, _, B);
    var ye = y(xe, M, B, _);
    ye[M].name = "!Directory", k > 0 && X !== J && (ye[X].name = "!MiniFAT"), ye[B[0]].name = "!FAT", ye.fat_addrs = B, ye.ssz = _;
    var De = {}, je = [], Oa = [], Na = [];
    E(M, ye, xe, je, k, De, Oa, X), p(Oa, Na, je), je.shift();
    var Ia = {
      FileIndex: Oa,
      FullPaths: Na
    };
    return T && T.raw && (Ia.raw = { header: Q, sectors: xe }), Ia;
  }
  function u(v) {
    if (v[v.l] == 80 && v[v.l + 1] == 75) return [0, 0];
    v.chk(fe, "Header Signature: "), v.l += 16;
    var T = v.read_shift(2, "u");
    return [v.read_shift(2, "u"), T];
  }
  function x(v, T) {
    var g = 9;
    switch (v.l += 2, g = v.read_shift(2)) {
      case 9:
        if (T != 3) throw new Error("Sector Shift: Expected 9 saw " + g);
        break;
      case 12:
        if (T != 4) throw new Error("Sector Shift: Expected 12 saw " + g);
        break;
      default:
        throw new Error("Sector Shift: Expected 9 or 12 saw " + g);
    }
    v.chk("0600", "Mini Sector Shift: "), v.chk("000000000000", "Reserved: ");
  }
  function d(v, T) {
    for (var g = Math.ceil(v.length / T) - 1, _ = [], k = 1; k < g; ++k) _[k - 1] = v.slice(k * T, (k + 1) * T);
    return _[g - 1] = v.slice(g * T), _;
  }
  function p(v, T, g) {
    for (var _ = 0, k = 0, w = 0, M = 0, X = 0, P = g.length, B = [], H = []; _ < P; ++_)
      B[_] = H[_] = _, T[_] = g[_];
    for (; X < H.length; ++X)
      _ = H[X], k = v[_].L, w = v[_].R, M = v[_].C, B[_] === _ && (k !== -1 && B[k] !== k && (B[_] = B[k]), w !== -1 && B[w] !== w && (B[_] = B[w])), M !== -1 && (B[M] = _), k !== -1 && _ != B[_] && (B[k] = B[_], H.lastIndexOf(k) < X && H.push(k)), w !== -1 && _ != B[_] && (B[w] = B[_], H.lastIndexOf(w) < X && H.push(w));
    for (_ = 1; _ < P; ++_) B[_] === _ && (w !== -1 && B[w] !== w ? B[_] = B[w] : k !== -1 && B[k] !== k && (B[_] = B[k]));
    for (_ = 1; _ < P; ++_)
      if (v[_].type !== 0) {
        if (X = _, X != B[X]) do
          X = B[X], T[_] = T[X] + "/" + T[_];
        while (X !== 0 && B[X] !== -1 && X != B[X]);
        B[_] = -1;
      }
    for (T[0] += "/", _ = 1; _ < P; ++_)
      v[_].type !== 2 && (T[_] += "/");
  }
  function h(v, T, g) {
    for (var _ = v.start, k = v.size, w = [], M = _; g && k > 0 && M >= 0; )
      w.push(T.slice(M * L, M * L + L)), k -= L, M = aa(g, M * 4);
    return w.length === 0 ? We(0) : Yr(w).slice(0, v.size);
  }
  function m(v, T, g, _, k) {
    var w = J;
    if (v === J) {
      if (T !== 0) throw new Error("DIFAT chain shorter than expected");
    } else if (v !== -1) {
      var M = g[v], X = (_ >>> 2) - 1;
      if (!M) return;
      for (var P = 0; P < X && (w = aa(M, P * 4)) !== J; ++P)
        k.push(w);
      m(aa(M, _ - 4), T - 1, g, _, k);
    }
  }
  function A(v, T, g, _, k) {
    var w = [], M = [];
    k || (k = []);
    var X = _ - 1, P = 0, B = 0;
    for (P = T; P >= 0; ) {
      k[P] = !0, w[w.length] = P, M.push(v[P]);
      var H = g[Math.floor(P * 4 / _)];
      if (B = P * 4 & X, _ < 4 + B) throw new Error("FAT boundary crossed: " + P + " 4 " + _);
      if (!v[H]) break;
      P = aa(v[H], B);
    }
    return { nodes: w, data: tn([M]) };
  }
  function y(v, T, g, _) {
    var k = v.length, w = [], M = [], X = [], P = [], B = _ - 1, H = 0, K = 0, Q = 0, ie = 0;
    for (H = 0; H < k; ++H)
      if (X = [], Q = H + T, Q >= k && (Q -= k), !M[Q]) {
        P = [];
        var Z = [];
        for (K = Q; K >= 0; ) {
          Z[K] = !0, M[K] = !0, X[X.length] = K, P.push(v[K]);
          var te = g[Math.floor(K * 4 / _)];
          if (ie = K * 4 & B, _ < 4 + ie) throw new Error("FAT boundary crossed: " + K + " 4 " + _);
          if (!v[te] || (K = aa(v[te], ie), Z[K])) break;
        }
        w[Q] = { nodes: X, data: tn([P]) };
      }
    return w;
  }
  function E(v, T, g, _, k, w, M, X) {
    for (var P = 0, B = _.length ? 2 : 0, H = T[v].data, K = 0, Q = 0, ie; K < H.length; K += 128) {
      var Z = (
        /*::(*/
        H.slice(K, K + 128)
      );
      $e(Z, 64), Q = Z.read_shift(2), ie = p0(Z, 0, Q - B), _.push(ie);
      var te = {
        name: ie,
        type: Z.read_shift(1),
        color: Z.read_shift(1),
        L: Z.read_shift(4, "i"),
        R: Z.read_shift(4, "i"),
        C: Z.read_shift(4, "i"),
        clsid: Z.read_shift(16),
        state: Z.read_shift(4, "i"),
        start: 0,
        size: 0
      }, xe = Z.read_shift(2) + Z.read_shift(2) + Z.read_shift(2) + Z.read_shift(2);
      xe !== 0 && (te.ct = I(Z, Z.l - 8));
      var ye = Z.read_shift(2) + Z.read_shift(2) + Z.read_shift(2) + Z.read_shift(2);
      ye !== 0 && (te.mt = I(Z, Z.l - 8)), te.start = Z.read_shift(4, "i"), te.size = Z.read_shift(4, "i"), te.size < 0 && te.start < 0 && (te.size = te.type = 0, te.start = J, te.name = ""), te.type === 5 ? (P = te.start, k > 0 && P !== J && (T[P].name = "!StreamData")) : te.size >= 4096 ? (te.storage = "fat", T[te.start] === void 0 && (T[te.start] = A(g, te.start, T.fat_addrs, T.ssz)), T[te.start].name = te.name, te.content = T[te.start].data.slice(0, te.size)) : (te.storage = "minifat", te.size < 0 ? te.size = 0 : P !== J && te.start !== J && T[P] && (te.content = h(te, T[P].data, (T[X] || {}).data))), te.content && $e(te.content, 0), w[ie] = te, M.push(te);
    }
  }
  function I(v, T) {
    return new Date((ur(v, T + 4) / 1e7 * Math.pow(2, 32) + ur(v, T) / 1e7 - 11644473600) * 1e3);
  }
  function b(v, T) {
    return o(), l(f.readFileSync(v), T);
  }
  function O(v, T) {
    var g = T && T.type;
    switch (g || ge && Buffer.isBuffer(v) && (g = "buffer"), g || "base64") {
      case "file":
        return b(v, T);
      case "base64":
        return l(wr(xr(v)), T);
      case "binary":
        return l(wr(v), T);
    }
    return l(
      /*::typeof blob == 'string' ? new Buffer(blob, 'utf-8') : */
      v,
      T
    );
  }
  function F(v, T) {
    var g = T || {}, _ = g.root || "Root Entry";
    if (v.FullPaths || (v.FullPaths = []), v.FileIndex || (v.FileIndex = []), v.FullPaths.length !== v.FileIndex.length) throw new Error("inconsistent CFB structure");
    v.FullPaths.length === 0 && (v.FullPaths[0] = _ + "/", v.FileIndex[0] = { name: _, type: 5 }), g.CLSID && (v.FileIndex[0].clsid = g.CLSID), W(v);
  }
  function W(v) {
    var T = "Sh33tJ5";
    if (!Ee.find(v, "/" + T)) {
      var g = We(4);
      g[0] = 55, g[1] = g[3] = 50, g[2] = 54, v.FileIndex.push({ name: T, type: 2, content: g, size: 4, L: 69, R: 69, C: 69 }), v.FullPaths.push(v.FullPaths[0] + T), D(v);
    }
  }
  function D(v, T) {
    F(v);
    for (var g = !1, _ = !1, k = v.FullPaths.length - 1; k >= 0; --k) {
      var w = v.FileIndex[k];
      switch (w.type) {
        case 0:
          _ ? g = !0 : (v.FileIndex.pop(), v.FullPaths.pop());
          break;
        case 1:
        case 2:
        case 5:
          _ = !0, isNaN(w.R * w.L * w.C) && (g = !0), w.R > -1 && w.L > -1 && w.R == w.L && (g = !0);
          break;
        default:
          g = !0;
          break;
      }
    }
    if (!(!g && !T)) {
      var M = new Date(1987, 1, 19), X = 0, P = Object.create ? /* @__PURE__ */ Object.create(null) : {}, B = [];
      for (k = 0; k < v.FullPaths.length; ++k)
        P[v.FullPaths[k]] = !0, v.FileIndex[k].type !== 0 && B.push([v.FullPaths[k], v.FileIndex[k]]);
      for (k = 0; k < B.length; ++k) {
        var H = t(B[k][0]);
        _ = P[H], _ || (B.push([H, {
          name: n(H).replace("/", ""),
          type: 1,
          clsid: ce,
          ct: M,
          mt: M,
          content: null
        }]), P[H] = !0);
      }
      for (B.sort(function(ie, Z) {
        return r(ie[0], Z[0]);
      }), v.FullPaths = [], v.FileIndex = [], k = 0; k < B.length; ++k)
        v.FullPaths[k] = B[k][0], v.FileIndex[k] = B[k][1];
      for (k = 0; k < B.length; ++k) {
        var K = v.FileIndex[k], Q = v.FullPaths[k];
        if (K.name = n(Q).replace("/", ""), K.L = K.R = K.C = -(K.color = 1), K.size = K.content ? K.content.length : 0, K.start = 0, K.clsid = K.clsid || ce, k === 0)
          K.C = B.length > 1 ? 1 : -1, K.size = 0, K.type = 5;
        else if (Q.slice(-1) == "/") {
          for (X = k + 1; X < B.length && t(v.FullPaths[X]) != Q; ++X) ;
          for (K.C = X >= B.length ? -1 : X, X = k + 1; X < B.length && t(v.FullPaths[X]) != t(Q); ++X) ;
          K.R = X >= B.length ? -1 : X, K.type = 1;
        } else
          t(v.FullPaths[k + 1] || "") == t(Q) && (K.R = k + 1), K.type = 2;
      }
    }
  }
  function z(v, T) {
    var g = T || {};
    if (g.fileType == "mad") return zs(v, g);
    switch (D(v), g.fileType) {
      case "zip":
        return Bs(v, g);
    }
    var _ = function(ie) {
      for (var Z = 0, te = 0, xe = 0; xe < ie.FileIndex.length; ++xe) {
        var ye = ie.FileIndex[xe];
        if (ye.content) {
          var De = ye.content.length;
          De > 0 && (De < 4096 ? Z += De + 63 >> 6 : te += De + 511 >> 9);
        }
      }
      for (var je = ie.FullPaths.length + 3 >> 2, Oa = Z + 7 >> 3, Na = Z + 127 >> 7, Ia = Oa + te + je + Na, ra = Ia + 127 >> 7, Mt = ra <= 109 ? 0 : Math.ceil((ra - 109) / 127); Ia + ra + Mt + 127 >> 7 > ra; ) Mt = ++ra <= 109 ? 0 : Math.ceil((ra - 109) / 127);
      var Mr = [1, Mt, ra, Na, je, te, Z, 0];
      return ie.FileIndex[0].size = Z << 6, Mr[7] = (ie.FileIndex[0].start = Mr[0] + Mr[1] + Mr[2] + Mr[3] + Mr[4] + Mr[5]) + (Mr[6] + 7 >> 3), Mr;
    }(v), k = We(_[7] << 9), w = 0, M = 0;
    {
      for (w = 0; w < 8; ++w) k.write_shift(1, re[w]);
      for (w = 0; w < 8; ++w) k.write_shift(2, 0);
      for (k.write_shift(2, 62), k.write_shift(2, 3), k.write_shift(2, 65534), k.write_shift(2, 9), k.write_shift(2, 6), w = 0; w < 3; ++w) k.write_shift(2, 0);
      for (k.write_shift(4, 0), k.write_shift(4, _[2]), k.write_shift(4, _[0] + _[1] + _[2] + _[3] - 1), k.write_shift(4, 0), k.write_shift(4, 4096), k.write_shift(4, _[3] ? _[0] + _[1] + _[2] - 1 : J), k.write_shift(4, _[3]), k.write_shift(-4, _[1] ? _[0] - 1 : J), k.write_shift(4, _[1]), w = 0; w < 109; ++w) k.write_shift(-4, w < _[2] ? _[1] + w : -1);
    }
    if (_[1])
      for (M = 0; M < _[1]; ++M) {
        for (; w < 236 + M * 127; ++w) k.write_shift(-4, w < _[2] ? _[1] + w : -1);
        k.write_shift(-4, M === _[1] - 1 ? J : M + 1);
      }
    var X = function(ie) {
      for (M += ie; w < M - 1; ++w) k.write_shift(-4, w + 1);
      ie && (++w, k.write_shift(-4, J));
    };
    for (M = w = 0, M += _[1]; w < M; ++w) k.write_shift(-4, se.DIFSECT);
    for (M += _[2]; w < M; ++w) k.write_shift(-4, se.FATSECT);
    X(_[3]), X(_[4]);
    for (var P = 0, B = 0, H = v.FileIndex[0]; P < v.FileIndex.length; ++P)
      H = v.FileIndex[P], H.content && (B = H.content.length, !(B < 4096) && (H.start = M, X(B + 511 >> 9)));
    for (X(_[6] + 7 >> 3); k.l & 511; ) k.write_shift(-4, se.ENDOFCHAIN);
    for (M = w = 0, P = 0; P < v.FileIndex.length; ++P)
      H = v.FileIndex[P], H.content && (B = H.content.length, !(!B || B >= 4096) && (H.start = M, X(B + 63 >> 6)));
    for (; k.l & 511; ) k.write_shift(-4, se.ENDOFCHAIN);
    for (w = 0; w < _[4] << 2; ++w) {
      var K = v.FullPaths[w];
      if (!K || K.length === 0) {
        for (P = 0; P < 17; ++P) k.write_shift(4, 0);
        for (P = 0; P < 3; ++P) k.write_shift(4, -1);
        for (P = 0; P < 12; ++P) k.write_shift(4, 0);
        continue;
      }
      H = v.FileIndex[w], w === 0 && (H.start = H.size ? H.start - 1 : J);
      var Q = w === 0 && g.root || H.name;
      if (B = 2 * (Q.length + 1), k.write_shift(64, Q, "utf16le"), k.write_shift(2, B), k.write_shift(1, H.type), k.write_shift(1, H.color), k.write_shift(-4, H.L), k.write_shift(-4, H.R), k.write_shift(-4, H.C), H.clsid) k.write_shift(16, H.clsid, "hex");
      else for (P = 0; P < 4; ++P) k.write_shift(4, 0);
      k.write_shift(4, H.state || 0), k.write_shift(4, 0), k.write_shift(4, 0), k.write_shift(4, 0), k.write_shift(4, 0), k.write_shift(4, H.start), k.write_shift(4, H.size), k.write_shift(4, 0);
    }
    for (w = 1; w < v.FileIndex.length; ++w)
      if (H = v.FileIndex[w], H.size >= 4096)
        if (k.l = H.start + 1 << 9, ge && Buffer.isBuffer(H.content))
          H.content.copy(k, k.l, 0, H.size), k.l += H.size + 511 & -512;
        else {
          for (P = 0; P < H.size; ++P) k.write_shift(1, H.content[P]);
          for (; P & 511; ++P) k.write_shift(1, 0);
        }
    for (w = 1; w < v.FileIndex.length; ++w)
      if (H = v.FileIndex[w], H.size > 0 && H.size < 4096)
        if (ge && Buffer.isBuffer(H.content))
          H.content.copy(k, k.l, 0, H.size), k.l += H.size + 63 & -64;
        else {
          for (P = 0; P < H.size; ++P) k.write_shift(1, H.content[P]);
          for (; P & 63; ++P) k.write_shift(1, 0);
        }
    if (ge)
      k.l = k.length;
    else
      for (; k.l < k.length; ) k.write_shift(1, 0);
    return k;
  }
  function G(v, T) {
    var g = v.FullPaths.map(function(P) {
      return P.toUpperCase();
    }), _ = g.map(function(P) {
      var B = P.split("/");
      return B[B.length - (P.slice(-1) == "/" ? 2 : 1)];
    }), k = !1;
    T.charCodeAt(0) === 47 ? (k = !0, T = g[0].slice(0, -1) + T) : k = T.indexOf("/") !== -1;
    var w = T.toUpperCase(), M = k === !0 ? g.indexOf(w) : _.indexOf(w);
    if (M !== -1) return v.FileIndex[M];
    var X = !w.match(Pa);
    for (w = w.replace(cr, ""), X && (w = w.replace(Pa, "!")), M = 0; M < g.length; ++M)
      if ((X ? g[M].replace(Pa, "!") : g[M]).replace(cr, "") == w || (X ? _[M].replace(Pa, "!") : _[M]).replace(cr, "") == w) return v.FileIndex[M];
    return null;
  }
  var L = 64, J = -2, fe = "d0cf11e0a1b11ae1", re = [208, 207, 17, 224, 161, 177, 26, 225], ce = "00000000000000000000000000000000", se = {
    /* 2.1 Compund File Sector Numbers and Types */
    MAXREGSECT: -6,
    DIFSECT: -4,
    FATSECT: -3,
    ENDOFCHAIN: J,
    FREESECT: -1,
    /* 2.2 Compound File Header */
    HEADER_SIGNATURE: fe,
    HEADER_MINOR_VERSION: "3e00",
    MAXREGSID: -6,
    NOSTREAM: -1,
    HEADER_CLSID: ce,
    /* 2.6.1 Compound File Directory Entry */
    EntryTypes: ["unknown", "storage", "stream", "lockbytes", "property", "root"]
  };
  function Se(v, T, g) {
    o();
    var _ = z(v, g);
    f.writeFileSync(T, _);
  }
  function V(v) {
    for (var T = new Array(v.length), g = 0; g < v.length; ++g) T[g] = String.fromCharCode(v[g]);
    return T.join("");
  }
  function le(v, T) {
    var g = z(v, T);
    switch (T && T.type || "buffer") {
      case "file":
        return o(), f.writeFileSync(T.filename, g), g;
      case "binary":
        return typeof g == "string" ? g : V(g);
      case "base64":
        return U0(typeof g == "string" ? g : V(g));
      case "buffer":
        if (ge) return Buffer.isBuffer(g) ? g : ua(g);
      case "array":
        return typeof g == "string" ? wr(g) : g;
    }
    return g;
  }
  var ue;
  function S(v) {
    try {
      var T = v.InflateRaw, g = new T();
      if (g._processChunk(new Uint8Array([3, 0]), g._finishFlushFlag), g.bytesRead) ue = v;
      else throw new Error("zlib does not expose bytesRead");
    } catch (_) {
      console.error("cannot use native zlib: " + (_.message || _));
    }
  }
  function U(v, T) {
    if (!ue) return L0(v, T);
    var g = ue.InflateRaw, _ = new g(), k = _._processChunk(v.slice(v.l), _._finishFlushFlag);
    return v.l += _.bytesRead, k;
  }
  function N(v) {
    return ue ? ue.deflateRawSync(v) : ve(v);
  }
  var R = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15], Y = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258], ee = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  function ne(v) {
    var T = (v << 1 | v << 11) & 139536 | (v << 5 | v << 15) & 558144;
    return (T >> 16 | T >> 8 | T) & 255;
  }
  for (var q = typeof Uint8Array < "u", j = q ? new Uint8Array(256) : [], Te = 0; Te < 256; ++Te) j[Te] = ne(Te);
  function C(v, T) {
    var g = j[v & 255];
    return T <= 8 ? g >>> 8 - T : (g = g << 8 | j[v >> 8 & 255], T <= 16 ? g >>> 16 - T : (g = g << 8 | j[v >> 16 & 255], g >>> 24 - T));
  }
  function Ie(v, T) {
    var g = T & 7, _ = T >>> 3;
    return (v[_] | (g <= 6 ? 0 : v[_ + 1] << 8)) >>> g & 3;
  }
  function we(v, T) {
    var g = T & 7, _ = T >>> 3;
    return (v[_] | (g <= 5 ? 0 : v[_ + 1] << 8)) >>> g & 7;
  }
  function Ae(v, T) {
    var g = T & 7, _ = T >>> 3;
    return (v[_] | (g <= 4 ? 0 : v[_ + 1] << 8)) >>> g & 15;
  }
  function me(v, T) {
    var g = T & 7, _ = T >>> 3;
    return (v[_] | (g <= 3 ? 0 : v[_ + 1] << 8)) >>> g & 31;
  }
  function ae(v, T) {
    var g = T & 7, _ = T >>> 3;
    return (v[_] | (g <= 1 ? 0 : v[_ + 1] << 8)) >>> g & 127;
  }
  function Le(v, T, g) {
    var _ = T & 7, k = T >>> 3, w = (1 << g) - 1, M = v[k] >>> _;
    return g < 8 - _ || (M |= v[k + 1] << 8 - _, g < 16 - _) || (M |= v[k + 2] << 16 - _, g < 24 - _) || (M |= v[k + 3] << 24 - _), M & w;
  }
  function dr(v, T, g) {
    var _ = T & 7, k = T >>> 3;
    return _ <= 5 ? v[k] |= (g & 7) << _ : (v[k] |= g << _ & 255, v[k + 1] = (g & 7) >> 8 - _), T + 3;
  }
  function Cr(v, T, g) {
    var _ = T & 7, k = T >>> 3;
    return g = (g & 1) << _, v[k] |= g, T + 1;
  }
  function Lr(v, T, g) {
    var _ = T & 7, k = T >>> 3;
    return g <<= _, v[k] |= g & 255, g >>>= 8, v[k + 1] = g, T + 8;
  }
  function Da(v, T, g) {
    var _ = T & 7, k = T >>> 3;
    return g <<= _, v[k] |= g & 255, g >>>= 8, v[k + 1] = g & 255, v[k + 2] = g >>> 8, T + 16;
  }
  function Gr(v, T) {
    var g = v.length, _ = 2 * g > T ? 2 * g : T + 5, k = 0;
    if (g >= T) return v;
    if (ge) {
      var w = H0(_);
      if (v.copy) v.copy(w);
      else for (; k < v.length; ++k) w[k] = v[k];
      return w;
    } else if (q) {
      var M = new Uint8Array(_);
      if (M.set) M.set(v);
      else for (; k < g; ++k) M[k] = v[k];
      return M;
    }
    return v.length = _, v;
  }
  function lr(v) {
    for (var T = new Array(v), g = 0; g < v; ++g) T[g] = 0;
    return T;
  }
  function Pr(v, T, g) {
    var _ = 1, k = 0, w = 0, M = 0, X = 0, P = v.length, B = q ? new Uint16Array(32) : lr(32);
    for (w = 0; w < 32; ++w) B[w] = 0;
    for (w = P; w < g; ++w) v[w] = 0;
    P = v.length;
    var H = q ? new Uint16Array(P) : lr(P);
    for (w = 0; w < P; ++w)
      B[k = v[w]]++, _ < k && (_ = k), H[w] = 0;
    for (B[0] = 0, w = 1; w <= _; ++w) B[w + 16] = X = X + B[w - 1] << 1;
    for (w = 0; w < P; ++w)
      X = v[w], X != 0 && (H[w] = B[X + 16]++);
    var K = 0;
    for (w = 0; w < P; ++w)
      if (K = v[w], K != 0)
        for (X = C(H[w], _) >> _ - K, M = (1 << _ + 4 - K) - 1; M >= 0; --M)
          T[X | M << K] = K & 15 | w << 4;
    return _;
  }
  var Xr = q ? new Uint16Array(512) : lr(512), Ra = q ? new Uint16Array(32) : lr(32);
  if (!q) {
    for (var tr = 0; tr < 512; ++tr) Xr[tr] = 0;
    for (tr = 0; tr < 32; ++tr) Ra[tr] = 0;
  }
  (function() {
    for (var v = [], T = 0; T < 32; T++) v.push(5);
    Pr(v, Ra, 32);
    var g = [];
    for (T = 0; T <= 143; T++) g.push(8);
    for (; T <= 255; T++) g.push(9);
    for (; T <= 279; T++) g.push(7);
    for (; T <= 287; T++) g.push(8);
    Pr(g, Xr, 288);
  })();
  var yr = /* @__PURE__ */ function() {
    for (var T = q ? new Uint8Array(32768) : [], g = 0, _ = 0; g < ee.length - 1; ++g)
      for (; _ < ee[g + 1]; ++_) T[_] = g;
    for (; _ < 32768; ++_) T[_] = 29;
    var k = q ? new Uint8Array(259) : [];
    for (g = 0, _ = 0; g < Y.length - 1; ++g)
      for (; _ < Y[g + 1]; ++_) k[_] = g;
    function w(X, P) {
      for (var B = 0; B < X.length; ) {
        var H = Math.min(65535, X.length - B), K = B + H == X.length;
        for (P.write_shift(1, +K), P.write_shift(2, H), P.write_shift(2, ~H & 65535); H-- > 0; ) P[P.l++] = X[B++];
      }
      return P.l;
    }
    function M(X, P) {
      for (var B = 0, H = 0, K = q ? new Uint16Array(32768) : []; H < X.length; ) {
        var Q = (
          /* data.length - boff; */
          Math.min(65535, X.length - H)
        );
        if (Q < 10) {
          for (B = dr(P, B, +(H + Q == X.length)), B & 7 && (B += 8 - (B & 7)), P.l = B / 8 | 0, P.write_shift(2, Q), P.write_shift(2, ~Q & 65535); Q-- > 0; ) P[P.l++] = X[H++];
          B = P.l * 8;
          continue;
        }
        B = dr(P, B, +(H + Q == X.length) + 2);
        for (var ie = 0; Q-- > 0; ) {
          var Z = X[H];
          ie = (ie << 5 ^ Z) & 32767;
          var te = -1, xe = 0;
          if ((te = K[ie]) && (te |= H & -32768, te > H && (te -= 32768), te < H))
            for (; X[te + xe] == X[H + xe] && xe < 250; ) ++xe;
          if (xe > 2) {
            Z = k[xe], Z <= 22 ? B = Lr(P, B, j[Z + 1] >> 1) - 1 : (Lr(P, B, 3), B += 5, Lr(P, B, j[Z - 23] >> 5), B += 3);
            var ye = Z < 8 ? 0 : Z - 4 >> 2;
            ye > 0 && (Da(P, B, xe - Y[Z]), B += ye), Z = T[H - te], B = Lr(P, B, j[Z] >> 3), B -= 3;
            var De = Z < 4 ? 0 : Z - 2 >> 1;
            De > 0 && (Da(P, B, H - te - ee[Z]), B += De);
            for (var je = 0; je < xe; ++je)
              K[ie] = H & 32767, ie = (ie << 5 ^ X[H]) & 32767, ++H;
            Q -= xe - 1;
          } else
            Z <= 143 ? Z = Z + 48 : B = Cr(P, B, 1), B = Lr(P, B, j[Z]), K[ie] = H & 32767, ++H;
        }
        B = Lr(P, B, 0) - 1;
      }
      return P.l = (B + 7) / 8 | 0, P.l;
    }
    return function(P, B) {
      return P.length < 8 ? w(P, B) : M(P, B);
    };
  }();
  function ve(v) {
    var T = We(50 + Math.floor(v.length * 1.1)), g = yr(v, T);
    return T.slice(0, g);
  }
  var Pe = q ? new Uint16Array(32768) : lr(32768), pr = q ? new Uint16Array(32768) : lr(32768), He = q ? new Uint16Array(128) : lr(128), ea = 1, I0 = 1;
  function Ps(v, T) {
    var g = me(v, T) + 257;
    T += 5;
    var _ = me(v, T) + 1;
    T += 5;
    var k = Ae(v, T) + 4;
    T += 4;
    for (var w = 0, M = q ? new Uint8Array(19) : lr(19), X = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], P = 1, B = q ? new Uint8Array(8) : lr(8), H = q ? new Uint8Array(8) : lr(8), K = M.length, Q = 0; Q < k; ++Q)
      M[R[Q]] = w = we(v, T), P < w && (P = w), B[w]++, T += 3;
    var ie = 0;
    for (B[0] = 0, Q = 1; Q <= P; ++Q) H[Q] = ie = ie + B[Q - 1] << 1;
    for (Q = 0; Q < K; ++Q) (ie = M[Q]) != 0 && (X[Q] = H[ie]++);
    var Z = 0;
    for (Q = 0; Q < K; ++Q)
      if (Z = M[Q], Z != 0) {
        ie = j[X[Q]] >> 8 - Z;
        for (var te = (1 << 7 - Z) - 1; te >= 0; --te) He[ie | te << Z] = Z & 7 | Q << 3;
      }
    var xe = [];
    for (P = 1; xe.length < g + _; )
      switch (ie = He[ae(v, T)], T += ie & 7, ie >>>= 3) {
        case 16:
          for (w = 3 + Ie(v, T), T += 2, ie = xe[xe.length - 1]; w-- > 0; ) xe.push(ie);
          break;
        case 17:
          for (w = 3 + we(v, T), T += 3; w-- > 0; ) xe.push(0);
          break;
        case 18:
          for (w = 11 + ae(v, T), T += 7; w-- > 0; ) xe.push(0);
          break;
        default:
          xe.push(ie), P < ie && (P = ie);
          break;
      }
    var ye = xe.slice(0, g), De = xe.slice(g);
    for (Q = g; Q < 286; ++Q) ye[Q] = 0;
    for (Q = _; Q < 30; ++Q) De[Q] = 0;
    return ea = Pr(ye, Pe, 286), I0 = Pr(De, pr, 30), T;
  }
  function Ms(v, T) {
    if (v[0] == 3 && !(v[1] & 3))
      return [Zr(T), 2];
    for (var g = 0, _ = 0, k = H0(T || 1 << 18), w = 0, M = k.length >>> 0, X = 0, P = 0; !(_ & 1); ) {
      if (_ = we(v, g), g += 3, _ >>> 1)
        _ >> 1 == 1 ? (X = 9, P = 5) : (g = Ps(v, g), X = ea, P = I0);
      else {
        g & 7 && (g += 8 - (g & 7));
        var B = v[g >>> 3] | v[(g >>> 3) + 1] << 8;
        if (g += 32, B > 0)
          for (!T && M < w + B && (k = Gr(k, w + B), M = k.length); B-- > 0; )
            k[w++] = v[g >>> 3], g += 8;
        continue;
      }
      for (; ; ) {
        !T && M < w + 32767 && (k = Gr(k, w + 32767), M = k.length);
        var H = Le(v, g, X), K = _ >>> 1 == 1 ? Xr[H] : Pe[H];
        if (g += K & 15, K >>>= 4, !(K >>> 8 & 255)) k[w++] = K;
        else {
          if (K == 256) break;
          K -= 257;
          var Q = K < 8 ? 0 : K - 4 >> 2;
          Q > 5 && (Q = 0);
          var ie = w + Y[K];
          Q > 0 && (ie += Le(v, g, Q), g += Q), H = Le(v, g, P), K = _ >>> 1 == 1 ? Ra[H] : pr[H], g += K & 15, K >>>= 4;
          var Z = K < 4 ? 0 : K - 2 >> 1, te = ee[K];
          for (Z > 0 && (te += Le(v, g, Z), g += Z), !T && M < ie && (k = Gr(k, ie + 100), M = k.length); w < ie; )
            k[w] = k[w - te], ++w;
        }
      }
    }
    return T ? [k, g + 7 >>> 3] : [k.slice(0, w), g + 7 >>> 3];
  }
  function L0(v, T) {
    var g = v.slice(v.l || 0), _ = Ms(g, T);
    return v.l += _[1], _[0];
  }
  function P0(v, T) {
    if (v)
      typeof console < "u" && console.error(T);
    else throw new Error(T);
  }
  function M0(v, T) {
    var g = (
      /*::(*/
      v
    );
    $e(g, 0);
    var _ = [], k = [], w = {
      FileIndex: _,
      FullPaths: k
    };
    F(w, { root: T.root });
    for (var M = g.length - 4; (g[M] != 80 || g[M + 1] != 75 || g[M + 2] != 5 || g[M + 3] != 6) && M >= 0; ) --M;
    g.l = M + 4, g.l += 4;
    var X = g.read_shift(2);
    g.l += 6;
    var P = g.read_shift(4);
    for (g.l = P, M = 0; M < X; ++M) {
      g.l += 20;
      var B = g.read_shift(4), H = g.read_shift(4), K = g.read_shift(2), Q = g.read_shift(2), ie = g.read_shift(2);
      g.l += 8;
      var Z = g.read_shift(4), te = c(
        /*::(*/
        g.slice(g.l + K, g.l + K + Q)
        /*:: :any)*/
      );
      g.l += K + Q + ie;
      var xe = g.l;
      g.l = Z + 4, bs(g, B, H, w, te), g.l = xe;
    }
    return w;
  }
  function bs(v, T, g, _, k) {
    v.l += 2;
    var w = v.read_shift(2), M = v.read_shift(2), X = s(v);
    if (w & 8257) throw new Error("Unsupported ZIP encryption");
    for (var P = v.read_shift(4), B = v.read_shift(4), H = v.read_shift(4), K = v.read_shift(2), Q = v.read_shift(2), ie = "", Z = 0; Z < K; ++Z) ie += String.fromCharCode(v[v.l++]);
    if (Q) {
      var te = c(
        /*::(*/
        v.slice(v.l, v.l + Q)
        /*:: :any)*/
      );
      (te[21589] || {}).mt && (X = te[21589].mt), ((k || {})[21589] || {}).mt && (X = k[21589].mt);
    }
    v.l += Q;
    var xe = v.slice(v.l, v.l + B);
    switch (M) {
      case 8:
        xe = U(v, H);
        break;
      case 0:
        break;
      default:
        throw new Error("Unsupported ZIP Compression method " + M);
    }
    var ye = !1;
    w & 8 && (P = v.read_shift(4), P == 134695760 && (P = v.read_shift(4), ye = !0), B = v.read_shift(4), H = v.read_shift(4)), B != T && P0(ye, "Bad compressed size: " + T + " != " + B), H != g && P0(ye, "Bad uncompressed size: " + g + " != " + H), Pt(_, ie, xe, { unsafe: !0, mt: X });
  }
  function Bs(v, T) {
    var g = T || {}, _ = [], k = [], w = We(1), M = g.compression ? 8 : 0, X = 0, P = 0, B = 0, H = 0, K = 0, Q = v.FullPaths[0], ie = Q, Z = v.FileIndex[0], te = [], xe = 0;
    for (P = 1; P < v.FullPaths.length; ++P)
      if (ie = v.FullPaths[P].slice(Q.length), Z = v.FileIndex[P], !(!Z.size || !Z.content || ie == "Sh33tJ5")) {
        var ye = H, De = We(ie.length);
        for (B = 0; B < ie.length; ++B) De.write_shift(1, ie.charCodeAt(B) & 127);
        De = De.slice(0, De.l), te[K] = Pc.buf(
          /*::((*/
          Z.content,
          0
        );
        var je = Z.content;
        M == 8 && (je = N(je)), w = We(30), w.write_shift(4, 67324752), w.write_shift(2, 20), w.write_shift(2, X), w.write_shift(2, M), Z.mt ? i(w, Z.mt) : w.write_shift(4, 0), w.write_shift(-4, te[K]), w.write_shift(4, je.length), w.write_shift(
          4,
          /*::(*/
          Z.content.length
        ), w.write_shift(2, De.length), w.write_shift(2, 0), H += w.length, _.push(w), H += De.length, _.push(De), H += je.length, _.push(je), w = We(46), w.write_shift(4, 33639248), w.write_shift(2, 0), w.write_shift(2, 20), w.write_shift(2, X), w.write_shift(2, M), w.write_shift(4, 0), w.write_shift(-4, te[K]), w.write_shift(4, je.length), w.write_shift(
          4,
          /*::(*/
          Z.content.length
        ), w.write_shift(2, De.length), w.write_shift(2, 0), w.write_shift(2, 0), w.write_shift(2, 0), w.write_shift(2, 0), w.write_shift(4, 0), w.write_shift(4, ye), xe += w.l, k.push(w), xe += De.length, k.push(De), ++K;
      }
    return w = We(22), w.write_shift(4, 101010256), w.write_shift(2, 0), w.write_shift(2, 0), w.write_shift(2, K), w.write_shift(2, K), w.write_shift(4, xe), w.write_shift(4, H), w.write_shift(2, 0), Yr([Yr(_), Yr(k), w]);
  }
  var ft = {
    htm: "text/html",
    xml: "text/xml",
    gif: "image/gif",
    jpg: "image/jpeg",
    png: "image/png",
    mso: "application/x-mso",
    thmx: "application/vnd.ms-officetheme",
    sh33tj5: "application/octet-stream"
  };
  function Us(v, T) {
    if (v.ctype) return v.ctype;
    var g = v.name || "", _ = g.match(/\.([^\.]+)$/);
    return _ && ft[_[1]] || T && (_ = (g = T).match(/[\.\\]([^\.\\])+$/), _ && ft[_[1]]) ? ft[_[1]] : "application/octet-stream";
  }
  function Hs(v) {
    for (var T = U0(v), g = [], _ = 0; _ < T.length; _ += 76) g.push(T.slice(_, _ + 76));
    return g.join(`\r
`) + `\r
`;
  }
  function Ws(v) {
    var T = v.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7E-\xFF=]/g, function(B) {
      var H = B.charCodeAt(0).toString(16).toUpperCase();
      return "=" + (H.length == 1 ? "0" + H : H);
    });
    T = T.replace(/ $/mg, "=20").replace(/\t$/mg, "=09"), T.charAt(0) == `
` && (T = "=0D" + T.slice(1)), T = T.replace(/\r(?!\n)/mg, "=0D").replace(/\n\n/mg, `
=0A`).replace(/([^\r\n])\n/mg, "$1=0A");
    for (var g = [], _ = T.split(`\r
`), k = 0; k < _.length; ++k) {
      var w = _[k];
      if (w.length == 0) {
        g.push("");
        continue;
      }
      for (var M = 0; M < w.length; ) {
        var X = 76, P = w.slice(M, M + X);
        P.charAt(X - 1) == "=" ? X-- : P.charAt(X - 2) == "=" ? X -= 2 : P.charAt(X - 3) == "=" && (X -= 3), P = w.slice(M, M + X), M += X, M < w.length && (P += "="), g.push(P);
      }
    }
    return g.join(`\r
`);
  }
  function Vs(v) {
    for (var T = [], g = 0; g < v.length; ++g) {
      for (var _ = v[g]; g <= v.length && _.charAt(_.length - 1) == "="; ) _ = _.slice(0, _.length - 1) + v[++g];
      T.push(_);
    }
    for (var k = 0; k < T.length; ++k) T[k] = T[k].replace(/[=][0-9A-Fa-f]{2}/g, function(w) {
      return String.fromCharCode(parseInt(w.slice(1), 16));
    });
    return wr(T.join(`\r
`));
  }
  function Gs(v, T, g) {
    for (var _ = "", k = "", w = "", M, X = 0; X < 10; ++X) {
      var P = T[X];
      if (!P || P.match(/^\s*$/)) break;
      var B = P.match(/^(.*?):\s*([^\s].*)$/);
      if (B) switch (B[1].toLowerCase()) {
        case "content-location":
          _ = B[2].trim();
          break;
        case "content-type":
          w = B[2].trim();
          break;
        case "content-transfer-encoding":
          k = B[2].trim();
          break;
      }
    }
    switch (++X, k.toLowerCase()) {
      case "base64":
        M = wr(xr(T.slice(X).join("")));
        break;
      case "quoted-printable":
        M = Vs(T.slice(X));
        break;
      default:
        throw new Error("Unsupported Content-Transfer-Encoding " + k);
    }
    var H = Pt(v, _.slice(g.length), M, { unsafe: !0 });
    w && (H.ctype = w);
  }
  function Xs(v, T) {
    if (V(v.slice(0, 13)).toLowerCase() != "mime-version:") throw new Error("Unsupported MAD header");
    var g = T && T.root || "", _ = (ge && Buffer.isBuffer(v) ? v.toString("binary") : V(v)).split(`\r
`), k = 0, w = "";
    for (k = 0; k < _.length; ++k)
      if (w = _[k], !!/^Content-Location:/i.test(w) && (w = w.slice(w.indexOf("file")), g || (g = w.slice(0, w.lastIndexOf("/") + 1)), w.slice(0, g.length) != g))
        for (; g.length > 0 && (g = g.slice(0, g.length - 1), g = g.slice(0, g.lastIndexOf("/") + 1), w.slice(0, g.length) != g); )
          ;
    var M = (_[1] || "").match(/boundary="(.*?)"/);
    if (!M) throw new Error("MAD cannot find boundary");
    var X = "--" + (M[1] || ""), P = [], B = [], H = {
      FileIndex: P,
      FullPaths: B
    };
    F(H);
    var K, Q = 0;
    for (k = 0; k < _.length; ++k) {
      var ie = _[k];
      ie !== X && ie !== X + "--" || (Q++ && Gs(H, _.slice(K, k), g), K = k);
    }
    return H;
  }
  function zs(v, T) {
    var g = T || {}, _ = g.boundary || "SheetJS";
    _ = "------=" + _;
    for (var k = [
      "MIME-Version: 1.0",
      'Content-Type: multipart/related; boundary="' + _.slice(2) + '"',
      "",
      "",
      ""
    ], w = v.FullPaths[0], M = w, X = v.FileIndex[0], P = 1; P < v.FullPaths.length; ++P)
      if (M = v.FullPaths[P].slice(w.length), X = v.FileIndex[P], !(!X.size || !X.content || M == "Sh33tJ5")) {
        M = M.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7E-\xFF]/g, function(xe) {
          return "_x" + xe.charCodeAt(0).toString(16) + "_";
        }).replace(/[\u0080-\uFFFF]/g, function(xe) {
          return "_u" + xe.charCodeAt(0).toString(16) + "_";
        });
        for (var B = X.content, H = ge && Buffer.isBuffer(B) ? B.toString("binary") : V(B), K = 0, Q = Math.min(1024, H.length), ie = 0, Z = 0; Z <= Q; ++Z) (ie = H.charCodeAt(Z)) >= 32 && ie < 128 && ++K;
        var te = K >= Q * 4 / 5;
        k.push(_), k.push("Content-Location: " + (g.root || "file:///C:/SheetJS/") + M), k.push("Content-Transfer-Encoding: " + (te ? "quoted-printable" : "base64")), k.push("Content-Type: " + Us(X, M)), k.push(""), k.push(te ? Ws(H) : Hs(H));
      }
    return k.push(_ + `--\r
`), k.join(`\r
`);
  }
  function $s(v) {
    var T = {};
    return F(T, v), T;
  }
  function Pt(v, T, g, _) {
    var k = _ && _.unsafe;
    k || F(v);
    var w = !k && Ee.find(v, T);
    if (!w) {
      var M = v.FullPaths[0];
      T.slice(0, M.length) == M ? M = T : (M.slice(-1) != "/" && (M += "/"), M = (M + T).replace("//", "/")), w = { name: n(T), type: 2 }, v.FileIndex.push(w), v.FullPaths.push(M), k || Ee.utils.cfb_gc(v);
    }
    return w.content = g, w.size = g ? g.length : 0, _ && (_.CLSID && (w.clsid = _.CLSID), _.mt && (w.mt = _.mt), _.ct && (w.ct = _.ct)), w;
  }
  function Ys(v, T) {
    F(v);
    var g = Ee.find(v, T);
    if (g) {
      for (var _ = 0; _ < v.FileIndex.length; ++_) if (v.FileIndex[_] == g)
        return v.FileIndex.splice(_, 1), v.FullPaths.splice(_, 1), !0;
    }
    return !1;
  }
  function Ks(v, T, g) {
    F(v);
    var _ = Ee.find(v, T);
    if (_) {
      for (var k = 0; k < v.FileIndex.length; ++k) if (v.FileIndex[k] == _)
        return v.FileIndex[k].name = n(g), v.FullPaths[k] = g, !0;
    }
    return !1;
  }
  function js(v) {
    D(v, !0);
  }
  return a.find = G, a.read = O, a.parse = l, a.write = le, a.writeFile = Se, a.utils = {
    cfb_new: $s,
    cfb_add: Pt,
    cfb_del: Ys,
    cfb_mov: Ks,
    cfb_gc: js,
    ReadShift: Ba,
    CheckField: yi,
    prep_blob: $e,
    bconcat: Yr,
    use_zlib: S,
    _deflateRaw: ve,
    _inflateRaw: L0,
    consts: se
  }, a;
}();
function Mc(e) {
  if (typeof Deno < "u") return Deno.readFileSync(e);
  if (typeof $ < "u" && typeof File < "u" && typeof Folder < "u") try {
    var a = File(e);
    a.open("r"), a.encoding = "binary";
    var r = a.read();
    return a.close(), r;
  } catch (t) {
    if (!t.message || !t.message.match(/onstruct/)) throw t;
  }
  throw new Error("Cannot access file " + e);
}
function Or(e) {
  for (var a = Object.keys(e), r = [], t = 0; t < a.length; ++t) Object.prototype.hasOwnProperty.call(e, a[t]) && r.push(a[t]);
  return r;
}
function u0(e) {
  for (var a = [], r = Or(e), t = 0; t !== r.length; ++t) a[e[r[t]]] = r[t];
  return a;
}
var wt = /* @__PURE__ */ new Date(1899, 11, 30, 0, 0, 0);
function fr(e, a) {
  var r = /* @__PURE__ */ e.getTime(), t = /* @__PURE__ */ wt.getTime() + (/* @__PURE__ */ e.getTimezoneOffset() - /* @__PURE__ */ wt.getTimezoneOffset()) * 6e4;
  return (r - t) / (24 * 60 * 60 * 1e3);
}
var ci = /* @__PURE__ */ new Date(), bc = /* @__PURE__ */ wt.getTime() + (/* @__PURE__ */ ci.getTimezoneOffset() - /* @__PURE__ */ wt.getTimezoneOffset()) * 6e4, K0 = /* @__PURE__ */ ci.getTimezoneOffset();
function Ot(e) {
  var a = /* @__PURE__ */ new Date();
  return a.setTime(e * 24 * 60 * 60 * 1e3 + bc), a.getTimezoneOffset() !== K0 && a.setTime(a.getTime() + (a.getTimezoneOffset() - K0) * 6e4), a;
}
function Bc(e) {
  var a = 0, r = 0, t = !1, n = e.match(/P([0-9\.]+Y)?([0-9\.]+M)?([0-9\.]+D)?T([0-9\.]+H)?([0-9\.]+M)?([0-9\.]+S)?/);
  if (!n) throw new Error("|" + e + "| is not an ISO8601 Duration");
  for (var i = 1; i != n.length; ++i)
    if (n[i]) {
      switch (r = 1, i > 3 && (t = !0), n[i].slice(n[i].length - 1)) {
        case "Y":
          throw new Error("Unsupported ISO Duration Field: " + n[i].slice(n[i].length - 1));
        case "D":
          r *= 24;
        case "H":
          r *= 60;
        case "M":
          if (t) r *= 60;
          else throw new Error("Unsupported ISO Duration Field: M");
      }
      a += r * parseInt(n[i], 10);
    }
  return a;
}
var j0 = /* @__PURE__ */ new Date("2017-02-19T19:06:09.000Z"), fi = /* @__PURE__ */ isNaN(/* @__PURE__ */ j0.getFullYear()) ? /* @__PURE__ */ new Date("2/19/17") : j0, Uc = /* @__PURE__ */ fi.getFullYear() == 2017;
function ze(e, a) {
  var r = new Date(e);
  if (Uc)
    return a > 0 ? r.setTime(r.getTime() + r.getTimezoneOffset() * 60 * 1e3) : a < 0 && r.setTime(r.getTime() - r.getTimezoneOffset() * 60 * 1e3), r;
  if (e instanceof Date) return e;
  if (fi.getFullYear() == 1917 && !isNaN(r.getFullYear())) {
    var t = r.getFullYear();
    return e.indexOf("" + t) > -1 || r.setFullYear(r.getFullYear() + 100), r;
  }
  var n = e.match(/\d+/g) || ["2017", "2", "19", "0", "0", "0"], i = new Date(+n[0], +n[1] - 1, +n[2], +n[3] || 0, +n[4] || 0, +n[5] || 0);
  return e.indexOf("Z") > -1 && (i = new Date(i.getTime() - i.getTimezoneOffset() * 60 * 1e3)), i;
}
function oa(e, a) {
  if (ge && Buffer.isBuffer(e)) {
    if (a) {
      if (e[0] == 255 && e[1] == 254) return ba(e.slice(2).toString("utf16le"));
      if (e[1] == 254 && e[2] == 255) return ba(Kn(e.slice(2).toString("binary")));
    }
    return e.toString("binary");
  }
  if (typeof TextDecoder < "u") try {
    if (a) {
      if (e[0] == 255 && e[1] == 254) return ba(new TextDecoder("utf-16le").decode(e.slice(2)));
      if (e[0] == 254 && e[1] == 255) return ba(new TextDecoder("utf-16be").decode(e.slice(2)));
    }
    var r = {
      "€": "",
      "‚": "",
      ƒ: "",
      "„": "",
      "…": "",
      "†": "",
      "‡": "",
      "ˆ": "",
      "‰": "",
      Š: "",
      "‹": "",
      Œ: "",
      Ž: "",
      "‘": "",
      "’": "",
      "“": "",
      "”": "",
      "•": "",
      "–": "",
      "—": "",
      "˜": "",
      "™": "",
      š: "",
      "›": "",
      œ: "",
      ž: "",
      Ÿ: ""
    };
    return Array.isArray(e) && (e = new Uint8Array(e)), new TextDecoder("latin1").decode(e).replace(/[€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/g, function(i) {
      return r[i] || i;
    });
  } catch {
  }
  for (var t = [], n = 0; n != e.length; ++n) t.push(String.fromCharCode(e[n]));
  return t.join("");
}
function Ye(e) {
  if (typeof JSON < "u" && !Array.isArray(e)) return JSON.parse(JSON.stringify(e));
  if (typeof e != "object" || e == null) return e;
  if (e instanceof Date) return new Date(e.getTime());
  var a = {};
  for (var r in e) Object.prototype.hasOwnProperty.call(e, r) && (a[r] = Ye(e[r]));
  return a;
}
function Re(e, a) {
  for (var r = ""; r.length < a; ) r += e;
  return r;
}
function Sr(e) {
  var a = Number(e);
  if (!isNaN(a)) return isFinite(a) ? a : NaN;
  if (!/\d/.test(e)) return a;
  var r = 1, t = e.replace(/([\d]),([\d])/g, "$1$2").replace(/[$]/g, "").replace(/[%]/g, function() {
    return r *= 100, "";
  });
  return !isNaN(a = Number(t)) || (t = t.replace(/[(](.*)[)]/, function(n, i) {
    return r = -r, i;
  }), !isNaN(a = Number(t))) ? a / r : a;
}
var Hc = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
function Aa(e) {
  var a = new Date(e), r = /* @__PURE__ */ new Date(NaN), t = a.getYear(), n = a.getMonth(), i = a.getDate();
  if (isNaN(i)) return r;
  var s = e.toLowerCase();
  if (s.match(/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/)) {
    if (s = s.replace(/[^a-z]/g, "").replace(/([^a-z]|^)[ap]m?([^a-z]|$)/, ""), s.length > 3 && Hc.indexOf(s) == -1) return r;
  } else if (s.match(/[a-z]/)) return r;
  return t < 0 || t > 8099 ? r : (n > 0 || i > 1) && t != 101 ? a : e.match(/[^-0-9:,\/\\]/) ? r : a;
}
var Wc = /* @__PURE__ */ function() {
  var e = "abacaba".split(/(:?b)/i).length == 5;
  return function(r, t, n) {
    if (e || typeof t == "string") return r.split(t);
    for (var i = r.split(t), s = [i[0]], c = 1; c < i.length; ++c)
      s.push(n), s.push(i[c]);
    return s;
  };
}();
function oi(e) {
  return e ? e.content && e.type ? oa(e.content, !0) : e.data ? La(e.data) : e.asNodeBuffer && ge ? La(e.asNodeBuffer().toString("binary")) : e.asBinary ? La(e.asBinary()) : e._data && e._data.getContent ? La(oa(Array.prototype.slice.call(e._data.getContent(), 0))) : null : null;
}
function li(e) {
  if (!e) return null;
  if (e.data) return b0(e.data);
  if (e.asNodeBuffer && ge) return e.asNodeBuffer();
  if (e._data && e._data.getContent) {
    var a = e._data.getContent();
    return typeof a == "string" ? b0(a) : Array.prototype.slice.call(a);
  }
  return e.content && e.type ? e.content : null;
}
function Vc(e) {
  return e && e.name.slice(-4) === ".bin" ? li(e) : oi(e);
}
function gr(e, a) {
  for (var r = e.FullPaths || Or(e.files), t = a.toLowerCase().replace(/[\/]/g, "\\"), n = t.replace(/\\/g, "/"), i = 0; i < r.length; ++i) {
    var s = r[i].replace(/^Root Entry[\/]/, "").toLowerCase();
    if (t == s || n == s) return e.files ? e.files[r[i]] : e.FileIndex[i];
  }
  return null;
}
function h0(e, a) {
  var r = gr(e, a);
  if (r == null) throw new Error("Cannot find file " + a + " in zip");
  return r;
}
function Be(e, a, r) {
  if (!r) return Vc(h0(e, a));
  if (!a) return null;
  try {
    return Be(e, a);
  } catch {
    return null;
  }
}
function hr(e, a, r) {
  if (!r) return oi(h0(e, a));
  if (!a) return null;
  try {
    return hr(e, a);
  } catch {
    return null;
  }
}
function Gc(e, a, r) {
  return li(h0(e, a));
}
function J0(e) {
  for (var a = e.FullPaths || Or(e.files), r = [], t = 0; t < a.length; ++t) a[t].slice(-1) != "/" && r.push(a[t].replace(/^Root Entry[\/]/, ""));
  return r.sort();
}
function Xc(e, a, r) {
  if (e.FullPaths) {
    if (typeof r == "string") {
      var t;
      return ge ? t = ua(r) : t = oc(r), Ee.utils.cfb_add(e, a, t);
    }
    Ee.utils.cfb_add(e, a, r);
  } else e.file(a, r);
}
function ui(e, a) {
  switch (a.type) {
    case "base64":
      return Ee.read(e, { type: "base64" });
    case "binary":
      return Ee.read(e, { type: "binary" });
    case "buffer":
    case "array":
      return Ee.read(e, { type: "buffer" });
  }
  throw new Error("Unrecognized type " + a.type);
}
function Ma(e, a) {
  if (e.charAt(0) == "/") return e.slice(1);
  var r = a.split("/");
  a.slice(-1) != "/" && r.pop();
  for (var t = e.split("/"); t.length !== 0; ) {
    var n = t.shift();
    n === ".." ? r.pop() : n !== "." && r.push(n);
  }
  return r.join("/");
}
var hi = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r
`, zc = /([^"\s?>\/]+)\s*=\s*((?:")([^"]*)(?:")|(?:')([^']*)(?:')|([^'">\s]+))/g, Z0 = /<[\/\?]?[a-zA-Z0-9:_-]+(?:\s+[^"\s?>\/]+\s*=\s*(?:"[^"]*"|'[^']*'|[^'">\s=]+))*\s*[\/\?]?>/mg, $c = /<[^>]*>/g, ar = /* @__PURE__ */ hi.match(Z0) ? Z0 : $c, Yc = /<\w*:/, Kc = /<(\/?)\w+:/;
function oe(e, a, r) {
  for (var t = {}, n = 0, i = 0; n !== e.length && !((i = e.charCodeAt(n)) === 32 || i === 10 || i === 13); ++n) ;
  if (a || (t[0] = e.slice(0, n)), n === e.length) return t;
  var s = e.match(zc), c = 0, f = "", o = 0, l = "", u = "", x = 1;
  if (s) for (o = 0; o != s.length; ++o) {
    for (u = s[o], i = 0; i != u.length && u.charCodeAt(i) !== 61; ++i) ;
    for (l = u.slice(0, i).trim(); u.charCodeAt(i + 1) == 32; ) ++i;
    for (x = (n = u.charCodeAt(i + 1)) == 34 || n == 39 ? 1 : 0, f = u.slice(i + 1 + x, u.length - x), c = 0; c != l.length && l.charCodeAt(c) !== 58; ++c) ;
    if (c === l.length)
      l.indexOf("_") > 0 && (l = l.slice(0, l.indexOf("_"))), t[l] = f, t[l.toLowerCase()] = f;
    else {
      var d = (c === 5 && l.slice(0, 5) === "xmlns" ? "xmlns" : "") + l.slice(c + 1);
      if (t[d] && l.slice(c - 3, c) == "ext") continue;
      t[d] = f, t[d.toLowerCase()] = f;
    }
  }
  return t;
}
function Nr(e) {
  return e.replace(Kc, "<$1");
}
var xi = {
  "&quot;": '"',
  "&apos;": "'",
  "&gt;": ">",
  "&lt;": "<",
  "&amp;": "&"
}, jc = /* @__PURE__ */ u0(xi), ke = /* @__PURE__ */ function() {
  var e = /&(?:quot|apos|gt|lt|amp|#x?([\da-fA-F]+));/ig, a = /_x([\da-fA-F]{4})_/ig;
  return function r(t) {
    var n = t + "", i = n.indexOf("<![CDATA[");
    if (i == -1) return n.replace(e, function(c, f) {
      return xi[c] || String.fromCharCode(parseInt(f, c.indexOf("x") > -1 ? 16 : 10)) || c;
    }).replace(a, function(c, f) {
      return String.fromCharCode(parseInt(f, 16));
    });
    var s = n.indexOf("]]>");
    return r(n.slice(0, i)) + n.slice(i + 9, s) + r(n.slice(s + 3));
  };
}(), Jc = /[&<>'"]/g, Zc = /[\u0000-\u001f]/g;
function x0(e) {
  var a = e + "";
  return a.replace(Jc, function(r) {
    return jc[r];
  }).replace(/\n/g, "<br/>").replace(Zc, function(r) {
    return "&#x" + ("000" + r.charCodeAt(0).toString(16)).slice(-4) + ";";
  });
}
var q0 = /* @__PURE__ */ function() {
  var e = /&#(\d+);/g;
  function a(r, t) {
    return String.fromCharCode(parseInt(t, 10));
  }
  return function(t) {
    return t.replace(e, a);
  };
}();
function Ce(e) {
  switch (e) {
    case 1:
    case !0:
    case "1":
    case "true":
    case "TRUE":
      return !0;
    default:
      return !1;
  }
}
function Bt(e) {
  for (var a = "", r = 0, t = 0, n = 0, i = 0, s = 0, c = 0; r < e.length; ) {
    if (t = e.charCodeAt(r++), t < 128) {
      a += String.fromCharCode(t);
      continue;
    }
    if (n = e.charCodeAt(r++), t > 191 && t < 224) {
      s = (t & 31) << 6, s |= n & 63, a += String.fromCharCode(s);
      continue;
    }
    if (i = e.charCodeAt(r++), t < 240) {
      a += String.fromCharCode((t & 15) << 12 | (n & 63) << 6 | i & 63);
      continue;
    }
    s = e.charCodeAt(r++), c = ((t & 7) << 18 | (n & 63) << 12 | (i & 63) << 6 | s & 63) - 65536, a += String.fromCharCode(55296 + (c >>> 10 & 1023)), a += String.fromCharCode(56320 + (c & 1023));
  }
  return a;
}
function Q0(e) {
  var a = Zr(2 * e.length), r, t, n = 1, i = 0, s = 0, c;
  for (t = 0; t < e.length; t += n)
    n = 1, (c = e.charCodeAt(t)) < 128 ? r = c : c < 224 ? (r = (c & 31) * 64 + (e.charCodeAt(t + 1) & 63), n = 2) : c < 240 ? (r = (c & 15) * 4096 + (e.charCodeAt(t + 1) & 63) * 64 + (e.charCodeAt(t + 2) & 63), n = 3) : (n = 4, r = (c & 7) * 262144 + (e.charCodeAt(t + 1) & 63) * 4096 + (e.charCodeAt(t + 2) & 63) * 64 + (e.charCodeAt(t + 3) & 63), r -= 65536, s = 55296 + (r >>> 10 & 1023), r = 56320 + (r & 1023)), s !== 0 && (a[i++] = s & 255, a[i++] = s >>> 8, s = 0), a[i++] = r % 256, a[i++] = r >>> 8;
  return a.slice(0, i).toString("ucs2");
}
function en(e) {
  return ua(e, "binary").toString("utf8");
}
var lt = "foo bar bazâð£", Fe = ge && (/* @__PURE__ */ en(lt) == /* @__PURE__ */ Bt(lt) && en || /* @__PURE__ */ Q0(lt) == /* @__PURE__ */ Bt(lt) && Q0) || Bt, ba = ge ? function(e) {
  return ua(e, "utf8").toString("binary");
} : function(e) {
  for (var a = [], r = 0, t = 0, n = 0; r < e.length; )
    switch (t = e.charCodeAt(r++), !0) {
      case t < 128:
        a.push(String.fromCharCode(t));
        break;
      case t < 2048:
        a.push(String.fromCharCode(192 + (t >> 6))), a.push(String.fromCharCode(128 + (t & 63)));
        break;
      case (t >= 55296 && t < 57344):
        t -= 55296, n = e.charCodeAt(r++) - 56320 + (t << 10), a.push(String.fromCharCode(240 + (n >> 18 & 7))), a.push(String.fromCharCode(144 + (n >> 12 & 63))), a.push(String.fromCharCode(128 + (n >> 6 & 63))), a.push(String.fromCharCode(128 + (n & 63)));
        break;
      default:
        a.push(String.fromCharCode(224 + (t >> 12))), a.push(String.fromCharCode(128 + (t >> 6 & 63))), a.push(String.fromCharCode(128 + (t & 63)));
    }
  return a.join("");
}, ja = /* @__PURE__ */ function() {
  var e = {};
  return function(r, t) {
    var n = r + "|" + (t || "");
    return e[n] ? e[n] : e[n] = new RegExp("<(?:\\w+:)?" + r + '(?: xml:space="preserve")?(?:[^>]*)>([\\s\\S]*?)</(?:\\w+:)?' + r + ">", t || "");
  };
}(), di = /* @__PURE__ */ function() {
  var e = [
    ["nbsp", " "],
    ["middot", "·"],
    ["quot", '"'],
    ["apos", "'"],
    ["gt", ">"],
    ["lt", "<"],
    ["amp", "&"]
  ].map(function(a) {
    return [new RegExp("&" + a[0] + ";", "ig"), a[1]];
  });
  return function(r) {
    for (var t = r.replace(/^[\t\n\r ]+/, "").replace(/[\t\n\r ]+$/, "").replace(/>\s+/g, ">").replace(/\s+</g, "<").replace(/[\t\n\r ]+/g, " ").replace(/<\s*[bB][rR]\s*\/?>/g, `
`).replace(/<[^>]*>/g, ""), n = 0; n < e.length; ++n) t = t.replace(e[n][0], e[n][1]);
    return t;
  };
}(), qc = /* @__PURE__ */ function() {
  var e = {};
  return function(r) {
    return e[r] !== void 0 ? e[r] : e[r] = new RegExp("<(?:vt:)?" + r + ">([\\s\\S]*?)</(?:vt:)?" + r + ">", "g");
  };
}(), Qc = /<\/?(?:vt:)?variant>/g, ef = /<(?:vt:)([^>]*)>([\s\S]*)</;
function rn(e, a) {
  var r = oe(e), t = e.match(qc(r.baseType)) || [], n = [];
  if (t.length != r.size) {
    if (a.WTF) throw new Error("unexpected vector length " + t.length + " != " + r.size);
    return n;
  }
  return t.forEach(function(i) {
    var s = i.replace(Qc, "").match(ef);
    s && n.push({ v: Fe(s[2]), t: s[1] });
  }), n;
}
var rf = /(^\s|\s$|\n)/;
function af(e) {
  return Or(e).map(function(a) {
    return " " + a + '="' + e[a] + '"';
  }).join("");
}
function tf(e, a, r) {
  return "<" + e + (r != null ? af(r) : "") + (a != null ? (a.match(rf) ? ' xml:space="preserve"' : "") + ">" + a + "</" + e : "/") + ">";
}
function d0(e) {
  if (ge && /*::typeof Buffer !== "undefined" && d != null && d instanceof Buffer &&*/
  Buffer.isBuffer(e)) return e.toString("utf8");
  if (typeof e == "string") return e;
  if (typeof Uint8Array < "u" && e instanceof Uint8Array) return Fe(ha(f0(e)));
  throw new Error("Bad input format: expected Buffer or string");
}
var Ja = /<(\/?)([^\s?><!\/:]*:|)([^\s?<>:\/]+)(?:[\s?:\/][^>]*)?>/mg, nf = {
  CT: "http://schemas.openxmlformats.org/package/2006/content-types"
}, sf = [
  "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
  "http://purl.oclc.org/ooxml/spreadsheetml/main",
  "http://schemas.microsoft.com/office/excel/2006/main",
  "http://schemas.microsoft.com/office/excel/2006/2"
];
function cf(e, a) {
  for (var r = 1 - 2 * (e[a + 7] >>> 7), t = ((e[a + 7] & 127) << 4) + (e[a + 6] >>> 4 & 15), n = e[a + 6] & 15, i = 5; i >= 0; --i) n = n * 256 + e[a + i];
  return t == 2047 ? n == 0 ? r * (1 / 0) : NaN : (t == 0 ? t = -1022 : (t -= 1023, n += Math.pow(2, 52)), r * Math.pow(2, t - 52) * n);
}
function ff(e, a, r) {
  var t = (a < 0 || 1 / a == -1 / 0 ? 1 : 0) << 7, n = 0, i = 0, s = t ? -a : a;
  isFinite(s) ? s == 0 ? n = i = 0 : (n = Math.floor(Math.log(s) / Math.LN2), i = s * Math.pow(2, 52 - n), n <= -1023 && (!isFinite(i) || i < Math.pow(2, 52)) ? n = -1022 : (i -= Math.pow(2, 52), n += 1023)) : (n = 2047, i = isNaN(a) ? 26985 : 0);
  for (var c = 0; c <= 5; ++c, i /= 256) e[r + c] = i & 255;
  e[r + 6] = (n & 15) << 4 | i & 15, e[r + 7] = n >> 4 | t;
}
var an = function(e) {
  for (var a = [], r = 10240, t = 0; t < e[0].length; ++t) if (e[0][t]) for (var n = 0, i = e[0][t].length; n < i; n += r) a.push.apply(a, e[0][t].slice(n, n + r));
  return a;
}, tn = ge ? function(e) {
  return e[0].length > 0 && Buffer.isBuffer(e[0][0]) ? Buffer.concat(e[0].map(function(a) {
    return Buffer.isBuffer(a) ? a : ua(a);
  })) : an(e);
} : an, nn = function(e, a, r) {
  for (var t = [], n = a; n < r; n += 2) t.push(String.fromCharCode(Br(e, n)));
  return t.join("").replace(cr, "");
}, p0 = ge ? function(e, a, r) {
  return Buffer.isBuffer(e) ? e.toString("utf16le", a, r).replace(cr, "") : nn(e, a, r);
} : nn, sn = function(e, a, r) {
  for (var t = [], n = a; n < a + r; ++n) t.push(("0" + e[n].toString(16)).slice(-2));
  return t.join("");
}, pi = ge ? function(e, a, r) {
  return Buffer.isBuffer(e) ? e.toString("hex", a, a + r) : sn(e, a, r);
} : sn, cn = function(e, a, r) {
  for (var t = [], n = a; n < r; n++) t.push(String.fromCharCode(ga(e, n)));
  return t.join("");
}, at = ge ? function(a, r, t) {
  return Buffer.isBuffer(a) ? a.toString("utf8", r, t) : cn(a, r, t);
} : cn, vi = function(e, a) {
  var r = ur(e, a);
  return r > 0 ? at(e, a + 4, a + 4 + r - 1) : "";
}, mi = vi, gi = function(e, a) {
  var r = ur(e, a);
  return r > 0 ? at(e, a + 4, a + 4 + r - 1) : "";
}, Ei = gi, _i = function(e, a) {
  var r = 2 * ur(e, a);
  return r > 0 ? at(e, a + 4, a + 4 + r - 1) : "";
}, Ti = _i, ki = function(a, r) {
  var t = ur(a, r);
  return t > 0 ? p0(a, r + 4, r + 4 + t) : "";
}, wi = ki, Ai = function(e, a) {
  var r = ur(e, a);
  return r > 0 ? at(e, a + 4, a + 4 + r) : "";
}, Fi = Ai, Si = function(e, a) {
  return cf(e, a);
}, At = Si, Ci = function(a) {
  return Array.isArray(a) || typeof Uint8Array < "u" && a instanceof Uint8Array;
};
ge && (mi = function(a, r) {
  if (!Buffer.isBuffer(a)) return vi(a, r);
  var t = a.readUInt32LE(r);
  return t > 0 ? a.toString("utf8", r + 4, r + 4 + t - 1) : "";
}, Ei = function(a, r) {
  if (!Buffer.isBuffer(a)) return gi(a, r);
  var t = a.readUInt32LE(r);
  return t > 0 ? a.toString("utf8", r + 4, r + 4 + t - 1) : "";
}, Ti = function(a, r) {
  if (!Buffer.isBuffer(a)) return _i(a, r);
  var t = 2 * a.readUInt32LE(r);
  return a.toString("utf16le", r + 4, r + 4 + t - 1);
}, wi = function(a, r) {
  if (!Buffer.isBuffer(a)) return ki(a, r);
  var t = a.readUInt32LE(r);
  return a.toString("utf16le", r + 4, r + 4 + t);
}, Fi = function(a, r) {
  if (!Buffer.isBuffer(a)) return Ai(a, r);
  var t = a.readUInt32LE(r);
  return a.toString("utf8", r + 4, r + 4 + t);
}, At = function(a, r) {
  return Buffer.isBuffer(a) ? a.readDoubleLE(r) : Si(a, r);
}, Ci = function(a) {
  return Buffer.isBuffer(a) || Array.isArray(a) || typeof Uint8Array < "u" && a instanceof Uint8Array;
});
var ga = function(e, a) {
  return e[a];
}, Br = function(e, a) {
  return e[a + 1] * 256 + e[a];
}, of = function(e, a) {
  var r = e[a + 1] * 256 + e[a];
  return r < 32768 ? r : (65535 - r + 1) * -1;
}, ur = function(e, a) {
  return e[a + 3] * (1 << 24) + (e[a + 2] << 16) + (e[a + 1] << 8) + e[a];
}, aa = function(e, a) {
  return e[a + 3] << 24 | e[a + 2] << 16 | e[a + 1] << 8 | e[a];
}, lf = function(e, a) {
  return e[a] << 24 | e[a + 1] << 16 | e[a + 2] << 8 | e[a + 3];
};
function Ba(e, a) {
  var r = "", t, n, i = [], s, c, f, o;
  switch (a) {
    case "dbcs":
      if (o = this.l, ge && Buffer.isBuffer(this)) r = this.slice(this.l, this.l + 2 * e).toString("utf16le");
      else for (f = 0; f < e; ++f)
        r += String.fromCharCode(Br(this, o)), o += 2;
      e *= 2;
      break;
    case "utf8":
      r = at(this, this.l, this.l + e);
      break;
    case "utf16le":
      e *= 2, r = p0(this, this.l, this.l + e);
      break;
    case "wstr":
      return Ba.call(this, e, "dbcs");
    case "lpstr-ansi":
      r = mi(this, this.l), e = 4 + ur(this, this.l);
      break;
    case "lpstr-cp":
      r = Ei(this, this.l), e = 4 + ur(this, this.l);
      break;
    case "lpwstr":
      r = Ti(this, this.l), e = 4 + 2 * ur(this, this.l);
      break;
    case "lpp4":
      e = 4 + ur(this, this.l), r = wi(this, this.l), e & 2 && (e += 2);
      break;
    case "8lpp4":
      e = 4 + ur(this, this.l), r = Fi(this, this.l), e & 3 && (e += 4 - (e & 3));
      break;
    case "cstr":
      for (e = 0, r = ""; (s = ga(this, this.l + e++)) !== 0; ) i.push(ot(s));
      r = i.join("");
      break;
    case "_wstr":
      for (e = 0, r = ""; (s = Br(this, this.l + e)) !== 0; )
        i.push(ot(s)), e += 2;
      e += 2, r = i.join("");
      break;
    case "dbcs-cont":
      for (r = "", o = this.l, f = 0; f < e; ++f) {
        if (this.lens && this.lens.indexOf(o) !== -1)
          return s = ga(this, o), this.l = o + 1, c = Ba.call(this, e - f, s ? "dbcs-cont" : "sbcs-cont"), i.join("") + c;
        i.push(ot(Br(this, o))), o += 2;
      }
      r = i.join(""), e *= 2;
      break;
    case "cpstr":
    case "sbcs-cont":
      for (r = "", o = this.l, f = 0; f != e; ++f) {
        if (this.lens && this.lens.indexOf(o) !== -1)
          return s = ga(this, o), this.l = o + 1, c = Ba.call(this, e - f, s ? "dbcs-cont" : "sbcs-cont"), i.join("") + c;
        i.push(ot(ga(this, o))), o += 1;
      }
      r = i.join("");
      break;
    default:
      switch (e) {
        case 1:
          return t = ga(this, this.l), this.l++, t;
        case 2:
          return t = (a === "i" ? of : Br)(this, this.l), this.l += 2, t;
        case 4:
        case -4:
          return a === "i" || !(this[this.l + 3] & 128) ? (t = (e > 0 ? aa : lf)(this, this.l), this.l += 4, t) : (n = ur(this, this.l), this.l += 4, n);
        case 8:
        case -8:
          if (a === "f")
            return e == 8 ? n = At(this, this.l) : n = At([this[this.l + 7], this[this.l + 6], this[this.l + 5], this[this.l + 4], this[this.l + 3], this[this.l + 2], this[this.l + 1], this[this.l + 0]], 0), this.l += 8, n;
          e = 8;
        case 16:
          r = pi(this, this.l, e);
          break;
      }
  }
  return this.l += e, r;
}
var uf = function(e, a, r) {
  e[r] = a & 255, e[r + 1] = a >>> 8 & 255, e[r + 2] = a >>> 16 & 255, e[r + 3] = a >>> 24 & 255;
}, hf = function(e, a, r) {
  e[r] = a & 255, e[r + 1] = a >> 8 & 255, e[r + 2] = a >> 16 & 255, e[r + 3] = a >> 24 & 255;
}, xf = function(e, a, r) {
  e[r] = a & 255, e[r + 1] = a >>> 8 & 255;
};
function df(e, a, r) {
  var t = 0, n = 0;
  if (r === "dbcs") {
    for (n = 0; n != a.length; ++n) xf(this, a.charCodeAt(n), this.l + 2 * n);
    t = 2 * a.length;
  } else if (r === "sbcs") {
    for (a = a.replace(/[^\x00-\x7F]/g, "_"), n = 0; n != a.length; ++n) this[this.l + n] = a.charCodeAt(n) & 255;
    t = a.length;
  } else if (r === "hex") {
    for (; n < e; ++n)
      this[this.l++] = parseInt(a.slice(2 * n, 2 * n + 2), 16) || 0;
    return this;
  } else if (r === "utf16le") {
    var i = Math.min(this.l + e, this.length);
    for (n = 0; n < Math.min(a.length, e); ++n) {
      var s = a.charCodeAt(n);
      this[this.l++] = s & 255, this[this.l++] = s >> 8;
    }
    for (; this.l < i; ) this[this.l++] = 0;
    return this;
  } else switch (e) {
    case 1:
      t = 1, this[this.l] = a & 255;
      break;
    case 2:
      t = 2, this[this.l] = a & 255, a >>>= 8, this[this.l + 1] = a & 255;
      break;
    case 3:
      t = 3, this[this.l] = a & 255, a >>>= 8, this[this.l + 1] = a & 255, a >>>= 8, this[this.l + 2] = a & 255;
      break;
    case 4:
      t = 4, uf(this, a, this.l);
      break;
    case 8:
      if (t = 8, r === "f") {
        ff(this, a, this.l);
        break;
      }
    case 16:
      break;
    case -4:
      t = 4, hf(this, a, this.l);
      break;
  }
  return this.l += t, this;
}
function yi(e, a) {
  var r = pi(this, this.l, e.length >> 1);
  if (r !== e) throw new Error(a + "Expected " + e + " saw " + r);
  this.l += e.length >> 1;
}
function $e(e, a) {
  e.l = a, e.read_shift = /*::(*/
  Ba, e.chk = yi, e.write_shift = df;
}
function rr(e, a) {
  e.l += a;
}
function We(e) {
  var a = Zr(e);
  return $e(a, 0), a;
}
function Vr(e, a, r) {
  if (e) {
    var t, n, i;
    $e(e, e.l || 0);
    for (var s = e.length, c = 0, f = 0; e.l < s; ) {
      c = e.read_shift(1), c & 128 && (c = (c & 127) + ((e.read_shift(1) & 127) << 7));
      var o = Rt[c] || Rt[65535];
      for (t = e.read_shift(1), i = t & 127, n = 1; n < 4 && t & 128; ++n) i += ((t = e.read_shift(1)) & 127) << 7 * n;
      f = e.l + i;
      var l = o.f && o.f(e, i, r);
      if (e.l = f, a(l, o, c)) return;
    }
  }
}
function Kt() {
  var e = [], a = ge ? 256 : 2048, r = function(o) {
    var l = We(o);
    return $e(l, 0), l;
  }, t = r(a), n = function() {
    t && (t.length > t.l && (t = t.slice(0, t.l), t.l = t.length), t.length > 0 && e.push(t), t = null);
  }, i = function(o) {
    return t && o < t.length - t.l ? t : (n(), t = r(Math.max(o + 1, a)));
  }, s = function() {
    return n(), Yr(e);
  }, c = function(o) {
    n(), t = o, t.l == null && (t.l = t.length), i(a);
  };
  return { next: i, push: c, end: s, _bufs: e };
}
function Ua(e, a, r) {
  var t = Ye(e);
  if (a.s ? (t.cRel && (t.c += a.s.c), t.rRel && (t.r += a.s.r)) : (t.cRel && (t.c += a.c), t.rRel && (t.r += a.r)), !r || r.biff < 12) {
    for (; t.c >= 256; ) t.c -= 256;
    for (; t.r >= 65536; ) t.r -= 65536;
  }
  return t;
}
function fn(e, a, r) {
  var t = Ye(e);
  return t.s = Ua(t.s, a.s, r), t.e = Ua(t.e, a.s, r), t;
}
function Ha(e, a) {
  if (e.cRel && e.c < 0)
    for (e = Ye(e); e.c < 0; ) e.c += a > 8 ? 16384 : 256;
  if (e.rRel && e.r < 0)
    for (e = Ye(e); e.r < 0; ) e.r += a > 8 ? 1048576 : a > 5 ? 65536 : 16384;
  var r = he(e);
  return !e.cRel && e.cRel != null && (r = mf(r)), !e.rRel && e.rRel != null && (r = pf(r)), r;
}
function Ut(e, a) {
  return e.s.r == 0 && !e.s.rRel && e.e.r == (a.biff >= 12 ? 1048575 : a.biff >= 8 ? 65536 : 16384) && !e.e.rRel ? (e.s.cRel ? "" : "$") + Ve(e.s.c) + ":" + (e.e.cRel ? "" : "$") + Ve(e.e.c) : e.s.c == 0 && !e.s.cRel && e.e.c == (a.biff >= 12 ? 16383 : 255) && !e.e.cRel ? (e.s.rRel ? "" : "$") + Ke(e.s.r) + ":" + (e.e.rRel ? "" : "$") + Ke(e.e.r) : Ha(e.s, a.biff) + ":" + Ha(e.e, a.biff);
}
function v0(e) {
  return parseInt(vf(e), 10) - 1;
}
function Ke(e) {
  return "" + (e + 1);
}
function pf(e) {
  return e.replace(/([A-Z]|^)(\d+)$/, "$1$$$2");
}
function vf(e) {
  return e.replace(/\$(\d+)$/, "$1");
}
function m0(e) {
  for (var a = gf(e), r = 0, t = 0; t !== a.length; ++t) r = 26 * r + a.charCodeAt(t) - 64;
  return r - 1;
}
function Ve(e) {
  if (e < 0) throw new Error("invalid column " + e);
  var a = "";
  for (++e; e; e = Math.floor((e - 1) / 26)) a = String.fromCharCode((e - 1) % 26 + 65) + a;
  return a;
}
function mf(e) {
  return e.replace(/^([A-Z])/, "$$$1");
}
function gf(e) {
  return e.replace(/^\$([A-Z])/, "$1");
}
function Ef(e) {
  return e.replace(/(\$?[A-Z]*)(\$?\d*)/, "$1,$2").split(",");
}
function sr(e) {
  for (var a = 0, r = 0, t = 0; t < e.length; ++t) {
    var n = e.charCodeAt(t);
    n >= 48 && n <= 57 ? a = 10 * a + (n - 48) : n >= 65 && n <= 90 && (r = 26 * r + (n - 64));
  }
  return { c: r - 1, r: a - 1 };
}
function he(e) {
  for (var a = e.c + 1, r = ""; a; a = (a - 1) / 26 | 0) r = String.fromCharCode((a - 1) % 26 + 65) + r;
  return r + (e.r + 1);
}
function Ca(e) {
  var a = e.indexOf(":");
  return a == -1 ? { s: sr(e), e: sr(e) } : { s: sr(e.slice(0, a)), e: sr(e.slice(a + 1)) };
}
function _e(e, a) {
  return typeof a > "u" || typeof a == "number" ? _e(e.s, e.e) : (typeof e != "string" && (e = he(e)), typeof a != "string" && (a = he(a)), e == a ? e : e + ":" + a);
}
function Oe(e) {
  var a = { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } }, r = 0, t = 0, n = 0, i = e.length;
  for (r = 0; t < i && !((n = e.charCodeAt(t) - 64) < 1 || n > 26); ++t)
    r = 26 * r + n;
  for (a.s.c = --r, r = 0; t < i && !((n = e.charCodeAt(t) - 48) < 0 || n > 9); ++t)
    r = 10 * r + n;
  if (a.s.r = --r, t === i || n != 10)
    return a.e.c = a.s.c, a.e.r = a.s.r, a;
  for (++t, r = 0; t != i && !((n = e.charCodeAt(t) - 64) < 1 || n > 26); ++t)
    r = 26 * r + n;
  for (a.e.c = --r, r = 0; t != i && !((n = e.charCodeAt(t) - 48) < 0 || n > 9); ++t)
    r = 10 * r + n;
  return a.e.r = --r, a;
}
function on(e, a) {
  var r = e.t == "d" && a instanceof Date;
  if (e.z != null) try {
    return e.w = Er(e.z, r ? fr(a) : a);
  } catch {
  }
  try {
    return e.w = Er((e.XF || {}).numFmtId || (r ? 14 : 0), r ? fr(a) : a);
  } catch {
    return "" + a;
  }
}
function Wr(e, a, r) {
  return e == null || e.t == null || e.t == "z" ? "" : e.w !== void 0 ? e.w : (e.t == "d" && !e.z && r && r.dateNF && (e.z = r.dateNF), e.t == "e" ? pa[e.v] || e.v : a == null ? on(e, e.v) : on(e, a));
}
function Qr(e, a) {
  var r = a && a.sheet ? a.sheet : "Sheet1", t = {};
  return t[r] = e, { SheetNames: [r], Sheets: t };
}
function Di(e, a, r) {
  var t = r || {}, n = e ? Array.isArray(e) : t.dense, i = e || (n ? [] : {}), s = 0, c = 0;
  if (i && t.origin != null) {
    if (typeof t.origin == "number") s = t.origin;
    else {
      var f = typeof t.origin == "string" ? sr(t.origin) : t.origin;
      s = f.r, c = f.c;
    }
    i["!ref"] || (i["!ref"] = "A1:A1");
  }
  var o = { s: { c: 1e7, r: 1e7 }, e: { c: 0, r: 0 } };
  if (i["!ref"]) {
    var l = Oe(i["!ref"]);
    o.s.c = l.s.c, o.s.r = l.s.r, o.e.c = Math.max(o.e.c, l.e.c), o.e.r = Math.max(o.e.r, l.e.r), s == -1 && (o.e.r = s = l.e.r + 1);
  }
  for (var u = 0; u != a.length; ++u)
    if (a[u]) {
      if (!Array.isArray(a[u])) throw new Error("aoa_to_sheet expects an array of arrays");
      for (var x = 0; x != a[u].length; ++x)
        if (!(typeof a[u][x] > "u")) {
          var d = { v: a[u][x] }, p = s + u, h = c + x;
          if (o.s.r > p && (o.s.r = p), o.s.c > h && (o.s.c = h), o.e.r < p && (o.e.r = p), o.e.c < h && (o.e.c = h), a[u][x] && typeof a[u][x] == "object" && !Array.isArray(a[u][x]) && !(a[u][x] instanceof Date)) d = a[u][x];
          else if (Array.isArray(d.v) && (d.f = a[u][x][1], d.v = d.v[0]), d.v === null)
            if (d.f) d.t = "n";
            else if (t.nullError)
              d.t = "e", d.v = 0;
            else if (t.sheetStubs) d.t = "z";
            else continue;
          else typeof d.v == "number" ? d.t = "n" : typeof d.v == "boolean" ? d.t = "b" : d.v instanceof Date ? (d.z = t.dateNF || de[14], t.cellDates ? (d.t = "d", d.w = Er(d.z, fr(d.v))) : (d.t = "n", d.v = fr(d.v), d.w = Er(d.z, d.v))) : d.t = "s";
          if (n)
            i[p] || (i[p] = []), i[p][h] && i[p][h].z && (d.z = i[p][h].z), i[p][h] = d;
          else {
            var m = he({ c: h, r: p });
            i[m] && i[m].z && (d.z = i[m].z), i[m] = d;
          }
        }
    }
  return o.s.c < 1e7 && (i["!ref"] = _e(o)), i;
}
function ya(e, a) {
  return Di(null, e, a);
}
function _f(e) {
  return e.read_shift(4, "i");
}
function er(e) {
  var a = e.read_shift(4);
  return a === 0 ? "" : e.read_shift(a, "dbcs");
}
function Tf(e) {
  return { ich: e.read_shift(2), ifnt: e.read_shift(2) };
}
function g0(e, a) {
  var r = e.l, t = e.read_shift(1), n = er(e), i = [], s = { t: n, h: n };
  if (t & 1) {
    for (var c = e.read_shift(4), f = 0; f != c; ++f) i.push(Tf(e));
    s.r = i;
  } else s.r = [{ ich: 0, ifnt: 0 }];
  return e.l = r + a, s;
}
var kf = g0;
function _r(e) {
  var a = e.read_shift(4), r = e.read_shift(2);
  return r += e.read_shift(1) << 16, e.l++, { c: a, iStyleRef: r };
}
function xa(e) {
  var a = e.read_shift(2);
  return a += e.read_shift(1) << 16, e.l++, { c: -1, iStyleRef: a };
}
var wf = er;
function E0(e) {
  var a = e.read_shift(4);
  return a === 0 || a === 4294967295 ? "" : e.read_shift(a, "dbcs");
}
var Af = er, jt = E0;
function _0(e) {
  var a = e.slice(e.l, e.l + 4), r = a[0] & 1, t = a[0] & 2;
  e.l += 4;
  var n = t === 0 ? At([0, 0, 0, 0, a[0] & 252, a[1], a[2], a[3]], 0) : aa(a, 0) >> 2;
  return r ? n / 100 : n;
}
function Ri(e) {
  var a = { s: {}, e: {} };
  return a.s.r = e.read_shift(4), a.e.r = e.read_shift(4), a.s.c = e.read_shift(4), a.e.c = e.read_shift(4), a;
}
var da = Ri;
function qe(e) {
  if (e.length - e.l < 8) throw "XLS Xnum Buffer underflow";
  return e.read_shift(8, "f");
}
function Ff(e) {
  var a = {}, r = e.read_shift(1), t = r >>> 1, n = e.read_shift(1), i = e.read_shift(2, "i"), s = e.read_shift(1), c = e.read_shift(1), f = e.read_shift(1);
  switch (e.l++, t) {
    case 0:
      a.auto = 1;
      break;
    case 1:
      a.index = n;
      var o = sa[n];
      o && (a.rgb = qa(o));
      break;
    case 2:
      a.rgb = qa([s, c, f]);
      break;
    case 3:
      a.theme = n;
      break;
  }
  return i != 0 && (a.tint = i > 0 ? i / 32767 : i / 32768), a;
}
function Sf(e) {
  var a = e.read_shift(1);
  e.l++;
  var r = {
    fBold: a & 1,
    fItalic: a & 2,
    fUnderline: a & 4,
    fStrikeout: a & 8,
    fOutline: a & 16,
    fShadow: a & 32,
    fCondense: a & 64,
    fExtend: a & 128
  };
  return r;
}
function Oi(e, a) {
  var r = { 2: "BITMAP", 3: "METAFILEPICT", 8: "DIB", 14: "ENHMETAFILE" }, t = e.read_shift(4);
  switch (t) {
    case 0:
      return "";
    case 4294967295:
    case 4294967294:
      return r[e.read_shift(4)] || "";
  }
  if (t > 400) throw new Error("Unsupported Clipboard: " + t.toString(16));
  return e.l -= 4, e.read_shift(0, a == 1 ? "lpstr" : "lpwstr");
}
function Cf(e) {
  return Oi(e, 1);
}
function yf(e) {
  return Oi(e, 2);
}
var T0 = 2, or = 3, ut = 11, ln = 12, Ft = 19, ht = 64, Df = 65, Rf = 71, Of = 4108, Nf = 4126, Xe = 80, Ni = 81, If = [Xe, Ni], Lf = {
  /*::[*/
  1: { n: "CodePage", t: T0 },
  /*::[*/
  2: { n: "Category", t: Xe },
  /*::[*/
  3: { n: "PresentationFormat", t: Xe },
  /*::[*/
  4: { n: "ByteCount", t: or },
  /*::[*/
  5: { n: "LineCount", t: or },
  /*::[*/
  6: { n: "ParagraphCount", t: or },
  /*::[*/
  7: { n: "SlideCount", t: or },
  /*::[*/
  8: { n: "NoteCount", t: or },
  /*::[*/
  9: { n: "HiddenCount", t: or },
  /*::[*/
  10: { n: "MultimediaClipCount", t: or },
  /*::[*/
  11: { n: "ScaleCrop", t: ut },
  /*::[*/
  12: {
    n: "HeadingPairs",
    t: Of
    /* VT_VECTOR | VT_VARIANT */
  },
  /*::[*/
  13: {
    n: "TitlesOfParts",
    t: Nf
    /* VT_VECTOR | VT_LPSTR */
  },
  /*::[*/
  14: { n: "Manager", t: Xe },
  /*::[*/
  15: { n: "Company", t: Xe },
  /*::[*/
  16: { n: "LinksUpToDate", t: ut },
  /*::[*/
  17: { n: "CharacterCount", t: or },
  /*::[*/
  19: { n: "SharedDoc", t: ut },
  /*::[*/
  22: { n: "HyperlinksChanged", t: ut },
  /*::[*/
  23: { n: "AppVersion", t: or, p: "version" },
  /*::[*/
  24: { n: "DigSig", t: Df },
  /*::[*/
  26: { n: "ContentType", t: Xe },
  /*::[*/
  27: { n: "ContentStatus", t: Xe },
  /*::[*/
  28: { n: "Language", t: Xe },
  /*::[*/
  29: { n: "Version", t: Xe },
  /*::[*/
  255: {},
  /* [MS-OLEPS] 2.18 */
  /*::[*/
  2147483648: { n: "Locale", t: Ft },
  /*::[*/
  2147483651: { n: "Behavior", t: Ft },
  /*::[*/
  1919054434: {}
}, Pf = {
  /*::[*/
  1: { n: "CodePage", t: T0 },
  /*::[*/
  2: { n: "Title", t: Xe },
  /*::[*/
  3: { n: "Subject", t: Xe },
  /*::[*/
  4: { n: "Author", t: Xe },
  /*::[*/
  5: { n: "Keywords", t: Xe },
  /*::[*/
  6: { n: "Comments", t: Xe },
  /*::[*/
  7: { n: "Template", t: Xe },
  /*::[*/
  8: { n: "LastAuthor", t: Xe },
  /*::[*/
  9: { n: "RevNumber", t: Xe },
  /*::[*/
  10: { n: "EditTime", t: ht },
  /*::[*/
  11: { n: "LastPrinted", t: ht },
  /*::[*/
  12: { n: "CreatedDate", t: ht },
  /*::[*/
  13: { n: "ModifiedDate", t: ht },
  /*::[*/
  14: { n: "PageCount", t: or },
  /*::[*/
  15: { n: "WordCount", t: or },
  /*::[*/
  16: { n: "CharCount", t: or },
  /*::[*/
  17: { n: "Thumbnail", t: Rf },
  /*::[*/
  18: { n: "Application", t: Xe },
  /*::[*/
  19: { n: "DocSecurity", t: or },
  /*::[*/
  255: {},
  /* [MS-OLEPS] 2.18 */
  /*::[*/
  2147483648: { n: "Locale", t: Ft },
  /*::[*/
  2147483651: { n: "Behavior", t: Ft },
  /*::[*/
  1919054434: {}
}, un = {
  /*::[*/
  1: "US",
  // United States
  /*::[*/
  2: "CA",
  // Canada
  /*::[*/
  3: "",
  // Latin America (except Brazil)
  /*::[*/
  7: "RU",
  // Russia
  /*::[*/
  20: "EG",
  // Egypt
  /*::[*/
  30: "GR",
  // Greece
  /*::[*/
  31: "NL",
  // Netherlands
  /*::[*/
  32: "BE",
  // Belgium
  /*::[*/
  33: "FR",
  // France
  /*::[*/
  34: "ES",
  // Spain
  /*::[*/
  36: "HU",
  // Hungary
  /*::[*/
  39: "IT",
  // Italy
  /*::[*/
  41: "CH",
  // Switzerland
  /*::[*/
  43: "AT",
  // Austria
  /*::[*/
  44: "GB",
  // United Kingdom
  /*::[*/
  45: "DK",
  // Denmark
  /*::[*/
  46: "SE",
  // Sweden
  /*::[*/
  47: "NO",
  // Norway
  /*::[*/
  48: "PL",
  // Poland
  /*::[*/
  49: "DE",
  // Germany
  /*::[*/
  52: "MX",
  // Mexico
  /*::[*/
  55: "BR",
  // Brazil
  /*::[*/
  61: "AU",
  // Australia
  /*::[*/
  64: "NZ",
  // New Zealand
  /*::[*/
  66: "TH",
  // Thailand
  /*::[*/
  81: "JP",
  // Japan
  /*::[*/
  82: "KR",
  // Korea
  /*::[*/
  84: "VN",
  // Viet Nam
  /*::[*/
  86: "CN",
  // China
  /*::[*/
  90: "TR",
  // Turkey
  /*::[*/
  105: "JS",
  // Ramastan
  /*::[*/
  213: "DZ",
  // Algeria
  /*::[*/
  216: "MA",
  // Morocco
  /*::[*/
  218: "LY",
  // Libya
  /*::[*/
  351: "PT",
  // Portugal
  /*::[*/
  354: "IS",
  // Iceland
  /*::[*/
  358: "FI",
  // Finland
  /*::[*/
  420: "CZ",
  // Czech Republic
  /*::[*/
  886: "TW",
  // Taiwan
  /*::[*/
  961: "LB",
  // Lebanon
  /*::[*/
  962: "JO",
  // Jordan
  /*::[*/
  963: "SY",
  // Syria
  /*::[*/
  964: "IQ",
  // Iraq
  /*::[*/
  965: "KW",
  // Kuwait
  /*::[*/
  966: "SA",
  // Saudi Arabia
  /*::[*/
  971: "AE",
  // United Arab Emirates
  /*::[*/
  972: "IL",
  // Israel
  /*::[*/
  974: "QA",
  // Qatar
  /*::[*/
  981: "IR",
  // Iran
  /*::[*/
  65535: "US"
  // United States
}, Mf = [
  null,
  "solid",
  "mediumGray",
  "darkGray",
  "lightGray",
  "darkHorizontal",
  "darkVertical",
  "darkDown",
  "darkUp",
  "darkGrid",
  "darkTrellis",
  "lightHorizontal",
  "lightVertical",
  "lightDown",
  "lightUp",
  "lightGrid",
  "lightTrellis",
  "gray125",
  "gray0625"
];
function bf(e) {
  return e.map(function(a) {
    return [a >> 16 & 255, a >> 8 & 255, a & 255];
  });
}
var Bf = /* @__PURE__ */ bf([
  /* Color Constants */
  0,
  16777215,
  16711680,
  65280,
  255,
  16776960,
  16711935,
  65535,
  /* Overridable Defaults */
  0,
  16777215,
  16711680,
  65280,
  255,
  16776960,
  16711935,
  65535,
  8388608,
  32768,
  128,
  8421376,
  8388736,
  32896,
  12632256,
  8421504,
  10066431,
  10040166,
  16777164,
  13434879,
  6684774,
  16744576,
  26316,
  13421823,
  128,
  16711935,
  16776960,
  65535,
  8388736,
  8388608,
  32896,
  255,
  52479,
  13434879,
  13434828,
  16777113,
  10079487,
  16751052,
  13408767,
  16764057,
  3368703,
  3394764,
  10079232,
  16763904,
  16750848,
  16737792,
  6710937,
  9868950,
  13158,
  3381606,
  13056,
  3355392,
  10040064,
  10040166,
  3355545,
  3355443,
  /* Other entries to appease BIFF8/12 */
  16777215,
  /* 0x40 icvForeground ?? */
  0,
  /* 0x41 icvBackground ?? */
  0,
  /* 0x42 icvFrame ?? */
  0,
  /* 0x43 icv3D ?? */
  0,
  /* 0x44 icv3DText ?? */
  0,
  /* 0x45 icv3DHilite ?? */
  0,
  /* 0x46 icv3DShadow ?? */
  0,
  /* 0x47 icvHilite ?? */
  0,
  /* 0x48 icvCtlText ?? */
  0,
  /* 0x49 icvCtlScrl ?? */
  0,
  /* 0x4A icvCtlInv ?? */
  0,
  /* 0x4B icvCtlBody ?? */
  0,
  /* 0x4C icvCtlFrame ?? */
  0,
  /* 0x4D icvCtlFore ?? */
  0,
  /* 0x4E icvCtlBack ?? */
  0,
  /* 0x4F icvCtlNeutral */
  0,
  /* 0x50 icvInfoBk ?? */
  0
  /* 0x51 icvInfoText ?? */
]), sa = /* @__PURE__ */ Ye(Bf), pa = {
  /*::[*/
  0: "#NULL!",
  /*::[*/
  7: "#DIV/0!",
  /*::[*/
  15: "#VALUE!",
  /*::[*/
  23: "#REF!",
  /*::[*/
  29: "#NAME?",
  /*::[*/
  36: "#NUM!",
  /*::[*/
  42: "#N/A",
  /*::[*/
  43: "#GETTING_DATA",
  /*::[*/
  255: "#WTF?"
}, Ii = {
  "#NULL!": 0,
  "#DIV/0!": 7,
  "#VALUE!": 15,
  "#REF!": 23,
  "#NAME?": 29,
  "#NUM!": 36,
  "#N/A": 42,
  "#GETTING_DATA": 43,
  "#WTF?": 255
}, hn = {
  /* Workbook */
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml": "workbooks",
  "application/vnd.ms-excel.sheet.macroEnabled.main+xml": "workbooks",
  "application/vnd.ms-excel.sheet.binary.macroEnabled.main": "workbooks",
  "application/vnd.ms-excel.addin.macroEnabled.main+xml": "workbooks",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml": "workbooks",
  /* Worksheet */
  "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml": "sheets",
  "application/vnd.ms-excel.worksheet": "sheets",
  "application/vnd.ms-excel.binIndexWs": "TODO",
  /* Binary Index */
  /* Chartsheet */
  "application/vnd.openxmlformats-officedocument.spreadsheetml.chartsheet+xml": "charts",
  "application/vnd.ms-excel.chartsheet": "charts",
  /* Macrosheet */
  "application/vnd.ms-excel.macrosheet+xml": "macros",
  "application/vnd.ms-excel.macrosheet": "macros",
  "application/vnd.ms-excel.intlmacrosheet": "TODO",
  "application/vnd.ms-excel.binIndexMs": "TODO",
  /* Binary Index */
  /* Dialogsheet */
  "application/vnd.openxmlformats-officedocument.spreadsheetml.dialogsheet+xml": "dialogs",
  "application/vnd.ms-excel.dialogsheet": "dialogs",
  /* Shared Strings */
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml": "strs",
  "application/vnd.ms-excel.sharedStrings": "strs",
  /* Styles */
  "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml": "styles",
  "application/vnd.ms-excel.styles": "styles",
  /* File Properties */
  "application/vnd.openxmlformats-package.core-properties+xml": "coreprops",
  "application/vnd.openxmlformats-officedocument.custom-properties+xml": "custprops",
  "application/vnd.openxmlformats-officedocument.extended-properties+xml": "extprops",
  /* Custom Data Properties */
  "application/vnd.openxmlformats-officedocument.customXmlProperties+xml": "TODO",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.customProperty": "TODO",
  /* Comments */
  "application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml": "comments",
  "application/vnd.ms-excel.comments": "comments",
  "application/vnd.ms-excel.threadedcomments+xml": "threadedcomments",
  "application/vnd.ms-excel.person+xml": "people",
  /* Metadata (Stock/Geography and Dynamic Array) */
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheetMetadata+xml": "metadata",
  "application/vnd.ms-excel.sheetMetadata": "metadata",
  /* PivotTable */
  "application/vnd.ms-excel.pivotTable": "TODO",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotTable+xml": "TODO",
  /* Chart Objects */
  "application/vnd.openxmlformats-officedocument.drawingml.chart+xml": "TODO",
  /* Chart Colors */
  "application/vnd.ms-office.chartcolorstyle+xml": "TODO",
  /* Chart Style */
  "application/vnd.ms-office.chartstyle+xml": "TODO",
  /* Chart Advanced */
  "application/vnd.ms-office.chartex+xml": "TODO",
  /* Calculation Chain */
  "application/vnd.ms-excel.calcChain": "calcchains",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml": "calcchains",
  /* Printer Settings */
  "application/vnd.openxmlformats-officedocument.spreadsheetml.printerSettings": "TODO",
  /* ActiveX */
  "application/vnd.ms-office.activeX": "TODO",
  "application/vnd.ms-office.activeX+xml": "TODO",
  /* Custom Toolbars */
  "application/vnd.ms-excel.attachedToolbars": "TODO",
  /* External Data Connections */
  "application/vnd.ms-excel.connections": "TODO",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.connections+xml": "TODO",
  /* External Links */
  "application/vnd.ms-excel.externalLink": "links",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.externalLink+xml": "links",
  /* PivotCache */
  "application/vnd.ms-excel.pivotCacheDefinition": "TODO",
  "application/vnd.ms-excel.pivotCacheRecords": "TODO",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotCacheDefinition+xml": "TODO",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotCacheRecords+xml": "TODO",
  /* Query Table */
  "application/vnd.ms-excel.queryTable": "TODO",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.queryTable+xml": "TODO",
  /* Shared Workbook */
  "application/vnd.ms-excel.userNames": "TODO",
  "application/vnd.ms-excel.revisionHeaders": "TODO",
  "application/vnd.ms-excel.revisionLog": "TODO",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.revisionHeaders+xml": "TODO",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.revisionLog+xml": "TODO",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.userNames+xml": "TODO",
  /* Single Cell Table */
  "application/vnd.ms-excel.tableSingleCells": "TODO",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.tableSingleCells+xml": "TODO",
  /* Slicer */
  "application/vnd.ms-excel.slicer": "TODO",
  "application/vnd.ms-excel.slicerCache": "TODO",
  "application/vnd.ms-excel.slicer+xml": "TODO",
  "application/vnd.ms-excel.slicerCache+xml": "TODO",
  /* Sort Map */
  "application/vnd.ms-excel.wsSortMap": "TODO",
  /* Table */
  "application/vnd.ms-excel.table": "TODO",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml": "TODO",
  /* Themes */
  "application/vnd.openxmlformats-officedocument.theme+xml": "themes",
  /* Theme Override */
  "application/vnd.openxmlformats-officedocument.themeOverride+xml": "TODO",
  /* Timeline */
  "application/vnd.ms-excel.Timeline+xml": "TODO",
  /* verify */
  "application/vnd.ms-excel.TimelineCache+xml": "TODO",
  /* verify */
  /* VBA */
  "application/vnd.ms-office.vbaProject": "vba",
  "application/vnd.ms-office.vbaProjectSignature": "TODO",
  /* Volatile Dependencies */
  "application/vnd.ms-office.volatileDependencies": "TODO",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.volatileDependencies+xml": "TODO",
  /* Control Properties */
  "application/vnd.ms-excel.controlproperties+xml": "TODO",
  /* Data Model */
  "application/vnd.openxmlformats-officedocument.model+data": "TODO",
  /* Survey */
  "application/vnd.ms-excel.Survey+xml": "TODO",
  /* Drawing */
  "application/vnd.openxmlformats-officedocument.drawing+xml": "drawings",
  "application/vnd.openxmlformats-officedocument.drawingml.chartshapes+xml": "TODO",
  "application/vnd.openxmlformats-officedocument.drawingml.diagramColors+xml": "TODO",
  "application/vnd.openxmlformats-officedocument.drawingml.diagramData+xml": "TODO",
  "application/vnd.openxmlformats-officedocument.drawingml.diagramLayout+xml": "TODO",
  "application/vnd.openxmlformats-officedocument.drawingml.diagramStyle+xml": "TODO",
  /* VML */
  "application/vnd.openxmlformats-officedocument.vmlDrawing": "TODO",
  "application/vnd.openxmlformats-package.relationships+xml": "rels",
  "application/vnd.openxmlformats-officedocument.oleObject": "TODO",
  /* Image */
  "image/png": "TODO",
  sheet: "js"
};
function Uf() {
  return {
    workbooks: [],
    sheets: [],
    charts: [],
    dialogs: [],
    macros: [],
    rels: [],
    strs: [],
    comments: [],
    threadedcomments: [],
    links: [],
    coreprops: [],
    extprops: [],
    custprops: [],
    themes: [],
    styles: [],
    calcchains: [],
    vba: [],
    drawings: [],
    metadata: [],
    people: [],
    TODO: [],
    xmlns: ""
  };
}
function Hf(e) {
  var a = Uf();
  if (!e || !e.match) return a;
  var r = {};
  if ((e.match(ar) || []).forEach(function(t) {
    var n = oe(t);
    switch (n[0].replace(Yc, "<")) {
      case "<?xml":
        break;
      case "<Types":
        a.xmlns = n["xmlns" + (n[0].match(/<(\w+):/) || ["", ""])[1]];
        break;
      case "<Default":
        r[n.Extension] = n.ContentType;
        break;
      case "<Override":
        a[hn[n.ContentType]] !== void 0 && a[hn[n.ContentType]].push(n.PartName);
        break;
    }
  }), a.xmlns !== nf.CT) throw new Error("Unknown Namespace: " + a.xmlns);
  return a.calcchain = a.calcchains.length > 0 ? a.calcchains[0] : "", a.sst = a.strs.length > 0 ? a.strs[0] : "", a.style = a.styles.length > 0 ? a.styles[0] : "", a.defaults = r, delete a.calcchains, a;
}
var Ea = {
  WB: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument",
  SHEET: "http://sheetjs.openxmlformats.org/officeDocument/2006/relationships/officeDocument",
  HLINK: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink",
  VML: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing",
  XPATH: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/externalLinkPath",
  XMISS: "http://schemas.microsoft.com/office/2006/relationships/xlExternalLinkPath/xlPathMissing",
  XLINK: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/externalLink",
  CXML: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml",
  CXMLP: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXmlProps",
  CMNT: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments",
  CORE_PROPS: "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties",
  EXT_PROPS: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties",
  CUST_PROPS: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties",
  SST: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings",
  STY: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles",
  THEME: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme",
  CHART: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart",
  CHARTEX: "http://schemas.microsoft.com/office/2014/relationships/chartEx",
  CS: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chartsheet",
  WS: [
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet",
    "http://purl.oclc.org/ooxml/officeDocument/relationships/worksheet"
  ],
  DS: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/dialogsheet",
  MS: "http://schemas.microsoft.com/office/2006/relationships/xlMacrosheet",
  IMG: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image",
  DRAW: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing",
  XLMETA: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/sheetMetadata",
  TCMNT: "http://schemas.microsoft.com/office/2017/10/relationships/threadedComment",
  PEOPLE: "http://schemas.microsoft.com/office/2017/10/relationships/person",
  VBA: "http://schemas.microsoft.com/office/2006/relationships/vbaProject"
};
function Jt(e) {
  var a = e.lastIndexOf("/");
  return e.slice(0, a + 1) + "_rels/" + e.slice(a + 1) + ".rels";
}
function Wa(e, a) {
  var r = { "!id": {} };
  if (!e) return r;
  a.charAt(0) !== "/" && (a = "/" + a);
  var t = {};
  return (e.match(ar) || []).forEach(function(n) {
    var i = oe(n);
    if (i[0] === "<Relationship") {
      var s = {};
      s.Type = i.Type, s.Target = i.Target, s.Id = i.Id, i.TargetMode && (s.TargetMode = i.TargetMode);
      var c = i.TargetMode === "External" ? i.Target : Ma(i.Target, a);
      r[c] = s, t[i.Id] = s;
    }
  }), r["!id"] = t, r;
}
var Wf = "application/vnd.oasis.opendocument.spreadsheet";
function Vf(e, a) {
  for (var r = d0(e), t, n; t = Ja.exec(r); ) switch (t[3]) {
    case "manifest":
      break;
    case "file-entry":
      if (n = oe(t[0], !1), n.path == "/" && n.type !== Wf) throw new Error("This OpenDocument is not a spreadsheet");
      break;
    case "encryption-data":
    case "algorithm":
    case "start-key-generation":
    case "key-derivation":
      throw new Error("Unsupported ODS Encryption");
    default:
      if (a && a.WTF) throw t;
  }
}
var Va = [
  ["cp:category", "Category"],
  ["cp:contentStatus", "ContentStatus"],
  ["cp:keywords", "Keywords"],
  ["cp:lastModifiedBy", "LastAuthor"],
  ["cp:lastPrinted", "LastPrinted"],
  ["cp:revision", "RevNumber"],
  ["cp:version", "Version"],
  ["dc:creator", "Author"],
  ["dc:description", "Comments"],
  ["dc:identifier", "Identifier"],
  ["dc:language", "Language"],
  ["dc:subject", "Subject"],
  ["dc:title", "Title"],
  ["dcterms:created", "CreatedDate", "date"],
  ["dcterms:modified", "ModifiedDate", "date"]
], Gf = /* @__PURE__ */ function() {
  for (var e = new Array(Va.length), a = 0; a < Va.length; ++a) {
    var r = Va[a], t = "(?:" + r[0].slice(0, r[0].indexOf(":")) + ":)" + r[0].slice(r[0].indexOf(":") + 1);
    e[a] = new RegExp("<" + t + "[^>]*>([\\s\\S]*?)</" + t + ">");
  }
  return e;
}();
function Li(e) {
  var a = {};
  e = Fe(e);
  for (var r = 0; r < Va.length; ++r) {
    var t = Va[r], n = e.match(Gf[r]);
    n != null && n.length > 0 && (a[t[1]] = ke(n[1])), t[2] === "date" && a[t[1]] && (a[t[1]] = ze(a[t[1]]));
  }
  return a;
}
var Xf = [
  ["Application", "Application", "string"],
  ["AppVersion", "AppVersion", "string"],
  ["Company", "Company", "string"],
  ["DocSecurity", "DocSecurity", "string"],
  ["Manager", "Manager", "string"],
  ["HyperlinksChanged", "HyperlinksChanged", "bool"],
  ["SharedDoc", "SharedDoc", "bool"],
  ["LinksUpToDate", "LinksUpToDate", "bool"],
  ["ScaleCrop", "ScaleCrop", "bool"],
  ["HeadingPairs", "HeadingPairs", "raw"],
  ["TitlesOfParts", "TitlesOfParts", "raw"]
];
function Pi(e, a, r, t) {
  var n = [];
  if (typeof e == "string") n = rn(e, t);
  else for (var i = 0; i < e.length; ++i) n = n.concat(e[i].map(function(l) {
    return { v: l };
  }));
  var s = typeof a == "string" ? rn(a, t).map(function(l) {
    return l.v;
  }) : a, c = 0, f = 0;
  if (s.length > 0) for (var o = 0; o !== n.length; o += 2) {
    switch (f = +n[o + 1].v, n[o].v) {
      case "Worksheets":
      case "工作表":
      case "Листы":
      case "أوراق العمل":
      case "ワークシート":
      case "גליונות עבודה":
      case "Arbeitsblätter":
      case "Çalışma Sayfaları":
      case "Feuilles de calcul":
      case "Fogli di lavoro":
      case "Folhas de cálculo":
      case "Planilhas":
      case "Regneark":
      case "Hojas de cálculo":
      case "Werkbladen":
        r.Worksheets = f, r.SheetNames = s.slice(c, c + f);
        break;
      case "Named Ranges":
      case "Rangos con nombre":
      case "名前付き一覧":
      case "Benannte Bereiche":
      case "Navngivne områder":
        r.NamedRanges = f, r.DefinedNames = s.slice(c, c + f);
        break;
      case "Charts":
      case "Diagramme":
        r.Chartsheets = f, r.ChartNames = s.slice(c, c + f);
        break;
    }
    c += f;
  }
}
function zf(e, a, r) {
  var t = {};
  return a || (a = {}), e = Fe(e), Xf.forEach(function(n) {
    var i = (e.match(ja(n[0])) || [])[1];
    switch (n[2]) {
      case "string":
        i && (a[n[1]] = ke(i));
        break;
      case "bool":
        a[n[1]] = i === "true";
        break;
      case "raw":
        var s = e.match(new RegExp("<" + n[0] + "[^>]*>([\\s\\S]*?)</" + n[0] + ">"));
        s && s.length > 0 && (t[n[1]] = s[1]);
        break;
    }
  }), t.HeadingPairs && t.TitlesOfParts && Pi(t.HeadingPairs, t.TitlesOfParts, a, r), a;
}
var $f = /<[^>]+>[^<]*/g;
function Yf(e, a) {
  var r = {}, t = "", n = e.match($f);
  if (n) for (var i = 0; i != n.length; ++i) {
    var s = n[i], c = oe(s);
    switch (c[0]) {
      case "<?xml":
        break;
      case "<Properties":
        break;
      case "<property":
        t = ke(c.name);
        break;
      case "</property>":
        t = null;
        break;
      default:
        if (s.indexOf("<vt:") === 0) {
          var f = s.split(">"), o = f[0].slice(4), l = f[1];
          switch (o) {
            case "lpstr":
            case "bstr":
            case "lpwstr":
              r[t] = ke(l);
              break;
            case "bool":
              r[t] = Ce(l);
              break;
            case "i1":
            case "i2":
            case "i4":
            case "i8":
            case "int":
            case "uint":
              r[t] = parseInt(l, 10);
              break;
            case "r4":
            case "r8":
            case "decimal":
              r[t] = parseFloat(l);
              break;
            case "filetime":
            case "date":
              r[t] = ze(l);
              break;
            case "cy":
            case "error":
              r[t] = ke(l);
              break;
            default:
              if (o.slice(-1) == "/") break;
              a.WTF && typeof console < "u" && console.warn("Unexpected", s, o, f);
          }
        } else if (s.slice(0, 2) !== "</") {
          if (a.WTF) throw new Error(s);
        }
    }
  }
  return r;
}
var Kf = {
  Title: "Title",
  Subject: "Subject",
  Author: "Author",
  Keywords: "Keywords",
  Comments: "Description",
  LastAuthor: "LastAuthor",
  RevNumber: "Revision",
  Application: "AppName",
  /* TotalTime: 'TotalTime', */
  LastPrinted: "LastPrinted",
  CreatedDate: "Created",
  ModifiedDate: "LastSaved",
  /* Pages */
  /* Words */
  /* Characters */
  Category: "Category",
  /* PresentationFormat */
  Manager: "Manager",
  Company: "Company",
  /* Guid */
  /* HyperlinkBase */
  /* Bytes */
  /* Lines */
  /* Paragraphs */
  /* CharactersWithSpaces */
  AppVersion: "Version",
  ContentStatus: "ContentStatus",
  /* NOTE: missing from schema */
  Identifier: "Identifier",
  /* NOTE: missing from schema */
  Language: "Language"
  /* NOTE: missing from schema */
}, Ht;
function jf(e, a, r) {
  Ht || (Ht = u0(Kf)), a = Ht[a] || a, e[a] = r;
}
function k0(e) {
  var a = e.read_shift(4), r = e.read_shift(4);
  return new Date((r / 1e7 * Math.pow(2, 32) + a / 1e7 - 11644473600) * 1e3).toISOString().replace(/\.000/, "");
}
function Mi(e, a, r) {
  var t = e.l, n = e.read_shift(0, "lpstr-cp");
  if (r) for (; e.l - t & 3; ) ++e.l;
  return n;
}
function bi(e, a, r) {
  var t = e.read_shift(0, "lpwstr");
  return t;
}
function Bi(e, a, r) {
  return a === 31 ? bi(e) : Mi(e, a, r);
}
function Zt(e, a, r) {
  return Bi(e, a, r === !1 ? 0 : 4);
}
function Jf(e, a) {
  if (!a) throw new Error("VtUnalignedString must have positive length");
  return Bi(e, a, 0);
}
function Zf(e) {
  for (var a = e.read_shift(4), r = [], t = 0; t != a; ++t) {
    var n = e.l;
    r[t] = e.read_shift(0, "lpwstr").replace(cr, ""), e.l - n & 2 && (e.l += 2);
  }
  return r;
}
function qf(e) {
  for (var a = e.read_shift(4), r = [], t = 0; t != a; ++t) r[t] = e.read_shift(0, "lpstr-cp").replace(cr, "");
  return r;
}
function Qf(e) {
  var a = e.l, r = St(e, Ni);
  e[e.l] == 0 && e[e.l + 1] == 0 && e.l - a & 2 && (e.l += 2);
  var t = St(e, or);
  return [r, t];
}
function eo(e) {
  for (var a = e.read_shift(4), r = [], t = 0; t < a / 2; ++t) r.push(Qf(e));
  return r;
}
function xn(e, a) {
  for (var r = e.read_shift(4), t = {}, n = 0; n != r; ++n) {
    var i = e.read_shift(4), s = e.read_shift(4);
    t[i] = e.read_shift(s, a === 1200 ? "utf16le" : "utf8").replace(cr, "").replace(Pa, "!"), a === 1200 && s % 2 && (e.l += 2);
  }
  return e.l & 3 && (e.l = e.l >> 3 << 2), t;
}
function Ui(e) {
  var a = e.read_shift(4), r = e.slice(e.l, e.l + a);
  return e.l += a, (a & 3) > 0 && (e.l += 4 - (a & 3) & 3), r;
}
function ro(e) {
  var a = {};
  return a.Size = e.read_shift(4), e.l += a.Size + 3 - (a.Size - 1) % 4, a;
}
function St(e, a, r) {
  var t = e.read_shift(2), n, i = r || {};
  if (e.l += 2, a !== ln && t !== a && If.indexOf(a) === -1 && !((a & 65534) == 4126 && (t & 65534) == 4126))
    throw new Error("Expected type " + a + " saw " + t);
  switch (a === ln ? t : a) {
    case 2:
      return n = e.read_shift(2, "i"), i.raw || (e.l += 2), n;
    case 3:
      return n = e.read_shift(4, "i"), n;
    case 11:
      return e.read_shift(4) !== 0;
    case 19:
      return n = e.read_shift(4), n;
    case 30:
      return Mi(e, t, 4).replace(cr, "");
    case 31:
      return bi(e);
    case 64:
      return k0(e);
    case 65:
      return Ui(e);
    case 71:
      return ro(e);
    case 80:
      return Zt(e, t, !i.raw).replace(cr, "");
    case 81:
      return Jf(
        e,
        t
        /*, 4*/
      ).replace(cr, "");
    case 4108:
      return eo(e);
    case 4126:
    case 4127:
      return t == 4127 ? Zf(e) : qf(e);
    default:
      throw new Error("TypedPropertyValue unrecognized type " + a + " " + t);
  }
}
function dn(e, a) {
  var r = e.l, t = e.read_shift(4), n = e.read_shift(4), i = [], s = 0, c = 0, f = -1, o = {};
  for (s = 0; s != n; ++s) {
    var l = e.read_shift(4), u = e.read_shift(4);
    i[s] = [l, u + r];
  }
  i.sort(function(y, E) {
    return y[1] - E[1];
  });
  var x = {};
  for (s = 0; s != n; ++s) {
    if (e.l !== i[s][1]) {
      var d = !0;
      if (s > 0 && a) switch (a[i[s - 1][0]].t) {
        case 2:
          e.l + 2 === i[s][1] && (e.l += 2, d = !1);
          break;
        case 80:
          e.l <= i[s][1] && (e.l = i[s][1], d = !1);
          break;
        case 4108:
          e.l <= i[s][1] && (e.l = i[s][1], d = !1);
          break;
      }
      if ((!a || s == 0) && e.l <= i[s][1] && (d = !1, e.l = i[s][1]), d) throw new Error("Read Error: Expected address " + i[s][1] + " at " + e.l + " :" + s);
    }
    if (a) {
      var p = a[i[s][0]];
      if (x[p.n] = St(e, p.t, { raw: !0 }), p.p === "version" && (x[p.n] = String(x[p.n] >> 16) + "." + ("0000" + String(x[p.n] & 65535)).slice(-4)), p.n == "CodePage") switch (x[p.n]) {
        case 0:
          x[p.n] = 1252;
        case 874:
        case 932:
        case 936:
        case 949:
        case 950:
        case 1250:
        case 1251:
        case 1253:
        case 1254:
        case 1255:
        case 1256:
        case 1257:
        case 1258:
        case 1e4:
        case 1200:
        case 1201:
        case 1252:
        case 65e3:
        case -536:
        case 65001:
        case -535:
          Ar(c = x[p.n] >>> 0 & 65535);
          break;
        default:
          throw new Error("Unsupported CodePage: " + x[p.n]);
      }
    } else if (i[s][0] === 1) {
      if (c = x.CodePage = St(e, T0), Ar(c), f !== -1) {
        var h = e.l;
        e.l = i[f][1], o = xn(e, c), e.l = h;
      }
    } else if (i[s][0] === 0) {
      if (c === 0) {
        f = s, e.l = i[s + 1][1];
        continue;
      }
      o = xn(e, c);
    } else {
      var m = o[i[s][0]], A;
      switch (e[e.l]) {
        case 65:
          e.l += 4, A = Ui(e);
          break;
        case 30:
          e.l += 4, A = Zt(e, e[e.l - 4]).replace(/\u0000+$/, "");
          break;
        case 31:
          e.l += 4, A = Zt(e, e[e.l - 4]).replace(/\u0000+$/, "");
          break;
        case 3:
          e.l += 4, A = e.read_shift(4, "i");
          break;
        case 19:
          e.l += 4, A = e.read_shift(4);
          break;
        case 5:
          e.l += 4, A = e.read_shift(8, "f");
          break;
        case 11:
          e.l += 4, A = Me(e, 4);
          break;
        case 64:
          e.l += 4, A = ze(k0(e));
          break;
        default:
          throw new Error("unparsed value: " + e[e.l]);
      }
      x[m] = A;
    }
  }
  return e.l = r + t, x;
}
function pn(e, a, r) {
  var t = e.content;
  if (!t) return {};
  $e(t, 0);
  var n, i, s, c, f = 0;
  t.chk("feff", "Byte Order: "), t.read_shift(2);
  var o = t.read_shift(4), l = t.read_shift(16);
  if (l !== Ee.utils.consts.HEADER_CLSID && l !== r) throw new Error("Bad PropertySet CLSID " + l);
  if (n = t.read_shift(4), n !== 1 && n !== 2) throw new Error("Unrecognized #Sets: " + n);
  if (i = t.read_shift(16), c = t.read_shift(4), n === 1 && c !== t.l) throw new Error("Length mismatch: " + c + " !== " + t.l);
  n === 2 && (s = t.read_shift(16), f = t.read_shift(4));
  var u = dn(t, a), x = { SystemIdentifier: o };
  for (var d in u) x[d] = u[d];
  if (x.FMTID = i, n === 1) return x;
  if (f - t.l == 2 && (t.l += 2), t.l !== f) throw new Error("Length mismatch 2: " + t.l + " !== " + f);
  var p;
  try {
    p = dn(t, null);
  } catch {
  }
  for (d in p) x[d] = p[d];
  return x.FMTID = [i, s], x;
}
function zr(e, a) {
  return e.read_shift(a), null;
}
function ao(e, a, r) {
  for (var t = [], n = e.l + a; e.l < n; ) t.push(r(e, n - e.l));
  if (n !== e.l) throw new Error("Slurp error");
  return t;
}
function Me(e, a) {
  return e.read_shift(a) === 1;
}
function Ue(e) {
  return e.read_shift(2, "u");
}
function Hi(e, a) {
  return ao(e, a, Ue);
}
function to(e) {
  var a = e.read_shift(1), r = e.read_shift(1);
  return r === 1 ? a : a === 1;
}
function tt(e, a, r) {
  var t = e.read_shift(r && r.biff >= 12 ? 2 : 1), n = "sbcs-cont";
  if (r && r.biff >= 8, !r || r.biff == 8) {
    var i = e.read_shift(1);
    i && (n = "dbcs-cont");
  } else r.biff == 12 && (n = "wstr");
  r.biff >= 2 && r.biff <= 5 && (n = "cpstr");
  var s = t ? e.read_shift(t, n) : "";
  return s;
}
function no(e) {
  var a = e.read_shift(2), r = e.read_shift(1), t = r & 4, n = r & 8, i = 1 + (r & 1), s = 0, c, f = {};
  n && (s = e.read_shift(2)), t && (c = e.read_shift(4));
  var o = i == 2 ? "dbcs-cont" : "sbcs-cont", l = a === 0 ? "" : e.read_shift(a, o);
  return n && (e.l += 4 * s), t && (e.l += c), f.t = l, n || (f.raw = "<t>" + f.t + "</t>", f.r = f.t), f;
}
function la(e, a, r) {
  var t;
  if (r) {
    if (r.biff >= 2 && r.biff <= 5) return e.read_shift(a, "cpstr");
    if (r.biff >= 12) return e.read_shift(a, "dbcs-cont");
  }
  var n = e.read_shift(1);
  return n === 0 ? t = e.read_shift(a, "sbcs-cont") : t = e.read_shift(a, "dbcs-cont"), t;
}
function nt(e, a, r) {
  var t = e.read_shift(r && r.biff == 2 ? 1 : 2);
  return t === 0 ? (e.l++, "") : la(e, t, r);
}
function va(e, a, r) {
  if (r.biff > 5) return nt(e, a, r);
  var t = e.read_shift(1);
  return t === 0 ? (e.l++, "") : e.read_shift(t, r.biff <= 4 || !e.lens ? "cpstr" : "sbcs-cont");
}
function io(e) {
  var a = e.read_shift(1);
  e.l++;
  var r = e.read_shift(2);
  return e.l += 2, [a, r];
}
function so(e) {
  var a = e.read_shift(4), r = e.l, t = !1;
  a > 24 && (e.l += a - 24, e.read_shift(16) === "795881f43b1d7f48af2c825dc4852763" && (t = !0), e.l = r);
  var n = e.read_shift((t ? a - 24 : a) >> 1, "utf16le").replace(cr, "");
  return t && (e.l += 24), n;
}
function co(e) {
  for (var a = e.read_shift(2), r = ""; a-- > 0; ) r += "../";
  var t = e.read_shift(0, "lpstr-ansi");
  if (e.l += 2, e.read_shift(2) != 57005) throw new Error("Bad FileMoniker");
  var n = e.read_shift(4);
  if (n === 0) return r + t.replace(/\\/g, "/");
  var i = e.read_shift(4);
  if (e.read_shift(2) != 3) throw new Error("Bad FileMoniker");
  var s = e.read_shift(i >> 1, "utf16le").replace(cr, "");
  return r + s;
}
function fo(e, a) {
  var r = e.read_shift(16);
  switch (r) {
    case "e0c9ea79f9bace118c8200aa004ba90b":
      return so(e);
    case "0303000000000000c000000000000046":
      return co(e);
    default:
      throw new Error("Unsupported Moniker " + r);
  }
}
function xt(e) {
  var a = e.read_shift(4), r = a > 0 ? e.read_shift(a, "utf16le").replace(cr, "") : "";
  return r;
}
function oo(e, a) {
  var r = e.l + a, t = e.read_shift(4);
  if (t !== 2) throw new Error("Unrecognized streamVersion: " + t);
  var n = e.read_shift(2);
  e.l += 2;
  var i, s, c, f, o = "", l, u;
  n & 16 && (i = xt(e, r - e.l)), n & 128 && (s = xt(e, r - e.l)), (n & 257) === 257 && (c = xt(e, r - e.l)), (n & 257) === 1 && (f = fo(e, r - e.l)), n & 8 && (o = xt(e, r - e.l)), n & 32 && (l = e.read_shift(16)), n & 64 && (u = k0(
    e
    /*, 8*/
  )), e.l = r;
  var x = s || c || f || "";
  x && o && (x += "#" + o), x || (x = "#" + o), n & 2 && x.charAt(0) == "/" && x.charAt(1) != "/" && (x = "file://" + x);
  var d = { Target: x };
  return l && (d.guid = l), u && (d.time = u), i && (d.Tooltip = i), d;
}
function Wi(e) {
  var a = e.read_shift(1), r = e.read_shift(1), t = e.read_shift(1), n = e.read_shift(1);
  return [a, r, t, n];
}
function Vi(e, a) {
  var r = Wi(e);
  return r[3] = 0, r;
}
function Ir(e) {
  var a = e.read_shift(2), r = e.read_shift(2), t = e.read_shift(2);
  return { r: a, c: r, ixfe: t };
}
function lo(e) {
  var a = e.read_shift(2), r = e.read_shift(2);
  return e.l += 8, { type: a, flags: r };
}
function uo(e, a, r) {
  return a === 0 ? "" : va(e, a, r);
}
function ho(e, a, r) {
  var t = r.biff > 8 ? 4 : 2, n = e.read_shift(t), i = e.read_shift(t, "i"), s = e.read_shift(t, "i");
  return [n, i, s];
}
function Gi(e) {
  var a = e.read_shift(2), r = _0(e);
  return [a, r];
}
function xo(e, a, r) {
  e.l += 4, a -= 4;
  var t = e.l + a, n = tt(e, a, r), i = e.read_shift(2);
  if (t -= e.l, i !== t) throw new Error("Malformed AddinUdf: padding = " + t + " != " + i);
  return e.l += i, n;
}
function Nt(e) {
  var a = e.read_shift(2), r = e.read_shift(2), t = e.read_shift(2), n = e.read_shift(2);
  return { s: { c: t, r: a }, e: { c: n, r } };
}
function Xi(e) {
  var a = e.read_shift(2), r = e.read_shift(2), t = e.read_shift(1), n = e.read_shift(1);
  return { s: { c: t, r: a }, e: { c: n, r } };
}
var po = Xi;
function zi(e) {
  e.l += 4;
  var a = e.read_shift(2), r = e.read_shift(2), t = e.read_shift(2);
  return e.l += 12, [r, a, t];
}
function vo(e) {
  var a = {};
  return e.l += 4, e.l += 16, a.fSharedNote = e.read_shift(2), e.l += 4, a;
}
function mo(e) {
  var a = {};
  return e.l += 4, e.cf = e.read_shift(2), a;
}
function Je(e) {
  e.l += 2, e.l += e.read_shift(2);
}
var go = {
  /*::[*/
  0: Je,
  /* FtEnd */
  /*::[*/
  4: Je,
  /* FtMacro */
  /*::[*/
  5: Je,
  /* FtButton */
  /*::[*/
  6: Je,
  /* FtGmo */
  /*::[*/
  7: mo,
  /* FtCf */
  /*::[*/
  8: Je,
  /* FtPioGrbit */
  /*::[*/
  9: Je,
  /* FtPictFmla */
  /*::[*/
  10: Je,
  /* FtCbls */
  /*::[*/
  11: Je,
  /* FtRbo */
  /*::[*/
  12: Je,
  /* FtSbs */
  /*::[*/
  13: vo,
  /* FtNts */
  /*::[*/
  14: Je,
  /* FtSbsFmla */
  /*::[*/
  15: Je,
  /* FtGboData */
  /*::[*/
  16: Je,
  /* FtEdoData */
  /*::[*/
  17: Je,
  /* FtRboData */
  /*::[*/
  18: Je,
  /* FtCblsData */
  /*::[*/
  19: Je,
  /* FtLbsData */
  /*::[*/
  20: Je,
  /* FtCblsFmla */
  /*::[*/
  21: zi
};
function Eo(e, a) {
  for (var r = e.l + a, t = []; e.l < r; ) {
    var n = e.read_shift(2);
    e.l -= 2;
    try {
      t.push(go[n](e, r - e.l));
    } catch {
      return e.l = r, t;
    }
  }
  return e.l != r && (e.l = r), t;
}
function dt(e, a) {
  var r = { BIFFVer: 0, dt: 0 };
  switch (r.BIFFVer = e.read_shift(2), a -= 2, a >= 2 && (r.dt = e.read_shift(2), e.l -= 2), r.BIFFVer) {
    case 1536:
    case 1280:
    case 1024:
    case 768:
    case 512:
    case 2:
    case 7:
      break;
    default:
      if (a > 6) throw new Error("Unexpected BIFF Ver " + r.BIFFVer);
  }
  return e.read_shift(a), r;
}
function _o(e, a) {
  return a === 0 || e.read_shift(2), 1200;
}
function To(e, a, r) {
  if (r.enc)
    return e.l += a, "";
  var t = e.l, n = va(e, 0, r);
  return e.read_shift(a + t - e.l), n;
}
function ko(e, a, r) {
  var t = r && r.biff == 8 || a == 2 ? e.read_shift(2) : (e.l += a, 0);
  return { fDialog: t & 16, fBelow: t & 64, fRight: t & 128 };
}
function wo(e, a, r) {
  var t = e.read_shift(4), n = e.read_shift(1) & 3, i = e.read_shift(1);
  switch (i) {
    case 0:
      i = "Worksheet";
      break;
    case 1:
      i = "Macrosheet";
      break;
    case 2:
      i = "Chartsheet";
      break;
    case 6:
      i = "VBAModule";
      break;
  }
  var s = tt(e, 0, r);
  return s.length === 0 && (s = "Sheet1"), { pos: t, hs: n, dt: i, name: s };
}
function Ao(e, a) {
  for (var r = e.l + a, t = e.read_shift(4), n = e.read_shift(4), i = [], s = 0; s != n && e.l < r; ++s)
    i.push(no(e));
  return i.Count = t, i.Unique = n, i;
}
function Fo(e, a) {
  var r = {};
  return r.dsst = e.read_shift(2), e.l += a - 2, r;
}
function So(e) {
  var a = {};
  a.r = e.read_shift(2), a.c = e.read_shift(2), a.cnt = e.read_shift(2) - a.c;
  var r = e.read_shift(2);
  e.l += 4;
  var t = e.read_shift(1);
  return e.l += 3, t & 7 && (a.level = t & 7), t & 32 && (a.hidden = !0), t & 64 && (a.hpt = r / 20), a;
}
function Co(e) {
  var a = lo(e);
  if (a.type != 2211) throw new Error("Invalid Future Record " + a.type);
  var r = e.read_shift(4);
  return r !== 0;
}
function yo(e) {
  return e.read_shift(2), e.read_shift(4);
}
function vn(e, a, r) {
  var t = 0;
  r && r.biff == 2 || (t = e.read_shift(2));
  var n = e.read_shift(2);
  r && r.biff == 2 && (t = 1 - (n >> 15), n &= 32767);
  var i = { Unsynced: t & 1, DyZero: (t & 2) >> 1, ExAsc: (t & 4) >> 2, ExDsc: (t & 8) >> 3 };
  return [i, n];
}
function Do(e) {
  var a = e.read_shift(2), r = e.read_shift(2), t = e.read_shift(2), n = e.read_shift(2), i = e.read_shift(2), s = e.read_shift(2), c = e.read_shift(2), f = e.read_shift(2), o = e.read_shift(2);
  return {
    Pos: [a, r],
    Dim: [t, n],
    Flags: i,
    CurTab: s,
    FirstTab: c,
    Selected: f,
    TabRatio: o
  };
}
function Ro(e, a, r) {
  if (r && r.biff >= 2 && r.biff < 5) return {};
  var t = e.read_shift(2);
  return { RTL: t & 64 };
}
function Oo() {
}
function No(e, a, r) {
  var t = {
    dyHeight: e.read_shift(2),
    fl: e.read_shift(2)
  };
  switch (r && r.biff || 8) {
    case 2:
      break;
    case 3:
    case 4:
      e.l += 2;
      break;
    default:
      e.l += 10;
      break;
  }
  return t.name = tt(e, 0, r), t;
}
function Io(e) {
  var a = Ir(e);
  return a.isst = e.read_shift(4), a;
}
function Lo(e, a, r) {
  r.biffguess && r.biff == 2 && (r.biff = 5);
  var t = e.l + a, n = Ir(e);
  r.biff == 2 && e.l++;
  var i = nt(e, t - e.l, r);
  return n.val = i, n;
}
function Po(e, a, r) {
  var t = e.read_shift(2), n = va(e, 0, r);
  return [t, n];
}
var Mo = va;
function mn(e, a, r) {
  var t = e.l + a, n = r.biff == 8 || !r.biff ? 4 : 2, i = e.read_shift(n), s = e.read_shift(n), c = e.read_shift(2), f = e.read_shift(2);
  return e.l = t, { s: { r: i, c }, e: { r: s, c: f } };
}
function bo(e) {
  var a = e.read_shift(2), r = e.read_shift(2), t = Gi(e);
  return { r: a, c: r, ixfe: t[0], rknum: t[1] };
}
function Bo(e, a) {
  for (var r = e.l + a - 2, t = e.read_shift(2), n = e.read_shift(2), i = []; e.l < r; ) i.push(Gi(e));
  if (e.l !== r) throw new Error("MulRK read error");
  var s = e.read_shift(2);
  if (i.length != s - n + 1) throw new Error("MulRK length mismatch");
  return { r: t, c: n, C: s, rkrec: i };
}
function Uo(e, a) {
  for (var r = e.l + a - 2, t = e.read_shift(2), n = e.read_shift(2), i = []; e.l < r; ) i.push(e.read_shift(2));
  if (e.l !== r) throw new Error("MulBlank read error");
  var s = e.read_shift(2);
  if (i.length != s - n + 1) throw new Error("MulBlank length mismatch");
  return { r: t, c: n, C: s, ixfe: i };
}
function Ho(e, a, r, t) {
  var n = {}, i = e.read_shift(4), s = e.read_shift(4), c = e.read_shift(4), f = e.read_shift(2);
  return n.patternType = Mf[c >> 26], t.cellStyles && (n.alc = i & 7, n.fWrap = i >> 3 & 1, n.alcV = i >> 4 & 7, n.fJustLast = i >> 7 & 1, n.trot = i >> 8 & 255, n.cIndent = i >> 16 & 15, n.fShrinkToFit = i >> 20 & 1, n.iReadOrder = i >> 22 & 2, n.fAtrNum = i >> 26 & 1, n.fAtrFnt = i >> 27 & 1, n.fAtrAlc = i >> 28 & 1, n.fAtrBdr = i >> 29 & 1, n.fAtrPat = i >> 30 & 1, n.fAtrProt = i >> 31 & 1, n.dgLeft = s & 15, n.dgRight = s >> 4 & 15, n.dgTop = s >> 8 & 15, n.dgBottom = s >> 12 & 15, n.icvLeft = s >> 16 & 127, n.icvRight = s >> 23 & 127, n.grbitDiag = s >> 30 & 3, n.icvTop = c & 127, n.icvBottom = c >> 7 & 127, n.icvDiag = c >> 14 & 127, n.dgDiag = c >> 21 & 15, n.icvFore = f & 127, n.icvBack = f >> 7 & 127, n.fsxButton = f >> 14 & 1), n;
}
function Wo(e, a, r) {
  var t = {};
  return t.ifnt = e.read_shift(2), t.numFmtId = e.read_shift(2), t.flags = e.read_shift(2), t.fStyle = t.flags >> 2 & 1, a -= 6, t.data = Ho(e, a, t.fStyle, r), t;
}
function Vo(e) {
  e.l += 4;
  var a = [e.read_shift(2), e.read_shift(2)];
  if (a[0] !== 0 && a[0]--, a[1] !== 0 && a[1]--, a[0] > 7 || a[1] > 7) throw new Error("Bad Gutters: " + a.join("|"));
  return a;
}
function gn(e, a, r) {
  var t = Ir(e);
  (r.biff == 2 || a == 9) && ++e.l;
  var n = to(e);
  return t.val = n, t.t = n === !0 || n === !1 ? "b" : "e", t;
}
function Go(e, a, r) {
  r.biffguess && r.biff == 2 && (r.biff = 5);
  var t = Ir(e), n = qe(e);
  return t.val = n, t;
}
var En = uo;
function Xo(e, a, r) {
  var t = e.l + a, n = e.read_shift(2), i = e.read_shift(2);
  if (r.sbcch = i, i == 1025 || i == 14849) return [i, n];
  if (i < 1 || i > 255) throw new Error("Unexpected SupBook type: " + i);
  for (var s = la(e, i), c = []; t > e.l; ) c.push(nt(e));
  return [i, n, s, c];
}
function _n(e, a, r) {
  var t = e.read_shift(2), n, i = {
    fBuiltIn: t & 1,
    fWantAdvise: t >>> 1 & 1,
    fWantPict: t >>> 2 & 1,
    fOle: t >>> 3 & 1,
    fOleLink: t >>> 4 & 1,
    cf: t >>> 5 & 1023,
    fIcon: t >>> 15 & 1
  };
  return r.sbcch === 14849 && (n = xo(e, a - 2, r)), i.body = n || e.read_shift(a - 2), typeof n == "string" && (i.Name = n), i;
}
var zo = [
  "_xlnm.Consolidate_Area",
  "_xlnm.Auto_Open",
  "_xlnm.Auto_Close",
  "_xlnm.Extract",
  "_xlnm.Database",
  "_xlnm.Criteria",
  "_xlnm.Print_Area",
  "_xlnm.Print_Titles",
  "_xlnm.Recorder",
  "_xlnm.Data_Form",
  "_xlnm.Auto_Activate",
  "_xlnm.Auto_Deactivate",
  "_xlnm.Sheet_Title",
  "_xlnm._FilterDatabase"
];
function Tn(e, a, r) {
  var t = e.l + a, n = e.read_shift(2), i = e.read_shift(1), s = e.read_shift(1), c = e.read_shift(r && r.biff == 2 ? 1 : 2), f = 0;
  (!r || r.biff >= 5) && (r.biff != 5 && (e.l += 2), f = e.read_shift(2), r.biff == 5 && (e.l += 2), e.l += 4);
  var o = la(e, s, r);
  n & 32 && (o = zo[o.charCodeAt(0)]);
  var l = t - e.l;
  r && r.biff == 2 && --l;
  var u = t == e.l || c === 0 || !(l > 0) ? [] : Sh(e, l, r, c);
  return {
    chKey: i,
    Name: o,
    itab: f,
    rgce: u
  };
}
function $i(e, a, r) {
  if (r.biff < 8) return $o(e, a, r);
  for (var t = [], n = e.l + a, i = e.read_shift(r.biff > 8 ? 4 : 2); i-- !== 0; ) t.push(ho(e, r.biff > 8 ? 12 : 6, r));
  if (e.l != n) throw new Error("Bad ExternSheet: " + e.l + " != " + n);
  return t;
}
function $o(e, a, r) {
  e[e.l + 1] == 3 && e[e.l]++;
  var t = tt(e, a, r);
  return t.charCodeAt(0) == 3 ? t.slice(1) : t;
}
function Yo(e, a, r) {
  if (r.biff < 8) {
    e.l += a;
    return;
  }
  var t = e.read_shift(2), n = e.read_shift(2), i = la(e, t, r), s = la(e, n, r);
  return [i, s];
}
function Ko(e, a, r) {
  var t = Xi(e);
  e.l++;
  var n = e.read_shift(1);
  return a -= 8, [Ch(e, a, r), n, t];
}
function kn(e, a, r) {
  var t = po(e);
  switch (r.biff) {
    case 2:
      e.l++, a -= 7;
      break;
    case 3:
    case 4:
      e.l += 2, a -= 8;
      break;
    default:
      e.l += 6, a -= 12;
  }
  return [t, Ah(e, a, r)];
}
function jo(e) {
  var a = e.read_shift(4) !== 0, r = e.read_shift(4) !== 0, t = e.read_shift(4);
  return [a, r, t];
}
function Jo(e, a, r) {
  if (!(r.biff < 8)) {
    var t = e.read_shift(2), n = e.read_shift(2), i = e.read_shift(2), s = e.read_shift(2), c = va(e, 0, r);
    return r.biff < 8 && e.read_shift(1), [{ r: t, c: n }, c, s, i];
  }
}
function Zo(e, a, r) {
  return Jo(e, a, r);
}
function qo(e, a) {
  for (var r = [], t = e.read_shift(2); t--; ) r.push(Nt(e));
  return r;
}
function Qo(e, a, r) {
  if (r && r.biff < 8) return rl(e, a, r);
  var t = zi(e), n = Eo(e, a - 22, t[1]);
  return { cmo: t, ft: n };
}
var el = {
  8: function(e, a) {
    var r = e.l + a;
    e.l += 10;
    var t = e.read_shift(2);
    e.l += 4, e.l += 2, e.l += 2, e.l += 2, e.l += 4;
    var n = e.read_shift(1);
    return e.l += n, e.l = r, { fmt: t };
  }
};
function rl(e, a, r) {
  e.l += 4;
  var t = e.read_shift(2), n = e.read_shift(2), i = e.read_shift(2);
  e.l += 2, e.l += 2, e.l += 2, e.l += 2, e.l += 2, e.l += 2, e.l += 2, e.l += 2, e.l += 2, e.l += 6, a -= 36;
  var s = [];
  return s.push((el[t] || rr)(e, a, r)), { cmo: [n, t, i], ft: s };
}
function al(e, a, r) {
  var t = e.l, n = "";
  try {
    e.l += 4;
    var i = (r.lastobj || { cmo: [0, 0] }).cmo[1], s;
    [0, 5, 7, 11, 12, 14].indexOf(i) == -1 ? e.l += 6 : s = io(e, 6, r);
    var c = e.read_shift(2);
    e.read_shift(2), Ue(e, 2);
    var f = e.read_shift(2);
    e.l += f;
    for (var o = 1; o < e.lens.length - 1; ++o) {
      if (e.l - t != e.lens[o]) throw new Error("TxO: bad continue record");
      var l = e[e.l], u = la(e, e.lens[o + 1] - e.lens[o] - 1);
      if (n += u, n.length >= (l ? c : 2 * c)) break;
    }
    if (n.length !== c && n.length !== c * 2)
      throw new Error("cchText: " + c + " != " + n.length);
    return e.l = t + a, { t: n };
  } catch {
    return e.l = t + a, { t: n };
  }
}
function tl(e, a) {
  var r = Nt(e);
  e.l += 16;
  var t = oo(e, a - 24);
  return [r, t];
}
function nl(e, a) {
  e.read_shift(2);
  var r = Nt(e), t = e.read_shift((a - 10) / 2, "dbcs-cont");
  return t = t.replace(cr, ""), [r, t];
}
function il(e) {
  var a = [0, 0], r;
  return r = e.read_shift(2), a[0] = un[r] || r, r = e.read_shift(2), a[1] = un[r] || r, a;
}
function sl(e) {
  for (var a = e.read_shift(2), r = []; a-- > 0; ) r.push(Vi(e));
  return r;
}
function cl(e) {
  for (var a = e.read_shift(2), r = []; a-- > 0; ) r.push(Vi(e));
  return r;
}
function fl(e) {
  e.l += 2;
  var a = { cxfs: 0, crc: 0 };
  return a.cxfs = e.read_shift(2), a.crc = e.read_shift(4), a;
}
function Yi(e, a, r) {
  if (!r.cellStyles) return rr(e, a);
  var t = r && r.biff >= 12 ? 4 : 2, n = e.read_shift(t), i = e.read_shift(t), s = e.read_shift(t), c = e.read_shift(t), f = e.read_shift(2);
  t == 2 && (e.l += 2);
  var o = { s: n, e: i, w: s, ixfe: c, flags: f };
  return (r.biff >= 5 || !r.biff) && (o.level = f >> 8 & 7), o;
}
function ol(e, a) {
  var r = {};
  return a < 32 || (e.l += 16, r.header = qe(e), r.footer = qe(e), e.l += 2), r;
}
function ll(e, a, r) {
  var t = { area: !1 };
  if (r.biff != 5)
    return e.l += a, t;
  var n = e.read_shift(1);
  return e.l += 3, n & 16 && (t.area = !0), t;
}
var ul = Ir, hl = Hi, xl = nt;
function dl(e) {
  var a = e.read_shift(2), r = e.read_shift(2), t = e.read_shift(4), n = { fmt: a, env: r, len: t, data: e.slice(e.l, e.l + t) };
  return e.l += t, n;
}
function pl(e, a, r) {
  r.biffguess && r.biff == 5 && (r.biff = 2);
  var t = Ir(e);
  ++e.l;
  var n = va(e, a - 7, r);
  return t.t = "str", t.val = n, t;
}
function vl(e) {
  var a = Ir(e);
  ++e.l;
  var r = qe(e);
  return a.t = "n", a.val = r, a;
}
function ml(e) {
  var a = Ir(e);
  ++e.l;
  var r = e.read_shift(2);
  return a.t = "n", a.val = r, a;
}
function gl(e) {
  var a = e.read_shift(1);
  return a === 0 ? (e.l++, "") : e.read_shift(a, "sbcs-cont");
}
function El(e, a) {
  e.l += 6, e.l += 2, e.l += 1, e.l += 3, e.l += 1, e.l += a - 13;
}
function _l(e, a, r) {
  var t = e.l + a, n = Ir(e), i = e.read_shift(2), s = la(e, i, r);
  return e.l = t, n.t = "str", n.val = s, n;
}
var Tl = [2, 3, 48, 49, 131, 139, 140, 245], wn = /* @__PURE__ */ function() {
  var e = {
    /* Code Pages Supported by Visual FoxPro */
    /*::[*/
    1: 437,
    /*::[*/
    2: 850,
    /*::[*/
    3: 1252,
    /*::[*/
    4: 1e4,
    /*::[*/
    100: 852,
    /*::[*/
    101: 866,
    /*::[*/
    102: 865,
    /*::[*/
    103: 861,
    /*::[*/
    104: 895,
    /*::[*/
    105: 620,
    /*::[*/
    106: 737,
    /*::[*/
    107: 857,
    /*::[*/
    120: 950,
    /*::[*/
    121: 949,
    /*::[*/
    122: 936,
    /*::[*/
    123: 932,
    /*::[*/
    124: 874,
    /*::[*/
    125: 1255,
    /*::[*/
    126: 1256,
    /*::[*/
    150: 10007,
    /*::[*/
    151: 10029,
    /*::[*/
    152: 10006,
    /*::[*/
    200: 1250,
    /*::[*/
    201: 1251,
    /*::[*/
    202: 1254,
    /*::[*/
    203: 1253,
    /* shapefile DBF extension */
    /*::[*/
    0: 20127,
    /*::[*/
    8: 865,
    /*::[*/
    9: 437,
    /*::[*/
    10: 850,
    /*::[*/
    11: 437,
    /*::[*/
    13: 437,
    /*::[*/
    14: 850,
    /*::[*/
    15: 437,
    /*::[*/
    16: 850,
    /*::[*/
    17: 437,
    /*::[*/
    18: 850,
    /*::[*/
    19: 932,
    /*::[*/
    20: 850,
    /*::[*/
    21: 437,
    /*::[*/
    22: 850,
    /*::[*/
    23: 865,
    /*::[*/
    24: 437,
    /*::[*/
    25: 437,
    /*::[*/
    26: 850,
    /*::[*/
    27: 437,
    /*::[*/
    28: 863,
    /*::[*/
    29: 850,
    /*::[*/
    31: 852,
    /*::[*/
    34: 852,
    /*::[*/
    35: 852,
    /*::[*/
    36: 860,
    /*::[*/
    37: 850,
    /*::[*/
    38: 866,
    /*::[*/
    55: 850,
    /*::[*/
    64: 852,
    /*::[*/
    77: 936,
    /*::[*/
    78: 949,
    /*::[*/
    79: 950,
    /*::[*/
    80: 874,
    /*::[*/
    87: 1252,
    /*::[*/
    88: 1252,
    /*::[*/
    89: 1252,
    /*::[*/
    108: 863,
    /*::[*/
    134: 737,
    /*::[*/
    135: 852,
    /*::[*/
    136: 857,
    /*::[*/
    204: 1257,
    /*::[*/
    255: 16969
  }, a = u0({
    /*::[*/
    1: 437,
    /*::[*/
    2: 850,
    /*::[*/
    3: 1252,
    /*::[*/
    4: 1e4,
    /*::[*/
    100: 852,
    /*::[*/
    101: 866,
    /*::[*/
    102: 865,
    /*::[*/
    103: 861,
    /*::[*/
    104: 895,
    /*::[*/
    105: 620,
    /*::[*/
    106: 737,
    /*::[*/
    107: 857,
    /*::[*/
    120: 950,
    /*::[*/
    121: 949,
    /*::[*/
    122: 936,
    /*::[*/
    123: 932,
    /*::[*/
    124: 874,
    /*::[*/
    125: 1255,
    /*::[*/
    126: 1256,
    /*::[*/
    150: 10007,
    /*::[*/
    151: 10029,
    /*::[*/
    152: 10006,
    /*::[*/
    200: 1250,
    /*::[*/
    201: 1251,
    /*::[*/
    202: 1254,
    /*::[*/
    203: 1253,
    /*::[*/
    0: 20127
  });
  function r(c, f) {
    var o = [], l = Zr(1);
    switch (f.type) {
      case "base64":
        l = wr(xr(c));
        break;
      case "binary":
        l = wr(c);
        break;
      case "buffer":
      case "array":
        l = c;
        break;
    }
    $e(l, 0);
    var u = l.read_shift(1), x = !!(u & 136), d = !1, p = !1;
    switch (u) {
      case 2:
        break;
      case 3:
        break;
      case 48:
        d = !0, x = !0;
        break;
      case 49:
        d = !0, x = !0;
        break;
      case 131:
        break;
      case 139:
        break;
      case 140:
        p = !0;
        break;
      case 245:
        break;
      default:
        throw new Error("DBF Unsupported Version: " + u.toString(16));
    }
    var h = 0, m = 521;
    u == 2 && (h = l.read_shift(2)), l.l += 3, u != 2 && (h = l.read_shift(4)), h > 1048576 && (h = 1e6), u != 2 && (m = l.read_shift(2));
    var A = l.read_shift(2), y = f.codepage || 1252;
    u != 2 && (l.l += 16, l.read_shift(1), l[l.l] !== 0 && (y = e[l[l.l]]), l.l += 1, l.l += 2), p && (l.l += 36);
    for (var E = [], I = {}, b = Math.min(l.length, u == 2 ? 521 : m - 10 - (d ? 264 : 0)), O = p ? 32 : 11; l.l < b && l[l.l] != 13; )
      switch (I = {}, I.name = Ya.utils.decode(y, l.slice(l.l, l.l + O)).replace(/[\u0000\r\n].*$/g, ""), l.l += O, I.type = String.fromCharCode(l.read_shift(1)), u != 2 && !p && (I.offset = l.read_shift(4)), I.len = l.read_shift(1), u == 2 && (I.offset = l.read_shift(2)), I.dec = l.read_shift(1), I.name.length && E.push(I), u != 2 && (l.l += p ? 13 : 14), I.type) {
        case "B":
          (!d || I.len != 8) && f.WTF && console.log("Skipping " + I.name + ":" + I.type);
          break;
        case "G":
        case "P":
          f.WTF && console.log("Skipping " + I.name + ":" + I.type);
          break;
        case "+":
        case "0":
        case "@":
        case "C":
        case "D":
        case "F":
        case "I":
        case "L":
        case "M":
        case "N":
        case "O":
        case "T":
        case "Y":
          break;
        default:
          throw new Error("Unknown Field Type: " + I.type);
      }
    if (l[l.l] !== 13 && (l.l = m - 1), l.read_shift(1) !== 13) throw new Error("DBF Terminator not found " + l.l + " " + l[l.l]);
    l.l = m;
    var F = 0, W = 0;
    for (o[0] = [], W = 0; W != E.length; ++W) o[0][W] = E[W].name;
    for (; h-- > 0; ) {
      if (l[l.l] === 42) {
        l.l += A;
        continue;
      }
      for (++l.l, o[++F] = [], W = 0, W = 0; W != E.length; ++W) {
        var D = l.slice(l.l, l.l + E[W].len);
        l.l += E[W].len, $e(D, 0);
        var z = Ya.utils.decode(y, D);
        switch (E[W].type) {
          case "C":
            z.trim().length && (o[F][W] = z.replace(/\s+$/, ""));
            break;
          case "D":
            z.length === 8 ? o[F][W] = new Date(+z.slice(0, 4), +z.slice(4, 6) - 1, +z.slice(6, 8)) : o[F][W] = z;
            break;
          case "F":
            o[F][W] = parseFloat(z.trim());
            break;
          case "+":
          case "I":
            o[F][W] = p ? D.read_shift(-4, "i") ^ 2147483648 : D.read_shift(4, "i");
            break;
          case "L":
            switch (z.trim().toUpperCase()) {
              case "Y":
              case "T":
                o[F][W] = !0;
                break;
              case "N":
              case "F":
                o[F][W] = !1;
                break;
              case "":
              case "?":
                break;
              default:
                throw new Error("DBF Unrecognized L:|" + z + "|");
            }
            break;
          case "M":
            if (!x) throw new Error("DBF Unexpected MEMO for type " + u.toString(16));
            o[F][W] = "##MEMO##" + (p ? parseInt(z.trim(), 10) : D.read_shift(4));
            break;
          case "N":
            z = z.replace(/\u0000/g, "").trim(), z && z != "." && (o[F][W] = +z || 0);
            break;
          case "@":
            o[F][W] = new Date(D.read_shift(-8, "f") - 621356832e5);
            break;
          case "T":
            o[F][W] = new Date((D.read_shift(4) - 2440588) * 864e5 + D.read_shift(4));
            break;
          case "Y":
            o[F][W] = D.read_shift(4, "i") / 1e4 + D.read_shift(4, "i") / 1e4 * Math.pow(2, 32);
            break;
          case "O":
            o[F][W] = -D.read_shift(-8, "f");
            break;
          case "B":
            if (d && E[W].len == 8) {
              o[F][W] = D.read_shift(8, "f");
              break;
            }
          case "G":
          case "P":
            D.l += E[W].len;
            break;
          case "0":
            if (E[W].name === "_NullFlags") break;
          default:
            throw new Error("DBF Unsupported data type " + E[W].type);
        }
      }
    }
    if (u != 2 && l.l < l.length && l[l.l++] != 26) throw new Error("DBF EOF Marker missing " + (l.l - 1) + " of " + l.length + " " + l[l.l - 1].toString(16));
    return f && f.sheetRows && (o = o.slice(0, f.sheetRows)), f.DBF = E, o;
  }
  function t(c, f) {
    var o = f || {};
    o.dateNF || (o.dateNF = "yyyymmdd");
    var l = ya(r(c, o), o);
    return l["!cols"] = o.DBF.map(function(u) {
      return {
        wch: u.len,
        DBF: u
      };
    }), delete o.DBF, l;
  }
  function n(c, f) {
    try {
      return Qr(t(c, f), f);
    } catch (o) {
      if (f && f.WTF) throw o;
    }
    return { SheetNames: [], Sheets: {} };
  }
  var i = { B: 8, C: 250, L: 1, D: 8, "?": 0, "": 0 };
  function s(c, f) {
    var o = f || {};
    if (+o.codepage >= 0 && Ar(+o.codepage), o.type == "string") throw new Error("Cannot write DBF to JS string");
    var l = Kt(), u = n0(c, { header: 1, raw: !0, cellDates: !0 }), x = u[0], d = u.slice(1), p = c["!cols"] || [], h = 0, m = 0, A = 0, y = 1;
    for (h = 0; h < x.length; ++h) {
      if (((p[h] || {}).DBF || {}).name) {
        x[h] = p[h].DBF.name, ++A;
        continue;
      }
      if (x[h] != null) {
        if (++A, typeof x[h] == "number" && (x[h] = x[h].toString(10)), typeof x[h] != "string") throw new Error("DBF Invalid column name " + x[h] + " |" + typeof x[h] + "|");
        if (x.indexOf(x[h]) !== h) {
          for (m = 0; m < 1024; ++m)
            if (x.indexOf(x[h] + "_" + m) == -1) {
              x[h] += "_" + m;
              break;
            }
        }
      }
    }
    var E = Oe(c["!ref"]), I = [], b = [], O = [];
    for (h = 0; h <= E.e.c - E.s.c; ++h) {
      var F = "", W = "", D = 0, z = [];
      for (m = 0; m < d.length; ++m)
        d[m][h] != null && z.push(d[m][h]);
      if (z.length == 0 || x[h] == null) {
        I[h] = "?";
        continue;
      }
      for (m = 0; m < z.length; ++m) {
        switch (typeof z[m]) {
          case "number":
            W = "B";
            break;
          case "string":
            W = "C";
            break;
          case "boolean":
            W = "L";
            break;
          case "object":
            W = z[m] instanceof Date ? "D" : "C";
            break;
          default:
            W = "C";
        }
        D = Math.max(D, String(z[m]).length), F = F && F != W ? "C" : W;
      }
      D > 250 && (D = 250), W = ((p[h] || {}).DBF || {}).type, W == "C" && p[h].DBF.len > D && (D = p[h].DBF.len), F == "B" && W == "N" && (F = "N", O[h] = p[h].DBF.dec, D = p[h].DBF.len), b[h] = F == "C" || W == "N" ? D : i[F] || 0, y += b[h], I[h] = F;
    }
    var G = l.next(32);
    for (G.write_shift(4, 318902576), G.write_shift(4, d.length), G.write_shift(2, 296 + 32 * A), G.write_shift(2, y), h = 0; h < 4; ++h) G.write_shift(4, 0);
    for (G.write_shift(4, 0 | (+a[
      /*::String(*/
      $n
      /*::)*/
    ] || 3) << 8), h = 0, m = 0; h < x.length; ++h)
      if (x[h] != null) {
        var L = l.next(32), J = (x[h].slice(-10) + "\0\0\0\0\0\0\0\0\0\0\0").slice(0, 11);
        L.write_shift(1, J, "sbcs"), L.write_shift(1, I[h] == "?" ? "C" : I[h], "sbcs"), L.write_shift(4, m), L.write_shift(1, b[h] || i[I[h]] || 0), L.write_shift(1, O[h] || 0), L.write_shift(1, 2), L.write_shift(4, 0), L.write_shift(1, 0), L.write_shift(4, 0), L.write_shift(4, 0), m += b[h] || i[I[h]] || 0;
      }
    var fe = l.next(264);
    for (fe.write_shift(4, 13), h = 0; h < 65; ++h) fe.write_shift(4, 0);
    for (h = 0; h < d.length; ++h) {
      var re = l.next(y);
      for (re.write_shift(1, 0), m = 0; m < x.length; ++m)
        if (x[m] != null)
          switch (I[m]) {
            case "L":
              re.write_shift(1, d[h][m] == null ? 63 : d[h][m] ? 84 : 70);
              break;
            case "B":
              re.write_shift(8, d[h][m] || 0, "f");
              break;
            case "N":
              var ce = "0";
              for (typeof d[h][m] == "number" && (ce = d[h][m].toFixed(O[m] || 0)), A = 0; A < b[m] - ce.length; ++A) re.write_shift(1, 32);
              re.write_shift(1, ce, "sbcs");
              break;
            case "D":
              d[h][m] ? (re.write_shift(4, ("0000" + d[h][m].getFullYear()).slice(-4), "sbcs"), re.write_shift(2, ("00" + (d[h][m].getMonth() + 1)).slice(-2), "sbcs"), re.write_shift(2, ("00" + d[h][m].getDate()).slice(-2), "sbcs")) : re.write_shift(8, "00000000", "sbcs");
              break;
            case "C":
              var se = String(d[h][m] != null ? d[h][m] : "").slice(0, b[m]);
              for (re.write_shift(1, se, "sbcs"), A = 0; A < b[m] - se.length; ++A) re.write_shift(1, 32);
              break;
          }
    }
    return l.next(1).write_shift(1, 26), l.end();
  }
  return {
    to_workbook: n,
    to_sheet: t,
    from_sheet: s
  };
}(), kl = /* @__PURE__ */ function() {
  var e = {
    AA: "À",
    BA: "Á",
    CA: "Â",
    DA: 195,
    HA: "Ä",
    JA: 197,
    AE: "È",
    BE: "É",
    CE: "Ê",
    HE: "Ë",
    AI: "Ì",
    BI: "Í",
    CI: "Î",
    HI: "Ï",
    AO: "Ò",
    BO: "Ó",
    CO: "Ô",
    DO: 213,
    HO: "Ö",
    AU: "Ù",
    BU: "Ú",
    CU: "Û",
    HU: "Ü",
    Aa: "à",
    Ba: "á",
    Ca: "â",
    Da: 227,
    Ha: "ä",
    Ja: 229,
    Ae: "è",
    Be: "é",
    Ce: "ê",
    He: "ë",
    Ai: "ì",
    Bi: "í",
    Ci: "î",
    Hi: "ï",
    Ao: "ò",
    Bo: "ó",
    Co: "ô",
    Do: 245,
    Ho: "ö",
    Au: "ù",
    Bu: "ú",
    Cu: "û",
    Hu: "ü",
    KC: "Ç",
    Kc: "ç",
    q: "æ",
    z: "œ",
    a: "Æ",
    j: "Œ",
    DN: 209,
    Dn: 241,
    Hy: 255,
    S: 169,
    c: 170,
    R: 174,
    "B ": 180,
    /*::[*/
    0: 176,
    /*::[*/
    1: 177,
    /*::[*/
    2: 178,
    /*::[*/
    3: 179,
    /*::[*/
    5: 181,
    /*::[*/
    6: 182,
    /*::[*/
    7: 183,
    Q: 185,
    k: 186,
    b: 208,
    i: 216,
    l: 222,
    s: 240,
    y: 248,
    "!": 161,
    '"': 162,
    "#": 163,
    "(": 164,
    "%": 165,
    "'": 167,
    "H ": 168,
    "+": 171,
    ";": 187,
    "<": 188,
    "=": 189,
    ">": 190,
    "?": 191,
    "{": 223
  }, a = new RegExp("\x1BN(" + Or(e).join("|").replace(/\|\|\|/, "|\\||").replace(/([?()+])/g, "\\$1") + "|\\|)", "gm"), r = function(x, d) {
    var p = e[d];
    return typeof p == "number" ? B0(p) : p;
  }, t = function(x, d, p) {
    var h = d.charCodeAt(0) - 32 << 4 | p.charCodeAt(0) - 48;
    return h == 59 ? x : B0(h);
  };
  e["|"] = 254;
  function n(x, d) {
    switch (d.type) {
      case "base64":
        return i(xr(x), d);
      case "binary":
        return i(x, d);
      case "buffer":
        return i(ge && Buffer.isBuffer(x) ? x.toString("binary") : ha(x), d);
      case "array":
        return i(oa(x), d);
    }
    throw new Error("Unrecognized type " + d.type);
  }
  function i(x, d) {
    var p = x.split(/[\n\r]+/), h = -1, m = -1, A = 0, y = 0, E = [], I = [], b = null, O = {}, F = [], W = [], D = [], z = 0, G;
    for (+d.codepage >= 0 && Ar(+d.codepage); A !== p.length; ++A) {
      z = 0;
      var L = p[A].trim().replace(/\x1B([\x20-\x2F])([\x30-\x3F])/g, t).replace(a, r), J = L.replace(/;;/g, "\0").split(";").map(function(R) {
        return R.replace(/\u0000/g, ";");
      }), fe = J[0], re;
      if (L.length > 0) switch (fe) {
        case "ID":
          break;
        case "E":
          break;
        case "B":
          break;
        case "O":
          break;
        case "W":
          break;
        case "P":
          J[1].charAt(0) == "P" && I.push(L.slice(3).replace(/;;/g, ";"));
          break;
        case "C":
          var ce = !1, se = !1, Se = !1, V = !1, le = -1, ue = -1;
          for (y = 1; y < J.length; ++y) switch (J[y].charAt(0)) {
            case "A":
              break;
            case "X":
              m = parseInt(J[y].slice(1)) - 1, se = !0;
              break;
            case "Y":
              for (h = parseInt(J[y].slice(1)) - 1, se || (m = 0), G = E.length; G <= h; ++G) E[G] = [];
              break;
            case "K":
              re = J[y].slice(1), re.charAt(0) === '"' ? re = re.slice(1, re.length - 1) : re === "TRUE" ? re = !0 : re === "FALSE" ? re = !1 : isNaN(Sr(re)) ? isNaN(Aa(re).getDate()) || (re = ze(re)) : (re = Sr(re), b !== null && Sa(b) && (re = Ot(re))), ce = !0;
              break;
            case "E":
              V = !0;
              var S = Ta(J[y].slice(1), { r: h, c: m });
              E[h][m] = [E[h][m], S];
              break;
            case "S":
              Se = !0, E[h][m] = [E[h][m], "S5S"];
              break;
            case "G":
              break;
            case "R":
              le = parseInt(J[y].slice(1)) - 1;
              break;
            case "C":
              ue = parseInt(J[y].slice(1)) - 1;
              break;
            default:
              if (d && d.WTF) throw new Error("SYLK bad record " + L);
          }
          if (ce && (E[h][m] && E[h][m].length == 2 ? E[h][m][0] = re : E[h][m] = re, b = null), Se) {
            if (V) throw new Error("SYLK shared formula cannot have own formula");
            var U = le > -1 && E[le][ue];
            if (!U || !U[1]) throw new Error("SYLK shared formula cannot find base");
            E[h][m][1] = ts(U[1], { r: h - le, c: m - ue });
          }
          break;
        case "F":
          var N = 0;
          for (y = 1; y < J.length; ++y) switch (J[y].charAt(0)) {
            case "X":
              m = parseInt(J[y].slice(1)) - 1, ++N;
              break;
            case "Y":
              for (h = parseInt(J[y].slice(1)) - 1, G = E.length; G <= h; ++G) E[G] = [];
              break;
            case "M":
              z = parseInt(J[y].slice(1)) / 20;
              break;
            case "F":
              break;
            case "G":
              break;
            case "P":
              b = I[parseInt(J[y].slice(1))];
              break;
            case "S":
              break;
            case "D":
              break;
            case "N":
              break;
            case "W":
              for (D = J[y].slice(1).split(" "), G = parseInt(D[0], 10); G <= parseInt(D[1], 10); ++G)
                z = parseInt(D[2], 10), W[G - 1] = z === 0 ? { hidden: !0 } : { wch: z }, Fa(W[G - 1]);
              break;
            case "C":
              m = parseInt(J[y].slice(1)) - 1, W[m] || (W[m] = {});
              break;
            case "R":
              h = parseInt(J[y].slice(1)) - 1, F[h] || (F[h] = {}), z > 0 ? (F[h].hpt = z, F[h].hpx = Qa(z)) : z === 0 && (F[h].hidden = !0);
              break;
            default:
              if (d && d.WTF) throw new Error("SYLK bad record " + L);
          }
          N < 1 && (b = null);
          break;
        default:
          if (d && d.WTF) throw new Error("SYLK bad record " + L);
      }
    }
    return F.length > 0 && (O["!rows"] = F), W.length > 0 && (O["!cols"] = W), d && d.sheetRows && (E = E.slice(0, d.sheetRows)), [E, O];
  }
  function s(x, d) {
    var p = n(x, d), h = p[0], m = p[1], A = ya(h, d);
    return Or(m).forEach(function(y) {
      A[y] = m[y];
    }), A;
  }
  function c(x, d) {
    return Qr(s(x, d), d);
  }
  function f(x, d, p, h) {
    var m = "C;Y" + (p + 1) + ";X" + (h + 1) + ";K";
    switch (x.t) {
      case "n":
        m += x.v || 0, x.f && !x.F && (m += ";E" + fu(x.f, { r: p, c: h }));
        break;
      case "b":
        m += x.v ? "TRUE" : "FALSE";
        break;
      case "e":
        m += x.w || x.v;
        break;
      case "d":
        m += '"' + (x.w || x.v) + '"';
        break;
      case "s":
        m += '"' + x.v.replace(/"/g, "").replace(/;/g, ";;") + '"';
        break;
    }
    return m;
  }
  function o(x, d) {
    d.forEach(function(p, h) {
      var m = "F;W" + (h + 1) + " " + (h + 1) + " ";
      p.hidden ? m += "0" : (typeof p.width == "number" && !p.wpx && (p.wpx = yt(p.width)), typeof p.wpx == "number" && !p.wch && (p.wch = Dt(p.wpx)), typeof p.wch == "number" && (m += Math.round(p.wch))), m.charAt(m.length - 1) != " " && x.push(m);
    });
  }
  function l(x, d) {
    d.forEach(function(p, h) {
      var m = "F;";
      p.hidden ? m += "M0;" : p.hpt ? m += "M" + 20 * p.hpt + ";" : p.hpx && (m += "M" + 20 * es(p.hpx) + ";"), m.length > 2 && x.push(m + "R" + (h + 1));
    });
  }
  function u(x, d) {
    var p = ["ID;PWXL;N;E"], h = [], m = Oe(x["!ref"]), A, y = Array.isArray(x), E = `\r
`;
    p.push("P;PGeneral"), p.push("F;P0;DG0G8;M255"), x["!cols"] && o(p, x["!cols"]), x["!rows"] && l(p, x["!rows"]), p.push("B;Y" + (m.e.r - m.s.r + 1) + ";X" + (m.e.c - m.s.c + 1) + ";D" + [m.s.c, m.s.r, m.e.c, m.e.r].join(" "));
    for (var I = m.s.r; I <= m.e.r; ++I)
      for (var b = m.s.c; b <= m.e.c; ++b) {
        var O = he({ r: I, c: b });
        A = y ? (x[I] || [])[b] : x[O], !(!A || A.v == null && (!A.f || A.F)) && h.push(f(A, x, I, b));
      }
    return p.join(E) + E + h.join(E) + E + "E" + E;
  }
  return {
    to_workbook: c,
    to_sheet: s,
    from_sheet: u
  };
}(), wl = /* @__PURE__ */ function() {
  function e(i, s) {
    switch (s.type) {
      case "base64":
        return a(xr(i), s);
      case "binary":
        return a(i, s);
      case "buffer":
        return a(ge && Buffer.isBuffer(i) ? i.toString("binary") : ha(i), s);
      case "array":
        return a(oa(i), s);
    }
    throw new Error("Unrecognized type " + s.type);
  }
  function a(i, s) {
    for (var c = i.split(`
`), f = -1, o = -1, l = 0, u = []; l !== c.length; ++l) {
      if (c[l].trim() === "BOT") {
        u[++f] = [], o = 0;
        continue;
      }
      if (!(f < 0)) {
        var x = c[l].trim().split(","), d = x[0], p = x[1];
        ++l;
        for (var h = c[l] || ""; (h.match(/["]/g) || []).length & 1 && l < c.length - 1; ) h += `
` + c[++l];
        switch (h = h.trim(), +d) {
          case -1:
            if (h === "BOT") {
              u[++f] = [], o = 0;
              continue;
            } else if (h !== "EOD") throw new Error("Unrecognized DIF special command " + h);
            break;
          case 0:
            h === "TRUE" ? u[f][o] = !0 : h === "FALSE" ? u[f][o] = !1 : isNaN(Sr(p)) ? isNaN(Aa(p).getDate()) ? u[f][o] = p : u[f][o] = ze(p) : u[f][o] = Sr(p), ++o;
            break;
          case 1:
            h = h.slice(1, h.length - 1), h = h.replace(/""/g, '"'), h && h.match(/^=".*"$/) && (h = h.slice(2, -1)), u[f][o++] = h !== "" ? h : null;
            break;
        }
        if (h === "EOD") break;
      }
    }
    return s && s.sheetRows && (u = u.slice(0, s.sheetRows)), u;
  }
  function r(i, s) {
    return ya(e(i, s), s);
  }
  function t(i, s) {
    return Qr(r(i, s), s);
  }
  var n = /* @__PURE__ */ function() {
    var i = function(f, o, l, u, x) {
      f.push(o), f.push(l + "," + u), f.push('"' + x.replace(/"/g, '""') + '"');
    }, s = function(f, o, l, u) {
      f.push(o + "," + l), f.push(o == 1 ? '"' + u.replace(/"/g, '""') + '"' : u);
    };
    return function(f) {
      var o = [], l = Oe(f["!ref"]), u, x = Array.isArray(f);
      i(o, "TABLE", 0, 1, "sheetjs"), i(o, "VECTORS", 0, l.e.r - l.s.r + 1, ""), i(o, "TUPLES", 0, l.e.c - l.s.c + 1, ""), i(o, "DATA", 0, 0, "");
      for (var d = l.s.r; d <= l.e.r; ++d) {
        s(o, -1, 0, "BOT");
        for (var p = l.s.c; p <= l.e.c; ++p) {
          var h = he({ r: d, c: p });
          if (u = x ? (f[d] || [])[p] : f[h], !u) {
            s(o, 1, 0, "");
            continue;
          }
          switch (u.t) {
            case "n":
              var m = u.w;
              !m && u.v != null && (m = u.v), m == null ? u.f && !u.F ? s(o, 1, 0, "=" + u.f) : s(o, 1, 0, "") : s(o, 0, m, "V");
              break;
            case "b":
              s(o, 0, u.v ? 1 : 0, u.v ? "TRUE" : "FALSE");
              break;
            case "s":
              s(o, 1, 0, isNaN(u.v) ? u.v : '="' + u.v + '"');
              break;
            case "d":
              u.w || (u.w = Er(u.z || de[14], fr(ze(u.v)))), s(o, 0, u.w, "V");
              break;
            default:
              s(o, 1, 0, "");
          }
        }
      }
      s(o, -1, 0, "EOD");
      var A = `\r
`, y = o.join(A);
      return y;
    };
  }();
  return {
    to_workbook: t,
    to_sheet: r,
    from_sheet: n
  };
}(), Al = /* @__PURE__ */ function() {
  function e(u) {
    return u.replace(/\\b/g, "\\").replace(/\\c/g, ":").replace(/\\n/g, `
`);
  }
  function a(u) {
    return u.replace(/\\/g, "\\b").replace(/:/g, "\\c").replace(/\n/g, "\\n");
  }
  function r(u, x) {
    for (var d = u.split(`
`), p = -1, h = -1, m = 0, A = []; m !== d.length; ++m) {
      var y = d[m].trim().split(":");
      if (y[0] === "cell") {
        var E = sr(y[1]);
        if (A.length <= E.r) for (p = A.length; p <= E.r; ++p) A[p] || (A[p] = []);
        switch (p = E.r, h = E.c, y[2]) {
          case "t":
            A[p][h] = e(y[3]);
            break;
          case "v":
            A[p][h] = +y[3];
            break;
          case "vtf":
            var I = y[y.length - 1];
          case "vtc":
            switch (y[3]) {
              case "nl":
                A[p][h] = !!+y[4];
                break;
              default:
                A[p][h] = +y[4];
                break;
            }
            y[2] == "vtf" && (A[p][h] = [A[p][h], I]);
        }
      }
    }
    return x && x.sheetRows && (A = A.slice(0, x.sheetRows)), A;
  }
  function t(u, x) {
    return ya(r(u, x), x);
  }
  function n(u, x) {
    return Qr(t(u, x), x);
  }
  var i = [
    "socialcalc:version:1.5",
    "MIME-Version: 1.0",
    "Content-Type: multipart/mixed; boundary=SocialCalcSpreadsheetControlSave"
  ].join(`
`), s = [
    "--SocialCalcSpreadsheetControlSave",
    "Content-type: text/plain; charset=UTF-8"
  ].join(`
`) + `
`, c = [
    "# SocialCalc Spreadsheet Control Save",
    "part:sheet"
  ].join(`
`), f = "--SocialCalcSpreadsheetControlSave--";
  function o(u) {
    if (!u || !u["!ref"]) return "";
    for (var x = [], d = [], p, h = "", m = Ca(u["!ref"]), A = Array.isArray(u), y = m.s.r; y <= m.e.r; ++y)
      for (var E = m.s.c; E <= m.e.c; ++E)
        if (h = he({ r: y, c: E }), p = A ? (u[y] || [])[E] : u[h], !(!p || p.v == null || p.t === "z")) {
          switch (d = ["cell", h, "t"], p.t) {
            case "s":
            case "str":
              d.push(a(p.v));
              break;
            case "n":
              p.f ? (d[2] = "vtf", d[3] = "n", d[4] = p.v, d[5] = a(p.f)) : (d[2] = "v", d[3] = p.v);
              break;
            case "b":
              d[2] = "vt" + (p.f ? "f" : "c"), d[3] = "nl", d[4] = p.v ? "1" : "0", d[5] = a(p.f || (p.v ? "TRUE" : "FALSE"));
              break;
            case "d":
              var I = fr(ze(p.v));
              d[2] = "vtc", d[3] = "nd", d[4] = "" + I, d[5] = p.w || Er(p.z || de[14], I);
              break;
            case "e":
              continue;
          }
          x.push(d.join(":"));
        }
    return x.push("sheet:c:" + (m.e.c - m.s.c + 1) + ":r:" + (m.e.r - m.s.r + 1) + ":tvf:1"), x.push("valueformat:1:text-wiki"), x.join(`
`);
  }
  function l(u) {
    return [i, s, c, s, o(u), f].join(`
`);
  }
  return {
    to_workbook: n,
    to_sheet: t,
    from_sheet: l
  };
}(), Za = /* @__PURE__ */ function() {
  function e(l, u, x, d, p) {
    p.raw ? u[x][d] = l : l === "" || (l === "TRUE" ? u[x][d] = !0 : l === "FALSE" ? u[x][d] = !1 : isNaN(Sr(l)) ? isNaN(Aa(l).getDate()) ? u[x][d] = l : u[x][d] = ze(l) : u[x][d] = Sr(l));
  }
  function a(l, u) {
    var x = u || {}, d = [];
    if (!l || l.length === 0) return d;
    for (var p = l.split(/[\r\n]/), h = p.length - 1; h >= 0 && p[h].length === 0; ) --h;
    for (var m = 10, A = 0, y = 0; y <= h; ++y)
      A = p[y].indexOf(" "), A == -1 ? A = p[y].length : A++, m = Math.max(m, A);
    for (y = 0; y <= h; ++y) {
      d[y] = [];
      var E = 0;
      for (e(p[y].slice(0, m).trim(), d, y, E, x), E = 1; E <= (p[y].length - m) / 10 + 1; ++E)
        e(p[y].slice(m + (E - 1) * 10, m + E * 10).trim(), d, y, E, x);
    }
    return x.sheetRows && (d = d.slice(0, x.sheetRows)), d;
  }
  var r = {
    /*::[*/
    44: ",",
    /*::[*/
    9: "	",
    /*::[*/
    59: ";",
    /*::[*/
    124: "|"
  }, t = {
    /*::[*/
    44: 3,
    /*::[*/
    9: 2,
    /*::[*/
    59: 1,
    /*::[*/
    124: 0
  };
  function n(l) {
    for (var u = {}, x = !1, d = 0, p = 0; d < l.length; ++d)
      (p = l.charCodeAt(d)) == 34 ? x = !x : !x && p in r && (u[p] = (u[p] || 0) + 1);
    p = [];
    for (d in u) Object.prototype.hasOwnProperty.call(u, d) && p.push([u[d], d]);
    if (!p.length) {
      u = t;
      for (d in u) Object.prototype.hasOwnProperty.call(u, d) && p.push([u[d], d]);
    }
    return p.sort(function(h, m) {
      return h[0] - m[0] || t[h[1]] - t[m[1]];
    }), r[p.pop()[1]] || 44;
  }
  function i(l, u) {
    var x = u || {}, d = "", p = x.dense ? [] : {}, h = { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } };
    l.slice(0, 4) == "sep=" ? l.charCodeAt(5) == 13 && l.charCodeAt(6) == 10 ? (d = l.charAt(4), l = l.slice(7)) : l.charCodeAt(5) == 13 || l.charCodeAt(5) == 10 ? (d = l.charAt(4), l = l.slice(6)) : d = n(l.slice(0, 1024)) : x && x.FS ? d = x.FS : d = n(l.slice(0, 1024));
    var m = 0, A = 0, y = 0, E = 0, I = 0, b = d.charCodeAt(0), O = !1, F = 0, W = l.charCodeAt(0);
    l = l.replace(/\r\n/mg, `
`);
    var D = x.dateNF != null ? Ic(x.dateNF) : null;
    function z() {
      var G = l.slice(E, I), L = {};
      if (G.charAt(0) == '"' && G.charAt(G.length - 1) == '"' && (G = G.slice(1, -1).replace(/""/g, '"')), G.length === 0) L.t = "z";
      else if (x.raw)
        L.t = "s", L.v = G;
      else if (G.trim().length === 0)
        L.t = "s", L.v = G;
      else if (G.charCodeAt(0) == 61)
        G.charCodeAt(1) == 34 && G.charCodeAt(G.length - 1) == 34 ? (L.t = "s", L.v = G.slice(2, -1).replace(/""/g, '"')) : lu(G) ? (L.t = "n", L.f = G.slice(1)) : (L.t = "s", L.v = G);
      else if (G == "TRUE")
        L.t = "b", L.v = !0;
      else if (G == "FALSE")
        L.t = "b", L.v = !1;
      else if (!isNaN(y = Sr(G)))
        L.t = "n", x.cellText !== !1 && (L.w = G), L.v = y;
      else if (!isNaN(Aa(G).getDate()) || D && G.match(D)) {
        L.z = x.dateNF || de[14];
        var J = 0;
        D && G.match(D) && (G = Lc(G, x.dateNF, G.match(D) || []), J = 1), x.cellDates ? (L.t = "d", L.v = ze(G, J)) : (L.t = "n", L.v = fr(ze(G, J))), x.cellText !== !1 && (L.w = Er(L.z, L.v instanceof Date ? fr(L.v) : L.v)), x.cellNF || delete L.z;
      } else
        L.t = "s", L.v = G;
      if (L.t == "z" || (x.dense ? (p[m] || (p[m] = []), p[m][A] = L) : p[he({ c: A, r: m })] = L), E = I + 1, W = l.charCodeAt(E), h.e.c < A && (h.e.c = A), h.e.r < m && (h.e.r = m), F == b) ++A;
      else if (A = 0, ++m, x.sheetRows && x.sheetRows <= m) return !0;
    }
    e: for (; I < l.length; ++I) switch (F = l.charCodeAt(I)) {
      case 34:
        W === 34 && (O = !O);
        break;
      case b:
      case 10:
      case 13:
        if (!O && z()) break e;
        break;
    }
    return I - E > 0 && z(), p["!ref"] = _e(h), p;
  }
  function s(l, u) {
    return !(u && u.PRN) || u.FS || l.slice(0, 4) == "sep=" || l.indexOf("	") >= 0 || l.indexOf(",") >= 0 || l.indexOf(";") >= 0 ? i(l, u) : ya(a(l, u), u);
  }
  function c(l, u) {
    var x = "", d = u.type == "string" ? [0, 0, 0, 0] : R0(l, u);
    switch (u.type) {
      case "base64":
        x = xr(l);
        break;
      case "binary":
        x = l;
        break;
      case "buffer":
        u.codepage == 65001 ? x = l.toString("utf8") : u.codepage && typeof Ya < "u" || (x = ge && Buffer.isBuffer(l) ? l.toString("binary") : ha(l));
        break;
      case "array":
        x = oa(l);
        break;
      case "string":
        x = l;
        break;
      default:
        throw new Error("Unrecognized type " + u.type);
    }
    return d[0] == 239 && d[1] == 187 && d[2] == 191 ? x = Fe(x.slice(3)) : u.type != "string" && u.type != "buffer" && u.codepage == 65001 ? x = Fe(x) : u.type == "binary" && typeof Ya < "u", x.slice(0, 19) == "socialcalc:version:" ? Al.to_sheet(u.type == "string" ? x : Fe(x), u) : s(x, u);
  }
  function f(l, u) {
    return Qr(c(l, u), u);
  }
  function o(l) {
    for (var u = [], x = Oe(l["!ref"]), d, p = Array.isArray(l), h = x.s.r; h <= x.e.r; ++h) {
      for (var m = [], A = x.s.c; A <= x.e.c; ++A) {
        var y = he({ r: h, c: A });
        if (d = p ? (l[h] || [])[A] : l[y], !d || d.v == null) {
          m.push("          ");
          continue;
        }
        for (var E = (d.w || (Wr(d), d.w) || "").slice(0, 10); E.length < 10; ) E += " ";
        m.push(E + (A === 0 ? " " : ""));
      }
      u.push(m.join(""));
    }
    return u.join(`
`);
  }
  return {
    to_workbook: f,
    to_sheet: c,
    from_sheet: o
  };
}();
function Fl(e, a) {
  var r = a || {}, t = !!r.WTF;
  r.WTF = !0;
  try {
    var n = kl.to_workbook(e, r);
    return r.WTF = t, n;
  } catch (i) {
    if (r.WTF = t, !i.message.match(/SYLK bad record ID/) && t) throw i;
    return Za.to_workbook(e, a);
  }
}
var Ga = /* @__PURE__ */ function() {
  function e(S, U, N) {
    if (S) {
      $e(S, S.l || 0);
      for (var R = N.Enum || le; S.l < S.length; ) {
        var Y = S.read_shift(2), ee = R[Y] || R[65535], ne = S.read_shift(2), q = S.l + ne, j = ee.f && ee.f(S, ne, N);
        if (S.l = q, U(j, ee, Y)) return;
      }
    }
  }
  function a(S, U) {
    switch (U.type) {
      case "base64":
        return r(wr(xr(S)), U);
      case "binary":
        return r(wr(S), U);
      case "buffer":
      case "array":
        return r(S, U);
    }
    throw "Unsupported type " + U.type;
  }
  function r(S, U) {
    if (!S) return S;
    var N = U || {}, R = N.dense ? [] : {}, Y = "Sheet1", ee = "", ne = 0, q = {}, j = [], Te = [], C = { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } }, Ie = N.sheetRows || 0;
    if (S[2] == 0 && (S[3] == 8 || S[3] == 9) && S.length >= 16 && S[14] == 5 && S[15] === 108)
      throw new Error("Unsupported Works 3 for Mac file");
    if (S[2] == 2)
      N.Enum = le, e(S, function(ae, Le, dr) {
        switch (dr) {
          case 0:
            N.vers = ae, ae >= 4096 && (N.qpro = !0);
            break;
          case 6:
            C = ae;
            break;
          case 204:
            ae && (ee = ae);
            break;
          case 222:
            ee = ae;
            break;
          case 15:
          case 51:
            N.qpro || (ae[1].v = ae[1].v.slice(1));
          case 13:
          case 14:
          case 16:
            dr == 14 && (ae[2] & 112) == 112 && (ae[2] & 15) > 1 && (ae[2] & 15) < 15 && (ae[1].z = N.dateNF || de[14], N.cellDates && (ae[1].t = "d", ae[1].v = Ot(ae[1].v))), N.qpro && ae[3] > ne && (R["!ref"] = _e(C), q[Y] = R, j.push(Y), R = N.dense ? [] : {}, C = { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } }, ne = ae[3], Y = ee || "Sheet" + (ne + 1), ee = "");
            var Cr = N.dense ? (R[ae[0].r] || [])[ae[0].c] : R[he(ae[0])];
            if (Cr) {
              Cr.t = ae[1].t, Cr.v = ae[1].v, ae[1].z != null && (Cr.z = ae[1].z), ae[1].f != null && (Cr.f = ae[1].f);
              break;
            }
            N.dense ? (R[ae[0].r] || (R[ae[0].r] = []), R[ae[0].r][ae[0].c] = ae[1]) : R[he(ae[0])] = ae[1];
            break;
        }
      }, N);
    else if (S[2] == 26 || S[2] == 14)
      N.Enum = ue, S[2] == 14 && (N.qpro = !0, S.l = 0), e(S, function(ae, Le, dr) {
        switch (dr) {
          case 204:
            Y = ae;
            break;
          case 22:
            ae[1].v = ae[1].v.slice(1);
          case 23:
          case 24:
          case 25:
          case 37:
          case 39:
          case 40:
            if (ae[3] > ne && (R["!ref"] = _e(C), q[Y] = R, j.push(Y), R = N.dense ? [] : {}, C = { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } }, ne = ae[3], Y = "Sheet" + (ne + 1)), Ie > 0 && ae[0].r >= Ie) break;
            N.dense ? (R[ae[0].r] || (R[ae[0].r] = []), R[ae[0].r][ae[0].c] = ae[1]) : R[he(ae[0])] = ae[1], C.e.c < ae[0].c && (C.e.c = ae[0].c), C.e.r < ae[0].r && (C.e.r = ae[0].r);
            break;
          case 27:
            ae[14e3] && (Te[ae[14e3][0]] = ae[14e3][1]);
            break;
          case 1537:
            Te[ae[0]] = ae[1], ae[0] == ne && (Y = ae[1]);
            break;
        }
      }, N);
    else throw new Error("Unrecognized LOTUS BOF " + S[2]);
    if (R["!ref"] = _e(C), q[ee || Y] = R, j.push(ee || Y), !Te.length) return { SheetNames: j, Sheets: q };
    for (var we = {}, Ae = [], me = 0; me < Te.length; ++me) q[j[me]] ? (Ae.push(Te[me] || j[me]), we[Te[me]] = q[Te[me]] || q[j[me]]) : (Ae.push(Te[me]), we[Te[me]] = { "!ref": "A1" });
    return { SheetNames: Ae, Sheets: we };
  }
  function t(S, U) {
    var N = U || {};
    if (+N.codepage >= 0 && Ar(+N.codepage), N.type == "string") throw new Error("Cannot write WK1 to JS string");
    var R = Kt(), Y = Oe(S["!ref"]), ee = Array.isArray(S), ne = [];
    kr(R, 0, i(1030)), kr(R, 6, f(Y));
    for (var q = Math.min(Y.e.r, 8191), j = Y.s.r; j <= q; ++j)
      for (var Te = Ke(j), C = Y.s.c; C <= Y.e.c; ++C) {
        j === Y.s.r && (ne[C] = Ve(C));
        var Ie = ne[C] + Te, we = ee ? (S[j] || [])[C] : S[Ie];
        if (!(!we || we.t == "z"))
          if (we.t == "n")
            (we.v | 0) == we.v && we.v >= -32768 && we.v <= 32767 ? kr(R, 13, d(j, C, we.v)) : kr(R, 14, h(j, C, we.v));
          else {
            var Ae = Wr(we);
            kr(R, 15, u(j, C, Ae.slice(0, 239)));
          }
      }
    return kr(R, 1), R.end();
  }
  function n(S, U) {
    var N = U || {};
    if (+N.codepage >= 0 && Ar(+N.codepage), N.type == "string") throw new Error("Cannot write WK3 to JS string");
    var R = Kt();
    kr(R, 0, s(S));
    for (var Y = 0, ee = 0; Y < S.SheetNames.length; ++Y) (S.Sheets[S.SheetNames[Y]] || {})["!ref"] && kr(R, 27, V(S.SheetNames[Y], ee++));
    var ne = 0;
    for (Y = 0; Y < S.SheetNames.length; ++Y) {
      var q = S.Sheets[S.SheetNames[Y]];
      if (!(!q || !q["!ref"])) {
        for (var j = Oe(q["!ref"]), Te = Array.isArray(q), C = [], Ie = Math.min(j.e.r, 8191), we = j.s.r; we <= Ie; ++we)
          for (var Ae = Ke(we), me = j.s.c; me <= j.e.c; ++me) {
            we === j.s.r && (C[me] = Ve(me));
            var ae = C[me] + Ae, Le = Te ? (q[we] || [])[me] : q[ae];
            if (!(!Le || Le.t == "z"))
              if (Le.t == "n")
                kr(R, 23, z(we, me, ne, Le.v));
              else {
                var dr = Wr(Le);
                kr(R, 22, F(we, me, ne, dr.slice(0, 239)));
              }
          }
        ++ne;
      }
    }
    return kr(R, 1), R.end();
  }
  function i(S) {
    var U = We(2);
    return U.write_shift(2, S), U;
  }
  function s(S) {
    var U = We(26);
    U.write_shift(2, 4096), U.write_shift(2, 4), U.write_shift(4, 0);
    for (var N = 0, R = 0, Y = 0, ee = 0; ee < S.SheetNames.length; ++ee) {
      var ne = S.SheetNames[ee], q = S.Sheets[ne];
      if (!(!q || !q["!ref"])) {
        ++Y;
        var j = Ca(q["!ref"]);
        N < j.e.r && (N = j.e.r), R < j.e.c && (R = j.e.c);
      }
    }
    return N > 8191 && (N = 8191), U.write_shift(2, N), U.write_shift(1, Y), U.write_shift(1, R), U.write_shift(2, 0), U.write_shift(2, 0), U.write_shift(1, 1), U.write_shift(1, 2), U.write_shift(4, 0), U.write_shift(4, 0), U;
  }
  function c(S, U, N) {
    var R = { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } };
    return U == 8 && N.qpro ? (R.s.c = S.read_shift(1), S.l++, R.s.r = S.read_shift(2), R.e.c = S.read_shift(1), S.l++, R.e.r = S.read_shift(2), R) : (R.s.c = S.read_shift(2), R.s.r = S.read_shift(2), U == 12 && N.qpro && (S.l += 2), R.e.c = S.read_shift(2), R.e.r = S.read_shift(2), U == 12 && N.qpro && (S.l += 2), R.s.c == 65535 && (R.s.c = R.e.c = R.s.r = R.e.r = 0), R);
  }
  function f(S) {
    var U = We(8);
    return U.write_shift(2, S.s.c), U.write_shift(2, S.s.r), U.write_shift(2, S.e.c), U.write_shift(2, S.e.r), U;
  }
  function o(S, U, N) {
    var R = [{ c: 0, r: 0 }, { t: "n", v: 0 }, 0, 0];
    return N.qpro && N.vers != 20768 ? (R[0].c = S.read_shift(1), R[3] = S.read_shift(1), R[0].r = S.read_shift(2), S.l += 2) : (R[2] = S.read_shift(1), R[0].c = S.read_shift(2), R[0].r = S.read_shift(2)), R;
  }
  function l(S, U, N) {
    var R = S.l + U, Y = o(S, U, N);
    if (Y[1].t = "s", N.vers == 20768) {
      S.l++;
      var ee = S.read_shift(1);
      return Y[1].v = S.read_shift(ee, "utf8"), Y;
    }
    return N.qpro && S.l++, Y[1].v = S.read_shift(R - S.l, "cstr"), Y;
  }
  function u(S, U, N) {
    var R = We(7 + N.length);
    R.write_shift(1, 255), R.write_shift(2, U), R.write_shift(2, S), R.write_shift(1, 39);
    for (var Y = 0; Y < R.length; ++Y) {
      var ee = N.charCodeAt(Y);
      R.write_shift(1, ee >= 128 ? 95 : ee);
    }
    return R.write_shift(1, 0), R;
  }
  function x(S, U, N) {
    var R = o(S, U, N);
    return R[1].v = S.read_shift(2, "i"), R;
  }
  function d(S, U, N) {
    var R = We(7);
    return R.write_shift(1, 255), R.write_shift(2, U), R.write_shift(2, S), R.write_shift(2, N, "i"), R;
  }
  function p(S, U, N) {
    var R = o(S, U, N);
    return R[1].v = S.read_shift(8, "f"), R;
  }
  function h(S, U, N) {
    var R = We(13);
    return R.write_shift(1, 255), R.write_shift(2, U), R.write_shift(2, S), R.write_shift(8, N, "f"), R;
  }
  function m(S, U, N) {
    var R = S.l + U, Y = o(S, U, N);
    if (Y[1].v = S.read_shift(8, "f"), N.qpro) S.l = R;
    else {
      var ee = S.read_shift(2);
      I(S.slice(S.l, S.l + ee), Y), S.l += ee;
    }
    return Y;
  }
  function A(S, U, N) {
    var R = U & 32768;
    return U &= -32769, U = (R ? S : 0) + (U >= 8192 ? U - 16384 : U), (R ? "" : "$") + (N ? Ve(U) : Ke(U));
  }
  var y = {
    51: ["FALSE", 0],
    52: ["TRUE", 0],
    70: ["LEN", 1],
    80: ["SUM", 69],
    81: ["AVERAGEA", 69],
    82: ["COUNTA", 69],
    83: ["MINA", 69],
    84: ["MAXA", 69],
    111: ["T", 1]
  }, E = [
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    // eslint-disable-line no-mixed-spaces-and-tabs
    "",
    "+",
    "-",
    "*",
    "/",
    "^",
    "=",
    "<>",
    // eslint-disable-line no-mixed-spaces-and-tabs
    "<=",
    ">=",
    "<",
    ">",
    "",
    "",
    "",
    "",
    // eslint-disable-line no-mixed-spaces-and-tabs
    "&",
    "",
    "",
    "",
    "",
    "",
    "",
    ""
    // eslint-disable-line no-mixed-spaces-and-tabs
  ];
  function I(S, U) {
    $e(S, 0);
    for (var N = [], R = 0, Y = "", ee = "", ne = "", q = ""; S.l < S.length; ) {
      var j = S[S.l++];
      switch (j) {
        case 0:
          N.push(S.read_shift(8, "f"));
          break;
        case 1:
          ee = A(U[0].c, S.read_shift(2), !0), Y = A(U[0].r, S.read_shift(2), !1), N.push(ee + Y);
          break;
        case 2:
          {
            var Te = A(U[0].c, S.read_shift(2), !0), C = A(U[0].r, S.read_shift(2), !1);
            ee = A(U[0].c, S.read_shift(2), !0), Y = A(U[0].r, S.read_shift(2), !1), N.push(Te + C + ":" + ee + Y);
          }
          break;
        case 3:
          if (S.l < S.length) {
            console.error("WK1 premature formula end");
            return;
          }
          break;
        case 4:
          N.push("(" + N.pop() + ")");
          break;
        case 5:
          N.push(S.read_shift(2));
          break;
        case 6:
          {
            for (var Ie = ""; j = S[S.l++]; ) Ie += String.fromCharCode(j);
            N.push('"' + Ie.replace(/"/g, '""') + '"');
          }
          break;
        case 8:
          N.push("-" + N.pop());
          break;
        case 23:
          N.push("+" + N.pop());
          break;
        case 22:
          N.push("NOT(" + N.pop() + ")");
          break;
        case 20:
        case 21:
          q = N.pop(), ne = N.pop(), N.push(["AND", "OR"][j - 20] + "(" + ne + "," + q + ")");
          break;
        default:
          if (j < 32 && E[j])
            q = N.pop(), ne = N.pop(), N.push(ne + E[j] + q);
          else if (y[j]) {
            if (R = y[j][1], R == 69 && (R = S[S.l++]), R > N.length) {
              console.error("WK1 bad formula parse 0x" + j.toString(16) + ":|" + N.join("|") + "|");
              return;
            }
            var we = N.slice(-R);
            N.length -= R, N.push(y[j][0] + "(" + we.join(",") + ")");
          } else return j <= 7 ? console.error("WK1 invalid opcode " + j.toString(16)) : j <= 24 ? console.error("WK1 unsupported op " + j.toString(16)) : j <= 30 ? console.error("WK1 invalid opcode " + j.toString(16)) : j <= 115 ? console.error("WK1 unsupported function opcode " + j.toString(16)) : console.error("WK1 unrecognized opcode " + j.toString(16));
      }
    }
    N.length == 1 ? U[1].f = "" + N[0] : console.error("WK1 bad formula parse |" + N.join("|") + "|");
  }
  function b(S) {
    var U = [{ c: 0, r: 0 }, { t: "n", v: 0 }, 0];
    return U[0].r = S.read_shift(2), U[3] = S[S.l++], U[0].c = S[S.l++], U;
  }
  function O(S, U) {
    var N = b(S);
    return N[1].t = "s", N[1].v = S.read_shift(U - 4, "cstr"), N;
  }
  function F(S, U, N, R) {
    var Y = We(6 + R.length);
    Y.write_shift(2, S), Y.write_shift(1, N), Y.write_shift(1, U), Y.write_shift(1, 39);
    for (var ee = 0; ee < R.length; ++ee) {
      var ne = R.charCodeAt(ee);
      Y.write_shift(1, ne >= 128 ? 95 : ne);
    }
    return Y.write_shift(1, 0), Y;
  }
  function W(S, U) {
    var N = b(S);
    N[1].v = S.read_shift(2);
    var R = N[1].v >> 1;
    if (N[1].v & 1)
      switch (R & 7) {
        case 0:
          R = (R >> 3) * 5e3;
          break;
        case 1:
          R = (R >> 3) * 500;
          break;
        case 2:
          R = (R >> 3) / 20;
          break;
        case 3:
          R = (R >> 3) / 200;
          break;
        case 4:
          R = (R >> 3) / 2e3;
          break;
        case 5:
          R = (R >> 3) / 2e4;
          break;
        case 6:
          R = (R >> 3) / 16;
          break;
        case 7:
          R = (R >> 3) / 64;
          break;
      }
    return N[1].v = R, N;
  }
  function D(S, U) {
    var N = b(S), R = S.read_shift(4), Y = S.read_shift(4), ee = S.read_shift(2);
    if (ee == 65535)
      return R === 0 && Y === 3221225472 ? (N[1].t = "e", N[1].v = 15) : R === 0 && Y === 3489660928 ? (N[1].t = "e", N[1].v = 42) : N[1].v = 0, N;
    var ne = ee & 32768;
    return ee = (ee & 32767) - 16446, N[1].v = (1 - ne * 2) * (Y * Math.pow(2, ee + 32) + R * Math.pow(2, ee)), N;
  }
  function z(S, U, N, R) {
    var Y = We(14);
    if (Y.write_shift(2, S), Y.write_shift(1, N), Y.write_shift(1, U), R == 0)
      return Y.write_shift(4, 0), Y.write_shift(4, 0), Y.write_shift(2, 65535), Y;
    var ee = 0, ne = 0, q = 0, j = 0;
    return R < 0 && (ee = 1, R = -R), ne = Math.log2(R) | 0, R /= Math.pow(2, ne - 31), j = R >>> 0, j & 2147483648 || (R /= 2, ++ne, j = R >>> 0), R -= j, j |= 2147483648, j >>>= 0, R *= Math.pow(2, 32), q = R >>> 0, Y.write_shift(4, q), Y.write_shift(4, j), ne += 16383 + (ee ? 32768 : 0), Y.write_shift(2, ne), Y;
  }
  function G(S, U) {
    var N = D(S);
    return S.l += U - 14, N;
  }
  function L(S, U) {
    var N = b(S), R = S.read_shift(4);
    return N[1].v = R >> 6, N;
  }
  function J(S, U) {
    var N = b(S), R = S.read_shift(8, "f");
    return N[1].v = R, N;
  }
  function fe(S, U) {
    var N = J(S);
    return S.l += U - 10, N;
  }
  function re(S, U) {
    return S[S.l + U - 1] == 0 ? S.read_shift(U, "cstr") : "";
  }
  function ce(S, U) {
    var N = S[S.l++];
    N > U - 1 && (N = U - 1);
    for (var R = ""; R.length < N; ) R += String.fromCharCode(S[S.l++]);
    return R;
  }
  function se(S, U, N) {
    if (!(!N.qpro || U < 21)) {
      var R = S.read_shift(1);
      S.l += 17, S.l += 1, S.l += 2;
      var Y = S.read_shift(U - 21, "cstr");
      return [R, Y];
    }
  }
  function Se(S, U) {
    for (var N = {}, R = S.l + U; S.l < R; ) {
      var Y = S.read_shift(2);
      if (Y == 14e3) {
        for (N[Y] = [0, ""], N[Y][0] = S.read_shift(2); S[S.l]; )
          N[Y][1] += String.fromCharCode(S[S.l]), S.l++;
        S.l++;
      }
    }
    return N;
  }
  function V(S, U) {
    var N = We(5 + S.length);
    N.write_shift(2, 14e3), N.write_shift(2, U);
    for (var R = 0; R < S.length; ++R) {
      var Y = S.charCodeAt(R);
      N[N.l++] = Y > 127 ? 95 : Y;
    }
    return N[N.l++] = 0, N;
  }
  var le = {
    /*::[*/
    0: { n: "BOF", f: Ue },
    /*::[*/
    1: { n: "EOF" },
    /*::[*/
    2: { n: "CALCMODE" },
    /*::[*/
    3: { n: "CALCORDER" },
    /*::[*/
    4: { n: "SPLIT" },
    /*::[*/
    5: { n: "SYNC" },
    /*::[*/
    6: { n: "RANGE", f: c },
    /*::[*/
    7: { n: "WINDOW1" },
    /*::[*/
    8: { n: "COLW1" },
    /*::[*/
    9: { n: "WINTWO" },
    /*::[*/
    10: { n: "COLW2" },
    /*::[*/
    11: { n: "NAME" },
    /*::[*/
    12: { n: "BLANK" },
    /*::[*/
    13: { n: "INTEGER", f: x },
    /*::[*/
    14: { n: "NUMBER", f: p },
    /*::[*/
    15: { n: "LABEL", f: l },
    /*::[*/
    16: { n: "FORMULA", f: m },
    /*::[*/
    24: { n: "TABLE" },
    /*::[*/
    25: { n: "ORANGE" },
    /*::[*/
    26: { n: "PRANGE" },
    /*::[*/
    27: { n: "SRANGE" },
    /*::[*/
    28: { n: "FRANGE" },
    /*::[*/
    29: { n: "KRANGE1" },
    /*::[*/
    32: { n: "HRANGE" },
    /*::[*/
    35: { n: "KRANGE2" },
    /*::[*/
    36: { n: "PROTEC" },
    /*::[*/
    37: { n: "FOOTER" },
    /*::[*/
    38: { n: "HEADER" },
    /*::[*/
    39: { n: "SETUP" },
    /*::[*/
    40: { n: "MARGINS" },
    /*::[*/
    41: { n: "LABELFMT" },
    /*::[*/
    42: { n: "TITLES" },
    /*::[*/
    43: { n: "SHEETJS" },
    /*::[*/
    45: { n: "GRAPH" },
    /*::[*/
    46: { n: "NGRAPH" },
    /*::[*/
    47: { n: "CALCCOUNT" },
    /*::[*/
    48: { n: "UNFORMATTED" },
    /*::[*/
    49: { n: "CURSORW12" },
    /*::[*/
    50: { n: "WINDOW" },
    /*::[*/
    51: { n: "STRING", f: l },
    /*::[*/
    55: { n: "PASSWORD" },
    /*::[*/
    56: { n: "LOCKED" },
    /*::[*/
    60: { n: "QUERY" },
    /*::[*/
    61: { n: "QUERYNAME" },
    /*::[*/
    62: { n: "PRINT" },
    /*::[*/
    63: { n: "PRINTNAME" },
    /*::[*/
    64: { n: "GRAPH2" },
    /*::[*/
    65: { n: "GRAPHNAME" },
    /*::[*/
    66: { n: "ZOOM" },
    /*::[*/
    67: { n: "SYMSPLIT" },
    /*::[*/
    68: { n: "NSROWS" },
    /*::[*/
    69: { n: "NSCOLS" },
    /*::[*/
    70: { n: "RULER" },
    /*::[*/
    71: { n: "NNAME" },
    /*::[*/
    72: { n: "ACOMM" },
    /*::[*/
    73: { n: "AMACRO" },
    /*::[*/
    74: { n: "PARSE" },
    /*::[*/
    102: { n: "PRANGES??" },
    /*::[*/
    103: { n: "RRANGES??" },
    /*::[*/
    104: { n: "FNAME??" },
    /*::[*/
    105: { n: "MRANGES??" },
    /*::[*/
    204: { n: "SHEETNAMECS", f: re },
    /*::[*/
    222: { n: "SHEETNAMELP", f: ce },
    /*::[*/
    65535: { n: "" }
  }, ue = {
    /*::[*/
    0: { n: "BOF" },
    /*::[*/
    1: { n: "EOF" },
    /*::[*/
    2: { n: "PASSWORD" },
    /*::[*/
    3: { n: "CALCSET" },
    /*::[*/
    4: { n: "WINDOWSET" },
    /*::[*/
    5: { n: "SHEETCELLPTR" },
    /*::[*/
    6: { n: "SHEETLAYOUT" },
    /*::[*/
    7: { n: "COLUMNWIDTH" },
    /*::[*/
    8: { n: "HIDDENCOLUMN" },
    /*::[*/
    9: { n: "USERRANGE" },
    /*::[*/
    10: { n: "SYSTEMRANGE" },
    /*::[*/
    11: { n: "ZEROFORCE" },
    /*::[*/
    12: { n: "SORTKEYDIR" },
    /*::[*/
    13: { n: "FILESEAL" },
    /*::[*/
    14: { n: "DATAFILLNUMS" },
    /*::[*/
    15: { n: "PRINTMAIN" },
    /*::[*/
    16: { n: "PRINTSTRING" },
    /*::[*/
    17: { n: "GRAPHMAIN" },
    /*::[*/
    18: { n: "GRAPHSTRING" },
    /*::[*/
    19: { n: "??" },
    /*::[*/
    20: { n: "ERRCELL" },
    /*::[*/
    21: { n: "NACELL" },
    /*::[*/
    22: { n: "LABEL16", f: O },
    /*::[*/
    23: { n: "NUMBER17", f: D },
    /*::[*/
    24: { n: "NUMBER18", f: W },
    /*::[*/
    25: { n: "FORMULA19", f: G },
    /*::[*/
    26: { n: "FORMULA1A" },
    /*::[*/
    27: { n: "XFORMAT", f: Se },
    /*::[*/
    28: { n: "DTLABELMISC" },
    /*::[*/
    29: { n: "DTLABELCELL" },
    /*::[*/
    30: { n: "GRAPHWINDOW" },
    /*::[*/
    31: { n: "CPA" },
    /*::[*/
    32: { n: "LPLAUTO" },
    /*::[*/
    33: { n: "QUERY" },
    /*::[*/
    34: { n: "HIDDENSHEET" },
    /*::[*/
    35: { n: "??" },
    /*::[*/
    37: { n: "NUMBER25", f: L },
    /*::[*/
    38: { n: "??" },
    /*::[*/
    39: { n: "NUMBER27", f: J },
    /*::[*/
    40: { n: "FORMULA28", f: fe },
    /*::[*/
    142: { n: "??" },
    /*::[*/
    147: { n: "??" },
    /*::[*/
    150: { n: "??" },
    /*::[*/
    151: { n: "??" },
    /*::[*/
    152: { n: "??" },
    /*::[*/
    153: { n: "??" },
    /*::[*/
    154: { n: "??" },
    /*::[*/
    155: { n: "??" },
    /*::[*/
    156: { n: "??" },
    /*::[*/
    163: { n: "??" },
    /*::[*/
    174: { n: "??" },
    /*::[*/
    175: { n: "??" },
    /*::[*/
    176: { n: "??" },
    /*::[*/
    177: { n: "??" },
    /*::[*/
    184: { n: "??" },
    /*::[*/
    185: { n: "??" },
    /*::[*/
    186: { n: "??" },
    /*::[*/
    187: { n: "??" },
    /*::[*/
    188: { n: "??" },
    /*::[*/
    195: { n: "??" },
    /*::[*/
    201: { n: "??" },
    /*::[*/
    204: { n: "SHEETNAMECS", f: re },
    /*::[*/
    205: { n: "??" },
    /*::[*/
    206: { n: "??" },
    /*::[*/
    207: { n: "??" },
    /*::[*/
    208: { n: "??" },
    /*::[*/
    256: { n: "??" },
    /*::[*/
    259: { n: "??" },
    /*::[*/
    260: { n: "??" },
    /*::[*/
    261: { n: "??" },
    /*::[*/
    262: { n: "??" },
    /*::[*/
    263: { n: "??" },
    /*::[*/
    265: { n: "??" },
    /*::[*/
    266: { n: "??" },
    /*::[*/
    267: { n: "??" },
    /*::[*/
    268: { n: "??" },
    /*::[*/
    270: { n: "??" },
    /*::[*/
    271: { n: "??" },
    /*::[*/
    384: { n: "??" },
    /*::[*/
    389: { n: "??" },
    /*::[*/
    390: { n: "??" },
    /*::[*/
    393: { n: "??" },
    /*::[*/
    396: { n: "??" },
    /*::[*/
    512: { n: "??" },
    /*::[*/
    514: { n: "??" },
    /*::[*/
    513: { n: "??" },
    /*::[*/
    516: { n: "??" },
    /*::[*/
    517: { n: "??" },
    /*::[*/
    640: { n: "??" },
    /*::[*/
    641: { n: "??" },
    /*::[*/
    642: { n: "??" },
    /*::[*/
    643: { n: "??" },
    /*::[*/
    644: { n: "??" },
    /*::[*/
    645: { n: "??" },
    /*::[*/
    646: { n: "??" },
    /*::[*/
    647: { n: "??" },
    /*::[*/
    648: { n: "??" },
    /*::[*/
    658: { n: "??" },
    /*::[*/
    659: { n: "??" },
    /*::[*/
    660: { n: "??" },
    /*::[*/
    661: { n: "??" },
    /*::[*/
    662: { n: "??" },
    /*::[*/
    665: { n: "??" },
    /*::[*/
    666: { n: "??" },
    /*::[*/
    768: { n: "??" },
    /*::[*/
    772: { n: "??" },
    /*::[*/
    1537: { n: "SHEETINFOQP", f: se },
    /*::[*/
    1600: { n: "??" },
    /*::[*/
    1602: { n: "??" },
    /*::[*/
    1793: { n: "??" },
    /*::[*/
    1794: { n: "??" },
    /*::[*/
    1795: { n: "??" },
    /*::[*/
    1796: { n: "??" },
    /*::[*/
    1920: { n: "??" },
    /*::[*/
    2048: { n: "??" },
    /*::[*/
    2049: { n: "??" },
    /*::[*/
    2052: { n: "??" },
    /*::[*/
    2688: { n: "??" },
    /*::[*/
    10998: { n: "??" },
    /*::[*/
    12849: { n: "??" },
    /*::[*/
    28233: { n: "??" },
    /*::[*/
    28484: { n: "??" },
    /*::[*/
    65535: { n: "" }
  };
  return {
    sheet_to_wk1: t,
    book_to_wk3: n,
    to_workbook: a
  };
}();
function Sl(e) {
  var a = {}, r = e.match(ar), t = 0, n = !1;
  if (r) for (; t != r.length; ++t) {
    var i = oe(r[t]);
    switch (i[0].replace(/\w*:/g, "")) {
      case "<condense":
        break;
      case "<extend":
        break;
      case "<shadow":
        if (!i.val) break;
      case "<shadow>":
      case "<shadow/>":
        a.shadow = 1;
        break;
      case "</shadow>":
        break;
      case "<charset":
        if (i.val == "1") break;
        a.cp = s0[parseInt(i.val, 10)];
        break;
      case "<outline":
        if (!i.val) break;
      case "<outline>":
      case "<outline/>":
        a.outline = 1;
        break;
      case "</outline>":
        break;
      case "<rFont":
        a.name = i.val;
        break;
      case "<sz":
        a.sz = i.val;
        break;
      case "<strike":
        if (!i.val) break;
      case "<strike>":
      case "<strike/>":
        a.strike = 1;
        break;
      case "</strike>":
        break;
      case "<u":
        if (!i.val) break;
        switch (i.val) {
          case "double":
            a.uval = "double";
            break;
          case "singleAccounting":
            a.uval = "single-accounting";
            break;
          case "doubleAccounting":
            a.uval = "double-accounting";
            break;
        }
      case "<u>":
      case "<u/>":
        a.u = 1;
        break;
      case "</u>":
        break;
      case "<b":
        if (i.val == "0") break;
      case "<b>":
      case "<b/>":
        a.b = 1;
        break;
      case "</b>":
        break;
      case "<i":
        if (i.val == "0") break;
      case "<i>":
      case "<i/>":
        a.i = 1;
        break;
      case "</i>":
        break;
      case "<color":
        i.rgb && (a.color = i.rgb.slice(2, 8));
        break;
      case "<color>":
      case "<color/>":
      case "</color>":
        break;
      case "<family":
        a.family = i.val;
        break;
      case "<family>":
      case "<family/>":
      case "</family>":
        break;
      case "<vertAlign":
        a.valign = i.val;
        break;
      case "<vertAlign>":
      case "<vertAlign/>":
      case "</vertAlign>":
        break;
      case "<scheme":
        break;
      case "<scheme>":
      case "<scheme/>":
      case "</scheme>":
        break;
      case "<extLst":
      case "<extLst>":
      case "</extLst>":
        break;
      case "<ext":
        n = !0;
        break;
      case "</ext>":
        n = !1;
        break;
      default:
        if (i[0].charCodeAt(1) !== 47 && !n) throw new Error("Unrecognized rich format " + i[0]);
    }
  }
  return a;
}
var Cl = /* @__PURE__ */ function() {
  var e = ja("t"), a = ja("rPr");
  function r(i) {
    var s = i.match(e);
    if (!s) return { t: "s", v: "" };
    var c = { t: "s", v: ke(s[1]) }, f = i.match(a);
    return f && (c.s = Sl(f[1])), c;
  }
  var t = /<(?:\w+:)?r>/g, n = /<\/(?:\w+:)?r>/;
  return function(s) {
    return s.replace(t, "").split(n).map(r).filter(function(c) {
      return c.v;
    });
  };
}(), yl = /* @__PURE__ */ function() {
  var a = /(\r\n|\n)/g;
  function r(n, i, s) {
    var c = [];
    n.u && c.push("text-decoration: underline;"), n.uval && c.push("text-underline-style:" + n.uval + ";"), n.sz && c.push("font-size:" + n.sz + "pt;"), n.outline && c.push("text-effect: outline;"), n.shadow && c.push("text-shadow: auto;"), i.push('<span style="' + c.join("") + '">'), n.b && (i.push("<b>"), s.push("</b>")), n.i && (i.push("<i>"), s.push("</i>")), n.strike && (i.push("<s>"), s.push("</s>"));
    var f = n.valign || "";
    return f == "superscript" || f == "super" ? f = "sup" : f == "subscript" && (f = "sub"), f != "" && (i.push("<" + f + ">"), s.push("</" + f + ">")), s.push("</span>"), n;
  }
  function t(n) {
    var i = [[], n.v, []];
    return n.v ? (n.s && r(n.s, i[0], i[2]), i[0].join("") + i[1].replace(a, "<br/>") + i[2].join("")) : "";
  }
  return function(i) {
    return i.map(t).join("");
  };
}(), Dl = /<(?:\w+:)?t[^>]*>([^<]*)<\/(?:\w+:)?t>/g, Rl = /<(?:\w+:)?r>/, Ol = /<(?:\w+:)?rPh.*?>([\s\S]*?)<\/(?:\w+:)?rPh>/g;
function w0(e, a) {
  var r = a ? a.cellHTML : !0, t = {};
  return e ? (e.match(/^\s*<(?:\w+:)?t[^>]*>/) ? (t.t = ke(Fe(e.slice(e.indexOf(">") + 1).split(/<\/(?:\w+:)?t>/)[0] || "")), t.r = Fe(e), r && (t.h = x0(t.t))) : (
    /*y = */
    e.match(Rl) && (t.r = Fe(e), t.t = ke(Fe((e.replace(Ol, "").match(Dl) || []).join("").replace(ar, ""))), r && (t.h = yl(Cl(t.r))))
  ), t) : { t: "" };
}
var Nl = /<(?:\w+:)?sst([^>]*)>([\s\S]*)<\/(?:\w+:)?sst>/, Il = /<(?:\w+:)?(?:si|sstItem)>/g, Ll = /<\/(?:\w+:)?(?:si|sstItem)>/;
function Pl(e, a) {
  var r = [], t = "";
  if (!e) return r;
  var n = e.match(Nl);
  if (n) {
    t = n[2].replace(Il, "").split(Ll);
    for (var i = 0; i != t.length; ++i) {
      var s = w0(t[i].trim(), a);
      s != null && (r[r.length] = s);
    }
    n = oe(n[1]), r.Count = n.count, r.Unique = n.uniqueCount;
  }
  return r;
}
function Ml(e) {
  return [e.read_shift(4), e.read_shift(4)];
}
function bl(e, a) {
  var r = [], t = !1;
  return Vr(e, function(i, s, c) {
    switch (c) {
      case 159:
        r.Count = i[0], r.Unique = i[1];
        break;
      case 19:
        r.push(i);
        break;
      case 160:
        return !0;
      case 35:
        t = !0;
        break;
      case 36:
        t = !1;
        break;
      default:
        if (s.T, !t || a.WTF) throw new Error("Unexpected record 0x" + c.toString(16));
    }
  }), r;
}
function Ki(e) {
  for (var a = [], r = e.split(""), t = 0; t < r.length; ++t) a[t] = r[t].charCodeAt(0);
  return a;
}
function Hr(e, a) {
  var r = {};
  return r.Major = e.read_shift(2), r.Minor = e.read_shift(2), a >= 4 && (e.l += a - 4), r;
}
function Bl(e) {
  var a = {};
  return a.id = e.read_shift(0, "lpp4"), a.R = Hr(e, 4), a.U = Hr(e, 4), a.W = Hr(e, 4), a;
}
function Ul(e) {
  for (var a = e.read_shift(4), r = e.l + a - 4, t = {}, n = e.read_shift(4), i = []; n-- > 0; ) i.push({ t: e.read_shift(4), v: e.read_shift(0, "lpp4") });
  if (t.name = e.read_shift(0, "lpp4"), t.comps = i, e.l != r) throw new Error("Bad DataSpaceMapEntry: " + e.l + " != " + r);
  return t;
}
function Hl(e) {
  var a = [];
  e.l += 4;
  for (var r = e.read_shift(4); r-- > 0; ) a.push(Ul(e));
  return a;
}
function Wl(e) {
  var a = [];
  e.l += 4;
  for (var r = e.read_shift(4); r-- > 0; ) a.push(e.read_shift(0, "lpp4"));
  return a;
}
function Vl(e) {
  var a = {};
  return e.read_shift(4), e.l += 4, a.id = e.read_shift(0, "lpp4"), a.name = e.read_shift(0, "lpp4"), a.R = Hr(e, 4), a.U = Hr(e, 4), a.W = Hr(e, 4), a;
}
function Gl(e) {
  var a = Vl(e);
  if (a.ename = e.read_shift(0, "8lpp4"), a.blksz = e.read_shift(4), a.cmode = e.read_shift(4), e.read_shift(4) != 4) throw new Error("Bad !Primary record");
  return a;
}
function ji(e, a) {
  var r = e.l + a, t = {};
  t.Flags = e.read_shift(4) & 63, e.l += 4, t.AlgID = e.read_shift(4);
  var n = !1;
  switch (t.AlgID) {
    case 26126:
    case 26127:
    case 26128:
      n = t.Flags == 36;
      break;
    case 26625:
      n = t.Flags == 4;
      break;
    case 0:
      n = t.Flags == 16 || t.Flags == 4 || t.Flags == 36;
      break;
    default:
      throw "Unrecognized encryption algorithm: " + t.AlgID;
  }
  if (!n) throw new Error("Encryption Flags/AlgID mismatch");
  return t.AlgIDHash = e.read_shift(4), t.KeySize = e.read_shift(4), t.ProviderType = e.read_shift(4), e.l += 8, t.CSPName = e.read_shift(r - e.l >> 1, "utf16le"), e.l = r, t;
}
function Ji(e, a) {
  var r = {}, t = e.l + a;
  return e.l += 4, r.Salt = e.slice(e.l, e.l + 16), e.l += 16, r.Verifier = e.slice(e.l, e.l + 16), e.l += 16, e.read_shift(4), r.VerifierHash = e.slice(e.l, t), e.l = t, r;
}
function Xl(e) {
  var a = Hr(e);
  switch (a.Minor) {
    case 2:
      return [a.Minor, zl(e)];
    case 3:
      return [a.Minor, $l()];
    case 4:
      return [a.Minor, Yl(e)];
  }
  throw new Error("ECMA-376 Encrypted file unrecognized Version: " + a.Minor);
}
function zl(e) {
  var a = e.read_shift(4);
  if ((a & 63) != 36) throw new Error("EncryptionInfo mismatch");
  var r = e.read_shift(4), t = ji(e, r), n = Ji(e, e.length - e.l);
  return { t: "Std", h: t, v: n };
}
function $l() {
  throw new Error("File is password-protected: ECMA-376 Extensible");
}
function Yl(e) {
  var a = ["saltSize", "blockSize", "keyBits", "hashSize", "cipherAlgorithm", "cipherChaining", "hashAlgorithm", "saltValue"];
  e.l += 4;
  var r = e.read_shift(e.length - e.l, "utf8"), t = {};
  return r.replace(ar, function(i) {
    var s = oe(i);
    switch (Nr(s[0])) {
      case "<?xml":
        break;
      case "<encryption":
      case "</encryption>":
        break;
      case "<keyData":
        a.forEach(function(c) {
          t[c] = s[c];
        });
        break;
      case "<dataIntegrity":
        t.encryptedHmacKey = s.encryptedHmacKey, t.encryptedHmacValue = s.encryptedHmacValue;
        break;
      case "<keyEncryptors>":
      case "<keyEncryptors":
        t.encs = [];
        break;
      case "</keyEncryptors>":
        break;
      case "<keyEncryptor":
        t.uri = s.uri;
        break;
      case "</keyEncryptor>":
        break;
      case "<encryptedKey":
        t.encs.push(s);
        break;
      default:
        throw s[0];
    }
  }), t;
}
function Kl(e, a) {
  var r = {}, t = r.EncryptionVersionInfo = Hr(e, 4);
  if (a -= 4, t.Minor != 2) throw new Error("unrecognized minor version code: " + t.Minor);
  if (t.Major > 4 || t.Major < 2) throw new Error("unrecognized major version code: " + t.Major);
  r.Flags = e.read_shift(4), a -= 4;
  var n = e.read_shift(4);
  return a -= 4, r.EncryptionHeader = ji(e, n), a -= n, r.EncryptionVerifier = Ji(e, a), r;
}
function jl(e) {
  var a = {}, r = a.EncryptionVersionInfo = Hr(e, 4);
  if (r.Major != 1 || r.Minor != 1) throw "unrecognized version code " + r.Major + " : " + r.Minor;
  return a.Salt = e.read_shift(16), a.EncryptedVerifier = e.read_shift(16), a.EncryptedVerifierHash = e.read_shift(16), a;
}
function Jl(e) {
  var a = 0, r, t = Ki(e), n = t.length + 1, i, s, c, f, o;
  for (r = Zr(n), r[0] = t.length, i = 1; i != n; ++i) r[i] = t[i - 1];
  for (i = n - 1; i >= 0; --i)
    s = r[i], c = a & 16384 ? 1 : 0, f = a << 1 & 32767, o = c | f, a = o ^ s;
  return a ^ 52811;
}
var Zi = /* @__PURE__ */ function() {
  var e = [187, 255, 255, 186, 255, 255, 185, 128, 0, 190, 15, 0, 191, 15, 0], a = [57840, 7439, 52380, 33984, 4364, 3600, 61902, 12606, 6258, 57657, 54287, 34041, 10252, 43370, 20163], r = [44796, 19929, 39858, 10053, 20106, 40212, 10761, 31585, 63170, 64933, 60267, 50935, 40399, 11199, 17763, 35526, 1453, 2906, 5812, 11624, 23248, 885, 1770, 3540, 7080, 14160, 28320, 56640, 55369, 41139, 20807, 41614, 21821, 43642, 17621, 28485, 56970, 44341, 19019, 38038, 14605, 29210, 60195, 50791, 40175, 10751, 21502, 43004, 24537, 18387, 36774, 3949, 7898, 15796, 31592, 63184, 47201, 24803, 49606, 37805, 14203, 28406, 56812, 17824, 35648, 1697, 3394, 6788, 13576, 27152, 43601, 17539, 35078, 557, 1114, 2228, 4456, 30388, 60776, 51953, 34243, 7079, 14158, 28316, 14128, 28256, 56512, 43425, 17251, 34502, 7597, 13105, 26210, 52420, 35241, 883, 1766, 3532, 4129, 8258, 16516, 33032, 4657, 9314, 18628], t = function(s) {
    return (s / 2 | s * 128) & 255;
  }, n = function(s, c) {
    return t(s ^ c);
  }, i = function(s) {
    for (var c = a[s.length - 1], f = 104, o = s.length - 1; o >= 0; --o)
      for (var l = s[o], u = 0; u != 7; ++u)
        l & 64 && (c ^= r[f]), l *= 2, --f;
    return c;
  };
  return function(s) {
    for (var c = Ki(s), f = i(c), o = c.length, l = Zr(16), u = 0; u != 16; ++u) l[u] = 0;
    var x, d, p;
    for ((o & 1) === 1 && (x = f >> 8, l[o] = n(e[0], x), --o, x = f & 255, d = c[c.length - 1], l[o] = n(d, x)); o > 0; )
      --o, x = f >> 8, l[o] = n(c[o], x), --o, x = f & 255, l[o] = n(c[o], x);
    for (o = 15, p = 15 - c.length; p > 0; )
      x = f >> 8, l[o] = n(e[p], x), --o, --p, x = f & 255, l[o] = n(c[o], x), --o, --p;
    return l;
  };
}(), Zl = function(e, a, r, t, n) {
  n || (n = a), t || (t = Zi(e));
  var i, s;
  for (i = 0; i != a.length; ++i)
    s = a[i], s ^= t[r], s = (s >> 5 | s << 3) & 255, n[i] = s, ++r;
  return [n, r, t];
}, ql = function(e) {
  var a = 0, r = Zi(e);
  return function(t) {
    var n = Zl("", t, a, r);
    return a = n[1], n[0];
  };
};
function Ql(e, a, r, t) {
  var n = { key: Ue(e), verificationBytes: Ue(e) };
  return r.password && (n.verifier = Jl(r.password)), t.valid = n.verificationBytes === n.verifier, t.valid && (t.insitu = ql(r.password)), n;
}
function e1(e, a, r) {
  var t = r || {};
  return t.Info = e.read_shift(2), e.l -= 2, t.Info === 1 ? t.Data = jl(e) : t.Data = Kl(e, a), t;
}
function r1(e, a, r) {
  var t = { Type: r.biff >= 8 ? e.read_shift(2) : 0 };
  return t.Type ? e1(e, a - 2, t) : Ql(e, r.biff >= 8 ? a : a - 2, r, t), t;
}
var a1 = /* @__PURE__ */ function() {
  function e(n, i) {
    switch (i.type) {
      case "base64":
        return a(xr(n), i);
      case "binary":
        return a(n, i);
      case "buffer":
        return a(ge && Buffer.isBuffer(n) ? n.toString("binary") : ha(n), i);
      case "array":
        return a(oa(n), i);
    }
    throw new Error("Unrecognized type " + i.type);
  }
  function a(n, i) {
    var s = i || {}, c = s.dense ? [] : {}, f = n.match(/\\trowd.*?\\row\b/g);
    if (!f.length) throw new Error("RTF missing table");
    var o = { s: { c: 0, r: 0 }, e: { c: 0, r: f.length - 1 } };
    return f.forEach(function(l, u) {
      Array.isArray(c) && (c[u] = []);
      for (var x = /\\\w+\b/g, d = 0, p, h = -1; p = x.exec(l); ) {
        switch (p[0]) {
          case "\\cell":
            var m = l.slice(d, x.lastIndex - p[0].length);
            if (m[0] == " " && (m = m.slice(1)), ++h, m.length) {
              var A = { v: m, t: "s" };
              Array.isArray(c) ? c[u][h] = A : c[he({ r: u, c: h })] = A;
            }
            break;
        }
        d = x.lastIndex;
      }
      h > o.e.c && (o.e.c = h);
    }), c["!ref"] = _e(o), c;
  }
  function r(n, i) {
    return Qr(e(n, i), i);
  }
  function t(n) {
    for (var i = ["{\\rtf1\\ansi"], s = Oe(n["!ref"]), c, f = Array.isArray(n), o = s.s.r; o <= s.e.r; ++o) {
      i.push("\\trowd\\trautofit1");
      for (var l = s.s.c; l <= s.e.c; ++l) i.push("\\cellx" + (l + 1));
      for (i.push("\\pard\\intbl"), l = s.s.c; l <= s.e.c; ++l) {
        var u = he({ r: o, c: l });
        c = f ? (n[o] || [])[l] : n[u], !(!c || c.v == null && (!c.f || c.F)) && (i.push(" " + (c.w || (Wr(c), c.w))), i.push("\\cell"));
      }
      i.push("\\pard\\intbl\\row");
    }
    return i.join("") + "}";
  }
  return {
    to_workbook: r,
    to_sheet: e,
    from_sheet: t
  };
}();
function t1(e) {
  var a = e.slice(e[0] === "#" ? 1 : 0).slice(0, 6);
  return [parseInt(a.slice(0, 2), 16), parseInt(a.slice(2, 4), 16), parseInt(a.slice(4, 6), 16)];
}
function qa(e) {
  for (var a = 0, r = 1; a != 3; ++a) r = r * 256 + (e[a] > 255 ? 255 : e[a] < 0 ? 0 : e[a]);
  return r.toString(16).toUpperCase().slice(1);
}
function n1(e) {
  var a = e[0] / 255, r = e[1] / 255, t = e[2] / 255, n = Math.max(a, r, t), i = Math.min(a, r, t), s = n - i;
  if (s === 0) return [0, 0, a];
  var c = 0, f = 0, o = n + i;
  switch (f = s / (o > 1 ? 2 - o : o), n) {
    case a:
      c = ((r - t) / s + 6) % 6;
      break;
    case r:
      c = (t - a) / s + 2;
      break;
    case t:
      c = (a - r) / s + 4;
      break;
  }
  return [c / 6, f, o / 2];
}
function i1(e) {
  var a = e[0], r = e[1], t = e[2], n = r * 2 * (t < 0.5 ? t : 1 - t), i = t - n / 2, s = [i, i, i], c = 6 * a, f;
  if (r !== 0) switch (c | 0) {
    case 0:
    case 6:
      f = n * c, s[0] += n, s[1] += f;
      break;
    case 1:
      f = n * (2 - c), s[0] += f, s[1] += n;
      break;
    case 2:
      f = n * (c - 2), s[1] += n, s[2] += f;
      break;
    case 3:
      f = n * (4 - c), s[1] += f, s[2] += n;
      break;
    case 4:
      f = n * (c - 4), s[2] += n, s[0] += f;
      break;
    case 5:
      f = n * (6 - c), s[2] += f, s[0] += n;
      break;
  }
  for (var o = 0; o != 3; ++o) s[o] = Math.round(s[o] * 255);
  return s;
}
function Ct(e, a) {
  if (a === 0) return e;
  var r = n1(t1(e));
  return a < 0 ? r[2] = r[2] * (1 + a) : r[2] = 1 - (1 - r[2]) * (1 - a), qa(i1(r));
}
var qi = 6, s1 = 15, c1 = 1, ir = qi;
function yt(e) {
  return Math.floor((e + Math.round(128 / ir) / 256) * ir);
}
function Dt(e) {
  return Math.floor((e - 5) / ir * 100 + 0.5) / 100;
}
function qt(e) {
  return Math.round((e * ir + 5) / ir * 256) / 256;
}
function Wt(e) {
  return qt(Dt(yt(e)));
}
function A0(e) {
  var a = Math.abs(e - Wt(e)), r = ir;
  if (a > 5e-3) for (ir = c1; ir < s1; ++ir) Math.abs(e - Wt(e)) <= a && (a = Math.abs(e - Wt(e)), r = ir);
  ir = r;
}
function Fa(e) {
  e.width ? (e.wpx = yt(e.width), e.wch = Dt(e.wpx), e.MDW = ir) : e.wpx ? (e.wch = Dt(e.wpx), e.width = qt(e.wch), e.MDW = ir) : typeof e.wch == "number" && (e.width = qt(e.wch), e.wpx = yt(e.width), e.MDW = ir), e.customWidth && delete e.customWidth;
}
var f1 = 96, Qi = f1;
function es(e) {
  return e * 96 / Qi;
}
function Qa(e) {
  return e * Qi / 96;
}
var o1 = {
  None: "none",
  Solid: "solid",
  Gray50: "mediumGray",
  Gray75: "darkGray",
  Gray25: "lightGray",
  HorzStripe: "darkHorizontal",
  VertStripe: "darkVertical",
  ReverseDiagStripe: "darkDown",
  DiagStripe: "darkUp",
  DiagCross: "darkGrid",
  ThickDiagCross: "darkTrellis",
  ThinHorzStripe: "lightHorizontal",
  ThinVertStripe: "lightVertical",
  ThinReverseDiagStripe: "lightDown",
  ThinHorzCross: "lightGrid"
};
function l1(e, a, r, t) {
  a.Borders = [];
  var n = {}, i = !1;
  (e[0].match(ar) || []).forEach(function(s) {
    var c = oe(s);
    switch (Nr(c[0])) {
      case "<borders":
      case "<borders>":
      case "</borders>":
        break;
      case "<border":
      case "<border>":
      case "<border/>":
        n = /*::(*/
        {}, c.diagonalUp && (n.diagonalUp = Ce(c.diagonalUp)), c.diagonalDown && (n.diagonalDown = Ce(c.diagonalDown)), a.Borders.push(n);
        break;
      case "</border>":
        break;
      case "<left/>":
        break;
      case "<left":
      case "<left>":
        break;
      case "</left>":
        break;
      case "<right/>":
        break;
      case "<right":
      case "<right>":
        break;
      case "</right>":
        break;
      case "<top/>":
        break;
      case "<top":
      case "<top>":
        break;
      case "</top>":
        break;
      case "<bottom/>":
        break;
      case "<bottom":
      case "<bottom>":
        break;
      case "</bottom>":
        break;
      case "<diagonal":
      case "<diagonal>":
      case "<diagonal/>":
        break;
      case "</diagonal>":
        break;
      case "<horizontal":
      case "<horizontal>":
      case "<horizontal/>":
        break;
      case "</horizontal>":
        break;
      case "<vertical":
      case "<vertical>":
      case "<vertical/>":
        break;
      case "</vertical>":
        break;
      case "<start":
      case "<start>":
      case "<start/>":
        break;
      case "</start>":
        break;
      case "<end":
      case "<end>":
      case "<end/>":
        break;
      case "</end>":
        break;
      case "<color":
      case "<color>":
        break;
      case "<color/>":
      case "</color>":
        break;
      case "<extLst":
      case "<extLst>":
      case "</extLst>":
        break;
      case "<ext":
        i = !0;
        break;
      case "</ext>":
        i = !1;
        break;
      default:
        if (t && t.WTF && !i)
          throw new Error("unrecognized " + c[0] + " in borders");
    }
  });
}
function u1(e, a, r, t) {
  a.Fills = [];
  var n = {}, i = !1;
  (e[0].match(ar) || []).forEach(function(s) {
    var c = oe(s);
    switch (Nr(c[0])) {
      case "<fills":
      case "<fills>":
      case "</fills>":
        break;
      case "<fill>":
      case "<fill":
      case "<fill/>":
        n = {}, a.Fills.push(n);
        break;
      case "</fill>":
        break;
      case "<gradientFill>":
        break;
      case "<gradientFill":
      case "</gradientFill>":
        a.Fills.push(n), n = {};
        break;
      case "<patternFill":
      case "<patternFill>":
        c.patternType && (n.patternType = c.patternType);
        break;
      case "<patternFill/>":
      case "</patternFill>":
        break;
      case "<bgColor":
        n.bgColor || (n.bgColor = {}), c.indexed && (n.bgColor.indexed = parseInt(c.indexed, 10)), c.theme && (n.bgColor.theme = parseInt(c.theme, 10)), c.tint && (n.bgColor.tint = parseFloat(c.tint)), c.rgb && (n.bgColor.rgb = c.rgb.slice(-6));
        break;
      case "<bgColor/>":
      case "</bgColor>":
        break;
      case "<fgColor":
        n.fgColor || (n.fgColor = {}), c.theme && (n.fgColor.theme = parseInt(c.theme, 10)), c.tint && (n.fgColor.tint = parseFloat(c.tint)), c.rgb != null && (n.fgColor.rgb = c.rgb.slice(-6));
        break;
      case "<fgColor/>":
      case "</fgColor>":
        break;
      case "<stop":
      case "<stop/>":
        break;
      case "</stop>":
        break;
      case "<color":
      case "<color/>":
        break;
      case "</color>":
        break;
      case "<extLst":
      case "<extLst>":
      case "</extLst>":
        break;
      case "<ext":
        i = !0;
        break;
      case "</ext>":
        i = !1;
        break;
      default:
        if (t && t.WTF && !i)
          throw new Error("unrecognized " + c[0] + " in fills");
    }
  });
}
function h1(e, a, r, t) {
  a.Fonts = [];
  var n = {}, i = !1;
  (e[0].match(ar) || []).forEach(function(s) {
    var c = oe(s);
    switch (Nr(c[0])) {
      case "<fonts":
      case "<fonts>":
      case "</fonts>":
        break;
      case "<font":
      case "<font>":
        break;
      case "</font>":
      case "<font/>":
        a.Fonts.push(n), n = {};
        break;
      case "<name":
        c.val && (n.name = Fe(c.val));
        break;
      case "<name/>":
      case "</name>":
        break;
      case "<b":
        n.bold = c.val ? Ce(c.val) : 1;
        break;
      case "<b/>":
        n.bold = 1;
        break;
      case "<i":
        n.italic = c.val ? Ce(c.val) : 1;
        break;
      case "<i/>":
        n.italic = 1;
        break;
      case "<u":
        switch (c.val) {
          case "none":
            n.underline = 0;
            break;
          case "single":
            n.underline = 1;
            break;
          case "double":
            n.underline = 2;
            break;
          case "singleAccounting":
            n.underline = 33;
            break;
          case "doubleAccounting":
            n.underline = 34;
            break;
        }
        break;
      case "<u/>":
        n.underline = 1;
        break;
      case "<strike":
        n.strike = c.val ? Ce(c.val) : 1;
        break;
      case "<strike/>":
        n.strike = 1;
        break;
      case "<outline":
        n.outline = c.val ? Ce(c.val) : 1;
        break;
      case "<outline/>":
        n.outline = 1;
        break;
      case "<shadow":
        n.shadow = c.val ? Ce(c.val) : 1;
        break;
      case "<shadow/>":
        n.shadow = 1;
        break;
      case "<condense":
        n.condense = c.val ? Ce(c.val) : 1;
        break;
      case "<condense/>":
        n.condense = 1;
        break;
      case "<extend":
        n.extend = c.val ? Ce(c.val) : 1;
        break;
      case "<extend/>":
        n.extend = 1;
        break;
      case "<sz":
        c.val && (n.sz = +c.val);
        break;
      case "<sz/>":
      case "</sz>":
        break;
      case "<vertAlign":
        c.val && (n.vertAlign = c.val);
        break;
      case "<vertAlign/>":
      case "</vertAlign>":
        break;
      case "<family":
        c.val && (n.family = parseInt(c.val, 10));
        break;
      case "<family/>":
      case "</family>":
        break;
      case "<scheme":
        c.val && (n.scheme = c.val);
        break;
      case "<scheme/>":
      case "</scheme>":
        break;
      case "<charset":
        if (c.val == "1") break;
        c.codepage = s0[parseInt(c.val, 10)];
        break;
      case "<color":
        if (n.color || (n.color = {}), c.auto && (n.color.auto = Ce(c.auto)), c.rgb) n.color.rgb = c.rgb.slice(-6);
        else if (c.indexed) {
          n.color.index = parseInt(c.indexed, 10);
          var f = sa[n.color.index];
          n.color.index == 81 && (f = sa[1]), f || (f = sa[1]), n.color.rgb = f[0].toString(16) + f[1].toString(16) + f[2].toString(16);
        } else c.theme && (n.color.theme = parseInt(c.theme, 10), c.tint && (n.color.tint = parseFloat(c.tint)), c.theme && r.themeElements && r.themeElements.clrScheme && (n.color.rgb = Ct(r.themeElements.clrScheme[n.color.theme].rgb, n.color.tint || 0)));
        break;
      case "<color/>":
      case "</color>":
        break;
      case "<AlternateContent":
        i = !0;
        break;
      case "</AlternateContent>":
        i = !1;
        break;
      case "<extLst":
      case "<extLst>":
      case "</extLst>":
        break;
      case "<ext":
        i = !0;
        break;
      case "</ext>":
        i = !1;
        break;
      default:
        if (t && t.WTF && !i)
          throw new Error("unrecognized " + c[0] + " in fonts");
    }
  });
}
function x1(e, a, r) {
  a.NumberFmt = [];
  for (var t = Or(de), n = 0; n < t.length; ++n) a.NumberFmt[t[n]] = de[t[n]];
  var i = e[0].match(ar);
  if (i)
    for (n = 0; n < i.length; ++n) {
      var s = oe(i[n]);
      switch (Nr(s[0])) {
        case "<numFmts":
        case "</numFmts>":
        case "<numFmts/>":
        case "<numFmts>":
          break;
        case "<numFmt":
          {
            var c = ke(Fe(s.formatCode)), f = parseInt(s.numFmtId, 10);
            if (a.NumberFmt[f] = c, f > 0) {
              if (f > 392) {
                for (f = 392; f > 60 && a.NumberFmt[f] != null; --f) ;
                a.NumberFmt[f] = c;
              }
              ia(c, f);
            }
          }
          break;
        case "</numFmt>":
          break;
        default:
          if (r.WTF) throw new Error("unrecognized " + s[0] + " in numFmts");
      }
    }
}
var pt = ["numFmtId", "fillId", "fontId", "borderId", "xfId"], vt = ["applyAlignment", "applyBorder", "applyFill", "applyFont", "applyNumberFormat", "applyProtection", "pivotButton", "quotePrefix"];
function d1(e, a, r) {
  a.CellXf = [];
  var t, n = !1;
  (e[0].match(ar) || []).forEach(function(i) {
    var s = oe(i), c = 0;
    switch (Nr(s[0])) {
      case "<cellXfs":
      case "<cellXfs>":
      case "<cellXfs/>":
      case "</cellXfs>":
        break;
      case "<xf":
      case "<xf/>":
        for (t = s, delete t[0], c = 0; c < pt.length; ++c) t[pt[c]] && (t[pt[c]] = parseInt(t[pt[c]], 10));
        for (c = 0; c < vt.length; ++c) t[vt[c]] && (t[vt[c]] = Ce(t[vt[c]]));
        if (a.NumberFmt && t.numFmtId > 392) {
          for (c = 392; c > 60; --c) if (a.NumberFmt[t.numFmtId] == a.NumberFmt[c]) {
            t.numFmtId = c;
            break;
          }
        }
        a.CellXf.push(t);
        break;
      case "</xf>":
        break;
      case "<alignment":
      case "<alignment/>":
        var f = {};
        s.vertical && (f.vertical = s.vertical), s.horizontal && (f.horizontal = s.horizontal), s.textRotation != null && (f.textRotation = s.textRotation), s.indent && (f.indent = s.indent), s.wrapText && (f.wrapText = Ce(s.wrapText)), t.alignment = f;
        break;
      case "</alignment>":
        break;
      case "<protection":
        break;
      case "</protection>":
      case "<protection/>":
        break;
      case "<AlternateContent":
        n = !0;
        break;
      case "</AlternateContent>":
        n = !1;
        break;
      case "<extLst":
      case "<extLst>":
      case "</extLst>":
        break;
      case "<ext":
        n = !0;
        break;
      case "</ext>":
        n = !1;
        break;
      default:
        if (r && r.WTF && !n)
          throw new Error("unrecognized " + s[0] + " in cellXfs");
    }
  });
}
var p1 = /* @__PURE__ */ function() {
  var a = /<(?:\w+:)?numFmts([^>]*)>[\S\s]*?<\/(?:\w+:)?numFmts>/, r = /<(?:\w+:)?cellXfs([^>]*)>[\S\s]*?<\/(?:\w+:)?cellXfs>/, t = /<(?:\w+:)?fills([^>]*)>[\S\s]*?<\/(?:\w+:)?fills>/, n = /<(?:\w+:)?fonts([^>]*)>[\S\s]*?<\/(?:\w+:)?fonts>/, i = /<(?:\w+:)?borders([^>]*)>[\S\s]*?<\/(?:\w+:)?borders>/;
  return function(c, f, o) {
    var l = {};
    if (!c) return l;
    c = c.replace(/<!--([\s\S]*?)-->/mg, "").replace(/<!DOCTYPE[^\[]*\[[^\]]*\]>/gm, "");
    var u;
    return (u = c.match(a)) && x1(u, l, o), (u = c.match(n)) && h1(u, l, f, o), (u = c.match(t)) && u1(u, l, f, o), (u = c.match(i)) && l1(u, l, f, o), (u = c.match(r)) && d1(u, l, o), l;
  };
}();
function v1(e, a) {
  var r = e.read_shift(2), t = er(e);
  return [r, t];
}
function m1(e, a, r) {
  var t = {};
  t.sz = e.read_shift(2) / 20;
  var n = Sf(e);
  n.fItalic && (t.italic = 1), n.fCondense && (t.condense = 1), n.fExtend && (t.extend = 1), n.fShadow && (t.shadow = 1), n.fOutline && (t.outline = 1), n.fStrikeout && (t.strike = 1);
  var i = e.read_shift(2);
  switch (i === 700 && (t.bold = 1), e.read_shift(2)) {
    case 1:
      t.vertAlign = "superscript";
      break;
    case 2:
      t.vertAlign = "subscript";
      break;
  }
  var s = e.read_shift(1);
  s != 0 && (t.underline = s);
  var c = e.read_shift(1);
  c > 0 && (t.family = c);
  var f = e.read_shift(1);
  switch (f > 0 && (t.charset = f), e.l++, t.color = Ff(e), e.read_shift(1)) {
    case 1:
      t.scheme = "major";
      break;
    case 2:
      t.scheme = "minor";
      break;
  }
  return t.name = er(e), t;
}
var g1 = rr;
function E1(e, a) {
  var r = e.l + a, t = e.read_shift(2), n = e.read_shift(2);
  return e.l = r, { ixfe: t, numFmtId: n };
}
var _1 = rr;
function T1(e, a, r) {
  var t = {};
  t.NumberFmt = [];
  for (var n in de) t.NumberFmt[n] = de[n];
  t.CellXf = [], t.Fonts = [];
  var i = [], s = !1;
  return Vr(e, function(f, o, l) {
    switch (l) {
      case 44:
        t.NumberFmt[f[0]] = f[1], ia(f[1], f[0]);
        break;
      case 43:
        t.Fonts.push(f), f.color.theme != null && a && a.themeElements && a.themeElements.clrScheme && (f.color.rgb = Ct(a.themeElements.clrScheme[f.color.theme].rgb, f.color.tint || 0));
        break;
      case 1025:
        break;
      case 45:
        break;
      case 46:
        break;
      case 47:
        i[i.length - 1] == 617 && t.CellXf.push(f);
        break;
      case 48:
      case 507:
      case 572:
      case 475:
        break;
      case 1171:
      case 2102:
      case 1130:
      case 512:
      case 2095:
      case 3072:
        break;
      case 35:
        s = !0;
        break;
      case 36:
        s = !1;
        break;
      case 37:
        i.push(l), s = !0;
        break;
      case 38:
        i.pop(), s = !1;
        break;
      default:
        if (o.T > 0) i.push(l);
        else if (o.T < 0) i.pop();
        else if (!s || r.WTF && i[i.length - 1] != 37) throw new Error("Unexpected record 0x" + l.toString(16));
    }
  }), t;
}
var k1 = [
  "</a:lt1>",
  "</a:dk1>",
  "</a:lt2>",
  "</a:dk2>",
  "</a:accent1>",
  "</a:accent2>",
  "</a:accent3>",
  "</a:accent4>",
  "</a:accent5>",
  "</a:accent6>",
  "</a:hlink>",
  "</a:folHlink>"
];
function w1(e, a, r) {
  a.themeElements.clrScheme = [];
  var t = {};
  (e[0].match(ar) || []).forEach(function(n) {
    var i = oe(n);
    switch (i[0]) {
      case "<a:clrScheme":
      case "</a:clrScheme>":
        break;
      case "<a:srgbClr":
        t.rgb = i.val;
        break;
      case "<a:sysClr":
        t.rgb = i.lastClr;
        break;
      case "<a:dk1>":
      case "</a:dk1>":
      case "<a:lt1>":
      case "</a:lt1>":
      case "<a:dk2>":
      case "</a:dk2>":
      case "<a:lt2>":
      case "</a:lt2>":
      case "<a:accent1>":
      case "</a:accent1>":
      case "<a:accent2>":
      case "</a:accent2>":
      case "<a:accent3>":
      case "</a:accent3>":
      case "<a:accent4>":
      case "</a:accent4>":
      case "<a:accent5>":
      case "</a:accent5>":
      case "<a:accent6>":
      case "</a:accent6>":
      case "<a:hlink>":
      case "</a:hlink>":
      case "<a:folHlink>":
      case "</a:folHlink>":
        i[0].charAt(1) === "/" ? (a.themeElements.clrScheme[k1.indexOf(i[0])] = t, t = {}) : t.name = i[0].slice(3, i[0].length - 1);
        break;
      default:
        if (r && r.WTF) throw new Error("Unrecognized " + i[0] + " in clrScheme");
    }
  });
}
function A1() {
}
function F1() {
}
var S1 = /<a:clrScheme([^>]*)>[\s\S]*<\/a:clrScheme>/, C1 = /<a:fontScheme([^>]*)>[\s\S]*<\/a:fontScheme>/, y1 = /<a:fmtScheme([^>]*)>[\s\S]*<\/a:fmtScheme>/;
function D1(e, a, r) {
  a.themeElements = {};
  var t;
  [
    /* clrScheme CT_ColorScheme */
    ["clrScheme", S1, w1],
    /* fontScheme CT_FontScheme */
    ["fontScheme", C1, A1],
    /* fmtScheme CT_StyleMatrix */
    ["fmtScheme", y1, F1]
  ].forEach(function(n) {
    if (!(t = e.match(n[1]))) throw new Error(n[0] + " not found in themeElements");
    n[2](t, a, r);
  });
}
var R1 = /<a:themeElements([^>]*)>[\s\S]*<\/a:themeElements>/;
function rs(e, a) {
  (!e || e.length === 0) && (e = O1());
  var r, t = {};
  if (!(r = e.match(R1))) throw new Error("themeElements not found in theme");
  return D1(r[0], t, a), t.raw = e, t;
}
function O1(e, a) {
  var r = [hi];
  return r[r.length] = '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">', r[r.length] = "<a:themeElements>", r[r.length] = '<a:clrScheme name="Office">', r[r.length] = '<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>', r[r.length] = '<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>', r[r.length] = '<a:dk2><a:srgbClr val="1F497D"/></a:dk2>', r[r.length] = '<a:lt2><a:srgbClr val="EEECE1"/></a:lt2>', r[r.length] = '<a:accent1><a:srgbClr val="4F81BD"/></a:accent1>', r[r.length] = '<a:accent2><a:srgbClr val="C0504D"/></a:accent2>', r[r.length] = '<a:accent3><a:srgbClr val="9BBB59"/></a:accent3>', r[r.length] = '<a:accent4><a:srgbClr val="8064A2"/></a:accent4>', r[r.length] = '<a:accent5><a:srgbClr val="4BACC6"/></a:accent5>', r[r.length] = '<a:accent6><a:srgbClr val="F79646"/></a:accent6>', r[r.length] = '<a:hlink><a:srgbClr val="0000FF"/></a:hlink>', r[r.length] = '<a:folHlink><a:srgbClr val="800080"/></a:folHlink>', r[r.length] = "</a:clrScheme>", r[r.length] = '<a:fontScheme name="Office">', r[r.length] = "<a:majorFont>", r[r.length] = '<a:latin typeface="Cambria"/>', r[r.length] = '<a:ea typeface=""/>', r[r.length] = '<a:cs typeface=""/>', r[r.length] = '<a:font script="Jpan" typeface="ＭＳ Ｐゴシック"/>', r[r.length] = '<a:font script="Hang" typeface="맑은 고딕"/>', r[r.length] = '<a:font script="Hans" typeface="宋体"/>', r[r.length] = '<a:font script="Hant" typeface="新細明體"/>', r[r.length] = '<a:font script="Arab" typeface="Times New Roman"/>', r[r.length] = '<a:font script="Hebr" typeface="Times New Roman"/>', r[r.length] = '<a:font script="Thai" typeface="Tahoma"/>', r[r.length] = '<a:font script="Ethi" typeface="Nyala"/>', r[r.length] = '<a:font script="Beng" typeface="Vrinda"/>', r[r.length] = '<a:font script="Gujr" typeface="Shruti"/>', r[r.length] = '<a:font script="Khmr" typeface="MoolBoran"/>', r[r.length] = '<a:font script="Knda" typeface="Tunga"/>', r[r.length] = '<a:font script="Guru" typeface="Raavi"/>', r[r.length] = '<a:font script="Cans" typeface="Euphemia"/>', r[r.length] = '<a:font script="Cher" typeface="Plantagenet Cherokee"/>', r[r.length] = '<a:font script="Yiii" typeface="Microsoft Yi Baiti"/>', r[r.length] = '<a:font script="Tibt" typeface="Microsoft Himalaya"/>', r[r.length] = '<a:font script="Thaa" typeface="MV Boli"/>', r[r.length] = '<a:font script="Deva" typeface="Mangal"/>', r[r.length] = '<a:font script="Telu" typeface="Gautami"/>', r[r.length] = '<a:font script="Taml" typeface="Latha"/>', r[r.length] = '<a:font script="Syrc" typeface="Estrangelo Edessa"/>', r[r.length] = '<a:font script="Orya" typeface="Kalinga"/>', r[r.length] = '<a:font script="Mlym" typeface="Kartika"/>', r[r.length] = '<a:font script="Laoo" typeface="DokChampa"/>', r[r.length] = '<a:font script="Sinh" typeface="Iskoola Pota"/>', r[r.length] = '<a:font script="Mong" typeface="Mongolian Baiti"/>', r[r.length] = '<a:font script="Viet" typeface="Times New Roman"/>', r[r.length] = '<a:font script="Uigh" typeface="Microsoft Uighur"/>', r[r.length] = '<a:font script="Geor" typeface="Sylfaen"/>', r[r.length] = "</a:majorFont>", r[r.length] = "<a:minorFont>", r[r.length] = '<a:latin typeface="Calibri"/>', r[r.length] = '<a:ea typeface=""/>', r[r.length] = '<a:cs typeface=""/>', r[r.length] = '<a:font script="Jpan" typeface="ＭＳ Ｐゴシック"/>', r[r.length] = '<a:font script="Hang" typeface="맑은 고딕"/>', r[r.length] = '<a:font script="Hans" typeface="宋体"/>', r[r.length] = '<a:font script="Hant" typeface="新細明體"/>', r[r.length] = '<a:font script="Arab" typeface="Arial"/>', r[r.length] = '<a:font script="Hebr" typeface="Arial"/>', r[r.length] = '<a:font script="Thai" typeface="Tahoma"/>', r[r.length] = '<a:font script="Ethi" typeface="Nyala"/>', r[r.length] = '<a:font script="Beng" typeface="Vrinda"/>', r[r.length] = '<a:font script="Gujr" typeface="Shruti"/>', r[r.length] = '<a:font script="Khmr" typeface="DaunPenh"/>', r[r.length] = '<a:font script="Knda" typeface="Tunga"/>', r[r.length] = '<a:font script="Guru" typeface="Raavi"/>', r[r.length] = '<a:font script="Cans" typeface="Euphemia"/>', r[r.length] = '<a:font script="Cher" typeface="Plantagenet Cherokee"/>', r[r.length] = '<a:font script="Yiii" typeface="Microsoft Yi Baiti"/>', r[r.length] = '<a:font script="Tibt" typeface="Microsoft Himalaya"/>', r[r.length] = '<a:font script="Thaa" typeface="MV Boli"/>', r[r.length] = '<a:font script="Deva" typeface="Mangal"/>', r[r.length] = '<a:font script="Telu" typeface="Gautami"/>', r[r.length] = '<a:font script="Taml" typeface="Latha"/>', r[r.length] = '<a:font script="Syrc" typeface="Estrangelo Edessa"/>', r[r.length] = '<a:font script="Orya" typeface="Kalinga"/>', r[r.length] = '<a:font script="Mlym" typeface="Kartika"/>', r[r.length] = '<a:font script="Laoo" typeface="DokChampa"/>', r[r.length] = '<a:font script="Sinh" typeface="Iskoola Pota"/>', r[r.length] = '<a:font script="Mong" typeface="Mongolian Baiti"/>', r[r.length] = '<a:font script="Viet" typeface="Arial"/>', r[r.length] = '<a:font script="Uigh" typeface="Microsoft Uighur"/>', r[r.length] = '<a:font script="Geor" typeface="Sylfaen"/>', r[r.length] = "</a:minorFont>", r[r.length] = "</a:fontScheme>", r[r.length] = '<a:fmtScheme name="Office">', r[r.length] = "<a:fillStyleLst>", r[r.length] = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>', r[r.length] = '<a:gradFill rotWithShape="1">', r[r.length] = "<a:gsLst>", r[r.length] = '<a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="50000"/><a:satMod val="300000"/></a:schemeClr></a:gs>', r[r.length] = '<a:gs pos="35000"><a:schemeClr val="phClr"><a:tint val="37000"/><a:satMod val="300000"/></a:schemeClr></a:gs>', r[r.length] = '<a:gs pos="100000"><a:schemeClr val="phClr"><a:tint val="15000"/><a:satMod val="350000"/></a:schemeClr></a:gs>', r[r.length] = "</a:gsLst>", r[r.length] = '<a:lin ang="16200000" scaled="1"/>', r[r.length] = "</a:gradFill>", r[r.length] = '<a:gradFill rotWithShape="1">', r[r.length] = "<a:gsLst>", r[r.length] = '<a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="100000"/><a:shade val="100000"/><a:satMod val="130000"/></a:schemeClr></a:gs>', r[r.length] = '<a:gs pos="100000"><a:schemeClr val="phClr"><a:tint val="50000"/><a:shade val="100000"/><a:satMod val="350000"/></a:schemeClr></a:gs>', r[r.length] = "</a:gsLst>", r[r.length] = '<a:lin ang="16200000" scaled="0"/>', r[r.length] = "</a:gradFill>", r[r.length] = "</a:fillStyleLst>", r[r.length] = "<a:lnStyleLst>", r[r.length] = '<a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"><a:shade val="95000"/><a:satMod val="105000"/></a:schemeClr></a:solidFill><a:prstDash val="solid"/></a:ln>', r[r.length] = '<a:ln w="25400" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>', r[r.length] = '<a:ln w="38100" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>', r[r.length] = "</a:lnStyleLst>", r[r.length] = "<a:effectStyleLst>", r[r.length] = "<a:effectStyle>", r[r.length] = "<a:effectLst>", r[r.length] = '<a:outerShdw blurRad="40000" dist="20000" dir="5400000" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="38000"/></a:srgbClr></a:outerShdw>', r[r.length] = "</a:effectLst>", r[r.length] = "</a:effectStyle>", r[r.length] = "<a:effectStyle>", r[r.length] = "<a:effectLst>", r[r.length] = '<a:outerShdw blurRad="40000" dist="23000" dir="5400000" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="35000"/></a:srgbClr></a:outerShdw>', r[r.length] = "</a:effectLst>", r[r.length] = "</a:effectStyle>", r[r.length] = "<a:effectStyle>", r[r.length] = "<a:effectLst>", r[r.length] = '<a:outerShdw blurRad="40000" dist="23000" dir="5400000" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="35000"/></a:srgbClr></a:outerShdw>', r[r.length] = "</a:effectLst>", r[r.length] = '<a:scene3d><a:camera prst="orthographicFront"><a:rot lat="0" lon="0" rev="0"/></a:camera><a:lightRig rig="threePt" dir="t"><a:rot lat="0" lon="0" rev="1200000"/></a:lightRig></a:scene3d>', r[r.length] = '<a:sp3d><a:bevelT w="63500" h="25400"/></a:sp3d>', r[r.length] = "</a:effectStyle>", r[r.length] = "</a:effectStyleLst>", r[r.length] = "<a:bgFillStyleLst>", r[r.length] = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>', r[r.length] = '<a:gradFill rotWithShape="1">', r[r.length] = "<a:gsLst>", r[r.length] = '<a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="40000"/><a:satMod val="350000"/></a:schemeClr></a:gs>', r[r.length] = '<a:gs pos="40000"><a:schemeClr val="phClr"><a:tint val="45000"/><a:shade val="99000"/><a:satMod val="350000"/></a:schemeClr></a:gs>', r[r.length] = '<a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="20000"/><a:satMod val="255000"/></a:schemeClr></a:gs>', r[r.length] = "</a:gsLst>", r[r.length] = '<a:path path="circle"><a:fillToRect l="50000" t="-80000" r="50000" b="180000"/></a:path>', r[r.length] = "</a:gradFill>", r[r.length] = '<a:gradFill rotWithShape="1">', r[r.length] = "<a:gsLst>", r[r.length] = '<a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="80000"/><a:satMod val="300000"/></a:schemeClr></a:gs>', r[r.length] = '<a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="30000"/><a:satMod val="200000"/></a:schemeClr></a:gs>', r[r.length] = "</a:gsLst>", r[r.length] = '<a:path path="circle"><a:fillToRect l="50000" t="50000" r="50000" b="50000"/></a:path>', r[r.length] = "</a:gradFill>", r[r.length] = "</a:bgFillStyleLst>", r[r.length] = "</a:fmtScheme>", r[r.length] = "</a:themeElements>", r[r.length] = "<a:objectDefaults>", r[r.length] = "<a:spDef>", r[r.length] = '<a:spPr/><a:bodyPr/><a:lstStyle/><a:style><a:lnRef idx="1"><a:schemeClr val="accent1"/></a:lnRef><a:fillRef idx="3"><a:schemeClr val="accent1"/></a:fillRef><a:effectRef idx="2"><a:schemeClr val="accent1"/></a:effectRef><a:fontRef idx="minor"><a:schemeClr val="lt1"/></a:fontRef></a:style>', r[r.length] = "</a:spDef>", r[r.length] = "<a:lnDef>", r[r.length] = '<a:spPr/><a:bodyPr/><a:lstStyle/><a:style><a:lnRef idx="2"><a:schemeClr val="accent1"/></a:lnRef><a:fillRef idx="0"><a:schemeClr val="accent1"/></a:fillRef><a:effectRef idx="1"><a:schemeClr val="accent1"/></a:effectRef><a:fontRef idx="minor"><a:schemeClr val="tx1"/></a:fontRef></a:style>', r[r.length] = "</a:lnDef>", r[r.length] = "</a:objectDefaults>", r[r.length] = "<a:extraClrSchemeLst/>", r[r.length] = "</a:theme>", r.join("");
}
function N1(e, a, r) {
  var t = e.l + a, n = e.read_shift(4);
  if (n !== 124226) {
    if (!r.cellStyles) {
      e.l = t;
      return;
    }
    var i = e.slice(e.l);
    e.l = t;
    var s;
    try {
      s = ui(i, { type: "array" });
    } catch {
      return;
    }
    var c = hr(s, "theme/theme/theme1.xml", !0);
    if (c)
      return rs(c, r);
  }
}
function I1(e) {
  return e.read_shift(4);
}
function L1(e) {
  var a = {};
  switch (a.xclrType = e.read_shift(2), a.nTintShade = e.read_shift(2), a.xclrType) {
    case 0:
      e.l += 4;
      break;
    case 1:
      a.xclrValue = P1(e, 4);
      break;
    case 2:
      a.xclrValue = Wi(e);
      break;
    case 3:
      a.xclrValue = I1(e);
      break;
    case 4:
      e.l += 4;
      break;
  }
  return e.l += 8, a;
}
function P1(e, a) {
  return rr(e, a);
}
function M1(e, a) {
  return rr(e, a);
}
function b1(e) {
  var a = e.read_shift(2), r = e.read_shift(2) - 4, t = [a];
  switch (a) {
    case 4:
    case 5:
    case 7:
    case 8:
    case 9:
    case 10:
    case 11:
    case 13:
      t[1] = L1(e);
      break;
    case 6:
      t[1] = M1(e, r);
      break;
    case 14:
    case 15:
      t[1] = e.read_shift(r === 1 ? 1 : 2);
      break;
    default:
      throw new Error("Unrecognized ExtProp type: " + a + " " + r);
  }
  return t;
}
function B1(e, a) {
  var r = e.l + a;
  e.l += 2;
  var t = e.read_shift(2);
  e.l += 2;
  for (var n = e.read_shift(2), i = []; n-- > 0; ) i.push(b1(e, r - e.l));
  return { ixfe: t, ext: i };
}
function U1(e, a) {
  a.forEach(function(r) {
    switch (r[0]) {
    }
  });
}
function H1(e, a) {
  return {
    flags: e.read_shift(4),
    version: e.read_shift(4),
    name: er(e)
  };
}
function W1(e) {
  for (var a = [], r = e.read_shift(4); r-- > 0; )
    a.push([e.read_shift(4), e.read_shift(4)]);
  return a;
}
function V1(e) {
  return e.l += 4, e.read_shift(4) != 0;
}
function G1(e, a, r) {
  var t = { Types: [], Cell: [], Value: [] }, n = r || {}, i = [], s = !1, c = 2;
  return Vr(e, function(f, o, l) {
    switch (l) {
      case 335:
        t.Types.push({ name: f.name });
        break;
      case 51:
        f.forEach(function(u) {
          c == 1 ? t.Cell.push({ type: t.Types[u[0] - 1].name, index: u[1] }) : c == 0 && t.Value.push({ type: t.Types[u[0] - 1].name, index: u[1] });
        });
        break;
      case 337:
        c = f ? 1 : 0;
        break;
      case 338:
        c = 2;
        break;
      case 35:
        i.push(l), s = !0;
        break;
      case 36:
        i.pop(), s = !1;
        break;
      default:
        if (!o.T) {
          if (!s || n.WTF && i[i.length - 1] != 35)
            throw new Error("Unexpected record 0x" + l.toString(16));
        }
    }
  }), t;
}
function X1(e, a, r) {
  var t = { Types: [], Cell: [], Value: [] };
  if (!e)
    return t;
  var n = !1, i = 2, s;
  return e.replace(ar, function(c) {
    var f = oe(c);
    switch (Nr(f[0])) {
      case "<?xml":
        break;
      case "<metadata":
      case "</metadata>":
        break;
      case "<metadataTypes":
      case "</metadataTypes>":
        break;
      case "<metadataType":
        t.Types.push({ name: f.name });
        break;
      case "</metadataType>":
        break;
      case "<futureMetadata":
        for (var o = 0; o < t.Types.length; ++o)
          t.Types[o].name == f.name && (s = t.Types[o]);
        break;
      case "</futureMetadata>":
        break;
      case "<bk>":
        break;
      case "</bk>":
        break;
      case "<rc":
        i == 1 ? t.Cell.push({ type: t.Types[f.t - 1].name, index: +f.v }) : i == 0 && t.Value.push({ type: t.Types[f.t - 1].name, index: +f.v });
        break;
      case "</rc>":
        break;
      case "<cellMetadata":
        i = 1;
        break;
      case "</cellMetadata>":
        i = 2;
        break;
      case "<valueMetadata":
        i = 0;
        break;
      case "</valueMetadata>":
        i = 2;
        break;
      case "<extLst":
      case "<extLst>":
      case "</extLst>":
      case "<extLst/>":
        break;
      case "<ext":
        n = !0;
        break;
      case "</ext>":
        n = !1;
        break;
      case "<rvb":
        if (!s)
          break;
        s.offsets || (s.offsets = []), s.offsets.push(+f.i);
        break;
      default:
        if (!n && r.WTF)
          throw new Error("unrecognized " + f[0] + " in metadata");
    }
    return c;
  }), t;
}
function z1(e) {
  var a = [];
  if (!e) return a;
  var r = 1;
  return (e.match(ar) || []).forEach(function(t) {
    var n = oe(t);
    switch (n[0]) {
      case "<?xml":
        break;
      case "<calcChain":
      case "<calcChain>":
      case "</calcChain>":
        break;
      case "<c":
        delete n[0], n.i ? r = n.i : n.i = r, a.push(n);
        break;
    }
  }), a;
}
function $1(e) {
  var a = {};
  a.i = e.read_shift(4);
  var r = {};
  r.r = e.read_shift(4), r.c = e.read_shift(4), a.r = he(r);
  var t = e.read_shift(1);
  return t & 2 && (a.l = "1"), t & 8 && (a.a = "1"), a;
}
function Y1(e, a, r) {
  var t = [];
  return Vr(e, function(i, s, c) {
    switch (c) {
      case 63:
        t.push(i);
        break;
      default:
        if (!s.T) throw new Error("Unexpected record 0x" + c.toString(16));
    }
  }), t;
}
function K1(e, a, r, t) {
  if (!e) return e;
  var n = t || {}, i = !1;
  Vr(e, function(c, f, o) {
    switch (o) {
      case 359:
      case 363:
      case 364:
      case 366:
      case 367:
      case 368:
      case 369:
      case 370:
      case 371:
      case 472:
      case 577:
      case 578:
      case 579:
      case 580:
      case 581:
      case 582:
      case 583:
      case 584:
      case 585:
      case 586:
      case 587:
        break;
      case 35:
        i = !0;
        break;
      case 36:
        i = !1;
        break;
      default:
        if (!f.T) {
          if (!i || n.WTF) throw new Error("Unexpected record 0x" + o.toString(16));
        }
    }
  }, n);
}
function j1(e, a) {
  if (!e) return "??";
  var r = (e.match(/<c:chart [^>]*r:id="([^"]*)"/) || ["", ""])[1];
  return a["!id"][r].Target;
}
function An(e, a, r, t) {
  var n = Array.isArray(e), i;
  a.forEach(function(s) {
    var c = sr(s.ref);
    if (n ? (e[c.r] || (e[c.r] = []), i = e[c.r][c.c]) : i = e[s.ref], !i) {
      i = { t: "z" }, n ? e[c.r][c.c] = i : e[s.ref] = i;
      var f = Oe(e["!ref"] || "BDWGO1000001:A1");
      f.s.r > c.r && (f.s.r = c.r), f.e.r < c.r && (f.e.r = c.r), f.s.c > c.c && (f.s.c = c.c), f.e.c < c.c && (f.e.c = c.c);
      var o = _e(f);
      o !== e["!ref"] && (e["!ref"] = o);
    }
    i.c || (i.c = []);
    var l = { a: s.author, t: s.t, r: s.r, T: r };
    s.h && (l.h = s.h);
    for (var u = i.c.length - 1; u >= 0; --u) {
      if (!r && i.c[u].T) return;
      r && !i.c[u].T && i.c.splice(u, 1);
    }
    if (r && t) {
      for (u = 0; u < t.length; ++u)
        if (l.a == t[u].id) {
          l.a = t[u].name || l.a;
          break;
        }
    }
    i.c.push(l);
  });
}
function J1(e, a) {
  if (e.match(/<(?:\w+:)?comments *\/>/)) return [];
  var r = [], t = [], n = e.match(/<(?:\w+:)?authors>([\s\S]*)<\/(?:\w+:)?authors>/);
  n && n[1] && n[1].split(/<\/\w*:?author>/).forEach(function(s) {
    if (!(s === "" || s.trim() === "")) {
      var c = s.match(/<(?:\w+:)?author[^>]*>(.*)/);
      c && r.push(c[1]);
    }
  });
  var i = e.match(/<(?:\w+:)?commentList>([\s\S]*)<\/(?:\w+:)?commentList>/);
  return i && i[1] && i[1].split(/<\/\w*:?comment>/).forEach(function(s) {
    if (!(s === "" || s.trim() === "")) {
      var c = s.match(/<(?:\w+:)?comment[^>]*>/);
      if (c) {
        var f = oe(c[0]), o = { author: f.authorId && r[f.authorId] || "sheetjsghost", ref: f.ref, guid: f.guid }, l = sr(f.ref);
        if (!(a.sheetRows && a.sheetRows <= l.r)) {
          var u = s.match(/<(?:\w+:)?text>([\s\S]*)<\/(?:\w+:)?text>/), x = !!u && !!u[1] && w0(u[1]) || { r: "", t: "", h: "" };
          o.r = x.r, x.r == "<t></t>" && (x.t = x.h = ""), o.t = (x.t || "").replace(/\r\n/g, `
`).replace(/\r/g, `
`), a.cellHTML && (o.h = x.h), t.push(o);
        }
      }
    }
  }), t;
}
function Z1(e, a) {
  var r = [], t = !1, n = {}, i = 0;
  return e.replace(ar, function(c, f) {
    var o = oe(c);
    switch (Nr(o[0])) {
      case "<?xml":
        break;
      case "<ThreadedComments":
        break;
      case "</ThreadedComments>":
        break;
      case "<threadedComment":
        n = { author: o.personId, guid: o.id, ref: o.ref, T: 1 };
        break;
      case "</threadedComment>":
        n.t != null && r.push(n);
        break;
      case "<text>":
      case "<text":
        i = f + c.length;
        break;
      case "</text>":
        n.t = e.slice(i, f).replace(/\r\n/g, `
`).replace(/\r/g, `
`);
        break;
      case "<mentions":
      case "<mentions>":
        t = !0;
        break;
      case "</mentions>":
        t = !1;
        break;
      case "<extLst":
      case "<extLst>":
      case "</extLst>":
      case "<extLst/>":
        break;
      case "<ext":
        t = !0;
        break;
      case "</ext>":
        t = !1;
        break;
      default:
        if (!t && a.WTF) throw new Error("unrecognized " + o[0] + " in threaded comments");
    }
    return c;
  }), r;
}
function q1(e, a) {
  var r = [], t = !1;
  return e.replace(ar, function(i) {
    var s = oe(i);
    switch (Nr(s[0])) {
      case "<?xml":
        break;
      case "<personList":
        break;
      case "</personList>":
        break;
      case "<person":
        r.push({ name: s.displayname, id: s.id });
        break;
      case "</person>":
        break;
      case "<extLst":
      case "<extLst>":
      case "</extLst>":
      case "<extLst/>":
        break;
      case "<ext":
        t = !0;
        break;
      case "</ext>":
        t = !1;
        break;
      default:
        if (!t && a.WTF) throw new Error("unrecognized " + s[0] + " in threaded comments");
    }
    return i;
  }), r;
}
function Q1(e) {
  var a = {};
  a.iauthor = e.read_shift(4);
  var r = da(e);
  return a.rfx = r.s, a.ref = he(r.s), e.l += 16, a;
}
var eu = er;
function ru(e, a) {
  var r = [], t = [], n = {}, i = !1;
  return Vr(e, function(c, f, o) {
    switch (o) {
      case 632:
        t.push(c);
        break;
      case 635:
        n = c;
        break;
      case 637:
        n.t = c.t, n.h = c.h, n.r = c.r;
        break;
      case 636:
        if (n.author = t[n.iauthor], delete n.iauthor, a.sheetRows && n.rfx && a.sheetRows <= n.rfx.r) break;
        n.t || (n.t = ""), delete n.rfx, r.push(n);
        break;
      case 3072:
        break;
      case 35:
        i = !0;
        break;
      case 36:
        i = !1;
        break;
      case 37:
        break;
      case 38:
        break;
      default:
        if (!f.T) {
          if (!i || a.WTF) throw new Error("Unexpected record 0x" + o.toString(16));
        }
    }
  }), r;
}
var au = "application/vnd.ms-office.vbaProject";
function tu(e) {
  var a = Ee.utils.cfb_new({ root: "R" });
  return e.FullPaths.forEach(function(r, t) {
    if (!(r.slice(-1) === "/" || !r.match(/_VBA_PROJECT_CUR/))) {
      var n = r.replace(/^[^\/]*/, "R").replace(/\/_VBA_PROJECT_CUR\u0000*/, "");
      Ee.utils.cfb_add(a, n, e.FileIndex[t].content);
    }
  }), Ee.write(a);
}
function nu() {
  return { "!type": "dialog" };
}
function iu() {
  return { "!type": "dialog" };
}
function su() {
  return { "!type": "macro" };
}
function cu() {
  return { "!type": "macro" };
}
var Ta = /* @__PURE__ */ function() {
  var e = /(^|[^A-Za-z_])R(\[?-?\d+\]|[1-9]\d*|)C(\[?-?\d+\]|[1-9]\d*|)(?![A-Za-z0-9_])/g, a = { r: 0, c: 0 };
  function r(t, n, i, s) {
    var c = !1, f = !1;
    i.length == 0 ? f = !0 : i.charAt(0) == "[" && (f = !0, i = i.slice(1, -1)), s.length == 0 ? c = !0 : s.charAt(0) == "[" && (c = !0, s = s.slice(1, -1));
    var o = i.length > 0 ? parseInt(i, 10) | 0 : 0, l = s.length > 0 ? parseInt(s, 10) | 0 : 0;
    return c ? l += a.c : --l, f ? o += a.r : --o, n + (c ? "" : "$") + Ve(l) + (f ? "" : "$") + Ke(o);
  }
  return function(n, i) {
    return a = i, n.replace(e, r);
  };
}(), as = /(^|[^._A-Z0-9])([$]?)([A-Z]{1,2}|[A-W][A-Z]{2}|X[A-E][A-Z]|XF[A-D])([$]?)(10[0-3]\d{4}|104[0-7]\d{3}|1048[0-4]\d{2}|10485[0-6]\d|104857[0-6]|[1-9]\d{0,5})(?![_.\(A-Za-z0-9])/g, fu = /* @__PURE__ */ function() {
  return function(a, r) {
    return a.replace(as, function(t, n, i, s, c, f) {
      var o = m0(s) - (i ? 0 : r.c), l = v0(f) - (c ? 0 : r.r), u = l == 0 ? "" : c ? l + 1 : "[" + l + "]", x = o == 0 ? "" : i ? o + 1 : "[" + o + "]";
      return n + "R" + u + "C" + x;
    });
  };
}();
function ts(e, a) {
  return e.replace(as, function(r, t, n, i, s, c) {
    return t + (n == "$" ? n + i : Ve(m0(i) + a.c)) + (s == "$" ? s + c : Ke(v0(c) + a.r));
  });
}
function ou(e, a, r) {
  var t = Ca(a), n = t.s, i = sr(r), s = { r: i.r - n.r, c: i.c - n.c };
  return ts(e, s);
}
function lu(e) {
  return e.length != 1;
}
function Fn(e) {
  return e.replace(/_xlfn\./g, "");
}
function be(e) {
  e.l += 1;
}
function qr(e, a) {
  var r = e.read_shift(2);
  return [r & 16383, r >> 14 & 1, r >> 15 & 1];
}
function ns(e, a, r) {
  var t = 2;
  if (r) {
    if (r.biff >= 2 && r.biff <= 5) return is(e);
    r.biff == 12 && (t = 4);
  }
  var n = e.read_shift(t), i = e.read_shift(t), s = qr(e), c = qr(e);
  return { s: { r: n, c: s[0], cRel: s[1], rRel: s[2] }, e: { r: i, c: c[0], cRel: c[1], rRel: c[2] } };
}
function is(e) {
  var a = qr(e), r = qr(e), t = e.read_shift(1), n = e.read_shift(1);
  return { s: { r: a[0], c: t, cRel: a[1], rRel: a[2] }, e: { r: r[0], c: n, cRel: r[1], rRel: r[2] } };
}
function uu(e, a, r) {
  if (r.biff < 8) return is(e);
  var t = e.read_shift(r.biff == 12 ? 4 : 2), n = e.read_shift(r.biff == 12 ? 4 : 2), i = qr(e), s = qr(e);
  return { s: { r: t, c: i[0], cRel: i[1], rRel: i[2] }, e: { r: n, c: s[0], cRel: s[1], rRel: s[2] } };
}
function ss(e, a, r) {
  if (r && r.biff >= 2 && r.biff <= 5) return hu(e);
  var t = e.read_shift(r && r.biff == 12 ? 4 : 2), n = qr(e);
  return { r: t, c: n[0], cRel: n[1], rRel: n[2] };
}
function hu(e) {
  var a = qr(e), r = e.read_shift(1);
  return { r: a[0], c: r, cRel: a[1], rRel: a[2] };
}
function xu(e) {
  var a = e.read_shift(2), r = e.read_shift(2);
  return { r: a, c: r & 255, fQuoted: !!(r & 16384), cRel: r >> 15, rRel: r >> 15 };
}
function du(e, a, r) {
  var t = r && r.biff ? r.biff : 8;
  if (t >= 2 && t <= 5) return pu(e);
  var n = e.read_shift(t >= 12 ? 4 : 2), i = e.read_shift(2), s = (i & 16384) >> 14, c = (i & 32768) >> 15;
  if (i &= 16383, c == 1) for (; n > 524287; ) n -= 1048576;
  if (s == 1) for (; i > 8191; ) i = i - 16384;
  return { r: n, c: i, cRel: s, rRel: c };
}
function pu(e) {
  var a = e.read_shift(2), r = e.read_shift(1), t = (a & 32768) >> 15, n = (a & 16384) >> 14;
  return a &= 16383, t == 1 && a >= 8192 && (a = a - 16384), n == 1 && r >= 128 && (r = r - 256), { r: a, c: r, cRel: n, rRel: t };
}
function vu(e, a, r) {
  var t = (e[e.l++] & 96) >> 5, n = ns(e, r.biff >= 2 && r.biff <= 5 ? 6 : 8, r);
  return [t, n];
}
function mu(e, a, r) {
  var t = (e[e.l++] & 96) >> 5, n = e.read_shift(2, "i"), i = 8;
  if (r) switch (r.biff) {
    case 5:
      e.l += 12, i = 6;
      break;
    case 12:
      i = 12;
      break;
  }
  var s = ns(e, i, r);
  return [t, n, s];
}
function gu(e, a, r) {
  var t = (e[e.l++] & 96) >> 5;
  return e.l += r && r.biff > 8 ? 12 : r.biff < 8 ? 6 : 8, [t];
}
function Eu(e, a, r) {
  var t = (e[e.l++] & 96) >> 5, n = e.read_shift(2), i = 8;
  if (r) switch (r.biff) {
    case 5:
      e.l += 12, i = 6;
      break;
    case 12:
      i = 12;
      break;
  }
  return e.l += i, [t, n];
}
function _u(e, a, r) {
  var t = (e[e.l++] & 96) >> 5, n = uu(e, a - 1, r);
  return [t, n];
}
function Tu(e, a, r) {
  var t = (e[e.l++] & 96) >> 5;
  return e.l += r.biff == 2 ? 6 : r.biff == 12 ? 14 : 7, [t];
}
function Sn(e) {
  var a = e[e.l + 1] & 1, r = 1;
  return e.l += 4, [a, r];
}
function ku(e, a, r) {
  e.l += 2;
  for (var t = e.read_shift(r && r.biff == 2 ? 1 : 2), n = [], i = 0; i <= t; ++i) n.push(e.read_shift(r && r.biff == 2 ? 1 : 2));
  return n;
}
function wu(e, a, r) {
  var t = e[e.l + 1] & 255 ? 1 : 0;
  return e.l += 2, [t, e.read_shift(r && r.biff == 2 ? 1 : 2)];
}
function Au(e, a, r) {
  var t = e[e.l + 1] & 255 ? 1 : 0;
  return e.l += 2, [t, e.read_shift(r && r.biff == 2 ? 1 : 2)];
}
function Fu(e) {
  var a = e[e.l + 1] & 255 ? 1 : 0;
  return e.l += 2, [a, e.read_shift(2)];
}
function Su(e, a, r) {
  var t = e[e.l + 1] & 255 ? 1 : 0;
  return e.l += r && r.biff == 2 ? 3 : 4, [t];
}
function cs(e) {
  var a = e.read_shift(1), r = e.read_shift(1);
  return [a, r];
}
function Cu(e) {
  return e.read_shift(2), cs(e);
}
function yu(e) {
  return e.read_shift(2), cs(e);
}
function Du(e, a, r) {
  var t = (e[e.l] & 96) >> 5;
  e.l += 1;
  var n = ss(e, 0, r);
  return [t, n];
}
function Ru(e, a, r) {
  var t = (e[e.l] & 96) >> 5;
  e.l += 1;
  var n = du(e, 0, r);
  return [t, n];
}
function Ou(e, a, r) {
  var t = (e[e.l] & 96) >> 5;
  e.l += 1;
  var n = e.read_shift(2);
  r && r.biff == 5 && (e.l += 12);
  var i = ss(e, 0, r);
  return [t, n, i];
}
function Nu(e, a, r) {
  var t = (e[e.l] & 96) >> 5;
  e.l += 1;
  var n = e.read_shift(r && r.biff <= 3 ? 1 : 2);
  return [Ih[n], ls[n], t];
}
function Iu(e, a, r) {
  var t = e[e.l++], n = e.read_shift(1), i = r && r.biff <= 3 ? [t == 88 ? -1 : 0, e.read_shift(1)] : Lu(e);
  return [n, (i[0] === 0 ? ls : Nh)[i[1]]];
}
function Lu(e) {
  return [e[e.l + 1] >> 7, e.read_shift(2) & 32767];
}
function Pu(e, a, r) {
  e.l += r && r.biff == 2 ? 3 : 4;
}
function Mu(e, a, r) {
  if (e.l++, r && r.biff == 12) return [e.read_shift(4, "i"), 0];
  var t = e.read_shift(2), n = e.read_shift(r && r.biff == 2 ? 1 : 2);
  return [t, n];
}
function bu(e) {
  return e.l++, pa[e.read_shift(1)];
}
function Bu(e) {
  return e.l++, e.read_shift(2);
}
function Uu(e) {
  return e.l++, e.read_shift(1) !== 0;
}
function Hu(e) {
  return e.l++, qe(e);
}
function Wu(e, a, r) {
  return e.l++, tt(e, a - 1, r);
}
function Vu(e, a) {
  var r = [e.read_shift(1)];
  if (a == 12) switch (r[0]) {
    case 2:
      r[0] = 4;
      break;
    case 4:
      r[0] = 16;
      break;
    case 0:
      r[0] = 1;
      break;
    case 1:
      r[0] = 2;
      break;
  }
  switch (r[0]) {
    case 4:
      r[1] = Me(e, 1) ? "TRUE" : "FALSE", a != 12 && (e.l += 7);
      break;
    case 37:
    case 16:
      r[1] = pa[e[e.l]], e.l += a == 12 ? 4 : 8;
      break;
    case 0:
      e.l += 8;
      break;
    case 1:
      r[1] = qe(e);
      break;
    case 2:
      r[1] = va(e, 0, { biff: a > 0 && a < 8 ? 2 : a });
      break;
    default:
      throw new Error("Bad SerAr: " + r[0]);
  }
  return r;
}
function Gu(e, a, r) {
  for (var t = e.read_shift(r.biff == 12 ? 4 : 2), n = [], i = 0; i != t; ++i) n.push((r.biff == 12 ? da : Nt)(e));
  return n;
}
function Xu(e, a, r) {
  var t = 0, n = 0;
  r.biff == 12 ? (t = e.read_shift(4), n = e.read_shift(4)) : (n = 1 + e.read_shift(1), t = 1 + e.read_shift(2)), r.biff >= 2 && r.biff < 8 && (--t, --n == 0 && (n = 256));
  for (var i = 0, s = []; i != t && (s[i] = []); ++i)
    for (var c = 0; c != n; ++c) s[i][c] = Vu(e, r.biff);
  return s;
}
function zu(e, a, r) {
  var t = e.read_shift(1) >>> 5 & 3, n = !r || r.biff >= 8 ? 4 : 2, i = e.read_shift(n);
  switch (r.biff) {
    case 2:
      e.l += 5;
      break;
    case 3:
    case 4:
      e.l += 8;
      break;
    case 5:
      e.l += 12;
      break;
  }
  return [t, 0, i];
}
function $u(e, a, r) {
  if (r.biff == 5) return Yu(e);
  var t = e.read_shift(1) >>> 5 & 3, n = e.read_shift(2), i = e.read_shift(4);
  return [t, n, i];
}
function Yu(e) {
  var a = e.read_shift(1) >>> 5 & 3, r = e.read_shift(2, "i");
  e.l += 8;
  var t = e.read_shift(2);
  return e.l += 12, [a, r, t];
}
function Ku(e, a, r) {
  var t = e.read_shift(1) >>> 5 & 3;
  e.l += r && r.biff == 2 ? 3 : 4;
  var n = e.read_shift(r && r.biff == 2 ? 1 : 2);
  return [t, n];
}
function ju(e, a, r) {
  var t = e.read_shift(1) >>> 5 & 3, n = e.read_shift(r && r.biff == 2 ? 1 : 2);
  return [t, n];
}
function Ju(e, a, r) {
  var t = e.read_shift(1) >>> 5 & 3;
  return e.l += 4, r.biff < 8 && e.l--, r.biff == 12 && (e.l += 2), [t];
}
function Zu(e, a, r) {
  var t = (e[e.l++] & 96) >> 5, n = e.read_shift(2), i = 4;
  if (r) switch (r.biff) {
    case 5:
      i = 15;
      break;
    case 12:
      i = 6;
      break;
  }
  return e.l += i, [t, n];
}
var qu = rr, Qu = rr, eh = rr;
function it(e, a, r) {
  return e.l += 2, [xu(e)];
}
function F0(e) {
  return e.l += 6, [];
}
var rh = it, ah = F0, th = F0, nh = it;
function fs(e) {
  return e.l += 2, [Ue(e), e.read_shift(2) & 1];
}
var ih = it, sh = fs, ch = F0, fh = it, oh = it, lh = [
  "Data",
  "All",
  "Headers",
  "??",
  "?Data2",
  "??",
  "?DataHeaders",
  "??",
  "Totals",
  "??",
  "??",
  "??",
  "?DataTotals",
  "??",
  "??",
  "??",
  "?Current"
];
function uh(e) {
  e.l += 2;
  var a = e.read_shift(2), r = e.read_shift(2), t = e.read_shift(4), n = e.read_shift(2), i = e.read_shift(2), s = lh[r >> 2 & 31];
  return { ixti: a, coltype: r & 3, rt: s, idx: t, c: n, C: i };
}
function hh(e) {
  return e.l += 2, [e.read_shift(4)];
}
function xh(e, a, r) {
  return e.l += 5, e.l += 2, e.l += r.biff == 2 ? 1 : 4, ["PTGSHEET"];
}
function dh(e, a, r) {
  return e.l += r.biff == 2 ? 4 : 5, ["PTGENDSHEET"];
}
function ph(e) {
  var a = e.read_shift(1) >>> 5 & 3, r = e.read_shift(2);
  return [a, r];
}
function vh(e) {
  var a = e.read_shift(1) >>> 5 & 3, r = e.read_shift(2);
  return [a, r];
}
function mh(e) {
  return e.l += 4, [0, 0];
}
var Cn = {
  /*::[*/
  1: { n: "PtgExp", f: Mu },
  /*::[*/
  2: { n: "PtgTbl", f: eh },
  /*::[*/
  3: { n: "PtgAdd", f: be },
  /*::[*/
  4: { n: "PtgSub", f: be },
  /*::[*/
  5: { n: "PtgMul", f: be },
  /*::[*/
  6: { n: "PtgDiv", f: be },
  /*::[*/
  7: { n: "PtgPower", f: be },
  /*::[*/
  8: { n: "PtgConcat", f: be },
  /*::[*/
  9: { n: "PtgLt", f: be },
  /*::[*/
  10: { n: "PtgLe", f: be },
  /*::[*/
  11: { n: "PtgEq", f: be },
  /*::[*/
  12: { n: "PtgGe", f: be },
  /*::[*/
  13: { n: "PtgGt", f: be },
  /*::[*/
  14: { n: "PtgNe", f: be },
  /*::[*/
  15: { n: "PtgIsect", f: be },
  /*::[*/
  16: { n: "PtgUnion", f: be },
  /*::[*/
  17: { n: "PtgRange", f: be },
  /*::[*/
  18: { n: "PtgUplus", f: be },
  /*::[*/
  19: { n: "PtgUminus", f: be },
  /*::[*/
  20: { n: "PtgPercent", f: be },
  /*::[*/
  21: { n: "PtgParen", f: be },
  /*::[*/
  22: { n: "PtgMissArg", f: be },
  /*::[*/
  23: { n: "PtgStr", f: Wu },
  /*::[*/
  26: { n: "PtgSheet", f: xh },
  /*::[*/
  27: { n: "PtgEndSheet", f: dh },
  /*::[*/
  28: { n: "PtgErr", f: bu },
  /*::[*/
  29: { n: "PtgBool", f: Uu },
  /*::[*/
  30: { n: "PtgInt", f: Bu },
  /*::[*/
  31: { n: "PtgNum", f: Hu },
  /*::[*/
  32: { n: "PtgArray", f: Tu },
  /*::[*/
  33: { n: "PtgFunc", f: Nu },
  /*::[*/
  34: { n: "PtgFuncVar", f: Iu },
  /*::[*/
  35: { n: "PtgName", f: zu },
  /*::[*/
  36: { n: "PtgRef", f: Du },
  /*::[*/
  37: { n: "PtgArea", f: vu },
  /*::[*/
  38: { n: "PtgMemArea", f: Ku },
  /*::[*/
  39: { n: "PtgMemErr", f: qu },
  /*::[*/
  40: { n: "PtgMemNoMem", f: Qu },
  /*::[*/
  41: { n: "PtgMemFunc", f: ju },
  /*::[*/
  42: { n: "PtgRefErr", f: Ju },
  /*::[*/
  43: { n: "PtgAreaErr", f: gu },
  /*::[*/
  44: { n: "PtgRefN", f: Ru },
  /*::[*/
  45: { n: "PtgAreaN", f: _u },
  /*::[*/
  46: { n: "PtgMemAreaN", f: ph },
  /*::[*/
  47: { n: "PtgMemNoMemN", f: vh },
  /*::[*/
  57: { n: "PtgNameX", f: $u },
  /*::[*/
  58: { n: "PtgRef3d", f: Ou },
  /*::[*/
  59: { n: "PtgArea3d", f: mu },
  /*::[*/
  60: { n: "PtgRefErr3d", f: Zu },
  /*::[*/
  61: { n: "PtgAreaErr3d", f: Eu },
  /*::[*/
  255: {}
}, gh = {
  /*::[*/
  64: 32,
  /*::[*/
  96: 32,
  /*::[*/
  65: 33,
  /*::[*/
  97: 33,
  /*::[*/
  66: 34,
  /*::[*/
  98: 34,
  /*::[*/
  67: 35,
  /*::[*/
  99: 35,
  /*::[*/
  68: 36,
  /*::[*/
  100: 36,
  /*::[*/
  69: 37,
  /*::[*/
  101: 37,
  /*::[*/
  70: 38,
  /*::[*/
  102: 38,
  /*::[*/
  71: 39,
  /*::[*/
  103: 39,
  /*::[*/
  72: 40,
  /*::[*/
  104: 40,
  /*::[*/
  73: 41,
  /*::[*/
  105: 41,
  /*::[*/
  74: 42,
  /*::[*/
  106: 42,
  /*::[*/
  75: 43,
  /*::[*/
  107: 43,
  /*::[*/
  76: 44,
  /*::[*/
  108: 44,
  /*::[*/
  77: 45,
  /*::[*/
  109: 45,
  /*::[*/
  78: 46,
  /*::[*/
  110: 46,
  /*::[*/
  79: 47,
  /*::[*/
  111: 47,
  /*::[*/
  88: 34,
  /*::[*/
  120: 34,
  /*::[*/
  89: 57,
  /*::[*/
  121: 57,
  /*::[*/
  90: 58,
  /*::[*/
  122: 58,
  /*::[*/
  91: 59,
  /*::[*/
  123: 59,
  /*::[*/
  92: 60,
  /*::[*/
  124: 60,
  /*::[*/
  93: 61,
  /*::[*/
  125: 61
}, Eh = {
  /*::[*/
  1: { n: "PtgElfLel", f: fs },
  /*::[*/
  2: { n: "PtgElfRw", f: fh },
  /*::[*/
  3: { n: "PtgElfCol", f: rh },
  /*::[*/
  6: { n: "PtgElfRwV", f: oh },
  /*::[*/
  7: { n: "PtgElfColV", f: nh },
  /*::[*/
  10: { n: "PtgElfRadical", f: ih },
  /*::[*/
  11: { n: "PtgElfRadicalS", f: ch },
  /*::[*/
  13: { n: "PtgElfColS", f: ah },
  /*::[*/
  15: { n: "PtgElfColSV", f: th },
  /*::[*/
  16: { n: "PtgElfRadicalLel", f: sh },
  /*::[*/
  25: { n: "PtgList", f: uh },
  /*::[*/
  29: { n: "PtgSxName", f: hh },
  /*::[*/
  255: {}
}, _h = {
  /*::[*/
  0: { n: "PtgAttrNoop", f: mh },
  /*::[*/
  1: { n: "PtgAttrSemi", f: Su },
  /*::[*/
  2: { n: "PtgAttrIf", f: Au },
  /*::[*/
  4: { n: "PtgAttrChoose", f: ku },
  /*::[*/
  8: { n: "PtgAttrGoto", f: wu },
  /*::[*/
  16: { n: "PtgAttrSum", f: Pu },
  /*::[*/
  32: { n: "PtgAttrBaxcel", f: Sn },
  /*::[*/
  33: { n: "PtgAttrBaxcel", f: Sn },
  /*::[*/
  64: { n: "PtgAttrSpace", f: Cu },
  /*::[*/
  65: { n: "PtgAttrSpaceSemi", f: yu },
  /*::[*/
  128: { n: "PtgAttrIfError", f: Fu },
  /*::[*/
  255: {}
};
function st(e, a, r, t) {
  if (t.biff < 8) return rr(e, a);
  for (var n = e.l + a, i = [], s = 0; s !== r.length; ++s)
    switch (r[s][0]) {
      case "PtgArray":
        r[s][1] = Xu(e, 0, t), i.push(r[s][1]);
        break;
      case "PtgMemArea":
        r[s][2] = Gu(e, r[s][1], t), i.push(r[s][2]);
        break;
      case "PtgExp":
        t && t.biff == 12 && (r[s][1][1] = e.read_shift(4), i.push(r[s][1]));
        break;
      case "PtgList":
      case "PtgElfRadicalS":
      case "PtgElfColS":
      case "PtgElfColSV":
        throw "Unsupported " + r[s][0];
    }
  return a = n - e.l, a !== 0 && i.push(rr(e, a)), i;
}
function ct(e, a, r) {
  for (var t = e.l + a, n, i, s = []; t != e.l; )
    a = t - e.l, i = e[e.l], n = Cn[i] || Cn[gh[i]], (i === 24 || i === 25) && (n = (i === 24 ? Eh : _h)[e[e.l + 1]]), !n || !n.f ? rr(e, a) : s.push([n.n, n.f(e, a, r)]);
  return s;
}
function Th(e) {
  for (var a = [], r = 0; r < e.length; ++r) {
    for (var t = e[r], n = [], i = 0; i < t.length; ++i) {
      var s = t[i];
      if (s) switch (s[0]) {
        case 2:
          n.push('"' + s[1].replace(/"/g, '""') + '"');
          break;
        default:
          n.push(s[1]);
      }
      else n.push("");
    }
    a.push(n.join(","));
  }
  return a.join(";");
}
var kh = {
  PtgAdd: "+",
  PtgConcat: "&",
  PtgDiv: "/",
  PtgEq: "=",
  PtgGe: ">=",
  PtgGt: ">",
  PtgLe: "<=",
  PtgLt: "<",
  PtgMul: "*",
  PtgNe: "<>",
  PtgPower: "^",
  PtgSub: "-"
};
function wh(e, a) {
  if (!e && !(a && a.biff <= 5 && a.biff >= 2)) throw new Error("empty sheet name");
  return /[^\w\u4E00-\u9FFF\u3040-\u30FF]/.test(e) ? "'" + e + "'" : e;
}
function os(e, a, r) {
  if (!e) return "SH33TJSERR0";
  if (r.biff > 8 && (!e.XTI || !e.XTI[a])) return e.SheetNames[a];
  if (!e.XTI) return "SH33TJSERR6";
  var t = e.XTI[a];
  if (r.biff < 8)
    return a > 1e4 && (a -= 65536), a < 0 && (a = -a), a == 0 ? "" : e.XTI[a - 1];
  if (!t) return "SH33TJSERR1";
  var n = "";
  if (r.biff > 8) switch (e[t[0]][0]) {
    case 357:
      return n = t[1] == -1 ? "#REF" : e.SheetNames[t[1]], t[1] == t[2] ? n : n + ":" + e.SheetNames[t[2]];
    case 358:
      return r.SID != null ? e.SheetNames[r.SID] : "SH33TJSSAME" + e[t[0]][0];
    case 355:
    default:
      return "SH33TJSSRC" + e[t[0]][0];
  }
  switch (e[t[0]][0][0]) {
    case 1025:
      return n = t[1] == -1 ? "#REF" : e.SheetNames[t[1]] || "SH33TJSERR3", t[1] == t[2] ? n : n + ":" + e.SheetNames[t[2]];
    case 14849:
      return e[t[0]].slice(1).map(function(i) {
        return i.Name;
      }).join(";;");
    default:
      return e[t[0]][0][3] ? (n = t[1] == -1 ? "#REF" : e[t[0]][0][3][t[1]] || "SH33TJSERR4", t[1] == t[2] ? n : n + ":" + e[t[0]][0][3][t[2]]) : "SH33TJSERR2";
  }
}
function yn(e, a, r) {
  var t = os(e, a, r);
  return t == "#REF" ? t : wh(t, r);
}
function Ze(e, a, r, t, n) {
  var i = n && n.biff || 8, s = (
    /*range != null ? range :*/
    { s: { c: 0, r: 0 } }
  ), c = [], f, o, l, u = 0, x = 0, d, p = "";
  if (!e[0] || !e[0][0]) return "";
  for (var h = -1, m = "", A = 0, y = e[0].length; A < y; ++A) {
    var E = e[0][A];
    switch (E[0]) {
      case "PtgUminus":
        c.push("-" + c.pop());
        break;
      case "PtgUplus":
        c.push("+" + c.pop());
        break;
      case "PtgPercent":
        c.push(c.pop() + "%");
        break;
      case "PtgAdd":
      case "PtgConcat":
      case "PtgDiv":
      case "PtgEq":
      case "PtgGe":
      case "PtgGt":
      case "PtgLe":
      case "PtgLt":
      case "PtgMul":
      case "PtgNe":
      case "PtgPower":
      case "PtgSub":
        if (f = c.pop(), o = c.pop(), h >= 0) {
          switch (e[0][h][1][0]) {
            case 0:
              m = Re(" ", e[0][h][1][1]);
              break;
            case 1:
              m = Re("\r", e[0][h][1][1]);
              break;
            default:
              if (m = "", n.WTF) throw new Error("Unexpected PtgAttrSpaceType " + e[0][h][1][0]);
          }
          o = o + m, h = -1;
        }
        c.push(o + kh[E[0]] + f);
        break;
      case "PtgIsect":
        f = c.pop(), o = c.pop(), c.push(o + " " + f);
        break;
      case "PtgUnion":
        f = c.pop(), o = c.pop(), c.push(o + "," + f);
        break;
      case "PtgRange":
        f = c.pop(), o = c.pop(), c.push(o + ":" + f);
        break;
      case "PtgAttrChoose":
        break;
      case "PtgAttrGoto":
        break;
      case "PtgAttrIf":
        break;
      case "PtgAttrIfError":
        break;
      case "PtgRef":
        l = Ua(E[1][1], s, n), c.push(Ha(l, i));
        break;
      case "PtgRefN":
        l = r ? Ua(E[1][1], r, n) : E[1][1], c.push(Ha(l, i));
        break;
      case "PtgRef3d":
        u = /*::Number(*/
        E[1][1], l = Ua(E[1][2], s, n), p = yn(t, u, n), c.push(p + "!" + Ha(l, i));
        break;
      case "PtgFunc":
      case "PtgFuncVar":
        var I = E[1][0], b = E[1][1];
        I || (I = 0), I &= 127;
        var O = I == 0 ? [] : c.slice(-I);
        c.length -= I, b === "User" && (b = O.shift()), c.push(b + "(" + O.join(",") + ")");
        break;
      case "PtgBool":
        c.push(E[1] ? "TRUE" : "FALSE");
        break;
      case "PtgInt":
        c.push(
          /*::String(*/
          E[1]
          /*::)*/
        );
        break;
      case "PtgNum":
        c.push(String(E[1]));
        break;
      case "PtgStr":
        c.push('"' + E[1].replace(/"/g, '""') + '"');
        break;
      case "PtgErr":
        c.push(
          /*::String(*/
          E[1]
          /*::)*/
        );
        break;
      case "PtgAreaN":
        d = fn(E[1][1], r ? { s: r } : s, n), c.push(Ut(d, n));
        break;
      case "PtgArea":
        d = fn(E[1][1], s, n), c.push(Ut(d, n));
        break;
      case "PtgArea3d":
        u = /*::Number(*/
        E[1][1], d = E[1][2], p = yn(t, u, n), c.push(p + "!" + Ut(d, n));
        break;
      case "PtgAttrSum":
        c.push("SUM(" + c.pop() + ")");
        break;
      case "PtgAttrBaxcel":
      case "PtgAttrSemi":
        break;
      case "PtgName":
        x = E[1][2];
        var F = (t.names || [])[x - 1] || (t[0] || [])[x], W = F ? F.Name : "SH33TJSNAME" + String(x);
        W && W.slice(0, 6) == "_xlfn." && !n.xlfn && (W = W.slice(6)), c.push(W);
        break;
      case "PtgNameX":
        var D = E[1][1];
        x = E[1][2];
        var z;
        if (n.biff <= 5)
          D < 0 && (D = -D), t[D] && (z = t[D][x]);
        else {
          var G = "";
          if (((t[D] || [])[0] || [])[0] == 14849 || (((t[D] || [])[0] || [])[0] == 1025 ? t[D][x] && t[D][x].itab > 0 && (G = t.SheetNames[t[D][x].itab - 1] + "!") : G = t.SheetNames[x - 1] + "!"), t[D] && t[D][x]) G += t[D][x].Name;
          else if (t[0] && t[0][x]) G += t[0][x].Name;
          else {
            var L = (os(t, D, n) || "").split(";;");
            L[x - 1] ? G = L[x - 1] : G += "SH33TJSERRX";
          }
          c.push(G);
          break;
        }
        z || (z = { Name: "SH33TJSERRY" }), c.push(z.Name);
        break;
      case "PtgParen":
        var J = "(", fe = ")";
        if (h >= 0) {
          switch (m = "", e[0][h][1][0]) {
            case 2:
              J = Re(" ", e[0][h][1][1]) + J;
              break;
            case 3:
              J = Re("\r", e[0][h][1][1]) + J;
              break;
            case 4:
              fe = Re(" ", e[0][h][1][1]) + fe;
              break;
            case 5:
              fe = Re("\r", e[0][h][1][1]) + fe;
              break;
            default:
              if (n.WTF) throw new Error("Unexpected PtgAttrSpaceType " + e[0][h][1][0]);
          }
          h = -1;
        }
        c.push(J + c.pop() + fe);
        break;
      case "PtgRefErr":
        c.push("#REF!");
        break;
      case "PtgRefErr3d":
        c.push("#REF!");
        break;
      case "PtgExp":
        l = { c: E[1][1], r: E[1][0] };
        var re = { c: r.c, r: r.r };
        if (t.sharedf[he(l)]) {
          var ce = t.sharedf[he(l)];
          c.push(Ze(ce, s, re, t, n));
        } else {
          var se = !1;
          for (f = 0; f != t.arrayf.length; ++f)
            if (o = t.arrayf[f], !(l.c < o[0].s.c || l.c > o[0].e.c) && !(l.r < o[0].s.r || l.r > o[0].e.r)) {
              c.push(Ze(o[1], s, re, t, n)), se = !0;
              break;
            }
          se || c.push(
            /*::String(*/
            E[1]
            /*::)*/
          );
        }
        break;
      case "PtgArray":
        c.push("{" + Th(
          /*::(*/
          E[1]
          /*:: :any)*/
        ) + "}");
        break;
      case "PtgMemArea":
        break;
      case "PtgAttrSpace":
      case "PtgAttrSpaceSemi":
        h = A;
        break;
      case "PtgTbl":
        break;
      case "PtgMemErr":
        break;
      case "PtgMissArg":
        c.push("");
        break;
      case "PtgAreaErr":
        c.push("#REF!");
        break;
      case "PtgAreaErr3d":
        c.push("#REF!");
        break;
      case "PtgList":
        c.push("Table" + E[1].idx + "[#" + E[1].rt + "]");
        break;
      case "PtgMemAreaN":
      case "PtgMemNoMemN":
      case "PtgAttrNoop":
      case "PtgSheet":
      case "PtgEndSheet":
        break;
      case "PtgMemFunc":
        break;
      case "PtgMemNoMem":
        break;
      case "PtgElfCol":
      case "PtgElfColS":
      case "PtgElfColSV":
      case "PtgElfColV":
      case "PtgElfLel":
      case "PtgElfRadical":
      case "PtgElfRadicalLel":
      case "PtgElfRadicalS":
      case "PtgElfRw":
      case "PtgElfRwV":
        throw new Error("Unsupported ELFs");
      case "PtgSxName":
        throw new Error("Unrecognized Formula Token: " + String(E));
      default:
        throw new Error("Unrecognized Formula Token: " + String(E));
    }
    var Se = ["PtgAttrSpace", "PtgAttrSpaceSemi", "PtgAttrGoto"];
    if (n.biff != 3 && h >= 0 && Se.indexOf(e[0][A][0]) == -1) {
      E = e[0][h];
      var V = !0;
      switch (E[1][0]) {
        case 4:
          V = !1;
        case 0:
          m = Re(" ", E[1][1]);
          break;
        case 5:
          V = !1;
        case 1:
          m = Re("\r", E[1][1]);
          break;
        default:
          if (m = "", n.WTF) throw new Error("Unexpected PtgAttrSpaceType " + E[1][0]);
      }
      c.push((V ? m : "") + c.pop() + (V ? "" : m)), h = -1;
    }
  }
  if (c.length > 1 && n.WTF) throw new Error("bad formula stack");
  return c[0];
}
function Ah(e, a, r) {
  var t = e.l + a, n = r.biff == 2 ? 1 : 2, i, s = e.read_shift(n);
  if (s == 65535) return [[], rr(e, a - 2)];
  var c = ct(e, s, r);
  return a !== s + n && (i = st(e, a - s - n, c, r)), e.l = t, [c, i];
}
function Fh(e, a, r) {
  var t = e.l + a, n = r.biff == 2 ? 1 : 2, i, s = e.read_shift(n);
  if (s == 65535) return [[], rr(e, a - 2)];
  var c = ct(e, s, r);
  return a !== s + n && (i = st(e, a - s - n, c, r)), e.l = t, [c, i];
}
function Sh(e, a, r, t) {
  var n = e.l + a, i = ct(e, t, r), s;
  return n !== e.l && (s = st(e, n - e.l, i, r)), [i, s];
}
function Ch(e, a, r) {
  var t = e.l + a, n, i = e.read_shift(2), s = ct(e, i, r);
  return i == 65535 ? [[], rr(e, a - 2)] : (a !== i + 2 && (n = st(e, t - i - 2, s, r)), [s, n]);
}
function yh(e) {
  var a;
  if (Br(e, e.l + 6) !== 65535) return [qe(e), "n"];
  switch (e[e.l]) {
    case 0:
      return e.l += 8, ["String", "s"];
    case 1:
      return a = e[e.l + 2] === 1, e.l += 8, [a, "b"];
    case 2:
      return a = e[e.l + 2], e.l += 8, [a, "e"];
    case 3:
      return e.l += 8, ["", "s"];
  }
  return [];
}
function Vt(e, a, r) {
  var t = e.l + a, n = Ir(e);
  r.biff == 2 && ++e.l;
  var i = yh(e), s = e.read_shift(1);
  r.biff != 2 && (e.read_shift(1), r.biff >= 5 && e.read_shift(4));
  var c = Fh(e, t - e.l, r);
  return { cell: n, val: i[0], formula: c, shared: s >> 3 & 1, tt: i[1] };
}
function It(e, a, r) {
  var t = e.read_shift(4), n = ct(e, t, r), i = e.read_shift(4), s = i > 0 ? st(e, i, n, r) : null;
  return [n, s];
}
var Dh = It, Lt = It, Rh = It, Oh = It, Nh = {
  0: "BEEP",
  1: "OPEN",
  2: "OPEN.LINKS",
  3: "CLOSE.ALL",
  4: "SAVE",
  5: "SAVE.AS",
  6: "FILE.DELETE",
  7: "PAGE.SETUP",
  8: "PRINT",
  9: "PRINTER.SETUP",
  10: "QUIT",
  11: "NEW.WINDOW",
  12: "ARRANGE.ALL",
  13: "WINDOW.SIZE",
  14: "WINDOW.MOVE",
  15: "FULL",
  16: "CLOSE",
  17: "RUN",
  22: "SET.PRINT.AREA",
  23: "SET.PRINT.TITLES",
  24: "SET.PAGE.BREAK",
  25: "REMOVE.PAGE.BREAK",
  26: "FONT",
  27: "DISPLAY",
  28: "PROTECT.DOCUMENT",
  29: "PRECISION",
  30: "A1.R1C1",
  31: "CALCULATE.NOW",
  32: "CALCULATION",
  34: "DATA.FIND",
  35: "EXTRACT",
  36: "DATA.DELETE",
  37: "SET.DATABASE",
  38: "SET.CRITERIA",
  39: "SORT",
  40: "DATA.SERIES",
  41: "TABLE",
  42: "FORMAT.NUMBER",
  43: "ALIGNMENT",
  44: "STYLE",
  45: "BORDER",
  46: "CELL.PROTECTION",
  47: "COLUMN.WIDTH",
  48: "UNDO",
  49: "CUT",
  50: "COPY",
  51: "PASTE",
  52: "CLEAR",
  53: "PASTE.SPECIAL",
  54: "EDIT.DELETE",
  55: "INSERT",
  56: "FILL.RIGHT",
  57: "FILL.DOWN",
  61: "DEFINE.NAME",
  62: "CREATE.NAMES",
  63: "FORMULA.GOTO",
  64: "FORMULA.FIND",
  65: "SELECT.LAST.CELL",
  66: "SHOW.ACTIVE.CELL",
  67: "GALLERY.AREA",
  68: "GALLERY.BAR",
  69: "GALLERY.COLUMN",
  70: "GALLERY.LINE",
  71: "GALLERY.PIE",
  72: "GALLERY.SCATTER",
  73: "COMBINATION",
  74: "PREFERRED",
  75: "ADD.OVERLAY",
  76: "GRIDLINES",
  77: "SET.PREFERRED",
  78: "AXES",
  79: "LEGEND",
  80: "ATTACH.TEXT",
  81: "ADD.ARROW",
  82: "SELECT.CHART",
  83: "SELECT.PLOT.AREA",
  84: "PATTERNS",
  85: "MAIN.CHART",
  86: "OVERLAY",
  87: "SCALE",
  88: "FORMAT.LEGEND",
  89: "FORMAT.TEXT",
  90: "EDIT.REPEAT",
  91: "PARSE",
  92: "JUSTIFY",
  93: "HIDE",
  94: "UNHIDE",
  95: "WORKSPACE",
  96: "FORMULA",
  97: "FORMULA.FILL",
  98: "FORMULA.ARRAY",
  99: "DATA.FIND.NEXT",
  100: "DATA.FIND.PREV",
  101: "FORMULA.FIND.NEXT",
  102: "FORMULA.FIND.PREV",
  103: "ACTIVATE",
  104: "ACTIVATE.NEXT",
  105: "ACTIVATE.PREV",
  106: "UNLOCKED.NEXT",
  107: "UNLOCKED.PREV",
  108: "COPY.PICTURE",
  109: "SELECT",
  110: "DELETE.NAME",
  111: "DELETE.FORMAT",
  112: "VLINE",
  113: "HLINE",
  114: "VPAGE",
  115: "HPAGE",
  116: "VSCROLL",
  117: "HSCROLL",
  118: "ALERT",
  119: "NEW",
  120: "CANCEL.COPY",
  121: "SHOW.CLIPBOARD",
  122: "MESSAGE",
  124: "PASTE.LINK",
  125: "APP.ACTIVATE",
  126: "DELETE.ARROW",
  127: "ROW.HEIGHT",
  128: "FORMAT.MOVE",
  129: "FORMAT.SIZE",
  130: "FORMULA.REPLACE",
  131: "SEND.KEYS",
  132: "SELECT.SPECIAL",
  133: "APPLY.NAMES",
  134: "REPLACE.FONT",
  135: "FREEZE.PANES",
  136: "SHOW.INFO",
  137: "SPLIT",
  138: "ON.WINDOW",
  139: "ON.DATA",
  140: "DISABLE.INPUT",
  142: "OUTLINE",
  143: "LIST.NAMES",
  144: "FILE.CLOSE",
  145: "SAVE.WORKBOOK",
  146: "DATA.FORM",
  147: "COPY.CHART",
  148: "ON.TIME",
  149: "WAIT",
  150: "FORMAT.FONT",
  151: "FILL.UP",
  152: "FILL.LEFT",
  153: "DELETE.OVERLAY",
  155: "SHORT.MENUS",
  159: "SET.UPDATE.STATUS",
  161: "COLOR.PALETTE",
  162: "DELETE.STYLE",
  163: "WINDOW.RESTORE",
  164: "WINDOW.MAXIMIZE",
  166: "CHANGE.LINK",
  167: "CALCULATE.DOCUMENT",
  168: "ON.KEY",
  169: "APP.RESTORE",
  170: "APP.MOVE",
  171: "APP.SIZE",
  172: "APP.MINIMIZE",
  173: "APP.MAXIMIZE",
  174: "BRING.TO.FRONT",
  175: "SEND.TO.BACK",
  185: "MAIN.CHART.TYPE",
  186: "OVERLAY.CHART.TYPE",
  187: "SELECT.END",
  188: "OPEN.MAIL",
  189: "SEND.MAIL",
  190: "STANDARD.FONT",
  191: "CONSOLIDATE",
  192: "SORT.SPECIAL",
  193: "GALLERY.3D.AREA",
  194: "GALLERY.3D.COLUMN",
  195: "GALLERY.3D.LINE",
  196: "GALLERY.3D.PIE",
  197: "VIEW.3D",
  198: "GOAL.SEEK",
  199: "WORKGROUP",
  200: "FILL.GROUP",
  201: "UPDATE.LINK",
  202: "PROMOTE",
  203: "DEMOTE",
  204: "SHOW.DETAIL",
  206: "UNGROUP",
  207: "OBJECT.PROPERTIES",
  208: "SAVE.NEW.OBJECT",
  209: "SHARE",
  210: "SHARE.NAME",
  211: "DUPLICATE",
  212: "APPLY.STYLE",
  213: "ASSIGN.TO.OBJECT",
  214: "OBJECT.PROTECTION",
  215: "HIDE.OBJECT",
  216: "SET.EXTRACT",
  217: "CREATE.PUBLISHER",
  218: "SUBSCRIBE.TO",
  219: "ATTRIBUTES",
  220: "SHOW.TOOLBAR",
  222: "PRINT.PREVIEW",
  223: "EDIT.COLOR",
  224: "SHOW.LEVELS",
  225: "FORMAT.MAIN",
  226: "FORMAT.OVERLAY",
  227: "ON.RECALC",
  228: "EDIT.SERIES",
  229: "DEFINE.STYLE",
  240: "LINE.PRINT",
  243: "ENTER.DATA",
  249: "GALLERY.RADAR",
  250: "MERGE.STYLES",
  251: "EDITION.OPTIONS",
  252: "PASTE.PICTURE",
  253: "PASTE.PICTURE.LINK",
  254: "SPELLING",
  256: "ZOOM",
  259: "INSERT.OBJECT",
  260: "WINDOW.MINIMIZE",
  265: "SOUND.NOTE",
  266: "SOUND.PLAY",
  267: "FORMAT.SHAPE",
  268: "EXTEND.POLYGON",
  269: "FORMAT.AUTO",
  272: "GALLERY.3D.BAR",
  273: "GALLERY.3D.SURFACE",
  274: "FILL.AUTO",
  276: "CUSTOMIZE.TOOLBAR",
  277: "ADD.TOOL",
  278: "EDIT.OBJECT",
  279: "ON.DOUBLECLICK",
  280: "ON.ENTRY",
  281: "WORKBOOK.ADD",
  282: "WORKBOOK.MOVE",
  283: "WORKBOOK.COPY",
  284: "WORKBOOK.OPTIONS",
  285: "SAVE.WORKSPACE",
  288: "CHART.WIZARD",
  289: "DELETE.TOOL",
  290: "MOVE.TOOL",
  291: "WORKBOOK.SELECT",
  292: "WORKBOOK.ACTIVATE",
  293: "ASSIGN.TO.TOOL",
  295: "COPY.TOOL",
  296: "RESET.TOOL",
  297: "CONSTRAIN.NUMERIC",
  298: "PASTE.TOOL",
  302: "WORKBOOK.NEW",
  305: "SCENARIO.CELLS",
  306: "SCENARIO.DELETE",
  307: "SCENARIO.ADD",
  308: "SCENARIO.EDIT",
  309: "SCENARIO.SHOW",
  310: "SCENARIO.SHOW.NEXT",
  311: "SCENARIO.SUMMARY",
  312: "PIVOT.TABLE.WIZARD",
  313: "PIVOT.FIELD.PROPERTIES",
  314: "PIVOT.FIELD",
  315: "PIVOT.ITEM",
  316: "PIVOT.ADD.FIELDS",
  318: "OPTIONS.CALCULATION",
  319: "OPTIONS.EDIT",
  320: "OPTIONS.VIEW",
  321: "ADDIN.MANAGER",
  322: "MENU.EDITOR",
  323: "ATTACH.TOOLBARS",
  324: "VBAActivate",
  325: "OPTIONS.CHART",
  328: "VBA.INSERT.FILE",
  330: "VBA.PROCEDURE.DEFINITION",
  336: "ROUTING.SLIP",
  338: "ROUTE.DOCUMENT",
  339: "MAIL.LOGON",
  342: "INSERT.PICTURE",
  343: "EDIT.TOOL",
  344: "GALLERY.DOUGHNUT",
  350: "CHART.TREND",
  352: "PIVOT.ITEM.PROPERTIES",
  354: "WORKBOOK.INSERT",
  355: "OPTIONS.TRANSITION",
  356: "OPTIONS.GENERAL",
  370: "FILTER.ADVANCED",
  373: "MAIL.ADD.MAILER",
  374: "MAIL.DELETE.MAILER",
  375: "MAIL.REPLY",
  376: "MAIL.REPLY.ALL",
  377: "MAIL.FORWARD",
  378: "MAIL.NEXT.LETTER",
  379: "DATA.LABEL",
  380: "INSERT.TITLE",
  381: "FONT.PROPERTIES",
  382: "MACRO.OPTIONS",
  383: "WORKBOOK.HIDE",
  384: "WORKBOOK.UNHIDE",
  385: "WORKBOOK.DELETE",
  386: "WORKBOOK.NAME",
  388: "GALLERY.CUSTOM",
  390: "ADD.CHART.AUTOFORMAT",
  391: "DELETE.CHART.AUTOFORMAT",
  392: "CHART.ADD.DATA",
  393: "AUTO.OUTLINE",
  394: "TAB.ORDER",
  395: "SHOW.DIALOG",
  396: "SELECT.ALL",
  397: "UNGROUP.SHEETS",
  398: "SUBTOTAL.CREATE",
  399: "SUBTOTAL.REMOVE",
  400: "RENAME.OBJECT",
  412: "WORKBOOK.SCROLL",
  413: "WORKBOOK.NEXT",
  414: "WORKBOOK.PREV",
  415: "WORKBOOK.TAB.SPLIT",
  416: "FULL.SCREEN",
  417: "WORKBOOK.PROTECT",
  420: "SCROLLBAR.PROPERTIES",
  421: "PIVOT.SHOW.PAGES",
  422: "TEXT.TO.COLUMNS",
  423: "FORMAT.CHARTTYPE",
  424: "LINK.FORMAT",
  425: "TRACER.DISPLAY",
  430: "TRACER.NAVIGATE",
  431: "TRACER.CLEAR",
  432: "TRACER.ERROR",
  433: "PIVOT.FIELD.GROUP",
  434: "PIVOT.FIELD.UNGROUP",
  435: "CHECKBOX.PROPERTIES",
  436: "LABEL.PROPERTIES",
  437: "LISTBOX.PROPERTIES",
  438: "EDITBOX.PROPERTIES",
  439: "PIVOT.REFRESH",
  440: "LINK.COMBO",
  441: "OPEN.TEXT",
  442: "HIDE.DIALOG",
  443: "SET.DIALOG.FOCUS",
  444: "ENABLE.OBJECT",
  445: "PUSHBUTTON.PROPERTIES",
  446: "SET.DIALOG.DEFAULT",
  447: "FILTER",
  448: "FILTER.SHOW.ALL",
  449: "CLEAR.OUTLINE",
  450: "FUNCTION.WIZARD",
  451: "ADD.LIST.ITEM",
  452: "SET.LIST.ITEM",
  453: "REMOVE.LIST.ITEM",
  454: "SELECT.LIST.ITEM",
  455: "SET.CONTROL.VALUE",
  456: "SAVE.COPY.AS",
  458: "OPTIONS.LISTS.ADD",
  459: "OPTIONS.LISTS.DELETE",
  460: "SERIES.AXES",
  461: "SERIES.X",
  462: "SERIES.Y",
  463: "ERRORBAR.X",
  464: "ERRORBAR.Y",
  465: "FORMAT.CHART",
  466: "SERIES.ORDER",
  467: "MAIL.LOGOFF",
  468: "CLEAR.ROUTING.SLIP",
  469: "APP.ACTIVATE.MICROSOFT",
  470: "MAIL.EDIT.MAILER",
  471: "ON.SHEET",
  472: "STANDARD.WIDTH",
  473: "SCENARIO.MERGE",
  474: "SUMMARY.INFO",
  475: "FIND.FILE",
  476: "ACTIVE.CELL.FONT",
  477: "ENABLE.TIPWIZARD",
  478: "VBA.MAKE.ADDIN",
  480: "INSERTDATATABLE",
  481: "WORKGROUP.OPTIONS",
  482: "MAIL.SEND.MAILER",
  485: "AUTOCORRECT",
  489: "POST.DOCUMENT",
  491: "PICKLIST",
  493: "VIEW.SHOW",
  494: "VIEW.DEFINE",
  495: "VIEW.DELETE",
  509: "SHEET.BACKGROUND",
  510: "INSERT.MAP.OBJECT",
  511: "OPTIONS.MENONO",
  517: "MSOCHECKS",
  518: "NORMAL",
  519: "LAYOUT",
  520: "RM.PRINT.AREA",
  521: "CLEAR.PRINT.AREA",
  522: "ADD.PRINT.AREA",
  523: "MOVE.BRK",
  545: "HIDECURR.NOTE",
  546: "HIDEALL.NOTES",
  547: "DELETE.NOTE",
  548: "TRAVERSE.NOTES",
  549: "ACTIVATE.NOTES",
  620: "PROTECT.REVISIONS",
  621: "UNPROTECT.REVISIONS",
  647: "OPTIONS.ME",
  653: "WEB.PUBLISH",
  667: "NEWWEBQUERY",
  673: "PIVOT.TABLE.CHART",
  753: "OPTIONS.SAVE",
  755: "OPTIONS.SPELL",
  808: "HIDEALL.INKANNOTS"
}, ls = {
  0: "COUNT",
  1: "IF",
  2: "ISNA",
  3: "ISERROR",
  4: "SUM",
  5: "AVERAGE",
  6: "MIN",
  7: "MAX",
  8: "ROW",
  9: "COLUMN",
  10: "NA",
  11: "NPV",
  12: "STDEV",
  13: "DOLLAR",
  14: "FIXED",
  15: "SIN",
  16: "COS",
  17: "TAN",
  18: "ATAN",
  19: "PI",
  20: "SQRT",
  21: "EXP",
  22: "LN",
  23: "LOG10",
  24: "ABS",
  25: "INT",
  26: "SIGN",
  27: "ROUND",
  28: "LOOKUP",
  29: "INDEX",
  30: "REPT",
  31: "MID",
  32: "LEN",
  33: "VALUE",
  34: "TRUE",
  35: "FALSE",
  36: "AND",
  37: "OR",
  38: "NOT",
  39: "MOD",
  40: "DCOUNT",
  41: "DSUM",
  42: "DAVERAGE",
  43: "DMIN",
  44: "DMAX",
  45: "DSTDEV",
  46: "VAR",
  47: "DVAR",
  48: "TEXT",
  49: "LINEST",
  50: "TREND",
  51: "LOGEST",
  52: "GROWTH",
  53: "GOTO",
  54: "HALT",
  55: "RETURN",
  56: "PV",
  57: "FV",
  58: "NPER",
  59: "PMT",
  60: "RATE",
  61: "MIRR",
  62: "IRR",
  63: "RAND",
  64: "MATCH",
  65: "DATE",
  66: "TIME",
  67: "DAY",
  68: "MONTH",
  69: "YEAR",
  70: "WEEKDAY",
  71: "HOUR",
  72: "MINUTE",
  73: "SECOND",
  74: "NOW",
  75: "AREAS",
  76: "ROWS",
  77: "COLUMNS",
  78: "OFFSET",
  79: "ABSREF",
  80: "RELREF",
  81: "ARGUMENT",
  82: "SEARCH",
  83: "TRANSPOSE",
  84: "ERROR",
  85: "STEP",
  86: "TYPE",
  87: "ECHO",
  88: "SET.NAME",
  89: "CALLER",
  90: "DEREF",
  91: "WINDOWS",
  92: "SERIES",
  93: "DOCUMENTS",
  94: "ACTIVE.CELL",
  95: "SELECTION",
  96: "RESULT",
  97: "ATAN2",
  98: "ASIN",
  99: "ACOS",
  100: "CHOOSE",
  101: "HLOOKUP",
  102: "VLOOKUP",
  103: "LINKS",
  104: "INPUT",
  105: "ISREF",
  106: "GET.FORMULA",
  107: "GET.NAME",
  108: "SET.VALUE",
  109: "LOG",
  110: "EXEC",
  111: "CHAR",
  112: "LOWER",
  113: "UPPER",
  114: "PROPER",
  115: "LEFT",
  116: "RIGHT",
  117: "EXACT",
  118: "TRIM",
  119: "REPLACE",
  120: "SUBSTITUTE",
  121: "CODE",
  122: "NAMES",
  123: "DIRECTORY",
  124: "FIND",
  125: "CELL",
  126: "ISERR",
  127: "ISTEXT",
  128: "ISNUMBER",
  129: "ISBLANK",
  130: "T",
  131: "N",
  132: "FOPEN",
  133: "FCLOSE",
  134: "FSIZE",
  135: "FREADLN",
  136: "FREAD",
  137: "FWRITELN",
  138: "FWRITE",
  139: "FPOS",
  140: "DATEVALUE",
  141: "TIMEVALUE",
  142: "SLN",
  143: "SYD",
  144: "DDB",
  145: "GET.DEF",
  146: "REFTEXT",
  147: "TEXTREF",
  148: "INDIRECT",
  149: "REGISTER",
  150: "CALL",
  151: "ADD.BAR",
  152: "ADD.MENU",
  153: "ADD.COMMAND",
  154: "ENABLE.COMMAND",
  155: "CHECK.COMMAND",
  156: "RENAME.COMMAND",
  157: "SHOW.BAR",
  158: "DELETE.MENU",
  159: "DELETE.COMMAND",
  160: "GET.CHART.ITEM",
  161: "DIALOG.BOX",
  162: "CLEAN",
  163: "MDETERM",
  164: "MINVERSE",
  165: "MMULT",
  166: "FILES",
  167: "IPMT",
  168: "PPMT",
  169: "COUNTA",
  170: "CANCEL.KEY",
  171: "FOR",
  172: "WHILE",
  173: "BREAK",
  174: "NEXT",
  175: "INITIATE",
  176: "REQUEST",
  177: "POKE",
  178: "EXECUTE",
  179: "TERMINATE",
  180: "RESTART",
  181: "HELP",
  182: "GET.BAR",
  183: "PRODUCT",
  184: "FACT",
  185: "GET.CELL",
  186: "GET.WORKSPACE",
  187: "GET.WINDOW",
  188: "GET.DOCUMENT",
  189: "DPRODUCT",
  190: "ISNONTEXT",
  191: "GET.NOTE",
  192: "NOTE",
  193: "STDEVP",
  194: "VARP",
  195: "DSTDEVP",
  196: "DVARP",
  197: "TRUNC",
  198: "ISLOGICAL",
  199: "DCOUNTA",
  200: "DELETE.BAR",
  201: "UNREGISTER",
  204: "USDOLLAR",
  205: "FINDB",
  206: "SEARCHB",
  207: "REPLACEB",
  208: "LEFTB",
  209: "RIGHTB",
  210: "MIDB",
  211: "LENB",
  212: "ROUNDUP",
  213: "ROUNDDOWN",
  214: "ASC",
  215: "DBCS",
  216: "RANK",
  219: "ADDRESS",
  220: "DAYS360",
  221: "TODAY",
  222: "VDB",
  223: "ELSE",
  224: "ELSE.IF",
  225: "END.IF",
  226: "FOR.CELL",
  227: "MEDIAN",
  228: "SUMPRODUCT",
  229: "SINH",
  230: "COSH",
  231: "TANH",
  232: "ASINH",
  233: "ACOSH",
  234: "ATANH",
  235: "DGET",
  236: "CREATE.OBJECT",
  237: "VOLATILE",
  238: "LAST.ERROR",
  239: "CUSTOM.UNDO",
  240: "CUSTOM.REPEAT",
  241: "FORMULA.CONVERT",
  242: "GET.LINK.INFO",
  243: "TEXT.BOX",
  244: "INFO",
  245: "GROUP",
  246: "GET.OBJECT",
  247: "DB",
  248: "PAUSE",
  251: "RESUME",
  252: "FREQUENCY",
  253: "ADD.TOOLBAR",
  254: "DELETE.TOOLBAR",
  255: "User",
  256: "RESET.TOOLBAR",
  257: "EVALUATE",
  258: "GET.TOOLBAR",
  259: "GET.TOOL",
  260: "SPELLING.CHECK",
  261: "ERROR.TYPE",
  262: "APP.TITLE",
  263: "WINDOW.TITLE",
  264: "SAVE.TOOLBAR",
  265: "ENABLE.TOOL",
  266: "PRESS.TOOL",
  267: "REGISTER.ID",
  268: "GET.WORKBOOK",
  269: "AVEDEV",
  270: "BETADIST",
  271: "GAMMALN",
  272: "BETAINV",
  273: "BINOMDIST",
  274: "CHIDIST",
  275: "CHIINV",
  276: "COMBIN",
  277: "CONFIDENCE",
  278: "CRITBINOM",
  279: "EVEN",
  280: "EXPONDIST",
  281: "FDIST",
  282: "FINV",
  283: "FISHER",
  284: "FISHERINV",
  285: "FLOOR",
  286: "GAMMADIST",
  287: "GAMMAINV",
  288: "CEILING",
  289: "HYPGEOMDIST",
  290: "LOGNORMDIST",
  291: "LOGINV",
  292: "NEGBINOMDIST",
  293: "NORMDIST",
  294: "NORMSDIST",
  295: "NORMINV",
  296: "NORMSINV",
  297: "STANDARDIZE",
  298: "ODD",
  299: "PERMUT",
  300: "POISSON",
  301: "TDIST",
  302: "WEIBULL",
  303: "SUMXMY2",
  304: "SUMX2MY2",
  305: "SUMX2PY2",
  306: "CHITEST",
  307: "CORREL",
  308: "COVAR",
  309: "FORECAST",
  310: "FTEST",
  311: "INTERCEPT",
  312: "PEARSON",
  313: "RSQ",
  314: "STEYX",
  315: "SLOPE",
  316: "TTEST",
  317: "PROB",
  318: "DEVSQ",
  319: "GEOMEAN",
  320: "HARMEAN",
  321: "SUMSQ",
  322: "KURT",
  323: "SKEW",
  324: "ZTEST",
  325: "LARGE",
  326: "SMALL",
  327: "QUARTILE",
  328: "PERCENTILE",
  329: "PERCENTRANK",
  330: "MODE",
  331: "TRIMMEAN",
  332: "TINV",
  334: "MOVIE.COMMAND",
  335: "GET.MOVIE",
  336: "CONCATENATE",
  337: "POWER",
  338: "PIVOT.ADD.DATA",
  339: "GET.PIVOT.TABLE",
  340: "GET.PIVOT.FIELD",
  341: "GET.PIVOT.ITEM",
  342: "RADIANS",
  343: "DEGREES",
  344: "SUBTOTAL",
  345: "SUMIF",
  346: "COUNTIF",
  347: "COUNTBLANK",
  348: "SCENARIO.GET",
  349: "OPTIONS.LISTS.GET",
  350: "ISPMT",
  351: "DATEDIF",
  352: "DATESTRING",
  353: "NUMBERSTRING",
  354: "ROMAN",
  355: "OPEN.DIALOG",
  356: "SAVE.DIALOG",
  357: "VIEW.GET",
  358: "GETPIVOTDATA",
  359: "HYPERLINK",
  360: "PHONETIC",
  361: "AVERAGEA",
  362: "MAXA",
  363: "MINA",
  364: "STDEVPA",
  365: "VARPA",
  366: "STDEVA",
  367: "VARA",
  368: "BAHTTEXT",
  369: "THAIDAYOFWEEK",
  370: "THAIDIGIT",
  371: "THAIMONTHOFYEAR",
  372: "THAINUMSOUND",
  373: "THAINUMSTRING",
  374: "THAISTRINGLENGTH",
  375: "ISTHAIDIGIT",
  376: "ROUNDBAHTDOWN",
  377: "ROUNDBAHTUP",
  378: "THAIYEAR",
  379: "RTD",
  380: "CUBEVALUE",
  381: "CUBEMEMBER",
  382: "CUBEMEMBERPROPERTY",
  383: "CUBERANKEDMEMBER",
  384: "HEX2BIN",
  385: "HEX2DEC",
  386: "HEX2OCT",
  387: "DEC2BIN",
  388: "DEC2HEX",
  389: "DEC2OCT",
  390: "OCT2BIN",
  391: "OCT2HEX",
  392: "OCT2DEC",
  393: "BIN2DEC",
  394: "BIN2OCT",
  395: "BIN2HEX",
  396: "IMSUB",
  397: "IMDIV",
  398: "IMPOWER",
  399: "IMABS",
  400: "IMSQRT",
  401: "IMLN",
  402: "IMLOG2",
  403: "IMLOG10",
  404: "IMSIN",
  405: "IMCOS",
  406: "IMEXP",
  407: "IMARGUMENT",
  408: "IMCONJUGATE",
  409: "IMAGINARY",
  410: "IMREAL",
  411: "COMPLEX",
  412: "IMSUM",
  413: "IMPRODUCT",
  414: "SERIESSUM",
  415: "FACTDOUBLE",
  416: "SQRTPI",
  417: "QUOTIENT",
  418: "DELTA",
  419: "GESTEP",
  420: "ISEVEN",
  421: "ISODD",
  422: "MROUND",
  423: "ERF",
  424: "ERFC",
  425: "BESSELJ",
  426: "BESSELK",
  427: "BESSELY",
  428: "BESSELI",
  429: "XIRR",
  430: "XNPV",
  431: "PRICEMAT",
  432: "YIELDMAT",
  433: "INTRATE",
  434: "RECEIVED",
  435: "DISC",
  436: "PRICEDISC",
  437: "YIELDDISC",
  438: "TBILLEQ",
  439: "TBILLPRICE",
  440: "TBILLYIELD",
  441: "PRICE",
  442: "YIELD",
  443: "DOLLARDE",
  444: "DOLLARFR",
  445: "NOMINAL",
  446: "EFFECT",
  447: "CUMPRINC",
  448: "CUMIPMT",
  449: "EDATE",
  450: "EOMONTH",
  451: "YEARFRAC",
  452: "COUPDAYBS",
  453: "COUPDAYS",
  454: "COUPDAYSNC",
  455: "COUPNCD",
  456: "COUPNUM",
  457: "COUPPCD",
  458: "DURATION",
  459: "MDURATION",
  460: "ODDLPRICE",
  461: "ODDLYIELD",
  462: "ODDFPRICE",
  463: "ODDFYIELD",
  464: "RANDBETWEEN",
  465: "WEEKNUM",
  466: "AMORDEGRC",
  467: "AMORLINC",
  468: "CONVERT",
  724: "SHEETJS",
  469: "ACCRINT",
  470: "ACCRINTM",
  471: "WORKDAY",
  472: "NETWORKDAYS",
  473: "GCD",
  474: "MULTINOMIAL",
  475: "LCM",
  476: "FVSCHEDULE",
  477: "CUBEKPIMEMBER",
  478: "CUBESET",
  479: "CUBESETCOUNT",
  480: "IFERROR",
  481: "COUNTIFS",
  482: "SUMIFS",
  483: "AVERAGEIF",
  484: "AVERAGEIFS"
}, Ih = {
  2: 1,
  3: 1,
  10: 0,
  15: 1,
  16: 1,
  17: 1,
  18: 1,
  19: 0,
  20: 1,
  21: 1,
  22: 1,
  23: 1,
  24: 1,
  25: 1,
  26: 1,
  27: 2,
  30: 2,
  31: 3,
  32: 1,
  33: 1,
  34: 0,
  35: 0,
  38: 1,
  39: 2,
  40: 3,
  41: 3,
  42: 3,
  43: 3,
  44: 3,
  45: 3,
  47: 3,
  48: 2,
  53: 1,
  61: 3,
  63: 0,
  65: 3,
  66: 3,
  67: 1,
  68: 1,
  69: 1,
  70: 1,
  71: 1,
  72: 1,
  73: 1,
  74: 0,
  75: 1,
  76: 1,
  77: 1,
  79: 2,
  80: 2,
  83: 1,
  85: 0,
  86: 1,
  89: 0,
  90: 1,
  94: 0,
  95: 0,
  97: 2,
  98: 1,
  99: 1,
  101: 3,
  102: 3,
  105: 1,
  106: 1,
  108: 2,
  111: 1,
  112: 1,
  113: 1,
  114: 1,
  117: 2,
  118: 1,
  119: 4,
  121: 1,
  126: 1,
  127: 1,
  128: 1,
  129: 1,
  130: 1,
  131: 1,
  133: 1,
  134: 1,
  135: 1,
  136: 2,
  137: 2,
  138: 2,
  140: 1,
  141: 1,
  142: 3,
  143: 4,
  144: 4,
  161: 1,
  162: 1,
  163: 1,
  164: 1,
  165: 2,
  172: 1,
  175: 2,
  176: 2,
  177: 3,
  178: 2,
  179: 1,
  184: 1,
  186: 1,
  189: 3,
  190: 1,
  195: 3,
  196: 3,
  197: 1,
  198: 1,
  199: 3,
  201: 1,
  207: 4,
  210: 3,
  211: 1,
  212: 2,
  213: 2,
  214: 1,
  215: 1,
  225: 0,
  229: 1,
  230: 1,
  231: 1,
  232: 1,
  233: 1,
  234: 1,
  235: 3,
  244: 1,
  247: 4,
  252: 2,
  257: 1,
  261: 1,
  271: 1,
  273: 4,
  274: 2,
  275: 2,
  276: 2,
  277: 3,
  278: 3,
  279: 1,
  280: 3,
  281: 3,
  282: 3,
  283: 1,
  284: 1,
  285: 2,
  286: 4,
  287: 3,
  288: 2,
  289: 4,
  290: 3,
  291: 3,
  292: 3,
  293: 4,
  294: 1,
  295: 3,
  296: 1,
  297: 3,
  298: 1,
  299: 2,
  300: 3,
  301: 3,
  302: 4,
  303: 2,
  304: 2,
  305: 2,
  306: 2,
  307: 2,
  308: 2,
  309: 3,
  310: 2,
  311: 2,
  312: 2,
  313: 2,
  314: 2,
  315: 2,
  316: 4,
  325: 2,
  326: 2,
  327: 2,
  328: 2,
  331: 2,
  332: 2,
  337: 2,
  342: 1,
  343: 1,
  346: 2,
  347: 1,
  350: 4,
  351: 3,
  352: 1,
  353: 2,
  360: 1,
  368: 1,
  369: 1,
  370: 1,
  371: 1,
  372: 1,
  373: 1,
  374: 1,
  375: 1,
  376: 1,
  377: 1,
  378: 1,
  382: 3,
  385: 1,
  392: 1,
  393: 1,
  396: 2,
  397: 2,
  398: 2,
  399: 1,
  400: 1,
  401: 1,
  402: 1,
  403: 1,
  404: 1,
  405: 1,
  406: 1,
  407: 1,
  408: 1,
  409: 1,
  410: 1,
  414: 4,
  415: 1,
  416: 1,
  417: 2,
  420: 1,
  421: 1,
  422: 2,
  424: 1,
  425: 2,
  426: 2,
  427: 2,
  428: 2,
  430: 3,
  438: 3,
  439: 3,
  440: 3,
  443: 2,
  444: 2,
  445: 2,
  446: 2,
  447: 6,
  448: 6,
  449: 2,
  450: 2,
  464: 2,
  468: 3,
  476: 2,
  479: 1,
  480: 2,
  65535: 0
};
function Dn(e) {
  return e.slice(0, 3) == "of:" && (e = e.slice(3)), e.charCodeAt(0) == 61 && (e = e.slice(1), e.charCodeAt(0) == 61 && (e = e.slice(1))), e = e.replace(/COM\.MICROSOFT\./g, ""), e = e.replace(/\[((?:\.[A-Z]+[0-9]+)(?::\.[A-Z]+[0-9]+)?)\]/g, function(a, r) {
    return r.replace(/\./g, "");
  }), e = e.replace(/\[.(#[A-Z]*[?!])\]/g, "$1"), e.replace(/[;~]/g, ",").replace(/\|/g, ";");
}
function Gt(e) {
  var a = e.split(":"), r = a[0].split(".")[0];
  return [r, a[0].split(".")[1] + (a.length > 1 ? ":" + (a[1].split(".")[1] || a[1].split(".")[0]) : "")];
}
var Xa = {}, ka = {};
function za(e, a) {
  if (e) {
    var r = [0.7, 0.7, 0.75, 0.75, 0.3, 0.3];
    a == "xlml" && (r = [1, 1, 1, 1, 0.5, 0.5]), e.left == null && (e.left = r[0]), e.right == null && (e.right = r[1]), e.top == null && (e.top = r[2]), e.bottom == null && (e.bottom = r[3]), e.header == null && (e.header = r[4]), e.footer == null && (e.footer = r[5]);
  }
}
function us(e, a, r, t, n, i) {
  try {
    t.cellNF && (e.z = de[a]);
  } catch (c) {
    if (t.WTF) throw c;
  }
  if (!(e.t === "z" && !t.cellStyles)) {
    if (e.t === "d" && typeof e.v == "string" && (e.v = ze(e.v)), (!t || t.cellText !== !1) && e.t !== "z") try {
      if (de[a] == null && ia(Nc[a] || "General", a), e.t === "e") e.w = e.w || pa[e.v];
      else if (a === 0)
        if (e.t === "n")
          (e.v | 0) === e.v ? e.w = e.v.toString(10) : e.w = Ka(e.v);
        else if (e.t === "d") {
          var s = fr(e.v);
          (s | 0) === s ? e.w = s.toString(10) : e.w = Ka(s);
        } else {
          if (e.v === void 0) return "";
          e.w = fa(e.v, ka);
        }
      else e.t === "d" ? e.w = Er(a, fr(e.v), ka) : e.w = Er(a, e.v, ka);
    } catch (c) {
      if (t.WTF) throw c;
    }
    if (t.cellStyles && r != null)
      try {
        e.s = i.Fills[r], e.s.fgColor && e.s.fgColor.theme && !e.s.fgColor.rgb && (e.s.fgColor.rgb = Ct(n.themeElements.clrScheme[e.s.fgColor.theme].rgb, e.s.fgColor.tint || 0), t.WTF && (e.s.fgColor.raw_rgb = n.themeElements.clrScheme[e.s.fgColor.theme].rgb)), e.s.bgColor && e.s.bgColor.theme && (e.s.bgColor.rgb = Ct(n.themeElements.clrScheme[e.s.bgColor.theme].rgb, e.s.bgColor.tint || 0), t.WTF && (e.s.bgColor.raw_rgb = n.themeElements.clrScheme[e.s.bgColor.theme].rgb));
      } catch (c) {
        if (t.WTF && i.Fills) throw c;
      }
  }
}
function Lh(e, a) {
  var r = Oe(a);
  r.s.r <= r.e.r && r.s.c <= r.e.c && r.s.r >= 0 && r.s.c >= 0 && (e["!ref"] = _e(r));
}
var Ph = /<(?:\w:)?mergeCell ref="[A-Z0-9:]+"\s*[\/]?>/g, Mh = /<(?:\w+:)?sheetData[^>]*>([\s\S]*)<\/(?:\w+:)?sheetData>/, bh = /<(?:\w:)?hyperlink [^>]*>/mg, Bh = /"(\w*:\w*)"/, Uh = /<(?:\w:)?col\b[^>]*[\/]?>/g, Hh = /<(?:\w:)?autoFilter[^>]*([\/]|>([\s\S]*)<\/(?:\w:)?autoFilter)>/g, Wh = /<(?:\w:)?pageMargins[^>]*\/>/g, hs = /<(?:\w:)?sheetPr\b(?:[^>a-z][^>]*)?\/>/, Vh = /<(?:\w:)?sheetPr[^>]*(?:[\/]|>([\s\S]*)<\/(?:\w:)?sheetPr)>/, Gh = /<(?:\w:)?sheetViews[^>]*(?:[\/]|>([\s\S]*)<\/(?:\w:)?sheetViews)>/;
function Xh(e, a, r, t, n, i, s) {
  if (!e) return e;
  t || (t = { "!id": {} });
  var c = a.dense ? [] : {}, f = { s: { r: 2e6, c: 2e6 }, e: { r: 0, c: 0 } }, o = "", l = "", u = e.match(Mh);
  u ? (o = e.slice(0, u.index), l = e.slice(u.index + u[0].length)) : o = l = e;
  var x = o.match(hs);
  x ? S0(x[0], c, n, r) : (x = o.match(Vh)) && zh(x[0], x[1] || "", c, n, r);
  var d = (o.match(/<(?:\w*:)?dimension/) || { index: -1 }).index;
  if (d > 0) {
    var p = o.slice(d, d + 50).match(Bh);
    p && Lh(c, p[1]);
  }
  var h = o.match(Gh);
  h && h[1] && Zh(h[1], n);
  var m = [];
  if (a.cellStyles) {
    var A = o.match(Uh);
    A && Kh(m, A);
  }
  u && qh(u[1], c, a, f, i, s);
  var y = l.match(Hh);
  y && (c["!autofilter"] = jh(y[0]));
  var E = [], I = l.match(Ph);
  if (I) for (d = 0; d != I.length; ++d)
    E[d] = Oe(I[d].slice(I[d].indexOf('"') + 1));
  var b = l.match(bh);
  b && $h(c, b, t);
  var O = l.match(Wh);
  if (O && (c["!margins"] = Yh(oe(O[0]))), !c["!ref"] && f.e.c >= f.s.c && f.e.r >= f.s.r && (c["!ref"] = _e(f)), a.sheetRows > 0 && c["!ref"]) {
    var F = Oe(c["!ref"]);
    a.sheetRows <= +F.e.r && (F.e.r = a.sheetRows - 1, F.e.r > f.e.r && (F.e.r = f.e.r), F.e.r < F.s.r && (F.s.r = F.e.r), F.e.c > f.e.c && (F.e.c = f.e.c), F.e.c < F.s.c && (F.s.c = F.e.c), c["!fullref"] = c["!ref"], c["!ref"] = _e(F));
  }
  return m.length > 0 && (c["!cols"] = m), E.length > 0 && (c["!merges"] = E), c;
}
function S0(e, a, r, t) {
  var n = oe(e);
  r.Sheets[t] || (r.Sheets[t] = {}), n.codeName && (r.Sheets[t].CodeName = ke(Fe(n.codeName)));
}
function zh(e, a, r, t, n) {
  S0(e.slice(0, e.indexOf(">")), r, t, n);
}
function $h(e, a, r) {
  for (var t = Array.isArray(e), n = 0; n != a.length; ++n) {
    var i = oe(Fe(a[n]), !0);
    if (!i.ref) return;
    var s = ((r || {})["!id"] || [])[i.id];
    s ? (i.Target = s.Target, i.location && (i.Target += "#" + ke(i.location))) : (i.Target = "#" + ke(i.location), s = { Target: i.Target, TargetMode: "Internal" }), i.Rel = s, i.tooltip && (i.Tooltip = i.tooltip, delete i.tooltip);
    for (var c = Oe(i.ref), f = c.s.r; f <= c.e.r; ++f) for (var o = c.s.c; o <= c.e.c; ++o) {
      var l = he({ c: o, r: f });
      t ? (e[f] || (e[f] = []), e[f][o] || (e[f][o] = { t: "z", v: void 0 }), e[f][o].l = i) : (e[l] || (e[l] = { t: "z", v: void 0 }), e[l].l = i);
    }
  }
}
function Yh(e) {
  var a = {};
  return ["left", "right", "top", "bottom", "header", "footer"].forEach(function(r) {
    e[r] && (a[r] = parseFloat(e[r]));
  }), a;
}
function Kh(e, a) {
  for (var r = !1, t = 0; t != a.length; ++t) {
    var n = oe(a[t], !0);
    n.hidden && (n.hidden = Ce(n.hidden));
    var i = parseInt(n.min, 10) - 1, s = parseInt(n.max, 10) - 1;
    for (n.outlineLevel && (n.level = +n.outlineLevel || 0), delete n.min, delete n.max, n.width = +n.width, !r && n.width && (r = !0, A0(n.width)), Fa(n); i <= s; ) e[i++] = Ye(n);
  }
}
function jh(e) {
  var a = { ref: (e.match(/ref="([^"]*)"/) || [])[1] };
  return a;
}
var Jh = /<(?:\w:)?sheetView(?:[^>a-z][^>]*)?\/?>/;
function Zh(e, a) {
  a.Views || (a.Views = [{}]), (e.match(Jh) || []).forEach(function(r, t) {
    var n = oe(r);
    a.Views[t] || (a.Views[t] = {}), +n.zoomScale && (a.Views[t].zoom = +n.zoomScale), Ce(n.rightToLeft) && (a.Views[t].RTL = !0);
  });
}
var qh = /* @__PURE__ */ function() {
  var e = /<(?:\w+:)?c[ \/>]/, a = /<\/(?:\w+:)?row>/, r = /r=["']([^"']*)["']/, t = /<(?:\w+:)?is>([\S\s]*?)<\/(?:\w+:)?is>/, n = /ref=["']([^"']*)["']/, i = ja("v"), s = ja("f");
  return function(f, o, l, u, x, d) {
    for (var p = 0, h = "", m = [], A = [], y = 0, E = 0, I = 0, b = "", O, F, W = 0, D = 0, z, G, L = 0, J = 0, fe = Array.isArray(d.CellXf), re, ce = [], se = [], Se = Array.isArray(o), V = [], le = {}, ue = !1, S = !!l.sheetStubs, U = f.split(a), N = 0, R = U.length; N != R; ++N) {
      h = U[N].trim();
      var Y = h.length;
      if (Y !== 0) {
        var ee = 0;
        e: for (p = 0; p < Y; ++p) switch (
          /*x.charCodeAt(ri)*/
          h[p]
        ) {
          case ">":
            if (
              /*x.charCodeAt(ri-1) != 47*/
              h[p - 1] != "/"
            ) {
              ++p;
              break e;
            }
            if (l && l.cellStyles) {
              if (F = oe(h.slice(ee, p), !0), W = F.r != null ? parseInt(F.r, 10) : W + 1, D = -1, l.sheetRows && l.sheetRows < W) continue;
              le = {}, ue = !1, F.ht && (ue = !0, le.hpt = parseFloat(F.ht), le.hpx = Qa(le.hpt)), F.hidden == "1" && (ue = !0, le.hidden = !0), F.outlineLevel != null && (ue = !0, le.level = +F.outlineLevel), ue && (V[W - 1] = le);
            }
            break;
          case "<":
            ee = p;
            break;
        }
        if (ee >= p) break;
        if (F = oe(h.slice(ee, p), !0), W = F.r != null ? parseInt(F.r, 10) : W + 1, D = -1, !(l.sheetRows && l.sheetRows < W)) {
          u.s.r > W - 1 && (u.s.r = W - 1), u.e.r < W - 1 && (u.e.r = W - 1), l && l.cellStyles && (le = {}, ue = !1, F.ht && (ue = !0, le.hpt = parseFloat(F.ht), le.hpx = Qa(le.hpt)), F.hidden == "1" && (ue = !0, le.hidden = !0), F.outlineLevel != null && (ue = !0, le.level = +F.outlineLevel), ue && (V[W - 1] = le)), m = h.slice(p).split(e);
          for (var ne = 0; ne != m.length && m[ne].trim().charAt(0) == "<"; ++ne) ;
          for (m = m.slice(ne), p = 0; p != m.length; ++p)
            if (h = m[p].trim(), h.length !== 0) {
              if (A = h.match(r), y = p, E = 0, I = 0, h = "<c " + (h.slice(0, 1) == "<" ? ">" : "") + h, A != null && A.length === 2) {
                for (y = 0, b = A[1], E = 0; E != b.length && !((I = b.charCodeAt(E) - 64) < 1 || I > 26); ++E)
                  y = 26 * y + I;
                --y, D = y;
              } else ++D;
              for (E = 0; E != h.length && h.charCodeAt(E) !== 62; ++E) ;
              if (++E, F = oe(h.slice(0, E), !0), F.r || (F.r = he({ r: W - 1, c: D })), b = h.slice(E), O = { t: "" }, (A = b.match(i)) != null && /*::cref != null && */
              A[1] !== "" && (O.v = ke(A[1])), l.cellFormula) {
                if ((A = b.match(s)) != null && /*::cref != null && */
                A[1] !== "") {
                  if (O.f = ke(Fe(A[1])).replace(/\r\n/g, `
`), l.xlfn || (O.f = Fn(O.f)), /*::cref != null && cref[0] != null && */
                  A[0].indexOf('t="array"') > -1)
                    O.F = (b.match(n) || [])[1], O.F.indexOf(":") > -1 && ce.push([Oe(O.F), O.F]);
                  else if (
                    /*::cref != null && cref[0] != null && */
                    A[0].indexOf('t="shared"') > -1
                  ) {
                    G = oe(A[0]);
                    var q = ke(Fe(A[1]));
                    l.xlfn || (q = Fn(q)), se[parseInt(G.si, 10)] = [G, q, F.r];
                  }
                } else (A = b.match(/<f[^>]*\/>/)) && (G = oe(A[0]), se[G.si] && (O.f = ou(se[G.si][1], se[G.si][2], F.r)));
                var j = sr(F.r);
                for (E = 0; E < ce.length; ++E)
                  j.r >= ce[E][0].s.r && j.r <= ce[E][0].e.r && j.c >= ce[E][0].s.c && j.c <= ce[E][0].e.c && (O.F = ce[E][1]);
              }
              if (F.t == null && O.v === void 0)
                if (O.f || O.F)
                  O.v = 0, O.t = "n";
                else if (S) O.t = "z";
                else continue;
              else O.t = F.t || "n";
              switch (u.s.c > D && (u.s.c = D), u.e.c < D && (u.e.c = D), O.t) {
                case "n":
                  if (O.v == "" || O.v == null) {
                    if (!S) continue;
                    O.t = "z";
                  } else O.v = parseFloat(O.v);
                  break;
                case "s":
                  if (typeof O.v > "u") {
                    if (!S) continue;
                    O.t = "z";
                  } else
                    z = Xa[parseInt(O.v, 10)], O.v = z.t, O.r = z.r, l.cellHTML && (O.h = z.h);
                  break;
                case "str":
                  O.t = "s", O.v = O.v != null ? Fe(O.v) : "", l.cellHTML && (O.h = x0(O.v));
                  break;
                case "inlineStr":
                  A = b.match(t), O.t = "s", A != null && (z = w0(A[1])) ? (O.v = z.t, l.cellHTML && (O.h = z.h)) : O.v = "";
                  break;
                case "b":
                  O.v = Ce(O.v);
                  break;
                case "d":
                  l.cellDates ? O.v = ze(O.v, 1) : (O.v = fr(ze(O.v, 1)), O.t = "n");
                  break;
                case "e":
                  (!l || l.cellText !== !1) && (O.w = O.v), O.v = Ii[O.v];
                  break;
              }
              if (L = J = 0, re = null, fe && F.s !== void 0 && (re = d.CellXf[F.s], re != null && (re.numFmtId != null && (L = re.numFmtId), l.cellStyles && re.fillId != null && (J = re.fillId))), us(O, L, J, l, x, d), l.cellDates && fe && O.t == "n" && Sa(de[L]) && (O.t = "d", O.v = Ot(O.v)), F.cm && l.xlmeta) {
                var Te = (l.xlmeta.Cell || [])[+F.cm - 1];
                Te && Te.type == "XLDAPR" && (O.D = !0);
              }
              if (Se) {
                var C = sr(F.r);
                o[C.r] || (o[C.r] = []), o[C.r][C.c] = O;
              } else o[F.r] = O;
            }
        }
      }
    }
    V.length > 0 && (o["!rows"] = V);
  };
}();
function Qh(e, a) {
  var r = {}, t = e.l + a;
  r.r = e.read_shift(4), e.l += 4;
  var n = e.read_shift(2);
  e.l += 1;
  var i = e.read_shift(1);
  return e.l = t, i & 7 && (r.level = i & 7), i & 16 && (r.hidden = !0), i & 32 && (r.hpt = n / 20), r;
}
var ex = da;
function rx() {
}
function ax(e, a) {
  var r = {}, t = e[e.l];
  return ++e.l, r.above = !(t & 64), r.left = !(t & 128), e.l += 18, r.name = wf(e), r;
}
function tx(e) {
  var a = _r(e);
  return [a];
}
function nx(e) {
  var a = xa(e);
  return [a];
}
function ix(e) {
  var a = _r(e), r = e.read_shift(1);
  return [a, r, "b"];
}
function sx(e) {
  var a = xa(e), r = e.read_shift(1);
  return [a, r, "b"];
}
function cx(e) {
  var a = _r(e), r = e.read_shift(1);
  return [a, r, "e"];
}
function fx(e) {
  var a = xa(e), r = e.read_shift(1);
  return [a, r, "e"];
}
function ox(e) {
  var a = _r(e), r = e.read_shift(4);
  return [a, r, "s"];
}
function lx(e) {
  var a = xa(e), r = e.read_shift(4);
  return [a, r, "s"];
}
function ux(e) {
  var a = _r(e), r = qe(e);
  return [a, r, "n"];
}
function xs(e) {
  var a = xa(e), r = qe(e);
  return [a, r, "n"];
}
function hx(e) {
  var a = _r(e), r = _0(e);
  return [a, r, "n"];
}
function xx(e) {
  var a = xa(e), r = _0(e);
  return [a, r, "n"];
}
function dx(e) {
  var a = _r(e), r = g0(e);
  return [a, r, "is"];
}
function px(e) {
  var a = _r(e), r = er(e);
  return [a, r, "str"];
}
function vx(e) {
  var a = xa(e), r = er(e);
  return [a, r, "str"];
}
function mx(e, a, r) {
  var t = e.l + a, n = _r(e);
  n.r = r["!row"];
  var i = e.read_shift(1), s = [n, i, "b"];
  if (r.cellFormula) {
    e.l += 2;
    var c = Lt(e, t - e.l, r);
    s[3] = Ze(c, null, n, r.supbooks, r);
  } else e.l = t;
  return s;
}
function gx(e, a, r) {
  var t = e.l + a, n = _r(e);
  n.r = r["!row"];
  var i = e.read_shift(1), s = [n, i, "e"];
  if (r.cellFormula) {
    e.l += 2;
    var c = Lt(e, t - e.l, r);
    s[3] = Ze(c, null, n, r.supbooks, r);
  } else e.l = t;
  return s;
}
function Ex(e, a, r) {
  var t = e.l + a, n = _r(e);
  n.r = r["!row"];
  var i = qe(e), s = [n, i, "n"];
  if (r.cellFormula) {
    e.l += 2;
    var c = Lt(e, t - e.l, r);
    s[3] = Ze(c, null, n, r.supbooks, r);
  } else e.l = t;
  return s;
}
function _x(e, a, r) {
  var t = e.l + a, n = _r(e);
  n.r = r["!row"];
  var i = er(e), s = [n, i, "str"];
  if (r.cellFormula) {
    e.l += 2;
    var c = Lt(e, t - e.l, r);
    s[3] = Ze(c, null, n, r.supbooks, r);
  } else e.l = t;
  return s;
}
var Tx = da;
function kx(e, a) {
  var r = e.l + a, t = da(e), n = E0(e), i = er(e), s = er(e), c = er(e);
  e.l = r;
  var f = { rfx: t, relId: n, loc: i, display: c };
  return s && (f.Tooltip = s), f;
}
function wx() {
}
function Ax(e, a, r) {
  var t = e.l + a, n = Ri(e), i = e.read_shift(1), s = [n];
  if (s[2] = i, r.cellFormula) {
    var c = Dh(e, t - e.l, r);
    s[1] = c;
  } else e.l = t;
  return s;
}
function Fx(e, a, r) {
  var t = e.l + a, n = da(e), i = [n];
  if (r.cellFormula) {
    var s = Oh(e, t - e.l, r);
    i[1] = s, e.l = t;
  } else e.l = t;
  return i;
}
var Sx = ["left", "right", "top", "bottom", "header", "footer"];
function Cx(e) {
  var a = {};
  return Sx.forEach(function(r) {
    a[r] = qe(e);
  }), a;
}
function yx(e) {
  var a = e.read_shift(2);
  return e.l += 28, { RTL: a & 32 };
}
function Dx() {
}
function Rx() {
}
function Ox(e, a, r, t, n, i, s) {
  if (!e) return e;
  var c = a || {};
  t || (t = { "!id": {} });
  var f = c.dense ? [] : {}, o, l = { s: { r: 2e6, c: 2e6 }, e: { r: 0, c: 0 } }, u = !1, x = !1, d, p, h, m, A, y, E, I, b, O = [];
  c.biff = 12, c["!row"] = 0;
  var F = 0, W = !1, D = [], z = {}, G = c.supbooks || /*::(*/
  n.supbooks || [[]];
  if (G.sharedf = z, G.arrayf = D, G.SheetNames = n.SheetNames || n.Sheets.map(function(Se) {
    return Se.name;
  }), !c.supbooks && (c.supbooks = G, n.Names))
    for (var L = 0; L < n.Names.length; ++L) G[0][L + 1] = n.Names[L];
  var J = [], fe = [], re = !1;
  Rt[16] = { n: "BrtShortReal", f: xs };
  var ce;
  if (Vr(e, function(V, le, ue) {
    if (!x)
      switch (ue) {
        case 148:
          o = V;
          break;
        case 0:
          d = V, c.sheetRows && c.sheetRows <= d.r && (x = !0), I = Ke(m = d.r), c["!row"] = d.r, (V.hidden || V.hpt || V.level != null) && (V.hpt && (V.hpx = Qa(V.hpt)), fe[V.r] = V);
          break;
        case 2:
        case 3:
        case 4:
        case 5:
        case 6:
        case 7:
        case 8:
        case 9:
        case 10:
        case 11:
        case 13:
        case 14:
        case 15:
        case 16:
        case 17:
        case 18:
        case 62:
          switch (p = { t: V[2] }, V[2]) {
            case "n":
              p.v = V[1];
              break;
            case "s":
              E = Xa[V[1]], p.v = E.t, p.r = E.r;
              break;
            case "b":
              p.v = !!V[1];
              break;
            case "e":
              p.v = V[1], c.cellText !== !1 && (p.w = pa[p.v]);
              break;
            case "str":
              p.t = "s", p.v = V[1];
              break;
            case "is":
              p.t = "s", p.v = V[1].t;
              break;
          }
          if ((h = s.CellXf[V[0].iStyleRef]) && us(p, h.numFmtId, null, c, i, s), A = V[0].c == -1 ? A + 1 : V[0].c, c.dense ? (f[m] || (f[m] = []), f[m][A] = p) : f[Ve(A) + I] = p, c.cellFormula) {
            for (W = !1, F = 0; F < D.length; ++F) {
              var S = D[F];
              d.r >= S[0].s.r && d.r <= S[0].e.r && A >= S[0].s.c && A <= S[0].e.c && (p.F = _e(S[0]), W = !0);
            }
            !W && V.length > 3 && (p.f = V[3]);
          }
          if (l.s.r > d.r && (l.s.r = d.r), l.s.c > A && (l.s.c = A), l.e.r < d.r && (l.e.r = d.r), l.e.c < A && (l.e.c = A), c.cellDates && h && p.t == "n" && Sa(de[h.numFmtId])) {
            var U = na(p.v);
            U && (p.t = "d", p.v = new Date(U.y, U.m - 1, U.d, U.H, U.M, U.S, U.u));
          }
          ce && (ce.type == "XLDAPR" && (p.D = !0), ce = void 0);
          break;
        case 1:
        case 12:
          if (!c.sheetStubs || u) break;
          p = { t: "z", v: void 0 }, A = V[0].c == -1 ? A + 1 : V[0].c, c.dense ? (f[m] || (f[m] = []), f[m][A] = p) : f[Ve(A) + I] = p, l.s.r > d.r && (l.s.r = d.r), l.s.c > A && (l.s.c = A), l.e.r < d.r && (l.e.r = d.r), l.e.c < A && (l.e.c = A), ce && (ce.type == "XLDAPR" && (p.D = !0), ce = void 0);
          break;
        case 176:
          O.push(V);
          break;
        case 49:
          ce = ((c.xlmeta || {}).Cell || [])[V - 1];
          break;
        case 494:
          var N = t["!id"][V.relId];
          for (N ? (V.Target = N.Target, V.loc && (V.Target += "#" + V.loc), V.Rel = N) : V.relId == "" && (V.Target = "#" + V.loc), m = V.rfx.s.r; m <= V.rfx.e.r; ++m) for (A = V.rfx.s.c; A <= V.rfx.e.c; ++A)
            c.dense ? (f[m] || (f[m] = []), f[m][A] || (f[m][A] = { t: "z", v: void 0 }), f[m][A].l = V) : (y = he({ c: A, r: m }), f[y] || (f[y] = { t: "z", v: void 0 }), f[y].l = V);
          break;
        case 426:
          if (!c.cellFormula) break;
          D.push(V), b = c.dense ? f[m][A] : f[Ve(A) + I], b.f = Ze(V[1], l, { r: d.r, c: A }, G, c), b.F = _e(V[0]);
          break;
        case 427:
          if (!c.cellFormula) break;
          z[he(V[0].s)] = V[1], b = c.dense ? f[m][A] : f[Ve(A) + I], b.f = Ze(V[1], l, { r: d.r, c: A }, G, c);
          break;
        case 60:
          if (!c.cellStyles) break;
          for (; V.e >= V.s; )
            J[V.e--] = { width: V.w / 256, hidden: !!(V.flags & 1), level: V.level }, re || (re = !0, A0(V.w / 256)), Fa(J[V.e + 1]);
          break;
        case 161:
          f["!autofilter"] = { ref: _e(V) };
          break;
        case 476:
          f["!margins"] = V;
          break;
        case 147:
          n.Sheets[r] || (n.Sheets[r] = {}), V.name && (n.Sheets[r].CodeName = V.name), (V.above || V.left) && (f["!outline"] = { above: V.above, left: V.left });
          break;
        case 137:
          n.Views || (n.Views = [{}]), n.Views[0] || (n.Views[0] = {}), V.RTL && (n.Views[0].RTL = !0);
          break;
        case 485:
          break;
        case 64:
        case 1053:
          break;
        case 151:
          break;
        case 152:
        case 175:
        case 644:
        case 625:
        case 562:
        case 396:
        case 1112:
        case 1146:
        case 471:
        case 1050:
        case 649:
        case 1105:
        case 589:
        case 607:
        case 564:
        case 1055:
        case 168:
        case 174:
        case 1180:
        case 499:
        case 507:
        case 550:
        case 171:
        case 167:
        case 1177:
        case 169:
        case 1181:
        case 551:
        case 552:
        case 661:
        case 639:
        case 478:
        case 537:
        case 477:
        case 536:
        case 1103:
        case 680:
        case 1104:
        case 1024:
        case 663:
        case 535:
        case 678:
        case 504:
        case 1043:
        case 428:
        case 170:
        case 3072:
        case 50:
        case 2070:
        case 1045:
          break;
        case 35:
          u = !0;
          break;
        case 36:
          u = !1;
          break;
        case 37:
          u = !0;
          break;
        case 38:
          u = !1;
          break;
        default:
          if (!le.T) {
            if (!u || c.WTF) throw new Error("Unexpected record 0x" + ue.toString(16));
          }
      }
  }, c), delete c.supbooks, delete c["!row"], !f["!ref"] && (l.s.r < 2e6 || o && (o.e.r > 0 || o.e.c > 0 || o.s.r > 0 || o.s.c > 0)) && (f["!ref"] = _e(o || l)), c.sheetRows && f["!ref"]) {
    var se = Oe(f["!ref"]);
    c.sheetRows <= +se.e.r && (se.e.r = c.sheetRows - 1, se.e.r > l.e.r && (se.e.r = l.e.r), se.e.r < se.s.r && (se.s.r = se.e.r), se.e.c > l.e.c && (se.e.c = l.e.c), se.e.c < se.s.c && (se.s.c = se.e.c), f["!fullref"] = f["!ref"], f["!ref"] = _e(se));
  }
  return O.length > 0 && (f["!merges"] = O), J.length > 0 && (f["!cols"] = J), fe.length > 0 && (f["!rows"] = fe), f;
}
function Nx(e) {
  var a = [], r = e.match(/^<c:numCache>/), t;
  (e.match(/<c:pt idx="(\d*)">(.*?)<\/c:pt>/mg) || []).forEach(function(i) {
    var s = i.match(/<c:pt idx="(\d*?)"><c:v>(.*)<\/c:v><\/c:pt>/);
    s && (a[+s[1]] = r ? +s[2] : s[2]);
  });
  var n = ke((e.match(/<c:formatCode>([\s\S]*?)<\/c:formatCode>/) || ["", "General"])[1]);
  return (e.match(/<c:f>(.*?)<\/c:f>/mg) || []).forEach(function(i) {
    t = i.replace(/<.*?>/g, "");
  }), [a, n, t];
}
function Ix(e, a, r, t, n, i) {
  var s = i || { "!type": "chart" };
  if (!e) return i;
  var c = 0, f = 0, o = "A", l = { s: { r: 2e6, c: 2e6 }, e: { r: 0, c: 0 } };
  return (e.match(/<c:numCache>[\s\S]*?<\/c:numCache>/gm) || []).forEach(function(u) {
    var x = Nx(u);
    l.s.r = l.s.c = 0, l.e.c = c, o = Ve(c), x[0].forEach(function(d, p) {
      s[o + Ke(p)] = { t: "n", v: d, z: x[1] }, f = p;
    }), l.e.r < f && (l.e.r = f), ++c;
  }), c > 0 && (s["!ref"] = _e(l)), s;
}
function Lx(e, a, r, t, n) {
  if (!e) return e;
  t || (t = { "!id": {} });
  var i = { "!type": "chart", "!drawel": null, "!rel": "" }, s, c = e.match(hs);
  return c && S0(c[0], i, n, r), (s = e.match(/drawing r:id="(.*?)"/)) && (i["!rel"] = s[1]), t["!id"][i["!rel"]] && (i["!drawel"] = t["!id"][i["!rel"]]), i;
}
function Px(e, a) {
  e.l += 10;
  var r = er(e);
  return { name: r };
}
function Mx(e, a, r, t, n) {
  if (!e) return e;
  t || (t = { "!id": {} });
  var i = { "!type": "chart", "!drawel": null, "!rel": "" }, s = !1;
  return Vr(e, function(f, o, l) {
    switch (l) {
      case 550:
        i["!rel"] = f;
        break;
      case 651:
        n.Sheets[r] || (n.Sheets[r] = {}), f.name && (n.Sheets[r].CodeName = f.name);
        break;
      case 562:
      case 652:
      case 669:
      case 679:
      case 551:
      case 552:
      case 476:
      case 3072:
        break;
      case 35:
        s = !0;
        break;
      case 36:
        s = !1;
        break;
      case 37:
        break;
      case 38:
        break;
      default:
        if (!(o.T > 0)) {
          if (!(o.T < 0)) {
            if (!s || a.WTF) throw new Error("Unexpected record 0x" + l.toString(16));
          }
        }
    }
  }, a), t["!id"][i["!rel"]] && (i["!drawel"] = t["!id"][i["!rel"]]), i;
}
var ds = [
  ["allowRefreshQuery", !1, "bool"],
  ["autoCompressPictures", !0, "bool"],
  ["backupFile", !1, "bool"],
  ["checkCompatibility", !1, "bool"],
  ["CodeName", ""],
  ["date1904", !1, "bool"],
  ["defaultThemeVersion", 0, "int"],
  ["filterPrivacy", !1, "bool"],
  ["hidePivotFieldList", !1, "bool"],
  ["promptedSolutions", !1, "bool"],
  ["publishItems", !1, "bool"],
  ["refreshAllConnections", !1, "bool"],
  ["saveExternalLinkValues", !0, "bool"],
  ["showBorderUnselectedTables", !0, "bool"],
  ["showInkAnnotation", !0, "bool"],
  ["showObjects", "all"],
  ["showPivotChartFilter", !1, "bool"],
  ["updateLinks", "userSet"]
], bx = [
  ["activeTab", 0, "int"],
  ["autoFilterDateGrouping", !0, "bool"],
  ["firstSheet", 0, "int"],
  ["minimized", !1, "bool"],
  ["showHorizontalScroll", !0, "bool"],
  ["showSheetTabs", !0, "bool"],
  ["showVerticalScroll", !0, "bool"],
  ["tabRatio", 600, "int"],
  ["visibility", "visible"]
  //window{Height,Width}, {x,y}Window
], Bx = [
  //['state', 'visible']
], Ux = [
  ["calcCompleted", "true"],
  ["calcMode", "auto"],
  ["calcOnSave", "true"],
  ["concurrentCalc", "true"],
  ["fullCalcOnLoad", "false"],
  ["fullPrecision", "true"],
  ["iterate", "false"],
  ["iterateCount", "100"],
  ["iterateDelta", "0.001"],
  ["refMode", "A1"]
];
function Rn(e, a) {
  for (var r = 0; r != e.length; ++r)
    for (var t = e[r], n = 0; n != a.length; ++n) {
      var i = a[n];
      if (t[i[0]] == null) t[i[0]] = i[1];
      else switch (i[2]) {
        case "bool":
          typeof t[i[0]] == "string" && (t[i[0]] = Ce(t[i[0]]));
          break;
        case "int":
          typeof t[i[0]] == "string" && (t[i[0]] = parseInt(t[i[0]], 10));
          break;
      }
    }
}
function On(e, a) {
  for (var r = 0; r != a.length; ++r) {
    var t = a[r];
    if (e[t[0]] == null) e[t[0]] = t[1];
    else switch (t[2]) {
      case "bool":
        typeof e[t[0]] == "string" && (e[t[0]] = Ce(e[t[0]]));
        break;
      case "int":
        typeof e[t[0]] == "string" && (e[t[0]] = parseInt(e[t[0]], 10));
        break;
    }
  }
}
function ps(e) {
  On(e.WBProps, ds), On(e.CalcPr, Ux), Rn(e.WBView, bx), Rn(e.Sheets, Bx), ka.date1904 = Ce(e.WBProps.date1904);
}
var Hx = /* @__PURE__ */ "][*?/\\".split("");
function Wx(e, a) {
  if (e.length > 31)
    throw new Error("Sheet names cannot exceed 31 chars");
  var r = !0;
  return Hx.forEach(function(t) {
    if (e.indexOf(t) != -1)
      throw new Error("Sheet name cannot contain : \\ / ? * [ ]");
  }), r;
}
var Vx = /<\w+:workbook/;
function Gx(e, a) {
  if (!e) throw new Error("Could not find file");
  var r = (
    /*::(*/
    { AppVersion: {}, WBProps: {}, WBView: [], Sheets: [], CalcPr: {}, Names: [], xmlns: "" }
  ), t = !1, n = "xmlns", i = {}, s = 0;
  if (e.replace(ar, function(f, o) {
    var l = oe(f);
    switch (Nr(l[0])) {
      case "<?xml":
        break;
      case "<workbook":
        f.match(Vx) && (n = "xmlns" + f.match(/<(\w+):/)[1]), r.xmlns = l[n];
        break;
      case "</workbook>":
        break;
      case "<fileVersion":
        delete l[0], r.AppVersion = l;
        break;
      case "<fileVersion/>":
      case "</fileVersion>":
        break;
      case "<fileSharing":
        break;
      case "<fileSharing/>":
        break;
      case "<workbookPr":
      case "<workbookPr/>":
        ds.forEach(function(u) {
          if (l[u[0]] != null)
            switch (u[2]) {
              case "bool":
                r.WBProps[u[0]] = Ce(l[u[0]]);
                break;
              case "int":
                r.WBProps[u[0]] = parseInt(l[u[0]], 10);
                break;
              default:
                r.WBProps[u[0]] = l[u[0]];
            }
        }), l.codeName && (r.WBProps.CodeName = Fe(l.codeName));
        break;
      case "</workbookPr>":
        break;
      case "<workbookProtection":
        break;
      case "<workbookProtection/>":
        break;
      case "<bookViews":
      case "<bookViews>":
      case "</bookViews>":
        break;
      case "<workbookView":
      case "<workbookView/>":
        delete l[0], r.WBView.push(l);
        break;
      case "</workbookView>":
        break;
      case "<sheets":
      case "<sheets>":
      case "</sheets>":
        break;
      case "<sheet":
        switch (l.state) {
          case "hidden":
            l.Hidden = 1;
            break;
          case "veryHidden":
            l.Hidden = 2;
            break;
          default:
            l.Hidden = 0;
        }
        delete l.state, l.name = ke(Fe(l.name)), delete l[0], r.Sheets.push(l);
        break;
      case "</sheet>":
        break;
      case "<functionGroups":
      case "<functionGroups/>":
        break;
      case "<functionGroup":
        break;
      case "<externalReferences":
      case "</externalReferences>":
      case "<externalReferences>":
        break;
      case "<externalReference":
        break;
      case "<definedNames/>":
        break;
      case "<definedNames>":
      case "<definedNames":
        t = !0;
        break;
      case "</definedNames>":
        t = !1;
        break;
      case "<definedName":
        i = {}, i.Name = Fe(l.name), l.comment && (i.Comment = l.comment), l.localSheetId && (i.Sheet = +l.localSheetId), Ce(l.hidden || "0") && (i.Hidden = !0), s = o + f.length;
        break;
      case "</definedName>":
        i.Ref = ke(Fe(e.slice(s, o))), r.Names.push(i);
        break;
      case "<definedName/>":
        break;
      case "<calcPr":
        delete l[0], r.CalcPr = l;
        break;
      case "<calcPr/>":
        delete l[0], r.CalcPr = l;
        break;
      case "</calcPr>":
        break;
      case "<oleSize":
        break;
      case "<customWorkbookViews>":
      case "</customWorkbookViews>":
      case "<customWorkbookViews":
        break;
      case "<customWorkbookView":
      case "</customWorkbookView>":
        break;
      case "<pivotCaches>":
      case "</pivotCaches>":
      case "<pivotCaches":
        break;
      case "<pivotCache":
        break;
      case "<smartTagPr":
      case "<smartTagPr/>":
        break;
      case "<smartTagTypes":
      case "<smartTagTypes>":
      case "</smartTagTypes>":
        break;
      case "<smartTagType":
        break;
      case "<webPublishing":
      case "<webPublishing/>":
        break;
      case "<fileRecoveryPr":
      case "<fileRecoveryPr/>":
        break;
      case "<webPublishObjects>":
      case "<webPublishObjects":
      case "</webPublishObjects>":
        break;
      case "<webPublishObject":
        break;
      case "<extLst":
      case "<extLst>":
      case "</extLst>":
      case "<extLst/>":
        break;
      case "<ext":
        t = !0;
        break;
      case "</ext>":
        t = !1;
        break;
      case "<ArchID":
        break;
      case "<AlternateContent":
      case "<AlternateContent>":
        t = !0;
        break;
      case "</AlternateContent>":
        t = !1;
        break;
      case "<revisionPtr":
        break;
      default:
        if (!t && a.WTF) throw new Error("unrecognized " + l[0] + " in workbook");
    }
    return f;
  }), sf.indexOf(r.xmlns) === -1) throw new Error("Unknown Namespace: " + r.xmlns);
  return ps(r), r;
}
function Xx(e, a) {
  var r = {};
  return r.Hidden = e.read_shift(4), r.iTabID = e.read_shift(4), r.strRelID = jt(e), r.name = er(e), r;
}
function zx(e, a) {
  var r = {}, t = e.read_shift(4);
  r.defaultThemeVersion = e.read_shift(4);
  var n = a > 8 ? er(e) : "";
  return n.length > 0 && (r.CodeName = n), r.autoCompressPictures = !!(t & 65536), r.backupFile = !!(t & 64), r.checkCompatibility = !!(t & 4096), r.date1904 = !!(t & 1), r.filterPrivacy = !!(t & 8), r.hidePivotFieldList = !!(t & 1024), r.promptedSolutions = !!(t & 16), r.publishItems = !!(t & 2048), r.refreshAllConnections = !!(t & 262144), r.saveExternalLinkValues = !!(t & 128), r.showBorderUnselectedTables = !!(t & 4), r.showInkAnnotation = !!(t & 32), r.showObjects = ["all", "placeholders", "none"][t >> 13 & 3], r.showPivotChartFilter = !!(t & 32768), r.updateLinks = ["userSet", "never", "always"][t >> 8 & 3], r;
}
function $x(e, a) {
  var r = {};
  return e.read_shift(4), r.ArchID = e.read_shift(4), e.l += a - 8, r;
}
function Yx(e, a, r) {
  var t = e.l + a;
  e.l += 4, e.l += 1;
  var n = e.read_shift(4), i = Af(e), s = Rh(e, 0, r), c = E0(e);
  e.l = t;
  var f = { Name: i, Ptg: s };
  return n < 268435455 && (f.Sheet = n), c && (f.Comment = c), f;
}
function Kx(e, a) {
  var r = { AppVersion: {}, WBProps: {}, WBView: [], Sheets: [], CalcPr: {}, xmlns: "" }, t = [], n = !1;
  a || (a = {}), a.biff = 12;
  var i = [], s = [[]];
  return s.SheetNames = [], s.XTI = [], Rt[16] = { n: "BrtFRTArchID$", f: $x }, Vr(e, function(f, o, l) {
    switch (l) {
      case 156:
        s.SheetNames.push(f.name), r.Sheets.push(f);
        break;
      case 153:
        r.WBProps = f;
        break;
      case 39:
        f.Sheet != null && (a.SID = f.Sheet), f.Ref = Ze(f.Ptg, null, null, s, a), delete a.SID, delete f.Ptg, i.push(f);
        break;
      case 1036:
        break;
      case 357:
      case 358:
      case 355:
      case 667:
        s[0].length ? s.push([l, f]) : s[0] = [l, f], s[s.length - 1].XTI = [];
        break;
      case 362:
        s.length === 0 && (s[0] = [], s[0].XTI = []), s[s.length - 1].XTI = s[s.length - 1].XTI.concat(f), s.XTI = s.XTI.concat(f);
        break;
      case 361:
        break;
      case 2071:
      case 158:
      case 143:
      case 664:
      case 353:
        break;
      case 3072:
      case 3073:
      case 534:
      case 677:
      case 157:
      case 610:
      case 2050:
      case 155:
      case 548:
      case 676:
      case 128:
      case 665:
      case 2128:
      case 2125:
      case 549:
      case 2053:
      case 596:
      case 2076:
      case 2075:
      case 2082:
      case 397:
      case 154:
      case 1117:
      case 553:
      case 2091:
        break;
      case 35:
        t.push(l), n = !0;
        break;
      case 36:
        t.pop(), n = !1;
        break;
      case 37:
        t.push(l), n = !0;
        break;
      case 38:
        t.pop(), n = !1;
        break;
      case 16:
        break;
      default:
        if (!o.T) {
          if (!n || a.WTF && t[t.length - 1] != 37 && t[t.length - 1] != 35) throw new Error("Unexpected record 0x" + l.toString(16));
        }
    }
  }, a), ps(r), r.Names = i, r.supbooks = s, r;
}
function jx(e, a, r) {
  return a.slice(-4) === ".bin" ? Kx(e, r) : Gx(e, r);
}
function Jx(e, a, r, t, n, i, s, c) {
  return a.slice(-4) === ".bin" ? Ox(e, t, r, n, i, s, c) : Xh(e, t, r, n, i, s, c);
}
function Zx(e, a, r, t, n, i, s, c) {
  return a.slice(-4) === ".bin" ? Mx(e, t, r, n, i) : Lx(e, t, r, n, i);
}
function qx(e, a, r, t, n, i, s, c) {
  return a.slice(-4) === ".bin" ? su() : cu();
}
function Qx(e, a, r, t, n, i, s, c) {
  return a.slice(-4) === ".bin" ? nu() : iu();
}
function ed(e, a, r, t) {
  return a.slice(-4) === ".bin" ? T1(e, r, t) : p1(e, r, t);
}
function rd(e, a, r) {
  return rs(e, r);
}
function ad(e, a, r) {
  return a.slice(-4) === ".bin" ? bl(e, r) : Pl(e, r);
}
function td(e, a, r) {
  return a.slice(-4) === ".bin" ? ru(e, r) : J1(e, r);
}
function nd(e, a, r) {
  return a.slice(-4) === ".bin" ? Y1(e) : z1(e);
}
function id(e, a, r, t) {
  return r.slice(-4) === ".bin" ? K1(e, a, r, t) : void 0;
}
function sd(e, a, r) {
  return a.slice(-4) === ".bin" ? G1(e, a, r) : X1(e, a, r);
}
var vs = /([\w:]+)=((?:")([^"]*)(?:")|(?:')([^']*)(?:'))/g, ms = /([\w:]+)=((?:")(?:[^"]*)(?:")|(?:')(?:[^']*)(?:'))/;
function Tr(e, a) {
  var r = e.split(/\s+/), t = [];
  if (t[0] = r[0], r.length === 1) return t;
  var n = e.match(vs), i, s, c, f;
  if (n) for (f = 0; f != n.length; ++f)
    i = n[f].match(ms), (s = i[1].indexOf(":")) === -1 ? t[i[1]] = i[2].slice(1, i[2].length - 1) : (i[1].slice(0, 6) === "xmlns:" ? c = "xmlns" + i[1].slice(6) : c = i[1].slice(s + 1), t[c] = i[2].slice(1, i[2].length - 1));
  return t;
}
function cd(e) {
  var a = e.split(/\s+/), r = {};
  if (a.length === 1) return r;
  var t = e.match(vs), n, i, s, c;
  if (t) for (c = 0; c != t.length; ++c)
    n = t[c].match(ms), (i = n[1].indexOf(":")) === -1 ? r[n[1]] = n[2].slice(1, n[2].length - 1) : (n[1].slice(0, 6) === "xmlns:" ? s = "xmlns" + n[1].slice(6) : s = n[1].slice(i + 1), r[s] = n[2].slice(1, n[2].length - 1));
  return r;
}
var $a;
function fd(e, a) {
  var r = $a[e] || ke(e);
  return r === "General" ? fa(a) : Er(r, a);
}
function od(e, a, r, t) {
  var n = t;
  switch ((r[0].match(/dt:dt="([\w.]+)"/) || ["", ""])[1]) {
    case "boolean":
      n = Ce(t);
      break;
    case "i2":
    case "int":
      n = parseInt(t, 10);
      break;
    case "r4":
    case "float":
      n = parseFloat(t);
      break;
    case "date":
    case "dateTime.tz":
      n = ze(t);
      break;
    case "i8":
    case "string":
    case "fixed":
    case "uuid":
    case "bin.base64":
      break;
    default:
      throw new Error("bad custprop:" + r[0]);
  }
  e[ke(a)] = n;
}
function ld(e, a, r) {
  if (e.t !== "z") {
    if (!r || r.cellText !== !1) try {
      e.t === "e" ? e.w = e.w || pa[e.v] : a === "General" ? e.t === "n" ? (e.v | 0) === e.v ? e.w = e.v.toString(10) : e.w = Ka(e.v) : e.w = fa(e.v) : e.w = fd(a || "General", e.v);
    } catch (i) {
      if (r.WTF) throw i;
    }
    try {
      var t = $a[a] || a || "General";
      if (r.cellNF && (e.z = t), r.cellDates && e.t == "n" && Sa(t)) {
        var n = na(e.v);
        n && (e.t = "d", e.v = new Date(n.y, n.m - 1, n.d, n.H, n.M, n.S, n.u));
      }
    } catch (i) {
      if (r.WTF) throw i;
    }
  }
}
function ud(e, a, r) {
  if (r.cellStyles && a.Interior) {
    var t = a.Interior;
    t.Pattern && (t.patternType = o1[t.Pattern] || t.Pattern);
  }
  e[a.ID] = a;
}
function hd(e, a, r, t, n, i, s, c, f, o) {
  var l = "General", u = t.StyleID, x = {};
  o = o || {};
  var d = [], p = 0;
  for (u === void 0 && c && (u = c.StyleID), u === void 0 && s && (u = s.StyleID); i[u] !== void 0 && (i[u].nf && (l = i[u].nf), i[u].Interior && d.push(i[u].Interior), !!i[u].Parent); )
    u = i[u].Parent;
  switch (r.Type) {
    case "Boolean":
      t.t = "b", t.v = Ce(e);
      break;
    case "String":
      t.t = "s", t.r = q0(ke(e)), t.v = e.indexOf("<") > -1 ? ke(a || e).replace(/<.*?>/g, "") : t.r;
      break;
    case "DateTime":
      e.slice(-1) != "Z" && (e += "Z"), t.v = (ze(e) - new Date(Date.UTC(1899, 11, 30))) / (24 * 60 * 60 * 1e3), t.v !== t.v ? t.v = ke(e) : t.v < 60 && (t.v = t.v - 1), (!l || l == "General") && (l = "yyyy-mm-dd");
    case "Number":
      t.v === void 0 && (t.v = +e), t.t || (t.t = "n");
      break;
    case "Error":
      t.t = "e", t.v = Ii[e], o.cellText !== !1 && (t.w = e);
      break;
    default:
      e == "" && a == "" ? t.t = "z" : (t.t = "s", t.v = q0(a || e));
      break;
  }
  if (ld(t, l, o), o.cellFormula !== !1)
    if (t.Formula) {
      var h = ke(t.Formula);
      h.charCodeAt(0) == 61 && (h = h.slice(1)), t.f = Ta(h, n), delete t.Formula, t.ArrayRange == "RC" ? t.F = Ta("RC:RC", n) : t.ArrayRange && (t.F = Ta(t.ArrayRange, n), f.push([Oe(t.F), t.F]));
    } else
      for (p = 0; p < f.length; ++p)
        n.r >= f[p][0].s.r && n.r <= f[p][0].e.r && n.c >= f[p][0].s.c && n.c <= f[p][0].e.c && (t.F = f[p][1]);
  o.cellStyles && (d.forEach(function(m) {
    !x.patternType && m.patternType && (x.patternType = m.patternType);
  }), t.s = x), t.StyleID !== void 0 && (t.ixfe = t.StyleID);
}
function xd(e) {
  e.t = e.v || "", e.t = e.t.replace(/\r\n/g, `
`).replace(/\r/g, `
`), e.v = e.w = e.ixfe = void 0;
}
function Xt(e, a) {
  var r = a || {};
  ii();
  var t = La(d0(e));
  (r.type == "binary" || r.type == "array" || r.type == "base64") && (t = Fe(t));
  var n = t.slice(0, 1024).toLowerCase(), i = !1;
  if (n = n.replace(/".*?"/g, ""), (n.indexOf(">") & 1023) > Math.min(n.indexOf(",") & 1023, n.indexOf(";") & 1023)) {
    var s = Ye(r);
    return s.type = "string", Za.to_workbook(t, s);
  }
  if (n.indexOf("<?xml") == -1 && ["html", "table", "head", "meta", "script", "style", "div"].forEach(function(Le) {
    n.indexOf("<" + Le) >= 0 && (i = !0);
  }), i) return kd(t, r);
  $a = {
    "General Number": "General",
    "General Date": de[22],
    "Long Date": "dddd, mmmm dd, yyyy",
    "Medium Date": de[15],
    "Short Date": de[14],
    "Long Time": de[19],
    "Medium Time": de[18],
    "Short Time": de[20],
    Currency: '"$"#,##0.00_);[Red]\\("$"#,##0.00\\)',
    Fixed: de[2],
    Standard: de[4],
    Percent: de[10],
    Scientific: de[11],
    "Yes/No": '"Yes";"Yes";"No";@',
    "True/False": '"True";"True";"False";@',
    "On/Off": '"Yes";"Yes";"No";@'
  };
  var c, f = [], o, l = {}, u = [], x = r.dense ? [] : {}, d = "", p = {}, h = {}, m = Tr('<Data ss:Type="String">'), A = 0, y = 0, E = 0, I = { s: { r: 2e6, c: 2e6 }, e: { r: 0, c: 0 } }, b = {}, O = {}, F = "", W = 0, D = [], z = {}, G = {}, L = 0, J = [], fe = [], re = {}, ce = [], se, Se = !1, V = [], le = [], ue = {}, S = 0, U = 0, N = { Sheets: [], WBProps: { date1904: !1 } }, R = {};
  Ja.lastIndex = 0, t = t.replace(/<!--([\s\S]*?)-->/mg, "");
  for (var Y = ""; c = Ja.exec(t); ) switch (c[3] = (Y = c[3]).toLowerCase()) {
    case "data":
      if (Y == "data") {
        if (c[1] === "/") {
          if ((o = f.pop())[0] !== c[3]) throw new Error("Bad state: " + o.join("|"));
        } else c[0].charAt(c[0].length - 2) !== "/" && f.push([c[3], !0]);
        break;
      }
      if (f[f.length - 1][1]) break;
      c[1] === "/" ? hd(t.slice(A, c.index), F, m, f[f.length - 1][0] == /*"Comment"*/
      "comment" ? re : p, { c: y, r: E }, b, ce[y], h, V, r) : (F = "", m = Tr(c[0]), A = c.index + c[0].length);
      break;
    case "cell":
      if (c[1] === "/")
        if (fe.length > 0 && (p.c = fe), (!r.sheetRows || r.sheetRows > E) && p.v !== void 0 && (r.dense ? (x[E] || (x[E] = []), x[E][y] = p) : x[Ve(y) + Ke(E)] = p), p.HRef && (p.l = { Target: ke(p.HRef) }, p.HRefScreenTip && (p.l.Tooltip = p.HRefScreenTip), delete p.HRef, delete p.HRefScreenTip), (p.MergeAcross || p.MergeDown) && (S = y + (parseInt(p.MergeAcross, 10) | 0), U = E + (parseInt(p.MergeDown, 10) | 0), D.push({ s: { c: y, r: E }, e: { c: S, r: U } })), !r.sheetStubs)
          p.MergeAcross ? y = S + 1 : ++y;
        else if (p.MergeAcross || p.MergeDown) {
          for (var ee = y; ee <= S; ++ee)
            for (var ne = E; ne <= U; ++ne)
              (ee > y || ne > E) && (r.dense ? (x[ne] || (x[ne] = []), x[ne][ee] = { t: "z" }) : x[Ve(ee) + Ke(ne)] = { t: "z" });
          y = S + 1;
        } else ++y;
      else
        p = cd(c[0]), p.Index && (y = +p.Index - 1), y < I.s.c && (I.s.c = y), y > I.e.c && (I.e.c = y), c[0].slice(-2) === "/>" && ++y, fe = [];
      break;
    case "row":
      c[1] === "/" || c[0].slice(-2) === "/>" ? (E < I.s.r && (I.s.r = E), E > I.e.r && (I.e.r = E), c[0].slice(-2) === "/>" && (h = Tr(c[0]), h.Index && (E = +h.Index - 1)), y = 0, ++E) : (h = Tr(c[0]), h.Index && (E = +h.Index - 1), ue = {}, (h.AutoFitHeight == "0" || h.Height) && (ue.hpx = parseInt(h.Height, 10), ue.hpt = es(ue.hpx), le[E] = ue), h.Hidden == "1" && (ue.hidden = !0, le[E] = ue));
      break;
    case "worksheet":
      if (c[1] === "/") {
        if ((o = f.pop())[0] !== c[3]) throw new Error("Bad state: " + o.join("|"));
        u.push(d), I.s.r <= I.e.r && I.s.c <= I.e.c && (x["!ref"] = _e(I), r.sheetRows && r.sheetRows <= I.e.r && (x["!fullref"] = x["!ref"], I.e.r = r.sheetRows - 1, x["!ref"] = _e(I))), D.length && (x["!merges"] = D), ce.length > 0 && (x["!cols"] = ce), le.length > 0 && (x["!rows"] = le), l[d] = x;
      } else
        I = { s: { r: 2e6, c: 2e6 }, e: { r: 0, c: 0 } }, E = y = 0, f.push([c[3], !1]), o = Tr(c[0]), d = ke(o.Name), x = r.dense ? [] : {}, D = [], V = [], le = [], R = { name: d, Hidden: 0 }, N.Sheets.push(R);
      break;
    case "table":
      if (c[1] === "/") {
        if ((o = f.pop())[0] !== c[3]) throw new Error("Bad state: " + o.join("|"));
      } else {
        if (c[0].slice(-2) == "/>") break;
        f.push([c[3], !1]), ce = [], Se = !1;
      }
      break;
    case "style":
      c[1] === "/" ? ud(b, O, r) : O = Tr(c[0]);
      break;
    case "numberformat":
      O.nf = ke(Tr(c[0]).Format || "General"), $a[O.nf] && (O.nf = $a[O.nf]);
      for (var q = 0; q != 392 && de[q] != O.nf; ++q) ;
      if (q == 392) {
        for (q = 57; q != 392; ++q) if (de[q] == null) {
          ia(O.nf, q);
          break;
        }
      }
      break;
    case "column":
      if (f[f.length - 1][0] !== /*'Table'*/
      "table") break;
      if (se = Tr(c[0]), se.Hidden && (se.hidden = !0, delete se.Hidden), se.Width && (se.wpx = parseInt(se.Width, 10)), !Se && se.wpx > 10) {
        Se = !0, ir = qi;
        for (var j = 0; j < ce.length; ++j) ce[j] && Fa(ce[j]);
      }
      Se && Fa(se), ce[se.Index - 1 || ce.length] = se;
      for (var Te = 0; Te < +se.Span; ++Te) ce[ce.length] = Ye(se);
      break;
    case "namedrange":
      if (c[1] === "/") break;
      N.Names || (N.Names = []);
      var C = oe(c[0]), Ie = {
        Name: C.Name,
        Ref: Ta(C.RefersTo.slice(1), { r: 0, c: 0 })
      };
      N.Sheets.length > 0 && (Ie.Sheet = N.Sheets.length - 1), N.Names.push(Ie);
      break;
    case "namedcell":
      break;
    case "b":
      break;
    case "i":
      break;
    case "u":
      break;
    case "s":
      break;
    case "em":
      break;
    case "h2":
      break;
    case "h3":
      break;
    case "sub":
      break;
    case "sup":
      break;
    case "span":
      break;
    case "alignment":
      break;
    case "borders":
      break;
    case "border":
      break;
    case "font":
      if (c[0].slice(-2) === "/>") break;
      c[1] === "/" ? F += t.slice(W, c.index) : W = c.index + c[0].length;
      break;
    case "interior":
      if (!r.cellStyles) break;
      O.Interior = Tr(c[0]);
      break;
    case "protection":
      break;
    case "author":
    case "title":
    case "description":
    case "created":
    case "keywords":
    case "subject":
    case "category":
    case "company":
    case "lastauthor":
    case "lastsaved":
    case "lastprinted":
    case "version":
    case "revision":
    case "totaltime":
    case "hyperlinkbase":
    case "manager":
    case "contentstatus":
    case "identifier":
    case "language":
    case "appname":
      if (c[0].slice(-2) === "/>") break;
      c[1] === "/" ? jf(z, Y, t.slice(L, c.index)) : L = c.index + c[0].length;
      break;
    case "paragraphs":
      break;
    case "styles":
    case "workbook":
      if (c[1] === "/") {
        if ((o = f.pop())[0] !== c[3]) throw new Error("Bad state: " + o.join("|"));
      } else f.push([c[3], !1]);
      break;
    case "comment":
      if (c[1] === "/") {
        if ((o = f.pop())[0] !== c[3]) throw new Error("Bad state: " + o.join("|"));
        xd(re), fe.push(re);
      } else
        f.push([c[3], !1]), o = Tr(c[0]), re = { a: o.Author };
      break;
    case "autofilter":
      if (c[1] === "/") {
        if ((o = f.pop())[0] !== c[3]) throw new Error("Bad state: " + o.join("|"));
      } else if (c[0].charAt(c[0].length - 2) !== "/") {
        var we = Tr(c[0]);
        x["!autofilter"] = { ref: Ta(we.Range).replace(/\$/g, "") }, f.push([c[3], !0]);
      }
      break;
    case "name":
      break;
    case "datavalidation":
      if (c[1] === "/") {
        if ((o = f.pop())[0] !== c[3]) throw new Error("Bad state: " + o.join("|"));
      } else
        c[0].charAt(c[0].length - 2) !== "/" && f.push([c[3], !0]);
      break;
    case "pixelsperinch":
      break;
    case "componentoptions":
    case "documentproperties":
    case "customdocumentproperties":
    case "officedocumentsettings":
    case "pivottable":
    case "pivotcache":
    case "names":
    case "mapinfo":
    case "pagebreaks":
    case "querytable":
    case "sorting":
    case "schema":
    case "conditionalformatting":
    case "smarttagtype":
    case "smarttags":
    case "excelworkbook":
    case "workbookoptions":
    case "worksheetoptions":
      if (c[1] === "/") {
        if ((o = f.pop())[0] !== c[3]) throw new Error("Bad state: " + o.join("|"));
      } else c[0].charAt(c[0].length - 2) !== "/" && f.push([c[3], !0]);
      break;
    case "null":
      break;
    default:
      if (f.length == 0 && c[3] == "document" || f.length == 0 && c[3] == "uof") return bn(t, r);
      var Ae = !0;
      switch (f[f.length - 1][0]) {
        case "officedocumentsettings":
          switch (c[3]) {
            case "allowpng":
              break;
            case "removepersonalinformation":
              break;
            case "downloadcomponents":
              break;
            case "locationofcomponents":
              break;
            case "colors":
              break;
            case "color":
              break;
            case "index":
              break;
            case "rgb":
              break;
            case "targetscreensize":
              break;
            case "readonlyrecommended":
              break;
            default:
              Ae = !1;
          }
          break;
        case "componentoptions":
          switch (c[3]) {
            case "toolbar":
              break;
            case "hideofficelogo":
              break;
            case "spreadsheetautofit":
              break;
            case "label":
              break;
            case "caption":
              break;
            case "maxheight":
              break;
            case "maxwidth":
              break;
            case "nextsheetnumber":
              break;
            default:
              Ae = !1;
          }
          break;
        case "excelworkbook":
          switch (c[3]) {
            case "date1904":
              N.WBProps.date1904 = !0;
              break;
            case "windowheight":
              break;
            case "windowwidth":
              break;
            case "windowtopx":
              break;
            case "windowtopy":
              break;
            case "tabratio":
              break;
            case "protectstructure":
              break;
            case "protectwindow":
              break;
            case "protectwindows":
              break;
            case "activesheet":
              break;
            case "displayinknotes":
              break;
            case "firstvisiblesheet":
              break;
            case "supbook":
              break;
            case "sheetname":
              break;
            case "sheetindex":
              break;
            case "sheetindexfirst":
              break;
            case "sheetindexlast":
              break;
            case "dll":
              break;
            case "acceptlabelsinformulas":
              break;
            case "donotsavelinkvalues":
              break;
            case "iteration":
              break;
            case "maxiterations":
              break;
            case "maxchange":
              break;
            case "path":
              break;
            case "xct":
              break;
            case "count":
              break;
            case "selectedsheets":
              break;
            case "calculation":
              break;
            case "uncalced":
              break;
            case "startupprompt":
              break;
            case "crn":
              break;
            case "externname":
              break;
            case "formula":
              break;
            case "colfirst":
              break;
            case "collast":
              break;
            case "wantadvise":
              break;
            case "boolean":
              break;
            case "error":
              break;
            case "text":
              break;
            case "ole":
              break;
            case "noautorecover":
              break;
            case "publishobjects":
              break;
            case "donotcalculatebeforesave":
              break;
            case "number":
              break;
            case "refmoder1c1":
              break;
            case "embedsavesmarttags":
              break;
            default:
              Ae = !1;
          }
          break;
        case "workbookoptions":
          switch (c[3]) {
            case "owcversion":
              break;
            case "height":
              break;
            case "width":
              break;
            default:
              Ae = !1;
          }
          break;
        case "worksheetoptions":
          switch (c[3]) {
            case "visible":
              if (c[0].slice(-2) !== "/>") if (c[1] === "/") switch (t.slice(L, c.index)) {
                case "SheetHidden":
                  R.Hidden = 1;
                  break;
                case "SheetVeryHidden":
                  R.Hidden = 2;
                  break;
              }
              else L = c.index + c[0].length;
              break;
            case "header":
              x["!margins"] || za(x["!margins"] = {}, "xlml"), isNaN(+oe(c[0]).Margin) || (x["!margins"].header = +oe(c[0]).Margin);
              break;
            case "footer":
              x["!margins"] || za(x["!margins"] = {}, "xlml"), isNaN(+oe(c[0]).Margin) || (x["!margins"].footer = +oe(c[0]).Margin);
              break;
            case "pagemargins":
              var me = oe(c[0]);
              x["!margins"] || za(x["!margins"] = {}, "xlml"), isNaN(+me.Top) || (x["!margins"].top = +me.Top), isNaN(+me.Left) || (x["!margins"].left = +me.Left), isNaN(+me.Right) || (x["!margins"].right = +me.Right), isNaN(+me.Bottom) || (x["!margins"].bottom = +me.Bottom);
              break;
            case "displayrighttoleft":
              N.Views || (N.Views = []), N.Views[0] || (N.Views[0] = {}), N.Views[0].RTL = !0;
              break;
            case "freezepanes":
              break;
            case "frozennosplit":
              break;
            case "splithorizontal":
            case "splitvertical":
              break;
            case "donotdisplaygridlines":
              break;
            case "activerow":
              break;
            case "activecol":
              break;
            case "toprowbottompane":
              break;
            case "leftcolumnrightpane":
              break;
            case "unsynced":
              break;
            case "print":
              break;
            case "printerrors":
              break;
            case "panes":
              break;
            case "scale":
              break;
            case "pane":
              break;
            case "number":
              break;
            case "layout":
              break;
            case "pagesetup":
              break;
            case "selected":
              break;
            case "protectobjects":
              break;
            case "enableselection":
              break;
            case "protectscenarios":
              break;
            case "validprinterinfo":
              break;
            case "horizontalresolution":
              break;
            case "verticalresolution":
              break;
            case "numberofcopies":
              break;
            case "activepane":
              break;
            case "toprowvisible":
              break;
            case "leftcolumnvisible":
              break;
            case "fittopage":
              break;
            case "rangeselection":
              break;
            case "papersizeindex":
              break;
            case "pagelayoutzoom":
              break;
            case "pagebreakzoom":
              break;
            case "filteron":
              break;
            case "fitwidth":
              break;
            case "fitheight":
              break;
            case "commentslayout":
              break;
            case "zoom":
              break;
            case "lefttoright":
              break;
            case "gridlines":
              break;
            case "allowsort":
              break;
            case "allowfilter":
              break;
            case "allowinsertrows":
              break;
            case "allowdeleterows":
              break;
            case "allowinsertcols":
              break;
            case "allowdeletecols":
              break;
            case "allowinserthyperlinks":
              break;
            case "allowformatcells":
              break;
            case "allowsizecols":
              break;
            case "allowsizerows":
              break;
            case "nosummaryrowsbelowdetail":
              x["!outline"] || (x["!outline"] = {}), x["!outline"].above = !0;
              break;
            case "tabcolorindex":
              break;
            case "donotdisplayheadings":
              break;
            case "showpagelayoutzoom":
              break;
            case "nosummarycolumnsrightdetail":
              x["!outline"] || (x["!outline"] = {}), x["!outline"].left = !0;
              break;
            case "blackandwhite":
              break;
            case "donotdisplayzeros":
              break;
            case "displaypagebreak":
              break;
            case "rowcolheadings":
              break;
            case "donotdisplayoutline":
              break;
            case "noorientation":
              break;
            case "allowusepivottables":
              break;
            case "zeroheight":
              break;
            case "viewablerange":
              break;
            case "selection":
              break;
            case "protectcontents":
              break;
            default:
              Ae = !1;
          }
          break;
        case "pivottable":
        case "pivotcache":
          switch (c[3]) {
            case "immediateitemsondrop":
              break;
            case "showpagemultipleitemlabel":
              break;
            case "compactrowindent":
              break;
            case "location":
              break;
            case "pivotfield":
              break;
            case "orientation":
              break;
            case "layoutform":
              break;
            case "layoutsubtotallocation":
              break;
            case "layoutcompactrow":
              break;
            case "position":
              break;
            case "pivotitem":
              break;
            case "datatype":
              break;
            case "datafield":
              break;
            case "sourcename":
              break;
            case "parentfield":
              break;
            case "ptlineitems":
              break;
            case "ptlineitem":
              break;
            case "countofsameitems":
              break;
            case "item":
              break;
            case "itemtype":
              break;
            case "ptsource":
              break;
            case "cacheindex":
              break;
            case "consolidationreference":
              break;
            case "filename":
              break;
            case "reference":
              break;
            case "nocolumngrand":
              break;
            case "norowgrand":
              break;
            case "blanklineafteritems":
              break;
            case "hidden":
              break;
            case "subtotal":
              break;
            case "basefield":
              break;
            case "mapchilditems":
              break;
            case "function":
              break;
            case "refreshonfileopen":
              break;
            case "printsettitles":
              break;
            case "mergelabels":
              break;
            case "defaultversion":
              break;
            case "refreshname":
              break;
            case "refreshdate":
              break;
            case "refreshdatecopy":
              break;
            case "versionlastrefresh":
              break;
            case "versionlastupdate":
              break;
            case "versionupdateablemin":
              break;
            case "versionrefreshablemin":
              break;
            case "calculation":
              break;
            default:
              Ae = !1;
          }
          break;
        case "pagebreaks":
          switch (c[3]) {
            case "colbreaks":
              break;
            case "colbreak":
              break;
            case "rowbreaks":
              break;
            case "rowbreak":
              break;
            case "colstart":
              break;
            case "colend":
              break;
            case "rowend":
              break;
            default:
              Ae = !1;
          }
          break;
        case "autofilter":
          switch (c[3]) {
            case "autofiltercolumn":
              break;
            case "autofiltercondition":
              break;
            case "autofilterand":
              break;
            case "autofilteror":
              break;
            default:
              Ae = !1;
          }
          break;
        case "querytable":
          switch (c[3]) {
            case "id":
              break;
            case "autoformatfont":
              break;
            case "autoformatpattern":
              break;
            case "querysource":
              break;
            case "querytype":
              break;
            case "enableredirections":
              break;
            case "refreshedinxl9":
              break;
            case "urlstring":
              break;
            case "htmltables":
              break;
            case "connection":
              break;
            case "commandtext":
              break;
            case "refreshinfo":
              break;
            case "notitles":
              break;
            case "nextid":
              break;
            case "columninfo":
              break;
            case "overwritecells":
              break;
            case "donotpromptforfile":
              break;
            case "textwizardsettings":
              break;
            case "source":
              break;
            case "number":
              break;
            case "decimal":
              break;
            case "thousandseparator":
              break;
            case "trailingminusnumbers":
              break;
            case "formatsettings":
              break;
            case "fieldtype":
              break;
            case "delimiters":
              break;
            case "tab":
              break;
            case "comma":
              break;
            case "autoformatname":
              break;
            case "versionlastedit":
              break;
            case "versionlastrefresh":
              break;
            default:
              Ae = !1;
          }
          break;
        case "datavalidation":
          switch (c[3]) {
            case "range":
              break;
            case "type":
              break;
            case "min":
              break;
            case "max":
              break;
            case "sort":
              break;
            case "descending":
              break;
            case "order":
              break;
            case "casesensitive":
              break;
            case "value":
              break;
            case "errorstyle":
              break;
            case "errormessage":
              break;
            case "errortitle":
              break;
            case "inputmessage":
              break;
            case "inputtitle":
              break;
            case "combohide":
              break;
            case "inputhide":
              break;
            case "condition":
              break;
            case "qualifier":
              break;
            case "useblank":
              break;
            case "value1":
              break;
            case "value2":
              break;
            case "format":
              break;
            case "cellrangelist":
              break;
            default:
              Ae = !1;
          }
          break;
        case "sorting":
        case "conditionalformatting":
          switch (c[3]) {
            case "range":
              break;
            case "type":
              break;
            case "min":
              break;
            case "max":
              break;
            case "sort":
              break;
            case "descending":
              break;
            case "order":
              break;
            case "casesensitive":
              break;
            case "value":
              break;
            case "errorstyle":
              break;
            case "errormessage":
              break;
            case "errortitle":
              break;
            case "cellrangelist":
              break;
            case "inputmessage":
              break;
            case "inputtitle":
              break;
            case "combohide":
              break;
            case "inputhide":
              break;
            case "condition":
              break;
            case "qualifier":
              break;
            case "useblank":
              break;
            case "value1":
              break;
            case "value2":
              break;
            case "format":
              break;
            default:
              Ae = !1;
          }
          break;
        case "mapinfo":
        case "schema":
        case "data":
          switch (c[3]) {
            case "map":
              break;
            case "entry":
              break;
            case "range":
              break;
            case "xpath":
              break;
            case "field":
              break;
            case "xsdtype":
              break;
            case "filteron":
              break;
            case "aggregate":
              break;
            case "elementtype":
              break;
            case "attributetype":
              break;
            case "schema":
            case "element":
            case "complextype":
            case "datatype":
            case "all":
            case "attribute":
            case "extends":
              break;
            case "row":
              break;
            default:
              Ae = !1;
          }
          break;
        case "smarttags":
          break;
        default:
          Ae = !1;
          break;
      }
      if (Ae || c[3].match(/!\[CDATA/)) break;
      if (!f[f.length - 1][1]) throw "Unrecognized tag: " + c[3] + "|" + f.join("|");
      if (f[f.length - 1][0] === /*'CustomDocumentProperties'*/
      "customdocumentproperties") {
        if (c[0].slice(-2) === "/>") break;
        c[1] === "/" ? od(G, Y, J, t.slice(L, c.index)) : (J = c, L = c.index + c[0].length);
        break;
      }
      if (r.WTF) throw "Unrecognized tag: " + c[3] + "|" + f.join("|");
  }
  var ae = {};
  return !r.bookSheets && !r.bookProps && (ae.Sheets = l), ae.SheetNames = u, ae.Workbook = N, ae.SSF = Ye(de), ae.Props = z, ae.Custprops = G, ae;
}
function Qt(e, a) {
  switch (D0(a = a || {}), a.type || "base64") {
    case "base64":
      return Xt(xr(e), a);
    case "binary":
    case "buffer":
    case "file":
      return Xt(e, a);
    case "array":
      return Xt(ha(e), a);
  }
}
function dd(e) {
  var a = {}, r = e.content;
  if (r.l = 28, a.AnsiUserType = r.read_shift(0, "lpstr-ansi"), a.AnsiClipboardFormat = Cf(r), r.length - r.l <= 4) return a;
  var t = r.read_shift(4);
  if (t == 0 || t > 40 || (r.l -= 4, a.Reserved1 = r.read_shift(0, "lpstr-ansi"), r.length - r.l <= 4) || (t = r.read_shift(4), t !== 1907505652) || (a.UnicodeClipboardFormat = yf(r), t = r.read_shift(4), t == 0 || t > 40)) return a;
  r.l -= 4, a.Reserved2 = r.read_shift(0, "lpwstr");
}
var pd = [60, 1084, 2066, 2165, 2175];
function vd(e, a, r, t, n) {
  var i = t, s = [], c = r.slice(r.l, r.l + i);
  if (n && n.enc && n.enc.insitu && c.length > 0) switch (e) {
    case 9:
    case 521:
    case 1033:
    case 2057:
    case 47:
    case 405:
    case 225:
    case 406:
    case 312:
    case 404:
    case 10:
      break;
    case 133:
      break;
    default:
      n.enc.insitu(c);
  }
  s.push(c), r.l += i;
  for (var f = Br(r, r.l), o = e0[f], l = 0; o != null && pd.indexOf(f) > -1; )
    i = Br(r, r.l + 2), l = r.l + 4, f == 2066 ? l += 4 : (f == 2165 || f == 2175) && (l += 12), c = r.slice(l, r.l + 4 + i), s.push(c), r.l += 4 + i, o = e0[f = Br(r, r.l)];
  var u = Yr(s);
  $e(u, 0);
  var x = 0;
  u.lens = [];
  for (var d = 0; d < s.length; ++d)
    u.lens.push(x), x += s[d].length;
  if (u.length < t) throw "XLS Record 0x" + e.toString(16) + " Truncated: " + u.length + " < " + t;
  return a.f(u, u.length, n);
}
function Dr(e, a, r) {
  if (e.t !== "z" && e.XF) {
    var t = 0;
    try {
      t = e.z || e.XF.numFmtId || 0, a.cellNF && (e.z = de[t]);
    } catch (i) {
      if (a.WTF) throw i;
    }
    if (!a || a.cellText !== !1) try {
      e.t === "e" ? e.w = e.w || pa[e.v] : t === 0 || t == "General" ? e.t === "n" ? (e.v | 0) === e.v ? e.w = e.v.toString(10) : e.w = Ka(e.v) : e.w = fa(e.v) : e.w = Er(t, e.v, { date1904: !!r, dateNF: a && a.dateNF });
    } catch (i) {
      if (a.WTF) throw i;
    }
    if (a.cellDates && t && e.t == "n" && Sa(de[t] || String(t))) {
      var n = na(e.v);
      n && (e.t = "d", e.v = new Date(n.y, n.m - 1, n.d, n.H, n.M, n.S, n.u));
    }
  }
}
function mt(e, a, r) {
  return { v: e, ixfe: a, t: r };
}
function md(e, a) {
  var r = { opts: {} }, t = {}, n = a.dense ? [] : {}, i = {}, s = {}, c = null, f = [], o = "", l = {}, u, x = "", d, p, h, m, A = {}, y = [], E, I, b = [], O = [], F = { Sheets: [], WBProps: { date1904: !1 }, Views: [{}] }, W = {}, D = function(ve) {
    return ve < 8 ? sa[ve] : ve < 64 && O[ve - 8] || sa[ve];
  }, z = function(ve, Pe, pr) {
    var He = Pe.XF.data;
    if (!(!He || !He.patternType || !pr || !pr.cellStyles)) {
      Pe.s = {}, Pe.s.patternType = He.patternType;
      var ea;
      (ea = qa(D(He.icvFore))) && (Pe.s.fgColor = { rgb: ea }), (ea = qa(D(He.icvBack))) && (Pe.s.bgColor = { rgb: ea });
    }
  }, G = function(ve, Pe, pr) {
    if (!(ue > 1) && !(pr.sheetRows && ve.r >= pr.sheetRows)) {
      if (pr.cellStyles && Pe.XF && Pe.XF.data && z(ve, Pe, pr), delete Pe.ixfe, delete Pe.XF, u = ve, x = he(ve), (!s || !s.s || !s.e) && (s = { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } }), ve.r < s.s.r && (s.s.r = ve.r), ve.c < s.s.c && (s.s.c = ve.c), ve.r + 1 > s.e.r && (s.e.r = ve.r + 1), ve.c + 1 > s.e.c && (s.e.c = ve.c + 1), pr.cellFormula && Pe.f) {
        for (var He = 0; He < y.length; ++He)
          if (!(y[He][0].s.c > ve.c || y[He][0].s.r > ve.r) && !(y[He][0].e.c < ve.c || y[He][0].e.r < ve.r)) {
            Pe.F = _e(y[He][0]), (y[He][0].s.c != ve.c || y[He][0].s.r != ve.r) && delete Pe.f, Pe.f && (Pe.f = "" + Ze(y[He][1], s, ve, V, L));
            break;
          }
      }
      pr.dense ? (n[ve.r] || (n[ve.r] = []), n[ve.r][ve.c] = Pe) : n[x] = Pe;
    }
  }, L = {
    enc: !1,
    // encrypted
    sbcch: 0,
    // cch in the preceding SupBook
    snames: [],
    // sheetnames
    sharedf: A,
    // shared formulae by address
    arrayf: y,
    // array formulae array
    rrtabid: [],
    // RRTabId
    lastuser: "",
    // Last User from WriteAccess
    biff: 8,
    // BIFF version
    codepage: 0,
    // CP from CodePage record
    winlocked: 0,
    // fLockWn from WinProtect
    cellStyles: !!a && !!a.cellStyles,
    WTF: !!a && !!a.wtf
  };
  a.password && (L.password = a.password);
  var J, fe = [], re = [], ce = [], se = [], Se = !1, V = [];
  V.SheetNames = L.snames, V.sharedf = L.sharedf, V.arrayf = L.arrayf, V.names = [], V.XTI = [];
  var le = 0, ue = 0, S = 0, U = [], N = [], R;
  L.codepage = 1200, Ar(1200);
  for (var Y = !1; e.l < e.length - 1; ) {
    var ee = e.l, ne = e.read_shift(2);
    if (ne === 0 && le === 10) break;
    var q = e.l === e.length ? 0 : e.read_shift(2), j = e0[ne];
    if (j && j.f) {
      if (a.bookSheets && le === 133 && ne !== 133)
        break;
      if (le = ne, j.r === 2 || j.r == 12) {
        var Te = e.read_shift(2);
        if (q -= 2, !L.enc && Te !== ne && ((Te & 255) << 8 | Te >> 8) !== ne) throw new Error("rt mismatch: " + Te + "!=" + ne);
        j.r == 12 && (e.l += 10, q -= 10);
      }
      var C = {};
      if (ne === 10 ? C = /*::(*/
      j.f(e, q, L) : C = /*::(*/
      vd(ne, j, e, q, L), ue == 0 && [9, 521, 1033, 2057].indexOf(le) === -1) continue;
      switch (ne) {
        case 34:
          r.opts.Date1904 = F.WBProps.date1904 = C;
          break;
        case 134:
          r.opts.WriteProtect = !0;
          break;
        case 47:
          if (L.enc || (e.l = 0), L.enc = C, !a.password) throw new Error("File is password-protected");
          if (C.valid == null) throw new Error("Encryption scheme unsupported");
          if (!C.valid) throw new Error("Password is incorrect");
          break;
        case 92:
          L.lastuser = C;
          break;
        case 66:
          var Ie = Number(C);
          switch (Ie) {
            case 21010:
              Ie = 1200;
              break;
            case 32768:
              Ie = 1e4;
              break;
            case 32769:
              Ie = 1252;
              break;
          }
          Ar(L.codepage = Ie), Y = !0;
          break;
        case 317:
          L.rrtabid = C;
          break;
        case 25:
          L.winlocked = C;
          break;
        case 439:
          r.opts.RefreshAll = C;
          break;
        case 12:
          r.opts.CalcCount = C;
          break;
        case 16:
          r.opts.CalcDelta = C;
          break;
        case 17:
          r.opts.CalcIter = C;
          break;
        case 13:
          r.opts.CalcMode = C;
          break;
        case 14:
          r.opts.CalcPrecision = C;
          break;
        case 95:
          r.opts.CalcSaveRecalc = C;
          break;
        case 15:
          L.CalcRefMode = C;
          break;
        case 2211:
          r.opts.FullCalc = C;
          break;
        case 129:
          C.fDialog && (n["!type"] = "dialog"), C.fBelow || ((n["!outline"] || (n["!outline"] = {})).above = !0), C.fRight || ((n["!outline"] || (n["!outline"] = {})).left = !0);
          break;
        case 224:
          b.push(C);
          break;
        case 430:
          V.push([C]), V[V.length - 1].XTI = [];
          break;
        case 35:
        case 547:
          V[V.length - 1].push(C);
          break;
        case 24:
        case 536:
          R = {
            Name: C.Name,
            Ref: Ze(C.rgce, s, null, V, L)
          }, C.itab > 0 && (R.Sheet = C.itab - 1), V.names.push(R), V[0] || (V[0] = [], V[0].XTI = []), V[V.length - 1].push(C), C.Name == "_xlnm._FilterDatabase" && C.itab > 0 && C.rgce && C.rgce[0] && C.rgce[0][0] && C.rgce[0][0][0] == "PtgArea3d" && (N[C.itab - 1] = { ref: _e(C.rgce[0][0][1][2]) });
          break;
        case 22:
          L.ExternCount = C;
          break;
        case 23:
          V.length == 0 && (V[0] = [], V[0].XTI = []), V[V.length - 1].XTI = V[V.length - 1].XTI.concat(C), V.XTI = V.XTI.concat(C);
          break;
        case 2196:
          if (L.biff < 8) break;
          R != null && (R.Comment = C[1]);
          break;
        case 18:
          n["!protect"] = C;
          break;
        case 19:
          C !== 0 && L.WTF && console.error("Password verifier: " + C);
          break;
        case 133:
          i[C.pos] = C, L.snames.push(C.name);
          break;
        case 10:
          {
            if (--ue) break;
            if (s.e) {
              if (s.e.r > 0 && s.e.c > 0) {
                if (s.e.r--, s.e.c--, n["!ref"] = _e(s), a.sheetRows && a.sheetRows <= s.e.r) {
                  var we = s.e.r;
                  s.e.r = a.sheetRows - 1, n["!fullref"] = n["!ref"], n["!ref"] = _e(s), s.e.r = we;
                }
                s.e.r++, s.e.c++;
              }
              fe.length > 0 && (n["!merges"] = fe), re.length > 0 && (n["!objects"] = re), ce.length > 0 && (n["!cols"] = ce), se.length > 0 && (n["!rows"] = se), F.Sheets.push(W);
            }
            o === "" ? l = n : t[o] = n, n = a.dense ? [] : {};
          }
          break;
        case 9:
        case 521:
        case 1033:
        case 2057:
          {
            if (L.biff === 8 && (L.biff = {
              /*::[*/
              9: 2,
              /*::[*/
              521: 3,
              /*::[*/
              1033: 4
            }[ne] || {
              /*::[*/
              512: 2,
              /*::[*/
              768: 3,
              /*::[*/
              1024: 4,
              /*::[*/
              1280: 5,
              /*::[*/
              1536: 8,
              /*::[*/
              2: 2,
              /*::[*/
              7: 2
            }[C.BIFFVer] || 8), L.biffguess = C.BIFFVer == 0, C.BIFFVer == 0 && C.dt == 4096 && (L.biff = 5, Y = !0, Ar(L.codepage = 28591)), L.biff == 8 && C.BIFFVer == 0 && C.dt == 16 && (L.biff = 2), ue++) break;
            if (n = a.dense ? [] : {}, L.biff < 8 && !Y && (Y = !0, Ar(L.codepage = a.codepage || 1252)), L.biff < 5 || C.BIFFVer == 0 && C.dt == 4096) {
              o === "" && (o = "Sheet1"), s = { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
              var Ae = { pos: e.l - q, name: o };
              i[Ae.pos] = Ae, L.snames.push(o);
            } else o = (i[ee] || { name: "" }).name;
            C.dt == 32 && (n["!type"] = "chart"), C.dt == 64 && (n["!type"] = "macro"), fe = [], re = [], L.arrayf = y = [], ce = [], se = [], Se = !1, W = { Hidden: (i[ee] || { hs: 0 }).hs, name: o };
          }
          break;
        case 515:
        case 3:
        case 2:
          n["!type"] == "chart" && (a.dense ? (n[C.r] || [])[C.c] : n[he({ c: C.c, r: C.r })]) && ++C.c, E = { ixfe: C.ixfe, XF: b[C.ixfe] || {}, v: C.val, t: "n" }, S > 0 && (E.z = U[E.ixfe >> 8 & 63]), Dr(E, a, r.opts.Date1904), G({ c: C.c, r: C.r }, E, a);
          break;
        case 5:
        case 517:
          E = { ixfe: C.ixfe, XF: b[C.ixfe], v: C.val, t: C.t }, S > 0 && (E.z = U[E.ixfe >> 8 & 63]), Dr(E, a, r.opts.Date1904), G({ c: C.c, r: C.r }, E, a);
          break;
        case 638:
          E = { ixfe: C.ixfe, XF: b[C.ixfe], v: C.rknum, t: "n" }, S > 0 && (E.z = U[E.ixfe >> 8 & 63]), Dr(E, a, r.opts.Date1904), G({ c: C.c, r: C.r }, E, a);
          break;
        case 189:
          for (var me = C.c; me <= C.C; ++me) {
            var ae = C.rkrec[me - C.c][0];
            E = { ixfe: ae, XF: b[ae], v: C.rkrec[me - C.c][1], t: "n" }, S > 0 && (E.z = U[E.ixfe >> 8 & 63]), Dr(E, a, r.opts.Date1904), G({ c: me, r: C.r }, E, a);
          }
          break;
        case 6:
        case 518:
        case 1030:
          {
            if (C.val == "String") {
              c = C;
              break;
            }
            if (E = mt(C.val, C.cell.ixfe, C.tt), E.XF = b[E.ixfe], a.cellFormula) {
              var Le = C.formula;
              if (Le && Le[0] && Le[0][0] && Le[0][0][0] == "PtgExp") {
                var dr = Le[0][0][1][0], Cr = Le[0][0][1][1], Lr = he({ r: dr, c: Cr });
                A[Lr] ? E.f = "" + Ze(C.formula, s, C.cell, V, L) : E.F = ((a.dense ? (n[dr] || [])[Cr] : n[Lr]) || {}).F;
              } else E.f = "" + Ze(C.formula, s, C.cell, V, L);
            }
            S > 0 && (E.z = U[E.ixfe >> 8 & 63]), Dr(E, a, r.opts.Date1904), G(C.cell, E, a), c = C;
          }
          break;
        case 7:
        case 519:
          if (c)
            c.val = C, E = mt(C, c.cell.ixfe, "s"), E.XF = b[E.ixfe], a.cellFormula && (E.f = "" + Ze(c.formula, s, c.cell, V, L)), S > 0 && (E.z = U[E.ixfe >> 8 & 63]), Dr(E, a, r.opts.Date1904), G(c.cell, E, a), c = null;
          else throw new Error("String record expects Formula");
          break;
        case 33:
        case 545:
          {
            y.push(C);
            var Da = he(C[0].s);
            if (d = a.dense ? (n[C[0].s.r] || [])[C[0].s.c] : n[Da], a.cellFormula && d) {
              if (!c || !Da || !d) break;
              d.f = "" + Ze(C[1], s, C[0], V, L), d.F = _e(C[0]);
            }
          }
          break;
        case 1212:
          {
            if (!a.cellFormula) break;
            if (x) {
              if (!c) break;
              A[he(c.cell)] = C[0], d = a.dense ? (n[c.cell.r] || [])[c.cell.c] : n[he(c.cell)], (d || {}).f = "" + Ze(C[0], s, u, V, L);
            }
          }
          break;
        case 253:
          E = mt(f[C.isst].t, C.ixfe, "s"), f[C.isst].h && (E.h = f[C.isst].h), E.XF = b[E.ixfe], S > 0 && (E.z = U[E.ixfe >> 8 & 63]), Dr(E, a, r.opts.Date1904), G({ c: C.c, r: C.r }, E, a);
          break;
        case 513:
          a.sheetStubs && (E = { ixfe: C.ixfe, XF: b[C.ixfe], t: "z" }, S > 0 && (E.z = U[E.ixfe >> 8 & 63]), Dr(E, a, r.opts.Date1904), G({ c: C.c, r: C.r }, E, a));
          break;
        case 190:
          if (a.sheetStubs)
            for (var Gr = C.c; Gr <= C.C; ++Gr) {
              var lr = C.ixfe[Gr - C.c];
              E = { ixfe: lr, XF: b[lr], t: "z" }, S > 0 && (E.z = U[E.ixfe >> 8 & 63]), Dr(E, a, r.opts.Date1904), G({ c: Gr, r: C.r }, E, a);
            }
          break;
        case 214:
        case 516:
        case 4:
          E = mt(C.val, C.ixfe, "s"), E.XF = b[E.ixfe], S > 0 && (E.z = U[E.ixfe >> 8 & 63]), Dr(E, a, r.opts.Date1904), G({ c: C.c, r: C.r }, E, a);
          break;
        case 0:
        case 512:
          ue === 1 && (s = C);
          break;
        case 252:
          f = C;
          break;
        case 1054:
          if (L.biff == 4) {
            U[S++] = C[1];
            for (var Pr = 0; Pr < S + 163 && de[Pr] != C[1]; ++Pr) ;
            Pr >= 163 && ia(C[1], S + 163);
          } else ia(C[1], C[0]);
          break;
        case 30:
          {
            U[S++] = C;
            for (var Xr = 0; Xr < S + 163 && de[Xr] != C; ++Xr) ;
            Xr >= 163 && ia(C, S + 163);
          }
          break;
        case 229:
          fe = fe.concat(C);
          break;
        case 93:
          re[C.cmo[0]] = L.lastobj = C;
          break;
        case 438:
          L.lastobj.TxO = C;
          break;
        case 127:
          L.lastobj.ImData = C;
          break;
        case 440:
          for (m = C[0].s.r; m <= C[0].e.r; ++m)
            for (h = C[0].s.c; h <= C[0].e.c; ++h)
              d = a.dense ? (n[m] || [])[h] : n[he({ c: h, r: m })], d && (d.l = C[1]);
          break;
        case 2048:
          for (m = C[0].s.r; m <= C[0].e.r; ++m)
            for (h = C[0].s.c; h <= C[0].e.c; ++h)
              d = a.dense ? (n[m] || [])[h] : n[he({ c: h, r: m })], d && d.l && (d.l.Tooltip = C[1]);
          break;
        case 28:
          {
            if (L.biff <= 5 && L.biff >= 2) break;
            d = a.dense ? (n[C[0].r] || [])[C[0].c] : n[he(C[0])];
            var Ra = re[C[2]];
            d || (a.dense ? (n[C[0].r] || (n[C[0].r] = []), d = n[C[0].r][C[0].c] = { t: "z" }) : d = n[he(C[0])] = { t: "z" }, s.e.r = Math.max(s.e.r, C[0].r), s.s.r = Math.min(s.s.r, C[0].r), s.e.c = Math.max(s.e.c, C[0].c), s.s.c = Math.min(s.s.c, C[0].c)), d.c || (d.c = []), p = { a: C[1], t: Ra.TxO.t }, d.c.push(p);
          }
          break;
        case 2173:
          U1(b[C.ixfe], C.ext);
          break;
        case 125:
          {
            if (!L.cellStyles) break;
            for (; C.e >= C.s; )
              ce[C.e--] = { width: C.w / 256, level: C.level || 0, hidden: !!(C.flags & 1) }, Se || (Se = !0, A0(C.w / 256)), Fa(ce[C.e + 1]);
          }
          break;
        case 520:
          {
            var tr = {};
            C.level != null && (se[C.r] = tr, tr.level = C.level), C.hidden && (se[C.r] = tr, tr.hidden = !0), C.hpt && (se[C.r] = tr, tr.hpt = C.hpt, tr.hpx = Qa(C.hpt));
          }
          break;
        case 38:
        case 39:
        case 40:
        case 41:
          n["!margins"] || za(n["!margins"] = {}), n["!margins"][{ 38: "left", 39: "right", 40: "top", 41: "bottom" }[ne]] = C;
          break;
        case 161:
          n["!margins"] || za(n["!margins"] = {}), n["!margins"].header = C.header, n["!margins"].footer = C.footer;
          break;
        case 574:
          C.RTL && (F.Views[0].RTL = !0);
          break;
        case 146:
          O = C;
          break;
        case 2198:
          J = C;
          break;
        case 140:
          I = C;
          break;
        case 442:
          o ? W.CodeName = C || W.name : F.WBProps.CodeName = C || "ThisWorkbook";
          break;
      }
    } else
      j || console.error("Missing Info for XLS Record 0x" + ne.toString(16)), e.l += q;
  }
  return r.SheetNames = Or(i).sort(function(yr, ve) {
    return Number(yr) - Number(ve);
  }).map(function(yr) {
    return i[yr].name;
  }), a.bookSheets || (r.Sheets = t), !r.SheetNames.length && l["!ref"] ? (r.SheetNames.push("Sheet1"), r.Sheets && (r.Sheets.Sheet1 = l)) : r.Preamble = l, r.Sheets && N.forEach(function(yr, ve) {
    r.Sheets[r.SheetNames[ve]]["!autofilter"] = yr;
  }), r.Strings = f, r.SSF = Ye(de), L.enc && (r.Encryption = L.enc), J && (r.Themes = J), r.Metadata = {}, I !== void 0 && (r.Metadata.Country = I), V.names.length > 0 && (F.Names = V.names), r.Workbook = F, r;
}
var Nn = {
  SI: "e0859ff2f94f6810ab9108002b27b3d9",
  DSI: "02d5cdd59c2e1b10939708002b2cf9ae",
  UDI: "05d5cdd59c2e1b10939708002b2cf9ae"
};
function gd(e, a, r) {
  var t = Ee.find(e, "/!DocumentSummaryInformation");
  if (t && t.size > 0) try {
    var n = pn(t, Lf, Nn.DSI);
    for (var i in n) a[i] = n[i];
  } catch (o) {
    if (r.WTF) throw o;
  }
  var s = Ee.find(e, "/!SummaryInformation");
  if (s && s.size > 0) try {
    var c = pn(s, Pf, Nn.SI);
    for (var f in c) a[f] == null && (a[f] = c[f]);
  } catch (o) {
    if (r.WTF) throw o;
  }
  a.HeadingPairs && a.TitlesOfParts && (Pi(a.HeadingPairs, a.TitlesOfParts, a, r), delete a.HeadingPairs, delete a.TitlesOfParts);
}
function gs(e, a) {
  a || (a = {}), D0(a), Yn(), a.codepage && c0(a.codepage);
  var r, t;
  if (e.FullPaths) {
    if (Ee.find(e, "/encryption")) throw new Error("File is password-protected");
    r = Ee.find(e, "!CompObj"), t = Ee.find(e, "/Workbook") || Ee.find(e, "/Book");
  } else {
    switch (a.type) {
      case "base64":
        e = wr(xr(e));
        break;
      case "binary":
        e = wr(e);
        break;
      case "buffer":
        break;
      case "array":
        Array.isArray(e) || (e = Array.prototype.slice.call(e));
        break;
    }
    $e(e, 0), t = { content: e };
  }
  var n, i;
  if (r && dd(r), a.bookProps && !a.bookSheets) n = {};
  else {
    var s = ge ? "buffer" : "array";
    if (t && t.content) n = md(t.content, a);
    else if ((i = Ee.find(e, "PerfectOffice_MAIN")) && i.content) n = Ga.to_workbook(i.content, (a.type = s, a));
    else if ((i = Ee.find(e, "NativeContent_MAIN")) && i.content) n = Ga.to_workbook(i.content, (a.type = s, a));
    else throw (i = Ee.find(e, "MN0")) && i.content ? new Error("Unsupported Works 4 for Mac file") : new Error("Cannot find Workbook stream");
    a.bookVBA && e.FullPaths && Ee.find(e, "/_VBA_PROJECT_CUR/VBA/dir") && (n.vbaraw = tu(e));
  }
  var c = {};
  return e.FullPaths && gd(
    /*::((*/
    e,
    c,
    a
  ), n.Props = n.Custprops = c, a.bookFiles && (n.cfb = e), n;
}
var Rt = {
  /*::[*/
  0: {
    /* n:"BrtRowHdr", */
    f: Qh
  },
  /*::[*/
  1: {
    /* n:"BrtCellBlank", */
    f: tx
  },
  /*::[*/
  2: {
    /* n:"BrtCellRk", */
    f: hx
  },
  /*::[*/
  3: {
    /* n:"BrtCellError", */
    f: cx
  },
  /*::[*/
  4: {
    /* n:"BrtCellBool", */
    f: ix
  },
  /*::[*/
  5: {
    /* n:"BrtCellReal", */
    f: ux
  },
  /*::[*/
  6: {
    /* n:"BrtCellSt", */
    f: px
  },
  /*::[*/
  7: {
    /* n:"BrtCellIsst", */
    f: ox
  },
  /*::[*/
  8: {
    /* n:"BrtFmlaString", */
    f: _x
  },
  /*::[*/
  9: {
    /* n:"BrtFmlaNum", */
    f: Ex
  },
  /*::[*/
  10: {
    /* n:"BrtFmlaBool", */
    f: mx
  },
  /*::[*/
  11: {
    /* n:"BrtFmlaError", */
    f: gx
  },
  /*::[*/
  12: {
    /* n:"BrtShortBlank", */
    f: nx
  },
  /*::[*/
  13: {
    /* n:"BrtShortRk", */
    f: xx
  },
  /*::[*/
  14: {
    /* n:"BrtShortError", */
    f: fx
  },
  /*::[*/
  15: {
    /* n:"BrtShortBool", */
    f: sx
  },
  /*::[*/
  16: {
    /* n:"BrtShortReal", */
    f: xs
  },
  /*::[*/
  17: {
    /* n:"BrtShortSt", */
    f: vx
  },
  /*::[*/
  18: {
    /* n:"BrtShortIsst", */
    f: lx
  },
  /*::[*/
  19: {
    /* n:"BrtSSTItem", */
    f: g0
  },
  /*::[*/
  20: {
    /* n:"BrtPCDIMissing" */
  },
  /*::[*/
  21: {
    /* n:"BrtPCDINumber" */
  },
  /*::[*/
  22: {
    /* n:"BrtPCDIBoolean" */
  },
  /*::[*/
  23: {
    /* n:"BrtPCDIError" */
  },
  /*::[*/
  24: {
    /* n:"BrtPCDIString" */
  },
  /*::[*/
  25: {
    /* n:"BrtPCDIDatetime" */
  },
  /*::[*/
  26: {
    /* n:"BrtPCDIIndex" */
  },
  /*::[*/
  27: {
    /* n:"BrtPCDIAMissing" */
  },
  /*::[*/
  28: {
    /* n:"BrtPCDIANumber" */
  },
  /*::[*/
  29: {
    /* n:"BrtPCDIABoolean" */
  },
  /*::[*/
  30: {
    /* n:"BrtPCDIAError" */
  },
  /*::[*/
  31: {
    /* n:"BrtPCDIAString" */
  },
  /*::[*/
  32: {
    /* n:"BrtPCDIADatetime" */
  },
  /*::[*/
  33: {
    /* n:"BrtPCRRecord" */
  },
  /*::[*/
  34: {
    /* n:"BrtPCRRecordDt" */
  },
  /*::[*/
  35: {
    /* n:"BrtFRTBegin", */
    T: 1
  },
  /*::[*/
  36: {
    /* n:"BrtFRTEnd", */
    T: -1
  },
  /*::[*/
  37: {
    /* n:"BrtACBegin", */
    T: 1
  },
  /*::[*/
  38: {
    /* n:"BrtACEnd", */
    T: -1
  },
  /*::[*/
  39: {
    /* n:"BrtName", */
    f: Yx
  },
  /*::[*/
  40: {
    /* n:"BrtIndexRowBlock" */
  },
  /*::[*/
  42: {
    /* n:"BrtIndexBlock" */
  },
  /*::[*/
  43: {
    /* n:"BrtFont", */
    f: m1
  },
  /*::[*/
  44: {
    /* n:"BrtFmt", */
    f: v1
  },
  /*::[*/
  45: {
    /* n:"BrtFill", */
    f: g1
  },
  /*::[*/
  46: {
    /* n:"BrtBorder", */
    f: _1
  },
  /*::[*/
  47: {
    /* n:"BrtXF", */
    f: E1
  },
  /*::[*/
  48: {
    /* n:"BrtStyle" */
  },
  /*::[*/
  49: {
    /* n:"BrtCellMeta", */
    f: _f
  },
  /*::[*/
  50: {
    /* n:"BrtValueMeta" */
  },
  /*::[*/
  51: {
    /* n:"BrtMdb" */
    f: W1
  },
  /*::[*/
  52: {
    /* n:"BrtBeginFmd", */
    T: 1
  },
  /*::[*/
  53: {
    /* n:"BrtEndFmd", */
    T: -1
  },
  /*::[*/
  54: {
    /* n:"BrtBeginMdx", */
    T: 1
  },
  /*::[*/
  55: {
    /* n:"BrtEndMdx", */
    T: -1
  },
  /*::[*/
  56: {
    /* n:"BrtBeginMdxTuple", */
    T: 1
  },
  /*::[*/
  57: {
    /* n:"BrtEndMdxTuple", */
    T: -1
  },
  /*::[*/
  58: {
    /* n:"BrtMdxMbrIstr" */
  },
  /*::[*/
  59: {
    /* n:"BrtStr" */
  },
  /*::[*/
  60: {
    /* n:"BrtColInfo", */
    f: Yi
  },
  /*::[*/
  62: {
    /* n:"BrtCellRString", */
    f: dx
  },
  /*::[*/
  63: {
    /* n:"BrtCalcChainItem$", */
    f: $1
  },
  /*::[*/
  64: {
    /* n:"BrtDVal", */
    f: Dx
  },
  /*::[*/
  65: {
    /* n:"BrtSxvcellNum" */
  },
  /*::[*/
  66: {
    /* n:"BrtSxvcellStr" */
  },
  /*::[*/
  67: {
    /* n:"BrtSxvcellBool" */
  },
  /*::[*/
  68: {
    /* n:"BrtSxvcellErr" */
  },
  /*::[*/
  69: {
    /* n:"BrtSxvcellDate" */
  },
  /*::[*/
  70: {
    /* n:"BrtSxvcellNil" */
  },
  /*::[*/
  128: {
    /* n:"BrtFileVersion" */
  },
  /*::[*/
  129: {
    /* n:"BrtBeginSheet", */
    T: 1
  },
  /*::[*/
  130: {
    /* n:"BrtEndSheet", */
    T: -1
  },
  /*::[*/
  131: {
    /* n:"BrtBeginBook", */
    T: 1,
    f: rr,
    p: 0
  },
  /*::[*/
  132: {
    /* n:"BrtEndBook", */
    T: -1
  },
  /*::[*/
  133: {
    /* n:"BrtBeginWsViews", */
    T: 1
  },
  /*::[*/
  134: {
    /* n:"BrtEndWsViews", */
    T: -1
  },
  /*::[*/
  135: {
    /* n:"BrtBeginBookViews", */
    T: 1
  },
  /*::[*/
  136: {
    /* n:"BrtEndBookViews", */
    T: -1
  },
  /*::[*/
  137: {
    /* n:"BrtBeginWsView", */
    T: 1,
    f: yx
  },
  /*::[*/
  138: {
    /* n:"BrtEndWsView", */
    T: -1
  },
  /*::[*/
  139: {
    /* n:"BrtBeginCsViews", */
    T: 1
  },
  /*::[*/
  140: {
    /* n:"BrtEndCsViews", */
    T: -1
  },
  /*::[*/
  141: {
    /* n:"BrtBeginCsView", */
    T: 1
  },
  /*::[*/
  142: {
    /* n:"BrtEndCsView", */
    T: -1
  },
  /*::[*/
  143: {
    /* n:"BrtBeginBundleShs", */
    T: 1
  },
  /*::[*/
  144: {
    /* n:"BrtEndBundleShs", */
    T: -1
  },
  /*::[*/
  145: {
    /* n:"BrtBeginSheetData", */
    T: 1
  },
  /*::[*/
  146: {
    /* n:"BrtEndSheetData", */
    T: -1
  },
  /*::[*/
  147: {
    /* n:"BrtWsProp", */
    f: ax
  },
  /*::[*/
  148: {
    /* n:"BrtWsDim", */
    f: ex,
    p: 16
  },
  /*::[*/
  151: {
    /* n:"BrtPane", */
    f: wx
  },
  /*::[*/
  152: {
    /* n:"BrtSel" */
  },
  /*::[*/
  153: {
    /* n:"BrtWbProp", */
    f: zx
  },
  /*::[*/
  154: {
    /* n:"BrtWbFactoid" */
  },
  /*::[*/
  155: {
    /* n:"BrtFileRecover" */
  },
  /*::[*/
  156: {
    /* n:"BrtBundleSh", */
    f: Xx
  },
  /*::[*/
  157: {
    /* n:"BrtCalcProp" */
  },
  /*::[*/
  158: {
    /* n:"BrtBookView" */
  },
  /*::[*/
  159: {
    /* n:"BrtBeginSst", */
    T: 1,
    f: Ml
  },
  /*::[*/
  160: {
    /* n:"BrtEndSst", */
    T: -1
  },
  /*::[*/
  161: {
    /* n:"BrtBeginAFilter", */
    T: 1,
    f: da
  },
  /*::[*/
  162: {
    /* n:"BrtEndAFilter", */
    T: -1
  },
  /*::[*/
  163: {
    /* n:"BrtBeginFilterColumn", */
    T: 1
  },
  /*::[*/
  164: {
    /* n:"BrtEndFilterColumn", */
    T: -1
  },
  /*::[*/
  165: {
    /* n:"BrtBeginFilters", */
    T: 1
  },
  /*::[*/
  166: {
    /* n:"BrtEndFilters", */
    T: -1
  },
  /*::[*/
  167: {
    /* n:"BrtFilter" */
  },
  /*::[*/
  168: {
    /* n:"BrtColorFilter" */
  },
  /*::[*/
  169: {
    /* n:"BrtIconFilter" */
  },
  /*::[*/
  170: {
    /* n:"BrtTop10Filter" */
  },
  /*::[*/
  171: {
    /* n:"BrtDynamicFilter" */
  },
  /*::[*/
  172: {
    /* n:"BrtBeginCustomFilters", */
    T: 1
  },
  /*::[*/
  173: {
    /* n:"BrtEndCustomFilters", */
    T: -1
  },
  /*::[*/
  174: {
    /* n:"BrtCustomFilter" */
  },
  /*::[*/
  175: {
    /* n:"BrtAFilterDateGroupItem" */
  },
  /*::[*/
  176: {
    /* n:"BrtMergeCell", */
    f: Tx
  },
  /*::[*/
  177: {
    /* n:"BrtBeginMergeCells", */
    T: 1
  },
  /*::[*/
  178: {
    /* n:"BrtEndMergeCells", */
    T: -1
  },
  /*::[*/
  179: {
    /* n:"BrtBeginPivotCacheDef", */
    T: 1
  },
  /*::[*/
  180: {
    /* n:"BrtEndPivotCacheDef", */
    T: -1
  },
  /*::[*/
  181: {
    /* n:"BrtBeginPCDFields", */
    T: 1
  },
  /*::[*/
  182: {
    /* n:"BrtEndPCDFields", */
    T: -1
  },
  /*::[*/
  183: {
    /* n:"BrtBeginPCDField", */
    T: 1
  },
  /*::[*/
  184: {
    /* n:"BrtEndPCDField", */
    T: -1
  },
  /*::[*/
  185: {
    /* n:"BrtBeginPCDSource", */
    T: 1
  },
  /*::[*/
  186: {
    /* n:"BrtEndPCDSource", */
    T: -1
  },
  /*::[*/
  187: {
    /* n:"BrtBeginPCDSRange", */
    T: 1
  },
  /*::[*/
  188: {
    /* n:"BrtEndPCDSRange", */
    T: -1
  },
  /*::[*/
  189: {
    /* n:"BrtBeginPCDFAtbl", */
    T: 1
  },
  /*::[*/
  190: {
    /* n:"BrtEndPCDFAtbl", */
    T: -1
  },
  /*::[*/
  191: {
    /* n:"BrtBeginPCDIRun", */
    T: 1
  },
  /*::[*/
  192: {
    /* n:"BrtEndPCDIRun", */
    T: -1
  },
  /*::[*/
  193: {
    /* n:"BrtBeginPivotCacheRecords", */
    T: 1
  },
  /*::[*/
  194: {
    /* n:"BrtEndPivotCacheRecords", */
    T: -1
  },
  /*::[*/
  195: {
    /* n:"BrtBeginPCDHierarchies", */
    T: 1
  },
  /*::[*/
  196: {
    /* n:"BrtEndPCDHierarchies", */
    T: -1
  },
  /*::[*/
  197: {
    /* n:"BrtBeginPCDHierarchy", */
    T: 1
  },
  /*::[*/
  198: {
    /* n:"BrtEndPCDHierarchy", */
    T: -1
  },
  /*::[*/
  199: {
    /* n:"BrtBeginPCDHFieldsUsage", */
    T: 1
  },
  /*::[*/
  200: {
    /* n:"BrtEndPCDHFieldsUsage", */
    T: -1
  },
  /*::[*/
  201: {
    /* n:"BrtBeginExtConnection", */
    T: 1
  },
  /*::[*/
  202: {
    /* n:"BrtEndExtConnection", */
    T: -1
  },
  /*::[*/
  203: {
    /* n:"BrtBeginECDbProps", */
    T: 1
  },
  /*::[*/
  204: {
    /* n:"BrtEndECDbProps", */
    T: -1
  },
  /*::[*/
  205: {
    /* n:"BrtBeginECOlapProps", */
    T: 1
  },
  /*::[*/
  206: {
    /* n:"BrtEndECOlapProps", */
    T: -1
  },
  /*::[*/
  207: {
    /* n:"BrtBeginPCDSConsol", */
    T: 1
  },
  /*::[*/
  208: {
    /* n:"BrtEndPCDSConsol", */
    T: -1
  },
  /*::[*/
  209: {
    /* n:"BrtBeginPCDSCPages", */
    T: 1
  },
  /*::[*/
  210: {
    /* n:"BrtEndPCDSCPages", */
    T: -1
  },
  /*::[*/
  211: {
    /* n:"BrtBeginPCDSCPage", */
    T: 1
  },
  /*::[*/
  212: {
    /* n:"BrtEndPCDSCPage", */
    T: -1
  },
  /*::[*/
  213: {
    /* n:"BrtBeginPCDSCPItem", */
    T: 1
  },
  /*::[*/
  214: {
    /* n:"BrtEndPCDSCPItem", */
    T: -1
  },
  /*::[*/
  215: {
    /* n:"BrtBeginPCDSCSets", */
    T: 1
  },
  /*::[*/
  216: {
    /* n:"BrtEndPCDSCSets", */
    T: -1
  },
  /*::[*/
  217: {
    /* n:"BrtBeginPCDSCSet", */
    T: 1
  },
  /*::[*/
  218: {
    /* n:"BrtEndPCDSCSet", */
    T: -1
  },
  /*::[*/
  219: {
    /* n:"BrtBeginPCDFGroup", */
    T: 1
  },
  /*::[*/
  220: {
    /* n:"BrtEndPCDFGroup", */
    T: -1
  },
  /*::[*/
  221: {
    /* n:"BrtBeginPCDFGItems", */
    T: 1
  },
  /*::[*/
  222: {
    /* n:"BrtEndPCDFGItems", */
    T: -1
  },
  /*::[*/
  223: {
    /* n:"BrtBeginPCDFGRange", */
    T: 1
  },
  /*::[*/
  224: {
    /* n:"BrtEndPCDFGRange", */
    T: -1
  },
  /*::[*/
  225: {
    /* n:"BrtBeginPCDFGDiscrete", */
    T: 1
  },
  /*::[*/
  226: {
    /* n:"BrtEndPCDFGDiscrete", */
    T: -1
  },
  /*::[*/
  227: {
    /* n:"BrtBeginPCDSDTupleCache", */
    T: 1
  },
  /*::[*/
  228: {
    /* n:"BrtEndPCDSDTupleCache", */
    T: -1
  },
  /*::[*/
  229: {
    /* n:"BrtBeginPCDSDTCEntries", */
    T: 1
  },
  /*::[*/
  230: {
    /* n:"BrtEndPCDSDTCEntries", */
    T: -1
  },
  /*::[*/
  231: {
    /* n:"BrtBeginPCDSDTCEMembers", */
    T: 1
  },
  /*::[*/
  232: {
    /* n:"BrtEndPCDSDTCEMembers", */
    T: -1
  },
  /*::[*/
  233: {
    /* n:"BrtBeginPCDSDTCEMember", */
    T: 1
  },
  /*::[*/
  234: {
    /* n:"BrtEndPCDSDTCEMember", */
    T: -1
  },
  /*::[*/
  235: {
    /* n:"BrtBeginPCDSDTCQueries", */
    T: 1
  },
  /*::[*/
  236: {
    /* n:"BrtEndPCDSDTCQueries", */
    T: -1
  },
  /*::[*/
  237: {
    /* n:"BrtBeginPCDSDTCQuery", */
    T: 1
  },
  /*::[*/
  238: {
    /* n:"BrtEndPCDSDTCQuery", */
    T: -1
  },
  /*::[*/
  239: {
    /* n:"BrtBeginPCDSDTCSets", */
    T: 1
  },
  /*::[*/
  240: {
    /* n:"BrtEndPCDSDTCSets", */
    T: -1
  },
  /*::[*/
  241: {
    /* n:"BrtBeginPCDSDTCSet", */
    T: 1
  },
  /*::[*/
  242: {
    /* n:"BrtEndPCDSDTCSet", */
    T: -1
  },
  /*::[*/
  243: {
    /* n:"BrtBeginPCDCalcItems", */
    T: 1
  },
  /*::[*/
  244: {
    /* n:"BrtEndPCDCalcItems", */
    T: -1
  },
  /*::[*/
  245: {
    /* n:"BrtBeginPCDCalcItem", */
    T: 1
  },
  /*::[*/
  246: {
    /* n:"BrtEndPCDCalcItem", */
    T: -1
  },
  /*::[*/
  247: {
    /* n:"BrtBeginPRule", */
    T: 1
  },
  /*::[*/
  248: {
    /* n:"BrtEndPRule", */
    T: -1
  },
  /*::[*/
  249: {
    /* n:"BrtBeginPRFilters", */
    T: 1
  },
  /*::[*/
  250: {
    /* n:"BrtEndPRFilters", */
    T: -1
  },
  /*::[*/
  251: {
    /* n:"BrtBeginPRFilter", */
    T: 1
  },
  /*::[*/
  252: {
    /* n:"BrtEndPRFilter", */
    T: -1
  },
  /*::[*/
  253: {
    /* n:"BrtBeginPNames", */
    T: 1
  },
  /*::[*/
  254: {
    /* n:"BrtEndPNames", */
    T: -1
  },
  /*::[*/
  255: {
    /* n:"BrtBeginPName", */
    T: 1
  },
  /*::[*/
  256: {
    /* n:"BrtEndPName", */
    T: -1
  },
  /*::[*/
  257: {
    /* n:"BrtBeginPNPairs", */
    T: 1
  },
  /*::[*/
  258: {
    /* n:"BrtEndPNPairs", */
    T: -1
  },
  /*::[*/
  259: {
    /* n:"BrtBeginPNPair", */
    T: 1
  },
  /*::[*/
  260: {
    /* n:"BrtEndPNPair", */
    T: -1
  },
  /*::[*/
  261: {
    /* n:"BrtBeginECWebProps", */
    T: 1
  },
  /*::[*/
  262: {
    /* n:"BrtEndECWebProps", */
    T: -1
  },
  /*::[*/
  263: {
    /* n:"BrtBeginEcWpTables", */
    T: 1
  },
  /*::[*/
  264: {
    /* n:"BrtEndECWPTables", */
    T: -1
  },
  /*::[*/
  265: {
    /* n:"BrtBeginECParams", */
    T: 1
  },
  /*::[*/
  266: {
    /* n:"BrtEndECParams", */
    T: -1
  },
  /*::[*/
  267: {
    /* n:"BrtBeginECParam", */
    T: 1
  },
  /*::[*/
  268: {
    /* n:"BrtEndECParam", */
    T: -1
  },
  /*::[*/
  269: {
    /* n:"BrtBeginPCDKPIs", */
    T: 1
  },
  /*::[*/
  270: {
    /* n:"BrtEndPCDKPIs", */
    T: -1
  },
  /*::[*/
  271: {
    /* n:"BrtBeginPCDKPI", */
    T: 1
  },
  /*::[*/
  272: {
    /* n:"BrtEndPCDKPI", */
    T: -1
  },
  /*::[*/
  273: {
    /* n:"BrtBeginDims", */
    T: 1
  },
  /*::[*/
  274: {
    /* n:"BrtEndDims", */
    T: -1
  },
  /*::[*/
  275: {
    /* n:"BrtBeginDim", */
    T: 1
  },
  /*::[*/
  276: {
    /* n:"BrtEndDim", */
    T: -1
  },
  /*::[*/
  277: {
    /* n:"BrtIndexPartEnd" */
  },
  /*::[*/
  278: {
    /* n:"BrtBeginStyleSheet", */
    T: 1
  },
  /*::[*/
  279: {
    /* n:"BrtEndStyleSheet", */
    T: -1
  },
  /*::[*/
  280: {
    /* n:"BrtBeginSXView", */
    T: 1
  },
  /*::[*/
  281: {
    /* n:"BrtEndSXVI", */
    T: -1
  },
  /*::[*/
  282: {
    /* n:"BrtBeginSXVI", */
    T: 1
  },
  /*::[*/
  283: {
    /* n:"BrtBeginSXVIs", */
    T: 1
  },
  /*::[*/
  284: {
    /* n:"BrtEndSXVIs", */
    T: -1
  },
  /*::[*/
  285: {
    /* n:"BrtBeginSXVD", */
    T: 1
  },
  /*::[*/
  286: {
    /* n:"BrtEndSXVD", */
    T: -1
  },
  /*::[*/
  287: {
    /* n:"BrtBeginSXVDs", */
    T: 1
  },
  /*::[*/
  288: {
    /* n:"BrtEndSXVDs", */
    T: -1
  },
  /*::[*/
  289: {
    /* n:"BrtBeginSXPI", */
    T: 1
  },
  /*::[*/
  290: {
    /* n:"BrtEndSXPI", */
    T: -1
  },
  /*::[*/
  291: {
    /* n:"BrtBeginSXPIs", */
    T: 1
  },
  /*::[*/
  292: {
    /* n:"BrtEndSXPIs", */
    T: -1
  },
  /*::[*/
  293: {
    /* n:"BrtBeginSXDI", */
    T: 1
  },
  /*::[*/
  294: {
    /* n:"BrtEndSXDI", */
    T: -1
  },
  /*::[*/
  295: {
    /* n:"BrtBeginSXDIs", */
    T: 1
  },
  /*::[*/
  296: {
    /* n:"BrtEndSXDIs", */
    T: -1
  },
  /*::[*/
  297: {
    /* n:"BrtBeginSXLI", */
    T: 1
  },
  /*::[*/
  298: {
    /* n:"BrtEndSXLI", */
    T: -1
  },
  /*::[*/
  299: {
    /* n:"BrtBeginSXLIRws", */
    T: 1
  },
  /*::[*/
  300: {
    /* n:"BrtEndSXLIRws", */
    T: -1
  },
  /*::[*/
  301: {
    /* n:"BrtBeginSXLICols", */
    T: 1
  },
  /*::[*/
  302: {
    /* n:"BrtEndSXLICols", */
    T: -1
  },
  /*::[*/
  303: {
    /* n:"BrtBeginSXFormat", */
    T: 1
  },
  /*::[*/
  304: {
    /* n:"BrtEndSXFormat", */
    T: -1
  },
  /*::[*/
  305: {
    /* n:"BrtBeginSXFormats", */
    T: 1
  },
  /*::[*/
  306: {
    /* n:"BrtEndSxFormats", */
    T: -1
  },
  /*::[*/
  307: {
    /* n:"BrtBeginSxSelect", */
    T: 1
  },
  /*::[*/
  308: {
    /* n:"BrtEndSxSelect", */
    T: -1
  },
  /*::[*/
  309: {
    /* n:"BrtBeginISXVDRws", */
    T: 1
  },
  /*::[*/
  310: {
    /* n:"BrtEndISXVDRws", */
    T: -1
  },
  /*::[*/
  311: {
    /* n:"BrtBeginISXVDCols", */
    T: 1
  },
  /*::[*/
  312: {
    /* n:"BrtEndISXVDCols", */
    T: -1
  },
  /*::[*/
  313: {
    /* n:"BrtEndSXLocation", */
    T: -1
  },
  /*::[*/
  314: {
    /* n:"BrtBeginSXLocation", */
    T: 1
  },
  /*::[*/
  315: {
    /* n:"BrtEndSXView", */
    T: -1
  },
  /*::[*/
  316: {
    /* n:"BrtBeginSXTHs", */
    T: 1
  },
  /*::[*/
  317: {
    /* n:"BrtEndSXTHs", */
    T: -1
  },
  /*::[*/
  318: {
    /* n:"BrtBeginSXTH", */
    T: 1
  },
  /*::[*/
  319: {
    /* n:"BrtEndSXTH", */
    T: -1
  },
  /*::[*/
  320: {
    /* n:"BrtBeginISXTHRws", */
    T: 1
  },
  /*::[*/
  321: {
    /* n:"BrtEndISXTHRws", */
    T: -1
  },
  /*::[*/
  322: {
    /* n:"BrtBeginISXTHCols", */
    T: 1
  },
  /*::[*/
  323: {
    /* n:"BrtEndISXTHCols", */
    T: -1
  },
  /*::[*/
  324: {
    /* n:"BrtBeginSXTDMPS", */
    T: 1
  },
  /*::[*/
  325: {
    /* n:"BrtEndSXTDMPs", */
    T: -1
  },
  /*::[*/
  326: {
    /* n:"BrtBeginSXTDMP", */
    T: 1
  },
  /*::[*/
  327: {
    /* n:"BrtEndSXTDMP", */
    T: -1
  },
  /*::[*/
  328: {
    /* n:"BrtBeginSXTHItems", */
    T: 1
  },
  /*::[*/
  329: {
    /* n:"BrtEndSXTHItems", */
    T: -1
  },
  /*::[*/
  330: {
    /* n:"BrtBeginSXTHItem", */
    T: 1
  },
  /*::[*/
  331: {
    /* n:"BrtEndSXTHItem", */
    T: -1
  },
  /*::[*/
  332: {
    /* n:"BrtBeginMetadata", */
    T: 1
  },
  /*::[*/
  333: {
    /* n:"BrtEndMetadata", */
    T: -1
  },
  /*::[*/
  334: {
    /* n:"BrtBeginEsmdtinfo", */
    T: 1
  },
  /*::[*/
  335: {
    /* n:"BrtMdtinfo", */
    f: H1
  },
  /*::[*/
  336: {
    /* n:"BrtEndEsmdtinfo", */
    T: -1
  },
  /*::[*/
  337: {
    /* n:"BrtBeginEsmdb", */
    f: V1,
    T: 1
  },
  /*::[*/
  338: {
    /* n:"BrtEndEsmdb", */
    T: -1
  },
  /*::[*/
  339: {
    /* n:"BrtBeginEsfmd", */
    T: 1
  },
  /*::[*/
  340: {
    /* n:"BrtEndEsfmd", */
    T: -1
  },
  /*::[*/
  341: {
    /* n:"BrtBeginSingleCells", */
    T: 1
  },
  /*::[*/
  342: {
    /* n:"BrtEndSingleCells", */
    T: -1
  },
  /*::[*/
  343: {
    /* n:"BrtBeginList", */
    T: 1
  },
  /*::[*/
  344: {
    /* n:"BrtEndList", */
    T: -1
  },
  /*::[*/
  345: {
    /* n:"BrtBeginListCols", */
    T: 1
  },
  /*::[*/
  346: {
    /* n:"BrtEndListCols", */
    T: -1
  },
  /*::[*/
  347: {
    /* n:"BrtBeginListCol", */
    T: 1
  },
  /*::[*/
  348: {
    /* n:"BrtEndListCol", */
    T: -1
  },
  /*::[*/
  349: {
    /* n:"BrtBeginListXmlCPr", */
    T: 1
  },
  /*::[*/
  350: {
    /* n:"BrtEndListXmlCPr", */
    T: -1
  },
  /*::[*/
  351: {
    /* n:"BrtListCCFmla" */
  },
  /*::[*/
  352: {
    /* n:"BrtListTrFmla" */
  },
  /*::[*/
  353: {
    /* n:"BrtBeginExternals", */
    T: 1
  },
  /*::[*/
  354: {
    /* n:"BrtEndExternals", */
    T: -1
  },
  /*::[*/
  355: {
    /* n:"BrtSupBookSrc", */
    f: jt
  },
  /*::[*/
  357: {
    /* n:"BrtSupSelf" */
  },
  /*::[*/
  358: {
    /* n:"BrtSupSame" */
  },
  /*::[*/
  359: {
    /* n:"BrtSupTabs" */
  },
  /*::[*/
  360: {
    /* n:"BrtBeginSupBook", */
    T: 1
  },
  /*::[*/
  361: {
    /* n:"BrtPlaceholderName" */
  },
  /*::[*/
  362: {
    /* n:"BrtExternSheet", */
    f: $i
  },
  /*::[*/
  363: {
    /* n:"BrtExternTableStart" */
  },
  /*::[*/
  364: {
    /* n:"BrtExternTableEnd" */
  },
  /*::[*/
  366: {
    /* n:"BrtExternRowHdr" */
  },
  /*::[*/
  367: {
    /* n:"BrtExternCellBlank" */
  },
  /*::[*/
  368: {
    /* n:"BrtExternCellReal" */
  },
  /*::[*/
  369: {
    /* n:"BrtExternCellBool" */
  },
  /*::[*/
  370: {
    /* n:"BrtExternCellError" */
  },
  /*::[*/
  371: {
    /* n:"BrtExternCellString" */
  },
  /*::[*/
  372: {
    /* n:"BrtBeginEsmdx", */
    T: 1
  },
  /*::[*/
  373: {
    /* n:"BrtEndEsmdx", */
    T: -1
  },
  /*::[*/
  374: {
    /* n:"BrtBeginMdxSet", */
    T: 1
  },
  /*::[*/
  375: {
    /* n:"BrtEndMdxSet", */
    T: -1
  },
  /*::[*/
  376: {
    /* n:"BrtBeginMdxMbrProp", */
    T: 1
  },
  /*::[*/
  377: {
    /* n:"BrtEndMdxMbrProp", */
    T: -1
  },
  /*::[*/
  378: {
    /* n:"BrtBeginMdxKPI", */
    T: 1
  },
  /*::[*/
  379: {
    /* n:"BrtEndMdxKPI", */
    T: -1
  },
  /*::[*/
  380: {
    /* n:"BrtBeginEsstr", */
    T: 1
  },
  /*::[*/
  381: {
    /* n:"BrtEndEsstr", */
    T: -1
  },
  /*::[*/
  382: {
    /* n:"BrtBeginPRFItem", */
    T: 1
  },
  /*::[*/
  383: {
    /* n:"BrtEndPRFItem", */
    T: -1
  },
  /*::[*/
  384: {
    /* n:"BrtBeginPivotCacheIDs", */
    T: 1
  },
  /*::[*/
  385: {
    /* n:"BrtEndPivotCacheIDs", */
    T: -1
  },
  /*::[*/
  386: {
    /* n:"BrtBeginPivotCacheID", */
    T: 1
  },
  /*::[*/
  387: {
    /* n:"BrtEndPivotCacheID", */
    T: -1
  },
  /*::[*/
  388: {
    /* n:"BrtBeginISXVIs", */
    T: 1
  },
  /*::[*/
  389: {
    /* n:"BrtEndISXVIs", */
    T: -1
  },
  /*::[*/
  390: {
    /* n:"BrtBeginColInfos", */
    T: 1
  },
  /*::[*/
  391: {
    /* n:"BrtEndColInfos", */
    T: -1
  },
  /*::[*/
  392: {
    /* n:"BrtBeginRwBrk", */
    T: 1
  },
  /*::[*/
  393: {
    /* n:"BrtEndRwBrk", */
    T: -1
  },
  /*::[*/
  394: {
    /* n:"BrtBeginColBrk", */
    T: 1
  },
  /*::[*/
  395: {
    /* n:"BrtEndColBrk", */
    T: -1
  },
  /*::[*/
  396: {
    /* n:"BrtBrk" */
  },
  /*::[*/
  397: {
    /* n:"BrtUserBookView" */
  },
  /*::[*/
  398: {
    /* n:"BrtInfo" */
  },
  /*::[*/
  399: {
    /* n:"BrtCUsr" */
  },
  /*::[*/
  400: {
    /* n:"BrtUsr" */
  },
  /*::[*/
  401: {
    /* n:"BrtBeginUsers", */
    T: 1
  },
  /*::[*/
  403: {
    /* n:"BrtEOF" */
  },
  /*::[*/
  404: {
    /* n:"BrtUCR" */
  },
  /*::[*/
  405: {
    /* n:"BrtRRInsDel" */
  },
  /*::[*/
  406: {
    /* n:"BrtRREndInsDel" */
  },
  /*::[*/
  407: {
    /* n:"BrtRRMove" */
  },
  /*::[*/
  408: {
    /* n:"BrtRREndMove" */
  },
  /*::[*/
  409: {
    /* n:"BrtRRChgCell" */
  },
  /*::[*/
  410: {
    /* n:"BrtRREndChgCell" */
  },
  /*::[*/
  411: {
    /* n:"BrtRRHeader" */
  },
  /*::[*/
  412: {
    /* n:"BrtRRUserView" */
  },
  /*::[*/
  413: {
    /* n:"BrtRRRenSheet" */
  },
  /*::[*/
  414: {
    /* n:"BrtRRInsertSh" */
  },
  /*::[*/
  415: {
    /* n:"BrtRRDefName" */
  },
  /*::[*/
  416: {
    /* n:"BrtRRNote" */
  },
  /*::[*/
  417: {
    /* n:"BrtRRConflict" */
  },
  /*::[*/
  418: {
    /* n:"BrtRRTQSIF" */
  },
  /*::[*/
  419: {
    /* n:"BrtRRFormat" */
  },
  /*::[*/
  420: {
    /* n:"BrtRREndFormat" */
  },
  /*::[*/
  421: {
    /* n:"BrtRRAutoFmt" */
  },
  /*::[*/
  422: {
    /* n:"BrtBeginUserShViews", */
    T: 1
  },
  /*::[*/
  423: {
    /* n:"BrtBeginUserShView", */
    T: 1
  },
  /*::[*/
  424: {
    /* n:"BrtEndUserShView", */
    T: -1
  },
  /*::[*/
  425: {
    /* n:"BrtEndUserShViews", */
    T: -1
  },
  /*::[*/
  426: {
    /* n:"BrtArrFmla", */
    f: Ax
  },
  /*::[*/
  427: {
    /* n:"BrtShrFmla", */
    f: Fx
  },
  /*::[*/
  428: {
    /* n:"BrtTable" */
  },
  /*::[*/
  429: {
    /* n:"BrtBeginExtConnections", */
    T: 1
  },
  /*::[*/
  430: {
    /* n:"BrtEndExtConnections", */
    T: -1
  },
  /*::[*/
  431: {
    /* n:"BrtBeginPCDCalcMems", */
    T: 1
  },
  /*::[*/
  432: {
    /* n:"BrtEndPCDCalcMems", */
    T: -1
  },
  /*::[*/
  433: {
    /* n:"BrtBeginPCDCalcMem", */
    T: 1
  },
  /*::[*/
  434: {
    /* n:"BrtEndPCDCalcMem", */
    T: -1
  },
  /*::[*/
  435: {
    /* n:"BrtBeginPCDHGLevels", */
    T: 1
  },
  /*::[*/
  436: {
    /* n:"BrtEndPCDHGLevels", */
    T: -1
  },
  /*::[*/
  437: {
    /* n:"BrtBeginPCDHGLevel", */
    T: 1
  },
  /*::[*/
  438: {
    /* n:"BrtEndPCDHGLevel", */
    T: -1
  },
  /*::[*/
  439: {
    /* n:"BrtBeginPCDHGLGroups", */
    T: 1
  },
  /*::[*/
  440: {
    /* n:"BrtEndPCDHGLGroups", */
    T: -1
  },
  /*::[*/
  441: {
    /* n:"BrtBeginPCDHGLGroup", */
    T: 1
  },
  /*::[*/
  442: {
    /* n:"BrtEndPCDHGLGroup", */
    T: -1
  },
  /*::[*/
  443: {
    /* n:"BrtBeginPCDHGLGMembers", */
    T: 1
  },
  /*::[*/
  444: {
    /* n:"BrtEndPCDHGLGMembers", */
    T: -1
  },
  /*::[*/
  445: {
    /* n:"BrtBeginPCDHGLGMember", */
    T: 1
  },
  /*::[*/
  446: {
    /* n:"BrtEndPCDHGLGMember", */
    T: -1
  },
  /*::[*/
  447: {
    /* n:"BrtBeginQSI", */
    T: 1
  },
  /*::[*/
  448: {
    /* n:"BrtEndQSI", */
    T: -1
  },
  /*::[*/
  449: {
    /* n:"BrtBeginQSIR", */
    T: 1
  },
  /*::[*/
  450: {
    /* n:"BrtEndQSIR", */
    T: -1
  },
  /*::[*/
  451: {
    /* n:"BrtBeginDeletedNames", */
    T: 1
  },
  /*::[*/
  452: {
    /* n:"BrtEndDeletedNames", */
    T: -1
  },
  /*::[*/
  453: {
    /* n:"BrtBeginDeletedName", */
    T: 1
  },
  /*::[*/
  454: {
    /* n:"BrtEndDeletedName", */
    T: -1
  },
  /*::[*/
  455: {
    /* n:"BrtBeginQSIFs", */
    T: 1
  },
  /*::[*/
  456: {
    /* n:"BrtEndQSIFs", */
    T: -1
  },
  /*::[*/
  457: {
    /* n:"BrtBeginQSIF", */
    T: 1
  },
  /*::[*/
  458: {
    /* n:"BrtEndQSIF", */
    T: -1
  },
  /*::[*/
  459: {
    /* n:"BrtBeginAutoSortScope", */
    T: 1
  },
  /*::[*/
  460: {
    /* n:"BrtEndAutoSortScope", */
    T: -1
  },
  /*::[*/
  461: {
    /* n:"BrtBeginConditionalFormatting", */
    T: 1
  },
  /*::[*/
  462: {
    /* n:"BrtEndConditionalFormatting", */
    T: -1
  },
  /*::[*/
  463: {
    /* n:"BrtBeginCFRule", */
    T: 1
  },
  /*::[*/
  464: {
    /* n:"BrtEndCFRule", */
    T: -1
  },
  /*::[*/
  465: {
    /* n:"BrtBeginIconSet", */
    T: 1
  },
  /*::[*/
  466: {
    /* n:"BrtEndIconSet", */
    T: -1
  },
  /*::[*/
  467: {
    /* n:"BrtBeginDatabar", */
    T: 1
  },
  /*::[*/
  468: {
    /* n:"BrtEndDatabar", */
    T: -1
  },
  /*::[*/
  469: {
    /* n:"BrtBeginColorScale", */
    T: 1
  },
  /*::[*/
  470: {
    /* n:"BrtEndColorScale", */
    T: -1
  },
  /*::[*/
  471: {
    /* n:"BrtCFVO" */
  },
  /*::[*/
  472: {
    /* n:"BrtExternValueMeta" */
  },
  /*::[*/
  473: {
    /* n:"BrtBeginColorPalette", */
    T: 1
  },
  /*::[*/
  474: {
    /* n:"BrtEndColorPalette", */
    T: -1
  },
  /*::[*/
  475: {
    /* n:"BrtIndexedColor" */
  },
  /*::[*/
  476: {
    /* n:"BrtMargins", */
    f: Cx
  },
  /*::[*/
  477: {
    /* n:"BrtPrintOptions" */
  },
  /*::[*/
  478: {
    /* n:"BrtPageSetup" */
  },
  /*::[*/
  479: {
    /* n:"BrtBeginHeaderFooter", */
    T: 1
  },
  /*::[*/
  480: {
    /* n:"BrtEndHeaderFooter", */
    T: -1
  },
  /*::[*/
  481: {
    /* n:"BrtBeginSXCrtFormat", */
    T: 1
  },
  /*::[*/
  482: {
    /* n:"BrtEndSXCrtFormat", */
    T: -1
  },
  /*::[*/
  483: {
    /* n:"BrtBeginSXCrtFormats", */
    T: 1
  },
  /*::[*/
  484: {
    /* n:"BrtEndSXCrtFormats", */
    T: -1
  },
  /*::[*/
  485: {
    /* n:"BrtWsFmtInfo", */
    f: rx
  },
  /*::[*/
  486: {
    /* n:"BrtBeginMgs", */
    T: 1
  },
  /*::[*/
  487: {
    /* n:"BrtEndMGs", */
    T: -1
  },
  /*::[*/
  488: {
    /* n:"BrtBeginMGMaps", */
    T: 1
  },
  /*::[*/
  489: {
    /* n:"BrtEndMGMaps", */
    T: -1
  },
  /*::[*/
  490: {
    /* n:"BrtBeginMG", */
    T: 1
  },
  /*::[*/
  491: {
    /* n:"BrtEndMG", */
    T: -1
  },
  /*::[*/
  492: {
    /* n:"BrtBeginMap", */
    T: 1
  },
  /*::[*/
  493: {
    /* n:"BrtEndMap", */
    T: -1
  },
  /*::[*/
  494: {
    /* n:"BrtHLink", */
    f: kx
  },
  /*::[*/
  495: {
    /* n:"BrtBeginDCon", */
    T: 1
  },
  /*::[*/
  496: {
    /* n:"BrtEndDCon", */
    T: -1
  },
  /*::[*/
  497: {
    /* n:"BrtBeginDRefs", */
    T: 1
  },
  /*::[*/
  498: {
    /* n:"BrtEndDRefs", */
    T: -1
  },
  /*::[*/
  499: {
    /* n:"BrtDRef" */
  },
  /*::[*/
  500: {
    /* n:"BrtBeginScenMan", */
    T: 1
  },
  /*::[*/
  501: {
    /* n:"BrtEndScenMan", */
    T: -1
  },
  /*::[*/
  502: {
    /* n:"BrtBeginSct", */
    T: 1
  },
  /*::[*/
  503: {
    /* n:"BrtEndSct", */
    T: -1
  },
  /*::[*/
  504: {
    /* n:"BrtSlc" */
  },
  /*::[*/
  505: {
    /* n:"BrtBeginDXFs", */
    T: 1
  },
  /*::[*/
  506: {
    /* n:"BrtEndDXFs", */
    T: -1
  },
  /*::[*/
  507: {
    /* n:"BrtDXF" */
  },
  /*::[*/
  508: {
    /* n:"BrtBeginTableStyles", */
    T: 1
  },
  /*::[*/
  509: {
    /* n:"BrtEndTableStyles", */
    T: -1
  },
  /*::[*/
  510: {
    /* n:"BrtBeginTableStyle", */
    T: 1
  },
  /*::[*/
  511: {
    /* n:"BrtEndTableStyle", */
    T: -1
  },
  /*::[*/
  512: {
    /* n:"BrtTableStyleElement" */
  },
  /*::[*/
  513: {
    /* n:"BrtTableStyleClient" */
  },
  /*::[*/
  514: {
    /* n:"BrtBeginVolDeps", */
    T: 1
  },
  /*::[*/
  515: {
    /* n:"BrtEndVolDeps", */
    T: -1
  },
  /*::[*/
  516: {
    /* n:"BrtBeginVolType", */
    T: 1
  },
  /*::[*/
  517: {
    /* n:"BrtEndVolType", */
    T: -1
  },
  /*::[*/
  518: {
    /* n:"BrtBeginVolMain", */
    T: 1
  },
  /*::[*/
  519: {
    /* n:"BrtEndVolMain", */
    T: -1
  },
  /*::[*/
  520: {
    /* n:"BrtBeginVolTopic", */
    T: 1
  },
  /*::[*/
  521: {
    /* n:"BrtEndVolTopic", */
    T: -1
  },
  /*::[*/
  522: {
    /* n:"BrtVolSubtopic" */
  },
  /*::[*/
  523: {
    /* n:"BrtVolRef" */
  },
  /*::[*/
  524: {
    /* n:"BrtVolNum" */
  },
  /*::[*/
  525: {
    /* n:"BrtVolErr" */
  },
  /*::[*/
  526: {
    /* n:"BrtVolStr" */
  },
  /*::[*/
  527: {
    /* n:"BrtVolBool" */
  },
  /*::[*/
  528: {
    /* n:"BrtBeginCalcChain$", */
    T: 1
  },
  /*::[*/
  529: {
    /* n:"BrtEndCalcChain$", */
    T: -1
  },
  /*::[*/
  530: {
    /* n:"BrtBeginSortState", */
    T: 1
  },
  /*::[*/
  531: {
    /* n:"BrtEndSortState", */
    T: -1
  },
  /*::[*/
  532: {
    /* n:"BrtBeginSortCond", */
    T: 1
  },
  /*::[*/
  533: {
    /* n:"BrtEndSortCond", */
    T: -1
  },
  /*::[*/
  534: {
    /* n:"BrtBookProtection" */
  },
  /*::[*/
  535: {
    /* n:"BrtSheetProtection" */
  },
  /*::[*/
  536: {
    /* n:"BrtRangeProtection" */
  },
  /*::[*/
  537: {
    /* n:"BrtPhoneticInfo" */
  },
  /*::[*/
  538: {
    /* n:"BrtBeginECTxtWiz", */
    T: 1
  },
  /*::[*/
  539: {
    /* n:"BrtEndECTxtWiz", */
    T: -1
  },
  /*::[*/
  540: {
    /* n:"BrtBeginECTWFldInfoLst", */
    T: 1
  },
  /*::[*/
  541: {
    /* n:"BrtEndECTWFldInfoLst", */
    T: -1
  },
  /*::[*/
  542: {
    /* n:"BrtBeginECTwFldInfo", */
    T: 1
  },
  /*::[*/
  548: {
    /* n:"BrtFileSharing" */
  },
  /*::[*/
  549: {
    /* n:"BrtOleSize" */
  },
  /*::[*/
  550: {
    /* n:"BrtDrawing", */
    f: jt
  },
  /*::[*/
  551: {
    /* n:"BrtLegacyDrawing" */
  },
  /*::[*/
  552: {
    /* n:"BrtLegacyDrawingHF" */
  },
  /*::[*/
  553: {
    /* n:"BrtWebOpt" */
  },
  /*::[*/
  554: {
    /* n:"BrtBeginWebPubItems", */
    T: 1
  },
  /*::[*/
  555: {
    /* n:"BrtEndWebPubItems", */
    T: -1
  },
  /*::[*/
  556: {
    /* n:"BrtBeginWebPubItem", */
    T: 1
  },
  /*::[*/
  557: {
    /* n:"BrtEndWebPubItem", */
    T: -1
  },
  /*::[*/
  558: {
    /* n:"BrtBeginSXCondFmt", */
    T: 1
  },
  /*::[*/
  559: {
    /* n:"BrtEndSXCondFmt", */
    T: -1
  },
  /*::[*/
  560: {
    /* n:"BrtBeginSXCondFmts", */
    T: 1
  },
  /*::[*/
  561: {
    /* n:"BrtEndSXCondFmts", */
    T: -1
  },
  /*::[*/
  562: {
    /* n:"BrtBkHim" */
  },
  /*::[*/
  564: {
    /* n:"BrtColor" */
  },
  /*::[*/
  565: {
    /* n:"BrtBeginIndexedColors", */
    T: 1
  },
  /*::[*/
  566: {
    /* n:"BrtEndIndexedColors", */
    T: -1
  },
  /*::[*/
  569: {
    /* n:"BrtBeginMRUColors", */
    T: 1
  },
  /*::[*/
  570: {
    /* n:"BrtEndMRUColors", */
    T: -1
  },
  /*::[*/
  572: {
    /* n:"BrtMRUColor" */
  },
  /*::[*/
  573: {
    /* n:"BrtBeginDVals", */
    T: 1
  },
  /*::[*/
  574: {
    /* n:"BrtEndDVals", */
    T: -1
  },
  /*::[*/
  577: {
    /* n:"BrtSupNameStart" */
  },
  /*::[*/
  578: {
    /* n:"BrtSupNameValueStart" */
  },
  /*::[*/
  579: {
    /* n:"BrtSupNameValueEnd" */
  },
  /*::[*/
  580: {
    /* n:"BrtSupNameNum" */
  },
  /*::[*/
  581: {
    /* n:"BrtSupNameErr" */
  },
  /*::[*/
  582: {
    /* n:"BrtSupNameSt" */
  },
  /*::[*/
  583: {
    /* n:"BrtSupNameNil" */
  },
  /*::[*/
  584: {
    /* n:"BrtSupNameBool" */
  },
  /*::[*/
  585: {
    /* n:"BrtSupNameFmla" */
  },
  /*::[*/
  586: {
    /* n:"BrtSupNameBits" */
  },
  /*::[*/
  587: {
    /* n:"BrtSupNameEnd" */
  },
  /*::[*/
  588: {
    /* n:"BrtEndSupBook", */
    T: -1
  },
  /*::[*/
  589: {
    /* n:"BrtCellSmartTagProperty" */
  },
  /*::[*/
  590: {
    /* n:"BrtBeginCellSmartTag", */
    T: 1
  },
  /*::[*/
  591: {
    /* n:"BrtEndCellSmartTag", */
    T: -1
  },
  /*::[*/
  592: {
    /* n:"BrtBeginCellSmartTags", */
    T: 1
  },
  /*::[*/
  593: {
    /* n:"BrtEndCellSmartTags", */
    T: -1
  },
  /*::[*/
  594: {
    /* n:"BrtBeginSmartTags", */
    T: 1
  },
  /*::[*/
  595: {
    /* n:"BrtEndSmartTags", */
    T: -1
  },
  /*::[*/
  596: {
    /* n:"BrtSmartTagType" */
  },
  /*::[*/
  597: {
    /* n:"BrtBeginSmartTagTypes", */
    T: 1
  },
  /*::[*/
  598: {
    /* n:"BrtEndSmartTagTypes", */
    T: -1
  },
  /*::[*/
  599: {
    /* n:"BrtBeginSXFilters", */
    T: 1
  },
  /*::[*/
  600: {
    /* n:"BrtEndSXFilters", */
    T: -1
  },
  /*::[*/
  601: {
    /* n:"BrtBeginSXFILTER", */
    T: 1
  },
  /*::[*/
  602: {
    /* n:"BrtEndSXFilter", */
    T: -1
  },
  /*::[*/
  603: {
    /* n:"BrtBeginFills", */
    T: 1
  },
  /*::[*/
  604: {
    /* n:"BrtEndFills", */
    T: -1
  },
  /*::[*/
  605: {
    /* n:"BrtBeginCellWatches", */
    T: 1
  },
  /*::[*/
  606: {
    /* n:"BrtEndCellWatches", */
    T: -1
  },
  /*::[*/
  607: {
    /* n:"BrtCellWatch" */
  },
  /*::[*/
  608: {
    /* n:"BrtBeginCRErrs", */
    T: 1
  },
  /*::[*/
  609: {
    /* n:"BrtEndCRErrs", */
    T: -1
  },
  /*::[*/
  610: {
    /* n:"BrtCrashRecErr" */
  },
  /*::[*/
  611: {
    /* n:"BrtBeginFonts", */
    T: 1
  },
  /*::[*/
  612: {
    /* n:"BrtEndFonts", */
    T: -1
  },
  /*::[*/
  613: {
    /* n:"BrtBeginBorders", */
    T: 1
  },
  /*::[*/
  614: {
    /* n:"BrtEndBorders", */
    T: -1
  },
  /*::[*/
  615: {
    /* n:"BrtBeginFmts", */
    T: 1
  },
  /*::[*/
  616: {
    /* n:"BrtEndFmts", */
    T: -1
  },
  /*::[*/
  617: {
    /* n:"BrtBeginCellXFs", */
    T: 1
  },
  /*::[*/
  618: {
    /* n:"BrtEndCellXFs", */
    T: -1
  },
  /*::[*/
  619: {
    /* n:"BrtBeginStyles", */
    T: 1
  },
  /*::[*/
  620: {
    /* n:"BrtEndStyles", */
    T: -1
  },
  /*::[*/
  625: {
    /* n:"BrtBigName" */
  },
  /*::[*/
  626: {
    /* n:"BrtBeginCellStyleXFs", */
    T: 1
  },
  /*::[*/
  627: {
    /* n:"BrtEndCellStyleXFs", */
    T: -1
  },
  /*::[*/
  628: {
    /* n:"BrtBeginComments", */
    T: 1
  },
  /*::[*/
  629: {
    /* n:"BrtEndComments", */
    T: -1
  },
  /*::[*/
  630: {
    /* n:"BrtBeginCommentAuthors", */
    T: 1
  },
  /*::[*/
  631: {
    /* n:"BrtEndCommentAuthors", */
    T: -1
  },
  /*::[*/
  632: {
    /* n:"BrtCommentAuthor", */
    f: eu
  },
  /*::[*/
  633: {
    /* n:"BrtBeginCommentList", */
    T: 1
  },
  /*::[*/
  634: {
    /* n:"BrtEndCommentList", */
    T: -1
  },
  /*::[*/
  635: {
    /* n:"BrtBeginComment", */
    T: 1,
    f: Q1
  },
  /*::[*/
  636: {
    /* n:"BrtEndComment", */
    T: -1
  },
  /*::[*/
  637: {
    /* n:"BrtCommentText", */
    f: kf
  },
  /*::[*/
  638: {
    /* n:"BrtBeginOleObjects", */
    T: 1
  },
  /*::[*/
  639: {
    /* n:"BrtOleObject" */
  },
  /*::[*/
  640: {
    /* n:"BrtEndOleObjects", */
    T: -1
  },
  /*::[*/
  641: {
    /* n:"BrtBeginSxrules", */
    T: 1
  },
  /*::[*/
  642: {
    /* n:"BrtEndSxRules", */
    T: -1
  },
  /*::[*/
  643: {
    /* n:"BrtBeginActiveXControls", */
    T: 1
  },
  /*::[*/
  644: {
    /* n:"BrtActiveX" */
  },
  /*::[*/
  645: {
    /* n:"BrtEndActiveXControls", */
    T: -1
  },
  /*::[*/
  646: {
    /* n:"BrtBeginPCDSDTCEMembersSortBy", */
    T: 1
  },
  /*::[*/
  648: {
    /* n:"BrtBeginCellIgnoreECs", */
    T: 1
  },
  /*::[*/
  649: {
    /* n:"BrtCellIgnoreEC" */
  },
  /*::[*/
  650: {
    /* n:"BrtEndCellIgnoreECs", */
    T: -1
  },
  /*::[*/
  651: {
    /* n:"BrtCsProp", */
    f: Px
  },
  /*::[*/
  652: {
    /* n:"BrtCsPageSetup" */
  },
  /*::[*/
  653: {
    /* n:"BrtBeginUserCsViews", */
    T: 1
  },
  /*::[*/
  654: {
    /* n:"BrtEndUserCsViews", */
    T: -1
  },
  /*::[*/
  655: {
    /* n:"BrtBeginUserCsView", */
    T: 1
  },
  /*::[*/
  656: {
    /* n:"BrtEndUserCsView", */
    T: -1
  },
  /*::[*/
  657: {
    /* n:"BrtBeginPcdSFCIEntries", */
    T: 1
  },
  /*::[*/
  658: {
    /* n:"BrtEndPCDSFCIEntries", */
    T: -1
  },
  /*::[*/
  659: {
    /* n:"BrtPCDSFCIEntry" */
  },
  /*::[*/
  660: {
    /* n:"BrtBeginListParts", */
    T: 1
  },
  /*::[*/
  661: {
    /* n:"BrtListPart" */
  },
  /*::[*/
  662: {
    /* n:"BrtEndListParts", */
    T: -1
  },
  /*::[*/
  663: {
    /* n:"BrtSheetCalcProp" */
  },
  /*::[*/
  664: {
    /* n:"BrtBeginFnGroup", */
    T: 1
  },
  /*::[*/
  665: {
    /* n:"BrtFnGroup" */
  },
  /*::[*/
  666: {
    /* n:"BrtEndFnGroup", */
    T: -1
  },
  /*::[*/
  667: {
    /* n:"BrtSupAddin" */
  },
  /*::[*/
  668: {
    /* n:"BrtSXTDMPOrder" */
  },
  /*::[*/
  669: {
    /* n:"BrtCsProtection" */
  },
  /*::[*/
  671: {
    /* n:"BrtBeginWsSortMap", */
    T: 1
  },
  /*::[*/
  672: {
    /* n:"BrtEndWsSortMap", */
    T: -1
  },
  /*::[*/
  673: {
    /* n:"BrtBeginRRSort", */
    T: 1
  },
  /*::[*/
  674: {
    /* n:"BrtEndRRSort", */
    T: -1
  },
  /*::[*/
  675: {
    /* n:"BrtRRSortItem" */
  },
  /*::[*/
  676: {
    /* n:"BrtFileSharingIso" */
  },
  /*::[*/
  677: {
    /* n:"BrtBookProtectionIso" */
  },
  /*::[*/
  678: {
    /* n:"BrtSheetProtectionIso" */
  },
  /*::[*/
  679: {
    /* n:"BrtCsProtectionIso" */
  },
  /*::[*/
  680: {
    /* n:"BrtRangeProtectionIso" */
  },
  /*::[*/
  681: {
    /* n:"BrtDValList" */
  },
  /*::[*/
  1024: {
    /* n:"BrtRwDescent" */
  },
  /*::[*/
  1025: {
    /* n:"BrtKnownFonts" */
  },
  /*::[*/
  1026: {
    /* n:"BrtBeginSXTupleSet", */
    T: 1
  },
  /*::[*/
  1027: {
    /* n:"BrtEndSXTupleSet", */
    T: -1
  },
  /*::[*/
  1028: {
    /* n:"BrtBeginSXTupleSetHeader", */
    T: 1
  },
  /*::[*/
  1029: {
    /* n:"BrtEndSXTupleSetHeader", */
    T: -1
  },
  /*::[*/
  1030: {
    /* n:"BrtSXTupleSetHeaderItem" */
  },
  /*::[*/
  1031: {
    /* n:"BrtBeginSXTupleSetData", */
    T: 1
  },
  /*::[*/
  1032: {
    /* n:"BrtEndSXTupleSetData", */
    T: -1
  },
  /*::[*/
  1033: {
    /* n:"BrtBeginSXTupleSetRow", */
    T: 1
  },
  /*::[*/
  1034: {
    /* n:"BrtEndSXTupleSetRow", */
    T: -1
  },
  /*::[*/
  1035: {
    /* n:"BrtSXTupleSetRowItem" */
  },
  /*::[*/
  1036: {
    /* n:"BrtNameExt" */
  },
  /*::[*/
  1037: {
    /* n:"BrtPCDH14" */
  },
  /*::[*/
  1038: {
    /* n:"BrtBeginPCDCalcMem14", */
    T: 1
  },
  /*::[*/
  1039: {
    /* n:"BrtEndPCDCalcMem14", */
    T: -1
  },
  /*::[*/
  1040: {
    /* n:"BrtSXTH14" */
  },
  /*::[*/
  1041: {
    /* n:"BrtBeginSparklineGroup", */
    T: 1
  },
  /*::[*/
  1042: {
    /* n:"BrtEndSparklineGroup", */
    T: -1
  },
  /*::[*/
  1043: {
    /* n:"BrtSparkline" */
  },
  /*::[*/
  1044: {
    /* n:"BrtSXDI14" */
  },
  /*::[*/
  1045: {
    /* n:"BrtWsFmtInfoEx14" */
  },
  /*::[*/
  1046: {
    /* n:"BrtBeginConditionalFormatting14", */
    T: 1
  },
  /*::[*/
  1047: {
    /* n:"BrtEndConditionalFormatting14", */
    T: -1
  },
  /*::[*/
  1048: {
    /* n:"BrtBeginCFRule14", */
    T: 1
  },
  /*::[*/
  1049: {
    /* n:"BrtEndCFRule14", */
    T: -1
  },
  /*::[*/
  1050: {
    /* n:"BrtCFVO14" */
  },
  /*::[*/
  1051: {
    /* n:"BrtBeginDatabar14", */
    T: 1
  },
  /*::[*/
  1052: {
    /* n:"BrtBeginIconSet14", */
    T: 1
  },
  /*::[*/
  1053: {
    /* n:"BrtDVal14", */
    f: Rx
  },
  /*::[*/
  1054: {
    /* n:"BrtBeginDVals14", */
    T: 1
  },
  /*::[*/
  1055: {
    /* n:"BrtColor14" */
  },
  /*::[*/
  1056: {
    /* n:"BrtBeginSparklines", */
    T: 1
  },
  /*::[*/
  1057: {
    /* n:"BrtEndSparklines", */
    T: -1
  },
  /*::[*/
  1058: {
    /* n:"BrtBeginSparklineGroups", */
    T: 1
  },
  /*::[*/
  1059: {
    /* n:"BrtEndSparklineGroups", */
    T: -1
  },
  /*::[*/
  1061: {
    /* n:"BrtSXVD14" */
  },
  /*::[*/
  1062: {
    /* n:"BrtBeginSXView14", */
    T: 1
  },
  /*::[*/
  1063: {
    /* n:"BrtEndSXView14", */
    T: -1
  },
  /*::[*/
  1064: {
    /* n:"BrtBeginSXView16", */
    T: 1
  },
  /*::[*/
  1065: {
    /* n:"BrtEndSXView16", */
    T: -1
  },
  /*::[*/
  1066: {
    /* n:"BrtBeginPCD14", */
    T: 1
  },
  /*::[*/
  1067: {
    /* n:"BrtEndPCD14", */
    T: -1
  },
  /*::[*/
  1068: {
    /* n:"BrtBeginExtConn14", */
    T: 1
  },
  /*::[*/
  1069: {
    /* n:"BrtEndExtConn14", */
    T: -1
  },
  /*::[*/
  1070: {
    /* n:"BrtBeginSlicerCacheIDs", */
    T: 1
  },
  /*::[*/
  1071: {
    /* n:"BrtEndSlicerCacheIDs", */
    T: -1
  },
  /*::[*/
  1072: {
    /* n:"BrtBeginSlicerCacheID", */
    T: 1
  },
  /*::[*/
  1073: {
    /* n:"BrtEndSlicerCacheID", */
    T: -1
  },
  /*::[*/
  1075: {
    /* n:"BrtBeginSlicerCache", */
    T: 1
  },
  /*::[*/
  1076: {
    /* n:"BrtEndSlicerCache", */
    T: -1
  },
  /*::[*/
  1077: {
    /* n:"BrtBeginSlicerCacheDef", */
    T: 1
  },
  /*::[*/
  1078: {
    /* n:"BrtEndSlicerCacheDef", */
    T: -1
  },
  /*::[*/
  1079: {
    /* n:"BrtBeginSlicersEx", */
    T: 1
  },
  /*::[*/
  1080: {
    /* n:"BrtEndSlicersEx", */
    T: -1
  },
  /*::[*/
  1081: {
    /* n:"BrtBeginSlicerEx", */
    T: 1
  },
  /*::[*/
  1082: {
    /* n:"BrtEndSlicerEx", */
    T: -1
  },
  /*::[*/
  1083: {
    /* n:"BrtBeginSlicer", */
    T: 1
  },
  /*::[*/
  1084: {
    /* n:"BrtEndSlicer", */
    T: -1
  },
  /*::[*/
  1085: {
    /* n:"BrtSlicerCachePivotTables" */
  },
  /*::[*/
  1086: {
    /* n:"BrtBeginSlicerCacheOlapImpl", */
    T: 1
  },
  /*::[*/
  1087: {
    /* n:"BrtEndSlicerCacheOlapImpl", */
    T: -1
  },
  /*::[*/
  1088: {
    /* n:"BrtBeginSlicerCacheLevelsData", */
    T: 1
  },
  /*::[*/
  1089: {
    /* n:"BrtEndSlicerCacheLevelsData", */
    T: -1
  },
  /*::[*/
  1090: {
    /* n:"BrtBeginSlicerCacheLevelData", */
    T: 1
  },
  /*::[*/
  1091: {
    /* n:"BrtEndSlicerCacheLevelData", */
    T: -1
  },
  /*::[*/
  1092: {
    /* n:"BrtBeginSlicerCacheSiRanges", */
    T: 1
  },
  /*::[*/
  1093: {
    /* n:"BrtEndSlicerCacheSiRanges", */
    T: -1
  },
  /*::[*/
  1094: {
    /* n:"BrtBeginSlicerCacheSiRange", */
    T: 1
  },
  /*::[*/
  1095: {
    /* n:"BrtEndSlicerCacheSiRange", */
    T: -1
  },
  /*::[*/
  1096: {
    /* n:"BrtSlicerCacheOlapItem" */
  },
  /*::[*/
  1097: {
    /* n:"BrtBeginSlicerCacheSelections", */
    T: 1
  },
  /*::[*/
  1098: {
    /* n:"BrtSlicerCacheSelection" */
  },
  /*::[*/
  1099: {
    /* n:"BrtEndSlicerCacheSelections", */
    T: -1
  },
  /*::[*/
  1100: {
    /* n:"BrtBeginSlicerCacheNative", */
    T: 1
  },
  /*::[*/
  1101: {
    /* n:"BrtEndSlicerCacheNative", */
    T: -1
  },
  /*::[*/
  1102: {
    /* n:"BrtSlicerCacheNativeItem" */
  },
  /*::[*/
  1103: {
    /* n:"BrtRangeProtection14" */
  },
  /*::[*/
  1104: {
    /* n:"BrtRangeProtectionIso14" */
  },
  /*::[*/
  1105: {
    /* n:"BrtCellIgnoreEC14" */
  },
  /*::[*/
  1111: {
    /* n:"BrtList14" */
  },
  /*::[*/
  1112: {
    /* n:"BrtCFIcon" */
  },
  /*::[*/
  1113: {
    /* n:"BrtBeginSlicerCachesPivotCacheIDs", */
    T: 1
  },
  /*::[*/
  1114: {
    /* n:"BrtEndSlicerCachesPivotCacheIDs", */
    T: -1
  },
  /*::[*/
  1115: {
    /* n:"BrtBeginSlicers", */
    T: 1
  },
  /*::[*/
  1116: {
    /* n:"BrtEndSlicers", */
    T: -1
  },
  /*::[*/
  1117: {
    /* n:"BrtWbProp14" */
  },
  /*::[*/
  1118: {
    /* n:"BrtBeginSXEdit", */
    T: 1
  },
  /*::[*/
  1119: {
    /* n:"BrtEndSXEdit", */
    T: -1
  },
  /*::[*/
  1120: {
    /* n:"BrtBeginSXEdits", */
    T: 1
  },
  /*::[*/
  1121: {
    /* n:"BrtEndSXEdits", */
    T: -1
  },
  /*::[*/
  1122: {
    /* n:"BrtBeginSXChange", */
    T: 1
  },
  /*::[*/
  1123: {
    /* n:"BrtEndSXChange", */
    T: -1
  },
  /*::[*/
  1124: {
    /* n:"BrtBeginSXChanges", */
    T: 1
  },
  /*::[*/
  1125: {
    /* n:"BrtEndSXChanges", */
    T: -1
  },
  /*::[*/
  1126: {
    /* n:"BrtSXTupleItems" */
  },
  /*::[*/
  1128: {
    /* n:"BrtBeginSlicerStyle", */
    T: 1
  },
  /*::[*/
  1129: {
    /* n:"BrtEndSlicerStyle", */
    T: -1
  },
  /*::[*/
  1130: {
    /* n:"BrtSlicerStyleElement" */
  },
  /*::[*/
  1131: {
    /* n:"BrtBeginStyleSheetExt14", */
    T: 1
  },
  /*::[*/
  1132: {
    /* n:"BrtEndStyleSheetExt14", */
    T: -1
  },
  /*::[*/
  1133: {
    /* n:"BrtBeginSlicerCachesPivotCacheID", */
    T: 1
  },
  /*::[*/
  1134: {
    /* n:"BrtEndSlicerCachesPivotCacheID", */
    T: -1
  },
  /*::[*/
  1135: {
    /* n:"BrtBeginConditionalFormattings", */
    T: 1
  },
  /*::[*/
  1136: {
    /* n:"BrtEndConditionalFormattings", */
    T: -1
  },
  /*::[*/
  1137: {
    /* n:"BrtBeginPCDCalcMemExt", */
    T: 1
  },
  /*::[*/
  1138: {
    /* n:"BrtEndPCDCalcMemExt", */
    T: -1
  },
  /*::[*/
  1139: {
    /* n:"BrtBeginPCDCalcMemsExt", */
    T: 1
  },
  /*::[*/
  1140: {
    /* n:"BrtEndPCDCalcMemsExt", */
    T: -1
  },
  /*::[*/
  1141: {
    /* n:"BrtPCDField14" */
  },
  /*::[*/
  1142: {
    /* n:"BrtBeginSlicerStyles", */
    T: 1
  },
  /*::[*/
  1143: {
    /* n:"BrtEndSlicerStyles", */
    T: -1
  },
  /*::[*/
  1144: {
    /* n:"BrtBeginSlicerStyleElements", */
    T: 1
  },
  /*::[*/
  1145: {
    /* n:"BrtEndSlicerStyleElements", */
    T: -1
  },
  /*::[*/
  1146: {
    /* n:"BrtCFRuleExt" */
  },
  /*::[*/
  1147: {
    /* n:"BrtBeginSXCondFmt14", */
    T: 1
  },
  /*::[*/
  1148: {
    /* n:"BrtEndSXCondFmt14", */
    T: -1
  },
  /*::[*/
  1149: {
    /* n:"BrtBeginSXCondFmts14", */
    T: 1
  },
  /*::[*/
  1150: {
    /* n:"BrtEndSXCondFmts14", */
    T: -1
  },
  /*::[*/
  1152: {
    /* n:"BrtBeginSortCond14", */
    T: 1
  },
  /*::[*/
  1153: {
    /* n:"BrtEndSortCond14", */
    T: -1
  },
  /*::[*/
  1154: {
    /* n:"BrtEndDVals14", */
    T: -1
  },
  /*::[*/
  1155: {
    /* n:"BrtEndIconSet14", */
    T: -1
  },
  /*::[*/
  1156: {
    /* n:"BrtEndDatabar14", */
    T: -1
  },
  /*::[*/
  1157: {
    /* n:"BrtBeginColorScale14", */
    T: 1
  },
  /*::[*/
  1158: {
    /* n:"BrtEndColorScale14", */
    T: -1
  },
  /*::[*/
  1159: {
    /* n:"BrtBeginSxrules14", */
    T: 1
  },
  /*::[*/
  1160: {
    /* n:"BrtEndSxrules14", */
    T: -1
  },
  /*::[*/
  1161: {
    /* n:"BrtBeginPRule14", */
    T: 1
  },
  /*::[*/
  1162: {
    /* n:"BrtEndPRule14", */
    T: -1
  },
  /*::[*/
  1163: {
    /* n:"BrtBeginPRFilters14", */
    T: 1
  },
  /*::[*/
  1164: {
    /* n:"BrtEndPRFilters14", */
    T: -1
  },
  /*::[*/
  1165: {
    /* n:"BrtBeginPRFilter14", */
    T: 1
  },
  /*::[*/
  1166: {
    /* n:"BrtEndPRFilter14", */
    T: -1
  },
  /*::[*/
  1167: {
    /* n:"BrtBeginPRFItem14", */
    T: 1
  },
  /*::[*/
  1168: {
    /* n:"BrtEndPRFItem14", */
    T: -1
  },
  /*::[*/
  1169: {
    /* n:"BrtBeginCellIgnoreECs14", */
    T: 1
  },
  /*::[*/
  1170: {
    /* n:"BrtEndCellIgnoreECs14", */
    T: -1
  },
  /*::[*/
  1171: {
    /* n:"BrtDxf14" */
  },
  /*::[*/
  1172: {
    /* n:"BrtBeginDxF14s", */
    T: 1
  },
  /*::[*/
  1173: {
    /* n:"BrtEndDxf14s", */
    T: -1
  },
  /*::[*/
  1177: {
    /* n:"BrtFilter14" */
  },
  /*::[*/
  1178: {
    /* n:"BrtBeginCustomFilters14", */
    T: 1
  },
  /*::[*/
  1180: {
    /* n:"BrtCustomFilter14" */
  },
  /*::[*/
  1181: {
    /* n:"BrtIconFilter14" */
  },
  /*::[*/
  1182: {
    /* n:"BrtPivotCacheConnectionName" */
  },
  /*::[*/
  2048: {
    /* n:"BrtBeginDecoupledPivotCacheIDs", */
    T: 1
  },
  /*::[*/
  2049: {
    /* n:"BrtEndDecoupledPivotCacheIDs", */
    T: -1
  },
  /*::[*/
  2050: {
    /* n:"BrtDecoupledPivotCacheID" */
  },
  /*::[*/
  2051: {
    /* n:"BrtBeginPivotTableRefs", */
    T: 1
  },
  /*::[*/
  2052: {
    /* n:"BrtEndPivotTableRefs", */
    T: -1
  },
  /*::[*/
  2053: {
    /* n:"BrtPivotTableRef" */
  },
  /*::[*/
  2054: {
    /* n:"BrtSlicerCacheBookPivotTables" */
  },
  /*::[*/
  2055: {
    /* n:"BrtBeginSxvcells", */
    T: 1
  },
  /*::[*/
  2056: {
    /* n:"BrtEndSxvcells", */
    T: -1
  },
  /*::[*/
  2057: {
    /* n:"BrtBeginSxRow", */
    T: 1
  },
  /*::[*/
  2058: {
    /* n:"BrtEndSxRow", */
    T: -1
  },
  /*::[*/
  2060: {
    /* n:"BrtPcdCalcMem15" */
  },
  /*::[*/
  2067: {
    /* n:"BrtQsi15" */
  },
  /*::[*/
  2068: {
    /* n:"BrtBeginWebExtensions", */
    T: 1
  },
  /*::[*/
  2069: {
    /* n:"BrtEndWebExtensions", */
    T: -1
  },
  /*::[*/
  2070: {
    /* n:"BrtWebExtension" */
  },
  /*::[*/
  2071: {
    /* n:"BrtAbsPath15" */
  },
  /*::[*/
  2072: {
    /* n:"BrtBeginPivotTableUISettings", */
    T: 1
  },
  /*::[*/
  2073: {
    /* n:"BrtEndPivotTableUISettings", */
    T: -1
  },
  /*::[*/
  2075: {
    /* n:"BrtTableSlicerCacheIDs" */
  },
  /*::[*/
  2076: {
    /* n:"BrtTableSlicerCacheID" */
  },
  /*::[*/
  2077: {
    /* n:"BrtBeginTableSlicerCache", */
    T: 1
  },
  /*::[*/
  2078: {
    /* n:"BrtEndTableSlicerCache", */
    T: -1
  },
  /*::[*/
  2079: {
    /* n:"BrtSxFilter15" */
  },
  /*::[*/
  2080: {
    /* n:"BrtBeginTimelineCachePivotCacheIDs", */
    T: 1
  },
  /*::[*/
  2081: {
    /* n:"BrtEndTimelineCachePivotCacheIDs", */
    T: -1
  },
  /*::[*/
  2082: {
    /* n:"BrtTimelineCachePivotCacheID" */
  },
  /*::[*/
  2083: {
    /* n:"BrtBeginTimelineCacheIDs", */
    T: 1
  },
  /*::[*/
  2084: {
    /* n:"BrtEndTimelineCacheIDs", */
    T: -1
  },
  /*::[*/
  2085: {
    /* n:"BrtBeginTimelineCacheID", */
    T: 1
  },
  /*::[*/
  2086: {
    /* n:"BrtEndTimelineCacheID", */
    T: -1
  },
  /*::[*/
  2087: {
    /* n:"BrtBeginTimelinesEx", */
    T: 1
  },
  /*::[*/
  2088: {
    /* n:"BrtEndTimelinesEx", */
    T: -1
  },
  /*::[*/
  2089: {
    /* n:"BrtBeginTimelineEx", */
    T: 1
  },
  /*::[*/
  2090: {
    /* n:"BrtEndTimelineEx", */
    T: -1
  },
  /*::[*/
  2091: {
    /* n:"BrtWorkBookPr15" */
  },
  /*::[*/
  2092: {
    /* n:"BrtPCDH15" */
  },
  /*::[*/
  2093: {
    /* n:"BrtBeginTimelineStyle", */
    T: 1
  },
  /*::[*/
  2094: {
    /* n:"BrtEndTimelineStyle", */
    T: -1
  },
  /*::[*/
  2095: {
    /* n:"BrtTimelineStyleElement" */
  },
  /*::[*/
  2096: {
    /* n:"BrtBeginTimelineStylesheetExt15", */
    T: 1
  },
  /*::[*/
  2097: {
    /* n:"BrtEndTimelineStylesheetExt15", */
    T: -1
  },
  /*::[*/
  2098: {
    /* n:"BrtBeginTimelineStyles", */
    T: 1
  },
  /*::[*/
  2099: {
    /* n:"BrtEndTimelineStyles", */
    T: -1
  },
  /*::[*/
  2100: {
    /* n:"BrtBeginTimelineStyleElements", */
    T: 1
  },
  /*::[*/
  2101: {
    /* n:"BrtEndTimelineStyleElements", */
    T: -1
  },
  /*::[*/
  2102: {
    /* n:"BrtDxf15" */
  },
  /*::[*/
  2103: {
    /* n:"BrtBeginDxfs15", */
    T: 1
  },
  /*::[*/
  2104: {
    /* n:"BrtEndDxfs15", */
    T: -1
  },
  /*::[*/
  2105: {
    /* n:"BrtSlicerCacheHideItemsWithNoData" */
  },
  /*::[*/
  2106: {
    /* n:"BrtBeginItemUniqueNames", */
    T: 1
  },
  /*::[*/
  2107: {
    /* n:"BrtEndItemUniqueNames", */
    T: -1
  },
  /*::[*/
  2108: {
    /* n:"BrtItemUniqueName" */
  },
  /*::[*/
  2109: {
    /* n:"BrtBeginExtConn15", */
    T: 1
  },
  /*::[*/
  2110: {
    /* n:"BrtEndExtConn15", */
    T: -1
  },
  /*::[*/
  2111: {
    /* n:"BrtBeginOledbPr15", */
    T: 1
  },
  /*::[*/
  2112: {
    /* n:"BrtEndOledbPr15", */
    T: -1
  },
  /*::[*/
  2113: {
    /* n:"BrtBeginDataFeedPr15", */
    T: 1
  },
  /*::[*/
  2114: {
    /* n:"BrtEndDataFeedPr15", */
    T: -1
  },
  /*::[*/
  2115: {
    /* n:"BrtTextPr15" */
  },
  /*::[*/
  2116: {
    /* n:"BrtRangePr15" */
  },
  /*::[*/
  2117: {
    /* n:"BrtDbCommand15" */
  },
  /*::[*/
  2118: {
    /* n:"BrtBeginDbTables15", */
    T: 1
  },
  /*::[*/
  2119: {
    /* n:"BrtEndDbTables15", */
    T: -1
  },
  /*::[*/
  2120: {
    /* n:"BrtDbTable15" */
  },
  /*::[*/
  2121: {
    /* n:"BrtBeginDataModel", */
    T: 1
  },
  /*::[*/
  2122: {
    /* n:"BrtEndDataModel", */
    T: -1
  },
  /*::[*/
  2123: {
    /* n:"BrtBeginModelTables", */
    T: 1
  },
  /*::[*/
  2124: {
    /* n:"BrtEndModelTables", */
    T: -1
  },
  /*::[*/
  2125: {
    /* n:"BrtModelTable" */
  },
  /*::[*/
  2126: {
    /* n:"BrtBeginModelRelationships", */
    T: 1
  },
  /*::[*/
  2127: {
    /* n:"BrtEndModelRelationships", */
    T: -1
  },
  /*::[*/
  2128: {
    /* n:"BrtModelRelationship" */
  },
  /*::[*/
  2129: {
    /* n:"BrtBeginECTxtWiz15", */
    T: 1
  },
  /*::[*/
  2130: {
    /* n:"BrtEndECTxtWiz15", */
    T: -1
  },
  /*::[*/
  2131: {
    /* n:"BrtBeginECTWFldInfoLst15", */
    T: 1
  },
  /*::[*/
  2132: {
    /* n:"BrtEndECTWFldInfoLst15", */
    T: -1
  },
  /*::[*/
  2133: {
    /* n:"BrtBeginECTWFldInfo15", */
    T: 1
  },
  /*::[*/
  2134: {
    /* n:"BrtFieldListActiveItem" */
  },
  /*::[*/
  2135: {
    /* n:"BrtPivotCacheIdVersion" */
  },
  /*::[*/
  2136: {
    /* n:"BrtSXDI15" */
  },
  /*::[*/
  2137: {
    /* n:"BrtBeginModelTimeGroupings", */
    T: 1
  },
  /*::[*/
  2138: {
    /* n:"BrtEndModelTimeGroupings", */
    T: -1
  },
  /*::[*/
  2139: {
    /* n:"BrtBeginModelTimeGrouping", */
    T: 1
  },
  /*::[*/
  2140: {
    /* n:"BrtEndModelTimeGrouping", */
    T: -1
  },
  /*::[*/
  2141: {
    /* n:"BrtModelTimeGroupingCalcCol" */
  },
  /*::[*/
  3072: {
    /* n:"BrtUid" */
  },
  /*::[*/
  3073: {
    /* n:"BrtRevisionPtr" */
  },
  /*::[*/
  4096: {
    /* n:"BrtBeginDynamicArrayPr", */
    T: 1
  },
  /*::[*/
  4097: {
    /* n:"BrtEndDynamicArrayPr", */
    T: -1
  },
  /*::[*/
  5002: {
    /* n:"BrtBeginRichValueBlock", */
    T: 1
  },
  /*::[*/
  5003: {
    /* n:"BrtEndRichValueBlock", */
    T: -1
  },
  /*::[*/
  5081: {
    /* n:"BrtBeginRichFilters", */
    T: 1
  },
  /*::[*/
  5082: {
    /* n:"BrtEndRichFilters", */
    T: -1
  },
  /*::[*/
  5083: {
    /* n:"BrtRichFilter" */
  },
  /*::[*/
  5084: {
    /* n:"BrtBeginRichFilterColumn", */
    T: 1
  },
  /*::[*/
  5085: {
    /* n:"BrtEndRichFilterColumn", */
    T: -1
  },
  /*::[*/
  5086: {
    /* n:"BrtBeginCustomRichFilters", */
    T: 1
  },
  /*::[*/
  5087: {
    /* n:"BrtEndCustomRichFilters", */
    T: -1
  },
  /*::[*/
  5088: {
    /* n:"BrtCustomRichFilter" */
  },
  /*::[*/
  5089: {
    /* n:"BrtTop10RichFilter" */
  },
  /*::[*/
  5090: {
    /* n:"BrtDynamicRichFilter" */
  },
  /*::[*/
  5092: {
    /* n:"BrtBeginRichSortCondition", */
    T: 1
  },
  /*::[*/
  5093: {
    /* n:"BrtEndRichSortCondition", */
    T: -1
  },
  /*::[*/
  5094: {
    /* n:"BrtRichFilterDateGroupItem" */
  },
  /*::[*/
  5095: {
    /* n:"BrtBeginCalcFeatures", */
    T: 1
  },
  /*::[*/
  5096: {
    /* n:"BrtEndCalcFeatures", */
    T: -1
  },
  /*::[*/
  5097: {
    /* n:"BrtCalcFeature" */
  },
  /*::[*/
  5099: {
    /* n:"BrtExternalLinksPr" */
  },
  /*::[*/
  65535: { n: "" }
}, e0 = {
  /* [MS-XLS] 2.3 Record Enumeration 2021-08-17 */
  /*::[*/
  6: {
    /* n:"Formula", */
    f: Vt
  },
  /*::[*/
  10: {
    /* n:"EOF", */
    f: zr
  },
  /*::[*/
  12: {
    /* n:"CalcCount", */
    f: Ue
  },
  //
  /*::[*/
  13: {
    /* n:"CalcMode", */
    f: Ue
  },
  //
  /*::[*/
  14: {
    /* n:"CalcPrecision", */
    f: Me
  },
  //
  /*::[*/
  15: {
    /* n:"CalcRefMode", */
    f: Me
  },
  //
  /*::[*/
  16: {
    /* n:"CalcDelta", */
    f: qe
  },
  //
  /*::[*/
  17: {
    /* n:"CalcIter", */
    f: Me
  },
  //
  /*::[*/
  18: {
    /* n:"Protect", */
    f: Me
  },
  /*::[*/
  19: {
    /* n:"Password", */
    f: Ue
  },
  /*::[*/
  20: {
    /* n:"Header", */
    f: En
  },
  /*::[*/
  21: {
    /* n:"Footer", */
    f: En
  },
  /*::[*/
  23: {
    /* n:"ExternSheet", */
    f: $i
  },
  /*::[*/
  24: {
    /* n:"Lbl", */
    f: Tn
  },
  /*::[*/
  25: {
    /* n:"WinProtect", */
    f: Me
  },
  /*::[*/
  26: {
    /* n:"VerticalPageBreaks", */
  },
  /*::[*/
  27: {
    /* n:"HorizontalPageBreaks", */
  },
  /*::[*/
  28: {
    /* n:"Note", */
    f: Zo
  },
  /*::[*/
  29: {
    /* n:"Selection", */
  },
  /*::[*/
  34: {
    /* n:"Date1904", */
    f: Me
  },
  /*::[*/
  35: {
    /* n:"ExternName", */
    f: _n
  },
  /*::[*/
  38: {
    /* n:"LeftMargin", */
    f: qe
  },
  // *
  /*::[*/
  39: {
    /* n:"RightMargin", */
    f: qe
  },
  // *
  /*::[*/
  40: {
    /* n:"TopMargin", */
    f: qe
  },
  // *
  /*::[*/
  41: {
    /* n:"BottomMargin", */
    f: qe
  },
  // *
  /*::[*/
  42: {
    /* n:"PrintRowCol", */
    f: Me
  },
  /*::[*/
  43: {
    /* n:"PrintGrid", */
    f: Me
  },
  /*::[*/
  47: {
    /* n:"FilePass", */
    f: r1
  },
  /*::[*/
  49: {
    /* n:"Font", */
    f: No
  },
  /*::[*/
  51: {
    /* n:"PrintSize", */
    f: Ue
  },
  /*::[*/
  60: {
    /* n:"Continue", */
  },
  /*::[*/
  61: {
    /* n:"Window1", */
    f: Do
  },
  /*::[*/
  64: {
    /* n:"Backup", */
    f: Me
  },
  /*::[*/
  65: {
    /* n:"Pane", */
    f: Oo
  },
  /*::[*/
  66: {
    /* n:"CodePage", */
    f: Ue
  },
  /*::[*/
  77: {
    /* n:"Pls", */
  },
  /*::[*/
  80: {
    /* n:"DCon", */
  },
  /*::[*/
  81: {
    /* n:"DConRef", */
  },
  /*::[*/
  82: {
    /* n:"DConName", */
  },
  /*::[*/
  85: {
    /* n:"DefColWidth", */
    f: Ue
  },
  /*::[*/
  89: {
    /* n:"XCT", */
  },
  /*::[*/
  90: {
    /* n:"CRN", */
  },
  /*::[*/
  91: {
    /* n:"FileSharing", */
  },
  /*::[*/
  92: {
    /* n:"WriteAccess", */
    f: To
  },
  /*::[*/
  93: {
    /* n:"Obj", */
    f: Qo
  },
  /*::[*/
  94: {
    /* n:"Uncalced", */
  },
  /*::[*/
  95: {
    /* n:"CalcSaveRecalc", */
    f: Me
  },
  //
  /*::[*/
  96: {
    /* n:"Template", */
  },
  /*::[*/
  97: {
    /* n:"Intl", */
  },
  /*::[*/
  99: {
    /* n:"ObjProtect", */
    f: Me
  },
  /*::[*/
  125: {
    /* n:"ColInfo", */
    f: Yi
  },
  /*::[*/
  128: {
    /* n:"Guts", */
    f: Vo
  },
  /*::[*/
  129: {
    /* n:"WsBool", */
    f: ko
  },
  /*::[*/
  130: {
    /* n:"GridSet", */
    f: Ue
  },
  /*::[*/
  131: {
    /* n:"HCenter", */
    f: Me
  },
  /*::[*/
  132: {
    /* n:"VCenter", */
    f: Me
  },
  /*::[*/
  133: {
    /* n:"BoundSheet8", */
    f: wo
  },
  /*::[*/
  134: {
    /* n:"WriteProtect", */
  },
  /*::[*/
  140: {
    /* n:"Country", */
    f: il
  },
  /*::[*/
  141: {
    /* n:"HideObj", */
    f: Ue
  },
  /*::[*/
  144: {
    /* n:"Sort", */
  },
  /*::[*/
  146: {
    /* n:"Palette", */
    f: cl
  },
  /*::[*/
  151: {
    /* n:"Sync", */
  },
  /*::[*/
  152: {
    /* n:"LPr", */
  },
  /*::[*/
  153: {
    /* n:"DxGCol", */
  },
  /*::[*/
  154: {
    /* n:"FnGroupName", */
  },
  /*::[*/
  155: {
    /* n:"FilterMode", */
  },
  /*::[*/
  156: {
    /* n:"BuiltInFnGroupCount", */
    f: Ue
  },
  /*::[*/
  157: {
    /* n:"AutoFilterInfo", */
  },
  /*::[*/
  158: {
    /* n:"AutoFilter", */
  },
  /*::[*/
  160: {
    /* n:"Scl", */
    f: hl
  },
  /*::[*/
  161: {
    /* n:"Setup", */
    f: ol
  },
  /*::[*/
  174: {
    /* n:"ScenMan", */
  },
  /*::[*/
  175: {
    /* n:"SCENARIO", */
  },
  /*::[*/
  176: {
    /* n:"SxView", */
  },
  /*::[*/
  177: {
    /* n:"Sxvd", */
  },
  /*::[*/
  178: {
    /* n:"SXVI", */
  },
  /*::[*/
  180: {
    /* n:"SxIvd", */
  },
  /*::[*/
  181: {
    /* n:"SXLI", */
  },
  /*::[*/
  182: {
    /* n:"SXPI", */
  },
  /*::[*/
  184: {
    /* n:"DocRoute", */
  },
  /*::[*/
  185: {
    /* n:"RecipName", */
  },
  /*::[*/
  189: {
    /* n:"MulRk", */
    f: Bo
  },
  /*::[*/
  190: {
    /* n:"MulBlank", */
    f: Uo
  },
  /*::[*/
  193: {
    /* n:"Mms", */
    f: zr
  },
  /*::[*/
  197: {
    /* n:"SXDI", */
  },
  /*::[*/
  198: {
    /* n:"SXDB", */
  },
  /*::[*/
  199: {
    /* n:"SXFDB", */
  },
  /*::[*/
  200: {
    /* n:"SXDBB", */
  },
  /*::[*/
  201: {
    /* n:"SXNum", */
  },
  /*::[*/
  202: {
    /* n:"SxBool", */
    f: Me
  },
  /*::[*/
  203: {
    /* n:"SxErr", */
  },
  /*::[*/
  204: {
    /* n:"SXInt", */
  },
  /*::[*/
  205: {
    /* n:"SXString", */
  },
  /*::[*/
  206: {
    /* n:"SXDtr", */
  },
  /*::[*/
  207: {
    /* n:"SxNil", */
  },
  /*::[*/
  208: {
    /* n:"SXTbl", */
  },
  /*::[*/
  209: {
    /* n:"SXTBRGIITM", */
  },
  /*::[*/
  210: {
    /* n:"SxTbpg", */
  },
  /*::[*/
  211: {
    /* n:"ObProj", */
  },
  /*::[*/
  213: {
    /* n:"SXStreamID", */
  },
  /*::[*/
  215: {
    /* n:"DBCell", */
  },
  /*::[*/
  216: {
    /* n:"SXRng", */
  },
  /*::[*/
  217: {
    /* n:"SxIsxoper", */
  },
  /*::[*/
  218: {
    /* n:"BookBool", */
    f: Ue
  },
  /*::[*/
  220: {
    /* n:"DbOrParamQry", */
  },
  /*::[*/
  221: {
    /* n:"ScenarioProtect", */
    f: Me
  },
  /*::[*/
  222: {
    /* n:"OleObjectSize", */
  },
  /*::[*/
  224: {
    /* n:"XF", */
    f: Wo
  },
  /*::[*/
  225: {
    /* n:"InterfaceHdr", */
    f: _o
  },
  /*::[*/
  226: {
    /* n:"InterfaceEnd", */
    f: zr
  },
  /*::[*/
  227: {
    /* n:"SXVS", */
  },
  /*::[*/
  229: {
    /* n:"MergeCells", */
    f: qo
  },
  /*::[*/
  233: {
    /* n:"BkHim", */
  },
  /*::[*/
  235: {
    /* n:"MsoDrawingGroup", */
  },
  /*::[*/
  236: {
    /* n:"MsoDrawing", */
  },
  /*::[*/
  237: {
    /* n:"MsoDrawingSelection", */
  },
  /*::[*/
  239: {
    /* n:"PhoneticInfo", */
  },
  /*::[*/
  240: {
    /* n:"SxRule", */
  },
  /*::[*/
  241: {
    /* n:"SXEx", */
  },
  /*::[*/
  242: {
    /* n:"SxFilt", */
  },
  /*::[*/
  244: {
    /* n:"SxDXF", */
  },
  /*::[*/
  245: {
    /* n:"SxItm", */
  },
  /*::[*/
  246: {
    /* n:"SxName", */
  },
  /*::[*/
  247: {
    /* n:"SxSelect", */
  },
  /*::[*/
  248: {
    /* n:"SXPair", */
  },
  /*::[*/
  249: {
    /* n:"SxFmla", */
  },
  /*::[*/
  251: {
    /* n:"SxFormat", */
  },
  /*::[*/
  252: {
    /* n:"SST", */
    f: Ao
  },
  /*::[*/
  253: {
    /* n:"LabelSst", */
    f: Io
  },
  /*::[*/
  255: {
    /* n:"ExtSST", */
    f: Fo
  },
  /*::[*/
  256: {
    /* n:"SXVDEx", */
  },
  /*::[*/
  259: {
    /* n:"SXFormula", */
  },
  /*::[*/
  290: {
    /* n:"SXDBEx", */
  },
  /*::[*/
  311: {
    /* n:"RRDInsDel", */
  },
  /*::[*/
  312: {
    /* n:"RRDHead", */
  },
  /*::[*/
  315: {
    /* n:"RRDChgCell", */
  },
  /*::[*/
  317: {
    /* n:"RRTabId", */
    f: Hi
  },
  /*::[*/
  318: {
    /* n:"RRDRenSheet", */
  },
  /*::[*/
  319: {
    /* n:"RRSort", */
  },
  /*::[*/
  320: {
    /* n:"RRDMove", */
  },
  /*::[*/
  330: {
    /* n:"RRFormat", */
  },
  /*::[*/
  331: {
    /* n:"RRAutoFmt", */
  },
  /*::[*/
  333: {
    /* n:"RRInsertSh", */
  },
  /*::[*/
  334: {
    /* n:"RRDMoveBegin", */
  },
  /*::[*/
  335: {
    /* n:"RRDMoveEnd", */
  },
  /*::[*/
  336: {
    /* n:"RRDInsDelBegin", */
  },
  /*::[*/
  337: {
    /* n:"RRDInsDelEnd", */
  },
  /*::[*/
  338: {
    /* n:"RRDConflict", */
  },
  /*::[*/
  339: {
    /* n:"RRDDefName", */
  },
  /*::[*/
  340: {
    /* n:"RRDRstEtxp", */
  },
  /*::[*/
  351: {
    /* n:"LRng", */
  },
  /*::[*/
  352: {
    /* n:"UsesELFs", */
    f: Me
  },
  /*::[*/
  353: {
    /* n:"DSF", */
    f: zr
  },
  /*::[*/
  401: {
    /* n:"CUsr", */
  },
  /*::[*/
  402: {
    /* n:"CbUsr", */
  },
  /*::[*/
  403: {
    /* n:"UsrInfo", */
  },
  /*::[*/
  404: {
    /* n:"UsrExcl", */
  },
  /*::[*/
  405: {
    /* n:"FileLock", */
  },
  /*::[*/
  406: {
    /* n:"RRDInfo", */
  },
  /*::[*/
  407: {
    /* n:"BCUsrs", */
  },
  /*::[*/
  408: {
    /* n:"UsrChk", */
  },
  /*::[*/
  425: {
    /* n:"UserBView", */
  },
  /*::[*/
  426: {
    /* n:"UserSViewBegin", */
  },
  /*::[*/
  427: {
    /* n:"UserSViewEnd", */
  },
  /*::[*/
  428: {
    /* n:"RRDUserView", */
  },
  /*::[*/
  429: {
    /* n:"Qsi", */
  },
  /*::[*/
  430: {
    /* n:"SupBook", */
    f: Xo
  },
  /*::[*/
  431: {
    /* n:"Prot4Rev", */
    f: Me
  },
  /*::[*/
  432: {
    /* n:"CondFmt", */
  },
  /*::[*/
  433: {
    /* n:"CF", */
  },
  /*::[*/
  434: {
    /* n:"DVal", */
  },
  /*::[*/
  437: {
    /* n:"DConBin", */
  },
  /*::[*/
  438: {
    /* n:"TxO", */
    f: al
  },
  /*::[*/
  439: {
    /* n:"RefreshAll", */
    f: Me
  },
  //
  /*::[*/
  440: {
    /* n:"HLink", */
    f: tl
  },
  /*::[*/
  441: {
    /* n:"Lel", */
  },
  /*::[*/
  442: {
    /* n:"CodeName", */
    f: nt
  },
  /*::[*/
  443: {
    /* n:"SXFDBType", */
  },
  /*::[*/
  444: {
    /* n:"Prot4RevPass", */
    f: Ue
  },
  /*::[*/
  445: {
    /* n:"ObNoMacros", */
  },
  /*::[*/
  446: {
    /* n:"Dv", */
  },
  /*::[*/
  448: {
    /* n:"Excel9File", */
    f: zr
  },
  /*::[*/
  449: {
    /* n:"RecalcId", */
    f: yo,
    r: 2
  },
  /*::[*/
  450: {
    /* n:"EntExU2", */
    f: zr
  },
  /*::[*/
  512: {
    /* n:"Dimensions", */
    f: mn
  },
  /*::[*/
  513: {
    /* n:"Blank", */
    f: ul
  },
  /*::[*/
  515: {
    /* n:"Number", */
    f: Go
  },
  /*::[*/
  516: {
    /* n:"Label", */
    f: Lo
  },
  /*::[*/
  517: {
    /* n:"BoolErr", */
    f: gn
  },
  /*::[*/
  519: {
    /* n:"String", */
    f: xl
  },
  /*::[*/
  520: {
    /* n:"Row", */
    f: So
  },
  /*::[*/
  523: {
    /* n:"Index", */
  },
  /*::[*/
  545: {
    /* n:"Array", */
    f: kn
  },
  /*::[*/
  549: {
    /* n:"DefaultRowHeight", */
    f: vn
  },
  /*::[*/
  566: {
    /* n:"Table", */
  },
  /*::[*/
  574: {
    /* n:"Window2", */
    f: Ro
  },
  /*::[*/
  638: {
    /* n:"RK", */
    f: bo
  },
  /*::[*/
  659: {
    /* n:"Style", */
  },
  /*::[*/
  1048: {
    /* n:"BigName", */
  },
  /*::[*/
  1054: {
    /* n:"Format", */
    f: Po
  },
  /*::[*/
  1084: {
    /* n:"ContinueBigName", */
  },
  /*::[*/
  1212: {
    /* n:"ShrFmla", */
    f: Ko
  },
  /*::[*/
  2048: {
    /* n:"HLinkTooltip", */
    f: nl
  },
  /*::[*/
  2049: {
    /* n:"WebPub", */
  },
  /*::[*/
  2050: {
    /* n:"QsiSXTag", */
  },
  /*::[*/
  2051: {
    /* n:"DBQueryExt", */
  },
  /*::[*/
  2052: {
    /* n:"ExtString", */
  },
  /*::[*/
  2053: {
    /* n:"TxtQry", */
  },
  /*::[*/
  2054: {
    /* n:"Qsir", */
  },
  /*::[*/
  2055: {
    /* n:"Qsif", */
  },
  /*::[*/
  2056: {
    /* n:"RRDTQSIF", */
  },
  /*::[*/
  2057: {
    /* n:"BOF", */
    f: dt
  },
  /*::[*/
  2058: {
    /* n:"OleDbConn", */
  },
  /*::[*/
  2059: {
    /* n:"WOpt", */
  },
  /*::[*/
  2060: {
    /* n:"SXViewEx", */
  },
  /*::[*/
  2061: {
    /* n:"SXTH", */
  },
  /*::[*/
  2062: {
    /* n:"SXPIEx", */
  },
  /*::[*/
  2063: {
    /* n:"SXVDTEx", */
  },
  /*::[*/
  2064: {
    /* n:"SXViewEx9", */
  },
  /*::[*/
  2066: {
    /* n:"ContinueFrt", */
  },
  /*::[*/
  2067: {
    /* n:"RealTimeData", */
  },
  /*::[*/
  2128: {
    /* n:"ChartFrtInfo", */
  },
  /*::[*/
  2129: {
    /* n:"FrtWrapper", */
  },
  /*::[*/
  2130: {
    /* n:"StartBlock", */
  },
  /*::[*/
  2131: {
    /* n:"EndBlock", */
  },
  /*::[*/
  2132: {
    /* n:"StartObject", */
  },
  /*::[*/
  2133: {
    /* n:"EndObject", */
  },
  /*::[*/
  2134: {
    /* n:"CatLab", */
  },
  /*::[*/
  2135: {
    /* n:"YMult", */
  },
  /*::[*/
  2136: {
    /* n:"SXViewLink", */
  },
  /*::[*/
  2137: {
    /* n:"PivotChartBits", */
  },
  /*::[*/
  2138: {
    /* n:"FrtFontList", */
  },
  /*::[*/
  2146: {
    /* n:"SheetExt", */
  },
  /*::[*/
  2147: {
    /* n:"BookExt", */
    r: 12
  },
  /*::[*/
  2148: {
    /* n:"SXAddl", */
  },
  /*::[*/
  2149: {
    /* n:"CrErr", */
  },
  /*::[*/
  2150: {
    /* n:"HFPicture", */
  },
  /*::[*/
  2151: {
    /* n:"FeatHdr", */
    f: zr
  },
  /*::[*/
  2152: {
    /* n:"Feat", */
  },
  /*::[*/
  2154: {
    /* n:"DataLabExt", */
  },
  /*::[*/
  2155: {
    /* n:"DataLabExtContents", */
  },
  /*::[*/
  2156: {
    /* n:"CellWatch", */
  },
  /*::[*/
  2161: {
    /* n:"FeatHdr11", */
  },
  /*::[*/
  2162: {
    /* n:"Feature11", */
  },
  /*::[*/
  2164: {
    /* n:"DropDownObjIds", */
  },
  /*::[*/
  2165: {
    /* n:"ContinueFrt11", */
  },
  /*::[*/
  2166: {
    /* n:"DConn", */
  },
  /*::[*/
  2167: {
    /* n:"List12", */
  },
  /*::[*/
  2168: {
    /* n:"Feature12", */
  },
  /*::[*/
  2169: {
    /* n:"CondFmt12", */
  },
  /*::[*/
  2170: {
    /* n:"CF12", */
  },
  /*::[*/
  2171: {
    /* n:"CFEx", */
  },
  /*::[*/
  2172: {
    /* n:"XFCRC", */
    f: fl,
    r: 12
  },
  /*::[*/
  2173: {
    /* n:"XFExt", */
    f: B1,
    r: 12
  },
  /*::[*/
  2174: {
    /* n:"AutoFilter12", */
  },
  /*::[*/
  2175: {
    /* n:"ContinueFrt12", */
  },
  /*::[*/
  2180: {
    /* n:"MDTInfo", */
  },
  /*::[*/
  2181: {
    /* n:"MDXStr", */
  },
  /*::[*/
  2182: {
    /* n:"MDXTuple", */
  },
  /*::[*/
  2183: {
    /* n:"MDXSet", */
  },
  /*::[*/
  2184: {
    /* n:"MDXProp", */
  },
  /*::[*/
  2185: {
    /* n:"MDXKPI", */
  },
  /*::[*/
  2186: {
    /* n:"MDB", */
  },
  /*::[*/
  2187: {
    /* n:"PLV", */
  },
  /*::[*/
  2188: {
    /* n:"Compat12", */
    f: Me,
    r: 12
  },
  /*::[*/
  2189: {
    /* n:"DXF", */
  },
  /*::[*/
  2190: {
    /* n:"TableStyles", */
    r: 12
  },
  /*::[*/
  2191: {
    /* n:"TableStyle", */
  },
  /*::[*/
  2192: {
    /* n:"TableStyleElement", */
  },
  /*::[*/
  2194: {
    /* n:"StyleExt", */
  },
  /*::[*/
  2195: {
    /* n:"NamePublish", */
  },
  /*::[*/
  2196: {
    /* n:"NameCmt", */
    f: Yo,
    r: 12
  },
  /*::[*/
  2197: {
    /* n:"SortData", */
  },
  /*::[*/
  2198: {
    /* n:"Theme", */
    f: N1,
    r: 12
  },
  /*::[*/
  2199: {
    /* n:"GUIDTypeLib", */
  },
  /*::[*/
  2200: {
    /* n:"FnGrp12", */
  },
  /*::[*/
  2201: {
    /* n:"NameFnGrp12", */
  },
  /*::[*/
  2202: {
    /* n:"MTRSettings", */
    f: jo,
    r: 12
  },
  /*::[*/
  2203: {
    /* n:"CompressPictures", */
    f: zr
  },
  /*::[*/
  2204: {
    /* n:"HeaderFooter", */
  },
  /*::[*/
  2205: {
    /* n:"CrtLayout12", */
  },
  /*::[*/
  2206: {
    /* n:"CrtMlFrt", */
  },
  /*::[*/
  2207: {
    /* n:"CrtMlFrtContinue", */
  },
  /*::[*/
  2211: {
    /* n:"ForceFullCalculation", */
    f: Co
  },
  /*::[*/
  2212: {
    /* n:"ShapePropsStream", */
  },
  /*::[*/
  2213: {
    /* n:"TextPropsStream", */
  },
  /*::[*/
  2214: {
    /* n:"RichTextStream", */
  },
  /*::[*/
  2215: {
    /* n:"CrtLayout12A", */
  },
  /*::[*/
  4097: {
    /* n:"Units", */
  },
  /*::[*/
  4098: {
    /* n:"Chart", */
  },
  /*::[*/
  4099: {
    /* n:"Series", */
  },
  /*::[*/
  4102: {
    /* n:"DataFormat", */
  },
  /*::[*/
  4103: {
    /* n:"LineFormat", */
  },
  /*::[*/
  4105: {
    /* n:"MarkerFormat", */
  },
  /*::[*/
  4106: {
    /* n:"AreaFormat", */
  },
  /*::[*/
  4107: {
    /* n:"PieFormat", */
  },
  /*::[*/
  4108: {
    /* n:"AttachedLabel", */
  },
  /*::[*/
  4109: {
    /* n:"SeriesText", */
  },
  /*::[*/
  4116: {
    /* n:"ChartFormat", */
  },
  /*::[*/
  4117: {
    /* n:"Legend", */
  },
  /*::[*/
  4118: {
    /* n:"SeriesList", */
  },
  /*::[*/
  4119: {
    /* n:"Bar", */
  },
  /*::[*/
  4120: {
    /* n:"Line", */
  },
  /*::[*/
  4121: {
    /* n:"Pie", */
  },
  /*::[*/
  4122: {
    /* n:"Area", */
  },
  /*::[*/
  4123: {
    /* n:"Scatter", */
  },
  /*::[*/
  4124: {
    /* n:"CrtLine", */
  },
  /*::[*/
  4125: {
    /* n:"Axis", */
  },
  /*::[*/
  4126: {
    /* n:"Tick", */
  },
  /*::[*/
  4127: {
    /* n:"ValueRange", */
  },
  /*::[*/
  4128: {
    /* n:"CatSerRange", */
  },
  /*::[*/
  4129: {
    /* n:"AxisLine", */
  },
  /*::[*/
  4130: {
    /* n:"CrtLink", */
  },
  /*::[*/
  4132: {
    /* n:"DefaultText", */
  },
  /*::[*/
  4133: {
    /* n:"Text", */
  },
  /*::[*/
  4134: {
    /* n:"FontX", */
    f: Ue
  },
  /*::[*/
  4135: {
    /* n:"ObjectLink", */
  },
  /*::[*/
  4146: {
    /* n:"Frame", */
  },
  /*::[*/
  4147: {
    /* n:"Begin", */
  },
  /*::[*/
  4148: {
    /* n:"End", */
  },
  /*::[*/
  4149: {
    /* n:"PlotArea", */
  },
  /*::[*/
  4154: {
    /* n:"Chart3d", */
  },
  /*::[*/
  4156: {
    /* n:"PicF", */
  },
  /*::[*/
  4157: {
    /* n:"DropBar", */
  },
  /*::[*/
  4158: {
    /* n:"Radar", */
  },
  /*::[*/
  4159: {
    /* n:"Surf", */
  },
  /*::[*/
  4160: {
    /* n:"RadarArea", */
  },
  /*::[*/
  4161: {
    /* n:"AxisParent", */
  },
  /*::[*/
  4163: {
    /* n:"LegendException", */
  },
  /*::[*/
  4164: {
    /* n:"ShtProps", */
    f: ll
  },
  /*::[*/
  4165: {
    /* n:"SerToCrt", */
  },
  /*::[*/
  4166: {
    /* n:"AxesUsed", */
  },
  /*::[*/
  4168: {
    /* n:"SBaseRef", */
  },
  /*::[*/
  4170: {
    /* n:"SerParent", */
  },
  /*::[*/
  4171: {
    /* n:"SerAuxTrend", */
  },
  /*::[*/
  4174: {
    /* n:"IFmtRecord", */
  },
  /*::[*/
  4175: {
    /* n:"Pos", */
  },
  /*::[*/
  4176: {
    /* n:"AlRuns", */
  },
  /*::[*/
  4177: {
    /* n:"BRAI", */
  },
  /*::[*/
  4187: {
    /* n:"SerAuxErrBar", */
  },
  /*::[*/
  4188: {
    /* n:"ClrtClient", */
    f: sl
  },
  /*::[*/
  4189: {
    /* n:"SerFmt", */
  },
  /*::[*/
  4191: {
    /* n:"Chart3DBarShape", */
  },
  /*::[*/
  4192: {
    /* n:"Fbi", */
  },
  /*::[*/
  4193: {
    /* n:"BopPop", */
  },
  /*::[*/
  4194: {
    /* n:"AxcExt", */
  },
  /*::[*/
  4195: {
    /* n:"Dat", */
  },
  /*::[*/
  4196: {
    /* n:"PlotGrowth", */
  },
  /*::[*/
  4197: {
    /* n:"SIIndex", */
  },
  /*::[*/
  4198: {
    /* n:"GelFrame", */
  },
  /*::[*/
  4199: {
    /* n:"BopPopCustom", */
  },
  /*::[*/
  4200: {
    /* n:"Fbi2", */
  },
  /*::[*/
  0: {
    /* n:"Dimensions", */
    f: mn
  },
  /*::[*/
  1: {
    /* n:"BIFF2BLANK", */
  },
  /*::[*/
  2: {
    /* n:"BIFF2INT", */
    f: ml
  },
  /*::[*/
  3: {
    /* n:"BIFF2NUM", */
    f: vl
  },
  /*::[*/
  4: {
    /* n:"BIFF2STR", */
    f: pl
  },
  /*::[*/
  5: {
    /* n:"BoolErr", */
    f: gn
  },
  /*::[*/
  7: {
    /* n:"String", */
    f: gl
  },
  /*::[*/
  8: {
    /* n:"BIFF2ROW", */
  },
  /*::[*/
  9: {
    /* n:"BOF", */
    f: dt
  },
  /*::[*/
  11: {
    /* n:"Index", */
  },
  /*::[*/
  22: {
    /* n:"ExternCount", */
    f: Ue
  },
  /*::[*/
  30: {
    /* n:"BIFF2FORMAT", */
    f: Mo
  },
  /*::[*/
  31: {
    /* n:"BIFF2FMTCNT", */
  },
  /* 16-bit cnt of BIFF2FORMAT records */
  /*::[*/
  32: {
    /* n:"BIFF2COLINFO", */
  },
  /*::[*/
  33: {
    /* n:"Array", */
    f: kn
  },
  /*::[*/
  36: {
    /* n:"COLWIDTH", */
  },
  /*::[*/
  37: {
    /* n:"DefaultRowHeight", */
    f: vn
  },
  // 0x2c ??
  // 0x2d ??
  // 0x2e ??
  // 0x30 FONTCOUNT: number of fonts
  /*::[*/
  50: {
    /* n:"BIFF2FONTXTRA", */
    f: El
  },
  // 0x35: INFOOPTS
  // 0x36: TABLE (BIFF2 only)
  // 0x37: TABLE2 (BIFF2 only)
  // 0x38: WNDESK
  // 0x39 ??
  // 0x3a: BEGINPREF
  // 0x3b: ENDPREF
  /*::[*/
  62: {
    /* n:"BIFF2WINDOW2", */
  },
  // 0x3f ??
  // 0x46: SHOWSCROLL
  // 0x47: SHOWFORMULA
  // 0x48: STATUSBAR
  // 0x49: SHORTMENUS
  // 0x4A:
  // 0x4B:
  // 0x4C:
  // 0x4E:
  // 0x4F:
  // 0x58: TOOLBAR (BIFF3)
  /* - - - */
  /*::[*/
  52: {
    /* n:"DDEObjName", */
  },
  /*::[*/
  67: {
    /* n:"BIFF2XF", */
  },
  /*::[*/
  68: {
    /* n:"BIFF2XFINDEX", */
    f: Ue
  },
  /*::[*/
  69: {
    /* n:"BIFF2FONTCLR", */
  },
  /*::[*/
  86: {
    /* n:"BIFF4FMTCNT", */
  },
  /* 16-bit cnt, similar to BIFF2 */
  /*::[*/
  126: {
    /* n:"RK", */
  },
  /* Not necessarily same as 0x027e */
  /*::[*/
  127: {
    /* n:"ImData", */
    f: dl
  },
  /*::[*/
  135: {
    /* n:"Addin", */
  },
  /*::[*/
  136: {
    /* n:"Edg", */
  },
  /*::[*/
  137: {
    /* n:"Pub", */
  },
  // 0x8A
  // 0x8B LH: alternate menu key flag (BIFF3/4)
  // 0x8E
  // 0x8F
  /*::[*/
  145: {
    /* n:"Sub", */
  },
  // 0x93 STYLE
  /*::[*/
  148: {
    /* n:"LHRecord", */
  },
  /*::[*/
  149: {
    /* n:"LHNGraph", */
  },
  /*::[*/
  150: {
    /* n:"Sound", */
  },
  // 0xA2 FNPROTO: function prototypes (BIFF4)
  // 0xA3
  // 0xA8
  /*::[*/
  169: {
    /* n:"CoordList", */
  },
  /*::[*/
  171: {
    /* n:"GCW", */
  },
  /*::[*/
  188: {
    /* n:"ShrFmla", */
  },
  /* Not necessarily same as 0x04bc */
  /*::[*/
  191: {
    /* n:"ToolbarHdr", */
  },
  /*::[*/
  192: {
    /* n:"ToolbarEnd", */
  },
  /*::[*/
  194: {
    /* n:"AddMenu", */
  },
  /*::[*/
  195: {
    /* n:"DelMenu", */
  },
  /*::[*/
  214: {
    /* n:"RString", */
    f: _l
  },
  /*::[*/
  223: {
    /* n:"UDDesc", */
  },
  /*::[*/
  234: {
    /* n:"TabIdConf", */
  },
  /*::[*/
  354: {
    /* n:"XL5Modify", */
  },
  /*::[*/
  421: {
    /* n:"FileSharing2", */
  },
  /*::[*/
  518: {
    /* n:"Formula", */
    f: Vt
  },
  /*::[*/
  521: {
    /* n:"BOF", */
    f: dt
  },
  /*::[*/
  536: {
    /* n:"Lbl", */
    f: Tn
  },
  /*::[*/
  547: {
    /* n:"ExternName", */
    f: _n
  },
  /*::[*/
  561: {
    /* n:"Font", */
  },
  /*::[*/
  579: {
    /* n:"BIFF3XF", */
  },
  /*::[*/
  1030: {
    /* n:"Formula", */
    f: Vt
  },
  /*::[*/
  1033: {
    /* n:"BOF", */
    f: dt
  },
  /*::[*/
  1091: {
    /* n:"BIFF4XF", */
  },
  /*::[*/
  2157: {
    /* n:"FeatInfo", */
  },
  /*::[*/
  2163: {
    /* n:"FeatInfo11", */
  },
  /*::[*/
  2177: {
    /* n:"SXAddl12", */
  },
  /*::[*/
  2240: {
    /* n:"AutoWebPub", */
  },
  /*::[*/
  2241: {
    /* n:"ListObj", */
  },
  /*::[*/
  2242: {
    /* n:"ListField", */
  },
  /*::[*/
  2243: {
    /* n:"ListDV", */
  },
  /*::[*/
  2244: {
    /* n:"ListCondFmt", */
  },
  /*::[*/
  2245: {
    /* n:"ListCF", */
  },
  /*::[*/
  2246: {
    /* n:"FMQry", */
  },
  /*::[*/
  2247: {
    /* n:"FMSQry", */
  },
  /*::[*/
  2248: {
    /* n:"PLV", */
  },
  /*::[*/
  2249: {
    /* n:"LnExt", */
  },
  /*::[*/
  2250: {
    /* n:"MkrExt", */
  },
  /*::[*/
  2251: {
    /* n:"CrtCoopt", */
  },
  /*::[*/
  2262: {
    /* n:"FRTArchId$", */
    r: 12
  },
  /*::[*/
  29282: {}
};
function kr(e, a, r, t) {
  var n = a;
  if (!isNaN(n)) {
    var i = (r || []).length || 0, s = e.next(4);
    s.write_shift(2, n), s.write_shift(2, i), /*:: len != null &&*/
    i > 0 && Ci(r) && e.push(r);
  }
}
function In(e, a) {
  var r = a || {}, t = r.dense ? [] : {};
  e = e.replace(/<!--.*?-->/g, "");
  var n = e.match(/<table/i);
  if (!n) throw new Error("Invalid HTML: could not find <table>");
  var i = e.match(/<\/table/i), s = n.index, c = i && i.index || e.length, f = Wc(e.slice(s, c), /(:?<tr[^>]*>)/i, "<tr>"), o = -1, l = 0, u = 0, x = 0, d = { s: { r: 1e7, c: 1e7 }, e: { r: 0, c: 0 } }, p = [];
  for (s = 0; s < f.length; ++s) {
    var h = f[s].trim(), m = h.slice(0, 3).toLowerCase();
    if (m == "<tr") {
      if (++o, r.sheetRows && r.sheetRows <= o) {
        --o;
        break;
      }
      l = 0;
      continue;
    }
    if (!(m != "<td" && m != "<th")) {
      var A = h.split(/<\/t[dh]>/i);
      for (c = 0; c < A.length; ++c) {
        var y = A[c].trim();
        if (y.match(/<t[dh]/i)) {
          for (var E = y, I = 0; E.charAt(0) == "<" && (I = E.indexOf(">")) > -1; ) E = E.slice(I + 1);
          for (var b = 0; b < p.length; ++b) {
            var O = p[b];
            O.s.c == l && O.s.r < o && o <= O.e.r && (l = O.e.c + 1, b = -1);
          }
          var F = oe(y.slice(0, y.indexOf(">")));
          x = F.colspan ? +F.colspan : 1, ((u = +F.rowspan) > 1 || x > 1) && p.push({ s: { r: o, c: l }, e: { r: o + (u || 1) - 1, c: l + x - 1 } });
          var W = F.t || F["data-t"] || "";
          if (!E.length) {
            l += x;
            continue;
          }
          if (E = di(E), d.s.r > o && (d.s.r = o), d.e.r < o && (d.e.r = o), d.s.c > l && (d.s.c = l), d.e.c < l && (d.e.c = l), !E.length) {
            l += x;
            continue;
          }
          var D = { t: "s", v: E };
          r.raw || !E.trim().length || W == "s" || (E === "TRUE" ? D = { t: "b", v: !0 } : E === "FALSE" ? D = { t: "b", v: !1 } : isNaN(Sr(E)) ? isNaN(Aa(E).getDate()) || (D = { t: "d", v: ze(E) }, r.cellDates || (D = { t: "n", v: fr(D.v) }), D.z = r.dateNF || de[14]) : D = { t: "n", v: Sr(E) }), r.dense ? (t[o] || (t[o] = []), t[o][l] = D) : t[he({ r: o, c: l })] = D, l += x;
        }
      }
    }
  }
  return t["!ref"] = _e(d), p.length && (t["!merges"] = p), t;
}
function Ed(e, a, r, t) {
  for (var n = e["!merges"] || [], i = [], s = a.s.c; s <= a.e.c; ++s) {
    for (var c = 0, f = 0, o = 0; o < n.length; ++o)
      if (!(n[o].s.r > r || n[o].s.c > s) && !(n[o].e.r < r || n[o].e.c < s)) {
        if (n[o].s.r < r || n[o].s.c < s) {
          c = -1;
          break;
        }
        c = n[o].e.r - n[o].s.r + 1, f = n[o].e.c - n[o].s.c + 1;
        break;
      }
    if (!(c < 0)) {
      var l = he({ r, c: s }), u = t.dense ? (e[r] || [])[s] : e[l], x = u && u.v != null && (u.h || x0(u.w || (Wr(u), u.w) || "")) || "", d = {};
      c > 1 && (d.rowspan = c), f > 1 && (d.colspan = f), t.editable ? x = '<span contenteditable="true">' + x + "</span>" : u && (d["data-t"] = u && u.t || "z", u.v != null && (d["data-v"] = u.v), u.z != null && (d["data-z"] = u.z), u.l && (u.l.Target || "#").charAt(0) != "#" && (x = '<a href="' + u.l.Target + '">' + x + "</a>")), d.id = (t.id || "sjs") + "-" + l, i.push(tf("td", x, d));
    }
  }
  var p = "<tr>";
  return p + i.join("") + "</tr>";
}
var _d = '<html><head><meta charset="utf-8"/><title>SheetJS Table Export</title></head><body>', Td = "</body></html>";
function kd(e, a) {
  var r = e.match(/<table[\s\S]*?>[\s\S]*?<\/table>/gi);
  if (!r || r.length == 0) throw new Error("Invalid HTML: could not find <table>");
  if (r.length == 1) return Qr(In(r[0], a), a);
  var t = O0();
  return r.forEach(function(n, i) {
    N0(t, In(n, a), "Sheet" + (i + 1));
  }), t;
}
function wd(e, a, r) {
  var t = [];
  return t.join("") + "<table" + (r && r.id ? ' id="' + r.id + '"' : "") + ">";
}
function Ad(e, a) {
  var r = a || {}, t = r.header != null ? r.header : _d, n = r.footer != null ? r.footer : Td, i = [t], s = Ca(e["!ref"]);
  r.dense = Array.isArray(e), i.push(wd(e, s, r));
  for (var c = s.s.r; c <= s.e.r; ++c) i.push(Ed(e, s, c, r));
  return i.push("</table>" + n), i.join("");
}
function Es(e, a, r) {
  var t = r || {}, n = 0, i = 0;
  if (t.origin != null)
    if (typeof t.origin == "number") n = t.origin;
    else {
      var s = typeof t.origin == "string" ? sr(t.origin) : t.origin;
      n = s.r, i = s.c;
    }
  var c = a.getElementsByTagName("tr"), f = Math.min(t.sheetRows || 1e7, c.length), o = { s: { r: 0, c: 0 }, e: { r: n, c: i } };
  if (e["!ref"]) {
    var l = Ca(e["!ref"]);
    o.s.r = Math.min(o.s.r, l.s.r), o.s.c = Math.min(o.s.c, l.s.c), o.e.r = Math.max(o.e.r, l.e.r), o.e.c = Math.max(o.e.c, l.e.c), n == -1 && (o.e.r = n = l.e.r + 1);
  }
  var u = [], x = 0, d = e["!rows"] || (e["!rows"] = []), p = 0, h = 0, m = 0, A = 0, y = 0, E = 0;
  for (e["!cols"] || (e["!cols"] = []); p < c.length && h < f; ++p) {
    var I = c[p];
    if (Ln(I)) {
      if (t.display) continue;
      d[h] = { hidden: !0 };
    }
    var b = I.children;
    for (m = A = 0; m < b.length; ++m) {
      var O = b[m];
      if (!(t.display && Ln(O))) {
        var F = O.hasAttribute("data-v") ? O.getAttribute("data-v") : O.hasAttribute("v") ? O.getAttribute("v") : di(O.innerHTML), W = O.getAttribute("data-z") || O.getAttribute("z");
        for (x = 0; x < u.length; ++x) {
          var D = u[x];
          D.s.c == A + i && D.s.r < h + n && h + n <= D.e.r && (A = D.e.c + 1 - i, x = -1);
        }
        E = +O.getAttribute("colspan") || 1, ((y = +O.getAttribute("rowspan") || 1) > 1 || E > 1) && u.push({ s: { r: h + n, c: A + i }, e: { r: h + n + (y || 1) - 1, c: A + i + (E || 1) - 1 } });
        var z = { t: "s", v: F }, G = O.getAttribute("data-t") || O.getAttribute("t") || "";
        F != null && (F.length == 0 ? z.t = G || "z" : t.raw || F.trim().length == 0 || G == "s" || (F === "TRUE" ? z = { t: "b", v: !0 } : F === "FALSE" ? z = { t: "b", v: !1 } : isNaN(Sr(F)) ? isNaN(Aa(F).getDate()) || (z = { t: "d", v: ze(F) }, t.cellDates || (z = { t: "n", v: fr(z.v) }), z.z = t.dateNF || de[14]) : z = { t: "n", v: Sr(F) })), z.z === void 0 && W != null && (z.z = W);
        var L = "", J = O.getElementsByTagName("A");
        if (J && J.length) for (var fe = 0; fe < J.length && !(J[fe].hasAttribute("href") && (L = J[fe].getAttribute("href"), L.charAt(0) != "#")); ++fe) ;
        L && L.charAt(0) != "#" && (z.l = { Target: L }), t.dense ? (e[h + n] || (e[h + n] = []), e[h + n][A + i] = z) : e[he({ c: A + i, r: h + n })] = z, o.e.c < A + i && (o.e.c = A + i), A += E;
      }
    }
    ++h;
  }
  return u.length && (e["!merges"] = (e["!merges"] || []).concat(u)), o.e.r = Math.max(o.e.r, h - 1 + n), e["!ref"] = _e(o), h >= f && (e["!fullref"] = _e((o.e.r = c.length - p + h - 1 + n, o))), e;
}
function _s(e, a) {
  var r = a || {}, t = r.dense ? [] : {};
  return Es(t, e, a);
}
function Fd(e, a) {
  return Qr(_s(e, a), a);
}
function Ln(e) {
  var a = "", r = Sd(e);
  return r && (a = r(e).getPropertyValue("display")), a || (a = e.style && e.style.display), a === "none";
}
function Sd(e) {
  return e.ownerDocument.defaultView && typeof e.ownerDocument.defaultView.getComputedStyle == "function" ? e.ownerDocument.defaultView.getComputedStyle : typeof getComputedStyle == "function" ? getComputedStyle : null;
}
function Cd(e) {
  var a = e.replace(/[\t\r\n]/g, " ").trim().replace(/ +/g, " ").replace(/<text:s\/>/g, " ").replace(/<text:s text:c="(\d+)"\/>/g, function(t, n) {
    return Array(parseInt(n, 10) + 1).join(" ");
  }).replace(/<text:tab[^>]*\/>/g, "	").replace(/<text:line-break\/>/g, `
`), r = ke(a.replace(/<[^>]*>/g, ""));
  return [r];
}
var Pn = {
  /* ods name: [short ssf fmt, long ssf fmt] */
  day: ["d", "dd"],
  month: ["m", "mm"],
  year: ["y", "yy"],
  hours: ["h", "hh"],
  minutes: ["m", "mm"],
  seconds: ["s", "ss"],
  "am-pm": ["A/P", "AM/PM"],
  "day-of-week": ["ddd", "dddd"],
  era: ["e", "ee"],
  /* there is no native representation of LO "Q" format */
  quarter: ["\\Qm", 'm\\"th quarter"']
};
function Ts(e, a) {
  var r = a || {}, t = d0(e), n = [], i, s, c = { name: "" }, f = "", o = 0, l, u, x = {}, d = [], p = r.dense ? [] : {}, h, m, A = { value: "" }, y = "", E = 0, I = [], b = -1, O = -1, F = { s: { r: 1e6, c: 1e7 }, e: { r: 0, c: 0 } }, W = 0, D = {}, z = [], G = {}, L = 0, J = 0, fe = [], re = 1, ce = 1, se = [], Se = { Names: [] }, V = {}, le = ["", ""], ue = [], S = {}, U = "", N = 0, R = !1, Y = !1, ee = 0;
  for (Ja.lastIndex = 0, t = t.replace(/<!--([\s\S]*?)-->/mg, "").replace(/<!DOCTYPE[^\[]*\[[^\]]*\]>/gm, ""); h = Ja.exec(t); ) switch (h[3] = h[3].replace(/_.*$/, "")) {
    case "table":
    case "工作表":
      h[1] === "/" ? (F.e.c >= F.s.c && F.e.r >= F.s.r ? p["!ref"] = _e(F) : p["!ref"] = "A1:A1", r.sheetRows > 0 && r.sheetRows <= F.e.r && (p["!fullref"] = p["!ref"], F.e.r = r.sheetRows - 1, p["!ref"] = _e(F)), z.length && (p["!merges"] = z), fe.length && (p["!rows"] = fe), l.name = l.名称 || l.name, typeof JSON < "u" && JSON.stringify(l), d.push(l.name), x[l.name] = p, Y = !1) : h[0].charAt(h[0].length - 2) !== "/" && (l = oe(h[0], !1), b = O = -1, F.s.r = F.s.c = 1e7, F.e.r = F.e.c = 0, p = r.dense ? [] : {}, z = [], fe = [], Y = !0);
      break;
    case "table-row-group":
      h[1] === "/" ? --W : ++W;
      break;
    case "table-row":
    case "行":
      if (h[1] === "/") {
        b += re, re = 1;
        break;
      }
      if (u = oe(h[0], !1), u.行号 ? b = u.行号 - 1 : b == -1 && (b = 0), re = +u["number-rows-repeated"] || 1, re < 10) for (ee = 0; ee < re; ++ee) W > 0 && (fe[b + ee] = { level: W });
      O = -1;
      break;
    case "covered-table-cell":
      h[1] !== "/" && ++O, r.sheetStubs && (r.dense ? (p[b] || (p[b] = []), p[b][O] = { t: "z" }) : p[he({ r: b, c: O })] = { t: "z" }), y = "", I = [];
      break;
    case "table-cell":
    case "数据":
      if (h[0].charAt(h[0].length - 2) === "/")
        ++O, A = oe(h[0], !1), ce = parseInt(A["number-columns-repeated"] || "1", 10), m = {
          t: "z",
          v: null
          /*:: , z:null, w:"",c:[]*/
        }, A.formula && r.cellFormula != !1 && (m.f = Dn(ke(A.formula))), (A.数据类型 || A["value-type"]) == "string" && (m.t = "s", m.v = ke(A["string-value"] || ""), r.dense ? (p[b] || (p[b] = []), p[b][O] = m) : p[he({ r: b, c: O })] = m), O += ce - 1;
      else if (h[1] !== "/") {
        ++O, y = "", E = 0, I = [], ce = 1;
        var ne = re ? b + re - 1 : b;
        if (O > F.e.c && (F.e.c = O), O < F.s.c && (F.s.c = O), b < F.s.r && (F.s.r = b), ne > F.e.r && (F.e.r = ne), A = oe(h[0], !1), ue = [], S = {}, m = {
          t: A.数据类型 || A["value-type"],
          v: null
          /*:: , z:null, w:"",c:[]*/
        }, r.cellFormula)
          if (A.formula && (A.formula = ke(A.formula)), A["number-matrix-columns-spanned"] && A["number-matrix-rows-spanned"] && (L = parseInt(A["number-matrix-rows-spanned"], 10) || 0, J = parseInt(A["number-matrix-columns-spanned"], 10) || 0, G = { s: { r: b, c: O }, e: { r: b + L - 1, c: O + J - 1 } }, m.F = _e(G), se.push([G, m.F])), A.formula) m.f = Dn(A.formula);
          else for (ee = 0; ee < se.length; ++ee)
            b >= se[ee][0].s.r && b <= se[ee][0].e.r && O >= se[ee][0].s.c && O <= se[ee][0].e.c && (m.F = se[ee][1]);
        switch ((A["number-columns-spanned"] || A["number-rows-spanned"]) && (L = parseInt(A["number-rows-spanned"], 10) || 0, J = parseInt(A["number-columns-spanned"], 10) || 0, G = { s: { r: b, c: O }, e: { r: b + L - 1, c: O + J - 1 } }, z.push(G)), A["number-columns-repeated"] && (ce = parseInt(A["number-columns-repeated"], 10)), m.t) {
          case "boolean":
            m.t = "b", m.v = Ce(A["boolean-value"]);
            break;
          case "float":
            m.t = "n", m.v = parseFloat(A.value);
            break;
          case "percentage":
            m.t = "n", m.v = parseFloat(A.value);
            break;
          case "currency":
            m.t = "n", m.v = parseFloat(A.value);
            break;
          case "date":
            m.t = "d", m.v = ze(A["date-value"]), r.cellDates || (m.t = "n", m.v = fr(m.v)), m.z = "m/d/yy";
            break;
          case "time":
            m.t = "n", m.v = Bc(A["time-value"]) / 86400, r.cellDates && (m.t = "d", m.v = Ot(m.v)), m.z = "HH:MM:SS";
            break;
          case "number":
            m.t = "n", m.v = parseFloat(A.数据数值);
            break;
          default:
            if (m.t === "string" || m.t === "text" || !m.t)
              m.t = "s", A["string-value"] != null && (y = ke(A["string-value"]), I = []);
            else throw new Error("Unsupported value type " + m.t);
        }
      } else {
        if (R = !1, m.t === "s" && (m.v = y || "", I.length && (m.R = I), R = E == 0), V.Target && (m.l = V), ue.length > 0 && (m.c = ue, ue = []), y && r.cellText !== !1 && (m.w = y), R && (m.t = "z", delete m.v), (!R || r.sheetStubs) && !(r.sheetRows && r.sheetRows <= b))
          for (var q = 0; q < re; ++q) {
            if (ce = parseInt(A["number-columns-repeated"] || "1", 10), r.dense)
              for (p[b + q] || (p[b + q] = []), p[b + q][O] = q == 0 ? m : Ye(m); --ce > 0; ) p[b + q][O + ce] = Ye(m);
            else
              for (p[he({ r: b + q, c: O })] = m; --ce > 0; ) p[he({ r: b + q, c: O + ce })] = Ye(m);
            F.e.c <= O && (F.e.c = O);
          }
        ce = parseInt(A["number-columns-repeated"] || "1", 10), O += ce - 1, ce = 0, m = {
          /*:: t:"", v:null, z:null, w:"",c:[]*/
        }, y = "", I = [];
      }
      V = {};
      break;
    case "document":
    case "document-content":
    case "电子表格文档":
    case "spreadsheet":
    case "主体":
    case "scripts":
    case "styles":
    case "font-face-decls":
    case "master-styles":
      if (h[1] === "/") {
        if ((i = n.pop())[0] !== h[3]) throw "Bad state: " + i;
      } else h[0].charAt(h[0].length - 2) !== "/" && n.push([h[3], !0]);
      break;
    case "annotation":
      if (h[1] === "/") {
        if ((i = n.pop())[0] !== h[3]) throw "Bad state: " + i;
        S.t = y, I.length && (S.R = I), S.a = U, ue.push(S);
      } else h[0].charAt(h[0].length - 2) !== "/" && n.push([h[3], !1]);
      U = "", N = 0, y = "", E = 0, I = [];
      break;
    case "creator":
      h[1] === "/" ? U = t.slice(N, h.index) : N = h.index + h[0].length;
      break;
    case "meta":
    case "元数据":
    case "settings":
    case "config-item-set":
    case "config-item-map-indexed":
    case "config-item-map-entry":
    case "config-item-map-named":
    case "shapes":
    case "frame":
    case "text-box":
    case "image":
    case "data-pilot-tables":
    case "list-style":
    case "form":
    case "dde-links":
    case "event-listeners":
    case "chart":
      if (h[1] === "/") {
        if ((i = n.pop())[0] !== h[3]) throw "Bad state: " + i;
      } else h[0].charAt(h[0].length - 2) !== "/" && n.push([h[3], !1]);
      y = "", E = 0, I = [];
      break;
    case "scientific-number":
      break;
    case "currency-symbol":
      break;
    case "currency-style":
      break;
    case "number-style":
    case "percentage-style":
    case "date-style":
    case "time-style":
      if (h[1] === "/") {
        if (D[c.name] = f, (i = n.pop())[0] !== h[3]) throw "Bad state: " + i;
      } else h[0].charAt(h[0].length - 2) !== "/" && (f = "", c = oe(h[0], !1), n.push([h[3], !0]));
      break;
    case "script":
      break;
    case "libraries":
      break;
    case "automatic-styles":
      break;
    case "default-style":
    case "page-layout":
      break;
    case "style":
      break;
    case "map":
      break;
    case "font-face":
      break;
    case "paragraph-properties":
      break;
    case "table-properties":
      break;
    case "table-column-properties":
      break;
    case "table-row-properties":
      break;
    case "table-cell-properties":
      break;
    case "number":
      switch (n[n.length - 1][0]) {
        case "time-style":
        case "date-style":
          s = oe(h[0], !1), f += Pn[h[3]][s.style === "long" ? 1 : 0];
          break;
      }
      break;
    case "fraction":
      break;
    case "day":
    case "month":
    case "year":
    case "era":
    case "day-of-week":
    case "week-of-year":
    case "quarter":
    case "hours":
    case "minutes":
    case "seconds":
    case "am-pm":
      switch (n[n.length - 1][0]) {
        case "time-style":
        case "date-style":
          s = oe(h[0], !1), f += Pn[h[3]][s.style === "long" ? 1 : 0];
          break;
      }
      break;
    case "boolean-style":
      break;
    case "boolean":
      break;
    case "text-style":
      break;
    case "text":
      if (h[0].slice(-2) === "/>") break;
      if (h[1] === "/") switch (n[n.length - 1][0]) {
        case "number-style":
        case "date-style":
        case "time-style":
          f += t.slice(o, h.index);
          break;
      }
      else o = h.index + h[0].length;
      break;
    case "named-range":
      s = oe(h[0], !1), le = Gt(s["cell-range-address"]);
      var j = { Name: s.name, Ref: le[0] + "!" + le[1] };
      Y && (j.Sheet = d.length), Se.Names.push(j);
      break;
    case "text-content":
      break;
    case "text-properties":
      break;
    case "embedded-text":
      break;
    case "body":
    case "电子表格":
      break;
    case "forms":
      break;
    case "table-column":
      break;
    case "table-header-rows":
      break;
    case "table-rows":
      break;
    case "table-column-group":
      break;
    case "table-header-columns":
      break;
    case "table-columns":
      break;
    case "null-date":
      break;
    case "graphic-properties":
      break;
    case "calculation-settings":
      break;
    case "named-expressions":
      break;
    case "label-range":
      break;
    case "label-ranges":
      break;
    case "named-expression":
      break;
    case "sort":
      break;
    case "sort-by":
      break;
    case "sort-groups":
      break;
    case "tab":
      break;
    case "line-break":
      break;
    case "span":
      break;
    case "p":
    case "文本串":
      if (["master-styles"].indexOf(n[n.length - 1][0]) > -1) break;
      if (h[1] === "/" && (!A || !A["string-value"])) {
        var Te = Cd(t.slice(E, h.index));
        y = (y.length > 0 ? y + `
` : "") + Te[0];
      } else
        oe(h[0], !1), E = h.index + h[0].length;
      break;
    case "s":
      break;
    case "database-range":
      if (h[1] === "/") break;
      try {
        le = Gt(oe(h[0])["target-range-address"]), x[le[0]]["!autofilter"] = { ref: le[1] };
      } catch {
      }
      break;
    case "date":
      break;
    case "object":
      break;
    case "title":
    case "标题":
      break;
    case "desc":
      break;
    case "binary-data":
      break;
    case "table-source":
      break;
    case "scenario":
      break;
    case "iteration":
      break;
    case "content-validations":
      break;
    case "content-validation":
      break;
    case "help-message":
      break;
    case "error-message":
      break;
    case "database-ranges":
      break;
    case "filter":
      break;
    case "filter-and":
      break;
    case "filter-or":
      break;
    case "filter-condition":
      break;
    case "list-level-style-bullet":
      break;
    case "list-level-style-number":
      break;
    case "list-level-properties":
      break;
    case "sender-firstname":
    case "sender-lastname":
    case "sender-initials":
    case "sender-title":
    case "sender-position":
    case "sender-email":
    case "sender-phone-private":
    case "sender-fax":
    case "sender-company":
    case "sender-phone-work":
    case "sender-street":
    case "sender-city":
    case "sender-postal-code":
    case "sender-country":
    case "sender-state-or-province":
    case "author-name":
    case "author-initials":
    case "chapter":
    case "file-name":
    case "template-name":
    case "sheet-name":
      break;
    case "event-listener":
      break;
    case "initial-creator":
    case "creation-date":
    case "print-date":
    case "generator":
    case "document-statistic":
    case "user-defined":
    case "editing-duration":
    case "editing-cycles":
      break;
    case "config-item":
      break;
    case "page-number":
      break;
    case "page-count":
      break;
    case "time":
      break;
    case "cell-range-source":
      break;
    case "detective":
      break;
    case "operation":
      break;
    case "highlighted-range":
      break;
    case "data-pilot-table":
    case "source-cell-range":
    case "source-service":
    case "data-pilot-field":
    case "data-pilot-level":
    case "data-pilot-subtotals":
    case "data-pilot-subtotal":
    case "data-pilot-members":
    case "data-pilot-member":
    case "data-pilot-display-info":
    case "data-pilot-sort-info":
    case "data-pilot-layout-info":
    case "data-pilot-field-reference":
    case "data-pilot-groups":
    case "data-pilot-group":
    case "data-pilot-group-member":
      break;
    case "rect":
      break;
    case "dde-connection-decls":
    case "dde-connection-decl":
    case "dde-link":
    case "dde-source":
      break;
    case "properties":
      break;
    case "property":
      break;
    case "a":
      if (h[1] !== "/") {
        if (V = oe(h[0], !1), !V.href) break;
        V.Target = ke(V.href), delete V.href, V.Target.charAt(0) == "#" && V.Target.indexOf(".") > -1 ? (le = Gt(V.Target.slice(1)), V.Target = "#" + le[0] + "!" + le[1]) : V.Target.match(/^\.\.[\\\/]/) && (V.Target = V.Target.slice(3));
      }
      break;
    case "table-protection":
      break;
    case "data-pilot-grand-total":
      break;
    case "office-document-common-attrs":
      break;
    default:
      switch (h[2]) {
        case "dc:":
        case "calcext:":
        case "loext:":
        case "ooo:":
        case "chartooo:":
        case "draw:":
        case "style:":
        case "chart:":
        case "form:":
        case "uof:":
        case "表:":
        case "字:":
          break;
        default:
          if (r.WTF) throw new Error(h);
      }
  }
  var C = {
    Sheets: x,
    SheetNames: d,
    Workbook: Se
  };
  return r.bookSheets && delete /*::(*/
  C.Sheets, C;
}
function Mn(e, a) {
  a = a || {}, gr(e, "META-INF/manifest.xml") && Vf(Be(e, "META-INF/manifest.xml"), a);
  var r = hr(e, "content.xml");
  if (!r) throw new Error("Missing content.xml in ODS / UOF file");
  var t = Ts(Fe(r), a);
  return gr(e, "meta.xml") && (t.Props = Li(Be(e, "meta.xml"))), t;
}
function bn(e, a) {
  return Ts(e, a);
}
/*! sheetjs (C) 2013-present SheetJS -- http://sheetjs.com */
function C0(e) {
  return new DataView(e.buffer, e.byteOffset, e.byteLength);
}
function r0(e) {
  return typeof TextDecoder < "u" ? new TextDecoder().decode(e) : Fe(ha(e));
}
function a0(e) {
  var a = e.reduce(function(n, i) {
    return n + i.length;
  }, 0), r = new Uint8Array(a), t = 0;
  return e.forEach(function(n) {
    r.set(n, t), t += n.length;
  }), r;
}
function Bn(e) {
  return e -= e >> 1 & 1431655765, e = (e & 858993459) + (e >> 2 & 858993459), (e + (e >> 4) & 252645135) * 16843009 >>> 24;
}
function yd(e, a) {
  for (var r = (e[a + 15] & 127) << 7 | e[a + 14] >> 1, t = e[a + 14] & 1, n = a + 13; n >= a; --n)
    t = t * 256 + e[n];
  return (e[a + 15] & 128 ? -t : t) * Math.pow(10, r - 6176);
}
function et(e, a) {
  var r = a ? a[0] : 0, t = e[r] & 127;
  e:
    if (e[r++] >= 128 && (t |= (e[r] & 127) << 7, e[r++] < 128 || (t |= (e[r] & 127) << 14, e[r++] < 128) || (t |= (e[r] & 127) << 21, e[r++] < 128) || (t += (e[r] & 127) * Math.pow(2, 28), ++r, e[r++] < 128) || (t += (e[r] & 127) * Math.pow(2, 35), ++r, e[r++] < 128) || (t += (e[r] & 127) * Math.pow(2, 42), ++r, e[r++] < 128)))
      break e;
  return a && (a[0] = r), t;
}
function Ge(e) {
  var a = 0, r = e[a] & 127;
  e:
    if (e[a++] >= 128) {
      if (r |= (e[a] & 127) << 7, e[a++] < 128 || (r |= (e[a] & 127) << 14, e[a++] < 128) || (r |= (e[a] & 127) << 21, e[a++] < 128))
        break e;
      r |= (e[a] & 127) << 28;
    }
  return r;
}
function Qe(e) {
  for (var a = [], r = [0]; r[0] < e.length; ) {
    var t = r[0], n = et(e, r), i = n & 7;
    n = Math.floor(n / 8);
    var s = 0, c;
    if (n == 0)
      break;
    switch (i) {
      case 0:
        {
          for (var f = r[0]; e[r[0]++] >= 128; )
            ;
          c = e.slice(f, r[0]);
        }
        break;
      case 5:
        s = 4, c = e.slice(r[0], r[0] + s), r[0] += s;
        break;
      case 1:
        s = 8, c = e.slice(r[0], r[0] + s), r[0] += s;
        break;
      case 2:
        s = et(e, r), c = e.slice(r[0], r[0] + s), r[0] += s;
        break;
      case 3:
      case 4:
      default:
        throw new Error("PB Type ".concat(i, " for Field ").concat(n, " at offset ").concat(t));
    }
    var o = { data: c, type: i };
    a[n] == null ? a[n] = [o] : a[n].push(o);
  }
  return a;
}
function y0(e, a) {
  return (e == null ? void 0 : e.map(function(r) {
    return a(r.data);
  })) || [];
}
function Dd(e) {
  for (var a, r = [], t = [0]; t[0] < e.length; ) {
    var n = et(e, t), i = Qe(e.slice(t[0], t[0] + n));
    t[0] += n;
    var s = {
      id: Ge(i[1][0].data),
      messages: []
    };
    i[2].forEach(function(c) {
      var f = Qe(c.data), o = Ge(f[3][0].data);
      s.messages.push({
        meta: f,
        data: e.slice(t[0], t[0] + o)
      }), t[0] += o;
    }), (a = i[3]) != null && a[0] && (s.merge = Ge(i[3][0].data) >>> 0 > 0), r.push(s);
  }
  return r;
}
function Rd(e, a) {
  if (e != 0)
    throw new Error("Unexpected Snappy chunk type ".concat(e));
  for (var r = [0], t = et(a, r), n = []; r[0] < a.length; ) {
    var i = a[r[0]] & 3;
    if (i == 0) {
      var s = a[r[0]++] >> 2;
      if (s < 60)
        ++s;
      else {
        var c = s - 59;
        s = a[r[0]], c > 1 && (s |= a[r[0] + 1] << 8), c > 2 && (s |= a[r[0] + 2] << 16), c > 3 && (s |= a[r[0] + 3] << 24), s >>>= 0, s++, r[0] += c;
      }
      n.push(a.slice(r[0], r[0] + s)), r[0] += s;
      continue;
    } else {
      var f = 0, o = 0;
      if (i == 1 ? (o = (a[r[0]] >> 2 & 7) + 4, f = (a[r[0]++] & 224) << 3, f |= a[r[0]++]) : (o = (a[r[0]++] >> 2) + 1, i == 2 ? (f = a[r[0]] | a[r[0] + 1] << 8, r[0] += 2) : (f = (a[r[0]] | a[r[0] + 1] << 8 | a[r[0] + 2] << 16 | a[r[0] + 3] << 24) >>> 0, r[0] += 4)), n = [a0(n)], f == 0)
        throw new Error("Invalid offset 0");
      if (f > n[0].length)
        throw new Error("Invalid offset beyond length");
      if (o >= f)
        for (n.push(n[0].slice(-f)), o -= f; o >= n[n.length - 1].length; )
          n.push(n[n.length - 1]), o -= n[n.length - 1].length;
      n.push(n[0].slice(-f, -f + o));
    }
  }
  var l = a0(n);
  if (l.length != t)
    throw new Error("Unexpected length: ".concat(l.length, " != ").concat(t));
  return l;
}
function Od(e) {
  for (var a = [], r = 0; r < e.length; ) {
    var t = e[r++], n = e[r] | e[r + 1] << 8 | e[r + 2] << 16;
    r += 3, a.push(Rd(t, e.slice(r, r + n))), r += n;
  }
  if (r !== e.length)
    throw new Error("data is not a valid framed stream!");
  return a0(a);
}
function Nd(e, a, r, t) {
  var n = C0(e), i = n.getUint32(4, !0), s = (t > 1 ? 12 : 8) + Bn(i & (t > 1 ? 3470 : 398)) * 4, c = -1, f = -1, o = NaN, l = new Date(2001, 0, 1);
  i & 512 && (c = n.getUint32(s, !0), s += 4), s += Bn(i & (t > 1 ? 12288 : 4096)) * 4, i & 16 && (f = n.getUint32(s, !0), s += 4), i & 32 && (o = n.getFloat64(s, !0), s += 8), i & 64 && (l.setTime(l.getTime() + n.getFloat64(s, !0) * 1e3), s += 8);
  var u;
  switch (e[2]) {
    case 0:
      break;
    case 2:
      u = { t: "n", v: o };
      break;
    case 3:
      u = { t: "s", v: a[f] };
      break;
    case 5:
      u = { t: "d", v: l };
      break;
    case 6:
      u = { t: "b", v: o > 0 };
      break;
    case 7:
      u = { t: "n", v: o / 86400 };
      break;
    case 8:
      u = { t: "e", v: 0 };
      break;
    case 9:
      if (c > -1)
        u = { t: "s", v: r[c] };
      else if (f > -1)
        u = { t: "s", v: a[f] };
      else if (!isNaN(o))
        u = { t: "n", v: o };
      else
        throw new Error("Unsupported cell type ".concat(e.slice(0, 4)));
      break;
    default:
      throw new Error("Unsupported cell type ".concat(e.slice(0, 4)));
  }
  return u;
}
function Id(e, a, r) {
  var t = C0(e), n = t.getUint32(8, !0), i = 12, s = -1, c = -1, f = NaN, o = NaN, l = new Date(2001, 0, 1);
  n & 1 && (f = yd(e, i), i += 16), n & 2 && (o = t.getFloat64(i, !0), i += 8), n & 4 && (l.setTime(l.getTime() + t.getFloat64(i, !0) * 1e3), i += 8), n & 8 && (c = t.getUint32(i, !0), i += 4), n & 16 && (s = t.getUint32(i, !0), i += 4);
  var u;
  switch (e[1]) {
    case 0:
      break;
    case 2:
      u = { t: "n", v: f };
      break;
    case 3:
      u = { t: "s", v: a[c] };
      break;
    case 5:
      u = { t: "d", v: l };
      break;
    case 6:
      u = { t: "b", v: o > 0 };
      break;
    case 7:
      u = { t: "n", v: o / 86400 };
      break;
    case 8:
      u = { t: "e", v: 0 };
      break;
    case 9:
      if (s > -1)
        u = { t: "s", v: r[s] };
      else
        throw new Error("Unsupported cell type ".concat(e[1], " : ").concat(n & 31, " : ").concat(e.slice(0, 4)));
      break;
    case 10:
      u = { t: "n", v: f };
      break;
    default:
      throw new Error("Unsupported cell type ".concat(e[1], " : ").concat(n & 31, " : ").concat(e.slice(0, 4)));
  }
  return u;
}
function Ld(e, a, r) {
  switch (e[0]) {
    case 0:
    case 1:
    case 2:
    case 3:
      return Nd(e, a, r, e[0]);
    case 5:
      return Id(e, a, r);
    default:
      throw new Error("Unsupported payload version ".concat(e[0]));
  }
}
function Jr(e) {
  var a = Qe(e);
  return et(a[1][0].data);
}
function Un(e, a) {
  var r = Qe(a.data), t = Ge(r[1][0].data), n = r[3], i = [];
  return (n || []).forEach(function(s) {
    var c = Qe(s.data), f = Ge(c[1][0].data) >>> 0;
    switch (t) {
      case 1:
        i[f] = r0(c[3][0].data);
        break;
      case 8:
        {
          var o = e[Jr(c[9][0].data)][0], l = Qe(o.data), u = e[Jr(l[1][0].data)][0], x = Ge(u.meta[1][0].data);
          if (x != 2001)
            throw new Error("2000 unexpected reference to ".concat(x));
          var d = Qe(u.data);
          i[f] = d[3].map(function(p) {
            return r0(p.data);
          }).join("");
        }
        break;
    }
  }), i;
}
function Pd(e, a) {
  var r, t, n, i, s, c, f, o, l, u, x, d, p, h, m = Qe(e), A = Ge(m[1][0].data) >>> 0, y = Ge(m[2][0].data) >>> 0, E = ((t = (r = m[8]) == null ? void 0 : r[0]) == null ? void 0 : t.data) && Ge(m[8][0].data) > 0 || !1, I, b;
  if ((i = (n = m[7]) == null ? void 0 : n[0]) != null && i.data && a != 0)
    I = (c = (s = m[7]) == null ? void 0 : s[0]) == null ? void 0 : c.data, b = (o = (f = m[6]) == null ? void 0 : f[0]) == null ? void 0 : o.data;
  else if ((u = (l = m[4]) == null ? void 0 : l[0]) != null && u.data && a != 1)
    I = (d = (x = m[4]) == null ? void 0 : x[0]) == null ? void 0 : d.data, b = (h = (p = m[3]) == null ? void 0 : p[0]) == null ? void 0 : h.data;
  else
    throw "NUMBERS Tile missing ".concat(a, " cell storage");
  for (var O = E ? 4 : 1, F = C0(I), W = [], D = 0; D < I.length / 2; ++D) {
    var z = F.getUint16(D * 2, !0);
    z < 65535 && W.push([D, z]);
  }
  if (W.length != y)
    throw "Expected ".concat(y, " cells, found ").concat(W.length);
  var G = [];
  for (D = 0; D < W.length - 1; ++D)
    G[W[D][0]] = b.subarray(W[D][1] * O, W[D + 1][1] * O);
  return W.length >= 1 && (G[W[W.length - 1][0]] = b.subarray(W[W.length - 1][1] * O)), { R: A, cells: G };
}
function Md(e, a) {
  var r, t = Qe(a.data), n = (r = t == null ? void 0 : t[7]) != null && r[0] ? Ge(t[7][0].data) >>> 0 > 0 ? 1 : 0 : -1, i = y0(t[5], function(s) {
    return Pd(s, n);
  });
  return {
    nrows: Ge(t[4][0].data) >>> 0,
    data: i.reduce(function(s, c) {
      return s[c.R] || (s[c.R] = []), c.cells.forEach(function(f, o) {
        if (s[c.R][o])
          throw new Error("Duplicate cell r=".concat(c.R, " c=").concat(o));
        s[c.R][o] = f;
      }), s;
    }, [])
  };
}
function bd(e, a, r) {
  var t, n = Qe(a.data), i = { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
  if (i.e.r = (Ge(n[6][0].data) >>> 0) - 1, i.e.r < 0)
    throw new Error("Invalid row varint ".concat(n[6][0].data));
  if (i.e.c = (Ge(n[7][0].data) >>> 0) - 1, i.e.c < 0)
    throw new Error("Invalid col varint ".concat(n[7][0].data));
  r["!ref"] = _e(i);
  var s = Qe(n[4][0].data), c = Un(e, e[Jr(s[4][0].data)][0]), f = (t = s[17]) != null && t[0] ? Un(e, e[Jr(s[17][0].data)][0]) : [], o = Qe(s[3][0].data), l = 0;
  o[1].forEach(function(u) {
    var x = Qe(u.data), d = e[Jr(x[2][0].data)][0], p = Ge(d.meta[1][0].data);
    if (p != 6002)
      throw new Error("6001 unexpected reference to ".concat(p));
    var h = Md(e, d);
    h.data.forEach(function(m, A) {
      m.forEach(function(y, E) {
        var I = he({ r: l + A, c: E }), b = Ld(y, c, f);
        b && (r[I] = b);
      });
    }), l += h.nrows;
  });
}
function Bd(e, a) {
  var r = Qe(a.data), t = { "!ref": "A1" }, n = e[Jr(r[2][0].data)], i = Ge(n[0].meta[1][0].data);
  if (i != 6001)
    throw new Error("6000 unexpected reference to ".concat(i));
  return bd(e, n[0], t), t;
}
function Ud(e, a) {
  var r, t = Qe(a.data), n = {
    name: (r = t[1]) != null && r[0] ? r0(t[1][0].data) : "",
    sheets: []
  }, i = y0(t[2], Jr);
  return i.forEach(function(s) {
    e[s].forEach(function(c) {
      var f = Ge(c.meta[1][0].data);
      f == 6e3 && n.sheets.push(Bd(e, c));
    });
  }), n;
}
function Hd(e, a) {
  var r = O0(), t = Qe(a.data), n = y0(t[1], Jr);
  if (n.forEach(function(i) {
    e[i].forEach(function(s) {
      var c = Ge(s.meta[1][0].data);
      if (c == 2) {
        var f = Ud(e, s);
        f.sheets.forEach(function(o, l) {
          N0(r, o, l == 0 ? f.name : f.name + "_" + l, !0);
        });
      }
    });
  }), r.SheetNames.length == 0)
    throw new Error("Empty NUMBERS file");
  return r;
}
function zt(e) {
  var a, r, t, n, i = {}, s = [];
  if (e.FullPaths.forEach(function(f) {
    if (f.match(/\.iwpv2/))
      throw new Error("Unsupported password protection");
  }), e.FileIndex.forEach(function(f) {
    if (f.name.match(/\.iwa$/)) {
      var o;
      try {
        o = Od(f.content);
      } catch (u) {
        return console.log("?? " + f.content.length + " " + (u.message || u));
      }
      var l;
      try {
        l = Dd(o);
      } catch (u) {
        return console.log("## " + (u.message || u));
      }
      l.forEach(function(u) {
        i[u.id] = u.messages, s.push(u.id);
      });
    }
  }), !s.length)
    throw new Error("File has no messages");
  var c = ((n = (t = (r = (a = i == null ? void 0 : i[1]) == null ? void 0 : a[0]) == null ? void 0 : r.meta) == null ? void 0 : t[1]) == null ? void 0 : n[0].data) && Ge(i[1][0].meta[1][0].data) == 1 && i[1][0];
  if (c || s.forEach(function(f) {
    i[f].forEach(function(o) {
      var l = Ge(o.meta[1][0].data) >>> 0;
      if (l == 1)
        if (!c)
          c = o;
        else
          throw new Error("Document has multiple roots");
    });
  }), !c)
    throw new Error("Cannot find Document root");
  return Hd(i, c);
}
function Wd(e) {
  return function(r) {
    for (var t = 0; t != e.length; ++t) {
      var n = e[t];
      r[n[0]] === void 0 && (r[n[0]] = n[1]), n[2] === "n" && (r[n[0]] = Number(r[n[0]]));
    }
  };
}
function D0(e) {
  Wd([
    ["cellNF", !1],
    /* emit cell number format string as .z */
    ["cellHTML", !0],
    /* emit html string as .h */
    ["cellFormula", !0],
    /* emit formulae as .f */
    ["cellStyles", !1],
    /* emits style/theme as .s */
    ["cellText", !0],
    /* emit formatted text as .w */
    ["cellDates", !1],
    /* emit date cells with type `d` */
    ["sheetStubs", !1],
    /* emit empty cells */
    ["sheetRows", 0, "n"],
    /* read n rows (0 = read all rows) */
    ["bookDeps", !1],
    /* parse calculation chains */
    ["bookSheets", !1],
    /* only try to get sheet names (no Sheets) */
    ["bookProps", !1],
    /* only try to get properties (no Sheets) */
    ["bookFiles", !1],
    /* include raw file structure (keys, files, cfb) */
    ["bookVBA", !1],
    /* include vba raw data (vbaraw) */
    ["password", ""],
    /* password */
    ["WTF", !1]
    /* WTF mode (throws errors) */
  ])(e);
}
function Vd(e) {
  return Ea.WS.indexOf(e) > -1 ? "sheet" : e == Ea.CS ? "chart" : e == Ea.DS ? "dialog" : e == Ea.MS ? "macro" : e && e.length ? e : "sheet";
}
function Gd(e, a) {
  if (!e) return 0;
  try {
    e = a.map(function(t) {
      return t.id || (t.id = t.strRelID), [t.name, e["!id"][t.id].Target, Vd(e["!id"][t.id].Type)];
    });
  } catch {
    return null;
  }
  return !e || e.length === 0 ? null : e;
}
function Xd(e, a, r, t, n, i, s, c, f, o, l, u) {
  try {
    i[t] = Wa(hr(e, r, !0), a);
    var x = Be(e, a), d;
    switch (c) {
      case "sheet":
        d = Jx(x, a, n, f, i[t], o, l, u);
        break;
      case "chart":
        if (d = Zx(x, a, n, f, i[t], o, l, u), !d || !d["!drawel"]) break;
        var p = Ma(d["!drawel"].Target, a), h = Jt(p), m = j1(hr(e, p, !0), Wa(hr(e, h, !0), p)), A = Ma(m, p), y = Jt(A);
        d = Ix(hr(e, A, !0), A, f, Wa(hr(e, y, !0), A), o, d);
        break;
      case "macro":
        d = qx(x, a, n, f, i[t], o, l, u);
        break;
      case "dialog":
        d = Qx(x, a, n, f, i[t], o, l, u);
        break;
      default:
        throw new Error("Unrecognized sheet type " + c);
    }
    s[t] = d;
    var E = [];
    i && i[t] && Or(i[t]).forEach(function(I) {
      var b = "";
      if (i[t][I].Type == Ea.CMNT) {
        b = Ma(i[t][I].Target, a);
        var O = td(Be(e, b, !0), b, f);
        if (!O || !O.length) return;
        An(d, O, !1);
      }
      i[t][I].Type == Ea.TCMNT && (b = Ma(i[t][I].Target, a), E = E.concat(Z1(Be(e, b, !0), f)));
    }), E && E.length && An(d, E, !0, f.people || []);
  } catch (I) {
    if (f.WTF) throw I;
  }
}
function vr(e) {
  return e.charAt(0) == "/" ? e.slice(1) : e;
}
function zd(e, a) {
  if (ii(), a = a || {}, D0(a), gr(e, "META-INF/manifest.xml") || gr(e, "objectdata.xml")) return Mn(e, a);
  if (gr(e, "Index/Document.iwa")) {
    if (typeof Uint8Array > "u") throw new Error("NUMBERS file parsing requires Uint8Array support");
    if (typeof zt < "u") {
      if (e.FileIndex) return zt(e);
      var r = Ee.utils.cfb_new();
      return J0(e).forEach(function(fe) {
        Xc(r, fe, Gc(e, fe));
      }), zt(r);
    }
    throw new Error("Unsupported NUMBERS file");
  }
  if (!gr(e, "[Content_Types].xml"))
    throw gr(e, "index.xml.gz") ? new Error("Unsupported NUMBERS 08 file") : gr(e, "index.xml") ? new Error("Unsupported NUMBERS 09 file") : new Error("Unsupported ZIP file");
  var t = J0(e), n = Hf(hr(e, "[Content_Types].xml")), i = !1, s, c;
  if (n.workbooks.length === 0 && (c = "xl/workbook.xml", Be(e, c, !0) && n.workbooks.push(c)), n.workbooks.length === 0) {
    if (c = "xl/workbook.bin", !Be(e, c, !0)) throw new Error("Could not find workbook");
    n.workbooks.push(c), i = !0;
  }
  n.workbooks[0].slice(-3) == "bin" && (i = !0);
  var f = {}, o = {};
  if (!a.bookSheets && !a.bookProps) {
    if (Xa = [], n.sst) try {
      Xa = ad(Be(e, vr(n.sst)), n.sst, a);
    } catch (fe) {
      if (a.WTF) throw fe;
    }
    a.cellStyles && n.themes.length && (f = rd(hr(e, n.themes[0].replace(/^\//, ""), !0) || "", n.themes[0], a)), n.style && (o = ed(Be(e, vr(n.style)), n.style, f, a));
  }
  n.links.map(function(fe) {
    try {
      var re = Wa(hr(e, Jt(vr(fe))), fe);
      return id(Be(e, vr(fe)), re, fe, a);
    } catch {
    }
  });
  var l = jx(Be(e, vr(n.workbooks[0])), n.workbooks[0], a), u = {}, x = "";
  n.coreprops.length && (x = Be(e, vr(n.coreprops[0]), !0), x && (u = Li(x)), n.extprops.length !== 0 && (x = Be(e, vr(n.extprops[0]), !0), x && zf(x, u, a)));
  var d = {};
  (!a.bookSheets || a.bookProps) && n.custprops.length !== 0 && (x = hr(e, vr(n.custprops[0]), !0), x && (d = Yf(x, a)));
  var p = {};
  if ((a.bookSheets || a.bookProps) && (l.Sheets ? s = l.Sheets.map(function(re) {
    return re.name;
  }) : u.Worksheets && u.SheetNames.length > 0 && (s = u.SheetNames), a.bookProps && (p.Props = u, p.Custprops = d), a.bookSheets && typeof s < "u" && (p.SheetNames = s), a.bookSheets ? p.SheetNames : a.bookProps))
    return p;
  s = {};
  var h = {};
  a.bookDeps && n.calcchain && (h = nd(Be(e, vr(n.calcchain)), n.calcchain));
  var m = 0, A = {}, y, E;
  {
    var I = l.Sheets;
    u.Worksheets = I.length, u.SheetNames = [];
    for (var b = 0; b != I.length; ++b)
      u.SheetNames[b] = I[b].name;
  }
  var O = i ? "bin" : "xml", F = n.workbooks[0].lastIndexOf("/"), W = (n.workbooks[0].slice(0, F + 1) + "_rels/" + n.workbooks[0].slice(F + 1) + ".rels").replace(/^\//, "");
  gr(e, W) || (W = "xl/_rels/workbook." + O + ".rels");
  var D = Wa(hr(e, W, !0), W.replace(/_rels.*/, "s5s"));
  (n.metadata || []).length >= 1 && (a.xlmeta = sd(Be(e, vr(n.metadata[0])), n.metadata[0], a)), (n.people || []).length >= 1 && (a.people = q1(Be(e, vr(n.people[0])), a)), D && (D = Gd(D, l.Sheets));
  var z = Be(e, "xl/worksheets/sheet.xml", !0) ? 1 : 0;
  e: for (m = 0; m != u.Worksheets; ++m) {
    var G = "sheet";
    if (D && D[m] ? (y = "xl/" + D[m][1].replace(/[\/]?xl\//, ""), gr(e, y) || (y = D[m][1]), gr(e, y) || (y = W.replace(/_rels\/.*$/, "") + D[m][1]), G = D[m][2]) : (y = "xl/worksheets/sheet" + (m + 1 - z) + "." + O, y = y.replace(/sheet0\./, "sheet.")), E = y.replace(/^(.*)(\/)([^\/]*)$/, "$1/_rels/$3.rels"), a && a.sheets != null) switch (typeof a.sheets) {
      case "number":
        if (m != a.sheets) continue e;
        break;
      case "string":
        if (u.SheetNames[m].toLowerCase() != a.sheets.toLowerCase()) continue e;
        break;
      default:
        if (Array.isArray && Array.isArray(a.sheets)) {
          for (var L = !1, J = 0; J != a.sheets.length; ++J)
            typeof a.sheets[J] == "number" && a.sheets[J] == m && (L = 1), typeof a.sheets[J] == "string" && a.sheets[J].toLowerCase() == u.SheetNames[m].toLowerCase() && (L = 1);
          if (!L) continue e;
        }
    }
    Xd(e, y, E, u.SheetNames[m], m, A, s, G, a, l, f, o);
  }
  return p = {
    Directory: n,
    Workbook: l,
    Props: u,
    Custprops: d,
    Deps: h,
    Sheets: s,
    SheetNames: u.SheetNames,
    Strings: Xa,
    Styles: o,
    Themes: f,
    SSF: Ye(de)
  }, a && a.bookFiles && (e.files ? (p.keys = t, p.files = e.files) : (p.keys = [], p.files = {}, e.FullPaths.forEach(function(fe, re) {
    fe = fe.replace(/^Root Entry[\/]/, ""), p.keys.push(fe), p.files[fe] = e.FileIndex[re];
  }))), a && a.bookVBA && (n.vba.length > 0 ? p.vbaraw = Be(e, vr(n.vba[0]), !0) : n.defaults && n.defaults.bin === au && (p.vbaraw = Be(e, "xl/vbaProject.bin", !0))), p;
}
function $d(e, a) {
  var r = a || {}, t = "Workbook", n = Ee.find(e, t);
  try {
    if (t = "/!DataSpaces/Version", n = Ee.find(e, t), !n || !n.content) throw new Error("ECMA-376 Encrypted file missing " + t);
    if (Bl(n.content), t = "/!DataSpaces/DataSpaceMap", n = Ee.find(e, t), !n || !n.content) throw new Error("ECMA-376 Encrypted file missing " + t);
    var i = Hl(n.content);
    if (i.length !== 1 || i[0].comps.length !== 1 || i[0].comps[0].t !== 0 || i[0].name !== "StrongEncryptionDataSpace" || i[0].comps[0].v !== "EncryptedPackage")
      throw new Error("ECMA-376 Encrypted file bad " + t);
    if (t = "/!DataSpaces/DataSpaceInfo/StrongEncryptionDataSpace", n = Ee.find(e, t), !n || !n.content) throw new Error("ECMA-376 Encrypted file missing " + t);
    var s = Wl(n.content);
    if (s.length != 1 || s[0] != "StrongEncryptionTransform")
      throw new Error("ECMA-376 Encrypted file bad " + t);
    if (t = "/!DataSpaces/TransformInfo/StrongEncryptionTransform/!Primary", n = Ee.find(e, t), !n || !n.content) throw new Error("ECMA-376 Encrypted file missing " + t);
    Gl(n.content);
  } catch {
  }
  if (t = "/EncryptionInfo", n = Ee.find(e, t), !n || !n.content) throw new Error("ECMA-376 Encrypted file missing " + t);
  var c = Xl(n.content);
  if (t = "/EncryptedPackage", n = Ee.find(e, t), !n || !n.content) throw new Error("ECMA-376 Encrypted file missing " + t);
  if (c[0] == 4 && typeof decrypt_agile < "u") return decrypt_agile(c[1], n.content, r.password || "", r);
  if (c[0] == 2 && typeof decrypt_std76 < "u") return decrypt_std76(c[1], n.content, r.password || "", r);
  throw new Error("File is password-protected");
}
function R0(e, a) {
  var r = "";
  switch ((a || {}).type || "base64") {
    case "buffer":
      return [e[0], e[1], e[2], e[3], e[4], e[5], e[6], e[7]];
    case "base64":
      r = xr(e.slice(0, 12));
      break;
    case "binary":
      r = e;
      break;
    case "array":
      return [e[0], e[1], e[2], e[3], e[4], e[5], e[6], e[7]];
    default:
      throw new Error("Unrecognized type " + (a && a.type || "undefined"));
  }
  return [r.charCodeAt(0), r.charCodeAt(1), r.charCodeAt(2), r.charCodeAt(3), r.charCodeAt(4), r.charCodeAt(5), r.charCodeAt(6), r.charCodeAt(7)];
}
function Yd(e, a) {
  return Ee.find(e, "EncryptedPackage") ? $d(e, a) : gs(e, a);
}
function Kd(e, a) {
  var r, t = e, n = a || {};
  return n.type || (n.type = ge && Buffer.isBuffer(e) ? "buffer" : "base64"), r = ui(t, n), zd(r, n);
}
function ks(e, a) {
  var r = 0;
  e: for (; r < e.length; ) switch (e.charCodeAt(r)) {
    case 10:
    case 13:
    case 32:
      ++r;
      break;
    case 60:
      return Qt(e.slice(r), a);
    default:
      break e;
  }
  return Za.to_workbook(e, a);
}
function jd(e, a) {
  var r = "", t = R0(e, a);
  switch (a.type) {
    case "base64":
      r = xr(e);
      break;
    case "binary":
      r = e;
      break;
    case "buffer":
      r = e.toString("binary");
      break;
    case "array":
      r = oa(e);
      break;
    default:
      throw new Error("Unrecognized type " + a.type);
  }
  return t[0] == 239 && t[1] == 187 && t[2] == 191 && (r = Fe(r)), a.type = "binary", ks(r, a);
}
function Jd(e, a) {
  var r = e;
  return a.type == "base64" && (r = xr(r)), r = Ya.utils.decode(1200, r.slice(2), "str"), a.type = "binary", ks(r, a);
}
function Zd(e) {
  return e.match(/[^\x00-\x7F]/) ? ba(e) : e;
}
function $t(e, a, r, t) {
  return t ? (r.type = "string", Za.to_workbook(e, r)) : Za.to_workbook(a, r);
}
function t0(e, a) {
  Yn();
  var r = a || {};
  if (typeof ArrayBuffer < "u" && e instanceof ArrayBuffer) return t0(new Uint8Array(e), (r = Ye(r), r.type = "array", r));
  typeof Uint8Array < "u" && e instanceof Uint8Array && !r.type && (r.type = typeof Deno < "u" ? "buffer" : "array");
  var t = e, n = [0, 0, 0, 0], i = !1;
  if (r.cellStyles && (r.cellNF = !0, r.sheetStubs = !0), ka = {}, r.dateNF && (ka.dateNF = r.dateNF), r.type || (r.type = ge && Buffer.isBuffer(e) ? "buffer" : "base64"), r.type == "file" && (r.type = ge ? "buffer" : "binary", t = Mc(e), typeof Uint8Array < "u" && !ge && (r.type = "array")), r.type == "string" && (i = !0, r.type = "binary", r.codepage = 65001, t = Zd(e)), r.type == "array" && typeof Uint8Array < "u" && e instanceof Uint8Array && typeof ArrayBuffer < "u") {
    var s = new ArrayBuffer(3), c = new Uint8Array(s);
    if (c.foo = "bar", !c.foo)
      return r = Ye(r), r.type = "array", t0(f0(t), r);
  }
  switch ((n = R0(t, r))[0]) {
    case 208:
      if (n[1] === 207 && n[2] === 17 && n[3] === 224 && n[4] === 161 && n[5] === 177 && n[6] === 26 && n[7] === 225) return Yd(Ee.read(t, r), r);
      break;
    case 9:
      if (n[1] <= 8) return gs(t, r);
      break;
    case 60:
      return Qt(t, r);
    case 73:
      if (n[1] === 73 && n[2] === 42 && n[3] === 0) throw new Error("TIFF Image File is not a spreadsheet");
      if (n[1] === 68) return Fl(t, r);
      break;
    case 84:
      if (n[1] === 65 && n[2] === 66 && n[3] === 76) return wl.to_workbook(t, r);
      break;
    case 80:
      return n[1] === 75 && n[2] < 9 && n[3] < 9 ? Kd(t, r) : $t(e, t, r, i);
    case 239:
      return n[3] === 60 ? Qt(t, r) : $t(e, t, r, i);
    case 255:
      if (n[1] === 254)
        return Jd(t, r);
      if (n[1] === 0 && n[2] === 2 && n[3] === 0) return Ga.to_workbook(t, r);
      break;
    case 0:
      if (n[1] === 0 && (n[2] >= 2 && n[3] === 0 || n[2] === 0 && (n[3] === 8 || n[3] === 9)))
        return Ga.to_workbook(t, r);
      break;
    case 3:
    case 131:
    case 139:
    case 140:
      return wn.to_workbook(t, r);
    case 123:
      if (n[1] === 92 && n[2] === 114 && n[3] === 116) return a1.to_workbook(t, r);
      break;
    case 10:
    case 13:
    case 32:
      return jd(t, r);
    case 137:
      if (n[1] === 80 && n[2] === 78 && n[3] === 71) throw new Error("PNG Image File is not a spreadsheet");
      break;
  }
  return Tl.indexOf(n[0]) > -1 && n[2] <= 12 && n[3] <= 31 ? wn.to_workbook(t, r) : $t(e, t, r, i);
}
function qd(e, a, r, t, n, i, s, c) {
  var f = Ke(r), o = c.defval, l = c.raw || !Object.prototype.hasOwnProperty.call(c, "raw"), u = !0, x = n === 1 ? [] : {};
  if (n !== 1)
    if (Object.defineProperty) try {
      Object.defineProperty(x, "__rowNum__", { value: r, enumerable: !1 });
    } catch {
      x.__rowNum__ = r;
    }
    else x.__rowNum__ = r;
  if (!s || e[r]) for (var d = a.s.c; d <= a.e.c; ++d) {
    var p = s ? e[r][d] : e[t[d] + f];
    if (p === void 0 || p.t === void 0) {
      if (o === void 0) continue;
      i[d] != null && (x[i[d]] = o);
      continue;
    }
    var h = p.v;
    switch (p.t) {
      case "z":
        if (h == null) break;
        continue;
      case "e":
        h = h == 0 ? null : void 0;
        break;
      case "s":
      case "d":
      case "b":
      case "n":
        break;
      default:
        throw new Error("unrecognized type " + p.t);
    }
    if (i[d] != null) {
      if (h == null)
        if (p.t == "e" && h === null) x[i[d]] = null;
        else if (o !== void 0) x[i[d]] = o;
        else if (l && h === null) x[i[d]] = null;
        else continue;
      else
        x[i[d]] = l && (p.t !== "n" || p.t === "n" && c.rawNumbers !== !1) ? h : Wr(p, h, c);
      h != null && (u = !1);
    }
  }
  return { row: x, isempty: u };
}
function n0(e, a) {
  if (e == null || e["!ref"] == null) return [];
  var r = { t: "n", v: 0 }, t = 0, n = 1, i = [], s = 0, c = "", f = { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } }, o = a || {}, l = o.range != null ? o.range : e["!ref"];
  switch (o.header === 1 ? t = 1 : o.header === "A" ? t = 2 : Array.isArray(o.header) ? t = 3 : o.header == null && (t = 0), typeof l) {
    case "string":
      f = Oe(l);
      break;
    case "number":
      f = Oe(e["!ref"]), f.s.r = l;
      break;
    default:
      f = l;
  }
  t > 0 && (n = 0);
  var u = Ke(f.s.r), x = [], d = [], p = 0, h = 0, m = Array.isArray(e), A = f.s.r, y = 0, E = {};
  m && !e[A] && (e[A] = []);
  var I = o.skipHidden && e["!cols"] || [], b = o.skipHidden && e["!rows"] || [];
  for (y = f.s.c; y <= f.e.c; ++y)
    if (!(I[y] || {}).hidden)
      switch (x[y] = Ve(y), r = m ? e[A][y] : e[x[y] + u], t) {
        case 1:
          i[y] = y - f.s.c;
          break;
        case 2:
          i[y] = x[y];
          break;
        case 3:
          i[y] = o.header[y - f.s.c];
          break;
        default:
          if (r == null && (r = { w: "__EMPTY", t: "s" }), c = s = Wr(r, null, o), h = E[s] || 0, !h) E[s] = 1;
          else {
            do
              c = s + "_" + h++;
            while (E[c]);
            E[s] = h, E[c] = 1;
          }
          i[y] = c;
      }
  for (A = f.s.r + n; A <= f.e.r; ++A)
    if (!(b[A] || {}).hidden) {
      var O = qd(e, f, A, x, t, i, m, o);
      (O.isempty === !1 || (t === 1 ? o.blankrows !== !1 : o.blankrows)) && (d[p++] = O.row);
    }
  return d.length = p, d;
}
var Hn = /"/g;
function Qd(e, a, r, t, n, i, s, c) {
  for (var f = !0, o = [], l = "", u = Ke(r), x = a.s.c; x <= a.e.c; ++x)
    if (t[x]) {
      var d = c.dense ? (e[r] || [])[x] : e[t[x] + u];
      if (d == null) l = "";
      else if (d.v != null) {
        f = !1, l = "" + (c.rawNumbers && d.t == "n" ? d.v : Wr(d, null, c));
        for (var p = 0, h = 0; p !== l.length; ++p) if ((h = l.charCodeAt(p)) === n || h === i || h === 34 || c.forceQuotes) {
          l = '"' + l.replace(Hn, '""') + '"';
          break;
        }
        l == "ID" && (l = '"ID"');
      } else d.f != null && !d.F ? (f = !1, l = "=" + d.f, l.indexOf(",") >= 0 && (l = '"' + l.replace(Hn, '""') + '"')) : l = "";
      o.push(l);
    }
  return c.blankrows === !1 && f ? null : o.join(s);
}
function ws(e, a) {
  var r = [], t = a ?? {};
  if (e == null || e["!ref"] == null) return "";
  var n = Oe(e["!ref"]), i = t.FS !== void 0 ? t.FS : ",", s = i.charCodeAt(0), c = t.RS !== void 0 ? t.RS : `
`, f = c.charCodeAt(0), o = new RegExp((i == "|" ? "\\|" : i) + "+$"), l = "", u = [];
  t.dense = Array.isArray(e);
  for (var x = t.skipHidden && e["!cols"] || [], d = t.skipHidden && e["!rows"] || [], p = n.s.c; p <= n.e.c; ++p) (x[p] || {}).hidden || (u[p] = Ve(p));
  for (var h = 0, m = n.s.r; m <= n.e.r; ++m)
    (d[m] || {}).hidden || (l = Qd(e, n, m, u, s, f, i, t), l != null && (t.strip && (l = l.replace(o, "")), (l || t.blankrows !== !1) && r.push((h++ ? c : "") + l)));
  return delete t.dense, r.join("");
}
function e2(e, a) {
  a || (a = {}), a.FS = "	", a.RS = `
`;
  var r = ws(e, a);
  return r;
}
function r2(e) {
  var a = "", r, t = "";
  if (e == null || e["!ref"] == null) return [];
  var n = Oe(e["!ref"]), i = "", s = [], c, f = [], o = Array.isArray(e);
  for (c = n.s.c; c <= n.e.c; ++c) s[c] = Ve(c);
  for (var l = n.s.r; l <= n.e.r; ++l)
    for (i = Ke(l), c = n.s.c; c <= n.e.c; ++c)
      if (a = s[c] + i, r = o ? (e[l] || [])[c] : e[a], t = "", r !== void 0) {
        if (r.F != null) {
          if (a = r.F, !r.f) continue;
          t = r.f, a.indexOf(":") == -1 && (a = a + ":" + a);
        }
        if (r.f != null) t = r.f;
        else {
          if (r.t == "z") continue;
          if (r.t == "n" && r.v != null) t = "" + r.v;
          else if (r.t == "b") t = r.v ? "TRUE" : "FALSE";
          else if (r.w !== void 0) t = "'" + r.w;
          else {
            if (r.v === void 0) continue;
            r.t == "s" ? t = "'" + r.v : t = "" + r.v;
          }
        }
        f[f.length] = a + "=" + t;
      }
  return f;
}
function As(e, a, r) {
  var t = r || {}, n = +!t.skipHeader, i = e || {}, s = 0, c = 0;
  if (i && t.origin != null)
    if (typeof t.origin == "number") s = t.origin;
    else {
      var f = typeof t.origin == "string" ? sr(t.origin) : t.origin;
      s = f.r, c = f.c;
    }
  var o, l = { s: { c: 0, r: 0 }, e: { c, r: s + a.length - 1 + n } };
  if (i["!ref"]) {
    var u = Oe(i["!ref"]);
    l.e.c = Math.max(l.e.c, u.e.c), l.e.r = Math.max(l.e.r, u.e.r), s == -1 && (s = u.e.r + 1, l.e.r = s + a.length - 1 + n);
  } else
    s == -1 && (s = 0, l.e.r = a.length - 1 + n);
  var x = t.header || [], d = 0;
  a.forEach(function(h, m) {
    Or(h).forEach(function(A) {
      (d = x.indexOf(A)) == -1 && (x[d = x.length] = A);
      var y = h[A], E = "z", I = "", b = he({ c: c + d, r: s + m + n });
      o = rt(i, b), y && typeof y == "object" && !(y instanceof Date) ? i[b] = y : (typeof y == "number" ? E = "n" : typeof y == "boolean" ? E = "b" : typeof y == "string" ? E = "s" : y instanceof Date ? (E = "d", t.cellDates || (E = "n", y = fr(y)), I = t.dateNF || de[14]) : y === null && t.nullError && (E = "e", y = 0), o ? (o.t = E, o.v = y, delete o.w, delete o.R, I && (o.z = I)) : i[b] = o = { t: E, v: y }, I && (o.z = I));
    });
  }), l.e.c = Math.max(l.e.c, c + x.length - 1);
  var p = Ke(s);
  if (n) for (d = 0; d < x.length; ++d) i[Ve(d + c) + p] = { t: "s", v: x[d] };
  return i["!ref"] = _e(l), i;
}
function a2(e, a) {
  return As(null, e, a);
}
function rt(e, a, r) {
  if (typeof a == "string") {
    if (Array.isArray(e)) {
      var t = sr(a);
      return e[t.r] || (e[t.r] = []), e[t.r][t.c] || (e[t.r][t.c] = { t: "z" });
    }
    return e[a] || (e[a] = { t: "z" });
  }
  return typeof a != "number" ? rt(e, he(a)) : rt(e, he({ r: a, c: r || 0 }));
}
function t2(e, a) {
  if (typeof a == "number") {
    if (a >= 0 && e.SheetNames.length > a) return a;
    throw new Error("Cannot find sheet # " + a);
  } else if (typeof a == "string") {
    var r = e.SheetNames.indexOf(a);
    if (r > -1) return r;
    throw new Error("Cannot find sheet name |" + a + "|");
  } else throw new Error("Cannot find sheet |" + a + "|");
}
function O0() {
  return { SheetNames: [], Sheets: {} };
}
function N0(e, a, r, t) {
  var n = 1;
  if (!r) for (; n <= 65535 && e.SheetNames.indexOf(r = "Sheet" + n) != -1; ++n, r = void 0) ;
  if (!r || e.SheetNames.length >= 65535) throw new Error("Too many worksheets");
  if (t && e.SheetNames.indexOf(r) >= 0) {
    var i = r.match(/(^.*?)(\d+)$/);
    n = i && +i[2] || 0;
    var s = i && i[1] || r;
    for (++n; n <= 65535 && e.SheetNames.indexOf(r = s + n) != -1; ++n) ;
  }
  if (Wx(r), e.SheetNames.indexOf(r) >= 0) throw new Error("Worksheet with name |" + r + "| already exists!");
  return e.SheetNames.push(r), e.Sheets[r] = a, r;
}
function n2(e, a, r) {
  e.Workbook || (e.Workbook = {}), e.Workbook.Sheets || (e.Workbook.Sheets = []);
  var t = t2(e, a);
  switch (e.Workbook.Sheets[t] || (e.Workbook.Sheets[t] = {}), r) {
    case 0:
    case 1:
    case 2:
      break;
    default:
      throw new Error("Bad sheet visibility setting " + r);
  }
  e.Workbook.Sheets[t].Hidden = r;
}
function i2(e, a) {
  return e.z = a, e;
}
function Fs(e, a, r) {
  return a ? (e.l = { Target: a }, r && (e.l.Tooltip = r)) : delete e.l, e;
}
function s2(e, a, r) {
  return Fs(e, "#" + a, r);
}
function c2(e, a, r) {
  e.c || (e.c = []), e.c.push({ t: a, a: r || "SheetJS" });
}
function f2(e, a, r, t) {
  for (var n = typeof a != "string" ? a : Oe(a), i = typeof a == "string" ? a : _e(a), s = n.s.r; s <= n.e.r; ++s) for (var c = n.s.c; c <= n.e.c; ++c) {
    var f = rt(e, s, c);
    f.t = "n", f.F = i, delete f.v, s == n.s.r && c == n.s.c && (f.f = r, t && (f.D = !0));
  }
  return e;
}
var o2 = {
  encode_col: Ve,
  encode_row: Ke,
  encode_cell: he,
  encode_range: _e,
  decode_col: m0,
  decode_row: v0,
  split_cell: Ef,
  decode_cell: sr,
  decode_range: Ca,
  format_cell: Wr,
  sheet_add_aoa: Di,
  sheet_add_json: As,
  sheet_add_dom: Es,
  aoa_to_sheet: ya,
  json_to_sheet: a2,
  table_to_sheet: _s,
  table_to_book: Fd,
  sheet_to_csv: ws,
  sheet_to_txt: e2,
  sheet_to_json: n0,
  sheet_to_html: Ad,
  sheet_to_formulae: r2,
  sheet_to_row_object_array: n0,
  sheet_get_cell: rt,
  book_new: O0,
  book_append_sheet: N0,
  book_set_sheet_visibility: n2,
  cell_set_number_format: i2,
  cell_set_hyperlink: Fs,
  cell_set_internal_link: s2,
  cell_add_comment: c2,
  sheet_set_array_formula: f2,
  consts: {
    SHEET_VISIBLE: 0,
    SHEET_HIDDEN: 1,
    SHEET_VERY_HIDDEN: 2
  }
};
const l2 = qs(import.meta.url), i0 = Qs(l2);
let $r = null, pe;
function Ss() {
  try {
    return pe.prepare("SELECT * FROM empresa WHERE id = 1").get();
  } catch {
    return { nombre: "Mi Empresa" };
  }
}
function Cs() {
  try {
    return { ok: !0, rows: pe.prepare(`
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
    `).all().map((r) => {
      let t = 100;
      const n = r.total_deuda > 0 ? r.deuda_vencida / r.total_deuda : 0, i = r.max_dias_mora || 0;
      return n > 0.05 && (t -= 10), n > 0.3 && (t -= 15), n > 0.7 && (t -= 20), i > 5 && (t -= 5), i > 30 && (t -= 15), i > 60 && (t -= 20), i > 90 && (t -= 30), { ...r, score: Math.max(0, Math.round(t)) };
    }).sort((r, t) => r.score - t.score) };
  } catch (e) {
    return { ok: !1, message: e.message, rows: [] };
  }
}
function u2() {
  const e = Xn.networkInterfaces();
  for (const a of Object.keys(e))
    for (const r of e[a])
      if (r.family === "IPv4" && !r.internal)
        return r.address;
  return "localhost";
}
function ys(e) {
  try {
    let a = pe.prepare("SELECT * FROM clientes WHERE cliente = ?").get(e);
    if (!a) {
      const r = pe.prepare("SELECT razon_social, vendedor FROM documentos WHERE cliente = ? LIMIT 1").get(e);
      a = { cliente: e, razon_social: (r == null ? void 0 : r.razon_social) || "", vendedor: (r == null ? void 0 : r.vendedor) || "", telefono: "", email: "", direccion: "", contacto: "" };
    }
    return a;
  } catch {
    return null;
  }
}
function Ds(e) {
  try {
    return e ? pe.prepare("SELECT * FROM gestiones WHERE cliente = ? ORDER BY id DESC").all(e) : pe.prepare(`
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
  } catch (a) {
    return console.error("Error obteniendo gestiones:", a.message), [];
  }
}
function h2(e) {
  try {
    return pe.prepare("UPDATE gestiones SET resultado = 'Promesa Cumplida' WHERE id = ?").run(e), { ok: !0 };
  } catch (a) {
    return { ok: !1, message: a.message };
  }
}
function x2(e, a) {
  try {
    const { tipo: r, resultado: t, observacion: n, fecha_promesa: i, monto_promesa: s } = a;
    return pe.prepare(`
      UPDATE gestiones 
      SET tipo = @tipo, resultado = @resultado, observacion = @observacion, 
          fecha_promesa = @fecha_promesa, monto_promesa = @monto_promesa 
      WHERE id = @id
    `).run({ id: e, tipo: r, resultado: t, observacion: n, fecha_promesa: i, monto_promesa: s }), { ok: !0 };
  } catch (r) {
    return { ok: !1, message: r.message };
  }
}
function d2(e) {
  try {
    return pe.prepare("DELETE FROM gestiones WHERE id = ?").run(e), { ok: !0 };
  } catch (a) {
    return { ok: !1, message: a.message };
  }
}
function Rs(e) {
  try {
    const a = [], r = {};
    e != null && e.desde && (a.push("date(g.fecha) >= date(@desde)"), r.desde = e.desde), e != null && e.hasta && (a.push("date(g.fecha) <= date(@hasta)"), r.hasta = e.hasta);
    const t = a.length > 0 ? `WHERE ${a.join(" AND ")}` : "";
    return pe.prepare(`
      SELECT 
        g.*,
        COALESCE(c.razon_social, g.cliente) as razon_social
      FROM gestiones g
      LEFT JOIN clientes c ON g.cliente = c.cliente
      ${t}
      ORDER BY g.fecha DESC
      LIMIT 2000
    `).all(r);
  } catch {
    return [];
  }
}
function p2() {
  ac.createServer((a, r) => {
    r.setHeader("Access-Control-Allow-Origin", "*");
    const t = new URL(a.url || "/", `http://${a.headers.host}`);
    if (t.pathname.startsWith("/api/")) {
      r.setHeader("Content-Type", "application/json");
      try {
        let o = { ok: !1, message: "Ruta no encontrada" };
        t.pathname === "/api/stats" ? o = Os() : t.pathname === "/api/filtros" ? o = Ns() : t.pathname === "/api/empresa" ? o = Ss() : t.pathname === "/api/top-clientes" ? o = Ls(Number(t.searchParams.get("limit")) || 10) : t.pathname === "/api/analisis" ? o = Cs() : t.pathname === "/api/cliente-info" ? o = ys(t.searchParams.get("id") || "") : t.pathname === "/api/gestiones" ? o = Ds(t.searchParams.get("cliente") || "") : t.pathname === "/api/gestiones-reporte" ? o = Rs({ desde: t.searchParams.get("desde") || void 0, hasta: t.searchParams.get("hasta") || void 0 }) : t.pathname === "/api/documentos" && (o = { ok: !0, rows: Is({
          cliente: t.searchParams.get("cliente") || void 0,
          vendedor: t.searchParams.get("vendedor") || void 0,
          tipoDocumento: t.searchParams.get("tipoDocumento") || void 0,
          tipoFecha: t.searchParams.get("tipoFecha") || "emision",
          desde: t.searchParams.get("desde") || void 0,
          hasta: t.searchParams.get("hasta") || void 0,
          buscar: t.searchParams.get("buscar") || void 0,
          soloVencidos: t.searchParams.get("soloVencidos") === "true"
        }) }), r.writeHead(200), r.end(JSON.stringify(o));
      } catch (o) {
        r.writeHead(500), r.end(JSON.stringify({ ok: !1, message: o.message }));
      }
      return;
    }
    let n = t.pathname === "/" ? "/index.html" : t.pathname;
    n.includes("..") && (n = "/index.html");
    const i = ta(i0, "../dist");
    wa.existsSync(i) || console.log("⚠️  ADVERTENCIA: No se encontró la carpeta 'dist'. Recuerda ejecutar 'npm run build' para que funcione en el celular.");
    let s = ta(i, n.startsWith("/") ? n.slice(1) : n);
    const c = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".png": "image/png",
      ".jpg": "image/jpg",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon"
    }, f = (o) => {
      wa.readFile(o, (l, u) => {
        if (l)
          o !== ta(i, "index.html") ? f(ta(i, "index.html")) : (r.writeHead(404), r.end("Not found"));
        else {
          const x = ec(o).toLowerCase(), d = c[x] || "application/octet-stream";
          r.writeHead(200, { "Content-Type": d }), r.end(u);
        }
      });
    };
    f(s);
  }).listen(3e3, "0.0.0.0", () => {
    console.log("--- SERVIDOR WEB LOCAL INICIADO ---");
    const a = Xn.networkInterfaces();
    Object.keys(a).forEach((r) => {
      var t;
      (t = a[r]) == null || t.forEach((n) => {
        n.family === "IPv4" && !n.internal && console.log(`Accede desde el celular a: http://${n.address}:3000`);
      });
    });
  });
}
function v2() {
  return process.env.OPEN_DEVTOOLS === "1" || process.env.OPEN_DEVTOOLS === "true";
}
async function Wn() {
  $r = new Gn({
    width: 1280,
    height: 860,
    webPreferences: {
      preload: ta(i0, "preload.cjs"),
      contextIsolation: !0,
      nodeIntegration: !1
    }
  });
  const e = process.env.VITE_DEV_SERVER_URL;
  e ? (await $r.loadURL(e), v2() && $r.webContents.openDevTools({ mode: "detach" })) : await $r.loadFile(ta(i0, "../dist/index.html")), $r.on("closed", () => {
    $r = null;
  });
}
function m2() {
  try {
    pe == null || pe.close();
  } catch {
  }
}
function g2(e) {
  const a = e.getFullYear(), r = String(e.getMonth() + 1).padStart(2, "0"), t = String(e.getDate()).padStart(2, "0");
  return `${a}-${r}-${t}`;
}
function Os() {
  const e = g2(/* @__PURE__ */ new Date()), a = Number(
    pe.prepare("SELECT COALESCE(SUM(total), 0) AS v FROM documentos WHERE is_subtotal = 0").get().v
  ), r = Number(
    pe.prepare("SELECT COALESCE(SUM(cobros), 0) AS v FROM documentos WHERE is_subtotal = 0").get().v
  ), t = Number(
    pe.prepare(
      `SELECT COALESCE(SUM(total), 0) AS v
         FROM documentos
         WHERE is_subtotal = 0
           AND total > 0
           AND date(fecha_vencimiento) < date(?)`
    ).get(e).v
  ), n = Number(
    pe.prepare(
      `SELECT COALESCE(SUM(total), 0) AS v
         FROM documentos
         WHERE is_subtotal = 0
           AND total > 0
           AND date(fecha_vencimiento) < date(?, '-90 day')`
    ).get(e).v
  ), i = Number(
    pe.prepare(
      `SELECT COALESCE(SUM(total), 0) AS v
         FROM documentos
         WHERE is_subtotal = 0
           AND total > 0
           AND date(fecha_vencimiento) < date(?, '-120 day')`
    ).get(e).v
  ), s = Number(
    pe.prepare(
      `SELECT COUNT(1) AS c
         FROM documentos
         WHERE is_subtotal = 0 AND total > 0`
    ).get().c
  ), c = Number(
    pe.prepare(
      `SELECT COUNT(DISTINCT cliente) AS c
         FROM documentos
         WHERE is_subtotal = 0 AND total > 0 AND cliente IS NOT NULL AND cliente <> ''`
    ).get().c
  ), f = pe.prepare(
    `SELECT
        COALESCE(SUM(CASE WHEN (julianday(@today) - julianday(fecha_vencimiento)) <= 0 THEN total ELSE 0 END), 0) AS por_vencer,
        COALESCE(SUM(CASE WHEN (julianday(@today) - julianday(fecha_vencimiento)) > 0 AND (julianday(@today) - julianday(fecha_vencimiento)) <= 30 THEN total ELSE 0 END), 0) AS d30,
        COALESCE(SUM(CASE WHEN (julianday(@today) - julianday(fecha_vencimiento)) > 30 AND (julianday(@today) - julianday(fecha_vencimiento)) <= 60 THEN total ELSE 0 END), 0) AS d60,
        COALESCE(SUM(CASE WHEN (julianday(@today) - julianday(fecha_vencimiento)) > 60 AND (julianday(@today) - julianday(fecha_vencimiento)) <= 90 THEN total ELSE 0 END), 0) AS d90,
        COALESCE(SUM(CASE WHEN (julianday(@today) - julianday(fecha_vencimiento)) > 90 AND (julianday(@today) - julianday(fecha_vencimiento)) <= 120 THEN total ELSE 0 END), 0) AS d120,
        COALESCE(SUM(CASE WHEN (julianday(@today) - julianday(fecha_vencimiento)) > 120 THEN total ELSE 0 END), 0) AS d120p
       FROM documentos
       WHERE is_subtotal = 0`
  ).get({ today: e }), o = Number(
    pe.prepare(
      `SELECT COALESCE(SUM(saldo), 0) AS v
         FROM (
           SELECT cliente, SUM(total) AS saldo
           FROM documentos
           WHERE is_subtotal = 0
           GROUP BY cliente
           ORDER BY saldo DESC
           LIMIT 10
         )`
    ).get().v
  ), l = a > 0 ? t / a * 100 : 0, u = a > 0 ? n / a * 100 : 0, x = a > 0 ? o / a * 100 : 0;
  return {
    fechaCorte: e,
    totalSaldo: a,
    totalCobrado: r,
    vencidaSaldo: t,
    percentVencida: l,
    mora90Saldo: n,
    percentMora90: u,
    mora120Saldo: i,
    docsPendientes: s,
    clientesConSaldo: c,
    aging: {
      porVencer: Number(f.por_vencer || 0),
      d30: Number(f.d30 || 0),
      d60: Number(f.d60 || 0),
      d90: Number(f.d90 || 0),
      d120: Number(f.d120 || 0),
      d120p: Number(f.d120p || 0)
    },
    percentTop10: x
  };
}
function Ns() {
  const e = pe.prepare(
    `SELECT DISTINCT cliente, razon_social
       FROM documentos
       WHERE is_subtotal = 0 AND cliente IS NOT NULL AND cliente <> ''
       ORDER BY razon_social, cliente`
  ).all(), a = pe.prepare(
    `SELECT DISTINCT vendedor AS v
       FROM documentos
       WHERE is_subtotal = 0 AND vendedor IS NOT NULL AND vendedor <> ''
       ORDER BY v`
  ).all().map((t) => t.v), r = pe.prepare(
    `SELECT DISTINCT tipo_documento AS v
       FROM documentos
       WHERE is_subtotal = 0 AND tipo_documento IS NOT NULL AND tipo_documento <> ''
       ORDER BY v`
  ).all().map((t) => t.v);
  return { clientes: e, vendedores: a, tipos: r };
}
function Is(e) {
  const a = ["is_subtotal = 0"], r = [];
  e.cliente && e.cliente !== "(Todos)" && (a.push("razon_social = ?"), r.push(e.cliente)), e.vendedor && e.vendedor !== "(Todos)" && (a.push("vendedor = ?"), r.push(e.vendedor)), e.tipoDocumento && e.tipoDocumento !== "(Todos)" && (a.push("tipo_documento = ?"), r.push(e.tipoDocumento));
  const t = e.tipoFecha === "vencimiento" ? "fecha_vencimiento" : "fecha_emision";
  if (e.desde && (a.push(`date(${t}) >= date(?)`), r.push(e.desde)), e.hasta && (a.push(`date(${t}) <= date(?)`), r.push(e.hasta)), e.soloVencidos && a.push("date(fecha_vencimiento) < date('now') AND total > 0"), e.buscar && e.buscar.trim()) {
    const s = `%${e.buscar.trim()}%`;
    a.push("(razon_social LIKE ? OR cliente LIKE ? OR documento LIKE ? OR descripcion LIKE ?)"), r.push(s, s, s, s);
  }
  if (e.ids && e.ids.length > 0) {
    const s = e.ids.map(() => "?").join(",");
    a.push(`id IN (${s})`), r.push(...e.ids);
  }
  const n = Math.min(Math.max(e.limit ?? 2e3, 1), 5e3), i = `
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
    WHERE ${a.join(" AND ")}
    ORDER BY date(fecha_vencimiento) ASC, razon_social ASC, documento ASC
    LIMIT ${n}
  `;
  return pe.prepare(i).all(...r);
}
function Ls(e = 10) {
  const a = Math.min(Math.max(e, 1), 200);
  return pe.prepare(
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
       LIMIT ${a}`
  ).all();
}
const Yt = (e) => e.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(), Vn = (e) => {
  if (e instanceof Date) return e.toISOString().split("T")[0];
  const a = String(e || "").trim();
  if (!a) return "";
  const r = a.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  return r ? `${r[3]}-${r[2].padStart(2, "0")}-${r[1].padStart(2, "0")}` : a;
}, gt = (e) => {
  if (e == null || e === "") return 0;
  if (typeof e == "number") return e;
  let a = String(e).trim();
  if (a = a.replace(/[$\s]/g, ""), a.includes(",") && a.includes(".")) {
    const t = a.lastIndexOf(","), n = a.lastIndexOf(".");
    t > n ? a = a.replace(/\./g, "").replace(",", ".") : a = a.replace(/,/g, "");
  } else a.includes(",") && (a = a.replace(",", "."));
  const r = Number(a);
  return isNaN(r) ? 0 : r;
};
function E2(e, a) {
  const r = wa.readFileSync(e), t = t0(r, { type: "buffer", cellDates: !0 }), n = t.SheetNames[0], i = t.Sheets[n], s = o2.sheet_to_json(i, { header: 1, defval: "" });
  if (!s || s.length === 0) return [];
  const c = 4;
  if (!s[c]) return [];
  const f = s[c].map((d) => String(d).trim().toLowerCase()), o = s.slice(c + 1), l = f.map(Yt), u = (d, p, h = []) => {
    const m = l.findIndex(
      (A) => p.some((y) => A.includes(Yt(y))) && !h.some((y) => A.includes(Yt(y)))
    );
    return m >= 0 && d[m] != null ? d[m] : "";
  }, x = [];
  for (const d of o) {
    const p = String(u(d, ["razon social", "razón social", "nombre"])).trim();
    if (!p) continue;
    const h = p, m = String(u(d, ["# documentos", "# documento", "documento", "número"], ["tipo"])).trim();
    if (!m) continue;
    const A = Number(gt(u(d, ["valor documento", "valor"])).toFixed(2)), y = Number(gt(u(d, ["retenciones", "retencion"])).toFixed(2)), E = Number(gt(u(d, ["cobros", "cobro"])).toFixed(2)), I = Number(gt(u(d, ["total", "saldo"])).toFixed(2));
    let b = 0;
    if (b === 0 && A > 0) {
      const O = A / (1 + a / 100);
      b = Number((A - O).toFixed(2));
    }
    x.push({
      cliente: h,
      razon_social: p,
      // Columna C: "tipo documento"
      tipo_documento: String(u(d, ["tipo documento", "tipo doc", "tipo"])).trim().toUpperCase() || "FACTURA",
      documento: m,
      // Columna E: "f. emision"
      fecha_emision: Vn(u(d, ["f. emision", "f. emisión", "emisión", "emision"])),
      // Columna F: "f. vencimiento"
      fecha_vencimiento: Vn(u(d, ["f. vencimiento", "vencimiento", "vence"])),
      // Columna G: "vendedor"
      vendedor: String(u(d, ["vendedor"])).trim(),
      total: I,
      valor_documento: A,
      iva: b,
      retenciones: y,
      cobros: E,
      // Columna Q: "descripcion"
      descripcion: String(u(d, ["descripcion", "descripción", "detalle"])).trim()
    });
  }
  return x;
}
function _2(e, a) {
  const t = (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").slice(0, 19), n = e.prepare("SELECT id FROM documentos WHERE documento = @documento AND cliente = @cliente AND tipo_documento = @tipo_documento LIMIT 1"), i = e.prepare(`
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
  `), s = e.prepare(`
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
  `), c = e.prepare("UPDATE documentos SET importado_en = @importado_en WHERE id = @id");
  let f = 0, o = 0, l = 0;
  const u = [];
  return e.transaction((d) => {
    for (const h of d) {
      const m = n.get({ documento: h.documento, cliente: h.cliente, tipo_documento: h.tipo_documento }), A = { ...h, importado_en: t };
      if (m)
        s.run({ ...A, id: m.id }).changes > 0 ? o++ : c.run({ importado_en: t, id: m.id });
      else {
        const y = i.run(A);
        u.push(Number(y.lastInsertRowid)), f++;
      }
    }
    l = e.prepare(`
      UPDATE documentos 
      SET 
        total = 0,
        cobros = MAX(0, valor_documento - retenciones)
      WHERE importado_en != @importTimestamp AND total > 0
    `).run({ importTimestamp: t }).changes;
  })(a), { insertedDocs: f, updatedDocs: o, insertedIds: u, paidDocs: l };
}
ca.whenReady().then(async () => {
  pe = zn().db, p2(), await Wn(), ca.on("activate", async () => {
    Gn.getAllWindows().length === 0 && await Wn();
  });
});
ca.on("window-all-closed", () => {
  m2(), process.platform !== "darwin" && ca.quit();
});
Ne.handle("ping", async () => ({ ok: !0 }));
Ne.handle("getDbPath", async () => ic());
Ne.handle("statsObtener", async () => Os());
Ne.handle("filtrosListar", async () => Ns());
Ne.handle("topClientes", async (e, a) => Ls(a ?? 10));
Ne.handle("documentosListar", async (e, a) => {
  try {
    return { ok: !0, rows: Is(a || {}) };
  } catch (r) {
    return { ok: !1, message: (r == null ? void 0 : r.message) || String(r), rows: [] };
  }
});
Ne.handle("generarPDF", async (e, a) => {
  if (!$r) return { ok: !1, message: "Ventana no encontrada" };
  try {
    const r = await $r.webContents.printToPDF({
      printBackground: !0,
      pageSize: "A4",
      margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 }
      // Márgenes en pulgadas aprox
    }), t = ca.getPath("downloads"), n = (a || "documento").replace(/[^a-z0-9]/gi, "_"), i = ta(t, `${n}.pdf`);
    return wa.writeFileSync(i, r), Zs.showItemInFolder(i), { ok: !0, path: i };
  } catch (r) {
    return { ok: !1, message: r.message };
  }
});
Ne.handle("limpiarBaseDatos", async () => {
  try {
    return pe.exec("DELETE FROM documentos"), pe.exec("DELETE FROM gestiones"), pe.exec("DELETE FROM clientes"), { ok: !0, message: "Base de datos vaciada correctamente." };
  } catch (e) {
    return { ok: !1, message: e.message };
  }
});
Ne.handle("actualizarDiasCredito", async (e, { id: a, dias: r }) => {
  try {
    return pe.prepare("UPDATE documentos SET fecha_vencimiento = date(fecha_emision, '+' || @dias || ' days') WHERE id = @id").run({ id: a, dias: r }), { ok: !0 };
  } catch (t) {
    return { ok: !1, message: t.message };
  }
});
Ne.handle("empresaObtener", async () => Ss());
Ne.handle("empresaGuardar", async (e, a) => (pe.prepare(`
    UPDATE empresa 
    SET nombre = @nombre, direccion = @direccion, telefono = @telefono, email = @email, ruc = @ruc, administrador = @administrador, iva_percent = @iva_percent
    WHERE id = 1
  `).run(a), { ok: !0 }));
Ne.handle("clientesAnalisis", async () => Cs());
Ne.handle("clienteObtenerInfo", (e, a) => ys(a));
Ne.handle("clienteGuardarInfo", (e, a) => (pe.prepare("SELECT 1 FROM clientes WHERE cliente = ?").get(a.cliente) ? pe.prepare("UPDATE clientes SET telefono=@telefono, email=@email, direccion=@direccion, contacto=@contacto WHERE cliente=@cliente").run(a) : pe.prepare("INSERT INTO clientes (cliente, razon_social, vendedor, telefono, email, direccion, contacto) VALUES (@cliente, @razon_social, @vendedor, @telefono, @email, @direccion, @contacto)").run(a), { ok: !0 }));
Ne.handle("gestionGuardar", (e, a) => (pe.prepare("INSERT INTO gestiones (cliente, tipo, resultado, observacion, fecha_promesa, monto_promesa, usuario) VALUES (@cliente, @tipo, @resultado, @observacion, @fecha_promesa, @monto_promesa, @usuario)").run({
  ...a,
  usuario: a.usuario || "sistema"
}), { ok: !0 }));
Ne.handle("gestionesListar", (e, a) => Ds(a));
Ne.handle("gestionEditar", (e, { id: a, ...r }) => x2(a, { ...r, actualizado_en: (/* @__PURE__ */ new Date()).toISOString(), usuario: r.usuario || "sistema" }));
Ne.handle("gestionEliminar", (e, a) => d2(a));
Ne.handle("gestionCumplir", (e, a) => h2(a));
Ne.handle("gestionesReporte", (e, a) => Rs(a));
Ne.handle("getNetworkInfo", async () => ({ ip: u2(), port: 3e3 }));
Ne.handle("importarContifico", async () => {
  const e = await Js.showOpenDialog({
    properties: ["openFile"],
    filters: [
      { name: "Excel", extensions: ["xlsx", "xls", "xlsm"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });
  if (e.canceled || e.filePaths.length === 0)
    return { ok: !1, message: "Importación cancelada", insertedDocs: 0, insertedClientes: 0, omittedRows: 0 };
  const a = e.filePaths[0];
  try {
    (!pe || !pe.open) && (pe = zn().db);
    const r = pe.prepare("SELECT iva_percent FROM empresa WHERE id = 1").get(), t = (r == null ? void 0 : r.iva_percent) ?? 15, n = E2(a, t);
    if (n.length === 0)
      return { ok: !1, message: "El archivo no tiene datos o no se encontraron encabezados en la Fila 5.", insertedDocs: 0, updatedDocs: 0, insertedClientes: 0, omittedRows: 0 };
    const { insertedDocs: i, updatedDocs: s, insertedIds: c, paidDocs: f } = _2(pe, n);
    let o = "Proceso completado.";
    return i > 0 ? o = `Se ingresaron ${i} nuevos documentos.` : s > 0 ? o = `Se actualizaron saldos en ${s} documentos.` : f > 0 ? o = `Se cerraron ${f} documentos pagados.` : o = "La cartera está al día (sin cambios).", {
      ok: !0,
      filePath: a,
      insertedDocs: i,
      updatedDocs: s,
      paidDocs: f,
      insertedClientes: 0,
      omittedRows: 0,
      message: o,
      insertedIds: c
      // Devolvemos los IDs para que el frontend pueda revisarlos
    };
  } catch (r) {
    return { ok: !1, message: (r == null ? void 0 : r.message) || String(r), insertedDocs: 0, insertedClientes: 0, omittedRows: 0 };
  }
});
//# sourceMappingURL=main.js.map
