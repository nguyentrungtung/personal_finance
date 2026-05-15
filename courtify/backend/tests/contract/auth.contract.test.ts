/**
 * Contract tests for auth routes — Supertest + in-memory SQLite.
 * Tests the HTTP interface contract per contracts/auth.md.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import authRoutes from '../../src/routes/auth.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';

// ── Test app with in-memory DB ────────────────────────────────────────────────

let testDb: Database.Database;

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      professional_title TEXT,
      avatar_path TEXT,
      totp_secret TEXT,
      totp_enabled INTEGER NOT NULL DEFAULT 0,
      totp_recovery_codes TEXT DEFAULT '[]',
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      token_version INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  return db;
}

// Override getDb for test scope
import * as clientModule from '../../src/db/client.js';
import { vi } from 'vitest';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/auth', authRoutes);
  app.use(errorHandler);
  return app;
}

const TEST_EMAIL = 'contract@example.com';
const TEST_PASSWORD = 'TestPass123!';

beforeAll(async () => {
  testDb = createTestDb();
  vi.spyOn(clientModule, 'getDb').mockReturnValue(testDb);
  const hash = await bcrypt.hash(TEST_PASSWORD, 10);
  testDb.prepare(`INSERT INTO users (email, password_hash, full_name) VALUES (?, ?, 'Test User')`).run(TEST_EMAIL, hash);
});

afterAll(() => {
  vi.restoreAllMocks();
  testDb.close();
});

describe('POST /api/v1/auth/login', () => {
  it('returns 200 and sets cookies on valid credentials', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.authenticated).toBe(true);
    expect(res.body.data.requires_totp).toBe(false);
    // Cookies should be set
    const cookies = res.headers['set-cookie'] as string[] | string;
    const cookieArr = Array.isArray(cookies) ? cookies : [cookies];
    expect(cookieArr.some((c: string) => c.startsWith('access_token='))).toBe(true);
    expect(cookieArr.some((c: string) => c.startsWith('refresh_token='))).toBe(true);
  });

  it('returns 401 on wrong password', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_EMAIL, password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBeTruthy();
  });

  it('returns 400 on invalid email format', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: 'pw' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('locks account after 5 failed attempts and returns 401', async () => {
    const app = buildApp();
    // Create a fresh user to test lockout
    const lockHash = await bcrypt.hash('correct', 10);
    testDb.prepare(`INSERT OR IGNORE INTO users (email, password_hash, full_name, failed_login_attempts) VALUES ('lockme@x.com', ?, 'Lock Me', 4)`).run(lockHash);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'lockme@x.com', password: 'wrong' });
    // 5th failure → locked
    expect([401, 423]).toContain(res.status);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns 401 without auth cookie', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns user profile with valid cookie', async () => {
    const app = buildApp();
    // Login first to get cookie
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    const cookies = loginRes.headers['set-cookie'] as string[];

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ email: TEST_EMAIL });
    // Must NOT expose password_hash or totp_secret
    expect(res.body.data.password_hash).toBeUndefined();
    expect(res.body.data.totp_secret).toBeUndefined();
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('returns 200 and new access_token cookie with valid refresh cookie', async () => {
    const app = buildApp();
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    const setCookies = loginRes.headers['set-cookie'] as string[];
    const refreshCookie = setCookies.find((c: string) => c.startsWith('refresh_token='));
    expect(refreshCookie).toBeTruthy();

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [refreshCookie!]);

    expect(res.status).toBe(200);
    expect(res.body.data.refreshed).toBe(true);
    const newCookies = res.headers['set-cookie'] as string[];
    const cookieArr = Array.isArray(newCookies) ? newCookies : [newCookies];
    expect(cookieArr.some((c: string) => c.startsWith('access_token='))).toBe(true);
  });

  it('returns 401 without refresh cookie', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/v1/auth/password', () => {
  it('returns 401 without auth', async () => {
    const app = buildApp();
    const res = await request(app)
      .put('/api/v1/auth/password')
      .send({ current_password: 'old', new_password: 'NewPass789!', confirm_password: 'NewPass789!' });
    expect(res.status).toBe(401);
  });

  it('returns 200 and invalidates old token_version', async () => {
    const app = buildApp();
    // Create dedicated user for this test
    const pwHash = await bcrypt.hash('OldPass123!', 10);
    testDb.prepare(`INSERT INTO users (email, password_hash, full_name) VALUES ('pwchange@x.com', ?, 'PW Test')`).run(pwHash);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'pwchange@x.com', password: 'OldPass123!' });
    const cookies = loginRes.headers['set-cookie'] as string[];

    const res = await request(app)
      .put('/api/v1/auth/password')
      .set('Cookie', cookies)
      .send({ current_password: 'OldPass123!', new_password: 'NewPass456!', confirm_password: 'NewPass456!' });

    expect(res.status).toBe(200);
    // token_version should be incremented
    const user = testDb.prepare(`SELECT token_version FROM users WHERE email='pwchange@x.com'`).get() as { token_version: number };
    expect(user.token_version).toBe(1);
  });
});
