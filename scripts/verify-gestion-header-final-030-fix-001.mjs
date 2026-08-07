import fs from "node:fs";

const cssFile = "src/pages/gestion/gestion.css";

if (!fs.existsSync(cssFile)) {
  console.error(`ERROR - no existe ${cssFile}`);
  process.exit(1);
}

const css = fs.readFileSync(cssFile, "utf8");

const checks = [
  [
    "marker PACK 030",
    /GESTION HEADER FINAL POLISH PACK 030 - START/,
  ],
  [
    "KPI panel 150px",
    /\.gestion-kpi-panel\s*\{[\s\S]*?grid-template-columns:\s*150px\s+minmax\(0,\s*1fr\)\s*!important;/,
  ],
  [
    "Toolbar panel 155px",
    /\.gestion-toolbar-panel\s*\{[\s\S]*?grid-template-columns:\s*155px\s+minmax\(0,\s*1fr\)\s*!important;/,
  ],
  [
    "Altura 176px",
    /height:\s*176px\s*!important;/,
  ],
  [
    "Filtros 320px",
    /minmax\(320px,\s*0\.92fr\)/,
  ],
  [
    "Acciones 3 columnas",
    /repeat\(3,\s*minmax\(116px,\s*1fr\)\)/,
  ],
];

let failed = false;

for (const [name, pattern] of checks) {
  const ok = pattern.test(css);
  console.log(`${ok ? "OK" : "ERROR"} - ${name}`);
  if (!ok) failed = true;
}

if (failed) {
  process.exit(1);
}

console.log(
  "Encabezado final de Gestión verificado correctamente.",
);
