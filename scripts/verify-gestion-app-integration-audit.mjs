import fs from "node:fs";

const jsonPath =
  "docs/gestion-migration/app-state-inventory.json";
const mdPath =
  "docs/gestion-migration/app-state-inventory.md";

let failed = false;

for (const file of [jsonPath, mdPath]) {
  const ok = fs.existsSync(file);

  console.log(
    `${ok ? "OK" : "ERROR"} - ${file}`,
  );

  if (!ok) {
    failed = true;
  }
}

if (!failed) {
  const inventory = JSON.parse(
    fs.readFileSync(jsonPath, "utf8"),
  );

  const checks = [
    ["totals.lines", inventory.totals?.lines > 0],
    [
      "gestionStructure",
      Array.isArray(inventory.gestionStructure),
    ],
    [
      "states",
      Array.isArray(inventory.states),
    ],
  ];

  for (const [label, ok] of checks) {
    console.log(
      `${ok ? "OK" : "ERROR"} - ${label}`,
    );

    if (!ok) {
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log(
  "Inventario de integración de Gestión verificado.",
);
