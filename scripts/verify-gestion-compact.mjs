import fs from "node:fs";

const checks = [
  ["src/App.css", "GESTION POWER BI COMPACT PACK 002"],
  ["src/App.css", ".gestion-kpi-panel"],
  ["src/App.css", "grid-template-columns: 190px minmax(0, 1fr)"],
  ["src/App.css", "height: calc(100vh - 355px)"],
  ["src/App.css", ".gestion-table-wrapper"],
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
  "Diseño operativo compacto de Gestión verificado.",
);
