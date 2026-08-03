import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";

const sourceArg = process.argv[2];
if (!sourceArg) {
  console.error('Uso: pnpm data:clean-abonos -- "C:\\ruta\\cartera.db"');
  process.exit(1);
}

const source = path.resolve(sourceArg);
if (!fs.existsSync(source)) {
  throw new Error(`No existe la base: ${source}`);
}
if (path.extname(source).toLowerCase() !== ".db") {
  throw new Error("La entrada debe ser un archivo .db.");
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.join(path.dirname(source), `limpieza-abonos-${stamp}`);
fs.mkdirSync(outputDir, { recursive: true });

const working = path.join(outputDir, "cartera-limpia.db");
const untouchedBackup = path.join(outputDir, "cartera-original-sin-cambios.db");
fs.copyFileSync(source, working);
fs.copyFileSync(source, untouchedBackup);

const sha256 = (file) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

const db = new Database(working);
db.pragma("journal_mode = DELETE");
db.pragma("foreign_keys = OFF");

const integrityBefore = db.pragma("integrity_check", { simple: true });
if (integrityBefore !== "ok") {
  db.close();
  throw new Error(`La copia no superó integrity_check: ${integrityBefore}`);
}

const before = db.prepare("SELECT COUNT(*) AS total FROM abonos").get().total;

const duplicateGroups = db.prepare(`
  SELECT COUNT(*) AS total
  FROM (
    SELECT
      UPPER(REPLACE(REPLACE(REPLACE(TRIM(documento), '-', ''), ' ', ''), '.', '')) AS documento_normalizado,
      ROUND(total_anterior, 2) AS total_anterior_normalizado,
      ROUND(total_nuevo, 2) AS total_nuevo_normalizado,
      COALESCE(observacion, '') AS observacion_normalizada
    FROM abonos
    GROUP BY
      documento_normalizado,
      total_anterior_normalizado,
      total_nuevo_normalizado,
      observacion_normalizada
    HAVING COUNT(*) > 1
  )
`).get().total;

const clean = db.transaction(() => {
  db.exec(`
    CREATE TABLE abonos_limpios AS
    SELECT a.*
    FROM abonos a
    INNER JOIN (
      SELECT MIN(id) AS id_conservar
      FROM abonos
      GROUP BY
        UPPER(REPLACE(REPLACE(REPLACE(TRIM(documento), '-', ''), ' ', ''), '.', '')),
        ROUND(total_anterior, 2),
        ROUND(total_nuevo, 2),
        COALESCE(observacion, '')
    ) x ON x.id_conservar = a.id;

    DELETE FROM abonos;

    INSERT INTO abonos (id, documento, total_anterior, total_nuevo, fecha, observacion)
    SELECT id, documento, total_anterior, total_nuevo, fecha, observacion
    FROM abonos_limpios
    ORDER BY id;

    DROP TABLE abonos_limpios;
  `);
});

clean();

const after = db.prepare("SELECT COUNT(*) AS total FROM abonos").get().total;
const integrityAfter = db.pragma("integrity_check", { simple: true });
db.exec("VACUUM");
db.close();

if (integrityAfter !== "ok") {
  throw new Error(`La copia limpia no superó integrity_check: ${integrityAfter}`);
}

const report = {
  source,
  generatedAt: new Date().toISOString(),
  originalSha256: sha256(source),
  untouchedBackupSha256: sha256(untouchedBackup),
  cleanedSha256: sha256(working),
  integrityBefore,
  integrityAfter,
  duplicateGroups,
  recordsBefore: before,
  recordsAfter: after,
  recordsRemoved: before - after,
  originalWasModified: false,
};

fs.writeFileSync(
  path.join(outputDir, "resultado-limpieza.json"),
  JSON.stringify(report, null, 2) + "\n",
  "utf8",
);

fs.writeFileSync(
  path.join(outputDir, "LEEME.txt"),
  [
    "LIMPIEZA CONTROLADA DE ABONOS",
    "",
    `Registros antes: ${before}`,
    `Registros despues: ${after}`,
    `Registros removidos: ${before - after}`,
    `Integridad antes: ${integrityBefore}`,
    `Integridad despues: ${integrityAfter}`,
    "",
    "La base original NO fue modificada.",
    "cartera-original-sin-cambios.db es un respaldo adicional.",
    "cartera-limpia.db es la copia depurada para pruebas.",
    "",
  ].join("\r\n"),
  "utf8",
);

console.log("");
console.log("LIMPIEZA CONTROLADA FINALIZADA");
console.log(`Carpeta: ${outputDir}`);
console.log(`Antes: ${before}`);
console.log(`Después: ${after}`);
console.log(`Removidos: ${before - after}`);
console.log("La base original no fue modificada.");
