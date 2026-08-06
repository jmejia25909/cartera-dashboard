import fs from "node:fs";

const checks = [
  [
    "src/pages/gestion/components/GestionClientsPanel.tsx",
    "export function GestionClientsPanel",
    true,
  ],
  [
    "src/pages/gestion/components/index.ts",
    "GestionClientsPanel",
    true,
  ],
  [
    "src/App.tsx",
    "<GestionClientsPanel>",
    true,
  ],
  [
    "src/App.tsx",
    'className="card gestion-clients-panel"',
    false,
  ],
  [
    "src/App.tsx",
    "Clientes con vencimientos",
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
  "Extracción corregida del panel de clientes verificada.",
);
