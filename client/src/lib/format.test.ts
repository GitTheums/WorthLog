import { describe, expect, it } from 'vitest';
import {
  changeTone,
  formatMoney,
  formatPercent,
  formatSharePercent,
  formatSignedMoney,
  formatSnapshotDate,
} from './format';

describe('format utilities', () => {
  it('formats EUR amounts from integer cents', () => {
    expect(formatMoney(12345, 'EUR')).toMatch(/123[.,]45/);
    expect(formatSignedMoney(500, 'EUR')).toMatch(/^\+/);
    expect(formatSignedMoney(-500, 'EUR')).toMatch(/^-/);
  });

  it('formats percentages and change tone', () => {
    expect(formatPercent(12.5)).toMatch(/^\+12([.,]5)?%/);
    expect(formatPercent(-3)).toBe('-3%');
    expect(formatSharePercent(25)).toBe('25%');
    expect(changeTone(10)).toBe('positive');
    expect(changeTone(-10)).toBe('negative');
    expect(changeTone(0)).toBe('neutral');
  });

  it('formats snapshot dates', () => {
    expect(formatSnapshotDate('2026-03-15')).toContain('2026');
    expect(formatSnapshotDate('2026-03-15')).toContain('15');
  });
});
