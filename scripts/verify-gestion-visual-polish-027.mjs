import fs from "node:fs";

const cssFile = "src/pages/gestion/gestion.css";
if (!fs.existsSync(cssFile)) process.exit(1);

const css = fs.readFileSync(cssFile, "utf8");
const checks = [
  "GESTION VISUAL POLISH PACK 027 - START",
  ".gestion-panel-title__icon",
  "width: 40% !important",
  "width: 18% !important",
  "width: 8% !important",
  "width: 10% !important",
  "font-size: 1.23rem !important",
  "scrollbar-gutter: stable !important"
];

let failed = false;
for (const token of checks) {
  const ok = css.includes(token);
  console.log(`${ok ? "OK" : "ERROR"} - ${token}`);
  if (!ok) failed = true;
}

const app = fs.readFileSync("src/App.tsx", "utf8");
const structuralChecks = [
  'className="gestion-executive-layout gestion-workspace-header"',
  'className="gestion-toolbar-content"',
  "gestion-clients-overview"
];

for (const token of structuralChecks) {
  const ok = app.includes(token);
  console.log(`${ok ? "OK" : "ERROR"} - estructura 026: ${token}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
console.log("Pulido visual del módulo Gestión verificado.");
