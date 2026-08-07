import fs from "node:fs";

const app = fs.readFileSync("src/App.tsx", "utf8");
const css = fs.readFileSync(
  "src/pages/gestion/gestion.css",
  "utf8",
);

let failed = false;

const appChecks = [
  'className="gestion-client-workspace"',
];

for (const token of appChecks) {
  const ok = app.includes(token);
  console.log(`${ok ? "OK" : "ERROR"} - App.tsx: ${token}`);
  if (!ok) failed = true;
}

const hasLiteralNewline = /gestion-client-workspace[^]{0,100}\\n/.test(app);
console.log(
  `${!hasLiteralNewline ? "OK" : "ERROR"} - sin \\\\n literal en workspace`,
);
if (hasLiteralNewline) failed = true;

const cssChecks = [
  "GESTION CLIENT SCROLL FIX PACK 029 - START",
  "overflow-y: auto !important",
  "max-height: calc(100vh - 310px) !important",
  "padding: 18px 18px 34px !important",
];

for (const token of cssChecks) {
  const ok = css.includes(token);
  console.log(`${ok ? "OK" : "ERROR"} - gestion.css: ${token}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);

console.log(
  "Scroll de la vista individual verificado.",
);
