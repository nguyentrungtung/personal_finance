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

describe('GET /api/v1/settings', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/settings');
    expect(res.status).toBe(401);
  });

  it('returns settings with notification_days_advance and timezone', async () => {
    const res = await request(app).get('/api/v1/settings').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('notification_days_advance');
    expect(res.body.data).toHaveProperty('timezone');
  });
});

describe('PUT /api/v1/settings/profile', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).put('/api/v1/settings/profile').send({ full_name: 'Test' });
    expect(res.status).toBe(401);
  });

  it('updates profile fields', async () => {
    const res = await request(app).put('/api/v1/settings/profile')
      .set('Cookie', cookies)
      .send({ full_name: 'Updated Name', professional_title: 'CTO' });
    expect(res.status).toBe(200);
    expect(res.body.data.full_name).toBe('Updated Name');
    expect(res.body.data.professional_title).toBe('CTO');
  });

  it('response does NOT include password_hash or totp_secret', async () => {
    const res = await request(app).get('/api/v1/settings/profile').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('password_hash');
    expect(res.body.data).not.toHaveProperty('totp_secret');
  });
});
