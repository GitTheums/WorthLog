import { describe, expect, it } from 'vitest';
import {
  compareCategoriesByLatestValue,
  getPortfolioCategoryDisplayOrder,
  sortByCategoryDisplayOrder,
} from './category-display-order.js';

describe('category display order', () => {
  it('sorts by latestValueCents descending', () => {
    const order = getPortfolioCategoryDisplayOrder([
      {
        id: 'cs2',
        name: 'CS2',
        sortOrder: 0,
        latestValueCents: 2_000,
      },
      {
        id: 'crypto',
        name: 'Crypto',
        sortOrder: 1,
        latestValueCents: 83_100,
      },
      {
        id: 'stocks',
        name: 'Stocks',
        sortOrder: 2,
        latestValueCents: 7_600,
      },
      {
        id: 'pokemon',
        name: 'Pokémon',
        sortOrder: 3,
        latestValueCents: 7_300,
      },
    ]);

    expect(order).toEqual(['crypto', 'stocks', 'pokemon', 'cs2']);
  });

  it('matches percentage order because percentages derive from the same values', () => {
    const total = 83_100 + 7_600 + 7_300 + 2_000;
    const categories = [
      { id: 'crypto', name: 'Crypto', sortOrder: 3, latestValueCents: 83_100 },
      { id: 'stocks', name: 'Stocks', sortOrder: 2, latestValueCents: 7_600 },
      { id: 'pokemon', name: 'Pokémon', sortOrder: 1, latestValueCents: 7_300 },
      { id: 'cs2', name: 'CS2', sortOrder: 0, latestValueCents: 2_000 },
    ];
    const byValue = getPortfolioCategoryDisplayOrder(categories);
    const byPercent = getPortfolioCategoryDisplayOrder(
      categories.map((category) => ({
        ...category,
        latestValueCents: Math.round(
          (category.latestValueCents / total) * 10_000,
        ),
      })),
    );
    expect(byPercent).toEqual(byValue);
  });

  it('uses sortOrder as the first tie-breaker for equal values', () => {
    expect(
      getPortfolioCategoryDisplayOrder([
        { id: 'b', name: 'Beta', sortOrder: 2, latestValueCents: 5_000 },
        { id: 'a', name: 'Alpha', sortOrder: 1, latestValueCents: 5_000 },
      ]),
    ).toEqual(['a', 'b']);
  });

  it('uses localeCompare name as the final tie-breaker', () => {
    expect(
      compareCategoriesByLatestValue(
        { id: '2', name: 'Zebra', sortOrder: 1, latestValueCents: 100 },
        { id: '1', name: 'Apple', sortOrder: 1, latestValueCents: 100 },
      ),
    ).toBeGreaterThan(0);

    expect(
      getPortfolioCategoryDisplayOrder([
        { id: 'z', name: 'Zebra', sortOrder: 1, latestValueCents: 100 },
        { id: 'a', name: 'Apple', sortOrder: 1, latestValueCents: 100 },
      ]),
    ).toEqual(['a', 'z']);
  });

  it('places zero-value categories after positive categories', () => {
    expect(
      getPortfolioCategoryDisplayOrder([
        { id: 'zero-b', name: 'Zero B', sortOrder: 0, latestValueCents: 0 },
        { id: 'pos', name: 'Positive', sortOrder: 5, latestValueCents: 100 },
        { id: 'zero-a', name: 'Zero A', sortOrder: 1, latestValueCents: 0 },
      ]),
    ).toEqual(['pos', 'zero-b', 'zero-a']);
  });

  it('does not mutate the input array', () => {
    const input = [
      { id: 'b', name: 'B', sortOrder: 1, latestValueCents: 1 },
      { id: 'a', name: 'A', sortOrder: 0, latestValueCents: 2 },
    ];
    const snapshot = structuredClone(input);
    getPortfolioCategoryDisplayOrder(input);
    expect(input).toEqual(snapshot);
  });

  it('sortByCategoryDisplayOrder does not mutate items and preserves values under IDs', () => {
    const items = [
      { categoryId: 'cs2', amountCents: 20 },
      { categoryId: 'crypto', amountCents: 80 },
      { categoryId: 'stocks', amountCents: 10 },
    ];
    const original = structuredClone(items);
    const sorted = sortByCategoryDisplayOrder(items, [
      'crypto',
      'stocks',
      'cs2',
    ]);
    expect(sorted.map((item) => item.categoryId)).toEqual([
      'crypto',
      'stocks',
      'cs2',
    ]);
    expect(sorted.find((item) => item.categoryId === 'crypto')?.amountCents).toBe(
      80,
    );
    expect(items).toEqual(original);
  });

  it('falls back to sortOrder then name when all latest values are zero', () => {
    expect(
      getPortfolioCategoryDisplayOrder([
        { id: 'z', name: 'Zebra', sortOrder: 2, latestValueCents: 0 },
        { id: 'a', name: 'Alpha', sortOrder: 1, latestValueCents: 0 },
        { id: 'b', name: 'Beta', sortOrder: 1, latestValueCents: 0 },
      ]),
    ).toEqual(['a', 'b', 'z']);
  });
});
