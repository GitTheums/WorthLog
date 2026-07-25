import { describe, expect, it } from 'vitest';
import { buildBackupFilename, isBackupExport } from './backup-file';
import { backupFixture } from '../test/mock-api';

describe('backup-file', () => {
  it('builds a dated export filename', () => {
    expect(buildBackupFilename(new Date(2026, 6, 25))).toBe(
      'worthlog-backup-2026-07-25.json',
    );
  });

  it('accepts version 1 backup payloads', () => {
    expect(isBackupExport(backupFixture)).toBe(true);
  });

  it('rejects invalid backup payloads', () => {
    expect(isBackupExport({ version: 2 })).toBe(false);
    expect(isBackupExport({ version: 1, exportedAt: 'x' })).toBe(false);
    expect(isBackupExport(null)).toBe(false);
  });
});
