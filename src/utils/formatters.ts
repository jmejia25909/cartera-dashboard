export function fmtMoney(value: number): string {
  if (typeof value !== 'number' || isNaN(value)) {
    return '$0.00';
  }
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function fmtPercent(value: number, decimals: number = 1): string {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0%';
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: decimals }) + '%';
}

export function fmtDate(dateString: string): string {
  try {
    const date = new Date(dateString + 'T00:00:00');
    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  } catch {
    return dateString;
  }
}

export function fmtNumber(value: number, decimals: number = 0): string {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0';
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: decimals });
}