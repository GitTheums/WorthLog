import type Database from 'better-sqlite3';
import express from 'express';
import { errorHandler } from './middleware/error-handler.js';
import { createBackupRouter } from './routes/backup.js';
import { createCategoriesRouter } from './routes/categories.js';
import { createDashboardRouter } from './routes/dashboard.js';
import { createHealthRouter } from './routes/health.js';
import { createSettingsRouter } from './routes/settings.js';
import { createSnapshotsRouter } from './routes/snapshots.js';

export interface AppOptions {
  dataDir: string;
}

export function createApp(db: Database.Database, options: AppOptions) {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '5mb' }));

  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.use('/api', createHealthRouter(db));
  app.use('/api/categories', createCategoriesRouter(db));
  app.use('/api/snapshots', createSnapshotsRouter(db));
  app.use('/api/dashboard', createDashboardRouter(db));
  app.use('/api/settings', createSettingsRouter(db));
  app.use('/api/backup', createBackupRouter(db, options.dataDir));

  app.use(errorHandler);

  return app;
}
