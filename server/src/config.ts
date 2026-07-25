import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  DATA_DIR: z.string().min(1).default('./data'),
  /** Optional absolute/relative path to the built client (`client/dist`). */
  CLIENT_DIST_DIR: z.string().min(1).optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
): AppConfig {
  return envSchema.parse(env);
}
