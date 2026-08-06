import fs from "node:fs";

const app = fs.readFileSync("src/App.tsx", "utf8");

const rowsStart = app.indexOf(
  "<GestionClientsRows>",
);

const rowsEnd = app.indexOf(
  "</GestionClientsRows>",
  rowsStart,
);

if (
  rowsStart < 0 ||
  rowsEnd < 0 ||
  rowsEnd <= rowsStart
) {
  console.error(
    "ERROR - No se encontró GestionClientsRows.",
  );

  process.exit(1);
}

const rowsBlock = app.slice(
  rowsStart,
  rowsEnd,
);

const checks = [
  [
    "src/pages/gestion/components/GestionClientRow.tsx",
    "export function GestionClientRow",
  ],
  [
    "src/pages/gestion/components/index.ts",
    "GestionClientRow",
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

  if (!ok) failed = true;
}

const rowApplied =
  rowsBlock.includes("<GestionClientRow");

console.log(
  `${rowApplied ? "OK" : "ERROR"} - src/App.tsx: <GestionClientRow`,
);

if (!rowApplied) {
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log(
  "Extracción de fila dinámica verificada.",
);
