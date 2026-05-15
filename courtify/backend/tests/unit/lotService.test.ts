import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import * as lotService from '../../src/services/lotService.js';

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
    CREATE TABLE asset_lots (id INTEGER PRIMARY KEY AUTOINCREMENT, asset_class_id INTEGER NOT NULL REFERENCES asset_classes(id), asset_name TEXT NOT NULL, asset_subtype TEXT NOT NULL, institution_id INTEGER, purchase_date TEXT NOT NULL, original_volume TEXT NOT NULL, remaining_volume TEXT NOT NULL, buy_price_per_unit TEXT NOT NULL, current_price_per_unit TEXT NOT NULL, unit_label TEXT NOT NULL DEFAULT 'shares', status TEXT NOT NULL DEFAULT 'active', notes TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE asset_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, lot_id INTEGER NOT NULL REFERENCES asset_lots(id), transaction_type TEXT NOT NULL, transaction_date TEXT NOT NULL, volume TEXT NOT NULL, price_per_unit TEXT NOT NULL, fee TEXT NOT NULL DEFAULT '0.0000', net_amount TEXT NOT NULL, realized_pnl TEXT, notes TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE net_worth_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, snapshot_date TEXT NOT NULL UNIQUE, total_vnd TEXT, metals_vnd TEXT, markets_vnd TEXT, liquidity_vnd TEXT, real_estate_vnd TEXT, created_at TEXT DEFAULT (datetime('now')));
  `);
  return db;
}

const BASE_BUY = {
  asset_class_id: 2,
  asset_name: 'FPT',
  asset_subtype: 'stock' as const,
  purchase_date: '2026-01-01',
  volume: '100.0000',
  buy_price_per_unit: '90000.0000',
  current_price_per_unit: '100000.0000',
};

describe('lotService', () => {
  let db: Database.Database;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('BUY creates asset_lots + asset_transactions in single DB transaction', () => {
    lotService.buyLot(db, BASE_BUY);
    const lot = db.prepare('SELECT * FROM asset_lots').get() as Record<string, unknown>;
    const txn = db.prepare('SELECT * FROM asset_transactions').get() as Record<string, unknown>;
    expect(lot).toBeTruthy();
    expect(txn).toBeTruthy();
    expect(txn.transaction_type).toBe('buy');
    expect(txn.lot_id).toBe(lot.id);
  });

  it('BUY lot has correct original_volume and remaining_volume equal on creation', () => {
    lotService.buyLot(db, BASE_BUY);
    const lot = db.prepare('SELECT * FROM asset_lots').get() as Record<string, unknown>;
    expect(lot.original_volume).toBe('100.0000');
    expect(lot.remaining_volume).toBe('100.0000');
    expect(lot.status).toBe('active');
  });

  it('SELL updates remaining_volume and status on consumed lots', () => {
    lotService.buyLot(db, BASE_BUY);
    lotService.sellLot(db, {
      asset_name: 'FPT',
      sell_volume: 60,
      sell_price: 110000,
      date: '2026-06-01',
    });
    const lot = db.prepare('SELECT * FROM asset_lots').get() as Record<string, unknown>;
    expect(parseFloat(lot.remaining_volume as string)).toBeCloseTo(40, 2);
    expect(lot.status).toBe('partial_closed');
  });

  it('SELL inserts SELL asset_transactions with realized_pnl', () => {
    lotService.buyLot(db, BASE_BUY);
    lotService.sellLot(db, {
      asset_name: 'FPT',
      sell_volume: 100,
      sell_price: 110000,
      date: '2026-06-01',
    });
    const txns = db.prepare("SELECT * FROM asset_transactions WHERE transaction_type = 'sell'").all() as Record<string, unknown>[];
    expect(txns).toHaveLength(1);
    expect(txns[0].realized_pnl).toBeTruthy();
    expect(parseFloat(txns[0].realized_pnl as string)).toBeGreaterThan(0); // sold higher than bought
  });

  it('SELL fully depleted lot becomes closed', () => {
    lotService.buyLot(db, BASE_BUY);
    lotService.sellLot(db, { asset_name: 'FPT', sell_volume: 100, sell_price: 110000, date: '2026-06-01' });
    const lot = db.prepare('SELECT * FROM asset_lots').get() as Record<string, unknown>;
    expect(lot.status).toBe('closed');
  });

  it('SELL with multi-lot FIFO applies oldest first', () => {
    lotService.buyLot(db, { ...BASE_BUY, purchase_date: '2026-01-01', volume: '50.0000', buy_price_per_unit: '90000.0000' });
    lotService.buyLot(db, { ...BASE_BUY, purchase_date: '2026-02-01', volume: '50.0000', buy_price_per_unit: '95000.0000' });
    lotService.sellLot(db, { asset_name: 'FPT', sell_volume: 80, sell_price: 110000, date: '2026-06-01' });

    const lots = db.prepare('SELECT * FROM asset_lots ORDER BY purchase_date ASC').all() as Record<string, unknown>[];
    expect(lots[0].status).toBe('closed'); // oldest fully consumed
    expect(parseFloat(lots[1].remaining_volume as string)).toBeCloseTo(20, 2); // second partially consumed
  });

  it('aggregated view returns weighted_avg_cost per asset_name', () => {
    lotService.buyLot(db, { ...BASE_BUY, volume: '100.0000', buy_price_per_unit: '90000.0000' });
    lotService.buyLot(db, { ...BASE_BUY, purchase_date: '2026-02-01', volume: '100.0000', buy_price_per_unit: '110000.0000' });
    const rows = lotService.listLots(db, { view: 'aggregated' }) as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(rows[0].weighted_avg_cost).toBeTruthy();
    expect(parseFloat(rows[0].weighted_avg_cost as string)).toBeCloseTo(100000, 0);
  });

  it('price update does NOT propagate to other lots of same asset', () => {
    const lot1 = lotService.buyLot(db, { ...BASE_BUY, current_price_per_unit: '100000.0000' }) as Record<string, unknown>;
    const lot2 = lotService.buyLot(db, { ...BASE_BUY, purchase_date: '2026-02-01', current_price_per_unit: '100000.0000' }) as Record<string, unknown>;
    lotService.updateLotPrice(db, lot1.id as number, '120000.0000');
    const updated = db.prepare('SELECT current_price_per_unit FROM asset_lots WHERE id = ?').get(lot2.id as number) as Record<string, unknown>;
    expect(updated.current_price_per_unit).toBe('100000.0000'); // unchanged
  });
});
