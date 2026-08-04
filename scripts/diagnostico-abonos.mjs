import Database from "better-sqlite3";

const dbPath = process.argv[2];
const db = new Database(dbPath, { readonly: true });

const resumen = db.prepare(`
  SELECT
    COUNT(*) AS total_abonos,
    MIN(fecha) AS fecha_minima,
    MAX(fecha) AS fecha_maxima,
    ROUND(SUM(total_anterior - total_nuevo), 2) AS total_detectado
  FROM abonos
`).get();

const meses = db.prepare(`
  SELECT
    SUBSTR(fecha, 1, 7) AS mes,
    COUNT(*) AS movimientos,
    ROUND(SUM(total_anterior - total_nuevo), 2) AS valor_recaudado
  FROM abonos
  GROUP BY SUBSTR(fecha, 1, 7)
  ORDER BY mes DESC
`).all();

console.log("RESUMEN DE ABONOS");
console.log(resumen);

console.log("");
console.log("RECAUDACIÓN POR MES");
console.table(meses);

db.close();
