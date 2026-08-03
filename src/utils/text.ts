export const compactLabel = (label: string, maxChars = 22): string => {
  const clean = label
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return clean.length > maxChars
    ? `${clean.slice(0, maxChars)}...`
    : clean;
};
