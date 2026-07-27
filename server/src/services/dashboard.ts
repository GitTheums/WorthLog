import type Database from 'better-sqlite3';
import { listCategories } from '../db/repositories/categories.js';
import { listSnapshotDetails } from '../db/repositories/snapshots.js';
import type { DashboardRange, SnapshotWithDetails } from '../db/types.js';
import {
  getPortfolioCategoryDisplayOrder,
  sortByCategoryDisplayOrder,
} from './category-display-order.js';

export interface DashboardResponse {
  range: DashboardRange;
  /** True when any snapshot exists in the complete dataset. */
  hasSnapshots: boolean;
  currentTotalCents: number;
  previousTotalCents: number | null;
  changeCents: number | null;
  changePercent: number | null;
  firstTotalCents: number | null;
  changeSinceFirstCents: number | null;
  changeSinceFirstPercent: number | null;
  latestDate: string | null;
  /**
   * Canonical dashboard category order (newest complete-portfolio snapshot):
   * latestValueCents desc → sortOrder asc → name localeCompare.
   */
  categoryDisplayOrder: string[];
  timeSeries: Array<{ date: string; totalValueCents: number }>;
  categoryTimeSeries: Array<{
    categoryId: string;
    name: string;
    color: string;
    icon: string;
    points: Array<{ date: string; amountCents: number }>;
  }>;
  latestAllocation: Array<{
    categoryId: string;
    name: string;
    color: string;
    icon: string;
    amountCents: number;
    percent: number;
  }>;
  latestCategoryValues: Array<{
    categoryId: string;
    name: string;
    color: string;
    icon: string;
    amountCents: number;
  }>;
  historyRows: Array<{
    date: string;
    note: string | null;
    totalValueCents: number;
    values: Array<{ categoryId: string; amountCents: number }>;
  }>;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function resolveRangeStart(
  range: DashboardRange,
  now = new Date(),
): string | null {
  if (range === 'all') {
    return null;
  }

  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  if (range === '1m') {
    start.setUTCMonth(start.getUTCMonth() - 1);
  } else if (range === '3m') {
    start.setUTCMonth(start.getUTCMonth() - 3);
  } else {
    start.setUTCFullYear(start.getUTCFullYear() - 1);
  }

  return toDateOnly(start);
}

/** ((current - previous) / previous) * 100; null when previous is null or zero. */
export function percentChange(
  current: number,
  previous: number | null,
): number | null {
  if (previous === null || previous === 0) {
    return null;
  }

  return Number((((current - previous) / previous) * 100).toFixed(4));
}

function emptyDashboard(range: DashboardRange): DashboardResponse {
  return {
    range,
    hasSnapshots: false,
    currentTotalCents: 0,
    previousTotalCents: null,
    changeCents: null,
    changePercent: null,
    firstTotalCents: null,
    changeSinceFirstCents: null,
    changeSinceFirstPercent: null,
    latestDate: null,
    categoryDisplayOrder: [],
    timeSeries: [],
    categoryTimeSeries: [],
    latestAllocation: [],
    latestCategoryValues: [],
    historyRows: [],
  };
}

function sortByDateAsc(
  snapshots: SnapshotWithDetails[],
): SnapshotWithDetails[] {
  return [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
}

export function getDashboard(
  db: Database.Database,
  range: DashboardRange,
  now = new Date(),
): DashboardResponse {
  const from = resolveRangeStart(range, now);
  const allSnapshots = sortByDateAsc(listSnapshotDetails(db));

  if (allSnapshots.length === 0) {
    // No values yet: fall back to manual sortOrder → name.
    const categories = listCategories(db, { includeArchived: true });
    return {
      ...emptyDashboard(range),
      categoryDisplayOrder: getPortfolioCategoryDisplayOrder(
        categories.map((category) => ({
          id: category.id,
          name: category.name,
          sortOrder: category.sortOrder,
          latestValueCents: 0,
        })),
      ),
    };
  }

  const rangedSnapshots = from
    ? allSnapshots.filter((snapshot) => snapshot.date >= from)
    : allSnapshots;

  const first = allSnapshots[0];
  if (!first) {
    return emptyDashboard(range);
  }

  const firstTotalCents = first.totalValueCents;

  if (rangedSnapshots.length === 0) {
    const categories = listCategories(db, { includeArchived: true });
    const portfolioLatest = allSnapshots[allSnapshots.length - 1];
    const portfolioLatestValueById = new Map(
      (portfolioLatest?.values ?? []).map((value) => [
        value.categoryId,
        value.amountCents,
      ]),
    );

    return {
      ...emptyDashboard(range),
      range,
      hasSnapshots: true,
      firstTotalCents,
      categoryDisplayOrder: getPortfolioCategoryDisplayOrder(
        categories
          .filter((category) =>
            allSnapshots.some((snapshot) =>
              snapshot.values.some((value) => value.categoryId === category.id),
            ),
          )
          .map((category) => ({
            id: category.id,
            name: category.name,
            sortOrder: category.sortOrder,
            latestValueCents: portfolioLatestValueById.get(category.id) ?? 0,
          })),
      ),
    };
  }

  const categories = listCategories(db, { includeArchived: true });
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );

  const latestInRange = rangedSnapshots[rangedSnapshots.length - 1];
  if (!latestInRange) {
    return {
      ...emptyDashboard(range),
      range,
      hasSnapshots: true,
      firstTotalCents,
    };
  }

  // Ordering always uses the newest snapshot in the complete portfolio,
  // even when the selected chart range excludes that date.
  const portfolioLatest = allSnapshots[allSnapshots.length - 1];
  if (!portfolioLatest) {
    return {
      ...emptyDashboard(range),
      range,
      hasSnapshots: true,
      firstTotalCents,
    };
  }

  const portfolioLatestValueById = new Map(
    portfolioLatest.values.map((value) => [
      value.categoryId,
      value.amountCents,
    ]),
  );

  // Previous is the snapshot immediately before the newest-in-range item in
  // the complete ordered dataset (not calendar-day math, not range-scoped).
  const latestIndex = allSnapshots.findIndex(
    (snapshot) => snapshot.id === latestInRange.id,
  );
  const previous =
    latestIndex > 0 ? allSnapshots[latestIndex - 1] : undefined;

  const currentTotalCents = latestInRange.totalValueCents;
  const previousTotalCents = previous?.totalValueCents ?? null;
  const changeCents =
    previousTotalCents === null
      ? null
      : currentTotalCents - previousTotalCents;
  const changePercent = percentChange(currentTotalCents, previousTotalCents);
  const changeSinceFirstCents = currentTotalCents - firstTotalCents;
  const changeSinceFirstPercent = percentChange(
    currentTotalCents,
    firstTotalCents,
  );

  const timeSeries = rangedSnapshots.map((snapshot) => ({
    date: snapshot.date,
    totalValueCents: snapshot.totalValueCents,
  }));

  // Categories with any values in the ranged history (including archived).
  // Missing values on a date are represented as zero (e.g. before a category existed).
  const seriesCategories = categories.filter((category) =>
    rangedSnapshots.some((snapshot) =>
      snapshot.values.some((value) => value.categoryId === category.id),
    ),
  );

  const displayCategoryIds = new Set<string>([
    ...seriesCategories.map((category) => category.id),
    ...latestInRange.values.map((value) => value.categoryId),
  ]);

  const categoryDisplayOrder = getPortfolioCategoryDisplayOrder(
    [...displayCategoryIds].map((categoryId) => {
      const category = categoryById.get(categoryId);
      return {
        id: categoryId,
        name: category?.name ?? 'Unknown',
        sortOrder: category?.sortOrder ?? Number.MAX_SAFE_INTEGER,
        latestValueCents: portfolioLatestValueById.get(categoryId) ?? 0,
      };
    }),
  );

  const categoryTimeSeries = sortByCategoryDisplayOrder(
    seriesCategories.map((category) => ({
      categoryId: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
      points: rangedSnapshots.map((snapshot) => ({
        date: snapshot.date,
        amountCents:
          snapshot.values.find((value) => value.categoryId === category.id)
            ?.amountCents ?? 0,
      })),
    })),
    categoryDisplayOrder,
  );

  const latestCategoryValues = sortByCategoryDisplayOrder(
    latestInRange.values.map((value) => {
      const category = categoryById.get(value.categoryId);
      return {
        categoryId: value.categoryId,
        name: category?.name ?? 'Unknown',
        color: category?.color ?? '#666666',
        icon: category?.icon ?? 'Circle',
        amountCents: value.amountCents,
      };
    }),
    categoryDisplayOrder,
  );

  const latestAllocation = latestCategoryValues.map((value) => ({
    ...value,
    percent:
      currentTotalCents === 0
        ? 0
        : Number(((value.amountCents / currentTotalCents) * 100).toFixed(4)),
  }));

  const historyRows = [...rangedSnapshots].reverse().map((snapshot) => ({
    date: snapshot.date,
    note: snapshot.note,
    totalValueCents: snapshot.totalValueCents,
    values: snapshot.values.map((value) => ({
      categoryId: value.categoryId,
      amountCents: value.amountCents,
    })),
  }));

  return {
    range,
    hasSnapshots: true,
    currentTotalCents,
    previousTotalCents,
    changeCents,
    changePercent,
    firstTotalCents,
    changeSinceFirstCents,
    changeSinceFirstPercent,
    latestDate: latestInRange.date,
    categoryDisplayOrder,
    timeSeries,
    categoryTimeSeries,
    latestAllocation,
    latestCategoryValues,
    historyRows,
  };
}
