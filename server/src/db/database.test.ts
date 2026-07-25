import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CategoryInUseError,
  UniqueConstraintError,
  archiveCategory,
  createCategory,
  deleteCategory,
  getDatabasePath,
  getSetting,
  getSnapshotWithValuesByDate,
  listCategories,
  listSnapshotValues,
  openDatabase,
  setSetting,
  upsertSnapshot,
} from './index.js';

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
        'settings',
        'snapshot_values',
        'snapshots',
      ]),
    );
  });

  it('seeds default categories only when the categories table is empty', () => {
    const seeded = listCategories(db);

    expect(seeded).toHaveLength(4);
    expect(new Set(seeded.map((category) => category.name))).toEqual(
      new Set(['Crypto', 'Stocks', 'Pokémon', 'CS2 Skins']),
    );
    expect(seeded.find((category) => category.name === 'Crypto')).toMatchObject({
      color: '#7C5CFC',
      icon: 'Bitcoin',
      archivedAt: null,
    });
    expect(seeded.find((category) => category.name === 'Stocks')).toMatchObject({
      color: '#2563EB',
      icon: 'ChartNoAxesCombined',
    });
    expect(seeded.find((category) => category.name === 'Pokémon')).toMatchObject({
      color: '#F59E0B',
      icon: 'Sparkles',
    });
    expect(seeded.find((category) => category.name === 'CS2 Skins')).toMatchObject(
      {
        color: '#EF4444',
        icon: 'Crosshair',
      },
    );

    db.close();
    db = openDatabase(dataDir);

    expect(listCategories(db)).toHaveLength(4);
  });

  it('enforces one snapshot per date', () => {
    const [crypto] = listCategories(db);
    if (!crypto) {
      throw new Error('Expected seeded categories');
    }

    upsertSnapshot(db, {
      date: '2026-01-15',
      values: [{ categoryId: crypto.id, amountCents: 100 }],
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
        name: 'crypto',
        color: '#000000',
        icon: 'Bitcoin',
      }),
    ).toThrow(UniqueConstraintError);

    expect(() =>
      createCategory(db, {
        name: 'CRYPTO',
        color: '#000000',
        icon: 'Bitcoin',
      }),
    ).toThrow(UniqueConstraintError);
  });

  it('upserts a complete snapshot inside one transaction', () => {
    const categories = listCategories(db);
    const crypto = categories.find((category) => category.name === 'Crypto');
    const stocks = categories.find((category) => category.name === 'Stocks');

    if (!crypto || !stocks) {
      throw new Error('Expected seeded Crypto and Stocks categories');
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
    const crypto = listCategories(db).find(
      (category) => category.name === 'Crypto',
    );
    if (!crypto) {
      throw new Error('Expected seeded Crypto category');
    }

    upsertSnapshot(db, {
      date: '2026-03-01',
      values: [{ categoryId: crypto.id, amountCents: 50_000 }],
    });

    const archived = archiveCategory(db, crypto.id);

    expect(archived.archivedAt).toBeTruthy();
    expect(listCategories(db).some((category) => category.id === crypto.id)).toBe(
      false,
    );
    expect(
      listCategories(db, { includeArchived: true }).some(
        (category) => category.id === crypto.id,
      ),
    ).toBe(true);

    const snapshot = getSnapshotWithValuesByDate(db, '2026-03-01');
    expect(snapshot?.values).toEqual([
      expect.objectContaining({
        categoryId: crypto.id,
        amountCents: 50_000,
      }),
    ]);
  });

  it('allows hard-deleting a category without history', () => {
    const category = createCategory(db, {
      name: 'Temporary',
      color: '#111111',
      icon: 'Sparkles',
    });

    deleteCategory(db, category.id);

    expect(
      listCategories(db, { includeArchived: true }).some(
        (item) => item.id === category.id,
      ),
    ).toBe(false);
  });

  it('rejects hard-deleting a category that has snapshot data', () => {
    const crypto = listCategories(db).find(
      (category) => category.name === 'Crypto',
    );
    if (!crypto) {
      throw new Error('Expected seeded Crypto category');
    }

    upsertSnapshot(db, {
      date: '2026-04-01',
      values: [{ categoryId: crypto.id, amountCents: 1 }],
    });

    expect(() => {
      deleteCategory(db, crypto.id);
    }).toThrow(CategoryInUseError);

    expect(
      listCategories(db, { includeArchived: true }).some(
        (category) => category.id === crypto.id,
      ),
    ).toBe(true);
  });

  it('keeps money values as exact integer cents', () => {
    const crypto = listCategories(db).find(
      (category) => category.name === 'Crypto',
    );
    if (!crypto) {
      throw new Error('Expected seeded Crypto category');
    }

    const amountCents = 123_456_789;

    const snapshot = upsertSnapshot(db, {
      date: '2026-05-01',
      values: [{ categoryId: crypto.id, amountCents }],
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
        values: [{ categoryId: crypto.id, amountCents: 12.34 }],
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
