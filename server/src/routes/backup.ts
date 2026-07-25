import type Database from 'better-sqlite3';
import { Router } from 'express';
import { sendData } from '../http/response.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { exportBackup, importBackup } from '../services/backup.js';

export function createBackupRouter(
  db: Database.Database,
  dataDir: string,
): Router {
  const router = Router();

  router.get(
    '/export',
    asyncHandler((_req, res) => {
      sendData(res, exportBackup(db));
    }),
  );

  router.post(
    '/import',
    asyncHandler((req, res) => {
      const result = importBackup(db, dataDir, req.body);
      sendData(res, {
        backupPath: result.backupPath,
        importedAt: new Date().toISOString(),
        counts: {
          settings: result.imported.settings.length,
          categories: result.imported.categories.length,
          snapshots: result.imported.snapshots.length,
          values: result.imported.snapshots.reduce(
            (sum, snapshot) => sum + snapshot.values.length,
            0,
          ),
        },
      });
    }),
  );

  return router;
}
