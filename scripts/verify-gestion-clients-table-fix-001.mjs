import fs from "node:fs";

const checks = [
  [
    "src/pages/gestion/components/GestionClientsTable.tsx",
    "export function GestionClientsTable",
    true,
  ],
  [
    "src/pages/gestion/components/index.ts",
    "GestionClientsTable",
    true,
  ],
  [
    "src/App.tsx",
    "<GestionClientsTable>",
    true,
  ],
  [
    "src/App.tsx",
    "gestion-data-table",
    false,
  ],
  [
    "src/App.tsx",
    "<thead>",
    true,
  ],
  [
    "src/App.tsx",
    "<tbody>",
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

if (failed) {
  process.exit(1);
}

console.log(
  "Extracción corregida de la tabla principal verificada.",
);
