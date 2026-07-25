import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getSnapshotWithValuesByDate,
  listCategories,
} from '../db/index.js';
import {
  createTestContext,
  seedSnapshot,
  type TestContext,
} from '../test/helpers.js';

describe('categories API', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it('GET /api/categories returns active categories sorted by sortOrder then name', async () => {
    const response = await request(ctx.app).get('/api/categories');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(4);
    expect(response.body.data.map((item: { name: string }) => item.name)).toEqual([
      'Crypto',
      'Stocks',
      'Pokémon',
      'CS2 Skins',
    ]);
    expect(response.body.data[0]).toMatchObject({
      sortOrder: 0,
      archivedAt: null,
    });
  });

  it('GET /api/categories?includeArchived=true includes archived categories', async () => {
    const crypto = listCategories(ctx.db).find((item) => item.name === 'Crypto');
    if (!crypto) {
      throw new Error('Expected Crypto category');
    }

    await request(ctx.app)
      .patch(`/api/categories/${crypto.id}`)
      .send({ archived: true })
      .expect(200);

    const active = await request(ctx.app).get('/api/categories');
    expect(active.body.data).toHaveLength(3);

    const all = await request(ctx.app).get('/api/categories?includeArchived=true');
    expect(all.body.data).toHaveLength(4);
    expect(
      all.body.data.some(
        (item: { id: string; archivedAt: string | null }) =>
          item.id === crypto.id && item.archivedAt !== null,
      ),
    ).toBe(true);
  });

  it('POST /api/categories creates a category', async () => {
    const response = await request(ctx.app)
      .post('/api/categories')
      .send({
        name: 'Bonds',
        color: '#0F766E',
        icon: 'Landmark',
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      name: 'Bonds',
      color: '#0F766E',
      icon: 'Landmark',
      sortOrder: 4,
      archivedAt: null,
    });
  });

  it('POST /api/categories rejects invalid color and duplicate names', async () => {
    const invalidColor = await request(ctx.app).post('/api/categories').send({
      name: 'Bonds',
      color: '#ABC',
      icon: 'Landmark',
    });
    expect(invalidColor.status).toBe(400);
    expect(invalidColor.body.error.code).toBe('VALIDATION_ERROR');

    const duplicate = await request(ctx.app).post('/api/categories').send({
      name: 'crypto',
      color: '#ABCDEF',
      icon: 'Bitcoin',
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('UNIQUE_CONSTRAINT');
  });

  it('PATCH /api/categories/:id updates fields and archive state', async () => {
    const crypto = listCategories(ctx.db).find((item) => item.name === 'Crypto');
    if (!crypto) {
      throw new Error('Expected Crypto category');
    }

    const renamed = await request(ctx.app)
      .patch(`/api/categories/${crypto.id}`)
      .send({
        name: 'Digital Assets',
        color: '#111827',
        icon: 'Coins',
        sortOrder: 10,
      });

    expect(renamed.status).toBe(200);
    expect(renamed.body.data).toMatchObject({
      name: 'Digital Assets',
      color: '#111827',
      icon: 'Coins',
      sortOrder: 10,
    });

    const archived = await request(ctx.app)
      .patch(`/api/categories/${crypto.id}`)
      .send({ archived: true });
    expect(archived.body.data.archivedAt).toBeTruthy();

    const restored = await request(ctx.app)
      .patch(`/api/categories/${crypto.id}`)
      .send({ archived: false });
    expect(restored.body.data.archivedAt).toBeNull();
  });

  it('DELETE /api/categories/:id permanently deletes unused and used categories', async () => {
    const created = await request(ctx.app).post('/api/categories').send({
      name: 'Temporary',
      color: '#123456',
      icon: 'Sparkles',
    });
    const temporaryId = created.body.data.id as string;

    const unusedDelete = await request(ctx.app).delete(
      `/api/categories/${temporaryId}`,
    );
    expect(unusedDelete.status).toBe(200);
    expect(unusedDelete.body.data).toMatchObject({
      deletedCategoryId: temporaryId,
      deletedCategoryName: 'Temporary',
      deletedValueCount: 0,
      affectedSnapshotCount: 0,
    });

    const crypto = listCategories(ctx.db).find((item) => item.name === 'Crypto');
    const stocks = listCategories(ctx.db).find((item) => item.name === 'Stocks');
    if (!crypto || !stocks) {
      throw new Error('Expected Crypto and Stocks categories');
    }

    seedSnapshot(ctx.db, '2026-01-01', {
      Crypto: 1000,
      Stocks: 2000,
      Pokémon: 3000,
      'CS2 Skins': 4000,
    }, 'Keep note');

    const impact = await request(ctx.app).get(
      `/api/categories/${crypto.id}/deletion-impact`,
    );
    expect(impact.status).toBe(200);
    expect(impact.body.data).toMatchObject({
      categoryId: crypto.id,
      categoryName: 'Crypto',
      valueCount: 1,
      snapshotCount: 1,
    });

    const usedDelete = await request(ctx.app).delete(
      `/api/categories/${crypto.id}`,
    );
    expect(usedDelete.status).toBe(200);
    expect(usedDelete.body.data).toMatchObject({
      deletedCategoryId: crypto.id,
      deletedCategoryName: 'Crypto',
      deletedValueCount: 1,
      affectedSnapshotCount: 1,
    });

    const snapshot = getSnapshotWithValuesByDate(ctx.db, '2026-01-01');
    expect(snapshot?.note).toBe('Keep note');
    expect(
      snapshot?.values.some((value) => value.categoryId === crypto.id),
    ).toBe(false);
    expect(
      snapshot?.values.some((value) => value.categoryId === stocks.id),
    ).toBe(true);
  });

  it('POST /api/categories/reorder updates sort orders in one transaction', async () => {
    const categories = listCategories(ctx.db);
    const reversed = [...categories].reverse().map((item) => item.id);

    const response = await request(ctx.app)
      .post('/api/categories/reorder')
      .send({ categoryIds: reversed });

    expect(response.status).toBe(200);
    expect(response.body.data.map((item: { id: string }) => item.id)).toEqual(
      reversed,
    );
    expect(response.body.data.map((item: { sortOrder: number }) => item.sortOrder)).toEqual([
      0, 1, 2, 3,
    ]);
  });

  it('POST /api/categories/reorder returns 404 for unknown IDs', async () => {
    const response = await request(ctx.app)
      .post('/api/categories/reorder')
      .send({
        categoryIds: ['00000000-0000-4000-8000-000000000000'],
      });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('CATEGORY_NOT_FOUND');
  });
});

describe('categories API seed defaults', () => {
  let ctx: TestContext;

  afterEach(() => {
    ctx.cleanup();
  });

  it('seeds only Stocks on a fresh empty database', async () => {
    ctx = createTestContext({ multiCategory: false });

    const response = await request(ctx.app).get('/api/categories');
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      name: 'Stocks',
      color: '#2563EB',
      icon: 'ChartNoAxesCombined',
      sortOrder: 0,
    });
  });
});
