import fs from "node:fs";

const checks = [
  ["src/components/dashboard/widgets/DashboardPanel.tsx", "export function DashboardPanel"],
  ["src/components/dashboard/widgets/AgingWidget.tsx", "export function AgingWidget"],
  ["src/components/dashboard/widgets/EvolutionWidget.tsx", "export function EvolutionWidget"],
  ["src/components/dashboard/widgets/SellersWidget.tsx", "export function SellersWidget"],
  ["src/components/dashboard/widgets/OperationsWidget.tsx", "export function OperationsWidget"],
  ["src/components/dashboard/widgets/TopClientsWidget.tsx", "export function TopClientsWidget"],
  ["src/components/dashboard/widgets/CriticalWidget.tsx", "export function CriticalWidget"],
  ["src/components/dashboard/widgets/AlertsWidget.tsx", "export function AlertsWidget"],
  ["src/components/dashboard/widgets/DashboardFooter.tsx", "export function DashboardFooter"],
  ["src/components/dashboard/DashboardCharts.tsx", "./widgets/AgingWidget"],
  ["src/components/dashboard/DashboardTables.tsx", "./widgets/OperationsWidget"],
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

console.log(
  "Extracción de widgets del dashboard verificada.",
);
