import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import * as loanService from '../../src/services/loanService.js';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE asset_classes (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, label TEXT NOT NULL, icon TEXT);
    INSERT INTO asset_classes VALUES (1,'metals','Metals',null),(2,'markets','Markets',null),(3,'liquidity','Liquidity',null),(4,'real_estate','Real Estate',null);
    CREATE TABLE institutions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL, archived_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE ledger_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, asset_class_id INTEGER, institution_id INTEGER, entry_type TEXT, description TEXT, amount TEXT, status TEXT DEFAULT 'completed', transaction_date TEXT, attachment_path TEXT, notes TEXT, deleted_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE savings_instruments (id INTEGER PRIMARY KEY AUTOINCREMENT, institution_id INTEGER, label TEXT, instrument_type TEXT, principal TEXT, interest_rate TEXT, start_date TEXT, maturity_date TEXT, status TEXT DEFAULT 'active', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE metals_holdings (id INTEGER PRIMARY KEY AUTOINCREMENT, metal_type TEXT, label TEXT, weight_grams TEXT, weight_display TEXT, weight_unit TEXT, purity TEXT, purchase_price_per_gram TEXT, current_price_per_gram TEXT, purchase_date TEXT, institution_id INTEGER, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE asset_lots (id INTEGER PRIMARY KEY AUTOINCREMENT, asset_class_id INTEGER, asset_name TEXT, asset_subtype TEXT, institution_id INTEGER, purchase_date TEXT, original_volume TEXT, remaining_volume TEXT, buy_price_per_unit TEXT, current_price_per_unit TEXT, unit_label TEXT DEFAULT 'shares', status TEXT DEFAULT 'active', notes TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE net_worth_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, snapshot_date TEXT NOT NULL UNIQUE, total_vnd TEXT, metals_vnd TEXT, markets_vnd TEXT, liquidity_vnd TEXT, real_estate_vnd TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE loans (id INTEGER PRIMARY KEY AUTOINCREMENT, loan_type TEXT NOT NULL, counterparty_name TEXT NOT NULL, principal TEXT NOT NULL, date_issued TEXT NOT NULL, expected_due_date TEXT NOT NULL, repayment_terms TEXT, description TEXT, status TEXT DEFAULT 'active', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE loan_payments (id INTEGER PRIMARY KEY AUTOINCREMENT, loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE, scheduled_amount TEXT NOT NULL, paid_amount TEXT DEFAULT '0.0000', paid_date TEXT, due_date TEXT NOT NULL, status TEXT DEFAULT 'scheduled', notes TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE calendar_events (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, event_type TEXT NOT NULL, due_date TEXT NOT NULL, amount TEXT, asset_class_id INTEGER, linked_savings_id INTEGER, linked_loan_id INTEGER, linked_ledger_id INTEGER, notes TEXT, is_dismissed INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
  `);
  return db;
}

const BASE_LOAN = {
  loan_type: 'lent' as const,
  counterparty_name: 'Alice',
  principal: '10000000.0000',
  date_issued: '2026-01-01',
  expected_due_date: '2027-01-01',
};

describe('loanService', () => {
  let db: Database.Database;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('creates a loan and returns it', () => {
    const loan = loanService.createLoan(db, BASE_LOAN);
    expect(loan).toMatchObject({ counterparty_name: 'Alice', principal: '10000000.0000' });
  });

  it('remaining_balance = principal when no payments', () => {
    const loan = loanService.createLoan(db, BASE_LOAN);
    expect((loan as Record<string, unknown>).remaining_balance).toBe('10000000.0000');
  });

  it('remaining_balance reduces after payment', () => {
    const loan = loanService.createLoan(db, BASE_LOAN) as Record<string, unknown>;
    loanService.addPayment(db, loan.id as number, { paid_amount: '3000000.0000', due_date: '2026-06-01' });
    const updated = loanService.getLoanById(db, loan.id as number) as Record<string, unknown>;
    expect(parseFloat(updated.remaining_balance as string)).toBeCloseTo(7000000, 0);
  });

  it('status transitions to overdue when past due date', () => {
    const pastDueLoan = { ...BASE_LOAN, expected_due_date: '2020-01-01' };
    loanService.createLoan(db, pastDueLoan);
    const loans = loanService.listLoans(db, {}) as Record<string, unknown>[];
    expect(loans[0].status).toBe('overdue');
  });

  it('status transitions to settled when balance reaches 0', () => {
    const loan = loanService.createLoan(db, BASE_LOAN) as Record<string, unknown>;
    loanService.addPayment(db, loan.id as number, { paid_amount: '10000000.0000', due_date: '2026-06-01' });
    const loans = loanService.listLoans(db, {}) as Record<string, unknown>[];
    expect(loans[0].status).toBe('settled');
  });

  it('overpayment rejected with BusinessRuleError', () => {
    const loan = loanService.createLoan(db, BASE_LOAN) as Record<string, unknown>;
    expect(() =>
      loanService.addPayment(db, loan.id as number, { paid_amount: '99999999.0000', due_date: '2026-06-01' })
    ).toThrow();
  });

  it('delete with payments throws 422 without force', () => {
    const loan = loanService.createLoan(db, BASE_LOAN) as Record<string, unknown>;
    loanService.addPayment(db, loan.id as number, { paid_amount: '1000000.0000', due_date: '2026-06-01' });
    expect(() => loanService.deleteLoan(db, loan.id as number)).toThrow();
  });

  it('payment auto-creates calendar event when balance settles', () => {
    const loan = loanService.createLoan(db, BASE_LOAN) as Record<string, unknown>;
    loanService.addPayment(db, loan.id as number, { paid_amount: '10000000.0000', due_date: '2026-06-01' });
    const event = db.prepare('SELECT * FROM calendar_events WHERE linked_loan_id = ?').get(loan.id as number);
    expect(event).toBeTruthy();
  });
});
