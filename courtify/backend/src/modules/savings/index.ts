import type Database from 'better-sqlite3';
import { SavingsRepository } from './savings.repository.js';
import { SavingsService } from './savings.service.js';
import { createSavingsRouter } from './savings.routes.js';
import type { LedgerService } from '../ledger/ledger.service.js';
import type { DashboardService } from '../dashboard/dashboard.service.js';

export function createSavingsModule(
  db: Database.Database,
  ledgerService: LedgerService,
  dashboardService: DashboardService,
) {
  const repository = new SavingsRepository(db);
  const service = new SavingsService(repository, ledgerService, dashboardService);
  const router = createSavingsRouter(service);
  return { router, service, repository };
}

export type { SavingsService };
