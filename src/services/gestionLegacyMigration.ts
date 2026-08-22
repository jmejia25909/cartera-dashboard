export type LegacyGestionRecord = Record<string, unknown> & {
  legacy_id: string;
};

export function ensureLegacyGestionIds(
  records: readonly unknown[],
  generateUuid: () => string,
): LegacyGestionRecord[] {
  return records.map((value) => {
    const record = value && typeof value === "object"
      ? { ...(value as Record<string, unknown>) }
      : {};
    const currentLegacyId = String(record.legacy_id ?? record.id ?? "").trim();

    return {
      ...record,
      legacy_id: currentLegacyId || `uuid_${generateUuid()}`,
    };
  });
}

export function persistLegacyGestionIds(
  records: readonly unknown[],
  generateUuid: () => string,
  persist: (records: LegacyGestionRecord[]) => void,
): LegacyGestionRecord[] {
  const normalized = ensureLegacyGestionIds(records, generateUuid);
  persist(normalized);
  return normalized;
}

export function createSingleFlight<TArgs extends unknown[], TResult>(
  operation: (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult | undefined> {
  let pending = false;
  return async (...args) => {
    if (pending) return undefined;
    pending = true;
    try { return await operation(...args); }
    finally { pending = false; }
  };
}
