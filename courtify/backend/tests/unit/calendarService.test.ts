import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import * as calendarService from '../../src/services/calendarService.js';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE asset_classes (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, label TEXT NOT NULL, icon TEXT);
    INSERT INTO asset_classes VALUES (1,'metals','Metals',null),(2,'markets','Markets',null),(3,'liquidity','Liquidity',null),(4,'real_estate','Real Estate',null);
    CREATE TABLE institutions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL, archived_at TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE ledger_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, asset_class_id INTEGER, institution_id INTEGER, entry_type TEXT, description TEXT, amount TEXT, status TEXT DEFAULT 'completed', transaction_date TEXT, deleted_at TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE savings_instruments (id INTEGER PRIMARY KEY AUTOINCREMENT, institution_id INTEGER, label TEXT, instrument_type TEXT, principal TEXT, interest_rate TEXT, start_date TEXT, maturity_date TEXT, status TEXT DEFAULT 'active', created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE loans (id INTEGER PRIMARY KEY AUTOINCREMENT, loan_type TEXT NOT NULL, counterparty_name TEXT NOT NULL, principal TEXT NOT NULL, date_issued TEXT NOT NULL, expected_due_date TEXT NOT NULL, status TEXT DEFAULT 'active', created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE calendar_events (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, event_type TEXT NOT NULL, due_date TEXT NOT NULL, amount TEXT, asset_class_id INTEGER, linked_savings_id INTEGER, linked_loan_id INTEGER, linked_ledger_id INTEGER, notes TEXT, is_dismissed INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
  `);
  return db;
}

const BASE_EVENT = {
  title: 'Test Maturity',
  event_type: 'maturity' as const,
  due_date: '2027-01-01',
};

describe('calendarService', () => {
  let db: Database.Database;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('creates an event and returns days_until', () => {
    const event = calendarService.createEvent(db, BASE_EVENT) as Record<string, unknown>;
    expect(event).toHaveProperty('days_until');
    expect(typeof event.days_until).toBe('number');
  });

  it('days_until is positive for future event', () => {
    const event = calendarService.createEvent(db, BASE_EVENT) as Record<string, unknown>;
    expect(event.days_until as number).toBeGreaterThan(0);
  });

  it('days_until is zero for today event', () => {
    const today = new Date().toISOString().slice(0, 10);
    const event = calendarService.createEvent(db, { ...BASE_EVENT, due_date: today }) as Record<string, unknown>;
    expect(event.days_until).toBe(0);
  });

  it('days_until is negative for past event', () => {
    const event = calendarService.createEvent(db, { ...BASE_EVENT, due_date: '2020-01-01' }) as Record<string, unknown>;
    expect(event.days_until as number).toBeLessThan(0);
  });

  it('events sorted by due_date ASC', () => {
    calendarService.createEvent(db, { ...BASE_EVENT, due_date: '2027-06-01' });
    calendarService.createEvent(db, { ...BASE_EVENT, due_date: '2027-01-01' });
    const events = calendarService.listEvents(db) as Record<string, unknown>[];
    expect(events[0].due_date).toBe('2027-01-01');
    expect(events[1].due_date).toBe('2027-06-01');
  });

  it('dismissed events excluded by default', () => {
    const e = calendarService.createEvent(db, BASE_EVENT) as Record<string, unknown>;
    calendarService.dismissEvent(db, e.id as number);
    const events = calendarService.listEvents(db);
    expect(events).toHaveLength(0);
  });

  it('dismissed events included when include_dismissed=true', () => {
    const e = calendarService.createEvent(db, BASE_EVENT) as Record<string, unknown>;
    calendarService.dismissEvent(db, e.id as number);
    const events = calendarService.listEvents(db, { includeDismissed: true });
    expect(events).toHaveLength(1);
  });

  it('dismissEvent sets is_dismissed=1', () => {
    const e = calendarService.createEvent(db, BASE_EVENT) as Record<string, unknown>;
    calendarService.dismissEvent(db, e.id as number);
    const raw = db.prepare('SELECT is_dismissed FROM calendar_events WHERE id = ?').get(e.id) as Record<string, unknown>;
    expect(raw.is_dismissed).toBe(1);
  });
});
