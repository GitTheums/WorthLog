/**
 * Canonical portfolio display order for dashboard analytics.
 *
 * Sort rules (newest complete-portfolio snapshot values):
 * 1. latestValueCents descending
 * 2. sortOrder ascending (manual category order as first tie-breaker)
 * 3. name via localeCompare (final deterministic tie-breaker)
 *
 * Zero-value categories remain visible and sort after all positive values
 * using the same tie-breakers among themselves.
 *
 * Settings and snapshot forms intentionally keep manual sortOrder instead.
 */

export interface CategoryOrderInput {
  id: string;
  name: string;
  sortOrder: number;
  latestValueCents: number;
}

export function compareCategoriesByLatestValue(
  a: CategoryOrderInput,
  b: CategoryOrderInput,
): number {
  if (a.latestValueCents !== b.latestValueCents) {
    return b.latestValueCents - a.latestValueCents;
  }

  if (a.sortOrder !== b.sortOrder) {
    return a.sortOrder - b.sortOrder;
  }

  return a.name.localeCompare(b.name);
}

/**
 * Returns category IDs in canonical dashboard display order.
 * Does not mutate the input array.
 */
export function getPortfolioCategoryDisplayOrder(
  categories: readonly CategoryOrderInput[],
): string[] {
  return [...categories]
    .sort(compareCategoriesByLatestValue)
    .map((category) => category.id);
}

/**
 * Reorders items by a canonical category ID list without mutating `items`.
 * Unknown IDs are appended after ordered ones, preserving relative order.
 */
export function sortByCategoryDisplayOrder<T extends { categoryId: string }>(
  items: readonly T[],
  categoryDisplayOrder: readonly string[],
): T[] {
  const index = new Map(
    categoryDisplayOrder.map((categoryId, position) => [
      categoryId,
      position,
    ]),
  );

  return [...items].sort((left, right) => {
    const leftIndex = index.get(left.categoryId);
    const rightIndex = index.get(right.categoryId);
    if (leftIndex === undefined && rightIndex === undefined) {
      return 0;
    }
    if (leftIndex === undefined) {
      return 1;
    }
    if (rightIndex === undefined) {
      return -1;
    }
    return leftIndex - rightIndex;
  });
}
