import type Database from 'better-sqlite3';

export interface SecuritySettingsRow {
  id: number;
  pin_enabled: number;
  pin_hash: string | null;
  pin_salt: string | null;
  pin_kdf: string | null;
  pin_updated_at: string | null;
}

export interface SecuritySettings {
  pinEnabled: boolean;
  pinHash: string | null;
  pinSalt: string | null;
  pinKdf: string | null;
  pinUpdatedAt: string | null;
}

function mapRow(row: SecuritySettingsRow): SecuritySettings {
  return {
    pinEnabled: row.pin_enabled === 1,
    pinHash: row.pin_hash,
    pinSalt: row.pin_salt,
    pinKdf: row.pin_kdf,
    pinUpdatedAt: row.pin_updated_at,
  };
}

function ensureSingleton(db: Database.Database): void {
  db.prepare(
    `
      INSERT OR IGNORE INTO security_settings (
        id, pin_enabled, pin_hash, pin_salt, pin_kdf, pin_updated_at
      ) VALUES (1, 0, NULL, NULL, NULL, NULL)
    `,
  ).run();
}

export function getSecuritySettings(db: Database.Database): SecuritySettings {
  ensureSingleton(db);
  const row = db
    .prepare(
      `
        SELECT id, pin_enabled, pin_hash, pin_salt, pin_kdf, pin_updated_at
        FROM security_settings
        WHERE id = 1
      `,
    )
    .get() as SecuritySettingsRow | undefined;

  if (!row) {
    return {
      pinEnabled: false,
      pinHash: null,
      pinSalt: null,
      pinKdf: null,
      pinUpdatedAt: null,
    };
  }

  return mapRow(row);
}

export function setPinCredentials(
  db: Database.Database,
  input: {
    pinHash: string;
    pinSalt: string;
    pinKdf: string;
  },
): SecuritySettings {
  ensureSingleton(db);
  const now = new Date().toISOString();

  db.prepare(
    `
      UPDATE security_settings
      SET
        pin_enabled = 1,
        pin_hash = ?,
        pin_salt = ?,
        pin_kdf = ?,
        pin_updated_at = ?
      WHERE id = 1
    `,
  ).run(input.pinHash, input.pinSalt, input.pinKdf, now);

  return getSecuritySettings(db);
}

export function clearPinCredentials(db: Database.Database): SecuritySettings {
  ensureSingleton(db);

  db.prepare(
    `
      UPDATE security_settings
      SET
        pin_enabled = 0,
        pin_hash = NULL,
        pin_salt = NULL,
        pin_kdf = NULL,
        pin_updated_at = NULL
      WHERE id = 1
    `,
  ).run();

  return getSecuritySettings(db);
}
