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

describe('GET /api/v1/analytics/net-worth', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/analytics/net-worth');
    expect(res.status).toBe(401);
  });

  it('returns 200 with array of {date, total_value}', async () => {
    const res = await request(app).get('/api/v1/analytics/net-worth?range=3M').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length > 0) {
      expect(res.body.data[0]).toHaveProperty('date');
      expect(res.body.data[0]).toHaveProperty('total_value');
    }
  });
});

describe('GET /api/v1/analytics/projection', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/analytics/projection');
    expect(res.status).toBe(401);
  });

  it('returns projected data points', async () => {
    const res = await request(app).get('/api/v1/analytics/projection').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    // May be 0 if insufficient history, or 3 if enough history
    expect(res.body.data.length).toBeGreaterThanOrEqual(0);
    expect(res.body.data.length).toBeLessThanOrEqual(3);
  });
});

describe('GET /api/v1/analytics/pnl', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/analytics/pnl');
    expect(res.status).toBe(401);
  });

  it('returns {total_realized_pnl, by_class}', async () => {
    const res = await request(app).get('/api/v1/analytics/pnl').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('total_realized_pnl');
    expect(res.body.data).toHaveProperty('by_class');
    expect(Array.isArray(res.body.data.by_class)).toBe(true);
  });
});
