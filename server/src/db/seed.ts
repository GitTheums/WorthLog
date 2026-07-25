import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

interface CountRow {
  count: number;
}

const DEFAULT_CATEGORIES = [
  { name: 'Crypto', color: '#7C5CFC', icon: 'Bitcoin' },
  { name: 'Stocks', color: '#2563EB', icon: 'ChartNoAxesCombined' },
  { name: 'Pokémon', color: '#F59E0B', icon: 'Sparkles' },
  { name: 'CS2 Skins', color: '#EF4444', icon: 'Crosshair' },
] as const;

export function seedDefaultCategories(db: Database.Database): void {
  const row = db
    .prepare('SELECT COUNT(*) AS count FROM categories')
    .get() as CountRow;

  if (row.count > 0) {
    return;
  }

  const insert = db.prepare(`
    INSERT INTO categories (
      id, name, color, icon, archived_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, NULL, ?, ?)
  `);

  const seed = db.transaction(() => {
    const now = new Date().toISOString();

    for (const category of DEFAULT_CATEGORIES) {
      insert.run(
        randomUUID(),
        category.name,
        category.color,
        category.icon,
        now,
        now,
      );
    }
  });

  seed();
}
