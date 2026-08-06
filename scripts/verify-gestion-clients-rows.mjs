import fs from "node:fs";

const app = fs.readFileSync("src/App.tsx", "utf8");

const tableStart = app.indexOf("<GestionClientsTable>");
const tableEnd = app.indexOf("</GestionClientsTable>");

if (
  tableStart < 0 ||
  tableEnd < 0 ||
  tableEnd <= tableStart
) {
  console.error(
    "ERROR - No se encontró GestionClientsTable.",
  );
  process.exit(1);
}

const tableBlock = app.slice(
  tableStart,
  tableEnd,
);

const checks = [
  [
    "src/pages/gestion/components/GestionClientsHeaderRow.tsx",
    "export function GestionClientsHeaderRow",
  ],
  [
    "src/pages/gestion/components/GestionClientsRows.tsx",
    "export function GestionClientsRows",
  ],
  [
    "src/pages/gestion/components/index.ts",
    "GestionClientsHeaderRow",
  ],
  [
    "src/pages/gestion/components/index.ts",
    "GestionClientsRows",
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

  if (!ok) failed = true;
}

for (const [label, ok] of [
  [
    "<GestionClientsHeaderRow>",
    tableBlock.includes(
      "<GestionClientsHeaderRow>",
    ),
  ],
  [
    "<GestionClientsRows>",
    tableBlock.includes(
      "<GestionClientsRows>",
    ),
  ],
]) {
  console.log(
    `${ok ? "OK" : "ERROR"} - src/App.tsx: ${label}`,
  );

  if (!ok) failed = true;
}

if (failed) process.exit(1);

console.log(
  "Extracción de filas de Gestión verificada.",
);
