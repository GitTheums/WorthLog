import type { AppLogger } from '../logging.js';

/**
 * Capturing logger for tests that intentionally trigger expected warnings/errors.
 * Unexpected messages stay out of stderr while remaining assertable.
 */
export function createCapturingLogger(): AppLogger & {
  warns: string[];
  errors: unknown[];
} {
  const warns: string[] = [];
  const errors: unknown[] = [];
  return {
    warns,
    errors,
    warn: (message: string) => {
      warns.push(message);
    },
    error: (message: unknown) => {
      errors.push(message);
    },
  };
}
