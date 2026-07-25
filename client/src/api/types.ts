export type DashboardRange = '1m' | '3m' | '1y' | 'all';

export interface AppSettings {
  currency: string;
  defaultRange: DashboardRange;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  sortOrder: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotValue {
  id: string;
  snapshotId: string;
  categoryId: string;
  amountCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotDetails {
  id: string;
  date: string;
  note: string | null;
  totalValueCents: number;
  values: SnapshotValue[];
  createdAt: string;
  updatedAt: string;
}

export interface UpsertSnapshotPayload {
  note?: string | null;
  values: Array<{
    categoryId: string;
    amountCents: number;
  }>;
}

export interface DashboardData {
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

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ApiSuccess<T> {
  data: T;
}
