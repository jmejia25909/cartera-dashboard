import type { PromesaLegacyInput, PromesaState } from "../types/api.types";

const normalizeState = (value: unknown): PromesaState => {
  const state=String(value??'').trim().toUpperCase().replace(/ /g,'_');
  const aliases:Record<string,PromesaState>={CUMPLIDA:'CUMPLIDA',PARCIALMENTE_CUMPLIDA:'CUMPLIDA_PARCIAL',CUMPLIDA_PARCIAL:'CUMPLIDA_PARCIAL',INCUMPLIDA:'INCUMPLIDA',CANCELADA:'CANCELADA',REPROGRAMADA:'REPROGRAMADA',PENDIENTE:'PENDIENTE',VIGENTE:'PENDIENTE'};
  return aliases[state]??'PENDIENTE';
};

export function prepareLegacyPromises(records:readonly unknown[],uuid:()=>string,persist:(value:unknown[])=>void):PromesaLegacyInput[]{
  const normalized:Record<string,unknown>[]=records.map(value=>{const row:Record<string,unknown>=value&&typeof value==='object'?{...(value as Record<string,unknown>)}:{};const legacyId=String(row.legacy_id??row.id??'').trim()||`uuid_${uuid()}`;return{...row,legacy_id:legacyId};});
  persist(normalized);
  return normalized.map(row=>({
    legacy_id:String(row.legacy_id),
    cliente:String(row.cliente??'').trim(),
    fecha_promesa:String(row.fecha_promesa??''),
    monto_prometido:Number(row.monto_prometido??row.monto_promesa),
    ...(Object.prototype.hasOwnProperty.call(row,'monto_pagado')?{monto_pagado:row.monto_pagado as number}:{}),
    estado:normalizeState(row.estado??row.estado_promesa??row.resultado),
    fecha_pago:typeof row.fecha_pago==='string'?row.fecha_pago:null,
    motivo_incumplimiento:typeof row.motivo_incumplimiento==='string'?row.motivo_incumplimiento:null,
    observacion:typeof row.observacion==='string'?row.observacion:null,
  }));
}
