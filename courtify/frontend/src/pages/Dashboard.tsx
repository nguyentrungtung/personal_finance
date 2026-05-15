import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { api } from '../lib/api';
import { parseVND } from '../lib/vnd';
import { useCurrency } from '../lib/currencyContext';
import { SparklineBar } from '../components/charts/SparklineBar';
import { AllocationDonut } from '../components/charts/AllocationDonut';
import { StatusPill } from '../components/shared/StatusPill';
import { EmptyState } from '../components/shared/EmptyState';

interface DashboardData {
  net_worth: { total_vnd: string; change_pct: number | null; previous_total_vnd: string | null };
  asset_cards: { code: string; label: string; total_vnd: string; change_pct: number | null; sparkline: number[] }[];
  allocation: { code: string; label: string; pct: number }[];
  recent_ledger: { id: number; entry_type: string; description: string; transaction_date: string; amount: string; status: string }[];
}

const ASSET_ICON_COLOR: Record<string, string> = {
  metals: '#f59e0b', markets: '#22c55e', liquidity: '#3b82f6', real_estate: '#a855f7',
};
const ASSET_SPARKLINE_COLOR: Record<string, string> = {
  metals: '#f59e0b', markets: '#22c55e', liquidity: '#3b82f6', real_estate: '#a855f7',
};

function SkeletonCard() {
  return <div className="card animate-pulse"><div className="h-4 bg-surface-border rounded w-1/2 mb-4" /><div className="h-8 bg-surface-border rounded w-3/4 mb-2" /><div className="h-4 bg-surface-border rounded w-1/4" /></div>;
}

export function Dashboard() {
  const { t, i18n } = useTranslation();
  const { abbr, fmt } = useCurrency();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);

    api.get<{ data: DashboardData }>('/api/v1/dashboard', controller.signal)
      .then((res) => setData(res.data))
      .catch((err) => { if (err.name !== 'AbortError') setError(t('common.failedToLoad')); })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [t]);

  if (error) {
    return (
      <div className="p-8">
        <div className="card border-brand-red/30 bg-brand-red/5">
          <p className="text-brand-red text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const isEmpty = data && parseVND(data.net_worth.total_vnd) === 0;

  return (
    <div className="p-8 space-y-8">
      {/* Net Worth Hero */}
      <section aria-label="Net worth summary">
        {isLoading ? (
          <div className="animate-pulse">
            <div className="h-6 bg-surface-border rounded w-32 mb-3" />
            <div className="h-12 bg-surface-border rounded w-64 mb-2" />
            <div className="h-5 bg-surface-border rounded w-24" />
          </div>
        ) : data ? (
          <>
            <p className="text-sm text-text-muted mb-1">{t('dashboard.totalNetWorth')}</p>
            <h2 className="text-4xl font-bold text-text-primary tracking-tight">
              {abbr(parseVND(data.net_worth.total_vnd))}
            </h2>
            {data.net_worth.change_pct !== null && (
              <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${data.net_worth.change_pct >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                {data.net_worth.change_pct >= 0 ? <TrendingUp size={14} aria-hidden /> : <TrendingDown size={14} aria-hidden />}
                <span>{data.net_worth.change_pct >= 0 ? '+' : ''}{data.net_worth.change_pct.toFixed(2)}% {t('dashboard.vsLastSnapshot')}</span>
              </div>
            )}
          </>
        ) : null}
      </section>

      {/* Asset Cards */}
      <section aria-label="Asset class breakdown">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            : data?.asset_cards.map((card) => (
              <div key={card.code} className="card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-text-secondary">
                    {t(`enums.assetClasses.${card.code}` as any, { defaultValue: card.label })}
                  </span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: card.change_pct !== null ? (card.change_pct >= 0 ? '#22c55e' : '#ef4444') : '#64748b' }}
                    aria-label={`${card.change_pct !== null ? (card.change_pct >= 0 ? '+' : '') + card.change_pct.toFixed(2) + '%' : 'N/A'}`}
                  >
                    {card.change_pct !== null ? `${card.change_pct >= 0 ? '+' : ''}${card.change_pct.toFixed(2)}%` : '—'}
                  </span>
                </div>
                <p className="text-xl font-bold text-text-primary mb-3">
                  {abbr(parseVND(card.total_vnd))}
                </p>
                <SparklineBar data={card.sparkline} color={ASSET_SPARKLINE_COLOR[card.code]} height={36} />
              </div>
            ))
          }
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Allocation Donut */}
        <section className="lg:col-span-2 card" aria-label="Portfolio allocation">
          <h3 className="text-sm font-semibold text-text-secondary mb-4">{t('dashboard.allocation')}</h3>
          {isLoading ? (
            <div className="animate-pulse h-48 bg-surface-border rounded" />
          ) : (
            <AllocationDonut data={data?.allocation.map(a => ({ ...a, label: t(`enums.assetClasses.${a.code}` as any, { defaultValue: a.label }) })) ?? []} />
          )}
        </section>

        {/* Recent Ledger */}
        <section className="lg:col-span-3 card overflow-hidden" aria-label="Recent transactions">
          <h3 className="text-sm font-semibold text-text-secondary mb-4">{t('dashboard.recentTransactions')}</h3>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse flex gap-3">
                  <div className="h-4 bg-surface-border rounded flex-1" />
                  <div className="h-4 bg-surface-border rounded w-24" />
                </div>
              ))}
            </div>
          ) : isEmpty ? (
            <EmptyState
              title={t('dashboard.noTransactions')}
              description={t('dashboard.noTransactionsDesc')}
            />
          ) : (
            <div className="overflow-x-auto -mx-4 lg:mx-0 px-4 lg:px-0">
              <table className="w-full" role="table">
                <thead>
                  <tr className="text-xs text-text-muted border-b border-surface-border">
                    <th className="text-left pb-2 font-medium" scope="col">{t('dashboard.date')}</th>
                    <th className="text-left pb-2 font-medium" scope="col">{t('dashboard.description')}</th>
                    <th className="text-right pb-2 font-medium" scope="col">{t('dashboard.amount')}</th>
                    <th className="text-center pb-2 font-medium hide-on-mobile" scope="col">{t('dashboard.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.recent_ledger.map((entry) => {
                    const amount = parseVND(entry.amount);
                    return (
                      <tr key={entry.id} className="border-b border-surface-border/50 last:border-0">
                        <td className="py-2.5 text-[10px] sm:text-xs text-text-muted">
                          {new Date(entry.transaction_date).toLocaleDateString(i18n.language === 'vi' ? 'vi-VN' : 'en-US')}
                        </td>
                        <td className="py-2.5 text-xs sm:text-sm text-text-primary truncate max-w-[120px] sm:max-w-xs pr-4">
                          {entry.description}
                        </td>
                        <td className={`py-2.5 text-xs sm:text-sm font-mono text-right ${amount < 0 ? 'text-brand-red' : 'text-brand-green'}`}>
                          {fmt(amount)}
                        </td>
                        <td className="py-2.5 text-center hide-on-mobile">
                          <StatusPill status={entry.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
