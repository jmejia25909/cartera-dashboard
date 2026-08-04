import fs from "node:fs";

const checks = [
  ["electron/collectionReconciliation.ts", "reconcileCollections"],
  ["electron/main.ts", "reconcileCollections(db)"],
  ["electron/db.ts", "DUPLICADO_POR_DESAPARICION"],
  ["src/pages/AbonosPage.tsx", "reversado"],
  ["docs/COLLECTION-RECONCILIATION-PACK-001.md", "PAGO_TOTAL_POR_DESAPARICION"],
];

let failed = false;
for (const [file, token] of checks) {
  const ok = fs.existsSync(file) && fs.readFileSync(file, "utf8").includes(token);
  console.log(`${ok ? "OK" : "ERROR"} - ${file}: ${token}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log("Collection Reconciliation Pack verificado.");
