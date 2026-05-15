import type Database from 'better-sqlite3';
import { AuthRepository } from './auth.repository.js';
import { createAuthRouter } from './auth.routes.js';

export function createAuthModule(db: Database.Database) {
  const repository = new AuthRepository(db);
  const router = createAuthRouter(db);
  return { router, repository };
}
