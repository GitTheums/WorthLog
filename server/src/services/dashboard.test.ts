import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createCategory,
  updateCategory,
} from '../db/repositories/categories.js';
import { upsertSnapshot } from '../db/repositories/snapshots.js';
import {
  createTestContext,
  seedSnapshot,
  type TestContext,
} from '../test/helpers.js';
import {
  getDashboard,
  percentChange,
  resolveRangeStart,
} from './dashboard.js';

describe('dashboard calculations', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  describe('percentChange', () => {
    it('computes ((current - previous) / previous) * 100', () => {
      expect(percentChange(12_000, 8_000)).toBe(50);
      expect(percentChange(5_000, 10_000)).toBe(-50);
      expect(percentChange(8_000, 8_000)).toBe(0);
    });

    it('returns null when previous is null or zero (no Infinity)', () => {
      expect(percentChange(100, null)).toBeNull();
      expect(percentChange(100, 0)).toBeNull();
      expect(percentChange(0, 0)).toBeNull();
    });
  });

  describe('resolveRangeStart', () => {
    const now = new Date('2026-07-25T12:00:00.000Z');

    it('returns null for all', () => {
      expect(resolveRangeStart('all', now)).toBeNull();
    });

    it('computes UTC month/year windows', () => {
      expect(resolveRangeStart('1m', now)).toBe('2026-06-25');
      expect(resolveRangeStart('3m', now)).toBe('2026-04-25');
      expect(resolveRangeStart('1y', now)).toBe('2025-07-25');
    });
  });

  it('uses newest-in-range as current total', () => {
    seedSnapshot(ctx.db, '2026-01-01', 1_000);
    seedSnapshot(ctx.db, '2026-06-26', 2_000);
    seedSnapshot(ctx.db, '2026-07-01', 3_000);

    const dashboard = getDashboard(
      ctx.db,
      '1m',
      new Date('2026-07-25T12:00:00.000Z'),
    );

    expect(dashboard.currentTotalCents).toBe(12_000);
    expect(dashboard.latestDate).toBe('2026-07-01');
    expect(dashboard.timeSeries.map((point) => point.date)).toEqual([
      '2026-06-26',
      '2026-07-01',
    ]);
  });

  it('previous change uses immediately previous snapshot by order, even outside range', () => {
    seedSnapshot(ctx.db, '2026-01-01', 1_000);
    seedSnapshot(ctx.db, '2026-03-01', 2_000);
    seedSnapshot(ctx.db, '2026-07-01', 3_000);

    const dashboard = getDashboard(
      ctx.db,
      '1m',
      new Date('2026-07-25T12:00:00.000Z'),
    );

    expect(dashboard.timeSeries).toHaveLength(1);
    expect(dashboard.currentTotalCents).toBe(12_000);
    expect(dashboard.previousTotalCents).toBe(8_000);
    expect(dashboard.changeCents).toBe(4_000);
    expect(dashboard.changePercent).toBe(50);
  });

  it('since first uses the first snapshot in the complete dataset', () => {
    seedSnapshot(ctx.db, '2025-01-01', 1_000);
    seedSnapshot(ctx.db, '2026-06-01', 2_000);
    seedSnapshot(ctx.db, '2026-07-01', 4_000);

    const dashboard = getDashboard(
      ctx.db,
      '3m',
      new Date('2026-07-25T12:00:00.000Z'),
    );

    expect(dashboard.firstTotalCents).toBe(4_000);
    expect(dashboard.changeSinceFirstCents).toBe(12_000);
    expect(dashboard.changeSinceFirstPercent).toBe(300);
  });

  it('returns null percentages when previous or first totals are zero', () => {
    seedSnapshot(ctx.db, '2026-01-01', 0);
    seedSnapshot(ctx.db, '2026-02-01', 0);
    seedSnapshot(ctx.db, '2026-03-01', {
      Crypto: 1000,
      Stocks: 0,
      Pokémon: 0,
      'CS2 Skins': 0,
    });

    const dashboard = getDashboard(ctx.db, 'all');

    expect(dashboard.previousTotalCents).toBe(0);
    expect(dashboard.changeCents).toBe(1_000);
    expect(dashboard.changePercent).toBeNull();
    expect(dashboard.firstTotalCents).toBe(0);
    expect(dashboard.changeSinceFirstCents).toBe(1_000);
    expect(dashboard.changeSinceFirstPercent).toBeNull();
  });

  it('represents missing category values as zero before the category existed', () => {
    seedSnapshot(ctx.db, '2026-01-01', 1_000);
    createCategory(ctx.db, {
      name: 'Bonds',
      color: '#10B981',
      icon: 'Landmark',
    });
    seedSnapshot(ctx.db, '2026-02-01', {
      Crypto: 1000,
      Stocks: 1000,
      Pokémon: 1000,
      'CS2 Skins': 1000,
      Bonds: 500,
    });

    const dashboard = getDashboard(ctx.db, 'all');
    const bonds = dashboard.categoryTimeSeries.find(
      (series) => series.name === 'Bonds',
    );

    expect(bonds?.points).toEqual([
      { date: '2026-01-01', amountCents: 0 },
      { date: '2026-02-01', amountCents: 500 },
    ]);
  });

  it('keeps archived categories in history charts and allocation when they have values', () => {
    seedSnapshot(ctx.db, '2026-01-01', {
      Crypto: 1000,
      Stocks: 1000,
      Pokémon: 1000,
      'CS2 Skins': 1000,
    });
    seedSnapshot(ctx.db, '2026-02-01', {
      Crypto: 2000,
      Stocks: 2000,
      Pokémon: 2000,
      'CS2 Skins': 2000,
    });

    const categories = ctx.db
      .prepare(`SELECT id, name FROM categories WHERE name = ?`)
      .get('Crypto') as { id: string; name: string };
    updateCategory(ctx.db, categories.id, { archived: true });

    const dashboard = getDashboard(ctx.db, 'all');
    const cryptoSeries = dashboard.categoryTimeSeries.find(
      (series) => series.name === 'Crypto',
    );
    const cryptoAllocation = dashboard.latestAllocation.find(
      (item) => item.name === 'Crypto',
    );

    expect(cryptoSeries).toBeDefined();
    expect(cryptoSeries?.points.at(-1)?.amountCents).toBe(2_000);
    expect(cryptoAllocation?.amountCents).toBe(2_000);
    expect(
      dashboard.historyRows[0]?.values.some(
        (value) => value.categoryId === categories.id,
      ),
    ).toBe(true);
  });

  it('sorts time series ascending and history descending by snapshot date', () => {
    seedSnapshot(ctx.db, '2026-03-01', 3_000);
    seedSnapshot(ctx.db, '2026-01-01', 1_000);
    seedSnapshot(ctx.db, '2026-02-01', 2_000);

    const dashboard = getDashboard(ctx.db, 'all');

    expect(dashboard.timeSeries.map((point) => point.date)).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
    ]);
    expect(dashboard.historyRows.map((row) => row.date)).toEqual([
      '2026-03-01',
      '2026-02-01',
      '2026-01-01',
    ]);
  });

  it('marks hasSnapshots when data exists outside an empty selected range', () => {
    seedSnapshot(ctx.db, '2025-01-01', 1_000);

    const dashboard = getDashboard(
      ctx.db,
      '1m',
      new Date('2026-07-25T12:00:00.000Z'),
    );

    expect(dashboard.hasSnapshots).toBe(true);
    expect(dashboard.timeSeries).toEqual([]);
    expect(dashboard.historyRows).toEqual([]);
    expect(dashboard.firstTotalCents).toBe(4_000);
    expect(dashboard.currentTotalCents).toBe(0);
    expect(dashboard.changeCents).toBeNull();
  });

  it('orders dashboard categories by newest complete-portfolio values descending', () => {
    seedSnapshot(ctx.db, '2026-01-01', {
      Crypto: 1_000,
      Stocks: 1_000,
      Pokémon: 1_000,
      'CS2 Skins': 1_000,
    });
    seedSnapshot(ctx.db, '2026-07-01', {
      Crypto: 83_100,
      Stocks: 7_600,
      Pokémon: 7_300,
      'CS2 Skins': 2_000,
    });

    const dashboard = getDashboard(ctx.db, 'all');
    const names = dashboard.latestCategoryValues.map((item) => item.name);

    expect(dashboard.categoryDisplayOrder).toEqual(
      dashboard.latestCategoryValues.map((item) => item.categoryId),
    );
    expect(names).toEqual(['Crypto', 'Stocks', 'Pokémon', 'CS2 Skins']);
    expect(dashboard.latestAllocation.map((item) => item.name)).toEqual(names);
    expect(dashboard.categoryTimeSeries.map((item) => item.name)).toEqual(names);
    expect(
      dashboard.latestAllocation.map((item) => item.percent),
    ).toEqual([
      expect.closeTo(83.1, 1),
      expect.closeTo(7.6, 1),
      expect.closeTo(7.3, 1),
      expect.closeTo(2.0, 1),
    ]);
  });

  it('keeps canonical order when the selected range excludes the newest snapshot', () => {
    seedSnapshot(ctx.db, '2026-01-01', {
      Crypto: 10_000,
      Stocks: 1_000,
      Pokémon: 500,
      'CS2 Skins': 100,
    });
    seedSnapshot(ctx.db, '2026-03-01', {
      Crypto: 1_000,
      Stocks: 50_000,
      Pokémon: 500,
      'CS2 Skins': 100,
    });
    seedSnapshot(ctx.db, '2026-07-01', {
      Crypto: 83_100,
      Stocks: 7_600,
      Pokémon: 7_300,
      'CS2 Skins': 2_000,
    });

    // 1m ending 2027-01-15 excludes every snapshot, including July (newest).
    const emptyRange = getDashboard(
      ctx.db,
      '1m',
      new Date('2027-01-15T12:00:00.000Z'),
    );

    expect(emptyRange.timeSeries).toEqual([]);
    expect(emptyRange.latestCategoryValues).toEqual([]);
    // Order still follows complete-portfolio newest (July Crypto-led).
    const named = emptyRange.categoryDisplayOrder.map((id) => {
      const row = ctx.db
        .prepare(`SELECT name FROM categories WHERE id = ?`)
        .get(id) as { name: string };
      return row.name;
    });
    expect(named).toEqual(['Crypto', 'Stocks', 'Pokémon', 'CS2 Skins']);

    // Switching to All keeps the same canonical IDs/order.
    const allRange = getDashboard(ctx.db, 'all');
    expect(allRange.categoryDisplayOrder).toEqual(
      emptyRange.categoryDisplayOrder,
    );
  });

  it('places zero-value categories after positive ones and uses sortOrder ties', () => {
    seedSnapshot(ctx.db, '2026-07-01', {
      Crypto: 0,
      Stocks: 5_000,
      Pokémon: 5_000,
      'CS2 Skins': 1_000,
    });

    const dashboard = getDashboard(ctx.db, 'all');
    const names = dashboard.latestCategoryValues.map((item) => item.name);

    // Stocks and Pokémon are equal; fixture order is Crypto, Stocks, Pokémon, CS2
    // with sortOrder Crypto=0, Stocks=1, Pokémon=2, CS2=3 after ensureMultiCategoryFixture.
    expect(names).toEqual(['Stocks', 'Pokémon', 'CS2 Skins', 'Crypto']);
  });

  it('preserves category colors by id after value sorting', () => {
    seedSnapshot(ctx.db, '2026-07-01', {
      Crypto: 83_100,
      Stocks: 7_600,
      Pokémon: 7_300,
      'CS2 Skins': 2_000,
    });

    const dashboard = getDashboard(ctx.db, 'all');
    const crypto = dashboard.latestAllocation.find(
      (item) => item.name === 'Crypto',
    );
    expect(crypto?.color).toBe('#7C5CFC');
    expect(dashboard.categoryTimeSeries[0]?.color).toBe('#7C5CFC');
  });

  it('falls back to manual sortOrder when there are no snapshots', () => {
    const dashboard = getDashboard(ctx.db, 'all');
    expect(dashboard.hasSnapshots).toBe(false);
    expect(dashboard.categoryDisplayOrder).toHaveLength(4);
    // Multi-category fixture order: Crypto, Stocks, Pokémon, CS2 Skins
    const named = dashboard.categoryDisplayOrder.map((id) => {
      const row = ctx.db
        .prepare(`SELECT name FROM categories WHERE id = ?`)
        .get(id) as { name: string };
      return row.name;
    });
    expect(named).toEqual(['Crypto', 'Stocks', 'Pokémon', 'CS2 Skins']);
  });

  it('keeps history values under the correct category columns after reordering', () => {
    seedSnapshot(ctx.db, '2026-01-01', {
      Crypto: 1_000,
      Stocks: 50_000,
      Pokémon: 500,
      'CS2 Skins': 100,
    });
    seedSnapshot(ctx.db, '2026-07-01', {
      Crypto: 83_100,
      Stocks: 7_600,
      Pokémon: 7_300,
      'CS2 Skins': 2_000,
    });

    const dashboard = getDashboard(ctx.db, 'all');
    const order = dashboard.categoryDisplayOrder;
    expect(
      dashboard.latestCategoryValues.map((item) => item.name),
    ).toEqual(['Crypto', 'Stocks', 'Pokémon', 'CS2 Skins']);

    const oldest = dashboard.historyRows.find((row) => row.date === '2026-01-01');
    expect(oldest).toBeDefined();
    const amountsInColumnOrder = order.map(
      (categoryId) =>
        oldest?.values.find((value) => value.categoryId === categoryId)
          ?.amountCents ?? null,
    );
    // Historical Stocks was largest on that date, but columns follow July order.
    expect(amountsInColumnOrder).toEqual([1_000, 50_000, 500, 100]);
  });

  it('supports a single snapshot without inventing a previous point', () => {
    seedSnapshot(ctx.db, '2026-07-01', 2_500);

    const dashboard = getDashboard(ctx.db, 'all');

    expect(dashboard.currentTotalCents).toBe(10_000);
    expect(dashboard.previousTotalCents).toBeNull();
    expect(dashboard.changeCents).toBeNull();
    expect(dashboard.changePercent).toBeNull();
    expect(dashboard.firstTotalCents).toBe(10_000);
    expect(dashboard.changeSinceFirstCents).toBe(0);
    expect(dashboard.changeSinceFirstPercent).toBe(0);
    expect(dashboard.timeSeries).toHaveLength(1);
  });
});

describe('dashboard snapshot seeding with partial categories', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it('does not invent amounts for categories omitted from an upsert', () => {
    const categories = ctx.db
      .prepare(`SELECT id, name FROM categories ORDER BY sort_order`)
      .all() as Array<{ id: string; name: string }>;
    const crypto = categories.find((category) => category.name === 'Crypto');
    if (!crypto) {
      throw new Error('Expected Crypto category');
    }

    upsertSnapshot(ctx.db, {
      date: '2026-01-01',
      note: null,
      values: [{ categoryId: crypto.id, amountCents: 500 }],
    });

    // Add remaining categories for a second snapshot using helper.
    seedSnapshot(ctx.db, '2026-02-01', 1_000);

    const dashboard = getDashboard(ctx.db, 'all');
    const cryptoSeries = dashboard.categoryTimeSeries.find(
      (series) => series.name === 'Crypto',
    );

    expect(cryptoSeries?.points[0]).toEqual({
      date: '2026-01-01',
      amountCents: 500,
    });
    expect(
      dashboard.categoryTimeSeries
        .find((series) => series.name === 'Stocks')
        ?.points[0],
    ).toEqual({ date: '2026-01-01', amountCents: 0 });
  });
});
