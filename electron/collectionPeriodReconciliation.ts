import type Database from "better-sqlite3";
import type {
  CollectionPeriodReconciliation,
  SaveCollectionPeriodReconciliationInput,
} from "../src/types/collectionReconciliation";

type DbRow = {
  id: number;
  anio: number;
  mes: number;
  valor_detectado: number;
  valor_oficial: number;
  diferencia: number;
  movimientos_detectados: number;
  estado: string;
  observacion: string | null;
  conciliado_por: string | null;
  conciliado_en: string;
  actualizado_en: string;
};

type SaveContext = {
  detectedValue: number;
  detectedMovements: number;
};

const roundMoney = (value: unknown): number =>
  Math.round((Number(value) || 0) * 100) / 100;

const assertYearMonth = (year: number, month: number): void => {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("El año de conciliación no es válido.");
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("El mes de conciliación no es válido.");
  }
};

const mapRow = (row: DbRow): CollectionPeriodReconciliation => ({
  id: Number(row.id),
  year: Number(row.anio),
  month: Number(row.mes),
  detectedValue: roundMoney(row.valor_detectado),
  officialValue: roundMoney(row.valor_oficial),
  difference: roundMoney(row.diferencia),
  detectedMovements: Number(row.movimientos_detectados || 0),
  status: "CONCILIADO",
  observation: String(row.observacion || ""),
  reconciledBy: String(row.conciliado_por || "sistema"),
  reconciledAt: String(row.conciliado_en || ""),
  updatedAt: String(row.actualizado_en || ""),
});

export function getCollectionPeriodReconciliation(
  db: Database.Database,
  year: number,
  month: number,
): CollectionPeriodReconciliation | null {
  assertYearMonth(year, month);

  const row = db.prepare(`
    SELECT
      id,
      anio,
      mes,
      valor_detectado,
      valor_oficial,
      diferencia,
      movimientos_detectados,
      estado,
      observacion,
      conciliado_por,
      conciliado_en,
      actualizado_en
    FROM conciliaciones_cobros
    WHERE anio = ?
      AND mes = ?
      AND estado = 'CONCILIADO'
    LIMIT 1
  `).get(year, month) as DbRow | undefined;

  return row ? mapRow(row) : null;
}

export function saveCollectionPeriodReconciliation(
  db: Database.Database,
  input: SaveCollectionPeriodReconciliationInput,
  context: SaveContext,
): CollectionPeriodReconciliation {
  const year = Number(input.year);
  const month = Number(input.month);
  const officialValue = roundMoney(input.officialValue);
  const detectedValue = roundMoney(context.detectedValue);
  const detectedMovements = Number(context.detectedMovements || 0);

  assertYearMonth(year, month);

  if (!Number.isFinite(officialValue) || officialValue < 0) {
    throw new Error("El valor oficial debe ser un número mayor o igual a cero.");
  }

  const observation = String(input.observation || "").trim();
  const user = String(input.user || "sistema").trim() || "sistema";
  const difference = roundMoney(officialValue - detectedValue);

  db.prepare(`
    INSERT INTO conciliaciones_cobros (
      anio,
      mes,
      valor_detectado,
      valor_oficial,
      diferencia,
      movimientos_detectados,
      estado,
      observacion,
      conciliado_por,
      conciliado_en,
      actualizado_en
    )
    VALUES (
      @year,
      @month,
      @detectedValue,
      @officialValue,
      @difference,
      @detectedMovements,
      'CONCILIADO',
      @observation,
      @user,
      datetime('now', 'localtime'),
      datetime('now', 'localtime')
    )
    ON CONFLICT(anio, mes) DO UPDATE SET
      valor_detectado = excluded.valor_detectado,
      valor_oficial = excluded.valor_oficial,
      diferencia = excluded.diferencia,
      movimientos_detectados = excluded.movimientos_detectados,
      estado = 'CONCILIADO',
      observacion = excluded.observacion,
      conciliado_por = excluded.conciliado_por,
      conciliado_en = excluded.conciliado_en,
      actualizado_en = excluded.actualizado_en
  `).run({
    year,
    month,
    detectedValue,
    officialValue,
    difference,
    detectedMovements,
    observation,
    user,
  });

  const saved = getCollectionPeriodReconciliation(db, year, month);

  if (!saved) {
    throw new Error("No fue posible recuperar la conciliación guardada.");
  }

  return saved;
}

export function isCollectionReconciliationCurrent(
  row: CollectionPeriodReconciliation | null,
  detectedValue: number,
  detectedMovements: number,
): boolean {
  if (!row) return false;

  const sameValue =
    Math.abs(roundMoney(row.detectedValue) - roundMoney(detectedValue)) <= 0.01;

  const sameMovements =
    Number(row.detectedMovements) === Number(detectedMovements || 0);

  return sameValue && sameMovements;
}
