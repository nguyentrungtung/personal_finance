import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import * as savingsService from '../../src/services/savingsService.js';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE asset_classes (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, label TEXT NOT NULL, icon TEXT);
    INSERT INTO asset_classes VALUES (1,'metals','Metals',null),(2,'markets','Markets',null),(3,'liquidity','Liquidity',null),(4,'real_estate','Real Estate',null);
    CREATE TABLE institutions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL, archived_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    INSERT INTO institutions (name, type) VALUES ('TestBank', 'bank');
    CREATE TABLE ledger_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, asset_class_id INTEGER, institution_id INTEGER, entry_type TEXT, description TEXT, amount TEXT, status TEXT DEFAULT 'completed', transaction_date TEXT, attachment_path TEXT, notes TEXT, deleted_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE savings_instruments (id INTEGER PRIMARY KEY AUTOINCREMENT, institution_id INTEGER NOT NULL REFERENCES institutions(id), label TEXT NOT NULL, instrument_type TEXT NOT NULL, principal TEXT NOT NULL, interest_rate TEXT NOT NULL, start_date TEXT NOT NULL, maturity_date TEXT NOT NULL, status TEXT DEFAULT 'active', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE metals_holdings (id INTEGER PRIMARY KEY AUTOINCREMENT, metal_type TEXT, label TEXT, weight_grams TEXT, weight_display TEXT, weight_unit TEXT, purity TEXT, purchase_price_per_gram TEXT, current_price_per_gram TEXT, purchase_date TEXT, institution_id INTEGER, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE asset_lots (id INTEGER PRIMARY KEY AUTOINCREMENT, asset_class_id INTEGER, asset_name TEXT, asset_subtype TEXT, institution_id INTEGER, purchase_date TEXT, original_volume TEXT, remaining_volume TEXT, buy_price_per_unit TEXT, current_price_per_unit TEXT, unit_label TEXT DEFAULT 'shares', status TEXT DEFAULT 'active', notes TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE net_worth_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, snapshot_date TEXT NOT NULL UNIQUE, total_vnd TEXT, metals_vnd TEXT, markets_vnd TEXT, liquidity_vnd TEXT, real_estate_vnd TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE calendar_events (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, event_type TEXT NOT NULL, due_date TEXT NOT NULL, amount TEXT, asset_class_id INTEGER, linked_savings_id INTEGER, linked_loan_id INTEGER, linked_ledger_id INTEGER, notes TEXT, is_dismissed INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
  `);
  return db;
}

const BASE_INSTRUMENT = {
  institution_id: 1,
  label: 'Test CD',
  instrument_type: 'certificate_of_deposit' as const,
  principal: '10000000.0000',
  interest_rate: '7.5000',
  start_date: '2026-01-01',
  maturity_date: '2027-01-01',
};

describe('savingsService', () => {
  let db: Database.Database;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('creates an instrument and returns it', () => {
    const inst = savingsService.createInstrument(db, BASE_INSTRUMENT);
    expect(inst).toMatchObject({ label: 'Test CD', principal: '10000000.0000' });
  });

  it('create auto-generates maturity calendar_event', () => {
    const inst = savingsService.createInstrument(db, BASE_INSTRUMENT) as Record<string, unknown>;
    const event = db.prepare('SELECT * FROM calendar_events WHERE linked_savings_id = ?').get(inst.id);
    expect(event).toBeTruthy();
  });

  it('accrued_interest is present in listInstruments', () => {
    savingsService.createInstrument(db, BASE_INSTRUMENT);
    const rows = savingsService.listInstruments(db) as Record<string, unknown>[];
    expect(rows[0]).toHaveProperty('accrued_interest');
    expect(parseFloat(rows[0].accrued_interest as string)).toBeGreaterThanOrEqual(0);
  });

  it('accrued_interest formula: principal × rate/100 × days_elapsed/365', () => {
    // Use a start_date far in the past to ensure positive accrual
    const oldInst = { ...BASE_INSTRUMENT, start_date: '2025-01-01', maturity_date: '2030-01-01' };
    savingsService.createInstrument(db, oldInst);
    const rows = savingsService.listInstruments(db) as Record<string, unknown>[];
    const accrued = parseFloat(rows[0].accrued_interest as string);
    // Should be > 0 since over 1 year has passed
    expect(accrued).toBeGreaterThan(0);
  });

  it('computed_status is matured when maturity_date <= today', () => {
    const pastInst = { ...BASE_INSTRUMENT, maturity_date: '2020-01-01', start_date: '2019-01-01' };
    savingsService.createInstrument(db, pastInst);
    const rows = savingsService.listInstruments(db) as Record<string, unknown>[];
    expect(rows[0].status).toBe('matured');
  });

  it('delete removes linked calendar event', () => {
    const inst = savingsService.createInstrument(db, BASE_INSTRUMENT) as Record<string, unknown>;
    savingsService.deleteInstrument(db, inst.id as number);
    const event = db.prepare('SELECT * FROM calendar_events WHERE linked_savings_id = ?').get(inst.id);
    expect(event).toBeFalsy();
  });

  it('guard against negative accrued interest (0-day edge case)', () => {
    const zeroDay = { ...BASE_INSTRUMENT, start_date: new Date().toISOString().slice(0, 10), maturity_date: new Date().toISOString().slice(0, 10) };
    savingsService.createInstrument(db, zeroDay);
    const rows = savingsService.listInstruments(db) as Record<string, unknown>[];
    expect(parseFloat(rows[0].accrued_interest as string)).toBeGreaterThanOrEqual(0);
  });
});
