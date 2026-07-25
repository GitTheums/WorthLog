import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { getAppVersion } from '../version.js';

describe('GET /api/health', () => {
  it('returns status, database placeholder, and version', async () => {
    const app = createApp();

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      database: 'not_initialized',
      version: getAppVersion(),
    });
  });
});
