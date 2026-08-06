import fs from "node:fs";

const file =
  "src/pages/gestion/components/GestionClientsTable.tsx";

const content = fs.readFileSync(file, "utf8");
const tableTag = content.match(/<table\b[^>]*>/)?.[0];

if (!tableTag) {
  console.error("ERROR: no se encontró <table>.");
  process.exit(1);
}

const classNameCount = [
  ...tableTag.matchAll(/className\s*=/g),
].length;

const hasRequiredClass =
  tableTag.includes("gestion-data-table");

console.log(
  `${classNameCount === 1 ? "OK" : "ERROR"} - className únicos: ${classNameCount}`,
);

console.log(
  `${hasRequiredClass ? "OK" : "ERROR"} - gestion-data-table`,
);

if (
  classNameCount !== 1 ||
  !hasRequiredClass
) {
  process.exit(1);
}

console.log(
  "Corrección de atributo duplicado verificada.",
);
