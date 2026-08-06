import fs from "node:fs";

const app = fs.readFileSync("src/App.tsx", "utf8");

const start = app.indexOf("<GestionClientsTable>");
const end = app.indexOf("</GestionClientsTable>");

if (start < 0 || end < 0 || end <= start) {
  console.error(
    "ERROR - No se encontró GestionClientsTable completo.",
  );
  process.exit(1);
}

const tableBlock = app.slice(start, end);

const checks = [
  [
    "src/pages/gestion/components/GestionClientsTableHeader.tsx",
    "export function GestionClientsTableHeader",
    true,
  ],
  [
    "src/pages/gestion/components/GestionClientsTableBody.tsx",
    "export function GestionClientsTableBody",
    true,
  ],
  [
    "src/pages/gestion/components/index.ts",
    "GestionClientsTableHeader",
    true,
  ],
  [
    "src/pages/gestion/components/index.ts",
    "GestionClientsTableBody",
    true,
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

  if (!ok) {
    failed = true;
  }
}

const scopedChecks = [
  [
    "<GestionClientsTableHeader>",
    tableBlock.includes("<GestionClientsTableHeader>"),
  ],
  [
    "<GestionClientsTableBody>",
    tableBlock.includes("<GestionClientsTableBody>"),
  ],
  [
    "sin <thead> dentro de GestionClientsTable",
    !tableBlock.includes("<thead>"),
  ],
  [
    "sin <tbody> dentro de GestionClientsTable",
    !tableBlock.includes("<tbody>"),
  ],
];

for (const [label, ok] of scopedChecks) {
  console.log(
    `${ok ? "OK" : "ERROR"} - src/App.tsx: ${label}`,
  );

  if (!ok) {
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log(
  "Extracción corregida de secciones de tabla verificada.",
);
