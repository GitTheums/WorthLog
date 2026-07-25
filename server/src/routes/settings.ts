import type Database from 'better-sqlite3';
import { Router } from 'express';
import {
  getAppSettings,
  updateAppSettings,
} from '../db/repositories/settings.js';
import { sendData } from '../http/response.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { patchSettingsBodySchema } from '../validation/schemas.js';

export function createSettingsRouter(db: Database.Database): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler((_req, res) => {
      sendData(res, getAppSettings(db));
    }),
  );

  router.patch(
    '/',
    asyncHandler((req, res) => {
      const body = patchSettingsBodySchema.parse(req.body);
      const patch: {
        currency?: string;
        defaultRange?: '1m' | '3m' | '1y' | 'all';
      } = {};

      if (body.currency !== undefined) {
        patch.currency = body.currency;
      }
      if (body.defaultRange !== undefined) {
        patch.defaultRange = body.defaultRange;
      }

      sendData(res, updateAppSettings(db, patch));
    }),
  );

  return router;
}
