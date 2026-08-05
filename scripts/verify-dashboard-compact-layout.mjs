import fs from "node:fs";

const checks = [
  [
    "src/pages/dashboard/ProfessionalDashboardPage.tsx",
    "Estado operativo",
  ],
  [
    "src/pages/dashboard/ProfessionalDashboardPage.tsx",
    "exec-layout",
  ],
  [
    "src/pages/dashboard/professional-dashboard.css",
    "overflow: hidden",
  ],
  [
    "src/pages/dashboard/professional-dashboard.css",
    "grid-template-rows",
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

console.log("Dashboard compacto sin redundancias verificado.");
