import fs from "node:fs";

const checks = [
  ["src/pages/dashboard/ProfessionalDashboardPage.tsx", "executiveStats"],
  ["src/pages/dashboard/ProfessionalDashboardPage.tsx", "COBROS DEL MES"],
  ["src/pages/dashboard/professional-dashboard.css", ".pro-kpi-grid"],
  ["src/pages/DashboardPage.tsx", "ProfessionalDashboardPage"],
  ["src/App.tsx", "DashboardExecutiveStats"],
  ["src/App.tsx", "dashboardExecutiveStats"],
  ["src/App.tsx", "executiveStats={executiveStats}"],
];

let failed = false;

for (const [file, token] of checks) {
  const content = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const ok = content.includes(token);
  console.log(`${ok ? "OK" : "ERROR"} - ${file}: ${token}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
console.log("Dashboard profesional verificado.");
