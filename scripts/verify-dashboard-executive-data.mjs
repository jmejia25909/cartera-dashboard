import fs from "node:fs";

const checks = [
  ["electron/dashboardExecutive.ts", "computeDashboardExecutiveStats"],
  ["electron/main.ts", 'ipcMain.handle("dashboardExecutiveStats"'],
  ["electron/main.ts", '"/api/dashboard-executive"'],
  ["electron/preload.ts", "dashboardExecutiveStats"],
  ["src/app/api/httpApiClient.ts", "dashboardExecutiveStats"],
  ["src/assets/types/global.d.ts", "DashboardExecutiveStats"],
  ["src/types/dashboardExecutive.ts", "DashboardExecutiveStats"],
];

let failed = false;

for (const [file, token] of checks) {
  const exists = fs.existsSync(file);
  const content = exists ? fs.readFileSync(file, "utf8") : "";
  const ok = exists && content.includes(token);

  console.log(`${ok ? "OK" : "ERROR"} - ${file}: ${token}`);

  if (!ok) {
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log("Endpoint ejecutivo del dashboard verificado.");
