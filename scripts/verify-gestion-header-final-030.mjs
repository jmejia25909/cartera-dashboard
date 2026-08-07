import fs from "node:fs";

const cssFile =
  "src/pages/gestion/gestion.css";

if (!fs.existsSync(cssFile)) {
  console.error(`ERROR - no existe ${cssFile}`);
  process.exit(1);
}

const css = fs.readFileSync(cssFile, "utf8");

const checks = [
  "GESTION HEADER FINAL POLISH PACK 030 - START",
  "grid-template-columns:\\n    150px minmax(0, 1fr) !important",
  "grid-template-columns:\\n    155px minmax(0, 1fr) !important",
  "height: 176px !important",
  "minmax(320px, 0.92fr)",
  "repeat(3, minmax(116px, 1fr))",
];

let failed = false;

for (const token of checks) {
  const ok = css.includes(token);
  console.log(`${ok ? "OK" : "ERROR"} - ${token}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);

console.log(
  "Encabezado final de Gestión verificado.",
);
