import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import type { Express } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { openDatabase } from './db/index.js';
import { createRateLimiters } from './middleware/rateLimits.js';

describe('production static and SPA fallback', () => {
  let dataDir: string;
  let clientDistDir: string;
  let db: Database.Database;
  let app: Express;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'worthlog-static-data-'));
    clientDistDir = mkdtempSync(join(tmpdir(), 'worthlog-static-client-'));
    writeFileSync(
      join(clientDistDir, 'index.html'),
      '<!doctype html><html><head><link rel="icon" href="/favicon.svg" type="image/svg+xml" /><title>Worthlog</title></head><body>Worthlog SPA</body></html>\n',
      'utf8',
    );
    writeFileSync(join(clientDistDir, 'app.js'), 'console.log("ok");\n', 'utf8');
    writeFileSync(
      join(clientDistDir, 'favicon.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"></svg>\n',
      'utf8',
    );

    db = openDatabase(dataDir);
    app = createApp(db, {
      dataDir,
      clientDistDir,
      rateLimiters: createRateLimiters(),
    });
  });

  afterEach(() => {
    db.close();
    rmSync(dataDir, { recursive: true, force: true });
    rmSync(clientDistDir, { recursive: true, force: true });
  });

  it('serves the SPA for non-API routes and keeps /api routes intact', async () => {
    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('ok');

    const asset = await request(app).get('/app.js');
    expect(asset.status).toBe(200);
    expect(asset.text).toContain('console.log');

    const favicon = await request(app).get('/favicon.svg');
    expect(favicon.status).toBe(200);
    expect(favicon.headers['content-type']).toMatch(/svg|xml/i);

    const spa = await request(app).get('/settings');
    expect(spa.status).toBe(200);
    expect(spa.text).toContain('Worthlog SPA');
    expect(spa.text).toContain('/favicon.svg');

    const missingApi = await request(app).get('/api/does-not-exist');
    expect(missingApi.status).toBe(404);
    expect(missingApi.text).not.toContain('Worthlog SPA');
  });
});
