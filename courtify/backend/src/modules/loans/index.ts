import type Database from 'better-sqlite3';
import { LoansRepository } from './loans.repository.js';
import { LoansService } from './loans.service.js';
import { createLoansRouter } from './loans.routes.js';
import type { LedgerService } from '../ledger/ledger.service.js';
import type { DashboardService } from '../dashboard/dashboard.service.js';

export function createLoansModule(
  db: Database.Database,
  ledgerService: LedgerService,
  dashboardService: DashboardService,
) {
  const repository = new LoansRepository(db);
  const service = new LoansService(repository, ledgerService, dashboardService);
  const router = createLoansRouter(service);
  return { router, service, repository };
}

export type { LoansService };
