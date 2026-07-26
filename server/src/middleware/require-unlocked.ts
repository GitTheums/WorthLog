import type { NextFunction, Request, Response } from 'express';
import type Database from 'better-sqlite3';
import { getSecuritySettings } from '../db/repositories/security.js';
import { sendError } from '../http/response.js';
import { getSessionTokenFromRequest } from '../security/cookies.js';
import { validateSessionToken } from '../security/sessions.js';

declare module 'express-serve-static-core' {
  interface Request {
    worthlogUnlocked?: boolean;
    worthlogSessionExpiresAt?: Date | null;
  }
}

export function createRequireUnlockedMiddleware(db: Database.Database) {
  return function requireUnlocked(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const security = getSecuritySettings(db);
    if (!security.pinEnabled) {
      req.worthlogUnlocked = true;
      req.worthlogSessionExpiresAt = null;
      next();
      return;
    }

    const token = getSessionTokenFromRequest(req);
    const session = validateSessionToken(token);
    if (!session.valid) {
      sendError(res, 401, 'PORTFOLIO_LOCKED', 'WorthLog is locked.');
      return;
    }

    req.worthlogUnlocked = true;
    req.worthlogSessionExpiresAt = session.expiresAt;
    next();
  };
}
