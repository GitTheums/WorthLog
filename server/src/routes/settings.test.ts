import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from '../test/helpers.js';

describe('settings API', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it('GET /api/settings returns defaults', async () => {
    const response = await request(ctx.app).get('/api/settings');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      currency: 'EUR',
      defaultRange: '3m',
    });
  });

  it('PATCH /api/settings updates currency and defaultRange', async () => {
    const response = await request(ctx.app).patch('/api/settings').send({
      currency: 'usd',
      defaultRange: '1y',
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      currency: 'USD',
      defaultRange: '1y',
    });

    const readBack = await request(ctx.app).get('/api/settings');
    expect(readBack.body.data).toEqual({
      currency: 'USD',
      defaultRange: '1y',
    });
  });

  it('PATCH /api/settings rejects invalid values', async () => {
    const invalidCurrency = await request(ctx.app).patch('/api/settings').send({
      currency: 'EURO',
    });
    expect(invalidCurrency.status).toBe(400);

    const invalidRange = await request(ctx.app).patch('/api/settings').send({
      defaultRange: '2y',
    });
    expect(invalidRange.status).toBe(400);
  });
});
