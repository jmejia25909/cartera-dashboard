import fs from "node:fs";

const checks = [
  ["src/App.css", "GESTION OPERATIONAL WORKSPACE PACK 003"],
  ["src/App.css", "height: calc(100vh - 142px)"],
  ["src/App.css", "grid-template-columns: minmax(480px, 0.85fr) minmax(680px, 1.65fr)"],
  ["src/App.css", "grid-template-rows: 42px minmax(0, 1fr)"],
  ["src/App.css", "scrollbar-gutter: stable"],
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
  "Workspace operativo de Gestión verificado.",
);
