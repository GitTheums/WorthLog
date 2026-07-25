import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import type { Express } from 'express';
import { createApp } from '../app.js';
import { openDatabase } from '../db/index.js';
import { listCategories } from '../db/repositories/categories.js';
import { upsertSnapshot } from '../db/repositories/snapshots.js';

export interface TestContext {
  app: Express;
  db: Database.Database;
  dataDir: string;
  cleanup: () => void;
}

export function createTestContext(): TestContext {
  const dataDir = mkdtempSync(join(tmpdir(), 'worthlog-api-'));
  const db = openDatabase(dataDir);
  const app = createApp(db, { dataDir });

  return {
    app,
    db,
    dataDir,
    cleanup: () => {
      db.close();
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

export function activeCategoryValues(
  db: Database.Database,
  amounts: Record<string, number> | number,
) {
  const categories = listCategories(db);
  if (typeof amounts === 'number') {
    return categories.map((category) => ({
      categoryId: category.id,
      amountCents: amounts,
    }));
  }

  return categories.map((category) => ({
    categoryId: category.id,
    amountCents: amounts[category.name] ?? 0,
  }));
}

export function seedSnapshot(
  db: Database.Database,
  date: string,
  amounts: Record<string, number> | number,
  note: string | null = null,
) {
  return upsertSnapshot(db, {
    date,
    note,
    values: activeCategoryValues(db, amounts),
  });
}
