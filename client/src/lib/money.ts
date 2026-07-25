export type ParseMoneySuccess = {
  ok: true;
  cents: number;
};

export type ParseMoneyFailure = {
  ok: false;
  error: string;
};

export type ParseMoneyResult = ParseMoneySuccess | ParseMoneyFailure;

function isDigits(value: string): boolean {
  return value.length > 0 && /^\d+$/.test(value);
}

/**
 * Parse a user money string into integer cents without floating-point math.
 * Accepts `.` or `,` as the decimal separator.
 */
export function parseMoneyInput(raw: string): ParseMoneyResult {
  const trimmed = raw.trim().replace(/\s/g, '');

  // Empty input means the user does not own anything in this category.
  if (trimmed.length === 0) {
    return { ok: true, cents: 0 };
  }

  if (trimmed.startsWith('-') || trimmed.includes('-')) {
    return { ok: false, error: 'Value cannot be negative' };
  }

  if (!/^[\d.,]+$/.test(trimmed)) {
    return { ok: false, error: 'Enter a valid amount' };
  }

  const lastComma = trimmed.lastIndexOf(',');
  const lastDot = trimmed.lastIndexOf('.');
  const separatorIndex = Math.max(lastComma, lastDot);

  let wholePart: string;
  let fractionPart = '';

  if (separatorIndex === -1) {
    wholePart = trimmed;
  } else {
    wholePart = trimmed.slice(0, separatorIndex).replace(/[.,]/g, '');
    fractionPart = trimmed.slice(separatorIndex + 1).replace(/[.,]/g, '');

    if (trimmed.slice(0, separatorIndex).includes(',') && trimmed.slice(0, separatorIndex).includes('.')) {
      return { ok: false, error: 'Enter a valid amount' };
    }
  }

  if (wholePart.length === 0) {
    wholePart = '0';
  }

  if (!isDigits(wholePart)) {
    return { ok: false, error: 'Enter a valid amount' };
  }

  if (fractionPart.length > 2) {
    return { ok: false, error: 'Use at most 2 decimal places' };
  }

  if (fractionPart.length > 0 && !isDigits(fractionPart)) {
    return { ok: false, error: 'Enter a valid amount' };
  }

  const wholeCents = Number.parseInt(wholePart, 10) * 100;
  const fractionCents = Number.parseInt(fractionPart.padEnd(2, '0') || '0', 10);

  if (!Number.isSafeInteger(wholeCents) || !Number.isSafeInteger(fractionCents)) {
    return { ok: false, error: 'Amount is too large' };
  }

  return { ok: true, cents: wholeCents + fractionCents };
}

/** Format integer cents for an editable money field without floating-point math. */
export function formatCentsInput(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new Error('cents must be an integer');
  }

  const absolute = Math.abs(cents);
  const whole = Math.trunc(absolute / 100);
  const fraction = absolute % 100;
  const sign = cents < 0 ? '-' : '';
  return `${sign}${String(whole)}.${String(fraction).padStart(2, '0')}`;
}

export function sumCents(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
