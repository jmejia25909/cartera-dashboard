import fs from "node:fs";

const main = fs.readFileSync("electron/main.ts", "utf8");
const db = fs.readFileSync("electron/db.ts", "utf8");

const checks = [
  ["Import del motor", main.includes('import { importContificoExcel } from "./importContifico";')],
  ["Handler IPC", /ipcMain\.handle\(\s*["']importarContifico["']/.test(main)],
  ["Uso del motor", main.includes("return importContificoExcel(selection.filePaths[0], db);")],
  ["Migracion historica", db.includes("Clasificar documentos historicos de credito")],
  ["Estado pendiente", db.includes("credito_fuente = 'PENDIENTE_CONFIGURACION'")],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? "OK" : "ERROR"} - ${name}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log("Ruta de importacion verificada.");
