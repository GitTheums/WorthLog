import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createApp } from '../app.js';
import { openDatabase } from '../db/open-database.js';
import { __resetPinRateLimitForTests } from '../security/pin-rate-limit.js';
import { __resetSessionsForTests } from '../security/sessions.js';
import {
  createTestContext,
  type TestContext,
} from '../test/helpers.js';
import { createRateLimiters } from './rateLimits.js';

function expectRateLimited(response: request.Response): void {
  expect(response.status).toBe(429);
  expect(response.headers['content-type']).toMatch(/json/);
  expect(response.body.error.code).toBe('RATE_LIMITED');
  expect(response.body.error.message).toMatch(/too many requests/i);
  expect(response.body.error.code).not.toBe('PORTFOLIO_LOCKED');
  expect(response.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
  expect(Number.isFinite(response.body.error.details.retryAfterSeconds)).toBe(
    true,
  );
  expect(response.headers['retry-after']).toBeTruthy();
  const rateLimitHeader =
    response.headers['ratelimit'] ?? response.headers['RateLimit'];
  const legacyRemaining = response.headers['ratelimit-remaining'];
  expect(rateLimitHeader || legacyRemaining !== undefined).toBeTruthy();
}

describe('express-rate-limit middleware', () => {
  let ctx: TestContext | undefined;

  beforeEach(() => {
    ctx = undefined;
    __resetSessionsForTests();
    __resetPinRateLimitForTests();
  });

  afterEach(() => {
    ctx?.cleanup();
    __resetSessionsForTests();
    __resetPinRateLimitForTests();
    vi.useRealTimers();
  });

  it('allows portfolio requests below the general limit and blocks above it', async () => {
    const rateLimiters = createRateLimiters({
      portfolioApi: { windowMs: 60_000, limit: 3 },
    });
    ctx = createTestContext({ rateLimiters });

    for (let i = 0; i < 3; i += 1) {
      const ok = await request(ctx.app).get('/api/settings');
      expect(ok.status).toBe(200);
    }

    const limited = await request(ctx.app).get('/api/settings');
    expectRateLimited(limited);
  });

  it('resets the portfolio limiter after its window', async () => {
    vi.useFakeTimers();
    const rateLimiters = createRateLimiters({
      portfolioApi: { windowMs: 1_000, limit: 2 },
    });
    ctx = createTestContext({ rateLimiters });

    expect((await request(ctx.app).get('/api/settings')).status).toBe(200);
    expect((await request(ctx.app).get('/api/settings')).status).toBe(200);
    expectRateLimited(await request(ctx.app).get('/api/settings'));

    await vi.advanceTimersByTimeAsync(1_100);

    expect((await request(ctx.app).get('/api/settings')).status).toBe(200);
  });

  it('does not share portfolio allowance across different client IPs', async () => {
    const rateLimiters = createRateLimiters({
      portfolioApi: { windowMs: 60_000, limit: 1 },
    });
    ctx = createTestContext({ rateLimiters });

    const first = await request(ctx.app)
      .get('/api/settings')
      .set('X-Forwarded-For', '203.0.113.10');
    expect(first.status).toBe(200);

    // Without trust proxy, spoofed X-Forwarded-For must not create a new bucket.
    const spoofed = await request(ctx.app)
      .get('/api/settings')
      .set('X-Forwarded-For', '198.51.100.20');
    expectRateLimited(spoofed);
  });

  it('trusts forwarded client IP only when TRUST_PROXY hops are configured', async () => {
    const rateLimiters = createRateLimiters({
      portfolioApi: { windowMs: 60_000, limit: 1 },
    });
    ctx = createTestContext({
      rateLimiters,
      trustProxy: 1,
    });

    const first = await request(ctx.app)
      .get('/api/settings')
      .set('X-Forwarded-For', '203.0.113.10');
    expect(first.status).toBe(200);

    const secondSame = await request(ctx.app)
      .get('/api/settings')
      .set('X-Forwarded-For', '203.0.113.10');
    expectRateLimited(secondSame);

    const otherClient = await request(ctx.app)
      .get('/api/settings')
      .set('X-Forwarded-For', '198.51.100.20');
    expect(otherClient.status).toBe(200);
  });

  it('keeps auth status on a generous separate limiter', async () => {
    const rateLimiters = createRateLimiters({
      authStatus: { windowMs: 60_000, limit: 2 },
      portfolioApi: { windowMs: 60_000, limit: 1 },
    });
    ctx = createTestContext({ rateLimiters });

    expect((await request(ctx.app).get('/api/auth/status')).status).toBe(200);
    expect((await request(ctx.app).get('/api/auth/status')).status).toBe(200);
    expectRateLimited(await request(ctx.app).get('/api/auth/status'));

    // Exhausting auth status must not consume the portfolio limiter.
    expect((await request(ctx.app).get('/api/settings')).status).toBe(200);
  });

  it('still enforces incorrect-PIN lockout alongside the volume limiter', async () => {
    ctx = createTestContext();

    await request(ctx.app).post('/api/auth/setup').send({ pin: '1234' });
    __resetSessionsForTests();

    for (let i = 0; i < 4; i += 1) {
      const wrong = await request(ctx.app)
        .post('/api/auth/unlock')
        .send({ pin: '0000' });
      expect(wrong.status).toBe(401);
      expect(wrong.body.error.code).toBe('INVALID_PIN');
    }

    const pinBlocked = await request(ctx.app)
      .post('/api/auth/unlock')
      .send({ pin: '0000' });
    expect(pinBlocked.status).toBe(429);
    expect(pinBlocked.body.error.code).toBe('TOO_MANY_ATTEMPTS');
  });

  it('applies a request-volume limit to PIN unlock including after successful unlocks', async () => {
    const rateLimiters = createRateLimiters({
      authPin: { windowMs: 60_000, limit: 3 },
    });
    ctx = createTestContext({ rateLimiters });

    // 1) setup
    expect(
      (await request(ctx.app).post('/api/auth/setup').send({ pin: '1234' }))
        .status,
    ).toBe(200);
    __resetSessionsForTests();

    // 2) successful unlock
    expect(
      (await request(ctx.app).post('/api/auth/unlock').send({ pin: '1234' }))
        .status,
    ).toBe(200);
    __resetSessionsForTests();

    // 3) another unlock still allowed
    expect(
      (await request(ctx.app).post('/api/auth/unlock').send({ pin: '1234' }))
        .status,
    ).toBe(200);

    // 4) volume limiter (success does not skip counting)
    expectRateLimited(
      await request(ctx.app).post('/api/auth/unlock').send({ pin: '1234' }),
    );
  });

  it('limits malformed authentication requests and never logs PIN values', async () => {
    const spies = [
      vi.spyOn(console, 'log').mockImplementation(() => undefined),
      vi.spyOn(console, 'info').mockImplementation(() => undefined),
      vi.spyOn(console, 'warn').mockImplementation(() => undefined),
      vi.spyOn(console, 'error').mockImplementation(() => undefined),
      vi.spyOn(console, 'debug').mockImplementation(() => undefined),
    ];

    try {
      const rateLimiters = createRateLimiters({
        authPin: { windowMs: 60_000, limit: 3 },
      });
      ctx = createTestContext({ rateLimiters });
      await request(ctx.app).post('/api/auth/setup').send({ pin: '2468' });
      __resetSessionsForTests();

      expect(
        (
          await request(ctx.app)
            .post('/api/auth/unlock')
            .send({ pin: 'not-a-pin' })
        ).status,
      ).toBe(400);
      expect(
        (await request(ctx.app).post('/api/auth/unlock').send({})).status,
      ).toBe(400);
      expectRateLimited(
        await request(ctx.app).post('/api/auth/unlock').send({ pin: '0000' }),
      );

      for (const spy of spies) {
        for (const args of spy.mock.calls) {
          expect(JSON.stringify(args)).not.toContain('2468');
          expect(JSON.stringify(args)).not.toContain('not-a-pin');
        }
      }
    } finally {
      for (const spy of spies) {
        spy.mockRestore();
      }
    }
  });

  it('keeps health public while locked, with its own limiter', async () => {
    const rateLimiters = createRateLimiters({
      health: { windowMs: 60_000, limit: 2 },
      portfolioApi: { windowMs: 60_000, limit: 1 },
    });
    ctx = createTestContext({ rateLimiters });

    await request(ctx.app).post('/api/auth/setup').send({ pin: '1357' });
    await request(ctx.app).post('/api/auth/lock');

    expect((await request(ctx.app).get('/api/health')).status).toBe(200);
    expect((await request(ctx.app).get('/api/health')).status).toBe(200);
    expectRateLimited(await request(ctx.app).get('/api/health'));

    // Health exhaustion must not consume the portfolio limiter.
    const lockedPortfolio = await request(ctx.app).get('/api/settings');
    expect(lockedPortfolio.status).toBe(401);
    expect(lockedPortfolio.body.error.code).toBe('PORTFOLIO_LOCKED');
  });

  it('accepts normal health polling frequency', async () => {
    ctx = createTestContext();
    for (let i = 0; i < 5; i += 1) {
      expect((await request(ctx.app).get('/api/health')).status).toBe(200);
    }
  });

  it('does not rate-limit static assets with the portfolio API limiter', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'worthlog-rl-static-data-'));
    const clientDistDir = mkdtempSync(
      join(tmpdir(), 'worthlog-rl-static-client-'),
    );
    writeFileSync(
      join(clientDistDir, 'index.html'),
      '<!doctype html><title>Worthlog</title><body>SPA</body>',
      'utf8',
    );
    writeFileSync(join(clientDistDir, 'app.js'), 'console.log(1)', 'utf8');
    writeFileSync(
      join(clientDistDir, 'favicon.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      'utf8',
    );

    const db = openDatabase(dataDir);
    const rateLimiters = createRateLimiters({
      portfolioApi: { windowMs: 60_000, limit: 1 },
      spaFallback: { windowMs: 60_000, limit: 50 },
    });
    const app = createApp(db, { dataDir, clientDistDir, rateLimiters });

    try {
      expect((await request(app).get('/api/settings')).status).toBe(200);
      expectRateLimited(await request(app).get('/api/dashboard?range=all'));

      const asset = await request(app).get('/app.js');
      expect(asset.status).toBe(200);
      expect(asset.text).toContain('console.log');

      const favicon = await request(app).get('/favicon.svg');
      expect(favicon.status).toBe(200);

      const spa = await request(app).get('/history');
      expect(spa.status).toBe(200);
      expect(spa.text).toContain('SPA');
    } finally {
      db.close();
      rmSync(dataDir, { recursive: true, force: true });
      rmSync(clientDistDir, { recursive: true, force: true });
    }
  });

  it('rate-limits the SPA filesystem fallback separately', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'worthlog-rl-spa-data-'));
    const clientDistDir = mkdtempSync(join(tmpdir(), 'worthlog-rl-spa-client-'));
    writeFileSync(
      join(clientDistDir, 'index.html'),
      '<!doctype html><body>SPA</body>',
      'utf8',
    );
    const db = openDatabase(dataDir);
    const rateLimiters = createRateLimiters({
      spaFallback: { windowMs: 60_000, limit: 2 },
    });
    const app = createApp(db, { dataDir, clientDistDir, rateLimiters });

    try {
      expect((await request(app).get('/one')).status).toBe(200);
      expect((await request(app).get('/two')).status).toBe(200);
      expectRateLimited(await request(app).get('/three'));
    } finally {
      db.close();
      rmSync(dataDir, { recursive: true, force: true });
      rmSync(clientDistDir, { recursive: true, force: true });
    }
  });
});
