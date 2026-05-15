import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import * as ledgerService from '../../src/services/ledgerService.js';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE asset_classes (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, label TEXT NOT NULL, icon TEXT);
    INSERT INTO asset_classes VALUES (1,'metals','Metals',null),(2,'markets','Markets',null),(3,'liquidity','Liquidity',null),(4,'real_estate','Real Estate',null);
    CREATE TABLE institutions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL, archived_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    INSERT INTO institutions (name,type) VALUES ('TestBank','bank');
    CREATE TABLE ledger_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, asset_class_id INTEGER, institution_id INTEGER, entry_type TEXT, description TEXT, amount TEXT, status TEXT DEFAULT 'completed', transaction_date TEXT, attachment_path TEXT, notes TEXT, deleted_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE savings_instruments (id INTEGER PRIMARY KEY AUTOINCREMENT, institution_id INTEGER, label TEXT, instrument_type TEXT, principal TEXT, interest_rate TEXT, start_date TEXT, maturity_date TEXT, status TEXT DEFAULT 'active', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE metals_holdings (id INTEGER PRIMARY KEY AUTOINCREMENT, metal_type TEXT, label TEXT, weight_grams TEXT, weight_display TEXT, weight_unit TEXT, purity TEXT, purchase_price_per_gram TEXT, current_price_per_gram TEXT, purchase_date TEXT, institution_id INTEGER, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE asset_lots (id INTEGER PRIMARY KEY AUTOINCREMENT, asset_class_id INTEGER, asset_name TEXT, asset_subtype TEXT, institution_id INTEGER, purchase_date TEXT, original_volume TEXT, remaining_volume TEXT, buy_price_per_unit TEXT, current_price_per_unit TEXT, unit_label TEXT DEFAULT 'shares', status TEXT DEFAULT 'active', notes TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE net_worth_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, snapshot_date TEXT NOT NULL UNIQUE, total_vnd TEXT, metals_vnd TEXT, markets_vnd TEXT, liquidity_vnd TEXT, real_estate_vnd TEXT, created_at TEXT DEFAULT (datetime('now')));
  `);
  return db;
}

const ENTRY = { asset_class_id: 1, entry_type: 'other' as const, description: 'Test entry', amount: '1000000.0000', transaction_date: '2026-01-01T00:00:00Z' };

describe('ledgerService', () => {
  let db: Database.Database;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('creates an entry and returns it', () => {
    const entry = ledgerService.createEntry(db, ENTRY);
    expect(entry).toMatchObject({ description: 'Test entry', amount: '1000000.0000' });
  });

  it('triggers net_worth_snapshots upsert on create', () => {
    ledgerService.createEntry(db, ENTRY);
    const snap = db.prepare('SELECT * FROM net_worth_snapshots').get();
    expect(snap).toBeTruthy();
  });

  it('listEntries returns only non-deleted entries', () => {
    ledgerService.createEntry(db, ENTRY);
    ledgerService.createEntry(db, { ...ENTRY, description: 'Deleted' });
    const rows = db.prepare('SELECT id FROM ledger_entries').all() as { id: number }[];
    ledgerService.softDeleteEntry(db, rows[1].id);
    const result = ledgerService.listEntries(db, {});
    expect(result.rows).toHaveLength(1);
  });

  it('soft-delete sets deleted_at, row remains in DB', () => {
    const entry = ledgerService.createEntry(db, ENTRY);
    ledgerService.softDeleteEntry(db, entry.id as number);
    const raw = db.prepare('SELECT deleted_at FROM ledger_entries WHERE id = ?').get(entry.id) as { deleted_at: string | null };
    expect(raw.deleted_at).toBeTruthy();
  });

  it('filters by asset_class', () => {
    ledgerService.createEntry(db, { ...ENTRY, asset_class_id: 1 });
    ledgerService.createEntry(db, { ...ENTRY, asset_class_id: 2 });
    const result = ledgerService.listEntries(db, { assetClass: 'metals' });
    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as { asset_class_code: string }).asset_class_code).toBe('metals');
  });

  it('filters by status', () => {
    ledgerService.createEntry(db, { ...ENTRY, status: 'pending' });
    ledgerService.createEntry(db, { ...ENTRY, status: 'completed' });
    const result = ledgerService.listEntries(db, { status: 'pending' });
    expect(result.rows).toHaveLength(1);
  });

  it('paginates correctly', () => {
    for (let i = 0; i < 5; i++) ledgerService.createEntry(db, { ...ENTRY, description: `Entry ${i}` });
    const page1 = ledgerService.listEntries(db, { page: 1 });
    expect(page1.total_count).toBe(5);
  });

  it('updateEntry triggers snapshot upsert', () => {
    const entry = ledgerService.createEntry(db, ENTRY);
    db.prepare('DELETE FROM net_worth_snapshots').run(); // clear
    ledgerService.updateEntry(db, entry.id as number, { description: 'Updated' });
    const snap = db.prepare('SELECT * FROM net_worth_snapshots').get();
    expect(snap).toBeTruthy();
  });
});
