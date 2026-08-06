import fs from "node:fs";

const file =
  "src/pages/gestion/components/GestionPanels.tsx";

const content = fs.existsSync(file)
  ? fs.readFileSync(file, "utf8")
  : "";

const checks = [
  [
    'import type { GestionChildrenProps } from "../types";',
    true,
  ],
  [
    "ReactNode",
    false,
  ],
  [
    "GestionPanelProps",
    false,
  ],
  [
    "GestionChildrenProps",
    true,
  ],
];

let failed = false;

for (const [token, expected] of checks) {
  const found = content.includes(token);
  const ok = expected ? found : !found;

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

console.log(
  "Corrección de GestionPanels verificada.",
);
