import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { getDb } from './infrastructure/db/client.js';
import { errorHandler } from './infrastructure/middleware/errorHandler.middleware.js';
import { createAuthModule } from './modules/auth/index.js';
import { createDashboardModule } from './modules/dashboard/index.js';
import { createLedgerModule } from './modules/ledger/index.js';
import { createMetalsModule } from './modules/metals/index.js';
import { createSavingsModule } from './modules/savings/index.js';
import { createLoansModule } from './modules/loans/index.js';
import { createInvestmentModule } from './modules/investment/index.js';
import { createInstitutionsModule } from './modules/institutions/index.js';
import { createSettingsModule } from './modules/settings/index.js';
import { createAnalyticsModule } from './modules/analytics/index.js';
import { createCalendarModule } from './modules/calendar/index.js';
import { createSchedulerModule } from './modules/scheduler/index.js';
import type { CronEngine } from './infrastructure/scheduler/cron.engine.js';

const UPLOAD_PATH = process.env.UPLOAD_PATH ?? path.join(process.cwd(), 'uploads');
const ALLOWED_ORIGIN = process.env.FRONTEND_URL ?? 'http://localhost:3000';

export function createApp(cronEngine: CronEngine) {
  const db = getDb();
  const app = express();

  // ─── CORS ─────────────────────────────────────────────────────────────────────
  app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));

  // ─── Body parsing ─────────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  // ─── Static file serving for uploads ─────────────────────────────────────────
  app.use('/uploads', express.static(UPLOAD_PATH));

  // ─── Wire modules (order matters: leaf modules first) ────────────────────────
  const dashboard = createDashboardModule(db);
  const ledger = createLedgerModule(db, dashboard.service);
  const auth = createAuthModule(db);
  const metals = createMetalsModule(db, ledger.service, dashboard.service);
  const savings = createSavingsModule(db, ledger.service, dashboard.service);
  const loans = createLoansModule(db, ledger.service, dashboard.service);
  const investment = createInvestmentModule(db, ledger.service, dashboard.service);
  const institutions = createInstitutionsModule(db);
  const settings = createSettingsModule(db);
  const analytics = createAnalyticsModule(db);
  const calendar = createCalendarModule(db);
  const scheduler = createSchedulerModule(db, cronEngine);

  // ─── Health check ─────────────────────────────────────────────────────────────
  app.get('/api/v1/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ─── API Routes ───────────────────────────────────────────────────────────────
  app.use('/api/v1/auth', auth.router);
  app.use('/api/v1/dashboard', dashboard.router);
  app.use('/api/v1/ledger', ledger.router);
  app.use('/api/v1/metals', metals.router);
  app.use('/api/v1/savings', savings.router);
  app.use('/api/v1/loans', loans.router);
  app.use('/api/v1/lots', investment.router);
  app.use('/api/v1/institutions', institutions.router);
  app.use('/api/v1/settings', settings.router);
  app.use('/api/v1/analytics', analytics.router);
  app.use('/api/v1/calendar', calendar.router);
  app.use('/api/v1/scheduler', scheduler.router);

  // ─── Global error handler ─────────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
