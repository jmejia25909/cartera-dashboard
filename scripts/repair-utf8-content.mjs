import fs from "node:fs";
import path from "node:path";

const projectRoot = process.argv[2] || process.cwd();

const targets = [
  "src/App.tsx",
  "src/pdf/reports/analisisReport.ts",
  "electron/db.ts",
];

const cp1252EncodeMap = new Map([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);

const suspiciousRegex =
  /(?:Ã|Â|ðŸ|â€|â€™|â€œ|â€|â€“|â€”|ï¿½|�|Å|ƒ|Â|Ã¢|Ã°)/g;

function scoreSuspicious(value) {
  const matches = value.match(suspiciousRegex);
  return matches ? matches.length : 0;
}

function encodeWindows1252(value) {
  const bytes = [];

  for (const char of value) {
    const codePoint = char.codePointAt(0);

    if (codePoint <= 0xff) {
      bytes.push(codePoint);
      continue;
    }

    const mapped = cp1252EncodeMap.get(codePoint);

    if (mapped === undefined) {
      return null;
    }

    bytes.push(mapped);
  }

  return Buffer.from(bytes);
}

function decodeOnePass(value) {
  const encoded = encodeWindows1252(value);

  if (!encoded) {
    return value;
  }

  return encoded.toString("utf8");
}

function repairMojibake(value) {
  let current = value;
  let currentScore = scoreSuspicious(current);

  for (let round = 0; round < 4; round += 1) {
    if (currentScore === 0) {
      break;
    }

    const decoded = decodeOnePass(current);

    if (decoded.includes("\uFFFD")) {
      break;
    }

    const decodedScore = scoreSuspicious(decoded);

    if (decodedScore >= currentScore) {
      break;
    }

    current = decoded;
    currentScore = decodedScore;
  }

  return current;
}

const report = [];

for (const relativePath of targets) {
  const filePath = path.join(projectRoot, relativePath);

  if (!fs.existsSync(filePath)) {
    throw new Error(`No existe el archivo: ${relativePath}`);
  }

  const original = fs.readFileSync(filePath, "utf8");
  const hadCrLf = original.includes("\r\n");
  const sourceLines = original.split(/\r?\n/);

  let changedLines = 0;

  const repairedLines = sourceLines.map((line, index) => {
    if (scoreSuspicious(line) === 0) {
      return line;
    }

    const repaired = repairMojibake(line);

    if (repaired !== line) {
      changedLines += 1;
      report.push({
        file: relativePath,
        line: index + 1,
        before: line.trim(),
        after: repaired.trim(),
      });
    }

    return repaired;
  });

  const eol = hadCrLf ? "\r\n" : "\n";
  fs.writeFileSync(
    filePath,
    repairedLines.join(eol),
    "utf8",
  );

  console.log(
    `OK: ${relativePath} - ${changedLines} líneas corregidas`,
  );
}

const reportDir = path.join(
  projectRoot,
  "docs",
  "utf8-repair",
);

fs.mkdirSync(reportDir, {
  recursive: true,
});

const reportPath = path.join(
  reportDir,
  "CARTERA-UTF8-REPAIR-PACK-001.json",
);

fs.writeFileSync(
  reportPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      totalChanges: report.length,
      changes: report,
    },
    null,
    2,
  ),
  "utf8",
);

console.log("");
console.log({
  totalLineasCorregidas: report.length,
  reporte: path.relative(projectRoot, reportPath),
});
