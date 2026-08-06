import fs from "node:fs";

const file = "src/App.css";
const content = fs.readFileSync(file, "utf8");

const checks = [
  "GESTION TABLE STICKY HEADER PACK 024",
  ".gestion-clients-panel thead th",
  "position: sticky !important",
  "top: 0 !important",
  "z-index: 20 !important",
  "font-size: 1.22rem !important",
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
  "Encabezado fijo de la tabla de Gestión verificado.",
);
