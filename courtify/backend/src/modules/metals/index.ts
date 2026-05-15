import type Database from 'better-sqlite3';
import { MetalsRepository } from './metals.repository.js';
import { MetalsService } from './metals.service.js';
import { createMetalsRouter } from './metals.routes.js';
import type { LedgerService } from '../ledger/ledger.service.js';
import type { DashboardService } from '../dashboard/dashboard.service.js';

export function createMetalsModule(
  db: Database.Database,
  ledgerService: LedgerService,
  dashboardService: DashboardService,
) {
  const repository = new MetalsRepository(db);
  const service = new MetalsService(repository, ledgerService, dashboardService);
  const router = createMetalsRouter(service);
  return { router, service, repository };
}

export type { MetalsService };
