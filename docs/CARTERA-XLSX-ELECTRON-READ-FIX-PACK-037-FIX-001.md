# PACK 037 FIX-001

Corrige `ne.readFile is not a function` sustituyendo `XLSX.readFile(filePath)`
por `fs.readFileSync(filePath)` + `XLSX.read(buffer, { type: "buffer" })`.

La corrección sirve para `.xls` y `.xlsx` dentro del bundle Electron/Vite.
