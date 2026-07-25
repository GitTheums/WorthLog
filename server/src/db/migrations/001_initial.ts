import type { Migration } from '../migrate.js';

export const migration001Initial: Migration = {
  version: 1,
  name: 'initial_schema',
  up(db) {
    db.exec(`
      CREATE TABLE categories (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL COLLATE NOCASE,
        color TEXT NOT NULL,
        icon TEXT NOT NULL,
        archived_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (name)
      );

      CREATE TABLE snapshots (
        id TEXT PRIMARY KEY NOT NULL,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (date)
      );

      CREATE TABLE snapshot_values (
        id TEXT PRIMARY KEY NOT NULL,
        snapshot_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id),
        UNIQUE (snapshot_id, category_id),
        CHECK (amount_cents >= 0),
        CHECK (typeof(amount_cents) = 'integer')
      );

      CREATE TABLE settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX idx_snapshot_values_category_id
        ON snapshot_values(category_id);

      CREATE INDEX idx_snapshots_date
        ON snapshots(date);
    `);
  },
};
