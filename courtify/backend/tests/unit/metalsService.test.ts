import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import * as metalsService from '../../src/services/metalsService.js';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE asset_classes (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, label TEXT NOT NULL, icon TEXT);
    INSERT INTO asset_classes VALUES (1,'metals','Metals',null),(2,'markets','Markets',null),(3,'liquidity','Liquidity',null),(4,'real_estate','Real Estate',null);
    CREATE TABLE institutions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL, archived_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    INSERT INTO institutions (name, type) VALUES ('TestBank', 'bank');
    CREATE TABLE ledger_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, asset_class_id INTEGER, institution_id INTEGER, entry_type TEXT, description TEXT, amount TEXT, status TEXT DEFAULT 'completed', transaction_date TEXT, attachment_path TEXT, notes TEXT, deleted_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE savings_instruments (id INTEGER PRIMARY KEY AUTOINCREMENT, institution_id INTEGER, label TEXT, instrument_type TEXT, principal TEXT, interest_rate TEXT, start_date TEXT, maturity_date TEXT, status TEXT DEFAULT 'active', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE metals_holdings (id INTEGER PRIMARY KEY AUTOINCREMENT, metal_type TEXT NOT NULL, label TEXT, weight_grams TEXT NOT NULL, weight_display TEXT NOT NULL, weight_unit TEXT NOT NULL, purity TEXT NOT NULL, purchase_price_per_gram TEXT NOT NULL, current_price_per_gram TEXT NOT NULL, purchase_date TEXT NOT NULL, institution_id INTEGER, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE asset_lots (id INTEGER PRIMARY KEY AUTOINCREMENT, asset_class_id INTEGER, asset_name TEXT, asset_subtype TEXT, institution_id INTEGER, purchase_date TEXT, original_volume TEXT, remaining_volume TEXT, buy_price_per_unit TEXT, current_price_per_unit TEXT, unit_label TEXT DEFAULT 'shares', status TEXT DEFAULT 'active', notes TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE net_worth_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, snapshot_date TEXT NOT NULL UNIQUE, total_vnd TEXT, metals_vnd TEXT, markets_vnd TEXT, liquidity_vnd TEXT, real_estate_vnd TEXT, created_at TEXT DEFAULT (datetime('now')));
  `);
  return db;
}

const BASE_HOLDING = {
  metal_type: 'gold',
  weight_display: 1,
  weight_unit: 'chi',
  purity: '99.9900',
  purchase_price_per_gram: '2000000.0000',
  current_price_per_gram: '2500000.0000',
  purchase_date: '2026-01-01',
};

describe('metalsService', () => {
  let db: Database.Database;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('converts chi to grams correctly (1 chi = 3.75g)', () => {
    metalsService.createHolding(db, { ...BASE_HOLDING, weight_display: 1, weight_unit: 'chi' });
    const holdings = metalsService.listHoldings(db) as Record<string, unknown>[];
    expect(parseFloat(holdings[0].weight_grams as string)).toBeCloseTo(3.75, 2);
  });

  it('converts luong to grams correctly (1 luong = 37.5g)', () => {
    metalsService.createHolding(db, { ...BASE_HOLDING, weight_display: 1, weight_unit: 'luong' });
    const holdings = metalsService.listHoldings(db) as Record<string, unknown>[];
    expect(parseFloat(holdings[0].weight_grams as string)).toBeCloseTo(37.5, 2);
  });

  it('gram is stored as-is', () => {
    metalsService.createHolding(db, { ...BASE_HOLDING, weight_display: 10, weight_unit: 'gram' });
    const holdings = metalsService.listHoldings(db) as Record<string, unknown>[];
    expect(parseFloat(holdings[0].weight_grams as string)).toBeCloseTo(10, 2);
  });

  it('purchase_value = weight_grams × purchase_price_per_gram', () => {
    metalsService.createHolding(db, { ...BASE_HOLDING, weight_display: 1, weight_unit: 'chi' });
    // 3.75g × 2000000 = 7,500,000
    const holdings = metalsService.listHoldings(db) as Record<string, unknown>[];
    expect(parseFloat(holdings[0].purchase_value as string)).toBeCloseTo(7500000, 0);
  });

  it('current_value = weight_grams × current_price_per_gram', () => {
    metalsService.createHolding(db, { ...BASE_HOLDING, weight_display: 1, weight_unit: 'chi' });
    // 3.75g × 2500000 = 9,375,000
    const holdings = metalsService.listHoldings(db) as Record<string, unknown>[];
    expect(parseFloat(holdings[0].current_value as string)).toBeCloseTo(9375000, 0);
  });

  it('unrealised_gain is positive when current > purchase price', () => {
    metalsService.createHolding(db, BASE_HOLDING);
    const holdings = metalsService.listHoldings(db) as Record<string, unknown>[];
    expect(parseFloat(holdings[0].unrealised_gain as string)).toBeGreaterThan(0);
  });

  it('unrealised_gain is negative when current < purchase price', () => {
    const loser = { ...BASE_HOLDING, current_price_per_gram: '1000000.0000' };
    metalsService.createHolding(db, loser);
    const holdings = metalsService.listHoldings(db) as Record<string, unknown>[];
    expect(parseFloat(holdings[0].unrealised_gain as string)).toBeLessThan(0);
  });

  it('invalid weight_unit throws BusinessRuleError', () => {
    expect(() => metalsService.createHolding(db, { ...BASE_HOLDING, weight_unit: 'ounce' })).toThrow();
  });

  it('weight stored as canonical grams TEXT', () => {
    metalsService.createHolding(db, { ...BASE_HOLDING, weight_display: 2, weight_unit: 'chi' });
    const raw = db.prepare('SELECT weight_grams FROM metals_holdings').get() as { weight_grams: string };
    expect(typeof raw.weight_grams).toBe('string');
    expect(raw.weight_grams).toBe('7.5000');
  });
});
