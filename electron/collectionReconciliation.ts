import type Database from "better-sqlite3";

export type CollectionReconciliationResult = {
  duplicateDisappearancesReversed: number;
  nonPositiveMovementsReversed: number;
};

export function reconcileCollections(
  db: Database.Database,
): CollectionReconciliationResult {
  const duplicateResult = db.prepare(`
    UPDATE abonos
    SET estado = 'REVERSADO',
        reversado = 1,
        motivo_reversion = 'DUPLICADO_POR_DESAPARICION',
        reversado_en = datetime('now', 'localtime')
    WHERE COALESCE(reversado, 0) = 0
      AND observacion = 'Abono detectado por documento no presente en importacion'
      AND EXISTS (
        SELECT 1
        FROM abonos total
        WHERE COALESCE(total.reversado, 0) = 0
          AND total.observacion = 'Cobro Total: Documento ya no aparece en cartera (Cancelado)'
          AND total.documento_normalizado = abonos.documento_normalizado
      )
  `).run();

  const nonPositiveResult = db.prepare(`
    UPDATE abonos
    SET estado = 'REVERSADO',
        reversado = 1,
        motivo_reversion = 'MOVIMIENTO_NO_POSITIVO',
        reversado_en = datetime('now', 'localtime')
    WHERE COALESCE(reversado, 0) = 0
      AND (COALESCE(total_anterior, 0) - COALESCE(total_nuevo, 0)) <= 0
  `).run();

  return {
    duplicateDisappearancesReversed: duplicateResult.changes,
    nonPositiveMovementsReversed: nonPositiveResult.changes,
  };
}
