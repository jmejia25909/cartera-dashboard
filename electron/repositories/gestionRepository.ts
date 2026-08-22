import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { unlinkPromesaFromGestion } from "./promesaRepository";
import type { GestionCreateInput, GestionData, GestionLegacyInput, GestionLegacyMigrationResult, GestionMutationResult, GestionUpdateInput } from "../../src/types/api.types";

const COLUMNS = "id,cliente,fecha,tipo,resultado,observacion,fecha_promesa,monto_promesa,usuario,creado_en,actualizado_en,motivo";
const validId = (id: unknown): id is number => Number.isSafeInteger(id) && Number(id) > 0;
const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;

export function canonicalizeLegacyGestion(record: GestionLegacyInput): string {
  return JSON.stringify({ cliente: String(record.cliente ?? "").trim(), fecha: text(record.fecha), tipo: text(record.tipo), resultado: text(record.resultado), observacion: text(record.observacion), fecha_promesa: text(record.fecha_promesa), monto_promesa: Number(record.monto_promesa) || 0, usuario: text(record.usuario) ?? "sistema", motivo: text(record.motivo) });
}
export function hashLegacyGestion(record: GestionLegacyInput): string {
  return createHash("sha256").update(canonicalizeLegacyGestion(record)).digest("hex");
}
function invalidLegacy(record: GestionLegacyInput): string | null {
  if (!String(record.legacy_id ?? "").trim()) return "legacy_id vacío";
  if (!String(record.cliente ?? "").trim()) return "cliente vacío";
  if (record.fecha && Number.isNaN(Date.parse(record.fecha))) return "fecha inválida";
  if (record.fecha_promesa && Number.isNaN(Date.parse(record.fecha_promesa))) return "fecha_promesa inválida";
  if (record.monto_promesa != null && !Number.isFinite(Number(record.monto_promesa))) return "monto_promesa inválido";
  return null;
}
function legacyMatchesGestion(record: GestionLegacyInput, gestion: GestionData): boolean {
  const same = (left: unknown, right: unknown) => text(left) === text(right);
  return String(record.cliente).trim() === String(gestion.cliente).trim()
    && (!record.fecha || same(record.fecha, gestion.fecha))
    && same(record.tipo, gestion.tipo) && same(record.resultado, gestion.resultado)
    && same(record.observacion, gestion.observacion) && same(record.fecha_promesa, gestion.fecha_promesa)
    && (Number(record.monto_promesa) || 0) === (Number(gestion.monto_promesa) || 0)
    && (text(record.usuario) ?? "sistema") === (text(gestion.usuario) ?? "sistema")
    && same(record.motivo, gestion.motivo);
}
export function getGestionById(db: Database.Database, id: number): GestionData | undefined {
  return db.prepare(`SELECT ${COLUMNS} FROM gestiones WHERE id=?`).get(id) as GestionData | undefined;
}
export function createGestion(db: Database.Database, input: GestionCreateInput): GestionData {
  const result = db.prepare(`INSERT INTO gestiones (cliente,tipo,resultado,observacion,fecha_promesa,monto_promesa,usuario,motivo,fecha,creado_en) VALUES (@cliente,@tipo,@resultado,@observacion,@fecha_promesa,@monto_promesa,@usuario,@motivo,COALESCE(NULLIF(@fecha,''),datetime('now','localtime')),datetime('now','localtime'))`).run({ cliente: String(input.cliente ?? "").trim(), tipo: input.tipo ?? null, resultado: input.resultado ?? null, observacion: input.observacion ?? null, fecha_promesa: input.fecha_promesa || null, monto_promesa: Number(input.monto_promesa) || 0, usuario: input.usuario || "sistema", motivo: input.motivo || null, fecha: input.fecha || null });
  return getGestionById(db, Number(result.lastInsertRowid))!;
}
export function updateGestion(db: Database.Database, id: unknown, input: GestionUpdateInput): GestionMutationResult {
  if (!validId(id)) return { ok:false, code:"GESTION_INVALID_ID", message:"La gestión requiere un ID SQLite válido." };
  const result=db.prepare(`UPDATE gestiones SET tipo=@tipo,resultado=@resultado,observacion=@observacion,fecha_promesa=@fecha_promesa,monto_promesa=@monto_promesa,usuario=@usuario,motivo=@motivo,actualizado_en=datetime('now','localtime') WHERE id=@id`).run({id,tipo:input.tipo??null,resultado:input.resultado??null,observacion:input.observacion??null,fecha_promesa:input.fecha_promesa||null,monto_promesa:Number(input.monto_promesa)||0,usuario:input.usuario||"sistema",motivo:input.motivo||null});
  return result.changes===1 ? {ok:true,gestion:getGestionById(db,id)!} : {ok:false,code:"GESTION_NOT_FOUND",message:"La gestión no existe."};
}
export function deleteGestion(db: Database.Database, id: unknown): GestionMutationResult {
  if (!validId(id)) return {ok:false,code:"GESTION_INVALID_ID",message:"La gestión requiere un ID SQLite válido."};
  const run=db.transaction(()=>{const existing=getGestionById(db,id);if(!existing)return null;db.prepare(`UPDATE gestion_legacy_migrations SET gestion_id=NULL,deleted_at=datetime('now','localtime') WHERE gestion_id=?`).run(id);unlinkPromesaFromGestion(db,id as number);return db.prepare("DELETE FROM gestiones WHERE id=?").run(id).changes===1?existing:null;});
  const deleted=run(); return deleted?{ok:true,gestion:deleted}:{ok:false,code:"GESTION_NOT_FOUND",message:"La gestión no existe."};
}
export function fulfillGestion(db: Database.Database,id:unknown):GestionMutationResult{
  if(!validId(id))return{ok:false,code:"GESTION_INVALID_ID",message:"La gestión requiere un ID SQLite válido."};
  const result=db.prepare(`UPDATE gestiones SET resultado='Promesa Cumplida',actualizado_en=datetime('now','localtime') WHERE id=?`).run(id);
  return result.changes===1?{ok:true,gestion:getGestionById(db,id)!}:{ok:false,code:"GESTION_NOT_FOUND",message:"La gestión no existe."};
}
export function migrateLegacyGestiones(db:Database.Database,source:string,records:readonly GestionLegacyInput[]):GestionLegacyMigrationResult{
  const normalizedSource=String(source??"").trim();
  const items=records.map(record=>({record,legacyId:String(record.legacy_id??"").trim(),hash:hashLegacyGestion(record)}));
  for(const item of items){const reason=invalidLegacy(item.record);if(reason)return{ok:false,code:"LEGACY_INVALID_RECORD",legacy_id:item.legacyId,message:reason};}
  const seen=new Map<string,string>();
  for(const item of items){const key=`${normalizedSource}\u0000${item.legacyId}`;const prior=seen.get(key);if(prior&&prior!==item.hash)return{ok:false,code:"LEGACY_ID_CONFLICT",legacy_id:item.legacyId,message:"El legacy_id representa payloads distintos."};seen.set(key,item.hash);}
  const lookup=db.prepare(`SELECT gestion_id,payload_hash,deleted_at FROM gestion_legacy_migrations WHERE source=? AND legacy_id=?`);
  for(const item of items){
    const prior=lookup.get(normalizedSource,item.legacyId) as {gestion_id:number|null;payload_hash:string|null}|undefined;
    if(prior&&!prior.payload_hash){const gestion=prior.gestion_id?getGestionById(db,prior.gestion_id):undefined;if(gestion&&!legacyMatchesGestion(item.record,gestion))return{ok:false,code:"LEGACY_ID_CONFLICT",legacy_id:item.legacyId,message:"El payload no coincide con el mapping C2 previo."};}
    else if(prior&&prior.payload_hash!==item.hash)return{ok:false,code:"LEGACY_ID_CONFLICT",legacy_id:item.legacyId,message:"El payload cambió para una identidad legacy durable."};
  }
  const insert=db.prepare(`INSERT INTO gestion_legacy_migrations(source,legacy_id,gestion_id,migrated_at,payload_hash,deleted_at) VALUES(?,?,?,datetime('now','localtime'),?,NULL)`);
  const mappings:Extract<GestionLegacyMigrationResult,{ok:true}>["mappings"]=[];
  for(const item of items){
    const migrateOne=db.transaction(()=>{
      const prior=lookup.get(normalizedSource,item.legacyId) as {gestion_id:number|null;payload_hash:string;deleted_at:string|null}|undefined;
      if(prior){if(!prior.payload_hash)db.prepare("UPDATE gestion_legacy_migrations SET payload_hash=? WHERE source=? AND legacy_id=?").run(item.hash,normalizedSource,item.legacyId);return{legacy_id:item.legacyId,gestion_id:prior.gestion_id,inserted:false,deleted:prior.gestion_id===null};}
      const gestion=createGestion(db,item.record);insert.run(normalizedSource,item.legacyId,gestion.id,item.hash);
      return{legacy_id:item.legacyId,gestion_id:gestion.id!,inserted:true,deleted:false};
    });
    mappings.push(migrateOne());
  }
  return{ok:true,mappings};
}
