import fs from "node:fs";

const checks = [
  [
    "src/pages/gestion/services/gestion.service.ts",
    "export function processGestionItems",
  ],
  [
    "src/pages/gestion/services/gestion.service.ts",
    "export function calculateGestionTotals",
  ],
  [
    "src/pages/gestion/services/gestion.service.ts",
    "normalizeText",
  ],
  [
    "src/pages/gestion/services/index.ts",
    "processGestionItems",
  ],
];

let failed = false;

for (const [file, token] of checks) {
  const content = fs.existsSync(file)
    ? fs.readFileSync(file, "utf8")
    : "";

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
  "Fundación de servicios de Gestión verificada.",
);
