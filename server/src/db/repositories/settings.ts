import type Database from 'better-sqlite3';
import { mapSetting, type SettingRow } from '../mappers.js';
import type { Setting } from '../types.js';

export function listSettings(db: Database.Database): Setting[] {
  const rows = db
    .prepare(
      `
        SELECT key, value, created_at, updated_at
        FROM settings
        ORDER BY key ASC
      `,
    )
    .all() as SettingRow[];

  return rows.map(mapSetting);
}

export function getSetting(
  db: Database.Database,
  key: string,
): Setting | null {
  const row = db
    .prepare(
      `
        SELECT key, value, created_at, updated_at
        FROM settings
        WHERE key = ?
      `,
    )
    .get(key) as SettingRow | undefined;

  return row ? mapSetting(row) : null;
}

export function setSetting(
  db: Database.Database,
  key: string,
  value: string,
): Setting {
  const now = new Date().toISOString();
  const existing = getSetting(db, key);

  if (existing) {
    db.prepare(
      `
        UPDATE settings
        SET value = ?, updated_at = ?
        WHERE key = ?
      `,
    ).run(value, now, key);
  } else {
    db.prepare(
      `
        INSERT INTO settings (key, value, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `,
    ).run(key, value, now, now);
  }

  const setting = getSetting(db, key);
  if (!setting) {
    throw new Error(`Failed to persist setting "${key}"`);
  }
  return setting;
}

export function deleteSetting(db: Database.Database, key: string): boolean {
  const result = db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  return result.changes > 0;
}
