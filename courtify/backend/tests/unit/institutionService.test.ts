import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import * as institutionService from '../../src/services/institutionService.js';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE asset_classes (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, label TEXT NOT NULL, icon TEXT);
    INSERT INTO asset_classes VALUES (1,'metals','Metals',null),(2,'markets','Markets',null),(3,'liquidity','Liquidity',null),(4,'real_estate','Real Estate',null);
    CREATE TABLE institutions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL, archived_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE ledger_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, asset_class_id INTEGER, institution_id INTEGER, entry_type TEXT, description TEXT, amount TEXT, status TEXT DEFAULT 'completed', transaction_date TEXT, deleted_at TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE savings_instruments (id INTEGER PRIMARY KEY AUTOINCREMENT, institution_id INTEGER, label TEXT, instrument_type TEXT, principal TEXT, interest_rate TEXT, start_date TEXT, maturity_date TEXT, status TEXT DEFAULT 'active', created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE metals_holdings (id INTEGER PRIMARY KEY AUTOINCREMENT, metal_type TEXT, label TEXT, weight_grams TEXT, weight_display TEXT, weight_unit TEXT, purity TEXT, purchase_price_per_gram TEXT, current_price_per_gram TEXT, purchase_date TEXT, institution_id INTEGER, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE asset_lots (id INTEGER PRIMARY KEY AUTOINCREMENT, asset_class_id INTEGER, asset_name TEXT, asset_subtype TEXT, institution_id INTEGER, purchase_date TEXT, original_volume TEXT, remaining_volume TEXT, buy_price_per_unit TEXT, current_price_per_unit TEXT, unit_label TEXT DEFAULT 'shares', status TEXT DEFAULT 'active', notes TEXT, created_at TEXT DEFAULT (datetime('now')));
  `);
  return db;
}

describe('institutionService', () => {
  let db: Database.Database;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('creates institution', () => {
    const inst = institutionService.createInstitution(db, { name: 'TestBank', type: 'bank' });
    expect(inst).toMatchObject({ name: 'TestBank', type: 'bank' });
  });

  it('archive hides from active-only list', () => {
    const inst = institutionService.createInstitution(db, { name: 'Archived Bank', type: 'bank' }) as Record<string, unknown>;
    institutionService.archiveInstitution(db, inst.id as number);
    const active = institutionService.listInstitutions(db, false);
    const ids = (active as Record<string, unknown>[]).map(i => i.id);
    expect(ids).not.toContain(inst.id);
  });

  it('include_archived=true shows archived with (Archived) label', () => {
    const inst = institutionService.createInstitution(db, { name: 'Archived Bank', type: 'bank' }) as Record<string, unknown>;
    institutionService.archiveInstitution(db, inst.id as number);
    const all = institutionService.listInstitutions(db, true) as Record<string, unknown>[];
    const found = all.find(i => i.id === inst.id);
    expect(found).toBeTruthy();
    expect((found!.display_name as string)).toContain('(Archived)');
  });

  it('restore clears archived_at', () => {
    const inst = institutionService.createInstitution(db, { name: 'Restore Me', type: 'bank' }) as Record<string, unknown>;
    institutionService.archiveInstitution(db, inst.id as number);
    institutionService.restoreInstitution(db, inst.id as number);
    const active = institutionService.listInstitutions(db, false) as Record<string, unknown>[];
    expect(active.find(i => i.id === inst.id)).toBeTruthy();
  });

  it('deleteInstitution throws 422 when ledger_entries reference exists', () => {
    const inst = institutionService.createInstitution(db, { name: 'RefBank', type: 'bank' }) as Record<string, unknown>;
    db.prepare("INSERT INTO ledger_entries (asset_class_id, institution_id, entry_type, description, amount, transaction_date) VALUES (1, ?, 'other', 'test', '1000', '2026-01-01')").run(inst.id as number);
    expect(() => institutionService.deleteInstitution(db, inst.id as number)).toThrow();
  });

  it('hard-delete succeeds when no references', () => {
    const inst = institutionService.createInstitution(db, { name: 'NoRef Bank', type: 'bank' }) as Record<string, unknown>;
    const result = institutionService.deleteInstitution(db, inst.id as number) as Record<string, unknown>;
    expect(result.deleted).toBe(true);
  });
});
