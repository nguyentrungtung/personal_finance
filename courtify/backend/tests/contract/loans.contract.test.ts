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

const BASE_LOAN = {
  loan_type: 'lent',
  counterparty_name: 'Contract Test Person',
  principal: '5000000.0000',
  date_issued: '2026-01-01',
  expected_due_date: '2027-01-01',
};

describe('GET /api/v1/loans', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/loans');
    expect(res.status).toBe(401);
  });

  it('returns 200 with remaining_balance and status', async () => {
    const res = await request(app).get('/api/v1/loans').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    if (res.body.data.length > 0) {
      expect(res.body.data[0]).toHaveProperty('remaining_balance');
      expect(res.body.data[0]).toHaveProperty('status');
    }
  });
});

describe('POST /api/v1/loans', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/v1/loans').send(BASE_LOAN);
    expect(res.status).toBe(401);
  });

  it('creates loan and returns 201', async () => {
    const res = await request(app).post('/api/v1/loans').set('Cookie', cookies).send(BASE_LOAN);
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('remaining_balance');
    expect(parseFloat(res.body.data.remaining_balance)).toBeCloseTo(5000000, 0);
  });
});

describe('POST /api/v1/loans/:id/payments', () => {
  it('overpayment returns 422', async () => {
    const createRes = await request(app).post('/api/v1/loans').set('Cookie', cookies).send(BASE_LOAN);
    const id = createRes.body.data.id;
    const res = await request(app)
      .post(`/api/v1/loans/${id}/payments`)
      .set('Cookie', cookies)
      .send({ paid_amount: '99999999.0000', due_date: '2026-06-01' });
    expect(res.status).toBe(422);
  });
});

describe('DELETE /api/v1/loans/:id', () => {
  it('delete with existing payments returns 422 without force', async () => {
    const createRes = await request(app).post('/api/v1/loans').set('Cookie', cookies).send(BASE_LOAN);
    const id = createRes.body.data.id;
    await request(app)
      .post(`/api/v1/loans/${id}/payments`)
      .set('Cookie', cookies)
      .send({ paid_amount: '1000000.0000', due_date: '2026-06-01' });
    const res = await request(app).delete(`/api/v1/loans/${id}`).set('Cookie', cookies);
    expect(res.status).toBe(422);
  });
});
