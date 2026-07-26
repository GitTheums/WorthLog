import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  UniqueConstraintError,
  archiveCategory,
  createCategory,
  deleteCategory,
  getDatabasePath,
  getSetting,
  getSnapshotDetailsByDate,
  getSnapshotWithValuesByDate,
  listCategories,
  listSnapshotValues,
  openDatabase,
  setSetting,
  upsertSnapshot,
} from './index.js';
import { getDashboard } from '../services/dashboard.js';

describe('SQLite database layer', () => {
  let dataDir: string;
  let db: Database.Database;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'worthlog-db-'));
    db = openDatabase(dataDir);
  });

  afterEach(() => {
    db.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('initializes the database file, WAL mode, and foreign keys', () => {
    expect(existsSync(getDatabasePath(dataDir))).toBe(true);
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);

    const tables = db
      .prepare(
        `
          SELECT name FROM sqlite_master
          WHERE type = 'table'
          ORDER BY name ASC
        `,
      )
      .all() as Array<{ name: string }>;

    expect(tables.map((table) => table.name)).toEqual(
      expect.arrayContaining([
        'categories',
        'schema_migrations',
        'security_settings',
        'settings',
        'snapshot_values',
        'snapshots',
      ]),
    );
  });

  it('seeds only Stocks when the categories table is empty', () => {
    const seeded = listCategories(db);

    expect(seeded).toHaveLength(1);
    expect(seeded[0]).toMatchObject({
      name: 'Stocks',
      color: '#2563EB',
      icon: 'ChartNoAxesCombined',
      sortOrder: 0,
      archivedAt: null,
    });
  });

  it('does not duplicate Stocks when the database is reopened', () => {
    expect(listCategories(db)).toHaveLength(1);

    db.close();
    db = openDatabase(dataDir);

    const categories = listCategories(db);
    expect(categories).toHaveLength(1);
    expect(categories[0]?.name).toBe('Stocks');
  });

  it('leaves an existing four-category installation unchanged on reopen', () => {
    createCategory(db, {
      name: 'Crypto',
      color: '#7C5CFC',
      icon: 'Bitcoin',
    });
    createCategory(db, {
      name: 'Pokémon',
      color: '#F59E0B',
      icon: 'Sparkles',
    });
    createCategory(db, {
      name: 'CS2 Skins',
      color: '#EF4444',
      icon: 'Crosshair',
    });

    const before = listCategories(db, { includeArchived: true }).map(
      (category) => ({
        id: category.id,
        name: category.name,
        color: category.color,
        icon: category.icon,
        sortOrder: category.sortOrder,
      }),
    );
    expect(before).toHaveLength(4);

    db.close();
    db = openDatabase(dataDir);

    const after = listCategories(db, { includeArchived: true }).map(
      (category) => ({
        id: category.id,
        name: category.name,
        color: category.color,
        icon: category.icon,
        sortOrder: category.sortOrder,
      }),
    );

    expect(after).toEqual(before);
  });

  it('enforces one snapshot per date', () => {
    const [stocks] = listCategories(db);
    if (!stocks) {
      throw new Error('Expected seeded categories');
    }

    upsertSnapshot(db, {
      date: '2026-01-15',
      values: [{ categoryId: stocks.id, amountCents: 100 }],
    });

    expect(() => {
      db.prepare(
        `
          INSERT INTO snapshots (id, date, created_at, updated_at)
          VALUES (?, ?, ?, ?)
        `,
      ).run(
        '11111111-1111-1111-1111-111111111111',
        '2026-01-15',
        new Date().toISOString(),
        new Date().toISOString(),
      );
    }).toThrow(/UNIQUE/i);
  });

  it('enforces case-insensitive unique category names', () => {
    expect(() =>
      createCategory(db, {
        name: 'stocks',
        color: '#000000',
        icon: 'ChartNoAxesCombined',
      }),
    ).toThrow(UniqueConstraintError);

    expect(() =>
      createCategory(db, {
        name: 'STOCKS',
        color: '#000000',
        icon: 'ChartNoAxesCombined',
      }),
    ).toThrow(UniqueConstraintError);
  });

  it('upserts a complete snapshot inside one transaction', () => {
    const stocks = listCategories(db).find(
      (category) => category.name === 'Stocks',
    );
    const crypto = createCategory(db, {
      name: 'Crypto',
      color: '#7C5CFC',
      icon: 'Bitcoin',
    });

    if (!stocks) {
      throw new Error('Expected seeded Stocks category');
    }

    const created = upsertSnapshot(db, {
      date: '2026-02-01',
      values: [
        { categoryId: crypto.id, amountCents: 12_345 },
        { categoryId: stocks.id, amountCents: 67_890 },
      ],
    });

    expect(created.date).toBe('2026-02-01');
    expect(created.values).toHaveLength(2);

    const updated = upsertSnapshot(db, {
      date: '2026-02-01',
      values: [{ categoryId: crypto.id, amountCents: 99_999 }],
    });

    expect(updated.id).toBe(created.id);
    expect(updated.values).toHaveLength(1);
    expect(updated.values[0]).toMatchObject({
      categoryId: crypto.id,
      amountCents: 99_999,
    });

    expect(listSnapshotValues(db, created.id)).toHaveLength(1);

    const missingCategoryId = '00000000-0000-4000-8000-000000000000';

    expect(() =>
      upsertSnapshot(db, {
        date: '2026-02-02',
        values: [{ categoryId: missingCategoryId, amountCents: 100 }],
      }),
    ).toThrow();

    expect(getSnapshotWithValuesByDate(db, '2026-02-02')).toBeNull();
  });

  it('keeps historical values when a category is archived', () => {
    const stocks = listCategories(db).find(
      (category) => category.name === 'Stocks',
    );
    if (!stocks) {
      throw new Error('Expected seeded Stocks category');
    }

    upsertSnapshot(db, {
      date: '2026-03-01',
      values: [{ categoryId: stocks.id, amountCents: 50_000 }],
    });

    const archived = archiveCategory(db, stocks.id);

    expect(archived.archivedAt).toBeTruthy();
    expect(listCategories(db).some((category) => category.id === stocks.id)).toBe(
      false,
    );
    expect(
      listCategories(db, { includeArchived: true }).some(
        (category) => category.id === stocks.id,
      ),
    ).toBe(true);

    const snapshot = getSnapshotWithValuesByDate(db, '2026-03-01');
    expect(snapshot?.values).toEqual([
      expect.objectContaining({
        categoryId: stocks.id,
        amountCents: 50_000,
      }),
    ]);
  });

  it('allows hard-deleting an unused category', () => {
    const category = createCategory(db, {
      name: 'Temporary',
      color: '#111111',
      icon: 'Sparkles',
    });

    const result = deleteCategory(db, category.id);

    expect(result).toMatchObject({
      deletedCategoryId: category.id,
      deletedCategoryName: 'Temporary',
      deletedValueCount: 0,
      affectedSnapshotCount: 0,
    });
    expect(
      listCategories(db, { includeArchived: true }).some(
        (item) => item.id === category.id,
      ),
    ).toBe(false);
  });

  it('allows hard-deleting the initial Stocks category', () => {
    const stocks = listCategories(db).find(
      (category) => category.name === 'Stocks',
    );
    if (!stocks) {
      throw new Error('Expected seeded Stocks category');
    }

    deleteCategory(db, stocks.id);

    expect(listCategories(db, { includeArchived: true })).toHaveLength(0);
  });

  it('permanently deletes a category with history and recalculates totals', () => {
    const stocks = listCategories(db).find(
      (category) => category.name === 'Stocks',
    );
    const crypto = createCategory(db, {
      name: 'Crypto',
      color: '#7C5CFC',
      icon: 'Bitcoin',
    });
    if (!stocks) {
      throw new Error('Expected seeded Stocks category');
    }

    upsertSnapshot(db, {
      date: '2026-04-01',
      note: 'Keep me',
      values: [
        { categoryId: stocks.id, amountCents: 1_000 },
        { categoryId: crypto.id, amountCents: 2_000 },
      ],
    });
    upsertSnapshot(db, {
      date: '2026-04-02',
      note: 'Also keep',
      values: [
        { categoryId: stocks.id, amountCents: 3_000 },
        { categoryId: crypto.id, amountCents: 4_000 },
      ],
    });

    const result = deleteCategory(db, crypto.id);

    expect(result).toMatchObject({
      deletedCategoryId: crypto.id,
      deletedCategoryName: 'Crypto',
      deletedValueCount: 2,
      affectedSnapshotCount: 2,
    });

    expect(
      listCategories(db, { includeArchived: true }).some(
        (category) => category.id === crypto.id,
      ),
    ).toBe(false);

    const first = getSnapshotDetailsByDate(db, '2026-04-01');
    expect(first?.note).toBe('Keep me');
    expect(first?.values).toEqual([
      expect.objectContaining({
        categoryId: stocks.id,
        amountCents: 1_000,
      }),
    ]);
    expect(first?.totalValueCents).toBe(1_000);

    const second = getSnapshotDetailsByDate(db, '2026-04-02');
    expect(second?.note).toBe('Also keep');
    expect(second?.totalValueCents).toBe(3_000);

    const orphaned = db
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM snapshot_values
          WHERE category_id = ?
        `,
      )
      .get(crypto.id) as { count: number };
    expect(orphaned.count).toBe(0);

    const dashboard = getDashboard(db, 'all');
    expect(dashboard.currentTotalCents).toBe(3_000);
    expect(dashboard.historyRows).toHaveLength(2);
  });

  it('keeps a snapshot with total zero when it has no remaining values', () => {
    const stocks = listCategories(db).find(
      (category) => category.name === 'Stocks',
    );
    if (!stocks) {
      throw new Error('Expected seeded Stocks category');
    }

    upsertSnapshot(db, {
      date: '2026-04-10',
      note: 'Empty after delete',
      values: [{ categoryId: stocks.id, amountCents: 500 }],
    });

    deleteCategory(db, stocks.id);

    const snapshot = getSnapshotDetailsByDate(db, '2026-04-10');
    expect(snapshot).toMatchObject({
      date: '2026-04-10',
      note: 'Empty after delete',
      totalValueCents: 0,
      values: [],
    });
  });

  it('rolls back a failed deletion transaction completely', () => {
    const stocks = listCategories(db).find(
      (category) => category.name === 'Stocks',
    );
    if (!stocks) {
      throw new Error('Expected seeded Stocks category');
    }

    upsertSnapshot(db, {
      date: '2026-04-15',
      values: [{ categoryId: stocks.id, amountCents: 750 }],
    });

    expect(() => {
      db.transaction(() => {
        db.prepare('DELETE FROM snapshot_values WHERE category_id = ?').run(
          stocks.id,
        );
        throw new Error('simulated failure');
      })();
    }).toThrow('simulated failure');

    expect(getCategoryByIdSafe(db, stocks.id)).toBeTruthy();
    expect(
      getSnapshotWithValuesByDate(db, '2026-04-15')?.values,
    ).toEqual([
      expect.objectContaining({
        categoryId: stocks.id,
        amountCents: 750,
      }),
    ]);
  });

  it('keeps money values as exact integer cents', () => {
    const stocks = listCategories(db).find(
      (category) => category.name === 'Stocks',
    );
    if (!stocks) {
      throw new Error('Expected seeded Stocks category');
    }

    const amountCents = 123_456_789;

    const snapshot = upsertSnapshot(db, {
      date: '2026-05-01',
      values: [{ categoryId: stocks.id, amountCents }],
    });

    expect(snapshot.values[0]?.amountCents).toBe(amountCents);
    expect(Number.isInteger(snapshot.values[0]?.amountCents)).toBe(true);

    const row = db
      .prepare(
        `
          SELECT amount_cents, typeof(amount_cents) AS amount_type
          FROM snapshot_values
          WHERE id = ?
        `,
      )
      .get(snapshot.values[0]?.id) as {
      amount_cents: number;
      amount_type: string;
    };

    expect(row.amount_cents).toBe(amountCents);
    expect(row.amount_type).toBe('integer');

    expect(() =>
      upsertSnapshot(db, {
        date: '2026-05-02',
        values: [{ categoryId: stocks.id, amountCents: 12.34 }],
      }),
    ).toThrow(/non-negative safe integer/i);
  });

  it('stores and updates settings', () => {
    const created = setSetting(db, 'currency', 'EUR');
    expect(created).toMatchObject({
      key: 'currency',
      value: 'EUR',
    });

    const updated = setSetting(db, 'currency', 'EUR');
    expect(updated.value).toBe('EUR');
    expect(getSetting(db, 'currency')?.value).toBe('EUR');
  });
});

function getCategoryByIdSafe(
  db: Database.Database,
  id: string,
): { id: string } | undefined {
  return db
    .prepare('SELECT id FROM categories WHERE id = ?')
    .get(id) as { id: string } | undefined;
}
