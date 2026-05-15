import type Database from 'better-sqlite3';
import { SettingsRepository } from './settings.repository.js';
import { SettingsService } from './settings.service.js';
import { createSettingsRouter } from './settings.routes.js';

export function createSettingsModule(db: Database.Database) {
  const repository = new SettingsRepository(db);
  const service = new SettingsService(repository);
  const router = createSettingsRouter(service);
  return { router, service, repository };
}

export type { SettingsService };
