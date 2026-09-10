import type Database from 'better-sqlite3';
import { Router } from 'express';
import { sendData } from '../http/response.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { getDashboard } from '../services/dashboard.js';
import { dashboardRangeSchema } from '../validation/schemas.js';

export function createDashboardRouter(db: Database.Database): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler((req, res) => {
      const range = dashboardRangeSchema.parse(req.query['range'] ?? 'all');
      sendData(res, getDashboard(db, range));
    }),
  );

  return router;
}
