import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../lib/api';
import { abbreviateVND } from '../lib/vnd';
import NetWorthLine from '../components/charts/NetWorthLine';
import AssetGroupedBar from '../components/charts/AssetGroupedBar';
import { EmptyState } from '../components/shared/EmptyState';

type Range = '3M' | '6M' | '1Y' | 'all';

interface NetWorthPoint { date: string; total_value: string; }
interface PerformancePoint { date: string; metals_vnd: string; markets_vnd: string; liquidity_vnd: string; real_estate_vnd: string; }
interface ProjectionPoint { date: string; projected_total: string; }
interface PnlResult { total_realized_pnl: string; by_class: { asset_class: string; realized_pnl: string }[]; }

const ASSET_CLASS_OPTIONS = [
  { value: '', label: 'All Classes' },
  { value: 'metals', label: 'Metals' },
  { value: 'markets', label: 'Markets' },
  { value: 'liquidity', label: 'Liquidity' },
  { value: 'real_estate', label: 'Real Estate' },
];

export default function Analytics() {
  const { t } = useTranslation();
  const [range, setRange] = useState<Range>('1Y');
  const [showProjection, setShowProjection] = useState(false);
  const [netWorth, setNetWorth] = useState<NetWorthPoint[]>([]);
  const [performance, setPerformance] = useState<PerformancePoint[]>([]);
  const [projection, setProjection] = useState<ProjectionPoint[]>([]);
  const [pnl, setPnl] = useState<PnlResult | null>(null);
  const [pnlAssetClass, setPnlAssetClass] = useState('');
  const [pnlDateFrom, setPnlDateFrom] = useState('');
  const [pnlDateTo, setPnlDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [pnlLoading, setPnlLoading] = useState(false);

  const ASSET_CLASS_OPTIONS = [
    { value: '', label: t('ledger.allAssetClasses') },
    { value: 'metals', label: t('enums.assetClasses.metals') },
    { value: 'markets', label: t('enums.assetClasses.markets') },
    { value: 'liquidity', label: t('enums.assetClasses.liquidity') },
    { value: 'real_estate', label: t('enums.assetClasses.real_estate') },
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [nwRes, perfRes] = await Promise.all([
        apiFetch<{ data: NetWorthPoint[] }>(`/api/v1/analytics/net-worth?range=${range}`),
        apiFetch<{ data: PerformancePoint[] }>(`/api/v1/analytics/performance?range=${range}`),
      ]);
      setNetWorth(nwRes.data ?? []);
      setPerformance(perfRes.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [range]);

  const fetchProjection = useCallback(async () => {
    if (!showProjection) { setProjection([]); return; }
    const res = await apiFetch<{ data: ProjectionPoint[] }>(`/api/v1/analytics/projection?range=${range}`);
    setProjection(res.data ?? []);
  }, [showProjection, range]);

  const fetchPnl = useCallback(async () => {
    setPnlLoading(true);
    try {
      const params = new URLSearchParams();
      if (pnlAssetClass) params.set('asset_class', pnlAssetClass);
      if (pnlDateFrom) params.set('date_from', pnlDateFrom);
      if (pnlDateTo) params.set('date_to', pnlDateTo);
      const res = await apiFetch<{ data: PnlResult }>(`/api/v1/analytics/pnl?${params}`);
      setPnl(res.data ?? null);
    } finally {
      setPnlLoading(false);
    }
  }, [pnlAssetClass, pnlDateFrom, pnlDateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchProjection(); }, [fetchProjection]);
  useEffect(() => { fetchPnl(); }, [fetchPnl]);

  const handleRangeChange = (r: Range) => setRange(r);

  const rangeLabels: Record<string, string> = {
    '3M': t('analytics.ranges.3m', { defaultValue: '3M' }),
    '6M': t('analytics.ranges.6m', { defaultValue: '6M' }),
    '1Y': t('analytics.ranges.1y', { defaultValue: '1Y' }),
    'all': t('analytics.ranges.all', { defaultValue: 'All' }),
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('analytics.title')}</h1>
          <p className="text-sm text-gray-400 mt-1">{t('analytics.description')}</p>
        </div>
      </div>

      {/* Net Worth Trajectory */}
      <div className="bg-[#111] border border-[#222] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-white">{t('analytics.netWorthTrend')}</h2>
            <p className="text-xs text-gray-400">
              {range === 'all' 
                ? t('analytics.trailingAllTime', { defaultValue: 'Trailing all time' }) 
                : t('analytics.trailingRange', { range: rangeLabels[range], defaultValue: `Trailing ${rangeLabels[range]}` })}
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showProjection}
              onChange={e => setShowProjection(e.target.checked)}
              className="accent-green-500"
            />
            {t('analytics.showProjection', { defaultValue: 'Show projection' })}
          </label>
        </div>
        {loading ? (
          <div className="h-56 bg-[#1a1a1a] rounded-lg animate-pulse" />
        ) : netWorth.length === 0 ? (
          <EmptyState title={t('analytics.noData')} description={t('analytics.noDataDesc')} />
        ) : (
          <NetWorthLine
            data={netWorth}
            projectionData={showProjection ? projection : undefined}
            range={range}
            onRangeChange={handleRangeChange}
          />
        )}
      </div>

      {/* Performance Matrix */}
      <div className="bg-[#111] border border-[#222] rounded-xl p-5">
        <h2 className="font-semibold text-white mb-4">{t('analytics.assetAllocation')}</h2>
        {loading ? (
          <div className="h-56 bg-[#1a1a1a] rounded-lg animate-pulse" />
        ) : performance.length === 0 ? (
          <EmptyState title={t('analytics.noData')} description={t('analytics.noDataDesc')} />
        ) : (
          <AssetGroupedBar data={performance} />
        )}
      </div>

      {/* Realized P&L */}
      <div className="bg-[#111] border border-[#222] rounded-xl p-5">
        <h2 className="font-semibold text-white mb-4">{t('analytics.realizedPL', { defaultValue: 'Realized P&L' })}</h2>
        <div className="flex flex-wrap gap-3 mb-4">
          <select
            value={pnlAssetClass}
            onChange={e => setPnlAssetClass(e.target.value)}
            className="bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600"
          >
            {ASSET_CLASS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            type="date"
            value={pnlDateFrom}
            onChange={e => setPnlDateFrom(e.target.value)}
            className="bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600"
          />
          <input
            type="date"
            value={pnlDateTo}
            onChange={e => setPnlDateTo(e.target.value)}
            className="bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600"
          />
        </div>

        {pnlLoading ? (
          <div className="h-24 bg-[#1a1a1a] rounded-lg animate-pulse" />
        ) : pnl ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-[#1a1a1a] rounded-xl">
              <span className="text-sm font-medium text-gray-300">{t('analytics.totalRealizedPL', { defaultValue: 'Total Realized P&L' })}</span>
              <span className={`text-lg font-bold ${parseFloat(pnl.total_realized_pnl) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {parseFloat(pnl.total_realized_pnl) >= 0 ? '+' : ''}{abbreviateVND(Math.abs(parseFloat(pnl.total_realized_pnl)))}
              </span>
            </div>
            {pnl.by_class.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-[#222]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#222] text-gray-400 text-xs uppercase tracking-widest">
                      <th className="px-4 py-3 text-left">{t('ledger.assetClass')}</th>
                      <th className="px-4 py-3 text-right">{t('analytics.realizedPL', { defaultValue: 'Realized P&L' })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pnl.by_class.map(c => {
                      const v = parseFloat(c.realized_pnl);
                      return (
                        <tr key={c.asset_class} className="border-b border-[#1a1a1a]">
                          <td className="px-4 py-3 text-gray-200 capitalize">
                            {t(`enums.assetClasses.${c.asset_class}` as any, { defaultValue: c.asset_class.replace('_', ' ') })}
                          </td>
                          <td className={`px-4 py-3 text-right font-mono font-semibold ${v >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {v >= 0 ? '+' : ''}{abbreviateVND(Math.abs(v))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <EmptyState title={t('analytics.noPnlData', { defaultValue: 'No P&L data' })} description={t('analytics.noPnlDesc', { defaultValue: 'Realized P&L will appear after selling investment lots.' })} />
        )}
      </div>
    </div>
  );
}

