import fs from "node:fs";

const dashboardFile =
  "src/pages/dashboard/ProfessionalDashboardPage.tsx";

const headerFile =
  "src/components/layout/AppHeader.tsx";

const dashboard = fs.readFileSync(
  dashboardFile,
  "utf8",
);

const header = fs.readFileSync(
  headerFile,
  "utf8",
);

const checks = [
  {
    label: "refreshDashboard eliminado",
    ok: !dashboard.includes(
      "const refreshDashboard",
    ),
  },
  {
    label: "botón duplicado eliminado",
    ok: !dashboard.includes(
      'className="bi-refresh"',
    ),
  },
  {
    label: "botón global disponible",
    ok: header.includes(
      "powerbi-global-refresh",
    ),
  },
  {
    label: "botón global ejecuta onRefresh",
    ok: header.includes(
      "onClick={onRefresh}",
    ),
  },
  {
    label: "rediseño 002 presente",
    ok: fs
      .readFileSync("src/App.css", "utf8")
      .includes(
        "POWER BI EXECUTIVE REDESIGN 002",
      ),
  },
];

let failed = false;

for (const check of checks) {
  console.log(
    `${check.ok ? "OK" : "ERROR"} - ${check.label}`,
  );

  if (!check.ok) failed = true;
}

if (failed) process.exit(1);

console.log(
  "Power BI Executive Redesign Fix 003 verificado.",
);
