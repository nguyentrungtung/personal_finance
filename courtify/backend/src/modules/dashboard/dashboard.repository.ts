import type Database from 'better-sqlite3';
import type { AssetClassRow, SnapshotRow, LedgerRow } from './dashboard.types.js';

export class DashboardRepository {
  constructor(private readonly db: Database.Database) {}

  getMetalsHoldingsValue(): { val: number | null } {
    return this.db.prepare(`
      SELECT SUM(CAST(weight_grams AS REAL) * CAST(current_price_per_gram AS REAL)) AS val
      FROM metals_holdings
    `).get() as { val: number | null };
  }

  getMetalsLotsValue(): { val: number | null } {
    return this.db.prepare(`
      SELECT SUM(CAST(remaining_volume AS REAL) * CAST(current_price_per_unit AS REAL)) AS val
      FROM asset_lots
      JOIN asset_classes ON asset_lots.asset_class_id = asset_classes.id
      WHERE asset_classes.code = 'metals' AND asset_lots.status IN ('active', 'partial_closed')
    `).get() as { val: number | null };
  }

  getMarketsLotsValue(): { val: number | null } {
    return this.db.prepare(`
      SELECT SUM(CAST(remaining_volume AS REAL) * CAST(current_price_per_unit AS REAL)) AS val
      FROM asset_lots
      JOIN asset_classes ON asset_lots.asset_class_id = asset_classes.id
      WHERE asset_classes.code = 'markets' AND asset_lots.status IN ('active', 'partial_closed')
    `).get() as { val: number | null };
  }

  getActiveSavingsRows(): { principal: string; interest_rate: string; start_date: string }[] {
    return this.db.prepare(`
      SELECT principal, interest_rate, start_date
      FROM savings_instruments
      WHERE status != 'withdrawn'
    `).all() as { principal: string; interest_rate: string; start_date: string }[];
  }

  getRealEstateValue(): { val: number | null } {
    return this.db.prepare(`
      SELECT SUM(CAST(amount AS REAL)) AS val
      FROM ledger_entries
      JOIN asset_classes ON ledger_entries.asset_class_id = asset_classes.id
      WHERE asset_classes.code = 'real_estate' AND ledger_entries.deleted_at IS NULL
    `).get() as { val: number | null };
  }

  upsertSnapshot(total: string, metals: string, markets: string, liquidity: string, real_estate: string): void {
    this.db.prepare(`
      INSERT INTO net_worth_snapshots (snapshot_date, total_vnd, metals_vnd, markets_vnd, liquidity_vnd, real_estate_vnd)
      VALUES (date('now'), ?, ?, ?, ?, ?)
      ON CONFLICT(snapshot_date) DO UPDATE SET
        total_vnd = excluded.total_vnd,
        metals_vnd = excluded.metals_vnd,
        markets_vnd = excluded.markets_vnd,
        liquidity_vnd = excluded.liquidity_vnd,
        real_estate_vnd = excluded.real_estate_vnd
    `).run(total, metals, markets, liquidity, real_estate);
  }

  getPreviousSnapshot(): { total_vnd: string } | undefined {
    return this.db.prepare(`
      SELECT total_vnd FROM net_worth_snapshots
      WHERE snapshot_date < date('now') ORDER BY snapshot_date DESC LIMIT 1
    `).get() as { total_vnd: string } | undefined;
  }

  getPreviousSnapshotAllColumns(): SnapshotRow | undefined {
    return this.db.prepare(`
      SELECT metals_vnd, markets_vnd, liquidity_vnd, real_estate_vnd
      FROM net_worth_snapshots WHERE snapshot_date < date('now') ORDER BY snapshot_date DESC LIMIT 1
    `).get() as SnapshotRow | undefined;
  }

  getSparklineValues(col: string, n: number): { val: string }[] {
    return this.db.prepare(`
      SELECT ${col} AS val FROM net_worth_snapshots ORDER BY snapshot_date DESC LIMIT ?
    `).all(n) as { val: string }[];
  }

  getAssetClasses(): AssetClassRow[] {
    return this.db.prepare('SELECT id, code, label FROM asset_classes').all() as AssetClassRow[];
  }

  getRecentLedger(): LedgerRow[] {
    return this.db.prepare(`
      SELECT id, entry_type, description, transaction_date, amount, status
      FROM ledger_entries
      WHERE deleted_at IS NULL
      ORDER BY transaction_date DESC
      LIMIT 5
    `).all() as LedgerRow[];
  }
}
