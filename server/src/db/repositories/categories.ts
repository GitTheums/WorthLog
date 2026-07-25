import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import {
  CategoryNotFoundError,
  UniqueConstraintError,
  ValidationError,
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

export interface CategoryDeletionImpact {
  categoryId: string;
  categoryName: string;
  valueCount: number;
  snapshotCount: number;
}

export interface DeleteCategoryResult {
  deletedCategoryId: string;
  deletedCategoryName: string;
  deletedValueCount: number;
  affectedSnapshotCount: number;
}

interface MaxSortRow {
  max_sort: number;
}

const CATEGORY_SELECT = `
  SELECT id, name, color, icon, sort_order, archived_at, created_at, updated_at
  FROM categories
`;

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
              ${CATEGORY_SELECT}
              ORDER BY sort_order ASC, name COLLATE NOCASE ASC
            `,
          )
          .all()
      : db
          .prepare(
            `
              ${CATEGORY_SELECT}
              WHERE archived_at IS NULL
              ORDER BY sort_order ASC, name COLLATE NOCASE ASC
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
        ${CATEGORY_SELECT}
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
  const maxSort = db
    .prepare(
      `
        SELECT COALESCE(MAX(sort_order), -1) AS max_sort
        FROM categories
      `,
    )
    .get() as MaxSortRow;
  const sortOrder = maxSort.max_sort + 1;

  try {
    db.prepare(
      `
        INSERT INTO categories (
          id, name, color, icon, sort_order, archived_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
      `,
    ).run(id, input.name, input.color, input.icon, sortOrder, now, now);
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
  const sortOrder = input.sortOrder ?? existing.sortOrder;
  const now = new Date().toISOString();

  let archivedAt = existing.archivedAt;
  if (input.archived === true) {
    archivedAt = existing.archivedAt ?? now;
  } else if (input.archived === false) {
    archivedAt = null;
  }

  try {
    db.prepare(
      `
        UPDATE categories
        SET name = ?, color = ?, icon = ?, sort_order = ?, archived_at = ?, updated_at = ?
        WHERE id = ?
      `,
    ).run(name, color, icon, sortOrder, archivedAt, now, id);
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
  return updateCategory(db, id, { archived: true });
}

export function reorderCategories(
  db: Database.Database,
  categoryIds: string[],
): Category[] {
  if (categoryIds.length === 0) {
    throw new ValidationError('categoryIds must not be empty');
  }

  if (new Set(categoryIds).size !== categoryIds.length) {
    throw new ValidationError('categoryIds must not contain duplicates');
  }

  const run = db.transaction((ids: string[]) => {
    const now = new Date().toISOString();
    const update = db.prepare(
      `
        UPDATE categories
        SET sort_order = ?, updated_at = ?
        WHERE id = ?
      `,
    );

    ids.forEach((categoryId, index) => {
      const result = update.run(index, now, categoryId);
      if (result.changes === 0) {
        throw new CategoryNotFoundError(categoryId);
      }
    });

    return listCategories(db, { includeArchived: true });
  });

  return run(categoryIds);
}

export function getCategoryDeletionImpact(
  db: Database.Database,
  id: string,
): CategoryDeletionImpact {
  const existing = getCategoryById(db, id);
  if (!existing) {
    throw new CategoryNotFoundError(id);
  }

  const valueCount = (
    db
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM snapshot_values
          WHERE category_id = ?
        `,
      )
      .get(id) as CountRow
  ).count;

  const snapshotCount = (
    db
      .prepare(
        `
          SELECT COUNT(DISTINCT snapshot_id) AS count
          FROM snapshot_values
          WHERE category_id = ?
        `,
      )
      .get(id) as CountRow
  ).count;

  return {
    categoryId: existing.id,
    categoryName: existing.name,
    valueCount,
    snapshotCount,
  };
}

/**
 * Permanently deletes a category and all of its snapshot values in one transaction.
 * Snapshot rows (dates/notes) are kept; totals recalculate from remaining values.
 */
export function deleteCategory(
  db: Database.Database,
  id: string,
): DeleteCategoryResult {
  const run = db.transaction((categoryId: string): DeleteCategoryResult => {
    const impact = getCategoryDeletionImpact(db, categoryId);

    db.prepare('DELETE FROM snapshot_values WHERE category_id = ?').run(
      categoryId,
    );

    const deleted = db
      .prepare('DELETE FROM categories WHERE id = ?')
      .run(categoryId);

    if (deleted.changes === 0) {
      throw new CategoryNotFoundError(categoryId);
    }

    return {
      deletedCategoryId: impact.categoryId,
      deletedCategoryName: impact.categoryName,
      deletedValueCount: impact.valueCount,
      affectedSnapshotCount: impact.snapshotCount,
    };
  });

  return run(id);
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
