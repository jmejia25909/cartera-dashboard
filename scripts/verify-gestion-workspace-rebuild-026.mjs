import fs from "node:fs";

const checks = [
  [
    "src/App.tsx",
    'className="gestion-executive-layout gestion-workspace-header"',
  ],
  [
    "src/App.tsx",
    'className="gestion-toolbar-content"',
  ],
  [
    "src/App.tsx",
    'className="gestion-date-range"',
  ],
  [
    "src/App.tsx",
    'className="gestion-action-row"',
  ],
  [
    "src/App.tsx",
    "gestion-clients-overview",
  ],
  [
    "src/pages/gestion/gestion.css",
    "GESTION WORKSPACE REBUILD PACK 026 - START",
  ],
  [
    "src/pages/gestion/gestion.css",
    "> .table-wrapper\n  > div",
  ],
  [
    "src/pages/gestion/gestion.css",
    "position: sticky !important",
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

const forbidden = [
  'className="gestion-report-row"',
  'className="gestion-bulk-actions"',
  'className="gestion-filter-fields"',
];

for (const token of forbidden) {
  const absent = !app.includes(token);

  console.log(
    `${absent ? "OK" : "ERROR"} - eliminado: ${token}`,
  );

  if (!absent) {
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log(
  "Reconstrucción definitiva del workspace Gestión verificada.",
);
