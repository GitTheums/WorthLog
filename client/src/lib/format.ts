import { format, parseISO } from 'date-fns';

export function formatMoney(
  amountCents: number,
  currency = 'EUR',
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(undefined, {
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
    return new Intl.NumberFormat(undefined, {
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
  if (value === null || Number.isNaN(value)) {
    return '—';
  }

  const formatted = new Intl.NumberFormat(undefined, {
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
  return `${new Intl.NumberFormat(undefined, {
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

export function formatChartTick(date: string, index: number, total: number): string {
  if (total <= 8) {
    return format(parseISO(date), 'MMM d');
  }

  if (total <= 20) {
    return index % 2 === 0 ? format(parseISO(date), 'MMM d') : '';
  }

  const step = Math.ceil(total / 6);
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
