import type Database from 'better-sqlite3';
import type { CronEngine } from '../../infrastructure/scheduler/cron.engine.js';
import { EmailService } from '../../infrastructure/scheduler/email.service.js';
import { SchedulerRepository } from './scheduler.repository.js';
import { SchedulerService } from './scheduler.service.js';
import { createSchedulerRouter } from './scheduler.routes.js';

export function createSchedulerModule(db: Database.Database, cronEngine: CronEngine) {
  const repository = new SchedulerRepository(db);
  const email = new EmailService();
  const service = new SchedulerService(repository, email, cronEngine);
  const router = createSchedulerRouter(service);
  return { router, service, repository };
}

export type { SchedulerService };
