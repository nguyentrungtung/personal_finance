import type Database from 'better-sqlite3';
import { DashboardRepository } from './dashboard.repository.js';
import { DashboardService } from './dashboard.service.js';
import { createDashboardRouter } from './dashboard.routes.js';

export function createDashboardModule(db: Database.Database) {
  const repository = new DashboardRepository(db);
  const service = new DashboardService(repository);
  const router = createDashboardRouter(service);
  return { router, service, repository };
}

export type { DashboardService };
