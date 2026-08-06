import fs from "node:fs";

const checks = [
  [
    "src/pages/gestion/services/gestion-clients.service.ts",
    "export function buildGestionClientSummaries",
  ],
  [
    "src/pages/gestion/services/index.ts",
    "buildGestionClientSummaries",
  ],
  [
    "src/App.tsx",
    "buildGestionClientSummaries({",
  ],
  [
    "src/App.tsx",
    ".map(({ cliente, docsCliente, totalCliente }) =>",
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
  "Migración corregida del cálculo de clientes verificada.",
);
