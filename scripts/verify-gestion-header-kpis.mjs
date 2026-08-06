import fs from "node:fs";

const checks = [
  [
    "src/pages/gestion/components/GestionSectionTitle.tsx",
    "export function GestionSectionTitle",
  ],
  [
    "src/pages/gestion/components/GestionKpiCard.tsx",
    "export function GestionKpiCard",
  ],
  [
    "src/pages/gestion/components/index.ts",
    "GestionSectionTitle",
  ],
  [
    "src/App.tsx",
    "<GestionSectionTitle",
  ],
  [
    "src/App.tsx",
    "<GestionKpiCard",
  ],
  [
    "src/App.tsx",
    'from "./pages/gestion/components"',
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
  "Extracción de encabezados y KPI de Gestión verificada.",
);
