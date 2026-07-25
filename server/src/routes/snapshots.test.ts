import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listCategories } from '../db/repositories/categories.js';
import {
  activeCategoryValues,
  createTestContext,
  seedSnapshot,
  type TestContext,
} from '../test/helpers.js';

describe('snapshots API', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it('PUT /api/snapshots/:date creates a complete snapshot', async () => {
    const values = activeCategoryValues(ctx.db, {
      Crypto: 1000,
      Stocks: 2000,
      Pokémon: 3000,
      'CS2 Skins': 4000,
    });

    const response = await request(ctx.app)
      .put('/api/snapshots/2026-06-01')
      .send({
        note: 'First entry',
        values,
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      date: '2026-06-01',
      note: 'First entry',
      totalValueCents: 10_000,
    });
    expect(response.body.data.values).toHaveLength(4);
  });

  it('PUT /api/snapshots/:date replaces an existing snapshot', async () => {
    seedSnapshot(ctx.db, '2026-06-01', 100, 'old');

    const values = activeCategoryValues(ctx.db, 250);
    const response = await request(ctx.app)
      .put('/api/snapshots/2026-06-01')
      .send({
        note: 'updated',
        values,
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      note: 'updated',
      totalValueCents: 1000,
    });
  });

  it('PUT /api/snapshots/:date rejects invalid payloads', async () => {
    const categories = listCategories(ctx.db);
    const [first, ...rest] = categories;
    if (!first) {
      throw new Error('Expected categories');
    }

    const missingCategory = await request(ctx.app)
      .put('/api/snapshots/2026-06-01')
      .send({
        values: rest.map((category) => ({
          categoryId: category.id,
          amountCents: 100,
        })),
      });
    expect(missingCategory.status).toBe(400);

    const duplicate = await request(ctx.app)
      .put('/api/snapshots/2026-06-01')
      .send({
        values: [
          ...activeCategoryValues(ctx.db, 100),
          { categoryId: first.id, amountCents: 50 },
        ],
      });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.error.message).toMatch(/duplicate/i);

    const negative = await request(ctx.app)
      .put('/api/snapshots/2026-06-01')
      .send({
        values: activeCategoryValues(ctx.db, 100).map((value, index) =>
          index === 0 ? { ...value, amountCents: -1 } : value,
        ),
      });
    expect(negative.status).toBe(400);

    const nonInteger = await request(ctx.app)
      .put('/api/snapshots/2026-06-01')
      .send({
        values: activeCategoryValues(ctx.db, 100).map((value, index) =>
          index === 0 ? { ...value, amountCents: 1.5 } : value,
        ),
      });
    expect(nonInteger.status).toBe(400);
  });

  it('GET /api/snapshots returns ordered snapshots with totals and date filters', async () => {
    seedSnapshot(ctx.db, '2026-01-01', 100);
    seedSnapshot(ctx.db, '2026-02-01', 200);
    seedSnapshot(ctx.db, '2026-03-01', 300);

    const all = await request(ctx.app).get('/api/snapshots');
    expect(all.status).toBe(200);
    expect(all.body.data.map((item: { date: string }) => item.date)).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
    ]);
    expect(all.body.data[0].totalValueCents).toBe(400);

    const filtered = await request(ctx.app).get(
      '/api/snapshots?from=2026-02-01&to=2026-02-28',
    );
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.data[0].date).toBe('2026-02-01');
  });

  it('GET /api/snapshots/:date returns 404 when missing', async () => {
    const missing = await request(ctx.app).get('/api/snapshots/2026-01-01');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('SNAPSHOT_NOT_FOUND');

    seedSnapshot(ctx.db, '2026-01-01', 125);
    const found = await request(ctx.app).get('/api/snapshots/2026-01-01');
    expect(found.status).toBe(200);
    expect(found.body.data.totalValueCents).toBe(500);
  });

  it('DELETE /api/snapshots/:date removes snapshot and values', async () => {
    seedSnapshot(ctx.db, '2026-01-01', 100);

    await request(ctx.app).delete('/api/snapshots/2026-01-01').expect(204);

    const missing = await request(ctx.app).get('/api/snapshots/2026-01-01');
    expect(missing.status).toBe(404);

    const deleteMissing = await request(ctx.app).delete(
      '/api/snapshots/2026-01-01',
    );
    expect(deleteMissing.status).toBe(404);
  });
});
