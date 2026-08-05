import fs from "node:fs";

const checks = [
  ["src/hooks/dashboard/useDashboardExecutive.ts", "export function useDashboardExecutive"],
  ["src/components/dashboard/dashboard.constants.ts", "DASHBOARD_MONTHS"],
  ["src/components/dashboard/dashboard.constants.ts", "DASHBOARD_CHART_COLORS"],
  ["src/types/dashboardNavigation.ts", "DashboardNavigationTarget"],
  ["src/pages/dashboard/ProfessionalDashboardPage.tsx", "useDashboardExecutive"],
  ["src/pages/dashboard/ProfessionalDashboardPage.tsx", "useState", false],
  ["src/pages/dashboard/ProfessionalDashboardPage.tsx", "createHttpApiClient", false],
  ["src/components/dashboard/DashboardCharts.tsx", "export const DASHBOARD_CHART_COLORS", false],
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

console.log("Fase 3 del dashboard verificada.");
