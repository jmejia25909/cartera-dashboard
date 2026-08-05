import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const sourceRoots = ["src", "electron"];

const extensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".css",
  ".html",
  ".json",
]);

const suspiciousPatterns = [
  { name: "LATIN_CAPITAL_A_TILDE", regex: /\u00C3/g },
  { name: "LATIN_CAPITAL_A_CIRCUMFLEX", regex: /\u00C2/g },
  { name: "REPLACEMENT_CHARACTER", regex: /\uFFFD/g },
  { name: "EMOJI_MOJIBAKE_PREFIX", regex: /\u00F0\u0178/g },
  { name: "SMART_PUNCTUATION_MOJIBAKE", regex: /\u00E2\u20AC/g },
  { name: "UTF8_BOM_TEXT", regex: /\u00EF\u00BB\u00BF/g },
];

function walk(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const files = [];

  for (const entry of fs.readdirSync(directory, {
    withFileTypes: true,
  })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    if (extensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

const findings = [];

for (const root of sourceRoots) {
  const absoluteRoot = path.join(projectRoot, root);

  for (const filePath of walk(absoluteRoot)) {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      const detected = [];

      for (const pattern of suspiciousPatterns) {
        pattern.regex.lastIndex = 0;

        if (pattern.regex.test(line)) {
          detected.push(pattern.name);
        }
      }

      if (detected.length > 0) {
        findings.push({
          file: path.relative(projectRoot, filePath),
          line: index + 1,
          patterns: detected,
          content: line.trim(),
        });
      }
    });
  }
}

const reportDirectory = path.join(
  process.env.USERPROFILE,
  "Downloads",
  "CARTERA-UTF8-AUDIT",
);

fs.mkdirSync(reportDirectory, {
  recursive: true,
});

const jsonPath = path.join(
  reportDirectory,
  "utf8-audit.json",
);

const textPath = path.join(
  reportDirectory,
  "utf8-audit.txt",
);

fs.writeFileSync(
  jsonPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      totalFindings: findings.length,
      affectedFiles: [...new Set(
        findings.map((item) => item.file),
      )],
      findings,
    },
    null,
    2,
  ),
  "utf8",
);

const textReport = findings.length === 0
  ? "No se encontraron secuencias sospechosas.\n"
  : findings
      .map(
        (item) =>
          `${item.file}:${item.line}\n` +
          `  Patrones: ${item.patterns.join(", ")}\n` +
          `  Texto: ${item.content}\n`,
      )
      .join("\n");

fs.writeFileSync(textPath, textReport, "utf8");

console.log("");
console.log("AUDITORÍA UTF-8 COMPLETADA");
console.log({
  totalCoincidencias: findings.length,
  archivosAfectados: [
    ...new Set(findings.map((item) => item.file)),
  ],
});
console.log("");
console.log("Reporte TXT:");
console.log(textPath);
console.log("");
console.log("Reporte JSON:");
console.log(jsonPath);
