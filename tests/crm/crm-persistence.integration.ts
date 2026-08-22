import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

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

function saveGestion(db: Database.Database, data: Gestion): { ok: true } {
  db.prepare(`
    INSERT INTO gestiones (
      cliente, tipo, resultado, observacion, fecha_promesa,
      monto_promesa, usuario, motivo, fecha, creado_en
    ) VALUES (
      @cliente, @tipo, @resultado, @observacion, @fecha_promesa,
      @monto_promesa, @usuario, @motivo,
      datetime('now', 'localtime'), datetime('now', 'localtime')
    )
  `).run({
    ...data,
    fecha_promesa: data.fecha_promesa ?? null,
    monto_promesa: data.monto_promesa ?? 0,
    usuario: data.usuario || "sistema",
    motivo: data.motivo || null,
  });
  return { ok: true };
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

function editGestion(db: Database.Database, id: number, data: Gestion): { ok: true } {
  db.prepare(`
    UPDATE gestiones
    SET tipo = @tipo,
        resultado = @resultado,
        observacion = @observacion,
        fecha_promesa = @fecha_promesa,
        monto_promesa = @monto_promesa
    WHERE id = @id
  `).run({
    id,
    tipo: data.tipo,
    resultado: data.resultado,
    observacion: data.observacion,
    fecha_promesa: data.fecha_promesa ?? null,
    monto_promesa: data.monto_promesa ?? 0,
  });
  return { ok: true };
}

function deleteGestion(db: Database.Database, id: number | string): { ok: true } {
  db.prepare("DELETE FROM gestiones WHERE id = ?").run(id);
  return { ok: true };
}

function fulfillGestion(db: Database.Database, id: number | string): { ok: true } {
  db.prepare(`
    UPDATE gestiones
    SET resultado = 'Promesa Cumplida'
    WHERE id = ?
  `).run(id);
  return { ok: true };
}

function mergeGestiones(backend: Gestion[], local: Gestion[]) {
  const merged = [...backend];
  const unsynchronized: Gestion[] = [];

  for (const localGestion of local) {
    const found = backend.some((stored) => {
      const sameClient = stored.cliente === localGestion.cliente;
      const sameType = stored.tipo === localGestion.tipo;
      const sameObservation = stored.observacion === localGestion.observacion;
      let sameDateish = false;

      if (localGestion.fecha && stored.fecha) {
        const localTime = new Date(localGestion.fecha).getTime();
        const storedTime = new Date(stored.fecha).getTime();
        if (!Number.isNaN(localTime) && !Number.isNaN(storedTime)) {
          sameDateish = Math.abs(localTime - storedTime) < 10_000;
        }
      }

      return sameClient && sameType && sameObservation && sameDateish;
    });

    if (!found) {
      merged.push(localGestion);
      unsynchronized.push(localGestion);
    }
  }

  return { merged, unsynchronized };
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
  return db.prepare("SELECT * FROM gestiones WHERE id = ?").get(id) as
    | Gestion
    | undefined;
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
  assert.match(main, /return \{ ok: true \};\s*\}\);\s*\r?\n\s*ipcMain\.handle\("gestionesListar"/);
  assert.match(main, /LIMIT 5000/);
  assert.match(main, /resultado = 'Promesa Cumplida'/);
  assert.match(app, /cartera_gestiones_locales/);
  assert.match(app, /cartera_promesas_locales/);
  assert.match(app, /Math\.abs\(localTime - bgTime\) < 10000/);
  assert.doesNotMatch(app, /getItem\(['"]cartera_promesas_locales['"]\)/);
}

assertProductionContract();

const scenarios: Scenario[] = [
  {
    id: "C1-01",
    name: "crear gestión y recuperarla desde SQLite",
    expectedFailure: false,
    run: () => withDatabase((db) => {
      assert.deepEqual(saveGestion(db, baseGestion()), { ok: true });
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
      deleteGestion(db, id);
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
      fulfillGestion(db, id);
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
      editGestion(db, id, baseGestion({ observacion: "Editada" }));
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
    expectedFailure: true,
    defect: "gestionGuardar devuelve sólo {ok:true}; el ID manual_<timestamp> no se enlaza con lastInsertRowid.",
    run: () => withDatabase((db) => {
      saveGestion(db, baseGestion());
      const manual = `manual_${Date.now()}`;
      assert.equal(String(insertedId(db)), manual);
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
      const result = mergeGestiones(listGestiones(db), [local]);
      assert.equal(result.merged.length, 2);
      assert.deepEqual(result.unsynchronized, [local]);
    }),
  },
  {
    id: "C1-10",
    name: "duplicado real SQLite/localStorage se colapsa",
    expectedFailure: false,
    run: () => withDatabase((db) => {
      saveGestion(db, baseGestion());
      const stored = listGestiones(db)[0]!;
      const local = { ...stored, id: "manual_2" };
      const result = mergeGestiones([stored], [local]);
      assert.equal(result.merged.length, 1);
      assert.equal(result.unsynchronized.length, 0);
    }),
  },
  {
    id: "C1-11",
    name: "dos gestiones legítimas con mismo texto conservan IDs al fusionar",
    expectedFailure: true,
    defect: "La heurística ignora los IDs y colapsa gestiones legítimas con cliente, tipo, observación y fecha cercanos.",
    run: () => {
      const first = baseGestion({ id: 1, fecha: "2026-08-21T17:00:00.000Z" });
      const second = baseGestion({ id: "manual_2", fecha: "2026-08-21T17:00:05.000Z" });
      const result = mergeGestiones([first], [second]);
      assert.equal(result.merged.length, 2);
      assert.deepEqual(result.unsynchronized, [second]);
    },
  },
  {
    id: "C1-12",
    name: "deduplicación tolera representación UTC frente a hora local",
    expectedFailure: false,
    run: () => {
      const backend = baseGestion({ id: 1, fecha: "2026-08-21 12:00:00" });
      const local = baseGestion({ id: "manual_3", fecha: "2026-08-21T17:00:00.000Z" });
      const result = mergeGestiones([backend], [local]);
      assert.equal(result.merged.length, 1);
    },
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
    name: "eliminación con ID artificial afecta fila SQLite",
    expectedFailure: true,
    defect: "SQLite compara INTEGER id con manual_<timestamp>; devuelve ok:true aunque no elimina filas.",
    run: () => withDatabase((db) => {
      saveGestion(db, baseGestion());
      const id = insertedId(db);
      assert.deepEqual(deleteGestion(db, "manual_123"), { ok: true });
      assert.equal(row(db, id), undefined);
    }),
  },
  {
    id: "C1-15",
    name: "cumplimiento con ID artificial afecta fila SQLite",
    expectedFailure: true,
    defect: "SQLite compara INTEGER id con manual_<timestamp>; devuelve ok:true aunque no actualiza filas.",
    run: () => withDatabase((db) => {
      saveGestion(db, baseGestion({ resultado: "Promesa de Pago" }));
      const id = insertedId(db);
      assert.deepEqual(fulfillGestion(db, "manual_123"), { ok: true });
      assert.equal(row(db, id)?.resultado, "Promesa Cumplida");
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
