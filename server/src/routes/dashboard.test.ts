import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestContext,
  seedSnapshot,
  type TestContext,
} from '../test/helpers.js';

describe('dashboard API', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it('GET /api/dashboard returns empty metrics when there are no snapshots', async () => {
    const response = await request(ctx.app).get('/api/dashboard?range=all');

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      range: 'all',
      hasSnapshots: false,
      currentTotalCents: 0,
      previousTotalCents: null,
      changeCents: null,
      changePercent: null,
      firstTotalCents: null,
      changeSinceFirstCents: null,
      changeSinceFirstPercent: null,
      latestDate: null,
      timeSeries: [],
      categoryTimeSeries: [],
      latestAllocation: [],
      latestCategoryValues: [],
      historyRows: [],
    });
    // No snapshots: order falls back to manual sortOrder (fixture order).
    expect(response.body.data.categoryDisplayOrder).toHaveLength(4);
  });

  it('GET /api/dashboard returns totals, changes, series, allocation and history', async () => {
    seedSnapshot(ctx.db, '2026-01-01', {
      Crypto: 1000,
      Stocks: 1000,
      Pokémon: 1000,
      'CS2 Skins': 1000,
    });
    seedSnapshot(ctx.db, '2026-02-01', {
      Crypto: 2000,
      Stocks: 2000,
      Pokémon: 2000,
      'CS2 Skins': 2000,
    });
    seedSnapshot(ctx.db, '2026-03-01', {
      Crypto: 3000,
      Stocks: 3000,
      Pokémon: 3000,
      'CS2 Skins': 3000,
    });

    const response = await request(ctx.app).get('/api/dashboard?range=all');

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      range: 'all',
      hasSnapshots: true,
      currentTotalCents: 12_000,
      previousTotalCents: 8_000,
      changeCents: 4_000,
      changePercent: 50,
      firstTotalCents: 4_000,
      changeSinceFirstCents: 8_000,
      changeSinceFirstPercent: 200,
      latestDate: '2026-03-01',
    });
    expect(response.body.data.timeSeries).toHaveLength(3);
    expect(response.body.data.categoryTimeSeries).toHaveLength(4);
    expect(response.body.data.latestAllocation).toHaveLength(4);
    expect(response.body.data.latestCategoryValues).toHaveLength(4);
    expect(response.body.data.categoryDisplayOrder).toHaveLength(4);
    expect(response.body.data.historyRows[0]).toMatchObject({
      date: '2026-03-01',
      totalValueCents: 12_000,
    });
  });

  it('GET /api/dashboard rejects invalid ranges', async () => {
    const response = await request(ctx.app).get('/api/dashboard?range=2y');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
