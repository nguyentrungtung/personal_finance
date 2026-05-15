import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import dashboardRoutes from '../../src/routes/dashboard.js';
import authRoutes from '../../src/routes/auth.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import * as clientModule from '../../src/db/client.js';

let testDb: Database.Database;

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, full_name TEXT NOT NULL, professional_title TEXT, avatar_path TEXT, totp_secret TEXT, totp_enabled INTEGER NOT NULL DEFAULT 0, totp_recovery_codes TEXT DEFAULT '[]', failed_login_attempts INTEGER NOT NULL DEFAULT 0, locked_until TEXT, token_version INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE asset_classes (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, label TEXT NOT NULL, icon TEXT);
    INSERT INTO asset_classes VALUES (1,'metals','Metals',null),(2,'markets','Markets',null),(3,'liquidity','Liquidity',null),(4,'real_estate','Real Estate',null);
    CREATE TABLE institutions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL, archived_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE ledger_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, asset_class_id INTEGER, institution_id INTEGER, entry_type TEXT, description TEXT, amount TEXT, status TEXT DEFAULT 'completed', transaction_date TEXT, attachment_path TEXT, notes TEXT, deleted_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE savings_instruments (id INTEGER PRIMARY KEY AUTOINCREMENT, institution_id INTEGER, label TEXT, instrument_type TEXT, principal TEXT, interest_rate TEXT, start_date TEXT, maturity_date TEXT, status TEXT DEFAULT 'active', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE metals_holdings (id INTEGER PRIMARY KEY AUTOINCREMENT, metal_type TEXT, label TEXT, weight_grams TEXT, weight_display TEXT, weight_unit TEXT, purity TEXT, purchase_price_per_gram TEXT, current_price_per_gram TEXT, purchase_date TEXT, institution_id INTEGER, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE asset_lots (id INTEGER PRIMARY KEY AUTOINCREMENT, asset_class_id INTEGER, asset_name TEXT, asset_subtype TEXT, institution_id INTEGER, purchase_date TEXT, original_volume TEXT, remaining_volume TEXT, buy_price_per_unit TEXT, current_price_per_unit TEXT, unit_label TEXT DEFAULT 'shares', status TEXT DEFAULT 'active', notes TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE net_worth_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, snapshot_date TEXT NOT NULL UNIQUE, total_vnd TEXT, metals_vnd TEXT, markets_vnd TEXT, liquidity_vnd TEXT, real_estate_vnd TEXT, created_at TEXT DEFAULT (datetime('now')));
  `);
  return db;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/dashboard', dashboardRoutes);
  app.use(errorHandler);
  return app;
}

async function getAuthCookies(app: express.Express) {
  const res = await request(app).post('/api/v1/auth/login').send({ email: 'dash@x.com', password: 'DashPass123!' });
  return res.headers['set-cookie'] as string[];
}

beforeAll(async () => {
  testDb = createTestDb();
  vi.spyOn(clientModule, 'getDb').mockReturnValue(testDb);
  const hash = await bcrypt.hash('DashPass123!', 10);
  testDb.prepare(`INSERT INTO users (email, password_hash, full_name) VALUES ('dash@x.com', ?, 'Dash User')`).run(hash);
});

afterAll(() => {
  vi.restoreAllMocks();
  testDb.close();
});

describe('GET /api/v1/dashboard', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await request(buildApp()).get('/api/v1/dashboard');
    expect(res.status).toBe(401);
  });

  it('returns 200 with correct payload shape when authenticated', async () => {
    const app = buildApp();
    const cookies = await getAuthCookies(app);
    const res = await request(app).get('/api/v1/dashboard').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      net_worth: expect.objectContaining({ total_vnd: expect.any(String) }),
      asset_cards: expect.arrayContaining([
        expect.objectContaining({ code: expect.any(String), total_vnd: expect.any(String) })
      ]),
      allocation: expect.any(Array),
      recent_ledger: expect.any(Array),
    });
  });

  it('does not leak internal DB fields', async () => {
    const app = buildApp();
    const cookies = await getAuthCookies(app);
    const res = await request(app).get('/api/v1/dashboard').set('Cookie', cookies);
    // No raw DB IDs or internal metadata in net_worth
    expect(res.body.data.net_worth.id).toBeUndefined();
  });
});
