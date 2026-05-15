import type Database from 'better-sqlite3';
import { LedgerRepository } from './ledger.repository.js';
import { LedgerService } from './ledger.service.js';
import { createLedgerRouter } from './ledger.routes.js';
import type { DashboardService } from '../dashboard/dashboard.service.js';

export function createLedgerModule(db: Database.Database, dashboardService: DashboardService) {
  const repository = new LedgerRepository(db);
  const service = new LedgerService(repository, dashboardService);
  const router = createLedgerRouter(service);
  return { router, service, repository };
}

export type { LedgerService };
