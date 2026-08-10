import fs from "node:fs";
const importer=fs.readFileSync("electron/importContifico.ts","utf8");
const db=fs.readFileSync("electron/db.ts","utf8");
let fail=false;
const start=importer.indexOf("INSERT INTO documentos (");
const end=importer.indexOf(");",start);
const block=start>=0&&end>=0?importer.slice(start,end):"";
const forbidden=["centro_costo","categoria_persona","por_vencer","dias_30","dias_60","dias_90","dias_120","dias_mas_120"];
for(const c of forbidden){const ok=!block.includes(c);console.log(`${ok?"OK":"ERROR"} - documentos no persiste ${c}`);if(!ok)fail=true;}
for(const token of ["const por_vencer =","const sumaTramos =","descuadresDetectados++","AGING DEL EXCEL: solo validación"]){const ok=importer.includes(token);console.log(`${ok?"OK":"ERROR"} - ${token}`);if(!ok)fail=true;}
for(const token of ['name: "categoria_persona"','name: "vendedor"','name: "centro_costo"']){const ok=db.includes(token);console.log(`${ok?"OK":"ERROR"} - migración ${token}`);if(!ok)fail=true;}
if(fail) process.exit(1);
console.log("PACK 037 schema fix verificado.");
