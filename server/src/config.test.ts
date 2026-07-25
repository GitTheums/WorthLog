import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('uses defaults when environment variables are omitted', () => {
    const config = loadConfig({});

    expect(config.PORT).toBe(3001);
    expect(config.NODE_ENV).toBe('development');
    expect(config.DATA_DIR).toBe('./data');
  });

  it('reads PORT and DATA_DIR from the environment', () => {
    const config = loadConfig({
      PORT: '4000',
      DATA_DIR: '/var/lib/worthlog',
    });

    expect(config.PORT).toBe(4000);
    expect(config.DATA_DIR).toBe('/var/lib/worthlog');
  });
});
