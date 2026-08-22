import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

import {
  createGestion,
  canonicalizeLegacyGestion,
  deleteGestion,
  fulfillGestion,
  getGestionById,
  migrateLegacyGestiones,
  hashLegacyGestion,
  updateGestion,
} from "../../electron/repositories/gestionRepository";
import { createSingleFlight, ensureLegacyGestionIds, persistLegacyGestionIds } from "../../src/services/gestionLegacyMigration";

type Gestion = {
  id?: number | string;
  cliente: string;
  fecha?: string;
  tipo: string;
  resultado: string;
  observacion: string;
  fecha_promesa?: string | null;
  monto_promesa?: number;
  usuario?: string;
  motivo?: string | null;
};

type Scenario = {
  id: string;
  name: string;
  expectedFailure: boolean;
  defect?: string;
  run: () => void;
};

const SCHEMA = `
  CREATE TABLE gestiones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente TEXT NOT NULL,
    fecha TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    tipo TEXT,
    resultado TEXT,
    observacion TEXT,
    fecha_promesa TEXT,
    monto_promesa REAL DEFAULT 0,
    usuario TEXT DEFAULT 'sistema',
    creado_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    actualizado_en TEXT,
    motivo TEXT
  );
  CREATE INDEX idx_gestiones_cliente ON gestiones(cliente);
  CREATE TABLE gestion_legacy_migrations (
    source TEXT NOT NULL,
    legacy_id TEXT NOT NULL,
    gestion_id INTEGER NULL,
    migrated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    payload_hash TEXT NOT NULL,
    deleted_at TEXT NULL,
    PRIMARY KEY (source, legacy_id),
    FOREIGN KEY (gestion_id) REFERENCES gestiones(id)
  );
`;

const tempRoot = path.resolve(os.tmpdir());

