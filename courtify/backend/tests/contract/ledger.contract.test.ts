import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import { getDb, closeDb } from '../../src/db/client.js';

let cookies: string[] = [];

beforeAll(async () => {
  const db = getDb();
  db.exec(`
    INSERT OR IGNORE INTO asset_classes (id, code, label) VALUES
      (1,'metals','Metals'),(2,'markets','Markets'),(3,'liquidity','Liquidity'),(4,'real_estate','Real Estate');
  `);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: process.env.INIT_EMAIL ?? 'admin@test.com', password: process.env.INIT_PASSWORD ?? 'password' });
  cookies = res.headers['set-cookie'] ?? [];
});

afterAll(() => closeDb());

describe('GET /api/v1/ledger', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/ledger');
    expect(res.status).toBe(401);
  });

  it('returns 200 with correct envelope shape', async () => {
    const res = await request(app).get('/api/v1/ledger').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('error', null);
    expect(res.body).toHaveProperty('meta');
    expect(res.body.meta).toHaveProperty('count');
    expect(res.body.meta).toHaveProperty('current_page');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('filters by asset_class query param', async () => {
    const res = await request(app).get('/api/v1/ledger?asset_class=metals').set('Cookie', cookies);
    expect(res.status).toBe(200);
    for (const row of res.body.data) {
      expect(row.asset_class_code).toBe('metals');
    }
  });
});

describe('POST /api/v1/ledger', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/v1/ledger').send({});
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid body', async () => {
    const res = await request(app)
      .post('/api/v1/ledger')
      .set('Cookie', cookies)
      .send({ description: 'bad' });
    expect(res.status).toBe(400);
  });

  it('creates entry and returns 201', async () => {
    const res = await request(app)
      .post('/api/v1/ledger')
      .set('Cookie', cookies)
      .send({
        asset_class_id: 1,
        entry_type: 'other',
        description: 'Contract test entry',
        amount: '500000.0000',
        transaction_date: '2026-01-15T00:00:00Z',
        status: 'completed',
      });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      description: 'Contract test entry',
      amount: '500000.0000',
      asset_class_code: 'metals',
    });
  });
});

describe('PUT /api/v1/ledger/:id', () => {
  it('updates existing entry', async () => {
    const createRes = await request(app)
      .post('/api/v1/ledger')
      .set('Cookie', cookies)
      .send({
        asset_class_id: 2,
        entry_type: 'other',
        description: 'To update',
        amount: '100000.0000',
        transaction_date: '2026-02-01T00:00:00Z',
      });
    const id = createRes.body.data.id;

    const res = await request(app)
      .put(`/api/v1/ledger/${id}`)
      .set('Cookie', cookies)
      .send({ description: 'Updated desc' });
    expect(res.status).toBe(200);
    expect(res.body.data.description).toBe('Updated desc');
  });

  it('returns 404 for missing entry', async () => {
    const res = await request(app)
      .put('/api/v1/ledger/999999')
      .set('Cookie', cookies)
      .send({ description: 'ghost' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/ledger/:id', () => {
  it('returns 422 without confirm=true', async () => {
    const res = await request(app).delete('/api/v1/ledger/1').set('Cookie', cookies);
    expect(res.status).toBe(422);
  });

  it('soft-deletes entry with confirm=true', async () => {
    const createRes = await request(app)
      .post('/api/v1/ledger')
      .set('Cookie', cookies)
      .send({
        asset_class_id: 3,
        entry_type: 'other',
        description: 'To delete',
        amount: '200000.0000',
        transaction_date: '2026-03-01T00:00:00Z',
      });
    const id = createRes.body.data.id;

    const res = await request(app)
      .delete(`/api/v1/ledger/${id}?confirm=true`)
      .set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.data.deleted_at).toBeTruthy();
  });
});
