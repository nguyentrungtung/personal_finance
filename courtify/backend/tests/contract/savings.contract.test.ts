import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import { getDb, closeDb } from '../../src/db/client.js';

let cookies: string[] = [];
let institutionId: number;

beforeAll(async () => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: process.env.INIT_EMAIL ?? 'admin@test.com', password: process.env.INIT_PASSWORD ?? 'password' });
  cookies = res.headers['set-cookie'] ?? [];

  const db = getDb();
  const inst = db.prepare("INSERT INTO institutions (name, type) VALUES ('Contract Bank', 'bank')").run();
  institutionId = inst.lastInsertRowid as number;
});

afterAll(() => closeDb());

const baseInstrument = () => ({
  institution_id: institutionId,
  label: 'Contract CD',
  instrument_type: 'certificate_of_deposit',
  principal: '5000000.0000',
  interest_rate: '6.5000',
  start_date: '2026-01-01',
  maturity_date: '2027-01-01',
});

describe('GET /api/v1/savings', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/savings');
    expect(res.status).toBe(401);
  });

  it('returns 200 with accrued_interest field', async () => {
    await request(app).post('/api/v1/savings').set('Cookie', cookies).send(baseInstrument());
    const res = await request(app).get('/api/v1/savings').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('accrued_interest');
  });
});

describe('POST /api/v1/savings', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/v1/savings').send(baseInstrument());
    expect(res.status).toBe(401);
  });

  it('creates instrument and linked calendar event', async () => {
    const res = await request(app).post('/api/v1/savings').set('Cookie', cookies).send(baseInstrument());
    expect(res.status).toBe(201);
    const id = res.body.data.id;
    const db = getDb();
    const event = db.prepare('SELECT * FROM calendar_events WHERE linked_savings_id = ?').get(id);
    expect(event).toBeTruthy();
  });
});

describe('DELETE /api/v1/savings/:id', () => {
  it('deletes instrument and linked calendar event', async () => {
    const createRes = await request(app).post('/api/v1/savings').set('Cookie', cookies).send(baseInstrument());
    const id = createRes.body.data.id;

    const res = await request(app).delete(`/api/v1/savings/${id}`).set('Cookie', cookies);
    expect(res.status).toBe(200);

    const db = getDb();
    const event = db.prepare('SELECT * FROM calendar_events WHERE linked_savings_id = ?').get(id);
    expect(event).toBeFalsy();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).delete('/api/v1/savings/1');
    expect(res.status).toBe(401);
  });
});
