import type Database from 'better-sqlite3';

export class AnalyticsRepository {
  constructor(private readonly db: Database.Database) {}

  getNetWorthHistoryAll(): { date: string; total_value: string }[] {
    return this.db.prepare(`
      SELECT snapshot_date AS date, total_vnd AS total_value
      FROM net_worth_snapshots ORDER BY snapshot_date ASC
    `).all() as { date: string; total_value: string }[];
  }

  getNetWorthHistoryFrom(fromDate: string): { date: string; total_value: string }[] {
    return this.db.prepare(`
      SELECT snapshot_date AS date, total_vnd AS total_value
      FROM net_worth_snapshots
      WHERE snapshot_date >= ?
      ORDER BY snapshot_date ASC
    `).all(fromDate) as { date: string; total_value: string }[];
  }

  getAssetClassPerformanceAll(): Record<string, unknown>[] {
    return this.db.prepare(`
      SELECT snapshot_date AS date,
             metals_vnd, markets_vnd, liquidity_vnd, real_estate_vnd, total_vnd
      FROM net_worth_snapshots
      ORDER BY snapshot_date ASC
    `).all() as Record<string, unknown>[];
  }

  getAssetClassPerformanceFrom(fromDate: string): Record<string, unknown>[] {
    return this.db.prepare(`
      SELECT snapshot_date AS date,
             metals_vnd, markets_vnd, liquidity_vnd, real_estate_vnd, total_vnd
      FROM net_worth_snapshots
      WHERE snapshot_date >= ?
      ORDER BY snapshot_date ASC
    `).all(fromDate) as Record<string, unknown>[];
  }

  getRealizedPnlByClass(conditions: string[], bindings: (string | number)[]): { asset_class: string; realized_pnl: number }[] {
    return this.db.prepare(`
      SELECT ac.code AS asset_class, SUM(CAST(at.realized_pnl AS REAL)) AS realized_pnl
      FROM asset_transactions at
      JOIN asset_lots al ON at.lot_id = al.id
      JOIN asset_classes ac ON al.asset_class_id = ac.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY ac.code
    `).all(...bindings) as { asset_class: string; realized_pnl: number }[];
  }
}
