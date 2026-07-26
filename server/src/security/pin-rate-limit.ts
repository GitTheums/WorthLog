interface AttemptState {
  failures: number;
  blockedUntil: number;
  delaySeconds: number;
  lastFailureAt: number;
}

const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 5;
const BASE_BLOCK_SECONDS = 30;
const MAX_BLOCK_SECONDS = 15 * 60;

const attempts = new Map<string, AttemptState>();

function getState(key: string): AttemptState {
  const existing = attempts.get(key);
  if (existing) {
    return existing;
  }
  const created: AttemptState = {
    failures: 0,
    blockedUntil: 0,
    delaySeconds: BASE_BLOCK_SECONDS,
    lastFailureAt: 0,
  };
  attempts.set(key, created);
  return created;
}

export function getClientKey(ip: string | undefined): string {
  return ip && ip.length > 0 ? ip : 'unknown';
}

export function getUnlockBlock(key: string): {
  blocked: boolean;
  retryAfterSeconds: number;
} {
  const state = getState(key);
  const now = Date.now();
  if (state.blockedUntil > now) {
    return {
      blocked: true,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((state.blockedUntil - now) / 1000),
      ),
    };
  }
  return { blocked: false, retryAfterSeconds: 0 };
}

export function registerUnlockFailure(key: string): {
  blocked: boolean;
  retryAfterSeconds: number;
} {
  const state = getState(key);
  const now = Date.now();

  if (state.blockedUntil > now) {
    return {
      blocked: true,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((state.blockedUntil - now) / 1000),
      ),
    };
  }

  // Reset the failure window after a quiet period with no failures.
  if (
    state.failures > 0 &&
    state.lastFailureAt > 0 &&
    now - state.lastFailureAt > WINDOW_MS
  ) {
    state.failures = 0;
    state.delaySeconds = BASE_BLOCK_SECONDS;
  }

  state.failures += 1;
  state.lastFailureAt = now;

  if (state.failures >= MAX_FAILURES) {
    state.blockedUntil = now + state.delaySeconds * 1000;
    const retryAfterSeconds = state.delaySeconds;
    state.failures = 0;
    state.delaySeconds = Math.min(
      MAX_BLOCK_SECONDS,
      state.delaySeconds * 2,
    );
    return { blocked: true, retryAfterSeconds };
  }

  return { blocked: false, retryAfterSeconds: 0 };
}

export function resetUnlockFailures(key: string): void {
  attempts.delete(key);
}

export function __resetPinRateLimitForTests(): void {
  attempts.clear();
}
