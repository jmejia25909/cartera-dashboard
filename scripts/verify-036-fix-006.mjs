import fs from "node:fs";

const main = fs.readFileSync("electron/main.ts", "utf8");

const tokens = [
  'ipcMain.handle(\n  "importHistoryList"',
  'ipcMain.handle(\n  "importHistoryGet"',
  'ipcMain.handle(\n  "importHistoryRevert"',
];

let failed = false;

for (const token of tokens) {
  const count = main.split(token).length - 1;
  const label = token.match(/"([^"]+)"/)?.[1] ?? token;

  if (count === 1) {
    console.log(`OK - ${label}: exactamente 1 handler`);
  } else {
    console.log(`ERROR - ${label}: ${count} handlers`);
    failed = true;
  }
}

const compactTokens = [
  'ipcMain.handle("importHistoryList"',
  'ipcMain.handle("importHistoryGet"',
  'ipcMain.handle("importHistoryRevert"',
];

for (const token of compactTokens) {
  const count = main.split(token).length - 1;
  const label = token.match(/"([^"]+)"/)?.[1] ?? token;

  if (count === 0) {
    console.log(`OK - ${label}: sin duplicado compacto residual`);
  } else {
    console.log(`ERROR - ${label}: queda duplicado compacto`);
    failed = true;
  }
}

if (failed) process.exit(1);

console.log("FIX-006 verificado.");
