import fs from "node:fs";

const app = fs.readFileSync("src/App.tsx", "utf8");
const css = fs.readFileSync(
  "src/pages/gestion/gestion.css",
  "utf8",
);

const appChecks = [
  'className="gestion-client-workspace"',
  'className="gestion-client-header"',
  'className="gestion-client-actions"',
  "gestion-client-action",
  "gestion-client-history",
];

const cssChecks = [
  "GESTION CLIENT WORKSPACE PACK 028 - START",
  ".gestion-client-workspace",
  ".gestion-client-header",
  ".gestion-client-actions",
  "repeat(4, minmax(150px, 1fr))",
  ".gestion-client-section-title",
];

let failed = false;

for (const token of appChecks) {
  const ok = app.includes(token);
  console.log(`${ok ? "OK" : "ERROR"} - App.tsx: ${token}`);
  if (!ok) failed = true;
}

for (const token of cssChecks) {
  const ok = css.includes(token);
  console.log(`${ok ? "OK" : "ERROR"} - gestion.css: ${token}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);

console.log(
  "Vista individual de Gestión verificada.",
);
