import fs from "node:fs";

const checks = [
  ["src/components/dashboard/DashboardHeader.tsx", "export function DashboardHeader"],
  ["src/components/dashboard/DashboardKPIs.tsx", "export function DashboardKpis"],
  ["src/components/dashboard/DashboardCharts.tsx", "export function AgingPanel"],
  ["src/components/dashboard/DashboardCharts.tsx", "export function EvolutionPanel"],
  ["src/components/dashboard/DashboardCharts.tsx", "export function SellersPanel"],
  ["src/components/dashboard/DashboardTables.tsx", "export function OperationsPanel"],
  ["src/components/dashboard/DashboardTables.tsx", "export function TopClientsPanel"],
  ["src/components/dashboard/DashboardTables.tsx", "export function CriticalPanel"],
  ["src/components/dashboard/DashboardTables.tsx", "export function AlertsPanel"],
  ["src/pages/dashboard/ProfessionalDashboardPage.tsx", "<DashboardHeader"],
  ["src/pages/dashboard/ProfessionalDashboardPage.tsx", "<DashboardKpis"],
  ["src/pages/dashboard/ProfessionalDashboardPage.tsx", "<AgingPanel"],
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
  "Arquitectura modular del dashboard verificada.",
);
