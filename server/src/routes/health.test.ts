import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getAppVersion } from '../version.js';
import { createTestContext, type TestContext } from '../test/helpers.js';

describe('GET /api/health', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it('returns status, database ok, version, and no-store cache header', async () => {
    const response = await request(ctx.app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({
      status: 'ok',
      database: 'ok',
      version: getAppVersion(),
    });
  });
});
