import fs from "node:fs";

const checks = [
  [
    "src/pages/gestion/gestion.css",
    "GESTION POWER BI REDESIGN PACK 001",
    true,
  ],
  [
    "src/pages/gestion/gestion.css",
    "GESTION POWER BI COMPACT PACK 002",
    true,
  ],
  [
    "src/pages/gestion/gestion.css",
    "GESTION OPERATIONAL WORKSPACE PACK 003",
    true,
  ],
  [
    "src/App.tsx",
    'import "./pages/gestion/gestion.css";',
    true,
  ],
  [
    "src/App.css",
    "GESTION POWER BI REDESIGN PACK 001",
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
  "Arquitectura CSS del módulo Gestión verificada.",
);
