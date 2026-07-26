import type Database from 'better-sqlite3';
import { Router, type RequestHandler } from 'express';
import {
  clearPinCredentials,
  getSecuritySettings,
  setPinCredentials,
} from '../db/repositories/security.js';
import { sendData, sendError } from '../http/response.js';
import { asyncHandler } from '../middleware/async-handler.js';
import {
  authPinRateLimiter,
  authStatusRateLimiter,
} from '../middleware/rateLimits.js';
import { createRequireUnlockedMiddleware } from '../middleware/require-unlocked.js';
import {
  clearSessionCookie,
  getSessionTokenFromRequest,
  setSessionCookie,
} from '../security/cookies.js';
import {
  getClientKey,
  getUnlockBlock,
  registerUnlockFailure,
  resetUnlockFailures,
} from '../security/pin-rate-limit.js';
import {
  hashPin,
  isValidPinFormat,
  verifyPin,
} from '../security/pin-crypto.js';
import {
  createSession,
  invalidateAllSessions,
  invalidateSessionToken,
  validateSessionToken,
} from '../security/sessions.js';
import {
  changePinBodySchema,
  pinBodySchema,
  removePinBodySchema,
} from '../validation/schemas.js';

function issueSession(
  req: Parameters<typeof setSessionCookie>[0],
  res: Parameters<typeof setSessionCookie>[1],
) {
  const session = createSession();
  setSessionCookie(req, res, session.token, session.expiresAt);
  return session;
}

export interface AuthRateLimiters {
  authStatusRateLimiter: RequestHandler;
  authPinRateLimiter: RequestHandler;
}

