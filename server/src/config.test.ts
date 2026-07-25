import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('uses defaults when environment variables are omitted', () => {
    const config = loadConfig({});

    expect(config.PORT).toBe(3001);
    expect(config.NODE_ENV).toBe('development');
    expect(config.DATABASE_PATH).toBe('./data/worthlog.db');
  });

  it('reads PORT from the environment', () => {
    const config = loadConfig({ PORT: '4000' });

    expect(config.PORT).toBe(4000);
  });
});
