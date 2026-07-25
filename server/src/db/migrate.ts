import type Database from 'better-sqlite3';

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

interface AppliedMigrationRow {
  version: number;
}

export function runMigrations(
  db: Database.Database,
  migrations: readonly Migration[],
): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db
    .prepare('SELECT version FROM schema_migrations ORDER BY version ASC')
    .all() as AppliedMigrationRow[];
  const applied = new Set(appliedRows.map((row) => row.version));

  const pending = migrations
    .filter((migration) => !applied.has(migration.version))
    .sort((a, b) => a.version - b.version);

  if (pending.length === 0) {
    return;
  }

  const applyPending = db.transaction((items: readonly Migration[]) => {
    const insert = db.prepare(`
      INSERT INTO schema_migrations (version, name, applied_at)
      VALUES (?, ?, ?)
    `);

    for (const migration of items) {
      migration.up(db);
      insert.run(migration.version, migration.name, new Date().toISOString());
    }
  });

  applyPending(pending);
}
