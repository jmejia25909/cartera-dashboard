import fs from "node:fs";

const file = "src/App.css";
const content = fs.readFileSync(file, "utf8");

const checks = [
  "GESTION COMPACT LAYOUT PACK 021",
  ".gestion-executive-layout",
  ".gestion-kpi-grid",
  ".gestion-filters-panel",
  ".gestion-clients-panel",
];

let failed = false;

for (const token of checks) {
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
  "Layout compacto de Gestión verificado.",
);
