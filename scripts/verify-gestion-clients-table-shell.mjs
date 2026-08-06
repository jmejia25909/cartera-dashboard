import fs from "node:fs";

const checks = [
  [
    "src/pages/gestion/components/GestionClientsTableShell.tsx",
    "export function GestionClientsTableShell",
    true,
  ],
  [
    "src/pages/gestion/components/index.ts",
    "GestionClientsTableShell",
    true,
  ],
  [
    "src/App.tsx",
    "<GestionClientsTableShell>",
    true,
  ],
  [
    "src/App.tsx",
    'className="table-wrapper gestion-table-wrapper"',
    false,
  ],
  [
    "src/App.tsx",
    'className="data-table gestion-data-table"',
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

  if (!ok) failed = true;
}

if (failed) process.exit(1);

console.log(
  "Extracción del contenedor de tabla verificada.",
);