export function createAuthRouter(
  db: Database.Database,
  limiters: AuthRateLimiters = {
    authStatusRateLimiter,
    authPinRateLimiter,
  },
): Router {
  const router = Router();
  const requireUnlocked = createRequireUnlockedMiddleware(db);

  router.get(
    '/status',
    limiters.authStatusRateLimiter,
    asyncHandler((req, res) => {
      const security = getSecuritySettings(db);
      if (!security.pinEnabled) {
        sendData(res, {
          pinEnabled: false,
          unlocked: true,
          sessionExpiresAt: null,
        });
        return;
      }

      const token = getSessionTokenFromRequest(req);
      const session = validateSessionToken(token);
      sendData(res, {
        pinEnabled: true,
        unlocked: session.valid,
        sessionExpiresAt: session.expiresAt
          ? session.expiresAt.toISOString()
          : null,
      });
    }),
  );

  router.post(
    '/setup',
    limiters.authPinRateLimiter,
    asyncHandler((req, res) => {
      const security = getSecuritySettings(db);
      if (security.pinEnabled) {
        sendError(
          res,
          409,
          'PIN_ALREADY_SET',
          'A PIN is already configured. Unlock and change or remove it instead.',
        );
        return;
      }

      const body = pinBodySchema.parse(req.body);
      if (!isValidPinFormat(body.pin)) {
        sendError(
          res,
          400,
          'VALIDATION_ERROR',
          'PIN must be 4 to 8 numeric digits.',
        );
        return;
      }

      const hashed = hashPin(body.pin);
      setPinCredentials(db, {
        pinHash: hashed.hashHex,
        pinSalt: hashed.saltHex,
        pinKdf: hashed.kdf,
      });

      invalidateAllSessions();
      const session = issueSession(req, res);

      sendData(res, {
        pinEnabled: true,
        unlocked: true,
        sessionExpiresAt: session.expiresAt.toISOString(),
      });
    }),
  );

  router.post(
    '/unlock',
    limiters.authPinRateLimiter,
    asyncHandler((req, res) => {
      const security = getSecuritySettings(db);
      if (!security.pinEnabled || !security.pinHash || !security.pinSalt) {
        sendError(res, 400, 'PIN_NOT_SET', 'No PIN is configured.');
        return;
      }

      const clientKey = getClientKey(req.ip);
      const block = getUnlockBlock(clientKey);
      if (block.blocked) {
        sendError(
          res,
          429,
          'TOO_MANY_ATTEMPTS',
          'Too many attempts. Try again later.',
          { retryAfterSeconds: block.retryAfterSeconds },
        );
        return;
      }

      const body = pinBodySchema.parse(req.body);
      const ok = verifyPin(body.pin, security.pinHash, security.pinSalt);
      if (!ok) {
        const afterFailure = registerUnlockFailure(clientKey);
        if (afterFailure.blocked) {
          sendError(
            res,
            429,
            'TOO_MANY_ATTEMPTS',
            'Too many attempts. Try again later.',
            { retryAfterSeconds: afterFailure.retryAfterSeconds },
          );
          return;
        }

        sendError(res, 401, 'INVALID_PIN', 'That PIN is incorrect.');
        return;
      }

      resetUnlockFailures(clientKey);
      const session = issueSession(req, res);
      sendData(res, {
        pinEnabled: true,
        unlocked: true,
        sessionExpiresAt: session.expiresAt.toISOString(),
      });
    }),
  );

  router.post(
    '/lock',
    limiters.authStatusRateLimiter,
    asyncHandler((req, res) => {
      const token = getSessionTokenFromRequest(req);
      invalidateSessionToken(token);
      clearSessionCookie(req, res);
      sendData(res, { locked: true });
    }),
  );

  router.post(
    '/change-pin',
    limiters.authPinRateLimiter,
    requireUnlocked,
    asyncHandler((req, res) => {
      const security = getSecuritySettings(db);
      if (!security.pinEnabled || !security.pinHash || !security.pinSalt) {
        sendError(res, 400, 'PIN_NOT_SET', 'No PIN is configured.');
        return;
      }

      const body = changePinBodySchema.parse(req.body);
      if (!isValidPinFormat(body.currentPin) || !isValidPinFormat(body.newPin)) {
        sendError(
          res,
          400,
          'VALIDATION_ERROR',
          'PIN must be 4 to 8 numeric digits.',
        );
        return;
      }

      if (body.currentPin === body.newPin) {
        sendError(
          res,
          400,
          'VALIDATION_ERROR',
          'New PIN must be different from the current PIN.',
        );
        return;
      }

      const currentOk = verifyPin(
        body.currentPin,
        security.pinHash,
        security.pinSalt,
      );
      if (!currentOk) {
        sendError(res, 401, 'INVALID_PIN', 'That PIN is incorrect.');
        return;
      }

      const hashed = hashPin(body.newPin);
      const run = db.transaction(() => {
        setPinCredentials(db, {
          pinHash: hashed.hashHex,
          pinSalt: hashed.saltHex,
          pinKdf: hashed.kdf,
        });
      });
      run();

      invalidateAllSessions();
      const session = issueSession(req, res);
      sendData(res, {
        pinEnabled: true,
        unlocked: true,
        sessionExpiresAt: session.expiresAt.toISOString(),
      });
    }),
  );

  router.delete(
    '/pin',
    limiters.authPinRateLimiter,
    requireUnlocked,
    asyncHandler((req, res) => {
      const security = getSecuritySettings(db);
      if (!security.pinEnabled || !security.pinHash || !security.pinSalt) {
        sendError(res, 400, 'PIN_NOT_SET', 'No PIN is configured.');
        return;
      }

      const body = removePinBodySchema.parse(req.body);
      if (!isValidPinFormat(body.currentPin)) {
        sendError(
          res,
          400,
          'VALIDATION_ERROR',
          'PIN must be 4 to 8 numeric digits.',
        );
        return;
      }

      const currentOk = verifyPin(
        body.currentPin,
        security.pinHash,
        security.pinSalt,
      );
      if (!currentOk) {
        sendError(res, 401, 'INVALID_PIN', 'That PIN is incorrect.');
        return;
      }

      const run = db.transaction(() => {
        clearPinCredentials(db);
      });
      run();

      invalidateAllSessions();
      clearSessionCookie(req, res);
      sendData(res, {
        pinEnabled: false,
        unlocked: true,
        sessionExpiresAt: null,
      });
    }),
  );

  return router;
}
