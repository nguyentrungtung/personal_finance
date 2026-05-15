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

const BASE_METAL = {
  metal_type: 'gold',
  weight_display: 1,
  weight_unit: 'chi',
  purity: '99.9900',
  purchase_price_per_gram: '2000000.0000',
  current_price_per_gram: '2500000.0000',
  purchase_date: '2026-01-01',
};

describe('POST /api/v1/metals', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/v1/metals').send(BASE_METAL);
    expect(res.status).toBe(401);
  });

  it('with weight_unit=chi stores weight_grams = input × 3.75', async () => {
    const res = await request(app)
      .post('/api/v1/metals')
      .set('Cookie', cookies)
      .send({ ...BASE_METAL, weight_display: 2, weight_unit: 'chi' });
    expect(res.status).toBe(201);
    expect(parseFloat(res.body.data.weight_grams)).toBeCloseTo(7.5, 2);
  });

  it('returns 400 for invalid weight_unit', async () => {
    const res = await request(app)
      .post('/api/v1/metals')
      .set('Cookie', cookies)
      .send({ ...BASE_METAL, weight_unit: 'ounce' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/metals', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/metals');
    expect(res.status).toBe(401);
  });

  it('returns unrealised_gain field', async () => {
    await request(app).post('/api/v1/metals').set('Cookie', cookies).send(BASE_METAL);
    const res = await request(app).get('/api/v1/metals').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('unrealised_gain');
  });
});
