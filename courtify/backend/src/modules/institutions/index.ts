import type Database from 'better-sqlite3';
import { InstitutionsRepository } from './institutions.repository.js';
import { InstitutionsService } from './institutions.service.js';
import { createInstitutionsRouter } from './institutions.routes.js';

export function createInstitutionsModule(db: Database.Database) {
  const repository = new InstitutionsRepository(db);
  const service = new InstitutionsService(repository);
  const router = createInstitutionsRouter(service);
  return { router, service, repository };
}

export type { InstitutionsService };
