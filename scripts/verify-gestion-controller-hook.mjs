import fs from "node:fs";

const checks = [
  [
    "src/pages/gestion/hooks/useGestion.ts",
    "export function useGestion",
  ],
  [
    "src/pages/gestion/hooks/useGestion.ts",
    "processGestionItems",
  ],
  [
    "src/pages/gestion/hooks/useGestion.ts",
    "useGestionViewState",
  ],
  [
    "src/pages/gestion/hooks/index.ts",
    "useGestion",
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
  "Hook controlador de Gestión verificado.",
);
