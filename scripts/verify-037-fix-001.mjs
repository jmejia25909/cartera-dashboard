import fs from "node:fs";
const s=fs.readFileSync("electron/importContifico.ts","utf8");
const checks=[
 [s.includes('import fs from "node:fs";'),"import fs"],
 [s.includes("const excelBuffer = fs.readFileSync(filePath);"),"fs.readFileSync"],
 [s.includes("XLSX.read(excelBuffer"),"XLSX.read(buffer)"],
 [!s.includes("XLSX.readFile(filePath"),"XLSX.readFile eliminado"],
];
let fail=false;
for(const [ok,label] of checks){console.log(`${ok?"OK":"ERROR"} - ${label}`);if(!ok) fail=true;}
if(fail) process.exit(1);
console.log("PACK 037 FIX-001 verificado.");
