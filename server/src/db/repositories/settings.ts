import type Database from 'better-sqlite3';
import { ValidationError } from '../errors.js';
import { mapSetting, type SettingRow } from '../mappers.js';
import type { AppSettings, DashboardRange, Setting } from '../types.js';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  currency: 'EUR',
  defaultRange: '3m',
};

const DASHBOARD_RANGES = new Set<DashboardRange>(['1m', '3m', '1y', 'all']);

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

function isDashboardRange(value: string): value is DashboardRange {
  return DASHBOARD_RANGES.has(value as DashboardRange);
}

export function getAppSettings(db: Database.Database): AppSettings {
  const currency = getSetting(db, 'currency')?.value;
  const defaultRange = getSetting(db, 'defaultRange')?.value;

  return {
    currency: currency && currency.length > 0 ? currency : DEFAULT_APP_SETTINGS.currency,
    defaultRange:
      defaultRange && isDashboardRange(defaultRange)
        ? defaultRange
        : DEFAULT_APP_SETTINGS.defaultRange,
  };
}

export function updateAppSettings(
  db: Database.Database,
  patch: Partial<AppSettings>,
): AppSettings {
  if (patch.currency !== undefined) {
    if (patch.currency.trim().length === 0) {
      throw new ValidationError('currency must not be empty');
    }
    setSetting(db, 'currency', patch.currency.trim().toUpperCase());
  }

  if (patch.defaultRange !== undefined) {
    if (!isDashboardRange(patch.defaultRange)) {
      throw new ValidationError(
        'defaultRange must be one of: 1m, 3m, 1y, all',
      );
    }
    setSetting(db, 'defaultRange', patch.defaultRange);
  }

  return getAppSettings(db);
}
