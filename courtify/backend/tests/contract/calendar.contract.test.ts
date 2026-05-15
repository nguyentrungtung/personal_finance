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

const BASE_EVENT = {
  title: 'Contract Test Event',
  event_type: 'other',
  due_date: '2027-06-01',
};

describe('GET /api/v1/calendar', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/calendar');
    expect(res.status).toBe(401);
  });

  it('without include_dismissed excludes dismissed events', async () => {
    const createRes = await request(app).post('/api/v1/calendar').set('Cookie', cookies).send(BASE_EVENT);
    const id = createRes.body.data.id;
    await request(app).patch(`/api/v1/calendar/${id}/dismiss`).set('Cookie', cookies);
    const res = await request(app).get('/api/v1/calendar').set('Cookie', cookies);
    expect(res.status).toBe(200);
    const ids = (res.body.data as Record<string, unknown>[]).map(e => e.id);
    expect(ids).not.toContain(id);
  });

  it('include_dismissed=true includes dismissed events', async () => {
    const createRes = await request(app).post('/api/v1/calendar').set('Cookie', cookies).send(BASE_EVENT);
    const id = createRes.body.data.id;
    await request(app).patch(`/api/v1/calendar/${id}/dismiss`).set('Cookie', cookies);
    const res = await request(app).get('/api/v1/calendar?include_dismissed=true').set('Cookie', cookies);
    expect(res.status).toBe(200);
    const ids = (res.body.data as Record<string, unknown>[]).map(e => e.id);
    expect(ids).toContain(id);
  });
});

describe('PATCH /api/v1/calendar/:id/dismiss', () => {
  it('returns 200 + is_dismissed=1', async () => {
    const createRes = await request(app).post('/api/v1/calendar').set('Cookie', cookies).send(BASE_EVENT);
    const id = createRes.body.data.id;
    const res = await request(app).patch(`/api/v1/calendar/${id}/dismiss`).set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.data.is_dismissed).toBe(1);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).patch('/api/v1/calendar/1/dismiss');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/calendar', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/v1/calendar').send(BASE_EVENT);
    expect(res.status).toBe(401);
  });

  it('creates event with days_until field', async () => {
    const res = await request(app).post('/api/v1/calendar').set('Cookie', cookies).send(BASE_EVENT);
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('days_until');
  });
});
