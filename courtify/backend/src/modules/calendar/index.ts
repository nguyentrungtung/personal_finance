import type Database from 'better-sqlite3';
import { CalendarRepository } from './calendar.repository.js';
import { CalendarService } from './calendar.service.js';
import { createCalendarRouter } from './calendar.routes.js';

export function createCalendarModule(db: Database.Database) {
  const repository = new CalendarRepository(db);
  const service = new CalendarService(repository);
  const router = createCalendarRouter(service);
  return { router, service, repository };
}

export type { CalendarService };
