import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { runMigrations } from '../db/migrate.js';
import { migrations } from '../db/migrations/index.js';
import { openDatabase } from '../db/open-database.js';
import { getSecuritySettings } from '../db/repositories/security.js';
import { listCategories } from '../db/repositories/categories.js';
import { listSnapshotDetails } from '../db/repositories/snapshots.js';
import { __resetPinRateLimitForTests } from '../security/pin-rate-limit.js';
import {
  __expireSessionForTests,
  __resetSessionsForTests,
  SESSION_COOKIE_NAME,
} from '../security/sessions.js';
import {
  createTestContext,
  seedSnapshot,
  type TestContext,
} from '../test/helpers.js';

function findSessionCookie(response: request.Response): string | undefined {
  const raw = response.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.find((item) => item.startsWith(`${SESSION_COOKIE_NAME}=`));
}

describe('auth / PIN protection', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
    __resetSessionsForTests();
    __resetPinRateLimitForTests();
  });

  afterEach(() => {
    ctx.cleanup();
    __resetSessionsForTests();
    __resetPinRateLimitForTests();
  });

  it('migrates an existing database with PIN disabled', () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'worthlog-migrate-pin-'));
    const dbPath = join(dataDir, 'worthlog.db');
    const db = new Database(dbPath);
    try {
      runMigrations(
        db,
        migrations.filter((migration) => migration.version <= 2),
      );
      const before = db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'security_settings'`,
        )
        .get() as { name: string } | undefined;
      expect(before).toBeUndefined();

      runMigrations(db, migrations);
      const security = getSecuritySettings(db);
      expect(security.pinEnabled).toBe(false);
      expect(security.pinHash).toBeNull();
      expect(security.pinSalt).toBeNull();
    } finally {
      db.close();
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('keeps a no-PIN installation directly accessible', async () => {
    const status = await request(ctx.app).get('/api/auth/status');
    expect(status.status).toBe(200);
    expect(status.body.data).toEqual({
      pinEnabled: false,
      unlocked: true,
      sessionExpiresAt: null,
    });

    const settings = await request(ctx.app).get('/api/settings');
    expect(settings.status).toBe(200);
    expect(settings.body.data.currency).toBe('EUR');
  });

  it('accepts 4 to 8 digit PIN setup and rejects invalid formats', async () => {
    const tooShort = await request(ctx.app)
      .post('/api/auth/setup')
      .send({ pin: '123' });
    expect(tooShort.status).toBe(400);

    const nonNumeric = await request(ctx.app)
      .post('/api/auth/setup')
      .send({ pin: '12ab' });
    expect(nonNumeric.status).toBe(400);

    const ok = await request(ctx.app)
      .post('/api/auth/setup')
      .send({ pin: '12345678' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.pinEnabled).toBe(true);
    expect(ok.body.data.unlocked).toBe(true);
    expect(ok.body.data).not.toHaveProperty('pinHash');
    expect(ok.body.data).not.toHaveProperty('pinSalt');
  });

  it('stores a hashed PIN, never plaintext, and never returns hash/salt', async () => {
    const agent = request.agent(ctx.app);
    await agent.post('/api/auth/setup').send({ pin: '2468' });
    const security = getSecuritySettings(ctx.db);
    expect(security.pinEnabled).toBe(true);
    expect(security.pinHash).toBeTruthy();
    expect(security.pinHash).not.toBe('2468');
    expect(security.pinSalt).toBeTruthy();
    expect(security.pinSalt).not.toBe('2468');
    expect(security.pinKdf).toBe('scrypt-v1');

    const unlockedSettings = await agent.get('/api/settings');
    expect(unlockedSettings.status).toBe(200);
    expect(JSON.stringify(unlockedSettings.body)).not.toContain(
      security.pinHash,
    );
    expect(JSON.stringify(unlockedSettings.body)).not.toContain(
      security.pinSalt,
    );

    const authStatus = await request(ctx.app).get('/api/auth/status');
    expect(JSON.stringify(authStatus.body)).not.toContain(security.pinHash);
    expect(JSON.stringify(authStatus.body)).not.toContain(security.pinSalt);
  });

  it('unlocks with the correct PIN and rejects incorrect PINs generically', async () => {
    await request(ctx.app).post('/api/auth/setup').send({ pin: '1357' });
    __resetSessionsForTests();

    const wrong = await request(ctx.app)
      .post('/api/auth/unlock')
      .send({ pin: '9999' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('INVALID_PIN');
    expect(wrong.body.error.message).toBe('That PIN is incorrect.');

    const right = await request(ctx.app)
      .post('/api/auth/unlock')
      .send({ pin: '1357' });
    expect(right.status).toBe(200);
    expect(right.body.data.unlocked).toBe(true);
    const cookie = findSessionCookie(right);
    expect(cookie).toBeTruthy();
    expect(cookie?.toLowerCase()).toContain('httponly');
    expect(cookie?.toLowerCase()).toContain('samesite=strict');
  });

  it('protects portfolio endpoints while locked and allows them when unlocked', async () => {
    const setup = await request(ctx.app)
      .post('/api/auth/setup')
      .send({ pin: '1122' });
    expect(setup.status).toBe(200);

    await request(ctx.app).post('/api/auth/lock');

    const locked = await request(ctx.app).get('/api/dashboard?range=all');
    expect(locked.status).toBe(401);
    expect(locked.body.error).toEqual({
      code: 'PORTFOLIO_LOCKED',
      message: 'WorthLog is locked.',
    });

    const health = await request(ctx.app).get('/api/health');
    expect(health.status).toBe(200);

    const agent = request.agent(ctx.app);
    await agent.post('/api/auth/unlock').send({ pin: '1122' });
    const dashboard = await agent.get('/api/dashboard?range=all');
    expect(dashboard.status).toBe(200);
  });

  it('expires sessions and requires unlock again', async () => {
    const agent = request.agent(ctx.app);
    const setup = await agent.post('/api/auth/setup').send({ pin: '3344' });
    expect(setup.status).toBe(200);

    const cookie = findSessionCookie(setup);
    const tokenMatch = cookie?.match(
      new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`),
    );
    const token = decodeURIComponent(tokenMatch?.[1] ?? '');
    expect(token.length).toBeGreaterThan(0);
    __expireSessionForTests(token);

    const response = await agent.get('/api/settings');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('PORTFOLIO_LOCKED');
  });

  it('manual lock invalidates the current session', async () => {
    const agent = request.agent(ctx.app);
    await agent.post('/api/auth/setup').send({ pin: '5566' });
    expect((await agent.get('/api/settings')).status).toBe(200);

    const lock = await agent.post('/api/auth/lock');
    expect(lock.status).toBe(200);

    const locked = await agent.get('/api/categories');
    expect(locked.status).toBe(401);
  });

  it('changing PIN requires current PIN and invalidates previous sessions', async () => {
    const agentA = request.agent(ctx.app);
    await agentA.post('/api/auth/setup').send({ pin: '7788' });

    const agentB = request.agent(ctx.app);
    await agentB.post('/api/auth/unlock').send({ pin: '7788' });
    expect((await agentB.get('/api/settings')).status).toBe(200);

    const wrong = await agentA.post('/api/auth/change-pin').send({
      currentPin: '0000',
      newPin: '8877',
    });
    expect(wrong.status).toBe(401);

    const changed = await agentA.post('/api/auth/change-pin').send({
      currentPin: '7788',
      newPin: '8877',
    });
    expect(changed.status).toBe(200);

    expect((await agentB.get('/api/settings')).status).toBe(401);
    expect((await agentA.get('/api/settings')).status).toBe(200);

    const oldPin = await request(ctx.app)
      .post('/api/auth/unlock')
      .send({ pin: '7788' });
    expect(oldPin.status).toBe(401);
  });

  it('removing PIN requires current PIN and does not delete portfolio data', async () => {
    seedSnapshot(ctx.db, '2026-01-01', 250);
    const beforeCategories = listCategories(ctx.db).length;
    const beforeSnapshots = listSnapshotDetails(ctx.db).length;

    const agent = request.agent(ctx.app);
    await agent.post('/api/auth/setup').send({ pin: '9900' });

    const wrong = await agent.delete('/api/auth/pin').send({ currentPin: '1111' });
    expect(wrong.status).toBe(401);

    const removed = await agent
      .delete('/api/auth/pin')
      .send({ currentPin: '9900' });
    expect(removed.status).toBe(200);
    expect(removed.body.data.pinEnabled).toBe(false);

    expect(listCategories(ctx.db)).toHaveLength(beforeCategories);
    expect(listSnapshotDetails(ctx.db)).toHaveLength(beforeSnapshots);
    expect(getSecuritySettings(ctx.db).pinEnabled).toBe(false);

    const open = await request(ctx.app).get('/api/settings');
    expect(open.status).toBe(200);
  });

  it('rate limits unlock failures and resets after success', async () => {
    await request(ctx.app).post('/api/auth/setup').send({ pin: '1212' });
    __resetSessionsForTests();

    for (let i = 0; i < 4; i += 1) {
      const response = await request(ctx.app)
        .post('/api/auth/unlock')
        .send({ pin: '0000' });
      expect(response.status).toBe(401);
    }

    const blocked = await request(ctx.app)
      .post('/api/auth/unlock')
      .send({ pin: '0000' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_ATTEMPTS');
    expect(blocked.body.error.details.retryAfterSeconds).toBeGreaterThan(0);

    __resetPinRateLimitForTests();
    const success = await request(ctx.app)
      .post('/api/auth/unlock')
      .send({ pin: '1212' });
    expect(success.status).toBe(200);

    const againWrong = await request(ctx.app)
      .post('/api/auth/unlock')
      .send({ pin: '0000' });
    expect(againWrong.status).toBe(401);
  });

  it('never includes PIN credentials in backup export and import preserves PIN', async () => {
    seedSnapshot(ctx.db, '2026-01-01', 100);
    const agent = request.agent(ctx.app);
    await agent.post('/api/auth/setup').send({ pin: '4242' });
    const securityBefore = getSecuritySettings(ctx.db);

    const exported = await agent.get('/api/backup/export');
    expect(exported.status).toBe(200);
    const payloadText = JSON.stringify(exported.body.data);
    expect(payloadText).not.toContain(securityBefore.pinHash);
    expect(payloadText).not.toContain(securityBefore.pinSalt);
    expect(payloadText).not.toContain('pin_hash');
    expect(payloadText).not.toContain('security_settings');

    await agent.post('/api/auth/change-pin').send({
      currentPin: '4242',
      newPin: '4343',
    });
    const midSecurity = getSecuritySettings(ctx.db);

    const imported = await agent
      .post('/api/backup/import')
      .send(exported.body.data);
    expect(imported.status).toBe(200);

    const after = getSecuritySettings(ctx.db);
    expect(after.pinEnabled).toBe(true);
    expect(after.pinHash).toBe(midSecurity.pinHash);
    expect(after.pinSalt).toBe(midSecurity.pinSalt);
  });

  it('does not log PIN values during unlock', async () => {
    const spies = [
      vi.spyOn(console, 'log').mockImplementation(() => undefined),
      vi.spyOn(console, 'info').mockImplementation(() => undefined),
      vi.spyOn(console, 'error').mockImplementation(() => undefined),
      vi.spyOn(console, 'debug').mockImplementation(() => undefined),
      vi.spyOn(console, 'warn').mockImplementation(() => undefined),
    ];

    try {
      await request(ctx.app).post('/api/auth/setup').send({ pin: '5656' });
      __resetSessionsForTests();
      await request(ctx.app).post('/api/auth/unlock').send({ pin: '5656' });
      await request(ctx.app).post('/api/auth/unlock').send({ pin: '0000' });

      for (const spy of spies) {
        for (const args of spy.mock.calls) {
          expect(JSON.stringify(args)).not.toContain('5656');
          expect(JSON.stringify(args)).not.toContain('0000');
        }
      }
    } finally {
      for (const spy of spies) {
        spy.mockRestore();
      }
    }
  });

  it('rejects setup when a PIN already exists', async () => {
    await request(ctx.app).post('/api/auth/setup').send({ pin: '1010' });
    const again = await request(ctx.app)
      .post('/api/auth/setup')
      .send({ pin: '2020' });
    expect(again.status).toBe(409);
  });

  it('initializes security_settings on a new database', () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'worthlog-new-pin-'));
    const db = openDatabase(dataDir);
    try {
      const security = getSecuritySettings(db);
      expect(security.pinEnabled).toBe(false);
      expect(security.pinHash).toBeNull();
    } finally {
      db.close();
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('serves the SPA fallback without intercepting auth API routes', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'worthlog-static-auth-'));
    const db = openDatabase(dataDir);
    const app = createApp(db, { dataDir });
    try {
      const response = await request(app).get('/api/auth/status');
      expect(response.status).toBe(200);
      expect(response.body.data.pinEnabled).toBe(false);
    } finally {
      db.close();
      rmSync(dataDir, { recursive: true, force: true });
    }
  });
});
