import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import * as analyticsService from '../../src/services/analyticsService.js';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE asset_classes (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, label TEXT NOT NULL, icon TEXT);
    INSERT INTO asset_classes VALUES (1,'metals','Metals',null),(2,'markets','Markets',null),(3,'liquidity','Liquidity',null),(4,'real_estate','Real Estate',null);
    CREATE TABLE asset_lots (id INTEGER PRIMARY KEY AUTOINCREMENT, asset_class_id INTEGER, asset_name TEXT, asset_subtype TEXT, institution_id INTEGER, purchase_date TEXT, original_volume TEXT, remaining_volume TEXT, buy_price_per_unit TEXT, current_price_per_unit TEXT, unit_label TEXT DEFAULT 'shares', status TEXT DEFAULT 'active', notes TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE asset_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, lot_id INTEGER, transaction_type TEXT NOT NULL, transaction_date TEXT NOT NULL, volume TEXT NOT NULL, price_per_unit TEXT NOT NULL, fee TEXT NOT NULL DEFAULT '0.0000', net_amount TEXT NOT NULL, realized_pnl TEXT, notes TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE net_worth_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, snapshot_date TEXT NOT NULL UNIQUE, total_vnd TEXT, metals_vnd TEXT, markets_vnd TEXT, liquidity_vnd TEXT, real_estate_vnd TEXT, created_at TEXT DEFAULT (datetime('now')));
  `);
  return db;
}

function seedSnapshots(db: Database.Database, monthsBack = 13) {
  for (let i = monthsBack; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const date = d.toISOString().slice(0, 10);
    const total = String((1000000 * (monthsBack - i + 1)).toFixed(4));
    try {
      db.prepare(`INSERT INTO net_worth_snapshots (snapshot_date, total_vnd, metals_vnd, markets_vnd, liquidity_vnd, real_estate_vnd)
        VALUES (?, ?, '0', '0', '0', '0')`).run(date, total);
    } catch { /* duplicate dates */ }
  }
}

describe('analyticsService', () => {
  let db: Database.Database;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('getNetWorthHistory returns empty array when no snapshots', () => {
    const result = analyticsService.getNetWorthHistory(db, '3M');
    expect(result).toEqual([]);
  });

  it('3M range returns only last 3 months', () => {
    seedSnapshots(db, 13);
    const all = analyticsService.getNetWorthHistory(db, 'all') as unknown[];
    const threeM = analyticsService.getNetWorthHistory(db, '3M') as unknown[];
    expect(threeM.length).toBeLessThan(all.length);
    expect(threeM.length).toBeGreaterThan(0);
  });

  it('1Y range returns last 12 months', () => {
    seedSnapshots(db, 13);
    const oneY = analyticsService.getNetWorthHistory(db, '1Y') as unknown[];
    expect(oneY.length).toBeGreaterThan(0);
    expect(oneY.length).toBeLessThanOrEqual(13);
  });

  it('all range returns all snapshots', () => {
    seedSnapshots(db, 13);
    const all = analyticsService.getNetWorthHistory(db, 'all') as unknown[];
    expect(all.length).toBe(14); // 0..13 months
  });

  it('getProjection returns 3 future data points', () => {
    seedSnapshots(db, 5);
    const projections = analyticsService.getProjection(db, 'all');
    expect(projections).toHaveLength(3);
    projections.forEach((p: Record<string, unknown>) => {
      expect(p).toHaveProperty('date');
      expect(p).toHaveProperty('projected_total');
    });
  });

  it('getProjection returns empty array with < 2 data points', () => {
    db.prepare(`INSERT INTO net_worth_snapshots (snapshot_date, total_vnd, metals_vnd, markets_vnd, liquidity_vnd, real_estate_vnd)
      VALUES ('2026-01-01', '1000000', '0', '0', '0', '0')`).run();
    const result = analyticsService.getProjection(db, 'all');
    expect(result).toHaveLength(0);
  });

  it('getRealizedPnl returns total_realized_pnl and by_class', () => {
    db.prepare(`INSERT INTO asset_lots (asset_class_id, asset_name, asset_subtype, purchase_date, original_volume, remaining_volume, buy_price_per_unit, current_price_per_unit)
      VALUES (2, 'FPT', 'stock', '2026-01-01', '100', '0', '90000', '110000')`).run();
    const lotId = (db.prepare('SELECT id FROM asset_lots').get() as { id: number }).id;
    db.prepare(`INSERT INTO asset_transactions (lot_id, transaction_type, transaction_date, volume, price_per_unit, net_amount, realized_pnl)
      VALUES (?, 'sell', '2026-06-01', '100', '110000', '11000000', '2000000')`).run(lotId);

    const result = analyticsService.getRealizedPnl(db, {});
    expect(result).toHaveProperty('total_realized_pnl');
    expect(result).toHaveProperty('by_class');
    expect(parseFloat(result.total_realized_pnl)).toBeCloseTo(2000000, 0);
  });

  it('getRealizedPnl filters by asset_class', () => {
    db.prepare(`INSERT INTO asset_lots (asset_class_id, asset_name, asset_subtype, purchase_date, original_volume, remaining_volume, buy_price_per_unit, current_price_per_unit)
      VALUES (1, 'GOLD', 'gold', '2026-01-01', '10', '0', '2000000', '2500000')`).run();
    const metalLotId = (db.prepare('SELECT id FROM asset_lots WHERE asset_name = ?').get('GOLD') as { id: number }).id;
    db.prepare(`INSERT INTO asset_transactions (lot_id, transaction_type, transaction_date, volume, price_per_unit, net_amount, realized_pnl)
      VALUES (?, 'sell', '2026-06-01', '10', '2500000', '25000000', '5000000')`).run(metalLotId);

    const result = analyticsService.getRealizedPnl(db, { assetClass: 'metals' });
    expect(parseFloat(result.total_realized_pnl)).toBeGreaterThan(0);
    expect(result.by_class.every(c => c.asset_class === 'metals')).toBe(true);
  });
});
