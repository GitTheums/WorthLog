import { describe, expect, it } from 'vitest';
import {
  changeTone,
  formatChartTick,
  formatMoney,
  formatPercent,
  formatSharePercent,
  formatSignedMoney,
  formatSnapshotDate,
} from './format';

describe('format utilities', () => {
  it('formats EUR amounts from integer cents without premature float math', () => {
    expect(formatMoney(12345, 'EUR')).toBe('€123.45');
    expect(formatMoney(1, 'EUR')).toBe('€0.01');
    expect(formatMoney(100, 'EUR')).toBe('€1.00');
    expect(formatSignedMoney(500, 'EUR')).toBe('+€5.00');
    expect(formatSignedMoney(-500, 'EUR')).toBe('-€5.00');
  });

  it('formats percentages and suppresses non-finite values', () => {
    expect(formatPercent(12.5)).toBe('+12.5%');
    expect(formatPercent(-3)).toBe('-3%');
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(Number.POSITIVE_INFINITY)).toBe('—');
    expect(formatSharePercent(25)).toBe('25%');
    expect(formatSharePercent(12.34)).toBe('12.3%');
    expect(changeTone(10)).toBe('positive');
    expect(changeTone(-10)).toBe('negative');
    expect(changeTone(0)).toBe('neutral');
  });

  it('formats snapshot dates', () => {
    expect(formatSnapshotDate('2026-03-15')).toContain('2026');
    expect(formatSnapshotDate('2026-03-15')).toContain('15');
  });

  it('reduces x-axis tick density for long histories', () => {
    expect(formatChartTick('2026-01-01', 0, 1)).toContain('2026');
    expect(formatChartTick('2026-01-01', 0, 5)).toMatch(/Jan/);
    expect(formatChartTick('2026-01-02', 1, 20)).toBe('');
    expect(formatChartTick('2026-01-01', 0, 20)).toMatch(/Jan/);
    expect(formatChartTick('2026-01-01', 1, 40)).toBe('');
    expect(formatChartTick('2026-01-01', 0, 40)).toMatch(/Jan/);
  });
});
