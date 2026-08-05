import fs from "node:fs";

const checks = [
  ["src/components/layout/AppHeader.tsx", "executive-app-header"],
  ["src/components/layout/AppHeader.tsx", "Base Local"],
  ["src/App.css", "POWER BI EXECUTIVE HEADER POLISH 001"],
  ["src/App.css", ".executive-header-actions"],
  ["src/App.css", ".nav-bar"],
  [
    "src/pages/dashboard/professional-dashboard.css",
    "POWER BI EXECUTIVE DASHBOARD POLISH 001",
  ],
  [
    "src/pages/dashboard/professional-dashboard.css",
    "height: calc(100vh - 138px)",
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

if (failed) process.exit(1);

console.log("Executive Polish verificado.");
