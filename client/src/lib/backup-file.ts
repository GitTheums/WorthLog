import { format } from 'date-fns';
import type { BackupExport } from '../api/types';

export function buildBackupFilename(date = new Date()): string {
  return `worthlog-backup-${format(date, 'yyyy-MM-dd')}.json`;
}

export function downloadBackupJson(
  backup: BackupExport,
  filename = buildBackupFilename(),
): void {
  const blob = new Blob([`${JSON.stringify(backup, null, 2)}\n`], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function isBackupExport(value: unknown): value is BackupExport {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as {
    version?: unknown;
    exportedAt?: unknown;
    settings?: unknown;
    categories?: unknown;
    snapshots?: unknown;
  };

  return (
    candidate.version === 1 &&
    typeof candidate.exportedAt === 'string' &&
    Array.isArray(candidate.settings) &&
    Array.isArray(candidate.categories) &&
    Array.isArray(candidate.snapshots)
  );
}
