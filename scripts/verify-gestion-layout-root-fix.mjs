import fs from "node:fs";

const file = "src/App.css";
const content = fs.readFileSync(file, "utf8");

const checks = [
  "GESTION ROOT LAYOUT FIX PACK 022",
  ".gestion-powerbi-page {",
  ".gestion-powerbi-page > .gestion-executive-layout",
  ".gestion-powerbi-page > .card",
  "overflow: visible !important",
];

let failed = false;

for (const token of checks) {
  const ok = content.includes(token);
  console.log(`${ok ? "OK" : "ERROR"} - ${file}: ${token}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);

console.log("Corrección raíz del layout de Gestión verificada.");
