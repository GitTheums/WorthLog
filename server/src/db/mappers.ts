import type {
  Category,
  Setting,
  Snapshot,
  SnapshotValue,
} from './types.js';

export interface CategoryRow {
  id: string;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SnapshotRow {
  id: string;
  date: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface SnapshotValueRow {
  id: string;
  snapshot_id: string;
  category_id: string;
  amount_cents: number;
  created_at: string;
  updated_at: string;
}

export interface SettingRow {
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

export function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSnapshot(row: SnapshotRow): Snapshot {
  return {
    id: row.id,
    date: row.date,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSnapshotValue(row: SnapshotValueRow): SnapshotValue {
  return {
    id: row.id,
    snapshotId: row.snapshot_id,
    categoryId: row.category_id,
    amountCents: row.amount_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSetting(row: SettingRow): Setting {
  return {
    key: row.key,
    value: row.value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function totalValueCents(
  values: ReadonlyArray<{ amountCents: number }>,
): number {
  return values.reduce((sum, value) => sum + value.amountCents, 0);
}
