import { existsSync } from 'node:fs';
import { join } from 'node:path';
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
  /** Absolute path to the Vite client build output (`index.html` + assets). */
  clientDistDir?: string;
}

function isApiPath(path: string): boolean {
  return path === '/api' || path.startsWith('/api/');
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

  const clientDistDir = options.clientDistDir;
  if (clientDistDir && existsSync(join(clientDistDir, 'index.html'))) {
    app.use(
      express.static(clientDistDir, {
        index: false,
        fallthrough: true,
      }),
    );

    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next();
        return;
      }

      if (isApiPath(req.path)) {
        next();
        return;
      }

      res.sendFile(
        join(clientDistDir, 'index.html'),
        (error: Error | undefined) => {
          if (error !== undefined) {
            next(error);
          }
        },
      );
    });
  }

  app.use(errorHandler);

  return app;
}
