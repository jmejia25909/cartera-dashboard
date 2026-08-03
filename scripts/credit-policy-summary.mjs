import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
const input=process.argv[2];
if(!input){ console.error('Uso: pnpm data:credit-summary -- "C:\\ruta\\cartera.db"'); process.exit(1); }
const dbPath=path.resolve(input);
if(!fs.existsSync(dbPath)) throw new Error(`No existe la base: ${dbPath}`);
const db=new Database(dbPath,{readonly:true});
const exists=Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='alertas_credito'").get());
if(!exists){ db.close(); throw new Error("La base aun no fue abierta con la version de politica de credito."); }
const result={
 clientesConfigurados: db.prepare("SELECT COUNT(*) total FROM clientes WHERE credito_configurado=1").get().total,
 clientesPendientes: db.prepare("SELECT COUNT(*) total FROM alertas_credito WHERE estado='PENDIENTE'").get().total,
 documentosPorContifico: db.prepare("SELECT COUNT(*) total FROM documentos WHERE credito_fuente='CONTIFICO'").get().total,
 documentosPorPolitica: db.prepare("SELECT COUNT(*) total FROM documentos WHERE credito_fuente='POLITICA_CLIENTE'").get().total,
 documentosPendientes: db.prepare("SELECT COUNT(*) total FROM documentos WHERE credito_pendiente=1").get().total
};
console.log(JSON.stringify(result,null,2));
const pending=db.prepare("SELECT cliente,motivo,detectado_en FROM alertas_credito WHERE estado='PENDIENTE' ORDER BY cliente LIMIT 50").all();
if(pending.length){ console.log('CLIENTES PENDIENTES'); console.table(pending); }
db.close();
