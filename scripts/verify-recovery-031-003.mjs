import fs from "node:fs";

const checks = [
  ["electron/db.ts", "CREATE TABLE IF NOT EXISTS conciliaciones_cobros"],
  ["electron/db.ts", "UNIQUE(anio, mes)"],
  ["electron/collectionPeriodReconciliation.ts", "saveCollectionPeriodReconciliation"],
  ["electron/collectionPeriodReconciliation.ts", "isCollectionReconciliationCurrent"],
  ["electron/dashboardExecutive.ts", "collectionReconciliationCurrent"],
  ["electron/dashboardExecutive.ts", "estado: collectionStatus"],
  ["electron/dashboardExecutive.ts", "valorOficial: collectionOfficialValue"],
  ["electron/main.ts", '"collectionReconciliationGet"'],
  ["electron/main.ts", '"collectionReconciliationSave"'],
  ["electron/main.ts", "DELETE FROM conciliaciones_cobros"],
  ["src/types/collectionReconciliation.ts", "CollectionPeriodReconciliation"],
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

console.log("RECOVERY-003 verificado.");
