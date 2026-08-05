import fs from "node:fs";

const checks = [
  ["src/pages/dashboard/ProfessionalDashboardPage.tsx", "const chartSeries = historico.series"],
  ["src/pages/dashboard/ProfessionalDashboardPage.tsx", "12 meses"],
  ["src/pages/dashboard/ProfessionalDashboardPage.tsx", "bi-chart-legend"],
  ["src/pages/dashboard/ProfessionalDashboardPage.tsx", "Calidad del dato:"],
  ["src/pages/dashboard/professional-dashboard.css", "DASHBOARD POWER BI FINAL REFINEMENT 001"],
  ["src/pages/dashboard/professional-dashboard.css", ".bi-chart-legend"],
];

let failed = false;

for (const [file, token] of checks) {
  const content = fs.existsSync(file)
    ? fs.readFileSync(file, "utf8")
    : "";

  const ok = content.includes(token);
  console.log(`${ok ? "OK" : "ERROR"} - ${file}: ${token}`);

  if (!ok) failed = true;
}

if (failed) process.exit(1);

console.log(
  "Refinamiento final del dashboard verificado.",
);
