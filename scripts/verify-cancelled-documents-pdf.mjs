import fs from "node:fs";

const checks = [
  ["src/pdf/reports/cancelledDocumentsReport.ts", "generateCancelledDocumentsReport"],
  ["src/pdf/reports/cancelledDocumentsReport.ts", "drawPdfHeader"],
  ["src/pdf/reports/cancelledDocumentsReport.ts", "drawPdfMetricCards"],
  ["src/pdf/reports/cancelledDocumentsReport.ts", "savePdfDocument"],
  ["src/pdf/index.ts", "generateCancelledDocumentsReport"],
  ["src/pages/CancelledDocumentsPage.tsx", "📄 Exportar PDF"],
  ["src/pages/CancelledDocumentsPage.tsx", "createPdfContext"],
];

let failed = false;

for (const [file, token] of checks) {
  const ok = fs.existsSync(file) && fs.readFileSync(file, "utf8").includes(token);
  console.log(`${ok ? "OK" : "ERROR"} - ${file}: ${token}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
console.log("PDF de documentos anulados verificado.");
