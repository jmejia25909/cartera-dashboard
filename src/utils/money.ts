const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export const formatMoney = (amount: number): string =>
  USD_FORMATTER.format(Number.isFinite(amount) ? amount : 0);

// Alias temporal para mantener compatibilidad durante la migración.
export const fmtMoney = formatMoney;
