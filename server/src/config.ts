import { z } from 'zod';

/**
 * TRUST_PROXY: unset / "false" / "0" → do not trust forwarded headers (default).
 * Positive integer → Express `trust proxy` hop count (e.g. 1 behind one reverse proxy).
 */
function parseTrustProxy(value: string | undefined): number | false {
  if (value === undefined) {
    return false;
  }

  const trimmed = value.trim().toLowerCase();
  if (trimmed === '' || trimmed === 'false' || trimmed === '0') {
    return false;
  }

  const hops = Number(trimmed);
  if (!Number.isInteger(hops) || hops < 1 || hops > 32) {
    throw new Error(
      'TRUST_PROXY must be a positive integer hop count (1-32), or false/0/unset',
    );
  }

  return hops;
}

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  DATA_DIR: z.string().min(1).default('./data'),
  /** Optional absolute/relative path to the built client (`client/dist`). */
  CLIENT_DIST_DIR: z.string().min(1).optional(),
  TRUST_PROXY: z.string().optional(),
});

export type AppConfig = Omit<z.infer<typeof envSchema>, 'TRUST_PROXY'> & {
  /** False when disabled; otherwise the number of trusted proxy hops. */
  TRUST_PROXY: number | false;
};

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const parsed = envSchema.parse(env);
  return {
    PORT: parsed.PORT,
    NODE_ENV: parsed.NODE_ENV,
    DATA_DIR: parsed.DATA_DIR,
    ...(parsed.CLIENT_DIST_DIR
      ? { CLIENT_DIST_DIR: parsed.CLIENT_DIST_DIR }
      : {}),
    TRUST_PROXY: parseTrustProxy(parsed.TRUST_PROXY),
  };
}
