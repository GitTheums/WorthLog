import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { SnapshotNotFoundError, UniqueConstraintError } from '../errors.js';
import {
  mapSnapshot,
  mapSnapshotValue,
  type SnapshotRow,
  type SnapshotValueRow,
} from '../mappers.js';
import type {
  Snapshot,
  SnapshotValue,
  SnapshotWithValues,
  UpsertSnapshotInput,
} from '../types.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function assertValidDate(date: string): void {
  if (!DATE_PATTERN.test(date)) {
    throw new Error(`Snapshot date must be YYYY-MM-DD, received "${date}"`);
  }
}

function assertIntegerCents(amountCents: number): void {
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new Error(
      `amountCents must be a non-negative integer, received ${String(amountCents)}`,
    );
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
      error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY')
  );
}

export function listSnapshots(db: Database.Database): Snapshot[] {
  const rows = db
    .prepare(
      `
        SELECT id, date, created_at, updated_at
        FROM snapshots
        ORDER BY date ASC
      `,
    )
    .all() as SnapshotRow[];

  return rows.map(mapSnapshot);
}

export function getSnapshotById(
  db: Database.Database,
  id: string,
): Snapshot | null {
  const row = db
    .prepare(
      `
        SELECT id, date, created_at, updated_at
        FROM snapshots
        WHERE id = ?
      `,
    )
    .get(id) as SnapshotRow | undefined;

  return row ? mapSnapshot(row) : null;
}

export function getSnapshotByDate(
  db: Database.Database,
  date: string,
): Snapshot | null {
  assertValidDate(date);

  const row = db
    .prepare(
      `
        SELECT id, date, created_at, updated_at
        FROM snapshots
        WHERE date = ?
      `,
    )
    .get(date) as SnapshotRow | undefined;

  return row ? mapSnapshot(row) : null;
}

export function listSnapshotValues(
  db: Database.Database,
  snapshotId: string,
): SnapshotValue[] {
  const rows = db
    .prepare(
      `
        SELECT id, snapshot_id, category_id, amount_cents, created_at, updated_at
        FROM snapshot_values
        WHERE snapshot_id = ?
        ORDER BY category_id ASC
      `,
    )
    .all(snapshotId) as SnapshotValueRow[];

  return rows.map(mapSnapshotValue);
}

export function getSnapshotWithValues(
  db: Database.Database,
  snapshotId: string,
): SnapshotWithValues | null {
  const snapshot = getSnapshotById(db, snapshotId);
  if (!snapshot) {
    return null;
  }

  return {
    ...snapshot,
    values: listSnapshotValues(db, snapshotId),
  };
}

export function getSnapshotWithValuesByDate(
  db: Database.Database,
  date: string,
): SnapshotWithValues | null {
  const snapshot = getSnapshotByDate(db, date);
  if (!snapshot) {
    return null;
  }

  return {
    ...snapshot,
    values: listSnapshotValues(db, snapshot.id),
  };
}

export function upsertSnapshot(
  db: Database.Database,
  input: UpsertSnapshotInput,
): SnapshotWithValues {
  assertValidDate(input.date);

  for (const value of input.values) {
    assertIntegerCents(value.amountCents);
  }

  const run = db.transaction((payload: UpsertSnapshotInput) => {
    const now = new Date().toISOString();
    const existing = db
      .prepare(
        `
          SELECT id, date, created_at, updated_at
          FROM snapshots
          WHERE date = ?
        `,
      )
      .get(payload.date) as SnapshotRow | undefined;

    let snapshotId: string;

    if (existing) {
      snapshotId = existing.id;
      db.prepare(
        `
          UPDATE snapshots
          SET updated_at = ?
          WHERE id = ?
        `,
      ).run(now, snapshotId);

      db.prepare('DELETE FROM snapshot_values WHERE snapshot_id = ?').run(
        snapshotId,
      );
    } else {
      snapshotId = randomUUID();

      try {
        db.prepare(
          `
            INSERT INTO snapshots (id, date, created_at, updated_at)
            VALUES (?, ?, ?, ?)
          `,
        ).run(snapshotId, payload.date, now, now);
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new UniqueConstraintError(
            `A snapshot for date "${payload.date}" already exists`,
          );
        }
        throw error;
      }
    }

    const insertValue = db.prepare(
      `
        INSERT INTO snapshot_values (
          id, snapshot_id, category_id, amount_cents, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
    );

    for (const value of payload.values) {
      insertValue.run(
        randomUUID(),
        snapshotId,
        value.categoryId,
        value.amountCents,
        now,
        now,
      );
    }

    const result = getSnapshotWithValues(db, snapshotId);
    if (!result) {
      throw new SnapshotNotFoundError(snapshotId);
    }
    return result;
  });

  return run(input);
}

export function listAllSnapshotValues(
  db: Database.Database,
): SnapshotValue[] {
  const rows = db
    .prepare(
      `
        SELECT id, snapshot_id, category_id, amount_cents, created_at, updated_at
        FROM snapshot_values
        ORDER BY created_at ASC
      `,
    )
    .all() as SnapshotValueRow[];

  return rows.map(mapSnapshotValue);
}
