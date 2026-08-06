import fs from "node:fs";

const checks = [
  [
    "src/pages/gestion/components/GestionPanels.tsx",
    "export function GestionKpisPanel",
    true,
  ],
  [
    "src/pages/gestion/components/GestionPanels.tsx",
    "export function GestionToolbarPanel",
    true,
  ],
  [
    "src/App.tsx",
    "<GestionKpisPanel>",
    true,
  ],
  [
    "src/App.tsx",
    "<GestionToolbarPanel>",
    true,
  ],
  [
    "src/App.tsx",
    'className="card gestion-kpi-panel"',
    false,
  ],
  [
    "src/App.tsx",
    'className="card gestion-toolbar-panel"',
    false,
  ],
];

let failed = false;

for (const [file, token, expected] of checks) {
  const content = fs.existsSync(file)
    ? fs.readFileSync(file, "utf8")
    : "";

  const found = content.includes(token);
  const ok = expected ? found : !found;

  console.log(
    `${ok ? "OK" : "ERROR"} - ${file}: ${token}`,
  );

  if (!ok) failed = true;
}

if (failed) process.exit(1);

console.log(
  "Extracción de paneles de Gestión verificada.",
);
