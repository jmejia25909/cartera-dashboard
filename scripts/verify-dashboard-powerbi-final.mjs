import fs from "node:fs";

const checks = [
  [
    "electron/dashboardExecutive.ts",
    "DashboardExecutiveFilters",
  ],
  [
    "electron/dashboardExecutive.ts",
    "monthlySeries",
  ],
  [
    "electron/main.ts",
    "filters || {}",
  ],
  [
    "electron/preload.ts",
    "dashboardExecutiveStats: (filters",
  ],
  [
    "src/app/api/httpApiClient.ts",
    "dashboard-executive",
  ],
  [
    "src/types/dashboardExecutive.ts",
    "DashboardPeriod",
  ],
  [
    "src/pages/dashboard/ProfessionalDashboardPage.tsx",
    "Filtrar por mes:",
  ],
  [
    "src/pages/dashboard/ProfessionalDashboardPage.tsx",
    "bi-aging-tooltip",
  ],
  [
    "src/pages/dashboard/professional-dashboard.css",
    ".bi-month-filter",
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

  if (!ok) {
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log(
  "Dashboard Power BI final y filtros verificados.",
);

