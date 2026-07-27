import { existsSync } from 'node:fs';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listCategories } from '../db/repositories/categories.js';
import { getAppSettings } from '../db/repositories/settings.js';
import { listSnapshotDetails } from '../db/repositories/snapshots.js';
import {
  createTestContext,
  seedSnapshot,
  type TestContext,
} from '../test/helpers.js';
import { createCapturingLogger } from '../test/logging.js';

describe('backup API', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it('GET /api/backup/export returns a versioned JSON export', async () => {
    seedSnapshot(ctx.db, '2026-01-01', 100, 'note');
    await request(ctx.app).patch('/api/settings').send({ currency: 'EUR' });

    const response = await request(ctx.app).get('/api/backup/export');

    expect(response.status).toBe(200);
    expect(response.body.data.version).toBe(1);
    expect(response.body.data.exportedAt).toBeTruthy();
    expect(response.body.data.categories).toHaveLength(4);
    expect(response.body.data.snapshots).toHaveLength(1);
    expect(response.body.data.snapshots[0].values).toHaveLength(4);
    expect(response.body.data.settings.length).toBeGreaterThan(0);
  });

  it('POST /api/backup/import restores data and creates a backup file', async () => {
    seedSnapshot(ctx.db, '2026-01-01', 100);
    const exported = await request(ctx.app).get('/api/backup/export');
    const payload = exported.body.data;

    await request(ctx.app)
      .post('/api/categories')
      .send({ name: 'Temp', color: '#123456', icon: 'Sparkles' });
    seedSnapshot(ctx.db, '2026-02-01', 999);

    const imported = await request(ctx.app)
      .post('/api/backup/import')
      .send(payload);

    expect(imported.status).toBe(200);
    expect(existsSync(imported.body.data.backupPath as string)).toBe(true);
    expect(imported.body.data.counts).toEqual({
      settings: payload.settings.length,
      categories: 4,
      snapshots: 1,
      values: 4,
    });

    expect(listCategories(ctx.db)).toHaveLength(4);
    expect(listSnapshotDetails(ctx.db)).toHaveLength(1);
    expect(listSnapshotDetails(ctx.db)[0]?.date).toBe('2026-01-01');
    expect(getAppSettings(ctx.db).currency).toBe('EUR');
  });

  it('POST /api/backup/import rejects invalid payloads without changing data', async () => {
    seedSnapshot(ctx.db, '2026-01-01', 100);
    const before = listSnapshotDetails(ctx.db);

    const response = await request(ctx.app).post('/api/backup/import').send({
      version: 2,
      exportedAt: new Date().toISOString(),
      settings: [],
      categories: [],
      snapshots: [],
    });

    expect(response.status).toBe(400);
    expect(listSnapshotDetails(ctx.db)).toEqual(before);
  });

  it('POST /api/backup/import rolls back when insertion fails', async () => {
    const logger = createCapturingLogger();
    ctx.cleanup();
    ctx = createTestContext({ logger });

    seedSnapshot(ctx.db, '2026-01-01', 100);
    const exported = await request(ctx.app).get('/api/backup/export');
    const payload = structuredClone(exported.body.data);

    payload.snapshots[0].values[0].categoryId =
      '00000000-0000-4000-8000-000000000099';

    const beforeCategories = listCategories(ctx.db).map((item) => item.id);

    const response = await request(ctx.app)
      .post('/api/backup/import')
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('CONSTRAINT_ERROR');
    expect(listCategories(ctx.db).map((item) => item.id)).toEqual(
      beforeCategories,
    );
    expect(listSnapshotDetails(ctx.db)[0]?.date).toBe('2026-01-01');
    expect(logger.errors).toHaveLength(1);
    expect(logger.errors[0]).toMatchObject({
      code: expect.stringMatching(/^SQLITE_CONSTRAINT/),
    });
  });
});
