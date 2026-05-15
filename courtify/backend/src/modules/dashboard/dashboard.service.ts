/**
 * DashboardService — aggregates all asset values for the Dashboard endpoint.
 *
 * Net worth = metals + markets + liquidity + real_estate
 *   Metals   = SUM(metals_holdings.current_value) + SUM(asset_lots.current_value WHERE asset_class=metals, status IN active/partial_closed)
 *   Markets  = SUM(asset_lots.current_value WHERE asset_class=markets, status IN active/partial_closed)
 *   Liquidity = SUM(savings_instruments.principal + accrued_interest WHERE status != withdrawn)
 *   Real Estate = SUM(ledger_entries.amount WHERE asset_class=real_estate, deleted_at IS NULL)
 */

import type { DashboardRepository } from './dashboard.repository.js';

function toNum(s: string | null | undefined): number {
  if (!s) return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function toText(n: number): string {
  return n.toFixed(4);
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

/** Compute total per asset class (returns as numbers) */
function computeAssetTotals(repo: DashboardRepository): {
  metals: number; markets: number; liquidity: number; real_estate: number;
} {
  const metalsHoldings = repo.getMetalsHoldingsValue();
  const metalsLots = repo.getMetalsLotsValue();
  const metals = (metalsHoldings.val ?? 0) + (metalsLots.val ?? 0);

  const marketsLots = repo.getMarketsLotsValue();
  const markets = marketsLots.val ?? 0;

  const savingsRows = repo.getActiveSavingsRows();
  let liquidity = 0;
  const todayDate = today();
  for (const row of savingsRows) {
    const principal = toNum(row.principal);
    const rate = toNum(row.interest_rate) / 100;
    const start = new Date(row.start_date);
    const now = new Date(todayDate);
    const daysElapsed = Math.max(0, (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const accrued = principal * rate * (daysElapsed / 365.0);
    liquidity += principal + accrued;
  }

  const reRow = repo.getRealEstateValue();
  const real_estate = Math.max(0, reRow.val ?? 0);

  return { metals, markets, liquidity, real_estate };
}

export class DashboardService {
  constructor(private readonly repo: DashboardRepository) {}

  /** Upsert today's net_worth_snapshot */
  upsertSnapshot(): void {
    const totals = computeAssetTotals(this.repo);
    const total = totals.metals + totals.markets + totals.liquidity + totals.real_estate;
    this.repo.upsertSnapshot(
      toText(total), toText(totals.metals), toText(totals.markets),
      toText(totals.liquidity), toText(totals.real_estate),
    );
  }

  /** Get last N snapshots per asset class for sparkline (padded to 7) */
  private getSparklines(assetCode: string, n = 7): number[] {
    const colMap: Record<string, string> = {
      metals: 'metals_vnd', markets: 'markets_vnd',
      liquidity: 'liquidity_vnd', real_estate: 'real_estate_vnd',
    };
    const col = colMap[assetCode] ?? 'total_vnd';
    const rows = this.repo.getSparklineValues(col, n);

    const values = rows.map((r) => Math.round(toNum(r.val) / 1_000_000));
    const reversed = values.reverse();
    while (reversed.length < n) reversed.unshift(0);
    return reversed;
  }

  getDashboardData() {
    const totals = computeAssetTotals(this.repo);
    const total = totals.metals + totals.markets + totals.liquidity + totals.real_estate;

    const prevSnapshot = this.repo.getPreviousSnapshot();
    const prevTotal = toNum(prevSnapshot?.total_vnd);
    const changePct = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;

    const assetClasses = this.repo.getAssetClasses();

    const assetCardMap: Record<string, number> = {
      metals: totals.metals, markets: totals.markets,
      liquidity: totals.liquidity, real_estate: totals.real_estate,
    };

    const prevRow = this.repo.getPreviousSnapshotAllColumns();

    const prevClassMap: Record<string, number> = {
      metals: toNum(prevRow?.metals_vnd), markets: toNum(prevRow?.markets_vnd),
      liquidity: toNum(prevRow?.liquidity_vnd), real_estate: toNum(prevRow?.real_estate_vnd),
    };

    const asset_cards = assetClasses.map((ac) => {
      const classTotal = assetCardMap[ac.code] ?? 0;
      const prevClass = prevClassMap[ac.code] ?? 0;
      const classPct = prevClass > 0 ? ((classTotal - prevClass) / prevClass) * 100 : null;
      return {
        code: ac.code,
        label: ac.label,
        total_vnd: toText(classTotal),
        change_pct: classPct !== null ? parseFloat(classPct.toFixed(2)) : null,
        sparkline: this.getSparklines(ac.code, 7),
      };
    });

    const nonZeroAssets = assetClasses.filter((ac) => (assetCardMap[ac.code] ?? 0) > 0);
    const allocation = total > 0
      ? nonZeroAssets.map((ac) => ({
          code: ac.code,
          label: ac.label,
          pct: parseFloat(((assetCardMap[ac.code] ?? 0) / total * 100).toFixed(1)),
        }))
      : [];

    if (allocation.length > 0) {
      const sum = allocation.reduce((s, a) => s + a.pct, 0);
      if (sum > 0 && Math.abs(sum - 100) > 0.1) {
        const factor = 100 / sum;
        allocation.forEach((a) => { a.pct = parseFloat((a.pct * factor).toFixed(1)); });
      }
    }

    const recent_ledger = this.repo.getRecentLedger();

    // Upsert today's snapshot
    this.upsertSnapshot();

    return {
      net_worth: {
        total_vnd: toText(total),
        change_pct: changePct !== null ? parseFloat(changePct.toFixed(2)) : null,
        previous_total_vnd: prevTotal > 0 ? toText(prevTotal) : null,
      },
      asset_cards,
      allocation,
      recent_ledger,
    };
  }
}
