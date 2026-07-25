import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

interface CountRow {
  count: number;
}

/** Seeded only when the categories table is empty (brand-new installations). */
const DEFAULT_CATEGORIES = [
  {
    name: 'Stocks',
    color: '#2563EB',
    icon: 'ChartNoAxesCombined',
  },
] as const;

/**
 * Idempotent first-run seed. Existing installations with any categories are left untouched.
 */
export function seedDefaultCategories(db: Database.Database): void {
  const row = db
    .prepare('SELECT COUNT(*) AS count FROM categories')
    .get() as CountRow;

  if (row.count > 0) {
    return;
  }

  const insert = db.prepare(`
    INSERT INTO categories (
      id, name, color, icon, sort_order, archived_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
  `);

  const seed = db.transaction(() => {
    const now = new Date().toISOString();

    DEFAULT_CATEGORIES.forEach((category, index) => {
      insert.run(
        randomUUID(),
        category.name,
        category.color,
        category.icon,
        index,
        now,
        now,
      );
    });
  });

  seed();
}
