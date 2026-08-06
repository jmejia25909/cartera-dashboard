import fs from "node:fs";

const checks = [
  [
    "src/pages/gestion/types/gestion.types.ts",
    "export interface GestionChildrenProps",
  ],
  [
    "src/pages/gestion/types/gestion.types.ts",
    "export interface GestionClientRowProps",
  ],
  [
    "src/pages/gestion/types/gestion.types.ts",
    "export interface GestionKpiCardProps",
  ],
  [
    "src/pages/gestion/types/index.ts",
    "GestionSectionTitleProps",
  ],
  [
    "src/pages/gestion/components/GestionClientRow.tsx",
    'from "../types"',
  ],
  [
    "src/pages/gestion/components/GestionKpiCard.tsx",
    'from "../types"',
  ],
  [
    "src/pages/gestion/components/GestionSectionTitle.tsx",
    'from "../types"',
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
  "Fundación de tipos de Gestión verificada.",
);
