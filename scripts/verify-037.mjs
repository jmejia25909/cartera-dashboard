import fs from "node:fs";

const checks = [
  [
    "electron/db.ts",
    "CREATE TABLE IF NOT EXISTS importacion_snapshots",
  ],
  [
    "electron/main.ts",
    'import { createHash } from "node:crypto";',
  ],
  [
    "electron/main.ts",
    "function createPortfolioSnapshot(",
  ],
  [
    "electron/main.ts",
    "function restorePortfolioSnapshot(",
  ],
  [
    "electron/main.ts",
    "function startPortfolioImport(",
  ],
  [
    "electron/main.ts",
    "function finishPortfolioImport(",
  ],
  [
    "electron/main.ts",
    "LATER_IMPORTS_EXIST",
  ],
  [
    "electron/main.ts",
    "duplicateImport: true",
  ],
  [
    "src/pages/config/ImportCenterPanel.tsx",
    "Revertir",
  ],
  [
    "src/pages/config/ImportCenterPanel.tsx",
    "solo puede revertirse la última importación",
  ],
];

let failed = false;

for (const [file, token] of checks) {
  const content = fs.readFileSync(
    file,
    "utf8",
  );
  const ok = content.includes(token);

  console.log(
    `${ok ? "OK" : "ERROR"} - ${file}: ${token}`,
  );

  if (!ok) failed = true;
}

if (failed) process.exit(1);

console.log("PACK 037 verificado.");
