import fs from "node:fs";

const checks = [
  ["src/App.tsx", 'className="gestion-powerbi-page"'],
  ["src/App.tsx", 'className="gestion-executive-layout"'],
  ["src/App.tsx", 'className="card gestion-kpi-panel"'],
  ["src/App.tsx", 'className="card gestion-toolbar-panel"'],
  ["src/App.tsx", 'className="card gestion-clients-panel"'],
  ["src/App.tsx", 'className="data-table gestion-data-table"'],
  ["src/App.css", "GESTION POWER BI REDESIGN PACK 001"],
  ["src/App.css", ".gestion-kpi-grid"],
  ["src/App.css", ".gestion-data-table"],
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

if (failed) process.exit(1);

console.log("Rediseño Power BI de Gestión verificado.");
