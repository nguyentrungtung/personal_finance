import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import { closeDb } from '../../src/db/client.js';

let cookies: string[] = [];

beforeAll(async () => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: process.env.INIT_EMAIL ?? 'admin@test.com', password: process.env.INIT_PASSWORD ?? 'password' });
  cookies = res.headers['set-cookie'] ?? [];
});

afterAll(() => closeDb());

const BASE_BUY = {
  asset_class_id: 2,
  asset_name: 'CONTRACT_TEST_ASSET',
  asset_subtype: 'stock',
  purchase_date: '2026-01-01',
  volume: '100.0000',
  buy_price_per_unit: '90000.0000',
  current_price_per_unit: '100000.0000',
};

describe('POST /api/v1/lots (BUY)', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/v1/lots').send(BASE_BUY);
    expect(res.status).toBe(401);
  });

  it('creates lot and returns 201', async () => {
    const res = await request(app).post('/api/v1/lots').set('Cookie', cookies).send(BASE_BUY);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ asset_name: 'CONTRACT_TEST_ASSET' });
  });
});

describe('POST /api/v1/lots/sell (SELL)', () => {
  it('sell > available volume returns 422', async () => {
    await request(app).post('/api/v1/lots').set('Cookie', cookies).send({
      ...BASE_BUY, asset_name: 'SELL_TEST_ASSET',
    });
    const res = await request(app).post('/api/v1/lots/sell').set('Cookie', cookies).send({
      asset_name: 'SELL_TEST_ASSET',
      sell_volume: 999999,
      sell_price: 110000,
      date: '2026-06-01',
    });
    expect(res.status).toBe(422);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/v1/lots/sell').send({});
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/lots?view=aggregated', () => {
  it('returns single row per asset_name with weighted_avg_cost', async () => {
    const assetName = 'AGG_TEST_ASSET_' + Date.now();
    await request(app).post('/api/v1/lots').set('Cookie', cookies).send({ ...BASE_BUY, asset_name: assetName });
    await request(app).post('/api/v1/lots').set('Cookie', cookies).send({
      ...BASE_BUY, asset_name: assetName, purchase_date: '2026-02-01', buy_price_per_unit: '110000.0000',
    });
    const res = await request(app)
      .get(`/api/v1/lots?view=aggregated&asset_class=markets`)
      .set('Cookie', cookies);
    expect(res.status).toBe(200);
    const row = (res.body.data as Record<string, unknown>[]).find(r => r.asset_name === assetName);
    expect(row).toBeTruthy();
    expect(row).toHaveProperty('weighted_avg_cost');
  });
});

describe('PATCH /api/v1/lots/:id/price', () => {
  it('updates price and returns 200', async () => {
    const createRes = await request(app).post('/api/v1/lots').set('Cookie', cookies).send(BASE_BUY);
    const id = createRes.body.data.id;
    const res = await request(app)
      .patch(`/api/v1/lots/${id}/price`)
      .set('Cookie', cookies)
      .send({ current_price_per_unit: '120000.0000' });
    expect(res.status).toBe(200);
    expect(res.body.data.current_price_per_unit).toBe('120000.0000');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).patch('/api/v1/lots/1/price').send({ current_price_per_unit: '100000.0000' });
    expect(res.status).toBe(401);
  });
});

describe('Asset transactions are append-only', () => {
  it('no UPDATE/DELETE endpoints exist on /api/v1/lots for asset_transactions', async () => {
    // Confirm there are no PATCH/DELETE routes for transactions
    const deleteRes = await request(app).delete('/api/v1/lots/transactions/1').set('Cookie', cookies);
    // Should 404 (not 200/403) since route doesn't exist
    expect(deleteRes.status).toBe(404);
  });
});
