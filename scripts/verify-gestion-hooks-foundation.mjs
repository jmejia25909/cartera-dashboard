import fs from "node:fs";

const checks = [
  [
    "src/pages/gestion/hooks/useGestionViewState.ts",
    "export function useGestionViewState",
  ],
  [
    "src/pages/gestion/hooks/useGestionViewState.ts",
    "toggleSelection",
  ],
  [
    "src/pages/gestion/hooks/useGestionViewState.ts",
    "resetView",
  ],
  [
    "src/pages/gestion/hooks/index.ts",
    "useGestionViewState",
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

console.log(
  "Fundación de hooks de Gestión verificada.",
);
