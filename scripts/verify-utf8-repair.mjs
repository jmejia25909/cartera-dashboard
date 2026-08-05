import fs from "node:fs";

const files = [
  "src/App.tsx",
  "src/pdf/reports/analisisReport.ts",
  "electron/db.ts",
];

const forbidden = [
  "\u00C3",
  "\u00C2",
  "\uFFFD",
  "\u00F0\u0178",
  "\u00E2\u20AC",
];

let failed = false;

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const findings = forbidden.filter(
    (token) => content.includes(token),
  );

  const ok = findings.length === 0;

  console.log(
    `${ok ? "OK" : "ERROR"} - ${file}` +
      (ok ? "" : `: ${findings.join(", ")}`),
  );

  if (!ok) {
    failed = true;
  }
}

const requiredTexts = [
  ["src/App.tsx", "KPIs de Gestión"],
  ["src/App.tsx", "Filtros y Acciones"],
  ["src/App.tsx", "Panel de Análisis"],
  ["src/App.tsx", "Deudores Crónicos"],
  [
    "src/pdf/reports/analisisReport.ts",
    "Análisis de Riesgo",
  ],
  [
    "electron/db.ts",
    "Configuración de SQLite",
  ],
];

for (const [file, token] of requiredTexts) {
  const content = fs.readFileSync(file, "utf8");
  const ok = content.includes(token);

  console.log(
    `${ok ? "OK" : "ERROR"} - ${file}: ${token}`,
  );

  if (!ok) {
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log(
  "Reparación UTF-8 verificada correctamente.",
);
