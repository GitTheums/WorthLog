import { format, parseISO } from 'date-fns';

/** Prefer a stable EUR-friendly locale so money formatting is consistent. */
function moneyLocale(currency: string): string {
  return currency === 'EUR' ? 'en-IE' : 'en-US';
}

export function formatMoney(
  amountCents: number,
  currency = 'EUR',
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(moneyLocale(currency), {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    ...options,
  }).format(amountCents / 100);
}

export function formatCompactMoney(
  amountCents: number,
  currency = 'EUR',
): string {
  const absolute = Math.abs(amountCents);
  if (absolute >= 100_000_00) {
    return new Intl.NumberFormat(moneyLocale(currency), {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amountCents / 100);
  }

  return formatMoney(amountCents, currency);
}

export function formatSignedMoney(
  amountCents: number,
  currency = 'EUR',
): string {
  const formatted = formatMoney(Math.abs(amountCents), currency);
  if (amountCents > 0) {
    return `+${formatted}`;
  }
  if (amountCents < 0) {
    return `-${formatted}`;
  }
  return formatted;
}

export function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value) || !Number.isFinite(value)) {
    return '—';
  }

  const formatted = new Intl.NumberFormat('en-IE', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(Math.abs(value));

  if (value > 0) {
    return `+${formatted}%`;
  }
  if (value < 0) {
    return `-${formatted}%`;
  }
  return `${formatted}%`;
}

export function formatSharePercent(value: number): string {
  if (!Number.isFinite(value)) {
    return '—';
  }

  return `${new Intl.NumberFormat('en-IE', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(value)}%`;
}

export function formatSnapshotDate(date: string): string {
  return format(parseISO(date), 'd MMM yyyy');
}

export function formatChartDate(date: string): string {
  return format(parseISO(date), 'MMM d');
}

/**
 * Reduce x-axis label density for long histories while keeping every point
 * available to tooltips via the underlying series data.
 */
export function formatChartTick(
  date: string,
  index: number,
  total: number,
): string {
  if (total <= 0) {
    return '';
  }

  if (total === 1) {
    return format(parseISO(date), 'd MMM yyyy');
  }

  if (total <= 8) {
    return format(parseISO(date), 'MMM d');
  }

  if (total <= 20) {
    return index % 2 === 0 || index === total - 1
      ? format(parseISO(date), 'MMM d')
      : '';
  }

  const step = Math.max(1, Math.ceil(total / 6));
  return index % step === 0 || index === total - 1
    ? format(parseISO(date), 'MMM yy')
    : '';
}

export type ChangeTone = 'positive' | 'negative' | 'neutral';

export function changeTone(amountCents: number | null): ChangeTone {
  if (amountCents === null || amountCents === 0) {
    return 'neutral';
  }
  return amountCents > 0 ? 'positive' : 'negative';
}

/** Percent change between two totals; null when previous is missing or zero. */
export function percentChange(
  currentCents: number,
  previousCents: number | null,
): number | null {
  if (previousCents === null || previousCents === 0) {
    return null;
  }

  return ((currentCents - previousCents) / previousCents) * 100;
}

/** Compact axis ticks for narrow viewports. */
export function formatChartTickCompact(
  date: string,
  index: number,
  total: number,
): string {
  if (total <= 0) {
    return '';
  }

  if (total === 1) {
    return format(parseISO(date), 'd MMM');
  }

  if (total <= 5) {
    return format(parseISO(date), 'MMM d');
  }

  const step = Math.max(1, Math.ceil(total / 4));
  return index % step === 0 || index === total - 1
    ? format(parseISO(date), 'MMM d')
    : '';
}
