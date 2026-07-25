import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import {
  CategoryInUseError,
  CategoryNotFoundError,
  UniqueConstraintError,
} from '../errors.js';
import { mapCategory, type CategoryRow } from '../mappers.js';
import type {
  Category,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../types.js';

interface CountRow {
  count: number;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}

export function listCategories(
  db: Database.Database,
  options: { includeArchived?: boolean } = {},
): Category[] {
  const includeArchived = options.includeArchived ?? false;

  const rows = (
    includeArchived
      ? db
          .prepare(
            `
              SELECT id, name, color, icon, archived_at, created_at, updated_at
              FROM categories
              ORDER BY name COLLATE NOCASE ASC
            `,
          )
          .all()
      : db
          .prepare(
            `
              SELECT id, name, color, icon, archived_at, created_at, updated_at
              FROM categories
              WHERE archived_at IS NULL
              ORDER BY name COLLATE NOCASE ASC
            `,
          )
          .all()
  ) as CategoryRow[];

  return rows.map(mapCategory);
}

export function getCategoryById(
  db: Database.Database,
  id: string,
): Category | null {
  const row = db
    .prepare(
      `
        SELECT id, name, color, icon, archived_at, created_at, updated_at
        FROM categories
        WHERE id = ?
      `,
    )
    .get(id) as CategoryRow | undefined;

  return row ? mapCategory(row) : null;
}

export function createCategory(
  db: Database.Database,
  input: CreateCategoryInput,
): Category {
  const id = randomUUID();
  const now = new Date().toISOString();

  try {
    db.prepare(
      `
        INSERT INTO categories (
          id, name, color, icon, archived_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, NULL, ?, ?)
      `,
    ).run(id, input.name, input.color, input.icon, now, now);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new UniqueConstraintError(
        `A category named "${input.name}" already exists`,
      );
    }
    throw error;
  }

  const created = getCategoryById(db, id);
  if (!created) {
    throw new Error('Failed to load created category');
  }
  return created;
}

export function updateCategory(
  db: Database.Database,
  id: string,
  input: UpdateCategoryInput,
): Category {
  const existing = getCategoryById(db, id);
  if (!existing) {
    throw new CategoryNotFoundError(id);
  }

  const name = input.name ?? existing.name;
  const color = input.color ?? existing.color;
  const icon = input.icon ?? existing.icon;
  const now = new Date().toISOString();

  try {
    db.prepare(
      `
        UPDATE categories
        SET name = ?, color = ?, icon = ?, updated_at = ?
        WHERE id = ?
      `,
    ).run(name, color, icon, now, id);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new UniqueConstraintError(
        `A category named "${name}" already exists`,
      );
    }
    throw error;
  }

  const updated = getCategoryById(db, id);
  if (!updated) {
    throw new CategoryNotFoundError(id);
  }
  return updated;
}

export function archiveCategory(
  db: Database.Database,
  id: string,
): Category {
  const existing = getCategoryById(db, id);
  if (!existing) {
    throw new CategoryNotFoundError(id);
  }

  const now = new Date().toISOString();

  db.prepare(
    `
      UPDATE categories
      SET archived_at = ?, updated_at = ?
      WHERE id = ?
    `,
  ).run(now, now, id);

  const archived = getCategoryById(db, id);
  if (!archived) {
    throw new CategoryNotFoundError(id);
  }
  return archived;
}

export function deleteCategory(db: Database.Database, id: string): void {
  const existing = getCategoryById(db, id);
  if (!existing) {
    throw new CategoryNotFoundError(id);
  }

  const usage = db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM snapshot_values
        WHERE category_id = ?
      `,
    )
    .get(id) as CountRow;

  if (usage.count > 0) {
    throw new CategoryInUseError(id);
  }

  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
}

export function categoryHasSnapshotValues(
  db: Database.Database,
  id: string,
): boolean {
  const usage = db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM snapshot_values
        WHERE category_id = ?
      `,
    )
    .get(id) as CountRow;

  return usage.count > 0;
}
