import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import type { Express } from 'express';
import { createApp, type AppOptions } from '../app.js';
import { openDatabase } from '../db/index.js';
import type { AppLogger } from '../logging.js';
import { createRateLimiters } from '../middleware/rateLimits.js';
import {
  createCategory,
  listCategories,
  reorderCategories,
} from '../db/repositories/categories.js';
import { upsertSnapshot } from '../db/repositories/snapshots.js';

export interface TestContext {
  app: Express;
  db: Database.Database;
  dataDir: string;
  cleanup: () => void;
}

/**
 * Adds the classic multi-category set used by older tests.
 * Does not remove or rename existing categories (safe for Stocks-only seeds).
 */
export function ensureMultiCategoryFixture(db: Database.Database): void {
  const existing = new Set(
    listCategories(db, { includeArchived: true }).map(
      (category) => category.name,
    ),
  );

  const extras = [
    { name: 'Crypto', color: '#7C5CFC', icon: 'Bitcoin' },
    { name: 'Pokémon', color: '#F59E0B', icon: 'Sparkles' },
    { name: 'CS2 Skins', color: '#EF4444', icon: 'Crosshair' },
  ] as const;

  for (const category of extras) {
    if (!existing.has(category.name)) {
      createCategory(db, category);
    }
  }

  const all = listCategories(db, { includeArchived: true });
  const orderedIds = ['Crypto', 'Stocks', 'Pokémon', 'CS2 Skins']
    .map((name) => all.find((category) => category.name === name)?.id)
    .filter((id): id is string => Boolean(id));

  if (orderedIds.length === 4) {
    reorderCategories(db, orderedIds);
  }
}

export function createTestContext(options?: {
  multiCategory?: boolean;
  trustProxy?: AppOptions['trustProxy'];
  rateLimiters?: AppOptions['rateLimiters'];
  logger?: AppLogger;
}): TestContext {
  const dataDir = mkdtempSync(join(tmpdir(), 'worthlog-api-'));
  const db = openDatabase(dataDir);
  if (options?.multiCategory !== false) {
    // Most API/dashboard tests still use the classic four-category fixture.
    ensureMultiCategoryFixture(db);
  }
  // Fresh in-memory limiters per test app so suites do not share hit counters.
  const app = createApp(db, {
    dataDir,
    rateLimiters: options?.rateLimiters ?? createRateLimiters(),
    ...(options?.logger !== undefined ? { logger: options.logger } : {}),
    ...(options?.trustProxy !== undefined
      ? { trustProxy: options.trustProxy }
      : {}),
  });

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
