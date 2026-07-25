import type Database from 'better-sqlite3';
import { Router } from 'express';
import { getAppVersion } from '../version.js';

export function createHealthRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    const version = getAppVersion();

    try {
      const row = db.prepare('SELECT 1 AS ok').get() as { ok: number } | undefined;

      if (row?.ok !== 1) {
        res.status(503).json({
          status: 'error',
          database: 'unavailable',
          version,
        });
        return;
      }

      res.status(200).json({
        status: 'ok',
        database: 'ok',
        version,
      });
    } catch {
      res.status(503).json({
        status: 'error',
        database: 'unavailable',
        version,
      });
    }
  });

  return router;
}
