export type CollectionReconciliationStatus =
  | "REQUIERE_CONCILIACION"
  | "CONCILIADO";

export interface CollectionPeriodReconciliation {
  id: number;
  year: number;
  month: number;
  detectedValue: number;
  officialValue: number;
  difference: number;
  detectedMovements: number;
  status: "CONCILIADO";
  observation: string;
  reconciledBy: string;
  reconciledAt: string;
  updatedAt: string;
}

export interface SaveCollectionPeriodReconciliationInput {
  year: number;
  month: number;
  officialValue: number;
  observation?: string;
  user?: string;
}

export interface CollectionReconciliationResult {
  ok: boolean;
  row?: CollectionPeriodReconciliation | null;
  message?: string;
}
