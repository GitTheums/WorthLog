import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { migrations } from './migrations/index.js';
import { runMigrations } from './migrate.js';
import { seedDefaultCategories } from './seed.js';

export function getDatabasePath(dataDir: string): string {
  return join(dataDir, 'worthlog.db');
}

export function openDatabase(dataDir: string): Database.Database {
  mkdirSync(dataDir, { recursive: true });

  const db = new Database(getDatabasePath(dataDir));

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db, migrations);
  seedDefaultCategories(db);

  return db;
}
