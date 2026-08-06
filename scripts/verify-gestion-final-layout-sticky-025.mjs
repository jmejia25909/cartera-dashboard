import fs from "node:fs";

const checks = [
  [
    "src/App.css",
    "GESTION FINAL LAYOUT STICKY FIX PACK 025",
  ],
  [
    "src/App.css",
    ".gestion-table-scroll",
  ],
  [
    "src/App.css",
    "z-index: 100 !important",
  ],
  [
    "src/App.css",
    ".gestion-clients-panel-title",
  ],
  [
    "src/App.css",
    ".gestion-report-row",
  ],
  [
    "src/App.css",
    ".gestion-bulk-actions",
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

const componentFiles =
  fs.readdirSync(
    "src/pages/gestion/components",
  );

const shellFile = componentFiles.find(
  (name) =>
    name.includes("TableShell") &&
    name.endsWith(".tsx"),
);

if (!shellFile) {
  console.log(
    "ERROR - no se encontró TableShell.",
  );
  failed = true;
} else {
  const shellContent = fs.readFileSync(
    `src/pages/gestion/components/${shellFile}`,
    "utf8",
  );

  const ok = shellContent.includes(
    "gestion-table-scroll",
  );

  console.log(
    `${ok ? "OK" : "ERROR"} - ${shellFile}: gestion-table-scroll`,
  );

  if (!ok) {
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log(
  "Corrección final del módulo Gestión verificada.",
);
