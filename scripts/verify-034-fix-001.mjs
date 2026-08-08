import fs from "node:fs";

let failed = false;

function check(
  file,
  token,
  label = token,
) {
  const content = fs.existsSync(file)
    ? fs.readFileSync(file, "utf8")
    : "";

  const ok = content.includes(token);

  console.log(
    `${ok ? "OK" : "ERROR"} - ${file}: ${label}`,
  );

  if (!ok) failed = true;
}

check(
  "src/pages/AbonosPage.tsx",
  "const PAGE_SIZE = 50;",
);
check(
  "src/pages/AbonosPage.tsx",
  "const [auditPage, setAuditPage]",
);
check(
  "src/pages/AbonosPage.tsx",
  "const paginatedAudited =",
);
check(
  "src/pages/AbonosPage.tsx",
  "paginatedAudited.map",
);
check(
  "src/pages/AbonosPage.tsx",
  "Mostrando",
);
check(
  "src/pages/AbonosPage.tsx",
  'className="collections-pagination"',
);
check(
  "src/pages/abonos.css",
  "COLLECTION HISTORY PAGINATION PACK 034 FIX-001",
);

const main = fs.readFileSync(
  "electron/main.ts",
  "utf8",
);

const start = main.indexOf(
  'ipcMain.handle("abonosListar", async () => {',
);

const end = main.indexOf(
  'ipcMain.handle("clientesListar", async () => {',
  start,
);

if (start < 0 || end < 0) {
  console.log(
    "ERROR - no fue posible aislar abonosListar",
  );
  failed = true;
} else {
  const handler = main.slice(start, end);

  const hasLimit = handler.includes("LIMIT 50");
  const hasOrder =
    handler.includes("ORDER BY a.fecha DESC");

  console.log(
    `${!hasLimit ? "OK" : "ERROR"} - abonosListar sin LIMIT 50`,
  );

  console.log(
    `${hasOrder ? "OK" : "ERROR"} - abonosListar conserva ORDER BY fecha DESC`,
  );

  if (hasLimit || !hasOrder) failed = true;
}

if (failed) process.exit(1);

console.log(
  "PACK 034 FIX-001 verificado correctamente.",
);
