export function normalizeDocumentNumber(value: unknown): string {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) return "";

  const alnum = raw.replace(/[^A-Z0-9]/g, "");
  if (!alnum) return "";

  return /^\d+$/.test(alnum)
    ? alnum.replace(/^0+/, "") || "0"
    : alnum;
}
