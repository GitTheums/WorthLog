import type { Migration } from '../migrate.js';

/**
 * Singleton security settings for optional portfolio PIN protection.
 * No PIN is enabled by default.
 */
export const migration003SecuritySettings: Migration = {
  version: 3,
  name: 'security_settings',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS security_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        pin_enabled INTEGER NOT NULL DEFAULT 0 CHECK (pin_enabled IN (0, 1)),
        pin_hash TEXT,
        pin_salt TEXT,
        pin_kdf TEXT,
        pin_updated_at TEXT
      );

      INSERT OR IGNORE INTO security_settings (
        id, pin_enabled, pin_hash, pin_salt, pin_kdf, pin_updated_at
      ) VALUES (1, 0, NULL, NULL, NULL, NULL);
    `);
  },
};
