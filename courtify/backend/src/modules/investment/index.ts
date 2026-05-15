import type Database from 'better-sqlite3';
import { InvestmentRepository } from './investment.repository.js';
import { InvestmentService } from './investment.service.js';
import { createInvestmentRouter } from './investment.routes.js';
import type { LedgerService } from '../ledger/ledger.service.js';
import type { DashboardService } from '../dashboard/dashboard.service.js';

export function createInvestmentModule(
  db: Database.Database,
  ledgerService: LedgerService,
  dashboardService: DashboardService,
) {
  const repository = new InvestmentRepository(db);
  const service = new InvestmentService(repository, ledgerService, dashboardService);
  const router = createInvestmentRouter(service);
  return { router, service, repository };
}

export type { InvestmentService };
