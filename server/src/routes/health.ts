import { Router } from 'express';
import { getAppVersion } from '../version.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    database: 'not_initialized',
    version: getAppVersion(),
  });
});
