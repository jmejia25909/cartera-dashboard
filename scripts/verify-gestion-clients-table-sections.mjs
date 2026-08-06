import fs from "node:fs";

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
  [
    "src/App.tsx",
    "<GestionClientsTableHeader>",
    true,
  ],
  [
    "src/App.tsx",
    "<GestionClientsTableBody>",
    true,
  ],
  [
    "src/App.tsx",
    "<thead>",
    false,
  ],
  [
    "src/App.tsx",
    "<tbody>",
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

  if (!ok) {
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log(
  "Extracción de secciones de tabla verificada.",
);
