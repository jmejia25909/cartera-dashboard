export function fmtMoney(value: number): string {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0,00 US$';
  }
  const numeric = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${numeric} US$`;
}

export function fmtPercent(value: number, decimals: number = 1): string {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0%';
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: decimals }) + '%';
}

export function fmtCompactNumber(value: number, maxDecimals: number = 1): string {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0';
  }
  const abs = Math.abs(value);
  let num = value;
  let suffix = '';
  if (abs >= 1_000_000) {
    num = value / 1_000_000;
    suffix = ' M';
  } else if (abs >= 1_000) {
    num = value / 1_000;
    suffix = ' k';
  }
  const decimals = Math.abs(num) >= 100 ? 0 : maxDecimals;
  const formatted = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
  return formatted + suffix;
}

export function fmtMoneyCompact(value: number): string {
  if (typeof value !== 'number' || isNaN(value)) {
    return '$0.00';
  }
  const abs = Math.abs(value);
  if (abs < 1000) {
    return fmtMoney(value);
  }
  return `${fmtCompactNumber(value)} US$`;
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