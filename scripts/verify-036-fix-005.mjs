import fs from "node:fs";

let failed = false;

function check(file, predicate, label) {
  const content = fs.readFileSync(file, "utf8");
  const ok = predicate(content);

  console.log(`${ok ? "OK" : "ERROR"} - ${label}`);

  if (!ok) failed = true;
}

check(
  "src/pages/config/ImportCenterPanel.tsx",
  (c) =>
    (c.match(/onClick: \(\): void => undefined,/g) || [])
      .length >= 2,
  "callbacks planned tipados",
);

check(
  "src/pages/config/ImportCenterPanel.tsx",
  (c) => c.includes('row.estado.replace(/_/g, " ")'),
  "estado compatible con target JS",
);

check(
  "src/pages/config/ImportCenterPanel.tsx",
  (c) => !c.includes('replaceAll("_", " ")'),
  "replaceAll eliminado",
);

check(
  "src/pages/ConfigPage.tsx",
  (c) =>
    !c.includes(
      `  dbPath,
  onCopyDbPath,
}: ConfigPageProps) {`,
    ),
  "props no usadas fuera del destructuring",
);

check(
  "src/pages/ConfigPage.tsx",
  (c) => c.includes("<ImportCenterPanel"),
  "Centro de Importaciones conservado",
);

check(
  "src/App.tsx",
  (c) =>
    c.includes(
      'onOpenCancelledImport={() => setTab("anulados")}',
    ),
  "navegación a anulados conservada",
);

if (failed) process.exit(1);

console.log("PACK 036 FIX-005 verificado.");