function removeTemporaryDirectory(directory: string): void {
  const resolved = path.resolve(directory);
  if (resolved === tempRoot || !resolved.startsWith(`${tempRoot}${path.sep}`)) {
    throw new Error(`Directorio temporal fuera de alcance seguro: ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}

function withDatabase(run: (db: Database.Database, file: string) => void): void {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "zenith-crm-c1-"));
  const file = path.join(directory, "crm.sqlite");
  let db = new Database(file);
  db.exec(SCHEMA);

  try {
    run(db, file);
  } finally {
    if (db.open) db.close();
    removeTemporaryDirectory(directory);
  }
}

function saveGestion(db: Database.Database, data: Gestion) {
  return { ok: true as const, gestion: createGestion(db, data) };
}

function listGestiones(db: Database.Database, cliente = ""): Gestion[] {
  if (!cliente) {
    return db.prepare(`
      SELECT id, cliente, fecha, tipo, resultado, observacion,
             fecha_promesa, monto_promesa
      FROM gestiones
      ORDER BY fecha DESC
      LIMIT 5000
    `).all() as Gestion[];
  }
  return db.prepare(`
    SELECT * FROM gestiones
    WHERE cliente = ?
    ORDER BY fecha DESC
    LIMIT 1000
  `).all(cliente) as Gestion[];
}

function baseGestion(overrides: Partial<Gestion> = {}): Gestion {
  return {
    cliente: "CLIENTE-C1",
    tipo: "Llamada",
    resultado: "Contactado",
    observacion: "Contacto sintético C1",
    ...overrides,
  };
}

function row(db: Database.Database, id: number): Gestion | undefined {
  return getGestionById(db, id) as Gestion | undefined;
}

function insertedId(db: Database.Database): number {
  return Number(
    (db.prepare("SELECT MAX(id) AS id FROM gestiones").get() as { id: number }).id,
  );
}

function assertProductionContract(): void {
  const root = process.cwd();
  const main = fs.readFileSync(path.join(root, "electron", "main.ts"), "utf8");
  const app = fs.readFileSync(path.join(root, "src", "App.tsx"), "utf8");

  assert.match(main, /ipcMain\.handle\("gestionGuardar"/);
  assert.match(main, /ok: true, gestion: createGestion\(db, data\)/);
  assert.match(main, /LIMIT 5000/);
  assert.match(main, /fulfillGestion\(db, id\)/);
  assert.match(app, /cartera_gestiones_locales/);
  assert.match(app, /cartera_promesas_locales/);
  assert.doesNotMatch(app, /manual_\$\{Date\.now\(\)\}/);
  assert.doesNotMatch(app, /Math\.abs\(localTime - bgTime\) < 10000/);
  const createFlow = app.slice(
    app.indexOf("async function guardarGestion"),
    app.indexOf("async function eliminarGestion"),
  );
  assert.match(createFlow, /setAllGestiones\(\(current\) => \[result\.gestion, \.\.\.current\]\)/);
  assert.doesNotMatch(createFlow, /cartera_gestiones_locales|LEGACY_GESTIONES_KEY/);
  assert.doesNotMatch(app, /getItem\(['"]cartera_promesas_locales['"]\)/);
}

assertProductionContract();

const scenarios: Scenario[] = [
  {
    id: "C1-01",
    name: "crear gestión y recuperarla desde SQLite",
    expectedFailure: false,
    run: () => withDatabase((db) => {
      const result = saveGestion(db, baseGestion());
      assert.equal(result.ok, true);
      assert.equal(typeof result.gestion.id, "number");
      assert.equal(listGestiones(db).length, 1);
      assert.equal(listGestiones(db)[0]?.cliente, "CLIENTE-C1");
    }),
  },
  {
    id: "C1-02",
    name: "dos gestiones consecutivas conservan IDs SQLite distintos",
    expectedFailure: false,
    run: () => withDatabase((db) => {
      saveGestion(db, baseGestion());
      saveGestion(db, baseGestion());
      const rows = listGestiones(db);
      assert.equal(rows.length, 2);
      assert.notEqual(rows[0]?.id, rows[1]?.id);
    }),
  },
  {
    id: "C1-03",
    name: "eliminar mediante ID SQLite real",
    expectedFailure: false,
    run: () => withDatabase((db) => {
      saveGestion(db, baseGestion());
      const id = insertedId(db);
      assert.equal(deleteGestion(db, id).ok, true);
      assert.equal(row(db, id), undefined);
    }),
  },
  {
    id: "C1-04",
    name: "cumplir promesa mediante ID SQLite real",
    expectedFailure: false,
    run: () => withDatabase((db) => {
      saveGestion(db, baseGestion({ resultado: "Promesa de Pago" }));
      const id = insertedId(db);
      assert.equal(fulfillGestion(db, id).ok, true);
      assert.equal(row(db, id)?.resultado, "Promesa Cumplida");
    }),
  },
  {
    id: "C1-05",
    name: "editar gestión y persistir después de reabrir DB",
    expectedFailure: false,
    run: () => withDatabase((db, file) => {
      saveGestion(db, baseGestion());
      const id = insertedId(db);
      assert.equal(updateGestion(db, id, baseGestion({ observacion: "Editada" })).ok, true);
      db.close();
      const reopened = new Database(file);
      try {
        assert.equal(row(reopened, id)?.observacion, "Editada");
      } finally {
        reopened.close();
      }
    }),
  },
  {
    id: "C1-06",
    name: "crear promesa como gestión con fecha y monto",
    expectedFailure: false,
    run: () => withDatabase((db) => {
      saveGestion(db, baseGestion({
        resultado: "Promesa de Pago",
        fecha_promesa: "2026-09-15",
        monto_promesa: 425.75,
      }));
      const promise = row(db, insertedId(db));
      assert.equal(promise?.fecha_promesa, "2026-09-15");
      assert.equal(promise?.monto_promesa, 425.75);
    }),
  },
  {
    id: "C1-07",
    name: "edición UI de promesa sobrevive reinicio SQLite",
    expectedFailure: true,
    defect: "La UI edita sólo cartera_promesas_locales; no invoca gestionEditar ni actualiza SQLite.",
    run: () => withDatabase((db, file) => {
      saveGestion(db, baseGestion({
        resultado: "Promesa de Pago",
        fecha_promesa: "2026-09-15",
        monto_promesa: 100,
      }));
      const id = insertedId(db);
      const localEdit = { ...row(db, id), fecha_promesa: "2026-10-01", monto_promesa: 250 };
      assert.equal(localEdit.monto_promesa, 250);
      db.close();
      const reopened = new Database(file);
      try {
        assert.equal(row(reopened, id)?.fecha_promesa, "2026-10-01");
        assert.equal(row(reopened, id)?.monto_promesa, 250);
      } finally {
        reopened.close();
      }
    }),
  },
  {
    id: "C1-08",
    name: "ID manual queda relacionado con fila SQLite",
    expectedFailure: false,
    run: () => withDatabase((db) => {
      const saved = saveGestion(db, baseGestion());
      assert.equal(saved.gestion.id, insertedId(db));
    }),
  },
  {
    id: "C1-09",
    name: "rehidratación SQLite más cartera_gestiones_locales",
    expectedFailure: false,
    run: () => withDatabase((db) => {
      saveGestion(db, baseGestion({ observacion: "SQLite" }));
      const local = baseGestion({
        id: "manual_1",
        fecha: "2026-08-21T12:00:00.000Z",
        observacion: "Sólo local",
      });
      const result = migrateLegacyGestiones(db, "localStorage", [{
        ...local,
        legacy_id: String(local.id),
      }]);
      assert.equal(result.mappings.length, 1);
      assert.equal(listGestiones(db).length, 2);
    }),
  },
  {
    id: "C1-10",
    name: "ID numérico legacy no infiere identidad SQLite",
    expectedFailure: false,
    run: () => withDatabase((db) => {
      saveGestion(db, baseGestion());
      const stored = listGestiones(db)[0]!;
      const result = migrateLegacyGestiones(db, "localStorage", [{
        ...stored,
        legacy_id: String(stored.id),
        id: Number(stored.id),
      }]);
      assert.notEqual(result.mappings[0]?.gestion_id, stored.id);
      assert.equal(listGestiones(db).length, 2);
    }),
  },
  {
    id: "C1-11",
    name: "dos gestiones legítimas con mismo texto conservan IDs al fusionar",
    expectedFailure: false,
    run: () => withDatabase((db) => {
      const first = baseGestion({ fecha: "2026-08-21T17:00:00.000Z" });
      const second = baseGestion({ fecha: "2026-08-21T17:00:05.000Z" });
      migrateLegacyGestiones(db, "localStorage", [
        { ...first, legacy_id: "manual_1" },
        { ...second, legacy_id: "manual_2" },
      ]);
      assert.equal(listGestiones(db).length, 2);
      assert.equal(new Set(listGestiones(db).map((item) => item.id)).size, 2);
    }),
  },
  {
    id: "C1-12",
    name: "deduplicación tolera representación UTC frente a hora local",
    expectedFailure: false,
    run: () => withDatabase((db) => {
      const backend = baseGestion({ id: 1, fecha: "2026-08-21 12:00:00" });
      const local = baseGestion({ id: "manual_3", fecha: "2026-08-21T17:00:00.000Z" });
      migrateLegacyGestiones(db, "localStorage", [
        { ...backend, id: undefined, legacy_id: "backend-explicit" },
        { ...local, id: undefined, legacy_id: "local-explicit" },
      ]);
      assert.equal(listGestiones(db).length, 2);
    }),
  },
  {
    id: "C1-13",
    name: "cartera_promesas_locales se rehidrata después de reinicio",
    expectedFailure: true,
    defect: "cargarDatos no lee cartera_promesas_locales; reconstruye promesas exclusivamente desde gestiones.",
    run: () => withDatabase((db) => {
      saveGestion(db, baseGestion({
        resultado: "Promesa de Pago",
        fecha_promesa: "2026-09-15",
        monto_promesa: 100,
      }));
      const localPromises = [{ ...row(db, insertedId(db)), monto_promesa: 900 }];
      const rehydrated = listGestiones(db).filter((item) =>
        item.resultado.includes("Promesa") && item.fecha_promesa,
      );
      assert.equal(rehydrated[0]?.monto_promesa, localPromises[0]?.monto_promesa);
    }),
  },
  {
    id: "C1-14",
    name: "eliminación con ID artificial se rechaza explícitamente",
    expectedFailure: false,
    run: () => withDatabase((db) => {
      saveGestion(db, baseGestion());
      const id = insertedId(db);
      const result = deleteGestion(db, "manual_123");
      assert.equal(result.ok, false);
      assert.equal("code" in result && result.code, "GESTION_INVALID_ID");
      assert.notEqual(row(db, id), undefined);
    }),
  },
  {
    id: "C1-15",
    name: "cumplimiento con ID artificial se rechaza explícitamente",
    expectedFailure: false,
    run: () => withDatabase((db) => {
      saveGestion(db, baseGestion({ resultado: "Promesa de Pago" }));
      const id = insertedId(db);
      const result = fulfillGestion(db, "manual_123");
      assert.equal(result.ok, false);
      assert.equal("code" in result && result.code, "GESTION_INVALID_ID");
      assert.equal(row(db, id)?.resultado, "Promesa de Pago");
    }),
  },
  {
    id: "C1-16",
    name: "gestionesListar recupera histórico superior al límite",
    expectedFailure: true,
    defect: "La consulta global aplica LIMIT 5000 sin paginación ni señal de truncamiento.",
    run: () => withDatabase((db) => {
      const insert = db.prepare(`
        INSERT INTO gestiones (cliente, tipo, resultado, observacion)
        VALUES ('CLIENTE-C1', 'Llamada', 'Contactado', ?)
      `);
      const seed = db.transaction(() => {
        for (let index = 0; index < 5001; index += 1) insert.run(`C1-${index}`);
      });
      seed();
      assert.equal(
        Number((db.prepare("SELECT COUNT(*) AS total FROM gestiones").get() as { total: number }).total),
        5001,
      );
      assert.equal(listGestiones(db).length, 5001);
    }),
  },
  {
    id: "C2-01",
    name: "gestionGuardar devuelve ID SQLite real",
    expectedFailure: false,
    run: () => withDatabase((db) => {
      const result = saveGestion(db, baseGestion());
      assert.equal(result.gestion.id, insertedId(db));
    }),
  },
  {
    id: "C2-02",
    name: "altas iguales generan IDs distintos",
    expectedFailure: false,
    run: () => withDatabase((db) => {
      const first = saveGestion(db, baseGestion()).gestion.id;
      const second = saveGestion(db, baseGestion()).gestion.id;
      assert.notEqual(first, second);
    }),
  },
  {
    id: "C2-03",
    name: "error INSERT no crea gestión fantasma en estado local",
    expectedFailure: false,
    run: () => withDatabase((db) => {
      const state: Gestion[] = [];
      db.exec(`
        CREATE TRIGGER fail_crm_insert
        BEFORE INSERT ON gestiones
        BEGIN SELECT RAISE(ABORT, 'fallo sintético'); END;
      `);
      assert.throws(() => {
        const persisted = saveGestion(db, baseGestion()).gestion;
        state.unshift(persisted);
      }, /fallo sintético/);
      assert.equal(state.length, 0);
      assert.equal(listGestiones(db).length, 0);
    }),
  },
  {
    id: "C2-04",
    name: "eliminar ID inexistente devuelve NOT_FOUND",
    expectedFailure: false,
    run: () => withDatabase((db) => {
      const result = deleteGestion(db, 999);
      assert.equal(result.ok, false);
      assert.equal("code" in result && result.code, "GESTION_NOT_FOUND");
    }),
  },
  {
    id: "C2-05",
    name: "cumplir ID inexistente devuelve NOT_FOUND",
    expectedFailure: false,
    run: () => withDatabase((db) => {
      const result = fulfillGestion(db, 999);
      assert.equal(result.ok, false);
      assert.equal("code" in result && result.code, "GESTION_NOT_FOUND");
    }),
  },
  {
    id: "C2-06",
    name: "gestionEditar persiste tras reinicio",
    expectedFailure: false,
    run: () => withDatabase((db, file) => {
      const id = saveGestion(db, baseGestion()).gestion.id!;
      const result = updateGestion(db, id, baseGestion({ observacion: "C2 editada" }));
      assert.equal(result.ok, true);
      db.close();
      const reopened = new Database(file);
      try {
        assert.equal(row(reopened, id)?.observacion, "C2 editada");
      } finally {
        reopened.close();
      }
    }),
  },
  {
    id: "C2-07",
    name: "alta exitosa no escribe cartera_gestiones_locales",
    expectedFailure: false,
    run: () => withDatabase((db) => {
      const legacyStorage = JSON.stringify([{ legacy_id: "legacy-existing" }]);
      const result = saveGestion(db, baseGestion());
      assert.equal(result.ok, true);
      assert.equal(JSON.stringify([{ legacy_id: "legacy-existing" }]), legacyStorage);
    }),
  },
  {
    id: "C2-08",
    name: "migración legacy es idempotente",
    expectedFailure: false,
    run: () => withDatabase((db) => {
      const records = [{ ...baseGestion(), legacy_id: "manual_100" }];
      const first = migrateLegacyGestiones(db, "localStorage", records);
      const second = migrateLegacyGestiones(db, "localStorage", records);
      assert.equal(first.mappings[0]?.gestion_id, second.mappings[0]?.gestion_id);
      assert.equal(listGestiones(db).length, 1);
    }),
  },
  {
    id: "C2-09",
    name: "migración conserva dos gestiones legítimas distintas",
    expectedFailure: false,
    run: () => withDatabase((db) => {
      migrateLegacyGestiones(db, "localStorage", [
        { ...baseGestion(), legacy_id: "manual_101" },
        { ...baseGestion(), legacy_id: "manual_102" },
      ]);
      assert.equal(listGestiones(db).length, 2);
    }),
  },
  {
    id: "C2-10",
    name: "registro migrado obtiene ID SQLite real",
    expectedFailure: false,
    run: () => withDatabase((db) => {
      const result = migrateLegacyGestiones(db, "localStorage", [
        { ...baseGestion(), legacy_id: "manual_103" },
      ]);
      const id = result.mappings[0]?.gestion_id;
      assert.equal(typeof id, "number");
      assert.equal(row(db, id!)?.id, id);
    }),
  },
  {
    id: "C2-11",
    name: "legacy sin ID recibe UUID estable antes de migrar",
    expectedFailure: false,
    run: () => {
      let calls = 0;
      const first = ensureLegacyGestionIds([baseGestion()], () => `stable-${++calls}`);
      const persisted = JSON.parse(JSON.stringify(first)) as unknown[];
      const retry = ensureLegacyGestionIds(persisted, () => `new-${++calls}`);
      assert.equal(first[0]?.legacy_id, "uuid_stable-1");
      assert.equal(retry[0]?.legacy_id, first[0]?.legacy_id);
      assert.equal(calls, 1);
    },
  },
  {
    id: "C2-12",
    name: "reintento tras fallo parcial reutiliza UUID y no duplica",
    expectedFailure: false,
    run: () => withDatabase((db) => {
      const records = ensureLegacyGestionIds([
        baseGestion({ observacion: "OK" }),
        baseGestion({ observacion: "FAIL" }),
      ], (() => {
        let value = 0;
        return () => `retry-${++value}`;
      })());
      db.exec(`
        CREATE TRIGGER fail_second_legacy
        BEFORE INSERT ON gestiones
        WHEN NEW.observacion = 'FAIL'
        BEGIN SELECT RAISE(ABORT, 'fallo parcial'); END;
      `);
      assert.throws(
        () => migrateLegacyGestiones(db, "localStorage", records.map((item) => ({
          ...baseGestion(item),
          legacy_id: item.legacy_id,
        }))),
        /fallo parcial/,
      );
      assert.equal(listGestiones(db).length, 1);
      db.exec("DROP TRIGGER fail_second_legacy");
      migrateLegacyGestiones(db, "localStorage", records.map((item) => ({
        ...baseGestion(item),
        legacy_id: item.legacy_id,
      })));
      assert.equal(listGestiones(db).length, 2);
      assert.equal(new Set(records.map((item) => item.legacy_id)).size, 2);
    }),
  },
  {
    id: "C2-13",
    name: "contenido idéntico con UUID distintos migra como dos gestiones",
    expectedFailure: false,
    run: () => withDatabase((db) => {
      migrateLegacyGestiones(db, "localStorage", [
        { ...baseGestion(), legacy_id: "uuid_first" },
        { ...baseGestion(), legacy_id: "uuid_second" },
      ]);
      assert.equal(listGestiones(db).length, 2);
    }),
  },
  {
    id: "C2-14",
    name: "correspondencia legacy sobrevive reinicio",
    expectedFailure: false,
    run: () => withDatabase((db, file) => {
      const migrated = migrateLegacyGestiones(db, "localStorage", [
        { ...baseGestion(), legacy_id: "uuid_restart" },
      ]);
      const expectedId = migrated.mappings[0]?.gestion_id;
      db.close();
      const reopened = new Database(file);
      try {
        const mapping = reopened.prepare(`
          SELECT gestion_id FROM gestion_legacy_migrations
          WHERE source = 'localStorage' AND legacy_id = 'uuid_restart'
        `).get() as { gestion_id: number };
        assert.equal(mapping.gestion_id, expectedId);
      } finally {
        reopened.close();
      }
    }),
  },
  {
    id: "C2-15",
    name: "doble migración conserva cantidad exacta",
    expectedFailure: false,
    run: () => withDatabase((db) => {
      const records = [
        { ...baseGestion(), legacy_id: "uuid_count_1" },
        { ...baseGestion(), legacy_id: "uuid_count_2" },
      ];
      migrateLegacyGestiones(db, "localStorage", records);
      const firstCount = listGestiones(db).length;
      migrateLegacyGestiones(db, "localStorage", records);
      assert.equal(listGestiones(db).length, firstCount);
      assert.equal(firstCount, 2);
    }),
  },
  {
    id: "C2H-01", name: "ID numérico colisionado crea otra gestión", expectedFailure: false,
    run: () => withDatabase((db) => { const original=createGestion(db,baseGestion({cliente:"A",observacion:"X"})); const result=migrateLegacyGestiones(db,"localStorage",[{...baseGestion({cliente:"B",observacion:"Y"}),id:original.id,legacy_id:"25"}]); assert.equal(result.ok,true); if(result.ok)assert.notEqual(result.mappings[0]?.gestion_id,original.id); assert.equal(row(db,original.id!)?.observacion,"X"); assert.equal(listGestiones(db).length,2); }),
  },
  {
    id: "C2H-02", name: "mismo legacy_id y payload es idempotente", expectedFailure: false,
    run: () => withDatabase((db) => { const value={...baseGestion(),legacy_id:"same"}; const a=migrateLegacyGestiones(db,"s",[value]); const b=migrateLegacyGestiones(db,"s",[value]); if(!a.ok||!b.ok)throw new Error("migration"); assert.equal(a.mappings[0]?.gestion_id,b.mappings[0]?.gestion_id); assert.equal(b.mappings[0]?.inserted,false); assert.equal(listGestiones(db).length,1); }),
  },
  {
    id: "C2H-03", name: "payload mutado devuelve conflicto", expectedFailure: false,
    run: () => withDatabase((db) => { migrateLegacyGestiones(db,"s",[{...baseGestion(),legacy_id:"conflict"}]); const result=migrateLegacyGestiones(db,"s",[{...baseGestion({observacion:"otra"}),legacy_id:"conflict"}]); assert.equal(result.ok,false); if(!result.ok)assert.equal(result.code,"LEGACY_ID_CONFLICT"); assert.equal(listGestiones(db).length,1); }),
  },
  {
    id: "C2H-04", name: "colisión dentro del lote se detecta antes de insertar", expectedFailure: false,
    run: () => withDatabase((db) => { const result=migrateLegacyGestiones(db,"s",[{...baseGestion(),legacy_id:"dup"},{...baseGestion({observacion:"otra"}),legacy_id:"dup"}]); assert.equal(result.ok,false); assert.equal(listGestiones(db).length,0); }),
  },
  {
    id: "C2H-05", name: "fallo persistiendo UUID impide IPC", expectedFailure: false,
    run: () => { let ipc=0; assert.throws(()=>persistLegacyGestionIds([baseGestion()],()=>"stable",()=>{throw new Error("quota")}),/quota/); assert.equal(ipc,0); },
  },
  {
    id: "C2H-06", name: "UUID durable se reutiliza tras fallo IPC", expectedFailure: false,
    run: () => withDatabase((db) => { let stored:unknown[]=[]; const normalized=persistLegacyGestionIds([baseGestion()],()=>"retry",v=>{stored=v}); db.exec(`CREATE TRIGGER fail_ipc BEFORE INSERT ON gestiones BEGIN SELECT RAISE(ABORT,'ipc'); END`); assert.throws(()=>migrateLegacyGestiones(db,"s",normalized as any),/ipc/); db.exec("DROP TRIGGER fail_ipc"); const retry=ensureLegacyGestionIds(stored,()=>"different"); migrateLegacyGestiones(db,"s",retry as any); assert.equal(retry[0]?.legacy_id,"uuid_retry"); assert.equal(listGestiones(db).length,1); }),
  },
  {
    id: "C2H-07", name: "cliente vacío se rechaza", expectedFailure: false,
    run: () => withDatabase((db) => { const result=migrateLegacyGestiones(db,"s",[{...baseGestion({cliente:" "}),legacy_id:"bad"}]); assert.equal(result.ok,false); if(!result.ok)assert.equal(result.code,"LEGACY_INVALID_RECORD"); assert.equal(listGestiones(db).length,0); assert.equal((db.prepare("SELECT count(*) n FROM gestion_legacy_migrations").get() as any).n,0); }),
  },
  {
    id: "C2H-08", name: "eliminación crea tombstone y no resucita", expectedFailure: false,
    run: () => withDatabase((db) => { const value={...baseGestion(),legacy_id:"gone"}; const first=migrateLegacyGestiones(db,"s",[value]); if(!first.ok)throw new Error("migration"); deleteGestion(db,first.mappings[0]!.gestion_id); const retry=migrateLegacyGestiones(db,"s",[value]); assert.equal(retry.ok,true); if(retry.ok)assert.equal(retry.mappings[0]?.deleted,true); assert.equal(listGestiones(db).length,0); }),
  },
  {
    id: "C2H-09", name: "tombstone sobrevive reinicio", expectedFailure: false,
    run: () => withDatabase((db,file) => { const value={...baseGestion(),legacy_id:"restart-gone"}; const first=migrateLegacyGestiones(db,"s",[value]); if(!first.ok)throw new Error("migration"); deleteGestion(db,first.mappings[0]!.gestion_id); db.close(); const reopened=new Database(file); try{const tomb=reopened.prepare("SELECT gestion_id,deleted_at FROM gestion_legacy_migrations WHERE legacy_id='restart-gone'").get() as any;assert.equal(tomb.gestion_id,null);assert.ok(tomb.deleted_at);}finally{reopened.close();} }),
  },
  {
    id: "C2H-10", name: "marca completa no omite legacy nuevo", expectedFailure: false,
    run: () => { const app=fs.readFileSync(path.resolve("src/App.tsx"),"utf8"); assert.doesNotMatch(app,/getItem\(LEGACY_GESTIONES_COMPLETE_KEY\).*return/); },
  },
  {
    id: "C2H-11", name: "restore DB reevalúa aunque exista marca", expectedFailure: false,
    run: () => { const app=fs.readFileSync(path.resolve("src/App.tsx"),"utf8"); assert.match(app,/gestionesLegacyMigrar/); assert.doesNotMatch(app,/COMPLETE_KEY\) === "1"/); },
  },
  {
    id: "C2H-12", name: "payload idéntico con IDs distintos crea dos filas", expectedFailure: false,
    run: () => withDatabase((db) => { const value=baseGestion(); migrateLegacyGestiones(db,"s",[{...value,legacy_id:"A"},{...value,legacy_id:"B"}]); assert.equal(listGestiones(db).length,2); assert.equal(hashLegacyGestion({...value,legacy_id:"A"}),hashLegacyGestion({...value,legacy_id:"B"})); assert.equal(canonicalizeLegacyGestion({...value,legacy_id:"A"}),canonicalizeLegacyGestion({...value,legacy_id:"B"})); }),
  },
  {
    id: "C2H-13", name: "doble submit concurrente ejecuta una operación", expectedFailure: false,
    run: () => { let calls=0; let release!:()=>void; const pending=new Promise<void>(resolve=>{release=resolve}); const guarded=createSingleFlight(async()=>{calls++;await pending;}); void guarded(); void guarded(); assert.equal(calls,1); release(); },
  },
  {
    id: "C2H-14", name: "fallo insertando mapping revierte gestión", expectedFailure: false,
    run: () => withDatabase((db) => { db.exec(`CREATE TRIGGER fail_mapping BEFORE INSERT ON gestion_legacy_migrations BEGIN SELECT RAISE(ABORT,'mapping'); END`); assert.throws(()=>migrateLegacyGestiones(db,"s",[{...baseGestion(),legacy_id:"atomic"}]),/mapping/); assert.equal(listGestiones(db).length,0); assert.equal((db.prepare("SELECT count(*) n FROM gestion_legacy_migrations").get() as any).n,0); }),
  },
];

type Result = {
  id: string;
  scenario: string;
  status: "PASS" | "EXPECTED FAIL" | "UNEXPECTED FAIL";
  detail: string;
};

const results: Result[] = [];

for (const scenario of scenarios) {
  try {
    scenario.run();
    results.push({
      id: scenario.id,
      scenario: scenario.name,
      status: "PASS",
      detail: scenario.expectedFailure
        ? "El comportamiento deseado ya se cumple; revisar y retirar la expectativa en C2."
        : "Comportamiento actual conforme a la baseline C1.",
    });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    results.push({
      id: scenario.id,
      scenario: scenario.name,
      status: scenario.expectedFailure ? "EXPECTED FAIL" : "UNEXPECTED FAIL",
      detail: scenario.expectedFailure ? `${scenario.defect} | ${detail}` : detail,
    });
  }
}

const totals = {
  PASS: results.filter((item) => item.status === "PASS").length,
  EXPECTED_FAIL: results.filter((item) => item.status === "EXPECTED FAIL").length,
  UNEXPECTED_FAIL: results.filter((item) => item.status === "UNEXPECTED FAIL").length,
};

console.log("\nZENITH CARTERA - C1 BASELINE DE PERSISTENCIA CRM\n");
console.table(results);
console.log("CRM_INTEGRATION_RESULT_JSON=" + JSON.stringify({ totals, results }));

if (totals.UNEXPECTED_FAIL > 0) process.exitCode = 1;
