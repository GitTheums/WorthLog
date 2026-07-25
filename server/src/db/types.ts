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

export interface Snapshot {
  id: string;
  date: string;
  note: string | null;
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

export interface SnapshotWithValues extends Snapshot {
  values: SnapshotValue[];
}

export interface SnapshotWithDetails extends SnapshotWithValues {
  totalValueCents: number;
}

export interface Setting {
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryInput {
  name: string;
  color: string;
  icon: string;
}

export interface UpdateCategoryInput {
  name?: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
  archived?: boolean;
}

export interface UpsertSnapshotValueInput {
  categoryId: string;
  amountCents: number;
}

export interface UpsertSnapshotInput {
  date: string;
  note?: string | null;
  values: UpsertSnapshotValueInput[];
}

export interface ListSnapshotsOptions {
  from?: string;
  to?: string;
}

export type DashboardRange = '1m' | '3m' | '1y' | 'all';

export interface AppSettings {
  currency: string;
  defaultRange: DashboardRange;
}
