import fs from "node:fs";

const checks = [
  [
    "src/components/layout/AppHeader.tsx",
    "powerbi-app-header",
  ],
  [
    "src/components/layout/AppHeader.tsx",
    "powerbi-global-refresh",
  ],
  [
    "src/App.css",
    "POWER BI EXECUTIVE REDESIGN 002 - APP SHELL",
  ],
  [
    "src/App.css",
    ".powerbi-brand",
  ],
  [
    "src/pages/dashboard/ProfessionalDashboardPage.tsx",
    "className=\"bi-refresh\"",
    false,
  ],
  [
    "src/pages/dashboard/professional-dashboard.css",
    "POWER BI EXECUTIVE REDESIGN 002 - DASHBOARD",
  ],
  [
    "src/pages/dashboard/professional-dashboard.css",
    "height: calc(100vh - 127px)",
  ],
];

let failed = false;

for (const [file, token, expected = true] of checks) {
  const content = fs.existsSync(file)
    ? fs.readFileSync(file, "utf8")
    : "";

  const found = content.includes(token);
  const ok = expected ? found : !found;

  console.log(
    `${ok ? "OK" : "ERROR"} - ${file}: ${token}`,
  );

  if (!ok) failed = true;
}

if (failed) process.exit(1);

console.log(
  "Power BI Executive Redesign 002 verificado.",
);
