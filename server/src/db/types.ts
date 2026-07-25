export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Snapshot {
  id: string;
  date: string;
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
}

export interface UpsertSnapshotValueInput {
  categoryId: string;
  amountCents: number;
}

export interface UpsertSnapshotInput {
  date: string;
  values: UpsertSnapshotValueInput[];
}
