import { describe, expect, it } from 'vitest';
import { formatCentsInput, parseMoneyInput, sumCents } from './money';

describe('parseMoneyInput', () => {
  it('converts decimal comma values to exact integer cents', () => {
    expect(parseMoneyInput('12,34')).toEqual({ ok: true, cents: 1234 });
    expect(parseMoneyInput('0,5')).toEqual({ ok: true, cents: 50 });
    expect(parseMoneyInput('1.234,56')).toEqual({ ok: true, cents: 123456 });
  });

  it('converts decimal point values to exact integer cents', () => {
    expect(parseMoneyInput('12.34')).toEqual({ ok: true, cents: 1234 });
    expect(parseMoneyInput('0.5')).toEqual({ ok: true, cents: 50 });
    expect(parseMoneyInput('1,234.56')).toEqual({ ok: true, cents: 123456 });
  });

  it('keeps exact cent conversion without floating point drift', () => {
    expect(parseMoneyInput('0.1')).toEqual({ ok: true, cents: 10 });
    expect(parseMoneyInput('0.10')).toEqual({ ok: true, cents: 10 });
    expect(parseMoneyInput('1234567.89')).toEqual({ ok: true, cents: 123456789 });
    expect(formatCentsInput(123456789)).toBe('1234567.89');
    expect(sumCents([10, 20, 30])).toBe(60);
  });

  it('accepts zero values', () => {
    expect(parseMoneyInput('0')).toEqual({ ok: true, cents: 0 });
    expect(parseMoneyInput('0,00')).toEqual({ ok: true, cents: 0 });
    expect(parseMoneyInput('0.00')).toEqual({ ok: true, cents: 0 });
  });

  it('rejects negative values and empty input', () => {
    expect(parseMoneyInput('-1')).toEqual({
      ok: false,
      error: 'Value cannot be negative',
    });
    expect(parseMoneyInput('-12,34')).toEqual({
      ok: false,
      error: 'Value cannot be negative',
    });
    expect(parseMoneyInput('')).toEqual({
      ok: false,
      error: 'Enter a value',
    });
    expect(parseMoneyInput('   ')).toEqual({
      ok: false,
      error: 'Enter a value',
    });
  });
});
