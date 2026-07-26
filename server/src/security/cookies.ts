import type { Request, Response } from 'express';
import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from './sessions.js';

export function parseCookies(
  cookieHeader: string | undefined,
): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    const separator = trimmed.indexOf('=');
    if (separator <= 0) {
      continue;
    }
    const name = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    try {
      result[name] = decodeURIComponent(value);
    } catch {
      result[name] = value;
    }
  }
  return result;
}

export function getSessionTokenFromRequest(req: Request): string | undefined {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE_NAME];
  return token && token.length > 0 ? token : undefined;
}

function shouldUseSecureCookie(req: Request): boolean {
  // Do not trust arbitrary X-Forwarded-Proto without an explicit trust-proxy setup.
  return req.secure;
}

export function setSessionCookie(
  req: Request,
  res: Response,
  token: string,
  expiresAt: Date,
): void {
  const maxAge = Math.max(0, expiresAt.getTime() - Date.now());
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${String(Math.floor(maxAge / 1000))}`,
    `Expires=${expiresAt.toUTCString()}`,
  ];

  if (shouldUseSecureCookie(req)) {
    parts.push('Secure');
  }

  res.append('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(req: Request, res: Response): void {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];

  if (shouldUseSecureCookie(req)) {
    parts.push('Secure');
  }

  res.append('Set-Cookie', parts.join('; '));
}

export { SESSION_COOKIE_NAME, SESSION_TTL_MS };
