import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import { getDb, closeDb } from '../../src/db/client.js';

let cookies: string[] = [];

beforeAll(async () => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: process.env.INIT_EMAIL ?? 'admin@test.com', password: process.env.INIT_PASSWORD ?? 'password' });
  cookies = res.headers['set-cookie'] ?? [];
});

afterAll(() => closeDb());

describe('GET /api/v1/institutions', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/institutions');
    expect(res.status).toBe(401);
  });

  it('returns only active institutions by default', async () => {
    // Create and archive one
    const createRes = await request(app).post('/api/v1/institutions').set('Cookie', cookies)
      .send({ name: 'Archive Test Bank', type: 'bank' });
    const id = createRes.body.data.id;
    await request(app).post(`/api/v1/institutions/${id}/archive`).set('Cookie', cookies);

    const res = await request(app).get('/api/v1/institutions').set('Cookie', cookies);
    expect(res.status).toBe(200);
    const ids = (res.body.data as Record<string, unknown>[]).map(i => i.id);
    expect(ids).not.toContain(id);
  });

  it('include_archived=true includes archived with (Archived) label', async () => {
    const createRes = await request(app).post('/api/v1/institutions').set('Cookie', cookies)
      .send({ name: 'Archive Label Bank', type: 'bank' });
    const id = createRes.body.data.id;
    await request(app).post(`/api/v1/institutions/${id}/archive`).set('Cookie', cookies);

    const res = await request(app).get('/api/v1/institutions?include_archived=true').set('Cookie', cookies);
    expect(res.status).toBe(200);
    const found = (res.body.data as Record<string, unknown>[]).find(i => i.id === id);
    expect(found).toBeTruthy();
    expect((found!.display_name as string)).toContain('(Archived)');
  });
});

describe('DELETE /api/v1/institutions/:id', () => {
  it('returns 422 when institution is referenced', async () => {
    const createRes = await request(app).post('/api/v1/institutions').set('Cookie', cookies)
      .send({ name: 'Referenced Bank', type: 'bank' });
    const id = createRes.body.data.id;

    const db = getDb();
    db.prepare("INSERT INTO ledger_entries (asset_class_id, institution_id, entry_type, description, amount, transaction_date) VALUES (1, ?, 'other', 'test', '1000', '2026-01-01')").run(id);

    const res = await request(app).delete(`/api/v1/institutions/${id}`).set('Cookie', cookies);
    expect(res.status).toBe(422);
  });
});

describe('POST /api/v1/institutions/:id/restore', () => {
  it('returns 200 after restore', async () => {
    const createRes = await request(app).post('/api/v1/institutions').set('Cookie', cookies)
      .send({ name: 'Restore Bank', type: 'bank' });
    const id = createRes.body.data.id;
    await request(app).post(`/api/v1/institutions/${id}/archive`).set('Cookie', cookies);
    const res = await request(app).post(`/api/v1/institutions/${id}/restore`).set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.data.archived_at).toBeNull();
  });
});
