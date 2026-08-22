export function normalizeDatetimeLocalForTarea(value: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const canonical = `${match[1]} ${match[2]}:${match[3] ?? '00'}`;
  const [datePart, timePart] = canonical.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second] = timePart.split(':').map(Number);
  const local = new Date(year, month - 1, day, hour, minute, second);
  if (local.getFullYear() !== year || local.getMonth() !== month - 1 || local.getDate() !== day
    || local.getHours() !== hour || local.getMinutes() !== minute || local.getSeconds() !== second) return null;
  return canonical;
}
