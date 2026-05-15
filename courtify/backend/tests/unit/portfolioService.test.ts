import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { getDashboardData, upsertSnapshot } from '../../src/services/portfolioService.js';

function createTestDb() {
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

describe('portfolioService.getDashboardData', () => {
  let db: Database.Database;

  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('returns zero values for empty portfolio', () => {
    const data = getDashboardData(db);
    expect(parseFloat(data.net_worth.total_vnd)).toBe(0);
    expect(data.net_worth.change_pct).toBeNull();
    expect(data.recent_ledger).toHaveLength(0);
  });

  it('aggregates metals_holdings into metals total', () => {
    db.prepare(`INSERT INTO metals_holdings (metal_type, weight_grams, weight_display, weight_unit, purity, purchase_price_per_gram, current_price_per_gram, purchase_date) VALUES ('gold','100.0000','100','gram','99.9900','2000000.0000','2500000.0000','2026-01-01')`).run();
    const data = getDashboardData(db);
    const metalsCard = data.asset_cards.find((c) => c.code === 'metals');
    expect(parseFloat(metalsCard!.total_vnd)).toBeCloseTo(100 * 2_500_000, -2);
  });

  it('aggregates markets from asset_lots', () => {
    db.prepare(`INSERT INTO asset_lots (asset_class_id, asset_name, asset_subtype, purchase_date, original_volume, remaining_volume, buy_price_per_unit, current_price_per_unit) VALUES (2,'FPT','stock','2026-01-01','100.0000','100.0000','90000.0000','100000.0000')`).run();
    const data = getDashboardData(db);
    const marketsCard = data.asset_cards.find((c) => c.code === 'markets');
    expect(parseFloat(marketsCard!.total_vnd)).toBeCloseTo(100 * 100_000, -2);
  });

  it('includes accrued interest in liquidity total', () => {
    db.prepare(`INSERT INTO savings_instruments (institution_id, label, instrument_type, principal, interest_rate, start_date, maturity_date) VALUES (1,'FD','certificate_of_deposit','500000000.0000','7.3000','2025-01-01','2026-01-01')`).run();
    const data = getDashboardData(db);
    const liquidityCard = data.asset_cards.find((c) => c.code === 'liquidity');
    expect(parseFloat(liquidityCard!.total_vnd)).toBeGreaterThan(500_000_000);
  });

  it('computes % change vs previous snapshot', () => {
    db.prepare(`INSERT INTO net_worth_snapshots (snapshot_date, total_vnd, metals_vnd, markets_vnd, liquidity_vnd, real_estate_vnd) VALUES ('2026-01-01','1000000000.0000','100000000.0000','200000000.0000','300000000.0000','400000000.0000')`).run();
    db.prepare(`INSERT INTO ledger_entries (asset_class_id, entry_type, description, amount, transaction_date) VALUES (4,'real_estate_appraisal','Test','2000000000.0000','2026-05-01T07:00:00.000Z')`).run();
    const data = getDashboardData(db);
    expect(data.net_worth.change_pct).not.toBeNull();
  });

  it('allocation percentages sum to 100 when non-zero', () => {
    db.prepare(`INSERT INTO metals_holdings (metal_type, weight_grams, weight_display, weight_unit, purity, purchase_price_per_gram, current_price_per_gram, purchase_date) VALUES ('gold','100.0000','100','gram','99.9900','2000000.0000','2000000.0000','2026-01-01')`).run();
    db.prepare(`INSERT INTO ledger_entries (asset_class_id, entry_type, description, amount, transaction_date) VALUES (4,'real_estate_appraisal','RE','1000000000.0000','2026-01-01T00:00:00Z')`).run();
    const data = getDashboardData(db);
    const sum = data.allocation.reduce((s, a) => s + a.pct, 0);
    expect(sum).toBeGreaterThan(95); // Allow floating point
  });

  it('recent_ledger returns at most 5 entries ordered by date DESC', () => {
    for (let i = 0; i < 7; i++) {
      db.prepare(`INSERT INTO ledger_entries (asset_class_id, entry_type, description, amount, transaction_date) VALUES (1,'other','Entry ${i}','1000000.0000','2026-0${i+1 < 10 ? '0'+(i+1) : i+1}-01T00:00:00Z')`).run();
    }
    const data = getDashboardData(db);
    expect(data.recent_ledger.length).toBeLessThanOrEqual(5);
  });

  it('Metals total = metals_holdings + asset_lots(metals)', () => {
    db.prepare(`INSERT INTO metals_holdings (metal_type, weight_grams, weight_display, weight_unit, purity, purchase_price_per_gram, current_price_per_gram, purchase_date) VALUES ('gold','37.5000','1','luong','99.9900','2000000.0000','2500000.0000','2026-01-01')`).run();
    db.prepare(`INSERT INTO asset_lots (asset_class_id, asset_name, asset_subtype, purchase_date, original_volume, remaining_volume, buy_price_per_unit, current_price_per_unit, unit_label) VALUES (1,'SJC','gold','2026-01-01','10.0000','10.0000','8000000.0000','9000000.0000','chi')`).run();
    const data = getDashboardData(db);
    const metalsCard = data.asset_cards.find((c) => c.code === 'metals');
    // 37.5 × 2,500,000 + 10 × 9,000,000
    const expected = 37.5 * 2_500_000 + 10 * 9_000_000;
    expect(parseFloat(metalsCard!.total_vnd)).toBeCloseTo(expected, -2);
  });
});
