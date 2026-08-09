import fs from "node:fs";

const main = fs.readFileSync("electron/main.ts", "utf8");
const db = fs.readFileSync("electron/db.ts", "utf8");

const checks = [
  [db.includes("CREATE TABLE IF NOT EXISTS importaciones"), "tabla importaciones"],
  [main.includes("function listImportHistory"), "listImportHistory"],
  [main.includes(".all(args.tipo, limit);"), "filtro tipo + límite"],
  [main.includes(".all(limit);"), "límite general"],
  [main.includes('"importHistoryList"'), "IPC importHistoryList"],
  [main.includes('"importHistoryGet"'), "IPC importHistoryGet"],
  [main.includes('"importHistoryRevert"'), "IPC importHistoryRevert"],
  [main.includes('db.prepare("DELETE FROM importaciones").run();'), "limpieza importaciones"],
];

let failed = false;

for (const [ok, label] of checks) {
  console.log(`${ok ? "OK" : "ERROR"} - ${label}`);
  if (!ok) failed = true;
}

if (main.includes("\\`")) {
  console.log("ERROR - quedan backticks escapados en main.ts");
  failed = true;
}

if (failed) process.exit(1);

console.log("PACK 035 FIX-003 verificado.");
