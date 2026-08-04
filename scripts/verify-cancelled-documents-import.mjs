import fs from "node:fs";

const checks = [
  ["electron/importCancelledDocuments.ts", "importCancelledDocumentsExcel"],
  ["electron/main.ts", "importCancelledDocuments"],
  ["electron/main.ts", "cancelledDocumentsList"],
  ["electron/db.ts", "documentos_anulados_log"],
  ["electron/preload.ts", "importCancelledDocuments"],
  ["src/assets/types/global.d.ts", "cancelledDocumentsList"],
  ["src/pages/CancelledDocumentsPage.tsx", "Documentos anulados"],
  ["src/pages/index.ts", "CancelledDocumentsPage"],
  ["src/App.tsx", 'tab === "anulados"'],
  ["src/app/config/navigation.ts", "anulados"],
];

let failed = false;
for (const [file, token] of checks) {
  const ok = fs.existsSync(file) && fs.readFileSync(file, "utf8").includes(token);
  console.log(`${ok ? "OK" : "ERROR"} - ${file}: ${token}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log("Cancelled Documents Import Pack verificado.");
