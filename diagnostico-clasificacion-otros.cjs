const XLSX = require("xlsx");

const file = process.argv[2];
if (!file) {
  console.error("Falta indicar el archivo Excel.");
  process.exit(1);
}

function norm(v) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w]+/g, " ")
    .trim();
}

function classify(forma, detalle) {
  const source = `${forma} ${detalle}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (source.includes("RETENC")) return "RETENCION";
  if (source.includes("ANTICIP")) return "ANTICIPO";
  if (source.includes("CRUCE") || source.includes("COMPENS")) return "CRUCE";

  if (
    source.includes("EFECT") ||
    source.includes("TRANSFER") ||
    source.includes("CHEQUE") ||
    source.includes("DEPOS") ||
    source.includes("TARJ") ||
    source.includes("BANCO") ||
    source.includes("COBRO") ||
    source.includes("PAGO")
  ) return "COBRO";

  return "OTRO";
}

const wb = XLSX.readFile(file, { cellDates: true });

for (const sheetName of wb.SheetNames) {
  const matrix = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1,
    defval: ""
  });

  const headerIndex = matrix.findIndex(row => {
    const h = row.map(norm);
    return h.includes("fecha") &&
           h.includes("tipo") &&
           h.some(x => x.includes("forma cobro pago")) &&
           h.some(x => x.includes("codigo comprobante")) &&
           h.includes("valor");
  });

  if (headerIndex < 0) continue;

  const headers = matrix[headerIndex].map(norm);
  const idx = name => headers.indexOf(name);

  const iTipo = idx("tipo");
  const iForma = headers.findIndex(x => x.includes("forma cobro pago"));
  const iDetalle = idx("detalle");
  const iValor = idx("valor");

  const grupos = new Map();

  for (let i = headerIndex + 1; i < matrix.length; i++) {
    const row = matrix[i];

    const tipo = String(row[iTipo] ?? "").trim().toUpperCase();
    if (tipo !== "COBRO") continue;

    const forma = String(row[iForma] ?? "").trim();
    const detalle = iDetalle >= 0 ? String(row[iDetalle] ?? "").trim() : "";
    const valor = Number(row[iValor] ?? 0) || 0;

    if (valor <= 0 || classify(forma, detalle) !== "OTRO") continue;

    const key = `${forma || "(VACIO)"} || ${detalle || "(VACIO)"}`;

    const g = grupos.get(key) || { cantidad: 0, valor: 0 };
    g.cantidad++;
    g.valor += valor;
    grupos.set(key, g);
  }

  console.log(`\n=== OTROS: ${sheetName} ===`);

  console.table(
    [...grupos.entries()]
      .map(([clasificacion, x]) => ({
        clasificacion,
        cantidad: x.cantidad,
        valor: Number(x.valor.toFixed(2))
      }))
      .sort((a,b) => b.cantidad - a.cantidad)
  );
}
