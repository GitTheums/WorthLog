import type { Request, Response, NextFunction } from 'express';
import {
  rateLimit,
  type AugmentedRequest,
  type Options,
  type RateLimitRequestHandler,
} from 'express-rate-limit';
import { sendError } from '../http/response.js';

export interface RateLimiterWindow {
  windowMs: number;
  limit: number;
}

export interface RateLimiterConfig {
  portfolioApi: RateLimiterWindow;
  authStatus: RateLimiterWindow;
  authPin: RateLimiterWindow;
  health: RateLimiterWindow;
  spaFallback: RateLimiterWindow;
}

export const DEFAULT_RATE_LIMITER_CONFIG: RateLimiterConfig = {
  /** Normal portfolio reads/writes (dashboard, snapshots, categories, …). */
  portfolioApi: {
    windowMs: 15 * 60 * 1000,
    limit: 500,
  },
  /** Frontend boot / refresh checks. */
  authStatus: {
    windowMs: 60 * 1000,
    limit: 120,
  },
  /** PIN setup, unlock, change, and remove — request volume only. */
  authPin: {
    windowMs: 15 * 60 * 1000,
    limit: 20,
  },
  /** Monitoring-friendly health checks (Docker + Uptime Kuma). */
  health: {
    windowMs: 60 * 1000,
    limit: 120,
  },
  /** SPA index.html fallback only (not CSS/JS/static assets). */
  spaFallback: {
    windowMs: 60 * 1000,
    limit: 120,
  },
};

export interface AppRateLimiters {
  portfolioApiRateLimiter: RateLimitRequestHandler;
  authStatusRateLimiter: RateLimitRequestHandler;
  authPinRateLimiter: RateLimitRequestHandler;
  healthRateLimiter: RateLimitRequestHandler;
  spaFallbackRateLimiter: RateLimitRequestHandler;
}

function safeRetryAfterSeconds(req: Request, windowMs: number): number {
  const resetTime = (req as AugmentedRequest)['rateLimit']?.resetTime;
  if (resetTime instanceof Date && !Number.isNaN(resetTime.getTime())) {
    const seconds = Math.ceil((resetTime.getTime() - Date.now()) / 1000);
    if (Number.isFinite(seconds) && seconds > 0) {
      return seconds;
    }
  }

  const fallback = Math.ceil(windowMs / 1000);
  if (!Number.isFinite(fallback) || fallback < 1) {
    return 1;
  }
  return fallback;
}

function createSharedOptions(
  window: RateLimiterWindow,
  identifier: string,
): Partial<Options> {
  return {
    windowMs: window.windowMs,
    limit: window.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // Keep default IP key generation (IPv6-safe). Do not invent a custom keyGenerator.
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    // Trust-proxy is configured explicitly on the Express app; do not fail when
    // clients send untrusted X-Forwarded-For on direct LAN access.
    validate: {
      xForwardedForHeader: false,
    },
    identifier,
    handler: (req: Request, res: Response, _next: NextFunction, options) => {
      const retryAfterSeconds = safeRetryAfterSeconds(req, options.windowMs);
      res.setHeader('Retry-After', String(retryAfterSeconds));
      // Do not log request bodies, PINs, or client secrets.
      console.warn(
        `Rate limit exceeded for ${identifier} (${req.method} ${req.path})`,
      );
      sendError(
        res,
        429,
        'RATE_LIMITED',
        'Too many requests. Please try again later.',
        { retryAfterSeconds },
      );
    },
  };
}

export function createRateLimiters(
  overrides: Partial<RateLimiterConfig> = {},
): AppRateLimiters {
  const config: RateLimiterConfig = {
    portfolioApi: {
      ...DEFAULT_RATE_LIMITER_CONFIG.portfolioApi,
      ...overrides.portfolioApi,
    },
    authStatus: {
      ...DEFAULT_RATE_LIMITER_CONFIG.authStatus,
      ...overrides.authStatus,
    },
    authPin: {
      ...DEFAULT_RATE_LIMITER_CONFIG.authPin,
      ...overrides.authPin,
    },
    health: {
      ...DEFAULT_RATE_LIMITER_CONFIG.health,
      ...overrides.health,
    },
    spaFallback: {
      ...DEFAULT_RATE_LIMITER_CONFIG.spaFallback,
      ...overrides.spaFallback,
    },
  };

  return {
    portfolioApiRateLimiter: rateLimit(
      createSharedOptions(config.portfolioApi, 'portfolio-api'),
    ),
    authStatusRateLimiter: rateLimit(
      createSharedOptions(config.authStatus, 'auth-status'),
    ),
    authPinRateLimiter: rateLimit(
      createSharedOptions(config.authPin, 'auth-pin'),
    ),
    healthRateLimiter: rateLimit(
      createSharedOptions(config.health, 'health'),
    ),
    spaFallbackRateLimiter: rateLimit(
      createSharedOptions(config.spaFallback, 'spa-fallback'),
    ),
  };
}

/** Production / default limiters (in-memory store). */
export const {
  portfolioApiRateLimiter,
  authStatusRateLimiter,
  authPinRateLimiter,
  healthRateLimiter,
  spaFallbackRateLimiter,
} = createRateLimiters();
