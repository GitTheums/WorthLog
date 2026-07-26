import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE_NAME = 'worthlog_session';
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

interface SessionRecord {
  tokenHash: string;
  expiresAt: number;
  createdAt: number;
}

const sessions = new Map<string, SessionRecord>();

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function purgeExpired(now = Date.now()): void {
  for (const [key, session] of sessions) {
    if (session.expiresAt <= now) {
      sessions.delete(key);
    }
  }
}

export function createSession(): {
  token: string;
  expiresAt: Date;
} {
  purgeExpired();
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const createdAt = Date.now();
  const expiresAt = createdAt + SESSION_TTL_MS;

  sessions.set(tokenHash, {
    tokenHash,
    createdAt,
    expiresAt,
  });

  return {
    token,
    expiresAt: new Date(expiresAt),
  };
}

export function validateSessionToken(token: string | undefined): {
  valid: boolean;
  expiresAt: Date | null;
} {
  purgeExpired();

  if (!token || token.length === 0) {
    return { valid: false, expiresAt: null };
  }

  const tokenHash = hashToken(token);
  const session = sessions.get(tokenHash);
  if (!session) {
    return { valid: false, expiresAt: null };
  }

  if (session.expiresAt <= Date.now()) {
    sessions.delete(tokenHash);
    return { valid: false, expiresAt: null };
  }

  // Constant-time compare against stored hash for defense in depth.
  const stored = Buffer.from(session.tokenHash, 'hex');
  const actual = Buffer.from(tokenHash, 'hex');
  if (
    stored.length !== actual.length ||
    !timingSafeEqual(stored, actual)
  ) {
    return { valid: false, expiresAt: null };
  }

  return {
    valid: true,
    expiresAt: new Date(session.expiresAt),
  };
}

export function invalidateSessionToken(token: string | undefined): void {
  if (!token) {
    return;
  }
  sessions.delete(hashToken(token));
}

export function invalidateAllSessions(): void {
  sessions.clear();
}

/** Test helper — not used in production routes. */
export function __resetSessionsForTests(): void {
  sessions.clear();
}

/** Test helper to expire a session immediately. */
export function __expireSessionForTests(token: string): void {
  const tokenHash = hashToken(token);
  const session = sessions.get(tokenHash);
  if (session) {
    session.expiresAt = Date.now() - 1;
  }
}
