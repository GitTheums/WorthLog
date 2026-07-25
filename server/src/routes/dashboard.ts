import type Database from 'better-sqlite3';
import { Router } from 'express';
import { getAppSettings } from '../db/repositories/settings.js';
import { sendData } from '../http/response.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { getDashboard } from '../services/dashboard.js';
import { dashboardRangeSchema } from '../validation/schemas.js';

export function createDashboardRouter(db: Database.Database): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler((req, res) => {
      const settings = getAppSettings(db);
      const range = dashboardRangeSchema.parse(
        req.query['range'] ?? settings.defaultRange,
      );
      sendData(res, getDashboard(db, range));
    }),
  );

  return router;
}
