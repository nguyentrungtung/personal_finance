import type Database from 'better-sqlite3';
import { AnalyticsRepository } from './analytics.repository.js';
import { AnalyticsService } from './analytics.service.js';
import { createAnalyticsRouter } from './analytics.routes.js';

export function createAnalyticsModule(db: Database.Database) {
  const repository = new AnalyticsRepository(db);
  const service = new AnalyticsService(repository);
  const router = createAnalyticsRouter(service);
  return { router, service, repository };
}

export type { AnalyticsService };
