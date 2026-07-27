import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import express from 'express';
import { consoleLogger, type AppLogger } from './logging.js';
import { createErrorHandler } from './middleware/error-handler.js';
import {
  authPinRateLimiter,
  authStatusRateLimiter,
  createRateLimiters,
  healthRateLimiter,
  portfolioApiRateLimiter,
  spaFallbackRateLimiter,
  type AppRateLimiters,
} from './middleware/rateLimits.js';
import { createRequireUnlockedMiddleware } from './middleware/require-unlocked.js';
import { createAuthRouter } from './routes/auth.js';
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
  /**
   * Express trust proxy hop count, or false to ignore forwarded headers.
   * Default false — safe for direct LAN access.
   */
  trustProxy?: number | false;
  /** Optional rate limiter overrides (primarily for tests). */
  rateLimiters?: AppRateLimiters;
  /** Optional logger (tests may inject spies / silent sinks). */
  logger?: AppLogger;
}

function isApiPath(path: string): boolean {
  return path === '/api' || path.startsWith('/api/');
}

const defaultRateLimiters: AppRateLimiters = {
  portfolioApiRateLimiter,
  authStatusRateLimiter,
  authPinRateLimiter,
  healthRateLimiter,
  spaFallbackRateLimiter,
};

export function createApp(db: Database.Database, options: AppOptions) {
  const app = express();
  const requireUnlocked = createRequireUnlockedMiddleware(db);
  const logger = options.logger ?? consoleLogger;
  const limiters = options.rateLimiters ?? defaultRateLimiters;

  app.disable('x-powered-by');

  if (
    typeof options.trustProxy === 'number' &&
    Number.isInteger(options.trustProxy) &&
    options.trustProxy > 0
  ) {
    app.set('trust proxy', options.trustProxy);
  }

  app.use(express.json({ limit: '5mb' }));

  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // Public endpoints (dedicated limiters — not the portfolio API limiter)
  app.use('/api', createHealthRouter(db, limiters.healthRateLimiter));
  app.use(
    '/api/auth',
    createAuthRouter(db, {
      authStatusRateLimiter: limiters.authStatusRateLimiter,
      authPinRateLimiter: limiters.authPinRateLimiter,
    }),
  );

  // Portfolio endpoints — one portfolio limiter per mount (no nested duplicates)
  app.use(
    '/api/categories',
    limiters.portfolioApiRateLimiter,
    requireUnlocked,
    createCategoriesRouter(db),
  );
  app.use(
    '/api/snapshots',
    limiters.portfolioApiRateLimiter,
    requireUnlocked,
    createSnapshotsRouter(db),
  );
  app.use(
    '/api/dashboard',
    limiters.portfolioApiRateLimiter,
    requireUnlocked,
    createDashboardRouter(db),
  );
  app.use(
    '/api/settings',
    limiters.portfolioApiRateLimiter,
    requireUnlocked,
    createSettingsRouter(db),
  );
  app.use(
    '/api/backup',
    limiters.portfolioApiRateLimiter,
    requireUnlocked,
    createBackupRouter(db, options.dataDir),
  );

  const clientDistDir = options.clientDistDir;
  if (clientDistDir && existsSync(join(clientDistDir, 'index.html'))) {
    // Static assets (JS/CSS/favicon) — not rate-limited by the API limiter.
    app.use(
      express.static(clientDistDir, {
        index: false,
        fallthrough: true,
      }),
    );

    // SPA HTML fallback is a custom filesystem sendFile handler — rate-limit it.
    app.use(limiters.spaFallbackRateLimiter, (req, res, next) => {
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

  app.use(createErrorHandler(logger));

  return app;
}

/** Re-export for tests that need fresh limiter instances. */
export { createRateLimiters };
