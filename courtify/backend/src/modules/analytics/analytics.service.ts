import type { AnalyticsRepository } from './analytics.repository.js';
import type { Range } from './analytics.types.js';

function rangeToDate(range: Range): string | null {
  if (range === 'all') return null;
  const now = new Date();
  const months = range === '3M' ? 3 : range === '6M' ? 6 : 12;
  now.setMonth(now.getMonth() - months);
  return now.toISOString().slice(0, 10);
}

export class AnalyticsService {
  constructor(private readonly repo: AnalyticsRepository) {}

  getNetWorthHistory(range: Range = '1Y') {
    const fromDate = rangeToDate(range);
    if (fromDate) {
      return this.repo.getNetWorthHistoryFrom(fromDate);
    }
    return this.repo.getNetWorthHistoryAll();
  }

  getAssetClassPerformance(range: Range = '1Y') {
    const fromDate = rangeToDate(range);
    if (fromDate) {
      return this.repo.getAssetClassPerformanceFrom(fromDate);
    }
    return this.repo.getAssetClassPerformanceAll();
  }

  getProjection(range: Range = '1Y') {
    const history = this.getNetWorthHistory(range) as { date: string; total_value: string }[];
    if (history.length < 2) return [];

    // Compute monthly growth rates from consecutive snapshots
    const growthRates: number[] = [];
    for (let i = 1; i < history.length; i++) {
      const prev = parseFloat(history[i - 1].total_value ?? '0');
      const curr = parseFloat(history[i].total_value ?? '0');
      if (prev > 0) growthRates.push((curr - prev) / prev);
    }

    // Use trailing average (up to last 3 data points)
    const recentRates = growthRates.slice(-3);
    const avgMonthlyGrowth = recentRates.length > 0
      ? recentRates.reduce((s, r) => s + r, 0) / recentRates.length
      : 0;

    const lastEntry = history[history.length - 1];
    let lastValue = parseFloat(lastEntry.total_value ?? '0');
    const lastDate = new Date(lastEntry.date);

    const projections = [];
    for (let i = 1; i <= 3; i++) {
      lastValue = lastValue * (1 + avgMonthlyGrowth);
      const projDate = new Date(lastDate);
      projDate.setMonth(projDate.getMonth() + i);
      projections.push({
        date: projDate.toISOString().slice(0, 10),
        projected_total: String(Math.max(0, lastValue).toFixed(4)),
      });
    }
    return projections;
  }

  getRealizedPnl(params: {
    assetClass?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const { assetClass, dateFrom, dateTo } = params;
    const conditions: string[] = ["at.transaction_type = 'sell'", 'at.realized_pnl IS NOT NULL'];
    const bindings: (string | number)[] = [];

    if (assetClass) {
      conditions.push('ac.code = ?');
      bindings.push(assetClass);
    }
    if (dateFrom) {
      conditions.push('at.transaction_date >= ?');
      bindings.push(dateFrom);
    }
    if (dateTo) {
      conditions.push('at.transaction_date <= ?');
      bindings.push(dateTo);
    }

    const rows = this.repo.getRealizedPnlByClass(conditions, bindings);
    const totalRealizedPnl = rows.reduce((s, r) => s + r.realized_pnl, 0);

    return {
      total_realized_pnl: String(totalRealizedPnl.toFixed(4)),
      by_class: rows.map(r => ({ asset_class: r.asset_class, realized_pnl: String(r.realized_pnl.toFixed(4)) })),
    };
  }
}
