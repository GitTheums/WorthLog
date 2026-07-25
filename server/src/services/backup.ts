import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { ValidationError } from '../db/errors.js';
import { getDatabasePath } from '../db/open-database.js';
import { listCategories } from '../db/repositories/categories.js';
import { listSettings } from '../db/repositories/settings.js';
import {
  listAllSnapshotValues,
  listSnapshots,
} from '../db/repositories/snapshots.js';
import type { BackupExport } from '../validation/schemas.js';
import { backupExportSchema } from '../validation/schemas.js';

export function exportBackup(db: Database.Database): BackupExport {
  const categories = listCategories(db, { includeArchived: true });
  const settings = listSettings(db);
  const snapshots = listSnapshots(db);
  const values = listAllSnapshotValues(db);

  const valuesBySnapshotId = new Map<string, typeof values>();
  for (const value of values) {
    const existing = valuesBySnapshotId.get(value.snapshotId) ?? [];
    existing.push(value);
    valuesBySnapshotId.set(value.snapshotId, existing);
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: settings.map((setting) => ({
      key: setting.key,
      value: setting.value,
      createdAt: setting.createdAt,
      updatedAt: setting.updatedAt,
    })),
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
      sortOrder: category.sortOrder,
      archivedAt: category.archivedAt,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    })),
    snapshots: snapshots.map((snapshot) => ({
      id: snapshot.id,
      date: snapshot.date,
      note: snapshot.note,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
      values: (valuesBySnapshotId.get(snapshot.id) ?? []).map((value) => ({
        id: value.id,
        snapshotId: value.snapshotId,
        categoryId: value.categoryId,
        amountCents: value.amountCents,
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
      })),
    })),
  };
}

function createTimestampedBackupFile(dataDir: string, db: Database.Database): string {
  const timestamp = new Date().toISOString().replaceAll(':', '-');
  const backupPath = join(dataDir, `worthlog.backup.${timestamp}.db`);
  const sourcePath = getDatabasePath(dataDir);

  if (!existsSync(sourcePath)) {
    throw new ValidationError('Database file was not found for backup');
  }

  db.pragma('wal_checkpoint(FULL)');
  copyFileSync(sourcePath, backupPath);
  return backupPath;
}

export function importBackup(
  db: Database.Database,
  dataDir: string,
  payload: unknown,
): { backupPath: string; imported: BackupExport } {
  const parsed = backupExportSchema.parse(payload);
  const backupPath = createTimestampedBackupFile(dataDir, db);

  const run = db.transaction((data: BackupExport) => {
    db.prepare('DELETE FROM snapshot_values').run();
    db.prepare('DELETE FROM snapshots').run();
    db.prepare('DELETE FROM categories').run();
    db.prepare('DELETE FROM settings').run();

    const insertSetting = db.prepare(
      `
        INSERT INTO settings (key, value, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `,
    );
    const insertCategory = db.prepare(
      `
        INSERT INTO categories (
          id, name, color, icon, sort_order, archived_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
    );
    const insertSnapshot = db.prepare(
      `
        INSERT INTO snapshots (id, date, note, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `,
    );
    const insertValue = db.prepare(
      `
        INSERT INTO snapshot_values (
          id, snapshot_id, category_id, amount_cents, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
    );

    for (const setting of data.settings) {
      insertSetting.run(
        setting.key,
        setting.value,
        setting.createdAt,
        setting.updatedAt,
      );
    }

    for (const category of data.categories) {
      insertCategory.run(
        category.id,
        category.name,
        category.color,
        category.icon,
        category.sortOrder,
        category.archivedAt,
        category.createdAt,
        category.updatedAt,
      );
    }

    for (const snapshot of data.snapshots) {
      insertSnapshot.run(
        snapshot.id,
        snapshot.date,
        snapshot.note,
        snapshot.createdAt,
        snapshot.updatedAt,
      );

      for (const value of snapshot.values) {
        if (value.snapshotId !== snapshot.id) {
          throw new ValidationError(
            `Snapshot value ${value.id} does not belong to snapshot ${snapshot.id}`,
          );
        }

        insertValue.run(
          value.id,
          value.snapshotId,
          value.categoryId,
          value.amountCents,
          value.createdAt,
          value.updatedAt,
        );
      }
    }
  });

  run(parsed);

  return { backupPath, imported: parsed };
}
