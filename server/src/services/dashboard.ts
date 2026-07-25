import type Database from 'better-sqlite3';
import { listCategories } from '../db/repositories/categories.js';
import { listSnapshotDetails } from '../db/repositories/snapshots.js';
import type { DashboardRange, SnapshotWithDetails } from '../db/types.js';

export interface DashboardResponse {
  range: DashboardRange;
  currentTotalCents: number;
  previousTotalCents: number | null;
  changeCents: number | null;
  changePercent: number | null;
  firstTotalCents: number | null;
  changeSinceFirstCents: number | null;
  latestDate: string | null;
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

function percentChange(
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
    currentTotalCents: 0,
    previousTotalCents: null,
    changeCents: null,
    changePercent: null,
    firstTotalCents: null,
    changeSinceFirstCents: null,
    latestDate: null,
    timeSeries: [],
    categoryTimeSeries: [],
    latestAllocation: [],
    latestCategoryValues: [],
    historyRows: [],
  };
}

export function getDashboard(
  db: Database.Database,
  range: DashboardRange,
  now = new Date(),
): DashboardResponse {
  const from = resolveRangeStart(range, now);
  const snapshots: SnapshotWithDetails[] = listSnapshotDetails(
    db,
    from ? { from } : {},
  );

  if (snapshots.length === 0) {
    return emptyDashboard(range);
  }

  const categories = listCategories(db, { includeArchived: true });
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );

  const latest = snapshots[snapshots.length - 1];
  const previous =
    snapshots.length > 1 ? snapshots[snapshots.length - 2] : undefined;
  const first = snapshots[0];

  if (!latest || !first) {
    return emptyDashboard(range);
  }

  const currentTotalCents = latest.totalValueCents;
  const previousTotalCents = previous?.totalValueCents ?? null;
  const firstTotalCents = first.totalValueCents;
  const changeCents =
    previousTotalCents === null
      ? null
      : currentTotalCents - previousTotalCents;
  const changeSinceFirstCents = currentTotalCents - firstTotalCents;

  const timeSeries = snapshots.map((snapshot) => ({
    date: snapshot.date,
    totalValueCents: snapshot.totalValueCents,
  }));

  const categoryTimeSeries = categories
    .filter((category) =>
      snapshots.some((snapshot) =>
        snapshot.values.some((value) => value.categoryId === category.id),
      ),
    )
    .map((category) => ({
      categoryId: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
      points: snapshots.map((snapshot) => ({
        date: snapshot.date,
        amountCents:
          snapshot.values.find((value) => value.categoryId === category.id)
            ?.amountCents ?? 0,
      })),
    }));

  const latestCategoryValues = latest.values.map((value) => {
    const category = categoryById.get(value.categoryId);
    return {
      categoryId: value.categoryId,
      name: category?.name ?? 'Unknown',
      color: category?.color ?? '#666666',
      icon: category?.icon ?? 'Circle',
      amountCents: value.amountCents,
    };
  });

  const latestAllocation = latestCategoryValues.map((value) => ({
    ...value,
    percent:
      currentTotalCents === 0
        ? 0
        : Number(((value.amountCents / currentTotalCents) * 100).toFixed(4)),
  }));

  const historyRows = [...snapshots].reverse().map((snapshot) => ({
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
    currentTotalCents,
    previousTotalCents,
    changeCents,
    changePercent: percentChange(currentTotalCents, previousTotalCents),
    firstTotalCents,
    changeSinceFirstCents,
    latestDate: latest.date,
    timeSeries,
    categoryTimeSeries,
    latestAllocation,
    latestCategoryValues,
    historyRows,
  };
}
