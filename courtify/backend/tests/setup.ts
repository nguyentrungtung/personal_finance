/**
 * Global test setup: run Knex migrations + seed initial user before contract tests.
 * Vitest executes this file before each test file; code at module level runs immediately.
 */
import knex from 'knex';
import knexConfig from '../src/db/knexfile.js';
import { getDb, closeDb } from '../src/db/client.js';
import bcrypt from 'bcryptjs';

const kdb = knex(knexConfig);
await kdb.migrate.latest();
await kdb.destroy();

// Reset the singleton so a fresh connection is opened after migrations
closeDb();

const sqlite = getDb();
const existing = sqlite.prepare('SELECT id FROM users LIMIT 1').get();
if (!existing) {
  const email = process.env.INIT_EMAIL ?? 'admin@test.com';
  const password = process.env.INIT_PASSWORD ?? 'password';
  const hash = await bcrypt.hash(password, 10);
  sqlite
    .prepare(`INSERT INTO users (email, password_hash, full_name) VALUES (?, ?, 'Test Admin')`)
    .run(email, hash);
}
