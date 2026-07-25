import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import {
  SnapshotNotFoundError,
  UniqueConstraintError,
  ValidationError,
} from '../errors.js';
import {
  mapSnapshot,
  mapSnapshotValue,
  totalValueCents,
  type SnapshotRow,
  type SnapshotValueRow,
} from '../mappers.js';
import type {
  ListSnapshotsOptions,
  Snapshot,
  SnapshotValue,
  SnapshotWithDetails,
  SnapshotWithValues,
  UpsertSnapshotInput,
} from '../types.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const SNAPSHOT_SELECT = `
  SELECT id, date, note, created_at, updated_at
  FROM snapshots
`;

function isValidCalendarDate(date: string): boolean {
  const [yearText, monthText, dayText] = date.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return false;
  }

  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function assertValidDate(date: string): void {
  if (!DATE_PATTERN.test(date) || !isValidCalendarDate(date)) {
    throw new ValidationError(
      `Snapshot date must be a valid YYYY-MM-DD calendar date, received "${date}"`,
    );
  }
}

function assertIntegerCents(amountCents: number): void {
  if (
    !Number.isInteger(amountCents) ||
    amountCents < 0 ||
    amountCents > Number.MAX_SAFE_INTEGER
  ) {
    throw new ValidationError(
      `amountCents must be a non-negative safe integer, received ${String(amountCents)}`,
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

function withDetails(snapshot: SnapshotWithValues): SnapshotWithDetails {
  return {
    ...snapshot,
    totalValueCents: totalValueCents(snapshot.values),
  };
}

export function listSnapshots(
  db: Database.Database,
  options: ListSnapshotsOptions = {},
): Snapshot[] {
  if (options.from !== undefined) {
    assertValidDate(options.from);
  }
  if (options.to !== undefined) {
    assertValidDate(options.to);
  }

  const clauses: string[] = [];
  const params: string[] = [];

  if (options.from !== undefined) {
    clauses.push('date >= ?');
    params.push(options.from);
  }
  if (options.to !== undefined) {
    clauses.push('date <= ?');
    params.push(options.to);
  }

  const where =
    clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

  const rows = db
    .prepare(
      `
        ${SNAPSHOT_SELECT}
        ${where}
        ORDER BY date ASC
      `,
    )
    .all(...params) as SnapshotRow[];

  return rows.map(mapSnapshot);
}

export function getSnapshotById(
  db: Database.Database,
  id: string,
): Snapshot | null {
  const row = db
    .prepare(
      `
        ${SNAPSHOT_SELECT}
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
        ${SNAPSHOT_SELECT}
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

export function getSnapshotDetailsByDate(
  db: Database.Database,
  date: string,
): SnapshotWithDetails | null {
  const snapshot = getSnapshotWithValuesByDate(db, date);
  return snapshot ? withDetails(snapshot) : null;
}

export function listSnapshotDetails(
  db: Database.Database,
  options: ListSnapshotsOptions = {},
): SnapshotWithDetails[] {
  return listSnapshots(db, options).map((snapshot) => {
    const values = listSnapshotValues(db, snapshot.id);
    return withDetails({ ...snapshot, values });
  });
}

export function upsertSnapshot(
  db: Database.Database,
  input: UpsertSnapshotInput,
): SnapshotWithDetails {
  assertValidDate(input.date);

  for (const value of input.values) {
    assertIntegerCents(value.amountCents);
  }

  const run = db.transaction((payload: UpsertSnapshotInput) => {
    const now = new Date().toISOString();
    const note = payload.note ?? null;
    const existing = db
      .prepare(
        `
          ${SNAPSHOT_SELECT}
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
          SET note = ?, updated_at = ?
          WHERE id = ?
        `,
      ).run(note, now, snapshotId);

      db.prepare('DELETE FROM snapshot_values WHERE snapshot_id = ?').run(
        snapshotId,
      );
    } else {
      snapshotId = randomUUID();

      try {
        db.prepare(
          `
            INSERT INTO snapshots (id, date, note, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
          `,
        ).run(snapshotId, payload.date, note, now, now);
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
    return withDetails(result);
  });

  return run(input);
}

export function deleteSnapshotByDate(
  db: Database.Database,
  date: string,
): void {
  assertValidDate(date);

  const result = db.prepare('DELETE FROM snapshots WHERE date = ?').run(date);
  if (result.changes === 0) {
    throw new SnapshotNotFoundError(date);
  }
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
