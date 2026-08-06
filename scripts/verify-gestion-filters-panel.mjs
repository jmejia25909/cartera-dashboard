import fs from "node:fs";

const checks = [
  [
    "src/pages/gestion/components/GestionFiltersPanel.tsx",
    "export function GestionFiltersPanel",
  ],
  [
    "src/pages/gestion/components/index.ts",
    "GestionFiltersPanel",
  ],
  [
    "src/App.tsx",
    "<GestionFiltersPanel>",
  ],
  [
    "src/pages/gestion/gestion.css",
    "GESTION FILTERS PANEL PACK 013",
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

const app = fs.readFileSync("src/App.tsx", "utf8");

const toolbarStart = app.indexOf(
  "<GestionToolbarPanel>",
);

const toolbarEnd = app.indexOf(
  "</GestionToolbarPanel>",
  toolbarStart,
);

const toolbarBlock =
  toolbarStart >= 0 && toolbarEnd > toolbarStart
    ? app.slice(toolbarStart, toolbarEnd)
    : "";

const scopedOk =
  toolbarBlock.includes("<GestionFiltersPanel>");

console.log(
  `${scopedOk ? "OK" : "ERROR"} - GestionFiltersPanel dentro de GestionToolbarPanel`,
);

if (!scopedOk) {
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log(
  "Extracción del panel de filtros verificada.",
);
